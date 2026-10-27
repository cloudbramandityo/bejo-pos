/**
 * Coded by Langgo Bramandityo.
 * Tahap 3: Format Cetak Dokumen Standar Formulir Induk 1770 & Lampiran I-IV
 * Siap diekspor ke PDF / dicetak fisik sesuai standar Direktorat Jenderal Pajak (DJP) RI & UU HPP 2025.
 */
import React, { useState, useMemo } from 'react';
import {
  TaxAnnualReturn1770,
  TaxpayerProfile,
  TAX_CONFIG_2025,
} from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import { getStoredMonthlyBillings } from '../../utils/taxStorage';
import {
  Printer,
  FileDown,
  Copy,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowLeft,
  Share2,
  FileText,
  Building,
  CheckSquare,
  Square,
  ShieldCheck,
  Download,
  Info
} from 'lucide-react';

interface TaxOfficialPrintViewProps {
  currentReturn: TaxAnnualReturn1770;
  taxpayer: TaxpayerProfile;
  onBack?: () => void;
  onOpenWizard?: (step?: number) => void;
}

type PrintTab =
  | 'all'
  | 'induk'
  | 'lampiran1'
  | 'lampiran2'
  | 'lampiran3'
  | 'lampiran4'
  | 'rekap_pp55';

export const TaxOfficialPrintView: React.FC<TaxOfficialPrintViewProps> = ({
  currentReturn,
  taxpayer,
  onBack,
  onOpenWizard,
}) => {
  const [activeTab, setActiveTab] = useState<PrintTab>('all');
  const [copied, setCopied] = useState(false);
  const [isA4Preview, setIsA4Preview] = useState(true);

  // Calculations & Totals
  const totalAssetsValue = currentReturn.assets.reduce((sum, a) => sum + (a.acquisitionPrice || 0), 0);
  const totalDebtsValue = currentReturn.debts.reduce((sum, d) => sum + (d.endingBalance || 0), 0);
  const totalWithholdingAmount = currentReturn.withholdings.reduce((sum, w) => sum + (w.withheldTaxAmount || 0), 0);
  const totalFinalGross = currentReturn.finalIncomes.reduce((sum, f) => sum + (f.grossAmount || 0), 0);
  const totalFinalTax = currentReturn.finalIncomes.reduce((sum, f) => sum + (f.finalTaxAmount || 0), 0);
  const totalNonTaxable = currentReturn.nonTaxableIncomes.reduce((sum, n) => sum + (n.amount || 0), 0);

  // Real stored monthly billings for this return's tax year (aligned with Riwayat Pelaporan)
  const storedBillingsByYear = useMemo(() => getStoredMonthlyBillings(), []);
  const yearMonthlyBillings = storedBillingsByYear[currentReturn.taxYear] || [];
  const billingTotalGross = yearMonthlyBillings.reduce((sum, b) => sum + (b.grossRevenue || 0), 0);
  const billingTotalPph = yearMonthlyBillings.reduce((sum, b) => sum + (b.pphFinalPaid || 0), 0);
  const billingTotalDpp = yearMonthlyBillings.reduce((sum, b) => sum + (b.taxableBaseDpp || 0), 0);
  const grossUmkmTotal = billingTotalGross > 0 ? billingTotalGross : (currentReturn.businessActivity?.grossRevenue || 0);
  const umkmTaxTotal = billingTotalPph > 0 ? billingTotalPph : (currentReturn.businessActivity?.umkmTaxAmount || 0);
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Helper to trigger physical print / PDF export
  const handlePrint = () => {
    document.body.classList.add('printing-djp-tax-doc');
    const cleanup = () => {
      document.body.classList.remove('printing-djp-tax-doc');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2000);
  };

  // Copy plain text summary
  const handleCopySummary = () => {
    const summaryText = `=== SPT TAHUNAN PPh ORANG PRIBADI (FORMULIR 1770) ===
Tahun Pajak: ${currentReturn.taxYear}
Wajib Pajak: ${taxpayer.fullName}
NPWP: ${taxpayer.npwp}
NIK: ${taxpayer.nik}
Status PTKP: ${taxpayer.ptkpStatus} (${formatRupiah(currentReturn.ptkpAmount)})
Status SPT: ${currentReturn.sptType} ${currentReturn.amendmentNumber > 0 ? `(Pembetulan ke-${currentReturn.amendmentNumber})` : '(Normal)'}
--------------------------------------------------
Penghasilan Neto Total: ${formatRupiah(currentReturn.totalNetIncome)}
Penghasilan Kena Pajak (PKP): ${formatRupiah(currentReturn.taxableIncome)}
PPh Terutang (Pasal 17 UU HPP): ${formatRupiah(currentReturn.totalTaxPayable)}
Total Kredit Pajak: ${formatRupiah(currentReturn.totalTaxCredits)}
Status Selesai: ${currentReturn.settlementStatus} (${formatRupiah(currentReturn.taxDifferenceAmount)})
Total Harta Akhir Tahun: ${formatRupiah(totalAssetsValue)} (${currentReturn.assets.length} item)
Total Utang Akhir Tahun: ${formatRupiah(totalDebtsValue)} (${currentReturn.debts.length} item)
Peredaran Bruto UMKM PP 55: ${formatRupiah(grossUmkmTotal)}
==================================================`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download raw JSON
  const handleDownloadJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(
        {
          meta: {
            title: 'SPT Tahunan PPh Orang Pribadi Formulir 1770',
            exportedAt: new Date().toISOString(),
            app: 'AI Studio Build - BEJO Digital Print',
            regulations: 'UU HPP No 7/2021 & PP 55/2022',
          },
          taxpayer,
          taxReturn: currentReturn,
        },
        null,
        2
      )
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `SPT_1770_${taxpayer.fullName.replace(/\s+/g, '_')}_${currentReturn.taxYear}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 print:space-y-0 print:m-0 print:p-0">
      {/* Print Controls / Action Bar (Hidden during printing) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Kembali"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Format Cetak Dokumen Formulir 1770 & Lampiran I-IV
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold font-mono">
                  STANDAR RESMI DJP
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dokumen siap dicetak fisik atau disimpan ke format PDF (Ukuran standar A4) untuk arsip dan pelaporan resmi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? 'Tersalin!' : 'Salin Ringkasan'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJSON}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Unduh JSON</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Ekspor PDF</span>
            </button>
          </div>
        </div>

        {/* Tab Selection Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'all', label: 'Cetak Semua Lembar (Lengkap)' },
              { id: 'induk', label: 'Induk 1770' },
              { id: 'lampiran1', label: 'Lampiran I (Usaha & Gaji)' },
              { id: 'lampiran2', label: 'Lampiran II (Kredit Pajak)' },
              { id: 'lampiran3', label: 'Lampiran III (Final & Non-Objek)' },
              { id: 'lampiran4', label: 'Lampiran IV (Harta & Utang)' },
              { id: 'rekap_pp55', label: 'Rekap Omzet PP 55' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as PrintTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium">Mode Pratinjau Kertas A4:</span>
            <button
              type="button"
              onClick={() => setIsA4Preview(!isA4Preview)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                isA4Preview
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {isA4Preview ? 'Aktif (Kertas A4)' : 'Lebar Penuh'}
            </button>
          </div>
        </div>

        {/* Informational Notification */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Petunjuk Cetak / Simpan PDF Sesuai Standar DJP:</strong> Dokumen diformat khusus hanya mencetak formulir SPT 1770 & Lampiran resmi tanpa elemen web/navigasi. Pada dialog cetak browser, pilih printer <strong>"Save as PDF"</strong> atau printer fisik ukuran kertas <strong>A4</strong>. Pastikan opsi <em>"Background graphics"</em> dicentang.
          </div>
        </div>
      </div>

      {/* PRINT STYLESHEET (Included for native browser print) */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm 8mm 8mm 8mm;
        }
        @media print {
          html, body {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 11px !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #root, main {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          nav, header, aside, footer, .no-print, [role="navigation"], .ai-assistant-widget, .BackendErrorBanner {
            display: none !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          #tax-official-print-container,
          .tax-official-print-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: visible !important;
          }
          #tax-official-print-container *,
          .tax-official-print-root * {
            visibility: visible !important;
          }
          .print-sheet {
            display: block !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            border-radius: 0 !important;
            margin: 0 0 10mm 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 8mm 10mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
            margin-bottom: 0 !important;
          }
          .print-sheet table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .print-sheet tr, .print-sheet td, .print-sheet th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* DOCUMENT PREVIEW CONTAINER */}
      <div
        id="tax-official-print-container"
        className={`tax-official-print-root mx-auto space-y-8 print:space-y-0 print:w-full print:max-w-none ${isA4Preview ? 'max-w-[840px]' : 'w-full'}`}
      >

        {/* ========================================================================= */}
        {/* LEMBAR 1: FORMULIR INDUK 1770 (HALAMAN 1 & 2) */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'induk') && (
          <div className="print-sheet bg-white border-2 border-slate-900 p-6 sm:p-8 rounded-xl shadow-lg font-sans text-slate-900 text-xs">
            {/* Top Official DJP Header */}
            <div className="grid grid-cols-12 border-2 border-slate-900 divide-x-2 divide-slate-900">
              <div className="col-span-3 p-2.5 flex flex-col justify-center items-center text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                  KEMENTERIAN KEUANGAN RI
                </div>
                <div className="text-[11px] font-black uppercase text-slate-900 mt-0.5">
                  DIREKTORAT JENDERAL PAJAK
                </div>
                <div className="w-10 h-0.5 bg-slate-900 my-1" />
                <div className="text-[8.5px] text-slate-600 font-mono">
                  KANTOR PELAYANAN PAJAK
                </div>
              </div>

              <div className="col-span-6 p-2.5 text-center flex flex-col justify-center">
                <div className="text-sm font-black tracking-wider uppercase">
                  FORMULIR 1770
                </div>
                <div className="text-xs font-extrabold uppercase mt-0.5">
                  SURAT PEMBERITAHUAN (SPT) TAHUNAN
                </div>
                <div className="text-[10px] font-bold uppercase text-slate-800">
                  PAJAK PENGHASILAN WAJIB PAJAK ORANG PRIBADI
                </div>
                <div className="text-[8.5px] text-slate-500 mt-1 italic leading-tight">
                  (Bagi Wajib Pajak yang mempunyai penghasilan dari usaha/pekerjaan bebas, satu/lebih pemberi kerja, PPh Final, dan/atau penghasilan lainnya)
                </div>
              </div>

              <div className="col-span-3 p-2.5 flex flex-col justify-center text-center space-y-1">
                <div className="text-[10px] font-bold uppercase">TAHUN PAJAK</div>
                <div className="inline-flex justify-center items-center gap-1 font-mono font-black text-base border-2 border-slate-900 bg-slate-50 px-2 py-0.5 mx-auto">
                  <span>{currentReturn.taxYear}</span>
                </div>
                <div className="text-[9px] text-slate-700">
                  Periode: <strong>01 s.d 12</strong>
                </div>
                <div className="text-[9px] font-semibold">
                  SPT: <strong>{currentReturn.sptType} {currentReturn.amendmentNumber > 0 ? `(${currentReturn.amendmentNumber})` : ''}</strong>
                </div>
              </div>
            </div>

            {/* IDENTITAS WAJIB PAJAK */}
            <div className="mt-3 border-2 border-slate-900">
              <div className="bg-slate-900 text-white px-3 py-1 font-bold text-[11px] tracking-wide flex justify-between">
                <span>IDENTITAS WAJIB PAJAK</span>
                <span className="text-[10px] text-slate-300 font-mono">ISIKAN DENGAN HURUF CETAK / STANDAR SISTEM</span>
              </div>

              <div className="p-3 space-y-2 bg-white text-[11px]">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-3 font-bold text-slate-700">1. NPWP (16 Digit NIK/NPWP):</span>
                  <div className="col-span-9 font-mono font-bold text-xs tracking-wider border border-slate-400 p-1.5 bg-slate-50 rounded">
                    {taxpayer.npwp} &nbsp; / &nbsp; NIK: {taxpayer.nik}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-3 font-bold text-slate-700">2. NAMA WAJIB PAJAK:</span>
                  <div className="col-span-9 font-bold text-xs uppercase border border-slate-400 p-1.5 bg-slate-50 rounded">
                    {taxpayer.fullName}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-3 font-bold text-slate-700">3. JENIS USAHA / KLU:</span>
                  <div className="col-span-9 flex items-center justify-between border border-slate-400 p-1.5 bg-slate-50 rounded">
                    <span className="font-semibold">{taxpayer.kluDescription || 'Perdagangan Eceran Hasil Percetakan dan Penerbitan'}</span>
                    <span className="font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-[10px]">KLU: {taxpayer.kluCode}</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-3 font-bold text-slate-700">4. ALAMAT LENGKAP & NO. TELP:</span>
                  <div className="col-span-9 border border-slate-400 p-1.5 bg-slate-50 rounded flex justify-between">
                    <span>{taxpayer.address}, {taxpayer.city} {taxpayer.postalCode}</span>
                    <span className="font-mono text-[10px]">Telp: {taxpayer.phoneNumber}</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-3 font-bold text-slate-700">5. STATUS PERPAJAKAN SUAMI-ISTRI:</span>
                  <div className="col-span-9 flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      {taxpayer.maritalTaxStatus === 'KK' ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4 text-slate-400" />}
                      <span>KK (Kepala Keluarga)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {taxpayer.maritalTaxStatus === 'HB' ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4 text-slate-400" />}
                      <span>HB (Hidup Berpisah)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {taxpayer.maritalTaxStatus === 'PH' ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4 text-slate-400" />}
                      <span>PH (Pisah Harta)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {taxpayer.maritalTaxStatus === 'MT' ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4 text-slate-400" />}
                      <span>MT (Memilih Terpisah)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* TABEL BAGIAN A: PENGHASILAN NETO */}
            <div className="mt-3 border-2 border-slate-900">
              <div className="bg-slate-800 text-white px-3 py-1 font-bold text-[11px] flex justify-between">
                <span>BAGIAN A. PENGHASILAN NETO</span>
                <span>(RUPIAH)</span>
              </div>

              <div className="divide-y divide-slate-300 text-[11px]">
                <div className="p-2 flex justify-between items-center bg-white">
                  <div className="max-w-[75%]">
                    <strong>1.</strong> Penghasilan Neto Dalam Negeri dari Usaha dan/atau Pekerjaan Bebas <em>(Lampiran 1770-I Bagian A / Bagian B)</em>
                  </div>
                  <div className="font-mono font-bold text-right">
                    {formatRupiah(currentReturn.businessActivity?.netIncomeCalculated || 0)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-slate-50/50">
                  <div className="max-w-[75%]">
                    <strong>2.</strong> Penghasilan Neto Dalam Negeri Sehubungan Dengan Pekerjaan <em>(Lampiran 1770-I Bagian C)</em>
                  </div>
                  <div className="font-mono font-bold text-right">
                    {formatRupiah(currentReturn.employmentNetIncome || 0)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-white">
                  <div className="max-w-[75%]">
                    <strong>3.</strong> Penghasilan Neto Dalam Negeri Lainnya <em>(Lampiran 1770-I Bagian D)</em>
                  </div>
                  <div className="font-mono font-bold text-right">
                    {formatRupiah(currentReturn.otherDomesticNetIncome || 0)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-slate-50/50">
                  <div className="max-w-[75%]">
                    <strong>4.</strong> Penghasilan Neto Luar Negeri
                  </div>
                  <div className="font-mono font-bold text-right">
                    {formatRupiah(currentReturn.foreignNetIncome || 0)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-blue-50/40 font-bold border-t border-slate-400">
                  <div>
                    <strong>5. JUMLAH PENGHASILAN NETO (1 + 2 + 3 + 4)</strong>
                  </div>
                  <div className="font-mono text-xs">
                    {formatRupiah(currentReturn.totalNetIncome)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-white">
                  <div className="max-w-[75%]">
                    <strong>6.</strong> Zakat / Sumbangan Keagamaan yang Sifatnya Wajib
                  </div>
                  <div className="font-mono font-bold text-right">
                    {formatRupiah(currentReturn.deductions?.zakatOrReligiousCharity || 0)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-blue-50/40 font-bold border-t border-slate-400">
                  <div>
                    <strong>7. JUMLAH PENGHASILAN NETO SETELAH PENGURANGAN ZAKAT (5 - 6)</strong>
                  </div>
                  <div className="font-mono text-xs">
                    {formatRupiah(currentReturn.netIncomeAfterDeductions)}
                  </div>
                </div>
              </div>
            </div>

            {/* TABEL BAGIAN B: PENGHASILAN KENA PAJAK */}
            <div className="mt-3 border-2 border-slate-900">
              <div className="bg-slate-800 text-white px-3 py-1 font-bold text-[11px] flex justify-between">
                <span>BAGIAN B. PENGHASILAN KENA PAJAK</span>
                <span>(RUPIAH)</span>
              </div>

              <div className="divide-y divide-slate-300 text-[11px]">
                <div className="p-2 flex justify-between items-center bg-white">
                  <div className="max-w-[75%]">
                    <strong>8.</strong> Kompensasi Kerugian
                  </div>
                  <div className="font-mono font-bold text-right">
                    {formatRupiah(currentReturn.deductions?.pastLossCarryForward || 0)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-slate-50/50">
                  <div className="max-w-[75%]">
                    <strong>9.</strong> Jumlah Penghasilan Neto Setelah Kompensasi Kerugian (7 - 8)
                  </div>
                  <div className="font-mono font-bold text-right">
                    {formatRupiah(currentReturn.netIncomeAfterDeductions)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-white">
                  <div className="max-w-[75%]">
                    <strong>10.</strong> Penghasilan Tidak Kena Pajak (PTKP): Status <strong>{taxpayer.ptkpStatus}</strong>
                  </div>
                  <div className="font-mono font-bold text-emerald-800 text-right">
                    {formatRupiah(currentReturn.ptkpAmount)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-indigo-50/50 font-black border-t-2 border-slate-500">
                  <div>
                    <strong>11. PENGHASILAN KENA PAJAK (PKP) (9 - 10)</strong> <span className="text-[9px] font-normal italic">(Dibulatkan ke ribuan penuh ke bawah)</span>
                  </div>
                  <div className="font-mono text-sm text-indigo-950">
                    {formatRupiah(currentReturn.taxableIncome)}
                  </div>
                </div>
              </div>
            </div>

            {/* TABEL BAGIAN C & D: PPh TERUTANG & KREDIT PAJAK */}
            <div className="mt-3 border-2 border-slate-900">
              <div className="bg-slate-800 text-white px-3 py-1 font-bold text-[11px] flex justify-between">
                <span>BAGIAN C & D. PPh TERUTANG & KREDIT PAJAK</span>
                <span>(RUPIAH)</span>
              </div>

              <div className="divide-y divide-slate-300 text-[11px]">
                <div className="p-2 flex justify-between items-center bg-white">
                  <div className="max-w-[75%]">
                    <strong>12.</strong> PPh Terutang (Tarif Pasal 17 UU PPh / UU HPP No 7 Tahun 2021)
                  </div>
                  <div className="font-mono font-bold text-right text-indigo-800">
                    {formatRupiah(currentReturn.totalTaxPayable)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-slate-50/50">
                  <div className="max-w-[75%]">
                    <strong>13.</strong> Pengembalian / Pengurangan PPh Luar Negeri (Pasal 24)
                  </div>
                  <div className="font-mono font-bold text-right">
                    Rp 0
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-blue-50/40 font-bold">
                  <div>
                    <strong>14. JUMLAH PPh TERUTANG (12 - 13)</strong>
                  </div>
                  <div className="font-mono text-xs text-blue-900">
                    {formatRupiah(currentReturn.totalTaxPayable)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-white">
                  <div className="max-w-[75%]">
                    <strong>15.</strong> PPh Yang Dipotong/Dipungut Pihak Lain <em>(Lampiran 1770-II)</em>
                  </div>
                  <div className="font-mono font-bold text-right text-emerald-800">
                    {formatRupiah(totalWithholdingAmount)}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-slate-50/50">
                  <div className="max-w-[75%]">
                    <strong>16.</strong> PPh Yang Harus Dibayar Sendiri (14 - 15)
                  </div>
                  <div className="font-mono font-bold text-right">
                    {formatRupiah(Math.max(0, currentReturn.totalTaxPayable - totalWithholdingAmount))}
                  </div>
                </div>

                <div className="p-2 flex justify-between items-center bg-white">
                  <div className="max-w-[75%]">
                    <strong>17.</strong> PPh Yang Dibayar Sendiri (PPh Pasal 25 Bulanan & STP)
                  </div>
                  <div className="font-mono font-bold text-right">
                    {formatRupiah(currentReturn.pph25PaidYearly + currentReturn.stpPph25Principal)}
                  </div>
                </div>

                {/* STATUS KURANG BAYAR / LEBIH BAYAR (BAGIAN E) */}
                <div className="p-3 flex justify-between items-center bg-slate-100 border-t-2 border-slate-900 text-xs font-black">
                  <div>
                    <strong>19. PPh YANG KURANG / (LEBIH) DIBAYAR (Pasal 29 / 28A):</strong>
                  </div>
                  <div className={`font-mono text-sm px-2 py-0.5 rounded border ${
                    currentReturn.settlementStatus === 'KURANG_BAYAR'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : currentReturn.settlementStatus === 'LEBIH_BAYAR'
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}>
                    {currentReturn.settlementStatus} : {formatRupiah(currentReturn.taxDifferenceAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* BAGIAN G: LAMPIRAN & PERNYATAAN */}
            <div className="mt-3 grid grid-cols-12 gap-3 border-2 border-slate-900 p-3 bg-white">
              <div className="col-span-7 space-y-1.5 border-r border-slate-300 pr-3">
                <div className="font-bold text-[11px] uppercase pb-1 border-b border-slate-200">
                  LAMPIRAN-LAMPIRAN YANG DISERTAKAN:
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <span className="flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                    <span>Formulir 1770 - I</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                    <span>Formulir 1770 - II</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                    <span>Formulir 1770 - III</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                    <span>Formulir 1770 - IV</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                    <span>Rekap Omzet PP 55</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                    <span>Bukti Potong PPh</span>
                  </span>
                </div>
              </div>

              <div className="col-span-5 text-center flex flex-col justify-between">
                <div className="text-[10px] leading-tight text-slate-700 italic">
                  "Dengan menyadari sepenuhnya akan segala akibatnya, saya menyatakan apa yang telah saya beritahukan di atas beserta lampiran-lampirannya adalah benar, lengkap dan jelas."
                </div>

                <div className="mt-4 pt-2">
                  <div className="text-[10px] font-semibold text-slate-700">
                    {taxpayer.city || 'Jombang'}, 31 Maret {currentReturn.taxYear + 1}
                  </div>
                  <div className="text-[9px] uppercase text-slate-500 mt-1">WAJIB PAJAK / PENANDA TANGAN:</div>
                  <div className="font-black text-xs uppercase underline tracking-wider mt-6">
                    {taxpayer.fullName}
                  </div>
                  <div className="text-[9px] font-mono text-slate-600">NPWP: {taxpayer.npwp}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* LEMBAR 2: LAMPIRAN I (FORMULIR 1770 - I) */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'lampiran1') && (
          <div className="print-sheet bg-white border-2 border-slate-900 p-6 sm:p-8 rounded-xl shadow-lg font-sans text-slate-900 text-xs">
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-600">LAMPIRAN I FORMULIR 1770</div>
                <h3 className="text-sm font-black uppercase">
                  PENGHASILAN NETO DALAM NEGERI DARI USAHA DAN/ATAU PEKERJAAN BEBAS & PEKERJAAN
                </h3>
              </div>
              <div className="text-right font-mono">
                <div className="text-[10px] font-bold">TAHUN PAJAK {currentReturn.taxYear}</div>
                <div className="text-[9px] text-slate-500">FORM 1770 - I</div>
              </div>
            </div>

            <div className="text-[10px] font-mono mb-3 bg-slate-50 p-2 border border-slate-300 rounded flex justify-between">
              <span>NAMA: <strong>{taxpayer.fullName}</strong></span>
              <span>NPWP: <strong>{taxpayer.npwp}</strong></span>
            </div>

            {/* Bagian B: Pencatatan / Norma */}
            <div className="border border-slate-900 mb-4">
              <div className="bg-slate-800 text-white px-2 py-1 font-bold text-[10px] uppercase">
                BAGIAN B : PENGHASILAN NETO USAHA / PEKERJAAN BEBAS (PENCATATAN / NORMA NPPN)
              </div>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 font-bold">
                    <th className="p-1.5 border-r border-slate-300 text-left">Jenis Usaha</th>
                    <th className="p-1.5 border-r border-slate-300 text-right">Peredaran Usaha (Rp)</th>
                    <th className="p-1.5 border-r border-slate-300 text-center">Norma (%)</th>
                    <th className="p-1.5 text-right">Penghasilan Neto (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {currentReturn.businessActivity?.grossRevenue > 0 ? (
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 border-r border-slate-200 font-medium">
                        1. {taxpayer.kluDescription || 'Perdagangan Eceran Hasil Percetakan dan Penerbitan'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">
                        {formatRupiah(currentReturn.businessActivity?.grossRevenue || 0)}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono">
                        {currentReturn.businessActivity?.isUmkmPp55 ? 'PP 55 (0.5%)' : `${currentReturn.businessActivity?.nppnRatePercent || 20}%`}
                      </td>
                      <td className="p-1.5 text-right font-mono font-bold">
                        {formatRupiah(currentReturn.businessActivity?.netIncomeCalculated || 0)}
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-b border-slate-200">
                      <td colSpan={4} className="p-2 text-center text-slate-500 italic">
                        Tidak ada peredaran usaha norma / pencatatan yang dilaporkan (Nihil)
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3} className="p-1.5 text-right border-r border-slate-300">
                      JUMLAH BAGIAN B:
                    </td>
                    <td className="p-1.5 text-right font-mono">
                      {formatRupiah(currentReturn.businessActivity?.netIncomeCalculated || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bagian C: Pekerjaan */}
            <div className="border border-slate-900 mb-4">
              <div className="bg-slate-800 text-white px-2 py-1 font-bold text-[10px] uppercase">
                BAGIAN C : PENGHASILAN NETO DALAM NEGERI SEHUBUNGAN DENGAN PEKERJAAN
              </div>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 font-bold">
                    <th className="p-1.5 border-r border-slate-300 text-left">Nama & NPWP Pemberi Kerja</th>
                    <th className="p-1.5 border-r border-slate-300 text-right">Penghasilan Bruto (Rp)</th>
                    <th className="p-1.5 border-r border-slate-300 text-right">Pengurangan (Rp)</th>
                    <th className="p-1.5 text-right">Penghasilan Neto (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {currentReturn.employmentGrossIncome > 0 ? (
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 border-r border-slate-200">
                        {taxpayer.employerName || 'Pemberi Kerja'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">
                        {formatRupiah(currentReturn.employmentGrossIncome || 0)}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">
                        {formatRupiah(currentReturn.employmentDeductions || 0)}
                      </td>
                      <td className="p-1.5 text-right font-mono font-bold">
                        {formatRupiah(currentReturn.employmentNetIncome || 0)}
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-b border-slate-200">
                      <td colSpan={4} className="p-2 text-center text-slate-500 italic">
                        Tidak ada penghasilan neto dari pekerjaan (Nihil)
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3} className="p-1.5 text-right border-r border-slate-300">
                      JUMLAH BAGIAN C:
                    </td>
                    <td className="p-1.5 text-right font-mono">
                      {formatRupiah(currentReturn.employmentNetIncome || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bagian D: Penghasilan Neto Lainnya */}
            <div className="border border-slate-900">
              <div className="bg-slate-800 text-white px-2 py-1 font-bold text-[10px] uppercase">
                BAGIAN D : PENGHASILAN NETO DALAM NEGERI LAINNYA
              </div>
              <div className="p-2 space-y-1 text-[10px]">
                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span>1. Bunga, Royalti, dan Sewa Harta:</span>
                  <span className="font-mono">Rp 0</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span>2. Hadiah, Penghargaan, dan Keuntungan Penjualan/Pengalihan Harta:</span>
                  <span className="font-mono">Rp 0</span>
                </div>
                <div className="flex justify-between py-1 bg-slate-50 font-bold">
                  <span>JUMLAH BAGIAN D (Pindah ke Induk Baris 3):</span>
                  <span className="font-mono">{formatRupiah(currentReturn.otherDomesticNetIncome || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* LEMBAR 3: LAMPIRAN II (FORMULIR 1770 - II) */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'lampiran2') && (
          <div className="print-sheet bg-white border-2 border-slate-900 p-6 sm:p-8 rounded-xl shadow-lg font-sans text-slate-900 text-xs">
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-600">LAMPIRAN II FORMULIR 1770</div>
                <h3 className="text-sm font-black uppercase">
                  DAFTAR PEMOTONGAN / PEMUNGUTAN PPh OLEH PIHAK LAIN & PPh DITANGGUNG PEMERINTAH (DTP)
                </h3>
              </div>
              <div className="text-right font-mono">
                <div className="text-[10px] font-bold">TAHUN PAJAK {currentReturn.taxYear}</div>
                <div className="text-[9px] text-slate-500">FORM 1770 - II</div>
              </div>
            </div>

            <div className="text-[10px] font-mono mb-3 bg-slate-50 p-2 border border-slate-300 rounded flex justify-between">
              <span>NAMA: <strong>{taxpayer.fullName}</strong></span>
              <span>NPWP: <strong>{taxpayer.npwp}</strong></span>
            </div>

            <div className="border border-slate-900">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white border-b border-slate-900 text-center font-bold">
                    <th className="p-2 border-r border-slate-700 w-8">No</th>
                    <th className="p-2 border-r border-slate-700 text-left">Nama Pemotong / Pemungut Pajak</th>
                    <th className="p-2 border-r border-slate-700 text-left">NPWP Pemotong</th>
                    <th className="p-2 border-r border-slate-700">Nomor & Tgl Bukti Potong</th>
                    <th className="p-2 border-r border-slate-700">Jenis Pajak</th>
                    <th className="p-2 text-right">Jumlah PPh Dipotong (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentReturn.withholdings.length > 0 ? (
                    currentReturn.withholdings.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200 font-semibold">{item.withholderName}</td>
                        <td className="p-2 border-r border-slate-200 font-mono text-[9px]">{item.withholderNpwp}</td>
                        <td className="p-2 border-r border-slate-200 font-mono text-[9px] text-center">{item.taxSlipNumber} ({item.taxSlipDate})</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">{item.taxType}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">{formatRupiah(item.withheldTaxAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                        Tidak ada pemotongan/pemungutan PPh oleh pihak lain pada Tahun Pajak ini.
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={5} className="p-2 text-right border-r border-slate-300">
                      TOTAL KREDIT PAJAK DIPOTONG PIHAK LAIN (Pindah ke Induk Baris 15):
                    </td>
                    <td className="p-2 text-right font-mono text-xs text-emerald-800">
                      {formatRupiah(totalWithholdingAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* LEMBAR 4: LAMPIRAN III (FORMULIR 1770 - III) */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'lampiran3') && (
          <div className="print-sheet bg-white border-2 border-slate-900 p-6 sm:p-8 rounded-xl shadow-lg font-sans text-slate-900 text-xs">
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-600">LAMPIRAN III FORMULIR 1770</div>
                <h3 className="text-sm font-black uppercase">
                  PENGHASILAN YANG DIKENAKAN PAJAK FINAL DAN/ATAU BERSIFAT FINAL & NON-OBJEK PAJAK
                </h3>
              </div>
              <div className="text-right font-mono">
                <div className="text-[10px] font-bold">TAHUN PAJAK {currentReturn.taxYear}</div>
                <div className="text-[9px] text-slate-500">FORM 1770 - III</div>
              </div>
            </div>

            <div className="text-[10px] font-mono mb-3 bg-slate-50 p-2 border border-slate-300 rounded flex justify-between">
              <span>NAMA: <strong>{taxpayer.fullName}</strong></span>
              <span>NPWP: <strong>{taxpayer.npwp}</strong></span>
            </div>

            {/* Bagian A: PPh Final */}
            <div className="border border-slate-900 mb-4">
              <div className="bg-slate-800 text-white px-2 py-1 font-bold text-[10px] uppercase">
                BAGIAN A : PENGHASILAN YANG DIKENAKAN PAJAK FINAL
              </div>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 font-bold">
                    <th className="p-1.5 border-r border-slate-300 w-8 text-center">No</th>
                    <th className="p-1.5 border-r border-slate-300 text-left">Sumber / Jenis Penghasilan</th>
                    <th className="p-1.5 border-r border-slate-300 text-right">Dasar Pengenaan Pajak (Rp)</th>
                    <th className="p-1.5 border-r border-slate-300 text-center">Tarif</th>
                    <th className="p-1.5 text-right">PPh Terutang (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono">1</td>
                    <td className="p-1.5 border-r border-slate-200">Bunga Deposito, Tabungan, Diskonto SBI</td>
                    <td className="p-1.5 border-r border-slate-200 text-right font-mono">Rp 0</td>
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono">20%</td>
                    <td className="p-1.5 text-right font-mono">Rp 0</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono">2</td>
                    <td className="p-1.5 border-r border-slate-200">Dividen</td>
                    <td className="p-1.5 border-r border-slate-200 text-right font-mono">Rp 0</td>
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono">10%</td>
                    <td className="p-1.5 text-right font-mono">Rp 0</td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold">16</td>
                    <td className="p-1.5 border-r border-slate-200 font-bold">
                      Penghasilan Usaha Peredaran Bruto Tertentu (PP No. 55 Th 2022 - UMKM BEJO Digital Print)
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold">
                      {formatRupiah(currentReturn.businessActivity?.umkmTaxableRevenue || 0)}
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold">0.5%</td>
                    <td className="p-1.5 text-right font-mono font-bold text-amber-900">
                      {formatRupiah(currentReturn.businessActivity?.umkmTaxAmount || 0)}
                    </td>
                  </tr>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={2} className="p-1.5 text-right border-r border-slate-300">
                      JUMLAH PPh FINAL (BAGIAN A):
                    </td>
                    <td className="p-1.5 text-right font-mono border-r border-slate-300">
                      {formatRupiah(totalFinalGross || currentReturn.businessActivity?.umkmTaxableRevenue || 0)}
                    </td>
                    <td className="border-r border-slate-300" />
                    <td className="p-1.5 text-right font-mono text-xs">
                      {formatRupiah(totalFinalTax || currentReturn.businessActivity?.umkmTaxAmount || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bagian B: Non-Objek Pajak */}
            <div className="border border-slate-900">
              <div className="bg-slate-800 text-white px-2 py-1 font-bold text-[10px] uppercase">
                BAGIAN B : PENGHASILAN YANG TIDAK TERMASUK OBJEK PAJAK
              </div>
              <div className="p-2 space-y-1 text-[10px]">
                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span>1. Bantuan / Sumbangan / Zakat yang Diterima Lembaga Resmi:</span>
                  <span className="font-mono">Rp 0</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span>2. Warisan:</span>
                  <span className="font-mono">Rp 0</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span>3. Bagian Laba Anggota Perseroan Komanditer (CV) / Firma:</span>
                  <span className="font-mono">Rp 0</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span>4. Klaim Asuransi Kesehatan, Kecelakaan, Jiwa, dan Beasiswa:</span>
                  <span className="font-mono">Rp 0</span>
                </div>
                <div className="flex justify-between py-1 bg-slate-50 font-bold">
                  <span>JUMLAH PENGHASILAN NON-OBJEK (BAGIAN B):</span>
                  <span className="font-mono">{formatRupiah(totalNonTaxable)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* LEMBAR 5: LAMPIRAN IV (FORMULIR 1770 - IV) */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'lampiran4') && (
          <div className="print-sheet bg-white border-2 border-slate-900 p-6 sm:p-8 rounded-xl shadow-lg font-sans text-slate-900 text-xs">
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-600">LAMPIRAN IV FORMULIR 1770</div>
                <h3 className="text-sm font-black uppercase">
                  HARTA PADA AKHIR TAHUN, KEWAJIBAN / UTANG & DAFTAR TANGGUNGAN KELUARGA
                </h3>
              </div>
              <div className="text-right font-mono">
                <div className="text-[10px] font-bold">TAHUN PAJAK {currentReturn.taxYear}</div>
                <div className="text-[9px] text-slate-500">FORM 1770 - IV</div>
              </div>
            </div>

            <div className="text-[10px] font-mono mb-3 bg-slate-50 p-2 border border-slate-300 rounded flex justify-between">
              <span>NAMA: <strong>{taxpayer.fullName}</strong></span>
              <span>NPWP: <strong>{taxpayer.npwp}</strong></span>
            </div>

            {/* Bagian A: Harta Pada Akhir Tahun */}
            <div className="border border-slate-900 mb-4">
              <div className="bg-slate-800 text-white px-2 py-1 font-bold text-[10px] uppercase flex justify-between">
                <span>BAGIAN A : HARTA PADA AKHIR TAHUN ({currentReturn.assets.length} Item)</span>
                <span>TOTAL: {formatRupiah(totalAssetsValue)}</span>
              </div>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 font-bold">
                    <th className="p-1.5 border-r border-slate-300 w-8 text-center">No</th>
                    <th className="p-1.5 border-r border-slate-300 text-center w-14">Kode</th>
                    <th className="p-1.5 border-r border-slate-300 text-left">Nama Harta</th>
                    <th className="p-1.5 border-r border-slate-300 text-center w-16">Tahun</th>
                    <th className="p-1.5 border-r border-slate-300 text-right">Harga Perolehan (Rp)</th>
                    <th className="p-1.5 text-left">Keterangan / Lokasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentReturn.assets.map((asset, idx) => (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold bg-slate-50">{asset.code}</td>
                      <td className="p-1.5 border-r border-slate-200 font-semibold">{asset.name}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono">{asset.acquisitionYear}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold">{formatRupiah(asset.acquisitionPrice)}</td>
                      <td className="p-1.5 text-slate-600 text-[9px]">{asset.description || '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={4} className="p-1.5 text-right border-r border-slate-300">
                      JUMLAH BAGIAN A (TOTAL HARTA):
                    </td>
                    <td className="p-1.5 text-right font-mono text-xs text-blue-900 border-r border-slate-300">
                      {formatRupiah(totalAssetsValue)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bagian B: Kewajiban / Utang */}
            <div className="border border-slate-900 mb-4">
              <div className="bg-slate-800 text-white px-2 py-1 font-bold text-[10px] uppercase flex justify-between">
                <span>BAGIAN B : KEWAJIBAN / UTANG PADA AKHIR TAHUN ({currentReturn.debts.length} Item)</span>
                <span>TOTAL: {formatRupiah(totalDebtsValue)}</span>
              </div>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 font-bold">
                    <th className="p-1.5 border-r border-slate-300 w-8 text-center">No</th>
                    <th className="p-1.5 border-r border-slate-300 text-center w-14">Kode</th>
                    <th className="p-1.5 border-r border-slate-300 text-left">Nama Pemberi Pinjaman</th>
                    <th className="p-1.5 border-r border-slate-300 text-left">Alamat Pemberi Pinjaman</th>
                    <th className="p-1.5 border-r border-slate-300 text-center w-16">Tahun</th>
                    <th className="p-1.5 text-right">Jumlah Sisa Utang (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentReturn.debts.map((debt, idx) => (
                    <tr key={debt.id} className="hover:bg-slate-50">
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold bg-slate-50">{debt.code}</td>
                      <td className="p-1.5 border-r border-slate-200 font-semibold">{debt.lenderName}</td>
                      <td className="p-1.5 border-r border-slate-200 text-slate-600 text-[9px]">{debt.lenderAddress}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono">{debt.borrowingYear}</td>
                      <td className="p-1.5 text-right font-mono font-bold text-amber-900">{formatRupiah(debt.endingBalance)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={5} className="p-1.5 text-right border-r border-slate-300">
                      JUMLAH BAGIAN B (TOTAL UTANG):
                    </td>
                    <td className="p-1.5 text-right font-mono text-xs text-amber-950">
                      {formatRupiah(totalDebtsValue)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bagian C: Tanggungan Keluarga */}
            <div className="border border-slate-900">
              <div className="bg-slate-800 text-white px-2 py-1 font-bold text-[10px] uppercase flex justify-between">
                <span>BAGIAN C : DAFTAR ANGGOTA KELUARGA YANG MENJADI TANGGUNGAN</span>
                <span>STATUS PTKP: {taxpayer.ptkpStatus}</span>
              </div>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 font-bold">
                    <th className="p-1.5 border-r border-slate-300 w-8 text-center">No</th>
                    <th className="p-1.5 border-r border-slate-300 text-left">Nama Anggota Keluarga</th>
                    <th className="p-1.5 border-r border-slate-300 text-left">NIK (Nomor Induk Kependudukan)</th>
                    <th className="p-1.5 border-r border-slate-300 text-left">Hubungan Keluarga</th>
                    <th className="p-1.5 text-left">Pekerjaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentReturn.dependents.map((dep, idx) => (
                    <tr key={dep.id} className="hover:bg-slate-50">
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                      <td className="p-1.5 border-r border-slate-200 font-bold">{dep.fullName}</td>
                      <td className="p-1.5 border-r border-slate-200 font-mono text-[9px]">{dep.nik}</td>
                      <td className="p-1.5 border-r border-slate-200 font-semibold">{dep.relationship}</td>
                      <td className="p-1.5 text-slate-700">{dep.occupation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* LEMBAR 6: LAMPIRAN REKAPITULASI OMZET BULANAN UMKM (PP 55 / 2022) */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'rekap_pp55') && (
          <div className="print-sheet bg-white border-2 border-slate-900 p-6 sm:p-8 rounded-xl shadow-lg font-sans text-slate-900 text-xs">
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-600">LAMPIRAN KHUSUS RESMI DJP</div>
                <h3 className="text-sm font-black uppercase">
                  DAFTAR PEREDARAN BRUTO DAN PEMBAYARAN PPh FINAL (PP NO. 55 TAHUN 2022)
                </h3>
              </div>
              <div className="text-right font-mono">
                <div className="text-[10px] font-bold">TAHUN PAJAK {currentReturn.taxYear}</div>
                <div className="text-[9px] text-amber-800 font-bold">UMKM BEJO Digital Print</div>
              </div>
            </div>

            <div className="text-[10px] font-mono mb-3 bg-amber-50/50 p-2 border border-amber-300 rounded flex justify-between">
              <span>NAMA: <strong>{taxpayer.fullName}</strong></span>
              <span>NPWP: <strong>{taxpayer.npwp}</strong></span>
              <span>FASILITAS: <strong>Bebas Pajak s.d Rp 500 Juta</strong></span>
            </div>

            <div className="border border-slate-900">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white border-b border-slate-900 text-center font-bold">
                    <th className="p-2 border-r border-slate-700 w-8">No</th>
                    <th className="p-2 border-r border-slate-700 text-left">Masa Pajak (Bulan)</th>
                    <th className="p-2 border-r border-slate-700 text-right">Peredaran Bruto (Rp)</th>
                    <th className="p-2 border-r border-slate-700 text-right">Kumulatif Omzet (Rp)</th>
                    <th className="p-2 border-r border-slate-700 text-right">DPP Dikenakan (Rp)</th>
                    <th className="p-2 border-r border-slate-700 text-center">Tarif</th>
                    <th className="p-2 text-right">PPh Final Disetor (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {yearMonthlyBillings.length > 0 ? (
                    yearMonthlyBillings.map((b, idx) => (
                      <tr key={b.id || idx} className={b.pphFinalPaid > 0 ? 'bg-amber-50/30' : ''}>
                        <td className="p-1.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                        <td className="p-1.5 border-r border-slate-200 font-medium">
                          {b.monthName} {currentReturn.taxYear}
                          {b.ntpn && <span className="block text-[8px] font-mono text-slate-400">NTPN: {b.ntpn}</span>}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono">{formatRupiah(b.grossRevenue || 0)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono text-slate-600">{formatRupiah(b.cumulativeRevenue || 0)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-amber-900">
                          {formatRupiah(b.taxableBaseDpp || 0)}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-center font-mono">{b.tariffRatePercent || 0.5}%</td>
                        <td className="p-1.5 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(b.pphFinalPaid || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    months.map((m, idx) => (
                      <tr key={m}>
                        <td className="p-1.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                        <td className="p-1.5 border-r border-slate-200 font-medium">{m} {currentReturn.taxYear}</td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono">Rp 0</td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono text-slate-600">Rp 0</td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-amber-900">Rp 0</td>
                        <td className="p-1.5 border-r border-slate-200 text-center font-mono">0.5%</td>
                        <td className="p-1.5 text-right font-mono font-bold text-slate-900">Rp 0</td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={2} className="p-2 text-right border-r border-slate-300">
                      TOTAL SETAHUN (PP 55/2022):
                    </td>
                    <td className="p-2 text-right font-mono text-blue-900 border-r border-slate-300">
                      {formatRupiah(grossUmkmTotal)}
                    </td>
                    <td className="border-r border-slate-300" />
                    <td className="p-2 text-right font-mono text-amber-900 border-r border-slate-300">
                      {formatRupiah(billingTotalDpp || currentReturn.businessActivity?.umkmTaxableRevenue || 0)}
                    </td>
                    <td className="border-r border-slate-300" />
                    <td className="p-2 text-right font-mono text-xs text-indigo-900">
                      {formatRupiah(umkmTaxTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-slate-50 border border-slate-300 rounded text-[10px] text-slate-700 leading-relaxed">
              <strong>Catatan Fasilitas UU Harmonisasi Peraturan Perpajakan (UU HPP):</strong> Sesuai PP No. 55 Tahun 2022 Pasal 60 ayat (2), peredaran bruto dari usaha bagi Wajib Pajak Orang Pribadi sampai dengan <strong>Rp 500.000.000,00</strong> dalam 1 (satu) Tahun Pajak tidak dikenai Pajak Penghasilan. PPh Final 0,5% hanya dihitung dari bagian peredaran bruto yang melebihi ambang batas Rp 500 Juta.
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
