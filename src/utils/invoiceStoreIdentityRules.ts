/**
 * Aturan tunggal identitas penerbit invoice.
 *
 * Modul MURNI: hanya membaca tipe, dilarang mengimpor backend/peramban supaya
 * penjaga `npm run check:invoice-identity` dapat menjalankannya di Node.
 *
 * Identitas ini disimpan di tiga tempat (perangkat ini, server, dan salinan
 * bersama). Tanpa aturan penilai, tulisan terbaru dari satu tempat bisa diam-diam
 * menimpa isian yang belum disimpan atau hasil simpan yang pengiriman servernya gagal.
 */

import type { InvoiceStoreIdentity } from '../types';

/** Bagian yang boleh ikut berubah saat profil toko diubah dari halaman Pengaturan. */
export type StoreProfileIdentityFields = {
  storeName?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
};

/** Kunci yang bukan isi: waktu simpan tidak boleh membuat dua nilai dianggap berbeda. */
const VOLATILE_KEYS = new Set(['updatedAt']);

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        if (VOLATILE_KEYS.has(key)) return;
        out[key] = canonicalize(value[key]);
      });
    return out;
  }
  return value;
}

/** Tandai isi identitas, tanpa urutan kunci dan tanpa waktu simpan. */
export function identityContentKey(identity: Partial<InvoiceStoreIdentity> | null | undefined): string {
  if (!identity) return '';
  try {
    return JSON.stringify(canonicalize(identity));
  } catch {
    return String(identity);
  }
}

/** Dua nilai dianggap sama bila isinya sama, walau waktu simpannya berbeda. */
export function identityEquals(
  a: Partial<InvoiceStoreIdentity> | null | undefined,
  b: Partial<InvoiceStoreIdentity> | null | undefined
): boolean {
  return identityContentKey(a) === identityContentKey(b);
}

/** Waktu simpan; 0 berarti nilai belum pernah diberi stempel (data lama). */
export function identityStamp(identity: Partial<InvoiceStoreIdentity> | null | undefined): number {
  const stamp = Number((identity as InvoiceStoreIdentity | null | undefined)?.updatedAt);
  return Number.isFinite(stamp) && stamp > 0 ? stamp : 0;
}

/**
 * Apakah snapshot dari luar (server, perangkat lain, tab lain) boleh dipakai?
 *
 * Nilai berstempel lebih tua tidak pernah menimpa nilai berstempel lebih baru —
 * inilah penyebab "tersimpan lalu kembali ke identitas sebelumnya" bila kirim ke
 * server gagal dan isian lama dijemput kembali beberapa detik kemudian.
 */
export function incomingIdentityWins(
  current: Partial<InvoiceStoreIdentity> | null | undefined,
  incoming: Partial<InvoiceStoreIdentity> | null | undefined
): boolean {
  if (!incoming || !incoming.storeName) return false;
  if (identityEquals(current, incoming)) return false;
  const mine = identityStamp(current);
  const theirs = identityStamp(incoming);
  if (mine && !theirs) return false;
  if (!mine && theirs) return true;
  if (mine && theirs) return theirs > mine;
  // Dua-duanya tanpa stempel: salinan dari server menang saat sinkronisasi pertama.
  return true;
}

/** Nilai yang akan disimpan: isi apa adanya + waktu simpan sekarang. */
export function stampIdentityForSave(
  identity: InvoiceStoreIdentity,
  now: number = Date.now()
): InvoiceStoreIdentity {
  return { ...identity, updatedAt: now };
}

/**
 * Kop faktur mengikuti profil toko aktif, tetapi hanya empat bagian itu.
 * Nomor rekening, awalan dokumen, penanda tangan, dan dasar istilah tidak tersentuh.
 */
export function applyStoreProfileToIdentity(
  current: InvoiceStoreIdentity,
  store: StoreProfileIdentityFields
): InvoiceStoreIdentity {
  return {
    ...current,
    storeName: store.storeName || current.storeName,
    address: store.address || current.address,
    phone: store.phone || current.phone,
    logoUrl: store.logoUrl || current.logoUrl,
  };
}
