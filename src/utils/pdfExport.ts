import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, StockTransaction, Product } from '../types';
import { formatRupiah } from './formatters';
import { normalizeStockTransaction, calculateStockItemProfit, calculateSalesItemCost } from './stockUtils';
import { downloadPdfFile, normalizeTransactionForPdf } from './pdfDownload';


interface PDFExportOptions {
  periodType: 'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'SEMUA';
  periodLabel: string;
  storeName?: string;
  shiftFilter?: string;
  products?: Product[];
  reportTitle?: string;
}

export function exportTransactionsToPDF(
  transactions: Transaction[],
  options: PDFExportOptions
) {
  transactions = (Array.isArray(transactions) ? transactions : []).map(normalizeTransactionForPdf);

  if (transactions.length === 0) {
    alert('Tidak ada transaksi untuk diekspor ke PDF.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const storeTitle = (options.storeName || 'BEJO Digital Print').toUpperCase();
  const periodText = `${options.reportTitle || 'LAPORAN PENJUALAN'} ${options.periodType} - ${options.periodLabel}`;
  const shiftText = options.shiftFilter && options.shiftFilter !== 'ALL' ? `Filter Shift: ${options.shiftFilter}` : 'Semua Shift';

  // Header
  doc.setFillColor(30, 41, 93); // #1e295d
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(storeTitle, 14, 11);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${periodText} | ${shiftText}`, 14, 18);

  doc.setFontSize(8);
  doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`, 283, 18, { align: 'right' });

  // Summary statistics
  const totalOmzet = transactions.reduce((acc, t) => acc + t.total, 0);
  const totalCash = transactions.reduce((acc, t) => acc + t.paymentMethods.cash, 0);
  const totalTransfer = transactions.reduce((acc, t) => acc + t.paymentMethods.transfer, 0);
  const totalQris = transactions.reduce((acc, t) => acc + t.paymentMethods.qris, 0);
  const totalDiskon = transactions.reduce((acc, t) => acc + t.discount, 0);

  let totalHpp = 0;
  if (options.products && options.products.length > 0) {
    const productMap = new Map<string, Product>();
    const productByNameMap = new Map<string, Product>();
    const productByCodeMap = new Map<string, Product>();
    options.products.forEach((p) => {
      if (p.id) productMap.set(p.id, p);
      if (p.name) productByNameMap.set(p.name.trim().toLowerCase(), p);
      if (p.code) productByCodeMap.set(p.code.trim().toLowerCase(), p);
    });

    transactions.forEach((t) => {
      t.items?.forEach((it) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);

        const profitRes = calculateSalesItemCost(it, prod);
        totalHpp += profitRes.totalCost;
      });
    });
  }

  const totalLabaBersih = totalOmzet - totalHpp;
  const marginPercent = totalOmzet > 0 ? (totalLabaBersih / totalOmzet) * 100 : 0;

  // Summary box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, 27, 269, 21, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 27, 269, 21, 2, 2, 'S');

  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');

  // Stats Grid Row 1
  doc.text(`Total Transaksi: ${transactions.length} Struk`, 18, 33);
  doc.text(`Total Omzet: ${formatRupiah(totalOmzet)}`, 85, 33);
  doc.text(`Total Laba Bersih: ${formatRupiah(totalLabaBersih)} (${marginPercent.toFixed(1)}%)`, 175, 33);

  // Stats Grid Row 2
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Tunai (Cash): ${formatRupiah(totalCash)}`, 18, 39);
  doc.text(`Transfer Bank: ${formatRupiah(totalTransfer)}`, 85, 39);
  doc.text(`QRIS / E-Wallet: ${formatRupiah(totalQris)}`, 175, 39);

  // Stats Grid Row 3
  doc.text(`Diskon Diberikan: ${formatRupiah(totalDiskon)}`, 18, 44);
  doc.text(`Estimasi Modal (HPP): ${formatRupiah(totalHpp)}`, 85, 44);

  // Table Body preparation
  const tableData = transactions.map((tx, index) => {
    const customerName = tx.customer ? `${tx.customer.name} (${tx.customer.phone})` : 'Umum';
    const itemsSummary = tx.items
      .map((it) => `${it.name} (${it.qty} ${it.unit})`)
      .join(', ');

    let paymentMethodStr = '';
    if (tx.paymentMethods.cash > 0) paymentMethodStr += `Cash: ${formatRupiah(tx.paymentMethods.cash)}\n`;
    if (tx.paymentMethods.transfer > 0) paymentMethodStr += `Trf: ${formatRupiah(tx.paymentMethods.transfer)}\n`;
    if (tx.paymentMethods.qris > 0) paymentMethodStr += `QRIS: ${formatRupiah(tx.paymentMethods.qris)}`;

    return [
      (index + 1).toString(),
      tx.id,
      `${tx.date}\n${tx.time}`,
      tx.cashierName.toUpperCase(),
      customerName,
      itemsSummary,
      paymentMethodStr.trim(),
      formatRupiah(tx.total),
    ];
  });

  autoTable(doc, {
    startY: 52,
    head: [[
      'No',
      'No. Invoice',
      'Tgl & Jam',
      'Kasir',
      'Pelanggan',
      'Rincian Produk / Jasa',
      'Metode Bayar',
      'Total Bayar'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 93],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 22 },
      3: { cellWidth: 20 },
      4: { cellWidth: 35 },
      5: { cellWidth: 85 },
      6: { cellWidth: 35 },
      7: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  // Footer page numbers & signatures
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${i} dari ${pageCount} - Dicetak dari Sistem POS ${options.storeName || 'BEJO Digital Print'}`,
      14,
      202
    );
  }

  const cleanLabel = options.periodLabel.replace(/[/\\?%*:|"<>]/g, '-');
  const filename = `Laporan_Penjualan_${options.periodType}_${cleanLabel}.pdf`;
  downloadPdfFile(doc, filename);
}

export function exportStockTransactionsToPDF(
  stockTransactions: any[],
  type: 'PEMBELIAN' | 'PENGAMBILAN',
  options: PDFExportOptions,
  cetakAgenTransactions?: Transaction[]
) {
  const hasStockData = Array.isArray(stockTransactions) && stockTransactions.length > 0;
  const safeCetakTransactions = (Array.isArray(cetakAgenTransactions) ? cetakAgenTransactions : []).map(
    normalizeTransactionForPdf
  );
  const hasCetakData = safeCetakTransactions.length > 0;

  if (!hasStockData && !hasCetakData) {
    alert('Tidak ada data transaksi mutasi stok untuk diekspor ke PDF.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const isPembelian = type === 'PEMBELIAN';
  const titleLabel = isPembelian ? 'PEMBELIAN BAHAN' : 'PENGAMBILAN BAHAN & CETAK AGEN';
  const partyHeader = isPembelian ? 'Supplier / Distributor' : 'Penerima / Agen';
  const storeTitle = (options.storeName || 'BEJO Digital Print').toUpperCase();
  const periodText = `LAPORAN REKAP ${titleLabel} (PER TRANSAKSI) ${options.periodType} - ${options.periodLabel}`;

  const productMap = new Map<string, Product>();
  const productByNameMap = new Map<string, Product>();
  const productByCodeMap = new Map<string, Product>();

  if (options.products && options.products.length > 0) {
    options.products.forEach((p) => {
      if (p.id) productMap.set(p.id, p);
      if (p.name) productByNameMap.set(p.name.trim().toLowerCase(), p);
      if (p.code) productByCodeMap.set(p.code.trim().toLowerCase(), p);
    });
  }

  // Header Banner
  doc.setFillColor(30, 41, 93);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(storeTitle, 14, 11);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(periodText, 14, 18);

  doc.setFontSize(8);
  doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`, 283, 18, { align: 'right' });

  // Stats calculation
  const totalTransactions = (stockTransactions || []).length;
  const totalQty = (stockTransactions || []).reduce((acc, t) => acc + (t.totalQty || 0), 0);
  const totalAmount = (stockTransactions || []).reduce((acc, t) => acc + (t.totalAmount || 0), 0);

  let totalKulak = 0;
  let totalLaba = 0;

  if (!isPembelian && hasStockData) {
    stockTransactions.forEach((tx) => {
      const norm = normalizeStockTransaction(tx);
      norm.items.forEach((it) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
        const pData = calculateStockItemProfit(it, prod);
        totalKulak += pData.totalCost;
        totalLaba += pData.totalProfit;
      });
    });
  }

  // Summary Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 28, 269, 14, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 28, 269, 14, 2, 2, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  if (isPembelian) {
    doc.text(`Total Transaksi: ${totalTransactions} Trx`, 18, 37);
    doc.text(`Total Qty Bahan: ${totalQty} Unit`, 105, 37);
    doc.text(`Total Nilai Biaya: ${formatRupiah(totalAmount)}`, 195, 37);
  } else {
    doc.text(`Total Trx Mutasi: ${totalTransactions}`, 18, 37);
    doc.text(`Pengambilan: ${formatRupiah(totalAmount)}`, 65, 37);
    doc.text(`Laba Mutasi: ${formatRupiah(totalLaba)}`, 130, 37);
    if (hasCetakData) {
      const cetakTotal = safeCetakTransactions.reduce((acc, t) => acc + (t.total || 0), 0);
      doc.text(`Trx Cetak Agen: ${safeCetakTransactions.length} Trx (${formatRupiah(cetakTotal)})`, 190, 37);
    }
  }

  let lastY = 47;

  if (hasStockData) {
    const tableData = stockTransactions.map((tx, idx) => {
      const norm = normalizeStockTransaction(tx);
      const itemsFormatted = norm.items && norm.items.length > 0
        ? norm.items
            .map((it: any, iIdx: number) => {
              if (!isPembelian) {
                const prod =
                  (it.productId ? productMap.get(it.productId) : null) ||
                  (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
                  (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
                const pData = calculateStockItemProfit(it, prod);
                return `${iIdx + 1}. ${it.productName} (${it.qty} ${it.unit || 'pcs'} @ ${formatRupiah(it.price)} = ${formatRupiah(it.totalPrice)}) [Laba: ${formatRupiah(pData.totalProfit)}]`;
              }
              return `${iIdx + 1}. ${it.productName} (${it.qty} ${it.unit || 'pcs'} @ ${formatRupiah(it.price)} = ${formatRupiah(it.totalPrice)})`;
            })
            .join('\n')
        : `${tx.productName || 'Produk'} (${tx.qty || 1} unit @ ${formatRupiah(tx.price || 0)})`;

      return [
        (idx + 1).toString(),
        tx.id,
        `${tx.date}\n${tx.time || ''}`,
        tx.supplierName,
        itemsFormatted,
        `${tx.totalQty || 0} unit`,
        isPembelian && tx.shippingCost && tx.shippingCost > 0
          ? `${formatRupiah(tx.totalAmount || 0)}\n(Ongkir: ${formatRupiah(tx.shippingCost)})`
          : formatRupiah(tx.totalAmount || 0),
        tx.notes || '-'
      ];
    });

    autoTable(doc, {
      startY: lastY,
      head: [[
        'No.',
        'No. Transaksi',
        'Tgl & Waktu',
        partyHeader,
        !isPembelian ? 'Rincian Produk, Harga Agen/Meter & Laba Bersih' : 'Rincian Produk & Bahan (Item, Qty, Harga Satuan, Subtotal)',
        'Total Qty',
        'Total Transaksi',
        'Catatan'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: isPembelian ? [30, 41, 93] : [225, 29, 72],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 22 },
        3: { cellWidth: 35, fontStyle: 'bold' },
        4: { cellWidth: 105 },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 25 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });

    lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 100;
  }

  // Render Cetak Agen table section if present
  if (hasCetakData) {
    if (lastY > 160) {
      doc.addPage();
      lastY = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(126, 34, 206); // Purple
    doc.text('DAFTAR TRANSAKSI & INVOICE CETAK AGEN', 14, lastY);
    lastY += 4;

    const cetakTableData = safeCetakTransactions.map((tx, idx) => {
      const itemsFormatted = (tx.items || []).map((it, iIdx) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);
        const costRes = calculateSalesItemCost(it, prod);
        const itemProfit = (it.totalPrice || 0) - costRes.totalCost;

        let spec = '';
        if (it.width && it.height) spec = ` [${it.width}x${it.height}cm]`;
        else if (it.length) spec = ` [P:${it.length}m]`;

        return `${iIdx + 1}. ${it.name}${spec} (${it.qty} ${it.unit || 'pcs'} @ ${formatRupiah(it.unitPrice || it.price)} = ${formatRupiah(it.totalPrice)}) [Laba: ${formatRupiah(itemProfit)}]`;
      }).join('\n');

      const paymentMethodStr = tx.paymentMethods?.cash > 0 ? 'Cash' : tx.paymentMethods?.transfer > 0 ? 'Transfer' : tx.paymentMethods?.qris > 0 ? 'QRIS' : '-';

      return [
        (idx + 1).toString(),
        tx.id,
        `${tx.date}\n${tx.time || ''}`,
        tx.customer?.name || 'Agen',
        itemsFormatted,
        `${tx.totalQty || 1} unit`,
        formatRupiah(tx.total || 0),
        paymentMethodStr
      ];
    });

    autoTable(doc, {
      startY: lastY,
      head: [[
        'No.',
        'No. Invoice',
        'Tgl & Waktu',
        'Nama Agen',
        'Rincian Cetakan / Produk, Qty, Tarif Agen & Laba',
        'Total Qty',
        'Total Tarif',
        'Metode'
      ]],
      body: cetakTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [126, 34, 206], // Purple
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 22 },
        3: { cellWidth: 35, fontStyle: 'bold' },
        4: { cellWidth: 105 },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 25 },
      },
      alternateRowStyles: {
        fillColor: [250, 245, 255],
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });
  }

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${i} dari ${pageCount} - Dicetak dari Sistem POS ${options.storeName || 'BEJO Digital Print'}`,
      14,
      202
    );
  }

  const cleanLabel = options.periodLabel.replace(/[/\\?%*:|"<>]/g, '-');
  downloadPdfFile(doc, `Laporan_${titleLabel.replace(/ /g, '_')}_${options.periodType}_${cleanLabel}.pdf`);
}

export function exportSingleStockTransactionToPDF(
  stockTransaction: StockTransaction,
  type: 'PEMBELIAN' | 'PENGAMBILAN',
  options?: { storeName?: string; products?: Product[] }
) {
  const norm = normalizeStockTransaction(stockTransaction);
  const isPembelian = type === 'PEMBELIAN';
  const docTitle = isPembelian ? 'FAKTUR PEMBELIAN BAHAN' : 'NOTA PENGAMBILAN BAHAN';
  const partyLabel = isPembelian ? 'Supplier / Distributor' : 'Penerima / Agen';
  const priceHeader = isPembelian ? 'Harga Kulak (HPP)' : 'Harga Agen / Meter';
  const storeTitle = (options?.storeName || 'BEJO Digital Print').toUpperCase();

  const productMap = new Map<string, Product>();
  const productByNameMap = new Map<string, Product>();
  const productByCodeMap = new Map<string, Product>();

  if (options?.products && options.products.length > 0) {
    options.products.forEach((p) => {
      if (p.id) productMap.set(p.id, p);
      if (p.name) productByNameMap.set(p.name.trim().toLowerCase(), p);
      if (p.code) productByCodeMap.set(p.code.trim().toLowerCase(), p);
    });
  }

  let totalTxCost = 0;
  let totalTxProfit = 0;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(30, 41, 93);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(storeTitle, 14, 11);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(docTitle, 14, 18);

  doc.setFontSize(8);
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 196, 18, { align: 'right' });

  // Metadata Info Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 30, 182, 28, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 30, 182, 28, 2, 2, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);

  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('No. Transaksi:', 18, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(norm.id, 45, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Tanggal & Jam:', 18, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(`${norm.date} ${norm.time || ''}`, 45, 45);

  doc.setFont('helvetica', 'bold');
  doc.text(`${partyLabel}:`, 18, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(norm.supplierName, 45, 52);

  // Right column
  doc.setFont('helvetica', 'bold');
  doc.text('Total Macam Produk:', 110, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`${norm.items.length} Item`, 150, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Volume Qty:', 110, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(`${norm.totalQty} Unit / Pcs`, 150, 45);

  doc.setFont('helvetica', 'bold');
  doc.text('Catatan:', 110, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(norm.notes || '-', 150, 52);

  // Itemized table
  const tableData = norm.items.map((item, idx) => {
    const prod =
      (item.productId ? productMap.get(item.productId) : null) ||
      (item.code ? productByCodeMap.get(item.code.trim().toLowerCase()) : null) ||
      (item.productName ? productByNameMap.get(item.productName.trim().toLowerCase()) : null);

    const profitData = !isPembelian ? calculateStockItemProfit(item, prod) : null;
    if (profitData) {
      totalTxCost += profitData.totalCost;
      totalTxProfit += profitData.totalProfit;
    }

    if (!isPembelian && profitData) {
      return [
        (idx + 1).toString(),
        item.code || '-',
        item.productName,
        `${item.qty} ${item.unit || 'pcs'}`,
        formatRupiah(profitData.unitPrice),
        formatRupiah(profitData.totalAmount),
        formatRupiah(profitData.totalProfit)
      ];
    }

    return [
      (idx + 1).toString(),
      item.code || '-',
      item.productName,
      item.category || '-',
      `${item.qty} ${item.unit || 'pcs'}`,
      formatRupiah(item.price),
      formatRupiah(item.totalPrice),
      item.notes || '-'
    ];
  });

  const tableHeaders = !isPembelian
    ? [['No', 'SKU', 'Nama Produk / Bahan', 'Qty', 'Harga Jual', 'Subtotal', 'Laba Bersih']]
    : [['No', 'Kode / SKU', 'Nama Produk / Bahan', 'Kategori', 'Jumlah (Qty)', priceHeader, 'Subtotal', 'Catatan Item']];

  autoTable(doc, {
    startY: 62,
    head: tableHeaders,
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: isPembelian ? [16, 149, 106] : [225, 29, 72],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: !isPembelian
      ? {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 26, fontStyle: 'bold' },
          2: { cellWidth: 60 },
          3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
          6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        }
      : {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 24, fontStyle: 'bold' },
          2: { cellWidth: 48 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          5: { cellWidth: 24, halign: 'right' },
          6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
          7: { cellWidth: 10 },
        },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14, bottom: 40 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Grand Total block
  if (!isPembelian) {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(100, finalY, 96, 18, 1, 1, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(100, finalY, 96, 18, 1, 1, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PENGAMBILAN:', 104, finalY + 6);
    doc.setFontSize(9.5);
    doc.setTextColor(225, 29, 72);
    doc.text(formatRupiah(norm.totalAmount), 192, finalY + 6, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL LABA BERSIH:', 104, finalY + 14);
    doc.setFontSize(9.5);
    doc.setTextColor(16, 149, 106);
    doc.text(formatRupiah(totalTxProfit), 192, finalY + 14, { align: 'right' });
  } else {
    const hasShipping = norm.shippingCost && norm.shippingCost > 0;
    const boxHeight = hasShipping ? 24 : 12;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(100, finalY, 96, boxHeight, 1, 1, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(100, finalY, 96, boxHeight, 1, 1, 'S');

    if (hasShipping) {
      const subtotalItems = norm.totalAmount - norm.shippingCost;
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal Bahan:', 104, finalY + 6);
      doc.text(formatRupiah(subtotalItems), 192, finalY + 6, { align: 'right' });

      doc.text('Ongkos Kirim (Door to Door):', 104, finalY + 12);
      doc.setTextColor(79, 70, 229);
      doc.setFont('helvetica', 'bold');
      doc.text(formatRupiah(norm.shippingCost), 192, finalY + 12, { align: 'right' });

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL AKHIR (+ONGKIR):', 104, finalY + 19);
      doc.setFontSize(10);
      doc.setTextColor(5, 122, 85);
      doc.text(formatRupiah(norm.totalAmount), 192, finalY + 19, { align: 'right' });
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL AKHIR:', 104, finalY + 8);
      doc.setFontSize(10.5);
      doc.setTextColor(5, 122, 85);
      doc.text(formatRupiah(norm.totalAmount), 192, finalY + 8, { align: 'right' });
    }
  }

  // Signature lines
  const sigY = finalY + (isPembelian ? 24 : 30);
  if (sigY < 265) {
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');

    if (isPembelian) {
      doc.text('Diserahkan oleh (Supplier):', 25, sigY);
      doc.line(20, sigY + 22, 70, sigY + 22);
      doc.text(`( ${norm.supplierName} )`, 25, sigY + 27);

      doc.text('Diterima oleh (Admin Toko):', 140, sigY);
      doc.line(135, sigY + 22, 185, sigY + 22);
      doc.text('( Bagian Gudang / Kasir )', 140, sigY + 27);
    } else {
      doc.text('Diserahkan oleh (Admin Toko):', 25, sigY);
      doc.line(20, sigY + 22, 70, sigY + 22);
      doc.text('( Bagian Gudang / Kasir )', 25, sigY + 27);

      doc.text('Diterima oleh (Agen / Mitra):', 140, sigY);
      doc.line(135, sigY + 22, 185, sigY + 22);
      doc.text(`( ${norm.supplierName} )`, 140, sigY + 27);
    }
  }

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${i} dari ${pageCount} - Dokumen Resmi ${options?.storeName || 'BEJO Digital Print'}`,
      14,
      287
    );
  }

  const filePrefix = isPembelian ? 'Faktur_Pembelian' : 'Nota_Pengambilan';
  const cleanId = norm.id.replace(/[/\\?%*:|"<>]/g, '-');
  downloadPdfFile(doc, `${filePrefix}_${cleanId}.pdf`);
}


