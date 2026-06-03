param(
  [int]$Port = 3031,
  [string]$NodeBase = "http://127.0.0.1:3000",
  [int]$StartupTimeoutSec = 90
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

function Test-Health([string]$Url) {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return ($r.StatusCode -eq 200)
  } catch {
    return $false
  }
}

function Escape-SingleQuote([string]$Value) {
  return $Value.Replace("'", "''")
}

$Root = Find-StreamVaultRoot
$OutDir = Join-Path $Root "tools\haskell-parity\out"
$LogDir = Join-Path $OutDir "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$HealthUrl = "http://127.0.0.1:$Port/__haskell-health"
$PidFile = Join-Path $OutDir "haskell-shadow-$Port.pid"
$StdoutLog = Join-Path $LogDir "haskell-$Port.out.log"
$StderrLog = Join-Path $LogDir "haskell-$Port.err.log"

if (Test-Health $HealthUrl) {
  Write-Host "Haskell shadow is already healthy at $HealthUrl"
  exit 0
}

$RootLiteral = Escape-SingleQuote $Root
$NodeBaseLiteral = Escape-SingleQuote $NodeBase
$Command = @"
`$ErrorActionPreference = "Stop"
Set-Location -LiteralPath '$RootLiteral'
`$env:PORT = '$Port'
`$env:STREAMVAULT_NODE = '$NodeBaseLiteral'
`$env:STREAMVAULT_ROOT = '$RootLiteral'
cabal run streamvault-haskell-backend
"@

$Encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($Command))
$Process = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $Encoded) `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $StdoutLog `
  -RedirectStandardError $StderrLog `
  -PassThru

Set-Content -Path $PidFile -Value ([string]$Process.Id)
Write-Host "Started Haskell shadow launcher PID $($Process.Id)"
Write-Host "stdout: $StdoutLog"
Write-Host "stderr: $StderrLog"

$Deadline = (Get-Date).AddSeconds($StartupTimeoutSec)
while ((Get-Date) -lt $Deadline) {
  Start-Sleep -Seconds 1
  if (Test-Health $HealthUrl) {
    Write-Host "Haskell shadow healthy at $HealthUrl"
    exit 0
  }
  if ($Process.HasExited) {
    throw "Haskell shadow process exited early with code $($Process.ExitCode). See $StderrLog"
  }
}

throw "Timed out waiting for Haskell shadow health at $HealthUrl. See $StderrLog"
