defmodule StreamVault.Edge.Router do
  use StreamVault.Edge, :router

  pipeline :api do
    plug(:accepts, ["json"])
    plug(StreamVault.Edge.Plugs.CORS)
    plug(StreamVault.Edge.Plugs.RequestContext)
    plug(StreamVault.Edge.Plugs.RateLimit)
    plug(StreamVault.Edge.Plugs.Shadow)
  end

  scope "/", StreamVault.Edge.Controllers do
    pipe_through(:api)

    get("/health", HealthController, :show)
    get("/ready", HealthController, :ready)
    get("/metrics", HealthController, :metrics)
    get("/api/version", HealthController, :version)
    get("/api/catalog-stats", CatalogController, :stats)
    get("/api/movies", CatalogController, :movies)
    get("/api/series", CatalogController, :series)
    get("/api/media/:id", CatalogController, :show)
    get("/api/search", DiscoveryController, :search)
    get("/api/section/:key", DiscoveryController, :section)
    get("/api/home-feed", DiscoveryController, :home_feed)
    get("/api/history", HistoryController, :index)
    post("/api/history", HistoryController, :create)
    delete("/api/history/:id", HistoryController, :delete)
    post("/api/playback/plan/:id", PlaybackController, :plan)
    patch("/api/playback/sessions/:id", PlaybackController, :touch)
    delete("/api/playback/sessions/:id", PlaybackController, :close)
    get("/api/playback/sessions", PlaybackController, :index)
    post("/api/admin/catalog/reload", AdminController, :reload_catalog)
  end
end
