/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import { Agent, AssetAdjustment, Product, StockTransaction } from '../types';
import { convertDdMmYyToYyyyMmDd } from './formatters';
import { isDigitalPrintingProduct, isPaketProduct } from './productFilters';
import {
  calculateStockItemProfit,
  getMaterialStockFormula,
  isMeterOrLembarUnit,
  normalizeStockTransaction
} from './stockUtils';

export type TrendBucket = 'HARIAN' | 'MINGGUAN' | 'BULANAN';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date lokal (bukan UTC) agar tidak bergeser satu hari */
export function parseDayKey(dayKey: string): Date {
  const parts = dayKey.split('-');
  if (parts.length !== 3) return new Date(NaN);
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d;
}

/**
 * Kunci tanggal sebuah kejadian bernilai rupiah. Data lama memakai format
 * DD/MM/YY, jadi fallback ke timestamp lokal bila tanggal tidak bisa dibaca.
 */
export function eventDayKey(date: string | undefined, timestamp: number | undefined): string {
  const raw = (date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const converted = convertDdMmYyToYyyyMmDd(raw.replace(/-/g, '/'));
  if (converted) return converted;
  if (timestamp) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return toDayKey(d);
  }
  return '';
}

export function stockTransactionDayKey(tx: StockTransaction): string {
  return eventDayKey(tx.date, tx.timestamp);
}

export function adjustmentDayKey(adj: AssetAdjustment): string {
  return eventDayKey(adj.date, adj.timestamp);
}

function addDays(dayKey: string, delta: number): string {
  const d = parseDayKey(dayKey);
  if (isNaN(d.getTime())) return dayKey;
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

/** Senin sebagai awal minggu */
function startOfWeek(dayKey: string): string {
  const d = parseDayKey(dayKey);
  const shift = (d.getDay() + 6) % 7;
  return addDays(dayKey, -shift);
}

function dayDiff(fromKey: string, toKey: string): number {
  const a = parseDayKey(fromKey).getTime();
  const b = parseDayKey(toKey).getTime();
  return Math.round((b - a) / 86400000);
}

export function bucketKeyOf(dayKey: string, bucket: TrendBucket): string {
  if (bucket === 'HARIAN') return dayKey;
  if (bucket === 'BULANAN') return dayKey.slice(0, 7);
  return startOfWeek(dayKey);
}

function lastDayOfMonth(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const end = new Date(year, month, 0).getDate();
  return `${monthKey}-${pad(end)}`;
}

function bucketLabel(bucketKey: string, bucket: TrendBucket): string {
  if (bucket === 'BULANAN') {
    const [y, m] = bucketKey.split('-');
    return `${MONTH_FULL[Number(m) - 1]} ${y}`;
  }
  const d = parseDayKey(bucketKey);
  if (isNaN(d.getTime())) return bucketKey;
  if (bucket === 'HARIAN') return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  const end = parseDayKey(addDays(bucketKey, 6));
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} - ${end.getDate()} ${MONTH_SHORT[end.getMonth()]}`;
}

/** Hari pertama sebuah bucket, dipotong ke batas bawah rentang */
function bucketStartDate(bucketKey: string, bucket: TrendBucket, limitDayKey: string): string {
  if (bucket === 'HARIAN') return bucketKey > limitDayKey ? bucketKey : limitDayKey;
  if (bucket === 'BULANAN') return `${bucketKey}-01` > limitDayKey ? `${bucketKey}-01` : limitDayKey;
  return bucketKey > limitDayKey ? bucketKey : limitDayKey;
}

function bucketEndDate(bucketKey: string, bucket: TrendBucket, limitDayKey: string): string {
  if (bucket === 'HARIAN') return bucketKey;
  const naturalEnd = bucket === 'BULANAN' ? lastDayOfMonth(bucketKey) : addDays(bucketKey, 6);
  return naturalEnd > limitDayKey ? limitDayKey : naturalEnd;
}

function bucketRangeLabel(bucketKey: string, bucket: TrendBucket): string {
  if (bucket === 'HARIAN') return bucketKey;
  const end = bucket === 'BULANAN' ? lastDayOfMonth(bucketKey) : addDays(bucketKey, 6);
  const start = bucket === 'BULANAN' ? `${bucketKey}-01` : bucketKey;
  return `${start} s.d. ${end}`;
}

/**
 * Produk yang dihitung sebagai Total Aset Toko: semua produk kecuali paket,
 * dan kecuali Digital Printing yang tidak dicentang 'isAssetToko'.
 * Aturan ini sama dengan widget Total Aset Toko di Laporan.
 */
export function isCountedInStoreAsset(product: Product): boolean {
  if (!product) return false;
  if (isPaketProduct(product)) return false;
  if (isDigitalPrintingProduct(product) && !product.isAssetToko) return false;
  return true;
}

/** Harga kulak (HPP) per satuan utama produk */
export function assetUnitCost(product: Product): number {
  return Number(product.costPrice || product.hargaKulak || 0);
}

export function currentStoreAssetValue(products: Product[]): number {
  return products.reduce((acc, p) => {
    if (!isCountedInStoreAsset(p)) return acc;
    return acc + assetUnitCost(p) * (Number(p.stock) || 0);
  }, 0);
}

/**
 * Selisih stok dalam satuan utama (roll/pak) untuk satu baris item mutasi.
 * Mengikuti konversi saat transaksi ditulis:
 * - meter/lembar: qty dibagi jumlah meter atau lembar per roll/pak
 * - roll/pak: qty dipakai apa adanya
 */
function primaryUnitDelta(item: { qty?: number; unit?: string; unitMode?: string }, product: Product): number {
  const qty = Number(item.qty) || 0;
  const isSmallUnit = item.unitMode === 'meter_lembar' ||
    (item.unitMode !== 'roll_pak' && isMeterOrLembarUnit(item.unit));
  if (!isSmallUnit) return qty;
  const perRollPak = getMaterialStockFormula(product).qtyPerRollPak || 1;
  return perRollPak > 1 ? qty / perRollPak : qty;
}

interface DayMutation {
  valueDelta: number;
  added: number;
  removed: number;
  rows: number;
  /** Selisih rupiah dari penyesuaian aset (harga kulak, koreksi manual, penjualan kasir) */
  adjusted: number;
  adjustmentRows: number;
}

function buildProductMaps(products: Product[]) {
  const byId = new Map<string, Product>();
  const byCode = new Map<string, Product>();
  const byName = new Map<string, Product>();
  products.forEach((p) => {
    if (!p) return;
    if (p.id) byId.set(p.id, p);
    const code = (p.code || '').trim().toLowerCase();
    if (code) byCode.set(code, p);
    const name = (p.name || '').trim().toLowerCase();
    if (name) byName.set(name, p);
  });
  return { byId, byCode, byName };
}

function findProduct(
  maps: ReturnType<typeof buildProductMaps>,
  item: { productId?: string; code?: string; productName?: string }
): Product | null {
  return (
    (item.productId ? maps.byId.get(item.productId) : null) ||
    (item.code ? maps.byCode.get(item.code.trim().toLowerCase()) : null) ||
    (item.productName ? maps.byName.get(item.productName.trim().toLowerCase()) : null) ||
    null
  );
}

/**
 * Rentang tren: batas bawah ditarik ke mutasi stok pertama bila lebih awal dari
 * jendela bawaan, supaya riwayat penuh ikut terlihat.
 */
export function resolveTrendRange(
  bucket: TrendBucket,
  todayKey: string,
  opts?: { from?: string; to?: string; earliestDayKey?: string; maxBackDays?: number }
): { from: string; to: string } {
  const to = (opts?.to && /^\d{4}-\d{2}-\d{2}$/.test(opts.to)) ? opts.to : todayKey;
  if (opts?.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from)) {
    return opts.from <= to ? { from: opts.from, to } : { from: to, to };
  }

  const d = parseDayKey(to);
  let from: string;
  if (bucket === 'HARIAN') from = addDays(to, -29);
  else if (bucket === 'BULANAN') {
    from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    const back = new Date(d.getFullYear(), d.getMonth() - 11, 1);
    from = `${back.getFullYear()}-${pad(back.getMonth() + 1)}-01`;
  } else {
    from = startOfWeek(addDays(to, -7 * 12));
  }

  const earliest = opts?.earliestDayKey || '';
  if (earliest && earliest < from) {
    const floor = addDays(to, -(opts?.maxBackDays ?? 1460));
    from = earliest > floor ? earliest : floor;
  }
  return { from, to };
}

export interface AssetTrendPoint {
  key: string;
  label: string;
  rangeLabel: string;
  endDate: string;
  /** Nilai Total Aset Toko per akhir periode (dinilai dengan HPP saat ini) */
  value: number;
  /** Selisih terhadap akhir periode sebelumnya */
  change: number;
  /** Nilai kulak bahan yang masuk (Pembelian) pada periode ini */
  added: number;
  /** Nilai kulak bahan yang keluar (Pengambilan agen) pada periode ini */
  removed: number;
  /** Banyak baris mutasi stok pada periode ini */
  mutationRows: number;
  /** Selisih rupiah penyesuaian aset (harga kulak / koreksi manual / penjualan kasir) */
  adjustments: number;
  /** Banyak baris penyesuaian aset pada periode ini */
  adjustmentRows: number;
}

export interface AssetTrendResult {
  points: AssetTrendPoint[];
  currentValue: number;
  rangeFrom: string;
  rangeTo: string;
  earliestMutationDay: string;
  /** Baris item mutasi yang produknya tidak ada lagi di inventory (tidak bisa dinilai) */
  untrackedItemRows: number;
}

/**
 * Rekonstruksi pergerakan Total Aset Toko.
 *
 * Nilai historis tidak disimpan sebagai saldo jadi tiap titik dihitung mundur dari
 * nilai kini, dikurangi seluruh kejadian yang terjadi setelah tanggal titik itu:
 * - mutasi stok (Pembelian masuk / Pengambilan agen keluar) dihitung dari selisih
 *   satuan utama dan dinilai dengan HPP produk saat ini;
 * - penyesuaian aset (`asset_adjustments`) sudah tersimpan dalam rupiah saat
 *   kejadiannya, sehingga koreksi stok manual, perubahan harga kulak, penjualan
 *   kasir, serta produk baru/hapus ikut menggeser garis.
 *
 * Kejadian yang terjadi sebelum data tertua yang tersimpan tidak bisa direkonstruksi;
 * itu sebabnya rentang aman dimulai dari `earliestMutationDay`.
 */
export function buildAssetTrend(params: {
  products: Product[];
  stockTransactions: StockTransaction[];
  adjustments?: AssetAdjustment[];
  bucket: TrendBucket;
  from?: string;
  to?: string;
}): AssetTrendResult {
  const { products, stockTransactions, bucket } = params;
  const adjustments = params.adjustments || [];
  const todayKey = toDayKey(new Date());
  const maps = buildProductMaps(products);

  const perDay = new Map<string, DayMutation>();
  let earliestMutationDay = '';
  let untrackedItemRows = 0;

  const dayEntry = (dayKey: string): DayMutation => {
    const entry = perDay.get(dayKey) || {
      valueDelta: 0,
      added: 0,
      removed: 0,
      rows: 0,
      adjusted: 0,
      adjustmentRows: 0
    };
    perDay.set(dayKey, entry);
    if (!earliestMutationDay || dayKey < earliestMutationDay) earliestMutationDay = dayKey;
    return entry;
  };

  stockTransactions.forEach((tx) => {
    const dayKey = stockTransactionDayKey(tx);
    if (!dayKey) return;

    const entry = dayEntry(dayKey);
    const normalized = normalizeStockTransaction(tx);
    const sign = tx.type === 'PEMBELIAN' ? 1 : -1;

    normalized.items.forEach((item) => {
      const product = findProduct(maps, item);
      if (!product) {
        untrackedItemRows += 1;
        return;
      }
      if (!isCountedInStoreAsset(product)) return;
      const primaryQty = primaryUnitDelta(item, product);
      const value = primaryQty * assetUnitCost(product);
      entry.valueDelta += sign * value;
      if (sign > 0) entry.added += value;
      else entry.removed += value;
    });

    entry.rows += 1;
  });

  // Penyesuaian aset dicatat langsung dalam rupiah saat kejadiannya terjadi,
  // jadi koreksi stok manual, perubahan harga kulak, dan penjualan kasir
  // ikut menggeser garis nilai aset pada tanggal kejadiannya.
  adjustments.forEach((adj) => {
    if (!adj) return;
    const delta = Number(adj.valueDelta) || 0;
    if (!delta) return;
    const dayKey = adjustmentDayKey(adj);
    if (!dayKey) return;
    const entry = dayEntry(dayKey);
    entry.valueDelta += delta;
    entry.adjusted += delta;
    entry.adjustmentRows += 1;
  });

  const { from, to } = resolveTrendRange(bucket, todayKey, {
    from: params.from,
    to: params.to,
    earliestDayKey: earliestMutationDay
  });

  const currentValue = currentStoreAssetValue(products);

  // Jalan mundur dari tanggal akhir: nilai per hari = nilai kini - mutasi setelah hari itu.
  // Satu hari sebelum `from` ikut dihitung sebagai pembanding titik pertama.
  const spanDays = Math.min(Math.max(dayDiff(from, to) + 1, 1), 1461);
  const walkFrom = addDays(to, 0);
  const dayValues: { dayKey: string; value: number }[] = [];
  let after = 0;
  for (let i = 0; i <= spanDays; i += 1) {
    const cursor = addDays(walkFrom, -i);
    dayValues.unshift({ dayKey: cursor, value: currentValue - after });
    const mutation = perDay.get(cursor);
    if (mutation) after += mutation.valueDelta;
  }

  const bucketsAsc: string[] = [];
  const bucketSeen = new Set<string>();
  dayValues.forEach(({ dayKey }) => {
    // Hari pembanding sebelum `from` dipakai untuk menghitung perubahan titik pertama,
    // tetapi tidak boleh muncul sebagai titik tersendiri di grafik.
    if (dayKey < from || dayKey > to) return;
    const key = bucketKeyOf(dayKey, bucket);
    if (!bucketSeen.has(key)) {
      bucketSeen.add(key);
      bucketsAsc.push(key);
    }
  });

  const valueByDay = new Map(dayValues.map((d) => [d.dayKey, d.value]));
  const totalsByBucket = new Map<
    string,
    { added: number; removed: number; rows: number; adjusted: number; adjustmentRows: number }
  >();
  perDay.forEach((mutation, dayKey) => {
    if (dayKey < from || dayKey > to) return;
    const key = bucketKeyOf(dayKey, bucket);
    const acc =
      totalsByBucket.get(key) || { added: 0, removed: 0, rows: 0, adjusted: 0, adjustmentRows: 0 };
    acc.added += mutation.added;
    acc.removed += mutation.removed;
    acc.rows += mutation.rows;
    acc.adjusted += mutation.adjusted;
    acc.adjustmentRows += mutation.adjustmentRows;
    totalsByBucket.set(key, acc);
  });

  const points: AssetTrendPoint[] = bucketsAsc.map((key) => {
    const totals =
      totalsByBucket.get(key) || { added: 0, removed: 0, rows: 0, adjusted: 0, adjustmentRows: 0 };
    const bucketEnd = bucketEndDate(key, bucket, to);
    const baselineDay = addDays(bucketStartDate(key, bucket, from), -1);
    const value = valueByDay.get(bucketEnd) ?? currentValue;
    const previousValue = valueByDay.get(baselineDay) ?? value;

    return {
      key,
      label: bucketLabel(key, bucket),
      rangeLabel: bucketRangeLabel(key, bucket),
      endDate: bucketEnd,
      value,
      change: value - previousValue,
      added: totals.added,
      removed: totals.removed,
      mutationRows: totals.rows,
      adjustments: totals.adjusted,
      adjustmentRows: totals.adjustmentRows
    };
  });

  return {
    points,
    currentValue,
    rangeFrom: from,
    rangeTo: to,
    earliestMutationDay,
    untrackedItemRows
  };
}

export interface AgentTrendBucketMeta {
  key: string;
  label: string;
}

export interface AgentPickupRow {
  name: string;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  totalQty: number;
  trxCount: number;
  amountsByBucket: Record<string, number>;
}

export interface AgentPickupTrendResult {
  buckets: AgentTrendBucketMeta[];
  rows: AgentPickupRow[];
  /** Baris grafik: label periode + kolom agent_<nama> per agen terpilih */
  chartData: Record<string, string | number>[];
  grandTotalAmount: number;
  grandTotalCost: number;
  grandTotalProfit: number;
  grandTotalQty: number;
  grandTrxCount: number;
  rangeFrom: string;
  rangeTo: string;
}

/**
 * Total Pengambilan tiap Agen pada rentang periode tertentu.
 * Sumber: StockTransaction bertipe PENGAMBILAN dengan supplierName = nama agen.
 */
export function buildAgentPickupTrend(params: {
  stockTransactions: StockTransaction[];
  products: Product[];
  agents?: Agent[];
  bucket: TrendBucket;
  from?: string;
  to?: string;
}): AgentPickupTrendResult {
  const { stockTransactions, products, agents, bucket } = params;
  const todayKey = toDayKey(new Date());
  const maps = buildProductMaps(products);

  const takes = stockTransactions
    .filter((tx) => tx.type === 'PENGAMBILAN')
    .map((tx) => ({ dayKey: stockTransactionDayKey(tx), tx }));

  const earliest = takes.reduce<string>((acc, t) => {
    if (!t.dayKey) return acc;
    return !acc || t.dayKey < acc ? t.dayKey : acc;
  }, '');

  const { from, to } = resolveTrendRange(bucket, todayKey, {
    from: params.from,
    to: params.to,
    earliestDayKey: earliest
  });

  const rows = new Map<string, AgentPickupRow>();
  const bucketSet: string[] = [];
  const bucketSeen = new Set<string>();
  const rowFor = (name: string): AgentPickupRow => {
    const existing = rows.get(name);
    if (existing) return existing;
    const created: AgentPickupRow = {
      name,
      totalAmount: 0,
      totalCost: 0,
      totalProfit: 0,
      totalQty: 0,
      trxCount: 0,
      amountsByBucket: {}
    };
    rows.set(name, created);
    return created;
  };

  (agents || []).forEach((ag) => {
    const name = (ag?.name || '').trim();
    if (name) rowFor(name);
  });

  takes.forEach(({ dayKey, tx }) => {
    if (!dayKey || dayKey < from || dayKey > to) return;
    const bucketKey = bucketKeyOf(dayKey, bucket);
    if (!bucketSeen.has(bucketKey)) {
      bucketSeen.add(bucketKey);
      bucketSet.push(bucketKey);
    }

    const name = (tx.supplierName || '').trim() || 'Umum / Tanpa Agen';
    const row = rowFor(name);
    const normalized = normalizeStockTransaction(tx);

    let amount = 0;
    let cost = 0;
    let qty = 0;
    normalized.items.forEach((item) => {
      const product = findProduct(maps, item);
      const profit = calculateStockItemProfit(item, product);
      amount += item.totalPrice || profit.totalAmount;
      cost += profit.totalCost;
      qty += profit.qty;
    });

    row.totalAmount += amount;
    row.totalCost += cost;
    row.totalProfit += amount - cost;
    row.totalQty += qty;
    row.trxCount += 1;
    row.amountsByBucket[bucketKey] = (row.amountsByBucket[bucketKey] || 0) + amount;
  });

  const buckets: AgentTrendBucketMeta[] = bucketSet
    .sort((a, b) => (a < b ? -1 : 1))
    .map((key) => ({ key, label: bucketLabel(key, bucket) }));

  const listBuckets = buckets.length > 0
    ? buckets
    : (() => {
        // Rentang tanpa mutasi: tampilkan bucket kosong dari rentang terpilih agar grafik tetap terbaca.
        const keys: string[] = [];
        const seen = new Set<string>();
        let cursor = from;
        let guard = 0;
        while (cursor <= to && guard < 1461) {
          const key = bucketKeyOf(cursor, bucket);
          if (!seen.has(key)) {
            seen.add(key);
            keys.push(key);
          }
          cursor = addDays(cursor, 1);
          guard += 1;
        }
        return keys.map((key) => ({ key, label: bucketLabel(key, bucket) }));
      })();

  const ranked = Array.from(rows.values())
    .filter((row) => row.totalAmount > 0 || row.trxCount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const chartData: Record<string, string | number>[] = listBuckets.map((meta) => {
    const point: Record<string, string | number> = { label: meta.label };
    ranked.forEach((row) => {
      point[`agent_${row.name}`] = Math.round(row.amountsByBucket[meta.key] || 0);
    });
    return point;
  });

  return {
    buckets: listBuckets,
    rows: ranked,
    chartData,
    grandTotalAmount: ranked.reduce((acc, r) => acc + r.totalAmount, 0),
    grandTotalCost: ranked.reduce((acc, r) => acc + r.totalCost, 0),
    grandTotalProfit: ranked.reduce((acc, r) => acc + r.totalProfit, 0),
    grandTotalQty: ranked.reduce((acc, r) => acc + r.totalQty, 0),
    grandTrxCount: ranked.reduce((acc, r) => acc + r.trxCount, 0),
    rangeFrom: from,
    rangeTo: to
  };
}
