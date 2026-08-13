defmodule StreamVault.Edge.ConnCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      @endpoint StreamVault.Edge.Endpoint
      use Phoenix.ConnTest
      import Plug.Conn
    end
  end
end
