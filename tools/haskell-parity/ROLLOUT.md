# StreamVault Haskell Shadow Rollout

Node remains the production default. Haskell is only used by Node when
`STREAMVAULT_HASKELL_SHADOW=1` is present in the Node process environment.

## Start Node-Only

```powershell
Remove-Item Env:STREAMVAULT_HASKELL_SHADOW -ErrorAction SilentlyContinue
Remove-Item Env:STREAMVAULT_HASKELL_BASE -ErrorAction SilentlyContinue
$env:PORT = "3000"
npm start
```

## Start Haskell Shadow

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\start-shadow.ps1
```

The default Haskell shadow URL is `http://127.0.0.1:3031`.

## Enable Safe Forwarding In Node

Start Node with both flags:

```powershell
$env:STREAMVAULT_HASKELL_SHADOW = "1"
$env:STREAMVAULT_HASKELL_BASE = "http://127.0.0.1:3031"
$env:PORT = "3000"
npm start
```

If either flag is omitted or `STREAMVAULT_HASKELL_SHADOW` is not `1`, Node serves
all routes itself.

## Instant Rollback

Restart Node without the shadow flag:

```powershell
Remove-Item Env:STREAMVAULT_HASKELL_SHADOW -ErrorAction SilentlyContinue
$env:PORT = "3000"
npm start
```

Optional: stop the Haskell shadow process.

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\stop-shadow.ps1
```

## Allowed Through Haskell

Node may forward only these GET routes when the flag is enabled:

- `/api/downloads`
- `/api/movies`
- `/api/series`
- `/api/home-feed`
- `/api/channels`
- `/api/section/marvel`
- `/api/section/dc`
- `/api/section/netflix`
- `/api/details/:type/:id` only when Haskell returns `200` with `X-StreamVault-Haskell: native-details-cache`
- `/download/:id` only when Haskell returns `302` with `X-StreamVault-Haskell: native-download-redirect` and a `Location` header

Node uses a 1500 ms Haskell timeout. If Haskell is down, slow, returns the wrong
status, misses the required marker, or omits a required redirect location, Node
logs the fallback reason and runs the original Node route.

## Forbidden From Haskell

These routes must stay Node-owned:

- `/api/search`
- Details cache misses and TMDB lookups
- Playback and direct stream routes
- Mobile HLS routes
- FFmpeg/HLS session routes
- FTP stream/proxy/raw media routes
- Live playback playlists and media segments
- Poster cache routes
- Service worker and frontend/static/UI routes

## Validation

Run the full rollout validation:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-parity\validate-shadow.ps1
```

The validation covers:

- Node-only frontend and safe API smoke checks
- Haskell health
- parity report must be `15 passed, 0 failed`
- a temporary shadow-enabled Node smoke check
- `/` still returns `200`
- safe API routes return `200` through Haskell or Node fallback
- `/download/:id` returns `302` through Haskell or Node fallback
- harmless playback probes remain Node-owned and do not carry the Haskell shadow forwarding header

## Search Migration Blockers

`/api/search` is not migrated yet. The Node route depends on:

- `server.js` search helpers including `svFastSearch`, `svFilterPaged`, `loadMassiveCatalog`, and the in-memory `_massiveMovies` / `_massiveSeries` indexes
- local `movies/` and `series/` scans
- FTP/catalog data from `catalog.json` and related catalog loaders
- the massive catalog file `scan-output/clean-catalog.json`
- poster and metadata hydration from `poster-cache.json`
- frontend request shapes in `public/search.js` and related browse pages

Before migrating search, Haskell needs the same indexed data sources, fuzzy/token
ranking behavior, pagination semantics, no-poster massive-result caps, and
frontend query parameter contract.
