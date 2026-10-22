/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect } from 'react';
import { X, Pencil, Save, Calendar, Clock, User, CreditCard, Banknote, QrCode, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Transaction, Customer, CustomerCategory } from '../../types';
import { formatRupiah, formatNumberInput, parseNumber } from '../../utils/formatters';

interface EditSalesTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSaveTransaction: (updatedTx: Transaction) => Promise<void> | void;
  customers?: Customer[];
  categories?: CustomerCategory[];
}

export const EditSalesTransactionModal: React.FC<EditSalesTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSaveTransaction,
  customers = [],
  categories = [],
}) => {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCategory, setCustomerCategory] = useState('UMUM');
  
  const [cashAmountInput, setCashAmountInput] = useState('0');
  const [transferAmountInput, setTransferAmountInput] = useState('0');
  const [qrisAmountInput, setQrisAmountInput] = useState('0');
  const [discountInput, setDiscountInput] = useState('0');
  const [subtotalInput, setSubtotalInput] = useState('0');
  const [cashierNotes, setCashierNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (transaction) {
      setDateStr(transaction.date || '');
      setTimeStr(transaction.time || '');
      setCashierName(transaction.cashierName || '');
      setShiftName(transaction.shiftName || 'Shift 1');
      setCustomerName(transaction.customer?.name || '');
      setCustomerPhone(transaction.customer?.phone || '');
      const rawCat = transaction.customerCategory || 'UMUM';
      setCustomerCategory(rawCat.toUpperCase() === 'RETAIL' ? 'UMUM' : rawCat);

      setCashAmountInput((transaction.paymentMethods?.cash || 0).toLocaleString('id-ID'));
      setTransferAmountInput((transaction.paymentMethods?.transfer || 0).toLocaleString('id-ID'));
      setQrisAmountInput((transaction.paymentMethods?.qris || 0).toLocaleString('id-ID'));
      setDiscountInput((transaction.discount || 0).toLocaleString('id-ID'));
      setSubtotalInput((transaction.subtotal || transaction.total || 0).toLocaleString('id-ID'));
      setCashierNotes(transaction.cashierNotes || '');
      setErrorMsg('');
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const numSubtotal = parseNumber(subtotalInput);
  const numDiscount = parseNumber(discountInput);
  const calculatedGrandTotal = Math.max(0, numSubtotal - numDiscount);

  const numCash = parseNumber(cashAmountInput);
  const numTransfer = parseNumber(transferAmountInput);
  const numQris = parseNumber(qrisAmountInput);
  const totalPaid = numCash + numTransfer + numQris;
  const change = Math.max(0, totalPaid - calculatedGrandTotal);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    if (totalPaid < calculatedGrandTotal) {
      if (!confirm(`Total pembayaran (${formatRupiah(totalPaid)}) kurang dari tagihan (${formatRupiah(calculatedGrandTotal)}). Tetap simpan?`)) {
        return;
      }
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const updatedCustomer = customerName.trim()
        ? {
            id: transaction.customer?.id || 'cust_' + Date.now(),
            name: customerName.trim(),
            phone: customerPhone.trim() || '0800000000',
            categoryId: categories.find((c) => c.name === customerCategory)?.id || 'cat_umum',
            createdAt: transaction.customer?.createdAt || dateStr,
            totalSpent: transaction.customer?.totalSpent || 0,
            transactionCount: transaction.customer?.transactionCount || 1,
          }
        : undefined;

      const updatedTx: Transaction = {
        ...transaction,
        date: dateStr,
        time: timeStr,
        cashierName: cashierName.trim() || 'DEVELOPER',
        shiftName: shiftName.trim() || 'Shift 1',
        customer: updatedCustomer,
        customerCategory: customerCategory,
        subtotal: numSubtotal,
        discount: numDiscount,
        total: calculatedGrandTotal,
        paymentMethods: {
          cash: Math.max(0, numCash - change),
          transfer: numTransfer,
          qris: numQris,
        },
        paidAmount: totalPaid,
        change: change,
        cashierNotes: cashierNotes.trim(),
      };

      await onSaveTransaction(updatedTx);
      onClose();
    } catch (err: any) {
      console.error('Error saving transaction edit:', err);
      setErrorMsg(err?.message || 'Gagal menyimpan perubahan transaksi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        id="modal-edit-transaksi-penjualan"
        className="bg-white rounded-2xl max-sm:rounded-b-none max-sm:rounded-t-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-[#1e295d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-300">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">EDIT TRANSAKSI PENJUALAN</h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {transaction.id}
                </span>
              </div>
              <p className="text-[11px] text-blue-200">
                Fitur Akses Khusus Akun DEVELOPER
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleFormSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date, Time, Shift & Cashier */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Informasi Waktu & Petugas:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  Tanggal Transaksi
                </label>
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  placeholder="Contoh: 18/09/26"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Jam Transaksi
                </label>
                <input
                  type="text"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  placeholder="Contoh: 14:30"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nama Kasir
                </label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Shift
                </label>
                <input
                  type="text"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Data Pelanggan:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Pelanggan Umum"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  No. WhatsApp / HP
                </label>
                <input
                  type="text"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08xxxxxxxx"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Kategori
                </label>
                <select
                  value={customerCategory}
                  onChange={(e) => setCustomerCategory(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800"
                >
                  <option value="UMUM">UMUM</option>
                  <option value="GROSIR">GROSIR</option>
                  <option value="AGEN">AGEN</option>
                </select>
              </div>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Rincian Nominal & Pembayaran:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Subtotal Tagihan (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={subtotalInput}
                  onChange={(e) => setSubtotalInput(formatNumberInput(e.target.value) || '0')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 text-red-600">
                  Diskon (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(formatNumberInput(e.target.value) || '0')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-red-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  Pembayaran Tunai (Cash)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cashAmountInput}
                  onChange={(e) => setCashAmountInput(formatNumberInput(e.target.value) || '0')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-sky-700 mb-1 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                  Pembayaran Transfer
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={transferAmountInput}
                  onChange={(e) => setTransferAmountInput(formatNumberInput(e.target.value) || '0')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-sky-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-700 mb-1 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-purple-600" />
                  Pembayaran QRIS
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={qrisAmountInput}
                  onChange={(e) => setQrisAmountInput(formatNumberInput(e.target.value) || '0')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-purple-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Total Tagihan Akhir
                </label>
                <div className="bg-slate-200/80 border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-black text-sm text-blue-900">
                  {formatRupiah(calculatedGrandTotal)}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Kasir
            </label>
            <textarea
              rows={2}
              value={cashierNotes}
              onChange={(e) => setCashierNotes(e.target.value)}
              placeholder="Catatan transaksi..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-800"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#1e295d] hover:bg-[#151e44] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4 text-sky-400" />
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
