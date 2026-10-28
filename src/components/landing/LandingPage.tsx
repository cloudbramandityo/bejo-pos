/**
 * BEJO Digital Print
 * Public Landing Page — tampilan mengikuti referensi uprint.id
 *
 * Struktur: header (topbar + mega menu), hero slider gambar, judul H1,
 * tab kategori + slider kartu 9:16, template design, problem customer,
 * mengapa kami, fasilitas produksi, klien, testimoni, blog, FAQ, footer.
 *
 * Coded by Langgo Bramandityo.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_NAME } from '../../config/brand';
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Facebook,
  Globe,
  Warehouse,
  Image as ImageIcon,
  Instagram,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Music2,
  Phone,
  Play,
  Plus,
  Quote,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  User,
  X,
  Youtube,
} from 'lucide-react';
import type {
  AppUser,
  LandingBlogPost,
  LandingButtonLink,
  LandingCategoryCard,
  LandingCategoryGroup,
  LandingFaqItem,
  LandingMenuItem,
  LandingPageConfig,
  LandingPageKey,
  LandingRoute,
  LandingSlide,
} from '../../types';
import { openLandingButtonLink, readableTextColor } from '../../utils/landingLinks';

/* -------------------------------------------------------------------------- */
/*  Token desain                                                              */
/* -------------------------------------------------------------------------- */
const FONT_STACK = "'Quicksand', 'Segoe UI', system-ui, -apple-system, sans-serif";
/** Main Accent */
const ACCENT = '#00AAFF';
/** Secondary Accent */
const ACCENT_2 = '#FF4400';
/** Active tab / warna highlight */
const ACTIVE = '#00AAFF';
/** Background seksi (putih tulang) */
const CREAM = '#F1F2F2';
/** Body text */
const INK = '#111111';
/** Teks muted */
const MUTED = '#7A7A7A';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */
interface LandingPageProps {
  config: LandingPageConfig;
  storeName?: string;
  logoUrl?: string;
  currentUser?: AppUser | null;
  onOpenLogin: () => void;
  onEnterApp?: () => void;
  onOpenDeveloperCms?: () => void;
  /** true saat dirender di dalam pratinjau CMS (menonaktifkan aksi mengambang & auto-scroll) */
  embedded?: boolean;
}

interface LightboxItem {
  src: string;
  title: string;
}

/* -------------------------------------------------------------------------- */
/*  Gambar dengan placeholder                                                 */
/* -------------------------------------------------------------------------- */
const Frame: React.FC<{
  src?: string;
  alt: string;
  label?: string;
  className?: string;
  imgClassName?: string;
  dark?: boolean;
  bare?: boolean;
}> = ({ src, alt, label, className, imgClassName, dark, bare }) => (
  <div className={cx('relative h-full w-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-[#F1F2F2]', className)}>
    {src ? (
      <img src={src} alt={alt} className={cx('h-full w-full object-cover', imgClassName)} loading="lazy" />
    ) : (
      <div
        className={cx(
          'absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center',
          dark
            ? 'bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_55%,#0b4f6f_100%)] text-white/55'
            : 'text-slate-400'
        )}
      >
        <ImageIcon size={26} />
        {!bare && <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label || alt}</span>}
      </div>
    )}
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Tombol gulir horizontal                                                   */
/* -------------------------------------------------------------------------- */
const ScrollArrows: React.FC<{ onPrev: () => void; onNext: () => void; light?: boolean }> = ({
  onPrev,
  onNext,
  light,
}) => (
  <>
    <button
      type="button"
      onClick={onPrev}
      aria-label="Sebelumnya"
      className={cx(
        'absolute left-0 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border transition-colors md:flex',
        light
          ? 'border-white/70 text-white hover:bg-white hover:text-[#111]'
          : 'border-slate-300 bg-white text-slate-600 hover:border-[#00AAFF] hover:text-[#00AAFF]'
      )}
      style={{ left: -20 }}
    >
      <ChevronLeft size={18} />
    </button>
    <button
      type="button"
      onClick={onNext}
      aria-label="Berikutnya"
      className={cx(
        'absolute right-0 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border transition-colors md:flex',
        light
          ? 'border-white/70 text-white hover:bg-white hover:text-[#111]'
          : 'border-slate-300 bg-white text-slate-600 hover:border-[#00AAFF] hover:text-[#00AAFF]'
      )}
      style={{ right: -20 }}
    >
      <ChevronRight size={18} />
    </button>
  </>
);

const useScroller = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: 'smooth' });
  };
  return { ref, prev: () => scrollBy(-1), next: () => scrollBy(1) };
};

/* -------------------------------------------------------------------------- */
/*  Hero slider                                                               */
/* -------------------------------------------------------------------------- */
const HeroSlider: React.FC<{ slides: LandingSlide[]; onCta: (slide: LandingSlide) => void }> = ({
  slides,
  onCta,
}) => {
  const [index, setIndex] = useState(0);
  const total = slides.length;

  useEffect(() => {
    if (total <= 1) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % total), 6500);
    return () => window.clearInterval(timer);
  }, [total]);

  useEffect(() => {
    if (index > total - 1) setIndex(0);
  }, [index, total]);

  if (total === 0) {
    return (
      <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#F1F2F2] sm:aspect-[16/9]">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <ImageIcon size={32} />
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">Banner belum diunggah</span>
        </div>
      </div>
    );
  }

  const controlsOnImage = slides[index]?.displayMode === 'image';

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-slate-900 sm:aspect-[16/9]">
      {slides.map((s, i) => {
        const overlayMode = s.displayMode !== 'image';

        return (
          <div
            key={s.id}
            className={cx(
              'absolute inset-0 transition-opacity duration-700',
              i === index ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
          >
            {s.imageUrl ? (
              <img src={s.imageUrl} alt={s.title || `Banner ${i + 1}`} className="h-full w-full object-cover" />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: 'linear-gradient(120deg, #0f172a 0%, #1e3a5f 55%, #00AAFF 150%)' }}
              />
            )}

            {overlayMode && (
              <>
                <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-center px-6 py-8 sm:px-10 md:px-16">
                  {s.eyebrow && (
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-white/90 md:text-[12px]">
                      {s.eyebrow}
                    </p>
                  )}
                  {s.title && (
                    <h2 className="max-w-[720px] whitespace-pre-line text-2xl font-semibold leading-[1.15] text-white sm:text-3xl md:text-[42px]">
                      {s.title}
                    </h2>
                  )}
                  {s.ctaText && (
                    <button
                      type="button"
                      onClick={() => onCta(s)}
                      className="mt-6 w-fit rounded-full border border-white/90 px-7 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-white hover:text-[#111] md:text-[13px]"
                    >
                      {s.ctaText}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {total > 1 && (
        <>
          <div className="absolute bottom-5 left-6 flex items-center gap-2 md:left-10">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + total) % total)}
              aria-label="Banner sebelumnya"
              className={cx(
                'flex h-9 w-9 items-center justify-center rounded-full border border-white/70 text-white transition-colors hover:bg-white hover:text-[#111]',
                controlsOnImage && 'bg-black/30'
              )}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % total)}
              aria-label="Banner berikutnya"
              className={cx(
                'flex h-9 w-9 items-center justify-center rounded-full border border-white/70 text-white transition-colors hover:bg-white hover:text-[#111]',
                controlsOnImage && 'bg-black/30'
              )}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div
            className={cx(
              'absolute bottom-6 right-6 flex items-center gap-1.5 md:right-10',
              controlsOnImage && 'rounded-full bg-black/30 px-2 py-1'
            )}
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Banner ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cx(
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Header + mega menu                                                        */
/* -------------------------------------------------------------------------- */
const Header: React.FC<{
  config: LandingPageConfig;
  logo?: string;
  currentUser?: AppUser | null;
  onNavigate: (page: LandingPageKey, categoryKey?: string) => void;
  onSearch: (q: string) => void;
  onOpenLogin: () => void;
  onEnterApp?: () => void;
}> = ({ config, logo, currentUser, onNavigate, onSearch, onOpenLogin, onEnterApp }) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const activeMenu = config.menu.filter((m) => m.isActive);
  const sideOf = (m: LandingMenuItem) => m.position ?? (m.type === 'link' ? 'right' : 'left');
  const leftMenu = activeMenu.filter((m) => sideOf(m) === 'left');
  const rightMenu = activeMenu.filter((m) => sideOf(m) === 'right');

  const handleMegaLink = (link: { page?: LandingPageKey; categoryKey?: string }) => {
    setOpenMenu(null);
    setMobileOpen(false);
    if (link.page) onNavigate(link.page);
    else onNavigate('products', link.categoryKey);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
    setQuery('');
  };

  return (
    <div className="sticky top-0 z-40">
      {/* Top bar */}
      <div className="hidden border-b border-slate-100 bg-white md:block">
        <div className="mx-auto flex h-9 max-w-[1200px] items-center justify-between px-4 text-[12px] text-[#7A7A7A]">
          <div className="flex items-center gap-5">
            <a href={`tel:${config.contact.phoneDisplay}`} className="flex items-center gap-1.5 transition-colors hover:text-[#00AAFF]">
              <Phone size={12} /> {config.contact.phoneDisplay}
            </a>
            <a
              href={`mailto:${config.contact.emailDisplay || ''}`}
              className="flex items-center gap-1.5 transition-colors hover:text-[#00AAFF]"
            >
              <Mail size={12} /> {config.contact.emailDisplay}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={onOpenLogin} className="flex items-center gap-1.5 transition-colors hover:text-[#00AAFF]">
              <User size={12} /> {currentUser ? 'Buka Aplikasi' : 'Masuk'}
            </button>
            {currentUser && onEnterApp && (
              <button type="button" onClick={onEnterApp} className="font-semibold text-[#111] transition-colors hover:text-[#00AAFF]">
                Dashboard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="border-b border-slate-100 bg-white shadow-[0_2px_14px_-10px_rgba(0,0,0,0.35)]">
        <div className="mx-auto grid h-[72px] max-w-[1200px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          {/* Kiri: nav desktop / hamburger mobile */}
          <div className="flex items-center">
            <button
              type="button"
              className="md:hidden"
              aria-label="Buka menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <nav className="hidden items-center gap-4 md:flex lg:gap-5">
              {leftMenu.map((item) => (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => item.type === 'mega' && setOpenMenu(item.id)}
                  onMouseLeave={() => item.type === 'mega' && setOpenMenu(null)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (item.type === 'mega') setOpenMenu((v) => (v === item.id ? null : item.id));
                      else if (item.page) onNavigate(item.page);
                    }}
                    className={cx(
                      'flex items-center gap-1 whitespace-nowrap py-6 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors lg:text-[12px]',
                      openMenu === item.id ? 'text-[#00AAFF]' : 'text-[#111] hover:text-[#00AAFF]'
                    )}
                  >
                    {item.label}
                    {item.type === 'mega' && <ChevronDown size={12} />}
                  </button>
                </div>
              ))}
            </nav>
          </div>

          {/* Tengah: logo */}
          <button type="button" onClick={() => onNavigate('home')} className="flex flex-col items-center leading-none">
            {logo ? (
              <img src={logo} alt={config.brand.name} className="h-11 w-auto object-contain" />
            ) : (
              <span className="text-[24px] font-bold tracking-tight text-[#111] md:text-[27px]">
                {config.brand.name.split(' ')[0]}
                <span className="text-[#00AAFF]">{config.brand.name.split(' ').slice(1).join(' ')}</span>
              </span>
            )}
            <span className="mt-1 text-[8px] font-medium uppercase tracking-[0.24em] text-[#7A7A7A] md:text-[9px]">
              {config.brand.tagline}
            </span>
          </button>

          {/* Kanan: nav + search */}
          <div className="flex items-center justify-end gap-4">
            <nav className="hidden items-center gap-3 md:flex lg:gap-4">
              {rightMenu.map((item) => (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => item.type === 'mega' && setOpenMenu(item.id)}
                  onMouseLeave={() => item.type === 'mega' && setOpenMenu(null)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (item.type === 'mega') setOpenMenu((v) => (v === item.id ? null : item.id));
                      else if (item.page) onNavigate(item.page);
                    }}
                    className={cx(
                      'flex items-center gap-1 whitespace-nowrap py-6 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors lg:text-[12px]',
                      openMenu === item.id ? 'text-[#00AAFF]' : 'text-[#111] hover:text-[#00AAFF]'
                    )}
                  >
                    {item.label}
                    {item.type === 'mega' && <ChevronDown size={12} />}
                  </button>
                </div>
              ))}
            </nav>

            <form
              onSubmit={submitSearch}
              className="hidden h-9 items-center gap-2 rounded-full border border-[#00AAFF] px-3 lg:flex"
            >
              <Search size={14} className="text-[#00AAFF]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari Produk"
                className="w-24 bg-transparent text-[12px] text-[#111] outline-none placeholder:text-slate-400"
              />
            </form>
            <button type="button" className="lg:hidden" aria-label="Cari" onClick={() => onNavigate('products')}>
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Mega menu panel */}
        {activeMenu
          .filter((m) => m.type === 'mega' && m.columns && m.columns.length > 0)
          .map((item) => (
            <div
              key={item.id}
              className={cx(
                'absolute left-0 right-0 top-full border-t border-slate-100 bg-white shadow-[0_24px_40px_-24px_rgba(0,0,0,0.4)] transition-all',
                openMenu === item.id ? 'visible opacity-100' : 'invisible -translate-y-1 opacity-0'
              )}
              onMouseEnter={() => setOpenMenu(item.id)}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-4 py-8 md:grid-cols-4">
                {item.columns!.map((col) => (
                  <div key={col.id}>
                    <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-[#111]" style={{ fontFamily: col.fontFamily || undefined, fontSize: col.fontSize ? `${col.fontSize}px` : undefined }}>{col.heading}</p>
                    <ul className="space-y-2">
                      {col.links.map((link) => (
                        <li key={link.id}>
                          <button
                            type="button"
                            onClick={() => handleMegaLink(link)}
                            className="text-left text-[13px] text-slate-600 transition-colors hover:text-[#00AAFF]"
                            style={{ fontFamily: link.fontFamily || undefined, fontSize: link.fontSize ? `${link.fontSize}px` : undefined }}
                          >
                            {link.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="border-b border-slate-200 bg-white md:hidden">
          <div className="max-h-[70vh] overflow-y-auto px-4 py-2">
            {activeMenu.map((item) => (
              <div key={item.id} className="border-b border-slate-100 py-1">
                <button
                  type="button"
                  onClick={() => {
                    if (item.type === 'mega') setMobileExpanded((v) => (v === item.id ? null : item.id));
                    else if (item.page) {
                      onNavigate(item.page);
                      setMobileOpen(false);
                    }
                  }}
                  className="flex w-full items-center justify-between py-3 text-[12px] font-semibold uppercase tracking-wide"
                >
                  {item.label}
                  {item.type === 'mega' && (
                    <ChevronDown
                      size={14}
                      className={cx('transition-transform', mobileExpanded === item.id && 'rotate-180')}
                    />
                  )}
                </button>
                {item.type === 'mega' && mobileExpanded === item.id && (
                  <div className="pb-3">
                    {item.columns?.map((col) => (
                      <div key={col.id} className="mb-3">
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {col.heading}
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {col.links.map((link) => (
                            <button
                              key={link.id}
                              type="button"
                              onClick={() => handleMegaLink(link)}
                              className="text-left text-[12px] text-slate-600"
                            >
                              {link.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenLogin();
              }}
              className="my-3 w-full rounded-full bg-[#111] py-2.5 text-[12px] font-semibold text-white"
            >
              {currentUser ? 'Buka Aplikasi' : 'Masuk'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Header seksi                                                              */
/* -------------------------------------------------------------------------- */
const SectionTitle: React.FC<{ children: React.ReactNode; className?: string; subtitle?: string }> = ({
  children,
  className,
  subtitle,
}) => (
  <div className={cx('text-center', className)}>
    <h2 className="text-[18px] font-bold uppercase tracking-[0.02em] text-[#111] md:text-[22px]">{children}</h2>
    {subtitle && <p className="mx-auto mt-2 max-w-[640px] text-[13px] leading-relaxed text-[#7A7A7A]">{subtitle}</p>}
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Seksi kategori                                                            */
/* -------------------------------------------------------------------------- */
const CategorySection: React.FC<{
  categories: LandingCategoryGroup[];
  onOpenCard: (card: LandingCategoryCard, group: LandingCategoryGroup) => void;
}> = ({ categories, onOpenCard }) => {
  const [activeKey, setActiveKey] = useState(categories[0]?.key || '');
  const scroller = useScroller();

  useEffect(() => {
    if (!categories.some((c) => c.key === activeKey)) setActiveKey(categories[0]?.key || '');
  }, [categories, activeKey]);

  const group = categories.find((c) => c.key === activeKey) || categories[0];
  if (!group) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-2">
      <div className="flex justify-center gap-8 overflow-x-auto border-b border-slate-200 [scrollbar-width:none]">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveKey(cat.key)}
            className={cx(
              'shrink-0 border-b-2 pb-3 pt-4 text-[15px] font-medium uppercase tracking-wide transition-colors',
              cat.key === activeKey
                ? 'border-[#00AAFF] font-bold text-[#00AAFF]'
                : 'border-transparent text-[#7A7A7A] hover:text-[#111]'
            )}
          >
            {cat.title}
          </button>
        ))}
      </div>

      <div className="py-8 text-center">
        <h2 className="text-[15px] font-bold text-[#111] md:text-[17px]">{group.heading}</h2>
        <p className="mx-auto mt-2 max-w-[680px] text-[12.5px] leading-relaxed text-[#7A7A7A]">{group.description}</p>
      </div>

      <div className="relative pb-10">
        <div
          ref={scroller.ref}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {group.cards
            .filter((c) => c.isActive)
            .map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => onOpenCard(card, group)}
                className="group relative w-[68%] shrink-0 snap-start overflow-hidden rounded-lg bg-[#F1F2F2] sm:w-[42%] md:w-[calc((100%-40px)/3)]"
                style={{ aspectRatio: '9 / 16' }}
              >
                <Frame src={card.imageUrl} alt={card.label} label={card.label} imgClassName="transition-transform duration-500 group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />
                {card.imageUrl && (
                  <span className="absolute right-3 top-3 text-right text-[13px] font-medium uppercase leading-tight text-white drop-shadow-md md:text-[14px]">
                    {card.label}
                  </span>
                )}
              </button>
            ))}
        </div>
        <ScrollArrows onPrev={scroller.prev} onNext={scroller.next} />
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Template design                                                           */
/* -------------------------------------------------------------------------- */
const TemplateSection: React.FC<{
  config: LandingPageConfig;
  onOpen: (index: number) => void;
  onOpenLink: (link: LandingButtonLink | undefined) => void;
}> = ({ config, onOpen, onOpenLink }) => {
  const promos = config.templatePromos.filter((p) => p.isActive);
  if (promos.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-6">
      <SectionTitle className="mb-6">Produk Template Design</SectionTitle>
      <div className="grid gap-5 md:grid-cols-2">
        {promos.map((promo, i) => (
          <div
            key={promo.id}
            className="group relative overflow-hidden rounded-xl bg-slate-900 text-left"
            style={{ aspectRatio: '16 / 8' }}
          >
            <button
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`Pratinjau ${promo.title}`}
              className="absolute inset-0 h-full w-full"
            >
              <Frame src={promo.imageUrl} alt={promo.title} label={promo.title} dark bare imgClassName="transition-transform duration-500 group-hover:scale-[1.04]" />
              <span className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/25 to-transparent" />
            </button>
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-center px-7 md:px-9">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/85">{promo.eyebrow}</p>
              <p className="mt-2 max-w-[280px] whitespace-pre-line text-[19px] font-semibold leading-tight text-white md:text-[24px]">
                {promo.title}
              </p>
              {promo.ctaText && (
                <button
                  type="button"
                  onClick={() => onOpenLink(promo.ctaLink)}
                  className="pointer-events-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-white/80 px-5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-white hover:text-[#111]"
                >
                  {promo.ctaText} <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Problem customer                                                          */
/* -------------------------------------------------------------------------- */
const ProblemSection: React.FC<{
  config: LandingPageConfig;
  onOpenLink: (link: LandingButtonLink | undefined) => void;
}> = ({ config, onOpenLink }) => {
  const problem = config.problem;
  const left = problem.points.filter((p) => p.side === 'left');
  const right = problem.points.filter((p) => p.side === 'right');
  const primaryColor = problem.primaryCtaColor || ACCENT;
  const secondaryColor = problem.secondaryCtaColor || ACCENT_2;
  const showPrimary = problem.primaryCtaEnabled !== false && !!problem.primaryCtaText?.trim();
  const showSecondary = problem.secondaryCtaEnabled !== false && !!problem.secondaryCtaText?.trim();

  const Point: React.FC<{ text: string; align: 'left' | 'right'; fontSize?: number; fontFamily?: string }> = ({ text, align, fontSize, fontFamily }) => (
    <div className={cx('flex items-start gap-2', align === 'right' && 'md:flex-row-reverse md:text-right')}>
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
      <p className="leading-snug text-slate-600" style={{ fontSize: fontSize ? `${fontSize}px` : '12.5px', fontFamily: fontFamily ? fontFamily : undefined }}>{text}</p>
    </div>
  );

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-12">
      <SectionTitle className="mb-8" subtitle="Kami memahami tantangan yang sering dihadapi saat mencetak kebutuhan brand Anda.">
        {problem.title}
      </SectionTitle>

      <div className="grid items-center gap-8 md:grid-cols-[1fr_1.1fr_1fr]">
        <div className="order-2 space-y-5 md:order-1">
          {left.map((p) => (
            <Point key={p.id} text={p.text} align="left" fontSize={p.fontSize || problem.pointsFontSize} fontFamily={p.fontFamily || problem.pointsFontFamily} />
          ))}
        </div>

        <div className="order-1 mx-auto w-full max-w-[420px] md:order-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl" style={{ backgroundColor: CREAM }}>
            <Frame src={problem.imageUrl} alt="Ilustrasi problem customer" label="Ilustrasi Problem Customer" />
          </div>
        </div>

        <div className="order-3 space-y-5">
          {right.map((p) => (
            <Point key={p.id} text={p.text} align="right" fontSize={p.fontSize || problem.pointsFontSize} fontFamily={p.fontFamily || problem.pointsFontFamily} />
          ))}
        </div>
      </div>

      {(showPrimary || showSecondary) && (
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {showPrimary && (
            <button
              type="button"
              onClick={() => onOpenLink(problem.primaryLink)}
              style={{ backgroundColor: primaryColor, color: readableTextColor(primaryColor) }}
              className="rounded-full px-9 py-3 text-[14px] font-bold transition hover:-translate-y-0.5 hover:brightness-105"
            >
              {problem.primaryCtaText}
            </button>
          )}
          {showSecondary && (
            <button
              type="button"
              onClick={() => onOpenLink(problem.secondaryLink)}
              style={{ backgroundColor: secondaryColor, color: readableTextColor(secondaryColor) }}
              className="rounded-full px-9 py-3 text-[14px] font-bold transition hover:-translate-y-0.5 hover:brightness-105"
            >
              {problem.secondaryCtaText}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Mengapa kami (statistik)                                                  */
/* -------------------------------------------------------------------------- */
const StatsSection: React.FC<{ stats: LandingPageConfig['stats']; about: LandingPageConfig['about'] }> = ({ stats, about }) => {
  const items = stats.filter((s) => s.isActive);
  if (items.length === 0) return null;

  return (
    <section style={{ backgroundColor: CREAM }} className="py-14">
      <div className="mx-auto max-w-[1200px] px-4">
        <SectionTitle className="mb-10">Mengapa {APP_NAME}?</SectionTitle>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl bg-slate-900" style={{ aspectRatio: '16 / 9' }}>
            {about.imageUrl ? (
              <img src={about.imageUrl} alt={about.imageCaption || 'Profil perusahaan'} className="h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40">
                  <Play size={20} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">Video Profil</span>
              </div>
            )}
          </div>

          <div className="space-y-7">
            {items.map((stat) => (
              <div key={stat.id} className="flex items-start gap-5">
                <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white">
                  {stat.iconUrl ? (
                    <img src={stat.iconUrl} alt={stat.label} className="h-full w-full object-cover" />
                  ) : (
                    <Sparkles size={26} className="text-[#00AAFF]" />
                  )}
                </div>
                <div>
                  <p className="text-[28px] font-semibold leading-none text-[#111] md:text-[32px]">{stat.value}</p>
                  <p className="mt-1 text-[13px] font-semibold text-[#111]">{stat.label}</p>
                  <p className="mt-1 max-w-[420px] text-[12.5px] leading-relaxed text-[#7A7A7A]">{stat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Fasilitas produksi                                                        */
/* -------------------------------------------------------------------------- */
const FacilitiesSection: React.FC<{ facilities: LandingPageConfig['facilities'] }> = ({ facilities }) => {
  const items = facilities.filter((f) => f.isActive);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-14">
      <SectionTitle className="mb-8" subtitle="Didukung mesin produksi sendiri untuk hasil presisi dan pengerjaan tepat waktu.">
        Fasilitas Produksi Lengkap
      </SectionTitle>
      <div className={cx('grid gap-5 sm:grid-cols-2', items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        {items.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-xl bg-[#F1F2F2]">
            <div className="relative" style={{ aspectRatio: '4 / 3' }}>
              <Frame src={item.imageUrl} alt={item.title} label={item.title} />
            </div>
            <p className="px-4 py-3 text-[13px] font-semibold text-[#111]">{item.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Klien kami                                                                */
/* -------------------------------------------------------------------------- */
const ClientsSection: React.FC<{ clients: LandingPageConfig['clients'] }> = ({ clients }) => {
  const items = clients.filter((c) => c.isActive);
  const scroller = useScroller();
  if (items.length === 0) return null;

  return (
    <section style={{ backgroundColor: CREAM }} className="py-14">
      <div className="mx-auto max-w-[1200px] px-4">
        <SectionTitle className="mb-8">Klien Kami</SectionTitle>
        <div className="relative">
          <div ref={scroller.ref} className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((client) => (
              <a
                key={client.id}
                href={client.websiteUrl || undefined}
                target={client.websiteUrl ? '_blank' : undefined}
                rel={client.websiteUrl ? 'noreferrer' : undefined}
                className="flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-xl bg-white p-3 shadow-sm transition-transform hover:-translate-y-0.5"
                title={client.name}
              >
                {client.logoUrl ? (
                  <img src={client.logoUrl} alt={client.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-center text-[10px] font-bold uppercase leading-tight text-[#7A7A7A]">{client.name}</span>
                )}
              </a>
            ))}
          </div>
          <ScrollArrows onPrev={scroller.prev} onNext={scroller.next} />
        </div>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Testimoni                                                                 */
/* -------------------------------------------------------------------------- */
const TestimonialsSection: React.FC<{ testimonials: LandingPageConfig['testimonials'] }> = ({ testimonials }) => {
  const items = testimonials.filter((t) => t.isActive);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-14">
      <SectionTitle className="mb-8">Apa Kata Mereka?</SectionTitle>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((t) => (
          <div key={t.id} className="flex h-full flex-col rounded-xl p-6" style={{ backgroundColor: CREAM }}>
            <Quote size={26} className="text-[#00AAFF]" />
            <div className="mt-3 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} className="fill-[#00AAFF] text-[#00AAFF]" />
              ))}
            </div>
            <p className="mt-3 flex-1 text-[12.5px] leading-relaxed text-slate-600">{t.quote}</p>
            <div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-4">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white">
                {t.logoUrl ? (
                  <img src={t.logoUrl} alt={t.company} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[12px] font-bold text-[#00AAFF]">{t.author.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="text-[12px] font-bold text-[#111]">{t.author}</p>
                <p className="text-[11px] text-[#7A7A7A]">
                  {t.role}
                  {t.company ? ` · ${t.company}` : ''}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Blog                                                                      */
/* -------------------------------------------------------------------------- */
const BlogSection: React.FC<{ posts: LandingBlogPost[]; onOpen: (post: LandingBlogPost) => void }> = ({ posts, onOpen }) => {
  const items = posts.filter((p) => p.isActive);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-14">
      <SectionTitle className="mb-8" subtitle="Tips, panduan, dan inspirasi seputar dunia cetak untuk bisnis Anda.">
        Blog
      </SectionTitle>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => onOpen(post)}
            className="group relative overflow-hidden rounded-xl bg-slate-900 text-left"
            style={{ aspectRatio: '16 / 11' }}
          >
            <Frame src={post.imageUrl} alt={post.title} label={post.title} dark bare imgClassName="transition-transform duration-500 group-hover:scale-[1.04]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="line-clamp-2 text-[16px] font-semibold leading-snug text-white md:text-[17px]">{post.title}</p>
              <span className="mt-3 flex w-fit items-center gap-2 rounded-full border border-white/70 px-4 py-1.5 text-[11px] font-semibold text-white transition-colors group-hover:bg-white group-hover:text-[#111]">
                Lihat Artikel <ArrowRight size={12} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                       */
/* -------------------------------------------------------------------------- */
const FaqSection: React.FC<{ faqs: LandingFaqItem[] }> = ({ faqs }) => {
  const items = faqs.filter((f) => f.isActive);
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-14">
      <SectionTitle className="mb-8">Frequently Asked Question (FAQ)</SectionTitle>
      <div className="mx-auto max-w-[820px]">
        {items.map((faq) => {
          const isOpen = open === faq.id;
          return (
            <div key={faq.id} className="border-b border-slate-200">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : faq.id)}
                className="flex w-full items-start justify-between gap-4 py-4 text-left"
              >
                <span className={cx('text-[13.5px] font-semibold', isOpen ? 'text-[#111]' : 'text-slate-700')}>
                  {faq.question}
                </span>
                <span className="mt-0.5 shrink-0 text-[#00AAFF]">
                  {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                </span>
              </button>
              {isOpen && <p className="pb-4 pr-8 text-[12.5px] leading-relaxed text-[#7A7A7A]">{faq.answer}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Footer                                                                    */
/* -------------------------------------------------------------------------- */
const Footer: React.FC<{
  config: LandingPageConfig;
  logo?: string;
  onNavigate: (page: LandingPageKey, categoryKey?: string) => void;
  onOpenSocial: (url: string) => void;
}> = ({ config, logo, onNavigate, onOpenSocial }) => {
  const socials = (config.socials || [])
    .filter((s) => s.isActive && typeof s.url === 'string' && s.url.trim())
    .map((s) => {
      const url = s.url.trim();
      return { ...s, url: /^https?:\/\//i.test(url) ? url : `https://${url}` };
    });
  const wa = config.contact.whatsappNumber.replace(/[^0-9]/g, '');

  const socialIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('instagram')) return <Instagram size={16} />;
    if (l.includes('tiktok')) return <Music2 size={16} />;
    if (l.includes('facebook')) return <Facebook size={16} />;
    if (l.includes('youtube')) return <Youtube size={16} />;
    if (l.includes('whatsapp')) return <MessageCircle size={16} />;
    if (l.includes('tokopedia')) return <Store size={16} />;
    if (l.includes('shopee')) return <ShoppingBag size={16} />;
    return <Globe size={16} />;
  };

  const blockLink = (link: { id: string; label: string; page?: LandingPageKey; categoryKey?: string }) => {
    if (link.page) onNavigate(link.page);
    else if (link.categoryKey) onNavigate('products', link.categoryKey);
  };

  return (
    <footer className="border-t border-slate-200 bg-white pt-12">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            {logo ? (
              <img src={logo} alt={config.brand.name} className="h-14 w-auto object-contain" />
            ) : (
              <p className="text-[26px] font-bold leading-none text-[#111]">
                {config.brand.name.split(' ')[0]}
                <span className="text-[#00AAFF]">{config.brand.name.split(' ').slice(1).join(' ')}</span>
              </p>
            )}
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.24em] text-[#7A7A7A]">
              {config.brand.tagline}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {socials.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenSocial(s.url)}
                title={s.label}
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F2F2] text-[#111] transition-colors hover:bg-[#00AAFF]"
              >
                {socialIcon(s.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-5 border-y border-slate-200 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3">
            <Clock size={18} className="mt-0.5 shrink-0 text-[#00AAFF]" />
            <div>
              <p className="text-[12px] font-bold text-[#111]">Jam Operasional</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[#7A7A7A]">{config.contact.operatingHours}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-[12px] font-bold text-[#111]">WhatsApp</p>
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 block text-[11.5px] text-[#7A7A7A] transition-colors hover:text-[#00AAFF]"
              >
                {config.contact.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin size={18} className="mt-0.5 shrink-0 text-rose-500" />
            <div>
              <p className="text-[12px] font-bold text-[#111]">Kantor</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[#7A7A7A]">{config.contact.storeAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Warehouse size={18} className="mt-0.5 shrink-0 text-sky-600" />
            <div>
              <p className="text-[12px] font-bold text-[#111]">Workshop</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[#7A7A7A]">
                {config.contact.factoryAddress || config.contact.storeAddress}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5">
          {config.footerColumns.map((col) => (
            <div key={col.id}>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{col.heading}</p>
              <div className="mt-3 space-y-4">
                {col.blocks.map((block) => (
                  <div key={block.id}>
                    {block.title && <p className="mb-2 text-[12.5px] font-bold text-[#111]">{block.title}</p>}
                    <ul className="space-y-1.5 border-l border-slate-200 pl-3">
                      {block.links.map((link) => (
                        <li key={link.id}>
                          <button
                            type="button"
                            onClick={() => blockLink(link)}
                            className="text-left text-[12px] text-[#7A7A7A] transition-colors hover:text-[#00AAFF]"
                          >
                            {link.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 py-5">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-2 px-4 text-[11px] text-[#7A7A7A] sm:flex-row">
          <p>
            © {new Date().getFullYear()} {config.brand.name}. {config.footerNote}
          </p>
          <p className="flex items-center gap-3">
            <span>Syarat &amp; Ketentuan</span>
            <span className="text-slate-300">|</span>
            <span>Kebijakan Privasi</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

/* -------------------------------------------------------------------------- */
/*  Page hero                                                                 */
/* -------------------------------------------------------------------------- */
const PageHero: React.FC<{ title: string; subtitle?: string; crumb: string; onHome: () => void }> = ({
  title,
  subtitle,
  crumb,
  onHome,
}) => (
  <section style={{ backgroundColor: CREAM }} className="border-b border-slate-200">
    <div className="mx-auto max-w-[1200px] px-4 py-12 text-center md:py-16">
      <div className="mb-3 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#7A7A7A]">
        <button type="button" onClick={onHome} className="transition-colors hover:text-[#00AAFF]">
          Beranda
        </button>
        <span>/</span>
        <span className="text-[#111]">{crumb}</span>
      </div>
      <h1 className="text-[24px] font-bold uppercase tracking-[0.02em] text-[#111] md:text-[32px]">{title}</h1>
      {subtitle && <p className="mx-auto mt-3 max-w-[720px] text-[13px] leading-relaxed text-[#7A7A7A]">{subtitle}</p>}
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  Lightbox                                                                  */
/* -------------------------------------------------------------------------- */
const Lightbox: React.FC<{
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}> = ({ items, index, onClose, onIndex }) => {
  const item = items[index];
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBroken, setIsBroken] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setIsBroken(false);
  }, [item?.src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % items.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + items.length) % items.length);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [index, items.length, onClose, onIndex]);

  if (!item) return null;

  const hasMultiple = items.length > 1;
  const showImage = Boolean(item.src) && !isBroken;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.title || 'Pratinjau gambar'}
    >
      {/*
        Kartu mengikuti ukuran gambar: tidak ada padding, tidak ada kotak aspect-ratio
        tetap, jadi tidak ada bilah kosong di tepi gambar. Bila gambar lebih besar dari
        layar, ukurannya dibatasi 92vh / 95vw lalu tetap menempel tanpa ruang kosong.
      */}
      <div
        className="group relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cx(
            'relative inline-flex overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-[0_24px_70px_-15px_rgba(0,0,0,0.85)]',
            !isLoaded && showImage && 'min-h-[88px] min-w-[180px]'
          )}
        >
          {showImage ? (
            <img
              src={item.src}
              alt={item.title}
              onLoad={() => setIsLoaded(true)}
              onError={() => setIsBroken(true)}
              draggable={false}
              className={cx(
                'block h-auto w-auto max-h-[92vh] max-w-[95vw] select-none transition-opacity duration-300',
                isLoaded ? 'opacity-100' : 'opacity-0'
              )}
            />
          ) : (
            <div className="flex h-40 w-64 flex-col items-center justify-center gap-1.5 text-white/60">
              <ImageIcon size={26} />
              <span className="text-[11px]">{isBroken ? 'Gambar gagal dimuat' : 'Gambar tidak tersedia'}</span>
            </div>
          )}

          {showImage && !isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/25 border-t-white/90" />
            </div>
          )}

          {item.title && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-4 pb-3 pt-8">
              <p className="truncate text-[12.5px] font-medium leading-snug text-white/95">{item.title}</p>
            </div>
          )}

          {hasMultiple && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-medium text-white/85 backdrop-blur-sm">
              {index + 1} / {items.length}
            </span>
          )}

          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={() => onIndex((index - 1 + items.length) % items.length)}
                aria-label="Sebelumnya"
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-sm transition hover:bg-black/70 md:opacity-0 md:group-hover:opacity-100"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => onIndex((index + 1) % items.length)}
                aria-label="Berikutnya"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-sm transition hover:bg-black/70 md:opacity-0 md:group-hover:opacity-100"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white hover:text-black"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Halaman: Beranda                                                          */
/* -------------------------------------------------------------------------- */
const HomePage: React.FC<{
  config: LandingPageConfig;
  onNavigate: (page: LandingPageKey, categoryKey?: string) => void;
  onOpenLightbox: (items: LightboxItem[], index: number) => void;
}> = ({ config, onNavigate, onOpenLightbox }) => {
  const categories = config.categories.filter((c) => c.isActive);
  const consult = () => {
    const wa = config.contact.whatsappNumber.replace(/[^0-9]/g, '');
    if (wa) window.open(`https://wa.me/${wa}`, '_blank', 'noopener,noreferrer');
  };
  const openLink = (link: LandingButtonLink | undefined) =>
    openLandingButtonLink(link, { contact: config.contact, navigate: (page) => onNavigate(page), fallback: consult });

  const openCard = (card: LandingCategoryCard, group: LandingCategoryGroup) => {
    const list = group.cards.filter((c) => c.isActive);
    onOpenLightbox(
      list.map((c) => ({ src: c.imageUrl || '', title: `${c.label} — ${group.title}` })),
      Math.max(0, list.findIndex((c) => c.id === card.id))
    );
  };

  return (
    <>
      <section className="mx-auto max-w-[1200px] px-4 pt-6">
        <HeroSlider slides={config.slides.filter((s) => s.isActive)} onCta={(slide) => openLink(slide.ctaLink)} />
      </section>

      <section className="mx-auto max-w-[900px] px-4 py-9 text-center">
        <h1 className="text-[17px] font-semibold uppercase leading-snug tracking-[0.01em] text-[#111] md:text-[24px]">
          {config.hero.headline}
        </h1>
        <p className="mx-auto mt-3 max-w-[760px] text-[12.5px] leading-relaxed text-[#7A7A7A] md:text-[13.5px]">
          {config.hero.subheadline}
        </p>
      </section>

      <CategorySection categories={categories} onOpenCard={openCard} />

      <TemplateSection
        config={config}
        onOpenLink={openLink}
        onOpen={(i) => {
          const promos = config.templatePromos.filter((p) => p.isActive);
          onOpenLightbox(
            promos.map((p) => ({ src: p.imageUrl || '', title: p.title })),
            i
          );
        }}
      />

      <ProblemSection config={config} onOpenLink={openLink} />
      <StatsSection stats={config.stats} about={config.about} />
      <FacilitiesSection facilities={config.facilities} />
      <ClientsSection clients={config.clients} />
      <TestimonialsSection testimonials={config.testimonials} />
      <BlogSection posts={config.blogPosts} onOpen={(post) => onOpenLightbox([{ src: post.imageUrl || '', title: post.title }], 0)} />
      <FaqSection faqs={config.faqs} />
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Halaman: Tentang Kami                                                     */
/* -------------------------------------------------------------------------- */
const AboutPage: React.FC<{
  config: LandingPageConfig;
  onNavigate: (page: LandingPageKey, categoryKey?: string) => void;
  onOpenLightbox: (items: LightboxItem[], index: number) => void;
}> = ({ config, onNavigate, onOpenLightbox }) => {
  const about = config.about;
  const gallery = config.gallery.filter((g) => g.isActive);

  return (
    <>
      <PageHero title="Tentang Kami" subtitle={about.eyebrow} crumb="Tentang Kami" onHome={() => onNavigate('home')} />

      <section className="mx-auto max-w-[1200px] px-4 py-14">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: '9 / 7' }}>
            <Frame src={about.imageUrl} alt={about.imageCaption || 'Tentang kami'} label="Foto Workshop" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#00AAFF]">{about.eyebrow}</p>
            <h2 className="mt-2 text-[22px] font-bold leading-snug text-[#111] md:text-[28px]">{about.title}</h2>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-600">{about.intro}</p>
            <div className="mt-5 space-y-3">
              {about.paragraphs.map((p, i) => (
                <p key={i} className="text-[12.5px] leading-relaxed text-[#7A7A7A]">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {about.stats.map((stat, i) => (
            <div key={i} className="rounded-xl px-5 py-6 text-center" style={{ backgroundColor: CREAM }}>
              <p className="text-[26px] font-semibold text-[#111]">{stat.value}</p>
              <p className="mt-1 text-[12px] text-[#7A7A7A]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {gallery.length > 0 && (
        <section style={{ backgroundColor: CREAM }} className="py-14">
          <div className="mx-auto max-w-[1200px] px-4">
            <SectionTitle className="mb-8">Dokumentasi Workshop</SectionTitle>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {gallery.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onOpenLightbox(
                      gallery.map((g) => ({ src: g.imageUrl || '', title: g.title })),
                      i
                    )
                  }
                  className="overflow-hidden rounded-xl bg-white text-left"
                >
                  <div className="relative" style={{ aspectRatio: '4 / 3' }}>
                    <Frame src={item.imageUrl} alt={item.title} label={item.title} />
                  </div>
                  <div className="p-4">
                    <p className="text-[12.5px] font-semibold text-[#111]">{item.title}</p>
                    {item.description && <p className="mt-1 text-[11.5px] text-[#7A7A7A]">{item.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1200px] px-4 py-14">
        <div className="flex flex-col items-center justify-between gap-5 rounded-2xl bg-[#111] px-8 py-10 text-center md:flex-row md:text-left">
          <div>
            <p className="text-[18px] font-semibold text-white">{about.ctaText}</p>
            <p className="mt-1 text-[12.5px] text-white/60">Tim kami siap membantu kebutuhan cetak Anda.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              openLandingButtonLink(about.ctaLink, {
                contact: config.contact,
                navigate: (page) => onNavigate(page),
                fallback: () => onNavigate('contact')
              })
            }
            className="rounded-full bg-[#00AAFF] px-7 py-2.5 text-[13px] font-bold text-[#111] transition-transform hover:-translate-y-0.5"
          >
            Hubungi Kami
          </button>
        </div>
      </section>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Halaman: Produk                                                           */
/* -------------------------------------------------------------------------- */
const ProductsPage: React.FC<{
  config: LandingPageConfig;
  initialCategory?: string;
  query: string;
  onNavigate: (page: LandingPageKey, categoryKey?: string) => void;
  onOpenLightbox: (items: LightboxItem[], index: number) => void;
}> = ({ config, initialCategory, query, onNavigate, onOpenLightbox }) => {
  const categories = config.categories.filter((c) => c.isActive);
  const [active, setActive] = useState(initialCategory || 'all');

  useEffect(() => {
    setActive(initialCategory || 'all');
  }, [initialCategory]);

  const visibleGroups = categories.filter((c) => active === 'all' || c.key === active);
  const q = query.trim().toLowerCase();

  return (
    <>
      <PageHero
        title={active === 'all' ? 'Produk Cetak Custom' : categories.find((c) => c.key === active)?.title || 'Produk'}
        subtitle="Pilih kategori untuk melihat produk yang sesuai dengan kebutuhan bisnis Anda."
        crumb="Produk"
        onHome={() => onNavigate('home')}
      />

      <section className="mx-auto max-w-[1200px] px-4 py-10">
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setActive('all')}
            className={cx(
              'rounded-full border px-5 py-2 text-[12px] font-semibold uppercase tracking-wide transition-colors',
              active === 'all'
                ? 'border-[#00AAFF] bg-[#00AAFF] text-[#111]'
                : 'border-slate-200 text-[#7A7A7A] hover:border-[#00AAFF]'
            )}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActive(cat.key)}
              className={cx(
                'rounded-full border px-5 py-2 text-[12px] font-semibold uppercase tracking-wide transition-colors',
                active === cat.key
                  ? 'border-[#00AAFF] bg-[#00AAFF] text-[#111]'
                  : 'border-slate-200 text-[#7A7A7A] hover:border-[#00AAFF]'
              )}
            >
              {cat.title}
            </button>
          ))}
        </div>

        {visibleGroups.map((group) => {
          const cards = group.cards.filter((c) => c.isActive && (!q || c.label.toLowerCase().includes(q)));
          if (cards.length === 0) return null;
          return (
            <div key={group.id} className="mt-12">
              <div className="mb-5 text-center">
                <h2 className="text-[15px] font-bold text-[#111] md:text-[17px]">{group.heading}</h2>
                <p className="mx-auto mt-2 max-w-[680px] text-[12.5px] leading-relaxed text-[#7A7A7A]">{group.description}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((card, i) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() =>
                      onOpenLightbox(
                        cards.map((c) => ({ src: c.imageUrl || '', title: `${c.label} — ${group.title}` })),
                        i
                      )
                    }
                    className="group relative overflow-hidden rounded-lg bg-[#F1F2F2] text-left"
                    style={{ aspectRatio: '9 / 16' }}
                  >
                    <Frame src={card.imageUrl} alt={card.label} label={card.label} imgClassName="transition-transform duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />
                    {card.imageUrl && (
                      <span className="absolute right-3 top-3 text-right text-[13px] font-medium uppercase leading-tight text-white drop-shadow-md md:text-[14px]">
                        {card.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {visibleGroups.every((g) => g.cards.filter((c) => c.isActive && (!q || c.label.toLowerCase().includes(q))).length === 0) && (
          <p className="mt-16 text-center text-[13px] text-[#7A7A7A]">Produk tidak ditemukan. Coba kata kunci lain.</p>
        )}
      </section>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Halaman: Klien                                                            */
/* -------------------------------------------------------------------------- */
const ClientsPage: React.FC<{
  config: LandingPageConfig;
  onNavigate: (page: LandingPageKey, categoryKey?: string) => void;
}> = ({ config, onNavigate }) => {
  const clients = config.clients.filter((c) => c.isActive);

  return (
    <>
      <PageHero
        title="Klien Kami"
        subtitle="Dipercaya oleh UMKM, brand lokal, hingga perusahaan yang rutin mencetak bersama kami."
        crumb="Klien Kami"
        onHome={() => onNavigate('home')}
      />

      <section className="mx-auto max-w-[1200px] px-4 py-14">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex h-[130px] items-center justify-center rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              {client.logoUrl ? (
                <img src={client.logoUrl} alt={client.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-center text-[12px] font-bold uppercase tracking-wide text-[#7A7A7A]">{client.name}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <TestimonialsSection testimonials={config.testimonials} />

      <section className="mx-auto max-w-[1200px] px-4 pb-16">
        <div className="flex flex-col items-center justify-between gap-5 rounded-2xl px-8 py-10 text-center md:flex-row md:text-left" style={{ backgroundColor: CREAM }}>
          <div>
            <p className="text-[18px] font-semibold text-[#111]">Ingin menjadi klien berikutnya?</p>
            <p className="mt-1 text-[12.5px] text-[#7A7A7A]">Konsultasikan kebutuhan cetak Anda hari ini.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('contact')}
            className="rounded-full bg-[#111] px-7 py-2.5 text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Konsultasi Gratis
          </button>
        </div>
      </section>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Halaman: Kontak                                                           */
/* -------------------------------------------------------------------------- */
const ContactPage: React.FC<{
  config: LandingPageConfig;
  onNavigate: (page: LandingPageKey, categoryKey?: string) => void;
}> = ({ config, onNavigate }) => {
  const offices = config.offices.filter((o) => o.isActive);
  const contact = config.contact;
  const wa = contact.whatsappNumber.replace(/[^0-9]/g, '');

  return (
    <>
      <PageHero
        title="Kontak"
        subtitle="Hubungi tim kami untuk konsultasi, penawaran, atau pertanyaan seputar layanan cetak."
        crumb="Kontak"
        onHome={() => onNavigate('home')}
      />

      <section className="mx-auto max-w-[1200px] px-4 py-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <MessageCircle size={20} />, title: 'WhatsApp', value: contact.phoneDisplay, href: `https://wa.me/${wa}` },
            { icon: <Mail size={20} />, title: 'Email', value: contact.emailDisplay || '-', href: `mailto:${contact.emailDisplay || ''}` },
            { icon: <MapPin size={20} />, title: 'Kantor', value: contact.storeAddress },
            { icon: <Clock size={20} />, title: 'Jam Operasional', value: contact.operatingHours },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: CREAM }}>
                <span className="text-[#00AAFF]">{item.icon}</span>
              </span>
              <p className="mt-3 text-[12px] font-bold uppercase tracking-wide text-slate-400">{item.title}</p>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer" className="mt-1 block text-[13px] font-semibold text-[#111] hover:text-[#00AAFF]">
                  {item.value}
                </a>
              ) : (
                <p className="mt-1 text-[13px] leading-snug text-[#111]">{item.value}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-[16px] font-bold text-[#111]">Kantor &amp; Workshop</h2>
            <div className="mt-4 space-y-3">
              {offices.map((office) => (
                <div key={office.id} className="rounded-xl border border-slate-100 p-4">
                  <p className="text-[13px] font-bold text-[#111]">{office.name}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#7A7A7A]">{office.address}</p>
                  <p className="mt-1 text-[12px] text-[#7A7A7A]">{office.phone}</p>
                </div>
              ))}
              {contact.factoryAddress && (
                <div className="rounded-xl border border-slate-100 p-4">
                  <p className="text-[13px] font-bold text-[#111]">Workshop Produksi</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#7A7A7A]">{contact.factoryAddress}</p>
                </div>
              )}
            </div>
            {contact.googleMapsUrl && (
              <a
                href={contact.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#111] px-5 py-2 text-[12px] font-semibold text-white"
              >
                <MapPin size={14} /> Lihat di Google Maps <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div className="rounded-2xl p-6" style={{ backgroundColor: CREAM }}>
            <h2 className="text-[16px] font-bold text-[#111]">Kirim Pesan</h2>
            <p className="mt-1 text-[12.5px] text-[#7A7A7A]">
              Isi detail kebutuhan Anda, kami akan membalas melalui WhatsApp.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const data = new FormData(form);
                const text = `Halo ${config.brand.name},%0A%0ANama: ${data.get('name')}%0AKebutuhan: ${data.get('need')}%0APesan: ${data.get('message')}`;
                window.open(`https://wa.me/${wa}?text=${text}`, '_blank');
              }}
            >
              <input
                name="name"
                required
                placeholder="Nama Anda"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] outline-none focus:border-[#00AAFF]"
              />
              <input
                name="need"
                required
                placeholder="Kebutuhan cetak"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] outline-none focus:border-[#00AAFF]"
              />
              <textarea
                name="message"
                rows={4}
                required
                placeholder="Tulis pesan Anda"
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] outline-none focus:border-[#00AAFF]"
              />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#111] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#00AAFF] hover:text-[#111]"
              >
                Kirim via WhatsApp <ArrowRight size={14} />
              </button>
            </form>
          </div>
        </div>
      </section>

      <FaqSection faqs={config.faqs} />
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Halaman: Blog                                                             */
/* -------------------------------------------------------------------------- */
const BlogPage: React.FC<{
  config: LandingPageConfig;
  onNavigate: (page: LandingPageKey, categoryKey?: string) => void;
  onOpenLightbox: (items: LightboxItem[], index: number) => void;
}> = ({ config, onNavigate, onOpenLightbox }) => {
  const posts = config.blogPosts.filter((p) => p.isActive);

  return (
    <>
      <PageHero
        title="Inspirasi Cetak"
        subtitle="Tips, panduan, dan inspirasi seputar dunia cetak untuk bisnis Anda."
        crumb="Inspirasi Cetak"
        onHome={() => onNavigate('home')}
      />

      <section className="mx-auto max-w-[1200px] px-4 py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <article key={post.id} className="overflow-hidden rounded-xl border border-slate-100 shadow-sm">
              <div className="relative" style={{ aspectRatio: '16 / 10' }}>
                <Frame src={post.imageUrl} alt={post.title} label={post.title} />
              </div>
              <div className="p-5">
                <p className="text-[14px] font-semibold leading-snug text-[#111]">{post.title}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (post.url) window.open(post.url, '_blank');
                    else onOpenLightbox([{ src: post.imageUrl || '', title: post.title }], i);
                  }}
                  className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-[#00AAFF]"
                >
                  Baca Artikel <ArrowRight size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Komponen utama                                                            */
/* -------------------------------------------------------------------------- */
export const LandingPage: React.FC<LandingPageProps> = ({
  config: rawConfig,
  logoUrl,
  currentUser,
  onOpenLogin,
  onEnterApp,
  embedded = false,
}) => {
  const config = rawConfig;
  const logo = config.brand?.logoUrl || logoUrl || undefined;

  const [route, setRoute] = useState<LandingRoute>({ page: 'home' });
  const [query, setQuery] = useState('');
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [showTop, setShowTop] = useState(false);

  /* Font Quicksand khusus halaman publik */
  useEffect(() => {
    const id = 'bejo-landing-font-quicksand';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);

  /* Favicon + judul tab browser + deskripsi website (meta description).
     Hanya berlaku untuk halaman publik sungguhan — pratinjau CMS (embedded)
     memakai portal sehingga document.head-nya sama dengan dokumen utama. */
  useEffect(() => {
    if (embedded) return;
    const head = document.head;
    const favicon = config.brand?.faviconUrl;
    const description = (config.brand?.metaDescription || '').trim();
    const siteTitle = (config.brand?.siteTitle || '').trim();

    /* --- favicon --- */
    let icon = head.querySelector('link[rel~="icon"]') as HTMLLinkElement | null;
    const hadIcon = !!icon;
    if (!icon) {
      icon = document.createElement('link');
      icon.id = 'bejo-landing-favicon';
      icon.rel = 'icon';
      head.appendChild(icon);
    }
    if (favicon) {
      /* Server sudah menyuntikkan <link rel="icon">; jangan paksa tipe PNG
         agar favicon JPG/SVG lama tetap tampil. */
      if (/^data:image\/png/i.test(favicon)) icon.type = 'image/png';
      else icon.removeAttribute('type');
      icon.href = favicon;
    } else if (!hadIcon) {
      icon.remove();
    }

    /* --- meta description --- */
    const meta = head.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const og = head.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    const ogTitle = head.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    const previousMeta = meta?.content;
    const previousOg = og?.content;
    const previousOgTitle = ogTitle?.content;

    if (description) {
      if (meta) meta.content = description;
      if (og) og.content = description;
    }
    if (siteTitle && ogTitle) ogTitle.content = siteTitle;

    return () => {
      /* kembalikan seperti semula saat meninggalkan halaman publik */
      if (!hadIcon && icon) icon.remove();
      if (meta && previousMeta !== undefined) meta.content = previousMeta;
      if (og && previousOg !== undefined) og.content = previousOg;
      if (ogTitle && previousOgTitle !== undefined) ogTitle.content = previousOgTitle;
    };
  }, [embedded, config.brand?.faviconUrl, config.brand?.siteTitle, config.brand?.metaDescription]);

  /* Kembali ke atas saat pindah halaman */
  useEffect(() => {
    if (embedded) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [route.page, route.categoryKey, embedded]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navigate = useCallback((page: LandingPageKey, categoryKey?: string) => {
    setRoute({ page, categoryKey });
  }, []);

  const openLightbox = useCallback((items: LightboxItem[], index: number) => {
    setLightbox({ items, index });
  }, []);

  const wa = config.contact.whatsappNumber.replace(/[^0-9]/g, '');

  return (
    <div className="bejo-landing min-h-screen bg-white text-[#111]" style={{ fontFamily: FONT_STACK }}>
      <Header
        config={config}
        logo={logo}
        currentUser={currentUser}
        onNavigate={navigate}
        onSearch={(q) => {
          setQuery(q);
          navigate('products');
        }}
        onOpenLogin={onOpenLogin}
        onEnterApp={onEnterApp}
      />

      <main>
        {route.page === 'home' && <HomePage config={config} onNavigate={navigate} onOpenLightbox={openLightbox} />}
        {route.page === 'about' && <AboutPage config={config} onNavigate={navigate} onOpenLightbox={openLightbox} />}
        {route.page === 'products' && (
          <ProductsPage
            config={config}
            initialCategory={route.categoryKey}
            query={query}
            onNavigate={navigate}
            onOpenLightbox={openLightbox}
          />
        )}
        {route.page === 'clients' && <ClientsPage config={config} onNavigate={navigate} />}
        {route.page === 'contact' && <ContactPage config={config} onNavigate={navigate} />}
        {route.page === 'blog' && <BlogPage config={config} onNavigate={navigate} onOpenLightbox={openLightbox} />}
      </main>

      <Footer
        config={config}
        logo={logo}
        onNavigate={navigate}
        onOpenSocial={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
      />

      {/* Aksi mengambang */}
      {!embedded && (
        <div className="fixed bottom-6 right-5 z-50 flex flex-col items-center gap-3">
          {showTop && (
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Kembali ke atas"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00AAFF] text-[#111] shadow-lg transition-transform hover:-translate-y-0.5"
            >
              <ArrowUp size={18} />
            </button>
          )}
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat WhatsApp"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:-translate-y-0.5"
          >
            <MessageCircle size={22} />
          </a>
        </div>
      )}

      {lightbox && (
        <Lightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(i) => setLightbox((prev) => (prev ? { ...prev, index: i } : prev))}
        />
      )}
    </div>
  );
};

export default LandingPage;
