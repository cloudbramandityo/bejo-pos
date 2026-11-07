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

console.log(`\nLulus: ${passed} kasus.`);