$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
Set-Location $root

$toolDir = ".\tools\haskell-details-catalog-cache-mapper"
$src = Join-Path $toolDir "DetailsCatalogCacheMapper.hs"
$exe = Join-Path $toolDir "DetailsCatalogCacheMapper.exe"

Write-Host "Compiling DetailsCatalogCacheMapper.hs..."
ghc -O2 -o $exe $src

Write-Host ""
Write-Host "Running catalog/cache mapper..."
& $exe

Write-Host ""
Write-Host "Report:"
Write-Host "$toolDir\out\details-catalog-cache-mapper-report.txt"
