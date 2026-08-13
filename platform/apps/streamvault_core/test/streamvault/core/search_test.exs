defmodule StreamVault.Core.SearchTest do
  use ExUnit.Case, async: true

  alias StreamVault.Core.{Media, Search}

  test "exact titles outrank metadata-only matches" do
    exact = %Media{id: "1", title: "Blade Runner", kind: :movie, search_text: "blade runner scifi", rating: 8.1}
    metadata = %Media{id: "2", title: "Cyberpunk Collection", kind: :movie, search_text: "includes blade runner", rating: 9.0}
    assert [^exact, ^metadata] = Search.run([metadata, exact], "Blade Runner")
  end

  test "kind filtering is explicit" do
    movie = %Media{id: "1", title: "Dark", kind: :movie, search_text: "dark"}
    series = %Media{id: "2", title: "Dark", kind: :series, search_text: "dark"}
    assert [^series] = Search.run([movie, series], "dark", kind: :series)
  end
end
