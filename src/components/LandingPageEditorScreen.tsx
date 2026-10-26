/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Landing Page Developer CMS — tata letak ala WordPress Admin
 * (sidebar seksi kiri + editor + pratinjau langsung di kanan)
 *
 * Konten disesuaikan dengan struktur URL referensi uprint.id.
 * Coded by Langgo Bramandityo.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Eye,
  Factory,
  FileText,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Images,
  Info,
  Layers,
  List,
  MapPin,
  Menu,
  Monitor,
  Phone,
  Plus,
  Quote,
  RotateCcw,
  Save,
  Share2,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  Type,
  Upload,
  X,
} from 'lucide-react';
import type {
  LandingBlogPost,
  LandingCategoryCard,
  LandingCategoryGroup,
  LandingFaqItem,
  LandingFacilityItem,
  LandingFooterColumn,
  LandingGalleryItem,
  LandingMenuItem,
  LandingPageConfig,
  LandingPageKey,
  LandingSlide,
  LandingStatItem,
  LandingTemplatePromo,
  LandingTestimonial,
} from '../types';
import {
  buildPublishedLandingConfig,
  isLandingConfigEqual,
  isLandingContentEqual,
  resetLandingDraftToDefault,
  saveStoredLandingDraft,
} from '../utils/landingPageStorage';
import { ensureLandingMediaInDatabase, saveLandingMedia } from '../utils/landingMediaStorage';
import { LandingPage } from './landing/LandingPage';

/* -------------------------------------------------------------------------- */
/*  Gaya dasar (selaras tab lain: kartu putih, slate, aksen indigo)           */
/* -------------------------------------------------------------------------- */
const inputCls =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all';
const areaCls = `${inputCls} resize-none leading-relaxed`;
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';
const hintCls = 'mt-1 text-[10px] font-medium text-slate-400';
const btnPrimary =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wide hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnGhost =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-50 transition-colors';
const btnDanger =
  'inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors';

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const moveItem = <T,>(arr: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/* -------------------------------------------------------------------------- */
/*  Kompresi gambar di browser (canvas → JPEG)                                */
/* -------------------------------------------------------------------------- */
const compressImage = (
  file: File,
  maxW: number,
  maxH: number,
  quality = 0.82,
  output: 'jpeg' | 'png' | string = 'jpeg'
): Promise<string> =>
  new Promise((resolve, reject) => {
    const format = output === 'png' ? 'png' : 'jpeg';
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Berkas bukan gambar yang valid'));
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas tidak tersedia'));
        if (format === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

/* -------------------------------------------------------------------------- */
/*  Kontrol dasar                                                             */
/* -------------------------------------------------------------------------- */
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label,
  hint,
  children,
  className,
}) => (
  <div className={className}>
    <label className={labelCls}>{label}</label>
    {children}
    {hint && <p className={hintCls}>{hint}</p>}
  </div>
);

const Toggle: React.FC<{ active: boolean; onChange: (v: boolean) => void; label?: string }> = ({
  active,
  onChange,
  label,
}) => (
  <button
    type="button"
    onClick={() => onChange(!active)}
    aria-pressed={active}
    className="flex items-center gap-2"
  >
    <span className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span
        className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${active ? 'left-[16px]' : 'left-[2px]'}`}
      />
    </span>
    <span className={`text-[10px] font-bold uppercase tracking-wide ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
      {label || (active ? 'Aktif' : 'Nonaktif')}
    </span>
  </button>
);

const ImageField: React.FC<{
  value?: string;
  onChange: (v?: string) => void;
  recommended: string;
  maxW: number;
  maxH: number;
  label?: string;
  aspect?: string;
  output?: 'jpeg' | 'png';
  hint?: string;
}> = ({ value, onChange, recommended, maxW, maxH, label, aspect = '16 / 9', output = 'jpeg', hint }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await compressImage(file, maxW, maxH, 0.82, output);
      const mediaUrl = await saveLandingMedia(dataUrl);
      onChange(mediaUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memproses gambar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {label && <label className={labelCls}>{label}</label>}
      <div
        className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50"
        style={{ aspectRatio: aspect }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        {value ? (
          <>
            <img src={value} alt="Pratinjau" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity hover:opacity-100">
              <button type="button" onClick={() => inputRef.current?.click()} className="rounded-md bg-white px-3 py-1.5 text-[10px] font-bold text-slate-800">
                Ganti
              </button>
              <button type="button" onClick={() => onChange(undefined)} className="rounded-md bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white">
                Hapus
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
              {busy ? <Sparkles size={16} className="animate-pulse" /> : <Upload size={16} />}
            </span>
            <span className="text-[11px] font-bold text-slate-600">{busy ? 'Memproses…' : 'Klik / seret gambar'}</span>
            <span className="text-[10px] font-medium text-slate-400">{recommended}</span>
          </button>
        )}
      </div>
      {value && (
        <p className="mt-1 text-[10px] font-medium text-slate-400">
          Rekomendasi {recommended} · dikompres otomatis &amp; disimpan ke database
          {output === 'png' ? ' (PNG, transparansi dipertahankan)' : ''}
        </p>
      )}
      {hint && <p className="mt-1 text-[10px] font-medium text-slate-500">{hint}</p>}
      {err && <p className="mt-1 text-[10px] font-semibold text-rose-500">{err}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
};

const SectionCard: React.FC<{ title: string; description: string; children: React.ReactNode; aside?: React.ReactNode }> = ({
  title,
  description,
  children,
  aside,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-900">{title}</h2>
        <p className="mt-0.5 text-[11px] font-medium text-slate-500">{description}</p>
      </div>
      {aside}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const ItemAccordion: React.FC<{
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUp?: () => void;
  onDown?: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, subtitle, open, onToggle, onDelete, onUp, onDown, right, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white">
    <div className="flex items-center gap-2 px-3 py-2.5">
      <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-2 text-left">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[11.5px] font-bold text-slate-800">{title || '(tanpa judul)'}</span>
          {subtitle && <span className="block truncate text-[10px] font-medium text-slate-400">{subtitle}</span>}
        </span>
      </button>
      {right}
      <div className="flex items-center gap-0.5">
        {onUp && (
          <button type="button" onClick={onUp} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Naikkan">
            <ChevronUp size={13} />
          </button>
        )}
        {onDown && (
          <button type="button" onClick={onDown} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Turunkan">
            <ChevronDown size={13} />
          </button>
        )}
        <button type="button" onClick={onDelete} className={btnDanger} title="Hapus" aria-label={`Hapus ${id}`}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
    {open && <div className="border-t border-slate-100 p-4">{children}</div>}
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Opsi tujuan tautan                                                        */
/* -------------------------------------------------------------------------- */
const PAGE_OPTIONS: Array<{ value: LandingPageKey; label: string }> = [
  { value: 'home', label: 'Beranda' },
  { value: 'products', label: 'Produk' },
  { value: 'about', label: 'Tentang Kami' },
  { value: 'clients', label: 'Klien Kami' },
  { value: 'blog', label: 'Inspirasi Cetak' },
  { value: 'contact', label: 'Kontak' },
];

const targetValue = (link: { page?: LandingPageKey; categoryKey?: string }) =>
  link.page ? `page:${link.page}` : link.categoryKey ? `cat:${link.categoryKey}` : '';

const applyTarget = (value: string) => {
  if (value.startsWith('page:')) return { page: value.slice(5) as LandingPageKey, categoryKey: undefined };
  if (value.startsWith('cat:')) return { categoryKey: value.slice(4), page: undefined };
  return { page: undefined, categoryKey: undefined };
};

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */
interface LandingPageEditorScreenProps {
  initialConfig: LandingPageConfig;
  publishedConfig: LandingPageConfig;
  onDraftUpdated: (newConfig: LandingPageConfig) => Promise<void>;
  onPublish: (publishedConfig: LandingPageConfig) => Promise<void>;
  onUnpublish: () => Promise<void>;
  onPreviewLandingPage: () => void;
}

const SECTIONS = [
  { key: 'brand', label: 'Identitas & Logo', icon: Store },
  { key: 'hero', label: 'Judul Utama', icon: Type },
  { key: 'slides', label: 'Banner Hero', icon: Images },
  { key: 'menu', label: 'Menu Navigasi', icon: Menu },
  { key: 'categories', label: 'Kategori & Kartu', icon: Layers },
  { key: 'templates', label: 'Template Design', icon: Sparkles },
  { key: 'problem', label: 'Problem Customer', icon: CircleAlert },
  { key: 'stats', label: 'Mengapa Kami', icon: TrendingUp },
  { key: 'facilities', label: 'Fasilitas Produksi', icon: Factory },
  { key: 'clients', label: 'Klien Kami', icon: Building2 },
  { key: 'testimonials', label: 'Testimoni', icon: Quote },
  { key: 'blog', label: 'Blog / Inspirasi', icon: FileText },
  { key: 'faq', label: 'FAQ', icon: HelpCircle },
  { key: 'about', label: 'Tentang Kami', icon: Info },
  { key: 'gallery', label: 'Galeri Workshop', icon: Images },
  { key: 'contact', label: 'Kontak', icon: Phone },
  { key: 'offices', label: 'Kantor Cabang', icon: MapPin },
  { key: 'socials', label: 'Media Sosial', icon: Share2 },
  { key: 'footer', label: 'Footer', icon: List },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

/* -------------------------------------------------------------------------- */
/*  Pratinjau langsung (iframe agar media query mengikuti lebar perangkat)     */
/* -------------------------------------------------------------------------- */
const LivePreview: React.FC<{ config: LandingPageConfig; device: 'desktop' | 'mobile' }> = ({ config, device }) => {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [frameDoc, setFrameDoc] = useState<Document | null>(null);
  const [pane, setPane] = useState({ w: 400, h: 620 });

  const baseWidth = device === 'mobile' ? 390 : 1280;
  const scale = Math.min(1, Math.max(0.2, (pane.w - 12) / baseWidth));
  const frameHeight = Math.max(320, pane.h / scale);

  /* ukur panel */
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPane({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setPane({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* salin stylesheet aplikasi ke dalam iframe */
  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;
    doc.head.innerHTML = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      doc.head.appendChild(node.cloneNode(true));
    });
    doc.documentElement.style.background = '#ffffff';
    doc.body.style.margin = '0';
    doc.body.style.background = '#ffffff';
    setFrameDoc(doc);
    return () => setFrameDoc(null);
  }, [device]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">Pratinjau Langsung</p>
          <p className="text-[10px] font-medium text-slate-400">
            {device === 'mobile' ? 'Tampilan ponsel · 390 px' : 'Tampilan desktop · 1280 px'}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-bold uppercase text-indigo-600">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Pratinjau Draft
        </span>
      </div>

      <div ref={paneRef} className="relative flex-1 overflow-hidden bg-slate-100">
        <iframe
          ref={frameRef}
          title="Pratinjau landing page"
          style={{
            width: baseWidth,
            height: frameHeight,
            border: 0,
            display: 'block',
            background: '#ffffff',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            marginLeft: Math.max(0, (pane.w - baseWidth * scale) / 2),
          }}
        />
        {frameDoc &&
          createPortal(
            <LandingPage config={config} currentUser={null} onOpenLogin={() => {}} embedded />,
            frameDoc.body
          )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Editor utama                                                              */
/* -------------------------------------------------------------------------- */
export const LandingPageEditorScreen: React.FC<LandingPageEditorScreenProps> = ({
  initialConfig,
  publishedConfig,
  onDraftUpdated,
  onPublish,
  onUnpublish,
  onPreviewLandingPage,
}) => {
  const [config, setConfig] = useState<LandingPageConfig>(initialConfig);
  const [savedJson, setSavedJson] = useState<string>(() => JSON.stringify(initialConfig));
  const [active, setActive] = useState<SectionKey>('brand');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'save' | 'publish' | 'hold' | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [q, setQ] = useState('');

  const isDirty = useMemo(() => !isLandingConfigEqual(config, JSON.parse(savedJson)), [config, savedJson]);
  const hasUnpublishedChanges = useMemo(
    () => !isLandingContentEqual(config, publishedConfig),
    [config, publishedConfig]
  );
  const isLive = Boolean(publishedConfig.isPublished);

  /* panjang deskripsi website (meta description) */
  const descLength = (config.brand?.metaDescription || '').trim().length;

  /* simpan config terbaru agar klik "Simpan" tidak menyimpan state basi */
  const configRef = useRef<LandingPageConfig>(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  /* Ikuti draft cloud terbaru selama belum ada perubahan yang belum disimpan. */
  useEffect(() => {
    if (!isDirty) {
      setConfig(initialConfig);
      setSavedJson(JSON.stringify(initialConfig));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConfig]);

  const notify = (msg: string) => {
    setNotice(msg);
    setErrorNotice(null);
    window.setTimeout(() => setNotice(null), 5000);
  };

  const notifyError = (err: unknown) => {
    setNotice(null);
    setErrorNotice(err instanceof Error && err.message ? err.message : 'Terjadi kesalahan. Coba lagi.');
  };

  /**
   * Simpan draft: gambar inline dipindahkan ke database, config disimpan ke
   * localStorage + record `landing_config_draft`. Konten live TIDAK berubah.
   */
  const persistDraft = async (): Promise<LandingPageConfig | null> => {
    setBusyAction('save');
    setErrorNotice(null);
    try {
      const prepared = await ensureLandingMediaInDatabase(configRef.current);
      const saved = saveStoredLandingDraft(prepared);
      setConfig(saved);
      setSavedJson(JSON.stringify(saved));
      await onDraftUpdated(saved);
      const mb = JSON.stringify(saved).length / (1024 * 1024);
      notify(
        mb > 4
          ? `Draft tersimpan (${mb.toFixed(1)} MB). Pertimbangkan mengganti gambar besar agar lebih ringan.`
          : 'Draft tersimpan. Klik "Simpan & Publish" agar tampil live di internet.'
      );
      return saved;
    } catch (err) {
      notifyError(err);
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const handlePublish = async () => {
    setBusyAction('publish');
    setErrorNotice(null);
    try {
      const prepared = await ensureLandingMediaInDatabase(configRef.current);
      const draft = saveStoredLandingDraft(prepared);
      setConfig(draft);
      setSavedJson(JSON.stringify(draft));
      await onDraftUpdated(draft);
      await onPublish(buildPublishedLandingConfig(draft));
      notify('Landing page berhasil dipublikasikan dan sudah live di internet.');
    } catch (err) {
      notifyError(err);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUnpublish = async () => {
    setBusyAction('hold');
    setErrorNotice(null);
    try {
      await onUnpublish();
      notify('Landing page dinonaktifkan (On Hold). Konten draft tetap tersimpan.');
    } catch (err) {
      notifyError(err);
    } finally {
      setBusyAction(null);
    }
  };

  const patch = (partial: Partial<LandingPageConfig>) => setConfig((prev) => ({ ...prev, ...partial }));
  const patchSub = <K extends keyof LandingPageConfig>(key: K, partial: Partial<LandingPageConfig[K]>) =>
    setConfig((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...(partial as object) } as LandingPageConfig[K] }));

  /* ---- helper daftar generik ---- */
  const updateList = <K extends keyof LandingPageConfig>(key: K, items: LandingPageConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: items }));

  const count = (key: SectionKey): number => {
    switch (key) {
      case 'slides': return config.slides.length;
      case 'menu': return config.menu.length;
      case 'categories': return config.categories.reduce((n, c) => n + c.cards.length, 0);
      case 'templates': return config.templatePromos.length;
      case 'problem': return config.problem.points.length;
      case 'stats': return config.stats.length;
      case 'facilities': return config.facilities.length;
      case 'clients': return config.clients.length;
      case 'testimonials': return config.testimonials.length;
      case 'blog': return config.blogPosts.length;
      case 'faq': return config.faqs.length;
      case 'gallery': return config.gallery.length;
      case 'offices': return config.offices.length;
      case 'socials': return config.socials.length;
      case 'footer': return config.footerColumns.length;
      default: return 0;
    }
  };

  const filteredSections = SECTIONS.filter((s) => s.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Globe size={18} />
          </span>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-slate-900">
              Landing Page CMS
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${isLive ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {isLive ? 'Published' : 'On Hold'}
              </span>
              {hasUnpublishedChanges && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-600">
                  Draft belum dipublish
                </span>
              )}
              {isDirty && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase text-indigo-600">Belum disimpan</span>}
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Simpan hanya menyimpan draft. Klik "Simpan &amp; Publish" agar perubahan tampil live di internet.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const def = resetLandingDraftToDefault();
              setConfig(def);
              notify('Draft dikembalikan ke default. Konten live belum berubah sampai Anda klik "Simpan & Publish".');
            }}
            className={btnGhost}
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            type="button"
            onClick={() => {
              setDevice((d) => (d === 'desktop' ? 'mobile' : 'desktop'));
            }}
            className={btnGhost}
          >
            {device === 'desktop' ? <Monitor size={12} /> : <Smartphone size={12} />}
            {device === 'desktop' ? 'Desktop' : 'Mobile'}
          </button>
          <button type="button" onClick={() => setShowPreview((v) => !v)} className={btnGhost}>
            <Eye size={12} /> {showPreview ? 'Sembunyikan' : 'Pratinjau'}
          </button>
          <button type="button" onClick={onPreviewLandingPage} className={btnGhost}>
            <Globe size={12} /> Halaman Publik
          </button>
          <button
            type="button"
            disabled={!isDirty || busyAction !== null}
            onClick={() => setConfig(JSON.parse(savedJson))}
            className={btnGhost}
          >
            <X size={12} /> Batal
          </button>
          <button
            type="button"
            disabled={!isDirty || busyAction !== null}
            onClick={() => void persistDraft()}
            className={btnPrimary}
          >
            <Save size={12} /> {busyAction === 'save' ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button
            type="button"
            disabled={busyAction !== null || (!isDirty && !hasUnpublishedChanges && isLive)}
            onClick={() => void handlePublish()}
            className={`${btnPrimary} !bg-emerald-600 hover:!bg-emerald-500`}
          >
            <Globe size={12} /> {busyAction === 'publish' ? 'Mempublikasikan…' : 'Simpan & Publish'}
          </button>
          {isLive && (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleUnpublish()}
              className={`${btnGhost} !border-amber-200 !text-amber-600 hover:!bg-amber-50`}
            >
              <CircleAlert size={12} /> {busyAction === 'hold' ? 'Menonaktifkan…' : 'On Hold'}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[11px] font-semibold text-emerald-700">
          <Check size={14} /> {notice}
        </div>
      )}

      {errorNotice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[11px] font-semibold text-rose-700">
          <CircleAlert size={14} /> {errorNotice}
        </div>
      )}

      <div className={`grid gap-4 ${showPreview ? 'xl:grid-cols-[236px_minmax(0,1fr)_430px]' : 'xl:grid-cols-[236px_minmax(0,1fr)]'}`}>
        {/* Sidebar */}
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
            <Search size={12} className="text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari seksi…"
              className="w-full bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <nav className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-col md:gap-0.5 md:overflow-visible">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              const n = count(section.key);
              const isActive = active === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => {
                    setActive(section.key);
                    setOpenItem(null);
                  }}
                  className={`flex w-auto shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px] font-semibold transition-colors md:w-full ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={13} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span className="flex-1 truncate">{section.label}</span>
                  {n > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Editor */}
        <div className="min-w-0 space-y-4">
          {/* ============================ IDENTITAS ============================ */}
          {active === 'brand' && (
            <SectionCard title="Identitas & Logo" description="Logo, favicon, dan deskripsi website yang tampil pada header, tab browser, dan mesin pencari.">
              <div className="grid gap-5 md:grid-cols-2">
                <ImageField
                  label="Logo (PNG transparan)"
                  value={config.brand.logoUrl}
                  onChange={(v) => patchSub('brand', { logoUrl: v })}
                  recommended="400 × 150 px"
                  maxW={800}
                  maxH={300}
                  aspect="8 / 3"
                />
                <div className="space-y-4">
                  <div className="max-w-[220px]">
                    <ImageField
                      label="Favicon (Ikon Tab Browser)"
                      value={config.brand.faviconUrl}
                      onChange={(v) => patchSub('brand', { faviconUrl: v })}
                      recommended="64 × 64 px"
                      maxW={256}
                      maxH={256}
                      aspect="1 / 1"
                      output="png"
                      hint="PNG transparan agar ikon tetap rapi di tab browser."
                    />
                  </div>
                  {/* Pratinjau favicon + judul tab browser */}
                  <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Pratinjau Tab Browser
                    </p>
                    <span className="flex w-fit max-w-full items-center gap-2 rounded-t-lg border border-b-0 border-slate-200 bg-white px-2.5 py-1.5">
                      {config.brand.faviconUrl ? (
                        <img src={config.brand.faviconUrl} alt="Favicon" className="h-4 w-4 shrink-0 object-contain" />
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded bg-slate-200" />
                      )}
                      <span className="truncate text-[11px] font-semibold text-slate-700">
                        {config.brand.siteTitle || 'Bejo Stiker POS'}
                      </span>
                    </span>
                    <Field
                      label="Judul Website (Teks Tab Browser)"
                      hint="Tampil di sebelah favicon pada tab browser dan sebagai judul di hasil pencarian."
                    >
                      <input
                        value={config.brand.siteTitle || ''}
                        onChange={(e) => patchSub('brand', { siteTitle: e.target.value })}
                        className={inputCls}
                        placeholder="Contoh: BEJO STIKER & DIGITAL PRINTING"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="space-y-4">
                  <Field label="Nama Merek" hint="Dipakai bila logo belum diunggah.">
                    <input value={config.brand.name} onChange={(e) => patchSub('brand', { name: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Tagline" hint="Tampil kecil di bawah logo.">
                    <input value={config.brand.tagline} onChange={(e) => patchSub('brand', { tagline: e.target.value })} className={inputCls} />
                  </Field>
                </div>

                <div>
                  <Field
                    label="Deskripsi Website (Meta Description)"
                    hint="Tampil di hasil pencarian Google & ketika tautan dibagikan di WhatsApp/media sosial."
                  >
                    <textarea
                      rows={4}
                      maxLength={320}
                      value={config.brand.metaDescription || ''}
                      onChange={(e) => patchSub('brand', { metaDescription: e.target.value })}
                      className={areaCls}
                      placeholder="Contoh: BEJO STIKER & DIGITAL PRINTING adalah percetakan online untuk cetak kemasan custom, kartu nama, banner, dan souvenir bisnis dengan kirim ke seluruh Indonesia."
                    />
                  </Field>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium text-slate-500">
                      Ideal 150–160 karakter. Terlalu pendek kurang informatif, terlalu panjang akan terpotong di Google.
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        descLength === 0
                          ? 'bg-slate-100 text-slate-400'
                          : descLength < 70
                            ? 'bg-amber-50 text-amber-600'
                            : descLength <= 160
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {descLength} karakter
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ============================== HERO =============================== */}
          {active === 'hero' && (
            <SectionCard title="Judul Utama" description="Judul H1 dan paragraf pembuka di bawah slider banner.">
              <div className="space-y-4">
                <Field label="Judul H1">
                  <input value={config.hero.headline} onChange={(e) => patchSub('hero', { headline: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Paragraf Pembuka">
                  <textarea rows={4} value={config.hero.subheadline} onChange={(e) => patchSub('hero', { subheadline: e.target.value })} className={areaCls} />
                </Field>
              </div>
            </SectionCard>
          )}

          {/* ============================= SLIDES ============================== */}
          {active === 'slides' && (
            <SectionCard
              title={`Banner Hero (${config.slides.length})`}
              description="Slider gambar utama. Rekomendasi 1280 × 720 px (16:9)."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const slide: LandingSlide = {
                      id: newId('slide'),
                      eyebrow: 'TEMPLATE DESIGN',
                      title: 'Judul Banner Baru',
                      subtitle: '',
                      ctaText: 'Klik Di Sini',
                      imageUrl: undefined,
                      isActive: true,
                    };
                    updateList('slides', [...config.slides, slide]);
                    setOpenItem(slide.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="space-y-2.5">
                {config.slides.map((slide, i) => (
                  <ItemAccordion
                    key={slide.id}
                    id={slide.id}
                    title={slide.title || `Slide ${i + 1}`}
                    subtitle={`${slide.eyebrow} · ${slide.imageUrl ? 'gambar siap' : 'belum ada gambar'}`}
                    open={openItem === slide.id}
                    onToggle={() => setOpenItem(openItem === slide.id ? null : slide.id)}
                    onDelete={() => updateList('slides', config.slides.filter((s) => s.id !== slide.id))}
                    onUp={i > 0 ? () => updateList('slides', moveItem(config.slides, i, i - 1)) : undefined}
                    onDown={i < config.slides.length - 1 ? () => updateList('slides', moveItem(config.slides, i, i + 1)) : undefined}
                    right={<Toggle active={slide.isActive} onChange={(v) => updateList('slides', config.slides.map((s) => (s.id === slide.id ? { ...s, isActive: v } : s)))} />}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <ImageField
                        label="Foto Banner"
                        value={slide.imageUrl}
                        onChange={(v) => updateList('slides', config.slides.map((s) => (s.id === slide.id ? { ...s, imageUrl: v } : s)))}
                        recommended="1280 × 720 px"
                        maxW={1600}
                        maxH={900}
                      />
                      <div className="space-y-3">
                        <Field label="Label Kecil (eyebrow)" hint="Contoh: TEMPLATE DESIGN">
                          <input
                            value={slide.eyebrow}
                            onChange={(e) => updateList('slides', config.slides.map((s) => (s.id === slide.id ? { ...s, eyebrow: e.target.value } : s)))}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Judul Slide" hint="Gunakan Enter untuk baris baru.">
                          <textarea
                            rows={2}
                            value={slide.title}
                            onChange={(e) => updateList('slides', config.slides.map((s) => (s.id === slide.id ? { ...s, title: e.target.value } : s)))}
                            className={areaCls}
                          />
                        </Field>
                        <Field label="Teks Tombol">
                          <input
                            value={slide.ctaText || ''}
                            onChange={(e) => updateList('slides', config.slides.map((s) => (s.id === slide.id ? { ...s, ctaText: e.target.value } : s)))}
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </div>
                  </ItemAccordion>
                ))}
                {config.slides.length === 0 && <Empty text="Belum ada banner." />}
              </div>
            </SectionCard>
          )}

          {/* =============================== MENU ============================== */}
          {active === 'menu' && (
            <SectionCard
              title={`Menu Navigasi (${config.menu.length})`}
              description="Aktifkan / nonaktifkan menu utama dan atur posisinya di header halaman publik."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const item: LandingMenuItem = {
                      id: newId('menu'),
                      label: 'MENU BARU',
                      type: 'link',
                      position: 'left',
                      page: 'home',
                      isActive: true
                    };
                    updateList('menu', [...config.menu, item]);
                    setOpenItem(item.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              {/* Panel cepat: hidup/mati tiap menu utama */}
              <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wide text-slate-800">Tampilkan Menu Utama</p>
                    <p className="mt-0.5 text-[10.5px] font-medium text-slate-500">
                      Menu yang dinonaktifkan tidak muncul di navigasi halaman publik.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateList('menu', config.menu.map((m) => ({ ...m, isActive: true })))}
                      className={btnGhost}
                    >
                      Aktifkan Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => updateList('menu', config.menu.map((m) => ({ ...m, isActive: false })))}
                      className={btnGhost}
                    >
                      Matikan Semua
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {config.menu.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                    >
                      <span className="min-w-[140px] flex-1">
                        <span className="block truncate text-[11.5px] font-bold text-slate-800">{item.label}</span>
                        <span className="block text-[10px] font-medium text-slate-400">
                          {item.type === 'mega'
                            ? `Mega menu · ${item.columns?.length || 0} kolom`
                            : `Tautan → ${PAGE_OPTIONS.find((p) => p.value === item.page)?.label || 'Beranda'}`}
                        </span>
                      </span>

                      <select
                        value={item.position === 'right' ? 'right' : 'left'}
                        onChange={(e) =>
                          updateList(
                            'menu',
                            config.menu.map((m) =>
                              m.id === item.id ? { ...m, position: e.target.value as 'left' | 'right' } : m
                            )
                          )
                        }
                        className={`${inputCls} !w-[104px] !py-1.5`}
                        title="Posisi di header"
                      >
                        <option value="left">Kiri</option>
                        <option value="right">Kanan</option>
                      </select>

                      <Toggle
                        active={item.isActive}
                        onChange={(v) =>
                          updateList('menu', config.menu.map((m) => (m.id === item.id ? { ...m, isActive: v } : m)))
                        }
                      />
                    </div>
                  ))}
                  {config.menu.length === 0 && <Empty text="Belum ada menu. Tambahkan lewat tombol Tambah." />}
                </div>
              </div>

              <div className="space-y-2.5">
                {config.menu.map((item, i) => (
                  <ItemAccordion
                    key={item.id}
                    id={item.id}
                    title={item.label}
                    subtitle={`${item.type === 'mega' ? `Mega menu · ${item.columns?.length || 0} kolom` : `Tautan · ${item.page || '-'}`} · ${item.position === 'right' ? 'Kanan' : 'Kiri'}`}
                    open={openItem === item.id}
                    onToggle={() => setOpenItem(openItem === item.id ? null : item.id)}
                    onDelete={() => updateList('menu', config.menu.filter((m) => m.id !== item.id))}
                    onUp={i > 0 ? () => updateList('menu', moveItem(config.menu, i, i - 1)) : undefined}
                    onDown={i < config.menu.length - 1 ? () => updateList('menu', moveItem(config.menu, i, i + 1)) : undefined}
                    right={<Toggle active={item.isActive} onChange={(v) => updateList('menu', config.menu.map((m) => (m.id === item.id ? { ...m, isActive: v } : m)))} />}
                  >
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Label Menu">
                        <input
                          value={item.label}
                          onChange={(e) => updateList('menu', config.menu.map((m) => (m.id === item.id ? { ...m, label: e.target.value } : m)))}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Tipe">
                        <select
                          value={item.type}
                          onChange={(e) =>
                            updateList(
                              'menu',
                              config.menu.map((m) =>
                                m.id === item.id
                                  ? {
                                      ...m,
                                      type: e.target.value as 'mega' | 'link',
                                      columns: e.target.value === 'mega' ? m.columns || [{ id: newId('col'), heading: 'Kategori', links: [] }] : m.columns,
                                    }
                                  : m
                              )
                            )
                          }
                          className={inputCls}
                        >
                          <option value="link">Tautan langsung</option>
                          <option value="mega">Mega menu</option>
                        </select>
                      </Field>
                      <Field label="Posisi di Header">
                        <select
                          value={item.position === 'right' ? 'right' : 'left'}
                          onChange={(e) =>
                            updateList(
                              'menu',
                              config.menu.map((m) =>
                                m.id === item.id ? { ...m, position: e.target.value as 'left' | 'right' } : m
                              )
                            )
                          }
                          className={inputCls}
                        >
                          <option value="left">Kiri</option>
                          <option value="right">Kanan</option>
                        </select>
                      </Field>
                      {item.type === 'link' && (
                        <Field label="Tujuan Halaman">
                          <select
                            value={item.page || 'home'}
                            onChange={(e) => updateList('menu', config.menu.map((m) => (m.id === item.id ? { ...m, page: e.target.value as LandingPageKey } : m)))}
                            className={inputCls}
                          >
                            {PAGE_OPTIONS.map((p) => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </div>

                    {item.type === 'mega' && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kolom Mega Menu</p>
                          <button
                            type="button"
                            onClick={() =>
                              updateList('menu', config.menu.map((m) => (m.id === item.id ? { ...m, columns: [...(m.columns || []), { id: newId('col'), heading: 'Kolom Baru', links: [] }] } : m)))
                            }
                            className={btnGhost}
                          >
                            <Plus size={11} /> Kolom
                          </button>
                        </div>
                        {(item.columns || []).map((col) => (
                          <div key={col.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center gap-2">
                              <input
                                value={col.heading}
                                onChange={(e) =>
                                  updateList(
                                    'menu',
                                    config.menu.map((m) =>
                                      m.id === item.id
                                        ? { ...m, columns: (m.columns || []).map((c) => (c.id === col.id ? { ...c, heading: e.target.value } : c)) }
                                        : m
                                    )
                                  )
                                }
                                className={inputCls}
                                placeholder="Judul kolom"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateList('menu', config.menu.map((m) => (m.id === item.id ? { ...m, columns: (m.columns || []).filter((c) => c.id !== col.id) } : m)))
                                }
                                className={btnDanger}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div className="mt-2 space-y-1.5">
                              {col.links.map((link) => (
                                <div key={link.id} className="flex items-center gap-1.5">
                                  <input
                                    value={link.label}
                                    onChange={(e) =>
                                      updateList(
                                        'menu',
                                        config.menu.map((m) =>
                                          m.id === item.id
                                            ? {
                                                ...m,
                                                columns: (m.columns || []).map((c) =>
                                                  c.id === col.id ? { ...c, links: c.links.map((l) => (l.id === link.id ? { ...l, label: e.target.value } : l)) } : c
                                                ),
                                              }
                                            : m
                                        )
                                      )
                                    }
                                    className={`${inputCls} !py-1.5`}
                                  />
                                  <select
                                    value={targetValue(link)}
                                    onChange={(e) =>
                                      updateList(
                                        'menu',
                                        config.menu.map((m) =>
                                          m.id === item.id
                                            ? {
                                                ...m,
                                                columns: (m.columns || []).map((c) =>
                                                  c.id === col.id
                                                    ? { ...c, links: c.links.map((l) => (l.id === link.id ? { ...l, ...applyTarget(e.target.value) } : l)) }
                                                    : c
                                                ),
                                              }
                                            : m
                                        )
                                      )
                                    }
                                    className={`${inputCls} !w-[150px] !py-1.5`}
                                  >
                                    <option value="">— tujuan —</option>
                                    {config.categories.map((c) => (
                                      <option key={c.key} value={`cat:${c.key}`}>{c.title}</option>
                                    ))}
                                    {PAGE_OPTIONS.map((p) => (
                                      <option key={p.value} value={`page:${p.value}`}>{p.label}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateList(
                                        'menu',
                                        config.menu.map((m) =>
                                          m.id === item.id
                                            ? { ...m, columns: (m.columns || []).map((c) => (c.id === col.id ? { ...c, links: c.links.filter((l) => l.id !== link.id) } : c)) }
                                            : m
                                        )
                                      )
                                    }
                                    className={btnDanger}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() =>
                                  updateList(
                                    'menu',
                                    config.menu.map((m) =>
                                      m.id === item.id
                                        ? {
                                            ...m,
                                            columns: (m.columns || []).map((c) =>
                                              c.id === col.id ? { ...c, links: [...c.links, { id: newId('lnk'), label: 'Tautan Baru' }] } : c
                                            ),
                                          }
                                        : m
                                    )
                                  )
                                }
                                className="mt-1 text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-500"
                              >
                                + Tautan
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ItemAccordion>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ============================ KATEGORI ============================= */}
          {active === 'categories' && (
            <SectionCard title="Kategori & Kartu Produk" description="Tab kategori dan kartu slider 9:16. Rekomendasi gambar 640 × 1138 px.">
              <div className="space-y-3">
                {config.categories.map((group, gi) => (
                  <div key={group.id} className="rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-[10px] font-bold text-amber-700">{gi + 1}</span>
                      <button type="button" onClick={() => setOpenItem(openItem === group.id ? null : group.id)} className="flex-1 text-left">
                        <span className="block text-[11.5px] font-bold text-slate-800">{group.title}</span>
                        <span className="block text-[10px] font-medium text-slate-400">{group.cards.length} kartu</span>
                      </button>
                      <Toggle active={group.isActive} onChange={(v) => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, isActive: v } : c)))} />
                      <button type="button" onClick={() => setOpenItem(openItem === group.id ? null : group.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100">
                        {openItem === group.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {openItem === group.id && (
                      <div className="space-y-4 p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field label="Label Tab">
                            <input value={group.title} onChange={(e) => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, title: e.target.value } : c)))} className={inputCls} />
                          </Field>
                          <Field label="Slug / Kunci">
                            <input value={group.key} onChange={(e) => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, key: e.target.value } : c)))} className={inputCls} />
                          </Field>
                        </div>
                        <Field label="Judul Seksi">
                          <input value={group.heading} onChange={(e) => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, heading: e.target.value } : c)))} className={inputCls} />
                        </Field>
                        <Field label="Deskripsi Seksi">
                          <textarea rows={2} value={group.description} onChange={(e) => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, description: e.target.value } : c)))} className={areaCls} />
                        </Field>

                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kartu Produk</p>
                          <button
                            type="button"
                            onClick={() => {
                              const card: LandingCategoryCard = { id: newId('card'), label: 'Produk Baru', imageUrl: undefined, isActive: true };
                              updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, cards: [...c.cards, card] } : c)));
                            }}
                            className={btnGhost}
                          >
                            <Plus size={11} /> Kartu
                          </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {group.cards.map((card, ci) => (
                            <div key={card.id} className="rounded-lg border border-slate-200 p-2.5">
                              <ImageField
                                value={card.imageUrl}
                                onChange={(v) => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, cards: c.cards.map((x) => (x.id === card.id ? { ...x, imageUrl: v } : x)) } : c)))}
                                recommended="640 × 1138 px"
                                maxW={720}
                                maxH={1280}
                                aspect="9 / 16"
                              />
                              <input
                                value={card.label}
                                onChange={(e) => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, cards: c.cards.map((x) => (x.id === card.id ? { ...x, label: e.target.value } : x)) } : c)))}
                                className={`${inputCls} mt-2 !text-[11px]`}
                              />
                              <div className="mt-1.5 flex items-center justify-between">
                                <Toggle active={card.isActive} onChange={(v) => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, cards: c.cards.map((x) => (x.id === card.id ? { ...x, isActive: v } : x)) } : c)))} />
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, cards: moveItem(c.cards, ci, ci - 1) } : c)))} className="text-slate-400 hover:text-slate-700" aria-label="Naik">
                                    <ChevronUp size={12} />
                                  </button>
                                  <button type="button" onClick={() => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, cards: moveItem(c.cards, ci, ci + 1) } : c)))} className="text-slate-400 hover:text-slate-700" aria-label="Turun">
                                    <ChevronDown size={12} />
                                  </button>
                                  <button type="button" onClick={() => updateList('categories', config.categories.map((c) => (c.id === group.id ? { ...c, cards: c.cards.filter((x) => x.id !== card.id) } : c)))} className={btnDanger}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ============================ TEMPLATE ============================= */}
          {active === 'templates' && (
            <SectionCard
              title={`Template Design (${config.templatePromos.length})`}
              description="Kartu promo besar di bawah slider kategori. Gambar 1280 × 640 px."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const promo: LandingTemplatePromo = { id: newId('tpl'), eyebrow: 'TEMPLATE DESIGN', title: 'Judul Template Baru', ctaText: 'Klik Di Sini', imageUrl: undefined, isActive: true };
                    updateList('templatePromos', [...config.templatePromos, promo]);
                    setOpenItem(promo.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="space-y-2.5">
                {config.templatePromos.map((promo, i) => (
                  <ItemAccordion
                    key={promo.id}
                    id={promo.id}
                    title={promo.title}
                    subtitle={promo.eyebrow}
                    open={openItem === promo.id}
                    onToggle={() => setOpenItem(openItem === promo.id ? null : promo.id)}
                    onDelete={() => updateList('templatePromos', config.templatePromos.filter((p) => p.id !== promo.id))}
                    onUp={i > 0 ? () => updateList('templatePromos', moveItem(config.templatePromos, i, i - 1)) : undefined}
                    onDown={i < config.templatePromos.length - 1 ? () => updateList('templatePromos', moveItem(config.templatePromos, i, i + 1)) : undefined}
                    right={<Toggle active={promo.isActive} onChange={(v) => updateList('templatePromos', config.templatePromos.map((p) => (p.id === promo.id ? { ...p, isActive: v } : p)))} />}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <ImageField
                        label="Gambar Promo"
                        value={promo.imageUrl}
                        onChange={(v) => updateList('templatePromos', config.templatePromos.map((p) => (p.id === promo.id ? { ...p, imageUrl: v } : p)))}
                        recommended="1280 × 640 px"
                        maxW={1600}
                        maxH={800}
                        aspect="2 / 1"
                      />
                      <div className="space-y-3">
                        <Field label="Label Kecil">
                          <input value={promo.eyebrow} onChange={(e) => updateList('templatePromos', config.templatePromos.map((p) => (p.id === promo.id ? { ...p, eyebrow: e.target.value } : p)))} className={inputCls} />
                        </Field>
                        <Field label="Judul">
                          <textarea rows={2} value={promo.title} onChange={(e) => updateList('templatePromos', config.templatePromos.map((p) => (p.id === promo.id ? { ...p, title: e.target.value } : p)))} className={areaCls} />
                        </Field>
                        <Field label="Teks Tombol">
                          <input value={promo.ctaText} onChange={(e) => updateList('templatePromos', config.templatePromos.map((p) => (p.id === promo.id ? { ...p, ctaText: e.target.value } : p)))} className={inputCls} />
                        </Field>
                      </div>
                    </div>
                  </ItemAccordion>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ============================ PROBLEM ============================== */}
          {active === 'problem' && (
            <SectionCard title="Problem Customer" description="Keluhan pelanggan dan tombol ajakan. Ilustrasi 1024 × 1024 px.">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                  <ImageField
                    label="Ilustrasi"
                    value={config.problem.imageUrl}
                    onChange={(v) => patchSub('problem', { imageUrl: v })}
                    recommended="1024 × 1024 px"
                    maxW={1200}
                    maxH={1200}
                    aspect="1 / 1"
                  />
                  <div className="space-y-3">
                    <Field label="Judul Seksi">
                      <input value={config.problem.title} onChange={(e) => patchSub('problem', { title: e.target.value })} className={inputCls} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Tombol Utama">
                        <input value={config.problem.primaryCtaText} onChange={(e) => patchSub('problem', { primaryCtaText: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Tombol Kedua">
                        <input value={config.problem.secondaryCtaText} onChange={(e) => patchSub('problem', { secondaryCtaText: e.target.value })} className={inputCls} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Poin Keluhan</p>
                  <button
                    type="button"
                    onClick={() => patchSub('problem', { points: [...config.problem.points, { id: newId('pp'), text: 'Keluhan baru', side: 'left' }] })}
                    className={btnGhost}
                  >
                    <Plus size={11} /> Poin
                  </button>
                </div>
                <div className="space-y-2">
                  {config.problem.points.map((point) => (
                    <div key={point.id} className="flex items-center gap-2">
                      <input
                        value={point.text}
                        onChange={(e) => patchSub('problem', { points: config.problem.points.map((p) => (p.id === point.id ? { ...p, text: e.target.value } : p)) })}
                        className={inputCls}
                      />
                      <select
                        value={point.side}
                        onChange={(e) => patchSub('problem', { points: config.problem.points.map((p) => (p.id === point.id ? { ...p, side: e.target.value as 'left' | 'right' } : p)) })}
                        className={`${inputCls} !w-[100px]`}
                      >
                        <option value="left">Kiri</option>
                        <option value="right">Kanan</option>
                      </select>
                      <button type="button" onClick={() => patchSub('problem', { points: config.problem.points.filter((p) => p.id !== point.id) })} className={btnDanger}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          {/* ============================== STATS ============================== */}
          {active === 'stats' && (
            <SectionCard
              title={`Mengapa Kami (${config.stats.length})`}
              description="Angka statistik pendukung. Ikon lingkaran 200 × 200 px."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const stat: LandingStatItem = { id: newId('stat'), value: '10+', label: 'Label Baru', description: 'Deskripsi singkat.', iconUrl: undefined, isActive: true };
                    updateList('stats', [...config.stats, stat]);
                    setOpenItem(stat.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="space-y-2.5">
                {config.stats.map((stat, i) => (
                  <ItemAccordion
                    key={stat.id}
                    id={stat.id}
                    title={`${stat.value} — ${stat.label}`}
                    open={openItem === stat.id}
                    onToggle={() => setOpenItem(openItem === stat.id ? null : stat.id)}
                    onDelete={() => updateList('stats', config.stats.filter((s) => s.id !== stat.id))}
                    onUp={i > 0 ? () => updateList('stats', moveItem(config.stats, i, i - 1)) : undefined}
                    onDown={i < config.stats.length - 1 ? () => updateList('stats', moveItem(config.stats, i, i + 1)) : undefined}
                    right={<Toggle active={stat.isActive} onChange={(v) => updateList('stats', config.stats.map((s) => (s.id === stat.id ? { ...s, isActive: v } : s)))} />}
                  >
                    <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                      <ImageField
                        value={stat.iconUrl}
                        onChange={(v) => updateList('stats', config.stats.map((s) => (s.id === stat.id ? { ...s, iconUrl: v } : s)))}
                        recommended="200 × 200 px"
                        maxW={400}
                        maxH={400}
                        aspect="1 / 1"
                      />
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Angka">
                            <input value={stat.value} onChange={(e) => updateList('stats', config.stats.map((s) => (s.id === stat.id ? { ...s, value: e.target.value } : s)))} className={inputCls} />
                          </Field>
                          <Field label="Label">
                            <input value={stat.label} onChange={(e) => updateList('stats', config.stats.map((s) => (s.id === stat.id ? { ...s, label: e.target.value } : s)))} className={inputCls} />
                          </Field>
                        </div>
                        <Field label="Deskripsi">
                          <textarea rows={2} value={stat.description} onChange={(e) => updateList('stats', config.stats.map((s) => (s.id === stat.id ? { ...s, description: e.target.value } : s)))} className={areaCls} />
                        </Field>
                      </div>
                    </div>
                  </ItemAccordion>
                ))}
              </div>
            </SectionCard>
          )}

          {/* =========================== FASILITAS ============================ */}
          {active === 'facilities' && (
            <SectionCard
              title={`Fasilitas Produksi (${config.facilities.length})`}
              description="Foto mesin/fasilitas. Rekomendasi 640 × 480 px."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const item: LandingFacilityItem = { id: newId('fac'), title: 'Mesin Baru', imageUrl: undefined, isActive: true };
                    updateList('facilities', [...config.facilities, item]);
                    setOpenItem(item.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="space-y-2.5">
                {config.facilities.map((item, i) => (
                  <ItemAccordion
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    open={openItem === item.id}
                    onToggle={() => setOpenItem(openItem === item.id ? null : item.id)}
                    onDelete={() => updateList('facilities', config.facilities.filter((f) => f.id !== item.id))}
                    onUp={i > 0 ? () => updateList('facilities', moveItem(config.facilities, i, i - 1)) : undefined}
                    onDown={i < config.facilities.length - 1 ? () => updateList('facilities', moveItem(config.facilities, i, i + 1)) : undefined}
                    right={<Toggle active={item.isActive} onChange={(v) => updateList('facilities', config.facilities.map((f) => (f.id === item.id ? { ...f, isActive: v } : f)))} />}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <ImageField
                        label="Foto"
                        value={item.imageUrl}
                        onChange={(v) => updateList('facilities', config.facilities.map((f) => (f.id === item.id ? { ...f, imageUrl: v } : f)))}
                        recommended="640 × 480 px"
                        maxW={1280}
                        maxH={960}
                        aspect="4 / 3"
                      />
                      <Field label="Nama Fasilitas">
                        <input value={item.title} onChange={(e) => updateList('facilities', config.facilities.map((f) => (f.id === item.id ? { ...f, title: e.target.value } : f)))} className={inputCls} />
                      </Field>
                    </div>
                  </ItemAccordion>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ============================= CLIENTS ============================ */}
          {active === 'clients' && (
            <SectionCard
              title={`Klien Kami (${config.clients.length})`}
              description="Logo klien. Rekomendasi 300 × 300 px (PNG transparan)."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const client = { id: newId('cli'), name: 'Klien Baru', logoUrl: undefined, websiteUrl: '', isActive: true };
                    updateList('clients', [...config.clients, client]);
                    setOpenItem(client.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {config.clients.map((client) => (
                  <div key={client.id} className="rounded-lg border border-slate-200 p-2.5">
                    <ImageField
                      value={client.logoUrl}
                      onChange={(v) => updateList('clients', config.clients.map((c) => (c.id === client.id ? { ...c, logoUrl: v } : c)))}
                      recommended="300 × 300 px"
                      maxW={600}
                      maxH={600}
                      aspect="1 / 1"
                    />
                    <input
                      value={client.name}
                      onChange={(e) => updateList('clients', config.clients.map((c) => (c.id === client.id ? { ...c, name: e.target.value } : c)))}
                      className={`${inputCls} mt-2 !text-[11px]`}
                      placeholder="Nama klien"
                    />
                    <input
                      value={client.websiteUrl || ''}
                      onChange={(e) => updateList('clients', config.clients.map((c) => (c.id === client.id ? { ...c, websiteUrl: e.target.value } : c)))}
                      className={`${inputCls} mt-1.5 !text-[11px]`}
                      placeholder="https://…"
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <Toggle active={client.isActive} onChange={(v) => updateList('clients', config.clients.map((c) => (c.id === client.id ? { ...c, isActive: v } : c)))} />
                      <button type="button" onClick={() => updateList('clients', config.clients.filter((c) => c.id !== client.id))} className={btnDanger}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* =========================== TESTIMONIALS ========================= */}
          {active === 'testimonials' && (
            <SectionCard
              title={`Testimoni (${config.testimonials.length})`}
              description="Kutipan pelanggan. Logo/foto 200 × 200 px."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const t: LandingTestimonial = { id: newId('testi'), quote: 'Kutipan testimoni baru.', author: 'Nama', role: 'Jabatan', company: 'Perusahaan', logoUrl: undefined, isActive: true };
                    updateList('testimonials', [...config.testimonials, t]);
                    setOpenItem(t.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="space-y-2.5">
                {config.testimonials.map((t, i) => (
                  <ItemAccordion
                    key={t.id}
                    id={t.id}
                    title={t.author}
                    subtitle={t.company}
                    open={openItem === t.id}
                    onToggle={() => setOpenItem(openItem === t.id ? null : t.id)}
                    onDelete={() => updateList('testimonials', config.testimonials.filter((x) => x.id !== t.id))}
                    onUp={i > 0 ? () => updateList('testimonials', moveItem(config.testimonials, i, i - 1)) : undefined}
                    onDown={i < config.testimonials.length - 1 ? () => updateList('testimonials', moveItem(config.testimonials, i, i + 1)) : undefined}
                    right={<Toggle active={t.isActive} onChange={(v) => updateList('testimonials', config.testimonials.map((x) => (x.id === t.id ? { ...x, isActive: v } : x)))} />}
                  >
                    <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                      <ImageField
                        value={t.logoUrl}
                        onChange={(v) => updateList('testimonials', config.testimonials.map((x) => (x.id === t.id ? { ...x, logoUrl: v } : x)))}
                        recommended="200 × 200 px"
                        maxW={400}
                        maxH={400}
                        aspect="1 / 1"
                      />
                      <div className="space-y-3">
                        <Field label="Kutipan">
                          <textarea rows={3} value={t.quote} onChange={(e) => updateList('testimonials', config.testimonials.map((x) => (x.id === t.id ? { ...x, quote: e.target.value } : x)))} className={areaCls} />
                        </Field>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="Nama">
                            <input value={t.author} onChange={(e) => updateList('testimonials', config.testimonials.map((x) => (x.id === t.id ? { ...x, author: e.target.value } : x)))} className={inputCls} />
                          </Field>
                          <Field label="Jabatan">
                            <input value={t.role} onChange={(e) => updateList('testimonials', config.testimonials.map((x) => (x.id === t.id ? { ...x, role: e.target.value } : x)))} className={inputCls} />
                          </Field>
                          <Field label="Perusahaan">
                            <input value={t.company} onChange={(e) => updateList('testimonials', config.testimonials.map((x) => (x.id === t.id ? { ...x, company: e.target.value } : x)))} className={inputCls} />
                          </Field>
                        </div>
                      </div>
                    </div>
                  </ItemAccordion>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ============================== BLOG ============================== */}
          {active === 'blog' && (
            <SectionCard
              title={`Blog / Inspirasi (${config.blogPosts.length})`}
              description="Artikel inspirasi. Gambar 640 × 420 px."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const post: LandingBlogPost = { id: newId('blog'), title: 'Judul Artikel Baru', imageUrl: undefined, url: '', isActive: true };
                    updateList('blogPosts', [...config.blogPosts, post]);
                    setOpenItem(post.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="space-y-2.5">
                {config.blogPosts.map((post, i) => (
                  <ItemAccordion
                    key={post.id}
                    id={post.id}
                    title={post.title}
                    open={openItem === post.id}
                    onToggle={() => setOpenItem(openItem === post.id ? null : post.id)}
                    onDelete={() => updateList('blogPosts', config.blogPosts.filter((p) => p.id !== post.id))}
                    onUp={i > 0 ? () => updateList('blogPosts', moveItem(config.blogPosts, i, i - 1)) : undefined}
                    onDown={i < config.blogPosts.length - 1 ? () => updateList('blogPosts', moveItem(config.blogPosts, i, i + 1)) : undefined}
                    right={<Toggle active={post.isActive} onChange={(v) => updateList('blogPosts', config.blogPosts.map((p) => (p.id === post.id ? { ...p, isActive: v } : p)))} />}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <ImageField
                        label="Gambar Artikel"
                        value={post.imageUrl}
                        onChange={(v) => updateList('blogPosts', config.blogPosts.map((p) => (p.id === post.id ? { ...p, imageUrl: v } : p)))}
                        recommended="640 × 420 px"
                        maxW={1280}
                        maxH={840}
                        aspect="16 / 10"
                      />
                      <div className="space-y-3">
                        <Field label="Judul Artikel">
                          <textarea rows={2} value={post.title} onChange={(e) => updateList('blogPosts', config.blogPosts.map((p) => (p.id === post.id ? { ...p, title: e.target.value } : p)))} className={areaCls} />
                        </Field>
                        <Field label="URL Artikel (opsional)" hint="Kosongkan untuk membuka gambar dalam lightbox.">
                          <input value={post.url || ''} onChange={(e) => updateList('blogPosts', config.blogPosts.map((p) => (p.id === post.id ? { ...p, url: e.target.value } : p)))} className={inputCls} placeholder="https://…" />
                        </Field>
                      </div>
                    </div>
                  </ItemAccordion>
                ))}
              </div>
            </SectionCard>
          )}

          {/* =============================== FAQ ============================== */}
          {active === 'faq' && (
            <SectionCard
              title={`FAQ (${config.faqs.length})`}
              description="Pertanyaan yang sering diajukan."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const faq: LandingFaqItem = { id: newId('faq'), question: 'Pertanyaan baru?', answer: 'Jawaban singkat.', isActive: true };
                    updateList('faqs', [...config.faqs, faq]);
                    setOpenItem(faq.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="space-y-2.5">
                {config.faqs.map((faq, i) => (
                  <ItemAccordion
                    key={faq.id}
                    id={faq.id}
                    title={faq.question}
                    open={openItem === faq.id}
                    onToggle={() => setOpenItem(openItem === faq.id ? null : faq.id)}
                    onDelete={() => updateList('faqs', config.faqs.filter((f) => f.id !== faq.id))}
                    onUp={i > 0 ? () => updateList('faqs', moveItem(config.faqs, i, i - 1)) : undefined}
                    onDown={i < config.faqs.length - 1 ? () => updateList('faqs', moveItem(config.faqs, i, i + 1)) : undefined}
                    right={<Toggle active={faq.isActive} onChange={(v) => updateList('faqs', config.faqs.map((f) => (f.id === faq.id ? { ...f, isActive: v } : f)))} />}
                  >
                    <div className="space-y-3">
                      <Field label="Pertanyaan">
                        <input value={faq.question} onChange={(e) => updateList('faqs', config.faqs.map((f) => (f.id === faq.id ? { ...f, question: e.target.value } : f)))} className={inputCls} />
                      </Field>
                      <Field label="Jawaban">
                        <textarea rows={3} value={faq.answer} onChange={(e) => updateList('faqs', config.faqs.map((f) => (f.id === faq.id ? { ...f, answer: e.target.value } : f)))} className={areaCls} />
                      </Field>
                    </div>
                  </ItemAccordion>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ============================== ABOUT ============================= */}
          {active === 'about' && (
            <SectionCard title="Tentang Kami" description="Konten halaman Tentang Kami dan seksi video profil.">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <ImageField
                    label="Foto Workshop"
                    value={config.about.imageUrl}
                    onChange={(v) => patchSub('about', { imageUrl: v })}
                    recommended="900 × 700 px"
                    maxW={1200}
                    maxH={933}
                    aspect="9 / 7"
                  />
                  <div className="space-y-3">
                    <Field label="Label Kecil">
                      <input value={config.about.eyebrow} onChange={(e) => patchSub('about', { eyebrow: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Judul">
                      <input value={config.about.title} onChange={(e) => patchSub('about', { title: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Keterangan Foto">
                      <input value={config.about.imageCaption || ''} onChange={(e) => patchSub('about', { imageCaption: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Teks Tombol CTA">
                      <input value={config.about.ctaText || ''} onChange={(e) => patchSub('about', { ctaText: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                </div>

                <Field label="Paragraf Pembuka">
                  <textarea rows={3} value={config.about.intro} onChange={(e) => patchSub('about', { intro: e.target.value })} className={areaCls} />
                </Field>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className={labelCls}>Paragraf Isi</label>
                    <button type="button" onClick={() => patchSub('about', { paragraphs: [...config.about.paragraphs, ''] })} className={btnGhost}>
                      <Plus size={11} /> Paragraf
                    </button>
                  </div>
                  <div className="space-y-2">
                    {config.about.paragraphs.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <textarea
                          rows={2}
                          value={p}
                          onChange={(e) => patchSub('about', { paragraphs: config.about.paragraphs.map((x, xi) => (xi === i ? e.target.value : x)) })}
                          className={areaCls}
                        />
                        <button type="button" onClick={() => patchSub('about', { paragraphs: config.about.paragraphs.filter((_, xi) => xi !== i) })} className={btnDanger}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className={labelCls}>Statistik</label>
                    <button type="button" onClick={() => patchSub('about', { stats: [...config.about.stats, { value: '0', label: 'Label' }] })} className={btnGhost}>
                      <Plus size={11} /> Statistik
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {config.about.stats.map((stat, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={stat.value}
                          onChange={(e) => patchSub('about', { stats: config.about.stats.map((x, xi) => (xi === i ? { ...x, value: e.target.value } : x)) })}
                          className={`${inputCls} !w-24`}
                          placeholder="8+"
                        />
                        <input
                          value={stat.label}
                          onChange={(e) => patchSub('about', { stats: config.about.stats.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)) })}
                          className={inputCls}
                          placeholder="Tahun Pengalaman"
                        />
                        <button type="button" onClick={() => patchSub('about', { stats: config.about.stats.filter((_, xi) => xi !== i) })} className={btnDanger}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ============================= GALLERY ============================ */}
          {active === 'gallery' && (
            <SectionCard
              title={`Galeri Workshop (${config.gallery.length})`}
              description="Dokumentasi workshop. Rekomendasi 800 × 600 px."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const item: LandingGalleryItem = { id: newId('gal'), title: 'Foto Baru', description: '', imageUrl: undefined, isActive: true };
                    updateList('gallery', [...config.gallery, item]);
                    setOpenItem(item.id);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {config.gallery.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-2.5">
                    <ImageField
                      value={item.imageUrl}
                      onChange={(v) => updateList('gallery', config.gallery.map((g) => (g.id === item.id ? { ...g, imageUrl: v } : g)))}
                      recommended="800 × 600 px"
                      maxW={1200}
                      maxH={900}
                      aspect="4 / 3"
                    />
                    <input
                      value={item.title}
                      onChange={(e) => updateList('gallery', config.gallery.map((g) => (g.id === item.id ? { ...g, title: e.target.value } : g)))}
                      className={`${inputCls} mt-2 !text-[11px]`}
                    />
                    <input
                      value={item.description || ''}
                      onChange={(e) => updateList('gallery', config.gallery.map((g) => (g.id === item.id ? { ...g, description: e.target.value } : g)))}
                      className={`${inputCls} mt-1.5 !text-[11px]`}
                      placeholder="Keterangan"
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <Toggle active={item.isActive} onChange={(v) => updateList('gallery', config.gallery.map((g) => (g.id === item.id ? { ...g, isActive: v } : g)))} />
                      <button type="button" onClick={() => updateList('gallery', config.gallery.filter((g) => g.id !== item.id))} className={btnDanger}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ============================= CONTACT ============================ */}
          {active === 'contact' && (
            <SectionCard title="Kontak" description="Informasi kontak yang tampil di top bar, halaman kontak, dan footer.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nomor WhatsApp" hint="Format 62… tanpa tanda +">
                  <input value={config.contact.whatsappNumber} onChange={(e) => patchSub('contact', { whatsappNumber: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Nomor Telepon (tampil)">
                  <input value={config.contact.phoneDisplay} onChange={(e) => patchSub('contact', { phoneDisplay: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Email">
                  <input value={config.contact.emailDisplay || ''} onChange={(e) => patchSub('contact', { emailDisplay: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Jam Operasional">
                  <input value={config.contact.operatingHours} onChange={(e) => patchSub('contact', { operatingHours: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Alamat Kantor">
                  <textarea rows={2} value={config.contact.storeAddress} onChange={(e) => patchSub('contact', { storeAddress: e.target.value })} className={areaCls} />
                </Field>
                <Field label="Alamat Workshop">
                  <textarea rows={2} value={config.contact.factoryAddress || ''} onChange={(e) => patchSub('contact', { factoryAddress: e.target.value })} className={areaCls} />
                </Field>
                <Field label="URL Google Maps" className="md:col-span-2">
                  <input value={config.contact.googleMapsUrl || ''} onChange={(e) => patchSub('contact', { googleMapsUrl: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Template Pesan WhatsApp" className="md:col-span-2">
                  <textarea rows={2} value={config.contact.whatsappMessageTemplate} onChange={(e) => patchSub('contact', { whatsappMessageTemplate: e.target.value })} className={areaCls} />
                </Field>
              </div>
            </SectionCard>
          )}

          {/* ============================== OFFICES =========================== */}
          {active === 'offices' && (
            <SectionCard
              title={`Kantor Cabang (${config.offices.length})`}
              description="Daftar kantor yang tampil pada halaman Kontak."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const office = { id: newId('office'), name: 'Kantor Baru', address: '', phone: '', isActive: true };
                    updateList('offices', [...config.offices, office]);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="space-y-2.5">
                {config.offices.map((office) => (
                  <div key={office.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Nama Kantor">
                        <input value={office.name} onChange={(e) => updateList('offices', config.offices.map((o) => (o.id === office.id ? { ...o, name: e.target.value } : o)))} className={inputCls} />
                      </Field>
                      <Field label="Telepon">
                        <input value={office.phone} onChange={(e) => updateList('offices', config.offices.map((o) => (o.id === office.id ? { ...o, phone: e.target.value } : o)))} className={inputCls} />
                      </Field>
                    </div>
                    <Field label="Alamat" className="mt-3">
                      <textarea rows={2} value={office.address} onChange={(e) => updateList('offices', config.offices.map((o) => (o.id === office.id ? { ...o, address: e.target.value } : o)))} className={areaCls} />
                    </Field>
                    <div className="mt-2 flex items-center justify-between">
                      <Toggle active={office.isActive} onChange={(v) => updateList('offices', config.offices.map((o) => (o.id === office.id ? { ...o, isActive: v } : o)))} />
                      <button type="button" onClick={() => updateList('offices', config.offices.filter((o) => o.id !== office.id))} className={btnDanger}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ============================== SOCIALS =========================== */}
          {active === 'socials' && (
            <SectionCard
              title={`Media Sosial (${config.socials.length})`}
              description="Ikon tautan pada footer."
              aside={
                <button
                  type="button"
                  onClick={() => updateList('socials', [...config.socials, { id: newId('soc'), label: 'Instagram', url: '', isActive: true }])}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Tambah
                </button>
              }
            >
              <div className="space-y-2">
                {config.socials.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input value={s.label} onChange={(e) => updateList('socials', config.socials.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))} className={`${inputCls} !w-36`} />
                    <input value={s.url} onChange={(e) => updateList('socials', config.socials.map((x) => (x.id === s.id ? { ...x, url: e.target.value } : x)))} className={inputCls} placeholder="https://…" />
                    <Toggle active={s.isActive} onChange={(v) => updateList('socials', config.socials.map((x) => (x.id === s.id ? { ...x, isActive: v } : x)))} />
                    <button type="button" onClick={() => updateList('socials', config.socials.filter((x) => x.id !== s.id))} className={btnDanger}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ============================== FOOTER ============================ */}
          {active === 'footer' && (
            <SectionCard
              title={`Footer (${config.footerColumns.length} kolom)`}
              description="Tautan multi-kolom pada footer. Satu kolom boleh punya beberapa blok."
              aside={
                <button
                  type="button"
                  onClick={() => {
                    const col: LandingFooterColumn = { id: newId('fc'), heading: 'JUDUL KOLOM', blocks: [{ id: newId('fcb'), title: 'Sub Judul', links: [] }] };
                    updateList('footerColumns', [...config.footerColumns, col]);
                  }}
                  className={btnPrimary}
                >
                  <Plus size={12} /> Kolom
                </button>
              }
            >
              <div className="mb-4">
                <Field label="Catatan Footer">
                  <input value={config.footerNote || ''} onChange={(e) => patch({ footerNote: e.target.value })} className={inputCls} />
                </Field>
              </div>

              <div className="space-y-3">
                {config.footerColumns.map((col) => (
                  <div key={col.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <input value={col.heading} onChange={(e) => updateList('footerColumns', config.footerColumns.map((c) => (c.id === col.id ? { ...c, heading: e.target.value } : c)))} className={inputCls} />
                      <button type="button" onClick={() => updateList('footerColumns', config.footerColumns.filter((c) => c.id !== col.id))} className={btnDanger}>
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      {col.blocks.map((block) => (
                        <div key={block.id} className="rounded-md bg-slate-50 p-2.5">
                          <div className="flex items-center gap-2">
                            <input
                              value={block.title || ''}
                              onChange={(e) => updateList('footerColumns', config.footerColumns.map((c) => (c.id === col.id ? { ...c, blocks: c.blocks.map((b) => (b.id === block.id ? { ...b, title: e.target.value } : b)) } : c)))}
                              className={inputCls}
                              placeholder="Sub judul (opsional)"
                            />
                            <button
                              type="button"
                              onClick={() => updateList('footerColumns', config.footerColumns.map((c) => (c.id === col.id ? { ...c, blocks: c.blocks.filter((b) => b.id !== block.id) } : c)))}
                              className={btnDanger}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {block.links.map((link) => (
                              <div key={link.id} className="flex items-center gap-1.5">
                                <input
                                  value={link.label}
                                  onChange={(e) =>
                                    updateList('footerColumns', config.footerColumns.map((c) => (c.id === col.id ? { ...c, blocks: c.blocks.map((b) => (b.id === block.id ? { ...b, links: b.links.map((l) => (l.id === link.id ? { ...l, label: e.target.value } : l)) } : b)) } : c)))
                                  }
                                  className={`${inputCls} !py-1.5`}
                                />
                                <select
                                  value={targetValue(link)}
                                  onChange={(e) =>
                                    updateList('footerColumns', config.footerColumns.map((c) => (c.id === col.id ? { ...c, blocks: c.blocks.map((b) => (b.id === block.id ? { ...b, links: b.links.map((l) => (l.id === link.id ? { ...l, ...applyTarget(e.target.value) } : l)) } : b)) } : c)))
                                  }
                                  className={`${inputCls} !w-[140px] !py-1.5`}
                                >
                                  <option value="">— tujuan —</option>
                                  {config.categories.map((c) => (
                                    <option key={c.key} value={`cat:${c.key}`}>{c.title}</option>
                                  ))}
                                  {PAGE_OPTIONS.map((p) => (
                                    <option key={p.value} value={`page:${p.value}`}>{p.label}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => updateList('footerColumns', config.footerColumns.map((c) => (c.id === col.id ? { ...c, blocks: c.blocks.map((b) => (b.id === block.id ? { ...b, links: b.links.filter((l) => l.id !== link.id) } : b)) } : c)))}
                                  className={btnDanger}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateList('footerColumns', config.footerColumns.map((c) => (c.id === col.id ? { ...c, blocks: c.blocks.map((b) => (b.id === block.id ? { ...b, links: [...b.links, { id: newId('fcl'), label: 'Tautan Baru' }] } : b)) } : c)))}
                              className="text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-500"
                            >
                              + Tautan
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateList('footerColumns', config.footerColumns.map((c) => (c.id === col.id ? { ...c, blocks: [...c.blocks, { id: newId('fcb'), title: '', links: [] }] } : c)))}
                        className="text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-500"
                      >
                        + Blok
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Pratinjau */}
        {showPreview && (
          <div className="hidden h-[calc(100vh-190px)] min-h-[520px] xl:block">
            <LivePreview config={config} device={device} />
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Potongan kecil                                                            */
/* -------------------------------------------------------------------------- */
const Empty: React.FC<{ text: string }> = ({ text }) => (
  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-[11px] font-medium text-slate-400">
    {text}
  </p>
);

/* ikon pencarian kecil agar tidak menambah impor baru di atas */
const Search: React.FC<{ size?: number; className?: string }> = ({ size = 12, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export default LandingPageEditorScreen;
