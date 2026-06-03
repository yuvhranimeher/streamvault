# StreamVault Haskell Backend

This is a Haskell/Scotty backend rewrite for StreamVault that keeps the existing frontend API paths and JSON shapes compatible.

## What it preserves

- Existing `public/` frontend serving
- `catalog.json`, `channels.json`, `home-feed.json`, `downloads-catalog.json`, `software-library.json`
- Main frontend APIs:
  - `/api/movies`
  - `/api/series`
  - `/api/search`
  - `/api/home-feed`
  - `/api/section/:key`
  - `/api/channels`
  - `/api/downloads`
  - `/api/playback/ftp`
  - `/api/ftp/proxy`
  - `/api/ftp/stream`
  - `/api/ftp/media-info`
  - `/api/details/:type/:id`
  - `/api/title-details`
  - `/api/dashboard/ping`
  - `/api/dashboard/stats`

## Setup on Windows

Install GHCup first:

```powershell
winget install GHCup.GHCup
```

Then open a new PowerShell inside your existing StreamVault root folder and run:

```powershell
cd "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
```

Copy this Haskell backend folder anywhere, then run it from your StreamVault root:

```powershell
cabal run --project-file="C:\path\to\streamvault-haskell-backend\cabal.project" streamvault-haskell-backend
```

Simpler method: copy `streamvault-haskell-backend.cabal` and `app/` into your StreamVault root, then run:

```powershell
cabal update
cabal run streamvault-haskell-backend
```

## Important

Run this on another port first:

```powershell
$env:PORT="3001"
cabal run streamvault-haskell-backend
```

Then compare with your Node backend on `3000` before replacing it.

## FFmpeg

For `/api/ftp/stream` and `/api/ftp/media-info`, `ffmpeg` and `ffprobe` must be available in PATH.
