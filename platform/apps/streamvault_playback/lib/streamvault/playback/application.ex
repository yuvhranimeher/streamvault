defmodule StreamVault.Playback.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [StreamVault.Playback.SessionStore]
    Supervisor.start_link(children, strategy: :one_for_one, name: StreamVault.Playback.Supervisor)
  end
end
