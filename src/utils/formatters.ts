/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import { Product, Shift, Transaction } from '../types';

export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

export function formatNumber(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0';
  return Math.round(amount).toLocaleString('id-ID');
}

export function formatVolume(qty: number): string {
  if (isNaN(qty) || qty === null || qty === undefined) return '0,00';
  return Number(qty).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumberInput(val: string | number): string {
  if (val === '' || val === null || val === undefined) return '';
  const str = String(val).trim();
  const isNegative = str.startsWith('-');
  const digits = str.replace(/[^0-9]/g, '');
  if (!digits) return isNegative ? '-' : '';
  const formatted = parseInt(digits, 10).toLocaleString('id-ID');
  return isNegative ? `-${formatted}` : formatted;
}

export function parseNumber(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).trim();
  const isNegative = str.startsWith('-');
  const cleaned = str.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10) || 0;
  return isNegative ? -num : num;
}

export function parseDecimal(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim().replace(',', '.');
  const cleaned = str.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function formatItemTransactionSpec(item: {
  saleType?: 'meter' | 'roll' | 'lembar' | string;
  lengthMeters?: number;
  widthMeters?: number;
  itemCount?: number;
  qty?: number;
  dimensions?: string;
  unit?: string;
  formattedSpec?: string;
}): string {
  if (item.formattedSpec && item.formattedSpec.trim()) {
    return item.formattedSpec.trim();
  }

  // 1. Meter: (panjang) x (lebar) x (jumlah)
  if (item.saleType === 'meter' || (item.lengthMeters !== undefined && item.widthMeters !== undefined && item.lengthMeters > 0 && item.widthMeters > 0)) {
    const len = item.lengthMeters ?? 0;
    const wid = item.widthMeters ?? 0;
    const count = item.itemCount ?? 1;
    return `${len} x ${wid} x ${count}`;
  }

  // 2. Roll: (jumlah roll)
  if (item.saleType === 'roll' || (item.unit && item.unit.toLowerCase().includes('roll'))) {
    const count = item.itemCount ?? item.qty ?? 1;
    return `${count} Roll`;
  }

  // 3. Lembar: (jumlah lembar)
  if (item.saleType === 'lembar' || (item.unit && item.unit.toLowerCase().includes('lembar'))) {
    const count = item.itemCount ?? item.qty ?? 1;
    return `${count} Lembar`;
  }

  // 4. Production Supplies: (jumlah) (Eceran / Pak)
  if (item.saleType === 'supplies') {
    const count = item.itemCount ?? item.qty ?? 1;
    return `${count} ${item.unit || 'Pcs'}`;
  }

  // 5. Paket: (jumlah) Paket
  if (item.saleType === 'paket') {
    const count = item.itemCount ?? item.qty ?? 1;
    return `${count} Paket`;
  }

  // Fallback parsing from unit pattern e.g. "P:2m x L:1.52m" or "1.52x50"
  if (item.unit) {
    const match = item.unit.match(/P:([\d.]+)m?\s*x\s*L:([\d.]+)m?/i);
    if (match) {
      const p = match[1];
      const l = match[2];
      const count = item.itemCount ?? item.qty ?? 1;
      return `${p} x ${l} x ${count}`;
    }
  }

  if (item.dimensions && item.dimensions.includes('x')) {
    const parts = item.dimensions.split('x');
    if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      const count = item.itemCount ?? item.qty ?? 1;
      return `${parts[0]} x ${parts[1]} x ${count}`;
    }
  }

  const dimPart = item.dimensions ? `${item.dimensions}` : '';
  const unitPart = item.unit ? `${item.unit}` : '';
  return `${dimPart} ${unitPart}`.trim() || `${item.qty || 1}`;
}

export function generateUniqueInvoiceId(transactions: { id: string }[] = []): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `BS${year}/${month}/`;

  let maxSeq = 0;
  if (Array.isArray(transactions)) {
    transactions.forEach((tx) => {
      if (tx && tx.id && tx.id.startsWith(prefix)) {
        const seqPart = tx.id.slice(prefix.length);
        const num = parseInt(seqPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });
  }

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

export function getInvoiceNumber(count: number, transactions?: { id: string }[]): string {
  if (transactions && transactions.length > 0) {
    return generateUniqueInvoiceId(transactions);
  }
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(count + 1).padStart(4, '0');
  return `BS${year}/${month}/${seq}`;
}

export function getFormattedDate(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function getFormattedTime(includeSeconds: boolean = true): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  if (includeSeconds) {
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  }
  return `${hours}:${mins}`;
}

export function getMaterialPrice(
  product: Product,
  customerCategoryName?: string,
  saleType: 'meter' | 'roll' = 'meter'
): number {
  if (!product) return 0;
  const cat = (customerCategoryName || 'GROSIR').toUpperCase().trim();

  if (saleType === 'meter') {
    // Penjualan per Meter:
    // GROSIR = HARGA METER GROSIR
    // UMUM = HARGA METER UMUM
    if (cat.includes('GROSIR')) {
      if (product.hargaMeterGrosir && product.hargaMeterGrosir > 0) return product.hargaMeterGrosir;
      if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
      return product.price || 0;
    } else if (cat.includes('AGEN')) {
      if (product.hargaAgen && product.hargaAgen > 0) return product.hargaAgen;
      if (product.hargaMeterGrosir && product.hargaMeterGrosir > 0) return product.hargaMeterGrosir;
      return product.price || 0;
    } else {
      // UMUM / RETAIL
      if (product.hargaMeterUmum && product.hargaMeterUmum > 0) return product.hargaMeterUmum;
      if (product.hargaUmum && product.hargaUmum > 0) return product.hargaUmum;
      return product.price || 0;
    }
  } else {
    // Penjualan per Roll:
    // GROSIR = HARGA GROSIR
    // UMUM = HARGA UMUM
    if (cat.includes('GROSIR')) {
      if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
      return product.price || 0;
    } else if (cat.includes('AGEN')) {
      if (product.hargaAgen && product.hargaAgen > 0) return product.hargaAgen;
      if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
      return product.price || 0;
    } else {
      // UMUM / RETAIL
      if (product.hargaUmum && product.hargaUmum > 0) return product.hargaUmum;
      return product.price || 0;
    }
  }
}

export function getPrintServicePrice(
  product: Product,
  customerCategoryName?: string,
  saleType: 'meter' | 'lembar' = 'meter'
): number {
  if (!product) return 0;
  const cat = (customerCategoryName || 'GROSIR').toUpperCase().trim();

  if (saleType === 'meter') {
    // Penjualan per Meter:
    // (PxL)meter X Harga Jual
    // Harga Jual pelanggan GROSIR = HARGA METER GROSIR
    // Harga Jual pelanggan UMUM = HARGA METER UMUM
    if (cat.includes('GROSIR')) {
      if (product.hargaMeterGrosir && product.hargaMeterGrosir > 0) return product.hargaMeterGrosir;
      if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
      return product.price || 0;
    } else if (cat.includes('AGEN')) {
      if (product.hargaAgen && product.hargaAgen > 0) return product.hargaAgen;
      if (product.hargaMeterGrosir && product.hargaMeterGrosir > 0) return product.hargaMeterGrosir;
      return product.price || 0;
    } else {
      // UMUM / RETAIL
      if (product.hargaMeterUmum && product.hargaMeterUmum > 0) return product.hargaMeterUmum;
      if (product.hargaUmum && product.hargaUmum > 0) return product.hargaUmum;
      return product.price || 0;
    }
  } else {
    // Penjualan per Lembar:
    // (jumlah) lembar X Harga Jual
    // Harga Jual pelanggan GROSIR = HARGA METER GROSIR
    // Harga Jual pelanggan UMUM = HARGA METER UMUM
    if (cat.includes('GROSIR')) {
      if (product.hargaMeterGrosir && product.hargaMeterGrosir > 0) return product.hargaMeterGrosir;
      if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
      return product.price || 0;
    } else if (cat.includes('AGEN')) {
      if (product.hargaAgen && product.hargaAgen > 0) return product.hargaAgen;
      if (product.hargaMeterGrosir && product.hargaMeterGrosir > 0) return product.hargaMeterGrosir;
      return product.price || 0;
    } else {
      // UMUM / RETAIL
      if (product.hargaMeterUmum && product.hargaMeterUmum > 0) return product.hargaMeterUmum;
      if (product.hargaUmum && product.hargaUmum > 0) return product.hargaUmum;
      return product.price || 0;
    }
  }
}

export function getProductPriceForCategory(
  product: Product,
  customerCategoryName?: string,
  isMeter: boolean = false
): number {
  if (!product) return 0;
  const cat = (customerCategoryName || 'GROSIR').toUpperCase().trim();
  
  if (cat.includes('GROSIR')) {
    if (isMeter) {
      if (product.hargaMeterGrosir && product.hargaMeterGrosir > 0) return product.hargaMeterGrosir;
      if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
      return product.price || 0;
    }
    if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
    return product.price || 0;
  } else if (cat.includes('AGEN')) {
    if (product.hargaAgen && product.hargaAgen > 0) return product.hargaAgen;
    if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
    return product.price || 0;
  } else {
    // UMUM
    if (isMeter) {
      if (product.hargaMeterUmum && product.hargaMeterUmum > 0) return product.hargaMeterUmum;
      if (product.hargaUmum && product.hargaUmum > 0) return product.hargaUmum;
      return product.price || 0;
    }
    if (product.hargaUmum && product.hargaUmum > 0) return product.hargaUmum;
    return product.price || 0;
  }
}

export function getProductionSuppliesPrice(
  product: Product,
  customerCategoryName?: string,
  unitType: 'eceran' | 'pak' = 'eceran'
): number {
  if (!product) return 0;
  const cat = (customerCategoryName || 'GROSIR').toUpperCase().trim();

  if (cat.includes('GROSIR')) {
    if (unitType === 'pak') {
      if (product.hargaPakGrosir && product.hargaPakGrosir > 0) return product.hargaPakGrosir;
      if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
      return product.price || 0;
    } else {
      // Eceran
      if (product.hargaEceranGrosir && product.hargaEceranGrosir > 0) return product.hargaEceranGrosir;
      if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
      return product.price || 0;
    }
  } else if (cat.includes('AGEN')) {
    if (product.hargaAgen && product.hargaAgen > 0) return product.hargaAgen;
    if (unitType === 'pak' && product.hargaPakGrosir && product.hargaPakGrosir > 0) return product.hargaPakGrosir;
    if (product.hargaEceranGrosir && product.hargaEceranGrosir > 0) return product.hargaEceranGrosir;
    return product.price || 0;
  } else {
    // UMUM / RETAIL
    if (unitType === 'pak') {
      if (product.hargaPakUmum && product.hargaPakUmum > 0) return product.hargaPakUmum;
      if (product.hargaUmum && product.hargaUmum > 0) return product.hargaUmum;
      return product.price || 0;
    } else {
      // Eceran
      if (product.hargaEceranUmum && product.hargaEceranUmum > 0) return product.hargaEceranUmum;
      if (product.hargaUmum && product.hargaUmum > 0) return product.hargaUmum;
      return product.price || 0;
    }
  }
}

export function getPaketPrice(
  product: Product,
  customerCategoryName?: string
): number {
  if (!product) return 0;
  const cat = (customerCategoryName || 'GROSIR').toUpperCase().trim();

  if (cat.includes('GROSIR')) {
    if (product.hargaPaketGrosir && product.hargaPaketGrosir > 0) return product.hargaPaketGrosir;
    if (product.hargaGrosir && product.hargaGrosir > 0) return product.hargaGrosir;
    return product.price || 0;
  } else if (cat.includes('AGEN')) {
    if (product.hargaAgen && product.hargaAgen > 0) return product.hargaAgen;
    if (product.hargaPaketGrosir && product.hargaPaketGrosir > 0) return product.hargaPaketGrosir;
    return product.price || 0;
  } else {
    // UMUM / RETAIL
    if (product.hargaPaketUmum && product.hargaPaketUmum > 0) return product.hargaPaketUmum;
    if (product.hargaUmum && product.hargaUmum > 0) return product.hargaUmum;
    return product.price || 0;
  }
}

export function parseShiftDate(timeVal?: string | number, dateVal?: string): Date {
  if (!timeVal && !dateVal) return new Date();

  if (typeof timeVal === 'number') return new Date(timeVal);

  if (timeVal && !isNaN(Number(timeVal))) {
    return new Date(Number(timeVal));
  }

  const parseDateStr = (s?: string): Date | null => {
    if (!s) return null;
    const str = s.trim();

    // ISO string or YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str) || str.includes('T')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d;
    }

    // DD/MM/YY or DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(str)) {
      const parts = str.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // Standard JS Date parse (e.g. "21 September 2026")
    const std = new Date(str);
    if (!isNaN(std.getTime())) return std;

    return null;
  };

  // If timeVal is a full ISO / Date string, parse it directly
  if (typeof timeVal === 'string') {
    const directDate = parseDateStr(timeVal);
    if (directDate) return directDate;

    // If timeVal is a time-only string like "08:30" or "08:30:15"
    if (/^\d{1,2}:\d{2}/.test(timeVal.trim())) {
      const parts = timeVal.trim().split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const mins = parseInt(parts[1], 10) || 0;
      const secs = parts[2] ? parseInt(parts[2], 10) || 0 : 0;

      const targetDate = parseDateStr(dateVal) || new Date();
      targetDate.setHours(hours, mins, secs, 0);
      return targetDate;
    }
  }

  const parsedDirect = parseDateStr(dateVal);
  if (parsedDirect) return parsedDirect;

  return new Date();
}

export function formatShiftTime(timeVal?: string | number, dateVal?: string): string {
  if (!timeVal) return '-';
  const d = parseShiftDate(timeVal, dateVal);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins} WIB`;
}

export function formatShiftDate(timeVal?: string | number, dateVal?: string): string {
  if (!timeVal && !dateVal) return '-';
  const d = parseShiftDate(timeVal, dateVal);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function getShiftDurationString(
  startTimeVal?: string | number,
  dateVal?: string,
  endTimeVal?: string | number
): string {
  if (!startTimeVal) return '0 Detik';
  const start = parseShiftDate(startTimeVal, dateVal);
  const end = endTimeVal ? parseShiftDate(endTimeVal, dateVal) : new Date();

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} Jam ${minutes} Menit ${seconds} Detik`;
  }
  if (minutes > 0) {
    return `${minutes} Menit ${seconds} Detik`;
  }
  return `${seconds} Detik`;
}

export function isAgenTransaction(
  t: Transaction | any,
  categories?: any[],
  agents?: any[]
): boolean {
  if (!t) return false;

  // 1. Stock transaction types (Pengambilan Bahan / Pembelian Bahan) are not retail store sales
  if (t.type === 'PENGAMBILAN' || t.type === 'PEMBELIAN') return true;

  // 2. Check customerCategory string on transaction
  const catStr = (t.customerCategory || '').trim().toUpperCase();
  if (
    catStr === 'AGEN' ||
    catStr === 'CAT_AGEN' ||
    catStr === 'CETAK AGEN' ||
    catStr === 'CETAK_AGEN'
  ) {
    return true;
  }

  // 3. Check customer object
  if (t.customer) {
    const custCatId = (t.customer.categoryId || '').trim().toLowerCase();
    if (custCatId === 'cat_agen' || custCatId === 'agen') return true;

    if (t.customer.category) {
      const cCat = (t.customer.category || '').trim().toUpperCase();
      if (
        cCat === 'AGEN' ||
        cCat === 'CAT_AGEN' ||
        cCat === 'CETAK AGEN' ||
        cCat === 'CETAK_AGEN'
      ) {
        return true;
      }
    }

    if (categories && Array.isArray(categories)) {
      const catObj = categories.find((c: any) => c.id === t.customer?.categoryId);
      if (catObj && (catObj.name || '').trim().toUpperCase() === 'AGEN') return true;
    }

    if (agents && Array.isArray(agents) && t.customer.name) {
      const cName = t.customer.name.trim().toLowerCase();
      if (agents.some((a: any) => a.name && a.name.trim().toLowerCase() === cName)) return true;
    }
  }

  return false;
}

export function getNetCashAmount(t: Transaction | any): number {
  if (!t) return 0;
  const rawCash = t.paymentMethods?.cash || 0;
  if (rawCash <= 0) return 0;
  const transfer = t.paymentMethods?.transfer || 0;
  const qris = t.paymentMethods?.qris || 0;
  const grandTotal = t.total || 0;

  // If rawCash was saved as gross paid cash (totalPaid) instead of net cash
  const maxPossibleCash = Math.max(0, grandTotal - transfer - qris);
  if (grandTotal > 0 && rawCash > maxPossibleCash) {
    return maxPossibleCash;
  }
  if (t.change && t.change > 0 && rawCash >= t.change && rawCash === t.paidAmount) {
    return Math.max(0, rawCash - t.change);
  }
  return rawCash;
}

export function getTransactionsForShift(
  shift: Shift | null,
  transactions: Transaction[],
  _categories?: any[],
  _agents?: any[]
): Transaction[] {
  if (!shift || !Array.isArray(transactions)) return [];

  const shiftCashierNorm = (shift.cashierName || '').trim().toLowerCase();
  const shiftStartDate = shift.startTime ? parseShiftDate(shift.startTime, shift.date) : (shift.date ? parseShiftDate(shift.date) : null);

  const seenIds = new Set<string>();

  return transactions.filter((t) => {
    if (!t || !t.id) return false;

    // Skip backdated transactions from shift calculations
    if (t.isBackdated) return false;

    // Skip duplicate transaction instances
    if (seenIds.has(t.id)) return false;

    // Skip non-POS stock mutations if any
    if ((t as any).type === 'PENGAMBILAN' || (t as any).type === 'PEMBELIAN') {
      return false;
    }

    // 1. Direct match on shiftId if present
    if (t.shiftId) {
      if (t.shiftId === shift.id) {
        seenIds.add(t.id);
        return true;
      }
      return false; // Explicitly belongs to another shift
    }

    // 2. Fallback for legacy transactions without shiftId: Match cashier name + date / same calendar day
    const txCashierNorm = (t.cashierName || '').trim().toLowerCase();
    const cashierMatches = shiftCashierNorm && txCashierNorm && (
      shiftCashierNorm === txCashierNorm ||
      shiftCashierNorm.includes(txCashierNorm) ||
      txCashierNorm.includes(shiftCashierNorm)
    );

    if (cashierMatches) {
      if (t.date && shift.date && t.date === shift.date) {
        seenIds.add(t.id);
        return true;
      }

      const txDate = t.timestamp
        ? new Date(t.timestamp)
        : (t.date ? parseShiftDate(t.date) : null);

      if (txDate && shiftStartDate && !isNaN(txDate.getTime()) && !isNaN(shiftStartDate.getTime())) {
        if (
          txDate.getFullYear() === shiftStartDate.getFullYear() &&
          txDate.getMonth() === shiftStartDate.getMonth() &&
          txDate.getDate() === shiftStartDate.getDate()
        ) {
          seenIds.add(t.id);
          return true;
        }
      }
    }

    return false;
  });
}

export function convertDdMmYyToYyyyMmDd(ddMmYy: string): string {
  if (!ddMmYy) return '';
  const parts = ddMmYy.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  return '';
}

export function isTransactionOnDate(tx: { date?: string; timestamp?: number }, targetDateYyyyMmDd: string): boolean {
  if (!targetDateYyyyMmDd) return false;
  
  if (tx.date) {
    const trimmed = tx.date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed === targetDateYyyyMmDd;
    }
    const txYyyyMmDd = convertDdMmYyToYyyyMmDd(trimmed);
    if (txYyyyMmDd === targetDateYyyyMmDd) {
      return true;
    }
  }
  
  if (tx.timestamp) {
    const d = new Date(tx.timestamp);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;
      return localDateStr === targetDateYyyyMmDd;
    }
  }
  
  return false;
}

/**
 * Returns accurate epoch milliseconds representing the transaction's date and time.
 * Supports ISO 'YYYY-MM-DD', Indonesian 'DD/MM/YYYY', optional time 'HH:mm' or 'HH:mm:ss',
 * and falls back to tx.timestamp.
 */
export function getTransactionDateTimeEpoch(tx: { date?: string; time?: string; timestamp?: number }): number {
  if (!tx) return 0;

  if (tx.date) {
    const trimmed = tx.date.trim();
    let yyyyMmDd = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      yyyyMmDd = trimmed;
    } else if (trimmed.includes('/') || trimmed.includes('-')) {
      yyyyMmDd = convertDdMmYyToYyyyMmDd(trimmed.replace(/-/g, '/'));
    }

    if (yyyyMmDd) {
      let timePart = (tx.time || '00:00:00').trim();
      if (/^\d{1,2}:\d{1,2}$/.test(timePart)) {
        timePart = `${timePart}:00`;
      }
      const parsed = new Date(`${yyyyMmDd}T${timePart}`).getTime();
      if (!isNaN(parsed)) {
        return parsed;
      }
      const dateParsed = new Date(yyyyMmDd).getTime();
      if (!isNaN(dateParsed)) {
        return dateParsed;
      }
    }
  }

  if (tx.timestamp && !isNaN(tx.timestamp) && tx.timestamp > 0) {
    return tx.timestamp;
  }

  return 0;
}


