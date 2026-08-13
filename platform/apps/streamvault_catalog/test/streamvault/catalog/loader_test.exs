defmodule StreamVault.Catalog.LoaderTest do
  use ExUnit.Case, async: true

  alias StreamVault.Catalog.Loader

  test "loads both catalog kinds" do
    path = Path.expand("../../fixtures/catalog.json", __DIR__)
    assert {:ok, items, metadata} = Loader.load(path)
    assert metadata.movies == 2
    assert metadata.series == 1
    assert Enum.count(items, &(&1.kind == :series)) == 1
  end
end
