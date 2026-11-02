/**
 * Unduh dokumen blueprint aplikasi (.md dan .pdf) oleh DEVELOPER.
 *
 * Isinya tidak boleh ditulis ulang di sini: berkasnya dibaca dari server lewat
 * `src/lib/blueprint.ts`, jadi yang diunduh selalu versi yang sama dengan kode
 * yang sedang berjalan. Penataan halaman PDF ada di `blueprintPdfPlan.ts`
 * (penanda Markdown dibuang, tabel dipecah per baris) supaya hasil susunannya
 * bisa diperiksa penjaga tanpa browser.
 */
import jsPDF from 'jspdf';
import { fetchBlueprintDocument } from '../lib/blueprint';
import { APP_VERSION } from '../config/brand';
import { downloadPdfFile } from './pdfDownload';
import { PDF_FONT_SIZE, PDF_LINE_MM, planBlueprintPdf, type BlueprintPdfItem } from './blueprintPdfPlan';

export interface BlueprintDownloadResult {
  fileName: string;
  bytes: number;
  updatedAt: string;
}

const PDF_MARGIN_MM = 16;

function saveTextFile(fileName: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toResult(
  blueprint: { fileName: string; bytes: number; updatedAt: string },
  fileName: string
): BlueprintDownloadResult {
  return { fileName, bytes: blueprint.bytes, updatedAt: blueprint.updatedAt };
}

function buildBlueprintPdf(items: BlueprintPdfItem[], footer: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PDF_MARGIN_MM * 2;
  const lastLineY = pageHeight - PDF_MARGIN_MM - 6;

  let y = PDF_MARGIN_MM + 4;

  for (const item of items) {
    if (item.kind === 'gap') {
      y += item.mm;
      continue;
    }

    doc.setFont('helvetica', item.style === 'monospace' ? 'normal' : item.style);
    doc.setFontSize(item.size);

    const wrapped = doc.splitTextToSize(item.text, contentWidth - item.indent) as string[];
    const lineHeight =
      item.size === PDF_FONT_SIZE ? PDF_LINE_MM : PDF_LINE_MM * (item.size / PDF_FONT_SIZE) * 0.92;

    for (const textLine of wrapped) {
      if (y + lineHeight > lastLineY) {
        doc.addPage();
        y = PDF_MARGIN_MM + 4;
      }
      doc.text(textLine, PDF_MARGIN_MM + item.indent, y);
      y += lineHeight;
    }
    if (item.style === 'bold') y += 1.4;
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(footer, PDF_MARGIN_MM, pageHeight - 8);
    doc.text(`Halaman ${page} / ${totalPages}`, pageWidth - PDF_MARGIN_MM, pageHeight - 8, { align: 'right' });
  }

  return doc;
}

/** Unduh dokumen apa adanya (.md), isi persis seperti di folder aplikasi. */
export async function downloadBlueprintMarkdown(): Promise<BlueprintDownloadResult> {
  const blueprint = await fetchBlueprintDocument();
  const fileName = `${blueprint.fileName.replace(/\.md$/i, '')}.md`;
  saveTextFile(fileName, blueprint.markdown, 'text/markdown');
  return toResult(blueprint, fileName);
}

/** Unduh dokumen dalam PDF (A4, penanda Markdown sudah dibersihkan). */
export async function downloadBlueprintPdf(): Promise<BlueprintDownloadResult> {
  const blueprint = await fetchBlueprintDocument();
  const title = blueprint.fileName.replace(/\.md$/i, '');
  const fileName = `${title}.pdf`;
  const firstHeading = blueprint.markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || title;
  const items = planBlueprintPdf(blueprint.markdown);
  downloadPdfFile(buildBlueprintPdf(items, `${firstHeading} - vX${APP_VERSION}`), fileName);
  return toResult(blueprint, fileName);
}
