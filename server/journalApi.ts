/**
 * Modul Jurnal (khusus DEVELOPER).
 *
 * - Sesi developer dibuat lewat POST /api/journal/session dan disimpan sebagai
 *   cookie HttpOnly bertanda tangan HMAC (bukan localStorage).
 * - Seluruh akses data lewat Express; koleksi PocketBase dikunci admin-only
 *   sehingga token sinkronisasi milik browser tidak bisa membacanya langsung.
 * - `jurnal_config` menyimpan konfigurasi mirroring Google Sheet per tahun
 *   (URL, mode tampilan, tahun aktif) agar bisa dipulihkan di perangkat lain.
 * - `jurnal_sheets` menyimpan state spreadsheet lama dan tetap dipertahankan
 *   agar data Jurnal versi sebelumnya tidak hilang.
 */
import type { Express, Request, Response } from 'express';
// Build CJS eksplisit: impor root adalah ESM sehingga esbuild CJS salah
// melakukan interop dan `new PocketBase()` gagal di runtime.
import PocketBase from 'pocketbase/cjs';
import crypto from 'crypto';

const COOKIE_NAME = 'bejo_jurnal_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const YEAR_MIN = 2022;
const YEAR_MAX = 2028;
const MAX_GRID_BYTES = 5_000_000;
const COLLECTION = 'jurnal_sheets';
const HALAMAN = ['kas_utama', 'debit', 'kredit'] as const;
type Halaman = (typeof HALAMAN)[number];

const CONFIG_COLLECTION = 'jurnal_config';
const CONFIG_SCOPE = 'default';
const CONFIG_YEAR_MIN = 2000;
const CONFIG_YEAR_MAX = 2100;
const MAX_CONFIG_BYTES = 1_000_000;
const EMBED_MODES = ['preview', 'edit', 'html'] as const;
type EmbedMode = (typeof EMBED_MODES)[number];

class JournalError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

type SessionPayload = {
  sub: string;
  role: 'DEVELOPER';
  exp: number;
};

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

function journalConfig() {
  const adminEmail = env('PB_ADMIN_EMAIL');
  const adminPassword = env('PB_ADMIN_PASSWORD');
  return {
    pbUrl: env('POCKETBASE_UPSTREAM') || 'http://127.0.0.1:8090',
    adminEmail,
    adminPassword,
    devUser: env('DEV_USERNAME') || env('JOURNAL_DEV_USER') || 'langgo',
    devPassword: env('DEV_PASSWORD') || env('JOURNAL_DEV_PASSWORD'),
    sessionSecret:
      env('APP_SESSION_SECRET') || env('JOURNAL_SESSION_SECRET') || adminPassword,
  };
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

function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isHttps(req) ? '; Secure' : '';
  // append (bukan setHeader) agar tidak menimpa cookie sesi developer.
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

/**
 * Membuat cookie sesi Jurnal tanpa login kedua.
 * Dipanggil modul auth developer setelah kredensial diverifikasi server.
 * Mengembalikan false bila secret Jurnal belum dikonfigurasi.
 */
export function issueJournalDeveloperSession(
  req: Request,
  res: Response,
  username: string
): boolean {
  const config = journalConfig();
  if (!config.sessionSecret) return false;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  setSessionCookie(req, res, signSession({ sub: username, role: 'DEVELOPER', exp }, config.sessionSecret));
  return true;
}

export function clearJournalDeveloperSession(req: Request, res: Response): void {
  clearSessionCookie(req, res);
}

function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function readSession(req: Request): SessionPayload | null {
  const { sessionSecret } = journalConfig();
  if (!sessionSecret) return null;

  const token = readCookie(req, COOKIE_NAME);
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.role !== 'DEVELOPER' || !payload.sub) return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireDeveloper(req: Request): SessionPayload {
  const session = readSession(req);
  if (!session) {
    throw new JournalError('Sesi DEVELOPER tidak aktif. Buka kembali modul Jurnal untuk login.', 401);
  }
  return session;
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

  // Entri terakhir ditambahkan proxy terdekat (Caddy), jadi tidak bisa
  // dipalsukan lewat header kiriman klien.
  if (forwarded.length > 0 && (socketIp === '127.0.0.1' || socketIp === '::1')) {
    return forwarded[forwarded.length - 1];
  }
  return socketIp || 'unknown';
}

function checkLoginRate(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return;
  }
  if (entry.count >= 10) {
    throw new JournalError('Terlalu banyak percobaan login developer. Coba lagi 15 menit lagi.', 429);
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
    throw new JournalError('Origin permintaan tidak valid.', 403);
  }
  if (host && originHost !== host) {
    throw new JournalError('Origin permintaan tidak diizinkan.', 403);
  }
}

/* ---------------------------------------------------------------------- */
/*  PocketBase admin                                                       */
/* ---------------------------------------------------------------------- */
let adminClient: PocketBase | null = null;
let adminAuth: Promise<PocketBase> | null = null;
let collectionReady: Promise<void> | null = null;
let configCollectionReady: Promise<void> | null = null;
const userIdCache = new Map<string, string | null>();

async function getAdminClient(): Promise<PocketBase> {
  const config = journalConfig();
  if (!config.adminEmail || !config.adminPassword) {
    throw new JournalError(
      'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD belum disetel di server. Modul Jurnal memerlukan akun admin PocketBase.',
      503
    );
  }
  if (adminClient?.authStore.isValid) return adminClient;

  if (!adminAuth) {
    adminAuth = (async () => {
      const pb = new PocketBase(config.pbUrl);
      pb.autoCancellation(false);
      try {
        await pb.collection('_superusers').authWithPassword(config.adminEmail, config.adminPassword);
      } catch (primaryError) {
        try {
          const legacy = (pb as unknown as { admins?: { authWithPassword: (e: string, p: string) => Promise<unknown> } }).admins;
          if (!legacy?.authWithPassword) throw primaryError;
          await legacy.authWithPassword(config.adminEmail, config.adminPassword);
        } catch {
          throw new JournalError(
            'Login admin PocketBase gagal. Periksa PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD.',
            503
          );
        }
      }
      adminClient = pb;
      console.log('[Jurnal] Admin PocketBase terautentikasi.');
      return pb;
    })().finally(() => {
      adminAuth = null;
    });
  }
  return adminAuth;
}

async function ensureCollection(): Promise<void> {
  if (!collectionReady) {
    collectionReady = (async () => {
      const pb = await getAdminClient();

      let existing: any = null;
      try {
        existing = await pb.collections.getOne(COLLECTION);
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }

      const lockedRules = {
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
      };

      if (existing) {
        const needsLock =
          existing.listRule !== null ||
          existing.viewRule !== null ||
          existing.createRule !== null ||
          existing.updateRule !== null ||
          existing.deleteRule !== null;
        if (needsLock) {
          await pb.collections.update(existing.id, lockedRules);
          console.log('[Jurnal] Aturan koleksi jurnal_sheets dikunci ke admin-only.');
        }
        return;
      }

      let usersCollectionId = '';
      try {
        usersCollectionId = (await pb.collections.getOne('users')).id;
      } catch {
        /* relation updated_by dilewati bila koleksi users tidak ada */
      }

      const fields: any[] = [
        { name: 'tahun', type: 'number', required: true, onlyInt: true, min: YEAR_MIN, max: YEAR_MAX },
        { name: 'halaman', type: 'select', required: true, maxSelect: 1, values: [...HALAMAN] },
        { name: 'data_grid', type: 'json', required: true, maxSize: MAX_GRID_BYTES },
        { name: 'updated_by_name', type: 'text', required: false, min: 0, max: 200 },
      ];
      if (usersCollectionId) {
        fields.push({
          name: 'updated_by',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: false,
        });
      }

      try {
        await pb.collections.create({
          name: COLLECTION,
          type: 'base',
          fields,
          indexes: [
            'CREATE UNIQUE INDEX `idx_jurnal_sheets_tahun_halaman` ON `jurnal_sheets` (`tahun`, `halaman`)',
          ],
          ...lockedRules,
          options: {},
        });
        console.log('[Jurnal] Koleksi jurnal_sheets dibuat (admin-only).');
      } catch (error) {
        // Permintaan paralel bisa membuat koleksi yang sama; anggap sukses bila sudah ada.
        try {
          await pb.collections.getOne(COLLECTION);
        } catch {
          throw error;
        }
      }
    })().catch((error) => {
      collectionReady = null;
      throw error;
    });
  }
  return collectionReady;
}

async function ensureConfigCollection(): Promise<void> {
  if (!configCollectionReady) {
    configCollectionReady = (async () => {
      const pb = await getAdminClient();

      let existing: any = null;
      try {
        existing = await pb.collections.getOne(CONFIG_COLLECTION);
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }

      const lockedRules = {
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
      };

      if (existing) {
        const needsLock =
          existing.listRule !== null ||
          existing.viewRule !== null ||
          existing.createRule !== null ||
          existing.updateRule !== null ||
          existing.deleteRule !== null;
        if (needsLock) {
          await pb.collections.update(existing.id, lockedRules);
          console.log('[Jurnal] Aturan koleksi jurnal_config dikunci ke admin-only.');
        }
        return;
      }

      let usersCollectionId = '';
      try {
        usersCollectionId = (await pb.collections.getOne('users')).id;
      } catch {
        /* relation updated_by dilewati bila koleksi users tidak ada */
      }

      const fields: any[] = [
        { name: 'scope', type: 'text', required: true, min: 1, max: 100 },
        { name: 'settings', type: 'json', required: true, maxSize: MAX_CONFIG_BYTES },
        { name: 'updated_by_name', type: 'text', required: false, min: 0, max: 200 },
      ];
      if (usersCollectionId) {
        fields.push({
          name: 'updated_by',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: false,
        });
      }

      try {
        await pb.collections.create({
          name: CONFIG_COLLECTION,
          type: 'base',
          fields,
          indexes: [
            'CREATE UNIQUE INDEX `idx_jurnal_config_scope` ON `jurnal_config` (`scope`)',
          ],
          ...lockedRules,
          options: {},
        });
        console.log('[Jurnal] Koleksi jurnal_config dibuat (admin-only).');
      } catch (error) {
        try {
          await pb.collections.getOne(CONFIG_COLLECTION);
        } catch {
          throw error;
        }
      }
    })().catch((error) => {
      configCollectionReady = null;
      throw error;
    });
  }
  return configCollectionReady;
}

async function resolveUserId(pb: PocketBase, username: string): Promise<string | null> {
  if (!username) return null;
  if (userIdCache.has(username)) return userIdCache.get(username) ?? null;

  let id: string | null = null;
  try {
    const record = await pb.collection('users').getFirstListItem(`username = ${JSON.stringify(username)}`);
    id = record.id;
  } catch {
    id = null;
  }
  userIdCache.set(username, id);
  return id;
}

/* ---------------------------------------------------------------------- */
/*  Validasi & serialisasi                                                 */
/* ---------------------------------------------------------------------- */
function parseYear(value: unknown): number {
  const year = Number(value);
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) {
    throw new JournalError(`Tahun harus antara ${YEAR_MIN} dan ${YEAR_MAX}.`, 400);
  }
  return year;
}

function parseHalaman(value: unknown): Halaman {
  const halaman = String(value || '');
  if (!HALAMAN.includes(halaman as Halaman)) {
    throw new JournalError('Halaman Jurnal tidak valid.', 400);
  }
  return halaman as Halaman;
}

function validateGrid(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new JournalError('data_grid harus berupa objek sheet.', 400);
  }
  const sheet = value as any;
  const hasCells = Array.isArray(sheet.celldata) || Array.isArray(sheet.data);
  if (!sheet.name || !hasCells) {
    throw new JournalError('data_grid tidak berisi state sheet yang valid.', 400);
  }
  if (JSON.stringify(value).length > MAX_GRID_BYTES) {
    throw new JournalError('data_grid melebihi batas 5 MB.', 413);
  }
  return value as Record<string, unknown>;
}

function optionalIsoDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new JournalError(`${field} harus berupa teks tanggal ISO.`, 400);
  }
  const text = value.trim();
  if (!text) return undefined;
  if (text.length > 40 || !Number.isFinite(Date.parse(text))) {
    throw new JournalError(`${field} bukan tanggal ISO yang valid.`, 400);
  }
  return new Date(text).toISOString();
}

function validateJournalSettings(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new JournalError('settings harus berupa objek konfigurasi Jurnal.', 400);
  }
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.years) || input.years.length === 0) {
    throw new JournalError('settings.years harus berisi minimal satu tahun.', 400);
  }
  if (input.years.length > 100) {
    throw new JournalError('settings.years maksimal 100 tahun.', 400);
  }

  const seen = new Set<number>();
  const years = input.years
    .map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new JournalError('Setiap tahun Jurnal harus berupa objek.', 400);
      }
      const item = raw as Record<string, unknown>;
      const year = Number(item.year);
      if (!Number.isInteger(year) || year < CONFIG_YEAR_MIN || year > CONFIG_YEAR_MAX) {
        throw new JournalError(
          `Tahun Jurnal harus antara ${CONFIG_YEAR_MIN} dan ${CONFIG_YEAR_MAX}.`,
          400
        );
      }
      if (seen.has(year)) {
        throw new JournalError(`Tahun ${year} muncul lebih dari sekali.`, 400);
      }
      seen.add(year);

      const sheetUrl = typeof item.sheetUrl === 'string' ? item.sheetUrl.trim() : '';
      if (sheetUrl.length > 2048) {
        throw new JournalError(`URL Google Sheet tahun ${year} terlalu panjang.`, 400);
      }
      if (sheetUrl && !/^https?:\/\//i.test(sheetUrl)) {
        throw new JournalError(
          `URL Google Sheet tahun ${year} harus diawali http:// atau https://.`,
          400
        );
      }

      const title = typeof item.title === 'string' ? item.title.trim().slice(0, 200) : '';
      const notes = typeof item.notes === 'string' ? item.notes.trim().slice(0, 1000) : '';
      const updatedAt = optionalIsoDate(item.updatedAt, `updatedAt tahun ${year}`);
      const entry: Record<string, unknown> = {
        year,
        sheetUrl,
        title: title || `Jurnal Pembukuan ${year}`,
        notes,
      };
      if (updatedAt) entry.updatedAt = updatedAt;
      return entry;
    })
    .sort((a, b) => Number(a.year) - Number(b.year));

  const selectedYear = Number(input.selectedYear);
  if (!Number.isInteger(selectedYear) || !seen.has(selectedYear)) {
    throw new JournalError('settings.selectedYear harus salah satu tahun yang terdaftar.', 400);
  }

  const rawMode = String(input.embedMode || 'preview');
  if (!EMBED_MODES.includes(rawMode as EmbedMode)) {
    throw new JournalError('Mode tampilan Jurnal harus preview, edit, atau html.', 400);
  }

  const result: Record<string, unknown> = {
    years,
    selectedYear,
    embedMode: rawMode,
  };

  if (
    input.autoRefreshMinutes !== undefined &&
    input.autoRefreshMinutes !== null &&
    input.autoRefreshMinutes !== ''
  ) {
    const minutes = Number(input.autoRefreshMinutes);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
      throw new JournalError('autoRefreshMinutes harus bilangan bulat 0-1440.', 400);
    }
    result.autoRefreshMinutes = minutes;
  }

  const savedAt = optionalIsoDate(input.savedAt, 'savedAt');
  if (savedAt) result.savedAt = savedAt;

  if (JSON.stringify(result).length > MAX_CONFIG_BYTES) {
    throw new JournalError('Konfigurasi Jurnal melebihi batas 1 MB.', 413);
  }

  return result;
}

function sanitizeConfigRecord(record: any) {
  return {
    settings: record.settings ?? null,
    updated: record.updated || '',
    updated_by_name: record.updated_by_name || '',
  };
}

function sanitizeRecord(record: any) {
  return {
    id: record.id,
    tahun: Number(record.tahun),
    halaman: record.halaman,
    data_grid: record.data_grid,
    updated_by: record.updated_by || '',
    updated_by_name: record.updated_by_name || '',
    updated: record.updated || '',
  };
}

/* ---------------------------------------------------------------------- */
/*  Route helpers                                                          */
/* ---------------------------------------------------------------------- */
function sendError(res: Response, error: unknown): void {
  const status = error instanceof JournalError ? error.status : 500;
  if (status >= 500) {
    console.error('[Jurnal]', error);
  }
  if (res.headersSent) return;
  res.status(status).json({
    success: false,
    error: error instanceof JournalError ? error.message : 'Terjadi kesalahan pada server Jurnal.',
  });
}

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void fn(req, res).catch((error) => sendError(res, error));
  };
}

/* ---------------------------------------------------------------------- */
/*  Routes                                                                 */
/* ---------------------------------------------------------------------- */
export function registerJournalRoutes(app: Express): void {
  app.get(
    '/api/journal/session',
    handle(async (req, res) => {
      const config = journalConfig();
      const session = readSession(req);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        authenticated: Boolean(session),
        username: session?.sub || null,
        configured: {
          developerLogin: Boolean(config.devPassword),
          pocketbaseAdmin: Boolean(config.adminEmail && config.adminPassword),
          sessionSecret: Boolean(config.sessionSecret),
        },
      });
    })
  );

  app.post(
    '/api/journal/session',
    handle(async (req, res) => {
      assertSameOrigin(req);
      const ip = clientIp(req);
      checkLoginRate(ip);

      const config = journalConfig();
      if (!config.devPassword) {
        throw new JournalError('JOURNAL_DEV_PASSWORD belum disetel di server.', 503);
      }
      if (!config.sessionSecret) {
        throw new JournalError(
          'JOURNAL_SESSION_SECRET (atau PB_ADMIN_PASSWORD) belum disetel di server.',
          503
        );
      }

      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const usernameOk = username === config.devUser.toLowerCase();
      const passwordOk = safeEqual(password, config.devPassword);
      if (!usernameOk || !passwordOk) {
        console.warn(`[Jurnal] Login developer gagal dari ${ip}.`);
        throw new JournalError('Username atau password developer salah.', 401);
      }

      loginAttempts.delete(ip);
      const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
      setSessionCookie(req, res, signSession({ sub: config.devUser, role: 'DEVELOPER', exp }, config.sessionSecret));
      res.json({
        success: true,
        username: config.devUser,
        expiresAt: new Date(exp * 1000).toISOString(),
      });
    })
  );

  app.delete(
    '/api/journal/session',
    handle(async (req, res) => {
      assertSameOrigin(req);
      clearSessionCookie(req, res);
      res.json({ success: true });
    })
  );

  app.get(
    '/api/journal/config',
    handle(async (req, res) => {
      requireDeveloper(req);
      await ensureConfigCollection();

      const pb = await getAdminClient();
      let record: any = null;
      try {
        record = await pb
          .collection(CONFIG_COLLECTION)
          .getFirstListItem(`scope = "${CONFIG_SCOPE}"`);
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        settings: record?.settings ?? null,
        updated: record?.updated || null,
      });
    })
  );

  app.put(
    '/api/journal/config',
    handle(async (req, res) => {
      const session = requireDeveloper(req);
      assertSameOrigin(req);
      const settings = validateJournalSettings(req.body?.settings);
      await ensureConfigCollection();

      const pb = await getAdminClient();
      const userId = await resolveUserId(pb, session.sub);
      const payload: Record<string, unknown> = {
        scope: CONFIG_SCOPE,
        settings,
        updated_by_name: session.sub,
      };
      if (userId) payload.updated_by = userId;

      const filter = `scope = "${CONFIG_SCOPE}"`;
      let record: any = null;
      try {
        record = await pb.collection(CONFIG_COLLECTION).getFirstListItem(filter);
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }

      if (record) {
        record = await pb.collection(CONFIG_COLLECTION).update(record.id, payload);
      } else {
        try {
          record = await pb.collection(CONFIG_COLLECTION).create(payload);
        } catch (error: any) {
          const existing = await pb
            .collection(CONFIG_COLLECTION)
            .getFirstListItem(filter)
            .catch(() => null);
          if (!existing) throw error;
          record = await pb.collection(CONFIG_COLLECTION).update(existing.id, payload);
        }
      }

      const sanitized = sanitizeConfigRecord(record);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, ...sanitized });
    })
  );

  app.get(
    '/api/journal/sheets',
    handle(async (req, res) => {
      requireDeveloper(req);
      const tahun = parseYear(req.query.tahun);
      await ensureCollection();

      const pb = await getAdminClient();
      const records = await pb.collection(COLLECTION).getFullList({
        filter: `tahun = ${tahun}`,
      });

      const sheets: Record<Halaman, any> = { kas_utama: null, debit: null, kredit: null };
      for (const record of records) {
        if (HALAMAN.includes(record.halaman as Halaman)) {
          sheets[record.halaman as Halaman] = sanitizeRecord(record);
        }
      }

      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, tahun, sheets });
    })
  );

  app.put(
    '/api/journal/sheets',
    handle(async (req, res) => {
      const session = requireDeveloper(req);
      assertSameOrigin(req);
      const tahun = parseYear(req.body?.tahun);
      const halaman = parseHalaman(req.body?.halaman);
      const dataGrid = validateGrid(req.body?.dataGrid);
      await ensureCollection();

      const pb = await getAdminClient();
      const userId = await resolveUserId(pb, session.sub);
      const payload: Record<string, unknown> = {
        tahun,
        halaman,
        data_grid: dataGrid,
        updated_by_name: session.sub,
      };
      if (userId) payload.updated_by = userId;

      const filter = `tahun = ${tahun} && halaman = "${halaman}"`;
      let record: any = null;
      try {
        record = await pb.collection(COLLECTION).getFirstListItem(filter);
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }

      if (record) {
        record = await pb.collection(COLLECTION).update(record.id, payload);
      } else {
        try {
          record = await pb.collection(COLLECTION).create(payload);
        } catch (error: any) {
          // Unique index (tahun, halaman): request paralel bisa membuat record lebih dulu.
          const existing = await pb.collection(COLLECTION).getFirstListItem(filter).catch(() => null);
          if (!existing) throw error;
          record = await pb.collection(COLLECTION).update(existing.id, payload);
        }
      }

      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, record: sanitizeRecord(record) });
    })
  );
}
