import type { UserRole } from '../types';

/**
 * Aturan tunggal hak akses modul Jurnal — dipakai UI dan server bersama-sama.
 *
 * Baca: DEVELOPER, OWNER, ADMIN. Tulis: hanya DEVELOPER.
 * Sebelumnya server menuntut cookie sesi DEVELOPER untuk membaca juga, sehingga
 * ADMIN/OWNER di perangkat lain melihat menu Jurnal tapi datanya kosong.
 */
export type JournalAccess = 'edit' | 'view' | 'none';

function normalizeRole(role?: UserRole | string | null): string {
  return String(role ?? '').trim().toUpperCase();
}

export function canReadJournal(role?: UserRole | string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'DEVELOPER' || normalized === 'OWNER' || normalized === 'ADMIN';
}

export function canWriteJournal(role?: UserRole | string | null): boolean {
  return normalizeRole(role) === 'DEVELOPER';
}

export function getJournalAccess(role?: UserRole | string | null): JournalAccess {
  if (canWriteJournal(role)) return 'edit';
  if (canReadJournal(role)) return 'view';
  return 'none';
}
