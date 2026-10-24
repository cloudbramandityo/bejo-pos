import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Workbook, type WorkbookInstance } from '@fortune-sheet/react';
import type { Cell, CellWithRowAndCol, Sheet } from '@fortune-sheet/core';
import '@fortune-sheet/react/dist/index.css';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardPaste,
  Cloud,
  Info,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Table2,
  X,
} from 'lucide-react';
import {
  JournalApiError,
  getJournalSession,
  loadJurnalSheets,
  openJournalSession,
  saveJurnalSheet,
  type JournalSessionInfo,
  type JurnalHalaman,
  type JurnalSheetsResponse,
} from '../../lib/journalApi';
import {
  JURNAL_SHEET_META,
  JURNAL_YEARS,
  createJurnalSheets,
  restyleJurnalCell,
} from './jurnalTemplates';
import { ensureJurnalFontLoaded } from './jurnalFont';
import {
  parseDelimited,
  parseHtmlTable,
  parseImportedValue,
  toTsv,
  trimGrid,
  type ImportedCellValue,
  type ImportedGrid,
} from './jurnalImport';

const AUTO_SAVE_DELAY = 1200;

type SessionState = 'checking' | 'login' | 'expired' | 'authenticated';
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const EMPTY_SIGNATURES: Record<JurnalHalaman, string> = {
  kas_utama: '',
  debit: '',
  kredit: '',
};

// FortuneSheet menyimpan state internal sebagai matriks `data` dan menghapus
// `celldata`; onChange mengirim bentuk internal itu. Konversi balik diperlukan
// agar penyimpanan tidak menulis grid kosong.
function sheetCelldata(sheet: Sheet): CellWithRowAndCol[] {
  if (Array.isArray(sheet.data) && sheet.data.length > 0) {
    const cells: CellWithRowAndCol[] = [];
    sheet.data.forEach((row, r) => {
      row?.forEach((cell, c) => {
        if (cell) cells.push({ r, c, v: cell });
      });
    });
    return cells;
  }
  return sheet.celldata || [];
}

function signatureOf(sheet: Sheet | null | undefined): string {
  if (!sheet) return '';
  const celldata = [...sheetCelldata(sheet)].sort((a, b) => a.r - b.r || a.c - b.c);
  return JSON.stringify({
    row: sheet.row,
    column: sheet.column,
    celldata,
    merge: sheet.config?.merge || {},
    columnlen: sheet.config?.columnlen || {},
    rowlen: sheet.config?.rowlen || {},
    rowhidden: sheet.config?.rowhidden || {},
    colhidden: sheet.config?.colhidden || {},
    borderInfo: sheet.config?.borderInfo || [],
  });
}

function cellAddress(row: number, column: number): string {
  let value = column + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return `${label}${row + 1}`;
}

// Sel gabungan (judul, catatan) dan sel berformula tidak ditimpa saat impor
// agar struktur serta perhitungan otomatis Jurnal tetap utuh.
function protectedCellsOf(sheet: Sheet, preserveFormulas: boolean): Set<string> {
  const blocked = new Set<string>();
  Object.values(sheet.config?.merge || {}).forEach((merge) => {
    for (let row = merge.r; row < merge.r + merge.rs; row += 1) {
      for (let column = merge.c; column < merge.c + merge.cs; column += 1) {
        blocked.add(`${row}_${column}`);
      }
    }
  });
  if (preserveFormulas) {
    for (const item of sheetCelldata(sheet)) {
      const cell = item.v as Cell | null;
      if (cell && typeof cell === 'object' && cell.f) {
        blocked.add(`${item.r}_${item.c}`);
      }
    }
  }
  return blocked;
}

function buildSheets(
  records: JurnalSheetsResponse['sheets'],
  year: number
): Sheet[] {
  const templates = createJurnalSheets(year);
  return JURNAL_SHEET_META.map((meta, index) => {
    const stored = records?.[meta.key]?.data_grid as unknown as Sheet | undefined;
    const base = stored && Array.isArray(stored.celldata) ? stored : templates[index];
    return {
      ...base,
      id: meta.key,
      name: meta.name,
      order: meta.order,
      color: meta.color,
      status: meta.key === 'kas_utama' ? 1 : 0,
      data: undefined,
      celldata: sheetCelldata(base).map((item) => ({
        ...item,
        v: restyleJurnalCell(meta.key, item.v),
      })),
      config: base.config || {},
    };
  });
}

function toGrid(sheet: Sheet, key: JurnalHalaman): Record<string, unknown> {
  return {
    id: key,
    name: sheet.name,
    row: sheet.row,
    column: sheet.column,
    defaultRowHeight: sheet.defaultRowHeight,
    celldata: sheetCelldata(sheet),
    config: sheet.config || {},
    ...(sheet.dataVerification ? { dataVerification: sheet.dataVerification } : {}),
    ...(sheet.frozen ? { frozen: sheet.frozen } : {}),
    ...(sheet.hyperlink ? { hyperlink: sheet.hyperlink } : {}),
  };
}

function formatClock(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof JournalApiError || error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

interface JurnalScreenProps {
  currentUsername?: string;
}

export const JurnalScreen: React.FC<JurnalScreenProps> = ({ currentUsername }) => {
  const currentYear = new Date().getFullYear();
  const initialYear = JURNAL_YEARS.includes(currentYear)
    ? currentYear
    : JURNAL_YEARS[JURNAL_YEARS.length - 1];

  const [tahun, setTahun] = useState(initialYear);
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [sessionInfo, setSessionInfo] = useState<JournalSessionInfo | null>(null);
  const [sessionUser, setSessionUser] = useState<string>('');
  const [username, setUsername] = useState('langgo');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [workbookData, setWorkbookData] = useState<Sheet[] | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<JurnalHalaman>('kas_utama');
  const [importStart, setImportStart] = useState<'a1' | 'active'>('a1');
  const [importActiveCell, setImportActiveCell] = useState({ row: 0, column: 0 });
  const [importPreserve, setImportPreserve] = useState(true);
  const [importText, setImportText] = useState('');
  const [importGrid, setImportGrid] = useState<ImportedGrid | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const yearRef = useRef(initialYear);
  const latestRef = useRef<Record<JurnalHalaman, Sheet | null>>({
    kas_utama: null,
    debit: null,
    kredit: null,
  });
  const savedSignatureRef = useRef<Record<JurnalHalaman, string>>({ ...EMPTY_SIGNATURES });
  const saveTimerRef = useRef<number | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);
  const hasUserOpRef = useRef(false);
  const workbookRef = useRef<WorkbookInstance | null>(null);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (!hasUserOpRef.current) return;
      const year = yearRef.current;
      const pending = JURNAL_SHEET_META.filter(({ key }) => {
        const sheet = latestRef.current[key];
        return Boolean(sheet) && signatureOf(sheet) !== savedSignatureRef.current[key];
      });
      if (pending.length === 0) return;
      void saveChainRef.current.then(async () => {
        for (const { key } of pending) {
          const sheet = latestRef.current[key];
          if (!sheet) continue;
          try {
            await saveJurnalSheet({ tahun: year, halaman: key, dataGrid: toGrid(sheet, key) });
          } catch {
            /* sesi bisa saja sudah ditutup saat logout */
          }
        }
      });
    };
  }, []);

  const changedKeys = useCallback((): JurnalHalaman[] => {
    return JURNAL_SHEET_META.filter(({ key }) => {
      const sheet = latestRef.current[key];
      return Boolean(sheet) && signatureOf(sheet) !== savedSignatureRef.current[key];
    }).map(({ key }) => key);
  }, []);

  const runSaveOnce = useCallback(async (): Promise<void> => {
    const keys = changedKeys();
    if (keys.length === 0) {
      setSaveState((previous) => (previous === 'pending' || previous === 'saving' ? 'saved' : previous));
      return;
    }

    const generation = generationRef.current;
    const year = yearRef.current;
    setSaveState('saving');
    setSaveError(null);

    try {
      for (const key of keys) {
        const sheet = latestRef.current[key];
        if (!sheet) continue;
        const signature = signatureOf(sheet);
        await saveJurnalSheet({ tahun: year, halaman: key, dataGrid: toGrid(sheet, key) });
        if (generation !== generationRef.current) return;
        savedSignatureRef.current[key] = signature;
        setLastSavedAt(new Date());
      }
      if (generation !== generationRef.current) return;
      setSaveState(changedKeys().length > 0 ? 'pending' : 'saved');
    } catch (error) {
      if (generation !== generationRef.current) return;
      if (error instanceof JournalApiError && error.status === 401) {
        setSessionState('expired');
        setSaveState('idle');
        setPreparing(false);
        setWorkbookData(null);
      } else {
        setSaveState('error');
        setSaveError(errorMessage(error, 'Gagal menyimpan data Jurnal.'));
      }
    }
  }, [changedKeys]);

  const queueSave = useCallback((): void => {
    setSaveState('pending');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveChainRef.current = saveChainRef.current.then(runSaveOnce).catch(() => {});
    }, AUTO_SAVE_DELAY);
  }, [runSaveOnce]);

  const handleWorkbookChange = useCallback(
    (sheets: Sheet[]): void => {
      if (sessionState !== 'authenticated') return;
      for (const meta of JURNAL_SHEET_META) {
        const found = sheets.find((sheet) => sheet.id === meta.key || sheet.name === meta.name);
        if (found) {
          latestRef.current[meta.key] = { ...found, id: meta.key, name: meta.name };
        }
      }
      // Perubahan pertama saat inisialisasi FortuneSheet (normalisasi sel dan
      // hasil hitung formula) bukan editan pengguna, jadi jangan menulis ulang
      // template ke database. Samakan baseline agar flush berikutnya tidak
      // menganggapnya sebagai perubahan.
      if (!hasUserOpRef.current) {
        for (const meta of JURNAL_SHEET_META) {
          savedSignatureRef.current[meta.key] = signatureOf(latestRef.current[meta.key]);
        }
        return;
      }
      queueSave();
    },
    [queueSave, sessionState]
  );

  // calculateFormula() juga memakai pipeline op/history FortuneSheet, jadi onOp
  // tidak bisa dijadikan penanda editan pengguna. Gunakan gestur nyata pada
  // spreadsheet agar normalisasi awal tidak memicu auto-save.
  const markUserInteraction = useCallback((): void => {
    hasUserOpRef.current = true;
  }, []);

  const loadYear = useCallback(async (year: number): Promise<void> => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setSaveState('idle');

    try {
      await ensureJurnalFontLoaded();
      if (generation !== generationRef.current) return;
      const response = await loadJurnalSheets(year);
      if (generation !== generationRef.current) return;

      const sheets = buildSheets(response.sheets, year);
      const signatures: Record<JurnalHalaman, string> = { ...EMPTY_SIGNATURES };
      for (const meta of JURNAL_SHEET_META) {
        const sheet = sheets.find((item) => item.id === meta.key) || null;
        latestRef.current[meta.key] = sheet ? { ...sheet, id: meta.key, name: meta.name } : null;
        signatures[meta.key] = signatureOf(sheet);
      }
      savedSignatureRef.current = signatures;
      yearRef.current = year;
      hasUserOpRef.current = false;
      setPreparing(true);
      setTahun(year);
      setWorkbookData(sheets);
      setLoadKey((key) => key + 1);
      setSessionState('authenticated');
    } catch (error) {
      if (generation !== generationRef.current) return;
      setPreparing(false);
      if (error instanceof JournalApiError && error.status === 401) {
        setSessionState('expired');
        setWorkbookData(null);
      } else {
        setLoadError(errorMessage(error, 'Gagal memuat Jurnal dari server.'));
      }
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, []);

  const checkSession = useCallback(async (): Promise<void> => {
    setSessionState('checking');
    setLoginError(null);
    try {
      const info = await getJournalSession();
      setSessionInfo(info);
      if (info.authenticated) {
        setSessionUser(info.username || '');
        await loadYear(yearRef.current);
      } else {
        setSessionState('login');
      }
    } catch (error) {
      setSessionState('login');
      setLoginError(errorMessage(error, 'Server Jurnal tidak dapat dihubungi.'));
    }
  }, [loadYear]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!importNotice) return;
    const timer = window.setTimeout(() => setImportNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [importNotice]);

  // FortuneSheet hanya menghitung formula untuk sheet yang aktif. Menghitung
  // beberapa sheet sekaligus lewat calculateFormula() membuat hasil sheet lain
  // tertulis ke sheet aktif (mis. #DIV/0! Debit menimpa kolom I Kas Utama),
  // jadi tiap sheet harus diaktifkan dulu sebelum dihitung.
  useEffect(() => {
    if (!workbookData) return;
    let cancelled = false;
    let finishTimer: number | null = null;

    setPreparing(true);
    const timer = window.setTimeout(() => {
      const workbook = workbookRef.current;
      if (workbook) {
        try {
          workbook.batchCallApis([
            ...JURNAL_SHEET_META.flatMap(({ key }) => [
              { name: 'activateSheet', args: [{ id: key }] },
              { name: 'calculateFormula', args: [key] },
            ]),
            { name: 'activateSheet', args: [{ id: JURNAL_SHEET_META[0].key }] },
          ]);
        } catch {
          /* spreadsheet belum siap; formula tetap dihitung saat sel diubah */
        }
      }
      finishTimer = window.setTimeout(() => {
        if (cancelled) return;
        // Nilai hasil hitung awal bukan editan pengguna; samakan baseline agar
        // membuka Jurnal (atau berpindah tahun) tidak memicu auto-save.
        for (const { key } of JURNAL_SHEET_META) {
          savedSignatureRef.current[key] = signatureOf(latestRef.current[key]);
        }
        setPreparing(false);
      }, 150);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (finishTimer) window.clearTimeout(finishTimer);
    };
  }, [workbookData, loadKey]);

  const handleLogin = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setLoginError('Masukkan username dan password developer.');
      return;
    }
    setLoggingIn(true);
    setLoginError(null);
    try {
      await openJournalSession(username.trim(), password);
      setPassword('');
      const info = await getJournalSession().catch(() => null);
      if (info) setSessionInfo(info);
      setSessionUser(info?.username || username.trim().toLowerCase());
      await loadYear(yearRef.current);
    } catch (error) {
      setLoginError(errorMessage(error, 'Login developer gagal.'));
    } finally {
      setLoggingIn(false);
    }
  };

  const flushPending = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!hasUserOpRef.current) return true;
    const job = saveChainRef.current.then(runSaveOnce, runSaveOnce);
    saveChainRef.current = job.catch(() => {});
    await job;
    return changedKeys().length === 0;
  }, [runSaveOnce, changedKeys]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushPending();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [flushPending]);

  const handleYearChange = async (nextYear: number): Promise<void> => {
    if (nextYear === yearRef.current || loading) return;
    const saved = await flushPending();
    if (!saved) return;
    await loadYear(nextYear);
  };

  const handleReload = async (): Promise<void> => {
    if (loading) return;
    const saved = await flushPending();
    if (!saved) return;
    setLoadError(null);
    await loadYear(yearRef.current);
  };

  const handleRetrySave = (): void => {
    saveChainRef.current = saveChainRef.current.then(runSaveOnce).catch(() => {});
  };

  const openImportModal = useCallback((): void => {
    if (sessionState !== 'authenticated') return;
    const workbook = workbookRef.current;
    let target: JurnalHalaman = 'kas_utama';
    let active = { row: 0, column: 0 };
    try {
      const activeSheet = workbook?.getSheet?.();
      const matched = JURNAL_SHEET_META.find((meta) => meta.key === activeSheet?.id);
      if (matched) target = matched.key;
      const selection = workbook?.getSelection?.()?.[0];
      active = {
        row: selection?.row?.[0] ?? 0,
        column: selection?.column?.[0] ?? 0,
      };
    } catch {
      /* spreadsheet belum siap; gunakan nilai default */
    }
    setImportTarget(target);
    setImportStart('a1');
    setImportActiveCell(active);
    setImportPreserve(true);
    setImportText('');
    setImportGrid(null);
    setImportError(null);
    setImportOpen(true);
  }, [sessionState]);

  const handleImportPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const html = event.clipboardData.getData('text/html');
    const plain = event.clipboardData.getData('text/plain');
    const fromHtml = html ? parseHtmlTable(html) : null;
    const parsed = trimGrid(fromHtml && fromHtml.length > 0 ? fromHtml : parseDelimited(plain));
    if (parsed.length === 0) return;
    event.preventDefault();
    setImportGrid(parsed);
    setImportText(toTsv(parsed));
    setImportError(null);
  };

  const applyImport = useCallback((): void => {
    if (sessionState !== 'authenticated' || importing) return;
    const workbook = workbookRef.current;
    if (!workbook) {
      setImportError('Spreadsheet belum siap. Tunggu hingga proses memuat selesai.');
      return;
    }
    const grid = trimGrid(importGrid ?? parseDelimited(importText));
    const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
    if (grid.length === 0 || width === 0) {
      setImportError('Tidak ada data untuk ditempel.');
      return;
    }
    const sheet = latestRef.current[importTarget];
    if (!sheet) {
      setImportError('Sheet tujuan belum siap. Muat ulang data Jurnal lalu coba lagi.');
      return;
    }

    const start = importStart === 'a1' ? { row: 0, column: 0 } : importActiveCell;
    const blocked = protectedCellsOf(sheet, importPreserve);
    const runs: { row: number; startColumn: number; data: ImportedCellValue[] }[] = [];
    let written = 0;
    let skipped = 0;

    grid.forEach((sourceRow, rowOffset) => {
      const row = start.row + rowOffset;
      let run: { row: number; startColumn: number; data: ImportedCellValue[] } | null = null;
      for (let columnOffset = 0; columnOffset < width; columnOffset += 1) {
        const text = (sourceRow[columnOffset] ?? '').trim();
        const column = start.column + columnOffset;
        if (!text || blocked.has(`${row}_${column}`)) {
          if (text) skipped += 1;
          run = null;
          continue;
        }
        const parsed = parseImportedValue(text);
        const value: ImportedCellValue =
          typeof parsed === 'string' && parsed.startsWith('=') ? `'${parsed}` : parsed;
        written += 1;
        if (run && run.startColumn + run.data.length === column) {
          run.data.push(value);
        } else {
          run = { row, startColumn: column, data: [value] };
          runs.push(run);
        }
      }
    });

    if (written === 0) {
      setImportError('Semua sel kosong atau dilindungi formula/judul. Matikan opsi pertahankan formula untuk menimpa.');
      return;
    }

    const currentRows = Number(sheet.row) || 0;
    const currentColumns = Number(sheet.column) || 0;
    const neededRows = start.row + grid.length;
    const neededColumns = start.column + width;
    const calls: { name: string; args: unknown[] }[] = [];

    if (neededRows > currentRows && currentRows > 0) {
      calls.push({
        name: 'insertRowOrColumn',
        args: ['row', currentRows - 1, neededRows - currentRows, 'rightbottom', { id: importTarget }],
      });
    }
    if (neededColumns > currentColumns && currentColumns > 0) {
      calls.push({
        name: 'insertRowOrColumn',
        args: [
          'column',
          currentColumns - 1,
          neededColumns - currentColumns,
          'rightbottom',
          { id: importTarget },
        ],
      });
    }
    runs.forEach((run) => {
      calls.push({
        name: 'setCellValuesByRange',
        args: [
          [run.data],
          {
            row: [run.row, run.row],
            column: [run.startColumn, run.startColumn + run.data.length - 1],
          },
          undefined,
          { id: importTarget },
        ],
      });
    });
    calls.push({ name: 'activateSheet', args: [{ id: importTarget }] });
    calls.push({ name: 'calculateFormula', args: [importTarget] });

    const targetName = JURNAL_SHEET_META.find((meta) => meta.key === importTarget)?.name || importTarget;
    hasUserOpRef.current = true;
    setImportError(null);
    setImportOpen(false);
    setImporting(true);

    window.setTimeout(() => {
      try {
        workbook.batchCallApis(calls);
        setImportNotice(
          `${written.toLocaleString('id-ID')} sel ditempel ke ${targetName}${
            skipped > 0 ? `, ${skipped.toLocaleString('id-ID')} sel formula/judul dilewati` : ''
          }. Data disimpan otomatis.`
        );
      } catch (error) {
        setImportError(errorMessage(error, 'Gagal menempel data ke spreadsheet.'));
        setImportOpen(true);
      } finally {
        window.setTimeout(() => setImporting(false), 250);
      }
    }, 60);
  }, [
    importActiveCell,
    importGrid,
    importPreserve,
    importStart,
    importTarget,
    importText,
    importing,
    sessionState,
  ]);

  const hooks = useMemo(
    () => ({
      beforeAddSheet: () => false,
      beforeDeleteSheet: () => false,
      beforeUpdateSheetName: () => false,
    }),
    []
  );

  const statusView = useMemo(() => {
    if (sessionState !== 'authenticated') {
      return {
        icon: <LockKeyhole className="w-4 h-4 text-slate-400" />,
        text: sessionState === 'checking' ? 'Memeriksa sesi...' : 'Menunggu login',
        chipClass: 'bg-slate-50 text-slate-600 border-slate-200',
      };
    }
    switch (saveState) {
      case 'saving':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin text-blue-600" />,
          text: 'Menyimpan ke PocketBase...',
          chipClass: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'saved':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          text: lastSavedAt ? `Tersimpan ${formatClock(lastSavedAt)}` : 'Tersimpan',
          chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'pending':
        return {
          icon: <Cloud className="w-4 h-4 text-amber-600" />,
          text: 'Perubahan menunggu disimpan...',
          chipClass: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-600" />,
          text: saveError || 'Gagal menyimpan',
          chipClass: 'bg-red-50 text-red-700 border-red-200',
        };
      default:
        return {
          icon: <Cloud className="w-4 h-4 text-slate-400" />,
          text: 'Auto-save aktif',
          chipClass: 'bg-slate-50 text-slate-600 border-slate-200',
        };
    }
  }, [saveState, lastSavedAt, saveError, sessionState]);

  const loginPanel = (
    <div className="flex items-center justify-center py-6 sm:py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8">
        <div className="w-12 h-12 rounded-xl bg-slate-900 text-emerald-300 flex items-center justify-center mb-4">
          <LockKeyhole className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">
          {sessionState === 'expired' ? 'Sesi Jurnal berakhir' : 'Akses Jurnal'}
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">
          {sessionState === 'expired'
            ? 'Sesi keamanan server sudah berakhir. Masuk kembali untuk melanjutkan pengeditan.'
            : 'Modul Jurnal hanya untuk DEVELOPER. Sesi diverifikasi oleh server, bukan hanya oleh tampilan aplikasi.'}
        </p>

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
              Username Developer
            </label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
              Password Developer
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              autoComplete="current-password"
              autoFocus
            />
          </div>

          {loginError && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          {sessionInfo && !sessionInfo.configured.developerLogin && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <strong>JOURNAL_DEV_PASSWORD</strong> belum diisi di .env server. Atur nilainya lalu
              restart layanan sebelum login.
            </div>
          )}
          {sessionInfo && !sessionInfo.configured.pocketbaseAdmin && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <strong>PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD</strong> belum diisi di .env server. Modul
              Jurnal memerlukan akun admin PocketBase.
            </div>
          )}

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full mt-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {loggingIn ? 'Memverifikasi...' : 'Masuk ke Jurnal'}
          </button>
          <button
            type="button"
            onClick={() => void checkSession()}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Cek ulang koneksi server
          </button>
        </form>
      </div>
    </div>
  );

  const importColumnCount = importGrid
    ? Math.max(...importGrid.map((row) => row.length))
    : 0;

  return (
    <div className="w-full max-w-[1440px] mx-auto p-3 sm:p-5 space-y-4">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-emerald-300 flex items-center justify-center shadow-md shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              JURNAL
              <span className="text-[9px] font-black uppercase tracking-wider bg-slate-900 text-emerald-300 px-1.5 py-0.5 rounded-md">
                Developer
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Spreadsheet Kas Utama, Debit, dan Kredit — seluruh perubahan tersimpan otomatis di
              PocketBase.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {JURNAL_SHEET_META.map((meta) => (
                <span
                  key={meta.key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  {meta.name}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-semibold">
                <ClipboardPaste className="w-3.5 h-3.5" />
                Copy-paste Google Sheets didukung
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tahun</span>
            <select
              value={tahun}
              onChange={(event) => void handleYearChange(Number(event.target.value))}
              disabled={loading || sessionState !== 'authenticated'}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none disabled:opacity-60 cursor-pointer"
            >
              {JURNAL_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold ${statusView.chipClass}`}
          >
            {statusView.icon}
            <span className="max-w-[210px] truncate" title={statusView.text}>
              {statusView.text}
            </span>
            {saveState === 'error' && sessionState === 'authenticated' && (
              <button
                type="button"
                onClick={handleRetrySave}
                className="ml-1 text-[10px] font-bold underline underline-offset-2 cursor-pointer"
              >
                Coba lagi
              </button>
            )}
          </div>

          {sessionState === 'authenticated' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              {sessionUser || currentUsername || 'langgo'}
            </span>
          )}

          <button
            type="button"
            onClick={openImportModal}
            disabled={sessionState !== 'authenticated' || importing}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Tempel data yang disalin dari Google Sheets"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Tempel Data</span>
          </button>

          <button
            type="button"
            onClick={() => void handleReload()}
            disabled={loading || sessionState !== 'authenticated'}
            title="Muat ulang data dari PocketBase"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{importNotice}</span>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            aria-label="Tutup notifikasi"
            className="text-emerald-700/70 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {sessionState === 'checking' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center py-24 text-slate-500 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Memeriksa sesi developer...
        </div>
      ) : sessionState === 'login' || sessionState === 'expired' ? (
        loginPanel
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-red-200 shadow-xs p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 mb-1">Jurnal gagal dimuat</h3>
          <p className="text-xs text-slate-500 mb-4">{loadError}</p>
          <button
            type="button"
            onClick={() => void handleReload()}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <>
          <div className="relative h-[calc(100dvh-17rem)] min-h-[520px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {workbookData && (
              <div
                className="h-full w-full jurnal-workbook"
                onPointerDownCapture={markUserInteraction}
                onKeyDownCapture={markUserInteraction}
              >
                <Workbook
                  key={`${tahun}-${loadKey}`}
                  ref={workbookRef}
                  data={workbookData}
                  onChange={handleWorkbookChange}
                  hooks={hooks}
                  allowEdit
                  showToolbar
                  showFormulaBar
                  showSheetTabs
                  lang="en"
                  defaultRowHeight={24}
                  defaultColWidth={110}
                  rowHeaderWidth={46}
                  columnHeaderHeight={24}
                  currency="Rp"
                />
              </div>
            )}
            {(loading || preparing || importing) && (
              <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-[1px] flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {importing
                    ? 'Menempel data dari Google Sheets...'
                    : loading
                      ? `Memuat Jurnal ${tahun}...`
                      : 'Menghitung formula Jurnal...'}
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed px-1">
            Setiap perubahan dikirim otomatis ke server setelah berhenti mengetik. Untuk memindahkan
            data dari Google Sheets, klik <strong>Tempel Data</strong> atau tekan <strong>Ctrl+V</strong>{' '}
            langsung di sel spreadsheet.
          </p>
        </>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <ClipboardPaste className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Tempel Data dari Google Sheets
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Salin area spreadsheet, lalu tempel di kotak di bawah ini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Sheet Tujuan
                  </span>
                  <select
                    value={importTarget}
                    onChange={(event) => setImportTarget(event.target.value as JurnalHalaman)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {JURNAL_SHEET_META.map((meta) => (
                      <option key={meta.key} value={meta.key}>
                        {meta.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Mulai Dari
                  </span>
                  <select
                    value={importStart}
                    onChange={(event) => setImportStart(event.target.value as 'a1' | 'active')}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="a1">A1 (awal sheet)</option>
                    <option value="active">
                      Sel aktif ({cellAddress(importActiveCell.row, importActiveCell.column)})
                    </option>
                  </select>
                </label>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Data yang Disalin
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Ctrl+C di Google Sheets → klik kotak ini → Ctrl+V
                  </span>
                </div>
                <textarea
                  value={importText}
                  onChange={(event) => {
                    setImportText(event.target.value);
                    setImportGrid(null);
                  }}
                  onPaste={handleImportPaste}
                  rows={7}
                  autoFocus
                  placeholder={
                    'Tempel di sini...\nContoh: Ctrl+C dari Google Sheets, lalu Ctrl+V di kotak ini.'
                  }
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-y"
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  <Table2 className="w-3.5 h-3.5" />
                  {importGrid
                    ? `${importGrid.length.toLocaleString('id-ID')} baris × ${importColumnCount.toLocaleString('id-ID')} kolom siap ditempel.`
                    : importText.trim()
                      ? 'Data akan dibaca sebagai teks tabulasi (TSV).'
                      : 'Belum ada data yang ditempel.'}
                </div>
              </div>

              {importGrid && importColumnCount > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto max-h-32">
                    <table className="min-w-full text-[10px]">
                      <tbody>
                        {importGrid.slice(0, 4).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-slate-100 last:border-0">
                            {Array.from({ length: Math.min(importColumnCount, 6) }).map(
                              (_, columnIndex) => (
                                <td
                                  key={columnIndex}
                                  className="px-2 py-1 text-slate-600 whitespace-nowrap max-w-[160px] truncate"
                                  title={row[columnIndex] ?? ''}
                                >
                                  {row[columnIndex] ?? ''}
                                </td>
                              )
                            )}
                            {importColumnCount > 6 && (
                              <td className="px-2 py-1 text-slate-400">…</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importGrid.length > 4 && (
                    <div className="px-2 py-1 text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
                      Menampilkan 4 baris pertama.
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importPreserve}
                  onChange={(event) => setImportPreserve(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span className="text-[11px] leading-relaxed text-slate-600">
                  <strong className="text-slate-800">
                    Pertahankan formula & judul (disarankan).
                  </strong>{' '}
                  Sel berformula, sel gabungan (judul/catatan), dan sel kosong tidak ditimpa.
                  Matikan bila ingin menimpa formula dengan nilai dari Google Sheets.
                </span>
              </label>

              <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Format angka (Rp, desimal koma/titik, persen) dikonversi otomatis. Format sel,
                  lebar kolom, dan perhitungan Jurnal tetap dipertahankan.
                </span>
              </div>

              {importError && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50/60 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={applyImport}
                disabled={!importText.trim() || importing}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <ClipboardPaste className="w-4 h-4" />
                Tempel ke Spreadsheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
