param(
  [int]$Port = 3031
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
$OutDir = Join-Path $Root "tools\haskell-parity\out"
$PidFile = Join-Path $OutDir "haskell-shadow-$Port.pid"

$Ids = @()
if (Test-Path $PidFile) {
  $RawPid = (Get-Content -Path $PidFile -Raw).Trim()
  if ($RawPid -match '^\d+$') {
    $Ids += [int]$RawPid
  }
}

try {
  $Ids += Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
} catch {
  Write-Warning "Could not inspect listening process on port ${Port}: $($_.Exception.Message)"
}

$Ids = $Ids | Where-Object { $_ -and $_ -ne $PID } | Select-Object -Unique
if (-not $Ids -or $Ids.Count -eq 0) {
  Write-Host "No Haskell shadow process found for port $Port"
  if (Test-Path $PidFile) { Remove-Item -LiteralPath $PidFile -Force }
  exit 0
}

foreach ($Id in $Ids) {
  try {
    Stop-Process -Id $Id -Force -ErrorAction Stop
    Write-Host "Stopped process $Id for Haskell shadow port $Port"
  } catch {
    Write-Warning "Could not stop process ${Id}: $($_.Exception.Message)"
  }
}

if (Test-Path $PidFile) {
  Remove-Item -LiteralPath $PidFile -Force
}
