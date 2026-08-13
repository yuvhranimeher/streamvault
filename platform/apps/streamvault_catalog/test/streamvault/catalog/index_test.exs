defmodule StreamVault.Catalog.IndexTest do
  use ExUnit.Case, async: true

  alias StreamVault.Catalog.Index
  alias StreamVault.Core.Media

  test "finds candidates through the inverted token index" do
    movie = %Media{id: "movie", title: "Arrival", kind: :movie, search_text: "arrival science fiction"}
    series = %Media{id: "series", title: "Dark", kind: :series, search_text: "dark science fiction"}
    index = Index.build([movie, series], 1)
    on_exit(fn -> Index.destroy(index) end)

    assert [^movie] = Index.candidates(index, ["arrival"], :mixed)
    assert [^series] = Index.candidates(index, ["dark"], :series)
    assert [] = Index.candidates(index, ["dark"], :movie)
  end
end
