/**
 * Coded by Langgo Bramandityo.
 * Submenu 9: Penghasilan Yang Dikenakan PPh Final & Yang Tidak Termasuk Objek Pajak (Lampiran 2 Formulir 1770)
 */
import React from 'react';
import { TaxAnnualReturn1770 } from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import { Percent, Shield, Plus, Sparkles, Building2, CheckCircle2 } from 'lucide-react';

interface TaxFinalNonTaxableViewProps {
  currentReturn: TaxAnnualReturn1770;
  onUpdateReturn: (updated: TaxAnnualReturn1770) => void;
  onNavigateSubmenu?: (submenu: string) => void;
}

export const TaxFinalNonTaxableView: React.FC<TaxFinalNonTaxableViewProps> = ({
  currentReturn,
  onUpdateReturn,
  onNavigateSubmenu,
}) => {
  const umkmGross = currentReturn.businessActivity?.grossRevenue || 0;
  const umkmThreshold = currentReturn.businessActivity?.umkmTaxExemptThreshold || 500000000;
  const umkmTaxable = Math.max(0, umkmGross - umkmThreshold);
  const umkmTax = currentReturn.businessActivity?.umkmTaxAmount > 0
    ? currentReturn.businessActivity.umkmTaxAmount
    : Math.round(umkmTaxable * 0.005);

  const totalFinalTax = currentReturn.finalIncomes.reduce((sum, f) => sum + (f.finalTaxAmount || 0), 0) +
    (currentReturn.businessActivity.isUmkmPp55 ? umkmTax : 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-8 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">
            Penghasilan Final & Bukan Objek Pajak (Lampiran 2)
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Penghasilan yang pajaknya sudah final (PPh Final UMKM 0,5%, bunga deposito, dividen, jual properti) dan yang bukan objek pajak (warisan, bantuan, klaim asuransi).
        </p>
      </div>

      {/* Bagian A: PPh Final UMKM PP 55 / 2022 */}
      <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>PPh Final UMKM PP 55/2022 (Peredaran Bruto Tertentu)</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">
            Tarif 0.5%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-4 rounded-xl border border-indigo-100">
          <div>
            <span className="text-slate-500 block">Peredaran Bruto Toko:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{formatRupiah(umkmGross)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Fasilitas Tidak Kena Pajak:</span>
            <span className="font-mono font-bold text-emerald-700 text-sm">Rp 500.000.000</span>
          </div>
          <div>
            <span className="text-slate-500 block">PPh Final Terutang / Disetor:</span>
            <span className="font-mono font-bold text-indigo-700 text-sm">{formatRupiah(umkmTax)}</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-900 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Peredaran bruto & PPh final 100% selaras dengan Riwayat Pelaporan ({currentReturn.taxYear})</span>
          </div>
          {onNavigateSubmenu && (
            <button
              type="button"
              onClick={() => onNavigateSubmenu('history')}
              className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all cursor-pointer self-start sm:self-auto"
            >
              Lihat Riwayat Billing
            </button>
          )}
        </div>
      </div>

      {/* Bagian B: Daftar Penghasilan Objek PPh Final Lainnya */}
      <div className="border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500" />
          <span>Jenis Penghasilan Final Lainnya (Lampiran 2 Bagian A)</span>
        </h3>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <strong className="text-slate-800 block">1. Bunga Deposito, Tabungan, dan Diskonto SBI</strong>
              <span className="text-[11px] text-slate-400">Tarif 20% Final dipotong bank</span>
            </div>
            <span className="font-mono text-slate-600 font-semibold">Rp 0</span>
          </div>

          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <strong className="text-slate-800 block">2. Persewaan Tanah dan/atau Bangunan</strong>
              <span className="text-[11px] text-slate-400">Tarif 10% Final dari nilai sewa</span>
            </div>
            <span className="font-mono text-slate-600 font-semibold">Rp 0</span>
          </div>

          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <strong className="text-slate-800 block">3. Pengalihan Hak Atas Tanah dan/atau Bangunan</strong>
              <span className="text-[11px] text-slate-400">Tarif 2.5% Final</span>
            </div>
            <span className="font-mono text-slate-600 font-semibold">Rp 0</span>
          </div>

          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <strong className="text-slate-800 block">4. Dividen Dalam Negeri</strong>
              <span className="text-[11px] text-slate-400">Tarif 10% (bebas pajak bila diinvestasikan kembali di NKRI sesuai UU Cipta Kerja)</span>
            </div>
            <span className="font-mono text-slate-600 font-semibold">Rp 0</span>
          </div>
        </div>
      </div>

      {/* Bagian C: Penghasilan Bukan Objek Pajak */}
      <div className="border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span>Penghasilan Yang Tidak Termasuk Objek Pajak (Lampiran 2 Bagian B)</span>
        </h3>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <strong className="text-slate-800 block">1. Bantuan, Sumbangan, dan Zakat</strong>
              <span className="text-[11px] text-slate-400">Diterima dari badan amil zakat atau lembaga keagamaan yang disahkan pemerintah</span>
            </div>
            <span className="font-mono text-slate-600 font-semibold">Rp 0</span>
          </div>

          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <strong className="text-slate-800 block">2. Warisan</strong>
              <span className="text-[11px] text-slate-400">Harta warisan yang telah dibagi maupun belum terbagi</span>
            </div>
            <span className="font-mono text-slate-600 font-semibold">Rp 0</span>
          </div>

          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <strong className="text-slate-800 block">3. Pembayaran Klaim Asuransi Kesehatan, Jiwa, dan Beasiswa</strong>
              <span className="text-[11px] text-slate-400">Klaim dari perusahaan asuransi di Indonesia</span>
            </div>
            <span className="font-mono text-slate-600 font-semibold">Rp 0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
