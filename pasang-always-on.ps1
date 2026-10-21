<#
=====================================================================
  BEJO STIKER POS - Pasang Mode "ALWAYS ON"
=====================================================================
  Membuat:
    1. Server aplikasi (produksi) berjalan terus + auto-restart
    2. Terowongan internet Cloudflare jalan terus + auto-reconnect
    3. Auto-start saat komputer dinyalakan / user login (Startup folder)
    4. Pintasan desktop untuk membuka aplikasi via internet
    5. File URL-INTERNET.txt yang selalu berisi alamat publik terbaru

  Cara pakai:
     powershell -ExecutionPolicy Bypass -File .\pasang-always-on.ps1

  Hapus mode always on:
     powershell -ExecutionPolicy Bypass -File .\hapus-always-on.ps1
=====================================================================
#>

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

function Write-Step($text) {
  Write-Host ""
  Write-Host "==> $text" -ForegroundColor Cyan
}

Write-Host "==================================================================" -ForegroundColor DarkCyan
Write-Host " BEJO STIKER POS - MODE ALWAYS ON (selalu hidup & bisa diakses internet)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor DarkCyan

# ---------------------------------------------------------------- 1
Write-Step "Menyiapkan build produksi (server.cjs + aset)"
if (-not (Test-Path (Join-Path $root 'dist\server.cjs'))) {
  Write-Host "   Build belum ada, menjalankan npm run build..." -ForegroundColor Yellow
  & npm.cmd run build
} else {
  Write-Host "   Build produksi sudah tersedia (dist\server.cjs)." -ForegroundColor Green
}

# ---------------------------------------------------------------- 2
Write-Step "Menyiapkan startup otomatis (folder Startup)"
$startup = [Environment]::GetFolderPath('Startup')
$startupCmd = Join-Path $startup 'BejoStikerPOS.cmd'
$cmd = @"
@echo off
REM Auto-start Bejo Stiker POS: server (always on) + terowongan internet
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$root\server-always-on.ps1"
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$root\tunnel-always-on.ps1"
exit /b 0
"@
Set-Content -Path $startupCmd -Value $cmd -Encoding ASCII
Write-Host "   Startup entry : $startupCmd" -ForegroundColor Green

# ---------------------------------------------------------------- 3
Write-Step "Membuat pintasan desktop"
$desktop = [Environment]::GetFolderPath('Desktop')
$desktopCmd = Join-Path $desktop 'Bejo Stiker POS - Buka lewat Internet.cmd'
$desktopCmdContent = @"
@echo off
REM Membuka aplikasi Bejo Stiker POS lewat alamat internet terbaru
set "URLFILE=%TEMP%\bejo-tunnel-url.txt"
if exist "%URLFILE%" (
  for /f "tokens=2 delims==" %%A in ('findstr /b "ALAMAT" "%URLFILE%"') do set "PUBURL=%%A"
)
if "%PUBURL%"=="" set "PUBURL=http://localhost:3000"
echo Membuka %PUBURL%
start "" "%PUBURL%"
exit /b 0
"@
Set-Content -Path $desktopCmd -Value $desktopCmdContent -Encoding ASCII
Write-Host "   Pintasan      : $desktopCmd" -ForegroundColor Green

# ---------------------------------------------------------------- 4
Write-Step "Menjalankan server & terowongan (dalam)"
# stop instance lama di port 3000 milik proyek ini
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)"
    if ($proc -and $proc.CommandLine -and ($proc.CommandLine -like "*$root*")) {
      Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
  } catch { }
}
Start-Sleep -Seconds 2

$serverArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $root 'server-always-on.ps1') + '"'
$tunnelArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $root 'tunnel-always-on.ps1') + '"'

Start-Process -FilePath 'powershell.exe' -ArgumentList $serverArgs -WorkingDirectory $root -WindowStyle Hidden
Start-Process -FilePath 'powershell.exe' -ArgumentList $tunnelArgs -WorkingDirectory $root -WindowStyle Hidden

# tunggu server siap
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}
if ($ready) { Write-Host "   Server lokal siap: http://localhost:3000" -ForegroundColor Green }
else { Write-Host "   Server belum siap - cek %TEMP%\bejo-server.log" -ForegroundColor Red }

# ---------------------------------------------------------------- 5
Write-Step "Menunggu terowongan internet"
$publicUrl = ''
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path (Join-Path $root 'URL-INTERNET.txt')) {
    $txt = Get-Content (Join-Path $root 'URL-INTERNET.txt') -Raw
    if ($txt -match 'https://[a-z0-9\-\.]+') {
      $publicUrl = $Matches[0]
      break
    }
  }
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " MODE ALWAYS ON AKTIF" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  Server lokal : http://localhost:3000" -ForegroundColor White
if ($publicUrl) {
  Write-Host "  Akses internet: $publicUrl" -ForegroundColor White
  Write-Host "  (alamat terbaru selalu ada di URL-INTERNET.txt)" -ForegroundColor DarkGray
} else {
  Write-Host "  Akses internet: belum siap - cek %TEMP%\bejo-tunnel.log" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Otomatis hidup kembali setelah restart / menyala ulang komputer." -ForegroundColor Gray
Write-Host "  Untuk URL TETAP (tidak berubah), isi CLOUDFLARE_TUNNEL_TOKEN di .env." -ForegroundColor DarkGray
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
