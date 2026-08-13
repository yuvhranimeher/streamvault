defmodule StreamVault.Core.PageTest do
  use ExUnit.Case, async: true

  alias StreamVault.Core.Page

  test "bounds page sizes and calculates totals" do
    page = Page.from_list(Enum.to_list(1..250), %{"page" => "2", "limit" => "999"})
    assert page.limit == 120
    assert page.items == Enum.to_list(121..240)
    assert page.pages == 3
  end
end
