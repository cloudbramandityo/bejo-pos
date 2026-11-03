import {
  accountUsability,
  type Account,
  type AccountChart,
} from './accountChart';
import {
  isDateLocked,
  toEntityDateKey,
  type EntityRegistry,
} from './entityRegistry';

/**
 * Mesin buku jurnal.
 *
 * Semua angka laporan bersumber dari satu tempat: daftar jurnal berpasangan
 * (debit = kredit). Jurnal dibentuk dari tiga jalan — saldo awal hasil
 * penutupan buku, rekap bulanan dari data toko, dan isian manual per entitas.
 * Transaksi kasir lama tidak di-posting satu per satu: historinya dibekukan
 * menjadi saldo awal, sesuai kesepakatan pembukuan.
 *
 * Berkas ini murni perhitungan, tanpa membaca penyimpanan, supaya penjaga
 * `npm run check:entity` dapat mengujinya langsung dengan angka simulasi.

 */

export type JournalSource = 'SALDO_AWAL' | 'AGREGAT_BULANAN' | 'MANUAL' | 'PENYESUAIAN' | 'BALIK';
export type JournalStatus = 'DRAF' | 'POSTED' | 'BATAL';

export interface JournalLine {
  /** Kode akun milik entitas jurnal itu. */
  code: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  /** Tanggal 'YYYY-MM-DD' — penentu entitas pemilik. */
  date: string;
  entityId: string;
  /** Nomor bukti/dokumen pendukung. */
  ref: string;
  description: string;
  source: JournalSource;
  status: JournalStatus;
  lines: JournalLine[];
  /** Nama akun yang mencatat ("diubah oleh"). */
  createdBy: string;
  createdAt: number;
  /** Isi bila jurnal ini pembalik jurnal lain. */
  reversalOf?: string;
}

export interface EntryTotals {
  debit: number;
  credit: number;
  difference: number;
  balanced: boolean;
}

export const JOURNAL_SOURCE_LABEL: Record<JournalSource, string> = {
  SALDO_AWAL: 'Saldo awal',
  AGREGAT_BULANAN: 'Rekap bulanan',
  MANUAL: 'Isian manual',
  PENYESUAIAN: 'Penyesuaian',
  BALIK: 'Pembalik',
};

export const JOURNAL_STATUS_LABEL: Record<JournalStatus, string> = {
  DRAF: 'Draf',
  POSTED: 'Tercatat',
  BATAL: 'Dibatalkan',
};

/** Rupiah tidak punya pecahan; pembulatan dilakukan sekali di sini. */
export const money = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export const periodKeyOf = (dateKey: string): string => {
  const key = toEntityDateKey(dateKey);
  return key ? key.slice(0, 7) : '';
};

export const entryTotals = (entry: JournalEntry): EntryTotals => {
  let debit = 0;
  let credit = 0;
  for (const line of entry.lines) {
    debit += money(line.debit);
    credit += money(line.credit);
  }
  return { debit, credit, difference: debit - credit, balanced: debit === credit };
};

const LINE_SOURCES: readonly JournalSource[] = [
  'SALDO_AWAL', 'AGREGAT_BULANAN', 'MANUAL', 'PENYESUAIAN', 'BALIK',
];
const LINE_STATUS: readonly JournalStatus[] = ['DRAF', 'POSTED', 'BATAL'];

/** Bersihkan satu jurnal; baris kosong (debit dan kredit nol) dibuang. */
export function normalizeJournalEntry(raw: unknown): JournalEntry {
  const source = (raw || {}) as Partial<JournalEntry> & Record<string, unknown>;
  const date = toEntityDateKey(source.date as string | undefined);
  const lines = (Array.isArray(source.lines) ? source.lines : [])
    .map((item) => {
      const line = (item || {}) as Partial<JournalLine> & Record<string, unknown>;
      return {
        code: String(line.code || '').trim(),
        debit: money(line.debit),
        credit: money(line.credit),
        memo: typeof line.memo === 'string' && line.memo.trim() ? line.memo.trim() : undefined,
      };
    })
    .filter((line) => line.code && (line.debit !== 0 || line.credit !== 0));

  return {
    id: String(source.id || `jen_${date || 'x'}_${lines.length}`),
    date,
    entityId: String(source.entityId || '').trim(),
    ref: String(source.ref || '').trim(),
    description: String(source.description || '').trim(),
    source: LINE_SOURCES.includes(source.source as JournalSource) ? (source.source as JournalSource) : 'MANUAL',
    status: LINE_STATUS.includes(source.status as JournalStatus) ? (source.status as JournalStatus) : 'DRAF',
    lines,
    createdBy: String(source.createdBy || '').trim(),
    createdAt: Number(source.createdAt) > 0 ? Number(source.createdAt) : 0,
    reversalOf: typeof source.reversalOf === 'string' && source.reversalOf ? source.reversalOf : undefined,
  };
}

export const normalizeJournalEntries = (raw: unknown): JournalEntry[] =>
  (Array.isArray(raw) ? raw : []).map(normalizeJournalEntry).filter((entry) => entry.date !== '');

/** Jurnal yang sudah tercatat saja yang dihitung ke laporan. */
export const postedEntries = (entries: readonly JournalEntry[]): JournalEntry[] =>
  entries.filter((entry) => entry.status === 'POSTED');

/**
 * Semua alasan sebuah jurnal belum boleh dicatat. Daftarnya dibaca operator
 * apa adanya — tidak ada yang diloloskan diam-diam.
 */
export const entryProblems = (
  entry: JournalEntry,
  chart: AccountChart,
  registry: EntityRegistry,
  existing: readonly JournalEntry[]
): string[] => {
  const problems: string[] = [];
  if (!entry.date) problems.push('Tanggal jurnal belum diisi.');
  if (entry.lines.length < 2) problems.push('Jurnal butuh minimal dua baris (debit dan kredit).');
  if (!entry.entityId) problems.push('Entitas pemilik jurnal belum ditentukan.');

  const totals = entryTotals(entry);
  if (!totals.balanced) {
    problems.push(
      `Debit ${totals.debit.toLocaleString('id-ID')} tidak sama dengan kredit ${totals.credit.toLocaleString('id-ID')}. Selisih ${Math.abs(totals.difference).toLocaleString('id-ID')}.`
    );
  }

  for (const line of entry.lines) {
    if (line.debit > 0 && line.credit > 0) {
      problems.push(`Baris ${line.code} tidak boleh berisi debit sekaligus kredit.`);
    }
    const usability = accountUsability(chart, registry, entry.entityId, line.code, entry.date);
    if (!usability.ok) problems.push(usability.reason);
  }

  if (entry.date && registry.entities.length > 0) {
    const owner = registry.entities.find(
      (entity) => entity.startDate && entry.date >= entity.startDate && (!entity.endDate || entry.date <= entity.endDate)
    );
    if (!owner) problems.push(`Tanggal ${entry.date} tidak jatuh pada periode entitas mana pun.`);
    else if (owner.id !== entry.entityId) {
      problems.push(`Tanggal ${entry.date} adalah milik ${owner.legalName}, bukan entitas yang dipilih.`);
    }
    if (isDateLocked(registry, entry.date) && entry.source !== 'SALDO_AWAL') {
      problems.push(
        `Periode sampai ${registry.closedThroughDate} sudah ditutup. Buat jurnal penyesuaian di tanggal setelahnya.`
      );
    }
  }

  if (entry.ref) {
    const duplicated = existing.filter(
      (item) => item.id !== entry.id && item.ref === entry.ref && item.date === entry.date && item.entityId === entry.entityId
    );
    if (duplicated.length > 0) {
      problems.push(`Nomor bukti ${entry.ref} sudah dipakai pada tanggal yang sama. Jurnal kembar ditolak.`);
    }
  }
  return problems;
};

export const canPostEntry = (
  entry: JournalEntry,
  chart: AccountChart,
  registry: EntityRegistry,
  existing: readonly JournalEntry[]
): { ok: boolean; problems: string[] } => {
  const problems = entryProblems(entry, chart, registry, existing);
  return { ok: problems.length === 0, problems };
};

/** Jurnal pembalik: nilai sama, arah debit/kredit ditukar. */
export const buildReversal = (
  original: JournalEntry,
  reversalDate: string,
  actor: string
): JournalEntry => {
  const date = toEntityDateKey(reversalDate);
  return normalizeJournalEntry({
    id: `rev_${original.id}`,
    date,
    entityId: original.entityId,
    ref: original.ref ? `${original.ref}/BALIK` : '',
    description: `Pembalik jurnal ${original.description || original.id}`,
    source: 'BALIK',
    status: 'POSTED',
    lines: original.lines.map((line) => ({ code: line.code, debit: line.credit, credit: line.debit, memo: line.memo })),
    createdBy: actor,
    createdAt: Date.now(),
    reversalOf: original.id,
  });
};

/** Tanda bahwa jurnal asli sudah dibalik (satu pembalik cukup). */
export const alreadyReversed = (entries: readonly JournalEntry[], entryId: string): boolean =>
  entries.some((item) => item.reversalOf === entryId && item.status === 'POSTED');

/**
 * Saldo per kode akun. Arah mengikuti akunnya: akun debit-normal bertambah di
 * debit, akun kredit-normal bertambah di kredit.
 */
export const balancesByAccount = (
  entries: readonly JournalEntry[],
  chart: AccountChart
): Map<string, number> => {
  const totals = new Map<string, number>();
  const normalOf = new Map<string, string>();
  for (const account of chart.accounts) {
    normalOf.set(`${account.entityId}::${account.code}`, account.normal);
  }
  for (const entry of postedEntries(entries)) {
    const key = `${entry.entityId}::`;
    for (const line of entry.lines) {
      const fullKey = `${key}${line.code}`;
      const normal = normalOf.get(fullKey) || 'DEBIT';
      const signed = normal === 'DEBIT' ? money(line.debit) - money(line.credit) : money(line.credit) - money(line.debit);
      totals.set(fullKey, (totals.get(fullKey) || 0) + signed);
    }
  }
  return totals;
};

export const balanceOf = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entityId: string,
  code: string
): number => balancesByAccount(entries, chart).get(`${entityId}::${code}`) || 0;

export interface TrialBalanceRow {
  account: Account;
  debit: number;
  credit: number;
  movementDebit: number;
  movementCredit: number;
}

/**
 * Neraca saldo: jumlah debit dan kredit harus sama persis. Bila tidak,
 * ada jurnal yang masuk tanpa seimbang dan itu harus kelihatan, bukan dibulatkan.
 */
export const buildTrialBalance = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entityId: string
): { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; balanced: boolean } => {
  const included = postedEntries(entries).filter((entry) => entry.entityId === entityId);
  const movement = new Map<string, { debit: number; credit: number }>();
  for (const entry of included) {
    for (const line of entry.lines) {
      const current = movement.get(line.code) || { debit: 0, credit: 0 };
      current.debit += money(line.debit);
      current.credit += money(line.credit);
      movement.set(line.code, current);
    }
  }
  const balances = balancesByAccount(included, chart);

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const account of chart.accounts.filter((item) => item.entityId === entityId)) {
    const move = movement.get(account.code) || { debit: 0, credit: 0 };
    const signed = balances.get(`${account.entityId}::${account.code}`) || 0;
    const hasOpening = typeof account.openingBalance === 'number' && account.openingBalance !== 0;
    if (signed === 0 && move.debit === 0 && move.credit === 0 && !hasOpening) continue;
    // Kolom mengikuti arah normal akun: saldo utang/modal/pendapatan yang wajar
    // tampil di kolom kredit. Menaruhnya di kolom debit membuat neraca saldo
    // tidak pernah seimbang padahal jurnalnya benar.
    const debitNormal = account.normal === 'DEBIT';
    const debit = debitNormal ? Math.max(0, signed) : Math.max(0, -signed);
    const credit = debitNormal ? Math.max(0, -signed) : Math.max(0, signed);
    totalDebit += debit;
    totalCredit += credit;
    rows.push({ account, debit, credit, movementDebit: move.debit, movementCredit: move.credit });
  }
  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
};

export interface LedgerRow {
  date: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  running: number;
  source: JournalSource;
}

/** Buku besar satu akun, terurut tanggal, dengan saldo berjalan. */
export const buildLedger = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entityId: string,
  code: string
): { account: Account | null; rows: LedgerRow[]; balance: number } => {
  const account = chart.accounts.find((item) => item.entityId === entityId && item.code === code) || null;
  const normal = account ? account.normal : 'DEBIT';
  const included = postedEntries(entries)
    .filter((entry) => entry.entityId === entityId)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));

  const rows: LedgerRow[] = [];
  let running = 0;
  for (const entry of included) {
    for (const line of entry.lines) {
      if (line.code !== code) continue;
      const debit = money(line.debit);
      const credit = money(line.credit);
      running += normal === 'DEBIT' ? debit - credit : credit - debit;
      rows.push({
        date: entry.date,
        ref: entry.ref,
        description: entry.description,
        debit,
        credit,
        running,
        source: entry.source,
      });
    }
  }
  return { account, rows, balance: running };
};

/** Jumlah baris jurnal yang memakai satu akun — dasar penolakan hapus akun. */
export const accountUsageCount = (entries: readonly JournalEntry[], entityId: string, code: string): number =>
  entries.filter(
    (entry) => entry.entityId === entityId && entry.status !== 'BATAL' && entry.lines.some((line) => line.code === code)
  ).length;

/* ------------------------------------------------------------------------- */
/*  Pembentuk jurnal agregat bulanan                                          */
/* ------------------------------------------------------------------------- */

export interface AggregateGroup {
  debitCode: string;
  creditCode: string;
  amount: number;
  memo?: string;
}

/**
 * Rangkum satu bulan menjadi satu jurnal: tiap kelompok (debit - kredit)
 * dijumlahkan lebih dulu, baris yang nol dibuang. Ini yang membuat histori
 * 2022 ke atas tidak perlu di-posting per struk.
 */
export const buildAggregateEntry = (options: {
  periodKey: string;
  entityId: string;
  date: string;
  groups: AggregateGroup[];
  actor: string;
  description?: string;
  ref?: string;
}): JournalEntry => {
  const merged = new Map<string, { debit: number; credit: number }>();
  for (const group of options.groups) {
    const amount = money(group.amount);
    if (amount === 0) continue;
    const debitRow = merged.get(group.debitCode) || { debit: 0, credit: 0 };
    debitRow.debit += amount;
    merged.set(group.debitCode, debitRow);
    const creditRow = merged.get(group.creditCode) || { debit: 0, credit: 0 };
    creditRow.credit += amount;
    merged.set(group.creditCode, creditRow);
  }

  const lines: JournalLine[] = [];
  for (const [code, values] of merged) {
    const net = values.debit - values.credit;
    if (net === 0) continue;
    lines.push({ code, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });
  }

  return normalizeJournalEntry({
    id: `agg_${options.entityId}_${options.periodKey}`,
    date: toEntityDateKey(options.date),
    entityId: options.entityId,
    ref: options.ref || `AGR-${options.periodKey}`,
    description: options.description || `Rekap pembukuan bulan ${options.periodKey}`,
    source: 'AGREGAT_BULANAN',
    status: 'POSTED',
    lines,
    createdBy: options.actor,
    createdAt: Date.now(),
  });
};

/** Jurnal saldo awal: tiap akun dengan nilai beku, lawan akun modal/transisi. */
export const buildOpeningEntry = (options: {
  entityId: string;
  date: string;
  lines: JournalLine[];
  counterCode: string;
  actor: string;
  ref?: string;
  description?: string;
}): JournalEntry => {
  const assetLines = options.lines
    .map((line) => ({ code: String(line.code).trim(), debit: money(line.debit), credit: money(line.credit) }))
    .filter((line) => line.code && (line.debit !== 0 || line.credit !== 0));
  const net = assetLines.reduce((sum, line) => sum + line.debit - line.credit, 0);
  const lines = [...assetLines];
  if (net !== 0) {
    lines.push({
      code: options.counterCode,
      debit: net < 0 ? -net : 0,
      credit: net > 0 ? net : 0,
    });
  }
  return normalizeJournalEntry({
    id: `opn_${options.entityId}_${toEntityDateKey(options.date)}`,
    date: toEntityDateKey(options.date),
    entityId: options.entityId,
    ref: options.ref || `SALDO-AWAL-${toEntityDateKey(options.date)}`,
    description: options.description || 'Jurnal saldo awal pembentukan entitas',
    source: 'SALDO_AWAL',
    status: 'DRAF',
    lines,
    createdBy: options.actor,
    createdAt: Date.now(),
  });
};
