/**
 * Cetak PDF hasil Rekonsiliasi (analisis varians & komparatif).
 * Satu tabel per kolom pembanding; angkanya persis hasil analisa di layar.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReconciliationAnalysis, ReconciliationRun } from '../types/reconciliation';
import {
  columnKindLabel,
  differenceHeading,
  formatColumnValue,
  formatPercentValue,
  summaryCountsText,
  verdictLabel,
} from './reconciliationMath';
import { downloadPdfFile } from './pdfDownload';

const PAGE_BOTTOM = 262;

const kindHeading = (analysis: ReconciliationAnalysis): string =>
  analysis.kind === 'VARIANS'
    ? 'ANALISIS VARIANS (RENCANA VS CAPAIAN)'
    : 'ANALISIS KOMPARATIF (DUA PERIODE)';

export function exportReconciliationToPDF(run: ReconciliationRun, storeName?: string): void {
  const analysis = run.analysis;
  if (!analysis) {
    alert('Jalankan analisa dulu sebelum mengunduh PDF.');
    return;
  }
  if (analysis.rows.length === 0 || analysis.columns.length === 0) {
    alert('Belum ada baris bernama yang ikut dihitung.');
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const title = (storeName || 'BEJO Digital Print').toUpperCase();
  const isVarians = analysis.kind === 'VARIANS';
  const labelA = run.labelA.trim() || 'Laporan A';
  const labelB = run.labelB.trim() || 'Laporan B';

  doc.setFillColor(30, 41, 93);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 14, 10);
  doc.setFontSize(10);
  doc.text(kindHeading(analysis), 14, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${run.title} | Dicetak ${new Date().toLocaleString('id-ID')}`, 14, 22);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`A: ${labelA}`, 14, 33);
  doc.text(`B: ${labelB}`, 112, 33);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Dibuat: ${new Date(run.createdAt || Date.now()).toLocaleDateString('id-ID')} | Baris dinilai: ${analysis.countedRows} | Kolom: ${analysis.columns.length}`,
    14,
    38
  );

  let cursorY = 44;

  for (const column of analysis.columns) {
    const summary = analysis.summaries.find((item) => item.columnId === column.id);
    if (cursorY > PAGE_BOTTOM) {
      doc.addPage();
      cursorY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${column.label.trim() || 'Kolom'} (${columnKindLabel(column.kind)})`,
      14,
      cursorY
    );
    cursorY += 2;

    if (isVarians && column.direction !== 'ROW') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        column.direction === 'NAIK' ? 'Naik menguntungkan' : 'Turun menguntungkan',
        196,
        cursorY - 3,
        { align: 'right' }
      );
    }

    autoTable(doc, {
      startY: cursorY + 2,
      head: [['No', 'Uraian', 'A', 'B', differenceHeading(analysis.kind), '%', 'Kesimpulan']],
      body: analysis.rows.map((row, index) => {
        const cell = row.cells.find((item) => item.columnId === column.id);
        if (!cell) return ['', row.label, '', '', '', '', ''];
        return [
          String(index + 1),
          row.label,
          formatColumnValue(column.kind, cell.valueA),
          formatColumnValue(column.kind, cell.valueB),
          formatColumnValue(column.kind, cell.difference),
          formatPercentValue(cell.percent),
          verdictLabel(analysis.kind, cell.verdict, cell.difference),
        ];
      }),
      foot: [[
        '',
        'Jumlah',
        formatColumnValue(column.kind, summary?.totalA ?? 0),
        formatColumnValue(column.kind, summary?.totalB ?? 0),
        formatColumnValue(column.kind, summary?.totalDifference ?? 0),
        formatPercentValue(summary?.totalPercent ?? null),
        '',
      ]],
      styles: { fontSize: 8, cellPadding: 2.2 },
      headStyles: { fillColor: [30, 41, 93], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 32, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
      },
    });

    cursorY = ((doc as any).lastAutoTable?.finalY ?? cursorY) + 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    if (cursorY > PAGE_BOTTOM) {
      doc.addPage();
      cursorY = 20;
    }
    doc.text(summaryCountsText(analysis.kind, summary), 14, cursorY);
    cursorY += 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  if (cursorY > PAGE_BOTTOM - 10) {
    doc.addPage();
    cursorY = 20;
  }
  doc.text('Ringkasan tiap kolom', 14, cursorY);
  cursorY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  for (const column of analysis.columns) {
    const summary = analysis.summaries.find((item) => item.columnId === column.id);
    if (cursorY > PAGE_BOTTOM) {
      doc.addPage();
      cursorY = 20;
    }
    doc.text(
      `${column.label.trim() || 'Kolom'}: A ${formatColumnValue(column.kind, summary?.totalA ?? 0)}   B ${formatColumnValue(column.kind, summary?.totalB ?? 0)}   selisih ${formatColumnValue(column.kind, summary?.totalDifference ?? 0)} (${formatPercentValue(summary?.totalPercent ?? null)} dari A)`,
      14,
      cursorY,
      { maxWidth: 182 }
    );
    cursorY += 5;
  }

  cursorY += 3;
  if (cursorY > PAGE_BOTTOM - 12) {
    doc.addPage();
    cursorY = 20;
  }
  doc.text('Cara baca: persen selalu dibandingkan dengan Laporan A.', 14, cursorY, { maxWidth: 180 });
  cursorY += 4.5;
  doc.text(
    isVarians
      ? 'Batas menguntungkan mengikuti sifat baris, kecuali kolomnya diatur sendiri.'
      : 'Selisih dibaca sebagai naik atau turun terhadap periode acuan.',
    14,
    cursorY,
    { maxWidth: 180 }
  );
  cursorY += 4.5;
  if (isVarians) {
    doc.text(
      'Baris Perbandingan hanya dibandingkan, tidak dinilai untung atau rugi.',
      14,
      cursorY,
      { maxWidth: 180 }
    );
    cursorY += 4.5;
  }
  cursorY += 4.5;

  if (run.notes && run.notes.trim()) {
    if (cursorY > PAGE_BOTTOM - 10) {
      doc.addPage();
      cursorY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Catatan', 14, cursorY);
    cursorY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.text(run.notes.trim(), 14, cursorY, { maxWidth: 180 });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Halaman ${page} dari ${pageCount}`, 196, 288, { align: 'right' });
  }

  const safeName = `${run.kind}_${run.title || 'rekonsiliasi'}`.replace(/[/\\?%*:|"<>]/g, '-');
  downloadPdfFile(doc, `Rekonsiliasi_${safeName}.pdf`);
}
