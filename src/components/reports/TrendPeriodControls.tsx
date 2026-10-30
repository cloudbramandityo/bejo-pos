/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React from 'react';
import { Calendar, CalendarDays, CalendarRange, Layers } from 'lucide-react';
import type { TrendBucket } from '../../utils/assetTrend';

export type TrendPeriodMode = 'MINGGUAN' | 'BULANAN' | 'KUSTOM';

export interface TrendPeriodState {
  mode: TrendPeriodMode;
  customBucket: TrendBucket;
  from: string;
  to: string;
}

interface TrendPeriodControlsProps {
  state: TrendPeriodState;
  onChange: (next: TrendPeriodState) => void;
  activeBucket: TrendBucket;
  rangeFrom: string;
  rangeTo: string;
  accent?: 'blue' | 'emerald';
}

const MODE_BUTTONS: { mode: TrendPeriodMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'MINGGUAN', label: 'Mingguan', icon: <CalendarDays className="w-3.5 h-3.5" /> },
  { mode: 'BULANAN', label: 'Bulanan', icon: <CalendarRange className="w-3.5 h-3.5" /> },
  { mode: 'KUSTOM', label: 'Atur Sendiri', icon: <Layers className="w-3.5 h-3.5" /> }
];

const BUCKET_BUTTONS: { bucket: TrendBucket; label: string }[] = [
  { bucket: 'HARIAN', label: 'Harian' },
  { bucket: 'MINGGUAN', label: 'Mingguan' },
  { bucket: 'BULANAN', label: 'Bulanan' }
];

/**
 * Kontrol periode untuk panel tren: mingguan, bulanan, atau rentang manual
 * (tanggal awal dan akhir diketik sendiri).
 */
export default function TrendPeriodControls({
  state,
  onChange,
  activeBucket,
  rangeFrom,
  rangeTo,
  accent = 'blue'
}: TrendPeriodControlsProps) {
  const activeClass = accent === 'emerald' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-blue-600 text-white shadow-2xs';
  const idleClass = 'text-slate-600 hover:text-slate-900 hover:bg-slate-200';

  return (
    <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          Pilih periode:
        </span>
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
          {MODE_BUTTONS.map(({ mode, label, icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ ...state, mode })}
              aria-pressed={state.mode === mode}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                state.mode === mode ? activeClass : idleClass
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {state.mode === 'KUSTOM' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={state.from}
              max={state.to}
              onChange={(e) => onChange({ ...state, from: e.target.value })}
              className="bg-transparent text-xs font-mono font-semibold text-slate-700 focus:outline-none cursor-pointer"
              aria-label="Tanggal awal periode"
            />
            <span className="text-[11px] text-slate-400 font-bold">s.d.</span>
            <input
              type="date"
              value={state.to}
              min={state.from}
              onChange={(e) => onChange({ ...state, to: e.target.value })}
              className="bg-transparent text-xs font-mono font-semibold text-slate-700 focus:outline-none cursor-pointer"
              aria-label="Tanggal akhir periode"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {BUCKET_BUTTONS.map(({ bucket, label }) => (
              <button
                key={bucket}
                type="button"
                onClick={() => onChange({ ...state, customBucket: bucket })}
                aria-pressed={state.customBucket === bucket}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  state.customBucket === bucket ? activeClass : idleClass
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="text-[10.5px] text-slate-400 font-semibold">
            Grafik per: {BUCKET_BUTTONS.find((b) => b.bucket === activeBucket)?.label?.toLowerCase() || activeBucket.toLowerCase()}
          </span>
        </div>
      )}

      <div className="text-[10.5px] text-slate-400 font-mono">
        Periode yang dihitung: {rangeFrom} s.d. {rangeTo}
      </div>
    </div>
  );
}
