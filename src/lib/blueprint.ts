/**
 * Ambil dokumen blueprint aplikasi dari server.
 *
 * Berkasnya hanya ada di disk server dan hanya boleh dibaca Developer, jadi
 * unduhan selalu lewat rute ini — tidak ada salinan isinya di dalam bundel
 * browser. Gagal baca = lempar pesan pendek apa adanya, tanpa mengarang isi.
 */
export interface BlueprintDocument {
  fileName: string;
  markdown: string;
  bytes: number;
  updatedAt: string;
}

export async function fetchBlueprintDocument(): Promise<BlueprintDocument> {
  const response = await fetch('/api/blueprint', {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  }).catch(() => null);

  if (!response) throw new Error('Server belum terjangkau. Coba lagi setelah tersambung.');
  if (response.status === 403) throw new Error('Dokumen ini hanya dapat diunduh oleh Developer.');

  let data: Partial<BlueprintDocument> & { success?: boolean; error?: string } | null = null;
  try {
    data = (await response.json()) as typeof data;
  } catch {
    data = null;
  }

  if (!response.ok || !data || data.success !== true) {
    throw new Error(
      typeof data?.error === 'string' && data.error
        ? data.error
        : 'Isi dokumen belum terbaca dari server.'
    );
  }

  const markdown = typeof data.markdown === 'string' ? data.markdown : '';
  if (!markdown.trim()) throw new Error('Isi dokumen kosong di server.');

  return {
    fileName: data.fileName || 'MASTER PROMPT & BLUEPRINT ARSITEKTUR APLIKASI.md',
    markdown,
    bytes: Number(data.bytes) || markdown.length,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}
