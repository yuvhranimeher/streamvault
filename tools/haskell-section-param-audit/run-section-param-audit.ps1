# StreamVault Haskell Section APIs Parity Audit
# Safe: no frontend/server/playback changes.
# Purpose:
# - Find /api/section usages in frontend.
# - Compare Node API on 3000 vs Haskell shadow API on 3031 for homepage/section rows.
# - Decide which section fixtures/routes must be expanded before enabling Haskell sections.

$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
if (!(Test-Path $root)) { throw "Project root not found: $root" }
Set-Location $root

Write-Host "== StreamVault Haskell Section APIs Parity Audit =="
Write-Host "Project root: $root"

git checkout -B test-haskell-section-param-audit | Out-Host

$out = Join-Path $root "tools\haskell-section-param-audit\out"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$frontendFiles = Get-ChildItem -Path $root -Recurse -File -Include *.js,*.html |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\.git\\|\\tools\\" }

$sectionMatches = @()

foreach ($f in $frontendFiles) {
  $text = Get-Content -Path $f.FullName -Raw -ErrorAction SilentlyContinue
  if ($text -like "*/api/section*") {
    $lines = (($text -split "`n") | Select-String "/api/section" | ForEach-Object { $_.Line.Trim() }) -join " | "
    $sectionMatches += [pscustomobject]@{
      File = $f.FullName.Replace($root + "\", "")
      Lines = $lines
    }
  }
}

$frontendReport = Join-Path $out "frontend-section-fetches.txt"
$sectionMatches | Format-List | Out-String | Set-Content -Path $frontendReport -Encoding UTF8

# Known/high-priority homepage section keys.
$sectionKeys = @(
  "netflix",
  "marvel",
  "dc",
  "trending",
  "series",
  "new",
  "universal",
  "disney",
  "warner",
  "hbo",
  "apple",
  "indian",
  "anime",
  "koreanDrama",
  "horrorNights",
  "cyberpunkScifi",
  "drama",
  "spanish",
  "topRated",
  "allMovies",
  "all-movies",
  "top-rated"
)

$tests = @()

foreach ($key in $sectionKeys) {
  $safe = ($key -replace '[^A-Za-z0-9\-]+', '-')
  $tests += @{ Name="section-$safe-page0-limit12-summary"; Url="/api/section/$key?page=0&limit=12&summary=1" }
  $tests += @{ Name="section-$safe-page0-limit24-summary"; Url="/api/section/$key?page=0&limit=24&summary=1" }
  $tests += @{ Name="section-$safe-page0-limit12"; Url="/api/section/$key?page=0&limit=12" }
}

$rows = @()

foreach ($t in $tests) {
  $nodeFile = Join-Path $out ("node-" + $t.Name + ".json")
  $hsFile = Join-Path $out ("haskell-" + $t.Name + ".json")
  $nodeUrl = "http://127.0.0.1:3000" + $t.Url
  $hsUrl = "http://127.0.0.1:3031" + $t.Url

  try { curl.exe -s $nodeUrl | Set-Content -Path $nodeFile -Encoding UTF8 } catch { Set-Content -Path $nodeFile -Value "" -Encoding UTF8 }
  try { curl.exe -s $hsUrl | Set-Content -Path $hsFile -Encoding UTF8 } catch { Set-Content -Path $hsFile -Value "" -Encoding UTF8 }

  $nodeLen = (Get-Item $nodeFile).Length
  $hsLen = (Get-Item $hsFile).Length
  $delta = $hsLen - $nodeLen
  $pct = if ($nodeLen -gt 0) { [math]::Round(($delta / $nodeLen) * 100, 2) } else { 0 }

  if ($nodeLen -eq 0 -or $hsLen -eq 0) { $verdict = "missing/empty" }
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

$csv = Join-Path $out "section-param-parity.csv"
$txt = Join-Path $out "section-param-parity-report.txt"

$rows | Export-Csv -NoTypeInformation -Path $csv -Encoding UTF8

$report = @()
$report += "StreamVault Haskell Section APIs Parity Audit"
$report += "============================================="
$report += ""
$report += "Frontend /api/section usage found in:"
$report += ""
$report += (Get-Content $frontendReport -Raw)
$report += ""
$report += "Node vs Haskell shadow byte comparison:"
$report += ""
$report += ($rows | Format-Table -AutoSize | Out-String)
$report += ""
$report += "Summary by verdict:"
$report += ($rows | Group-Object Verdict | Sort-Object Name | Format-Table Name,Count -AutoSize | Out-String)
$report += ""
$report += "Rule:"
$report += "- exact/near exact / close = candidate for section shadow"
$report += "- mismatch/missing = keep on Node until fixture/router/dynamic Haskell section builder is fixed"
$report += ""
$report += "No production server/frontend/playback was changed."
$report -join "`r`n" | Set-Content -Path $txt -Encoding UTF8

$toolDir = Join-Path $root "tools\haskell-section-param-audit"
New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
Copy-Item $MyInvocation.MyCommand.Path (Join-Path $toolDir "run-section-param-audit.ps1") -Force

Write-Host ""
Write-Host "Reports:"
Write-Host "  $txt"
Write-Host "  $csv"
Write-Host "  $frontendReport"

Write-Host ""
Write-Host "Committing audit tool only..."
git add -- "tools/haskell-section-param-audit/run-section-param-audit.ps1" | Out-Host
git commit -m "Add Haskell section API parity audit" | Out-Host

Write-Host ""
Write-Host "Pushing branch..."
git push -u origin test-haskell-section-param-audit | Out-Host

Write-Host ""
Write-Host "DONE."
Write-Host "Open report:"
Write-Host "notepad `"$txt`""
