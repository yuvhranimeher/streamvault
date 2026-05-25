$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
Set-Location $root

$dir = ".\tools\haskell-details-tmdb-scaffold"
$src = Join-Path $dir "DetailsTmdbPrototype.hs"
$exe = Join-Path $dir "DetailsTmdbPrototype.exe"

Write-Host "Compiling Details/TMDB prototype..."
ghc -O2 -o $exe $src

Write-Host ""
Write-Host "Running prototype..."
& $exe

Write-Host ""
Write-Host "Route parser smoke tests:"
& $exe route "/api/details/movie/ftp_0"
& $exe route "/api/details/series/ftp_1"
& $exe route "/api/title-details?type=movie&title=Hamlet%201996"
& $exe slug "The Hunt for Gollum (2009)"

Write-Host ""
Write-Host "Done."
