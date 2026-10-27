/**
 * Hash password server-side memakai scrypt bawaan Node (tanpa dependency baru).
 *
 * Format tersimpan:
 *   scrypt$N$r$p$<salt base64>$<hash base64>
 *
 * Hash aman disimpan di `.env` karena tidak bisa dibalik menjadi password.
 * Plaintext lama (`DEV_PASSWORD` / `JOURNAL_DEV_PASSWORD`) tetap diterima
 * sebagai fallback agar migrasi tidak memutus login yang sedang berjalan.
 */
import crypto from 'crypto';

const PREFIX = 'scrypt';
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const COST = { N: 16384, r: 8, p: 1 };
const MAX_ALLOWED_N = 1 << 20;

type ScryptOptions = {
  N: number;
  r: number;
  p: number;
  maxmem: number;
};

function scryptOptions(N: number, r: number, p: number): ScryptOptions {
  // scrypt butuh 128*N*r byte; maxmem default 32MB hanya cukup untuk N=16384.
  const memory = 128 * N * r;
  return { N, r, p, maxmem: Math.max(64 * 1024 * 1024, memory * 2) };
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function isPasswordHash(stored: string): boolean {
  return String(stored || '').startsWith(`${PREFIX}$`);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await deriveKey(password, salt, KEY_BYTES, scryptOptions(COST.N, COST.r, COST.p));
  return [
    PREFIX,
    COST.N,
    COST.r,
    COST.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Menerima hash scrypt maupun plaintext lama. Nilai kosong selalu gagal.
 * Parameter dari `.env` divalidasi agar hash rusak tidak membuat proses berat.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!password || !stored) return false;
  if (!isPasswordHash(stored)) return safeEqual(password, stored);

  const parts = stored.split('$');
  if (parts.length !== 6) return false;

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N < 2 || N > MAX_ALLOWED_N || (N & (N - 1)) !== 0) return false;
  if (r < 1 || r > 32 || p < 1 || p > 16) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltRaw, 'base64');
    expected = Buffer.from(hashRaw, 'base64');
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length < 16) return false;

  try {
    const actual = await deriveKey(password, salt, expected.length, scryptOptions(N, r, p));
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
