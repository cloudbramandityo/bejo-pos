<#
======================================================================
  BEJO Digital Print - Auto Migration: Firebase/Firestore -> PocketBase
======================================================================
  Menjalankan migrasi TOTAL dari Firebase ke PocketBase untuk seluruh
  file di aplikasi (src/**/*.ts, src/**/*.tsx, server.ts, .env).

  Yang dilakukan:
    1. Backup branch git + salinan folder src
    2. Redirect semua import './firebase' & '../firebase'
       -> './backend/pocketbaseBackend' & '../backend/pocketbaseBackend'
    3. Rename simbol API:
         testFirestoreConnection  -> testPocketBaseConnection
         isFirestoreQuotaExceeded -> isPocketBaseUnavailable
         handleFirestoreError    -> handleBackendError
         sanitizeForFirestore    -> sanitizeForDb
    4. Update teks UI "Firestore" -> "PocketBase"
    5. Hapus src/firebase.ts (diganti backend/pocketbaseBackend.ts)
    6. server.ts: tambah reverse proxy /api/pb -> PocketBase
    7. .env / .env.example: tambah VITE_POCKETBASE_URL
    8. npm install + tsc --noEmit + npm run build

  CARA PAKAI (PowerShell):
     powershell -ExecutionPolicy Bypass -File scripts\migrate-to-pocketbase.ps1
======================================================================
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $root "backups\migration-$Timestamp"

function Write-Step { param($t) Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Write-Ok   { param($t) Write-Host "   [OK] $t" -ForegroundColor Green }
function Write-Warn { param($t) Write-Host "   [!] $t" -ForegroundColor Yellow }
function Write-Fail { param($t) Write-Host "   [FAIL] $t" -ForegroundColor Red; exit 1 }

Write-Host "==================================================================" -ForegroundColor DarkCyan
Write-Host " BEJO Digital Print - MIGRASI FIREBASE -> POCKETBASE" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor DarkCyan

# ---------------------------------------------------------------- 1. BACKUP
Write-Step "1/8 Membuat backup"
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Copy-Item -Path (Join-Path $root 'src') -Destination (Join-Path $BackupDir 'src') -Recurse -Force
Copy-Item -Path (Join-Path $root 'package.json') -Destination $BackupDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $root 'server.ts') -Destination $BackupDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $root '.env') -Destination $BackupDir -Force -ErrorAction SilentlyContinue
Write-Ok "Backup: $BackupDir"

# git branch backup (jika repo git tersedia)
if (Test-Path (Join-Path $root '.git')) {
    try {
        & git rev-parse --is-inside-work-tree *> $null
        if ($LASTEXITCODE -eq 0) {
            & git checkout -b "backup/pre-pocketbase-$Timestamp" *> $null
            & git checkout - *> $null
            Write-Ok "Git branch backup: backup/pre-pocketbase-$Timestamp"
        }
    } catch { Write-Warn "Git branch backup dilewati" }
}

# ---------------------------------------------------------------- 2. FILE TARGET
Write-Step "2/8 Menentukan file yang akan dimigrasi"
$targets = @()
$targets += Get-ChildItem -Path (Join-Path $root 'src') -Recurse -Include *.ts,*.tsx -File |
    Where-Object { $_.FullName -notlike '*src\backend\pocketbaseBackend.ts' -and $_.FullName -notlike '*src\lib\pocketbase.ts' }
$serverTs = Join-Path $root 'server.ts'
if (Test-Path $serverTs) { $targets += Get-Item $serverTs }
Write-Ok "$($targets.Count) file akan dimigrasi"

# ---------------------------------------------------------------- 3. REPLACE
Write-Step "3/8 Mengganti import & nama fungsi"

$replacements = @(
    @{ From = "from './firebase'";            To = "from './backend/pocketbaseBackend'" },
    @{ From = "from '../firebase'";           To = "from '../backend/pocketbaseBackend'" },
    @{ From = "from '../../firebase'";        To = "from '../../backend/pocketbaseBackend'" },
    @{ From = 'testFirestoreConnection';      To = 'testPocketBaseConnection' },
    @{ From = 'isFirestoreQuotaExceeded';     To = 'isPocketBaseUnavailable' },
    @{ From = 'handleFirestoreError';        To = 'handleBackendError' },
    @{ From = 'sanitizeForFirestore';        To = 'sanitizeForDb' },
    @{ From = 'ERR_FIRESTORE_';              To = 'ERR_POCKETBASE_' },
    @{ From = "'FIRESTORE'";                 To = "'POCKETBASE'" },
    @{ From = "source: 'FIRESTORE'";         To = "source: 'POCKETBASE'" },
    @{ From = 'Firestore DB';                To = 'PocketBase DB' },
    @{ From = 'Firestore Error';             To = 'PocketBase Error' },
    @{ From = 'Firestore Quota';             To = 'PocketBase Server' },
    @{ From = 'Firestore Payload';           To = 'PocketBase Payload' },
    @{ From = 'Firestore Seeding';           To = 'PocketBase Seeding' },
    @{ From = 'Firestore Collection';         To = 'PocketBase Collection' },
    @{ From = 'Firestore Realtime';          To = 'PocketBase Realtime' },
    @{ From = 'Koneksi websocket Firestore';  To = 'Koneksi realtime PocketBase' },
    @{ From = 'Firestore snapshot';          To = 'PocketBase snapshot' },
    @{ From = 'Firestore tersinkron';        To = 'PocketBase tersinkron' },
    @{ From = 'Firestore timeout';           To = 'PocketBase timeout' },
    @{ From = 'sinkron ke Firestore';        To = 'sinkron ke PocketBase' },
    @{ From = 'Firestore';                   To = 'PocketBase' },
    @{ From = 'firestore';                   To = 'pocketbase' },
    @{ From = 'Firebase';                    To = 'PocketBase' },
    @{ From = 'firebase';                    To = 'pocketbase' }
)

$changedFiles = @()
foreach ($file in $targets) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    foreach ($r in $replacements) {
        $content = $content.Replace($r.From, $r.To)
    }
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content)
        $changedFiles += $file.FullName.Replace($root, '.')
    }
}
Write-Ok "$($changedFiles.Count) file diubah"
foreach ($f in $changedFiles) { Write-Host "      $f" -ForegroundColor DarkGray }

# ---------------------------------------------------------------- 4. HAPUS FIREBASE
Write-Step "4/8 Menghapus modul Firebase"
$firebaseFile = Join-Path $root 'src\firebase.ts'
if (Test-Path $firebaseFile) {
    Remove-Item $firebaseFile -Force
    Write-Ok "src/firebase.ts dihapus"
} else {
    Write-Warn "src/firebase.ts tidak ada (sudah dihapus sebelumnya)"
}

# pastikan modul backend ada
$backendFile = Join-Path $root 'src\backend\pocketbaseBackend.ts'
if (-not (Test-Path $backendFile)) {
    Write-Fail "src/backend/pocketbaseBackend.ts tidak ditemukan! Backup: $BackupDir"
}
Write-Ok "src/backend/pocketbaseBackend.ts siap"

# ---------------------------------------------------------------- 5. SERVER PROXY
Write-Step "5/8 Menambahkan reverse proxy PocketBase di server.ts"
$serverContent = Get-Content $serverTs -Raw
if ($serverContent -notmatch '/api/pb') {
    $proxyBlock = @'

// ---------------------------------------------------------------------------
// Reverse proxy ke PocketBase (database + realtime + auth)
// DiISI otomatis oleh scripts/migrate-to-pocketbase.ps1
// ---------------------------------------------------------------------------
const POCKETBASE_UPSTREAM = process.env.POCKETBASE_UPSTREAM || 'http://127.0.0.1:8090';

app.use('/api/pb', (req, res) => {
  const target = `${POCKETBASE_UPSTREAM}${req.url.replace(/^\/api\/pb/, '')}`;
  const headers = { ...req.headers, host: undefined };
  delete headers['content-length'];
  fetch(target, {
    method: req.method,
    headers: headers as any,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    duplex: 'half',
  } as any)
    .then(async (upstream) => {
      res.status(upstream.status);
      upstream.headers.forEach((value: string, key: string) => {
        if (key.toLowerCase() === 'content-encoding' || key.toLowerCase() === 'content-length') return;
        res.setHeader(key, value);
      });
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    })
    .catch((err) => {
      console.error('[PocketBase Proxy] Gagal menghubungi PocketBase:', err.message);
      res.status(502).json({
        error: 'PocketBase tidak terjangkau',
        detail: err.message,
      });
    });
});
'@
    # sisipkan sebelum baris "app.listen" / sebelum app.use(express.static)
    $anchor = '// API routes FIRST'
    if ($serverContent.Contains($anchor)) {
        $serverContent = $serverContent.Replace($anchor, ($proxyBlock.TrimEnd() + "`n`n" + $anchor))
    } else {
        $serverContent = $serverContent.Replace("const app = express();", ("const app = express();`n" + $proxyBlock))
    }
    [System.IO.File]::WriteAllText($serverTs, $serverContent)
    Write-Ok "Proxy /api/pb ditambahkan"
} else {
    Write-Ok "Proxy /api/pb sudah ada"
}

# ---------------------------------------------------------------- 6. ENV
Write-Step "6/8 Menambahkan konfigurasi PocketBase ke .env"
$envFiles = @((Join-Path $root '.env'), (Join-Path $root '.env.example'))
$pbBlock = @"

# --- PocketBase (database + realtime + auth, self-hosted di VPS) ---
# development: http://localhost:8090 | production: https://bejodigitalprint.com/api/pb
VITE_POCKETBASE_URL=http://localhost:8090
# Akun sinkronisasi milik APLIKASI (password harus sama dengan di PocketBase)
# VITE_PB_SYNC_* sengaja tidak ditulis: variabel berprefix VITE_ ikut dibundel
# ke browser, sedangkan yang dibaca server hanya PB_SYNC_*.
PB_SYNC_EMAIL=sync@bejo.local
PB_SYNC_PASSWORD=sync_password_bejo_2026
POCKETBASE_UPSTREAM=http://127.0.0.1:8090
"@
foreach ($ef in $envFiles) {
    if (Test-Path $ef) {
        $c = Get-Content $ef -Raw
        if ($c -notmatch 'VITE_POCKETBASE_URL') {
            Add-Content -Path $ef -Value $pbBlock
            Write-Ok "$(Split-Path $ef -Leaf) diperbarui"
        } else {
            Write-Ok "$(Split-Path $ef -Leaf) sudah punya konfigurasi PocketBase"
        }
    }
}

# ---------------------------------------------------------------- 7. DEPS + CHECK
Write-Step "7/8 Installing dependensi & pengecekan"
$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
if ($pkg.dependencies.PSObject.Properties.Name -contains 'pocketbase') {
    Write-Ok "pocketbase sudah ada di package.json"
} else {
    $pkg.dependencies | Add-Member -NotePropertyName 'pocketbase' -NotePropertyValue '^0.28.1' -Force
    $pkg | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $root 'package.json')
    Write-Ok "pocketbase ditambahkan ke package.json"
}
if ($pkg.dependencies.PSObject.Properties.Name -contains 'firebase') {
    $pkg.dependencies.PSObject.Properties.Remove('firebase')
    $pkg | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $root 'package.json')
    Write-Ok "firebase dihapus dari package.json"
}
if ($pkg.dependencies.PSObject.Properties.Name -contains '@google/genai') {
    $pkg.dependencies.PSObject.Properties.Remove('@google/genai')
    $pkg | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $root 'package.json')
    Write-Ok "@google/genai dihapus dari package.json"
}

Write-Host "   Menjalankan npm install..." -ForegroundColor Yellow
# Native command di PowerShell 5.1 menulis stderr sebagai error record;
# matikan ErrorActionPreference sementara agar script tidak terhenti.
$ErrorActionPreference = 'Continue'
& cmd /c "npm install" 2>&1 | Select-Object -Last 3

# ---------------------------------------------------------------- 8. TSC + BUILD
Write-Step "8/8 Type-check & build"
Write-Host "   tsc --noEmit..." -ForegroundColor Yellow
& cmd /c "npx tsc --noEmit" 2>&1 | Select-Object -First 25
$tscOk = ($LASTEXITCODE -eq 0)
if ($tscOk) { Write-Ok "Type-check lulus" } else { Write-Warn "Type-check masih ada error (lihat di atas)" }

Write-Host "   npm run build..." -ForegroundColor Yellow
& cmd /c "npm run build" 2>&1 | Select-String -Pattern "built in|error|Error" | Select-Object -Last 5
$buildOk = ($LASTEXITCODE -eq 0)
if ($buildOk) { Write-Ok "Build produksi berhasil" } else { Write-Warn "Build gagal (lihat di atas)" }
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- RINGKASAN
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " MIGRASI FIREBASE -> POCKETBASE SELESAI" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " Backup          : $BackupDir" -ForegroundColor White
Write-Host " Module backend  : src\backend\pocketbaseBackend.ts" -ForegroundColor White
Write-Host " Client          : src\lib\pocketbase.ts" -ForegroundColor White
Write-Host " Type-check      : $(if($tscOk){'LULUS'}else{'PERLU PERBAIKAN'})" -ForegroundColor White
Write-Host " Build           : $(if($buildOk){'BERHASIL'}else{'GAGAL'})" -ForegroundColor White
Write-Host ""
Write-Host " LANGKAH BERIKUTNYA:" -ForegroundColor Yellow
Write-Host " 1. Jalankan PocketBase di VPS (C:\pocketbase\pocketbase.exe serve --http=0.0.0.0:8090)" -ForegroundColor White
Write-Host " 2. Buka http://IP_VPS:8090/_/ -> buat admin + user sinkronisasi" -ForegroundColor White
Write-Host " 3. Jalankan skrip migrasi data: scripts\migrate-firestore-to-pocketbase.ps1" -ForegroundColor White
Write-Host " 4. Jalankan: npm run build && restart service BejoStikerPOS" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
