defmodule StreamVault.Core.Normalizer do
  @moduledoc "Normalizes inconsistent crawler output into deterministic domain values."

  alias StreamVault.Core.Media

  @noise ~w(2160p 1080p 720p 480p 4k uhd hdr webrip web-dl bluray brrip x264 x265 h264 h265 hevc aac dts)

  @spec media(map(), Media.kind(), non_neg_integer()) :: Media.t()
  def media(raw, kind, index) when kind in [:movie, :series] do
    title = value(raw, ["title", "name", :title, :name]) |> clean_title()
    year = integer(value(raw, ["year", :year]) || extract_year(title))
    id = value(raw, ["id", :id]) || stable_id(kind, title, year, index)

    %Media{
      id: to_string(id),
      title: title,
      kind: kind,
      filename: value(raw, ["filename", "file", :filename, :file]),
      year: year,
      category: value(raw, ["category", :category]),
      genre: value(raw, ["genre", :genre]),
      language: value(raw, ["language", :language]),
      rating: number(value(raw, ["rating", :rating])),
      poster: value(raw, ["poster", :poster]),
      backdrop: value(raw, ["backdrop", :backdrop]),
      overview: value(raw, ["overview", :overview]),
      stream_url: value(raw, ["streamUrl", "stream_url", :streamUrl, :stream_url]),
      server: value(raw, ["server", :server]),
      tmdb_id: value(raw, ["tmdbId", "tmdb_id", :tmdbId, :tmdb_id]),
      seasons: normalize_seasons(value(raw, ["seasons", :seasons])),
      source: source(raw),
      search_text: search_text(raw, title, year)
    }
  end

  @spec clean_title(term()) :: String.t()
  def clean_title(value) do
    value
    |> to_string()
    |> String.replace(~r/[._]+/u, " ")
    |> String.replace(~r/\s+/u, " ")
    |> String.trim()
  end

  @spec search_normalize(term()) :: String.t()
  def search_normalize(value) do
    value
    |> to_string()
    |> String.downcase()
    |> String.normalize(:nfd)
    |> String.replace(~r/[^\p{L}\p{N}]+/u, " ")
    |> String.replace(~r/\s+/u, " ")
    |> String.trim()
  end

  @spec tokens(term()) :: [String.t()]
  def tokens(value) do
    value
    |> search_normalize()
    |> String.split(" ", trim: true)
    |> Enum.reject(&(&1 in @noise))
    |> Enum.uniq()
  end

  defp search_text(raw, title, year) do
    [
      title,
      year,
      value(raw, ["filename", :filename]),
      value(raw, ["category", :category]),
      value(raw, ["genre", :genre]),
      value(raw, ["language", :language]),
      value(raw, ["overview", :overview])
    ]
    |> Enum.reject(&is_nil/1)
    |> Enum.join(" ")
    |> search_normalize()
  end

  defp stable_id(kind, title, year, index) do
    digest = :crypto.hash(:sha256, "#{kind}|#{search_normalize(title)}|#{year}|#{index}")
    encoded = Base.url_encode64(digest, padding: false) |> binary_part(0, 16)
    "#{kind}_#{encoded}"
  end

  defp source(raw) do
    if value(raw, ["isFtp", :isFtp, "streamUrl", :streamUrl]), do: :remote, else: :local
  end

  defp normalize_seasons(nil), do: %{}
  defp normalize_seasons(value) when is_map(value), do: value

  defp normalize_seasons(value) when is_list(value) do
    value
    |> Enum.with_index(1)
    |> Map.new(fn {season, index} ->
      number = value(season, ["season", :season]) |> extract_number(index)
      episodes = value(season, ["episodes", :episodes]) || []
      {Integer.to_string(number), normalize_episodes(episodes)}
    end)
  end

  defp normalize_seasons(_), do: %{}

  defp normalize_episodes(episodes) do
    episodes
    |> Enum.with_index(1)
    |> Enum.map(fn {episode, index} ->
      %{
        "episode" => integer(value(episode, ["episode", :episode])) || index,
        "epTitle" => value(episode, ["epTitle", "title", :epTitle, :title]) || "Episode #{index}",
        "filename" => value(episode, ["filename", "file", :filename, :file]),
        "streamUrl" => value(episode, ["streamUrl", "stream_url", :streamUrl, :stream_url]),
        "isFtp" => true
      }
    end)
  end

  defp value(map, keys) when is_map(map), do: Enum.find_value(keys, &Map.get(map, &1))
  defp value(_, _), do: nil

  defp integer(value) when is_integer(value), do: value
  defp integer(value) when is_float(value), do: trunc(value)

  defp integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {number, _} -> number
      :error -> nil
    end
  end

  defp integer(_), do: nil

  defp number(value) when is_number(value), do: value / 1

  defp number(value) when is_binary(value) do
    case Float.parse(value) do
      {number, _} -> number
      :error -> nil
    end
  end

  defp number(_), do: nil

  defp extract_year(value) do
    case Regex.run(~r/\b(?:19|20)\d{2}\b/, to_string(value)) do
      [year] -> year
      _ -> nil
    end
  end

  defp extract_number(value, fallback) do
    case Regex.run(~r/\d+/, to_string(value)) do
      [number] -> String.to_integer(number)
      _ -> fallback
    end
  end
end
