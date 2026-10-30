/**
 * Coded by Langgo Bramandityo.
 * Submenu 13: Pengaturan Pajak & Parameter Resmi Perpajakan Indonesia
 * Sesuai UU HPP No 7/2021 & PP 55/2022
 */
import React from 'react';
import { TAX_CONFIG_2025 } from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import { Settings, ShieldCheck, Scale, CheckCircle2, AlertCircle, FileCheck, Trash2, RefreshCw } from 'lucide-react';

interface TaxSettingsViewProps {
  onClearDummyData?: () => void;
}

export const TaxSettingsView: React.FC<TaxSettingsViewProps> = ({ onClearDummyData }) => {
  const [clearedNotice, setClearedNotice] = React.useState(false);

  const handleClear = () => {
    if (window.confirm('Hapus semua data contoh di tab Pajak? Profil contoh, simulasi harta, utang, dan billing contoh akan dikosongkan, jadi isian SPT hanya berisi data asli Anda.')) {
      if (onClearDummyData) {
        onClearDummyData();
      }
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 4000);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-8 max-w-4xl">
      <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Pengaturan & Dasar Hukum Pajak Indonesia (Tahun Pajak 2025 & 2026)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tarif, PTKP, dan kode akun pajak sudah dikunci sesuai aturan pajak resmi Indonesia.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <FileCheck className="w-4 h-4" />
          <span>Terverifikasi UU HPP</span>
        </div>
      </div>

      {/* 1. Tarif Progresif Pasal 17 UU HPP */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-600" />
          <span>1. Lapisan Tarif Progresif PPh Pasal 17 ayat (1) huruf a UU HPP</span>
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">Rentang Penghasilan Kena Pajak (PKP)</th>
                <th className="px-3 py-2.5 text-center">Tarif Pajak</th>
                <th className="px-3 py-2.5">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Rp 0 s.d. Rp 60.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-blue-600">5%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Pertama (Batas naik dari 50jt jadi 60jt)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Diatas Rp 60.000.000 s.d. Rp 250.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-blue-600">15%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Kedua</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Diatas Rp 250.000.000 s.d. Rp 500.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-blue-600">25%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Ketiga</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Diatas Rp 500.000.000 s.d. Rp 5.000.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-blue-600">30%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Keempat</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Diatas Rp 5.000.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-rose-600">35%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Tertinggi (UU HPP)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Besaran PTKP (Penghasilan Tidak Kena Pajak) 2025 */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>2. Daftar Tarif PTKP (PMK 101/PMK.010/2016)</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {Object.entries(TAX_CONFIG_2025.ptkpRates).map(([status, amount]) => (
            <div key={status} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="font-bold text-slate-900 block">{status}</span>
              <span className="font-mono text-emerald-700 font-bold text-xs mt-0.5 block">{formatRupiah(amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Fasilitas UMKM PP 55 / 2022 */}
      <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span>3. Fasilitas Insentif UMKM Orang Pribadi (PP No 55 Tahun 2022)</span>
        </div>
        <p className="text-amber-800 leading-relaxed">
          Usaha orang pribadi dengan omzet sampai <strong>Rp 500.000.000,00 (lima ratus juta rupiah)</strong> dalam satu tahun tidak kena Pajak Penghasilan (PPh). Omzet di atas itu kena PPh Final <strong>0,5%</strong>.
        </p>
      </div>

      {/* 4. Pembersihan Data Dummy & Reset Formulir Pajak */}
      <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>4. Hapus Data Contoh &amp; Bersihkan Formulir</span>
            </h4>
            <p className="text-slate-500 mt-1 max-w-xl leading-relaxed">
              Pastikan data contoh lama tidak tercampur dengan data asli Anda. Tombol ini mengosongkan
              seluruh formulir SPT dan billing menjadi Rp 0.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center gap-2 shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Hapus Data Contoh Pajak</span>
          </button>
        </div>

        {clearedNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Data contoh terhapus. Formulir pajak kembali kosong dan siap diisi data asli Anda.</span>
          </div>
        )}
      </div>
    </div>
  );
};
