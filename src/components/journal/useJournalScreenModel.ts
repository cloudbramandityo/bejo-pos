import { useJournalCloud } from './useJournalCloud';
import { useJournalCore } from './useJournalCore';
import { useJournalDraft } from './useJournalDraft';
import { useJournalLinks } from './useJournalLinks';
import { useJournalViewer } from './useJournalViewer';
import { useJournalYearDialogs } from './useJournalYearDialogs';

interface JournalScreenOptions {
  canEdit?: boolean;
}

export function useJournalScreenModel({ canEdit = true }: JournalScreenOptions = {}) {
  const core = useJournalCore();
  const cloud = useJournalCloud(core, canEdit);
  const links = useJournalLinks(core.settings, core.showToast);
  const draft = useJournalDraft({
    core,
    persist: cloud.persist,
    savedUrl: links.savedUrl,
    selectedYear: core.settings.selectedYear,
    embedMode: core.settings.embedMode,
    showToast: core.showToast,
    canEdit,
  });
  const dialogs = useJournalYearDialogs({
    core,
    persist: cloud.persist,
    showToast: core.showToast,
    canEdit,
  });
  const viewer = useJournalViewer();

  return { canEdit, core, cloud, links, draft, dialogs, viewer };
}

export type JournalScreenModel = ReturnType<typeof useJournalScreenModel>;
