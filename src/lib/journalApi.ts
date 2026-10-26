import { getDeveloperAccess } from '../utils/authSecurity';

export type JurnalHalaman = 'kas_utama' | 'debit' | 'kredit';

export interface JurnalRecord {
  id: string;
  tahun: number;
  halaman: JurnalHalaman;
  data_grid: Record<string, unknown>;
  updated_by?: string;
  updated_by_name?: string;
  updated?: string;
}

export interface JournalSessionInfo {
  authenticated: boolean;
  username: string | null;
  configured: {
    developerLogin: boolean;
    pocketbaseAdmin: boolean;
    sessionSecret: boolean;
  };
}

export interface JurnalSheetsResponse {
  tahun: number;
  sheets: Record<JurnalHalaman, JurnalRecord | null>;
}

export class JournalApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new JournalApiError(
      data?.error || `Permintaan Jurnal gagal (HTTP ${response.status}).`,
      response.status
    );
  }
  return data as T;
}

export async function getJournalSession(): Promise<JournalSessionInfo> {
  const data = await request<{ success: true } & JournalSessionInfo>('/api/journal/session');
  return {
    authenticated: Boolean(data.authenticated),
    username: data.username || null,
    configured: data.configured,
  };
}

export async function openJournalSession(
  username: string,
  password: string
): Promise<{ username: string; expiresAt: string }> {
  const data = await request<{ success: true; username: string; expiresAt: string }>(
    '/api/journal/session',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }
  );
  return { username: data.username, expiresAt: data.expiresAt };
}

export async function ensureJournalSession(): Promise<JournalSessionInfo> {
  const info = await getJournalSession();
  if (info.authenticated) return info;

  if (!info.configured.developerLogin) {
    throw new JournalApiError(
      'JOURNAL_DEV_PASSWORD belum disetel di server. Lengkapi .env VPS lalu restart layanan.',
      503
    );
  }
  if (!info.configured.sessionSecret) {
    throw new JournalApiError(
      'JOURNAL_SESSION_SECRET (atau PB_ADMIN_PASSWORD) belum disetel di server.',
      503
    );
  }

  const access = getDeveloperAccess();
  try {
    const session = await openJournalSession(access.username, access.password);
    return { ...info, authenticated: true, username: session.username };
  } catch (error) {
    if (error instanceof JournalApiError && error.status === 401) {
      throw new JournalApiError(
        'Kredensial DEVELOPER di server belum cocok dengan akun aplikasi. Periksa JOURNAL_DEV_USER / JOURNAL_DEV_PASSWORD di .env VPS.',
        401
      );
    }
    throw error;
  }
}

export async function withJournalSession<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof JournalApiError && error.status === 401) {
      await ensureJournalSession();
      return action();
    }
    throw error;
  }
}

export async function closeJournalSession(): Promise<void> {
  await request('/api/journal/session', { method: 'DELETE' });
}

export async function loadJurnalSheets(tahun: number): Promise<JurnalSheetsResponse> {
  return request<JurnalSheetsResponse>(`/api/journal/sheets?tahun=${tahun}`);
}

export async function saveJurnalSheet(input: {
  tahun: number;
  halaman: JurnalHalaman;
  dataGrid: Record<string, unknown>;
  keepalive?: boolean;
}): Promise<JurnalRecord> {
  const data = await request<{ record: JurnalRecord }>('/api/journal/sheets', {
    method: 'PUT',
    body: JSON.stringify({
      tahun: input.tahun,
      halaman: input.halaman,
      dataGrid: input.dataGrid,
    }),
    keepalive: input.keepalive,
  });
  return data.record;
}
