defmodule StreamVault.Edge do
  @moduledoc false

  def controller do
    quote do
      use Phoenix.Controller, formats: [:json]
      import Plug.Conn
    end
  end

  def router do
    quote do
      use Phoenix.Router
      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: StreamVault.Edge.Endpoint,
        router: StreamVault.Edge.Router,
        statics: []
    end
  end

  defmacro __using__(which) when is_atom(which), do: apply(__MODULE__, which, [])
end
