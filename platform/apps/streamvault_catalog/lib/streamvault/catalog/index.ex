defmodule StreamVault.Catalog.Index do
  @moduledoc "Immutable ETS generation with an inverted token index."

  alias StreamVault.Core.{Media, Normalizer}

  @type generation :: %{
          items: :ets.table(),
          tokens: :ets.table(),
          kinds: :ets.table(),
          generation: non_neg_integer()
        }

  @spec build([Media.t()], non_neg_integer()) :: generation()
  def build(items, generation) do
    item_table = :ets.new(:catalog_items, [:set, :public, read_concurrency: true])
    token_table = :ets.new(:catalog_tokens, [:bag, :public, read_concurrency: true])
    kind_table = :ets.new(:catalog_kinds, [:bag, :public, read_concurrency: true])

    item_rows = Enum.map(items, &{&1.id, &1})
    kind_rows = Enum.map(items, &{&1.kind, &1.id})

    token_rows =
      Enum.flat_map(items, fn media ->
        media.search_text
        |> Normalizer.tokens()
        |> Enum.map(&{&1, media.id})
      end)

    true = :ets.insert(item_table, item_rows)
    true = :ets.insert(kind_table, kind_rows)
    insert_chunks(token_table, token_rows)

    %{items: item_table, tokens: token_table, kinds: kind_table, generation: generation}
  end

  @spec all(generation(), :mixed | Media.kind()) :: [Media.t()]
  def all(index, :mixed), do: index.items |> :ets.tab2list() |> Enum.map(&elem(&1, 1))

  def all(index, kind) when kind in [:movie, :series] do
    index.kinds
    |> :ets.lookup(kind)
    |> Enum.map(&elem(&1, 1))
    |> fetch_many(index)
  end

  @spec get(generation(), String.t()) :: {:ok, Media.t()} | :error
  def get(index, id) do
    case :ets.lookup(index.items, id) do
      [{^id, media}] -> {:ok, media}
      [] -> :error
    end
  end

  @spec candidates(generation(), [String.t()], :mixed | Media.kind()) :: [Media.t()]
  def candidates(index, terms, kind) do
    ids =
      terms
      |> Enum.flat_map(fn term -> :ets.lookup(index.tokens, term) end)
      |> Enum.map(&elem(&1, 1))
      |> Enum.frequencies()
      |> Enum.sort_by(fn {_id, hits} -> -hits end)
      |> Enum.map(&elem(&1, 0))

    ids
    |> fetch_many(index)
    |> Enum.filter(&(kind == :mixed || &1.kind == kind))
  end

  @spec destroy(generation() | nil) :: :ok
  def destroy(nil), do: :ok

  def destroy(index) do
    Enum.each([index.items, index.tokens, index.kinds], fn table ->
      if :ets.info(table) != :undefined, do: :ets.delete(table)
    end)

    :ok
  end

  defp fetch_many(ids, index) do
    Enum.flat_map(ids, fn id ->
      case :ets.lookup(index.items, id) do
        [{^id, media}] -> [media]
        _ -> []
      end
    end)
  end

  defp insert_chunks(table, rows) do
    rows
    |> Stream.chunk_every(10_000)
    |> Enum.each(&:ets.insert(table, &1))
  end
end
