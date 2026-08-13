defmodule StreamVault.Edge.ErrorJSON do
  @moduledoc false

  def render(template, assigns) do
    status = Phoenix.Controller.status_message_from_template(template)

    %{
      error: %{
        code: template |> String.replace(".json", "") |> String.replace(" ", "_"),
        message: status,
        request_id: assigns[:conn] && List.first(Plug.Conn.get_resp_header(assigns.conn, "x-request-id"))
      }
    }
  end
end
