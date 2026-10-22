import { useState, useEffect } from 'react';
import { getPB } from '../lib/pocketbase';

export function useRecord(collection: string, id: string) {
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchRecord = async () => {
      try {
        setLoading(true);
        const pb = getPB();
        const result = await pb.collection(collection).getOne(id);
        if (!cancelled) setRecord(result);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecord();

    // Realtime
    const pb = getPB();
    const channel = pb.collection(collection).subscribe(id, (e: any) => {
      if (e.action === 'delete') {
        setRecord(null);
      } else {
        setRecord(e.record);
      }
    });

    return () => {
      cancelled = true;
      Promise.resolve(channel).then((unsub: any) => {
        try {
          unsub?.();
        } catch {}
      });
    };
  }, [collection, id]);

  return { record, loading, error };
}
