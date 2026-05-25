# StreamVault Haskell Details/TMDB Contract Extractor
# Safe: no frontend/server/playback changes.
# Purpose:
# - Details/TMDB is NOT ready for shadow migration.
# - This extracts Node response shapes/fields so the future Haskell implementation can match them.
# - Does not enable /api/details, /api/title-details, or /api/series/detail in shadow mode.

$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
if (!(Test-Path $root)) { throw "Project root not found: $root" }
Set-Location $root

Write-Host "== StreamVault Haskell Details/TMDB Contract Extractor =="
Write-Host "Project root: $root"

git checkout -B test-haskell-details-tmdb-contract | Out-Host

$out = Join-Path $root "tools\haskell-details-tmdb-contract\out"
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Safe-Name([string]$s) {
  $x = "$s"
  $x = [regex]::Replace($x, '[^A-Za-z0-9\-]+', '-')
  $x = $x.Trim('-')
  if ([string]::IsNullOrWhiteSpace($x)) { return "unknown" }
  if ($x.Length -gt 90) { return $x.Substring(0,90) }
  return $x
}

function Add-JsonPaths($obj, [string]$prefix, [System.Collections.Generic.List[string]]$paths, [int]$depth) {
  if ($null -eq $obj -or $depth -gt 5) { return }

  if ($obj -is [System.Array]) {
    [void]$paths.Add(($prefix + "[]"))
    if ($obj.Count -gt 0) { Add-JsonPaths $obj[0] ($prefix + "[]") $paths ($depth + 1) }
    return
  }

  if ($obj -is [System.Management.Automation.PSCustomObject]) {
    foreach ($p in $obj.PSObject.Properties) {
      $child = if ([string]::IsNullOrWhiteSpace($prefix)) { $p.Name } else { "$prefix.$($p.Name)" }
      [void]$paths.Add($child)
      Add-JsonPaths $p.Value $child $paths ($depth + 1)
    }
    return
  }
}

# Discover frontend usage.
$usage = @()
$files = Get-ChildItem -Path $root -Recurse -File -Include *.js,*.html |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\.git\\|\\tools\\" }

foreach ($f in $files) {
  $txt = Get-Content -Path $f.FullName -Raw -ErrorAction SilentlyContinue
  if ($txt -like "*/api/details*" -or $txt -like "*/api/title-details*" -or $txt -like "*/api/series/detail*") {
    $lines = (($txt -split "`n") |
      Select-String "/api/details|/api/title-details|/api/series/detail" |
      ForEach-Object { $_.Line.Trim() }) -join " | "
    $usage += [pscustomobject]@{
      File = $f.FullName.Replace($root + "\", "")
      Lines = $lines
    }
  }
}

$usageFile = Join-Path $out "details-frontend-usage.txt"
$usage | Format-List | Out-String | Set-Content -Path $usageFile -Encoding UTF8

# Build representative Node probes.
$tests = @(
  @{ Name="details-debug"; Url="/api/details/debug" },
  @{ Name="title-details-empty"; Url="/api/title-details" }
)

try {
  $movieRaw = curl.exe -s "http://127.0.0.1:3000/api/movies?page=0&limit=6"
  $movieJson = $movieRaw | ConvertFrom-Json
  $movies = @()
  if ($movieJson.movies) { $movies = @($movieJson.movies) }
  elseif ($movieJson.items) { $movies = @($movieJson.items) }
  elseif ($movieJson -is [array]) { $movies = @($movieJson) }

  foreach ($m in ($movies | Select-Object -First 6)) {
    $id = "$($m.id)"
    $title = "$($m.title)"
    if ([string]::IsNullOrWhiteSpace($title)) { $title = "$($m.name)" }
    if (![string]::IsNullOrWhiteSpace($id)) {
      $tests += @{ Name=("details-movie-" + (Safe-Name $id)); Url=("/api/details/movie/" + [uri]::EscapeDataString($id)) }
    }
    if (![string]::IsNullOrWhiteSpace($title)) {
      $tests += @{ Name=("title-details-movie-" + (Safe-Name $title)); Url=("/api/title-details?type=movie&title=" + [uri]::EscapeDataString($title)) }
    }
  }
} catch {
  Write-Host "Movie discovery skipped: $($_.Exception.Message)"
}

try {
  $seriesRaw = curl.exe -s "http://127.0.0.1:3000/api/series?page=0&limit=6"
  $seriesJson = $seriesRaw | ConvertFrom-Json
  $shows = @()
  if ($seriesJson.series) { $shows = @($seriesJson.series) }
  elseif ($seriesJson.items) { $shows = @($seriesJson.items) }
  elseif ($seriesJson -is [array]) { $shows = @($seriesJson) }

  foreach ($s in ($shows | Select-Object -First 6)) {
    $id = "$($s.id)"
    $title = "$($s.title)"
    if ([string]::IsNullOrWhiteSpace($title)) { $title = "$($s.name)" }
    if (![string]::IsNullOrWhiteSpace($id)) {
      $tests += @{ Name=("details-series-" + (Safe-Name $id)); Url=("/api/details/series/" + [uri]::EscapeDataString($id)) }
    }
    if (![string]::IsNullOrWhiteSpace($title)) {
      $tests += @{ Name=("series-detail-name-" + (Safe-Name $title)); Url=("/api/series/detail?name=" + [uri]::EscapeDataString($title)) }
      $tests += @{ Name=("title-details-series-" + (Safe-Name $title)); Url=("/api/title-details?type=series&title=" + [uri]::EscapeDataString($title)) }
    }
  }
} catch {
  Write-Host "Series discovery skipped: $($_.Exception.Message)"
}

$rows = @()
$allPaths = New-Object System.Collections.Generic.List[string]

foreach ($t in $tests) {
  $safe = Safe-Name $t.Name
  $nodeFile = Join-Path $out ("node-" + $safe + ".json")
  $url = "http://127.0.0.1:3000" + $t.Url

  Write-Host "Probe: $url"
  $body = curl.exe -s $url
  if ($null -eq $body) { $body = "" }
  Set-Content -Path $nodeFile -Value $body -Encoding UTF8

  $len = (Get-Item $nodeFile).Length
  $rootType = "unknown"
  $pathCount = 0
  $samplePaths = ""

  try {
    $json = Get-Content -Path $nodeFile -Raw | ConvertFrom-Json
    if ($json -is [array]) { $rootType = "array" } else { $rootType = "object" }

    $paths = New-Object System.Collections.Generic.List[string]
    Add-JsonPaths $json "" $paths 0
    $unique = $paths | Sort-Object -Unique
    $pathCount = @($unique).Count
    $samplePaths = (@($unique) | Select-Object -First 80) -join " | "

    foreach ($p in $unique) {
      [void]$allPaths.Add("$($t.Name)`t$p")
    }
  } catch {
    $rootType = "non-json/error"
  }

  $rows += [pscustomobject]@{
    Name = $t.Name
    Url = $t.Url
    Bytes = $len
    RootType = $rootType
    PathCount = $pathCount
    SamplePaths = $samplePaths
  }
}

$rowsCsv = Join-Path $out "details-node-contract.csv"
$pathsTsv = Join-Path $out "details-node-field-paths.tsv"
$reportFile = Join-Path $out "details-tmdb-contract-report.txt"

$rows | Export-Csv -NoTypeInformation -Path $rowsCsv -Encoding UTF8
$allPaths | Set-Content -Path $pathsTsv -Encoding UTF8

$report = @()
$report += "StreamVault Haskell Details/TMDB Contract Report"
$report += "==============================================="
$report += ""
$report += "Status:"
$report += "- Details/TMDB is NOT ready for frontend shadow."
$report += "- Keep /api/details, /api/title-details, /api/series/detail on Node."
$report += "- Next Haskell work should implement the same response fields, cache behavior, TMDB fallback, and series episode shape."
$report += ""
$report += "Frontend/server details API usage:"
$report += ""
$report += (Get-Content $usageFile -Raw)
$report += ""
$report += "Node response contract probes:"
$report += ""
$report += ($rows | Select-Object Name,Url,Bytes,RootType,PathCount | Format-Table -AutoSize | Out-String)
$report += ""
$report += "Required Haskell implementation areas:"
$report += "- /api/details/:type/:id route parser"
$report += "- /api/title-details route parser"
$report += "- /api/series/detail?name=..."
$report += "- read/write compatible detail cache"
$report += "- TMDB lookup + poster/backdrop/trailer/cast/crew/similar/director data"
$report += "- preserve card fields needed for playback handoff"
$report += "- never touch stream/direct playback routes in this phase"
$report += ""
$report += "Artifacts:"
$report += "- details-node-contract.csv"
$report += "- details-node-field-paths.tsv"
$report += "- node-*.json samples"
$report += ""
$report += "No production frontend/server/playback was changed."
$report -join "`r`n" | Set-Content -Path $reportFile -Encoding UTF8

$toolDir = Join-Path $root "tools\haskell-details-tmdb-contract"
New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
Copy-Item $MyInvocation.MyCommand.Path (Join-Path $toolDir "run-details-tmdb-contract.ps1") -Force

Write-Host ""
Write-Host "Reports:"
Write-Host "  $reportFile"
Write-Host "  $rowsCsv"
Write-Host "  $pathsTsv"

Write-Host ""
Write-Host "Committing contract tool only..."
git add -- "tools/haskell-details-tmdb-contract/run-details-tmdb-contract.ps1" | Out-Host
git commit -m "Add Haskell Details TMDB response contract extractor" | Out-Host

Write-Host ""
Write-Host "Pushing branch..."
git push -u origin test-haskell-details-tmdb-contract | Out-Host

Write-Host ""
Write-Host "DONE."
Write-Host "Open report:"
Write-Host "notepad `"$reportFile`""
