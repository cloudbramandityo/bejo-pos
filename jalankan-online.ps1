<#
=====================================================================
 BEJO STIKER POS - Jalankan Aplikasi + Akses dari Internet
=====================================================================
 Skrip ini menjalankan dua hal sekaligus:
   1. Server aplikasi Bejo Stiker POS  -> http://localhost:3000
   2. Terowongan Cloudflare            -> URL publik https://....trycloudflare.com

 Setelah selesai, skrip akan menampilkan URL publik beserta
 username & password yang harus dipakai pengguna dari luar.

 Cara pakai:
   - Klik dua kali file "jalankan-online.bat", ATAU
   - Di PowerShell:  .\jalankan-online.ps1

 Catatan: URL publik BERUBAH setiap kali skrip ini dijalankan.
=====================================================================
#>

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location $root

# Pastikan Node & npx bisa ditemukan
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

function Write-Header($text) {
  Write-Host ""
  Write-Host "==================================================================" -ForegroundColor DarkCyan
  Write-Host " $text" -ForegroundColor Cyan
  Write-Host "==================================================================" -ForegroundColor DarkCyan
}

Write-Header "BEJO STIKER POS - AKSES DARI INTERNET"

# ---------- Cari cloudflared ----------
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
if (-not (Test-Path $cloudflared)) {
  $cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cfCmd) { $cloudflared = $cfCmd.Source }
  else {
    Write-Host "cloudflared tidak ditemukan. Install dengan:" -ForegroundColor Red
    Write-Host "  winget install --id Cloudflare.cloudflared -e" -ForegroundColor Yellow
    Read-Host "Tekan Enter untuk keluar"
    exit 1
  }
}

# ---------- Baca kredensial dari .env ----------
$envPath = Join-Path $root '.env'
$userName = 'bejo'
$passWord = ''
if (Test-Path $envPath) {
  $lines = Get-Content $envPath
  $u = $lines | Where-Object { $_ -match '^\s*REMOTE_ACCESS_USER\s*=' } | Select-Object -First 1
  $p = $lines | Where-Object { $_ -match '^\s*REMOTE_ACCESS_PASS\s*=' } | Select-Object -First 1
  if ($u) { $userName = ($u -replace '^\s*REMOTE_ACCESS_USER\s*=', '').Trim() }
  if ($p) { $passWord = ($p -replace '^\s*REMOTE_ACCESS_PASS\s*=', '').Trim() }
}
if ([string]::IsNullOrWhiteSpace($passWord)) {
  Write-Host "PERINGATAN: REMOTE_ACCESS_PASS kosong di .env — aplikasi akan terbuka tanpa proteksi!" -ForegroundColor Red
}

# ---------- 1. Jalankan server aplikasi ----------
$portBusy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($portBusy) {
  Write-Host "[1/2] Server sudah berjalan di port 3000 — dilewati." -ForegroundColor Yellow
} else {
  Write-Host "[1/2] Menjalankan server aplikasi..." -ForegroundColor Yellow
  $serverLog = Join-Path $env:TEMP 'bejo-server.log'
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c `"npx.cmd tsx server.ts > `"$serverLog`" 2>&1`"" `
    -WorkingDirectory $root -WindowStyle Minimized

  # Tunggu sampai server siap
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    try {
      $r = Invoke-WebRequest 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
  }
  if ($ready) { Write-Host "      Server lokal siap: http://localhost:3000" -ForegroundColor Green }
  else { Write-Host "      Server belum siap. Cek log: $serverLog" -ForegroundColor Red }
}

# ---------- 2. Jalankan terowongan Cloudflare ----------
Write-Host "[2/2] Membuat terowongan internet (butuh ~10 detik)..." -ForegroundColor Yellow
$tunnelLog = Join-Path $env:TEMP 'bejo-tunnel.log'
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

Start-Process -FilePath 'cmd.exe' `
  -ArgumentList "/c `"`"$cloudflared`" tunnel --url http://localhost:3000 --no-autoupdate > `"$tunnelLog`" 2>&1`"" `
  -WindowStyle Minimized

# Ambil URL publik dari log
$publicUrl = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $tunnelLog) {
    $match = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9][a-z0-9-]*\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($match) {
      $publicUrl = [regex]::Match($match.Line, 'https://[a-z0-9][a-z0-9-]*\.trycloudflare\.com').Value
      break
    }
  }
}

Write-Host ""
if ($publicUrl) {
  # Uji cepat: tanpa kredensial harus 401
  $protected = 'tidak dapat diuji'
  try {
    Invoke-WebRequest $publicUrl -UseBasicParsing -TimeoutSec 20 -UserAgent 'Mozilla/5.0' | Out-Null
    $protected = 'TERBUKA (belum terlindungi!)'
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -eq 401) { $protected = 'terlindungi (401 - benar)' } else { $protected = "kode $code" }
  }

  Write-Host "==================================================================" -ForegroundColor Green
  Write-Host "  APLIKASI SIAP DIAKSES DARI INTERNET" -ForegroundColor Green
  Write-Host "==================================================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "  ALAMAT   : $publicUrl" -ForegroundColor White
  Write-Host "  USERNAME : $userName" -ForegroundColor White
  Write-Host "  PASSWORD : $passWord" -ForegroundColor White
  Write-Host ""
  Write-Host "  Status proteksi : $protected" -ForegroundColor Gray
  Write-Host ""
  Write-Host "  Bagikan ALAMAT, USERNAME, dan PASSWORD di atas." -ForegroundColor Yellow
  Write-Host "  Pengguna akan diminta login browser -> lalu login aplikasi." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  CATATAN: URL ini berubah setiap kali skrip dijalankan ulang." -ForegroundColor DarkGray
  Write-Host "==================================================================" -ForegroundColor Green
} else {
  Write-Host "Gagal membuat terowongan. Cek log: $tunnelLog" -ForegroundColor Red
  if (Test-Path $tunnelLog) { Get-Content $tunnelLog -Tail 20 }
}

Write-Host ""
Read-Host "Tekan Enter untuk menutup jendela ini (aplikasi tetap berjalan)"