import Config

if config_env() == :prod do
  port = String.to_integer(System.get_env("PORT", "4000"))

  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "SECRET_KEY_BASE must be set in production"

  config :streamvault_edge, StreamVault.Edge.Endpoint,
    http: [ip: {0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base,
    url: [host: System.get_env("HOST", "localhost"), port: 443, scheme: "https"]

  config :streamvault_catalog,
    catalog_path: System.get_env("CATALOG_PATH", "/data/catalog.json"),
    home_feed_path: System.get_env("HOME_FEED_PATH", "/data/home-feed.json")

  config :streamvault_playback,
    planner_url: System.get_env("PLANNER_URL", "http://media-planner:4100")

  config :streamvault_edge,
    legacy_origin: System.get_env("LEGACY_ORIGIN", "http://legacy:3000"),
    shadow_enabled: System.get_env("SHADOW_ENABLED", "false") in ["1", "true", "TRUE"]
end
