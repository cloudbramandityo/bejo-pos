/**
 * Template awal Jurnal (Kas Utama, Debit, Kredit).
 *
 * Angka Rp dan persentase dihitung lewat formula spreadsheet (bukan dihitung
 * ulang di React) supaya perilakunya sama seperti Google Sheets: pengguna bisa
 * mengubah sel mana pun dan hasilnya ikut berubah.
 */
import type { Cell, CellWithRowAndCol, Sheet } from '@fortune-sheet/core';
import type { JurnalHalaman } from '../../lib/journalApi';
import { normalizeJurnalFont } from './jurnalFont';

export const JURNAL_YEARS = Array.from({ length: 7 }, (_, index) => 2022 + index);

export const JURNAL_SHEET_META: {
  key: JurnalHalaman;
  name: string;
  order: number;
  color: string;
}[] = [
  { key: 'kas_utama', name: 'Kas Utama', order: 0, color: '#334155' },
  { key: 'debit', name: 'Debit', order: 1, color: '#16a34a' },
  { key: 'kredit', name: 'Kredit', order: 2, color: '#dc2626' },
];

// Warna tema lama yang masih tersimpan di grid PocketBase dipetakan ke kode
// warna baru. Pemetaan per sheet dan idempoten agar warna baru tidak ikut
// berubah saat grid dimuat ulang.
const LEGACY_BG_BY_SHEET: Record<JurnalHalaman, Record<string, string>> = {
  kas_utama: {
    '#0f766e': '#334155',
    '#0f172a': '#1e293b',
    '#d1fae5': '#e2e8f0',
  },
  debit: {
    '#b91c1c': '#15803d',
    '#450a0a': '#14532d',
    '#fee2e2': '#dcfce7',
  },
  kredit: {
    '#1d4ed8': '#b91c1c',
    '#172554': '#450a0a',
    '#dbeafe': '#fee2e2',
  },
};

export function restyleJurnalCell(key: JurnalHalaman, cell: Cell): Cell {
  let next = cell;
  if (typeof cell.ff === 'number') {
    next = { ...next, ff: normalizeJurnalFont(cell.ff) };
  }
  if (typeof next.bg === 'string') {
    const replacement = LEGACY_BG_BY_SHEET[key][next.bg.toLowerCase()];
    if (replacement) next = { ...next, bg: replacement };
  }
  return next;
}

const CURRENCY_FORMAT = '"Rp"#,##0';
const PERCENT_FORMAT = '0.00%';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const BANK_LINE = 'BCA: 1132747096 a.n. BEJO DIGITAL MEDIA PT';

type MergeMap = NonNullable<Sheet['config']>['merge'];

interface SheetParts {
  cells: CellWithRowAndCol[];
  merge: MergeMap;
  rowlen: Record<string, number>;
  colCount: number;
  lastRow: number;
}

function put(cells: CellWithRowAndCol[], r: number, c: number, cell: Cell | null): void {
  if (cell) cells.push({ r, c, v: cell });
}

function mergeCells(merge: MergeMap, r: number, c: number, rs: number, cs: number): Cell {
  merge[`${r}_${c}`] = { r, c, rs, cs };
  return { mc: { r, c, rs, cs } };
}

function titleCell(text: string, bg: string, mc: Cell): Cell {
  return {
    ...mc,
    v: text,
    bg,
    fc: '#ffffff',
    bl: 1,
    fs: 14,
    ht: 1,
    vt: 0,
  };
}

function bankCell(mc: Cell): Cell {
  return {
    ...mc,
    v: BANK_LINE,
    bg: '#fef3c7',
    fc: '#78350f',
    bl: 1,
    fs: 11,
    ht: 1,
    vt: 0,
  };
}

function headerCell(text: string, bg: string): Cell {
  return {
    v: text,
    bg,
    fc: '#ffffff',
    bl: 1,
    fs: 10,
    ht: 0,
    vt: 0,
    tb: '2',
  };
}

function moneyCell(value = 0): Cell {
  // FortuneSheet tidak menggambar angka 0 tanpa `m`; tanpa ini sel kosong
  // terlihat blank padahal nilai numeriknya 0.
  return { v: value, m: value === 0 ? 'Rp0' : String(value), ct: { fa: CURRENCY_FORMAT, t: 'n' } };
}

function moneyFormula(formula: string): Cell {
  return { f: formula, ct: { fa: CURRENCY_FORMAT, t: 'n' } };
}

function percentFormula(formula: string): Cell {
  return { f: formula, ct: { fa: PERCENT_FORMAT, t: 'n' } };
}

function numberCell(value: number): Cell {
  return { v: value, ht: 0, vt: 0, ct: { fa: '0', t: 'n' } };
}

function textCell(value: string, options?: Partial<Cell>): Cell {
  return { v: value, ht: 1, vt: 0, ...options };
}

function daysInYear(year: number): number {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function dayLabel(year: number, month: number, day: number): string {
  const dd = String(day).padStart(2, '0');
  return `${dd}-${MONTH_SHORT[month]}-${year}`;
}

function baseConfig(parts: SheetParts, colWidths: Record<string, number>): Sheet['config'] {
  return {
    merge: parts.merge,
    columnlen: colWidths,
    rowlen: parts.rowlen,
  };
}

function finalizeSheet(
  key: JurnalHalaman,
  name: string,
  order: number,
  color: string,
  parts: SheetParts,
  colWidths: Record<string, number>
): Sheet {
  return {
    id: key,
    name,
    order,
    color,
    status: key === 'kas_utama' ? 1 : 0,
    row: parts.lastRow + 20,
    column: parts.colCount,
    defaultRowHeight: 24,
    defaultColWidth: 110,
    config: baseConfig(parts, colWidths),
    celldata: parts.cells,
  };
}

/* ---------------------------------------------------------------------- */
/*  Kas Utama                                                              */
/* ---------------------------------------------------------------------- */
export function createKasUtamaSheet(year: number): Sheet {
  const parts: SheetParts = { cells: [], merge: {}, rowlen: {}, colCount: 13, lastRow: 0 };
  const colCount = 13;
  const token = '#334155';

  put(parts.cells, 0, 0, titleCell(`JURNAL KAS UTAMA ${year}`, '#1e293b', mergeCells(parts.merge, 0, 0, 1, colCount)));
  put(parts.cells, 1, 0, bankCell(mergeCells(parts.merge, 1, 0, 1, colCount)));

  const headers = [
    'BULAN',
    'NO',
    'TANGGAL',
    'SALDO KAS AWAL',
    'TOTAL PENDAPATAN OPERASIONAL',
    'PEMASUKAN NON OPERASIONAL',
    'PENGELUARAN BIAYA TETAP',
    'PENGELUARAN BIAYA VARIABEL',
    'PENGELUARAN OPERASIONAL TOKO',
    'PEMBAYARAN VIA TRANSFER',
    'SALDO KAS AKHIR',
    'CASH GROWTH RATE',
    'STATUS',
  ];
  headers.forEach((header, c) => put(parts.cells, 2, c, headerCell(header, token)));

  parts.rowlen['0'] = 32;
  parts.rowlen['1'] = 26;
  parts.rowlen['2'] = 48;

  const startRow = 3;
  const days = daysInYear(year);
  const totalRow = startRow + days;
  const averageRow = totalRow + 1;
  const noteRow = averageRow + 1;
  const lastDailyExcelRow = startRow + days;

  for (let i = 0; i < days; i += 1) {
    const r = startRow + i;
    const excelRow = r + 1;
    const month = new Date(year, 0, 1 + i).getMonth();
    const date = new Date(year, 0, 1 + i);

    if (date.getDate() === 1) {
      put(parts.cells, r, 0, {
        v: `${MONTH_NAMES[month]} ${year}`,
        ht: 1,
        vt: 0,
        bl: 1,
        fc: '#334155',
      });
    }

    put(parts.cells, r, 1, numberCell(i + 1));
    put(parts.cells, r, 2, textCell(dayLabel(year, month, date.getDate()), { ht: 0 }));
    put(parts.cells, r, 3, i === 0 ? moneyCell(0) : moneyFormula(`=K${excelRow - 1}`));

    for (let c = 4; c <= 9; c += 1) {
      put(parts.cells, r, c, moneyCell());
    }

    put(
      parts.cells,
      r,
      10,
      moneyFormula(`=D${excelRow}+E${excelRow}+F${excelRow}-G${excelRow}-H${excelRow}-I${excelRow}`)
    );
    put(parts.cells, r, 11, percentFormula(`=IF(D${excelRow}=0,0,(K${excelRow}-D${excelRow})/D${excelRow})`));
    put(parts.cells, r, 12, { ht: 0, vt: 0 });
  }

  const totalLabel = mergeCells(parts.merge, totalRow, 0, 1, 3);
  put(parts.cells, totalRow, 0, {
    ...totalLabel,
    v: 'TOTAL',
    bg: '#1e293b',
    fc: '#ffffff',
    bl: 1,
    fs: 11,
    ht: 0,
    vt: 0,
  });

  for (const c of [3, 4, 5, 6, 7, 8, 9, 10]) {
    const letter = String.fromCharCode(65 + c);
    put(parts.cells, totalRow, c, {
      ...moneyFormula(`=SUM(${letter}4:${letter}${lastDailyExcelRow})`),
      bg: '#e2e8f0',
      bl: 1,
    });
  }
  put(parts.cells, totalRow, 11, {
    ...percentFormula(`=IF(D${totalRow + 1}=0,0,(K${totalRow + 1}-D${totalRow + 1})/D${totalRow + 1})`),
    bg: '#e2e8f0',
    bl: 1,
  });
  put(parts.cells, totalRow, 12, { bg: '#e2e8f0' });

  const averageLabel = mergeCells(parts.merge, averageRow, 0, 1, 3);
  put(parts.cells, averageRow, 0, {
    ...averageLabel,
    v: 'RATA-RATA HARIAN',
    bg: '#e2e8f0',
    fc: '#0f172a',
    bl: 1,
    fs: 11,
    ht: 0,
    vt: 0,
  });
  for (const c of [4, 5, 6, 7, 8, 9, 10]) {
    const letter = String.fromCharCode(65 + c);
    put(parts.cells, averageRow, c, {
      ...moneyFormula(`=AVERAGE(${letter}4:${letter}${lastDailyExcelRow})`),
      bg: '#f1f5f9',
    });
  }
  put(parts.cells, averageRow, 11, {
    ...percentFormula(`=AVERAGE(L4:L${lastDailyExcelRow})`),
    bg: '#f1f5f9',
  });
  put(parts.cells, averageRow, 12, { bg: '#f1f5f9' });

  put(
    parts.cells,
    noteRow,
    0,
    {
      ...mergeCells(parts.merge, noteRow, 0, 1, colCount),
      v: 'Status harian diisi CLOSING atau LIBUR. Saldo Kas Akhir = Saldo Awal + Pendapatan Operasional + Pemasukan Non Operasional - Biaya Tetap - Biaya Variabel - Operasional Toko. Seluruh perubahan tersimpan otomatis ke server.',
      bg: '#f8fafc',
      fc: '#64748b',
      fs: 10,
      ht: 1,
      vt: 0,
      tb: '2',
    }
  );

  parts.rowlen[String(totalRow)] = 30;
  parts.rowlen[String(averageRow)] = 30;
  parts.rowlen[String(noteRow)] = 34;
  parts.lastRow = noteRow;

  return finalizeSheet('kas_utama', 'Kas Utama', 0, token, parts, {
    '0': 105,
    '1': 46,
    '2': 108,
    '3': 145,
    '4': 185,
    '5': 165,
    '6': 170,
    '7': 170,
    '8': 175,
    '9': 160,
    '10': 150,
    '11': 130,
    '12': 100,
  });
}

/* ---------------------------------------------------------------------- */
/*  Debit (pengeluaran)                                                    */
/* ---------------------------------------------------------------------- */
export function createDebitSheet(year: number): Sheet {
  const parts: SheetParts = { cells: [], merge: {}, rowlen: {}, colCount: 11, lastRow: 0 };
  const token = '#15803d';

  put(parts.cells, 0, 0, titleCell(`JURNAL DEBIT (PENGELUARAN) ${year}`, '#14532d', mergeCells(parts.merge, 0, 0, 1, 11)));
  put(parts.cells, 1, 0, bankCell(mergeCells(parts.merge, 1, 0, 1, 11)));

  const headers = [
    'BULAN',
    'NO',
    'TANGGAL',
    'NAMA / NO. REFERENSI',
    'JENIS TRANSAKSI',
    'PENGELUARAN CASH',
    'PENGELUARAN TRANSFER PT',
    'PENGELUARAN TRF BEJO',
    'TOTAL PENGELUARAN',
    'STATUS',
    'KETERANGAN',
  ];
  headers.forEach((header, c) => put(parts.cells, 2, c, headerCell(header, token)));

  parts.rowlen['0'] = 32;
  parts.rowlen['1'] = 26;
  parts.rowlen['2'] = 48;

  const startRow = 3;
  const days = daysInYear(year);
  const totalRow = startRow + days;
  const averageRow = totalRow + 1;
  const noteRow = averageRow + 1;
  const lastDailyExcelRow = startRow + days;

  for (let i = 0; i < days; i += 1) {
    const r = startRow + i;
    const excelRow = r + 1;
    const date = new Date(year, 0, 1 + i);
    const month = date.getMonth();

    if (date.getDate() === 1) {
      put(parts.cells, r, 0, {
        v: `${MONTH_NAMES[month]} ${year}`,
        ht: 1,
        vt: 0,
        bl: 1,
        fc: '#334155',
      });
    }

    put(parts.cells, r, 1, numberCell(i + 1));
    put(parts.cells, r, 2, textCell(dayLabel(year, month, date.getDate()), { ht: 0 }));
    put(parts.cells, r, 3, { ht: 1, vt: 0, tb: '1' });
    put(parts.cells, r, 4, { ht: 1, vt: 0, tb: '2' });
    for (let c = 5; c <= 7; c += 1) put(parts.cells, r, c, moneyCell());
    put(parts.cells, r, 8, moneyFormula(`=SUM(F${excelRow}:H${excelRow})`));
    put(parts.cells, r, 9, { ht: 0, vt: 0 });
    put(parts.cells, r, 10, { ht: 1, vt: 0, tb: '1' });
  }

  put(parts.cells, totalRow, 0, {
    ...mergeCells(parts.merge, totalRow, 0, 1, 3),
    v: 'TOTAL',
    bg: '#14532d',
    fc: '#ffffff',
    bl: 1,
    fs: 11,
    ht: 0,
    vt: 0,
  });
  for (const c of [5, 6, 7, 8]) {
    const letter = String.fromCharCode(65 + c);
    put(parts.cells, totalRow, c, {
      ...moneyFormula(`=SUM(${letter}4:${letter}${lastDailyExcelRow})`),
      bg: '#dcfce7',
      bl: 1,
    });
  }

  put(parts.cells, averageRow, 0, {
    ...mergeCells(parts.merge, averageRow, 0, 1, 3),
    v: 'RATA-RATA HARIAN',
    bg: '#e2e8f0',
    fc: '#0f172a',
    bl: 1,
    fs: 11,
    ht: 0,
    vt: 0,
  });
  for (const c of [5, 6, 7, 8]) {
    const letter = String.fromCharCode(65 + c);
    put(parts.cells, averageRow, c, {
      ...moneyFormula(`=AVERAGE(${letter}4:${letter}${lastDailyExcelRow})`),
      bg: '#f1f5f9',
    });
  }

  put(parts.cells, noteRow, 0, {
    ...mergeCells(parts.merge, noteRow, 0, 1, 11),
    v: 'Isi pengeluaran pada kolom Cash, Transfer PT, atau TRF Bejo. Total Pengeluaran dihitung otomatis. Seluruh perubahan tersimpan otomatis ke server.',
    bg: '#f8fafc',
    fc: '#64748b',
    fs: 10,
    ht: 1,
    vt: 0,
    tb: '2',
  });

  parts.rowlen[String(totalRow)] = 30;
  parts.rowlen[String(averageRow)] = 30;
  parts.rowlen[String(noteRow)] = 34;
  parts.lastRow = noteRow;

  return finalizeSheet('debit', 'Debit', 1, token, parts, {
    '0': 105,
    '1': 46,
    '2': 108,
    '3': 190,
    '4': 230,
    '5': 155,
    '6': 175,
    '7': 160,
    '8': 165,
    '9': 100,
    '10': 210,
  });
}

/* ---------------------------------------------------------------------- */
/*  Kredit (pendapatan)                                                    */
/* ---------------------------------------------------------------------- */
export function createKreditSheet(year: number): Sheet {
  const parts: SheetParts = { cells: [], merge: {}, rowlen: {}, colCount: 10, lastRow: 0 };
  const token = '#b91c1c';

  put(parts.cells, 0, 0, titleCell(`JURNAL KREDIT (PENDAPATAN) ${year}`, '#450a0a', mergeCells(parts.merge, 0, 0, 1, 10)));
  put(parts.cells, 1, 0, bankCell(mergeCells(parts.merge, 1, 0, 1, 10)));

  const headers = [
    'BULAN',
    'NO',
    'TANGGAL',
    'NAMA / NO. INVOICE',
    'JENIS TRANSAKSI',
    'PENDAPATAN CASH',
    'PENDAPATAN TRANSFER PT',
    'PENDAPATAN TRF BEJO',
    'TOTAL PENDAPATAN',
    'STATUS',
  ];
  headers.forEach((header, c) => put(parts.cells, 2, c, headerCell(header, token)));

  parts.rowlen['0'] = 32;
  parts.rowlen['1'] = 26;
  parts.rowlen['2'] = 48;

  const startRow = 3;
  const days = daysInYear(year);
  const totalRow = startRow + days;
  const averageRow = totalRow + 1;
  const noteRow = averageRow + 1;
  const lastDailyExcelRow = startRow + days;

  for (let i = 0; i < days; i += 1) {
    const r = startRow + i;
    const excelRow = r + 1;
    const date = new Date(year, 0, 1 + i);
    const month = date.getMonth();

    if (date.getDate() === 1) {
      put(parts.cells, r, 0, {
        v: `${MONTH_NAMES[month]} ${year}`,
        ht: 1,
        vt: 0,
        bl: 1,
        fc: '#334155',
      });
    }

    put(parts.cells, r, 1, numberCell(i + 1));
    put(parts.cells, r, 2, textCell(dayLabel(year, month, date.getDate()), { ht: 0 }));
    put(parts.cells, r, 3, { ht: 1, vt: 0, tb: '1' });
    put(parts.cells, r, 4, { ht: 1, vt: 0, tb: '2' });
    for (let c = 5; c <= 7; c += 1) put(parts.cells, r, c, moneyCell());
    put(parts.cells, r, 8, moneyFormula(`=SUM(F${excelRow}:H${excelRow})`));
    put(parts.cells, r, 9, { ht: 0, vt: 0 });
  }

  put(parts.cells, totalRow, 0, {
    ...mergeCells(parts.merge, totalRow, 0, 1, 3),
    v: 'TOTAL',
    bg: '#450a0a',
    fc: '#ffffff',
    bl: 1,
    fs: 11,
    ht: 0,
    vt: 0,
  });
  for (const c of [5, 6, 7, 8]) {
    const letter = String.fromCharCode(65 + c);
    put(parts.cells, totalRow, c, {
      ...moneyFormula(`=SUM(${letter}4:${letter}${lastDailyExcelRow})`),
      bg: '#fee2e2',
      bl: 1,
    });
  }

  put(parts.cells, averageRow, 0, {
    ...mergeCells(parts.merge, averageRow, 0, 1, 3),
    v: 'RATA-RATA HARIAN',
    bg: '#e2e8f0',
    fc: '#0f172a',
    bl: 1,
    fs: 11,
    ht: 0,
    vt: 0,
  });
  for (const c of [5, 6, 7, 8]) {
    const letter = String.fromCharCode(65 + c);
    put(parts.cells, averageRow, c, {
      ...moneyFormula(`=AVERAGE(${letter}4:${letter}${lastDailyExcelRow})`),
      bg: '#f1f5f9',
    });
  }

  put(parts.cells, noteRow, 0, {
    ...mergeCells(parts.merge, noteRow, 0, 1, 10),
    v: 'Isi pendapatan pada kolom Cash, Transfer PT, atau TRF Bejo. Total Pendapatan dihitung otomatis. Seluruh perubahan tersimpan otomatis ke server.',
    bg: '#f8fafc',
    fc: '#64748b',
    fs: 10,
    ht: 1,
    vt: 0,
    tb: '2',
  });

  parts.rowlen[String(totalRow)] = 30;
  parts.rowlen[String(averageRow)] = 30;
  parts.rowlen[String(noteRow)] = 34;
  parts.lastRow = noteRow;

  return finalizeSheet('kredit', 'Kredit', 2, token, parts, {
    '0': 105,
    '1': 46,
    '2': 108,
    '3': 210,
    '4': 230,
    '5': 160,
    '6': 180,
    '7': 165,
    '8': 165,
    '9': 100,
  });
}

export function createJurnalSheets(year: number): Sheet[] {
  return [createKasUtamaSheet(year), createDebitSheet(year), createKreditSheet(year)];
}
