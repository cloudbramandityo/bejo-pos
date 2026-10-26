/**
 * Penyimpanan media Landing Page CMS ke PocketBase.
 *
 * Gambar yang diunggah dashboard TIDAK disimpan sebagai base64 di config utama
 * (field JSON PocketBase dibatasi 5 MB dan sanitizer database membuang data URL
 * besar). Setiap gambar disimpan sebagai record `settings` tersendiri dan config
 * hanya menyimpan URL `/api/landing/media/<id>` yang dapat diakses publik.
 */
import { getPB } from '../lib/pocketbase';
import { authReady } from '../backend/pocketbaseBackend';
import type { LandingPageConfig } from '../types';

const MEDIA_PREFIX = 'landing_media_';
const MAX_MEDIA_CHARS = 4_800_000;

export function isInlineImage(value?: string): boolean {
  return Boolean(value && /^data:image\//i.test(value));
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma < 0) {
    throw new Error('Format gambar tidak valid.');
  }
  const meta = dataUrl.slice(5, comma);
  if (!/;base64/i.test(meta)) {
    throw new Error('Gambar harus berupa data base64.');
  }
  const mime = meta.split(';')[0] || 'image/jpeg';
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(mime)) {
    throw new Error('Tipe gambar tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau SVG.');
  }
  return { mime, base64: dataUrl.slice(comma + 1) };
}

/**
 * Simpan satu gambar ke PocketBase. Mengembalikan URL publik yang stabil.
 */
export async function saveLandingMedia(dataUrl: string): Promise<string> {
  if (!isInlineImage(dataUrl)) {
    throw new Error('File gambar tidak valid.');
  }
  if (dataUrl.length > MAX_MEDIA_CHARS) {
    throw new Error('Gambar terlalu besar (maks ±3,5 MB setelah kompresi). Gunakan gambar yang lebih kecil.');
  }

  const { mime } = parseDataUrl(dataUrl);
  await authReady;
  const pb = getPB();
  if (!pb.authStore.isValid) {
    throw new Error('Koneksi database belum siap. Gambar belum tersimpan — coba lagi.');
  }

  const id = `${MEDIA_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  try {
    await pb.collection('settings').create({
      legacyId: id,
      data: {
        dataUrl,
        mime,
        size: dataUrl.length,
        createdAt: Date.now()
      }
    });
  } catch (err: any) {
    console.error('[LandingMedia] Gagal menyimpan gambar ke database:', err);
    throw new Error(
      err?.status === 413
        ? 'Gambar terlalu besar untuk database. Kompres ulang gambar.'
        : 'Gambar gagal disimpan ke database. Periksa koneksi lalu coba lagi.'
    );
  }

  return `/api/landing/media/${id}`;
}

/**
 * Pastikan semua gambar inline (base64) pada config dipindahkan ke database.
 * URL media yang sudah tersimpan dibiarkan apa adanya.
 */
export async function ensureLandingMediaInDatabase(config: LandingPageConfig): Promise<LandingPageConfig> {
  const next = JSON.parse(JSON.stringify(config)) as LandingPageConfig;
  const cache = new Map<string, string>();

  const persist = async (value?: string): Promise<string | undefined> => {
    if (!value || !isInlineImage(value)) return value;
    const cached = cache.get(value);
    if (cached) return cached;
    const url = await saveLandingMedia(value);
    cache.set(value, url);
    return url;
  };

  next.brand.logoUrl = await persist(next.brand.logoUrl);
  next.brand.faviconUrl = await persist(next.brand.faviconUrl);

  for (const slide of next.slides || []) {
    slide.imageUrl = await persist(slide.imageUrl);
  }

  for (const group of next.categories || []) {
    for (const card of group.cards || []) {
      card.imageUrl = await persist(card.imageUrl);
    }
  }

  for (const promo of next.templatePromos || []) {
    promo.imageUrl = await persist(promo.imageUrl);
  }

  next.problem.imageUrl = await persist(next.problem.imageUrl);

  for (const stat of next.stats || []) {
    stat.iconUrl = await persist(stat.iconUrl);
  }

  for (const facility of next.facilities || []) {
    facility.imageUrl = await persist(facility.imageUrl);
  }

  for (const post of next.blogPosts || []) {
    post.imageUrl = await persist(post.imageUrl);
  }

  next.about.imageUrl = await persist(next.about.imageUrl);

  for (const item of next.gallery || []) {
    item.imageUrl = await persist(item.imageUrl);
  }

  for (const testimonial of next.testimonials || []) {
    testimonial.logoUrl = await persist(testimonial.logoUrl);
  }

  for (const client of next.clients || []) {
    client.logoUrl = await persist(client.logoUrl);
  }

  return next;
}
