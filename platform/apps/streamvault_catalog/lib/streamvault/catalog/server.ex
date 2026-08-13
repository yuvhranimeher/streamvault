defmodule StreamVault.Catalog.Server do
  @moduledoc "Owns atomic catalog generations and reload scheduling."

  use GenServer

  require Logger

  alias StreamVault.Catalog.{Index, Loader}

  @persistent_key {__MODULE__, :active_generation}

  defstruct [:index, :metadata, :path, :timer, generation: 0, status: :booting, last_error: nil]

  def start_link(options \\ []), do: GenServer.start_link(__MODULE__, options, name: __MODULE__)

  @spec snapshot() :: {Index.generation(), map()}
  def snapshot do
    case :persistent_term.get(@persistent_key, :missing) do
      :missing -> {Index.build([], 0), %{status: :booting, total: 0}}
      snapshot -> snapshot
    end
  end

  @spec reload() :: {:ok, map()} | {:error, term()}
  def reload, do: GenServer.call(__MODULE__, :reload, :timer.minutes(2))

  @spec status() :: map()
  def status, do: GenServer.call(__MODULE__, :status)

  @impl true
  def init(options) do
    path =
      Keyword.get(options, :path, Application.fetch_env!(:streamvault_catalog, :catalog_path))

    state = %__MODULE__{path: path}

    case load_generation(state) do
      {:ok, loaded} ->
        {:ok, schedule_reload(loaded)}

      {:error, reason, failed} ->
        Logger.error("catalog startup failed: #{inspect(reason)}")
        index = Index.build([], 0)
        metadata = %{status: :degraded, total: 0, path: path, error: inspect(reason)}
        :persistent_term.put(@persistent_key, {index, metadata})
        {:ok, schedule_reload(%{failed | index: index, metadata: metadata})}
    end
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case load_generation(state) do
      {:ok, loaded} -> {:reply, {:ok, loaded.metadata}, schedule_reload(loaded)}
      {:error, reason, failed} -> {:reply, {:error, reason}, schedule_reload(failed)}
    end
  end

  def handle_call(:status, _from, state) do
    response =
      Map.merge(state.metadata || %{}, %{
        status: state.status,
        generation: state.generation,
        last_error: inspect(state.last_error)
      })

    {:reply, response, state}
  end

  @impl true
  def handle_info(:scheduled_reload, state) do
    case load_generation(state) do
      {:ok, loaded} -> {:noreply, schedule_reload(loaded)}
      {:error, _reason, failed} -> {:noreply, schedule_reload(failed)}
    end
  end

  def handle_info({:retire, index}, state) do
    Index.destroy(index)
    {:noreply, state}
  end

  defp load_generation(state) do
    next_generation = state.generation + 1
    started = System.monotonic_time()

    case Loader.load(state.path) do
      {:ok, items, metadata} ->
        next_index = Index.build(items, next_generation)

        public_metadata =
          Map.merge(metadata, %{
            status: :ready,
            generation: next_generation,
            loaded_at: DateTime.utc_now()
          })

        previous = state.index
        :persistent_term.put(@persistent_key, {next_index, public_metadata})
        Process.send_after(self(), {:retire, previous}, 5_000)

        :telemetry.execute(
          [:streamvault, :catalog, :reload],
          %{duration: System.monotonic_time() - started, count: length(items)},
          %{generation: next_generation, path: state.path}
        )

        Logger.info("catalog generation #{next_generation} loaded with #{length(items)} records")

        {:ok,
         %{
           state
           | index: next_index,
             metadata: public_metadata,
             generation: next_generation,
             status: :ready,
             last_error: nil
         }}

      {:error, reason} ->
        Logger.error("catalog reload failed: #{inspect(reason)}")

        {:error, reason,
         %{state | status: if(state.index, do: :stale, else: :degraded), last_error: reason}}
    end
  end

  defp schedule_reload(state) do
    if state.timer, do: Process.cancel_timer(state.timer)

    timer =
      case Application.get_env(:streamvault_catalog, :reload_interval_ms, :timer.minutes(15)) do
        :infinity -> nil
        milliseconds -> Process.send_after(self(), :scheduled_reload, milliseconds)
      end

    %{state | timer: timer}
  end
end
