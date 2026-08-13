defmodule StreamVault.Edge.CatalogControllerTest do
  use StreamVault.Edge.ConnCase, async: false

  test "returns a legacy-compatible movie page", %{conn: conn} do
    response = conn |> get("/api/movies?limit=1") |> json_response(200)
    assert response["total"] == 2
    assert [%{"name" => _, "streamUrl" => _}] = response["movies"]
  end

  test "search is indexed and one-based", %{conn: conn} do
    response = conn |> get("/api/search?q=arrival") |> json_response(200)
    assert response["indexed"]
    assert response["page"] == 1
    assert [%{"title" => "Arrival"}] = response["items"]
  end

  test "reports readiness after the fixture catalog loads", %{conn: conn} do
    assert %{"ok" => true} = conn |> get("/ready") |> json_response(200)
  end
end
