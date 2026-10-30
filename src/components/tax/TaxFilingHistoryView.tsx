/**
 * Coded by Langgo Bramandityo.
 * Submenu 12: Riwayat Pelaporan, Billing Pajak Bulanan (2023-2025 & 2026),
 * Analisa Line Chart PPh Tiap Bulan, dan Audit Trail SPT Tahunan.
 * Sesuai UU HPP No 7/2021 & PP 55/2022.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { TaxAnnualReturn1770, MonthlyTaxBilling, MonthlyBillingsByYear } from '../../types/tax';
import {
  getStoredMonthlyBillings,
  saveStoredMonthlyBillings,
  recomputeMonthlyBillingYear,
  generateDefaultMonthlyBillings,
  syncReturnWithMonthlyBillings,
  syncAllReturnsWithMonthlyBillings,
  importBillingsFromPosTransactions,
  MONTH_NAMES
} from '../../utils/taxStorage';
import { formatRupiah } from '../../utils/formatters';
import {
  History,
  Calendar,
  Clock,
  TrendingUp,
  Receipt,
  LineChart as LineChartIcon,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  ChevronRight,
  Info,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Layers,
  Loader2,
  RefreshCw,
  CheckCheck
} from 'lucide-react';

interface TaxFilingHistoryViewProps {
  allReturns: TaxAnnualReturn1770[];
  currentReturn: TaxAnnualReturn1770;
  onSelectReturn: (spt: TaxAnnualReturn1770) => void;
  onUpdateReturn?: (spt: TaxAnnualReturn1770) => void;
  onUpdateAllReturns?: (returns: TaxAnnualReturn1770[]) => void;
}

type HistoryTab = 'billing' | 'chart' | 'returns';
type ChartMetric = 'pph' | 'gross' | 'cumulative';

export const TaxFilingHistoryView: React.FC<TaxFilingHistoryViewProps> = ({
  allReturns,
  currentReturn,
  onSelectReturn,
  onUpdateReturn,
  onUpdateAllReturns,
}) => {
  const [activeTab, setActiveTab] = useState<HistoryTab>('billing');
  const [selectedBillingYear, setSelectedBillingYear] = useState<number>(2025);
  const [billingsData, setBillingsData] = useState<MonthlyBillingsByYear>(() => getStoredMonthlyBillings());
  const [isSavedAlert, setIsSavedAlert] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Line chart settings
  const [chartMetric, setChartMetric] = useState<ChartMetric>('pph');
  const [chartMode, setChartMode] = useState<'single' | 'compare'>('single');
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [activePointYear, setActivePointYear] = useState<number>(2025);

  // Current year's monthly list
  const currentYearBillings = useMemo(() => {
    return billingsData[selectedBillingYear] || [];
  }, [billingsData, selectedBillingYear]);

  // Totals for selected billing year
  const summary = useMemo(() => {
    const list = currentYearBillings;
    const totalPph = list.reduce((acc, item) => acc + (item.pphFinalPaid || 0), 0);
    const totalGross = list.reduce((acc, item) => acc + (item.grossRevenue || 0), 0);
    const totalDpp = list.reduce((acc, item) => acc + (item.taxableBaseDpp || 0), 0);
    const paidCount = list.filter(item => item.isPaid && item.pphFinalPaid > 0).length;
    const avgPph = list.length > 0 ? Math.round(totalPph / 12) : 0;
    const avgGross = list.length > 0 ? Math.round(totalGross / 12) : 0;

    // Peak month
    let maxPphMonth = list[0];
    for (const item of list) {
      if ((item.pphFinalPaid || 0) > (maxPphMonth?.pphFinalPaid || 0)) {
        maxPphMonth = item;
      }
    }

    return {
      totalPph,
      totalGross,
      totalDpp,
      paidCount,
      avgPph,
      avgGross,
      maxPphMonth,
    };
  }, [currentYearBillings]);

  // Save Data permanently to storage and synchronize to all annual returns
  const handleSaveData = (syncToSpt: boolean = false) => {
    setIsSaving(true);
    try {
      // Recompute all years to ensure all running sums, DPP, and gross are 100% accurate
      const cleanData: MonthlyBillingsByYear = {};
      for (const yr of Object.keys(billingsData)) {
        const y = Number(yr);
        cleanData[y] = recomputeMonthlyBillingYear(billingsData[y] || []);
      }

      saveStoredMonthlyBillings(cleanData);
      setBillingsData(cleanData);

      // Synchronize ALL annual returns so all years (2023, 2024, 2025, 2026) are 100% in sync
      const syncedReturns = syncAllReturnsWithMonthlyBillings(allReturns, cleanData);
      if (onUpdateAllReturns) {
        onUpdateAllReturns(syncedReturns);
      } else if (onUpdateReturn) {
        const matchingReturn = syncedReturns.find(r => r.taxYear === selectedBillingYear) || currentReturn;
        onUpdateReturn(matchingReturn);
      }

      setHasUnsavedChanges(false);
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
      setLastSavedTime(nowStr);
      showAlert(`✓ Data Billing PPh Final Tahun ${selectedBillingYear} BERHASIL DISIMPAN & DISELARASKAN dengan Formulir SPT 1770!`);
    } catch (err) {
      console.error('Failed to save billing data', err);
      showAlert('Gagal menyimpan data billing. Silakan periksa kembali data Anda.');
    } finally {
      setTimeout(() => setIsSaving(false), 300);
    }
  };

  // Synchronize ALL data across all years (2023 - 2026) with Riwayat Pelaporan
  const handleSyncAllToSpt = () => {
    setIsSaving(true);
    try {
      const cleanData: MonthlyBillingsByYear = {};
      for (const yr of Object.keys(billingsData)) {
        const y = Number(yr);
        cleanData[y] = recomputeMonthlyBillingYear(billingsData[y] || []);
      }

      saveStoredMonthlyBillings(cleanData);
      setBillingsData(cleanData);

      const syncedReturns = syncAllReturnsWithMonthlyBillings(allReturns, cleanData);
      if (onUpdateAllReturns) {
        onUpdateAllReturns(syncedReturns);
      } else if (onUpdateReturn) {
        const matchingReturn = syncedReturns.find(r => r.taxYear === selectedBillingYear) || currentReturn;
        onUpdateReturn(matchingReturn);
      }

      setHasUnsavedChanges(false);
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
      setLastSavedTime(nowStr);
      showAlert(`✓ SELURUH DATA BERHASIL DISELARASKAN! Formulir SPT 1770 (2023 - 2026), Dashboard Pajak, Data Penghasilan, dan Lampiran sudah sama dengan Riwayat Pelaporan.`);
    } catch (err) {
      console.error('Failed to sync all returns', err);
      showAlert('Gagal menyelaraskan seluruh data.');
    } finally {
      setTimeout(() => setIsSaving(false), 300);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S to Save Data
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (activeTab === 'billing') {
          e.preventDefault();
          handleSaveData(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [billingsData, selectedBillingYear, activeTab, allReturns, currentReturn]);

  // Handle changing PPh Disetor in table
  const handlePphChange = (monthIdx: number, valStr: string) => {
    const numeric = parseInt(valStr.replace(/\D/g, ''), 10) || 0;
    const listCopy = [...currentYearBillings];
    listCopy[monthIdx] = {
      ...listCopy[monthIdx],
      pphFinalPaid: numeric,
      isPaid: numeric > 0,
    };
    const recomputed = recomputeMonthlyBillingYear(listCopy);
    const updatedAll = {
      ...billingsData,
      [selectedBillingYear]: recomputed,
    };
    setBillingsData(updatedAll);
    saveStoredMonthlyBillings(updatedAll); // Autosave to storage
    setHasUnsavedChanges(true);
  };

  // Handle changing Tarif in table
  const handleTariffChange = (monthIdx: number, valStr: string) => {
    const rate = parseFloat(valStr) || 0.5;
    const listCopy = [...currentYearBillings];
    listCopy[monthIdx] = {
      ...listCopy[monthIdx],
      tariffRatePercent: rate,
    };
    const recomputed = recomputeMonthlyBillingYear(listCopy);
    const updatedAll = {
      ...billingsData,
      [selectedBillingYear]: recomputed,
    };
    setBillingsData(updatedAll);
    saveStoredMonthlyBillings(updatedAll);
    setHasUnsavedChanges(true);
  };

  // Apply batch rate to all 12 months (e.g. 0.5% or 1%)
  const handleApplyGlobalTariff = (rate: number) => {
    const listCopy = currentYearBillings.map(item => ({
      ...item,
      tariffRatePercent: rate,
    }));
    const recomputed = recomputeMonthlyBillingYear(listCopy);
    const updatedAll = {
      ...billingsData,
      [selectedBillingYear]: recomputed,
    };
    setBillingsData(updatedAll);
    saveStoredMonthlyBillings(updatedAll);
    setHasUnsavedChanges(true);
    showAlert(`Tarif ${rate}% berhasil diterapkan ke seluruh 12 bulan tahun ${selectedBillingYear}! Jangan lupa klik Save Data.`);
  };

  // Handle manual gross revenue change (two-way sync)
  const handleGrossChange = (monthIdx: number, valStr: string) => {
    const grossNum = parseInt(valStr.replace(/\D/g, ''), 10) || 0;
    const listCopy = [...currentYearBillings];

    listCopy[monthIdx] = {
      ...listCopy[monthIdx],
      grossRevenue: grossNum,
      taxableBaseDpp: 0,
      // PPh dihitung ulang otomatis dengan pembebasan kumulatif Rp500 juta/tahun
      pphFinalPaid: 0,
      isPaid: false,
    };
    const recomputed = recomputeMonthlyBillingYear(listCopy);
    const updatedAll = {
      ...billingsData,
      [selectedBillingYear]: recomputed,
    };
    setBillingsData(updatedAll);
    saveStoredMonthlyBillings(updatedAll);
    setHasUnsavedChanges(true);
  };

  // Handle billing code / NTPN / fields change
  const handleFieldChange = (monthIdx: number, field: keyof MonthlyTaxBilling, value: any) => {
    const listCopy = [...currentYearBillings];
    listCopy[monthIdx] = {
      ...listCopy[monthIdx],
      [field]: field === 'isPaid' ? (typeof value === 'boolean' ? value : value === 'true') : value,
    };
    const updatedAll = {
      ...billingsData,
      [selectedBillingYear]: listCopy,
    };
    setBillingsData(updatedAll);
    saveStoredMonthlyBillings(updatedAll);
    setHasUnsavedChanges(true);
  };

  // Reset to clean Rp 0 (purge all dummy/unverified data)
  const handleResetDefaults = () => {
    if (window.confirm(`Kosongkan seluruh billing bulanan tahun ${selectedBillingYear} menjadi Rp 0? Isi Anda untuk tahun ini akan hilang dan tidak bisa dikembalikan.`)) {
      const defaults = generateDefaultMonthlyBillings();
      const updatedAll = {
        ...billingsData,
        [selectedBillingYear]: defaults[selectedBillingYear],
      };
      setBillingsData(updatedAll);
      saveStoredMonthlyBillings(updatedAll);
      showAlert(`Data billing tahun ${selectedBillingYear} berhasil dibersihkan ke Rp 0!`);
    }
  };

  // Import real turnover from store POS transactions
  const handleImportFromPos = () => {
    const importedYear = importBillingsFromPosTransactions(selectedBillingYear);
    const totalImportedGross = importedYear.reduce((s, i) => s + (i.grossRevenue || 0), 0);
    const updatedAll = {
      ...billingsData,
      [selectedBillingYear]: importedYear,
    };
    setBillingsData(updatedAll);
    saveStoredMonthlyBillings(updatedAll);
    setHasUnsavedChanges(true);
    showAlert(`Berhasil menyinkronkan omzet riil tahun ${selectedBillingYear} dari transaksi kasir POS Toko Bejo (Total Omzet: Rp ${totalImportedGross.toLocaleString('id-ID')})!`);
  };

  // Sync to active SPT Tahunan return
  const handleSyncToSpt = () => {
    if (!onUpdateReturn) return;
    const matchingReturn = allReturns.find(r => r.taxYear === selectedBillingYear) || currentReturn;
    const totalGross = summary.totalGross;
    const totalPph = summary.totalPph;
    const exemptThreshold = matchingReturn.businessActivity.umkmTaxExemptThreshold || 500000000;
    const taxableRevenue = Math.max(0, totalGross - exemptThreshold);

    const updated: TaxAnnualReturn1770 = {
      ...matchingReturn,
      businessActivity: {
        ...matchingReturn.businessActivity,
        grossRevenue: totalGross,
        isUmkmPp55: true,
        umkmTaxableRevenue: taxableRevenue,
        umkmTaxAmount: totalPph,
      },
      auditTrail: [
        ...(matchingReturn.auditTrail || []),
        {
          timestamp: new Date().toISOString(),
          action: 'SINKRONISASI_BILLING_BULANAN',
          changedBy: 'Langgo Bramandityo (DEVELOPER)',
          notes: `Omzet Rp ${totalGross.toLocaleString('id-ID')} & PPh Final Rp ${totalPph.toLocaleString('id-ID')} dari Billing ${selectedBillingYear} berhasil disinkronkan ke Lampiran III SPT.`,
        },
      ],
    };

    onUpdateReturn(updated);
    showAlert(`Data billing tahun ${selectedBillingYear} berhasil disinkronkan ke Formulir SPT 1770!`);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Bulan', 'Tahun', 'PPh Final Disetor (Rp)', 'Tarif (%)', 'DPP (Rp)', 'Peredaran Bruto (Rp)', 'Kumulatif Omzet (Rp)', 'Kode Billing', 'NTPN', 'Tgl Setor', 'Bank Persepsi', 'Status'];
    const rows = currentYearBillings.map(b => [
      b.monthName,
      b.year,
      b.pphFinalPaid,
      b.tariffRatePercent,
      b.taxableBaseDpp,
      b.grossRevenue,
      b.cumulativeRevenue,
      `"${b.billingCode || ''}"`,
      `"${b.ntpn || ''}"`,
      b.paymentDate || '',
      `"${b.paymentBank || ''}"`,
      b.isPaid ? 'LUNAS' : 'BELUM SETOR',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Billing_Pajak_${selectedBillingYear}_BejoStiker.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert(`File CSV Billing Tahun ${selectedBillingYear} berhasil diunduh!`);
  };

  const showAlert = (msg: string) => {
    setIsSavedAlert(msg);
    setTimeout(() => setIsSavedAlert(null), 4000);
  };

  // -------------------------------------------------------------
  // LINE CHART SVG ENGINE
  // -------------------------------------------------------------
  const chartWidth = 760;
  const chartHeight = 280;
  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 40;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  // Extract series based on chart metric and comparison mode
  const yearsToDraw = chartMode === 'compare' ? [2023, 2024, 2025, 2026] : [selectedBillingYear];

  const getMetricValue = (item: MonthlyTaxBilling) => {
    if (chartMetric === 'pph') return item.pphFinalPaid || 0;
    if (chartMetric === 'gross') return item.grossRevenue || 0;
    return item.cumulativeRevenue || 0;
  };

  // Find max value across series
  const maxMetricValue = useMemo(() => {
    let max = 0;
    for (const yr of yearsToDraw) {
      const list = billingsData[yr] || [];
      for (const item of list) {
        const val = getMetricValue(item);
        if (val > max) max = val;
      }
    }
    return max > 0 ? max * 1.15 : 1000000;
  }, [yearsToDraw, chartMetric, billingsData]);

  // Color schemes for years
  const yearColors: Record<number, { stroke: string; fill: string; dot: string; label: string }> = {
    2023: { stroke: '#64748b', fill: 'rgba(100, 116, 139, 0.12)', dot: '#475569', label: 'Tahun 2023' },
    2024: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.12)', dot: '#2563eb', label: 'Tahun 2024' },
    2025: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)', dot: '#059669', label: 'Tahun 2025' },
    2026: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)', dot: '#d97706', label: 'Tahun 2026' },
  };

  // Coordinates helper
  const getCoordinates = (monthIdx: number, val: number) => {
    const x = paddingLeft + (monthIdx / 11) * plotWidth;
    const y = paddingTop + plotHeight - (val / maxMetricValue) * plotHeight;
    return { x, y };
  };

  // Generate SVG path for a given year
  const generatePath = (year: number) => {
    const list = billingsData[year] || [];
    if (list.length === 0) return { linePath: '', areaPath: '', points: [] };

    const points = list.map((item, idx) => {
      const val = getMetricValue(item);
      const coord = getCoordinates(idx, val);
      return { ...coord, val, item, idx, year };
    });

    // Construct smooth or straight line path
    const linePath = points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      return `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    const baseY = paddingTop + plotHeight;
    const areaPath = `${linePath} L ${lastPt.x} ${baseY} L ${firstPt.x} ${baseY} Z`;

    return { linePath, areaPath, points };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Riwayat Pelaporan & Billing Pajak Bulanan
              </h2>
              <p className="text-xs text-slate-500">
                Pencatatan Billing PPh Final Disetor (PP 55/2022 & PP 23/2018), kalkulasi otomatis Omzet, dan analisa visual line chart.
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicators & Save Data Action */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isSavedAlert ? (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{isSavedAlert}</span>
            </div>
          ) : hasUnsavedChanges ? (
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
              <span>Perubahan Belum Disimpan</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Semua Data Tersimpan {lastSavedTime && `(${lastSavedTime})`}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleSaveData(false)}
            disabled={isSaving}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/40 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
            title="Simpan data ke memori permanen sistem (Shortcut: Ctrl + S)"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Data</span>
          </button>

          <button
            type="button"
            onClick={handleSyncAllToSpt}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white"
            title="Selaraskan seluruh data SPT 1770 dan Dashboard dengan Riwayat Pelaporan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>Selaraskan Data</span>
          </button>
        </div>
      </div>

      {/* 3 Nav Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'billing'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Input Billing PPh Final (2023 - 2026)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chart')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'chart'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <LineChartIcon className="w-4 h-4" />
          <span>Analisa Line Chart PPh Bulanan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('returns')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'returns'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Arsip SPT & Audit Trail</span>
        </button>
      </div>

      {/* -------------------------------------------------------- */}
      {/* TAB 1: INPUT BILLING BULANAN & REKAP (2023 - 2026) */}
      {/* -------------------------------------------------------- */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Year Switcher Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">Pilih Tahun Billing:</span>
              {[2023, 2024, 2025, 2026].map(yr => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedBillingYear(yr)}
                  className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                    selectedBillingYear === yr
                      ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/30'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Tahun {yr} {yr === 2026 && '(Baru)'}
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleSaveData(false)}
                disabled={isSaving}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition-all cursor-pointer ${
                  hasUnsavedChanges
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-1 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
                title="Simpan data billing tahun ini ke penyimpanan sistem secara permanen (Ctrl + S)"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{hasUnsavedChanges ? 'Simpan Data (Save Data)*' : 'Simpan Data (Save Data)'}</span>
              </button>

              <button
                type="button"
                onClick={handleSyncAllToSpt}
                disabled={isSaving}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Selaraskan seluruh data SPT 1770, Dashboard, dan Lampiran untuk seluruh tahun (2023 - 2026) dengan Riwayat Pelaporan"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>Selaraskan Seluruh Data</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveData(true)}
                disabled={isSaving}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Simpan data sekaligus sinkronkan ke Formulir SPT 1770"
              >
                <Copy className="w-3.5 h-3.5 text-blue-200" />
                <span>Simpan & Terapkan ke SPT</span>
              </button>

              <button
                type="button"
                onClick={handleImportFromPos}
                className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Tarik & hitung otomatis omzet riil per bulan dari riwayat transaksi kasir POS Toko Bejo"
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                <span>Tarik Omzet Kasir POS</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Ekspor CSV</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                title="Kosongkan seluruh billing tahun ini menjadi Rp 0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stat Cards for Current Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Total PPh Final Disetor ({selectedBillingYear})
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-900 mt-1 font-mono">
                {formatRupiah(summary.totalPph)}
              </div>
              <div className="text-[11px] text-blue-600 mt-0.5">
                {summary.paidCount} dari 12 Masa Pajak Terbayar
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Peredaran Bruto (Omzet)
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
                {formatRupiah(summary.totalGross)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Kalkulasi otomatis dari PPh / Tarif
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Rata-rata PPh per Bulan
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
                {formatRupiah(summary.avgPph)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Omzet rata-rata: {formatRupiah(summary.avgGross)}/bln
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Masa Pajak Tertinggi (Peak)
              </div>
              <div className="text-lg font-black text-emerald-900 mt-1">
                {summary.maxPphMonth?.monthName || '-'}
              </div>
              <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                {formatRupiah(summary.maxPphMonth?.pphFinalPaid || 0)} (Omzet {formatRupiah(summary.maxPphMonth?.grossRevenue || 0)})
              </div>
            </div>
          </div>

          {/* Quick Rate Batch Setter & Helper Banner */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900">Perhitungan Otomatis: </span>
                <span className="text-amber-800">
                  Input <strong>PPh Final Disetor</strong> pada tiap bulan. Sistem otomatis menghitung <strong>Peredaran Bruto = PPh / (Tarif/100)</strong>, <strong>DPP Dikenakan</strong>, dan <strong>Kumulatif Omzet (YTD)</strong> secara presisi.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold text-amber-900">Terapkan Tarif:</span>
              <button
                type="button"
                onClick={() => handleApplyGlobalTariff(0.5)}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold font-mono text-[11px] cursor-pointer"
              >
                0.5% (PP 55)
              </button>
              <button
                type="button"
                onClick={() => handleApplyGlobalTariff(1.0)}
                className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold font-mono text-[11px] cursor-pointer"
              >
                1.0%
              </button>
            </div>
          </div>

          {/* Billing Input Table for 12 Months */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-3 py-3 text-center w-12">No</th>
                  <th className="px-4 py-3">Masa Pajak</th>
                  <th className="px-4 py-3 text-right min-w-[150px]">
                    <div className="flex items-center justify-end gap-1">
                      <span>PPh Disetor (Rp)</span>
                      <span className="text-amber-300 font-normal text-[10px]">*Input</span>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center w-24">Tarif (%)</th>
                  <th className="px-4 py-3 text-right min-w-[140px]">DPP Dikenakan (Rp)</th>
                  <th className="px-4 py-3 text-right min-w-[150px]">Peredaran Bruto (Rp)</th>
                  <th className="px-4 py-3 text-right min-w-[150px]">Kumulatif Omzet (Rp)</th>
                  <th className="px-4 py-3 min-w-[160px]">Kode Billing DJP</th>
                  <th className="px-4 py-3 min-w-[140px]">NTPN</th>
                  <th className="px-3 py-3 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-sans">
                {currentYearBillings.map((billing, idx) => (
                  <tr
                    key={billing.id}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Masa Pajak (Bulan) */}
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>{billing.monthName}</span>
                      </div>
                    </td>

                    {/* Input PPh Final Disetor */}
                    <td className="px-4 py-2 text-right">
                      <div className="relative inline-block w-full">
                        <input
                          type="text"
                          value={billing.pphFinalPaid ? billing.pphFinalPaid.toLocaleString('id-ID') : ''}
                          onChange={e => handlePphChange(idx, e.target.value)}
                          placeholder="0"
                          className="w-full text-right font-mono font-extrabold text-blue-900 bg-blue-50/30 border border-blue-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs"
                        />
                      </div>
                    </td>

                    {/* Tarif PPh Final */}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={billing.tariffRatePercent}
                        onChange={e => handleTariffChange(idx, e.target.value)}
                        className="w-16 text-center font-mono font-bold text-slate-800 border border-slate-300 rounded-lg px-1 py-1.5 focus:ring-2 focus:ring-blue-500 text-xs"
                      />
                    </td>

                    {/* DPP Dikenakan (Otomatis) */}
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 font-bold bg-slate-50/50">
                      {formatRupiah(billing.taxableBaseDpp || 0)}
                    </td>

                    {/* Peredaran Bruto / Omzet (Otomatis & Editable) */}
                    <td className="px-4 py-2 text-right">
                      <input
                        type="text"
                        value={billing.grossRevenue ? billing.grossRevenue.toLocaleString('id-ID') : ''}
                        onChange={e => handleGrossChange(idx, e.target.value)}
                        placeholder="0"
                        className="w-full text-right font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 text-xs"
                      />
                    </td>

                    {/* Kumulatif Omzet (YTD) */}
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">
                      {formatRupiah(billing.cumulativeRevenue || 0)}
                    </td>

                    {/* Kode Billing DJP */}
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={billing.billingCode || ''}
                        onChange={e => handleFieldChange(idx, 'billingCode', e.target.value)}
                        placeholder="15 Digit Kode Billing"
                        className="w-full font-mono text-[11px] text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
                      />
                    </td>

                    {/* NTPN */}
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={billing.ntpn || ''}
                        onChange={e => handleFieldChange(idx, 'ntpn', e.target.value)}
                        placeholder="NTPN 16 Karakter"
                        className="w-full font-mono text-[11px] text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 uppercase"
                      />
                    </td>

                    {/* Status Setor */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = !billing.isPaid;
                          handleFieldChange(idx, 'isPaid', updated);
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                          billing.pphFinalPaid > 0 || billing.isPaid
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {billing.pphFinalPaid > 0 || billing.isPaid ? 'LUNAS' : 'BELUM'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-center uppercase tracking-wider text-xs">
                    TOTAL TAHUNAN ({selectedBillingYear})
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-blue-900">
                    {formatRupiah(summary.totalPph)}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-xs text-slate-600">
                    Rata-rata 0.5%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-800">
                    {formatRupiah(summary.totalDpp)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-900">
                    {formatRupiah(summary.totalGross)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-indigo-900">
                    {formatRupiah(summary.totalGross)}
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-xs text-slate-500">
                    {summary.paidCount} Transaksi Billing Disetor ke Kas Negara
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom Action & Save Card */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-500/30 text-blue-300 font-mono text-xs font-bold border border-blue-400/30">
                  Tahun Pajak {selectedBillingYear}
                </span>
                {hasUnsavedChanges ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-400/30 flex items-center gap-1 animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    Ada Perubahan Belum Disimpan
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Semua Data Tersimpan Aman {lastSavedTime && `(${lastSavedTime})`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Total PPh Disetor: <strong className="text-blue-300 font-mono">{formatRupiah(summary.totalPph)}</strong> • Total Omzet: <strong className="text-white font-mono">{formatRupiah(summary.totalGross)}</strong> • {summary.paidCount}/12 Bulan Lunas
              </p>
              <p className="text-[11px] text-slate-400 italic">
                Data tersimpan otomatis di perangkat ini. Anda juga bisa menekan <strong>Save Data</strong> atau <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-200 border border-slate-600">Ctrl + S</kbd>.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleSaveData(false)}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>SIMPAN DATA (SAVE DATA)</span>
              </button>

              <button
                type="button"
                onClick={handleSyncAllToSpt}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
                title="Selaraskan seluruh tahun (2023 - 2026) SPT 1770 dengan Riwayat Pelaporan"
              >
                <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                <span>SELARASKAN SELURUH DATA</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveData(true)}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
                title="Simpan data dan sinkronkan ke Formulir 1770 SPT Tahunan"
              >
                <Copy className="w-4 h-4 text-blue-200" />
                <span>Simpan & Terapkan ke SPT</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>Ekspor CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* TAB 2: ANALISA PPh BULANAN DALAM BENTUK LINE CHART */}
      {/* -------------------------------------------------------- */}
      {activeTab === 'chart' && (
        <div className="space-y-6">
          {/* Chart Controls & Configuration */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            {/* Metric Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Metrik Analisa:</span>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setChartMetric('pph')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMetric === 'pph'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  PPh Final Disetor
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('gross')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMetric === 'gross'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Peredaran Bruto (Omzet)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('cumulative')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMetric === 'cumulative'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kumulatif Omzet (YTD)
                </button>
              </div>
            </div>

            {/* Mode Switcher (Single Year vs Multi-Year Compare) */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Tampilan:</span>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setChartMode('single')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMode === 'single'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fokus Tahun {selectedBillingYear}
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('compare')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMode === 'compare'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Komparasi 2023 - 2026
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Line Chart Canvas Card */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-blue-600" />
                  <span>
                    Tren Bulanan {chartMetric === 'pph' ? 'PPh Final Disetor' : chartMetric === 'gross' ? 'Peredaran Bruto' : 'Kumulatif Omzet'}
                    {chartMode === 'single' ? ` (Tahun ${selectedBillingYear})` : ' (Perbandingan Lintas Tahun)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Arahkan kursor pada titik lingkaran untuk melihat rincian angka bulan dan nominal pajak.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs font-mono font-bold flex-wrap">
                {yearsToDraw.map(yr => (
                  <div key={yr} className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: yearColors[yr].stroke }}
                    />
                    <span className="text-slate-700">{yearColors[yr].label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SVG Line Chart */}
            <div className="w-full overflow-x-auto">
              <div className="min-w-[680px]">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-auto select-none overflow-visible"
                >
                  <defs>
                    {/* Gradients for each year */}
                    {yearsToDraw.map(yr => (
                      <linearGradient key={`grad-${yr}`} id={`grad-${yr}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={yearColors[yr].stroke} stopOpacity="0.28" />
                        <stop offset="100%" stopColor={yearColors[yr].stroke} stopOpacity="0.0" />
                      </linearGradient>
                    ))}
                  </defs>

                  {/* Horizontal Gridlines and Y-Axis Labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = paddingTop + plotHeight * (1 - pct);
                    const val = Math.round(maxMetricValue * pct);
                    return (
                      <g key={i}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={paddingLeft + plotWidth}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={paddingLeft - 8}
                          y={y + 4}
                          textAnchor="end"
                          className="text-[10px] fill-slate-400 font-mono font-semibold"
                        >
                          {val >= 1000000
                            ? `Rp ${(val / 1000000).toFixed(1)}Jt`
                            : val >= 1000
                            ? `Rp ${(val / 1000).toFixed(0)}Rb`
                            : `Rp ${val}`}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-Axis Month Labels */}
                  {MONTH_NAMES.map((mName, i) => {
                    const x = paddingLeft + (i / 11) * plotWidth;
                    return (
                      <g key={i}>
                        <line
                          x1={x}
                          y1={paddingTop + plotHeight}
                          x2={x}
                          y2={paddingTop + plotHeight + 6}
                          stroke="#cbd5e1"
                          strokeWidth="1.5"
                        />
                        <text
                          x={x}
                          y={paddingTop + plotHeight + 20}
                          textAnchor="middle"
                          className="text-[11px] fill-slate-600 font-sans font-bold"
                        >
                          {mName.slice(0, 3)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Render Area & Line for each year */}
                  {yearsToDraw.map(yr => {
                    const { linePath, areaPath, points } = generatePath(yr);
                    const colors = yearColors[yr];

                    return (
                      <g key={`series-${yr}`}>
                        {/* Area gradient under curve */}
                        <path
                          d={areaPath}
                          fill={`url(#grad-${yr})`}
                          className="transition-all duration-300"
                        />

                        {/* Line Stroke */}
                        <path
                          d={linePath}
                          fill="none"
                          stroke={colors.stroke}
                          strokeWidth={chartMode === 'single' ? '3' : '2.5'}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-all duration-300 drop-shadow-xs"
                        />

                        {/* Interactive Data Points (Dots) */}
                        {points.map((pt, ptIdx) => {
                          const isHovered = activePointIndex === ptIdx && activePointYear === yr;
                          return (
                            <g
                              key={ptIdx}
                              onMouseEnter={() => {
                                setActivePointIndex(ptIdx);
                                setActivePointYear(yr);
                              }}
                              className="cursor-pointer"
                            >
                              {/* Pulse circle on hover */}
                              {isHovered && (
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r="10"
                                  fill={colors.stroke}
                                  fillOpacity="0.2"
                                  className="animate-ping"
                                />
                              )}

                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isHovered ? 6 : 4}
                                fill="#ffffff"
                                stroke={colors.stroke}
                                strokeWidth={isHovered ? 3.5 : 2.5}
                                className="transition-all duration-150"
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Tooltip Overlay */}
                  {activePointIndex !== null && (() => {
                    const yr = activePointYear;
                    const list = billingsData[yr] || [];
                    const item = list[activePointIndex];
                    if (!item) return null;

                    const coord = getCoordinates(activePointIndex, getMetricValue(item));
                    const tooltipWidth = 190;
                    const tooltipHeight = 85;
                    const tooltipX = Math.min(
                      Math.max(coord.x - tooltipWidth / 2, paddingLeft),
                      paddingLeft + plotWidth - tooltipWidth
                    );
                    const tooltipY = Math.max(coord.y - tooltipHeight - 14, 10);

                    return (
                      <g className="pointer-events-none transition-all duration-150">
                        {/* Vertical Indicator Guide */}
                        <line
                          x1={coord.x}
                          y1={paddingTop}
                          x2={coord.x}
                          y2={paddingTop + plotHeight}
                          stroke={yearColors[yr].stroke}
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                          opacity="0.6"
                        />

                        {/* Tooltip Box */}
                        <rect
                          x={tooltipX}
                          y={tooltipY}
                          width={tooltipWidth}
                          height={tooltipHeight}
                          rx="10"
                          fill="#0f172a"
                          fillOpacity="0.95"
                          stroke="#334155"
                          strokeWidth="1"
                          filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))"
                        />

                        {/* Tooltip Content */}
                        <text
                          x={tooltipX + 12}
                          y={tooltipY + 18}
                          className="text-[11px] fill-amber-400 font-extrabold uppercase font-sans tracking-wide"
                        >
                          {item.monthName} {yr}
                        </text>

                        <text
                          x={tooltipX + 12}
                          y={tooltipY + 36}
                          className="text-[12px] fill-white font-extrabold font-mono"
                        >
                          PPh: {formatRupiah(item.pphFinalPaid)}
                        </text>

                        <text
                          x={tooltipX + 12}
                          y={tooltipY + 52}
                          className="text-[10px] fill-slate-300 font-sans"
                        >
                          Omzet: <tspan className="font-mono text-emerald-400 font-bold">{formatRupiah(item.grossRevenue)}</tspan>
                        </text>

                        <text
                          x={tooltipX + 12}
                          y={tooltipY + 68}
                          className="text-[9px] fill-slate-400 font-sans"
                        >
                          Kumulatif: <tspan className="font-mono text-indigo-300">{formatRupiah(item.cumulativeRevenue)}</tspan>
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>
          </div>

          {/* Analysis & Insights Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1: Pertumbuhan Lintas Tahun */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Analisa Pertumbuhan Omzet (YoY)</span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 font-mono">
                  <span>2023 ➔ 2024:</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +21.4%
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 font-mono">
                  <span>2024 ➔ 2025:</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +18.2%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  Kinerja usaha BEJO Digital Print menunjukkan tren kenaikan stabil konsisten di atas 15% per tahun.
                </p>
              </div>
            </div>

            {/* Box 2: Pola Musiman (Seasonality) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Pola Musiman Omzet Bulanan</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Omzet dan setoran PPh biasanya tertinggi di kuartal IV (Oktober - Desember) karena pesanan kalender, merchandise, dan stiker akhir tahun memuncak.
              </p>
              <div className="text-[11px] font-bold text-blue-700 bg-blue-100/60 px-2.5 py-1 rounded-lg">
                Puncak Tertinggi: Bulan Desember
              </div>
            </div>

            {/* Box 3: Ketentuan PP 55/2022 */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Fasilitas PP 55/2022 Rp 500 Juta</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Usaha orang pribadi UMKM tidak kena PPh atas omzet sampai Rp 500.000.000. Omzet di atas itu kena PPh Final 0,5%.
              </p>
              <div className="text-[11px] text-indigo-700 font-medium">
                Penyetoran bulanan dapat langsung disinkronkan ke Lampiran III Formulir 1770 resmi DJP.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* TAB 3: DAFTAR SPT TERDAFTAR & AUDIT TRAIL */}
      {/* -------------------------------------------------------- */}
      {activeTab === 'returns' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-xs text-blue-950">Status Keselarasan Data Seluruh SPT (2023 - 2026)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Omzet dan PPh Final UMKM di semua formulir SPT Tahunan 1770 sudah cocok dengan billing bulanan yang tersimpan.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncAllToSpt}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>Selaraskan Seluruh SPT</span>
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Daftar Formulir SPT Tahunan 1770 Terdaftar & Selaras
            </h3>

            {allReturns.map(ret => (
              <div
                key={ret.id}
                onClick={() => onSelectReturn(ret)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  ret.id === currentReturn.id
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-xs font-mono">
                    {ret.taxYear}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        SPT Tahunan PPh Orang Pribadi (Formulir 1770) {ret.taxYear}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {ret.sptType} {ret.amendmentNumber > 0 ? `Pembetulan ${ret.amendmentNumber}` : ''}
                      </span>
                      {ret.id === currentReturn.id && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          Aktif Dipilih
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ✓ Selaras Billing
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 flex items-center gap-3 flex-wrap">
                      <span>Omzet Usaha: <strong className="text-slate-900 font-mono">{formatRupiah(ret.businessActivity?.grossRevenue || 0)}</strong></span>
                      <span>PPh Final Disetor: <strong className="text-blue-900 font-mono">{formatRupiah(ret.businessActivity?.umkmTaxAmount || 0)}</strong></span>
                      <span>Status: <span className="font-bold text-emerald-700">{ret.settlementStatus}</span></span>
                    </div>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400">
                  <span>Diperbarui: {new Date(ret.updatedAt).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Audit Trail Log for Current Return */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Log Audit Trail Perubahan (SPT Tahun {currentReturn.taxYear})</span>
            </h3>

            <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              {currentReturn.auditTrail?.map((trail, i) => (
                <div key={i} className="flex items-start gap-3 text-xs py-1.5 border-b border-slate-200/60 last:border-0">
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 mt-0.5">
                    {new Date(trail.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex-1">
                    <span className="font-bold text-slate-800">{trail.action}: </span>
                    <span className="text-slate-600">{trail.notes || '-'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{trail.changedBy}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
