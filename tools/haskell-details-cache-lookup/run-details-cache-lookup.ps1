$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
Set-Location $root

$toolDir = ".\tools\haskell-details-cache-lookup"
$src = Join-Path $toolDir "DetailsCacheLookup.hs"
$exe = Join-Path $toolDir "DetailsCacheLookup.exe"

Write-Host "Compiling DetailsCacheLookup.hs..."
ghc -O2 -o $exe $src

Write-Host ""
Write-Host "Running fast cache lookup probes..."
& $exe

Write-Host ""
Write-Host "Report:"
Write-Host "$toolDir\out\details-cache-lookup-report.txt"
