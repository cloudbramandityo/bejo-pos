/**
 * Baca identitas toko (nama + logo) yang sudah disetel di Pengaturan toko.
 *
 * Layar login tampil sebelum ada sesi, sedangkan catatan toko di server hanya
 * boleh dibaca setelah login. Endpoint ini hanya mengirim nama toko dan logonya,
 * jadi layar login bisa memakai logo asli tanpa harus membuka data lain.
 */
export interface PublicBranding {
  storeName: string;
  logoUrl: string;
}

export async function getPublicBranding(): Promise<PublicBranding | null> {
  try {
    const response = await fetch('/api/branding', { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<PublicBranding> & { success?: boolean };
    if (!data || data.success === false) return null;
    return { storeName: data.storeName || '', logoUrl: data.logoUrl || '' };
  } catch {
    // Server belum terjangkau: layar login tetap memakai emblem bawaan.
    return null;
  }
}
