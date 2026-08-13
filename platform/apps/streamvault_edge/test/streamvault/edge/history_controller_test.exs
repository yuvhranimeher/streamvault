defmodule StreamVault.Edge.HistoryControllerTest do
  use StreamVault.Edge.ConnCase, async: false

  test "history is isolated by client id", %{conn: conn} do
    first = put_req_header(conn, "x-client-id", "first")
    second = put_req_header(recycle(conn), "x-client-id", "second")

    assert %{"ok" => true} =
             first |> post("/api/history", %{id: "arrival", progress: 0.25}) |> json_response(200)

    assert %{"arrival" => %{"progress" => 0.25}} =
             first |> get("/api/history") |> json_response(200)

    assert %{} = second |> get("/api/history") |> json_response(200)
  end

  test "rejects progress outside the normalized range", %{conn: conn} do
    response = conn |> post("/api/history", %{id: "arrival", progress: 5}) |> json_response(400)
    assert response["error"]["code"] == "invalid_progress"
  end
end
