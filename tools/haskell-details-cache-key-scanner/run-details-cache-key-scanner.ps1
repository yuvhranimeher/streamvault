$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
Set-Location $root

$toolDir = ".\tools\haskell-details-cache-key-scanner"
$src = Join-Path $toolDir "DetailsCacheKeyScanner.hs"
$exe = Join-Path $toolDir "DetailsCacheKeyScanner.exe"

Write-Host "Compiling DetailsCacheKeyScanner.hs..."
ghc -O2 -o $exe $src

Write-Host ""
Write-Host "Running key scanner..."
& $exe

Write-Host ""
Write-Host "Report:"
Write-Host "$toolDir\out\details-cache-key-scanner-report.txt"
