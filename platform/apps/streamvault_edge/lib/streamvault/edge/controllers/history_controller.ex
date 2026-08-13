defmodule StreamVault.Edge.Controllers.HistoryController do
  use StreamVault.Edge, :controller

  alias StreamVault.Edge.{Controllers.Response, HistoryStore}

  def index(conn, _params), do: Response.ok(conn, HistoryStore.list(conn.assigns.client_id))

  def create(conn, params) do
    with {:ok, media_id} <- media_id(params),
         {:ok, progress} <- progress(params["progress"]) do
      attributes = %{
        progress: progress,
        name: params |> Map.get("name", "") |> to_string() |> String.slice(0, 200),
        poster: params["poster"],
        duration: number(params["duration"]) || 0
      }

      {:ok, entry} = HistoryStore.put(conn.assigns.client_id, media_id, attributes)
      Response.ok(conn, %{ok: true, history: entry})
    else
      {:error, code, message} -> Response.error(conn, 400, code, message)
    end
  end

  def delete(conn, %{"id" => id}) do
    :ok = HistoryStore.delete(conn.assigns.client_id, id)
    Response.ok(conn, %{ok: true})
  end

  defp media_id(%{"id" => id}) when is_integer(id), do: {:ok, Integer.to_string(id)}
  defp media_id(%{"id" => id}) when is_binary(id) and byte_size(id) > 0, do: {:ok, id}
  defp media_id(_), do: {:error, "invalid_media_id", "id must be a number or non-empty string"}

  defp progress(value) do
    case number(value) do
      number when is_number(number) and number >= 0 and number <= 1 -> {:ok, number}
      _ -> {:error, "invalid_progress", "progress must be between 0 and 1"}
    end
  end

  defp number(value) when is_number(value), do: value
  defp number(value) when is_binary(value) do
    case Float.parse(value) do
      {number, _} -> number
      _ -> nil
    end
  end
  defp number(_), do: nil
end
