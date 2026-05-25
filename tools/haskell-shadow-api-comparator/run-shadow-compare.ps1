param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

function Find-StreamVaultRoot {
  $p = (Get-Location).Path
  while ($p -and $p.Length -gt 3) {
    if ((Test-Path (Join-Path $p "package.json")) -and (Test-Path (Join-Path $p "catalog.json"))) {
      return (Resolve-Path $p).Path
    }
    $p = Split-Path $p -Parent
  }
  throw "Run this from inside the StreamVault project folder."
}

$Root = Find-StreamVaultRoot
Set-Location $Root

$ToolDir = Join-Path $Root "tools\haskell-shadow-api-comparator"
$BuildDir = Join-Path $ToolDir "build"
$OutDir = Join-Path $ToolDir "out"
$NodeSnapDir = Join-Path $ToolDir "snapshots\node"
$HsOutDir = Join-Path $Root "tools\haskell-safe-suite\out"

New-Item -ItemType Directory -Force -Path $BuildDir, $OutDir, $NodeSnapDir | Out-Null

Write-Host "== Shadow API Comparator ==" -ForegroundColor Cyan
Write-Host "Root:    $Root" -ForegroundColor Gray
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor Gray

if (-not (Test-Path $HsOutDir)) {
  Write-Warning "Haskell safe-suite output dir not found: $HsOutDir"
  Write-Warning "Run streamvault_haskell_all_in_one_safe_suite.ps1 first."
}

$endpoints = @(
  @{ file = "01-api-home-feed-limit-12.json";              path = "/api/home-feed?limit=12" },
  @{ file = "02-api-section-netflix-page-0-limit-12.json"; path = "/api/section/netflix?page=0&limit=12&summary=1" },
  @{ file = "03-api-section-marvel-page-0-limit-12.json";  path = "/api/section/marvel?page=0&limit=12&summary=1" },
  @{ file = "04-api-section-dc-page-0-limit-12.json";      path = "/api/section/dc?page=0&limit=12&summary=1" },
  @{ file = "05-api-section-trending-page-0-limit-12.json";path = "/api/section/trending?page=0&limit=12&summary=1" },
  @{ file = "06-api-section-series-page-0-limit-12.json";  path = "/api/section/series?page=0&limit=12&summary=1" },
  @{ file = "07-api-section-top-rated-page-0-limit-12.json";path = "/api/section/topRated?page=0&limit=12&summary=1" },
  @{ file = "08-api-section-all-movies-page-0-limit-12.json";path = "/api/section/allMovies?page=0&limit=12&summary=1" },
  @{ file = "09-api-movies-page-0-limit-12.json";          path = "/api/movies?page=0&limit=12" },
  @{ file = "10-api-series-page-0-limit-12.json";          path = "/api/series?page=0&limit=12" },
  @{ file = "11-api-search-netflix-limit-12.json";         path = "/api/search?q=netflix&page=0&limit=12" },
  @{ file = "12-api-downloads-page-0-limit-12.json";       path = "/api/downloads?page=0&limit=12" }
)

"Generated at $(Get-Date -Format o)" | Set-Content -Encoding UTF8 (Join-Path $OutDir "fetch-log.txt")

foreach ($ep in $endpoints) {
  $url = $BaseUrl.TrimEnd("/") + $ep.path
  $dest = Join-Path $NodeSnapDir $ep.file
  $errDest = "$dest.error.txt"

  try {
    Write-Host "FETCH $($ep.path)" -ForegroundColor DarkGray
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
    $res.Content | Set-Content -Encoding UTF8 $dest
    if (Test-Path $errDest) { Remove-Item $errDest -Force }
    "OK $url -> $dest" | Add-Content -Encoding UTF8 (Join-Path $OutDir "fetch-log.txt")
  } catch {
    $msg = "FAILED $url :: $($_.Exception.Message)"
    Write-Warning $msg
    $msg | Set-Content -Encoding UTF8 $errDest
    $msg | Add-Content -Encoding UTF8 (Join-Path $OutDir "fetch-log.txt")
  }
}

$Source = Join-Path $ToolDir "ShadowApiComparator.hs"
$Exe = Join-Path $ToolDir "shadow-api-comparator.exe"

if (-not (Get-Command ghc -ErrorAction SilentlyContinue)) {
  throw "GHC not found. Install GHC or run from your Haskell-ready shell."
}

Write-Host "Building Haskell comparator..." -ForegroundColor Cyan
ghc -O2 -outputdir $BuildDir -o $Exe $Source

Write-Host "Running comparator..." -ForegroundColor Cyan
& $Exe

Write-Host ""
Write-Host "Open report:" -ForegroundColor Green
Write-Host (Join-Path $OutDir "shadow-api-report.txt")
