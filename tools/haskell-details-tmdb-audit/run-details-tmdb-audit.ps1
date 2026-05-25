# StreamVault Haskell Details/TMDB API Audit V2
# Safe: no frontend/server/playback changes.
# Fix: avoids PowerShell built-in $Matches variable collision.

$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
if (!(Test-Path $root)) { throw "Project root not found: $root" }
Set-Location $root

Write-Host "== StreamVault Haskell Details/TMDB API Audit V2 =="
Write-Host "Project root: $root"

git checkout -B test-haskell-details-tmdb-audit-v2 | Out-Host

$out = Join-Path $root "tools\haskell-details-tmdb-audit\out"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$frontendFiles = Get-ChildItem -Path $root -Recurse -File -Include *.js,*.html |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\.git\\|\\tools\\" }

$detailMatches = @()
foreach ($f in $frontendFiles) {
  $text = Get-Content -Path $f.FullName -Raw -ErrorAction SilentlyContinue
  if ($text -like "*/api/details*" -or $text -like "*/api/title-details*" -or $text -like "*/api/series/detail*") {
    $lines = (($text -split "`n") |
      Select-String "/api/details|/api/title-details|/api/series/detail|/api/tmdb|/api/similar|/api/trailer|/api/cast|/api/crew" |
      ForEach-Object { $_.Line.Trim() }) -join " | "
    $detailMatches += [pscustomobject]@{
      File = $f.FullName.Replace($root + "\", "")
      Lines = $lines
    }
  }
}

$usageReport = Join-Path $out "frontend-details-api-usage.txt"
$detailMatches | Format-List | Out-String | Set-Content -Path $usageReport -Encoding UTF8

$tests = @(
  @{ Name="details-debug"; Url="/api/details/debug" },
  @{ Name="title-details-empty"; Url="/api/title-details" }
)

try {
  $movieRaw = curl.exe -s "http://127.0.0.1:3000/api/movies?page=0&limit=3"
  $movieJson = $movieRaw | ConvertFrom-Json
  $movies = @()
  if ($movieJson.movies) { $movies = @($movieJson.movies) }
  elseif ($movieJson.items) { $movies = @($movieJson.items) }
  elseif ($movieJson -is [array]) { $movies = @($movieJson) }

  foreach ($m in ($movies | Select-Object -First 3)) {
    $id = $m.id
    $title = $m.title
    if (!$title) { $title = $m.name }
    if ($id) {
      $tests += @{ Name=("details-movie-id-" + $id); Url=("/api/details/movie/" + [uri]::EscapeDataString("$id")) }
    }
    if ($title) {
      $safeTitle = (($title -replace '[^A-Za-z0-9]+','-').Trim('-'))
      $tests += @{ Name=("title-details-movie-" + $safeTitle); Url=("/api/title-details?type=movie&title=" + [uri]::EscapeDataString("$title")) }
    }
  }
} catch {
  Write-Host "Movie probe discovery skipped: $($_.Exception.Message)"
}

try {
  $seriesRaw = curl.exe -s "http://127.0.0.1:3000/api/series?page=0&limit=3"
  $seriesJson = $seriesRaw | ConvertFrom-Json
  $series = @()
  if ($seriesJson.series) { $series = @($seriesJson.series) }
  elseif ($seriesJson.items) { $series = @($seriesJson.items) }
  elseif ($seriesJson -is [array]) { $series = @($seriesJson) }

  foreach ($s in ($series | Select-Object -First 3)) {
    $id = $s.id
    $title = $s.title
    if (!$title) { $title = $s.name }
    if ($id) {
      $tests += @{ Name=("details-series-id-" + $id); Url=("/api/details/series/" + [uri]::EscapeDataString("$id")) }
    }
    if ($title) {
      $safeTitle = (($title -replace '[^A-Za-z0-9]+','-').Trim('-'))
      $tests += @{ Name=("series-detail-name-" + $safeTitle); Url=("/api/series/detail?name=" + [uri]::EscapeDataString("$title")) }
      $tests += @{ Name=("title-details-series-" + $safeTitle); Url=("/api/title-details?type=series&title=" + [uri]::EscapeDataString("$title")) }
    }
  }
} catch {
  Write-Host "Series probe discovery skipped: $($_.Exception.Message)"
}

$rows = @()

foreach ($t in $tests) {
  $safeName = ($t.Name -replace '[^A-Za-z0-9\-]+','-')
  $nodeFile = Join-Path $out ("node-" + $safeName + ".json")
  $hsFile = Join-Path $out ("haskell-" + $safeName + ".json")
  $nodeUrl = "http://127.0.0.1:3000" + $t.Url
  $hsUrl = "http://127.0.0.1:3031" + $t.Url

  try { curl.exe -s $nodeUrl | Set-Content -Path $nodeFile -Encoding UTF8 } catch { Set-Content -Path $nodeFile -Value "" -Encoding UTF8 }
  try { curl.exe -s $hsUrl | Set-Content -Path $hsFile -Encoding UTF8 } catch { Set-Content -Path $hsFile -Value "" -Encoding UTF8 }

  $nodeLen = (Get-Item $nodeFile).Length
  $hsLen = (Get-Item $hsFile).Length
  $delta = $hsLen - $nodeLen
  $pct = if ($nodeLen -gt 0) { [math]::Round(($delta / $nodeLen) * 100, 2) } else { 0 }

  if ($nodeLen -eq 0 -and $hsLen -eq 0) { $verdict = "both empty" }
  elseif ($hsLen -lt 150) { $verdict = "haskell missing/not implemented" }
  elseif ([math]::Abs($delta) -le 16) { $verdict = "exact/near exact" }
  elseif ([math]::Abs($pct) -le 5) { $verdict = "close" }
  else { $verdict = "mismatch" }

  $rows += [pscustomobject]@{
    Name = $t.Name
    Url = $t.Url
    NodeBytes = $nodeLen
    HaskellBytes = $hsLen
    Delta = $delta
    DeltaPct = $pct
    Verdict = $verdict
  }
}

$csv = Join-Path $out "details-tmdb-parity.csv"
$txt = Join-Path $out "details-tmdb-audit-report.txt"

$rows | Export-Csv -NoTypeInformation -Path $csv -Encoding UTF8

$report = @()
$report += "StreamVault Haskell Details/TMDB API Audit V2"
$report += "============================================="
$report += ""
$report += "Frontend/server details API usage found:"
$report += ""
$report += (Get-Content $usageReport -Raw)
$report += ""
$report += "Node vs Haskell shadow probe comparison:"
$report += ""
$report += ($rows | Format-Table -AutoSize | Out-String)
$report += ""
$report += "Summary by verdict:"
$report += ($rows | Group-Object Verdict | Sort-Object Name | Format-Table Name,Count -AutoSize | Out-String)
$report += ""
$report += "Interpretation:"
$report += "- Details/TMDB should remain Node until Haskell implements/caches the same metadata fields."
$report += "- Playback stays Node during this phase."
$report += "- This audit does not modify production frontend/playback."
$report -join "`r`n" | Set-Content -Path $txt -Encoding UTF8

$toolDir = Join-Path $root "tools\haskell-details-tmdb-audit"
New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
Copy-Item $MyInvocation.MyCommand.Path (Join-Path $toolDir "run-details-tmdb-audit.ps1") -Force

Write-Host ""
Write-Host "Reports:"
Write-Host "  $txt"
Write-Host "  $csv"
Write-Host "  $usageReport"

Write-Host ""
Write-Host "Committing audit tool only..."
git add -- "tools/haskell-details-tmdb-audit/run-details-tmdb-audit.ps1" | Out-Host
git commit -m "Fix Haskell Details TMDB API audit" | Out-Host

Write-Host ""
Write-Host "Pushing branch..."
git push -u origin test-haskell-details-tmdb-audit-v2 | Out-Host

Write-Host ""
Write-Host "DONE."
Write-Host "Open report:"
Write-Host "notepad `"$txt`""
