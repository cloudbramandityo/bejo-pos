/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect } from 'react';
import { X, UserPlus, Phone, User, Tag, Edit2 } from 'lucide-react';
import { Customer, CustomerCategory } from '../../types';

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CustomerCategory[];
  customerToEdit?: Customer | null;
  onSaveCustomer: (customer: Customer) => void;
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  isOpen,
  onClose,
  categories,
  customerToEdit,
  onSaveCustomer,
}) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat_retail');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (customerToEdit) {
      setPhone(customerToEdit.phone);
      setName(customerToEdit.name);
      setCategoryId(customerToEdit.categoryId || categories[0]?.id || 'cat_retail');
      setNotes(customerToEdit.notes || '');
      setError('');
    } else {
      setPhone('');
      setName('');
      setCategoryId(categories[0]?.id || 'cat_retail');
      setNotes('');
      setError('');
    }
  }, [customerToEdit, isOpen, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Nomor WhatsApp / HP wajib diisi');
      return;
    }
    if (!name.trim()) {
      setError('Nama pelanggan wajib diisi');
      return;
    }

    // Format phone to standard clean digits
    const cleanedPhone = phone.replace(/[^0-9]/g, '');
    if (cleanedPhone.length < 8) {
      setError('Nomor HP tidak valid (minimal 8 digit)');
      return;
    }

    const today = new Date();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dateFormatted = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

    const savedCustomer: Customer = {
      id: customerToEdit ? customerToEdit.id : cleanedPhone,
      phone: cleanedPhone,
      name: name.trim(),
      categoryId: categoryId,
      createdAt: customerToEdit ? customerToEdit.createdAt : dateFormatted,
      totalSpent: customerToEdit ? customerToEdit.totalSpent : 0,
      transactionCount: customerToEdit ? customerToEdit.transactionCount : 0,
      notes: notes.trim()
    };

    onSaveCustomer(savedCustomer);
    onClose();
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center sm:items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 max-sm:p-0 max-sm:items-end animate-in fade-in duration-200">
      <div 
        id="modal-tambah-pelanggan-baru"
        className="bg-white rounded-2xl max-sm:rounded-b-none max-sm:rounded-t-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
      >
        <div className="bg-[#1e295d] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              {customerToEdit ? (
                <Edit2 className="w-5 h-5 text-sky-400" />
              ) : (
                <UserPlus className="w-5 h-5 text-sky-400" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {customerToEdit ? 'EDIT DATA PELANGGAN' : 'TAMBAH PELANGGAN BARU'}
              </h2>
              <p className="text-xs text-blue-200">
                {customerToEdit
                  ? 'Perbarui data kontak dan kategori pelanggan'
                  : 'Nomor HP/WA digunakan sebagai ID Pelanggan'}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              Nomor WhatsApp / HP (ID Utama)
            </label>
            <input
              type="text"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError('');
              }}
              placeholder="Contoh: 08123456789"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
              required
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Digunakan saat pencarian cepat kasir di POS</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Nama Pelanggan / Toko
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Contoh: Agus Widiarpo (Bengkel Stiker)"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              Kategori Pelanggan & Diskon
            </label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => {
                const isSelected = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">{cat.name}</div>
                    <div className="text-[11px] text-blue-600 font-semibold mt-0.5">
                      Diskon: {cat.discountPercent}%
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedCategory && selectedCategory.discountPercent > 0 && (
              <p className="text-[11px] text-emerald-600 font-medium mt-1.5">
                ✓ Otomatis mendapat diskon {selectedCategory.discountPercent}% saat checkout di POS.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Khusus (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Spesialis cutting variasi motor atau langganan display"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              {customerToEdit ? 'Simpan Perubahan' : 'Simpan Pelanggan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
