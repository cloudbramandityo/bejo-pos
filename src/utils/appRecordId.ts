/**
 * Aturan tunggal penggantian id aplikasi saat keluar/masuk server.
 *
 * Modul murni: tidak menyentuh koneksi server maupun localStorage, supaya
 * penjaga regresi dapat menjalankannya di Node.
 */

/** Field tempat id logis aplikasi disimpan di record server. */
export const LEGACY_ID_FIELD = 'legacyId';

/** Salinan utuh objek aplikasi; ikut membawa id asli. */
export const DATA_MIRROR_FIELD = 'data';

/** PocketBase hanya menerima primary key 15 karakter huruf/angka kecil. */
export const PB_ID_PATTERN = /^[a-z0-9]{15}$/;

/**
 * Kunci untuk server: "/" tidak dipakai karena sebagian pencarian memakai id
 * ini apa adanya. Bentuk aslinya tetap tersimpan di cermin `data`.
 */
export function toStoredDocId(appId: string): string {
  return String(appId || '').replace(/\//g, '_');
}

/**
 * Id yang boleh dipakai lagi oleh perangkat: cermin `data` lebih dulu karena ia
 * membawa id asli (termasuk yang memakai "/"), lalu legacyId untuk record yang
 * tidak punya cermin, lalu id PocketBase bila keduanya kosong.
 */
export function resolveAppId(record: any): string {
  if (!record) return '';

  const mirror = record[DATA_MIRROR_FIELD];
  if (mirror && typeof mirror === 'object' && typeof mirror.id === 'string' && mirror.id) {
    return mirror.id;
  }

  if (typeof record[LEGACY_ID_FIELD] === 'string' && record[LEGACY_ID_FIELD]) {
    return record[LEGACY_ID_FIELD];
  }

  return typeof record.id === 'string' ? record.id : '';
}
