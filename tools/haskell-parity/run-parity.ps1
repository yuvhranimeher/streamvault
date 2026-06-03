param(
  [string]$NodeBase = "http://127.0.0.1:3000",
  [string]$HaskellBase = "http://127.0.0.1:3031",
  [int]$TimeoutMs = 60000
)

$ErrorActionPreference = "Stop"

function Find-StreamVaultRoot {
  $p = (Get-Location).Path
  while ($p -and $p.Length -gt 3) {
    if ((Test-Path (Join-Path $p "package.json")) -and (Test-Path (Join-Path $p "server.js"))) {
      return (Resolve-Path $p).Path
    }
    $p = Split-Path $p -Parent
  }
  throw "Run this from inside the StreamVault project folder."
}

$Root = Find-StreamVaultRoot
Set-Location $Root

$env:NODE_BASE = $NodeBase
$env:HASKELL_BASE = $HaskellBase
$env:PARITY_TIMEOUT_MS = [string]$TimeoutMs

node .\tools\haskell-parity\compare.js
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
