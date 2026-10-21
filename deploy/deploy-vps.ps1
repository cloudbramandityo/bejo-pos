<#
=====================================================================
  BEJO STIKER POS - Deploy ke VPS WINDOWS dari komputer Windows
=====================================================================
  Paket source dikirim ke VPS via SCP, lalu deploy dijalankan via SSH.

  Contoh:
    .\deploy\deploy-vps.ps1 -Host vps.bejodigitalprint.com -User Administrator `
        -KeyPath "$env:USERPROFILE\.ssh\id_ed25519"

  Parameter:
    -Host       : alamat VPS (default vps.bejodigitalprint.com)
    -User       : user SSH Windows di VPS (default Administrator)
    -Port       : port SSH (default 22)
    -KeyPath    : path private key SSH
    -AppDir     : folder aplikasi di VPS (default C:\bejo-pos)
    -SkipBuild  : lewati build lokal
    -SkipUpload : hanya jalankan deploy di VPS (source sudah ada)
=====================================================================
#>
param(
  [string]$Host = "vps.bejodigitalprint.com",
  [string]$User = "Administrator",
  [int]$Port = 22,
  [string]$KeyPath = "",
  [string]$AppDir = "C:\bejo-pos",
  [switch]$SkipBuild,
  [switch]$SkipUpload
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step($text) {
  Write-Host ""
  Write-Host "==> $text" -ForegroundColor Cyan
}

# --- cek ssh/scp ---
if (-not (Get-Command scp.exe -ErrorAction SilentlyContinue) -or -not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) {
  Write-Host "OpenSSH (ssh/scp) tidak ditemukan. Aktifkan: Optional Features > OpenSSH Client" -ForegroundColor Red
  exit 1
}

# --- build lokal ---
if (-not $SkipBuild) {
  Write-Step "Build produksi lokal"
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { Write-Host "Build gagal." -ForegroundColor Red; exit 1 }
}

# --- paketkan source ---
$stage = Join-Path $env:TEMP "bejo-deploy"
$tar   = Join-Path $env:TEMP "bejo-deploy.tar.gz"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $tar -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stage | Out-Null

Write-Step "Membuat paket source"
$excludeDirs = @('node_modules', 'dist', '.git', 'logs', 'backups', '.vscode', '.idea')
robocopy $root $stage /E /NFL /NDL /NJH /NJS /NP /XD $excludeDirs /XF ".env" "dev-server.log" "URL-INTERNET.txt" | Out-Null
if ($LASTEXITCODE -gt 7) { Write-Host "Gagal menyalin source." -ForegroundColor Red; exit 1 }

& tar.exe -czf $tar -C $stage .
if ($LASTEXITCODE -ne 0) { Write-Host "Gagal membuat arsip." -ForegroundColor Red; exit 1 }
$sizeMb = [math]::Round((Get-Item $tar).Length / 1MB, 2)
Write-Host "   Paket: $tar ($sizeMb MB)" -ForegroundColor Gray

# --- opsi ssh ---
$sshArgs = @('-o', 'StrictHostKeyChecking=accept-new', '-p', "$Port")
if ($KeyPath) { $sshArgs += @('-i', $KeyPath) }
$scpArgs = @('-o', 'StrictHostKeyChecking=accept-new', '-P', "$Port")
if ($KeyPath) { $scpArgs += @('-i', $KeyPath) }

# --- upload ---
if (-not $SkipUpload) {
  Write-Step "Mengunggah paket & runner ke $User@$Host"
  & scp.exe @scpArgs $tar "${User}@${Host}:bejo-deploy.tar.gz"
  if ($LASTEXITCODE -ne 0) { Write-Host "Upload paket gagal." -ForegroundColor Red; exit 1 }

  & scp.exe @scpArgs (Join-Path $PSScriptRoot 'remote-run.ps1') "${User}@${Host}:remote-run.ps1"
  if ($LASTEXITCODE -ne 0) { Write-Host "Upload runner gagal." -ForegroundColor Red; exit 1 }
}

# --- jalankan deploy di VPS ---
Write-Step "Menjalankan deploy di VPS"
& ssh.exe @sshArgs "${User}@${Host}" "powershell -NoProfile -ExecutionPolicy Bypass -File remote-run.ps1"
$exit = $LASTEXITCODE

Remove-Item $tar -Force -ErrorAction SilentlyContinue
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

if ($exit -ne 0) {
  Write-Host ""
  Write-Host "DEPLOY GAGAL (kode $exit). Cek log di VPS: Get-Content $AppDir\logs\stderr.log -Tail 50" -ForegroundColor Red
  exit $exit
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " DEPLOY BERHASIL - aplikasi aktif di https://bejodigitalprint.com" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
