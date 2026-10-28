#!/usr/bin/env node
/**
 * Memastikan versi di package.json dan src/config/brand.ts selalu sama.
 * Format yang dipakai: MAJOR.MINOR.PATCH (contoh 4.4.0). Dijalankan otomatis
 * sebelum build agar versi yang tampil di aplikasi tidak pernah berbeda dari
 * versi rilis.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const brand = fs.readFileSync(path.join(ROOT, 'src/config/brand.ts'), 'utf8');

const packageMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(pkg.version || ''));
const brandMatch = /export const APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/.exec(brand);

if (!packageMatch) {
  console.error(`Versi package.json tidak valid: "${pkg.version}" (harus x.y.z).`);
  process.exit(1);
}
if (!brandMatch) {
  console.error('APP_VERSION tidak ditemukan di src/config/brand.ts (harus format x.y.z).');
  process.exit(1);
}

const packageVersion = `${packageMatch[1]}.${packageMatch[2]}.${packageMatch[3]}`;
const brandVersion = `${brandMatch[1]}.${brandMatch[2]}.${brandMatch[3]}`;

if (packageVersion !== brandVersion) {
  console.error('Versi tidak sinkron:');
  console.error(`- package.json        : ${packageVersion}`);
  console.error(`- src/config/brand.ts : ${brandVersion}`);
  console.error('Perbaiki dengan: npm run version:bump (patch), version:minor, atau version:major.');
  process.exit(1);
}

console.log(`Versi OK: v${brandVersion}`);
