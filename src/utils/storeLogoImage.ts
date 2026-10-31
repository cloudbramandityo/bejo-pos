/**
 * Kompres gambar logo toko sebelum disimpan.
 *
 * Logo harus ikut tersebar ke semua perangkat lewat catatan toko di server, jadi
 * ukurannya wajib terkendali: berkas too large membuat isian tidak terbaca di
 * perangkat lain dan membebani memori perangkat ini. Hasilnya selalu JPEG dengan
 * latar putih karena logo tampil di dalam kotak berlatar putih.
 */

/** Panjang data URL yang diizinkan; di atas ini logo dikecilkan lagi. */
export const LOGO_TARGET_CHARS = 200_000;

/** Urutan ukuran sisi terpanjang (piksel) dan kualitas yang dicoba, dari terbesar. */
export const LOGO_SIZES = [256, 192, 128] as const;
export const LOGO_QUALITIES = [0.9, 0.8, 0.7, 0.6] as const;

export type LogoEncoder = (size: number, quality: number) => string;

export interface LogoCompressionResult {
  dataUrl: string;
  size: number;
  quality: number;
}

/**
 * Ambil hasil encode pertama yang cukup kecil. Pengurutan mencoba kualitas
 * terendah pada ukuran terkecil, jadi logo tidak pernah dibuang selama masih
 * punya bentuk yang layak.
 */
export function compressLogoWithEncoder(encode: LogoEncoder): LogoCompressionResult | null {
  let smallest: LogoCompressionResult | null = null;
  for (const size of LOGO_SIZES) {
    for (const quality of LOGO_QUALITIES) {
      const dataUrl = encode(size, quality);
      if (!dataUrl) continue;
      const candidate = { dataUrl, size, quality };
      if (!smallest || dataUrl.length < smallest.dataUrl.length) smallest = candidate;
      if (dataUrl.length <= LOGO_TARGET_CHARS) return candidate;
    }
  }
  return smallest;
}

/**
 * Kompres gambar logo yang sudah dimuat browser. Mengembalikan data URL JPEG,
 * atau null bila kanvas tidak tersedia / gambar gagal digambar.
 */
export function compressLogoImage(img: HTMLImageElement): string | null {
  if (!img.naturalWidth || !img.naturalHeight) return null;

  const result = compressLogoWithEncoder((size, quality) => {
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  });

  return result ? result.dataUrl : null;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gambar tidak dapat dimuat.'));
    img.src = source;
  });
}

/**
 * Perkecil logo yang sudah tersimpan tapi terlalu besar, misalnya hasil unggahan
 * versi lama. Bila gambar gagal dibaca, nilai asal dikembalikan apa adanya.
 */
export async function compressLogoFromDataUrl(dataUrl: string, maxChars = LOGO_TARGET_CHARS): Promise<string> {
  if (!dataUrl || dataUrl.length <= maxChars) return dataUrl;
  try {
    const compressed = compressLogoImage(await loadImage(dataUrl));
    return compressed && compressed.length <= maxChars ? compressed : dataUrl;
  } catch {
    return dataUrl;
  }
}
