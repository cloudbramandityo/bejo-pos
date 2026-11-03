import { LEGACY_ACCOUNT_CODES, PT_ACCOUNT_CODES } from './accountChart';
import { ENTITY_ID_PT, toEntityDateKey, type EntityProfile } from './entityRegistry';
import { money, type AggregateGroup } from './ledgerMath';

/**
 * Pembentuk jurnal rekap bulanan dari data toko.
 *
 * Histori 2022 ke atas tidak di-posting per struk: satu bulan menjadi satu
 * jurnal. Berkas ini murni perhitungan — angka tokonya dimasukkan sebagai
 * baris, jadi penjaga dapat mengujinya tanpa peramban dan tanpa server.
 *
 * Dua cara pembukuan persediaan dipakai di toko ini, dan pilihan mana yang
 * berlaku adalah konfigurasi operator, bukan asumsi sistem:
 *  - PERIODIK (bawaan, sama dengan rumus laba rugi lama): pembelian langsung
 *    menjadi harga pokok, lalu hasil opname memindahkan nilai barang yang masih
 *    ada ke neraca.
 *  - PERPETUAL: pembelian masuk persediaan, pengambilan agen keluar dari
 *    persediaan, opname hanya koreksi selisih.
 */

/** Baris penjualan: cukup kolom yang dibaca pembukuan. */
export interface SaleRow {
  id: string;
  date: string;
  total: number;
  tax?: number;
  paymentMethods?: { cash?: number; transfer?: number; qris?: number };
  invoiceStatus?: string;
  balanceDue?: number;
}

/** Baris stok masuk/keluar barang dagang. */
export interface StockRow {
  id: string;
  date: string;
  type: 'PEMBELIAN' | 'PENGAMBILAN';
  items?: { qty?: number; price?: number; totalPrice?: number }[];
  totalAmount?: number;
  totalPrice?: number;
  shippingCost?: number;
}

/** Baris shift kasir — beban operasional tercatat per shift. */
export interface ShiftRow {
  date: string;
  operationalExpenses?: number;
}

export interface InventoryModeInput {
  mode: 'PERIODIK' | 'PERPETUAL';
}

export interface CodeMap {
  cash: string;
  bank: string;
  inventory: string;
  receivable: string;
  equipment: string;
  accumulatedDepreciation: string;
  accountsPayable: string;
  vatPayable: string;
  otherLiabilities: string;
  ownerLoan: string;
  capital: string;
  drawings: string;
  sales: string;
  costOfGoods: string;
  operatingExpense: string;
}

/** Kode akun pembukuan per entitas. Perorangan memakai rekening pribadi sebagai bank. */
export const codeMapForEntity = (entity: EntityProfile | undefined): CodeMap => {
  if (entity && entity.id === ENTITY_ID_PT) {
    return {
      cash: PT_ACCOUNT_CODES.cashOnHand,
      bank: PT_ACCOUNT_CODES.bank,
      inventory: PT_ACCOUNT_CODES.inventory,
      receivable: PT_ACCOUNT_CODES.receivable,
      equipment: PT_ACCOUNT_CODES.equipment,
      accumulatedDepreciation: PT_ACCOUNT_CODES.accumulatedDepreciation,
      accountsPayable: PT_ACCOUNT_CODES.accountsPayable,
      vatPayable: PT_ACCOUNT_CODES.vatPayable,
      otherLiabilities: PT_ACCOUNT_CODES.otherLiabilities,
      ownerLoan: PT_ACCOUNT_CODES.shareholderLoan,
      capital: PT_ACCOUNT_CODES.capital,
      drawings: PT_ACCOUNT_CODES.dividends,
      sales: PT_ACCOUNT_CODES.sales,
      costOfGoods: PT_ACCOUNT_CODES.costOfGoods,
      operatingExpense: PT_ACCOUNT_CODES.operatingExpense,
    };
  }
  return {
    cash: LEGACY_ACCOUNT_CODES.cashOnHand,
    // Buku perorangan mencatat kas, transfer dan QRIS di satu tempat — sama seperti
    // laporan arus kas yang sudah ada. Rekening pribadi pemilik bukan akun usaha,
    // jadi tidak pernah dipakai jurnal dan tetap diarsipkan saat transisi.
    bank: LEGACY_ACCOUNT_CODES.cashOnHand,
    inventory: LEGACY_ACCOUNT_CODES.inventory,
    receivable: LEGACY_ACCOUNT_CODES.receivable,
    equipment: LEGACY_ACCOUNT_CODES.equipment,
    accumulatedDepreciation: LEGACY_ACCOUNT_CODES.accumulatedDepreciation,
    accountsPayable: LEGACY_ACCOUNT_CODES.accountsPayable,
    vatPayable: LEGACY_ACCOUNT_CODES.vatPayable,
    otherLiabilities: LEGACY_ACCOUNT_CODES.otherLiabilities,
    ownerLoan: LEGACY_ACCOUNT_CODES.ownerLoan,
    capital: LEGACY_ACCOUNT_CODES.capital,
    drawings: LEGACY_ACCOUNT_CODES.drawings,
    sales: LEGACY_ACCOUNT_CODES.sales,
    costOfGoods: LEGACY_ACCOUNT_CODES.costOfGoods,
    operatingExpense: LEGACY_ACCOUNT_CODES.operatingExpense,
  };
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** 'YYYY-MM' dari kunci tanggal; '' bila tanggal tidak terbaca. */
export const monthKeyOf = (dateKey: string): string => {
  const key = toEntityDateKey(dateKey);
  return key ? key.slice(0, 7) : '';
};

export const monthStartOf = (periodKey: string): string =>
  /^\d{4}-\d{2}$/.test(periodKey) ? `${periodKey}-01` : '';

export const monthEndOf = (periodKey: string): string => {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return '';
  const [year, month] = periodKey.split('-').map(Number);
  return `${year}-${pad2(month)}-${pad2(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
};

/** Daftar bulan antara dua tanggal (inklusif), urut naik. */
export const monthKeysBetween = (from: string, to: string): string[] => {
  const start = monthKeyOf(from);
  const end = monthKeyOf(to);
  if (!start || !end || start > end) return [];
  const list: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    list.push(cursor);
    const [year, month] = cursor.split('-').map(Number);
    cursor = month === 12 ? `${year + 1}-01` : `${year}-${pad2(month + 1)}`;
  }
  return list;
};

const isCancelledSale = (row: SaleRow): boolean =>
  !!row.invoiceStatus && row.invoiceStatus.toUpperCase() === 'CANCELLED';

const goodsValue = (row: StockRow): number => {
  const itemsTotal = (row.items || []).reduce((sum, item) => sum + money(item.totalPrice), 0);
  if (itemsTotal > 0) return itemsTotal;
  return money(row.totalAmount) || money(row.totalPrice);
};

/** Nilai pembelian bulan ini, ongkos kirim dipisah agar dasarnya terlihat. */
export const purchaseValues = (rows: StockRow[]): { goods: number; shipping: number; total: number } => {
  let goods = 0;
  let shipping = 0;
  for (const row of rows) {
    if (row.type !== 'PEMBELIAN') continue;
    goods += goodsValue(row);
    shipping += money(row.shippingCost);
  }
  return { goods, shipping, total: goods + shipping };
};

export const withdrawalValue = (rows: StockRow[]): number =>
  rows.filter((row) => row.type === 'PENGAMBILAN').reduce((sum, row) => sum + goodsValue(row), 0);

export interface MonthTotals {
  revenueNet: number;
  taxCollected: number;
  cashReceived: number;
  bankReceived: number;
  receivableAdded: number;
  purchases: number;
  shipping: number;
  withdrawals: number;
  operationalExpenses: number;
  saleCount: number;
  purchaseCount: number;
  withdrawalCount: number;
  shiftCount: number;
}

export interface MonthAggregate {
  periodKey: string;
  /** Batas tanggal yang benar-benar dibaca (entitas bisa mulai/berhenti di tengah bulan). */
  from: string;
  to: string;
  groups: AggregateGroup[];
  totals: MonthTotals;
  notes: string[];
}

/**
 * Rangkum satu bulan menjadi kelompok debit-kredit.
 *
 * `priorInventoryBalance` dibaca dari buku (saldo akun Persediaan sampai bulan
 * sebelumnya), bukan ditaksir. `countedInventory` diminta dari hasil opname;
 * bila operator belum mengisi, bulan itu diberi catatan dan tetap boleh dicatat
 * tanpa pemindahan nilai persediaan.
 */
export const aggregateMonth = (options: {
  periodKey: string;
  entity: EntityProfile;
  sales: readonly SaleRow[];
  stock: readonly StockRow[];
  shifts: readonly ShiftRow[];
  mode: 'PERIODIK' | 'PERPETUAL';
  priorInventoryBalance: number;
  countedInventory?: number | null;
  purchasePaidFrom?: 'cash' | 'bank' | 'accountsPayable';
}): MonthAggregate => {
  const periodKey = options.periodKey;
  const codes = codeMapForEntity(options.entity);
  const notes: string[] = [];

  // Rentang efektif: entitas lama berhenti di tanggal transisi, entitas baru mulai di sana.
  let from = monthStartOf(periodKey);
  let to = monthEndOf(periodKey);
  if (options.entity.startDate && from < options.entity.startDate) from = options.entity.startDate;
  if (options.entity.endDate && to > options.entity.endDate) to = options.entity.endDate;
  if (!from || !to || from > to) {
    return {
      periodKey,
      from,
      to,
      groups: [],
      totals: emptyTotals(),
      notes: [`Bulan ${periodKey} tidak jatuh pada periode ${options.entity.legalName}.`],
    };
  }

  const inRange = (date: string): boolean => {
    const key = toEntityDateKey(date);
    return key !== '' && key >= from && key <= to;
  };

  const sales = options.sales.filter((row) => inRange(row.date) && !isCancelledSale(row));
  const stock = options.stock.filter((row) => inRange(row.date));
  const shifts = options.shifts.filter((row) => inRange(row.date));

  const totals = emptyTotals();
  totals.saleCount = sales.length;
  totals.purchaseCount = stock.filter((row) => row.type === 'PEMBELIAN').length;
  totals.withdrawalCount = stock.filter((row) => row.type === 'PENGAMBILAN').length;
  totals.shiftCount = shifts.length;

  const groups: AggregateGroup[] = [];
  const paidCode =
    options.purchasePaidFrom === 'bank' ? codes.bank : options.purchasePaidFrom === 'accountsPayable' ? codes.accountsPayable : codes.cash;

  // 1. Pendapatan: penerimaan dulu, sisanya jadi piutang. PPN dipungut bukan pendapatan.
  for (const row of sales) {
    const gross = money(row.total);
    const tax = money(row.tax);
    const cash = money(row.paymentMethods?.cash);
    const nonCash = money(row.paymentMethods?.transfer) + money(row.paymentMethods?.qris);
    const received = cash + nonCash;
    const receivable = Math.max(0, gross - received);
    totals.cashReceived += cash;
    totals.bankReceived += nonCash;
    totals.receivableAdded += receivable;
    totals.revenueNet += gross - tax;
    totals.taxCollected += tax;
    if (cash > 0) groups.push({ debitCode: codes.cash, creditCode: codes.sales, amount: cash, memo: 'Penjualan tunai' });
    if (nonCash > 0) groups.push({ debitCode: codes.bank, creditCode: codes.sales, amount: nonCash, memo: 'Penjualan transfer/QRIS' });
    if (receivable > 0) groups.push({ debitCode: codes.receivable, creditCode: codes.sales, amount: receivable, memo: 'Penjualan belum dibayar' });
    if (tax > 0) groups.push({ debitCode: codes.sales, creditCode: codes.vatPayable, amount: tax, memo: 'PPN dipungut' });
  }

  // 2. Pembelian barang
  const bought = purchaseValues(stock);
  totals.purchases = bought.goods;
  totals.shipping = bought.shipping;
  if (bought.total > 0) {
    const debitCode = options.mode === 'PERPETUAL' ? codes.inventory : codes.costOfGoods;
    groups.push({
      debitCode,
      creditCode: paidCode,
      amount: bought.total,
      memo: options.mode === 'PERPETUAL' ? 'Pembelian bahan masuk persediaan' : 'Pembelian bahan dibiayakan',
    });
  }

  // 3. Pengambilan agen keluar barang (hanya perpetual: periodik sudah tercakup opname)
  const withdrawn = withdrawalValue(stock);
  totals.withdrawals = withdrawn;
  if (withdrawn > 0 && options.mode === 'PERPETUAL') {
    groups.push({ debitCode: codes.costOfGoods, creditCode: codes.inventory, amount: withdrawn, memo: 'Pengambilan agen' });
  } else if (withdrawn > 0) {
    notes.push(
      `Pengambilan agen ${totals.withdrawalCount} bon senilai ${withdrawn.toLocaleString('id-ID')} tidak dibukukan terpisah karena nilai persediaan diambil dari hasil opname.`
    );
  }

  // 4. Beban operasional shift
  const expenses = shifts.reduce((sum, shift) => sum + money(shift.operationalExpenses), 0);
  totals.operationalExpenses = expenses;
  if (expenses > 0) {
    groups.push({ debitCode: codes.operatingExpense, creditCode: codes.cash, amount: expenses, memo: 'Beban shift' });
  }

  // 5. Nilai persediaan hasil opname
  const counted = options.countedInventory;
  if (counted === null || counted === undefined) {
    notes.push('Nilai persediaan hasil opname belum diisi, jadi bulan ini tidak memindahkan nilai barang ke neraca.');
  } else {
    const bookBalance = options.mode === 'PERPETUAL'
      ? options.priorInventoryBalance + bought.total - withdrawn
      : options.priorInventoryBalance;
    const delta = money(counted) - bookBalance;
    if (delta !== 0) {
      groups.push({
        debitCode: delta > 0 ? codes.inventory : codes.costOfGoods,
        creditCode: delta > 0 ? codes.costOfGoods : codes.inventory,
        amount: Math.abs(delta),
        memo: delta > 0 ? 'Koreksi naik nilai persediaan' : 'Koreksi turun nilai persediaan',
      });
    }
  }

  return { periodKey, from, to, groups, totals, notes };
};

const emptyTotals = (): MonthTotals => ({
  revenueNet: 0,
  taxCollected: 0,
  cashReceived: 0,
  bankReceived: 0,
  receivableAdded: 0,
  purchases: 0,
  shipping: 0,
  withdrawals: 0,
  operationalExpenses: 0,
  saleCount: 0,
  purchaseCount: 0,
  withdrawalCount: 0,
  shiftCount: 0,
});

/** Semua bulan yang punya data toko, dari tanggal pertama buku sampai sekarang. */
export const monthsWithData = (options: {
  sales: readonly SaleRow[];
  stock: readonly StockRow[];
  shifts: readonly ShiftRow[];
  from: string;
  to: string;
}): string[] => {
  const keys = new Set<string>();
  for (const row of options.sales) keys.add(monthKeyOf(row.date));
  for (const row of options.stock) keys.add(monthKeyOf(row.date));
  for (const row of options.shifts) keys.add(monthKeyOf(row.date));
  keys.add(monthKeyOf(options.from));
  keys.delete('');
  return Array.from(keys).filter(Boolean).sort();
};
