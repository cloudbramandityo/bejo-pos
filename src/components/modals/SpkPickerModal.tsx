/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 * Modal Tarik / Ambil SPK Cetak Digital ke Keranjang POS Kasir
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  Search,
  X,
  CheckCircle2,
  Clock,
  User,
  Phone,
  ArrowRight,
  Sparkles,
  Layers,
  Flame,
  AlertCircle,
  Tag,
  Check,
  ShoppingCart
} from 'lucide-react';
import { SpkOrder, SpkStatus } from '../../types';
import { getStoredSpkOrders } from '../../utils/storage';
import { formatRupiah } from '../../utils/formatters';
import { groupOpenAccountOrders, OpenAccountCustomerGroup } from '../../utils/openAccountStorage';

interface SpkPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpk: (order: SpkOrder) => void;
  onSelectBatchSpk?: (orders: SpkOrder[]) => void;
  onSelectOpenAccountGroup?: (group: OpenAccountCustomerGroup) => void;
  existingSpkIds?: string[];
  hasOpenAccountInCart?: boolean;
  initialTab?: 'ALL' | 'SIAP_AMBIL' | 'OPEN_ACCOUNT' | 'FINISHING' | 'SEDANG_CETAK' | 'MENUNGGU_SETTING';
}

export const SpkPickerModal: React.FC<SpkPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSpk,
  onSelectBatchSpk,
  onSelectOpenAccountGroup,
  existingSpkIds = [],
  hasOpenAccountInCart = false,
  initialTab = 'ALL'
}) => {
  const [orders, setOrders] = useState<SpkOrder[]>(() => getStoredSpkOrders());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'ALL' | 'SIAP_AMBIL' | 'OPEN_ACCOUNT' | 'FINISHING' | 'SEDANG_CETAK' | 'MENUNGGU_SETTING'>(initialTab);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setOrders(getStoredSpkOrders());
      setSelectedOrderIds([]);
      if (initialTab) {
        setSelectedTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setOrders(e.detail);
      } else {
        setOrders(getStoredSpkOrders());
      }
    };
    window.addEventListener('bejo_spk_orders_updated', handleSync);
    return () => window.removeEventListener('bejo_spk_orders_updated', handleSync);
  }, []);

  // Filter only unpaid or active orders
  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status !== 'SELESAI_LUNAS' && o.status !== 'DIBATALKAN');
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      const matchSearch =
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerPhone && o.customerPhone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        o.items.some(
          (it) =>
            it.jobName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            it.materialName.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchTab = selectedTab === 'ALL' || o.status === selectedTab;

      return matchSearch && matchTab;
    });
  }, [activeOrders, searchQuery, selectedTab]);

  const openAccountGroups = useMemo(() => {
    const oaOrders = orders.filter((o) => o.status === 'OPEN_ACCOUNT' || o.isOpenAccount);
    return groupOpenAccountOrders(oaOrders);
  }, [orders]);

  const filteredOpenAccountGroups = useMemo(() => {
    return openAccountGroups.filter((g) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchCust = g.customerName.toLowerCase().includes(q) || g.customerPhone.includes(q);
      const matchOrder = g.orders.some(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.items.some((it) => it.jobName.toLowerCase().includes(q) || it.materialName.toLowerCase().includes(q))
      );
      return matchCust || matchOrder;
    });
  }, [openAccountGroups, searchQuery]);

  const counts = useMemo(() => {
    const all = activeOrders.length;
    const ready = activeOrders.filter((o) => o.status === 'SIAP_AMBIL').length;
    const openAccount = openAccountGroups.length;
    const finishing = activeOrders.filter((o) => o.status === 'FINISHING').length;
    const printing = activeOrders.filter((o) => o.status === 'SEDANG_CETAK').length;
    const setting = activeOrders.filter((o) => o.status === 'MENUNGGU_SETTING' || o.status === 'SETTING_SELESAI').length;
    return { all, ready, openAccount, finishing, printing, setting };
  }, [activeOrders, openAccountGroups]);

  if (!isOpen) return null;

  const getStatusBadge = (status: SpkStatus) => {
    switch (status) {
      case 'OPEN_ACCOUNT':
        return {
          label: '6. Open Account',
          bg: 'bg-amber-300 text-slate-950 border-amber-500 font-black',
          dot: 'bg-amber-600'
        };
      case 'SIAP_AMBIL':
        return {
          label: '5. Siap Ambil / Bayar',
          bg: 'bg-emerald-100 text-emerald-950 border-emerald-400 font-black',
          dot: 'bg-emerald-600'
        };
      case 'FINISHING':
        return {
          label: '4. Proses Finishing',
          bg: 'bg-purple-100 text-purple-950 border-purple-300 font-bold',
          dot: 'bg-purple-600'
        };
      case 'SEDANG_CETAK':
        return {
          label: '3. Sedang Cetak',
          bg: 'bg-indigo-100 text-indigo-950 border-indigo-300 font-bold',
          dot: 'bg-indigo-600 animate-pulse'
        };
      case 'SETTING_SELESAI':
        return {
          label: '2. Setting Siap Cetak',
          bg: 'bg-blue-100 text-blue-950 border-blue-300 font-bold',
          dot: 'bg-blue-600'
        };
      case 'MENUNGGU_SETTING':
        return {
          label: '1. Menunggu Setting',
          bg: 'bg-amber-100 text-amber-950 border-amber-300 font-bold',
          dot: 'bg-amber-600'
        };
      default:
        return {
          label: status,
          bg: 'bg-slate-100 text-slate-900 border-slate-300 font-bold',
          dot: 'bg-slate-500'
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-tight">TARIK SPK CETAK DIGITAL KE POS</h2>
                <span className="bg-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-500/40">
                  TAHAP 2 • 1-KLIK INTEGRASI
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Pilih SPK pekerjaan untuk memuat data bahan, ukuran, finishing, dan sisa pelunasan ke kasir.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. SPK, Pelanggan, No. WA, atau Nama Pekerjaan..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
              autoFocus
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setSelectedTab('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Semua Aktif ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('SIAP_AMBIL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedTab === 'SIAP_AMBIL'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300'
              }`}
            >
              ✓ Siap Ambil / Bayar ({counts.ready})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('OPEN_ACCOUNT')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedTab === 'OPEN_ACCOUNT'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs border border-amber-500'
                  : 'bg-amber-50 text-amber-950 hover:bg-amber-100 border border-amber-300 font-bold'
              }`}
            >
              <span>⚡ Open Account</span>
              <span className="bg-amber-300 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black border border-amber-400">
                {counts.openAccount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('FINISHING')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedTab === 'FINISHING'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Finishing ({counts.finishing})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('SEDANG_CETAK')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedTab === 'SEDANG_CETAK'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Sedang Cetak ({counts.printing})
            </button>
          </div>
        </div>

        {/* List of SPK Orders & Open Account Consolidated Bills */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-100/60">
          {selectedTab === 'OPEN_ACCOUNT' ? (
            filteredOpenAccountGroups.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-bold text-xs bg-white rounded-2xl border border-dashed border-amber-300 p-6">
                <Layers className="w-10 h-10 text-amber-500 mx-auto mb-2 opacity-50" />
                <p className="font-extrabold text-slate-800 text-sm">Tidak ada tagihan Open Account aktif saat ini.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tagihan Open Account muncul setelah SPK dipindahkan ke status Open Account (Rekening Terbuka) di alur kerja SPK.
                </p>
              </div>
            ) : (
              filteredOpenAccountGroups.map((group) => (
                <div
                  key={group.customerId}
                  className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-amber-400 shadow-sm space-y-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full border border-amber-500 shadow-2xs">
                        ⚡ Open Account
                      </span>
                      <span className="font-black text-slate-950 text-sm">{group.customerName}</span>
                      {group.customerPhone && (
                        <span className="text-xs text-slate-600 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {group.customerPhone}
                        </span>
                      )}
                      <span className="text-[10.5px] font-bold bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                        {group.orders.length} SPK Digabung
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 font-mono font-medium">
                      Tgl: <strong className="text-slate-900 font-bold">{group.latestDate || group.earliestDate}</strong>
                    </div>
                  </div>

                  {/* Orders list in group */}
                  <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 space-y-2 text-xs">
                    <div className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                      Daftar SPK yang Dikonsolidasi:
                    </div>
                    <div className="space-y-1.5">
                      {group.orders.map((ord) => (
                        <div key={ord.id} className="bg-white p-2.5 rounded-lg border border-amber-200 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 mr-2 text-[11px]">
                              #{ord.orderNumber}
                            </span>
                            <span className="font-bold text-slate-900">{ord.items.map((i) => i.jobName).join(', ')}</span>
                            <span className="text-[10.5px] text-slate-500 ml-2">
                              ({ord.items.map((i) => `${i.materialName} ${i.lengthMeters}x${i.widthMeters}m`).join('; ')})
                            </span>
                          </div>
                          <div className="font-mono font-black text-slate-900 text-xs shrink-0">
                            {formatRupiah(ord.remainingAmount ?? ord.totalAmount)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {group.adjustment !== 0 && (
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-amber-300 text-xs font-bold text-amber-950">
                        <span>Penyesuaian ({group.adjustmentReason || 'Sisa Tagihan'}):</span>
                        <span className="font-mono font-black">
                          {group.adjustment > 0 ? '+' : ''}{formatRupiah(group.adjustment)}
                        </span>
                      </div>
                    )}

                    {group.notes && (
                      <div className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-amber-200">
                        <strong>Notes:</strong> {group.notes}
                      </div>
                    )}
                  </div>

                  {/* Footer with Total and Button */}
                  <div className="bg-slate-50 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3.5 sm:p-4 rounded-b-2xl border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-xl border border-amber-500 shadow-2xs">
                        <span className="text-[10px] text-slate-900 block uppercase font-sans font-bold">Total Tagihan Konsolidasi</span>
                        <span className="font-black text-base font-mono">{formatRupiah(group.totalAmount)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectOpenAccountGroup) {
                          onSelectOpenAccountGroup(group);
                        }
                        onClose();
                      }}
                      className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 text-xs font-black rounded-xl border border-amber-500 shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 self-stretch sm:self-auto"
                    >
                      <ShoppingCart className="w-4 h-4 text-slate-950" />
                      <span>🛒 Tarik Tagihan Konsolidasi ke Kasir POS</span>
                    </button>
                  </div>
                </div>
              ))
            )
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-bold text-xs">
              <Layers className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-40" />
              Tidak ada SPK cetak aktif yang cocok dengan pencarian.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const badge = getStatusBadge(order.status);
              const item = order.items[0];
              const isUrgent = order.priority === 'URGENT';
              const isAlreadyInCart = existingSpkIds.includes(order.id);
              const isSelected = selectedOrderIds.includes(order.id);
              const isOpenAccount = order.status === 'OPEN_ACCOUNT' || order.isOpenAccount;
              const isBlockedByOpenAccount =
                (hasOpenAccountInCart && !isOpenAccount) ||
                (!hasOpenAccountInCart && isOpenAccount && existingSpkIds.length > 0);

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border-2 transition-all hover:shadow-lg ${
                    isAlreadyInCart
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-400/40 bg-indigo-50/20'
                      : order.status === 'SIAP_AMBIL'
                      ? 'border-emerald-500 ring-2 ring-emerald-400/40 shadow-sm'
                      : isUrgent
                      ? 'border-red-500 ring-2 ring-red-400/40 shadow-sm'
                      : 'border-slate-300'
                  }`}
                >
                  {/* Top Bar: Multi-Select Checkbox, Status Badge, Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {!isAlreadyInCart && !isBlockedByOpenAccount && (
                        <label className="flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-300 transition-colors">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrderIds((prev) => [...prev, order.id]);
                              } else {
                                setSelectedOrderIds((prev) => prev.filter((id) => id !== order.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-slate-700">Pilih</span>
                        </label>
                      )}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black border ${badge.bg}`}>
                        <span className={`w-2 h-2 rounded-full ${badge.dot}`}></span>
                        {badge.label}
                      </span>
                      {isAlreadyInCart && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10.5px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Sudah di Keranjang
                        </span>
                      )}
                      {isUrgent && (
                        <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                          <Flame className="w-3 h-3" /> URGENT
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 font-mono font-medium">
                      No. SPK: <strong className="text-indigo-900 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">{order.orderNumber}</strong> • Tgl: <strong className="text-slate-900 font-bold">{order.date}</strong>
                    </div>
                  </div>

                  {/* Body Grid: Customer & Job Specifications */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 py-3.5 text-xs">
                    {/* Customer Info Box */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10.5px] text-slate-500 uppercase font-black tracking-wider">Pelanggan:</div>
                      <div className="font-black text-slate-950 text-sm">{order.customerName}</div>
                      <div className="text-xs text-slate-700 font-mono font-bold">{order.customerPhone || 'Tanpa No WA'}</div>
                      <span className="inline-block text-[10px] font-bold bg-white text-slate-800 px-2 py-0.5 rounded border border-slate-300 mt-1">
                        Kategori: {order.customerCategory || 'Umum'}
                      </span>
                    </div>

                    {/* Job Details Box */}
                    <div className="md:col-span-2 space-y-2">
                      <div className="text-[10.5px] text-slate-500 uppercase font-black tracking-wider">Rincian Pekerjaan:</div>
                      {order.items.map((it, idx) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                          <div className="flex justify-between items-start">
                            <span className="font-black text-slate-950 text-sm">{it.jobName}</span>
                            <span className="font-mono font-black text-indigo-950 text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {it.lengthMeters}x{it.widthMeters}m ({it.qty} pcs = {it.areaM2} m²)
                            </span>
                          </div>
                          <div className="text-xs text-slate-800 font-medium">
                            Bahan: <strong className="text-slate-950 font-bold">{it.materialName}</strong>
                          </div>
                          {it.finishings.length > 0 && (
                            <div className="text-xs text-indigo-950 font-semibold bg-white p-1.5 rounded-lg border border-indigo-200 flex flex-wrap gap-1 items-center">
                              <span className="font-bold text-indigo-900">Finishing:</span>
                              {it.finishings.map((f, fIdx) => (
                                <span key={fIdx} className="bg-indigo-50 text-indigo-950 px-1.5 py-0.2 rounded border border-indigo-200 font-bold text-[11px]">
                                  {f.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer: Price breakdown & 1-Click Action Button */}
                  <div className="bg-slate-100 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3.5 sm:p-4 rounded-b-2xl border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                      <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300">
                        <span className="text-[10px] text-slate-500 block uppercase font-sans font-bold">Total Nilai</span>
                        <span className="font-black text-slate-900 text-sm">{formatRupiah(order.totalAmount)}</span>
                      </div>

                      {order.dpPaid > 0 && (
                        <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-300">
                          <span className="text-[10px] text-amber-800 block uppercase font-sans font-bold">DP Masuk</span>
                          <span className="font-black text-amber-900 text-sm">-{formatRupiah(order.dpPaid)}</span>
                        </div>
                      )}

                      <div className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl shadow-xs">
                        <span className="text-[10px] text-emerald-100 block uppercase font-sans font-black">Tagihan Pelunasan</span>
                        <span className="font-black text-base">{formatRupiah(order.remainingAmount)}</span>
                      </div>
                    </div>

                    {isAlreadyInCart ? (
                      <div className="px-4 py-2 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-emerald-300 self-stretch sm:self-auto justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Sudah di Keranjang</span>
                      </div>
                    ) : isBlockedByOpenAccount ? (
                      <div className="px-4 py-2 bg-amber-100 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-amber-300 self-stretch sm:self-auto justify-center">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Tidak Dapat Digabung (Open Account)</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSpk(order);
                          onClose();
                        }}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 self-stretch sm:self-auto"
                      >
                        <span>🛒 Tarik ke Keranjang POS</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Multi-Select Action Bar if user checked multiple SPKs */}
        {selectedOrderIds.length > 0 && (
          <div className="p-3.5 bg-emerald-50 border-t-2 border-emerald-300 flex items-center justify-between gap-3 shrink-0 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-black flex items-center justify-center shadow-xs">
                {selectedOrderIds.length}
              </span>
              <span className="text-xs font-bold text-emerald-950">
                {selectedOrderIds.length} SPK Dipilih untuk Ditarik ke POS Bersama
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
                  if (onSelectBatchSpk) {
                    onSelectBatchSpk(selectedOrders);
                  } else {
                    selectedOrders.forEach((o) => onSelectSpk(o));
                  }
                  onClose();
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
              >
                <span>🛒 Tarik {selectedOrderIds.length} SPK ke Keranjang POS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-600 font-medium">
            Menampilkan <strong className="text-slate-900 font-bold">{filteredOrders.length}</strong> pesanan cetak aktif.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
