import React from 'react';
import { JournalConfigCard } from './journalConfigCard';
import { JournalHeader } from './journalHeader';
import { JournalToast } from './journalStatusUi';
import { JournalViewer } from './journalViewer';
import { JournalYearDialogs } from './journalYearDialogs';
import type { JournalScreenModel } from './useJournalScreenModel';

export const JournalWorkspace: React.FC<{ model: JournalScreenModel }> = ({ model }) => {
  const { core, cloud, links, draft, dialogs, viewer } = model;
  const { settings, cloudState, cloudError, toast, setToast } = core;

  return (
    <div className="w-full bg-slate-100 min-h-[70vh]">
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
        <JournalHeader
          linkedCount={links.linkedCount}
          totalYears={links.yearTabs.length}
          modeLabel={links.modeLabel}
          cloudState={cloudState}
          cloudError={cloudError}
          onRetryCloud={() => void cloud.retryCloud()}
        />
        <JournalConfigCard model={model} />
        <JournalViewer
          shellRef={viewer.shellRef}
          year={links.activeConfig?.year ?? null}
          modeLabel={links.modeLabel}
          embedUrl={links.embed.embedUrl}
          iframeKey={viewer.iframeKey}
          refreshing={viewer.refreshing}
          isFullscreen={viewer.isFullscreen}
          onRefresh={viewer.handleRefresh}
          onCopy={() => void links.handleCopy()}
          onOpen={links.handleOpen}
          onFullscreen={viewer.handleFullscreen}
        />
        <p className="text-[10px] text-slate-400 px-1 leading-relaxed">
          Tautan tersimpan otomatis di LocalStorage. Bila server mendukung, konfigurasi juga
          disinkronkan ke PocketBase (jurnal_config) dan dipulihkan saat reload.
        </p>
      </div>
      <JournalYearDialogs
        addOpen={dialogs.addOpen}
        addYear={dialogs.addYear}
        addUrl={dialogs.addUrl}
        deleteOpen={dialogs.deleteOpen}
        selectedYear={settings.selectedYear}
        onCloseAdd={() => dialogs.setAddOpen(false)}
        onChangeYear={dialogs.setAddYear}
        onChangeUrl={dialogs.setAddUrl}
        onConfirmAdd={dialogs.confirmAddYear}
        onCloseDelete={() => dialogs.setDeleteOpen(false)}
        onConfirmDelete={dialogs.confirmDeleteYear}
      />
      {toast && <JournalToast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
};
