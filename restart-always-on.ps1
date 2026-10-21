<#
=====================================================================
  BEJO STIKER POS - Restart Mode Always On
=====================================================================
  Meminta supervisor lama berhenti (tanpa mematikan shell),
  lalu menjalankan ulang server + terowongan internet.

  Cara pakai:
     powershell -ExecutionPolicy Bypass -File .\restart-always-on.ps1
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

# 1. Minta supervisor lama berhenti
Write-Step "Menghentikan supervisor lama"
Set-Content -Path (Join-Path $root '.stop-supervisor') -Value 'stop' -Encoding ASCII
Start-Sleep -Seconds 8
Remove-Item (Join-Path $root '.stop-supervisor') -Force -ErrorAction SilentlyContinue

# 2. Matikan proses anak (node server & cloudflared) milik proyek ini
Write-Step "Membersihkan proses server & terowongan"
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  $procId = $_.Id
  try {
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction Stop).CommandLine
    if ($cmd -and $cmd.Contains('Default Project')) {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  } catch { }
}
Start-Sleep -Seconds 2

# 3. Jalankan ulang supervisor
Write-Step "Menjalankan supervisor server & terowongan"
$serverArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $root 'server-always-on.ps1') + '"'
$tunnelArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $root 'tunnel-always-on.ps1') + '"'
Start-Process -FilePath 'powershell.exe' -ArgumentList $serverArgs -WorkingDirectory $root -WindowStyle Hidden
Start-Process -FilePath 'powershell.exe' -ArgumentList $tunnelArgs -WorkingDirectory $root -WindowStyle Hidden

# 4. Tunggu siap
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}
if ($ready) { Write-Host "   Server siap: http://localhost:3000" -ForegroundColor Green }
else { Write-Host "   Server belum siap - cek %TEMP%\bejo-server.log" -ForegroundColor Red }

$publicUrl = ''
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path (Join-Path $root 'URL-INTERNET.txt')) {
    $txt = Get-Content (Join-Path $root 'URL-INTERNET.txt') -Raw
    if ($txt -match 'https://[a-z0-9\-\.]+') { $publicUrl = $Matches[0]; break }
  }
}
if ($publicUrl) {
  Write-Host "   Akses internet: $publicUrl" -ForegroundColor Green
} else {
  Write-Host "   Terowongan belum siap - cek %TEMP%\bejo-tunnel.log" -ForegroundColor Yellow
}
Write-Host ""
