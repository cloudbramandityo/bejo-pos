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
): Promise<void> {
  await request('/api/journal/session', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
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
