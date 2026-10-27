<#
=====================================================================
  BEJO STIKER POS - APPLY P0 SECURITY UPDATE
=====================================================================
  Menyiapkan seluruh perubahan P0 (auth developer, broker PocketBase,
  fail-closed akses internet, hardening aturan PocketBase) di komputer
  lokal maupun VPS Windows.

  Skrip ini:
    1. Membackup .env ke backups\env-<stamp>.bak
    2. Menonaktifkan VITE_PB_SYNC_EMAIL / VITE_PB_SYNC_PASSWORD (deprecated)
    3. Mengisi DEV_USERNAME, DEV_PASSWORD_HASH (scrypt, bukan plaintext),
       APP_SESSION_SECRET, REMOTE_ACCESS_PASS, PB_SYNC_EMAIL,
       PB_SYNC_PASSWORD, POCKETBASE_UPSTREAM (prompt aman bila kosong)
    4. Typecheck + build produksi
    5. Menjalankan hardening aturan PocketBase (--harden) bila admin tersedia
    6. Restart service (bila ada) + health check route baru

  Contoh pemakaian:
    Lokal:
      powershell -NoProfile -ExecutionPolicy Bypass -File scripts\apply-p0-security.ps1

    VPS Windows (PowerShell sebagai Administrator):
      powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\scripts\apply-p0-security.ps1

  Opsi:
    -AppDir <path>              Folder aplikasi (default: root repo / C:\bejo-pos)
    -ServiceName <nama>         Nama service Windows (default BejoStikerPOS)
    -SkipEnv                    Jangan ubah .env
    -SkipTypecheck              Lewati tsc --noEmit
    -SkipBuild                  Lewati npm run build
    -SkipHardening              Lewati hardening aturan PocketBase
    -RequireHardening           Gagal bila hardening tidak bisa dijalankan
    -SkipRestart                Jangan restart service
    -AllowEmptyRemotePass       Izinkan REMOTE_ACCESS_PASS kosong (akses LAN saja)
    -SkipDeveloperPassword      Jangan minta password DEVELOPER bila hash/password kosong
    -SkipPbSyncCredentials      Jangan minta kredensial sync PocketBase
    -InstallDependencies        Jalankan npm ci / npm install sebelum build
    -NonInteractive             Jangan pernah meminta input (gagal bila wajib)

  CATATAN KEAMANAN:
    - Nilai rahasia tidak pernah dicetak ke layar.
    - Password developer disimpan sebagai hash scrypt (DEV_PASSWORD_HASH);
      plaintext lama otomatis dimigrasi lalu dinonaktifkan.
    - Jangan menyalin placeholder <...> apa adanya.
    - Setelah perubahan, wajib rotate password developer dan password akun
      sync PocketBase karena nilai lama pernah ikut ter-bundle ke browser.
=====================================================================
#>

[CmdletBinding()]
param(
  [string]$AppDir = '',
  [string]$ServiceName = 'BejoStikerPOS',
  [switch]$SkipEnv,
  [switch]$SkipTypecheck,
  [switch]$SkipBuild,
  [switch]$SkipHardening,
  [switch]$RequireHardening,
  [switch]$SkipRestart,
  [switch]$AllowEmptyRemotePass,
  [switch]$SkipDeveloperPassword,
  [switch]$SkipPbSyncCredentials,
  [switch]$InstallDependencies,
  [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
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
      if ($value.Length -ge 2) {
        $doubleQuoted = $value.StartsWith('"') -and $value.EndsWith('"')
        $singleQuoted = $value.StartsWith("'") -and $value.EndsWith("'")
        if ($doubleQuoted -or $singleQuoted) {
          $value = $value.Substring(1, $value.Length - 2)
        }
      }
      return $value
    }
  }
  return $null
}

function Format-EnvValue([string]$Value) {
  if ($Value -match "[`r`n]") { throw 'Nilai .env tidak boleh mengandung baris baru.' }
  if ($Value -match '[\s#''"]') {
    if ($Value.Contains("'")) {
      return '"' + ($Value -replace '"', '\"') + '"'
    }
    return "'$Value'"
  }
  return $Value
}

function Set-EnvValue([string]$Path, [string]$Key, [string]$Value) {
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($line in Get-Content -LiteralPath $Path) { $lines.Add($line) }
  $pattern = '^\s*' + [regex]::Escape($Key) + '\s*='
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = "$Key=$(Format-EnvValue $Value)"
      $found = $true
      break
    }
  }
  if (-not $found) { $lines.Add("$Key=$(Format-EnvValue $Value)") }
  [System.IO.File]::WriteAllLines($Path, $lines, (New-Object System.Text.UTF8Encoding($false)))
}

function Read-SecretValue([string]$Prompt) {
  if ($NonInteractive -or [Console]::IsInputRedirected) { return '' }
  Write-Host "   $Prompt" -ForegroundColor Yellow
  $secure = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Read-PlainValue([string]$Prompt) {
  if ($NonInteractive -or [Console]::IsInputRedirected) { return '' }
  return (Read-Host -Prompt "   $Prompt").Trim()
}

function New-HexSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
  return (($buffer | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Test-HttpOk([string]$Url, [int]$TimeoutSec = 5) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    return ($response.StatusCode -eq 200)
  } catch {
    return $false
  }
}

# Uji login akun sync tanpa mencetak kredensial. Dipakai sebelum menonaktifkan
# VITE_PB_SYNC_* agar Landing API tidak kehilangan kredensial yang valid.
function Test-PbLogin([string]$BaseUrl, [string]$Email, [string]$Password) {
  if ([string]::IsNullOrWhiteSpace($Email) -or [string]::IsNullOrWhiteSpace($Password)) { return $false }
  try {
    $body = @{ identity = $Email; password = $Password } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Uri ($BaseUrl.TrimEnd('/') + '/api/collections/users/auth-with-password') `
      -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 10
    return [bool]$response.token
  } catch {
    return $false
  }
}

function Invoke-NativeCapture([string]$FilePath, [string[]]$Arguments, [string]$WorkDir) {
  $previous = $ErrorActionPreference
  Push-Location -LiteralPath $WorkDir
  try {
    $ErrorActionPreference = 'Continue'
    $output = & $FilePath @Arguments 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
    Pop-Location
  }
  return [pscustomobject]@{ Output = $output; ExitCode = $code }
}

function Restore-EnvVar([string]$Name, $Value) {
  if ($null -eq $Value) {
    Remove-Item "Env:$Name" -ErrorAction SilentlyContinue
  } else {
    Set-Item "Env:$Name" $Value
  }
}

# NSSM menyimpan target aplikasi di registry. Bila targetnya sudah tidak ada
# (mis. C:\bejo-pos dihapus), restart hanya akan gagal dan menghentikan skrip;
# deteksi lebih awal agar aman dijalankan di komputer lokal.
function Get-ServiceAppTarget([string]$Name) {
  $parameters = "HKLM:\SYSTEM\CurrentControlSet\Services\$Name\Parameters"
  if (Test-Path -LiteralPath $parameters) {
    $values = Get-ItemProperty -Path $parameters -ErrorAction SilentlyContinue
    if ($values -and $values.AppParameters) { return [string]$values.AppParameters }
  }
  try {
    $serviceInfo = Get-CimInstance Win32_Service -Filter ("Name='" + $Name + "'") -ErrorAction Stop
    if ($serviceInfo -and $serviceInfo.PathName) { return [string]$serviceInfo.PathName }
  } catch { }
  return ''
}

function Test-ServiceTargetMissing([string]$Name) {
  $target = Get-ServiceAppTarget $Name
  if (-not $target) { return $false }
  $candidates = @([regex]::Matches($target, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
  $candidates += ($target -replace '"', '') -split '\s+'
  foreach ($candidate in $candidates) {
    if ($candidate -match '\.(cjs|js|exe)$' -and -not (Test-Path -LiteralPath $candidate)) {
      return $true
    }
  }
  return $false
}

# ----------------------------------------------------------- main
Write-Host '==================================================================' -ForegroundColor DarkCyan
Write-Host ' BEJO STIKER POS - APPLY P0 SECURITY UPDATE' -ForegroundColor Cyan
Write-Host " Waktu: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '==================================================================' -ForegroundColor DarkCyan

try {
  if (-not $AppDir) {
    $candidate = Split-Path -Parent $PSScriptRoot
    if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'package.json'))) {
      $AppDir = $candidate
    } elseif (Test-Path -LiteralPath 'C:\bejo-pos\package.json') {
      $AppDir = 'C:\bejo-pos'
    } else {
      Fail 'Folder aplikasi tidak ditemukan. Jalankan dengan -AppDir <path>.'
    }
  }
  $AppDir = (Resolve-Path -LiteralPath $AppDir).Path
  if (-not (Test-Path -LiteralPath (Join-Path $AppDir 'package.json'))) {
    Fail "package.json tidak ditemukan di $AppDir."
  }
  Write-Ok "Folder aplikasi: $AppDir"

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'node tidak ditemukan di PATH.' }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail 'npm tidak ditemukan di PATH.' }
  $nodePath = (Get-Command node).Source
  $npmPath = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
  if (-not $npmPath) { $npmPath = (Get-Command npm).Source }

  $envPath = Join-Path $AppDir '.env'
  $envBackup = ''

  if (-not $SkipEnv) {
    Write-Step '1/5 Menyiapkan konfigurasi .env'
    if (-not (Test-Path -LiteralPath $envPath)) {
      Fail "File .env tidak ditemukan di $AppDir. Salin .env.example menjadi .env lalu jalankan ulang."
    }

    $backupDir = Join-Path $AppDir 'backups'
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $envBackup = Join-Path $backupDir "env-$Stamp.bak"
    Copy-Item -LiteralPath $envPath -Destination $envBackup -Force
    Write-Ok "Backup .env dibuat: $envBackup (nilai tidak dicetak)."

    if ([string]::IsNullOrWhiteSpace((Get-EnvValue $envPath 'DEV_USERNAME'))) {
      Set-EnvValue $envPath 'DEV_USERNAME' 'langgo'
      Write-Ok 'DEV_USERNAME diisi "langgo".'
    } else {
      Write-Ok 'DEV_USERNAME sudah terisi.'
    }

    $remotePass = Get-EnvValue $envPath 'REMOTE_ACCESS_PASS'
    if ([string]::IsNullOrWhiteSpace($remotePass)) {
      if ($AllowEmptyRemotePass) {
        Write-Warn2 'REMOTE_ACCESS_PASS kosong: akses internet akan DITOLAK (hanya LAN/localhost).'
      } else {
        $remotePass = Read-SecretValue 'Masukkan REMOTE_ACCESS_PASS (Basic Auth untuk akses internet):'
        if ([string]::IsNullOrWhiteSpace($remotePass)) {
          Fail 'REMOTE_ACCESS_PASS wajib diisi agar aplikasi bisa diakses dari internet. Gunakan -AllowEmptyRemotePass untuk mode LAN saja.'
        }
        Set-EnvValue $envPath 'REMOTE_ACCESS_PASS' $remotePass
        Write-Ok 'REMOTE_ACCESS_PASS diisi (nilai tidak dicetak).'
      }
    } else {
      Write-Ok 'REMOTE_ACCESS_PASS sudah terisi.'
    }

    $devSecretScript = Join-Path $AppDir 'scripts\set-dev-password.mjs'
    if ([string]::IsNullOrWhiteSpace((Get-EnvValue $envPath 'DEV_PASSWORD_HASH'))) {
      $legacyDevPass = Get-EnvValue $envPath 'DEV_PASSWORD'
      if ([string]::IsNullOrWhiteSpace($legacyDevPass)) {
        $legacyDevPass = Get-EnvValue $envPath 'JOURNAL_DEV_PASSWORD'
      }

      if (-not [string]::IsNullOrWhiteSpace($legacyDevPass)) {
        $legacyDevPass = $null
        if (-not (Test-Path -LiteralPath $devSecretScript)) {
          Fail "Skrip tidak ditemukan: $devSecretScript. Tidak bisa mengubah password developer menjadi hash."
        }
        & $nodePath $devSecretScript --env $envPath --from-env --no-backup
        if ($LASTEXITCODE -ne 0) {
          Fail 'Gagal mengubah DEV_PASSWORD menjadi hash scrypt. Password lama masih di .env.'
        }
        Write-Ok 'Password DEVELOPER lama diubah menjadi DEV_PASSWORD_HASH (scrypt).'
      } elseif ($SkipDeveloperPassword) {
        Write-Warn2 'Password DEVELOPER kosong: login DEVELOPER tidak akan berfungsi.'
      } else {
        if (-not (Test-Path -LiteralPath $devSecretScript)) {
          Fail "Skrip tidak ditemukan: $devSecretScript. Tidak bisa membuat hash password developer."
        }
        $newDevPass = Read-SecretValue 'Masukkan password DEVELOPER baru (minimal 12 karakter):'
        if ([string]::IsNullOrWhiteSpace($newDevPass)) {
          Fail 'Password DEVELOPER wajib diisi agar login DEVELOPER berfungsi. Gunakan -SkipDeveloperPassword untuk melewati.'
        }
        if ($newDevPass.Length -lt 12) {
          $newDevPass = $null
          Fail 'Password DEVELOPER minimal 12 karakter.'
        }

        # Password dikirim sebagai base64 lewat stdin (bukan argumen) agar tidak
        # terlihat di daftar proses dan tidak rusak oleh encoding PowerShell.
        $encodedDevPass = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($newDevPass))
        try {
          $encodedDevPass | & $nodePath $devSecretScript --env $envPath --stdin --base64 --no-backup
          $hashExit = $LASTEXITCODE
        } finally {
          $encodedDevPass = $null
          $newDevPass = $null
        }
        if ($hashExit -ne 0) {
          Fail 'Gagal menyimpan password DEVELOPER sebagai hash scrypt.'
        }
        Write-Ok 'DEV_PASSWORD_HASH dibuat (scrypt; nilai tidak dicetak).'
      }
    } else {
      Write-Ok 'DEV_PASSWORD_HASH sudah terisi (password developer tersimpan sebagai hash).'
      if (-not [string]::IsNullOrWhiteSpace((Get-EnvValue $envPath 'DEV_PASSWORD'))) {
        Write-Warn2 'DEV_PASSWORD plaintext masih aktif meski hash sudah ada. Hapus/komentari agar tidak ada salinan password.'
      }
    }

    if ([string]::IsNullOrWhiteSpace((Get-EnvValue $envPath 'APP_SESSION_SECRET'))) {
      $secret = New-HexSecret 32
      Set-EnvValue $envPath 'APP_SESSION_SECRET' $secret
      Write-Ok 'APP_SESSION_SECRET dibuat otomatis (64 karakter hex).'
    } else {
      Write-Ok 'APP_SESSION_SECRET sudah terisi.'
    }

    if ([string]::IsNullOrWhiteSpace((Get-EnvValue $envPath 'POCKETBASE_UPSTREAM'))) {
      Set-EnvValue $envPath 'POCKETBASE_UPSTREAM' 'http://127.0.0.1:8090'
      Write-Ok 'POCKETBASE_UPSTREAM diisi http://127.0.0.1:8090.'
    } else {
      Write-Ok 'POCKETBASE_UPSTREAM sudah terisi.'
    }

    # Nilai VITE_PB_SYNC_* (dulu dipakai browser) masih dibaca Landing API
    # sebagai fallback. Pindahkan ke PB_SYNC_* bila kosong; bila keduanya
    # berbeda, utamakan pasangan yang benar-benar bisa login ke PocketBase.
    $legacySyncEmail = Get-EnvValue $envPath 'VITE_PB_SYNC_EMAIL'
    $legacySyncPassword = Get-EnvValue $envPath 'VITE_PB_SYNC_PASSWORD'
    $syncEmail = Get-EnvValue $envPath 'PB_SYNC_EMAIL'
    $syncPass = Get-EnvValue $envPath 'PB_SYNC_PASSWORD'
    $pbProbeUrl = Get-EnvValue $envPath 'POCKETBASE_UPSTREAM'
    if ([string]::IsNullOrWhiteSpace($pbProbeUrl)) { $pbProbeUrl = 'http://127.0.0.1:8090' }
    $legacyComplete = (-not [string]::IsNullOrWhiteSpace($legacySyncEmail)) -and (-not [string]::IsNullOrWhiteSpace($legacySyncPassword))
    $syncComplete = (-not [string]::IsNullOrWhiteSpace($syncEmail)) -and (-not [string]::IsNullOrWhiteSpace($syncPass))

    if (-not $syncComplete -and $legacyComplete) {
      Set-EnvValue $envPath 'PB_SYNC_EMAIL' $legacySyncEmail
      Set-EnvValue $envPath 'PB_SYNC_PASSWORD' $legacySyncPassword
      $syncEmail = $legacySyncEmail
      $syncPass = $legacySyncPassword
      $syncComplete = $true
      Write-Ok 'PB_SYNC_* diisi dari VITE_PB_SYNC_* lama.'
    } elseif ($syncComplete -and $legacyComplete -and
              ($syncEmail -ne $legacySyncEmail -or $syncPass -ne $legacySyncPassword)) {
      if (-not (Test-PbLogin $pbProbeUrl $syncEmail $syncPass)) {
        if (Test-PbLogin $pbProbeUrl $legacySyncEmail $legacySyncPassword) {
          Set-EnvValue $envPath 'PB_SYNC_EMAIL' $legacySyncEmail
          Set-EnvValue $envPath 'PB_SYNC_PASSWORD' $legacySyncPassword
          $syncEmail = $legacySyncEmail
          $syncPass = $legacySyncPassword
          Write-Ok 'PB_SYNC_* ditolak PocketBase; nilai VITE_PB_SYNC_* yang valid dipakai.'
        } else {
          Write-Warn2 'PB_SYNC_* dan VITE_PB_SYNC_* sama-sama ditolak PocketBase; reset akun sync lalu isi PB_SYNC_*.'
        }
      }
    }

    $syncEmail = Get-EnvValue $envPath 'PB_SYNC_EMAIL'
    $syncPass = Get-EnvValue $envPath 'PB_SYNC_PASSWORD'
    if ([string]::IsNullOrWhiteSpace($syncEmail) -or [string]::IsNullOrWhiteSpace($syncPass)) {
      if ($SkipPbSyncCredentials) {
        Write-Warn2 'Kredensial sync PocketBase kosong: aplikasi akan berjalan dalam Mode Lokal.'
      } else {
        if ([string]::IsNullOrWhiteSpace($syncEmail)) {
          $syncEmail = Read-PlainValue 'Masukkan PB_SYNC_EMAIL (email akun sync PocketBase):'
          if ($syncEmail) { Set-EnvValue $envPath 'PB_SYNC_EMAIL' $syncEmail }
        }
        if ([string]::IsNullOrWhiteSpace($syncPass)) {
          $syncPass = Read-SecretValue 'Masukkan PB_SYNC_PASSWORD (password akun sync):'
          if ($syncPass) { Set-EnvValue $envPath 'PB_SYNC_PASSWORD' $syncPass }
        }
        if ([string]::IsNullOrWhiteSpace($syncEmail) -or [string]::IsNullOrWhiteSpace($syncPass)) {
          Write-Warn2 'Kredensial sync tidak lengkap: aplikasi akan berjalan dalam Mode Lokal.'
        } else {
          Write-Ok 'Kredensial sync PocketBase tersimpan (nilai tidak dicetak).'
        }
      }
    } else {
      Write-Ok 'Kredensial sync PocketBase sudah terisi.'
    }

    # Kredensial browser dinonaktifkan hanya setelah PB_SYNC_* lengkap;
    # Landing API memakai VITE_PB_SYNC_* sebagai fallback.
    $finalSyncEmail = Get-EnvValue $envPath 'PB_SYNC_EMAIL'
    $finalSyncPass = Get-EnvValue $envPath 'PB_SYNC_PASSWORD'
    if (-not [string]::IsNullOrWhiteSpace($finalSyncEmail) -and -not [string]::IsNullOrWhiteSpace($finalSyncPass)) {
      $lines = New-Object System.Collections.Generic.List[string]
      $deprecatedCount = 0
      foreach ($line in Get-Content -LiteralPath $envPath) {
        if ($line -match '^\s*(VITE_PB_SYNC_EMAIL|VITE_PB_SYNC_PASSWORD)\s*=') {
          $lines.Add("# [DEPRECATED $Stamp] $line")
          $deprecatedCount++
        } else {
          $lines.Add($line)
        }
      }
      if ($deprecatedCount -gt 0) {
        [System.IO.File]::WriteAllLines($envPath, $lines, (New-Object System.Text.UTF8Encoding($false)))
        Write-Ok "$deprecatedCount baris VITE_PB_SYNC_* dinonaktifkan (tidak lagi dipakai browser)."
      } else {
        Write-Ok 'Tidak ada VITE_PB_SYNC_* aktif di .env.'
      }
    } else {
      Write-Warn2 'VITE_PB_SYNC_* dibiarkan aktif karena PB_SYNC_* belum lengkap (fallback Landing API).'
    }

    if (-not $SkipHardening) {
      $adminEmail = Get-EnvValue $envPath 'PB_ADMIN_EMAIL'
      $adminPass = Get-EnvValue $envPath 'PB_ADMIN_PASSWORD'
      if ([string]::IsNullOrWhiteSpace($adminEmail) -or [string]::IsNullOrWhiteSpace($adminPass)) {
        if ($RequireHardening) {
          if ([string]::IsNullOrWhiteSpace($adminEmail)) {
            $adminEmail = Read-PlainValue 'Masukkan PB_ADMIN_EMAIL untuk hardening:'
            if ($adminEmail) { Set-EnvValue $envPath 'PB_ADMIN_EMAIL' $adminEmail }
          }
          if ([string]::IsNullOrWhiteSpace($adminPass)) {
            $adminPass = Read-SecretValue 'Masukkan PB_ADMIN_PASSWORD untuk hardening:'
            if ($adminPass) { Set-EnvValue $envPath 'PB_ADMIN_PASSWORD' $adminPass }
          }
          if ([string]::IsNullOrWhiteSpace($adminEmail) -or [string]::IsNullOrWhiteSpace($adminPass)) {
            Fail 'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD wajib untuk -RequireHardening.'
          }
        } else {
          Write-Warn2 'PB_ADMIN_* kosong: hardening aturan PocketBase akan dilewati.'
        }
      } else {
        Write-Ok 'Kredensial admin PocketBase tersedia untuk hardening.'
      }
    }
  } else {
    Write-Step '1/5 Konfigurasi .env dilewati (-SkipEnv)'
  }

  # ------------------------------------------------------- typecheck
  Write-Step '2/5 Typecheck'
  if ($SkipTypecheck) {
    Write-Warn2 'Typecheck dilewati (-SkipTypecheck).'
  } else {
    $typecheck = Invoke-NativeCapture $npmPath @('run', 'lint') $AppDir
    $typecheck.Output | Select-Object -Last 20 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
    if ($typecheck.ExitCode -ne 0) { Fail "Typecheck gagal (exit $($typecheck.ExitCode))." }
    Write-Ok 'Typecheck lolos.'
  }

  # ------------------------------------------------------- build
  Write-Step '3/5 Build produksi'
  if ($SkipBuild) {
    Write-Warn2 'Build dilewati (-SkipBuild).'
  } else {
    if ($InstallDependencies) {
      if (Test-Path -LiteralPath (Join-Path $AppDir 'package-lock.json')) {
        Write-Host '   npm ci ...' -ForegroundColor DarkGray
        $install = Invoke-NativeCapture $npmPath @('ci', '--no-audit', '--no-fund', '--include=dev') $AppDir
      } else {
        Write-Host '   npm install ...' -ForegroundColor DarkGray
        $install = Invoke-NativeCapture $npmPath @('install', '--no-audit', '--no-fund', '--include=dev') $AppDir
      }
      $install.Output | Select-Object -Last 8 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
      if ($install.ExitCode -ne 0) { Fail "Install dependensi gagal (exit $($install.ExitCode))." }
    }

    $previousNodeEnv = $env:NODE_ENV
    try {
      $env:NODE_ENV = 'production'
      $build = Invoke-NativeCapture $npmPath @('run', 'build') $AppDir
    } finally {
      Restore-EnvVar 'NODE_ENV' $previousNodeEnv
    }
    $build.Output | Select-Object -Last 20 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
    if ($build.ExitCode -ne 0) { Fail "Build gagal (exit $($build.ExitCode))." }
    if (-not (Test-Path -LiteralPath (Join-Path $AppDir 'dist\server.cjs'))) {
      Fail 'Build selesai tetapi dist\server.cjs tidak terbentuk.'
    }
    Write-Ok 'Build selesai (dist\server.cjs tersedia).'
  }

  # ------------------------------------------------------- hardening
  Write-Step '4/5 Hardening aturan PocketBase'
  if ($SkipHardening) {
    Write-Warn2 'Hardening dilewati (-SkipHardening).'
  } else {
    $adminEmail = Get-EnvValue $envPath 'PB_ADMIN_EMAIL'
    $adminPass = Get-EnvValue $envPath 'PB_ADMIN_PASSWORD'
    $pbUrl = Get-EnvValue $envPath 'POCKETBASE_UPSTREAM'
    if ([string]::IsNullOrWhiteSpace($pbUrl)) { $pbUrl = 'http://127.0.0.1:8090' }
    $hardeningScript = Join-Path $AppDir 'scripts\create-pocketbase-collections.mjs'

    if ([string]::IsNullOrWhiteSpace($adminEmail) -or [string]::IsNullOrWhiteSpace($adminPass)) {
      if ($RequireHardening) { Fail 'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD kosong; hardening tidak dapat dijalankan.' }
      Write-Warn2 'PB_ADMIN_* kosong; hardening dilewati. Jalankan ulang dengan -RequireHardening setelah kredensial diisi.'
    } elseif (-not (Test-Path -LiteralPath $hardeningScript)) {
      if ($RequireHardening) { Fail "Skrip hardening tidak ditemukan: $hardeningScript" }
      Write-Warn2 "Skrip hardening tidak ditemukan: $hardeningScript"
    } elseif (-not (Test-HttpOk "$pbUrl/api/health" 5)) {
      if ($RequireHardening) { Fail "PocketBase tidak merespons di $pbUrl/api/health." }
      Write-Warn2 "PocketBase tidak merespons di $pbUrl; hardening dilewati."
    } else {
      $nodePath = (Get-Command node).Source
      $prevUrl = $env:POCKETBASE_URL
      $prevEmail = $env:PB_ADMIN_EMAIL
      $prevPass = $env:PB_ADMIN_PASSWORD
      try {
        $env:POCKETBASE_URL = $pbUrl
        $env:PB_ADMIN_EMAIL = $adminEmail
        $env:PB_ADMIN_PASSWORD = $adminPass
        $hardening = Invoke-NativeCapture $nodePath @($hardeningScript, '--harden') $AppDir
      } finally {
        Restore-EnvVar 'POCKETBASE_URL' $prevUrl
        Restore-EnvVar 'PB_ADMIN_EMAIL' $prevEmail
        Restore-EnvVar 'PB_ADMIN_PASSWORD' $prevPass
      }
      $hardening.Output | Select-Object -Last 40 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
      if ($hardening.ExitCode -ne 0) {
        if ($RequireHardening) { Fail "Hardening gagal (exit $($hardening.ExitCode))." }
        Write-Warn2 "Hardening gagal (exit $($hardening.ExitCode)). Aturan PocketBase belum tentu diperketat."
      } else {
        Write-Ok 'Aturan PocketBase diperketat (create publik ditutup).'
      }
    }
  }

  # ------------------------------------------------------- restart/check
  Write-Step '5/5 Restart service dan verifikasi route'
  $restartDone = $false
  $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($SkipRestart) {
    Write-Warn2 'Restart service dilewati (-SkipRestart).'
  } elseif (-not $service) {
    Write-Warn2 "Service $ServiceName tidak ditemukan; restart dilewati (mode lokal)."
  } elseif (Test-ServiceTargetMissing $ServiceName) {
    Write-Warn2 "Service $ServiceName menunjuk ke file yang tidak ada: $(Get-ServiceAppTarget $ServiceName)"
    Write-Warn2 'Restart dilewati. Service ini tampaknya sisa instalasi lama, bukan aplikasi yang sedang berjalan.'
    Write-Warn2 'Lokal: jalankan ulang server manual (npm start). VPS: perbaiki path service lebih dulu.'
  } else {
    try {
      Restart-Service -Name $ServiceName -Force
      $restartDone = $true
      Write-Ok "Service $ServiceName direstart."
    } catch {
      Fail "Gagal restart service $ServiceName : $($_.Exception.Message)"
    }

    $port = Get-EnvValue $envPath 'PORT'
    if ([string]::IsNullOrWhiteSpace($port)) { $port = '3000' }
    $baseUrl = "http://127.0.0.1:$port"
    $healthy = $false
    for ($i = 0; $i -lt 30; $i++) {
      Start-Sleep -Seconds 2
      if (Test-HttpOk "$baseUrl/api/health" 5) { $healthy = $true; break }
    }
    if (-not $healthy) {
      Write-Warn2 "Health check gagal di $baseUrl/api/health. Periksa $AppDir\logs\stderr.log."
    } else {
      Write-Ok "Aplikasi sehat di $baseUrl/api/health."

      try {
        $authSession = Invoke-RestMethod -Uri "$baseUrl/api/auth/session" -TimeoutSec 15
        if ($authSession.success) { Write-Ok 'Route /api/auth/session aktif.' }
        else { Write-Warn2 'Route /api/auth/session merespons tanpa status success.' }
      } catch {
        Write-Warn2 "Route /api/auth/session tidak merespons: $($_.Exception.Message)"
      }

      $pbCode = 0
      try {
        $pbResponse = Invoke-WebRequest -Uri "$baseUrl/api/pocketbase/session" -Method Post -ContentType 'application/json' -Body '{}' -UseBasicParsing -TimeoutSec 20
        $pbCode = [int]$pbResponse.StatusCode
      } catch {
        try { $pbCode = [int]$_.Exception.Response.StatusCode } catch { $pbCode = 0 }
      }
      if ($pbCode -eq 200) {
        Write-Ok "Broker sesi PocketBase aktif (HTTP $pbCode)."
      } elseif ($pbCode -eq 503) {
        Write-Warn2 'Broker aktif, tetapi PB_SYNC_* kosong/ditolak PocketBase; sinkronisasi cloud tidak berjalan.'
      } elseif ($pbCode -eq 404) {
        Write-Warn2 'Route /api/pocketbase/session 404. Pastikan dist terbaru dan Caddy tidak mem-proxy prefix ini ke PocketBase.'
      } else {
        Write-Warn2 "Broker sesi PocketBase merespons HTTP $pbCode."
      }
    }
  }

  # ------------------------------------------------------- summary
  Write-Host ''
  Write-Host '==================================================================' -ForegroundColor DarkCyan
  Write-Host ' RINGKASAN' -ForegroundColor Cyan
  Write-Host "   Folder aplikasi : $AppDir"
  if ($envBackup) { Write-Host "   Backup .env     : $envBackup" }
  Write-Host "   Service         : $(if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) { $ServiceName } else { 'tidak terdaftar (lokal)' })"
  Write-Host '   Langkah berikut :'
  Write-Host '     1. Rotate password DEVELOPER dan password akun sync PocketBase.'
  if (-not $restartDone) {
    Write-Host '     2. Restart server yang sedang berjalan agar .env baru aktif (mis. npm start).' -ForegroundColor Yellow
  }
  Write-Host '     3. Commit + push source, lalu deploy VPS dengan:'
  Write-Host '        powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-vps.ps1 -Force'
  Write-Host '==================================================================' -ForegroundColor DarkCyan
  if ($restartDone) {
    Write-Ok 'APPLY P0 SELESAI.'
  } else {
    Write-Ok 'APPLY P0 SELESAI (server perlu direstart manual).'
  }
} catch {
  Write-Host ''
  Write-Host "   [FAIL] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
