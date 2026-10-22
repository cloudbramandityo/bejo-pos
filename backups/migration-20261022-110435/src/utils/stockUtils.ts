/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import { Product, StockTransaction, StockTransactionItem } from '../types';

/**
 * Checks if a unit is meter or lembar based on unit text or unitMode
 */
export function isMeterOrLembarUnit(unit?: string, unitMode?: string): boolean {
  if (unitMode === 'meter_lembar') return true;
  if (unitMode === 'roll_pak') return false;
  if (!unit) return false;
  const u = unit.toLowerCase().trim();
  return (
    u.includes('meter') ||
    u.includes('lembar') ||
    u.includes('m2') ||
    u.includes('cm') ||
    u === 'm' ||
    u === 'lbr'
  );
}

/**
 * Normalisasi dan koreksi data spesifikasi kemasan dan dimensi produk agar selalu akurat
 */
export function sanitizeProductItem(product: Product): Product {
  if (!product) return product;
  const p = { ...product };
  const name = (p.name || '').trim();
  const nameLower = name.toLowerCase();

  // 1. A3+ BONTAC Chromo -> Bahan, 250 Lembar/pak
  if (nameLower.includes('bontac') && nameLower.includes('chromo')) {
    p.category = p.category || 'bahan';
    p.unit = 'pak';
    p.stockUnit = p.stockUnit || 'pak';
    p.dimensions = '250 Lembar/pak';
    p.perRollPak = '250 Lembar/pak';
    p.perRollPakValue = 250;
    return p;
  }

  // 2. A3+ K-Pluz Gloss Clear WU -> Bahan, 500 Lembar/pak
  if (nameLower.includes('k-pluz') && nameLower.includes('clear')) {
    p.category = p.category || 'bahan';
    p.unit = 'pak';
    p.stockUnit = p.stockUnit || 'pak';
    p.dimensions = '500 Lembar/pak';
    p.perRollPak = '500 Lembar/pak';
    p.perRollPakValue = 500;
    return p;
  }

  // 3. A3+ K-Pluz Gloss White WU -> Bahan, 500 Lembar/pak
  if (nameLower.includes('k-pluz') && nameLower.includes('white')) {
    p.category = p.category || 'bahan';
    p.unit = 'pak';
    p.stockUnit = p.stockUnit || 'pak';
    p.dimensions = '500 Lembar/pak';
    p.perRollPak = '500 Lembar/pak';
    p.perRollPakValue = 500;
    return p;
  }

  // 4. A3+ LFDP Gloss White CAMEL -> Bahan, 500 Lembar/pak
  if (nameLower.includes('lfdp') && (nameLower.includes('camel') || nameLower.includes('white'))) {
    p.category = p.category || 'bahan';
    p.unit = 'pak';
    p.stockUnit = p.stockUnit || 'pak';
    p.dimensions = '500 Lembar/pak';
    p.perRollPak = '500 Lembar/pak';
    p.perRollPakValue = 500;
    return p;
  }

  // 5. Biru Tua Glossy 45x9 CARDIARY -> Custom_sticker, 9 Meter/Roll
  if (nameLower.includes('biru tua glossy') && nameLower.includes('cardiary')) {
    p.category = p.category || 'custom_sticker';
    p.unit = 'roll';
    p.dimensions = '9 Meter/Roll';
    p.perRollPak = '9 Meter/Roll';
    p.perRollPakValue = 9;
    return p;
  }

  // 6. Gold Glossy STD 45x15 DECOFIX -> Custom_sticker, 15 Meter/Roll
  if (nameLower.includes('gold glossy') && nameLower.includes('decofix') && (nameLower.includes('45x15') || nameLower.includes('std'))) {
    p.category = p.category || 'custom_sticker';
    p.unit = 'roll';
    p.dimensions = '15 Meter/Roll';
    p.perRollPak = '15 Meter/Roll';
    p.perRollPakValue = 15;
    return p;
  }

  // 7. Hitam Doff 45x15 DECOFIX -> Custom_sticker, 15 Meter/Roll
  if (nameLower.includes('hitam doff') && nameLower.includes('decofix') && (nameLower.includes('45x15') || p.dimensions === '15')) {
    p.category = p.category || 'custom_sticker';
    p.unit = 'roll';
    p.dimensions = '15 Meter/Roll';
    p.perRollPak = '15 Meter/Roll';
    p.perRollPakValue = 15;
    return p;
  }

  // 8. Hitam Glossy 152x18 DECOFIX -> Custom_sticker, 18 Meter/Roll
  if (nameLower.includes('hitam glossy') && nameLower.includes('decofix') && (nameLower.includes('152x18') || p.dimensions === '18')) {
    p.category = p.category || 'custom_sticker';
    p.unit = 'roll';
    p.dimensions = '18 Meter/Roll';
    p.perRollPak = '18 Meter/Roll';
    p.perRollPakValue = 18;
    return p;
  }

  // 9. Pink Glossy 45x9 CARDIARY -> Custom_sticker, 9 Meter/Roll
  if (nameLower.includes('pink glossy') && nameLower.includes('cardiary')) {
    p.category = p.category || 'custom_sticker';
    p.unit = 'roll';
    p.dimensions = '9 Meter/Roll';
    p.perRollPak = '9 Meter/Roll';
    p.perRollPakValue = 9;
    return p;
  }

  // 10. Reflektif Kuning 60x45 SAICHOLITE -> Custom_sticker, 45 Meter/Roll
  if (nameLower.includes('reflektif kuning') && nameLower.includes('saicholite') && !nameLower.includes('hijau') && !nameLower.includes('lemon')) {
    p.category = p.category || 'custom_sticker';
    p.unit = 'roll';
    p.dimensions = '45 Meter/Roll';
    p.perRollPak = '45 Meter/Roll';
    p.perRollPakValue = 45;
    return p;
  }

  // Normalisasi umum untuk dimensi/perRollPak yang hanya berisi angka tanpa "Meter/Roll"
  if (p.dimensions && /^\d+(\.\d+)?$/.test(p.dimensions.trim())) {
    const num = parseFloat(p.dimensions.trim());
    p.dimensions = `${num} Meter/Roll`;
  }
  if (p.perRollPak && /^\d+(\.\d+)?$/.test(p.perRollPak.trim())) {
    const num = parseFloat(p.perRollPak.trim());
    p.perRollPak = `${num} Meter/Roll`;
  }

  return p;
}

/**
 * Mendapatkan nilai jumlah meter atau lembar dalam 1 roll/pak dari data produk
 * Contoh: '15 meter' -> 15, '50 meter/roll' -> 50, '100 lembar/pak' -> 100, dimensions '30x15' -> 15
 */
export function getProductRollPakQty(product?: Product | null): number {
  if (!product) return 1;
  const nameLower = (product.name || '').toLowerCase();
  
  if (nameLower.includes('bontac') && nameLower.includes('chromo')) return 250;
  if (nameLower.includes('k-pluz') && (nameLower.includes('clear') || nameLower.includes('white') || nameLower.includes('wu'))) return 500;
  if (nameLower.includes('lfdp') && (nameLower.includes('camel') || nameLower.includes('white'))) return 500;

  if (typeof product.perRollPakValue === 'number' && product.perRollPakValue > 0) {
    return product.perRollPakValue;
  }
  if (product.perRollPak && typeof product.perRollPak === 'string') {
    const match = product.perRollPak.match(/(\d+(\.\d+)?)/);
    if (match && parseFloat(match[1]) > 0) {
      return parseFloat(match[1]);
    }
  }
  if (product.dimensions && typeof product.dimensions === 'string') {
    const parts = product.dimensions.toLowerCase().split('x');
    if (parts.length >= 2) {
      const secondPartNum = parseFloat(parts[1].trim());
      if (!isNaN(secondPartNum) && secondPartNum > 0) {
        return secondPartNum;
      }
    }
    const match = product.dimensions.match(/(\d+(\.\d+)?)/);
    if (match && parseFloat(match[1]) > 0) {
      return parseFloat(match[1]);
    }
  }
  return 1;
}

export interface MaterialStockFormulaInfo {
  unit: string;
  subUnit: 'meter' | 'lembar' | 'botol' | 'pcs' | string;
  qtyPerRollPak: number;
  kemasanText: string;
  formulaText: string; // e.g. "1 Roll = 50 meter", "1 Pak = 100 lembar", "1 Botol = 1 botol"
  isStandardRoll: boolean;
  isStandardPak: boolean;
  isStandardBotol: boolean;
}

/**
 * Standard Material Stock Formula:
 * 1. Roll: Keterangan Kemasan = xx meter/roll, Jumlah = xx, Satuan = roll -> 1 Roll = xx meter
 * 2. Pak: Keterangan Kemasan = xx lembar/pak, Jumlah = xx, Satuan = pak -> 1 Pak = xx lembar
 * 3. Botol: Keterangan Kemasan = 1 botol/pak, Jumlah = 1, Satuan = botol -> 1 Botol = 1 botol
 */
export function getMaterialStockFormula(product?: Partial<Product> | null): MaterialStockFormulaInfo {
  const rawUnit = (product?.unit || product?.stockUnit || 'roll').toLowerCase().trim();
  const perRollPak = (product?.perRollPak || '').toLowerCase().trim();
  const nameLower = (product?.name || '').toLowerCase().trim();
  const qty = getProductRollPakQty(product as Product);

  let unit = rawUnit;
  let subUnit = 'meter';
  let isStandardRoll = false;
  let isStandardPak = false;
  let isStandardBotol = false;

  if (rawUnit === 'botol' || perRollPak.includes('botol')) {
    unit = 'botol';
    subUnit = 'botol';
    isStandardBotol = true;
    const effectiveQty = qty > 0 ? qty : 1;
    return {
      unit: 'botol',
      subUnit: 'botol',
      qtyPerRollPak: effectiveQty,
      kemasanText: product?.perRollPak && !/^\d+$/.test(product.perRollPak.trim()) ? product.perRollPak : `${effectiveQty} botol/pak`,
      formulaText: effectiveQty === 1 ? '1 Botol = 1 botol' : `1 Pak = ${effectiveQty} botol`,
      isStandardRoll: false,
      isStandardPak: false,
      isStandardBotol: true
    };
  }

  const isSheetOrPak =
    rawUnit === 'pak' ||
    perRollPak.includes('lembar') ||
    perRollPak.includes('pak') ||
    rawUnit === 'lembar' ||
    nameLower.includes('bontac') ||
    nameLower.includes('k-pluz') ||
    nameLower.includes('lfdp') ||
    nameLower.includes('a3+');

  if (isSheetOrPak) {
    unit = 'pak';
    subUnit = 'lembar';
    isStandardPak = true;
    const effectiveQty = qty > 0 ? qty : 100;
    return {
      unit: 'pak',
      subUnit: 'lembar',
      qtyPerRollPak: effectiveQty,
      kemasanText: product?.perRollPak && !/^\d+$/.test(product.perRollPak.trim()) && product.perRollPak.toLowerCase().includes('lembar') ? product.perRollPak : `${effectiveQty} lembar/pak`,
      formulaText: `1 Pak = ${effectiveQty} lembar`,
      isStandardRoll: false,
      isStandardPak: true,
      isStandardBotol: false
    };
  }

  // Default: Roll
  unit = 'roll';
  subUnit = 'meter';
  isStandardRoll = true;
  const effectiveQty = qty > 0 ? qty : 50;
  return {
    unit: 'roll',
    subUnit: 'meter',
    qtyPerRollPak: effectiveQty,
    kemasanText: product?.perRollPak && !/^\d+$/.test(product.perRollPak.trim()) && product.perRollPak.toLowerCase().includes('meter') ? product.perRollPak : `${effectiveQty} meter/roll`,
    formulaText: `1 Roll = ${effectiveQty} meter`,
    isStandardRoll: true,
    isStandardPak: false,
    isStandardBotol: false
  };
}

/**
 * Format standard kemasan string according to unit and qty
 */
export function formatStandardKemasan(unit: string, qty: number): string {
  const u = unit.toLowerCase().trim();
  const q = qty > 0 ? qty : 1;
  if (u === 'botol') {
    return `${q} botol/pak`;
  }
  if (u === 'pak' || u === 'lembar') {
    return `${q} lembar/pak`;
  }
  return `${q} meter/roll`;
}

export interface StockBreakdownResult {
  primaryQty: number; // Jumlah Satuan Besar utuh (e.g. 1 Roll, 4 Pak)
  primaryUnit: string; // Satuan Besar (e.g. "Roll", "Pak", "Botol")
  subQty: number; // Sisa Satuan Kecil (e.g. 13 Meter, 90 Lembar)
  subUnit: string; // Satuan Kecil (e.g. "Meter", "Lembar", "Botol")
  conversionRate: number; // 1 Satuan Besar = X Satuan Kecil (e.g. 17, 100)
  totalInSubUnits: number; // Total sisa dalam satuan kecil (e.g. 30 Meter, 490 Lembar)
  totalInPrimaryUnits: number; // Total stok desimal (e.g. 1.7647 Roll)
  formattedText: string; // Hasil format rapi: "1 Roll 13 Meter", "4 Pak 90 Lembar", "5 Botol"
  isNegative: boolean;
}

/**
 * Logika Sistem Pinjam/Kembalian Stok Bahan:
 * Mengonversi stok satuan besar dan kecil saat terjadi penjualan dalam satuan kecil.
 *
 * Contoh Kasus 1:
 * - Stok Awal: 2 Roll (1 Roll = 17 Meter) -> Penjualan: 4 Meter -> Hasil: 1 Roll 13 Meter
 *
 * Contoh Kasus 2:
 * - Stok Awal: 5 Pak (1 Pak = 100 Lembar) -> Penjualan: 10 Lembar -> Hasil: 4 Pak 90 Lembar
 */
export function calculateBorrowReturnStock(
  primaryStockInitial: number = 0,
  subStockInitial: number = 0,
  conversionRate: number = 1,
  soldSmallQty: number = 0,
  primaryUnitName: string = 'Roll',
  subUnitName: string = 'Meter'
): StockBreakdownResult {
  const effectiveConversion = Math.max(1, conversionRate || 1);
  const totalSubInitial = primaryStockInitial * effectiveConversion + subStockInitial;
  const totalSubRemaining = totalSubInitial - soldSmallQty;
  const isNegative = totalSubRemaining < 0;

  const absSub = Math.abs(totalSubRemaining);
  const primaryQty = Math.floor(absSub / effectiveConversion);
  // Round to 3 decimal places to prevent floating point inaccuracies like 12.99999999
  const subQty = Math.round((absSub - primaryQty * effectiveConversion) * 1000) / 1000;
  const totalInPrimaryUnits = totalSubRemaining / effectiveConversion;

  // Format primary unit display capitalization
  const pUnit = primaryUnitName ? primaryUnitName.charAt(0).toUpperCase() + primaryUnitName.slice(1) : 'Roll';
  const sUnit = subUnitName ? subUnitName.charAt(0).toUpperCase() + subUnitName.slice(1) : 'Meter';

  let formattedText = '';
  if (effectiveConversion <= 1 || pUnit.toLowerCase() === sUnit.toLowerCase()) {
    // Non-fractional units like Botol / Pcs
    formattedText = `${isNegative ? '-' : ''}${absSub} ${pUnit}`;
  } else {
    if (primaryQty > 0 && subQty > 0) {
      formattedText = `${isNegative ? '-' : ''}${primaryQty} ${pUnit} ${subQty} ${sUnit}`;
    } else if (primaryQty > 0 && subQty === 0) {
      formattedText = `${isNegative ? '-' : ''}${primaryQty} ${pUnit}`;
    } else {
      formattedText = `${isNegative ? '-' : ''}${subQty} ${sUnit}`;
    }
  }

  return {
    primaryQty: isNegative ? -primaryQty : primaryQty,
    primaryUnit: pUnit,
    subQty: isNegative ? -subQty : subQty,
    subUnit: sUnit,
    conversionRate: effectiveConversion,
    totalInSubUnits: totalSubRemaining,
    totalInPrimaryUnits,
    formattedText,
    isNegative
  };
}

/**
 * Breakdown dan format stok produk saat ini secara otomatis
 */
export function calculateStockBreakdown(
  stockValue?: number | null,
  product?: Partial<Product> | null
): StockBreakdownResult {
  const stockNum = typeof stockValue === 'number' ? stockValue : 0;
  const formula = getMaterialStockFormula(product);
  const conversionRate = formula.qtyPerRollPak || 1;

  // Total in sub units
  const totalSub = Math.round(stockNum * conversionRate * 1000) / 1000;
  const isNegative = totalSub < 0;
  const absSub = Math.abs(totalSub);

  const primaryQty = Math.floor(absSub / conversionRate);
  const subQty = Math.round((absSub - primaryQty * conversionRate) * 1000) / 1000;

  const pUnit = formula.unit.charAt(0).toUpperCase() + formula.unit.slice(1);
  const sUnit = formula.subUnit.charAt(0).toUpperCase() + formula.subUnit.slice(1);

  const formatDecimal = (num: number) => String(num).replace('.', ',');

  let formattedText = '';
  if (conversionRate <= 1 || formula.unit.toLowerCase() === formula.subUnit.toLowerCase()) {
    formattedText = `${isNegative ? '-' : ''}${formatDecimal(absSub)} ${formula.unit.toLowerCase()}`;
  } else {
    if (primaryQty > 0 && subQty > 0) {
      formattedText = `${isNegative ? '-' : ''}${primaryQty} ${formula.unit.toLowerCase()} ${formatDecimal(subQty)} ${formula.subUnit.toLowerCase()}`;
    } else if (primaryQty > 0 && subQty === 0) {
      formattedText = `${isNegative ? '-' : ''}${primaryQty} ${formula.unit.toLowerCase()}`;
    } else {
      formattedText = `${isNegative ? '-' : ''}${formatDecimal(subQty)} ${formula.subUnit.toLowerCase()}`;
    }
  }

  return {
    primaryQty: isNegative ? -primaryQty : primaryQty,
    primaryUnit: pUnit,
    subQty: isNegative ? -subQty : subQty,
    subUnit: sUnit,
    conversionRate,
    totalInSubUnits: totalSub,
    totalInPrimaryUnits: stockNum,
    formattedText,
    isNegative
  };
}

/**
 * Format string representasi stok produk (misal: "1 roll 13 meter" atau "4 pak 90 lembar")
 */
export function formatStockDisplay(
  stockValue?: number | Partial<Product> | null,
  product?: Partial<Product> | null
): string {
  if (stockValue === undefined || stockValue === null) {
    return '0';
  }
  // If first arg is product object
  if (typeof stockValue === 'object') {
    const p = stockValue as Product;
    return formatStockDisplay(p.stock, p);
  }
  const breakdown = calculateStockBreakdown(stockValue, product);
  return breakdown.formattedText;
}

export interface ProductAvailabilityStatus {
  text: string;
  isAlwaysAvailable: boolean;
  isZeroStock: boolean;
  isLowStock: boolean;
  badgeType: 'available' | 'always_available' | 'low_stock' | 'out_of_stock';
}

/**
 * Mengambil Status Ketersediaan resmi seperti di Katalog Produk
 * Contoh return text: "94 pak", "29 roll 7,5 meter", "199 botol", "Selalu Tersedia", "0 meter (STOK HABIS)"
 */
export function getProductAvailabilityStatus(
  product?: Partial<Product> | null,
  isOffline: boolean = false
): ProductAvailabilityStatus {
  if (!product) {
    return {
      text: '0 (STOK HABIS)',
      isAlwaysAvailable: false,
      isZeroStock: true,
      isLowStock: false,
      badgeType: 'out_of_stock'
    };
  }

  const categoryLower = (product.category || '').toLowerCase();
  const isDigital = categoryLower.includes('digital') || categoryLower.includes('printing') || categoryLower.includes('laser');
  const isPaket = categoryLower.includes('paket');
  const isAssetToko = Boolean(product.isAssetToko);

  // 1. Selalu Tersedia check (Offline, Paket, atau Jasa Cetak Digital Printing non-asset toko)
  if (isOffline || isPaket || (isDigital && !isAssetToko)) {
    return {
      text: 'Selalu Tersedia',
      isAlwaysAvailable: true,
      isZeroStock: false,
      isLowStock: false,
      badgeType: 'always_available'
    };
  }

  const stockVal = typeof product.stock === 'number' ? product.stock : 0;
  const isZeroStock = stockVal <= 0;
  const minStock = typeof product.minStock === 'number' ? product.minStock : 3;
  const isLowStock = stockVal > 0 && stockVal <= minStock;
  const formattedStock = formatStockDisplay(stockVal, product);

  // 2. Out of Stock check
  if (isZeroStock) {
    return {
      text: `${formattedStock} (STOK HABIS)`,
      isAlwaysAvailable: false,
      isZeroStock: true,
      isLowStock: false,
      badgeType: 'out_of_stock'
    };
  }

  // 3. Normal / Low Stock
  return {
    text: formattedStock,
    isAlwaysAvailable: false,
    isZeroStock: false,
    isLowStock,
    badgeType: isLowStock ? 'low_stock' : 'available'
  };
}

/**
 * Menghitung laba untuk transaksi Pengambilan Bahan:
 * - Laba Roll/Pak = (Harga Agen - Harga Kulak) x Jumlah Dibeli
 * - Laba Meter/Lembaran = (Harga Meter Grosir - (Harga Kulak : Jumlah per Roll/Pak)) x Jumlah Dibeli
 */
export function calculateStockItemProfit(
  item: {
    qty: number;
    price: number;
    unit?: string;
    unitMode?: string;
    productId?: string;
    productName?: string;
    code?: string;
  },
  product?: Product | null
): {
  isMeterOrLembar: boolean;
  qty: number;
  unitPrice: number; // Harga Jual Agen / Meter Grosir
  rollPakQty: number; // Jumlah per Roll/Pak
  costPriceKulak: number; // Harga Kulak Utuh (HPP Produk)
  costPerUnit: number; // Modal per satuan unit (Meter/Lembar atau Roll/Pak)
  profitPerUnit: number; // Laba per satuan unit
  totalAmount: number; // Total Harga Pengambilan
  totalCost: number; // Total Modal Kulak
  totalProfit: number; // Total Laba Bersih
} {
  const isMeterOrLembar = isMeterOrLembarUnit(item.unit, item.unitMode);
  const qty = Number(item.qty) || 0;
  const unitPrice = Number(item.price) || 0;
  const costPriceKulak = product ? (product.costPrice ?? product.hargaKulak ?? 0) : 0;
  const rollPakQty = getProductRollPakQty(product);

  let costPerUnit = 0;
  let profitPerUnit = 0;

  if (isMeterOrLembar) {
    // Rumus: Modal per Meter/Lembar = Harga Kulak : Jumlah per Roll/Pak
    costPerUnit = rollPakQty > 0 ? costPriceKulak / rollPakQty : costPriceKulak;
    // Rumus: Laba Meter/Lembaran = Harga Meter Grosir - (Harga Kulak : Jumlah per Roll/Pak)
    profitPerUnit = unitPrice - costPerUnit;
  } else {
    // Rumus: Modal per Roll/Pak = Harga Kulak
    costPerUnit = costPriceKulak;
    // Rumus: Laba Roll/Pak = Harga Agen - Harga Kulak
    profitPerUnit = unitPrice - costPriceKulak;
  }

  const totalAmount = unitPrice * qty;
  const totalCost = costPerUnit * qty;
  const totalProfit = profitPerUnit * qty;

  return {
    isMeterOrLembar,
    qty,
    unitPrice,
    rollPakQty,
    costPriceKulak,
    costPerUnit,
    profitPerUnit,
    totalAmount,
    totalCost,
    totalProfit,
  };
}

/**
 * Menghitung harga modal (HPP) & laba bersih untuk item transaksi Penjualan Kasir
 */
export function calculateSalesItemCost(
  item: {
    productId?: string;
    code?: string;
    name?: string;
    qty?: number;
    quantity?: number;
    saleType?: string;
    lengthMeters?: number;
    widthMeters?: number;
    itemCount?: number;
    unit?: string;
    unitPrice?: number;
    totalPrice?: number;
  },
  product?: Product | null
): {
  costPerUnit: number;
  totalCost: number;
  itemProfit: number;
} {
  const effectiveQty = Number(item.qty ?? item.quantity) || 1;

  if (!product) {
    const itemTotalRevenue =
      item.totalPrice !== undefined && item.totalPrice !== null
        ? Number(item.totalPrice)
        : (Number(item.unitPrice) || 0) * effectiveQty;
    return {
      costPerUnit: 0,
      totalCost: 0,
      itemProfit: itemTotalRevenue,
    };
  }

  const costPriceKulak = product.costPrice ?? product.hargaKulak ?? 0;
  const isMeter =
    item.saleType === 'meter' ||
    item.saleType === 'lembar' ||
    isMeterOrLembarUnit(item.unit);

  let totalCost = 0;
  let costPerUnit = 0;

  if (isMeter) {
    const rollPakQty = getProductRollPakQty(product);
    costPerUnit = rollPakQty > 0 ? costPriceKulak / rollPakQty : costPriceKulak;

    if (
      typeof item.lengthMeters === 'number' &&
      typeof item.widthMeters === 'number' &&
      item.lengthMeters > 0 &&
      item.widthMeters > 0
    ) {
      const squareMetersPerItem = item.lengthMeters * item.widthMeters;
      const totalSquareMeters = squareMetersPerItem * (item.itemCount || effectiveQty);
      totalCost = costPerUnit * totalSquareMeters;
    } else {
      totalCost = costPerUnit * effectiveQty;
    }
  } else {
    costPerUnit = costPriceKulak;
    totalCost = costPerUnit * effectiveQty;
  }

  const itemTotalRevenue =
    item.totalPrice !== undefined && item.totalPrice !== null
      ? Number(item.totalPrice)
      : (Number(item.unitPrice) || 0) * effectiveQty;

  const itemProfit = itemTotalRevenue - totalCost;

  return {
    costPerUnit,
    totalCost,
    itemProfit,
  };
}

/**
 * Gets the standard default selling/buying price for a product in stock transactions
 * - Pada Pengambilan Bahan:
 *   - Roll / Pak: menggunakan Harga Agen pada Inventory Produk
 *   - Meter / Lembar: menggunakan Harga Meter Grosir pada Inventory Produk
 * - Pada Pembelian Bahan:
 *   - Roll / Pak: menggunakan Harga Kulak (HPP Modal)
 *   - Meter / Lembar: menggunakan Harga Meter Grosir / Kulak
 */
export function getProductStockPrice(
  product: Product,
  type: 'PEMBELIAN' | 'PENGAMBILAN',
  unitModeOrUnit: 'roll_pak' | 'meter_lembar' | string
): number {
  const isMeter =
    unitModeOrUnit === 'meter_lembar' ||
    (unitModeOrUnit !== 'roll_pak' && isMeterOrLembarUnit(unitModeOrUnit));

  if (type === 'PENGAMBILAN') {
    if (isMeter) {
      return (
        product.hargaMeterGrosir ??
        product.hargaGrosir ??
        product.price ??
        0
      );
    } else {
      return (
        product.hargaAgen ??
        product.price ??
        product.hargaUmum ??
        0
      );
    }
  } else {
    // Pembelian Bahan (HPP / Kulak dari supplier)
    if (isMeter) {
      return product.hargaMeterGrosir ?? 0;
    } else {
      return product.costPrice ?? product.hargaKulak ?? 0;
    }
  }
}

export function normalizeStockTransaction(
  tx: StockTransaction
): StockTransaction & { items: StockTransactionItem[]; totalQty: number; totalAmount: number } {
  let items: StockTransactionItem[] = [];

  if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
    items = tx.items.map((it) => ({
      ...it,
      qty: Number(it.qty) || 1,
      price: Number(it.price) || 0,
      totalPrice:
        it.totalPrice !== undefined && it.totalPrice !== null
          ? Number(it.totalPrice)
          : (Number(it.qty) || 1) * (Number(it.price) || 0),
    }));
  } else if (tx.productId || tx.productName) {
    const qty = Number(tx.qty) || 1;
    const price = Number(tx.price) || 0;
    const totalPrice =
      tx.totalPrice !== undefined && tx.totalPrice !== null
        ? Number(tx.totalPrice)
        : qty * price;

    items = [
      {
        id: tx.productId,
        productId: tx.productId || '',
        productName: tx.productName || 'Produk',
        qty,
        price,
        totalPrice,
        notes: tx.notes,
      },
    ];
  }

  const totalQty =
    tx.totalQty !== undefined && tx.totalQty !== null
      ? Number(tx.totalQty)
      : items.reduce((sum, it) => sum + it.qty, 0);

  const totalAmount =
    tx.totalAmount !== undefined && tx.totalAmount !== null
      ? Number(tx.totalAmount)
      : items.reduce((sum, it) => sum + it.totalPrice, 0);

  return {
    ...tx,
    items,
    totalQty,
    totalAmount,
  };
}

/**
 * Retroactively adjusts all saved transactions of type PENGAMBILAN according to the pricing rule:
 * - ROLL / PAK -> Harga Agen
 * - METER / LEMBAR -> Harga Meter Grosir
 */
export function applyNewPricingToStockTransactions(
  transactions: StockTransaction[],
  products: Product[]
): { transactions: StockTransaction[]; hasChanges: boolean; changedCount: number } {
  if (!transactions || transactions.length === 0 || !products || products.length === 0) {
    return { transactions: transactions || [], hasChanges: false, changedCount: 0 };
  }

  const productMap = new Map<string, Product>();
  const productByNameMap = new Map<string, Product>();
  const productByCodeMap = new Map<string, Product>();

  products.forEach((p) => {
    if (p.id) productMap.set(p.id, p);
    if (p.name) productByNameMap.set(p.name.trim().toLowerCase(), p);
    if (p.code) productByCodeMap.set(p.code.trim().toLowerCase(), p);
  });

  let changedCount = 0;
  let hasChanges = false;

  const updatedTransactions = transactions.map((rawTx) => {
    if (rawTx.type !== 'PENGAMBILAN') {
      return rawTx;
    }

    const norm = normalizeStockTransaction(rawTx);
    let txModified = false;

    const newItems: StockTransactionItem[] = norm.items.map((item) => {
      const prod =
        (item.productId ? productMap.get(item.productId) : null) ||
        (item.code ? productByCodeMap.get(item.code.trim().toLowerCase()) : null) ||
        (item.productName ? productByNameMap.get(item.productName.trim().toLowerCase()) : null);

      if (!prod) {
        return item;
      }

      const expectedPrice = getProductStockPrice(prod, 'PENGAMBILAN', item.unit || 'roll_pak');

      if (expectedPrice > 0 && Math.abs(item.price - expectedPrice) > 0.01) {
        txModified = true;
        const newQty = Number(item.qty) || 1;
        const newTotalPrice = newQty * expectedPrice;
        return {
          ...item,
          price: expectedPrice,
          totalPrice: newTotalPrice,
        };
      }

      return item;
    });

    if (txModified) {
      hasChanges = true;
      changedCount++;
      const newTotalAmount = newItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
      const newTotalQty = newItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

      return {
        ...norm,
        items: newItems,
        totalAmount: newTotalAmount,
        totalQty: newTotalQty,
        price: newItems[0]?.price,
        totalPrice: newTotalAmount,
      };
    }

    return rawTx;
  });

  return { transactions: updatedTransactions, hasChanges, changedCount };
}

export function generateStockTransactionNumber(type: 'PEMBELIAN' | 'PENGAMBILAN', dateStr: string): string {
  // Format: PB-YYMMDD-XXXX or PG-YYMMDD-XXXX
  const prefix = type === 'PEMBELIAN' ? 'PB' : 'PG';
  const cleanDate = (dateStr || new Date().toISOString().slice(0, 10)).replace(/[^0-9]/g, '').slice(2);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${cleanDate}-${rand}`;
}

export function groupStockTransactionsByBatch(
  transactions: StockTransaction[]
): (StockTransaction & { items: StockTransactionItem[]; totalQty: number; totalAmount: number })[] {
  const groupedMap = new Map<string, StockTransaction & { items: StockTransactionItem[]; totalQty: number; totalAmount: number }>();

  transactions.forEach((rawTx) => {
    const norm = normalizeStockTransaction(rawTx);

    // Grouping key: use transactionNumber or id if it is PB-... or PG-...
    // If it's a legacy STK_... ID, group items that share type + date + supplierName + (timestamp rounded to 10s)
    let groupKey = norm.transactionNumber || norm.id;
    if (groupKey.startsWith('STK_') && norm.timestamp) {
      const timeBucket = Math.floor(norm.timestamp / 15000); // 15-second window
      groupKey = `BATCH_${norm.type}_${norm.date}_${norm.supplierName.trim()}_${timeBucket}`;
    }

    if (groupedMap.has(groupKey)) {
      const existing = groupedMap.get(groupKey)!;
      existing.items.push(...norm.items);
      existing.totalQty += norm.totalQty;
      existing.totalAmount += norm.totalAmount;
      if (norm.shippingCost && norm.shippingCost > 0) {
        existing.shippingCost = (existing.shippingCost || 0) + norm.shippingCost;
      }
      if (!existing.notes && norm.notes) {
        existing.notes = norm.notes;
      }
    } else {
      groupedMap.set(groupKey, {
        ...norm,
        items: [...norm.items],
      });
    }
  });

  return Array.from(groupedMap.values());
}

