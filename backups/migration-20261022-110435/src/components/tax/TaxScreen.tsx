/**
 * Coded by Langgo Bramandityo.
 * Modul Utama Pengisian Pajak Indonesia (Khusus Akun DEVELOPER)
 * Mendukung SPT Tahunan Orang Pribadi 2025 & Placeholder SPT Tahunan PPh Badan
 */
import React, { useState, useEffect } from 'react';
import {
  TaxAnnualReturn1770,
  TaxpayerProfile,
} from '../../types/tax';
import {
  getStoredTaxpayerProfile,
  saveStoredTaxpayerProfile,
  getStoredAnnualReturns,
  saveStoredAnnualReturns,
  recomputeTaxReturn,
  createInitialTaxReturn,
  syncReturnWithMonthlyBillings,
  syncAllReturnsWithMonthlyBillings,
  clearAllDummyTaxData,
} from '../../utils/taxStorage';

// Subcomponents
import { TaxCorporatePlaceholder } from './TaxCorporatePlaceholder';
import { TaxDashboard } from './TaxDashboard';
import { TaxpayerProfileView } from './TaxpayerProfileView';
import { TaxFilingWizard } from './TaxFilingWizard';
import { TaxIncomeView } from './TaxIncomeView';
import { TaxAssetsView } from './TaxAssetsView';
import { TaxDebtsView } from './TaxDebtsView';
import { TaxDependentsView } from './TaxDependentsView';
import { TaxWithholdingView } from './TaxWithholdingView';
import { TaxFinalNonTaxableView } from './TaxFinalNonTaxableView';
import { TaxForeignIncomeView } from './TaxForeignIncomeView';
import { TaxAttachmentsView } from './TaxAttachmentsView';
import { TaxFilingHistoryView } from './TaxFilingHistoryView';
import { TaxSettingsView } from './TaxSettingsView';
import { TaxOfficialPrintView } from './TaxOfficialPrintView';

import {
  FileText,
  Building2,
  User,
  LayoutDashboard,
  UserCheck,
  TrendingUp,
  Wallet,
  Landmark,
  Users,
  ShieldCheck,
  Percent,
  Globe,
  Paperclip,
  History,
  Settings,
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  Printer,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { DeveloperJokerIcon } from '../DeveloperJokerIcon';

type TaxMainModule = 'ORANG_PRIBADI' | 'BADAN';
type TaxSubmenuKey =
  | 'dashboard'
  | 'taxpayer'
  | 'wizard'
  | 'print'
  | 'income'
  | 'assets'
  | 'debts'
  | 'dependents'
  | 'withholding'
  | 'final'
  | 'foreign'
  | 'attachments'
  | 'history'
  | 'settings';

interface TaxScreenProps {
  onBackToApp?: () => void;
}

export const TaxScreen: React.FC<TaxScreenProps> = () => {
  const [mainModule, setMainModule] = useState<TaxMainModule>('ORANG_PRIBADI');
  const [activeSubmenu, setActiveSubmenu] = useState<TaxSubmenuKey>('dashboard');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStartStep, setWizardStartStep] = useState(1);

  // Stored state
  const [taxpayer, setTaxpayer] = useState<TaxpayerProfile>(() => getStoredTaxpayerProfile());
  const [allReturns, setAllReturns] = useState<TaxAnnualReturn1770[]>(() => getStoredAnnualReturns());
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Keep all returns in lockstep with Riwayat Pelaporan
  useEffect(() => {
    setAllReturns(prev => syncAllReturnsWithMonthlyBillings(prev));
  }, []);

  // Active return for selected year
  const activeReturn = allReturns.find(r => r.taxYear === selectedYear) || allReturns[0];

  // Switch or create return for selected year
  const handleSelectYear = (year: number) => {
    setSelectedYear(year);
    const existing = allReturns.find(r => r.taxYear === year);
    if (!existing) {
      const newRet = syncReturnWithMonthlyBillings(createInitialTaxReturn(year, taxpayer));
      const updatedList = [newRet, ...allReturns];
      setAllReturns(updatedList);
      saveStoredAnnualReturns(updatedList);
    }
  };

  // Save changes and recompute
  const handleUpdateActiveReturn = (updatedReturn: TaxAnnualReturn1770) => {
    const recalculated = recomputeTaxReturn(updatedReturn);
    const updatedList = allReturns.map(r => r.id === recalculated.id ? recalculated : r);
    setAllReturns(updatedList);
    saveStoredAnnualReturns(updatedList);
  };

  // Batch update all returns (e.g. from Riwayat Pelaporan sync)
  const handleUpdateAllReturns = (updatedList: TaxAnnualReturn1770[]) => {
    setAllReturns(updatedList);
    saveStoredAnnualReturns(updatedList);
  };

  // Re-synchronize all returns with monthly billings immediately
  const handleSyncAllWithBillings = () => {
    const synced = syncAllReturnsWithMonthlyBillings(allReturns);
    setAllReturns(synced);
    saveStoredAnnualReturns(synced);
  };

  const handleSaveTaxpayerProfile = (newProfile: TaxpayerProfile) => {
    setTaxpayer(newProfile);
    saveStoredTaxpayerProfile(newProfile);

    // Update taxpayer profile in active return
    if (activeReturn) {
      handleUpdateActiveReturn({
        ...activeReturn,
        taxpayer: newProfile,
      });
    }
  };

  const handleClearAllDummyData = () => {
    const { returns, taxpayer: cleanTaxpayer } = clearAllDummyTaxData();
    setTaxpayer(cleanTaxpayer);
    setAllReturns(returns);
  };

  const handleOpenWizard = (stepNumber = 1) => {
    setWizardStartStep(stepNumber);
    setIsWizardOpen(true);
  };

  const submenus: { key: TaxSubmenuKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'dashboard', label: '1. Dashboard Pajak', icon: LayoutDashboard },
    { key: 'taxpayer', label: '2. Data Wajib Pajak', icon: UserCheck },
    { key: 'wizard', label: `3. SPT Tahunan Orang Pribadi (${selectedYear})`, icon: FileText },
    { key: 'income', label: '4. Data Penghasilan', icon: TrendingUp },
    { key: 'assets', label: '5. Daftar Harta', icon: Wallet },
    { key: 'debts', label: '6. Daftar Utang', icon: Landmark },
    { key: 'dependents', label: '7. Data Tanggungan Keluarga', icon: Users },
    { key: 'withholding', label: '8. Bukti Potong & Kredit Pajak', icon: ShieldCheck },
    { key: 'final', label: '9. Penghasilan Final & Non-Objek', icon: Percent },
    { key: 'foreign', label: '10. Penghasilan Luar Negeri', icon: Globe },
    { key: 'attachments', label: '11. Lampiran dan Dokumen', icon: Paperclip },
    { key: 'history', label: '12. Riwayat Pelaporan', icon: History },
    { key: 'settings', label: '13. Pengaturan Pajak', icon: Settings },
  ];

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6 print:p-0 print:m-0 print:max-w-none print:w-full">
      {/* Top Banner & Module Selector */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-xs">
            <DeveloperJokerIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Modul Pengisian Pajak Internal
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold border border-indigo-200">
                DEVELOPER ONLY
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sistem Pelaporan SPT Tahunan berdasarkan Formulir Resmi DJP & UU Harmonisasi Peraturan Perpajakan (UU HPP 2025).
            </p>
          </div>
        </div>

        {/* 2 Main Modules Switcher */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-center">
          <button
            type="button"
            onClick={() => setMainModule('ORANG_PRIBADI')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainModule === 'ORANG_PRIBADI'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span>SPT Tahunan Orang Pribadi</span>
          </button>

          <button
            type="button"
            onClick={() => setMainModule('BADAN')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainModule === 'BADAN'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>SPT Tahunan PPH Badan</span>
          </button>
        </div>
      </div>

      {/* Main Module Content */}
      {mainModule === 'BADAN' ? (
        <TaxCorporatePlaceholder />
      ) : (
        /* ORANG PRIBADI MODULE */
        <div className="space-y-4 print:space-y-0 print:m-0 print:p-0">
          {/* Top Year Switcher & Current SPT Banner */}
          <div className="no-print bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>Pilih Tahun SPT:</span>
              </div>
              {[2026, 2025, 2024, 2023].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => handleSelectYear(yr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    selectedYear === yr
                      ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                >
                  Tahun {yr} {yr === 2026 && '(Form 2026)'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
              <span>
                Formulir Aktif: <strong className="text-white font-mono">1770 Th {activeReturn.taxYear}</strong> ({activeReturn.sptType})
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {activeReturn.settlementStatus}
              </span>
            </div>
          </div>

          {isWizardOpen ? (
            <TaxFilingWizard
              currentReturn={activeReturn}
              onUpdateReturn={handleUpdateActiveReturn}
              onCloseWizard={() => setIsWizardOpen(false)}
              initialStep={wizardStartStep}
              onOpenPrintView={() => {
                setIsWizardOpen(false);
                setActiveSubmenu('print');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start print:block print:w-full print:p-0 print:m-0">
              {/* Left Submenu Navigation Sidebar (13 Submenus) */}
              <div className="no-print bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-1 lg:sticky lg:top-20">
                <div className="px-3 py-2 border-b border-slate-100 flex flex-col gap-2 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Navigasi Submenu
                    </span>
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <select
                        value={selectedYear}
                        onChange={e => handleSelectYear(Number(e.target.value))}
                        className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                      >
                        <option value={2026}>2026 (Terbaru)</option>
                        <option value={2025}>2025</option>
                        <option value={2024}>2024</option>
                        <option value={2023}>2023</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Year Pill selector inside Navigasi Submenu */}
                  <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 mr-0.5">Tahun:</span>
                    {[2026, 2025, 2024, 2023].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => handleSelectYear(yr)}
                        className={`flex-1 py-1 rounded-md text-[11px] font-mono font-bold transition-all text-center cursor-pointer ${
                          selectedYear === yr
                            ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {yr}
                        {yr === 2026 && (
                          <span className="block text-[8px] leading-tight text-amber-500 font-sans font-black">
                            BARU
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Status Sinkronisasi Riwayat Pelaporan */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Data Selaras Billing</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleSyncAllWithBillings}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer hover:underline"
                      title="Klik untuk memastikan seluruh data SPT 1770 dan Dashboard selaras dengan data Riwayat Pelaporan"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Sinkronkan</span>
                    </button>
                  </div>
                </div>

                {submenus.map(menu => {
                  const Icon = menu.icon;
                  const isActive = activeSubmenu === menu.key || (menu.key === 'wizard' && activeSubmenu === 'print');
                  return (
                    <button
                      key={menu.key}
                      type="button"
                      onClick={() => setActiveSubmenu(menu.key)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                        <span className="truncate">{menu.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {menu.key === 'wizard' && (
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                            isActive ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {selectedYear}
                          </span>
                        )}
                        <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-200' : 'text-slate-300'}`} />
                      </div>
                    </button>
                  );
                })}

                <div className="pt-3 mt-2 border-t border-slate-100 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveSubmenu('print')}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-blue-300" />
                    <span>Cetak Formulir 1770</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenWizard(1)}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-blue-200" />
                    <span>Wizard 12 Langkah</span>
                  </button>
                </div>
              </div>

              {/* Right Main Content Pane */}
              <div className="lg:col-span-3 print:col-span-4 print:w-full print:max-w-none print:p-0 print:m-0">
                {activeSubmenu === 'dashboard' && (
                  <TaxDashboard
                    currentReturn={activeReturn}
                    taxpayer={taxpayer}
                    onOpenWizard={handleOpenWizard}
                    onNavigateSubmenu={(sub) => setActiveSubmenu(sub as TaxSubmenuKey)}
                    onOpenPrintView={() => setActiveSubmenu('print')}
                  />
                )}

                {(activeSubmenu === 'wizard' || activeSubmenu === 'print') && (
                  <TaxOfficialPrintView
                    currentReturn={activeReturn}
                    taxpayer={taxpayer}
                    onBack={() => setActiveSubmenu('dashboard')}
                    onOpenWizard={handleOpenWizard}
                  />
                )}

                {activeSubmenu === 'taxpayer' && (
                  <TaxpayerProfileView
                    taxpayer={taxpayer}
                    onSaveProfile={handleSaveTaxpayerProfile}
                  />
                )}

                {activeSubmenu === 'income' && (
                  <TaxIncomeView
                    currentReturn={activeReturn}
                    onUpdateReturn={handleUpdateActiveReturn}
                    onNavigateSubmenu={(sub) => setActiveSubmenu(sub as TaxSubmenuKey)}
                  />
                )}

                {activeSubmenu === 'assets' && (
                  <TaxAssetsView
                    currentReturn={activeReturn}
                    onUpdateReturn={handleUpdateActiveReturn}
                  />
                )}

                {activeSubmenu === 'debts' && (
                  <TaxDebtsView
                    currentReturn={activeReturn}
                    onUpdateReturn={handleUpdateActiveReturn}
                  />
                )}

                {activeSubmenu === 'dependents' && (
                  <TaxDependentsView
                    currentReturn={activeReturn}
                    onUpdateReturn={handleUpdateActiveReturn}
                  />
                )}

                {activeSubmenu === 'withholding' && (
                  <TaxWithholdingView
                    currentReturn={activeReturn}
                    onUpdateReturn={handleUpdateActiveReturn}
                  />
                )}

                {activeSubmenu === 'final' && (
                  <TaxFinalNonTaxableView
                    currentReturn={activeReturn}
                    onUpdateReturn={handleUpdateActiveReturn}
                    onNavigateSubmenu={(sub) => setActiveSubmenu(sub as TaxSubmenuKey)}
                  />
                )}

                {activeSubmenu === 'foreign' && (
                  <TaxForeignIncomeView
                    currentReturn={activeReturn}
                    onUpdateReturn={handleUpdateActiveReturn}
                  />
                )}

                {activeSubmenu === 'attachments' && (
                  <TaxAttachmentsView
                    currentReturn={activeReturn}
                    onOpenPrintView={() => setActiveSubmenu('print')}
                  />
                )}

                {activeSubmenu === 'history' && (
                  <TaxFilingHistoryView
                    allReturns={allReturns}
                    currentReturn={activeReturn}
                    onSelectReturn={(ret) => handleSelectYear(ret.taxYear)}
                    onUpdateReturn={handleUpdateActiveReturn}
                    onUpdateAllReturns={handleUpdateAllReturns}
                  />
                )}

                {activeSubmenu === 'settings' && (
                  <TaxSettingsView onClearDummyData={handleClearAllDummyData} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
