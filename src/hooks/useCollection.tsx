import { useState, useEffect, useCallback } from 'react';
import { getPB } from '../lib/pocketbase';

export interface UseCollectionOptions {
  collection: string;
  filter?: string;
  sort?: string;
  perPage?: number;
  page?: number;
  expand?: string;
  enabled?: boolean;
}

export function useCollection(options: UseCollectionOptions) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { collection, filter, sort, perPage, page, expand, enabled = true } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const pb = getPB();
      const result = await pb.collection(collection).getList(1, perPage || 500, {
        filter,
        sort: sort || '-created',
        expand,
      });
      setData(result.items as any[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [collection, filter, sort, perPage, page, expand, enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();

    // Realtime: refetch saat ada perubahan
    const pb = getPB();
    const channel = pb.collection(collection).subscribe('*', () => {
      fetchData();
    });

    return () => {
      Promise.resolve(channel).then((unsub: any) => {
        try {
          unsub?.();
        } catch {}
      });
    };
  }, [collection, enabled, filter, sort]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
