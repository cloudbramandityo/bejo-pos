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

async function authenticate(pb: PocketBase): Promise<PocketBase> {
  const adminEmail = env('PB_ADMIN_EMAIL');
  const adminPassword = env('PB_ADMIN_PASSWORD');

  if (adminEmail && adminPassword) {
    try {
      await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
      return pb;
    } catch {
      const legacy = (pb as unknown as {
        admins?: { authWithPassword: (email: string, password: string) => Promise<unknown> };
      }).admins;
      if (legacy?.authWithPassword) {
        try {
          await legacy.authWithPassword(adminEmail, adminPassword);
          return pb;
        } catch {
          /* lanjut ke akun sinkronisasi */
        }
      }
    }
  }

  const syncEmail = env('PB_SYNC_EMAIL') || env('VITE_PB_SYNC_EMAIL');
  const syncPassword = env('PB_SYNC_PASSWORD') || env('VITE_PB_SYNC_PASSWORD');
  if (syncEmail && syncPassword) {
    await pb.collection('users').authWithPassword(syncEmail, syncPassword);
    return pb;
  }

  throw new Error('Kredensial PocketBase server belum disetel.');
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
  const list = await pb.collection(COLLECTION).getList(1, 1, {
    filter: `legacyId = "${id}"`,
    sort: '-updated',
  });
  return list.items[0] || null;
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
      console.error('[Landing] Gagal membaca konten published:', err);
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
      console.error('[Landing] Gagal memuat media:', err);
      res.status(503).send('Media belum dapat dimuat.');
    }
  });
}
