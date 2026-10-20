/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 * Google Drive Image URL Converter Module (Khusus Akun DEVELOPER)
 * Ditambahkan fitur Terapkan Pada Produk Katalog secara langsung.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Link2,
  Copy,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
  ShieldAlert,
  PackageCheck,
  Search,
  X,
  Check,
  Tag,
  Filter,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Product } from '../types';
import { formatRupiah } from '../utils/formatters';
import { getStoredProducts, saveStoredProducts } from '../utils/storage';
import { saveProductCloud } from '../firebase';

export interface GoogleDriveUrlConverterProps {
  products?: Product[];
  onSaveProduct?: (product: Product) => void;
}

export const GoogleDriveUrlConverter: React.FC<GoogleDriveUrlConverterProps> = ({
  products: propProducts,
  onSaveProduct
}) => {
  const [driveUrl, setDriveUrl] = useState('');
  const [format, setFormat] = useState<'direct' | 'thumbnail'>('direct');
  const [size, setSize] = useState<'500' | '1000' | '2000'>('1000');

  const [convertedUrl, setConvertedUrl] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Preview state
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [copied, setCopied] = useState(false);

  // Apply to Product modal states
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedImageFilter, setSelectedImageFilter] = useState<'ALL' | 'NO_IMAGE' | 'HAS_IMAGE'>('ALL');
  const [appliedSuccessProductId, setAppliedSuccessProductId] = useState<string | null>(null);
  const [appliedSuccessToast, setAppliedSuccessToast] = useState<string | null>(null);

  // Local fallback products state
  const [fallbackProducts, setFallbackProducts] = useState<Product[]>(() => {
    return propProducts && propProducts.length > 0 ? propProducts : getStoredProducts();
  });

  // Keep fallbackProducts updated when propProducts changes
  useEffect(() => {
    if (propProducts && propProducts.length > 0) {
      setFallbackProducts(propProducts);
    }
  }, [propProducts]);

  // Current active products source
  const activeProducts = useMemo(() => {
    if (propProducts && propProducts.length > 0) {
      return propProducts;
    }
    return fallbackProducts;
  }, [propProducts, fallbackProducts]);

  // Available unique categories for filtering
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    activeProducts.forEach((p) => {
      if (p.category) {
        set.add(String(p.category));
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeProducts]);

  // Filtered products list for modal search
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();

    return activeProducts.filter((product) => {
      // Category filter
      if (selectedCategoryFilter !== 'ALL' && String(product.category) !== selectedCategoryFilter) {
        return false;
      }

      // Image presence filter
      const hasImage = Boolean(product.imageUrl && product.imageUrl.trim() !== '');
      if (selectedImageFilter === 'NO_IMAGE' && hasImage) return false;
      if (selectedImageFilter === 'HAS_IMAGE' && !hasImage) return false;

      // Text query match
      if (!q) return true;

      const nameMatch = (product.name || '').toLowerCase().includes(q);
      const codeMatch = (product.code || '').toLowerCase().includes(q);
      const catMatch = String(product.category || '').toLowerCase().includes(q);

      return nameMatch || codeMatch || catMatch;
    });
  }, [activeProducts, productSearch, selectedCategoryFilter, selectedImageFilter]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isApplyModalOpen) {
        setIsApplyModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isApplyModalOpen]);

  /**
   * Mengekstrak ID dari URL file Google Drive.
   * Mendukung:
   * - /file/d/FILE_ID/view
   * - /open?id=FILE_ID
   * - /uc?id=FILE_ID
   * - /thumbnail?id=FILE_ID
   * - /document/d/FILE_ID/edit
   * - /spreadsheets/d/FILE_ID/edit
   * - /presentation/d/FILE_ID/edit
   * - /forms/d/FILE_ID/edit
   *
   * Folder sengaja tidak didukung karena folder bukan file gambar.
   */
  const extractDriveFileId = (rawUrl: string): string => {
    let url: URL;

    try {
      url = new URL(rawUrl.trim());
    } catch {
      throw new Error('Format URL tidak valid.');
    }

    const allowedHosts = [
      'drive.google.com',
      'docs.google.com'
    ];

    if (!allowedHosts.includes(url.hostname.toLowerCase())) {
      throw new Error(
        'URL harus berasal dari drive.google.com atau docs.google.com.'
      );
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Protokol URL tidak didukung.');
    }

    const path = url.pathname;

    // URL file: /file/d/ID/view
    // Termasuk format /document/d/ID/edit.
    const pathMatch = path.match(
      /^\/(?:file|document|spreadsheets|presentation|forms)\/d\/([A-Za-z0-9_-]+)(?:\/|$)/
    );

    if (pathMatch) {
      return pathMatch[1];
    }

    // URL seperti /open?id=ID, /uc?id=ID,
    // atau /thumbnail?id=ID.
    const endpointMatch = path.match(
      /^\/(?:open|uc|thumbnail)\/?$/
    );

    if (endpointMatch) {
      const id = url.searchParams.get('id');

      if (id && /^[A-Za-z0-9_-]+$/.test(id)) {
        return id;
      }
    }

    throw new Error(
      'ID file tidak ditemukan. Pastikan URL mengarah ke file, bukan folder.'
    );
  };

  // Membuat URL keluaran berdasarkan format yang dipilih.
  const convertDriveUrl = (fileId: string, fmt: 'direct' | 'thumbnail', sz: string): string => {
    if (fmt === 'thumbnail') {
      return (
        'https://drive.google.com/thumbnail?id=' +
        encodeURIComponent(fileId) +
        '&sz=w' +
        encodeURIComponent(sz)
      );
    }

    return (
      'https://drive.google.com/uc?export=view&id=' +
      encodeURIComponent(fileId)
    );
  };

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault();
    setConvertedUrl('');
    setMessage(null);
    setCopied(false);
    setAppliedSuccessToast(null);

    if (!driveUrl.trim()) {
      setMessage({ text: 'Silakan masukkan URL Google Drive terlebih dahulu.', type: 'error' });
      return;
    }

    try {
      const fileId = extractDriveFileId(driveUrl);
      const result = convertDriveUrl(fileId, format, size);

      setConvertedUrl(result);
      setPreviewStatus('loading');
      setMessage({
        text: 'URL berhasil dikonversi. Periksa hasilnya di bawah.',
        type: 'success'
      });
    } catch (err: any) {
      setPreviewStatus('idle');
      setMessage({
        text: err?.message || 'Gagal mengonversi URL Google Drive.',
        type: 'error'
      });
    }
  };

  // Salin URL menggunakan Clipboard API
  const handleCopy = async () => {
    if (!convertedUrl) return;

    try {
      await navigator.clipboard.writeText(convertedUrl);
      setCopied(true);
      setMessage({ text: 'URL berhasil disalin ke clipboard!', type: 'success' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback manual
      try {
        const textarea = document.createElement('textarea');
        textarea.value = convertedUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setMessage({ text: 'URL berhasil disalin!', type: 'success' });
        setTimeout(() => setCopied(false), 2500);
      } catch {
        setMessage({ text: 'Gagal menyalin. Silakan salin URL secara manual.', type: 'error' });
      }
    }
  };

  // Buka URL hasil pada tab baru
  const handleOpen = () => {
    if (!convertedUrl) return;
    window.open(convertedUrl, '_blank', 'noopener,noreferrer');
  };

  // Terapkan URL gambar hasil konversi pada produk terpilih
  const handleApplyToProduct = (product: Product) => {
    if (!convertedUrl) return;

    const updatedProduct: Product = {
      ...product,
      imageUrl: convertedUrl.trim()
    };

    // 1. Panggil onSaveProduct jika disediakan dari parent (App / CustomerScreen)
    if (onSaveProduct) {
      onSaveProduct(updatedProduct);
    } else {
      // Fallback simpan ke localStorage & update internal list
      setFallbackProducts((prev) => {
        const next = prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p));
        saveStoredProducts(next);
        return next;
      });
    }

    // 2. Selalu sinkronisasi ke Cloud Firestore & LocalStorage secara aman
    try {
      const currentList = getStoredProducts();
      const updatedList = currentList.map((p) => (p.id === updatedProduct.id ? updatedProduct : p));
      saveStoredProducts(updatedList);
      saveProductCloud(updatedProduct).catch(console.error);
    } catch (err) {
      console.warn('Auto-save fallback notice:', err);
    }

    // 3. Set toast & highlight status
    setAppliedSuccessProductId(product.id);
    setAppliedSuccessToast(
      `Foto berhasil diterapkan pada produk "${product.name}" (${product.code})!`
    );

    setTimeout(() => {
      setAppliedSuccessToast(null);
    }, 4000);
  };

  // Reset seluruh input dan hasil
  const handleReset = () => {
    setDriveUrl('');
    setFormat('direct');
    setSize('1000');
    setConvertedUrl('');
    setMessage(null);
    setPreviewStatus('idle');
    setCopied(false);
    setIsApplyModalOpen(false);
    setAppliedSuccessToast(null);
    setAppliedSuccessProductId(null);
  };

  return (
    <div className="mt-8 border-t-2 border-dashed border-slate-200 pt-6">
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/40 rounded-2xl border border-blue-200 shadow-sm p-5 sm:p-6 space-y-5">
        {/* Header Module */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Google Drive Image Converter
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  Khusus Akun DEVELOPER
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Ubah URL Google Drive menjadi <strong>Direct Image URL</strong> atau <strong>Thumbnail URL</strong> secara otomatis agar dapat ditampilkan di katalog produk & modul POS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-medium text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
              Mendukung: /file/d/, /open?id=, /uc?id=
            </span>
          </div>
        </div>

        {/* Converter Form */}
        <form onSubmit={handleConvert} className="space-y-4">
          <div>
            <label htmlFor="driveUrlInput" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              URL Google Drive
            </label>
            <textarea
              id="driveUrlInput"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="Tempel link foto Google Drive di sini... (contoh: https://drive.google.com/file/d/1A2B3C.../view?usp=sharing)"
              rows={3}
              required
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="formatSelect" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Format URL
              </label>
              <select
                id="formatSelect"
                value={format}
                onChange={(e) => setFormat(e.target.value as 'direct' | 'thumbnail')}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="direct">Direct Image URL (export=view)</option>
                <option value="thumbnail">Thumbnail URL (High Resolution)</option>
              </select>
            </div>

            {format === 'thumbnail' ? (
              <div className="animate-in fade-in duration-150">
                <label htmlFor="sizeSelect" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lebar Thumbnail
                </label>
                <select
                  id="sizeSelect"
                  value={size}
                  onChange={(e) => setSize(e.target.value as '500' | '1000' | '2000')}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="500">500 px (Kompak)</option>
                  <option value="1000">1000 px (Resolusi Standar)</option>
                  <option value="2000">2000 px (Resolusi Ultra HD)</option>
                </select>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-100/70 border border-slate-200 rounded-xl flex items-center gap-2 text-slate-600 text-[11px]">
                <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Format Direct Image menggunakan endpoint Google UC untuk menyajikan file asli gambar secara langsung.</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Konversi URL
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </form>

        {/* Message Alert */}
        {message && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200 ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Applied Success Toast */}
        {appliedSuccessToast && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-semibold animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{appliedSuccessToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setAppliedSuccessToast(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Result Container */}
        {convertedUrl && (
          <section className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4 animate-in fade-in duration-200">
            <div>
              <label htmlFor="outputUrlTextarea" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                URL Hasil Konversi
              </label>
              <textarea
                id="outputUrlTextarea"
                value={convertedUrl}
                readOnly
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                rows={2}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-blue-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 select-all"
              />
            </div>

            {/* Action Buttons: Salin URL, Buka URL di Tab Baru, Terapkan Pada Produk */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
                }`}
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Tersalin!' : 'Salin URL'}
              </button>

              <button
                type="button"
                onClick={handleOpen}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
                Buka URL di Tab Baru
              </button>

              {/* Button Terapkan Pada Produk (posisi di sebelah button Buka URL di Tab Baru) */}
              <button
                type="button"
                onClick={() => {
                  setIsApplyModalOpen(true);
                  setProductSearch('');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow-sm"
                title="Terapkan URL gambar ini ke produk pada Katalog Produk"
              >
                <PackageCheck className="w-4 h-4 text-emerald-200" />
                <span>Terapkan Pada Produk</span>
              </button>
            </div>

            {/* Image Preview Box */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Preview Gambar
                </h4>
              </div>

              <div className="flex flex-col items-center justify-center min-h-[160px] bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden">
                {previewStatus === 'loading' && (
                  <div className="flex flex-col items-center gap-2 text-slate-400 py-6 animate-pulse">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                    <span className="text-xs font-medium">Memuat preview gambar...</span>
                  </div>
                )}

                <img
                  src={convertedUrl}
                  alt="Preview gambar Google Drive"
                  onLoad={() => setPreviewStatus('loaded')}
                  onError={() => setPreviewStatus('error')}
                  className={`max-w-full max-h-[350px] object-contain rounded-lg border border-slate-200 shadow-2xs transition-all duration-200 ${
                    previewStatus === 'loaded' ? 'block' : 'hidden'
                  }`}
                />

                {previewStatus === 'error' && (
                  <div className="text-center p-4 space-y-1">
                    <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                    <p className="text-xs font-bold text-rose-800">Preview Gagal Dimuat</p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                      Pastikan hak akses file di Google Drive disetel ke <strong>"Siapa saja yang memiliki link (Anyone with the link)"</strong> dengan peran <strong>Pelihat (Viewer)</strong>.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 text-center font-medium">
                {previewStatus === 'loaded' && (
                  <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Gambar berhasil dimuat dan valid untuk digunakan di aplikasi POS & Katalog!
                  </span>
                )}
                {previewStatus === 'loading' && 'Sedang menghubungi server Google Drive...'}
                {previewStatus === 'idle' && 'Preview akan dicoba setelah konversi.'}
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Pop Up Modal: Pencarian & Penerapan Produk di Katalog */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modalProductTitle"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="modalProductTitle" className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Terapkan Foto ke Produk Katalog
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih produk untuk menerapkan URL gambar Google Drive ini sebagai foto produk.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Converted Image Summary */}
            <div className="p-3 sm:p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg border border-emerald-300 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                  <img
                    src={convertedUrl}
                    alt="Target Google Drive"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-950">Foto Google Drive Terkonversi:</span>
                    <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full font-bold text-[10px] uppercase">
                      {format === 'thumbnail' ? `Thumbnail (${size}px)` : 'Direct View'}
                    </span>
                  </div>
                  <p className="text-emerald-800 text-[11px] font-mono truncate max-w-md sm:max-w-lg mt-0.5" title={convertedUrl}>
                    {convertedUrl}
                  </p>
                </div>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Siap Dipasang
              </span>
            </div>

            {/* Search and Filters Bar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Ketik nama produk, kode SKU, atau kategori..."
                    className="w-full pl-9 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Dropdown */}
                {availableCategories.length > 0 && (
                  <div className="sm:w-56">
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="ALL">Semua Kategori ({activeProducts.length})</option>
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat} ({activeProducts.filter((p) => String(p.category) === cat).length})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedImageFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      selectedImageFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua ({activeProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedImageFilter('NO_IMAGE')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      selectedImageFilter === 'NO_IMAGE'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Belum Punya Foto ({activeProducts.filter((p) => !p.imageUrl || p.imageUrl.trim() === '').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedImageFilter('HAS_IMAGE')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      selectedImageFilter === 'HAS_IMAGE'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sudah Punya Foto ({activeProducts.filter((p) => p.imageUrl && p.imageUrl.trim() !== '').length})
                  </button>
                </div>

                <div className="text-[11px] font-medium text-slate-500">
                  Ditemukan <strong className="text-slate-800">{filteredProducts.length}</strong> produk
                </div>
              </div>
            </div>

            {/* Notification Banner inside Modal */}
            {appliedSuccessToast && (
              <div className="px-4 py-2.5 bg-emerald-100/80 border-b border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{appliedSuccessToast}</span>
                </div>
                <span className="text-[10px] text-emerald-800 uppercase tracking-wide">Tersimpan</span>
              </div>
            )}

            {/* Product List Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 min-h-[240px] max-h-[440px] bg-slate-50/30">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">Produk Tidak Ditemukan</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm">
                    Tidak ada produk yang cocok dengan kata kunci <em>"{productSearch}"</em> atau filter kategori yang dipilih.
                  </p>
                  {(productSearch || selectedCategoryFilter !== 'ALL' || selectedImageFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearch('');
                        setSelectedCategoryFilter('ALL');
                        setSelectedImageFilter('ALL');
                      }}
                      className="mt-2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const isCurrentUrlApplied = product.imageUrl === convertedUrl;
                  const hasOtherImage = Boolean(product.imageUrl && product.imageUrl !== convertedUrl);
                  const isJustUpdated = appliedSuccessProductId === product.id;

                  return (
                    <div
                      key={product.id}
                      className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isJustUpdated
                          ? 'bg-emerald-50/80 border-emerald-400 shadow-xs'
                          : isCurrentUrlApplied
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
                      }`}
                    >
                      {/* Product Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center relative shadow-2xs">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-300" />
                          )}
                          {isCurrentUrlApplied && (
                            <div className="absolute inset-0 bg-emerald-600/30 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white drop-shadow-md stroke-[3]" />
                            </div>
                          )}
                        </div>

                        {/* Name and details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {product.code || 'NO-SKU'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {product.category}
                            </span>
                            {isCurrentUrlApplied && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Foto Ini Sedang Aktif
                              </span>
                            )}
                            {hasOtherImage && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                Sudah Punya Foto Lain
                              </span>
                            )}
                            {!product.imageUrl && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                Belum Ada Foto
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-1" title={product.name}>
                            {product.name}
                          </h4>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            <span>
                              Harga Umum:{' '}
                              <strong className="text-slate-800">
                                {formatRupiah(product.hargaUmum || (product as any).price || 0)}
                              </strong>
                            </span>
                            {product.hargaGrosir ? (
                              <span>
                                Grosir: <strong className="text-slate-700">{formatRupiah(product.hargaGrosir)}</strong>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="shrink-0 flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {isCurrentUrlApplied ? (
                          <div className="px-3.5 py-2 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-emerald-300 shadow-2xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Sudah Terpasang</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyToProduct(product)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                            title={`Terapkan URL foto ke produk ${product.name}`}
                          >
                            <PackageCheck className="w-3.5 h-3.5 text-emerald-200" />
                            <span>{hasOtherImage ? 'Ganti Foto' : 'Terapkan Foto'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 text-[11px] text-center sm:text-left">
                💡 Foto produk yang diterapkan akan langsung diperbarui di <strong>Katalog Produk</strong>, <strong>POS Kasir</strong>, dan tersinkronisasi ke server cloud.
              </span>
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs w-full sm:w-auto"
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
