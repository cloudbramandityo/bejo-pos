<#
=======================================================================
  BEJO Digital Print - SATU SKRIP DIAGNOSTIK VPS (status + diagnosa)
=======================================================================
  Satu-satunya skrip pemeriksaan kondisi VPS. Kebijakan: jangan membuat
  skrip diagnostik baru; kebutuhan pemeriksaan tambahan cukup ditambahkan
  sebagai seksi/opsi di skrip ini (sama seperti deploy-vps.ps1).
  Menggantikan scripts/check-vps-status.ps1 dan scripts/check-vps-simple.ps1.

  Jalankan DI DALAM VPS (PowerShell Administrator):

      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\scripts\diagnose-live.ps1

  Jangan menjalankan "git pull" di C:\bejo-pos: deploy menyalin source dari
  arsip GitHub (robocopy) tanpa menyentuh .env/data, jadi working tree VPS
  memang selalu "kotor" bagi git. Source terbaru cukup dibawa deploy-vps.ps1.

  Hasil: ringkasan di layar + laporan .txt dan .json di %TEMP% (path dicetak
  di akhir). Kirim kedua file itu untuk analisis.

  Skrip ini READ-ONLY:
    - Tidak menulis/mengubah data PocketBase, .env, atau file aplikasi.
    - Kredensial hanya ditampilkan status TERISI/KOSONG + panjang; nilainya
      tidak pernah dicetak, termasuk di laporan.

  Seksi:
    A. Host, runtime, dan freshness deploy
    B. Konfigurasi .env (nilai rahasia disembunyikan)
    C. Service, proses, dan port
    D. Endpoint lokal (dari dalam VPS)
    E. Endpoint publik (HTTPS/Caddy) + sertifikat TLS
    F. Integritas akun sinkronisasi & direktori
    G. Data PocketBase, backup, dan risiko restore
    H. Log terbaru (dipindai, rahasia disamarkan)
    I. Provisioning: software, folder, service & firewall
    J. Caddyfile, DNS, dan isi bundel browser
    K. Ringkasan

  Opsi:
    -AppDir C:\bejo-pos          Folder aplikasi di VPS
    -Domain <domain>             Domain publik untuk uji DNS/HTTPS/TLS
    -CaddyDir C:\caddy           Folder Caddy (exe, Caddyfile, pki)
    -PbDir C:\pocketbase         Folder PocketBase (exe + pb_data)
    -BackupRoot C:\backups\...   Folder backup untuk cek keberadaan
    -ExpectedPbVersion 0.28.1    Versi PocketBase yang seharusnya terpasang
    -LogLines 120                Jumlah baris log yang dipindai
    -ReportPath <file>           Lokasi laporan .txt (.json ikut di sampingnya)
    -SkipAccounts                Lewati seksi F (pemeriksaan akun, paling lambat)
    -SkipProvisioning            Lewati seksi I dan J (provisioning/Caddy/bundel)
    -RequireClean                Exit code 2 bila masih ada WARN (untuk CI/cron)
    -SelfTest                    Uji logika penilaian port dengan contoh aturan
                                 nyata, tanpa membaca sistem (untuk workstation)

  Exit code:
    0 tidak ada kegagalan kritis
    1 ada kegagalan kritis (FAIL)
    2 -RequireClean dipakai dan masih ada WARN
=======================================================================
#>
[CmdletBinding()]
param(
  [string]$AppDir    = 'C:\bejo-pos',
  [string]$Domain    = 'bejodigitalprint.com',
  [string]$LocalPbUrl = 'http://127.0.0.1:8090',
  [string]$LocalAppUrl = 'http://127.0.0.1:3000',
  [string]$CaddyDir  = 'C:\caddy',
  [string]$PbDir     = 'C:\pocketbase',
  [string]$NssmDir   = 'C:\nssm',
  [string]$BackupRoot = 'C:\backups\bejo-pos',
  [string]$ExpectedPbVersion = '0.28.1',
  [int]$LogLines     = 120,
  [string]$ReportPath = '',
  [switch]$SkipAccounts,
  [switch]$SkipProvisioning,
  [switch]$RequireClean,
  [switch]$SelfTest
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ([string]::IsNullOrWhiteSpace($ReportPath)) {
  $ReportPath = Join-Path $env:TEMP "bejo-diagnose-$stamp.txt"
}
$JsonPath = [System.IO.Path]::ChangeExtension($ReportPath, '.json')

$script:OkCount = 0
$script:WarnCount = 0
$script:FailCount = 0
$script:Actions = New-Object System.Collections.Generic.List[string]

function Write-Section([string]$title) {
  Write-Host ''
  Write-Host ('=' * 68) -ForegroundColor DarkCyan
  Write-Host " $title" -ForegroundColor Cyan
  Write-Host ('=' * 68) -ForegroundColor DarkCyan
}
function Ok([string]$msg)   { $script:OkCount++;   Write-Host "  [OK]   $msg"   -ForegroundColor Green }
function Warn([string]$msg) { $script:WarnCount++; Write-Host "  [WARN] $msg"   -ForegroundColor Yellow; $script:Actions.Add($msg) }
function Fail([string]$msg) { $script:FailCount++; Write-Host "  [FAIL] $msg"   -ForegroundColor Red;    $script:Actions.Add($msg) }
function Info([string]$msg) { Write-Host "         $msg"   -ForegroundColor DarkGray }

function Redact([string]$text) {
  if (-not $text) { return '' }
  return ($text -replace '(?i)(password|passwd|token|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s,;"'']+', '$1=***')
}

# stdout dan stderr Node dipisah lewat Start-Process. Dengan 2>&1 pesan stderr
# dibungkus sebagai ErrorRecord PowerShell (menampilkan baris skrip dan
# CategoryInfo) lalu menyatu dengan JSON, sehingga hasil baca terlihat seperti
# data rusak dan penyebab aslinya tidak terbaca.
function Invoke-NodeScript([string]$scriptPath, [string[]]$arguments) {
  $outFile = Join-Path $env:TEMP ('bejo-diag-out-' + [guid]::NewGuid().ToString('N') + '.txt')
  $errFile = Join-Path $env:TEMP ('bejo-diag-err-' + [guid]::NewGuid().ToString('N') + '.txt')
  try {
    $argList = @("`"$scriptPath`"")
    foreach ($a in $arguments) { $argList += "`"$a`"" }
    $proc = Start-Process -FilePath 'node' -ArgumentList $argList -NoNewWindow -Wait -PassThru `
      -RedirectStandardOutput $outFile -RedirectStandardError $errFile
    $stdout = ''
    $stderr = ''
    if (Test-Path $outFile) { $stdout = (Get-Content -LiteralPath $outFile -Raw -ErrorAction SilentlyContinue) -join '' }
    if (Test-Path $errFile) { $stderr = (Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue) -join '' }
    $exitCode = -1
    try { $exitCode = [int]$proc.ExitCode } catch { }
    return [pscustomobject]@{ Out = [string]$stdout; Err = (Redact ([string]$stderr)); ExitCode = $exitCode }
  } finally {
    Remove-Item -LiteralPath $outFile, $errFile -Force -ErrorAction SilentlyContinue
  }
}

# .env dibaca lewat dotenv (parser yang sama dengan server) supaya password
# ber-escape tidak membuat laporan berbeda dari kenyataan. Nilai rahasia hanya
# keluar sebagai panjang; nilai biasa (APP_URL, PUBLIC_SITE, dst.) apa adanya.
function Get-EnvInfo([string]$path, [string]$appDir) {
  $tmp = Join-Path $appDir ('.tmp-diagnose-env-' + [guid]::NewGuid().ToString('N') + '.mjs')
  $script = @'
import dotenv from 'dotenv';
const [envPath] = process.argv.slice(2);
const env = dotenv.config({ path: envPath, override: true, quiet: true }).parsed || {};
const plain = ['APP_URL', 'POCKETBASE_UPSTREAM', 'VITE_POCKETBASE_URL', 'PUBLIC_SITE', 'ALLOW_DEFAULT_STAFF_PASSWORDS', 'DEV_USERNAME'];
const secret = ['PB_SYNC_EMAIL', 'PB_SYNC_PASSWORD', 'PB_ADMIN_EMAIL', 'PB_ADMIN_PASSWORD', 'DEV_PASSWORD_HASH', 'APP_SESSION_SECRET', 'GEMINI_API_KEY', 'REMOTE_ACCESS_PASS'];
const legacy = ['VITE_PB_SYNC_EMAIL', 'VITE_PB_SYNC_PASSWORD'];
const out = {};
for (const key of [...plain, ...secret, ...legacy]) {
  const present = Object.prototype.hasOwnProperty.call(env, key);
  out[key] = {
    present,
    length: String(env[key] ?? '').length,
    value: plain.includes(key) ? String(env[key] ?? '') : null,
  };
}
console.log(JSON.stringify(out));
'@
  $script:EnvReadError = ''
  try {
    [System.IO.File]::WriteAllText($tmp, $script, [System.Text.UTF8Encoding]::new($false))
    $run = Invoke-NodeScript $tmp @($path)
    $raw = [string]$run.Out
    $start = $raw.IndexOf('{')
    if ($start -lt 0) {
      $reason = [string]$run.Err
      if (-not $reason) { $reason = 'node tidak menghasilkan output (exit code ' + $run.ExitCode + ').' }
      $script:EnvReadError = $reason
      return $null
    }
    if ($start -gt 0) { $raw = $raw.Substring($start) }
    return ($raw | ConvertFrom-Json)
  } catch {
    $script:EnvReadError = $_.Exception.Message
    return $null
  } finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}

function Get-Endpoint([string]$url, [int]$timeoutSec = 20) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec -MaximumRedirection 5
    $sw.Stop()
    return [pscustomobject]@{ Url = $url; Ok = $true; Status = [int]$resp.StatusCode; Ms = $sw.ElapsedMilliseconds; Body = $resp.Content; Error = $null }
  } catch {
    $sw.Stop()
    $status = $null
    try { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } } catch { }
    $body = $null
    try {
      if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
      }
    } catch { }
    return [pscustomobject]@{ Url = $url; Ok = $false; Status = $status; Ms = $sw.ElapsedMilliseconds; Body = $body; Error = $_.Exception.Message }
  }
}

function Get-TlsCertificate([string]$hostName) {
  $tcp = $null
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient($hostName, 443)
    $ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, { $true })
    # Enum .NET bernama SslProtocols (jamak). Menulis SslProtocol membuat
    # PowerShell melempar "Unable to find type" dan sertifikat terbaca tidak ada
    # padahal HTTPS sehat.
    # Tanpa daftar protokol eksplisit negosiasi bisa jatuh ke TLS 1.0 yang sudah
    # dimatikan Caddy.
    $protocols = [System.Security.Authentication.SslProtocols]::Tls12
    try {
      $protocols = $protocols -bor [System.Security.Authentication.SslProtocols]::Tls13
    } catch { }
    $ssl.AuthenticateAsClient($hostName, $null, $protocols, $false)
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
    $ssl.Dispose()
    return $cert
  } catch {
    return $null
  } finally {
    if ($tcp) { $tcp.Close() }
  }
}

# Sertifikat Let's Encrypt milik Caddy juga tersimpan di disk; bila jalur
# jaringan gagal (mis. SNI/proxy), berkasnya tetap memberi tanggal kedaluwarsa.
function Get-CaddyStoredCertificate([string]$caddyDir, [string]$hostName) {
  $roots = @(
    (Join-Path $caddyDir 'pki\authorities'),
    (Join-Path $env:APPDATA 'Caddy\pki\authorities'),
    (Join-Path $env:LOCALAPPDATA 'Caddy\pki\authorities')
  ) | Where-Object { Test-Path $_ }
  foreach ($root in $roots) {
    $pem = Get-ChildItem -LiteralPath $root -Recurse -Filter 'cert.pem' -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match [regex]::Escape($hostName) } |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($pem) {
      try { return (New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pem.FullName)) } catch { }
    }
  }
  return $null
}

function Get-ExeVersion([string]$path) {
  if (-not (Test-Path $path)) { return '' }
  try {
    $info = (Get-Item -LiteralPath $path).VersionInfo
    $fileVersion = [string]$info.ProductVersion
    if ([string]::IsNullOrWhiteSpace($fileVersion)) { $fileVersion = [string]$info.FileVersion }
    return $fileVersion.Trim()
  } catch { return '' }
}

# ---------------------------------------------------------------------
# Penilaian paparan port lewat aturan firewall Windows.
#
# Aturan bawaan Windows (AllJoyn Router, Remote Desktop Shadow, Cortana,
# Desktop App Web Viewer, dst.) memakai LocalPort '*' dan RemoteAddress 'Any'
# TETAPI terikat pada satu program, paket, atau service. Menyimpulkan "port 3000
# terbuka dari internet" dari aturan semacam itu menghasilkan FAIL palsu yang
# membuat operator mengira servernya bocor. Yang dihitung paparan hanya aturan
# yang: protokolnya TCP/Any, portnya cocok, sumbernya internet, profilnya berlaku
# untuk jaringan publik, dan keempat kolom ikatannya terbaca serta semuanya
# bernilai bebas (Any/'*'/kosong). Ikatan yang tidak terbaca menghasilkan WARN
# "tidak disimpulkan", bukan FAIL dan bukan OK.
# ---------------------------------------------------------------------
function Test-FwTcpProtocol([string]$protocol) {
  if ([string]::IsNullOrWhiteSpace($protocol)) { return $true }
  return [bool]($protocol -match '(?i)^(tcp|any|\*)$')
}

function Test-FwPortMatch([string]$ports, [int]$port) {
  $list = @($ports -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
  if ($list.Count -eq 0) { return $true }
  foreach ($entry in $list) {
    if ($entry -match '(?i)^(any|\*)$') { return $true }
    if ($entry -match '^(\d+)-(\d+)$') {
      if ($port -ge [int]$Matches[1] -and $port -le [int]$Matches[2]) { return $true }
      continue
    }
    if ($entry -eq [string]$port) { return $true }
  }
  return $false
}

function Test-FwInternetRemote([string]$remote) {
  $list = @($remote -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
  if ($list.Count -eq 0) { return $true }
  foreach ($entry in $list) {
    if ($entry -match '(?i)^(any|\*|0\.0\.0\.0/0|::/0|internet)$') { return $true }
  }
  return $false
}

function Test-FwPublicProfile([string]$profile) {
  if ([string]::IsNullOrWhiteSpace($profile)) { return $true }
  return [bool]($profile -match '(?i)^(any|public)$' -or $profile -match '(?i)public')
}

# Nilai 'Any'/'*'/'kosong' pada kolom ikatan berarti kolom itu tidak membatasi.
# 'Any' harus dihitung sebagai tidak membatasi: kalau tidak, setiap aturan umum
# justru disangka dipatok satu program.
function Test-FwUnrestrictedValue([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return $true }
  return [bool]($value -match '(?i)^(any|\*)$')
}

# Menilai satu aturan kandidat pembuka port: 'umum' (boleh disimpulkan sebagai
# paparan), 'terikat' (dibatok program/paket/service, bukan pembuka port umum),
# atau 'tak terbaca' (ikatan tidak bisa dibaca - tidak boleh disimpulkan apa pun).
#
# SEMUA kolom ikatan diperiksa. Aturan bawaan Windows seperti
# 'Remote Desktop - Shadow (TCP-In)' dan 'Desktop App Web Viewer' menyimpan
# programnya di kolom 'Application' berupa path (svchost.exe), sementara
# 'ApplicationName' kosong. Membaca 'ApplicationName' saja membuat aturan itu
# disangka pembuka port umum dan menghasilkan FAIL palsu "Port 3000 dibuka ke
# internet" di VPS, padahal portnya tidak bisa tersambung dari luar.
function Get-FwScopeVerdict($binding) {
  if (-not $binding -or -not [bool]$binding.Readable) {
    return [pscustomobject]@{ State = 'tak terbaca'; Detail = 'ikatan program/paket/service tidak terbaca' }
  }
  $parts = @()
  $fields = @(
    @{ label = 'program'; value = [string]$binding.App },
    @{ label = 'namaProgram'; value = [string]$binding.AppName },
    @{ label = 'paket'; value = [string]$binding.Pkg },
    @{ label = 'service'; value = [string]$binding.Svc }
  )
  foreach ($pair in $fields) {
    if (-not (Test-FwUnrestrictedValue $pair.value)) { $parts += ("{0}={1}" -f $pair.label, $pair.value) }
  }
  if ($parts.Count -gt 0) {
    return [pscustomobject]@{ State = 'terikat'; Detail = ($parts -join ', ') }
  }
  return [pscustomobject]@{ State = 'umum'; Detail = 'tanpa ikatan program/paket/service' }
}

function Test-FwCouldExposePort($map, [int]$port) {
  return (Test-FwTcpProtocol ([string]$map.Protocol)) -and (Test-FwPortMatch ([string]$map.Ports) $port) -and (Test-FwInternetRemote ([string]$map.Remote)) -and (Test-FwPublicProfile ([string]$map.Profile))
}

function Join-FwFilterValues($items, [string]$property) {
  $values = @()
  foreach ($item in @($items)) {
    $prop = $item.PSObject.Properties[$property]
    if (-not $prop) { continue }
    $textValue = [string]$prop.Value
    if ($textValue -ne '') { $values += $textValue }
  }
  return ($values -join ',')
}

# Baca SEMUA kolom ikatan satu aturan. ErrorRecord dikumpulkan lewat
# -ErrorVariable (bukan -ErrorAction Stop) supaya tidak meninggalkan baris noise
# di transcript, dan stream-nya dibungkam. Tidak ada objek ApplicationFilter =
# ikatannya tidak terbaca, jadi portnya tidak boleh disimpulkan.
function Read-FwRuleBinding($rule) {
  $appErr = $null
  $svcErr = $null
  $appFilter = @(Get-NetFirewallApplicationFilter -AssociatedNetFirewallRule $rule -ErrorAction SilentlyContinue -ErrorVariable appErr 2>$null)
  $svcFilter = @(Get-NetFirewallServiceFilter -AssociatedNetFirewallRule $rule -ErrorAction SilentlyContinue -ErrorVariable svcErr 2>$null)
  return @{
    Readable = ($appFilter.Count -gt 0 -and -not $appErr -and -not $svcErr)
    App      = Join-FwFilterValues $appFilter 'Application'
    AppName  = Join-FwFilterValues $appFilter 'ApplicationName'
    Pkg      = Join-FwFilterValues $appFilter 'PackageId'
    Svc      = Join-FwFilterValues $svcFilter 'Service'
  }
}

# Bagi aturan kandidat pembuka port menjadi tiga keadaan: umum (paparan nyata),
# terikat program/paket/service (bukan pembuka port umum), dan tidak terbaca.
function Get-FwPortAssessment($candidates) {
  $umum = @()
  $terikat = @()
  $takTerbaca = @()
  foreach ($c in @($candidates)) {
    if (-not $c) { continue }
    $verdict = Get-FwScopeVerdict (Read-FwRuleBinding $c.Rule)
    $entry = @{ Name = [string]$c.Name; Detail = [string]$verdict.Detail }
    if ($verdict.State -eq 'umum') { $umum += $entry }
    elseif ($verdict.State -eq 'terikat') { $terikat += $entry }
    else { $takTerbaca += $entry }
  }
  return @{ Umum = @($umum); Terikat = @($terikat); TakTerbaca = @($takTerbaca) }
}

# Contoh aturan diambil persis dari laporan VPS 2026-10-30 yang sempat
# menghasilkan FAIL palsu: semuanya Enabled=True, Action=Allow, Inbound,
# LocalPort '*', RemoteAddress 'Any' - yang membedakan hanya protokol, profil,
# dan ikatan program/service.
function Invoke-FirewallSelfTest {
  $failed = 0
  $cases = @(
    @{ n = 'UDP tidak dihitung untuk port TCP'; map = @{ Name = 'AllJoyn Router (UDP-In)'; Protocol = 'UDP'; Ports = '*'; Remote = 'Any'; Profile = 'Any' }; port = 3000; expect = $false },
    @{ n = 'ICMPv6 tidak dihitung'; map = @{ Name = 'Core Networking - IPv6 (IPv6-In)'; Protocol = '58'; Ports = '*'; Remote = 'Any'; Profile = 'Any' }; port = 8090; expect = $false },
    @{ n = 'Aturan UWP Cortana (hanya cocok lewat port) tetap kandidat'; map = @{ Name = 'Cortana'; Protocol = 'Any'; Ports = '*'; Remote = 'Any'; Profile = 'Any' }; port = 3000; expect = $true },
    @{ n = 'Hanya profil Domain bukan paparan publik'; map = @{ Name = 'Remote Desktop - Shadow (TCP-In)'; Protocol = 'TCP'; Ports = '*'; Remote = 'Any'; Profile = 'Domain' }; port = 3000; expect = $false },
    @{ n = 'RemoteAddress LocalSubnet bukan dari internet'; map = @{ Name = 'Work or school account'; Protocol = 'TCP'; Ports = '*'; Remote = 'LocalSubnet'; Profile = 'Any' }; port = 8090; expect = $false },
    @{ n = 'Port spesifik 0.0.0.0/0 = paparan internet'; map = @{ Name = 'Bejo POS Terbuka'; Protocol = 'TCP'; Ports = '3000'; Remote = '0.0.0.0/0'; Profile = 'Any' }; port = 3000; expect = $true },
    @{ n = 'Rentang port ikut dinilai'; map = @{ Name = 'Cast to Device streaming server (RTCP-Streaming-In)'; Protocol = 'UDP'; Ports = '50000-65535'; Remote = 'Any'; Profile = 'Any' }; port = 8090; expect = $false },
    @{ n = 'Rentang port yang memuat port target, TCP'; map = @{ Name = 'Rentang TCP'; Protocol = 'TCP'; Ports = '3000-3010'; Remote = 'Any'; Profile = 'Public' }; port = 3000; expect = $true },
    @{ n = 'Daftar port tanpa target tidak cocok'; map = @{ Name = 'Web (80,443)'; Protocol = 'TCP'; Ports = '80,443'; Remote = 'Any'; Profile = 'Any' }; port = 3000; expect = $false }
  )
  foreach ($c in $cases) {
    $got = Test-FwCouldExposePort ([pscustomobject]$c.map) $c.port
    if ($got -eq $c.expect) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (dapat=$got harus=$($c.expect))" -ForegroundColor Red; $failed++ }
  }
  $scopeCases = @(
    @{ n = 'path Application terisi = terikat (kasus aturan bawaan VPS)'; b = @{ Readable = $true; App = 'C:\Windows\System32\svchost.exe'; AppName = ''; Pkg = ''; Svc = 'Any' }; expect = 'terikat' },
    @{ n = 'hanya PackageId terisi = terikat'; b = @{ Readable = $true; App = 'Any'; AppName = ''; Pkg = 'Microsoft.Windows.Cortana_cw5n1h2txyewy'; Svc = 'Any' }; expect = 'terikat' },
    @{ n = 'hanya Service terisi = terikat'; b = @{ Readable = $true; App = 'Any'; AppName = ''; Pkg = ''; Svc = 'AllJoynRouterService' }; expect = 'terikat' },
    @{ n = 'nama program saja terisi = terikat'; b = @{ Readable = $true; App = 'Any'; AppName = 'Desktop App Web Viewer'; Pkg = ''; Svc = 'Any' }; expect = 'terikat' },
    @{ n = 'semua kolom Any = pembuka port umum'; b = @{ Readable = $true; App = 'Any'; AppName = 'Any'; Pkg = 'Any'; Svc = 'Any' }; expect = 'umum' },
    @{ n = 'semua kolom kosong = pembuka port umum'; b = @{ Readable = $true; App = ''; AppName = ''; Pkg = ''; Svc = '' }; expect = 'umum' },
    @{ n = 'ikatan tidak terbaca = jangan menyimpulkan'; b = @{ Readable = $false }; expect = 'tak terbaca' },
    @{ n = 'aturan tanpa objek ikatan = jangan menyimpulkan'; b = $null; expect = 'tak terbaca' }
  )
  foreach ($c in $scopeCases) {
    $got = Get-FwScopeVerdict $c.b
    if ([string]$got.State -eq [string]$c.expect) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (dapat=$($got.State) harus=$($c.expect))" -ForegroundColor Red; $failed++ }
  }

  # Uji JALAN BACA ikatan, bukan hanya keputusannya. Kesalahannya dulu ada di
  # kolom yang dibaca (hanya ApplicationName, padahal Shadow menulis svchost.exe
  # di Application), jadi kasus semacam ini harus dijalankan lewat kode asli.
  # Cmdlet filter dipalsukan dengan fungsi bernama sama di scope ini - lookup
  # perintah PowerShell memakai dynamic scope, jadi Read-FwRuleBinding di bawah
  # memanggil versi palsu itu dan tidak ada perubahan sistem yang terjadi.
  $appByRule = @{
    'hanya-path' = @([pscustomobject]@{ Application = 'C:\Windows\System32\svchost.exe'; ApplicationName = ''; PackageId = '' })
    'paket-saja' = @([pscustomobject]@{ Application = 'Any'; ApplicationName = ''; PackageId = 'Microsoft.Windows.Cortana_cw5n1h2txyewy' })
    'bebas' = @([pscustomobject]@{ Application = 'Any'; ApplicationName = 'Any'; PackageId = 'Any' })
    'kosong' = @()
    'galat' = @()
  }
  $svcByRule = @{
    'hanya-path' = @([pscustomobject]@{ Service = 'Any' })
    'paket-saja' = @([pscustomobject]@{ Service = 'Any' })
    'bebas' = @([pscustomobject]@{ Service = 'Any' })
    'kosong' = @()
    'galat' = @([pscustomobject]@{ Service = 'TermService' })
  }
  function Get-NetFirewallApplicationFilter {
    [CmdletBinding()]
    param($AssociatedNetFirewallRule)
    $kunci = [string]$AssociatedNetFirewallRule.RuleName
    if ($kunci -eq 'galat') { Write-Error 'ikatan tidak terbaca'; return }
    return $appByRule[$kunci]
  }
  function Get-NetFirewallServiceFilter {
    [CmdletBinding()]
    param($AssociatedNetFirewallRule)
    return $svcByRule[[string]$AssociatedNetFirewallRule.RuleName]
  }

  $bucketCases = @(
    @{ n = 'Shadow (hanya path Application) masuk Terikat, bukan paparan'; kunci = 'hanya-path'; harus = 'Terikat'; mengandung = 'svchost.exe' },
    @{ n = 'paket UWP masuk Terikat'; kunci = 'paket-saja'; harus = 'Terikat'; mengandung = 'Cortana' },
    @{ n = 'aturan bebas masuk Umum (boleh disebut paparan)'; kunci = 'bebas'; harus = 'Umum'; mengandung = '' },
    @{ n = 'ikatan tidak ada objek masuk TakTerbaca'; kunci = 'kosong'; harus = 'TakTerbaca'; mengandung = '' },
    @{ n = 'cmdlet gagal masuk TakTerbaca'; kunci = 'galat'; harus = 'TakTerbaca'; mengandung = '' }
  )
  foreach ($c in $bucketCases) {
    $candidates = @(@{ Name = 'Aturan Uji'; Rule = [pscustomobject]@{ RuleName = $c.kunci } })
    $hasil = Get-FwPortAssessment $candidates
    $total = @($hasil.Umum).Count + @($hasil.Terikat).Count + @($hasil.TakTerbaca).Count
    $isi = @($hasil[$c.harus])
    $ok = ($total -eq 1 -and $isi.Count -eq 1)
    if ($ok -and $c.mengandung) { $ok = ([string]$isi[0].Detail -match [regex]::Escape($c.mengandung)) }
    if ($ok) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (total=$total, bucket=$($c.harus) isi=$($isi.Count))" -ForegroundColor Red; $failed++ }
  }
  # Penilaian aksi pemulihan service: dulu FailureActions kosong langsung
  # dilaporkan "belum ada aksi pemulihan", padahal service NSSM (semua service
  # toko ini) tidak pernah menulisnya dan punya pengawas restart sendiri.
  $recoveryCases = @(
    @{ n = 'Windows restart-service = dipulihkan Windows'; s = @{ Windows = 'restart-service'; Nssm = $false; AppExit = '' }; harus = 'windows' },
    @{ n = 'NSSM tanpa AppExit tertulis = bawaan Restart, tetap dipulihkan'; s = @{ Windows = 'none'; Nssm = $true; AppExit = '' }; harus = 'nssm-bawaan' },
    @{ n = 'NSSM AppExit=Restart = dipulihkan NSSM'; s = @{ Windows = 'none'; Nssm = $true; AppExit = 'Restart' }; harus = 'nssm' },
    @{ n = 'NSSM AppExit=Exit = benar-benar tanpa restart'; s = @{ Windows = 'none'; Nssm = $true; AppExit = 'Exit' }; harus = 'nssm-dimatikan' },
    @{ n = 'NSSM AppExit=Ignore = benar-benar tanpa restart'; s = @{ Windows = 'none'; Nssm = $true; AppExit = 'Ignore' }; harus = 'nssm-dimatikan' },
    @{ n = 'bukan NSSM tanpa FailureActions = tanpa pengawas'; s = @{ Windows = 'none'; Nssm = $false; AppExit = '' }; harus = 'tanpa-pengawas' },
    @{ n = 'Windows reboot bukan restart service'; s = @{ Windows = 'reboot'; Nssm = $false; AppExit = '' }; harus = 'tanpa-pengawas' },
    @{ n = 'registri tidak terbaca = jangan menyimpulkan'; s = @{ Windows = 'tak terbaca'; Nssm = $false; AppExit = '' }; harus = 'tak terbaca' }
  )
  foreach ($c in $recoveryCases) {
    $got = (Get-RecoveryVerdict $c.s).Level
    if ([string]$got -eq [string]$c.harus) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (dapat=$got harus=$($c.harus))" -ForegroundColor Red; $failed++ }
  }

  Remove-Item Function:Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue
  Remove-Item Function:Get-NetFirewallServiceFilter -ErrorAction SilentlyContinue
  if ($failed -gt 0) { Write-Host "  SELFTEST GAGAL: $failed kasus salah." -ForegroundColor Red; return 1 }
  Write-Host '  Semua kasus penilaian port firewall & aksi pemulihan service lulus.' -ForegroundColor Green
  return 0
}

# Aksi pemulihan service dibaca dari registri (sama dengan yang dipakai NSSM),
# bukan dari properti Win32_Service yang memang tidak menyediakannya.
function Get-ServiceRecovery([string]$serviceName) {
  $key = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
  $bytes = (Get-ItemProperty -Path $key -Name 'FailureActions' -ErrorAction SilentlyContinue).FailureActions
  if (-not $bytes -or $bytes.Count -lt 8) { return 'none' }
  try {
    $count = [BitConverter]::ToInt32([byte[]]$bytes, 0)
    if ($count -lt 1) { return 'none' }
    switch ([BitConverter]::ToInt32([byte[]]$bytes, 4)) {
      1 { return 'reboot' }
      2 { return 'restart-service' }
      3 { return 'run-command' }
      default { return 'none' }
    }
  } catch { return 'tak terbaca' }
}

# Ada DUA pengawas restart yang berbeda dan keduanya harus dilihat. FailureActions
# hanya dipakai Windows Service Control Manager; service yang dibuat lewat NSSM
# (BejoStikerPOS, Caddy, PocketBase di VPS ini) tidak pernah menulisnya, karena
# NSSM menyimpan pengaturan sendiri di subkey Parameters dan nilai bawaan AppExit
# adalah Restart. Menilai FailureActions saja membuat service yang selalu dihidupkan
# ulang dilaporkan "belum ada aksi pemulihan" - temuan palsu.
function Get-ServiceSupervision([string]$serviceName) {
  $key = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
  $nssmKey = Join-Path $key 'Parameters'
  $dikelolaNssm = Test-Path -LiteralPath $nssmKey
  $appExit = $null
  if ($dikelolaNssm) {
    $appExit = (Get-ItemProperty -Path $nssmKey -Name 'AppExit' -ErrorAction SilentlyContinue).AppExit
  }
  return @{ Windows = (Get-ServiceRecovery $serviceName); Nssm = [bool]$dikelolaNssm; AppExit = [string]$appExit }
}

# Penilaian murni dari hasil pembacaan di atas - bisa diuji lewat -SelfTest tanpa
# menyentuh registri.
function Get-RecoveryVerdict($state) {
  $windows = [string]$state.Windows
  $appExit = ([string]$state.AppExit).Trim()
  if ($windows -eq 'restart-service') {
    return [pscustomobject]@{ Level = 'windows'; Detail = "FailureActions=$windows" }
  }
  if ($state.Nssm) {
    if ([string]::IsNullOrWhiteSpace($appExit)) {
      return [pscustomobject]@{ Level = 'nssm-bawaan'; Detail = 'AppExit belum ditulis; bawaan NSSM = Restart' }
    }
    if ($appExit -match '(?i)^restart$') {
      return [pscustomobject]@{ Level = 'nssm'; Detail = "AppExit=$appExit" }
    }
    return [pscustomobject]@{ Level = 'nssm-dimatikan'; Detail = "AppExit=$appExit" }
  }
  if ($windows -eq 'tak terbaca') {
    return [pscustomobject]@{ Level = 'tak terbaca'; Detail = 'registri aksi pemulihan tidak terbaca dan service tidak dikelola NSSM' }
  }
  return [pscustomobject]@{ Level = 'tanpa-pengawas'; Detail = "failure action Windows: $windows" }
}

function Find-LogFiles {
  $files = New-Object System.Collections.Generic.List[string]
  foreach ($dir in @($AppDir, (Join-Path $AppDir 'logs'), (Join-Path $env:USERPROFILE '.pm2\logs'))) {
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem -LiteralPath $dir -Filter '*.log' -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 4 |
      ForEach-Object { $files.Add($_.FullName) }
  }
  return ($files | Select-Object -Unique)
}

# -SelfTest dijawab sebelum transcript dibuka: ia hanya menguji fungsi
# penilaian port, tidak menyentuh service, firewall, maupun database, sehingga
# bisa dipakai di workstation sebagai penjaga regresi.
if ($SelfTest) {
  $selfTestCode = Invoke-FirewallSelfTest
  exit $selfTestCode
}

$transcriptStarted = $false
try {
  try { Start-Transcript -Path $ReportPath -Force | Out-Null; $transcriptStarted = $true } catch { }
  $startedAt = Get-Date

  Write-Host ''
  Write-Host '  BEJO Digital Print - DIAGNOSTIK VPS TERPADU (status + diagnosa)' -ForegroundColor White
  Write-Host "  Waktu     : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  Write-Host "  AppDir    : $AppDir"
  Write-Host "  Domain    : $Domain"
  Write-Host "  Laporan   : $ReportPath"

  # ------------------------------------------------------------------
  Write-Section 'A. HOST, RUNTIME, DAN FRESHNESS DEPLOY'
  # ------------------------------------------------------------------
  try {
    $os = Get-CimInstance Win32_OperatingSystem
    Info ("OS: {0} (v{1})" -f $os.Caption, $os.Version)
    Info ("RAM: {0} GB | Uptime host: {1:N1} jam" -f ([math]::Round($os.TotalVisibleMemorySize / 1MB, 1)), ((Get-Date) - $os.LastBootUpTime).TotalHours)
  } catch { Warn 'Gagal membaca info OS.' }

  try {
    $drive = Get-PSDrive -Name C -ErrorAction Stop
    $script:DiskFreeGb = [math]::Round($drive.Free / 1GB, 1)
    if ($script:DiskFreeGb -lt 10) { Warn "Disk C: hanya $script:DiskFreeGb GB tersisa" } else { Ok "Disk C: tersisa $script:DiskFreeGb GB" }
  } catch { Warn 'Gagal membaca kapasitas disk C:.' }

  if (-not (Test-Path $AppDir)) {
    Fail "Folder aplikasi tidak ditemukan: $AppDir"
  } else { Ok "Folder aplikasi ada: $AppDir" }

  $envPath = Join-Path $AppDir '.env'
  if (Test-Path $envPath) {
    Ok ("File .env ada (diubah {0})" -f (Get-Item $envPath).LastWriteTime)
  } else { Fail "File .env tidak ditemukan: $envPath" }

  $serverCjs = Join-Path $AppDir 'dist\server.cjs'
  if (Test-Path $serverCjs) {
    Ok ("Bundle server ada (diubah {0})" -f (Get-Item $serverCjs).LastWriteTime)
  } else { Fail "Bundle server tidak ditemukan: $serverCjs (belum di-build?)" }

  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) { Ok ("Node.js: " + (& node -v 2>&1)) } else { Fail 'Node.js tidak ditemukan di PATH.' }

  $pkgPath = Join-Path $AppDir 'package.json'
  $(if (Test-Path $pkgPath) {
      try { $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json; Ok "package.json versi $($pkg.version)" } catch { Warn 'package.json tidak terbaca.' }
    } else { Warn 'package.json tidak ditemukan.' })

  if (Test-Path (Join-Path $AppDir '.git')) {
    try {
      $head = ((& git -C $AppDir rev-parse --short HEAD 2>&1) -join '').Trim()
      $isCommit = $head -match '^[0-9a-f]{7,40}$'
      $dirty = ((& git -C $AppDir status --porcelain 2>&1) | Measure-Object).Count
      if (-not $isCommit) {
        Info "Git tidak aktif di folder aplikasi (HEAD: $head); $dirty file berbeda."
      } else {
        $desc = ((& git -C $AppDir describe --tags --always 2>&1) -join '').Trim()
        Info "Git HEAD $head | describe $desc | file beda dengan HEAD: $dirty"
        # Versi di HEAD dibandingkan dengan source yang benar-benar terpasang.
        $headJson = ((& git -C $AppDir show 'HEAD:package.json' 2>&1) -join "`n")
        $headPkgVersion = ''
        if ($headJson.Trim().StartsWith('{')) {
          try { $headPkgVersion = ($headJson | ConvertFrom-Json).version } catch { }
        }
        if ($headPkgVersion -and $pkg -and ($headPkgVersion -ne $pkg.version)) {
          Info "Versi di HEAD git ($headPkgVersion) berbeda dari source terpasang ($($pkg.version)); di VPS ini wajar karena source disalin deploy, jadi jangan git pull."
        } elseif ($dirty -gt 0) {
          Info "$dirty file berbeda dengan HEAD. Di VPS ini wajar karena deploy menyalin source tanpa commit; di workstation berarti ada perubahan yang belum di-commit."
        }
      }
    } catch { Warn 'Tidak bisa membaca status git aplikasi.' }
  }

  # ------------------------------------------------------------------
  Write-Section 'B. KONFIGURASI .env (NILAI RAHASIA DISEMBUNYIKAN)'
  # ------------------------------------------------------------------
  $envInfo = Get-EnvInfo $envPath $AppDir
  if (-not $envInfo) {
    Fail 'Tidak dapat membaca .env lewat dotenv (Node atau paket dotenv tidak tersedia).'
    if ($script:EnvReadError) { Info (Redact ($script:EnvReadError.Substring(0, [Math]::Min(300, $script:EnvReadError.Length)))) }
  } else {
    foreach ($key in @('APP_URL', 'POCKETBASE_UPSTREAM', 'VITE_POCKETBASE_URL', 'PUBLIC_SITE', 'ALLOW_DEFAULT_STAFF_PASSWORDS', 'DEV_USERNAME')) {
      $info = $envInfo.$key
      if (-not $info.present) {
        # DEV_USERNAME punya bawaan di server (server/devAuth.ts), jadi absen
        # di .env bukan masalah selama nama developernya memang bawaan itu.
        if ($key -eq 'DEV_USERNAME') { Info 'Env DEV_USERNAME tidak diset; server memakai nama bawaannya.' }
        else { Warn "Env $key tidak ada di .env" }
      }
      elseif ([string]::IsNullOrWhiteSpace([string]$info.value)) { Warn "Env $key KOSONG" }
      else { Ok "Env $key = $($info.value)" }
    }
    foreach ($key in @('PB_SYNC_EMAIL', 'PB_SYNC_PASSWORD', 'PB_ADMIN_EMAIL', 'PB_ADMIN_PASSWORD', 'DEV_PASSWORD_HASH', 'APP_SESSION_SECRET', 'GEMINI_API_KEY', 'REMOTE_ACCESS_PASS')) {
      $info = $envInfo.$key
      if (-not $info.present) { Warn "Env $key tidak ada di .env" }
      elseif ($info.length -le 0) {
        if ($key -eq 'GEMINI_API_KEY') { Warn 'Env GEMINI_API_KEY KOSONG: usulan AI melalui server tidak aktif (aplikasi tetap jalan).' }
        else { Warn "Env $key KOSONG" }
      }
      else { Ok ("Env $key terisi (panjang {0}, nilai disembunyikan)" -f $info.length) }
    }
    foreach ($legacy in @('VITE_PB_SYNC_EMAIL', 'VITE_PB_SYNC_PASSWORD')) {
      $info = $envInfo.$legacy
      if ($info.present -and $info.length -gt 0) {
        Warn "$legacy masih ada di .env. Variabel VITE_ ikut dibundel ke browser; hapus barisnya (kredensial sinkronisasi yang dipakai server adalah PB_SYNC_*)."
      }
    }
    if (([string]$envInfo.ALLOW_DEFAULT_STAFF_PASSWORDS.value).Trim().ToLower() -eq 'true') {
      Warn 'ALLOW_DEFAULT_STAFF_PASSWORDS=true (password default publik diizinkan).'
    }
  }

  # ------------------------------------------------------------------
  Write-Section 'C. SERVICE, PROSES, DAN PORT'
  # ------------------------------------------------------------------
  $services = Get-Service -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match '(?i)pocketbase|bejo|caddy' -or $_.DisplayName -match '(?i)pocketbase|bejo|digital print|caddy'
  }
  if ($services) {
    foreach ($svc in $services) {
      if ($svc.Status -eq 'Running') { Ok ("Service $($svc.Name) [$($svc.DisplayName)] = $($svc.Status)") }
      else { Fail ("Service $($svc.Name) [$($svc.DisplayName)] = $($svc.Status)") }
    }
  } else {
    Warn 'Tidak ada service PocketBase/Bejo/Caddy yang terdeteksi (mungkin dijalankan lewat PM2/manual).'
  }

  foreach ($procName in @('node', 'pocketbase', 'caddy')) {
    $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($procs) {
      foreach ($p in $procs) {
        $started = ''
        try { if ($p.StartTime) { $started = " | start $($p.StartTime)" } } catch { }
        Ok ("Proses $procName (PID $($p.Id), RAM {0:N0} MB{1})" -f ($p.WorkingSet64 / 1MB), $started)
      }
    } else {
      Warn "Proses $procName tidak berjalan."
    }
  }

  if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    try {
      $pm2Raw = (& pm2 jlist 2>$null) -join ''
      $pm2Apps = $pm2Raw | ConvertFrom-Json
      if ($pm2Apps) {
        foreach ($app in $pm2Apps) {
          $state = $app.pm2_env.status
          $line = "PM2 $($app.name): $state | restarts $($app.pm2_env.restart_time) | uptime {0:N0} menit | RAM {1:N0} MB" -f (((Get-Date).ToUniversalTime().ToUnixTimeMilliseconds() - [int64]$app.pm2_env.pm_uptime) / 60000), ($app.monit.memory / 1MB)
          if ($state -eq 'online') { Ok $line } else { Fail $line }
          if ([int]$app.pm2_env.restart_time -gt 5) { Warn "PM2 $($app.name) sudah restart $($app.pm2_env.restart_time) kali (cek log)." }
        }
      } else { Info 'PM2 tidak mengelola proses apa pun.' }
    } catch { Warn 'Gagal membaca daftar PM2.' }
  }

  foreach ($port in @(3000, 8090, 80, 443)) {
    try {
      $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
      foreach ($c in $conns) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        Ok ("Port $port LISTEN (PID $($c.OwningProcess) $($proc.ProcessName)) di $($c.LocalAddress)")
      }
    } catch {
      Warn "Tidak ada yang mendengarkan port $port."
    }
  }

  # ------------------------------------------------------------------
  Write-Section 'D. ENDPOINT LOKAL (DARI DALAM VPS)'
  # ------------------------------------------------------------------
  $localPb = Get-Endpoint "$LocalPbUrl/api/health" 10
  if ($localPb.Ok) { Ok ("PocketBase lokal: HTTP $($localPb.Status) dalam $($localPb.Ms) ms") }
  else { Fail ("PocketBase lokal TIDAK merespons ($LocalPbUrl): $($localPb.Error)") }

  $localApp = Get-Endpoint "$LocalAppUrl/api/health" 20
  if ($localApp.Ok) {
    Ok ("Aplikasi lokal: HTTP $($localApp.Status) dalam $($localApp.Ms) ms")
    try {
      $hj = $localApp.Body | ConvertFrom-Json
      Info ("Versi app: $($hj.version) | uptime server: $([math]::Round($hj.uptimeSeconds/3600,1)) jam | mode: $($hj.mode)")
      if ($hj.pocketbase.reachable -eq $true) { Ok ("Server -> PocketBase reachable (latency $($hj.pocketbase.latencyMs) ms, realtime $($hj.pocketbase.realtimeStream))") }
      else { Fail ("Server -> PocketBase TIDAK reachable: $($hj.pocketbase.error)") }
      if ($pkg -and $hj.version -and ($hj.version -ne $pkg.version)) {
        Warn "Versi live $($hj.version) berbeda dari package.json $($pkg.version) (deploy belum/berlebih)."
      }
    } catch { Warn 'Respons /api/health lokal bukan JSON yang valid.' }
  } else {
    Fail ("Aplikasi lokal TIDAK merespons ($LocalAppUrl): $($localApp.Error)")
  }

  $localMe = Get-Endpoint "$LocalAppUrl/api/auth/me" 10
  if ($localMe.Ok) { Ok ("Route sesi lokal hidup: HTTP $($localMe.Status)") } else { Warn ("Route /api/auth/me lokal: $($localMe.Error)") }

  $localDiag = Get-Endpoint "$LocalAppUrl/api/backend/diagnostics" 15
  if ($localDiag.Ok) {
    try {
      $dj = $localDiag.Body | ConvertFrom-Json
      Info ("Diagnostics server: status=$($dj.status) | RAM heap $($dj.memoryUsageMb) MB | error aktif $($dj.unresolvedCount)")
      if ([int]$dj.unresolvedCount -gt 0) { Warn "$($dj.unresolvedCount) error backend belum diselesaikan (lihat panel Auto-Fix)." }
    } catch { }
  }

  # ------------------------------------------------------------------
  Write-Section 'E. ENDPOINT PUBLIK (HTTPS/CADDY)'
  # ------------------------------------------------------------------
  foreach ($url in @("https://$Domain/api/health", "https://$Domain/api/pb/api/health", "https://$Domain/api/auth/me")) {
    $r = Get-Endpoint $url 25
    if ($r.Ok) { Ok ("$url -> HTTP $($r.Status) dalam $($r.Ms) ms") }
    else { Fail ("$url -> GAGAL: $($r.Error)") }
  }

  $cert = Get-TlsCertificate $Domain
  $certSource = 'jalur HTTPS'
  if (-not $cert) {
    $cert = Get-CaddyStoredCertificate $CaddyDir $Domain
    $certSource = 'berkas sertifikat Caddy di disk'
  }
  if ($cert) {
    $daysLeft = [math]::Round(($cert.NotAfter - (Get-Date)).TotalDays, 0)
    if ($daysLeft -lt 14) { Warn "Sertifikat TLS $Domain tersisa $daysLeft hari (NotAfter $($cert.NotAfter), dibaca dari $certSource)." }
    else { Ok "Sertifikat TLS $Domain valid sampai $($cert.NotAfter) ($daysLeft hari, dibaca dari $certSource)" }
  } else { Warn "Tidak bisa membaca sertifikat TLS $Domain (jalur HTTPS gagal dan tidak ada cert.pem di folder Caddy)." }

  # ------------------------------------------------------------------
  Write-Section 'F. INTEGRITAS AKUN SINKRONISASI & DIREKTORI (READ-ONLY)'
  # ------------------------------------------------------------------
  $nodeResult = $null
  $tmpNode = Join-Path $AppDir ".tmp-diagnose-live-$stamp.mjs"
  if ($SkipAccounts) {
    Info 'Seksi F dilewati (-SkipAccounts): integritas akun sinkronisasi tidak diperiksa.'
  } elseif (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js tidak tersedia; pemeriksaan akun sinkronisasi dilewati.'
  } elseif (-not (Test-Path (Join-Path $AppDir 'node_modules\pocketbase'))) {
    Fail 'Paket pocketbase tidak ditemukan di node_modules; pemeriksaan akun dilewati.'
  } else {
    $nodeScript = @'
import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

const [envPath, pbUrl] = process.argv.slice(2);
const out = { pbUrl, generatedAt: new Date().toISOString(), sync: {}, admin: {}, users: {}, appUsers: {}, collections: {}, risk: {}, logs: {} };
// dotenv dipakai apa adanya supaya hasilnya sama dengan server POS. Parser
// buatan sendiri tidak menangani escape (\" dan \\) sehingga password ber-escape
// dikirim salah dan login admin dilaporkan gagal padahal kredensialnya benar.
let env = {};
try {
  env = { ...(dotenv.config({ path: envPath, override: true, quiet: true }).parsed || {}) };
} catch (e) {
  out.envError = String(e?.message || e);
}
if (!/^https?:\/\//i.test(String(pbUrl || ''))) {
  out.configError = `URL PocketBase tidak valid: "${pbUrl}"`;
}

const syncEmail = (env.PB_SYNC_EMAIL || '').trim().toLowerCase();
const syncPass = env.PB_SYNC_PASSWORD || '';
out.sync.configured = Boolean(syncEmail && syncPass);
out.sync.emailDomain = syncEmail.includes('@') ? syncEmail.split('@')[1] : null;

const newClient = () => { const pb = new PocketBase(pbUrl); pb.autoCancellation(false); return pb; };
// Pesan SDK "Something went wrong." tidak memberi tahu apakah itu 400 (kredensial)
// atau jaringan; status dan pesan asli diteruskan agar tidak salah diagnosa.
const brief = (e) => {
  const status = Number(e?.status) || 0;
  const original = String(e?.originalError?.message || '').trim();
  const message = String(e?.message || e || '').trim() || 'galat tanpa pesan';
  if (status) return original && original !== message ? `${status} ${message} (${original})` : `${status} ${message}`;
  return original ? `jaringan ${original}` : message;
};

try {
  const auth = await newClient().collection('users').authWithPassword(syncEmail, syncPass);
  out.sync.auth = 'OK';
  try {
    const payload = JSON.parse(Buffer.from(auth.token.split('.')[1], 'base64url').toString('utf8'));
    out.sync.tokenExpiresInMinutes = Math.round((payload.exp * 1000 - Date.now()) / 60000);
  } catch {}
  out.sync.record = {
    id: auth.record.id,
    email: auth.record.email,
    emailMatchesEnv: String(auth.record.email || '').toLowerCase() === syncEmail,
    username: auth.record.username ?? null,
    role: auth.record.role ?? null,
    isActive: auth.record.isActive ?? null,
    verified: auth.record.verified ?? null,
    legacyId: auth.record.legacyId ?? null,
  };
} catch (e) {
  out.sync.auth = 'FAIL';
  out.sync.error = brief(e);
}

const adminEmail = (env.PB_ADMIN_EMAIL || '').trim();
const adminPass = env.PB_ADMIN_PASSWORD || '';
out.admin.configured = Boolean(adminEmail && adminPass);
let adminPb = null;
if (out.admin.configured) {
  adminPb = newClient();
  try {
    await adminPb.collection('_superusers').authWithPassword(adminEmail, adminPass);
    out.admin.auth = 'OK';
  } catch (e1) {
    try {
      if (adminPb.admins?.authWithPassword) {
        await adminPb.admins.authWithPassword(adminEmail, adminPass);
        out.admin.auth = 'OK (legacy admins)';
      } else {
        out.admin.auth = 'FAIL';
        out.admin.error = brief(e1);
        adminPb = null;
      }
    } catch (e2) {
      out.admin.auth = 'FAIL';
      out.admin.error = brief(e2);
      adminPb = null;
    }
  }
} else {
  out.admin.auth = 'SKIPPED';
}

if (adminPb) {
  let userRows = [];
  let dirRows = [];
  try {
    userRows = await adminPb.collection('users').getFullList({
      fields: 'id,email,username,name,role,isActive,verified,legacyId,appPassword,created,updated',
      requestKey: null,
    });
  } catch (e) {
    out.users.error = `${e?.status || ''} ${e?.message || e}`.trim();
  }
  try {
    dirRows = await adminPb.collection('app_users').getFullList({ requestKey: null });
  } catch (e) {
    out.appUsers.error = `${e?.status || ''} ${e?.message || e}`.trim();
  }

  out.users.total = userRows.length;
  const syncMatches = userRows.filter((r) =>
    String(r.email || '').toLowerCase() === syncEmail ||
    String(r.username || '').toLowerCase() === 'sync' ||
    /sync/i.test(String(r.name || ''))
  );
  out.users.syncMatches = syncMatches.map((r) => ({
    id: r.id,
    email: r.email,
    username: r.username ?? null,
    role: r.role ?? null,
    isActive: r.isActive ?? null,
    verified: r.verified ?? null,
    legacyId: r.legacyId ?? null,
    updated: r.updated,
  }));
  out.sync.accountFoundByAdmin = syncMatches.some((r) => String(r.email || '').toLowerCase() === syncEmail);
  out.sync.accountFoundByIdentity = syncMatches.length > 0;
  out.sync.emailMismatch = !out.sync.accountFoundByAdmin && syncMatches.length > 0;

  const emailCounts = new Map();
  for (const r of userRows) {
    const e = String(r.email || '').toLowerCase();
    if (e) emailCounts.set(e, (emailCounts.get(e) || 0) + 1);
  }
  out.users.duplicateEmails = [...emailCounts.entries()].filter(([, n]) => n > 1).map(([email, count]) => ({ email, count }));

  const usersByUsername = new Map();
  for (const r of userRows) {
    const u = String(r.username || '').toLowerCase();
    if (u) usersByUsername.set(u, (usersByUsername.get(u) || 0) + 1);
  }
  out.users.duplicateUsernames = [...usersByUsername.entries()].filter(([, n]) => n > 1).map(([username, count]) => ({ username, count }));

  // Record lama masih menyimpan password plaintext di `appPassword`, dan
  // verifikasi login memakai field itu lebih dulu. Bila tidak dikosongkan,
  // password baru dari Developer tidak pernah berlaku — login tetap memakai
  // password lama. Nilai tidak pernah dicetak, hanya keberadaannya.
  out.users.legacyPlaintextPasswords = userRows
    .filter((r) => String(r.appPassword || '').length > 0)
    .map((r) => ({
      id: r.id,
      email: r.email,
      username: r.username ?? null,
      updated: r.updated,
    }));

  out.appUsers.total = dirRows.length;
  const dirOf = (r) => {
    const m = r?.data && typeof r.data === 'object' ? r.data : {};
    return {
      recordId: r?.id ?? null,
      legacyId: r?.legacyId || m.id || null,
      username: r?.username || m.username || null,
      authId: r?.authId || m.authId || null,
      role: r?.role || m.role || null,
      mustChangePassword: r?.mustChangePassword === true || m.mustChangePassword === true,
      updated: r?.updated || null,
    };
  };
  const dirs = dirRows.map(dirOf);
  const syncAuthId = out.sync.record?.id || (syncMatches[0] && syncMatches[0].id) || null;

  out.risk.directoryRowsPointingToSync = syncAuthId
    ? dirs.filter((d) => d.authId === syncAuthId).map((d) => ({ legacyId: d.legacyId, username: d.username, recordId: d.recordId }))
    : [];
  out.risk.directoryRowsNamedSync = dirs.filter((d) => String(d.username || '').toLowerCase() === 'sync')
    .map((d) => ({ legacyId: d.legacyId, username: d.username, authId: d.authId, recordId: d.recordId }));
  out.risk.reservedIdsPresent = dirs.filter((d) => d.legacyId === 'user_dev' || d.legacyId === 'sys_core_developer')
    .map((d) => d.legacyId);

  const authIds = new Set(userRows.map((r) => r.id));
  out.risk.orphanDirectoryRows = authIds.size ? dirs.filter((d) => d.authId && !authIds.has(d.authId)).length : null;

  const dirNameCounts = new Map();
  for (const d of dirs) {
    const u = String(d.username || '').toLowerCase();
    if (u) dirNameCounts.set(u, (dirNameCounts.get(u) || 0) + 1);
  }
  out.appUsers.duplicateUsernames = [...dirNameCounts.entries()].filter(([, n]) => n > 1).map(([username, count]) => ({ username, count }));
  out.appUsers.recentlyUpdated = [...dirs]
    .filter((d) => d.updated)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
    .slice(0, 10)
    .map((d) => ({ legacyId: d.legacyId, username: d.username, role: d.role, mustChangePassword: d.mustChangePassword, updated: d.updated }));

  for (const name of ['users', 'app_users']) {
    try {
      const c = await adminPb.collections.getOne(name);
      out.collections[name] = {
        fields: (c.fields || []).map((f) => f.name),
        listRule: c.listRule,
        viewRule: c.viewRule,
        createRule: c.createRule,
        updateRule: c.updateRule,
        deleteRule: c.deleteRule,
      };
    } catch (e) {
      out.collections[name] = { error: `${e?.status || ''} ${e?.message || e}`.trim() };
    }
  }
  try {
    const names = (await adminPb.collections.getFullList({ fields: 'name', requestKey: null })).map((c) => c.name);
    // Daftar koleksi wajib. Tambah koleksi baru di aplikasi -> tambah namanya di
    // sini dan di scripts/create-pocketbase-collections.mjs; tanpa koleksi di
    // server, tulis cloud gagal dan data hanya tersimpan di perangkat.
    const required = [
      'products', 'product_categories', 'customers', 'customer_categories',
      'suppliers', 'agents', 'transactions', 'shifts', 'stock_transactions',
      'asset_adjustments', 'reconciliation_runs',
      'users', 'app_users', 'cashiers', 'activity_logs', 'settings',
      'store_profiles', 'custom_roles', 'agent_notifications',
      'spk_orders', 'machines', 'invoices', 'invoice_settings',
      'taxpayer_profile', 'tax_annual_returns', 'tax_monthly_billings',
    ];
    out.collections.missing = required.filter((n) => !names.includes(n));
    out.collections.total = names.length;
  } catch (e) {
    out.collections.listError = `${e?.status || ''} ${e?.message || e}`.trim();
  }

  // Isi berkas database sekunder (auxiliary.db pada PocketBase 0.28) tidak boleh
  // disimpulkan dari namanya. Volume log permintaan diukur lewat API resmi memakai
  // token admin yang sudah ada; kegagalan dicatat apa adanya, bukan dianggap nol.
  out.logs.available = false;
  const authHeader = { Authorization: adminPb.authStore.token };
  const logPage = async (params) => {
    const res = await fetch(`${pbUrl}/api/logs/records?${params}`, { headers: authHeader });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    return res.json();
  };
  try {
    let page;
    try {
      page = await logPage('perPage=1&sort=-@created');
    } catch {
      page = await logPage('perPage=1');
    }
    out.logs.available = true;
    out.logs.totalItems = Number(page.totalItems ?? 0);
    out.logs.newest = page.items?.[0]?.created ?? null;
  } catch (e) {
    out.logs.error = String(e?.message || e).slice(0, 200);
  }
  try {
    const res = await fetch(`${pbUrl}/api/settings`, { headers: authHeader });
    if (res.ok) {
      const settings = await res.json();
      out.logs.settings = Object.fromEntries(Object.entries(settings).filter(([k]) => /log/i.test(k)));
    } else {
      out.logs.settingsError = `${res.status} ${(await res.text()).slice(0, 160)}`;
    }
  } catch (e) {
    out.logs.settingsError = String(e?.message || e).slice(0, 200);
  }
}

console.log(JSON.stringify(out, null, 2));
'@

    try {
      [System.IO.File]::WriteAllText($tmpNode, $nodeScript, [System.Text.UTF8Encoding]::new($false))
      $run = Invoke-NodeScript $tmpNode @($envPath, $LocalPbUrl)
      $raw = [string]$run.Out
      $first = $raw.IndexOf('{')
      $last = $raw.LastIndexOf('}')
      if ($first -ge 0 -and $last -gt $first) { $raw = $raw.Substring($first, $last - $first + 1) }
      try {
        $nodeResult = $raw | ConvertFrom-Json
        [System.IO.File]::WriteAllText($JsonPath, $raw, [System.Text.UTF8Encoding]::new($false))
        Ok "Pemeriksaan akun selesai (detail JSON: $JsonPath)"
      } catch {
        Fail 'Hasil pemeriksaan akun bukan JSON valid.'
        if ($run.Err) { Info ('Node: ' + $run.Err.Substring(0, [Math]::Min(500, $run.Err.Length))) }
        Info ('Output: ' + $raw.Substring(0, [Math]::Min(500, $raw.Length)))
      }
    } finally {
      Remove-Item -LiteralPath $tmpNode -Force -ErrorAction SilentlyContinue
    }
  }

  if ($nodeResult) {
    if (-not $nodeResult.sync.configured) {
      Fail 'PB_SYNC_EMAIL/PB_SYNC_PASSWORD kosong: broker sesi PocketBase akan menolak (aplikasi Mode Lokal).'
    } elseif ($nodeResult.sync.auth -eq 'OK') {
      Ok ("Login akun sinkronisasi BERHASIL (email domain $($nodeResult.sync.emailDomain), aktif=$($nodeResult.sync.record.isActive), token sisa $($nodeResult.sync.tokenExpiresInMinutes) menit)")
      if ($nodeResult.sync.record.emailMatchesEnv -eq $false) {
        Fail "Email akun sinkronisasi di PocketBase BERBEDA dari PB_SYNC_EMAIL (kemungkinan diubah restore/reset)."
      }
    } else {
      Fail "Login akun sinkronisasi GAGAL: $($nodeResult.sync.error) -> broker /api/pocketbase/session akan 503 dan aplikasi masuk Mode Lokal."
    }

    if ($nodeResult.admin.auth -eq 'OK' -or $nodeResult.admin.auth -eq 'OK (legacy admins)') {
      Ok "Login admin PocketBase berhasil ($($nodeResult.admin.auth))"
      Info "Jumlah record users: $($nodeResult.users.total) | app_users: $($nodeResult.appUsers.total)"
      if ($nodeResult.sync.accountFoundByAdmin -eq $true) { Ok 'Akun sinkronisasi ditemukan di koleksi users dengan email yang cocok.' }
      elseif ($nodeResult.sync.accountFoundByIdentity -eq $true) { Fail 'Akun mirip sinkronisasi ditemukan tetapi emailnya TIDAK cocok dengan PB_SYNC_EMAIL.' }
      else { Fail 'Akun sinkronisasi TIDAK ditemukan di koleksi users.' }

      $syncedUsers = @($nodeResult.users.syncMatches)
      if ($syncedUsers.Count -gt 0) {
        Info "Kandidat sinkronisasi: $(($syncedUsers | ForEach-Object { "$($_.username)/$($_.email) active=$($_.isActive) verified=$($_.verified)" }) -join ' ; ')"
      }

      $dirSync = @($nodeResult.risk.directoryRowsPointingToSync)
      if ($dirSync.Count -gt 0) {
        Fail "KRITIS: $($dirSync.Count) baris app_users menunjuk record auth akun sinkronisasi -> reset/restore pada baris itu memutus SELURUH aplikasi dari PocketBase."
        $dirSync | ForEach-Object { Info "  - legacyId=$($_.legacyId) username=$($_.username) recordId=$($_.recordId)" }
      } else { Ok 'Tidak ada baris direktori yang menunjuk akun sinkronisasi.' }

      $dirNamedSync = @($nodeResult.risk.directoryRowsNamedSync)
      if ($dirNamedSync.Count -gt 0) {
        Warn "$($dirNamedSync.Count) baris app_users bernama 'sync' (harusnya tidak ada di direktori staf)."
        $dirNamedSync | ForEach-Object { Info "  - legacyId=$($_.legacyId) authId=$($_.authId) recordId=$($_.recordId)" }
      }

      $reserved = @($nodeResult.risk.reservedIdsPresent)
      if ($reserved.Count -gt 0) { Warn "Baris direktori id terlarang ditemukan: $($reserved -join ', ')" }

      if ($null -ne $nodeResult.risk.orphanDirectoryRows -and [int]$nodeResult.risk.orphanDirectoryRows -gt 0) {
        Warn "$($nodeResult.risk.orphanDirectoryRows) baris app_users menunjuk record auth yang sudah tidak ada (sisa restore)."
      }

      $dupUsers = @($nodeResult.users.duplicateUsernames)
      $dupEmails = @($nodeResult.users.duplicateEmails)
      $dupDir = @($nodeResult.appUsers.duplicateUsernames)
      if ($dupUsers.Count -gt 0) { Warn "Username ganda di users: $(($dupUsers | ForEach-Object { "$($_.username)x$($_.count)" }) -join ', ')" }
      if ($dupEmails.Count -gt 0) { Warn "Email ganda di users: $(($dupEmails | ForEach-Object { "$($_.email)x$($_.count)" }) -join ', ')" }
      if ($dupDir.Count -gt 0) { Warn "Username ganda di app_users: $(($dupDir | ForEach-Object { "$($_.username)x$($_.count)" }) -join ', ')" }

      $rules = $nodeResult.collections.app_users
      if ($rules -and -not $rules.error) {
        $writeRulesEmpty = [string]::IsNullOrEmpty([string]$rules.createRule) -and [string]::IsNullOrEmpty([string]$rules.updateRule) -and [string]::IsNullOrEmpty([string]$rules.deleteRule)
        if ($writeRulesEmpty) { Ok 'Aturan tulis app_users tertutup untuk browser (hanya superuser) - sesuai desain.' }
        else { Warn "Aturan tulis app_users terbuka: create='$($rules.createRule)' update='$($rules.updateRule)' delete='$($rules.deleteRule)'." }
        if (($rules.fields -contains 'legacyId') -and ($rules.fields -contains 'authId')) { Ok 'Field app_users (legacyId/authId) lengkap.' }
        else { Fail 'Field app_users tidak lengkap (legacyId/authId) - koleksi perlu dibuat ulang lewat skrip koleksi.' }
      } elseif ($rules.error) { Fail "Tidak bisa membaca koleksi app_users: $($rules.error)" }

      if (@($nodeResult.collections.missing).Count -gt 0) {
        Fail "Koleksi wajib tidak ditemukan: $(@($nodeResult.collections.missing) -join ', ')"
      } else { Ok "Semua koleksi wajib ada (total $($nodeResult.collections.total) koleksi)." }

      $recent = @($nodeResult.appUsers.recentlyUpdated)
      if ($recent.Count -gt 0) {
        Info 'app_users terbaru diubah (indikasi aktivitas restore/profil):'
        $recent | ForEach-Object { Info "  - $($_.updated) | $($_.username) ($($_.role)) mustChangePassword=$($_.mustChangePassword)" }
      }

      $legacyPass = @($nodeResult.users.legacyPlaintextPasswords)
      if ($legacyPass.Count -gt 0) {
        Warn ("{0} record kredensial masih menyimpan password plaintext lama (appPassword): {1}" -f $legacyPass.Count, (($legacyPass | ForEach-Object { $_.username }) -join ', '))
        Info 'Login sekarang mengutamakan password yang di-hash PocketBase; salinan plaintext lama dikosongkan sendiri saat pemiliknya login. Untuk akun yang tidak pernah login lagi (mis. nama developer), kosongkan field appPassword record tersebut di Admin UI PocketBase.'
      } else {
        Ok 'Tidak ada record kredensial yang menyimpan password plaintext lama (appPassword).'
      }
    } elseif ($nodeResult.admin.auth -eq 'SKIPPED') {
      Warn 'PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD tidak diset: pemeriksaan users/app_users mendalam dilewati.'
    } else {
      Warn "Login admin PocketBase gagal ($($nodeResult.admin.error)): pemeriksaan mendalam dilewati."
    }
  }

  # ------------------------------------------------------------------
  Write-Section 'G. DATA POCKETBASE, BACKUP, DAN RISIKO RESTORE'
  # ------------------------------------------------------------------
  $pbDataCandidates = @('C:\pocketbase\pb_data', (Join-Path $AppDir 'pb_data'))
  $pbData = $pbDataCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($pbData) {
    Ok "Folder data PocketBase: $pbData"
    $pbFiles = @()
    foreach ($file in @('data.db', 'auxiliary.db', 'logs.db')) {
      $full = Join-Path $pbData $file
      if (-not (Test-Path -LiteralPath $full)) { continue }
      $item = Get-Item -LiteralPath $full
      $sizeMb = [math]::Round($item.Length / 1MB, 1)
      $pbFiles += [pscustomobject]@{ Name = $item.Name; Mb = $sizeMb }
      if ($sizeMb -gt 2048) { Warn "$($item.Name) $sizeMb MB (ubah $($item.LastWriteTime)) - pertimbangkan backup/arsip." }
      else { Info "$($item.Name) $sizeMb MB (ubah $($item.LastWriteTime))" }
    }

    # Berkas database yang membesar dilaporkan bersama sisa disk dan volume log
    # TERUKUR dari API. Tanpa angka itu skrip tidak boleh menyebut penyebabnya -
    # "isi auxiliary.db pasti log permintaan" hanya dugaan kalau tidak diukur.
    $logInfo = $null
    if ($nodeResult) { $logInfo = $nodeResult.logs }
    if ($logInfo -and [bool]$logInfo.available) {
      Info "Log permintaan PocketBase terukur: $($logInfo.totalItems) record (terbaru $($logInfo.newest))"
    }
    if ($logInfo -and $logInfo.settings) {
      $props = @($logInfo.settings.PSObject.Properties)
      if ($props.Count -gt 0) {
        Info ("Retensi log terbaca dari pengaturan server: {0}" -f (($props | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ' '))
      }
    }
    foreach ($f in $pbFiles) {
      if ($f.Mb -le 512) { continue }
      $pctDisk = 0
      if ($script:DiskFreeGb -gt 0) { $pctDisk = [math]::Round(100 * ($f.Mb / 1024) / $script:DiskFreeGb, 1) }
      if ($logInfo -and [bool]$logInfo.available) {
        Warn ("{0} {1} MB = {2}% dari sisa disk C: ({3} GB). Kalau bertambahnya dari log permintaan (lihat jumlah record di atas), perpendek retensinya di panel Logs PocketBase." -f `
          $f.Name, $f.Mb, $pctDisk, $script:DiskFreeGb)
      } else {
        $alasan = 'volume log belum terukur (pemeriksaan akun dilewati atau login admin gagal)'
        if ($logInfo -and $logInfo.error) { $alasan = "volume log gagal diukur: $($logInfo.error)" }
        Warn "$($f.Name) $($f.Mb) MB = $pctDisk% dari sisa disk C: ($($script:DiskFreeGb) GB); $alasan - isi berkas tidak disimpulkan."
      }
    }
    foreach ($db in @('data.db', 'auxiliary.db', 'logs.db')) {
      $wal = Join-Path $pbData "$db-wal"
      if (-not (Test-Path -LiteralPath $wal)) { continue }
      $walMb = [math]::Round((Get-Item -LiteralPath $wal).Length / 1MB, 1)
      if ($walMb -gt 200) { Warn "WAL $db-wal $walMb MB (checkpoint tertahan; cek disk/pembukaan koneksi)." }
      else { Info "WAL $db-wal $walMb MB" }
    }
  } else { Warn 'Folder data PocketBase tidak ditemukan di lokasi umum.' }

  $backupFiles = @()
  foreach ($dir in @($AppDir, (Join-Path $AppDir 'backups'))) {
    if (Test-Path $dir) {
      $backupFiles += Get-ChildItem -LiteralPath $dir -Filter 'backup_pos_*.json' -File -ErrorAction SilentlyContinue
    }
  }
  $backupFiles = $backupFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 5
  if ($backupFiles) {
    Info 'Backup JSON terbaru (sumber upload user):'
    foreach ($b in $backupFiles) {
      Info ("  - {0} | {1:N2} MB | {2}" -f $b.Name, ($b.Length / 1MB), $b.LastWriteTime)
      if ($b.Length -gt 150MB) { Warn "Backup $($b.Name) sangat besar ($([math]::Round($b.Length/1MB,1)) MB); restore dapat membebani PocketBase." }
    }
  } else { Info 'Tidak ada file backup_pos_*.json di folder aplikasi.' }

  # ------------------------------------------------------------------
  Write-Section 'H. LOG TERBARU (DIPINDAI, RAHASIA DISAMARKAN)'
  # ------------------------------------------------------------------
  $patterns = 'Failed to authenticate|Gagal membuat sesi layanan|Only superusers|Mode Lokal|Gagal terhubung|ECONNREFUSED|EADDRINUSE|ETIMEDOUT|ke database cloud terputus|restore|outbox|OOM|heap out of memory|unhandled|ECONNRESET'
  $logs = @(Find-LogFiles)
  if ($logs.Count -eq 0) {
    Warn 'Tidak ada file log yang ditemukan (cek konfigurasi PM2/NSSM).'
  } else {
    foreach ($log in $logs) {
      try {
        $tail = Get-Content -LiteralPath $log -Tail ([Math]::Max($LogLines, 60)) -ErrorAction Stop
        $hits = $tail | Select-String -Pattern $patterns
        Info ("Log $log (baris dipindai: $($tail.Count), cocok: $(@($hits).Count))")
        if (@($hits).Count -gt 0) {
          $hits | Select-Object -Last 5 | ForEach-Object { Info ('  > ' + (Redact ([string]$_.Line))) }
        if (@($hits) -and (@($hits) | Where-Object { $_.Line -match 'Failed to authenticate|Gagal membuat sesi layanan|ke database cloud terputus' })) {
          Warn "Log $([System.IO.Path]::GetFileName($log)) memuat kegagalan koneksi/autentikasi PocketBase."
        }
        if (@($hits) -and (@($hits) | Where-Object { $_.Line -match 'EADDRINUSE' })) {
          Warn "Log $([System.IO.Path]::GetFileName($log)) memuat EADDRINUSE: ada proses Node lain mencoba port 3000 di VPS (mis. npm run dev dijalankan bersamaan dengan service)."
        }
        if (@($hits) -and (@($hits) | Where-Object { $_.Line -match 'heap out of memory|OOM' })) {
          Warn "Log $([System.IO.Path]::GetFileName($log)) memuat kehabisan memori heap; service pernah restart karena Node dihentikan."
        }
        }
      } catch { Warn "Gagal membaca log $log" }
    }
  }

  # ------------------------------------------------------------------
  Write-Section 'I. PROVISIONING: SOFTWARE, FOLDER, SERVICE & FIREWALL'
  # ------------------------------------------------------------------
  if ($SkipProvisioning) {
    Info 'Seksi I dan J dilewati (-SkipProvisioning).'
  } else {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) { Ok ("npm: " + ((& npm -v 2>&1) -join '')) } else { Fail 'npm tidak ditemukan di PATH.' }

    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) { Ok ("git: " + ((& git --version 2>&1) -join '')) } else { Warn 'git tidak ditemukan di PATH (deploy memakai arsip GitHub, jadi tidak wajib).' }

    $caddyExe = Join-Path $CaddyDir 'caddy.exe'
    $caddyVer = Get-ExeVersion $caddyExe
    if ($caddyVer) { Ok "Caddy $caddyVer di $caddyExe" } elseif (Test-Path $caddyExe) { Ok "Caddy ada di $caddyExe (versi tidak terbaca dari file)" } else { Fail "Caddy tidak ada di $caddyExe" }

    $nssmExe = Join-Path $NssmDir 'nssm.exe'
    if (Test-Path $nssmExe) { Ok "NSSM ada di $nssmExe" } else { Warn "NSSM tidak ada di $NssmDir (service dibuat dengan cara lain?)" }

    $pbExe = Join-Path $PbDir 'pocketbase.exe'
    $pbVer = Get-ExeVersion $pbExe
    if (-not (Test-Path $pbExe)) { Fail "PocketBase tidak ada di $pbExe" }
    elseif (-not $pbVer) { Info "PocketBase ada di $pbExe; versinya tidak terbaca dari metadata file (binary Go), perbandingan dengan $ExpectedPbVersion dilewati." }
    elseif ($pbVer -notlike "*$ExpectedPbVersion*") { Warn "PocketBase terpasang $pbVer, seharusnya $ExpectedPbVersion." }
    else { Ok "PocketBase $pbVer di $pbExe" }

    try {
      $osInfo = Get-CimInstance Win32_OperatingSystem
      $cores = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
      $ramGb = [math]::Round($osInfo.TotalVisibleMemorySize / 1MB, 1)
      if ($ramGb -lt 4) { Warn "RAM $ramGb GB di bawah 4 GB; build npm di VPS berisiko gagal." } else { Ok "RAM $ramGb GB" }
      if ($cores -lt 2) { Warn "CPU $cores logical core (disarankan >= 2)." } else { Ok "CPU $cores logical core" }
    } catch { Warn 'Gagal membaca jumlah CPU/RAM untuk provisioning.' }

    $folderChecks = @(
      (Join-Path $AppDir 'dist'),
      (Join-Path $AppDir 'logs'),
      (Join-Path $AppDir 'node_modules'),
      (Join-Path $PbDir 'pb_data'),
      $CaddyDir,
      $BackupRoot
    )
    foreach ($dir in $folderChecks) {
      if (Test-Path $dir) { Ok "Folder ada: $dir" }
      elseif ($dir -eq $BackupRoot) { Warn "Folder backup tidak ada: $dir (deploy tidak bisa menaruh cadangan)." }
      else { Warn "Folder tidak ada: $dir" }
    }

    foreach ($svcName in @('BejoStikerPOS', 'Caddy', 'PocketBase')) {
      $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
      if (-not $svc) { Fail "Service Windows '$svcName' tidak terpasang."; continue }
      $detail = $null
      try { $detail = Get-CimInstance -ClassName Win32_Service -Filter "Name='$svcName'" -ErrorAction Stop } catch { Warn "Gagal membaca detail service $svcName." }
      if ($detail) {
        if ($detail.StartMode -eq 'Auto') { Ok "$svcName mulai otomatis (StartMode Auto)" }
        else { Warn "$svcName StartMode=$($detail.StartMode) - service tidak akan hidup sendiri setelah host restart." }
        $recovery = Get-RecoveryVerdict (Get-ServiceSupervision $svcName)
        switch ($recovery.Level) {
          'windows' {
            Ok "$svcName dipulihkan otomatis oleh Windows saat crash ($($recovery.Detail))"
          }
          'nssm' {
            Ok "$svcName dipulihkan otomatis oleh NSSM ($($recovery.Detail))"
          }
          'nssm-bawaan' {
            Ok "$svcName dipulihkan otomatis oleh NSSM ($($recovery.Detail)); cek nilainya dengan nssm get $svcName AppExit"
          }
          'nssm-dimatikan' {
            Warn "$svcName TIDAK dihidupkan ulang saat prosesnya mati (NSSM $($recovery.Detail)); kembalikan ke Restart pada nilai registri AppExit di subkey Parameters service ini, lalu nssm get $svcName AppExit untuk memastikan."
          }
          'tak terbaca' {
            Warn "$svcName aksi pemulihan TIDAK disimpulkan ($($recovery.Detail)) - jalankan skrip sebagai Administrator."
          }
          default {
            Warn "$svcName tidak dikelola NSSM dan tanpa restart otomatis Windows ($($recovery.Detail)); set lewat sc.exe failure $svcName reset=0 actions=restart/5000 atau pindahkan pemasangannya ke NSSM."
          }
        }
      }
    }

    $fwProfiles = @(Get-NetFirewallProfile -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' })
    if ($fwProfiles.Count -eq 0) {
      Warn 'Firewall Windows tidak aktif di profil mana pun - port 3000 dan 8090 terbuka ke internet bila security group VPS mengizinkan.'
    } else {
      Info ("Firewall aktif pada profil: {0}" -f (($fwProfiles | ForEach-Object { $_.Name }) -join ', '))
      $allowMaps = @()
      $allowRuleCount = 0
      $fwReadError = $null
      # -ErrorAction Stop di sini meninggalkan baris "PS>TerminatingError(...)"
      # di layar/laporan walau galatnya sudah ditangkap catch. ErrorRecord
      # dikumpulkan lewat -ErrorVariable dan stream-nya dibungkam, pesannya tetap
      # bisa dipakai untuk menjelaskan mengapa port tidak disimpulkan.
      $allowRules = @(Get-NetFirewallRule -Direction Inbound -Enabled True -Action Allow -ErrorVariable fwReadError -ErrorAction SilentlyContinue 2>$null)
      $allowRuleCount = $allowRules.Count
      if ($allowRuleCount -eq 0 -and $fwReadError) {
        $fwReadError = (@($fwReadError)[0].Exception.Message).Trim()
      } else {
        $fwReadError = $null
      }
      $allowMaps = @($allowRules | ForEach-Object {
        $rule = $_
        try {
          $portFilter = Get-NetFirewallPortFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop
          $addrFilter = Get-NetFirewallAddressFilter -AssociatedNetFirewallRule $rule -ErrorAction SilentlyContinue
          [pscustomobject]@{
            Name     = [string]$rule.DisplayName
            Protocol = [string]$portFilter.Protocol
            Ports    = (@($portFilter.LocalPort) -join ',')
            Remote   = (@($addrFilter.RemoteAddress) -join ',')
            Profile  = [string]$rule.Profile
            Rule     = $rule
          }
        } catch { }
      })
      $fwReadable = ($allowRuleCount -gt 0 -and @($allowMaps).Count -gt 0)
      if ($fwReadable) {
        Info "$($allowMaps.Count) dari $allowRuleCount aturan inbound Allow terbaca filter portnya."
      } elseif ($allowRuleCount -gt 0) {
        Warn "$allowRuleCount aturan inbound Allow ada tetapi filter portnya tidak terbaca (butuh Administrator); kesimpulan paparan port dilewati."
      } elseif ($fwReadError) {
        Warn "Aturan firewall tidak terbaca ($fwReadError) - jalankan skrip sebagai Administrator untuk menyimpulkan paparan port."
      }

      if ($fwReadable) {
        # Aturan Block dipakai untuk membedakan "tidak ada aturan sama sekali"
        # dari "memang sengaja diblokir" - dua kesimpulan yang berbeda bagi
        # operator, walau sama-sama aman.
        $blockMaps = @(Get-NetFirewallRule -Direction Inbound -Enabled True -Action Block -ErrorAction SilentlyContinue 2>$null | ForEach-Object {
          $rule = $_
          try {
            $portFilter = Get-NetFirewallPortFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop
            [pscustomobject]@{ Name = [string]$rule.DisplayName; Protocol = [string]$portFilter.Protocol; Ports = (@($portFilter.LocalPort) -join ',') }
          } catch { }
        })
        foreach ($p in @(3000, 8090)) {
          $candidates = @($allowMaps | Where-Object { Test-FwCouldExposePort $_ $p })
          $nilai = Get-FwPortAssessment $candidates
          $umum = $nilai.Umum
          $terikat = $nilai.Terikat
          $takTerbaca = $nilai.TakTerbaca
          $nameList = ((@($umum | Select-Object -First 5 | ForEach-Object { "$($_.Name) [$($_.Detail)]" }) -join ' | '))
          if ($umum.Count -gt 5) { $nameList += " (+$($umum.Count - 5) lainnya)" }
          if ($umum.Count -gt 0) {
            Fail "Port $p dibuka ke internet oleh aturan umum tanpa ikatan program: $nameList - hanya Caddy (80/443) yang boleh publik."
          } elseif ($takTerbaca.Count -gt 0) {
            $unknownList = ((@($takTerbaca | Select-Object -First 5 | ForEach-Object { $_.Name }) -join ' | '))
            if ($takTerbaca.Count -gt 5) { $unknownList += " (+$($takTerbaca.Count - 5) lainnya)" }
            Warn "Port $p TIDAK disimpulkan: $($takTerbaca.Count) aturan cocok port/profil/sumbernya tetapi ikatan program/service-nya tidak terbaca ($unknownList). Jalankan skrip sebagai Administrator, dan pastikan port dari luar sebelum menyebutnya aman atau bocor."
          } else {
            $blocked = @($blockMaps | Where-Object { (Test-FwTcpProtocol $_.Protocol) -and (Test-FwPortMatch $_.Ports $p) })
            $why = ''
            if ($blocked.Count -gt 0) { $why = " dan ada aturan Block eksplisit ($($blocked[0].Name))" }
            elseif ($terikat.Count -gt 0) {
              $contoh = (($terikat | Select-Object -First 2 | ForEach-Object { "$($_.Name) [$($_.Detail)]" }) -join '; ')
              $why = " ($($terikat.Count) aturan yang cocok portnya terikat program/paket/service, contoh: $contoh)"
            }
            Ok "Port $p tidak dibuka ke internet$why."
          }
        }
        foreach ($p in @(80, 443)) {
          $open = @($allowMaps | Where-Object { (Test-FwTcpProtocol $_.Protocol) -and (Test-FwPortMatch $_.Ports $p) })
          if ($open.Count -gt 0) { Ok "Port $p ada aturan Allow inbound." }
          else { Info "Tidak ada aturan Allow eksplisit untuk port $p (mungkin diizinkan lewat profil/security group VPS)." }
        }
      } else {
        Info 'Daftar port 80/443/3000/8090 tidak disimpulkan dari firewall pada run ini.'
      }
    }

    # ----------------------------------------------------------------
    Write-Section 'J. CADDYFILE, DNS, DAN ISI BUNDEL BROWSER'
    # ----------------------------------------------------------------
    $caddyfile = Join-Path $CaddyDir 'Caddyfile'
    $caddyfileRepo = Join-Path $AppDir 'deploy\Caddyfile.windows'
    $caddyText = ''
    if (Test-Path $caddyfile) {
      $caddyText = (Get-Content -LiteralPath $caddyfile -Raw -ErrorAction SilentlyContinue) -join ''
      Ok "Caddyfile ada: $caddyfile"
      if ($caddyText -notmatch [regex]::Escape($Domain)) { Fail "Domain $Domain tidak muncul di Caddyfile." } else { Ok "Domain $Domain terpasang di Caddyfile." }
      if ($caddyText -match '/api/pb') { Ok 'Jalur /api/pb ke PocketBase ada di Caddyfile.' } else { Fail 'Jalur /api/pb tidak ada - browser tidak akan pernah sampai PocketBase (Mode Lokal).' }
      if ($caddyText -match 'flush_interval\s+-1') { Ok 'flush_interval -1 aktif: SSE realtime tidak di-buffer Caddy.' } else { Warn 'flush_interval -1 tidak ditemukan di Caddyfile - perubahan realtime bisa tertahan di proxy.' }
      if (Test-Path $caddyfileRepo) {
        $repoText = (Get-Content -LiteralPath $caddyfileRepo -Raw -ErrorAction SilentlyContinue) -join ''
        $same = (($caddyText -replace '\r', '') -eq ($repoText -replace '\r', ''))
        if ($same) { Ok 'Caddyfile di server sama dengan berkas di repo.' }
        else { Warn 'Caddyfile di server berbeda dari deploy\Caddyfile.windows (server berubah manual atau repo belum dideploy).' }
      }
    } else { Fail "Caddyfile tidak ditemukan: $caddyfile" }

    try {
      $dnsIps = @((Resolve-DnsName -Name $Domain -Type A -ErrorAction Stop | Where-Object { $_.IPAddress }).IPAddress)
      if ($dnsIps.Count -eq 0) { Warn "DNS $Domain tidak mengembalikan record A." }
      else {
        Info "DNS A: $($dnsIps -join ', ')"
        $publicIp = ''
        try { $publicIp = ((Invoke-WebRequest -Uri 'https://api.ipify.org' -UseBasicParsing -TimeoutSec 8).Content).Trim() } catch { }
        if ($publicIp) {
          if ($dnsIps -contains $publicIp) { Ok "IP publik VPS ($publicIp) sama dengan DNS $Domain." }
          else { Warn "DNS $Domain menunjuk ke $(($dnsIps -join ',')) tetapi IP publik VPS ini $publicIp - cek A record atau apakah VPS ini memang yang melayani domain." }
        } else { Info 'IP publik VPS tidak terbaca (api.ipify.org gagal); perbandingan DNS dilewati.' }
      }
    } catch { Warn "Gagal resolve DNS $Domain." }

    $assetDir = Join-Path $AppDir 'dist\assets'
    if (Test-Path $assetDir) {
      $jsFiles = @(Get-ChildItem -LiteralPath $assetDir -Filter '*.js' -File -ErrorAction SilentlyContinue)
      $bundleText = ($jsFiles | ForEach-Object { (Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue) }) -join "`n"
      Info "Bundel browser: $($jsFiles.Count) file JS, $([math]::Round(($bundleText.Length/1MB),1)) MB."
      if ($bundleText -match '127\.0\.0\.1:8090' -or $bundleText -match 'http://localhost:3000' -or $bundleText -match 'http://localhost:8090') {
        Fail 'Bundel browser memuat URL localhost/127.0.0.1 untuk database - semua pengunjung akan jatuh ke Mode Lokal. Build dijalankan dengan .env yang salah.'
      } elseif ($bundleText -match [regex]::Escape("https://$Domain/api/pb")) {
        Ok 'Bundel browser memuat URL PocketBase publik.'
      } else {
        Warn 'URL PocketBase publik tidak ditemukan di bundel browser; periksa VITE_POCKETBASE_URL saat build.'
      }
      if ($bundleText -match '@bejo\.local') {
        Warn 'Bundel browser memuat email domain internal (@bejo.local) - kemungkinan kredensial sinkronisasi lama (VITE_PB_SYNC_*) ikut dibundel. Hapus variabel itu lalu build ulang.'
      } else {
        Ok 'Bundel browser tidak memuat kredensial/domain sinkronisasi internal.'
      }
    } else { Warn "Folder bundel tidak ada: $assetDir (belum build?)" }
  }

  # ------------------------------------------------------------------
  Write-Section 'K. RINGKASAN'
  # ------------------------------------------------------------------
  $duration = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1)
  Write-Host ("  OK: {0} | WARN: {1} | FAIL: {2} | durasi {3}s" -f $script:OkCount, $script:WarnCount, $script:FailCount, $duration) -ForegroundColor White
  if ($script:Actions.Count -gt 0) {
    Write-Host ''
    Write-Host '  Temuan yang perlu ditindaklanjuti:' -ForegroundColor Yellow
    $script:Actions | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
  }
  Write-Host ''
  Write-Host "  Laporan teks : $ReportPath" -ForegroundColor White
  if (Test-Path $JsonPath) {
    Write-Host "  Detail JSON  : $JsonPath" -ForegroundColor White
  } else {
    Write-Host '  Detail JSON  : tidak ditulis (seksi F dilewati atau gagal).' -ForegroundColor DarkGray
  }
  if ($script:FailCount -gt 0) {
    Write-Host '  VERDICT: ADA KEGAGALAN KRITIS - kirim file laporan untuk analisis.' -ForegroundColor Red
  } else {
    Write-Host '  VERDICT: Tidak ada kegagalan kritis.' -ForegroundColor Green
  }
} finally {
  if ($transcriptStarted) { try { Stop-Transcript | Out-Null } catch { } }
}

if ($script:FailCount -gt 0) { exit 1 }
if ($RequireClean -and $script:WarnCount -gt 0) {
  Write-Host '  (-RequireClean dipakai: ada WARN, exit code 2.)' -ForegroundColor Yellow
  exit 2
}
exit 0
