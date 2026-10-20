/**
 * Coded by Langgo Bramandityo.
 * Submenu 5: Daftar Harta Akhir Tahun (Lampiran 1 - Bagian A Formulir 1770)
 */
import React, { useState } from 'react';
import { TaxAnnualReturn1770, TaxAssetItem, TAX_CONFIG_2025 } from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import { Wallet, Plus, Trash2, Edit2, Check, X, ShieldAlert } from 'lucide-react';

interface TaxAssetsViewProps {
  currentReturn: TaxAnnualReturn1770;
  onUpdateReturn: (updated: TaxAnnualReturn1770) => void;
}

export const TaxAssetsView: React.FC<TaxAssetsViewProps> = ({
  currentReturn,
  onUpdateReturn,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Partial<TaxAssetItem>>({
    code: '012',
    name: '',
    acquisitionYear: new Date().getFullYear(),
    acquisitionPrice: 0,
    description: '',
  });

  const totalAcquisitionPrice = currentReturn.assets.reduce((sum, a) => sum + (a.acquisitionPrice || 0), 0);

  const handleStartAdd = () => {
    setForm({
      code: '012',
      name: '',
      acquisitionYear: currentReturn.taxYear,
      acquisitionPrice: 0,
      description: '',
    });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: TaxAssetItem) => {
    setForm({ ...item });
    setEditingId(item.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!form.name || !form.code) return;

    let updatedAssets: TaxAssetItem[];
    if (isAdding) {
      const newItem: TaxAssetItem = {
        id: `asset-${Date.now()}`,
        code: form.code || '099',
        name: form.name || '',
        acquisitionYear: Number(form.acquisitionYear) || currentReturn.taxYear,
        acquisitionPrice: Number(form.acquisitionPrice) || 0,
        description: form.description || '',
      };
      updatedAssets = [...currentReturn.assets, newItem];
    } else {
      updatedAssets = currentReturn.assets.map(a =>
        a.id === editingId
          ? {
              ...a,
              code: form.code || a.code,
              name: form.name || a.name,
              acquisitionYear: Number(form.acquisitionYear) || a.acquisitionYear,
              acquisitionPrice: Number(form.acquisitionPrice) || a.acquisitionPrice,
              description: form.description || a.description,
            }
          : a
      );
    }

    onUpdateReturn({
      ...currentReturn,
      assets: updatedAssets,
      hasAssets: updatedAssets.length > 0,
    });

    setIsAdding(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const updatedAssets = currentReturn.assets.filter(a => a.id !== id);
    onUpdateReturn({
      ...currentReturn,
      assets: updatedAssets,
      hasAssets: updatedAssets.length > 0,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Daftar Harta Pada Akhir Tahun Pajak {currentReturn.taxYear}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lampiran 1 Bagian A Formulir 1770 — Seluruh harta kas, tabungan, properti, kendaraan, dan investasi yang dimiliki per 31 Desember.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Nilai Perolehan</span>
            <span className="text-base font-bold text-slate-900">{formatRupiah(totalAcquisitionPrice)}</span>
          </div>
          <button
            type="button"
            onClick={handleStartAdd}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Harta</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Form Card */}
      {(isAdding || editingId) && (
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-blue-900">
              {isAdding ? 'Tambah Harta Baru' : 'Edit Harta Terdaftar'}
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
                Kategori Harta (Kode DJP) <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TAX_CONFIG_2025.djpAssetCategories.map(cat => (
                  <option key={cat.code} value={cat.code}>
                    {cat.code} — {cat.name} ({cat.group})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Harta / Merk / Tipe <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Misal: Tabungan BCA, Mobil GranMax, Mesin Roland"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tahun Perolehan</label>
              <input
                type="number"
                value={form.acquisitionYear}
                onChange={e => setForm({ ...form, acquisitionYear: Number(e.target.value) })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Harga Perolehan (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={form.acquisitionPrice}
                onChange={e => setForm({ ...form, acquisitionPrice: Number(e.target.value) })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Keterangan / Nomor Identitas Harta</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="No. Rekening / No. Polisi / Alamat Lokasi / NOP"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Harta</span>
            </button>
          </div>
        </div>
      )}

      {/* Table of Assets */}
      {currentReturn.assets.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
          <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Belum Ada Harta Terdaftar</p>
          <p className="text-xs text-slate-400 mt-1">Klik tombol &ldquo;Tambah Harta&rdquo; di atas untuk mencatatkan kas, kendaraan, atau properti.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 w-16">Kode</th>
                <th className="px-3 py-2.5">Nama Harta</th>
                <th className="px-3 py-2.5 w-20">Tahun</th>
                <th className="px-3 py-2.5 text-right">Harga Perolehan</th>
                <th className="px-3 py-2.5">Keterangan</th>
                <th className="px-3 py-2.5 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentReturn.assets.map(item => {
                const cat = TAX_CONFIG_2025.djpAssetCategories.find(c => c.code === item.code);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2.5 font-mono font-bold text-blue-700">
                      {item.code}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-400">{cat?.name} ({cat?.group})</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-700">
                      {item.acquisitionYear}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(item.acquisitionPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate">
                      {item.description || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50"
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
                <td colSpan={3} className="px-3 py-2.5 text-slate-700">TOTAL HARTA (LAMPIRAN 1 BAGIAN A):</td>
                <td className="px-3 py-2.5 text-right font-mono text-blue-900 text-sm">{formatRupiah(totalAcquisitionPrice)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
