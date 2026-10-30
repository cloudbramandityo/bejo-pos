/**
 * Uji regresi mesin hitung Rekonsiliasi: banyak kolom pembanding, arah
 * menguntungkan, persen terhadap Laporan A, dan format angkanya.
 * Jalankan: npm run check:reconciliation
 */
import assert from 'node:assert/strict';
import {
  analyzeReconciliation,
  columnKindLabel,
  createDefaultColumns,
  createDefaultRows,
  createPickupColumns,
  createReconciliationColumn,
  createReconciliationRow,
  defaultLabelsFor,
  differenceHeading,
  formatColumnValue,
  formatPercentValue,
  getCellValues,
  natureLabel,
  normalizeRowNature,
  summaryCountsText,
  toReconciliationNumber,
  verdictLabel,
} from '../src/utils/reconciliationMath';
import { normalizeStoredRun } from '../src/utils/reconciliationStorage';
import {
  ReconciliationColumn,
  ReconciliationRow,
} from '../src/types/reconciliation';

let passed = 0;
const check = (label: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`   ok  ${label}`);
};

const col = (
  id: string,
  label: string,
  kind: ReconciliationColumn['kind'] = 'UANG',
  direction: ReconciliationColumn['direction'] = 'ROW'
): ReconciliationColumn => createReconciliationColumn({ id, label, kind, direction });

const row = (
  id: string,
  label: string,
  nature: ReconciliationRow['nature'],
  values: Record<string, { a: number; b: number }>
): ReconciliationRow => createReconciliationRow({ id, label, nature, values });

const cellOf = (analysis: ReturnType<typeof analyzeReconciliation>, rowId: string, columnId: string) => {
  const rowResult = analysis.rows.find((item) => item.id === rowId);
  const cell = rowResult?.cells.find((item) => item.columnId === columnId);
  assert.ok(cell, `sel ${rowId}/${columnId} tidak ikut dinilai`);
  return cell;
};

const summaryOf = (analysis: ReturnType<typeof analyzeReconciliation>, columnId: string) => {
  const summary = analysis.summaries.find((item) => item.columnId === columnId);
  assert.ok(summary, `kolom ${columnId} tidak punya ringkasan`);
  return summary;
};

/* ---------------------------------------------------------------- angka */

check('angka bertitik dan berkoma terbaca, teks kosong jadi nol', () => {
  assert.equal(toReconciliationNumber('1.500.000'), 1500000);
  assert.equal(toReconciliationNumber('1,5'), 1.5);
  assert.equal(toReconciliationNumber('Rp 2.500'), 2500);
  assert.equal(toReconciliationNumber(''), 0);
  assert.equal(toReconciliationNumber('abc'), 0);
  assert.equal(toReconciliationNumber(null), 0);
});

check('nilai seed baris dibulatkan dua desimal saat masuk isian', () => {
  const seeded = createReconciliationRow({ values: { c1: { a: 1.23456, b: 2.5 } } });
  assert.equal(seeded.values.c1.a, 1.23);
  assert.equal(seeded.values.c1.b, 2.5);
  assert.deepEqual(getCellValues(seeded, 'c9'), { valueA: 0, valueB: 0 });
});

/* ------------------------------------------------------------ multi-kolom */

const pickupColumns = [
  col('kuantitas', 'Kuantitas diambil', 'JUMLAH', 'NAIK'),
  col('frekuensi', 'Frekuensi ambil', 'JUMLAH', 'NAIK'),
  col('nominal', 'Total nominal', 'UANG', 'ROW'),
];

const pickupRows = [
  row('agen_a', 'Agen Sari', 'PENDAPATAN', {
    kuantitas: { a: 100, b: 120 },
    frekuensi: { a: 8, b: 6 },
    nominal: { a: 5000000, b: 6000000 },
  }),
  row('agen_b', 'Agen Toko Tiga', 'PENDAPATAN', {
    kuantitas: { a: 200, b: 250 },
    frekuensi: { a: 10, b: 12 },
    nominal: { a: 9000000, b: 7000000 },
  }),
];

const pickup = analyzeReconciliation('VARIANS', pickupRows, pickupColumns);

check('tiap kolom dinilai terpisah tanpa mencampur angkanya', () => {
  assert.equal(pickup.columns.length, 3);
  assert.equal(pickup.summaries.length, 3);
  assert.equal(cellOf(pickup, 'agen_a', 'kuantitas').difference, -20);
  assert.equal(cellOf(pickup, 'agen_a', 'frekuensi').difference, 2);
  assert.equal(cellOf(pickup, 'agen_a', 'nominal').difference, -1000000);
});

check('jumlah per kolom memakai angka kolom itu saja', () => {
  assert.equal(summaryOf(pickup, 'kuantitas').totalA, 300);
  assert.equal(summaryOf(pickup, 'kuantitas').totalB, 370);
  assert.equal(summaryOf(pickup, 'kuantitas').totalDifference, -70);
  assert.equal(summaryOf(pickup, 'nominal').totalDifference, 1000000);
});

check('jumlah satu kolom sama dengan total selisih barisnya', () => {
  for (const column of pickup.columns) {
    const sum = pickup.rows.reduce(
      (acc, resultRow) => acc + (resultRow.cells.find((c) => c.columnId === column.id)?.difference ?? 0),
      0
    );
    assert.equal(summaryOf(pickup, column.id).totalDifference, Math.round(sum * 100) / 100);
  }
});

check('persen tiap kolom memakai Laporan A kolom itu', () => {
  assert.equal(cellOf(pickup, 'agen_a', 'kuantitas').percent, -20);
  assert.equal(cellOf(pickup, 'agen_b', 'nominal').percent, 22.22);
  assert.equal(summaryOf(pickup, 'frekuensi').totalPercent, 0);
  assert.equal(summaryOf(pickup, 'nominal').totalPercent, 7.14);
});

check('arah kolom mengalahkan sifat baris', () => {
  // Frekuensi turun (6 dari 8) tapi kolomnya NAIK menguntungkan -> tidak menguntungkan.
  assert.equal(cellOf(pickup, 'agen_a', 'frekuensi').verdict, 'BAD');
  // Nominal mengikuti sifat baris pendapatan: capaian di atas rencana -> menguntungkan.
  assert.equal(cellOf(pickup, 'agen_a', 'nominal').verdict, 'GOOD');
  // Agen B: nominal di bawah rencana -> tidak menguntungkan.
  assert.equal(cellOf(pickup, 'agen_b', 'nominal').verdict, 'BAD');
});

check('hitungan kesimpulan per kolom hanya menghitung kolom itu', () => {
  assert.equal(summaryOf(pickup, 'kuantitas').goodCount, 2);
  assert.equal(summaryOf(pickup, 'frekuensi').badCount, 1);
  assert.equal(summaryOf(pickup, 'nominal').badCount, 1);
});

/* -------------------------------------------------------- sifat & arah */

const single = [col('nominal', 'Nominal', 'UANG', 'ROW')];

const natureRows = [
  row('pendapatan', 'Pendapatan', 'PENDAPATAN', { nominal: { a: 1000000, b: 800000 } }),
  row('biaya', 'Beban tetap', 'BIAYA', { nominal: { a: 1000000, b: 800000 } }),
  row('sesuai', 'Biaya operasional', 'BIAYA', { nominal: { a: 500000, b: 500000 } }),
];

const nature = analyzeReconciliation('VARIANS', natureRows, single);

check('varians memakai A dikurangi B', () => {
  assert.equal(cellOf(nature, 'pendapatan', 'nominal').difference, 200000);
  assert.equal(cellOf(nature, 'pendapatan', 'nominal').percent, 20);
});

check('sifat baris menentukan untung atau tidaknya selisih yang sama', () => {
  assert.equal(cellOf(nature, 'pendapatan', 'nominal').verdict, 'BAD');
  assert.equal(cellOf(nature, 'biaya', 'nominal').verdict, 'GOOD');
  assert.equal(cellOf(nature, 'sesuai', 'nominal').verdict, 'MATCH');
});

check('kolom TURUN menguntungkan membalik arah baris pendapatan', () => {
  const retur = [col('retur', 'Retur', 'JUMLAH', 'TURUN')];
  const rows = [row('agen', 'Agen Sari', 'PENDAPATAN', { retur: { a: 10, b: 25 } })];
  const result = analyzeReconciliation('VARIANS', rows, retur);
  assert.equal(cellOf(result, 'agen', 'retur').verdict, 'BAD');
  const turun = analyzeReconciliation(
    'VARIANS',
    [row('agen', 'Agen Sari', 'PENDAPATAN', { retur: { a: 10, b: 4 } })],
    retur
  );
  assert.equal(cellOf(turun, 'agen', 'retur').verdict, 'GOOD');
});

/* ------------------------------------------------------ sifat baris baru */

check('sifat baris bawaan adalah Perbandingan', () => {
  assert.equal(createReconciliationRow().nature, 'PERBANDINGAN');
  assert.equal(createReconciliationRow({ label: 'Agen Tanon' }).nature, 'PERBANDINGAN');
  assert.equal(normalizeRowNature('BIAYA'), 'BIAYA');
  assert.equal(normalizeRowNature('ASET'), 'PERBANDINGAN');
  assert.equal(normalizeRowNature(undefined), 'PERBANDINGAN');
});

check('nama sifat baris sesuai yang dibaca operator', () => {
  assert.equal(natureLabel('PERBANDINGAN'), 'Perbandingan');
  assert.equal(natureLabel('PENDAPATAN'), 'Pendapatan');
  assert.equal(natureLabel('BIAYA'), 'Biaya/Beban');
});

const compareRows = [
  row('tanon', 'Tanon', 'PERBANDINGAN', { nominal: { a: 100, b: 140 } }),
  row('ceweng', 'Ceweng', 'PERBANDINGAN', { nominal: { a: 140, b: 100 } }),
  row('sama', 'Sari', 'PERBANDINGAN', { nominal: { a: 90, b: 90 } }),
  row('pendapatan', 'Pendapatan', 'PENDAPATAN', { nominal: { a: 1000000, b: 800000 } }),
];
const compareCols = [col('nominal', 'Nominal', 'UANG', 'ROW')];
const compared = analyzeReconciliation('VARIANS', compareRows, compareCols);

check('baris Perbandingan hanya dibandingkan, tidak dinilai untung/rugi', () => {
  assert.equal(cellOf(compared, 'tanon', 'nominal').verdict, 'NETRAL');
  assert.equal(cellOf(compared, 'ceweng', 'nominal').verdict, 'NETRAL');
  // angkanya tetap selisih biasa, jadi jumlah dan persen kolom tidak berubah bentuk
  assert.equal(cellOf(compared, 'tanon', 'nominal').difference, -40);
  assert.equal(cellOf(compared, 'tanon', 'nominal').percent, -40);
  assert.equal(summaryOf(compared, 'nominal').totalDifference, 200000);
  // baris berpendapatan di analisa yang sama tetap dinilai untung/rugi
  assert.equal(cellOf(compared, 'pendapatan', 'nominal').verdict, 'BAD');
});

check('label baris Perbandingan dibaca dari selisihnya', () => {
  assert.equal(verdictLabel('VARIANS', 'NETRAL', -40), 'Laporan B lebih besar');
  assert.equal(verdictLabel('VARIANS', 'NETRAL', 40), 'Laporan B lebih kecil');
  assert.equal(verdictLabel('VARIANS', 'NETRAL', 0), 'Sama besar');
});

check('arah kolom tidak membuat baris Perbandingan dinilai', () => {
  const up = [col('kuantitas', 'Kuantitas', 'JUMLAH', 'NAIK')];
  const result = analyzeReconciliation(
    'VARIANS',
    [row('a', 'Tanon', 'PERBANDINGAN', { kuantitas: { a: 10, b: 4 } })],
    up
  );
  assert.equal(cellOf(result, 'a', 'kuantitas').verdict, 'NETRAL');
});

check('bucket kesimpulan per kolom lengkap dan tidak ada yang hilang', () => {
  const summary = summaryOf(compared, 'nominal');
  assert.equal(summary.neutralCount, 3);
  assert.equal(summary.badCount, 1);
  assert.equal(
    summary.goodCount + summary.badCount + summary.matchCount + summary.neutralCount,
    compared.countedRows
  );
});

check('hitungan kesimpulan menyebut baris yang dibandingkan', () => {
  assert.equal(
    summaryCountsText('VARIANS', summaryOf(compared, 'nominal')),
    'Menguntungkan: 0 • Tidak menguntungkan: 1 • Sesuai rencana: 0 • Dibandingkan: 3'
  );
  const naikTurun = analyzeReconciliation('KOMPARATIF', compareRows, compareCols);
  assert.equal(summaryCountsText('KOMPARATIF', summaryOf(naikTurun, 'nominal')), 'Naik: 1 • Turun: 2 • Tetap: 1');
});

check('komparatif tetap membaca baris Perbandingan sebagai naik atau turun', () => {
  const naikTurun = analyzeReconciliation('KOMPARATIF', compareRows, compareCols);
  assert.equal(cellOf(naikTurun, 'tanon', 'nominal').verdict, 'GOOD');
  assert.equal(cellOf(naikTurun, 'tanon', 'nominal').difference, 40);
  assert.equal(summaryOf(naikTurun, 'nominal').neutralCount, 0);
});

/* ----------------------------------------------------------- komparatif */

const comparative = analyzeReconciliation('KOMPARATIF', natureRows, single);

check('komparatif memakai B dikurangi A dan mengabaikan sifat baris', () => {
  assert.equal(cellOf(comparative, 'pendapatan', 'nominal').difference, -200000);
  assert.equal(cellOf(comparative, 'pendapatan', 'nominal').verdict, 'BAD');
  assert.equal(cellOf(comparative, 'biaya', 'nominal').verdict, 'BAD');
  assert.equal(cellOf(comparative, 'sesuai', 'nominal').verdict, 'MATCH');
});

check('label komparatif membaca naik turun tetap', () => {
  assert.equal(verdictLabel('KOMPARATIF', 'GOOD'), 'Naik');
  assert.equal(verdictLabel('KOMPARATIF', 'BAD'), 'Turun');
  assert.equal(verdictLabel('KOMPARATIF', 'MATCH'), 'Tetap');
  assert.equal(verdictLabel('VARIANS', 'GOOD'), 'Menguntungkan');
  assert.equal(verdictLabel('VARIANS', 'BAD'), 'Tidak menguntungkan');
  assert.equal(verdictLabel('VARIANS', 'MATCH'), 'Sesuai rencana');
});

/* ------------------------------------------------------------- baris nol */

check('baris tanpa nama atau tanpa angka tidak ikut dinilai', () => {
  const rows = [
    row('tanpa_nama', '', 'BIAYA', { nominal: { a: 900000, b: 100000 } }),
    row('kosong', 'Stok akhir', 'BIAYA', { nominal: { a: 0, b: 0 } }),
    row('isi', 'Beban listrik', 'BIAYA', { nominal: { a: 0, b: 250000 } }),
  ];
  const result = analyzeReconciliation('VARIANS', rows, single);
  assert.equal(result.countedRows, 1);
  assert.deepEqual(
    result.rows.map((item) => item.id),
    ['isi']
  );
  assert.equal(summaryOf(result, 'nominal').totalA, 0);
  assert.equal(summaryOf(result, 'nominal').totalPercent, null);
});

check('baris bernama ikut dinilai bila salah satu kolomnya berisi angka', () => {
  const rows = [row('agen', 'Agen Sari', 'PENDAPATAN', { nominal: { a: 0, b: 0 }, kuantitas: { a: 0, b: 5 } })];
  const result = analyzeReconciliation('VARIANS', rows, pickupColumns);
  assert.equal(result.countedRows, 1);
  assert.equal(cellOf(result, 'agen', 'nominal').verdict, 'MATCH');
  assert.equal(cellOf(result, 'agen', 'kuantitas').percent, null);
});

check('tanpa baris terisi hasilnya kosong tapi jumlah tetap nol', () => {
  const result = analyzeReconciliation('VARIANS', [row('x', '', 'BIAYA', {})], single);
  assert.equal(result.rows.length, 0);
  assert.equal(result.countedRows, 0);
  assert.equal(summaryOf(result, 'nominal').totalA, 0);
  assert.equal(summaryOf(result, 'nominal').totalDifference, 0);
});

/* --------------------------------------------------------------- format */

check('kolom uang dan kolom jumlah punya format sendiri', () => {
  assert.equal(formatColumnValue('UANG', 1500000), 'Rp 1.500.000');
  assert.equal(formatColumnValue('UANG', -850000), '-Rp 850.000');
  assert.equal(formatColumnValue('UANG', -0.2), 'Rp 0');
  assert.equal(formatColumnValue('JUMLAH', 1500), '1.500');
  assert.equal(formatColumnValue('JUMLAH', 2.5), '2,5');
  assert.equal(formatColumnValue('JUMLAH', -150), '-150');
  assert.equal(formatColumnValue(undefined, 1000), 'Rp 1.000');
  assert.equal(columnKindLabel('JUMLAH'), 'Jumlah');
  assert.equal(columnKindLabel('UANG'), 'Uang');
});

check('persen memakai koma dan tanda arah, kosong bila tanpa dasar', () => {
  assert.equal(formatPercentValue(20), '+20,00%');
  assert.equal(formatPercentValue(-12.5), '-12,50%');
  assert.equal(formatPercentValue(0), '0,00%');
  assert.equal(formatPercentValue(null), '-');
});

/* ------------------------------------------------------------- bawaan */

check('bawaan analisa memakai satu kolom uang', () => {
  const columns = createDefaultColumns('VARIANS');
  assert.equal(columns.length, 1);
  assert.equal(columns[0].kind, 'UANG');
  assert.equal(columns[0].direction, 'ROW');
});

check('baris bawaan memakai sifat yang cocok dengan namanya', () => {
  const rows = createDefaultRows();
  assert.equal(rows[0].nature, 'PENDAPATAN');
  assert.ok(rows.slice(1).every((item) => item.nature === 'BIAYA'));
  assert.ok(rows.every((item) => Object.keys(item.values).length === 0));
});

check('contoh pengambilan agen punya tiga kolom dengan caranya sendiri', () => {
  const columns = createPickupColumns();
  assert.deepEqual(
    columns.map((column) => [column.label, column.kind]),
    [
      ['Kuantitas diambil', 'JUMLAH'],
      ['Frekuensi ambil', 'JUMLAH'],
      ['Total nominal', 'UANG'],
    ]
  );
  assert.equal(columns[2].direction, 'ROW');
});

check('judul laporan dan judul selisih tidak tertukar', () => {
  assert.equal(defaultLabelsFor('VARIANS').labelA, 'Laporan A (Rencana)');
  assert.equal(defaultLabelsFor('KOMPARATIF').labelB, 'Laporan B (Periode Pembanding)');
  assert.equal(differenceHeading('VARIANS'), 'Varians (A - B)');
  assert.equal(differenceHeading('KOMPARATIF'), 'Selisih (B - A)');
});

/* ------------------------------------------------------------- data lama */

check('riwayat lama satu angka terbaca jadi satu kolom nominal', () => {
  const migrated = normalizeStoredRun({
    id: 'REC-LAMA',
    kind: 'VARIANS',
    title: 'Varians lama',
    labelA: 'Rencana',
    labelB: 'Capaian',
    rows: [{ id: 'r1', label: 'Pendapatan', valueA: 5000000, valueB: 5600000, nature: 'PENDAPATAN' }],
    analysis: { kind: 'VARIANS', rows: [], totalA: 5000000 },
    notes: '',
    createdAt: 1,
    updatedAt: 2,
  });
  assert.ok(migrated);
  assert.equal(migrated.columns.length, 1);
  assert.equal(migrated.columns[0].label, 'Nominal');
  const cell = migrated.rows[0].values[migrated.columns[0].id];
  assert.equal(cell.a, 5000000);
  assert.equal(cell.b, 5600000);
  // Analisa bentuk lama tidak dipakai lagi; isian aslinya tetap bisa dijalankan ulang.
  assert.equal(migrated.analysis, null);
});

check('riwayat tanpa sifat baris terbaca sebagai Perbandingan', () => {
  const stored = normalizeStoredRun({
    id: 'REC-TANPA-SIFAT',
    kind: 'VARIANS',
    title: 'Perbandingan dua agen',
    labelA: 'Tanon',
    labelB: 'Ceweng',
    rows: [{ id: 'r1', label: 'Kuantitas', values: { nominal: { a: 120, b: 95 } } }],
    notes: '',
    createdAt: 1,
    updatedAt: 2,
  });
  assert.ok(stored);
  assert.equal(stored.rows[0].nature, 'PERBANDINGAN');
});

check('riwayat bentuk baru tetap menyimpan kolom dan hasilnya', () => {
  const stored = normalizeStoredRun({
    id: 'REC-BARU',
    kind: 'VARIANS',
    title: 'Pengambilan agen',
    labelA: 'September',
    labelB: 'Oktober',
    columns: pickup.columns.map((column) => ({
      id: column.id,
      label: column.label,
      kind: column.kind,
      direction: column.direction,
    })),
    rows: pickupRows,
    analysis: pickup,
    notes: 'catatan',
    createdAt: 1,
    updatedAt: 2,
  });
  assert.ok(stored);
  assert.equal(stored.columns.length, 3);
  assert.equal(stored.analysis?.summaries.length, 3);
  assert.equal(stored.analysis?.countedRows, 2);
});

console.log(`\n   ${passed} uji regresi Rekonsiliasi lulus.`);
