param(
  [string]$NodeBase = "http://127.0.0.1:3000",
  [string]$HaskellBase = "http://127.0.0.1:3031",
  [int]$TimeoutMs = 5000
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

function Invoke-SvHttp([string]$Uri, [int]$RequestTimeoutMs) {
  $started = [Diagnostics.Stopwatch]::StartNew()
  $req = [System.Net.HttpWebRequest]::Create($Uri)
  $req.Method = "GET"
  $req.Timeout = $RequestTimeoutMs
  $req.ReadWriteTimeout = $RequestTimeoutMs
  $req.AllowAutoRedirect = $false
  $req.UserAgent = "streamvault-haskell-search-parity-fast"

  $resp = $null
  try {
    $resp = $req.GetResponse()
  } catch [System.Net.WebException] {
    if ($_.Exception.Response) {
      $resp = $_.Exception.Response
    } else {
      $started.Stop()
      return [pscustomobject]@{
        Ok = $false
        StatusCode = 0
        Ms = [int]$started.ElapsedMilliseconds
        Bytes = 0
        Content = ""
        StreamVault = $null
        Error = $_.Exception.Message
      }
    }
  }

  try {
    $stream = $resp.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    $content = $reader.ReadToEnd()
    $started.Stop()
    return [pscustomobject]@{
      Ok = $true
      StatusCode = [int]$resp.StatusCode
      Ms = [int]$started.ElapsedMilliseconds
      Bytes = [System.Text.Encoding]::UTF8.GetByteCount($content)
      Content = $content
      StreamVault = $resp.Headers["X-StreamVault-Haskell"]
      Error = $null
    }
  } finally {
    if ($reader) { $reader.Dispose() }
    if ($resp) { $resp.Dispose() }
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

function Convert-JsonSafe([string]$Text) {
  try {
    return $Text | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return $null
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

function Get-JsonArray($Obj, [string]$Name) {
  $value = Get-Prop $Obj $Name
  if ($null -eq $value) { return @() }
  if ($value -is [System.Array]) { return @($value) }
  return @($value)
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

function Get-SearchIdentity($Item) {
  $type = Get-Prop $Item "type"
  if (-not $type) {
    if ((Get-Prop $Item "_isSeries") -or (Get-Prop $Item "seasons")) {
      $type = "series"
    } else {
      $type = "movie"
    }
  }
  $name = Get-Prop $Item "name"
  if (-not $name) { $name = Get-Prop $Item "title" }
  return [pscustomobject]@{
    id = Get-Prop $Item "id"
    tmdbId = Get-Prop $Item "tmdbId"
    name = $name
    title = Get-Prop $Item "title"
    year = Get-Prop $Item "year"
    type = $type
    poster = Test-Truthy (Get-Prop $Item "poster")
    backdrop = Test-Truthy (Get-Prop $Item "backdrop")
  }
}

function Get-SearchCompareKey($Identity) {
  if ($null -eq $Identity) { return "" }
  $type = ([string](Get-Prop $Identity "type")).ToLowerInvariant()
  $nameRaw = [string](Get-Prop $Identity "name")
  if (-not $nameRaw) { $nameRaw = [string](Get-Prop $Identity "title") }
  $name = [regex]::Replace($nameRaw.ToLowerInvariant(), "[^a-z0-9]+", " ").Trim()
  $year = [regex]::Replace([string](Get-Prop $Identity "year"), "[^0-9]", "")
  if ($year.Length -gt 4) { $year = $year.Substring(0, 4) }
  $tmdbId = Get-Prop $Identity "tmdbId"
  $parts = @($type, $name, $year)
  if ($tmdbId) { $parts += "tmdb:$tmdbId" }
  return (($parts | Where-Object { $_ }) -join "|")
}

function Compare-Search($Path, $NodeResult, $HaskellResult) {
  $diffs = New-Object System.Collections.Generic.List[string]
  $warnings = New-Object System.Collections.Generic.List[string]

  if (-not $NodeResult.Ok) { $diffs.Add("Node fetch failed: $($NodeResult.Error)") }
  if (-not $HaskellResult.Ok) { $diffs.Add("Haskell fetch failed: $($HaskellResult.Error)") }
  if ($NodeResult.Ok -and $HaskellResult.Ok -and $NodeResult.StatusCode -ne $HaskellResult.StatusCode) {
    $diffs.Add("status $($NodeResult.StatusCode) != $($HaskellResult.StatusCode)")
  }
  if ($HaskellResult.Ok -and $HaskellResult.StreamVault -ne "native-search-debug") {
    $diffs.Add("Haskell route marker $($HaskellResult.StreamVault) != native-search-debug")
  }

  $nodeJson = Convert-JsonSafe $NodeResult.Content
  $haskellJson = Convert-JsonSafe $HaskellResult.Content
  if ($null -eq $nodeJson) { $diffs.Add("Node response is not JSON") }
  if ($null -eq $haskellJson) { $diffs.Add("Haskell response is not JSON") }

  if ($nodeJson -and $haskellJson) {
    $nodeKeys = Get-Keys $nodeJson
    $haskellKeys = Get-Keys $haskellJson
    if (-not (Test-SameList $nodeKeys $haskellKeys)) {
      $diffs.Add("response keys $($haskellKeys -join ',') != $($nodeKeys -join ',')")
    }

    foreach ($key in @("page", "instant", "indexed")) {
      $nodeValue = Get-Prop $nodeJson $key
      $haskellValue = Get-Prop $haskellJson $key
      if ($nodeValue -ne $haskellValue) {
        $diffs.Add("$key $haskellValue != $nodeValue")
      }
    }

    foreach ($key in @("total", "pages")) {
      $nodeValue = Get-Prop $nodeJson $key
      $haskellValue = Get-Prop $haskellJson $key
      if ($nodeValue -ne $haskellValue) {
        $warnings.Add("$key $haskellValue != $nodeValue")
      }
    }

    $nodeItems = Get-JsonArray $nodeJson "items"
    $haskellItems = Get-JsonArray $haskellJson "items"
    if ($nodeItems.Count -ne $haskellItems.Count) {
      $warnings.Add("items.length $($haskellItems.Count) != $($nodeItems.Count)")
    }
    if ($nodeItems.Count -gt 0 -and $haskellItems.Count -eq 0) {
      $diffs.Add("Haskell returned no items while Node returned $($nodeItems.Count)")
    }

    $nodeTop = @($nodeItems | Select-Object -First 20 | ForEach-Object { Get-SearchIdentity $_ })
    $haskellTop = @($haskellItems | Select-Object -First 20 | ForEach-Object { Get-SearchIdentity $_ })
    $nodeTopKeys = @($nodeTop | ForEach-Object { Get-SearchCompareKey $_ })
    $haskellTopKeys = @($haskellTop | ForEach-Object { Get-SearchCompareKey $_ })
    if (-not (Test-SameList $nodeTopKeys $haskellTopKeys)) {
      $overlap = @($nodeTopKeys | Where-Object { $haskellTopKeys -contains $_ }).Count
      $needed = [Math]::Min(8, [Math]::Min($nodeTopKeys.Count, $haskellTopKeys.Count))
      $msg = "first20 order differs; overlap=$overlap/$([Math]::Min($nodeTopKeys.Count, $haskellTopKeys.Count))"
      if ($overlap -lt $needed) {
        $diffs.Add($msg)
      } else {
        $warnings.Add($msg)
      }
    }

    $nodePosterCount = @($nodeTop | Where-Object { $_.poster }).Count
    $haskellPosterCount = @($haskellTop | Where-Object { $_.poster }).Count
    $posterDelta = [Math]::Abs($nodePosterCount - $haskellPosterCount)
    if ($posterDelta -gt 10) {
      $diffs.Add("first20 poster presence delta $posterDelta > 10")
    } elseif ($posterDelta -gt 0) {
      $warnings.Add("first20 poster presence delta $posterDelta")
    }

    $nodeBackdropCount = @($nodeTop | Where-Object { $_.backdrop }).Count
    $haskellBackdropCount = @($haskellTop | Where-Object { $_.backdrop }).Count
    $backdropDelta = [Math]::Abs($nodeBackdropCount - $haskellBackdropCount)
    if ($backdropDelta -gt 5) {
      $warnings.Add("first20 backdrop presence delta $backdropDelta")
    }

    $haskellByKey = @{}
    foreach ($item in $haskellTop) {
      $haskellByKey[(Get-SearchCompareKey $item)] = $item
    }
    foreach ($nodeItem in $nodeTop) {
      $key = Get-SearchCompareKey $nodeItem
      if (-not $haskellByKey.ContainsKey($key)) { continue }
      $haskellItem = $haskellByKey[$key]
      if ($nodeItem.tmdbId -and $haskellItem.tmdbId -and ([string]$nodeItem.tmdbId -ne [string]$haskellItem.tmdbId)) {
        $diffs.Add("tmdbId mismatch for $($nodeItem.name): $($haskellItem.tmdbId) != $($nodeItem.tmdbId)")
      }
    }
  }

  return [pscustomobject]@{
    Path = $Path
    HaskellPath = $Path.Replace("/api/search", "/__haskell-search-debug")
    Pass = ($diffs.Count -eq 0)
    Diffs = @($diffs.ToArray())
    Warnings = @($warnings.ToArray())
    Node = [pscustomobject]@{
      Status = $NodeResult.StatusCode
      Ms = $NodeResult.Ms
      Bytes = $NodeResult.Bytes
    }
    Haskell = [pscustomobject]@{
      Status = $HaskellResult.StatusCode
      Ms = $HaskellResult.Ms
      Bytes = $HaskellResult.Bytes
      Marker = $HaskellResult.StreamVault
    }
  }
}

function Render-Report($Summary) {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("StreamVault Haskell Search Fast Parity Report")
  $lines.Add("============================================")
  $lines.Add("Generated: $($Summary.GeneratedAt)")
  $lines.Add("Node:      $($Summary.NodeBase)")
  $lines.Add("Haskell:   $($Summary.HaskellBase)")
  $lines.Add("Timeout:   $($Summary.TimeoutMs)ms")
  $lines.Add("Warmup:    status=$($Summary.Warmup.Status) ms=$($Summary.Warmup.Ms) entries=$($Summary.Warmup.Entries)")
  $lines.Add("Result:    $($Summary.Passed) passed, $($Summary.Failed) failed")
  $lines.Add("")
  foreach ($row in $Summary.Rows) {
    $lines.Add("$(if ($row.Pass) { 'PASS' } else { 'FAIL' }) $($row.Path)")
    $lines.Add("  haskell path: $($row.HaskellPath)")
    $lines.Add("  node:    status=$($row.Node.Status) bytes=$($row.Node.Bytes) ms=$($row.Node.Ms)")
    $lines.Add("  haskell: status=$($row.Haskell.Status) bytes=$($row.Haskell.Bytes) ms=$($row.Haskell.Ms) marker=$($row.Haskell.Marker)")
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
$ReportPath = Join-Path $OutDir "search-fast-report.txt"

$NodeBase = $NodeBase.TrimEnd("/")
$HaskellBase = $HaskellBase.TrimEnd("/")

Write-Host "Checking Node at $NodeBase (expected port 3000)."
$nodeCheck = Test-SvTcpBase $NodeBase ([Math]::Min($TimeoutMs, 5000))
if (-not $nodeCheck) {
  throw "Node is not reachable at $NodeBase. Start the Node server on port 3000 first."
}

Write-Host "Checking Haskell at $HaskellBase (expected port 3031)."
$haskellCheck = Test-SvTcpBase $HaskellBase ([Math]::Min($TimeoutMs, 5000))
if (-not $haskellCheck) {
  throw "Haskell is not healthy at $HaskellBase. Start the Haskell backend on port 3031 first."
}

Write-Host "Warming Haskell native search index."
$warmup = Invoke-SvHttp (Join-SvUrl $HaskellBase "/__haskell-search-warmup") $TimeoutMs
$warmupJson = Convert-JsonSafe $warmup.Content
$warmupEntries = if ($warmupJson) { Get-Prop $warmupJson "entries" } else { $null }
if (-not $warmup.Ok -or $warmup.StatusCode -ne 200) {
  throw "Haskell search warmup failed: status=$($warmup.StatusCode) error=$($warmup.Error)"
}

$paths = @(
  "/api/search?q=iron%20man",
  "/api/search?q=oblivion",
  "/api/search?q=oblibion",
  "/api/search?q=the%20boys",
  "/api/search?q=extraction",
  "/api/search?q=dark%20knight",
  "/api/search?q=breaking%20bad",
  "/api/search?q=game%20of%20thrones"
)

$rows = New-Object System.Collections.Generic.List[object]
foreach ($path in $paths) {
  $haskellPath = $path.Replace("/api/search", "/__haskell-search-debug")
  $nodeResult = Invoke-SvHttp (Join-SvUrl $NodeBase $path) $TimeoutMs
  $haskellResult = Invoke-SvHttp (Join-SvUrl $HaskellBase $haskellPath) $TimeoutMs
  $row = Compare-Search $path $nodeResult $haskellResult
  $rows.Add($row)
  $status = if ($row.Pass) { "PASS" } else { "FAIL" }
  Write-Host ("{0} {1} node={2}ms haskell={3}ms" -f $status, $path, $row.Node.Ms, $row.Haskell.Ms)
}

$passed = @($rows | Where-Object { $_.Pass }).Count
$failed = @($rows | Where-Object { -not $_.Pass }).Count
$summary = [pscustomobject]@{
  GeneratedAt = (Get-Date).ToUniversalTime().ToString("o")
  NodeBase = $NodeBase
  HaskellBase = $HaskellBase
  TimeoutMs = $TimeoutMs
  Warmup = [pscustomobject]@{
    Status = $warmup.StatusCode
    Ms = $warmup.Ms
    Entries = $warmupEntries
  }
  Passed = $passed
  Failed = $failed
  Rows = @($rows.ToArray())
  ReportPath = $ReportPath
}

$report = Render-Report $summary
Set-Content -Path $ReportPath -Value $report
Write-Host ""
Write-Host $report

if ($failed -ne 0) {
  exit 1
}
