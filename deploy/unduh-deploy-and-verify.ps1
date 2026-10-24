<#
=====================================================================
  BEJO STIKER POS - UNDUH DEPLOY-AND-VERIFY
=====================================================================
  Jalankan DI DALAM VPS sebagai Administrator:

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\unduh-deploy-and-verify.ps1

  Script ini:
    1. Mengunduh deploy\deploy-and-verify.ps1 versi terbaru dari GitHub
       (dengan fallback ke URL GitHub kedua)
    2. Memvalidasi ukuran dan isi file hasil unduhan
    3. Menyimpannya ke <AppDir>\deploy\deploy-and-verify.ps1
    4. Menjalankannya untuk deploy + verifikasi

  Data yang TIDAK disentuh:
    .env, data/, logs/, backups/, database PocketBase

  Opsi:
    -AppDir C:\bejo-pos          Folder aplikasi
    -Branch main                 Branch GitHub
    -DownloadOnly                Hanya unduh, jangan jalankan deploy
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
  [switch]$DownloadOnly,
  [switch]$SkipSourceUpdate,
  [switch]$SkipCaddy,
  [switch]$Force,
  [switch]$RequireMarketingLive,
  [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step([string]$Text) { Write-Host ''; Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Ok([string]$Text)   { Write-Host "   [OK] $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text){ Write-Host "   [!]  $Text" -ForegroundColor Yellow }
function Fail([string]$Text) {
  Write-Host "   [FAIL] $Text" -ForegroundColor Red
  exit 1
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Fail 'HARUS dijalankan sebagai Administrator (klik kanan PowerShell > Run as administrator).'
}

Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ' BEJO STIKER POS - UNDUH DEPLOY-AND-VERIFY' -ForegroundColor Cyan
Write-Host " Waktu: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '==================================================================' -ForegroundColor DarkCyan

if (-not (Test-Path (Join-Path $AppDir 'package.json'))) {
  Fail "Aplikasi tidak ditemukan di $AppDir (package.json tidak ada). Gunakan -AppDir bila lokasinya berbeda."
}

$deployDir = Join-Path $AppDir 'deploy'
if (-not (Test-Path $deployDir)) {
  New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
}
$target = Join-Path $deployDir 'deploy-and-verify.ps1'

# ----------------------------------------------------------- download
Write-Step '1/2 Mengunduh deploy-and-verify.ps1 terbaru'
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$urls = @(
  "https://raw.githubusercontent.com/$RepoOwner/$RepoName/$Branch/deploy/deploy-and-verify.ps1?t=$stamp",
  "https://github.com/$RepoOwner/$RepoName/raw/refs/heads/$Branch/deploy/deploy-and-verify.ps1?t=$stamp"
)
$temp = Join-Path $env:TEMP "deploy-and-verify-$stamp.ps1"
$downloaded = $false
$lastError = ''

foreach ($url in $urls) {
  try {
    Write-Host "   Mengunduh $($url.Split('?')[0])" -ForegroundColor DarkGray
    Invoke-WebRequest -Uri $url -OutFile $temp -UseBasicParsing -TimeoutSec 90
    if (-not (Test-Path $temp)) { throw 'File hasil unduhan tidak ditemukan.' }

    $size = (Get-Item $temp).Length
    if ($size -lt 2000) { throw "Ukuran file terlalu kecil ($size byte)." }

    $text = Get-Content -LiteralPath $temp -Raw
    if ($text -notmatch 'DEPLOY \+ VERIFIKASI VPS WINDOWS' -or $text -notmatch 'deploy-full-vps\.ps1') {
      throw 'Isi file tidak sesuai (bukan deploy-and-verify.ps1).'
    }

    $downloaded = $true
    break
  } catch {
    $lastError = $_.Exception.Message
    Write-Warn2 "Gagal dari sumber ini: $lastError"
    if (Test-Path $temp) { Remove-Item $temp -Force -ErrorAction SilentlyContinue }
  }
}

if (-not $downloaded) {
  Fail "Unduhan gagal. Periksa koneksi internet/DNS VPS. Error terakhir: $lastError"
}

Copy-Item -LiteralPath $temp -Destination $target -Force
Remove-Item $temp -Force -ErrorAction SilentlyContinue
$hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
Write-Ok "Tersimpan: $target"
Write-Host "   SHA256 : $hash" -ForegroundColor DarkGray

if ($DownloadOnly) {
  Write-Host ''
  Write-Ok 'Mode -DownloadOnly: deploy tidak dijalankan.'
  Write-Host "   Jalankan manual: powershell -NoProfile -ExecutionPolicy Bypass -File `"$target`"" -ForegroundColor DarkGray
  exit 0
}

# ----------------------------------------------------------- run
Write-Step '2/2 Menjalankan deploy dan verifikasi'
$deployArgs = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $target,
  '-AppDir', $AppDir,
  '-Branch', $Branch,
  '-RepoOwner', $RepoOwner,
  '-RepoName', $RepoName
)
if ($SkipSourceUpdate) { $deployArgs += '-SkipSourceUpdate' }
if ($SkipCaddy) { $deployArgs += '-SkipCaddy' }
if ($Force) { $deployArgs += '-Force' }
if ($RequireMarketingLive) { $deployArgs += '-RequireMarketingLive' }
if ($NonInteractive) { $deployArgs += '-NonInteractive' }

& powershell.exe @deployArgs
exit $LASTEXITCODE
