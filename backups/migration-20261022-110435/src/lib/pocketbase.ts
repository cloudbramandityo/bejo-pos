import PocketBase, { RecordModel, RecordAuthResponse, Admin } from 'pocketbase';

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 
  (import.meta.env.PROD ? 'https://bejodigitalprint.com/api/pb' : 'http://localhost:8090');

export const pb = new PocketBase(
  import.meta.env.VITE_POCKETBASE_URL || 
  (import.meta.env.PROD ? 'https://bejodigitalprint.com/api/pb' : 'http://localhost:8090')
);

// Auto-reconnect on auth change
pb.authStore.onChange((token, model) => {
  console.log('[PocketBase] Auth state changed:', model ? 'authenticated' : 'logged out');
});

// Auto-reconnect on network issues
pb.autoCancellation(false);

// Helper untuk handle error
export function handlePBError(error: unknown): never {
  if (error instanceof Response) {
    throw new Error(`PB Error: ${error.status} ${error.statusText}`);
  }
  if (error instanceof Error) {
    throw new Error(`PB Error: ${error.message}`);
  }
  throw new Error('Unknown PocketBase error');
}

// Type helpers
export type PBRecord = RecordModel;
export type PBAdmin = Admin;
export type PBRecordAuthResponse = RecordAuthResponse;

// Helper untuk transform PocketBase record ke format aplikasi
export function transformPBRecord<T>(record: RecordModel): T {
  return {
    id: record.id,
    ...record,
    // Convert PocketBase special fields
    created: record.created,
    updated: record.updated,
    collectionId: record.collectionId,
    collectionName: record.collectionName,
    expand: record.expand,
  } as T;
}

// Helper untuk pagination
export interface PBListResult<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  page: number;
  perPage: number;
}

export async function getFullList<T>(
  collection: string, 
  options?: { 
    filter?: string; 
    sort?: string; 
    perPage?: number; 
    page?: number;
    expand?: string;
  }
): Promise<Array<RecordModel>> {
  const pb = getPB();
  return pb.collection(collection).getFullList({
    filter: options?.filter,
    sort: options?.sort,
    perPage: options?.perPage || 200,
    page: options?.page || 1,
    expand: options?.expand,
  });
}

// Helper untuk real-time subscriptions
export function subscribeToCollection<T>(
  collection: string,
  callback: (records: RecordModel[]) => void,
  options?: { filter?: string; sort?: string; expand?: string }
) {
  const pb = getPB();
  return pb.collection('products').subscribe('*', (e) => {
    // Refetch all data on change (simpler approach)
    // Or implement incremental updates based on e.action
    fetchAllAndNotify();
  });
}

// Singleton instance
let pbInstance: PocketBase | null = null;

export function getPB(): PocketBase {
  if (!pbInstance) {
    pbInstance = new PocketBase(
      import.meta.env.VITE_POCKETBASE_URL || 
      (import.meta.env.PROD ? 'https://bejodigitalprint.com/api/pb' : 'http://localhost:8090')
    );
    
    // Auto-reconnect on auth change
    pb.authStore.onChange((token, model) => {
      console.log('[PocketBase] Auth state changed:', model ? 'authenticated' : 'logged out');
    });
  }
  return pbInstance;
}

export default pb;