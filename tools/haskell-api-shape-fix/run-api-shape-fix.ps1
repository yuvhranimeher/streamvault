$ErrorActionPreference = "Stop"

function Find-StreamVaultRoot {
  $p = (Get-Location).Path
  while ($p -and $p.Length -gt 3) {
    if ((Test-Path (Join-Path $p "package.json")) -and (Test-Path (Join-Path $p "catalog.json"))) {
      return (Resolve-Path $p).Path
    }
    $p = Split-Path $p -Parent
  }
  $fallback = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
  if ((Test-Path (Join-Path $fallback "package.json")) -and (Test-Path (Join-Path $fallback "catalog.json"))) {
    return (Resolve-Path $fallback).Path
  }
  throw "Run this from inside the StreamVault project folder."
}

$Root = Find-StreamVaultRoot
Set-Location $Root

$ToolDir = Join-Path $Root "tools\haskell-api-shape-fix"
$BuildDir = Join-Path $ToolDir "build"
$OutDir = Join-Path $ToolDir "out"
$NodeSnapDir = Join-Path $Root "tools\haskell-shadow-api-comparator\snapshots\node"
$SafeSuiteOutDir = Join-Path $Root "tools\haskell-safe-suite\out"

New-Item -ItemType Directory -Force -Path $BuildDir, $OutDir, $SafeSuiteOutDir | Out-Null

if (-not (Test-Path $NodeSnapDir)) {
  throw "Node snapshots not found. Run haskell-shadow-api-comparator first while Node server is running."
}

$jsonCount = @(Get-ChildItem $NodeSnapDir -Filter *.json -ErrorAction SilentlyContinue).Count
if ($jsonCount -lt 1) {
  throw "No Node JSON snapshots found in $NodeSnapDir. Rerun shadow comparator while Node server is running."
}

if (-not (Get-Command ghc -ErrorAction SilentlyContinue)) {
  throw "GHC not found. Use the same Haskell-ready PowerShell used earlier."
}

$Source = Join-Path $ToolDir "ApiShapeFix.hs"
$Exe = Join-Path $ToolDir "api-shape-fix.exe"

Write-Host "Building API shape fixture generator..." -ForegroundColor Cyan
ghc -O2 -outputdir $BuildDir -o $Exe $Source

Write-Host "Running API shape fixture generator..." -ForegroundColor Cyan
& $Exe

Write-Host ""
Write-Host "Generated shape fixtures:" -ForegroundColor Green
Get-ChildItem $OutDir -Filter *.json | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize

Write-Host ""
Write-Host "Open report:" -ForegroundColor Green
Write-Host (Join-Path $OutDir "api-shape-fix-report.txt")
