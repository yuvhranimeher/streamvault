defmodule StreamVault.Core.Search do
  @moduledoc "Deterministic, explainable relevance scoring for media search."

  alias StreamVault.Core.{Media, Normalizer}

  @type scored :: {number(), Media.t()}

  @spec run(Enumerable.t(), String.t(), keyword()) :: [Media.t()]
  def run(items, query, options \\ []) do
    terms = Normalizer.tokens(query)
    kind = Keyword.get(options, :kind, :mixed)
    hard_limit = Keyword.get(options, :hard_limit, 5_000)

    if length(terms) == 0 do
      []
    else
      items
      |> Stream.filter(&kind_match?(&1, kind))
      |> Stream.map(&{score(&1, query, terms), &1})
      |> Stream.filter(fn {score, _} -> score > 0 end)
      |> Enum.sort_by(fn {score, item} ->
        {-score, -(item.rating || 0), -(item.year || 0), item.title}
      end)
      |> Enum.take(hard_limit)
      |> Enum.map(&elem(&1, 1))
    end
  end

  @spec score(Media.t(), String.t(), [String.t()] | nil) :: non_neg_integer()
  def score(%Media{} = item, raw_query, supplied_terms \\ nil) do
    query = Normalizer.search_normalize(raw_query)
    terms = supplied_terms || Normalizer.tokens(query)
    title = Normalizer.search_normalize(item.title)
    title_tokens = Normalizer.tokens(title)
    haystack_tokens = MapSet.new(Normalizer.tokens(item.search_text))

    exact = if title == query, do: 10_000, else: 0
    prefix = if String.starts_with?(title, query), do: 4_000, else: 0
    phrase = if String.contains?(item.search_text, query), do: 1_500, else: 0

    term_score =
      Enum.reduce(terms, 0, fn term, total ->
        cond do
          term in title_tokens -> total + 700
          MapSet.member?(haystack_tokens, term) -> total + 300
          Enum.any?(title_tokens, &String.starts_with?(&1, term)) -> total + 180
          true -> total
        end
      end)

    coverage = Enum.count(terms, &MapSet.member?(haystack_tokens, &1))
    coverage_bonus = if coverage == length(terms), do: 800, else: coverage * 50
    quality = round((item.rating || 0) * 10) + if(item.poster, do: 40, else: 0)

    exact + prefix + phrase + term_score + coverage_bonus + quality
  end

  defp kind_match?(_, :mixed), do: true
  defp kind_match?(%Media{kind: kind}, kind), do: true
  defp kind_match?(_, _), do: false
end
