defmodule StreamVault.Edge.Controllers.AdminController do
  use StreamVault.Edge, :controller

  alias StreamVault.Catalog
  alias StreamVault.Edge.Controllers.Response

  def reload_catalog(conn, _params) do
    if authorized?(conn) do
      case Catalog.reload() do
        {:ok, metadata} -> Response.ok(conn, %{ok: true, catalog: metadata})
        {:error, reason} -> Response.error(conn, 500, "catalog_reload_failed", "Catalog reload failed", %{reason: inspect(reason)})
      end
    else
      Response.error(conn, 401, "unauthorized", "A valid x-admin-key header is required")
    end
  end

  defp authorized?(conn) do
    configured = System.get_env("ADMIN_KEY")
    supplied = get_req_header(conn, "x-admin-key") |> List.first()
    is_nil(configured) or (is_binary(supplied) and Plug.Crypto.secure_compare(configured, supplied))
  end
end
