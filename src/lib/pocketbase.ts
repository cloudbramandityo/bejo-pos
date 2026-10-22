import PocketBase, { RecordModel } from 'pocketbase';

const POCKETBASE_URL =
  (import.meta.env.VITE_POCKETBASE_URL as string) ||
  (import.meta.env.PROD ? 'https://bejodigitalprint.com/api/pb' : 'http://localhost:8090');

/** Klien PocketBase tunggal (singleton) */
let pbInstance: PocketBase | null = null;

export function getPB(): PocketBase {
  if (!pbInstance) {
    pbInstance = new PocketBase(POCKETBASE_URL);

    // Auto-cancel request saat komponen unmount
    pbInstance.autoCancellation(false);

    // Pantau perubahan session
    pbInstance.authStore.onChange((_token, model) => {
      console.log('[PocketBase] Auth:', model ? `authenticated (${model.email})` : 'logged out');
    });
  }
  return pbInstance;
}

export const pb = getPB();

export type PBRecord = RecordModel;

/** Ubah record PocketBase menjadi objek biasa (buang field internal) */
export function transformPBRecord<T>(record: RecordModel): T {
  const { collectionId, collectionName, expand, ...rest } = record as any;
  return { id: record.id, ...rest } as T;
}

/** Error handler seragam */
export function handlePBError(error: unknown): never {
  if (error instanceof Response) {
    throw new Error(`PocketBase Error: ${error.status} ${error.statusText}`);
  }
  if (error instanceof Error) {
    throw new Error(`PocketBase Error: ${error.message}`);
  }
  throw new Error('Unknown PocketBase error');
}

/**
 * Subscribe realtime dengan penangan unsubscribe yang serinkron.
 * `collection.subscribe()` pada SDK v0.21+ mengembalikan Promise<UnsubscribeFunc>.
 */
export function subscribeRealtime(
  service: { subscribe: (topic: string, cb: (e: any) => void) => any },
  topic: string,
  callback: (e: any) => void
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  try {
    const result = service.subscribe(topic, callback);
    if (result && typeof result.then === 'function') {
      result
        .then((fn: any) => {
          if (cancelled) {
            try {
              fn?.();
            } catch {}
          } else {
            unsub = fn;
          }
        })
        .catch(() => {});
    } else if (typeof result === 'function') {
      unsub = result;
    }
  } catch {
    /* abaikan */
  }

  return () => {
    cancelled = true;
    if (unsub) {
      try {
        unsub();
      } catch {}
      unsub = null;
    }
  };
}

export default pb;
