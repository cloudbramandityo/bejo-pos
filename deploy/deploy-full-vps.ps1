<#
=====================================================================
  BEJO STIKER POS - FULL DEPLOY VPS WINDOWS
=====================================================================
  Jalankan DI DALAM VPS sebagai Administrator:

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-full-vps.ps1

  Alur lengkap update/deploy:
    1. Validasi prasyarat, service, dan .env (tanpa mencetak nilai rahasia)
    2. Unduh source terbaru dari GitHub (tarball, tanpa kredensial Git)
    3. Backup dist dan Caddyfile
    4. npm ci + build produksi
    5. Pasang Caddyfile (batas body 110MB untuk video Marketing) + validasi
    6. Restart service, health check, rollback otomatis bila gagal
    7. Verifikasi status Meta/TikTok/Shopee

  Data yang TIDAK disentuh:
    - .env, data/ (termasuk token Shopee), logs/, backups/
    - Database PocketBase

  Untuk instalasi VPS dari nol, jalankan berurutan:
    deploy\install-vps-windows.ps1
    deploy\setup-pocketbase.ps1
    deploy\finish-deploy.ps1

  Opsi:
    -SkipSourceUpdate   Pakai source lokal (tidak unduh GitHub)
    -SkipCaddy          Jangan ubah/restart Caddy
    -RequireMarketing   Exit code 2 bila env Marketing belum lengkap
    -Force              Lanjut walau repo Git punya perubahan lokal
    -NonInteractive     Jangan buka Notepad saat .env belum ada
=====================================================================
#>

[CmdletBinding()]
param(
  [string]$AppDir = 'C:\bejo-pos',
  [string]$Branch = 'main',
  [string]$RepoOwner = 'cloudbramandityo',
  [string]$RepoName = 'bejo-pos',
  [string]$ServiceName = 'BejoStikerPOS',
  [string]$CaddyDir = 'C:\caddy',
  [string]$BackupRoot = 'C:\backups\bejo-pos',
  [switch]$SkipSourceUpdate,
  [switch]$SkipCaddy,
  [switch]$RequireMarketing,
  [switch]$Force,
  [switch]$KeepSourceArchive,
  [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Write-Step([string]$Text) {
  Write-Host ''
  Write-Host "==> $Text" -ForegroundColor Cyan
}
function Write-Ok([string]$Text)   { Write-Host "   [OK] $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text){ Write-Host "   [!]  $Text" -ForegroundColor Yellow }
function Fail([string]$Text) {
  Write-Host "   [FAIL] $Text" -ForegroundColor Red
  exit 1
}

function Get-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) { return $null }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trim = $line.Trim()
    if ($trim -eq '' -or $trim.StartsWith('#')) { continue }
    $eq = $trim.IndexOf('=')
    if ($eq -lt 1) { continue }
    if ($trim.Substring(0, $eq).Trim() -eq $Key) {
      $value = $trim.Substring($eq + 1).Trim()
      if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }
  return $null
}

function Test-AppHealth([string]$Url, [int]$TimeoutSec = 5) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    return ($response.StatusCode -eq 200)
  } catch {
    return $false
  }
}

function Restore-Dist([string]$BackupPath, [string]$TargetPath) {
  if (-not $BackupPath -or -not (Test-Path $BackupPath)) { return $false }
  try {
    if (Test-Path $TargetPath) { Remove-Item $TargetPath -Recurse -Force }
    Copy-Item -LiteralPath $BackupPath -Destination $TargetPath -Recurse -Force
    return $true
  } catch {
    Write-Warn2 "Rollback dist gagal: $($_.Exception.Message)"
    return $false
  }
}

function Wait-AppHealth([string]$Url, [int]$Attempts = 30) {
  for ($i = 0; $i -lt $Attempts; $i++) {
    Start-Sleep -Seconds 2
    if (Test-AppHealth $Url 5) { return $true }
  }
  return $false
}

function Invoke-NativeCapture([string]$FilePath, [string[]]$Arguments) {
  $previous = $ErrorActionPreference
  try {
    # PowerShell 5.1 mengubah stderr native menjadi terminating error saat EAP=Stop.
    $ErrorActionPreference = 'Continue'
    $output = & $FilePath @Arguments 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  return [pscustomobject]@{ Output = $output; ExitCode = $code }
}

# ----------------------------------------------------------- 0. preflight
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ' BEJO STIKER POS - FULL DEPLOY VPS WINDOWS' -ForegroundColor Cyan
Write-Host " Waktu: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '==================================================================' -ForegroundColor DarkCyan

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail 'HARUS dijalankan sebagai Administrator (Run as administrator).' }

if (-not (Test-Path $AppDir)) {
  Fail "Folder $AppDir tidak ditemukan. Lakukan instalasi awal dengan deploy\install-vps-windows.ps1."
}
if (-not (Test-Path (Join-Path $AppDir 'package.json'))) {
  Fail "package.json tidak ditemukan di $AppDir. Source aplikasi belum siap."
}
if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
  Fail "Service $ServiceName belum terdaftar. Jalankan deploy\install-vps-windows.ps1 lebih dulu."
}
foreach ($tool in @('node', 'npm')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool tidak ditemukan di PATH." }
}

$envPath = Join-Path $AppDir '.env'
$envCreated = $false
if (-not (Test-Path $envPath)) {
  $envExample = Join-Path $AppDir '.env.example'
  if (-not (Test-Path $envExample)) { Fail ".env dan .env.example tidak ditemukan di $AppDir." }
  Copy-Item $envExample $envPath -Force
  $envCreated = $true
  Write-Warn2 ".env dibuat dari .env.example."
  if ($NonInteractive) {
    Fail "Isi kredensial di $envPath lalu jalankan ulang script ini."
  }
  Write-Warn2 "Notepad akan dibuka. Isi kredensial VPS, simpan, lalu tutup Notepad."
  try {
    Start-Process -FilePath notepad.exe -ArgumentList $envPath -Wait
  } catch {
    Fail "Tidak bisa membuka Notepad. Isi $envPath secara manual lalu jalankan ulang."
  }
}
Write-Ok ".env tersedia (nilai tidak dicetak)."

$caddyExe = Join-Path $CaddyDir 'caddy.exe'
$doCaddy = -not $SkipCaddy
if ($doCaddy -and -not (Test-Path $caddyExe)) {
  Write-Warn2 "Caddy tidak ditemukan di $caddyExe; langkah Caddy dilewati."
  $doCaddy = $false
}
if ($doCaddy -and -not (Get-Service -Name 'Caddy' -ErrorAction SilentlyContinue)) {
  Write-Warn2 'Service Caddy belum terdaftar; langkah Caddy dilewati.'
  $doCaddy = $false
}

$port = Get-EnvValue $envPath 'PORT'
if (-not $port) { $port = '3000' }
$localHealthUrl = "http://127.0.0.1:$port/api/health"
$localBaseUrl = "http://127.0.0.1:$port"

Write-Step '1/7 Memeriksa PocketBase dan folder runtime'
$pbService = Get-Service -Name 'PocketBase' -ErrorAction SilentlyContinue
if ($pbService) {
  if ($pbService.Status -ne 'Running') {
    try { Start-Service 'PocketBase'; Start-Sleep -Seconds 3 } catch {
      Write-Warn2 "PocketBase tidak bisa distart: $($_.Exception.Message)"
    }
  }
  if (Test-AppHealth 'http://127.0.0.1:8090/api/health' 5) {
    Write-Ok 'PocketBase merespons di port 8090.'
  } else {
    Write-Warn2 'PocketBase belum merespons di port 8090. Lanjut, tetapi aplikasi bisa gagal login/sync.'
  }
} else {
  Write-Warn2 'Service PocketBase tidak ditemukan. Pastikan database berjalan sebelum aplikasi dipakai.'
}

New-Item -ItemType Directory -Path (Join-Path $AppDir 'logs'), (Join-Path $AppDir 'data'), $BackupRoot -Force | Out-Null
try {
  $probe = Join-Path $AppDir 'data\.deploy-write-test'
  [System.IO.File]::WriteAllText($probe, 'ok')
  Remove-Item $probe -Force
  Write-Ok 'Folder logs/, data/, dan backups/ siap.'
} catch {
  Write-Warn2 "Folder data/ tidak dapat ditulis: $($_.Exception.Message)"
}

# ----------------------------------------------------------- 2. source
Write-Step '2/7 Menyiapkan source terbaru'
$sourceLabel = 'source lokal (unduh dilewati)'
$sourceArchive = $null
$sourceWork = $null

if (-not $SkipSourceUpdate) {
  if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
    Fail 'tar.exe tidak ditemukan. Gunakan Windows Server 2019/2022 atau jalankan dengan -SkipSourceUpdate.'
  }
  if (-not (Get-Command robocopy.exe -ErrorAction SilentlyContinue)) {
    Fail 'robocopy.exe tidak ditemukan.'
  }

  if (Test-Path (Join-Path $AppDir '.git')) {
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) {
      $dirty = @(& git -C $AppDir status --porcelain --untracked-files=no)
      if ($dirty.Count -gt 0) {
        Write-Host ($dirty -join "`n") -ForegroundColor DarkYellow
        if (-not $Force) {
          Fail 'Ada perubahan lokal pada file yang dilacak. Commit/batalkan dulu, atau jalankan dengan -Force (perubahan akan ditimpa).'
        }
        Write-Warn2 'Perubahan lokal akan ditimpa karena -Force.'
      }
    }
  }

  $sourceArchive = Join-Path $env:TEMP "bejo-source-$Stamp.tar.gz"
  $sourceWork = Join-Path $env:TEMP "bejo-source-$Stamp"
  $sourceUrl = "https://codeload.github.com/$RepoOwner/$RepoName/tar.gz/refs/heads/$Branch"
  Write-Host "   Mengunduh $sourceUrl" -ForegroundColor DarkGray

  try {
    Invoke-WebRequest -Uri $sourceUrl -OutFile $sourceArchive -UseBasicParsing -TimeoutSec 180
  } catch {
    Fail "Gagal mengunduh source: $($_.Exception.Message). Gunakan -SkipSourceUpdate bila source sudah diperbarui manual."
  }

  Remove-Item $sourceWork -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path $sourceWork -Force | Out-Null
  & tar.exe -xzf $sourceArchive -C $sourceWork
  if ($LASTEXITCODE -ne 0) { Fail 'Ekstraksi source gagal.' }

  $sourceRoot = Get-ChildItem -LiteralPath $sourceWork -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName 'package.json') } |
    Select-Object -First 1
  if (-not $sourceRoot) { Fail 'Struktur source tidak valid (package.json tidak ditemukan).' }

  # Hanya folder runtime di root aplikasi yang dilindungi.
  # src\data tetap ikut ter-update karena bukan path root data\.
  $excludeDirs = @(
    (Join-Path $AppDir '.git'),
    (Join-Path $AppDir 'node_modules'),
    (Join-Path $AppDir 'dist'),
    (Join-Path $AppDir 'logs'),
    (Join-Path $AppDir 'backups'),
    (Join-Path $AppDir 'data'),
    (Join-Path $AppDir '.vscode'),
    (Join-Path $AppDir '.idea')
  )
  $excludeFiles = @('.env', 'dev-server.log', 'URL-INTERNET.txt', 'config.migration.ps1')
  $robocopyArgs = @($sourceRoot.FullName, $AppDir, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XD') +
    $excludeDirs + @('/XF') + $excludeFiles
  & robocopy.exe @robocopyArgs | Out-Null
  if ($LASTEXITCODE -ge 8) { Fail "Gagal menyalin source (robocopy exit $LASTEXITCODE)." }

  $sourceLabel = "$RepoOwner/$RepoName#$Branch (unduhan $Stamp)"
  Write-Ok "Source diperbarui. .env, data/, logs/, dan dist/ lama dipertahankan."
} else {
  Write-Warn2 'Source update dilewati (-SkipSourceUpdate).'
}

# ----------------------------------------------------------- 3. env check
Write-Step '3/7 Validasi konfigurasi .env'
$requiredKeys = @('APP_URL', 'VITE_POCKETBASE_URL', 'VITE_PB_SYNC_EMAIL', 'VITE_PB_SYNC_PASSWORD')
$missingEnv = @()
foreach ($key in $requiredKeys) {
  $value = Get-EnvValue $envPath $key
  if ([string]::IsNullOrWhiteSpace($value)) { $missingEnv += $key }
}
if ($missingEnv.Count -gt 0) {
  Write-Warn2 "Env penting masih kosong: $($missingEnv -join ', ')"
  if ($envCreated) {
    Fail "Lengkapi nilai di $envPath lalu jalankan ulang script ini."
  }
} else {
  Write-Ok 'Env inti aplikasi terisi.'
}

$marketingKeys = @(
  'META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID',
  'TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID',
  'SHOPEE_PARTNER_ID', 'SHOPEE_PARTNER_KEY', 'SHOPEE_REFRESH_TOKEN'
)
$missingMarketing = @()
foreach ($key in $marketingKeys) {
  $value = Get-EnvValue $envPath $key
  if ([string]::IsNullOrWhiteSpace($value)) { $missingMarketing += $key }
}
if ($missingMarketing.Count -gt 0) {
  Write-Warn2 "Env Marketing belum lengkap: $($missingMarketing -join ', ')"
} else {
  Write-Ok 'Env Marketing terisi (nilai tidak dicetak).'
}

# ----------------------------------------------------------- 4. backup
Write-Step '4/7 Backup build dan Caddyfile sebelumnya'
$distPath = Join-Path $AppDir 'dist'
$distBackup = $null
if (Test-Path $distPath) {
  $distBackup = Join-Path $BackupRoot "dist-$Stamp"
  Copy-Item -LiteralPath $distPath -Destination $distBackup -Recurse -Force
  Write-Ok "Backup dist: $distBackup"
  Get-ChildItem $BackupRoot -Directory -Filter 'dist-*' |
    Sort-Object Name -Descending | Select-Object -Skip 5 |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
} else {
  Write-Warn2 'dist/ belum ada; build baru akan dibuat tanpa backup.'
}

$caddyChanged = $false
$caddyBackup = $null
if ($doCaddy) {
  $caddySource = Join-Path $AppDir 'deploy\Caddyfile.windows'
  $caddyTarget = Join-Path $CaddyDir 'Caddyfile'
  if (-not (Test-Path $caddySource)) {
    Write-Warn2 "$caddySource tidak ditemukan; Caddy dilewati."
    $doCaddy = $false
  } else {
    New-Item -ItemType Directory -Path (Join-Path $CaddyDir 'logs') -Force | Out-Null

    # Pastikan batas body 110MB tanpa mengubah file source repo
    # (video Marketing base64 bisa ~85MB).
    $caddyDeploySource = $caddySource
    $caddyTemp = Join-Path $env:TEMP "bejo-Caddyfile-$Stamp"
    $caddyText = Get-Content -LiteralPath $caddySource -Raw
    $caddyPatched = [regex]::Replace(
      $caddyText,
      'max_size\s+\d+(?:\.\d+)?\s*(?:MB|GB)',
      'max_size 110MB'
    )
    if ($caddyPatched -ne $caddyText) {
      [System.IO.File]::WriteAllText($caddyTemp, $caddyPatched)
      $caddyDeploySource = $caddyTemp
      Write-Ok 'Batas body Caddyfile disetel ke 110MB.'
    }

    $validation = Invoke-NativeCapture $caddyExe @('validate', '--config', $caddyDeploySource, '--adapter', 'caddyfile')
    $validateOutput = $validation.Output
    if ($validation.ExitCode -ne 0) {
      if (Test-Path $caddyTemp) { Remove-Item $caddyTemp -Force -ErrorAction SilentlyContinue }
      $validateOutput | Select-Object -Last 10 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
      Fail 'Caddyfile baru tidak valid; file Caddy lama tidak diubah.'
    }

    $oldCaddyHash = ''
    if (Test-Path $caddyTarget) {
      $oldCaddyHash = (Get-FileHash -LiteralPath $caddyTarget -Algorithm SHA256).Hash
      $caddyBackup = Join-Path $BackupRoot "Caddyfile-$Stamp"
      Copy-Item $caddyTarget $caddyBackup -Force
    }
    Copy-Item $caddyDeploySource $caddyTarget -Force
    if (Test-Path $caddyTemp) { Remove-Item $caddyTemp -Force -ErrorAction SilentlyContinue }
    $newCaddyHash = (Get-FileHash -LiteralPath $caddyTarget -Algorithm SHA256).Hash
    if ($oldCaddyHash -ne $newCaddyHash) {
      $caddyChanged = $true
      Write-Ok 'Caddyfile diperbarui (batas body 110MB untuk media Marketing).'
    } else {
      Write-Ok 'Caddyfile sudah sesuai.'
    }
  }
}

# ----------------------------------------------------------- 5. build
Write-Step '5/7 Install dependensi dan build produksi'
Push-Location $AppDir
try {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npm) { $npmPath = $npm.Source } else { $npmPath = (Get-Command npm).Source }

  if (Test-Path (Join-Path $AppDir 'package-lock.json')) {
    Write-Host '   npm ci ...' -ForegroundColor DarkGray
    $install = Invoke-NativeCapture $npmPath @('ci', '--no-audit', '--no-fund', '--include=dev')
  } else {
    Write-Host '   npm install ...' -ForegroundColor DarkGray
    $install = Invoke-NativeCapture $npmPath @('install', '--no-audit', '--no-fund', '--include=dev')
  }
  $installOutput = $install.Output
  $installExit = $install.ExitCode
  $installOutput | Select-Object -Last 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  if ($installExit -ne 0 -and (Test-Path (Join-Path $AppDir 'package-lock.json'))) {
    Write-Warn2 "npm ci gagal (exit $installExit); mencoba npm install."
    $install = Invoke-NativeCapture $npmPath @('install', '--no-audit', '--no-fund', '--include=dev')
    $installOutput = $install.Output
    $installExit = $install.ExitCode
    $installOutput | Select-Object -Last 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  }
  if ($installExit -ne 0) { Fail "Install dependensi gagal (exit $installExit). dist lama tidak diubah." }

  $env:NODE_ENV = 'production'
  Write-Host '   npm run build ...' -ForegroundColor DarkGray
  $build = Invoke-NativeCapture $npmPath @('run', 'build')
  $buildOutput = $build.Output
  $buildExit = $build.ExitCode
  $buildOutput | Select-Object -Last 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  if ($buildExit -ne 0) {
    if (Restore-Dist $distBackup $distPath) { Write-Warn2 'dist lama dikembalikan.' }
    Fail "Build gagal (exit $buildExit)."
  }
  if (-not (Test-Path (Join-Path $distPath 'server.cjs'))) {
    if (Restore-Dist $distBackup $distPath) { Write-Warn2 'dist lama dikembalikan.' }
    Fail 'dist\server.cjs tidak terbentuk.'
  }
  Write-Ok 'Build selesai.'
} finally {
  Pop-Location
}

# ----------------------------------------------------------- 6. restart
Write-Step '6/7 Restart service dan health check'
try {
  Restart-Service -Name $ServiceName -Force
} catch {
  Fail "Gagal restart service $ServiceName : $($_.Exception.Message)"
}

if (Wait-AppHealth $localHealthUrl 30) {
  Write-Ok "Aplikasi sehat di $localHealthUrl"
} else {
  Write-Warn2 'Health check gagal. Log terakhir:'
  Get-Content (Join-Path $AppDir 'logs\stderr.log') -Tail 40 -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  if (Restore-Dist $distBackup $distPath) {
    Write-Warn2 'Mengembalikan dist sebelumnya...'
    try { Restart-Service -Name $ServiceName -Force } catch { }
    if (Wait-AppHealth $localHealthUrl 15) {
      Fail 'Deploy gagal; rollback berhasil dan aplikasi kembali sehat.'
    }
    Fail 'Deploy gagal dan rollback tidak sehat. Periksa log service.'
  }
  Fail 'Deploy gagal dan tidak ada build lama untuk rollback.'
}

if ($doCaddy -and $caddyChanged) {
  try {
    Restart-Service -Name 'Caddy' -Force
    Start-Sleep -Seconds 3
    $caddyStatus = (Get-Service 'Caddy').Status
    if ($caddyStatus -eq 'Running') {
      Write-Ok 'Caddy direstart dengan konfigurasi baru.'
    } else {
      throw "status service: $caddyStatus"
    }
  } catch {
    Write-Warn2 "Caddy gagal memakai konfigurasi baru: $($_.Exception.Message)"
    if ($caddyBackup -and (Test-Path $caddyBackup)) {
      Copy-Item $caddyBackup $caddyTarget -Force
      try {
        Restart-Service -Name 'Caddy' -Force
        Write-Warn2 'Caddyfile lama dikembalikan dan Caddy direstart.'
      } catch {
        Write-Warn2 'Rollback Caddy juga gagal. Periksa C:\caddy\logs\caddy-err.log'
      }
    } else {
      Write-Warn2 'Tidak ada Caddyfile lama untuk rollback.'
    }
  }
}

$appUrl = Get-EnvValue $envPath 'APP_URL'
if ($appUrl -and $appUrl -match '^https?://') {
  $publicHealth = ($appUrl.TrimEnd('/')) + '/api/health'
  if (Test-AppHealth $publicHealth 15) {
    Write-Ok "Akses publik sehat: $publicHealth"
  } else {
    Write-Warn2 "Health publik belum merespons: $publicHealth (cek DNS/SSL/Caddy)."
  }
}

# ----------------------------------------------------------- 7. marketing
Write-Step '7/7 Verifikasi integrasi Marketing'
try {
  $marketing = Invoke-RestMethod -Uri "$localBaseUrl/api/marketing/status" -TimeoutSec 15
} catch {
  Fail "Endpoint /api/marketing/status tidak merespons: $($_.Exception.Message)"
}

$channels = @(
  [pscustomobject]@{ Name = 'WhatsApp (Meta)'; Configured = [bool]$marketing.meta.configured; Missing = @($marketing.meta.missing) },
  [pscustomobject]@{ Name = 'TikTok'; Configured = [bool]$marketing.tiktok.configured; Missing = @($marketing.tiktok.missing) },
  [pscustomobject]@{ Name = 'Shopee'; Configured = [bool]$marketing.shopee.configured; Missing = @($marketing.shopee.missing) }
)
$incomplete = @()
foreach ($channel in $channels) {
  if ($channel.Configured) {
    Write-Ok "$($channel.Name): terkonfigurasi"
  } else {
    $missing = if ($channel.Missing.Count -gt 0) { $channel.Missing -join ', ' } else { 'tidak diketahui' }
    Write-Warn2 "$($channel.Name): belum lengkap (env kosong: $missing)"
    $incomplete += $channel.Name
  }
}

if ($marketing.appUrl) { Write-Host "   appUrl: $($marketing.appUrl)" -ForegroundColor DarkGray }

# ----------------------------------------------------------- cleanup/summary
if (-not $KeepSourceArchive) {
  if ($sourceArchive) { Remove-Item $sourceArchive -Force -ErrorAction SilentlyContinue }
  if ($sourceWork) { Remove-Item $sourceWork -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Ok 'DEPLOY SELESAI'
Write-Host "   Source   : $sourceLabel"
Write-Host "   Service  : $ServiceName ($((Get-Service $ServiceName).Status))"
if ($distBackup) { Write-Host "   Backup   : $distBackup" }
Write-Host "   Log      : $AppDir\logs\stderr.log"
Write-Host "   Marketing: $(if ($incomplete.Count -eq 0) { '3 kanal terkonfigurasi' } else { 'belum lengkap: ' + ($incomplete -join ', ') })"
Write-Host ''

if ($RequireMarketing -and $incomplete.Count -gt 0) {
  Write-Host "   [FAIL] Marketing belum lengkap: $($incomplete -join ', ')" -ForegroundColor Red
  exit 2
}
exit 0
