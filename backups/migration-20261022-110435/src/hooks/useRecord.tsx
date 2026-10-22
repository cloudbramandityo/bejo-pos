import { useState, useEffect } from 'react';
import { getPB } from '../lib/pocketbase';
import type { RecordModel } from 'pocketbase';

export function useRecord(collection: string, id: string) {
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchRecord = async () => {
      try {
        setLoading(true);
        const pb = (await import('../lib/pocketbase')).getPB();
        const record = await pb.collection(collection).getOne(id);
        setRecord(record);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();

    // Subscribe to real-time updates
    const pb = (async () => (await import('../lib/pocketbase')).getPB())();
    const unsubscribe = pb.collection(collection).subscribe('*', (e) => {
      if (e.record.id === id) {
        if (e.action === 'delete') {
          setRecord(null);
        } else {
          setRecord(e.record);
        }
      }
    });

    return () => unsubscribe();
  }, [collection, id]);

  return { record, loading, error };
}