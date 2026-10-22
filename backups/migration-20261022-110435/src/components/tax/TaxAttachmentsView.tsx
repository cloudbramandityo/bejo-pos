/**
 * Coded by Langgo Bramandityo.
 * Submenu 11: Lampiran dan Dokumen Pendukung SPT Tahunan
 * Mendukung pembukaan dan pencetakan dokumen resmi standar DJP
 */
import React from 'react';
import { TaxAnnualReturn1770 } from '../../types/tax';
import { FileText, CheckCircle2, Paperclip, Printer, ExternalLink } from 'lucide-react';

interface TaxAttachmentsViewProps {
  currentReturn: TaxAnnualReturn1770;
  onOpenPrintView?: () => void;
}

export const TaxAttachmentsView: React.FC<TaxAttachmentsViewProps> = ({ currentReturn, onOpenPrintView }) => {
  const documents = [
    {
      id: 'doc-1',
      title: 'Formulir Induk SPT Tahunan 1770',
      description: 'Format baku resmi Direktorat Jenderal Pajak RI (Halaman 1 & 2)',
      status: 'TERSEDIA OTOMATIS',
      required: true,
    },
    {
      id: 'doc-2',
      title: 'Lampiran 1: Form 1770 - I (Usaha & Gaji)',
      description: 'Penghasilan usaha pencatatan/norma & sehubungan dengan pekerjaan',
      status: 'TERSEDIA OTOMATIS',
      required: true,
    },
    {
      id: 'doc-3',
      title: 'Lampiran 2: Form 1770 - II (Kredit Pajak)',
      description: `Daftar pemotongan PPh oleh pihak lain (${currentReturn.withholdings.length} Bukti Potong)`,
      status: 'TERSEDIA OTOMATIS',
      required: true,
    },
    {
      id: 'doc-4',
      title: 'Lampiran 3: Form 1770 - III (Final PP 55 & Non-Objek)',
      description: 'Rekapitulasi omzet UMKM Toko Bejo Stiker & penghasilan non-objek',
      status: 'TERSEDIA OTOMATIS',
      required: true,
    },
    {
      id: 'doc-5',
      title: 'Lampiran 4: Form 1770 - IV (Harta, Utang & Tanggungan)',
      description: `${currentReturn.assets.length} Harta, ${currentReturn.debts.length} Utang, ${currentReturn.dependents.length} Tanggungan`,
      status: 'TERSEDIA OTOMATIS',
      required: true,
    },
    {
      id: 'doc-6',
      title: 'Lampiran Khusus: Rekapitulasi Peredaran Bruto Bulanan (PP 55/2022)',
      description: 'Laporan rincian omzet 12 bulan & fasilitas bebas pajak Rp 500 Juta',
      status: 'TERSEDIA OTOMATIS',
      required: true,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Lampiran dan Dokumen Pendukung SPT Tahunan {currentReturn.taxYear}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Daftar dokumen resmi yang dilampirkan bersama penyampaian SPT Tahunan PPh Orang Pribadi ke DJP.
          </p>
        </div>

        {onOpenPrintView && (
          <button
            type="button"
            onClick={onOpenPrintView}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <Printer className="w-4 h-4" />
            <span>Buka & Cetak Semua Dokumen</span>
          </button>
        )}
      </div>

      <div className="space-y-3">
        {documents.map(doc => (
          <div key={doc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-300 transition-all">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <Paperclip className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>{doc.title}</span>
                  {doc.required && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold uppercase">Wajib</span>
                  )}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{doc.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{doc.status}</span>
              </span>

              {onOpenPrintView && (
                <button
                  type="button"
                  onClick={onOpenPrintView}
                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Pratinjau & Cetak Lembar Ini"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start gap-3 text-xs text-blue-900 leading-relaxed">
        <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Catatan Resmi DJP Mengenai Bukti Penerimaan Elektronik (BPE):</strong>
          <p className="text-[11px] text-blue-800 mt-0.5">
            Bukti Penerimaan Elektronik (BPE) resmi dengan stempel digital dan Nomor Tanda Terima Elektronik (NTTE) diterbitkan secara sah langsung oleh server Direktorat Jenderal Pajak (DJP) setelah Anda mengunggah formulir SPT Tahunan ini melalui portal e-Filing DJP Online (djponline.pajak.go.id).
          </p>
        </div>
      </div>
    </div>
  );
};
