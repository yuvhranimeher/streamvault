# Details Cache-Miss Shadow Notes

Node on port 3000 remains primary. Haskell on port 3031 remains shadow/test only.

## Audited Files

- `server.js`
- `public/app.js`
- `public/details.js`
- `detail-cache.json`
- `episode-title-cache.json`
- `poster-cache.json`
- `app/CatalogApi.hs`
- `app/Main.hs`

## Details Endpoints

- `GET /api/details/:type/:id`
  - Main frontend details route.
  - `:type` accepts `movie`, `tv`, `series`, or `show`; Node and Haskell normalize `series`/`show` to `tv`.
  - Frontend calls it from `fetchTitleDetails()` with `title`, `year`, and sometimes `tmdbId`.
- `GET /api/details/debug`
  - Node-only diagnostic route that checks TMDB token availability and catalog/cache counts.
- `POST /api/details/cache/clear`
  - Node-only mutation route. It clears the in-memory title details cache and deletes `detail-cache.json`.
  - Haskell must never handle this natively.
- `GET /api/title-details?type=&id=&title=&name=&year=&tmdbId=`
  - Node TMDB title-details helper with a shorter timeout and in-memory cache.
  - Not part of the safe Haskell details native route.
- `GET /api/episode-titles?show=&season=`
  - Node TMDB season episode-title helper backed by `episode-title-cache.json`.
  - It can mutate `episode-title-cache.json`; Haskell must keep it proxied.
- `GET /api/series/detail?name=`
  - Frontend series expansion route used by `public/details.js`; not part of this adapter.

## Query Parameters

`/api/details/:type/:id` expects:

- `title` or `name`: display/search title. The frontend sends a cleaned display title.
- `year`: optional four-digit year.
- `tmdbId`: optional numeric TMDB id. For TV, route ids may also look like `tmdb_tv_123`; for movies, `tmdb_123`.

The route id is usually `item.tmdbId`, `item.id`, or the cleaned title. Haskell mirrors this by checking query `tmdbId`, TMDB-prefixed ids, raw ids, local item ids, and normalized titles.

## Response Shape

Movie and TV details both return a JSON object with:

- `ok`
- `localOnly`
- `type`
- `id`
- `tmdbId`
- `imdbId`
- `title`
- `overview`
- `poster`
- `backdrop`
- `year`
- `rating`
- `runtime`
- `genres`/`genre`
- `language`
- `ratings`
- `trailers`
- `cast`
- `crew`
- `productionCompanies`
- `similar`
- `moreByDirector`
- `director`
- `about`
- `playbackInfo`

Movies return `episodes: []`. TV returns `episodes` from local seasons when available; Node uses the local `seasons` object and Haskell mirrors that as an object.

Optional arrays may be empty. Shape validation should warn only in debug/diagnostic paths when present fields have the wrong type; it must not block frontend rendering when optional fields are missing.

## Cache Keys

Node builds the main details key as:

```text
${mediaType}:${tmdbId || normalizedTitle.title || item.name || req.params.id}:${normalizedTitle.year || item.year || ''}
```

Examples in `detail-cache.json` include:

- `movie:Man of Steel:2013`
- `tv:76479:2019`
- `movie:The Dark Knight:2008`
- `movie:Pirates of the Caribbean-Dead Men Tell No Tales:2017`

Haskell cache-hit lookup accepts:

- exact media/id/year keys
- media/title/year keys
- media/id or media/title keys
- direct keys if present in `detail-cache.json`
- `__series__...` and `__tmdb_id__...` prefixed forms
- loose normalized title/year matches for existing detail-cache keys

Haskell only treats a cache entry as a safe native hit when it has extended detail arrays such as `trailers`, `cast`, `crew`, `productionCompanies`, `similar`, or `moreByDirector`.

## Node Cache-Miss Behavior

For `/api/details/:type/:id`, Node:

1. Builds a local details object from catalog/local lists.
2. Checks in-memory `titleDetailsCache`.
3. Currently bypasses disk reads with `skipDiskCache = true`.
4. On miss, calls TMDB through `buildTmdbExtendedDetails()` with a 15000 ms timeout.
5. Merges local data with fresh TMDB data and normally stores it in memory and `detail-cache.json`.
6. Falls back to local-only details when TMDB is empty or fails.

For Haskell shadow miss-proxy requests, Haskell sends:

- `x-streamvault-shadow-bypass: 1`
- `x-streamvault-shadow-origin: haskell-details-cache-miss`
- `x-streamvault-details-shadow: 1`

Node uses `x-streamvault-details-shadow: 1` to skip memory/disk detail-cache writes for that shadow read-only request. Normal Node primary requests keep their existing cache behavior.

## TMDB And Trailer Behavior

`buildTmdbExtendedDetails()` may:

- search TMDB when no TMDB id is supplied
- fetch base details, credits, videos, external ids, similar, recommendations, and ratings metadata
- map YouTube TMDB videos into `trailers`
- call YouTube Data API fallback when no TMDB trailers are found and `YOUTUBE_API_KEY` is configured
- build `cast`, filtered `crew`, production companies, similar media cards, director/creator bundles, and about metadata

Haskell must not call TMDB or YouTube directly in this slice. Cache misses stay proxied to Node.

## Cast, Crew, Seasons, Episodes

- `cast` maps TMDB cast people with `id`, `name`, `role`, and `image`.
- `crew` includes directors, creators, producers, writers, screenplay, and showrunner roles.
- TV created-by people are merged into crew as `Creator`.
- Local TV episodes are preserved from catalog/local `seasons`.
- `/api/episode-titles` is a separate Node route that can mutate `episode-title-cache.json`; it remains proxied.

## `localOnly`

- Local fallback details use `localOnly: true`.
- Memory/disk/fresh extended details are merged with local data and use `localOnly: false`.
- Haskell native cache hits preserve the existing cache-hit behavior and force `localOnly: false` after merging local and cached data.
- Haskell cache misses preserve Node's body exactly, including Node's `localOnly` value.

## Error Shape

Node `/api/details/:type/:id` usually falls back to a local JSON object rather than returning an error. Haskell proxy failures return JSON:

```json
{
  "ok": false,
  "error": "UPSTREAM_NODE_UNAVAILABLE",
  "message": "..."
}
```

with `X-StreamVault-Haskell: proxy-cache-miss-error` and `X-StreamVault-Haskell-Details: proxy-cache-miss-error`.

## Safe Native vs Proxied

Safe native:

- Haskell detail-cache hits from `detail-cache.json`
- local catalog merge used for cache-hit responses
- `GET /__haskell-details-shadow-debug` summaries
- cache-miss shape validation/logging

Must stay proxied:

- TMDB lookup/search/fresh detail construction
- YouTube trailer fallback
- `/api/title-details`
- `/api/episode-titles`
- details cache clear mutation
- series expansion route
- all playback, live, FFmpeg, HLS, poster-cache, service worker, and frontend/static behavior

## New Shadow Adapter Contract

For `GET /api/details/:type/:id`:

1. Haskell first attempts native cache-hit lookup.
2. Cache hit returns the existing native Haskell response with `X-StreamVault-Haskell: native-details-cache`.
3. Cache miss proxies to `STREAMVAULT_NODE` with Node shadow bypass and details read-only headers.
4. The proxied response status and JSON body are preserved.
5. Haskell adds `X-StreamVault-Haskell: proxy-cache-miss` and `X-StreamVault-Haskell-Details: proxy-cache-miss`.
6. Haskell validates and summarizes the shape for debug/logging only.
7. `STREAMVAULT_HASKELL_DETAILS_SHADOW_COMPARE=1` records compact in-memory/log summaries only.
