import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  convertGoogleSheetToEmbedUrl,
  updateJournalSheetUrl,
  type JournalEmbedMode,
  type JournalSettings,
} from '../../utils/journalStorage';
import type { JournalCore } from './useJournalCore';

interface DraftInput {
  core: JournalCore;
  persist: (next: JournalSettings, immediate?: boolean) => void;
  savedUrl: string;
  selectedYear: number;
  embedMode: JournalEmbedMode;
  showToast: (message: string, tone?: 'ok' | 'error') => void;
  canEdit: boolean;
}

export function useJournalDraft(input: DraftInput) {
  const { settingsRef } = input.core;
  const { canEdit, embedMode, persist, savedUrl, selectedYear, showToast } = input;
  const [draftUrl, setDraftUrl] = useState(savedUrl);

  useEffect(() => {
    setDraftUrl(savedUrl);
  }, [savedUrl, selectedYear]);

  const draftEmbed = useMemo(
    () => convertGoogleSheetToEmbedUrl(draftUrl, embedMode),
    [draftUrl, embedMode]
  );
  const draftDiffers = draftUrl.trim() !== savedUrl.trim();

  const handleSaveUrl = useCallback(() => {
    if (!canEdit) {
      showToast('Hanya akun DEVELOPER yang dapat mengubah tautan Jurnal.', 'error');
      return;
    }
    const current = settingsRef.current;
    const target = current.years.find((item) => item.year === current.selectedYear);
    if (!target) return;
    const trimmed = draftUrl.trim();
    if (trimmed) {
      const parsed = convertGoogleSheetToEmbedUrl(trimmed, current.embedMode);
      if (!parsed.isValid) {
        showToast(parsed.error || 'Tautan Google Sheet tidak valid.', 'error');
        return;
      }
    }
    persist(updateJournalSheetUrl(current, target.year, trimmed), true);
    showToast(
      trimmed ? `Tautan Jurnal ${target.year} tersimpan.` : `Tautan Jurnal ${target.year} dikosongkan.`
    );
  }, [canEdit, draftUrl, persist, settingsRef, showToast]);

  const handlePaste = useCallback(async () => {
    if (!canEdit) {
      showToast('Hanya akun DEVELOPER yang dapat mengubah tautan Jurnal.', 'error');
      return;
    }
    if (!navigator.clipboard?.readText) {
      showToast('Tempel otomatis tidak didukung di perangkat ini. Tekan Ctrl+V di kolom tautan.', 'error');
      return;
    }
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        showToast('Clipboard kosong.', 'error');
        return;
      }
      setDraftUrl(text);
      const parsed = convertGoogleSheetToEmbedUrl(text, settingsRef.current.embedMode);
      showToast(
        parsed.isValid
          ? 'Tautan ditempel. Klik Simpan untuk menerapkan.'
          : 'Tautan ditempel, tetapi formatnya belum valid.',
        parsed.isValid ? 'ok' : 'error'
      );
    } catch {
      showToast('Perangkat ini menolak menempel otomatis. Tempel manual dengan Ctrl+V.', 'error');
    }
  }, [canEdit, settingsRef, showToast]);

  const handleModeChange = useCallback(
    (mode: JournalEmbedMode) => {
      const current = settingsRef.current;
      if (mode === current.embedMode) return;
      persist({ ...current, embedMode: mode });
    },
    [persist, settingsRef]
  );

  return {
    draftUrl,
    setDraftUrl,
    draftEmbed,
    draftDiffers,
    handleSaveUrl,
    handlePaste,
    handleModeChange,
  };
}
