/**
 * Endpoint publik identitas toko (logo + nama) untuk layar login.
 *
 * Kenapa perlu: logo yang disetel di Pengaturan toko disimpan sebagai lampiran
 * gambar di record `settings/store_info`, dan koleksi `settings` hanya boleh
 * dibaca setelah login. Halaman login justru tampil sebelum ada sesi, jadi tanpa
 * endpoint ini perangkat lain selalu menampilkan emblem bawaan.
 *
 * Keamanan: hanya dua nilai teks yang boleh keluar (nama toko dan logo). Field
 * lain pada record toko — alamat, telepon, catatan struk — tidak pernah dikirim.
 * Kredensial PocketBase tetap di server; browser tidak pernah menerima token.
 */
import type { Express, Request, Response } from 'express';
import { readSettingsPayload } from './landingApi';

const STORE_INFO_ID = 'store_info';
const CACHE_TTL_MS = 30_000;
/** Batas panjang data URL logo; di atas ini dianggap bukan logo dan tidak dikirim. */
const MAX_LOGO_CHARS = 500_000;

export interface PublicBranding {
  storeName: string;
  logoUrl: string;
}

let cache: { at: number; value: PublicBranding } | null = null;
let inflight: Promise<PublicBranding | null> | null = null;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readBranding(config: Record<string, any> | null): PublicBranding | null {
  if (!config) return null;
  const logo = typeof config.logoUrl === 'string' ? config.logoUrl : '';
  return {
    storeName: text(config.storeName),
    // Gambar yang terlalu besar hampir pasti bukan logo; jangan dikirim ke pengunjung.
    logoUrl: logo.length > MAX_LOGO_CHARS ? '' : logo,
  };
}

/** Ambil branding dari server dengan nilai terbaru dalam ±30 detik. */
export async function getPublicBranding(): Promise<PublicBranding | null> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const value = readBranding(await readSettingsPayload(STORE_INFO_ID));
      if (value) cache = { at: Date.now(), value };
      return value;
    } catch (err) {
      console.error('[Branding] Identitas toko gagal dibaca:', err instanceof Error ? err.message : String(err));
      return cache?.value ?? null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function registerBrandingRoutes(app: Express): void {
  app.get('/api/branding', async (_req: Request, res: Response) => {
    const branding = await getPublicBranding();
    res.setHeader('Cache-Control', 'public, max-age=30');
    if (!branding) {
      res.json({ success: false, storeName: '', logoUrl: '' });
      return;
    }
    res.json({ success: true, ...branding });
  });
}
