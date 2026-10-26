import React from 'react';
import { CloudOff, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { CloudStatusChip } from './journalStatusUi';
import type { JournalCloudState } from '../../lib/journalMirrorSync';
import type { UserRole } from '../../types';

interface JournalHeaderProps {
  linkedCount: number;
  totalYears: number;
  modeLabel: string;
  cloudState: JournalCloudState;
  cloudError: string;
  canEdit: boolean;
  userRole?: UserRole;
  onRetryCloud: () => void;
}

export const JournalHeader: React.FC<JournalHeaderProps> = ({
  linkedCount,
  totalYears,
  modeLabel,
  cloudState,
  cloudError,
  canEdit,
  userRole,
  onRetryCloud,
}) => (
  <div className="space-y-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Jurnal — Google Sheet Mirror
            </h2>
            <span
              className={`px-2 py-0.5 rounded-full text-white text-[10px] font-bold tracking-wide ${
                canEdit ? 'bg-slate-900' : 'bg-sky-600'
              }`}
            >
              {canEdit ? 'DEVELOPER' : `${userRole ?? 'PENGGUNA'} · HANYA LIHAT`}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            {linkedCount} dari {totalYears} tahun tertaut · Mode {modeLabel}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <CloudStatusChip state={cloudState} />
      </div>
    </div>
    {cloudError && (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
        <div className="flex items-start gap-2 text-[11px] sm:text-xs text-amber-900">
          <CloudOff className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{cloudError}</span>
        </div>
        <button
          type="button"
          onClick={onRetryCloud}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-[11px] font-bold text-amber-800 hover:bg-amber-100"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Coba lagi
        </button>
      </div>
    )}
  </div>
);
