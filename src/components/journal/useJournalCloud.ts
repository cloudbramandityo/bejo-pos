import { useCallback, useEffect, useRef } from 'react';
import {
  describeJournalCloudError,
  fetchRemoteJournalSettings,
  pushRemoteJournalSettings,
  resolveJournalSettings,
  shouldDisableJournalCloud,
} from '../../lib/journalMirrorSync';
import type { JournalSettings } from '../../utils/journalStorage';
import type { JournalCore } from './useJournalCore';

export function useJournalCloud(core: JournalCore) {
  const {
    applySettings,
    cloudOn,
    editId,
    mounted,
    setCloudError,
    setCloudState,
    settingsRef,
  } = core;
  const timer = useRef<number | null>(null);

  const runSave = useCallback(
    async (next: JournalSettings, id: number) => {
      if (!cloudOn.current) return;
      setCloudState('syncing');
      setCloudError('');
      try {
        await pushRemoteJournalSettings(next);
        if (mounted.current && editId.current === id) setCloudState('synced');
      } catch (error) {
        if (!mounted.current) return;
        setCloudState('local');
        setCloudError(describeJournalCloudError(error));
        if (shouldDisableJournalCloud(error)) cloudOn.current = false;
      }
    },
    [cloudOn, editId, mounted, setCloudError, setCloudState]
  );

  const persist = useCallback(
    (next: JournalSettings, immediate = false) => {
      const { stamped, id } = applySettings(next, true);
      if (!cloudOn.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      if (immediate) {
        void runSave(stamped, id);
        return;
      }
      timer.current = window.setTimeout(() => void runSave(stamped, id), 650);
    },
    [applySettings, cloudOn, runSave]
  );

  const bootstrap = useCallback(async () => {
    cloudOn.current = true;
    setCloudState('checking');
    setCloudError('');
    try {
      const remote = await fetchRemoteJournalSettings();
      if (!mounted.current) return;
      if (editId.current > 0) {
        await runSave(settingsRef.current, editId.current);
        return;
      }
      const action = resolveJournalSettings(settingsRef.current, remote.settings);
      if (action === 'adopt-remote' && remote.settings) {
        applySettings(remote.settings);
        setCloudState('synced');
        return;
      }
      if (action === 'push-local') {
        await runSave(settingsRef.current, 0);
        return;
      }
      setCloudState('synced');
    } catch (error) {
      if (!mounted.current) return;
      setCloudState('local');
      setCloudError(describeJournalCloudError(error));
      if (shouldDisableJournalCloud(error)) cloudOn.current = false;
    }
  }, [
    applySettings,
    cloudOn,
    editId,
    mounted,
    runSave,
    setCloudError,
    setCloudState,
    settingsRef,
  ]);

  useEffect(() => {
    void bootstrap();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [bootstrap]);

  return { persist, retryCloud: bootstrap };
}
