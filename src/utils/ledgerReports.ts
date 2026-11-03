/**
 * Mesin laporan keuangan per entitas (basis jurnal, bukan angka karangan).
 *
 * Semua angka di laporan dibaca dari jurnal yang sudah tercatat:
 *   - Neraca saldo, laba rugi, neraca, perubahan modal, dan arus kas memakai
 *     saldo per arah normal akun, jadi total debit selalu sama total kredit.
 *   - Laporan gabungan internal memisahkan kolom Pra-PT / Pasca-PT / Total.
 *     Angka itu untuk manajemen internal, bukan dasar pajak — dan itu ditulis
 *     di laporan lewat `GABUNGAN_WARNING`.
 *   - Laporan resmi PT hanya boleh untuk tanggal mulai berlaku PT dan memakai
 *     identitas dari dokumen hukum (`ptReportScope`).
 *
 * Berkas ini murni perhitungan (tidak menyentuh penyimpanan atau server) supaya
 * penjaga `npm run check:entity` dapat mengujinya di Node.
 */

import { Account, AccountChart, accountsForEntity, findAccount } from './accountChart';
import {
  EntityProfile,
  EntityRegistry,
  lastDayBefore,
  ptEntity,
  peroranganEntity,
  ENTITY_KIND_LABEL,
} from './entityRegistry';
import { codeMapForEntity } from './ledgerAggregates';
import {
  JournalEntry,
  LedgerRow,
  buildLedger,
  money,
  postedEntries,
} from './ledgerMath';

export interface ReportPeriod {
  from: string;
  to: string;
}

export interface ReportLine {
  code: string;
  name: string;
  /**
   * Nilai pada arah bagian laporan itu: positif menambah, negatif mengurangi.
   * Akun lawan (akumulasi penyusutan, dividen) keluar sebagai negatif supaya
   * total aset dan total modal tetap cocok dengan jurnalnya.
   */
  amount: number;
}

const dayKey = (value: string): string => (value || '').slice(0, 10);

const minDate = (a: string, b: string): string => (a <= b ? a : b);
const maxDate = (a: string, b: string): string => (a >= b ? a : b);

/** Jurnal tercatat saja yang masuk laporan; draf dan batal tidak mengubah buku. */
const ledger = (entries: readonly JournalEntry[]): JournalEntry[] => postedEntries(entries);

const inPeriod = (entry: JournalEntry, period: ReportPeriod): boolean =>
  entry.date >= period.from && entry.date <= period.to;

const upTo = (entry: JournalEntry, dateKey: string): boolean => entry.date <= dateKey;

const accountName = (chart: AccountChart, entityId: string, code: string, fallback: string): string =>
  findAccount(chart, entityId, code)?.name || fallback;

/**
 * Saldo per akun dari mutasi (bukan saldo kumulatif) dalam rentang, dinilai pada
 * arah normal akun.
 */
export const movementByAccount = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entityId: string,
  period: ReportPeriod
): Map<string, number> => {
  const normal = new Map(chart.accounts.map((item) => [`${item.entityId}::${item.code}`, item.normal]));
  const totals = new Map<string, number>();
  for (const entry of ledger(entries)) {
    if (entry.entityId !== entityId || !inPeriod(entry, period)) continue;
    for (const line of entry.lines) {
      const key = `${entityId}::${line.code}`;
      const direction = normal.get(key) === 'KREDIT' ? 'KREDIT' : 'DEBIT';
      const signed = direction === 'DEBIT' ? money(line.debit) - money(line.credit) : money(line.credit) - money(line.debit);
      totals.set(line.code, (totals.get(line.code) || 0) + signed);
    }
  }
  return totals;
};

/** Saldo kumulatif sampai satu tanggal — dasar neraca. */
const cumulativeByAccount = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entityId: string,
  asOf: string
): Map<string, number> =>
  movementByAccount(entries, chart, entityId, { from: '0000-01-01', to: asOf });

/**
 * Baris laporan untuk satu bagian. `sectionNormal` adalah arah yang menambah
 * bagian itu (DEBIT untuk aset & beban, KREDIT untuk utang, modal, pendapatan),
 * jadi akun lawan seperti Akumulasi Penyusutan atau Dividen nilainya negatif.
 */
const linesFromTotals = (
  totals: Map<string, number>,
  chart: AccountChart,
  entityId: string,
  types: Account['type'][],
  sectionNormal: Account['normal']
): ReportLine[] => {
  const wanted = new Set(types);
  const rows: ReportLine[] = [];
  for (const account of accountsForEntity(chart, entityId)) {
    if (!wanted.has(account.type)) continue;
    const signed = totals.get(account.code) || 0;
    if (signed === 0) continue;
    const amount = account.normal === sectionNormal ? signed : -signed;
    if (amount === 0) continue;
    rows.push({ code: account.code, name: account.name, amount });
  }
  return rows.sort((a, b) => a.code.localeCompare(b.code));
};

const sum = (rows: ReportLine[]): number => rows.reduce((total, row) => total + row.amount, 0);

/* -------------------------------------------------------------------------- */
/*  Neraca saldo per periode                                                   */
/* -------------------------------------------------------------------------- */

export interface TrialBalanceRow {
  code: string;
  name: string;
  normal: Account['normal'];
  /** Saldo akun sebelum tanggal mulai periode, pada arah normal akun. */
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  /** Saldo akhir pada kolom debit/kredit neraca saldo. */
  debitColumn: number;
  creditColumn: number;
}

export interface PeriodTrialBalance {
  entityId: string;
  entityLabel: string;
  period: ReportPeriod;
  rows: TrialBalanceRow[];
  totalOpeningDebit: number;
  totalOpeningCredit: number;
  totalDebit: number;
  totalCredit: number;
  totalClosingDebit: number;
  totalClosingCredit: number;
  balanced: boolean;
}

/** Mutasi debit & kredit mentah per akun dalam periode (untuk kolom mutasi). */
const movementDebitCredit = (
  entries: readonly JournalEntry[],
  entityId: string,
  period: ReportPeriod
): Map<string, { debit: number; credit: number }> => {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const entry of ledger(entries)) {
    if (entry.entityId !== entityId || !inPeriod(entry, period)) continue;
    for (const line of entry.lines) {
      const current = totals.get(line.code) || { debit: 0, credit: 0 };
      current.debit += money(line.debit);
      current.credit += money(line.credit);
      totals.set(line.code, current);
    }
  }
  return totals;
};

/** Saldo berarah-normal → kolom debit neraca saldo. */
export const debitColumn = (signed: number, normal: Account['normal']): number =>
  normal === 'DEBIT' ? Math.max(0, signed) : Math.max(0, -signed);

/** Saldo berarah-normal → kolom kredit neraca saldo. */
export const creditColumn = (signed: number, normal: Account['normal']): number =>
  normal === 'DEBIT' ? Math.max(0, -signed) : Math.max(0, signed);

/**
 * Neraca saldo satu entitas dalam periode: saldo awal, mutasi, saldo akhir.
 * Kolom debit/kredit mengikuti arah normal akun, jadi akun lawan (akumulasi
 * penyusutan, dividen) keluar di kolom yang benar dan totalnya tetap seimbang.
 */
export const buildPeriodTrialBalance = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entity: EntityProfile,
  period: ReportPeriod
): PeriodTrialBalance => {
  const before = lastDayBefore(period.from);
  const openingTotals = before
    ? cumulativeByAccount(entries, chart, entity.id, before)
    : new Map<string, number>();
  const closingTotals = cumulativeByAccount(entries, chart, entity.id, period.to);
  const movement = movementDebitCredit(entries, entity.id, period);
  const rows: TrialBalanceRow[] = [];
  let totalOpeningDebit = 0;
  let totalOpeningCredit = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let totalClosingDebit = 0;
  let totalClosingCredit = 0;
  for (const account of accountsForEntity(chart, entity.id)) {
    const opening = openingTotals.get(account.code) || 0;
    const closing = closingTotals.get(account.code) || 0;
    const change = movement.get(account.code) || { debit: 0, credit: 0 };
    if (opening === 0 && closing === 0 && change.debit === 0 && change.credit === 0) continue;
    const openSide = {
      debit: debitColumn(opening, account.normal),
      credit: creditColumn(opening, account.normal),
    };
    const closeSide = {
      debit: debitColumn(closing, account.normal),
      credit: creditColumn(closing, account.normal),
    };
    totalOpeningDebit += openSide.debit;
    totalOpeningCredit += openSide.credit;
    totalDebit += change.debit;
    totalCredit += change.credit;
    totalClosingDebit += closeSide.debit;
    totalClosingCredit += closeSide.credit;
    rows.push({
      code: account.code,
      name: account.name,
      normal: account.normal,
      opening,
      debit: change.debit,
      credit: change.credit,
      closing,
      debitColumn: closeSide.debit,
      creditColumn: closeSide.credit,
    });
  }
  return {
    entityId: entity.id,
    entityLabel: entity.legalName,
    period,
    rows: rows.sort((a, b) => a.code.localeCompare(b.code)),
    totalOpeningDebit,
    totalOpeningCredit,
    totalDebit,
    totalCredit,
    totalClosingDebit,
    totalClosingCredit,
    balanced: totalClosingDebit === totalClosingCredit && totalDebit === totalCredit,
  };
};

/* -------------------------------------------------------------------------- */
/*  Laba rugi                                                                 */
/* -------------------------------------------------------------------------- */

export interface IncomeStatement {
  entityId: string;
  entityLabel: string;
  period: ReportPeriod;
  revenues: ReportLine[];
  expenses: ReportLine[];
  totalRevenue: number;
  totalExpense: number;
  /** Positif = laba, negatif = rugi. */
  netResult: number;
  journalCount: number;
  draftCount: number;
}

export const buildIncomeStatement = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entity: EntityProfile,
  period: ReportPeriod
): IncomeStatement => {
  const totals = movementByAccount(entries, chart, entity.id, period);
  const revenues = linesFromTotals(totals, chart, entity.id, ['PENDAPATAN'], 'KREDIT');
  const expenses = linesFromTotals(totals, chart, entity.id, ['BEBAN'], 'DEBIT');
  const totalRevenue = sum(revenues);
  const totalExpense = sum(expenses);
  const counted = ledger(entries).filter((item) => item.entityId === entity.id && inPeriod(item, period));
  return {
    entityId: entity.id,
    entityLabel: entity.legalName,
    period,
    revenues,
    expenses,
    totalRevenue,
    totalExpense,
    netResult: totalRevenue - totalExpense,
    journalCount: counted.length,
    draftCount: entries.filter(
      (item) => item.entityId === entity.id && item.status === 'DRAF' && inPeriod(item, period)
    ).length,
  };
};

/* -------------------------------------------------------------------------- */
/*  Neraca (posisi keuangan)                                                   */
/* -------------------------------------------------------------------------- */

export interface BalanceSheet {
  entityId: string;
  entityLabel: string;
  asOf: string;
  assets: ReportLine[];
  liabilities: ReportLine[];
  equity: ReportLine[];
  /** Laba sampai tanggal neraca yang belum dipindah ke Saldo Laba. */
  currentEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  /** Harus nol. Bukan dibulatkan dan bukan ditutupi. */
  difference: number;
  balanced: boolean;
  problems: string[];
}

export const buildBalanceSheet = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entity: EntityProfile,
  asOf: string
): BalanceSheet => {
  const totals = cumulativeByAccount(entries, chart, entity.id, asOf);
  const assets = linesFromTotals(totals, chart, entity.id, ['ASET'], 'DEBIT');
  const liabilities = linesFromTotals(totals, chart, entity.id, ['KEWAJIBAN'], 'KREDIT');
  const equity = linesFromTotals(totals, chart, entity.id, ['MODAL'], 'KREDIT');
  const revenue = sum(linesFromTotals(totals, chart, entity.id, ['PENDAPATAN'], 'KREDIT'));
  const expense = sum(linesFromTotals(totals, chart, entity.id, ['BEBAN'], 'DEBIT'));
  const currentEarnings = revenue - expense;
  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = sum(equity) + currentEarnings;
  const difference = totalAssets - totalLiabilities - totalEquity;
  const problems: string[] = [];
  if (difference !== 0) {
    problems.push(
      `Aset tidak sama dengan utang ditambah modal: selisih ${Math.abs(difference).toLocaleString('id-ID')}. Periksa jurnal yang belum seimbang.`
    );
  }
  return {
    entityId: entity.id,
    entityLabel: entity.legalName,
    asOf,
    assets,
    liabilities,
    equity,
    currentEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    difference,
    balanced: difference === 0,
    problems,
  };
};

/* -------------------------------------------------------------------------- */
/*  Perubahan modal (ekuitas)                                                  */
/* -------------------------------------------------------------------------- */

export interface EquityStatement {
  entityId: string;
  entityLabel: string;
  period: ReportPeriod;
  opening: number;
  /** Penambahan modal (setoran, saldo laba diakui) — kredit akun modal. */
  additions: ReportLine[];
  /** Pengurangan modal (prive, dividen) — debit akun modal. */
  withdrawals: ReportLine[];
  netResult: number;
  closing: number;
  difference: number;
  balanced: boolean;
  problems: string[];
}

export const buildEquityStatement = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entity: EntityProfile,
  period: ReportPeriod
): EquityStatement => {
  const openingSheet = buildBalanceSheet(entries, chart, entity, lastDayBefore(period.from) || period.from);
  const closingSheet = buildBalanceSheet(entries, chart, entity, period.to);
  const normal = new Map(accountsForEntity(chart, entity.id).map((item) => [item.code, item.normal]));
  const additions: ReportLine[] = [];
  const withdrawals: ReportLine[] = [];
  for (const account of accountsForEntity(chart, entity.id)) {
    if (account.type !== 'MODAL') continue;
    let credit = 0;
    let debit = 0;
    for (const entry of ledger(entries)) {
      if (entry.entityId !== entity.id || !inPeriod(entry, period)) continue;
      for (const line of entry.lines) {
        if (line.code !== account.code) continue;
        credit += money(line.credit);
        debit += money(line.debit);
      }
    }
    const isCreditNormal = normal.get(account.code) === 'KREDIT';
    const net = isCreditNormal ? credit - debit : debit - credit;
    if (net === 0) continue;
    const row: ReportLine = { code: account.code, name: account.name, amount: Math.abs(net) };
    if (isCreditNormal) {
      (net > 0 ? additions : withdrawals).push(row);
    } else {
      // akun debit-normal (Prive, Dividen): tambahan debit berarti pengurangan modal
      (net > 0 ? withdrawals : additions).push(row);
    }
  }
  const netResult = buildIncomeStatement(entries, chart, entity, period).netResult;
  const computed = openingSheet.totalEquity + sum(additions) - sum(withdrawals) + netResult;
  const difference = computed - closingSheet.totalEquity;
  const problems: string[] = [];
  if (difference !== 0) {
    problems.push(
      `Modal awal ditambah perubahan tidak sama dengan modal akhir: selisih ${Math.abs(difference).toLocaleString('id-ID')}.`
    );
  }
  return {
    entityId: entity.id,
    entityLabel: entity.legalName,
    period,
    opening: openingSheet.totalEquity,
    additions,
    withdrawals,
    netResult,
    closing: closingSheet.totalEquity,
    difference,
    balanced: difference === 0,
    problems,
  };
};

/* -------------------------------------------------------------------------- */
/*  Arus kas                                                                  */
/* -------------------------------------------------------------------------- */

export interface CashFlowItem {
  memo: string;
  amount: number;
}

export interface CashFlowSection {
  key: 'OPERASI' | 'INVESTASI' | 'PENDANAAN';
  label: string;
  items: CashFlowItem[];
  total: number;
}

export interface CashFlow {
  entityId: string;
  entityLabel: string;
  period: ReportPeriod;
  sections: CashFlowSection[];
  netChange: number;
  /** Kas + bank menurut buku pada akhir periode. */
  endingCash: number;
  basis: string;
  problems: string[];
}

/**
 * Arus kas dari mutasi kas & bank tiap jurnal. Kelompok ditentukan dari akun
 * lawan pada jurnal yang sama, dan dasar itu ditulis di laporan supaya pembaca
 * tahu angka ini bukan hasil alokasi manual.
 */
export const buildCashFlow = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entity: EntityProfile,
  period: ReportPeriod
): CashFlow => {
  const codes = codeMapForEntity(entity);
  const cashCodes = new Set([codes.cash, codes.bank]);
  const typeOf = new Map(accountsForEntity(chart, entity.id).map((item) => [item.code, item.type]));
  const buckets = new Map<CashFlowSection['key'], Map<string, number>>();
  const problems: string[] = [];
  let netChange = 0;

  for (const entry of ledger(entries)) {
    if (entry.entityId !== entity.id || !inPeriod(entry, period)) continue;
    const others = entry.lines.filter((line) => !cashCodes.has(line.code) && (money(line.debit) !== 0 || money(line.credit) !== 0));
    const kinds = new Set(others.map((line) => typeOf.get(line.code) || ''));
    let section: CashFlowSection['key'] = 'OPERASI';
    if (kinds.has('ASET')) section = 'INVESTASI';
    else if (kinds.has('MODAL') || kinds.has('KEWAJIBAN')) section = 'PENDANAAN';
    if (others.length === 0) {
      problems.push(`Jurnal ${entry.ref || entry.date} hanya menyentuh akun kas, jadi kelompok arus kasnya tidak dapat ditentukan.`);
      continue;
    }
    const label = entry.description || accountName(chart, entity.id, others[0].code, 'Tanpa keterangan');
    for (const line of entry.lines) {
      if (!cashCodes.has(line.code)) continue;
      const change = money(line.debit) - money(line.credit);
      if (change === 0) continue;
      netChange += change;
      const inner = buckets.get(section) || new Map<string, number>();
      inner.set(label, (inner.get(label) || 0) + change);
      buckets.set(section, inner);
    }
  }

  const sectionDefs: { key: CashFlowSection['key']; label: string }[] = [
    { key: 'OPERASI', label: 'Kegiatan usaha' },
    { key: 'INVESTASI', label: 'Pembelian aset & barang' },
    { key: 'PENDANAAN', label: 'Modal dan pinjaman' },
  ];
  const sections: CashFlowSection[] = sectionDefs.map((def) => {
    const inner = buckets.get(def.key) || new Map<string, number>();
    const items = Array.from(inner.entries())
      .filter(([, amount]) => amount !== 0)
      .map(([memo, amount]) => ({ memo, amount }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    return {
      key: def.key,
      label: def.label,
      items,
      total: items.reduce((total, item) => total + item.amount, 0),
    };
  });

  const ending = cumulativeByAccount(entries, chart, entity.id, period.to);
  const endingCash = money(ending.get(codes.cash)) + (codes.bank === codes.cash ? 0 : money(ending.get(codes.bank)));

  return {
    entityId: entity.id,
    entityLabel: entity.legalName,
    period,
    sections,
    netChange,
    endingCash,
    basis: 'Kelompok arus kas ditentukan dari akun lawan pada tiap jurnal yang menyentuh kas atau bank.',
    problems,
  };
};

/* -------------------------------------------------------------------------- */
/*  Jurnal umum & buku besar                                                   */
/* -------------------------------------------------------------------------- */

export interface JournalFilter {
  entityId?: string;
  code?: string;
  status?: 'SEMUA' | 'TERCATAT' | 'DRAF';
  period: ReportPeriod;
}

export const filterEntries = (entries: readonly JournalEntry[], filter: JournalFilter): JournalEntry[] =>
  entries
    .filter((entry) => inPeriod(entry, filter.period))
    .filter((entry) => !filter.entityId || entry.entityId === filter.entityId)
    .filter((entry) =>
      filter.status === 'DRAF' ? entry.status === 'DRAF' : filter.status === 'TERCATAT' ? entry.status === 'POSTED' : true
    )
    .filter((entry) => !filter.code || entry.lines.some((line) => line.code === filter.code))
    .slice()
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));

export interface AccountLedger {
  account: Account | null;
  /** Saldo akun sebelum tanggal mulai periode. */
  openingBalance: number;
  rows: LedgerRow[];
  balance: number;
}

/** Buku besar satu akun dalam periode, dengan saldo berjalan dari awal buku. */
export const buildAccountLedger = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entityId: string,
  code: string,
  period: ReportPeriod
): AccountLedger => {
  const full = buildLedger(entries, chart, entityId, code);
  const before = full.rows.filter((row) => row.date < period.from);
  const openingBalance = before.length > 0 ? before[before.length - 1].running : 0;
  const normal = full.account?.normal || 'DEBIT';
  let running = openingBalance;
  const rows = full.rows
    .filter((row) => row.date >= period.from && row.date <= period.to)
    .map((row) => {
      running += normal === 'DEBIT' ? row.debit - row.credit : row.credit - row.debit;
      return { ...row, running };
    });
  return { account: full.account, openingBalance, rows, balance: running };
};

/* -------------------------------------------------------------------------- */
/*  Laporan gabungan internal & lingkup laporan resmi                         */
/* -------------------------------------------------------------------------- */

/** Tulisan wajib pada laporan gabungan: angka ini bukan dasar resmi/pajak. */
export const GABUNGAN_WARNING =
  'Laporan gabungan untuk pemantauan internal. Dasar pembukuan dua era berbeda. Bukan laporan resmi, bukan dasar pelaporan pajak.';

export interface CombinedStatement {
  period: ReportPeriod;
  splitDate: string;
  pra: IncomeStatement | null;
  pasca: IncomeStatement | null;
  totalRevenue: number;
  totalExpense: number;
  netResult: number;
  warning: string;
  notes: string[];
}

/**
 * Gabungan internal satu periode: kolom Pra-PT, kolom Pasca-PT, dan total
 * keduanya. Kolom hanya dibuat bila periode memang menyentuh tanggal entitas
 * itu — periode Juli ke atas tidak menampilkan kolom Pra-PT kosong yang
 * seolah-olah mengajak pembaca menyimpulkan belum ada usaha.
 */
export const buildCombinedStatement = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  registry: EntityRegistry,
  period: ReportPeriod
): CombinedStatement => {
  const split = registry.transitionDate;
  const lastPra = lastDayBefore(split);
  const lama = peroranganEntity(registry);
  const baru = ptEntity(registry);
  const notes: string[] = [];
  const pra =
    lama && period.from <= lastPra
      ? buildIncomeStatement(entries, chart, lama, { from: period.from, to: minDate(lastPra, period.to) })
      : null;
  const pasca =
    baru && period.to >= split
      ? buildIncomeStatement(entries, chart, baru, { from: maxDate(split, period.from), to: period.to })
      : null;
  if (pra && pra.journalCount === 0) {
    notes.push(
      `Kolom Pra-PT belum ada jurnal tercatat ${pra.period.from} s.d. ${pra.period.to}. Jalankan rekap bulanan pada menu Penutupan & Transisi lebih dulu.`
    );
  }
  if (pasca && pasca.journalCount === 0) {
    notes.push(
      `Kolom Pasca-PT belum ada jurnal tercatat ${pasca.period.from} s.d. ${pasca.period.to}. Isi rekap bulanan atau jurnal manual lebih dulu.`
    );
  }
  const totalRevenue = (pra?.totalRevenue || 0) + (pasca?.totalRevenue || 0);
  const totalExpense = (pra?.totalExpense || 0) + (pasca?.totalExpense || 0);
  return {
    period,
    splitDate: split,
    pra,
    pasca,
    totalRevenue,
    totalExpense,
    netResult: totalRevenue - totalExpense,
    warning: GABUNGAN_WARNING,
    notes,
  };
};

export interface OfficialScope {
  ok: boolean;
  problems: string[];
  /** Identitas yang belum diisi dari dokumen hukum — kop resmi tidak lengkap. */
  warnings: string[];
}

/**
 * Laporan resmi PT hanya untuk tanggal mulai berlaku PT, dan hanya dengan
 * identitas dari dokumen hukum. Tidak ada tanggal perorangan yang boleh
 * tercetak atas nama PT.
 */
export const ptReportScope = (registry: EntityRegistry, period: ReportPeriod): OfficialScope => {
  const problems: string[] = [];
  const warnings: string[] = [];
  const pt = ptEntity(registry);
  if (!pt) problems.push('Entitas PT belum terdaftar, jadi laporan resmi belum bisa dibuat.');
  if (dayKey(period.from) < registry.transitionDate) {
    problems.push(
      `Laporan resmi PT hanya mulai ${registry.transitionDate}. Tanggal mulai ${period.from} masih periode ${peroranganEntity(registry)?.legalName || 'entitas lama'}.`
    );
  }
  if (pt) {
    if (pt.legalName === ENTITY_KIND_LABEL.PT) warnings.push('Nama PT sesuai dokumen hukum belum diisi.');
    if (!pt.npwp) warnings.push('NPWP PT belum diisi.');
    if (!pt.legalDocNumber) warnings.push('Nomor akta pendirian belum diisi.');
  }
  return { ok: problems.length === 0, problems, warnings };
};

/** Indikator dashboard: Pra-PT, Pasca-PT, dan gabungan pada satu periode. */
export interface PeriodIndicators {
  pra: { revenue: number; netResult: number; journals: number } | null;
  pasca: { revenue: number; netResult: number; journals: number } | null;
  gabungan: { revenue: number; netResult: number; journals: number };
}

export const buildPeriodIndicators = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  registry: EntityRegistry,
  period: ReportPeriod
): PeriodIndicators => {
  const combined = buildCombinedStatement(entries, chart, registry, period);
  const read = (statement: IncomeStatement | null) =>
    statement
      ? { revenue: statement.totalRevenue, netResult: statement.netResult, journals: statement.journalCount }
      : null;
  const journals = (combined.pra?.journalCount || 0) + (combined.pasca?.journalCount || 0);
  return {
    pra: read(combined.pra),
    pasca: read(combined.pasca),
    gabungan: { revenue: combined.totalRevenue, netResult: combined.netResult, journals },
  };
};
