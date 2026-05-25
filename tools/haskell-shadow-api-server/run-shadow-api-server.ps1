$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path $ScriptDir "..\..")
$FixtureDir = Join-Path $Root "tools\haskell-safe-suite\out"
$LogDir = Join-Path $ScriptDir "out"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "shadow-api-server.log"

if (!(Test-Path $FixtureDir)) {
  throw "Missing fixture directory: $FixtureDir. Run the safe-suite/shape-fix patches first."
}

function Write-Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Encoding UTF8 -Path $LogFile -Value $line
  Write-Host $line
}

function Parse-Query([string]$queryString) {
  $result = @{}
  if ([string]::IsNullOrWhiteSpace($queryString)) { return $result }
  $q = $queryString.TrimStart('?')
  foreach ($part in $q -split '&') {
    if ([string]::IsNullOrWhiteSpace($part)) { continue }
    $kv = $part -split '=', 2
    $k = [uri]::UnescapeDataString($kv[0])
    $v = if ($kv.Count -gt 1) { [uri]::UnescapeDataString($kv[1]) } else { '' }
    $result[$k] = $v
  }
  return $result
}

function Slug([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return '' }
  $s = $value.ToLowerInvariant() -replace '[^a-z0-9]+','-'
  $s = $s.Trim('-')
  return $s
}

function First-Match([string[]]$patterns) {
  foreach ($pattern in $patterns) {
    $hit = Get-ChildItem -Path $FixtureDir -Filter $pattern -File -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}

function Resolve-ShadowFile($request) {
  $path = $request.Url.AbsolutePath
  $q = Parse-Query $request.Url.Query
  $limit = if ($q.ContainsKey('limit') -and $q['limit']) { $q['limit'] } else { '12' }
  $page = if ($q.ContainsKey('page') -and $q['page']) { $q['page'] } else { '0' }

  if ($path -eq '/api/home-feed') {
    return First-Match @("*-api-home-feed-limit-$limit.json", "*-api-home-feed*.json")
  }

  if ($path -match '^/api/section/([^/]+)$') {
    $section = Slug $Matches[1]
    return First-Match @("*-api-section-$section-page-$page-limit-$limit.json", "*-api-section-$section*.json")
  }

  if ($path -eq '/api/movies') {
    return First-Match @("*-api-movies-page-$page-limit-$limit.json", "*-api-movies*.json")
  }

  if ($path -eq '/api/series') {
    return First-Match @("*-api-series-page-$page-limit-$limit.json", "*-api-series*.json")
  }

  if ($path -eq '/api/downloads') {
    return First-Match @("*-api-downloads-page-$page-limit-$limit.json", "*-api-downloads*.json")
  }

  if ($path -eq '/api/search') {
    $term = ''
    foreach ($key in @('q','query','term','search')) {
      if ($q.ContainsKey($key) -and $q[$key]) { $term = Slug $q[$key]; break }
    }
    if (!$term) { $term = 'netflix' }
    return First-Match @("*-api-search-$term-limit-$limit.json", "*-api-search-$term.json", "*-api-search-$term*.json", "*-api-search*.json")
  }

  return $null
}

function Send-Json($ctx, [string]$json, [int]$status = 200) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = 'application/json; charset=utf-8'
  $ctx.Response.Headers['Access-Control-Allow-Origin'] = '*'
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}

$prefix = 'http://127.0.0.1:3031/'
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  throw "Could not start shadow server at $prefix. Close anything using port 3031 and try again. Details: $($_.Exception.Message)"
}

Write-Log "Shadow API server started at $prefix"
Write-Log "Fixture dir: $FixtureDir"
Write-Log "Stop with Ctrl+C"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request

    if ($req.HttpMethod -eq 'OPTIONS') {
      Send-Json $ctx '{}' 204
      continue
    }

    $file = Resolve-ShadowFile $req
    if (!$file -or !(Test-Path $file)) {
      $notFound = @{ ok = $false; error = 'No matching Haskell fixture'; path = $req.Url.AbsolutePath; query = $req.Url.Query } | ConvertTo-Json -Compress
      Write-Log "404 $($req.Url.PathAndQuery)"
      Send-Json $ctx $notFound 404
      continue
    }

    $json = Get-Content -Raw -Encoding UTF8 $file
    Write-Log "200 $($req.Url.PathAndQuery) -> $(Split-Path -Leaf $file)"
    Send-Json $ctx $json 200
  }
} finally {
  try { $listener.Stop() } catch {}
  try { $listener.Close() } catch {}
  Write-Log "Shadow API server stopped"
}
