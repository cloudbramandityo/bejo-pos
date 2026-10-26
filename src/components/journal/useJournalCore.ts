import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getStoredJournalSettings,
  saveStoredJournalSettings,
  type JournalSettings,
} from '../../utils/journalStorage';
import type { JournalCloudState } from '../../lib/journalMirrorSync';
import type { JournalToastState } from './journalStatusUi';

export function useJournalCore() {
  const [settings, setSettings] = useState<JournalSettings>(() => getStoredJournalSettings());
  const [cloudState, setCloudState] = useState<JournalCloudState>('checking');
  const [cloudError, setCloudError] = useState('');
  const [toast, setToast] = useState<JournalToastState | null>(null);
  const settingsRef = useRef(settings);
  const editId = useRef(0);
  const cloudOn = useRef(true);
  const mounted = useRef(true);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const applySettings = useCallback((next: JournalSettings, stamp = false) => {
    const stamped = stamp ? { ...next, savedAt: new Date().toISOString() } : next;
    if (stamp) editId.current += 1;
    settingsRef.current = stamped;
    setSettings(stamped);
    saveStoredJournalSettings(stamped);
    return { stamped, id: editId.current };
  }, []);

  const selectYear = useCallback(
    (year: number) => {
      applySettings({ ...settingsRef.current, selectedYear: year });
    },
    [applySettings]
  );

  return {
    settings,
    settingsRef,
    editId,
    cloudOn,
    mounted,
    cloudState,
    setCloudState,
    cloudError,
    setCloudError,
    toast,
    setToast,
    showToast,
    applySettings,
    selectYear,
  };
}

export type JournalCore = ReturnType<typeof useJournalCore>;
