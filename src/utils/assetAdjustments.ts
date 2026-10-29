/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import { AppUser, AssetAdjustment, AssetAdjustmentKind, Product } from '../types';
import { assetUnitCost, isCountedInStoreAsset, toDayKey } from './assetTrend';

/** Nilai aset satu produk (0 bila tidak dihitung sebagai aset toko) */
export function productAssetValue(product: Product | null | undefined): number {
  if (!product) return 0;
  if (!isCountedInStoreAsset(product)) return 0;
  return assetUnitCost(product) * (Number(product.stock) || 0);
}

export interface AdjustmentActor {
  id?: string;
  name?: string;
  role?: string;
}

interface AdjustmentContext {
  source: AssetAdjustment['source'];
  actor?: AdjustmentActor | AppUser | null;
  date?: string;
  time?: string;
  referenceId?: string;
  notes?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

let idSeed = 0;
function adjustmentId(kind: AssetAdjustmentKind, timestamp: number): string {
  idSeed += 1;
  return `ADJ_${kind}_${timestamp}_${idSeed.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function nowParts(): { date: string; time: string; timestamp: number } {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: toDayKey(d),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    timestamp: d.getTime()
  };
}

function makeRow(
  kind: AssetAdjustmentKind,
  product: Product | null,
  valueDelta: number,
  context: AdjustmentContext,
  extras: Partial<AssetAdjustment> = {}
): AssetAdjustment | null {
  const delta = round2(valueDelta);
  if (!delta) return null;

  const parts = nowParts();
  const actor = context.actor || null;
  return {
    id: adjustmentId(kind, parts.timestamp),
    date: context.date || parts.date,
    time: context.time || parts.time,
    timestamp: parts.timestamp,
    productId: product?.id,
    productName: product?.name || 'Perubahan aset toko',
    kind,
    unit: product?.unit,
    source: context.source,
    referenceId: context.referenceId,
    actorId: actor && 'id' in actor ? (actor as { id?: string }).id : undefined,
    actorName: actor?.name,
    actorRole: actor && 'role' in actor ? (actor as { role?: string }).role : undefined,
    notes: context.notes,
    ...extras,
    valueDelta: delta
  };
}

/**
 * Perbedaan nilai aset antara dua kondisi produk.
 *
 * Dekomposisi (supaya totalnya tetap sama persis dengan selisih nilai):
 * - efek harga kulak dihitung pada stok lama:  (hargaBaru - hargaLama) x stokLama
 * - efek perubahan stok dihitung pada harga baru: hargaBaru x (stokBaru - stokLama)
 *
 * Bila produk baru masuk atau keluar dari perhitungan aset (mis. centang
 * 'isAssetToko' diubah), seluruh nilainya dicatat sebagai satu penyesuaian.
 */
export function adjustmentsFromProductEdit(
  prevProduct: Product | null,
  nextProduct: Product | null,
  context: AdjustmentContext
): AssetAdjustment[] {
  const rows: AssetAdjustment[] = [];

  if (!prevProduct && nextProduct) {
    const row = makeRow('PRODUK_BARU', nextProduct, productAssetValue(nextProduct), context, {
      qtyAfter: Number(nextProduct.stock) || 0,
      unitCostAfter: assetUnitCost(nextProduct)
    });
    if (row) rows.push(row);
    return rows;
  }

  if (prevProduct && !nextProduct) {
    const row = makeRow('PRODUK_HAPUS', prevProduct, -productAssetValue(prevProduct), context, {
      qtyBefore: Number(prevProduct.stock) || 0,
      unitCostBefore: assetUnitCost(prevProduct)
    });
    if (row) rows.push(row);
    return rows;
  }

  if (!prevProduct || !nextProduct) return rows;

  const countedBefore = isCountedInStoreAsset(prevProduct);
  const countedAfter = isCountedInStoreAsset(nextProduct);

  if (!countedBefore && !countedAfter) return rows;

  const stockBefore = Number(prevProduct.stock) || 0;
  const stockAfter = Number(nextProduct.stock) || 0;
  const costBefore = assetUnitCost(prevProduct);
  const costAfter = assetUnitCost(nextProduct);

  if (countedBefore !== countedAfter) {
    const delta = countedAfter
      ? productAssetValue(nextProduct)
      : -productAssetValue(prevProduct);
    const row = makeRow('PERHITUNGAN_ASET', nextProduct, delta, context, {
      qtyBefore: stockBefore,
      qtyAfter: stockAfter,
      unitCostBefore: costBefore,
      unitCostAfter: costAfter,
      notes: context.notes || (countedAfter
        ? 'Produk mulai dihitung sebagai aset toko'
        : 'Produk tidak lagi dihitung sebagai aset toko')
    });
    if (row) rows.push(row);
    return rows;
  }

  if (costBefore !== costAfter) {
    const row = makeRow('HARGA_KULAK', nextProduct, (costAfter - costBefore) * stockBefore, context, {
      qtyBefore: stockBefore,
      qtyAfter: stockAfter,
      unitCostBefore: costBefore,
      unitCostAfter: costAfter
    });
    if (row) rows.push(row);
  }

  if (stockBefore !== stockAfter) {
    const row = makeRow('KOREKSI_STOK', nextProduct, costAfter * (stockAfter - stockBefore), context, {
      qtyBefore: stockBefore,
      qtyAfter: stockAfter,
      unitCostBefore: costBefore,
      unitCostAfter: costAfter
    });
    if (row) rows.push(row);
  }

  return rows;
}

/**
 * Hanya efek perubahan harga kulak, dihitung pada stok sebelum edit.
 *
 * Dipakai oleh jalur tulis yang sekaligus mengubah stok DAN sudah menulis mutasi stok
 * (Pembelian/Pengambilan agen). Selisih stoknya sudah dihitung dari mutasi tersebut,
 * jadi bila efek stok ikut dicatat nilai aset akan terhitung dua kali.
 */
export function adjustmentsFromCostEdit(
  prevProduct: Product | null,
  nextProduct: Product | null,
  context: AdjustmentContext
): AssetAdjustment[] {
  if (!prevProduct || !nextProduct) return [];
  if (!isCountedInStoreAsset(prevProduct) || !isCountedInStoreAsset(nextProduct)) return [];

  const costBefore = assetUnitCost(prevProduct);
  const costAfter = assetUnitCost(nextProduct);
  if (costBefore === costAfter) return [];

  const stockBefore = Number(prevProduct.stock) || 0;
  const row = makeRow('HARGA_KULAK', nextProduct, (costAfter - costBefore) * stockBefore, context, {
    qtyBefore: stockBefore,
    qtyAfter: Number(nextProduct.stock) || 0,
    unitCostBefore: costBefore,
    unitCostAfter: costAfter
  });
  return row ? [row] : [];
}

/**
 * Perbedaan stok antara dua daftar produk, untuk kejadian yang tidak menulis
 * mutasi stok (mis. penjualan kasir yang mengurangi stok bahan).
 */
export function adjustmentsFromStockDiff(
  prevProducts: Product[],
  nextProducts: Product[],
  kind: AssetAdjustmentKind,
  context: AdjustmentContext
): AssetAdjustment[] {
  const nextById = new Map(nextProducts.map((p) => [p.id, p]));
  const rows: AssetAdjustment[] = [];

  prevProducts.forEach((prev) => {
    if (!isCountedInStoreAsset(prev)) return;
    const next = nextById.get(prev.id);
    if (!next || !isCountedInStoreAsset(next)) return;

    const stockBefore = Number(prev.stock) || 0;
    const stockAfter = Number(next.stock) || 0;
    if (stockBefore === stockAfter) return;

    const row = makeRow(kind, next, assetUnitCost(next) * (stockAfter - stockBefore), context, {
      qtyBefore: stockBefore,
      qtyAfter: stockAfter,
      unitCostBefore: assetUnitCost(prev),
      unitCostAfter: assetUnitCost(next)
    });
    if (row) rows.push(row);
  });

  return rows;
}

/** Satu baris agregat untuk kejadian lintas produk (pulihkan backup). */
export function aggregateAdjustment(
  prevTotal: number,
  nextTotal: number,
  context: AdjustmentContext,
  productName = 'Pulihkan cadangan seluruh data'
): AssetAdjustment | null {
  return makeRow('PULIHKAN_BACKUP', null, nextTotal - prevTotal, { ...context, source: 'RESTORE' }, {
    productName
  });
}
