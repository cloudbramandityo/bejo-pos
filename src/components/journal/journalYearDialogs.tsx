import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from './journalDialog';

interface JournalYearDialogsProps {
  addOpen: boolean;
  addYear: string;
  addUrl: string;
  deleteOpen: boolean;
  selectedYear: number;
  onCloseAdd: () => void;
  onChangeYear: (value: string) => void;
  onChangeUrl: (value: string) => void;
  onConfirmAdd: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}

const inputClass =
  'mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500';

export const JournalYearDialogs: React.FC<JournalYearDialogsProps> = ({
  addOpen,
  addYear,
  addUrl,
  deleteOpen,
  selectedYear,
  onCloseAdd,
  onChangeYear,
  onChangeUrl,
  onConfirmAdd,
  onCloseDelete,
  onConfirmDelete,
}) => (
  <>
    {addOpen && (
      <Dialog title="Tambah Tahun Jurnal" onClose={onCloseAdd}>
        <label className="block text-[11px] font-bold text-slate-600">
          Tahun
          <input
            type="number"
            min={2000}
            max={2100}
            value={addYear}
            onChange={(event) => onChangeYear(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-[11px] font-bold text-slate-600">
          Tautan Google Sheet (opsional)
          <input
            type="url"
            value={addUrl}
            onChange={(event) => onChangeUrl(event.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            spellCheck={false}
            className={inputClass}
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCloseAdd}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirmAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah
          </button>
        </div>
      </Dialog>
    )}
    {deleteOpen && (
      <Dialog title="Hapus Tahun Jurnal" onClose={onCloseDelete}>
        <p className="text-xs text-slate-600 leading-relaxed">
          Hapus tahun <strong className="text-slate-900">{selectedYear}</strong> dari daftar Jurnal?
          Tautan yang tersimpan untuk tahun ini akan dilepas dari aplikasi. File Google Sheet aslinya{' '}
          <strong>tidak</strong> dihapus.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCloseDelete}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirmDelete}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus Tahun
          </button>
        </div>
      </Dialog>
    )}
  </>
);
