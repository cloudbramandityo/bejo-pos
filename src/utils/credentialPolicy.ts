/**
 * Kebijakan kredensial akun staf.
 *
 * Dipakai UI (validasi awal) DAN server (penegakan akhir). Aturan ini sengaja
 * tidak bergantung pada mode situs: password yang sudah dikenal publik
 * (password bawaan repo, tebakan umum) ditolak baik saat membuat akun baru
 * maupun saat mengganti password.
 */

export const MIN_PASSWORD_LENGTH = 10;

/** Password sementara dari Developer: cukup tidak kosong, wajib diganti saat login. */
export const MIN_TEMPORARY_PASSWORD_LENGTH = 6;

/** Batas data URL avatar yang disimpan di direktori akun (JSON `data`). */
export const MAX_AVATAR_DATA_URL_LENGTH = 120000;

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/** Pesan kesalahan format username, atau null bila valid. */
export function checkUsernameFormat(username: string): string | null {
  if (!USERNAME_PATTERN.test(String(username ?? '').trim().toLowerCase())) {
    return 'Username harus 3-32 karakter (huruf, angka, titik, garis bawah, atau strip) dan diawali huruf/angka.';
  }
  return null;
}

/** Topeng password dari server: berarti "tidak diganti", bukan password asli. */
export const PASSWORD_MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

/**
 * Password bawaan aplikasi (pernah ikut ter-bundle) dan tebakan paling umum.
 * Semua dibandingkan dalam bentuk ternormalisasi: huruf kecil, alfanumerik.
 */
const PUBLIC_PASSWORDS = [
  'admin123',
  'admin1234',
  'kasir123',
  'kasir1234',
  'agen123',
  'agen1234',
  'spk123',
  'desain123',
  'finishing123',
  'bejo123',
  'bejo1234',
  'bejo2024',
  'bejo2025',
  'bejo2026',
  'password',
  'password123',
  'passw0rd',
  'administrator',
  'welcome123',
  'letmein123',
  'iloveyou',
  'indonesia',
  'rahasia',
  'rahasia123',
  'qwerty123',
  'qwertyuiop',
  '12345678',
  '123456789',
  '1234567890',
];

/** Hanya fragmen minimal sepanjang ini yang dicek sebagai bagian password. */
const MIN_FRAGMENT_LENGTH = 6;

export interface CredentialProblem {
  code: 'WEAK_PASSWORD' | 'PUBLIC_PASSWORD' | 'PASSWORD_FOLLOWS_USERNAME';
  message: string;
}

function flatten(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isPasswordMasked(password: string): boolean {
  return /^\u2022+$/.test(String(password ?? '').trim());
}

/** Password persis sama dengan daftar publik (dipakai juga saat login). */
export function isPubliclyKnownPassword(password: string): boolean {
  const raw = String(password ?? '').trim().toLowerCase();
  if (!raw) return false;
  const flat = flatten(raw);
  return PUBLIC_PASSWORDS.some((known) => raw === known || flat === known);
}

/** Password yang MEMUAT password publik (mis. "Admin12345!") juga ditolak. */
function containsPublicPassword(password: string): boolean {
  const flat = flatten(password);
  return PUBLIC_PASSWORDS.some(
    (known) => known.length >= MIN_FRAGMENT_LENGTH && flat.includes(known)
  );
}

/**
 * Validasi password untuk username tertentu.
 * `null` berarti lolos; selain itu berisi kode + pesan siap tampil.
 */
export function checkPasswordPolicy(
  username: string,
  password: string
): CredentialProblem | null {
  const raw = String(password ?? '').trim();
  if (isPubliclyKnownPassword(raw) || containsPublicPassword(raw)) {
    return {
      code: 'PUBLIC_PASSWORD',
      message:
        'Password ini sudah dikenal publik (mis. admin123, agen123). Pilih password lain.',
    };
  }
  if (raw.length < MIN_PASSWORD_LENGTH) {
    return {
      code: 'WEAK_PASSWORD',
      message: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`,
    };
  }
  if (!/[a-z]/i.test(raw) || !/\d/.test(raw)) {
    return {
      code: 'WEAK_PASSWORD',
      message: 'Password harus memuat huruf dan angka.',
    };
  }
  if (/^(.)\1+$/.test(raw)) {
    return {
      code: 'WEAK_PASSWORD',
      message: 'Password tidak boleh satu karakter yang diulang.',
    };
  }
  const account = flatten(username);
  const candidate = flatten(raw);
  if (account.length >= 3 && (candidate === account || candidate.startsWith(account))) {
    return {
      code: 'PASSWORD_FOLLOWS_USERNAME',
      message: 'Password tidak boleh sama dengan atau diawali username akun.',
    };
  }
  return null;
}

/** Validasi password sementara (dari Developer). Aturan kuat tidak berlaku. */
export function checkTemporaryPassword(password: string): CredentialProblem | null {
  const raw = String(password ?? '').trim();
  if (raw.length < MIN_TEMPORARY_PASSWORD_LENGTH) {
    return {
      code: 'WEAK_PASSWORD',
      message: `Password sementara minimal ${MIN_TEMPORARY_PASSWORD_LENGTH} karakter.`,
    };
  }
  return null;
}

/** Password acak kuat untuk tombol preset (tidak pernah memakai default publik). */
export function generateStrongPassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const chars: string[] = [];
  const random = (max: number): number => {
    const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint32Array(1);
      cryptoObj.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  };
  for (let i = 0; i < length; i += 1) chars.push(alphabet[random(alphabet.length)]);
  // Jamin mengandung huruf dan angka tanpa mengurangi panjang.
  chars[0] = 'ABCDEFGHJKLMNPQRSTUVWXYZ'[random(24)];
  chars[1] = '23456789'[random(8)];
  return chars.join('');
}
