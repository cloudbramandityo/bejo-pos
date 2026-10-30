import { useCallback, useMemo } from 'react';
import { convertGoogleSheetToEmbedUrl, type JournalSettings } from '../../utils/journalStorage';
import { journalModeLabel } from './journalModes';

export function useJournalLinks(
  settings: JournalSettings,
  showToast: (message: string, tone?: 'ok' | 'error') => void
) {
  const yearTabs = useMemo(
    () => [...settings.years].sort((a, b) => a.year - b.year),
    [settings.years]
  );
  const activeConfig = useMemo(
    () => yearTabs.find((item) => item.year === settings.selectedYear) || yearTabs[0] || null,
    [yearTabs, settings.selectedYear]
  );
  const savedUrl = (activeConfig?.sheetUrl || '').trim();
  const linkedCount = useMemo(
    () => yearTabs.filter((item) => item.sheetUrl.trim()).length,
    [yearTabs]
  );
  const embed = useMemo(
    () => convertGoogleSheetToEmbedUrl(savedUrl, settings.embedMode),
    [savedUrl, settings.embedMode]
  );
  const modeLabel = journalModeLabel(settings.embedMode);

  const handleCopy = useCallback(async () => {
    const link = savedUrl || embed.embedUrl;
    if (!link) {
      showToast('Belum ada tautan untuk disalin.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      showToast('Tautan Google Sheet disalin.');
    } catch {
      showToast('Perangkat ini menolak menyalin otomatis. Salin manual dari kolom tautan.', 'error');
    }
  }, [savedUrl, embed.embedUrl, showToast]);

  const handleOpen = useCallback(() => {
    const link = savedUrl || embed.embedUrl;
    if (!link) {
      showToast('Belum ada tautan untuk dibuka.', 'error');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  }, [savedUrl, embed.embedUrl, showToast]);

  return {
    yearTabs,
    activeConfig,
    savedUrl,
    linkedCount,
    embed,
    modeLabel,
    handleCopy,
    handleOpen,
  };
}
