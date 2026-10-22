import { useState, useEffect, useCallback } from 'react';
import { getPB } from '../lib/pocketbase';
import type { RecordModel } from 'pocketbase';

export interface UseCollectionOptions<T> {
  collection: string;
  filter?: string;
  sort?: string;
  perPage?: number;
  page?: number;
  expand?: string;
  enabled?: boolean;
}

export function useCollection<T = any>(options: UseCollectionOptions<T>) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { collection, filter, sort, perPage, page, expand, enabled = true } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const pb = (await import('../lib/pocketbase')).getPB();
      const records = await pb.collection(collection).getFullList({
        filter: options?.filter,
        sort: options.sort || '-created',
        perPage: options.perPage || 200,
        page: options.page || 1,
        expand: options.expand,
      });
      setData(records);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [collection, options.filter, options.sort, options.perPage, options.page, options.expand, enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();

    // Subscribe to real-time updates
    const pb = (await import('../lib/pocketbase')).getPB();
    const unsubscribe = pb.collection(collection).subscribe('*', (e) => {
      // Re-fetch on any change (simple approach)
      fetchData();
    });

    return () => unsubscribe();
  }, [collection, enabled]);

  const refetch = useCallback(() => {
    fetchData();
  }, [collection, enabled]);

  return { data: data as any[], loading, error, refetch };
}