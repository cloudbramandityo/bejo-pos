import React from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import type { JournalYearConfig } from '../../utils/journalStorage';

interface JournalYearBarProps {
  years: JournalYearConfig[];
  selectedYear: number;
  onSelect: (year: number) => void;
  onAdd: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

export const JournalYearBar: React.FC<JournalYearBarProps> = ({
  years,
  selectedYear,
  onSelect,
  onAdd,
  onDelete,
  canEdit,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1 min-w-0">
      {years.map((item) => {
        const active = item.year === selectedYear;
        const linked = Boolean(item.sheetUrl.trim());
        return (
          <button
            key={item.year}
            type="button"
            onClick={() => onSelect(item.year)}
            title={linked ? `Jurnal ${item.year} (tertaut)` : `Jurnal ${item.year} (belum tertaut)`}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
              active
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className={`w-3.5 h-3.5 ${active ? 'text-emerald-100' : 'text-slate-400'}`} />
            {item.year}
            {linked && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-200' : 'bg-emerald-500'}`}
                aria-label="Sudah tertaut"
              />
            )}
          </button>
        );
      })}
    </div>
    {canEdit && (
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Tahun
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={years.length <= 1}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus Tahun
        </button>
      </div>
    )}
  </div>
);
