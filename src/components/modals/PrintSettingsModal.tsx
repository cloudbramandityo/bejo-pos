/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState } from 'react';
import {
  Printer,
  X,
  Check,
  RotateCcw,
  Sliders,
  HelpCircle,
  FileText,
  Sparkles,
  QrCode,
  Store,
  Scissors,
  Eye,
  Info,
  ExternalLink,
  ChevronRight,
  Zap
} from 'lucide-react';
import { PrintSettings } from '../../types';
import { DEFAULT_PRINT_SETTINGS } from '../../utils/storage';
import { StoreLogo } from '../StoreLogo';
import { printThermalElement } from '../../utils/thermalPrinter';

interface PrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrintSettings;
  onSaveSettings: (newSettings: PrintSettings) => void;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeBranch?: string;
}

export const PrintSettingsModal: React.FC<PrintSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  storeName = 'BEJO Digital Print',
  storePhone = '0812-3456-7890',
  storeAddress = 'Jl. Raya Utama No. 45 (Sebelah Polsek)',
  storeBranch = 'Polsek Utama',
}) => {
  const [formData, setFormData] = useState<PrintSettings>(() => ({
    ...DEFAULT_PRINT_SETTINGS,
    ...settings,
  }));

  const [activeTab, setActiveTab] = useState<'settings' | 'kiosk_guide' | 'preview'>('settings');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccessMsg(true);
    setTimeout(() => {
      setSaveSuccessMsg(false);
      onClose();
    }, 600);
  };

  const handleResetDefault = () => {
    if (window.confirm('Kembalikan semua pengaturan printer ke setelan bawaan rekomendasi (POS 80mm)?')) {
      setFormData({ ...DEFAULT_PRINT_SETTINGS });
    }
  };

  const handleTestPrint = () => {
    // Temporarily apply settings for test print
    onSaveSettings(formData);
    setTimeout(() => {
      const previewEl = document.getElementById('thermal-receipt-preview');
      if (previewEl) {
        printThermalElement(previewEl, {
          paperSize: formData.paperSize,
          printMarginMm: formData.printMarginMm
        });
      } else {
        printThermalElement('thermal-receipt', {
          paperSize: formData.paperSize,
          printMarginMm: formData.printMarginMm
        });
      }
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">PENGATURAN PRINTER THERMAL POS</h2>
              <p className="text-[11px] text-slate-300">Atur ukuran kertas 80mm/58mm, cetak otomatis, dan hemat kertas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 px-5 pt-2.5 border-b border-slate-200 flex items-center gap-2 shrink-0 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-t border-x ${
              activeTab === 'settings'
                ? 'bg-white text-slate-900 font-bold border-slate-200 -mb-px'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>Format & Ukuran Kertas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-t border-x ${
              activeTab === 'preview'
                ? 'bg-white text-slate-900 font-bold border-slate-200 -mb-px'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span>Live Preview Struk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kiosk_guide')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-t border-x ${
              activeTab === 'kiosk_guide'
                ? 'bg-white text-slate-900 font-bold border-slate-200 -mb-px'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Panduan Otomatis Print (Kiosk)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50 space-y-5">
          {activeTab === 'settings' && (
            <form onSubmit={handleSave} className="space-y-5">
              {/* 1. Default Printer Selection & Device Name */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-indigo-600" />
                    Pilihan Printer Default & Perangkat
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pilih printer yang dipakai lebih dulu saat kasir mencetak struk atau surat jalan.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, defaultPrinter: 'pos_80', paperSize: '80mm' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.defaultPrinter === 'pos_80' || (!formData.defaultPrinter && formData.paperSize === '80mm')
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Thermal POS 80</span>
                      <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-1.5 py-0.2 rounded">Rekomendasi</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal mt-1">
                      Printer kasir 80mm kabel, jaringan, atau Bluetooth (Epson, Panda, Xprinter, Iware).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, defaultPrinter: 'pos_58', paperSize: '58mm' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.defaultPrinter === 'pos_58' || (!formData.defaultPrinter && formData.paperSize === '58mm')
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Thermal POS 58</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-1">
                      Printer mini 58mm yang bisa dibawa, sambungan Bluetooth.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, defaultPrinter: 'system_default' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.defaultPrinter === 'system_default'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Default Browser / OS</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-1">
                      Mengikuti printer utama yang sudah disetel di komputer kasir.
                    </div>
                  </button>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Label / Nama Printer Kasir (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formData.printerDeviceName || ''}
                    onChange={(e) => setFormData({ ...formData, printerDeviceName: e.target.value })}
                    placeholder="misal: POS-80 USB Printer Kasir 1 / EPSON TM-T82"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="text-[10.5px] text-slate-400 mt-1 block">
                    Nama printer kasir yang sedang dipakai di komputer ini.
                  </span>
                </div>
              </div>

              {/* 2. Paper Size Selection */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      Ukuran Kertas Thermal Printer
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pilih ukuran gulungan kertas yang terpasang di printer kasir.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      formData.paperSize === '80mm'
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paperSize"
                      value="80mm"
                      checked={formData.paperSize === '80mm'}
                      onChange={() => setFormData({ ...formData, paperSize: '80mm' })}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">80 mm x Roll (Standar POS 80)</span>
                        <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                          Default / Rekomendasi
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 font-normal leading-relaxed">
                        Lebar kertas roll standar kasir 80mm (Epson, Xprinter, Iware, Panda). Panjang struk menyesuaikan isi.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      formData.paperSize === '58mm'
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paperSize"
                      value="58mm"
                      checked={formData.paperSize === '58mm'}
                      onChange={() => setFormData({ ...formData, paperSize: '58mm' })}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">58 mm x Roll (Mini Thermal / Bluetooth)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 font-normal leading-relaxed">
                        Untuk printer mini 58mm yang bisa dibawa. Teks diperkecil otomatis agar muat di kertas.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 3. Margin Cetak (0mm - 10mm) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                      Format Margin Cetak (0mm – 10mm)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Atur jarak tepi kertas. 0mm disarankan agar kertas tidak terbuang.
                    </p>
                  </div>
                  <div className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-mono font-bold text-xs px-2.5 py-1 rounded-lg">
                    {formData.printMarginMm || 0} mm
                  </div>
                </div>

                {/* Slider Control */}
                <div className="pt-2 space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={formData.printMarginMm || 0}
                    onChange={(e) => setFormData({ ...formData, printMarginMm: parseInt(e.target.value, 10) || 0 })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>0 mm (Nol Margin / Hemat Kertas)</span>
                    <span>2 mm</span>
                    <span>5 mm</span>
                    <span>8 mm</span>
                    <span>10 mm (Lebar)</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { val: 0, label: '0 mm (Hemat Kertas POS 80)', badge: 'Rekomendasi' },
                    { val: 2, label: '2 mm (Standar POS)' },
                    { val: 3, label: '3 mm' },
                    { val: 5, label: '5 mm (Rapi)' },
                    { val: 10, label: '10 mm (Lebar)' }
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setFormData({ ...formData, printMarginMm: preset.val })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        (formData.printMarginMm || 0) === preset.val
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {preset.badge && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                          (formData.printMarginMm || 0) === preset.val ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {preset.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Auto-Print Options (Selesai Transaksi & Surat Jalan) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    Opsi Auto-Print Otomatis
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Aktifkan agar kasir tidak perlu menekan tombol cetak lagi saat transaksi atau surat jalan selesai.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  {/* Option 1: Auto-Print on Checkout */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Auto-Print Saat 'Selesai Transaksi' di POS</span>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.2 rounded">
                          Struk POS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Struk langsung tercetak ke printer kasir begitu tombol 'Selesai Transaksi' ditekan.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={formData.autoPrintOnCheckout}
                        onChange={(e) => setFormData({ ...formData, autoPrintOnCheckout: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* Option 2: Auto-Print on Surat Jalan */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Auto-Print Saat 'Cetak Surat Jalan' / Pengambilan Agen</span>
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-1.5 py-0.2 rounded">
                          Surat Jalan
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Surat jalan / bukti pengambilan bahan langsung tercetak begitu pesanan diproses atau tombol surat jalan diklik.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={!!formData.autoPrintOnSuratJalan}
                        onChange={(e) => setFormData({ ...formData, autoPrintOnSuratJalan: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* 3. Paper Saving & Density */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                    Kerapatan Font & Mode Hemat Kertas
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Atur spasi dan ukuran huruf agar struk lebih pendek dan hemat kertas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, density: 'compact' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.density === 'compact'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Hemat Kertas (Compact)</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Spasi sangat rapat, hemat 30% kertas struk.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, density: 'standard' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.density === 'standard'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Standar (Seimbang)</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Ukuran sedang, nyaman dibaca pelanggan.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, density: 'large' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.density === 'large'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Besar & Jelas (Large)</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Huruf lebih besar, mudah dibaca.
                    </div>
                  </button>
                </div>
              </div>

              {/* 4. Contrast & Darkness */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Ketajaman & Kontras Cetak Thermal
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Atur ketebalan huruf agar hasil cetak tidak pudar dan awet terbaca.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contrast: 'normal' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.contrast === 'normal'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold">Normal (Weight 600)</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Ketebalan teks standar.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contrast: 'bold' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.contrast === 'bold'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-black">Tebal & Tajam (Weight 700)</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Rekomendasi untuk printer POS 80.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contrast: 'ultra-black' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.contrast === 'ultra-black'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-black text-black">Hitam Pekat Solid (Weight 900)</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Paling pekat, cocok untuk printer thermal lama.
                    </div>
                  </button>
                </div>
              </div>

              {/* 5. Show/Hide Receipt Elements */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-indigo-600" />
                    Elemen Struk Penjualan
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pilih bagian yang boleh tampil di struk sesuai kebutuhan toko.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <span className="text-xs font-medium text-slate-800">Logo Toko di Atas</span>
                    <input
                      type="checkbox"
                      checked={formData.showLogo}
                      onChange={(e) => setFormData({ ...formData, showLogo: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <span className="text-xs font-medium text-slate-800">Header Alamat & No. WA Toko</span>
                    <input
                      type="checkbox"
                      checked={formData.showStoreHeader}
                      onChange={(e) => setFormData({ ...formData, showStoreHeader: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <span className="text-xs font-medium text-slate-800">Data Pelanggan (Nama & WA)</span>
                    <input
                      type="checkbox"
                      checked={formData.showCustomerInfo}
                      onChange={(e) => setFormData({ ...formData, showCustomerInfo: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <span className="text-xs font-medium text-slate-800">Nama Kasir Bertugas</span>
                    <input
                      type="checkbox"
                      checked={formData.showCashierName}
                      onChange={(e) => setFormData({ ...formData, showCashierName: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <span className="text-xs font-medium text-slate-800">Catatan Garansi / Footer Toko</span>
                    <input
                      type="checkbox"
                      checked={formData.showFooterNotes}
                      onChange={(e) => setFormData({ ...formData, showFooterNotes: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <span className="text-xs font-medium text-slate-800">QR Code WhatsApp Toko</span>
                    <input
                      type="checkbox"
                      checked={formData.showQrCode}
                      onChange={(e) => setFormData({ ...formData, showQrCode: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </label>
                </div>
              </div>

              {/* 6. Feed Lines (Bottom Cutting Margin) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                      Jarak Baris Sebelum Kertas Dipotong
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Jumlah baris kosong yang keluar sebelum kertas dipotong printer.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormData({ ...formData, feedLines: num })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        formData.feedLines === num
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {num} {num === 1 ? 'Baris (Hemat)' : num === 2 ? 'Baris (Standar POS 80)' : 'Baris'}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Contoh tampilan struk dengan pengaturan saat ini (Kertas: <strong>{formData.paperSize}</strong>, Kerapatan: <strong>{formData.density}</strong>, Kontras: <strong>{formData.contrast}</strong>).
                </span>
              </div>

              <div className="flex justify-center p-3 bg-slate-200/50 rounded-2xl">
                <div
                  className={`bg-white p-4 shadow-md border border-dashed border-slate-300 text-black font-mono leading-relaxed transition-all ${
                    formData.paperSize === '58mm' ? 'w-full max-w-[240px] text-[10px]' : 'w-full max-w-xs text-xs'
                  } ${
                    formData.density === 'compact' ? 'leading-tight text-[10.5px]' : formData.density === 'large' ? 'leading-loose text-[12.5px]' : 'leading-relaxed'
                  } ${
                    formData.contrast === 'ultra-black' ? 'font-black' : formData.contrast === 'bold' ? 'font-bold' : 'font-semibold'
                  }`}
                >
                  {/* Logo & Header */}
                  {formData.showLogo && (
                    <div className="flex justify-center mb-1.5">
                      <StoreLogo size="sm" rounded="rounded-md" storeName={storeName} />
                    </div>
                  )}

                  {formData.showStoreHeader && (
                    <div className="text-center pb-2.5 border-b border-dashed border-black">
                      <div className="font-extrabold text-sm tracking-widest uppercase">{storeName}</div>
                      <div className="text-[10px] text-slate-700 uppercase font-sans">{storeBranch}</div>
                      <div className="text-[9.5px] text-slate-600 font-sans mt-0.5">{storeAddress}</div>
                      <div className="text-[9.5px] text-slate-700 font-sans">WA: {storePhone}</div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="py-2 border-b border-dashed border-black text-[10.5px] space-y-0.5">
                    <div className="flex justify-between">
                      <span>No. Invoice</span>
                      <span className="font-bold">#INV-2026/09/001</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tgl / Jam</span>
                      <span>27/09/26 14:30</span>
                    </div>
                    {formData.showCashierName && (
                      <div className="flex justify-between">
                        <span>Kasir</span>
                        <span className="uppercase">FIRA (KASIR 1)</span>
                      </div>
                    )}
                    {formData.showCustomerInfo && (
                      <div className="flex justify-between pt-0.5 border-t border-slate-100">
                        <span>Pelanggan</span>
                        <span className="font-bold">Bramandityo (08123456789)</span>
                      </div>
                    )}
                  </div>

                  {/* Sample Items */}
                  <div className="py-2 border-b border-dashed border-black space-y-1.5 text-[10.5px]">
                    <div className="space-y-0.5">
                      <div className="font-bold flex justify-between">
                        <span>Stiker Ritrama Glossy</span>
                      </div>
                      <div className="flex justify-between text-[9.5px]">
                        <span>RTM-01 | 5 meter</span>
                        <span className="font-bold">Rp 125.000</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold flex justify-between">
                        <span>Oracal 651 Black Glossy</span>
                      </div>
                      <div className="flex justify-between text-[9.5px]">
                        <span>ORC-651 | 1 Roll (50m)</span>
                        <span className="font-bold">Rp 850.000</span>
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="py-2 border-b border-dashed border-black text-[10.5px] space-y-0.5">
                    <div className="flex justify-between">
                      <span>Sub Total</span>
                      <span>Rp 975.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Diskon (Member Grosir)</span>
                      <span>-Rp 25.000</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-black">
                      <span>TOTAL BAYAR</span>
                      <span>Rp 950.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tunai (Cash)</span>
                      <span>Rp 1.000.000</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Kembalian</span>
                      <span>Rp 50.000</span>
                    </div>
                  </div>

                  {/* Footer Notes */}
                  {formData.showFooterNotes && (
                    <div className="pt-2 text-center text-[8.5px] font-sans text-slate-600 leading-tight">
                      <p>{formData.customFooterNote || 'Jika terdapat kesalahan warna bahan atau harga harap segera menghubungi nomor toko.'}</p>
                    </div>
                  )}

                  {/* QR Code */}
                  {formData.showQrCode && (
                    <div className="pt-2.5 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center border border-slate-300">
                        <QrCode className="w-12 h-12 text-slate-800" />
                      </div>
                      <span className="text-[7.5px] font-sans font-bold text-slate-700 uppercase mt-1">
                        SCAN QR UNTUK ORDER WA
                      </span>
                    </div>
                  )}

                  <div className="text-center font-mono text-[8px] text-slate-400 mt-2">
                    -- TERIMA KASIH --
                  </div>

                  {/* Cutting feed line simulation */}
                  {Array.from({ length: formData.feedLines }).map((_, i) => (
                    <div key={i} className="h-3.5 border-b border-transparent"></div>
                  ))}
                  {formData.showCutLine && (
                    <div className="text-center text-[8px] text-slate-400 border-t border-dotted border-slate-400 pt-0.5">
                      - - - - - - - - - - [ Gunting di Sini ] - - - - - - - - - -
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'kiosk_guide' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span>Cara Mengaktifkan Cetak Otomatis Tanpa Jendela Pratinjau</span>
                </div>
                <p className="text-xs text-indigo-800 leading-relaxed font-normal">
                  Chrome atau Edge selalu menampilkan jendela pratinjau tiap kali mencetak. Ikuti 3 langkah di komputer/laptop kasir agar struk <strong>langsung keluar dari printer thermal</strong> begitu tombol cetak diklik:
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                    <span>Jadikan Printer Thermal POS 80 Sebagai Default Printer</span>
                  </div>
                  <p className="text-slate-600 text-[11px] pl-7">
                    Buka <em>Windows Settings &rarr; Bluetooth & devices &rarr; Printers & Scanners</em>. Pilih printer kasir Anda, lalu klik <strong>Set as default</strong>.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <span>Hilangkan Header & Footer Cetak (Agar Hemat Kertas)</span>
                  </div>
                  <p className="text-slate-600 text-[11px] pl-7">
                    Saat jendela cetak muncul, klik <em>More settings</em>. <strong>Hilangkan centang opsi "Headers and footers"</strong> lalu atur <strong>Margins: None</strong>.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                    <span>Tambahkan --kiosk-printing di Shortcut Chrome / Edge</span>
                  </div>
                  <p className="text-slate-600 text-[11px] pl-7 leading-relaxed">
                    Klik kanan shortcut Google Chrome di Desktop &rarr; pilih <strong>Properties</strong>. Di kolom <strong>Target</strong>, ketik spasi lalu tambahkan teks berikut di paling akhir:
                  </p>
                  <div className="ml-7 p-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg select-all border border-slate-800 flex items-center justify-between">
                    <span>--kiosk-printing</span>
                    <span className="text-[10px] text-slate-400 font-sans">Tambahkan di akhir Target</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 pl-7 italic">
                    Contoh Target lengkap: <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing</code>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefault}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Reset ke pengaturan standar rekomendasi POS 80"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standar</span>
            </button>

            <button
              type="button"
              onClick={handleTestPrint}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Cetak struk uji coba ke printer thermal sekarang"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700" />
              <span>Test Print Struk</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              {saveSuccessMsg ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Printer className="w-4 h-4 text-emerald-400" />
              )}
              <span>{saveSuccessMsg ? 'Tersimpan!' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
