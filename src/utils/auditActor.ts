import type { AppUser } from '../types';

/**
 * Nama yang ditulis pada jejak perubahan ("diubah oleh").
 *
 * Nilainya selalu dari akun yang sedang login. Dulu modul pajak menulis
 * "Langgo Bramandityo (DEVELOPER)" apa pun yang terjadi, sehingga perubahan
 * buatan ADMIN atau OWNER tercatat atas nama developer.
 */
export function describeAuditActor(user?: AppUser | null): string {
  const name = String(user?.name || user?.username || '').trim();
  const role = String(user?.role || '').trim().toUpperCase();
  if (!name) return role || 'Pengguna';
  return role ? `${name} (${role})` : name;
}
