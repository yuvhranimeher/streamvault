defmodule StreamVault.Core.Sections do
  @moduledoc "Rule-driven discovery sections without hard-coding them into HTTP controllers."

  alias StreamVault.Core.{Media, Normalizer}

  @definitions [
    %{key: "new", row_id: "newRow", title: "New to StreamVault", rule: {:year_at_least, 2020}},
    %{key: "topRated", row_id: "highRatedRow", title: "Top Rated", rule: {:rating_at_least, 8.0}},
    %{key: "series", row_id: "seriesRow", title: "Series", rule: {:kind, :series}},
    %{key: "indian", row_id: "indianRow", title: "Indian Movies & Drama", rule: {:contains, ~w(hindi bangla bengali tamil telugu bollywood india)}},
    %{key: "anime", row_id: "animeRow", title: "Anime", rule: {:contains, ~w(anime japanese animation)}},
    %{key: "koreanDrama", row_id: "koreanRow", title: "Korean Drama", rule: {:contains, ~w(korean korea kdrama)}},
    %{key: "horrorNights", row_id: "horrorRow", title: "Horror Nights", rule: {:contains, ~w(horror ghost demon haunted)}},
    %{key: "cyberpunkScifi", row_id: "scifiRow", title: "Cyberpunk & Sci-Fi", rule: {:contains, ~w(scifi science space cyberpunk futuristic alien)}},
    %{key: "documentaryVault", row_id: "documentaryRow", title: "Documentary Vault", rule: {:contains, ~w(documentary biography history nature)}},
    %{key: "allMovies", row_id: "allRow", title: "All Movies", rule: {:kind, :movie}}
  ]

  @spec definitions() :: [map()]
  def definitions, do: @definitions

  @spec select([Media.t()], String.t()) :: [Media.t()]
  def select(items, key) do
    case Enum.find(@definitions, &(&1.key == key)) do
      nil -> rank(items)
      definition -> items |> Enum.filter(&matches?(&1, definition.rule)) |> rank()
    end
  end

  @spec home_feed([Media.t()], pos_integer()) :: map()
  def home_feed(items, limit) do
    rows =
      @definitions
      |> Enum.map(fn definition ->
        selected = items |> Enum.filter(&matches?(&1, definition.rule)) |> rank() |> Enum.take(limit)
        %{rowId: definition.row_id, sectionKey: definition.key, title: definition.title, items: selected}
      end)
      |> Enum.reject(&Enum.empty?(&1.items))

    hero =
      rows
      |> Enum.flat_map(& &1.items)
      |> Enum.filter(&(&1.backdrop || &1.poster))
      |> Enum.uniq_by(& &1.id)
      |> Enum.take(10)

    %{ok: true, hero: hero, rows: rows}
  end

  defp matches?(%Media{kind: kind}, {:kind, kind}), do: true
  defp matches?(%Media{year: year}, {:year_at_least, minimum}) when is_integer(year), do: year >= minimum
  defp matches?(%Media{rating: rating}, {:rating_at_least, minimum}) when is_number(rating), do: rating >= minimum

  defp matches?(%Media{search_text: text}, {:contains, terms}) do
    normalized = Normalizer.search_normalize(text)
    Enum.any?(terms, &String.contains?(normalized, &1))
  end

  defp matches?(_, _), do: false

  defp rank(items) do
    Enum.sort_by(items, fn item ->
      {if(item.poster || item.backdrop, do: 0, else: 1), -(item.rating || 0), -(item.year || 0), item.title}
    end)
  end
end
