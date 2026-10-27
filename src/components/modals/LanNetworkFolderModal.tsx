/**
 * Coded by Langgo Bramandityo (Tech Lead & Master Developer).
 * LAN Network Folder & Online Machine Detection Hub for Digital Printing SPK.
 * Folder bersama dibaca langsung lewat File System Access API, jadi isi yang
 * ditampilkan adalah berkas yang benar-benar ada di folder, bukan tebakan path.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  Wifi,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Globe,
  ExternalLink,
  Search,
  Monitor,
  Radio,
  ShieldCheck,
  X,
  HardDrive,
  Link2,
  Unlink
} from 'lucide-react';
import { MachineItem, SpkOrder, SpkPrintFileAttachment, UserRole } from '../../types';
import {
  scanAllLanMachines,
  discoverSubnetNodes,
  pingLanMachine,
  copyUncPathWithCommand,
  LanScanResult
} from '../../utils/lanMachineDetector';
import { formatBytes, getFileExtensionMeta, openOrDownloadPrintFile } from '../../utils/localFileVault';
import {
  forgetSharedFolderGrant,
  getSharedFolderGrantStatus,
  isSharedFolderApiSupported,
  listSharedFolderFiles,
  openFileFromSharedFolder,
  pickSharedFolder,
  requestSharedFolderPermission,
  verifySharedFolderFile,
  type SharedFolderFileEntry,
  type SharedFolderGrantStatus
} from '../../utils/sharedFolderAccess';

interface LanNetworkFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: UserRole;
  orders: SpkOrder[];
  machines: MachineItem[];
  onUpdateMachines?: (machines: MachineItem[]) => void;
  currentLanDir?: string;
  /** Tab yang dibuka saat modal muncul (dari tombol pintasan di header SPK). */
  initialTab?: 'files' | 'machines' | 'settings';
  onLanDirChange?: (newDir: string) => void | Promise<void>;
  /** Salin lampiran SPK ke folder bersama lalu simpan statusnya ke order. */
  onCopyToFolder?: (orderId: string, attachment: SpkPrintFileAttachment) => void | Promise<void>;
}

export const LanNetworkFolderModal: React.FC<LanNetworkFolderModalProps> = ({
  isOpen,
  onClose,
  orders,
  machines,
  onUpdateMachines,
  currentLanDir,
  initialTab = 'files',
  onLanDirChange,
  onCopyToFolder
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'machines' | 'settings'>(initialTab);
  const [lanDir, setLanDir] = useState<string>(currentLanDir || '');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<LanScanResult | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; isSuccess: boolean } | null>(null);
  const [discoveredSubnet, setDiscoveredSubnet] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [grantStatus, setGrantStatus] = useState<SharedFolderGrantStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [folderFiles, setFolderFiles] = useState<SharedFolderFileEntry[]>([]);
  const [folderError, setFolderError] = useState('');
  const [folderLoadedAt, setFolderLoadedAt] = useState(0);
  const [showFolderContents, setShowFolderContents] = useState(false);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, isSuccess: boolean = true) => {
    setToastMessage({ text, isSuccess });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const refreshGrant = useCallback(async () => {
    setGrantStatus(await getSharedFolderGrantStatus());
  }, []);

  const loadFolderFiles = useCallback(async () => {
    setIsBusy(true);
    try {
      const res = await listSharedFolderFiles();
      setFolderFiles(res.entries);
      setFolderError(res.error || '');
      setFolderLoadedAt(Date.now());
      if (res.error) showToast(res.error, false);
    } finally {
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setLanDir(currentLanDir || '');
    refreshGrant();
  }, [isOpen, currentLanDir, initialTab, refreshGrant]);

  useEffect(() => {
    if (!isOpen) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshGrant();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isOpen, refreshGrant]);

  useEffect(() => {
    if (activeTab === 'files' && grantStatus?.granted && folderFiles.length === 0 && !folderError) {
      loadFolderFiles();
    }
  }, [activeTab, grantStatus, folderFiles.length, folderError, loadFolderFiles]);

  /** Nama berkas yang benar-benar ada di folder bersama, untuk pencocokan jujur. */
  const folderIndex = useMemo(() => {
    const map = new Map<string, SharedFolderFileEntry>();
    folderFiles.forEach((f) => map.set(f.name.toLowerCase(), f));
    return map;
  }, [folderFiles]);

  // Extract all print files across all SPK orders
  const allSpkFiles = useMemo(() => {
    const list: Array<{
      orderId: string;
      orderNumber: string;
      customerName: string;
      deadline?: string;
      status: string;
      file: SpkPrintFileAttachment;
      displayPath: string;
      inFolder: SharedFolderFileEntry | undefined;
    }> = [];

    orders.forEach((o) => {
      const files: SpkPrintFileAttachment[] = [];
      if (o.printFiles && o.printFiles.length > 0) {
        files.push(...o.printFiles);
      } else if (o.printFile) {
        files.push(o.printFile);
      }

      o.items.forEach((it) => {
        if (it.printFiles && it.printFiles.length > 0) {
          it.printFiles.forEach((f) => {
            if (!files.some((existing) => existing.fileName === f.fileName)) files.push(f);
          });
        } else if (it.printFile) {
          if (!files.some((existing) => existing.fileName === it.printFile?.fileName)) {
            files.push(it.printFile);
          }
        }
      });

      files.forEach((f) => {
        const entry = folderIndex.get(f.fileName.toLowerCase());
        const displayPath = f.localPath || (lanDir ? `${lanDir}${f.fileName}` : '');
        list.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          deadline: o.deadlineDate ? `${o.deadlineDate} ${o.deadlineTime || ''}` : undefined,
          status: o.status,
          file: f,
          displayPath,
          inFolder: entry
        });
      });
    });

    return list.sort((a, b) => (b.file.uploadedAt || 0) - (a.file.uploadedAt || 0));
  }, [orders, lanDir, folderIndex]);

  const filteredFiles = useMemo(() => {
    if (!searchFilter.trim()) return allSpkFiles;
    const q = searchFilter.toLowerCase();
    return allSpkFiles.filter(
      (item) =>
        item.file.fileName.toLowerCase().includes(q) ||
        item.orderNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q)
    );
  }, [allSpkFiles, searchFilter]);

  const filteredFolderFiles = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return folderFiles;
    return folderFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [folderFiles, searchFilter]);

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const result = await scanAllLanMachines(machines, true);
      setScanResult(result);
      onUpdateMachines?.(result.machines);
      showToast(`Scan selesai: ${result.onlineCount} mesin merespons (${result.averageLatencyMs}ms rata-rata).`, true);
    } catch (e: any) {
      showToast('Gagal memindai mesin di LAN: ' + (e.message || 'Error'), false);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDiscoverSubnet = async () => {
    setIsDiscovering(true);
    try {
      const nodes = await discoverSubnetNodes('192.168.1');
      setDiscoveredSubnet(nodes);
      showToast(`Ditemukan ${nodes.length} node pada rentang subnet yang dipindai.`, true);
    } catch {
      showToast('Gagal menemukan node subnet', false);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleCopyPath = async (path: string) => {
    if (!path) {
      showToast('Belum ada path untuk disalin.', false);
      return;
    }
    await copyUncPathWithCommand(path, (msg, ok) => showToast(msg, ok));
  };

  const handlePickFolder = async () => {
    if (!isSharedFolderApiSupported()) {
      if (directoryInputRef.current) directoryInputRef.current.click();
      return;
    }
    setIsBusy(true);
    try {
      const res = await pickSharedFolder();
      showToast(res.message, res.ok);
      await refreshGrant();
      if (res.ok) await loadFolderFiles();
    } finally {
      setIsBusy(false);
    }
  };

  const handleAskPermission = async () => {
    setIsBusy(true);
    try {
      const res = await requestSharedFolderPermission();
      showToast(res.message, res.ok);
      await refreshGrant();
      if (res.ok) await loadFolderFiles();
    } finally {
      setIsBusy(false);
    }
  };

  const handleForgetGrant = async () => {
    await forgetSharedFolderGrant();
    setFolderFiles([]);
    setFolderError('');
    await refreshGrant();
    showToast('Akses folder dilepas dari browser ini.', true);
  };

  /**
   * Fallback browser tanpa File System Access API: dialog ini hanya membaca daftar
   * isi folder, jadi yang dipakai nama folder saja dan tidak ada path palsu disimpan.
   */
  const handleDirectoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const relPath = (files[0] as any).webkitRelativePath || '';
      const rootFolder = relPath.split('/')[0] || files[0].name;
      if (!lanDir) setLanDir(`${rootFolder}/`);
      showToast(
        `Folder "${rootFolder}" terbaca, tetapi browser ini tidak dapat memberi izin tulis. Gunakan Chrome/Edge lalu klik "Hubungkan Folder di Perangkat Ini".`,
        false
      );
    }
    e.target.value = '';
  };

  const handleOpenFromFolder = async (attachment: SpkPrintFileAttachment) => {
    const res = await openFileFromSharedFolder(attachment);
    if (res.ok) {
      showToast(res.message, true);
      return;
    }
    const fallback = await openOrDownloadPrintFile(attachment);
    showToast(fallback ? res.message + ' Berkas dibuka dari vault perangkat ini.' : res.message, fallback);
  };

  const handleVerify = async (attachment: SpkPrintFileAttachment) => {
    const res = await verifySharedFolderFile(attachment);
    showToast(res.message, res.state === 'ok');
    if (res.state !== 'no-access') loadFolderFiles();
  };

  const handleSaveDirectory = (rawPath: string) => {
    const trimmed = rawPath.trim();
    if (!trimmed) {
      showToast('Isi dulu path folder bersama.', false);
      return;
    }
    setLanDir(trimmed);
    Promise.resolve(onLanDirChange?.(trimmed)).then(() => refreshGrant());
  };

  if (!isOpen) return null;

  const isUncPath = lanDir.startsWith('\\\\');
  const grantTone = !grantStatus?.supported
    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    : grantStatus.granted && !grantStatus.needsPermission
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  const grantLabel = !grantStatus
    ? 'Memeriksa...'
    : !grantStatus.supported
      ? 'Browser Tidak Dukung Folder'
      : grantStatus.granted && !grantStatus.needsPermission
        ? `Folder "${grantStatus.folderName}" Tersambung`
        : grantStatus.needsPermission
          ? 'Izin Folder Perlu Dikonfirmasi'
          : 'Folder Belum Dihubungkan';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white tracking-wide">
                  Folder Bersama Berkas SPK & Mesin LAN
                </h2>
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border flex items-center gap-1 ${grantTone}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  {grantLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium truncate">
                Semua komputer di toko memakai folder yang sama, jadi berkas yang dibuka operator adalah berkas asli yang sama.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer shrink-0"
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
              <span>Mesin LAN ({machines.filter((m) => m.lanStatus === 'ONLINE').length}/{machines.length})</span>
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
              <span>Lokasi Folder Bersama</span>
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
          {/* TAB 1: BERKAS ASLI SPK DI FOLDER BERSAMA */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              {/* Lokasi folder & izin akses perangkat ini */}
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-300">
                  <Folder className="w-4 h-4 text-indigo-400" />
                  <span>LOKASI FOLDER BERSAMA (SAMA UNTUK SEMUA USER)</span>
                </div>
                <div className="text-xs font-mono font-bold text-indigo-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 break-all select-all flex items-center justify-between gap-2">
                  <span>{lanDir || 'Belum disetel — klik "Ubah Lokasi".'}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyPath(lanDir)}
                    className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-all shrink-0 cursor-pointer"
                    title="Salin path folder"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className={`text-[11px] font-bold rounded-lg border px-3 py-2 ${grantTone}`}>
                  {grantStatus?.message || 'Memeriksa izin folder pada browser ini...'}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePickFolder}
                    disabled={isBusy}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Hubungkan Folder di Perangkat Ini</span>
                  </button>
                  {grantStatus?.needsPermission && (
                    <button
                      type="button"
                      onClick={handleAskPermission}
                      disabled={isBusy}
                      className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Izinkan Akses</span>
                    </button>
                  )}
                  {grantStatus?.granted && (
                    <>
                      <button
                        type="button"
                        onClick={loadFolderFiles}
                        disabled={isBusy}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl border border-slate-600 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                        <span>Muat Isi Folder</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleForgetGrant}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Lepas Akses</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl border border-slate-600 flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Ubah Lokasi</span>
                  </button>
                  {isUncPath && (
                    <button
                      type="button"
                      onClick={() => handleCopyPath(lanDir)}
                      className="px-3 py-2 bg-slate-700/60 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-xl border border-slate-600/80 flex items-center gap-1.5 cursor-pointer transition-all"
                      title="Salin path lalu tempel di dialog Win + R"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin untuk Win + R</span>
                    </button>
                  )}
                </div>

                {/* Input cadangan untuk browser tanpa File System Access API */}
                <input
                  ref={directoryInputRef}
                  type="file"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  multiple
                  className="hidden"
                  onChange={handleDirectoryInputChange}
                />
              </div>

              {/* Instructions banner */}
              <div className="bg-indigo-950/40 border border-indigo-700/50 p-3.5 rounded-xl text-xs text-indigo-200/90 flex items-start gap-2.5">
                <Monitor className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Cara kerjanya:</strong>
                  <span className="ml-1 text-indigo-200">
                    Lokasi folder disimpan di server dan otomatis mengikuti ke semua komputer. Izin baca-tulis folder bersifat per
                    browser, jadi setiap komputer cukup menekan "Hubungkan Folder" satu kali, lalu semua berkas SPK dapat dibuka dari
                    folder yang sama.
                    {isUncPath && (
                      <>
                        {' '}Untuk membukanya di Windows: tekan{' '}
                        <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-white font-mono text-[11px]">Win + R</kbd>,
                        tempel path di atas, tekan{' '}
                        <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-white font-mono text-[11px]">Enter</kbd>.
                      </>
                    )}
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
                <button
                  type="button"
                  onClick={() => setShowFolderContents((v) => !v)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{showFolderContents ? 'Tampilkan SPK' : `Isi Folder (${folderFiles.length})`}</span>
                </button>
              </div>

              {/* Isi folder yang sebenarnya */}
              {showFolderContents && (
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>
                      {folderError
                        ? folderError
                        : grantStatus?.granted
                          ? `${filteredFolderFiles.length} berkas terbaca dari folder bersama`
                          : 'Hubungkan folder di perangkat ini untuk membaca isinya.'}
                    </span>
                    <span>{folderLoadedAt ? `Diperbarui ${new Date(folderLoadedAt).toLocaleTimeString('id-ID')}` : ''}</span>
                  </div>
                  {filteredFolderFiles.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">Tidak ada berkas yang cocok di folder bersama.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {filteredFolderFiles.map((f) => {
                        const extMeta = getFileExtensionMeta(f.name);
                        return (
                          <div key={f.name} className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase border shrink-0 ${extMeta.color}`}>
                              {extMeta.ext}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold text-white truncate" title={f.name}>
                                {f.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {formatBytes(f.size)}
                                {f.modifiedMs ? ` • ${new Date(f.modifiedMs).toLocaleString('id-ID')}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyPath(lanDir ? `${lanDir}${f.name}` : f.name)}
                              className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded cursor-pointer shrink-0"
                              title="Salin path berkas"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Files Table / List */}
              {!showFolderContents && (filteredFiles.length === 0 ? (
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <Folder className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-300">Belum ada berkas cetak asli terlampir</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Saat SPK diterbitkan dengan file desain/cetak, file asli muncul di sini dan bisa diakses dari komputer manapun
                    yang sudah menghubungkan folder bersama.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFiles.map((item, idx) => {
                    const extMeta = getFileExtensionMeta(item.file.fileName);
                    const inFolder = Boolean(item.inFolder);
                    const sizeMatches =
                      inFolder && typeof item.file.fileSize === 'number' && item.inFolder!.size === item.file.fileSize;
                    return (
                      <div
                        key={`${item.orderId}_${idx}`}
                        className="bg-slate-800/70 hover:bg-slate-800 p-3.5 rounded-xl border border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border shrink-0 ${extMeta.color}`}>
                            {extMeta.ext}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-white truncate max-w-sm">{item.file.fileName}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-700">
                                SPK #{item.orderNumber}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">{item.customerName}</span>
                              {inFolder && sizeMatches ? (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  ADA DI FOLDER
                                </span>
                              ) : inFolder ? (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  NAMA COCOK, UKURAN BEDA
                                </span>
                              ) : (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">
                                  {grantStatus?.granted ? 'TIDAK ADA DI FOLDER' : 'CEK PERLU IZIN FOLDER'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-3 flex-wrap">
                              <span>
                                Ukuran: <strong className="text-slate-300">{formatBytes(item.file.fileSize)}</strong>
                              </span>
                              <span>
                                Diunggah: <strong className="text-slate-300">{item.file.uploadedBy || 'Operator'}</strong>
                              </span>
                              {item.displayPath && (
                                <span className="truncate max-w-xs text-slate-500" title={item.displayPath}>
                                  Path: {item.displayPath}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 sm:self-center flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={() => handleVerify(item.file)}
                            className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 flex items-center gap-1 cursor-pointer transition-all"
                            title="Cek keberadaan berkas di folder bersama"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Cek</span>
                          </button>
                          {item.displayPath && (
                            <button
                              type="button"
                              onClick={() => handleCopyPath(item.displayPath)}
                              className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 flex items-center gap-1 cursor-pointer transition-all"
                              title="Salin path berkas"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Path</span>
                            </button>
                          )}
                          {inFolder || item.file.sharedCopy ? (
                            <button
                              type="button"
                              onClick={() => handleOpenFromFolder(item.file)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                              title="Buka berkas asli dari folder bersama"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Buka dari Folder LAN</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onCopyToFolder?.(item.orderId, item.file)}
                              disabled={!onCopyToFolder}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Salin berkas dari vault perangkat ini ke folder bersama"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Salin ke Folder LAN</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: DETEKSI MESIN ONLINE DI JARINGAN LAN */}
          {activeTab === 'machines' && (
            <div className="space-y-5">
              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-black text-white">LAN Machine Heartbeat & Real-Time Prober</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Memantau respons kontroler mesin cetak dan RIP spooler di jaringan lokal.
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
                    <div className="text-lg font-black text-indigo-400">{scanResult?.averageLatencyMs ? `${scanResult.averageLatencyMs} ms` : '-'}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Avg Latency</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {machines.map((m) => {
                  const isOnline = m.lanStatus === 'ONLINE' || m.status === 'READY';
                  const isMaintenance = m.status === 'UNDER_MAINTENANCE';
                  const hasIp = Boolean(m.ipAddress);

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
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                              {m.category}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {hasIp ? `IP: ${m.ipAddress}:${m.port || 9100}` : 'IP belum disetel'}
                            </span>
                          </div>
                          <h4 className="font-black text-sm text-white mt-1.5">{m.name}</h4>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{m.typeDescription}</p>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {isMaintenance ? (
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                              MAINTENANCE
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full bg-emerald-400 ${isOnline ? 'animate-pulse' : ''}`}></span>
                              {m.lanStatus === 'ONLINE' ? `ONLINE (${m.pingLatencyMs ?? '-'}ms)` : 'BELUM DICEK'}
                            </span>
                          )}
                        </div>
                      </div>

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

                      <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                        {m.sharedFolderLanPath ? (
                          <button
                            type="button"
                            onClick={() => handleCopyPath(m.sharedFolderLanPath!)}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Salin Hotfolder Mesin</span>
                          </button>
                        ) : hasIp ? (
                          <span className="text-[11px] text-slate-500 font-medium">
                            Hotfolder mesin ini belum diisi. Isi path share RIP-nya di tab Mesin SPK.
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-bold">Setel IP mesin di tab Mesin SPK.</span>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            if (!hasIp) {
                              showToast(`${m.name} belum punya alamat IP, tidak dapat dipindai.`, false);
                              return;
                            }
                            showToast(`Mengirim probe ke ${m.name} (${m.ipAddress})...`, true);
                            const res = await pingLanMachine(m);
                            showToast(`Respon ${m.name}: ${res.status} (${res.latencyMs}ms)`, res.status === 'ONLINE');
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

              <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      Auto-Discovery Subnet Scanner (192.168.1.x)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Pindai subnet lokal untuk menemukan controller mesin cetak, RIP station, atau cutting plotter baru.
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
                          <span className="text-emerald-400">
                            {node.ipAddress}:{node.port}
                          </span>
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

          {/* TAB 3: LOKASI FOLDER BERSAMA */}
          {activeTab === 'settings' && (
            <div className="space-y-5 max-w-2xl">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white">
                  Pengaturan Folder Penyimpanan Bersama di Jaringan LAN
                </h3>
                <p className="text-xs text-slate-400">
                  Lokasi ini dipakai bersama oleh kasir, desainer prepress, dan operator cetak. Menyimpannya di sini akan
                  memperbaruinya di semua komputer yang sedang membuka aplikasi.
                </p>
              </div>

              <div className="space-y-3 bg-slate-800/80 p-5 rounded-2xl border border-slate-700">
                <label className="block text-xs font-bold text-slate-300">
                  Path Folder Jaringan (UNC) atau Folder Lokal yang DISHARE:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lanDir}
                    onChange={(e) => setLanDir(e.target.value)}
                    placeholder="Contoh: \\\\SERVER\\DATA_CETAK\\ atau D:/DATA_CETAK/"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-indigo-300 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveDirectory(lanDir)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    Simpan Lokasi
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Selalu akhiri dengan <span className="font-mono text-indigo-300">\</span> atau{' '}
                  <span className="font-mono text-indigo-300">/</span> supaya nama berkas menempel dengan benar. Path ini hanya
                  teks penunjuk: setiap komputer tetap harus menekan "Hubungkan Folder di Perangkat Ini" satu kali agar browser
                  boleh membaca dan menulis isinya.
                </p>

                <div className="pt-3 border-t border-slate-700/80 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contoh format penulisan:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { name: 'Share di server toko', path: '\\\\SERVER-TOKO\\DATA_CETAK\\' },
                      { name: 'Share lewat IP', path: '\\\\192.168.1.10\\SPK\\' },
                      { name: 'Folder lokal yang dishare', path: 'D:/DATA_CETAK/' },
                      { name: 'Hotfolder mesin RIP', path: '\\\\RIP-01\\HOTFOLDER\\' }
                    ].map((preset) => (
                      <button
                        key={preset.path}
                        type="button"
                        onClick={() => setLanDir(preset.path)}
                        className="p-2.5 bg-slate-900 hover:bg-slate-700/60 rounded-xl border border-slate-800 text-left transition-all cursor-pointer group"
                        title="Klik untuk mengisi kolom, lalu tekan Simpan Lokasi"
                      >
                        <div className="text-xs font-bold text-white group-hover:text-indigo-300">{preset.name}</div>
                        <div className="text-[10.5px] font-mono text-slate-400 truncate">{preset.path}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-800/90 border-t border-slate-700/80 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Folder bersama aktif di browser ini:{' '}
              <strong className={grantStatus?.granted ? 'text-emerald-300' : 'text-amber-300'}>
                {grantStatus?.granted ? grantStatus.folderName : 'belum terhubung'}
              </strong>
            </span>
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
