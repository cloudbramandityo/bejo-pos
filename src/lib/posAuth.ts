/**
 * Klien sesi dashboard (POS).
 *
 * Semua password diverifikasi server. Browser hanya menerima profil user dan
 * cookie HttpOnly; tidak ada password yang disimpan di localStorage.
 */
export class PosAuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'PosAuthError';
    this.status = status;
    this.code = code;
  }
}

export interface AccountUser {
  id: string;
  username: string;
  name: string;
  role: string;
  phone?: string;
  spkRoleCategory?: string;
  isActive?: boolean;
  createdAt?: string;
  /** Foto profil terkompresi (data URL) atau tautan https. */
  avatarUrl?: string;
  /** Password masih sementara dari Developer dan wajib diganti. */
  mustChangePassword?: boolean;
}

export interface LoginResult {
  user: AccountUser;
  expiresAt: string | null;
  publicSite: boolean;
  developer: boolean;
}

export interface AccountSessionInfo {
  authenticated: boolean;
  user: AccountUser | null;
  expiresAt: string | null;
  publicSite: boolean;
}

export interface SiteMode {
  publicSite: boolean;
  mode: 'public' | 'private' | 'locked';
  staffLoginReady: boolean;
  developerLoginReady: boolean;
}

export async function loginAccount(
  username: string,
  password: string
): Promise<LoginResult> {
  let response: Response;
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new PosAuthError(
      'Server tidak dapat dihubungi. Periksa koneksi jaringan.',
      0,
      'NETWORK_ERROR'
    );
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new PosAuthError(
      data?.error || `Login gagal (HTTP ${response.status}).`,
      response.status,
      data?.code || 'AUTH_ERROR'
    );
  }

  return {
    user: data.user as AccountUser,
    expiresAt: data.expiresAt || null,
    publicSite: Boolean(data.publicSite),
    developer: Boolean(data.developer),
  };
}

export async function getAccountSession(): Promise<AccountSessionInfo> {
  const response = await fetch('/api/auth/me', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new PosAuthError(
      data?.error || `Gagal memeriksa sesi (HTTP ${response.status}).`,
      response.status,
      data?.code || 'AUTH_ERROR'
    );
  }
  return {
    authenticated: Boolean(data.authenticated),
    user: (data.user as AccountUser) || null,
    expiresAt: data.expiresAt || null,
    publicSite: Boolean(data.publicSite),
  };
}

export interface ProfileUpdateInput {
  name?: string;
  username?: string;
  /** Data URL hasil kompresi di browser; string kosong menghapus foto. */
  avatarUrl?: string;
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Simpan perubahan profil akun sendiri. Server memverifikasi password saat
 * ini sebelum username/password diganti, lalu menerbitkan ulang cookie sesi.
 */
export async function updateMyAccount(input: ProfileUpdateInput): Promise<AccountUser> {
  let response: Response;
  try {
    response = await fetch('/api/users/me', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new PosAuthError(
      'Server tidak dapat dihubungi. Periksa koneksi jaringan.',
      0,
      'NETWORK_ERROR'
    );
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new PosAuthError(
      data?.error || `Profil gagal disimpan (HTTP ${response.status}).`,
      response.status,
      data?.code || 'PROFILE_ERROR'
    );
  }
  return data.user as AccountUser;
}

export async function getSiteMode(): Promise<SiteMode> {  const response = await fetch('/api/auth/mode', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new PosAuthError(
      data?.error || `Gagal membaca mode situs (HTTP ${response.status}).`,
      response.status,
      data?.code || 'AUTH_ERROR'
    );
  }
  return {
    publicSite: Boolean(data.publicSite),
    mode: data.mode === 'private' || data.mode === 'locked' ? data.mode : 'public',
    staffLoginReady: Boolean(data.staffLoginReady),
    developerLoginReady: Boolean(data.developerLoginReady),
  };
}

export async function logoutAccount(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new PosAuthError(`Logout gagal (HTTP ${response.status}).`, response.status);
  }
}
