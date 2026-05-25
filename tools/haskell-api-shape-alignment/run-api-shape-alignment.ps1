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

$ToolDir = Join-Path $Root "tools\haskell-api-shape-alignment"
$BuildDir = Join-Path $ToolDir "build"
$OutDir = Join-Path $ToolDir "out"
$NodeSnapDir = Join-Path $Root "tools\haskell-shadow-api-comparator\snapshots\node"
$HsOutDir = Join-Path $Root "tools\haskell-safe-suite\out"

New-Item -ItemType Directory -Force -Path $BuildDir, $OutDir | Out-Null

if (-not (Test-Path $NodeSnapDir)) {
  throw "Node snapshots not found. Run haskell-shadow-api-comparator first while Node server is running."
}
if (-not (Test-Path $HsOutDir)) {
  throw "Haskell safe-suite output not found. Run streamvault_haskell_all_in_one_safe_suite.ps1 first."
}
if (-not (Get-Command ghc -ErrorAction SilentlyContinue)) {
  throw "GHC not found. Use the same Haskell-ready PowerShell used earlier."
}

$Source = Join-Path $ToolDir "ApiShapeAlignment.hs"
$Exe = Join-Path $ToolDir "api-shape-alignment.exe"

Write-Host "Building API shape alignment auditor..." -ForegroundColor Cyan
ghc -O2 -outputdir $BuildDir -o $Exe $Source

Write-Host "Running API shape alignment auditor..." -ForegroundColor Cyan
& $Exe

Write-Host ""
Write-Host "Open these reports:" -ForegroundColor Green
Write-Host (Join-Path $OutDir "api-shape-contract.md")
Write-Host (Join-Path $OutDir "haskell-adjustment-plan.txt")
