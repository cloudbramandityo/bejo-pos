/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import { Product, ProductCategoryItem } from '../types';

/**
 * Checks if a product belongs to the "Bahan / Stiker Vinyl" category group.
 * Matches standard IDs (vinyl_meteran, vinyl_roll, bahan, stiker_vinyl) 
 * as well as custom user-created category names containing 'vinyl', 'bahan', 'stiker', 'oracal', 'decofix', etc.
 */
export function isMaterialOrVinylProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  if (!product) return false;
  const cat = (product.category || '').toLowerCase().trim();
  const foundCat = productCategories?.find(
    (c) => c.id.toLowerCase() === cat || c.name.toLowerCase() === cat
  );
  const catName = (foundCat?.name || '').toLowerCase().trim();

  // Explicit match with services to exclude
  if (
    cat === 'digital_printing' ||
    cat === 'laser_cutting' ||
    cat === 'production_supplies' ||
    cat === 'paket' ||
    catName.includes('digital printing') ||
    catName.includes('laser cutting') ||
    catName.includes('production supplies') ||
    catName.includes('paket')
  ) {
    return false;
  }

  // Explicit ID matches for vinyl / materials
  if (
    cat === 'vinyl_meteran' ||
    cat === 'vinyl_roll' ||
    cat === 'bahan' ||
    cat === 'stiker_vinyl' ||
    cat === 'bahan_stiker' ||
    cat === 'bahan_vinyl' ||
    cat === 'vinyl' ||
    cat === 'stiker'
  ) {
    return true;
  }

  // Name / ID pattern matching
  if (
    cat.includes('vinyl') ||
    cat.includes('bahan') ||
    cat.includes('roll') ||
    cat.includes('meteran') ||
    cat.includes('skotlet') ||
    cat.includes('oracal') ||
    cat.includes('decofix') ||
    cat.includes('maxdecal') ||
    cat.includes('seiko') ||
    cat.includes('derex') ||
    cat.includes('profix') ||
    catName.includes('vinyl') ||
    catName.includes('bahan') ||
    catName.includes('stiker vinyl')
  ) {
    return true;
  }

  // If the product unit is meter or roll and not digital printing / laser cutting, treat as material
  if (
    (product.unit === 'meter' || product.unit === 'roll') &&
    !cat.includes('digital') &&
    !cat.includes('laser')
  ) {
    return true;
  }

  return false;
}

export function isDigitalPrintingProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  if (!product) return false;
  const cat = (product.category || '').toLowerCase().trim();
  const foundCat = productCategories?.find(
    (c) => c.id.toLowerCase() === cat || c.name.toLowerCase() === cat
  );
  const catName = (foundCat?.name || '').toLowerCase().trim();

  // Exclude laser and materials explicitly
  if (
    cat === 'laser_cutting' ||
    cat === 'laser' ||
    cat === 'vinyl_meteran' ||
    cat === 'vinyl_roll' ||
    cat === 'bahan' ||
    cat === 'stiker_vinyl' ||
    catName.includes('laser') ||
    catName.includes('vinyl') ||
    catName.includes('bahan')
  ) {
    return false;
  }

  return (
    cat === 'digital_printing' ||
    cat === 'digital_print' ||
    cat === 'cetak' ||
    cat === 'printing' ||
    cat === 'digital' ||
    cat === 'vinyl_sticker' ||
    cat === 'custom_sticker' ||
    cat === 'custom_stiker' ||
    cat.includes('digital') ||
    cat.includes('cetak') ||
    catName.includes('digital') ||
    catName.includes('cetak') ||
    catName.includes('printing') ||
    catName.includes('vinyl sticker') ||
    catName.includes('custom stiker')
  );
}

export function isLaserCuttingProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  if (!product) return false;
  const cat = (product.category || '').toLowerCase().trim();
  const foundCat = productCategories?.find(
    (c) => c.id.toLowerCase() === cat || c.name.toLowerCase() === cat
  );
  const catName = (foundCat?.name || '').toLowerCase().trim();

  // Exclude materials & vinyl explicitly
  if (
    cat === 'vinyl_meteran' ||
    cat === 'vinyl_roll' ||
    cat === 'bahan' ||
    cat === 'stiker_vinyl' ||
    cat === 'digital_printing' ||
    catName.includes('vinyl') ||
    catName.includes('bahan') ||
    catName.includes('digital printing')
  ) {
    return false;
  }

  return (
    cat === 'laser_cutting' ||
    cat === 'laser' ||
    cat === 'jasa_laser' ||
    cat === 'laser_cutting_plywood' ||
    cat === 'plywood' ||
    cat === 'akrilik' ||
    cat.includes('laser_cutting') ||
    (cat.includes('laser') && cat.includes('cut')) ||
    catName.includes('laser') ||
    catName.includes('cutting plywood')
  );
}

/**
 * Checks if a product belongs to the "Cetak & Laser" (Digital Printing / Laser Cutting) category group.
 */
export function isPrintOrLaserProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  return isDigitalPrintingProduct(product, productCategories) || isLaserCuttingProduct(product, productCategories);
}

export function isCustomStickerProduct(product: Product): boolean {
  const cat = (product.category || '').toLowerCase().trim();
  return (
    cat === 'vinyl_sticker' ||
    cat === 'custom_sticker' ||
    cat.includes('vinyl_sticker') ||
    cat.includes('custom') ||
    cat.includes('a3') ||
    cat.includes('label')
  );
}

/**
 * Checks if a product belongs strictly to category "Bahan"
 */
export function isBahanProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  if (!product) return false;
  const cat = (product.category || '').toLowerCase().trim();
  const foundCat = productCategories?.find(
    (c) => c.id.toLowerCase() === cat || c.name.toLowerCase() === cat
  );
  const catName = (foundCat?.name || '').toLowerCase().trim();

  if (cat === 'bahan' || cat === 'bahan_stiker' || cat === 'bahan_vinyl') return true;
  if (catName === 'bahan' || (catName.includes('bahan') && !catName.includes('stiker vinyl'))) return true;

  // If categorized as material but not specific to vinyl/skotlet
  if (isMaterialOrVinylProduct(product, productCategories)) {
    if (cat.includes('bahan') || catName.includes('bahan')) return true;
    if (!isStikerVinylProduct(product, productCategories)) return true;
  }
  return false;
}

/**
 * Checks if a product belongs to category "Stiker Vinyl"
 */
export function isStikerVinylProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  if (!product) return false;
  const cat = (product.category || '').toLowerCase().trim();
  const foundCat = productCategories?.find(
    (c) => c.id.toLowerCase() === cat || c.name.toLowerCase() === cat
  );
  const catName = (foundCat?.name || '').toLowerCase().trim();

  if (
    cat === 'stiker_vinyl' ||
    cat === 'vinyl_meteran' ||
    cat === 'vinyl_roll' ||
    cat === 'vinyl' ||
    cat === 'stiker' ||
    catName.includes('stiker vinyl') ||
    catName.includes('vinyl') ||
    cat.includes('vinyl') ||
    cat.includes('skotlet') ||
    cat.includes('oracal') ||
    cat.includes('decofix') ||
    cat.includes('maxdecal') ||
    cat.includes('seiko') ||
    cat.includes('derex') ||
    cat.includes('profix')
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if a product belongs to category "Production Supplies"
 */
export function isProductionSuppliesProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  if (!product) return false;
  const cat = (product.category || '').toLowerCase().trim();
  const foundCat = productCategories?.find(
    (c) => c.id.toLowerCase() === cat || c.name.toLowerCase() === cat
  );
  const catName = (foundCat?.name || '').toLowerCase().trim();

  if (
    cat === 'production_supplies' ||
    cat === 'supplies' ||
    cat === 'production' ||
    catName.includes('production supplies') ||
    catName.includes('supplies') ||
    catName.includes('perlengkapan produksi') ||
    catName.includes('alat produksi')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a product belongs to category "Paket"
 */
export function isPaketProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  if (!product) return false;
  const cat = (product.category || '').toLowerCase().trim();
  const foundCat = productCategories?.find(
    (c) => c.id.toLowerCase() === cat || c.name.toLowerCase() === cat
  );
  const catName = (foundCat?.name || '').toLowerCase().trim();
  const unit = (product.unit || '').toLowerCase().trim();
  const saleType = ((product as any).saleType || '').toLowerCase().trim();

  if (
    cat === 'paket' ||
    cat === 'paket_hemat' ||
    cat === 'package' ||
    cat === 'bundle' ||
    catName.includes('paket') ||
    catName.includes('bundle') ||
    catName.includes('package') ||
    unit === 'paket' ||
    saleType === 'paket'
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a product belongs to the eligible categories for stock transactions:
 * 1. Bahan
 * 2. Stiker Vinyl
 * 3. Production Supplies
 *
 * Explicitly excludes Digital Printing, Laser Cutting, Paket, and other service categories.
 */
export function isStockEligibleProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  if (!product) return false;

  // Explicitly reject Digital Printing, Laser Cutting, and Paket
  if (
    isDigitalPrintingProduct(product, productCategories) ||
    isLaserCuttingProduct(product, productCategories) ||
    isPaketProduct(product, productCategories)
  ) {
    return false;
  }

  // Accept if it matches Bahan, Stiker Vinyl, or Production Supplies
  if (
    isBahanProduct(product, productCategories) ||
    isStikerVinylProduct(product, productCategories) ||
    isProductionSuppliesProduct(product, productCategories) ||
    isMaterialOrVinylProduct(product, productCategories)
  ) {
    return true;
  }

  const cat = (product.category || '').toLowerCase().trim();
  const foundCat = productCategories?.find(
    (c) => c.id.toLowerCase() === cat || c.name.toLowerCase() === cat
  );
  const catName = (foundCat?.name || '').toLowerCase().trim();

  const allowedKeywords = [
    'bahan',
    'vinyl',
    'stiker',
    'production',
    'supplies',
    'skotlet',
    'oracal',
    'decofix',
    'maxdecal',
    'seiko',
    'derex',
    'profix',
    'perlengkapan'
  ];

  return allowedKeywords.some((k) => cat.includes(k) || catName.includes(k));
}

/**
 * Action button label in Agent Portal (Katalog Database & Stok Produk):
 * - "Ambil Bahan Agen" for categories: Bahan, Stiker Vinyl, Production Supplies
 * - "Pesan Jasa Cetak" for categories: Digital Printing, Paket, Laser Cutting
 */
export function getAgentProductActionLabel(
  product: Product,
  productCategories?: ProductCategoryItem[]
): 'Ambil Bahan Agen' | 'Pesan Jasa Cetak' {
  if (!product) return 'Ambil Bahan Agen';
  const cat = (product.category || '').toLowerCase().trim();
  const foundCat = productCategories?.find(
    (c) => c.id.toLowerCase() === cat || c.name.toLowerCase() === cat
  );
  const catName = (foundCat?.name || '').toLowerCase().trim();

  // 1. Pesan Jasa Cetak: Digital Printing, Paket, Laser Cutting
  if (
    isDigitalPrintingProduct(product, productCategories) ||
    isPaketProduct(product, productCategories) ||
    isLaserCuttingProduct(product, productCategories) ||
    cat === 'digital_printing' ||
    cat === 'laser_cutting' ||
    cat === 'paket' ||
    catName === 'digital printing' ||
    catName === 'laser cutting' ||
    catName === 'paket'
  ) {
    return 'Pesan Jasa Cetak';
  }

  // 2. Ambil Bahan Agen: Bahan, Stiker Vinyl, Production Supplies
  return 'Ambil Bahan Agen';
}

export function isAgentJasaCetakProduct(
  product: Product,
  productCategories?: ProductCategoryItem[]
): boolean {
  return getAgentProductActionLabel(product, productCategories) === 'Pesan Jasa Cetak';
}
