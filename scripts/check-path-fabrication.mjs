#!/usr/bin/env node
/**
 * Guard "path fabrikasi" untuk folder berkas SPK.
 *
 * Akar bug fitur folder LAN: aplikasi mengarang lokasi berkas
 * (D:/DATA_CETAK_BEJO/, \\192.168.1.100\DATA_CETAK_BEJO\) walaupun berkasnya
 * hanya ada di IndexedDB perangkat yang meng-upload. Operator membuka berkas
 * yang tidak ada / salah berkas.
 *
 * Aturan: kode source tidak boleh menyimpan konstanta lokasi folder toko sebagai
 * nilai bawaan. Lokasi folder bersama hanya boleh datang dari
 * settings/spk_lan_folder (PocketBase) dan ditulis sebagai contoh di dalam
 * placeholder/komentar.
 *
 * Dijalankan otomatis sebelum `npm run build`; build gagal bila pelanggaran masuk.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIR = 'src';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'data', 'backups', '.qoder', 'coverage']);

/** Lokasi yang dulu dipakai sebagai nilai bawaan palsu. */
const FORBIDDEN = [
  { label: 'folder bawaan palsu D:/DATA_CETAK_BEJO', pattern: /D:\/?DATA_CETAK_BEJO/i },
  { label: 'folder bawaan palsu HOTFOLDER_KONICA', pattern: /HOTFOLDER_KONICA/i },
  { label: 'share palsu 192.168.1.100\DATA_CETAK', pattern: /192\.168\.1\.100\\+DATA_CETAK/i },
  { label: 'IP mesin bawaan palsu', pattern: /\|\|\s*['"`]192\.168\.1\.100['"`]/ },
];

/**
 * Berkas yang boleh menyebut lokasi lama secara eksplisit, yaitu sebagai konstanta
 * legacy yang justru dipakai untuk MENOLAK nilai bawaan lama.
 */
const ALLOW_LEGACY_FILES = new Set(['src/utils/localFileVault.ts']);

const violations = [];

function checkFile(fullPath) {
  const relative = path.relative(ROOT, fullPath).replaceAll('\\', '/');
  let text;
  try {
    text = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return;
  }
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    if (/^\s*(\/\/|\*|\/\*)/.test(raw)) continue;
    // Buang komentar trailing: contoh path di dalam komentar memang sengaja ditulis.
    const line = raw.replace(/(\s|^\s*)\/\/.*$/, '');
    if (/placeholder|Contoh|contoh|title=|label:/i.test(line)) continue;
    for (const rule of FORBIDDEN) {
      if (!rule.pattern.test(line)) continue;
      if (ALLOW_LEGACY_FILES.has(relative) && /LEGACY_DEFAULT_PRINT_DIR/.test(line)) continue;
      violations.push({
        file: relative,
        line: index + 1,
        label: rule.label,
        excerpt: line.trim().slice(0, 160),
      });
      break;
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
    checkFile(fullPath);
  }
}

if (!fs.existsSync(path.join(ROOT, SCAN_DIR))) {
  console.log('Guard path fabrikasi: direktori src tidak ditemukan, dilewati.');
  process.exit(0);
}
walk(path.join(ROOT, SCAN_DIR));

if (violations.length > 0) {
  console.error('Lokasi folder berkas SPK tidak boleh dikarang di source.');
  console.error('Simpan lokasi hanya di settings/spk_lan_folder, dan jangan tulis path bila folder belum disetel.');
  for (const item of violations) {
    console.error(`- ${item.file}:${item.line} [${item.label}] ${item.excerpt}`);
  }
  process.exit(1);
}

console.log('Guard path fabrikasi OK: lokasi folder hanya dari konfigurasi bersama.');
