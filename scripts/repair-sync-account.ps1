<#
=======================================================================
  BEJO Digital Print - Perbaiki Akun Sinkronisasi PocketBase
=======================================================================
  Dipakai saat aplikasi live masuk "Mode Lokal" karena broker
  /api/pocketbase/session menolak kredensial akun sinkronisasi.

  Jalankan DI VPS (PowerShell Administrator):

      # 1) Periksa saja (read-only, tidak mengubah apa pun)
      powershell -ExecutionPolicy Bypass -File C:\bejo-pos\scripts\repair-sync-account.ps1

      # 2) Perbaiki: samakan record sinkronisasi dengan .env, hapus baris
      #    direktori yang menunjuk record itu, lalu verifikasi login
      powershell -ExecutionPolicy Bypass -File C:\bejo-pos\scripts\repair-sync-account.ps1 -Apply

      # 3) Perbaiki lalu restart service aplikasi
      powershell -ExecutionPolicy Bypass -File C:\bejo-pos\scripts\repair-sync-account.ps1 -Apply -RestartService

  Sumber kebenaran kredensial sinkronisasi adalah .env:
      PB_SYNC_EMAIL, PB_SYNC_PASSWORD  (dipakai broker)
      PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD (dipakai perbaikan via superuser)

  .env dibaca dengan paket `dotenv` milik aplikasi, jadi nilai yang dipakai
  skrip ini identik dengan yang dibaca server POS. Nilai rahasia tidak
  pernah dicetak; hanya status TERISI/KOSONG, panjang, dan email tersamar.

  Skrip tidak pernah merotasi password superuser. Tanpa -Apply tidak ada
  satu pun operasi tulis ke PocketBase.
=======================================================================
#>
[CmdletBinding()]
param(
  [string]$AppDir = 'C:\bejo-pos',
  [string]$ServiceName = 'BejoStikerPOS',
  [string]$LocalPbUrl = '',
  [string]$LocalAppUrl = 'http://127.0.0.1:3000',
  [switch]$Apply,
  [switch]$RestartService
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$JsonPath = Join-Path $env:TEMP "bejo-repair-sync-$stamp.json"

$script:OkCount = 0
$script:WarnCount = 0
$script:FailCount = 0

function Write-Section([string]$title) {
  Write-Host ''
  Write-Host ('=' * 68) -ForegroundColor DarkCyan
  Write-Host " $title" -ForegroundColor Cyan
  Write-Host ('=' * 68) -ForegroundColor DarkCyan
}
function Ok([string]$msg)   { $script:OkCount++;   Write-Host "  [OK]   $msg"   -ForegroundColor Green }
function Warn([string]$msg) { $script:WarnCount++; Write-Host "  [WARN] $msg"   -ForegroundColor Yellow }
function Fail([string]$msg) { $script:FailCount++; Write-Host "  [FAIL] $msg"   -ForegroundColor Red }
function Info([string]$msg) { Write-Host "         $msg"   -ForegroundColor DarkGray }

function MaskEmail([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return '(kosong)' }
  $at = $value.IndexOf('@')
  if ($at -lt 1) { return ('*' * [Math]::Min(6, $value.Length)) }
  return ($value.Substring(0, 1) + '***' + $value.Substring($at))
}

# Properti JSON yang tidak ada dianggap "tidak ada data", bukan satu baris kosong.
function As-List($value) {
  return @($value | Where-Object { $null -ne $_ })
}

Write-Host ''
Write-Host '  BEJO Digital Print - Perbaikan akun sinkronisasi PocketBase' -ForegroundColor White
Write-Host ("  Mode: {0}" -f $(if ($Apply) { 'PERBAIKI (menulis ke PocketBase)' } else { 'PERIKSA SAJA (read-only)' })) -ForegroundColor Gray

# ---------------------------------------------------------------------
Write-Section '1. BERKAS DAN RUNTIME'
# ---------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $AppDir)) {
  Fail "Folder aplikasi tidak ditemukan: $AppDir"
  exit 2
}
$envPath = Join-Path $AppDir '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  Fail ".env tidak ditemukan di $AppDir"
  exit 2
}
Ok ".env ditemukan: $envPath"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail 'Node.js tidak ditemukan di PATH.'
  exit 2
}
if (-not (Test-Path (Join-Path $AppDir 'node_modules\pocketbase'))) {
  Fail 'Paket pocketbase tidak ditemukan di node_modules.'
  exit 2
}
if (-not (Test-Path (Join-Path $AppDir 'node_modules\dotenv'))) {
  Fail 'Paket dotenv tidak ditemukan di node_modules.'
  exit 2
}
Ok 'Node.js, pocketbase, dan dotenv tersedia.'

# ---------------------------------------------------------------------
Write-Section '2. PEMERIKSAAN AKUN'
# ---------------------------------------------------------------------
$nodeResult = $null
$tmpNode = Join-Path $AppDir ".tmp-repair-sync-$stamp.mjs"
$mode = $(if ($Apply) { 'apply' } else { 'check' })

$nodeScript = @'
import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

const [envPath, pbUrlArg, mode] = process.argv.slice(2);
const apply = mode === 'apply';
const out = {
  mode,
  generatedAt: new Date().toISOString(),
  pbUrl: '',
  env: {},
  sync: {},
  admin: {},
  record: null,
  directory: {},
  actions: [],
  errors: [],
};

// dotenv dipakai apa adanya supaya hasilnya sama dengan server POS.
// quiet: true wajib agar dotenv tidak mencetak banner sebelum JSON.
const parsed = dotenv.config({ path: envPath, override: true, quiet: true }).parsed || {};
const env = { ...parsed };
const pbUrl = String(pbUrlArg || env.POCKETBASE_UPSTREAM || 'http://127.0.0.1:8090').trim().replace(/\/+$/, '');
out.pbUrl = pbUrl;

const syncEmail = String(env.PB_SYNC_EMAIL || '').trim().toLowerCase();
const syncPass = String(env.PB_SYNC_PASSWORD || '');
const adminEmail = String(env.PB_ADMIN_EMAIL || '').trim();
const adminPass = String(env.PB_ADMIN_PASSWORD || '');

out.env = {
  keys: Object.keys(env).filter((k) => /^(PB_|POCKETBASE)/.test(k)).sort(),
  sync: { set: Boolean(syncEmail && syncPass), passwordLength: syncPass.length },
  admin: { set: Boolean(adminEmail && adminPass), passwordLength: adminPass.length },
  legacySyncInEnv: Boolean(env.VITE_PB_SYNC_EMAIL || env.VITE_PB_SYNC_PASSWORD),
};

const newClient = () => {
  const pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);
  return pb;
};
const brief = (e) => `${e?.status ? e.status + ' ' : ''}${e?.message || e}`.trim();
const lower = (v) => String(v || '').trim().toLowerCase();

async function probeLogin(email, password) {
  if (!email || !password) return { status: 'SKIPPED' };
  try {
    const auth = await newClient().collection('users').authWithPassword(email, password);
    return { status: 'OK', id: auth.record?.id || '' };
  } catch (e) {
    return { status: 'FAIL', error: brief(e) };
  }
}

out.sync.loginBefore = await probeLogin(syncEmail, syncPass);
const loginId = out.sync.loginBefore.id || '';

let adminPb = null;
if (!out.env.admin.set) {
  out.admin.auth = 'SKIPPED';
} else {
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
        throw e1;
      }
    } catch (e2) {
      out.admin.auth = 'FAIL';
      out.admin.error = brief(e2);
      adminPb = null;
    }
  }
}

if (!adminPb) {
  out.status = out.sync.loginBefore.status === 'OK' ? 'SYNC_OK_NO_ADMIN' : 'BLOCKED_NO_ADMIN';
  out.sync.loginAfter = out.sync.loginBefore;
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const users = await adminPb.collection('users').getFullList({ requestKey: null });
const dirs = await adminPb.collection('app_users').getFullList({ requestKey: null });

const byEmail = users.find((r) => lower(r.email) === syncEmail);
const identity = users.filter(
  (r) => lower(r.username) === 'sync' || /bejo sync service/i.test(String(r.name || ''))
);
// Login yang berhasil adalah bukti terkuat: id record dari token dipakai lebih
// dulu daripada menebak dari username/nama yang bisa dipakai record lain.
const byLoginId = loginId ? users.find((r) => r.id === loginId) : null;
const record = byEmail || byLoginId || (identity.length === 1 ? identity[0] : null);

out.record = record
  ? {
      foundBy: byEmail ? 'email' : byLoginId && record.id === byLoginId.id ? 'login-id' : 'identitas',
      id: record.id,
      email: record.email,
      username: record.username ?? null,
      isActive: record.isActive ?? null,
      updated: record.updated ?? null,
      emailMatchesEnv: lower(record.email) === syncEmail,
    }
  : { foundBy: 'tidak ditemukan', id: loginId };
out.record.candidates = identity
  .filter((r) => !record || r.id !== record.id)
  .map((r) => ({ id: r.id, email: r.email, username: r.username ?? null }));
out.record.duplicateSyncEmail = users.filter((r) => lower(r.email) === syncEmail).length;

const syncId = (record && record.id) || loginId || '';
const authIds = new Set(users.map((r) => r.id));
const dirOf = (r) => {
  const m = r?.data && typeof r.data === 'object' ? r.data : {};
  return {
    recordId: r?.id ?? null,
    legacyId: r?.legacyId || m.id || null,
    username: r?.username || m.username || null,
    authId: r?.authId || m.authId || null,
  };
};
const dirRows = dirs.map(dirOf);
out.directory.total = dirRows.length;
out.directory.syncId = syncId;
out.directory.pointingToSync = syncId ? dirRows.filter((d) => d.authId === syncId) : [];
out.directory.orphanNamedSync = dirRows.filter(
  (d) => lower(d.username) === 'sync' && (!d.authId || !authIds.has(d.authId))
);
out.directory.namedSyncWithOtherAuth = dirRows.filter(
  (d) => lower(d.username) === 'sync' && d.authId && authIds.has(d.authId) && d.authId !== syncId
);
out.directory.deleted = [];

if (apply) {
  try {
    if (syncId) {
      await adminPb.collection('users').update(syncId, {
        email: syncEmail,
        password: syncPass,
        passwordConfirm: syncPass,
        isActive: true,
      });
      out.actions.push('Record sinkronisasi disamakan dengan .env (email + password + isActive).');
    } else {
      const body = {
        email: syncEmail,
        password: syncPass,
        passwordConfirm: syncPass,
        name: 'Bejo Sync Service',
        isActive: true,
      };
      try {
        await adminPb.collection('users').create({ ...body, username: 'sync' });
      } catch (e) {
        if (e?.status !== 400) throw e;
        await adminPb.collection('users').create(body);
      }
      out.actions.push('Record sinkronisasi dibuat ulang sesuai .env.');
    }
  } catch (e) {
    out.errors.push('tulis record sinkronisasi: ' + brief(e));
  }

  for (const row of [...out.directory.pointingToSync, ...out.directory.orphanNamedSync]) {
    if (!row.recordId) continue;
    try {
      await adminPb.collection('app_users').delete(row.recordId);
      out.directory.deleted.push({ legacyId: row.legacyId, username: row.username });
    } catch (e) {
      out.errors.push(`hapus baris direktori ${row.legacyId || row.recordId}: ${brief(e)}`);
    }
  }
  if (out.directory.deleted.length) {
    out.actions.push(`${out.directory.deleted.length} baris direktori akun sistem dihapus.`);
  }

  out.sync.loginAfter = await probeLogin(syncEmail, syncPass);
  out.status = out.sync.loginAfter.status === 'OK' ? 'FIXED' : 'STILL_FAILING';
} else {
  out.sync.loginAfter = out.sync.loginBefore;
  out.status = out.sync.loginBefore.status === 'OK' ? 'SYNC_OK' : 'SYNC_FAIL';
}

console.log(JSON.stringify(out, null, 2));
'@

try {
  [System.IO.File]::WriteAllText($tmpNode, $nodeScript, [System.Text.UTF8Encoding]::new($false))
  $raw = (& node $tmpNode $envPath $LocalPbUrl $mode 2>&1) -join "`n"
  # Buang baris non-JSON yang mungkin dicetak pustaka (mis. banner dotenv).
  $jsonStart = $raw.IndexOf('{')
  if ($jsonStart -gt 0) { $raw = $raw.Substring($jsonStart) }
  try {
    $nodeResult = $raw | ConvertFrom-Json
    [System.IO.File]::WriteAllText($JsonPath, ($nodeResult | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
    Info "Detail JSON: $JsonPath"
  } catch {
    Fail 'Hasil pemeriksaan bukan JSON valid.'
    Info ($raw.Substring(0, [Math]::Min(600, $raw.Length)))
  }
} finally {
  Remove-Item -LiteralPath $tmpNode -Force -ErrorAction SilentlyContinue
}

if (-not $nodeResult) {
  Fail 'Pemeriksaan tidak menghasilkan data.'
  exit 1
}

# ---------------------------------------------------------------------
Write-Section '3. KUNCI .ENV TERBACA (dotenv, sama seperti aplikasi)'
# ---------------------------------------------------------------------
$envKeys = As-List $nodeResult.env.keys
if ($envKeys.Count -gt 0) {
  Info ("Kunci ditemukan: " + ($envKeys -join ', '))
} else {
  Warn 'Tidak ada kunci PB_*/POCKETBASE* yang terbaca dari .env.'
}

if ([bool]$nodeResult.env.sync.set) {
  Ok ("PB_SYNC_EMAIL + PB_SYNC_PASSWORD terisi (password panjang {0})." -f $nodeResult.env.sync.passwordLength)
} else {
  Fail 'PB_SYNC_EMAIL / PB_SYNC_PASSWORD belum lengkap di .env.'
}
if ([bool]$nodeResult.env.admin.set) {
  Ok ("PB_ADMIN_EMAIL + PB_ADMIN_PASSWORD terisi (password panjang {0})." -f $nodeResult.env.admin.passwordLength)
} else {
  Warn 'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD belum lengkap di .env.'
}
if ([bool]$nodeResult.env.legacySyncInEnv) {
  Warn 'VITE_PB_SYNC_* (deprecated) masih ada di .env; hapus agar kredensial tidak lagi ikut bundle browser.'
}

# ---------------------------------------------------------------------
Write-Section '4. HASIL'
# ---------------------------------------------------------------------
$loginBefore = [string]$nodeResult.sync.loginBefore.status
if ($loginBefore -eq 'OK') {
  Ok 'Login akun sinkronisasi BERHASIL.'
} elseif ($loginBefore -eq 'SKIPPED') {
  Warn 'Login akun sinkronisasi dilewati (kredensial kosong).'
} else {
  Fail ("Login akun sinkronisasi GAGAL: {0}" -f $nodeResult.sync.loginBefore.error)
}

$adminAuth = [string]$nodeResult.admin.auth
if ($adminAuth -like 'OK*') {
  if ($adminAuth -like '*legacy*') {
    Ok 'Login superuser PocketBase BERHASIL (legacy admins).'
  } else {
    Ok 'Login superuser PocketBase BERHASIL.'
  }
} elseif ($adminAuth -eq 'SKIPPED') {
  Warn 'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD kosong; perbaikan via superuser tidak bisa dijalankan.'
} else {
  Fail ("Login superuser PocketBase GAGAL: {0}" -f $nodeResult.admin.error)
  Info 'Kalau kunci di atas terisi tetapi login ditolak, nilainya memang tidak cocok dengan superuser PocketBase.'
}

$rec = $nodeResult.record
$foundBy = $(if ($rec) { [string]$rec.foundBy } else { '' })
switch ($foundBy) {
  'email'     { Ok ("Record sinkronisasi ditemukan dari email (id {0})." -f $rec.id) }
  'login-id'  { Ok ("Record sinkronisasi cocok dengan id hasil login (id {0})." -f $rec.id) }
  'identitas' { Warn ("Record sinkronisasi dikenali dari username/nama (id {0}); emailnya berbeda dari .env." -f $rec.id) }
  default {
    if ($rec -and $rec.id) {
      Warn ("Record sinkronisasi tidak terbaca dari daftar, tetapi login memakai id {0}." -f $rec.id)
    } else {
      Warn 'Record akun sinkronisasi tidak ditemukan di koleksi users.'
    }
  }
}
if ($rec -and $rec.emailMatchesEnv -eq $false) { Warn 'Email record sinkronisasi TIDAK sama dengan PB_SYNC_EMAIL.' }
$candidates = As-List $nodeResult.record.candidates
if ($candidates.Count -gt 0) {
  Warn ("Ada {0} record lain ber-username/nama sync: {1}" -f $candidates.Count, (($candidates | ForEach-Object { $_.id }) -join ', '))
}
if ($nodeResult.record.duplicateSyncEmail -gt 1) {
  Fail ("Ada {0} record dengan email yang sama dengan PB_SYNC_EMAIL." -f $nodeResult.record.duplicateSyncEmail)
}

$pointing = As-List $nodeResult.directory.pointingToSync
$orphans = As-List $nodeResult.directory.orphanNamedSync
$otherSync = As-List $nodeResult.directory.namedSyncWithOtherAuth

if ($adminAuth -notlike 'OK*') {
  Info 'Data direktori tidak diperiksa karena login superuser tidak tersedia.'
} else {
  Info ("Baris app_users diperiksa: {0}." -f $nodeResult.directory.total)
  if ($pointing.Count -gt 0) {
    Fail ("{0} baris app_users menunjuk record sinkronisasi: {1}" -f $pointing.Count, (($pointing | ForEach-Object { $_.legacyId }) -join ', '))
  } else {
    Ok 'Tidak ada baris app_users yang menunjuk record sinkronisasi.'
  }
  if ($orphans.Count -gt 0) {
    Warn ("{0} baris app_users yatim ber-username sync: {1}" -f $orphans.Count, (($orphans | ForEach-Object { $_.legacyId }) -join ', '))
  }
  if ($otherSync.Count -gt 0) {
    Warn ("{0} baris app_users ber-username sync menunjuk record lain (tidak dihapus otomatis)." -f $otherSync.Count)
  }
}

if ($Apply) {
  Write-Section '5. TINDAKAN YANG DIJALANKAN'
  $actions = As-List $nodeResult.actions
  if ($actions.Count -gt 0) {
    foreach ($action in $actions) { Ok $action }
  } else {
    Warn 'Tidak ada perubahan yang diperlukan.'
  }
  foreach ($err in (As-List $nodeResult.errors)) { Fail $err }
  if ([string]$nodeResult.sync.loginAfter.status -eq 'OK') {
    Ok 'Verifikasi ulang: login akun sinkronisasi BERHASIL.'
  } else {
    Fail 'Verifikasi ulang: login akun sinkronisasi MASIH GAGAL.'
  }
}

# ---------------------------------------------------------------------
Write-Section '6. LANGKAH SELANJUTNYA'
# ---------------------------------------------------------------------
$syncOk = [string]$nodeResult.sync.loginAfter.status -eq 'OK'
$adminOk = $adminAuth -like 'OK*'

if ($syncOk -and -not $Apply) {
  Ok 'Kredensial sinkronisasi valid; broker /api/pocketbase/session seharusnya memberi token.'
  if (-not $adminOk) {
    Warn 'Login superuser gagal: bila Hak Akses/akun staf bermasalah, perbaiki PB_ADMIN_* dulu.'
  }
  Info 'Bila aplikasi masih Mode Lokal, restart service lalu periksa lagi:'
  Info ("  Restart-Service {0}" -f $ServiceName)
} elseif ($syncOk -and $Apply) {
  Ok 'Akun sinkronisasi sudah sehat.'
  if (-not $RestartService) {
    Info ("Restart layanan agar browser meminta token baru: Restart-Service {0}" -f $ServiceName)
  }
} elseif (-not $adminOk) {
  Fail 'Tanpa akses superuser, akun sinkronisasi tidak bisa diperbaiki dari skrip ini.'
  Info 'Pilih salah satu:'
  Info '  a) Isi PB_ADMIN_EMAIL + PB_ADMIN_PASSWORD yang BENAR di .env, atau'
  Info '  b) Jalankan scripts\apply-p0-security.ps1 -RequireHardening (meminta kredensial admin secara aman), atau'
  Info '  c) Bila password superuser tidak diketahui, rotasi lewat CLI di VPS:'
  Info '     C:\pocketbase\pocketbase.exe superuser upsert EMAIL_ADMIN PASSWORD_BARU --dir C:\pocketbase\pb_data'
  Info '     Perintah itu MENGGANTI kredensial produksi; ketik nilainya langsung di VPS, jangan di chat.'
  Info '     Setelah itu samakan PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD di .env lalu jalankan ulang dengan -Apply.'
} else {
  Info 'Periksa PB_SYNC_PASSWORD di .env: nilainya harus sama dengan password record sinkronisasi.'
  Info 'Jalankan ulang skrip ini dengan -Apply untuk menyamakannya.'
}

if ($RestartService -and $syncOk) {
  Write-Section '7. RESTART SERVICE'
  try {
    Restart-Service -Name $ServiceName -Force -ErrorAction Stop
    Ok "Service $ServiceName direstart."
    $healthy = $false
    for ($i = 0; $i -lt 12; $i++) {
      Start-Sleep -Seconds 2
      try {
        $health = Invoke-RestMethod -Uri "$($LocalAppUrl.TrimEnd('/'))/api/health" -TimeoutSec 5 -ErrorAction Stop
        if ($health.status -eq 'ok') { $healthy = $true; break }
      } catch { }
    }
    if ($healthy) {
      Ok ('Aplikasi merespons /api/health (versi {0}).' -f $health.version)
    } else {
      Warn 'Aplikasi belum merespons /api/health; periksa log service.'
    }
  } catch {
    Fail ("Gagal restart service {0}: {1}" -f $ServiceName, $_.Exception.Message)
  }
}

Write-Host ''
if ($script:FailCount -eq 0) {
  Write-Host ("  SELESAI - {0} OK, {1} peringatan, 0 gagal" -f $script:OkCount, $script:WarnCount) -ForegroundColor Green
  exit 0
}
Write-Host ("  SELESAI - {0} OK, {1} peringatan, {2} gagal" -f $script:OkCount, $script:WarnCount, $script:FailCount) -ForegroundColor Red
exit 1
