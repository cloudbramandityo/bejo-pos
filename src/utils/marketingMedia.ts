export const MARKETING_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MARKETING_MAX_VIDEO_BYTES = 64 * 1024 * 1024;

export interface MarketingMediaPayload {
  dataBase64: string;
  mimeType: string;
  fileName: string;
}

export function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function fileToBase64Payload(file: File): Promise<MarketingMediaPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      resolve({
        dataBase64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name,
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Gagal membaca file media.'));
    reader.readAsDataURL(file);
  });
}
