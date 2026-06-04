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

function HeaderValue($Headers, [string]$Name) {
  foreach ($key in $Headers.Keys) {
    if ([string]::Equals([string]$key, $Name, [System.StringComparison]::OrdinalIgnoreCase)) {
      return [string]($Headers[$key] -join ",")
    }
  }
  return ""
}

function Invoke-JsonEndpoint([string]$Base, [string]$Path, $Headers) {
  $timeoutSec = [Math]::Max(1, [Math]::Ceiling($TimeoutMs / 1000))
  $url = $Base.TrimEnd("/") + $Path
  $started = Get-Date
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec -Headers $Headers
    $elapsed = [int]((Get-Date) - $started).TotalMilliseconds
    $json = $null
    try { $json = $response.Content | ConvertFrom-Json } catch {}
    return [pscustomobject]@{
      Ok = $true
      Url = $url
      Status = [int]$response.StatusCode
      Ms = $elapsed
      Bytes = [Text.Encoding]::UTF8.GetByteCount([string]$response.Content)
      Marker = HeaderValue $response.Headers "X-StreamVault-Haskell"
      DetailsMarker = HeaderValue $response.Headers "X-StreamVault-Haskell-Details"
      Json = $json
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
      DetailsMarker = ""
      Json = $null
      Error = $_.Exception.Message
    }
  }
}

function JsonField($Json, [string]$Name) {
  if ($null -eq $Json) { return $null }
  $prop = $Json.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $null }
  return $prop.Value
}

function ArrayCount($Json, [string]$Name) {
  $value = JsonField $Json $Name
  if ($null -eq $value) { return $null }
  if ($value -is [array]) { return @($value).Count }
  return $null
}

function ValueKind($Value) {
  if ($null -eq $Value) { return "null" }
  if ($Value -is [array]) { return "array" }
  if ($Value -is [pscustomobject]) { return "object" }
  return $Value.GetType().Name.ToLowerInvariant()
}

function DetailsShape($Json) {
  if ($null -eq $Json) { return [ordered]@{ root = "non-json" } }
  $title = JsonField $Json "title"
  if (-not $title) { $title = JsonField $Json "name" }
  return [ordered]@{
    ok = JsonField $Json "ok"
    type = JsonField $Json "type"
    title = $title
    year = JsonField $Json "year"
    poster = [bool](JsonField $Json "poster")
    backdrop = [bool](JsonField $Json "backdrop")
    overview = [bool](JsonField $Json "overview")
    trailers = ArrayCount $Json "trailers"
    cast = ArrayCount $Json "cast"
    crew = ArrayCount $Json "crew"
    similar = ArrayCount $Json "similar"
    episodesKind = ValueKind (JsonField $Json "episodes")
  }
}

function ShapeKey($Shape) {
  return ($Shape | ConvertTo-Json -Depth 8 -Compress)
}

$Root = Find-StreamVaultRoot
Set-Location $Root

$OutDir = Join-Path $Root "tools/haskell-parity/out"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$ReportPath = Join-Path $OutDir "details-shadow-fast-report.txt"

$ReadOnlyHeaders = @{
  "x-streamvault-shadow-bypass" = "1"
  "x-streamvault-details-shadow" = "1"
}

$Lines = New-Object System.Collections.Generic.List[string]
$Failures = 0

$Lines.Add("StreamVault Details Shadow Fast Report")
$Lines.Add("=====================================")
$Lines.Add("Generated: $(Get-Date -Format o)")
$Lines.Add("Node:      $NodeBase")
$Lines.Add("Haskell:   $HaskellBase")
$Lines.Add("Timeout:   ${TimeoutMs}ms")
$Lines.Add("")

$nodeHealth = Invoke-JsonEndpoint $NodeBase "/api/version" $ReadOnlyHeaders
$haskellHealth = Invoke-JsonEndpoint $HaskellBase "/__haskell-health" @{}
if (-not $nodeHealth.Ok) { throw "Node 3000 is required: $($nodeHealth.Error)" }
if (-not $haskellHealth.Ok) { throw "Haskell 3031 is required: $($haskellHealth.Error)" }

$HitTests = @(
  @{ Name = "hit-man-of-steel"; Path = "/api/details/movie/Man%20of%20Steel?title=Man%20of%20Steel&year=2013" },
  @{ Name = "hit-the-boys"; Path = "/api/details/tv/76479?title=The%20Boys&year=2019&tmdbId=76479" },
  @{ Name = "hit-pirates"; Path = "/api/details/movie/Pirates%20of%20the%20Caribbean-Dead%20Men%20Tell%20No%20Tales?title=Pirates%20of%20the%20Caribbean-Dead%20Men%20Tell%20No%20Tales&year=2017" },
  @{ Name = "hit-extraction"; Path = "/api/details/movie/Extraction?title=Extraction&year=2020" },
  @{ Name = "hit-dark-knight"; Path = "/api/details/movie/The%20Dark%20Knight?title=The%20Dark%20Knight&year=2008" }
)

$MissTests = @(
  @{ Name = "miss-greenland-migration"; Path = "/api/details/movie/Greenland%202-Migration?title=Greenland%202-Migration&year=2026" },
  @{ Name = "miss-strangers-chapter-3"; Path = "/api/details/movie/The%20Strangers-Chapter%203?title=The%20Strangers-Chapter%203&year=2026" },
  @{ Name = "miss-a-knight-seven-kingdoms"; Path = "/api/details/tv/A%20Knight%20of%20the%20Seven%20Kingdoms?title=A%20Knight%20of%20the%20Seven%20Kingdoms&year=2026" }
)

foreach ($test in $HitTests) {
  $haskell = Invoke-JsonEndpoint $HaskellBase $test.Path @{}
  $pass = $haskell.Ok -and $haskell.Status -eq 200 -and $haskell.Marker -eq "native-details-cache" -and (JsonField $haskell.Json "ok") -eq $true -and (JsonField $haskell.Json "localOnly") -eq $false
  if (-not $pass) { $Failures++ }
  $statusText = if ($pass) { "PASS" } else { "FAIL" }
  $Lines.Add(("{0} {1}" -f $statusText, $test.Name))
  $Lines.Add("  haskell status=$($haskell.Status) marker=$($haskell.Marker) ms=$($haskell.Ms)")
  if (-not $pass -and $haskell.Error) { $Lines.Add("  error=$($haskell.Error)") }
}

foreach ($test in $MissTests) {
  $node = Invoke-JsonEndpoint $NodeBase $test.Path $ReadOnlyHeaders
  $haskell = Invoke-JsonEndpoint $HaskellBase $test.Path $ReadOnlyHeaders
  $nodeShape = DetailsShape $node.Json
  $haskellShape = DetailsShape $haskell.Json
  $marker = if ($haskell.DetailsMarker) { $haskell.DetailsMarker } else { $haskell.Marker }
  $pass = $node.Ok -and $haskell.Ok -and $node.Status -eq $haskell.Status -and $marker -eq "proxy-cache-miss" -and (ShapeKey $nodeShape) -eq (ShapeKey $haskellShape)
  if (-not $pass) { $Failures++ }
  $statusText = if ($pass) { "PASS" } else { "FAIL" }
  $Lines.Add(("{0} {1}" -f $statusText, $test.Name))
  $Lines.Add("  node    status=$($node.Status) ms=$($node.Ms)")
  $Lines.Add("  haskell status=$($haskell.Status) marker=$marker ms=$($haskell.Ms)")
  if (-not $pass) {
    $Lines.Add("  nodeShape=$((ShapeKey $nodeShape))")
    $Lines.Add("  haskellShape=$((ShapeKey $haskellShape))")
    if ($node.Error) { $Lines.Add("  nodeError=$($node.Error)") }
    if ($haskell.Error) { $Lines.Add("  haskellError=$($haskell.Error)") }
  }
}

$debugPath = "/__haskell-details-shadow-debug?type=movie&id=Greenland%202-Migration&title=Greenland%202-Migration&year=2026"
$debug = Invoke-JsonEndpoint $HaskellBase $debugPath @{}
$debugResult = JsonField $debug.Json "result"
$debugPass = $debug.Ok -and $debug.Status -eq 200 -and $debug.Marker -eq "details-shadow-debug" -and $debugResult -eq "proxy-cache-miss"
if (-not $debugPass) { $Failures++ }
$statusText = if ($debugPass) { "PASS" } else { "FAIL" }
$Lines.Add(("{0} diagnostic-debug-miss" -f $statusText))
$Lines.Add("  haskell status=$($debug.Status) marker=$($debug.Marker) result=$debugResult ms=$($debug.Ms)")

$Lines.Add("")
$Lines.Add("Result: $([int]($HitTests.Count + $MissTests.Count + 1 - $Failures)) passed, $Failures failed")
$Lines.Add("Report: $ReportPath")

$Lines | Set-Content -LiteralPath $ReportPath -Encoding UTF8
$Lines | ForEach-Object { Write-Host $_ }

if ($Failures -gt 0) {
  exit 1
}
