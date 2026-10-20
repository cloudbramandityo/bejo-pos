/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Public Landing Page — Multi-page corporate site style
 * Referen layout: subur.co.id (Home / About Us / Product / Clients / Contact Us)
 * Fitur: Hero slider gambar, accordion solusi, slider testimoni,
 *        galeri klien, galeri workshop, dan lightbox detail gambar.
 * Coded by Langgo Bramandityo.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Layers,
  Scissors,
  Printer,
  Phone,
  PhoneCall,
  MapPin,
  Clock,
  ArrowRight,
  ArrowLeft,
  Calculator,
  LogIn,
  CheckCircle2,
  Search,
  MessageCircle,
  Package,
  RectangleHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Image as ImageIcon,
  Send,
  Menu,
  Wrench,
  Sparkles,
  Eye,
  Award,
  ExternalLink,
  Mail,
  Globe,
  Quote,
  Building2,
  User,
} from 'lucide-react';
import {
  LandingPageConfig,
  LandingSlide,
  LandingTestimonial,
  LandingGalleryItem,
  LandingBrandItem,
  LandingProductItem,
  AppUser,
} from '../../types';
import { StoreLogo } from '../StoreLogo';

interface LandingPageProps {
  config: LandingPageConfig;
  storeName?: string;
  logoUrl?: string;
  currentUser?: AppUser | null;
  onOpenLogin: () => void;
  onEnterApp?: () => void;
  onOpenDeveloperCms?: () => void;
}

type PageId = 'home' | 'about' | 'products' | 'clients' | 'contact';

interface LightboxImage {
  src: string;
  title: string;
  caption?: string;
}

const PAGE_MENUS: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Beranda' },
  { id: 'about', label: 'Tentang Kami' },
  { id: 'products', label: 'Produk & Layanan' },
  { id: 'clients', label: 'Klien & Testimoni' },
  { id: 'contact', label: 'Kontak' },
];

/* ============================================================
   Komponen utilitas kecil
   ============================================================ */

const SectionHeading: React.FC<{
  eyebrow: string;
  title: string;
  desc?: string;
  dark?: boolean;
  center?: boolean;
}> = ({ eyebrow, title, desc, dark, center }) => (
  <div className={`space-y-2 ${center ? 'text-center max-w-2xl mx-auto' : 'max-w-2xl'}`}>
    <span className={`text-xs font-extrabold uppercase tracking-widest ${dark ? 'text-indigo-300' : 'text-indigo-600'}`}>
      {eyebrow}
    </span>
    <h2 className={`text-2xl sm:text-3xl md:text-4xl font-black tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
      {title}
    </h2>
    {desc && (
      <p className={`text-xs sm:text-sm font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
    )}
  </div>
);

/** Gambar cerdas: tampilkan placeholder rapi bila foto belum diunggah / gagal load */
const SmartImage: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  hoverZoom?: boolean;
}> = ({ src, alt, className = '', onClick, hoverZoom }) => {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // simpan callback terbaru agar listener tidak perlu dipasang ulang
  const cbRef = useRef(onClick);
  cbRef.current = onClick;

  useEffect(() => {
    setFailed(false);
    const el = imgRef.current;
    if (!el || !src) return;
    const handler = (e: Event) => {
      e.stopPropagation();
      cbRef.current?.();
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        onClick={onClick}
        className={`bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-200 flex flex-col items-center justify-center gap-1.5 text-slate-400 ${
          onClick ? 'cursor-zoom-in' : ''
        } ${className}`}
      >
        <ImageIcon className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Foto belum diunggah</span>
        <span className="text-[9px] text-slate-400/80 truncate max-w-[90%] px-2 text-center">{alt}</span>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${onClick ? 'cursor-zoom-in' : ''} ${
        onClick && hoverZoom !== false ? 'transition-transform duration-300 group-hover:scale-[1.04]' : ''
      } ${className}`}
    />
  );
};

/* ============================================================
   Slider Banner Utama (Hero Slider)
   ============================================================ */
const HeroSlider: React.FC<{
  slides: LandingSlide[];
}> = ({ slides }) => {
  const activeSlides = useMemo(() => slides.filter((s) => s.isActive), [slides]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (index >= activeSlides.length) setIndex(0);
  }, [activeSlides.length, index]);

  useEffect(() => {
    if (paused || activeSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % activeSlides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [paused, activeSlides.length, index]);

  if (activeSlides.length === 0) return null;
  const slide = activeSlides[Math.min(index, activeSlides.length - 1)];

  return (
    <div
      className="relative w-full overflow-hidden bg-slate-950"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-[300px] sm:h-[380px] lg:h-[460px]">
        {activeSlides.map((s, i) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {s.imageUrl ? (
              <img src={s.imageUrl} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950">
                <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.45),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.35),transparent_40%)]" />
              </div>
            )}
            {/* Overlay tipis agar tetap menyatu dengan navbar/footer */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/20" />
          </div>
        ))}

        {/* Panah navigasi */}
        {activeSlides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + activeSlides.length) % activeSlides.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/35 hover:bg-black/60 backdrop-blur text-white flex items-center justify-center transition-all cursor-pointer"
              aria-label="Slide sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % activeSlides.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/35 hover:bg-black/60 backdrop-blur text-white flex items-center justify-center transition-all cursor-pointer"
              aria-label="Slide berikutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {activeSlides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {activeSlides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ke slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === index ? 'w-8 bg-emerald-400' : 'w-2.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   Slider Testimoni
   ============================================================ */
const TestimonialSlider: React.FC<{ items: LandingTestimonial[] }> = ({ items }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [items.length, index]);

  if (items.length === 0) {
    return <p className="text-xs text-slate-400 italic text-center py-6">Belum ada testimoni.</p>;
  }
  const current = items[Math.min(index, items.length - 1)];

  return (
    <div className="relative">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-lg max-w-3xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <Quote className="w-8 h-8 text-indigo-100 shrink-0" />
          {current.logoUrl ? (
            <SmartImage
              src={current.logoUrl}
              alt={current.company}
              hoverZoom={false}
              className="w-14 h-14 rounded-full border border-slate-200"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 text-sm font-black">
              {current.company.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium">“{current.quote}”</p>
        <div className="border-t border-slate-100 pt-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-black text-slate-900">{current.author}</div>
            <div className="text-[11px] text-slate-500 font-semibold">{current.role}</div>
            <div className="text-xs font-black text-indigo-700">{current.company}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-all cursor-pointer"
              aria-label="Testimoni sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % items.length)}
              className="w-9 h-9 rounded-full bg-slate-900 hover:bg-indigo-700 flex items-center justify-center text-white transition-all cursor-pointer"
              aria-label="Testimoni berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-4">
        {items.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Testimoni ${i + 1}`}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              i === index ? 'w-7 bg-indigo-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/* ============================================================
   Lightbox — popup detail gambar produk / galeri
   ============================================================ */
const Lightbox: React.FC<{
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}> = ({ images, index, onClose, onChangeIndex }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && images.length > 1) onChangeIndex((index + 1) % images.length);
      if (e.key === 'ArrowLeft' && images.length > 1) onChangeIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, index, onClose, onChangeIndex]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (index >= images.length) return null;
  const current = images[index];
  const hasMany = images.length > 1;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      {/* Tombol tutup */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 sm:top-5 sm:right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer z-10"
        aria-label="Tutup pratinjau"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Navigasi */}
      {hasMany && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeIndex((index - 1 + images.length) % images.length);
            }}
            className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer z-10"
            aria-label="Gambar sebelumnya"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeIndex((index + 1) % images.length);
            }}
            className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer z-10"
            aria-label="Gambar berikutnya"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* Konten */}
      <div
        className="max-w-4xl w-full max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[82vh] flex flex-col">
          <div className="bg-slate-100 flex items-center justify-center min-h-[240px] max-h-[62vh] overflow-hidden">
            <img src={current.src} alt={current.title} className="max-h-[62vh] w-auto max-w-full object-contain" />
          </div>
          <div className="px-4 sm:px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-black text-slate-900 truncate">{current.title}</div>
              {current.caption && (
                <div className="text-[11px] text-slate-500 font-medium truncate">{current.caption}</div>
              )}
            </div>
            {hasMany && (
              <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
                {index + 1} / {images.length}
              </span>
            )}
          </div>
        </div>

        {/* Thumbnail strip */}
        {hasMany && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 justify-start sm:justify-center">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeIndex(i);
                }}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  i === index ? 'border-emerald-400 ring-2 ring-emerald-400/30' : 'border-white/20 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img.src} alt={img.title} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   Halaman utama
   ============================================================ */
export const LandingPage: React.FC<LandingPageProps> = ({
  config,
  storeName = 'BEJO STIKER & DIGITAL PRINTING',
  logoUrl,
  currentUser,
  onOpenLogin,
  onEnterApp,
  onOpenDeveloperCms
}) => {
  const [page, setPage] = useState<PageId>('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxImage[]; index: number } | null>(null);

  const [selectedBrandCategory, setSelectedBrandCategory] = useState<string>('all');
  const [brandSearchQuery, setBrandSearchQuery] = useState<string>('');

  // Kalkulator harga
  const [calcServiceType, setCalcServiceType] = useState<'meteran' | 'roll' | 'print' | 'laser'>('meteran');
  const [calcBrand, setCalcBrand] = useState<string>('DECOFIX');
  const [calcLengthMeters, setCalcLengthMeters] = useState<number>(3);
  const [calcRollQty, setCalcRollQty] = useState<number>(1);
  const [calcPrintArea, setCalcPrintArea] = useState<number>(2);
  const [calcLaserArea, setCalcLaserArea] = useState<number>(600);

  // Form kontak
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formMessage, setFormMessage] = useState('');

  const about = config.about;
  const activeSlides = useMemo(() => config.slides.filter((s) => s.isActive), [config.slides]);
  const activeBrands = useMemo(() => config.brands.filter((b) => b.isActive), [config.brands]);
  const activeProducts = useMemo(() => config.featuredProducts.filter((p) => p.isActive), [config.featuredProducts]);
  const activeServices = useMemo(() => config.services.filter((s) => s.isActive), [config.services]);
  const activeTestimonials = useMemo(() => config.testimonials.filter((t) => t.isActive), [config.testimonials]);
  const activeClients = useMemo(() => config.clients.filter((c) => c.isActive), [config.clients]);
  const activeGallery = useMemo(() => config.gallery.filter((g) => g.isActive), [config.gallery]);
  const activeOffices = useMemo(() => config.offices.filter((o) => o.isActive), [config.offices]);
  const activeSocials = useMemo(() => config.socials.filter((s) => s.isActive), [config.socials]);

  const filteredBrands = useMemo(() => {
    return activeBrands.filter((b) => {
      const matchCat = selectedBrandCategory === 'all' || b.category === selectedBrandCategory;
      const matchSearch =
        !brandSearchQuery.trim() ||
        b.name.toLowerCase().includes(brandSearchQuery.toLowerCase()) ||
        b.tagline.toLowerCase().includes(brandSearchQuery.toLowerCase()) ||
        b.description.toLowerCase().includes(brandSearchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeBrands, selectedBrandCategory, brandSearchQuery]);

  const goTo = (next: PageId, anchor?: string) => {
    setPage(next);
    setMobileNavOpen(false);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      if (anchor) {
        window.setTimeout(() => {
          const el = document.getElementById(anchor);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    });
  };

  const openLightbox = (items: LightboxImage[], index: number) => setLightbox({ items, index });

  const handleBrandImageClick = (brand: LandingBrandItem) => {
    if (!brand.imageUrl) return;
    const items: LightboxImage[] = activeBrands
      .filter((b) => b.imageUrl)
      .map((b) => ({ src: b.imageUrl!, title: b.name, caption: b.tagline }));
    const idx = items.findIndex((x) => x.src === brand.imageUrl);
    if (idx >= 0) openLightbox(items, idx);
    else openLightbox([{ src: brand.imageUrl!, title: brand.name, caption: brand.tagline }], 0);
  };

  const handleProductImageClick = (prod: LandingProductItem) => {
    if (!prod.imageUrl) return;
    const all = productGalleryImages;
    const idx = all.findIndex((x) => x.src === prod.imageUrl);
    if (idx >= 0) openLightbox(all, idx);
    else
      openLightbox(
        [{ src: prod.imageUrl!, title: prod.name, caption: `${prod.brand} · ${prod.priceEstimated}` }],
        0
      );
  };

  const handleGalleryImageClick = (item: LandingGalleryItem) => {
    if (!item.imageUrl) return;
    const items = activeGallery
      .filter((x) => x.imageUrl)
      .map((x) => ({ src: x.imageUrl!, title: x.title, caption: x.description }));
    const idx = items.findIndex((x) => x.src === item.imageUrl);
    if (idx >= 0) openLightbox(items, idx);
  };

  // Kumpulan semua gambar produk & galeri (untuk lightbox next/prev lintas item)
  const productGalleryImages = useMemo<LightboxImage[]>(
    () =>
      activeProducts
        .filter((p) => p.imageUrl)
        .map((p) => ({ src: p.imageUrl!, title: p.name, caption: `${p.brand} · ${p.priceEstimated}` }))
        .concat(
          activeGallery
            .filter((g) => g.imageUrl)
            .map((g) => ({ src: g.imageUrl!, title: g.title, caption: g.description }))
        ),
    [activeProducts, activeGallery]
  );

  /**************** WA Link Builder ****************/
  const buildWa = (customText?: string) => {
    const phone = config.contact.whatsappNumber.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    const msg = encodeURIComponent(
      customText ||
        `${config.contact.whatsappMessageTemplate}\n\n*Estimasi Pesanan via Web ${storeName}:*\n• Layanan: ${calculatedEstimate.title}\n• Rincian: ${calculatedEstimate.detailNote}\n• Estimasi Harga: Rp ${calculatedEstimate.estimatedTotal.toLocaleString('id-ID')}\n\nMohon informasi ketersediaan stok & proses pemesanannya. Terima kasih!`
    );
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };
  const wa = buildWa;

  /**************** Kalkulator harga (logika lama dipertahankan) ****************/
  const calculatedEstimate = useMemo(() => {
    let title = '';
    let estimatedTotal = 0;
    let detailNote = '';

    if (calcServiceType === 'meteran') {
      const pricePerMeter = calcBrand === 'ORACAL' ? 85000 : calcBrand === 'SAICHOLITE' ? 45000 : calcBrand === '3M' ? 95000 : 25000;
      estimatedTotal = pricePerMeter * Math.max(1, calcLengthMeters);
      title = `Stiker Vinyl ${calcBrand} (Meteran)`;
      detailNote = `${calcLengthMeters} Meter x Rp ${pricePerMeter.toLocaleString('id-ID')} / meter`;
    } else if (calcServiceType === 'roll') {
      const pricePerRoll = calcBrand === 'ORACAL' ? 3200000 : calcBrand === 'DEREK' ? 1850000 : 265000;
      estimatedTotal = pricePerRoll * Math.max(1, calcRollQty);
      title = `Stiker Vinyl ${calcBrand} (Roll Utuh)`;
      detailNote = `${calcRollQty} Roll x Rp ${pricePerRoll.toLocaleString('id-ID')} / roll (Grosir)`;
    } else if (calcServiceType === 'print') {
      const pricePerM2 = 75000;
      estimatedTotal = pricePerM2 * Math.max(0.5, calcPrintArea);
      title = 'Cetak Digital Printing Hi-Res (Vinyl + Laminasi)';
      detailNote = `${calcPrintArea} m² x Rp ${pricePerM2.toLocaleString('id-ID')} / m²`;
    } else {
      const pricePerCm2 = 40;
      estimatedTotal = Math.max(30000, pricePerCm2 * Math.max(100, calcLaserArea));
      title = 'Jasa Laser Cutting Presisi (Akrilik / Plywood)';
      detailNote = `${calcLaserArea} cm² x Rp ${pricePerCm2} / cm² (Min order Rp 30.000)`;
    }

    return { title, estimatedTotal, detailNote };
  }, [calcServiceType, calcBrand, calcLengthMeters, calcRollQty, calcPrintArea, calcLaserArea]);

  /**************** Form kontak → WhatsApp ****************/
  const submitContactForm = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `*Pertanyaan dari Website*\n\nNama: ${formName || '-'}\nEmail: ${formEmail || '-'}\nNo. Telepon: ${formPhone || '-'}\n\nPertanyaan:${formMessage || '-'}\n\nTerima kasih!`;
    const phone = config.contact.whatsappNumber.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans selection:bg-indigo-600 selection:text-white">
      {/* Pita pengumuman promo */}
      {config.hero.bannerAnnouncement && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white text-[11px] sm:text-xs py-2 px-4 text-center font-medium tracking-wide border-b border-indigo-900/60 flex items-center justify-center gap-2">
          <span>{config.hero.bannerAnnouncement}</span>
        </div>
      )}

      {/* Header navigasi utama */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goTo('home')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <StoreLogo size="md" rounded="rounded-xl" customLogoUrl={logoUrl} storeName={storeName} />
            <div className="text-left">
              <div className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                {storeName}
              </div>
              <div className="text-[9px] sm:text-[11px] font-bold text-indigo-700 tracking-wider uppercase">
                Stiker Vinyl • Digital Printing • Laser Cutting
              </div>
            </div>
          </button>

          {/* Menu desktop */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-700">
            {PAGE_MENUS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => goTo(m.id)}
                className={`py-1 transition-colors cursor-pointer border-b-2 ${
                  page === m.id
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-slate-600 hover:text-indigo-600 border-transparent'
                }`}
              >
                {m.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={wa('Halo Bejo Stiker! Saya ingin konsultasi stiker vinyl / kebutuhan cetak')}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp CS</span>
            </a>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onEnterApp}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <span>Buka POS & SPK</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {currentUser.role === 'DEVELOPER' && onOpenDeveloperCms && (
                  <button
                    type="button"
                    onClick={onOpenDeveloperCms}
                    className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer"
                    title="Edit Konten Landing Page (Khusus Developer)"
                  >
                    <Wrench className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md transition-all cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4 text-emerald-400" />
                <span>Login Sistem</span>
              </button>
            )}

            {/* Hamburger mobile */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              aria-label="Menu navigasi"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Menu mobile */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
            {PAGE_MENUS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => goTo(m.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  page === m.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ============================================================
          HALAMAN: BERANDA
     */}
      {page === 'home' && (
        <main>
          {/* 1. Slider banner */}
          <HeroSlider slides={activeSlides} />

          {/* 2. Our Advantages */}
          <section className="py-14 sm:py-20 bg-white border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <SectionHeading
                center
                eyebrow="Our Advantages"
                title="Solusi Stiker & Percetakan Terbaik"
                desc="Melalui ketepatan waktu, teknologi canggih, dan kemudahan akses — kami memastikan setiap pesanan sesuai dengan permintaan pelanggan."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {config.benefits.map((ben, idx) => (
                  <div
                    key={idx}
                    className="group bg-slate-50 hover:bg-white rounded-2xl p-5 border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all space-y-2.5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Award className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-black text-slate-900">{ben.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{ben.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 3. About Us preview */}
          <section className="py-14 sm:py-20 bg-slate-50/70 border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="relative">
                <div className="group rounded-3xl overflow-hidden border border-slate-200 shadow-xl">
                  <SmartImage
                    src={about.imageUrl}
                    alt={about.imageCaption || 'Foto workshop kami'}
                    className="w-full aspect-[4/3]"
                  />
                </div>
                {activeGallery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => goTo('about')}
                    className="absolute -bottom-4 -right-2 sm:-right-4 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-900 hover:text-white border border-slate-200 shadow-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    Lihat Galeri Workshop
                  </button>
                )}
              </div>

              <div className="space-y-5">
                <SectionHeading
                  eyebrow={about.eyebrow}
                  title={about.title}
                  desc={about.intro}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {about.stats.map((st, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-slate-200 p-3.5 shadow-xs text-center">
                      <div className="text-lg sm:text-xl font-black text-indigo-700">{st.value}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{st.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => goTo('about')}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all cursor-pointer"
                  >
                    <span>Baca Selengkapnya</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href={wa('Halo! Saya ingin kenalan lebih lanjut dengan layanan BEJO Stiker.')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold transition-all"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    Sapa Kami
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Product showcase (4 pertama + tombol see all) */}
          <section className="py-14 sm:py-20 bg-white border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <SectionHeading
                  eyebrow="Product"
                  title="Produk & Jasa Unggulan"
                  desc="Klik foto produk untuk melihat detail gambar dengan jelas."
                />
                <button
                  type="button"
                  onClick={() => goTo('products')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-800 text-xs font-black transition-all cursor-pointer shrink-0"
                >
                  <span>Lihat Semua Produk</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {activeProducts.slice(0, 4).map((prod) => (
                  <ProductCard
                    key={prod.id}
                    prod={prod}
                    wa={wa}
                    onImageClick={() => handleProductImageClick(prod)}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* 5. Solusi percetakan lengkap (accordion) */}
          <section className="py-14 sm:py-20 bg-slate-50/70 border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-8 lg:gap-12 items-start">
                <div className="space-y-5 lg:sticky lg:top-24">
                  <SectionHeading
                    eyebrow="Solusi Percetakan Lengkap"
                    title="Kebutuhan Cetak Ada di Satu Tempat"
                    desc="Dari stiker vinyl meteran sampai packaging custom — semua diproduksi langsung di workshop kami."
                  />
                  <div className="group rounded-3xl overflow-hidden border border-slate-200 shadow-lg">
                    <SmartImage
                      src={activeGallery[0]?.imageUrl}
                      alt={activeGallery[0]?.title || 'Workshop kami'}
                      className="w-full aspect-[4/3]"
                    />
                  </div>
                </div>
                <div>
                  <SolutionsAccordion services={activeServices} wa={wa} />
                </div>
              </div>
            </div>
          </section>

          {/* 6. Testimoni */}
          <section className="py-14 sm:py-20 bg-white border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <SectionHeading
                center
                eyebrow="Testimoni"
                title="Apa Kata Mereka"
                desc="Dipercaya bengkel, toko stiker, agen, komunitas, hingga perusahaan."
              />
              <TestimonialSlider items={activeTestimonials} />
            </div>
          </section>

          {/* 7. Logo klien */}
          <section className="py-14 sm:py-16 bg-slate-50/70 border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
                <SectionHeading eyebrow="Clients" title="Telah Dipercaya Oleh" />
                <button
                  type="button"
                  onClick={() => goTo('clients')}
                  className="inline-flex items-center gap-2 text-xs font-black text-indigo-700 hover:text-indigo-900 cursor-pointer"
                >
                  Lihat Klien & Testimoni Lengkap
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {activeClients.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:shadow-md transition-all min-h-[92px]"
                  >
                    {c.logoUrl ? (
                      <SmartImage src={c.logoUrl} alt={c.name} hoverZoom={false} className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                    )}
                    <span className="text-[10px] font-bold text-slate-600 text-center leading-tight">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 8. CTA strip */}
          <section className="py-16 bg-slate-900 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_15%_30%,rgba(99,102,241,0.5),transparent_45%),radial-gradient(circle_at_85%_65%,rgba(16,185,129,0.4),transparent_40%)]" />
            <div className="relative max-w-3xl mx-auto px-4 text-center space-y-5">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                Punya Pertanyaan? Hubungi Kami
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Tim marketing kami siap membantu memilih bahan terbaik, memberikan estimasi harga, dan menindaklanjuti pesanan Anda secepatnya.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => goTo('contact')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-slate-900 text-xs sm:text-sm font-black shadow-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4 text-indigo-600" />
                 Kirim Pesan via Website
                </button>
                <a
                  href={wa('Halo! Saya ingin bertanya tentang produk & layanan.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-black shadow-lg transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat WhatsApp
                </a>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ============================================================
          HALAMAN: TENTANG KAMI
     */}
      {page === 'about' && (
        <main>
          <PageHero title={about.title} eyebrow={about.eyebrow} subtitle={about.intro} />
          <section className="py-14 sm:py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                <div className="space-y-6">
                  <div className="group rounded-3xl overflow-hidden border border-slate-200 shadow-xl relative">
                    <SmartImage src={about.imageUrl} alt={about.imageCaption || 'Workshop'} className="w-full aspect-[4/3]" />
                    {about.imageCaption && (
                      <div className="absolute bottom-0 inset-x-0 bg-slate-950/70 text-white text-[10px] sm:text-xs font-bold px-4 py-2 backdrop-blur-sm">
                        {about.imageCaption}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {about.stats.map((st, i) => (
                      <div key={i} className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-center">
                        <div className="text-lg font-black text-indigo-700">{st.value}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{st.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  {about.paragraphs.map((p, i) => (
                    <p key={i} className="text-sm text-slate-600 leading-relaxed">
                      {p}
                    </p>
                  ))}
                  <div className="pt-2">
                    <a
                      href={wa(`Halo! Berkenalan dengan ${storeName}, saya ingin tahu lebih banyak.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all"
                    >
                      <span>{about.ctaText || 'Hubungi Kami'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Galeri workshop */}
              {activeGallery.length > 0 && (
                <div className="space-y-6">
                  <SectionHeading
                    eyebrow="Galeri"
                    title="Dokumentasi Workshop & Produksi"
                    desc="Klik thumbnail untuk melihat foto detail dengan jelas."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {activeGallery.map((g) => (
                      <div
                        key={g.id}
                        className={`group relative rounded-2xl overflow-hidden border border-slate-200 hover:shadow-lg transition-all ${
                          g.imageUrl ? 'cursor-zoom-in' : ''
                        }`}
                        onClick={() => handleGalleryImageClick(g)}
                      >
                        <div className="relative aspect-[4/3] group">
                          <SmartImage src={g.imageUrl} alt={g.title} className="w-full h-full absolute inset-0" />
                        </div>
                        <div className="p-3 bg-white group-hover:bg-slate-50 transition-colors">
                          <div className="text-xs font-black text-slate-900 truncate">{g.title}</div>
                          {g.description && (
                            <div className="text-[10px] text-slate-500 truncate">{g.description}</div>
                          )}
                        </div>
                        {g.imageUrl && (
                          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/60 text-white hidden group-hover:flex items-center justify-center transition-all">
                            <Eye className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nilai / keunggulan */}
              <div className="space-y-6">
                <SectionHeading center eyebrow="Nilai Kami" title="Mengapa Pelanggan Memilih Kami" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {config.benefits.map((ben, idx) => (
                    <div key={idx} className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-2 hover:border-indigo-300 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                        <Award className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900">{ben.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{ben.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ============================================================
          HALAMAN: PRODUK & LAYANAN
     */}
      {page === 'products' && (
        <main>
          <PageHero
            title="Produk, Merk & Layanan Produksi"
            eyebrow="Product"
            subtitle="Katalog lengkap merk stiker dunia tangan pertama, layanan digital printing & laser cutting, plus kalkulator estimasi harga instan."
          />

          {/* Katalog merk */}
          <section id="katalog-merk" className="py-14 sm:py-20 bg-white border-b border-slate-100 scroll-mt-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <SectionHeading
                  eyebrow="Katalog Merk"
                  title="Pilihan Merk Stiker Vinyl Dunia"
                  desc="Klik foto merk untuk melihat detail gambar dengan jelas."
                />
                <div className="relative w-full md:w-72 shrink-0">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={brandSearchQuery}
                    onChange={(e) => setBrandSearchQuery(e.target.value)}
                    placeholder="Cari merk (Decofix, 3M, Oracal...)"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-bold scrollbar-none">
                {[
                  { v: 'all', label: `Semua Merk (${activeBrands.length})` },
                  { v: 'wrapping', label: '🚗 Automotive Wrapping' },
                  { v: 'cutting', label: '✂️ Cutting & Signage' },
                  { v: 'reflective', label: '✨ Scotlite / Reflektif' },
                  { v: 'protection', label: '🛡️ PPF & Protection' },
                  { v: 'printing', label: '🖨️ Bahan Digital Print' },
                  { v: 'general', label: '📦 Lainnya' },
                ].map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setSelectedBrandCategory(c.v)}
                    className={`px-4 py-2 rounded-xl transition-all shrink-0 cursor-pointer ${
                      selectedBrandCategory === c.v
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredBrands.map((brand) => (
                  <BrandCard
                    key={brand.id}
                    brand={brand}
                    wa={wa}
                    onImageClick={() => handleBrandImageClick(brand)}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Layanan */}
          <section id="layanan" className="py-14 sm:py-20 bg-slate-900 text-white scroll-mt-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              <SectionHeading
                center
                dark
                eyebrow="Layanan Workshop Mandiri"
                title="Digital Printing, Laser Cutting & Grosir Stiker"
                desc="Didukung mesin produksi beresolusi tinggi milik sendiri untuk kecepatan pengerjaan maksimal."
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {activeServices.map((serv) => (
                  <div
                    key={serv.id}
                    className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 flex flex-col hover:border-indigo-500 transition-all shadow-md"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center mb-4">
                      {serv.iconName === 'printer' && <Printer className="w-6 h-6 text-indigo-400" />}
                      {serv.iconName === 'scissors' && <Scissors className="w-6 h-6 text-indigo-400" />}
                      {serv.iconName === 'package' && <Package className="w-6 h-6 text-indigo-400" />}
                    </div>
                    <h3 className="text-lg font-black tracking-tight mb-1">{serv.title}</h3>
                    <div className="text-xs font-bold text-indigo-400 mb-3">{serv.subtitle}</div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-4">{serv.description}</p>
                    <div className="space-y-2 mb-5">
                      {serv.highlights.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href={wa(`Halo! Saya berminat order layanan: *${serv.title}*`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                      <span>{serv.ctaLabel || 'Order Layanan Ini'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Produk unggulan dengan foto */}
          <section id="produk-unggulan" className="py-14 sm:py-20 bg-white border-b border-slate-100 scroll-mt-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <SectionHeading
                center
                eyebrow="Katalog Produk Populer"
                title="Produk & Layanan Favorit Pelanggan"
                desc="Klik foto produk untuk popup detail yang jelas."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeProducts.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    prod={prod}
                    wa={wa}
                    onImageClick={() => handleProductImageClick(prod)}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Kalkulator */}
          <section id="kalkulator" className="py-14 sm:py-20 bg-slate-100/80 scroll-mt-24">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl">
                <div className="text-center space-y-2 mb-8">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    <span>Simulasi Biaya Cepat</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Kalkulator Estimasi Harga
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Pilih kebutuhan Anda untuk melihat perkiraan harga & konsultasi via WhatsApp.
                  </p>
                </div>

                <div className="space-y-4 mb-6">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    1. Pilih Kebutuhan Layanan / Produk:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { v: 'meteran', label: 'Stiker Meteran' },
                      { v: 'roll', label: 'Roll Utuh (Grosir)' },
                      { v: 'print', label: 'Digital Print' },
                      { v: 'laser', label: 'Laser Cutting' },
                    ].map((t) => (
                      <button
                        key={t.v}
                        type="button"
                        onClick={() => setCalcServiceType(t.v as typeof calcServiceType)}
                        className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          calcServiceType === t.v
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {(calcServiceType === 'meteran' || calcServiceType === 'roll') && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Merk Stiker:</label>
                      <select
                        value={calcBrand}
                        onChange={(e) => setCalcBrand(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="DECOFIX">DECOFIX (Super Gloss / Matte)</option>
                        <option value="ORACAL">ORACAL 651 (German Quality)</option>
                        <option value="DEREK">DEREK (Candy Chrome / Metallic)</option>
                        <option value="CAR DIARY">CAR DIARY (Automotive Styling)</option>
                        <option value="WT PREMIUM">WT PREMIUM (Color Wrap)</option>
                        <option value="SAICHOLITE">SAICHOLITE (Reflektif Scotlite)</option>
                        <option value="3M">3M (Scotchcal / Industrial)</option>
                        <option value="NANO GARD">NANO GARD (PPF Pelindung)</option>
                      </select>
                    </div>
                  )}

                  {calcServiceType === 'meteran' && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Panjang Kebutuhan (Meter):</label>
                      <input
                        type="number"
                        min="1"
                        value={calcLengthMeters}
                        onChange={(e) => setCalcLengthMeters(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {calcServiceType === 'roll' && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Jumlah Roll:</label>
                      <input
                        type="number"
                        min="1"
                        value={calcRollQty}
                        onChange={(e) => setCalcRollQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {calcServiceType === 'print' && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Luas Cetak (m²):</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={calcPrintArea}
                        onChange={(e) => setCalcPrintArea(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {calcServiceType === 'laser' && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Luas Bidang Akrilik (cm²):</label>
                      <input
                        type="number"
                        step="50"
                        min="100"
                        value={calcLaserArea}
                        onChange={(e) => setCalcLaserArea(Math.max(100, parseInt(e.target.value) || 100))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-indigo-400">{calculatedEstimate.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{calculatedEstimate.detailNote}</div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                      Rp {calculatedEstimate.estimatedTotal.toLocaleString('id-ID')}
                      <span className="text-xs font-normal text-slate-400 ml-1.5">(Perkiraan)</span>
                    </div>
                  </div>
                  <a
                    href={buildWa()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm shadow-md transition-all shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Kirim Estimasi ke WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ============================================================
          HALAMAN: KLIEN & TESTIMONI
     */}
      {page === 'clients' && (
        <main>
          <PageHero
            title="Klien & Testimoni Pelanggan"
            eyebrow="Clients"
            subtitle="Dipercaya bengkel variasi, toko stiker, agen, event organizer, komunitas, hingga perusahaan besar."
          />
          <section className="py-14 sm:py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
              <div className="space-y-8">
                <SectionHeading center eyebrow="Testimoni" title="Pengalaman Pelanggan Kami" />
                <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {activeTestimonials.map((t) => (
                    <TestimonialCard key={t.id} t={t} />
                  ))}
                </div>
                <div className="lg:hidden">
                  <TestimonialSlider items={activeTestimonials} />
                </div>
              </div>

              <div className="space-y-6">
                <SectionHeading center eyebrow="Clients" title="Logo & Nama Pelanggan" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {activeClients.map((c) => (
                    <div
                      key={c.id}
                      className="bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 p-4 flex flex-col items-center justify-center gap-2 hover:shadow-md transition-all min-h-[110px]"
                    >
                      {c.logoUrl ? (
                        <SmartImage src={c.logoUrl} alt={c.name} hoverZoom={false} className="w-14 h-14 object-contain" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                          <Building2 className="w-5 h-5" />
                        </div>
                      )}
                      <span className="text-[11px] font-black text-slate-800 text-center">{c.name}</span>
                      {c.websiteUrl && (
                        <a
                          href={c.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Website
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => goTo('contact')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  <span>Jadi Pelanggan Berikutnya</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ============================================================
          HALAMAN: KONTAK
     */}
      {page === 'contact' && (
        <main>
          <PageHero
            title="Punya Pertanyaan? Hubungi Kami"
            eyebrow="Contact Us"
            subtitle="Kirim pertanyaan lewat formulir (otomatis diteruskan ke WhatsApp), hubungi PIC cabang, atau kunjungi toko kami langsung."
          />
          <section className="py-14 sm:py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8">
                {/* Formulir */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-600" />
                    Formulir Pertanyaan
                  </h3>
                  <form onSubmit={submitContactForm} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Nama *</label>
                        <input
                          type="text"
                          required
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Nomor Telepon</label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            value={formPhone}
                            onChange={(e) => setFormPhone(e.target.value)}
                            className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Email</label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Pesan *</label>
                      <textarea
                        required
                        rows={5}
                        value={formMessage}
                        onChange={(e) => setFormMessage(e.target.value)}
                        placeholder="Tuliskan kebutuhan Anda: merk bahan, jumlah, deadline, dll."
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-y"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-900 hover:bg-indigo-700 text-white text-sm font-black shadow-md transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      Kirim Pertanyaan (via WhatsApp)
                    </button>
                  </form>
                </div>

                {/* Panel kontak */}
                <div className="space-y-5">
                  <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-3">
                    <h3 className="text-sm font-black flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-emerald-400" />
                      Kontak Cepat
                    </h3>
                    <a
                      href={wa('Halo! Saya ingin bertanya via WhatsApp.')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-2xl font-black text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      {config.contact.phoneDisplay}
                    </a>
                    <div className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      {config.contact.operatingHours}
                    </div>
                    <div className="flex items-start gap-2 text-[11px] text-slate-300 pt-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{config.contact.storeAddress}</span>
                    </div>
                    {config.contact.googleMapsUrl && (
                      <a
                        href={config.contact.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Buka Google Maps
                      </a>
                    )}
                  </div>

                  {/* Cabang / kantor */}
                  {activeOffices.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        Toko & Cabang
                      </h3>
                      {activeOffices.map((o) => (
                        <div key={o.id} className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5">
                          <div className="text-xs font-black text-slate-900">{o.name}</div>
                          <div className="flex items-start gap-2 text-[11px] text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{o.address}</span>
                          </div>
                          {o.phone && (
                            <a
                              href={`https://wa.me/${o.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 hover:underline"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              {o.phone}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Media sosial */}
                  {activeSocials.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-3">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Globe className="w-4 h-4 text-indigo-600" />
                        Media Sosial
                      </h3>
                      <div className="space-y-2">
                        {activeSocials.map((s) => (
                          <a
                            key={s.id}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                          >
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                                {s.label.slice(0, 2).toUpperCase()}
                              </span>
                              {s.label}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <StoreLogo size="sm" rounded="rounded-lg" customLogoUrl={logoUrl} storeName={storeName} />
                <div className="text-sm font-black text-white">{storeName}</div>
              </div>
              <p className="text-[11px] leading-relaxed">{config.hero.subheadline}</p>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Navigasi</div>
              {PAGE_MENUS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => goTo(m.id)}
                  className="block text-xs font-semibold hover:text-white transition-colors cursor-pointer"
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Kontak</div>
              <div className="flex items-center gap-2 text-xs font-semibold font-mono">{config.contact.phoneDisplay}</div>
              <div className="flex items-start gap-2 text-[11px] leading-relaxed">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
                {config.contact.storeAddress}
              </div>
              {activeSocials.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeSocials.map((s) => (
                    <a
                      key={s.id}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-white text-[10px] font-bold transition-all"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <div>&copy; {new Date().getFullYear()} {storeName}. All rights reserved.</div>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <span className="font-mono text-[10px]">
                Distributor: DECOFIX • ORACAL • DEREK • CAR DIARY • 3M • SAICHOLITE • DURATAC
              </span>
              <button
                type="button"
                onClick={onOpenLogin}
                className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
              >
                Akses Internal Karyawan (Login)
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Lightbox gambar detail */}
      {lightbox && (
        <Lightbox
          images={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChangeIndex={(i) => setLightbox((prev) => (prev ? { ...prev, index: i } : prev))}
        />
      )}
    </div>
  );
};

/* ============================================================
   Sub-komponen halaman
   ============================================================ */

const PageHero: React.FC<{ title: string; eyebrow: string; subtitle?: string }> = ({ title, eyebrow, subtitle }) => (
  <section className="relative bg-slate-950 text-white overflow-hidden">
    <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.45),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.3),transparent_40%)]" />
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-3">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-300">{eyebrow}</span>
      <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight max-w-3xl">{title}</h1>
      {subtitle && <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl leading-relaxed">{subtitle}</p>}
    </div>
  </section>
);

/** Kartu produk dengan foto + tombol zoom */
const ProductCard: React.FC<{
  prod: LandingProductItem;
  wa: (t?: string) => string;
  onImageClick: () => void;
}> = ({ prod, wa, onImageClick }) => (
  <div className="group bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all overflow-hidden flex flex-col">
    <div className="relative aspect-square bg-white">
      <SmartImage src={prod.imageUrl} alt={prod.name} onClick={onImageClick} className="w-full h-full absolute inset-0" />
      <div className="absolute top-3 left-3 flex gap-1.5">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-950/85 text-white uppercase tracking-wider backdrop-blur-sm">
          {prod.brand}
        </span>
        {prod.badge && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500 text-white uppercase">{prod.badge}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onImageClick}
        className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-950 text-white text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer opacity-0 group-hover:opacity-100 backdrop-blur-sm"
        title="Lihat detail gambar"
      >
        <Eye className="w-3 h-3" />
        Detail
      </button>
    </div>

    <div className="p-4 space-y-1.5 flex-1">
      <h4 className="text-sm font-black text-slate-900 leading-snug">{prod.name}</h4>
      <div className="text-[10px] font-mono text-slate-500">{prod.specs}</div>
      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">{prod.description}</p>
    </div>

    <div className="px-4 pb-4 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
      <div>
        <div className="text-[10px] text-slate-400 font-bold uppercase">{prod.unit}</div>
        <div className="text-sm font-black text-indigo-700">{prod.priceEstimated}</div>
      </div>
      <a
        href={wa(`Halo! Mau order produk: *${prod.name}* (${prod.priceEstimated})`)}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white transition-colors"
        title="Pesan produk ini via WhatsApp"
      >
        <MessageCircle className="w-4 h-4" />
      </a>
    </div>
  </div>
);

/** Kartu merk dengan foto */
const BrandCard: React.FC<{
  brand: LandingBrandItem;
  wa: (t?: string) => string;
  onImageClick: () => void;
}> = ({ brand, wa, onImageClick }) => (
  <div className="group bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all overflow-hidden flex flex-col">
    <div
      className={`relative aspect-[16/10] bg-white ${brand.imageUrl ? 'cursor-zoom-in' : ''}`}
      onClick={() => brand.imageUrl && onImageClick()}
    >
      <SmartImage src={brand.imageUrl} alt={brand.name} className="w-full h-full absolute inset-0" />
      <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-950/85 text-white uppercase backdrop-blur-sm">
        {brand.name}
      </span>
      {brand.badge && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-600 text-white uppercase">
          {brand.badge}
        </span>
      )}
    </div>

    <div className="p-4 space-y-2 flex-1">
      <p className="text-xs font-bold text-slate-700">{brand.tagline}</p>
      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">{brand.description}</p>
      <div className="space-y-1">
        {brand.features.slice(0, 4).map((feat, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">{feat}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="px-4 pb-4">
      <a
        href={wa(`Halo! Mau tanya stok & harga stiker merk *${brand.name}*`)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-900 hover:text-white text-slate-800 border border-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 group-hover:border-indigo-400"
      >
        <MessageCircle className="w-3.5 h-3.5 text-emerald-600 group-hover:text-emerald-400" />
        <span>Tanya Stok {brand.name}</span>
      </a>
    </div>
  </div>
);

/** Accordion solusi (ala "Solusi Percetakan Lengkap" subur) */
const SolutionsAccordion: React.FC<{
  services: import('../../types').LandingServiceItem[];
  wa: (t?: string) => string;
}> = ({ services, wa }) => {
  const [openId, setOpenId] = useState<string | null>(services[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {services.map((serv) => {
        const open = openId === serv.id;
        return (
          <div
            key={serv.id}
            className={`rounded-2xl border transition-all overflow-hidden ${
              open ? 'bg-white border-indigo-300 shadow-lg' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : serv.id)}
              className="w-full flex items-center gap-3 p-4 text-left cursor-pointer"
            >
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 transition-all ${
                  open ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'
                }`}
              >
                {open ? '−' : '+'}
              </span>
              <span className="flex-1 text-sm sm:text-base font-black text-slate-900">{serv.title}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="px-4 pb-4 space-y-3">
                <div className="text-xs font-bold text-indigo-700">{serv.subtitle}</div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{serv.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {serv.highlights.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={wa(`Halo! Saya berminat order layanan: *${serv.title}*`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-indigo-700 text-white text-xs font-black transition-all"
                >
                  <span>{serv.ctaLabel || 'Order Layanan Ini'}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Kartu testimoni (grid versi halaman klien) */
const TestimonialCard: React.FC<{ t: LandingTestimonial }> = ({ t }) => (
  <div className="bg-slate-50 hover:bg-white rounded-3xl border border-slate-200 hover:border-indigo-200 hover:shadow-lg transition-all p-6 space-y-4 flex flex-col">
    <div className="flex items-start justify-between gap-3">
      <Quote className="w-7 h-7 text-indigo-100" />
      {t.logoUrl ? (
        <SmartImage src={t.logoUrl} alt={t.company} hoverZoom={false} className="w-12 h-12 rounded-full border border-slate-200" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 text-xs font-black">
          {t.company.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">“{t.quote}”</p>
    <div className="mt-auto border-t border-slate-200 pt-3">
      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
        <User className="w-3.5 h-3.5 text-slate-400" />
        {t.author}
      </div>
      <div className="text-[11px] text-slate-500 font-semibold">{t.role}</div>
      <div className="text-xs font-black text-indigo-700">{t.company}</div>
    </div>
  </div>
);
