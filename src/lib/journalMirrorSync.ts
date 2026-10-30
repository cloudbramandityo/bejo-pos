import {
  JournalApiError,
  ensureJournalSession,
  loadJournalConfig,
  saveJournalConfig,
  withJournalSession,
} from './journalApi';
import type { JournalSettings } from '../utils/journalStorage';

export type JournalCloudState = 'checking' | 'syncing' | 'synced' | 'local';

export type JournalMergeAction = 'adopt-remote' | 'push-local' | 'in-sync';

export interface RemoteJournalConfig {
  settings: JournalSettings | null;
  updated: string | null;
}

export function journalTimestamp(value?: string | null): number {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveJournalSettings(
  local: JournalSettings,
  remote: JournalSettings | null
): JournalMergeAction {
  if (!remote) return 'push-local';
  const localTime = journalTimestamp(local.savedAt);
  const remoteTime = journalTimestamp(remote.savedAt);
  if (remoteTime > localTime) return 'adopt-remote';
  if (localTime > remoteTime) return 'push-local';
  return 'in-sync';
}

export function shouldDisableJournalCloud(error: unknown): boolean {
  return error instanceof JournalApiError && (error.status === 401 || error.status === 503);
}

export function describeJournalCloudError(error: unknown): string {
  if (error instanceof JournalApiError) {
    if (error.status === 503) {
      return 'Belum bisa menyimpan ke server. Tautan tetap tersimpan di perangkat ini.';
    }
    if (error.status === 401) {
      return 'Sesi DEVELOPER tidak aktif. Klik Coba lagi untuk membuat sesi baru.';
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Gagal menyimpan ke server. Tautan tetap tersimpan di perangkat ini.';
}

export async function fetchRemoteJournalSettings(): Promise<RemoteJournalConfig> {
  await ensureJournalSession();
  return withJournalSession(async () => {
    const response = await loadJournalConfig();
    return { settings: response.settings, updated: response.updated ?? null };
  });
}

export async function pushRemoteJournalSettings(settings: JournalSettings): Promise<void> {
  await withJournalSession(() => saveJournalConfig(settings));
}
