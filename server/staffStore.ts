/**
 * Lapisan data akun staf.
 *
 * Ada dua koleksi dan keduanya sengaja terpisah:
 *   `app_users` (base) -> DIREKTORI staf: username, nama, role, status, presence.
 *                        Dibaca browser lewat realtime, TIDAK boleh ditulis browser.
 *   `users`     (auth) -> KREDENSIAL: email + password yang di-hash PocketBase.
 *                        Hanya boleh ditulis superuser, jadi tidak pernah bisa
 *                        dibaca/diubah dari browser.
 *
 * Kenapa tidak langsung tulis `users` seperti dulu?
 *   - Browser hanya memegang token akun sinkronisasi, sedangkan createRule
 *     koleksi auth kosong: setiap tulis akun berujung "Only superusers can
 *     perform this action." (persis kegagalan yang muncul saat restore backup).
 *   - Koleksi `users` bawaan PocketBase juga tidak punya field username/role/
 *     appPassword, jadi data akun dibuang diam-diam oleh server.
 *
 * Modul ini dipakai server/userAdmin.ts (tulis) DAN server/posAuth.ts (login),
 * jadi fungsi baca kredensial berada di satu tempat tanpa siklus impor.
 */
import crypto from 'crypto';
import PocketBase from 'pocketbase/cjs';

export const AUTH_COLLECTION = 'users';
export const DIR_COLLECTION = 'app_users';
export const CREDENTIAL_EMAIL_DOMAIN = 'staff.bejo.local';

/** Akun developer (sesi server) dan akun sinkronisasi tidak pernah masuk direktori. */
export const RESERVED_USER_IDS = new Set(['user_dev', 'sys_core_developer']);

const ADMIN_TOKEN_TTL_MS = 10 * 60_000;

export class StaffStoreError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'STAFF_STORE_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function env(name: string): string {
  return String(process.env[name] || '').trim();
}

export function pbUpstream(): string {
  return env('POCKETBASE_UPSTREAM') || 'http://127.0.0.1:8090';
}

export function adminConfigured(): boolean {
  return Boolean(env('PB_ADMIN_EMAIL') && env('PB_ADMIN_PASSWORD'));
}

/* ---------------------------------------------------------------------- */
/*  Bentuk data                                                            */
/* ---------------------------------------------------------------------- */

export interface AccountInput {
  id: string;
  username: string;
  name: string;
  role: string;
  phone: string;
  isActive: boolean;
  spkRoleCategory: string;
  createdAt: string;
  password: string;
  /** Foto profil terkompresi (data URL) atau URL https. */
  avatarUrl: string;
  /** Password sementara: user wajib mengganti kredensialnya saat login. */
  mustChangePassword: boolean;
}

export interface PresenceInput {
  isOnline?: boolean;
  lastActiveAt?: number;
  lastLoginAt?: number;
}

export interface DirectoryEntry extends AccountInput {
  authId: string;
  presence: PresenceInput;
  recordId?: string;
}

/** Hasil baca untuk modul login: direktori + petunjuk kredensialnya. */
export interface StaffAccount {
  id: string;
  username: string;
  name: string;
  role: string;
  phone: string;
  spkRoleCategory: string;
  isActive: boolean;
  createdAt: string;
  authId: string;
  email: string;
  /** appPassword lama (plaintext) bila record kredensialnya masih menyimpannya. */
  appPassword: string;
  avatarUrl: string;
  mustChangePassword: boolean;
}

/** Hanya id logis aplikasi yang boleh masuk filter PocketBase. */
export function safeAppId(raw: unknown): string {
  const id = String(raw ?? '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new StaffStoreError('Id akun tidak valid.', 400, 'INVALID_USER_ID');
  }
  return id;
}

export function filterValue(raw: string): string {
  return raw.replace(/[\\"]/g, '');
}

export function readPresence(record: any): PresenceInput {
  const mirror = record?.data && typeof record.data === 'object' ? record.data : {};
  return {
    isOnline: Boolean(record?.isOnline ?? mirror.isOnline ?? false),
    lastActiveAt: Number(record?.lastActiveAt ?? mirror.lastActiveAt ?? 0),
    lastLoginAt: Number(record?.lastLoginAt ?? mirror.lastLoginAt ?? 0),
  };
}

export function directoryFromRecord(record: any): DirectoryEntry | null {
  const mirror = record?.data && typeof record.data === 'object' ? record.data : {};
  const id = String(record?.legacyId || mirror.id || '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const username = String(record?.username || mirror.username || '').trim().toLowerCase();
  if (!username) return null;
  let role = String(record?.role || mirror.role || 'KASIR').trim().toUpperCase() || 'KASIR';
  if (role === 'DEVELOPER') role = 'ADMIN';
  return {
    id,
    username,
    name: String(record?.name || mirror.name || username).trim(),
    role,
    phone: String(record?.phone ?? mirror.phone ?? ''),
    isActive: record?.isActive !== false && mirror.isActive !== false,
    spkRoleCategory: String(record?.spkRoleCategory ?? mirror.spkRoleCategory ?? ''),
    createdAt: String(record?.createdAt || mirror.createdAt || ''),
    password: '',
    authId: String(record?.authId || mirror.authId || ''),
    presence: readPresence(record),
    recordId: String(record?.id || ''),
    // Profil mandiri disimpan di salinan `data` agar tidak memerlukan kolom
    // tambahan pada skema `app_users`.
    avatarUrl: String(record?.avatarUrl ?? mirror.avatarUrl ?? ''),
    mustChangePassword: record?.mustChangePassword === true || mirror.mustChangePassword === true,
  };
}

export function directoryPayload(entry: DirectoryEntry) {
  const flat = {
    legacyId: entry.id,
    name: entry.name,
    username: entry.username,
    role: entry.role,
    phone: entry.phone,
    isActive: entry.isActive,
    spkRoleCategory: entry.spkRoleCategory,
    createdAt: entry.createdAt,
    authId: entry.authId,
    isOnline: Boolean(entry.presence.isOnline),
    lastActiveAt: Number(entry.presence.lastActiveAt || 0),
    lastLoginAt: Number(entry.presence.lastLoginAt || 0),
  };
  return {
    ...flat,
    // Salinan utuh untuk aplikasi; sengaja tanpa password/email apa pun.
    // Profil mandiri (foto & flag ganti password) hanya hidup di sini agar
    // skema `app_users` tidak perlu kolom baru.
    data: {
      ...flat,
      id: entry.id,
      avatarUrl: entry.avatarUrl,
      mustChangePassword: entry.mustChangePassword,
    },
  };
}

export function credentialEmail(username: string, appId: string): string {
  const localPart = String(username || '')
    .replace(/[^a-z0-9._-]/g, '-')
    .toLowerCase();
  const primary = `${localPart}@${CREDENTIAL_EMAIL_DOMAIN}`;
  if (primary.length <= 254) return primary;
  return `${crypto.createHash('sha1').update(appId).digest('hex').slice(0, 24)}@${CREDENTIAL_EMAIL_DOMAIN}`;
}

/**
 * Email cadangan yang dipakai bila email utama sudah terpakai record lain.
 * Unik per id aplikasi, jadi selalu bisa dipakai ulang untuk akun yang sama.
 */
export function credentialFallbackEmail(username: string, appId: string): string {
  const localPart = String(username || '')
    .replace(/[^a-z0-9._-]/g, '-')
    .toLowerCase();
  return `${localPart}-${filterValue(appId)}@${CREDENTIAL_EMAIL_DOMAIN}`;
}

/**
 * Akun sinkronisasi PocketBase (PB_SYNC_EMAIL) memberi token realtime ke
 * browser. Record ini BUKAN staf: kalau ikut masuk direktori lalu tersentuh
 * reset password atau restore backup, seluruh aplikasi kehilangan sesi
 * PocketBase. Semua jalur tulis kredensial wajib melewati penjaga di bawah.
 */
export function syncAccountEmail(): string {
  return env('PB_SYNC_EMAIL').toLowerCase();
}

export function isSyncAccountEmail(email: unknown): boolean {
  const sync = syncAccountEmail();
  if (!sync) return false;
  return String(email ?? '').trim().toLowerCase() === sync;
}

/** Id record auth akun sinkronisasi, atau '' bila belum/tidak ditemukan. */
export async function findSyncCredentialId(pb: PocketBase): Promise<string> {
  const sync = syncAccountEmail();
  if (!sync) return '';
  const rows = await findCredential(pb, `email = "${filterValue(sync)}"`);
  return String(rows[0]?.id || '');
}

export function syncReservedError(): StaffStoreError {
  return new StaffStoreError(
    'Akun sinkronisasi PocketBase dikelola server dan tidak boleh diubah lewat aplikasi.',
    400,
    'ACCOUNT_RESERVED'
  );
}

/** Tolak perubahan pada record auth akun sinkronisasi. */
export async function assertNotSyncCredential(
  pb: PocketBase,
  authId: string
): Promise<void> {
  if (!authId) return;
  const syncId = await findSyncCredentialId(pb);
  if (syncId && authId === syncId) throw syncReservedError();
}

async function probeSyncLogin(email: string, password: string): Promise<boolean> {
  try {
    const pb = new PocketBase(pbUpstream());
    pb.autoCancellation(false);
    await pb.collection(AUTH_COLLECTION).authWithPassword(email, password);
    return true;
  } catch {
    return false;
  }
}

export type SyncAccountStatus = 'ok' | 'created' | 'repaired' | 'skipped' | 'failed';

let syncEnsureInflight: Promise<SyncAccountStatus> | null = null;

/**
 * Pulihkan akun sinkronisasi agar selalu sama dengan PB_SYNC_EMAIL/PB_SYNC_PASSWORD.
 *
 * `.env` adalah sumber kebenaran. Restore backup lama bisa menulis ulang email
 * atau password record ini (baris direktori yang menunjuk record sinkron),
 * sehingga broker kehilangan token dan seluruh aplikasi jatuh ke Mode Lokal.
 * Fungsi ini dipanggil saat boot dan sekali lagi ketika login sinkronisasi
 * ditolak, jadi gangguan yang sama pulih sendiri tanpa sentuh VPS.
 */
export function ensureSyncAccount(): Promise<SyncAccountStatus> {
  if (syncEnsureInflight) return syncEnsureInflight;

  syncEnsureInflight = (async (): Promise<SyncAccountStatus> => {
    const email = syncAccountEmail();
    const password = env('PB_SYNC_PASSWORD');
    if (!email || !password) return 'skipped';
    // Tanpa akses superuser tidak ada yang bisa ditulis; biarkan diagnostik
    // yang melaporkan, jangan menebak.
    if (!adminConfigured()) return 'skipped';
    if (await probeSyncLogin(email, password)) return 'ok';

    try {
      const outcome = await runAsAdmin(async (pb) => {
        const users = pb.collection(AUTH_COLLECTION);
        const byEmail = await users.getFullList({
          filter: `email = "${filterValue(email)}"`,
          requestKey: null,
        });
        let record = byEmail[0];
        if (!record) {
          // Email record sempat tertimpa (mis. menjadi ...@staff.bejo.local).
          const byUsername = await users
            .getFullList({ filter: `username = "sync"`, requestKey: null })
            .catch(() => [] as any[]);
          if (byUsername.length === 1) record = byUsername[0];
        }

        if (record) {
          await users.update(record.id, {
            email,
            password,
            passwordConfirm: password,
            isActive: true,
          });
          return 'repaired' as const;
        }

        const body: Record<string, unknown> = {
          email,
          password,
          passwordConfirm: password,
          name: 'Bejo Sync Service',
          isActive: true,
        };
        try {
          await users.create({ ...body, username: 'sync' });
        } catch (err) {
          // Skema `users` instalasi lama bisa menolak username; email tetap wajib.
          if ((err as { status?: number })?.status !== 400) throw err;
          await users.create(body);
        }
        return 'created' as const;
      });

      if (!(await probeSyncLogin(email, password))) {
        console.error('[StaffStore] Akun sinkronisasi masih ditolak setelah perbaikan; periksa PB_SYNC_EMAIL/PB_SYNC_PASSWORD.');
        return 'failed';
      }
      console.warn('[StaffStore] Akun sinkronisasi dipulihkan dari .env (email/password disamakan).');
      return outcome;
    } catch (err) {
      console.error('[StaffStore] Perbaikan akun sinkronisasi gagal:', (err as Error)?.message || err);
      return 'failed';
    }
  })().finally(() => {
    syncEnsureInflight = null;
  });

  return syncEnsureInflight;
}

/* ---------------------------------------------------------------------- */
/*  Klien PocketBase ber-akses superuser                                   */
/* ---------------------------------------------------------------------- */

let adminClient: PocketBase | null = null;
let adminValidUntil = 0;
let adminInflight: Promise<PocketBase> | null = null;

export function dropAdminClient(): void {
  adminClient = null;
  adminValidUntil = 0;
  adminInflight = null;
}

export function adminCredentialsMissing(): StaffStoreError {
  return new StaffStoreError(
    'Server belum dikonfigurasi untuk mengubah akun (PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD di .env).',
    503,
    'PB_ADMIN_UNCONFIGURED'
  );
}

export async function createAdminClient(): Promise<PocketBase> {
  const email = env('PB_ADMIN_EMAIL');
  const password = env('PB_ADMIN_PASSWORD');
  if (!email || !password) throw adminCredentialsMissing();
  if (adminClient && adminValidUntil > Date.now()) return adminClient;
  if (adminInflight) return adminInflight;

  adminInflight = (async () => {
    const pb = new PocketBase(pbUpstream());
    pb.autoCancellation(false);
    const rejected = () =>
      new StaffStoreError(
        'Kredensial admin PocketBase ditolak. Periksa PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD di .env.',
        503,
        'PB_ADMIN_AUTH_FAILED'
      );
    try {
      await pb.collection('_superusers').authWithPassword(email, password);
    } catch (primaryError) {
      const legacy = (pb as unknown as { admins?: { authWithPassword?: Function } }).admins;
      if (!legacy?.authWithPassword) throw rejected();
      try {
        await legacy.authWithPassword(email, password);
      } catch {
        throw rejected();
      }
    }
    adminClient = pb;
    adminValidUntil = Date.now() + ADMIN_TOKEN_TTL_MS;
    return pb;
  })().finally(() => {
    adminInflight = null;
  });

  return adminInflight;
}

/** Jalankan operasi admin; sekali percobaan ulang bila token superuser kedaluwarsa. */
export async function runAsAdmin<T>(fn: (pb: PocketBase) => Promise<T>): Promise<T> {
  const pb = await createAdminClient();
  try {
    return await fn(pb);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status !== 401 && status !== 403) throw err;
    dropAdminClient();
    const fresh = await createAdminClient();
    return fn(fresh);
  }
}

/* ---------------------------------------------------------------------- */
/*  Baca / tulis                                                           */
/* ---------------------------------------------------------------------- */

export async function listDirectoryByLegacyId(
  pb: PocketBase,
  appId: string
): Promise<DirectoryEntry[]> {
  const rows = await pb
    .collection(DIR_COLLECTION)
    .getFullList({ filter: `legacyId = "${filterValue(appId)}"`, requestKey: null })
    .catch(() => [] as any[]);
  return rows.map(directoryFromRecord).filter(Boolean) as DirectoryEntry[];
}

export async function findDirectoryByAppId(
  pb: PocketBase,
  appId: string
): Promise<DirectoryEntry | null> {
  const rows = await listDirectoryByLegacyId(pb, appId);
  return rows.length ? rows[0] : null;
}

export async function listAllDirectory(pb: PocketBase): Promise<DirectoryEntry[]> {
  const rows = await pb
    .collection(DIR_COLLECTION)
    .getFullList({ requestKey: null })
    .catch(() => [] as any[]);
  return rows.map(directoryFromRecord).filter(Boolean) as DirectoryEntry[];
}

export async function listAllCredentials(pb: PocketBase): Promise<any[]> {
  return pb
    .collection(AUTH_COLLECTION)
    .getFullList({ requestKey: null })
    .catch(() => [] as any[]);
}

export async function writeDirectory(pb: PocketBase, entry: DirectoryEntry): Promise<void> {
  const payload = directoryPayload(entry);
  if (entry.recordId) {
    await pb.collection(DIR_COLLECTION).update(entry.recordId, payload);
    return;
  }
  const existing = await findDirectoryByAppId(pb, entry.id);
  if (existing?.recordId) {
    await pb.collection(DIR_COLLECTION).update(existing.recordId, payload);
    return;
  }
  await pb.collection(DIR_COLLECTION).create(payload);
}

/** Field yang belum tentu ada di skema `users` instalasi lama. */
const OPTIONAL_CREDENTIAL_FIELDS = ['appPassword', 'legacyId'] as const;

function pbErrorMessage(err: unknown): string {
  return JSON.stringify((err as { response?: { data?: any } })?.response?.data || '').toLowerCase();
}

/**
 * Perbarui record kredensial.
 * mengembalikan '' bila record sudah tidak ada (pemanggil harus membuat baru);
 * field opsional (appPassword/legacyId) dilepas bila skema PocketBase menolaknya.
 */
async function updateCredential(
  pb: PocketBase,
  id: string,
  patch: Record<string, unknown>
): Promise<string> {
  try {
    const record: any = await pb.collection(AUTH_COLLECTION).update(id, patch);
    return String(record?.id || id);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 404) return '';
    if (status === 400) {
      const message = pbErrorMessage(err);
      const rejected =
        OPTIONAL_CREDENTIAL_FIELDS.find(
          (field) => field in patch && message.includes(field.toLowerCase())
        ) ||
        (message.includes('unknown')
          ? OPTIONAL_CREDENTIAL_FIELDS.find((field) => field in patch)
          : undefined);
      if (rejected) {
        const rest = { ...patch };
        delete rest[rejected];
        return updateCredential(pb, id, rest);
      }
    }
    throw err;
  }
}

/** Buat record kredensial; mengembalikan primary key record auth. */
async function createCredential(
  pb: PocketBase,
  body: Record<string, unknown>
): Promise<string> {
  const created: any = await pb.collection(AUTH_COLLECTION).create(body);
  return String(created?.id || '');
}

async function findCredential(
  pb: PocketBase,
  filter: string
): Promise<any[]> {
  return pb
    .collection(AUTH_COLLECTION)
    .getFullList({ filter, requestKey: null })
    .catch(() => [] as any[]);
}

/**
 * Pakai record kredensial yang sudah ada untuk akun ini: perbarui profil dan
 * password (bila dikirim), jangan pernah membuat record kembar. Email record
 * dipertahankan supaya tidak menabrak record lain.
 */
async function adoptCredential(
  pb: PocketBase,
  recordId: string,
  entry: DirectoryEntry
): Promise<string> {
  const patch: Record<string, unknown> = { name: entry.name, legacyId: entry.id };
  if (entry.password) {
    patch.password = entry.password;
    patch.passwordConfirm = entry.password;
    patch.appPassword = '';
  }
  return updateCredential(pb, recordId, patch);
}

/** Buat/perbarui record kredensial; mengembalikan primary key record auth. */
export async function saveCredential(
  pb: PocketBase,
  entry: DirectoryEntry,
  passwordPolicy?: (username: string, password: string) => void
): Promise<string> {
  const syncId = await findSyncCredentialId(pb);
  const guardSync = (recordId: string) => {
    if (syncId && recordId && recordId === syncId) throw syncReservedError();
  };
  const email = credentialEmail(entry.username, entry.id);
  const fallbackEmail = credentialFallbackEmail(entry.username, entry.id);

  if (entry.authId) {
    guardSync(entry.authId);
    const patch: Record<string, unknown> = { email };
    if (entry.password) {
      patch.password = entry.password;
      // PocketBase mewajibkan konfirmasi berpasangan saat mengganti password.
      patch.passwordConfirm = entry.password;
      // Kosongkan salinan plaintext lama supaya password baru yang dipakai.
      patch.appPassword = '';
    }
    let found = '';
    try {
      found = await updateCredential(pb, entry.authId, patch);
    } catch (err) {
      // Record ini memakai email cadangan karena email utama milik akun lain:
      // pertahankan email yang berlaku, cukup perbarui profil/password.
      if ((err as { status?: number })?.status !== 400 || !pbErrorMessage(err).includes('email')) {
        throw err;
      }
      const rest = { ...patch };
      delete rest.email;
      found = await updateCredential(pb, entry.authId, rest);
    }
    if (found) return found;
    entry.authId = '';
  }

  // Record lama bisa dikenali dari tiga penanda. Email cadangan WAJIB dicek:
  // percobaan restore sebelumnya bisa meninggalkan record dengan email cadangan
  // tanpa legacyId, dan tanpa pencarian ini setiap percobaan ulang berakhir
  // "Failed to create record." selamanya.
  const byAppId = await findCredential(pb, `legacyId = "${filterValue(entry.id)}"`);
  if (byAppId[0]) {
    guardSync(String(byAppId[0].id));
    return adoptCredential(pb, String(byAppId[0].id), entry);
  }

  const emailRows = await findCredential(pb, `email = "${filterValue(email)}"`);
  const linked = emailRows.find(
    (r) => !r.legacyId || String(r.legacyId) === entry.id
  );
  if (linked) {
    guardSync(String(linked.id));
    return adoptCredential(pb, String(linked.id), entry);
  }

  const fallbackRows = await findCredential(pb, `email = "${filterValue(fallbackEmail)}"`);
  if (fallbackRows[0]) {
    guardSync(String(fallbackRows[0].id));
    return adoptCredential(pb, String(fallbackRows[0].id), entry);
  }

  if (entry.password && passwordPolicy) passwordPolicy(entry.username, entry.password);

  const base: Record<string, unknown> = {
    name: entry.name,
    password: entry.password,
    passwordConfirm: entry.password,
  };

  try {
    return await createCredential(pb, { ...base, email, legacyId: entry.id });
  } catch (err) {
    if ((err as { status?: number })?.status !== 400) throw err;
    const message = pbErrorMessage(err);
    if (!message.includes('email')) {
      if (!message.includes('legacyid') && !message.includes('unknown')) throw err;
      // Skema `users` belum punya field legacyId.
      return createCredential(pb, { ...base, email });
    }

    // Email utama dipakai record lain. Email cadangan unik per id aplikasi dan
    // tetap membawa legacyId supaya record hasilnya bisa ditemukan lagi.
    try {
      return await createCredential(pb, { ...base, email: fallbackEmail, legacyId: entry.id });
    } catch (fallbackErr) {
      if ((fallbackErr as { status?: number })?.status !== 400) throw fallbackErr;
      const fallbackMessage = pbErrorMessage(fallbackErr);
      if (!fallbackMessage.includes('legacyid') && !fallbackMessage.includes('unknown')) {
        throw fallbackErr;
      }
      return createCredential(pb, { ...base, email: fallbackEmail });
    }
  }
}

/* ---------------------------------------------------------------------- */
/*  Baca untuk modul login                                                 */
/* ---------------------------------------------------------------------- */

/**
 * Direktori staf beserta petunjuk kredensialnya. Kosong berarti server belum
 * bisa membaca PocketBase (atau direktori memang belum dibangun).
 */
export async function loadStaffAccounts(): Promise<StaffAccount[]> {
  return runAsAdmin(async (pb) => {
    const [rows, credentials] = await Promise.all([
      listAllDirectory(pb),
      listAllCredentials(pb),
    ]);
    const authById = new Map(credentials.map((r) => [String(r.id), r]));

    const out: StaffAccount[] = [];
    for (const entry of rows) {
      if (RESERVED_USER_IDS.has(entry.id)) continue;
      const auth = entry.authId ? authById.get(entry.authId) : undefined;
      const email = String(auth?.email || credentialEmail(entry.username, entry.id));
      // Akun sinkronisasi tidak pernah tampil sebagai staf (pertahanan lapis
      // kedua bila baris direktori lama masih ada).
      if (isSyncAccountEmail(email)) continue;
      out.push({
        id: entry.id,
        username: entry.username,
        name: entry.name,
        role: entry.role,
        phone: entry.phone,
        spkRoleCategory: entry.spkRoleCategory,
        isActive: entry.isActive,
        createdAt: entry.createdAt,
        authId: entry.authId,
        email,
        appPassword: String(auth?.appPassword || ''),
        avatarUrl: entry.avatarUrl,
        mustChangePassword: entry.mustChangePassword,
      });
    }
    return out;
  });
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifikasi password staf. Record lama masih menyimpan `appPassword` plaintext
 * (sempat ikut tersinkron); record baru memakai password yang di-hash PocketBase.
 */
export async function verifyStaffPassword(
  account: StaffAccount,
  suppliedPassword: string
): Promise<boolean> {
  if (account.appPassword) return safeEqual(suppliedPassword, account.appPassword);
  if (!account.authId || !account.email) return false;
  try {
    const pb = new PocketBase(pbUpstream());
    pb.autoCancellation(false);
    await pb.collection(AUTH_COLLECTION).authWithPassword(account.email, suppliedPassword);
    return true;
  } catch {
    return false;
  }
}
