/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Landing Page Developer CMS — Tata letak ala WordPress Admin
 * (sidebar menu kiri + editor + pratinjau langsung di kanan)
 *
 * Prinsip UI: clean & profesional, selaras dengan tab lain
 * (kartu putih rounded-2xl, aksen slate-900, emerald untuk status).
 * Coded by Langgo Bramandityo.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Globe,
  CheckCircle2,
  RotateCcw,
  Save,
  Eye,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Scissors,
  Printer,
  Phone,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  ChevronDown,
  Info,
  Film,
  Images,
  Quote,
  Building2,
  ExternalLink,
  Image as ImageIcon,
  Search,
  BadgeCheck,
  Clock,
  MapPin,
  MessageCircle,
  Monitor,
  Smartphone,
  CircleAlert,
  Undo2,
} from 'lucide-react';
import {
  LandingPageConfig,
  LandingBrandItem,
  LandingServiceItem,
  LandingProductItem,
  LandingBenefitItem,
  LandingSlide,
  LandingTestimonial,
  LandingClientLogo,
  LandingGalleryItem,
  LandingOffice,
  LandingSocialLink,
  LandingAboutStat,
} from '../types';
import { saveStoredLandingConfig, resetLandingConfigToDefault } from '../utils/landingPageStorage';

interface LandingPageEditorScreenProps {
  initialConfig: LandingPageConfig;
  onConfigUpdated: (newConfig: LandingPageConfig) => void;
  onPreviewLandingPage: () => void;
}

type EditorSection =
  | 'hero'
  | 'slider'
  | 'brands'
  | 'services'
  | 'products'
  | 'benefits'
  | 'about'
  | 'gallery'
  | 'testimonials'
  | 'clients'
  | 'contact';

const newId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const inputCls =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all';
const textareaCls =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 leading-relaxed placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all resize-y';
const selectCls =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all cursor-pointer';

export const LandingPageEditorScreen: React.FC<LandingPageEditorScreenProps> = ({
  initialConfig,
  onConfigUpdated,
  onPreviewLandingPage,
}) => {
  const [config, setConfig] = useState<LandingPageConfig>(initialConfig);
  const [savedJson, setSavedJson] = useState<string>(() => JSON.stringify(initialConfig));
  const [activeSection, setActiveSection] = useState<EditorSection>('hero');
  const [notice, setNotice] = useState<string | null>(null);

  // item yang sedang terbuka (accordion)
  const [openBrandId, setOpenBrandId] = useState<string | null>(null);
  const [openServiceId, setOpenServiceId] = useState<string | null>(null);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [openSlideId, setOpenSlideId] = useState<string | null>(null);
  const [openGalleryId, setOpenGalleryId] = useState<string | null>(null);
  const [openTestimonialId, setOpenTestimonialId] = useState<string | null>(null);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [openOfficeId, setOpenOfficeId] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState('');

  const isDirty = useMemo(() => JSON.stringify(config) !== savedJson, [config, savedJson]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const persist = (next: LandingPageConfig, msg: string) => {
    setConfig(next);
    saveStoredLandingConfig(next);
    onConfigUpdated(next);
    setSavedJson(JSON.stringify(next));
    // Penjaga kuota penyimpanan lokal (gambar base64 memakan banyak ruang)
    const approxMb = (JSON.stringify(next).length * 1) / (1024 * 1024);
    if (approxMb > 4) {
      showNotice(
        `Tersimpan, tapi peringatan: konfigurasi sudah ±${approxMb.toFixed(1)} MB. Pertimbangkan menghapus/mengganti beberapa gambar besar (banner & foto) dengan ukuran file lebih kecil.`
      );
    } else {
      showNotice(msg);
    }
  };

  const patchHero = (partial: Partial<LandingPageConfig['hero']>) =>
    setConfig((prev) => ({ ...prev, hero: { ...prev.hero, ...partial } }));

  const patchContact = (partial: Partial<LandingPageConfig['contact']>) =>
    setConfig((prev) => ({ ...prev, contact: { ...prev.contact, ...partial } }));

  const updateBrand = (id: string, partial: Partial<LandingBrandItem>) =>
    setConfig((prev) => ({
      ...prev,
      brands: prev.brands.map((b) => (b.id === id ? { ...b, ...partial } : b)),
    }));

  const updateService = (id: string, partial: Partial<LandingServiceItem>) =>
    setConfig((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    }));

  const updateProduct = (id: string, partial: Partial<LandingProductItem>) =>
    setConfig((prev) => ({
      ...prev,
      featuredProducts: prev.featuredProducts.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    }));

  const updateBenefit = (index: number, partial: Partial<LandingBenefitItem>) =>
    setConfig((prev) => ({
      ...prev,
      benefits: prev.benefits.map((b, i) => (i === index ? { ...b, ...partial } : b)),
    }));

  // ===== Slider banner =====
  const patchSlides = (updater: (s: LandingSlide[]) => LandingSlide[]) =>
    setConfig((prev) => ({ ...prev, slides: updater(prev.slides) }));

  const updateSlide = (id: string, partial: Partial<LandingSlide>) =>
    patchSlides((s) => s.map((x) => (x.id === id ? { ...x, ...partial } : x)));

  const handleAddSlide = () => {
    const slide: LandingSlide = {
      id: newId('slide'),
      title: `Slide Banner ${config.slides.length + 1}`,
      subtitle: '',
      ctaText: '',
      imageUrl: undefined,
      isActive: true,
    };
    setConfig((prev) => ({ ...prev, slides: [...prev.slides, slide] }));
    setOpenSlideId(slide.id);
    showNotice('Slide baru ditambahkan — unggah gambar 1600 × 700 px.');
  };

  // ===== Tentang Kami =====
  const patchAbout = (partial: Partial<LandingPageConfig['about']> | ((a: LandingPageConfig['about']) => LandingPageConfig['about'])) =>
    setConfig((prev) => ({
      ...prev,
      about:
        typeof partial === 'function'
          ? partial(prev.about)
          : { ...prev.about, ...partial },
    }));

  const updateStat = (index: number, partial: Partial<LandingAboutStat>) =>
    patchAbout((a) => ({ ...a, stats: a.stats.map((s, i) => (i === index ? { ...s, ...partial } : s)) }));

  // ===== Galeri / Testimoni / Klien / Cabang / Sosmed =====
  const patchGallery = (updater: (g: LandingGalleryItem[]) => LandingGalleryItem[]) =>
    setConfig((prev) => ({ ...prev, gallery: updater(prev.gallery) }));

  const updateGallery = (id: string, partial: Partial<LandingGalleryItem>) =>
    patchGallery((g) => g.map((x) => (x.id === id ? { ...x, ...partial } : x)));

  const patchTestimonials = (updater: (t: LandingTestimonial[]) => LandingTestimonial[]) =>
    setConfig((prev) => ({ ...prev, testimonials: updater(prev.testimonials) }));

  const updateTestimonial = (id: string, partial: Partial<LandingTestimonial>) =>
    patchTestimonials((t) => t.map((x) => (x.id === id ? { ...x, ...partial } : x)));

  const patchClients = (updater: (c: LandingClientLogo[]) => LandingClientLogo[]) =>
    setConfig((prev) => ({ ...prev, clients: updater(prev.clients) }));

  const updateClient = (id: string, partial: Partial<LandingClientLogo>) =>
    patchClients((c) => c.map((x) => (x.id === id ? { ...x, ...partial } : x)));

  const patchOffices = (updater: (o: LandingOffice[]) => LandingOffice[]) =>
    setConfig((prev) => ({ ...prev, offices: updater(prev.offices) }));

  const updateOffice = (id: string, partial: Partial<LandingOffice>) =>
    patchOffices((o) => o.map((x) => (x.id === id ? { ...x, ...partial } : x)));

  const patchSocials = (updater: (s: LandingSocialLink[]) => LandingSocialLink[]) =>
    setConfig((prev) => ({ ...prev, socials: updater(prev.socials) }));

  const updateSocial = (id: string, partial: Partial<LandingSocialLink>) =>
    patchSocials((s) => s.map((x) => (x.id === id ? { ...x, ...partial } : x)));

  const handleAddBrand = () => {
    const brand: LandingBrandItem = {
      id: newId('brand'),
      name: 'MERK BARU',
      tagline: 'Premium Vinyl Media Series',
      category: 'wrapping',
      description: 'Material stiker berkualitas tinggi untuk variasi dan advertising.',
      badge: 'Baru',
      isPopular: false,
      isActive: true,
      features: [],
    };
    setConfig((prev) => ({ ...prev, brands: [brand, ...prev.brands] }));
    setOpenBrandId(brand.id);
    setBrandQuery('');
    showNotice('Merk baru ditambahkan — lengkapi detailnya di bawah.');
  };

  const handleDeleteBrand = (brand: LandingBrandItem) => {
    if (!window.confirm(`Hapus merk "${brand.name}" dari landing page?`)) return;
    setConfig((prev) => ({ ...prev, brands: prev.brands.filter((b) => b.id !== brand.id) }));
    showNotice(`Merk "${brand.name}" dihapus.`);
  };

  const handleAddService = () => {
    const service: LandingServiceItem = {
      id: newId('service'),
      title: 'Layanan Baru',
      subtitle: 'Sub-judul layanan',
      description: 'Jelaskan layanan ini secara singkat dan menarik.',
      iconName: 'sparkles',
      highlights: [],
      ctaLabel: 'Pesan Sekarang',
      isActive: true,
    };
    setConfig((prev) => ({ ...prev, services: [...prev.services, service] }));
    setOpenServiceId(service.id);
    showNotice('Layanan baru ditambahkan.');
  };

  const handleAddProduct = () => {
    const product: LandingProductItem = {
      id: newId('prod'),
      name: 'Produk Stiker / Jasa Baru',
      brand: 'DECOFIX',
      category: 'meteran',
      unit: 'per meter',
      priceEstimated: 'Rp 25.000 / m',
      specs: 'Spesifikasi produk',
      description: 'Deskripsi singkat produk atau jasa unggulan.',
      badge: 'Promo',
      isActive: true,
    };
    setConfig((prev) => ({ ...prev, featuredProducts: [product, ...prev.featuredProducts] }));
    setOpenProductId(product.id);
    showNotice('Produk unggulan baru ditambahkan.');
  };

  const handleAddBenefit = () => {
    setConfig((prev) => ({
      ...prev,
      benefits: [
        ...prev.benefits,
        { title: 'Keunggulan Baru', description: 'Jelaskan keunggulan ini.', icon: 'award' },
      ],
    }));
    showNotice('Keunggulan baru ditambahkan.');
  };

  const handleSave = () => persist({ ...config, lastModifiedAt: Date.now() }, 'Seluruh perubahan Landing Page berhasil disimpan!');

  /** Buka halaman publik dengan aman — simpan dulu bila ada perubahan belum tersimpan. */
  const handlePreviewLive = () => {
    if (isDirty) {
      persist(
        { ...config, lastModifiedAt: Date.now() },
        'Perubahan disimpan sebelum membuka pratinjau halaman publik.'
      );
    }
    onPreviewLandingPage();
  };

  const handleTogglePublish = () => {
    const next = !config.isPublished;
    persist(
      { ...config, isPublished: next, lastModifiedAt: Date.now() },
      next
        ? 'Status: PUBLISH — Landing Page tampil sebagai halaman awal.'
        : 'Status: ON HOLD — Pengunjung langsung diarahkan ke halaman login.'
    );
  };

  const handleResetDefaults = () => {
    if (!window.confirm('Reset seluruh konten Landing Page ke template default resmi Bejo Stiker?')) return;
    const def = resetLandingConfigToDefault();
    setConfig(def);
    setSavedJson(JSON.stringify(def));
    onConfigUpdated(def);
    showNotice('Konten Landing Page berhasil di-reset ke setelan awal.');
  };

  const handleDiscard = () => {
    if (!isDirty) return;
    if (!window.confirm('Batalkan semua perubahan yang belum disimpan?')) return;
    const saved = JSON.parse(savedJson) as LandingPageConfig;
    setConfig(saved);
    showNotice('Perubahan yang belum disimpan dibatalkan.');
  };

  const filteredBrands = config.brands.filter((b) =>
    b.name.toLowerCase().includes(brandQuery.toLowerCase())
  );

  const formatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const menus: {
    key: EditorSection;
    label: string;
    icon: React.ElementType;
    count?: number;
    hint: string;
  }[] = [
    { key: 'hero', label: 'Hero & Headline', icon: Sparkles, hint: 'Judul & tombol utama' },
    { key: 'slider', label: 'Slider Banner', icon: Film, count: config.slides.length, hint: 'Gambar utama berotasi' },
    { key: 'brands', label: 'Merk Stiker', icon: Layers, count: config.brands.length, hint: 'Koleksi vinyl' },
    { key: 'services', label: 'Layanan', icon: Printer, count: config.services.length, hint: 'Cetak & cutting' },
    { key: 'products', label: 'Produk Unggulan', icon: Scissors, count: config.featuredProducts.length, hint: 'Katalog & harga' },
    { key: 'benefits', label: 'Keunggulan', icon: BadgeCheck, count: config.benefits.length, hint: 'Alasan memilih' },
    { key: 'about', label: 'Tentang Kami', icon: Info, count: config.about.stats.length, hint: 'Profil & statistik' },
    { key: 'gallery', label: 'Galeri Workshop', icon: Images, count: config.gallery.length, hint: 'Foto dokumentasi' },
    { key: 'testimonials', label: 'Testimoni', icon: Quote, count: config.testimonials.length, hint: 'Suara pelanggan' },
    { key: 'clients', label: 'Logo Klien', icon: Building2, count: config.clients.length, hint: 'Nama pelanggan' },
    { key: 'contact', label: 'Kontak & Alamat', icon: Phone, count: config.offices.length, hint: 'Cabang & sosmed' },
  ];

  return (
    <div className="w-full max-w-[1440px] mx-auto p-3 sm:p-5 space-y-4">
      {/* Notifikasi */}
      {notice && (
        <div className="fixed top-20 right-4 z-[60] max-w-sm bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-start gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span className="flex-1 leading-relaxed">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            ×
          </button>
        </div>
      )}

      {/* ===== Header + Kontrol Utama ===== */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
              KELOLA LANDING PAGE
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold tracking-wide">
                DEVELOPER ONLY
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur tampilan halaman depan toko — ubah teks, merk, layanan, produk, dan kontak.
              Perubahan tampil langsung pada pratinjau di samping.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isDirty ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold">
                  <CircleAlert className="w-3.5 h-3.5 text-amber-600" />
                  Perubahan belum disimpan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Semua perubahan tersimpan
                </span>
              )}
              <span className="text-[11px] text-slate-400 font-medium">
                Terakhir diubah: {formatTime(config.lastModifiedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Status publish + aksi */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={handleTogglePublish}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              config.isPublished
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
            }`}
            title="Klik untuk mengubah status publikasi landing page"
          >
            {config.isPublished ? (
              <ToggleRight className="w-5 h-5 text-emerald-600" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-amber-600" />
            )}
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[10px] font-black uppercase tracking-wider">
                {config.isPublished ? 'PUBLISH' : 'ON HOLD'}
              </span>
              <span className="text-[10px] font-medium opacity-80">
                {config.isPublished ? 'Tampil sebagai halaman awal' : 'Langsung ke login'}
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreviewLive}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Preview Live</span>
            </button>

            <button
              type="button"
              onClick={handleDiscard}
              disabled={!isDirty}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-slate-600 border border-slate-300 text-xs font-bold shadow-xs transition-all cursor-pointer hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Batalkan perubahan yang belum disimpan"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Batal</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black shadow-md transition-all active:scale-95 ${
                isDirty
                  ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className={`w-3.5 h-3.5 ${isDirty ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{isDirty ? 'Simpan' : 'Tersimpan'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== Grid: Sidebar | Editor | Pratinjau ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_370px] gap-4 items-start">
        {/* Sidebar menu */}
        <aside className="bg-white rounded-2xl border border-slate-200 p-2.5 shadow-xs lg:sticky lg:top-20">
          <div className="px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Konten Halaman
          </div>
          <nav className="space-y-0.5">
            {menus.map((m) => {
              const Icon = m.icon;
              const active = activeSection === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveSection(m.key)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-300' : 'text-slate-400'}`} />
                    <span className="truncate text-left">
                      {m.label}
                      <span className={`block text-[10px] font-medium ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                        {m.hint}
                      </span>
                    </span>
                  </span>
                  {typeof m.count === 'number' ? (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono shrink-0 ${
                        active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.count}
                    </span>
                  ) : (
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-slate-400' : 'text-slate-300'}`} />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5">
            <button
              type="button"
              onClick={handlePreviewLive}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Lihat Halaman Publik
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset ke Default
            </button>
          </div>

          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Status Situs</div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
              <span className={`w-2 h-2 rounded-full ${config.isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {config.isPublished ? 'Aktif & Publik' : 'Dijeda (On Hold)'}
            </div>
          </div>
        </aside>

        {/* Panel editor */}
        <div className="min-w-0">
          {activeSection === 'hero' && (
            <SectionShell
              icon={Sparkles}
              iconChip="bg-indigo-100 text-indigo-700"
              title="Hero & Headline"
              desc="Teks pertama yang dilihat pengunjung saat membuka halaman toko."
            >
              <Field label="Pita Pengumuman Promo" hint="Tampil di paling atas. Kosongkan bila tidak ada promo.">
                <input
                  type="text"
                  value={config.hero.bannerAnnouncement || ''}
                  onChange={(e) => patchHero({ bannerAnnouncement: e.target.value })}
                  placeholder="Contoh: Promo Desember — Diskon 10% semua vinyl!"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Teks Badge Hero">
                  <input
                    type="text"
                    value={config.hero.badgeText}
                    onChange={(e) => patchHero({ badgeText: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Headline Utama" hint={`${config.hero.headline.length} karakter`}>
                  <input
                    type="text"
                    value={config.hero.headline}
                    onChange={(e) => patchHero({ headline: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Sub-Headline" hint="Deskripsi singkat di bawah judul utama.">
                <textarea
                  rows={3}
                  value={config.hero.subheadline}
                  onChange={(e) => patchHero({ subheadline: e.target.value })}
                  className={textareaCls}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tombol Utama (CTA 1)">
                  <input
                    type="text"
                    value={config.hero.primaryCtaText}
                    onChange={(e) => patchHero({ primaryCtaText: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Tombol Kedua (CTA 2)">
                  <input
                    type="text"
                    value={config.hero.secondaryCtaText}
                    onChange={(e) => patchHero({ secondaryCtaText: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="flex gap-2 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[11px] text-indigo-900">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  Gunakan headline singkat (maks ±60 karakter) dan sub-headline 1–2 baris agar tampilan hero
                  tetap rapi di semua ukuran layar.
                </span>
              </div>
            </SectionShell>
          )}

          {activeSection === 'slider' && (
            <SectionShell
              icon={Film}
              iconChip="bg-rose-100 text-rose-700"
              title={`Slider Banner Utama (${config.slides.length})`}
              desc="Gambar utama berotasi otomatis di halaman Beranda. Slide tanpa foto akan memakai latar gradient."
              action={
                <button
                  type="button"
                  onClick={handleAddSlide}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Tambah Slide
                </button>
              }
            >
              <div className="space-y-2">
                {config.slides.map((slide, i) => {
                  const open = openSlideId === slide.id;
                  return (
                    <div
                      key={slide.id}
                      className={`rounded-xl border transition-all ${
                        open ? 'border-rose-300 bg-rose-50/30 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 p-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenSlideId(open ? null : slide.id)}
                          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                        >
                          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <span className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 text-[11px] font-black flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm font-black text-slate-900 truncate">{slide.title}</span>
                          {slide.imageUrl && (
                            <img src={slide.imageUrl} alt="" className="w-9 h-6 object-cover rounded border border-slate-200 shrink-0 hidden sm:block" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => updateSlide(slide.id, { isActive: !slide.isActive })}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                            slide.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                        >
                          {slide.isActive ? 'Tampil' : 'Sembunyi'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Hapus slide "${slide.title}"?`)) return;
                            setConfig((prev) => ({ ...prev, slides: prev.slides.filter((s) => s.id !== slide.id) }));
                            showNotice('Slide dihapus.');
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                          title="Hapus slide"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {open && (
                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-rose-100">
                          <ImageUploadField
                            label="Foto Banner"
                            value={slide.imageUrl}
                            onChange={(imageUrl) => updateSlide(slide.id, { imageUrl })}
                            recWidth={1600}
                            recHeight={700}
                            maxWidth={1600}
                          />

                          <Field label="Nama Slide" hint="Hanya untuk penanda di editor — tidak tampil di halaman publik">
                            <input
                              type="text"
                              value={slide.title}
                              onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
                              className={inputCls}
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          )}

          {activeSection === 'brands' && (
            <SectionShell
              icon={Layers}
              iconChip="bg-emerald-100 text-emerald-700"
              title={`Merk Stiker Vinyl (${config.brands.length})`}
              desc="Kelola daftar merk yang tampil pada bagian katalog landing page."
              action={
                <button
                  type="button"
                  onClick={handleAddBrand}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Tambah Merk
                </button>
              }
            >
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  placeholder="Cari merk…"
                  className={`${inputCls} pl-9`}
                />
              </div>

              <div className="space-y-2">
                {filteredBrands.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">Tidak ada merk yang cocok.</p>
                )}
                {filteredBrands.map((brand) => {
                  const open = openBrandId === brand.id;
                  return (
                    <div
                      key={brand.id}
                      className={`rounded-xl border transition-all ${
                        open ? 'border-indigo-300 bg-indigo-50/30 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 p-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenBrandId(open ? null : brand.id)}
                          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                        >
                          {open ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="text-sm font-black text-slate-900 truncate">{brand.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase shrink-0">
                            {brand.category}
                          </span>
                          {brand.badge && (
                            <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold shrink-0">
                              {brand.badge}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => updateBrand(brand.id, { isActive: !brand.isActive })}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                            brand.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                          title="Tampilkan / sembunyikan merk"
                        >
                          {brand.isActive ? 'Tampil' : 'Sembunyi'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteBrand(brand)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                          title="Hapus merk"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {open && (
                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-indigo-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Nama Merk">
                              <input
                                type="text"
                                value={brand.name}
                                onChange={(e) => updateBrand(brand.id, { name: e.target.value.toUpperCase() })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Tagline">
                              <input
                                type="text"
                                value={brand.tagline}
                                onChange={(e) => updateBrand(brand.id, { tagline: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                          </div>

                          <Field label="Deskripsi">
                            <textarea
                              rows={2}
                              value={brand.description}
                              onChange={(e) => updateBrand(brand.id, { description: e.target.value })}
                              className={textareaCls}
                            />
                          </Field>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Badge Label" hint="Contoh: Best Seller, Grade Jerman">
                              <input
                                type="text"
                                value={brand.badge || ''}
                                onChange={(e) => updateBrand(brand.id, { badge: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Kategori">
                              <select
                                value={brand.category}
                                onChange={(e) => updateBrand(brand.id, { category: e.target.value as LandingBrandItem['category'] })}
                                className={selectCls}
                              >
                                <option value="wrapping">Automotive Wrapping</option>
                                <option value="cutting">Cutting &amp; Signage</option>
                                <option value="reflective">Reflektif Scotlite</option>
                                <option value="protection">PPF &amp; Pelindung</option>
                                <option value="printing">Bahan Digital Print</option>
                                <option value="general">Umum</option>
                              </select>
                            </Field>
                          </div>

                          <StringListEditor
                            label="Fitur / Keunggulan Merk"
                            hint="Tampil sebagai poin kecil di kartu merk"
                            items={brand.features}
                            onChange={(features) => updateBrand(brand.id, { features })}
                            placeholder="Contoh: Tahan panas & anti menguning"
                          />

                          <ImageUploadField
                            label="Foto Dokumentasi / Swatch Merk"
                            value={brand.imageUrl}
                            onChange={(imageUrl) => updateBrand(brand.id, { imageUrl })}
                            recWidth={800}
                            recHeight={600}
                            maxWidth={1000}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          )}

          {activeSection === 'services' && (
            <SectionShell
              icon={Printer}
              iconChip="bg-sky-100 text-sky-700"
              title={`Layanan (${config.services.length})`}
              desc="Layanan utama workshop: digital printing, laser cutting, dan vinyl."
              action={
                <button
                  type="button"
                  onClick={handleAddService}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Tambah Layanan
                </button>
              }
            >
              <div className="space-y-2">
                {config.services.map((service) => {
                  const open = openServiceId === service.id;
                  return (
                    <div
                      key={service.id}
                      className={`rounded-xl border transition-all ${
                        open ? 'border-sky-300 bg-sky-50/30 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 p-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenServiceId(open ? null : service.id)}
                          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                        >
                          {open ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="text-sm font-black text-slate-900 truncate">{service.title}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateService(service.id, { isActive: !service.isActive })}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                            service.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                        >
                          {service.isActive ? 'Aktif' : 'Non-aktif'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Hapus layanan "${service.title}"?`)) {
                              setConfig((prev) => ({
                                ...prev,
                                services: prev.services.filter((s) => s.id !== service.id),
                              }));
                              showNotice(`Layanan "${service.title}" dihapus.`);
                            }
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                          title="Hapus layanan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {open && (
                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-sky-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Judul Layanan">
                              <input
                                type="text"
                                value={service.title}
                                onChange={(e) => updateService(service.id, { title: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Sub-Judul">
                              <input
                                type="text"
                                value={service.subtitle}
                                onChange={(e) => updateService(service.id, { subtitle: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                          </div>

                          <Field label="Deskripsi Layanan">
                            <textarea
                              rows={3}
                              value={service.description}
                              onChange={(e) => updateService(service.id, { description: e.target.value })}
                              className={textareaCls}
                            />
                          </Field>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Teks Tombol Order">
                              <input
                                type="text"
                                value={service.ctaLabel || ''}
                                onChange={(e) => updateService(service.id, { ctaLabel: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Ikon">
                              <select
                                value={service.iconName}
                                onChange={(e) => updateService(service.id, { iconName: e.target.value as LandingServiceItem['iconName'] })}
                                className={selectCls}
                              >
                                <option value="printer">Printer</option>
                                <option value="scissors">Gunting / Cutting</option>
                                <option value="layers">Lapisan / Vinyl</option>
                                <option value="sparkles">Sparkles</option>
                                <option value="shield">Perisai / Proteksi</option>
                                <option value="package">Paket</option>
                              </select>
                            </Field>
                          </div>

                          <StringListEditor
                            label="Poin Highlight Layanan"
                            hint="Ditampilkan sebagai daftar centang"
                            items={service.highlights}
                            onChange={(highlights) => updateService(service.id, { highlights })}
                            placeholder="Contoh: Hasil potongan rapi & presisi"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          )}

          {activeSection === 'products' && (
            <SectionShell
              icon={Scissors}
              iconChip="bg-amber-100 text-amber-700"
              title={`Produk Unggulan (${config.featuredProducts.length})`}
              desc="Kartu produk stiker roll/meteran dan cetak yang ditonjolkan di landing page."
              action={
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Tambah Produk
                </button>
              }
            >
              <div className="space-y-2">
                {config.featuredProducts.map((product) => {
                  const open = openProductId === product.id;
                  return (
                    <div
                      key={product.id}
                      className={`rounded-xl border transition-all ${
                        open ? 'border-amber-300 bg-amber-50/30 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 p-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenProductId(open ? null : product.id)}
                          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                        >
                          {open ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="text-sm font-black text-slate-900 truncate">{product.name}</span>
                          <span className="hidden sm:inline text-[11px] font-mono font-bold text-indigo-700 shrink-0">
                            {product.priceEstimated}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateProduct(product.id, { isActive: !product.isActive })}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                            product.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                        >
                          {product.isActive ? 'Tampil' : 'Sembunyi'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Hapus produk "${product.name}" dari daftar unggulan?`)) return;
                            setConfig((prev) => ({
                              ...prev,
                              featuredProducts: prev.featuredProducts.filter((p) => p.id !== product.id),
                            }));
                            showNotice('Produk dihapus dari daftar unggulan.');
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                          title="Hapus produk"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {open && (
                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-amber-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Nama Produk">
                              <input
                                type="text"
                                value={product.name}
                                onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Merk">
                              <input
                                type="text"
                                value={product.brand}
                                onChange={(e) => updateProduct(product.id, { brand: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Field label="Kategori">
                              <select
                                value={product.category}
                                onChange={(e) => updateProduct(product.id, { category: e.target.value as LandingProductItem['category'] })}
                                className={selectCls}
                              >
                                <option value="roll">Roll</option>
                                <option value="meteran">Meteran</option>
                                <option value="print">Digital Print</option>
                                <option value="laser">Laser Cut</option>
                              </select>
                            </Field>
                            <Field label="Satuan">
                              <input
                                type="text"
                                value={product.unit}
                                onChange={(e) => updateProduct(product.id, { unit: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Estimasi Harga">
                              <input
                                type="text"
                                value={product.priceEstimated}
                                onChange={(e) => updateProduct(product.id, { priceEstimated: e.target.value })}
                                className={`${inputCls} font-mono text-indigo-700`}
                              />
                            </Field>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Spesifikasi Singkat">
                              <input
                                type="text"
                                value={product.specs}
                                onChange={(e) => updateProduct(product.id, { specs: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Badge">
                              <input
                                type="text"
                                value={product.badge || ''}
                                onChange={(e) => updateProduct(product.id, { badge: e.target.value })}
                                placeholder="Promo"
                                className={inputCls}
                              />
                            </Field>
                          </div>

                          <Field label="Deskripsi">
                            <textarea
                              rows={2}
                              value={product.description}
                              onChange={(e) => updateProduct(product.id, { description: e.target.value })}
                              className={textareaCls}
                            />
                          </Field>

                          <ImageUploadField
                            label="Foto Produk"
                            value={product.imageUrl}
                            onChange={(imageUrl) => updateProduct(product.id, { imageUrl })}
                            recWidth={800}
                            recHeight={800}
                            maxWidth={900}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          )}

          {activeSection === 'benefits' && (
            <SectionShell
              icon={BadgeCheck}
              iconChip="bg-violet-100 text-violet-700"
              title={`Keunggulan Toko (${config.benefits.length})`}
              desc="Alasan pelanggan memilih toko Anda — tampil pada bagian bawah landing page."
              action={
                <button
                  type="button"
                  onClick={handleAddBenefit}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Tambah
                </button>
              }
            >
              <div className="space-y-2">
                {config.benefits.map((benefit, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 hover:border-slate-300 transition-all">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-violet-100 text-violet-700 text-[11px] font-black flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={benefit.title}
                        onChange={(e) => updateBenefit(index, { title: e.target.value })}
                        className={`${inputCls} font-black`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            benefits: prev.benefits.filter((_, i) => i !== index),
                          }))
                        }
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title="Hapus keunggulan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={benefit.description}
                      onChange={(e) => updateBenefit(index, { description: e.target.value })}
                      className={textareaCls}
                    />
                  </div>
                ))}
              </div>
            </SectionShell>
          )}

          {activeSection === 'about' && (
            <SectionShell
              icon={Info}
              iconChip="bg-sky-100 text-sky-700"
              title="Tentang Kami (Halaman Profil)"
              desc="Konten halaman Tentang Kami + ringkasan Profil hero Beranda."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Label Kecil (Eyebrow)">
                  <input
                    type="text"
                    value={config.about.eyebrow}
                    onChange={(e) => patchAbout({ eyebrow: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Judul Profil">
                  <input
                    type="text"
                    value={config.about.title}
                    onChange={(e) => patchAbout({ title: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Ringkasan Pembuka (tampil di halaman Tentang & Beranda)">
                <textarea
                  rows={3}
                  value={config.about.intro}
                  onChange={(e) => patchAbout({ intro: e.target.value })}
                  className={textareaCls}
                />
              </Field>

              <StringListEditor
                label="Paragraf Isi Tentang Kami"
                hint="Satu baris = satu paragraf"
                items={config.about.paragraphs}
                onChange={(paragraphs) => patchAbout({ paragraphs })}
                placeholder="Tulis paragraf di sini…"
              />

              <ImageUploadField
                label="Foto Profil / Workshop"
                value={config.about.imageUrl}
                onChange={(imageUrl) => patchAbout({ imageUrl })}
                recWidth={900}
                recHeight={700}
                maxWidth={1200}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Caption Foto">
                  <input
                    type="text"
                    value={config.about.imageCaption || ''}
                    onChange={(e) => patchAbout({ imageCaption: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Teks Tombol CTA">
                  <input
                    type="text"
                    value={config.about.ctaText || ''}
                    onChange={(e) => patchAbout({ ctaText: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Statistik */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Statistik Angka (Lencana)</span>
                  <button
                    type="button"
                    onClick={() =>
                      patchAbout((a) => ({ ...a, stats: [...a.stats, { value: '10+', label: 'Label Baru' }] }))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah
                  </button>
                </div>
                {config.about.stats.map((st, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={st.value}
                      onChange={(e) => updateStat(index, { value: e.target.value })}
                      placeholder="8+"
                      className={`${inputCls} w-28 shrink-0 font-black`}
                    />
                    <input
                      type="text"
                      value={st.label}
                      onChange={(e) => updateStat(index, { label: e.target.value })}
                      placeholder="Tahun Pengalaman"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => patchAbout((a) => ({ ...a, stats: a.stats.filter((_, i) => i !== index) }))}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                      title="Hapus statistik"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </SectionShell>
          )}

          {activeSection === 'gallery' && (
            <SectionShell
              icon={Images}
              iconChip="bg-teal-100 text-teal-700"
              title={`Galeri Workshop (${config.gallery.length})`}
              desc="Foto dokumentasi produksi untuk halaman Tentang Kami. Pengunjung bisa klik untuk zoom (popup)."
              action={
                <button
                  type="button"
                  onClick={() => {
                    const item: LandingGalleryItem = {
                      id: newId('gal'),
                      title: 'Foto Baru',
                      description: 'Keterangan singkat foto',
                      imageUrl: undefined,
                      isActive: true,
                    };
                    setConfig((prev) => ({ ...prev, gallery: [item, ...prev.gallery] }));
                    setOpenGalleryId(item.id);
                    showNotice('Foto galeri ditambahkan — unggah gambar 800 × 600 px.');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Tambah Foto
                </button>
              }
            >
              <div className="space-y-2">
                {config.gallery.map((item) => {
                  const open = openGalleryId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border transition-all ${
                        open ? 'border-teal-300 bg-teal-50/30' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 p-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenGalleryId(open ? null : item.id)}
                          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                        >
                          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="w-9 h-7 object-cover rounded border border-slate-200 shrink-0" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                          <span className="text-sm font-black text-slate-900 truncate">{item.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateGallery(item.id, { isActive: !item.isActive })}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer shrink-0 ${
                            item.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                        >
                          {item.isActive ? 'Tampil' : 'Sembunyi'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfig((prev) => ({ ...prev, gallery: prev.gallery.filter((g) => g.id !== item.id) }));
                            showNotice('Foto galeri dihapus.');
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {open && (
                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-teal-100">
                          <ImageUploadField
                            label="Foto Galeri"
                            value={item.imageUrl}
                            onChange={(imageUrl) => updateGallery(item.id, { imageUrl })}
                            recWidth={800}
                            recHeight={600}
                            maxWidth={1000}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Judul Foto">
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => updateGallery(item.id, { title: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Keterangan">
                              <input
                                type="text"
                                value={item.description || ''}
                                onChange={(e) => updateGallery(item.id, { description: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          )}

          {activeSection === 'testimonials' && (
            <SectionShell
              icon={Quote}
              iconChip="bg-amber-100 text-amber-700"
              title={`Testimoni Pelanggan (${config.testimonials.length})`}
              desc="Tampil di Beranda (slider) dan halaman Klien. Logo perusahaan: foto persegi (kotak lingkaran otomatis)."
              action={
                <button
                  type="button"
                  onClick={() => {
                    const item: LandingTestimonial = {
                      id: newId('testi'),
                      quote: 'Tulis quote pelanggan di sini…',
                      author: 'Nama Pelanggan',
                      role: 'Jabatan',
                      company: 'Nama Perusahaan',
                      logoUrl: undefined,
                      isActive: true,
                    };
                    setConfig((prev) => ({ ...prev, testimonials: [...prev.testimonials, item] }));
                    setOpenTestimonialId(item.id);
                    showNotice('Testimoni ditambahkan. Logo: 200 × 200 px.');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Tambah Testimoni
                </button>
              }
            >
              <div className="space-y-2">
                {config.testimonials.map((t) => {
                  const open = openTestimonialId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl border transition-all ${
                        open ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 p-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenTestimonialId(open ? null : t.id)}
                          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                        >
                          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <span className="text-sm font-black text-slate-900 truncate">{t.author}</span>
                          <span className="text-[11px] text-slate-500 font-semibold truncate hidden sm:inline">• {t.company}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTestimonial(t.id, { isActive: !t.isActive })}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer shrink-0 ${
                            t.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                        >
                          {t.isActive ? 'Tampil' : 'Sembunyi'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfig((prev) => ({
                              ...prev,
                              testimonials: prev.testimonials.filter((x) => x.id !== t.id),
                            }));
                            showNotice('Testimoni dihapus.');
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {open && (
                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-amber-100">
                          <Field label="Quote">
                            <textarea
                              rows={3}
                              value={t.quote}
                              onChange={(e) => updateTestimonial(t.id, { quote: e.target.value })}
                              className={textareaCls}
                            />
                          </Field>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Field label="Nama">
                              <input
                                type="text"
                                value={t.author}
                                onChange={(e) => updateTestimonial(t.id, { author: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Jabatan">
                              <input
                                type="text"
                                value={t.role}
                                onChange={(e) => updateTestimonial(t.id, { role: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Perusahaan">
                              <input
                                type="text"
                                value={t.company}
                                onChange={(e) => updateTestimonial(t.id, { company: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                          </div>

                          <ImageUploadField
                            label="Logo Perusahaan (tampil bulat)"
                            value={t.logoUrl}
                            onChange={(logoUrl) => updateTestimonial(t.id, { logoUrl })}
                            recWidth={200}
                            recHeight={200}
                            maxWidth={400}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          )}

          {activeSection === 'clients' && (
            <SectionShell
              icon={Building2}
              iconChip="bg-indigo-100 text-indigo-700"
              title={`Logo Klien (${config.clients.length})`}
              desc="Grid logo pelanggan di Beranda & halaman Klien. Tanpa logo akan memakai inisial nama otomatis."
              action={
                <button
                  type="button"
                  onClick={() => {
                    const item: LandingClientLogo = {
                      id: newId('cli'),
                      name: 'KLIEN BARU',
                      logoUrl: undefined,
                      websiteUrl: undefined,
                      isActive: true,
                    };
                    setConfig((prev) => ({ ...prev, clients: [item, ...prev.clients] }));
                    setOpenClientId(item.id);
                    showNotice('Klien ditambahkan. Logo: 300 × 300 px PNG transparan.');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Tambah Klien
                </button>
              }
            >
              <div className="space-y-2">
                {config.clients.map((c) => {
                  const open = openClientId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`rounded-xl border transition-all ${
                        open ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 p-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenClientId(open ? null : c.id)}
                          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                        >
                          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          {c.logoUrl ? (
                            <img src={c.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 shrink-0" />
                          ) : (
                            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">
                              {c.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="text-sm font-black text-slate-900 truncate">{c.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateClient(c.id, { isActive: !c.isActive })}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer shrink-0 ${
                            c.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                        >
                          {c.isActive ? 'Tampil' : 'Sembunyi'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfig((prev) => ({ ...prev, clients: prev.clients.filter((x) => x.id !== c.id) }));
                            showNotice('Klien dihapus.');
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {open && (
                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-indigo-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Nama Klien">
                              <input
                                type="text"
                                value={c.name}
                                onChange={(e) => updateClient(c.id, { name: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="Website (opsional)">
                              <input
                                type="text"
                                value={c.websiteUrl || ''}
                                onChange={(e) => updateClient(c.id, { websiteUrl: e.target.value })}
                                placeholder="https://…"
                                className={`${inputCls} font-mono`}
                              />
                            </Field>
                          </div>

                          <ImageUploadField
                            label="Logo Klien"
                            value={c.logoUrl}
                            onChange={(logoUrl) => updateClient(c.id, { logoUrl })}
                            recWidth={300}
                            recHeight={300}
                            maxWidth={500}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          )}

          {activeSection === 'contact' && (
            <SectionShell
              icon={Phone}
              iconChip="bg-purple-100 text-purple-700"
              title="Kontak & Alamat"
              desc="Informasi yang dipakai tombol WhatsApp Order dan bagian lokasi toko."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nomor WhatsApp Order" hint="contoh: 6281234567890">
                  <input
                    type="text"
                    value={config.contact.whatsappNumber}
                    onChange={(e) => patchContact({ whatsappNumber: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="Nomor Telepon (Tampilan)">
                  <input
                    type="text"
                    value={config.contact.phoneDisplay}
                    onChange={(e) => patchContact({ phoneDisplay: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Alamat Workshop / Toko">
                <textarea
                  rows={2}
                  value={config.contact.storeAddress}
                  onChange={(e) => patchContact({ storeAddress: e.target.value })}
                  className={textareaCls}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Jam Operasional">
                  <input
                    type="text"
                    value={config.contact.operatingHours}
                    onChange={(e) => patchContact({ operatingHours: e.target.value })}
                    placeholder="Senin – Sabtu, 08.00 – 20.00"
                    className={inputCls}
                  />
                </Field>
                <Field label="Link Google Maps" hint="Opsional — untuk tombol petunjuk arah.">
                  <input
                    type="text"
                    value={config.contact.googleMapsUrl || ''}
                    onChange={(e) => patchContact({ googleMapsUrl: e.target.value })}
                    placeholder="https://maps.google.com/..."
                    className={`${inputCls} font-mono`}
                  />
                </Field>
              </div>

              <Field label="Template Pesan WhatsApp" hint="Pesan otomatis saat pelanggan menekan tombol order.">
                <textarea
                  rows={3}
                  value={config.contact.whatsappMessageTemplate}
                  onChange={(e) => patchContact({ whatsappMessageTemplate: e.target.value })}
                  className={textareaCls}
                />
              </Field>

              {/* Toko & Cabang */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Toko / Cabang (Halaman Kontak)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const item: LandingOffice = {
                        id: newId('office'),
                        name: 'Cabang Baru',
                        address: 'Alamat lengkap cabang…',
                        phone: '',
                        isActive: true,
                      };
                      setConfig((prev) => ({ ...prev, offices: [...prev.offices, item] }));
                      setOpenOfficeId(item.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Cabang
                  </button>
                </div>
                {config.offices.map((o) => {
                  const open = openOfficeId === o.id;
                  return (
                    <div key={o.id} className={`rounded-lg border p-2 transition-all ${open ? 'border-purple-300 bg-purple-50/30' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenOfficeId(open ? null : o.id)}
                          className="flex-1 flex items-center gap-2 text-left min-w-0 cursor-pointer"
                        >
                          {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          <span className="text-xs font-black text-slate-900 truncate">{o.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateOffice(o.id, { isActive: !o.isActive })}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer shrink-0 ${
                            o.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {o.isActive ? 'Tampil' : 'Sembunyi'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, offices: prev.offices.filter((x) => x.id !== o.id) }))}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {open && (
                        <div className="mt-2 space-y-2 pt-2 border-t border-purple-100">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Field label="Nama">
                              <input
                                type="text"
                                value={o.name}
                                onChange={(e) => updateOffice(o.id, { name: e.target.value })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="No. WhatsApp/Telepon">
                              <input
                                type="text"
                                value={o.phone}
                                onChange={(e) => updateOffice(o.id, { phone: e.target.value })}
                                className={`${inputCls} font-mono`}
                              />
                            </Field>
                            <Field label="Tampil?">
                              <button
                                type="button"
                                onClick={() => updateOffice(o.id, { isActive: !o.isActive })}
                                className={`w-full px-3 py-2 rounded-lg text-[11px] font-bold ${o.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}
                              >
                                {o.isActive ? 'Tampil di halaman' : 'Disembunyikan'}
                              </button>
                            </Field>
                          </div>
                          <Field label="Alamat Lengkap">
                            <textarea
                              rows={2}
                              value={o.address}
                              onChange={(e) => updateOffice(o.id, { address: e.target.value })}
                              className={textareaCls}
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Media Sosial */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Media Sosial & Tautan (Footer & Kontak)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        socials: [...prev.socials, { id: newId('soc'), label: 'Media Sosial Baru', url: 'https://', isActive: true }],
                      }))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah
                  </button>
                </div>
                {config.socials.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={s.label}
                      onChange={(e) => updateSocial(s.id, { label: e.target.value })}
                      placeholder="Instagram"
                      className={`${inputCls} w-36 shrink-0`}
                    />
                    <input
                      type="text"
                      value={s.url}
                      onChange={(e) => updateSocial(s.id, { url: e.target.value })}
                      className={`${inputCls} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => updateSocial(s.id, { isActive: !s.isActive })}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer shrink-0 ${
                        s.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                      }`}
                      title="Tampilkan/sembunyikan"
                    >
                      {s.isActive ? 'Tampil' : 'Sembunyi'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, socials: prev.socials.filter((x) => x.id !== s.id) }))}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </SectionShell>
          )}
        </div>

        {/* Pratinjau langsung */}
        <div className="xl:sticky xl:top-20">
          <LivePreview config={config} />
        </div>
      </div>
    </div>
  );
};

/* ==================== Sub-komponen ==================== */

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-2 mb-1">
      <label className="text-[11px] font-bold text-slate-600">{label}</label>
      {hint && <span className="text-[10px] text-slate-400 font-medium text-right">{hint}</span>}
    </div>
    {children}
  </div>
);

/** Editor daftar teks sederhana (fitur merk / highlight layanan) */
const StringListEditor: React.FC<{
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}> = ({ label, hint, items, onChange, placeholder }) => (
  <Field label={label} hint={hint}>
    <div className="space-y-1.5">
      {items.length === 0 && (
        <p className="text-[11px] text-slate-400 italic px-1">Belum ada poin. Tambahkan di bawah.</p>
      )}
      {items.map((val, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <input
            type="text"
            value={val}
            onChange={(e) => onChange(items.map((v, i) => (i === index ? e.target.value : v)))}
            placeholder={placeholder}
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
            title="Hapus poin"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all cursor-pointer"
      >
        <Plus className="w-3 h-3 text-indigo-600" />
        Tambah poin
      </button>
    </div>
  </Field>
);

/* ============================================================
   Upload gambar: kompres otomatis (canvas JPEG) + preview + rekom
   ============================================================ */

/** Baca file gambar → data URL JPEG terkompresi (maks. width tertentu). */
function processImageFile(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid.'));
      img.onload = () => {
        try {
          const scale = Math.min(1, maxWidth / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas tidak tersedia.');
          ctx.fillStyle = '#ffffff'; // latar putih agar PNG transparan aman jadi JPEG
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const ImageUploadField: React.FC<{
  label: string;
  hint?: string;
  value?: string; // dataURL gambar tersimpan
  onChange: (value: string | undefined) => void;
  recWidth: number;
  recHeight: number;
  maxWidth?: number; // target resolusi maksimum setelah kompresi
}> = ({ label, hint, value, onChange, recWidth, recHeight, maxWidth = 1200 }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('File harus berupa gambar (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      window.alert('Ukuran file terlalu besar (maks 8 MB). Kompres dulu di aplikasi foto.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await processImageFile(file, maxWidth);
      const approxKb = Math.round((dataUrl.length * 3) / 4 / 1024);
      onChange(dataUrl);
      if (approxKb > 300) {
        window.alert(
          `Gambar tersimpan (${approxKb} KB). Ukuran cukup besar — sebaiknya gunakan sisi ${recWidth}×${recHeight}px agar total penyimpanan halaman tetap ringan.`
        );
      }
    } catch (err) {
      window.alert('Gagal memproses gambar. Coba file lain.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const aspect = `${recWidth} / ${recHeight}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-[11px] font-bold text-slate-700">{label}</div>
          <div className="text-[10px] text-slate-400 font-medium">
            Rekomendasi ukuran: {recWidth} × {recHeight} px{hint ? ` · ${hint}` : ''}
          </div>
        </div>
        {value && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Hapus gambar ini?')) onChange(undefined);
            }}
            className="px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold cursor-pointer hover:bg-rose-100 shrink-0"
          >
            Hapus
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Preview */}
        <div
          className="w-full sm:w-56 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white"
          style={{ aspectRatio: aspect }}
        >
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-300">
              <ImageIcon className="w-7 h-7" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Belum ada foto</span>
            </div>
          )}
        </div>

        {/* Tombol upload */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            {busy ? 'Memproses…' : value ? 'Ganti Gambar' : 'Unggah Gambar'}
          </button>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Gambar otomatis dikompresi (lebar maks {maxWidth}px, JPEG) agar halaman tetap ringan.
            Gunakan foto yang terang, tajam, dan bebas watermark.
          </p>
        </div>
      </div>
    </div>
  );
};

const SectionShell: React.FC<{
  icon: React.ElementType;
  iconChip: string;
  title: string;
  desc: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon: Icon, iconChip, title, desc, action, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`p-2 rounded-lg shrink-0 ${iconChip}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-slate-900 truncate">{title}</h2>
          <p className="text-[11px] text-slate-500 truncate">{desc}</p>
        </div>
      </div>
      {action}
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

/** Pratinjau mini landing page — ikut berubah saat mengetik */
const LivePreview: React.FC<{ config: LandingPageConfig }> = ({ config }) => {
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const [slideIdx, setSlideIdx] = useState(0);

  const activeSlides = useMemo(
    () => (config.slides || []).filter((s) => s.isActive),
    [config.slides]
  );
  const activeBrands = config.brands.filter((b) => b.isActive).slice(0, 8);
  const activeServices = config.services.filter((s) => s.isActive);
  const activeProducts = config.featuredProducts.filter((p) => p.isActive);
  const activeTestimonials = config.testimonials.filter((t) => t.isActive);
  const activeClients = config.clients.filter((c) => c.isActive);
  const activeSocials = config.socials.filter((s) => s.isActive);
  const activeOffices = config.offices.filter((o) => o.isActive);

  // Rotasi slide banner tiap 4 detik (persis seperti slider publik)
  useEffect(() => {
    if (activeSlides.length <= 1) {
      setSlideIdx(0);
      return;
    }
    const t = window.setInterval(() => {
      setSlideIdx((i) => (i + 1) % activeSlides.length);
    }, 4000);
    return () => window.clearInterval(t);
  }, [activeSlides.length]);

  const currentSlide = activeSlides.length
    ? activeSlides[Math.min(slideIdx, activeSlides.length - 1)]
    : null;
  const isMobile = mode === 'mobile';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase tracking-wider">
          <Eye className="w-3.5 h-3.5 text-indigo-600" />
          Pratinjau Langsung
        </span>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setMode('desktop')}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              mode === 'desktop' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
            title="Tampilan desktop"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMode('mobile')}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              mode === 'mobile' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
            title="Tampilan ponsel"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chrome browser mini */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 border-b border-slate-200">
        <span className="w-2 h-2 rounded-full bg-rose-400" />
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="ml-2 flex-1 truncate text-[9px] font-mono text-slate-500 bg-white border border-slate-200 rounded px-2 py-0.5">
          bejostiker.local
        </span>
      </div>

      <div className={`mx-auto transition-all duration-300 ${isMobile ? 'max-w-[270px]' : 'max-w-full'}`}>
        <div className="max-h-[70vh] overflow-y-auto bg-slate-50 text-slate-800">
          {/* Pita pengumuman */}
          {config.hero.bannerAnnouncement && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white text-[8px] font-bold text-center py-1 px-2 truncate">
              {config.hero.bannerAnnouncement}
            </div>
          )}

          {/* Mini header + menu halaman */}
          <div className="bg-white border-b border-slate-200 px-2.5 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-4 h-4 rounded bg-indigo-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-black text-slate-900 truncate leading-tight">BEJO STIKER</div>
                <div className="text-[6px] font-bold text-indigo-700 uppercase tracking-wider truncate">
                  Stiker • Printing • Laser
                </div>
              </div>
            </div>
            <div className={isMobile ? 'hidden' : 'flex items-center gap-1.5 shrink-0'}>
              {['Beranda', 'Tentang', 'Produk', 'Klien', 'Kontak'].map((m, i) => (
                <span
                  key={m}
                  className={`text-[7px] font-bold px-1 ${
                    i === 0 ? 'text-indigo-600 border-b border-indigo-600' : 'text-slate-500'
                  }`}
                >
                  {m}
                </span>
              ))}
            </div>
            <span
              className={`${
                isMobile ? 'text-[7px] px-1.5 py-0.5' : 'text-[8px] px-2 py-0.5'
              } font-black bg-indigo-600 text-white rounded shrink-0`}
            >
              Masuk
            </span>
          </div>

          {/* Slider banner utama — hanya gambar */}
          <div className="relative bg-slate-950 overflow-hidden">
            <div className="aspect-[1600/700] relative">
              {currentSlide && currentSlide.imageUrl ? (
                <img src={currentSlide.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="text-[6.5px] font-bold uppercase tracking-wider">Banner belum diunggah</span>
                </div>
              )}
              {activeSlides.length > 1 && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1">
                  {activeSlides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSlideIdx(i)}
                      className={`h-0.5 rounded-full transition-all cursor-pointer ${
                        i === slideIdx ? 'w-3 bg-emerald-400' : 'w-1.5 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Keunggulan (Our Advantages) */}
          {config.benefits.length > 0 && (
            <div className="px-2.5 py-2 space-y-1">
              <div className="text-[6px] font-black uppercase tracking-widest text-indigo-600 text-center">
                Our Advantages
              </div>
              <div className={`grid gap-1 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
                {config.benefits.slice(0, isMobile ? 4 : 4).map((b, i2) => (
                  <div key={i2} className="bg-white rounded border border-slate-200 p-1.5">
                    <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200 mb-0.5" />
                    <div className="text-[7px] font-black text-slate-900 truncate">{b.title}</div>
                    <div className="text-[6px] text-slate-400 line-clamp-2">{b.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tentang Kami (ringkas) */}
          <div className={`px-2.5 py-2 space-y-1.5 ${isMobile ? '' : 'flex gap-2 items-center'}`}>
            <div
              className={`${
                isMobile ? 'w-full' : 'w-24 shrink-0'
              } aspect-[4/3] rounded bg-slate-100 border border-slate-200 overflow-hidden`}
            >
              {config.about.imageUrl ? (
                <img src={config.about.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <ImageIcon className="w-3 h-3" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-[6px] font-black uppercase tracking-widest text-indigo-600">
                {config.about.eyebrow}
              </div>
              <div className="text-[9px] font-black text-slate-900 line-clamp-2">{config.about.title}</div>
              <div className={`grid gap-0.5 ${isMobile ? 'grid-cols-4' : 'grid-cols-2'}`}>
                {config.about.stats.slice(0, 4).map((st, i2) => (
                  <div key={i2} className="bg-white border border-slate-200 rounded px-1 py-0.5 text-center">
                    <div className="text-[7px] font-black text-indigo-700">{st.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Produk unggulan dengan foto */}
          {activeProducts.length > 0 && (
            <div className="px-2.5 py-2 border-t border-slate-200 space-y-1">
              <div className="text-[6px] font-black uppercase tracking-widest text-indigo-600">Produk Unggulan</div>
              <div className="grid grid-cols-2 gap-1">
                {activeProducts.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded border border-slate-200 overflow-hidden"
                  >
                    <div className="relative aspect-square bg-slate-100">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ImageIcon className="w-3 h-3" />
                        </div>
                      )}
                      <span className="absolute top-1 left-1 text-[5px] font-black bg-slate-950/80 text-white rounded px-1 py-px uppercase">
                        {p.brand}
                      </span>
                    </div>
                    <div className="p-1">
                      <div className="text-[6.5px] font-black text-slate-900 line-clamp-2 leading-tight">{p.name}</div>
                      <div className="text-[7px] font-black text-indigo-700 mt-0.5 truncate">{p.priceEstimated}</div>
                    </div>
                  </div>
                ))}
              </div>
              {activeProducts.length > 4 && (
                <div className="text-[6px] font-bold text-slate-400 text-center">
                  +{activeProducts.length - 4} produk lainnya
                </div>
              )}
            </div>
          )}

          {/* Solusi accordion */}
          {activeServices.length > 0 && (
            <div className="px-2.5 py-2 border-t border-slate-200 space-y-1">
              <div className="text-[6px] font-black uppercase tracking-widest text-indigo-600">
                Solusi Percetakan
              </div>
              {activeServices.slice(0, 3).map((s, i2) => (
                <div key={s.id} className="bg-white rounded border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-1 p-1">
                    <span className="w-2.5 h-2.5 rounded bg-slate-900 text-white flex items-center justify-center text-[6px] font-black shrink-0">
                      {i2 === 0 ? '−' : '+'}
                    </span>
                    <span className="text-[7.5px] font-black text-slate-900 truncate">{s.title}</span>
                  </div>
                  {i2 === 0 && (
                    <div className="px-1.5 pb-1.5 space-y-0.5">
                      <div className="text-[6px] text-slate-500 line-clamp-2">{s.description}</div>
                      {s.highlights.slice(0, 2).map((hl, j) => (
                        <div key={j} className="text-[5.5px] font-semibold text-slate-600 bg-slate-50 rounded px-1 py-px truncate border border-slate-100">
                          ✓ {hl}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Testimoni */}
          {activeTestimonials.length > 0 && (
            <div className="px-2.5 py-2 border-t border-slate-200 space-y-1">
              <div className="text-[6px] font-black uppercase tracking-widest text-indigo-600">Testimoni</div>
              <div className="bg-white rounded-lg border border-slate-200 p-2 space-y-1">
                <Quote className="w-2.5 h-2.5 text-indigo-100" />
                <div className="text-[7px] text-slate-700 line-clamp-2">“{activeTestimonials[0].quote}”</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[6.5px] font-black text-slate-900">{activeTestimonials[0].author}</div>
                    <div className="text-[5.5px] text-slate-400">{activeTestimonials[0].company}</div>
                  </div>
                  {activeTestimonials[0].logoUrl ? (
                    <img
                      src={activeTestimonials[0].logoUrl}
                      alt=""
                      className="w-3.5 h-3.5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[5px] font-black text-indigo-700">
                      {activeTestimonials[0].company.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Logo klien */}
          {activeClients.length > 0 && (
            <div className="px-2.5 py-2 border-t border-slate-200 space-y-1">
              <div className="text-[6px] font-black uppercase tracking-widest text-indigo-600">Klien</div>
              <div className={`grid gap-1 ${isMobile ? 'grid-cols-3' : 'grid-cols-4'}`}>
                {activeClients.slice(0, isMobile ? 3 : 4).map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded border border-slate-200 p-1 flex flex-col items-center gap-0.5"
                  >
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt="" className="w-3 h-3 object-contain" />
                    ) : (
                      <Building2 className="w-2.5 h-2.5 text-slate-400" />
                    )}
                    <span className="text-[5.5px] font-bold text-slate-600 text-center truncate w-full">{c.name}</span>
                  </div>
                ))}
              </div>
              {activeClients.length > (isMobile ? 3 : 4) && (
                <div className="text-[6px] font-bold text-slate-400 text-center">
                  +{activeClients.length - (isMobile ? 3 : 4)} klien lainnya
                </div>
              )}
            </div>
          )}

          {/* Kontak + cabang + sosmed */}
          <div className="px-2.5 py-2 border-t border-slate-200 space-y-1">
            <div className="text-[6px] font-black uppercase tracking-widest text-indigo-600">Kontak</div>
            <div className="flex items-center gap-1 text-[7px] text-slate-600">
              <MessageCircle className="w-2 h-2 text-emerald-500 shrink-0" />
              <span className="truncate">{config.contact.whatsappNumber || 'Nomor WhatsApp'}</span>
            </div>
            <div className="flex items-start gap-1 text-[7px] text-slate-600">
              <MapPin className="w-2 h-2 text-rose-500 shrink-0 mt-px" />
              <span className="line-clamp-2">{config.contact.storeAddress || 'Alamat toko'}</span>
            </div>
            <div className="flex items-center gap-1 text-[7px] text-slate-600">
              <Clock className="w-2 h-2 text-amber-500 shrink-0" />
              <span className="truncate">{config.contact.operatingHours || 'Jam operasional'}</span>
            </div>
            {activeOffices.length > 0 && (
              <div className="text-[5.5px] font-bold text-slate-400">
                {activeOffices.length} toko/cabang ditampilkan
              </div>
            )}
            {activeSocials.length > 0 && (
              <div className="flex flex-wrap gap-0.5 pt-0.5">
                {activeSocials.map((s) => (
                  <span
                    key={s.id}
                    className="text-[5.5px] font-bold text-slate-600 bg-white border border-slate-200 rounded px-1 py-px"
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer mini */}
          <div className="bg-slate-950 text-slate-400 px-2.5 py-2 space-y-1">
            <div className="text-[7px] font-black text-white">BEJO STIKER</div>
            <div className="text-[6px] text-slate-500 line-clamp-2">{config.hero.subheadline}</div>
            <div className="text-[5.5px] text-slate-600 flex items-center gap-1 flex-wrap">
              {['Beranda', 'Tentang', 'Produk', 'Klien', 'Kontak'].map((m) => (
                <span key={m} className="border border-slate-800 rounded px-1 py-px">{m}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-500">
          {activeSlides.length} slide ·{' '}
          {config.brands.filter((b) => b.isActive).length} merk ·{' '}
          {activeServices.length} layanan ·{' '}
          {activeProducts.length} produk
        </span>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
            config.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {config.isPublished ? 'PUBLISH' : 'ON HOLD'}
        </span>
      </div>
    </div>
  );
};
