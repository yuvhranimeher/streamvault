# StreamVault Haskell-output Shadow API Server

This is a read-only shadow API server for testing Haskell-generated API fixtures.

It does not modify or start the real Node website.
It serves JSON from:

`tools/haskell-safe-suite/out`

Default address:

`http://127.0.0.1:3031`

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-shadow-api-server\run-shadow-api-server.ps1
```

Test examples:

```powershell
curl.exe http://127.0.0.1:3031/api/home-feed?limit=12
curl.exe "http://127.0.0.1:3031/api/section/trending?page=0&limit=12&summary=1"
curl.exe "http://127.0.0.1:3031/api/movies?page=0&limit=12"
curl.exe "http://127.0.0.1:3031/api/series?page=0&limit=12"
curl.exe "http://127.0.0.1:3031/api/search?q=netflix&limit=12"
curl.exe "http://127.0.0.1:3031/api/downloads?page=0&limit=12"
```
