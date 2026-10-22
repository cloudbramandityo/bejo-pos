/**
 * Coded by Langgo Bramandityo.
 * Submenu 6: Daftar Utang Akhir Tahun (Lampiran 1 - Bagian B Formulir 1770)
 */
import React, { useState } from 'react';
import { TaxAnnualReturn1770, TaxDebtItem, TAX_CONFIG_2025 } from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import { Landmark, Plus, Trash2, Edit2, Check, X, ShieldAlert } from 'lucide-react';

interface TaxDebtsViewProps {
  currentReturn: TaxAnnualReturn1770;
  onUpdateReturn: (updated: TaxAnnualReturn1770) => void;
}

export const TaxDebtsView: React.FC<TaxDebtsViewProps> = ({
  currentReturn,
  onUpdateReturn,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Partial<TaxDebtItem>>({
    code: '101',
    lenderName: '',
    lenderAddress: '',
    loanYear: currentReturn.taxYear,
    initialAmount: 0,
    endingBalance: 0,
    description: '',
  });

  const totalEndingBalance = currentReturn.debts.reduce((sum, d) => sum + (d.endingBalance || 0), 0);

  const handleStartAdd = () => {
    setForm({
      code: '101',
      lenderName: '',
      lenderAddress: '',
      loanYear: currentReturn.taxYear,
      initialAmount: 0,
      endingBalance: 0,
      description: '',
    });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: TaxDebtItem) => {
    setForm({ ...item });
    setEditingId(item.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!form.lenderName || !form.code) return;

    let updatedDebts: TaxDebtItem[];
    if (isAdding) {
      const newItem: TaxDebtItem = {
        id: `debt-${Date.now()}`,
        code: form.code || '101',
        lenderName: form.lenderName || '',
        lenderAddress: form.lenderAddress || '',
        loanYear: Number(form.loanYear) || currentReturn.taxYear,
        initialAmount: Number(form.initialAmount) || 0,
        endingBalance: Number(form.endingBalance) || 0,
        description: form.description || '',
      };
      updatedDebts = [...currentReturn.debts, newItem];
    } else {
      updatedDebts = currentReturn.debts.map(d =>
        d.id === editingId
          ? {
              ...d,
              code: form.code || d.code,
              lenderName: form.lenderName || d.lenderName,
              lenderAddress: form.lenderAddress || d.lenderAddress,
              loanYear: Number(form.loanYear) || d.loanYear,
              initialAmount: Number(form.initialAmount) || d.initialAmount,
              endingBalance: Number(form.endingBalance) || d.endingBalance,
              description: form.description || d.description,
            }
          : d
      );
    }

    onUpdateReturn({
      ...currentReturn,
      debts: updatedDebts,
      hasDebts: updatedDebts.length > 0,
    });

    setIsAdding(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const updatedDebts = currentReturn.debts.filter(d => d.id !== id);
    onUpdateReturn({
      ...currentReturn,
      debts: updatedDebts,
      hasDebts: updatedDebts.length > 0,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Daftar Kewajiban / Utang Pada Akhir Tahun Pajak {currentReturn.taxYear}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lampiran 1 Bagian B Formulir 1770 — Sisa pokok utang bank, leasing kendaraan, KPR, atau kartu kredit per 31 Desember.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Sisa Utang Akhir Tahun</span>
            <span className="text-base font-bold text-amber-700">{formatRupiah(totalEndingBalance)}</span>
          </div>
          <button
            type="button"
            onClick={handleStartAdd}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Utang</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Form Card */}
      {(isAdding || editingId) && (
        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-900">
              {isAdding ? 'Tambah Catatan Utang Baru' : 'Edit Catatan Utang'}
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
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Kategori Utang (Kode DJP) <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {TAX_CONFIG_2025.djpDebtCategories.map(cat => (
                  <option key={cat.code} value={cat.code}>
                    {cat.code} — {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Pemberi Pinjaman <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.lenderName}
                onChange={e => setForm({ ...form, lenderName: e.target.value })}
                placeholder="Contoh: Bank BCA, Bank Mandiri, Leasing BCA Finance"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Alamat Pemberi Pinjaman</label>
              <input
                type="text"
                value={form.lenderAddress}
                onChange={e => setForm({ ...form, lenderAddress: e.target.value })}
                placeholder="Alamat kantor cabang atau kota bank"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tahun Pinjaman</label>
              <input
                type="number"
                value={form.loanYear}
                onChange={e => setForm({ ...form, loanYear: Number(e.target.value) })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Saldo Sisa Utang Akhir Tahun (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={form.endingBalance}
                onChange={e => setForm({ ...form, endingBalance: Number(e.target.value) })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold text-amber-900"
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
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Utang</span>
            </button>
          </div>
        </div>
      )}

      {/* Table of Debts */}
      {currentReturn.debts.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
          <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Tidak Ada Catatan Utang / Kewajiban</p>
          <p className="text-xs text-slate-400 mt-1">Jika Anda memiliki pinjaman bank atau kartu kredit aktif di akhir tahun, klik tombol di atas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 w-16">Kode</th>
                <th className="px-3 py-2.5">Pemberi Pinjaman</th>
                <th className="px-3 py-2.5">Alamat</th>
                <th className="px-3 py-2.5 w-20">Tahun</th>
                <th className="px-3 py-2.5 text-right">Saldo Sisa Utang</th>
                <th className="px-3 py-2.5 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentReturn.debts.map(item => {
                const cat = TAX_CONFIG_2025.djpDebtCategories.find(c => c.code === item.code);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2.5 font-mono font-bold text-amber-700">
                      {item.code}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{item.lenderName}</div>
                      <div className="text-[10px] text-slate-400">{cat?.name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {item.lenderAddress || '-'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-700">
                      {item.loanYear}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-700">
                      {formatRupiah(item.endingBalance)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="p-1 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
              <tr>
                <td colSpan={4} className="px-3 py-2.5 text-slate-700">TOTAL UTANG (LAMPIRAN 1 BAGIAN B):</td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-900 text-sm">{formatRupiah(totalEndingBalance)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
