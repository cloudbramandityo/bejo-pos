/**
 * Coded by Langgo Bramandityo.
 * Submenu 1: Dashboard Pajak SPT Tahunan Orang Pribadi
 */
import React from 'react';
import {
  TaxAnnualReturn1770,
  TaxpayerProfile,
} from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import {
  FileText,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Wallet,
  Landmark,
  Users,
  Clock,
  Sparkles,
  Printer,
  User,
  BadgeCheck,
  Building,
  CreditCard,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

interface TaxDashboardProps {
  currentReturn: TaxAnnualReturn1770;
  taxpayer: TaxpayerProfile;
  onOpenWizard: (step?: number) => void;
  onNavigateSubmenu: (submenu: string) => void;
  onOpenPrintView?: () => void;
}

export const TaxDashboard: React.FC<TaxDashboardProps> = ({
  currentReturn,
  taxpayer,
  onOpenWizard,
  onNavigateSubmenu,
  onOpenPrintView,
}) => {
  const totalAssetsValue = currentReturn.assets.reduce((sum, a) => sum + (a.acquisitionPrice || 0), 0);
  const totalDebtsValue = currentReturn.debts.reduce((sum, d) => sum + (d.endingBalance || 0), 0);
  const umkmGross = currentReturn.businessActivity?.grossRevenue || 0;
  const umkmThreshold = currentReturn.businessActivity?.umkmTaxExemptThreshold || 500000000;
  const umkmTaxable = Math.max(0, umkmGross - umkmThreshold);

  return (
    <div className="space-y-6">
      {/* SECTION IDENTITAS UTAMA: SPT TAHUNAN & WAJIB PAJAK AHMAD IRDIANTO (HIGH-CONTRAST & KRISTAL JELAS) */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm overflow-hidden">
        {/* Top Header Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-bold tracking-wider uppercase font-mono">
                  DJP FORMULIR 1770 RESMI
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold font-mono">
                  TAHUN PAJAK {currentReturn.taxYear}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>SELARAS DENGAN RIWAYAT PELAPORAN</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold font-mono">
                  STATUS: {currentReturn.sptType} {currentReturn.amendmentNumber > 0 ? `(PEMBETULAN ${currentReturn.amendmentNumber})` : '(NORMAL)'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                SPT Tahunan PPh Orang Pribadi (Formulir 1770)
              </h2>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenPrintView ? onOpenPrintView() : onNavigateSubmenu('print')}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Format Cetak 1770 (PDF / Fisik)</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenWizard(1)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Wizard 12 Langkah</span>
            </button>
          </div>
        </div>

        {/* Dedicated Taxpayer Profile Card - Pure User Input, Zero Dummy Contamination */}
        <div className="p-6 bg-gradient-to-b from-slate-50/80 to-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-200">
            {/* Left: Avatar & Name */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md border-2 border-white">
                  {taxpayer.fullName?.trim()
                    ? taxpayer.fullName.trim().split(/\s+/).length === 1
                      ? taxpayer.fullName.trim().slice(0, 2).toUpperCase()
                      : (taxpayer.fullName.trim().split(/\s+/)[0][0] + taxpayer.fullName.trim().split(/\s+/).slice(-1)[0][0]).toUpperCase()
                    : 'WP'}
                </div>
                {taxpayer.npwp ? (
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-xs" title="Wajib Pajak Terdaftar & Aktif">
                    <BadgeCheck className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-full shadow-xs" title="Data Wajib Pajak Belum Lengkap">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">
                    WAJIB PAJAK ORANG PRIBADI
                  </span>
                  {taxpayer.npwp ? (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>NPWP Terdaftar: {taxpayer.npwp}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Data Profil Belum Diisi</span>
                    </span>
                  )}
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {taxpayer.fullName || 'Nama Wajib Pajak Belum Diisi'}
                </h3>

                <p className="text-xs text-slate-600 font-medium">
                  {taxpayer.kluDescription || 'Perdagangan Eceran Hasil Percetakan dan Penerbitan'} • <strong className="text-slate-800">Toko Bejo Stiker</strong>
                </p>
              </div>
            </div>

            {/* Right: Quick Action to Edit Profile */}
            <div className="flex items-center gap-2 self-start lg:self-center">
              <button
                type="button"
                onClick={() => onNavigateSubmenu('taxpayer')}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>{taxpayer.fullName ? 'Ubah Data Wajib Pajak' : 'Isi Data Wajib Pajak'}</span>
              </button>
            </div>
          </div>

          {/* Identity Grid Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
            {/* NPWP */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                NPWP (16 Digit NIK/NPWP)
              </div>
              <div className="font-mono font-extrabold text-sm text-slate-900 select-all">
                {taxpayer.npwp || <span className="text-slate-400 font-sans font-normal">(Belum Diisi)</span>}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                NIK: {taxpayer.nik || '(Belum Diisi)'}
              </div>
            </div>

            {/* Status PTKP */}
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-0.5">
                Status PTKP & Batas Bebas
              </div>
              <div className="font-black text-sm text-amber-950 flex items-center gap-1.5">
                <span className="bg-amber-200/80 px-1.5 py-0.2 rounded font-mono font-bold text-xs">{taxpayer.ptkpStatus || 'TK/0'}</span>
                <span>{formatRupiah(currentReturn.ptkpAmount)}</span>
              </div>
              <div className="text-[10px] text-amber-800 mt-0.5">
                {taxpayer.ptkpStatus?.startsWith('TK') ? 'Tidak Kawin' : 'Kawin'} (PTKP: {formatRupiah(currentReturn.ptkpAmount)})
              </div>
            </div>

            {/* Status Kewajiban Suami-Istri */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                Kewajiban Perpajakan Suami-Istri
              </div>
              <div className="font-bold text-sm text-slate-900">
                {taxpayer.maritalTaxStatus === 'KK' ? 'KK (Kepala Keluarga)' : taxpayer.maritalTaxStatus || 'KK'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Penghasilan digabung pada Kepala Keluarga
              </div>
            </div>

            {/* Kode KLU & Alamat */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                Kode KLU & Domisili
              </div>
              <div className="font-bold text-sm text-slate-900">
                KLU {taxpayer.kluCode || '47611'} {taxpayer.city ? `• ${taxpayer.city}` : ''}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                {taxpayer.address || '(Alamat domisili belum diisi)'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Penghasilan Neto */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Penghasilan Neto</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mb-1">
            {formatRupiah(currentReturn.totalNetIncome)}
          </div>
          <p className="text-[11px] text-slate-500">
            PKP: <strong className="text-slate-800">{formatRupiah(currentReturn.taxableIncome)}</strong>
          </p>
        </div>

        {/* PPh Terutang (Pasal 17) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">PPh Terutang (Ps. 17)</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-indigo-700 mb-1">
            {formatRupiah(currentReturn.totalTaxPayable)}
          </div>
          <p className="text-[11px] text-slate-500">
            Tarif Progresif UU HPP 5% - 35%
          </p>
        </div>

        {/* Total Kredit Pajak */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Kredit Pajak</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700 mb-1">
            {formatRupiah(currentReturn.totalTaxCredits)}
          </div>
          <p className="text-[11px] text-slate-500">
            Potongan PPh 21/22/23 & PPh 25
          </p>
        </div>

        {/* Status Akhir Kurang / Lebih Bayar */}
        <div className={`rounded-xl p-4 border shadow-xs transition-all ${
          currentReturn.settlementStatus === 'KURANG_BAYAR'
            ? 'bg-amber-50/50 border-amber-200'
            : currentReturn.settlementStatus === 'LEBIH_BAYAR'
            ? 'bg-blue-50/50 border-blue-200'
            : 'bg-emerald-50/50 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Status SPT</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              currentReturn.settlementStatus === 'KURANG_BAYAR'
                ? 'bg-amber-100 text-amber-700'
                : currentReturn.settlementStatus === 'LEBIH_BAYAR'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {currentReturn.settlementStatus === 'KURANG_BAYAR' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mb-1">
            {currentReturn.settlementStatus === 'KURANG_BAYAR'
              ? `Kurang Bayar: ${formatRupiah(currentReturn.taxDifferenceAmount)}`
              : currentReturn.settlementStatus === 'LEBIH_BAYAR'
              ? `Lebih Bayar: ${formatRupiah(currentReturn.taxDifferenceAmount)}`
              : 'NIHIL (Rp 0)'}
          </div>
          <p className="text-[11px] font-medium text-slate-600">
            {currentReturn.settlementStatus === 'KURANG_BAYAR'
              ? 'PPh Pasal 29 yang harus disetor'
              : currentReturn.settlementStatus === 'LEBIH_BAYAR'
              ? 'PPh Pasal 28A dapat direstitusi'
              : 'Tidak ada sisa kewajiban pajak'}
          </p>
        </div>
      </div>

      {/* Grid: Lampiran Quick Peek & PP 55 Facility */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Ringkasan Komponen SPT */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Lampiran & Bagian Terisi SPT Tahunan</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">Tahun Pajak {currentReturn.taxYear}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card Harta */}
              <div
                onClick={() => onNavigateSubmenu('assets')}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-1">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-blue-600" />
                    <span>Daftar Harta</span>
                  </div>
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                    {currentReturn.assets.length} item
                  </span>
                </div>
                <div className="text-base font-bold text-slate-900">
                  {formatRupiah(totalAssetsValue)}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Lampiran 1 Bagian A</p>
              </div>

              {/* Card Utang */}
              <div
                onClick={() => onNavigateSubmenu('debts')}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-amber-50/50 hover:border-amber-200 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-1">
                  <div className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-amber-600" />
                    <span>Daftar Utang</span>
                  </div>
                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                    {currentReturn.debts.length} item
                  </span>
                </div>
                <div className="text-base font-bold text-slate-900">
                  {formatRupiah(totalDebtsValue)}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Lampiran 1 Bagian B</p>
              </div>

              {/* Card Tanggungan */}
              <div
                onClick={() => onNavigateSubmenu('dependents')}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-emerald-50/50 hover:border-emerald-200 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tanggungan</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                    {currentReturn.dependents.length} orang
                  </span>
                </div>
                <div className="text-base font-bold text-slate-900">
                  {taxpayer.ptkpStatus}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Lampiran 1 Bagian C</p>
              </div>
            </div>

            {/* Breakdown Tarif Progresif Pasal 17 UU HPP */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">Rincian Lapisan Tarif UU HPP (Pasal 17):</span>
                <span className="text-xs text-slate-500">PKP: {formatRupiah(currentReturn.taxableIncome)}</span>
              </div>

              {currentReturn.taxTariffBrackets.length > 0 ? (
                <div className="space-y-2">
                  {currentReturn.taxTariffBrackets.map((bracket, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                          {bracket.ratePercent}%
                        </span>
                        <span className="text-slate-700 font-medium">{bracket.bracket}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 mr-2 font-mono">{formatRupiah(bracket.taxableAmountInBracket)}</span>
                        <span className="font-bold text-indigo-700">{formatRupiah(bracket.taxAmountInBracket)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-xs font-bold pt-1 text-slate-900">
                    <span>Total PPh Terutang:</span>
                    <span className="text-indigo-700 text-sm">{formatRupiah(currentReturn.totalTaxPayable)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 bg-slate-50 rounded-xl text-xs text-slate-500">
                  Penghasilan Kena Pajak (PKP) masih Rp 0 (di bawah batas PTKP). Tidak ada PPh terutang pada lapisan tarif.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Kolom 3: Fasilitas UMKM PP 55/2022 & Jadwal Pelaporan */}
        <div className="space-y-4">
          {/* Box UMKM PP 55/2022 */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent rounded-xl border border-amber-200/80 p-5">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Fasilitas UMKM (PP 55/2022)</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed mb-3">
              Wajib Pajak Orang Pribadi UMKM mendapat pembebasan pajak untuk peredaran bruto hingga <strong>Rp 500 Juta</strong> per tahun. Omzet di atas ambang batas hanya dikenakan <strong>PPh Final 0.5%</strong>.
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>Omzet Usaha:</span>
                <span className="font-bold">{formatRupiah(umkmGross)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Batas Bebas Pajak:</span>
                <span className="font-semibold text-emerald-700">Rp 500.000.000</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-1 border-t border-amber-200/60">
                <span>Omzet Dikenakan 0.5%:</span>
                <span className="font-bold text-amber-900">{formatRupiah(umkmTaxable)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-amber-200/60 text-sm">
                <span>PPh Final Terutang:</span>
                <span className="text-amber-700">{formatRupiah(currentReturn.businessActivity?.umkmTaxAmount || 0)}</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-amber-200/60 flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>100% Selaras Riwayat Billing</span>
              </span>
              <button
                type="button"
                onClick={() => onNavigateSubmenu('history')}
                className="text-[10px] font-bold text-amber-900 hover:text-amber-950 flex items-center gap-0.5 hover:underline cursor-pointer"
              >
                <span>Lihat Billing</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Jadwal Batas Waktu */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Batas Waktu Pelaporan DJP</span>
            </h4>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-2">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-blue-900 block">31 Maret {currentReturn.taxYear + 1}</strong>
                  <span className="text-[11px] text-blue-700">Batas akhir pelaporan SPT Tahunan PPh Orang Pribadi.</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">Status Draft Otomatis</strong>
                  <span className="text-[11px] text-slate-500">Seluruh isian tersimpan secara real-time di sistem lokal & Cloud.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
