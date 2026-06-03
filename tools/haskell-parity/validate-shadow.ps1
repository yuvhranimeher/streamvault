param(
  [int]$NodePort = 3000,
  [int]$ShadowNodePort = 3002,
  [int]$HaskellPort = 3031,
  [int]$StartupTimeoutSec = 300
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

function Escape-SingleQuote([string]$Value) {
  return $Value.Replace("'", "''")
}

function Test-PortOpen([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(500, $false)) { return $false }
    $client.EndConnect($iar)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Find-FreePort([int]$StartPort) {
  for ($p = $StartPort; $p -lt ($StartPort + 50); $p++) {
    if (-not (Test-PortOpen $p)) { return $p }
  }
  throw "Could not find a free port starting at $StartPort"
}

function Invoke-SvHttp([string]$Uri, [bool]$AllowRedirect = $true, [int]$TimeoutMs = 90000) {
  $req = [System.Net.HttpWebRequest]::Create($Uri)
  $req.Method = "GET"
  $req.AllowAutoRedirect = $AllowRedirect
  $req.Timeout = $TimeoutMs
  $req.ReadWriteTimeout = $TimeoutMs
  $resp = $null
  try {
    $resp = $req.GetResponse()
  } catch [System.Net.WebException] {
    if ($_.Exception.Response) {
      $resp = $_.Exception.Response
    } else {
      throw
    }
  }

  try {
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $content = $reader.ReadToEnd()
    $reader.Close()
    $statusCode = [int]$resp.StatusCode
    $headers = $resp.Headers
  } finally {
    $resp.Close()
  }

  return [pscustomobject]@{
    StatusCode = $statusCode
    Headers = $headers
    Content = $content
  }
}

function Assert-Status([string]$Name, [string]$Base, [string]$Path, [int[]]$Statuses, [bool]$AllowRedirect = $true) {
  $res = Invoke-SvHttp -Uri ($Base + $Path) -AllowRedirect $AllowRedirect
  if ($Statuses -notcontains $res.StatusCode) {
    throw "$Name expected status $($Statuses -join ',') but got $($res.StatusCode) for $Path"
  }
  Write-Host "PASS $Name -> $($res.StatusCode)"
  return $res
}

function Assert-NoShadowHeader($Name, $Response) {
  if ($Response.Headers["X-StreamVault-Haskell-Shadow"]) {
    throw "$Name unexpectedly had X-StreamVault-Haskell-Shadow=$($Response.Headers["X-StreamVault-Haskell-Shadow"])"
  }
}

function Write-ShadowObservation($Name, $Response) {
  if ($Response.Headers["X-StreamVault-Haskell-Shadow"] -eq "forwarded") {
    Write-Host "PASS $Name used Haskell shadow"
  } else {
    Write-Host "PASS $Name used Node fallback"
  }
}

function Start-NodeProcess([int]$Port, [bool]$ShadowEnabled, [string]$HaskellBase, [string]$Label) {
  $rootLiteral = Escape-SingleQuote $script:Root
  $haskellLiteral = Escape-SingleQuote $HaskellBase
  $shadowValue = if ($ShadowEnabled) { "1" } else { "" }
  $command = @"
`$ErrorActionPreference = "Stop"
Set-Location -LiteralPath '$rootLiteral'
`$env:PORT = '$Port'
if ('$shadowValue' -eq '1') {
  `$env:STREAMVAULT_HASKELL_SHADOW = '1'
  `$env:STREAMVAULT_HASKELL_BASE = '$haskellLiteral'
} else {
  Remove-Item Env:STREAMVAULT_HASKELL_SHADOW -ErrorAction SilentlyContinue
  Remove-Item Env:STREAMVAULT_HASKELL_BASE -ErrorAction SilentlyContinue
}
node server.js
"@
  $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($command))
  $logDir = Join-Path $script:Root "tools\haskell-parity\out\logs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $stdout = Join-Path $logDir "$Label-$Port.out.log"
  $stderr = Join-Path $logDir "$Label-$Port.err.log"
  $p = Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encoded) `
    -WorkingDirectory $script:Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru
  Write-Host "Started $Label Node launcher PID $($p.Id) on port $Port"
  return $p
}

function Wait-ForHttp([string]$Base, [string]$Name, [int]$TimeoutSec) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $res = Invoke-SvHttp -Uri ($Base + "/") -TimeoutMs 3000
      if ($res.StatusCode -eq 200) {
        Write-Host "PASS $Name ready at $Base"
        return
      }
    } catch {}
    Start-Sleep -Seconds 1
  }
  throw "$Name did not become ready at $Base"
}

function Wait-ForHttpPath([string]$Base, [string]$Path, [string]$Name, [int]$TimeoutSec) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $res = Invoke-SvHttp -Uri ($Base + $Path) -TimeoutMs 5000
      if ($res.StatusCode -eq 200) {
        Write-Host "PASS $Name ready at $Path"
        return
      }
    } catch {}
    Start-Sleep -Seconds 2
  }
  throw "$Name did not become ready at $Base$Path"
}

function Stop-ListenersOnPort([int]$Port) {
  $ids = @()
  try {
    $ids += Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {}
  $ids = $ids | Where-Object { $_ -and $_ -ne $PID } | Select-Object -Unique
  foreach ($id in $ids) {
    try {
      Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped validation listener PID $id on port $Port"
    } catch {}
  }
}

$Root = Find-StreamVaultRoot
Set-Location $Root

$NodeBase = "http://127.0.0.1:$NodePort"
$HaskellBase = "http://127.0.0.1:$HaskellPort"
$ManagedProcesses = @()
$ManagedPorts = @()
$StartedHaskell = $false

try {
  if (-not (Test-PortOpen $NodePort)) {
    $ManagedProcesses += Start-NodeProcess -Port $NodePort -ShadowEnabled $false -HaskellBase $HaskellBase -Label "node-only"
    $ManagedPorts += $NodePort
    Wait-ForHttp -Base $NodeBase -Name "Node-only" -TimeoutSec $StartupTimeoutSec
    Wait-ForHttpPath -Base $NodeBase -Path "/api/search?q=iron%20man&limit=1" -Name "Node-only indexes" -TimeoutSec $StartupTimeoutSec
  } else {
    Write-Host "Using existing Node on $NodeBase for Node-only smoke"
  }

  $front = Assert-Status "Node-only frontend /" $NodeBase "/" @(200)
  Assert-NoShadowHeader "Node-only frontend /" $front
  $movies = Assert-Status "Node-only movies smoke" $NodeBase "/api/movies?page=0&limit=1" @(200)
  Assert-NoShadowHeader "Node-only movies smoke" $movies
  $downloads = Assert-Status "Node-only downloads smoke" $NodeBase "/api/downloads?page=0&limit=1" @(200)
  Assert-NoShadowHeader "Node-only downloads smoke" $downloads

  try {
    $health = Invoke-SvHttp -Uri ($HaskellBase + "/__haskell-health") -TimeoutMs 3000
    if ($health.StatusCode -ne 200) { throw "bad health status $($health.StatusCode)" }
    Write-Host "PASS Haskell health -> 200"
  } catch {
    Write-Host "Haskell shadow not healthy; starting it on $HaskellBase"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\haskell-parity\start-shadow.ps1" -Port $HaskellPort -NodeBase $NodeBase -StartupTimeoutSec $StartupTimeoutSec
    if ($LASTEXITCODE -ne 0) { throw "start-shadow.ps1 failed with exit code $LASTEXITCODE" }
    $StartedHaskell = $true
    $health = Assert-Status "Haskell health" $HaskellBase "/__haskell-health" @(200)
  }

  Write-Host "Running 15-endpoint parity check"
  $parityLog = Join-Path $Root "tools\haskell-parity\out\logs\validate-parity.log"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\haskell-parity\run-parity.ps1" -NodeBase $NodeBase -HaskellBase $HaskellBase -TimeoutMs 60000 *> $parityLog
  if ($LASTEXITCODE -ne 0) { throw "run-parity.ps1 failed with exit code $LASTEXITCODE" }
  $reportPath = Join-Path $Root "tools\haskell-parity\out\reports\parity-report.json"
  $report = Get-Content -Path $reportPath -Raw | ConvertFrom-Json
  if ($report.passed -ne 15 -or $report.failed -ne 0) {
    throw "Parity expected 15 passed, 0 failed; got $($report.passed) passed, $($report.failed) failed"
  }
  Write-Host "PASS parity 15/15 (log: $parityLog)"

  $ShadowNodePort = Find-FreePort $ShadowNodePort
  $ShadowNodeBase = "http://127.0.0.1:$ShadowNodePort"
  $ManagedProcesses += Start-NodeProcess -Port $ShadowNodePort -ShadowEnabled $true -HaskellBase $HaskellBase -Label "node-shadow"
  $ManagedPorts += $ShadowNodePort
  Wait-ForHttp -Base $ShadowNodeBase -Name "Node with Haskell shadow" -TimeoutSec $StartupTimeoutSec
  Wait-ForHttpPath -Base $ShadowNodeBase -Path "/api/search?q=iron%20man&limit=1" -Name "Shadow Node indexes" -TimeoutSec $StartupTimeoutSec

  $shadowFront = Assert-Status "Shadow Node frontend /" $ShadowNodeBase "/" @(200)
  Assert-NoShadowHeader "Shadow Node frontend /" $shadowFront

  $safeRoutes = @(
    @{ Name = "downloads"; Path = "/api/downloads?page=0&limit=1" },
    @{ Name = "movies"; Path = "/api/movies?page=0&limit=1" },
    @{ Name = "series"; Path = "/api/series?page=0&limit=1" },
    @{ Name = "home-feed"; Path = "/api/home-feed" },
    @{ Name = "channels"; Path = "/api/channels" },
    @{ Name = "section marvel"; Path = "/api/section/marvel?page=0&limit=1" },
    @{ Name = "section dc"; Path = "/api/section/dc?page=0&limit=1" },
    @{ Name = "section netflix"; Path = "/api/section/netflix?page=0&limit=1" }
  )

  foreach ($route in $safeRoutes) {
    $res = Assert-Status "Shadow safe route $($route.Name)" $ShadowNodeBase $route.Path @(200)
    Write-ShadowObservation "Shadow safe route $($route.Name)" $res
  }

  $downloadList = Invoke-SvHttp -Uri ($ShadowNodeBase + "/api/downloads?page=0&limit=1")
  $downloadJson = $downloadList.Content | ConvertFrom-Json
  $downloadItems = @($downloadJson.items)
  if ($downloadItems.Count -gt 0) {
    $downloadId = $downloadItems[0].id
    $redirect = Assert-Status "Shadow download redirect" $ShadowNodeBase ("/download/" + [uri]::EscapeDataString($downloadId)) @(302) $false
    Write-ShadowObservation "Shadow download redirect" $redirect
    if (-not $redirect.Headers["Location"]) { throw "Shadow download redirect did not include Location" }
  } else {
    throw "Cannot validate /download/:id redirect because /api/downloads returned no items"
  }

  $playbackRoutes = @(
    @{ Name = "direct stream missing id"; Path = "/stream/__shadow_validation_missing__"; Statuses = @(404) },
    @{ Name = "mobile HLS missing id"; Path = "/api/mobile-hls/local/__shadow_validation_missing__/index.m3u8"; Statuses = @(404) },
    @{ Name = "play-url missing query"; Path = "/api/play-url"; Statuses = @(400) }
  )
  foreach ($route in $playbackRoutes) {
    $res = Assert-Status "Playback Node-owned $($route.Name)" $ShadowNodeBase $route.Path $route.Statuses
    Assert-NoShadowHeader "Playback Node-owned $($route.Name)" $res
  }

  Write-Host "VALIDATION PASSED"
} finally {
  foreach ($port in $ManagedPorts) {
    Stop-ListenersOnPort -Port $port
  }
  foreach ($p in $ManagedProcesses) {
    try {
      if ($p -and -not $p.HasExited) {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped validation launcher PID $($p.Id)"
      }
    } catch {}
  }
  if ($StartedHaskell) {
    try {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\haskell-parity\stop-shadow.ps1" -Port $HaskellPort
    } catch {}
  }
}
