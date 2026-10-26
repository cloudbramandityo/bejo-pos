/**
 * Utilitas Penyimpanan & URL Converter untuk Modul Jurnal Google Sheet Mirroring
 * Coded by Langgo Bramandityo
 */

export type JournalEmbedMode = 'preview' | 'edit' | 'html';

export interface JournalYearConfig {
  year: number;
  sheetUrl: string;
  title?: string;
  notes?: string;
  updatedAt?: string;
}

export interface JournalSettings {
  years: JournalYearConfig[];
  selectedYear: number;
  embedMode: JournalEmbedMode;
  autoRefreshMinutes?: number;
  /** Penanda waktu versi konfigurasi untuk sinkronisasi LocalStorage <-> PocketBase. */
  savedAt?: string;
}

export const DEFAULT_JOURNAL_YEARS: number[] = [2022, 2023, 2024, 2025, 2026, 2027, 2028];

export const DEFAULT_JOURNAL_SETTINGS: JournalSettings = {
  years: DEFAULT_JOURNAL_YEARS.map((yr) => ({
    year: yr,
    sheetUrl: '',
    title: `Jurnal Pembukuan ${yr}`,
  })),
  selectedYear: 2026,
  embedMode: 'preview',
};

const STORAGE_KEY = 'bejo_journal_mirror_settings_v1';

export function convertGoogleSheetToEmbedUrl(
  rawUrl: string,
  mode: JournalEmbedMode = 'preview'
): {
  embedUrl: string;
  originalUrl: string;
  sheetId?: string;
  gid?: string;
  isValid: boolean;
  isPublishedHtml: boolean;
  error?: string;
} {
  const trimmed = (rawUrl || '').trim();

  if (!trimmed) {
    return { embedUrl: '', originalUrl: '', isValid: false, isPublishedHtml: false };
  }

  let cleanUrl = trimmed;
  const iframeSrcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    cleanUrl = iframeSrcMatch[1].trim();
  }

  // Format 1: Published Google Sheets Web (/pubhtml)
  const pubHtmlMatch = cleanUrl.match(
    /\/spreadsheets\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9-_]+)\/pubhtml/
  );
  if (pubHtmlMatch) {
    let embedUrl = cleanUrl;
    try {
      const parsedUrl = new URL(cleanUrl);
      if (!parsedUrl.searchParams.has('widget')) parsedUrl.searchParams.set('widget', 'true');
      if (!parsedUrl.searchParams.has('headers')) parsedUrl.searchParams.set('headers', 'false');
      embedUrl = parsedUrl.toString();
    } catch {
      const hasWidgetParam = cleanUrl.includes('widget=true');
      const separator = cleanUrl.includes('?') ? '&' : '?';
      embedUrl = hasWidgetParam
        ? cleanUrl
        : `${cleanUrl}${separator}widget=true&headers=false`;
    }
    return {
      embedUrl,
      originalUrl: cleanUrl,
      isValid: true,
      isPublishedHtml: true,
    };
  }

  // Format 2: Standard Google Spreadsheet URL (/spreadsheets/d/ID/...)
  const standardMatch = cleanUrl.match(
    /\/spreadsheets\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9-_]+)/
  );
  if (!standardMatch || !standardMatch[1]) {
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      return {
        embedUrl: cleanUrl,
        originalUrl: cleanUrl,
        isValid: true,
        isPublishedHtml: false,
      };
    }
    return {
      embedUrl: '',
      originalUrl: cleanUrl,
      isValid: false,
      isPublishedHtml: false,
      error: 'URL tidak valid. Pastikan link diawali dengan https://docs.google.com/spreadsheets/d/...',
    };
  }

  const sheetId = standardMatch[1];

  let gid: string | undefined;
  const gidMatch = cleanUrl.match(/[?&#]gid=([0-9]+)/);
  if (gidMatch && gidMatch[1]) {
    gid = gidMatch[1];
  }

  let embedUrl = '';
  if (mode === 'preview') {
    embedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/preview${gid ? `?gid=${gid}` : ''}`;
  } else if (mode === 'edit') {
    embedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?embedded=true&rm=minimal${gid ? `&gid=${gid}` : ''}`;
  } else {
    embedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlembed?widget=true&headers=false${gid ? `&gid=${gid}` : ''}`;
  }

  return {
    embedUrl,
    originalUrl: cleanUrl,
    sheetId,
    gid,
    isValid: true,
    isPublishedHtml: false,
  };
}

export function getStoredJournalSettings(): JournalSettings {
  if (typeof window === 'undefined') return DEFAULT_JOURNAL_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_JOURNAL_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<JournalSettings>;
    if (!parsed || !Array.isArray(parsed.years) || parsed.years.length === 0) {
      return DEFAULT_JOURNAL_SETTINGS;
    }

    const years = parsed.years.map((y) => ({
      year: Number(y.year),
      sheetUrl: typeof y.sheetUrl === 'string' ? y.sheetUrl : '',
      title: y.title || `Jurnal Pembukuan ${y.year}`,
      notes: y.notes || '',
      updatedAt: y.updatedAt,
    }));

    return {
      years,
      selectedYear: parsed.selectedYear || years[0]?.year || 2026,
      embedMode: parsed.embedMode || 'preview',
      autoRefreshMinutes: parsed.autoRefreshMinutes,
      savedAt: parsed.savedAt,
    };
  } catch (err) {
    console.error('Failed to parse stored journal settings', err);
    return DEFAULT_JOURNAL_SETTINGS;
  }
}

export function saveStoredJournalSettings(settings: JournalSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save journal settings to localStorage', err);
  }
}

export function addJournalYear(current: JournalSettings, newYear: number, sheetUrl = ''): JournalSettings {
  const existing = current.years.find((y) => y.year === newYear);
  if (existing) {
    return { ...current, selectedYear: newYear };
  }

  const updatedYears = [
    ...current.years,
    {
      year: newYear,
      sheetUrl,
      title: `Jurnal Pembukuan ${newYear}`,
      updatedAt: new Date().toISOString(),
    },
  ].sort((a, b) => a.year - b.year);

  const updated: JournalSettings = {
    ...current,
    years: updatedYears,
    selectedYear: newYear,
    savedAt: new Date().toISOString(),
  };

  saveStoredJournalSettings(updated);
  return updated;
}

export function removeJournalYear(current: JournalSettings, yearToRemove: number): JournalSettings {
  const filteredYears = current.years.filter((y) => y.year !== yearToRemove);
  const fallbackYear = new Date().getFullYear();
  const finalYears = filteredYears.length > 0 ? filteredYears : [
    {
      year: fallbackYear,
      sheetUrl: '',
      title: `Jurnal Pembukuan ${fallbackYear}`,
    },
  ];

  let nextSelectedYear = current.selectedYear;
  if (nextSelectedYear === yearToRemove) {
    nextSelectedYear = finalYears[finalYears.length - 1]?.year || fallbackYear;
  }

  const updated: JournalSettings = {
    ...current,
    years: finalYears,
    selectedYear: nextSelectedYear,
    savedAt: new Date().toISOString(),
  };

  saveStoredJournalSettings(updated);
  return updated;
}

export function updateJournalSheetUrl(
  current: JournalSettings,
  year: number,
  sheetUrl: string,
  title?: string
): JournalSettings {
  const updatedYears = current.years.map((y) => {
    if (y.year === year) {
      return {
        ...y,
        sheetUrl: sheetUrl.trim(),
        title: title !== undefined ? title : y.title,
        updatedAt: new Date().toISOString(),
      };
    }
    return y;
  });

  const updated: JournalSettings = {
    ...current,
    years: updatedYears,
    savedAt: new Date().toISOString(),
  };

  saveStoredJournalSettings(updated);
  return updated;
}
