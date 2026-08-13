import Config

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :trace_id, :media_id]

config :streamvault_catalog,
  catalog_path: Path.expand("../../catalog.json", __DIR__),
  home_feed_path: Path.expand("../../home-feed.json", __DIR__),
  reload_interval_ms: :timer.minutes(15),
  max_results: 120

config :streamvault_playback,
  planner_url: "http://127.0.0.1:4100",
  request_timeout_ms: 2_000,
  session_ttl_ms: :timer.minutes(30),
  sweep_interval_ms: :timer.minutes(1)

config :streamvault_edge,
  ecto_repos: [],
  generators: [binary_id: true],
  legacy_origin: "http://127.0.0.1:3000",
  shadow_enabled: false

config :streamvault_edge, StreamVault.Edge.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [formats: [json: StreamVault.Edge.ErrorJSON], layout: false],
  pubsub_server: StreamVault.Edge.PubSub,
  live_view: [signing_salt: "streamvault-api-only"]

import_config "#{config_env()}.exs"
