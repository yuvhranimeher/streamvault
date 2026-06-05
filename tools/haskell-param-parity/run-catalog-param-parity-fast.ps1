param(
  [string]$NodeBase = "http://127.0.0.1:3000",
  [string]$HaskellBase = "http://127.0.0.1:3031",
  [int]$TimeoutMs = 20000
)

$ErrorActionPreference = "Stop"

function Find-StreamVaultRoot {
  $p = (Get-Location).Path
  while ($p -and $p.Length -gt 3) {
    if ((Test-Path (Join-Path $p "package.json")) -and (Test-Path (Join-Path $p "server.js"))) {
      return (Resolve-Path $p).Path
    }
    $p = Split-Path $p -Parent
  }
  throw "Run this from inside the StreamVault project folder."
}

function Join-SvUrl([string]$Base, [string]$Path) {
  return $Base.TrimEnd("/") + $Path
}

function HeaderValue($Headers, [string]$Name) {
  foreach ($key in $Headers.Keys) {
    if ([string]::Equals([string]$key, $Name, [System.StringComparison]::OrdinalIgnoreCase)) {
      return [string]($Headers[$key] -join ",")
    }
  }
  return ""
}

function Get-RootHintFromText([string]$Content) {
  if ($null -eq $Content) { return "non-json" }
  $trimmed = $Content.TrimStart()
  if ($trimmed.StartsWith("[")) { return "array" }
  if ($trimmed.StartsWith("{")) { return "object" }
  if ($trimmed.Length -eq 0) { return "empty" }
  return "non-json"
}

function Invoke-JsonEndpoint([string]$Base, [string]$Path, [bool]$ParseJson = $true) {
  $timeoutSec = [Math]::Max(1, [Math]::Ceiling($TimeoutMs / 1000))
  $url = Join-SvUrl $Base $Path
  $started = Get-Date
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec
    $elapsed = [int]((Get-Date) - $started).TotalMilliseconds
    $json = $null
    if ($ParseJson) {
      try { $json = $response.Content | ConvertFrom-Json } catch {}
    }
    return [pscustomobject]@{
      Ok = $true
      Url = $url
      Status = [int]$response.StatusCode
      Ms = $elapsed
      Bytes = [Text.Encoding]::UTF8.GetByteCount([string]$response.Content)
      Marker = HeaderValue $response.Headers "X-StreamVault-Haskell"
      Json = $json
      RootHint = Get-RootHintFromText ([string]$response.Content)
      Error = ""
    }
  } catch {
    $elapsed = [int]((Get-Date) - $started).TotalMilliseconds
    return [pscustomobject]@{
      Ok = $false
      Url = $url
      Status = 0
      Ms = $elapsed
      Bytes = 0
      Marker = ""
      Json = $null
      RootHint = "fetch-failed"
      Error = $_.Exception.Message
    }
  }
}

function Invoke-SummaryEndpoint([string]$Base, [string]$Path, [string]$ExpectedRoot) {
  $timeoutSec = [Math]::Max(1, [Math]::Ceiling($TimeoutMs / 1000))
  $url = Join-SvUrl $Base $Path
  $headersFile = [System.IO.Path]::GetTempFileName()
  $started = Get-Date
  try {
    $curlOutput = & curl.exe -sS --max-time $timeoutSec -D $headersFile -o NUL -w "status=%{http_code} bytes=%{size_download} time=%{time_total}" $url 2>&1
    $elapsed = [int]((Get-Date) - $started).TotalMilliseconds
    if ($LASTEXITCODE -ne 0) {
      return [pscustomobject]@{
        Ok = $false
        Url = $url
        Status = 0
        Ms = $elapsed
        Bytes = 0
        Marker = ""
        Json = $null
        RootHint = "fetch-failed"
        Error = [string]$curlOutput
      }
    }

    $status = 0
    $bytes = 0
    $statusMatch = [regex]::Match([string]$curlOutput, "status=(\d+)")
    if ($statusMatch.Success) { $status = [int]$statusMatch.Groups[1].Value }
    $bytesMatch = [regex]::Match([string]$curlOutput, "bytes=([0-9.]+)")
    if ($bytesMatch.Success) { $bytes = [int64][double]$bytesMatch.Groups[1].Value }
    $headers = if (Test-Path $headersFile) { Get-Content -LiteralPath $headersFile -Raw } else { "" }
    $marker = ""
    $markerMatch = [regex]::Match($headers, "(?im)^x-streamvault-haskell:\s*(.+?)\s*$")
    if ($markerMatch.Success) { $marker = $markerMatch.Groups[1].Value.Trim() }

    return [pscustomobject]@{
      Ok = $true
      Url = $url
      Status = $status
      Ms = $elapsed
      Bytes = $bytes
      Marker = $marker
      Json = $null
      RootHint = $ExpectedRoot
      Error = ""
    }
  } catch {
    $elapsed = [int]((Get-Date) - $started).TotalMilliseconds
    return [pscustomobject]@{
      Ok = $false
      Url = $url
      Status = 0
      Ms = $elapsed
      Bytes = 0
      Marker = ""
      Json = $null
      RootHint = "fetch-failed"
      Error = $_.Exception.Message
    }
  } finally {
    Remove-Item -LiteralPath $headersFile -Force -ErrorAction SilentlyContinue
  }
}

function Test-SvTcpBase([string]$Base, [int]$RequestTimeoutMs) {
  $uri = [Uri]$Base
  $port = $uri.Port
  if ($port -le 0) {
    $port = if ($uri.Scheme -eq "https") { 443 } else { 80 }
  }
  $client = New-Object System.Net.Sockets.TcpClient
  $async = $client.BeginConnect($uri.Host, $port, $null, $null)
  try {
    if (-not $async.AsyncWaitHandle.WaitOne($RequestTimeoutMs, $false)) {
      return $false
    }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $async.AsyncWaitHandle.Close()
    $client.Close()
  }
}

function Get-Prop($Obj, [string]$Name) {
  if ($null -eq $Obj) { return $null }
  $prop = $Obj.PSObject.Properties[$Name]
  if ($prop) { return $prop.Value }
  return $null
}

function Get-Keys($Obj) {
  if ($null -eq $Obj) { return @() }
  return @($Obj.PSObject.Properties.Name | Sort-Object)
}

function Test-SameList($A, $B) {
  $left = @($A)
  $right = @($B)
  if ($left.Count -ne $right.Count) { return $false }
  for ($i = 0; $i -lt $left.Count; $i++) {
    if ([string]$left[$i] -ne [string]$right[$i]) { return $false }
  }
  return $true
}

function Test-Truthy($Value) {
  return -not ($null -eq $Value -or $Value -eq "" -or $Value -eq $false)
}

function Get-RootKind($Json) {
  if ($null -eq $Json) { return "non-json" }
  if ($Json -is [array]) { return "array" }
  if ($Json -is [pscustomobject]) { return "object" }
  return $Json.GetType().Name.ToLowerInvariant()
}

function Get-ArrayForCase($Json, $Case) {
  if ($null -eq $Json) { return @() }
  if ($Case.ArrayKey -eq "__root") {
    return @($Json)
  }
  $value = Get-Prop $Json $Case.ArrayKey
  if ($null -eq $value) { return @() }
  return @($value)
}

function Get-ItemArrayKey($Json, $Case) {
  if ($Case.ArrayKey -eq "__root") { return "__root" }
  if ($null -eq (Get-Prop $Json $Case.ArrayKey)) { return "" }
  return $Case.ArrayKey
}

function Get-ItemType($Item) {
  $type = Get-Prop $Item "type"
  if ($type) { return [string]$type }
  if ((Get-Prop $Item "_isSeries") -or (Get-Prop $Item "seasons")) { return "series" }
  return ""
}

function Get-ItemIdentity($Item) {
  if ($null -eq $Item) { return $null }
  $name = Get-Prop $Item "name"
  if (-not $name) { $name = Get-Prop $Item "title" }
  return [pscustomobject][ordered]@{
    name = $name
    title = Get-Prop $Item "title"
    id = Get-Prop $Item "id"
    tmdbId = Get-Prop $Item "tmdbId"
    year = Get-Prop $Item "year"
    type = Get-ItemType $Item
    poster = Test-Truthy (Get-Prop $Item "poster")
    backdrop = Test-Truthy (Get-Prop $Item "backdrop")
  }
}

function ShapeKey($Value) {
  return ($Value | ConvertTo-Json -Depth 10 -Compress)
}

function New-CatalogCase([string]$Name, [string]$Path, [string]$Kind, [string]$ArrayKey, [string]$Marker, [bool]$SummaryOnly = $false) {
  return [pscustomobject]@{
    Name = $Name
    Path = $Path
    Kind = $Kind
    ArrayKey = $ArrayKey
    Marker = $Marker
    SummaryOnly = $SummaryOnly
  }
}

function Compare-CatalogCase($Case, $Node, $Haskell) {
  $diffs = New-Object System.Collections.Generic.List[string]
  $warnings = New-Object System.Collections.Generic.List[string]

  if (-not $Node.Ok) { $diffs.Add("Node fetch failed: $($Node.Error)") }
  if (-not $Haskell.Ok) { $diffs.Add("Haskell fetch failed: $($Haskell.Error)") }
  if ($Node.Ok -and $Haskell.Ok -and $Node.Status -ne $Haskell.Status) {
    $diffs.Add("status $($Haskell.Status) != $($Node.Status)")
  }
  if ($Haskell.Ok -and $Case.Marker -and $Haskell.Marker -ne $Case.Marker) {
    $diffs.Add("Haskell marker $($Haskell.Marker) != $($Case.Marker)")
  }

  $nodeJson = $Node.Json
  $haskellJson = $Haskell.Json
  $nodeRoot = if ($null -eq $nodeJson) { $Node.RootHint } else { Get-RootKind $nodeJson }
  $haskellRoot = if ($null -eq $haskellJson) { $Haskell.RootHint } else { Get-RootKind $haskellJson }
  if ($nodeRoot -ne $haskellRoot) {
    $diffs.Add("root $haskellRoot != $nodeRoot")
  }

  $nodeKeys = @()
  $haskellKeys = @()
  if ($nodeRoot -eq "object" -and $haskellRoot -eq "object") {
    $nodeKeys = Get-Keys $nodeJson
    $haskellKeys = Get-Keys $haskellJson
    if (-not (Test-SameList $nodeKeys $haskellKeys)) {
      $diffs.Add("response keys $($haskellKeys -join ',') != $($nodeKeys -join ',')")
    }

    foreach ($key in @("page", "total", "pages", "ok")) {
      $nodeValue = Get-Prop $nodeJson $key
      $haskellValue = Get-Prop $haskellJson $key
      if ($nodeValue -ne $haskellValue) {
        $diffs.Add("$key $haskellValue != $nodeValue")
      }
    }

    $nodeArrayKey = Get-ItemArrayKey $nodeJson $Case
    $haskellArrayKey = Get-ItemArrayKey $haskellJson $Case
    if ($nodeArrayKey -ne $haskellArrayKey) {
      $diffs.Add("item array key $haskellArrayKey != $nodeArrayKey")
    }
  }

  $nodeItems = @()
  $haskellItems = @()
  if (-not $Case.SummaryOnly) {
    $nodeItems = @(Get-ArrayForCase $nodeJson $Case)
    $haskellItems = @(Get-ArrayForCase $haskellJson $Case)
    if ($nodeItems.Count -ne $haskellItems.Count) {
      $diffs.Add("item count $($haskellItems.Count) != $($nodeItems.Count)")
    }

    $nodeFirst = @($nodeItems | Select-Object -First 12 | ForEach-Object { Get-ItemIdentity $_ })
    $haskellFirst = @($haskellItems | Select-Object -First 12 | ForEach-Object { Get-ItemIdentity $_ })
    if (-not (Test-SameList (@($nodeFirst | ForEach-Object { ShapeKey $_ })) (@($haskellFirst | ForEach-Object { ShapeKey $_ })))) {
      $diffs.Add("first 12 item identities differ")
      $warnings.Add("node first12=$((ShapeKey $nodeFirst))")
      $warnings.Add("haskell first12=$((ShapeKey $haskellFirst))")
    }

    $nodeItemKeys = @()
    $haskellItemKeys = @()
    if ($nodeItems.Count -gt 0) {
      $nodeItemKeys = @(Get-Keys $nodeItems[0] | Where-Object { -not $_.StartsWith("_") })
    }
    if ($haskellItems.Count -gt 0) {
      $haskellItemKeys = @(Get-Keys $haskellItems[0] | Where-Object { -not $_.StartsWith("_") })
    }
    if (-not (Test-SameList $nodeItemKeys $haskellItemKeys)) {
      $warnings.Add("first item keys $($haskellItemKeys -join ',') != $($nodeItemKeys -join ',')")
    }
  } else {
    $warnings.Add("summary-only default check: status, marker, expected root shape, and byte count only")
  }

  if ($Case.Kind -eq "home-feed" -and $nodeRoot -eq "object" -and $haskellRoot -eq "object") {
    $nodeRows = @(Get-Prop $nodeJson "rows")
    $haskellRows = @(Get-Prop $haskellJson "rows")
    if ($nodeRows.Count -ne $haskellRows.Count) {
      $diffs.Add("row count $($haskellRows.Count) != $($nodeRows.Count)")
    }
    $nodeRowShape = @($nodeRows | ForEach-Object {
      [pscustomobject][ordered]@{
        rowId = Get-Prop $_ "rowId"
        sectionKey = Get-Prop $_ "sectionKey"
        itemCount = @((Get-Prop $_ "items")).Count
      }
    })
    $haskellRowShape = @($haskellRows | ForEach-Object {
      [pscustomobject][ordered]@{
        rowId = Get-Prop $_ "rowId"
        sectionKey = Get-Prop $_ "sectionKey"
        itemCount = @((Get-Prop $_ "items")).Count
      }
    })
    if (-not (Test-SameList (@($nodeRowShape | ForEach-Object { ShapeKey $_ })) (@($haskellRowShape | ForEach-Object { ShapeKey $_ })))) {
      $diffs.Add("home-feed row compatibility differs")
    }
  }

  return [pscustomobject]@{
    Name = $Case.Name
    Path = $Case.Path
    Kind = $Case.Kind
    Pass = ($diffs.Count -eq 0)
    Diffs = @($diffs.ToArray())
    Warnings = @($warnings.ToArray())
    Node = [pscustomobject]@{
      Status = $Node.Status
      Ms = $Node.Ms
      Bytes = $Node.Bytes
      Root = $nodeRoot
      Keys = $nodeKeys
      Count = $nodeItems.Count
    }
    Haskell = [pscustomobject]@{
      Status = $Haskell.Status
      Ms = $Haskell.Ms
      Bytes = $Haskell.Bytes
      Marker = $Haskell.Marker
      Root = $haskellRoot
      Keys = $haskellKeys
      Count = $haskellItems.Count
    }
  }
}

function Render-Report($Summary) {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("StreamVault Haskell Catalog Parameter Fast Parity Report")
  $lines.Add("=======================================================")
  $lines.Add("Generated: $($Summary.GeneratedAt)")
  $lines.Add("Node:      $($Summary.NodeBase)")
  $lines.Add("Haskell:   $($Summary.HaskellBase)")
  $lines.Add("Timeout:   $($Summary.TimeoutMs)ms")
  $lines.Add("Home-feed: audited in CATALOG_PARAM_PARITY_NOTES.md; skipped by this fast runner because Node primary home-feed can exceed the fast timeout.")
  $lines.Add("Result:    $($Summary.Passed) passed, $($Summary.Failed) failed")
  $lines.Add("")
  foreach ($row in $Summary.Rows) {
    $lines.Add("$(if ($row.Pass) { 'PASS' } else { 'FAIL' }) $($row.Name) $($row.Path)")
    $lines.Add("  node:    status=$($row.Node.Status) root=$($row.Node.Root) count=$($row.Node.Count) bytes=$($row.Node.Bytes) ms=$($row.Node.Ms)")
    $lines.Add("  haskell: status=$($row.Haskell.Status) root=$($row.Haskell.Root) count=$($row.Haskell.Count) bytes=$($row.Haskell.Bytes) ms=$($row.Haskell.Ms) marker=$($row.Haskell.Marker)")
    foreach ($diff in $row.Diffs) { $lines.Add("  - $diff") }
    foreach ($warning in $row.Warnings) { $lines.Add("  ! $warning") }
  }
  $lines.Add("")
  $lines.Add("Report: $($Summary.ReportPath)")
  return ($lines -join [Environment]::NewLine)
}

$Root = Find-StreamVaultRoot
Set-Location $Root

$OutDir = Join-Path $Root "tools\haskell-parity\out"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$ReportPath = Join-Path $OutDir "catalog-param-fast-report.txt"
$ProgressPath = Join-Path $OutDir "catalog-param-fast-progress.txt"
"Catalog parameter fast parity progress $(Get-Date -Format o)" | Set-Content -LiteralPath $ProgressPath -Encoding UTF8

$NodeBase = $NodeBase.TrimEnd("/")
$HaskellBase = $HaskellBase.TrimEnd("/")

Write-Host "Checking Node at $NodeBase."
if (-not (Test-SvTcpBase $NodeBase ([Math]::Min($TimeoutMs, 5000)))) {
  throw "Node is not reachable at $NodeBase. Start the Node server on port 3000 first."
}

Write-Host "Checking Haskell at $HaskellBase."
if (-not (Test-SvTcpBase $HaskellBase ([Math]::Min($TimeoutMs, 5000)))) {
  throw "Haskell is not reachable at $HaskellBase. Start the Haskell backend on port 3031 first."
}

$cases = @(
  New-CatalogCase "movies-default" "/api/movies" "movies" "movies" "native-movies"
  New-CatalogCase "movies-page0-limit12" "/api/movies?page=0&limit=12" "movies" "movies" "native-movies"
  New-CatalogCase "movies-page1-limit12" "/api/movies?page=1&limit=12" "movies" "movies" "native-movies"
  New-CatalogCase "movies-page0-limit24" "/api/movies?page=0&limit=24" "movies" "movies" "native-movies"
  New-CatalogCase "movies-page1-limit100" "/api/movies?page=1&limit=100" "movies" "movies" "native-movies"
  New-CatalogCase "movies-invalid-limit-fallback" "/api/movies?page=0&limit=0" "movies" "movies" "native-movies"

  New-CatalogCase "series-default" "/api/series" "series" "__root" "native-series" $true
  New-CatalogCase "series-limit24-default-array" "/api/series?limit=24" "series" "__root" "native-series"
  New-CatalogCase "series-page0-limit12" "/api/series?page=0&limit=12" "series" "series" "native-series"
  New-CatalogCase "series-page1-limit12" "/api/series?page=1&limit=12" "series" "series" "native-series"
  New-CatalogCase "series-page0-limit24" "/api/series?page=0&limit=24" "series" "series" "native-series"
  New-CatalogCase "series-page1-limit100" "/api/series?page=1&limit=100" "series" "series" "native-series"
  New-CatalogCase "series-invalid-limit-fallback" "/api/series?page=0&limit=0" "series" "series" "native-series"

  New-CatalogCase "section-netflix" "/api/section/netflix?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-marvel" "/api/section/marvel?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-dc" "/api/section/dc?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-allMovies" "/api/section/allMovies?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-all-movies" "/api/section/all-movies?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-topRated" "/api/section/topRated?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-top-rated" "/api/section/top-rated?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-anime" "/api/section/anime?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-koreanDrama" "/api/section/koreanDrama?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-horrorNights" "/api/section/horrorNights?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-cyberpunkScifi" "/api/section/cyberpunkScifi?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-trending" "/api/section/trending?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-new" "/api/section/new?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-series" "/api/section/series?page=0&limit=12" "section" "items" "native-section"
  New-CatalogCase "section-invalid-limit-fallback" "/api/section/netflix?page=0&limit=0" "section" "items" "native-section"
)

$rows = New-Object System.Collections.Generic.List[object]
foreach ($case in $cases) {
  Add-Content -LiteralPath $ProgressPath -Value "START $($case.Name) $($case.Path)"
  $expectedRoot = if ($case.ArrayKey -eq "__root") { "array" } else { "object" }
  $node = if ($case.SummaryOnly) { Invoke-SummaryEndpoint $NodeBase $case.Path $expectedRoot } else { Invoke-JsonEndpoint $NodeBase $case.Path $true }
  Add-Content -LiteralPath $ProgressPath -Value "NODE_DONE $($case.Name) status=$($node.Status) ms=$($node.Ms) bytes=$($node.Bytes)"
  $haskell = if ($case.SummaryOnly) { Invoke-SummaryEndpoint $HaskellBase $case.Path $expectedRoot } else { Invoke-JsonEndpoint $HaskellBase $case.Path $true }
  Add-Content -LiteralPath $ProgressPath -Value "HASKELL_DONE $($case.Name) status=$($haskell.Status) ms=$($haskell.Ms) bytes=$($haskell.Bytes)"
  $row = Compare-CatalogCase $case $node $haskell
  Add-Content -LiteralPath $ProgressPath -Value "COMPARE_DONE $($case.Name) pass=$($row.Pass)"
  $rows.Add($row)
  $status = if ($row.Pass) { "PASS" } else { "FAIL" }
  Write-Host ("{0} {1} node={2}ms haskell={3}ms" -f $status, $case.Path, $row.Node.Ms, $row.Haskell.Ms)
}

$passed = @($rows | Where-Object { $_.Pass }).Count
$failed = @($rows | Where-Object { -not $_.Pass }).Count
$summary = [pscustomobject]@{
  GeneratedAt = (Get-Date).ToUniversalTime().ToString("o")
  NodeBase = $NodeBase
  HaskellBase = $HaskellBase
  TimeoutMs = $TimeoutMs
  Passed = $passed
  Failed = $failed
  Rows = @($rows.ToArray())
  ReportPath = $ReportPath
}

$report = Render-Report $summary
$report | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Host ""
Write-Host $report

if ($failed -ne 0) {
  exit 1
}
