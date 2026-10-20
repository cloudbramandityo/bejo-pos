/**
 * Coded by Langgo Bramandityo.
 * Submenu 2: Data Wajib Pajak (Profil & Status Perpajakan)
 */
import React, { useState } from 'react';
import { TaxpayerProfile, MaritalTaxStatus, PtkpStatus, TAX_CONFIG_2025 } from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import { UserCheck, Shield, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface TaxpayerProfileViewProps {
  taxpayer: TaxpayerProfile;
  onSaveProfile: (profile: TaxpayerProfile) => void;
}

export const TaxpayerProfileView: React.FC<TaxpayerProfileViewProps> = ({
  taxpayer,
  onSaveProfile,
}) => {
  const [form, setForm] = useState<TaxpayerProfile>({ ...taxpayer });
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(form);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const ptkpOptions: { value: PtkpStatus; label: string }[] = [
    { value: 'TK/0', label: 'TK/0 — Tidak Kawin, 0 Tanggungan (Rp 54 Juta)' },
    { value: 'TK/1', label: 'TK/1 — Tidak Kawin, 1 Tanggungan (Rp 58.5 Juta)' },
    { value: 'TK/2', label: 'TK/2 — Tidak Kawin, 2 Tanggungan (Rp 63 Juta)' },
    { value: 'TK/3', label: 'TK/3 — Tidak Kawin, 3 Tanggungan (Rp 67.5 Juta)' },
    { value: 'K/0', label: 'K/0 — Kawin, 0 Tanggungan (Rp 58.5 Juta)' },
    { value: 'K/1', label: 'K/1 — Kawin, 1 Tanggungan (Rp 63 Juta)' },
    { value: 'K/2', label: 'K/2 — Kawin, 2 Tanggungan (Rp 67.5 Juta)' },
    { value: 'K/3', label: 'K/3 — Kawin, 3 Tanggungan (Rp 72 Juta)' },
    { value: 'K/I/0', label: 'K/I/0 — Kawin Istri Gabung Penghasilan, 0 Tanggungan (Rp 112.5 Juta)' },
    { value: 'K/I/1', label: 'K/I/1 — Kawin Istri Gabung Penghasilan, 1 Tanggungan (Rp 117 Juta)' },
    { value: 'K/I/2', label: 'K/I/2 — Kawin Istri Gabung Penghasilan, 2 Tanggungan (Rp 121.5 Juta)' },
    { value: 'K/I/3', label: 'K/I/3 — Kawin Istri Gabung Penghasilan, 3 Tanggungan (Rp 126 Juta)' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 max-w-4xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>Identitas & Profil Wajib Pajak Orang Pribadi</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Data ini digunakan sebagai identitas resmi pada Formulir Induk SPT Tahunan 1770 dan bukti pelaporan resmi DJP.
          </p>
        </div>
        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Profil Disimpan</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Data Identitas Pokok */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-400" />
            <span>Identitas Pokok (KTP & NPWP 16 Digit)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                NPWP 16 Digit / NIK <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.npwp}
                onChange={e => setForm({ ...form, npwp: e.target.value })}
                placeholder="Contoh: 09.345.678.9-521.000 atau NIK 16 digit"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Sesuai format integrasi NIK menjadi NPWP (PMK 112/2022).</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor Induk Kependudukan (NIK) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.nik}
                onChange={e => setForm({ ...form, nik: e.target.value })}
                placeholder="16 digit NIK KTP"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Lengkap Sesuai KTP <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon / WhatsApp</label>
              <input
                type="text"
                value={form.phoneNumber}
                onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alamat Email Aktif</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Alamat Tempat Tinggal */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            Alamat Domisili / Tempat Tinggal
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kota / Kabupaten</label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kode Pos</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={e => setForm({ ...form, postalCode: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kode KLU Usaha</label>
              <input
                type="text"
                value={form.kluCode || ''}
                onChange={e => setForm({ ...form, kluCode: e.target.value })}
                placeholder="Contoh: 47611"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Status Kewajiban Perpajakan Suami-Istri & PTKP */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            Status Kewajiban Perpajakan Suami-Istri & PTKP
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Status Kewajiban Perpajakan Suami-Istri <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.maritalTaxStatus}
                onChange={e => setForm({ ...form, maritalTaxStatus: e.target.value as MaritalTaxStatus })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="KK">KK — Kepala Keluarga (Suami sebagai kepala keluarga)</option>
                <option value="HB">HB — Hidup Berpisah (Putusan Hakim/Cerai)</option>
                <option value="PH">PH — Pisah Harta (Ada Perjanjian Pisah Harta & Penghasilan)</option>
                <option value="MT">MT — Memilih Terpisah (Istri menghendaki NPWP terpisah)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Status PTKP (Penghasilan Tidak Kena Pajak) <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.ptkpStatus}
                onChange={e => setForm({ ...form, ptkpStatus: e.target.value as PtkpStatus })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {ptkpOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Nilai PTKP tahun berjalan: <strong>{formatRupiah(TAX_CONFIG_2025.ptkpRates[form.ptkpStatus] || 54000000)}</strong>
              </p>
            </div>

            {(form.maritalTaxStatus === 'PH' || form.maritalTaxStatus === 'MT') && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NPWP Pasangan (Istri/Suami)</label>
                  <input
                    type="text"
                    value={form.spouseNpwp || ''}
                    onChange={e => setForm({ ...form, spouseNpwp: e.target.value })}
                    placeholder="16 digit NPWP Pasangan"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Pasangan</label>
                  <input
                    type="text"
                    value={form.spouseName || ''}
                    onChange={e => setForm({ ...form, spouseName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan Profil</span>
          </button>
        </div>
      </form>
    </div>
  );
};
