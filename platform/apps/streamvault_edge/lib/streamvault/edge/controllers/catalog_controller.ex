defmodule StreamVault.Edge.Controllers.CatalogController do
  use StreamVault.Edge, :controller

  alias StreamVault.Catalog
  alias StreamVault.Core.{Media, Page}
  alias StreamVault.Edge.Controllers.Response

  def stats(conn, _params) do
    metadata = Catalog.stats()

    Response.ok(
      conn,
      %{
        ok: metadata[:status] == :ready,
        homepageUntouched: true,
        existingMovies: metadata[:movies] || 0,
        existingSeries: metadata[:series] || 0,
        massiveMovies: 0,
        massiveSeries: 0,
        massiveTotal: metadata[:total] || 0,
        generation: metadata[:generation],
        loadedAt: metadata[:loaded_at],
        loadDurationMs: metadata[:duration_ms]
      },
      max_age: 30
    )
  end

  def movies(conn, params), do: paged_kind(conn, params, :movie, "movies")
  def series(conn, params), do: paged_kind(conn, params, :series, "series")

  def show(conn, %{"id" => id}) do
    case Catalog.get(id) do
      {:ok, media} -> Response.ok(conn, Media.to_legacy_map(media), max_age: 60)
      :error -> Response.error(conn, 404, "media_not_found", "No catalog item matches that id")
    end
  end

  defp paged_kind(conn, params, kind, response_key) do
    query = params |> Map.get("q", "") |> String.trim()

    items =
      if String.length(query) >= 2,
        do: Catalog.search(query, kind: kind),
        else: Catalog.list(kind)

    page = Page.from_list(items, params, origin: 0, default_limit: 48)

    payload = %{
      response_key => Enum.map(page.items, &Media.to_legacy_map/1),
      "total" => page.total,
      "page" => page.page,
      "pages" => page.pages
    }

    Response.ok(conn, payload, max_age: if(query == "", do: 60, else: 10))
  end
end
