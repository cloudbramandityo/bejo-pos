export type ImportedGrid = string[][];

export type ImportedCellValue =
  | string
  | number
  | { v: number; ct: { fa: string; t: 'n' } };

export function parseDelimited(text: string): ImportedGrid {
  const source = text.replace(/\r\n?/g, '\n');
  const rows: ImportedGrid = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === '\t') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function parseHtmlTable(html: string): ImportedGrid | null {
  if (typeof DOMParser === 'undefined' || !/<table[\s>]/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const rows: ImportedGrid = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const row: string[] = [];
    tr.querySelectorAll('td, th').forEach((cell) => {
      const clone = cell.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      const text = (clone.textContent || '').replace(/\u00a0/g, ' ').trim();
      row.push(text);
      const colspan = Math.max(1, Number((cell as HTMLTableCellElement).colSpan) || 1);
      for (let extra = 1; extra < colspan; extra += 1) row.push('');
    });
    if (row.length > 0) rows.push(row);
  });

  if (rows.length === 0) return null;
  const width = Math.max(...rows.map((row) => row.length));
  return rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => '')]);
}

export function toTsv(grid: ImportedGrid): string {
  return grid
    .map((row) =>
      row
        .map((cell) => (/[\t\n\r"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join('\t')
    )
    .join('\n');
}

export function trimGrid(grid: ImportedGrid): ImportedGrid {
  const rows = grid.filter((row) => row.some((cell) => cell.trim().length > 0));
  let width = 0;
  rows.forEach((row) => {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (row[index].trim().length > 0) {
        width = Math.max(width, index + 1);
        break;
      }
    }
  });
  return rows.map((row) => row.slice(0, width));
}

const CURRENCY_PREFIX = /^(rp\.?|idr)\s*/i;

// Nilai dari Google Sheets bisa memakai format Indonesia (1.234.567,89),
// format internasional (1,234,567.89), atau angka polos. Kode berawalan nol
// (mis. nomor referensi) dipertahankan sebagai teks.
export function parseImportedValue(raw: string): ImportedCellValue {
  const text = raw.trim();
  if (!text) return '';

  const percent = text.endsWith('%');
  let numericText = text.replace(CURRENCY_PREFIX, '').trim();
  if (percent) numericText = numericText.slice(0, -1).trim();
  if (!/^[-+]?[\d.,\s]+$/.test(numericText) || !/\d/.test(numericText)) return text;

  const compact = numericText.replace(/\s+/g, '');
  const hasSeparator = /[.,]/.test(compact);
  let normalized = compact;

  if (hasSeparator) {
    const lastComma = compact.lastIndexOf(',');
    const lastDot = compact.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      normalized =
        lastComma > lastDot
          ? compact.replace(/\./g, '').replace(/,/g, '.')
          : compact.replace(/,/g, '');
    } else if (lastComma >= 0) {
      normalized = /^[-+]?\d{1,3}(,\d{3})+$/.test(compact)
        ? compact.replace(/,/g, '')
        : compact.replace(',', '.');
    } else {
      normalized = /^[-+]?\d{1,3}(\.\d{3})+$/.test(compact)
        ? compact.replace(/\./g, '')
        : compact;
    }
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return text;
  if (!hasSeparator && /^[-+]?0\d+$/.test(compact) && !percent) return text;
  if (percent) return { v: numeric / 100, ct: { fa: '0.00%', t: 'n' } };
  return numeric;
}
