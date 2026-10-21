<#
=====================================================================
  BEJO STIKER POS - Supervisor Server (Always On)
=====================================================================
  Menjalankan server aplikasi (produksi) secara terus-menerus:
    - Restart otomatis bila proses berhenti / error
    - Log: %TEMP%\bejo-server.log
    - Berjalan tanpa jendela (dijalankan oleh Task Scheduler)

  Dijalankan otomatis oleh Task Scheduler "BejoStikerPOS-Server"
  (trigger: saat pengguna login) sehingga aplikasi selalu hidup.
=====================================================================
#>

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:NODE_ENV = "production"
$env:DISABLE_HMR = "true"

$log = Join-Path $env:TEMP 'bejo-server.log'
$port = 3000

function Write-Log($text) {
  $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  Add-Content -Path $log -Value "[$stamp] $text"
}

# Hentikan proses lama milik proyek ini pada port 3000 (biar tidak bentrok)
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $existing) {
  $pidToStop = $conn.OwningProcess
  try {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$pidToStop"
    if ($proc -and $proc.CommandLine -and $proc.CommandLine -like "*$root*") {
      Write-Log "Menghentikan proses lama (PID $pidToStop) pada port $port"
      Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 2
    }
  } catch { }
}

Write-Log "Supervisor server aktif. Node: $((Get-Command node).Source)"

while ($true) {
  if (Test-Path (Join-Path $root '.stop-supervisor')) {
    Remove-Item (Join-Path $root '.stop-supervisor') -Force -ErrorAction SilentlyContinue
    Write-Log "Sinyal stop diterima - supervisor berhenti."
    break
  }
  try {
    Write-Log "Menjalankan server aplikasi (produksi)..."
    & cmd.exe /c "node `"$root\dist\server.cjs`" >> `"$log`" 2>&1"
    Write-Log "Server berhenti (exit $LASTEXITCODE) - restarting in 5 seconds..."
  } catch {
    Write-Log "Error: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 5
}
