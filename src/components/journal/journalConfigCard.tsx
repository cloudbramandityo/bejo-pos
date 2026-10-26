import React from 'react';
import { Lock } from 'lucide-react';
import { JournalModeSelector } from './journalModeSelector';
import { JournalUrlPanel } from './journalUrlPanel';
import { JournalYearBar } from './journalYearBar';
import type { JournalScreenModel } from './useJournalScreenModel';

export const JournalConfigCard: React.FC<{ model: JournalScreenModel }> = ({ model }) => {
  const { core, links, draft, dialogs } = model;
  const { settings, selectYear } = core;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3 sm:p-4 space-y-3">
      {!model.canEdit && (
        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-800 leading-relaxed">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Mode hanya lihat. Anda dapat berpindah tahun dan memilih mode tampilan; tautan serta
            daftar tahun hanya dapat diubah oleh akun DEVELOPER.
          </span>
        </div>
      )}
      <JournalYearBar
        years={links.yearTabs}
        selectedYear={settings.selectedYear}
        onSelect={selectYear}
        onAdd={dialogs.openAddDialog}
        onDelete={() => dialogs.setDeleteOpen(true)}
        canEdit={model.canEdit}
      />
      <JournalUrlPanel
        year={links.activeConfig?.year ?? null}
        draftUrl={draft.draftUrl}
        onDraftChange={draft.setDraftUrl}
        onPaste={() => void draft.handlePaste()}
        onSave={draft.handleSaveUrl}
        saveDisabled={!draft.draftDiffers}
        parsed={draft.draftEmbed}
        savedUrl={links.savedUrl}
        draftDiffers={draft.draftDiffers}
        canEdit={model.canEdit}
      />
      <div className="border-t border-slate-100 pt-3">
        <JournalModeSelector value={settings.embedMode} onChange={draft.handleModeChange} />
      </div>
    </div>
  );
};
