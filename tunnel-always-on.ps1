<#
=====================================================================
  BEJO STIKER POS - Supervisor Terowongan Internet (Always On)
=====================================================================
  Menjalankan terowongan Cloudflare secara terus-menerus:
    - Restart otomatis bila koneksi putus / proses berhenti
    - URL publik langsung terdeteksi & disimpan ke:
        %TEMP%\bejo-tunnel-url.txt
        <project>\URL-INTERNET.txt
        <project>\dist\URL-INTERNET.txt
    - Log: %TEMP%\bejo-tunnel.log

  JIKA .env memuat CLOUDFLARE_TUNNEL_TOKEN, digunakan terowongan
  BERSAMA (named tunnel) => URL TETAP / tidak berubah.
  Selain itu memakai quick tunnel => URL berubah tiap start,
  namun alamat terbaru SELALU tersimpan di file di atas.

  Auto-start melalui folder Startup (dipasang oleh pasang-always-on.ps1)
=====================================================================
#>

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
if (-not (Test-Path $cloudflared)) {
  $cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cfCmd) { $cloudflared = $cfCmd.Source } else { $cloudflared = '' }
}

$log = Join-Path $env:TEMP 'bejo-tunnel.log'
$logErr = Join-Path $env:TEMP 'bejo-tunnel-error.log'
$urlFile = Join-Path $env:TEMP 'bejo-tunnel-url.txt'
$urlFileProject = Join-Path $root 'URL-INTERNET.txt'
$urlFileDist = Join-Path $root 'dist\URL-INTERNET.txt'

# --- Ambil token terowongan bersama (opsional) dari .env ---
$token = ''
$fixedUrl = ''
$envPath = Join-Path $root '.env'
if (Test-Path $envPath) {
  $lines = Get-Content $envPath
  $t = $lines | Where-Object { $_ -match '^\s*CLOUDFLARE_TUNNEL_TOKEN\s*=' } | Select-Object -First 1
  if ($t) { $token = ($t -replace '^\s*CLOUDFLARE_TUNNEL_TOKEN\s*=', '').Trim().Trim('"').Trim("'") }
  $u = $lines | Where-Object { $_ -match '^\s*CLOUDFLARE_PUBLIC_URL\s*=' } | Select-Object -First 1
  if ($u) { $fixedUrl = ($u -replace '^\s*CLOUDFLARE_PUBLIC_URL\s*=', '').Trim().Trim('"').Trim("'") }
}

# --- Username remote access (ditampilkan di file URL) ---
$userName = 'bejo'
if (Test-Path $envPath) {
  $u = (Get-Content $envPath) | Where-Object { $_ -match '^\s*REMOTE_ACCESS_USER\s*=' } | Select-Object -First 1
  if ($u) { $userName = ($u -replace '^\s*REMOTE_ACCESS_USER\s*=', '').Trim() }
}

function Write-Log($text) {
  $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  Add-Content -Path $log -Value "[$stamp] $text" -Encoding UTF8
}

function Save-Url($url) {
  if (-not $url) { return }
  $content = @"
BEJO STIKER POS - ALAMAT AKSES INTERNET
=====================================
$url

Username : $userName
Diperbarui : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@
  Set-Content -Path $urlFile -Value $content -Encoding UTF8
  Set-Content -Path $urlFileProject -Value $content -Encoding UTF8
  if (Test-Path (Join-Path $root 'dist')) {
    Set-Content -Path $urlFileDist -Value $content -Encoding UTF8
  }
  Write-Log "URL publik aktif: $url"
}

if (-not $cloudflared) {
  Write-Log "cloudflared tidak ditemukan - terowongan tidak dijalankan."
  while ($true) { Start-Sleep -Seconds 60 }
}

if ($token) {
  Write-Log "Menggunakan terowongan BERSAMA (named tunnel) - URL stabil."
  if ($fixedUrl) { Save-Url $fixedUrl }
} else {
  Write-Log "Menggunakan quick tunnel - URL berubah tiap start (tersimpan di URL-INTERNET.txt)."
}

while ($true) {
  if (Test-Path (Join-Path $root '.stop-supervisor')) {
    Remove-Item (Join-Path $root '.stop-supervisor') -Force -ErrorAction SilentlyContinue
    Write-Log "Sinyal stop diterima - supervisor berhenti."
    break
  }
  $proc = $null
  try {
    foreach ($f in @($log, $logErr)) { if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue } }

    if ($token) {
      $args = @('tunnel', '--no-autoupdate', 'run', '--token', $token)
    } else {
      $args = @('tunnel', '--url', 'http://localhost:3000', '--no-autoupdate')
    }

    $proc = Start-Process -FilePath $cloudflared -ArgumentList $args -RedirectStandardOutput $log -RedirectStandardError $logErr -NoNewWindow -PassThru
    Write-Log "Terowongan dimulai (PID $($proc.Id))."

    $detected = $fixedUrl
    while (-not $proc.HasExited) {
      # deteksi URL publik selagi proses berjalan
      if (-not $detected) {
        foreach ($f in @($log, $logErr)) {
          if (Test-Path $f) {
            $m = Select-String -Path $f -Pattern 'https://[a-z0-9][a-z0-9-]*\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($m) { $detected = [regex]::Match($m.Line, 'https://[a-z0-9][a-z0-9-]*\.trycloudflare\.com').Value; break }
          }
        }
        if ($detected) { Save-Url $detected }
      }
      Start-Sleep -Seconds 3
    }

    Write-Log "Terowongan berhenti (exit $($proc.ExitCode)) - reconnect in 5 detik..."
  } catch {
    Write-Log "Error: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 5
}
