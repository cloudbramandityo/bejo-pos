/**
 * Uji regresi penyimpanan data penjualan (POS, edit, hapus, mutasi stok).
 * Jalankan: npm run check:sales
 *
 * Kasus lahir dari gejala nyata: penjualan yang ditarik dari SPK ke POS tidak
 * tersimpan saat pembayaran ditekan. Empat cacat independen:
 *   1. id struk berubah bentuk (BS2026/11/0001 -> BS2026_11_0001) saat kembali
 *      dari server, penomoran mulai dari 0001 lagi, tulis berikutnya menimpa
 *      struk lama (resolveAppId / toStoredDocId / parseReceiptId).
 *   2. penjualan disimpan paling akhir di dalam updater React lewat setItem
 *      tanpa penjaga kuota; hasilnya ditelan .catch(console.error).
 *   3. pembayaran POS menutup order SPK lebih dulu dan tanpa catch; satu
 *      exception di sisi SPK menghapus penjualan yang baru dibayar.
 *   4. dedupe daftar menimpa transaksi lama saat nomor struk bertabrakan.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  toStoredDocId,
  resolveAppId,
  LEGACY_ID_FIELD,
  DATA_MIRROR_FIELD,
  PB_ID_PATTERN,
} from '../src/utils/appRecordId';
import { parseReceiptId, generateUniqueInvoiceId } from '../src/utils/formatters';
import {
  placeNewTransaction,
  replaceTransaction,
  removeTransaction,
  sortTransactionsNewestFirst,
  salesWriteNotice,
  type SalesWriteOutcome,
} from '../src/utils/salesTransactionStore';
import {
  planReceiptReconciliation,
  planIsEmpty,
  receiptKeyOf,
} from '../src/utils/salesReceiptReconciliation';
import type { Transaction } from '../src/types';

let passed = 0;
const check = (label: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`   ok  ${label}`);
};

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

function tx(id: string, timestamp = 1, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    timestamp,
    date: '01/11/26',
    time: '10:00:00',
    items: [],
    subtotal: 0,
    total: 0,
    paymentMethod: 'cash',
    ...overrides,
  } as Transaction;
}

console.log('A. Penggantian id aplikasi keluar/masuk server');

check('toStoredDocId mengganti "/" menjadi "_" untuk kunci server', () => {
  assert.equal(toStoredDocId('BS2026/11/0001'), 'BS2026_11_0001');
  assert.equal(toStoredDocId('A3-03'), 'A3-03');
  assert.equal(toStoredDocId(''), '');
});

check('resolveAppId mengutamakan cermin data (bentuk asli "/")', () => {
  const record = {
    id: 'abcdefghijklmno',
    [LEGACY_ID_FIELD]: 'BS2026_11_0001',
    [DATA_MIRROR_FIELD]: { id: 'BS2026/11/0001', total: 5000 },
  };
  assert.equal(resolveAppId(record), 'BS2026/11/0001');
});

check('resolveAppId jatuh ke legacyId lalu id PocketBase bila cermin kosong', () => {
  assert.equal(resolveAppId({ id: 'abcdefghijklmno', [LEGACY_ID_FIELD]: 'BS2026_11_0001' }), 'BS2026_11_0001');
  assert.equal(resolveAppId({ id: 'abcdefghijklmno' }), 'abcdefghijklmno');
  assert.equal(resolveAppId(null), '');
});

check('pulang-pergi: tulis dengan toStoredDocId, baca dengan resolveAppId = id asli', () => {
  const appId = 'BS2026/11/0042';
  const docId = toStoredDocId(appId);
  const mirror = { id: appId, total: 1000 };
  const record = { id: 'abcdefghijklmno', [LEGACY_ID_FIELD]: docId, [DATA_MIRROR_FIELD]: mirror };
  assert.equal(resolveAppId(record), appId);
  assert.equal(PB_ID_PATTERN.test('abcdefghijklmno'), true);
});

console.log('B. Penomoran struk mengenali kedua bentuk pemisah');

check('parseReceiptId membaca "/" dan "_"', () => {
  assert.deepEqual(parseReceiptId('BS2026/11/0001'), { year: 2026, month: '11', seq: 1 });
  assert.deepEqual(parseReceiptId('BS2026_11_0007'), { year: 2026, month: '11', seq: 7 });
  assert.equal(parseReceiptId('INV-001'), null);
  assert.equal(parseReceiptId(''), null);
});

check('generateUniqueInvoiceId tidak mulai ulang saat struk lama memakai "_"', () => {
  const now = new Date();
  const prefix = `BS${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const underscored = prefix.replace(/\//g, '_');
  const list = [{ id: `${underscored}/0009` }, { id: `${prefix}/0003` }];
  const next = generateUniqueInvoiceId(list);
  assert.equal(parseReceiptId(next)?.seq, 10);
});

console.log('C. Daftar penjualan tidak pernah menimpa struk lama');

check('transaksi baru masuk dan diurutkan terbaru lebih dulu', () => {
  const list = [tx('BS2026/11/0001', 100)];
  const placed = placeNewTransaction(list, tx('BS2026/11/0002', 200));
  assert.equal(placed.saved?.id, 'BS2026/11/0002');
  assert.equal(placed.list.length, 2);
  assert.equal(placed.list[0].id, 'BS2026/11/0002');
  assert.equal(placed.renumberedFrom, null);
});

check('nomor struk bertabrakan diganti nomor bebas, baris lama tetap utuh', () => {
  const lama = tx('BS2026/11/0001', 100, { total: 999 });
  const list = [lama];
  const placed = placeNewTransaction(list, tx('BS2026/11/0001', 200, { total: 50 }));
  assert.equal(placed.renumberedFrom, 'BS2026/11/0001');
  assert.equal(placed.saved?.id, 'BS2026/11/0002');
  assert.equal(placed.list.length, 2);
  assert.equal(placed.list.find((t) => t.id === 'BS2026/11/0001')?.total, 999);
});

check('tabrakan dikenali walau struk lama memakai "_"', () => {
  const list = [tx('BS2026_11_0005', 100)];
  const placed = placeNewTransaction(list, tx('BS2026/11/0005', 200));
  assert.equal(placed.saved?.id, 'BS2026/11/0006');
  assert.equal(placed.list.length, 2);
});

check('nomor bukan struk yang bertabrakan ditolak, bukan menimpa diam-diam', () => {
  const list = [tx('RESTORE-001', 100)];
  const placed = placeNewTransaction(list, tx('RESTORE-001', 200));
  assert.equal(placed.saved, null);
  assert.equal(placed.list.length, 1);
});

check('transaksi tanpa id ditolak', () => {
  const placed = placeNewTransaction([], tx('', 1));
  assert.equal(placed.saved, null);
});

check('replaceTransaction dan removeTransaction hanya menyentuh baris sasar', () => {
  const list = [tx('a', 300), tx('b', 200), tx('c', 100)];
  const replaced = replaceTransaction(list, tx('b', 200, { total: 77 }));
  assert.equal(replaced.find((t) => t.id === 'b')?.total, 77);
  assert.equal(replaced.length, 3);
  const removed = removeTransaction(list, 'b');
  assert.deepEqual(removed.map((t) => t.id), ['a', 'c']);
});

check('sortTransactionsNewestFirst tidak mengubah daftar asal', () => {
  const list = [tx('a', 100), tx('b', 300)];
  const sorted = sortTransactionsNewestFirst(list);
  assert.equal(sorted[0].id, 'b');
  assert.equal(list[0].id, 'a');
});

console.log('D. Kalimat status mengikuti hasil tulis sebenarnya');

const outcome = (o: Partial<SalesWriteOutcome>): SalesWriteOutcome => ({
  deviceSaved: true,
  serverSaved: false,
  queuedForRetry: false,
  ...o,
});

check('perangkat penuh -> peringatan, bukan sukses', () => {
  const n = salesWriteNotice('Penjualan #X', outcome({ deviceSaved: false }));
  assert.equal(n.tone, 'warning');
  assert.match(n.message, /penuh/);
});

check('terkirim ke server -> sukses', () => {
  const n = salesWriteNotice('Penjualan #X', outcome({ serverSaved: true }));
  assert.equal(n.tone, 'success');
});

check('masuk antrean -> peringatan terkirim otomatis', () => {
  const n = salesWriteNotice('Penjualan #X', outcome({ queuedForRetry: true }));
  assert.equal(n.tone, 'warning');
  assert.match(n.message, /otomatis/);
});

check('ditolak server -> peringatan beserta alasan', () => {
  const n = salesWriteNotice('Penjualan #X', outcome({ error: 'Missing or invalid collection context.' }));
  assert.equal(n.tone, 'warning');
  assert.match(n.message, /belum terkirim ke server/);
  assert.match(n.message, /Missing or invalid collection context/);
});

console.log('E. Pemasangan di sumber');

const backend = read('src/backend/pocketbaseBackend.ts');
const app = read('src/App.tsx');
const pos = read('src/components/PosScreen.tsx');
const storage = read('src/utils/storage.ts');
const spk = read('src/components/SpkScreen.tsx');
const history = read('src/components/TransactionHistoryScreen.tsx');

check('withAppId mengembalikan id lewat resolveAppId, bukan legacyId mentah', () => {
  assert.match(backend, /out\.id = resolveAppId\(record\) \|\| out\.id;/);
  assert.doesNotMatch(backend, /out\.id = record\[LEGACY_ID_FIELD\]/);
});

check('tulis/hapus transaksi memakai toStoredDocId', () => {
  assert.match(backend, /saveTransactionCloud[\s\S]{0,220}toStoredDocId\(/);
  assert.match(backend, /deleteTransactionCloud[\s\S]{0,220}toStoredDocId\(/);
});

check('App tidak menelan kirim penjualan dengan .catch(console.error)', () => {
  assert.doesNotMatch(app, /saveTransactionCloud\([^)]*\)\.catch\(console\.error\)/);
  assert.doesNotMatch(app, /deleteTransactionCloud\([^)]*\)\.catch\(console\.error\)/);
});

check('App menyimpan penjualan lewat placeNewTransaction + ref, bukan updater', () => {
  assert.match(app, /placeNewTransaction\(transactionsRef\.current, proposed\)/);
  assert.match(app, /const handleCompleteTransaction = async \(proposed: Transaction\): Promise<SalesSaveOutcome>/);
  assert.match(app, /const applySaleSideEffects = \(tx: Transaction\)/);
});

check('App mengembalikan hasil tulis edit/hapus penjualan', () => {
  assert.match(app, /writeSaleToServer\(\(\) => saveTransactionCloud\(updatedTx\)\)/);
  assert.match(app, /writeSaleToServer\(\(\) => deleteTransactionCloud\(txId\)\)/);
  assert.match(app, /const handleUpdateTransaction = async \(updatedTx: Transaction\): Promise<SalesWriteOutcome>/);
  assert.match(app, /const handleDeleteTransaction = async \(txId: string\): Promise<SalesWriteOutcome>/);
});

check('App mutasi stok: tulis cermin di luar updater dan laporkan penolakan', () => {
  assert.match(app, /const stockTransactionsRef = useRef<StockTransaction\[\]>/);
  assert.match(app, /reportStockWrite\(/);
  assert.doesNotMatch(app, /saveStockTransactionCloud\([^)]*\)\.catch\(console\.error\)/);
});

check('POS menunggu penjualan tercatat sebelum menutup order SPK', () => {
  const idxSale = pos.indexOf('const outcome = await onCompleteTransaction(newTx)');
  const idxSpk = pos.indexOf('if (linkedSpkIds.length > 0) {');
  assert.ok(idxSale > 0 && idxSpk > idxSale, 'penjualan harus dicatat sebelum penutupan SPK');
});

check('POS punya catch pembayaran dan memakai kalimat status bersama', () => {
  assert.match(pos, /catch \(paymentErr/);
  assert.match(pos, /salesWriteNotice\(/);
  assert.match(pos, /await saveSpkOrderCloud\(refreshed\)/);
  assert.doesNotMatch(pos, /saveSpkOrderCloud\(refreshed\)\.catch\(console\.error\)/);
});

check('cermin transaksi tahan kuota dan mengembalikan boolean', () => {
  assert.match(storage, /export function saveStoredTransactions\(transactions: Transaction\[\]\): boolean/);
  assert.match(storage, /function writeListMirror/);
  assert.match(storage, /export function saveStoredStockTransactions\(txs: StockTransaction\[\]\): boolean/);
});

check('statusLogs SPK dinormalkan agar pembayaran POS tidak terputus', () => {
  assert.match(storage, /statusLogs: order\.statusLogs \|\| \[\]/);
  assert.match(storage, /\.\.\.\(order\.statusLogs \|\| \[\]\)/);
  assert.doesNotMatch(spk, /\.\.\.order\.statusLogs,/);
  assert.doesNotMatch(spk, /selectedOrder\.statusLogs\.map/);
});

check('layar riwayat membaca hasil tulis, bukan sukses tetap', () => {
  assert.match(history, /onUpdateTransaction\?: \(updatedTx: Transaction\) => Promise<SalesWriteOutcome>/);
  assert.match(history, /onDeleteTransaction\?: \(transactionId: string\) => Promise<SalesWriteOutcome>/);
  assert.match(history, /salesWriteNotice\(/);
});

console.log('F. Rekonsiliasi nomor struk yang tercatat dua kali');

type Rec = Parameters<typeof planReceiptReconciliation>[0][number];

function rec(overrides: Partial<Rec> & { recordId: string }): Rec {
  const appId = overrides.appId ?? 'BS2026/10/0100';
  return {
    recordId: overrides.recordId,
    appId,
    legacyId: overrides.legacyId ?? appId.replace(/\//g, '_'),
    mirrorId: overrides.mirrorId ?? appId,
    hasMirror: overrides.hasMirror ?? true,
    createdAt: overrides.createdAt ?? '2026-10-22T03:00:00.000Z',
    updated: overrides.updated ?? '2026-10-22T03:00:00.000Z',
    timestamp: overrides.timestamp ?? 1000,
    total: overrides.total ?? 48000,
    date: overrides.date ?? '22/10/26',
    time: overrides.time ?? '10:00:00',
    items: overrides.items ?? [{ name: 'Banner', qty: 1, totalPrice: 48000 }],
  };
}

check('receiptKeyOf menyamakan "/" dan "_", menolak nomor bukan struk', () => {
  assert.equal(receiptKeyOf('BS2026/10/0155'), 'BS2026/10/0155');
  assert.equal(receiptKeyOf('BS2026_10_0155'), 'BS2026/10/0155');
  assert.equal(receiptKeyOf('BS2026_10_155'), 'BS2026/10/0155');
  assert.equal(receiptKeyOf('INV/BJP/2026/11/0001'), null);
  assert.equal(receiptKeyOf(''), null);
});

check('duplikat murni: satu record dipertahankan, sisanya dihapus', () => {
  const plan = planReceiptReconciliation([
    rec({ recordId: 'lama', legacyId: 'BS2026/10/0155', appId: 'BS2026/10/0155', hasMirror: false, mirrorId: '' }),
    rec({ recordId: 'baru', legacyId: 'BS2026_10_0155', appId: 'BS2026/10/0155' }),
  ]);
  assert.equal(plan.identicalGroups, 1);
  assert.equal(plan.conflictGroups, 0);
  assert.deepEqual(plan.deletes.map((item) => item.recordId), ['lama']);
  assert.equal(plan.deletes[0].keepRecordId, 'baru');
  assert.equal(plan.renames.length, 0);
});

check('record dengan cermin data dipilih untuk dipertahankan', () => {
  const plan = planReceiptReconciliation([
    rec({ recordId: 'tanpa-cermin', appId: 'BS2026_10_0155', mirrorId: '', hasMirror: false }),
    rec({ recordId: 'bercermin', appId: 'BS2026_10_0155' }),
  ]);
  assert.equal(plan.groups[0].keepRecordId, 'bercermin');
  assert.deepEqual(plan.deletes.map((item) => item.recordId), ['tanpa-cermin']);
});

check('penjualan berbeda dengan nomor sama: yang awal tetap, yang berikutnya diberi nomor baru', () => {
  const plan = planReceiptReconciliation([
    rec({ recordId: 'awal', appId: 'BS2026/10/0200', timestamp: 1000, total: 10000 }),
    rec({ recordId: 'berikut', appId: 'BS2026_10_0200', timestamp: 2000, total: 20000, items: [{ name: 'Stiker', qty: 2 }] }),
  ]);
  assert.equal(plan.conflictGroups, 1);
  assert.equal(plan.deletes.length, 0, 'penjualan nyata tidak boleh dihapus');
  assert.equal(plan.groups[0].keepRecordId, 'awal');
  assert.equal(plan.renames.length, 1);
  assert.equal(plan.renames[0].recordId, 'berikut');
  assert.equal(plan.renames[0].newReceipt, 'BS2026/10/0201');
});

check('nomor baru tidak menabrak struk lain maupun nomor baru lainnya', () => {
  const plan = planReceiptReconciliation([
    rec({ recordId: 'a1', appId: 'BS2026/10/0300', timestamp: 1000, total: 1 }),
    rec({ recordId: 'a2', appId: 'BS2026/10/0300', timestamp: 2000, total: 2 }),
    rec({ recordId: 'a3', appId: 'BS2026/10/0300', timestamp: 3000, total: 3 }),
    rec({ recordId: 'b1', appId: 'BS2026/10/0301', timestamp: 4000, total: 4 }),
    rec({ recordId: 'b2', appId: 'BS2026/10/0301', timestamp: 5000, total: 5 }),
    rec({ recordId: 'single', appId: 'BS2026/10/0302', timestamp: 6000, total: 6 }),
  ]);
  const assigned = plan.renames.map((item) => item.newReceipt);
  assert.deepEqual(assigned, ['BS2026/10/0303', 'BS2026/10/0304', 'BS2026/10/0305']);
  assert.equal(new Set(assigned).size, assigned.length);
});

check('rencana tidak bergantung pada urutan record yang dibaca', () => {
  const records = [
    rec({ recordId: 'x1', appId: 'BS2026/10/0400', timestamp: 1000, total: 1 }),
    rec({ recordId: 'x2', appId: 'BS2026/10/0400', timestamp: 2000, total: 2 }),
    rec({ recordId: 'y1', appId: 'BS2026/10/0401', timestamp: 3000, total: 3 }),
    rec({ recordId: 'y2', appId: 'BS2026/10/0401', timestamp: 4000, total: 4 }),
  ];
  const forward = planReceiptReconciliation(records);
  const backward = planReceiptReconciliation([...records].reverse());
  assert.deepEqual(
    forward.renames.map((item) => [item.recordId, item.newReceipt]),
    backward.renames.map((item) => [item.recordId, item.newReceipt])
  );
  assert.deepEqual(forward.deletes.map((item) => item.recordId), backward.deletes.map((item) => item.recordId));
});

check('penanda id yang dipertahankan disamakan ke legacyId "_" + cermin "/"', () => {
  const plan = planReceiptReconciliation([
    rec({ recordId: 'a-lama', appId: 'BS2026_10_0500', legacyId: 'BS2026_10_0500', mirrorId: 'BS2026_10_0500' }),
    rec({ recordId: 'b-baru', appId: 'BS2026_10_0500', legacyId: 'BS2026_10_0500', mirrorId: 'BS2026_10_0500' }),
  ]);
  const keepId = plan.groups[0].keepRecordId;
  const normalize = plan.normalizes.find((item) => item.recordId === keepId);
  assert.ok(normalize, 'record yang dipertahankan harus dinormalkan');
  assert.equal(normalize?.desiredAppId, 'BS2026/10/0500');
  assert.equal(toStoredDocId(normalize!.desiredAppId), 'BS2026_10_0500');
  assert.equal(normalize?.createsMirror, false);
});

check('record tanpa cermin hanya ditambah data.id, bukan dikarang isinya', () => {
  const plan = planReceiptReconciliation([
    rec({ recordId: 'polos', appId: 'BS2026_10_0600', legacyId: 'BS2026_10_0600', mirrorId: '', hasMirror: false }),
    rec({ recordId: 'kembar', appId: 'BS2026_10_0600', legacyId: 'BS2026_10_0600', mirrorId: '', hasMirror: false }),
  ]);
  const normalize = plan.normalizes[0];
  assert.equal(normalize.createsMirror, true);
  assert.match(normalize.reason, /hanya menambah data\.id/);
});

check('tautan SPK dipindah hanya ke penjualan yang waktunya paling dekat', () => {
  const records = [
    rec({ recordId: 'awal', appId: 'BS2026/10/0700', timestamp: 1000, total: 1 }),
    rec({ recordId: 'berikut', appId: 'BS2026/10/0700', timestamp: 2000, total: 2 }),
  ];
  const dekatBaru = planReceiptReconciliation(records, [
    { recordId: 'spk1', orderNumber: 'SPK-1', posTransactionId: 'BS2026/10/0700', timestamp: 2100 },
  ]);
  assert.equal(dekatBaru.spkRelinks.length, 1);
  assert.equal(dekatBaru.spkRelinks[0].toReceipt, 'BS2026/10/0701');

  const dekatLama = planReceiptReconciliation(records, [
    { recordId: 'spk2', orderNumber: 'SPK-2', posTransactionId: 'BS2026_10_0700', timestamp: 900 },
  ]);
  assert.equal(dekatLama.spkRelinks.length, 0);

  const seri = planReceiptReconciliation(records, [
    { recordId: 'spk3', orderNumber: 'SPK-3', posTransactionId: 'BS2026/10/0700', timestamp: 1500 },
  ]);
  assert.equal(seri.spkRelinks.length, 0);
  assert.equal(seri.spkAmbiguous.length, 1, 'waktu seri tidak boleh dipindahkan diam-diam');
});

check('record tunggal berbentuk "/" ikut disamakan agar tidak jadi duplikat berikutnya', () => {
  const plan = planReceiptReconciliation([
    rec({ recordId: 'tunggal', appId: 'BS2026/10/0900', legacyId: 'BS2026/10/0900' }),
  ]);
  assert.equal(plan.duplicateGroups, 0);
  assert.equal(plan.deletes.length, 0);
  assert.equal(plan.renames.length, 0);
  assert.equal(plan.normalizes.length, 1);
  assert.equal(plan.normalizes[0].desiredAppId, 'BS2026/10/0900');
  assert.equal(planIsEmpty(plan), false);
});

check('rencana kosong setelah tidak ada duplikat', () => {
  const plan = planReceiptReconciliation([rec({ recordId: 'tunggal', appId: 'BS2026/10/0800' })]);
  assert.equal(plan.duplicateGroups, 0);
  assert.equal(planIsEmpty(plan), true);
});

console.log('G. Pemasangan rekonsiliasi di sumber');

const receiptRules = read('src/utils/salesReceiptReconciliation.ts');
const reconcileScript = read('scripts/reconcile-sales-receipts.mts');

check('modul aturan murni: hanya mengimpor pengenal nomor struk dan id', () => {
  const imports = [...receiptRules.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./formatters', './appRecordId']);
  assert.doesNotMatch(receiptRules, /localStorage|pocketbaseBackend|from '\.\.\/backend/);
});

check('skrip memakai modul aturan, tidak menulis klasifikasi sendiri', () => {
  assert.match(reconcileScript, /from '\.\.\/src\/utils\/salesReceiptReconciliation'/);
  assert.doesNotMatch(reconcileScript, /function saleSignature|function receiptKeyOf/);
});

check('bawaan skrip adalah pratinjau; menulis hanya dengan --apply', () => {
  assert.match(reconcileScript, /apply: false/);
  assert.match(reconcileScript, /if \(!args\.apply\)/);
  assert.match(reconcileScript, /PRATINJAU \(tidak menulis\)/);
});

check('cadangan ditulis sebelum satu pun record diubah', () => {
  const idxBackup = reconcileScript.indexOf('sales-reconcile-backup-');
  const writes = [
    reconcileScript.indexOf(".collection('transactions').update"),
    reconcileScript.indexOf(".collection('transactions').delete"),
    reconcileScript.indexOf(".collection('spk_orders').update"),
  ].filter((index) => index > 0);
  assert.ok(idxBackup > 0 && writes.length === 3, 'ketiga jalur tulis harus ada');
  assert.ok(writes.every((index) => index > idxBackup), 'cadangan harus lebih dulu');
  assert.match(reconcileScript, /if \(!fs\.existsSync\(backupPath\)/);
});

check('sesudah menulis, skrip membaca ulang dan memastikan lingkupnya bersih', () => {
  assert.match(reconcileScript, /sales-reconcile-verify-/);
  assert.match(reconcileScript, /if \(!planIsEmpty\(afterPlan\)\)/);
});

console.log(`\nLulus: ${passed} kasus.`);