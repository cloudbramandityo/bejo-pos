/**
 * Coded by Langgo Bramandityo.
 * Submenu 8: Bukti Potong dan Kredit Pajak (Pasal 21, 22, 23, 24)
 */
import React, { useState } from 'react';
import { TaxAnnualReturn1770, TaxWithholdingItem } from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import { ShieldCheck, Plus, Trash2, Edit2, Check, X, ShieldAlert } from 'lucide-react';

interface TaxWithholdingViewProps {
  currentReturn: TaxAnnualReturn1770;
  onUpdateReturn: (updated: TaxAnnualReturn1770) => void;
}

export const TaxWithholdingView: React.FC<TaxWithholdingViewProps> = ({
  currentReturn,
  onUpdateReturn,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Partial<TaxWithholdingItem>>({
    taxType: 'PASAL_21',
    withholderNpwp: '',
    withholderName: '',
    withholdingSlipNumber: '',
    withholdingDate: `${currentReturn.taxYear}-12-31`,
    incomeCategory: 'Imbalan Jasa / Upah Kerja',
    grossIncome: 0,
    withheldTaxAmount: 0,
  });

  const totalWithheld = currentReturn.withholdings.reduce((sum, w) => sum + (w.withheldTaxAmount || 0), 0);

  const handleStartAdd = () => {
    setForm({
      taxType: 'PASAL_21',
      withholderNpwp: '',
      withholderName: '',
      withholdingSlipNumber: '',
      withholdingDate: `${currentReturn.taxYear}-12-31`,
      incomeCategory: 'Imbalan Jasa / Upah Kerja',
      grossIncome: 0,
      withheldTaxAmount: 0,
    });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: TaxWithholdingItem) => {
    setForm({ ...item });
    setEditingId(item.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!form.withholderName || !form.withholdingSlipNumber) return;

    let updatedWithholdings: TaxWithholdingItem[];
    if (isAdding) {
      const newItem: TaxWithholdingItem = {
        id: `bupot-${Date.now()}`,
        taxType: form.taxType || 'PASAL_21',
        withholderNpwp: form.withholderNpwp || '',
        withholderName: form.withholderName || '',
        withholdingSlipNumber: form.withholdingSlipNumber || '',
        withholdingDate: form.withholdingDate || `${currentReturn.taxYear}-12-31`,
        incomeCategory: form.incomeCategory || '',
        grossIncome: Number(form.grossIncome) || 0,
        withheldTaxAmount: Number(form.withheldTaxAmount) || 0,
      };
      updatedWithholdings = [...currentReturn.withholdings, newItem];
    } else {
      updatedWithholdings = currentReturn.withholdings.map(w =>
        w.id === editingId
          ? {
              ...w,
              taxType: form.taxType || w.taxType,
              withholderNpwp: form.withholderNpwp || w.withholderNpwp,
              withholderName: form.withholderName || w.withholderName,
              withholdingSlipNumber: form.withholdingSlipNumber || w.withholdingSlipNumber,
              withholdingDate: form.withholdingDate || w.withholdingDate,
              incomeCategory: form.incomeCategory || w.incomeCategory,
              grossIncome: Number(form.grossIncome) || w.grossIncome,
              withheldTaxAmount: Number(form.withheldTaxAmount) || w.withheldTaxAmount,
            }
          : w
      );
    }

    onUpdateReturn({
      ...currentReturn,
      withholdings: updatedWithholdings,
      hasWithholdingSlips: updatedWithholdings.length > 0,
    });

    setIsAdding(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const updated = currentReturn.withholdings.filter(w => w.id !== id);
    onUpdateReturn({
      ...currentReturn,
      withholdings: updated,
      hasWithholdingSlips: updated.length > 0,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Daftar Bukti Pemotongan / Pemungutan PPh Pihak Lain
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lampiran 1 Bagian D & E Formulir 1770 — Bukti Potong PPh Pasal 21, 22, 23, dan 24 yang dipotong oleh pihak lain dan menjadi kredit pengurang pajak terutang.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Kredit Pajak Pemotongan</span>
            <span className="text-base font-bold text-emerald-700">{formatRupiah(totalWithheld)}</span>
          </div>
          <button
            type="button"
            onClick={handleStartAdd}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bukti Potong</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Form */}
      {(isAdding || editingId) && (
        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-900">
              {isAdding ? 'Tambah Bukti Potong Baru' : 'Edit Bukti Potong'}
            </h4>
            <button
              type="button"
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jenis Pajak</label>
              <select
                value={form.taxType}
                onChange={e => setForm({ ...form, taxType: e.target.value as any })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-bold text-blue-900"
              >
                <option value="PASAL_21">PPh Pasal 21 (Upah/Gaji)</option>
                <option value="PASAL_22">PPh Pasal 22 (Impor/Bendahara)</option>
                <option value="PASAL_23">PPh Pasal 23 (Jasa/Sewa)</option>
                <option value="PASAL_24">PPh Pasal 24 (Luar Negeri)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                NPWP Pemotong / Pemungut <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.withholderNpwp}
                onChange={e => setForm({ ...form, withholderNpwp: e.target.value })}
                placeholder="00.000.000.0-000.000"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Pemotong / Instansi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.withholderName}
                onChange={e => setForm({ ...form, withholderName: e.target.value })}
                placeholder="PT Contoh / Dinas Koperasi / dsb"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor Bukti Potong <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.withholdingSlipNumber}
                onChange={e => setForm({ ...form, withholdingSlipNumber: e.target.value })}
                placeholder="1.1-2.1-..."
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tanggal Bukti Potong</label>
              <input
                type="date"
                value={form.withholdingDate}
                onChange={e => setForm({ ...form, withholdingDate: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jumlah Penghasilan Bruto (Rp)</label>
              <input
                type="number"
                value={form.grossIncome}
                onChange={e => setForm({ ...form, grossIncome: Number(e.target.value) })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Jumlah PPh Dipotong / Dipungut (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={form.withheldTaxAmount}
                onChange={e => setForm({ ...form, withheldTaxAmount: Number(e.target.value) })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-mono font-bold text-emerald-700"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 font-medium text-xs hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Bukti Potong</span>
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {currentReturn.withholdings.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
          <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Belum Ada Bukti Pemotongan Terdaftar</p>
          <p className="text-xs text-slate-400 mt-1">Jika ada klien korporat/instansi yang memotong PPh 21 atau 23 atas jasa stiker Anda, masukkan buktinya di sini untuk mengurangi pajak.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 w-16">Pasal</th>
                <th className="px-3 py-2.5">Nama Pemotong & NPWP</th>
                <th className="px-3 py-2.5">No. Bukti Potong</th>
                <th className="px-3 py-2.5">Tanggal</th>
                <th className="px-3 py-2.5 text-right">Penghasilan Bruto</th>
                <th className="px-3 py-2.5 text-right">PPh Dipotong</th>
                <th className="px-3 py-2.5 w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentReturn.withholdings.map(w => (
                <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-[10px]">
                      {w.taxType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-slate-900">{w.withholderName}</div>
                    <div className="font-mono text-[10px] text-slate-400">{w.withholderNpwp || '-'}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-700">
                    {w.withholdingSlipNumber}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 font-mono">
                    {w.withholdingDate}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {formatRupiah(w.grossIncome)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                    {formatRupiah(w.withheldTaxAmount)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(w)}
                        className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(w.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-slate-700">TOTAL KREDIT PEMOTONGAN PPH:</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-800 text-sm">{formatRupiah(totalWithheld)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
