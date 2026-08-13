defmodule StreamVault.Edge.RateLimiter do
  @moduledoc "Low-overhead fixed-window limiter protecting expensive catalog operations."

  use GenServer

  @table :streamvault_rate_limits

  def start_link(options \\ []), do: GenServer.start_link(__MODULE__, options, name: __MODULE__)

  @spec allow?(String.t(), pos_integer(), pos_integer()) ::
          {:allow, non_neg_integer()} | {:deny, non_neg_integer()}
  def allow?(key, limit, window_ms) do
    GenServer.call(__MODULE__, {:allow, key, limit, window_ms})
  end

  @impl true
  def init(_options) do
    :ets.new(@table, [:named_table, :set, :protected])
    Process.send_after(self(), :sweep, :timer.minutes(5))
    {:ok, %{}}
  end

  @impl true
  def handle_call({:allow, key, limit, window_ms}, _from, state) do
    now = System.monotonic_time(:millisecond)

    {count, reset_at} =
      case :ets.lookup(@table, key) do
        [{^key, count, reset_at}] when reset_at > now -> {count + 1, reset_at}
        _ -> {1, now + window_ms}
      end

    true = :ets.insert(@table, {key, count, reset_at})

    result =
      if count <= limit,
        do: {:allow, max(limit - count, 0)},
        else: {:deny, max(reset_at - now, 0)}

    {:reply, result, state}
  end

  @impl true
  def handle_info(:sweep, state) do
    now = System.monotonic_time(:millisecond)

    @table
    |> :ets.tab2list()
    |> Enum.each(fn {key, _count, reset_at} ->
      if reset_at <= now, do: :ets.delete(@table, key)
    end)

    Process.send_after(self(), :sweep, :timer.minutes(5))
    {:noreply, state}
  end
end
