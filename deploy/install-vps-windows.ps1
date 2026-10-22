<#
=====================================================================
  BEJO STIKER POS - Bootstrap VPS WINDOWS (Rumah Web)
=====================================================================
  Jalankan DI DALAM VPS lewat Remote Desktop (PowerShell sebagai Admin):

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\deploy\install-vps-windows.ps1

  Yang dilakukan:
    1. Memasang Node.js 22 LTS (diam-diam / silent) bila belum ada
    2. Mengunduh Caddy (reverse proxy + HTTPS otomatis) ke C:\caddy
    3. Mengunduh NSSM (membungkus proses jadi Windows Service)
    4. Membuat folder aplikasi C:\bejo-pos + C:\caddy\logs
    5. Membuka firewall Windows: 80 & 443 (HTTPS), 3000 TIDAK dibuka
    6. Mendaftarkan service: BejoStikerPOS (Node) & Caddy (proxy)
    7. Membuat Caddyfile awal untuk domain bejodigitalprint.com
=====================================================================
#>

$ErrorActionPreference = 'Stop'
$Domain       = "bejodigitalprint.com"
$WwwDomain    = "www.$Domain"
$AppDir       = "C:\bejo-pos"
$LogDir       = "C:\caddy\logs"
$CaddyDir     = "C:\caddy"
$NssmDir      = "C:\nssm"
$ServiceName  = "BejoStikerPOS"
$CaddyService = "Caddy"

function Write-Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "   [OK] $t" -ForegroundColor Green }
function Write-Warn2($t){ Write-Host "   [!]  $t" -ForegroundColor Yellow }

# ---------------------------------------------------------------- cek admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "HARUS dijalankan sebagai Administrator (klik kanan PowerShell > Run as administrator)." -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------- 1 Node
Write-Step "1/7 Memeriksa Node.js"
if (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Ok "Node.js sudah ada: $(node -v)"
} else {
  Write-Host "   Mengunduh Node.js 22 LTS (installer diam)..." -ForegroundColor Yellow
  try {
    $index = Invoke-WebRequest "https://nodejs.org/dist/latest-v22.x/" -UseBasicParsing -TimeoutSec 60
    $m = [regex]::Match($index.Content, 'node-v22\.\d+\.\d+-x64\.msi')
    if (-not $m.Success) { throw "Tidak bisa menemukan file installer Node.js" }
    $msi = $m.Value
    $msiPath = Join-Path $env:TEMP $msi
    Write-Host "   -> $msi"
    Invoke-WebRequest "https://nodejs.org/dist/latest-v22.x/$msi" -OutFile $msiPath -UseBasicParsing -TimeoutSec 300
    $p = Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart ADDLOCAL=ALL" -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "Instalasi Node.js gagal (kode $($p.ExitCode))" }
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
    Write-Ok "Node.js terpasang: $(node -v)"
  } catch {
    Write-Warn2 "Gagal memasang Node.js otomatis: $($_.Exception.Message)"
    Write-Warn2 "Silakan unduh manual dari https://nodejs.org (versi 22 LTS, .msi x64) lalu jalankan ulang skrip ini."
    exit 1
  }
}

# ---------------------------------------------------------------- 2 Caddy
Write-Step "2/7 Memasang Caddy (reverse proxy + HTTPS otomatis)"
if (Test-Path "$CaddyDir\caddy.exe") {
  Write-Ok "Caddy sudah ada: $(& "$CaddyDir\caddy.exe" version)"
} else {
  New-Item -ItemType Directory -Path $CaddyDir -Force | Out-Null
  try {
    $api = Invoke-RestMethod "https://api.github.com/repos/caddyserver/caddy/releases/latest" -Headers @{ 'User-Agent' = 'bejo-deploy' } -TimeoutSec 60
    $asset = $api.assets | Where-Object { $_.name -match 'windows_amd64\.zip$' } | Select-Object -First 1
    if (-not $asset) { throw "Aset Caddy windows_amd64 tidak ditemukan" }
    $zip = Join-Path $env:TEMP $asset.name
    Write-Host "   -> $($asset.name)"
    Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing -TimeoutSec 300
    Expand-Archive -Path $zip -DestinationPath $CaddyDir -Force
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Write-Ok "Caddy terpasang: $(& "$CaddyDir\caddy.exe" version)"
  } catch {
    Write-Warn2 "Gagal mengunduh Caddy: $($_.Exception.Message)"
    Write-Warn2 "Unduh manual https://github.com/caddyserver/caddy/releases lalu ekstrak ke C:\caddy"
    exit 1
  }
}

# ---------------------------------------------------------------- 3 NSSM
Write-Step "3/7 Memasang NSSM (Windows Service wrapper)"
if (Test-Path "$NssmDir\nssm.exe") {
  Write-Ok "NSSM sudah ada"
} else {
  New-Item -ItemType Directory -Path $NssmDir -Force | Out-Null
  try {
    $zip = Join-Path $env:TEMP "nssm.zip"
    Invoke-WebRequest "https://nssm.cc/release/nssm-2.24.zip" -OutFile $zip -UseBasicParsing -TimeoutSec 180
    $tmp = Join-Path $env:TEMP "nssm-tmp"
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $src = Get-ChildItem $tmp -Recurse -Filter "nssm.exe" | Where-Object { $_.FullName -match "win64" } | Select-Object -First 1
    if (-not $src) { $src = Get-ChildItem $tmp -Recurse -Filter "nssm.exe" | Select-Object -First 1 }
    Copy-Item $src.FullName "$NssmDir\nssm.exe" -Force
    Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Write-Ok "NSSM terpasang"
  } catch {
    Write-Warn2 "Gagal mengunduh NSSM: $($_.Exception.Message)"
    Write-Warn2 "Unduh manual https://nssm.cc/release/nssm-2.24.zip lalu ekstrak nssm.exe (win64) ke C:\nssm"
    exit 1
  }
}

# ---------------------------------------------------------------- 4 folder
Write-Step "4/7 Menyiapkan folder aplikasi"
New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
New-Item -ItemType Directory -Path "$AppDir\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "C:\backups\bejo-pos" -Force | Out-Null
Write-Ok "Folder siap: $AppDir, $LogDir, C:\backups\bejo-pos"

# ---------------------------------------------------------------- 5 firewall
Write-Step "5/7 Mengatur Windows Firewall"
foreach ($rule in @(
  @{ Name = "BejoPOS HTTP 80";  Port = 80 },
  @{ Name = "BejoPOS HTTPS 443"; Port = 443 }
)) {
  if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow `
      -Protocol TCP -LocalPort $rule.Port -Profile Any | Out-Null
  }
}
# pastikan port internal 3000 TIDAK terbuka ke luar
$blockRule = Get-NetFirewallRule -DisplayName "BejoPOS Block 3000" -ErrorAction SilentlyContinue
if (-not $blockRule) {
  New-NetFirewallRule -DisplayName "BejoPOS Block 3000" -Direction Inbound -Action Block `
    -Protocol TCP -LocalPort 3000 -Profile Any | Out-Null
}
Write-Ok "Firewall: 80 & 443 terbuka, 3000 diblokir"

# ---------------------------------------------------------------- 6 Caddyfile
Write-Step "6/7 Menyiapkan Caddyfile"
$caddyfile = @"
# =====================================================================
#  BEJO STIKER POS - Caddy (Windows VPS)
#  Diperbarui otomatis oleh deploy-vps-windows.ps1
# =====================================================================

$WwwDomain {
    redir https://$Domain{uri} permanent
}

$Domain {
    encode zstd gzip

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
        -Server
    }

    request_body {
        max_size 25MB
    }

    # -------------------------------------------------------------
    # PocketBase (database + realtime + auth) - LANGSUNG ke PocketBase
    # (bukan lewat Node) supaya streaming SSE realtime tidak di-buffer.
    # -------------------------------------------------------------
    handle /api/pb/* {
        reverse_proxy 127.0.0.1:8090
    }

    handle {
        reverse_proxy 127.0.0.1:3000 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    log {
        output file $LogDir\access.log {
            roll_size 10MiB
            roll_keep 5
        }
        format json
    }
}
"@
Set-Content -Path "$CaddyDir\Caddyfile" -Value $caddyfile -Encoding UTF8
& "$CaddyDir\caddy.exe" fmt --overwrite "$CaddyDir\Caddyfile" 2>&1 | Out-Null
Write-Ok "Caddyfile dibuat di $CaddyDir\Caddyfile"

# ---------------------------------------------------------------- 7 service
Write-Step "7/7 Mendaftarkan Windows Service"
$nssm = "$NssmDir\nssm.exe"
$nodeExe = (Get-Command node).Source

# --- service aplikasi ---
& $nssm stop $ServiceName 2>&1 | Out-Null
& $nssm remove $ServiceName confirm 2>&1 | Out-Null
& $nssm install $ServiceName $nodeExe "$AppDir\dist\server.cjs" | Out-Null
& $nssm set $ServiceName DisplayName "Bejo Stiker POS (Node)" | Out-Null
& $nssm set $ServiceName Description "Aplikasi POS Bejo Stiker - otomatis start & restart" | Out-Null
& $nssm set $ServiceName AppDirectory $AppDir | Out-Null
& $nssm set $ServiceName AppEnvironmentExtra "NODE_ENV=production" | Out-Null
& $nssm set $ServiceName AppEnvironmentExtra "PORT=3000" | Out-Null
& $nssm set $ServiceName AppStdout "$AppDir\logs\stdout.log" | Out-Null
& $nssm set $ServiceName AppStderr "$AppDir\logs\stderr.log" | Out-Null
& $nssm set $ServiceName AppRotateFiles 1 | Out-Null
& $nssm set $ServiceName AppRotateBytes 10485760 | Out-Null
& $nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
& $nssm set $ServiceName AppExit Default Restart | Out-Null
& $nssm set $ServiceName AppThrottle 5000 | Out-Null
Write-Ok "Service '$ServiceName' terdaftar (auto start + auto restart)"

# --- service caddy ---
& $nssm stop $CaddyService 2>&1 | Out-Null
& $nssm remove $CaddyService confirm 2>&1 | Out-Null
& $nssm install $CaddyService "$CaddyDir\caddy.exe" "run --config $CaddyDir\Caddyfile --adapter caddyfile" | Out-Null
& $nssm set $CaddyService DisplayName "Caddy (Reverse Proxy + HTTPS)" | Out-Null
& $nssm set $CaddyService AppDirectory $CaddyDir | Out-Null
& $nssm set $CaddyService AppStdout "$LogDir\caddy-out.log" | Out-Null
& $nssm set $CaddyService AppStderr "$LogDir\caddy-err.log" | Out-Null
& $nssm set $CaddyService Start SERVICE_AUTO_START | Out-Null
& $nssm set $CaddyService AppExit Default Restart | Out-Null
& $nssm set $CaddyService AppThrottle 5000 | Out-Null
Write-Ok "Service '$CaddyService' terdaftar"

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " BOOTSTRAP VPS WINDOWS SELESAI" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  Node.js        : $(node -v)" -ForegroundColor White
Write-Host "  Caddy          : $CaddyDir\caddy.exe" -ForegroundColor White
Write-Host "  Folder aplikasi: $AppDir" -ForegroundColor White
Write-Host "  Domain         : https://$Domain" -ForegroundColor White
Write-Host ""
Write-Host "  LANGKAH BERIKUTNYA:" -ForegroundColor Yellow
Write-Host "   1. Upload source ke $AppDir (SCP/FileZilla), lalu jalankan:" -ForegroundColor Yellow
Write-Host "        powershell -ExecutionPolicy Bypass -File $AppDir\deploy\deploy-vps-windows.ps1" -ForegroundColor Yellow
Write-Host "   2. Isi $AppDir\.env (APP_URL, GEMINI_API_KEY, REMOTE_ACCESS_*)" -ForegroundColor Yellow
Write-Host "   3. Restart service: net stop BejoStikerPOS && net start BejoStikerPOS" -ForegroundColor Yellow
Write-Host "   4. Cek: curl https://$Domain/api/health" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
