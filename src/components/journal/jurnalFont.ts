import { locale } from '@fortune-sheet/core';
import type { Context } from '@fortune-sheet/core';

export const JURNAL_DEFAULT_FONT = 'Google Sans';

const LEGACY_FONT_BY_INDEX: Record<number, string> = {
  0: JURNAL_DEFAULT_FONT,
  1: 'Arial',
  2: 'Tahoma',
  3: 'Verdana',
};

// FortuneSheet mengambil daftar font dari objek locale, bukan dari props.
// Google Sans diletakkan di indeks 0 agar sekaligus menjadi font default
// untuk sel baru; pengguna tetap bisa memilih font lain lewat toolbar.
export function installJurnalFont(): void {
  const dictionary = locale({ lang: 'en' } as unknown as Context);
  if (dictionary.fontarray[0] !== JURNAL_DEFAULT_FONT) {
    const existing = dictionary.fontarray.indexOf(JURNAL_DEFAULT_FONT);
    if (existing > 0) dictionary.fontarray.splice(existing, 1);
    dictionary.fontarray.unshift(JURNAL_DEFAULT_FONT);
  }
  const fontjson = dictionary.fontjson as unknown as Record<string, number>;
  fontjson['google sans'] = 0;
  fontjson['times new roman'] = 1;
  fontjson.arial = 2;
  fontjson.tahoma = 3;
  fontjson.verdana = 4;
}

installJurnalFont();

// ff numerik pada grid lama mengacu ke urutan font FortuneSheet versi lama.
// Konversi ke nama font agar pergeseran indeks tidak mengubah tampilan.
export function normalizeJurnalFont(ff: unknown): string | number | undefined {
  if (typeof ff === 'string') return ff;
  if (typeof ff !== 'number') return undefined;
  return LEGACY_FONT_BY_INDEX[ff] ?? ff;
}

export async function ensureJurnalFontLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 16px "Google Sans"'),
        document.fonts.load('500 16px "Google Sans"'),
        document.fonts.load('700 16px "Google Sans"'),
      ]),
      new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
    ]);
  } catch {
    /* font tetap memakai fallback sistem bila gagal dimuat */
  }
}
