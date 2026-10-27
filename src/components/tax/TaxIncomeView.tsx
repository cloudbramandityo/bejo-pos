/**
 * Coded by Langgo Bramandityo.
 * Submenu 4: Data Penghasilan (Pekerjaan & Usaha / Pekerjaan Bebas)
 */
import React from 'react';
import { TaxAnnualReturn1770, AccountingMethod } from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import { Briefcase, Building, Calculator, CheckCircle2, TrendingUp, Sparkles, BookOpen } from 'lucide-react';

interface TaxIncomeViewProps {
  currentReturn: TaxAnnualReturn1770;
  onUpdateReturn: (updated: TaxAnnualReturn1770) => void;
  onNavigateSubmenu?: (submenu: string) => void;
}

export const TaxIncomeView: React.FC<TaxIncomeViewProps> = ({
  currentReturn,
  onUpdateReturn,
  onNavigateSubmenu,
}) => {
  const handleToggleEmployment = (checked: boolean) => {
    onUpdateReturn({
      ...currentReturn,
      hasEmploymentIncome: checked,
    });
  };

  const handleToggleBusiness = (checked: boolean) => {
    onUpdateReturn({
      ...currentReturn,
      hasBusinessIncome: checked,
    });
  };

  const handleBusinessChange = (field: string, val: any) => {
    onUpdateReturn({
      ...currentReturn,
      businessActivity: {
        ...currentReturn.businessActivity,
        [field]: val,
      },
    });
  };

  const umkmGross = currentReturn.businessActivity?.grossRevenue || 0;
  const umkmThreshold = currentReturn.businessActivity?.umkmTaxExemptThreshold || 500000000;
  const umkmTaxable = Math.max(0, umkmGross - umkmThreshold);
  const umkmTaxAmount = Math.round(umkmTaxable * 0.005);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">
            Data Penghasilan Wajib Pajak Tahun {currentReturn.taxYear}
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Atur sumber penghasilan dari pekerjaan (karyawan/pegawai) dan penghasilan dari kegiatan usaha percetakan/stiker atau pekerjaan bebas.
        </p>
      </div>

      {/* Section 1: Penghasilan Dari Pekerjaan (Formulir 1721-A1 / A2) */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Penghasilan Dalam Negeri Dari Pekerjaan</h3>
              <p className="text-xs text-slate-500">Gaji, upah, honorarium, tunjangan sebagai pegawai/karyawan (Bukti Potong 1721-A1 / 1721-A2)</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={currentReturn.hasEmploymentIncome}
              onChange={e => handleToggleEmployment(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {currentReturn.hasEmploymentIncome && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200/80 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Penghasilan Bruto (Rp)
              </label>
              <input
                type="number"
                value={currentReturn.employmentGrossIncome || 0}
                onChange={e => onUpdateReturn({
                  ...currentReturn,
                  employmentGrossIncome: Number(e.target.value) || 0,
                })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono focus:ring-2 focus:ring-blue-500 font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Jumlah penghasilan kotor setahun.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pengurang Penghasilan Bruto (Rp)
              </label>
              <input
                type="number"
                value={currentReturn.employmentDeductions || 0}
                onChange={e => onUpdateReturn({
                  ...currentReturn,
                  employmentDeductions: Number(e.target.value) || 0,
                })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Biaya jabatan (5% maks Rp 6 Jt/thn) + iuran pensiun.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Penghasilan Neto Pekerjaan
              </label>
              <div className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 font-mono font-bold text-blue-900 text-sm">
                {formatRupiah(currentReturn.employmentNetIncome)}
              </div>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Dihitung otomatis (Bruto - Pengurang)</p>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Penghasilan Dari Usaha / Pekerjaan Bebas (BEJO Digital Print & Cetak Digital) */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Penghasilan Usaha & Pekerjaan Bebas</h3>
              <p className="text-xs text-slate-500">Aktivitas toko percetakan stiker, advertising, atau usaha peredaran bruto tertentu</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={currentReturn.hasBusinessIncome}
              onChange={e => handleToggleBusiness(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>

        {currentReturn.hasBusinessIncome && (
          <div className="space-y-4 pt-4 border-t border-slate-200/80 text-xs">
            {/* Pilihan Rezim Pajak Usaha: UMKM PP 55 (Final 0.5%) vs Normal (NPPN / Pembukuan) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800 text-xs">
                Skema Perlakuan Perpajakan Usaha:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  currentReturn.businessActivity.isUmkmPp55
                    ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="taxScheme"
                    checked={currentReturn.businessActivity.isUmkmPp55}
                    onChange={() => handleBusinessChange('isUmkmPp55', true)}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>PPh Final UMKM PP 55/2022 (0.5%)</span>
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Fasilitas pembebasan pajak omzet s.d <strong>Rp 500 Juta</strong> bagi Wajib Pajak Orang Pribadi.
                    </span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  !currentReturn.businessActivity.isUmkmPp55
                    ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-400/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="taxScheme"
                    checked={!currentReturn.businessActivity.isUmkmPp55}
                    onChange={() => handleBusinessChange('isUmkmPp55', false)}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>Tarif Umum (Norma NPPN / Pembukuan)</span>
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Dihitung berdasarkan persentase Norma Penghitungan Neto atau Laporan Laba Rugi Komersial.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Jika Memilih PP 55/2022 */}
            {currentReturn.businessActivity.isUmkmPp55 ? (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Total Peredaran Bruto (Omzet) Usaha Setahun (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={currentReturn.businessActivity.grossRevenue || 0}
                      onChange={e => handleBusinessChange('grossRevenue', Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Batas Batasan Peredaran Bruto Tidak Kena Pajak (PP 55)
                    </label>
                    <div className="px-3 py-2 rounded-lg bg-amber-100/70 border border-amber-200 font-mono font-bold text-slate-800">
                      Rp 500.000.000
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-amber-200 flex flex-col sm:flex-row justify-between items-center gap-2">
                  <div className="text-xs">
                    <span className="text-slate-500">Omzet Dikenai PPh 0.5%: </span>
                    <strong className="font-mono text-slate-900">{formatRupiah(umkmTaxable)}</strong>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">PPh Final Terutang: </span>
                    <strong className="font-mono text-amber-700 text-sm">
                      {formatRupiah(currentReturn.businessActivity?.umkmTaxAmount || umkmTaxAmount)}
                    </strong>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Data omzet & PPh final selaras dengan Riwayat Pelaporan ({currentReturn.taxYear})</span>
                  </div>
                  {onNavigateSubmenu && (
                    <button
                      type="button"
                      onClick={() => onNavigateSubmenu('history')}
                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all cursor-pointer self-start sm:self-auto"
                    >
                      Buka Riwayat Billing
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Jika Memilih Tarif Umum (NPPN atau Pembukuan) */
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Metode Penghitungan</label>
                    <select
                      value={currentReturn.businessActivity.accountingMethod}
                      onChange={e => handleBusinessChange('accountingMethod', e.target.value as AccountingMethod)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PENCATATAN">Pencatatan (Norma / NPPN)</option>
                      <option value="PEMBUKUAN_KAS">Pembukuan (Metode Kas)</option>
                      <option value="PEMBUKUAN_AKRUAL">Pembukuan (Metode Akrual)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Peredaran Bruto Usaha (Rp)</label>
                    <input
                      type="number"
                      value={currentReturn.businessActivity.grossRevenue || 0}
                      onChange={e => handleBusinessChange('grossRevenue', Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {currentReturn.businessActivity.accountingMethod === 'PENCATATAN' ? (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Persentase Norma / NPPN (%)</label>
                      <input
                        type="number"
                        value={currentReturn.businessActivity.nppnRatePercent || 20}
                        onChange={e => handleBusinessChange('nppnRatePercent', Number(e.target.value) || 0)}
                        placeholder="Contoh: 20%"
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">HPP & Biaya Usaha (Rp)</label>
                      <input
                        type="number"
                        value={currentReturn.businessActivity.operatingExpenses || 0}
                        onChange={e => handleBusinessChange('operatingExpenses', Number(e.target.value) || 0)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex justify-between items-center">
                  <span className="text-xs text-blue-900 font-semibold">Penghasilan Neto Usaha (Masuk ke PKP Progresif):</span>
                  <span className="text-sm font-bold font-mono text-blue-900">
                    {formatRupiah(currentReturn.businessActivity.netIncomeCalculated)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ringkasan Akumulasi Neto */}
      <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-center gap-3">
        <div>
          <span className="text-xs text-slate-400 block">TOTAL AKUMULASI PENGHASILAN NETO (SEBELUM PTKP):</span>
          <span className="text-lg font-bold text-white">{formatRupiah(currentReturn.totalNetIncome)}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block">PTKP ({currentReturn.taxpayer.ptkpStatus}):</span>
          <span className="text-sm font-semibold text-amber-300">{formatRupiah(currentReturn.ptkpAmount)}</span>
        </div>
      </div>
    </div>
  );
};
