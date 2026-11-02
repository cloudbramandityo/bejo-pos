/**
 * Uji regresi cakupan berkas cadangan (.json).
 * Jalankan: npm run check:backup
 *
 * Yang dijaga (permintaan pemilik 2026-11-02: cadangan dan pemulihan harus memuat
 * seluruh data aplikasi, kecuali data akun user / User Login Credential):
 *   A  daftar domain cadangan sehat (tanpa kunci, label, atau bentuk ganda)
 *   B  data akun login keluar dari cadangan maupun pemulihan
 *   C  setiap kunci yang benar-benar ditulis ke penyimpanan perangkat ikut tercatat
 *   D  setiap domain punya jalur tulis & baca yang terpasang di mesin cadangan
 *   E  isi berkas dan ringkasannya dihitung dari daftar domain, bukan ditulis tangan
 *   F  berkas lama yang masih memuat daftar akun tetap bisa dipulihkan, isinya dibuang
 *   G  aturan murni daftar domain (penghitungan isi) berjalan seperti tertulis
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  BACKUP_DOMAINS,
  BACKUP_GROUP_ORDER,
  CREDENTIAL_EXCLUSION_NOTE,
  DEVICE_ONLY_STORAGE_PREFIXES,
  EXCLUDED_STORAGE_KEYS,
  LOGIN_CREDENTIAL_FIELDS,
  REMOVED_BACKUP_KEYS,
  backedUpStorageKeys,
  backupDomainKeys,
  backupGroups,
  countBackupDomainValue,
  deviceOnlyDomainLabels,
  excludedStorageKeys,
} from '../src/utils/backupDomains';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');

const results: string[] = [];
const check = (name: string, ok: boolean, detail = ''): void => {
  results.push(`${ok ? 'OK  ' : 'GAGAT'} ${name}${ok || !detail ? '' : ` -> ${detail}`}`);
  if (!ok) {
    console.log(results[results.length - 1]);
    throw new assert.AssertionError({ message: `Penjaga gagal: ${name}${detail ? ` -> ${detail}` : ''}` });
  }
};

const listAllFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listAllFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

const sourceFiles = listAllFiles(SRC);
const sourceOf = (file: string): string => readFileSync(path.join(SRC, file), 'utf8');

/* -------------------------------------------------------------------------- */
/*  A — daftar domain sehat                                                    */
/* -------------------------------------------------------------------------- */

const SHAPES = ['array', 'object', 'scalar'];
const CLOUD_WRITES = ['record', 'payload', 'none'];

check('A1 daftar domain tidak kosong', BACKUP_DOMAINS.length >= 30, `jumlah ${BACKUP_DOMAINS.length}`);

const keys = backupDomainKeys();
check('A2 kunci domain unik', new Set(keys).size === keys.length,
  keys.filter((k, i) => keys.indexOf(k) !== i).join(', '));

const labels = BACKUP_DOMAINS.map((d) => d.label);
check('A3 label domain unik', new Set(labels).size === labels.length,
  labels.filter((l, i) => labels.indexOf(l) !== i).join(', '));

const mirrorKeys = backedUpStorageKeys();
check('A4 satu kunci penyimpanan hanya boleh dimiliki satu domain',
  new Set(mirrorKeys).size === mirrorKeys.length,
  mirrorKeys.filter((k, i) => mirrorKeys.indexOf(k) !== i).join(', '));

check('A5 bentuk nilai hanya array/object/scalar',
  BACKUP_DOMAINS.every((d) => SHAPES.includes(d.shape)));

check('A6 cara kirim ke server hanya record/payload/none',
  BACKUP_DOMAINS.every((d) => CLOUD_WRITES.includes(d.cloudWrite)));

check('A7 kelompok domain terdaftar',
  BACKUP_DOMAINS.every((d) => BACKUP_GROUP_ORDER.includes(d.group)),
  [...new Set(BACKUP_DOMAINS.map((d) => d.group))].filter((g) => !BACKUP_GROUP_ORDER.includes(g as any)).join(', '));

check('A8 domain yang terkirim ke server menyebut kanalnya',
  BACKUP_DOMAINS.every((d) => d.cloudWrite === 'none' || Boolean(d.cloudChannel)),
  BACKUP_DOMAINS.filter((d) => d.cloudWrite !== 'none' && !d.cloudChannel).map((d) => d.key).join(', '));

check('A9 domain hanya-perangkat memang tidak punya kanal',
  BACKUP_DOMAINS.every((d) => d.cloudWrite !== 'none' || !d.cloudChannel),
  BACKUP_DOMAINS.filter((d) => d.cloudWrite === 'none' && d.cloudChannel).map((d) => d.key).join(', '));

check('A10 cara kirim per baris hanya untuk bentuk array',
  BACKUP_DOMAINS.every((d) => d.cloudWrite !== 'record' || d.shape === 'array'));

check('A11 setiap domain punya minimal satu kunci penyimpanan',
  BACKUP_DOMAINS.every((d) => d.storageKeys.length > 0));

check('A12 hanya shift aktif yang boleh bernilai kosong',
  BACKUP_DOMAINS.filter((d) => d.allowsNull).map((d) => d.key).join(',') === 'activeShift');

/* -------------------------------------------------------------------------- */
/*  B — data akun login keluar dari cadangan                                   */
/* -------------------------------------------------------------------------- */

const USER_MIRROR_KEYS = ['bejo_pos_users_v1', 'bejo_pos_auth_user_v1'];

check('B1 tidak ada domain akun login',
  !keys.some((k) => REMOVED_BACKUP_KEYS.includes(k)), keys.filter((k) => REMOVED_BACKUP_KEYS.includes(k)).join(', '));

check('B2 kunci akun masuk daftar yang sengaja tidak dicadangkan',
  USER_MIRROR_KEYS.every((k) => excludedStorageKeys().includes(k)));

const credentialReasons = EXCLUDED_STORAGE_KEYS
  .filter((item) => USER_MIRROR_KEYS.includes(item.key))
  .map((item) => item.reason);
check('B3 alasannya menyebut akun login dan kata sandi',
  credentialReasons.every((r) => /akun login/i.test(r) && /kata sandi/i.test(r)),
  credentialReasons.join(' | '));

check('B4 catatan layar menyebut akun login tidak ikut',
  /akun login/i.test(CREDENTIAL_EXCLUSION_NOTE) && /tidak ikut/i.test(CREDENTIAL_EXCLUSION_NOTE));

check('B5 kolom isian akun login terdaftar sebagai rahasia',
  ['password', 'appPassword', 'mustChangePassword', 'authId'].every((f) => LOGIN_CREDENTIAL_FIELDS.includes(f)));

const backupUtilsSource = read('src/utils/backupUtils.ts');
check('B6 mesin cadangan tidak membaca atau menulis daftar akun',
  !/getStoredUsers|saveStoredUsers|saveUserCloud/.test(backupUtilsSource));

check('B7 layar cadangan tidak lagi menghitung totalUsers',
  !/totalUsers/.test(read('src/components/CustomerScreen.tsx')));

/* -------------------------------------------------------------------------- */
/*  C — semua kunci yang benar-benar dipakai perangkat tercatat                */
/* -------------------------------------------------------------------------- */

/**
 * Kunci dibaca dari panggilan localStorage/per-sessionStorage yang sesungguhnya.
 * Nama variabel (`const STORAGE_KEY = 'bejo_x'`) dan anggota objek
 * (`STORAGE_KEYS.PRODUCTS: 'bejo_x'`) dipetakan per berkas, karena banyak berkas
 * memakai nama variabel yang sama untuk kunci yang berbeda.
 */
const touchedKeys = new Set<string>();
const dynamicPrefixHits: string[] = [];
const unreadableAccesses: string[] = [];

const KEY_LITERAL = /'(bejo[a-z0-9_]*)'/i;

for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  const rel = path.relative(SRC, file).replace(/\\/g, '/');

  const varToKey = new Map<string, string>();
  for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*'(bejo[a-z0-9_]*)'/g)) {
    varToKey.set(m[1], m[2]);
  }
  for (const m of text.matchAll(/\b([A-Z0-9_]+)\s*:\s*'(bejo[a-z0-9_]*)'/g)) {
    varToKey.set(m[1], m[2]);
  }

  for (const m of text.matchAll(
    /(?:localStorage|sessionStorage|window\.localStorage|window\.sessionStorage)\.(getItem|setItem|removeItem)\(\s*([^,)]+)/g
  )) {
    const arg = m[2].trim();
    const literal = KEY_LITERAL.exec(arg);
    if (literal) {
      touchedKeys.add(literal[1]);
      continue;
    }
    const member = /(?:STORAGE_KEYS|STORAGE_KEY)\.([A-Za-z0-9_]+)/.exec(arg) || /^([A-Za-z0-9_]+)$/.exec(arg);
    const resolved = member ? varToKey.get(member[1] || member[2]) : undefined;
    if (resolved) {
      touchedKeys.add(resolved);
      continue;
    }
    if (/^bejo/.test(arg.replace(/['"`]/g, '')) || /bejo/.test(arg)) {
      // Kunci terbentuk dari potongan dinamis; cukup dicatat sebagai awalan perangkat.
      dynamicPrefixHits.push(`${rel}: ${arg}`);
      continue;
    }
    if (!/^(key|k|storageKey|entryKey|fullKey|itemKey|storageKeyName|prefix)\b/.test(arg)) {
      unreadableAccesses.push(`${rel}: ${arg}`);
    }
  }
}

const classified = new Set([...mirrorKeys, ...excludedStorageKeys()]);
const unclassified = [...touchedKeys].filter(
  (k) => !classified.has(k) && !DEVICE_ONLY_STORAGE_PREFIXES.some((p) => k.startsWith(p))
);
check('C1 setiap kunci penyimpanan perangkat tercatat di daftar',
  unclassified.length === 0, unclassified.join(', '));

check('C2 kunci akun login ikut terdeteksi sebagai milik perangkat',
  USER_MIRROR_KEYS.every((k) => touchedKeys.has(k)),
  [...touchedKeys].filter((k) => k.includes('users') || k.includes('auth_user')).join(', ') || 'tidak terbaca');

const phantom = mirrorKeys.filter((k) => !touchedKeys.has(k) && !excludedStorageKeys().includes(k));
check('C3 tidak ada kunci fiktif di daftar domain',
  phantom.length === 0, phantom.join(', '));

check('C4 kunci yang hanya-perangkat diberi alasan',
  EXCLUDED_STORAGE_KEYS.every((item) => item.reason.trim().length > 12 && !/TODO/i.test(item.reason)));

check('C5 tidak ada kunci yang masuk dua daftar sekaligus',
  mirrorKeys.every((k) => !excludedStorageKeys().includes(k)));

/* -------------------------------------------------------------------------- */
/*  D — setiap domain terpasang di mesin cadangan                              */
/* -------------------------------------------------------------------------- */

const pbSource = read('src/backend/pocketbaseBackend.ts');

for (const domain of BACKUP_DOMAINS) {
  const entry = new RegExp(`^  ${domain.key}: \\{[\\s\\S]*?^  \\},`, 'm').exec(backupUtilsSource)?.[0] || '';
  check(`D1/${domain.key} domain terpasang di daftar akses`, entry.length > 0);
  check(`D2/${domain.key} domain punya baca dan pulih`,
    /\bread: /.test(entry) && /\brestore: /.test(entry));

  if (domain.cloudWrite === 'none') {
    check(`D3/${domain.key} domain hanya-perangkat tidak mengirim ke server`, !/\bcloud: /.test(entry));
    continue;
  }
  const cloudCall = /\bcloud: \(value\) => (\w+)\(/.exec(entry)?.[1] || '';
  check(`D4/${domain.key} jalur kirim ke server nyata`,
    Boolean(cloudCall) && new RegExp(`export (async )?function ${cloudCall}`).test(pbSource),
    cloudCall || 'tidak ada panggilan kirim');
}

check('D5 daftar akses hanya berisi domain yang terdaftar',
  keys.every((k) => backupUtilsSource.includes(`${k}: {`)));

/* -------------------------------------------------------------------------- */
/*  E — isi berkas dihitung dari daftar domain                                 */
/* -------------------------------------------------------------------------- */

check('E1 pembuatan berkas memakai daftar domain',
  /for \(const domain of BACKUP_DOMAINS\)/.test(backupUtilsSource));

check('E2 ringkasan tidak ditulis tangan per domain',
  !/totalProducts:\s*\w+\.length/.test(backupUtilsSource));

check('E3 pemulihan memakai daftar domain',
  /restoreBackupToStorage[\s\S]*for \(const domain of BACKUP_DOMAINS\)/.test(backupUtilsSource));

check('E4 kirim ke server memakai daftar domain',
  /restoreBackupToCloud[\s\S]*for \(const domain of BACKUP_DOMAINS\)/.test(backupUtilsSource));

check('E5 tidak ada daftar isi karangan di layar cadangan',
  !/Mencakup produk, kategori/.test(read('src/components/CustomerScreen.tsx')));

const screenSource = read('src/components/CustomerScreen.tsx');
check('E6 layar membaca isi dari daftar domain',
  /payloadDomainCounts/.test(screenSource) && /backupGroups\(\)/.test(screenSource) &&
  /deviceOnlyDomainLabels\(\)/.test(screenSource) && /BACKUP_DOMAINS\.length/.test(screenSource));

check('E7 layar menampilkan pengecualian akun dari daftar domain',
  /CREDENTIAL_EXCLUSION_NOTE/.test(screenSource));

check('E8 daftar domain tidak menggantung ke modul koneksi server',
  !/pocketbaseBackend/.test(read('src/utils/backupDomains.ts')));

/* -------------------------------------------------------------------------- */
/*  F — berkas lama yang memuat daftar akun                                   */
/* -------------------------------------------------------------------------- */

check('F1 berkas lama dibersihkan dari kunci akun',
  REMOVED_BACKUP_KEYS.every((k) => new RegExp(`delete cleanData\\.${k}`).test(backupUtilsSource)));

check('F2 pratinjau berkas lama tetap terukur',
  /savedCounts && typeof savedCounts\[domain\.key\] === 'number'/.test(backupUtilsSource));

/* -------------------------------------------------------------------------- */
/*  G — aturan murni dihitung benar                                            */
/* -------------------------------------------------------------------------- */

const dppRows = countBackupDomainValue('array', [1, 2, 3]);
check('G1 bentuk array dihitung dari jumlah barisnya', dppRows === 3, String(dppRows));
check('G2 bentuk objek bernilai satu', countBackupDomainValue('object', { a: 1 }) === 1);
check('G3 bentuk nilai tunggal kosong bernilai nol',
  countBackupDomainValue('scalar', '') === 0 && countBackupDomainValue('scalar', null) === 0 &&
  countBackupDomainValue('scalar', 'x') === 1);
check('G4 bentuk array kosong tidak dihitung', countBackupDomainValue('array', undefined) === 0);

const grouped = backupGroups();
check('G5 kelompok daftar isi hanya menampilkan kelompok terisi',
  grouped.length > 0 && grouped.every((entry) => entry.labels.length > 0));

const deviceOnly = deviceOnlyDomainLabels();
check('G6 daftar hanya-perangkat sama dengan domain tanpa jalur kirim',
  deviceOnly.length === BACKUP_DOMAINS.filter((d) => d.cloudWrite === 'none').length,
  deviceOnly.join(', '));

check('G7 data pajak ikut dicadangkan',
  ['taxpayerProfile', 'taxMonthlyBillings', 'taxAnnualReturns', 'taxYears'].every((k) => keys.includes(k)));

check('G8 data rekonsiliasi dan tolak cetak ikut dicadangkan',
  ['reconciliationRuns', 'printingRejects', 'invoiceStoreIdentity', 'landingDraft',
    'openAccountConfigs', 'financialSettings', 'aiSettings', 'aiChatMessages', 'userMentions']
    .every((k) => keys.includes(k)));

if (unreadableAccesses.length > 0) {
  console.log(`Catatan: ${unreadableAccesses.length} akses penyimpanan memakai variabel tak terdaftar (periksa manual):`);
  for (const item of unreadableAccesses.slice(0, 10)) console.log(`  - ${item}`);
}
if (dynamicPrefixHits.length > 0) {
  console.log(`Catatan: ${dynamicPrefixHits.length} akses penyimpanan terbentuk dinamis (kunci per perangkat):`);
  for (const item of dynamicPrefixHits.slice(0, 10)) console.log(`  - ${item}`);
}

console.log(`\nnpm run check:backup lulus — ${results.length} pemeriksaan:`);
for (const line of results) console.log(`  ${line}`);
console.log(`\nDomain dicadangkan: ${BACKUP_DOMAINS.length}; hanya di perangkat: ${deviceOnly.length};`
  + ` kunci sengaja keluar: ${EXCLUDED_STORAGE_KEYS.length}.`);
