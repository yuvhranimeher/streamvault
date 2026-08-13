defmodule StreamVault.Edge.Controllers.PlaybackController do
  use StreamVault.Edge, :controller

  alias StreamVault.Edge.Controllers.Response
  alias StreamVault.Playback

  def plan(conn, %{"id" => id} = params) do
    probe = params["probe"] || %{}

    capability =
      Map.put_new(
        params["capability"] || %{},
        "userAgent",
        get_req_header(conn, "user-agent") |> List.first() || ""
      )

    case Playback.plan(id, probe, capability, conn.assigns.client_id) do
      {:ok, plan} ->
        Response.ok(conn, plan)

      {:error, :not_found} ->
        Response.error(conn, 404, "media_not_found", "No catalog item matches that id")
    end
  end

  def touch(conn, %{"id" => session_id} = params) do
    attributes = Map.drop(params, ["id"])

    case Playback.touch(session_id, attributes) do
      {:ok, session} -> Response.ok(conn, %{ok: true, session: session})
      :error -> Response.error(conn, 404, "session_not_found", "Playback session has expired")
    end
  end

  def close(conn, %{"id" => session_id}) do
    :ok = Playback.close(session_id)
    Response.ok(conn, %{ok: true})
  end

  def index(conn, _params) do
    sessions = Enum.filter(Playback.sessions(), &(&1.client_id == conn.assigns.client_id))
    Response.ok(conn, %{sessions: sessions, total: length(sessions)})
  end
end
