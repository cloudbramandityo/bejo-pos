/**
 * Pembersih data sebelum dikirim ke server.
 *
 * Berada di modul tersendiri supaya aturan ukurannya bisa diuji tanpa menyentuh
 * koneksi server, dan dipakai oleh satu tempat tulis saja.
 */

/** Lampiran gambar/berkas biasa tidak boleh ikut tersimpan sebagai teks panjang. */
export const BINARY_MAX_CHARS = 50_000;

/**
 * Logo toko adalah pengecualian: nilainya harus sampai ke semua perangkat karena
 * layar lain menampilkannya. Batasnya longgar tetapi tetap terukur.
 */
export const LOGO_MAX_CHARS = 400_000;

const LOGO_FIELDS = new Set(['logoUrl']);

/** Isi yang selalu dibuang: lampiran berkas, bukan data yang dipakai bersama. */
const DROPPED_KEYS = new Set(['fileDataUrl', 'previewThumbnail', 'blob']);

function isBinaryRef(value: string): boolean {
  return value.startsWith('data:') || value.startsWith('blob:');
}

function binaryFits(value: string, key?: string): boolean {
  const cap = key && LOGO_FIELDS.has(key) ? LOGO_MAX_CHARS : BINARY_MAX_CHARS;
  return value.length <= cap;
}

export function sanitizeForDb<T>(obj: T, key?: string): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'number') return (isNaN(obj) ? 0 : obj) as unknown as T;
  if (typeof obj === 'string') {
    if (isBinaryRef(obj) && !binaryFits(obj, key)) {
      return '' as unknown as T;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined && typeof item !== 'function')
      .map((item) => sanitizeForDb(item, key)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleanObj: Record<string, any> = {};
    for (const [keyName, value] of Object.entries(obj as any)) {
      if (DROPPED_KEYS.has(keyName)) continue;
      if (value !== undefined && typeof value !== 'function') {
        cleanObj[keyName] = sanitizeForDb(value, keyName);
      }
    }
    return cleanObj as T;
  }
  return obj;
}
