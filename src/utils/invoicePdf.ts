import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, InvoiceStoreIdentity } from '../types';
import { formatRupiah } from './formatters';
import { downloadPdfFile } from './pdfDownload';
import { DEFAULT_INVOICE_STORE_IDENTITY, getTerminStageDisplayInfo } from './invoiceStorage';

export type InvoicePdfPaperSize = 'a4' | 'f4';
export type InvoicePdfOrientation = 'portrait' | 'landscape';
export type InvoicePdfDocType = 'invoice' | 'credit_note';

export interface InvoicePdfOptions {
  paperSize?: InvoicePdfPaperSize;
  orientation?: InvoicePdfOrientation;
  docType?: InvoicePdfDocType;
  storeIdentity?: InvoiceStoreIdentity;
  allInvoices?: Invoice[];
}

type Rgb = [number, number, number];

const INK: Rgb = [15, 23, 42];
const MUTED: Rgb = [100, 116, 139];
const LINE: Rgb = [226, 232, 240];
const BRAND: Rgb = [30, 41, 93];
const ROSE: Rgb = [190, 18, 60];
const EMERALD: Rgb = [4, 120, 87];
const AMBER: Rgb = [180, 83, 9];

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatQty(value: unknown): string {
  return asNumber(value).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function formatPercent(value: unknown): string {
  const percent = asNumber(value);
  return Number.isInteger(percent)
    ? String(percent)
    : percent.toLocaleString('id-ID', { maximumFractionDigits: 4 });
}

function resolveDocumentMeta(invoice: Invoice, docType: InvoicePdfDocType) {
  const isCreditNote = docType === 'credit_note';
  const isCancelled = invoice.status === 'CANCELLED';
  const isProforma = invoice.documentType === 'PROFORMA';

  const title = isCreditNote
    ? 'NOTA KREDIT (CREDIT NOTE)'
    : isCancelled
    ? (isProforma ? 'PROFORMA INVOICE (VOID)' : 'INVOICE (DIBATALKAN)')
    : isProforma
    ? 'PROFORMA INVOICE'
    : 'INVOICE / FAKTUR';

  const number = isCreditNote
    ? asText(invoice.cancellation?.creditNoteNumber, invoice.documentNumber)
    : asText(invoice.documentNumber, '-');

  const issueDate = isCreditNote
    ? asText(invoice.cancellation?.creditNoteDate, invoice.issueDate)
    : asText(invoice.issueDate, '-');

  const titleColor: Rgb = isCreditNote || isCancelled ? ROSE : isProforma ? AMBER : INK;
  const watermark = isCreditNote
    ? 'CREDIT NOTE'
    : isCancelled
    ? 'DIBATALKAN'
    : isProforma
    ? 'PROFORMA'
    : '';

  const statusLabel = isCreditNote
    ? 'Nota Kredit'
    : isCancelled
    ? 'Dibatalkan (Void / Credit Note)'
    : invoice.status === 'PAID'
    ? 'Lunas (Paid)'
    : invoice.status === 'PARTIAL'
    ? 'DP Terbayar (Partial)'
    : 'Belum Lunas';

  return { isCreditNote, isCancelled, isProforma, title, number, issueDate, titleColor, watermark, statusLabel };
}

function sanitizeFileName(value: string): string {
  return asText(value, 'invoice')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

function paymentTypeLabel(type: unknown): string {
  if (type === 'DOWN_PAYMENT') return 'DP';
  if (type === 'SETTLEMENT') return 'Pelunasan';
  if (type === 'INSTALLMENT') return 'Cicilan';
  return asText(type, 'Pembayaran');
}

export function buildInvoicePdf(
  invoice: Invoice,
  options: InvoicePdfOptions = {}
): { doc: jsPDF; filename: string } {
  const paperSize = options.paperSize === 'f4' ? 'f4' : 'a4';
  const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  const docType = options.docType === 'credit_note' ? 'credit_note' : 'invoice';
  const storeIdentity = options.storeIdentity || DEFAULT_INVOICE_STORE_IDENTITY;
  const allInvoices = options.allInvoices;

  const baseWidth = paperSize === 'f4' ? 215 : 210;
  const baseHeight = paperSize === 'f4' ? 330 : 297;
  const jsPdfModule = jsPDF as unknown as {
    default?: typeof jsPDF;
    jsPDF?: typeof jsPDF;
  } & Partial<typeof jsPDF>;
  const JsPdfConstructor = (
    typeof jsPdfModule === 'function'
      ? jsPdfModule
      : typeof jsPdfModule.jsPDF === 'function'
      ? jsPdfModule.jsPDF
      : typeof jsPdfModule.default === 'function'
      ? jsPdfModule.default
      : (jsPdfModule.default as unknown as { jsPDF?: typeof jsPDF } | undefined)?.jsPDF
  ) as typeof jsPDF;
  if (typeof JsPdfConstructor !== 'function') {
    throw new Error('Modul jsPDF tidak dapat dimuat.');
  }
  const doc = new JsPdfConstructor({
    orientation,
    unit: 'mm',
    format: orientation === 'landscape' ? [baseHeight, baseWidth] : [baseWidth, baseHeight],
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = pageWidth > 250 ? 14 : 11;
  const contentWidth = pageWidth - margin * 2;
  const contentRight = pageWidth - margin;
  const tableMarginTop = 20;
  const footerTop = pageHeight - 11;
  let y = margin - 1;

  const meta = resolveDocumentMeta(invoice, docType);
  const storeName = asText(storeIdentity.storeName, 'BEJO Digital Print');
  const customer = invoice.customer || ({} as Invoice['customer']);
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const schedules = Array.isArray(invoice.paymentSchedules) ? invoice.paymentSchedules : [];
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
  // Identitas toko selalu menjadi sumber terbaru; snapshot pada invoice hanya dipakai
  // bila identitas toko belum memiliki rekening sama sekali.
  const identityBankAccounts = Array.isArray(storeIdentity.bankAccounts) ? storeIdentity.bankAccounts : [];
  const bankAccounts = identityBankAccounts.length > 0
    ? identityBankAccounts
    : (Array.isArray(invoice.bankAccounts) ? invoice.bankAccounts : []);

  const ensureSpace = (needed: number) => {
    if (y + needed <= footerTop) return;
    doc.addPage();
    y = tableMarginTop;
  };

  const sectionTitle = (label: string) => {
    ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(label.toUpperCase(), margin, y);
    y += 2.5;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(margin, y, contentRight, y);
    y += 4.5;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(storeName, margin, y + 3.5);

  let leftY = y + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  if (storeIdentity.tagline) {
    doc.text(asText(storeIdentity.tagline), margin, leftY);
    leftY += 3.6;
  }

  const leftWidth = contentWidth * 0.56;
  if (storeIdentity.address) {
    const addressLines = doc.splitTextToSize(storeIdentity.address, leftWidth);
    doc.text(addressLines, margin, leftY);
    leftY += addressLines.length * 3.4;
  }
  const contactLine = [storeIdentity.phone ? `Telp/WA: ${storeIdentity.phone}` : '', storeIdentity.email || '']
    .filter(Boolean)
    .join('  |  ');
  if (contactLine) {
    doc.text(contactLine, margin, leftY);
    leftY += 3.4;
  }
  if (storeIdentity.npwp) {
    doc.text(`NPWP Toko: ${storeIdentity.npwp}`, margin, leftY);
    leftY += 3.4;
  }

  let rightY = y + 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...meta.titleColor);
  doc.text(meta.title, contentRight, rightY, { align: 'right' });
  rightY += 6;

  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(`No: ${meta.number}`, contentRight, rightY, { align: 'right' });
  rightY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Tanggal Terbit: ${meta.issueDate}`, contentRight, rightY, { align: 'right' });
  rightY += 3.6;

  if (meta.isCreditNote) {
    doc.setTextColor(...ROSE);
    doc.setFont('helvetica', 'bold');
    doc.text(`Mengacu Faktur: ${invoice.documentNumber}`, contentRight, rightY, { align: 'right' });
    rightY += 3.6;
  } else if (meta.isProforma && invoice.expiryDate) {
    doc.setTextColor(...AMBER);
    doc.setFont('helvetica', 'bold');
    doc.text(`Berlaku Hingga: ${invoice.expiryDate}`, contentRight, rightY, { align: 'right' });
    rightY += 3.6;
  } else if (!meta.isProforma && invoice.dueDate) {
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.text(`Jatuh Tempo: ${invoice.dueDate}`, contentRight, rightY, { align: 'right' });
    rightY += 3.6;
  }

  y = Math.max(leftY, rightY) + 2;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.7);
  doc.line(margin, y, contentRight, y);
  y += 5;

  if (invoice.sourceProformaNumber || invoice.referenceDescription || asNumber(invoice.contractTotalAmount) > 0) {
    const refLabel = meta.isProforma ? 'Berdasarkan Purchase Order' : 'Berdasarkan Proforma Invoice';
    const referenceText = asText(invoice.sourceProformaNumber, '-');
    const descriptionText = asText(
      invoice.referenceDescription,
      invoice.terminStageName
        ? `Pembayaran ${invoice.terminStageName} (${formatPercent(invoice.terminPercentage || 0)}%) dari Total Kontrak`
        : '-'
    );
    const referenceLine = `${refLabel}: ${referenceText}  |  Keterangan: ${descriptionText}`;
    const referenceLines = doc.splitTextToSize(referenceLine, contentWidth - 8);
    const contractLine = asNumber(invoice.contractTotalAmount) > 0;
    const boxHeight = 5 + referenceLines.length * 3.4 + (contractLine ? 4 : 0);
    ensureSpace(boxHeight + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...INK);
    doc.text(referenceLines, margin + 4, y + 4);
    if (contractLine) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BRAND);
      const contractY = y + 4 + referenceLines.length * 3.4;
      doc.text('Total Nilai Kontrak (100%) :', margin + 4, contractY);
      doc.text(formatRupiah(asNumber(invoice.contractTotalAmount)), contentRight - 4, contractY, { align: 'right' });
    }
    y += boxHeight + 3;
  }

  const infoGap = 4;
  const customerBoxWidth = contentWidth * 0.6;
  const projectBoxWidth = contentWidth - customerBoxWidth - infoGap;
  const customerInnerWidth = customerBoxWidth - 8;
  const projectInnerWidth = projectBoxWidth - 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const addressLines = doc.splitTextToSize(asText(customer.address, '-'), customerInnerWidth);
  const customerContentHeight =
    10 + 4.6 + (customer.pic ? 3.8 : 0) + addressLines.length * 3.4 + 3.8 + (customer.npwp ? 3.4 : 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const projectLines = doc.splitTextToSize(asText(invoice.projectTitle, '-'), projectInnerWidth);
  const projectContentHeight = 10 + projectLines.length * 3.9 + 8;

  const infoBoxHeight = Math.max(32, customerContentHeight, projectContentHeight);
  ensureSpace(infoBoxHeight + 6);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, customerBoxWidth, infoBoxHeight, 2, 2, 'FD');
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin + customerBoxWidth + infoGap, y, projectBoxWidth, infoBoxHeight, 2, 2, 'FD');

  let customerY = y + 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('DITAGIHKAN KEPADA', margin + 4, customerY);
  customerY += 4.8;

  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(asText(customer.name, '-'), margin + 4, customerY);
  customerY += 4.4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  if (customer.pic) {
    doc.text(`UP/PIC: ${customer.pic}`, margin + 4, customerY);
    customerY += 3.6;
  }
  doc.text(addressLines, margin + 4, customerY);
  customerY += addressLines.length * 3.4;
  const customerContact = [customer.phone ? `Telp/WA: ${customer.phone}` : '', customer.email || '']
    .filter(Boolean)
    .join('  |  ');
  if (customerContact) {
    doc.text(customerContact, margin + 4, customerY);
    customerY += 3.6;
  }
  if (customer.npwp) {
    doc.setFont('helvetica', 'bold');
    doc.text(`NPWP: ${customer.npwp}`, margin + 4, customerY);
  }

  const projectX = margin + customerBoxWidth + infoGap;
  let projectY = y + 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('PEKERJAAN / PROYEK', projectX + 4, projectY);
  projectY += 4.8;

  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(projectLines, projectX + 4, projectY);
  projectY += projectLines.length * 3.8 + 2;

  doc.setDrawColor(...LINE);
  doc.line(projectX + 4, projectY, projectX + projectBoxWidth - 4, projectY);
  projectY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('Status Dokumen:', projectX + 4, projectY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(meta.statusLabel, projectX + projectBoxWidth - 4, projectY, { align: 'right' });

  y += infoBoxHeight + 5;

  if (invoice.cancellation) {
    const cancellation = invoice.cancellation;
    const reasonLabel =
      cancellation.reasonCategory === 'FORCE_MAJEURE'
        ? 'Force Majeure (Bencana Alam / Regulasi)'
        : cancellation.reasonCategory === 'BREACH_OF_CONTRACT'
        ? 'Pembatalan Sepihak (Breach of Contract)'
        : cancellation.reasonCategory === 'MUTUAL_AGREEMENT'
        ? 'Kesepakatan Bersama'
        : 'Lainnya';
    const detailLines = doc.splitTextToSize(asText(cancellation.reasonDetails, '-'), contentWidth - 12);
    const refundLine = cancellation.refundRequired
      ? `Dana Diterima: ${formatRupiah(asNumber(cancellation.originalPaidAmount))}  |  Denda: ${formatRupiah(
          asNumber(cancellation.cancellationFee)
        )}  |  Refund: ${formatRupiah(asNumber(cancellation.refundAmount))}  |  Metode: ${asText(
          cancellation.refundMethod,
          '-'
        )} (${asText(cancellation.refundBankTarget, '-')})`
      : '';
    const refundLines = refundLine ? doc.splitTextToSize(refundLine, contentWidth - 12) : [];
    const boxHeight =
      8 +
      4.4 +
      detailLines.length * 3.4 +
      (cancellation.creditNoteNumber ? 3.8 : 0) +
      (cancellation.taxReturnNumber ? 3.8 : 0) +
      (refundLines.length > 0 ? refundLines.length * 3.4 + 2 : 0) +
      3;
    ensureSpace(boxHeight + 5);
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');
    let cancelY = y + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...ROSE);
    doc.text(meta.isCreditNote ? 'RINCIAN NOTA KREDIT (PEMBALIK PIUTANG)' : 'DOKUMEN DIBATALKAN', margin + 4, cancelY);
    doc.setFontSize(7);
    doc.text(`Oleh: ${asText(cancellation.cancelledBy, '-')}`, contentRight - 4, cancelY, { align: 'right' });
    cancelY += 4.8;
    doc.setTextColor(...INK);
    doc.text(`Alasan: ${reasonLabel}`, margin + 4, cancelY);
    cancelY += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(detailLines, margin + 4, cancelY);
    cancelY += detailLines.length * 3.4;
    if (cancellation.creditNoteNumber) {
      doc.setFont('helvetica', 'bold');
      doc.text(`No. Nota Kredit: ${cancellation.creditNoteNumber}`, margin + 4, cancelY);
      cancelY += 3.8;
    }
    if (cancellation.taxReturnNumber) {
      doc.setFont('helvetica', 'bold');
      doc.text(`No. Nota Retur / Pembatalan Pajak: ${cancellation.taxReturnNumber}`, margin + 4, cancelY);
      cancelY += 3.8;
    }
    if (refundLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.text(refundLines, margin + 4, cancelY);
    }
    y += boxHeight + 5;
  }

  sectionTitle('Rincian Barang / Jasa');

  const itemRows = items.map((item, index) => [
    String(index + 1),
    `${asText(item.itemName, 'Item')}${item.description ? `\n${item.description}` : ''}`,
    formatQty(item.quantity),
    asText(item.unit, '-'),
    formatRupiah(asNumber(item.unitPrice)),
    item.discountPercent ? `${formatPercent(item.discountPercent)}%` : '-',
    formatRupiah(asNumber(item.totalPrice)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['No', 'Rincian Barang / Jasa', 'Qty', 'Satuan', 'Harga', 'Disc', 'Jumlah (Rp)']],
    body: itemRows.length > 0 ? itemRows : [['-', 'Tidak ada rincian item', '-', '-', '-', '-', '-']],
    theme: 'grid',
    margin: { left: margin, right: margin, top: tableMarginTop, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.15,
      cellPadding: 2,
      valign: 'top',
    },
    headStyles: {
      fontStyle: 'bold',
      fillColor: BRAND,
      textColor: [255, 255, 255],
      halign: 'center',
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 30, halign: 'right' },
    },
    rowPageBreak: 'avoid',
  });

  y = asNumber((doc as any).lastAutoTable?.finalY, y) + 6;

  const summaryRows: Array<{ label: string; value: string; color?: Rgb; bold?: boolean; separator?: boolean }> = [
    { label: 'Subtotal', value: formatRupiah(asNumber(invoice.subtotal)) },
  ];
  if (asNumber(invoice.discountAmount) > 0) {
    summaryRows.push({ label: 'Diskon', value: `- ${formatRupiah(asNumber(invoice.discountAmount))}`, color: EMERALD });
  }
  summaryRows.push({ label: 'Dasar Pengenaan Pajak (DPP)', value: formatRupiah(asNumber(invoice.taxableBase)) });
  summaryRows.push({
    label: asNumber(invoice.taxRate) > 0 ? `PPN (${formatPercent(invoice.taxRate)}%)` : 'PPN (Non-PKP)',
    value: asNumber(invoice.taxRate) > 0 ? formatRupiah(asNumber(invoice.taxAmount)) : 'Rp 0',
  });
  summaryRows.push({
    label: 'TOTAL TAGIHAN',
    value: formatRupiah(asNumber(invoice.grandTotal)),
    bold: true,
    separator: true,
  });
  summaryRows.push({ label: 'Sudah Dibayar', value: formatRupiah(asNumber(invoice.amountPaid)), color: EMERALD });
  summaryRows.push({
    label: 'SISA PELUNASAN',
    value: formatRupiah(asNumber(invoice.balanceDue)),
    color: ROSE,
    bold: true,
    separator: true,
  });

  const summaryWidth = Math.min(100, contentWidth * 0.55);
  const summaryHeight = 6 + summaryRows.length * 4.6 + 1;
  ensureSpace(summaryHeight + 5);
  const summaryX = contentRight - summaryWidth;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(summaryX, y, summaryWidth, summaryHeight, 2, 2, 'FD');
  let summaryY = y + 5;
  for (const row of summaryRows) {
    if (row.separator) {
      doc.setDrawColor(...LINE);
      doc.line(summaryX + 3, summaryY - 2.8, summaryX + summaryWidth - 3, summaryY - 2.8);
    }
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
    doc.setFontSize(row.bold ? 8.5 : 8);
    doc.setTextColor(...(row.color || INK));
    doc.text(row.label, summaryX + 4, summaryY);
    doc.text(row.value, summaryX + summaryWidth - 4, summaryY, { align: 'right' });
    summaryY += 4.6;
  }
  y += summaryHeight + 5;

  if (schedules.length > 0) {
    sectionTitle('Rincian Jadwal Pembayaran');
    const scheduleRows = schedules.map((schedule, index) => {
      const stageInfo = getTerminStageDisplayInfo(invoice, schedule, index, allInvoices);
      const stageName = `${asText(schedule.name, `Tahap ${index + 1}`)} (${formatPercent(schedule.percentage)}%)`;
      return [
        `${stageName}${schedule.notes ? `\n${schedule.notes}` : ''}`,
        formatRupiah(asNumber(schedule.amount)),
        asText(schedule.dueDate, '-'),
        stageInfo.status,
      ];
    });
    const contractTotal = asNumber(invoice.contractTotalAmount) > 0
      ? asNumber(invoice.contractTotalAmount)
      : asNumber(invoice.grandTotal);

    autoTable(doc, {
      startY: y,
      head: [['Tahap Pembayaran', 'Nominal (Rp)', 'Jatuh Tempo', 'Status']],
      body: scheduleRows,
      foot: [['Total Nilai Kontrak (100%)', formatRupiah(contractTotal), `${schedules.length} Tahap`, '']],
      theme: 'grid',
      margin: { left: margin, right: margin, top: tableMarginTop, bottom: 18 },
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.15,
        cellPadding: 2,
        valign: 'top',
      },
      headStyles: {
        fontStyle: 'bold',
        fillColor: [241, 245, 249],
        textColor: INK,
        halign: 'center',
      },
      footStyles: {
        fontStyle: 'bold',
        fillColor: [248, 250, 252],
        textColor: INK,
        halign: 'right',
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 32, halign: 'right' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
      },
      rowPageBreak: 'avoid',
    });
    y = asNumber((doc as any).lastAutoTable?.finalY, y) + 6;
  }

  if (payments.length > 0) {
    sectionTitle('Riwayat Rekonsiliasi Pembayaran');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...INK);
    for (const payment of payments) {
      const reference = payment.referenceNumber ? ` [${payment.referenceNumber}]` : '';
      const line = `${asText(payment.paymentDate, '-')} - ${paymentTypeLabel(payment.paymentType)} - ${asText(
        payment.paymentMethod,
        '-'
      )}${reference} - ${asText(payment.receivedBy, '-')} - ${formatRupiah(asNumber(payment.amount))}`;
      const paymentLines = doc.splitTextToSize(line, contentWidth);
      ensureSpace(paymentLines.length * 3.6 + 1);
      doc.text(paymentLines, margin, y);
      y += paymentLines.length * 3.6;
    }
    y += 4;
  }

  const terms = storeIdentity.defaultTerms === undefined
    ? asText(invoice.paymentTerms)
    : asText(storeIdentity.defaultTerms);
  const tailGap = 5;
  const tailLeftWidth = contentWidth * 0.48;
  const tailRightX = margin + tailLeftWidth + tailGap;
  const tailRightWidth = contentWidth - tailLeftWidth - tailGap;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const termLines = terms ? doc.splitTextToSize(terms, tailRightWidth) : [];
  const bankBlockHeight = bankAccounts.length > 0 ? 9 + bankAccounts.length * 4.4 + 2 : 0;
  const termsBlockHeight = terms ? 9 + termLines.length * 3.2 + 2 : 0;
  const tailHeight = Math.max(bankBlockHeight, termsBlockHeight);
  ensureSpace(tailHeight + 4);

  if (bankAccounts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text('REKENING PEMBAYARAN RESMI', margin, y);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 2.5, margin + tailLeftWidth, y + 2.5);
    let bankY = y + 7.5;
    for (const account of bankAccounts) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(...INK);
      doc.text(`${asText(account.bankName, '-')}: ${asText(account.accountNumber, '-')}`, margin, bankY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(`a/n ${asText(account.accountHolder, '-')}`, margin + tailLeftWidth, bankY, { align: 'right' });
      bankY += 4.4;
    }
  }

  if (terms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text('SYARAT & KETENTUAN', tailRightX, y);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(tailRightX, y + 2.5, contentRight, y + 2.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...MUTED);
    let termY = y + 7.5;
    for (const line of termLines) {
      doc.text(line, tailRightX, termY);
      termY += 3.2;
    }
  }

  y += tailHeight + 4;

  const signatureHeight = 26;
  ensureSpace(signatureHeight + 2);
  const signatureY = y + 2;
  const halfWidth = contentWidth / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Penerima / Pelanggan,', margin + halfWidth / 2, signatureY, { align: 'center' });
  doc.text(`Hormat Kami, ${storeName}`, margin + halfWidth + halfWidth / 2, signatureY, { align: 'center' });
  const signatureLineY = signatureY + 13;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.line(margin + halfWidth / 2 - 32, signatureLineY, margin + halfWidth / 2 + 32, signatureLineY);
  doc.line(
    margin + halfWidth + halfWidth / 2 - 32,
    signatureLineY,
    margin + halfWidth + halfWidth / 2 + 32,
    signatureLineY
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(`( ${asText(customer.pic, asText(customer.name, '-'))} )`, margin + halfWidth / 2, signatureLineY + 4.5, {
    align: 'center',
  });
  doc.text(
    `( ${asText(storeIdentity.authorizedSignerName, asText(invoice.issuedBy, '-'))} )`,
    margin + halfWidth + halfWidth / 2,
    signatureLineY + 4.5,
    { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(
    asText(storeIdentity.authorizedSignerRole, 'Pimpinan Toko'),
    margin + halfWidth + halfWidth / 2,
    signatureLineY + 8,
    { align: 'center' }
  );
  y = signatureLineY + 12;

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    if (page > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(storeName, margin, 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`${meta.title} - ${meta.number}`, contentRight, 10, { align: 'right' });
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(margin, 13, contentRight, 13);
    }

    if (meta.watermark) {
      let graphicsStateSaved = false;
      try {
        doc.saveGraphicsState();
        graphicsStateSaved = true;
        doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(pageWidth > 250 ? 60 : 48);
        doc.setTextColor(...INK);
        doc.text(meta.watermark, pageWidth / 2, pageHeight / 2, { align: 'center' });
      } catch {
        // Watermark is decorative; never block PDF generation.
      } finally {
        if (graphicsStateSaved) {
          try {
            doc.restoreGraphicsState();
          } catch {
            // Ignore graphics state restore failures.
          }
        }
      }
    }

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 11, contentRight, pageHeight - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Dokumen: ${meta.number}`, margin, pageHeight - 7);
    doc.text(`Halaman ${page} dari ${totalPages}`, contentRight, pageHeight - 7, { align: 'right' });
  }

  const typeLabel = meta.isCreditNote ? 'Nota-Kredit' : meta.isProforma ? 'Proforma' : 'Invoice';
  const filename = `${typeLabel}_${sanitizeFileName(meta.number)}.pdf`;

  return { doc, filename };
}

export function exportInvoiceToPDF(
  invoice: Invoice,
  options: InvoicePdfOptions = {}
): { filename: string; pageCount: number } {
  const { doc, filename } = buildInvoicePdf(invoice, options);
  downloadPdfFile(doc, filename);
  return { filename, pageCount: doc.getNumberOfPages() };
}
