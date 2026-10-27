/**
 * Manajemen akun staf di sisi server.
 *
 * Browser TIDAK pernah menulis koleksi auth `users`: ia hanya memegang token
 * akun sinkronisasi, sedangkan createRule koleksi auth kosong sehingga setiap
 * tulis akun berujung "Only superusers can perform this action." Semua operasi
 * akun berjalan di sini memakai token superuser (server/staffStore.ts).
 *
 * RBAC ditegakkan di sini, bukan hanya di UI: hanya sesi dashboard ber-role
 * DEVELOPER/ADMIN/OWNER yang boleh mengubah daftar akun, dan role DEVELOPER
 * tidak pernah menjadi record aplikasi.
 */
import type { Express, Request, Response } from 'express';
import PocketBase from 'pocketbase/cjs';
import {
  AUTH_COLLECTION,
  DIR_COLLECTION,
  RESERVED_USER_IDS,
  StaffStoreError,
  credentialEmail,
  directoryFromRecord,
  findDirectoryByAppId,
  listAllCredentials,
  listAllDirectory,
  readPresence,
  runAsAdmin,
  safeAppId,
  saveCredential,
  writeDirectory,
  type AccountInput,
  type DirectoryEntry,
  type PresenceInput,
} from './staffStore';
import { getPosSession, requirePosSession, isDefaultStaffPassword } from './posAuth';

const MANAGE_ROLES = new Set(['DEVELOPER', 'ADMIN', 'OWNER']);
const MIN_PASSWORD_LENGTH = 8;

/** Topeng password dari server: bukan password asli, jangan disimpan. */
const PASSWORD_MASK_PATTERN = /^\u2022+$/;

type UserAdminError = StaffStoreError;

function fail(message: string, status = 500, code = 'USER_ADMIN_ERROR'): UserAdminError {
  return new StaffStoreError(message, status, code);
}

function normalizeAccount(raw: any): AccountInput {
  const username = String(raw?.username ?? '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw fail(
      'Username harus 3-32 karakter (huruf, angka, titik, garis bawah, atau strip) dan diawali huruf/angka.',
      400,
      'INVALID_USERNAME'
    );
  }
  const name = String(raw?.name ?? '').trim();
  if (name.length < 3) throw fail('Nama lengkap wajib diisi (minimal 3 karakter).', 400, 'INVALID_NAME');
  let role = String(raw?.role ?? 'KASIR').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(role)) throw fail('Role akun tidak valid.', 400, 'INVALID_ROLE');
  // Akun DEVELOPER hanya hidup sebagai sesi server, tidak pernah sebagai record.
  if (role === 'DEVELOPER') role = 'ADMIN';

  const supplied = String(raw?.password ?? '').trim();

  return {
    id: safeAppId(raw?.id),
    username,
    name,
    role,
    phone: String(raw?.phone ?? '').trim().slice(0, 32),
    isActive: raw?.isActive !== false,
    spkRoleCategory: String(raw?.spkRoleCategory ?? '').trim().slice(0, 64),
    createdAt: String(raw?.createdAt ?? '').trim().slice(0, 32) || new Date().toISOString(),
    // Topeng dari UI berarti "tidak diganti".
    password: PASSWORD_MASK_PATTERN.test(supplied) ? '' : supplied,
  };
}

function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw fail(
      `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`,
      400,
      'WEAK_PASSWORD'
    );
  }
  if (isDefaultStaffPassword(password)) {
    throw fail(
      'Password default sudah dikenal publik. Pilih password lain sebelum akun ini dibuat.',
      400,
      'DEFAULT_PASSWORD'
    );
  }
}

async function assertUsernameFree(pb: PocketBase, username: string, ownAppId: string): Promise<void> {
  const rows = await pb
    .collection(DIR_COLLECTION)
    .getFullList({ filter: `username = "${username.replace(/[\\"]/g, '')}"`, requestKey: null })
    .catch(() => [] as any[]);
  const clash = rows.map(directoryFromRecord).find((e) => e && e.id !== ownAppId);
  if (clash) {
    throw fail(`Username "${username}" sudah dipakai akun lain.`, 409, 'USERNAME_TAKEN');
  }
}

/* ---------------------------------------------------------------------- */
/*  Operasi akun                                                           */
/* ---------------------------------------------------------------------- */

async function saveAccount(account: AccountInput): Promise<void> {
  await runAsAdmin(async (pb) => {
    await assertUsernameFree(pb, account.username, account.id);
    const existing = await findDirectoryByAppId(pb, account.id);

    if (!existing && !account.password) {
      throw fail(
        `Password untuk akun baru minimal ${MIN_PASSWORD_LENGTH} karakter.`,
        400,
        'WEAK_PASSWORD'
      );
    }
    if (account.password) assertPasswordPolicy(account.password);

    const entry: DirectoryEntry = {
      ...account,
      authId: existing?.authId || '',
      presence: existing?.presence || { isOnline: false, lastActiveAt: 0, lastLoginAt: 0 },
      recordId: existing?.recordId,
    };

    entry.authId = await saveCredential(pb, entry, assertPasswordPolicy);
    await writeDirectory(pb, entry);
  });
}

async function deleteAccount(appId: string): Promise<void> {
  await runAsAdmin(async (pb) => {
    const entry = await findDirectoryByAppId(pb, appId);
    if (!entry) throw fail('Akun tidak ditemukan di database cloud.', 404, 'ACCOUNT_NOT_FOUND');
    if (entry.authId) {
      await pb.collection(AUTH_COLLECTION).delete(entry.authId).catch(() => undefined);
    }
    if (entry.recordId) {
      await pb.collection(DIR_COLLECTION).delete(entry.recordId);
    }
  });
}

async function touchPresence(appId: string, presence: PresenceInput): Promise<void> {
  await runAsAdmin(async (pb) => {
    const entry = await findDirectoryByAppId(pb, appId);
    if (!entry?.recordId) {
      throw fail('Akun belum terdaftar di database cloud.', 404, 'ACCOUNT_NOT_FOUND');
    }
    await writeDirectory(pb, {
      ...entry,
      presence: {
        isOnline: presence.isOnline ?? entry.presence.isOnline,
        lastActiveAt: presence.lastActiveAt ?? entry.presence.lastActiveAt,
        lastLoginAt: presence.lastLoginAt ?? entry.presence.lastLoginAt,
      },
    });
  });
}

/**
 * Lengkapi direktori dari record kredensial yang belum punya baris `app_users`
 * (akun lama, atau akun yang dibuat lewat Admin PocketBase). Idempoten, dijalankan
 * saat server menyala dan lewat POST /api/users/sync.
 */
export async function ensureStaffDirectory(): Promise<{ added: number; kept: number; removed: number }> {
  return runAsAdmin(async (pb) => {
    const [credentials, entries] = await Promise.all([
      listAllCredentials(pb),
      listAllDirectory(pb),
    ]);

    const byAuthId = new Map(entries.map((e) => [e.authId, e]));
    const byAppId = new Set(entries.map((e) => e.id));
    const syncEmail = String(process.env.PB_SYNC_EMAIL || '').trim().toLowerCase();

    let added = 0;
    let kept = 0;

    for (const record of credentials) {
      const email = String(record.email || '').trim().toLowerCase();
      if (syncEmail && email === syncEmail) continue;
      if (byAuthId.has(String(record.id))) {
        kept += 1;
        continue;
      }
      const username =
        String(record.username || '').trim().toLowerCase() ||
        credentialEmail(email.split('@')[0], String(record.id)).split('@')[0];
      if (!username) continue;
      const legacyId = String(record.legacyId || '').trim() || `user_${record.id}`;
      if (RESERVED_USER_IDS.has(legacyId) || byAppId.has(legacyId)) {
        kept += 1;
        continue;
      }
      const mirror = record.data && typeof record.data === 'object' ? record.data : {};
      const rawRole = String(record.role || mirror.role || '').trim().toUpperCase();
      await writeDirectory(pb, {
        id: legacyId,
        username,
        name: String(record.name || mirror.name || username).trim(),
        // Record tanpa role tertulis: KASIR adalah role terkecil, aman sebagai default.
        role: rawRole && rawRole !== 'DEVELOPER' ? rawRole : 'KASIR',
        phone: String(record.phone || mirror.phone || ''),
        isActive: record.isActive !== false && mirror.isActive !== false,
        spkRoleCategory: String(record.spkRoleCategory || mirror.spkRoleCategory || ''),
        createdAt: String(record.createdAt || mirror.createdAt || ''),
        password: '',
        authId: String(record.id),
        presence: readPresence(record),
      });
      byAppId.add(legacyId);
      added += 1;
    }

    // Baris direktori yang record kredensialnya sudah dihapus dari PocketBase.
    const aliveAuth = new Set(credentials.map((r) => String(r.id)));
    let removed = 0;
    for (const entry of entries) {
      if (entry.authId && !aliveAuth.has(entry.authId)) {
        await pb.collection(DIR_COLLECTION).delete(entry.recordId!).catch(() => undefined);
        removed += 1;
      }
    }

    return { added, kept, removed };
  });
}

/* ---------------------------------------------------------------------- */
/*  Rute HTTP                                                              */
/* ---------------------------------------------------------------------- */

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
    throw fail('Origin permintaan tidak valid.', 403, 'INVALID_ORIGIN');
  }
  if (host && originHost !== host) {
    throw fail('Origin permintaan tidak diizinkan.', 403, 'INVALID_ORIGIN');
  }
}

function callerAppId(req: Request): string {
  const session = getPosSession(req);
  const uid = String(session?.uid || '').trim();
  if (!uid) throw fail('Sesi dashboard tidak dikenali.', 401, 'AUTH_REQUIRED');
  return uid;
}

function requireManageRole(req: Request): void {
  const session = getPosSession(req);
  const role = String(session?.role || '').trim().toUpperCase();
  if (!MANAGE_ROLES.has(role)) {
    throw fail(
      'Hanya ADMIN/OWNER/DEVELOPER yang dapat mengubah daftar pengguna.',
      403,
      'FORBIDDEN_ROLE'
    );
  }
}

function sendUserError(res: Response, error: unknown): void {
  res.setHeader('Cache-Control', 'no-store');
  if (error instanceof StaffStoreError) {
    res.status(error.status).json({ success: false, code: error.code, error: error.message });
    return;
  }
  const err = error as { status?: number; message?: string; response?: { data?: { message?: string } } };
  const pbMessage = String(err?.response?.data?.message || err?.message || 'Terjadi kesalahan pada server.');
  const status = err?.status === 400 ? 400 : err?.status === 404 ? 404 : 502;
  console.error('[UserAdmin] Gagal memproses permintaan:', error);
  res.status(status).json({
    success: false,
    code: 'POCKETBASE_REJECTED',
    error: `PocketBase menolak permintaan: ${pbMessage}`,
  });
}

export function registerUserAdminRoutes(app: Express): void {
  // Simpan/buat akun staf. Browser tidak pernah menulis koleksi auth `users`.
  app.post('/api/users', requirePosSession, async (req, res) => {
    try {
      assertSameOrigin(req);
      requireManageRole(req);
      const account = normalizeAccount(req.body);
      await saveAccount(account);
      res.json({ success: true, id: account.id, username: account.username });
    } catch (error) {
      sendUserError(res, error);
    }
  });

  app.delete('/api/users/:id', requirePosSession, async (req, res) => {
    try {
      assertSameOrigin(req);
      requireManageRole(req);
      const appId = safeAppId(req.params.id);
      if (appId === callerAppId(req)) {
        throw fail('Anda tidak dapat menghapus akun yang sedang dipakai.', 400, 'SELF_DELETE');
      }
      await deleteAccount(appId);
      res.json({ success: true, id: appId });
    } catch (error) {
      sendUserError(res, error);
    }
  });

  // Presence: setiap sesi hanya mengubah barisnya sendiri, dan hanya direktori
  // yang disentuh (record kredensial tidak pernah ditulis dari jalur ini).
  app.post('/api/users/presence', requirePosSession, async (req, res) => {
    try {
      assertSameOrigin(req);
      const appId = safeAppId(req.body?.id ?? callerAppId(req));
      if (appId !== callerAppId(req)) {
        throw fail('Presence hanya dapat diubah untuk akun sendiri.', 403, 'FORBIDDEN_PRESENCE');
      }
      await touchPresence(appId, {
        isOnline: req.body?.isOnline !== false,
        lastActiveAt: Number(req.body?.lastActiveAt || Date.now()),
        lastLoginAt: req.body?.lastLoginAt ? Number(req.body.lastLoginAt) : undefined,
      });
      res.json({ success: true });
    } catch (error) {
      sendUserError(res, error);
    }
  });

  // Lengkapi direktori dari record kredensial (dipakai boot server + diagnostik).
  app.post('/api/users/sync', requirePosSession, async (req, res) => {
    try {
      assertSameOrigin(req);
      requireManageRole(req);
      const result = await ensureStaffDirectory();
      res.json({ success: true, ...result });
    } catch (error) {
      sendUserError(res, error);
    }
  });
}
