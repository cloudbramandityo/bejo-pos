import {
  deleteLedgerEntryCloud,
  saveAllLedgerEntriesCloud,
  saveLedgerEntryCloud,
} from '../backend/pocketbaseBackend';
import { getAccountChart } from './accountChart';
import { getEntityRegistry } from './entityRegistry';
import {
  alreadyReversed,
  buildReversal,
  canPostEntry,
  entryTotals,
  normalizeJournalEntry,
  normalizeJournalEntries,
  periodKeyOf,
  type JournalEntry,
  type JournalLine,
} from './ledgerMath';

/**
 * Penyimpanan jurnal per entitas.
 *
 * Jurnal yang sudah tercatat tidak dihapus — dibalik dengan jurnal pembalik.
 * Draf boleh dibuang karena belum masuk laporan. Setiap tulis membawa nama akun
 * yang mencatat, jadi jejak perubahan bisa dibaca kembali.
 */

export const STORAGE_KEY_LEDGER_ENTRIES = 'bejo_ledger_entries_v1';
export const LEDGER_ENTRIES_EVENT = 'bejo_ledger_entries_updated';

export const getLedgerEntries = (): JournalEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEDGER_ENTRIES);
    if (raw) return normalizeJournalEntries(JSON.parse(raw));
  } catch (error) {
    console.error('Gagal membaca jurnal pembukuan', error);
  }
  return [];
};

/** Pasang daftar jurnal di perangkat ini dan umumkan ke layar laporan. */
export const writeLedgerEntries = (entries: readonly JournalEntry[]): JournalEntry[] => {
  const clean = normalizeJournalEntries(entries);
  try {
    localStorage.setItem(STORAGE_KEY_LEDGER_ENTRIES, JSON.stringify(clean));
  } catch (error) {
    console.error('Gagal menyimpan jurnal pembukuan', error);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<JournalEntry[]>(LEDGER_ENTRIES_EVENT, { detail: clean }));
  }
  return clean;
};

/** Isi yang datang dari server: pasang, jangan dikirim balik. */
export const applyLedgerEntriesFromCloud = (entries: readonly JournalEntry[]): JournalEntry[] =>
  writeLedgerEntries(entries);

const sendEntry = (entry: JournalEntry): void => {
  saveLedgerEntryCloud(entry).catch((error) =>
    console.error('[Server] Gagal menyimpan jurnal:', error)
  );
};

/**
 * Catat satu jurnal. Ditolak bila tidak seimbang, memakai akun yang salah
 * entitas, menyentuh periode terkunci, atau nomor buktinya kembar.
 */
export const saveLedgerEntry = (
  draft: Partial<JournalEntry> & { lines: JournalLine[] },
  actor: string
): { ok: boolean; problems: string[]; entry: JournalEntry | null } => {
  const entry = normalizeJournalEntry({
    ...draft,
    createdBy: draft.createdBy || actor,
    createdAt: draft.createdAt || Date.now(),
    status: draft.status || 'POSTED',
  });
  const problems = canPostEntry(
    entry,
    getAccountChart(),
    getEntityRegistry(),
    getLedgerEntries()
  ).problems;
  if (problems.length > 0) return { ok: false, problems, entry: null };

  const current = getLedgerEntries();
  const totals = entryTotals(entry);
  if (totals.debit === 0) return { ok: false, problems: ['Jurnal kosong, tidak ada yang dicatat.'], entry: null };

  const existing = current.find((item) => item.id === entry.id);
  if (existing && existing.status === 'POSTED') {
    // Rekap bulanan dibentuk ulang dari data toko, jadi boleh ditimpa id yang sama.
    // Jurnal isian manual dan saldo awal tidak: riwayat yang sudah tercatat tidak diubah.
    const derived = existing.source === 'AGREGAT_BULANAN' && entry.source === 'AGREGAT_BULANAN';
    if (!derived) {
      return {
        ok: false,
        problems: [
          `Jurnal ${existing.ref || existing.id} sudah tercatat pada ${existing.date}. Jangan ditimpa — buat jurnal penyesuaian atau balik lebih dulu.`,
        ],
        entry: null,
      };
    }
  }

  writeLedgerEntries([entry, ...current.filter((item) => item.id !== entry.id)]);
  sendEntry(entry);
  return { ok: true, problems: [], entry };
};

/** Buang draf yang belum pernah tercatat. Jurnal sudah tercatat tidak dihapus. */
export const discardDraft = (entryId: string): { removed: boolean; reason: string } => {
  const current = getLedgerEntries();
  const target = current.find((item) => item.id === entryId);
  if (!target) return { removed: false, reason: 'Jurnal tidak ditemukan.' };
  if (target.status !== 'DRAF') {
    return { removed: false, reason: 'Jurnal yang sudah tercatat tidak dihapus. Gunakan jurnal pembalik.' };
  }
  writeLedgerEntries(current.filter((item) => item.id !== entryId));
  deleteLedgerEntryCloud(entryId).catch((error) =>
    console.error('[Server] Gagal menghapus draf jurnal:', error)
  );
  return { removed: true, reason: '' };
};

/**
 * Balik satu jurnal yang sudah tercatat. Jurnal aslinya tetap ada, pembaliknya
 * masuk di tanggal yang ditentukan pemakainya.
 */
export const reverseLedgerEntry = (
  entryId: string,
  reversalDate: string,
  actor: string
): { ok: boolean; problems: string[]; reversal: JournalEntry | null } => {
  const current = getLedgerEntries();
  const original = current.find((item) => item.id === entryId);
  if (!original) return { ok: false, problems: ['Jurnal yang mau dibalik tidak ditemukan.'], reversal: null };
  if (alreadyReversed(current, entryId)) {
    return { ok: false, problems: ['Jurnal ini sudah pernah dibalik. Tidak bisa dibalik dua kali.'], reversal: null };
  }
  const reversal = buildReversal(original, reversalDate, actor);
  const problems = canPostEntry(reversal, getAccountChart(), getEntityRegistry(), current).problems;
  if (problems.length > 0) return { ok: false, problems, reversal: null };

  writeLedgerEntries([reversal, ...current]);
  sendEntry(reversal);
  return { ok: true, problems: [], reversal };
};

/** Kirim seluruh isi buku ke server (dipakai pemulihan berkas cadangan). */
export const pushAllLedgerEntries = async (entries: readonly JournalEntry[]): Promise<void> => {
  await saveAllLedgerEntriesCloud(normalizeJournalEntries(entries));
};

/** Daftar bulan yang sudah punya jurnal — dipakai daftar periode laporan. */
export const ledgerPeriodKeys = (entries?: readonly JournalEntry[]): string[] => {
  const list = entries || getLedgerEntries();
  return Array.from(new Set(list.map((entry) => periodKeyOf(entry.date)).filter(Boolean))).sort();
};
