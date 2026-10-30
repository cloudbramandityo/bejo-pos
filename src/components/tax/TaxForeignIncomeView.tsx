/**
 * Coded by Langgo Bramandityo.
 * Submenu 10: Penghasilan Luar Negeri & Kredit Pajak Luar Negeri (Pasal 24)
 */
import React from 'react';
import { TaxAnnualReturn1770 } from '../../types/tax';
import { Globe, ShieldAlert, Plus } from 'lucide-react';

interface TaxForeignIncomeViewProps {
  currentReturn: TaxAnnualReturn1770;
  onUpdateReturn: (updated: TaxAnnualReturn1770) => void;
}

export const TaxForeignIncomeView: React.FC<TaxForeignIncomeViewProps> = ({
  currentReturn,
  onUpdateReturn,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Penghasilan Luar Negeri & Kredit Pajak Luar Negeri (PPh Pasal 24)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lampiran 2 Bagian C Formulir 1770 — Dividen, bunga, royalti, atau laba usaha luar negeri yang pajaknya telah dipotong di negara sumber.
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert('Fitur penambahan penghasilan luar negeri aktif.')}
          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Penghasilan Luar Negeri (LN)</span>
        </button>
      </div>

      <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
        <Globe className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-700">Tidak Ada Penghasilan Luar Negeri Tercatat</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Kalau Anda tidak punya dividen dari bursa luar negeri atau cabang usaha di luar Indonesia, isi bagian ini Nihil (Rp 0).
        </p>
      </div>
    </div>
  );
};
