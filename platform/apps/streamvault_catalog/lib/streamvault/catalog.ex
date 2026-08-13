defmodule StreamVault.Catalog do
  @moduledoc "Public catalog facade. Callers never depend on ETS details."

  alias StreamVault.Catalog.{Index, Server}
  alias StreamVault.Core.{Normalizer, Search, Sections}

  @spec list(:mixed | :movie | :series) :: [StreamVault.Core.Media.t()]
  def list(kind \\ :mixed) do
    {index, _metadata} = Server.snapshot()
    Index.all(index, kind)
  end

  @spec get(String.t()) :: {:ok, StreamVault.Core.Media.t()} | :error
  def get(id) do
    {index, _metadata} = Server.snapshot()
    Index.get(index, id)
  end

  @spec search(String.t(), keyword()) :: [StreamVault.Core.Media.t()]
  def search(query, options \\ []) do
    kind = Keyword.get(options, :kind, :mixed)
    {index, _metadata} = Server.snapshot()
    terms = Normalizer.tokens(query)
    candidates = Index.candidates(index, terms, kind)
    pool = if candidates == [], do: Index.all(index, kind), else: candidates
    Search.run(pool, query, options)
  end

  @spec section(String.t()) :: [StreamVault.Core.Media.t()]
  def section(key), do: list(:mixed) |> Sections.select(key)

  @spec home_feed(pos_integer()) :: map()
  def home_feed(limit), do: list(:mixed) |> Sections.home_feed(limit)

  @spec stats() :: map()
  def stats do
    {_index, metadata} = Server.snapshot()
    metadata
  end

  defdelegate reload(), to: Server
end
