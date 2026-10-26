import React from 'react';
import { ClipboardPaste, Info, Link2, Lock, Save } from 'lucide-react';
import { JournalUrlMeta } from './journalUrlMeta';
import type { convertGoogleSheetToEmbedUrl } from '../../utils/journalStorage';

type ParsedLink = ReturnType<typeof convertGoogleSheetToEmbedUrl>;

interface JournalUrlPanelProps {
  year: number | null;
  draftUrl: string;
  onDraftChange: (value: string) => void;
  onPaste: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  parsed: ParsedLink;
  savedUrl: string;
  draftDiffers: boolean;
  canEdit: boolean;
}

export const JournalUrlPanel: React.FC<JournalUrlPanelProps> = ({
  year,
  draftUrl,
  onDraftChange,
  onPaste,
  onSave,
  saveDisabled,
  parsed,
  savedUrl,
  draftDiffers,
  canEdit,
}) => (
  <div className="space-y-2">
    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
      <Link2 className="w-3.5 h-3.5 text-emerald-600" />
      Tautan Google Sheet {year ? `Tahun ${year}` : ''}
      {!canEdit && (
        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-[9px] font-bold text-sky-700">
          <Lock className="w-3 h-3" />
          Hanya lihat
        </span>
      )}
    </label>
    <div className="flex flex-col lg:flex-row gap-2">
      <input
        type="url"
        value={draftUrl}
        readOnly={!canEdit}
        aria-readonly={!canEdit}
        onChange={(event) => {
          if (canEdit) onDraftChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (!canEdit) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            onSave();
          }
        }}
        placeholder={canEdit ? 'https://docs.google.com/spreadsheets/d/…/edit#gid=0' : 'Tautan belum diatur'}
        spellCheck={false}
        className={`flex-1 min-w-0 px-3 py-2 rounded-xl border text-xs placeholder:text-slate-400 ${canEdit ? 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500' : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'}`}
      />
      {canEdit && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPaste}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Tempel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Simpan
          </button>
        </div>
      )}
    </div>
    <JournalUrlMeta
      parsed={parsed}
      draftUrl={draftUrl}
      savedUrl={savedUrl}
      draftDiffers={draftDiffers}
    />
    {canEdit ? (
      <p className="flex items-start gap-1.5 text-[10px] sm:text-[11px] text-slate-500 leading-relaxed">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
        Tempel link /edit, /pubhtml, atau tautan berbagi. Pastikan sheet dibagikan ke
        &quot;Siapa saja yang memiliki link&quot; agar iframe dapat menampilkannya.
      </p>
    ) : savedUrl ? (
      <p className="flex items-start gap-1.5 text-[10px] sm:text-[11px] text-sky-700 leading-relaxed">
        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-500" />
        Hanya akun DEVELOPER yang dapat mengubah tautan Jurnal tahun ini.
      </p>
    ) : (
      <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] sm:text-[11px] text-amber-800 leading-relaxed">
        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
        Tautan Google Sheet {year ? `tahun ${year}` : 'untuk tahun ini'} belum diatur.
        Hanya akun DEVELOPER yang dapat mengisi tautan ini.
      </p>
    )}
  </div>
);
