/**
 * Tombol unduh laporan: satu dokumen, tiga format.
 * Angka tidak dihitung di sini — berkas hanya mencetak dokumen yang disusun
 * mesin laporan saat tombolnya ditekan.
 */
import React from 'react';
import { FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import type { LedgerReportDocument } from '../../utils/ledgerReportDocument';
import { exportLedgerReportToCSV, exportLedgerReportToExcel, exportLedgerReportToPDF } from '../../utils/ledgerReportExport';

const printedAt = (): string => new Date().toLocaleString('id-ID');

interface ReportExportBarProps {
  build: () => LedgerReportDocument | null;
  /** Alasan tombol tidak aktif, ditulis apa adanya bila datanya belum ada. */
  blocked?: string;
}

const BUTTON =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed';

const ReportExportBar: React.FC<ReportExportBarProps> = ({ build, blocked }) => {
  const [notice, setNotice] = React.useState('');

  const run = (kind: 'pdf' | 'xlsx' | 'csv') => {
    const report = build();
    if (!report) {
      setNotice(blocked || 'Angka laporannya belum tersedia untuk diunduh.');
      window.setTimeout(() => setNotice(''), 6000);
      return;
    }
    setNotice('');
    if (kind === 'pdf') exportLedgerReportToPDF(report);
    else if (kind === 'xlsx') exportLedgerReportToExcel(report);
    else exportLedgerReportToCSV(report);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-slate-500">Unduh:</span>
      <button type="button" className={BUTTON} onClick={() => run('pdf')}>
        <FileText className="w-3.5 h-3.5" />
        PDF
      </button>
      <button type="button" className={BUTTON} onClick={() => run('xlsx')}>
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Excel
      </button>
      <button type="button" className={BUTTON} onClick={() => run('csv')}>
        <Table2 className="w-3.5 h-3.5" />
        CSV
      </button>
      {notice && <span className="text-[11px] font-bold text-amber-800">{notice}</span>}
    </div>
  );
};

export const exportPrintedAt = printedAt;

export default ReportExportBar;
