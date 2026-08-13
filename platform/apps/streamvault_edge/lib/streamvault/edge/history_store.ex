defmodule StreamVault.Edge.HistoryStore do
  @moduledoc "Per-client progress store preserving the original history API shape."

  use GenServer

  @table :streamvault_history

  def start_link(options \\ []), do: GenServer.start_link(__MODULE__, options, name: __MODULE__)
  def list(client_id), do: GenServer.call(__MODULE__, {:list, client_id})
  def put(client_id, media_id, attributes), do: GenServer.call(__MODULE__, {:put, client_id, media_id, attributes})
  def delete(client_id, media_id), do: GenServer.call(__MODULE__, {:delete, client_id, media_id})

  @impl true
  def init(_options) do
    :ets.new(@table, [:named_table, :set, :protected, read_concurrency: true])
    {:ok, %{}}
  end

  @impl true
  def handle_call({:list, client_id}, _from, state) do
    history =
      @table
      |> :ets.match_object({{client_id, :_}, :_})
      |> Map.new(fn {{^client_id, media_id}, entry} -> {media_id, entry} end)

    {:reply, history, state}
  end

  def handle_call({:put, client_id, media_id, attributes}, _from, state) do
    entry = Map.merge(attributes, %{updatedAt: System.system_time(:millisecond)})
    true = :ets.insert(@table, {{client_id, media_id}, entry})
    Phoenix.PubSub.broadcast(StreamVault.Edge.PubSub, "history:#{client_id}", {:history_updated, media_id, entry})
    {:reply, {:ok, entry}, state}
  end

  def handle_call({:delete, client_id, media_id}, _from, state) do
    :ets.delete(@table, {client_id, media_id})
    {:reply, :ok, state}
  end
end
