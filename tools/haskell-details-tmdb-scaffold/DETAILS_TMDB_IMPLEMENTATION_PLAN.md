# StreamVault Details/TMDB Haskell Migration Plan

Status: scaffold only. Do not enable frontend shadow for details yet.

## Keep on Node for now

- `/api/details/:type/:id`
- `/api/title-details`
- `/api/series/detail`
- playback/direct stream routes
- FFmpeg/HLS routes

## Haskell must match Node behavior

Required routes:

```txt
GET /api/details/debug
GET /api/details/:type/:id
POST /api/details/cache/clear
GET /api/title-details?type=movie|series&title=...
GET /api/series/detail?name=...
```

Required data compatibility:

```txt
detail-cache.json
episode-title-cache.json
catalog.json / approved catalogs
TMDB metadata
YouTube trailer metadata
poster/backdrop fallback
cast/crew
production companies
similar titles
director titles
series seasons/episodes
streamUrl/playback handoff fields
```

## Why this phase is risky

Details data feeds playback pages. If Haskell drops/renames playback fields, cards may open but videos may fail. So details must be implemented before enabling shadow mode, but playback must remain Node until the final phase.

## Next safe build steps

1. Implement Haskell cache reader for `detail-cache.json`.
2. Implement catalog lookup by `ftp_*` id and normalized title.
3. Implement `/api/details/:type/:id` response builder from cached/catalog data.
4. Implement `/api/title-details` response builder.
5. Implement `/api/series/detail?name=...` response builder.
6. Compare Haskell output against Node contract samples.
7. Only then test details shadow mode.
