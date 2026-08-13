defmodule StreamVault.Edge.Endpoint do
  use Phoenix.Endpoint, otp_app: :streamvault_edge

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]
  plug Plug.Head
  plug Plug.Parsers, parsers: [:urlencoded, :json], pass: ["application/json"], json_decoder: Phoenix.json_library()
  plug StreamVault.Edge.Router
end
