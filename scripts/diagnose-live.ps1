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
    - Satu-satunya permintaan yang mengubah keadaan server adalah login pada
      -ProbeSession (memakai kredensial yang diketik operator saat itu juga,
      input tersembunyi); ia memakan satu jatah percobaan login dan tidak
      menyentuh data toko.

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
    K. Sesi dashboard & rute private (pengukur penyebab 401)
    M. Data penjualan end-to-end (transactions/stock/spk/invoices)
    L. Ringkasan

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
    -SkipSales                   Lewati seksi M (pemeriksaan data penjualan)
    -SkipProvisioning            Lewati seksi I dan J (provisioning/Caddy/bundel)
    -RequireClean                Exit code 2 bila masih ada WARN (untuk CI/cron)
    -ProbeSession                Seksi K ditambah uji login DEVELOPER (input
                                 tersembunyi, nilai tidak pernah dicetak). Cookie
                                 dibawa dengan WebRequestSession - satu-satunya
                                 cara yang terbukti dikirim PowerShell 5.1 - lalu
                                 dibuktikan di /api/auth/me (gema sesi) dan di
                                 setiap rute private, lengkap dengan jumlah cookie
                                 yang benar-benar ikut terkirim.
                                 Memakan 1 jatah percobaan login di server.
    -SelfTest                    Uji logika penilaian port, aksi pemulihan
                                 service, dan gerbang sesi private dengan contoh
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
  [switch]$SkipSales,
  [switch]$SkipProvisioning,
  [switch]$RequireClean,
  [switch]$ProbeSession,
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
$SalesJsonPath = Join-Path $env:TEMP "bejo-diagnose-sales-$stamp.json"

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
const secret = ['PB_SYNC_EMAIL', 'PB_SYNC_PASSWORD', 'PB_ADMIN_EMAIL', 'PB_ADMIN_PASSWORD', 'DEV_PASSWORD_HASH', 'APP_SESSION_SECRET', 'GEMINI_API_KEY', 'REMOTE_ACCESS_PASS', 'JOURNAL_SESSION_SECRET'];
const legacy = ['VITE_PB_SYNC_EMAIL', 'VITE_PB_SYNC_PASSWORD'];
const out = {};
for (const key of [...plain, ...secret, ...legacy]) {
  const present = Object.prototype.hasOwnProperty.call(env, key);
  const raw = String(env[key] ?? '');
  out[key] = {
    present,
    length: raw.length,
    // Panjang nilai, termasuk setelah spasi dibuang. Yang terakhir ini persis
    // ukuran yang dipakai getSessionSecret() (String(process.env.X || '').trim())
    // untuk menilai kunci terisi atau tidak. Nilainya sendiri tidak pernah keluar.
    trimmed: raw.trim().length,
    value: plain.includes(key) ? raw : null,
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
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream.CanSeek) { [void]$stream.Seek(0, [System.IO.SeekOrigin]::Begin) }
        $reader = New-Object System.IO.StreamReader($stream)
        $body = [string]$reader.ReadToEnd()
      }
    } catch { $body = '' }
    # ErrorDetails didahulukan: di PowerShell 5.1 stream respons error sudah
    # dihabiskan Invoke-WebRequest, jadi body 401/403/404 terbaca kosong dan
    # skrip menyangka jawabannya bukan dari aplikasi.
    $body = Resolve-ResponseErrorBody ([string]$_.ErrorDetails.Message) ([string]$body)
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
# SEMUA kolom ikatan diperiksa, lewat pemindaian nama properti, bukan daftar
# kolom yang ditebak. Aturan bawaan Windows menyimpan ikatannya di kolom yang
# berbeda-beda: 'Remote Desktop - Shadow (TCP-In)' menulis svchost.exe di
# 'Application' sementara 'ApplicationName' kosong, dan aturan UWP seperti
# 'Desktop App Web Viewer' hanya mengisi 'Package'/'PackageSid'. Membaca sebagian
# kolom saja sudah tiga kali menghasilkan FAIL palsu "Port 3000/8090 dibuka ke
# internet" di VPS, padahal portnya tidak bisa tersambung dari luar.
function Get-FwScopeVerdict($binding) {
  if (-not $binding -or -not [bool]$binding.Readable) {
    return [pscustomobject]@{ State = 'tak terbaca'; Detail = 'ikatan program/paket/service tidak terbaca' }
  }
  $parts = @($binding.Parts | Where-Object { $_ })
  if ($parts.Count -gt 0) {
    return [pscustomobject]@{ State = 'terikat'; Detail = ($parts -join ', ') }
  }
  return [pscustomobject]@{ State = 'umum'; Detail = 'tanpa ikatan program/paket/service' }
}

function Test-FwCouldExposePort($map, [int]$port) {
  return (Test-FwTcpProtocol ([string]$map.Protocol)) -and (Test-FwPortMatch ([string]$map.Ports) $port) -and (Test-FwInternetRemote ([string]$map.Remote)) -and (Test-FwPublicProfile ([string]$map.Profile))
}

# Kolom yang boleh membatasi sebuah aturan. Nama kolom dibaca dari objek filter
# aslinya, BUKAN ditebak satu per satu: aturan bawaan Windows menyimpan ikatannya
# di kolom berbeda-beda (Shadow di 'Application' berupa path svchost.exe dengan
# 'ApplicationName' kosong; aturan UWP seperti 'Desktop App Web Viewer' di
# 'Package'/'PackageSid'; aturan service di 'Service'). Membaca hanya sebagian
# nama kolom sudah tiga kali menghasilkan FAIL palsu "Port 3000/8090 dibuka ke
# internet", jadi setiap kolom yang namanya mengandung ikatan ikut dipindai dan
# nama kolomnya ikut dicetak supaya laporan bisa dibaca ulang.
$FW_BINDING_PROPERTY_PATTERN = '^(Application|ApplicationName|ApplicationSecurity|Package|PackageId|PackageName|PackageSid|Service|User)$'

function Get-FwBindingParts($items) {
  $parts = @()
  foreach ($item in @($items)) {
    if (-not $item) { continue }
    foreach ($prop in @($item.PSObject.Properties)) {
      $nama = [string]$prop.Name
      if ($nama -notmatch $FW_BINDING_PROPERTY_PATTERN) { continue }
      $textValue = [string]$prop.Value
      if ([string]::IsNullOrWhiteSpace($textValue)) { continue }
      if (Test-FwUnrestrictedValue $textValue) { continue }
      $parts += ("{0}={1}" -f $nama, $textValue)
    }
  }
  return @($parts | Select-Object -Unique)
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
  $parts = @(Get-FwBindingParts $appFilter) + @(Get-FwBindingParts $svcFilter)
  return @{
    Readable = ($appFilter.Count -gt 0 -and -not $appErr -and -not $svcErr)
    Parts = @($parts | Where-Object { $_ })
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
    @{ n = 'path Application terisi = terikat (kasus aturan bawaan VPS)'; b = @{ Readable = $true; Parts = @('Application=C:\Windows\System32\svchost.exe') }; expect = 'terikat' },
    @{ n = 'hanya PackageId terisi = terikat'; b = @{ Readable = $true; Parts = @('PackageId=Microsoft.Windows.Cortana_cw5n1h2txyewy') }; expect = 'terikat' },
    @{ n = 'hanya Package/PackageSid terisi = terikat (bentuk aturan UWP)'; b = @{ Readable = $true; Parts = @('Package=MicrosoftWindows.Client.CBS_cw5n1h2txyewy', 'PackageSid=S-1-15-2-3235854242-2820777765') }; expect = 'terikat' },
    @{ n = 'hanya Service terisi = terikat'; b = @{ Readable = $true; Parts = @('Service=AllJoynRouterService') }; expect = 'terikat' },
    @{ n = 'nama program saja terisi = terikat'; b = @{ Readable = $true; Parts = @('ApplicationName=Desktop App Web Viewer') }; expect = 'terikat' },
    @{ n = 'semua kolom Any = pembuka port umum'; b = @{ Readable = $true; Parts = @() }; expect = 'umum' },
    @{ n = 'semua kolom kosong = pembuka port umum'; b = @{ Readable = $true; Parts = @() }; expect = 'umum' },
    @{ n = 'ikatan tidak terbaca = jangan menyimpulkan'; b = @{ Readable = $false; Parts = @() }; expect = 'tak terbaca' },
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
    'paket-uwp' = @([pscustomobject]@{ Application = 'Any'; ApplicationName = 'Any'; Package = 'MicrosoftWindows.Client.CBS_cw5n1h2txyewy'; PackageSid = 'S-1-15-2-3235854242-2820777765'; User = 'Any' })
    'bebas' = @([pscustomobject]@{ Application = 'Any'; ApplicationName = 'Any'; PackageId = 'Any' })
    'kosong' = @()
    'galat' = @()
  }
  $svcByRule = @{
    'hanya-path' = @([pscustomobject]@{ Service = 'Any' })
    'paket-saja' = @([pscustomobject]@{ Service = 'Any' })
    'paket-uwp' = @()
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
    @{ n = 'ikatan hanya di Package/PackageSid (bentuk Desktop App Web Viewer) masuk Terikat'; kunci = 'paket-uwp'; harus = 'Terikat'; mengandung = 'PackageSid' },
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

  # Sumber secret sesi: urutan prioritas dan keadaan "semua kosong" harus
  # dinilai sama seperti server/devAuth.ts, karena di situlah gejala 401
  # massal setelah restart lahir. Peta yang masuk adalah hasil pembacaan .env
  # (present + panjang setelah spasi dibuang), BUKAN nilai aslinya - nilai
  # rahasia tidak pernah keluar dari skrip ini.
  function SecretInfo([bool]$present, [int]$rawLength, [int]$trimmedLength) {
    return @{ present = $present; length = $rawLength; trimmed = $trimmedLength }
  }
  $secretCases = @(
    @{ n = 'APP_SESSION_SECRET menang atas fallback'; m = @{ APP_SESSION_SECRET = SecretInfo $true 15 15; JOURNAL_SESSION_SECRET = SecretInfo $false 0 0; PB_ADMIN_PASSWORD = SecretInfo $true 1 1; REMOTE_ACCESS_PASS = SecretInfo $true 1 1 }; harus = 'APP_SESSION_SECRET' },
    @{ n = 'tanpa APP_SESSION_SECRET memakai PB_ADMIN_PASSWORD'; m = @{ APP_SESSION_SECRET = SecretInfo $false 0 0; JOURNAL_SESSION_SECRET = SecretInfo $false 0 0; PB_ADMIN_PASSWORD = SecretInfo $true 1 1; REMOTE_ACCESS_PASS = SecretInfo $true 1 1 }; harus = 'PB_ADMIN_PASSWORD' },
    @{ n = 'hanya REMOTE_ACCESS_PASS pun dipakai'; m = @{ APP_SESSION_SECRET = SecretInfo $false 0 0; JOURNAL_SESSION_SECRET = SecretInfo $false 0 0; PB_ADMIN_PASSWORD = SecretInfo $false 0 0; REMOTE_ACCESS_PASS = SecretInfo $true 1 1 }; harus = 'REMOTE_ACCESS_PASS' },
    @{ n = 'baris ada tapi isinya hanya spasi = kosong (server melakukan trim)'; m = @{ APP_SESSION_SECRET = SecretInfo $true 3 0; JOURNAL_SESSION_SECRET = SecretInfo $false 0 0; PB_ADMIN_PASSWORD = SecretInfo $true 8 8; REMOTE_ACCESS_PASS = SecretInfo $false 0 0 }; harus = 'PB_ADMIN_PASSWORD' },
    @{ n = 'baris kosong tanpa nilai = kosong'; m = @{ APP_SESSION_SECRET = SecretInfo $true 0 0; JOURNAL_SESSION_SECRET = SecretInfo $true 0 0; PB_ADMIN_PASSWORD = SecretInfo $true 0 0; REMOTE_ACCESS_PASS = SecretInfo $true 0 0 }; harus = '' },
    @{ n = 'kunci absen sama sekali = kosong'; m = @{ PB_ADMIN_PASSWORD = SecretInfo $false 0 0 }; harus = '' },
    @{ n = 'JOURNAL_SESSION_SECRET sebelum PB_ADMIN_PASSWORD'; m = @{ APP_SESSION_SECRET = SecretInfo $false 0 0; JOURNAL_SESSION_SECRET = SecretInfo $true 1 1; PB_ADMIN_PASSWORD = SecretInfo $true 1 1; REMOTE_ACCESS_PASS = SecretInfo $true 1 1 }; harus = 'JOURNAL_SESSION_SECRET' },
    @{ n = 'peta dari ConvertFrom-Json (objek properti) juga dinilai'; m = [pscustomobject]@{ APP_SESSION_SECRET = [pscustomobject]@{ present = $true; length = 44; trimmed = 44 }; JOURNAL_SESSION_SECRET = [pscustomobject]@{ present = $false; length = 0; trimmed = 0 }; PB_ADMIN_PASSWORD = [pscustomobject]@{ present = $true; length = 8; trimmed = 8 }; REMOTE_ACCESS_PASS = [pscustomobject]@{ present = $false; length = 0; trimmed = 0 } }; harus = 'APP_SESSION_SECRET' }
  )
  foreach ($c in $secretCases) {
    $got = (Get-SessionSecretSource $c.m).Key
    if ([string]$got -eq [string]$c.harus) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (dapat='$got' harus='$($c.harus)')" -ForegroundColor Red; $failed++ }
  }

  # Penilaian probe rute private: yang diuji adalah PEMISAHAN antara gerbang
  # yang bekerja, rute yang hilang, rute yang bocor, dan lapisan di depan
  # Express. Tanpa ini, 401 di panel diagnostik selalu dibaca "server rusak".
  $probeCases = @(
    @{ n = '401 AUTH_REQUIRED tanpa cookie = gerbang benar'; s = 401; c = 'AUTH_REQUIRED'; w = $false; j = $true; ks = -1; harus = 'gerbang-sesi-benar' },
    @{ n = '401 AUTH_REQUIRED dengan cookie yang terbukti terkirim = cookie ditolak'; s = 401; c = 'AUTH_REQUIRED'; w = $true; j = $true; ks = 1; harus = 'cookie-ditolak' },
    @{ n = '401 dengan sesi tetapi 0 cookie terkirim = jangan disebut cookie ditolak'; s = 401; c = 'AUTH_REQUIRED'; w = $true; j = $true; ks = 0; harus = 'cookie-tidak-terkirim' },
    @{ n = '200 dengan sesi tetapi 0 cookie terkirim = jangan disebut terbuka dengan sesi'; s = 200; c = ''; w = $true; j = $true; ks = 0; harus = 'cookie-tidak-terkirim' },
    @{ n = 'CookieSent tidak diukur (-1) juga jangan disebut cookie ditolak'; s = 401; c = 'AUTH_REQUIRED'; w = $true; j = $true; ks = -1; harus = 'cookie-tidak-terkirim' },
    @{ n = '401 tanpa body JSON = ditahan sebelum Express'; s = 401; c = ''; w = $false; j = $false; ks = -1; harus = 'ditahan-sebelum-express' },
    @{ n = '404 = rute tidak ada di build yang jalan'; s = 404; c = ''; w = $false; j = $false; ks = -1; harus = 'rute-tidak-ada' },
    @{ n = '200 ber-body JSON tanpa cookie = rute bocor'; s = 200; c = ''; w = $false; j = $true; ks = -1; harus = 'rute-terbuka-tanpa-sesi' },
    @{ n = '200 tanpa body JSON = bukan jawaban Express, rute tidak dinilai'; s = 200; c = ''; w = $false; j = $false; ks = -1; harus = 'bukan-jawaban-api' },
    @{ n = '200 dengan cookie terkirim = rantai sesi utuh'; s = 200; c = ''; w = $true; j = $true; ks = 1; harus = 'rute-terbuka-dengan-sesi' },
    @{ n = '403 FORBIDDEN dengan cookie = sesi terbaca'; s = 403; c = 'FORBIDDEN'; w = $true; j = $true; ks = 1; harus = 'sesi-terbaca' },
    @{ n = '403 INVALID_ORIGIN dinilai terpisah'; s = 403; c = 'INVALID_ORIGIN'; w = $true; j = $true; ks = 1; harus = 'origin-ditolak' },
    @{ n = '429 = kuota login habis, rute tidak dinilai'; s = 429; c = 'RATE_LIMITED'; w = $true; j = $true; ks = 1; harus = 'kuota-login-habis' },
    @{ n = '500 = galat aplikasi, bukan gerbang sesi'; s = 500; c = ''; w = $false; j = $true; ks = -1; harus = 'server-galat' },
    @{ n = 'tanpa jawaban jangan disebut 401'; s = 0; c = ''; w = $false; j = $false; ks = -1; harus = 'tidak-merespons' }
  )
  foreach ($c in $probeCases) {
    $got = (Get-PrivateProbeVerdict -Status $c.s -Code $c.c -WithCookie $c.w -JsonBody $c.j -CookieSent ([int]$c.ks)).State
    if ([string]$got -eq [string]$c.harus) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (dapat='$got' harus='$($c.harus)')" -ForegroundColor Red; $failed++ }
  }
  # Penjaga TRANSPORT cookie. Kegagalannya tidak terlihat dari angka status:
  # header Cookie manual membuat probe anonim, dan 401 yang benar dari permintaan
  # anonim lalu dibaca sebagai "cookie ditolak server" (FAIL palsu di VPS
  # 2026-11-04). Karena itu cara kirim cookie ikut diperiksa dari sumber skrip,
  # sama seperti TTL diperiksa dari server/posAuth.ts.
  $sumberSkrip = ''
  try { $sumberSkrip = [string](Get-Content -LiteralPath $PSCommandPath -Raw -ErrorAction Stop) } catch { $sumberSkrip = '' }
  $transportCases = @(
    @{ n = 'probe rute private memakai -WebSession dari hasil login'; pola = 'Invoke-PrivateProbe -Url \(\$baseUrlLocal \+ \$route\) -WebSession \$login\.Session'; harus = $true },
    @{ n = 'probe cookie tidak lagi dikirim sebagai header Cookie manual'; pola = '-CookieHeader \(\[string\]\$login\.CookieHeader\)'; harus = $false },
    @{ n = 'Invoke-PrivateProbe tidak lagi menerima parameter CookieHeader sama sekali'; pola = 'param\(\[string\]\$Url, \[string\]\$CookieHeader'; harus = $false },
    @{ n = 'penilai menolak menyimpulkan cookie tanpa bukti terkirim'; pola = 'if \(\$WithCookie -and -not \(\$CookieSent -gt 0\)\)'; harus = $true },
    @{ n = 'login memakai WebRequestSession, bukan string cookie hasil regex'; pola = 'New-Object Microsoft\.PowerShell\.Commands\.WebRequestSession'; harus = $true }
  )
  foreach ($c in $transportCases) {
    $ada = ($sumberSkrip -match $c.pola)
    if ($ada -eq $c.harus) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (ada=$ada harus=$($c.harus))" -ForegroundColor Red; $failed++ }
  }
  # Kode dibaca dari body JSON, dan body non-JSON (halaman Caddy) tidak boleh
  # menghasilkan kode palsu.
  $codeCases = @(
    @{ n = 'code AUTH_REQUIRED terbaca dari body aplikasi'; b = '{"success":false,"code":"AUTH_REQUIRED","error":"x"}'; harus = 'AUTH_REQUIRED' },
    @{ n = 'html halaman Caddy tidak menghasilkan code'; b = '<html><body>401 Unauthorized</body></html>'; harus = '' },
    @{ n = 'code FORBIDDEN terbaca'; b = '{"code":"FORBIDDEN"}'; harus = 'FORBIDDEN' }
  )
  foreach ($c in $codeCases) {
    $got = Get-ResponseApiCode $c.b
    if ([string]$got -eq [string]$c.harus) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (dapat='$got' harus='$($c.harus)')" -ForegroundColor Red; $failed++ }
  }
  $ttlCases = @(
    @{ n = 'TTL 12 jam terbaca dari sumbernya'; t = 'const SESSION_TTL_SECONDS = 12 * 60 * 60;'; harus = 43200 },
    @{ n = 'TTL dua faktor terbaca'; t = 'const SESSION_TTL_SECONDS = 8 * 60 * 60;'; harus = 28800 },
    @{ n = 'pola tidak dikenal menghasilkan 0, bukan tebakan'; t = 'const SESSION_TTL_SECONDS = SOME_VAR;'; harus = 0 }
  )
  foreach ($c in $ttlCases) {
    $got = Get-SessionTtlSeconds $c.t
    if ([int]$got -eq [int]$c.harus) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (dapat=$got harus=$($c.harus))" -ForegroundColor Red; $failed++ }
  }
  # Pembacaan body respons error. Kasus pertama adalah yang benar-benar terjadi
  # saat mengukur 401 live: ErrorDetails berisi JSON aplikasi, stream kosong
  # karena sudah dihabiskan Invoke-WebRequest. Kalau urutannya dibalik, probe
  # membaca body kosong dan menyimpulkan "bukan jawaban aplikasi" - temuan palsu.
  $bodyCases = @(
    @{ n = 'ErrorDetails menang atas stream kosong (PowerShell 5.1)'; e = '{"code":"AUTH_REQUIRED"}'; s = ''; harus = '{"code":"AUTH_REQUIRED"}' },
    @{ n = 'ErrorDetails menang walau stream berisi lain'; e = '{"code":"AUTH_REQUIRED"}'; s = 'sisa stream'; harus = '{"code":"AUTH_REQUIRED"}' },
    @{ n = 'tanpa ErrorDetails stream dipakai (cadangan)'; e = ''; s = '{"code":"FORBIDDEN"}'; harus = '{"code":"FORBIDDEN"}' },
    @{ n = 'ErrorDetails hanya-spasi dianggap kosong'; e = '   '; s = 'halaman Caddy'; harus = 'halaman Caddy' },
    @{ n = 'dua-duanya kosong menghasilkan kosong, bukan tebakan'; e = ''; s = ''; harus = '' }
  )
  foreach ($c in $bodyCases) {
    $got = Resolve-ResponseErrorBody $c.e $c.s
    if ([string]$got -eq [string]$c.harus) { Write-Host "  OK   $($c.n)" -ForegroundColor Green }
    else { Write-Host "  FAIL $($c.n) (dapat='$got' harus='$($c.harus)')" -ForegroundColor Red; $failed++ }
  }
  # Rantai lengkap body -> kode -> penilaian, supaya urutan ErrorDetails terbukti
  # mengubah kesimpulan akhir, bukan hanya isi string tengah.
  $rantai = Resolve-ResponseErrorBody '{"success":false,"code":"AUTH_REQUIRED","error":"Silakan login ke dashboard terlebih dahulu."}' ''
  $verdictRantai = Get-PrivateProbeVerdict -Status 401 -Code (Get-ResponseApiCode $rantai) -WithCookie $false -JsonBody $true
  if ([string]$verdictRantai.State -eq 'gerbang-sesi-benar') {
    Write-Host "  OK   401 live terbaca sebagai gerbang sesi yang benar" -ForegroundColor Green
  } else {
    Write-Host "  FAIL 401 live terbaca sebagai '$($verdictRantai.State)' harus='gerbang-sesi-benar'" -ForegroundColor Red; $failed++
  }

  Remove-Item Function:Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue
  Remove-Item Function:Get-NetFirewallServiceFilter -ErrorAction SilentlyContinue
  if ($failed -gt 0) { Write-Host "  SELFTEST GAGAL: $failed kasus salah." -ForegroundColor Red; return 1 }
  Write-Host '  Semua kasus penilaian port firewall, aksi pemulihan service, gerbang sesi private, transportasi cookie, dan pembacaan body respons error lulus.' -ForegroundColor Green
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

# ---------------------------------------------------------------------
# Sesi dashboard & rute private (sumber gejala "401" di panel diagnostik).
#
# Panel diagnostik di browser membaca /api/backend/diagnostics. Rutenya masuk
# PRIVATE_API_PREFIXES di server.ts, jadi tanpa cookie sesi dashboard server
# menjawab 401 { code: AUTH_REQUIRED }. Angka 401 bukan otomatis kerusakan:
# yang memisahkan "gerbang bekerja" dari "deploy belum selesai" adalah body
# JSON-nya, dan itu dinilai per rute lewat Get-PrivateProbeVerdict.
#
# Sumber secret sesi dinilai persis seperti getSessionSecret() di
# server/devAuth.ts: urutan APP_SESSION_SECRET, JOURNAL_SESSION_SECRET,
# PB_ADMIN_PASSWORD, REMOTE_ACCESS_PASS, dan nilai whitespace dihitung kosong
# karena server memakai String(process.env.X || '').trim(). Peta yang masuk
# adalah HASIL PEMBACAAN .env (key -> @{present; length; trimmed}), bukan nilai
# aslinya: pembaca .env di skrip ini sengaja tidak pernah mengeluarkan nilai
# rahasia, jadi penilaiannya wajib memakai panjang setelah spasi dibuang.
# Kalau keempatnya kosong, server memakai secret acak per proses, sehingga
# SELURUH cookie sesi mati setiap service restart: aplikasi masih tampak login
# di perangkat (state login memang disimpan di sana) sementara semua rute
# private menjawab 401. Menyimpulkan "sesi kedaluwarsa" tanpa mengukur keempat
# kunci itu adalah tebakan, dan itu yang bikin temuan palsu.
# ---------------------------------------------------------------------
$SESSION_SECRET_KEYS = @('APP_SESSION_SECRET', 'JOURNAL_SESSION_SECRET', 'PB_ADMIN_PASSWORD', 'REMOTE_ACCESS_PASS')

function Get-SessionSecretSource($EnvInfo) {
  foreach ($key in $SESSION_SECRET_KEYS) {
    if ($EnvInfo -is [hashtable]) { $info = $EnvInfo[$key] } else { $info = $EnvInfo.$key }
    if ($info -and [int]$info.trimmed -gt 0) {
      return @{ Key = $key; Length = [int]$info.length }
    }
  }
  return @{ Key = ''; Length = 0 }
}

# Menilai satu hasil probe rute private dari status HTTP + bentuk body.
# 401 ber-code AUTH_REQUIRED = jawaban aplikasi (gerbang sesi); 401 tanpa body
# JSON = ditahan sebelum Express (Basic Auth Caddy); 403 ber-code FORBIDDEN
# justru bukti cookie terbaca karena perannya yang tidak cukup; 404 = rute
# tidak ada di build yang berjalan; 200 BERBODY JSON tanpa cookie = rute bocor;
# 200 tanpa body JSON = yang menjawab bukan Express (halaman SPA dev server
# atau proxy di depan), jadi rute tidak boleh dinyatakan terbuka maupun bocor.
# CookieSent = jumlah cookie yang benar-benar ikut terkirim; 0 artinya probe itu
# sebenarnya anonim dan jawabannya TIDAK boleh dibaca sebagai "cookie ditolak".
function Get-PrivateProbeVerdict {
  param([int]$Status, [string]$Code, [bool]$WithCookie, [bool]$JsonBody = $false, [int]$CookieSent = -1)
  $kode = ([string]$Code).Trim().ToUpper()
  if ($Status -eq 0) {
    return @{ Level = 'fail'; State = 'tidak-merespons'; Text = 'tidak ada jawaban dari server (service mati atau URL salah)' }
  }
  if ($Status -eq 429) {
    return @{ Level = 'warn'; State = 'kuota-login-habis'; Text = 'kuota percobaan login habis; rute tidak dinilai, tunggu 15 menit' }
  }
  if ($Status -ge 500) {
    return @{ Level = 'fail'; State = 'server-galat'; Text = "HTTP $Status dari aplikasi (Express error, bukan gerbang sesi)" }
  }
  if ($Status -eq 404) {
    return @{ Level = 'fail'; State = 'rute-tidak-ada'; Text = 'HTTP 404: rute tidak ada di build yang berjalan (deploy belum selesai?)' }
  }
  # Cookie tidak terbukti berangkat (0 cookie, atau tidak diukur sama sekali) =
  # probe ini sebenarnya anonim. Menilai jawabannya sebagai "cookie ditolak"
  # adalah temuan palsu, dan sebagai "rute terbuka dengan sesi" juga salah. Yang
  # boleh dikatakan hanya: pengukuran tidak sampai ke server.
  if ($WithCookie -and -not ($CookieSent -gt 0)) {
    return @{ Level = 'warn'; State = 'cookie-tidak-terkirim'; Text = "HTTP $Status tanpa bukti cookie ikut terkirim (CookieSent=$CookieSent): probe berjalan sebagai permintaan anonim, jadi jawaban server bukan bukti cookie diterima atau ditolak" }
  }
  if ($Status -eq 401) {
    if ($kode -eq 'AUTH_REQUIRED') {
      if ($WithCookie) {
        return @{ Level = 'fail'; State = 'cookie-ditolak'; Text = '401 AUTH_REQUIRED padahal cookie terbukti ikut terkirim dari sesi login: server menolak cookie yang baru saja diterbitkannya sendiri (secret sesi berubah di tengah jalan / lebih dari satu proses Node / cookie terbit sebelum proses ini mulai)' }
      }
      return @{ Level = 'info'; State = 'gerbang-sesi-benar'; Text = '401 AUTH_REQUIRED dari aplikasi: rute hidup, gerbang sesi bekerja' }
    }
    if ($kode -eq 'INVALID_CREDENTIALS') {
      return @{ Level = 'warn'; State = 'kredensial-ditolak'; Text = 'login ditolak server; tidak ada kesimpulan tentang rute private' }
    }
    if ([string]::IsNullOrWhiteSpace($kode)) {
      return @{ Level = 'warn'; State = 'ditahan-sebelum-express'; Text = '401 tanpa body JSON aplikasi: ditahan di depan (Basic Auth Caddy), jadi Express belum tentu yang menjawab' }
    }
    return @{ Level = 'warn'; State = 'galat-401-lain'; Text = "401 ber-code $kode" }
  }
  if ($Status -eq 403) {
    if ($kode -eq 'INVALID_ORIGIN') {
      return @{ Level = 'warn'; State = 'origin-ditolak'; Text = 'Origin permintaan ditolak server (periksa APP_URL dan alamat yang dipakai browser)' }
    }
    if ($WithCookie) {
      return @{ Level = 'ok'; State = 'sesi-terbaca'; Text = '403 FORBIDDEN: cookie sesi terbaca server, hanya perannya tidak cukup' }
    }
    return @{ Level = 'warn'; State = 'peran-ditolak-tanpa-sesi'; Text = '403 tanpa cookie: gerbang peran menjawab sebelum gerbang sesi (tidak biasa)' }
  }
  if ($Status -ge 200 -and $Status -lt 300) {
    if (-not $JsonBody) {
      return @{ Level = 'warn'; State = 'bukan-jawaban-api'; Text = "HTTP ${Status} tanpa body JSON aplikasi: yang menjawab bukan Express (halaman SPA dev server atau proxy di depan port ini) - rute private tidak dinilai dari jawaban begitu" }
    }
    if ($WithCookie) {
      return @{ Level = 'ok'; State = 'rute-terbuka-dengan-sesi'; Text = "HTTP ${Status}: rute private menjawab normal dengan cookie sesi" }
    }
    return @{ Level = 'fail'; State = 'rute-terbuka-tanpa-sesi'; Text = "HTTP ${Status} ber-body JSON: rute private benar-benar terbuka tanpa login (seharusnya 401)" }
  }
  return @{ Level = 'warn'; State = 'status-tak-dikenal'; Text = "HTTP $Status tidak dikenal untuk gerbang sesi" }
}

# Umur cookie sesi dibaca dari sumbernya, bukan ditebak. server/posAuth.ts
# menulis `const SESSION_TTL_SECONDS = 12 * 60 * 60`; bentuk perkalian dua atau
# tiga faktor didukung. Kalau polanya tidak cocok hasilnya 0 dan seksi K menulis
# "tidak terbaca" alih-alih mengarang angka.
function Get-SessionTtlSeconds([string]$sourceText) {
  $m = [regex]::Match([string]$sourceText, 'SESSION_TTL_SECONDS\s*=\s*([0-9]+)\s*\*\s*([0-9]+)(?:\s*\*\s*([0-9]+))?')
  if (-not $m.Success) { return 0 }
  $hasil = [long]$m.Groups[1].Value * [long]$m.Groups[2].Value
  if ($m.Groups[3].Success) { $hasil = $hasil * [long]$m.Groups[3].Value }
  return $hasil
}

# Body dari respons BERSTATUS ERROR tidak bisa dibaca dari stream di PowerShell
# 5.1: Invoke-WebRequest sudah menghabiskan stream itu lebih dulu dan menaruh
# isinya di $_.ErrorDetails.Message. Membaca GetResponseStream() saja selalu
# menghasilkan string kosong untuk 401/403/404, dan itu membuat skrip menyimpulkan
# "bukan jawaban aplikasi" padahal Express menjawab dengan body JSON yang utuh.
# Urutannya: ErrorDetails dulu, stream hanya sebagai cadangan.
function Resolve-ResponseErrorBody([string]$errorDetails, [string]$streamBody) {
  if (-not [string]::IsNullOrWhiteSpace($errorDetails)) { return [string]$errorDetails }
  return [string]$streamBody
}

# Kode dari body JSON aplikasi. Dicari dengan regex, bukan ConvertFrom-Json,
# karena body error bisa saja bukan JSON (halaman Caddy, nginx, atau HTML).
function Get-ResponseApiCode([string]$body) {
  $m = [regex]::Match([string]$body, '"code"\s*:\s*"([^"]+)"')
  if ($m.Success) { return $m.Groups[1].Value }
  return ''
}

# Probe satu rute private. Cookie hanya dipakai sebagai sesi, tidak pernah
# dicetak; yang dikembalikan jumlah cookie yang benar-benar ikut terkirim.
#
# Header Cookie manual lewat -Headers @{Cookie=...} TIDAK BOLEH dipakai untuk
# membuktikan cookie diterima: PowerShell 5.1 membuangnya sebelum permintaan
# dikirim. Ini terukur (bukan dugaan) dengan server echo di workstation ini -
# permintaan dengan -Headers menghasilkan cookieReceived=null, sedangkan
# -WebSession menghasilkan cookieReceived='bejo_pos_session=...'. Tanpa bukti itu,
# -ProbeSession mengira "cookie ditolak server" padahal yang dijawab aplikasi
# adalah permintaan TANPA cookie - FAIL palsu, gejala yang sama dengan 401 tanpa
# body yang dulu dibaca sebagai "ditahan sebelum Express".
function Invoke-PrivateProbe {
  param([string]$Url, [object]$WebSession = $null)
  # Tidak ada jalur header Cookie manual di fungsi ini: satu-satunya cara
  # mengirim cookie yang terbukti bekerja di PowerShell 5.1 adalah WebSession.
  $cookieSent = 0
  if ($WebSession) {
    try { $cookieSent = @($WebSession.Cookies.GetCookies([Uri]$Url)).Count } catch { $cookieSent = 0 }
  }
  $status = 0
  $body = ''
  try {
    $call = @{ Uri = $Url; UseBasicParsing = $true; TimeoutSec = 20 }
    if ($WebSession) { $call['WebSession'] = $WebSession }
    $resp = Invoke-WebRequest @call
    $status = [int]$resp.StatusCode
    $body = [string]$resp.Content
  } catch {
    $webResponse = $_.Exception.Response
    if ($null -ne $webResponse) {
      $status = [int]$webResponse.StatusCode
      $streamBody = ''
      try {
        $stream = $webResponse.GetResponseStream()
        if ($stream.CanSeek) { [void]$stream.Seek(0, [System.IO.SeekOrigin]::Begin) }
        $reader = New-Object System.IO.StreamReader($stream)
        $streamBody = [string]$reader.ReadToEnd()
      } catch { $streamBody = '' }
      $body = Resolve-ResponseErrorBody ([string]$_.ErrorDetails.Message) $streamBody
    }
  }
  return @{
    Status = $status
    Code = (Get-ResponseApiCode $body)
    Body = $body
    # Body JSON = jawaban Express. HTML berarti yang menjawab lapisan lain di
    # depan port ini (dev server atau proxy), dan itu tidak boleh dibaca sebagai
    # rute terbuka maupun sebagai gerbang sesi.
    JsonBody = ($body.TrimStart().StartsWith('{') -or $body.TrimStart().StartsWith('['))
    # Jumlah cookie yang benar-benar ikut terkirim: 0 = permintaan anonim (tanpa
    # sesi, atau sesi yang ternyata tidak mengirim apa pun), >0 = cookie terkirim.
    CookieSent = $cookieSent
  }
}

# Percobaan login DEVELOPER lewat -ProbeSession. Password diminta dengan input
# tersembunyi, dipakai sekali di memori untuk body POST, lalu dikosongkan; ia
# tidak pernah masuk laporan, transcript, maupun baris yang dicetak. Cookie
# hasilnya juga hanya dilaporkan panjangnya. Login memakan satu jatah
# checkLoginRate di sisi server, karena itu opsinya dipakai dengan sadar.
function Invoke-SessionLoginProbe {
  param([string]$BaseUrl, [string]$Username, [securestring]$Password)
  $plain = ''
  $body = $null
  $status = 0
  $setCookie = ''
  $content = ''
  # Sesi dipakai bersama oleh login dan probe berikutnya, persis seperti browser.
  # Cara ini dipilih karena header Cookie manual terbukti dibuang PowerShell 5.1.
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  try {
    $plain = [System.Net.NetworkCredential]::new('', $Password).Password
    $body = (@{ username = $Username; password = $plain } | ConvertTo-Json -Compress)
    try {
      $resp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $body `
        -ContentType 'application/json' -UseBasicParsing -TimeoutSec 20 -WebSession $session
      $status = [int]$resp.StatusCode
      try { $setCookie = [string]$resp.Headers['Set-Cookie'] } catch { $setCookie = '' }
      $content = [string]$resp.Content
    } catch {
      $webResponse = $_.Exception.Response
      if ($null -ne $webResponse) {
        $status = [int]$webResponse.StatusCode
        try { $setCookie = [string]$webResponse.Headers['Set-Cookie'] } catch { $setCookie = '' }
        $streamBody = ''
        try {
          $stream = $webResponse.GetResponseStream()
          if ($stream.CanSeek) { [void]$stream.Seek(0, [System.IO.SeekOrigin]::Begin) }
          $reader = New-Object System.IO.StreamReader($stream)
          $streamBody = [string]$reader.ReadToEnd()
        } catch { $streamBody = '' }
        $content = Resolve-ResponseErrorBody ([string]$_.ErrorDetails.Message) $streamBody
      }
    }
  } finally {
    $plain = ''
    $body = $null
  }
  $m = [regex]::Match($setCookie, '(bejo_pos_session=[^;]+)')
  $header = ''
  if ($m.Success) { $header = $m.Groups[1].Value }
  $sameSite = ([regex]::Match($setCookie, '(?i)SameSite=([A-Za-z]+)')).Groups[1].Value
  $cookieCount = 0
  try { $cookieCount = @($session.Cookies.GetCookies([Uri]$BaseUrl)).Count } catch { $cookieCount = 0 }
  return @{
    Status = $status
    Code = (Get-ResponseApiCode $content)
    JsonBody = ([string]$content).TrimStart().StartsWith('{') -or ([string]$content).TrimStart().StartsWith('[')
    Session = $session
    CookieHeader = $header
    CookieLength = $header.Length
    # Jumlah cookie yang tersimpan di sesi untuk host ini = bukti bahwa probe
    # berikutnya benar-benar mengirim cookie, bukan permintaan anonim.
    CookieCount = $cookieCount
    HasSecureFlag = [bool]($setCookie -match '(?i);\s*Secure')
    SameSite = $sameSite
  }
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

  # /api/backend/diagnostics berada di belakang gerbang sesi dashboard, jadi
  # tanpa cookie jawabannya selalu 401 dan blok ini dulu diam-diam tidak pernah
  # terisi. Penilaiannya sekarang lewat helper yang sama dengan seksi K, dan
  # hasil pembacaan isinya hanya dilaporkan bila rute memang menjawab 200.
  $diagUrl = ((($LocalAppUrl).TrimEnd('/')) + '/api/backend/diagnostics')
  $localDiag = Invoke-PrivateProbe -Url $diagUrl
  if ($localDiag.Status -eq 200) {
    try {
      $dj = [string]$localDiag.Body | ConvertFrom-Json
      Info ("Diagnostics server: status=$($dj.status) | RAM heap $($dj.memoryUsageMb) MB | error aktif $($dj.unresolvedCount)")
      if ([int]$dj.unresolvedCount -gt 0) { Warn "$($dj.unresolvedCount) error backend belum diselesaikan (lihat panel Auto-Fix)." }
    } catch { Warn 'Respons /api/backend/diagnostics bukan JSON yang valid.' }
  } else {
    $diagVerdict = Get-PrivateProbeVerdict -Status $localDiag.Status -Code $localDiag.Code -WithCookie $false -JsonBody ([bool]$localDiag.JsonBody)
    Info ("Isi diagnostics server tidak dibaca tanpa sesi: {0} ({1}) - penilaiannya ada di seksi K." -f $diagVerdict.State, $diagVerdict.Text)
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
      'asset_adjustments', 'reconciliation_runs', 'ledger_entries',
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
  Write-Section 'K. SESI DASHBOARD & RUTE PRIVATE (PENGUKUR PENYEBAB 401)'
  # ------------------------------------------------------------------
  # Gejala yang diukur di sini: panel diagnostik di browser melaporkan
  # "Server Express Mengembalikan Status 401". Rute yang dibacanya masuk
  # PRIVATE_API_PREFIXES (server.ts:174-186) dan dijaga getPosSession()
  # (server/posAuth.ts:189), jadi 401 punya beberapa sebab berbeda dan hanya
  # sebagian yang bisa dipulihkan dari VPS. Setiap sebab diukur, tidak ada yang
  # disimpulkan dari badge koneksi.
  $privateRoutes = @(
    '/api/backend/diagnostics',
    '/api/invoices',
    '/api/marketing/status',
    '/api/blueprint'
  )

  if ($envInfo) {
    $secretSource = Get-SessionSecretSource $envInfo
    if ([string]::IsNullOrWhiteSpace($secretSource.Key)) {
      Fail 'Secret sesi dashboard acak per proses: APP_SESSION_SECRET, JOURNAL_SESSION_SECRET, PB_ADMIN_PASSWORD, dan REMOTE_ACCESS_PASS semuanya kosong di .env. Setiap service restart membuat seluruh cookie sesi tidak terbaca lagi, jadi semua rute private menjawab 401 walau aplikasi masih tampak login di perangkat.'
      Info 'Isi APP_SESSION_SECRET di .env VPS (deploy-vps.ps1 -EnablePublicSite menulisnya otomatis dan tidak mencetak nilainya), restart service, lalu login ulang.'
    } else {
      Ok ("Secret sesi dashboard berasal dari {0} (panjang {1} karakter, nilai aslinya disembunyikan), jadi cookie tetap terbaca setelah restart." -f $secretSource.Key, $secretSource.Length)
      if ($secretSource.Key -ne 'APP_SESSION_SECRET') {
        Warn ("Secret sesi bergantung pada {0}. Mengganti kredensial itu membuat seluruh sesi lama ditolak server; sediakan APP_SESSION_SECRET sendiri supaya umur sesi tidak menempel pada kredensial lain." -f $secretSource.Key)
      }
    }
  } else {
    Warn 'Sumber secret sesi tidak disimpulkan: .env tidak terbaca lewat dotenv.'
  }

  # Bukti dari proses yang berjalan, bukan dari dugaan: server mencetak satu
  # peringatan saat benar-benar memakai secret acak.
  $markerHits = @()
  foreach ($log in @(Find-LogFiles)) {
    try {
      $tail = Get-Content -LiteralPath $log -Tail ([Math]::Max($LogLines, 400)) -ErrorAction Stop
      $markerHits += @($tail | Select-String -SimpleMatch 'APP_SESSION_SECRET belum disetel')
    } catch { }
  }
  if (@($markerHits).Count -gt 0) {
    Fail ("Log aplikasi memuat {0} baris peringatan secret sesi acak; contoh: {1}" -f @($markerHits).Count, (Redact ([string](@($markerHits)[-1]).Line)))
  } elseif ($envInfo) {
    Info 'Peringatan secret sesi acak tidak muncul di ekor log yang dibaca.'
  }

  $ttlSeconds = 0
  $posAuthPath = Join-Path $AppDir 'server\posAuth.ts'
  $posSumberAda = Test-Path -LiteralPath $posAuthPath
  if ($posSumberAda) {
    $ttlSeconds = Get-SessionTtlSeconds (Get-Content -LiteralPath $posAuthPath -Raw -ErrorAction SilentlyContinue)
  }
  if ($ttlSeconds -gt 0) {
    Info ("Umur cookie sesi (Max-Age) dibaca dari server/posAuth.ts: {0} jam. Cookie yang terbit lebih lama dari itu wajib ditolak - itu jawaban benar, bukan kerusakan." -f [math]::Round(($ttlSeconds / 3600), 1))
  } elseif ($posSumberAda) {
    Info 'Umur cookie sesi tidak disimpulkan: polanya tidak dikenali di server/posAuth.ts yang ada.'
  } else {
    Info ("Umur cookie sesi tidak disimpulkan: {0} tidak ada (source deploy belum tersalin?)." -f $posAuthPath)
  }

  $healthProbe = Invoke-PrivateProbe -Url ((($LocalAppUrl).TrimEnd('/')) + '/api/health')
  $uptimeSeconds = 0
  if ($healthProbe.Status -eq 200) {
    try { $uptimeSeconds = [double](([string]$healthProbe.Body | ConvertFrom-Json).uptimeSeconds) } catch { }
  }
  if ($uptimeSeconds -gt 0) {
    Info ("Proses aplikasi berjalan {0} jam. Cookie yang terbit sebelum jam itu pasti ditolak bila secret-nya acak." -f [math]::Round(($uptimeSeconds / 3600), 1))
  } else {
    Info 'Uptime proses tidak terbaca dari /api/health.'
  }

  $portPids = @()
  try {
    $portPids = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop | ForEach-Object { $_.OwningProcess } | Select-Object -Unique)
  } catch {
    Info 'Pemilik port 3000 tidak terbaca (Get-NetTCPConnection butuh Administrator); jumlah proses tidak disimpulkan.'
  }
  if ($portPids.Count -gt 1) {
    Warn ("Port 3000 dipegang {0} proses berbeda. Dengan secret acak, cookie yang diterbitkan satu proses ditolak proses lainnya." -f $portPids.Count)
  } elseif ($portPids.Count -eq 1) {
    try {
      $appProc = Get-Process -Id ([int]$portPids[0]) -ErrorAction Stop
      Info ("Port 3000 dipegang satu proses {0} sejak {1}." -f $appProc.ProcessName, $appProc.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))
    } catch {
      Info 'Proses pemilik port 3000 tidak terbaca namanya/waktunya.'
    }
  }

  Info 'Probe tanpa cookie: 401 ber-body JSON AUTH_REQUIRED = gerbang bekerja, 404 = rute tidak ada di build yang jalan, 200 ber-body JSON = rute bocor, 200 tanpa JSON = bukan jawaban Express.'
  Info 'Kesimpulan tentang cookie HANYA dikeluarkan dari probe yang mengirim sesi (WebSession) dan mencatat jumlah cookie yang ikut terkirim; PowerShell 5.1 membuang header Cookie manual.'
  $baseUrlLocal = ($LocalAppUrl).TrimEnd('/')
  foreach ($route in $privateRoutes) {
    $probe = Invoke-PrivateProbe -Url ($baseUrlLocal + $route)
    $verdict = Get-PrivateProbeVerdict -Status $probe.Status -Code $probe.Code -WithCookie $false -JsonBody ([bool]$probe.JsonBody)
    $pesan = ('{0} -> {1}: {2}' -f $route, $verdict.State, $verdict.Text)
    switch ($verdict.Level) {
      'ok' { Ok $pesan }
      'fail' { Fail $pesan }
      'warn' { Warn $pesan }
      default { Info $pesan }
    }
  }

  $pubProbe = Invoke-PrivateProbe -Url ('https://' + $Domain + '/api/backend/diagnostics')
  $pubVerdict = Get-PrivateProbeVerdict -Status $pubProbe.Status -Code $pubProbe.Code -WithCookie $false -JsonBody ([bool]$pubProbe.JsonBody)
  if ($pubVerdict.State -eq 'ditahan-sebelum-express') {
    Warn ('Rute diagnostik lewat https://{0} berhenti sebelum Express (401 tanpa body JSON aplikasi): yang menjawab lapisan di depan server, bukan gerbang sesi. Cookie browser tidak akan pernah tembus dari alamat itu.' -f $Domain)
  } else {
    Info ('Lewat domain publik: {0} ({1})' -f $pubVerdict.State, $pubVerdict.Text)
  }

  if (-not $ProbeSession) {
    Info 'Uji login tidak dijalankan. Tambahkan -ProbeSession untuk membuktikan cookie sesi benar-benar diterima rute private (memakan satu jatah percobaan login).'
  } else {
    $devUser = (Read-Host 'Username DEVELOPER').Trim()
    if ([string]::IsNullOrWhiteSpace($devUser)) {
      Warn 'Probe sesi dilewati: username kosong.'
    } else {
      $devPass = Read-Host 'Password DEVELOPER (input tersembunyi, tidak dicetak)' -AsSecureString
      $login = Invoke-SessionLoginProbe -BaseUrl $baseUrlLocal -Username $devUser -Password $devPass
      if ($login.Status -eq 200 -and $login.CookieLength -gt 0) {
        Ok ('Login menerbitkan cookie sesi (panjang {0}, SameSite={1}, Secure={2}); nilainya tidak dicetak.' -f $login.CookieLength, $login.SameSite, $login.HasSecureFlag)
        Info ('Cookie tersimpan di sesi probe: {0} buah untuk {1} - dikirim lewat WebSession, karena PowerShell 5.1 membuang header Cookie manual.' -f $login.CookieCount, $baseUrlLocal)

        # Gema sesi: /api/auth/me TIDAK masuk gerbang private (server.ts:174-186)
        # tetapi menilai cookie yang sama dengan getPosSession() yang sama
        # (server/posAuth.ts:437-448). Jadi jawaban route inilah yang membuktikan
        # cookie benar-benar sampai ke Express, terpisah dari sikap rute private.
        $echoUrl = ($baseUrlLocal + '/api/auth/me')
        $echo = Invoke-PrivateProbe -Url $echoUrl -WebSession $login.Session
        $echoAuthenticated = $false
        if ($echo.Status -eq 200 -and [bool]$echo.JsonBody) {
          try { $echoAuthenticated = [bool](([string]$echo.Body | ConvertFrom-Json).authenticated) } catch { $echoAuthenticated = $false }
        }
        if ($echoAuthenticated) {
          Ok ("Gema sesi {0} -> authenticated=true dengan {1} cookie terkirim: Express menerima cookie yang diterbitkannya." -f '/api/auth/me', $echo.CookieSent)
        } else {
          Warn ("Gema sesi {0} -> authenticated={1} (status {2}, cookie terkirim {3}): Express TIDAK mengenali cookie yang baru diterbitkannya." -f '/api/auth/me', $echoAuthenticated, $echo.Status, $echo.CookieSent)
        }

        foreach ($route in $privateRoutes) {
          $probe = Invoke-PrivateProbe -Url ($baseUrlLocal + $route) -WebSession $login.Session
          $verdict = Get-PrivateProbeVerdict -Status $probe.Status -Code $probe.Code -WithCookie $true -JsonBody ([bool]$probe.JsonBody) -CookieSent ([int]$probe.CookieSent)
          $pesan = ('{0} dengan cookie baru -> {1}: {2}' -f $route, $verdict.State, $verdict.Text)
          switch ($verdict.Level) {
            'ok' { Ok $pesan }
            'fail' { Fail $pesan }
            'warn' { Warn $pesan }
            default { Info $pesan }
          }
        }
        if ($echoAuthenticated -and $login.CookieCount -gt 0) {
          Info 'Bila cookie diterima server tetapi panel diagnostik browser tetap 401, yang diperiksa adalah cookie di browser itu: umur 12 jam tanpa perpanjangan diam-diam, tanda Secure bila toko membuka lewat http://, dan alamat yang dipakai (IP LAN vs domain).'
        }
        if ($login.HasSecureFlag) {
          Info 'Cookie bertanda Secure: browser hanya mengirimnya lewat HTTPS. Membuka aplikasi lewat http:// alamat LAN membuat semua rute private 401 padahal servernya sehat.'
        }
      } elseif ($login.Status -eq 200 -and [bool]$login.JsonBody) {
        Fail 'Login 200 ber-body JSON tetapi server tidak mengirim cookie bejo_pos_session; selama itu terjadi semua rute private akan 401 untuk browser mana pun.'
      } elseif ($login.Status -eq 200) {
        Warn ("Login menjawab 200 tanpa body JSON aplikasi ({0}): port ini dijawab lapisan lain, jadi uji sesi tidak disimpulkan dari percobaan ini." -f $baseUrlLocal)
      } else {
        $verdict = Get-PrivateProbeVerdict -Status $login.Status -Code $login.Code -WithCookie $false -JsonBody ([bool]$login.JsonBody)
        Warn ('Probe sesi tidak selesai: login menjawab {0} ({1})' -f $verdict.State, $verdict.Text)
      }
    }
  }

  # ------------------------------------------------------------------
  Write-Section 'M. DATA PENJUALAN END-TO-END (READ-ONLY)'
  # ------------------------------------------------------------------
  # Memeriksa jalur data penjualan yang dilihat browser: koleksi ada + aturan
  # baca/tulis, jumlah record, integritas id (legacyId vs cermin data.id),
  # duplikat nomor struk lintas bentuk "/" vs "_", dan record terbaru. Hanya
  # membaca; tidak menulis apa pun. Pola auth superuser sama dengan seksi F.
  $salesResult = $null
  $tmpSales = Join-Path $AppDir ".tmp-diagnose-sales-$stamp.mjs"
  if ($SkipSales) {
    Info 'Seksi M dilewati (-SkipSales): data penjualan tidak diperiksa.'
  } elseif (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js tidak tersedia; pemeriksaan data penjualan dilewati.'
  } elseif (-not (Test-Path (Join-Path $AppDir 'node_modules\pocketbase'))) {
    Fail 'Paket pocketbase tidak ditemukan di node_modules; pemeriksaan data penjualan dilewati.'
  } else {
    $salesScript = @'
import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

const [envPath, pbUrl] = process.argv.slice(2);
const out = { pbUrl, generatedAt: new Date().toISOString(), admin: {}, collections: {}, transactions: {}, stock: {}, spk: {} };
let env = {};
try {
  env = { ...(dotenv.config({ path: envPath, override: true, quiet: true }).parsed || {}) };
} catch (e) {
  out.envError = String(e?.message || e);
}
if (!/^https?:\/\//i.test(String(pbUrl || ''))) {
  out.configError = `URL PocketBase tidak valid: "${pbUrl}"`;
}
const brief = (e) => {
  const status = Number(e?.status) || 0;
  const original = String(e?.originalError?.message || '').trim();
  const message = String(e?.message || e || '').trim() || 'galat tanpa pesan';
  if (status) return original && original !== message ? `${status} ${message} (${original})` : `${status} ${message}`;
  return original ? `jaringan ${original}` : message;
};
const newClient = () => { const pb = new PocketBase(pbUrl); pb.autoCancellation(false); return pb; };

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
      } else { out.admin.auth = 'FAIL'; out.admin.error = brief(e1); adminPb = null; }
    } catch (e2) { out.admin.auth = 'FAIL'; out.admin.error = brief(e2); adminPb = null; }
  }
} else {
  out.admin.auth = 'SKIPPED';
}

// Nomor struk BS{tahun}/{bulan}/{urut}. Bentuk "_" dikenali sama karena id yang
// lewat server kembali tanpa garis miring; kunci bulan diambil dari 9 karakter
// pertama ("BS2026/11") supaya rekap per bulan tidak salah potong.
const receiptKey = (s) => {
  const m = /^BS(\d{4})[/_](\d{2})[/_](\d+)$/.exec(String(s || '').trim());
  return m ? `BS${m[1]}/${m[2]}/${String(Number(m[3])).padStart(4, '0')}` : null;
};

if (adminPb) {
  for (const name of ['transactions', 'stock_transactions', 'spk_orders', 'invoices']) {
    try {
      const c = await adminPb.collections.getOne(name);
      out.collections[name] = {
        exists: true,
        listRule: c.listRule,
        viewRule: c.viewRule,
        createRule: c.createRule,
        updateRule: c.updateRule,
        deleteRule: c.deleteRule,
        hasLegacyId: (c.fields || []).some((f) => f.name === 'legacyId'),
        hasData: (c.fields || []).some((f) => f.name === 'data'),
      };
    } catch (e) {
      out.collections[name] = { exists: false, error: brief(e) };
    }
  }

  const readAll = async (name, fields) => {
    try {
      return { rows: await adminPb.collection(name).getFullList({ fields, requestKey: null }) };
    } catch (e) {
      return { error: brief(e) };
    }
  };

  const tx = await readAll('transactions', 'id,legacyId,data,invoiceNumber,total,date,time,timestamp,items,createdAt,created,updated');
  if (tx.error) {
    out.transactions.error = tx.error;
  } else {
    const rows = tx.rows;
    out.transactions.total = rows.length;
    let mirrorMissing = 0, legacyUnderscore = 0, legacySlash = 0, mirrorSlash = 0, shapeMismatch = 0;
    const byLegacy = new Map();
    const byReceipt = new Map();
    const byMonth = new Map();
    const receiptRows = new Map();
    for (const r of rows) {
      const legacy = String(r.legacyId || '');
      const mirror = r.data && typeof r.data === 'object' ? r.data : null;
      const mirrorId = mirror ? String(mirror.id || '') : '';
      if (!mirrorId) mirrorMissing++;
      if (legacy.includes('_')) legacyUnderscore++;
      if (legacy.includes('/')) legacySlash++;
      if (mirrorId.includes('/')) mirrorSlash++;
      if (mirrorId && legacy && mirrorId !== legacy) shapeMismatch++;
      const lk = legacy || r.id;
      byLegacy.set(lk, (byLegacy.get(lk) || 0) + 1);
      const rk = receiptKey(mirrorId || legacy);
      if (rk) {
        byReceipt.set(rk, (byReceipt.get(rk) || 0) + 1);
        const mk = rk.substring(0, 9);
        byMonth.set(mk, (byMonth.get(mk) || 0) + 1);
        const items = JSON.stringify((mirror && mirror.items) || r.items || []);
        const detail = {
          id: r.id,
          legacyId: legacy || null,
          mirrorId: mirrorId || null,
          hasMirror: Boolean(mirrorId),
          total: Number(r.total ?? (mirror && mirror.total) ?? 0),
          ts: Number(r.timestamp ?? (mirror && mirror.timestamp) ?? 0),
          date: String(r.date ?? (mirror && mirror.date) ?? ''),
          time: String(r.time ?? (mirror && mirror.time) ?? ''),
          items,
          updated: String(r.updated || r.created || ''),
        };
        if (!receiptRows.has(rk)) receiptRows.set(rk, []);
        receiptRows.get(rk).push(detail);
      }
    }
    out.transactions.mirrorMissing = mirrorMissing;
    out.transactions.legacyUnderscore = legacyUnderscore;
    out.transactions.legacySlash = legacySlash;
    out.transactions.mirrorSlash = mirrorSlash;
    out.transactions.shapeMismatch = shapeMismatch;
    out.transactions.duplicateLegacyId = [...byLegacy.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ legacyId: k, count: n }));
    out.transactions.duplicateReceipt = [...byReceipt.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ receipt: k, count: n }));

    // Klasifikasi pasangan duplikat (read-only): IDENTIK bila total+timestamp+
    // tanggal+jam+items sama persis (duplikat murni dari bug id lama), KONFLIK
    // bila isinya berbeda (penjualan berbeda memakai nomor sama - bila dihapus
    // salah satunya berarti kehilangan penjualan nyata, jadi wajib review).
    // Rekomendasi record yang dipertahankan memilih yang punya cermin data.id
    // berbentuk "/" (provenance benar yang dibaca kode perbaikan), lalu legacyId
    // "_" (scrubbed), lalu updated terbaru. Tidak ada data yang diubah di sini.
    const rankKeep = (d) => {
      let score = 0;
      if (d.hasMirror) score += 4;
      if (d.mirrorId && d.mirrorId.includes('/')) score += 2;
      if (d.legacyId && d.legacyId.includes('_')) score += 1;
      return score;
    };
    const sigOf = (d) => `${d.total}|${d.ts}|${d.date}|${d.time}|${d.items}`;
    let identicalGroups = 0, conflictingGroups = 0, identicalRedundant = 0, conflictingRecords = 0;
    const identicalKeep = [];
    const conflicting = [];
    for (const [rk, list] of receiptRows.entries()) {
      if (list.length < 2) continue;
      const first = sigOf(list[0]);
      const same = list.every((d) => sigOf(d) === first);
      if (same) {
        identicalGroups++;
        identicalRedundant += list.length - 1;
        const keep = [...list].sort((a, b) => rankKeep(b) - rankKeep(a) || String(b.updated).localeCompare(String(a.updated)))[0];
        identicalKeep.push({
          receipt: rk,
          count: list.length,
          keepId: keep.id,
          keepLegacyId: keep.legacyId,
          removeIds: list.filter((d) => d.id !== keep.id).map((d) => d.id),
        });
      } else {
        conflictingGroups++;
        conflictingRecords += list.length;
        if (conflicting.length < 40) {
          conflicting.push({
            receipt: rk,
            count: list.length,
            totals: [...new Set(list.map((d) => d.total))],
            timestamps: [...new Set(list.map((d) => d.ts))],
            records: list.map((d) => ({ id: d.id, legacyId: d.legacyId, mirrorId: d.mirrorId, total: d.total, ts: d.ts, date: d.date })),
          });
        }
      }
    }
    out.transactions.duplicateClassification = {
      identicalGroups,
      conflictingGroups,
      identicalRedundant,
      conflictingRecords,
      identicalKeep,
      conflicting,
    };
    out.transactions.byMonth = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
    out.transactions.newest = [...rows]
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 15)
      .map((r) => ({
        id: r.id,
        legacyId: r.legacyId ?? null,
        mirrorId: r.data && typeof r.data === 'object' ? (r.data.id ?? null) : null,
        invoiceNumber: r.invoiceNumber ?? null,
        total: r.total ?? null,
        date: r.date ?? null,
        timestamp: r.timestamp ?? null,
      }));
  }

  const st = await readAll('stock_transactions', 'id,legacyId,transactionNumber,type,date,totalAmount,timestamp');
  if (st.error) {
    out.stock.error = st.error;
  } else {
    out.stock.total = st.rows.length;
    const byLegacy = new Map();
    for (const r of st.rows) { const k = String(r.legacyId || r.id); byLegacy.set(k, (byLegacy.get(k) || 0) + 1); }
    out.stock.duplicateLegacyId = [...byLegacy.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ legacyId: k, count: n }));
    out.stock.newest = [...st.rows].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)).slice(0, 5)
      .map((r) => ({ id: r.id, legacyId: r.legacyId ?? null, transactionNumber: r.transactionNumber ?? null, type: r.type ?? null, date: r.date ?? null, totalAmount: r.totalAmount ?? null }));
  }

  const sp = await readAll('spk_orders', 'id,legacyId,orderNumber,status,date,totalAmount,timestamp');
  if (sp.error) {
    out.spk.error = sp.error;
  } else {
    out.spk.total = sp.rows.length;
    const byStatus = new Map();
    for (const r of sp.rows) { const s = String(r.status || '?'); byStatus.set(s, (byStatus.get(s) || 0) + 1); }
    out.spk.byStatus = [...byStatus.entries()].map(([status, count]) => ({ status, count }));
    out.spk.newest = [...sp.rows].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)).slice(0, 5)
      .map((r) => ({ id: r.id, legacyId: r.legacyId ?? null, orderNumber: r.orderNumber ?? null, status: r.status ?? null, date: r.date ?? null, totalAmount: r.totalAmount ?? null }));
  }
}

console.log(JSON.stringify(out, null, 2));
'@

    try {
      [System.IO.File]::WriteAllText($tmpSales, $salesScript, [System.Text.UTF8Encoding]::new($false))
      $run = Invoke-NodeScript $tmpSales @($envPath, $LocalPbUrl)
      $raw = [string]$run.Out
      $first = $raw.IndexOf('{')
      $last = $raw.LastIndexOf('}')
      if ($first -ge 0 -and $last -gt $first) { $raw = $raw.Substring($first, $last - $first + 1) }
      try {
        $salesResult = $raw | ConvertFrom-Json
        [System.IO.File]::WriteAllText($SalesJsonPath, $raw, [System.Text.UTF8Encoding]::new($false))
        Ok "Pemeriksaan data penjualan selesai (detail JSON: $SalesJsonPath)"
      } catch {
        Fail 'Hasil pemeriksaan data penjualan bukan JSON valid.'
        if ($run.Err) { Info ('Node: ' + $run.Err.Substring(0, [Math]::Min(500, $run.Err.Length))) }
        Info ('Output: ' + $raw.Substring(0, [Math]::Min(500, $raw.Length)))
      }
    } finally {
      Remove-Item -LiteralPath $tmpSales -Force -ErrorAction SilentlyContinue
    }
  }

  if ($salesResult) {
    if ($salesResult.configError) { Fail $salesResult.configError }
    if ($salesResult.admin.auth -eq 'OK' -or $salesResult.admin.auth -eq 'OK (legacy admins)') {
      Ok "Login admin PocketBase berhasil ($($salesResult.admin.auth))"

      foreach ($name in @('transactions', 'stock_transactions', 'spk_orders', 'invoices')) {
        $c = $salesResult.collections.$name
        if (-not $c) { continue }
        if ($c.exists -eq $false) {
          Fail "Koleksi '$name' tidak ada di server: tulis cloud gagal dan data hanya tersimpan di perangkat. ($($c.error))"
          continue
        }
        Ok "Koleksi '$name' ada (legacyId=$($c.hasLegacyId), cermin data=$($c.hasData))."
        if (($c.hasLegacyId -eq $false) -or ($c.hasData -eq $false)) {
          Fail "Koleksi '$name' kehilangan field legacyId/data - id aplikasi tidak bisa pulang utuh; jalankan skrip koleksi."
        }
        $readOpen = [string]::IsNullOrEmpty([string]$c.listRule) -and [string]::IsNullOrEmpty([string]$c.viewRule)
        if ($readOpen) { Warn "Aturan baca '$name' kosong (hanya superuser): browser tidak bisa menarik datanya." }
        Info "  aturan '$name': list='$($c.listRule)' create='$($c.createRule)' update='$($c.updateRule)' delete='$($c.deleteRule)'"
      }

      $tx = $salesResult.transactions
      if ($tx.error) {
        Fail "Tidak bisa membaca transactions: $($tx.error)"
      } else {
        Info "Jumlah record penjualan (transactions): $($tx.total)"
        if ([int]$tx.total -eq 0) {
          Warn 'Koleksi transactions kosong. Bila browser menampilkan penjualan, berarti penjualan itu belum pernah sampai server (Mode Lokal / antrean kirim belum terkirim).'
        }
        if ([int]$tx.mirrorMissing -gt 0) {
          Warn "$($tx.mirrorMissing) record tanpa cermin data.id: id pulang sebagai legacyId '_' sehingga penomoran struk bisa mulai ulang dan menimpa record lama (data sebelum perbaikan)."
        } else {
          Ok 'Semua record penjualan membawa cermin data.id (id asli "/" pulang utuh).'
        }
        Info "Bentuk id: legacyId '_'=$($tx.legacyUnderscore) '/'=$($tx.legacySlash) | data.id '/'=$($tx.mirrorSlash) | beda bentuk=$($tx.shapeMismatch)"

        $dupLegacy = @($tx.duplicateLegacyId)
        if ($dupLegacy.Count -gt 0) {
          Fail "$($dupLegacy.Count) legacyId ganda di transactions (record kembar / saling timpa): $(($dupLegacy | ForEach-Object { "$($_.legacyId)x$($_.count)" }) -join ', ')"
        } else { Ok 'Tidak ada legacyId ganda di transactions.' }

        $dupReceipt = @($tx.duplicateReceipt)
        if ($dupReceipt.Count -gt 0) {
          $sample = ($dupReceipt | Select-Object -First 10 | ForEach-Object { "$($_.receipt)x$($_.count)" }) -join ', '
          Fail "$($dupReceipt.Count) nomor struk ganda lintas bentuk '/' vs '_' (satu struk tersimpan sebagai dua record). Contoh: $sample. Rincian lengkap ada di JSON penjualan."
        } else { Ok 'Tidak ada nomor struk ganda (bentuk "/" dan "_" dihitung satu).' }

        $cls = $tx.duplicateClassification
        if ($cls) {
          Info "Klasifikasi duplikat: $($cls.identicalGroups) pasangan IDENTIK (duplikat murni, $($cls.identicalRedundant) record redundan) | $($cls.conflictingGroups) pasangan KONFLIK (isi berbeda, $($cls.conflictingRecords) record, wajib review manual)."
          if ([int]$cls.identicalGroups -gt 0) {
            Ok "$($cls.identicalGroups) pasangan identik aman digabungkan nanti (total+timestamp+items sama); record yang dipertahankan dipilih dari cermin data.id '/' lalu legacyId '_'. Daftar keepId/removeIds ada di JSON penjualan (duplicateClassification.identicalKeep)."
          }
          $konflik = @($cls.conflicting)
          if ($konflik.Count -gt 0) {
            Warn "$($cls.conflictingGroups) pasangan KONFLIK tidak boleh dihapus otomatis - isinya berbeda (kemungkinan penjualan lama tertimpa nomor sama). Contoh (maks 40 di JSON):"
            $konflik | Select-Object -First 10 | ForEach-Object {
              $totals = ($_.totals | ForEach-Object { "Rp$_" }) -join ' vs '
              Info "  - $($_.receipt): total [$totals], timestamp [$($_.timestamps -join ' vs ')], $($_.count) record"
            }
          } else {
            Ok 'Tidak ada pasangan konflik - semua duplikat identik sehingga penggabungan nanti tidak kehilangan penjualan berbeda.'
          }
        }

        $months = @($tx.byMonth)
        if ($months.Count -gt 0) {
          Info "Penjualan per bulan: $(($months | ForEach-Object { "$($_.month)=$($_.count)" }) -join ', ')"
        }
        $newest = @($tx.newest)
        if ($newest.Count -gt 0) {
          Info 'Penjualan terbaru di server (bandingkan dengan Riwayat Penjualan di browser):'
          $newest | ForEach-Object { Info "  - struk=$($_.mirrorId) legacy=$($_.legacyId) total=$($_.total) tgl=$($_.date) ts=$($_.timestamp)" }
        }
      }

      $st = $salesResult.stock
      if ($st.error) { Warn "Tidak bisa membaca stock_transactions: $($st.error)" }
      else {
        Info "Jumlah record stok masuk/keluar (stock_transactions): $($st.total)"
        $dupStock = @($st.duplicateLegacyId)
        if ($dupStock.Count -gt 0) { Warn "$($dupStock.Count) legacyId ganda di stock_transactions: $(($dupStock | ForEach-Object { "$($_.legacyId)x$($_.count)" }) -join ', ')" }
      }

      $sp = $salesResult.spk
      if ($sp.error) { Warn "Tidak bisa membaca spk_orders: $($sp.error)" }
      else {
        Info "Jumlah order SPK (spk_orders): $($sp.total)"
        $statuses = @($sp.byStatus)
        if ($statuses.Count -gt 0) { Info "Status SPK: $(($statuses | ForEach-Object { "$($_.status)=$($_.count)" }) -join ', ')" }
        $newestSpk = @($sp.newest)
        if ($newestSpk.Count -gt 0) {
          Info 'Order SPK terbaru (sumber penjualan yang ditarik ke POS):'
          $newestSpk | ForEach-Object { Info "  - order=$($_.orderNumber) status=$($_.status) total=$($_.totalAmount) tgl=$($_.date)" }
        }
      }
    } elseif ($salesResult.admin.auth -eq 'SKIPPED') {
      Warn 'PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD tidak diset: pemeriksaan data penjualan mendalam dilewati.'
    } else {
      Warn "Login admin PocketBase gagal ($($salesResult.admin.error)): pemeriksaan data penjualan dilewati."
    }
  }

  # ------------------------------------------------------------------
  Write-Section 'L. RINGKASAN'
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
  if (Test-Path $SalesJsonPath) {
    Write-Host "  JSON penjualan: $SalesJsonPath" -ForegroundColor White
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
