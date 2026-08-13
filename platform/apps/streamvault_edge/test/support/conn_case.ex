defmodule StreamVault.Edge.ConnCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      @endpoint StreamVault.Edge.Endpoint
      import Plug.Conn
      import Phoenix.ConnTest
    end
  end

  setup _tags do
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end
end
