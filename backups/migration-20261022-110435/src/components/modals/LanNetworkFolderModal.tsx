/**
 * Coded by Langgo Bramandityo (Tech Lead & Master Developer).
 * LAN Network Folder & Online Machine Detection Hub for Digital Printing SPK.
 * Allows DEVELOPER & SPK operators to access shared original file folders and
 * monitor online machines across the local LAN network in real-time.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  Wifi,
  Cpu,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Layers,
  FileCode,
  Globe,
  ExternalLink,
  Search,
  Monitor,
  Radio,
  FileText,
  X,
  Play,
  HardDrive
} from 'lucide-react';
import { MachineItem, SpkOrder, SpkPrintFileAttachment, UserRole } from '../../types';
import {
  formatUncNetworkPath,
  scanAllLanMachines,
  discoverSubnetNodes,
  pingLanMachine,
  copyUncPathWithCommand,
  LanScanResult
} from '../../utils/lanMachineDetector';
import {
  getStoredDefaultLocalDirectory,
  saveStoredDefaultLocalDirectory,
  formatBytes,
  getFileExtensionMeta,
  openOrDownloadPrintFile
} from '../../utils/localFileVault';

interface LanNetworkFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: UserRole;
  orders: SpkOrder[];
  machines: MachineItem[];
  onUpdateMachines?: (machines: MachineItem[]) => void;
  currentLanDir?: string;
  onLanDirChange?: (newDir: string) => void;
}

export const LanNetworkFolderModal: React.FC<LanNetworkFolderModalProps> = ({
  isOpen,
  onClose,
  userRole = 'SPK',
  orders,
  machines,
  onUpdateMachines,
  currentLanDir,
  onLanDirChange
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'machines' | 'settings'>('files');
  const [lanDir, setLanDir] = useState<string>(() => currentLanDir || getStoredDefaultLocalDirectory());
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<LanScanResult | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; isSuccess: boolean } | null>(null);
  const [discoveredSubnet, setDiscoveredSubnet] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, isSuccess: boolean = true) => {
    setToastMessage({ text, isSuccess });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Synchronize initial folder path
  useEffect(() => {
    if (currentLanDir) {
      setLanDir(currentLanDir);
    } else {
      setLanDir(getStoredDefaultLocalDirectory());
    }
  }, [currentLanDir, isOpen]);

  // Extract all print files across all SPK orders
  const allSpkFiles = useMemo(() => {
    const list: Array<{
      orderId: string;
      orderNumber: string;
      customerName: string;
      deadline?: string;
      status: string;
      file: SpkPrintFileAttachment;
      fullLanPath: string;
    }> = [];

    orders.forEach((o) => {
      const files: SpkPrintFileAttachment[] = [];
      if (o.printFiles && o.printFiles.length > 0) {
        files.push(...o.printFiles);
      } else if (o.printFile) {
        files.push(o.printFile);
      }

      // Check item-level print files
      o.items.forEach((it) => {
        if (it.printFiles && it.printFiles.length > 0) {
          it.printFiles.forEach((f) => {
            if (!files.some((existing) => existing.fileName === f.fileName)) {
              files.push(f);
            }
          });
        } else if (it.printFile) {
          if (!files.some((existing) => existing.fileName === it.printFile?.fileName)) {
            files.push(it.printFile);
          }
        }
      });

      files.forEach((f) => {
        const fullLanPath = f.localPath || formatUncNetworkPath(lanDir, f.fileName);
        list.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          deadline: o.deadlineDate ? `${o.deadlineDate} ${o.deadlineTime || ''}` : undefined,
          status: o.status,
          file: f,
          fullLanPath
        });
      });
    });

    return list.sort((a, b) => (b.file.uploadedAt || 0) - (a.file.uploadedAt || 0));
  }, [orders, lanDir]);

  const filteredFiles = useMemo(() => {
    if (!searchFilter.trim()) return allSpkFiles;
    const q = searchFilter.toLowerCase();
    return allSpkFiles.filter(
      (item) =>
        item.file.fileName.toLowerCase().includes(q) ||
        item.orderNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.fullLanPath.toLowerCase().includes(q)
    );
  }, [allSpkFiles, searchFilter]);

  // Handle LAN Machine scanning
  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const result = await scanAllLanMachines(machines, true);
      setScanResult(result);
      if (onUpdateMachines) {
        onUpdateMachines(result.machines);
      }
      showToast(`Scan selesai: ${result.onlineCount} mesin online di jaringan LAN (${result.averageLatencyMs}ms)!`, true);
    } catch (e: any) {
      showToast('Gagal memindai mesin di LAN: ' + (e.message || 'Error'), false);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Subnet Discovery
  const handleDiscoverSubnet = async () => {
    setIsDiscovering(true);
    try {
      const nodes = await discoverSubnetNodes('192.168.1');
      setDiscoveredSubnet(nodes);
      showToast(`Ditemukan ${nodes.length} node perangkat & controller di subnet 192.168.1.x`, true);
    } catch {
      showToast('Gagal menemukan node subnet', false);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleCopyPath = async (path: string) => {
    await copyUncPathWithCommand(path, (msg, ok) => {
      showToast(msg, ok);
    });
  };

  const handleOpenFile = async (file: SpkPrintFileAttachment) => {
    const ok = await openOrDownloadPrintFile(file);
    if (ok) {
      showToast(`Membuka berkas cetak asli: ${file.fileName}`, true);
    } else {
      if (file.localPath) {
        await handleCopyPath(file.localPath);
      } else {
        showToast('Berkas tidak ditemukan pada local storage, path folder disalin!', false);
      }
    }
  };

  const handleSaveDirectory = (newPath: string) => {
    const clean = formatUncNetworkPath(newPath);
    saveStoredDefaultLocalDirectory(clean);
    setLanDir(clean);
    if (onLanDirChange) onLanDirChange(clean);
    showToast(`Folder bersama LAN berhasil disimpan: ${clean}`, true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-wide">
                  LAN Network File Vault & Machine Detection
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LAN Connected
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Akses folder file asli SPK & pantau status mesin cetak/cutting online di jaringan lokal toko
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
              toastMessage.isSuccess
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                : 'bg-rose-950/80 text-rose-300 border-rose-700'
            }`}
          >
            {toastMessage.isSuccess ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                activeTab === 'files'
                  ? 'border-indigo-500 text-white bg-slate-800/60 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-4 h-4 text-indigo-400" />
              <span>Berkas Cetak Asli SPK ({allSpkFiles.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('machines')}
              className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                activeTab === 'machines'
                  ? 'border-emerald-500 text-white bg-slate-800/60 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span>Status Mesin Online di LAN ({machines.filter((m) => m.lanStatus === 'ONLINE').length}/{machines.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                activeTab === 'settings'
                  ? 'border-amber-500 text-white bg-slate-800/60 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>Konfigurasi Path Folder LAN</span>
            </button>
          </div>

          {activeTab === 'machines' && (
            <button
              type="button"
              onClick={handleTriggerScan}
              disabled={isScanning}
              className="mb-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Memindai LAN...' : 'Scan Mesin di LAN Sekarang'}</span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: BERKAS ASLI SPK DI JARINGAN LAN */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              {/* Quick Network Folder Bar */}
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-300">
                    <Folder className="w-4 h-4 text-indigo-400" />
                    <span>LOKASI FOLDER BERSAMA JARINGAN LAN (UNC PATH):</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-indigo-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 break-all select-all flex items-center justify-between gap-2">
                    <span>{lanDir}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPath(lanDir)}
                      className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-all shrink-0 cursor-pointer"
                      title="Salin path folder jaringan"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyPath(lanDir)}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Path UNC (Win+R)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl border border-slate-600 flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Ubah Folder</span>
                  </button>
                </div>
              </div>

              {/* Instructions banner */}
              <div className="bg-indigo-950/40 border border-indigo-700/50 p-3.5 rounded-xl text-xs text-indigo-200/90 flex items-start gap-2.5">
                <Monitor className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Cara Buka di Komputer Manapun di Jaringan LAN:</strong>
                  <span className="ml-1 text-indigo-200">
                    Tekan tombol <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-white font-mono text-[11px]">Win + R</kbd> pada keyboard komputer operator cetak/desainer, lalu tempel (Paste) path folder di atas dan tekan <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-white font-mono text-[11px]">Enter</kbd>. Folder file asli SPK akan langsung terbuka!
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cari nama berkas, nomor SPK, atau pelanggan..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-400 font-medium focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <span className="text-xs font-bold text-slate-400 shrink-0">
                  Menampilkan {filteredFiles.length} berkas
                </span>
              </div>

              {/* Files Table / List */}
              {filteredFiles.length === 0 ? (
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <Folder className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-300">Belum ada berkas cetak asli terlampir</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Saat SPK baru diterbitkan dengan file desain/cetak, file asli akan otomatis muncul di sini dan dapat diakses dari komputer manapun di jaringan LAN.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFiles.map((item, idx) => {
                    const extMeta = getFileExtensionMeta(item.file.fileName);
                    return (
                      <div
                        key={`${item.orderId}_${idx}`}
                        className="bg-slate-800/70 hover:bg-slate-800 p-3.5 rounded-xl border border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border shrink-0 ${extMeta.color}`}
                          >
                            {extMeta.ext}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-white truncate max-w-sm">
                                {item.file.fileName}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-700">
                                SPK #{item.orderNumber}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {item.customerName}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-3 flex-wrap">
                              <span>Ukuran: <strong className="text-slate-300">{formatBytes(item.file.fileSize)}</strong></span>
                              <span>Diunggah: <strong className="text-slate-300">{item.file.uploadedBy || 'Operator'}</strong></span>
                              <span className="truncate max-w-xs text-slate-500" title={item.fullLanPath}>
                                Path: {item.fullLanPath}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleCopyPath(item.fullLanPath)}
                            className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 flex items-center gap-1 cursor-pointer transition-all"
                            title="Salin path file lengkap di LAN"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin Path</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenFile(item.file)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                            title="Buka atau unduh file cetak asli"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Buka / Unduh File</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DETEKSI MESIN ONLINE DI JARINGAN LAN */}
          {activeTab === 'machines' && (
            <div className="space-y-5">
              {/* Radar Scanner Summary Header */}
              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-black text-white">
                      LAN Machine Heartbeat & Real-Time Prober
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Memantau koneksi socket TCP port 9100 / IPP / HTTP kontroler mesin cetak dan RIP spooler di jaringan lokal.
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-center px-2">
                    <div className="text-lg font-black text-emerald-400">
                      {machines.filter((m) => m.lanStatus === 'ONLINE').length}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Online</div>
                  </div>
                  <div className="h-7 w-px bg-slate-800"></div>
                  <div className="text-center px-2">
                    <div className="text-lg font-black text-amber-400">
                      {machines.filter((m) => m.status === 'UNDER_MAINTENANCE' || m.lanStatus === 'STANDBY').length}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Maintenance</div>
                  </div>
                  <div className="h-7 w-px bg-slate-800"></div>
                  <div className="text-center px-2">
                    <div className="text-lg font-black text-indigo-400">
                      {scanResult?.averageLatencyMs || 8} ms
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Avg Latency</div>
                  </div>
                </div>
              </div>

              {/* Machine Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {machines.map((m) => {
                  const isOnline = m.lanStatus === 'ONLINE' || m.status === 'READY';
                  const isMaintenance = m.status === 'UNDER_MAINTENANCE';
                  const latency = m.pingLatencyMs || 8;

                  return (
                    <div
                      key={m.id}
                      className={`p-4.5 rounded-2xl border-2 transition-all ${
                        isMaintenance
                          ? 'bg-amber-950/20 border-amber-600/40'
                          : isOnline
                          ? 'bg-slate-800/90 border-emerald-500/40 shadow-lg'
                          : 'bg-slate-800/40 border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                              {m.category}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              IP: {m.ipAddress || '192.168.1.100'}:{m.port || 9100}
                            </span>
                          </div>
                          <h4 className="font-black text-sm text-white mt-1.5">{m.name}</h4>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{m.typeDescription}</p>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {isMaintenance ? (
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                              MAINTENANCE
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              ONLINE ({latency}ms)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Technical Specs & Software */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs space-y-1">
                        {m.ripSoftware && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">RIP Software:</span>
                            <span className="font-bold text-indigo-300">{m.ripSoftware}</span>
                          </div>
                        )}
                        {m.speed && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Kecepatan Cetak:</span>
                            <span className="font-bold text-slate-200">{m.speed}</span>
                          </div>
                        )}
                        {m.headSpec && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Printhead / Optik:</span>
                            <span className="font-bold text-slate-200">{m.headSpec}</span>
                          </div>
                        )}
                        {m.operatorDefault && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Operator Standby:</span>
                            <span className="font-bold text-slate-200">{m.operatorDefault}</span>
                          </div>
                        )}
                      </div>

                      {/* Shared RIP Hotfolder */}
                      {m.sharedFolderLanPath && (
                        <div className="mt-2.5 text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                          <span className="truncate" title={m.sharedFolderLanPath}>
                            Hotfolder: {m.sharedFolderLanPath}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPath(m.sharedFolderLanPath!)}
                            className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded transition-all shrink-0 cursor-pointer"
                            title="Salin path hotfolder RIP"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyPath(m.sharedFolderLanPath || `\\\\${m.ipAddress || '192.168.1.100'}\\Hotfolder\\`)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Buka Hotfolder Mesin</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            showToast(`Mengirim probe ping ke ${m.name} (${m.ipAddress || '192.168.1.100'})...`, true);
                            const res = await pingLanMachine(m);
                            showToast(`Respon ${m.name}: ${res.status} (${res.latencyMs}ms)`, true);
                          }}
                          className="px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-bold rounded-lg border border-indigo-500/40 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Test Ping</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subnet Auto-Discovery section */}
              <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      Auto-Discovery Subnet Scanner (192.168.1.x)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Pindai subnet lokal untuk menemukan controller mesin cetak, RIP station, atau cutting plotter baru secara otomatis.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDiscoverSubnet}
                    disabled={isDiscovering}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 shrink-0"
                  >
                    <Search className={`w-3.5 h-3.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                    <span>{isDiscovering ? 'Scanning Subnet...' : 'Pindai Subnet LAN'}</span>
                  </button>
                </div>

                {discoveredSubnet.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
                    {discoveredSubnet.map((node, i) => (
                      <div key={i} className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-emerald-400">{node.ipAddress}:{node.port}</span>
                          <span className="text-slate-400">{node.latencyMs}ms</span>
                        </div>
                        <div className="font-bold text-white text-[11.5px]">{node.suggestedName}</div>
                        <div className="text-[10.5px] text-indigo-300">{node.ripSoftware}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: KONFIGURASI FOLDER BERSAMA LAN */}
          {activeTab === 'settings' && (
            <div className="space-y-5 max-w-2xl">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white">
                  Pengaturan Folder Penyimpanan Bersama di Jaringan LAN
                </h3>
                <p className="text-xs text-slate-400">
                  Folder ini digunakan bersama oleh semua komputer kasir, designer prepress, dan operator mesin cetak untuk menyimpan dan membuka berkas asli SPK.
                </p>
              </div>

              {/* Form Input */}
              <div className="space-y-3 bg-slate-800/80 p-5 rounded-2xl border border-slate-700">
                <label className="block text-xs font-bold text-slate-300">
                  Path Folder Jaringan / Shared Network Drive (UNC Path):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lanDir}
                    onChange={(e) => setLanDir(e.target.value)}
                    placeholder="Contoh: \\192.168.1.100\DATA_CETAK_BEJO\ atau D:/DATA_CETAK/"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-indigo-300 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveDirectory(lanDir)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    Simpan Path
                  </button>
                </div>

                {/* Preset Options */}
                <div className="pt-3 border-t border-slate-700/80 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Pilihan Preset Folder Cepat:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { name: 'Server Kasir Utama', path: '\\\\192.168.1.100\\DATA_CETAK_BEJO\\' },
                      { name: 'Server RIP Mesin Cetak', path: '\\\\192.168.1.101\\HOTFOLDER_KONICA\\' },
                      { name: 'Komputer Desain Prepress', path: '\\\\192.168.1.50\\DESAIN_SPK\\' },
                      { name: 'Lokal Harddisk Drive D:', path: 'D:/DATA_CETAK_BEJO/' }
                    ].map((preset) => (
                      <button
                        key={preset.path}
                        type="button"
                        onClick={() => handleSaveDirectory(preset.path)}
                        className="p-2.5 bg-slate-900 hover:bg-slate-700/60 rounded-xl border border-slate-800 text-left transition-all cursor-pointer group"
                      >
                        <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                          {preset.name}
                        </div>
                        <div className="text-[10.5px] font-mono text-slate-400 truncate">
                          {preset.path}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-800/90 border-t border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hak Akses: Khusus role <strong className="text-indigo-300">DEVELOPER</strong> (Master Tech Lead)</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
