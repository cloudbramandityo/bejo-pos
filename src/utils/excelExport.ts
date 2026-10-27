/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import * as XLSX from 'xlsx';
import { Transaction, StockTransaction, Product } from '../types';
import { normalizeStockTransaction, calculateStockItemProfit, calculateSalesItemCost } from './stockUtils';

export function exportTransactionsToExcel(
  transactions: Transaction[],
  filenamePrefix = 'Laporan_Penjualan_BejoStiker',
  products?: Product[]
) {
  if (!transactions || transactions.length === 0) {
    alert('Tidak ada data transaksi untuk diekspor.');
    return;
  }

  const productMap = new Map<string, Product>();
  const productByNameMap = new Map<string, Product>();
  const productByCodeMap = new Map<string, Product>();

  if (products && Array.isArray(products)) {
    products.forEach((p) => {
      if (p.id) productMap.set(p.id, p);
      if (p.name) productByNameMap.set(p.name.trim().toLowerCase(), p);
      if (p.code) productByCodeMap.set(p.code.trim().toLowerCase(), p);
    });
  }

  let totalHpp = 0;

  const isCancelledInvoice = (tx: Transaction) =>
    !!tx.isInvoice && (tx.invoiceStatus === 'CANCELLED' || tx.total === 0);

  // Flatten transaction rows for Excel
  const rows = transactions.flatMap((tx) => {
    const isVoid = isCancelledInvoice(tx);
    return tx.items.map((item, idx) => {
      const prod =
        (item.productId ? productMap.get(item.productId) : null) ||
        (item.code ? productByCodeMap.get(item.code.trim().toLowerCase()) : null) ||
        (item.name ? productByNameMap.get(item.name.trim().toLowerCase()) : null);

      const profitRes = calculateSalesItemCost(item, prod);
      const itemHpp = isVoid ? 0 : profitRes.totalCost;
      totalHpp += itemHpp;

      return {
        'No. Invoice': tx.id,
        'No. SPK': tx.spkOrderNumber || tx.spkId || item.spkOrderNumber || item.spkId || '-',
        'Tanggal': tx.date,
        'Waktu': tx.time,
        'Kasir': tx.cashierName,
        'Toko': tx.storeName,
        'Pelanggan': tx.customer ? tx.customer.name : 'Umum',
        'No. WhatsApp': tx.customer ? tx.customer.phone : '-',
        'Kategori Pelanggan': (tx.customerCategory && tx.customerCategory.toUpperCase() !== 'RETAIL') ? tx.customerCategory : 'UMUM',
        'No Item': idx + 1,
        'Kode Barang': item.code,
        'Nama Produk / Jasa': item.name,
        'Dimensi / Spesifikasi': item.formattedSpec || item.dimensions || '-',
        'Keterangan / Bahan': item.notes || '-',
        'Jumlah (Qty)': item.qty,
        'Satuan': item.unit,
        'Harga Satuan': item.unitPrice,
        'Total Item': item.totalPrice,
        'Estimasi HPP Item': itemHpp,
        'Estimasi Laba Item': isVoid ? 0 : profitRes.itemProfit,
        'Subtotal Transaksi': idx === 0 ? tx.subtotal : '',
        'Diskon Transaksi': idx === 0 ? tx.discount : '',
        'Total Bayar': idx === 0 ? tx.total : '',
        'Tunai (Cash)': idx === 0 ? tx.paymentMethods.cash : '',
        'Transfer': idx === 0 ? tx.paymentMethods.transfer : '',
        'QRIS': idx === 0 ? tx.paymentMethods.qris : '',
        'Kembalian': idx === 0 ? tx.change : '',
        'Catatan Kasir': idx === 0 ? (tx.cashierNotes || '-') : ''
      };
    });
  });

  // Summary sheet data
  const totalOmzet = transactions.reduce((sum, t) => sum + t.total, 0);
  const totalPajak = transactions.reduce((sum, t) => sum + (t.tax || 0), 0);
  // PPN yang dipungut bukan pendapatan usaha
  const netRevenue = totalOmzet - totalPajak;
  const totalLabaBersih = netRevenue - totalHpp;
  const marginPercent = netRevenue > 0 ? (totalLabaBersih / netRevenue) * 100 : 0;
  const totalCash = transactions.reduce((sum, t) => sum + t.paymentMethods.cash, 0);
  const totalTransfer = transactions.reduce((sum, t) => sum + t.paymentMethods.transfer, 0);
  const totalQris = transactions.reduce((sum, t) => sum + t.paymentMethods.qris, 0);
  const totalDiskon = transactions.reduce((sum, t) => sum + t.discount, 0);

  const summaryData = [
    { 'Metrik': 'Toko', 'Nilai': 'BEJO Digital Print' },
    { 'Metrik': 'Jumlah Transaksi', 'Nilai': transactions.length },
    { 'Metrik': 'Total Omzet Penjualan', 'Nilai': totalOmzet },
    { 'Metrik': 'Total PPN Dipungut', 'Nilai': totalPajak },
    { 'Metrik': 'Omzet Neto (tanpa PPN)', 'Nilai': netRevenue },
    { 'Metrik': 'Total Estimasi Modal (HPP)', 'Nilai': totalHpp },
    { 'Metrik': 'Total Laba Bersih Penjualan', 'Nilai': totalLabaBersih },
    { 'Metrik': 'Margin Laba Bersih (%)', 'Nilai': `${marginPercent.toFixed(2)}%` },
    { 'Metrik': 'Total Pembayaran Tunai (Cash)', 'Nilai': totalCash },
    { 'Metrik': 'Total Pembayaran Transfer Bank', 'Nilai': totalTransfer },
    { 'Metrik': 'Total Pembayaran QRIS', 'Nilai': totalQris },
    { 'Metrik': 'Total Potongan Diskon', 'Nilai': totalDiskon },
    { 'Metrik': 'Tanggal Ekspor', 'Nilai': new Date().toLocaleString('id-ID') },
  ];

  const workbook = XLSX.utils.book_new();

  const worksheetDetail = XLSX.utils.json_to_sheet(rows);
  const worksheetSummary = XLSX.utils.json_to_sheet(summaryData);

  // Set column widths for readable viewing
  worksheetDetail['!cols'] = [
    { wch: 18 }, // Invoice
    { wch: 12 }, // Tanggal
    { wch: 8 },  // Waktu
    { wch: 12 }, // Kasir
    { wch: 14 }, // Toko
    { wch: 20 }, // Pelanggan
    { wch: 16 }, // WA
    { wch: 16 }, // Kategori
    { wch: 8 },  // No item
    { wch: 12 }, // Kode
    { wch: 28 }, // Nama
    { wch: 18 }, // Dimensi
    { wch: 12 }, // Qty
    { wch: 14 }, // Satuan
    { wch: 14 }, // Harga
    { wch: 14 }, // Total
    { wch: 16 }, // Subtotal
    { wch: 14 }, // Diskon
    { wch: 16 }, // Total
    { wch: 14 }, // Cash
    { wch: 14 }, // Transfer
    { wch: 14 }, // QRIS
    { wch: 12 }, // Kembalian
    { wch: 30 }  // Catatan
  ];

  XLSX.utils.book_append_sheet(workbook, worksheetDetail, 'Detail Transaksi');
  XLSX.utils.book_append_sheet(workbook, worksheetSummary, 'Ringkasan Omzet');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateStr}.xlsx`);
}

export function exportStockTransactionsToExcel(
  stockTransactions: StockTransaction[],
  type: 'PEMBELIAN' | 'PENGAMBILAN',
  filenamePrefix = 'Laporan_Mutasi_Stok',
  products?: Product[],
  cetakAgenTransactions?: Transaction[]
) {
  const hasStockData = stockTransactions && stockTransactions.length > 0;
  const hasCetakData = cetakAgenTransactions && cetakAgenTransactions.length > 0;

  if (!hasStockData && !hasCetakData) {
    alert('Tidak ada data transaksi untuk diekspor.');
    return;
  }

  const normalizedList = (stockTransactions || []).map(normalizeStockTransaction);
  const partyLabel = type === 'PEMBELIAN' ? 'Nama Supplier' : 'Nama Agen';
  const priceLabel = type === 'PEMBELIAN' ? 'Harga Kulak (HPP)' : 'Harga Agen / Meter';
  const typeTitle = type === 'PEMBELIAN' ? 'Pembelian Bahan' : 'Pengambilan Bahan';

  const productMap = new Map<string, Product>();
  const productByNameMap = new Map<string, Product>();
  const productByCodeMap = new Map<string, Product>();

  if (products && products.length > 0) {
    products.forEach((p) => {
      if (p.id) productMap.set(p.id, p);
      if (p.name) productByNameMap.set(p.name.trim().toLowerCase(), p);
      if (p.code) productByCodeMap.set(p.code.trim().toLowerCase(), p);
    });
  }

  // Detail rows: per stock transaction with all items itemized
  const rows = normalizedList.flatMap((tx) => {
    return tx.items.map((item, idx) => {
      const prod =
        (item.productId ? productMap.get(item.productId) : null) ||
        (item.code ? productByCodeMap.get(item.code.trim().toLowerCase()) : null) ||
        (item.productName ? productByNameMap.get(item.productName.trim().toLowerCase()) : null);

      const profitData = type === 'PENGAMBILAN' ? calculateStockItemProfit(item, prod) : null;

      if (type === 'PENGAMBILAN' && profitData) {
        return {
          'No. Transaksi': tx.id,
          'Tanggal': tx.date,
          'Waktu': tx.time,
          [partyLabel]: tx.supplierName,
          'No Item': idx + 1,
          'Kode / SKU': item.code || '-',
          'Nama Produk / Bahan': item.productName,
          'Kategori': item.category || '-',
          'Jumlah (Qty)': item.qty,
          'Satuan': item.unit || 'pcs',
          'Jenis Unit': profitData.isMeterOrLembar ? 'Meter / Lembaran' : 'Roll / Pak',
          'Harga Jual (Agen/Meter)': profitData.unitPrice,
          'Modal Satuan (HPP)': Math.round(profitData.costPerUnit),
          'Total Nilai Pengambilan': profitData.totalAmount,
          'Total Modal Kulak': Math.round(profitData.totalCost),
          'Laba Bersih Satuan': Math.round(profitData.profitPerUnit),
          'Total Laba Bersih': Math.round(profitData.totalProfit),
          'Rumus Laba': profitData.isMeterOrLembar
            ? `(Harga Meter - (Kulak / ${profitData.rollPakQty})) × Qty`
            : '(Harga Agen - Kulak) × Qty',
          'Catatan Item': item.notes || '-',
          'Catatan Transaksi': idx === 0 ? (tx.notes || '-') : ''
        };
      }

      if (type === 'PEMBELIAN') {
        const hasOngkir = tx.shippingCost && tx.shippingCost > 0;
        return {
          'No. Transaksi': tx.id,
          'Tanggal': tx.date,
          'Waktu': tx.time,
          [partyLabel]: tx.supplierName,
          'No Item': idx + 1,
          'Kode / SKU': item.code || '-',
          'Nama Produk / Bahan': item.productName,
          'Kategori': item.category || '-',
          'Jumlah (Qty)': item.qty,
          'Satuan': item.unit || 'pcs',
          [priceLabel]: item.price,
          'Total Nilai Item': item.totalPrice,
          'Total Qty Transaksi': idx === 0 ? tx.totalQty : '',
          'Subtotal Bahan': idx === 0 ? ((tx.totalAmount || 0) - (tx.shippingCost || 0)) : '',
          'Ongkos Kirim (Door to Door)': idx === 0 ? (hasOngkir ? tx.shippingCost : 0) : '',
          'Total Nilai Transaksi (+Ongkir)': idx === 0 ? tx.totalAmount : '',
          'Catatan Item': item.notes || '-',
          'Catatan Transaksi': idx === 0 ? (tx.notes || '-') : ''
        };
      }

      return {
        'No. Transaksi': tx.id,
        'Tanggal': tx.date,
        'Waktu': tx.time,
        [partyLabel]: tx.supplierName,
        'No Item': idx + 1,
        'Kode / SKU': item.code || '-',
        'Nama Produk / Bahan': item.productName,
        'Kategori': item.category || '-',
        'Jumlah (Qty)': item.qty,
        'Satuan': item.unit || 'pcs',
        [priceLabel]: item.price,
        'Total Nilai Item': item.totalPrice,
        'Total Qty Transaksi': idx === 0 ? tx.totalQty : '',
        'Total Nilai Transaksi': idx === 0 ? tx.totalAmount : '',
        'Catatan Item': item.notes || '-',
        'Catatan Transaksi': idx === 0 ? (tx.notes || '-') : ''
      };
    });
  });

  const workbook = XLSX.utils.book_new();

  if (rows.length > 0) {
    const worksheetDetail = XLSX.utils.json_to_sheet(rows);
    worksheetDetail['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 8 },
      { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
      { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      { wch: 28 }, { wch: 20 }, { wch: 28 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheetDetail, `Detail ${typeTitle}`);
  }

  // Cetak Agen worksheet if provided
  if (hasCetakData) {
    const cetakRows = cetakAgenTransactions!.flatMap((tx) => {
      return (tx.items || []).map((it, idx) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);

        const costRes = calculateSalesItemCost(it, prod);
        const itemProfit = (it.totalPrice || 0) - costRes.totalCost;

        let specStr = '';
        if (it.width && it.height) {
          specStr = `${it.width} x ${it.height} cm`;
        } else if (it.length) {
          specStr = `P: ${it.length} m`;
        } else if (it.sqm) {
          specStr = `${it.sqm} m²`;
        }

        return {
          'No. Invoice': tx.id,
          'Tanggal': tx.date,
          'Waktu': tx.time || '-',
          'Nama Agen': tx.customer?.name || 'Agen',
          'No. HP / WA': tx.customer?.phone || '-',
          'Kasir': tx.cashierName || '-',
          'No Item': idx + 1,
          'Kode / SKU': it.code || '-',
          'Nama Cetakan / Produk': it.name,
          'Spesifikasi': specStr || '-',
          'Jumlah (Qty)': it.qty,
          'Satuan': it.unit || 'pcs',
          'Harga Satuan (Agen)': it.unitPrice || it.price || 0,
          'Modal Satuan (HPP)': Math.round(costRes.costPerUnit),
          'Total Tarif Item': it.totalPrice || 0,
          'Total Modal (HPP)': Math.round(costRes.totalCost),
          'Laba Bersih Item': Math.round(itemProfit),
          'Metode Bayar': tx.paymentMethods?.cash > 0 ? 'Cash' : tx.paymentMethods?.transfer > 0 ? 'Transfer' : tx.paymentMethods?.qris > 0 ? 'QRIS' : '-',
          'Catatan Item': it.notes || '-',
          'Catatan Transaksi': idx === 0 ? (tx.notes || '-') : ''
        };
      });
    });

    const worksheetCetak = XLSX.utils.json_to_sheet(cetakRows);
    worksheetCetak['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 14 },
      { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 28 }, { wch: 18 },
      { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
      { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 28 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheetCetak, 'Detail Cetak Agen');
  }

  const totalTransactions = normalizedList.length;
  const totalVolumeQty = normalizedList.reduce((sum, t) => sum + t.totalQty, 0);
  const totalGrandAmount = normalizedList.reduce((sum, t) => sum + t.totalAmount, 0);

  let totalGrandCost = 0;
  let totalGrandProfit = 0;

  if (type === 'PENGAMBILAN') {
    normalizedList.forEach((tx) => {
      tx.items.forEach((item) => {
        const prod =
          (item.productId ? productMap.get(item.productId) : null) ||
          (item.code ? productByCodeMap.get(item.code.trim().toLowerCase()) : null) ||
          (item.productName ? productByNameMap.get(item.productName.trim().toLowerCase()) : null);
        const pData = calculateStockItemProfit(item, prod);
        totalGrandCost += pData.totalCost;
        totalGrandProfit += pData.totalProfit;
      });
    });
  }

  const summaryData = [
    { 'Metrik': 'Jenis Laporan', 'Nilai': `Laporan ${typeTitle} (Per Transaksi)` },
    { 'Metrik': 'Jumlah Transaksi Mutasi', 'Nilai': totalTransactions },
    { 'Metrik': 'Total Qty / Volume Bahan', 'Nilai': totalVolumeQty },
    { 'Metrik': type === 'PENGAMBILAN' ? 'Total Nilai Pengambilan Agen' : 'Total Nilai Pembelian', 'Nilai': totalGrandAmount },
    ...(type === 'PENGAMBILAN'
      ? [
          { 'Metrik': 'Total Modal Kulak (HPP)', 'Nilai': Math.round(totalGrandCost) },
          { 'Metrik': 'Total Laba Bersih Pengambilan', 'Nilai': Math.round(totalGrandProfit) },
          { 'Metrik': '% Margin Laba Bersih', 'Nilai': totalGrandAmount > 0 ? `${((totalGrandProfit / totalGrandAmount) * 100).toFixed(2)}%` : '0%' },
        ]
      : []),
    ...(hasCetakData
      ? [
          { 'Metrik': 'Jumlah Transaksi Cetak Agen', 'Nilai': cetakAgenTransactions!.length },
          { 'Metrik': 'Total Nominal Cetak Agen', 'Nilai': cetakAgenTransactions!.reduce((acc, t) => acc + (t.total || 0), 0) },
        ]
      : []),
    { 'Metrik': 'Tanggal Ekspor', 'Nilai': new Date().toLocaleString('id-ID') },
  ];

  const worksheetSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, worksheetSummary, 'Ringkasan Rekap');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateStr}.xlsx`);
}

export function exportSingleStockTransactionToExcel(
  stockTransaction: StockTransaction,
  type: 'PEMBELIAN' | 'PENGAMBILAN',
  storeName = 'BEJO Digital Print',
  products?: Product[]
) {
  const norm = normalizeStockTransaction(stockTransaction);
  const isPembelian = type === 'PEMBELIAN';
  const partyLabel = isPembelian ? 'Nama Supplier' : 'Nama Agen';
  const priceLabel = isPembelian ? 'Harga Kulak (HPP)' : 'Harga Agen / Meter';
  const docTitle = isPembelian ? 'Faktur Pembelian Bahan' : 'Nota Pengambilan Bahan';

  const productMap = new Map<string, Product>();
  const productByNameMap = new Map<string, Product>();
  const productByCodeMap = new Map<string, Product>();

  if (products && products.length > 0) {
    products.forEach((p) => {
      if (p.id) productMap.set(p.id, p);
      if (p.name) productByNameMap.set(p.name.trim().toLowerCase(), p);
      if (p.code) productByCodeMap.set(p.code.trim().toLowerCase(), p);
    });
  }

  let totalTxCost = 0;
  let totalTxProfit = 0;

  const rows = norm.items.map((item, idx) => {
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
      return {
        'No.': idx + 1,
        'Kode / SKU': item.code || '-',
        'Nama Produk / Bahan': item.productName,
        'Kategori': item.category || '-',
        'Jumlah (Qty)': item.qty,
        'Satuan': item.unit || 'pcs',
        'Jenis Unit': profitData.isMeterOrLembar ? 'Meter / Lembaran' : 'Roll / Pak',
        'Harga Jual': profitData.unitPrice,
        'Modal Satuan (HPP)': Math.round(profitData.costPerUnit),
        'Total Nilai Item': profitData.totalAmount,
        'Total Modal Kulak': Math.round(profitData.totalCost),
        'Laba Bersih': Math.round(profitData.totalProfit),
        'Rumus Laba': profitData.isMeterOrLembar
          ? `(Harga Meter - (Kulak / ${profitData.rollPakQty})) × Qty`
          : '(Harga Agen - Kulak) × Qty',
        'Catatan Item': item.notes || '-'
      };
    }

    return {
      'No.': idx + 1,
      'Kode / SKU': item.code || '-',
      'Nama Produk / Bahan': item.productName,
      'Kategori': item.category || '-',
      'Jumlah (Qty)': item.qty,
      'Satuan': item.unit || 'pcs',
      [priceLabel]: item.price,
      'Total Subtotal': item.totalPrice,
      'Catatan Item': item.notes || '-'
    };
  });

  const infoRows = [
    { 'Informasi Transaksi': 'Dokumen', 'Keterangan': docTitle },
    { 'Informasi Transaksi': 'Toko', 'Keterangan': storeName },
    { 'Informasi Transaksi': 'No. Transaksi', 'Keterangan': norm.id },
    { 'Informasi Transaksi': 'Tanggal', 'Keterangan': norm.date },
    { 'Informasi Transaksi': 'Waktu', 'Keterangan': norm.time },
    { 'Informasi Transaksi': partyLabel, 'Keterangan': norm.supplierName },
    { 'Informasi Transaksi': 'Total Macam Produk', 'Keterangan': `${norm.items.length} Macam` },
    { 'Informasi Transaksi': 'Total Volume Qty', 'Keterangan': `${norm.totalQty} Unit` },
    { 'Informasi Transaksi': 'Total Nilai Transaksi', 'Keterangan': norm.totalAmount },
    ...(isPembelian && norm.shippingCost && norm.shippingCost > 0
      ? [
          { 'Informasi Transaksi': 'Subtotal Bahan', 'Keterangan': norm.totalAmount - norm.shippingCost },
          { 'Informasi Transaksi': 'Ongkos Kirim (Door to Door)', 'Keterangan': norm.shippingCost },
          { 'Informasi Transaksi': 'Total Pembelian (+Ongkir)', 'Keterangan': norm.totalAmount }
        ]
      : []),
    ...(!isPembelian
      ? [
          { 'Informasi Transaksi': 'Total Modal Kulak (HPP)', 'Keterangan': Math.round(totalTxCost) },
          { 'Informasi Transaksi': 'Total Laba Bersih Transaksi', 'Keterangan': Math.round(totalTxProfit) },
          {
            'Informasi Transaksi': '% Margin Laba',
            'Keterangan': norm.totalAmount > 0 ? `${((totalTxProfit / norm.totalAmount) * 100).toFixed(2)}%` : '0%'
          },
          { 'Informasi Transaksi': 'Rumus Laba Roll/Pak', 'Keterangan': '(Harga Agen – Harga Kulak) x Jumlah Dibeli' },
          { 'Informasi Transaksi': 'Rumus Laba Meter/Lembar', 'Keterangan': '(Harga Meter Grosir – (Harga Kulak : Jumlah per Roll/Pak)) x Jumlah Dibeli' }
        ]
      : []),
    { 'Informasi Transaksi': 'Catatan Transaksi', 'Keterangan': norm.notes || '-' },
    { 'Informasi Transaksi': 'Waktu Cetak', 'Keterangan': new Date().toLocaleString('id-ID') },
  ];

  const workbook = XLSX.utils.book_new();
  const wsDetail = XLSX.utils.json_to_sheet(rows);
  const wsInfo = XLSX.utils.json_to_sheet(infoRows);

  wsDetail['!cols'] = [
    { wch: 6 },  // No.
    { wch: 14 }, // SKU
    { wch: 32 }, // Nama Produk
    { wch: 18 }, // Kategori
    { wch: 14 }, // Qty
    { wch: 10 }, // Satuan
    { wch: 16 }, // Jenis / Harga
    { wch: 18 }, // Modal
    { wch: 18 }, // Total Subtotal
    { wch: 18 }, // Total Modal
    { wch: 18 }, // Laba
    { wch: 28 }, // Rumus
    { wch: 25 }  // Catatan
  ];

  wsInfo['!cols'] = [
    { wch: 28 },
    { wch: 45 }
  ];

  XLSX.utils.book_append_sheet(workbook, wsDetail, 'Rincian Produk');
  XLSX.utils.book_append_sheet(workbook, wsInfo, 'Informasi Dokumen');

  const filePrefix = isPembelian ? 'Faktur_Pembelian' : 'Nota_Pengambilan';
  const cleanId = norm.id.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(workbook, `${filePrefix}_${cleanId}.xlsx`);
}


