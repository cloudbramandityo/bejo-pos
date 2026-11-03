/**
 * Laporan berbasis jurnal: gabungan internal dan laporan resmi PT.
 *
 * - Gabungan internal (Jan–Des 2026) menampilkan tiga kolom: Pra-PT, Pasca-PT,
 *   dan Total. Dua periode dihitung dengan dasar pembukuan bentuk usaha yang
 *   berbeda, jadi laporan ini untuk pemantauan pemilik saja. Peringatan itu
 *   berasal dari `GABUNGAN_WARNING`, bukan tulisan yang dikarang di layar.
 * - Laporan resmi PT hanya boleh mulai tanggal berlaku PT dan kopnya memakai
 *   identitas dari dokumen hukum. `ptReportScope` yang menilai itu.
 */
import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Scale,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { useAccountChart } from '../../hooks/useAccountChart';
import { useEntityRegistry } from '../../hooks/useEntityRegistry';
import { useLedgerEntries } from '../../hooks/useLedgerEntries';
import {
  ENTITY_KIND_LABEL,
  ptEntity,
  lastDayBefore,
  formatEntityDateKey,
} from '../../utils/entityRegistry';
import {
  buildBalanceSheet,
  buildCashFlow,
  buildCombinedStatement,
  buildEquityStatement,
  buildIncomeStatement,
  buildPeriodIndicators,
  ptReportScope,
  type IncomeStatement,
  type ReportLine,
  type ReportPeriod,
} from '../../utils/ledgerReports';
import {
  combinedReportDocument,
  officialReportDocument,
  type ReportStatements,
} from '../../utils/ledgerReportDocument';
import ReportExportBar, { exportPrintedAt } from './ReportExportBar';
import { JOURNAL_STATUS_LABEL } from '../../utils/ledgerMath';
import { formatRupiah } from '../../utils/formatters';

export type LedgerReportSection = 'gabungan' | 'resmi';

interface LedgerReportsViewProps {
  section: LedgerReportSection;
  period: ReportPeriod;
}

const moneyRow = (label: string, amount: number, strong = false) => (
  <div
    key={label}
    className={`flex items-center justify-between gap-3 py-1.5 ${
      strong ? 'border-t-2 border-slate-900 mt-1.5 pt-2' : 'border-b border-slate-100 last:border-0'
    }`}
  >
    <span className={`text-sm ${strong ? 'font-extrabold text-slate-900' : 'text-slate-600'}`}>{label}</span>
    <span
      className={`font-mono text-sm tabular-nums ${
        strong ? 'font-extrabold text-slate-900' : 'text-slate-800'
      } ${amount < 0 ? 'text-rose-600' : ''}`}
    >
      {formatRupiah(amount)}
    </span>
  </div>
);

const Lines: React.FC<{ rows: ReportLine[] }> = ({ rows }) => (
  <>
    {rows.map((row) => moneyRow(`${row.code} · ${row.name}`, row.amount))}
  </>
);

const EmptyNote: React.FC<{ period: ReportPeriod }> = ({ period }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
    <p className="text-xs text-slate-600 leading-relaxed">
      Belum ada jurnal tercatat {formatEntityDateKey(period.from)} s.d. {formatEntityDateKey(period.to)}.
      Jalankan menu <strong>Penutupan &amp; Transisi</strong> untuk mencatat saldo awal dan rekap bulanan.
      Laporan tidak mengisi angkanya dengan taksiran.
    </p>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Gabungan internal                                                          */
/* -------------------------------------------------------------------------- */

const CombinedReport: React.FC<{ period: ReportPeriod }> = ({ period }) => {
  const registry = useEntityRegistry();
  const chart = useAccountChart();
  const entries = useLedgerEntries();

  const combined = useMemo(
    () => buildCombinedStatement(entries, chart, registry, period),
    [entries, chart, registry, period]
  );
  const indicators = useMemo(
    () => buildPeriodIndicators(entries, chart, registry, period),
    [entries, chart, registry, period]
  );

  const columns: { key: string; label: string; statement: IncomeStatement | null }[] = [
    {
      key: 'pra',
      label: `Pra-PT (sampai ${formatEntityDateKey(lastDayBefore(combined.splitDate))})`,
      statement: combined.pra,
    },
    { key: 'pasca', label: `Pasca-PT (mulai ${formatEntityDateKey(combined.splitDate)})`, statement: combined.pasca },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-900">LAPORAN GABUNGAN INTERNAL</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatEntityDateKey(period.from)} s.d. {formatEntityDateKey(period.to)} · dipisah di tanggal transisi{' '}
            {formatEntityDateKey(combined.splitDate)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-2.5">
        <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900 leading-relaxed font-semibold">{combined.warning}</p>
      </div>

      <ReportExportBar
        build={() => combinedReportDocument(combined, indicators, { printedAt: exportPrintedAt() })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <IndicatorCard
          label="Pra-PT"
          data={indicators.pra}
          hint={ENTITY_KIND_LABEL.PERORANGAN}
        />
        <IndicatorCard
          label="Pasca-PT"
          data={indicators.pasca}
          hint={ENTITY_KIND_LABEL.PT}
        />
        <IndicatorCard label="Gabungan" data={indicators.gabungan} hint="Dua periode dijumlah" strong />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {columns.map((column) => (
          <div key={column.key} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">{column.label}</h4>
            {column.statement ? (
              column.statement.journalCount === 0 ? (
                <EmptyNote period={column.statement.period} />
              ) : (
                <div>
                  <Lines rows={column.statement.revenues} />
                  {moneyRow('Jumlah pendapatan', column.statement.totalRevenue, true)}
                  <Lines rows={column.statement.expenses} />
                  {moneyRow('Jumlah beban', column.statement.totalExpense, true)}
                  {moneyRow('Laba (rugi) berjalan', column.statement.netResult, true)}
                  <p className="text-[11px] text-slate-500 mt-2">
                    {column.statement.journalCount} jurnal tercatat{' '}
                    {column.statement.draftCount > 0 &&
                      `· ${column.statement.draftCount} draf belum ${JOURNAL_STATUS_LABEL.POSTED.toLowerCase()}`}
                  </p>
                </div>
              )
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Periode terpilih tidak menyentuh masa ini, jadi kolomnya tidak dihitung.
              </p>
            )}
          </div>
        ))}

        <div className="rounded-2xl border-2 border-slate-900 p-4">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Total gabungan</h4>
          {moneyRow('Pendapatan', combined.totalRevenue)}
          {moneyRow('Beban', combined.totalExpense)}
          {moneyRow('Laba (rugi) berjalan', combined.netResult, true)}
          {combined.notes.map((note) => (
            <p key={note} className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              {note}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

const IndicatorCard: React.FC<{
  label: string;
  data: { revenue: number; netResult: number; journals: number } | null;
  hint: string;
  strong?: boolean;
}> = ({ label, data, hint, strong }) => (
  <div className={`rounded-2xl border p-4 ${strong ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white'}`}>
    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
    <div className="text-lg font-black text-slate-900 mt-1 font-mono tabular-nums">
      {formatRupiah(data?.revenue || 0)}
    </div>
    <div className="text-[11px] text-slate-500 mt-0.5">
      {hint} · laba {formatRupiah(data?.netResult || 0)}
    </div>
    <div className="text-[11px] text-slate-400 mt-0.5">{data?.journals || 0} jurnal tercatat</div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Laporan resmi PT                                                           */
/* -------------------------------------------------------------------------- */

const OfficialReport: React.FC<{ period: ReportPeriod }> = ({ period }) => {
  const registry = useEntityRegistry();
  const chart = useAccountChart();
  const entries = useLedgerEntries();
  const pt = ptEntity(registry);

  const scope = useMemo(() => ptReportScope(registry, period), [registry, period]);
  const effectivePeriod = useMemo<ReportPeriod>(
    () => ({ from: period.from < registry.transitionDate ? registry.transitionDate : period.from, to: period.to }),
    [period, registry.transitionDate]
  );
  const statements = useMemo<ReportStatements | null>(
    () =>
      pt
        ? {
            income: buildIncomeStatement(entries, chart, pt, effectivePeriod),
            sheet: buildBalanceSheet(entries, chart, pt, effectivePeriod.to),
            equity: buildEquityStatement(entries, chart, pt, effectivePeriod),
            flow: buildCashFlow(entries, chart, pt, effectivePeriod),
          }
        : null,
    [entries, chart, pt, effectivePeriod]
  );

  if (!pt) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5">
        <h4 className="text-sm font-black text-slate-900 uppercase">Entitas PT belum terdaftar</h4>
        <p className="text-xs text-slate-600 mt-1.5">Isi lebih dulu di menu Pengaturan Entitas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center pb-4 border-b-2 border-slate-800">
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">{pt.legalName}</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {pt.address || 'Alamat belum diisi'}
          {pt.npwp ? ` · NPWP ${pt.npwp}` : ' · NPWP belum diisi'}
        </p>
        {pt.legalDocNumber && <p className="text-[11px] text-slate-500 mt-0.5">Akta / SK: {pt.legalDocNumber}</p>}
        <h3 className="text-base font-bold text-slate-800 mt-3">Laporan Keuangan — Basis Jurnal PT</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Periode {formatEntityDateKey(effectivePeriod.from)} s.d. {formatEntityDateKey(effectivePeriod.to)}
        </p>
      </div>

      {(scope.problems.length > 0 || scope.warnings.length > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-1.5">
          {scope.problems.map((problem) => (
            <p key={problem} className="text-xs font-bold text-amber-900 leading-relaxed flex items-start gap-2">
              <TriangleAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              {problem}
            </p>
          ))}
          {scope.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-900 leading-relaxed flex items-start gap-2">
              <TriangleAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              Kop resmi belum lengkap: {warning}
            </p>
          ))}
          {!scope.ok && (
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Angka di bawah memakai tanggal mulai {formatEntityDateKey(effectivePeriod.from)} agar tetap sesuai masa
              PT.
            </p>
          )}
        </div>
      )}

      {statements && (
        <ReportExportBar
          build={() =>
            officialReportDocument(pt, effectivePeriod, statements, scope, { printedAt: exportPrintedAt() })
          }
        />
      )}

      {statements ? (
        <StatementGroup statements={statements} period={effectivePeriod} />
      ) : (
        <EmptyNote period={effectivePeriod} />
      )}
    </div>
  );
};

const StatementGroup: React.FC<{
  statements: ReportStatements;
  period: ReportPeriod;
}> = ({ statements, period }) => {
  const { income, sheet, equity, flow } = statements;

  if (income.journalCount === 0) return <EmptyNote period={period} />;

  return (
    <div className="space-y-4">
      <Card title="Laporan Laba Rugi" icon={TrendingUp}>
        <Lines rows={income.revenues} />
        {moneyRow('Jumlah pendapatan', income.totalRevenue, true)}
        <Lines rows={income.expenses} />
        {moneyRow('Jumlah beban', income.totalExpense, true)}
        {moneyRow('Laba (rugi) bersih', income.netResult, true)}
        <p className="text-[11px] text-slate-500 mt-2">
          Pendapatan sudah dikurangi PPN yang dipungut, karena pungutan itu bukan pendapatan usaha.
        </p>
      </Card>

      <Card title="Laporan Perubahan Modal" icon={Scale}>
        {moneyRow('Modal awal', equity.opening)}
        <Lines rows={equity.additions} />
        <Lines rows={equity.withdrawals.map((row) => ({ ...row, amount: -row.amount }))} />
        {moneyRow('Laba (rugi) periode berjalan', equity.netResult)}
        {moneyRow('Modal akhir', equity.closing, true)}
        {!equity.balanced && (
          <p className="text-[11px] font-bold text-rose-700 mt-2">{equity.problems.join(' ')}</p>
        )}
      </Card>

      <Card title="Laporan Neraca" icon={Building2}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
            <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">Aset</h5>
            <Lines rows={sheet.assets} />
            {moneyRow('Jumlah aset', sheet.totalAssets, true)}
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
            <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">Kewajiban &amp; modal</h5>
            <Lines rows={sheet.liabilities} />
            {moneyRow('Jumlah kewajiban', sheet.totalLiabilities)}
            <Lines rows={sheet.equity} />
            {moneyRow('Laba berjalan belum dipindah', sheet.currentEarnings)}
            {moneyRow('Jumlah kewajiban & modal', sheet.totalLiabilities + sheet.totalEquity, true)}
          </div>
        </div>
        {sheet.balanced ? (
          <p className="mt-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Aset sama dengan kewajiban ditambah modal.
          </p>
        ) : (
          <p className="mt-3 text-xs font-bold text-rose-700 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            {sheet.problems.join(' ')}
          </p>
        )}
      </Card>

      <Card title="Laporan Arus Kas" icon={Wallet}>
        {flow.sections.map((section) => (
          <div key={section.key} className="mb-2 last:mb-0">
            <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">{section.label}</h5>
            {section.items.length === 0 ? (
              <p className="text-xs text-slate-400">Tidak ada pergerakan tercatat.</p>
            ) : (
              section.items.map((item) => moneyRow(item.memo, item.amount))
            )}
            {moneyRow(`Jumlah ${section.label.toLowerCase()}`, section.total, true)}
          </div>
        ))}
        {moneyRow('Kenaikan (penurunan) kas bersih', flow.netChange, true)}
        {moneyRow('Kas & bank menurut buku pada akhir periode', flow.endingCash, true)}
        <p className="text-[11px] text-slate-500 mt-2">{flow.basis}</p>
        {flow.problems.map((problem) => (
          <p key={problem} className="text-[11px] font-bold text-amber-800 mt-1.5 leading-relaxed">
            {problem}
          </p>
        ))}
      </Card>
    </div>
  );
};

const Card: React.FC<{
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ title, icon: Icon, children }) => (
  <div className="rounded-2xl border border-slate-200 p-4">
    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
      <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
        <Icon className="w-4 h-4" />
      </div>
      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{title}</h4>
    </div>
    {children}
  </div>
);

const LedgerReportsView: React.FC<LedgerReportsViewProps> = ({ section, period }) => (
  <div className="space-y-4">
    {section === 'gabungan' ? <CombinedReport period={period} /> : <OfficialReport period={period} />}
  </div>
);

export default LedgerReportsView;
