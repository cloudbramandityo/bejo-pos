/**
 * Broker sesi PocketBase.
 *
 * Sebelumnya email + password akun sinkronisasi ditanam di bundle browser
 * (VITE_PB_SYNC_*), sehingga siapa pun bisa mengekstraknya. Sekarang browser
 * meminta token lewat endpoint ini dan server yang menyimpan kredensial.
 *
 * Keamanan:
 * - Kredensial hanya dibaca dari environment server (PB_SYNC_EMAIL/PB_SYNC_PASSWORD).
 * - Server tidak pernah membuat akun otomatis.
 * - Token di-cache singkat (±10 menit) agar tidak login ke PocketBase tiap request.
 * - Endpoint: POST /api/pocketbase/session (bukan /api/pb/* yang diproxy Caddy
 *   langsung ke PocketBase).
 */
import type { Express, Request, Response } from 'express';
import PocketBase from 'pocketbase/cjs';
import { requirePosSession } from './posAuth';
import { ensureSyncAccount } from './staffStore';

const TOKEN_TTL_MS = 10 * 60_000;

type PbSession = {
  token: string;
  record: Record<string, unknown>;
  expiresAt: number;
};

class PbSessionError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

let cached: PbSession | null = null;
let inflight: Promise<PbSession> | null = null;

async function loginSync(email: string, password: string): Promise<PbSession> {
  const url = env('POCKETBASE_UPSTREAM') || 'http://127.0.0.1:8090';
  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  const auth = await pb.collection('users').authWithPassword(email, password);
  return {
    token: auth.token,
    record: auth.record as unknown as Record<string, unknown>,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
}

async function createSession(): Promise<PbSession> {
  const email = env('PB_SYNC_EMAIL');
  const password = env('PB_SYNC_PASSWORD');
  if (!email || !password) {
    throw new PbSessionError(
      'Akun sinkronisasi PocketBase belum disetel di server (PB_SYNC_EMAIL / PB_SYNC_PASSWORD).',
      503
    );
  }

  if (cached && cached.expiresAt > Date.now()) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    let failure: unknown = null;
    try {
      cached = await loginSync(email, password);
      return cached;
    } catch (error) {
      failure = error;
    }

    // Login ditolak hampir selalu berarti record sinkronisasi tertimpa restore
    // backup lama. Samakan lagi dengan .env lalu coba sekali lagi.
    const status = await ensureSyncAccount().catch(() => 'failed' as const);
    if (status === 'repaired' || status === 'created' || status === 'ok') {
      try {
        cached = await loginSync(email, password);
        console.warn('[PocketBase] Sesi layanan pulih setelah akun sinkronisasi disamakan dengan .env.');
        return cached;
      } catch (retryError) {
        failure = retryError;
      }
    }

    console.error('[PocketBase] Gagal membuat sesi layanan:', failure);
    throw new PbSessionError(
      'Server tidak dapat terhubung ke PocketBase atau kredensial sinkronisasi ditolak.',
      503
    );
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

function assertSameOrigin(req: Request): void {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim();
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new PbSessionError('Origin permintaan tidak valid.', 403);
  }
  if (host && originHost !== host) {
    throw new PbSessionError('Origin permintaan tidak diizinkan.', 403);
  }
}

async function handleSessionRequest(req: Request, res: Response): Promise<void> {
  try {
    assertSameOrigin(req);
    const session = await createSession();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, token: session.token, record: session.record });
  } catch (error) {
    if (error instanceof PbSessionError) {
      res.status(error.status).json({ success: false, error: error.message });
      return;
    }
    console.error('[PocketBase] Kesalahan sesi tak terduga:', error);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server.' });
  }
}

export function registerPbSessionRoutes(app: Express): void {
  // SENGAJA bukan di bawah /api/pb/* karena prefix tersebut diproxy Caddy
  // langsung ke PocketBase dan tidak melewati Express.
  // Token akun sinkronisasi hanya boleh diterima pengguna dashboard yang sudah
  // login; pengunjung publik tidak boleh mendapat akses koleksi aplikasi.
  app.post('/api/pocketbase/session', requirePosSession, handleSessionRequest);
}
