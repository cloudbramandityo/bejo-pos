import { PT_ACCOUNT_CODES, getAccountChart, type AccountChart } from './accountChart';
import {
  entityForDateKey,
  getEntityRegistry,
  lastDayBefore,
  formatEntityDateKey,
  type EntityProfile,
  type EntityRegistry,
} from './entityRegistry';
import {
  balanceOf,
  buildAggregateEntry,
  buildOpeningEntry,
  canPostEntry,
  postedEntries,
  type JournalEntry,
} from './ledgerMath';
import {
  aggregateMonth,
  codeMapForEntity,
  monthEndOf,
  type SaleRow,
  type ShiftRow,
  type StockRow,
} from './ledgerAggregates';
import {
  buildTransitionPlan,
  closingFigures,
  measureThroughDate,
  openingBalancesFromPlan,
  type AllocationChoice,
  type ClosingFigure,
  type TransitionPlan,
} from './transitionMath';
import type { FinancialSettings } from './financialStorage';
import { getLedgerEntries, saveLedgerEntry } from './ledgerStorage';
import { closeBooksThrough, saveChart } from './entityStorage';

/**
 * Jalan keluar wizard penutupan buku: apa yang dihitung, apa yang dicatat.
 *
 * Semua tulis lewat satu pintu — jurnal divalidasi lebih dulu, saldo awal akun
 * dipasang dari rencana yang sama, lalu buku lama ditutup. Urutannya penting:
 * bila jurnal ditolak, tidak ada saldo akun atau penutupan yang ikut berubah.
 */

export interface TransitionSource {
  sales: readonly SaleRow[];
  stock: readonly StockRow[];
  shifts: readonly ShiftRow[];
}

export interface TransitionPair {
  registry: EntityRegistry;
  chart: AccountChart;
  oldEntity: EntityProfile | null;
  newEntity: EntityProfile | null;
  /** Hari terakhir periode entitas lama. */
  closingDate: string;
}

export const transitionPair = (registry: EntityRegistry, chart: AccountChart): TransitionPair => {
  const closingDate = lastDayBefore(registry.transitionDate);
  return {
    registry,
    chart,
    oldEntity: entityForDateKey(registry, closingDate),
    newEntity: entityForDateKey(registry, registry.transitionDate),
    closingDate,
  };
};

/** Baca pasangan entitas dari penyimpanan (dipakai skrip dan jalan tanpa layar). */
export const readTransitionPair = (): TransitionPair =>
  transitionPair(getEntityRegistry(), getAccountChart());

/** Daftar saldo penutupan entitas lama, dengan dasar angka yang terukur. */
export const readClosingFigures = (
  pair: TransitionPair,
  source: TransitionSource,
  settings: FinancialSettings
): ClosingFigure[] => {
  if (!pair.oldEntity || !pair.newEntity) return [];
  return closingFigures(
    settings,
    measureThroughDate({ ...source, throughDate: pair.closingDate }),
    pair.chart,
    pair.oldEntity,
    pair.newEntity
  );
};

/** Isi akun tujuan bawaan: saldo usaha dialihkan, saldo pribadi dan modal lama tidak. */
export const defaultAllocations = (figures: readonly ClosingFigure[]): AllocationChoice[] =>
  figures.map((figure) => ({
    code: figure.code,
    transferred: figure.transferable && figure.targetCode ? figure.entered : 0,
  }));

export const planOf = (
  pair: TransitionPair,
  figures: readonly ClosingFigure[],
  allocations: readonly AllocationChoice[],
  shareCapital: number,
  retainedEarnings: number
): TransitionPlan | null => {
  if (!pair.oldEntity || !pair.newEntity) return null;
  return buildTransitionPlan({
    figures,
    allocations,
    shareCapital,
    retainedEarnings,
    chart: pair.chart,
    oldEntity: pair.oldEntity,
    newEntity: pair.newEntity,
  });
};

/** Jurnal saldo awal yang sudah pernah tercatat untuk entitas baru. */
export const existingOpeningEntry = (
  entries: readonly JournalEntry[],
  entityId: string
): JournalEntry | undefined =>
  entries.find(
    (entry) => entry.entityId === entityId && entry.source === 'SALDO_AWAL' && entry.status !== 'BATAL'
  );

/** Pratinjau: draf jurnal saldo awal, belum disimpan. */
export const openingDraft = (
  pair: TransitionPair,
  plan: TransitionPlan,
  actor: string
): JournalEntry | null => {
  if (!pair.newEntity) return null;
  return buildOpeningEntry({
    entityId: pair.newEntity.id,
    date: pair.registry.transitionDate,
    lines: plan.lines,
    counterCode: PT_ACCOUNT_CODES.capital,
    actor,
    description: `Saldo awal ${pair.newEntity.legalName} per ${formatEntityDateKey(pair.registry.transitionDate)}`,
  });
};

/**
 * Catat jurnal saldo awal, pasang nilai awalnya pada bagan akun, lalu tutup buku
 * lama. Penolakan validasi menghentikan seluruh langkah — tidak ada separuh
 * perubahan yang tertinggal.
 */
export const postOpeningJournal = (options: {
  pair: TransitionPair;
  plan: TransitionPlan;
  actor: string;
  /** Sudah dilihat dan disetujui operator di layar pratinjau. */
  confirmed: boolean;
}): { ok: boolean; problems: string[]; entry: JournalEntry | null } => {
  const { pair, plan, actor } = options;
  if (!options.confirmed) {
    return { ok: false, problems: ['Posting belum disetujui. Tinjau pratinjau lebih dulu.'], entry: null };
  }
  if (!pair.newEntity || !pair.oldEntity) {
    return { ok: false, problems: ['Entitas lama atau baru belum lengkap di pengaturan entitas.'], entry: null };
  }
  const already = existingOpeningEntry(getLedgerEntries(), pair.newEntity.id);
  if (already) {
    return {
      ok: false,
      problems: [
        `Saldo awal ${pair.newEntity.legalName} sudah tercatat pada ${formatEntityDateKey(already.date)} oleh ${already.createdBy || 'belum tercatat'}. Balikkan lebih dulu bila memang perlu diubah.`,
      ],
      entry: null,
    };
  }
  if (!plan.balanced) {
    return { ok: false, problems: ['Neraca awal belum seimbang. Perbaiki bagiannya sebelum dicatat.'], entry: null };
  }

  const draft = openingDraft(pair, plan, actor);
  if (!draft) return { ok: false, problems: ['Jurnal saldo awal tidak bisa dibentuk.'], entry: null };

  const saved = saveLedgerEntry({ ...draft, status: 'POSTED' }, actor);
  if (!saved.ok || !saved.entry) return { ok: false, problems: saved.problems, entry: null };

  saveChart({ ...pair.chart, accounts: openingBalancesFromPlan(plan, pair.chart, pair.newEntity.id) });
  closeBooksThrough(pair.closingDate, actor);

  return { ok: true, problems: [], entry: saved.entry };
};

/* --------------------------------------------------------------------------- */
/*  Rekap bulanan                                                              */
/* --------------------------------------------------------------------------- */

export interface MonthPreview {
  periodKey: string;
  entity: EntityProfile;
  groups: ReturnType<typeof aggregateMonth>['groups'];
  totals: ReturnType<typeof aggregateMonth>['totals'];
  notes: string[];
  entry: JournalEntry;
  problems: string[];
  alreadyPosted: boolean;
  hasData: boolean;
}

/**
 * Pratinjau rekap satu bulan untuk satu entitas. `countedInventory` diisi dari
 * hasil opname; kosong berarti bulan itu tidak memindahkan nilai persediaan dan
 * alasannya ikut tercatat di catatan layar.
 */
export const monthPreview = (options: {
  pair: TransitionPair;
  entity: EntityProfile;
  periodKey: string;
  source: TransitionSource;
  mode: 'PERIODIK' | 'PERPETUAL';
  countedInventory?: number | null;
  actor: string;
  entries: readonly JournalEntry[];
  /** Tanggal hari ini: bulan berjalan dicatat sampai tanggal ini, bukan sampai akhir bulan. */
  throughDate?: string;
}): MonthPreview | null => {
  const { pair, entity, periodKey } = options;
  const codes = codeMapForEntity(entity);
  const prior = balanceOf(postedEntries(options.entries), pair.chart, entity.id, codes.inventory);

  const bounds = [monthEndOf(periodKey), entity.endDate || '9999-12-31', options.throughDate || '9999-12-31'];
  const end = bounds.slice().sort()[0];

  const aggregate = aggregateMonth({
    periodKey,
    entity,
    sales: options.source.sales,
    stock: options.source.stock,
    shifts: options.source.shifts,
    mode: options.mode,
    priorInventoryBalance: prior,
    countedInventory: options.countedInventory,
  });

  const entry = buildAggregateEntry({
    periodKey,
    entityId: entity.id,
    date: end,
    groups: aggregate.groups,
    actor: options.actor,
    description: `Rekap pembukuan ${entity.legalName} bulan ${periodKey}`,
  });

  const existing = options.entries.find((item) => item.id === entry.id);
  return {
    periodKey,
    entity,
    groups: aggregate.groups,
    totals: aggregate.totals,
    notes: aggregate.notes,
    entry,
    problems: aggregate.groups.length === 0
      ? ['Tidak ada angka yang bisa direkap pada bulan ini.']
      : canPostEntry(entry, pair.chart, pair.registry, options.entries).problems,
    alreadyPosted: existing?.status === 'POSTED',
    hasData: aggregate.groups.length > 0,
  };
};

/** Catat rekap bulanan. Bulan tanpa kelompok akun ditolak, bukan disimpan kosong. */
export const postMonthJournals = (
  previews: readonly MonthPreview[],
  actor: string
): { posted: JournalEntry[]; failed: { periodKey: string; problems: string[] }[] } => {
  const posted: JournalEntry[] = [];
  const failed: { periodKey: string; problems: string[] }[] = [];
  for (const preview of previews) {
    if (!preview.hasData) {
      failed.push({ periodKey: preview.periodKey, problems: ['Tidak ada angka yang bisa direkap.'] });
      continue;
    }
    const saved = saveLedgerEntry({ ...preview.entry, status: 'POSTED' }, actor);
    if (saved.ok && saved.entry) posted.push(saved.entry);
    else failed.push({ periodKey: preview.periodKey, problems: saved.problems });
  }
  return { posted, failed };
};
