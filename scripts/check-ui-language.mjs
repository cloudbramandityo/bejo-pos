#!/usr/bin/env node
/**
 * Pemindai kalimat deskripsi di antarmuka aplikasi.
 * Tujuan: semua teks yang dibaca pemilik toko/orang awam harus singkat, padat, jelas,
 * dan tidak memakai istilah teknis programmer.
 *
 * Jalankan:
 *   npm run check:copy            -> laporan daftar kerja (tidak menggagalkan build)
 *   node scripts/check-ui-language.mjs --strict -> gagal bila masih ada istilah teknis
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', 'src');
const STRICT = process.argv.includes('--strict');

/**
 * Istilah yang tidak dipahami orang awam di dalam kalimat deskripsi.
 * Istilah domain toko (harga kulak, agen, SPK, stok) sengaja tidak dilarang.
 */
const JARGON = [
  [/\bsnapshot\b/i, 'riwayat nilai tersimpan per hari'],
  [/\brekapitulasi\b/i, 'rekap'],
  [/\brekonstruksi\b/i, 'dihitung mundur'],
  [/\bdekomposisi\b/i, 'rincian'],
  [/\bledder\b/i, 'buku catatan'],
  [/\brealtime\b/i, 'langsung'],
  [/\breal-time\b/i, 'langsung'],
  [/\bendpoint\b/i, 'alamat server'],
  [/\bpayload\b/i, 'isi data'],
  [/(?<!\.)\bjson\b/i, 'data'],
  [/\btoken\b/i, 'kode sesi'],
  [/\bcookie\b/i, 'kode sesi'],
  [/\bcache\b/i, 'salinan sementara'],
  [/\bdebounce\b/i, 'jeda'],
  [/\bbrowser\b/i, 'aplikasi'],
  [/\blocalStorage\b/i, 'ingatan perangkat'],
  [/\bPocketBase\b/i, 'server'],
  [/\bkoleksi\b(?!\s+barang)/i, 'daftar'],
  [/\bskema\b/i, 'susunan data'],
  [/\bfield\b/i, 'kolom isian'],
  [/\bID logis\b/i, 'nomor'],
  [/\bsinkron(?:isasi)?\b/i, 'tersambung'],
  [/\bpredikat\b/i, 'syarat'],
  [/\bnormalisasi\b/i, 'perapian format'],
  [/\bagregat(?:if)?\b/i, 'rekap'],
  [/\bvalidasi kebijakan\b/i, 'cek aturan'],
  [/\bfallback\b/i, 'cadangan'],
  [/\btimeout\b/i, 'waktu tunggu habis'],
  [/\bdelta\b/i, 'selisih'],
  [/\bmutasi stok\b/i, 'stok masuk/keluar'],
  [/\bbaris mutasi\b/i, 'catatan stok'],
  [/\bHPP\b/i, 'harga kulak'],
  [/\bAPI\b/, 'server'],
  [/\bSDK\b/, 'perangkat'],
  [/\bCLI\b/, 'perangkat'],
  [/\bSQL\b/, 'data'],
  [/\bdummy\b/i, 'data contoh'],
  [/\biframe\b/i, 'tampilan halaman'],
  [/\bclipboard\b/i, 'tempat salin'],
];

/**
 * Nama resmi regulasi/dokumen/produk. Tidak boleh ditulis ulang dengan kata lain;
 * kalimat di sekitarnya tetap harus mudah dibaca.
 */
const OFFICIAL_NAMES = [
  /UU\s*HPP\b/i,
  /Harmonisasi\s+Peraturan\s+Perpajakan/i,
  /Rekapitulasi\s+Peredaran\s+Bruto/i,
  /Open\s+Platform\s+API/i,
  // teks pernyataan resmi pada formulir DJP tidak boleh ditiar-tiul
  /Dengan\s+menyadari\s+sepenuhnya/i,
  /PSAK\s+No\.?\s*1/i,
];

/** Kalimat deskripsi yang kepanjangan: di atas ini biasanya perlu dipecah/dipangkas. */
const MAX_PROSE = 130;

/**
 * Klaim status/kecepatan yang tertulis sebagai teks tetap. Angka dan keadaan seperti ini
 * hanya boleh muncul dari hasil pengukuran nyata; kalau ditulis langsung di JSX, layarnya
 * berbohong begitu kondisi aslinya berubah. Tambah pola baru hanya disertai alasan.
 */
const FAKE_STATUS = [
  /\b\d+\s?ms\b/i,
  /\bLIVE OPTIMAL\b/i,
  /\bAKTIF 24\/7\b/i,
  /\bONLINE (?:&(?:amp;)?|DAN) SINKRON\b/i,
  /\bSYNCED\b/i,
];

/**
 * Berkas yang teksnya dibaca DEVELOPER saat memperbaiki sistem, bukan oleh operator toko.
 * Istilah teknis di sini dibiarkan (nama teknis justru diperlukan saat mendiagnosis),
 * tetapi kalimatnya tetap harus pendek.
 */
const DEV_ONLY = [
  'src/components/BackendDiagnosticsModal.tsx',
  'src/utils/backendDiagnostics.ts',
  'src/backend/',
  'src/lib/pocketbase/',
];

/** Konten etalase (teks pemasaran yang bisa diedit dari UI), bukan deskripsi pemakaian. */
const CONTENT = ['src/utils/landingPageStorage.ts', 'src/components/marketing/'];

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) files.push(full);
  }
})(ROOT);

const isProse = (text) => {
  const clean = text.trim();
  if (clean.length < 24) return false;
  // baris kode (predicate, JSX inline, template) bukan kalimat deskripsi
  if (/(=>|===|!==|&&|\bfunction\b|\bconst\b|\breturn\b)/.test(clean)) return false;
  const words = clean.split(/\s+/).length;
  if (words < 6) return false;
  // hanya perhatikan kalimat berakhiran titik/kurung tutup atau yang jelas narasi
  return /[.。)]$/.test(clean) || /\b(dengan|yang|untuk|sehingga|kalau|bila|jika|setelah|sebelum)\b/i.test(clean);
};

const jargonHits = [];
const longHits = [];
const statusHits = [];
const seen = new Set();

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  // kosongkan komentar (blok dan satu baris) tanpa menggeser nomor baris
  const withoutComments = raw
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (m, prefix) => prefix + ' ');

  const lines = withoutComments.split(/\r?\n/);
  const rel = path.relative(path.resolve(ROOT, '..'), file).replace(/\\/g, '/');
  const isDevOnly = DEV_ONLY.some((p) => rel.startsWith(p));
  const isContent = CONTENT.some((p) => rel.startsWith(p));
  if (isContent) continue;

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    // log konsol hanya dibaca developer saat memperbaiki sistem
    if (/console\.(log|warn|error|info|debug)/.test(trimmed)) return;

    // teks yang tampil di layar: string literal, atribut teks, atau node JSX
    const candidates = [];
    for (const m of trimmed.matchAll(/(?:title|placeholder|label|aria-label|hint)="([^"]{20,})"/g)) candidates.push(m[1]);
    for (const m of trimmed.matchAll(/'([^']{24,})'|`([^`$]{24,})`/g)) candidates.push(m[1] || m[2]);
    const jsxText = trimmed.match(/^[\p{L}\p{N}–—•(]/u);
    if (jsxText && !/^(import |export |const |let |var |function |\w+\s*[=(:.])/.test(trimmed)) candidates.push(trimmed);

    // teks yang duduk di antara tag JSX; ikut diperiksa untuk klaim status tetap
    const fragments = [...trimmed.matchAll(/>([^<>]{3,})</g)].map((m) => m[1]);
    for (const raw of [...candidates, ...fragments]) {
      const text = raw.replace(/\{[^{}]*\}/g, ' X ').replace(/\s+/g, ' ').trim();
      const pola = FAKE_STATUS.find((re) => re.test(text));
      if (!pola || isDevOnly) continue;
      const key = `S:${rel}:${lineNo}:${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      statusHits.push({ rel, lineNo, text, pola: pola.source });
    }

    for (let text of candidates) {
      text = text.replace(/\{[^{}]*\}/g, ' X ').replace(/\s+/g, ' ').trim();
      if (!isProse(text)) continue;
      const key = `${rel}:${lineNo}:${text}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const hits = JARGON.filter(([re]) => re.test(text));
      const keepOfficial = OFFICIAL_NAMES.some((re) => re.test(text));
      if (hits.length && !isDevOnly && !keepOfficial) {
        jargonHits.push({ rel, lineNo, text, terms: hits.map(([re, rep]) => `${re.source} -> ${rep}`) });
      } else if (text.length > MAX_PROSE) {
        longHits.push({ rel, lineNo, text });
      }
    }
  });
}

const byFile = (rows) => {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.rel)) map.set(row.rel, []);
    map.get(row.rel).push(row);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
};

console.log('==================================================================');
console.log('  LAPORAN TEKS DESKRIPSI ANTARMOUKA');
console.log('==================================================================');
console.log(`\nIstilah teknis (wajib diperbaiki): ${jargonHits.length} pada ${byFile(jargonHits).length} berkas`);
for (const [rel, rows] of byFile(jargonHits)) {
  console.log(`\n  ${rel} (${rows.length})`);
  for (const r of rows) console.log(`    :${r.lineNo}  [${r.terms.join(', ')}]  ${r.text.slice(0, 150)}`);
}

console.log(`\nKlaim status/kecepatan tertulis (harusnya dari data nyata): ${statusHits.length} pada ${byFile(statusHits).length} berkas`);
for (const [rel, rows] of byFile(statusHits)) {
  console.log(`\n  ${rel} (${rows.length})`);
  for (const r of rows) console.log(`    :${r.lineNo}  [${r.pola}]  ${r.text.slice(0, 150)}`);
}

console.log(`\nKalimat terlalu panjang (sarankan dipangkas): ${longHits.length} pada ${byFile(longHits).length} berkas`);for (const [rel, rows] of byFile(longHits).slice(0, 40)) {
  console.log(`  ${rel} (${rows.length})`);
  for (const r of rows) console.log(`    :${r.lineNo}  ${r.text.slice(0, 170)}`);
}

if (STRICT && jargonHits.length) {
  console.error(`\nGAGAL: masih ada ${jargonHits.length} istilah teknis dalam kalimat yang dibaca pengguna.`);
  process.exit(1);
}

if (STRICT && statusHits.length) {
  console.error(`\nGAGAL: masih ada ${statusHits.length} klaim status/kecepatan yang ditulis tetap, bukan dari data terukur.`);
  process.exit(1);
}
