/**
 * Tujuan tombol CTA di landing page.
 *
 * Semua tujuan divalidasi di satu tempat supaya tautan yang disimpan dari CMS
 * tidak bisa menyelipkan skema berbahaya (`javascript:`, `data:`) dan halaman
 * internal hanya berisi kunci yang dikenal.
 */
import type {
  LandingButtonLink,
  LandingButtonLinkType,
  LandingContactConfig,
  LandingPageKey,
} from '../types';

export const LANDING_PAGE_OPTIONS: Array<{ value: LandingPageKey; label: string }> = [
  { value: 'home', label: 'Beranda' },
  { value: 'products', label: 'Produk' },
  { value: 'about', label: 'Tentang Kami' },
  { value: 'clients', label: 'Klien' },
  { value: 'contact', label: 'Kontak' },
  { value: 'blog', label: 'Blog' },
];

export function isLandingPageKey(value: string): value is LandingPageKey {
  return LANDING_PAGE_OPTIONS.some((option) => option.value === value);
}

/** Skema yang boleh dibuka dari tautan eksternal. */
const SAFE_EXTERNAL_SCHEME = /^(https?:\/\/|mailto:|tel:)/i;
/** Skema lain (javascript:, data:, file:, …) ditolak. */
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeLandingButtonLink(raw: unknown): LandingButtonLink | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as { type?: unknown; value?: unknown };
  const type = source.type;
  if (type !== 'whatsapp' && type !== 'url' && type !== 'page') return undefined;
  const value = typeof source.value === 'string' ? source.value.trim() : '';
  if (type === 'page') {
    return { type, value: isLandingPageKey(value) ? value : 'home' };
  }
  return { type, value };
}

/** Alamat luar yang aman; nilai tanpa skema diberi `https://`. */
export function safeExternalUrl(raw?: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (SAFE_EXTERNAL_SCHEME.test(value)) return value;
  if (ANY_SCHEME.test(value)) return '';
  return `https://${value.replace(/^\/+/, '')}`;
}

/**
 * Tautan wa.me wajib memakai format internasional tanpa "+". Nomor lokal yang
 * tersimpan (0812…, 812…, +62 812…) dinormalkan menjadi 62812… agar klik
 * tombol WhatsApp benar-benar membuka chat nomor yang disimpan.
 */
export function normalizeWhatsappNumber(raw?: string): string {
  let digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits;
}

export function whatsappChatUrl(number: string, message?: string): string {
  const digits = normalizeWhatsappNumber(number);
  if (!digits) return '';
  const text = String(message || '').trim();
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function landingLinkHref(
  link: LandingButtonLink | undefined,
  contact: LandingContactConfig
): string {
  if (!link) return '';
  if (link.type === 'whatsapp') return whatsappChatUrl(contact.whatsappNumber, link.value);
  if (link.type === 'url') return safeExternalUrl(link.value);
  return '';
}

export function landingInternalPage(link?: LandingButtonLink): LandingPageKey | null {
  if (!link || link.type !== 'page') return null;
  return isLandingPageKey(link.value || '') ? (link.value as LandingPageKey) : 'home';
}

/**
 * Jalankan tujuan tombol. Halaman internal pindah tanpa reload, tautan luar
 * dibuka di tab baru. Bila tujuan kosong/tidak aman, jalankan `fallback` agar
 * tombol lama (mis. WhatsApp) tetap berfungsi.
 */
export function openLandingButtonLink(
  link: LandingButtonLink | undefined,
  options: {
    contact: LandingContactConfig;
    navigate: (page: LandingPageKey) => void;
    fallback?: () => void;
  }
): void {
  const page = landingInternalPage(link);
  if (page) {
    options.navigate(page);
    return;
  }
  const href = landingLinkHref(link, options.contact);
  if (href) {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  options.fallback?.();
}

/**
 * Warna teks yang terbaca di atas warna latar tombol.
 * Ambang 0.30 (luminance WCAG) dipilih agar biru #00AAFF tetap berteks hitam
 * seperti desain lama, sementara merah-oranye #FF4400 berteks putih.
 */
export function readableTextColor(background: string): string {
  const hex = String(background || '').replace('#', '').trim();
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return '#111111';
  const channel = (offset: number) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.3 ? '#111111' : '#FFFFFF';
}

/** Hanya #rgb / #rrggbb yang diterima dari input warna. */
export function normalizeHexColor(raw: unknown): string | undefined {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : undefined;
}

export function buttonLinkTypeLabel(type: LandingButtonLinkType): string {
  if (type === 'whatsapp') return 'WhatsApp';
  if (type === 'url') return 'URL / Tautan';
  return 'Halaman Situs';
}
