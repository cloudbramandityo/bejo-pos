/**
 * Sesi dashboard (POS) terverifikasi server.
 *
 * Sebelumnya akun operasional diverifikasi di browser memakai password yang
 * ikut tersimpan di bundle/localStorage. Modul ini memindahkan keputusan login
 * ke server:
 *   - DEVELOPER : password hash scrypt di .env (DEV_PASSWORD_HASH)
 *   - STAF      : dibaca dari koleksi `users` PocketBase memakai kredensial
 *                 admin/sync yang HANYA ada di server
 *
 * Hasil login adalah cookie HttpOnly bertanda tangan HMAC. Endpoint privat
 * (/api/invoices, /api/backend, /api/lan, /api/marketing, AI, broker PocketBase)
 * menolak request tanpa cookie ini, termasuk pada mode situs publik.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import PocketBase from 'pocketbase/cjs';
import {
  clearDevSession,
  getDevUsername,
  getSessionSecret,
  issueDevSession,
  verifyDevCredentials,
} from './devAuth';

const COOKIE_NAME = 'bejo_pos_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60_000;

/**
 * Password default yang ikut ter-bundle di aplikasi. Pada mode publik password
 * ini dianggap sudah bocor, sehingga login dari internet ditolak sampai
 * pemilik akun menggantinya.
 */
const KNOWN_DEFAULT_PASSWORDS = new Set([
  'admin123',
  'kasir123',
  'agen123',
  'spk123',
  'desain123',
  'finishing123',
  'bejo123',
  'password',
  'password123',
  '12345678',
]);

class PosAuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'AUTH_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface PosSessionPayload {
  sub: string;
  uid: string;
  uname: string;
  name: string;
  role: string;
  exp: number;
}

interface StaffRecord extends Record<string, unknown> {
  id?: string;
  email?: string;
  username?: string;
  name?: string;
  role?: string;
  isActive?: boolean;
  appPassword?: string;
  legacyId?: string;
  data?: Record<string, unknown>;
}

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

function truthy(value: string): boolean {
  return /^(1|true|yes|on)$/i.test(value.trim());
}

export function isPublicSite(): boolean {
  return truthy(env('PUBLIC_SITE'));
}

function pbUpstream(): string {
  return env('POCKETBASE_UPSTREAM') || 'http://127.0.0.1:8090';
}

function adminConfigured(): boolean {
  return Boolean(env('PB_ADMIN_EMAIL') && env('PB_ADMIN_PASSWORD'));
}

function syncConfigured(): boolean {
  return Boolean(env('PB_SYNC_EMAIL') && env('PB_SYNC_PASSWORD'));
}

export function staffLoginConfigured(): boolean {
  return adminConfigured() || syncConfigured();
}

function developerLoginConfigured(): boolean {
  return Boolean(
    env('DEV_PASSWORD_HASH') || env('DEV_PASSWORD') || env('JOURNAL_DEV_PASSWORD')
  );
}

function allowDefaultStaffPasswords(): boolean {
  return truthy(env('ALLOW_DEFAULT_STAFF_PASSWORDS'));
}

/* ---------------------------------------------------------------------- */
/*  Cookie & sesi                                                          */
/* ---------------------------------------------------------------------- */
function readCookie(req: Request, name: string): string {
  const header = req.headers.cookie;
  if (!header) return '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return '';
}

function isHttps(req: Request): boolean {
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return req.secure || forwarded === 'https';
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function signSession(payload: PosSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isHttps(req) ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`
  );
}

function clearSessionCookie(req: Request, res: Response): void {
  const secure = isHttps(req) ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}

export function getPosSession(req: Request): PosSessionPayload | null {
  const token = readCookie(req, COOKIE_NAME);
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as PosSessionPayload;
    if (!payload.uid || !payload.uname || !payload.role) return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Middleware untuk endpoint privat. */
export function requirePosSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (getPosSession(req)) {
    next();
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(401).json({
    success: false,
    code: 'AUTH_REQUIRED',
    error: 'Silakan login ke dashboard terlebih dahulu.',
  });
}

/* ---------------------------------------------------------------------- */
/*  Rate limit & origin                                                    */
/* ---------------------------------------------------------------------- */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const socketIp = String(req.socket.remoteAddress || '').replace('::ffff:', '');
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (forwarded.length > 0 && (socketIp === '127.0.0.1' || socketIp === '::1')) {
    return forwarded[forwarded.length - 1];
  }
  return socketIp || 'unknown';
}

function checkLoginRate(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return;
  }
  if (entry.count >= MAX_ATTEMPTS) {
    throw new PosAuthError(
      'Terlalu banyak percobaan login. Coba lagi 15 menit lagi.',
      429,
      'RATE_LIMITED'
    );
  }
  entry.count += 1;
}

function assertSameOrigin(req: Request): void {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim();
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new PosAuthError('Origin permintaan tidak valid.', 403, 'INVALID_ORIGIN');
  }
  if (host && originHost !== host) {
    throw new PosAuthError('Origin permintaan tidak diizinkan.', 403, 'INVALID_ORIGIN');
  }
}

/* ---------------------------------------------------------------------- */
/*  Pembacaan akun staf dari PocketBase                                    */
/* ---------------------------------------------------------------------- */
async function loadStaffUsers(): Promise<StaffRecord[]> {
  if (!staffLoginConfigured()) {
    throw new PosAuthError(
      'Login staf belum dikonfigurasi di server (PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD).',
      503,
      'STAFF_AUTH_UNAVAILABLE'
    );
  }

  if (adminConfigured()) {
    try {
      const admin = new PocketBase(pbUpstream());
      admin.autoCancellation(false);
      await admin
        .collection('_superusers')
        .authWithPassword(env('PB_ADMIN_EMAIL'), env('PB_ADMIN_PASSWORD'));
      return (await admin.collection('users').getFullList({
        requestKey: null,
      })) as unknown as StaffRecord[];
    } catch (error) {
      console.warn(
        '[Auth] Akun admin PocketBase tidak dapat membaca users; mencoba akun sinkronisasi:',
        error instanceof Error ? error.message : error
      );
    }
  }

  if (syncConfigured()) {
    try {
      const sync = new PocketBase(pbUpstream());
      sync.autoCancellation(false);
      await sync
        .collection('users')
        .authWithPassword(env('PB_SYNC_EMAIL'), env('PB_SYNC_PASSWORD'));
      return (await sync.collection('users').getFullList({
        requestKey: null,
      })) as unknown as StaffRecord[];
    } catch (error) {
      console.error(
        '[Auth] Gagal membaca koleksi users PocketBase:',
        error instanceof Error ? error.message : error
      );
    }
  }

  throw new PosAuthError(
    'Server tidak dapat memeriksa akun staf saat ini. Coba lagi beberapa saat lagi.',
    503,
    'STAFF_AUTH_UNAVAILABLE'
  );
}

function patchOf(record: StaffRecord): Record<string, unknown> {
  return record.data && typeof record.data === 'object'
    ? record.data
    : {};
}

function recordUsername(record: StaffRecord): string {
  const mirror = patchOf(record);
  return String(record.username || mirror.username || '').trim();
}

async function verifyStaffPassword(
  record: StaffRecord,
  suppliedPassword: string
): Promise<boolean> {
  const mirror = patchOf(record);
  const stored = String(record.appPassword || mirror.password || '');

  if (stored) return safeEqual(suppliedPassword, stored);

  // Record lama tanpa appPassword: verifikasi lewat auth PocketBase.
  const email = String(record.email || '').trim();
  if (!email) return false;
  try {
    const pb = new PocketBase(pbUpstream());
    pb.autoCancellation(false);
    await pb.collection('users').authWithPassword(email, suppliedPassword);
    return true;
  } catch {
    return false;
  }
}

function toAppUser(record: StaffRecord) {
  const mirror = patchOf(record);
  const username = recordUsername(record);
  const role = String(record.role || mirror.role || '').trim().toUpperCase();
  return {
    id: String(record.legacyId || mirror.id || record.id || ''),
    username,
    password: '••••••••',
    name: String(record.name || mirror.name || username),
    role,
    phone: record.phone ?? mirror.phone ?? '',
    spkRoleCategory: record.spkRoleCategory ?? mirror.spkRoleCategory,
    isActive: record.isActive !== false && mirror.isActive !== false,
    createdAt: String(record.createdAt || mirror.createdAt || ''),
  };
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof PosAuthError) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(error.status).json({
      success: false,
      code: error.code,
      error: error.message,
    });
    return;
  }
  console.error('[Auth] Kesalahan internal login dashboard:', error);
  res.status(500).json({
    success: false,
    code: 'SERVER_ERROR',
    error: 'Terjadi kesalahan pada server.',
  });
}

/* ---------------------------------------------------------------------- */
/*  Routes                                                                 */
/* ---------------------------------------------------------------------- */
export function registerPosAuthRoutes(app: Express): void {
  /** Mode situs dipakai UI untuk memutuskan apakah login lokal boleh dipakai. */
  app.get('/api/auth/mode', (_req, res) => {
    const publicSite = isPublicSite();
    const remoteAccess = Boolean(env('REMOTE_ACCESS_PASS'));
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      publicSite,
      mode: publicSite ? 'public' : remoteAccess ? 'private' : 'locked',
      staffLoginReady: staffLoginConfigured(),
      developerLoginReady: developerLoginConfigured(),
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const session = getPosSession(req);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      authenticated: Boolean(session),
      user: session
        ? {
            id: session.uid,
            username: session.uname,
            name: session.name,
            role: session.role,
            isActive: true,
          }
        : null,
      expiresAt: session
        ? new Date(session.exp * 1000).toISOString()
        : null,
      publicSite: isPublicSite(),
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      assertSameOrigin(req);
      const ip = clientIp(req);
      checkLoginRate(ip);

      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      if (!username || !password) {
        throw new PosAuthError(
          'Username dan password wajib diisi.',
          400,
          'MISSING_CREDENTIALS'
        );
      }

      // 1) DEVELOPER: diverifikasi dari hash scrypt di .env.
      if (username.toLowerCase() === getDevUsername().toLowerCase()) {
        const result = await verifyDevCredentials(username, password);
        if (result === 'not-configured') {
          throw new PosAuthError(
            'Login developer belum dikonfigurasi di server (DEV_PASSWORD_HASH).',
            503,
            'DEV_AUTH_UNAVAILABLE'
          );
        }
        if (result !== 'ok') {
          console.warn(`[Auth] Login developer gagal dari ${ip}.`);
          throw new PosAuthError(
            'Username atau password salah.',
            401,
            'INVALID_CREDENTIALS'
          );
        }

        loginAttempts.delete(ip);
        const issued = issueDevSession(req, res);
        const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
        const user = {
          id: 'sys_core_developer',
          username: issued.username,
          password: '••••••••',
          name: 'Langgo (Developer on Duty)',
          role: 'DEVELOPER',
          phone: '',
          isActive: true,
          createdAt: 'Permanen Sistem',
        };
        setSessionCookie(
          req,
          res,
          signSession({
            sub: user.id,
            uid: user.id,
            uname: user.username,
            name: user.name,
            role: user.role,
            exp,
          })
        );
        res.setHeader('Cache-Control', 'no-store');
        res.json({
          success: true,
          user,
          expiresAt: new Date(exp * 1000).toISOString(),
          publicSite: isPublicSite(),
          developer: true,
          journalSession: issued.journalSession,
        });
        return;
      }

      // 2) STAF: dibaca dari PocketBase (kredensial admin/sync hanya di server).
      if (!staffLoginConfigured()) {
        throw new PosAuthError(
          'Login staf belum dikonfigurasi di server. Hubungi Developer.',
          503,
          'STAFF_AUTH_UNAVAILABLE'
        );
      }

      const records = await loadStaffUsers();
      const wanted = username.toLowerCase();
      const record = records.find(
        (item) => recordUsername(item).toLowerCase() === wanted
      );

      if (!record) {
        console.warn(`[Auth] Login staf gagal (akun tidak ditemukan) dari ${ip}.`);
        throw new PosAuthError(
          'Username atau password salah.',
          401,
          'INVALID_CREDENTIALS'
        );
      }

      const passwordOk = await verifyStaffPassword(record, password);
      if (!passwordOk) {
        console.warn(`[Auth] Login staf gagal (password salah) dari ${ip}.`);
        throw new PosAuthError(
          'Username atau password salah.',
          401,
          'INVALID_CREDENTIALS'
        );
      }

      const user = toAppUser(record);
      if (!user.id || !user.username || !user.role) {
        throw new PosAuthError(
          'Data akun tidak lengkap. Hubungi Developer.',
          503,
          'INCOMPLETE_ACCOUNT'
        );
      }
      if (!user.isActive) {
        throw new PosAuthError(
          'Akun ini sedang dinonaktifkan. Hubungi Developer / Administrator.',
          403,
          'ACCOUNT_INACTIVE'
        );
      }
      if (
        isPublicSite() &&
        !allowDefaultStaffPasswords() &&
        KNOWN_DEFAULT_PASSWORDS.has(password.toLowerCase())
      ) {
        throw new PosAuthError(
          'Password akun ini masih password default yang publik. Ganti password lewat menu Pengguna sebelum login dari internet.',
          403,
          'WEAK_PASSWORD'
        );
      }

      loginAttempts.delete(ip);
      // Akun staf tidak boleh mewarisi cookie developer dari sesi sebelumnya.
      clearDevSession(req, res);

      const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
      setSessionCookie(
        req,
        res,
        signSession({
          sub: user.id,
          uid: user.id,
          uname: user.username,
          name: user.name,
          role: user.role,
          exp,
        })
      );
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        user,
        expiresAt: new Date(exp * 1000).toISOString(),
        publicSite: isPublicSite(),
        developer: false,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      assertSameOrigin(req);
      clearSessionCookie(req, res);
      clearDevSession(req, res);
      res.json({ success: true });
    } catch (error) {
      sendError(res, error);
    }
  });
}

export { PosAuthError };
