/**
 * Coded by Langgo Bramandityo.
 * Modal Penarik Transaksi dari Laporan Penjualan ke Invoice Baru
 * Mendukung 4 Jenis Transaksi: SPK Cetak, Open Account, Reguler (POS), dan Invoice B2B
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Package,
  FileText,
  Calendar,
  User,
  ArrowRight
} from 'lucide-react';
import { Transaction } from '../../types';
import { APP_NAME } from '../../config/brand';
import { getStoredTransactions, getStoredSpkOrders } from '../../utils/storage';
import { getStoredInvoices, convertInvoicesToTransactions } from '../../utils/invoiceStorage';
import { groupOpenAccountOrders } from '../../utils/openAccountStorage';
import { formatRupiah } from '../../utils/formatters';

interface SalesTransactionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTransaction: (tx: Transaction) => void;
}

export const SalesTransactionPickerModal: React.FC<SalesTransactionPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTransaction
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'SPK' | 'OPEN_ACCOUNT' | 'REGULAR' | 'INVOICE'>('ALL');

  useEffect(() => {
    if (isOpen) {
      const posTx = getStoredTransactions();
      const invTx = convertInvoicesToTransactions(getStoredInvoices());
      const txMap = new Map<string, Transaction & { openAccountGroupData?: any }>();

      // 1. Masukkan Transaksi Aktif Konsolidasi Open Account dari SPK
      const allSpkOrders = getStoredSpkOrders();
      const activeOaOrders = allSpkOrders.filter((o) => o.status === 'OPEN_ACCOUNT' || o.isOpenAccount);
      const activeOaGroups = groupOpenAccountOrders(activeOaOrders);

      activeOaGroups.forEach((group) => {
        const allItems: any[] = [];
        (group.orders || []).forEach((ord: any) => {
          (ord.items || []).forEach((it: any, idx: number) => {
            allItems.push({
              id: `oa_it_${ord.id}_${it.id || idx}`,
              spkId: ord.id,
              spkOrderNumber: ord.orderNumber,
              name: `[${ord.orderNumber}] ${it.jobName || it.materialName}`,
              formattedSpec: `${it.materialName} • ${it.lengthMeters}x${it.widthMeters}m (${it.qty || 1} pcs)${ord.dpPaid > 0 ? ` (DP: -${formatRupiah(ord.dpPaid)})` : ''}`,
              qty: it.qty || 1,
              itemCount: it.qty || 1,
              unit: it.saleMode === 'lembar' ? 'lembar' : `${it.lengthMeters}x${it.widthMeters}m`,
              unitPrice: it.totalPrice,
              totalPrice: it.totalPrice,
              notes: `SPK: ${ord.orderNumber} • ${it.materialName}`
            });
          });
        });

        if (group.adjustment && group.adjustment !== 0) {
          allItems.push({
            id: `oa_adj_${group.customerId}`,
            name: `Penyesuaian Sisa Tagihan: ${group.adjustmentReason || 'Penyesuaian Plafon'}`,
            formattedSpec: group.adjustmentReason || 'Penyesuaian Tagihan Open Account',
            qty: 1,
            itemCount: 1,
            unit: 'paket',
            unitPrice: group.adjustment,
            totalPrice: group.adjustment,
            notes: group.adjustmentReason || 'Penyesuaian Plafon'
          });
        }

        const oaVirtualTx: Transaction & { openAccountGroupData?: any } = {
          id: `OA-${group.customerId}`,
          date: group.latestDate || '',
          time: '12:00',
          timestamp: Date.now() + 100000,
          storeName: APP_NAME,
          cashierName: 'Pipeline Open Account',
          customer: {
            id: group.customerId,
            name: group.customerName,
            phone: group.customerPhone || '',
            categoryId: 'cat_oa',
            createdAt: group.latestDate || ''
          },
          items: allItems,
          totalQty: allItems.reduce((acc, it) => acc + (it.qty || 1), 0),
          subtotal: group.subtotal,
          tax: 0,
          discount: 0,
          total: group.totalAmount,
          paidAmount: 0,
          change: 0,
          paymentMethods: {
            cash: 0,
            transfer: 0,
            qris: 0
          },
          cashierNotes: group.notes || `Tagihan Konsolidasi Open Account (${group.orders?.length || 0} SPK)`,
          isOpenAccount: true,
          transactionType: 'Open Account',
          spkOrderNumber: (group.orders || []).map((o: any) => o.orderNumber).join(', '),
          openAccountGroupData: group
        };

        txMap.set(oaVirtualTx.id, oaVirtualTx);
      });

      posTx.forEach((t) => txMap.set(t.id, t));
      invTx.forEach((t) => {
        if (!txMap.has(t.id)) txMap.set(t.id, t);
      });

      // Sort newest first
      const allTx = Array.from(txMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setTransactions(allTx);
    }
  }, [isOpen]);

  const getTransactionType = (tx: Transaction): 'Open Account' | 'Invoice B2B' | 'SPK Cetak' | 'Reguler (POS)' => {
    if (tx.isOpenAccount || tx.transactionType === 'Open Account') return 'Open Account';
    if (tx.isInvoice) return 'Invoice B2B';
    const isSpk = !!(tx.spkId || tx.spkOrderNumber || tx.items?.some(i => i.spkId || i.code?.startsWith('SPK-') || i.name?.startsWith('[SPK]')));
    if (isSpk) return 'SPK Cetak';
    return 'Reguler (POS)';
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txType = getTransactionType(tx);

      if (selectedTypeFilter === 'SPK' && txType !== 'SPK Cetak') return false;
      if (selectedTypeFilter === 'OPEN_ACCOUNT' && txType !== 'Open Account') return false;
      if (selectedTypeFilter === 'REGULAR' && txType !== 'Reguler (POS)') return false;
      if (selectedTypeFilter === 'INVOICE' && txType !== 'Invoice B2B') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchId = tx.id.toLowerCase().includes(q);
      const matchCust = tx.customer?.name?.toLowerCase().includes(q) || tx.customer?.phone?.includes(q);
      const matchItems = tx.items?.some(it => it.name.toLowerCase().includes(q) || (it.notes && it.notes.toLowerCase().includes(q)));
      const matchSpk = tx.spkOrderNumber?.toLowerCase().includes(q) || tx.spkId?.toLowerCase().includes(q);

      return matchId || matchCust || matchItems || matchSpk;
    });
  }, [transactions, selectedTypeFilter, searchQuery]);

  const counts = useMemo(() => {
    let spk = 0;
    let openAccount = 0;
    let regular = 0;
    let invoice = 0;

    transactions.forEach(tx => {
      const type = getTransactionType(tx);
      if (type === 'Open Account') openAccount++;
      else if (type === 'Invoice B2B') invoice++;
      else if (type === 'SPK Cetak') spk++;
      else regular++;
    });

    return { all: transactions.length, spk, openAccount, regular, invoice };
  }, [transactions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-2xs">
              <FileSpreadsheet className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Tarik Transaksi dari Laporan Penjualan</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 border border-amber-500">
                  4 Tipe Penjualan
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pilih transaksi SPK Cetak, Open Account, Reguler POS, atau Invoice B2B untuk langsung diimpor ke rincian invoice baru.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar & Search */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* 4 Tipe Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedTypeFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Semua</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md font-extrabold">
                  {counts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTypeFilter('OPEN_ACCOUNT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedTypeFilter === 'OPEN_ACCOUNT'
                    ? 'bg-amber-400 text-slate-950 shadow-2xs font-black ring-2 ring-amber-300'
                    : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>Open Account</span>
                <span className="text-[10px] bg-amber-200 text-slate-950 px-1.5 py-0.2 rounded-md font-black">
                  {counts.openAccount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTypeFilter('SPK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedTypeFilter === 'SPK'
                    ? 'bg-indigo-600 text-white shadow-2xs ring-2 ring-indigo-300'
                    : 'text-indigo-700 hover:text-indigo-950 hover:bg-indigo-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>SPK Cetak</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-md font-extrabold">
                  {counts.spk}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTypeFilter('REGULAR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedTypeFilter === 'REGULAR'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-slate-500" />
                <span>Reguler (POS)</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md font-extrabold">
                  {counts.regular}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTypeFilter('INVOICE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedTypeFilter === 'INVOICE'
                    ? 'bg-blue-600 text-white shadow-2xs ring-2 ring-blue-300'
                    : 'text-blue-700 hover:text-blue-950 hover:bg-blue-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span>Invoice B2B</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md font-extrabold">
                  {counts.invoice}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari No. TX, Pelanggan, Produk..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-amber-400 focus:outline-hidden bg-white"
              />
            </div>
          </div>
        </div>

        {/* List Transaksi Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-xs font-bold">Tidak ditemukan transaksi yang sesuai kriteria.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {filteredTransactions.map(tx => {
                const txType = getTransactionType(tx);

                const badgeBg =
                  txType === 'Open Account'
                    ? 'bg-amber-400 text-slate-950 border-amber-500 font-black'
                    : txType === 'SPK Cetak'
                    ? 'bg-indigo-600 text-white border-indigo-700 font-bold'
                    : txType === 'Invoice B2B'
                    ? 'bg-blue-600 text-white border-blue-700 font-bold'
                    : 'bg-slate-700 text-white border-slate-800 font-bold';

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          {tx.id}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border shadow-2xs ${badgeBg}`}>
                          {txType}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {tx.date} {tx.time?.slice(0, 5)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{tx.customer?.name || 'Pelanggan Umum'}</span>
                          {tx.customer?.phone && (
                            <span className="text-[10px] text-slate-500 font-mono font-normal">
                              ({tx.customer.phone})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="text-[11px] text-slate-600 font-medium line-clamp-1">
                        📦 <span className="font-bold text-slate-800">{tx.items.length} Item:</span>{' '}
                        {tx.items.map(i => `${i.name} (${i.qty || 1}x)`).join(', ')}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="text-right">
                        <div className="text-[10.5px] text-slate-400 font-bold uppercase">Total Tagihan</div>
                        <div className="font-mono text-sm font-black text-slate-900">
                          {formatRupiah(tx.total || 0)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectTransaction(tx);
                          onClose();
                        }}
                        className="px-3 py-2 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black text-xs rounded-xl border border-amber-500 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      >
                        <span>Tarik ke Invoice</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Menampilkan <strong>{filteredTransactions.length}</strong> transaksi dari Laporan Penjualan</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
