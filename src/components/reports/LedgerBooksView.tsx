/**
 * Buku besar, jurnal umum, dan neraca saldo yang dibaca dari jurnal pembukuan.
 *
 * Semua angka berasal dari jurnal tercatat (rekap bulanan, saldo awal transisi,
 * isian manual, penyesuaian, pembalik). Draf dan jurnal batal tidak mengubah
 * angka, tapi jumlahnya tetap dilaporkan supaya operator tahu ada yang belum
 * dicatat. Tidak ada satu pun baris yang nilainya dikarang.
 */
import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ListTree,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useAccountChart } from '../../hooks/useAccountChart';
import { useEntityRegistry } from '../../hooks/useEntityRegistry';
import { useLedgerEntries } from '../../hooks/useLedgerEntries';
import { accountsForEntity } from '../../utils/accountChart';
import {
  ENTITY_KIND_LABEL,
  entityForDateKey,
  entityPeriodLabel,
  formatEntityDateKey,
  type EntityProfile,
} from '../../utils/entityRegistry';
import {
  buildAccountLedger,
  buildPeriodTrialBalance,
  creditColumn,
  debitColumn,
  filterEntries,
  type ReportPeriod,
} from '../../utils/ledgerReports';
import {
  JOURNAL_SOURCE_LABEL,
  JOURNAL_STATUS_LABEL,
  alreadyReversed,
  entryTotals,
  money,
  type JournalEntry,
} from '../../utils/ledgerMath';
import { discardDraft, reverseLedgerEntry, saveLedgerEntry } from '../../utils/ledgerStorage';
import {
  accountLedgerDocument,
  journalDocument,
  trialBalanceDocument,
} from '../../utils/ledgerReportDocument';
import ReportExportBar, { exportPrintedAt } from './ReportExportBar';
import { formatRupiah } from '../../utils/formatters';

export type LedgerBookSection = 'neraca_saldo' | 'buku_besar' | 'jurnal';

interface LedgerBooksViewProps {
  section: LedgerBookSection;
  period: ReportPeriod;
  actorLabel: string;
}

const todayKey = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const entityOptionLabel = (entity: EntityProfile): string =>
  `${ENTITY_KIND_LABEL[entity.kind]} — ${entityPeriodLabel(entity)}`;

const TITLE: Record<LedgerBookSection, { title: string; note: string }> = {
  neraca_saldo: {
    title: 'NERACA SALDO',
    note: 'Saldo awal, mutasi, dan saldo akhir tiap akun pada entitas terpilih.',
  },
  buku_besar: {
    title: 'BUKU BESAR',
    note: 'Isi satu akun terurut tanggal, berikut saldo berjalannya.',
  },
  jurnal: {
    title: 'JURNAL UMUM',
    note: 'Semua catatan buku per entitas, plus isian manual untuk kejadian khusus.',
  },
};

const LedgerBooksView: React.FC<LedgerBooksViewProps> = ({ section, period, actorLabel }) => {
  const registry = useEntityRegistry();
  const chart = useAccountChart();
  const entries = useLedgerEntries();

  const [entityId, setEntityId] = useState(
    () => entityForDateKey(registry, period.to)?.id || registry.entities[0]?.id || ''
  );
  const entity = registry.entities.find((item) => item.id === entityId) || registry.entities[0] || null;

  const draftCount = useMemo(
    () => entries.filter((item) => item.status === 'DRAF').length,
    [entries]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            {TITLE[section].title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{TITLE[section].note}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
            aria-label="Entitas pembukuan"
          >
            {registry.entities.map((item) => (
              <option key={item.id} value={item.id}>
                {entityOptionLabel(item)}
              </option>
            ))}
          </select>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            {formatEntityDateKey(period.from)} s.d. {formatEntityDateKey(period.to)}
          </span>
        </div>
      </div>

      {section === 'neraca_saldo' && entity && <TrialBalanceSection entries={entries} chart={chart} entity={entity} period={period} />}
      {section === 'buku_besar' && entity && <AccountLedgerSection entries={entries} chart={chart} entity={entity} period={period} />}
      {section === 'jurnal' && (
        <JournalSection entries={entries} chart={chart} registry={registry} period={period} actorLabel={actorLabel} draftCount={draftCount} />
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Neraca saldo                                                               */
/* -------------------------------------------------------------------------- */

const TrialBalanceSection: React.FC<{
  entries: JournalEntry[];
  chart: ReturnType<typeof useAccountChart>;
  entity: EntityProfile;
  period: ReportPeriod;
}> = ({ entries, chart, entity, period }) => {
  const trial = useMemo(
    () => buildPeriodTrialBalance(entries, chart, entity, period),
    [entries, chart, entity, period]
  );
  const posted = entries.filter((item) => item.entityId === entity.id && item.status === 'POSTED').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
          {trial.rows.length} akun bergerak · {posted} jurnal tercatat
        </span>
        <span
          className={`px-2.5 py-1 rounded-lg border ${
            trial.balanced
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          {trial.balanced
            ? 'Seimbang — total debit sama total kredit'
            : `Belum seimbang, selisih ${formatRupiah(trial.totalClosingDebit - trial.totalClosingCredit)}`}
        </span>
        <ReportExportBar
          build={() => (trial.rows.length === 0 ? null : trialBalanceDocument(trial, { printedAt: exportPrintedAt() }))}
          blocked="Belum ada akun bergerak pada periode ini, jadi tidak ada yang bisa diunduh."
        />
      </div>

      {trial.rows.length === 0 ? (
        <EmptyBooks />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Kode</th>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Nama akun</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Awal debit</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Awal kredit</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Debit</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Kredit</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Akhir debit</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Akhir kredit</th>
              </tr>
            </thead>
            <tbody>
              {trial.rows.map((row) => (
                <tr key={row.code} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono font-bold text-slate-700">{row.code}</td>
                  <td className="px-3 py-2 text-slate-800 font-semibold">{row.name}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                    {formatRupiah(debitColumn(row.opening, row.normal))}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                    {formatRupiah(creditColumn(row.opening, row.normal))}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">{formatRupiah(row.debit)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">{formatRupiah(row.credit)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900">
                    {formatRupiah(row.debitColumn)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900">
                    {formatRupiah(row.creditColumn)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-50 font-black text-slate-900">
                <td className="px-3 py-2.5" colSpan={2}>
                  JUMLAH
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatRupiah(trial.totalOpeningDebit)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatRupiah(trial.totalOpeningCredit)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatRupiah(trial.totalDebit)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatRupiah(trial.totalCredit)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatRupiah(trial.totalClosingDebit)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatRupiah(trial.totalClosingCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

const EmptyBooks: React.FC = () => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5">
    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">Belum ada jurnal tercatat</h4>
    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
      Lengkapi menu <strong>Penutupan &amp; Transisi</strong> lebih dulu: saldo awal 1 Juli 2026 dan rekap bulanan
      membentuk angka di sini. Laporan tidak menampilkan taksiran.
    </p>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Buku besar                                                                 */
/* -------------------------------------------------------------------------- */

const AccountLedgerSection: React.FC<{
  entries: JournalEntry[];
  chart: ReturnType<typeof useAccountChart>;
  entity: EntityProfile;
  period: ReportPeriod;
}> = ({ entries, chart, entity, period }) => {
  const accounts = accountsForEntity(chart, entity.id);
  const [code, setCode] = useState(accounts[0]?.code || '');
  const active = accounts.find((item) => item.code === code) || accounts[0] || null;
  const ledger = useMemo(
    () => (active ? buildAccountLedger(entries, chart, entity.id, active.code, period) : null),
    [entries, chart, entity.id, active, period]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ListTree className="w-4 h-4 text-slate-400" />
        <select
          value={active?.code || ''}
          onChange={(event) => setCode(event.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          aria-label="Akun buku besar"
        >
          {accounts.map((account) => (
            <option key={account.code} value={account.code}>
              {account.code} — {account.name}
              {account.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </select>
        {active?.archived && (
          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            Akun diarsipkan; catatan lamanya tetap terbaca di sini.
          </span>
        )}
        <ReportExportBar
          build={() =>
            !ledger || ledger.rows.length === 0
              ? null
              : accountLedgerDocument(ledger, entity.legalName, period, { printedAt: exportPrintedAt() })
          }
          blocked="Akun ini belum punya catatan pada periode terpilih."
        />
      </div>

      {!ledger || ledger.rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <p className="text-xs text-slate-600 leading-relaxed">
            Tidak ada catatan pada akun ini dalam periode terpilih. Saldo awal periode: {formatRupiah(ledger?.openingBalance || 0)}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Nomor bukti</th>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Keterangan</th>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Sumber</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Debit</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Kredit</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100 bg-slate-50/60">
                <td className="px-3 py-2 font-mono text-slate-600">{formatEntityDateKey(period.from)}</td>
                <td className="px-3 py-2" colSpan={5}>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Saldo awal periode</span>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-800">
                  {formatRupiah(ledger.openingBalance)}
                </td>
              </tr>
              {ledger.rows.map((row, index) => (
                <tr key={`${row.date}-${row.ref}-${index}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-slate-700">{formatEntityDateKey(row.date)}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{row.ref || '-'}</td>
                  <td className="px-3 py-2 text-slate-800">{row.description || '-'}</td>
                  <td className="px-3 py-2 text-[11px] font-bold text-slate-500">{JOURNAL_SOURCE_LABEL[row.source]}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">{formatRupiah(row.debit)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">{formatRupiah(row.credit)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900">
                    {formatRupiah(row.running)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-900 bg-slate-50">
                <td className="px-3 py-2.5" colSpan={6}>
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Saldo akhir</span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums font-black text-slate-900">
                  {formatRupiah(ledger.balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Jurnal umum + isian manual                                                 */
/* -------------------------------------------------------------------------- */

interface LineDraft {
  code: string;
  debit: string;
  credit: string;
}

const JournalSection: React.FC<{
  entries: JournalEntry[];
  chart: ReturnType<typeof useAccountChart>;
  registry: ReturnType<typeof useEntityRegistry>;
  period: ReportPeriod;
  actorLabel: string;
  draftCount: number;
}> = ({ entries, chart, registry, period, actorLabel, draftCount }) => {
  const [entityFilter, setEntityFilter] = useState('SEMUA');
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | 'TERCATAT' | 'DRAF'>('SEMUA');
  const [codeFilter, setCodeFilter] = useState('');
  const [reversalDate, setReversalDate] = useState(todayKey());
  const [notice, setNotice] = useState('');
  const [rejected, setRejected] = useState<string[]>([]);

  const rows = useMemo(
    () =>
      filterEntries(entries, {
        entityId: entityFilter === 'SEMUA' ? undefined : entityFilter,
        code: codeFilter || undefined,
        status: statusFilter,
        period,
      }),
    [entries, entityFilter, statusFilter, codeFilter, period]
  );

  const allCodes = useMemo(() => {
    const set = new Map<string, string>();
    for (const account of chart.accounts) set.set(account.code, account.name);
    return Array.from(set.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [chart]);

  /* --- isian manual --- */
  const [manualDate, setManualDate] = useState(todayKey());
  const [ref, setRef] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { code: '', debit: '', credit: '' },
    { code: '', debit: '', credit: '' },
  ]);
  const manualEntity = entityForDateKey(registry, manualDate);
  const manualAccounts = manualEntity ? accountsForEntity(chart, manualEntity.id) : [];

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      debit += money(line.debit);
      credit += money(line.credit);
    }
    return { debit, credit, difference: debit - credit };
  }, [lines]);

  const setLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const submitManual = (status: 'DRAF' | 'POSTED') => {
    setNotice('');
    setRejected([]);
    if (!manualEntity) {
      setRejected([`Tanggal ${manualDate} tidak termasuk periode entitas mana pun.`]);
      return;
    }
    const result = saveLedgerEntry(
      {
        entityId: manualEntity.id,
        date: manualDate,
        ref: ref.trim(),
        description: description.trim(),
        source: 'MANUAL',
        status,
        lines: lines
          .filter((line) => line.code && (money(line.debit) !== 0 || money(line.credit) !== 0))
          .map((line) => ({ code: line.code, debit: money(line.debit), credit: money(line.credit) })),
      },
      actorLabel
    );
    if (!result.ok) {
      setRejected(result.problems);
      return;
    }
    setNotice(
      `${status === 'DRAF' ? 'Draf' : 'Jurnal'} ${result.entry?.ref || result.entry?.id} tersimpan atas nama ${actorLabel}.`
    );
    setRef('');
    setDescription('');
    setLines([
      { code: '', debit: '', credit: '' },
      { code: '', debit: '', credit: '' },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Entitas
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
            className="block mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="SEMUA">Semua entitas</option>
            {registry.entities.map((item) => (
              <option key={item.id} value={item.id}>
                {entityOptionLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'SEMUA' | 'TERCATAT' | 'DRAF')}
            className="block mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="SEMUA">Semua</option>
            <option value="TERCATAT">Tercatat</option>
            <option value="DRAF">Draf</option>
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Akun
          <select
            value={codeFilter}
            onChange={(event) => setCodeFilter(event.target.value)}
            className="block mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="">Semua akun</option>
            {allCodes.map(([code, name]) => (
              <option key={code} value={code}>
                {code} — {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Tanggal pembalik
          <input
            type="date"
            value={reversalDate}
            onChange={(event) => setReversalDate(event.target.value)}
            className="block mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-700 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-600">
        <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
          {rows.length} jurnal pada periode ini
        </span>
        {draftCount > 0 && (
          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
            {draftCount} draf belum dicatat — angka laporan belum memakainya
          </span>
        )}
        <ReportExportBar
          build={() =>
            rows.length === 0
              ? null
              : journalDocument(
                  rows,
                  chart,
                  registry.entities.find((item) => item.id === entityFilter)?.legalName || 'Semua entitas',
                  period,
                  { printedAt: exportPrintedAt() }
                )
          }
          blocked="Belum ada jurnal pada penyaringan ini."
        />
      </div>

      {rows.length === 0 ? (
        <EmptyBooks />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Bukti</th>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Keterangan</th>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Rincian</th>
                <th className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Sumber</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Jumlah</th>
                <th className="text-right px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const sum = entryTotals(entry);
                const reversed = alreadyReversed(entries, entry.id);
                return (
                  <tr key={entry.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">
                      {formatEntityDateKey(entry.date)}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{entry.ref || '-'}</td>
                    <td className="px-3 py-2 text-slate-800 max-w-[260px]">{entry.description || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        {entry.lines.map((line, index) => (
                          <div key={`${entry.id}-${line.code}-${index}`} className="font-mono text-[11px] text-slate-600">
                            {line.code} D {formatRupiah(line.debit)} K {formatRupiah(line.credit)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-slate-500">{JOURNAL_SOURCE_LABEL[entry.source]}</span>
                      <span
                        className={`ml-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          entry.status === 'POSTED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : entry.status === 'DRAF'
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {JOURNAL_STATUS_LABEL[entry.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {formatRupiah(sum.debit)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {entry.status === 'POSTED' ? (
                        <button
                          type="button"
                          disabled={reversed}
                          onClick={() => {
                            const result = reverseLedgerEntry(entry.id, reversalDate, actorLabel);
                            setRejected(result.problems);
                            setNotice(
                              result.ok
                                ? `Jurnal ${entry.ref || entry.id} dibalik pada ${formatEntityDateKey(
                                    result.reversal?.date || reversalDate
                                  )} oleh ${actorLabel}.`
                                : ''
                            );
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 ml-auto ${
                            reversed
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-900 hover:text-slate-900 cursor-pointer'
                          }`}
                          title={reversed ? 'Jurnal ini sudah punya pembalik' : 'Buat jurnal pembalik'}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {reversed ? 'Sudah dibalik' : 'Balikkan'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const result = discardDraft(entry.id);
                            setRejected(result.reason ? [result.reason] : []);
                            setNotice(result.removed ? `Draf ${entry.ref || entry.id} dibuang.` : '');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-300 bg-white text-slate-700 hover:border-rose-500 hover:text-rose-700 flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Buang draf
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Isian manual per entitas ===== */}
      <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Catat kejadian khusus</h4>
          <span className="text-[11px] font-bold text-slate-500">
            {manualEntity
              ? `Pemilik tanggal ${formatEntityDateKey(manualDate)}: ${ENTITY_KIND_LABEL[manualEntity.kind]}`
              : 'Tanggal di luar periode entitas mana pun'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Untuk pemilik PT, pengambilan dana dicatat sesuai dokumen pendukungnya: setoran modal, pinjaman pemegang
          saham, penggantian biaya, gaji direksi, atau dividen. Prive tidak tersedia untuk PT.
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={manualDate}
            onChange={(event) => setManualDate(event.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-700 focus:outline-none"
            aria-label="Tanggal jurnal"
          />
          <input
            type="text"
            value={ref}
            onChange={(event) => setRef(event.target.value)}
            placeholder="Nomor bukti / dokumen"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none w-44"
          />
          <input
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Keterangan singkat"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none flex-1 min-w-[200px]"
          />
        </div>

        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <select
                value={line.code}
                onChange={(event) => setLine(index, { code: event.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none flex-1 min-w-[220px]"
                aria-label={`Akun baris ${index + 1}`}
              >
                <option value="">Pilih akun</option>
                {manualAccounts
                  .filter((account) => !account.archived && account.postable)
                  .map((account) => (
                    <option key={account.code} value={account.code}>
                      {account.code} — {account.name}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                value={line.debit}
                onChange={(event) => setLine(index, { debit: event.target.value })}
                placeholder="Debit"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right font-mono text-xs font-semibold text-slate-700 focus:outline-none w-36"
              />
              <input
                type="number"
                value={line.credit}
                onChange={(event) => setLine(index, { credit: event.target.value })}
                placeholder="Kredit"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right font-mono text-xs font-semibold text-slate-700 focus:outline-none w-36"
              />
              <button
                type="button"
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                disabled={lines.length <= 2}
                className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold ${
                  lines.length <= 2
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-rose-500 hover:text-rose-700 cursor-pointer'
                }`}
                title="Hapus baris ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setLines((current) => [...current, { code: '', debit: '', credit: '' }])}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:border-slate-900 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah baris
          </button>
          <span className="font-mono text-xs font-bold text-slate-700 tabular-nums">
            Debit {formatRupiah(totals.debit)} · Kredit {formatRupiah(totals.credit)}
            {totals.difference !== 0 && (
              <span className="text-rose-600"> · selisih {formatRupiah(Math.abs(totals.difference))}</span>
            )}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => submitManual('DRAF')}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:border-slate-900 hover:text-slate-900 flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan sebagai draf
          </button>
          <button
            type="button"
            onClick={() => submitManual('POSTED')}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            Catat jurnal
          </button>
        </div>

        {rejected.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-1">
            {rejected.map((problem) => (
              <p key={problem} className="text-[11px] font-semibold text-amber-900 leading-relaxed flex items-start gap-2">
                <TriangleAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                {problem}
              </p>
            ))}
          </div>
        )}
        {notice && (
          <p className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
};

export default LedgerBooksView;
