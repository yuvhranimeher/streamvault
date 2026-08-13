defmodule StreamVault.Catalog.Loader do
  @moduledoc "Loads the legacy crawler catalog into canonical media records."

  alias StreamVault.Core.Normalizer

  @spec load(Path.t()) :: {:ok, [StreamVault.Core.Media.t()], map()} | {:error, term()}
  def load(path) do
    started = System.monotonic_time()

    with {:ok, bytes} <- File.read(path),
         {:ok, decoded} <- Jason.decode(bytes),
         {:ok, movies, series} <- container(decoded) do
      movie_records = normalize(movies, :movie)
      series_records = normalize(series, :series)
      items = movie_records ++ series_records

      metadata = %{
        path: path,
        bytes: byte_size(bytes),
        movies: length(movie_records),
        series: length(series_records),
        total: length(items),
        generated_at: decoded["generatedAt"],
        duration_ms: duration_ms(started)
      }

      {:ok, items, metadata}
    end
  rescue
    error -> {:error, {:invalid_catalog, error}}
  end

  defp container(%{"movies" => movies, "series" => series}) when is_list(movies) and is_list(series),
    do: {:ok, movies, series}

  defp container(items) when is_list(items), do: {:ok, items, []}
  defp container(_), do: {:error, :unsupported_catalog_shape}

  defp normalize(records, kind) do
    records
    |> Enum.with_index()
    |> Enum.map(fn {record, index} -> Normalizer.media(record, kind, index) end)
  end

  defp duration_ms(started) do
    System.monotonic_time()
    |> Kernel.-(started)
    |> System.convert_time_unit(:native, :millisecond)
  end
end
