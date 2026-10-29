import type { UserRole } from '../types';

/**
 * Wewenang mengubah atau menghapus data yang sudah tersimpan di area operasional
 * (SPK Cetak, Laporan, Invoice). DEVELOPER dan ADMIN boleh; role lain hanya
 * memakai alur kerja biasa.
 */
export function canManageRecords(role?: UserRole | string | null): boolean {
  const normalized = String(role ?? '').trim().toUpperCase();
  return normalized === 'DEVELOPER' || normalized === 'ADMIN';
}
