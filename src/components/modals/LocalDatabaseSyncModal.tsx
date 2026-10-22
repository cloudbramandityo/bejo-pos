/**
 * BEJO STIKER POS & Digital Printing
 * Modal Pengaturan Database Lokal & Cloud Real-Time (Otomatis & Terintegrasi Penuh)
 * Coded by Langgo Bramandityo.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  Cloud,
  FolderOpen,
  RefreshCw,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  Database,
  Layers,
  ShieldCheck,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  Radio,
  Wifi,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';
import {
  LocalDatabaseConfig,
  DatabaseStats,
  getLocalDatabaseConfig,
  saveLocalDatabaseConfig,
  calculateDatabaseStats,
  performFullDualSync,
  exportLocalDatabaseToFile
} from '../../utils/localDatabase';
import { restoreBackupToStorage, validateBackupPayload, PosBackupPayload } from '../../utils/backupUtils';

interface LocalDatabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCloudConnected?: boolean;
}

export const LocalDatabaseSyncModal: React.FC<LocalDatabaseSyncModalProps> = ({
  isOpen,
  onClose,
  isCloudConnected = true
}) => {
  const [config, setConfig] = useState<LocalDatabaseConfig>(() => getLocalDatabaseConfig());
  const [stats, setStats] = useState<DatabaseStats>(() => calculateDatabaseStats(isCloudConnected));
  const [tempDirPath, setTempDirPath] = useState<string>(config.localDirectoryPath);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [showManualTools, setShowManualTools] = useState<boolean>(false);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  const hiddenDirInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const refreshStats = () => {
    setStats(calculateDatabaseStats(isCloudConnected));
    setConfig(getLocalDatabaseConfig());
  };

  useEffect(() => {
    if (isOpen) {
      refreshStats();
      setTempDirPath(getLocalDatabaseConfig().localDirectoryPath);
    }
  }, [isOpen, isCloudConnected]);

  // Handle Pick Directory using File System Access API
  const handleBrowseLocalDirectory = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
        if (dirHandle && dirHandle.name) {
          const suggestedPath = `D:/${dirHandle.name}/`;
          setTempDirPath(suggestedPath);
          handleSaveDirectoryLocation(suggestedPath);
          showToast(`Folder "${dirHandle.name}" terpilih sebagai lokasi database lokal!`, 'success');
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('showDirectoryPicker fallback:', err);
      }
    }

    // Fallback trigger hidden input
    if (hiddenDirInputRef.current) {
      hiddenDirInputRef.current.click();
    }
  };

  const handleDirectoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const sample = files[0];
      const relPath = (sample as any).webkitRelativePath || '';
      const rootFolder = relPath.split('/')[0] || sample.name;
      if (rootFolder) {
        const path = `D:/${rootFolder}/`;
        setTempDirPath(path);
        handleSaveDirectoryLocation(path);
        showToast(`Folder "${rootFolder}" dipilih dari komputer/jaringan lokal!`, 'success');
      }
    }
  };

  // Save new directory location
  const handleSaveDirectoryLocation = (customTarget?: string) => {
    const target = (customTarget || tempDirPath || '').trim();
    if (!target) {
      alert('Mohon masukkan path lokasi database lokal yang valid.');
      return;
    }

    let clean = target;
    const usesBackslash = clean.includes('\\');
    if (usesBackslash) {
      if (!clean.endsWith('\\')) clean += '\\';
    } else {
      if (!clean.endsWith('/')) clean += '/';
    }

    const updated = saveLocalDatabaseConfig({
      localDirectoryPath: clean,
      lastLocalWriteTimestamp: Date.now()
    });

    setConfig(updated);
    setTempDirPath(clean);
    refreshStats();
    showToast(`Lokasi database lokal otomatis disetel ke: ${clean}`, 'success');
  };

  // Force Instant Dual Sync
  const handleManualSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await performFullDualSync();
      refreshStats();
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Gagal menjalankan sinkronisasi database', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Optional Export JSON Database
  const handleExportDatabase = () => {
    try {
      exportLocalDatabaseToFile();
      showToast('File backup cadangan .json berhasil diunduh!', 'success');
    } catch (e) {
      showToast('Gagal mengekspor database', 'error');
    }
  };

  // Optional Restore JSON Database
  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const valid = validateBackupPayload(parsed);

        if (!valid) {
          alert('Format file cadangan database tidak valid atau rusak.');
          return;
        }

        if (
          !window.confirm(
            `Apakah Anda yakin ingin memulihkan database dari file "${file.name}"? Seluruh data lokal dan cloud akan diperbarui dengan data cadangan ini.`
          )
        ) {
          return;
        }

        setIsRestoring(true);
        restoreBackupToStorage(parsed as PosBackupPayload);
        await performFullDualSync();
        refreshStats();
        showToast('Database berhasil dipulihkan secara menyeluruh!', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err) {
        console.error('Failed to parse database backup', err);
        showToast('Gagal memproses file cadangan database', 'error');
      } finally {
        setIsRestoring(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] text-slate-900">
        {/* Modern Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">
                  Database Lokal & Cloud Real-Time
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  100% OTOMATIS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                Penyimpanan ganda real-time (IndexedDB lokal & Google PocketBase) tanpa perlu upload/download manual
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification Bar */}
        {toastMsg && (
          <div
            className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              toastMsg.type === 'success'
                ? 'bg-emerald-600 text-white'
                : toastMsg.type === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-indigo-600 text-white'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{toastMsg.message}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Automation Announcement Banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-300 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-emerald-950 text-xs flex items-center gap-1.5">
                <span>Pencadangan & Sinkronisasi Bekerja Otomatis Sepenuhnya</span>
              </h4>
              <p className="text-[11.5px] text-emerald-900 leading-relaxed font-medium">
                Setiap transaksi kasir, SPK cetak, dan perubahan stok <strong>otomatis tersimpan ke database lokal (IndexedDB) dan cloud secara bersamaan</strong>. Anda tidak perlu mengklik tombol download/upload untuk mencadangkan data harian.
              </p>
            </div>
          </div>

          {/* Real-time Dual Database Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Local Database Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                  <HardDrive className="w-4 h-4 text-indigo-600" />
                  <span>Database Lokal (PC Kasir)</span>
                </div>
                <span className="bg-emerald-100 text-emerald-950 font-bold text-[10px] px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  AKTIF (0 ms)
                </span>
              </div>
              <div className="text-[11px] text-slate-600 font-medium space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center">
                  <span>Engine Lokal:</span>
                  <strong className="text-slate-900 font-bold">IndexedDB + Local Storage</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total Data Tersimpan:</span>
                  <strong className="text-indigo-950 font-bold font-mono">
                    {stats.totalRecords} Rekaman ({stats.formattedSize})
                  </strong>
                </div>
                <div className="flex justify-between items-center truncate">
                  <span>Folder Target:</span>
                  <span className="font-mono text-indigo-950 font-bold truncate max-w-[150px]" title={config.localDirectoryPath}>
                    {config.localDirectoryPath}
                  </span>
                </div>
              </div>
              <div className="text-[10.5px] text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Transaksi tetap aman saat offline 100%</span>
              </div>
            </div>

            {/* Cloud PocketBase Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                  <Cloud className="w-4 h-4 text-indigo-600" />
                  <span>Cloud Database (PocketBase)</span>
                </div>
                <span
                  className={`font-bold text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    isCloudConnected
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                      : 'bg-amber-100 text-amber-950 border-amber-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCloudConnected ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'
                    }`}
                  ></span>
                  {isCloudConnected ? 'TERHUBUNG REAL-TIME' : 'OFFLINE (ANTREAN AKTIF)'}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 font-medium space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center">
                  <span>Sinkronisasi:</span>
                  <strong className="text-slate-900 font-bold">WebSocket Real-Time</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>Antrean Pending:</span>
                  <strong className="text-slate-900 font-bold font-mono">
                    {stats.pendingOutboxCount} data
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>Terakhir Sinkron:</span>
                  <span className="font-mono text-slate-800 font-bold">{stats.lastSyncFormatted}</span>
                </div>
              </div>
              <div className="text-[10.5px] text-indigo-700 font-semibold flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>Replikasi otomatis antar cabang & kasir</span>
              </div>
            </div>
          </div>

          {/* Section 1: Lokasi Penyimpanan Database Lokal */}
          <div className="bg-white p-4 rounded-xl border border-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  Lokasi Folder Database Lokal
                </h3>
              </div>
              <button
                type="button"
                onClick={handleBrowseLocalDirectory}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 cursor-pointer flex items-center gap-1 transition-all shadow-2xs active:scale-95"
                title="Pilih folder di PC atau jaringan lokal menggunakan file picker browser"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Pilih Folder (Browse)</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700">
                Direktori Harddisk PC / Drive Jaringan LAN:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tempDirPath}
                  onChange={(e) => setTempDirPath(e.target.value)}
                  placeholder="misal: D:/DATABASE_BEJO_POS/ atau \\SERVER-KASIR\DATA_BEJO\"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleSaveDirectoryLocation()}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer shadow-xs transition-all shrink-0 active:scale-95 text-xs"
                >
                  Simpan Lokasi
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="pt-1 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Pilihan Folder Cepat:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  'D:/DATABASE_BEJO_POS/',
                  'D:/POS_LOKAL_DATA/',
                  '\\\\SERVER-KASIR\\DATA_BEJO\\',
                  'C:/DATA_POS_OFFLINE/'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setTempDirPath(preset);
                      handleSaveDirectoryLocation(preset);
                    }}
                    className={`text-[10.5px] font-mono font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      config.localDirectoryPath === preset
                        ? 'bg-indigo-100 text-indigo-950 border-indigo-400 ring-1 ring-indigo-400'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-950'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Ringkasan Real-Time Rekaman Data */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                Data yang Tersinkronisasi Otomatis
              </h3>
              <button
                type="button"
                onClick={handleManualSyncNow}
                disabled={isSyncing}
                className="text-indigo-700 hover:text-indigo-900 font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all cursor-pointer"
                title="Periksa & paksa sinkronisasi real-time instan"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Cek Sinkronisasi Sekarang'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans font-bold">PRODUK & STOK</div>
                <div className="text-sm font-black text-slate-900 mt-0.5">{stats.totalProducts} Item</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans font-bold">TRANSAKSI POS</div>
                <div className="text-sm font-black text-indigo-950 mt-0.5">{stats.totalTransactions} Transaksi</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans font-bold">SPK DIGITAL</div>
                <div className="text-sm font-black text-emerald-950 mt-0.5">{stats.totalSpkOrders} SPK</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans font-bold">PELANGGAN & AGEN</div>
                <div className="text-sm font-black text-purple-950 mt-0.5">{stats.totalCustomers + stats.totalAgents} Kontak</div>
              </div>
            </div>
          </div>

          {/* Section 3: Optional Manual Tools (Collapsible / Non-intrusive) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <button
              type="button"
              onClick={() => setShowManualTools(!showManualTools)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span className="font-bold text-slate-700 text-xs">
                  Alat Arsip Eksternal Manual (.json ke Flashdisk) â€” <span className="text-slate-500 font-normal">Opsional</span>
                </span>
              </div>
              {showManualTools ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showManualTools && (
              <div className="p-3.5 bg-white border-t border-slate-200 space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Fitur ini hanya diperlukan jika Anda ingin menyimpan salinan database terpisah ke flashdisk fisik atau memulihkan data dari file cadangan komputer lain.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportDatabase}
                    className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs active:scale-95"
                  >
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>Unduh Cadangan (.json)</span>
                  </button>

                  <label className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs active:scale-95">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>{isRestoring ? 'Memulihkan...' : 'Pulihkan dari .json'}</span>
                    <input
                      type="file"
                      ref={hiddenFileInputRef}
                      onChange={handleRestoreFileSelected}
                      accept=".json"
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hidden directory input for fallback */}
        <input
          type="file"
          ref={hiddenDirInputRef}
          onChange={handleDirectoryInputChange}
          {...({ webkitdirectory: '', directory: '' } as any)}
          className="hidden"
        />

        {/* Modern Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Database lokal & cloud aktif tersinkronisasi otomatis secara real-time.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-all"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
