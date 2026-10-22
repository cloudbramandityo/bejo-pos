$Domain = "bejodigitalprint.com"
$AppDir = "C:\bejo-pos"
$PB_DIR = "C:\pocketbase"
$PB_DATA = "C:\pocketbase\pb_data"
$CaddyDir = "C:\caddy"
$NssmDir = "C:\nssm"

$Total = 0
$Pass = 0

function Check {
    param($cat, $name, $ok, $det = "", $act = "")
    $global:Total++
    if ($ok) { $global:Pass++; Write-Host "  [+] $cat: $name" -ForegroundColor Green }
    else { Write-Host "  [-] $cat: $name" -ForegroundColor Red }
    if ($det) { Write-Host "    -> $det" -ForegroundColor DarkGray }
    if ($act) { Write-Host "    -> Tindakan: $act" -ForegroundColor Cyan }
}

function Section($title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
}

Write-Host "===================================================================" -ForegroundColor Green
Write-Host " BEJO STIKER POS - VPS WINDOWS STATUS CHECKER" -ForegroundColor Green
Write-Host " Domain: $Domain"
Write-Host " Waktu: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "===================================================================" -ForegroundColor Green

Section "A. PRASYARAT SISTEM"
$os = Get-CimInstance Win32_OperatingSystem
$isServer = $os.Caption -like "*Server*"
Check "OS" "Windows Server" $isServer "$($os.Caption) v$($os.Version)" "Install Windows Server 2019/2022"

$ram = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
Check "RAM" "RAM >= 4GB" ($ram -ge 4) "$ram GB" "Upgrade RAM VPS"

$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
Check "CPU" "CPU >= 2 cores" ($cpu -ge 2) "$cpu cores" "Upgrade paket VPS"

$diskFree = (Get-PSDrive C).Free / 1GB
Check "Disk" "Disk C: >= 40GB free" ($diskFree -ge 40) "$([math]::Round($diskFree,1)) GB" "Bersihkan disk / upgrade SSD"

$ipPub = try { (Invoke-WebRequest "https://api.ipify.org" -UseBasicParsing -TimeoutSec 5).Content.Trim() } catch { "Tidak terdeteksi" }
Check "Network" "IP Publik" ($ipPub -ne "Tidak terdeteksi") "IP: $ipPub" "Cek koneksi internet VPS"

Section "B. SOFTWARE UTAMA"
$nodeOK = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
    $v = node -v 2>&1 | Select-Object -First 1
    $m = [int]($v -replace '^v(\d+).*', '$1')
    Check "Node.js" "Node.js v20+" ($m -ge 20) "v$m" "Install Node.js 22 LTS"
} else {
    Check "Node.js" "Node.js" $false "Tidak ditemukan" "Install Node.js 22 LTS"
}
Check "NPM" "npm" (Get-Command npm -ErrorAction SilentlyContinue)
Check "Git" "Git" (Get-Command git -ErrorAction SilentlyContinue)

$caddyOK = Test-Path "C:\caddy\caddy.exe"
if ($caddyOK) { $v = & "C:\caddy\caddy.exe" version 2>&1 | Select-Object -First 1; Check "Caddy" "Caddy" $true "v$($v -replace 'v','')" }
else { Check "Caddy" "Caddy" $false "Tidak ditemukan" "Install Caddy" }

Check "NSSM" "NSSM" (Test-Path "C:\nssm\nssm.exe")

$pbOK = Test-Path "C:\pocketbase\pocketbase.exe"
if ($pbOK) { $v = & "C:\pocketbase\pocketbase.exe" --version 2>&1 | Select-Object -First 1; Check "PocketBase" "PocketBase v0.28.1" ($v -like "*0.28.1*") "v$($v -replace 'v','')" }
else { Check "PocketBase" "PocketBase" $false "Tidak ditemukan" "Install PocketBase v0.28.1" }

Section "C. STRUKTUR FOLDER"
"C:\bejo-pos","C:\bejo-pos\dist","C:\bejo-pos\logs","C:\pocketbase\pb_data","C:\pocketbase\logs","C:\caddy\logs","C:\backups\bejo-pos" | ForEach-Object {
    Check "Folder" $_.Split('\')[-1] (Test-Path $_) $_
}

Section "D. SERVICE WINDOWS (NSSM)"
"BejoStikerPOS","Caddy","PocketBase" | ForEach-Object {
    $s = Get-Service $_ -ErrorAction SilentlyContinue
    $installed = $s -ne $null
    Check "Service $_" "installed" $installed
    if ($installed) {
        Check "Service $_" "running" ($s.Status -eq 'Running') $s.Status
        $auto = (Get-CimInstance Win32_Service -Filter "Name='$_'").StartMode
        Check "Service $_" "auto-start" ($auto -eq 'Auto') "StartMode: $auto"
        $recovery = (Get-CimInstance Win32_Service -Filter "Name='$_'").ExitAction
        Check "Service $_" "auto-restart" ($recovery -eq 'Restart') "ExitAction: $recovery"
    }
}

Section "E. FIREWALL"
80,443,3389 | ForEach-Object {
    $r = Get-NetFirewallRule -DisplayName "*$_*" -Direction Inbound -ErrorAction SilentlyContinue
    $en = $r | Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Allow' }
    Check "Firewall $_" "open" ($en -ne $null)
}
3000,8090 | ForEach-Object {
    $r = Get-NetFirewallRule -DisplayName "*$_*" -Direction Inbound -ErrorAction SilentlyContinue
    $en = $r | Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Allow' }
    $ok = -not $en
    $detail = if ($en) { "OPEN (WRONG)" } else { "BLOCKED (OK)" }
    Check "Firewall $_" "blocked from internet" $ok $detail
}

Section "F. CADDY"
$caddyfile = "C:\caddy\Caddyfile"
$caddyfileApp = "C:\bejo-pos\deploy\Caddyfile.windows"
$caddyfileOK = Test-Path $caddyfile
Check "Caddy" "Caddyfile exists" $caddyfileOK
if ($caddyfileOK -and (Test-Path $caddyfileApp)) {
    $c1 = Get-Content $caddyfile -Raw
    $c2 = Get-Content $caddyfileApp -Raw
    $sync = ($c1 -replace '\r','') -eq ($c2 -replace '\r','')
    Check "Caddy" "in sync with app" $sync
}
Check "Caddy" "route /api/pb" ($c1 -match '/api/pb')
Check "Caddy" "domain $Domain" ($c1 -match $Domain)

Section "G. POCKETBASE"
$pbSvc = Get-Service PocketBase -ErrorAction SilentlyContinue
Check "PB Service" "running" ($pbSvc -and $pbSvc.Status -eq 'Running') $pbSvc.Status

try {
    $h = Invoke-WebRequest "http://127.0.0.1:8090/api/health" -TimeoutSec 5 -UseBasicParsing
    Check "PB Health" "OK" ($h.StatusCode -eq 200) "HTTP $($h.StatusCode)"
} catch {
    Check "PB Health" "OK" $false $_.Exception.Message
}

Section "H. APP"
Check "App" "package.json" (Test-Path "C:\bejo-pos\package.json")
Check "App" "dist/ built" (Test-Path "C:\bejo-pos\dist")
Check "App" "server.cjs" (Test-Path "C:\bejo-pos\dist\server.cjs")
Check "App" ".env file" (Test-Path "C:\bejo-pos\.env")

if (Test-Path "C:\bejo-pos\.env") {
    $env = Get-Content "C:\bejo-pos\.env" -Raw
    "APP_URL","GEMINI_API_KEY","REMOTE_ACCESS_USER","REMOTE_ACCESS_PASS","PORT",
    "VITE_POCKETBASE_URL","VITE_PB_SYNC_EMAIL","VITE_PB_SYNC_PASSWORD","POCKETBASE_UPSTREAM" | ForEach-Object {
        Check "Env" "Var $_" ($env -match "^$_=")
    }
}

Section "I. DNS & SSL"
try {
    $s = Invoke-WebRequest "https://bejodigitalprint.com" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Check "SSL" "HTTPS $Domain" $true "HTTP $($s.StatusCode)"
} catch {
    Check "SSL" "HTTPS $Domain" $false $_.Exception.Message
}

Section "J. POCKETBASE DATA"
Check "PB Data" "27 collections" $false "Run: node scripts/create-pocketbase-collections.mjs --drop"
Check "PB Data" "Original data imported" $false "Run: node scripts/import-original-data.mjs"
Check "PB Auth" "Sync user (sync@bejo.local)" $false "Create via Admin UI"
Check "PB Auth" "Admin user" $false "pocketbase.exe superuser create admin@bejodigitalprint.com <pass>"

# Summary
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  RINGKASAN" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  (Run this script on VPS to see full results)"
Write-Host "===================================================================" -ForegroundColor Green