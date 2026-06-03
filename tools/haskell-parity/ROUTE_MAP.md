# StreamVault Haskell Shadow Route Map

This map is for the Haskell shadow backend only. Node on port 3000 remains primary.

## Runtime

- Node primary: `http://127.0.0.1:3000`
- Haskell shadow: `http://127.0.0.1:3031`
- Current Haskell server mode: blocking raw socket gateway
- Warp diagnostic: a minimal Warp health helper binds on Windows/GHC 9.6.7 but does not dispatch requests to the WAI handler, so the production shadow executable uses the response-capable raw gateway.

## Native Haskell Routes

These routes are safe, read-only, and backed by existing catalog/cache files:

- `GET /__haskell-health`
- `GET /api/health`
- `GET /api/downloads?page=&limit=&q=`
- `GET /api/movies?page=&limit=&q=`
- `GET /api/series?page=&limit=&q=`
- `GET /api/section/:key?page=&limit=`
- `GET /api/home-feed?limit=`
- `GET /api/channels`
- `GET /api/details/:type/:id` for `detail-cache.json` hits only

Native catalog loading is lazy. Health routes do not load the catalog.

## Proxied To Node

Everything not listed as native is proxied to Node, including:

- Static frontend and `public`
- Service worker
- Dashboard routes
- `GET /api/search`
- Details cache misses and TMDB lookup routes
- History/progress routes
- Media info, duration, qualities, subtitles
- Download redirect route `GET /download/:id`
- Poster cache routes
- Trending/catalog stats/keyword helpers

## Intentionally Untouched

The Haskell shadow migration must not change these Node routes or frontend behavior:

- Playback and direct stream routes
- Mobile HLS routes
- FFmpeg/HLS session routes
- FTP stream/proxy/raw media routes
- Live playback playlists and segments
- Poster cache behavior
- Service worker behavior
- Frontend UI/design files

## Parity Endpoint Set

The parity harness compares these safe endpoints:

- `/__haskell-health`
- `/api/health`
- `/api/downloads?page=1&limit=40`
- `/api/movies?page=1&limit=40`
- `/api/series?page=1&limit=40`
- `/api/home-feed`
- `/api/search?q=iron%20man`
- `/api/search?q=oblivion`
- `/api/channels`

Playback, FFmpeg, HLS, stream URLs, poster cache mutation, and heavy/random TMDB routes are not tested automatically.

Details cache hits are validated with direct Haskell smoke checks. They are not included in Node-vs-Haskell parity because the current Node `/api/details/:type/:id` handler bypasses `detail-cache.json` and may call TMDB.

Optional section checks for `marvel`, `dc`, and `netflix` are deferred: the current Haskell section totals/order differ from Node, so adding them would expose pre-existing section parity gaps outside this migration slice.
