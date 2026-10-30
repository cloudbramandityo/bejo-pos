/**
 * Tabel hasil analisa Rekonsiliasi: ringkasan tiap kolom pembanding, lalu
 * selisih, persen, dan kesimpulan per baris untuk setiap kolom.
 */
import React from 'react';
import { BarChart3, CircleCheck, CircleAlert, Minus } from 'lucide-react';
import {
  ReconciliationAnalysis,
  ReconciliationColumn,
  ReconciliationKind,
  ReconciliationRun,
  ReconciliationVerdict,
} from '../../types/reconciliation';
import {
  columnKindLabel,
  differenceHeading,
  formatColumnValue,
  formatPercentValue,
  natureLabel,
  summaryCountsText,
  verdictLabel,
} from '../../utils/reconciliationMath';

interface ReconciliationResultsProps {
  run: ReconciliationRun;
  analysis: ReconciliationAnalysis;
}

const verdictStyle = (verdict: string) => {
  if (verdict === 'GOOD') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (verdict === 'BAD') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

const VerdictChip: React.FC<{
  kind: ReconciliationKind;
  verdict: ReconciliationVerdict;
  difference: number;
}> = ({ kind, verdict, difference }) => {
  const Icon = verdict === 'GOOD' ? CircleCheck : verdict === 'BAD' ? CircleAlert : Minus;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10.5px] font-bold ${verdictStyle(verdict)}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {verdictLabel(kind, verdict, difference)}
    </span>
  );
};

const differenceClass = (verdict: ReconciliationVerdict) => {
  if (verdict === 'GOOD') return 'text-emerald-700';
  if (verdict === 'BAD') return 'text-rose-700';
  return 'text-slate-500';
};

const ColumnSection: React.FC<{
  kind: ReconciliationKind;
  column: ReconciliationColumn;
  analysis: ReconciliationAnalysis;
  labelA: string;
  labelB: string;
}> = ({ kind, column, analysis, labelA, labelB }) => {
  const isVarians = kind === 'VARIANS';
  const summary = analysis.summaries.find((item) => item.columnId === column.id);

  return (
    <div className="border-t border-slate-100">
      <div className="px-4 sm:px-5 pt-3.5 pb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className="text-xs font-extrabold text-slate-900">
          {column.label.trim() || `Kolom ${columnKindLabel(column.kind)}`}
        </h4>
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
          {columnKindLabel(column.kind)}
        </span>
        {isVarians && column.direction !== 'ROW' ? (
          <span className="text-[10.5px] text-slate-500">
            {column.direction === 'NAIK' ? 'naik menguntungkan' : 'turun menguntungkan'}
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <th className="px-3 py-2 font-bold w-10">No</th>
              <th className="px-3 py-2 font-bold">Uraian</th>
              <th className="px-3 py-2 font-bold w-32 text-right" title={labelA}>
                A
              </th>
              <th className="px-3 py-2 font-bold w-32 text-right" title={labelB}>
                B
              </th>
              <th className="px-3 py-2 font-bold w-32 text-right">{differenceHeading(kind)}</th>
              <th className="px-3 py-2 font-bold w-20 text-right">%</th>
              <th className="px-3 py-2 font-bold w-44">Kesimpulan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {analysis.rows.map((row, index) => {
              const cell = row.cells.find((item) => item.columnId === column.id);
              if (!cell) return null;
              return (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 text-[11px] font-bold text-slate-400">{index + 1}</td>
                  <td className="px-3 py-2">
                    <div className="text-xs font-bold text-slate-800">{row.label}</div>
                    {isVarians && (
                      <div className="text-[10.5px] text-slate-500">
                        Baris {natureLabel(row.nature).toLowerCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono text-slate-700">
                    {formatColumnValue(column.kind, cell.valueA)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono text-slate-700">
                    {formatColumnValue(column.kind, cell.valueB)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right text-xs font-mono font-bold ${differenceClass(cell.verdict)}`}
                  >
                    {formatColumnValue(column.kind, cell.difference)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono text-slate-700">
                    {formatPercentValue(cell.percent)}
                  </td>
                  <td className="px-3 py-2">
                    <VerdictChip
                      kind={kind}
                      verdict={cell.verdict}
                      difference={cell.difference}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white">
              <td className="px-3 py-2.5 text-[11px] font-bold" colSpan={2}>
                Jumlah {analysis.countedRows} baris
              </td>
              <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold">
                {formatColumnValue(column.kind, summary?.totalA ?? 0)}
              </td>
              <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold">
                {formatColumnValue(column.kind, summary?.totalB ?? 0)}
              </td>
              <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold">
                {formatColumnValue(column.kind, summary?.totalDifference ?? 0)}
              </td>
              <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold">
                {formatPercentValue(summary?.totalPercent ?? null)}
              </td>
              <td className="px-3 py-2.5 text-[10.5px] font-bold">
                {summaryCountsText(kind, summary)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export const ReconciliationResults: React.FC<ReconciliationResultsProps> = ({ run, analysis }) => {
  const isVarians = analysis.kind === 'VARIANS';
  const labelA = run.labelA.trim() || 'Laporan A';
  const labelB = run.labelB.trim() || 'Laporan B';

  if (analysis.rows.length === 0 || analysis.columns.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-xs">
        <BarChart3 className="w-6 h-6 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-700">Belum ada hasil analisa</p>
        <p className="text-xs text-slate-500 mt-1">
          Isi nama baris beserta angkanya, lalu tekan Jalankan Analisa.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hasil analisa</h3>
            <p className="text-[11px] text-slate-500">
              Dihitung {new Date(analysis.generatedAt).toLocaleString('id-ID')} —{' '}
              {analysis.countedRows} baris dinilai di {analysis.columns.length} kolom
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {isVarians ? 'Varians' : 'Komparatif'}
        </span>
      </div>

      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-100">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Jumlah tiap kolom
        </div>
        <div className="text-[11px] text-slate-600 mb-2">
          A = {labelA} · B = {labelB}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-1.5 pr-3 font-bold">Kolom</th>
                <th className="py-1.5 px-3 font-bold text-right">A</th>
                <th className="py-1.5 px-3 font-bold text-right">B</th>
                <th className="py-1.5 px-3 font-bold text-right">
                  {isVarians ? 'Selisih bersih' : 'Pertumbuhan'}
                </th>
                <th className="py-1.5 pl-3 font-bold text-right">% terhadap A</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {analysis.columns.map((column) => {
                const summary = analysis.summaries.find((item) => item.columnId === column.id);
                const total = summary?.totalDifference ?? 0;
                return (
                  <tr key={column.id}>
                    <td className="py-2 pr-3 text-xs font-bold text-slate-800">
                      {column.label.trim() || `Kolom ${columnKindLabel(column.kind)}`}
                    </td>
                    <td className="py-2 px-3 text-right text-xs font-mono text-slate-700">
                      {formatColumnValue(column.kind, summary?.totalA ?? 0)}
                    </td>
                    <td className="py-2 px-3 text-right text-xs font-mono text-slate-700">
                      {formatColumnValue(column.kind, summary?.totalB ?? 0)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right text-xs font-mono font-bold ${
                        !isVarians && total > 0
                          ? 'text-emerald-700'
                          : !isVarians && total < 0
                            ? 'text-rose-700'
                            : 'text-slate-800'
                      }`}
                    >
                      {formatColumnValue(column.kind, total)}
                    </td>
                    <td className="py-2 pl-3 text-right text-xs font-mono text-slate-700">
                      {formatPercentValue(summary?.totalPercent ?? null)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {analysis.columns.map((column) => (
        <ColumnSection
          key={column.id}
          kind={analysis.kind}
          column={column}
          analysis={analysis}
          labelA={labelA}
          labelB={labelB}
        />
      ))}

      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {isVarians
            ? 'Selisih = Laporan A dikurangi Laporan B. Arahnya mengikuti sifat baris, kecuali kolomnya diatur sendiri.'
            : 'Selisih = Laporan B dikurangi Laporan A, dibaca sebagai naik atau turun.'}{' '}
          {isVarians &&
            'Baris Perbandingan hanya dibandingkan, tidak dinilai untung atau rugi.'}{' '}
          Persen memakai Laporan A sebagai dasar; baris dengan Laporan A nol persennya dikosongkan.
        </p>
      </div>
    </div>
  );
};
