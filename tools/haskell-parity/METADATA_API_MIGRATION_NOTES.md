# StreamVault Metadata API Migration Notes

Node remains primary on port 3000. Haskell remains a shadow/test backend on port 3031.

This slice covers only read-only metadata behavior. Playback, direct streams, live TV playback, FFmpeg/HLS, subtitles, poster-cache behavior, service worker behavior, and frontend UI are intentionally out of scope.

## Audited Endpoints

### `GET /api/title-details`

- Query params: `title` or `name`, optional `year`, optional `type` or `mediaType`, optional `id`, optional `tmdbId`.
- Node response shape: JSON object with `ok`, `type`, `title`, `ratings`, `trailers`, `cast`, `crew`, `productionCompanies`, `similar`, `moreByDirector`, `director`, `about`, and `playbackInfo`. Miss/fallback responses use the same object shape with empty arrays and `ok: false`.
- Node data source: in-memory `titleDetailsCache`; on miss, TMDB/OMDB helpers through `buildTitleDetails`.
- Disk cache relation: Haskell can safely read existing `detail-cache.json` extended-detail entries. Node's `/api/title-details` route itself does not use `detail-cache.json` as its primary cache.
- Cache hit/miss behavior: Haskell serves native only when `detail-cache.json` has a safe extended detail hit. Haskell proxies cache misses to Node.
- File mutation: Haskell does not mutate files. Node primary may write in-memory title detail cache; shadow proxy requests carry `x-streamvault-metadata-shadow: 1`, so the guarded Node handler does not write metadata cache state for Haskell misses.
- External calls: Node may call TMDB/OMDB on misses. Haskell does not call TMDB/OMDB directly.
- FFmpeg/playback use: none in this route. The `playbackInfo` field is preserved as response data only.
- Decision: native cache hit plus Node proxy on miss.
- Markers: `X-StreamVault-Haskell-Metadata: native-title-details-cache` or `proxy-title-details-miss`.
- Diagnostic: `GET /__haskell-title-details-debug?title=...&type=...&year=...`.

### `GET /api/episode-titles`

- Query params: required `show`, required `season`.
- Node response shape: JSON array of episode objects with `episode`, `title`, `overview`, `thumb`, `rating`, and `airDate`; failures and misses return an empty array.
- Node data source: `episode-title-cache.json`; on miss, TMDB search plus season lookup.
- Cache hit/miss behavior: Haskell serves native only when `episode-title-cache.json` has the cleaned `show__Sseason` array. Haskell proxies misses to Node.
- File mutation: Haskell does not mutate files. Node primary may write `episode-title-cache.json`; shadow proxy requests carry `x-streamvault-metadata-shadow: 1`, so the guarded Node handler does not write the TMDB id key or episode array for Haskell misses.
- External calls: Node may call TMDB on misses. Haskell does not call TMDB directly.
- FFmpeg/playback use: none.
- Decision: native cache hit plus Node proxy on miss.
- Markers: `X-StreamVault-Haskell-Metadata: native-episode-titles-cache` or `proxy-episode-titles-miss`.
- Diagnostic: `GET /__haskell-episode-titles-debug?show=...&season=...`.

### `GET /api/version`

- Query params: none.
- Response shape: `{ ok, version, time }`.
- Data source: runtime clock/static route version string.
- Cache hit/miss behavior: no cache.
- File mutation: none.
- External calls: none.
- FFmpeg/playback use: none.
- Decision: already safe native Haskell shadow route with `X-StreamVault-Haskell: native-version`.

### Existing Safe Read-Only Routes

- `GET /api/dashboard/ping`: native Haskell status response. No file mutation or external calls.
- `GET /api/history`: native Haskell read of `watch-history.json`. No writes.
- `GET /api/downloads`, `/api/movies`, `/api/series`, `/api/section/:key`, `/api/home-feed`, and `/api/channels`: already native catalog/cache reads from earlier safe slices.

## Kept Proxied

- `GET /api/dashboard/stats`: kept proxied because the Node stats path depends on tracker/runtime state and may purge stale sessions.
- Media-info, duration, qualities, subtitles, playback, direct stream, live TV, FFmpeg/HLS, poster-cache, service worker, history writes, progress writes, and cache-clear endpoints remain proxied or Node-primary.
- Any `/api/title-details` or `/api/episode-titles` cache miss remains proxied because Node may perform TMDB enrichment and Haskell must not call TMDB directly in this slice.

## Shadow Forwarding Gate

Node forwards `/api/title-details` and `/api/episode-titles` to Haskell only when `STREAMVAULT_HASKELL_SHADOW=1` is enabled. The middleware keeps the existing 1500 ms timeout and falls back to Node on timeout, status mismatch, request failure, or unexpected marker.

Allowed Haskell markers are:

- `/api/title-details`: `native-title-details-cache`, `proxy-title-details-miss`
- `/api/episode-titles`: `native-episode-titles-cache`, `proxy-episode-titles-miss`

