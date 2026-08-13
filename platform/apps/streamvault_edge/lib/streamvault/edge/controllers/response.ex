defmodule StreamVault.Edge.Controllers.Response do
  @moduledoc false

  import Plug.Conn
  import Phoenix.Controller

  def ok(conn, payload, options \\ []) do
    max_age = Keyword.get(options, :max_age, 0)

    conn
    |> put_resp_header("cache-control", cache_control(max_age))
    |> json(payload)
  end

  def error(conn, status, code, message, details \\ %{}) do
    request_id = get_resp_header(conn, "x-request-id") |> List.first()

    conn
    |> put_status(status)
    |> json(%{error: %{code: code, message: message, details: details, request_id: request_id}})
  end

  defp cache_control(0), do: "no-store"
  defp cache_control(seconds), do: "public, max-age=#{seconds}, stale-while-revalidate=#{seconds * 2}"
end
