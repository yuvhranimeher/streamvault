param(
  [string]$NodeBase = "http://127.0.0.1:3000",
  [string]$HaskellBase = "http://127.0.0.1:3031",
  [int]$TimeoutMs = 60000,
  [switch]$ReadOnly,
  [switch]$Full
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

function Invoke-FastSearchParity {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\haskell-parity\run-search-parity-fast.ps1" -NodeBase $NodeBase -HaskellBase $HaskellBase -TimeoutMs $TimeoutMs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

function Invoke-DetailsShadowFast {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\haskell-parity\run-details-shadow-fast.ps1" -NodeBase $NodeBase -HaskellBase $HaskellBase -TimeoutMs $TimeoutMs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

function Invoke-ReadOnlyParity {
  Write-Host "Running focused read-only parity: dashboard ping, API version, and history read."
  node .\tools\haskell-parity\compare.js --only=dashboard-ping,api-version,history-read
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

if ($ReadOnly.IsPresent) {
  Invoke-ReadOnlyParity
  exit 0
}

if (-not $Full.IsPresent) {
  Write-Host "Full parity is slow and currently opt-in. Running fast search parity and details shadow fast parity."
  Invoke-FastSearchParity
  Invoke-DetailsShadowFast
  exit 0
}

Write-Host "Full parity was requested explicitly with -Full; running fast search parity first."
Invoke-FastSearchParity
Write-Host "Fast search parity finished; running details shadow fast parity."
Invoke-DetailsShadowFast
Write-Host "Details shadow fast parity finished; continuing full parity."
Write-Host "Full parity includes focused read-only checks and avoids playback/live/FFmpeg/HLS/media segment routes."
Write-Host "Search parity: Node /api/search is compared against Haskell /__haskell-search-debug native diagnostic search."
Write-Host "Warming Haskell native search index before comparisons."

$WarmupTimeoutSec = [Math]::Max(180, [Math]::Ceiling($TimeoutMs / 1000) * 3)
try {
  $Warmup = Invoke-WebRequest -Uri "$HaskellBase/__haskell-search-warmup" -UseBasicParsing -TimeoutSec $WarmupTimeoutSec
  if ($Warmup.StatusCode -ne 200) {
    throw "warmup status $($Warmup.StatusCode)"
  }
} catch {
  throw "Haskell search warmup failed: $($_.Exception.Message)"
}

node .\tools\haskell-parity\compare.js
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
