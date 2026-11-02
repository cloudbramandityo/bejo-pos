/**
 * Uji regresi daftar tahun pajak (tab Pajak).
 * Jalankan: npm run check:tax-years
 *
 * Yang dijaga (permintaan pemilik 2026-11-02: Riwayat Pelaporan harus memuat
 * 2022, 2027, dan 2028, serta pemilik dapat menambah atau mengurangi tahun yang
 * tampil di seluruh menu tab Pajak):
 *   A  daftar bawaan & pembersihan nilai
 *   B  cermin di perangkat ini + pengumuman ke layar
 *   C  aturan tambah / kurang tahun
 *   D  tahun yang terpilih saat layar dibuka
 *   E  label rentang tahun
 *   F  seluruh layar tahun membaca daftar itu, bukan angka yang ditulis di komponen
 *   G  jalur server: kanal dipasang & dibersihkan, data dari server tidak ditulis balik
 *   H  tidak ada angka yang dikarang di Riwayat Pelaporan
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

/* ---------------------------------------------------------------- */
/*  Peramban palsu: modul tahun pajak hanya butuh dua hal ini        */
/* ---------------------------------------------------------------- */
const storage = new Map<string, string>();
const dispatched: Array<{ type: string; detail: unknown }> = [];

(globalThis as any).localStorage = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
};
(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: (event: { type: string; detail?: unknown }) => {
    dispatched.push({ type: event.type, detail: event.detail });
    return true;
  },
};

const {
  DEFAULT_TAX_YEARS,
  MAX_TAX_YEAR,
  MAX_TAX_YEARS_COUNT,
  MIN_TAX_YEAR,
  STORAGE_KEY_TAX_YEARS,
  TAX_YEARS_EVENT,
  defaultTaxYear,
  defaultTaxYearsList,
  formatYearRange,
  getDefaultTaxYearsLabel,
  getTaxYears,
  getTaxYearRangeLabel,
  isValidTaxYear,
  latestTaxYear,
  normalizeTaxYears,
  withAddedTaxYear,
  withRemovedTaxYear,
  writeTaxYears,
} = await import('../src/utils/taxYears.ts');

let failures = 0;
function check(label: string, condition: boolean, extra = '') {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!condition) failures += 1;
}

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const resetStorage = (years: readonly unknown[] | null) => {
  if (years === null) storage.delete(STORAGE_KEY_TAX_YEARS);
  else storage.set(STORAGE_KEY_TAX_YEARS, JSON.stringify(years));
  dispatched.length = 0;
};

const storageSource = read('src/utils/taxStorage.ts');
const appSource = read('src/App.tsx');
const backendSource = read('src/backend/pocketbaseBackend.ts');
const historySource = read('src/components/tax/TaxFilingHistoryView.tsx');
const settingsSource = read('src/components/tax/TaxSettingsView.tsx');

/* ---------------------------------------------------------------- */
/*  A. daftar bawaan & pembersihan nilai                             */
/* ---------------------------------------------------------------- */
check('A1 tahun bawaan memuat 2022 (awal fasilitas PP 55)', DEFAULT_TAX_YEARS.includes(2022));
check('A2 tahun bawaan memuat 2027', DEFAULT_TAX_YEARS.includes(2027));
check('A3 tahun bawaan memuat 2028', DEFAULT_TAX_YEARS.includes(2028));
check(
  'A4 bawaan terurut naik tanpa duplikat',
  (() => {
    const list = defaultTaxYearsList();
    const sorted = [...list].sort((a, b) => a - b);
    return JSON.stringify(list) === JSON.stringify(sorted) && new Set(list).size === list.length;
  })()
);
check(
  'A5 duplikat dibuang dan urutan dinaikkan',
  JSON.stringify(normalizeTaxYears([2026, 2022, 2026, 2024])) === JSON.stringify([2022, 2024, 2026])
);
check(
  'A6 nilai yang bukan tahun sah dibuang',
  normalizeTaxYears([MIN_TAX_YEAR - 1, MAX_TAX_YEAR + 1, 2024.5, NaN, '2025', null, undefined, 2025]).join() === '2025'
);
check(
  'A7 daftar dipotong sampai batas jumlah',
  normalizeTaxYears(Array.from({ length: 61 }, (_, i) => 2000 + i)).length === MAX_TAX_YEARS_COUNT
);
check('A8 tahun di batas bawah dan atas diterima', isValidTaxYear(MIN_TAX_YEAR) && isValidTaxYear(MAX_TAX_YEAR));

/* ---------------------------------------------------------------- */
/*  B. cermin perangkat ini + pengumuman ke layar                    */
/* ---------------------------------------------------------------- */
resetStorage(null);
check('B1 penyimpanan kosong memakai daftar bawaan', getTaxYears().join() === defaultTaxYearsList().join());
check('B2 bawaan langsung disimpan di perangkat ini', storage.get(STORAGE_KEY_TAX_YEARS) === JSON.stringify(defaultTaxYearsList()));

resetStorage([2025, 2023, 2023]);
check('B3 daftar tersimpan terbaca tersusun naik tanpa duplikat', getTaxYears().join() === '2023,2025');

resetStorage([2022, 2028]);
check('B4 tahun terbaru yang dipakai sebagai penanda baru', latestTaxYear() === 2028);

resetStorage(['bukan angka', 2024]);
check('B5 nilai rusak disaring saat dibaca', getTaxYears().join() === '2024');

resetStorage([2024]);
const written = writeTaxYears([2030, 2024, 2024]);
check('B6 pasang daftar: tersusun naik dan tersimpan di perangkat ini', written.join() === '2024,2030' && storage.get(STORAGE_KEY_TAX_YEARS) === JSON.stringify([2024, 2030]));
check(
  'B7 layar diberi tahu lewat event tahun pajak',
  dispatched.length === 1 &&
    dispatched[0].type === TAX_YEARS_EVENT &&
    (dispatched[0].detail as number[]).join() === '2024,2030'
);

resetStorage([2024]);
const kept = writeTaxYears([]);
check('B8 daftar kosong tidak menghapus tahun terakhir', kept.join() === '2024' && storage.get(STORAGE_KEY_TAX_YEARS) === JSON.stringify([2024]));

/* ---------------------------------------------------------------- */
/*  C. aturan tambah / kurang tahun                                   */
/* ---------------------------------------------------------------- */
const base = [2022, 2023, 2024, 2025, 2026, 2027, 2028];
check(
  'C1 menambah tahun baru menyisipkan terurut',
  (() => {
    const r = withAddedTaxYear(base, 2021);
    return r.added && r.years.join() === '2021,2022,2023,2024,2025,2026,2027,2028';
  })()
);
check(
  'C2 menambah tahun yang sudah ada ditolak',
  (() => {
    const r = withAddedTaxYear(base, 2024);
    return !r.added && r.years.join() === base.join();
  })()
);
check('C3 menambah tahun tidak sah ditolak', [1999, MAX_TAX_YEAR + 1, 2024.5].every((y) => !withAddedTaxYear(base, y).added));
check(
  'C4 menambah tahun ke daftar penuh ditolak',
  !withAddedTaxYear(normalizeTaxYears(Array.from({ length: MAX_TAX_YEARS_COUNT }, (_, i) => 2000 + i)), MAX_TAX_YEAR).added
);
check(
  'C5 mengurangi tahun yang aktif',
  (() => {
    const r = withRemovedTaxYear(base, 2022);
    return r.removed && !r.years.includes(2022) && r.years.length === base.length - 1;
  })()
);
check('C6 mengurangi tahun yang tidak ada ditolak', !withRemovedTaxYear(base, 2019).removed);
check(
  'C7 tahun terakhir tidak boleh hilang',
  (() => {
    const r = withRemovedTaxYear([2025], 2025);
    return !r.removed && r.years.join() === '2025';
  })()
);
check('C8 menambah lalu mengurangi kembali ke daftar semula', withRemovedTaxYear(withAddedTaxYear(base, 2029).years, 2029).years.join() === base.join());

/* ---------------------------------------------------------------- */
/*  D. tahun yang dipilih saat layar dibuka                           */
/* ---------------------------------------------------------------- */
const calendarYear = new Date().getFullYear();
resetStorage([calendarYear - 2, calendarYear - 1, calendarYear, calendarYear + 1]);
check('D1 memakai tahun aktif terbaru yang sudah berjalan', defaultTaxYear() === calendarYear);
resetStorage([calendarYear + 1, calendarYear + 2]);
check('D2 daftar hanya tahun mendatang memakai yang paling awal', defaultTaxYear() === calendarYear + 1);

/* ---------------------------------------------------------------- */
/*  E. label rentang tahun                                            */
/* ---------------------------------------------------------------- */
check('E1 rentang banyak tahun', formatYearRange([2022, 2028]) === '2022 - 2028');
check('E2 satu tahun ditulis tanpa tanda hubung', formatYearRange([2025]) === '2025');
check('E3 daftar kosong menghasilkan label kosong', formatYearRange([]) === '');
check('E4 label bawaan terbaca "2022 - 2028"', getDefaultTaxYearsLabel() === '2022 - 2028');
resetStorage(base);
check('E5 label rentang mengikuti daftar aktif', getTaxYearRangeLabel() === '2022 - 2028');
resetStorage([2024, 2031]);
check('E6 label rentang berubah saat daftar diubah', getTaxYearRangeLabel() === '2024 - 2031');

/* ---------------------------------------------------------------- */
/*  F. layar tahun membaca daftar, bukan angka di komponen            */
/* ---------------------------------------------------------------- */
for (const name of ['TaxScreen.tsx', 'TaxFilingHistoryView.tsx', 'TaxFilingWizard.tsx', 'TaxSettingsView.tsx']) {
  const source = read(`src/components/tax/${name}`);
  check(
    `F1 ${name} membaca daftar tahun pajak`,
    /useTaxYears|getTaxYears|getTaxYearsDescending/.test(source),
    'tidak ada satu pun pembaca daftar tahun'
  );
}

const taxComponentFiles = readdirSync(new URL('../src/components/tax/', import.meta.url)).filter((name) => name.endsWith('.tsx'));
const hardcodedList = /\[\s*20\d\d\s*(?:,\s*20\d\d\s*)+\]/;
const hardcodedCompare = /===\s*20\d\d\b/;
for (const name of taxComponentFiles) {
  const source = read(`src/components/tax/${name}`);
  check(`F2 ${name} tidak menulis daftar tahun sendiri`, !hardcodedList.test(source), hardcodedList.exec(source)?.[0]);
  check(`F3 ${name} tidak membandingkan tahun dengan angka tetap`, !hardcodedCompare.test(source), hardcodedCompare.exec(source)?.[0]);
}
check(
  'F4 penyimpanan pajak membangun isian dari daftar tahun',
  /for \(const year of getTaxYears\(\)\)/.test(storageSource) &&
    /createReturnsForConfiguredYears[\s\S]{0,140}getTaxYears\(\)/.test(storageSource)
);
check('F5 daftar empat tahun lama tidak dipakai lagi di src', !/\[2023, 2024, 2025, 2026\]|\[2026, 2025, 2024, 2023\]/.test(read('src/utils/taxStorage.ts') + taxComponentFiles.map((n) => read(`src/components/tax/${n}`)).join()));
check('F6 angka tahun bawaan hanya ada di berkas aturan', !/DEFAULT_TAX_YEARS\s*=\s*\[[^\]]*\]/.test(backendSource + storageSource + appSource));

check('F7 Pengaturan Pajak punya tombol tambah tahun', /Tambah Tahun/.test(settingsSource) && /addConfiguredTaxYear/.test(settingsSource));
check('F8 Pengaturan Pajak punya tombol sembunyikan tahun', /removeConfiguredTaxYear/.test(settingsSource) && /Sembunyikan tahun/.test(settingsSource));
check('F9 Pengaturan Pajak bisa mengembalikan bawaan', /resetTaxYearsConfig/.test(settingsSource) && /Kembalikan ke bawaan/.test(settingsSource));
check('F10 penjelasan menghapus ditulis apa adanya', /tetap tersimpan/.test(settingsSource) && !/Hapus permanen tahun/.test(settingsSource));
check('F11 menyembunyikan tahun tidak membuang isian di penyimpanan', !/delete\s+\w+\[\s*(year|yr)\s*\]/.test(storageSource));
check('F12 judul layar pengaturan memakai rentang tahun aktif', /Tahun Pajak \{formatYearRange\(taxYears\)\}/.test(settingsSource));

/* ---------------------------------------------------------------- */
/*  G. jalur server                                                   */
/* ---------------------------------------------------------------- */
check(
  'G1 kanal tahun pajak memakai langganan aman',
  /createSafeSubscription\('settings\/tax_years'/.test(backendSource) && /subscribeRecord\('settings', 'tax_years'/.test(backendSource)
);
check(
  'G2 tulis tahun pajak lewat antrean tulis ulang',
  /safeCloudWrite/.test(backendSource) && /upsertRecord\('settings', 'tax_years'/.test(backendSource)
);
check('G3 kanal tahun pajak dipasang di efek langganan App', /subscribeTaxYears\(/.test(appSource));
check('G4 kanal tahun pajak ikut dibersihkan saat berhenti', /unsubTaxYears\(\)/.test(appSource));
check(
  'G5 nilai dari server dipasang tanpa ditulis balik',
  /applyTaxYearsFromCloud\(cloudCfg\.years\)/.test(appSource) && /export const applyTaxYearsFromCloud[\s\S]{0,140}saveTaxYearsConfig\(years, true\)/.test(storageSource)
);
check('G6 server hanya ditulis bila data bukan kiriman server', /if \(!fromCloud\)[\s\S]{0,220}saveTaxYearsCloud/.test(storageSource));
check('G7 berkas aturan tahun tidak menggantung ke koneksi server', !/pocketbaseBackend/.test(read('src/utils/taxYears.ts')));
check('G8 tahun baru yang diaktifkan langsung punya tab isian', /ensureTaxYearsSeeded\(\)/.test(storageSource) && /saveStoredMonthlyBillings\(billings\)/.test(storageSource));

/* ---------------------------------------------------------------- */
/*  H. tidak ada angka yang dikarang di Riwayat Pelaporan             */
/* ---------------------------------------------------------------- */
check('H1 tidak ada klaim puncak bulan tanpa pengukuran', !/Puncak Tertinggi/.test(historySource));
check('H2 tidak ada kalimat tren "di atas 15% per tahun" karangan', !/di atas 15% per tahun/.test(historySource));
check('H3 pertumbuhan tahunan dihitung dari catatan omzet', /const yoyGrowth = useMemo/.test(historySource) && /grossRevenue/.test(historySource));
check('H4 bulan puncak diambil dari catatan omzet', /const peakRevenueMonth = useMemo/.test(historySource));
check('H5 judul dan label memakai rentang tahun aktif', /\{rangeLabel\}/.test(historySource) && /const rangeLabel = useMemo/.test(historySource));
check('H6 daftar SPT hanya menampilkan tahun aktif', /yearsAscending\.includes\(r\.taxYear\)/.test(historySource));
check('H7 nama berkas unduhan memakai nama aplikasi resmi', !/BejoStiker/.test(historySource) && /BejoDigitalPrint/.test(historySource));
check('H8 status koneksi server dibaca dari ukuran asli', /onSyncStatusChange/.test(settingsSource) && /getSyncStatus/.test(settingsSource));
check(
  'H9 lencana status di layar Pajak tidak lagi teks tetap',
  !/Data Selaras Billing/.test(read('src/components/tax/TaxScreen.tsx')) &&
    /onSyncStatusChange/.test(read('src/components/tax/TaxScreen.tsx'))
);

/* ---------------------------------------------------------------- */
/*  I. daftar tidak pernah kosong di layar                            */
/* ---------------------------------------------------------------- */
resetStorage([2030]);
assert.equal(getTaxYears().join(), '2030');
assert.equal(defaultTaxYear(), 2030);
resetStorage(null);
assert.ok(getTaxYears().length >= 7, 'daftar bawaan minimal memuat 2022 sampai 2028');

console.log('');
if (failures > 0) {
  console.error(`check:tax-years GAGAL — ${failures} temuan.`);
  process.exit(1);
}
console.log('check:tax-years lulus: daftar tahun pajak satu sumber, semua layar tahun membacanya, dan server hanya ditulis dari satu jalur.');
