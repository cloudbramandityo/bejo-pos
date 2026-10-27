#!/usr/bin/env node
/**
 * Guard nama aplikasi.
 *
 * Aplikasi ini bernama "BEJO Digital Print". Nama lama (Bejo Stiker / Stiker
 * POS) tidak boleh muncul lagi di source, dokumen, maupun skrip deploy.
 * Skrip ini dijalankan otomatis sebelum `npm run build`, sehingga build gagal
 * bila nama lama masuk kembali.
 *
 * Catatan: identifier teknis seperti service Windows `BejoStikerPOS`, domain
 * lama `pos.bejostiker.com`, dan file backup `backup_pos_bejo_stiker_*.json`
 * tidak terkena aturan karena tidak memakai spasi.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'data',
  'backups',
  '.qoder',
  'coverage',
]);
const SKIP_FILES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  'package-lock.json',
  'scripts/check-brand.mjs',
  // Dokumen runtime hasil deploy lama (berisi merek lama, bukan source).
  'URL-INTERNET.txt',
  // Kebijakan ini perlu menyebut nama lama secara eksplisit.
  'AGENTS.md',
]);
const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.html',
  '.json',
  '.md',
  '.ps1',
  '.psm1',
  '.css',
  '.txt',
  '.yml',
  '.yaml',
]);
const EXTRA_FILES = new Set(['Dockerfile', 'Caddyfile', 'Caddyfile.windows']);

const FORBIDDEN = [
  { label: 'Bejo Stiker', pattern: /\bBejo\s+Stiker\b/i },
  { label: 'Stiker POS', pattern: /\bStiker\s+POS\b/i },
];

const violations = [];

function checkFile(fullPath) {
  let text;
  try {
    text = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return;
  }
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: path.relative(ROOT, fullPath).replaceAll('\\', '/'),
          line: index + 1,
          label: rule.label,
          excerpt: line.trim().slice(0, 160),
        });
        break;
      }
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('backup_pos_bejo_stiker_')) continue;
    // Snapshot data/backup bukan source; isinya riwayat lama yang sah.
    if (/^backup.*\.json$/i.test(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
      continue;
    }
    const relative = path.relative(ROOT, fullPath).replaceAll('\\', '/');
    if (SKIP_FILES.has(relative)) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXT.has(extension) && !EXTRA_FILES.has(entry.name)) continue;
    checkFile(fullPath);
  }
}

walk(ROOT);

if (violations.length > 0) {
  console.error('Nama aplikasi salah terdeteksi. Gunakan "BEJO Digital Print".');
  for (const item of violations) {
    console.error(`- ${item.file}:${item.line} [${item.label}] ${item.excerpt}`);
  }
  process.exit(1);
}

console.log('Nama aplikasi OK: BEJO Digital Print.');
