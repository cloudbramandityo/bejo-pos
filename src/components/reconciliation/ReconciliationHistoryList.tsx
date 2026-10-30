/**
 * Daftar analisa Rekonsiliasi yang pernah disimpan di server.
 */
import React from 'react';
import { FolderOpen, FileDown, Trash2 } from 'lucide-react';
import { ReconciliationRun } from '../../types/reconciliation';
import { formatColumnValue, formatPercentValue } from '../../utils/reconciliationMath';

interface ReconciliationHistoryListProps {
  runs: ReconciliationRun[];
  activeId: string;
  canDelete: boolean;
  isLoading: boolean;
  onOpen: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ReconciliationHistoryList: React.FC<ReconciliationHistoryListProps> = ({
  runs,
  activeId,
  canDelete,
  isLoading,
  onOpen,
  onDownload,
  onDelete,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
    <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Riwayat tersimpan</h3>
        <p className="text-[11px] text-slate-500">Buka lagi analisa lama atau unduh sebagai PDF.</p>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {isLoading && runs.length === 0 ? 'menunggu' : `${runs.length} analisa`}
      </span>
    </div>

    {isLoading && (
      <div className="px-4 sm:px-5 py-4 text-xs text-slate-500">Mengambil riwayat dari server...</div>
    )}

    {!isLoading && runs.length === 0 && (
      <div className="px-4 sm:px-5 py-6 text-center">
        <p className="text-xs font-bold text-slate-700">Belum ada yang disimpan</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Isi Laporan A dan B, jalankan analisa, lalu tekan Simpan.
        </p>
      </div>
    )}

    <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
      {runs.map((run) => {
        const active = run.id === activeId;
        const analysis = run.analysis;
        const primary = analysis?.summaries?.[0];
        const primaryLabel = primary?.label?.trim() || 'Selisih';
        return (
          <div
            key={run.id}
            className={`px-4 sm:px-5 py-3 flex flex-wrap items-center gap-3 ${
              active ? 'bg-emerald-50/60' : 'hover:bg-slate-50/70'
            }`}
          >
            <div className="min-w-[180px] flex-1">
              <div className="text-xs font-bold text-slate-800 truncate">{run.title || 'Tanpa nama'}</div>
              <div className="text-[10.5px] text-slate-500 mt-0.5">
                {new Date(run.updatedAt || run.createdAt || Date.now()).toLocaleDateString('id-ID')}
                {' • '}
                {analysis
                  ? `${analysis.countedRows} baris • ${analysis.columns.length} kolom`
                  : 'belum ada analisa'}
                {run.authorName ? ` • ${run.authorName}` : ''}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[150px]">
                {primaryLabel}
              </div>
              <div className="text-xs font-mono font-bold text-slate-800">
                {primary ? formatColumnValue(primary.kind, primary.totalDifference) : '-'}
              </div>
              <div className="text-[10.5px] font-mono text-slate-500">
                {primary ? formatPercentValue(primary.totalPercent) : ''}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpen(run.id)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 hover:border-emerald-400 cursor-pointer"
                title="Buka analisa ini"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Buka
              </button>
              <button
                type="button"
                onClick={() => onDownload(run.id)}
                disabled={!run.analysis}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 hover:border-emerald-400 disabled:opacity-40 cursor-pointer"
                title="Unduh PDF"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(run.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="Hapus analisa ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
