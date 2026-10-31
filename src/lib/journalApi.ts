import type { JournalSettings } from '../utils/journalStorage';

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
  /** Peran dari sesi dashboard, atau null bila belum login. */
  dashboardRole: string | null;
  /** Boleh membaca data Jurnal (punya cookie Jurnal ATAU peran OWNER/ADMIN). */
  canRead: boolean;
  /** Boleh menyimpan data Jurnal (cookie DEVELOPER aktif). */
  canWrite: boolean;
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

export interface JournalConfigResponse {
  settings: JournalSettings | null;
  updated?: string | null;
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
    dashboardRole: data.dashboardRole || null,
    canRead: Boolean(data.canRead),
    canWrite: Boolean(data.canWrite),
    configured: data.configured,
  };
}

async function renewJournalSession(): Promise<JournalSessionInfo> {
  await request<{ success: true }>('/api/journal/session', {
    method: 'POST',
    body: JSON.stringify({ renew: true }),
  });
  return getJournalSession();
}

/**
 * Memastikan pemanggil boleh membaca data Jurnal.
 *
 * - DEVELOPER dengan cookie Jurnal kedaluwarsa (masa berlaku 8 jam) diperbarui
 *   otomatis lewat sesi dashboard, jadi tombol "Coba lagi" benar-benar bekerja.
 * - OWNER/ADMIN tidak pernah punya cookie itu; mereka membaca memakai sesi
 *   dashboard, sehingga tidak perlu diminta login developer.
 */
export async function ensureJournalSession(): Promise<JournalSessionInfo> {
  const info = await getJournalSession();
  if (info.authenticated) return info;
  if (info.dashboardRole === 'DEVELOPER') {
    const renewed = await renewJournalSession();
    if (renewed.authenticated) return renewed;
  }
  if (info.canRead) return info;

  throw new JournalApiError(
    'Sesi login dashboard belum aktif atau sudah berakhir. Login ulang, lalu klik Coba lagi.',
    401
  );
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

export async function loadJournalConfig(): Promise<JournalConfigResponse> {
  const data = await request<{ success: true } & JournalConfigResponse>('/api/journal/config');
  return {
    settings: data.settings ?? null,
    updated: data.updated ?? null,
  };
}

export async function saveJournalConfig(settings: JournalSettings): Promise<JournalConfigResponse> {
  const data = await request<{ success: true } & JournalConfigResponse>('/api/journal/config', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
  return {
    settings: data.settings ?? null,
    updated: data.updated ?? null,
  };
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
