/**
 * Coded by Langgo Bramandityo.
 * Kartu Konsolidasi Tagihan Open Account (Rekening Terbuka) per ID Pelanggan
 * Dilengkapi fitur penambahan / pengurangan tagihan (Sisa Tagihan), Catatan, Tarik ke POS & Terbitkan Invoice
 */

import React, { useState } from 'react';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  FileText,
  Eye,
  RotateCcw,
  Plus,
  Minus,
  Save,
  Check,
  User,
  Phone,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { SpkOrder } from '../../types';
import {
  OpenAccountCustomerGroup,
  OpenAccountCustomerConfig,
  updateOpenAccountConfigForCustomer
} from '../../utils/openAccountStorage';
import { formatRupiah, formatNumber } from '../../utils/formatters';

interface OpenAccountGroupCardProps {
  group: OpenAccountCustomerGroup;
  onOpenDetail: (order: SpkOrder) => void;
  onReturnToReady: (orderId: string) => void;
  onSendToPos: (group: OpenAccountCustomerGroup) => void;
  onCreateInvoice: (group: OpenAccountCustomerGroup) => void;
}

export const OpenAccountGroupCard: React.FC<OpenAccountGroupCardProps> = ({
  group,
  onOpenDetail,
  onReturnToReady,
  onSendToPos,
  onCreateInvoice
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingAdjustment, setIsEditingAdjustment] = useState(false);

  // Form states for Sisa Tagihan adjustment & notes
  const [adjustmentInput, setAdjustmentInput] = useState<string>(group.adjustment ? String(group.adjustment) : '0');
  const [adjustmentReason, setAdjustmentReason] = useState<string>(group.adjustmentReason || '');
  const [notesInput, setNotesInput] = useState<string>(group.notes || '');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const numAdjustment = parseInt(adjustmentInput.replace(/[^0-9\-]/g, ''), 10) || 0;
  const currentTotal = Math.max(0, group.subtotal + numAdjustment);

  const handleSaveAdjustment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateOpenAccountConfigForCustomer(group.customerId, {
      adjustment: numAdjustment,
      adjustmentReason: adjustmentReason.trim(),
      notes: notesInput.trim()
    });

    group.adjustment = numAdjustment;
    group.adjustmentReason = adjustmentReason.trim();
    group.notes = notesInput.trim();
    group.totalAmount = currentTotal;

    setIsSavedNotice(true);
    setTimeout(() => {
      setIsSavedNotice(false);
      setIsEditingAdjustment(false);
    }, 1200);
  };

  return (
    <div className="bg-amber-50/90 rounded-2xl border-2 border-amber-400 p-3.5 shadow-xs space-y-3 transition-all hover:shadow-md">
      {/* Header Kartu Konsolidasi Pelanggan */}
      <div className="flex items-start justify-between gap-2 border-b border-amber-200/80 pb-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] font-black bg-amber-200 text-slate-950 px-2 py-0.5 rounded border border-amber-400 uppercase">
              {group.customerId.startsWith('cust_') ? 'ID: ' + group.customerId.slice(-6) : group.customerId}
            </span>
            <span className="text-[10px] bg-slate-900 text-white font-bold px-2 py-0.5 rounded-full">
              {group.orders.length} SPK Cetak
            </span>
          </div>

          <h4 className="font-black text-sm text-slate-950 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="truncate">{group.customerName}</span>
          </h4>

          {group.customerPhone && (
            <div className="text-[11px] text-slate-600 flex items-center gap-1 font-mono font-medium">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{group.customerPhone}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-lg bg-amber-200/60 hover:bg-amber-300 text-slate-900 cursor-pointer transition-colors"
          title={isExpanded ? 'Ciutkan Daftar SPK' : 'Buka Daftar SPK'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Rincian SPK Terkonsolidasi (Accordion) */}
      {isExpanded && (
        <div className="space-y-2">
          <div className="text-[10.5px] font-bold text-amber-950 flex items-center justify-between">
            <span>Daftar Pesanan ({group.orders.length}):</span>
            <span className="text-slate-500 font-normal">Subtotal: {formatRupiah(group.subtotal)}</span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 divide-y divide-amber-200/50">
            {group.orders.map((order) => {
              const primaryItem = order.items[0];
              const remaining = order.remainingAmount > 0 ? order.remainingAmount : order.totalAmount;

              return (
                <div
                  key={order.id}
                  className="bg-white/90 hover:bg-white rounded-xl p-2.5 border border-amber-300/80 text-xs space-y-1 transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                      {order.orderNumber}
                    </span>
                    <span className="font-mono font-black text-slate-900">
                      {formatRupiah(remaining)}
                    </span>
                  </div>

                  <div className="text-[11.5px] font-bold text-slate-800 line-clamp-1">
                    {order.items.length > 1
                      ? `${order.items.length} Item: ${primaryItem?.jobName || 'Cetak'}`
                      : primaryItem?.jobName || primaryItem?.materialName || 'Cetak Banner'}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {order.date}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(order)}
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded cursor-pointer transition-colors"
                        title="Lihat Detail SPK"
                      >
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => onReturnToReady(order.id)}
                        className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded cursor-pointer transition-colors inline-flex items-center gap-0.5"
                        title="Kembalikan SPK ini ke status 4. Siap Ambil / Bayar"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Batal OA</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bagian Penyesuaian Sisa Tagihan & Notes */}
      <div className="bg-amber-100/70 rounded-xl p-2.5 border border-amber-300 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-slate-900">
            Penyesuaian & Sisa Tagihan
          </span>
          <button
            type="button"
            onClick={() => setIsEditingAdjustment(!isEditingAdjustment)}
            className="text-[10px] font-bold text-amber-900 hover:underline cursor-pointer"
          >
            {isEditingAdjustment ? 'Selesai Edit' : 'Edit Sisa Tagihan / Notes'}
          </button>
        </div>

        {isEditingAdjustment ? (
          <form onSubmit={handleSaveAdjustment} className="space-y-2 pt-1 border-t border-amber-300/80">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                Nilai Penyesuaian Sisa Tagihan (Rp):
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={adjustmentInput}
                  onChange={(e) => setAdjustmentInput(e.target.value)}
                  placeholder="Contoh: 50000 atau -25000"
                  className="w-full px-2 py-1 bg-white border border-amber-400 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <p className="text-[9.5px] text-slate-500 mt-0.5">
                Masukkan nilai positif (+) untuk menambah atau tanda minus (-) untuk potongan diskon.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                Keterangan Sisa Tagihan:
              </label>
              <input
                type="text"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Contoh: Potongan kesepakatan plafon / ongkir"
                className="w-full px-2 py-1 bg-white border border-amber-400 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                Notes Tagihan:
              </label>
              <input
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Contoh: Plafon Rp 5 Jt, Jatuh Tempo 30 Hari"
                className="w-full px-2 py-1 bg-white border border-amber-400 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-bold text-slate-600">
                Total Jadi: <strong className="text-slate-950 font-mono">{formatRupiah(currentTotal)}</strong>
              </span>
              <button
                type="submit"
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                {isSavedNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSavedNotice ? 'Tersimpan!' : 'Simpan'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-1 text-xs">
            {group.adjustment !== 0 && (
              <div className="flex items-center justify-between text-[11px] text-amber-950 font-medium bg-amber-200/50 px-2 py-1 rounded">
                <span>Penyesuaian ({group.adjustmentReason || 'Sisa Tagihan'}):</span>
                <span className="font-mono font-bold">
                  {group.adjustment > 0 ? '+' : ''}
                  {formatRupiah(group.adjustment)}
                </span>
              </div>
            )}
            {group.notes && (
              <div className="text-[10.5px] text-slate-700 bg-white/70 px-2 py-1 rounded border border-amber-200 line-clamp-2">
                <strong>Notes:</strong> {group.notes}
              </div>
            )}
          </div>
        )}

        {/* Ringkasan Total Tagihan Gabungan */}
        <div className="pt-2 border-t border-amber-300 flex items-center justify-between">
          <span className="text-[11px] font-black uppercase text-slate-800">
            Total Tagihan Gabungan:
          </span>
          <span className="font-mono font-black text-sm text-slate-950 bg-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-400 shadow-2xs">
            {formatRupiah(group.totalAmount)}
          </span>
        </div>
      </div>

      {/* Tombol Aksi Utama: Tarik ke POS & Terbitkan Invoice */}
      <div className="space-y-1.5 pt-1">
        <button
          type="button"
          onClick={() => onSendToPos(group)}
          className="w-full py-2 px-3 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black text-xs rounded-xl border border-amber-500 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
          title="Tarik seluruh pesanan Open Account pelanggan ini ke POS menjadi 1 transaksi utuh"
        >
          <ShoppingCart className="w-4 h-4 text-slate-950" />
          <span>Tarik ke POS (Tagihan Gabungan)</span>
        </button>

        <button
          type="button"
          onClick={() => onCreateInvoice(group)}
          className="w-full py-1.5 px-3 bg-white hover:bg-indigo-50 active:bg-indigo-100 text-indigo-900 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          title="Terbitkan Invoice resmi untuk pelanggan ini"
        >
          <FileText className="w-3.5 h-3.5 text-indigo-700" />
          <span>Terbitkan Invoice Pelanggan</span>
        </button>
      </div>
    </div>
  );
};
