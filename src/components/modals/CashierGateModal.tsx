/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect } from 'react';
import {
  Clock,
  User,
  Store,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { CashierUser } from '../../types';
import { formatRupiah, formatNumberInput, parseNumber, getFormattedDate, getFormattedTime } from '../../utils/formatters';
import { StoreLogo } from '../StoreLogo';

interface CashierGateModalProps {
  isOpen: boolean;
  cashiers: CashierUser[];
  defaultStoreName: string;
  onOpenShift: (cashierName: string, shiftName: string, startingCash: number, storeName: string) => void;
}

export const CashierGateModal: React.FC<CashierGateModalProps> = ({
  isOpen,
  cashiers,
  defaultStoreName,
  onOpenShift,
}) => {
  const activeCashiers = cashiers.filter((c) => c.isActive !== false);

  const [selectedCashierName, setSelectedCashierName] = useState<string>('');
  const [selectedShiftName, setSelectedShiftName] = useState<string>('Shift 1');
  const [storeName, setStoreName] = useState(defaultStoreName || 'BEJO Pelsek');
  const [startingCash, setStartingCash] = useState<string>('250.000');
  const [customCashierInput, setCustomCashierInput] = useState('');
  const [isCustomCashier, setIsCustomCashier] = useState(false);

  // Live real-time clock for cashier login
  const [liveDate, setLiveDate] = useState(getFormattedDate());
  const [liveTime, setLiveTime] = useState(getFormattedTime(true));

  useEffect(() => {
    const update = () => {
      setLiveDate(getFormattedDate());
      setLiveTime(getFormattedTime(true));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Set default selected cashier when list loads
  useEffect(() => {
    if (activeCashiers.length > 0 && !selectedCashierName) {
      const first = activeCashiers[0];
      setSelectedCashierName(first.name);
      setSelectedShiftName(first.shiftName || 'Shift 1');
    }
  }, [activeCashiers, selectedCashierName]);

  useEffect(() => {
    if (defaultStoreName) {
      setStoreName(defaultStoreName);
    }
  }, [defaultStoreName]);

  if (!isOpen) return null;

  const handleCashierChange = (name: string) => {
    if (name === '__NEW__') {
      setIsCustomCashier(true);
      setSelectedCashierName('');
    } else {
      setIsCustomCashier(false);
      setSelectedCashierName(name);
      const found = activeCashiers.find((c) => c.name.toUpperCase() === name.toUpperCase());
      if (found && found.shiftName) {
        setSelectedShiftName(found.shiftName);
      }
    }
  };

  const handleQuickCash = (amount: number) => {
    const current = parseNumber(startingCash);
    setStartingCash(formatNumberInput(current + amount));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCashierName = isCustomCashier
      ? customCashierInput.trim().toUpperCase()
      : selectedCashierName.trim().toUpperCase();

    if (!finalCashierName) {
      alert('Silakan pilih atau masukkan Nama Kasir terlebih dahulu.');
      return;
    }

    if (!selectedShiftName.trim()) {
      alert('Silakan pilih Shift Toko.');
      return;
    }

    const numStartingCash = parseNumber(startingCash);

    onOpenShift(
      finalCashierName,
      selectedShiftName.trim(),
      numStartingCash >= 0 ? numStartingCash : 0,
      storeName.trim() || 'BEJO Pelsek'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div 
        id="modal-pilihan-kasir-shift"
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/90"
      >
        {/* Top Header Card */}
        <div className="bg-gradient-to-br from-[#12193b] via-[#1e295d] to-[#0ea5e9] text-white p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center gap-3.5 relative z-10">
            <StoreLogo
              size="xl"
              rounded="rounded-2xl"
              storeName={storeName}
              className="p-1 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold text-sky-200 backdrop-blur-xs">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  POS Kasir Bejo Stiker
                </div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-[11px] font-bold text-emerald-200 border border-emerald-400/30">
                  <Clock className="w-3 h-3 text-emerald-300 animate-pulse" />
                  <span>{liveDate} • {liveTime} WIB</span>
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                PILIHAN KASIR & SHIFT
              </h1>
              <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                Pilih nama kasir bertugas dan shift kerja untuk mulai membuka kasir.
              </p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5">
          {/* 1. Pilih Kasir */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                Nama Kasir Bertugas
              </span>
              <span className="text-[11px] font-normal text-slate-500 lowercase">wajib dipilih</span>
            </label>

            {!isCustomCashier ? (
              <div className="space-y-2">
                <select
                  value={selectedCashierName}
                  onChange={(e) => handleCashierChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 hover:border-blue-400 rounded-2xl px-4 py-3 text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 shadow-2xs transition-all"
                  required
                >
                  <option value="" disabled>-- Pilih Nama Kasir --</option>
                  {activeCashiers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} - ({c.shiftName || 'Shift 1'} • {c.role || 'Kasir'})
                    </option>
                  ))}
                  <option value="__NEW__">+ Tambah Nama Kasir Lainnya...</option>
                </select>

                {/* Quick select chips for common cashiers */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeCashiers.slice(0, 4).map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => handleCashierChange(c.name)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        selectedCashierName === c.name
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCashierInput}
                    onChange={(e) => setCustomCashierInput(e.target.value)}
                    placeholder="Ketik Nama Kasir Baru (Contoh: SITI)"
                    className="flex-1 bg-slate-50 border border-blue-400 rounded-2xl px-4 py-3 text-sm font-black text-slate-900 uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCashier(false);
                      if (activeCashiers[0]) setSelectedCashierName(activeCashiers[0].name);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl"
                  >
                    Batal
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">Nama baru ini akan digunakan untuk shift saat ini.</p>
              </div>
            )}
          </div>

          {/* 2. Pilih Shift */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Pilihan Shift Toko
              </span>
              <span className="text-[11px] font-normal text-slate-500">{selectedShiftName}</span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'Shift 1', title: 'Shift 1', subtitle: 'Pagi - Siang (08:00 - 15:00)' },
                { id: 'Shift 2', title: 'Shift 2', subtitle: 'Siang - Malam (15:00 - 22:00)' },
                { id: 'Full Shift', title: 'Full Shift', subtitle: 'Seharian Penuh' },
                { id: 'Shift Lembur', title: 'Shift Lembur', subtitle: 'Pengerjaan Tambahan' },
              ].map((s) => {
                const isSelected = selectedShiftName === s.id;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setSelectedShiftName(s.id)}
                    className={`p-3 rounded-2xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 text-blue-950 shadow-xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{s.title}</span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 block mt-0.5 leading-tight">
                      {s.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Toko & Modal Awal Kas Laci */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" />
                Toko / Cabang
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Modal Kas Awal Laci
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">Rp</span>
                <input
                  type="text"
                  value={startingCash}
                  onChange={(e) => setStartingCash(formatNumberInput(e.target.value) || '0')}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Quick Cash Buttons */}
          <div className="flex items-center justify-end gap-1.5 -mt-2">
            <span className="text-[10px] text-slate-400 font-medium mr-1">Quick Tambah Kas:</span>
            {[50000, 100000, 250000].map((amt) => (
              <button
                type="button"
                key={amt}
                onClick={() => handleQuickCash(amt)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 text-[10px] font-bold rounded-lg transition-colors border border-slate-200"
              >
                +{formatRupiah(amt)}
              </button>
            ))}
          </div>

          {/* Action Button */}
          <div className="pt-3">
            <button
              type="submit"
              id="btn-buka-shift-masuk-pos"
              className="w-full py-3.5 px-5 bg-gradient-to-r from-[#1e295d] to-blue-600 hover:from-[#151e44] hover:to-blue-700 text-white font-black text-sm rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition-all flex items-center justify-center gap-2 group"
            >
              <span>BUKA SHIFT & MASUK KE POS</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Modal kas awal & transaksi akan terekam otomatis pada shift ini
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
