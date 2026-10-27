/**
 * Sesi DEVELOPER terverifikasi server.
 *
 * Sebelumnya kredensial developer ditanam di bundle browser (hanya diobfuskasi),
 * sehingga siapa pun yang membuka DevTools bisa membacanya. Modul ini
 * memindahkan verifikasi ke server dan hanya mengirim cookie HttpOnly
 * bertanda tangan HMAC ke browser.
 *
 * Variabel lingkungan:
 *   DEV_USERNAME / DEV_PASSWORD_HASH        (nama baru; password hanya hash scrypt)
 *   DEV_PASSWORD / JOURNAL_DEV_PASSWORD     (plaintext lama, fallback migrasi)
 *   JOURNAL_DEV_USER                        (nama lama, tetap didukung)
 *   APP_SESSION_SECRET / JOURNAL_SESSION_SECRET / PB_ADMIN_PASSWORD / REMOTE_ACCESS_PASS
 *
 * Bila tidak ada secret sama sekali, dipakai secret acak per proses (sesi tidak
 * bertahan setelah restart) agar pengembangan lokal tetap berjalan.
 */
import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import {
  clearJournalDeveloperSession,
  issueJournalDeveloperSession,
} from './journalApi';
import { verifyPassword } from './passwordHash';

const COOKIE_NAME = 'bejo_dev_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60_000;

class DevAuthError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

type DevSessionPayload = {
  sub: string;
  role: 'DEVELOPER';
  exp: number;
};

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

export function getDevUsername(): string {
  return env('DEV_USERNAME') || env('JOURNAL_DEV_USER') || 'langgo';
}

function devPasswordHash(): string {
  return env('DEV_PASSWORD_HASH');
}

function devPasswordPlain(): string {
  return env('DEV_PASSWORD') || env('JOURNAL_DEV_PASSWORD');
}

let legacyPasswordWarned = false;

function warnLegacyPassword(): void {
  if (legacyPasswordWarned || devPasswordHash() || !devPasswordPlain()) return;
  legacyPasswordWarned = true;
  console.warn(
    '[Auth] DEV_PASSWORD masih plaintext di .env. Jalankan "node scripts/set-dev-password.mjs --env .env --from-env" agar tersimpan sebagai hash scrypt.'
  );
}

let ephemeralSecret = '';
let ephemeralWarned = false;

export function getSessionSecret(): string {
  const configured =
    env('APP_SESSION_SECRET') ||
    env('JOURNAL_SESSION_SECRET') ||
    env('PB_ADMIN_PASSWORD') ||
    env('REMOTE_ACCESS_PASS');
  if (configured) return configured;

  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('base64url');
    if (!ephemeralWarned) {
      ephemeralWarned = true;
      console.warn(
        '[Auth] APP_SESSION_SECRET belum disetel. Memakai secret acak sementara; sesi developer tidak bertahan setelah server restart.'
      );
    }
  }
  return ephemeralSecret;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

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

function setDevSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isHttps(req) ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`
  );
}

function clearDevSessionCookie(req: Request, res: Response): void {
  const secure = isHttps(req) ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}

function signSession(payload: DevSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function readSession(req: Request): DevSessionPayload | null {
  const token = readCookie(req, COOKIE_NAME);
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DevSessionPayload;
    if (payload.role !== 'DEVELOPER' || !payload.sub) return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export type DevCredentialResult = 'ok' | 'invalid' | 'not-configured';

/**
 * Verifikasi kredensial developer tanpa efek samping (tanpa cookie/rate limit).
 * Dipakai juga oleh login dashboard agar satu pintu masuk untuk semua akun.
 */
export async function verifyDevCredentials(
  username: string,
  password: string
): Promise<DevCredentialResult> {
  const passwordHash = devPasswordHash();
  const plainPassword = devPasswordPlain();
  if (!passwordHash && !plainPassword) return 'not-configured';
  warnLegacyPassword();

  const usernameOk = safeEqual(
    username.trim().toLowerCase(),
    getDevUsername().toLowerCase()
  );
  const passwordOk = passwordHash
    ? await verifyPassword(password, passwordHash)
    : safeEqual(password, plainPassword);
  return usernameOk && passwordOk ? 'ok' : 'invalid';
}

export interface IssuedDevSession {
  username: string;
  expiresAt: string;
  journalSession: unknown;
}

/** Terbitkan cookie sesi developer + Jurnal sekaligus. */
export function issueDevSession(req: Request, res: Response): IssuedDevSession {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  setDevSessionCookie(
    req,
    res,
    signSession({ sub: getDevUsername(), role: 'DEVELOPER', exp })
  );
  const journalSession = issueJournalDeveloperSession(req, res, getDevUsername());
  return {
    username: getDevUsername(),
    expiresAt: new Date(exp * 1000).toISOString(),
    journalSession,
  };
}

export function clearDevSession(req: Request, res: Response): void {
  clearDevSessionCookie(req, res);
  clearJournalDeveloperSession(req, res);
}

/* ---------------------------------------------------------------------- */
/*  Rate limit login developer                                             */
/* ---------------------------------------------------------------------- */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const socketIp = String(req.socket.remoteAddress || '').replace('::ffff:', '');
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  // Di belakang Caddy socket selalu 127.0.0.1. Entri terakhir X-Forwarded-For
  // ditambahkan proxy terdekat, sehingga tidak bisa dipalsukan lewat header klien.
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
    throw new DevAuthError(
      'Terlalu banyak percobaan login developer. Coba lagi 15 menit lagi.',
      429
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
    throw new DevAuthError('Origin permintaan tidak valid.', 403);
  }
  if (host && originHost !== host) {
    throw new DevAuthError('Origin permintaan tidak diizinkan.', 403);
  }
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof DevAuthError) {
    res.status(error.status).json({ success: false, error: error.message });
    return;
  }
  console.error('[Auth] Kesalahan internal:', error);
  res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server.' });
}

export function registerDevAuthRoutes(app: Express): void {
  app.get('/api/auth/session', (req, res) => {
    const session = readSession(req);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      authenticated: Boolean(session),
      username: session?.sub ?? null,
      expiresAt: session ? new Date(session.exp * 1000).toISOString() : null,
    });
  });

  app.post('/api/auth/developer-login', async (req, res) => {
    try {
      assertSameOrigin(req);
      const ip = clientIp(req);
      checkLoginRate(ip);

      const username = String(req.body?.username || '').trim();
      const suppliedPassword = String(req.body?.password || '');
      const result = await verifyDevCredentials(username, suppliedPassword);
      if (result === 'not-configured') {
        throw new DevAuthError(
          'Login developer belum dikonfigurasi di server (DEV_PASSWORD_HASH).',
          503
        );
      }
      if (result !== 'ok') {
        console.warn(`[Auth] Login developer gagal dari ${ip}.`);
        throw new DevAuthError('Username atau password developer salah.', 401);
      }

      loginAttempts.delete(ip);
      const issued = issueDevSession(req, res);
      res.json({
        success: true,
        username: issued.username,
        expiresAt: issued.expiresAt,
        journalSession: issued.journalSession,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      assertSameOrigin(req);
      clearDevSession(req, res);
      res.json({ success: true });
    } catch (error) {
      sendError(res, error);
    }
  });
}
