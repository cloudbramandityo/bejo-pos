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
    data: { ...flat, id: entry.id },
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

/**
 * Perbarui record kredensial.
 * mengembalikan '' bila record sudah tidak ada (pemanggil harus membuat baru);
 * field `appPassword` dilepas bila skema PocketBase tidak mengenalnya.
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
    const message = JSON.stringify((err as { response?: { data?: any } })?.response?.data || '')
      .toLowerCase();
    if (status === 400 && message.includes('apppassword') && 'appPassword' in patch) {
      const { appPassword, ...rest } = patch;
      return updateCredential(pb, id, rest);
    }
    throw err;
  }
}

/** Buat/perbarui record kredensial; mengembalikan primary key record auth. */
export async function saveCredential(
  pb: PocketBase,
  entry: DirectoryEntry,
  passwordPolicy?: (password: string) => void
): Promise<string> {
  const email = credentialEmail(entry.username, entry.id);

  if (entry.authId) {
    const patch: Record<string, unknown> = { email };
    if (entry.password) {
      patch.password = entry.password;
      // PocketBase mewajibkan konfirmasi berpasangan saat mengganti password.
      patch.passwordConfirm = entry.password;
      // Kosongkan salinan plaintext lama supaya password baru yang dipakai.
      patch.appPassword = '';
    }
    const found = await updateCredential(pb, entry.authId, patch);
    if (found) return found;
    entry.authId = '';
  }

  const byEmail = await pb
    .collection(AUTH_COLLECTION)
    .getFullList({ filter: `email = "${filterValue(email)}"`, requestKey: null })
    .catch(() => [] as any[]);
  const linked = byEmail.find((r) => !r.legacyId || String(r.legacyId) === entry.id);
  if (linked) {
    const patch: Record<string, unknown> = { name: entry.name };
    if (entry.password) {
      patch.password = entry.password;
      patch.passwordConfirm = entry.password;
      patch.appPassword = '';
    }
    const found = await updateCredential(pb, String(linked.id), patch);
    if (found) return found;
    // Record tidak bisa diperbarui: jatuh ke pembuatan record baru.
  }

  if (entry.password && passwordPolicy) passwordPolicy(entry.password);

  const createBody: Record<string, unknown> = {
    email,
    name: entry.name,
    password: entry.password,
    passwordConfirm: entry.password,
  };
  // Field kustom hanya dikirim bila benar-benar ada di skema, supaya PocketBase
  // tidak menolak request karena field tak dikenal.
  createBody.legacyId = entry.id;
  try {
    const created: any = await pb.collection(AUTH_COLLECTION).create(createBody);
    return String(created?.id || '');
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const data = (err as { response?: { data?: any } })?.response?.data;
    const message = JSON.stringify(data || '').toLowerCase();
    if (status !== 400) throw err;
    if (!message.includes('email') && !message.includes('unknown')) throw err;

    // Email sudah dipakai (akun lama dari versi sebelumnya) atau skema `users`
    // belum punya field legacyId: pakai email unik tanpa field tambahan.
    const fallbackBody: Record<string, unknown> = {
      email: `${entry.username}-${filterValue(entry.id)}@${CREDENTIAL_EMAIL_DOMAIN}`,
      name: entry.name,
      password: entry.password,
      passwordConfirm: entry.password,
    };
    const created: any = await pb.collection(AUTH_COLLECTION).create(fallbackBody);
    return String(created?.id || '');
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
        email: String(auth?.email || credentialEmail(entry.username, entry.id)),
        appPassword: String(auth?.appPassword || ''),
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
