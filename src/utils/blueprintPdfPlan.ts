/**
 * Susunan cetak PDF blueprint — murni teks, tanpa jsPDF dan tanpa browser.
 *
 * Dipisah dari `blueprintDownload.ts` supaya isinya bisa diperiksa penjaga
 * (`npm run check:blueprint`): PDF wajib berasal dari dokumen di server, bukan
 * dari kalimat yang dikarang di kode.
 */

/** Satu langkah cetak pada PDF: baris teks, atau ruang kosong antar blok. */
export type BlueprintPdfItem =
  | {
      kind: 'text';
      text: string;
      size: number;
      style: 'normal' | 'bold' | 'monospace';
      indent: number;
    }
  | { kind: 'gap'; mm: number };

export const PDF_LINE_MM = 4.1;
export const PDF_FONT_SIZE = 9;

/**
 * Huruf standar PDF (Helvetica) hanya mengenal WinAnsi. Tanda yang tidak ada di
 * sana diganti padanan ASCII-nya supaya PDF tidak mencetakkannya sebagai kotak.
 */
const UNSUPPORTED_PRINT_GLYPHS: Readonly<Record<string, string>> = {
  '→': '->',
  '←': '<-',
  '−': '-',
  'Σ': 'Total',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '∞': 'tak hingga',
  '✔': 'v',
  '✖': 'x',
};

function toPrintable(text: string): string {
  return text.replace(/[^\u0000-\u00FF]/g, (ch) => UNSUPPORTED_PRINT_GLYPHS[ch] ?? ch);
}

/** Buang penanda Markdown supaya isinya terbaca di PDF. */
function plainText(line: string): string {
  return toPrintable(
    line
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/^\s*>\s?/, '')
      .trimEnd()
  );
}

/** Baris tabel diratakan: sel dipisah titik, garis pemisah tidak ikut. */
function tableRowToText(line: string): string {
  const cells = line
    .split('|')
    .map((cell) => plainText(cell))
    .filter((cell) => cell.length > 0 && !/^[-:\s]+$/.test(cell));
  return cells.join('   ·   ');
}

/**
 * Blok angka struktural dipakai penjaga (`npm run check:blueprint`) lewat
 * komentar HTML-nya. Angkanya sudah ada di badan dokumen, jadi bloknya dibuang
 * supaya PDF tidak mencetak daftar yang sama dua kali.
 */
function dropGuardBlock(markdown: string): string {
  return markdown.replace(/<!--\s*ANGKA-STRUKTURAL:START\s*-->[\s\S]*?<!--\s*ANGKA-STRUKTURAL:END\s*-->/g, '');
}

export function planBlueprintPdf(markdown: string): BlueprintPdfItem[] {
  const lines = dropGuardBlock(markdown)
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
    .filter((line, index, all) => !(line.trim() === '' && (index === 0 || all[index - 1].trim() === '')));

  const items: BlueprintPdfItem[] = [];
  let inCodeBlock = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (!trimmed) {
      items.push({ kind: 'gap', mm: PDF_LINE_MM * 0.6 });
      continue;
    }

    if (trimmed === '---') {
      items.push({ kind: 'gap', mm: PDF_LINE_MM * 0.5 });
      continue;
    }

    if (inCodeBlock) {
      items.push({ kind: 'text', text: toPrintable(trimmed), size: 8, style: 'monospace', indent: 4 });
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s/);
    if (heading) {
      const level = heading[1].length;
      items.push({
        kind: 'text',
        text: plainText(trimmed.replace(/^#+\s*/, '')),
        size: level === 1 ? 15 : level === 2 ? 12 : 10.5,
        style: 'bold',
        indent: 0,
      });
      continue;
    }

    if (trimmed.startsWith('|')) {
      const rowText = plainText(tableRowToText(trimmed));
      if (rowText) items.push({ kind: 'text', text: rowText, size: 8, style: 'normal', indent: 2 });
      continue;
    }

    if (/^[-*+]\s/.test(trimmed)) {
      items.push({
        kind: 'text',
        text: `•  ${plainText(trimmed.replace(/^[-*+]\s*/, ''))}`,
        size: PDF_FONT_SIZE,
        style: 'normal',
        indent: 2,
      });
      continue;
    }

    items.push({
      kind: 'text',
      text: plainText(trimmed),
      size: PDF_FONT_SIZE,
      style: 'normal',
      indent: /^\d+\.\s/.test(trimmed) ? 2 : 0,
    });
  }

  return items;
}
