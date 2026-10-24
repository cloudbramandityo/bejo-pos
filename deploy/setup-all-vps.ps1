<#
=====================================================================
  BEJO STIKER POS - MASTER SETUP VPS WINDOWS (Rumah Web)
=====================================================================
  Jalankan SEKALI di VPS Windows (PowerShell Administrator):

      powershell -ExecutionPolicy Bypass -File C:\deploy\setup-all-vps.ps1

  Yang dilakukan:
    1. Node.js 22, Caddy, NSSM
    2. PocketBase (database + realtime + auth) + service
    3. Build aplikasi + service BejoStikerPOS
    4. Caddyfile (HTTPS + route /api/pb) + service Caddy
    5. Verifikasi menyeluruh

  Prasyarat di VPS:
    - Source code sudah ada di C:\bejo-pos (termasuk folder deploy\)
    - File .env sudah dibuat di C:\bejo-pos\.env
=====================================================================
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root       = "C:\bejo-pos"
$deployDir  = Join-Path $root "deploy"
$Domain     = "bejodigitalprint.com"

function Write-Step { param($t) Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Write-Ok   { param($t) Write-Host "   [OK] $t" -ForegroundColor Green }
function Write-Warn { param($t) Write-Host "   [!] $t" -ForegroundColor Yellow }
function Write-Fail { param($t) Write-Host "   [FAIL] $t" -ForegroundColor Red; exit 1 }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Fail "HARUS dijalankan sebagai Administrator!" }

Write-Host "==================================================================" -ForegroundColor DarkCyan
Write-Host " BEJO STIKER POS - MASTER SETUP VPS WINDOWS" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor DarkCyan

if (-not (Test-Path $root)) { Write-Fail "Folder $root tidak ditemukan. Upload source code terlebih dahulu." }
if (-not (Test-Path (Join-Path $root "package.json"))) { Write-Fail "package.json tidak ditemukan di $root" }

# ---------------------------------------------------------------- 1. CORE
Write-Step "1/5 Instalasi Node.js, Caddy, NSSM & aplikasi"
& (Join-Path $deployDir "install-vps-windows.ps1")
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) { Write-Warn "Script instalasi core selesai dengan kode $LASTEXITCODE" }

# ---------------------------------------------------------------- 2. POCKETBASE
Write-Step "2/5 Instalasi PocketBase (database + realtime + auth)"
& (Join-Path $deployDir "setup-pocketbase.ps1")

# ---------------------------------------------------------------- 3. ENV
Write-Step "3/5 Memastikan .env tersedia"
$envPath = Join-Path $root ".env"
if (-not (Test-Path $envPath)) {
    if (Test-Path (Join-Path $root ".env.example")) {
        Copy-Item (Join-Path $root ".env.example") $envPath -Force
        Write-Warn ".env dibuat dari .env.example - WAJIB isi APP_URL & VITE_PB_SYNC_* !"
    } else {
        Write-Warn ".env tidak ditemukan & .env.example tidak ada - buat manual."
    }
} else {
    Write-Ok ".env tersedia"
}

# ---------------------------------------------------------------- 4. BUILD
Write-Step "4/5 Build aplikasi & restart service"
Set-Location $root
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
Write-Host "   npm ci ..." -ForegroundColor Yellow
& cmd /c "npm ci --no-audit --no-fund --include=dev 2>&1" | Select-Object -Last 2
if ($LASTEXITCODE -ne 0) { Write-Fail "npm ci gagal. Build memerlukan devDependencies (vite/esbuild)." }
Write-Host "   npm run build ..." -ForegroundColor Yellow
& cmd /c "npm run build 2>&1" | Select-String -Pattern "built in|error" | Select-Object -Last 2
if ($LASTEXITCODE -ne 0) { Write-Fail "npm run build gagal." }
if (-not (Test-Path (Join-Path $root "dist\server.cjs"))) { Write-Fail "dist\server.cjs tidak terbentuk." }

if (Test-Path "C:\nssm\nssm.exe") {
    & "C:\nssm\nssm.exe" stop BejoStikerPOS 2>&1 | Out-Null
    & "C:\nssm\nssm.exe" start BejoStikerPOS 2>&1 | Out-Null
    Write-Ok "Service BejoStikerPOS direstart"
} else {
    Write-Warn "Service BejoStikerPOS tidak ditemukan (NSSM belum terpasang?)"
}

# ---------------------------------------------------------------- 5. VERIFY
Write-Step "5/5 Verifikasi"
Start-Sleep -Seconds 6

Write-Host "`n=== SERVICE ===" -ForegroundColor Cyan
Get-Service BejoStikerPOS, Caddy, PocketBase -ErrorAction SilentlyContinue |
    Format-Table Name, Status, StartType -AutoSize

Write-Host "`n=== PORT ===" -ForegroundColor Cyan
netstat -ano | findstr ":80 :443 :3000 :8090"

Write-Host "`n=== HEALTH ===" -ForegroundColor Cyan
foreach ($u in @("http://127.0.0.1:8090/api/health", "http://127.0.0.1:3000/api/health", "https://$Domain/api/health")) {
    try {
        $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 8
        Write-Host "   [OK] $u -> $($r.StatusCode)" -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "   [!] $u -> $code" -ForegroundColor Yellow
    }
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host " MASTER SETUP SELESAI" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " Aplikasi  : https://$Domain" -ForegroundColor White
Write-Host " PocketBase: http://127.0.0.1:8090/_/  (Admin UI)" -ForegroundColor White
Write-Host ""
Write-Host " LANGKAH LANJUTAN:" -ForegroundColor Yellow
Write-Host " 1. Buka Admin UI PocketBase -> buat user sinkronisasi (sync@... / password)" -ForegroundColor White
Write-Host " 2. Jalankan pembuatan koleksi + migrasi data (dari PC):" -ForegroundColor White
Write-Host "      node scripts\create-pocketbase-collections.mjs --drop" -ForegroundColor White
Write-Host "      node scripts\migrate-firestore-to-pocketbase.mjs" -ForegroundColor White
Write-Host " 3. Pastikan DNS $Domain -> IP VPS & port 80/443 terbuka di panel" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
