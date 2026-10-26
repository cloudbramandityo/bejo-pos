<#
=====================================================================
  BEJO STIKER POS - DEPLOY MODUL JURNAL KE VPS WINDOWS
=====================================================================
  Jalankan DI DALAM VPS sebagai Administrator:

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-jurnal-vps.ps1

  Yang dilakukan:
    1. Memeriksa .env dan melengkapi kredensial Jurnal yang kosong
       (PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, JOURNAL_DEV_USER,
        JOURNAL_DEV_PASSWORD, JOURNAL_SESSION_SECRET)
    2. Menguji login superuser PocketBase sebelum build
    3. Menyimpan perubahan .env dengan backup (nilai tidak dicetak)
    4. Menjalankan deploy-full-vps.ps1: source, npm ci, build, Caddy,
       restart service BejoStikerPOS, health check, rollback
    5. Health check lokal
    6. Verifikasi end-to-end API Jurnal + koleksi jurnal_sheets
    7. Verifikasi akses internet lewat APP_URL (termasuk Basic Auth
       bila REMOTE_ACCESS_PASS diisi)

  Catatan sesi Jurnal:
    Sub menu Jurnal hanya tampil untuk akun DEVELOPER dan TIDAK meminta
    login kedua. Aplikasi membuat sesi API otomatis dari akun DEVELOPER
    yang sedang dipakai, sehingga JOURNAL_DEV_USER / JOURNAL_DEV_PASSWORD
    di .env VPS harus sama dengan kredensial login DEVELOPER aplikasi.

  Data yang TIDAK disentuh:
    .env (hanya key Jurnal yang kosong/diisi), data/, logs/, backups/,
    database PocketBase

  Opsi:
    -AppDir C:\bejo-pos        Folder aplikasi
    -Branch main               Branch GitHub
    -SkipPocketBaseCheck       Lewati uji login superuser sebelum deploy
    -SkipSourceUpdate          Pakai source lokal di VPS
    -SkipCaddy                 Jangan ubah/restart Caddy
    -SkipPublicCheck           Lewati verifikasi APP_URL lewat internet
    -Force                     Timpa perubahan lokal yang dilacak Git
    -KeepSourceArchive         Simpan arsip source di %TEMP%
    -NonInteractive            Gagal bila kredensial belum lengkap

  Exit code:
    0 sukses
    1 deploy/health gagal
    2 env Jurnal/APP_URL belum lengkap
    3 PocketBase/Jurnal/akses publik gagal diverifikasi
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
  [switch]$SkipPocketBaseCheck,
  [switch]$SkipSourceUpdate,
  [switch]$SkipCaddy,
  [switch]$SkipPublicCheck,
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
function Fail([string]$Text, [int]$Code = 1) {
  Write-Host "   [FAIL] $Text" -ForegroundColor Red
  exit $Code
}

# Pola ini menyalin persis LINE dari dotenv 17.4.2 agar nilai yang ditulis
# script dibaca sama oleh aplikasi (termasuk tanda kutip, #, dan backslash).
$script:DotEnvLinePattern = @'
(?:^|^)\s*(?:export\s+)?([A-Za-z0-9_.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)
'@

function ConvertFrom-DotEnvText([string]$Text) {
  $entries = New-Object System.Collections.Specialized.OrderedDictionary ([System.StringComparer]::Ordinal)
  if ($null -eq $Text) { return $entries }

  $normalized = $Text.Replace("`r`n", "`n").Replace("`r", "`n")
  $pattern = New-Object System.Text.RegularExpressions.Regex(
    $script:DotEnvLinePattern,
    [System.Text.RegularExpressions.RegexOptions]::Multiline)

  foreach ($match in $pattern.Matches($normalized)) {
    $value = if ($match.Groups[2].Success) { $match.Groups[2].Value } else { '' }
    $value = $value.Trim()
    $maybeQuote = if ($value.Length -gt 0) { $value[0] } else { [char]0 }
    $value = [regex]::Replace(
      $value,
      '^([\u0027\u0022\u0060])([\s\S]*)\1$',
      '$2',
      [System.Text.RegularExpressions.RegexOptions]::Multiline)
    if ($maybeQuote -eq '"') {
      $value = $value.Replace('\n', "`n").Replace('\r', "`r")
    }
    $entries[$match.Groups[1].Value] = $value
  }

  return $entries
}

function Get-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $entries = ConvertFrom-DotEnvText ([System.IO.File]::ReadAllText($Path))
  if ($entries.Contains($Key)) { return [string]$entries[$Key] }
  return $null
}

function Format-EnvValue([string]$Value) {
  if ($null -eq $Value) { $Value = '' }
  if ($Value -match '[\r\n]') { throw 'Nilai .env tidak boleh berisi baris baru.' }
  if ($Value.IndexOf([char]0) -ge 0) { throw 'Nilai .env tidak boleh berisi karakter NUL.' }
  if ($Value -eq '') { return '' }

  $candidates = @($Value)
  foreach ($quote in @([char]0x27, [char]0x60, [char]0x22)) {
    $candidates += (([string]$quote) + $Value + ([string]$quote))
  }

  foreach ($candidate in $candidates) {
    $probe = ConvertFrom-DotEnvText ('PROBE=' + $candidate)
    if ($probe.Contains('PROBE') -and [string]$probe['PROBE'] -ceq $Value) {
      return $candidate
    }
  }

  throw 'Nilai mengandung kombinasi tanda kutip, backtick, backslash, atau # yang tidak dapat disimpan aman di .env. Gunakan password tanpa mengombinasikan karakter tersebut, atau isi key terkait manual di .env.'
}

function Set-EnvValues([string]$Path, [System.Collections.IDictionary]$Updates) {
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) { [void]$lines.Add($line) }

  $changed = @()
  $appended = @()

  foreach ($key in $Updates.Keys) {
    $formatted = "$key=$(Format-EnvValue ([string]$Updates[$key]))"
    $pattern = '^\s*(?:export\s+)?' + [regex]::Escape($key) + '\s*='
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -cmatch $pattern) {
        if (-not $found) {
          if ($lines[$i] -cne $formatted) { $changed += $key }
          $lines[$i] = $formatted
          $found = $true
        } else {
          $lines[$i] = "# [deploy-jurnal] duplikat $key dihapus $Stamp"
          if ($changed -notcontains $key) { $changed += $key }
        }
      }
    }
    if (-not $found) {
      $appended += $key
      if ($changed -notcontains $key) { $changed += $key }
    }
  }

  if ($appended.Count -gt 0) {
    $hasHeader = $false
    foreach ($line in $lines) {
      if ($line -match 'Modul Jurnal') { $hasHeader = $true; break }
    }
    if (-not $hasHeader) {
      if ($lines.Count -gt 0 -and $lines[$lines.Count - 1].Trim() -ne '') { [void]$lines.Add('') }
      [void]$lines.Add('# --- Modul Jurnal (khusus DEVELOPER) - ditambahkan deploy-jurnal-vps ---')
    }
    foreach ($key in $appended) {
      [void]$lines.Add("$key=$(Format-EnvValue ([string]$Updates[$key]))")
    }
  }

  if ($changed.Count -eq 0) { return @() }

  $text = ($lines -join "`r`n") + "`r`n"
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $text, $utf8)
  return $changed
}

function Backup-EnvFile([string]$Path) {
  New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
  $backup = Join-Path $BackupRoot ".env-$Stamp.bak"
  Copy-Item -LiteralPath $Path -Destination $backup -Force
  Get-ChildItem -LiteralPath $BackupRoot -File -Filter '.env-*.bak' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -Skip 5 |
    Remove-Item -Force -ErrorAction SilentlyContinue
  return $backup
}

function New-RandomSecret([int]$Bytes = 48) {
  $data = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($data) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($data).Replace('+', '-').Replace('/', '_').TrimEnd('=')
}

function Read-Email([string]$Prompt) {
  while ($true) {
    $value = (Read-Host -Prompt $Prompt).Trim()
    if ($value -match '^[^@\s]+@[^@\s]+$') { return $value }
    Write-Warn2 'Format email tidak valid.'
  }
}

function Read-DevUser([string]$Default) {
  while ($true) {
    $value = (Read-Host -Prompt "Username developer Jurnal [$Default]").Trim()
    if (-not $value) { $value = $Default }
    if ($value -match '^[A-Za-z0-9._-]{3,40}$') { return $value }
    Write-Warn2 'Gunakan 3-40 karakter: huruf, angka, titik, garis bawah, atau strip.'
  }
}

function Read-PlainSecret([string]$Prompt) {
  while ($true) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr = [IntPtr]::Zero
    $plain = ''
    try {
      $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
      if ($bstr -ne [IntPtr]::Zero) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
      }
    }
    if (-not [string]::IsNullOrWhiteSpace($plain)) { return $plain }
    Write-Warn2 'Nilai tidak boleh kosong.'
  }
}

function Read-NewSecret([string]$Label) {
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    $first = Read-PlainSecret "${Label}: "
    if ($first.Length -lt 8) {
      Write-Warn2 'Minimal 8 karakter.'
      continue
    }
    $second = Read-PlainSecret "Ulangi ${Label}: "
    if ($first -ceq $second) {
      $trimmed = $first.Trim()
      if ($trimmed -cne $first) {
        Write-Warn2 'Spasi di awal/akhir dihapus agar sesuai pembacaan server.'
      }
      if ([string]::IsNullOrWhiteSpace($trimmed)) {
        Write-Warn2 'Nilai tidak boleh hanya berisi spasi.'
        continue
      }
      return $trimmed
    }
    Write-Warn2 'Kedua isian tidak sama. Coba lagi.'
  }
  Fail "Gagal membaca $Label setelah 3 percobaan." 2
}

function Get-ApiError($ErrorRecord) {
  $status = 0
  try { $status = [int]$ErrorRecord.Exception.Response.StatusCode } catch { }

  $message = ''
  try {
    if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
      $message = [string]$ErrorRecord.ErrorDetails.Message
    }
  } catch { }

  if (-not $message) {
    try {
      $response = $ErrorRecord.Exception.Response
      if ($response) {
        $stream = $response.GetResponseStream()
        if ($stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $message = $reader.ReadToEnd()
          $reader.Dispose()
        }
      }
    } catch { }
  }

  if ($message) {
    try {
      $parsed = $message | ConvertFrom-Json
      if ($parsed.error) { $message = [string]$parsed.error }
      elseif ($parsed.message) { $message = [string]$parsed.message }
      elseif ($parsed.data -and $parsed.data.message) { $message = [string]$parsed.data.message }
    } catch { }
  }

  if (-not $message) { $message = $ErrorRecord.Exception.Message }
  return [pscustomobject]@{ Status = $status; Message = $message }
}

function Test-PocketBaseAdmin([string]$BaseUrl, [string]$Email, [string]$Password) {
  $base = $BaseUrl.TrimEnd('/')
  $payload = @{ identity = $Email; password = $Password } | ConvertTo-Json -Compress
  $body = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $endpoints = @(
    "$base/api/collections/_superusers/auth-with-password",
    "$base/api/admins/auth-with-password"
  )

  $lastCode = 0
  $lastMessage = ''
  foreach ($endpoint in $endpoints) {
    try {
      $response = Invoke-RestMethod -Uri $endpoint -Method Post -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 20
      if ($response.token) {
        $response = $null
        return [pscustomobject]@{ Ok = $true; Code = 200; Message = '' }
      }
      $lastMessage = 'PocketBase tidak mengembalikan token autentikasi.'
    } catch {
      $info = Get-ApiError $_
      $lastCode = $info.Status
      $lastMessage = $info.Message
      if ($lastCode -eq 400 -or $lastCode -eq 401 -or $lastCode -eq 403) { break }
      if ($lastCode -notin @(404, 405)) { break }
    }
  }

  return [pscustomobject]@{ Ok = $false; Code = $lastCode; Message = $lastMessage }
}

function New-BasicAuthHeaders([string]$Username, [string]$Password) {
  if ([string]::IsNullOrWhiteSpace($Password)) { return @{} }
  $pair = "$Username`:$Password"
  $token = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($pair))
  return @{ Authorization = "Basic $token" }
}

function Test-AppHealth([string]$BaseUrl, [hashtable]$Headers = @{}) {
  $base = $BaseUrl.TrimEnd('/')
  try {
    $health = Invoke-RestMethod -Uri "$base/api/health" -Method Get -Headers $Headers -TimeoutSec 30
    if ($health.status -ne 'ok') {
      return [pscustomobject]@{ Ok = $false; Message = "Status health: $($health.status)" }
    }
    return [pscustomobject]@{ Ok = $true; Message = '' }
  } catch {
    $info = Get-ApiError $_
    return [pscustomobject]@{ Ok = $false; Message = "HTTP $($info.Status): $($info.Message)" }
  }
}

function Invoke-JurnalVerification([string]$BaseUrl, [int]$Year, [string]$Username, [string]$Password, [hashtable]$Headers = @{}) {
  $base = $BaseUrl.TrimEnd('/')
  $pages = @()

  try {
    $sessionInfo = Invoke-RestMethod -Uri "$base/api/journal/session" -Method Get -Headers $Headers -TimeoutSec 20
  } catch {
    $info = Get-ApiError $_
    return [pscustomobject]@{
      Ok = $false
      Stage = 'session'
      Message = "GET /api/journal/session gagal (HTTP $($info.Status)): $($info.Message)"
      Pages = @()
    }
  }

  $configured = $sessionInfo.configured
  $developerLogin = $false
  $pocketbaseAdmin = $false
  $sessionSecret = $false
  if ($configured) {
    $developerLogin = [bool]$configured.developerLogin
    $pocketbaseAdmin = [bool]$configured.pocketbaseAdmin
    $sessionSecret = [bool]$configured.sessionSecret
  }

  if (-not ($developerLogin -and $pocketbaseAdmin -and $sessionSecret)) {
    $missing = @()
    if (-not $developerLogin) { $missing += 'JOURNAL_DEV_PASSWORD' }
    if (-not $pocketbaseAdmin) { $missing += 'PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD' }
    if (-not $sessionSecret) { $missing += 'JOURNAL_SESSION_SECRET' }
    return [pscustomobject]@{
      Ok = $false
      Stage = 'config'
      Message = "Server belum membaca konfigurasi: $($missing -join ', ')."
      Pages = @()
    }
  }

  $web = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  try {
    $payload = @{ username = $Username; password = $Password } | ConvertTo-Json -Compress
    $login = Invoke-RestMethod -Uri "$base/api/journal/session" -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -WebSession $web -Headers $Headers -TimeoutSec 30
    if (-not $login.success) { throw 'Server menolak login developer.' }
  } catch {
    $info = Get-ApiError $_
    try { Invoke-RestMethod -Uri "$base/api/journal/session" -Method Delete -WebSession $web -Headers $Headers -TimeoutSec 10 | Out-Null } catch { }
    return [pscustomobject]@{
      Ok = $false
      Stage = 'login'
      Message = "Sesi developer gagal dibuat (HTTP $($info.Status)): $($info.Message)"
      Pages = @()
    }
  }

  $failure = $null
  try {
    $sheets = Invoke-RestMethod -Uri "$base/api/journal/sheets?tahun=$Year" -Method Get -WebSession $web -Headers $Headers -TimeoutSec 60
    if (-not $sheets.success) { throw 'Server tidak mengembalikan success=true.' }
    foreach ($name in @('kas_utama', 'debit', 'kredit')) {
      $property = $sheets.sheets.PSObject.Properties[$name]
      if ($property -and $null -ne $property.Value) { $pages += $name }
    }
  } catch {
    $info = Get-ApiError $_
    $failure = "GET /api/journal/sheets gagal (HTTP $($info.Status)): $($info.Message)"
  } finally {
    try { Invoke-RestMethod -Uri "$base/api/journal/session" -Method Delete -WebSession $web -Headers $Headers -TimeoutSec 10 | Out-Null } catch { }
  }

  if ($failure) {
    return [pscustomobject]@{
      Ok = $false
      Stage = 'sheets'
      Message = $failure
      Pages = @()
    }
  }

  return [pscustomobject]@{
    Ok = $true
    Stage = 'done'
    Message = ''
    Pages = @($pages)
  }
}

# ----------------------------------------------------------- preflight
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ' BEJO STIKER POS - DEPLOY MODUL JURNAL VPS WINDOWS' -ForegroundColor Cyan
Write-Host " Waktu: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '==================================================================' -ForegroundColor DarkCyan

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail 'HARUS dijalankan sebagai Administrator (Run as administrator).' }

if (-not (Test-Path (Join-Path $AppDir 'package.json'))) {
  Fail "Aplikasi tidak ditemukan di $AppDir. Jalankan instalasi awal lebih dulu."
}
if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
  Fail "Service $ServiceName belum terdaftar. Jalankan deploy\install-vps-windows.ps1 lebih dulu."
}

$envPath = Join-Path $AppDir '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  Fail "File .env tidak ditemukan di $AppDir. Salin .env.example ke .env, isi kredensial inti, lalu jalankan ulang. Jangan deploy dengan .env kosong." 2
}

# ----------------------------------------------------------- 1. config
Write-Step '1/7 Memeriksa konfigurasi Jurnal di .env'

$adminEmail = ([string](Get-EnvValue $envPath 'PB_ADMIN_EMAIL')).Trim()
$adminPassword = ([string](Get-EnvValue $envPath 'PB_ADMIN_PASSWORD')).Trim()
$devUser = ([string](Get-EnvValue $envPath 'JOURNAL_DEV_USER')).Trim()
$devPassword = ([string](Get-EnvValue $envPath 'JOURNAL_DEV_PASSWORD')).Trim()
$sessionSecret = ([string](Get-EnvValue $envPath 'JOURNAL_SESSION_SECRET')).Trim()
$pbUrl = ([string](Get-EnvValue $envPath 'POCKETBASE_UPSTREAM')).Trim()

$updates = [ordered]@{}
$missing = @()
if ([string]::IsNullOrWhiteSpace($adminEmail)) { $missing += 'PB_ADMIN_EMAIL' }
if ([string]::IsNullOrWhiteSpace($adminPassword)) { $missing += 'PB_ADMIN_PASSWORD' }
if ([string]::IsNullOrWhiteSpace($devPassword)) { $missing += 'JOURNAL_DEV_PASSWORD' }

if ($missing.Count -gt 0 -and $NonInteractive) {
  Write-Warn2 "Kredensial Jurnal belum lengkap: $($missing -join ', ')"
  Write-Host '   Isi key tersebut di .env lalu jalankan ulang tanpa -NonInteractive.' -ForegroundColor Yellow
  Fail 'Deploy dibatalkan agar Jurnal tidak terpasang tanpa konfigurasi.' 2
}

if ([string]::IsNullOrWhiteSpace($adminEmail)) {
  Write-Warn2 'PB_ADMIN_EMAIL belum diisi.'
  $adminEmail = Read-Email 'Email superuser PocketBase (_superusers)'
  $updates['PB_ADMIN_EMAIL'] = $adminEmail
}

if ([string]::IsNullOrWhiteSpace($adminPassword)) {
  Write-Warn2 'PB_ADMIN_PASSWORD belum diisi.'
  $adminPassword = Read-NewSecret 'Password superuser PocketBase'
  $updates['PB_ADMIN_PASSWORD'] = $adminPassword
} elseif ($adminPassword.Length -lt 8) {
  Write-Warn2 'PB_ADMIN_PASSWORD yang ada kurang dari 8 karakter; pastikan nilainya benar.'
}

if ([string]::IsNullOrWhiteSpace($devUser)) {
  if ($NonInteractive) {
    $devUser = 'langgo'
  } else {
    $devUser = Read-DevUser 'langgo'
  }
  $updates['JOURNAL_DEV_USER'] = $devUser
} elseif ($devUser -notmatch '^[A-Za-z0-9._-]{3,40}$') {
  Write-Warn2 'JOURNAL_DEV_USER yang ada mengandung karakter tidak biasa; login tetap memakai nilai tersebut.'
}

if ([string]::IsNullOrWhiteSpace($devPassword)) {
  Write-Warn2 'JOURNAL_DEV_PASSWORD belum diisi.'
  $devPassword = Read-NewSecret 'Password akun DEVELOPER aplikasi (JOURNAL_DEV_PASSWORD)'
  $updates['JOURNAL_DEV_PASSWORD'] = $devPassword
} elseif ($devPassword.Length -lt 8) {
  Write-Warn2 'JOURNAL_DEV_PASSWORD yang ada kurang dari 8 karakter; disarankan diganti.'
}

$sessionSecretGenerated = $false
if ([string]::IsNullOrWhiteSpace($sessionSecret)) {
  $sessionSecret = New-RandomSecret 48
  $updates['JOURNAL_SESSION_SECRET'] = $sessionSecret
  $sessionSecretGenerated = $true
  Write-Ok 'JOURNAL_SESSION_SECRET dibuat otomatis (tidak dicetak).'
} elseif ($sessionSecret.Length -lt 32) {
  Write-Warn2 'JOURNAL_SESSION_SECRET yang ada kurang dari 32 karakter; disarankan string acak 32+ karakter.'
}

if ([string]::IsNullOrWhiteSpace($pbUrl)) {
  $pbUrl = 'http://127.0.0.1:8090'
  $updates['POCKETBASE_UPSTREAM'] = $pbUrl
}

if ($adminPassword -and $devPassword -and $adminPassword -ceq $devPassword) {
  Write-Warn2 'JOURNAL_DEV_PASSWORD sebaiknya berbeda dari PB_ADMIN_PASSWORD (pemisahan hak akses).'
}

Write-Ok 'Kredensial Jurnal tersedia di memori (nilai tidak dicetak).'

# ----------------------------------------------------------- 2. pocketbase
Write-Step '2/7 Menguji login superuser PocketBase'
if ($SkipPocketBaseCheck) {
  Write-Warn2 'Uji login PocketBase dilewati karena -SkipPocketBaseCheck.'
} else {
  $pbResult = Test-PocketBaseAdmin $pbUrl $adminEmail $adminPassword
  if ($pbResult.Ok) {
    Write-Ok 'Login superuser PocketBase berhasil.'
  } else {
    Write-Warn2 "Login superuser PocketBase gagal (HTTP $($pbResult.Code)): $($pbResult.Message)"
    Write-Host '   Pastikan service PocketBase berjalan dan kredensial berasal dari akun _superusers,' -ForegroundColor Yellow
    Write-Host '   bukan akun sync aplikasi. Buat/ganti akun di http://127.0.0.1:8090/_/ bila perlu.' -ForegroundColor Yellow
    Write-Host '   Lalu perbaiki PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD di .env.' -ForegroundColor Yellow
    Fail 'Deploy dibatalkan. Gunakan -SkipPocketBaseCheck hanya bila PocketBase diperiksa manual.' 3
  }
}

# ----------------------------------------------------------- 3. write env
Write-Step '3/7 Menyimpan konfigurasi .env'
$envBackup = $null
if ($updates.Count -gt 0) {
  try {
    $envBackup = Backup-EnvFile $envPath
    $changedKeys = @(Set-EnvValues $envPath $updates)
  } catch {
    Fail "Gagal menulis .env: $($_.Exception.Message)" 2
  }

  if ($changedKeys.Count -gt 0) {
    Write-Ok "Key diperbarui: $($changedKeys -join ', ')"
    Write-Host "   Backup .env: $envBackup (berisi rahasia, jangan dibagikan)" -ForegroundColor DarkGray
  } else {
    Write-Ok '.env sudah sesuai; tidak ada perubahan.'
  }
} else {
  Write-Ok '.env Jurnal sudah lengkap; tidak ada perubahan.'
}

if ($updates.Count -gt 0) {
  foreach ($key in $updates.Keys) {
    $stored = [string](Get-EnvValue $envPath $key)
    $expected = [string]$updates[$key]
    if ($stored -cne $expected) {
      if ($envBackup -and (Test-Path -LiteralPath $envBackup)) {
        Copy-Item -LiteralPath $envBackup -Destination $envPath -Force
        Write-Warn2 'Perubahan .env dikembalikan dari backup.'
      }
      Fail "Nilai $key berubah saat ditulis ke .env. Ganti karakter kontrol/baris baru pada nilai tersebut lalu jalankan ulang." 2
    }
  }
}

$adminEmail = ([string](Get-EnvValue $envPath 'PB_ADMIN_EMAIL')).Trim()
$adminPassword = ([string](Get-EnvValue $envPath 'PB_ADMIN_PASSWORD')).Trim()
$devUser = ([string](Get-EnvValue $envPath 'JOURNAL_DEV_USER')).Trim()
$devPassword = ([string](Get-EnvValue $envPath 'JOURNAL_DEV_PASSWORD')).Trim()
$sessionSecret = ([string](Get-EnvValue $envPath 'JOURNAL_SESSION_SECRET')).Trim()
$pbUrl = ([string](Get-EnvValue $envPath 'POCKETBASE_UPSTREAM')).Trim()
if (-not $pbUrl) { $pbUrl = 'http://127.0.0.1:8090' }

foreach ($pair in @(
  @{ Key = 'PB_ADMIN_EMAIL'; Value = $adminEmail },
  @{ Key = 'PB_ADMIN_PASSWORD'; Value = $adminPassword },
  @{ Key = 'JOURNAL_DEV_USER'; Value = $devUser },
  @{ Key = 'JOURNAL_DEV_PASSWORD'; Value = $devPassword },
  @{ Key = 'JOURNAL_SESSION_SECRET'; Value = $sessionSecret }
)) {
  if ([string]::IsNullOrWhiteSpace([string]$pair.Value)) {
    Fail "Key $($pair.Key) masih kosong di .env setelah penulisan." 2
  }
}
Write-Ok 'Konfigurasi Jurnal terbaca kembali dari .env.'
Write-Host '   JOURNAL_DEV_USER/PASSWORD dipakai server untuk sesi otomatis;' -ForegroundColor DarkGray
Write-Host '   nilainya harus sama dengan kredensial login DEVELOPER aplikasi.' -ForegroundColor DarkGray

# ----------------------------------------------------------- 4. deploy
Write-Step '4/7 Menjalankan deploy penuh'
$fullScript = Join-Path $PSScriptRoot 'deploy-full-vps.ps1'
if (-not (Test-Path -LiteralPath $fullScript)) {
  $fullScript = Join-Path $env:TEMP "bejo-deploy-full-$Stamp.ps1"
  $fullUrl = "https://raw.githubusercontent.com/$RepoOwner/$RepoName/$Branch/deploy/deploy-full-vps.ps1"
  Write-Warn2 "deploy-full-vps.ps1 tidak ada di folder script; mengunduh dari GitHub."
  try {
    Invoke-WebRequest -Uri $fullUrl -OutFile $fullScript -UseBasicParsing -TimeoutSec 60
    if ((Get-Item $fullScript).Length -lt 1000) { throw 'File hasil unduhan tidak valid.' }
  } catch {
    Fail "Gagal menyiapkan deploy-full-vps.ps1: $($_.Exception.Message)"
  }
}

$deployArgs = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $fullScript,
  '-AppDir', $AppDir,
  '-Branch', $Branch,
  '-RepoOwner', $RepoOwner,
  '-RepoName', $RepoName,
  '-ServiceName', $ServiceName,
  '-CaddyDir', $CaddyDir,
  '-BackupRoot', $BackupRoot,
  '-NonInteractive'
)
if ($SkipSourceUpdate) { $deployArgs += '-SkipSourceUpdate' }
if ($SkipCaddy) { $deployArgs += '-SkipCaddy' }
if ($Force) { $deployArgs += '-Force' }
if ($KeepSourceArchive) { $deployArgs += '-KeepSourceArchive' }

& powershell.exe @deployArgs
$deployExit = $LASTEXITCODE
if ($deployExit -ne 0) {
  Fail "Deploy gagal (exit $deployExit). Periksa $AppDir\logs\stderr.log lalu jalankan ulang." 1
}
Write-Ok 'Deploy penuh selesai.'

# ----------------------------------------------------------- 5. health
Write-Step '5/7 Memeriksa health lokal'
$port = Get-EnvValue $envPath 'PORT'
if ([string]::IsNullOrWhiteSpace($port)) { $port = '3000' }
$localBase = "http://127.0.0.1:$port"

try {
  $health = Invoke-RestMethod -Uri "$localBase/api/health" -Method Get -TimeoutSec 20
  if ($health.status -ne 'ok') { throw "Status health: $($health.status)" }
  Write-Ok "Aplikasi sehat di $localBase/api/health."
} catch {
  $info = Get-ApiError $_
  Fail "Health lokal gagal (HTTP $($info.Status)): $($info.Message). Periksa $AppDir\logs\stderr.log." 1
}

# ----------------------------------------------------------- 6. jurnal
Write-Step '6/7 Verifikasi Jurnal end-to-end (lokal)'
$currentYear = (Get-Date).Year
$verifyYear = [Math]::Min(2028, [Math]::Max(2022, $currentYear))
Write-Host "   Tahun uji: $verifyYear" -ForegroundColor DarkGray

$verify = Invoke-JurnalVerification $localBase $verifyYear $devUser $devPassword
if (-not $verify.Ok) {
  Write-Warn2 $verify.Message
  switch ($verify.Stage) {
    'session' {
      Write-Host '   Endpoint Jurnal belum merespons. Pastikan build terbaru sudah terpasang dan service berjalan.' -ForegroundColor Yellow
    }
    'config' {
      Write-Host '   Restart service lalu jalankan ulang script; pastikan .env dibaca oleh service.' -ForegroundColor Yellow
    }
    'login' {
      Write-Host '   Samakan JOURNAL_DEV_USER / JOURNAL_DEV_PASSWORD di .env dengan kredensial login DEVELOPER aplikasi.' -ForegroundColor Yellow
      Write-Host '   Nilai lama mungkin berbeda dari yang baru diisi.' -ForegroundColor Yellow
    }
    'sheets' {
      Write-Host '   Periksa service PocketBase, POCKETBASE_UPSTREAM, dan kredensial superuser.' -ForegroundColor Yellow
      Write-Host "   Log server: $AppDir\logs\stderr.log" -ForegroundColor Yellow
    }
  }
  Fail 'Verifikasi Jurnal gagal.' 3
}

Write-Ok "Sesi Jurnal otomatis berhasil diuji (akun $devUser)."
Write-Ok 'Koleksi jurnal_sheets siap.'
if ($verify.Pages.Count -gt 0) {
  Write-Ok "Data tahun $verifyYear ditemukan di halaman: $($verify.Pages -join ', ')."
} else {
  Write-Host "   Belum ada data tahun $verifyYear (normal pada deploy pertama)." -ForegroundColor DarkGray
}

# ----------------------------------------------------------- 7. public
Write-Step '7/7 Memverifikasi akses internet lewat APP_URL'
$appUrl = ([string](Get-EnvValue $envPath 'APP_URL')).Trim()
$publicStatus = 'belum diverifikasi'

if ($SkipPublicCheck) {
  $publicStatus = 'dilewati (-SkipPublicCheck)'
  Write-Warn2 'Verifikasi akses publik dilewati karena -SkipPublicCheck.'
} elseif ([string]::IsNullOrWhiteSpace($appUrl)) {
  Write-Warn2 'APP_URL belum diisi di .env.'
  Write-Host '   Isi APP_URL dengan domain publik (contoh: https://pos.domainanda.com), lalu jalankan ulang,' -ForegroundColor Yellow
  Write-Host '   atau jalankan dengan -SkipPublicCheck bila verifikasi internet dilakukan manual.' -ForegroundColor Yellow
  Fail 'APP_URL belum diisi sehingga akses internet tidak bisa diverifikasi.' 2
} else {
  if ($appUrl -notmatch '^https?://') {
    Fail "APP_URL harus diawali http:// atau https:// (nilai saat ini: $appUrl)." 2
  }

  $remoteUser = ([string](Get-EnvValue $envPath 'REMOTE_ACCESS_USER')).Trim()
  $remotePass = ([string](Get-EnvValue $envPath 'REMOTE_ACCESS_PASS')).Trim()
  if ([string]::IsNullOrWhiteSpace($remoteUser)) { $remoteUser = 'bejo' }
  $publicHeaders = New-BasicAuthHeaders $remoteUser $remotePass
  if ($publicHeaders.Count -gt 0) {
    Write-Host '   Basic Auth publik aktif (nilai tidak dicetak).' -ForegroundColor DarkGray
  }

  $publicHealth = Test-AppHealth $appUrl $publicHeaders
  if (-not $publicHealth.Ok) {
    Write-Warn2 "Health publik gagal: $($publicHealth.Message)"
    Write-Host '   Periksa DNS, Caddy, firewall port 80/443, dan nilai APP_URL.' -ForegroundColor Yellow
    Fail 'Aplikasi belum dapat diakses lewat internet.' 3
  }
  Write-Ok "Health publik OK: $($appUrl.TrimEnd('/'))/api/health."

  $publicVerify = Invoke-JurnalVerification $appUrl $verifyYear $devUser $devPassword $publicHeaders
  if (-not $publicVerify.Ok) {
    Write-Warn2 $publicVerify.Message
    if ($publicVerify.Stage -eq 'login') {
      Write-Host '   JOURNAL_DEV_USER / JOURNAL_DEV_PASSWORD di .env harus sama dengan kredensial login DEVELOPER aplikasi.' -ForegroundColor Yellow
    }
    Fail 'Verifikasi Jurnal lewat internet gagal.' 3
  }
  $publicStatus = 'terverifikasi'
  Write-Ok 'Jurnal dapat diakses lewat internet (sesi otomatis dan koleksi siap).'
  if ($publicVerify.Pages.Count -gt 0) {
    Write-Ok "Data tahun $verifyYear ditemukan lewat internet: $($publicVerify.Pages -join ', ')."
  }
}

# ----------------------------------------------------------- summary
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
$serviceStatus = if ($service) { $service.Status } else { 'tidak terdaftar' }
$appUrlDisplay = if ($appUrl) { $appUrl } else { 'APP_URL belum diisi' }

Write-Host ''
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ' RINGKASAN DEPLOY JURNAL' -ForegroundColor Cyan
Write-Host "   Service aplikasi : $ServiceName ($serviceStatus)"
Write-Host "   Health lokal     : OK"
Write-Host "   Akun DEVELOPER   : $devUser (sesi Jurnal otomatis)"
Write-Host "   Jurnal           : siap (sesi developer dan koleksi terverifikasi)"
Write-Host "   Akses publik     : $appUrlDisplay ($publicStatus)"
if ($sessionSecretGenerated) {
  Write-Host '   Sesi Jurnal      : JOURNAL_SESSION_SECRET baru dibuat otomatis'
}
if ($envBackup) {
  Write-Host "   Backup .env      : $envBackup"
}
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ''
Write-Host ' Langkah berikutnya:' -ForegroundColor Cyan
Write-Host '   1. Buka aplikasi lewat APP_URL dan login sebagai DEVELOPER.'
Write-Host '   2. Masuk ke Laporan > Jurnal; tidak ada login kedua (sesi API otomatis).'
Write-Host '   3. Data Jurnal disimpan di PocketBase (koleksi jurnal_sheets).'
Write-Host ''

if ($fullScript -ne (Join-Path $PSScriptRoot 'deploy-full-vps.ps1') -and (Test-Path -LiteralPath $fullScript)) {
  Remove-Item -LiteralPath $fullScript -Force -ErrorAction SilentlyContinue
}

exit 0
