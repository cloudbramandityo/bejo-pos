<#
=====================================================================
  BEJO STIKER POS - QUICK UPDATE (VPS Windows / Rumah Web)
=====================================================================
  Jalankan DI DALAM VPS sebagai Administrator:

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\quick-update.ps1

  Skrip ini HANYA memperbarui kode aplikasi (frontend + server):
    1. Unduh source terbaru dari GitHub (repo publik)
    2. Salin ke C:\bejo-pos tanpa menyentuh .env / node_modules / dist / logs
    3. npm install + build produksi
    4. Restart service BejoStikerPOS
    5. Health check

  Database PocketBase TIDAK disentuh oleh skrip ini.
=====================================================================
#>

$ErrorActionPreference = 'Stop'
$AppDir   = "C:\bejo-pos"
$Service  = "BejoStikerPOS"
$RepoZip  = "https://codeload.github.com/cloudbramandityo/bejo-pos/tar.gz/refs/heads/main"
$Work     = Join-Path $env:TEMP "bejo-update"
$Tar      = Join-Path $env:TEMP "bejo-update.tar.gz"

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($t)   { Write-Host "   [OK] $t" -ForegroundColor Green }
function Fail($t) { Write-Host "   [FAIL] $t" -ForegroundColor Red; exit 1 }

Step "1/5 Mengunduh source terbaru dari GitHub"
Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $Tar -Force -ErrorAction SilentlyContinue
Invoke-WebRequest -Uri $RepoZip -OutFile $Tar -UseBasicParsing -TimeoutSec 120
Ok ("Paket diunduh: {0:N2} MB" -f ((Get-Item $Tar).Length / 1MB))

Step "2/5 Mengekstrak"
New-Item -ItemType Directory -Path $Work -Force | Out-Null
& tar.exe -xzf $Tar -C $Work
if ($LASTEXITCODE -ne 0) { Fail "Ekstraksi gagal." }
$Src = Get-ChildItem $Work -Directory | Select-Object -First 1
if (-not $Src) { Fail "Folder source tidak ditemukan setelah ekstraksi." }
Ok "Source: $($Src.FullName)"

Step "3/6 Menyalin file aplikasi (tanpa .env / data lokal)"
$excludeDirs = @('node_modules', 'dist', 'logs', 'backups', '.git', '.vscode', '.idea')
& robocopy $Src.FullName $AppDir /E /NFL /NDL /NJH /NJS /NP /XD $excludeDirs /XF ".env" "dev-server.log" "URL-INTERNET.txt" | Out-Null
if ($LASTEXITCODE -gt 7) { Fail "Penyalinan file gagal (robocopy exit $LASTEXITCODE)." }
Ok "Source diperbarui."

Step "4/6 Memperbarui Caddyfile (handle_path + flush_interval untuk realtime SSE)"
$caddySrc = Join-Path $AppDir "deploy\Caddyfile.windows"
$caddyDst = "C:\caddy\Caddyfile"
if (Test-Path $caddySrc) {
  Copy-Item $caddySrc $caddyDst -Force
  # validasi
  $caddyExe = "C:\caddy\caddy.exe"
  if (Test-Path $caddyExe) {
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $caddyExe validate --config $caddyDst 2>&1 | Out-Null
    $ErrorActionPreference = $prevEAP
  }
  Restart-Service Caddy -Force -ErrorAction SilentlyContinue
  Ok "Caddyfile diperbarui & Caddy direstart."
} else {
  Write-Host "   [!] Caddyfile.windows tidak ditemukan, dilewati." -ForegroundColor Yellow
}

Step "5/6 Build produksi"
Set-Location $AppDir
if (-not (Test-Path (Join-Path $AppDir "node_modules"))) {
  & npm.cmd install --no-audit --no-fund --include=dev
  if ($LASTEXITCODE -ne 0) { Fail "npm install gagal." }
}
$env:NODE_ENV = "production"
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { Fail "Build gagal." }
Ok "Build selesai."

Step "6/6 Restart service & health check"
Restart-Service -Name $Service -Force
$healthy = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $healthy = $true; break }
  } catch { }
}
if (-not $healthy) { Fail "Health check lokal gagal. Cek C:\bejo-pos\logs\stderr.log" }
Ok "Aplikasi sehat."
(Invoke-WebRequest "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 5).Content

Remove-Item $Tar -Force -ErrorAction SilentlyContinue
Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "UPDATE SELESAI. Buka https://bejodigitalprint.com dan login ulang." -ForegroundColor Green
