/**
 * Laporan Keuangan & Pembukuan (Sistem AKRUAL) — PSAK No.1 Tahun 2015.
 *
 * Tampilan diselaraskan dengan tab lain aplikasi (kartu putih rounded-2xl,
 * tab pil slate, kartu KPI, container max-w-1440px) bergaya aplikasi
 * pembukuan modern: clean, profesional, minimalis.
 *
 * Isi:
 *   1. Laporan Laba Rugi
 *   2. Laporan Perubahan Modal (Ekuitas)
 *   3. Laporan Neraca (Posisi Keuangan)
 *   4. Laporan Arus Kas
 *   5. Neraca Saldo
 *   6. Input Data Pembukuan (isian manual, TERSIMPAN OTOMATIS)
 *   7. Panduan & Definisi (alur 8 langkah penyusunan laporan)
 *
 * Pendapatan, HPP, dan beban shift diambil otomatis dari data aplikasi toko.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, StockTransaction, Shift } from '../../types';
import { getStoredInvoices, convertInvoicesToTransactions } from '../../utils/invoiceStorage';
import { FinancialSettings, DEFAULT_FINANCIAL_SETTINGS } from '../../utils/financialStorage';
import { formatRupiah } from '../../utils/formatters';
import {
  Landmark,
  TrendingUp,
  PencilLine,
  Scale,
  Banknote,
  BookOpen,
  Settings2,
  Info,
  Printer,
  CalendarDays,
  CheckCircle2,
  TriangleAlert,
  Wallet,
  Boxes,
  ReceiptText,
  RotateCcw,
  Save,
} from 'lucide-react';

interface LaporanKeuanganScreenProps {
  transactions: Transaction[];
  stockTransactions: StockTransaction[];
  shifts: Shift[];
  storeName?: string;
  settings: FinancialSettings;
  onSaveSettings: (s: FinancialSettings) => void;
}

type ReportKey =
  | 'laba_rugi'
  | 'perubahan_modal'
  | 'neraca'
  | 'arus_kas'
  | 'neraca_saldo'
  | 'data'
  | 'panduan';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Filter pada rentang tanggal (inclusive), string YYYY-MM-DD */
const withinRange = (dateStr: string, from: string, to: string): boolean => {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
};

const prevMonthRange = (): { from: string; to: string } => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const pad = (x: number) => String(x).padStart(2, '0');
  return {
    from: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`,
    to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  };
};

export const LaporanKeuanganScreen: React.FC<LaporanKeuanganScreenProps> = ({
  transactions,
  stockTransactions,
  shifts,
  storeName,
  settings,
  onSaveSettings,
}) => {
  const [activeReport, setActiveReport] = useState<ReportKey>('laba_rugi');
  const [draft, setDraft] = useState<FinancialSettings>(settings);
  const [fromDate, setFromDate] = useState<string>(() => prevMonthRange().from);
  const [toDate, setToDate] = useState<string>(() => prevMonthRange().to);

  const entityName = settings.entityName || storeName || 'BEJO STIKER';

  // ==== Simpan otomatis (auto-save) setiap kali draft berubah ====
  useEffect(() => {
    onSaveSettings(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // ==== Perhitungan otomatis dari data aplikasi (sistem akrual) ====
  const calc = useMemo(() => {
    // Gabungkan penjualan kasir dengan invoice B2B agar pendapatan tidak understated
    const invoiceTransactions = convertInvoicesToTransactions(getStoredInvoices());
    const allSalesTransactions = Array.from(
      new Map([...transactions, ...invoiceTransactions].map(t => [t.id, t])).values()
    );

    const inPeriod = allSalesTransactions.filter((t) => withinRange(t.date, fromDate, toDate));
    const stockInPeriod = stockTransactions.filter((s) => withinRange(s.date, fromDate, toDate));
    const shiftInPeriod = shifts.filter((s) =>
      withinRange((s.date || s.startTime || '').slice(0, 10), fromDate, toDate)
    );

    const grossRevenue = inPeriod.reduce((sum, t) => sum + num(t.total), 0);
    // PPN yang dipungut bukan pendapatan usaha, jadi laba rugi memakai nilai neto PPN
    const taxCollected = inPeriod.reduce((sum, t) => sum + num(t.tax), 0);
    const revenue = grossRevenue - taxCollected;
    const qtySold = inPeriod.reduce((sum, t) => sum + num(t.totalQty), 0);
    const txCount = inPeriod.length;
    const cashIn = inPeriod.reduce(
      (sum, t) =>
        sum + num(t.paymentMethods?.cash) + num(t.paymentMethods?.transfer) + num(t.paymentMethods?.qris),
      0
    );

    const purchases = stockInPeriod
      .filter((s) => s.type === 'PEMBELIAN')
      .reduce((sum, s) => {
        const itemsTotal = (s.items || []).reduce((a, it) => a + num(it.totalPrice), 0);
        if (itemsTotal > 0) return sum + itemsTotal;
        // totalAmount lama sudah termasuk ongkir, jadi kurangi agar tidak dihitung dua kali
        const storedTotal = num(s.totalAmount) || num(s.totalPrice);
        return sum + Math.max(0, storedTotal - num(s.shippingCost));
      }, 0);
    const shipping = stockInPeriod
      .filter((s) => s.type === 'PEMBELIAN')
      .reduce((sum, s) => sum + num(s.shippingCost), 0);
    const totalPurchases = purchases + shipping;

    const hpp = num(settings.openingInventory) + totalPurchases - num(settings.closingInventory);

    const operationalFromShifts = shiftInPeriod.reduce((sum, s) => sum + num(s.operationalExpenses), 0);
    const totalExpenses = operationalFromShifts + num(settings.otherExpenses);

    const grossProfit = revenue - hpp;
    const netProfit = grossProfit - totalExpenses;
    const endingCapital = num(settings.openingCapital) + netProfit - num(settings.ownerDrawings);

    const operatingCashIn = cashIn;
    const operatingCashOut = totalPurchases + operationalFromShifts + num(settings.otherExpenses);
    const netOperatingCash = operatingCashIn - operatingCashOut;
    const netCashFlow = netOperatingCash;

    const computedCash =
      num(settings.cashBalance) > 0 ? num(settings.cashBalance) : num(settings.openingCash) + netCashFlow;

    const totalAssets =
      computedCash + num(settings.accountsReceivable) + num(settings.closingInventory) + num(settings.fixedAssets);
    const totalLiabilities = num(settings.accountsPayable) + num(settings.otherLiabilities);
    const equity = endingCapital;
    const totalLiabEquity = totalLiabilities + equity;
    const balanceDiff = totalAssets - totalLiabEquity;
    const isBalanced = Math.abs(balanceDiff) <= 1;

    return {
      revenue,
      qtySold,
      txCount,
      totalPurchases,
      hpp,
      operationalFromShifts,
      totalExpenses,
      grossProfit,
      netProfit,
      endingCapital,
      operatingCashIn,
      operatingCashOut,
      netOperatingCash,
      netCashFlow,
      computedCash,
      totalAssets,
      totalLiabilities,
      equity,
      totalLiabEquity,
      balanceDiff,
      isBalanced,
    };
  }, [transactions, stockTransactions, shifts, fromDate, toDate, settings]);

  const setField = (key: keyof FinancialSettings, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleReset = () => {
    if (window.confirm('Kosongkan seluruh data pembukuan manual? Tindakan ini tidak bisa dibatalkan.')) {
      setDraft({ ...DEFAULT_FINANCIAL_SETTINGS });
    }
  };

  // ==== Sub-komponen ====
  const Row = ({
    label,
    value,
    strong,
    indent,
    negative,
  }: {
    label: string;
    value: number;
    strong?: boolean;
    indent?: boolean;
    negative?: boolean;
  }) => (
    <div
      className={`flex justify-between items-center py-2.5 ${
        strong ? 'border-t-2 border-slate-900 mt-1 pt-3' : 'border-b border-slate-100 last:border-0'
      } ${indent ? 'pl-5' : ''}`}
    >
      <span className={`text-sm ${strong ? 'font-extrabold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <span
        className={`font-mono text-sm tabular-nums ${
          strong ? 'font-extrabold text-slate-900' : 'text-slate-800'
        } ${negative && value < 0 ? 'text-rose-600' : ''}`}
      >
        {formatRupiah(value)}
      </span>
    </div>
  );

  const KopLaporan = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="text-center mb-6 pb-4 border-b-2 border-slate-800">
      <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">{entityName}</h2>
      <p className="text-[11px] text-slate-500 mt-0.5">{subtitle || 'Laporan Keuangan Sederhana'}</p>
      <h3 className="text-base font-bold text-slate-800 mt-3">{title}</h3>
      <p className="text-xs text-slate-500 mt-0.5">
        Untuk Periode {fromDate} s.d. {toDate} — Sistem Akrual
      </p>
    </div>
  );

  const reports: { key: ReportKey; label: string; icon: React.ElementType }[] = [
    { key: 'laba_rugi', label: 'Laba Rugi', icon: TrendingUp },
    { key: 'perubahan_modal', label: 'Perubahan Modal', icon: PencilLine },
    { key: 'neraca', label: 'Neraca', icon: Scale },
    { key: 'arus_kas', label: 'Arus Kas', icon: Banknote },
    { key: 'neraca_saldo', label: 'Neraca Saldo', icon: BookOpen },
    { key: 'data', label: 'Input Data', icon: Settings2 },
    { key: 'panduan', label: 'Panduan', icon: Info },
  ];

  // ==== Kartu KPI ====
  const kpiCards = [
    {
      label: 'Pendapatan',
      value: formatRupiah(calc.revenue),
      sub: `${calc.txCount} transaksi pada periode`,
      icon: TrendingUp,
      chip: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Laba Bersih',
      value: formatRupiah(calc.netProfit),
      sub: calc.netProfit >= 0 ? 'Laba periode berjalan' : 'Rugi periode berjalan',
      icon: calc.netProfit >= 0 ? CheckCircle2 : TriangleAlert,
      chip: calc.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
    },
    {
      label: 'Total Aset',
      value: formatRupiah(calc.totalAssets),
      sub: 'Kas, Piutang, Persediaan & Aset Tetap',
      icon: Landmark,
      chip: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Saldo Kas & Bank',
      value: formatRupiah(calc.computedCash),
      sub: calc.isBalanced ? 'Neraca seimbang ✓' : `Selisih neraca ${formatRupiah(calc.balanceDiff)}`,
      icon: Wallet,
      chip: calc.isBalanced ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="w-full max-w-[1440px] mx-auto p-3 sm:p-5 space-y-4 print:p-0 print:m-0 print:max-w-none print:w-full">
      {/* ===== Kartu Header (selaras dengan kartu header tab lain) ===== */}
      <div className="no-print bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              LAPORAN KEUANGAN & PEMBUKUAN
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Laba Rugi, Perubahan Modal, Neraca & Arus Kas sesuai <strong>PSAK No.1/2015</strong> —
              dihitung otomatis dari transaksi toko, dilengkapi input pembukuan manual.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sistem Akrual · Data Tersimpan Otomatis di Perangkat</span>
            </div>
          </div>
        </div>

        {/* Periode + Cetak */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-semibold text-slate-700 focus:outline-none cursor-pointer"
              aria-label="Dari tanggal"
            />
            <span className="text-[11px] text-slate-400 font-bold">s.d.</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-semibold text-slate-700 focus:outline-none cursor-pointer"
              aria-label="Sampai tanggal"
            />
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            title="Cetak laporan yang sedang dibuka"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* ===== Ringkasan KPI ===== */}
      <div className="no-print grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{k.label}</span>
                <div className="text-lg font-black text-slate-900 mt-1 font-mono truncate">{k.value}</div>
                <span className="text-[10px] text-slate-400 font-medium block truncate">{k.sub}</span>
              </div>
              <div className={`p-3 rounded-xl shrink-0 ${k.chip}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Pemilih jenis laporan (tab pil selaras aplikasi) ===== */}
      <div className="no-print flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit flex-wrap gap-1">
        {reports.map((r) => {
          const Icon = r.icon;
          const active = activeReport === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setActiveReport(r.key)}
              className={`px-3.5 sm:px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                active ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-300' : 'text-slate-500'}`} />
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===== Konten laporan aktif ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs print:border-0 print:rounded-none print:shadow-none">
        {activeReport === 'laba_rugi' && (
          <div>
            <KopLaporan title="Laporan Laba Rugi" />
            <Row label="Pendapatan Penjualan" value={calc.revenue} />
            <Row label="Harga Pokok Penjualan (HPP)" value={calc.hpp} negative />
            <Row label="Laba Kotor" value={calc.grossProfit} strong />
            <Row label="Beban Operasional (Shift & Tambahan)" value={calc.totalExpenses} negative />
            <Row label="Laba Bersih Periode Berjalan" value={calc.netProfit} strong />
            <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
              HPP = Persediaan Awal {formatRupiah(settings.openingInventory)} + Pembelian Bahan{' '}
              {formatRupiah(calc.totalPurchases)} − Persediaan Akhir {formatRupiah(settings.closingInventory)}.
            </p>
          </div>
        )}

        {activeReport === 'perubahan_modal' && (
          <div>
            <KopLaporan title="Laporan Perubahan Modal" />
            <Row label="Modal Awal" value={settings.openingCapital} />
            <Row label="(+) Laba Bersih Periode Berjalan" value={calc.netProfit} indent />
            <Row label="(−) Prive / Penarikan Pribadi" value={settings.ownerDrawings} negative indent />
            <Row label="Modal Akhir" value={calc.endingCapital} strong />
          </div>
        )}

        {activeReport === 'neraca' && (
          <div>
            <KopLaporan title="Laporan Neraca (Posisi Keuangan)" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Aset (Aktiva)</h4>
                </div>
                <Row label="Kas & Bank" value={calc.computedCash} />
                <Row label="Piutang Usaha" value={settings.accountsReceivable} />
                <Row label="Persediaan Barang Dagang" value={settings.closingInventory} />
                <Row label="Aset Tetap" value={settings.fixedAssets} />
                <Row label="Total Aset" value={calc.totalAssets} strong />
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                    <Scale className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Kewajiban & Ekuitas</h4>
                </div>
                <Row label="Utang Usaha" value={settings.accountsPayable} />
                <Row label="Utang Lain-lain" value={settings.otherLiabilities} />
                <Row label="Total Kewajiban" value={calc.totalLiabilities} />
                <Row label="Ekuitas (Modal Akhir)" value={calc.equity} />
                <Row label="Total Kewajiban + Ekuitas" value={calc.totalLiabEquity} strong />
              </div>
            </div>
            {calc.isBalanced ? (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Neraca seimbang — Total Aset = Total Kewajiban + Ekuitas.
              </div>
            ) : (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Neraca belum seimbang, selisih {formatRupiah(calc.balanceDiff)}. Lengkapi tab{' '}
                  <strong>Input Data</strong> (Kas, Piutang, Utang, Aset Tetap, Persediaan) agar Aset = Kewajiban +
                  Ekuitas.
                </span>
              </div>
            )}
          </div>
        )}

        {activeReport === 'arus_kas' && (
          <div>
            <KopLaporan title="Laporan Arus Kas" />
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60 mb-3">
              <div className="flex items-center gap-2 mb-1 pb-2 border-b border-slate-200">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <Wallet className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Aktivitas Operasional</h4>
              </div>
              <Row label="Kas Masuk — Penjualan Tunai/Transfer/QRIS" value={calc.operatingCashIn} />
              <Row label="Kas Keluar — Pembelian Bahan & Beban" value={calc.operatingCashOut} negative />
              <Row label="Arus Kas Operasional Bersih" value={calc.netOperatingCash} strong />
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
              <div className="flex items-center gap-2 mb-1 pb-2 border-b border-slate-200">
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Banknote className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Investasi, Pendanaan & Posisi Kas
                </h4>
              </div>
              <Row label="Arus Kas Investasi (Pembelian Aset Tetap)" value={0} />
              <Row label="Arus Kas Pendanaan (Modal / Utang)" value={0} />
              <Row label="Kenaikan (Penurunan) Kas Bersih" value={calc.netCashFlow} />
              <Row label="Saldo Kas Awal" value={settings.openingCash} />
              <Row label="Saldo Kas Akhir" value={calc.computedCash} strong />
            </div>
          </div>
        )}

        {activeReport === 'neraca_saldo' && (
          <div>
            <KopLaporan title="Neraca Saldo (Ringkas)" />
            <p className="text-[11px] text-slate-500 mb-3">
              Daftar akun dengan saldo debit & kredit hasil posting jurnal, dikelompokkan ke aktiva & pasiva —
              dasar penyusunan laporan keuangan.
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
                    <th className="text-left px-4 py-2.5 font-bold">Nama Akun</th>
                    <th className="text-right px-4 py-2.5 font-bold w-44">Debit</th>
                    <th className="text-right px-4 py-2.5 font-bold w-44">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  <NeracaSaldoRow name="Kas & Bank" debit={calc.computedCash} />
                  <NeracaSaldoRow name="Piutang Usaha" debit={settings.accountsReceivable} />
                  <NeracaSaldoRow name="Persediaan Barang" debit={settings.closingInventory} />
                  <NeracaSaldoRow name="Aset Tetap" debit={settings.fixedAssets} />
                  <NeracaSaldoRow name="Utang Usaha" credit={settings.accountsPayable} />
                  <NeracaSaldoRow name="Utang Lain-lain" credit={settings.otherLiabilities} />
                  <NeracaSaldoRow name="Modal Usaha" credit={settings.openingCapital} />
                  <NeracaSaldoRow name="Pendapatan Penjualan" credit={calc.revenue} />
                  <NeracaSaldoRow name="Harga Pokok Penjualan" debit={calc.hpp} />
                  <NeracaSaldoRow name="Beban Operasional" debit={calc.totalExpenses} />
                  <NeracaSaldoRow name="Prive Pemilik" debit={settings.ownerDrawings} />
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'data' && (
          <div className="space-y-5">
            {/* Judul + status auto-save */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-emerald-600" />
                  Input Data Pembukuan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi sesuai pembukuan toko. Setiap perubahan <strong>tersimpan otomatis</strong> — tidak perlu
                  tombol simpan.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold">
                  <Save className="w-3.5 h-3.5 text-emerald-600" />
                  Tersimpan Otomatis
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Kosongkan
                </button>
              </div>
            </div>

            {/* Chip penanda: mana otomatis, mana manual */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Otomatis dari aplikasi: Pendapatan, HPP (Pembelian Bahan), Beban Shift
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-[11px] font-semibold">
                <PencilLine className="w-3.5 h-3.5 text-amber-600" />
                Diisi manual: Modal, Persediaan, Piutang, Utang, Aset, Beban Lain
              </span>
            </div>

            {/* Form bertema grup (grid modern) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <FieldGroup
                title="Identitas & Modal"
                desc="Dasar Laporan Perubahan Modal"
                icon={PencilLine}
                iconChip="bg-indigo-100 text-indigo-700"
              >
                <TextField label="Nama Entitas / Toko" value={draft.entityName} onChange={(v) => setField('entityName', v)} placeholder="Nama toko pada kop laporan" />
                <RupiahField label="Modal Awal" hint="Ekuitas pemilik di awal periode" value={draft.openingCapital} onChange={(v) => setField('openingCapital', v)} />
                <RupiahField label="Prive / Penarikan Pribadi" hint="Mengurangi ekuitas pemilik" value={draft.ownerDrawings} onChange={(v) => setField('ownerDrawings', v)} />
              </FieldGroup>

              <FieldGroup
                title="Persediaan Barang"
                desc="Untuk perhitungan HPP"
                icon={Boxes}
                iconChip="bg-amber-100 text-amber-700"
              >
                <RupiahField label="Persediaan Awal" value={draft.openingInventory} onChange={(v) => setField('openingInventory', v)} />
                <RupiahField label="Persediaan Akhir" value={draft.closingInventory} onChange={(v) => setField('closingInventory', v)} />
              </FieldGroup>

              <FieldGroup
                title="Kas, Piutang & Aset"
                desc="Posisi keuangan akhir periode"
                icon={Wallet}
                iconChip="bg-emerald-100 text-emerald-700"
              >
                <RupiahField label="Kas & Bank (Awal)" hint="Saldo awal untuk Laporan Arus Kas" value={draft.openingCash} onChange={(v) => setField('openingCash', v)} />
                <RupiahField label="Kas & Bank (Akhir)" hint="Kosongkan bila ingin dihitung otomatis" value={draft.cashBalance} onChange={(v) => setField('cashBalance', v)} />
                <RupiahField label="Piutang Usaha" hint="Tagihan pelanggan belum diterima" value={draft.accountsReceivable} onChange={(v) => setField('accountsReceivable', v)} />
                <RupiahField label="Aset Tetap" hint="Mesin, kendaraan, bangunan, dll" value={draft.fixedAssets} onChange={(v) => setField('fixedAssets', v)} />
              </FieldGroup>

              <FieldGroup
                title="Kewajiban (Utang)"
                desc="Hutang perusahaan akhir periode"
                icon={ReceiptText}
                iconChip="bg-rose-100 text-rose-700"
              >
                <RupiahField label="Utang Usaha" hint="Hutang dagang ke supplier" value={draft.accountsPayable} onChange={(v) => setField('accountsPayable', v)} />
                <RupiahField label="Utang Lain-lain" hint="Bank, pribadi, dll" value={draft.otherLiabilities} onChange={(v) => setField('otherLiabilities', v)} />
              </FieldGroup>

              <FieldGroup
                title="Beban Lain-Lain"
                desc="Di luar beban operasional shift"
                icon={TrendingUp}
                iconChip="bg-sky-100 text-sky-700"
              >
                <RupiahField label="Beban Operasional Tambahan" hint="Sewa, listrik, gaji, dll" value={draft.otherExpenses} onChange={(v) => setField('otherExpenses', v)} />
              </FieldGroup>

              <FieldGroup
                title="Catatan Pembukuan"
                desc="Opsional — untuk pemeriksaan ulang"
                icon={Info}
                iconChip="bg-slate-200 text-slate-700"
              >
                <AreaField label="Catatan" value={draft.notes} onChange={(v) => setField('notes', v)} placeholder="Mis. akun bank dibuka tgl 5, aset terakhir diperbarui 10 Jan…" />
              </FieldGroup>
            </div>

            {/* Ringkasan hidup */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MiniStat label="Laba Bersih" value={formatRupiah(calc.netProfit)} tone={calc.netProfit >= 0 ? 'emerald' : 'rose'} />
              <MiniStat label="Modal Akhir" value={formatRupiah(calc.endingCapital)} tone="indigo" />
              <MiniStat label="Total Aset" value={formatRupiah(calc.totalAssets)} tone="sky" />
              <MiniStat
                label="Status Neraca"
                value={calc.isBalanced ? 'Seimbang' : `Selisih ${formatRupiah(calc.balanceDiff)}`}
                tone={calc.isBalanced ? 'emerald' : 'amber'}
              />
            </div>
          </div>
        )}

        {activeReport === 'panduan' && <PanduanContent />}
      </div>
    </div>
  );
};

// ===================== Sub-komponen form =====================

const FieldGroup: React.FC<{
  title: string;
  desc?: string;
  icon: React.ElementType;
  iconChip: string;
  children: React.ReactNode;
}> = ({ title, desc, icon: Icon, iconChip, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
    <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-slate-100">
      <div className={`p-2 rounded-lg ${iconChip}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">{title}</h3>
        {desc && <p className="text-[10px] text-slate-400 font-medium">{desc}</p>}
      </div>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const RupiahField: React.FC<{
  label: string;
  hint?: string;
  value: string | number;
  onChange: (v: string) => void;
}> = ({ label, hint, value, onChange }) => (
  <div>
    <label className="block text-[11px] font-bold text-slate-600 mb-1">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400 pointer-events-none">
        Rp
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-sm font-mono font-semibold text-right text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
      />
    </div>
    {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
  </div>
);

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-[11px] font-bold text-slate-600 mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
    />
  </div>
);

const AreaField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-[11px] font-bold text-slate-600 mb-1">{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all resize-y"
    />
  </div>
);

const MiniStat: React.FC<{ label: string; value: string; tone: 'emerald' | 'indigo' | 'sky' | 'rose' | 'amber' }> = ({
  label,
  value,
  tone,
}) => {
  const tones: Record<string, string> = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    indigo: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    sky: 'text-sky-700 bg-sky-50 border-sky-200',
    rose: 'text-rose-700 bg-rose-50 border-rose-200',
    amber: 'text-amber-800 bg-amber-50 border-amber-200',
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tones[tone]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-sm font-black font-mono truncate mt-0.5">{value}</div>
    </div>
  );
};

// ===================== Neraca Saldo =====================

const NeracaSaldoRow: React.FC<{ name: string; debit?: number; credit?: number }> = ({
  name,
  debit = 0,
  credit = 0,
}) => (
  <tr className="border-b border-slate-100 last:border-0 odd:bg-slate-50/50 hover:bg-emerald-50/40 transition-colors">
    <td className="px-4 py-2.5 text-slate-700 font-medium">{name}</td>
    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-800">{debit ? formatRupiah(debit) : '—'}</td>
    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-800">{credit ? formatRupiah(credit) : '—'}</td>
  </tr>
);

// ===================== Panduan =====================

const PanduanContent: React.FC = () => (
  <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
    <div>
      <h3 className="text-base font-black text-slate-900 mb-2">Apa Itu Laporan Keuangan?</h3>
      <p className="mb-2">
        Menurut <strong>PSAK No.1 Tahun 2015</strong>, laporan keuangan adalah penyajian terstruktur dari posisi
        keuangan dan kinerja keuangan suatu entitas.
      </p>
      <p className="mb-2">
        Lebih lanjut dalam buku <em>Intermediate Accounting</em>, laporan keuangan didefinisikan sebagai ringkasan
        suatu proses sistem pencatatan transaksi keuangan dan ringkasan dari transaksi-transaksi keuangan yang
        terjadi selama satu tahun buku yang bersangkutan (Baridwan, 2004).
      </p>
      <p>
        Baik untuk perusahaan skala besar maupun kecil, laporan keuangan merupakan kewajiban yang harus dibuat
        setiap periode. Sebagai pengusaha, Anda wajib bisa membacanya untuk mengetahui kondisi keuangan dan menilai
        kinerja perusahaan, sehingga dapat mengambil keputusan operasional yang benar.
      </p>
    </div>

    <div>
      <h3 className="text-base font-black text-slate-900 mb-2">Urutan Jenis Laporan Keuangan</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[
          ['Laporan Laba Rugi', 'Mencantumkan transaksi pendapatan yang diperoleh dan pengeluaran yang dikeluarkan.'],
          ['Laporan Perubahan Modal', 'Ikhtisar perubahan yang terjadi pada ekuitas pemilik untuk periode tertentu.'],
          ['Laporan Neraca', 'Informasi posisi keuangan perusahaan/entitas pada satu periode, biasanya satu tahun.'],
          ['Laporan Arus Kas', 'Menggambarkan jumlah kas masuk (penerimaan) dan kas keluar (pengeluaran) dalam periode tertentu.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-xs font-black text-slate-900">{t}</div>
            <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{d}</div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <h3 className="text-base font-black text-slate-900 mb-2">Alur Membuat Laporan Keuangan (8 Langkah)</h3>
      <ol className="space-y-2">
        {[
          ['Mengumpulkan & Mencatat Transaksi pada Jurnal', 'Catat semua transaksi (pembelian, penjualan, kas/bank, sewa, dll) beserta buktinya: nota, kwitansi, faktur.'],
          ['Membuat & Memposting Jurnal ke Buku Besar', 'Pindahkan transaksi dari jurnal ke akun-akun yang sesuai secara rinci.'],
          ['Membuat & Menyusun Neraca Saldo', 'Daftar rekening buku besar dengan saldo debit dan kredit, dikelompokkan ke aktiva/pasiva.'],
          ['Mengumpulkan Data untuk Jurnal Penyesuaian', 'Sesuaikan saldo perkiraan di akhir periode agar mencerminkan keadaan sebenarnya sebelum laporan disusun.'],
          ['Membuat & Menyusun Neraca Lajur (Kertas Kerja)', 'Dimulai dari neraca saldo, disesuaikan jurnal penyesuaian, hingga saldo laporan rugi laba & neraca.'],
          ['Membuat Laporan Keuangan', 'Tulis rapi hasil neraca lajur sesuai standar: Laba Rugi, Perubahan Modal, Neraca, dan Arus Kas.'],
          ['Membuat Jurnal Penutup', 'Tutup rekening nominal/sementara ke rekening laba rugi, lalu pindahkan saldo laba rugi ke laba tidak dibagi.'],
          ['Membuat Neraca Saldo Setelah Penutupan', 'Berisi hanya rekening nyata (riil) yang saldonya sudah dinolkan oleh jurnal penutup.'],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div>
              <span className="text-xs font-black text-slate-900">{t}</span>
              <p className="text-xs text-slate-600 leading-relaxed">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>

    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <h3 className="text-sm font-black text-amber-900 mb-2">Catatan Penting</h3>
      <ol className="list-decimal list-inside space-y-1.5 text-amber-900 text-xs leading-relaxed">
        <li>
          <strong>Gunakan Sistem Akrual</strong> — catat semua transaksi yang terjadi, tidak hanya yang berkaitan
          kas, tetapi juga utang &amp; piutang, agar gambaran keuangan lebih akurat.
        </li>
        <li>
          <strong>Catat Semua Pengeluaran &amp; Pemasukan</strong> — jangan menunda; biasakan mencatat setiap
          transaksi agar laporan mencerminkan kondisi perusahaan sebenarnya.
        </li>
        <li>
          <strong>Beri Penjelasan yang Detail</strong> — deskripsi rinci memudahkan pemeriksaan ulang dan melatih
          ketelitian pencatatan.
        </li>
        <li>
          <strong>Patuhi Tenggat Waktu</strong> — buat laporan secara konsisten (bulanan, triwulanan, atau tahunan)
          agar bernilai dan tepat sasaran.
        </li>
      </ol>
    </div>
  </div>
);
