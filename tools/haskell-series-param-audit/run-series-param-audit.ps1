# StreamVault Haskell Series Frontend Param Audit
# Safe: no frontend/server/playback changes.
# Purpose:
# - Find every /api/series URL shape the frontend actually uses.
# - Compare Node API on 3000 vs Haskell shadow API on 3031.
# - Decide what Haskell series fixtures/routes must be expanded before frontend shadow.

$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
if (!(Test-Path $root)) { throw "Project root not found: $root" }
Set-Location $root

Write-Host "== StreamVault Haskell Series Frontend Param Audit =="
Write-Host "Project root: $root"

git checkout -B test-haskell-series-param-audit | Out-Host

$out = Join-Path $root "tools\haskell-series-param-audit\out"
New-Item -ItemType Directory -Force -Path $out | Out-Null

# Find frontend usages.
$frontendFiles = Get-ChildItem -Path $root -Recurse -File -Include *.js,*.html |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\.git\\|\\tools\\" }

$seriesMatches = @()

foreach ($f in $frontendFiles) {
  $text = Get-Content -Path $f.FullName -Raw -ErrorAction SilentlyContinue
  if ($text -like "*/api/series*") {
    $lines = (($text -split "`n") | Select-String "/api/series" | ForEach-Object { $_.Line.Trim() }) -join " | "
    $seriesMatches += [pscustomobject]@{
      File = $f.FullName.Replace($root + "\", "")
      Lines = $lines
    }
  }
}

$frontendReport = Join-Path $out "frontend-series-fetches.txt"
$seriesMatches | Format-List | Out-String | Set-Content -Path $frontendReport -Encoding UTF8

# Likely frontend/API query shapes.
$tests = @(
  @{ Name="series-default"; Url="/api/series" },
  @{ Name="series-page0-limit12"; Url="/api/series?page=0&limit=12" },
  @{ Name="series-page0-limit24"; Url="/api/series?page=0&limit=24" },
  @{ Name="series-page0-limit50"; Url="/api/series?page=0&limit=50" },
  @{ Name="series-page0-limit72"; Url="/api/series?page=0&limit=72" },
  @{ Name="series-page0-limit100"; Url="/api/series?page=0&limit=100" },
  @{ Name="series-page1-limit100"; Url="/api/series?page=1&limit=100" },
  @{ Name="series-page2-limit100"; Url="/api/series?page=2&limit=100" }
)

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

$csv = Join-Path $out "series-param-parity.csv"
$txt = Join-Path $out "series-param-parity-report.txt"

$rows | Export-Csv -NoTypeInformation -Path $csv -Encoding UTF8

$report = @()
$report += "StreamVault Haskell Series Param Parity Audit"
$report += "================================================"
$report += ""
$report += "Frontend /api/series usage found in:"
$report += ""
$report += (Get-Content $frontendReport -Raw)
$report += ""
$report += "Node vs Haskell shadow byte comparison:"
$report += ""
$report += ($rows | Format-Table -AutoSize | Out-String)
$report += ""
$report += "Rule:"
$report += "- exact/near exact = safe candidate for frontend shadow"
$report += "- mismatch = keep on Node until Haskell generator/router is fixed"
$report += ""
$report += "No production server/frontend/playback was changed."
$report -join "`r`n" | Set-Content -Path $txt -Encoding UTF8

$toolDir = Join-Path $root "tools\haskell-series-param-audit"
New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
Copy-Item $MyInvocation.MyCommand.Path (Join-Path $toolDir "run-series-param-audit.ps1") -Force

Write-Host ""
Write-Host "Reports:"
Write-Host "  $txt"
Write-Host "  $csv"
Write-Host "  $frontendReport"

Write-Host ""
Write-Host "Committing audit tool only..."
git add -- "tools/haskell-series-param-audit/run-series-param-audit.ps1" | Out-Host
git commit -m "Add Haskell series param parity audit" | Out-Host

Write-Host ""
Write-Host "Pushing branch..."
git push -u origin test-haskell-series-param-audit | Out-Host

Write-Host ""
Write-Host "DONE."
Write-Host "Open report:"
Write-Host "notepad `"$txt`""
