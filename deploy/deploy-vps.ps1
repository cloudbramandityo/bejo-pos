<#
=====================================================================
  BEJO Digital Print - UNIVERSAL DEPLOY VPS WINDOWS
=====================================================================
  Satu-satunya skrip deploy produksi untuk VPS Windows yang sudah live.
  Kebijakan: jangan membuat skrip deploy baru. Setiap kebutuhan deploy
  baru ditambahkan sebagai opsi/setting di skrip ini.
  Marker: SECRETS-ROTATION-V1
  Jalankan DI DALAM VPS lewat RDP sebagai Administrator:

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-vps.ps1 -Force

  Alur:
    1. Preflight: admin, folder aplikasi, service, Node/npm, .env, PocketBase, Caddy
    2. Unduh source terbaru dari GitHub (branch main) atau pakai source lokal
    3. Salin source tanpa menyentuh .env, data/, logs/, backups/, node_modules/, dist/
    3b. Bila diminta: setel PUBLIC_SITE, isi kredensial admin PocketBase,
        setel/rotasi password DEVELOPER (hash scrypt), dan hapus backup .env plaintext.
    4. Validasi .env keamanan (PUBLIC_SITE, REMOTE_ACCESS_PASS, kredensial developer, DSB.)
       PUBLIC_SITE=true  : landing publik terbuka, dashboard wajib login,
                           PB_ADMIN_* wajib, hardening PocketBase wajib.
       PUBLIC_SITE=false : Basic Auth REMOTE_ACCESS_PASS (atau LAN-only).
    5. Perketat aturan akses koleksi PocketBase (--harden) + perbaiki skema field
       yang hilang, lalu verifikasi skema akun: `app_users` (direktori yang dibaca
       browser) dan `users` (kredensial, hanya ditulis server). Deploy berhenti
       bila skema ini salah, karena semua tulis akun dari aplikasi akan gagal.
    6. Backup dist dan Caddyfile, lalu pasang Caddyfile (batas body 110MB)
    7. npm ci + build produksi
    8. Restart service aplikasi, health check lokal, rollback otomatis bila gagal
    9. Verifikasi lokal: service, Jurnal, auth developer, broker PocketBase,
       Marketing, jalur SSE realtime PocketBase (PB_CONNECT benar-benar mengalir),
       dan isi direktori akun hasil proyeksi boot server
    10. Verifikasi live: DNS, HTTPS, APP_URL publik, identitas Landing,
        PocketBase publik + realtime publik + isi bundle browser (URL DB)
    11. Ringkasan hasil deploy

  Data yang TIDAK disentuh:
    .env, data/, logs/, backups/, database PocketBase

  Opsi:
    -AppDir C:\bejo-pos          Folder aplikasi di VPS
    -Branch main                 Branch GitHub
    -PublicUrl <url>             Override APP_URL untuk verifikasi publik
    -Force                       Timpa perubahan lokal tracked (patch tetap dibackup)
    -SkipSourceUpdate            Pakai source lokal di VPS
    -SkipCaddy                   Jangan ubah/restart Caddy
    -SkipPbHardening             Jangan perketat aturan akses koleksi PocketBase
    -AllowLanOnly                Izinkan REMOTE_ACCESS_PASS kosong (akses internet ditolak)
    -SkipPublicCheck             Lewati verifikasi domain publik
    -SkipRealtimeCheck            Lewati uji sinkronisasi realtime PocketBase (SSE)
    -SkipMarketingCheck          Lewati pemeriksaan endpoint Marketing
    -RequireMarketing            Exit code 2 bila kanal Marketing belum LIVE
    -KeepSourceArchive           Simpan arsip source di %TEMP%
    -EnablePublicSite            Tulis PUBLIC_SITE=true dan
                                 ALLOW_DEFAULT_STAFF_PASSWORDS=false ke .env
    -ConfigurePbAdmin            Tanya PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD bila kosong
                                 (password tidak pernah dicetak)
    -SetDevPassword              Tanya password DEVELOPER stabil (minimal 10 karakter,
                                 input tersembunyi) lalu simpan hash scrypt di .env
    -RotateDevPassword           DARURAT saja: ganti password DEVELOPER dengan acak
                                 (tanpa opsi ini password stabil di .env tidak disentuh)
    -DevPasswordLength <n>       Panjang password DEVELOPER hasil rotasi (default 10)
    -PurgePlaintextEnvBackups    Hapus backup .env plaintext di backups/ (butuh -Force)

  Catatan keamanan:
    - Nilai rahasia tidak pernah dicetak ke konsol.
    - Password DEVELOPER bersifat STABIL: setel sekali dengan
      "npm run dev-password:set" di <AppDir>, lalu deploy tidak mengubahnya.
      Hanya hash scrypt yang tersimpan di .env (tanpa plaintext).
    - Bila -RotateDevPassword dipakai (darurat), password baru ditulis ke
      <AppDir>\secrets\developer-password-*.txt dengan izin Administrators + SYSTEM.
      Simpan ke password manager lalu hapus.
    - Backup .env plaintext ditimpa byte acak sebelum dihapus.

  Exit code:
    0 sukses
    1 deploy/health lokal/hardening gagal
    2 Marketing wajib belum LIVE
    3 verifikasi publik/DNS/HTTPS gagal
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
  [string]$PublicUrl = '',
  [switch]$SkipSourceUpdate,
  [switch]$SkipCaddy,
  [switch]$SkipPbHardening,
  [switch]$AllowLanOnly,
  [switch]$SkipPublicCheck,
  [switch]$SkipRealtimeCheck,
  [switch]$SkipMarketingCheck,
  [switch]$RequireMarketing,
  [switch]$Force,
  [switch]$KeepSourceArchive,
  [switch]$EnablePublicSite,
  [switch]$ConfigurePbAdmin,
  [switch]$SetDevPassword,
  [switch]$RotateDevPassword,
  [int]$DevPasswordLength = 10,
  [switch]$PurgePlaintextEnvBackups
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

function Get-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trim = $line.Trim()
    if ($trim -eq '' -or $trim.StartsWith('#')) { continue }
    $eq = $trim.IndexOf('=')
    if ($eq -lt 1) { continue }
    if ($trim.Substring(0, $eq).Trim() -eq $Key) {
      $value = $trim.Substring($eq + 1).Trim()
      if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
        # Samakan dengan dotenv: \" dan \\ di dalam tanda kutip ganda di-unescape.
        $value = [regex]::Replace($value.Substring(1, $value.Length - 2), '\\(["\\])', '$1')
      } elseif ($value.Length -ge 2 -and $value.StartsWith("'") -and $value.EndsWith("'")) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }
  return $null
}

# ----------------------------------------------------------- secrets helpers
# Nilai rahasia tidak pernah dicetak. Semua penulisan .env bersifat atomik
# (tulis ke file sementara lalu ganti) agar file tidak korup saat gagal.
function ConvertTo-EnvLiteral([string]$Value) {
  if ($Value -match '^[A-Za-z0-9._/:@+-]*$') { return $Value }
  # Kutip tunggal = nilai literal (dotenv & Get-EnvValue membacanya apa adanya).
  if (-not $Value.Contains("'")) { return "'" + $Value + "'" }
  $escaped = $Value.Replace('\', '\\').Replace('"', '\"')
  return '"' + $escaped + '"'
}

function Set-EnvValue([string]$Path, [string]$Key, [string]$Value) {
  if ($Value -match "[`r`n]") { Fail 'Nilai .env tidak boleh mengandung baris baru.' }
  $raw = [System.IO.File]::ReadAllText($Path)
  if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
  $eol = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
  $lines = [System.Collections.Generic.List[string]]($raw -split "`r?`n")
  $pattern = '^\s*' + [regex]::Escape($Key) + '\s*='
  $entry = $Key + '=' + (ConvertTo-EnvLiteral $Value)
  $replaced = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) { $lines[$i] = $entry; $replaced = $true; break }
  }
  if (-not $replaced) {
    if ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -eq '') { $lines.Insert($lines.Count - 1, $entry) }
    else { $lines.Add($entry) }
  }
  $temp = "$Path.$PID.tmp"
  try {
    [System.IO.File]::WriteAllText($temp, ($lines -join $eol), (New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temp -Destination $Path -Force
  } finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }
  }
}

function Get-RandomPick([string]$Chars, $Rng) {
  $buffer = New-Object byte[] 4
  $Rng.GetBytes($buffer)
  $index = [int]([BitConverter]::ToUInt32($buffer, 0) % [uint32]$Chars.Length)
  return $Chars[$index]
}

function New-RandomPassword([int]$Length = 10) {
  $upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  $lower = 'abcdefghijkmnopqrstuvwxyz'
  $digits = '23456789'
  $all = $upper + $lower + $digits
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $chars = New-Object System.Collections.Generic.List[char]
    $chars.Add([char](Get-RandomPick $upper $rng))
    $chars.Add([char](Get-RandomPick $lower $rng))
    $chars.Add([char](Get-RandomPick $digits $rng))
    while ($chars.Count -lt $Length) { $chars.Add([char](Get-RandomPick $all $rng)) }
    for ($i = $chars.Count - 1; $i -gt 0; $i--) {
      $buffer = New-Object byte[] 4
      $rng.GetBytes($buffer)
      $j = [int]([BitConverter]::ToUInt32($buffer, 0) % [uint32]($i + 1))
      $tmp = $chars[$i]; $chars[$i] = $chars[$j]; $chars[$j] = $tmp
    }
    return -join $chars
  } finally {
    $rng.Dispose()
  }
}

function Read-PlainSecret([string]$Prompt) {
  try {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
  } catch {
    Fail 'Input password membutuhkan konsol interaktif. Jalankan lewat RDP, bukan dari pipe/tugas otomatis.'
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# Simpan password pilihan operator sebagai hash scrypt di .env. Plaintext
# dikirim lewat stdin base64 (tidak terlihat di daftar proses) dan tidak ditulis
# ke disk maupun dicetak.
function Set-DevPasswordHash([string]$PlainPassword, [int]$MinLength) {
  $setPassScript = Join-Path $AppDir 'scripts\set-dev-password.mjs'
  if (-not (Test-Path -LiteralPath $setPassScript)) {
    Fail "Skrip $setPassScript tidak ditemukan; pastikan source terbaru sudah tersalin."
  }
  $nodeExe = (Get-Command node).Source
  $passwordBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($PlainPassword))
  $hashExit = 0
  $previousEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $passwordBase64 | & $nodeExe $setPassScript --env $envPath --stdin --base64 --min-length $MinLength --no-backup 2>&1 |
      ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
    $hashExit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousEap
    $passwordBase64 = $null
  }
  if ($hashExit -ne 0) { Fail 'Gagal menyimpan hash password DEVELOPER (lihat pesan di atas).' }

  $newHash = Get-EnvValue $envPath 'DEV_PASSWORD_HASH'
  if ([string]::IsNullOrWhiteSpace($newHash) -or $newHash -notmatch '^scrypt\$') {
    Fail 'DEV_PASSWORD_HASH tidak terbentuk dengan format scrypt.'
  }
  foreach ($legacyKey in @('DEV_PASSWORD', 'JOURNAL_DEV_PASSWORD')) {
    if (-not [string]::IsNullOrWhiteSpace((Get-EnvValue $envPath $legacyKey))) {
      Write-Warn2 "$legacyKey masih aktif di .env; nonaktifkan manual."
    }
  }
}

function Protect-SecretFile([string]$Path) {
  $icacls = Get-Command icacls.exe -ErrorAction SilentlyContinue
  if (-not $icacls) {
    Write-Warn2 'icacls tidak ditemukan; atur izin file rahasia secara manual.'
    return
  }
  # Pengguna yang menjalankan deploy tetap bisa membuka file (Explorer tidak selalu elevated).
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $Path /inheritance:r /grant:r "${identity}:(F)" '*S-1-5-32-544:(F)' '*S-1-5-18:(F)' | Out-Null
}

function Test-EnvBackupName([string]$Name) {
  $n = $Name.ToLowerInvariant()
  if ($n -in @('.env.example', 'env.example')) { return $false }
  if ($n -match '^\.env($|[._-])') { return $true }
  if ($n -match '^env([._-]|$)' -and $n -match '\.(bak|backup|old|txt|copy|save|env)$') { return $true }
  if ($n -match '(^|[-_.])env([._-]|$)' -and $n -match '\.(bak|backup|old|copy|save)$') { return $true }
  return $false
}

function Remove-SecretFile([string]$Path) {
  try {
    $length = (Get-Item -LiteralPath $Path).Length
    if ($length -gt 0) {
      $chunkSize = [Math]::Min($length, 1048576)
      $buffer = New-Object byte[] $chunkSize
      $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
      try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
      $stream = [System.IO.File]::Open($Path, 'Open', 'Write', 'None')
      try {
        for ($written = 0; $written -lt $length; $written += $chunkSize) {
          $stream.Write($buffer, 0, [Math]::Min($chunkSize, $length - $written))
        }
        $stream.Flush($true)
      } finally { $stream.Dispose() }
    }
    Remove-Item -LiteralPath $Path -Force
    return $true
  } catch {
    Write-Warn2 "Gagal menghapus $Path : $($_.Exception.Message)"
    return $false
  }
}

function Remove-PlaintextEnvBackups([string[]]$Directories, [bool]$Confirmed) {
  $found = New-Object System.Collections.Generic.List[string]
  foreach ($dir in $Directories) {
    if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { continue }
    Get-ChildItem -LiteralPath $dir -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { Test-EnvBackupName $_.Name } |
      ForEach-Object { $found.Add($_.FullName) }
  }
  if ($found.Count -eq 0) {
    Write-Ok 'Tidak ada backup .env plaintext di folder backup.'
    return 0
  }
  if (-not $Confirmed) {
    Write-Warn2 "Ditemukan $($found.Count) backup .env plaintext. Tidak dihapus karena -Force tidak diberikan:"
    $found | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
    return 0
  }
  $removed = 0
  foreach ($path in $found) {
    if (Remove-SecretFile $path) {
      $removed++
      Write-Host "   Hapus: $path" -ForegroundColor DarkGray
    }
  }
  Write-Ok "$removed backup .env plaintext ditimpa byte acak lalu dihapus."
  return $removed
}


function Test-AppHealth([string]$Url, [int]$TimeoutSec = 5) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    return ($response.StatusCode -eq 200)
  } catch {
    return $false
  }
}

# Basic Auth / proteksi akses bisa membuat endpoint publik menjawab 401/403.
# Kode tersebut tetap berarti Caddy dan aplikasi terjangkau dari internet.
function Test-PublicEndpoint([string]$Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20 -MaximumRedirection 4
    $code = [int]$response.StatusCode
    $ok = $code -in @(200, 201, 204, 301, 302, 307, 308, 401, 403)
    return [pscustomobject]@{ Ok = $ok; Code = $code; Error = '' }
  } catch {
    $status = 0
    try { $status = [int]$_.Exception.Response.StatusCode } catch { }
    $ok = $status -in @(200, 201, 204, 301, 302, 307, 308, 401, 403)
    return [pscustomobject]@{ Ok = $ok; Code = $status; Error = $_.Exception.Message }
  }
}

# Uji end-to-end jalur SSE realtime PocketBase. Yang dibuktikan: proxy
# meneruskan streaming (content-type text/event-stream) dan event PB_CONNECT
# pertama benar-benar sampai ke klien, bukan tertahan di buffer.
function Test-RealtimeStream([string]$Url, [int]$TimeoutSec = 8) {
  $result = [pscustomobject]@{ Ok = $false; StatusCode = 0; ContentType = ''; GotConnect = $false; Error = '' }
  try {
    if (-not ('System.Net.Http.HttpClient' -as [type])) {
      Add-Type -AssemblyName System.Net.Http -ErrorAction Stop
    }
    $client = New-Object System.Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
    try {
      $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, $Url)
      $response = $client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
      $result.StatusCode = [int]$response.StatusCode
      $result.ContentType = [string]$response.Content.Headers.ContentType.MediaType
      if ($response.IsSuccessStatusCode) {
        $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $buffer = New-Object byte[] 4096
        $readTask = $stream.ReadAsync($buffer, 0, $buffer.Length)
        if ($readTask.Wait([TimeSpan]::FromSeconds($TimeoutSec)) -and $readTask.Result -gt 0) {
          $head = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $readTask.Result)
          $result.GotConnect = ($head -match 'PB_CONNECT') -or ($head -match 'clientId')
        }
        $stream.Dispose()
      } else {
        $result.Error = "HTTP $($result.StatusCode)"
      }
      $response.Dispose()
      $request.Dispose()
    } finally {
      $client.Dispose()
    }
    $result.Ok = ($result.StatusCode -eq 200) -and ($result.ContentType -eq 'text/event-stream') -and $result.GotConnect
    if (-not $result.Ok -and -not $result.Error) {
      $result.Error = "content-type '$($result.ContentType)', PB_CONNECT $(if ($result.GotConnect) { 'diterima' } else { 'tidak diterima' })"
    }
  } catch {
    $result.Error = $_.Exception.Message
  }
  return $result
}

function Restore-Dist([string]$BackupPath, [string]$TargetPath) {
  if (-not $BackupPath -or -not (Test-Path -LiteralPath $BackupPath)) { return $false }
  try {
    if (Test-Path -LiteralPath $TargetPath) { Remove-Item -LiteralPath $TargetPath -Recurse -Force }
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

# APP_URL di .env bisa berisi localhost (mis. sisa pengembangan).
# Untuk verifikasi internet, ambil domain utama dari Caddyfile bila perlu.
function Get-CaddyPublicUrl([string]$AppDir) {
  $caddySource = Join-Path $AppDir 'deploy\Caddyfile.windows'
  if (-not (Test-Path -LiteralPath $caddySource)) { return '' }
  $text = Get-Content -LiteralPath $caddySource -Raw
  $domainMatches = [regex]::Matches(
    $text,
    '(?m)^\s*([a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,})\s*\{'
  )
  foreach ($match in $domainMatches) {
    $domain = $match.Groups[1].Value
    if ($domain -notmatch '^www\.') { return "https://$domain" }
  }
  return ''
}

# Skrip lama sudah digabung ke skrip universal ini. Hapus dari VPS agar
# tidak terpakai lagi setelah deploy berikutnya.
function Remove-ObsoleteWrappers([string]$AppDir) {
  $relativePaths = @(
    'deploy\deploy-and-verify.ps1',
    'deploy\deploy-full-vps.ps1',
    'deploy\deploy-jurnal-vps.ps1',
    'deploy\deploy-vps-windows.ps1',
    'deploy\deploy-vps.sh',
    'deploy\install-vps.sh',
    'deploy\unduh-deploy-and-verify.ps1',
    'deploy\quick-update.ps1',
    'deploy\remote-run.ps1',
    'deploy\setup-all-vps.ps1',
    'deploy\update-from-git.ps1',
    'jalankan-online.bat',
    'jalankan-online.ps1',
    'pasang-always-on.ps1',
    'restart-always-on.ps1',
    'server-always-on.ps1',
    'tunnel-always-on.ps1'
  )
  $removed = 0
  foreach ($relative in $relativePaths) {
    $path = Join-Path $AppDir $relative
    if (Test-Path -LiteralPath $path) {
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
      if (-not (Test-Path -LiteralPath $path)) {
        $removed++
        Write-Host "   Hapus skrip lama: $relative" -ForegroundColor DarkGray
      }
    }
  }
  if ($removed -eq 0) {
    Write-Ok 'Tidak ada skrip deploy lama yang tersisa.'
  } else {
    Write-Ok "$removed skrip lama dibersihkan."
  }
}

# File sisa versi lama yang masih memakai nama merek lama. Diarsipkan (bukan
# dihapus) ke luar folder aplikasi agar build guard tidak memindainya lagi.
function Move-ObsoleteBrandFiles([string]$AppDir, [string]$ArchiveRoot) {
  $relativePaths = @(
    'cek-sinkronisasi.ps1',
    'deploy\run-deploy.ps1',
    'src\components\KasUtamaScreen.tsx'
  )
  $found = @()
  foreach ($relative in $relativePaths) {
    if (Test-Path -LiteralPath (Join-Path $AppDir $relative)) { $found += $relative }
  }
  if ($found.Count -eq 0) { return }
  $destination = Join-Path $ArchiveRoot "obsolete-$Stamp"
  foreach ($relative in $found) {
    $source = Join-Path $AppDir $relative
    $target = Join-Path $destination $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Move-Item -LiteralPath $source -Destination $target -Force
    Write-Host "   Arsipkan file usang: $relative" -ForegroundColor DarkGray
  }
  Write-Ok "$($found.Count) file usang dipindahkan ke $destination"
}

# ----------------------------------------------------------- preflight
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ' BEJO Digital Print - UNIVERSAL DEPLOY VPS WINDOWS' -ForegroundColor Cyan
Write-Host " Waktu: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '==================================================================' -ForegroundColor DarkCyan

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) { Fail 'HARUS dijalankan sebagai Administrator (Run as administrator).' }

if (-not (Test-Path -LiteralPath $AppDir)) {
  Fail "Folder $AppDir tidak ditemukan. Lakukan instalasi awal lebih dulu."
}
if (-not (Test-Path -LiteralPath (Join-Path $AppDir 'package.json'))) {
  Fail "package.json tidak ditemukan di $AppDir."
}
if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
  Fail "Service $ServiceName belum terdaftar. Jalankan deploy\install-vps-windows.ps1 lebih dulu."
}
foreach ($tool in @('node', 'npm')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool tidak ditemukan di PATH." }
}

$envPath = Join-Path $AppDir '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  Fail "File .env tidak ditemukan di $AppDir. Isi konfigurasi produksi lebih dulu."
}
Write-Ok '.env tersedia (nilai tidak dicetak).'

$port = Get-EnvValue $envPath 'PORT'
if (-not $port) { $port = '3000' }
$localBaseUrl = "http://127.0.0.1:$port"
$localHealthUrl = "$localBaseUrl/api/health"

New-Item -ItemType Directory -Path (Join-Path $AppDir 'logs'), (Join-Path $AppDir 'data'), $BackupRoot -Force | Out-Null
try {
  $probe = Join-Path $AppDir 'data\.deploy-write-test'
  [System.IO.File]::WriteAllText($probe, 'ok')
  Remove-Item $probe -Force
  Write-Ok 'Folder logs/, data/, dan backups/ siap.'
} catch {
  Write-Warn2 "Folder data/ tidak dapat ditulis: $($_.Exception.Message)"
}

$caddyExe = Join-Path $CaddyDir 'caddy.exe'
$doCaddy = -not $SkipCaddy
if ($doCaddy -and -not (Test-Path -LiteralPath $caddyExe)) {
  Write-Warn2 "Caddy tidak ditemukan di $caddyExe; langkah Caddy dilewati."
  $doCaddy = $false
}
if ($doCaddy -and -not (Get-Service -Name 'Caddy' -ErrorAction SilentlyContinue)) {
  Write-Warn2 'Service Caddy belum terdaftar; langkah Caddy dilewati.'
  $doCaddy = $false
}

$pbService = Get-Service -Name 'PocketBase' -ErrorAction SilentlyContinue
if ($pbService) {
  if ($pbService.Status -ne 'Running') {
    try {
      Start-Service 'PocketBase'
      Start-Sleep -Seconds 3
      Write-Ok 'Service PocketBase distart.'
    } catch {
      Write-Warn2 "PocketBase tidak bisa distart: $($_.Exception.Message)"
    }
  }
  if (Test-AppHealth 'http://127.0.0.1:8090/api/health' 5) {
    Write-Ok 'PocketBase merespons di port 8090.'
  } else {
    Write-Warn2 'PocketBase belum merespons di port 8090. Login/sync bisa gagal.'
  }
} else {
  Write-Warn2 'Service PocketBase tidak ditemukan. Pastikan database berjalan.'
}

# ----------------------------------------------------------- source
Write-Step '1/7 Menyiapkan source terbaru'
$sourceLabel = 'source lokal (unduh dilewati)'
$sourceArchive = $null
$sourceWork = $null
$runningScript = $PSCommandPath
$runningScriptBackup = $null
if ($runningScript -and (Test-Path -LiteralPath $runningScript)) {
  $runningScriptBackup = Join-Path $env:TEMP "deploy-vps-running-$Stamp.ps1"
  Copy-Item -LiteralPath $runningScript -Destination $runningScriptBackup -Force
}

if (-not $SkipSourceUpdate) {
  if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
    Fail 'tar.exe tidak ditemukan. Gunakan Windows Server 2019/2022 atau -SkipSourceUpdate.'
  }
  if (-not (Get-Command robocopy.exe -ErrorAction SilentlyContinue)) {
    Fail 'robocopy.exe tidak ditemukan.'
  }

  if ((Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath (Join-Path $AppDir '.git'))) {
    $dirty = @(& git -C $AppDir status --porcelain --untracked-files=no 2>$null | Where-Object {
      -not [string]::IsNullOrWhiteSpace($_) -and
      ($_.Substring(3).Trim('"') -notmatch '^(data|logs|backups|dist|node_modules)[/\\]')
    })
    if ($dirty.Count -gt 0) {
      Write-Host ($dirty -join "`n") -ForegroundColor DarkYellow
      $patchPath = Join-Path $BackupRoot "local-changes-$Stamp.patch"
      try {
        $patch = & git -C $AppDir diff --binary 2>$null
        if ($LASTEXITCODE -eq 0 -and $patch) {
          $patch | Set-Content -LiteralPath $patchPath -Encoding UTF8
          Write-Warn2 "Patch perubahan lokal disimpan: $patchPath"
        }
      } catch {
        Write-Warn2 "Patch perubahan lokal tidak dapat dibuat: $($_.Exception.Message)"
      }
      if (-not $Force) {
        Fail 'Ada perubahan lokal pada file tracked. Commit/batalkan dulu, atau jalankan dengan -Force (patch tetap disimpan).'
      }
      Write-Warn2 'Perubahan lokal tracked akan ditimpa karena -Force.'
    }
  }

  $sourceArchive = Join-Path $env:TEMP "bejo-source-$Stamp.tar.gz"
  $sourceWork = Join-Path $env:TEMP "bejo-source-$Stamp"
  $sourceUrls = @(
    "https://codeload.github.com/$RepoOwner/$RepoName/tar.gz/refs/heads/$Branch",
    "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/$Branch.tar.gz"
  )
  $downloaded = $false
  foreach ($sourceUrl in $sourceUrls) {
    try {
      Write-Host "   Mengunduh $sourceUrl" -ForegroundColor DarkGray
      Invoke-WebRequest -Uri $sourceUrl -OutFile $sourceArchive -UseBasicParsing -TimeoutSec 180
      if ((Get-Item -LiteralPath $sourceArchive).Length -gt 1000) {
        $downloaded = $true
        break
      }
      throw 'Ukuran arsip tidak valid.'
    } catch {
      Write-Warn2 "Gagal dari sumber ini: $($_.Exception.Message)"
      Remove-Item -LiteralPath $sourceArchive -Force -ErrorAction SilentlyContinue
    }
  }
  if (-not $downloaded) {
    Fail 'Gagal mengunduh source terbaru. Periksa internet/DNS VPS atau pakai -SkipSourceUpdate.'
  }

  Remove-Item -LiteralPath $sourceWork -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path $sourceWork -Force | Out-Null
  & tar.exe -xzf $sourceArchive -C $sourceWork
  if ($LASTEXITCODE -ne 0) { Fail 'Ekstraksi source gagal.' }

  $sourceRoot = Get-ChildItem -LiteralPath $sourceWork -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName 'package.json') } |
    Select-Object -First 1
  if (-not $sourceRoot) { Fail 'Struktur source tidak valid (package.json tidak ditemukan).' }

  # Hanya folder runtime di root aplikasi yang dilindungi.
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

  # Saat transisi, branch GitHub bisa masih berisi skrip deploy lama.
  # Jangan biarkan source update menimpa skrip universal yang sedang berjalan.
  $deployedScript = Join-Path $AppDir 'deploy\deploy-vps.ps1'
  if ($runningScriptBackup -and (Test-Path -LiteralPath $deployedScript)) {
    $deployedText = Get-Content -LiteralPath $deployedScript -Raw
    if ($deployedText -notmatch 'UNIVERSAL DEPLOY VPS WINDOWS' -or $deployedText -notmatch 'SECRETS-ROTATION-V1') {
      Copy-Item -LiteralPath $runningScriptBackup -Destination $deployedScript -Force
      Write-Warn2 'Source GitHub belum memuat versi skrip deploy yang sedang berjalan; versi lokal dipertahankan.'
    }
  }

  Write-Ok 'Source diperbarui. .env, data/, logs/, dan dist/ lama dipertahankan.'
} else {
  Write-Warn2 'Source update dilewati (-SkipSourceUpdate).'
}

if ($runningScriptBackup) {
  Remove-Item -LiteralPath $runningScriptBackup -Force -ErrorAction SilentlyContinue
}

Remove-ObsoleteWrappers $AppDir
Move-ObsoleteBrandFiles $AppDir $BackupRoot

# ----------------------------------------------------------- secrets prep
# Langkah opsional: jadikan situs publik, isi kredensial admin PocketBase,
# setel/rotasi password DEVELOPER, dan bersihkan backup .env plaintext.
if ($SetDevPassword -and $RotateDevPassword) {
  Fail 'Gunakan salah satu: -SetDevPassword (password pilihan Anda) atau -RotateDevPassword (acak darurat).'
}
if ($EnablePublicSite -or $ConfigurePbAdmin -or $SetDevPassword -or $RotateDevPassword -or $PurgePlaintextEnvBackups) {
  Write-Step '1b/8 Siapkan rahasia produksi (nilai tidak dicetak)'
}

if ($EnablePublicSite) {
  Set-EnvValue $envPath 'PUBLIC_SITE' 'true'
  Set-EnvValue $envPath 'ALLOW_DEFAULT_STAFF_PASSWORDS' 'false'
  Write-Ok 'PUBLIC_SITE=true dan ALLOW_DEFAULT_STAFF_PASSWORDS=false ditulis ke .env.'

  $sessionSecret = Get-EnvValue $envPath 'APP_SESSION_SECRET'
  if ([string]::IsNullOrWhiteSpace($sessionSecret)) {
    $secretBytes = New-Object byte[] 48
    $secretRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $secretRng.GetBytes($secretBytes) } finally { $secretRng.Dispose() }
    $sessionSecret = [Convert]::ToBase64String($secretBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    Set-EnvValue $envPath 'APP_SESSION_SECRET' $sessionSecret
    Write-Ok 'APP_SESSION_SECRET dibuat otomatis (48 karakter, tidak dicetak).'
    $sessionSecret = $null
    $secretBytes = $null
  } else {
    Write-Ok 'APP_SESSION_SECRET sudah terisi (nilai tidak dicetak).'
  }
}

if ($ConfigurePbAdmin -or $EnablePublicSite) {
  $pbAdminEmailValue = Get-EnvValue $envPath 'PB_ADMIN_EMAIL'
  $pbAdminPassValue = Get-EnvValue $envPath 'PB_ADMIN_PASSWORD'
  $pbAdminIncomplete = [string]::IsNullOrWhiteSpace($pbAdminEmailValue) -or [string]::IsNullOrWhiteSpace($pbAdminPassValue)
  if ($pbAdminIncomplete) {
    if (-not $ConfigurePbAdmin) {
      Fail 'PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD kosong. Jalankan ulang dengan -ConfigurePbAdmin agar nilainya ditanyakan (tidak dicetak).'
    }
    if ([string]::IsNullOrWhiteSpace($pbAdminEmailValue)) {
      $pbAdminEmailValue = Read-Host -Prompt '   PB_ADMIN_EMAIL (superuser PocketBase)'
      if ([string]::IsNullOrWhiteSpace($pbAdminEmailValue)) { Fail 'PB_ADMIN_EMAIL tidak boleh kosong.' }
      Set-EnvValue $envPath 'PB_ADMIN_EMAIL' $pbAdminEmailValue.Trim()
      Write-Ok 'PB_ADMIN_EMAIL disimpan.'
    }
    if ([string]::IsNullOrWhiteSpace($pbAdminPassValue)) {
      $pbAdminPassValue = Read-PlainSecret '   PB_ADMIN_PASSWORD (input tersembunyi)'
      if ([string]::IsNullOrWhiteSpace($pbAdminPassValue)) { Fail 'PB_ADMIN_PASSWORD tidak boleh kosong.' }
      Set-EnvValue $envPath 'PB_ADMIN_PASSWORD' $pbAdminPassValue
      Write-Ok 'PB_ADMIN_PASSWORD disimpan (nilai tidak dicetak).'
    }
  } else {
    Write-Ok 'PB_ADMIN_EMAIL dan PB_ADMIN_PASSWORD sudah terisi (nilai tidak dicetak).'
  }
  $pbAdminEmailValue = $null
  $pbAdminPassValue = $null
}

if ($RotateDevPassword) {
  if ($DevPasswordLength -lt 8) { Fail '-DevPasswordLength minimal 8 karakter.' }
  $setPassScript = Join-Path $AppDir 'scripts\set-dev-password.mjs'
  if (-not (Test-Path -LiteralPath $setPassScript)) {
    Fail "Skrip $setPassScript tidak ditemukan; pastikan source terbaru sudah tersalin."
  }
  $nodeExe = (Get-Command node).Source
  $plainPassword = New-RandomPassword $DevPasswordLength
  try {
    $passwordBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($plainPassword))
    $hashExit = 0
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      # Password dikirim lewat stdin (base64) agar tidak terlihat di daftar proses.
      $passwordBase64 | & $nodeExe $setPassScript --env $envPath --stdin --base64 --min-length $DevPasswordLength --no-backup 2>&1 |
        ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
      $hashExit = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousEap
    }
    if ($hashExit -ne 0) { Fail 'Gagal menyimpan hash password DEVELOPER (lihat pesan di atas).' }

    $newHash = Get-EnvValue $envPath 'DEV_PASSWORD_HASH'
    if ([string]::IsNullOrWhiteSpace($newHash) -or $newHash -notmatch '^scrypt\$') {
      Fail 'DEV_PASSWORD_HASH tidak terbentuk dengan format scrypt.'
    }
    foreach ($legacyKey in @('DEV_PASSWORD', 'JOURNAL_DEV_PASSWORD')) {
      if (-not [string]::IsNullOrWhiteSpace((Get-EnvValue $envPath $legacyKey))) {
        Write-Warn2 "$legacyKey masih aktif di .env; nonaktifkan manual."
      }
    }

    $secretDir = Join-Path $AppDir 'secrets'
    New-Item -ItemType Directory -Path $secretDir -Force | Out-Null
    $secretFile = Join-Path $secretDir "developer-password-$Stamp.txt"
    $secretText = @(
      'BEJO Digital Print - password DEVELOPER hasil rotasi',
      "Waktu   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
      "Panjang : $DevPasswordLength karakter",
      'Catatan : simpan ke password manager, lalu hapus file ini.',
      '',
      $plainPassword,
      ''
    ) -join "`r`n"
    [System.IO.File]::WriteAllText($secretFile, $secretText, (New-Object System.Text.UTF8Encoding($false)))
    Protect-SecretFile $secretFile
    Write-Ok 'Password DEVELOPER baru tersimpan sebagai hash scrypt di .env.'
    Write-Ok "Plaintext hanya ada di file terlindungi: $secretFile"
    Write-Warn2 'Buka file lewat RDP, simpan ke password manager, lalu hapus file tersebut.'
  } finally {
    $plainPassword = $null
    $passwordBase64 = $null
    $secretText = $null
    [GC]::Collect()
  }
}

if ($SetDevPassword) {
  $devPasswordMinLength = 10
  $plainPassword = Read-PlainSecret "   Password DEVELOPER (minimal $devPasswordMinLength karakter, input tersembunyi)"
  if ([string]::IsNullOrWhiteSpace($plainPassword)) { Fail 'Password DEVELOPER tidak boleh kosong.' }
  if ($plainPassword.Length -lt $devPasswordMinLength) {
    Fail "Password DEVELOPER minimal $devPasswordMinLength karakter (input $($plainPassword.Length) karakter)."
  }
  $confirmPassword = Read-PlainSecret '   Ulangi password DEVELOPER'
  if ($plainPassword -cne $confirmPassword) { Fail 'Konfirmasi password tidak sama; .env tidak diubah.' }
  try {
    Set-DevPasswordHash $plainPassword $devPasswordMinLength
    Write-Ok 'Password DEVELOPER tersimpan sebagai hash scrypt di .env (stabil, tanpa rotasi).'
    Write-Host '   Nilai tidak dicetak dan tidak ditulis ke file; simpan di password manager.' -ForegroundColor DarkGray
  } finally {
    $plainPassword = $null
    $confirmPassword = $null
    [GC]::Collect()
  }
}

if ($PurgePlaintextEnvBackups) {
  $envBackupDirs = @((Join-Path $AppDir 'backups'), $BackupRoot)
  [void](Remove-PlaintextEnvBackups -Directories $envBackupDirs -Confirmed ([bool]$Force))
}

# ----------------------------------------------------------- env check
Write-Step '2/8 Validasi konfigurasi .env'
$requiredKeys = @('APP_URL', 'VITE_POCKETBASE_URL', 'PB_SYNC_EMAIL', 'PB_SYNC_PASSWORD')
$missingEnv = @()
foreach ($key in $requiredKeys) {
  $value = Get-EnvValue $envPath $key
  if ([string]::IsNullOrWhiteSpace($value)) { $missingEnv += $key }
}

# Login DEVELOPER diverifikasi server. Bentuk yang disarankan: DEV_PASSWORD_HASH
# (scrypt). Plaintext DEV_PASSWORD/JOURNAL_DEV_PASSWORD masih diterima untuk
# .env lama, tetapi deploy akan memperingatkan agar segera dimigrasi.
$devPasswordHash = Get-EnvValue $envPath 'DEV_PASSWORD_HASH'
$developerPassword = Get-EnvValue $envPath 'DEV_PASSWORD'
if ([string]::IsNullOrWhiteSpace($developerPassword)) {
  $developerPassword = Get-EnvValue $envPath 'JOURNAL_DEV_PASSWORD'
}
if ([string]::IsNullOrWhiteSpace($devPasswordHash) -and [string]::IsNullOrWhiteSpace($developerPassword)) {
  $missingEnv += 'DEV_PASSWORD_HASH (atau DEV_PASSWORD)'
  Write-Warn2 "Setel password DEVELOPER sekali (stabil, tanpa rotasi): cd $AppDir; npm run dev-password:set"
} elseif ([string]::IsNullOrWhiteSpace($devPasswordHash)) {
  Write-Warn2 'DEV_PASSWORD masih plaintext di .env. Jalankan "node scripts/set-dev-password.mjs --env .env --from-env" agar tersimpan sebagai hash scrypt.'
}

# Kunci HMAC cookie sesi; tanpa ini sesi hilang setiap restart dan login web gagal.
$sessionSecret = Get-EnvValue $envPath 'APP_SESSION_SECRET'
if ([string]::IsNullOrWhiteSpace($sessionSecret)) {
  $sessionSecret = Get-EnvValue $envPath 'JOURNAL_SESSION_SECRET'
}
if ([string]::IsNullOrWhiteSpace($sessionSecret)) {
  $sessionSecret = Get-EnvValue $envPath 'PB_ADMIN_PASSWORD'
}
if ([string]::IsNullOrWhiteSpace($sessionSecret)) { $missingEnv += 'APP_SESSION_SECRET' }

if ($missingEnv.Count -gt 0) {
  Write-Warn2 "Env penting masih kosong: $($missingEnv -join ', ')"
} else {
  Write-Ok 'Env inti aplikasi terisi (nilai tidak dicetak).'
}

foreach ($legacyKey in @('VITE_PB_SYNC_EMAIL', 'VITE_PB_SYNC_PASSWORD')) {
  if (-not [string]::IsNullOrWhiteSpace((Get-EnvValue $envPath $legacyKey))) {
    Write-Warn2 "$legacyKey masih terisi (DEPRECATED). Hapus dari .env dan ganti password akun sync PocketBase."
  }
}

# Server menolak SEMUA akses internet (403) bila PUBLIC_SITE bukan true dan
# REMOTE_ACCESS_PASS kosong. Karena Test-PublicEndpoint menganggap 401/403
# sebagai "terjangkau", deploy harus berhenti lebih dulu agar tidak melaporkan
# sukses padahal situs tidak bisa dibuka.
$remoteAccessPass = Get-EnvValue $envPath 'REMOTE_ACCESS_PASS'
$publicSiteRaw = Get-EnvValue $envPath 'PUBLIC_SITE'
$publicSite = (-not [string]::IsNullOrWhiteSpace($publicSiteRaw)) -and (@('1', 'true', 'yes', 'on') -contains $publicSiteRaw.Trim().ToLower())
$pbAdminEmail = Get-EnvValue $envPath 'PB_ADMIN_EMAIL'
$pbAdminPassword = Get-EnvValue $envPath 'PB_ADMIN_PASSWORD'
$pbAdminReady = (-not [string]::IsNullOrWhiteSpace($pbAdminEmail)) -and (-not [string]::IsNullOrWhiteSpace($pbAdminPassword))

if ($publicSite) {
  # Login staf diverifikasi server memakai akun superuser PocketBase. Tanpa
  # kredensial admin, dashboard tidak bisa dipakai walau landing terbuka.
  if (-not $pbAdminReady) {
    Fail 'PUBLIC_SITE=true membutuhkan PB_ADMIN_EMAIL dan PB_ADMIN_PASSWORD di .env agar login staf dapat diverifikasi server.'
  }
  if (-not [string]::IsNullOrWhiteSpace($remoteAccessPass)) {
    Write-Warn2 'PUBLIC_SITE=true: Basic Auth dilewati. REMOTE_ACCESS_PASS masih terisi tetapi tidak dipakai untuk landing publik.'
  }
  Write-Ok 'PUBLIC_SITE=true: landing terbuka untuk publik; dashboard & API privat wajib login.'
  $allowDefault = Get-EnvValue $envPath 'ALLOW_DEFAULT_STAFF_PASSWORDS'
  if (-not [string]::IsNullOrWhiteSpace($allowDefault) -and (@('1', 'true', 'yes', 'on') -contains $allowDefault.Trim().ToLower())) {
    Write-Warn2 'ALLOW_DEFAULT_STAFF_PASSWORDS=true: password default (admin123, kasir123, dst.) masih diterima. Segera ganti password staf.'
  }
} elseif ([string]::IsNullOrWhiteSpace($remoteAccessPass)) {
  if ($AllowLanOnly) {
    Write-Warn2 'REMOTE_ACCESS_PASS kosong: aplikasi hanya bisa diakses dari lokal/LAN (internet ditolak 403).'
  } else {
    Fail 'REMOTE_ACCESS_PASS kosong dan PUBLIC_SITE bukan true. Akses dari internet akan ditolak (403). Isi REMOTE_ACCESS_PASS, set PUBLIC_SITE=true, atau jalankan dengan -AllowLanOnly.'
  }
} else {
  Write-Ok 'REMOTE_ACCESS_PASS terisi; akses internet diizinkan dengan Basic Auth.'
}

# ---------------------------------------------------------------------------
# URL PocketBase yang DIPAKAI BROWSER (VITE_POCKETBASE_URL). Ini bukan URL
# server: nilai localhost hanya berlaku di dalam VPS, sehingga Pengunjung
# internet yang bundle-nya menunjuk localhost tidak pernah tersambung ke
# PocketBase (terjebak Mode Lokal, tidak sync antar user).
# ---------------------------------------------------------------------------
$publicBaseCandidate = ''
if ($PublicUrl) {
  $publicBaseCandidate = $PublicUrl.Trim().TrimEnd('/')
  if ($publicBaseCandidate -notmatch '^https?://') { $publicBaseCandidate = "https://$publicBaseCandidate" }
}
$appUrlValue = Get-EnvValue $envPath 'APP_URL'
if (-not $publicBaseCandidate -and $appUrlValue -match '^https?://' -and
    $appUrlValue -notmatch '^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|/|$)') {
  $publicBaseCandidate = $appUrlValue.TrimEnd('/')
}
if (-not $publicBaseCandidate) { $publicBaseCandidate = Get-CaddyPublicUrl $AppDir }

$pbBrowserUrl = ''
if ($publicBaseCandidate) {
  $pbBrowserUrl = "$($publicBaseCandidate.TrimEnd('/'))/api/pb"
  $pbBrowserConfigured = Get-EnvValue $envPath 'VITE_POCKETBASE_URL'
  if ([string]::IsNullOrWhiteSpace($pbBrowserConfigured) -or
      $pbBrowserConfigured -match '(localhost|127\.0\.0\.1|0\.0\.0\.0)') {
    Set-EnvValue $envPath 'VITE_POCKETBASE_URL' $pbBrowserUrl
    Write-Ok "VITE_POCKETBASE_URL disetel ke $pbBrowserUrl agar browser pengunjung menjangkau PocketBase."
  } elseif ($pbBrowserConfigured.TrimEnd('/') -ne $pbBrowserUrl) {
    Write-Warn2 "VITE_POCKETBASE_URL ($pbBrowserConfigured) beda dari jalur proxy publik ($pbBrowserUrl). Ganti bila bukan kesengajaan."
  } else {
    Write-Ok "VITE_POCKETBASE_URL sudah mengarah ke PocketBase publik ($pbBrowserUrl)."
  }
} else {
  Write-Warn2 'Domain publik tidak dikenali (APP_URL/Caddyfile kosong); VITE_POCKETBASE_URL tidak diverifikasi.'
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

# ---------------------------------------------------------------------------
# Skema AKUN. `app_users` = direktori yang dibaca + dipantau browser,
# `users` = record kredensial yang hanya boleh ditulis server (superuser).
# Bila salah satu tidak sesuai, SEMUA tulis akun dari aplikasi gagal dengan
# "Only superusers can perform this action." dan akun baru hilang saat refresh.
# ---------------------------------------------------------------------------
function Get-PbSuperToken {
  param([string]$BaseUrl, [string]$Email, [string]$Password)
  $body = @{ identity = $Email; password = $Password } | ConvertTo-Json -Compress
  foreach ($path in @('/api/collections/_superusers/auth-with-password', '/api/admins/auth-with-password')) {
    # Kedua jalur dicoba diam-diam (versi PocketBase lama); pesan error tidak dicetak.
    try {
      $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -ContentType 'application/json' -Body $body -TimeoutSec 15
      if ($resp.token) { return $resp.token }
    } catch { }
  }
  return $null
}

function Get-PbCollectionMeta {
  param([string]$BaseUrl, [string]$Token, [string]$Name)
  try {
    return Invoke-RestMethod -Uri "$BaseUrl/api/collections/$Name" -Headers @{ Authorization = $Token } -TimeoutSec 15
  } catch { return $null }
}

function Get-PbRecordCount {
  param([string]$BaseUrl, [string]$Token, [string]$Name)
  try {
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/collections/$Name/records?perPage=1" -Headers @{ Authorization = $Token } -TimeoutSec 15
    return [int]$resp.totalItems
  } catch { return -1 }
}

function Test-PbAccountSchema {
  param([string]$BaseUrl, [string]$Token)
  $problems = @()

  $dir = Get-PbCollectionMeta -BaseUrl $BaseUrl -Token $Token -Name 'app_users'
  if (-not $dir) {
    $problems += 'koleksi app_users tidak ada/tidak terbaca'
  } else {
    $dirFields = @($dir.fields | ForEach-Object { $_.name })
    foreach ($field in @('username', 'role', 'isActive', 'legacyId', 'authId', 'data')) {
      if ($dirFields -notcontains $field) { $problems += "app_users.field `$field hilang" }
    }
    foreach ($rule in @('createRule', 'updateRule', 'deleteRule')) {
      if ($dir.$rule) { $problems += "app_users.$rule harus kosong (hanya server yang menulis direktori)" }
    }
    if (-not $dir.listRule) { $problems += 'app_users.listRule kosong: direktori akun terbaca publik' }
  }

  $cred = Get-PbCollectionMeta -BaseUrl $BaseUrl -Token $Token -Name 'users'
  if (-not $cred) {
    $problems += 'koleksi users tidak ada/tidak terbaca'
  } else {
    $credFields = @($cred.fields | ForEach-Object { $_.name })
    foreach ($field in @('username', 'role', 'legacyId', 'appPassword', 'data')) {
      if ($credFields -notcontains $field) { $problems += "users.field `$field hilang (tulis akun akan dibuang diam-diam)" }
    }
    foreach ($rule in @('createRule', 'updateRule', 'deleteRule')) {
      if ($cred.$rule) { $problems += "users.$rule harus kosong (browser tidak boleh menulis kredensial)" }
    }
  }

  return $problems
}

# ----------------------------------------------------------- pocketbase hardening
Write-Step '3/8 Perketat aturan akses PocketBase'
$pbHardeningStatus = 'dilewati'
$pbAccountSchemaStatus = 'dilewati'
$pbDirectoryCount = -1
if ($SkipPbHardening) {
  if ($publicSite) {
    Fail 'PUBLIC_SITE=true mewajibkan hardening aturan koleksi PocketBase. Jalankan deploy tanpa -SkipPbHardening.'
  }
  Write-Warn2 'Hardening PocketBase dilewati (-SkipPbHardening).'
} else {
  $pbAdminEmail = Get-EnvValue $envPath 'PB_ADMIN_EMAIL'
  $pbAdminPassword = Get-EnvValue $envPath 'PB_ADMIN_PASSWORD'
  $hardeningScript = Join-Path $AppDir 'scripts\create-pocketbase-collections.mjs'
  if ([string]::IsNullOrWhiteSpace($pbAdminEmail) -or [string]::IsNullOrWhiteSpace($pbAdminPassword)) {
    Write-Warn2 'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD kosong; hardening koleksi dilewati.'
    Write-Warn2 'Tanpa hardening, koleksi lama bisa masih terbuka untuk publik. Isi kredensial admin lalu deploy ulang.'
    $pbHardeningStatus = 'kredensial admin kosong'
  } elseif (-not (Test-Path -LiteralPath $hardeningScript)) {
    Write-Warn2 "$hardeningScript tidak ditemukan; hardening dilewati."
    $pbHardeningStatus = 'skrip tidak ditemukan'
  } else {
    $pbUpstream = Get-EnvValue $envPath 'POCKETBASE_UPSTREAM'
    if ([string]::IsNullOrWhiteSpace($pbUpstream)) { $pbUpstream = 'http://127.0.0.1:8090' }
    $nodeExe = (Get-Command node).Source
    $previousPbUrl = $env:POCKETBASE_URL
    $previousPbEmail = $env:PB_ADMIN_EMAIL
    $previousPbPassword = $env:PB_ADMIN_PASSWORD
    $hardeningExit = 1
    Push-Location $AppDir
    try {
      # Kredensial hanya diteruskan lewat environment proses anak; tidak dicetak.
      $env:POCKETBASE_URL = $pbUpstream
      $env:PB_ADMIN_EMAIL = $pbAdminEmail
      $env:PB_ADMIN_PASSWORD = $pbAdminPassword
      $hardening = Invoke-NativeCapture $nodeExe @($hardeningScript, '--harden')
      $hardening.Output | Select-Object -Last 20 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
      $hardeningExit = $hardening.ExitCode
    } catch {
      Write-Warn2 "Hardening PocketBase error: $($_.Exception.Message)"
      $hardeningExit = 1
    } finally {
      if ($null -eq $previousPbUrl) { Remove-Item Env:POCKETBASE_URL -ErrorAction SilentlyContinue } else { $env:POCKETBASE_URL = $previousPbUrl }
      if ($null -eq $previousPbEmail) { Remove-Item Env:PB_ADMIN_EMAIL -ErrorAction SilentlyContinue } else { $env:PB_ADMIN_EMAIL = $previousPbEmail }
      if ($null -eq $previousPbPassword) { Remove-Item Env:PB_ADMIN_PASSWORD -ErrorAction SilentlyContinue } else { $env:PB_ADMIN_PASSWORD = $previousPbPassword }
      Pop-Location
    }
    if ($hardeningExit -ne 0) {
      Fail "Hardening PocketBase gagal (exit $hardeningExit). Aturan akses koleksi belum tentu aman; perbaiki lalu deploy ulang."
    }
    Write-Ok 'Aturan akses koleksi PocketBase sudah diperketat.'
    $pbHardeningStatus = 'OK'

    # Verifikasi SKEMA AKUN: hardening di atas sudah memperbaiki field yang hilang,
    # tapi deploy harus berhenti kalau direktori akun tetap tidak benar karena
    # seluruh tulis akun dari aplikasi akan gagal senyap.
    $verifyToken = Get-PbSuperToken -BaseUrl $pbUpstream -Email $pbAdminEmail -Password $pbAdminPassword
    if (-not $verifyToken) {
      Write-Warn2 'Skema akun tidak dapat diverifikasi (login superuser PocketBase gagal).'
      $pbAccountSchemaStatus = 'tidak terverifikasi'
    } else {
      $schemaProblems = @(Test-PbAccountSchema -BaseUrl $pbUpstream -Token $verifyToken)
      if ($schemaProblems.Count -gt 0) {
        Fail ("Skema akun PocketBase belum benar: " + ($schemaProblems -join '; ') +
          '. Perbaiki skema (node scripts/create-pocketbase-collections.mjs --harden) lalu deploy ulang.')
      }
      $pbDirectoryCount = Get-PbRecordCount -BaseUrl $pbUpstream -Token $verifyToken -Name 'app_users'
      $credentialCount = Get-PbRecordCount -BaseUrl $pbUpstream -Token $verifyToken -Name 'users'
      Write-Ok "Skema akun (users + app_users) sesuai. Direktori: $pbDirectoryCount baris, kredensial: $credentialCount record."
      $pbAccountSchemaStatus = "OK ($pbDirectoryCount baris direktori)"
    }
  }
}

# ----------------------------------------------------------- backup
Write-Step '4/8 Backup build dan Caddyfile sebelumnya'
$distPath = Join-Path $AppDir 'dist'
$distBackup = $null
if (Test-Path -LiteralPath $distPath) {
  $distBackup = Join-Path $BackupRoot "dist-$Stamp"
  Copy-Item -LiteralPath $distPath -Destination $distBackup -Recurse -Force
  Write-Ok "Backup dist: $distBackup"
  Get-ChildItem $BackupRoot -Directory -Filter 'dist-*' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -Skip 5 |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
} else {
  Write-Warn2 'dist/ belum ada; build baru akan dibuat tanpa backup.'
}

$caddyChanged = $false
$caddyBackup = $null
$caddyTarget = Join-Path $CaddyDir 'Caddyfile'
if ($doCaddy) {
  $caddySource = Join-Path $AppDir 'deploy\Caddyfile.windows'
  if (-not (Test-Path -LiteralPath $caddySource)) {
    Write-Warn2 "$caddySource tidak ditemukan; Caddy dilewati."
    $doCaddy = $false
  } else {
    New-Item -ItemType Directory -Path (Join-Path $CaddyDir 'logs') -Force | Out-Null

    # Video Marketing berupa base64 bisa sekitar 85MB; pastikan batas body 110MB.
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
    if ($validation.ExitCode -ne 0) {
      if (Test-Path -LiteralPath $caddyTemp) { Remove-Item $caddyTemp -Force -ErrorAction SilentlyContinue }
      $validation.Output | Select-Object -Last 10 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
      Fail 'Caddyfile baru tidak valid; file Caddy lama tidak diubah.'
    }

    $oldCaddyHash = ''
    if (Test-Path -LiteralPath $caddyTarget) {
      $oldCaddyHash = (Get-FileHash -LiteralPath $caddyTarget -Algorithm SHA256).Hash
      $caddyBackup = Join-Path $BackupRoot "Caddyfile-$Stamp"
      Copy-Item $caddyTarget $caddyBackup -Force
    }
    Copy-Item $caddyDeploySource $caddyTarget -Force
    if (Test-Path -LiteralPath $caddyTemp) { Remove-Item $caddyTemp -Force -ErrorAction SilentlyContinue }
    $newCaddyHash = (Get-FileHash -LiteralPath $caddyTarget -Algorithm SHA256).Hash
    if ($oldCaddyHash -ne $newCaddyHash) {
      $caddyChanged = $true
      Write-Ok 'Caddyfile diperbarui.'
    } else {
      Write-Ok 'Caddyfile sudah sesuai.'
    }
  }
}

# ----------------------------------------------------------- build
Write-Step '5/8 Install dependensi dan build produksi'
Push-Location $AppDir
try {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npm) { $npmPath = $npm.Source } else { $npmPath = (Get-Command npm).Source }

  if (Test-Path -LiteralPath (Join-Path $AppDir 'package-lock.json')) {
    Write-Host '   npm ci ...' -ForegroundColor DarkGray
    $install = Invoke-NativeCapture $npmPath @('ci', '--no-audit', '--no-fund', '--include=dev')
  } else {
    Write-Host '   npm install ...' -ForegroundColor DarkGray
    $install = Invoke-NativeCapture $npmPath @('install', '--no-audit', '--no-fund', '--include=dev')
  }
  $install.Output | Select-Object -Last 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  if ($install.ExitCode -ne 0 -and (Test-Path -LiteralPath (Join-Path $AppDir 'package-lock.json'))) {
    Write-Warn2 "npm ci gagal (exit $($install.ExitCode)); mencoba npm install."
    $install = Invoke-NativeCapture $npmPath @('install', '--no-audit', '--no-fund', '--include=dev')
    $install.Output | Select-Object -Last 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  }
  if ($install.ExitCode -ne 0) { Fail "Install dependensi gagal (exit $($install.ExitCode)). dist lama tidak diubah." }

  $previousNodeEnv = $env:NODE_ENV
  try {
    $env:NODE_ENV = 'production'
    Write-Host '   npm run build ...' -ForegroundColor DarkGray
    $build = Invoke-NativeCapture $npmPath @('run', 'build')
  } finally {
    if ($null -eq $previousNodeEnv) {
      Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    } else {
      $env:NODE_ENV = $previousNodeEnv
    }
  }
  $build.Output | Select-Object -Last 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  if ($build.ExitCode -ne 0) {
    if (Restore-Dist $distBackup $distPath) { Write-Warn2 'dist lama dikembalikan.' }
    Fail "Build gagal (exit $($build.ExitCode))."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $distPath 'server.cjs'))) {
    if (Restore-Dist $distBackup $distPath) { Write-Warn2 'dist lama dikembalikan.' }
    Fail 'dist\server.cjs tidak terbentuk.'
  }
  # Bundle yang masih menunjuk PocketBase localhost membuat SEMUA pengunjung
  # internet diam-diam berjalan Mode Lokal: data tidak pernah sampai ke server
  # dan tidak sync antar user. Build dianggap cacat bila begitu.
  $assetGlob = Join-Path $distPath 'assets\*.js'
  if (Test-Path -LiteralPath (Join-Path $distPath 'assets')) {
    $pbLocalHits = @(
      Select-String -Path $assetGlob -SimpleMatch -Pattern 'localhost:8090', '127.0.0.1:8090' -List -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Path -Unique
    )
    $pbPublicInBundle = $false
    if ($pbBrowserUrl) {
      $pbPublicInBundle = (@(Select-String -Path $assetGlob -SimpleMatch -Pattern $pbBrowserUrl -List -ErrorAction SilentlyContinue).Count -gt 0)
    }
    if ($pbLocalHits.Count -gt 0) {
      Restore-Dist $distBackup $distPath
      Fail "Bundle produksi menunjuk PocketBase localhost ($($pbLocalHits -join ', ')). Setel VITE_POCKETBASE_URL ke $pbBrowserUrl lalu deploy ulang."
    }
    if ($pbBrowserUrl -and -not $pbPublicInBundle) {
      Write-Warn2 "URL PocketBase publik ($pbBrowserUrl) tidak ditemukan di bundle; periksa isi .env bagian VITE_POCKETBASE_URL."
    } elseif ($pbPublicInBundle) {
      Write-Ok "Bundle browser memakai URL PocketBase publik ($pbBrowserUrl)."
    }
  }

  Write-Ok 'Build selesai.'
} finally {
  Pop-Location
}

# ----------------------------------------------------------- restart
Write-Step '6/8 Restart service dan health check lokal'
try {
  Restart-Service -Name $ServiceName -Force
} catch {
  Fail "Gagal restart service $ServiceName : $($_.Exception.Message)"
}

if (-not (Wait-AppHealth $localHealthUrl 30)) {
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
Write-Ok "Aplikasi sehat di $localHealthUrl"

if ($doCaddy) {
  $caddyService = Get-Service -Name 'Caddy' -ErrorAction SilentlyContinue
  $needsRestart = $caddyChanged -or ($caddyService -and $caddyService.Status -ne 'Running')
  if ($needsRestart) {
    try {
      Restart-Service -Name 'Caddy' -Force
      Start-Sleep -Seconds 3
      $caddyStatus = (Get-Service 'Caddy').Status
      if ($caddyStatus -ne 'Running') { throw "status service: $caddyStatus" }
      Write-Ok 'Caddy berjalan dengan konfigurasi terbaru.'
    } catch {
      Write-Warn2 "Caddy gagal memakai konfigurasi baru: $($_.Exception.Message)"
      if ($caddyBackup -and (Test-Path -LiteralPath $caddyBackup)) {
        Copy-Item $caddyBackup $caddyTarget -Force
        try {
          Restart-Service -Name 'Caddy' -Force
          Write-Warn2 'Caddyfile lama dikembalikan dan Caddy direstart.'
        } catch {
          Write-Warn2 'Rollback Caddy juga gagal. Periksa C:\caddy\logs.'
        }
      } else {
        Write-Warn2 'Tidak ada Caddyfile lama untuk rollback.'
      }
    }
  } else {
    Write-Ok 'Service Caddy sudah berjalan.'
  }
}

# ----------------------------------------------------------- local integrations
Write-Step '7/8 Pemeriksaan integrasi lokal'
try {
  $journalSession = Invoke-RestMethod -Uri "$localBaseUrl/api/journal/session" -TimeoutSec 15
  if ($journalSession.success) {
    Write-Ok 'Route Jurnal aktif.'
    if (-not $journalSession.configured.developerLogin -or -not $journalSession.configured.sessionSecret) {
      Write-Warn2 'Sesi Jurnal belum lengkap; isi DEV_PASSWORD_HASH (atau DEV_PASSWORD) dan APP_SESSION_SECRET di .env VPS.'
    }
  } else {
    Write-Warn2 'Route Jurnal merespons tanpa status success.'
  }
} catch {
  Write-Warn2 "Pemeriksaan Jurnal gagal: $($_.Exception.Message)"
}

# Login DEVELOPER diverifikasi server lewat cookie HttpOnly; tidak ada
# kredensial di bundle browser. Endpoint ini aman dipanggil tanpa login.
try {
  $devSession = Invoke-RestMethod -Uri "$localBaseUrl/api/auth/session" -TimeoutSec 15
  if ($devSession.success) {
    Write-Ok 'Route auth developer aktif (server-side).'
  } else {
    Write-Warn2 'Route auth developer merespons tanpa status success.'
  }
} catch {
  Write-Warn2 "Route auth developer tidak tersedia: $($_.Exception.Message)"
}

# Token PocketBase kini diminta browser dari server. Jangan pernah mencetak isi
# respons (bisa berisi token); cukup periksa kode status.
try {
  $probeBody = @{ email = 'deploy-probe@invalid.local'; password = 'deploy-probe' } | ConvertTo-Json -Compress
  $pbProbe = Invoke-WebRequest -Uri "$localBaseUrl/api/pocketbase/session" -Method Post `
    -ContentType 'application/json' -Body $probeBody -UseBasicParsing -TimeoutSec 15
  Write-Ok "Broker sesi PocketBase aktif (HTTP $([int]$pbProbe.StatusCode))."
} catch {
  $pbProbeCode = 0
  try { $pbProbeCode = [int]$_.Exception.Response.StatusCode } catch { }
  if ($pbProbeCode -eq 503) {
    Write-Warn2 'Broker sesi PocketBase aktif, tetapi PB_SYNC_* kosong atau ditolak (aplikasi berjalan mode lokal).'
  } elseif ($pbProbeCode -eq 400 -or $pbProbeCode -eq 401) {
    Write-Warn2 "Broker sesi PocketBase merespons HTTP $pbProbeCode (periksa kredensial sync)."
  } elseif ($pbProbeCode -eq 404) {
    Write-Warn2 'Broker /api/pocketbase/session tidak ditemukan; build lama mungkin masih berjalan atau Caddy mem-proxy ke PocketBase.'
  } else {
    Write-Warn2 "Broker sesi PocketBase tidak merespons semestinya (HTTP $pbProbeCode)."
  }
}

# Sinkronisasi antar user hanya terjadi lewat SSE PocketBase. Uji langsung ke
# upstream dalam VPS: header text/event-stream + event PB_CONNECT pertama.
$pbLocalUrl = Get-EnvValue $envPath 'POCKETBASE_UPSTREAM'
if ([string]::IsNullOrWhiteSpace($pbLocalUrl)) { $pbLocalUrl = 'http://127.0.0.1:8090' }
$pbLocalUrl = $pbLocalUrl.TrimEnd('/')
$pbRealtimeStatus = 'dilewati'
if ($SkipRealtimeCheck) {
  Write-Warn2 'Uji realtime PocketBase dilewati (-SkipRealtimeCheck).'
} else {
  $localRealtime = Test-RealtimeStream "$pbLocalUrl/api/realtime" 10
  if ($localRealtime.Ok) {
    $pbRealtimeStatus = "lokal OK ($($localRealtime.ContentType))"
    Write-Ok "SSE realtime PocketBase lokal mengalir dari $pbLocalUrl (PB_CONNECT diterima)."
  } else {
    Fail "Realtime PocketBase tidak mengalir di VPS ($pbLocalUrl/api/realtime): $($localRealtime.Error). Tanpa SSE, perubahan satu user tidak pernah sampai ke user lain."
  }

  try {
    $localHealth = Invoke-RestMethod -Uri $localHealthUrl -TimeoutSec 15
    if ($localHealth.pocketbase.reachable -and $localHealth.pocketbase.realtimeStream) {
      Write-Ok "Node aplikasi melihat PocketBase sehat dan realtime terbuka (latensi $($localHealth.pocketbase.latencyMs) ms)."
    } else {
      $pbProbeError = if ($localHealth.pocketbase.error) { $localHealth.pocketbase.error } else { 'probe kosong' }
      Fail "Aplikasi (Node) tidak dapat menghubungi PocketBase lewat POCKETBASE_UPSTREAM: $pbProbeError. Periksa service PocketBase dan isi .env."
    }
  } catch {
    Fail "Gagal membaca $localHealthUrl untuk probe PocketBase: $($_.Exception.Message)"
  }
}

# Direktori akun harus sudah terisi setelah server menyala (proyeksi berjalan di
# boot). Direktori kosong = aplikasi hanya punya data lokal dan akun baru hilang
# saat refresh, jadi ini diperiksa sampai tuntas sebelum verifikasi publik.
if (-not $SkipPbHardening -and $pbAccountSchemaStatus -like 'OK*') {
  $projToken = Get-PbSuperToken -BaseUrl $pbLocalUrl -Email (Get-EnvValue $envPath 'PB_ADMIN_EMAIL') -Password (Get-EnvValue $envPath 'PB_ADMIN_PASSWORD')
  if (-not $projToken) {
    Write-Warn2 'Proyeksi direktori akun tidak dapat diperiksa (login superuser gagal).'
  } else {
    $credentialTotal = Get-PbRecordCount -BaseUrl $pbLocalUrl -Token $projToken -Name 'users'
    $directoryTotal = Get-PbRecordCount -BaseUrl $pbLocalUrl -Token $projToken -Name 'app_users'
    $projectionTries = 0
    while ($credentialTotal -gt 0 -and $directoryTotal -eq 0 -and $projectionTries -lt 4) {
      Start-Sleep -Seconds 5
      $directoryTotal = Get-PbRecordCount -BaseUrl $pbLocalUrl -Token $projToken -Name 'app_users'
      $projectionTries += 1
    }
    if ($credentialTotal -gt 0 -and $directoryTotal -eq 0) {
      Fail ("Direktori akun (app_users) masih kosong padahal ada $credentialTotal record kredensial. " +
        'Server belum selesai memproyeksikan akun. Periksa baris "[UserAdmin]" pada log service, lalu buka menu Pengguna ' +
        'sekali untuk memicu sinkronisasi.')
    }
    Write-Ok "Direktori akun terisi: $directoryTotal baris app_users dari $credentialTotal record kredensial."
    $pbAccountSchemaStatus = "OK ($directoryTotal baris direktori)"
  }
}

$marketingConfigured = $false
$marketingRequiredFailed = $false
$notLive = @()
if (-not $SkipMarketingCheck) {
  try {
    $marketing = Invoke-RestMethod -Uri "$localBaseUrl/api/marketing/status" -TimeoutSec 20
    $channels = @(
      [pscustomobject]@{ Name = 'WhatsApp (Meta)'; Configured = [bool]$marketing.meta.configured; Missing = @($marketing.meta.missing) },
      [pscustomobject]@{ Name = 'TikTok'; Configured = [bool]$marketing.tiktok.configured; Missing = @($marketing.tiktok.missing) },
      [pscustomobject]@{ Name = 'Shopee'; Configured = [bool]$marketing.shopee.configured; Missing = @($marketing.shopee.missing) }
    )
    $incomplete = @()
    foreach ($channel in $channels) {
      if ($channel.Configured) {
        Write-Ok "$($channel.Name): env terkonfigurasi"
      } else {
        $missing = if ($channel.Missing.Count -gt 0) { $channel.Missing -join ', ' } else { 'tidak diketahui' }
        Write-Warn2 "$($channel.Name): env belum lengkap ($missing)"
        $incomplete += $channel.Name
      }
    }
    $marketingConfigured = ($incomplete.Count -eq 0)
  } catch {
    Write-Warn2 "Endpoint Marketing tidak merespons: $($_.Exception.Message)"
  }
}

if ($RequireMarketing) {
  try {
    $diagnostics = Invoke-RestMethod -Uri "$localBaseUrl/api/marketing/diagnostics?refresh=1" -TimeoutSec 90
    $liveChannels = @(
      [pscustomobject]@{ Name = 'WhatsApp (Meta)'; Live = [bool]$diagnostics.meta.live; Error = $diagnostics.meta.error; Warnings = @($diagnostics.meta.warnings) },
      [pscustomobject]@{ Name = 'TikTok'; Live = [bool]$diagnostics.tiktok.live; Error = $diagnostics.tiktok.error; Warnings = @($diagnostics.tiktok.warnings) },
      [pscustomobject]@{ Name = 'Shopee'; Live = [bool]$diagnostics.shopee.live; Error = $diagnostics.shopee.error; Warnings = @($diagnostics.shopee.warnings) }
    )
    foreach ($channel in $liveChannels) {
      if ($channel.Live) {
        Write-Ok "$($channel.Name): LIVE"
        foreach ($warning in $channel.Warnings) {
          if ($warning) { Write-Warn2 "$($channel.Name): $warning" }
        }
      } else {
        $reason = if ($channel.Error) {
          $channel.Error
        } elseif ($channel.Warnings.Count -gt 0) {
          ($channel.Warnings | Where-Object { $_ }) -join ' '
        } else {
          'tolak ukur live belum terpenuhi'
        }
        Write-Warn2 "$($channel.Name): belum LIVE - $reason"
        $notLive += $channel.Name
      }
    }
    if (-not $marketingConfigured -or $notLive.Count -gt 0) { $marketingRequiredFailed = $true }
  } catch {
    Write-Warn2 "Diagnostik Marketing gagal: $($_.Exception.Message)"
    $marketingRequiredFailed = $true
  }
}

# ----------------------------------------------------------- public check
Write-Step '8/8 Verifikasi akses internet'
$lanOnlyMode = $AllowLanOnly -and [string]::IsNullOrWhiteSpace($remoteAccessPass)
if ($lanOnlyMode) {
  Write-Warn2 'Mode LAN-only aktif: penolakan 403 dari internet adalah hasil yang diharapkan.'
}
$publicBase = ''
if ($PublicUrl) {
  $candidate = $PublicUrl.Trim().TrimEnd('/')
  if ($candidate -notmatch '^https?://') { $candidate = "https://$candidate" }
  $publicBase = $candidate
}

$appUrl = Get-EnvValue $envPath 'APP_URL'
if (-not $publicBase -and $appUrl -and $appUrl -match '^https?://' -and
    $appUrl -notmatch '^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|/|$)') {
  $publicBase = $appUrl.TrimEnd('/')
}
if (-not $publicBase) {
  $publicBase = Get-CaddyPublicUrl $AppDir
  if ($publicBase) { Write-Warn2 "APP_URL lokal/tidak diisi; memakai domain Caddy: $publicBase" }
}

$publicOk = $false
$publicCode = 0
$publicHealthUrl = ''
if ($SkipPublicCheck) {
  Write-Warn2 'Verifikasi publik dilewati (-SkipPublicCheck).'
  $publicOk = $true
} elseif (-not $publicBase) {
  Write-Warn2 'APP_URL dan domain Caddy tidak tersedia; akses internet tidak dapat diverifikasi.'
} else {
  try {
    $publicUri = [Uri]$publicBase
    Write-Host "   Domain publik: $($publicUri.Host)" -ForegroundColor DarkGray
    try {
      $dns = Resolve-DnsName -Name $publicUri.Host -ErrorAction Stop |
        Where-Object { $_.IPAddress } | Select-Object -First 3
      if ($dns) {
        Write-Ok "DNS mengarah ke: $((@($dns.IPAddress)) -join ', ')"
      } else {
        Write-Warn2 'DNS tidak mengembalikan alamat IP (mungkin memakai CNAME/CDN).'
      }
    } catch {
      Write-Warn2 "Resolusi DNS gagal: $($_.Exception.Message)"
    }

    $publicHealthUrl = "$publicBase/api/health"
    $publicHealth = Test-PublicEndpoint $publicHealthUrl
    $publicCode = $publicHealth.Code
    if ($publicHealth.Ok) {
      Write-Ok "HTTPS publik terjangkau: $publicHealthUrl (HTTP $publicCode)."
      $publicOk = $true
    } else {
      Write-Warn2 "HTTPS publik gagal: $publicHealthUrl (HTTP $publicCode). $($publicHealth.Error)"
    }

    $publicRoot = Test-PublicEndpoint "$publicBase/"
    if ($publicRoot.Ok) {
      Write-Ok "Halaman utama terjangkau (HTTP $($publicRoot.Code))."
    } else {
      Write-Warn2 "Halaman utama belum terjangkau (HTTP $($publicRoot.Code))."
    }

    if ($publicSite -and $publicRoot.Ok -and ($publicRoot.Code -eq 401 -or $publicRoot.Code -eq 403)) {
      Write-Warn2 'PUBLIC_SITE=true tetapi halaman utama masih meminta Basic Auth / menolak publik. Periksa isi .env dan status service.'
      $publicOk = $false
    }

    # Jalur yang DIPAKAI BROWSER PENGUNJUNG: domain publik -> Caddy -> PocketBase.
    # SSE yang terputus/ter-buffer di sini berarti aplikasi live tidak sync real-time.
    if (-not $SkipRealtimeCheck) {
      $publicPbBase = if ($pbBrowserUrl) { $pbBrowserUrl } else { "$publicBase/api/pb" }
      $publicRealtime = Test-RealtimeStream "$publicPbBase/api/realtime" 12
      if ($publicRealtime.Ok) {
        $pbRealtimeStatus = "$pbRealtimeStatus | publik OK"
        Write-Ok "SSE realtime publik mengalir lewat $publicPbBase (proxy Caddy tidak mem-buffer)."
      } else {
        $pbRealtimeStatus = "$pbRealtimeStatus | publik GAGAL"
        $publicOk = $false
        Write-Warn2 "Realtime publik bermasalah ($publicPbBase/api/realtime): $($publicRealtime.Error). Pengunjung internet tidak akan menerima perubahan antar user."
      }

      try {
        $publicHealthData = Invoke-RestMethod -Uri $publicHealthUrl -TimeoutSec 20
        $publicPb = $publicHealthData.pocketbase
        if ($publicPb.reachable -and $publicPb.realtimeStream) {
          Write-Ok "Health publik melaporkan PocketBase sehat + realtime hidup (versi $($publicHealthData.version))."
        } else {
          $publicOk = $false
          Write-Warn2 "Health publik melaporkan PocketBase bermasalah: $(if ($publicPb.error) { $publicPb.error } else { 'probe belum tersedia di build lama' })"
        }
      } catch {
        Write-Warn2 "Health publik tidak dapat dibaca JSON ($publicHealthUrl): $($_.Exception.Message)"
      }
    }

    # Identitas website (logo, favicon, judul) hanya live bila landing sudah
    # dipublish dan HTML publik memuat tag identitas dari server.
    try {
      $landingResponse = Invoke-WebRequest -Uri "$publicBase/api/landing/published" -UseBasicParsing -TimeoutSec 20
      $landingPayload = $landingResponse.Content | ConvertFrom-Json
      if ($landingPayload.published -and $landingPayload.config) {
        $brand = $landingPayload.config.brand
        $brandBits = @()
        if ($brand.logoUrl) { $brandBits += 'logo' }
        if ($brand.faviconUrl) { $brandBits += 'favicon' }
        if ($brand.siteTitle) { $brandBits += 'judul' }
        $brandText = if ($brandBits.Count -gt 0) { $brandBits -join ', ' } else { 'belum diisi' }
        Write-Ok "Landing published terbaca - identitas: $brandText."

        if ($brand.faviconUrl -or $brand.siteTitle) {
          try {
            $headResponse = Invoke-WebRequest -Uri "$publicBase/" -UseBasicParsing -TimeoutSec 20
            $headChecks = @()
            $headOk = $true
            if ($brand.faviconUrl) {
              $faviconOk = $headResponse.Content -match '<link\s+rel="icon"'
              if (-not $faviconOk) { $headOk = $false }
              $headChecks += $(if ($faviconOk) { 'favicon: OK' } else { 'favicon: BELUM ADA' })
            }
            if ($brand.siteTitle) {
              $titleOk = $headResponse.Content -match [regex]::Escape($brand.siteTitle)
              if (-not $titleOk) { $headOk = $false }
              $headChecks += $(if ($titleOk) { 'judul: OK' } else { 'judul: BELUM ADA' })
            }
            if ($headOk) {
              Write-Ok "Identitas di HTML publik - $($headChecks -join ' | ')."
            } else {
              Write-Warn2 "Identitas belum lengkap di HTML publik - $($headChecks -join ' | '). Periksa Simpan & Publish."
            }
          } catch {
            Write-Warn2 "HTML publik tidak dapat diperiksa: $($_.Exception.Message)"
          }
        }
      } else {
        Write-Warn2 'Landing page belum dipublish. Identitas belum tampil live di internet.'
      }
    } catch {
      Write-Warn2 "Cek identitas Landing gagal: $($_.Exception.Message)"
    }
  } catch {
    Write-Warn2 "URL publik tidak valid: $($_.Exception.Message)"
  }
}

# ----------------------------------------------------------- summary
if (-not $KeepSourceArchive) {
  if ($sourceArchive) { Remove-Item -LiteralPath $sourceArchive -Force -ErrorAction SilentlyContinue }
  if ($sourceWork) { Remove-Item -LiteralPath $sourceWork -Recurse -Force -ErrorAction SilentlyContinue }
}

$exitCode = 0
if ($RequireMarketing -and $marketingRequiredFailed) {
  $exitCode = 2
} elseif (-not $publicOk -and -not $SkipPublicCheck -and -not $lanOnlyMode) {
  $exitCode = 3
}

$appStatus = (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue).Status
$caddyStatusText = 'tidak terdaftar'
$caddySvc = Get-Service -Name 'Caddy' -ErrorAction SilentlyContinue
if ($caddySvc) { $caddyStatusText = [string]$caddySvc.Status }
$pbStatusText = 'tidak terdaftar'
if ($pbService) { $pbStatusText = [string](Get-Service -Name 'PocketBase' -ErrorAction SilentlyContinue).Status }

# Pemeriksaan akhir: pastikan tidak ada backup .env plaintext tertinggal.
if ($PurgePlaintextEnvBackups) {
  $remainingEnvBackups = @()
  foreach ($dir in @((Join-Path $AppDir 'backups'), $BackupRoot)) {
    if (-not (Test-Path -LiteralPath $dir)) { continue }
    $remainingEnvBackups += @(
      Get-ChildItem -LiteralPath $dir -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { Test-EnvBackupName $_.Name } |
        ForEach-Object { $_.FullName }
    )
  }
  $envBackupText = if ($remainingEnvBackups.Count -eq 0) { 'tidak ada' } else { "$($remainingEnvBackups.Count) tersisa" }
} else {
  $envBackupText = 'pembersihan tidak diminta'
}

Write-Host ''
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ' RINGKASAN DEPLOY' -ForegroundColor Cyan
Write-Host "   Source            : $sourceLabel"
Write-Host "   Service aplikasi  : $appStatus"
Write-Host "   Caddy             : $caddyStatusText"
Write-Host "   PocketBase        : $pbStatusText"
Write-Host "   Aturan PB         : $pbHardeningStatus"
Write-Host "   Skema akun PB     : $pbAccountSchemaStatus"
Write-Host "   Sync realtime PB  : $pbRealtimeStatus"
Write-Host "   URL PB browser    : $(if ($pbBrowserUrl) { $pbBrowserUrl } else { Get-EnvValue $envPath 'VITE_POCKETBASE_URL' })"
Write-Host "   Akses internet    : $(if ($publicSite) { 'PUBLIK (landing terbuka, dashboard wajib login)' } elseif ($lanOnlyMode) { 'LAN-only (403 dari internet)' } elseif ([string]::IsNullOrWhiteSpace($remoteAccessPass)) { 'tanpa password (hanya lokal/LAN)' } else { 'dengan password REMOTE_ACCESS_PASS' })"
Write-Host "   Health lokal      : $(if (Test-AppHealth $localHealthUrl 5) { 'OK' } else { 'GAGAL' }) ($localHealthUrl)"
if ($publicBase) {
  Write-Host "   Domain publik     : $publicBase (HTTP $publicCode)"
} else {
  Write-Host '   Domain publik     : tidak tersedia'
}
if ($EnablePublicSite) { Write-Host '   Mode publik       : PUBLIC_SITE=true, ALLOW_DEFAULT_STAFF_PASSWORDS=false' }
if ($SetDevPassword) { Write-Host '   Password DEVELOPER: disetel stabil (min 10 karakter, hash scrypt)' }
if ($RotateDevPassword) { Write-Host "   Password DEVELOPER: dirotasi ($DevPasswordLength karakter, hash scrypt)" }
if ($PurgePlaintextEnvBackups) { Write-Host "   Backup .env plain : $envBackupText" }
if ($distBackup) { Write-Host "   Backup dist       : $distBackup" }
Write-Host "   Log aplikasi      : $AppDir\logs\stderr.log"
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ''

if ($publicSite) {
  Write-Host ' LANGKAH WAJIB SETELAH DEPLOY' -ForegroundColor Yellow
  if ($RotateDevPassword) {
    Write-Host '   1. Login sebagai DEVELOPER memakai password baru dari file secrets.' -ForegroundColor Yellow
  } elseif ($SetDevPassword) {
    Write-Host '   1. Login sebagai DEVELOPER memakai password yang baru Anda masukkan.' -ForegroundColor Yellow
  } else {
    Write-Host '   1. Login sebagai DEVELOPER memakai password stabil (hash scrypt di .env).' -ForegroundColor Yellow
  }
  Write-Host '   2. Buka menu Pengguna dan ganti password SEMUA staf.' -ForegroundColor Yellow
  Write-Host '   3. Login publik menolak WEAK_PASSWORD sampai password default diganti.' -ForegroundColor Yellow
  if ($RotateDevPassword) {
    Write-Host '   4. Simpan password ke password manager lalu hapus file secrets.' -ForegroundColor Yellow
  } else {
    Write-Host '   4. Pastikan password DEVELOPER tersimpan di password manager.' -ForegroundColor Yellow
  }
  Write-Host ''
}

if ($exitCode -eq 0) {
  Write-Ok 'DEPLOY SELESAI DAN TERVERIFIKASI.'
} elseif ($exitCode -eq 2) {
  Write-Host '   [FAIL] Marketing wajib belum LIVE. Periksa .env dan diagnostik di atas.' -ForegroundColor Red
} else {
  Write-Host '   [FAIL] Aplikasi terdeploy, tetapi akses internet belum terverifikasi.' -ForegroundColor Red
  Write-Host '          Periksa DNS, port 80/443, service Caddy, dan firewall Windows.' -ForegroundColor Yellow
}

exit $exitCode
