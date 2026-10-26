import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Workbook, type WorkbookInstance } from '@fortune-sheet/react';
import type { Cell, CellWithRowAndCol, Sheet } from '@fortune-sheet/core';
import '@fortune-sheet/react/dist/index.css';
import {
  AlertCircle,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Cloud,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  Table2,
  X,
} from 'lucide-react';
import {
  JournalApiError,
  ensureJournalSession,
  loadJurnalSheets,
  saveJurnalSheet,
  withJournalSession,
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

type SessionState = 'checking' | 'ready' | 'error';
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
type MenuKey = 'file' | 'data' | 'help' | null;

// FortuneSheet memutasi objek range lalu menyimpannya ke state; Immer hanya
// membekukan plain object. Instance class tetap bisa dimutasi sehingga aman
// saat React StrictMode menjalankan updater dua kali di mode pengembangan.
class JurnalRange {
  row: [number, number];
  column: [number, number];
  row_focus: number;
  column_focus: number;

  constructor(row: number, column: number) {
    this.row = [row, row];
    this.column = [column, column];
    this.row_focus = row;
    this.column_focus = column;
  }
}

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

// Header bawaan FortuneSheet berupa kanvas putih dengan teks hitam. Hook
// afterRender menggambarnya ulang mengikuti header Google Sheets: latar abu
// muda, teks abu gelap, dan garis tipis yang menyatu dengan grid.
const HEADER_FONT = '500 11px "Google Sans", Roboto, Arial, sans-serif';

function paintHeaderCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string
): void {
  if (width <= 0 || height <= 0) return;
  ctx.save();
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#e1e3e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + width - 0.5, y);
  ctx.lineTo(x + width - 0.5, y + height);
  ctx.moveTo(x, y + height - 0.5);
  ctx.lineTo(x + width, y + height - 0.5);
  ctx.stroke();
  ctx.fillStyle = '#444746';
  ctx.font = HEADER_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, y + height / 2 + 0.5);
  ctx.restore();
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
  const [sessionUser, setSessionUser] = useState<string>('');

  const [workbookData, setWorkbookData] = useState<Sheet[] | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);

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
  const menuRef = useRef<HTMLDivElement | null>(null);

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
        await withJournalSession(() =>
          saveJurnalSheet({ tahun: year, halaman: key, dataGrid: toGrid(sheet, key) })
        );
        if (generation !== generationRef.current) return;
        savedSignatureRef.current[key] = signature;
        setLastSavedAt(new Date());
      }
      if (generation !== generationRef.current) return;
      setSaveState(changedKeys().length > 0 ? 'pending' : 'saved');
    } catch (error) {
      if (generation !== generationRef.current) return;
      setSaveState('error');
      setSaveError(errorMessage(error, 'Gagal menyimpan data Jurnal.'));
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
      if (sessionState !== 'ready') return;
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

      // DEVELOPER sudah lolos gerbang RBAC aplikasi; sesi API dibuat otomatis
      // dari akun developer yang sedang dipakai agar tidak ada login kedua.
      const session = await ensureJournalSession();
      if (generation !== generationRef.current) return;
      setSessionUser(session.username || '');

      const response = await withJournalSession(() => loadJurnalSheets(year));
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
      setSessionState('ready');
    } catch (error) {
      if (generation !== generationRef.current) return;
      setPreparing(false);
      setWorkbookData(null);
      setSessionState('error');
      setLoadError(errorMessage(error, 'Gagal memuat Jurnal dari server.'));
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, []);

  const bootstrap = useCallback(async (): Promise<void> => {
    setSessionState('checking');
    setLoadError(null);
    await loadYear(yearRef.current);
  }, [loadYear]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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
        // FortuneSheet memilih sel editable pertama (C4) dan menggulir ke sana
        // saat dimuat; pilih A1 dan kembalikan posisi ke baris judul seperti
        // Google Sheets.
        const workbook = workbookRef.current;
        if (workbook) {
          workbook.setSelection([new JurnalRange(0, 0)], {
            id: JURNAL_SHEET_META[0].key,
          });
          workbook.scroll({ scrollTop: 0, scrollLeft: 0 });
        }
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
    if (sessionState !== 'ready') return;
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
    if (sessionState !== 'ready' || importing) return;
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
      afterRenderRowHeaderCell: (
        rowNumber: string,
        _rowIndex: number,
        top: number,
        width: number,
        height: number,
        ctx: CanvasRenderingContext2D
      ) => {
        paintHeaderCell(ctx, 0, top, width, height, rowNumber);
      },
      afterRenderColumnHeaderCell: (
        columnChar: string,
        _columnIndex: number,
        left: number,
        width: number,
        height: number,
        ctx: CanvasRenderingContext2D
      ) => {
        paintHeaderCell(ctx, left, 0, width, height, columnChar);
      },
    }),
    []
  );

  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const handleRecalculate = useCallback((): void => {
    setOpenMenu(null);
    const workbook = workbookRef.current;
    if (!workbook) {
      setImportNotice('Spreadsheet belum siap. Tunggu hingga data selesai dimuat.');
      return;
    }
    try {
      const activeId = workbook.getSheet?.()?.id || JURNAL_SHEET_META[0].key;
      workbook.batchCallApis([{ name: 'calculateFormula', args: [activeId] }]);
      hasUserOpRef.current = true;
      queueSave();
      setImportNotice('Formula dihitung ulang. Perubahan disimpan otomatis.');
    } catch {
      setImportNotice('Formula belum bisa dihitung ulang. Coba lagi setelah sheet selesai dimuat.');
    }
  }, [queueSave]);

  const statusView = useMemo(() => {
    if (sessionState === 'error') {
      return {
        icon: <AlertCircle className="h-3.5 w-3.5 text-[#c5221f]" />,
        text: 'Koneksi server gagal',
        tone: 'text-[#c5221f]',
      };
    }
    if (sessionState === 'checking') {
      return {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0b57d0]" />,
        text: 'Menghubungkan sesi...',
        tone: 'text-[#5f6368]',
      };
    }
    if (loading) {
      return {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0b57d0]" />,
        text: `Memuat Jurnal ${tahun}...`,
        tone: 'text-[#5f6368]',
      };
    }
    if (preparing) {
      return {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0b57d0]" />,
        text: 'Menghitung formula...',
        tone: 'text-[#5f6368]',
      };
    }
    switch (saveState) {
      case 'saving':
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0b57d0]" />,
          text: 'Menyimpan ke PocketBase...',
          tone: 'text-[#5f6368]',
        };
      case 'saved':
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-[#188038]" />,
          text: lastSavedAt ? `Tersimpan ${formatClock(lastSavedAt)}` : 'Tersimpan di PocketBase',
          tone: 'text-[#5f6368]',
        };
      case 'pending':
        return {
          icon: <Cloud className="h-3.5 w-3.5 text-[#b06000]" />,
          text: 'Perubahan menunggu disimpan...',
          tone: 'text-[#b06000]',
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-3.5 w-3.5 text-[#c5221f]" />,
          text: saveError || 'Gagal menyimpan perubahan',
          tone: 'text-[#c5221f]',
        };
      default:
        return {
          icon: <Cloud className="h-3.5 w-3.5 text-[#5f6368]" />,
          text: 'Tersimpan di PocketBase',
          tone: 'text-[#5f6368]',
        };
    }
  }, [saveState, lastSavedAt, saveError, sessionState, loading, preparing, tahun]);

  const displayUser = sessionUser || currentUsername || 'DEVELOPER';
  const avatarInitial = displayUser.trim().charAt(0).toUpperCase() || 'D';

  const importColumnCount = importGrid
    ? Math.max(...importGrid.map((row) => row.length))
    : 0;

  const menuButton = (key: Exclude<MenuKey, null>, label: string, items: React.ReactNode) => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpenMenu((previous) => (previous === key ? null : key))}
        className={`rounded px-2 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
          openMenu === key ? 'bg-[#f1f3f4] text-[#1f1f1f]' : 'text-[#444746] hover:bg-[#f1f3f4]'
        }`}
        aria-haspopup="menu"
        aria-expanded={openMenu === key}
      >
        {label}
      </button>
      {openMenu === key && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border border-[#dadce0] bg-white py-1.5 text-[#1f1f1f] shadow-[0_4px_12px_rgba(60,64,67,0.25)]"
        >
          {items}
        </div>
      )}
    </div>
  );

  const menuItemClass =
    'flex w-full items-center gap-3 px-4 py-2 text-left text-[12px] text-[#1f1f1f] hover:bg-[#f1f3f4]';
  const menuNoteClass = 'flex items-start gap-3 px-4 py-2 text-[11px] leading-relaxed text-[#444746]';

  return (
    <div className="jurnal-sheets mx-auto w-full max-w-[1600px] px-3 pb-4 pt-3 sm:px-4">
      <div
        className="jurnal-shell relative flex w-full flex-col overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-[0_1px_3px_rgba(60,64,67,0.3)]"
        style={{ height: 'calc(100dvh - 13rem)', minHeight: '540px' }}
      >
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-[#e1e3e1] px-3 py-2 sm:px-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#188038]">
            <FileSpreadsheet className="h-5 w-5 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="truncate text-[15px] font-medium leading-5 text-[#1f1f1f]">
                Jurnal {tahun}
              </h1>
              <span className="rounded border border-[#c4c7c5] px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em] text-[#5f6368]">
                Developer
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-2">
              <div ref={menuRef} className="flex items-center gap-0.5">
                {menuButton(
                  'file',
                  'File',
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenu(null);
                        void handleReload();
                      }}
                      className={menuItemClass}
                    >
                      <RefreshCw className="h-4 w-4 text-[#444746]" />
                      Muat ulang dari PocketBase
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenu(null);
                        openImportModal();
                      }}
                      className={menuItemClass}
                    >
                      <ClipboardPaste className="h-4 w-4 text-[#444746]" />
                      Tempel data dari Google Sheets
                    </button>
                    <div className="my-1 h-px bg-[#e1e3e1]" />
                    <div className="px-4 py-1.5 text-[11px] leading-relaxed text-[#5f6368]">
                      Setiap perubahan disimpan otomatis ke PocketBase.
                    </div>
                  </>
                )}
                {menuButton(
                  'data',
                  'Data',
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenu(null);
                        openImportModal();
                      }}
                      className={menuItemClass}
                    >
                      <ClipboardPaste className="h-4 w-4 text-[#444746]" />
                      Tempel data...
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleRecalculate}
                      className={menuItemClass}
                    >
                      <Calculator className="h-4 w-4 text-[#444746]" />
                      Hitung ulang formula sheet ini
                    </button>
                  </>
                )}
                {menuButton(
                  'help',
                  'Bantuan',
                  <>
                    <div className={menuNoteClass}>
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#444746]" />
                      <span>
                        <strong className="font-medium">Tempel dari Google Sheets:</strong> salin
                        area, lalu Ctrl+V langsung di sel spreadsheet.
                      </span>
                    </div>
                    <div className={menuNoteClass}>
                      <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-[#444746]" />
                      <span>Auto-save berjalan 1,2 detik setelah Anda berhenti mengetik.</span>
                    </div>
                    <div className={menuNoteClass}>
                      <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-[#444746]" />
                      <span>Sheet: Kas Utama, Debit, dan Kredit. Tahun aktif: {tahun}.</span>
                    </div>
                  </>
                )}
              </div>

              <div className="ml-auto hidden items-center gap-2 sm:flex">
                <span
                  className={`flex items-center gap-1.5 text-[11px] ${statusView.tone}`}
                  title={statusView.text}
                >
                  {statusView.icon}
                  <span className="max-w-[240px] truncate">{statusView.text}</span>
                </span>
                {saveState === 'error' && sessionState === 'ready' && (
                  <button
                    type="button"
                    onClick={handleRetrySave}
                    className="text-[11px] font-medium text-[#0b57d0] hover:underline cursor-pointer"
                  >
                    Coba lagi
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <div className="relative flex items-center">
              <CalendarDays className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#5f6368]" />
              <select
                aria-label="Tahun Jurnal"
                value={tahun}
                onChange={(event) => {
                  setOpenMenu(null);
                  void handleYearChange(Number(event.target.value));
                }}
                disabled={loading || sessionState !== 'ready'}
                className="h-8 appearance-none rounded-full border border-[#dadce0] bg-white pl-8 pr-7 text-[11px] font-medium text-[#1f1f1f] outline-none transition-colors hover:bg-[#f8fafd] focus:border-[#0b57d0] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {JURNAL_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#5f6368]" />
            </div>

            <button
              type="button"
              onClick={openImportModal}
              disabled={sessionState !== 'ready' || importing}
              className="flex h-8 items-center gap-1.5 rounded-full bg-[#0b57d0] px-3 text-[11px] font-medium text-white transition-colors hover:bg-[#0842a0] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              title="Tempel data yang disalin dari Google Sheets"
            >
              <ClipboardPaste className="h-4 w-4" />
              <span className="hidden sm:inline">Tempel data</span>
            </button>

            <button
              type="button"
              onClick={() => void handleReload()}
              disabled={loading || sessionState !== 'ready'}
              title="Muat ulang data dari PocketBase"
              aria-label="Muat ulang data Jurnal"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#444746] transition-colors hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div
              title={`Masuk sebagai ${displayUser}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b57d0] text-[11px] font-medium text-white select-none"
            >
              {avatarInitial}
            </div>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {sessionState === 'checking' ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-xs text-[#5f6368]">
              <Loader2 className="h-6 w-6 animate-spin text-[#0b57d0]" />
              Menghubungkan sesi DEVELOPER...
            </div>
          ) : sessionState === 'error' ? (
            <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
              <div className="w-full max-w-md text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fce8e6] text-[#c5221f]">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="text-base font-medium text-[#1f1f1f]">Jurnal tidak dapat dimuat</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5f6368]">{loadError}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-[#5f6368]">
                  Sesi dibuat otomatis dari akun DEVELOPER. Pastikan JOURNAL_DEV_USER dan
                  JOURNAL_DEV_PASSWORD di .env VPS cocok dengan akun ini.
                </p>
                <button
                  type="button"
                  onClick={() => void bootstrap()}
                  className="mt-5 rounded-full bg-[#0b57d0] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0842a0] cursor-pointer"
                >
                  Coba lagi
                </button>
              </div>
            </div>
          ) : (
            <div className="jurnal-grid relative min-h-0 flex-1">
              <div
                className="jurnal-workbook h-full w-full"
                onPointerDownCapture={markUserInteraction}
                onKeyDownCapture={markUserInteraction}
              >
                <Workbook
                  key={`${tahun}-${loadKey}`}
                  ref={workbookRef}
                  data={workbookData || []}
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
              {(loading || preparing || importing) && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-3.5 py-2 text-xs font-medium text-[#444746] shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-[#0b57d0]" />
                    {importing
                      ? 'Menempel data dari Google Sheets...'
                      : loading
                        ? `Memuat Jurnal ${tahun}...`
                        : 'Menghitung formula Jurnal...'}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pointer-events-none absolute bottom-12 left-3 z-30 flex w-[min(560px,calc(100%-1.5rem))] flex-col gap-2 sm:left-4">
            {saveState === 'error' && sessionState === 'ready' && (
              <div className="pointer-events-auto flex items-start gap-2.5 rounded-md bg-[#3c4043] px-4 py-2.5 text-xs leading-relaxed text-white shadow-lg">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#f6aea9]" />
                <span className="flex-1">{saveError || 'Gagal menyimpan perubahan.'}</span>
                <button
                  type="button"
                  onClick={handleRetrySave}
                  className="shrink-0 font-medium text-[#a8c7fa] hover:underline cursor-pointer"
                >
                  Coba lagi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaveError(null);
                    setSaveState('idle');
                  }}
                  aria-label="Tutup peringatan simpan"
                  className="shrink-0 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {importNotice && (
              <div className="pointer-events-auto flex items-start gap-2.5 rounded-md bg-[#1f1f1f] px-4 py-2.5 text-xs leading-relaxed text-white shadow-lg">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#81c995]" />
                <span className="flex-1">{importNotice}</span>
                <button
                  type="button"
                  onClick={() => setImportNotice(null)}
                  aria-label="Tutup notifikasi"
                  className="shrink-0 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202124]/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-lg border border-[#dadce0] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#e1e3e1] px-5 pb-4 pt-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0b57d0] text-white">
                  <ClipboardPaste className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-medium text-[#1f1f1f]">
                    Tempel data dari Google Sheets
                  </h2>
                  <p className="text-[11px] text-[#5f6368]">
                    Salin area spreadsheet, lalu tempel di kotak di bawah ini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-full p-1.5 text-[#444746] hover:bg-[#f1f3f4] cursor-pointer"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
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
                    className="w-full rounded-md border border-[#dadce0] bg-white px-3 py-2.5 text-xs font-medium text-[#1f1f1f] focus:border-[#0b57d0] focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/15"
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
                    className="w-full rounded-md border border-[#dadce0] bg-white px-3 py-2.5 text-xs font-medium text-[#1f1f1f] focus:border-[#0b57d0] focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/15"
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
                  className="w-full resize-y rounded-md border border-[#dadce0] bg-[#f8fafd] px-3 py-2.5 font-mono text-xs text-[#1f1f1f] focus:border-[#0b57d0] focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/15"
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

              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-[#dadce0] bg-[#f8fafd] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={importPreserve}
                  onChange={(event) => setImportPreserve(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#0b57d0]"
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

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e1e3e1] bg-[#f8fafd] px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-full border border-[#dadce0] bg-white px-4 py-2 text-xs font-medium text-[#0b57d0] hover:bg-[#f1f3f4] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={applyImport}
                disabled={!importText.trim() || importing}
                className="flex items-center gap-2 rounded-full bg-[#0b57d0] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0842a0] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <ClipboardPaste className="h-4 w-4" />
                Tempel ke spreadsheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
