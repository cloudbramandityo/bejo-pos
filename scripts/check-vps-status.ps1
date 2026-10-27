<# 
=======================================================================
  BEJO Digital Print - VPS Windows Status Checker (Rumah Web)
=======================================================================
  Memeriksa status keseluruhan setup VPS Windows untuk deployment
  BEJO Digital Print dengan PocketBase (self-hosted database + realtime).

  Jalankan di VPS (PowerShell Administrator):
      powershell -ExecutionPolicy Bypass -File C:\bejo-pos\scripts\check-vps-status.ps1

  Output: 
    - Status setiap komponen (+ Selesai / - Belum / ! Perlu perhatian)
    - Ringkasan persentase kelengkapan
    - Daftar tindakan yang diperlukan
=======================================================================
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Domain       = "bejodigitalprint.com"
$AppDir       = "C:\bejo-pos"
$PB_DIR       = "C:\pocketbase"
$PB_DATA      = "C:\pocketbase\pb_data"
$CaddyDir     = "C:\caddy"
$NssmDir      = "C:\nssm"
$NodeVerMin   = "20"
$PBVersion    = "0.28.1"

$Results = @()
$TotalChecks = 0
$PassedChecks = 0

function Add-Result {
    param(
        [string]$Category,
        [string]$Check,
        [bool]$Passed,
        [string]$Details = "",
        [string]$Action = ""
    )
    $TotalChecks++
    if ($Passed) { $PassedChecks++ }
    $Results += [PSCustomObject]@{
        Category   = $Category
        Check      = $Check
        Status     = if ($Passed) { "[+] SELESAI" } else { "[-] BELUM" }
        Details    = $Details
        Action     = $Action
    }
}

function Write-Header { param($t) Write-Host ""; Write-Host "============================================================" -ForegroundColor DarkCyan; Write-Host " $t" -ForegroundColor Cyan; Write-Host "============================================================" -ForegroundColor DarkCyan }

Write-Host "===================================================================" -ForegroundColor Green
Write-Host " BEJO Digital Print - VPS WINDOWS STATUS CHECKER" -ForegroundColor Green
Write-Host " Domain: $Domain" -ForegroundColor White
Write-Host " Waktu:  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
Write-Host "===================================================================" -ForegroundColor Green

# ====================================================================
# A. PRASYARAT SISTEM
# ====================================================================
Write-Header "A. PRASYARAT SISTEM OPERASI"

# A1: Windows Version
$os = Get-CimInstance Win32_OperatingSystem
$osName = $os.Caption
$osVer  = $os.Version
$isServer = $osName -like "*Server*"
Add-Result "OS" "Windows Server Edition" $isServer "Terdeteksi: $osName v$osVer" "Install Windows Server 2019/2022"

# A2: Resources
$ramGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$cpuCores = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
$diskFree = (Get-PSDrive C).Free / 1GB
$ramOK = $ramGB -ge 4
$cpuOK = $cpuCores -ge 2
$diskOK = $diskFree -ge 40
Add-Result "Resources" "RAM minimal 4 GB" $ramOK "$ramGB GB" "Upgrade RAM VPS"
Add-Result "Resources" "CPU minimal 2 vCPU" $cpuOK "$cpuCores cores" "Upgrade paket VPS"
Add-Result "Resources" "Disk C: minimal 40 GB free" $diskOK "$([math]::Round($diskFree,1)) GB free" "Bersihkan disk / upgrade SSD"

# A3: Network
$ipPub = try { (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 5).Content.Trim() } catch { "Tidak terdeteksi" }
$dnsResolved = try { (Resolve-DnsName $Domain -Type A -ErrorAction SilentlyContinue).IPAddress -contains $ipPub } catch { $false }
Add-Result "Network" "IP Publik terdeteksi" ($ipPub -ne "Tidak terdeteksi") "IP: $ipPub" "Cek koneksi internet VPS"
Add-Result "Network" "DNS $Domain -> IP VPS" $dnsResolved "DNS resolved: $($dnsResolved)" "Setup A record di panel domain"

# ====================================================================
# B. SOFTWARE UTAMA
# ====================================================================
Write-Header "B. SOFTWARE UTAMA DAN VERSI"

# B1: Node.js
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if ($nodeInstalled) {
    $nodeVer = node -v 2>&1 | Select-Object -First 1
    $nodeMajor = [int]($nodeVer -replace '^v(\d+).*', '$1')
    $nodeOK = $nodeMajor -ge 20
    Add-Result "Node.js" "Node.js v20+ terpasang" $nodeOK "v$nodeMajor" "Install Node.js 22 LTS dari nodesource"
} else {
    Add-Result "Node.js" "Node.js terpasang" $false "Tidak ditemukan" "Install Node.js 22 LTS"
}

# B2: NPM
$npmInstalled = Get-Command npm -ErrorAction SilentlyContinue
Add-Result "NPM" "npm tersedia" ($npmInstalled -ne $null) "" "Install Node.js (include npm)"

# B3: Git
$gitInstalled = Get-Command git -ErrorAction SilentlyContinue
Add-Result "Git" "Git terpasang" ($gitInstalled -ne $null) "" "Install Git for Windows"

# B4: Caddy
$caddyExe = "$CaddyDir\caddy.exe"
$caddyOK = Test-Path $caddyExe
if ($caddyOK) {
    $caddyVer = & $caddyExe version 2>&1 | Select-Object -First 1
    Add-Result "Caddy" "Caddy terpasang" $true "v$($caddyVer -replace 'v','')" ""
} else {
    Add-Result "Caddy" "Caddy terpasang" $false "Tidak ditemukan di $CaddyDir" "Jalankan install-vps-windows.ps1 atau unduh manual"
}

# B5: NSSM
$nssmExe = "$NssmDir\nssm.exe"
$nssmOK = Test-Path $nssmExe
Add-Result "NSSM" "NSSM terpasang" $nssmOK "Path: $nssmExe" "Download nssm-2.24.zip, ekstrak ke C:\nssm"

# B6: PocketBase
$pbExe = "$PB_DIR\pocketbase.exe"
$pbOK = Test-Path $pbExe
if ($pbOK) {
    $pbVer = & $pbExe --version 2>&1 | Select-Object -First 1
    Add-Result "PocketBase" "PocketBase v$PBVersion terpasang" ($pbVer -like "*$PBVersion*") "v$($pbVer -replace 'v','')" "Download PocketBase $PBVersion ke $PB_DIR"
} else {
    Add-Result "PocketBase" "PocketBase terpasang" $false "Tidak ditemukan" "Download PocketBase $PBVersion ke $PB_DIR"
}

# ====================================================================
# C. FOLDER STRUKTUR & PERMISSION
# ====================================================================
Write-Header "C. STRUKTUR FOLDER DAN HAK AKSES"

$folders = @(
    @{ Path = $AppDir; Name = "App Directory" },
    @{ Path = "$AppDir\dist"; Name = "Build Output" },
    @{ Path = "$AppDir\logs"; Name = "App Logs" },
    @{ Path = $PB_DATA; Name = "PocketBase Data" },
    @{ Path = "$PB_DIR\logs"; Name = "PB Logs" },
    @{ Path = "$CaddyDir\logs"; Name = "Caddy Logs" },
    @{ Path = "C:\backups\bejo-pos"; Name = "Backup Folder" }
)

foreach ($f in $folders) {
    $exists = Test-Path $f.Path
    Add-Result "Folders" $f.Name $exists $f.Path "New-Item -Path '$($f.Path)' -ItemType Directory -Force"
}

# ====================================================================
# D. SERVICE WINDOWS (NSSM)
# ====================================================================
Write-Header "D. SERVICE WINDOWS (NSSM)"

$services = @(
    @{ Name = "BejoStikerPOS"; DisplayName = "BEJO Digital Print App"; Exe = "node.exe"; Args = "$AppDir\dist\server.cjs" },
    @{ Name = "Caddy"; DisplayName = "Caddy Reverse Proxy"; Exe = "$CaddyDir\caddy.exe"; Args = "run --config $CaddyDir\Caddyfile" },
    @{ Name = "PocketBase"; DisplayName = "PocketBase Database"; Exe = "$PB_DIR\pocketbase.exe"; Args = "serve --http=127.0.0.1:8090 --dir=$PB_DATA" }
)

foreach ($svc in $services) {
    $svcObj = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
    $installed = $svcObj -ne $null
    $running = $installed -and $svcObj.Status -eq 'Running'
    $autoStart = $installed -and (Get-CimInstance Win32_Service -Filter "Name='$($svc.Name)'").StartMode -eq 'Auto'
    
    Add-Result "Service" "$($svc.Name) installed" $installed "" "nssm install $($svc.Name) `$($svc.Exe) `$($svc.Args)"
    Add-Result "Service" "$($svc.Name) running" $running "Status: $($svcObj.Status)" "nssm start $($svc.Name)"
    Add-Result "Service" "$($svc.Name) auto-start" $autoStart "StartMode: $(if($installed){(Get-CimInstance Win32_Service -Filter \"Name='$($svc.Name)'\").StartMode}else{'N/A'})" "nssm set $($svc.Name) Start SERVICE_AUTO_START"
    
    # NSSM recovery
    if ($installed) {
        $recovery = (Get-CimInstance Win32_Service -Filter "Name='$($svc.Name)'").ExitAction
        $recoveryOK = $recovery -eq 'Restart'
        Add-Result "Service" "$($svc.Name) auto-restart on fail" $recoveryOK "ExitAction: $recovery" "nssm set $($svc.Name) AppExit Default Restart"
    }
}

# ====================================================================
# E. FIREWALL WINDOWS
# ====================================================================
Write-Header "E. FIREWALL WINDOWS DEFENDER"

$ports = @(
    @{ Port = 80; Proto = 'TCP'; Name = 'HTTP' },
    @{ Port = 443; Proto = 'TCP'; Name = 'HTTPS' },
    @{ Port = 3389; Proto = 'TCP'; Name = 'RDP' },
    @{ Port = 3000; Proto = 'TCP'; Name = 'Node App (internal only)' },
    @{ Port = 8090; Proto = 'TCP'; Name = 'PocketBase (internal only)' }
)

foreach ($p in $ports) {
    $ruleIn = Get-NetFirewallRule -DisplayName "*$($p.Name)*" -Direction Inbound -ErrorAction SilentlyContinue
    $ruleExists = $ruleIn -ne $null
    $ruleEnabled = $ruleIn | Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Allow' }
    $enabled = $ruleEnabled -ne $null
    
    # Port 3000 & 8090 should be blocked from internet (allow only local)
    $shouldBlock = $p.Port -in @(3000, 8090)
    if ($shouldBlock) {
        $correct = -not $enabled # Should be blocked from internet
        $detail = if ($enabled) { "TERBUKA KE INTERNET (SALAH)" } else { "Tertutup dari internet (BENAR)" }
        Add-Result "Firewall" "Port $($p.Port) $($p.Name) blocked from internet" $correct $detail "Set rule block for 0.0.0.0/0, allow 127.0.0.1 only"
    } else {
        Add-Result "Firewall" "Port $($p.Port) $($p.Name) open" $enabled "Rule: $($ruleIn.DisplayName)" "New-NetFirewallRule -DisplayName '$($p.Name)' -Direction Inbound -Action Allow -Protocol $($p.Proto) -LocalPort $($p.Port)"
    }
}

# ====================================================================
# F. CADDY KONFIGURASI
# ====================================================================
Write-Header "F. CADDY KONFIGURASI DAN TLS"

$caddyfile = "$CaddyDir\Caddyfile"
$caddyfileApp = "$AppDir\deploy\Caddyfile.windows"
$caddyfileOK = Test-Path $caddyfile
$caddyfileSync = $false
if ($caddyfileOK -and Test-Path $caddyfileApp) {
    $c1 = Get-Content $caddyfile -Raw
    $c2 = Get-Content $caddyfileApp -Raw
    $caddyfileSync = ($c1 -replace '\r','') -eq ($c2 -replace '\r','')
}

Add-Result "Caddy" "Caddyfile exists" $caddyfileOK "Path: $caddyfile" "Copy from $caddyfileApp"
Add-Result "Caddy" "Caddyfile in sync with app" $caddyfileSync "" "Copy-Item $caddyfileApp $caddyfile -Force; caddy fmt --overwrite $caddyfile"
Add-Result "Caddy" "Route /api/pb to PocketBase" ($c1 -match '/api/pb') "Found /api/pb route" "Add 'handle /api/pb/* { reverse_proxy 127.0.0.1:8090 }' to Caddyfile"
Add-Result "Caddy" "Domain $Domain configured" ($c1 -match $Domain) "Domain found in Caddyfile" "Update Caddyfile domain"

# ====================================================================
# G. POCKETBASE STATUS
# ====================================================================
Write-Header "G. POCKETBASE DATABASE DAN KOLEKSI"

if ($pbOK) {
    # Service running
    $pbSvc = Get-Service PocketBase -ErrorAction SilentlyContinue
    $pbRunning = $pbSvc -and $pbSvc.Status -eq 'Running'
    Add-Result "PocketBase" "Service running" $pbRunning "Status: $($pbSvc.Status)" "Start-Service PocketBase"
    
    # Health check
    try {
        $h = Invoke-WebRequest "http://127.0.0.1:8090/api/health" -UseBasicParsing -TimeoutSec 5
        $healthOK = $h.StatusCode -eq 200
        Add-Result "PocketBase" "Health check OK" $healthOK "HTTP $($h.StatusCode)" "Check PocketBase logs: $PB_DIR\logs\stderr.log"
    } catch {
        Add-Result "PocketBase" "Health check OK" $false "Cannot connect: $($_.Exception.Message)" "Start-Service PocketBase; check port 8090"
    }
}

# ====================================================================
# H. APLIKASI (NODE + BUILD)
# ====================================================================
Write-Header "H. APLIKASI NODE.JS DAN BUILD"

$pkgJson = "$AppDir\package.json"
$distDir = "$AppDir\dist"
$serverCjs = "$distDir\server.cjs"
$envFile = "$AppDir\.env"

Add-Result "App" "package.json exists" (Test-Path $pkgJson) "" "Upload source code ke $AppDir"
Add-Result "App" "dist/ exists (built)" (Test-Path $distDir) "" "cd $AppDir; npm run build"
Add-Result "App" "server.cjs exists" (Test-Path $serverCjs) "" "cd $AppDir; npm run build"
Add-Result "App" ".env file exists" (Test-Path $envFile) "" "Copy .env.example to .env and fill values"

if (Test-Path $envFile) {
    $env = Get-Content $envFile -Raw
    $reqVars = @(
        'APP_URL', 'GEMINI_API_KEY', 'REMOTE_ACCESS_USER', 'REMOTE_ACCESS_PASS', 'PORT',
        'VITE_POCKETBASE_URL', 'VITE_PB_SYNC_EMAIL', 'VITE_PB_SYNC_PASSWORD', 'POCKETBASE_UPSTREAM'
    )
    foreach ($v in $reqVars) {
        $has = $env -match "^$v="
        Add-Result "Env" "Var $v defined" $has "" "Add $v=... to .env"
    }
}

# ====================================================================
# I. DNS & SSL
# ====================================================================
Write-Header "I. DNS DAN SSL (CADDY)"

# SSL check
try {
    $ssl = Invoke-WebRequest "https://$Domain" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    $sslOK = $true
    $sslDetail = "HTTPS OK (HTTP $($ssl.StatusCode))"
} catch {
    $sslOK = $false
    $sslDetail = "Gagal: $($_.Exception.Message)"
}
Add-Result "SSL" "HTTPS $Domain accessible" $sslOK $sslDetail "Check Caddy logs; ensure port 80/443 open; DNS propagated"

# ====================================================================
# J. POCKETBASE KOLEKSI & DATA
# ====================================================================
Write-Header "J. KOLEKSI POCKETBASE DAN DATA UTAMA"

$expectedCollections = @(
    'products', 'product_categories', 'customers', 'customer_categories',
    'suppliers', 'agents', 'transactions', 'shifts', 'stock_transactions',
    'users', 'cashiers', 'activity_logs', 'settings',
    'store_profiles', 'custom_roles', 'agent_notifications',
    'spk_orders', 'machines', 'invoices', 'invoice_settings',
    'taxpayer_profile', 'tax_annual_returns', 'tax_monthly_billings'
)
Add-Result "PB Data" "27 koleksi dibuat" $false "Perlu cek via Admin UI atau script" "Jalankan: node scripts/create-pocketbase-collections.mjs --drop"
Add-Result "PB Data" "Data original terimport" $false "Perlu cek via Admin UI" "Jalankan: node scripts/import-original-data.mjs"
Add-Result "PB Auth" "Sync user (sync@bejo.local) exists" $false "" "Buat user di Admin UI atau via script"
Add-Result "PB Auth" "Admin user exists" $false "" "pocketbase.exe superuser create admin@$Domain <password>"

# ====================================================================
# K. RINGKASAN AKHIR
# ====================================================================
Write-Header "K. RINGKASAN STATUS"

$pct = if ($TotalChecks -gt 0) { [math]::Round($PassedChecks / $TotalChecks * 100) } else { 0 }
$statusColor = if ($pct -ge 90) { 'Green' } elseif ($pct -ge 70) { 'Yellow' } else { 'Red' }

Write-Host ""
Write-Host "  Total Checks  : $TotalChecks" -ForegroundColor White
Write-Host "  Passed        : $PassedChecks" -ForegroundColor Green
Write-Host "  Failed        : $($TotalChecks - $PassedChecks)" -ForegroundColor Red
Write-Host "  Completeness  : $pct %" -ForegroundColor $statusColor
Write-Host ""

# Failed items
$failed = $Results | Where-Object { $_.Status -eq '[-] BELUM' }
if ($failed.Count -gt 0) {
    Write-Host "  ==== ITEM YANG BELUM SELESAI ====" -ForegroundColor Red
    $failed | Group-Object Category | ForEach-Object {
        Write-Host "  [$($_.Name)]" -ForegroundColor Yellow
        $_.Group | ForEach-Object {
            Write-Host "    - $($_.Check)" -ForegroundColor Red
            if ($_.Details) { Write-Host "      -> $($_.Details)" -ForegroundColor DarkGray }
            if ($_.Action) { Write-Host "      -> Tindakan: $($_.Action)" -ForegroundColor Cyan }
        }
    }
} else {
    Write-Host "  Semua check selesai!" -ForegroundColor Green
}

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green

# Export to JSON for CI/CD
$outFile = "$AppDir\vps-status-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$report = @{
    Timestamp     = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'
    Domain        = $Domain
    TotalChecks   = $TotalChecks
    Passed        = $PassedChecks
    Failed        = $TotalChecks - $PassedChecks
    Percentage    = $pct
    Results       = $Results
}
$report | ConvertTo-Json -Depth 4 | Set-Content $outFile -Encoding UTF8
Write-Host "  Report saved to: $outFile" -ForegroundColor DarkCyan
Write-Host "===================================================================" -ForegroundColor Green

exit $($TotalChecks - $PassedChecks)