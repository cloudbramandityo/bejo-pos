/**
 * Bentuk dokumen laporan untuk diunduh (PDF, Excel, CSV).
 *
 * Mesin laporan menyusun angkanya, berkas ini hanya menata menjadi tabel yang
 * sama untuk ketiga format. Nama entitas, periode, tanggal cetak, mata uang,
 * dan status laporan ikut terbawa supaya berkas yang keluar bisa dibaca tanpa
 * membuka aplikasi lagi.
 *
 * Berkas ini murni penataan (tidak menyentuh browser, PDF, atau Excel) supaya
 * penjaga `npm run check:entity` dapat mengujinya di Node.
 */
import { AccountChart } from './accountChart';
import { ENTITY_KIND_LABEL, formatEntityDateKey, type EntityProfile } from './entityRegistry';
import { JOURNAL_SOURCE_LABEL, JOURNAL_STATUS_LABEL, type JournalEntry } from './ledgerMath';
import {
  creditColumn,
  debitColumn,
  type AccountLedger,
  type BalanceSheet,
  type CashFlow,
  type CombinedStatement,
  type EquityStatement,
  type IncomeStatement,
  type OfficialScope,
  type PeriodIndicators,
  type PeriodTrialBalance,
  type ReportLine,
  type ReportPeriod,
} from './ledgerReports';

export type ReportCell = string | number;

export interface ReportTable {
  heading: string;
  columns: string[];
  rows: ReportCell[][];
}

export interface LedgerReportDocument {
  title: string;
  entityName: string;
  /** Baris identitas pada kop: alamat, NPWP, nomor akta. */
  identity: string[];
  periodLabel: string;
  printedAt: string;
  currency: string;
  status: string;
  tables: ReportTable[];
  notes: string[];
  fileName: string;
}

export const REPORT_CURRENCY = 'Seluruh angka dalam Rupiah (IDR).';

const periodLabelOf = (period: ReportPeriod): string =>
  `Periode ${formatEntityDateKey(period.from)} s.d. ${formatEntityDateKey(period.to)}`;

/** Nama berkas aman: tanpa karakter yang ditolak sistem operasi. */
export const safeFileName = (text: string): string =>
  text
    .replace(/[/\\?%*:|"<>]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);

/** Baris kop dari profil entitas; nilai yang belum diisi ditulis apa adanya. */
export const entityIdentityLines = (entity: EntityProfile): string[] => {
  const lines = [ENTITY_KIND_LABEL[entity.kind]];
  lines.push(entity.address ? entity.address : 'Alamat belum diisi');
  lines.push(entity.npwp ? `NPWP ${entity.npwp}` : 'NPWP belum diisi');
  if (entity.kind === 'PT') {
    lines.push(entity.legalDocNumber ? `Akta / SK: ${entity.legalDocNumber}` : 'Nomor akta belum diisi');
  }
  return lines;
};

const lineRows = (rows: ReportLine[]): ReportCell[][] => rows.map((row) => [row.code, row.name, row.amount]);

const totalRow = (label: string, amount: number): ReportCell[] => ['', label, amount];

export const incomeTable = (statement: IncomeStatement, heading = 'Laporan Laba Rugi'): ReportTable => ({
  heading,
  columns: ['Kode', 'Nama akun', 'Jumlah'],
  rows: [
    ...lineRows(statement.revenues),
    totalRow('Jumlah pendapatan', statement.totalRevenue),
    ...lineRows(statement.expenses),
    totalRow('Jumlah beban', statement.totalExpense),
    totalRow('Laba (rugi) berjalan', statement.netResult),
  ],
});

export const equityTable = (equity: EquityStatement): ReportTable => ({
  heading: 'Laporan Perubahan Modal',
  columns: ['Kode', 'Nama akun', 'Jumlah'],
  rows: [
    totalRow('Modal awal', equity.opening),
    ...equity.additions.map((row) => [row.code, `Setoran/penambahan: ${row.name}`, row.amount]),
    ...equity.withdrawals.map((row) => [row.code, `Pengurangan: ${row.name}`, -row.amount]),
    totalRow('Laba (rugi) periode berjalan', equity.netResult),
    totalRow('Modal akhir', equity.closing),
  ],
});

export const balanceTable = (sheet: BalanceSheet): ReportTable => ({
  heading: `Neraca per ${formatEntityDateKey(sheet.asOf)}`,
  columns: ['Kode', 'Nama akun', 'Jumlah'],
  rows: [
    ...lineRows(sheet.assets),
    totalRow('Jumlah aset', sheet.totalAssets),
    ...lineRows(sheet.liabilities),
    totalRow('Jumlah kewajiban', sheet.totalLiabilities),
    ...lineRows(sheet.equity),
    totalRow('Laba berjalan belum dipindah', sheet.currentEarnings),
    totalRow('Jumlah kewajiban dan modal', sheet.totalLiabilities + sheet.totalEquity),
  ],
});

export const cashFlowTable = (flow: CashFlow): ReportTable => ({
  heading: 'Laporan Arus Kas',
  columns: ['Kelompok', 'Keterangan', 'Jumlah'],
  rows: [
    ...flow.sections.flatMap((section) =>
      section.items.length === 0
        ? [[section.label, 'Tidak ada pergerakan tercatat', 0] as ReportCell[]]
        : section.items.map((item) => [section.label, item.memo, item.amount] as ReportCell[])
    ),
    ...flow.sections.map((section) => totalRow(`Jumlah ${section.label}`, section.total)),
    totalRow('Kenaikan (penurunan) kas bersih', flow.netChange),
    totalRow('Kas dan bank menurut buku pada akhir periode', flow.endingCash),
  ],
});

export const trialBalanceTable = (trial: PeriodTrialBalance): ReportTable => ({
  heading: `Neraca Saldo ${trial.entityLabel}`,
  columns: ['Kode', 'Nama akun', 'Awal debit', 'Awal kredit', 'Debit', 'Kredit', 'Akhir debit', 'Akhir kredit'],
  rows: [
    ...trial.rows.map(
      (row) =>
        [
          row.code,
          row.name,
          debitColumn(row.opening, row.normal),
          creditColumn(row.opening, row.normal),
          row.debit,
          row.credit,
          row.debitColumn,
          row.creditColumn,
        ] as ReportCell[]
    ),
    [
      '',
      'Jumlah',
      trial.totalOpeningDebit,
      trial.totalOpeningCredit,
      trial.totalDebit,
      trial.totalCredit,
      trial.totalClosingDebit,
      trial.totalClosingCredit,
    ],
  ],
});

/** Jurnal umum: satu baris per akun, nomor urut bukti ikut terbawa. */
export const journalTable = (entries: readonly JournalEntry[], chart: AccountChart): ReportTable => {
  const nameOf = new Map(chart.accounts.map((item) => [`${item.entityId}::${item.code}`, item.name]));
  const rows: ReportCell[][] = [];
  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push([
        entry.date,
        entry.ref || '-',
        entry.description || '-',
        JOURNAL_SOURCE_LABEL[entry.source],
        line.code,
        nameOf.get(`${entry.entityId}::${line.code}`) || line.code,
        line.debit || 0,
        line.credit || 0,
        JOURNAL_STATUS_LABEL[entry.status],
      ]);
    }
  }
  return {
    heading: 'Jurnal Umum',
    columns: ['Tanggal', 'No. bukti', 'Keterangan', 'Sumber', 'Kode', 'Nama akun', 'Debit', 'Kredit', 'Status'],
    rows,
  };
};

export const accountLedgerTable = (ledgerData: AccountLedger): ReportTable => ({
  heading: `Buku Besar ${ledgerData.account ? `${ledgerData.account.code} · ${ledgerData.account.name}` : 'Akun'}`,
  columns: ['Tanggal', 'No. bukti', 'Keterangan', 'Debit', 'Kredit', 'Saldo berjalan'],
  rows: [
    ['', 'Saldo awal periode', '', 0, 0, ledgerData.openingBalance],
    ...ledgerData.rows.map(
      (row) =>
        [row.date, row.ref || '-', row.description || '-', row.debit || 0, row.credit || 0, row.running] as ReportCell[]
    ),
    ['', 'Saldo akhir periode', '', 0, 0, ledgerData.balance],
  ],
});

/* -------------------------------------------------------------------------- */
/*  Dokumen                                                                    */
/* -------------------------------------------------------------------------- */

export interface DocumentOptions {
  printedAt: string;
}

const draftNote = (statement: IncomeStatement): string | null =>
  statement.draftCount > 0
    ? `${statement.draftCount} draf pada periode ini belum dicatat, jadi tidak ikut angka laporan.`
    : null;

/** Empat laporan satu entitas — dipakai layar dan berkas unduhan. */
export interface ReportStatements {
  income: IncomeStatement;
  sheet: BalanceSheet;
  equity: EquityStatement;
  flow: CashFlow;
}

/** Laporan resmi PT: empat laporan dari satu entitas, kop dari dokumen hukum. */
export const officialReportDocument = (
  entity: EntityProfile,
  period: ReportPeriod,
  statements: ReportStatements,
  scope: OfficialScope,
  options: DocumentOptions
): LedgerReportDocument => {
  const notes: string[] = [];
  notes.push(statements.income.journalCount === 0 ? 'Belum ada jurnal tercatat pada periode ini.' : `${statements.income.journalCount} jurnal tercatat dipakai.`);
  const draft = draftNote(statements.income);
  if (draft) notes.push(draft);
  notes.push(...scope.problems, ...scope.warnings.map((item) => `Kop resmi belum lengkap: ${item}.`));
  notes.push(...statements.sheet.problems, ...statements.equity.problems, ...statements.flow.problems);
  notes.push(statements.flow.basis);
  return {
    title: 'Laporan Resmi PT',
    entityName: entity.legalName,
    identity: entityIdentityLines(entity),
    periodLabel: periodLabelOf(period),
    printedAt: options.printedAt,
    currency: REPORT_CURRENCY,
    status: scope.ok
      ? 'Laporan resmi PT — basis jurnal'
      : 'Laporan resmi PT belum sah: periksa catatan pada berkas ini',
    tables: [
      incomeTable(statements.income),
      equityTable(statements.equity),
      balanceTable(statements.sheet),
      cashFlowTable(statements.flow),
    ],
    notes: notes.filter((text) => text.length > 0),
    fileName: safeFileName(`Laporan_Resmi_PT_${period.from}_${period.to}`),
  };
};

/** Gabungan internal: dua era dan totalnya, dengan peringatan dari mesin. */
export const combinedReportDocument = (
  combined: CombinedStatement,
  indicators: PeriodIndicators,
  options: DocumentOptions
): LedgerReportDocument => {
  const names = [combined.pra?.entityLabel, combined.pasca?.entityLabel].filter((name) => !!name);
  const indicatorRows: ReportCell[][] = [];
  if (indicators.pra) indicatorRows.push(['Pra-PT', indicators.pra.revenue, indicators.pra.netResult, indicators.pra.journals]);
  if (indicators.pasca)
    indicatorRows.push(['Pasca-PT', indicators.pasca.revenue, indicators.pasca.netResult, indicators.pasca.journals]);
  indicatorRows.push(['Gabungan', indicators.gabungan.revenue, indicators.gabungan.netResult, indicators.gabungan.journals]);
  const tables: ReportTable[] = [
    {
      heading: 'Indikator periode',
      columns: ['Kolom', 'Pendapatan', 'Laba (rugi)', 'Jurnal tercatat'],
      rows: indicatorRows,
    },
  ];
  if (combined.pra) tables.push(incomeTable(combined.pra, `Laba Rugi Pra-PT ${periodLabelOf(combined.pra.period)}`));
  if (combined.pasca) tables.push(incomeTable(combined.pasca, `Laba Rugi Pasca-PT ${periodLabelOf(combined.pasca.period)}`));
  tables.push({
    heading: 'Total gabungan',
    columns: ['Uraian', '', 'Jumlah'],
    rows: [
      totalRow('Pendapatan', combined.totalRevenue),
      totalRow('Beban', combined.totalExpense),
      totalRow('Laba (rugi) berjalan', combined.netResult),
    ],
  });
  return {
    title: 'Laporan Gabungan Internal',
    entityName: names.length > 0 ? names.join(' + ') : 'Dua entitas dalam periode ini',
    identity: [`Dipisah di tanggal transisi ${formatEntityDateKey(combined.splitDate)}`],
    periodLabel: periodLabelOf(combined.period),
    printedAt: options.printedAt,
    currency: REPORT_CURRENCY,
    status: combined.warning,
    tables,
    notes: [...combined.notes],
    fileName: safeFileName(`Laporan_Gabungan_Internal_${combined.period.from}_${combined.period.to}`),
  };
};

export const trialBalanceDocument = (
  trial: PeriodTrialBalance,
  options: DocumentOptions
): LedgerReportDocument => ({
  title: 'Neraca Saldo',
  entityName: trial.entityLabel,
  identity: [],
  periodLabel: periodLabelOf(trial.period),
  printedAt: options.printedAt,
  currency: REPORT_CURRENCY,
  status: trial.balanced ? 'Seimbang — total debit sama total kredit' : 'Tidak seimbang — periksa jurnal yang belum sama',
  tables: [trialBalanceTable(trial)],
  notes: [],
  fileName: safeFileName(`Neraca_Saldo_${trial.entityId}_${trial.period.from}_${trial.period.to}`),
});

export const journalDocument = (
  entries: readonly JournalEntry[],
  chart: AccountChart,
  entityName: string,
  period: ReportPeriod,
  options: DocumentOptions
): LedgerReportDocument => {
  const drafts = entries.filter((entry) => entry.status === 'DRAF').length;
  return {
    title: 'Jurnal Umum',
    entityName,
    identity: [],
    periodLabel: periodLabelOf(period),
    printedAt: options.printedAt,
    currency: REPORT_CURRENCY,
    status: `${entries.length} jurnal`,
    tables: [journalTable(entries, chart)],
    notes: drafts > 0 ? [`${drafts} baris berstatus draf — angkanya belum masuk laporan.`] : [],
    fileName: safeFileName(`Jurnal_Umum_${entityName}_${period.from}_${period.to}`),
  };
};

export const accountLedgerDocument = (
  ledgerData: AccountLedger,
  entityName: string,
  period: ReportPeriod,
  options: DocumentOptions
): LedgerReportDocument => ({
  title: 'Buku Besar',
  entityName,
  identity: [],
  periodLabel: periodLabelOf(period),
  printedAt: options.printedAt,
  currency: REPORT_CURRENCY,
  status: `${ledgerData.rows.length} mutasi tercatat`,
  tables: [accountLedgerTable(ledgerData)],
  notes: [],
  fileName: safeFileName(`Buku_Besar_${ledgerData.account?.code || 'akun'}_${period.from}_${period.to}`),
});
