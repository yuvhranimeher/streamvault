defmodule StreamVault.Playback do
  @moduledoc "Playback planning facade used by the HTTP edge."

  alias StreamVault.Catalog
  alias StreamVault.Playback.{Capability, PlannerClient, Probe, SessionStore}

  @spec plan(String.t(), map(), map(), String.t()) :: {:ok, map()} | {:error, :not_found}
  def plan(media_id, probe_map, capability_map, client_id) do
    with {:ok, media} <- Catalog.get(media_id) do
      probe = Probe.from_map(probe_map)
      capability = Capability.from_map(capability_map)
      plan = PlannerClient.plan(media, probe, capability)
      session = SessionStore.open(media.id, client_id, %{strategy: plan.strategy})
      {:ok, plan |> Map.from_struct() |> Map.put(:session_id, session.id)}
    else
      :error -> {:error, :not_found}
    end
  end

  defdelegate touch(session_id, attributes \\ %{}), to: SessionStore
  defdelegate close(session_id), to: SessionStore
  defdelegate sessions(), to: SessionStore, as: :active
end
