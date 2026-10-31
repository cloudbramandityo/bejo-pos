/**
 * Endpoint publik Landing Page.
 *
 * - GET /api/landing/published : snapshot konfigurasi yang sudah dipublish.
 *   Hanya konten ini yang boleh tampil ke pengunjung internet. Draft tidak
 *   pernah dikirim lewat endpoint ini.
 * - GET /api/landing/media/:id : gambar yang diunggah dari dashboard. Setiap
 *   gambar disimpan sebagai record `settings` (legacyId landing_media_*),
 *   bukan base64 di dalam config.
 */
import type { Express, Request, Response } from 'express';
import PocketBase from 'pocketbase/cjs';

const COLLECTION = 'settings';
const PUBLISHED_ID = 'landing_config';
const MEDIA_PATTERN = /^landing_media_[a-z0-9]+$/;
const MAX_MEDIA_BYTES = 6 * 1024 * 1024;

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

function pocketBaseUrl(): string {
  return (
    env('POCKETBASE_UPSTREAM') ||
    env('POCKETBASE_URL') ||
    'http://127.0.0.1:8090'
  ).replace(/\/+$/, '');
}

let client: PocketBase | null = null;
let authPromise: Promise<PocketBase> | null = null;
let activeAuthLabel = '';

type Credential = { label: string; email: string; password: string; admin: boolean };

/**
 * Kumpulkan kandidat kredensial tanpa duplikasi. `.env` VPS kadang memuat
 * PB_SYNC_* lama dan VITE_PB_SYNC_* yang benar (atau sebaliknya), jadi server
 * mencoba semuanya, bukan hanya salah satu.
 */
function credentialCandidates(): Credential[] {
  const list: Credential[] = [];
  const seen = new Set<string>();
  const push = (label: string, email: string, password: string, admin = false) => {
    if (!email || !password) return;
    const key = `${email}\u0000${password}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ label, email, password, admin });
  };

  push('PB_ADMIN', env('PB_ADMIN_EMAIL'), env('PB_ADMIN_PASSWORD'), true);
  push('PB_SYNC', env('PB_SYNC_EMAIL'), env('PB_SYNC_PASSWORD'));
  push('VITE_PB_SYNC', env('VITE_PB_SYNC_EMAIL'), env('VITE_PB_SYNC_PASSWORD'));
  return list;
}

async function authenticate(pb: PocketBase): Promise<PocketBase> {
  const candidates = credentialCandidates();
  if (candidates.length === 0) {
    throw new Error('Kredensial PocketBase server belum disetel.');
  }

  const failures: string[] = [];
  for (const candidate of candidates) {
    try {
      if (candidate.admin) {
        try {
          await pb.collection('_superusers').authWithPassword(candidate.email, candidate.password);
        } catch (primaryError) {
          const legacy = (pb as unknown as {
            admins?: { authWithPassword: (email: string, password: string) => Promise<unknown> };
          }).admins;
          if (!legacy?.authWithPassword) throw primaryError;
          await legacy.authWithPassword(candidate.email, candidate.password);
        }
      } else {
        await pb.collection('users').authWithPassword(candidate.email, candidate.password);
      }
    } catch (err: any) {
      failures.push(`${candidate.label} (auth ${err?.status || 'jaringan'})`);
      pb.authStore.clear();
      continue;
    }

    // Kredensial bisa valid tetapi tetap tidak boleh membaca `settings`
    // (mis. akun sinkronisasi lama). Pastikan akses baca sebelum dipakai.
    try {
      await pb.collection(COLLECTION).getList(1, 1);
    } catch (readError: any) {
      failures.push(`${candidate.label} (auth OK, baca ${readError?.status || 'jaringan'})`);
      pb.authStore.clear();
      continue;
    }

    activeAuthLabel = candidate.label;
    console.log(`[Landing] PocketBase siap via ${candidate.label}.`);
    return pb;
  }

  throw new Error(`Autentikasi PocketBase gagal: ${failures.join(', ')}.`);
}

async function getClient(): Promise<PocketBase> {
  if (client?.authStore.isValid) return client;
  if (!authPromise) {
    authPromise = (async () => {
      const pb = new PocketBase(pocketBaseUrl());
      pb.autoCancellation(false);
      await authenticate(pb);
      client = pb;
      return pb;
    })().finally(() => {
      authPromise = null;
    });
  }
  return authPromise;
}

async function findRecordByLegacyId(id: string): Promise<any | null> {
  const pb = await getClient();
  const service = pb.collection(COLLECTION);
  let filterError: any = null;

  try {
    const list = await service.getList(1, 1, {
      filter: `legacyId = "${id}"`,
      sort: '-updated',
    });
    if (list.items[0]) return list.items[0];
  } catch (err: any) {
    filterError = err;
    if (err?.status !== 400 && err?.status !== 404) throw err;
  }

  // Fallback untuk koleksi lama: baca seluruh halaman tanpa filter/sort, lalu
  // cocokkan `legacyId` di memori (mis. bila field belum bisa difilter).
  // Media landing juga bisa berada di luar 500 record pertama.
  let items: any[];
  try {
    items = await readAllSettings(service);
  } catch (err) {
    throw filterError || err;
  }

  const matches = items
    .filter((item) => item?.legacyId === id)
    .sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));

  const match = matches[0];
  if (!match) {
    console.warn(`[Landing] Record ${id} tidak ditemukan di ${items.length} record settings.`);
    return null;
  }

  // Pindai hanya id/legacyId/updated; ambil record lengkap sekali saja karena
  // record media bisa memuat base64 berukuran besar.
  return service.getOne(match.id);
}

/** Baca semua record `settings` per halaman agar media lama tetap ditemukan. */
async function readAllSettings(service: any): Promise<any[]> {
  const perPage = 200;
  const maxPages = 100;
  const items: any[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const list = await service.getList(page, perPage, { fields: 'id,legacyId,updated' });
    const batch = Array.isArray(list.items) ? list.items : [];
    items.push(...batch);
    if (batch.length < perPage) break;
    if (typeof list.totalPages === 'number' && page >= list.totalPages) break;
  }

  return items;
}

/** Log penyebab kegagalan tanpa membocorkan isi record. */
async function logLandingFailure(context: string, err: unknown): Promise<void> {
  console.error(`[Landing] ${context} (auth: ${activeAuthLabel || 'belum'})`, err);
  if (!client?.authStore.isValid) return;
  try {
    const collection = await client.collections.getOne(COLLECTION);
    const fields = (collection.fields || []).map((field: any) => `${field.name}:${field.type}`).join(', ');
    console.error(`[Landing] Skema ${COLLECTION}: ${fields || '(kosong)'}`);
  } catch {
    /* diagnosa tambahan tidak wajib */
  }
}

function recordPayload(record: any): Record<string, any> | null {
  if (!record) return null;
  const mirror = record.data;
  if (mirror && typeof mirror === 'object' && !Array.isArray(mirror)) {
    return mirror as Record<string, any>;
  }
  const { id, legacyId, data, collectionId, collectionName, expand, ...flat } = record;
  return flat;
}

/**
 * Isi salah satu record `settings` menurut id aplikasi. Dipakai juga oleh endpoint
 * branding toko supaya koneksi dan kredensial PocketBase hanya ada satu tempat.
 */
export async function readSettingsPayload(legacyId: string): Promise<Record<string, any> | null> {
  return recordPayload(await findRecordByLegacyId(legacyId));
}

export interface PublishedLandingIdentity {
  siteTitle: string;
  metaDescription: string;
  logoUrl: string;
  faviconUrl: string;
}

let identityCache: { at: number; value: PublishedLandingIdentity } | null = null;
let lastIdentityErrorAt = 0;
const IDENTITY_TTL_MS = 15_000;
const IDENTITY_ERROR_LOG_INTERVAL_MS = 60_000;

/**
 * Identitas brand dari konfigurasi yang sudah dipublish, dipakai untuk
 * menyuntikkan title/favicon/OG ke HTML awal agar terlihat oleh pengunjung
 * dan crawler yang tidak menjalankan JavaScript.
 */
export async function getPublishedLandingIdentity(): Promise<PublishedLandingIdentity | null> {
  const now = Date.now();
  if (identityCache && now - identityCache.at < IDENTITY_TTL_MS) return identityCache.value;

  try {
    const record = await findRecordByLegacyId(PUBLISHED_ID);
    const config = recordPayload(record);
    if (!config || config.isPublished === false) {
      identityCache = null;
      return null;
    }

    const brand = (config.brand && typeof config.brand === 'object' ? config.brand : {}) as Record<string, any>;
    const value: PublishedLandingIdentity = {
      siteTitle: typeof brand.siteTitle === 'string' ? brand.siteTitle.trim() : '',
      metaDescription: typeof brand.metaDescription === 'string' ? brand.metaDescription.trim() : '',
      logoUrl: typeof brand.logoUrl === 'string' ? brand.logoUrl : '',
      faviconUrl: typeof brand.faviconUrl === 'string' ? brand.faviconUrl : '',
    };
    identityCache = { at: now, value };
    return value;
  } catch (err) {
    if (now - lastIdentityErrorAt > IDENTITY_ERROR_LOG_INTERVAL_MS) {
      lastIdentityErrorAt = now;
      console.error(
        '[Landing] Identitas publik gagal dibaca:',
        err instanceof Error ? err.message : String(err)
      );
    }
    return identityCache?.value ?? null;
  }
}

export function registerLandingRoutes(app: Express): void {
  app.get('/api/landing/published', async (_req: Request, res: Response) => {
    try {
      const record = await findRecordByLegacyId(PUBLISHED_ID);
      const config = recordPayload(record);
      res.setHeader('Cache-Control', 'no-store');
      if (!config || config.isPublished === false) {
        res.json({ published: false, config: null });
        return;
      }
      res.json({ published: true, config });
    } catch (err) {
      await logLandingFailure('Gagal membaca konten published', err);
      res.status(503).json({ error: 'Konten landing page belum dapat dimuat.' });
    }
  });

  app.get('/api/landing/media/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    if (!MEDIA_PATTERN.test(id)) {
      res.status(400).send('ID media tidak valid.');
      return;
    }

    try {
      const record = await findRecordByLegacyId(id);
      const payload = recordPayload(record);
      const dataUrl = typeof payload?.dataUrl === 'string' ? payload.dataUrl : '';
      const comma = dataUrl.indexOf(',');
      if (!dataUrl.startsWith('data:') || comma < 0) {
        res.status(404).send('Media tidak ditemukan.');
        return;
      }

      const meta = dataUrl.slice(5, comma);
      if (!/;base64/i.test(meta)) {
        res.status(415).send('Format media tidak didukung.');
        return;
      }
      const mime = (typeof payload?.mime === 'string' && payload.mime) || meta.split(';')[0] || 'image/jpeg';
      if (!/^image\//i.test(mime)) {
        res.status(415).send('Format media tidak didukung.');
        return;
      }

      const buffer = Buffer.from(dataUrl.slice(comma + 1), 'base64');
      if (buffer.length === 0) {
        res.status(404).send('Media kosong.');
        return;
      }
      if (buffer.length > MAX_MEDIA_BYTES) {
        res.status(413).send('Media terlalu besar.');
        return;
      }

      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(buffer);
    } catch (err) {
      await logLandingFailure('Gagal memuat media', err);
      res.status(503).send('Media belum dapat dimuat.');
    }
  });
}
