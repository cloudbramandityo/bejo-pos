import React from 'react';
import { Eye, Globe, Pencil } from 'lucide-react';
import { JOURNAL_MODE_OPTIONS } from './journalModes';
import type { JournalEmbedMode } from '../../utils/journalStorage';

const MODE_ICONS: Record<JournalEmbedMode, React.ElementType> = {
  preview: Eye,
  edit: Pencil,
  html: Globe,
};

interface JournalModeSelectorProps {
  value: JournalEmbedMode;
  onChange: (mode: JournalEmbedMode) => void;
}

export const JournalModeSelector: React.FC<JournalModeSelectorProps> = ({ value, onChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
    {JOURNAL_MODE_OPTIONS.map((option) => {
      const Icon = MODE_ICONS[option.key];
      const active = option.key === value;
      return (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={active}
          className={`text-left rounded-xl border p-2.5 transition-all cursor-pointer ${
            active
              ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-extrabold text-slate-900 leading-tight">
              {option.label}
            </span>
            {option.key === 'preview' && (
              <span className="ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
                Rekomendasi
              </span>
            )}
          </span>
          <span className="block mt-1.5 text-[10px] leading-relaxed text-slate-500">
            {option.description}
          </span>
        </button>
      );
    })}
  </div>
);
