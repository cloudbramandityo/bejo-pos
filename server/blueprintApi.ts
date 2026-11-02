/**
 * Dokumen blueprint aplikasi — hanya untuk DEVELOPER.
 *
 * Isinya satu berkas Markdown di root aplikasi (`MASTER PROMPT & BLUEPRINT
 * ARSITEKTUR APLIKASI.md`) yang menjelaskan seluruh cara pembuatan aplikasi.
 * Berkas ikut tersalin ke folder aplikasi saat deploy, jadi DEVELOPER bisa
 * mengunduh versi yang sama dengan kode yang sedang berjalan, kapan saja.
 *
 * Kenapa lewat server dan bukan dibaca browser langsung: berkasnya ada di disk
 * server, dan hak aksesnya harus ditegakkan di sana — bukan disembunyikan di
 * tombol saja. Rutenya hanya mengembalikan satu dokumen teks milik proyek dan
 * tidak pernah menerima path dari pemanggil.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { getPosSession } from './posAuth';

/** Nama berkas dokumen seperti yang dipakai saat diunduh. */
export const BLUEPRINT_FILE_NAME = 'MASTER PROMPT & BLUEPRINT ARSITEKTUR APLIKASI.md';

export interface BlueprintDocument {
  fileName: string;
  markdown: string;
  bytes: number;
  updatedAt: string;
}

function blueprintFilePath(): string {
  return path.join(process.cwd(), BLUEPRINT_FILE_NAME);
}

/** Baca dokumen dari folder aplikasi. null bila berkas memang tidak ada. */
export function readBlueprintDocument(): BlueprintDocument | null {
  const file = blueprintFilePath();
  try {
    const markdown = fs.readFileSync(file, 'utf8');
    if (!markdown.trim()) return null;
    return {
      fileName: BLUEPRINT_FILE_NAME,
      markdown,
      bytes: Buffer.byteLength(markdown, 'utf8'),
      updatedAt: fs.statSync(file).mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export function registerBlueprintRoutes(app: Express): void {
  app.get('/api/blueprint', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');

    const session = getPosSession(req);
    if (!session) {
      res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        error: 'Silakan login ke dashboard terlebih dahulu.',
      });
      return;
    }

    if (String(session.role || '').trim().toUpperCase() !== 'DEVELOPER') {
      res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Dokumen ini hanya dapat diunduh oleh Developer.',
      });
      return;
    }

    const document = readBlueprintDocument();
    if (!document) {
      res.status(404).json({
        success: false,
        code: 'BLUEPRINT_MISSING',
        error: 'Berkas blueprint tidak ditemukan di folder aplikasi.',
      });
      return;
    }

    res.json({ success: true, ...document });
  });
}
