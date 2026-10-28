#!/usr/bin/env node
/**
 * Pengelola versi aplikasi.
 *
 * Aturan (format MAJOR.MINOR.PATCH, contoh v4.4.0):
 *   - Update biasa                : 4.4.0 -> 4.4.1  (npm run version:bump)
 *   - Update fitur/modul baru     : 4.4.1 -> 4.5.0  (npm run version:minor)
 *   - Perubahan besar / tampilan  : 4.5.0 -> 5.0.0  (npm run version:major,
 *     aplikasi sudah terlihat berbeda dari versi sebelumnya -- rekomendasikan
 *     dulu ke pengguna sebelum dipakai)
 *
 * Skrip ini adalah satu-satunya cara yang benar untuk mengubah versi. Nilai
 * disimpan di package.json (semver penuh x.y.z) dan src/config/brand.ts
 * (APP_VERSION x.y.z). `scripts/check-version.mjs` menjaga keduanya tetap
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
const minorBump = args.includes('--minor');
const setIndex = args.indexOf('--set');
const setValue = setIndex >= 0 ? args[setIndex + 1] : null;

const format = (version) => `${version.major}.${version.minor}.${version.patch}`;

function readCurrent() {
  const brand = fs.readFileSync(BRAND_PATH, 'utf8');
  const match = brand.match(/export const APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/);
  if (!match) {
    throw new Error('APP_VERSION tidak ditemukan di src/config/brand.ts (format harus MAJOR.MINOR.PATCH).');
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function parseSetValue(value) {
  const raw = String(value || '').trim();
  const three = /^(\d+)\.(\d+)\.(\d+)$/.exec(raw);
  if (three) {
    return { major: Number(three[1]), minor: Number(three[2]), patch: Number(three[3]) };
  }
  const two = /^(\d+)\.(\d+)$/.exec(raw);
  if (two) {
    return { major: Number(two[1]), minor: Number(two[2]), patch: 0 };
  }
  throw new Error('Format --set harus MAJOR.MINOR.PATCH, contoh: --set 4.5.0');
}

function writeVersion(version) {
  const full = format(version);

  if (dryRun) {
    console.log(`[dry-run] Versi akan menjadi v${full} (package.json ${full}).`);
    return;
  }

  const brand = fs.readFileSync(BRAND_PATH, 'utf8');
  const updatedBrand = brand.replace(
    /export const APP_VERSION = '\d+\.\d+\.\d+'/,
    `export const APP_VERSION = '${full}'`
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

  console.log(`Versi diperbarui menjadi v${full}.`);
}

try {
  const current = readCurrent();

  if (showOnly) {
    console.log(`Versi aplikasi: v${format(current)}`);
    console.log(`Update biasa  : npm run version:bump   (patch, contoh 4.4.0 -> 4.4.1)`);
    console.log(`Fitur/modul   : npm run version:minor  (minor, contoh 4.4.1 -> 4.5.0)`);
    console.log(`Perubahan besar: npm run version:major (major, contoh 4.5.0 -> 5.0.0)`);
    process.exit(0);
  }

  let target;
  if (setValue) {
    target = parseSetValue(setValue);
  } else if (majorBump) {
    target = { major: current.major + 1, minor: 0, patch: 0 };
  } else if (minorBump) {
    target = { major: current.major, minor: current.minor + 1, patch: 0 };
  } else {
    target = { major: current.major, minor: current.minor, patch: current.patch + 1 };
  }

  if (format(target) === format(current)) {
    console.log(`Versi sudah v${format(current)}; tidak ada perubahan.`);
    process.exit(0);
  }

  writeVersion(target);

  if (!dryRun) {
    console.log('Langkah berikutnya:');
    console.log('  1. Perbarui catatan rilis / commit message dengan versi baru.');
    console.log('  2. Jalankan npm run build (check-version akan memverifikasi).');
    console.log('  3. Fitur/modul baru: npm run version:minor. Perubahan besar yang membuat');
    console.log('     aplikasi terlihat berbeda: rekomendasikan npm run version:major dulu.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
