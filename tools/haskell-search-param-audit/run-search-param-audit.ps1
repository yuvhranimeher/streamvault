# StreamVault Haskell Search Frontend Param Audit
# Safe: no frontend/server/playback changes.
# Purpose:
# - Find /api/search usages in frontend.
# - Compare Node API on 3000 vs Haskell shadow API on 3031.
# - Decide what Haskell search fixtures/routes must be expanded.

$ErrorActionPreference = "Stop"

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
if (!(Test-Path $root)) { throw "Project root not found: $root" }
Set-Location $root

Write-Host "== StreamVault Haskell Search Param Audit =="
Write-Host "Project root: $root"

git checkout -B test-haskell-search-param-audit | Out-Host

$out = Join-Path $root "tools\haskell-search-param-audit\out"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$frontendFiles = Get-ChildItem -Path $root -Recurse -File -Include *.js,*.html |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\.git\\|\\tools\\" }

$searchMatches = @()

foreach ($f in $frontendFiles) {
  $text = Get-Content -Path $f.FullName -Raw -ErrorAction SilentlyContinue
  if ($text -like "*/api/search*") {
    $lines = (($text -split "`n") | Select-String "/api/search" | ForEach-Object { $_.Line.Trim() }) -join " | "
    $searchMatches += [pscustomobject]@{
      File = $f.FullName.Replace($root + "\", "")
      Lines = $lines
    }
  }
}

$frontendReport = Join-Path $out "frontend-search-fetches.txt"
$searchMatches | Format-List | Out-String | Set-Content -Path $frontendReport -Encoding UTF8

$tests = @(
  @{ Name="search-netflix-limit12"; Url="/api/search?q=netflix&limit=12" },
  @{ Name="search-dark-limit12"; Url="/api/search?q=dark&limit=12" },
  @{ Name="search-spider-limit12"; Url="/api/search?q=spider&limit=12" },
  @{ Name="search-hindi-limit12"; Url="/api/search?q=hindi&limit=12" },
  @{ Name="search-korean-limit12"; Url="/api/search?q=korean&limit=12" },
  @{ Name="search-netflix"; Url="/api/search?q=netflix" },
  @{ Name="search-dark"; Url="/api/search?q=dark" },
  @{ Name="search-spider"; Url="/api/search?q=spider" },
  @{ Name="search-query-netflix"; Url="/api/search?query=netflix" },
  @{ Name="search-empty"; Url="/api/search" }
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

$csv = Join-Path $out "search-param-parity.csv"
$txt = Join-Path $out "search-param-parity-report.txt"

$rows | Export-Csv -NoTypeInformation -Path $csv -Encoding UTF8

$report = @()
$report += "StreamVault Haskell Search Param Parity Audit"
$report += "=============================================="
$report += ""
$report += "Frontend /api/search usage found in:"
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

$toolDir = Join-Path $root "tools\haskell-search-param-audit"
New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
Copy-Item $MyInvocation.MyCommand.Path (Join-Path $toolDir "run-search-param-audit.ps1") -Force

Write-Host ""
Write-Host "Reports:"
Write-Host "  $txt"
Write-Host "  $csv"
Write-Host "  $frontendReport"

Write-Host ""
Write-Host "Committing audit tool only..."
git add -- "tools/haskell-search-param-audit/run-search-param-audit.ps1" | Out-Host
git commit -m "Add Haskell search param parity audit" | Out-Host

Write-Host ""
Write-Host "Pushing branch..."
git push -u origin test-haskell-search-param-audit | Out-Host

Write-Host ""
Write-Host "DONE."
Write-Host "Open report:"
Write-Host "notepad `"$txt`""
