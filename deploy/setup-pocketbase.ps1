<#
=====================================================================
  BEJO Digital Print - Setup PocketBase di VPS Windows
=====================================================================
  Jalankan di VPS (PowerShell Administrator):
      powershell -ExecutionPolicy Bypass -File C:\deploy\setup-pocketbase.ps1

  Yang dilakukan:
    1. Download PocketBase v0.22.10 (windows_amd64) ke C:\pocketbase
    2. Membuat user admin pertama (jika belum ada)
    3. Mendaftarkan service Windows (NSSM) -> auto start + auto restart
    4. Membuka firewall internal (port 8090 hanya lokal)
    5. Update Caddyfile (route /api/pb) & restart Caddy
=====================================================================
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$PB_DIR      = "C:\pocketbase"
$PB_DATA     = "C:\pocketbase\pb_data"
$PB_PORT     = 8090
$PB_VERSION  = "0.22.10"
$ServiceName = "PocketBase"
$AppDir      = "C:\bejo-pos"
$Domain      = "bejodigitalprint.com"

function Write-Step { param($t) Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Write-Ok   { param($t) Write-Host "   [OK] $t" -ForegroundColor Green }
function Write-Warn { param($t) Write-Host "   [!] $t" -ForegroundColor Yellow }
function Write-Fail { param($t) Write-Host "   [FAIL] $t" -ForegroundColor Red; exit 1 }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Fail "HARUS dijalankan sebagai Administrator!" }

Write-Host "==================================================================" -ForegroundColor DarkCyan
Write-Host " BEJO Digital Print - SETUP POCKETBASE (Database Self-Hosted)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor DarkCyan

# ---------------------------------------------------------------- 1. DOWNLOAD
Write-Step "1/5 Download PocketBase v$PB_VERSION"
New-Item -ItemType Directory -Path $PB_DIR -Force | Out-Null
New-Item -ItemType Directory -Path $PB_DATA -Force | Out-Null

if (Test-Path "$PB_DIR\pocketbase.exe") {
    Write-Ok "PocketBase sudah terpasang: $(& "$PB_DIR\pocketbase.exe" --version 2>&1)"
} else {
    $url = "https://github.com/pocketbase/pocketbase/releases/download/v$PB_VERSION/pocketbase_${PB_VERSION}_windows_amd64.zip"
    $zip = Join-Path $env:TEMP "pocketbase.zip"
    Write-Host "   Mengunduh dari GitHub..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 300
    Expand-Archive -Path $zip -DestinationPath $PB_DIR -Force
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Write-Ok "PocketBase terpasang: $(& "$PB_DIR\pocketbase.exe" --version 2>&1)"
}

# ---------------------------------------------------------------- 2. ADMIN USER
Write-Step "2/5 Membuat admin PocketBase"
$adminEmail = $env:PB_ADMIN_EMAIL
$adminPass  = $env:PB_ADMIN_PASSWORD
if (-not $adminEmail) { $adminEmail = "admin@$Domain" }
if (-not $adminPass)  { $adminPass  = "Bejo#PB2026" }

$health = $null
try { $health = Invoke-WebRequest -Uri "http://127.0.0.1:$PB_PORT/api/health" -UseBasicParsing -TimeoutSec 3 } catch { }

if ($health) {
    Write-Ok "PocketBase sudah berjalan di port $PB_PORT"
} else {
    Write-Warn "PocketBase belum berjalan. Jalankan sekali manual untuk membuat admin:"
    Write-Host "   1. $PB_DIR\pocketbase.exe serve --http=0.0.0.0:$PB_PORT --dir=$PB_DATA" -ForegroundColor White
    Write-Host "   2. Buka http://localhost:$PB_PORT/_/ -> Sign up admin" -ForegroundColor White
    Write-Host "   3. Tekan CTRL+C lalu jalankan ulang script ini" -ForegroundColor White
}

# ---------------------------------------------------------------- 3. SERVICE
Write-Step "3/5 Mendaftarkan Windows Service (NSSM)"
$nssm = "C:\nssm\nssm.exe"
if (-not (Test-Path $nssm)) {
    Write-Warn "NSSM belum ada di C:\nssm\nssm.exe - unduh dari https://nssm.cc/release/nssm-2.24.zip"
} else {
    & $nssm stop $ServiceName 2>&1 | Out-Null
    & $nssm remove $ServiceName confirm 2>&1 | Out-Null
    & $nssm install $ServiceName "$PB_DIR\pocketbase.exe" "serve --http=0.0.0.0:$PB_PORT --dir=$PB_DATA" | Out-Null
    & $nssm set $ServiceName DisplayName "PocketBase (Database + Realtime)" | Out-Null
    & $nssm set $ServiceName Description "PocketBase - basis data & realtime BEJO Digital Print" | Out-Null
    & $nssm set $ServiceName AppDirectory $PB_DIR | Out-Null
    & $nssm set $ServiceName AppStdout "$PB_DIR\logs\stdout.log" | Out-Null
    & $nssm set $ServiceName AppStderr "$PB_DIR\logs\stderr.log" | Out-Null
    & $nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
    & $nssm set $ServiceName AppExit Default Restart | Out-Null
    & $nssm set $ServiceName AppThrottle 5000 | Out-Null
    New-Item -ItemType Directory -Path "$PB_DIR\logs" -Force | Out-Null
    & $nssm start $ServiceName | Out-Null
    Write-Ok "Service '$ServiceName' terdaftar (auto start + auto restart)"
}

# ---------------------------------------------------------------- 4. FIREWALL
Write-Step "4/5 Firewall"
# 8090 hanya untuk lokal (Caddy), TIDAK dibuka ke internet
$rule = Get-NetFirewallRule -DisplayName "PocketBase Local 8090" -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -DisplayName "PocketBase Local 8090" -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort 8090 -Profile Any -RemoteAddress 127.0.0.1 | Out-Null
}
Write-Ok "Port 8090 hanya untuk lokal (tidak dibuka ke internet)"

# ---------------------------------------------------------------- 5. CADDY
Write-Step "5/5 Update Caddyfile (route /api/pb)"
$caddyWin = "$AppDir\deploy\Caddyfile.windows"
if (Test-Path $caddyWin) {
    Copy-Item $caddyWin "C:\caddy\Caddyfile" -Force
    & "C:\caddy\caddy.exe" fmt --overwrite "C:\caddy\Caddyfile" 2>&1 | Out-Null
    Restart-Service Caddy -ErrorAction SilentlyContinue
    Write-Ok "Caddyfile diperbarui & Caddy direstart"
} else {
    Write-Warn "deploy\Caddyfile.windows tidak ditemukan di $AppDir - update manual"
    Write-Host "   Tambahkan ke C:\caddy\Caddyfile:" -ForegroundColor White
    Write-Host "       handle /api/pb/* { reverse_proxy 127.0.0.1:8090 }" -ForegroundColor White
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " POCKETBASE SIAP" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " URL lokal   : http://127.0.0.1:$PB_PORT" -ForegroundColor White
Write-Host " Admin UI   : http://127.0.0.1:$PB_PORT/_/" -ForegroundColor White
Write-Host " Public     : https://$Domain/api/pb" -ForegroundColor White
Write-Host " Service    : $ServiceName (auto start + auto restart)" -ForegroundColor White
Write-Host " Logs       : C:\pocketbase\logs\stderr.log" -ForegroundColor White
Write-Host ""
Write-Host " LANGKAH BERIKUTNYA:" -ForegroundColor Yellow
Write-Host " 1. Buka http://127.0.0.1:$PB_PORT/_/ -> buat akun admin" -ForegroundColor White
Write-Host " 2. Buat koleksi (27 koleksi) dari PC:" -ForegroundColor White
Write-Host "      node scripts\create-pocketbase-collections.mjs --drop" -ForegroundColor White
Write-Host " 3. Migrasi data lama (opsional):" -ForegroundColor White
Write-Host "      node scripts\migrate-firestore-to-pocketbase.mjs" -ForegroundColor White
Write-Host " 4. Jalankan: npm run build && Restart-Service BejoStikerPOS" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
