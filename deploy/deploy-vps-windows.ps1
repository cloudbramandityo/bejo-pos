<#
=====================================================================
  BEJO STIKER POS - Deploy / Update aplikasi di VPS WINDOWS
=====================================================================
  Jalankan DI DALAM VPS (PowerShell sebagai Administrator):

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-vps-windows.ps1

  Yang dilakukan:
    1. Backup build sebelumnya ke C:\backups\bejo-pos
    2. npm ci + build produksi
    3. Restart Windows Service (BejoStikerPOS)
    4. Health check + rollback ke build lama bila gagal
=====================================================================
#>

$ErrorActionPreference = 'Stop'
$AppDir      = "C:\bejo-pos"
$BackupDir   = "C:\backups\bejo-pos"
$ServiceName = "BejoStikerPOS"
$HealthUrl   = "http://127.0.0.1:3000/api/health"
$Staging     = Join-Path $env:TEMP "bejo-staging"

function Write-Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "   [OK] $t" -ForegroundColor Green }
function Write-Warn2($t){ Write-Host "   [!]  $t" -ForegroundColor Yellow }
function Write-Fail($t) { Write-Host "   [FAIL] $t" -ForegroundColor Red; exit 1 }

Set-Location $AppDir

# ---------------------------------------------------------------- 0 env
Write-Step "0/5 Memeriksa environment variable (.env)"
if (-not (Test-Path "$AppDir\.env")) {
  if (Test-Path "$AppDir\.env.example") {
    Copy-Item "$AppDir\.env.example" "$AppDir\.env"
    Write-Warn2 ".env dibuat dari .env.example - ISI SEKARANG (APP_URL, GEMINI_API_KEY, REMOTE_ACCESS_*)"
  } else {
    Write-Fail ".env tidak ditemukan. Salin .env.example menjadi .env lalu isi nilainya."
  }
}

# ---------------------------------------------------------------- 1 backup
Write-Step "1/5 Backup build sebelumnya"
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (Test-Path "$AppDir\dist") {
  if (Test-Path "$BackupDir\dist-$stamp") { Remove-Item "$BackupDir\dist-$stamp" -Recurse -Force }
  Copy-Item "$AppDir\dist" "$BackupDir\dist-$stamp" -Recurse -Force
  Write-Ok "Backup: $BackupDir\dist-$stamp"
  # simpan 5 build terakhir
  Get-ChildItem $BackupDir -Directory -Filter "dist-*" |
    Sort-Object Name -Descending | Select-Object -Skip 5 |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
}

# ---------------------------------------------------------------- 2 deps
Write-Step "2/5 Installing dependensi"
if (Test-Path "$AppDir\package-lock.json") {
  npm.cmd ci --no-audit --no-fund --include=dev
} else {
  npm.cmd install --no-audit --no-fund --include=dev
}
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install gagal." }

# ---------------------------------------------------------------- 3 build
Write-Step "3/5 Build produksi"
$env:NODE_ENV = "production"
npm.cmd run build
if ($LASTEXITCODE -ne 0) { Write-Fail "Build gagal." }
Write-Ok "Build selesai"

# ---------------------------------------------------------------- 4 restart
Write-Step "4/5 Restart service"
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
  Restart-Service -Name $ServiceName -Force
  Write-Ok "Service $ServiceName direstart"
} else {
  Write-Warn2 "Service $ServiceName belum terdaftar. Jalankan install-vps-windows.ps1 lebih dulu."
}

# ---------------------------------------------------------------- 5 health
Write-Step "5/5 Health check"
$healthy = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest $HealthUrl -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $healthy = $true; break }
  } catch { }
}

if ($healthy) {
  Write-Ok "Aplikasi sehat:"
  (Invoke-WebRequest $HealthUrl -UseBasicParsing -TimeoutSec 5).Content
} else {
  Write-Warn2 "Health check gagal. Log service:"
  Get-Content "$AppDir\logs\stderr.log" -Tail 40 -ErrorAction SilentlyContinue
  Write-Warn2 "Mencoba rollback ke build sebelumnya..."
  $prev = Get-ChildItem $BackupDir -Directory -Filter "dist-*" |
    Sort-Object Name -Descending | Select-Object -Skip 1 | Select-Object -First 1
  if ($prev) {
    Remove-Item "$AppDir\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item $prev.FullName "$AppDir\dist" -Recurse -Force
    Restart-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Write-Ok "Rollback ke $($prev.Name) selesai."
  } else {
    Write-Fail "Tidak ada build lama untuk rollback."
  }
}

Write-Host ""
Write-Ok "DEPLOY SELESAI"
Write-Host "   Akses  : https://bejodigitalprint.com"
Write-Host "   Log    : C:\bejo-pos\logs\stderr.log"
Write-Host "   Status : Get-Service $ServiceName"
Write-Host ""
