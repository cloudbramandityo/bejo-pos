/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 * Local File Vault & Storage Engine using IndexedDB for high-capacity SPK Print Files.
 * Allows storing, retrieving, exporting, and managing local shortcut paths for Digital Printing SPK.
 */
import { SpkPrintFileAttachment } from '../types';

const DB_NAME = 'bejo_pos_print_files_db';
const DB_VERSION = 1;
const STORE_NAME = 'spk_print_blobs';
const STORAGE_KEY_DEFAULT_DIR = 'bejo_pos_default_print_directory_v1';

/**
 * Nilai lama yang dipakai aplikasi sebelum folder bersama disinkronkan.
 * Tidak boleh dianggap sebagai lokasi yang benar-benar sudah disetel user.
 */
export const LEGACY_DEFAULT_PRINT_DIR = 'D:/DATA_CETAK_BEJO/';

/** Lokasi folder yang benar-benar pernah disetel; null berarti belum ada. */
export function getRawStoredDefaultLocalDirectory(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_DEFAULT_DIR);
  } catch {
    return null;
  }
}

/**
 * Format link shortcut path combining folder directory and file name: (link folder file)(nama file)
 * e.g. folder: "\\192.168.1.56\", file: "Faktur_Pembelian_PB-261001-9280.pdf"
 * => "\\192.168.1.56\Faktur_Pembelian_PB-261001-9280.pdf"
 */
export function formatLocalShortcutPath(directoryPath: string, fileName?: string): string {
  const raw = (directoryPath || '').trim() || getRawStoredDefaultLocalDirectory() || '';
  const dir = raw === LEGACY_DEFAULT_PRINT_DIR ? '' : raw;
  if (!dir) return fileName ? fileName.trim().replace(/\s+/g, '_') : '';
  const usesBackslash = dir.includes('\\');
  let cleanDir = dir;
  if (usesBackslash) {
    if (!cleanDir.endsWith('\\')) cleanDir += '\\';
  } else {
    if (!cleanDir.endsWith('/')) cleanDir += '/';
  }
  if (!fileName || !fileName.trim()) return cleanDir;
  const cleanFileName = fileName.trim().replace(/\s+/g, '_');
  return `${cleanDir}${cleanFileName}`;
}

/**
 * Save user custom default local directory
 */
export function saveStoredDefaultLocalDirectory(path: string): void {
  try {
    let cleanPath = (path || '').trim();
    const usesBackslash = cleanPath.includes('\\');
    if (cleanPath) {
      if (usesBackslash) {
        if (!cleanPath.endsWith('\\')) cleanPath += '\\';
      } else {
        if (!cleanPath.endsWith('/')) cleanPath += '/';
      }
      localStorage.setItem(STORAGE_KEY_DEFAULT_DIR, cleanPath);
    } else {
      localStorage.removeItem(STORAGE_KEY_DEFAULT_DIR);
      cleanPath = '';
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_print_dir_updated', { detail: cleanPath }));
    }
  } catch (e) {
    console.error('Failed to save default local print directory', e);
  }
}

/**
 * Initialize IndexedDB instance
 */
function openFilesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Format bytes to readable string (e.g., 14.2 MB)
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Determine file category and color theme
 */
export function getFileExtensionMeta(fileName?: string) {
  if (!fileName) {
    return { ext: 'FILE', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: 'file' };
  }
  const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';

  switch (ext) {
    case 'PDF':
      return { ext: 'PDF', color: 'bg-red-100 text-red-700 border-red-300', icon: 'pdf' };
    case 'CDR':
      return { ext: 'CDR', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'cdr' };
    case 'PSD':
      return { ext: 'PSD', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: 'psd' };
    case 'AI':
    case 'EPS':
      return { ext, color: 'bg-amber-100 text-amber-900 border-amber-300', icon: 'ai' };
    case 'TIFF':
    case 'TIF':
      return { ext: 'TIFF', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: 'tiff' };
    case 'JPG':
    case 'JPEG':
    case 'PNG':
    case 'WEBP':
    case 'SVG':
      return { ext, color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: 'image' };
    case 'ZIP':
    case 'RAR':
    case '7Z':
      return { ext, color: 'bg-amber-100 text-amber-800 border-amber-300', icon: 'zip' };
    default:
      return { ext, color: 'bg-slate-100 text-slate-800 border-slate-300', icon: 'file' };
  }
}

/**
 * Save binary file to local IndexedDB and return lightweight attachment descriptor with local shortcut path.
 * Note: Heavy binary data is stored ONLY inside IndexedDB, keeping JSON objects and localStorage lightweight.
 */
export async function saveLocalPrintFile(
  file: File,
  orderNumber?: string,
  customDirectoryPath?: string,
  uploadedBy?: string
): Promise<SpkPrintFileAttachment> {
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const configuredDir = customDirectoryPath?.trim() || getRawStoredDefaultLocalDirectory() || '';
  const sharedDir =
    !configuredDir || configuredDir === LEGACY_DEFAULT_PRINT_DIR ? '' : configuredDir;

  // Hanya tulis path bila folder bersama benar-benar sudah disetel. Tanpa itu
  // path-nya hanya tebakan dan justru membuat operator membuka berkas yang salah.
  const localShortcutPath = sharedDir ? formatLocalShortcutPath(sharedDir, file.name) : '';

  // Store in IndexedDB (handles gigabytes safely without touching localStorage or PocketBase payload)
  try {
    const db = await openFilesDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      localPath: localShortcutPath,
      uploadedAt: Date.now(),
      uploadedBy: uploadedBy || 'Operator',
      blob: file
    };

    await new Promise<void>((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not store full binary file in IndexedDB:', err);
  }

  // Lightweight metadata only
  const attachment: SpkPrintFileAttachment = {
    id: fileId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    localPath: localShortcutPath,
    storageKey: fileId,
    uploadedAt: Date.now(),
    uploadedBy: uploadedBy || 'Operator'
  };

  return attachment;
}

/**
 * Retrieve binary Blob from IndexedDB
 */
export async function getLocalPrintBlob(fileId: string): Promise<Blob | null> {
  try {
    const db = await openFilesDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const req = store.get(fileId);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error fetching file blob from IndexedDB', err);
    return null;
  }
}

/**
 * Open or Download print file from local vault
 */
export async function openOrDownloadPrintFile(attachment: SpkPrintFileAttachment): Promise<boolean> {
  try {
    let blob: Blob | null = null;
    if (attachment.storageKey) {
      blob = await getLocalPrintBlob(attachment.storageKey);
    } else if (attachment.id) {
      blob = await getLocalPrintBlob(attachment.id);
    }

    if (blob) {
      const url = URL.createObjectURL(blob);
      const isViewableInBrowser =
        blob.type === 'application/pdf' ||
        blob.type.startsWith('image/') ||
        attachment.fileName.toLowerCase().endsWith('.pdf') ||
        attachment.fileName.toLowerCase().endsWith('.jpg') ||
        attachment.fileName.toLowerCase().endsWith('.jpeg') ||
        attachment.fileName.toLowerCase().endsWith('.png');

      if (isViewableInBrowser) {
        window.open(url, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    } else {
      // Fallback: copy shortcut or alert
      return false;
    }
  } catch (e) {
    console.error('Failed to open or download print file', e);
    return false;
  }
}

/**
 * Copy file shortcut local path to clipboard
 */
export async function copyLocalShortcutToClipboard(path: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(path);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = path;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}
