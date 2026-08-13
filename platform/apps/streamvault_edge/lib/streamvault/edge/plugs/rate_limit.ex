defmodule StreamVault.Edge.Plugs.RateLimit do
  @behaviour Plug

  import Plug.Conn

  @impl true
  def init(options), do: options

  @impl true
  def call(conn, options) do
    limit = Keyword.get(options, :limit, 300)
    window_ms = Keyword.get(options, :window_ms, :timer.minutes(1))
    key = conn.assigns[:client_id] || "unknown"

    case StreamVault.Edge.RateLimiter.allow?(key, limit, window_ms) do
      {:allow, remaining} ->
        put_resp_header(conn, "x-ratelimit-remaining", Integer.to_string(remaining))

      {:deny, retry_ms} ->
        body =
          Jason.encode!(%{
            error: %{code: "rate_limited", message: "Too many requests", retry_after_ms: retry_ms}
          })

        conn
        |> put_resp_content_type("application/json")
        |> put_resp_header("retry-after", Integer.to_string(ceil(retry_ms / 1_000)))
        |> send_resp(429, body)
        |> halt()
    end
  end
end
