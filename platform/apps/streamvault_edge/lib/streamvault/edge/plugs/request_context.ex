defmodule StreamVault.Edge.Plugs.RequestContext do
  @behaviour Plug

  import Plug.Conn
  require Logger

  @impl true
  def init(options), do: options

  @impl true
  def call(conn, _options) do
    request_id = get_resp_header(conn, "x-request-id") |> List.first() || "unknown"
    trace_id = get_req_header(conn, "traceparent") |> List.first() |> parse_trace_id() || request_id
    client_id = get_req_header(conn, "x-client-id") |> List.first() || anonymous_client(conn)

    Logger.metadata(request_id: request_id, trace_id: trace_id)

    conn
    |> assign(:trace_id, trace_id)
    |> assign(:client_id, client_id)
    |> put_resp_header("x-trace-id", trace_id)
  end

  defp parse_trace_id(nil), do: nil
  defp parse_trace_id(value), do: value |> String.split("-") |> Enum.at(1)

  defp anonymous_client(conn) do
    peer = conn.remote_ip |> :inet.ntoa() |> to_string()
    :crypto.hash(:sha256, peer <> (get_req_header(conn, "user-agent") |> List.first() || ""))
    |> Base.url_encode64(padding: false)
    |> binary_part(0, 18)
  end
end
