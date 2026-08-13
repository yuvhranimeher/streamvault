import Config

config :streamvault_edge, StreamVault.Edge.Endpoint,
  cache_static_manifest: nil,
  server: true

config :logger, level: :info
