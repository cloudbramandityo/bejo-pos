#!/usr/bin/env node
/**
 * Memastikan versi di package.json (x.y.0) dan src/config/brand.ts (x.y)
 * selalu sama. Dijalankan otomatis sebelum build agar versi yang tampil di
 * aplikasi tidak pernah berbeda dari versi rilis.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const brand = fs.readFileSync(path.join(ROOT, 'src/config/brand.ts'), 'utf8');

const packageMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(pkg.version || ''));
const brandMatch = /export const APP_VERSION = '(\d+)\.(\d+)'/.exec(brand);

if (!packageMatch) {
  console.error(`Versi package.json tidak valid: "${pkg.version}" (harus x.y.z).`);
  process.exit(1);
}
if (!brandMatch) {
  console.error('APP_VERSION tidak ditemukan di src/config/brand.ts.');
  process.exit(1);
}

const packageShort = `${packageMatch[1]}.${packageMatch[2]}`;
const brandShort = `${brandMatch[1]}.${brandMatch[2]}`;

if (packageShort !== brandShort) {
  console.error('Versi tidak sinkron:');
  console.error(`- package.json      : ${pkg.version} (tampil v${packageShort})`);
  console.error(`- src/config/brand.ts: v${brandShort}`);
  console.error('Perbaiki dengan: npm run version:bump (atau version:major).');
  process.exit(1);
}

console.log(`Versi OK: v${brandShort}`);
