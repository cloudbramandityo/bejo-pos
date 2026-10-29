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
  assertNotSyncCredential,
  credentialEmail,
  directoryFromRecord,
  findDirectoryByAppId,
  findSyncCredentialId,
  listAllCredentials,
  listAllDirectory,
  loadStaffAccounts,
  readPresence,
  runAsAdmin,
  safeAppId,
  saveCredential,
  syncAccountEmail,
  verifyStaffPassword,
  writeDirectory,
  type AccountInput,
  type DirectoryEntry,
  type PresenceInput,
} from './staffStore';
import { getPosSession, issueStaffSession, requirePosSession } from './posAuth';
import { getDevUsername } from './devAuth';
import {
  MAX_AVATAR_DATA_URL_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_TEMPORARY_PASSWORD_LENGTH,
  PASSWORD_MASK,
  checkPasswordPolicy,
  checkTemporaryPassword,
  checkUsernameFormat,
} from '../src/utils/credentialPolicy';

const MANAGE_ROLES = new Set(['DEVELOPER', 'ADMIN', 'OWNER']);

/** Topeng password dari server: bukan password asli, jangan disimpan. */
const PASSWORD_MASK_PATTERN = /^\u2022+$/;

type UserAdminError = StaffStoreError;

function fail(message: string, status = 500, code = 'USER_ADMIN_ERROR'): UserAdminError {
  return new StaffStoreError(message, status, code);
}

/**
 * Foto profil hanya boleh data URL hasil kompresi di browser atau tautan https.
 * Nilai kosong berarti "tidak punya foto" (atau "jangan ubah" saat mengedit).
 */
function normalizeAvatarUrl(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.length > MAX_AVATAR_DATA_URL_LENGTH) {
    throw fail(
      'Foto profil terlalu besar. Unggah ulang foto agar otomatis dikompres.',
      400,
      'AVATAR_TOO_LARGE'
    );
  }
  if (value.startsWith('data:image/')) return value;
  if (/^https:\/\/[^\s]{1,1000}$/i.test(value)) return value;
  throw fail('Format foto profil tidak dikenali.', 400, 'INVALID_AVATAR');
}

function normalizeAccount(raw: any): AccountInput {
  const username = String(raw?.username ?? '').trim().toLowerCase();
  const usernameProblem = checkUsernameFormat(username);
  if (usernameProblem) {
    throw fail(usernameProblem, 400, 'INVALID_USERNAME');
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
    avatarUrl: normalizeAvatarUrl(raw?.avatarUrl),
    // Flag hanya berarti bila password benar-benar diganti (lihat saveAccount).
    mustChangePassword: raw?.mustChangePassword === true,
  };
}

/**
 * Kebijakan password berlaku di semua mode situs: password default yang ikut
 * ter-bundle maupun tebakan umum tidak boleh dipakai lagi, sekalipun server
 * berjalan di mode internal.
 */
function assertPasswordPolicy(username: string, password: string): void {
  const problem = checkPasswordPolicy(username, password);
  if (problem) throw fail(problem.message, 400, problem.code);
}

/**
 * Password sementara (diberikan Developer saat membuat akun / reset) hanya
 * perlu memenuhi panjang minimum. User wajib menggantinya saat login, dan
 * penggantian itu memakai kebijakan kuat di atas.
 */
function assertTemporaryPassword(_username: string, password: string): void {
  const problem = checkTemporaryPassword(password);
  if (problem) throw fail(problem.message, 400, problem.code);
}

/**
 * Cari baris direktori lain dengan username yang sama. Restore dari perangkat
 * lain membawa id lama, jadi identitas akun harus dikenali dari username —
 * orang yang sama di cloud bisa punya id berbeda.
 */
async function findDirectoryByUsername(
  pb: PocketBase,
  username: string,
  ownAppId: string
): Promise<DirectoryEntry | null> {
  const rows = await pb
    .collection(DIR_COLLECTION)
    .getFullList({ filter: `username = "${username.replace(/[\\"]/g, '')}"`, requestKey: null })
    .catch(() => [] as any[]);
  return rows.map(directoryFromRecord).find((e) => e && e.id !== ownAppId) || null;
}

/* ---------------------------------------------------------------------- */
/*  Operasi akun                                                           */
/* ---------------------------------------------------------------------- */

async function saveAccount(account: AccountInput): Promise<{ id: string; adopted: boolean }> {
  // Identitas developer bukan akun staf: kredensialnya dari server, jadi baris
  // direktori berkas id ini tidak boleh dibuat/ditimpa lewat API aplikasi.
  if (RESERVED_USER_IDS.has(account.id)) {
    throw fail(
      'Akun developer dikelola lewat server (DEV_USERNAME / DEV_PASSWORD_HASH), bukan dari aplikasi.',
      400,
      'ACCOUNT_RESERVED'
    );
  }
  return runAsAdmin(async (pb) => {
    const existing = await findDirectoryByAppId(pb, account.id);
    const sameUsername = await findDirectoryByUsername(pb, account.username, account.id);

    // Username developer diverifikasi lebih dulu saat login, jadi akun staf
    // dengan username itu tidak akan pernah bisa dipakai — tolak sejak awal.
    if (account.username === getDevUsername().trim().toLowerCase()) {
      throw fail(
        `Username "${account.username}" dicadangkan untuk akun developer.`,
        400,
        'USERNAME_RESERVED'
      );
    }

    // Username akun layanan sinkronisasi juga bukan milik staf. Backup lama
    // pernah memuat baris "sync"; mengembalikannya hanya melahirkan akun palsu.
    const syncUsername = syncAccountEmail().split('@')[0];
    if (syncUsername && account.username === syncUsername) {
      throw fail(
        `Username "${account.username}" dicadangkan untuk akun layanan sinkronisasi.`,
        400,
        'USERNAME_RESERVED'
      );
    }

    // Ganti username ke username milik akun lain tetap ditolak.
    if (existing && sameUsername) {
      throw fail(`Username "${account.username}" sudah dipakai akun lain.`, 409, 'USERNAME_TAKEN');
    }

    if (!existing && !sameUsername && !account.password) {
      throw fail(
        account.mustChangePassword
          ? `Password sementara untuk akun baru minimal ${MIN_TEMPORARY_PASSWORD_LENGTH} karakter.`
          : `Password untuk akun baru minimal ${MIN_PASSWORD_LENGTH} karakter.`,
        400,
        'WEAK_PASSWORD'
      );
    }
    // Password backup hanya divalidasi bila memang akan dipakai; adopsi akun
    // cloud yang sudah punya kredensial tidak pernah memakainya.
    if (account.password && !sameUsername) {
      if (account.mustChangePassword) {
        assertTemporaryPassword(account.username, account.password);
      } else {
        assertPasswordPolicy(account.username, account.password);
      }
    }
    const credentialPolicy = account.mustChangePassword
      ? assertTemporaryPassword
      : assertPasswordPolicy;

    if (sameUsername) {
      // Orang yang sama sudah ada di cloud dengan id lain (restore dari
      // perangkat lain). Profil disamakan, tetapi id cloud, status aktif, dan
      // password yang berlaku tidak ditimpa data backup supaya sesi/perangkat
      // lain tidak kehilangan akses. Foto profil cloud juga dipertahankan.
      const entry: DirectoryEntry = {
        ...account,
        id: sameUsername.id,
        role: sameUsername.role || account.role,
        isActive: sameUsername.isActive,
        createdAt: sameUsername.createdAt || account.createdAt,
        authId: sameUsername.authId,
        presence: sameUsername.presence,
        recordId: sameUsername.recordId,
        password: '',
        avatarUrl: sameUsername.avatarUrl || account.avatarUrl,
        mustChangePassword: Boolean(sameUsername.mustChangePassword),
      };

      if (!entry.authId) {
        if (!account.password) {
          throw fail(
            `Akun "${account.username}" sudah ada di cloud tetapi belum punya kredensial. Isi password akun itu lewat menu Pengguna.`,
            409,
            'CREDENTIAL_MISSING'
          );
        }
        credentialPolicy(account.username, account.password);
        entry.password = account.password;
        entry.mustChangePassword = account.mustChangePassword;
        entry.authId = await saveCredential(pb, entry, credentialPolicy);
      }

      await writeDirectory(pb, entry);
      return { id: entry.id, adopted: true };
    }

    const entry: DirectoryEntry = {
      ...account,
      authId: existing?.authId || '',
      presence: existing?.presence || { isOnline: false, lastActiveAt: 0, lastLoginAt: 0 },
      recordId: existing?.recordId,
      // Foto & flag hanya berubah bila benar-benar dikirim/diganti; penyimpanan
      // akun dari perangkat lain tidak boleh menghapus profil mandiri user.
      avatarUrl: account.avatarUrl || existing?.avatarUrl || '',
      mustChangePassword: account.password
        ? account.mustChangePassword
        : Boolean(existing?.mustChangePassword),
    };

    entry.authId = await saveCredential(pb, entry, credentialPolicy);
    await writeDirectory(pb, entry);
    return { id: entry.id, adopted: false };
  });
}

async function deleteAccount(appId: string): Promise<void> {
  if (RESERVED_USER_IDS.has(appId)) {
    throw fail('Akun developer tidak dapat dihapus dari aplikasi.', 400, 'ACCOUNT_RESERVED');
  }
  await runAsAdmin(async (pb) => {
    const entry = await findDirectoryByAppId(pb, appId);
    if (!entry) throw fail('Akun tidak ditemukan di database cloud.', 404, 'ACCOUNT_NOT_FOUND');
    await assertNotSyncCredential(pb, entry.authId);
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

    const aliveAuth = new Set(credentials.map((r) => String(r.id)));
    const byAuthId = new Map(entries.map((e) => [e.authId, e]));
    const byAppId = new Set(entries.map((e) => e.id));
    // Username hanya boleh punya satu baris direktori yang hidup; tanpa ini record
    // kredensial yatim (sisa restore lama) melahirkan akun kembar ber-id sintetis.
    const byUsername = new Set(
      entries.filter((e) => !e.authId || aliveAuth.has(e.authId)).map((e) => e.username)
    );
    const syncEmail = String(process.env.PB_SYNC_EMAIL || '').trim().toLowerCase();
    // Record sinkronisasi tidak boleh punya baris direktori: baris itu tampil di
    // Hak Akses dan bisa direset/di-restore, memutus token realtime semua user.
    const syncId = await findSyncCredentialId(pb);

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
      if (RESERVED_USER_IDS.has(legacyId) || byAppId.has(legacyId) || byUsername.has(username)) {
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
        avatarUrl: String(record.avatarUrl || mirror.avatarUrl || ''),
        mustChangePassword:
          record.mustChangePassword === true || mirror.mustChangePassword === true,
      });
      byAppId.add(legacyId);
      byUsername.add(username);
      added += 1;
    }

    // Baris direktori yang record kredensialnya sudah dihapus dari PocketBase
    // atau yang menunjuk akun sinkronisasi (sisa restore lama).
    let removed = 0;
    for (const entry of entries) {
      if (syncId && entry.authId === syncId) {
        await pb.collection(DIR_COLLECTION).delete(entry.recordId!).catch(() => undefined);
        removed += 1;
        continue;
      }
      if (entry.authId && !aliveAuth.has(entry.authId)) {
        await pb.collection(DIR_COLLECTION).delete(entry.recordId!).catch(() => undefined);
        removed += 1;
      }
    }

    return { added, kept, removed };
  });
}

/* ---------------------------------------------------------------------- */
/*  Profil mandiri (setiap user)                                           */
/* ---------------------------------------------------------------------- */

/**
 * Perubahan profil oleh pemilik akun sendiri. Nama tampilan & foto boleh
 * diubah bebas; mengganti username atau password wajib menyertakan password
 * saat ini. Akun developer tidak punya baris direktori, jadi ditolak.
 */
async function updateOwnAccount(req: Request, res: Response) {
  const session = getPosSession(req);
  const appId = String(session?.uid || '').trim();
  const role = String(session?.role || '').toUpperCase();
  if (!session || !appId) throw fail('Sesi dashboard tidak dikenali.', 401, 'AUTH_REQUIRED');
  if (role === 'DEVELOPER' || RESERVED_USER_IDS.has(appId)) {
    throw fail(
      'Akun developer dikelola lewat server (DEV_USERNAME / DEV_PASSWORD_HASH), bukan dari menu profil.',
      403,
      'PROFILE_DEVELOPER_LOCKED'
    );
  }

  const account = (await loadStaffAccounts()).find((item) => item.id === appId);
  if (!account) throw fail('Akun tidak ditemukan di database cloud.', 404, 'ACCOUNT_NOT_FOUND');
  if (!account.isActive) throw fail('Akun ini sedang dinonaktifkan.', 403, 'ACCOUNT_INACTIVE');

  const body = req.body || {};
  const name = body.name === undefined ? account.name : String(body.name).trim();
  if (name.length < 3) {
    throw fail('Nama tampilan wajib diisi (minimal 3 karakter).', 400, 'INVALID_NAME');
  }
  if (name.length > 80) {
    throw fail('Nama tampilan maksimal 80 karakter.', 400, 'INVALID_NAME');
  }

  const username =
    body.username === undefined
      ? account.username
      : String(body.username).trim().toLowerCase();
  const usernameProblem = checkUsernameFormat(username);
  if (usernameProblem) throw fail(usernameProblem, 400, 'INVALID_USERNAME');

  const avatarUrl =
    body.avatarUrl === undefined ? account.avatarUrl : normalizeAvatarUrl(body.avatarUrl);
  const newPassword = String(body.newPassword ?? '').trim();
  const currentPassword = String(body.currentPassword ?? '');
  const usernameChanged = username !== account.username;
  // Password sementara + password baru = sesi ini sudah cukup sebagai bukti
  // identitas. Tanpa pengecualian ini, user yang password-nya baru direset
  // Developer saat sesi masih berjalan akan terkunci di modal profil.
  const temporaryBypass =
    account.mustChangePassword && Boolean(newPassword) && !usernameChanged;

  if ((usernameChanged || newPassword) && !temporaryBypass && !currentPassword) {
    throw fail(
      'Masukkan password saat ini untuk mengganti username atau password.',
      400,
      'CURRENT_PASSWORD_REQUIRED'
    );
  }
  if ((usernameChanged || newPassword) && !temporaryBypass) {
    const valid = await verifyStaffPassword(account, currentPassword);
    if (!valid) throw fail('Password saat ini salah.', 401, 'INVALID_CURRENT_PASSWORD');
  }
  if (newPassword) {
    const problem = checkPasswordPolicy(username, newPassword);
    if (problem) throw fail(problem.message, 400, problem.code);
  }
  if (usernameChanged && username === getDevUsername().trim().toLowerCase()) {
    throw fail(`Username "${username}" dicadangkan untuk akun developer.`, 400, 'USERNAME_RESERVED');
  }

  await runAsAdmin(async (pb) => {
    const entry = await findDirectoryByAppId(pb, appId);
    if (!entry) throw fail('Akun belum terdaftar di database cloud.', 404, 'ACCOUNT_NOT_FOUND');
    if (usernameChanged) {
      const other = await findDirectoryByUsername(pb, username, appId);
      if (other) throw fail(`Username "${username}" sudah dipakai akun lain.`, 409, 'USERNAME_TAKEN');
    }

    entry.username = username;
    entry.name = name;
    entry.avatarUrl = avatarUrl;
    if (newPassword) {
      entry.password = newPassword;
      // Password baru buatan user sendiri: kewajiban ganti password selesai.
      entry.mustChangePassword = false;
    }
    if (entry.authId || newPassword) {
      // Email kredensial mengikuti username baru. Bila bentrok, staffStore
      // mempertahankan email lama; login tidak bergantung pada email.
      entry.authId = await saveCredential(pb, entry, assertPasswordPolicy);
    }
    await writeDirectory(pb, entry);
  });

  // Sesi lama membawa username/nama lama; terbitkan ulang tanpa memaksa logout.
  issueStaffSession(req, res, { uid: appId, uname: username, name, role: account.role });

  return {
    id: appId,
    username,
    name,
    role: account.role,
    phone: account.phone,
    spkRoleCategory: account.spkRoleCategory,
    isActive: account.isActive,
    createdAt: account.createdAt,
    password: PASSWORD_MASK,
    avatarUrl,
    mustChangePassword: false,
  };
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

/**
 * Ringkas penolakan per field dari PocketBase, mis.
 * { email: "The email is invalid or already in use." }. Tanpa ini pesan
 * "Failed to create record." tidak memberi tahu field mana yang bermasalah.
 */
function pocketbaseFieldDetails(data: unknown): Record<string, string> {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(data as Record<string, any>)) {
    const message = String(value?.message || '').trim();
    if (message) out[field] = message;
  }
  return out;
}

function sendUserError(res: Response, error: unknown): void {
  res.setHeader('Cache-Control', 'no-store');
  if (error instanceof StaffStoreError) {
    res.status(error.status).json({ success: false, code: error.code, error: error.message });
    return;
  }
  const err = error as { status?: number; message?: string; response?: { data?: any } };
  const pbData = err?.response?.data;
  const pbMessage = String(pbData?.message || err?.message || 'Terjadi kesalahan pada server.');
  const details = pocketbaseFieldDetails(pbData);
  const status = err?.status === 400 ? 400 : err?.status === 404 ? 404 : 502;
  console.error('[UserAdmin] Gagal memproses permintaan:', error);
  res.status(status).json({
    success: false,
    code: 'POCKETBASE_REJECTED',
    error: `PocketBase menolak permintaan: ${pbMessage}`,
    ...(Object.keys(details).length ? { details } : {}),
  });
}

export function registerUserAdminRoutes(app: Express): void {
  // Simpan/buat akun staf. Browser tidak pernah menulis koleksi auth `users`.
  app.post('/api/users', requirePosSession, async (req, res) => {
    try {
      assertSameOrigin(req);
      requireManageRole(req);
      const account = normalizeAccount(req.body);
      const saved = await saveAccount(account);
      res.json({
        success: true,
        id: saved.id,
        username: account.username,
        adopted: saved.adopted,
      });
    } catch (error) {
      sendUserError(res, error);
    }
  });

  // Profil mandiri: setiap staf boleh mengubah nama tampilan, foto, username,
  // dan password-nya sendiri. Kebijakan kredensial tetap ditegakkan di server.
  app.post('/api/users/me', requirePosSession, async (req, res) => {
    try {
      assertSameOrigin(req);
      const user = await updateOwnAccount(req, res);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, user });
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
