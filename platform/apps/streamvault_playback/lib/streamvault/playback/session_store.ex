defmodule StreamVault.Playback.SessionStore do
  @moduledoc "Bounded playback session state with monotonic TTL cleanup."

  use GenServer

  @table :streamvault_playback_sessions

  def start_link(options \\ []), do: GenServer.start_link(__MODULE__, options, name: __MODULE__)

  @spec open(String.t(), String.t(), map()) :: map()
  def open(media_id, client_id, attributes \\ %{}) do
    GenServer.call(__MODULE__, {:open, media_id, client_id, attributes})
  end

  @spec touch(String.t(), map()) :: {:ok, map()} | :error
  def touch(session_id, attributes \\ %{}),
    do: GenServer.call(__MODULE__, {:touch, session_id, attributes})

  @spec close(String.t()) :: :ok
  def close(session_id), do: GenServer.call(__MODULE__, {:close, session_id})
  @spec get(String.t()) :: {:ok, map()} | :error
  def get(session_id) do
    case :ets.lookup(@table, session_id) do
      [{^session_id, session}] -> {:ok, session}
      [] -> :error
    end
  end

  @spec active() :: [map()]
  def active, do: @table |> :ets.tab2list() |> Enum.map(&elem(&1, 1))

  @impl true
  def init(options) do
    :ets.new(@table, [:named_table, :set, :protected, read_concurrency: true])

    ttl =
      Keyword.get(
        options,
        :ttl_ms,
        Application.get_env(:streamvault_playback, :session_ttl_ms, :timer.minutes(30))
      )

    sweep =
      Keyword.get(
        options,
        :sweep_ms,
        Application.get_env(:streamvault_playback, :sweep_interval_ms, :timer.minutes(1))
      )

    Process.send_after(self(), :sweep, sweep)
    {:ok, %{ttl_ms: ttl, sweep_ms: sweep}}
  end

  @impl true
  def handle_call({:open, media_id, client_id, attributes}, _from, state) do
    now = System.monotonic_time(:millisecond)
    session_id = random_id()

    session =
      Map.merge(attributes, %{
        id: session_id,
        media_id: media_id,
        client_id: client_id,
        opened_at: now,
        touched_at: now
      })

    true = :ets.insert(@table, {session_id, session})
    {:reply, session, state}
  end

  def handle_call({:touch, session_id, attributes}, _from, state) do
    response =
      case :ets.lookup(@table, session_id) do
        [{^session_id, session}] ->
          updated =
            session
            |> Map.merge(attributes)
            |> Map.put(:touched_at, System.monotonic_time(:millisecond))

          true = :ets.insert(@table, {session_id, updated})
          {:ok, updated}

        [] ->
          :error
      end

    {:reply, response, state}
  end

  def handle_call({:close, session_id}, _from, state) do
    :ets.delete(@table, session_id)
    {:reply, :ok, state}
  end

  @impl true
  def handle_info(:sweep, state) do
    cutoff = System.monotonic_time(:millisecond) - state.ttl_ms

    @table
    |> :ets.tab2list()
    |> Enum.each(fn {session_id, session} ->
      if session.touched_at < cutoff, do: :ets.delete(@table, session_id)
    end)

    Process.send_after(self(), :sweep, state.sweep_ms)
    {:noreply, state}
  end

  defp random_id, do: :crypto.strong_rand_bytes(18) |> Base.url_encode64(padding: false)
end
