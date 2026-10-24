<#
=====================================================================
  BEJO STIKER POS - Update dari Git + deploy VPS Windows
=====================================================================
  Jalankan DI DALAM VPS (PowerShell sebagai Administrator):

      powershell -NoProfile -ExecutionPolicy Bypass ^
        -File C:\bejo-pos\deploy\update-from-git.ps1

  Alur:
    1. Validasi repo, .env, dan tools
    2. git fetch + fast-forward ke origin/main
    3. Siapkan folder logs/ dan data/
    4. Build + restart service BejoStikerPOS (deploy-vps-windows.ps1)
    5. Health check + verifikasi konfigurasi 3 kanal Marketing

  Opsi:
    -AppDir C:\bejo-pos    Lokasi repo di VPS
    -Remote origin         Nama remote git
    -Branch main           Branch yang dideploy
    -RequireMarketing      Gagal bila Meta/TikTok/Shopee belum lengkap
=====================================================================
#>

[CmdletBinding()]
param(
  [string]$AppDir = 'C:\bejo-pos',
  [string]$Remote = 'origin',
  [string]$Branch = 'main',
  [switch]$RequireMarketing
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:GIT_TERMINAL_PROMPT = '0'

$ServiceName = 'BejoStikerPOS'

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
  foreach ($line in Get-Content $Path) {
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

# ----------------------------------------------------------- 0. preflight
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Warn2 'Tidak berjalan sebagai Administrator; restart service bisa gagal.'
}
if (-not (Test-Path $AppDir)) {
  Fail "Folder $AppDir tidak ditemukan. Clone repo terlebih dahulu atau isi parameter -AppDir."
}
if (-not (Test-Path (Join-Path $AppDir '.git'))) {
  Fail "$AppDir bukan repository git. Jalankan install-vps-windows.ps1 untuk instalasi awal."
}
if (-not (Test-Path (Join-Path $AppDir '.env'))) {
  Fail "File .env belum ada. Salin .env.example ke .env lalu isi kredensial VPS sebelum deploy."
}
foreach ($tool in @('git', 'node', 'npm')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool tidak ditemukan di PATH." }
}
if ((Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) -eq $null) {
  Fail "Service $ServiceName belum terdaftar. Jalankan deploy\install-vps-windows.ps1 terlebih dahulu."
}

Set-Location $AppDir

# ----------------------------------------------------------- 1. repo check
Write-Step '1/5 Memeriksa repository'
$currentBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
$oldCommit = (& git rev-parse --short HEAD).Trim()
if ($LASTEXITCODE -ne 0) { Fail 'Gagal membaca commit aktif.' }

$dirty = @(& git status --porcelain --untracked-files=no)
if ($dirty.Count -gt 0) {
  Write-Host ($dirty -join "`n") -ForegroundColor DarkYellow
  Fail 'Ada perubahan lokal pada file yang dilacak. Commit atau batalkan dulu agar update tidak menimpa pekerjaan VPS.'
}
Write-Ok "Repo bersih. Commit aktif: $oldCommit ($currentBranch)"

# ----------------------------------------------------------- 2. git update
Write-Step "2/5 Menarik kode terbaru dari $Remote/$Branch"
& git fetch $Remote $Branch
if ($LASTEXITCODE -ne 0) { Fail "git fetch gagal. Pastikan kredensial git di VPS valid dan remote $Remote dapat diakses." }

if ($currentBranch -ne $Branch) {
  & git checkout $Branch
  if ($LASTEXITCODE -ne 0) { Fail "Gagal checkout branch $Branch." }
}

& git merge --ff-only "$Remote/$Branch"
if ($LASTEXITCODE -ne 0) { Fail 'Fast-forward gagal. Riwayat lokal dan remote berbeda; selesaikan manual di VPS.' }

$newCommit = (& git rev-parse --short HEAD).Trim()
if ($oldCommit -eq $newCommit) {
  Write-Ok "Sudah di commit terbaru: $newCommit"
} else {
  Write-Ok "Update: $oldCommit -> $newCommit"
  & git log --oneline "$oldCommit..$newCommit" | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkGray }
}

# ----------------------------------------------------------- 3. runtime dir
Write-Step '3/5 Menyiapkan folder runtime'
New-Item -ItemType Directory -Path (Join-Path $AppDir 'logs'), (Join-Path $AppDir 'data') -Force | Out-Null
try {
  $probe = Join-Path $AppDir 'data\.deploy-write-test'
  [System.IO.File]::WriteAllText($probe, 'ok')
  Remove-Item $probe -Force
  Write-Ok 'Folder logs/ dan data/ siap (token Shopee dapat ditulis).'
} catch {
  Write-Warn2 "Folder data/ tidak dapat ditulis: $($_.Exception.Message)"
}

# ----------------------------------------------------------- 4. build/deploy
Write-Step '4/5 Build dan restart aplikasi'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AppDir 'deploy\deploy-vps-windows.ps1')
if ($LASTEXITCODE -ne 0) {
  Fail "Deploy gagal (exit $LASTEXITCODE). Periksa $AppDir\logs\stderr.log."
}
Write-Ok 'Build dan restart service selesai.'

# ----------------------------------------------------------- 5. verify
Write-Step '5/5 Verifikasi aplikasi dan Marketing'
$port = Get-EnvValue (Join-Path $AppDir '.env') 'PORT'
if (-not $port) { $port = '3000' }
$baseUrl = "http://127.0.0.1:$port"

try {
  $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 10
  Write-Ok "Health OK: $($health | ConvertTo-Json -Compress -Depth 3)"
} catch {
  Fail "Health check gagal di $baseUrl/api/health : $($_.Exception.Message)"
}

try {
  $marketing = Invoke-RestMethod -Uri "$baseUrl/api/marketing/status" -TimeoutSec 10
} catch {
  Fail "Endpoint /api/marketing/status tidak merespons: $($_.Exception.Message)"
}

$channels = @(
  [pscustomobject]@{ Name = 'WhatsApp (Meta)'; Configured = [bool]$marketing.meta.configured; Missing = @($marketing.meta.missing) },
  [pscustomobject]@{ Name = 'TikTok'; Configured = [bool]$marketing.tiktok.configured; Missing = @($marketing.tiktok.missing) },
  [pscustomobject]@{ Name = 'Shopee'; Configured = [bool]$marketing.shopee.configured; Missing = @($marketing.shopee.missing) }
)

$incomplete = @()
foreach ($channel in $channels) {
  if ($channel.Configured) {
    Write-Ok "$($channel.Name): terkonfigurasi"
  } else {
    $missing = if ($channel.Missing.Count -gt 0) { $channel.Missing -join ', ' } else { 'tidak diketahui' }
    Write-Warn2 "$($channel.Name): belum lengkap (env kosong: $missing)"
    $incomplete += $channel.Name
  }
}

if ($RequireMarketing -and $incomplete.Count -gt 0) {
  Fail "Kanal Marketing belum lengkap: $($incomplete -join ', '). Isi .env VPS lalu jalankan ulang."
}

Write-Host ''
Write-Ok 'UPDATE SELESAI'
Write-Host "   Commit  : $newCommit"
Write-Host "   Akses   : https://bejodigitalprint.com"
Write-Host "   Service : $ServiceName ($((Get-Service $ServiceName).Status))"
Write-Host "   Log     : $AppDir\logs\stderr.log"
Write-Host ''
