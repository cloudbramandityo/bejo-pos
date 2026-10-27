#!/usr/bin/env node
/**
 * Pengelola versi aplikasi.
 *
 * Aturan:
 *   - Setiap update biasa menaikkan minor: 3.2 -> 3.3  (npm run version:bump)
 *   - Update besar / modul baru menaikkan major: 3.3 -> 4.0 (npm run version:major)
 *
 * Skrip ini adalah satu-satunya cara yang benar untuk mengubah versi. Nilai
 * disimpan di package.json (semver penuh x.y.0) dan src/config/brand.ts
 * (tampilan major.minor). `scripts/check-version.mjs` menjaga keduanya tetap
 * sinkron sebelum build.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PKG_PATH = path.join(ROOT, 'package.json');
const BRAND_PATH = path.join(ROOT, 'src/config/brand.ts');
const LOCK_PATH = path.join(ROOT, 'package-lock.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const showOnly = args.includes('--show');
const majorBump = args.includes('--major');
const setIndex = args.indexOf('--set');
const setValue = setIndex >= 0 ? args[setIndex + 1] : null;

function readCurrent() {
  const brand = fs.readFileSync(BRAND_PATH, 'utf8');
  const match = brand.match(/export const APP_VERSION = '(\d+)\.(\d+)'/);
  if (!match) {
    throw new Error('APP_VERSION tidak ditemukan di src/config/brand.ts');
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function parseSetValue(value) {
  const match = /^(\d+)\.(\d+)$/.exec(String(value || '').trim());
  if (!match) {
    throw new Error('Format --set harus MAJOR.MINOR, contoh: --set 3.4');
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function writeVersion(version) {
  const short = `${version.major}.${version.minor}`;
  const full = `${short}.0`;

  if (dryRun) {
    console.log(`[dry-run] Versi akan menjadi v${short} (package.json ${full}).`);
    return;
  }

  const brand = fs.readFileSync(BRAND_PATH, 'utf8');
  const updatedBrand = brand.replace(
    /export const APP_VERSION = '\d+\.\d+'/,
    `export const APP_VERSION = '${short}'`
  );
  fs.writeFileSync(BRAND_PATH, updatedBrand);

  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  pkg.version = full;
  fs.writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`);

  if (fs.existsSync(LOCK_PATH)) {
    const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
    lock.version = full;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = full;
    }
    fs.writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
  }

  console.log(`Versi diperbarui menjadi v${short}.`);
}

try {
  const current = readCurrent();

  if (showOnly) {
    console.log(`Versi aplikasi: v${current.major}.${current.minor}`);
    console.log('Update biasa : npm run version:bump   (minor, contoh 3.2 -> 3.3)');
    console.log('Update besar : npm run version:major  (major, contoh 3.3 -> 4.0)');
    process.exit(0);
  }

  let target;
  if (setValue) {
    target = parseSetValue(setValue);
  } else if (majorBump) {
    target = { major: current.major + 1, minor: 0 };
  } else {
    target = { major: current.major, minor: current.minor + 1 };
  }

  if (target.major === current.major && target.minor === current.minor) {
    console.log(`Versi sudah v${current.major}.${current.minor}; tidak ada perubahan.`);
    process.exit(0);
  }

  writeVersion(target);

  if (!dryRun) {
    console.log('Langkah berikutnya:');
    console.log('  1. Perbarui catatan rilis / commit message dengan versi baru.');
    console.log('  2. Jalankan npm run build (check-version akan memverifikasi).');
    console.log('  3. Untuk update besar/modul baru, gunakan npm run version:major.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
