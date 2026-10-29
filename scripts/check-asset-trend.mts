/**
 * Uji regresi perhitungan tren Total Aset Toko dan Total Pengambilan Agen.
 * Jalankan: npm run check:trend
 */
import assert from 'node:assert/strict';
import {
  buildAgentPickupTrend,
  buildAssetTrend,
  currentStoreAssetValue,
  stockTransactionDayKey,
  resolveTrendRange
} from '../src/utils/assetTrend';
import {
  adjustmentsFromProductEdit,
  adjustmentsFromCostEdit,
  adjustmentsFromStockDiff,
  aggregateAdjustment
} from '../src/utils/assetAdjustments';

type AnyProduct = any;
type AnyStockTx = any;
type AnyAdjustment = any;

const manualCtx = { source: 'MANUAL' } as const;

const ROLL = {
  id: 'p_roll',
  name: 'Hitam Glossy 45x15 DECOFIX',
  category: 'custom_sticker',
  code: 'BLK-15',
  unit: 'roll',
  perRollPak: '15 Meter/Roll',
  perRollPakValue: 15,
  costPrice: 100000,
  hargaAgen: 150000,
  stock: 10,
  isAssetToko: true
} as AnyProduct;

const SERVICE = {
  id: 'p_service',
  name: 'Jasa Cetak Stiker A3',
  category: 'digital_printing',
  unit: 'lembar',
  costPrice: 5000,
  stock: 999,
  isAssetToko: false
} as AnyProduct;

const PAKET = {
  id: 'p_paket',
  name: 'Paket Hemat Borosan',
  category: 'paket',
  unit: 'paket',
  costPrice: 500000,
  stock: 3
} as AnyProduct;

const products = [ROLL, SERVICE, PAKET];

const mkTx = (partial: Record<string, unknown>): AnyStockTx => ({
  id: `STK_${Math.random().toString(36).slice(2, 8)}`,
  time: '10:00:00',
  timestamp: Date.parse('2026-01-05T10:00:00'),
  supplierName: 'Supplier Umum',
  ...partial
});

// 1. Nilai aset kini hanya produk yang dihitung sebagai aset toko.
assert.equal(currentStoreAssetValue(products), 10 * 100000);

// 2. Rekonstruksi mundur: pembelian menambah, pengambilan mengurangi.
const daily = buildAssetTrend({
  products,
  stockTransactions: [
    mkTx({
      type: 'PEMBELIAN',
      date: '2026-01-05',
      supplierName: 'PT Sumber Roll',
      items: [{ productId: ROLL.id, productName: ROLL.name, qty: 5, price: 100000, totalPrice: 500000, unit: 'roll' }]
    }),
    mkTx({
      type: 'PENGAMBILAN',
      date: '2026-01-08',
      supplierName: 'Agen Tanon',
      items: [{ productId: ROLL.id, productName: ROLL.name, qty: 2, price: 150000, totalPrice: 300000, unit: 'roll' }]
    })
  ],
  bucket: 'HARIAN',
  from: '2026-01-01',
  to: '2026-01-10'
});

const valueOn = (dayKey: string) => daily.points.find((p) => p.key === dayKey)?.value;
assert.equal(valueOn('2026-01-04'), 700000, 'sebelum pembelian = stok kini dikurangi mutasi setelahnya');
assert.equal(valueOn('2026-01-06'), 1200000, 'sesudah pembelian +5 roll');
assert.equal(valueOn('2026-01-09'), 1000000, 'sesudah pengambilan -2 roll kembali ke stok kini');
assert.equal(valueOn('2026-01-10'), 1000000, 'titik akhir sama dengan nilai kini');
assert.equal(daily.points[0].change, 0, 'titik pertama berbanding hari sebelum rentang');
assert.equal(daily.points.reduce((acc, p) => acc + p.added, 0), 500000);
assert.equal(daily.points.reduce((acc, p) => acc + p.removed, 0), 200000);
assert.equal(daily.rangeFrom, '2026-01-01');
assert.equal(daily.untrackedItemRows, 0);

// 3. Item meter dikonversi ke satuan utama memakai jumlah meter per roll.
const meterTrend = buildAssetTrend({
  products,
  stockTransactions: [
    mkTx({
      type: 'PENGAMBILAN',
      date: '2026-01-07',
      supplierName: 'Agen Somet',
      items: [{ productId: ROLL.id, productName: ROLL.name, qty: 30, price: 12000, totalPrice: 360000, unit: 'meter' }]
    })
  ],
  bucket: 'HARIAN',
  from: '2026-01-01',
  to: '2026-01-10'
});
assert.equal(
  meterTrend.points.find((p) => p.key === '2026-01-06')?.value,
  1200000,
  '30 meter = 2 roll nilainya 200.000 keluar'
);

// 4. Item dengan produk yang sudah dihapus dari inventory dilaporkan, bukan dinilai diam-diam.
const orphan = buildAssetTrend({
  products,
  stockTransactions: [
    mkTx({
      type: 'PEMBELIAN',
      date: '2026-01-05',
      items: [{ productId: 'p_gone', productName: 'Bahan Lama', qty: 4, price: 50000, totalPrice: 200000, unit: 'roll' }]
    })
  ],
  bucket: 'HARIAN',
  from: '2026-01-01',
  to: '2026-01-10'
});
assert.equal(orphan.untrackedItemRows, 1);
assert.equal(orphan.points[orphan.points.length - 1].value, 1000000);

// 5. Tanggal lama format DD/MM/YY dinormalisasi ke kunci lokal.
assert.equal(stockTransactionDayKey({ date: '05/01/26' } as AnyStockTx), '2026-01-05');

// 6. Rentang mingguan menarik batas bawah ke mutasi pertama bila lebih awal dari jendela bawaan.
const weekly = buildAssetTrend({
  products,
  stockTransactions: [mkTx({ type: 'PEMBELIAN', date: '2026-01-05', items: [{ productId: ROLL.id, qty: 1, price: 100000, unit: 'roll' }] })],
  bucket: 'MINGGUAN',
  from: '2026-01-01',
  to: '2026-01-18'
});
assert.equal(weekly.points.length, 3, '3 bucket minggu: 29 Des, 5 Jan, 12 Jan');
assert.equal(weekly.points[0].endDate, '2026-01-04', 'minggu pertama terpotong di tanggal mulai');
assert.equal(weekly.points[0].value, 900000);
assert.equal(weekly.points[1].value, 1000000);
assert.equal(weekly.points[1].change, 100000, 'perubahan dibanding akhir minggu sebelumnya');

// 7. Jendela default tanpa batas manual tetap menutup di hari ini.
const defaults = resolveTrendRange('BULANAN', '2026-10-29', { earliestDayKey: '2026-09-15' });
assert.equal(defaults.from, '2025-11-01');
assert.equal(defaults.to, '2026-10-29');

// 8. Total Pengambilan per Agen per periode.
const agentTrend = buildAgentPickupTrend({
  products,
  agents: [{ id: 'a1', name: 'Agen Tanon', phone: '0811' } as any],
  bucket: 'BULANAN',
  from: '2026-01-01',
  to: '2026-03-31',
  stockTransactions: [
    mkTx({
      type: 'PENGAMBILAN',
      date: '2026-01-08',
      supplierName: 'Agen Tanon',
      items: [{ productId: ROLL.id, productName: ROLL.name, qty: 2, price: 150000, totalPrice: 300000, unit: 'roll' }]
    }),
    mkTx({
      type: 'PENGAMBILAN',
      date: '2026-02-11',
      supplierName: 'Agen Tanon',
      items: [{ productId: ROLL.id, productName: ROLL.name, qty: 1, price: 150000, totalPrice: 150000, unit: 'roll' }]
    }),
    mkTx({
      type: 'PENGAMBILAN',
      date: '2026-02-14',
      supplierName: '',
      items: [{ productId: ROLL.id, productName: ROLL.name, qty: 4, price: 150000, totalPrice: 600000, unit: 'roll' }]
    }),
    mkTx({
      type: 'PEMBELIAN',
      date: '2026-02-15',
      supplierName: 'PT Sumber Roll',
      items: [{ productId: ROLL.id, productName: ROLL.name, qty: 9, price: 100000, totalPrice: 900000, unit: 'roll' }]
    })
  ]
});

assert.deepEqual(
  agentTrend.rows.map((r) => r.name),
  ['Umum / Tanpa Agen', 'Agen Tanon'],
  'hanya PENGAMBILAN yang dihitung dan diurutkan dari nilai terbesar'
);
assert.equal(agentTrend.rows[0].totalAmount, 600000);
assert.equal(agentTrend.rows[1].totalAmount, 450000);
assert.equal(agentTrend.rows[1].totalCost, 300000, 'nilai kulak 3 roll');
assert.equal(agentTrend.rows[1].totalProfit, 150000);
assert.equal(agentTrend.grandTotalAmount, 1050000);
assert.deepEqual(agentTrend.buckets.map((b) => b.key), ['2026-01', '2026-02']);
assert.equal(agentTrend.chartData[0][`agent_Agen Tanon`], 300000);
assert.equal(agentTrend.chartData[1][`agent_Agen Tanon`], 150000);
assert.equal(agentTrend.chartData[1][`agent_Umum / Tanpa Agen`], 600000);

// 9. Penyesuaian aset: efek harga kulak dihitung pada stok lama, efek stok pada harga baru.
const ROLL_NEW_COST = { ...ROLL, id: 'p_roll2', costPrice: 120000, stock: 10 } as AnyProduct;
const rowsBoth = adjustmentsFromProductEdit(
  { ...ROLL_NEW_COST, costPrice: 100000, stock: 10 },
  { ...ROLL_NEW_COST, costPrice: 120000, stock: 12 },
  manualCtx
);
assert.deepEqual(
  rowsBoth.map((r) => r.kind),
  ['HARGA_KULAK', 'KOREKSI_STOK'],
  'satu edit harga + stok menghasilkan dua baris terpisah'
);
assert.equal(rowsBoth[0].valueDelta, 200000, '20.000 x 10 roll lama');
assert.equal(rowsBoth[1].valueDelta, 240000, '2 roll baru x harga baru');
assert.equal(
  rowsBoth.reduce((acc, r) => acc + r.valueDelta, 0),
  12 * 120000 - 10 * 100000,
  'jumlah penyesuaian = selisih nilai aset'
);

// 10. Produk non-aset (paket / jasa digital tanpa centang aset) tidak boleh dinilai.
assert.deepEqual(adjustmentsFromProductEdit(PAKET, { ...PAKET, stock: 9 }, manualCtx), []);
assert.deepEqual(adjustmentsFromProductEdit(SERVICE, { ...SERVICE, stock: 1 }, manualCtx), []);

// 11. Produk baru & hapus dicatat penuh; nol selisih tidak menghasilkan baris.
const rowDelete = adjustmentsFromProductEdit(ROLL_NEW_COST, null, manualCtx);
assert.equal(rowDelete.length, 1);
assert.equal(rowDelete[0].kind, 'PRODUK_HAPUS');
assert.equal(rowDelete[0].valueDelta, -1200000);
const rowAdd = adjustmentsFromProductEdit(null, ROLL_NEW_COST, manualCtx);
assert.equal(rowAdd[0].kind, 'PRODUK_BARU');
assert.equal(rowAdd[0].valueDelta, 1200000);
assert.deepEqual(
  adjustmentsFromProductEdit(ROLL_NEW_COST, { ...ROLL_NEW_COST, name: 'Nama baru' }, manualCtx),
  [],
  'ubah nama tanpa mengubah nilai tidak mencatat penyesuaian'
);

// 12. Centang 'Masuk Aset Toko' diubah = satu penyesuaian PERHITUNGAN_ASET.
const digitalOn = { ...SERVICE, isAssetToko: true } as AnyProduct;
const rowFlip = adjustmentsFromProductEdit(SERVICE, digitalOn, manualCtx);
assert.equal(rowFlip[0].kind, 'PERHITUNGAN_ASET');
assert.equal(rowFlip[0].valueDelta, 999 * 5000);
assert.equal(adjustmentsFromProductEdit(digitalOn, SERVICE, manualCtx)[0].valueDelta, -999 * 5000);

// 13. Hanya efek harga (jalur yang sudah menulis mutasi stok) tidak mengulang selisih stok.
const costOnly = adjustmentsFromCostEdit(
  { ...ROLL_NEW_COST, costPrice: 100000, stock: 10 },
  ROLL_NEW_COST,
  { source: 'STOCK_TX' }
);
assert.equal(costOnly.length, 1, 'satu baris harga saja');
assert.equal(costOnly[0].kind, 'HARGA_KULAK');
assert.equal(costOnly[0].valueDelta, 20000 * 10);
assert.deepEqual(adjustmentsFromCostEdit(ROLL_NEW_COST, { ...ROLL_NEW_COST, stock: 4 }, manualCtx), []);

// 14. Penjualan kasir mengurangi stok tanpa mutasi stok -> dinilai dengan HPP saat itu.
const posRows = adjustmentsFromStockDiff(
  [ROLL_NEW_COST],
  [{ ...ROLL_NEW_COST, stock: 8 }],
  'PENJUALAN_POS',
  { source: 'POS', referenceId: 'TX-1' }
);
assert.equal(posRows.length, 1);
assert.equal(posRows[0].kind, 'PENJUALAN_POS');
assert.equal(posRows[0].valueDelta, -2 * 120000);

// 15. Agregat lintas produk untuk pemulihan cadangan.
const restoreRow = aggregateAdjustment(1000000, 1440000, { source: 'RESTORE' });
assert.equal(restoreRow?.valueDelta, 440000);
assert.equal(restoreRow?.kind, 'PULIHKAN_BACKUP');

// 16. Garis tren menggeser nilai pada tanggal penyesuaian, termasuk tanpa mutasi stok.
const adjustedTrend = buildAssetTrend({
  products: [{ ...ROLL, costPrice: 120000, stock: 12 }],
  stockTransactions: [
    mkTx({
      type: 'PENGAMBILAN',
      date: '2026-01-09',
      supplierName: 'Agen Tanon',
      items: [{ productId: ROLL.id, qty: 2, price: 150000, totalPrice: 300000, unit: 'roll' }]
    })
  ],
  adjustments: [
    {
      id: 'ADJ_1',
      date: '2026-01-06',
      timestamp: Date.parse('2026-01-06T09:00:00'),
      productId: ROLL.id,
      productName: ROLL.name,
      kind: 'HARGA_KULAK',
      valueDelta: 200000,
      source: 'STOCK_TX'
    } as AnyAdjustment,
    {
      id: 'ADJ_2',
      date: '2026-01-07',
      timestamp: Date.parse('2026-01-07T09:00:00'),
      productId: ROLL.id,
      productName: ROLL.name,
      kind: 'KOREKSI_STOK',
      valueDelta: 240000,
      source: 'MANUAL'
    } as AnyAdjustment
  ],
  bucket: 'HARIAN',
  from: '2026-01-01',
  to: '2026-01-10'
});
// Nilai kini 12 x 120.000 = 1.440.000. Titik pada tanggal kejadian sudah memasukkannya.
assert.equal(adjustedTrend.currentValue, 1440000);
assert.equal(adjustedTrend.points.find((p) => p.key === '2026-01-10')?.value, 1440000);
assert.equal(adjustedTrend.points.find((p) => p.key === '2026-01-09')?.value, 1440000);
assert.equal(adjustedTrend.points.find((p) => p.key === '2026-01-08')?.value, 1680000);
assert.equal(adjustedTrend.points.find((p) => p.key === '2026-01-07')?.value, 1680000);
assert.equal(adjustedTrend.points.find((p) => p.key === '2026-01-06')?.value, 1440000);
assert.equal(adjustedTrend.points.find((p) => p.key === '2026-01-05')?.value, 1240000);
assert.equal(adjustedTrend.points.find((p) => p.key === '2026-01-07')?.adjustments, 240000);
assert.equal(adjustedTrend.points.find((p) => p.key === '2026-01-06')?.adjustmentRows, 1);
assert.equal(
  adjustedTrend.points.reduce((acc, p) => acc + p.adjustments, 0),
  440000,
  'total penyesuaian tampil di tabel'
);

// 17. Hanya penyesuaian (tidak ada mutasi stok) tetap menggeser garis.
const onlyAdjustments = buildAssetTrend({
  products: [{ ...ROLL, costPrice: 120000, stock: 10 }],
  stockTransactions: [],
  adjustments: [
    {
      id: 'ADJ_3',
      date: '2026-01-04',
      timestamp: Date.parse('2026-01-04T09:00:00'),
      productId: ROLL.id,
      productName: ROLL.name,
      kind: 'KOREKSI_STOK',
      valueDelta: -200000,
      source: 'MANUAL'
    } as AnyAdjustment
  ],
  bucket: 'HARIAN',
  from: '2026-01-01',
  to: '2026-01-06'
});
assert.equal(onlyAdjustments.points.find((p) => p.key === '2026-01-03')?.value, 1400000);
assert.equal(onlyAdjustments.points.find((p) => p.key === '2026-01-05')?.value, 1200000);
assert.equal(onlyAdjustments.earliestMutationDay, '2026-01-04');

console.log('check-asset-trend: semua kasus lulus.');
