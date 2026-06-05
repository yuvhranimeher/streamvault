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
- `GET /api/movies?page=&limit=&q=` with Node-compatible zero-based page/limit fallback semantics
- `GET /api/series?page=&limit=&q=` with Node-compatible default array and paged envelope shapes
- `GET /api/section/:key?page=&limit=` for the validated section allow-list, with Node-compatible zero-based page/limit semantics
- `GET /api/home-feed?limit=` with Node-compatible row limit clamping
- `GET /api/channels`
- `GET /api/details/:type/:id` for `detail-cache.json` hits, with safe Node proxy on cache miss
- `GET /api/title-details?title=&type=&year=&tmdbId=` for safe `detail-cache.json` hits, with safe Node proxy on cache miss
- `GET /api/episode-titles?show=&season=` for safe `episode-title-cache.json` hits, with safe Node proxy on cache miss
- `GET /__haskell-details-shadow-debug?type=&id=&title=&year=` details shadow diagnostic
- `GET /__haskell-title-details-debug?title=&type=&year=` metadata diagnostic
- `GET /__haskell-episode-titles-debug?show=&season=` metadata diagnostic
- `GET /__haskell-search-debug?q=` diagnostic native search
- `GET /api/search?q=` only when `STREAMVAULT_HASKELL_SEARCH_NATIVE=1`, with a 1500 ms fallback to Node

Native catalog loading is lazy. Health routes, dashboard ping, version, and history reads do not load the catalog.

Validated native section keys include:

- `netflix`
- `marvel`
- `dc`
- `allMovies`
- `all-movies`
- `topRated`
- `top-rated`
- `anime`
- `koreanDrama`
- `horrorNights`
- `cyberpunkScifi`
- `trending`
- `new`
- `series`

The Node shadow gate allow-list includes the complete home row key set and requires `X-StreamVault-Haskell: native-section`. Unknown section keys stay on Node fallback.

## Proxied To Node

Everything not listed as native is proxied to Node, including:

- Static frontend and `public`
- Service worker
- Dashboard stats and any future non-ping dashboard routes
- `GET /api/search` by default
- Unvalidated or unknown `/api/section/:key` values
- `/api/series/detail`, `/api/movies/keywords`, `/api/trending`, and catalog stats/helper APIs
- TMDB lookup/helper cache misses from `/api/title-details` and `/api/episode-titles`
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
- Catalog parameter routes are native only for the safe read-only shapes above. `/api/movies`, `/api/series`, `/api/section/:key`, and `/api/home-feed` preserve Node response shapes, page bases, limit fallback behavior, and section-key fallback behavior. `allMovies` and `topRated` are canonical section keys; `all-movies` and `top-rated` are compatibility keys tested against current Node semantics.
- Details cache misses now use the Haskell shadow adapter: Haskell first attempts a native `detail-cache.json` hit, then proxies misses to Node with `x-streamvault-shadow-bypass: 1` and `x-streamvault-details-shadow: 1`. Haskell never calls TMDB and does not mutate detail caches. Node skips detail-cache writes only for those tagged shadow read-only requests; normal Node primary details requests keep their existing behavior.
- Metadata cache misses now use the Haskell shadow adapter: Haskell first attempts native cache hits from `detail-cache.json` for `/api/title-details` and `episode-title-cache.json` for `/api/episode-titles`, then proxies misses to Node with `x-streamvault-shadow-bypass: 1` and `x-streamvault-metadata-shadow: 1`. Haskell never calls TMDB and does not mutate metadata caches. Node skips metadata cache writes only for those tagged shadow read-only requests; normal Node primary metadata requests keep existing behavior.
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
- `/api/movies?page=0&limit=12`
- `/api/movies?page=1&limit=12`
- `/api/movies?page=0&limit=24`
- `/api/movies?page=1&limit=100`
- `/api/series?page=0&limit=12`
- `/api/series?page=1&limit=12`
- `/api/series?page=0&limit=24`
- `/api/series?page=1&limit=100`
- `/api/section/allMovies?page=0&limit=12`
- `/api/section/all-movies?page=0&limit=12`
- `/api/section/topRated?page=0&limit=12`
- `/api/section/top-rated?page=0&limit=12`
- `/api/section/anime?page=0&limit=12`
- `/api/section/koreanDrama?page=0&limit=12`
- `/api/section/horrorNights?page=0&limit=12`
- `/api/section/cyberpunkScifi?page=0&limit=12`
- `/api/section/trending?page=0&limit=12`
- `/api/section/new?page=0&limit=12`
- `/api/section/series?page=0&limit=12`
- `/api/home-feed?limit=12`
- `/api/home-feed?limit=24`
- `/api/details/movie/Greenland%202-Migration?title=Greenland%202-Migration&year=2026`
- `/api/details/movie/The%20Strangers-Chapter%203?title=The%20Strangers-Chapter%203&year=2026`
- `/api/details/tv/A%20Knight%20of%20the%20Seven%20Kingdoms?title=A%20Knight%20of%20the%20Seven%20Kingdoms&year=2026`
- `/__haskell-details-shadow-debug?type=movie&id=Greenland%202-Migration&title=Greenland%202-Migration&year=2026`
- `/api/title-details?type=movie&title=<cache-hit-title>&year=<cache-hit-year>`
- `/api/title-details?type=movie&title=StreamVaultMetadataMissFixtureNoSuchTitle&year=2099`
- `/api/episode-titles?show=<cache-hit-show>&season=<cache-hit-season>`
- `/api/episode-titles?show=StreamVaultMetadataMissFixtureNoSuchShow&season=99`

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

The details cache-hit rows are Haskell-only because the current Node `/api/details/:type/:id` handler bypasses disk `detail-cache.json` and may call TMDB. They cover title-only, title-plus-year, `tmdbId`, full cache-key-as-id, and punctuation-normalized title lookups. Playback, FFmpeg, HLS, stream URLs, poster cache mutation, and heavy/random TMDB routes are not tested automatically.

Details cache-miss rows compare Node as source of truth against Haskell's proxied response. Both Node and Haskell requests carry the read-only details shadow header so the test does not mutate `detail-cache.json`. Haskell must return `X-StreamVault-Haskell-Details: proxy-cache-miss` for these rows.
