$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Web

$root = "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
$outDir = Join-Path $root "tools\haskell-safe-suite\out"

$prefix = "http://127.0.0.1:3031/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

function Send-Json($ctx, [string]$text, [int]$status = 200) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = "application/json; charset=utf-8"
  $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}

function Read-Fixture([string]$name) {
  $path = Join-Path $outDir $name
  if (Test-Path $path) { return Get-Content -Path $path -Raw }
  return $null
}

function Get-IntParam($query, [string]$key, [int]$default) {
  $v = $query[$key]
  if ($null -eq $v -or "$v" -eq "") { return $default }
  $n = 0
  if ([int]::TryParse("$v", [ref]$n)) { return $n }
  return $default
}

function Has-Param($query, [string]$key, [string]$value) {
  $v = $query[$key]
  return ($null -ne $v -and "$v" -eq $value)
}

function Search-Slug([string]$s) {
  $x = "$s".ToLowerInvariant()
  $x = [regex]::Replace($x, '[^a-z0-9]+', '-')
  $x = $x.Trim('-')
  if ([string]::IsNullOrWhiteSpace($x)) { return "empty" }
  return $x
}

function Safe-Key([string]$s) {
  $x = "$s"
  $x = [regex]::Replace($x, '[^A-Za-z0-9\-]+', '-')
  $x = $x.Trim('-')
  if ([string]::IsNullOrWhiteSpace($x)) { return "unknown" }
  return $x
}

function Resolve-Search-Fixture($query, [string]$rawQuery) {
  if ([string]::IsNullOrWhiteSpace($rawQuery)) {
    return "11-api-search-empty.json"
  }

  $q = "$($query['q'])"
  $queryParam = "$($query['query'])"

  if ([string]::IsNullOrWhiteSpace($q) -and ![string]::IsNullOrWhiteSpace($queryParam)) {
    $slug = Search-Slug $queryParam
    $name = "11-api-search-query-$slug.json"
    if (Test-Path (Join-Path $outDir $name)) { return $name }
    return $null
  }

  if ([string]::IsNullOrWhiteSpace($q)) {
    return "11-api-search-empty.json"
  }

  $slug = Search-Slug $q
  $kind = "$($query['kind'])"
  $hasKind = ![string]::IsNullOrWhiteSpace($kind)
  $hasPage = $null -ne $query['page'] -and "$($query['page'])" -ne ""
  $hasLimit = $null -ne $query['limit'] -and "$($query['limit'])" -ne ""

  $page = Get-IntParam $query "page" 0
  $limit = Get-IntParam $query "limit" 0

  $candidates = @()

  if ($hasKind -and $hasPage -and $hasLimit) {
    $candidates += "11-api-search-q-$slug-kind-$kind-page-$page-limit-$limit.json"
  }
  if ($hasPage -and $hasLimit) {
    $candidates += "11-api-search-q-$slug-page-$page-limit-$limit.json"
  }
  if ($hasLimit -and !$hasPage -and !$hasKind) {
    $candidates += "11-api-search-q-$slug-limit-$limit.json"
  }
  if (!$hasLimit -and !$hasPage -and !$hasKind) {
    $candidates += "11-api-search-q-$slug.json"
  }

  $candidates += "11-api-search-q-$slug-limit-12.json"
  $candidates += "11-api-search-q-$slug-page-0-limit-48.json"
  $candidates += "11-api-search-q-$slug.json"

  foreach ($name in $candidates) {
    if (Test-Path (Join-Path $outDir $name)) { return $name }
  }

  return $null
}

function Resolve-Section-Fixture($req, $query) {
  $keyRaw = ($req.Url.AbsolutePath -replace "^/api/section/", "")
  $key = [System.Web.HttpUtility]::UrlDecode($keyRaw)
  $safe = Safe-Key $key

  $page = Get-IntParam $query "page" 0
  $limit = Get-IntParam $query "limit" 12
  $summary = Has-Param $query "summary" "1"

  $candidates = @()

  if ($summary) {
    $candidates += "13-api-section-$safe-page-$page-limit-$limit-summary-1.json"
  }

  $candidates += "13-api-section-$safe-page-$page-limit-$limit.json"

  # Compatibility aliases.
  if ($key -eq "allMovies") {
    $candidates += "13-api-section-all-movies-page-$page-limit-$limit-summary-1.json"
    $candidates += "13-api-section-all-movies-page-$page-limit-$limit.json"
  }
  if ($key -eq "all-movies") {
    $candidates += "13-api-section-allMovies-page-$page-limit-$limit-summary-1.json"
    $candidates += "13-api-section-allMovies-page-$page-limit-$limit.json"
  }
  if ($key -eq "topRated") {
    $candidates += "13-api-section-top-rated-page-$page-limit-$limit-summary-1.json"
    $candidates += "13-api-section-top-rated-page-$page-limit-$limit.json"
  }
  if ($key -eq "top-rated") {
    $candidates += "13-api-section-topRated-page-$page-limit-$limit-summary-1.json"
    $candidates += "13-api-section-topRated-page-$page-limit-$limit.json"
  }

  foreach ($name in $candidates) {
    if (Test-Path (Join-Path $outDir $name)) { return $name }
  }

  return $null
}

function Resolve-Fixture($req) {
  $path = $req.Url.AbsolutePath
  $query = [System.Web.HttpUtility]::ParseQueryString($req.Url.Query)

  if ($path -eq "/api/home-feed") {
    return "01-api-home-feed-limit-12.json"
  }

  if ($path -eq "/api/downloads") {
    if ([string]::IsNullOrWhiteSpace($req.Url.Query)) {
      return "12-api-downloads-default.json"
    }

    $page = Get-IntParam $query "page" 0
    $limit = Get-IntParam $query "limit" 12
    $candidate = "12-api-downloads-page-$page-limit-$limit.json"
    if (Test-Path (Join-Path $outDir $candidate)) { return $candidate }

    return "12-api-downloads-default.json"
  }

  if ($path -eq "/api/movies") {
    if ([string]::IsNullOrWhiteSpace($req.Url.Query)) { return "09-api-movies-default.json" }
    $page = Get-IntParam $query "page" 0
    $limit = Get-IntParam $query "limit" 100
    $candidate = "09-api-movies-page-$page-limit-$limit.json"
    if (Test-Path (Join-Path $outDir $candidate)) { return $candidate }
    return "09-api-movies-default.json"
  }

  if ($path -eq "/api/series") {
    if ([string]::IsNullOrWhiteSpace($req.Url.Query)) {
      return "10-api-series-default.json"
    }

    $page = Get-IntParam $query "page" 0
    $limit = Get-IntParam $query "limit" 100
    $summary = Has-Param $query "summary" "1"
    $envelope = Has-Param $query "envelope" "1"

    if ($summary -and $envelope) {
      $candidate = "10-api-series-page-$page-limit-$limit-summary-1-envelope-1.json"
      if (Test-Path (Join-Path $outDir $candidate)) { return $candidate }
    }

    if ($summary -and !$envelope -and $page -eq 0) {
      $candidate = "10-api-series-summary-1-limit-$limit.json"
      if (Test-Path (Join-Path $outDir $candidate)) { return $candidate }
    }

    $candidate = "10-api-series-page-$page-limit-$limit.json"
    if (Test-Path (Join-Path $outDir $candidate)) { return $candidate }

    return "10-api-series-default.json"
  }

  if ($path -eq "/api/search") {
    return Resolve-Search-Fixture $query $req.Url.Query
  }

  if ($path -like "/api/section/*") {
    return Resolve-Section-Fixture $req $query
  }

  return $null
}

try {
  $listener.Start()
} catch {
  throw "Could not start shadow server at $prefix. Close anything using port 3031 and try again. Details: $($_.Exception.Message)"
}

Write-Host "Shadow API server started at $prefix"
Write-Host "Serving fixtures from: $outDir"
Write-Host "Press Ctrl+C to stop."

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      if ($ctx.Request.HttpMethod -eq "OPTIONS") {
        $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
        $ctx.Response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS")
        $ctx.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
        $ctx.Response.StatusCode = 204
        $ctx.Response.Close()
        continue
      }

      $fixture = Resolve-Fixture $ctx.Request
      if ($null -eq $fixture) {
        $payload = @{ ok = $false; error = "No matching Haskell fixture"; path = $ctx.Request.Url.AbsolutePath; query = $ctx.Request.Url.Query } | ConvertTo-Json -Compress
        Send-Json $ctx $payload 404
        Write-Host "404 $($ctx.Request.RawUrl)"
        continue
      }

      $body = Read-Fixture $fixture
      if ($null -eq $body) {
        $payload = @{ ok = $false; error = "Fixture file missing"; fixture = $fixture } | ConvertTo-Json -Compress
        Send-Json $ctx $payload 404
        Write-Host "404 missing fixture $fixture"
        continue
      }

      Send-Json $ctx $body 200
      Write-Host "200 $($ctx.Request.RawUrl) -> $fixture"
    } catch {
      try {
        $payload = @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        Send-Json $ctx $payload 500
      } catch {}
    }
  }
} finally {
  try { $listener.Stop() } catch {}
}
