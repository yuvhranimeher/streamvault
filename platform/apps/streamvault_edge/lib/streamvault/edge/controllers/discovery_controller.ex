defmodule StreamVault.Edge.Controllers.DiscoveryController do
  use StreamVault.Edge, :controller

  alias StreamVault.Catalog
  alias StreamVault.Core.{Media, Page}
  alias StreamVault.Edge.Controllers.Response

  def search(conn, params) do
    query = params |> Map.get("q", "") |> String.trim()
    kind = parse_kind(params["kind"] || params["type"])

    if String.length(query) < 2 do
      Response.ok(conn, %{items: [], total: 0, page: 1, pages: 0, instant: true, indexed: true})
    else
      page = Catalog.search(query, kind: kind) |> Page.from_list(params, origin: 1, default_limit: 72)

      Response.ok(conn, %{
        items: Enum.map(page.items, &Media.to_legacy_map/1),
        total: page.total,
        page: page.page,
        pages: page.pages,
        instant: true,
        indexed: true
      }, max_age: 10)
    end
  end

  def section(conn, %{"key" => key} = params) do
    page = Catalog.section(key) |> Page.from_list(params, origin: 0, default_limit: 24)

    Response.ok(conn, %{
      key: key,
      items: Enum.map(page.items, &Media.to_legacy_map/1),
      total: page.total,
      page: page.page,
      pages: page.pages
    }, max_age: 60)
  end

  def home_feed(conn, params) do
    limit = params |> Map.get("limit", "18") |> bounded_integer(18, 6, 50)
    feed = Catalog.home_feed(limit)

    payload = %{
      ok: true,
      hero: Enum.map(feed.hero, &Media.to_legacy_map/1),
      rows:
        Enum.map(feed.rows, fn row ->
          %{rowId: row.rowId, sectionKey: row.sectionKey, title: row.title, items: Enum.map(row.items, &Media.to_legacy_map/1)}
        end)
    }

    Response.ok(conn, payload, max_age: 60)
  end

  defp parse_kind(value) when value in ["movie", "movies"], do: :movie
  defp parse_kind(value) when value in ["series", "tv", "show", "shows"], do: :series
  defp parse_kind(_), do: :mixed

  defp bounded_integer(value, default, minimum, maximum) do
    parsed = case Integer.parse(to_string(value)) do
      {number, _} -> number
      :error -> default
    end

    parsed |> max(minimum) |> min(maximum)
  end
end
