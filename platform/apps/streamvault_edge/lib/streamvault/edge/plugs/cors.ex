defmodule StreamVault.Edge.Plugs.CORS do
  @behaviour Plug

  import Plug.Conn

  @allowed_methods "GET,POST,PATCH,DELETE,OPTIONS"
  @allowed_headers "accept,authorization,content-type,x-client-id,x-request-id,x-admin-key"

  @impl true
  def init(options), do: options

  @impl true
  def call(conn, _options) do
    origin = get_req_header(conn, "origin") |> List.first()
    allowed = allowed_origin(origin)

    conn =
      conn
      |> put_resp_header("access-control-allow-origin", allowed)
      |> put_resp_header("access-control-allow-methods", @allowed_methods)
      |> put_resp_header("access-control-allow-headers", @allowed_headers)
      |> put_resp_header("access-control-max-age", "86400")
      |> put_resp_header("vary", "origin")

    if conn.method == "OPTIONS", do: conn |> send_resp(204, "") |> halt(), else: conn
  end

  defp allowed_origin(nil), do: "*"

  defp allowed_origin(origin) do
    configured =
      Application.get_env(:streamvault_edge, :allowed_origins, [
        "https://streamvault.fit",
        "http://localhost:3000",
        "http://localhost:4000"
      ])

    if origin in configured, do: origin, else: "null"
  end
end
