<#
=====================================================================
  BEJO STIKER POS - Deploy ke VPS dari komputer Windows
=====================================================================
  Paket source (tanpa node_modules/dist/.env) dikirim ke VPS via SCP,
  lalu skrip deploy dijalankan di VPS via SSH.

  Contoh:
    .\deploy\deploy-vps.ps1 -Host vps.bejodigitalprint.com -User root `
        -KeyPath "$env:USERPROFILE\.ssh\id_ed25519"

  Parameter:
    -Host      : alamat VPS (default vps.bejodigitalprint.com)
    -User      : user SSH      (default root)
    -Port      : port SSH      (default 22)
    -KeyPath   : path private key SSH
    -SkipBuild : lewati build lokal (langsung kirim source)
=====================================================================
#>
param(
  [string]$Host = "vps.bejodigitalprint.com",
  [string]$User = "root",
  [int]$Port = 22,
  [string]$KeyPath = "",
  [string]$AppDir = "/srv/bejo-pos",
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step($text) {
  Write-Host ""
  Write-Host "==> $text" -ForegroundColor Cyan
}

# --- cek perkakas ssh/scp ---
$scp = Get-Command scp.exe -ErrorAction SilentlyContinue
$ssh = Get-Command ssh.exe -ErrorAction SilentlyContinue
if (-not $scp -or -not $ssh) {
  Write-Host "OpenSSH (ssh/scp) tidak ditemukan. Aktifkan di: Optional Features > OpenSSH Client" -ForegroundColor Red
  exit 1
}

# --- build lokal (opsional, recommended: kirim hasil build) ---
if (-not $SkipBuild) {
  Write-Step "Build produksi lokal"
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { Write-Host "Build gagal." -ForegroundColor Red; exit 1 }
}

# --- paketkan source ---
Write-Step "Membuat paket source"
$stage = Join-Path $env:TEMP "bejo-deploy"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stage | Out-Null

$excludeDirs = @('node_modules', 'dist', '.git', 'logs', 'backups', '.vscode', '.idea')
robocopy $root $stage /E /NFL /NDL /NJH /NJS /NP /XD $excludeDirs /XF ".env" "dev-server.log" "URL-INTERNET.txt" | Out-Null
if ($LASTEXITCODE -gt 7) { Write-Host "Gagal menyalin source." -ForegroundColor Red; exit 1 }

$tar = Join-Path $env:TEMP "bejo-deploy.tar.gz"
Remove-Item $tar -Force -ErrorAction SilentlyContinue
& tar.exe -czf $tar -C $stage .
if ($LASTEXITCODE -ne 0) { Write-Host "Gagal membuat arsip." -ForegroundColor Red; exit 1 }
$sizeMb = [math]::Round((Get-Item $tar).Length / 1MB, 2)
Write-Host "   Paket: $tar ($sizeMb MB)" -ForegroundColor Gray

# --- opsi ssh ---
$sshArgs = @('-o', 'StrictHostKeyChecking=accept-new', '-p', "$Port")
if ($KeyPath) { $sshArgs += @('-i', $KeyPath) }
$scpArgs = @('-o', 'StrictHostKeyChecking=accept-new', '-P', "$Port")
if ($KeyPath) { $scpArgs += @('-i', $KeyPath) }

# --- unggah ---
Write-Step "Mengunggah paket ke $User@$Host"
& scp.exe @scpArgs $tar "${User}@${Host}:/tmp/bejo-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { Write-Host "Upload gagal." -ForegroundColor Red; exit 1 }

# --- jalankan deploy di VPS ---
Write-Step "Menjalankan deploy di VPS"
$remote = @"
set -e
mkdir -p $AppDir
tar -xzf /tmp/bejo-deploy.tar.gz -C $AppDir
chown -R ${User}:${User} $AppDir 2>/dev/null || true
cd $AppDir
bash deploy/deploy-vps.sh
"@
& ssh.exe @sshArgs "${User}@${Host}" $remote
$exit = $LASTEXITCODE

Remove-Item $tar -Force -ErrorAction SilentlyContinue
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

if ($exit -ne 0) {
  Write-Host ""
  Write-Host "DEPLOY GAGAL (kode $exit). Periksa log di VPS: pm2 logs bejo-pos" -ForegroundColor Red
  exit $exit
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " DEPLOY BERHASIL - aplikasi aktif di https://bejodigitalprint.com" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
