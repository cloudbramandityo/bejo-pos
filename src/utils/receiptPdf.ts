/**
 * Coded by Langgo Bramandityo. Struk Penjualan PDF Generator.
 */
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Transaction } from '../types';
import { formatRupiah, formatItemTransactionSpec } from './formatters';
import { getStoredStoreInfo } from './storage';
import { downloadPdfFile, normalizeTransactionForPdf } from './pdfDownload';

export async function generateReceiptQRDataUrl(phone: string): Promise<string> {
  try {
    let cleanPhone = (phone || '081234567890').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Halo Bejo Stiker, saya ingin konsultasi / order.')}`;
    return await QRCode.toDataURL(waUrl, {
      margin: 1,
      width: 256,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL', err);
    return '';
  }
}

export async function exportReceiptToPDF(
  transaction: Transaction,
  autoDownload: boolean = true,
  qrDataUrl?: string
): Promise<{ doc: jsPDF; filename: string }> {
  transaction = normalizeTransactionForPdf(transaction);
  const storeInfo = getStoredStoreInfo();
  
  // Calculate dynamic height for 80mm thermal receipt
  const baseHeight = 150;
  const itemsHeight = transaction.items.length * 10;
  const notesHeight = (transaction.cashierNotes ? 10 : 0) + (storeInfo.receiptFooter ? 15 : 0);
  const qrHeight = 45;
  const totalHeightMm = Math.max(180, baseHeight + itemsHeight + notesHeight + qrHeight);

  const doc = new jsPDF({
    unit: 'mm',
    format: [80, totalHeightMm],
    orientation: 'portrait',
  });

  const pageWidth = 80;
  let y = 8;

  // Helper for dashed line
  const drawDashedLine = (currY: number) => {
    doc.setDrawColor(160, 160, 160);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(6, currY, pageWidth - 6, currY);
    doc.setLineDashPattern([], 0);
  };

  // Optional Store Logo at Top
  if (storeInfo.logoUrl && storeInfo.logoUrl.startsWith('data:image/')) {
    try {
      const logoSize = 12;
      doc.addImage(storeInfo.logoUrl, 'PNG', (pageWidth - logoSize) / 2, y, logoSize, logoSize);
      y += logoSize + 2;
    } catch (e) {
      console.warn('Could not add logo to PDF receipt', e);
    }
  }

  // Header Store Info
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text((storeInfo.storeName || 'BEJO STIKER').toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  const branchText = storeInfo.branch ? `Cabang ${storeInfo.branch}` : 'Pusat Stiker & Digital Printing';
  doc.text(branchText, pageWidth / 2, y, { align: 'center' });
  y += 3.5;

  if (storeInfo.address) {
    const splitAddr = doc.splitTextToSize(storeInfo.address, 68);
    doc.text(splitAddr, pageWidth / 2, y, { align: 'center' });
    y += splitAddr.length * 3.5;
  }

  doc.text(`WA: ${storeInfo.phone || '-'}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  drawDashedLine(y);
  y += 4;

  // Metadata
  doc.setFontSize(7.5);
  doc.setFont('courier', 'normal');
  doc.setTextColor(0, 0, 0);

  doc.text('No. Invoice', 6, y);
  doc.setFont('courier', 'bold');
  doc.text(transaction.id, pageWidth - 6, y, { align: 'right' });
  y += 3.5;

  doc.setFont('courier', 'normal');
  doc.text('Tgl / Jam', 6, y);
  doc.text(`${transaction.date} ${transaction.time}`, pageWidth - 6, y, { align: 'right' });
  y += 3.5;

  doc.text('Kasir', 6, y);
  doc.text(transaction.cashierName.toUpperCase(), pageWidth - 6, y, { align: 'right' });
  y += 3.5;

  if (transaction.customer) {
    doc.text('Pelanggan', 6, y);
    doc.setFont('courier', 'bold');
    doc.text(transaction.customer.name, pageWidth - 6, y, { align: 'right' });
    y += 3.5;

    doc.setFont('courier', 'normal');
    doc.text('No. WA', 6, y);
    doc.text(transaction.customer.phone, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  drawDashedLine(y);
  y += 4;

  // Items List
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.text('ITEM / SPESIFIKASI', 6, y);
  doc.text('TOTAL', pageWidth - 6, y, { align: 'right' });
  y += 3.5;

  transaction.items.forEach((it) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    const cleanName = it.name.replace(/^\[SPK\]\s*/i, '');
    const splitName = doc.splitTextToSize(cleanName, 48);
    doc.text(splitName, 6, y);
    doc.text(formatRupiah(it.totalPrice), pageWidth - 6, y, { align: 'right' });
    y += splitName.length * 3.2;

    // Spec Detail: (panjang) x (lebar) x (jumlah) OR (jumlah Roll) OR (jumlah Lembar)
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    const isSpkCode = it.code?.startsWith('SPK-') || it.code?.startsWith('#SPK') || it.code === 'CETAK';
    const displayCode = isSpkCode ? '' : it.code;
    const specStr = displayCode ? `${displayCode} | ${formatItemTransactionSpec(it)}` : formatItemTransactionSpec(it);
    doc.text(specStr, 6, y);
    y += 3.2;

    const cleanNotes = it.notes ? it.notes.replace(/SPK\s*#?[\w-]+(\s*•\s*)?/gi, '').trim() : '';
    if (cleanNotes) {
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`* ${cleanNotes}`, 6, y);
      y += 3;
    }
    doc.setTextColor(0, 0, 0);
  });

  y += 1;
  drawDashedLine(y);
  y += 4;

  // Totals & Calculations
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);

  doc.text('Total QTY', 6, y);
  doc.text(transaction.totalQty.toString(), pageWidth - 6, y, { align: 'right' });
  y += 3.5;

  doc.text('Sub Total', 6, y);
  doc.text(formatRupiah(transaction.subtotal), pageWidth - 6, y, { align: 'right' });
  y += 3.5;

  if (transaction.tax > 0) {
    doc.text('Pajak (Tax)', 6, y);
    doc.text(formatRupiah(transaction.tax), pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  if (transaction.discount > 0) {
    doc.text('Diskon', 6, y);
    doc.text(`-${formatRupiah(transaction.discount)}`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  } else if (transaction.discount < 0) {
    doc.text('Diskon', 6, y);
    doc.text(`+${formatRupiah(Math.abs(transaction.discount))} (Pembulatan)`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL', 6, y);
  doc.text(formatRupiah(transaction.total), pageWidth - 6, y, { align: 'right' });
  y += 4.5;

  drawDashedLine(y);
  y += 4;

  // Payments Breakdown
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);

  if (transaction.paymentMethods.cash > 0) {
    doc.text('Tunai (Cash)', 6, y);
    doc.text(formatRupiah(transaction.paymentMethods.cash), pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  if (transaction.paymentMethods.transfer > 0) {
    doc.text('Transfer Bank', 6, y);
    doc.text(formatRupiah(transaction.paymentMethods.transfer), pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  if (transaction.paymentMethods.qris > 0) {
    doc.text('QRIS', 6, y);
    doc.text(formatRupiah(transaction.paymentMethods.qris), pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  doc.setFont('courier', 'bold');
  doc.text('Kembalian', 6, y);
  doc.text(formatRupiah(transaction.change), pageWidth - 6, y, { align: 'right' });
  y += 4;

  if (transaction.cashierNotes) {
    drawDashedLine(y);
    y += 3.5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text(`Catatan: ${transaction.cashierNotes}`, 6, y);
    y += 4;
  }

  drawDashedLine(y);
  y += 4;

  // Footer Note
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);

  if (storeInfo.receiptFooter) {
    const splitFooter = doc.splitTextToSize(storeInfo.receiptFooter, 68);
    doc.text(splitFooter, pageWidth / 2, y, { align: 'center' });
    y += splitFooter.length * 3.5;
  }

  // QR Code Generation & Embedding
  try {
    const resolvedQr = qrDataUrl !== undefined
      ? qrDataUrl
      : await generateReceiptQRDataUrl(storeInfo.phone);
    if (resolvedQr) {
      const qrSize = 26; // mm
      const qrX = (pageWidth - qrSize) / 2;
      doc.addImage(resolvedQr, 'PNG', qrX, y, qrSize, qrSize);
      y += qrSize + 2;

      doc.setFont('courier', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(40, 40, 40);
      doc.text('SCAN UNTUK CHAT / ORDER WHATSAPP', pageWidth / 2, y, { align: 'center' });
      y += 3.5;
    }
  } catch (qrErr) {
    console.warn('QR Code embed skipped:', qrErr);
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('-- TERIMA KASIH --', pageWidth / 2, y, { align: 'center' });

  const cleanInvoice = transaction.id.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `Struk_${cleanInvoice}.pdf`;

  if (autoDownload) {
    downloadPdfFile(doc, filename);
  }

  return { doc, filename };
}
