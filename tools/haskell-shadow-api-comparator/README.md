# Haskell Shadow API Comparator

Safe read-only tool for StreamVault.

It compares live Node API snapshots against generated safe-suite Haskell JSON outputs.

It does not:
- edit server.js
- edit frontend files
- start or stop the Node server
- use ports
- change playback
- change catalog data

Usage from project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-shadow-api-comparator\run-shadow-compare.ps1
```

Optional custom Node base URL:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\haskell-shadow-api-comparator\run-shadow-compare.ps1 -BaseUrl "http://127.0.0.1:3000"
```
