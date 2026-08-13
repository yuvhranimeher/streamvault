defmodule StreamVault.Edge.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Phoenix.PubSub, name: StreamVault.Edge.PubSub},
      {Task.Supervisor, name: StreamVault.Edge.TaskSupervisor},
      StreamVault.Edge.RateLimiter,
      StreamVault.Edge.HistoryStore,
      StreamVault.Edge.MetricsStore,
      StreamVault.Edge.Telemetry,
      StreamVault.Edge.Endpoint
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: StreamVault.Edge.Supervisor)
  end

  @impl true
  def config_change(changed, _new, removed) do
    StreamVault.Edge.Endpoint.config_change(changed, removed)
    :ok
  end
end
