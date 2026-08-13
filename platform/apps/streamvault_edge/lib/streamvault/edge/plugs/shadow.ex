defmodule StreamVault.Edge.Plugs.Shadow do
  @behaviour Plug

  import Plug.Conn

  @routes ~w(/api/version /api/catalog-stats /api/movies /api/series /api/search /api/home-feed)

  @impl true
  def init(options), do: options

  @impl true
  def call(conn, _options) do
    enabled = Application.get_env(:streamvault_edge, :shadow_enabled, false)

    if enabled and conn.method == "GET" and conn.request_path in @routes do
      register_before_send(conn, fn response ->
        native_body = response.resp_body

        path =
          response.request_path <>
            if(response.query_string == "", do: "", else: "?" <> response.query_string)

        Task.Supervisor.start_child(StreamVault.Edge.TaskSupervisor, fn ->
          compare(path, native_body)
        end)

        response
      end)
    else
      conn
    end
  end

  defp compare(path, native_body) do
    origin = Application.fetch_env!(:streamvault_edge, :legacy_origin)

    case Req.get(origin <> path, receive_timeout: 10_000, retry: false) do
      {:ok, %{status: 200, body: legacy_body}} ->
        native_hash = semantic_hash(native_body)
        legacy_hash = semantic_hash(legacy_body)

        :telemetry.execute(
          [:streamvault, :shadow, :compare],
          %{match: if(native_hash == legacy_hash, do: 1, else: 0)},
          %{path: path, native_hash: native_hash, legacy_hash: legacy_hash}
        )

      _ ->
        :telemetry.execute([:streamvault, :shadow, :error], %{count: 1}, %{path: path})
    end
  end

  defp semantic_hash(value) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} -> semantic_hash(decoded)
      _ -> hash(value)
    end
  end

  defp semantic_hash(value), do: value |> canonical() |> Jason.encode!() |> hash()

  defp canonical(map) when is_map(map),
    do:
      map |> Enum.sort_by(&elem(&1, 0)) |> Map.new(fn {key, value} -> {key, canonical(value)} end)

  defp canonical(list) when is_list(list), do: Enum.map(list, &canonical/1)
  defp canonical(value), do: value
  defp hash(value), do: :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)
end
