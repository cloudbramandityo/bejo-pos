/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect } from 'react';
import {
  Clock,
  UserCheck,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Store,
  History,
  TrendingUp,
  Receipt,
  UserPlus,
  Edit2,
  Trash2,
  Users,
  Shield,
  FileSpreadsheet,
  Phone,
  Power,
  ShoppingBag,
  Wallet
} from 'lucide-react';
import { Shift, Transaction, CashierUser, UserRole } from '../types';
import {
  formatRupiah,
  formatNumberInput,
  parseNumber,
  formatShiftTime,
  formatShiftDate,
  getShiftDurationString,
  getTransactionsForShift,
  getNetCashAmount
} from '../utils/formatters';
import { exportTransactionsToExcel } from '../utils/excelExport';
import { CashierModal } from './modals/CashierModal';
import { StoreLogo } from './StoreLogo';

interface ShiftScreenProps {
  activeShift: Shift | null;
  pastShifts: Shift[];
  transactions: Transaction[];
  cashiers: CashierUser[];
  categories?: any[];
  customers?: any[];
  userRole?: UserRole;
  onOpenShiftModal: () => void;
  onCloseActiveShift: (actualCash: number, notes: string, operationalExpenses?: number, operationalNotes?: string) => void;
  onSaveCashier: (cashier: CashierUser) => void;
  onDeleteCashier: (cashierId: string) => void;
  onDeleteShift?: (shiftId: string) => void;
  onClearAllShifts?: () => void;
}

export const ShiftScreen: React.FC<ShiftScreenProps> = ({
  activeShift,
  pastShifts,
  transactions,
  cashiers,
  categories,
  customers,
  userRole,
  onOpenShiftModal,
  onCloseActiveShift,
  onSaveCashier,
  onDeleteCashier,
  onDeleteShift,
  onClearAllShifts,
}) => {
  const isDeveloper = userRole === 'DEVELOPER';
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'cashiers' | 'history'>('status');

  // Real-time clock ticker for shift duration
  const [nowTick, setNowTick] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cashier Modal state
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);
  const [editingCashier, setEditingCashier] = useState<CashierUser | null>(null);

  // Quick close modal within screen
  const [isCloseFormVisible, setIsCloseFormVisible] = useState(false);
  const [operationalExpenses, setOperationalExpenses] = useState<string>('0');
  const [operationalNotes, setOperationalNotes] = useState<string>('');
  const [actualEndingCash, setActualEndingCash] = useState<string>('0');
  const [closingNotes, setClosingNotes] = useState('');

  const currentShiftTransactions = activeShift
    ? getTransactionsForShift(activeShift, transactions, categories, customers)
    : [];

  const shiftCashSales = currentShiftTransactions.reduce((acc, t) => acc + getNetCashAmount(t), 0);
  const shiftTransferSales = currentShiftTransactions.reduce((acc, t) => acc + (t.paymentMethods?.transfer || 0), 0);
  const shiftQrisSales = currentShiftTransactions.reduce((acc, t) => acc + (t.paymentMethods?.qris || 0), 0);
  const shiftTotalSales = currentShiftTransactions.reduce((acc, t) => acc + (t.total || 0), 0);

  const numOperationalExpenses = parseNumber(operationalExpenses);
  const numEndingCash = parseNumber(actualEndingCash);
  const expectedCashInDrawer = (activeShift?.startingCash || 0) + shiftCashSales - numOperationalExpenses;
  const cashDifference = numEndingCash - expectedCashInDrawer;

  const handleOpenAddCashier = () => {
    setEditingCashier(null);
    setIsCashierModalOpen(true);
  };

  const handleOpenEditCashier = (cashier: CashierUser) => {
    setEditingCashier(cashier);
    setIsCashierModalOpen(true);
  };

  const handleDeleteCashierConfirm = (cashier: CashierUser) => {
    if (confirm(`Hapus kasir "${cashier.name}"? Data ini tidak dapat dikembalikan.`)) {
      onDeleteCashier(cashier.id);
    }
  };

  const handleDirectCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm('Apakah Anda yakin ingin menutup shift kasir ini dan merekap laporan kas? Laporan Excel akan otomatis di-download dan aplikasi akan kembali ke pilihan kasir & shift.')) {
      // 1. Auto save to Excel
      if (currentShiftTransactions.length > 0) {
        exportTransactionsToExcel(
          currentShiftTransactions,
          `Laporan_Rekap_Shift_${activeShift?.cashierName || 'Kasir'}_${activeShift?.id || 'Shift'}`
        );
      }
      // 2. Close shift and clear active session
      onCloseActiveShift(numEndingCash, closingNotes, numOperationalExpenses, operationalNotes);
      setIsCloseFormVisible(false);
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto p-3 sm:p-5 space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <StoreLogo size="lg" rounded="rounded-xl" />
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              MANAJEMEN SHIFT & DATA KASIR TOKO
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola modal kas laci, pengaturan daftar kasir & shift toko, serta rekap penutupan kasir otomatis tersimpan ke Excel.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAddCashier}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-blue-600" />
            Tambah Kasir
          </button>

          {activeShift ? (
            <button
              type="button"
              onClick={() => setIsCloseFormVisible(true)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <AlertCircle className="w-4 h-4" />
              Tutup & Rekap Kasir
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenShiftModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Buka Shift Kasir
            </button>
          )}
        </div>
      </div>

      {/* Sub navigation tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-5 pt-3 gap-2 sm:gap-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('status')}
          className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'status'
              ? 'border-blue-600 text-blue-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Status Shift Berjalan
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('cashiers')}
          className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'cashiers'
              ? 'border-blue-600 text-blue-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          Daftar Kasir & Shift Toko ({cashiers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'history'
              ? 'border-blue-600 text-blue-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4 text-emerald-600" />
          Riwayat Rekap Kasir ({pastShifts.length})
        </button>
      </div>

      {/* TAB 1: STATUS SHIFT BERJALAN */}
      {activeSubTab === 'status' && (
        <div className="space-y-4">
          {activeShift ? (
            <div className="bg-white rounded-2xl border border-blue-200 shadow-xs p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-black text-emerald-800 tracking-wider uppercase">
                    SHIFT AKTIF SEDANG BERJALAN
                  </span>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {activeShift.shiftName || 'Shift 1'}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                  ID: {activeShift.id}
                </span>
              </div>

              {/* Main Info Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Kasir Bertugas</span>
                  <div className="text-base font-black text-slate-900 uppercase mt-0.5 truncate">
                    {activeShift.cashierName}
                  </div>
                  <span className="text-[10px] text-blue-600 font-semibold">{activeShift.shiftName || 'Shift 1'}</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Toko / Cabang</span>
                  <div className="text-base font-black text-slate-900 mt-0.5 truncate">
                    {activeShift.storeName}
                  </div>
                  <span className="text-[10px] text-slate-400">Point of Sales</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Waktu Buka Shift</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                    {formatShiftTime(activeShift.startTime, activeShift.date)}
                  </div>
                  <span className="text-[10px] text-slate-400">{formatShiftDate(activeShift.startTime, activeShift.date)}</span>
                </div>

                <div className="bg-blue-50/90 p-3.5 rounded-xl border border-blue-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-800 uppercase">Durasi Real-Time</span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full animate-pulse">
                      <Clock className="w-2.5 h-2.5" /> Live
                    </span>
                  </div>
                  <div className="text-base font-black text-blue-950 mt-0.5 font-mono">
                    {getShiftDurationString(activeShift.startTime, activeShift.date)}
                  </div>
                  <span className="text-[10px] text-blue-600 font-medium">
                    Jam: {nowTick.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Modal Kas Awal</span>
                  <div className="text-base font-black text-emerald-700 mt-0.5 font-mono">
                    {formatRupiah(activeShift.startingCash)}
                  </div>
                  <span className="text-[10px] text-emerald-600">Kas di Laci</span>
                </div>
              </div>

              {/* Sales Financial Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold uppercase">Penjualan Tunai (Cash)</span>
                    <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">
                      {formatRupiah(shiftCashSales)}
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold uppercase">Non-Tunai (TF / QRIS)</span>
                    <div className="text-lg font-black text-sky-700 font-mono mt-0.5">
                      {formatRupiah(shiftTransferSales + shiftQrisSales)}
                    </div>
                  </div>
                  <div className="p-2.5 bg-sky-100 text-sky-700 rounded-xl">
                    <Receipt className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#1e295d] text-white p-4 rounded-xl flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-[11px] text-sky-200 font-bold uppercase">Total Omzet Shift</span>
                    <div className="text-xl font-black text-white font-mono mt-0.5">
                      {formatRupiah(shiftTotalSales)}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white/10 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-sky-400" />
                  </div>
                </div>
              </div>

              {/* Close Shift Quick Action Card */}
              {isCloseFormVisible ? (
                <form onSubmit={handleDirectCloseShift} className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-5 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-700" />
                      <h3 className="text-sm font-black text-amber-950 uppercase tracking-tight">
                        TUTUP & REKAP KASIR SEKARANG
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCloseFormVisible(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>

                  {/* Operasional Toko Row */}
                  <div className="bg-white p-4 rounded-xl border border-amber-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-red-600" />
                        Operasional Toko (Pengeluaran Kas Laci):
                      </label>
                      <span className="text-[11px] text-red-600 font-semibold italic">
                        *Nominal ini akan otomatis mengurangi jumlah uang di laci
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">Rp</span>
                          <input
                            type="text"
                            value={operationalExpenses}
                            onChange={(e) => setOperationalExpenses(formatNumberInput(e.target.value) || '0')}
                            placeholder="0"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-red-700 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={operationalNotes}
                          onChange={(e) => setOperationalNotes(e.target.value)}
                          placeholder="Keterangan operasional (misal: beli bensin, kopi indomaret, galon)"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rincian Perhitungan Kas Laci */}
                  <div className="p-3 bg-amber-100/60 rounded-xl text-xs text-slate-800 space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span>Modal Kas Awal:</span>
                      <span className="font-semibold">{formatRupiah(activeShift.startingCash)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800">
                      <span>(+) Penjualan Tunai (Cash):</span>
                      <span className="font-semibold">+{formatRupiah(shiftCashSales)}</span>
                    </div>
                    {numOperationalExpenses > 0 && (
                      <div className="flex justify-between text-red-700 font-semibold">
                        <span>(-) Operasional Toko:</span>
                        <span>-{formatRupiah(numOperationalExpenses)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-amber-300 text-sm">
                      <span>(=) Uang Seharusnya di Laci:</span>
                      <span className="text-amber-950">{formatRupiah(expectedCashInDrawer)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Hitung & Masukkan Uang Fisik Kas di Laci:
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">Rp</span>
                        <input
                          type="text"
                          value={actualEndingCash}
                          onChange={(e) => setActualEndingCash(formatNumberInput(e.target.value) || '0')}
                          placeholder="0"
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                          required
                          autoFocus
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Harus ada: <span className="font-bold text-slate-800">{formatRupiah(expectedCashInDrawer)}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Catatan Tutup Shift:
                      </label>
                      <input
                        type="text"
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        placeholder="Contoh: Kas sesuai, nota terarsip rapi"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                      <div className="flex justify-between items-center text-xs mt-1.5">
                        <span className="text-slate-600 font-medium">Selisih Kas:</span>
                        <span
                          className={`font-bold px-2.5 py-0.5 rounded text-[11px] ${
                            cashDifference === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : cashDifference > 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {cashDifference === 0
                            ? 'Sesuai (Rp 0)'
                            : cashDifference > 0
                            ? `Lebih: +${formatRupiah(cashDifference)}`
                            : `Kurang: ${formatRupiah(cashDifference)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-100/70 rounded-xl text-xs text-amber-900 font-medium flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Seluruh transaksi yang tercatat pada shift ini akan otomatis tersimpan dalam file Laporan Excel (.xlsx).</span>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCloseFormVisible(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      id="btn-confirm-tutup-rekap-kasir"
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Power className="w-4 h-4" />
                      Konfirmasi Tutup & Rekap Kasir
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCloseFormVisible(true)}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Tutup & Rekap Kasir
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center space-y-3">
              <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
              <h2 className="text-base font-bold text-amber-900">Belum Ada Shift Kasir yang Dibuka</h2>
              <p className="text-xs text-amber-800 max-w-md mx-auto">
                Silakan buka shift kasir baru dengan memilih kasir bertugas dan shift kerja untuk memulai transaksi di POS.
              </p>
              <button
                type="button"
                onClick={onOpenShiftModal}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Buka Shift Kasir Sekarang
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAFTAR KASIR & SHIFT TOKO */}
      {activeSubTab === 'cashiers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Daftar Kasir Aktif & Parameter Shift Toko
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kasir yang terdaftar di sini dapat langsung dipilih saat membuka aplikasi POS atau mengganti shift.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddCashier}
              className="px-4 py-2 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-sky-400" />
              Tambah Kasir
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cashiers.map((cashier) => (
              <div
                key={cashier.id}
                className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200 hover:border-blue-300 p-4 space-y-3 transition-all shadow-2xs hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-black text-sm flex items-center justify-center">
                      {cashier.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">{cashier.name}</span>
                      <span className="text-[11px] text-blue-600 font-semibold">{cashier.shiftName}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      cashier.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {cashier.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cashier.phone || 'Tidak ada nomor telepon'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Role: {cashier.role || 'Kasir Standar'}</span>
                  </div>
                  {cashier.notes && (
                    <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
                      {cashier.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEditCashier(cashier)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCashierConfirm(cashier)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RIWAYAT SHIFT SEBELUMNYA */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              Riwayat Rekap Shift Sebelumnya
            </h2>
            {isDeveloper && pastShifts.length > 0 && onClearAllShifts && (
              <button
                type="button"
                onClick={onClearAllShifts}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                title="Hapus seluruh riwayat rekap shift (Khusus Developer)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua Riwayat</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ID Shift</th>
                  <th className="py-3 px-4">Kasir & Shift</th>
                  <th className="py-3 px-4">Toko / Cabang</th>
                  <th className="py-3 px-4">Waktu Mulai - Selesai</th>
                  <th className="py-3 px-4 text-right">Modal Awal</th>
                  <th className="py-3 px-4 text-right">Total Penjualan</th>
                  <th className="py-3 px-4 text-right">Operasional</th>
                  <th className="py-3 px-4 text-right">Kas Fisik Laci</th>
                  <th className="py-3 px-4 text-center">Status Selisih</th>
                  {isDeveloper && <th className="py-3 px-4 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastShifts.length > 0 ? (
                  pastShifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {s.id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 uppercase block">{s.cashierName}</span>
                        <span className="text-blue-600 text-[10px] font-semibold">{s.shiftName || 'Shift 1'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {s.storeName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        <div>Mulai: <span className="font-bold text-slate-800">{formatShiftTime(s.startTime, s.date)}</span></div>
                        <div className="text-[10px] text-slate-400">{formatShiftDate(s.startTime, s.date)}</div>
                        {s.endTime && (
                          <div className="mt-0.5 text-slate-700">Tutup: <span className="font-bold">{formatShiftTime(s.endTime, s.date)}</span></div>
                        )}
                        <div className="text-[10px] text-blue-600 font-bold mt-0.5">
                          Durasi: {getShiftDurationString(s.startTime, s.date, s.endTime)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatRupiah(s.startingCash)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-900">
                        {formatRupiah(s.totalCashSales + s.totalTransferSales + s.totalQrisSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {s.operationalExpenses && s.operationalExpenses > 0 ? (
                          <div>
                            <span className="text-red-600 font-semibold">-{formatRupiah(s.operationalExpenses)}</span>
                            {s.operationalNotes && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{s.operationalNotes}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-800">
                        {formatRupiah(s.actualEndingCash || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            (s.cashDifference || 0) === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : (s.cashDifference || 0) > 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {(s.cashDifference || 0) === 0
                            ? 'Sesuai (Rp 0)'
                            : (s.cashDifference || 0) > 0
                            ? `+${formatRupiah(s.cashDifference || 0)}`
                            : formatRupiah(s.cashDifference || 0)}
                        </span>
                      </td>
                      {isDeveloper && (
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Hapus data rekap shift "${s.id}" (${s.cashierName})?`)) {
                                onDeleteShift?.(s.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
                            title="Hapus Rekap Shift Ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isDeveloper ? 10 : 9} className="py-8 text-center text-slate-400">
                      Belum ada riwayat shift yang ditutup.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cashier Modal */}
      <CashierModal
        isOpen={isCashierModalOpen}
        onClose={() => setIsCashierModalOpen(false)}
        cashierToEdit={editingCashier}
        onSaveCashier={onSaveCashier}
      />
    </div>
  );
};
