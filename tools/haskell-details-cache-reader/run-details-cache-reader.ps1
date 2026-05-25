$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
Set-Location $root

$toolDir = ".\tools\haskell-details-cache-reader"
$src = Join-Path $toolDir "DetailsCacheReader.hs"
$exe = Join-Path $toolDir "DetailsCacheReader.exe"

Write-Host "Compiling DetailsCacheReader.hs..."
ghc -O2 -o $exe $src

Write-Host ""
Write-Host "Running cache reader..."
& $exe

Write-Host ""
Write-Host "Report:"
Write-Host "$toolDir\out\details-cache-reader-report.txt"
