import React from 'react';
import { AlertCircle, CheckCircle2, Cloud, CloudOff, Loader2, X } from 'lucide-react';
import type { JournalCloudState } from '../../lib/journalMirrorSync';

const CLOUD_CHIP: Record<JournalCloudState, { label: string; className: string }> = {
  checking: { label: 'Memeriksa cloud', className: 'border-slate-200 bg-white text-slate-600' },
  syncing: { label: 'Menyinkronkan', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  synced: { label: 'Cloud tersinkron', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  local: { label: 'Lokal saja', className: 'border-slate-200 bg-slate-100 text-slate-600' },
};

export const CloudStatusChip: React.FC<{ state: JournalCloudState }> = ({ state }) => {
  const chip = CLOUD_CHIP[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold ${chip.className}`}
    >
      {state === 'checking' || state === 'syncing' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : state === 'synced' ? (
        <Cloud className="w-3.5 h-3.5" />
      ) : (
        <CloudOff className="w-3.5 h-3.5" />
      )}
      {chip.label}
    </span>
  );
};

export interface JournalToastState {
  message: string;
  tone: 'ok' | 'error';
}

export const JournalToast: React.FC<{ toast: JournalToastState; onClose: () => void }> = ({
  toast,
  onClose,
}) => (
  <div
    className={`fixed bottom-4 right-4 z-[140] max-w-sm px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-start gap-2 ${
      toast.tone === 'ok'
        ? 'bg-emerald-950 text-emerald-50 border-emerald-800'
        : 'bg-rose-950 text-rose-50 border-rose-800'
    }`}
    role="status"
  >
    {toast.tone === 'ok' ? (
      <CheckCircle2 className="w-4 h-4 shrink-0" />
    ) : (
      <AlertCircle className="w-4 h-4 shrink-0" />
    )}
    <span className="flex-1">{toast.message}</span>
    <button
      type="button"
      onClick={onClose}
      className="p-0.5 rounded text-white/70 hover:text-white"
      aria-label="Tutup notifikasi"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);
