import { useEffect, useState } from 'react';
import {
  LEDGER_ENTRIES_EVENT,
  getLedgerEntries,
} from '../utils/ledgerStorage';
import type { JournalEntry } from '../utils/ledgerMath';

/**
 * Daftar jurnal pembukuan untuk layar laporan. Ikut berubah bila perangkat lain
 * mencatat atau membalik jurnal.
 */
export function useLedgerEntries(): JournalEntry[] {
  const [entries, setEntries] = useState<JournalEntry[]>(() => getLedgerEntries());

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<JournalEntry[]>).detail;
      setEntries(Array.isArray(detail) ? detail : getLedgerEntries());
    };
    window.addEventListener(LEDGER_ENTRIES_EVENT, onUpdated);
    setEntries(getLedgerEntries());
    return () => window.removeEventListener(LEDGER_ENTRIES_EVENT, onUpdated);
  }, []);

  return entries;
}
