import type { UserRole } from '../types';

/**
 * Wewenang mengubah atau menghapus data yang sudah tersimpan di tab SPK Cetak.
 * DEVELOPER dan ADMIN boleh; role lain hanya memakai alur kerja biasa.
 */
export function canManageRecords(role?: UserRole | string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'DEVELOPER' || normalized === 'ADMIN';
}

/**
 * Wewenang memakai seluruh fitur dan isi pada tab Agen, Laporan (Laporan
 * Penjualan, Rekonsiliasi), Invoice, Pajak, dan Marketing: DEVELOPER, ADMIN,
 * dan OWNER.
 *
 * OWNER sengaja tidak dimasukkan ke `canManageRecords` di atas karena wewenang
 * itu juga dipakai tab SPK Cetak, yang aturannya masih DEVELOPER + ADMIN.
 * Menyimpan modul Jurnal tetap khusus DEVELOPER (`journalAccessPolicy.ts`).
 */
export function canManageBusinessData(role?: UserRole | string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'DEVELOPER' || normalized === 'ADMIN' || normalized === 'OWNER';
}

function normalizeRole(role?: UserRole | string | null): string {
  return String(role ?? '').trim().toUpperCase();
}
