/**
 * Coded by Langgo Bramandityo.
 * Submenu 7: Daftar Anggota Keluarga yang Menjadi Tanggungan (Lampiran 1 - Bagian C Formulir 1770)
 */
import React, { useState } from 'react';
import { TaxAnnualReturn1770, TaxDependentItem } from '../../types/tax';
import { Users, Plus, Trash2, Edit2, Check, X, ShieldAlert, HeartHandshake } from 'lucide-react';

interface TaxDependentsViewProps {
  currentReturn: TaxAnnualReturn1770;
  onUpdateReturn: (updated: TaxAnnualReturn1770) => void;
}

export const TaxDependentsView: React.FC<TaxDependentsViewProps> = ({
  currentReturn,
  onUpdateReturn,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Partial<TaxDependentItem>>({
    fullName: '',
    nik: '',
    familyRelationship: 'ANAK_KANDUNG',
    jobOrStatus: 'Pelajar',
  });

  const handleStartAdd = () => {
    setForm({
      fullName: '',
      nik: '',
      familyRelationship: 'ANAK_KANDUNG',
      jobOrStatus: 'Pelajar',
    });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: TaxDependentItem) => {
    setForm({ ...item });
    setEditingId(item.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!form.fullName || !form.nik) return;

    let updatedDeps: TaxDependentItem[];
    if (isAdding) {
      const newItem: TaxDependentItem = {
        id: `dep-${Date.now()}`,
        fullName: form.fullName || '',
        nik: form.nik || '',
        familyRelationship: form.familyRelationship || 'ANAK_KANDUNG',
        jobOrStatus: form.jobOrStatus || 'Belum Bekerja',
      };
      updatedDeps = [...currentReturn.dependents, newItem];
    } else {
      updatedDeps = currentReturn.dependents.map(d =>
        d.id === editingId
          ? {
              ...d,
              fullName: form.fullName || d.fullName,
              nik: form.nik || d.nik,
              familyRelationship: form.familyRelationship || d.familyRelationship,
              jobOrStatus: form.jobOrStatus || d.jobOrStatus,
            }
          : d
      );
    }

    onUpdateReturn({
      ...currentReturn,
      dependents: updatedDeps,
      hasDependents: updatedDeps.length > 0,
    });

    setIsAdding(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const updatedDeps = currentReturn.dependents.filter(d => d.id !== id);
    onUpdateReturn({
      ...currentReturn,
      dependents: updatedDeps,
      hasDependents: updatedDeps.length > 0,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Daftar Anggota Keluarga yang Menjadi Tanggungan Sepenuhnya
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lampiran 1 Bagian C Formulir 1770 — Istri/suami, anak kandung/angkat, dan orang tua/mertua sedarah semenda yang tidak berpenghasilan (maksimal 3 tanggungan untuk PTKP).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Status PTKP Saat Ini</span>
            <span className="text-base font-bold text-emerald-700">{currentReturn.taxpayer.ptkpStatus}</span>
          </div>
          <button
            type="button"
            onClick={handleStartAdd}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Tanggungan</span>
          </button>
        </div>
      </div>

      {/* Info Notice PTKP */}
      <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
        <HeartHandshake className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Ketentuan Tanggungan PTKP Menurut UU PPh:</span>
          <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
            Tanggungan yang dapat diperhitungkan dalam PTKP adalah anggota keluarga sedarah dan semenda dalam garis keturunan lurus (orang tua, mertua, anak kandung, anak angkat) yang menjadi tanggungan sepenuhnya, maksimal 3 (tiga) orang.
          </p>
        </div>
      </div>

      {/* Add / Edit Form Card */}
      {(isAdding || editingId) && (
        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-900">
              {isAdding ? 'Tambah Data Tanggungan Baru' : 'Edit Data Tanggungan'}
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
                Nama Lengkap Tanggungan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })}
                placeholder="Nama lengkap sesuai KK / KTP"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor Induk Kependudukan (NIK) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.nik}
                onChange={e => setForm({ ...form, nik: e.target.value })}
                placeholder="16 digit NIK tanggungan"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Hubungan Keluarga <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.familyRelationship}
                onChange={e => setForm({ ...form, familyRelationship: e.target.value as any })}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ISTRI">Istri</option>
                <option value="ANAK_KANDUNG">Anak Kandung</option>
                <option value="ANAK_ANGKAT">Anak Angkat</option>
                <option value="ORANG_TUA">Orang Tua Kandung</option>
                <option value="MERTUA">Mertua</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Pekerjaan / Status</label>
              <input
                type="text"
                value={form.jobOrStatus}
                onChange={e => setForm({ ...form, jobOrStatus: e.target.value })}
                placeholder="Pelajar / Mahasiswa / Belum Bekerja / Ibu Rumah Tangga"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <span>Simpan Tanggungan</span>
            </button>
          </div>
        </div>
      )}

      {/* Table of Dependents */}
      {currentReturn.dependents.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
          <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Belum Ada Tanggungan Terdaftar</p>
          <p className="text-xs text-slate-400 mt-1">Status PTKP Anda adalah TK/0 (Tidak Kawin tanpa tanggungan).</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 w-12 text-center">No</th>
                <th className="px-3 py-2.5">Nama Lengkap</th>
                <th className="px-3 py-2.5">NIK KTP</th>
                <th className="px-3 py-2.5">Hubungan Keluarga</th>
                <th className="px-3 py-2.5">Pekerjaan / Status</th>
                <th className="px-3 py-2.5 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentReturn.dependents.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 text-center font-mono text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2.5 font-bold text-slate-900">
                    {item.fullName}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-700">
                    {item.nik}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                      {item.familyRelationship.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {item.jobOrStatus}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
