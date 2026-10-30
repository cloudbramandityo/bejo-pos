/**
 * Penjaga sintaks skrip PowerShell.
 *
 * Berkas .ps1 hanya dijalankan di VPS, jadi kesalahan sintaks biasanya baru
 * kelihatan setelah deploy — saat layar operator sudah bermasalah. Penjaga ini
 * menyuruh PowerShell membaca tiap skrip tanpa menjalankannya, jadi skrip yang
 * tidak bisa dimuat berhenti di build, bukan di server.
 *
 * Jalankan: npm run check:ps1
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'win32') {
  console.log('   [OK] sintaks PowerShell dilewati (Penjaga ini hanya berlaku di Windows)');
  process.exit(0);
}

const PS = `
param([string]$Root)
$ErrorActionPreference = 'Stop'
$dirs = @((Join-Path $Root 'deploy'), (Join-Path $Root 'scripts')) | Where-Object { Test-Path $_ }
$files = @(Get-ChildItem -Recurse -Filter *.ps1 -Path $dirs -ErrorAction SilentlyContinue)
$broken = 0
foreach ($f in $files) {
  $errs = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$null, [ref]$errs)
  if ($errs.Count -gt 0) {
    $broken++
    Write-Host ("   [FAIL] " + $f.Name)
    $seen = @{}
    foreach ($e in $errs) {
      $line = $e.Extent.StartLineNumber
      if ($seen.ContainsKey($line)) { continue }
      $seen[$line] = $true
      Write-Host ("     baris " + $line + ": " + $e.Message)
      if ($seen.Count -ge 5) { break }
    }
  }
}
Write-Host ("   dibaca: " + $files.Count + " skrip PowerShell, " + $broken + " bermasalah")
exit $broken
`;

const workdir = mkdtempSync(path.join(tmpdir(), 'bejo-ps1-check-'));
const scriptFile = path.join(workdir, 'parse-check.ps1');

try {
  writeFileSync(scriptFile, PS, 'utf8');
  execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptFile, '-Root', ROOT],
    { stdio: 'inherit' }
  );
  console.log('   [OK] semua skrip PowerShell terbaca.');
} catch (error) {
  console.error(
    '   Perbaiki sintaks skrip di atas sebelum deploy — skrip ini yang menjalankan produksi di VPS.'
  );
  process.exit(1);
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
