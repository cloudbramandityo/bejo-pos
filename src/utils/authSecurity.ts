/**
 * Internal Security & Role Authentication Module
 *
 * Kredensial DEVELOPER diverifikasi oleh server (lihat server/devAuth.ts).
 * File ini sengaja TIDAK menyimpan password apa pun; hanya identitas yang
 * bukan rahasia dan dipakai untuk mencegah akun developer dibuat lewat UI.
 */
import { AppUser } from '../types';

/** Username developer yang dicadangkan (bukan rahasia). */
export const DEVELOPER_USERNAME = 'langgo';

/**
 * Checks if a username is reserved by the core developer system
 */
export function isReservedDeveloperUsername(inputUser: string): boolean {
  if (!inputUser) return false;
  return inputUser.trim().toLowerCase() === DEVELOPER_USERNAME;
}

/**
 * Returns the permanent developer user profile.
 * `username` berasal dari sesi server agar tetap benar bila DEV_USERNAME diubah.
 */
export function getPermanentDeveloperUser(username: string = DEVELOPER_USERNAME): AppUser {
  const cleanUsername = String(username || '').trim().toLowerCase() || DEVELOPER_USERNAME;
  return {
    id: 'sys_core_developer',
    username: cleanUsername,
    password: '••••••••',
    name: 'Langgo (Developer on Duty)',
    role: 'DEVELOPER',
    phone: '',
    isActive: true,
    createdAt: 'Permanen Sistem'
  };
}
