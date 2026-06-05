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
      MetadataMarker = HeaderValue $response.Headers "X-StreamVault-Haskell-Metadata"
      Json = $json
      Content = [string]$response.Content
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
      MetadataMarker = ""
      Json = $null
      Content = ""
      Error = $_.Exception.Message
    }
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

function Get-ArrayCount($Obj, [string]$Name) {
  $value = Get-Prop $Obj $Name
  if ($null -eq $value) { return 0 }
  if ($value -is [System.Array]) { return @($value).Count }
  return 0
}

function Get-ValueKind($Value) {
  if ($null -eq $Value) { return "null" }
  if ($Value -is [System.Array]) { return "array" }
  if ($Value -is [pscustomobject]) { return "object" }
  return $Value.GetType().Name.ToLowerInvariant()
}

function ShapeKey($Shape) {
  return ($Shape | ConvertTo-Json -Depth 8 -Compress)
}

function Test-NonEmptyArray($Obj, [string]$Name) {
  $value = Get-Prop $Obj $Name
  if ($null -eq $value) { return $false }
  return @($value).Count -gt 0
}

function Test-ExtendedTitleDetails($Obj) {
  foreach ($name in @("trailers", "cast", "crew", "productionCompanies", "similar", "moreByDirector")) {
    if (Test-NonEmptyArray $Obj $name) { return $true }
  }
  return $false
}

function Get-DetailEntryData($Entry) {
  $data = Get-Prop $Entry "data"
  if ($null -ne $data) { return $data }
  return $Entry
}

function Split-DetailCacheKey([string]$Key) {
  $m = [regex]::Match($Key, "^(movie|tv|series):(.+)$")
  if (-not $m.Success) { return $null }
  $media = $m.Groups[1].Value
  $rest = $m.Groups[2].Value
  $year = ""
  $ym = [regex]::Match($rest, "^(.*):((?:19|20)\d{2})$")
  if ($ym.Success) {
    $rest = $ym.Groups[1].Value
    $year = $ym.Groups[2].Value
  }
  return [pscustomobject]@{
    Media = if ($media -eq "series") { "tv" } else { $media }
    Ident = $rest
    Year = $year
  }
}

function UrlParam([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  return "$Name=$([Uri]::EscapeDataString($Value))"
}

function New-TitlePath($Fixture) {
  $parts = New-Object System.Collections.Generic.List[string]
  $parts.Add((UrlParam "type" $Fixture.Media))
  if ($Fixture.TmdbId) {
    $parts.Add((UrlParam "tmdbId" $Fixture.TmdbId))
  }
  if ($Fixture.Title) {
    $parts.Add((UrlParam "title" $Fixture.Title))
  }
  if ($Fixture.Year) {
    $parts.Add((UrlParam "year" $Fixture.Year))
  }
  return "/api/title-details?" + (($parts | Where-Object { $_ }) -join "&")
}

function Find-TitleDetailsFixture([string]$Root) {
  $cachePath = Join-Path $Root "detail-cache.json"
  if (-not (Test-Path $cachePath)) { throw "detail-cache.json is required for metadata cache-hit parity." }
  $cache = Get-Content -LiteralPath $cachePath -Raw | ConvertFrom-Json
  foreach ($prop in $cache.PSObject.Properties) {
    $parsed = Split-DetailCacheKey $prop.Name
    if ($null -eq $parsed) { continue }
    $data = Get-DetailEntryData $prop.Value
    if (-not (Test-ExtendedTitleDetails $data)) { continue }
    $title = Get-Prop $data "title"
    if (-not $title) { $title = Get-Prop $data "name" }
    $year = if ($parsed.Year) { $parsed.Year } else { [string](Get-Prop $data "year") }
    $tmdbId = ""
    if ($parsed.Ident -match "^\d+$") { $tmdbId = $parsed.Ident }
    $queryTitle = if ($tmdbId) { [string]$title } else { $parsed.Ident }
    if (-not $tmdbId -and [string]::IsNullOrWhiteSpace($queryTitle)) { continue }
    return [pscustomobject]@{
      Name = "title-details-cache-hit"
      Key = $prop.Name
      Media = $parsed.Media
      Title = $queryTitle
      Year = $year
      TmdbId = $tmdbId
    }
  }
  throw "No extended detail-cache.json entry was found for title-details cache-hit parity."
}

function Find-EpisodeTitlesFixture([string]$Root) {
  $cachePath = Join-Path $Root "episode-title-cache.json"
  if (-not (Test-Path $cachePath)) { throw "episode-title-cache.json is required for episode-title cache-hit parity." }
  $cache = Get-Content -LiteralPath $cachePath -Raw | ConvertFrom-Json
  foreach ($prop in $cache.PSObject.Properties) {
    $m = [regex]::Match($prop.Name, "^(.*)__S(\d+)$")
    if (-not $m.Success) { continue }
    $items = @($prop.Value)
    if ($items.Count -eq 0) { continue }
    return [pscustomobject]@{
      Name = "episode-titles-cache-hit"
      Key = $prop.Name
      Show = $m.Groups[1].Value
      Season = $m.Groups[2].Value
      Path = "/api/episode-titles?show=$([Uri]::EscapeDataString($m.Groups[1].Value))&season=$([Uri]::EscapeDataString($m.Groups[2].Value))"
    }
  }
  throw "No episode-title-cache.json array entry was found for episode-title cache-hit parity."
}

function TitleShape($Json) {
  if ($null -eq $Json) { return [ordered]@{ root = "non-json" } }
  return [ordered]@{
    root = Get-ValueKind $Json
    keys = Get-Keys $Json
    ok = Get-Prop $Json "ok"
    type = Get-Prop $Json "type"
    title = Get-Prop $Json "title"
    ratings = Get-ArrayCount $Json "ratings"
    trailers = Get-ArrayCount $Json "trailers"
    cast = Get-ArrayCount $Json "cast"
    crew = Get-ArrayCount $Json "crew"
    productionCompanies = Get-ArrayCount $Json "productionCompanies"
    similar = Get-ArrayCount $Json "similar"
    moreByDirector = Get-ArrayCount $Json "moreByDirector"
    playbackInfo = Get-ArrayCount $Json "playbackInfo"
  }
}

function EpisodeShape($Json) {
  if ($null -eq $Json) { return [ordered]@{ root = "non-json"; length = 0; itemKeys = @() } }
  $items = @($Json)
  $first = if ($items.Count -gt 0) { $items[0] } else { $null }
  return [ordered]@{
    root = "array"
    length = $items.Count
    itemKeys = Get-Keys $first
    firstEpisodeKind = Get-ValueKind (Get-Prop $first "episode")
    firstTitleKind = Get-ValueKind (Get-Prop $first "title")
    firstOverviewKind = Get-ValueKind (Get-Prop $first "overview")
    firstThumbKind = Get-ValueKind (Get-Prop $first "thumb")
    firstRatingKind = Get-ValueKind (Get-Prop $first "rating")
    firstAirDateKind = Get-ValueKind (Get-Prop $first "airDate")
  }
}

function Add-Result([System.Collections.Generic.List[string]]$Lines, [ref]$Failures, [string]$Name, [bool]$Pass, [string[]]$Details) {
  $statusText = if ($Pass) { "PASS" } else { "FAIL" }
  $Lines.Add(("{0} {1}" -f $statusText, $Name))
  foreach ($detail in $Details) {
    $Lines.Add("  $detail")
  }
  if (-not $Pass) {
    $Failures.Value++
  }
}

$Root = Find-StreamVaultRoot
Set-Location $Root

$OutDir = Join-Path $Root "tools/haskell-parity/out"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$ReportPath = Join-Path $OutDir "metadata-fast-report.txt"

$ReadOnlyHeaders = @{
  "x-streamvault-shadow-bypass" = "1"
  "x-streamvault-metadata-shadow" = "1"
}

$ShadowBypassHeaders = @{
  "x-streamvault-shadow-bypass" = "1"
}

$Lines = New-Object System.Collections.Generic.List[string]
$Failures = 0

$Lines.Add("StreamVault Metadata Fast Parity Report")
$Lines.Add("=======================================")
$Lines.Add("Generated: $(Get-Date -Format o)")
$Lines.Add("Node:      $NodeBase")
$Lines.Add("Haskell:   $HaskellBase")
$Lines.Add("Timeout:   ${TimeoutMs}ms")
$Lines.Add("")

$nodeHealth = Invoke-JsonEndpoint $NodeBase "/api/version" $ShadowBypassHeaders
$haskellHealth = Invoke-JsonEndpoint $HaskellBase "/__haskell-health" @{}
if (-not $nodeHealth.Ok) { throw "Node 3000 is required: $($nodeHealth.Error)" }
if (-not $haskellHealth.Ok) { throw "Haskell 3031 is required: $($haskellHealth.Error)" }

$titleFixture = Find-TitleDetailsFixture $Root
$titleHitPath = New-TitlePath $titleFixture
$episodeFixture = Find-EpisodeTitlesFixture $Root

$versionNode = Invoke-JsonEndpoint $NodeBase "/api/version" $ShadowBypassHeaders
$versionHaskell = Invoke-JsonEndpoint $HaskellBase "/api/version" @{}
$versionPass = $versionNode.Ok -and $versionHaskell.Ok -and $versionNode.Status -eq 200 -and $versionHaskell.Status -eq 200 -and $versionHaskell.Marker -eq "native-version" -and (Get-Prop $versionNode.Json "version") -eq (Get-Prop $versionHaskell.Json "version")
Add-Result $Lines ([ref]$Failures) "version-native" $versionPass @(
  "node status=$($versionNode.Status) version=$(Get-Prop $versionNode.Json "version") ms=$($versionNode.Ms)",
  "haskell status=$($versionHaskell.Status) marker=$($versionHaskell.Marker) version=$(Get-Prop $versionHaskell.Json "version") ms=$($versionHaskell.Ms)"
)

$titleHit = Invoke-JsonEndpoint $HaskellBase $titleHitPath @{}
$titleHitShape = TitleShape $titleHit.Json
$titleHitPass = $titleHit.Ok -and $titleHit.Status -eq 200 -and $titleHit.MetadataMarker -eq "native-title-details-cache" -and (Test-ExtendedTitleDetails $titleHit.Json)
Add-Result $Lines ([ref]$Failures) "title-details-cache-hit" $titleHitPass @(
  "fixtureKey=$($titleFixture.Key)",
  "path=$titleHitPath",
  "haskell status=$($titleHit.Status) marker=$($titleHit.MetadataMarker) ms=$($titleHit.Ms)",
  "shape=$(ShapeKey $titleHitShape)"
)

$titleMissPath = "/api/title-details?type=movie&title=StreamVaultMetadataMissFixtureNoSuchTitle&year=2099"
$titleMissNode = Invoke-JsonEndpoint $NodeBase $titleMissPath $ReadOnlyHeaders
$titleMissHaskell = Invoke-JsonEndpoint $HaskellBase $titleMissPath @{}
$titleMissNodeShape = TitleShape $titleMissNode.Json
$titleMissHaskellShape = TitleShape $titleMissHaskell.Json
$titleMissPass = $titleMissNode.Ok -and $titleMissHaskell.Ok -and $titleMissNode.Status -eq $titleMissHaskell.Status -and $titleMissHaskell.MetadataMarker -eq "proxy-title-details-miss" -and (ShapeKey $titleMissNodeShape) -eq (ShapeKey $titleMissHaskellShape)
Add-Result $Lines ([ref]$Failures) "title-details-miss-proxy" $titleMissPass @(
  "path=$titleMissPath",
  "node status=$($titleMissNode.Status) ms=$($titleMissNode.Ms)",
  "haskell status=$($titleMissHaskell.Status) marker=$($titleMissHaskell.MetadataMarker) ms=$($titleMissHaskell.Ms)",
  "nodeShape=$(ShapeKey $titleMissNodeShape)",
  "haskellShape=$(ShapeKey $titleMissHaskellShape)"
)

$episodeHitNode = Invoke-JsonEndpoint $NodeBase $episodeFixture.Path $ShadowBypassHeaders
$episodeHitHaskell = Invoke-JsonEndpoint $HaskellBase $episodeFixture.Path @{}
$episodeHitNodeShape = EpisodeShape $episodeHitNode.Json
$episodeHitHaskellShape = EpisodeShape $episodeHitHaskell.Json
$episodeHitPass = $episodeHitNode.Ok -and $episodeHitHaskell.Ok -and $episodeHitNode.Status -eq $episodeHitHaskell.Status -and $episodeHitHaskell.MetadataMarker -eq "native-episode-titles-cache" -and (ShapeKey $episodeHitNodeShape) -eq (ShapeKey $episodeHitHaskellShape)
Add-Result $Lines ([ref]$Failures) "episode-titles-cache-hit" $episodeHitPass @(
  "fixtureKey=$($episodeFixture.Key)",
  "path=$($episodeFixture.Path)",
  "node status=$($episodeHitNode.Status) ms=$($episodeHitNode.Ms)",
  "haskell status=$($episodeHitHaskell.Status) marker=$($episodeHitHaskell.MetadataMarker) ms=$($episodeHitHaskell.Ms)",
  "nodeShape=$(ShapeKey $episodeHitNodeShape)",
  "haskellShape=$(ShapeKey $episodeHitHaskellShape)"
)

$episodeMissPath = "/api/episode-titles?show=StreamVaultMetadataMissFixtureNoSuchShow&season=99"
$episodeMissNode = Invoke-JsonEndpoint $NodeBase $episodeMissPath $ReadOnlyHeaders
$episodeMissHaskell = Invoke-JsonEndpoint $HaskellBase $episodeMissPath @{}
$episodeMissNodeShape = EpisodeShape $episodeMissNode.Json
$episodeMissHaskellShape = EpisodeShape $episodeMissHaskell.Json
$episodeMissPass = $episodeMissNode.Ok -and $episodeMissHaskell.Ok -and $episodeMissNode.Status -eq $episodeMissHaskell.Status -and $episodeMissHaskell.MetadataMarker -eq "proxy-episode-titles-miss" -and (ShapeKey $episodeMissNodeShape) -eq (ShapeKey $episodeMissHaskellShape)
Add-Result $Lines ([ref]$Failures) "episode-titles-miss-proxy" $episodeMissPass @(
  "path=$episodeMissPath",
  "node status=$($episodeMissNode.Status) ms=$($episodeMissNode.Ms)",
  "haskell status=$($episodeMissHaskell.Status) marker=$($episodeMissHaskell.MetadataMarker) ms=$($episodeMissHaskell.Ms)",
  "nodeShape=$(ShapeKey $episodeMissNodeShape)",
  "haskellShape=$(ShapeKey $episodeMissHaskellShape)"
)

$total = 5
$passed = $total - $Failures
$Lines.Add("")
$Lines.Add("Result: $passed passed, $Failures failed")
$Lines.Add("Report: $ReportPath")

$Lines | Set-Content -LiteralPath $ReportPath -Encoding UTF8
$Lines | ForEach-Object { Write-Host $_ }

if ($Failures -gt 0) {
  Write-Host "FAIL metadata parity fast"
  exit 1
}

Write-Host "PASS metadata parity fast"
