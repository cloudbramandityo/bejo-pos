<#
=====================================================================
  BEJO STIKER POS - DEPLOY + VERIFIKASI VPS WINDOWS
=====================================================================
  Jalankan DI DALAM VPS sebagai Administrator:

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-and-verify.ps1

  Script ini:
    1. Mengunduh deploy-full-vps.ps1 terbaru dari GitHub (fallback ke file lokal)
    2. Menjalankan update source, build, restart service, health check, rollback
    3. Memverifikasi koneksi API Marketing secara live (Meta/TikTok/Shopee)
    4. Memverifikasi akses publik melalui domain/Caddy

  Data yang TIDAK disentuh:
    .env, data/, logs/, backups/, database PocketBase

  Opsi:
    -AppDir C:\bejo-pos          Folder aplikasi
    -Branch main                 Branch GitHub
    -SkipSourceUpdate            Pakai source lokal di VPS
    -SkipCaddy                   Jangan ubah/restart Caddy
    -Force                       Timpa perubahan lokal yang dilacak Git
    -RequireMarketingLive        Exit code 2 bila ada kanal Marketing belum LIVE
    -NonInteractive              Jangan buka Notepad
=====================================================================
#>

[CmdletBinding()]
param(
  [string]$AppDir = 'C:\bejo-pos',
  [string]$Branch = 'main',
  [string]$RepoOwner = 'cloudbramandityo',
  [string]$RepoName = 'bejo-pos',
  [string]$ServiceName = 'BejoStikerPOS',
  [string]$CaddyDir = 'C:\caddy',
  [string]$BackupRoot = 'C:\backups\bejo-pos',
  [switch]$SkipSourceUpdate,
  [switch]$SkipCaddy,
  [switch]$Force,
  [switch]$RequireMarketingLive,
  [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Write-Step([string]$Text) {
  Write-Host ''
  Write-Host "==> $Text" -ForegroundColor Cyan
}
function Write-Ok([string]$Text)   { Write-Host "   [OK] $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text){ Write-Host "   [!]  $Text" -ForegroundColor Yellow }
function Fail([string]$Text) {
  Write-Host "   [FAIL] $Text" -ForegroundColor Red
  exit 1
}

function Get-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) { return $null }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trim = $line.Trim()
    if ($trim -eq '' -or $trim.StartsWith('#')) { continue }
    $eq = $trim.IndexOf('=')
    if ($eq -lt 1) { continue }
    if ($trim.Substring(0, $eq).Trim() -eq $Key) {
      $value = $trim.Substring($eq + 1).Trim()
      if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }
  return $null
}

function Test-Endpoint([string]$Url, [int[]]$Accept = @(200, 301, 302, 401, 403)) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15 -MaximumRedirection 3
    return [pscustomobject]@{ Ok = ($Accept -contains [int]$response.StatusCode); Code = [int]$response.StatusCode }
  } catch {
    $status = 0
    try { $status = [int]$_.Exception.Response.StatusCode } catch { }
    return [pscustomobject]@{ Ok = ($Accept -contains $status); Code = $status }
  }
}

function Get-ChannelReason($Channel) {
  if ($Channel.Error) { return [string]$Channel.Error }
  $warnings = @($Channel.Warnings | Where-Object { $_ })
  if ($warnings.Count -gt 0) { return ($warnings -join ' ') }
  return 'kredensial valid belum terverifikasi'
}

function Show-Diagnostics($Diagnostics) {
  $channels = @(
    [pscustomobject]@{ Name = 'WhatsApp (Meta)'; Live = [bool]$Diagnostics.meta.live; Error = $Diagnostics.meta.error; Warnings = @($Diagnostics.meta.warnings); Account = $Diagnostics.meta.account },
    [pscustomobject]@{ Name = 'TikTok'; Live = [bool]$Diagnostics.tiktok.live; Error = $Diagnostics.tiktok.error; Warnings = @($Diagnostics.tiktok.warnings); Account = $Diagnostics.tiktok.account },
    [pscustomobject]@{ Name = 'Shopee'; Live = [bool]$Diagnostics.shopee.live; Error = $Diagnostics.shopee.error; Warnings = @($Diagnostics.shopee.warnings); Account = $Diagnostics.shopee.account }
  )
  $notLive = @()
  foreach ($channel in $channels) {
    if ($channel.Live) {
      Write-Ok "$($channel.Name): LIVE"
      $detail = @()
      if ($channel.Account.name) { $detail += [string]$channel.Account.name }
      if ($channel.Account.currency) { $detail += "mata uang $($channel.Account.currency)" }
      if ($channel.Name -eq 'Shopee' -and $null -ne $channel.Account.balance) {
        $detail += "saldo Rp$(([double]$channel.Account.balance).ToString('N0'))"
      }
      if ($detail.Count -gt 0) { Write-Host "      $($detail -join ' · ')" -ForegroundColor DarkGray }
      foreach ($warning in @($channel.Warnings | Where-Object { $_ })) {
        Write-Warn2 "$($channel.Name): $warning"
      }
    } else {
      Write-Warn2 "$($channel.Name): belum LIVE - $(Get-ChannelReason $channel)"
      $notLive += $channel.Name
    }
  }
  return $notLive
}

# ----------------------------------------------------------- preflight
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ' BEJO STIKER POS - DEPLOY + VERIFIKASI VPS WINDOWS' -ForegroundColor Cyan
Write-Host " Waktu: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '==================================================================' -ForegroundColor DarkCyan

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail 'HARUS dijalankan sebagai Administrator (Run as administrator).' }
if (-not (Test-Path (Join-Path $AppDir 'package.json'))) {
  Fail "Aplikasi tidak ditemukan di $AppDir. Jalankan instalasi awal lebih dulu."
}
if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
  Fail "Service $ServiceName belum terdaftar. Jalankan deploy\install-vps-windows.ps1 lebih dulu."
}

# ----------------------------------------------------------- runner
Write-Step '1/3 Menyiapkan skrip deploy terbaru'
$localRunner = Join-Path $PSScriptRoot 'deploy-full-vps.ps1'
$tempRunner = Join-Path $env:TEMP "bejo-deploy-full-$Stamp.ps1"
$runner = $localRunner
$remoteUrl = "https://raw.githubusercontent.com/$RepoOwner/$RepoName/$Branch/deploy/deploy-full-vps.ps1"
try {
  Invoke-WebRequest -Uri $remoteUrl -OutFile $tempRunner -UseBasicParsing -TimeoutSec 60
  if (-not (Test-Path $tempRunner) -or (Get-Item $tempRunner).Length -lt 1000) {
    throw 'File hasil unduhan tidak valid.'
  }
  $runner = $tempRunner
  Write-Ok "Skrip deploy terbaru diunduh dari $RepoOwner/$RepoName#$Branch."
} catch {
  Write-Warn2 "Gagal mengunduh skrip terbaru: $($_.Exception.Message)"
  if (-not (Test-Path $localRunner)) {
    Fail "Tidak ada fallback lokal di $localRunner."
  }
  Write-Warn2 "Memakai skrip lokal: $localRunner"
}

$deployArgs = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runner,
  '-AppDir', $AppDir,
  '-Branch', $Branch,
  '-RepoOwner', $RepoOwner,
  '-RepoName', $RepoName,
  '-ServiceName', $ServiceName,
  '-CaddyDir', $CaddyDir,
  '-BackupRoot', $BackupRoot
)
if ($SkipSourceUpdate) { $deployArgs += '-SkipSourceUpdate' }
if ($SkipCaddy) { $deployArgs += '-SkipCaddy' }
if ($Force) { $deployArgs += '-Force' }
if ($RequireMarketingLive) { $deployArgs += '-RequireMarketing' }
if ($NonInteractive) { $deployArgs += '-NonInteractive' }

Write-Step '2/3 Deploy aplikasi'
& powershell.exe @deployArgs
$deployExit = $LASTEXITCODE

# ----------------------------------------------------------- post-check
Write-Step '3/3 Verifikasi akhir'
$envPath = Join-Path $AppDir '.env'
$port = Get-EnvValue $envPath 'PORT'
if (-not $port) { $port = '3000' }
$localBase = "http://127.0.0.1:$port"

$health = Test-Endpoint "$localBase/api/health" @(200)
if ($health.Ok) {
  Write-Ok "Aplikasi sehat di $localBase/api/health."
} else {
  Write-Warn2 "Health lokal gagal (HTTP $($health.Code)). Periksa $AppDir\logs\stderr.log."
}

$diagnostics = $null
try {
  $diagnostics = Invoke-RestMethod -Uri "$localBase/api/marketing/diagnostics?refresh=1" -TimeoutSec 60
} catch {
  Write-Warn2 "Diagnostik Marketing gagal: $($_.Exception.Message)"
}

$notLive = @()
if ($diagnostics) {
  $notLive = Show-Diagnostics $diagnostics
} else {
  Write-Warn2 'Status live Marketing tidak dapat diverifikasi.'
}

$appUrl = Get-EnvValue $envPath 'APP_URL'
$publicResult = $null
if ($appUrl -and $appUrl -match '^https?://') {
  $publicResult = Test-Endpoint (($appUrl.TrimEnd('/')) + '/api/health')
  if ($publicResult.Ok) {
    Write-Ok "Akses internet terjangkau: $appUrl (HTTP $($publicResult.Code))."
  } else {
    Write-Warn2 "Akses internet belum terjangkau: $appUrl (HTTP $($publicResult.Code)). Cek DNS, SSL, Caddy, dan firewall."
  }
} else {
  Write-Warn2 'APP_URL belum diisi; verifikasi akses internet dilewati.'
}

$caddyService = Get-Service -Name 'Caddy' -ErrorAction SilentlyContinue
$pocketBaseService = Get-Service -Name 'PocketBase' -ErrorAction SilentlyContinue
$caddyText = if ($caddyService) { $caddyService.Status } else { 'tidak terdaftar' }
$pbText = if ($pocketBaseService) { $pocketBaseService.Status } else { 'tidak terdaftar' }

Write-Host ''
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ' RINGKASAN' -ForegroundColor Cyan
Write-Host "   Deploy exit      : $deployExit"
Write-Host "   Service aplikasi : $((Get-Service $ServiceName).Status)"
Write-Host "   Caddy            : $caddyText"
Write-Host "   PocketBase       : $pbText"
Write-Host "   Domain publik    : $(if ($appUrl) { $appUrl } else { 'belum diisi' })"
if ($diagnostics) {
  Write-Host "   Marketing live   : $(3 - $notLive.Count)/3$(if ($notLive.Count -gt 0) { ' (belum: ' + ($notLive -join ', ') + ')' } else { '' })"
} else {
  Write-Host '   Marketing live   : tidak terverifikasi'
}
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ''

if ($diagnostics -and $notLive.Count -gt 0) {
  Write-Host ' Isi kredensial yang kurang di .env VPS, lalu jalankan ulang script ini.' -ForegroundColor Yellow
  Write-Host ' Token TIDAK pernah dicetak oleh script ini.' -ForegroundColor DarkGray
  Write-Host ''
}

if (Test-Path $tempRunner) { Remove-Item $tempRunner -Force -ErrorAction SilentlyContinue }

if ($deployExit -ne 0) { exit $deployExit }
if (-not $health.Ok) { exit 1 }
if ($RequireMarketingLive -and (-not $diagnostics -or $notLive.Count -gt 0)) { exit 2 }
if ($publicResult -and -not $publicResult.Ok) { exit 3 }
exit 0
