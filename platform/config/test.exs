import Config

config :streamvault_catalog,
  catalog_path: Path.expand("../apps/streamvault_catalog/test/fixtures/catalog.json", __DIR__),
  reload_interval_ms: :infinity

config :streamvault_edge, StreamVault.Edge.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: String.duplicate("test-streamvault-secret-", 4),
  server: false

config :logger, level: :warning
