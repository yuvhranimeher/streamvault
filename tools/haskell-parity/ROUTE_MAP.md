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
- `GET /download/:id` as a 302 redirect only for known software catalog entries
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
- Unknown `GET /download/:id` ids
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

## Known Parity Gaps And Decisions

- `/api/search` remains proxied because Node search builds a large index from local, FTP, and `scan-output/clean-catalog.json` sources, hydrates massive-catalog poster metadata, applies fuzzy token matching, caps no-poster massive results, and caches scored results. A simpler native search would reduce or reorder results.
- Details cache misses remain proxied because Node may call TMDB, build extended details, and update `detail-cache.json`. Haskell only serves known extended cache hits and never calls TMDB.
- Playback, FFmpeg, HLS, poster-cache, live playback, service worker, and frontend/static routes remain untouched because they involve streaming side effects, cache mutation, browser behavior, or file/process lifecycles outside this safe read-only catalog slice.
- `GET /api/live/test/:id` is not implemented in the current Node server. Live playlist and segment routes are playback routes and remain proxied.

## Parity Endpoint Set

The parity harness compares these safe Node-vs-Haskell endpoints:

- `/__haskell-health`
- `/api/health`
- `/api/downloads?page=1&limit=40`
- `/api/movies?page=1&limit=40`
- `/api/series?page=1&limit=40`
- `/api/home-feed`
- `/api/search?q=iron%20man`
- `/api/search?q=oblivion`
- `/api/search?q=oblibion`
- `/api/channels`
- `/api/section/marvel?page=1&limit=20`
- `/api/section/dc?page=1&limit=20`
- `/api/section/netflix?page=1&limit=20`

The harness also performs Haskell-only native cache-hit checks for:

- `/api/details/movie/Man%20of%20Steel?title=Man%20of%20Steel&year=2013`
- `/api/details/tv/76479?title=The%20Boys&year=2019&tmdbId=76479`

The details rows are Haskell-only because the current Node `/api/details/:type/:id` handler bypasses disk `detail-cache.json` and may call TMDB. Playback, FFmpeg, HLS, stream URLs, poster cache mutation, and heavy/random TMDB routes are not tested automatically.
