import Config

config :streamvault_edge, StreamVault.Edge.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 4000],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: String.duplicate("dev-only-streamvault-secret-", 3)

config :logger, level: :debug
