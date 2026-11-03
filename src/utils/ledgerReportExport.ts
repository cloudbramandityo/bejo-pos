/**
 * Mencetak dokumen laporan keuangan ke PDF, Excel, atau CSV.
 *
 * Isinya tidak dihitung di sini: berkas ini hanya mencetak `LedgerReportDocument`
 * hasil tata dari mesin laporan, jadi angka di layar, di PDF, dan di Excel sama.
 * Setiap berkas membawa nama entitas, periode, tanggal cetak, mata uang, dan
 * status laporan supaya bisa dibaca tanpa membuka aplikasi.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { LedgerReportDocument, ReportCell, ReportTable } from './ledgerReportDocument';
import { formatRupiah } from './formatters';
import { downloadPdfFile } from './pdfDownload';

const PAGE_BOTTOM = 250;

/** Kolom yang angkanya uang; jumlah baris dan banyak jurnal tidak boleh bercelana Rp. */
const MONEY_HEADINGS = new Set([
  'Jumlah',
  'Debit',
  'Kredit',
  'Awal debit',
  'Awal kredit',
  'Akhir debit',
  'Akhir kredit',
  'Saldo berjalan',
  'Pendapatan',
  'Laba (rugi)',
]);

const isMoney = (columns: string[], index: number): boolean => MONEY_HEADINGS.has((columns[index] || '').trim());

const asNumber = (value: ReportCell): number | null => (typeof value === 'number' ? value : null);

const printCell = (value: ReportCell, money: boolean): string =>
  money && typeof value === 'number' ? formatRupiah(value) : String(value);

/** Kop pada halaman pertama PDF: identitas, periode, tanggal cetak, status. */
const drawHeader = (doc: jsPDF, report: LedgerReportDocument, y: number): number => {
  let cursor = y;
  doc.setFillColor(30, 41, 93);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(report.entityName.toUpperCase(), 14, 10, { maxWidth: 182 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const line of report.identity) {
    cursor += 4;
    doc.text(line, 14, cursor, { maxWidth: 182 });
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title.toUpperCase(), 14, 26, { maxWidth: 182 });

  cursor = 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(report.periodLabel, 14, cursor);
  cursor += 4.5;
  doc.text(`Dicetak: ${report.printedAt}`, 14, cursor);
  cursor += 4.5;
  doc.text(report.currency, 14, cursor);
  cursor += 4.5;
  doc.setTextColor(120, 53, 15);
  doc.text(`Status: ${report.status}`, 14, cursor, { maxWidth: 182 });
  return cursor + 8;
};

export function exportLedgerReportToPDF(report: LedgerReportDocument): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let cursorY = drawHeader(doc, report, 30);

  for (const table of report.tables) {
    if (table.rows.length === 0) continue;
    if (cursorY > PAGE_BOTTOM) {
      doc.addPage();
      cursorY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(table.heading, 14, cursorY, { maxWidth: 182 });

    autoTable(doc, {
      startY: cursorY + 2,
      head: [table.columns],
      body: table.rows.map((row) =>
        row.map((cell, index) => printCell(cell, isMoney(table.columns, index)))
      ),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 93], textColor: 255, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(
        table.columns.map((_, index) => [
          index,
          isMoney(table.columns, index)
            ? { halign: 'right' as const, cellWidth: 'wrap' as const }
            : { halign: 'left' as const },
        ])
      ),
    });

    cursorY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY) + 8;
  }

  const notes = report.notes.filter((text) => text.length > 0);
  if (notes.length > 0) {
    if (cursorY > PAGE_BOTTOM - 10) {
      doc.addPage();
      cursorY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Catatan', 14, cursorY);
    cursorY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    for (const note of notes) {
      if (cursorY > PAGE_BOTTOM) {
        doc.addPage();
        cursorY = 20;
      }
      const lines = doc.splitTextToSize(note, 182);
      doc.text(lines, 14, cursorY);
      cursorY += lines.length * 4 + 1.5;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Halaman ${page} dari ${pageCount}`, 196, 288, { align: 'right' });
  }

  downloadPdfFile(doc, `${report.fileName}.pdf`);
}

const sheetRows = (table: ReportTable): ReportCell[][] => {
  const moneyColumns = table.columns.map((_, index) => isMoney(table.columns, index));
  return [
    [table.heading],
    table.columns,
    ...table.rows.map((row) => row.map((cell, index) => (moneyColumns[index] ? asNumber(cell) ?? cell : cell))),
    [],
  ];
};

export function exportLedgerReportToExcel(report: LedgerReportDocument): void {
  const meta: ReportCell[][] = [
    [report.title],
    ['Entitas', report.entityName],
    ...report.identity.map((line) => ['', line]),
    ['Periode', report.periodLabel],
    ['Tanggal cetak', report.printedAt],
    ['Mata uang', report.currency],
    ['Status laporan', report.status],
    [],
  ];
  const body = report.tables.flatMap((table) => sheetRows(table));
  const notes: ReportCell[][] = report.notes.length > 0 ? [['Catatan'], ...report.notes.map((note) => [note])] : [];
  const worksheet = XLSX.utils.aoa_to_sheet([...meta, ...body, ...notes]);
  worksheet['!cols'] = [{ wch: 14 }, { wch: 42 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, report.title.slice(0, 31));
  XLSX.writeFile(workbook, `${report.fileName}.xlsx`);
}

const csvCell = (value: ReportCell): string => {
  if (typeof value === 'number') return String(value);
  const text = value ?? '';
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function exportLedgerReportToCSV(report: LedgerReportDocument): void {
  const lines: string[] = [];
  const push = (cells: ReportCell[]) => lines.push(cells.map(csvCell).join(','));
  push([report.title]);
  push(['Entitas', report.entityName]);
  for (const line of report.identity) push(['', line]);
  push(['Periode', report.periodLabel]);
  push(['Tanggal cetak', report.printedAt]);
  push(['Mata uang', report.currency]);
  push(['Status laporan', report.status]);
  push([]);
  for (const table of report.tables) {
    push([table.heading]);
    push(table.columns);
    for (const row of table.rows) push(row);
    push([]);
  }
  for (const note of report.notes) push(['Catatan', note]);

  const blob = new Blob([`\uFEFF${lines.map((line) => `${line}\r\n`).join('')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.fileName}.csv`;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
