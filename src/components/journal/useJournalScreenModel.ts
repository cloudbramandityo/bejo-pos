import { useJournalCloud } from './useJournalCloud';
import { useJournalCore } from './useJournalCore';
import { useJournalDraft } from './useJournalDraft';
import { useJournalLinks } from './useJournalLinks';
import { useJournalViewer } from './useJournalViewer';
import { useJournalYearDialogs } from './useJournalYearDialogs';

export function useJournalScreenModel() {
  const core = useJournalCore();
  const cloud = useJournalCloud(core);
  const links = useJournalLinks(core.settings, core.showToast);
  const draft = useJournalDraft({
    core,
    persist: cloud.persist,
    savedUrl: links.savedUrl,
    selectedYear: core.settings.selectedYear,
    embedMode: core.settings.embedMode,
    showToast: core.showToast,
  });
  const dialogs = useJournalYearDialogs({
    core,
    persist: cloud.persist,
    showToast: core.showToast,
  });
  const viewer = useJournalViewer();

  return { core, cloud, links, draft, dialogs, viewer };
}

export type JournalScreenModel = ReturnType<typeof useJournalScreenModel>;
