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

    # If frontend asks an unseen download page/limit, fall back to full default list.
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
    $q = "$($query['q'])"
    if ($q -match "netflix") { return "11-api-search-netflix-limit-12.json" }
    if (Test-Path (Join-Path $outDir "11-api-search-netflix-limit-12.json")) {
      return "11-api-search-netflix-limit-12.json"
    }
  }

  if ($path -like "/api/section/*") {
    $key = ($path -replace "^/api/section/", "")
    $page = Get-IntParam $query "page" 0
    $limit = Get-IntParam $query "limit" 12

    $map = @{
      "netflix" = "02-api-section-netflix-page-0-limit-12.json"
      "marvel" = "03-api-section-marvel-page-0-limit-12.json"
      "dc" = "04-api-section-dc-page-0-limit-12.json"
      "trending" = "05-api-section-trending-page-0-limit-12.json"
      "series" = "06-api-section-series-page-0-limit-12.json"
      "top-rated" = "07-api-section-top-rated-page-0-limit-12.json"
      "topRated" = "07-api-section-top-rated-page-0-limit-12.json"
      "all-movies" = "08-api-section-all-movies-page-0-limit-12.json"
      "allMovies" = "08-api-section-all-movies-page-0-limit-12.json"
    }

    if ($map.ContainsKey($key)) { return $map[$key] }

    $candidate = "04-api-section-$key-page-$page-limit-$limit.json"
    if (Test-Path (Join-Path $outDir $candidate)) { return $candidate }
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
