/**
 * Klien sesi DEVELOPER.
 *
 * Password developer tidak pernah dikirim ke bundle; verifikasi dilakukan
 * server dan hasilnya berupa cookie HttpOnly.
 */
export class DeveloperAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'DeveloperAuthError';
  }
}

export interface DeveloperSessionInfo {
  authenticated: boolean;
  username: string | null;
  expiresAt: string | null;
}

export async function loginDeveloper(
  username: string,
  password: string
): Promise<{ username: string; expiresAt: string }> {
  const response = await fetch('/api/auth/developer-login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new DeveloperAuthError(
      data?.error || `Login developer gagal (HTTP ${response.status}).`,
      response.status
    );
  }
  return { username: data.username, expiresAt: data.expiresAt };
}

export async function getDeveloperSession(): Promise<DeveloperSessionInfo> {
  const response = await fetch('/api/auth/session', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new DeveloperAuthError(
      data?.error || `Gagal memeriksa sesi developer (HTTP ${response.status}).`,
      response.status
    );
  }
  return {
    authenticated: Boolean(data.authenticated),
    username: data.username || null,
    expiresAt: data.expiresAt || null,
  };
}

export async function logoutDeveloper(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new DeveloperAuthError(`Logout gagal (HTTP ${response.status}).`, response.status);
  }
}
