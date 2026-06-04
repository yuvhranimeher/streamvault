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
- `GET /api/dashboard/ping`
- `GET /api/history`
- `GET /api/version`
- `GET /api/downloads?page=&limit=&q=`
- `GET /download/:id` as a 302 redirect only for known software catalog entries
- `GET /api/movies?page=&limit=&q=`
- `GET /api/series?page=&limit=&q=`
- `GET /api/section/:key?page=&limit=`
- `GET /api/home-feed?limit=`
- `GET /api/channels`
- `GET /api/details/:type/:id` for `detail-cache.json` hits only
- `GET /__haskell-search-debug?q=` diagnostic native search
- `GET /api/search?q=` only when `STREAMVAULT_HASKELL_SEARCH_NATIVE=1`, with a 1500 ms fallback to Node

Native catalog loading is lazy. Health routes, dashboard ping, version, and history reads do not load the catalog.

## Proxied To Node

Everything not listed as native is proxied to Node, including:

- Static frontend and `public`
- Service worker
- Dashboard stats and any future non-ping dashboard routes
- `GET /api/search` by default
- Details cache misses and TMDB lookup routes
- History/progress write routes
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

- `/api/search` remains proxied by default. Native Haskell search is exposed at `/__haskell-search-debug?q=` and can be attempted on `/api/search` only with `STREAMVAULT_HASKELL_SEARCH_NATIVE=1`, because expanded parity still shows serious count/poster-presence drift on several target queries.
- Details cache misses remain proxied because Node may call TMDB, build extended details, and update `detail-cache.json`. Haskell only serves known extended cache hits and never calls TMDB.
- `/api/dashboard/ping`, `GET /api/history`, and `/api/version` are native in the shadow path only. Node remains primary and falls back to its original handlers when the shadow request fails, times out, returns the wrong status, or lacks the expected native marker.
- `/api/dashboard/stats` remains proxied because `tracker.getStats()` purges stale sessions during the read and depends on Node-only in-memory sessions, stream state, perf samples, and error logs.
- History writes remain proxied. No dedicated server-side read-only `/api/progress` endpoint was found; frontend progress is primarily stored in browser `localStorage`.
- Media-info, duration, and subtitle routes remain proxied because they can trigger ffprobe/FFmpeg, directory/file subtitle reads, or playback-adjacent behavior.
- Playback, FFmpeg, HLS, poster-cache, live playback, service worker, and frontend/static routes remain untouched because they involve streaming side effects, cache mutation, browser behavior, or file/process lifecycles outside this safe read-only catalog slice.
- `GET /api/live/test/:id` is not implemented in the current Node server. Live playlist and segment routes are playback routes and remain proxied.

## Parity Endpoint Set

The parity harness compares these safe Node-vs-Haskell endpoints. Search rows use Node `/api/search` against Haskell `/__haskell-search-debug` so the report measures native search instead of proxy behavior:

- `/__haskell-health`
- `/api/health`
- `/api/dashboard/ping`
- `/api/version`
- `/api/history`
- `/api/downloads?page=1&limit=40`
- `/api/movies?page=1&limit=40`
- `/api/series?page=1&limit=40`
- `/api/home-feed`
- `/api/search?q=iron%20man`
- `/api/search?q=oblivion`
- `/api/search?q=oblibion`
- `/api/search?q=the%20boys`
- `/api/search?q=extraction`
- `/api/search?q=pirates%20caribbean`
- `/api/search?q=spider%20man`
- `/api/search?q=dark%20knight`
- `/api/search?q=breaking%20bad`
- `/api/search?q=game%20of%20thrones`
- `/api/channels`
- `/api/section/marvel?page=1&limit=20`
- `/api/section/dc?page=1&limit=20`
- `/api/section/netflix?page=1&limit=20`

The harness also performs Haskell-only native cache-hit checks for:

- `/api/details/movie/Man%20of%20Steel?title=Man%20of%20Steel&year=2013`
- `/api/details/movie/Man%20of%20Steel?title=Man%20of%20Steel`
- `/api/details/movie/movie%3AMan%20of%20Steel%3A2013?title=Man%20of%20Steel&year=2013`
- `/api/details/tv/76479?title=The%20Boys&year=2019&tmdbId=76479`
- `/api/details/movie/Pirates%20of%20the%20Caribbean-Dead%20Men%20Tell%20No%20Tales?title=Pirates%20of%20the%20Caribbean-Dead%20Men%20Tell%20No%20Tales&year=2017`
- `/api/details/movie/Pirates%20of%20the%20Caribbean%3A%20Dead%20Men%20Tell%20No%20Tales?title=Pirates%20of%20the%20Caribbean%3A%20Dead%20Men%20Tell%20No%20Tales&year=2017`
- `/api/details/movie/Extraction?title=Extraction&year=2020`
- `/api/details/movie/The%20Dark%20Knight?title=The%20Dark%20Knight&year=2008`

`Game of Thrones` is not currently present as an extended `detail-cache.json` hit, so it is documented but not added as a failing fixture.

The details rows are Haskell-only because the current Node `/api/details/:type/:id` handler bypasses disk `detail-cache.json` and may call TMDB. They cover title-only, title-plus-year, `tmdbId`, full cache-key-as-id, and punctuation-normalized title lookups. Playback, FFmpeg, HLS, stream URLs, poster cache mutation, and heavy/random TMDB routes are not tested automatically.
