import type jsPDF from 'jspdf';
import { CartItem, Transaction } from '../types';

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function normalizeCartItemForPdf(item: any, index: number): CartItem {
  const source = item && typeof item === 'object' ? item : {};
  const qty = asNumber(source.qty, 1);
  const unitPrice = asNumber(source.unitPrice ?? source.price, 0);
  const totalPrice = asNumber(source.totalPrice, qty * unitPrice);

  return {
    ...source,
    id: asText(source.id, `item_${index}`) || `item_${index}`,
    code: asText(source.code),
    name: asText(source.name ?? source.productName, 'Produk') || 'Produk',
    dimensions: asText(source.dimensions),
    qty,
    unit: asText(source.unit, 'pcs') || 'pcs',
    unitPrice,
    price: asNumber(source.price, unitPrice),
    totalPrice,
    notes: source.notes ? asText(source.notes) : undefined,
  };
}

export function normalizeTransactionForPdf(transaction: any): Transaction {
  const source = transaction && typeof transaction === 'object' ? transaction : {};
  const items = Array.isArray(source.items)
    ? source.items.map((item: any, index: number) => normalizeCartItemForPdf(item, index))
    : [];
  const payment = source.paymentMethods && typeof source.paymentMethods === 'object'
    ? source.paymentMethods
    : {};

  let cash = asNumber(payment.cash);
  let transfer = asNumber(payment.transfer);
  let qris = asNumber(payment.qris);
  const total = asNumber(source.total);

  if (cash + transfer + qris <= 0) {
    const paid = asNumber(source.paidAmount);
    cash = paid > 0 ? paid : Math.max(total, 0);
  }

  const customer = source.customer && typeof source.customer === 'object'
    ? {
        ...source.customer,
        name: asText(source.customer.name, 'Umum') || 'Umum',
        phone: asText(source.customer.phone),
      }
    : undefined;

  return {
    ...source,
    id: asText(source.id, '-') || '-',
    cashierName: asText(source.cashierName ?? source.cashier, '-') || '-',
    storeName: asText(source.storeName),
    date: asText(source.date, '-') || '-',
    time: asText(source.time),
    timestamp: asNumber(source.timestamp),
    customer: customer as any,
    items,
    totalQty: asNumber(source.totalQty, items.reduce((sum, item) => sum + item.qty, 0)),
    subtotal: asNumber(source.subtotal, total),
    tax: asNumber(source.tax),
    discount: asNumber(source.discount),
    total,
    paymentMethods: { cash, transfer, qris },
    paidAmount: asNumber(source.paidAmount, cash + transfer + qris),
    change: asNumber(source.change),
    cashierNotes: asText(source.cashierNotes ?? source.notes),
  };
}

export function downloadPdfFile(doc: jsPDF, filename: string): void {
  const blob = doc.output('blob');
  const navigatorWithSave = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { msSaveOrOpenBlob?: (blob: Blob, name: string) => boolean })
    : undefined;

  if (navigatorWithSave?.msSaveOrOpenBlob) {
    navigatorWithSave.msSaveOrOpenBlob(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    if (typeof link.download === 'undefined') {
      // Browser tanpa dukungan atribut download: tampilkan PDF di tab baru agar tetap bisa disimpan.
      const opened = window.open(url, '_blank');
      if (opened) {
        try {
          opened.opener = null;
        } catch {
          // Cross-origin window may reject opener reset; download already handled.
        }
      } else {
        doc.save(filename);
      }
      return;
    }

    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    (document.body || document.documentElement).appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    try {
      doc.save(filename);
    } catch {
      throw error;
    }
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
