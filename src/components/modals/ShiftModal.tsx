/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect } from 'react';
import { X, Clock, DollarSign, AlertCircle, CheckCircle2, UserCheck, FileSpreadsheet, Receipt, Wallet, ShoppingBag } from 'lucide-react';
import { Shift, Transaction } from '../../types';
import { APP_NAME } from '../../config/brand';
import {
  formatRupiah,
  formatNumberInput,
  parseNumber,
  formatShiftTime,
  formatShiftDate,
  getShiftDurationString,
  getTransactionsForShift,
  getNetCashAmount
} from '../../utils/formatters';
import { exportTransactionsToExcel } from '../../utils/excelExport';
import { StoreLogo } from '../StoreLogo';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: Shift | null;
  transactions: Transaction[];
  defaultStoreName?: string;
  categories?: any[];
  customers?: any[];
  onOpenShift: (cashierName: string, startingCash: number, storeName: string, shiftName?: string) => void;
  onCloseShift: (actualCash: number, notes: string, operationalExpenses?: number, operationalNotes?: string) => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  transactions,
  defaultStoreName,
  categories,
  customers,
  onOpenShift,
  onCloseShift,
}) => {
  // Open shift state
  const [cashierName, setCashierName] = useState('FIRA');
  const [storeName, setStoreName] = useState(defaultStoreName || APP_NAME);
  const [startingCash, setStartingCash] = useState<string>('250.000');

  // Real-time clock ticker for shift duration calculation
  const [nowTick, setNowTick] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync default store name if changed
  React.useEffect(() => {
    if (defaultStoreName) {
      setStoreName(defaultStoreName);
    }
  }, [defaultStoreName]);

  // Close shift state
  const [operationalExpenses, setOperationalExpenses] = useState<string>('0');
  const [operationalNotes, setOperationalNotes] = useState<string>('');
  const [actualEndingCash, setActualEndingCash] = useState<string>('0');
  const [closingNotes, setClosingNotes] = useState('');

  if (!isOpen) return null;

  // Filter transactions belonging to current active shift
  const shiftTransactions = activeShift
    ? getTransactionsForShift(activeShift, transactions, categories, customers)
    : [];

  const shiftCashSales = shiftTransactions.reduce((acc, t) => acc + getNetCashAmount(t), 0);
  const shiftTransferSales = shiftTransactions.reduce((acc, t) => acc + (t.paymentMethods?.transfer || 0), 0);
  const shiftQrisSales = shiftTransactions.reduce((acc, t) => acc + (t.paymentMethods?.qris || 0), 0);
  const totalShiftSales = shiftTransactions.reduce((acc, t) => acc + (t.total || 0), 0);

  const numOperationalExpenses = parseNumber(operationalExpenses);
  const numEndingCash = parseNumber(actualEndingCash);
  const expectedCashInDrawer = (activeShift?.startingCash || 0) + shiftCashSales - numOperationalExpenses;
  const cashDifference = numEndingCash - expectedCashInDrawer;

  const handleStartShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierName.trim()) {
      alert('Nama kasir wajib diisi.');
      return;
    }
    const numStartingCash = parseNumber(startingCash);
    onOpenShift(cashierName.trim(), numStartingCash, storeName.trim() || APP_NAME);
    onClose();
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm('Apakah Anda yakin ingin menutup shift kasir ini dan merekap laporan kas? Laporan Excel akan otomatis di-download.')) {
      if (shiftTransactions.length > 0) {
        exportTransactionsToExcel(
          shiftTransactions,
          `Laporan_Rekap_Shift_${activeShift?.cashierName || 'Kasir'}_${activeShift?.id || 'Shift'}`
        );
      }
      onCloseShift(numEndingCash, closingNotes, numOperationalExpenses, operationalNotes);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        id="modal-shift-kasir"
        className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-300 flex flex-col max-h-[90vh]"
      >
        <div className="bg-slate-100 text-slate-900 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <StoreLogo size="sm" rounded="rounded-lg" storeName={storeName} className="border border-slate-200 shadow-2xs" />
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900">
                {activeShift ? 'STATUS & TUTUP SHIFT KASIR' : 'BUKA SHIFT KASIR BARU'}
              </h2>
              <p className="text-xs text-slate-500 font-bold">
                {activeShift ? `Shift Berjalan: ${activeShift.id}` : 'Mulai shift kerja & catat modal kas laci'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 p-1.5 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeShift ? (
          // Active shift view & Close shift form
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Kasir Bertugas:</span>
                <span className="font-bold text-slate-800 text-sm uppercase">{activeShift.cashierName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Toko / Cabang:</span>
                <span className="font-bold text-slate-800 text-sm">{activeShift.storeName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Waktu Mulai Shift:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {formatShiftTime(activeShift.startTime, activeShift.date)}
                </span>
                <span className="text-[10px] text-slate-400 block">{formatShiftDate(activeShift.startTime, activeShift.date)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Durasi Real-Time:</span>
                <span className="font-black text-blue-900 font-mono text-sm block">
                  {getShiftDurationString(activeShift.startTime, activeShift.date)}
                </span>
                <span className="text-[10px] text-blue-600 font-medium block">
                  Live: {nowTick.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Modal Kas Awal di Laci:</span>
                <span className="font-black text-emerald-700 text-sm font-mono">{formatRupiah(activeShift.startingCash)}</span>
              </div>
            </div>

            {/* Sales during shift */}
            <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-white">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex justify-between">
                <span>Ringkasan Transaksi Shift</span>
                <span className="text-blue-600">{shiftTransactions.length} Struk</span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                <div className="flex justify-between">
                  <span>Penjualan Tunai (Cash):</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(shiftCashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Penjualan Transfer Bank:</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(shiftTransferSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Penjualan QRIS:</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(shiftQrisSales)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Omzet Shift:</span>
                  <span className="text-blue-800">{formatRupiah(totalShiftSales)}</span>
                </div>
              </div>
            </div>

            {/* Close shift calculations & inputs */}
            <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 space-y-3.5">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-amber-700" />
                  Rekapitulasi Uang Kas Laci
                </span>
                <span className="text-[11px] font-bold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded">
                  Target: {formatRupiah(expectedCashInDrawer)}
                </span>
              </div>

              {/* Input Operasional Toko */}
              <div className="bg-white p-3 rounded-xl border border-amber-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-red-600" />
                    Operasional Toko:
                  </label>
                  <span className="text-[10px] text-red-600 font-semibold italic">
                    *Mengurangi jumlah uang di laci
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">Rp</span>
                  <input
                    type="text"
                    value={operationalExpenses}
                    onChange={(e) => setOperationalExpenses(formatNumberInput(e.target.value) || '0')}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-red-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <input
                  type="text"
                  value={operationalNotes}
                  onChange={(e) => setOperationalNotes(e.target.value)}
                  placeholder="Keterangan operasional (misal: beli lakban, makan siang, galon)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Rincian Rumus Kas di Laci */}
              <div className="p-2.5 bg-amber-100/50 rounded-lg text-[11px] text-slate-700 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Modal Awal Kas:</span>
                  <span>{formatRupiah(activeShift.startingCash)}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>(+) Penjualan Tunai (Cash):</span>
                  <span>+{formatRupiah(shiftCashSales)}</span>
                </div>
                {numOperationalExpenses > 0 && (
                  <div className="flex justify-between text-red-700 font-semibold">
                    <span>(-) Operasional Toko:</span>
                    <span>-{formatRupiah(numOperationalExpenses)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-amber-300 text-xs">
                  <span>(=) Uang Seharusnya di Laci:</span>
                  <span>{formatRupiah(expectedCashInDrawer)}</span>
                </div>
              </div>

              {/* Input Uang Fisik Kasir */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Hitung & Masukkan Uang Fisik Kas di Laci:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">Rp</span>
                  <input
                    type="text"
                    value={actualEndingCash}
                    onChange={(e) => setActualEndingCash(formatNumberInput(e.target.value) || '0')}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
              </div>

              {/* Status Selisih */}
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="font-semibold text-slate-700">Selisih Kas Laci:</span>
                <span
                  className={`font-bold px-2.5 py-1 rounded-md text-xs ${
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tutup Shift:
                </label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Contoh: Kas cocok, nota terarsip rapi"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Kembali ke POS
              </button>
              <button
                type="button"
                id="btn-konfirmasi-tutup-shift"
                onClick={handleCloseShiftSubmit}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Tutup Shift & Rekap Kas
              </button>
            </div>
          </div>
        ) : (
          // Open shift form
          <form onSubmit={handleStartShiftSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Kasir Bertugas
              </label>
              <input
                type="text"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="misal: FIRA"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Toko / Cabang
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="misal: BEJO Pelsek"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Modal Kas Awal di Laci (Uang Kembalian):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">Rp</span>
                <input
                  type="text"
                  value={startingCash}
                  onChange={(e) => setStartingCash(formatNumberInput(e.target.value) || '0')}
                  placeholder="0"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold text-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                id="btn-submit-buka-shift"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Mulai & Buka Shift
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
