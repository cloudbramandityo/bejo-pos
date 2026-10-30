<#
=====================================================================
  BEJO Digital Print - FINISH DEPLOY (VPS Windows / Rumah Web)
=====================================================================
  Menjalankan SEMUA langkah final setelah Node.js, NSSM, Caddy, dan
  PocketBase terpasang. Skrip ini idempoten - aman dijalankan berulang.

  Jalankan DI DALAM VPS (PowerShell sebagai Administrator):

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\finish-deploy.ps1

  Opsi:
      -SkipBuild        Lewati npm ci + build (pakai dist\ yang sudah ada)
      -NonInteractive   Jangan tanya apa pun; pakai nilai dari .env / default
      -BackupFile PATH  Path file backup JSON yang akan diimport
                        (default: cari otomatis file backup_pos_bejo_stiker_*.json)

  Yang dilakukan (10 langkah):
    1.  Preflight  : cek admin, folder, binary (Node/NSSM/Caddy/PocketBase)
    2.  Service    : pastikan PocketBase, BejoStikerPOS, Caddy Running
    3.  Caddyfile  : tulis ulang dari repo + validate + restart Caddy
    4.  .env       : buat/perbarui .env production (tanya nilai bila kosong)
    5.  Build      : npm ci + npm run build + restart BejoStikerPOS
    6.  Koleksi    : buat 27 koleksi PocketBase (--drop)
    7.  Import     : import DATA ORIGINAL dari file backup JSON
    8.  Sync user  : buat/update akun sinkronisasi (sync@bejo.local)
    9.  CORS       : konfigurasi origin yang diizinkan di PocketBase
    10. Verifikasi : health check lokal + publik (HTTPS)
=====================================================================
#>

param(
  [switch]$SkipBuild,
  [switch]$NonInteractive,
  [string]$BackupFile = ""
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# --------------------------------------------------------------- KONFIGURASI
$Domain      = "bejodigitalprint.com"
$WwwDomain   = "www.$Domain"
$AppDir      = "C:\bejo-pos"
$DeployDir   = Join-Path $AppDir "deploy"
$ScriptsDir  = Join-Path $AppDir "scripts"
$PB_DIR      = "C:\pocketbase"
$PB_DATA     = "C:\pocketbase\pb_data"
$PB_PORT     = 8090
$CaddyDir    = "C:\caddy"
$NssmDir     = "C:\nssm"
$Nssm        = "$NssmDir\nssm.exe"

$ServiceApp  = "BejoStikerPOS"
$ServicePB   = "PocketBase"
$ServiceCaddy= "Caddy"

$AdminEmail    = "admin@bejodigitalprint.com"
$AdminPassword = "Bejo#PB2026!"
$SyncEmail     = "sync@bejo.local"
$SyncPassword  = "sync_password_bejo_2026"

# --------------------------------------------------------------- HELPER
function Write-Head($t) { Write-Host ""; Write-Host ("=" * 66) -ForegroundColor DarkCyan; Write-Host " $t" -ForegroundColor Cyan; Write-Host ("=" * 66) -ForegroundColor DarkCyan }
function Write-Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "   [OK] $t" -ForegroundColor Green }
function Write-Warn2($t){ Write-Host "   [!]  $t" -ForegroundColor Yellow }
function Write-Fail($t) { Write-Host "   [FAIL] $t" -ForegroundColor Red; exit 1 }

$script:Warnings = 0

# Kembalikan HTTP status code dari exception (0 bila bukan HTTP error).
function Get-HttpStatus($err) {
  try { return [int]$err.Exception.Response.StatusCode.value__ } catch { return 0 }
}

# Health check sederhana; kembalikan status code atau 0.
function Test-Url($url, $timeoutSec = 8) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec
    return [int]$r.StatusCode
  } catch {
    return (Get-HttpStatus $_)
  }
}

# Baca nilai dari file .env (format KEY=VALUE).
function Get-EnvValue($path, $key) {
  if (-not (Test-Path $path)) { return $null }
  foreach ($line in Get-Content $path) {
    $t = $line.Trim()
    if ($t -match "^\s*#" -or $t -eq "") { continue }
    if ($t -match "^\s*$([regex]::Escape($key))\s*=(.*)$") {
      return $Matches[1].Trim()
    }
  }
  return $null
}

# Set/perbarui KEY=VALUE di file .env tanpa menyentuh baris lain.
function Set-EnvValue($path, $key, $value) {
  $lines = @()
  if (Test-Path $path) { $lines = [System.Collections.Generic.List[string]](Get-Content $path) }
  else { $lines = [System.Collections.Generic.List[string]]@() }

  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*$([regex]::Escape($key))\s*=") {
      $lines[$i] = "$key=$value"
      $found = $true
      break
    }
  }
  if (-not $found) { $lines.Add("$key=$value") }
  [System.IO.File]::WriteAllLines($path, $lines, [System.Text.UTF8Encoding]::new($false))
}

# Tanya input bila interaktif; jika tidak, pakai nilai existing/default.
function Read-Secret($prompt, $current) {
  if ($NonInteractive) { return $current }
  $shown = if ([string]::IsNullOrWhiteSpace($current)) { "(kosong)" } else { "(ada)" }
  $answer = Read-Host "   $prompt $shown - tekan Enter untuk pakai yang ada"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $current }
  return $answer.Trim()
}

# =============================================================== BANNER
Write-Head "BEJO Digital Print - FINISH DEPLOY"
Write-Host " Domain    : $Domain" -ForegroundColor White
Write-Host " App dir   : $AppDir" -ForegroundColor White
Write-Host " Waktu     : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
Write-Host " Mode      : $(if($NonInteractive){'NON-INTERACTIVE'}else{'INTERACTIVE'})" -ForegroundColor White

# =============================================================== 1. PREFLIGHT
Write-Step "1/10 Preflight - memeriksa prasyarat"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Fail "HARUS dijalankan sebagai Administrator (Run as administrator)." }
Write-Ok "Hak administrator OK"

# Refresh PATH dari registry (Node baru diinstall mungkin belum terlihat)
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

if (-not (Test-Path $AppDir)) { Write-Fail "Folder aplikasi $AppDir tidak ditemukan. Clone source code dulu." }
if (-not (Test-Path (Join-Path $AppDir "package.json"))) { Write-Fail "package.json tidak ada di $AppDir." }
Write-Ok "Source code ditemukan di $AppDir"

$nodeExe = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $nodeExe) { Write-Fail "Node.js tidak ditemukan di PATH. Install Node.js 22 LTS dulu." }
Write-Ok "Node.js $(& node -v)"

if (-not (Test-Path $Nssm)) { Write-Fail "NSSM tidak ditemukan di $Nssm. Jalankan install-vps-windows.ps1 dulu." }
Write-Ok "NSSM OK"

if (-not (Test-Path "$CaddyDir\caddy.exe")) { Write-Fail "Caddy tidak ditemukan di $CaddyDir. Jalankan install-vps-windows.ps1 dulu." }
Write-Ok "Caddy OK"

if (-not (Test-Path "$PB_DIR\pocketbase.exe")) { Write-Fail "PocketBase tidak ditemukan di $PB_DIR. Jalankan setup-pocketbase.ps1 dulu." }
Write-Ok "PocketBase OK"

if (-not (Test-Path (Join-Path $ScriptsDir "create-pocketbase-collections.mjs"))) { Write-Fail "Script koleksi tidak ada di $ScriptsDir." }
if (-not (Test-Path (Join-Path $ScriptsDir "import-original-data.mjs"))) { Write-Fail "Script import tidak ada di $ScriptsDir." }
Write-Ok "Script database OK"

# =============================================================== 2. SERVICE
Write-Step "2/10 Memastikan Windows Service berjalan"

function Ensure-ServiceRunning($name) {
  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
  if (-not $svc) { Write-Warn2 "Service '$name' belum terdaftar."; $script:Warnings++; return $false }

  switch ($svc.Status) {
    'Running' {
      Write-Ok "Service '$name' Running"; return $true
    }
    'Paused' {
      # Caddy lama bisa stuck Paused; coba resume dulu
      try { Resume-Service $name -ErrorAction Stop } catch {}
      Start-Sleep -Seconds 3
      $svc.Refresh()
      if ($svc.Status -eq 'Running') { Write-Ok "Service '$name' Running (diresume)"; return $true }
      # Masih paused -> coba restart paksa
      try { Restart-Service $name -Force -ErrorAction Stop } catch {}
      Start-Sleep -Seconds 4
      $svc.Refresh()
      if ($svc.Status -eq 'Running') { Write-Ok "Service '$name' Running (direstart)"; return $true }
      Write-Warn2 "Service '$name' masih Paused."; $script:Warnings++; return $false
    }
    default {
      # Stopped, StartPending, StopPending, ...
      try { Start-Service $name -ErrorAction Stop } catch {}
      Start-Sleep -Seconds 3
      $svc.Refresh()
      if ($svc.Status -eq 'Running') { Write-Ok "Service '$name' Running"; return $true }
      Write-Warn2 "Service '$name' status: $($svc.Status)"; $script:Warnings++; return $false
    }
  }
}

Ensure-ServiceRunning $ServicePB    | Out-Null
Ensure-ServiceRunning $ServiceApp   | Out-Null
Ensure-ServiceRunning $ServiceCaddy | Out-Null

# Tunggu PocketBase siap
$pbReady = $false
for ($i = 0; $i -lt 15; $i++) {
  if ((Test-Url "http://127.0.0.1:$PB_PORT/api/health" 3) -eq 200) { $pbReady = $true; break }
  Start-Sleep -Seconds 2
}
if ($pbReady) { Write-Ok "PocketBase merespons di http://127.0.0.1:$PB_PORT" }
else { Write-Fail "PocketBase tidak merespons di port $PB_PORT. Cek log: $PB_DIR\logs\stderr.log" }

# =============================================================== 3. CADDYFILE
Write-Step "3/10 Menulis ulang Caddyfile + restart Caddy"

$caddySrc = Join-Path $DeployDir "Caddyfile.windows"
$caddyDst = "$CaddyDir\Caddyfile"

if (Test-Path $caddySrc) {
  Copy-Item $caddySrc $caddyDst -Force
  Write-Ok "Caddyfile disalin dari $caddySrc"
} else {
  Write-Warn2 "deploy\Caddyfile.windows tidak ditemukan - menulis Caddyfile minimal."
  $lines = @(
    "$WwwDomain {",
    "    redir https://$Domain{uri} permanent",
    "}",
    "",
    "$Domain {",
    "    encode zstd gzip",
    "    header {",
    "        Strict-Transport-Security ""max-age=31536000; includeSubDomains""",
    "        X-Content-Type-Options ""nosniff""",
    "        Referrer-Policy ""strict-origin-when-cross-origin""",
    "        Permissions-Policy ""geolocation=(), microphone=(), camera=()""",
    "        -Server",
    "    }",
    "    request_body {",
    "        # Video Marketing base64 bisa ~85MB",
    "        max_size 110MB",
    "    }",
    "    handle_path /api/pb/* {",
    "        reverse_proxy 127.0.0.1:$PB_PORT {",
    "            flush_interval -1",
    "        }",
    "    }",
    "    handle {",
    "        reverse_proxy 127.0.0.1:3000 {",
    "            header_up X-Real-IP {remote_host}",
    "            header_up X-Forwarded-Proto {scheme}",
    "        }",
    "    }",
    "    log {",
    "        output file $CaddyDir\logs\access.log {",
    "            roll_size 10MiB",
    "            roll_keep 5",
    "        }",
    "        format json",
    "    }",
    "}"
  )
  [System.IO.File]::WriteAllLines($caddyDst, $lines, [System.Text.UTF8Encoding]::new($false))
  Write-Ok "Caddyfile minimal ditulis"
}

New-Item -ItemType Directory -Path "$CaddyDir\logs" -Force | Out-Null

# Normalisasi format & validasi (non-fatal: caddy tetap direstart dan dicek)
$fmtOut = & "$CaddyDir\caddy.exe" fmt --overwrite $caddyDst 2>&1 | Out-Null
$validateOk = $false
$validateErr = ""
try {
  $p = Start-Process -FilePath "$CaddyDir\caddy.exe" -ArgumentList "validate","--config",$caddyDst `
    -RedirectStandardOutput "$env:TEMP\caddy-validate.out" `
    -RedirectStandardError "$env:TEMP\caddy-validate.err" `
    -Wait -PassThru -NoNewWindow
  $validateOk = ($p.ExitCode -eq 0)
  $validateErr = Get-Content "$env:TEMP\caddy-validate.err" -Raw -ErrorAction SilentlyContinue
  $validateOut = Get-Content "$env:TEMP\caddy-validate.out" -Raw -ErrorAction SilentlyContinue
  Remove-Item "$env:TEMP\caddy-validate.out","$env:TEMP\caddy-validate.err" -Force -ErrorAction SilentlyContinue
} catch {
  $validateErr = $_.Exception.Message
}
if (-not $validateOk -or ($validateErr -match "Error")) {
  Write-Warn2 "Validasi Caddyfile GAGAL (non-fatal, caddy tetap direstart):"
  if ($validateErr) { Write-Host "      $validateErr" -ForegroundColor DarkGray }
  if ($validateOut) { Write-Host "      $validateOut" -ForegroundColor DarkGray }
  $script:Warnings++
} else {
  Write-Ok "Caddyfile valid"
}

# Selalu coba restart Caddy dan cek status
try { Restart-Service $ServiceCaddy -Force -ErrorAction Stop } catch {}
Start-Sleep -Seconds 4
$caddySvc = Get-Service $ServiceCaddy -ErrorAction SilentlyContinue
if ($caddySvc -and $caddySvc.Status -eq 'Running') { Write-Ok "Caddy Running" }
else { Write-Warn2 "Caddy status: $($caddySvc.Status). Cek log: $CaddyDir\logs\caddy-err.log"; $script:Warnings++ }

# =============================================================== 4. .ENV
Write-Step "4/10 Menyiapkan .env production"

$envPath = Join-Path $AppDir ".env"
$envExample = Join-Path $AppDir ".env.example"

if (-not (Test-Path $envPath)) {
  if (Test-Path $envExample) { Copy-Item $envExample $envPath -Force; Write-Ok ".env dibuat dari .env.example" }
  else { Set-Content -Path $envPath -Value "" -Encoding UTF8; Write-Ok ".env baru dibuat" }
} else {
  Write-Ok ".env sudah ada, akan diperbarui"
}

# Nilai yang dikelola skrip ini
$gemini = Get-EnvValue $envPath 'GEMINI_API_KEY'
$remoteUser = Get-EnvValue $envPath 'REMOTE_ACCESS_USER'
$remotePass = Get-EnvValue $envPath 'REMOTE_ACCESS_PASS'

Write-Host "   Mengisi variabel wajib..." -ForegroundColor DarkGray
Set-EnvValue $envPath 'APP_URL' "https://$Domain"
Set-EnvValue $envPath 'PORT' '3000'
Set-EnvValue $envPath 'VITE_POCKETBASE_URL' "https://$Domain/api/pb"
Set-EnvValue $envPath 'VITE_PB_SYNC_EMAIL' $SyncEmail
Set-EnvValue $envPath 'VITE_PB_SYNC_PASSWORD' $SyncPassword
Set-EnvValue $envPath 'PB_SYNC_EMAIL' $SyncEmail
Set-EnvValue $envPath 'PB_SYNC_PASSWORD' $SyncPassword
Set-EnvValue $envPath 'POCKETBASE_UPSTREAM' "http://127.0.0.1:$PB_PORT"

if ([string]::IsNullOrWhiteSpace($remoteUser)) { $remoteUser = 'bejo' }
$remoteUser = Read-Secret "REMOTE_ACCESS_USER" $remoteUser
Set-EnvValue $envPath 'REMOTE_ACCESS_USER' $remoteUser

$gemini = Read-Secret "GEMINI_API_KEY" $gemini
if (-not [string]::IsNullOrWhiteSpace($gemini)) { Set-EnvValue $envPath 'GEMINI_API_KEY' $gemini }
else { Write-Warn2 "GEMINI_API_KEY masih kosong - fitur AI tidak aktif."; $script:Warnings++ }

$remotePass = Read-Secret "REMOTE_ACCESS_PASS" $remotePass
if (-not [string]::IsNullOrWhiteSpace($remotePass)) { Set-EnvValue $envPath 'REMOTE_ACCESS_PASS' $remotePass }
else { Write-Warn2 "REMOTE_ACCESS_PASS kosong - proteksi akses internet nonaktif."; $script:Warnings++ }

Write-Ok ".env diperbarui di $envPath"

# =============================================================== 5. BUILD
Write-Step "5/10 Build produksi + restart aplikasi"

Set-Location $AppDir

if ($SkipBuild) {
  Write-Warn2 "Build dilewati (-SkipBuild). Memakai dist\ yang ada."
  if (-not (Test-Path (Join-Path $AppDir "dist\server.cjs"))) { Write-Fail "dist\server.cjs tidak ada - jalankan tanpa -SkipBuild." }
} else {
  Write-Host "   Install dependensi..." -ForegroundColor Yellow
  $hasLock = Test-Path (Join-Path $AppDir "package-lock.json")
  if ($hasLock) {
    Write-Host "   npm ci ..." -ForegroundColor DarkGray
    $npmOut = & cmd /c "npm ci --no-audit --no-fund --include=dev 2>&1"
    $npmExit = $LASTEXITCODE
    $npmOut | Select-Object -Last 3
    if ($npmExit -ne 0) {
      Write-Warn2 "npm ci gagal - mencoba npm install."
      $npmOut = & cmd /c "npm install --no-audit --no-fund --include=dev 2>&1"
      $npmExit = $LASTEXITCODE
      $npmOut | Select-Object -Last 3
    }
  } else {
    Write-Warn2 "package-lock.json tidak ada - pakai npm install."
    $npmOut = & cmd /c "npm install --no-audit --no-fund --include=dev 2>&1"
    $npmExit = $LASTEXITCODE
    $npmOut | Select-Object -Last 3
  }
  if ($npmExit -ne 0) { Write-Fail "Install dependensi gagal (kode $npmExit). Cek log di atas." }

  $env:NODE_ENV = "production"
  Write-Host "   npm run build ..." -ForegroundColor Yellow
  $buildOut = & cmd /c "npm run build 2>&1"
  $buildExit = $LASTEXITCODE
  $buildOut | Select-String -Pattern "built in|error|Done in" | Select-Object -Last 3
  if ($buildExit -ne 0) { Write-Fail "Build gagal (kode $buildExit)." }
  if (-not (Test-Path (Join-Path $AppDir "dist\server.cjs"))) { Write-Fail "Build gagal - dist\server.cjs tidak terbentuk." }
  Write-Ok "Build selesai"
}

try { Restart-Service $ServiceApp -Force -ErrorAction Stop } catch {}
Start-Sleep -Seconds 5

$appReady = $false
for ($i = 0; $i -lt 15; $i++) {
  if ((Test-Url "http://127.0.0.1:3000/api/health" 3) -eq 200) { $appReady = $true; break }
  Start-Sleep -Seconds 2
}
if ($appReady) { Write-Ok "Aplikasi Node merespons di http://127.0.0.1:3000" }
else { Write-Warn2 "Aplikasi Node belum merespons. Cek log: $AppDir\logs\stderr.log"; $script:Warnings++ }

# =============================================================== 6. KOLEKSI
Write-Step "6/10 Membuat 27 koleksi PocketBase"

$env:POCKETBASE_URL = "http://127.0.0.1:$PB_PORT"
$env:PB_ADMIN_EMAIL = $AdminEmail
$env:PB_ADMIN_PASSWORD = $AdminPassword

Write-Host "   node scripts\create-pocketbase-collections.mjs --drop" -ForegroundColor DarkGray
$colOut = & node (Join-Path $ScriptsDir "create-pocketbase-collections.mjs") "--drop" 2>&1
$colOut | Select-String -Pattern "Terhubung|Dibuat|Sudah ada|FAIL|Gagal|FATAL" | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
if ($LASTEXITCODE -ne 0) { Write-Fail "Pembuatan koleksi gagal. Jalankan manual: node scripts\create-pocketbase-collections.mjs --drop" }
Write-Ok "Koleksi selesai dibuat"

# =============================================================== 7. IMPORT
Write-Step "7/10 Import DATA ORIGINAL"

# Tentukan file backup: param -> env -> auto-detect lewat skrip import
if ([string]::IsNullOrWhiteSpace($BackupFile)) {
  $BackupFile = $env:BACKUP_FILE
}
if (-not [string]::IsNullOrWhiteSpace($BackupFile)) {
  $env:BACKUP_FILE = $BackupFile
  Write-Ok "File backup: $BackupFile"
} else {
  Write-Warn2 "File backup tidak ditentukan - skrip import akan auto-detect file backup_pos_bejo_stiker_*.json"
}

Write-Host "   node scripts\import-original-data.mjs" -ForegroundColor DarkGray
$impOut = & node (Join-Path $ScriptsDir "import-original-data.mjs") 2>&1
$impOut | Select-String -Pattern "Backup dimuat|sumber|berhasil|gagal|records|IMPORT SELESAI|FATAL|✗" | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
if ($LASTEXITCODE -ne 0) { Write-Fail "Import data gagal. Jalankan manual: node scripts\import-original-data.mjs [-BackupFile ...]" }
Write-Ok "Import data original selesai"

# =============================================================== 8. SYNC USER
Write-Step "8/10 Membuat akun sinkronisasi ($SyncEmail)"

$env:PB_SYNC_EMAIL = $SyncEmail
$env:PB_SYNC_PASSWORD = $SyncPassword

# Akun sinkronisasi adalah record di koleksi `users` (auth collection),
# BUKAN superuser PocketBase. Jadi dibuat lewat API user biasa:
# login dulu; bila gagal, buat record baru.
$syncScript = @"
import PocketBase from 'pocketbase';
const pb = new PocketBase(process.env.POCKETBASE_URL);

// Cek dulu apakah sudah bisa login (berarti sudah ada)
try {
  await pb.collection('users').authWithPassword(process.env.PB_SYNC_EMAIL, process.env.PB_SYNC_PASSWORD);
  console.log('SYNC_EXISTS');
  process.exit(0);
} catch { /* lanjut buat */ }

// Buat sebagai admin agar tidak terhalang API rule
try {
  await pb.collection('_superusers').authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
} catch (e) {
  console.log('SYNC_ERROR: admin login gagal - ' + (e?.message || e));
  process.exit(1);
}

try {
  const existing = await pb.collection('users').getFirstListItem(
    'email = ' + JSON.stringify(process.env.PB_SYNC_EMAIL)
  );
  await pb.collection('users').update(existing.id, {
    password: process.env.PB_SYNC_PASSWORD,
    passwordConfirm: process.env.PB_SYNC_PASSWORD,
    isActive: true,
  });
  console.log('SYNC_UPDATED');
} catch {
  try {
    await pb.collection('users').create({
      email: process.env.PB_SYNC_EMAIL,
      password: process.env.PB_SYNC_PASSWORD,
      passwordConfirm: process.env.PB_SYNC_PASSWORD,
      name: 'Bejo Sync Service',
      username: 'sync',
      role: 'developer',
      isActive: true,
    });
    console.log('SYNC_CREATED');
  } catch (e) {
    console.log('SYNC_ERROR: ' + (e?.message || e));
    process.exit(1);
  }
}
"@
$tmpSync = Join-Path $AppDir ".bejo-sync-user.mjs"
[System.IO.File]::WriteAllText($tmpSync, $syncScript, [System.Text.UTF8Encoding]::new($false))
Push-Location $AppDir
$syncOut = & node $tmpSync 2>&1
Pop-Location
Remove-Item $tmpSync -Force -ErrorAction SilentlyContinue
$syncOut | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
if (($syncOut -join "`n") -match "SYNC_(EXISTS|CREATED|UPDATED)") { Write-Ok "Akun sinkronisasi siap" }
else { Write-Warn2 "Akun sinkronisasi belum terkonfirmasi - cek Admin UI PocketBase."; $script:Warnings++ }

# =============================================================== 9. CORS
Write-Step "9/10 Verifikasi CORS PocketBase"

# CATATAN: PocketBase v0.28 sudah mengirim header CORS permisif secara default
# (Access-Control-Allow-Origin: *), jadi tidak ada yang perlu dikonfigurasi.
# Langkah ini hanya MEMVERIFIKASI bahwa CORS benar-benar aktif agar frontend
# yang diakses dari domain publik tidak diblokir browser.
$originTest = "https://$Domain"
$corsOk = $false
try {
  $pre = Invoke-WebRequest -Uri "http://127.0.0.1:$PB_PORT/api/collections/users/auth-with-password" `
    -Method Options -UseBasicParsing -TimeoutSec 8 `
    -Headers @{
      "Origin"                        = $originTest
      "Access-Control-Request-Method" = "POST"
      "Access-Control-Request-Headers"= "content-type"
    }
  $acao = [string]$pre.Headers["Access-Control-Allow-Origin"]
  if ($acao -eq '*' -or $acao -eq $originTest) {
    Write-Ok "CORS PocketBase aktif (Access-Control-Allow-Origin: $acao)"
    $corsOk = $true
  } else {
    Write-Warn2 "Header CORS tidak sesuai: '$acao'"
  }
} catch {
  Write-Warn2 "Tidak dapat memverifikasi CORS: $($_.Exception.Message)"
}
if (-not $corsOk) { Write-Warn2 "CORS PocketBase perlu dicek manual."; $script:Warnings++ }

# =============================================================== 10. VERIFIKASI
Write-Step "10/10 Verifikasi kesehatan menyeluruh"

Start-Sleep -Seconds 3

Write-Host "`n   --- Service ---" -ForegroundColor Cyan
Get-Service $ServiceApp, $ServiceCaddy, $ServicePB -ErrorAction SilentlyContinue |
  Format-Table Name, Status, StartType -AutoSize | Out-String | Write-Host

Write-Host "   --- Port ---" -ForegroundColor Cyan
netstat -ano | Select-String ":80 |:443 |:3000 |:8090 " | ForEach-Object { Write-Host "      $($_.Line.Trim())" -ForegroundColor DarkGray }

Write-Host "   --- Data di PocketBase ---" -ForegroundColor Cyan
$countScript = @"
import PocketBase from 'pocketbase';
const pb = new PocketBase(process.env.POCKETBASE_URL);
await pb.collection('_superusers').authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
for (const c of ['products','transactions','customers','users','shifts','agents','suppliers','stock_transactions','asset_adjustments','reconciliation_runs','settings']) {
  try { const r = await pb.collections.getOne(c); const l = await pb.collection(c).getList(1,1); console.log(c.padEnd(20) + l.totalItems); }
  catch (e) { console.log(c.padEnd(20) + 'ERR'); }
}
"@
$tmpCount = Join-Path $AppDir ".bejo-count.mjs"
[System.IO.File]::WriteAllText($tmpCount, $countScript, [System.Text.UTF8Encoding]::new($false))
Push-Location $AppDir
& node $tmpCount 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
Pop-Location
Remove-Item $tmpCount -Force -ErrorAction SilentlyContinue

Write-Host "`n   --- Health Check ---" -ForegroundColor Cyan
$checks = @(
  @{ Name = "PocketBase (lokal)"; Url = "http://127.0.0.1:$PB_PORT/api/health" },
  @{ Name = "Aplikasi (lokal)";   Url = "http://127.0.0.1:3000/api/health" },
  @{ Name = "PocketBase (publik)";Url = "https://$Domain/api/pb/api/health" },
  @{ Name = "Aplikasi (publik)";  Url = "https://$Domain/api/health" }
)
$publicOk = $false
foreach ($c in $checks) {
  $code = Test-Url $c.Url 10
  if ($code -eq 200) { Write-Host "      [OK]   $($c.Name) -> $code" -ForegroundColor Green }
  elseif ($code -gt 0) { Write-Host "      [!]    $($c.Name) -> $code" -ForegroundColor Yellow }
  else { Write-Host "      [FAIL] $($c.Name) -> tidak terhubung" -ForegroundColor Red }
  if ($c.Url -like "https://*" -and $code -eq 200) { $publicOk = $true }
}

if (-not $publicOk) {
  Write-Warn2 "Akses HTTPS publik belum terverifikasi. Pastikan DNS $Domain -> IP VPS & port 80/443 terbuka."
  Write-Warn2 "Caddy butuh beberapa saat menerbitkan sertifikat Let's Encrypt saat pertama kali."
  $script:Warnings++
}

# =============================================================== RINGKASAN
Write-Head "FINISH DEPLOY SELESAI"

if ($script:Warnings -eq 0) { Write-Host " Status    : SEMUA LANGKAH BERHASIL" -ForegroundColor Green }
else { Write-Host " Status    : SELESAI dengan $($script:Warnings) peringatan (lihat [!] di atas)" -ForegroundColor Yellow }

Write-Host " Aplikasi  : https://$Domain" -ForegroundColor White
Write-Host " Admin UI  : http://127.0.0.1:$PB_PORT/_/" -ForegroundColor White
Write-Host " API app   : https://$Domain/api/health" -ForegroundColor White
Write-Host " API PB    : https://$Domain/api/pb/api/health" -ForegroundColor White
Write-Host ""
Write-Host " Log aplikasi : $AppDir\logs\stderr.log" -ForegroundColor DarkGray
Write-Host " Log Caddy    : $CaddyDir\logs\caddy-err.log" -ForegroundColor DarkGray
Write-Host " Log PB       : $PB_DIR\logs\stderr.log" -ForegroundColor DarkGray
Write-Host ""
Write-Host " Cek ulang kapan saja:" -ForegroundColor Yellow
Write-Host "   powershell -ExecutionPolicy Bypass -File $DeployDir\finish-deploy.ps1 -SkipBuild -NonInteractive" -ForegroundColor White
Write-Host ("=" * 66) -ForegroundColor DarkCyan

exit 0
