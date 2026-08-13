defmodule StreamVault.Catalog.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [StreamVault.Catalog.Server]
    Supervisor.start_link(children, strategy: :one_for_one, name: StreamVault.Catalog.Supervisor)
  end
end
