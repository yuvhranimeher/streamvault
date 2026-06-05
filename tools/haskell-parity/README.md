# StreamVault Haskell Parity Comparator

Compares live Node responses against the shadow Haskell gateway for the current safe migration set.

It is read-only:

- Does not edit `server.js`
- Does not edit frontend files
- Does not touch playback, FFmpeg, HLS, poster cache, service worker, or live playback routes
- Does not call random/details-cache-miss TMDB routes
- Details cache-hit rows are limited to known Haskell `detail-cache.json` hits and are skipped on Node because Node may call TMDB
- Details cache-miss rows use a small catalog-derived fixture set, proxy Haskell to Node, and send read-only shadow headers so Node does not mutate `detail-cache.json`
- Metadata rows cover `/api/title-details` and `/api/episode-titles` cache hits natively, then cache misses through the Haskell-to-Node proxy with read-only shadow headers
- Search rows compare Node `/api/search` against Haskell `/__haskell-search-debug`, then check response shape, top result identities, movie/series markers, IDs, and poster/backdrop presence
- Read-only rows cover only native shadow-safe status/history endpoints: `/api/dashboard/ping`, `/api/version`, and `GET /api/history`

Run from the StreamVault project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\run-parity.ps1 -TimeoutMs 60000
```

Custom bases:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\run-parity.ps1 -NodeBase http://127.0.0.1:3000 -HaskellBase http://127.0.0.1:3031 -TimeoutMs 60000
```

Focused read-only parity for the newly migrated endpoints:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\run-parity.ps1 -ReadOnly -TimeoutMs 20000
```

Full parity is opt-in:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\run-parity.ps1 -Full -TimeoutMs 60000
```

Fast details shadow parity can also be run directly:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\run-details-shadow-fast.ps1 -TimeoutMs 20000
```

Fast metadata parity can also be run directly:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\run-metadata-parity-fast.ps1 -TimeoutMs 20000
```

Fast catalog parameter parity can also be run directly:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-param-parity\run-catalog-param-parity-fast.ps1 -TimeoutMs 20000
```

Outputs:

- `tools/haskell-parity/out/reports/parity-report.txt`
- `tools/haskell-parity/out/reports/parity-report.json`
- `tools/haskell-parity/out/snapshots/node/*.json`
- `tools/haskell-parity/out/snapshots/haskell/*.json`

Compatibility copies are also written to:

- `tools/haskell-parity/out/parity-report.txt`
- `tools/haskell-parity/out/parity-report.json`
- `tools/haskell-parity/out/details-shadow-fast-report.txt`
- `tools/haskell-parity/out/metadata-fast-report.txt`
- `tools/haskell-parity/out/catalog-param-fast-report.txt`

Audit notes:

- `tools/haskell-parity/SEARCH_MIGRATION_NOTES.md`
- `tools/haskell-parity/DETAILS_MIGRATION_NOTES.md`
- `tools/haskell-parity/DETAILS_CACHE_MISS_SHADOW_NOTES.md`
- `tools/haskell-parity/METADATA_API_MIGRATION_NOTES.md`
- `tools/haskell-parity/READONLY_API_MIGRATION_NOTES.md`
- `tools/haskell-parity/CATALOG_PARAM_PARITY_NOTES.md`

Catalog parameter-safe routes now cover:

- `/api/movies?page=&limit=` with zero-based page semantics and Node-compatible limit fallback
- `/api/series?page=&limit=` with Node's default array response and paged envelope response
- `/api/section/:key?page=&limit=` for the validated section allow-list
- `/api/home-feed?limit=` with Node-compatible row limit clamping

The catalog fast runner compares movies, series, and section compact response summaries and writes no large snapshots. Home-feed behavior is audited in `CATALOG_PARAM_PARITY_NOTES.md`, but it is skipped by the fast runner because the current Node primary home-feed response can exceed the fast timeout.

Native Haskell search can be tested directly with:

```powershell
curl.exe "http://127.0.0.1:3031/__haskell-search-debug?q=iron%20man"
```

`/api/search` remains proxied to Node unless `STREAMVAULT_HASKELL_SEARCH_NATIVE=1` is set on the Haskell shadow process. That flag is a guarded rollout switch with a 1500 ms fallback to Node; native search is not promoted until parity blockers are resolved.

To deliberately start the shadow with the guarded search route enabled:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\start-shadow.ps1 -NativeSearch
```

Details cache misses now use a shadow-safe adapter on Haskell:

- cache hits remain native and return `X-StreamVault-Haskell: native-details-cache`
- cache misses proxy to `STREAMVAULT_NODE` and return `X-StreamVault-Haskell-Details: proxy-cache-miss`
- the proxy request sends `x-streamvault-details-shadow: 1`, which keeps Node's normal primary behavior unchanged while preventing shadow-triggered detail-cache writes
- `GET /__haskell-details-shadow-debug?type=movie&id=...&title=...&year=...` shows the selected cache-hit/proxy-miss path and compact shape summary

Metadata cache misses now use the same shadow-safe pattern:

- `/api/title-details` native hits return `X-StreamVault-Haskell-Metadata: native-title-details-cache`
- `/api/title-details` misses proxy to Node and return `X-StreamVault-Haskell-Metadata: proxy-title-details-miss`
- `/api/episode-titles` native hits return `X-StreamVault-Haskell-Metadata: native-episode-titles-cache`
- `/api/episode-titles` misses proxy to Node and return `X-StreamVault-Haskell-Metadata: proxy-episode-titles-miss`
- the proxy request sends `x-streamvault-metadata-shadow: 1`, so Node keeps normal primary behavior but skips metadata cache writes for Haskell shadow misses
