/**
 * Cermin local untuk hasil Rekonsiliasi.
 * Sumber kebenaran tetap koleksi server `reconciliation_runs`; berkas ini hanya
 * cadangan supaya Mode Lokal dan muatan pertama layar tidak kosong.
 *
 * Berkas lama (satu angka per baris) dibaca dan diubah jadi satu kolom "Nominal"
 * supaya riwayat lawas tetap terbuka.
 */
import {
  ReconciliationAnalysis,
  ReconciliationColumn,
  ReconciliationRun,
  ReconciliationRow,
} from '../types/reconciliation';
import {
  createReconciliationColumn,
  createReconciliationRow,
  normalizeRowNature,
} from './reconciliationMath';

const STORAGE_KEY = 'bejo_pos_reconciliation_runs_v1';

/** Riwayat cukup 200 analisa terakhir; yang lama tetap ada di server. */
export const MAX_STORED_RUNS = 200;

const LEGACY_COLUMN_ID = 'rccol_nominal_lama';

const byNewest = (a: ReconciliationRun, b: ReconciliationRun) =>
  (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);

const legacyColumn = (): ReconciliationColumn =>
  createReconciliationColumn({ id: LEGACY_COLUMN_ID, label: 'Nominal', kind: 'UANG' });

function normalizeColumns(rawColumns: any): ReconciliationColumn[] {
  const list = Array.isArray(rawColumns) ? rawColumns : [];
  const columns = list
    .filter((item) => item && typeof item === 'object' && String(item.id ?? '').trim())
    .map((item) =>
      createReconciliationColumn({
        id: String(item.id),
        label: String(item.label ?? ''),
        kind: item.kind === 'JUMLAH' ? 'JUMLAH' : 'UANG',
        direction: item.direction === 'NAIK' || item.direction === 'TURUN' ? item.direction : 'ROW',
      })
    );
  return columns.length ? columns : [legacyColumn()];
}

function normalizeRows(rawRows: any, columns: ReconciliationColumn[]): ReconciliationRow[] {
  const list = Array.isArray(rawRows) ? rawRows : [];
  const primaryColumnId = columns[0].id;
  return list
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const hasValues = item.values && typeof item.values === 'object';
      const values = hasValues
        ? Object.fromEntries(
            Object.entries(item.values as Record<string, any>).map(([columnId, cell]) => [
              columnId,
              { a: cell?.a, b: cell?.b },
            ])
          )
        : { [primaryColumnId]: { a: item.valueA, b: item.valueB } };
      return createReconciliationRow({
        id: String(item.id ?? ''),
        label: String(item.label ?? ''),
        nature: normalizeRowNature(item.nature),
        values,
      });
    });
}

/** Hasil analisa lawas (satu kolom, bentuk lama) tidak dipakai lagi; isian aslinya tetap ada. */
function normalizeAnalysis(raw: any): ReconciliationAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.columns) || raw.columns.length === 0) return null;
  if (!Array.isArray(raw.summaries) || raw.summaries.length !== raw.columns.length) return null;
  if (!Array.isArray(raw.rows)) return null;
  return {
    kind: String(raw.kind ?? '').toUpperCase() === 'KOMPARATIF' ? 'KOMPARATIF' : 'VARIANS',
    generatedAt: Number(raw.generatedAt) || 0,
    columns: normalizeColumns(raw.columns),
    rows: raw.rows,
    summaries: raw.summaries,
    countedRows: Number(raw.countedRows) || 0,
  };
}

export const normalizeStoredRun = (raw: any): ReconciliationRun | null => {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').trim();
  if (!id) return null;
  const kind = String(raw.kind ?? '').toUpperCase() === 'KOMPARATIF' ? 'KOMPARATIF' : 'VARIANS';
  const columns = normalizeColumns(raw.columns);
  return {
    id,
    kind,
    title: String(raw.title ?? ''),
    labelA: String(raw.labelA ?? ''),
    labelB: String(raw.labelB ?? ''),
    columns,
    rows: normalizeRows(raw.rows, columns),
    analysis: normalizeAnalysis(raw.analysis),
    notes: String(raw.notes ?? ''),
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || 0,
    authorId: raw.authorId ? String(raw.authorId) : undefined,
    authorName: raw.authorName ? String(raw.authorName) : undefined,
  };
};

export function getStoredReconciliationRuns(): ReconciliationRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeStoredRun)
      .filter((run): run is ReconciliationRun => run !== null)
      .sort(byNewest);
  } catch {
    return [];
  }
}

export function saveStoredReconciliationRuns(runs: ReconciliationRun[]): void {
  try {
    const capped = [...(runs || [])].sort(byNewest).slice(0, MAX_STORED_RUNS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    /* ruang penyimpanan perangkat penuh: riwayat server tetap aman */
  }
}

export function upsertStoredReconciliationRun(run: ReconciliationRun): ReconciliationRun[] {
  const current = getStoredReconciliationRuns();
  const next = [run, ...current.filter((item) => item.id !== run.id)].sort(byNewest);
  saveStoredReconciliationRuns(next);
  return next;
}

export function removeStoredReconciliationRun(id: string): ReconciliationRun[] {
  const next = getStoredReconciliationRuns().filter((item) => item.id !== id);
  saveStoredReconciliationRuns(next);
  return next;
}

export function createReconciliationRunId(): string {
  return `REC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}
