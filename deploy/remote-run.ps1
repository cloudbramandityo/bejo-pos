<#
=====================================================================
  BEJO STIKER POS - Remote runner (dijalankan DI VPS Windows)
=====================================================================
  Dipakai oleh deploy/deploy-vps.ps1:
    1. scp bejo-deploy.tar.gz  -> %USERPROFILE%\bejo-deploy.tar.gz
    2. scp remote-run.ps1      -> %USERPROFILE%\remote-run.ps1
    3. ssh  -> powershell -File remote-run.ps1

  Tugasnya: ekstrak source ke C:\bejo-pos lalu jalankan deploy.
  File .env yang sudah ada TIDAK dihapus.
=====================================================================
#>

$ErrorActionPreference = 'Stop'

$AppDir = "C:\bejo-pos"
$tar    = Join-Path $env:USERPROFILE "bejo-deploy.tar.gz"
$envFile = Join-Path $AppDir ".env"
$envBackup = Join-Path $env:TEMP "bejo-env-backup"

Write-Host "==> [1/3] Membuka paket source" -ForegroundColor Cyan
if (-not (Test-Path $tar)) { throw "Paket $tar tidak ditemukan di server." }

# Simpan .env lama (kalau ada) agar tidak hilang saat ekstrak ulang
$hasEnv = Test-Path $envFile
if ($hasEnv) {
  Copy-Item $envFile $envBackup -Force
  Write-Host "   .env lama disimpan sementara." -ForegroundColor DarkGray
}

Write-Host "==> [2/3] Mengekstrak ke $AppDir" -ForegroundColor Cyan
if (Test-Path $AppDir) {
  # hapus isi (kecuali .env) agar tidak ada file lama yang tertinggal
  Get-ChildItem $AppDir -Force | Where-Object { $_.Name -ne ".env" } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
} else {
  New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
}
tar -xzf $tar -C $AppDir

if ($hasEnv) {
  Copy-Item $envBackup $envFile -Force
  Remove-Item $envBackup -Force -ErrorAction SilentlyContinue
  Write-Host "   .env dipulihkan." -ForegroundColor DarkGray
}

Write-Host "==> [3/3] Menjalankan deploy" -ForegroundColor Cyan
& (Join-Path $AppDir "deploy\deploy-vps-windows.ps1")
exit $LASTEXITCODE
