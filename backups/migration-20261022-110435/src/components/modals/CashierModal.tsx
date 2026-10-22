/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect } from 'react';
import { X, UserPlus, UserCheck, Shield, Clock, Phone, Tag } from 'lucide-react';
import { CashierUser } from '../../types';

interface CashierModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashierToEdit?: CashierUser | null;
  onSaveCashier: (cashier: CashierUser) => void;
}

export const CashierModal: React.FC<CashierModalProps> = ({
  isOpen,
  onClose,
  cashierToEdit,
  onSaveCashier,
}) => {
  const [name, setName] = useState('');
  const [shiftName, setShiftName] = useState('Shift 1');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Kasir');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (cashierToEdit) {
      setName(cashierToEdit.name);
      setShiftName(cashierToEdit.shiftName || 'Shift 1');
      setPhone(cashierToEdit.phone || '');
      setRole(cashierToEdit.role || 'Kasir');
      setIsActive(cashierToEdit.isActive !== false);
      setNotes(cashierToEdit.notes || '');
    } else {
      setName('');
      setShiftName('Shift 1');
      setPhone('');
      setRole('Kasir');
      setIsActive(true);
      setNotes('');
    }
  }, [cashierToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nama kasir wajib diisi.');
      return;
    }

    const cashier: CashierUser = {
      id: cashierToEdit?.id || `cashier_${Date.now()}`,
      name: name.trim().toUpperCase(),
      shiftName: shiftName.trim() || 'Shift 1',
      phone: phone.trim(),
      role: role.trim() || 'Kasir',
      isActive,
      notes: notes.trim(),
    };

    onSaveCashier(cashier);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#1e295d] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <UserPlus className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {cashierToEdit ? 'EDIT DATA KASIR' : 'TAMBAH KASIR BARU'}
              </h2>
              <p className="text-xs text-blue-200">
                Atur nama kasir, shift kerja toko, dan informasi aktif
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Kasir <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: FIRA, RIO, ANISA"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Shift Toko <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'Shift 1', label: 'Shift 1 (Pagi - Siang)' },
                { id: 'Shift 2', label: 'Shift 2 (Siang - Malam)' },
                { id: 'Full Shift', label: 'Full Shift (Seharian)' },
                { id: 'Custom', label: 'Shift Kustom / Lainnya' }
              ].map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setShiftName(s.id === 'Custom' ? '' : s.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                    (shiftName === s.id || (s.id === 'Custom' && shiftName !== 'Shift 1' && shiftName !== 'Shift 2' && shiftName !== 'Full Shift'))
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{s.id === 'Custom' ? 'Kustom' : s.id}</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-500 block mt-0.5">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Custom shift name input if not standard */}
            {shiftName !== 'Shift 1' && shiftName !== 'Shift 2' && shiftName !== 'Full Shift' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  placeholder="Ketik nama shift (misal: Shift Pagi Weekend)"
                  className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jabatan / Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="Kasir Utama">Kasir Utama</option>
                <option value="Kasir">Kasir</option>
                <option value="Kasir Cadangan">Kasir Cadangan</option>
                <option value="Supervisor / Admin">Supervisor / Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                No. HP / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Kasir (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="misal: Bertugas di outlet Pelsek"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <div>
                <span className="text-xs font-bold text-slate-800">Status Kasir Aktif</span>
                <p className="text-[10px] text-slate-500">Kasir ini dapat dipilih saat membuka shift di aplikasi POS</p>
              </div>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4 text-sky-400" />
              {cashierToEdit ? 'Simpan Perubahan' : 'Tambah Kasir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
