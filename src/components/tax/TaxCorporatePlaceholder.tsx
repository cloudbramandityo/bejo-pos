/**
 * Coded by Langgo Bramandityo.
 * Modul SPT Tahunan PPh Badan (Formulir 1771) - Placeholder
 * Keterangan: modul belum dirilis, tampil sebagai catatan "dalam pengembangan".
 */
import React from 'react';
import { Building2, Code2, Clock, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

export const TaxCorporatePlaceholder: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 shadow-sm text-center max-w-3xl mx-auto my-8">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-6 shadow-xs">
        <Building2 className="w-10 h-10" />
      </div>

      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold tracking-wide uppercase mb-4">
        <Code2 className="w-4 h-4" />
        <span>DALAM PENGEMBANGAN</span>
      </div>

      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
        SPT Tahunan PPh Badan (Formulir 1771)
      </h2>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-center">
        <p className="text-base sm:text-lg font-bold text-slate-800">
          Modul ini belum dirilis
        </p>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Modul SPT Tahunan Badan (PT, CV, Koperasi, Firma) dengan rekonsiliasi fiskal, lampiran I-VI, dan laporan keuangan.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-xl mx-auto mb-8">
        <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Fase Pengembangan</span>
          </div>
          <p className="text-[11px] text-slate-500">Akan dirilis setelah finalisasi modul SPT Orang Pribadi.</p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Formulir 1771</span>
          </div>
          <p className="text-[11px] text-slate-500">Mendukung tarif PPh Badan 22% & Fasilitas Pasal 31E.</p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs mb-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Integrasi POS</span>
          </div>
          <p className="text-[11px] text-slate-500">Omzet akan diambil otomatis dari catatan penjualan dan kas toko.</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <AlertCircle className="w-4 h-4 text-slate-400" />
        <span>Silakan beralih ke modul <strong>SPT Tahunan Orang Pribadi</strong> untuk pelaporan pajak aktif.</span>
      </div>
    </div>
  );
};
