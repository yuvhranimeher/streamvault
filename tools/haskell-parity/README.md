# StreamVault Haskell Parity Comparator

Compares live Node responses against the shadow Haskell gateway for the current safe migration set.

It is read-only:

- Does not edit `server.js`
- Does not edit frontend files
- Does not touch playback, FFmpeg, HLS, poster cache, service worker, or live playback routes
- Does not call random/details-cache-miss TMDB routes
- Details rows are limited to known Haskell `detail-cache.json` hits and are skipped on Node because Node may call TMDB
- Search rows include the migration target queries and compare response shape, top result identities, movie/series markers, IDs, and poster/backdrop presence

Run from the StreamVault project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\run-parity.ps1 -TimeoutMs 60000
```

Custom bases:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\run-parity.ps1 -NodeBase http://127.0.0.1:3000 -HaskellBase http://127.0.0.1:3031 -TimeoutMs 60000
```

Outputs:

- `tools/haskell-parity/out/reports/parity-report.txt`
- `tools/haskell-parity/out/reports/parity-report.json`
- `tools/haskell-parity/out/snapshots/node/*.json`
- `tools/haskell-parity/out/snapshots/haskell/*.json`

Compatibility copies are also written to:

- `tools/haskell-parity/out/parity-report.txt`
- `tools/haskell-parity/out/parity-report.json`

Native Haskell search is diagnostic-only in this branch:

```powershell
curl.exe "http://127.0.0.1:3031/__haskell-search-debug?q=iron%20man"
```

`/api/search` remains proxied to Node until native parity blockers are resolved.
