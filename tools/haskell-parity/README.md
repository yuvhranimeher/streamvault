# StreamVault Haskell Parity Comparator

Compares live Node responses against the shadow Haskell gateway for the current safe migration set.

It is read-only:

- Does not edit `server.js`
- Does not edit frontend files
- Does not touch playback, FFmpeg, HLS, poster cache, service worker, or live playback routes
- Does not call random/details-cache-miss TMDB routes
- Details rows are limited to known Haskell `detail-cache.json` hits and are skipped on Node because Node may call TMDB
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

Outputs:

- `tools/haskell-parity/out/reports/parity-report.txt`
- `tools/haskell-parity/out/reports/parity-report.json`
- `tools/haskell-parity/out/snapshots/node/*.json`
- `tools/haskell-parity/out/snapshots/haskell/*.json`

Compatibility copies are also written to:

- `tools/haskell-parity/out/parity-report.txt`
- `tools/haskell-parity/out/parity-report.json`

Audit notes:

- `tools/haskell-parity/SEARCH_MIGRATION_NOTES.md`
- `tools/haskell-parity/DETAILS_MIGRATION_NOTES.md`
- `tools/haskell-parity/READONLY_API_MIGRATION_NOTES.md`

Native Haskell search can be tested directly with:

```powershell
curl.exe "http://127.0.0.1:3031/__haskell-search-debug?q=iron%20man"
```

`/api/search` remains proxied to Node unless `STREAMVAULT_HASKELL_SEARCH_NATIVE=1` is set on the Haskell shadow process. That flag is a guarded rollout switch with a 1500 ms fallback to Node; native search is not promoted until parity blockers are resolved.

To deliberately start the shadow with the guarded search route enabled:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\start-shadow.ps1 -NativeSearch
```
