/**
 * Coded by Langgo Bramandityo.
 * Submenu 3: Wizard Pengisian 12 Langkah SPT Tahunan Orang Pribadi (Formulir 1770)
 * Dengan alur pertanyaan bercabang & rekapitulasi real-time UU HPP 2025
 */
import React, { useState } from 'react';
import {
  TaxAnnualReturn1770,
  TaxpayerProfile,
  TAX_CONFIG_2025,
} from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Save,
  Printer,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  FileText,
  User,
  Briefcase,
  Wallet,
  Landmark,
  Users,
  Percent,
  Calculator,
  CheckCircle2,
  Download,
  Calendar,
  X
} from 'lucide-react';

interface TaxFilingWizardProps {
  currentReturn: TaxAnnualReturn1770;
  onUpdateReturn: (updated: TaxAnnualReturn1770) => void;
  onCloseWizard: () => void;
  initialStep?: number;
  onOpenPrintView?: () => void;
}

export const TaxFilingWizard: React.FC<TaxFilingWizardProps> = ({
  currentReturn,
  onUpdateReturn,
  onCloseWizard,
  initialStep = 1,
  onOpenPrintView,
}) => {
  const [step, setStep] = useState<number>(initialStep);
  const [data, setData] = useState<TaxAnnualReturn1770>({ ...currentReturn });
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isFiledSuccess, setIsFiledSuccess] = useState(false);

  const stepTitles = [
    'Pilih Tahun Pajak & Status SPT',
    'Identitas Pokok Wajib Pajak',
    'Profil Sumber Penghasilan',
    'Input Penghasilan & Bukti Potong',
    'Daftar Harta Akhir Tahun',
    'Daftar Utang Akhir Tahun',
    'Daftar Tanggungan Keluarga',
    'Penghasilan Final & Non-Objek',
    'Pengurang Neto & Setoran PPh 25',
    'Rekapitulasi & Perhitungan PPh',
    'Validasi & Pratinjau Formulir 1770',
    'Finalisasi & Ringkasan Pelaporan SPT',
  ];

  const updateData = (partial: Partial<TaxAnnualReturn1770>) => {
    const updated = { ...data, ...partial };
    setData(updated);
    onUpdateReturn(updated);
  };

  const handleNext = () => {
    onUpdateReturn(data);
    if (step < 12) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinalSubmit = () => {
    const now = new Date().toISOString();
    const finalReturn: TaxAnnualReturn1770 = {
      ...data,
      filingStatus: 'SELESAI',
      submittedAt: now,
      auditTrail: [
        ...(data.auditTrail || []),
        {
          timestamp: now,
          action: 'PELAPORAN_SELESAI',
          changedBy: 'Langgo Bramandityo (DEVELOPER)',
          notes: `SPT Tahunan Orang Pribadi Tahun Pajak ${data.taxYear} Berhasil Disimpan & Difinalisasi`,
        },
      ],
    };
    setData(finalReturn);
    onUpdateReturn(finalReturn);
    setIsFiledSuccess(true);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold border border-blue-400/30">
              LANGKAH {step} DARI 12
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Formulir SPT 1770 Tahun {data.taxYear}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white mt-0.5">
            {stepTitles[step - 1]}
          </h2>
        </div>

        <button
          type="button"
          onClick={onCloseWizard}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Tutup Wizard"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Step Progress Indicator Bar */}
      <div className="w-full bg-slate-100 h-1.5 flex">
        <div
          className="bg-blue-600 h-full transition-all duration-300"
          style={{ width: `${(step / 12) * 100}%` }}
        />
      </div>

      {/* Step Content Area */}
      <div className="p-6 min-h-[420px] max-h-[70vh] overflow-y-auto">
        {/* LANGKAH 1 — PILIH TAHUN PAJAK DAN STATUS SPT */}
        {step === 1 && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="text-center space-y-1">
              <Calendar className="w-10 h-10 text-blue-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Pilih Tahun Pajak dan Status SPT</h3>
              <p className="text-xs text-slate-500">Tentukan tahun masa pajak yang akan Anda laporkan.</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tahun Pajak</label>
                <select
                  value={data.taxYear}
                  onChange={e => updateData({ taxYear: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value={2026}>2026 (Tahun Pajak Terbaru)</option>
                  <option value={2025}>2025 (Tahun Berjalan / Acuan UU HPP)</option>
                  <option value={2024}>2024</option>
                  <option value={2023}>2023</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status SPT</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2 ${
                    data.sptType === 'NORMAL' ? 'border-blue-500 bg-blue-50/50 font-bold text-blue-900' : 'border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="sptType"
                      checked={data.sptType === 'NORMAL'}
                      onChange={() => updateData({ sptType: 'NORMAL', amendmentNumber: 0 })}
                    />
                    <span>Normal (Pelaporan Awal)</span>
                  </label>

                  <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2 ${
                    data.sptType === 'PEMBETULAN' ? 'border-blue-500 bg-blue-50/50 font-bold text-blue-900' : 'border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="sptType"
                      checked={data.sptType === 'PEMBETULAN'}
                      onChange={() => updateData({ sptType: 'PEMBETULAN', amendmentNumber: data.amendmentNumber || 1 })}
                    />
                    <span>Pembetulan</span>
                  </label>
                </div>
              </div>

              {data.sptType === 'PEMBETULAN' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pembetulan Ke-</label>
                  <input
                    type="number"
                    min={1}
                    value={data.amendmentNumber}
                    onChange={e => updateData({ amendmentNumber: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* LANGKAH 2 — IDENTITAS WAJIB PAJAK */}
        {step === 2 && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NPWP 16 Digit / NIK</label>
                <input
                  type="text"
                  value={data.taxpayer.npwp}
                  onChange={e => updateData({ taxpayer: { ...data.taxpayer, npwp: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">NIK KTP</label>
                <input
                  type="text"
                  value={data.taxpayer.nik}
                  onChange={e => updateData({ taxpayer: { ...data.taxpayer, nik: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Wajib Pajak</label>
                <input
                  type="text"
                  value={data.taxpayer.fullName}
                  onChange={e => updateData({ taxpayer: { ...data.taxpayer, fullName: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon / HP</label>
                <input
                  type="text"
                  value={data.taxpayer.phoneNumber}
                  onChange={e => updateData({ taxpayer: { ...data.taxpayer, phoneNumber: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Email</label>
                <input
                  type="email"
                  value={data.taxpayer.email}
                  onChange={e => updateData({ taxpayer: { ...data.taxpayer, email: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Perpajakan Suami-Istri</label>
                <select
                  value={data.taxpayer.maritalTaxStatus}
                  onChange={e => updateData({ taxpayer: { ...data.taxpayer, maritalTaxStatus: e.target.value as any } })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                >
                  <option value="KK">KK — Kepala Keluarga</option>
                  <option value="HB">HB — Hidup Berpisah</option>
                  <option value="PH">PH — Pisah Harta</option>
                  <option value="MT">MT — Memilih Terpisah</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status PTKP</label>
                <select
                  value={data.taxpayer.ptkpStatus}
                  onChange={e => updateData({ taxpayer: { ...data.taxpayer, ptkpStatus: e.target.value as any } })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-blue-900"
                >
                  {Object.keys(TAX_CONFIG_2025.ptkpRates).map(p => (
                    <option key={p} value={p}>{p} ({formatRupiah(TAX_CONFIG_2025.ptkpRates[p as any])})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* LANGKAH 3 — PROFIL PENGHASILAN (PERTANYAAN BERCABANG) */}
        {step === 3 && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <p className="text-slate-600 mb-2">
              Jawab pertanyaan berikut untuk menentukan modul formulir yang aktif dalam pengisian SPT Anda:
            </p>

            <div className="space-y-3">
              <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100/70">
                <div>
                  <span className="font-bold text-slate-900 block">Apakah Anda memiliki penghasilan dari pekerjaan (Karyawan/Pegawai)?</span>
                  <span className="text-[11px] text-slate-500">Menerima bukti potong 1721-A1 atau 1721-A2.</span>
                </div>
                <input
                  type="checkbox"
                  checked={data.hasEmploymentIncome}
                  onChange={e => updateData({ hasEmploymentIncome: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </label>

              <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100/70">
                <div>
                  <span className="font-bold text-slate-900 block">Apakah Anda memiliki kegiatan usaha (Toko Percetakan/Stiker) atau pekerjaan bebas?</span>
                  <span className="text-[11px] text-slate-500">Peredaran bruto UMKM PP 55/2022 atau norma pencatatan / pembukuan.</span>
                </div>
                <input
                  type="checkbox"
                  checked={data.hasBusinessIncome}
                  onChange={e => updateData({ hasBusinessIncome: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </label>

              <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100/70">
                <div>
                  <span className="font-bold text-slate-900 block">Apakah Anda memiliki harta (Tabungan, Kas, Kendaraan, Mesin, Properti)?</span>
                  <span className="text-[11px] text-slate-500">Kewajiban melampirkan daftar harta akhir tahun di Lampiran 1.</span>
                </div>
                <input
                  type="checkbox"
                  checked={data.hasAssets}
                  onChange={e => updateData({ hasAssets: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </label>

              <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100/70">
                <div>
                  <span className="font-bold text-slate-900 block">Apakah Anda memiliki utang atau pinjaman pada akhir tahun?</span>
                  <span className="text-[11px] text-slate-500">Kredit bank, leasing kendaraan, atau cicilan modal kerja.</span>
                </div>
                <input
                  type="checkbox"
                  checked={data.hasDebts}
                  onChange={e => updateData({ hasDebts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </label>
            </div>
          </div>
        )}

        {/* LANGKAH 4 — INPUT DATA PENGHASILAN & BUKTI POTONG */}
        {step === 4 && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            {data.hasEmploymentIncome && (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <h4 className="font-bold text-slate-900">Penghasilan Neto Dari Pekerjaan</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Penghasilan Bruto (Rp)</label>
                    <input
                      type="number"
                      value={data.employmentGrossIncome}
                      onChange={e => updateData({ employmentGrossIncome: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Pengurang Bruto (Biaya Jabatan & Pensiun)</label>
                    <input
                      type="number"
                      value={data.employmentDeductions}
                      onChange={e => updateData({ employmentDeductions: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {data.hasBusinessIncome && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-3">
                <h4 className="font-bold text-amber-900">Penghasilan Usaha BEJO Digital Print</h4>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Total Peredaran Bruto (Omzet) Setahun (Rp)</label>
                  <input
                    type="number"
                    value={data.businessActivity?.grossRevenue || 0}
                    onChange={e => updateData({
                      businessActivity: {
                        ...data.businessActivity,
                        grossRevenue: Number(e.target.value) || 0,
                      }
                    })}
                    className="w-full px-3 py-2.5 rounded-lg border border-amber-300 font-mono font-bold text-slate-900 text-sm bg-white"
                  />
                  <p className="text-[11px] text-amber-800 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Terisi otomatis & selaras dengan data Riwayat Pelaporan Billing Bulanan ({formatRupiah(data.businessActivity?.grossRevenue || 0)})</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LANGKAH 5 — INPUT HARTA */}
        {step === 5 && (
          <div className="space-y-4 max-w-3xl mx-auto text-xs">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Daftar Harta Akhir Tahun</h4>
                <p className="text-slate-500">Tercatat {data.assets.length} item harta.</p>
              </div>
              <span className="font-bold text-blue-900 text-sm">
                Total: {formatRupiah(data.assets.reduce((sum, a) => sum + (a.acquisitionPrice || 0), 0))}
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {data.assets.map(a => (
                <div key={a.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-900 block">{a.name} ({a.code})</span>
                    <span className="text-[11px] text-slate-400">Tahun {a.acquisitionYear} • {a.description}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800">{formatRupiah(a.acquisitionPrice)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LANGKAH 6 — INPUT UTANG */}
        {step === 6 && (
          <div className="space-y-4 max-w-3xl mx-auto text-xs">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Daftar Utang / Pinjaman Akhir Tahun</h4>
                <p className="text-slate-500">Tercatat {data.debts.length} pinjaman.</p>
              </div>
              <span className="font-bold text-amber-800 text-sm">
                Total Sisa: {formatRupiah(data.debts.reduce((sum, d) => sum + (d.endingBalance || 0), 0))}
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {data.debts.map(d => (
                <div key={d.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-900 block">{d.lenderName}</span>
                    <span className="text-[11px] text-slate-400">Tahun {d.loanYear} • {d.description}</span>
                  </div>
                  <span className="font-mono font-bold text-amber-700">{formatRupiah(d.endingBalance)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LANGKAH 7 — INPUT TANGGUNGAN KELUARGA */}
        {step === 7 && (
          <div className="space-y-4 max-w-3xl mx-auto text-xs">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Anggota Keluarga yang Menjadi Tanggungan</h4>
                <p className="text-slate-500">Status PTKP: {data.taxpayer.ptkpStatus}</p>
              </div>
              <span className="font-bold text-emerald-800 text-sm">
                {data.dependents.length} Tanggungan
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {data.dependents.map(dep => (
                <div key={dep.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-900 block">{dep.fullName}</span>
                    <span className="text-[11px] text-slate-400">{dep.familyRelationship.replace('_', ' ')} • {dep.jobOrStatus}</span>
                  </div>
                  <span className="font-mono text-slate-600">{dep.nik}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LANGKAH 8 — FINAL & BUKAN OBJEK */}
        {step === 8 && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-indigo-900">Penghasilan Dikenakan PPh Final (PP 55/2022)</h4>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Selaras Riwayat Billing
                </span>
              </div>
              <p className="text-slate-600">
                Omzet usaha toko stiker Anda tercatat di lampiran ini ({formatRupiah(data.businessActivity?.grossRevenue || 0)}) dengan PPh Final yang disetor ({formatRupiah(data.businessActivity?.umkmTaxAmount || 0)}). Omzet ini tidak digabung ke penghasilan yang kena tarif progresif.
              </p>
            </div>
          </div>
        )}

        {/* LANGKAH 9 — PENGURANG & KREDIT PPH 25 */}
        {step === 9 && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Zakat / Sumbangan Keagamaan yang Sifatnya Wajib (Rp)
              </label>
              <input
                type="number"
                value={data.deductions?.zakatOrReligiousCharity || 0}
                onChange={e => updateData({
                  deductions: {
                    ...data.deductions,
                    zakatOrReligiousCharity: Number(e.target.value) || 0,
                  }
                })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Hanya yang dibayarkan melalui BAZNAS / LAZ resmi yang disahkan pemerintah.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                PPh Pasal 25 yang Telah Dibayar Sendiri (Angsuran Bulanan) (Rp)
              </label>
              <input
                type="number"
                value={data.pph25PaidYearly || 0}
                onChange={e => updateData({ pph25PaidYearly: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
          </div>
        )}

        {/* LANGKAH 10 — REKAPITULASI & PERHITUNGAN */}
        {step === 10 && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 font-semibold text-slate-600">
                <span>Komponen Perhitungan Pajak</span>
                <span>Jumlah (Rupiah)</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>1. Penghasilan Neto Setahun:</span>
                <span className="font-mono font-bold text-slate-900">{formatRupiah(data.totalNetIncome)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>2. PTKP ({data.taxpayer.ptkpStatus}):</span>
                <span className="font-mono font-bold text-emerald-700">{formatRupiah(data.ptkpAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-200">
                <span>3. Penghasilan Kena Pajak (PKP):</span>
                <span className="font-mono font-bold text-blue-900 text-sm">{formatRupiah(data.taxableIncome)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>4. PPh Terutang (Pasal 17 UU HPP):</span>
                <span className="font-mono font-bold text-indigo-700 text-sm">{formatRupiah(data.totalTaxPayable)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>5. Total Kredit Pajak (Potongan & PPh 25):</span>
                <span className="font-mono font-bold text-emerald-700">{formatRupiah(data.totalTaxCredits)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-300 text-sm font-bold">
                <span>Status Akhir:</span>
                <span className={data.settlementStatus === 'KURANG_BAYAR' ? 'text-amber-700' : 'text-emerald-700'}>
                  {data.settlementStatus} ({formatRupiah(data.taxDifferenceAmount)})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* LANGKAH 11 — PRATINJAU & KONFIRMASI */}
        {step === 11 && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <div className="p-5 border-2 border-slate-300 rounded-xl bg-slate-50 space-y-3 font-sans">
              <div className="text-center pb-3 border-b border-slate-200">
                <h4 className="font-extrabold text-sm text-slate-900 uppercase">
                  RINGKASAN FORMULIR SPT 1770 TAHUN PAJAK {data.taxYear}
                </h4>
                <p className="text-[11px] text-slate-500">Direktorat Jenderal Pajak Kementerian Keuangan RI</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Wajib Pajak: <strong>{data.taxpayer.fullName}</strong></div>
                <div>NPWP: <strong className="font-mono">{data.taxpayer.npwp}</strong></div>
                <div>Status: <strong>{data.sptType}</strong></div>
                <div>PTKP: <strong>{data.taxpayer.ptkpStatus}</strong></div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-xs">
                <span>Pajak Kurang / Lebih Bayar:</span>
                <span className="text-blue-900">{data.settlementStatus} — {formatRupiah(data.taxDifferenceAmount)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
              {onOpenPrintView && (
                <button
                  type="button"
                  onClick={onOpenPrintView}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>Lihat Format Cetak Resmi 1770</span>
                </button>
              )}
            </div>

            <label className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={e => setIsConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-[11px] text-blue-900 leading-snug">
                Dengan menyadari sepenuhnya akan segala akibatnya termasuk sanksi-sanksi sesuai dengan ketentuan peraturan perundang-undangan yang berlaku, saya menyatakan bahwa apa yang telah saya beritahukan di atas beserta lampiran-lampirannya adalah benar, lengkap, dan jelas.
              </span>
            </label>
          </div>
        )}

        {/* LANGKAH 12 — FINALISASI & RINGKASAN PELAPORAN SPT */}
        {step === 12 && (
          <div className="space-y-6 max-w-xl mx-auto text-center py-4">
            {isFiledSuccess ? (
              <div className="space-y-4 animate-fade-in">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  SPT Tahunan Berhasil Disimpan & Difinalisasi!
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Formulir 1770 dan seluruh lampirannya tersimpan permanen di aplikasi dengan status <strong>SELESAI</strong>.
                </p>

                {/* SPT Summary Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2 text-xs">
                  <div className="text-center font-bold text-slate-800 pb-2 border-b border-slate-200 font-sans">
                    RINGKASAN FORMULIR 1770 TAHUN {data.taxYear}
                  </div>
                  <div className="grid grid-cols-12 gap-1.5 text-[11px] pt-1">
                    <span className="col-span-5 text-slate-500 font-medium">Wajib Pajak:</span>
                    <span className="col-span-7 font-bold text-slate-900">{data.taxpayer.fullName || '(Belum Diisi)'}</span>

                    <span className="col-span-5 text-slate-500 font-medium">NPWP / NIK:</span>
                    <span className="col-span-7 font-mono font-bold text-slate-900">{data.taxpayer.npwp || data.taxpayer.nik || '(Belum Diisi)'}</span>

                    <span className="col-span-5 text-slate-500 font-medium">Tahun Pajak:</span>
                    <span className="col-span-7 font-bold text-slate-900">{data.taxYear}</span>

                    <span className="col-span-5 text-slate-500 font-medium">Status SPT:</span>
                    <span className="col-span-7 font-bold text-slate-900">{data.sptType} {data.amendmentNumber > 0 ? `(Pembetulan ${data.amendmentNumber})` : '(Normal)'}</span>

                    <span className="col-span-5 text-slate-500 font-medium">Status Pembayaran:</span>
                    <span className="col-span-7 font-bold text-emerald-700">{data.settlementStatus}</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-left text-[11px] text-blue-900 leading-relaxed">
                  <strong>Informasi Resmi Pelaporan DJP Online:</strong> Bukti Penerimaan Elektronik (BPE) resmi dengan Nomor Tanda Terima Elektronik (NTTE) diterbitkan langsung oleh Direktorat Jenderal Pajak (DJP) setelah Anda mengunggah formulir SPT 1770 ini melalui portal resmi <strong>djponline.pajak.go.id</strong>.
                </div>

                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenPrintView) {
                        onCloseWizard();
                        onOpenPrintView();
                      } else {
                        window.print();
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Buka & Cetak Dokumen 1770 / PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCloseWizard}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
                  >
                    Kembali ke Dashboard Pajak
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ShieldCheck className="w-14 h-14 text-blue-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">Finalisasi Pengisian SPT</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Klik tombol di bawah ini untuk menyimpan seluruh data dan menyelesaikan pengisian SPT Tahunan Tahun Pajak {data.taxYear}.
                </p>

                <button
                  type="button"
                  disabled={!isConfirmed}
                  onClick={handleFinalSubmit}
                  className={`px-6 py-3 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 mx-auto cursor-pointer ${
                    isConfirmed
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>Finalisasi & Simpan SPT Tahunan</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation Buttons */}
      <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={step === 1}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
            step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Sebelumnya</span>
        </button>

        <div className="text-[11px] text-slate-400 font-mono">
          {step} / 12
        </div>

        {step < 12 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <span>Selanjutnya</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onCloseWizard}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        )}
      </div>
    </div>
  );
};
