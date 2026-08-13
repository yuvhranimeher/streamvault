defmodule StreamVault.Edge.Controllers.HealthController do
  use StreamVault.Edge, :controller

  alias StreamVault.Catalog
  alias StreamVault.Edge.Controllers.Response

  def show(conn, _params) do
    Response.ok(conn, %{
      ok: true,
      service: "streamvault-edge",
      version: "2.0.0",
      node: Atom.to_string(node()),
      uptime_seconds: div(:erlang.statistics(:wall_clock) |> elem(0), 1_000),
      time: DateTime.utc_now()
    })
  end

  def ready(conn, _params) do
    stats = Catalog.stats()
    ready? = stats[:status] == :ready or stats["status"] == "ready"

    if ready? do
      Response.ok(conn, %{ok: true, catalog: stats})
    else
      Response.error(conn, 503, "not_ready", "Catalog has not finished loading", stats)
    end
  end

  def version(conn, _params) do
    Response.ok(
      conn,
      %{
        ok: true,
        version: "phoenix-haskell-platform-v2",
        compatibility: "node-api-v1",
        time: DateTime.utc_now()
      },
      max_age: 10
    )
  end

  def metrics(conn, _params) do
    conn
    |> put_resp_content_type("text/plain; version=0.0.4")
    |> send_resp(200, StreamVault.Edge.MetricsStore.render())
  end
end
