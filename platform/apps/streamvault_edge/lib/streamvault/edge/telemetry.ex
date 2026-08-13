defmodule StreamVault.Edge.Telemetry do
  use Supervisor

  import Telemetry.Metrics

  def start_link(arg), do: Supervisor.start_link(__MODULE__, arg, name: __MODULE__)

  @impl true
  def init(_arg) do
    children = [
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  def metrics do
    [
      summary("phoenix.endpoint.stop.duration", unit: {:native, :millisecond}),
      counter("phoenix.endpoint.stop.duration"),
      summary("streamvault.catalog.reload.duration", unit: {:native, :millisecond}),
      last_value("streamvault.catalog.reload.count"),
      summary("streamvault.playback.plan.duration",
        unit: {:native, :millisecond},
        tags: [:strategy, :planner]
      ),
      counter("streamvault.shadow.compare.match", tags: [:path]),
      counter("streamvault.shadow.error.count", tags: [:path]),
      last_value("vm.memory.total", unit: {:byte, :megabyte}),
      last_value("vm.total_run_queue_lengths.total")
    ]
  end

  defp periodic_measurements, do: [{__MODULE__, :dispatch_vm_stats, []}]

  def dispatch_vm_stats do
    memory = :erlang.memory(:total)
    total = :erlang.statistics(:total_run_queue_lengths_all)
    :telemetry.execute([:vm, :memory], %{total: memory}, %{})
    :telemetry.execute([:vm, :total_run_queue_lengths], %{total: total}, %{})
  end
end
