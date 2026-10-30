/**
 * Coded by Langgo Bramandityo.
 * Akses folder bersama LAN untuk berkas SPK.
 *
 * Dua batasan browser yang menentukan desain ini:
 * 1. Halaman https TIDAK boleh membuka Windows Explorer ke path \\server\share,
 *    jadi "masuk ke folder" dilakukan lewat File System Access API.
 * 2. Izin folder diberikan per perangkat dan tidak bisa dikirim lewat cloud.
 *
 * Karena itu lokasi folder disetel sekali dan disinkronkan lewat PocketBase
 * (dipakai semua user), sedangkan tiap perangkat cukup sekali menekan
 * "Hubungkan Folder" untuk memberi izin folder yang sama di komputernya.
 */
import { SharedLanFolderConfig, SpkPrintFileAttachment } from '../types';
import {
  saveSharedLanFolderCloud,
  subscribeSharedLanFolder
} from '../backend/pocketbaseBackend';
import {
  formatLocalShortcutPath,
  getLocalPrintBlob,
  getRawStoredDefaultLocalDirectory,
  LEGACY_DEFAULT_PRINT_DIR,
  saveStoredDefaultLocalDirectory
} from './localFileVault';

const GRANT_DB_NAME = 'bejo_pos_lan_grants_db';
const GRANT_DB_VERSION = 1;
const GRANT_STORE = 'dir_grants';
const GRANT_KEY = 'shared_folder';
const META_KEY = 'bejo_pos_lan_folder_meta_v1';

export interface SharedFolderGrantStatus {
  supported: boolean;
  configuredPath: string;
  granted: boolean;
  needsPermission: boolean;
  folderName: string;
  nameMatches: boolean;
  message: string;
}

export type SharedCopyFailureReason =
  | 'no-support'
  | 'no-grant'
  | 'denied'
  | 'not-found'
  | 'write-failed';

/**
 * Hasil penyalinan ke folder bersama. Bentuknya satu objek (bukan union) agar
 * mudah dipakai di seluruh kode aplikasi yang tidak berjalan pada mode strict.
 */
export interface SharedCopyResult {
  ok: boolean;
  fileName: string; // nama akhir di folder bersama ('' bila gagal)
  path: string; // path lengkap berkas di folder bersama ('' bila gagal)
  size: number;
  renamed: boolean; // nama diberi imbuhan SPK karena tabrakan dengan berkas lain
  reason?: SharedCopyFailureReason;
  message: string;
}

export interface SharedFolderFileEntry {
  name: string;
  size: number;
  modifiedMs: number;
}

const copyFail = (reason: SharedCopyFailureReason, message: string): SharedCopyResult => ({
  ok: false,
  fileName: '',
  path: '',
  size: 0,
  renamed: false,
  reason,
  message
});

const copyOk = (fileName: string, path: string, size: number, renamed: boolean): SharedCopyResult => ({
  ok: true,
  fileName,
  path,
  size,
  renamed,
  message: renamed
    ? `Berkas tersimpan sebagai ${fileName} agar tidak menimpa berkas SPK lain.`
    : `Berkas ${fileName} ada di folder bersama.`
});

/* -------------------------------------------------------------------------- */
/*  Konfigurasi folder bersama                                                */
/* -------------------------------------------------------------------------- */

/** Path selalu disimpan dengan satu pemisah di ujung agar bebas ambiguitas. */
export function normalizeFolderPath(raw: string): string {
  const clean = (raw || '').trim();
  if (!clean) return '';
  const usesBackslash = clean.includes('\\');
  const endsWithSeparator = clean.endsWith('\\') || clean.endsWith('/');
  if (endsWithSeparator) return clean;
  return usesBackslash ? `${clean}\\` : `${clean}/`;
}

/** Segmen terakhir path, dipakai untuk mencocokkan nama folder hasil grant. */
export function folderNameOf(path: string): string {
  const parts = normalizeFolderPath(path).split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

function readMeta(): { updatedAt: number; updatedBy: string } {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { updatedAt: 0, updatedBy: '' };
    const parsed = JSON.parse(raw);
    return {
      updatedAt: typeof parsed?.updatedAt === 'number' ? parsed.updatedAt : 0,
      updatedBy: typeof parsed?.updatedBy === 'string' ? parsed.updatedBy : ''
    };
  } catch {
    return { updatedAt: 0, updatedBy: '' };
  }
}

function writeMeta(meta: { updatedAt: number; updatedBy: string }): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Cache lokal gagal ditulis; konfigurasi cloud tetap menjadi acuan.
  }
}

export function getSharedFolderConfig(): SharedLanFolderConfig {
  const meta = readMeta();
  const raw = getRawStoredDefaultLocalDirectory();
  // Nilai bawaan lama bukan setelan user sungguhan; dianggap belum disetel.
  const configured = raw && raw !== LEGACY_DEFAULT_PRINT_DIR ? normalizeFolderPath(raw) : '';
  return {
    path: configured,
    updatedAt: meta.updatedAt,
    updatedBy: meta.updatedBy
  };
}

/** Apakah folder bersama sudah pernah disetel (bukan nilai bawaan aplikasi). */
export function isSharedFolderConfigured(): boolean {
  return Boolean(getSharedFolderConfig().path);
}

function announceFolderChange(path: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('bejo_lan_folder_updated', { detail: path }));
}

/**
 * Simpan konfigurasi: cache lokal dahulu supaya perangkat ini langsung
 * memakainya, lalu naik ke cloud agar semua user lain ikut memakai.
 */
export async function saveSharedFolderConfig(
  rawPath: string,
  updatedBy: string
): Promise<{ ok: boolean; path: string; cloudError?: string }> {
  const path = normalizeFolderPath(rawPath);
  if (!path) return { ok: false, path: '' };

  const meta = { updatedAt: Date.now(), updatedBy: updatedBy || 'Operator' };
  saveStoredDefaultLocalDirectory(path);
  writeMeta(meta);
  announceFolderChange(path);

  try {
    await saveSharedLanFolderCloud({ id: 'spk_lan_folder', ...meta, path });
    return { ok: true, path };
  } catch (err: any) {
    return {
      ok: true,
      path,
      cloudError: err?.message || 'Perubahan belum tersimpan ke database cloud.'
    };
  }
}

/** Terapkan konfigurasi yang datang dari cloud (tidak menulis balik ke cloud). */
function applyCloudConfig(cfg: SharedLanFolderConfig): void {
  const path = normalizeFolderPath(cfg?.path || '');
  if (!path) return;
  const local = getSharedFolderConfig();
  if (local.path === path && local.updatedAt === (cfg.updatedAt || 0)) return;
  saveStoredDefaultLocalDirectory(path);
  writeMeta({ updatedAt: cfg.updatedAt || 0, updatedBy: cfg.updatedBy || '' });
  announceFolderChange(path);
}

let cloudSyncUnsub: (() => void) | null = null;
let cloudSyncRefCount = 0;

/**
 * Langganan tunggal perubahan folder bersama. Semua komponen memakai fungsi ini
 * supaya satu browser tidak membuka banyak kanal realtime untuk record yang sama.
 */
export function startSharedFolderCloudSync(): () => void {
  cloudSyncRefCount += 1;
  if (!cloudSyncUnsub) {
    cloudSyncUnsub = subscribeSharedLanFolder((cfg) => applyCloudConfig(cfg));
  }
  return () => {
    cloudSyncRefCount = Math.max(0, cloudSyncRefCount - 1);
    if (cloudSyncRefCount === 0 && cloudSyncUnsub) {
      cloudSyncUnsub();
      cloudSyncUnsub = null;
    }
  };
}

/* -------------------------------------------------------------------------- */
/*  Grant folder per perangkat (IndexedDB menyimpan handle-nya)               */
/* -------------------------------------------------------------------------- */

export function isSharedFolderApiSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function openGrantDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak tersedia di perangkat ini.'));
      return;
    }
    const request = window.indexedDB.open(GRANT_DB_NAME, GRANT_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(GRANT_STORE)) {
        db.createObjectStore(GRANT_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka penyimpanan izin folder.'));
  });
}

async function readStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openGrantDB();
    return await new Promise((resolve, reject) => {
      const req = db.transaction([GRANT_STORE], 'readonly').objectStore(GRANT_STORE).get(GRANT_KEY);
      req.onsuccess = () => resolve((req.result?.handle as FileSystemDirectoryHandle) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openGrantDB();
  await new Promise<void>((resolve, reject) => {
    const req = db
      .transaction([GRANT_STORE], 'readwrite')
      .objectStore(GRANT_STORE)
      .put({ key: GRANT_KEY, handle, savedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearStoredHandle(): Promise<void> {
  try {
    const db = await openGrantDB();
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction([GRANT_STORE], 'readwrite').objectStore(GRANT_STORE).delete(GRANT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Tidak ada grant yang harus dihapus.
  }
}

type PermissionMode = 'read' | 'readwrite';

async function queryPermission(
  handle: FileSystemDirectoryHandle,
  mode: PermissionMode
): Promise<PermissionState> {
  const withPermission = handle as FileSystemDirectoryHandle & {
    queryPermission?: (descriptor: { mode: PermissionMode }) => Promise<PermissionState>;
  };
  if (!withPermission.queryPermission) return 'granted';
  try {
    return await withPermission.queryPermission({ mode });
  } catch {
    return 'prompt';
  }
}

async function requestPermission(
  handle: FileSystemDirectoryHandle,
  mode: PermissionMode
): Promise<PermissionState> {
  const withPermission = handle as FileSystemDirectoryHandle & {
    requestPermission?: (descriptor: { mode: PermissionMode }) => Promise<PermissionState>;
  };
  if (!withPermission.requestPermission) return 'granted';
  try {
    return await withPermission.requestPermission({ mode });
  } catch {
    return 'denied';
  }
}

/**
 * Handle yang tersimpan boleh saja butuh izin ulang setelah browser ditutup.
 * Fungsi ini hanya memanggil requestPermission bila panggilan terjadi dari
 * aksi user (klik), karena browser menolak izin di luar itu.
 */
async function resolveHandle(forUserAction: boolean): Promise<{
  handle: FileSystemDirectoryHandle | null;
  needsPermission: boolean;
  denied: boolean;
}> {
  const handle = await readStoredHandle();
  if (!handle) return { handle: null, needsPermission: false, denied: false };
  if (await queryPermission(handle, 'readwrite') === 'granted') {
    return { handle, needsPermission: false, denied: false };
  }
  if (!forUserAction) return { handle, needsPermission: true, denied: false };
  const state = await requestPermission(handle, 'readwrite');
  if (state === 'granted') return { handle, needsPermission: false, denied: false };
  return { handle, needsPermission: true, denied: state === 'denied' };
}

/**
 * Tampilkan dialog pilih folder Windows (bisa mengetik \\ip\share di address bar)
 * dan simpan handle-nya. Harus dipanggil dari aksi klik user.
 */
export async function pickSharedFolder(): Promise<{
  ok: boolean;
  folderName: string;
  message: string;
}> {
  if (!isSharedFolderApiSupported()) {
    return {
      ok: false,
      folderName: '',
      message: 'Pilih folder otomatis hanya bisa di Chrome atau Edge terbaru di perangkat ini. Atau salin path UNC lalu tekan Win + R.'
    };
  }
  try {
    const picker = (window as unknown as {
      showDirectoryPicker: (options?: { mode?: PermissionMode }) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    const handle = await picker({ mode: 'readwrite' });
    await storeHandle(handle);
    const configured = getSharedFolderConfig().path;
    const nameMatches = !configured || folderNameOf(configured).toLowerCase() === handle.name.toLowerCase();
    return {
      ok: true,
      folderName: handle.name,
      message: nameMatches
        ? `Folder "${handle.name}" terhubung ke perangkat ini.`
        : `Folder "${handle.name}" terhubung, tapi nama folder tidak sama dengan konfigurasi bersama "${folderNameOf(configured)}". Periksa lagi folder yang dipilih.`
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, folderName: '', message: 'Pemilihan folder dibatalkan.' };
    return { ok: false, folderName: '', message: err?.message || 'Folder tidak dapat dibuka di perangkat ini.' };
  }
}

export async function forgetSharedFolderGrant(): Promise<void> {
  await clearStoredHandle();
}

/**
 * Hasil pemilihan berkas dari folder bersama lewat File System Access API.
 * Dipakai saat user memilih data dari folder LAN untuk di-attach ke SPK.
 */
export interface SharedFolderPickResult {
  ok: boolean;
  files: File[];
  folderName: string;
  message: string;
}

/**
 * Memilih berkas dari folder bersama yang sedang disetel & dihubungkan di perangkat
 * ini, lewat Open File Picker (File System Access API). Berkas hasil pick memang
 * berasal dari folder bersama, sehingga setelah di-attach statusnya benar-benar
 * "ada di folder bersama" dan tidak ada lagi salah file antar user.
 */
export async function pickSharedFolderFiles(): Promise<SharedFolderPickResult> {
  const win = window as unknown as {
    showOpenFilePicker?: (
      options?: {
        types?: Array<{ description?: string; accept?: Record<string, string[]> }>;
        excludeAcceptAllOption?: boolean;
      }
    ) => Promise<FileSystemFileHandle[]>;
  };
  const withPicker = win.showOpenFilePicker;
  if (!withPicker) {
    return {
      ok: false,
      files: [],
      folderName: '',
      message: 'Pilih berkas dari folder hanya bisa di Chrome atau Edge terbaru di perangkat ini.'
    };
  }
  try {
    const handles = await withPicker({
      types: [
        {
          description: 'Berkas Cetak Digital',
          accept: {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/tiff': ['.tiff', '.tif'],
            'image/webp': ['.webp'],
            'image/gif': ['.gif'],
            'application/octet-stream': ['.psd', '.ai', '.eps', '.cdr', '.zip', '.rar', '.7z', '.svg']
          }
        }
      ],
      excludeAcceptAllOption: true
    });
    const files: File[] = [];
    for (const handle of handles) {
      const file = await (handle as FileSystemFileHandle).getFile();
      files.push(file);
    }
    return { ok: true, files, folderName: '', message: `${files.length} berkas dipilih dari folder bersama.` };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, files: [], folderName: '', message: 'Pemilihan berkas dibatalkan.' };
    }
    return { ok: false, files: [], folderName: '', message: err?.message || 'Berkas tidak dapat dipilih dari folder bersama.' };
  }
}

/**
 * Minta ulang izin baca-tulis untuk folder yang sudah pernah dipilih di perangkat
 * ini, tanpa membuka dialog pilih folder. Harus dipanggil dari aksi klik user.
 */
export async function requestSharedFolderPermission(): Promise<{
  ok: boolean;
  folderName: string;
  message: string;
}> {
  const stored = await readStoredHandle();
  if (!stored) {
    return {
      ok: false,
      folderName: '',
      message: 'Belum ada folder yang dipilih di perangkat ini. Klik "Hubungkan Folder di Perangkat Ini".'
    };
  }
  const res = await resolveHandle(true);
  if (res.denied) {
    return { ok: false, folderName: stored.name, message: 'Izin folder ditolak. Klik "Hubungkan Folder" lalu pilih ulang folder yang sama.' };
  }
  if (!res.handle || res.needsPermission) {
    return { ok: false, folderName: stored.name, message: 'Izin belum diberikan. Coba klik "Izinkan Akses" sekali lagi.' };
  }
  return { ok: true, folderName: stored.name, message: `Izin baca-tulis folder "${stored.name}" aktif di perangkat ini.` };
}

export async function getSharedFolderGrantStatus(): Promise<SharedFolderGrantStatus> {
  const configuredPath = getSharedFolderConfig().path;
  const supported = isSharedFolderApiSupported();
  const base: SharedFolderGrantStatus = {
    supported,
    configuredPath,
    granted: false,
    needsPermission: false,
    folderName: '',
    nameMatches: true,
    message: ''
  };

  if (!supported) {
    return { ...base, message: 'Akses folder hanya bisa di Chrome atau Edge terbaru di perangkat ini.' };
  }

  const { handle, needsPermission, denied } = await resolveHandle(false);
  if (!handle) {
    return {
      ...base,
      message: configuredPath
        ? 'Folder bersama belum dihubungkan ke perangkat ini. Klik "Hubungkan Folder" sekali saja.'
        : 'Folder bersama belum disetel.'
    };
  }
  const nameMatches = !configuredPath || folderNameOf(configuredPath).toLowerCase() === handle.name.toLowerCase();
  if (denied) {
    return { ...base, folderName: handle.name, nameMatches, message: 'Izin folder ditolak di perangkat ini.' };
  }
  if (needsPermission) {
    return {
      ...base,
      folderName: handle.name,
      nameMatches,
      needsPermission: true,
      message: 'Izin folder perlu dikonfirmasi ulang (klik "Hubungkan Folder" atau tombol aksi file).'
    };
  }
  return {
    ...base,
    granted: true,
    folderName: handle.name,
    nameMatches,
    message: `Folder "${handle.name}" siap dipakai di perangkat ini.`
  };
}

/* -------------------------------------------------------------------------- */
/*  Operasional berkas di folder bersama                                      */
/* -------------------------------------------------------------------------- */

async function openWritableDirectory(forUserAction: boolean): Promise<{
  dir: FileSystemDirectoryHandle | null;
  failure?: { reason: SharedCopyFailureReason; message: string };
}> {
  if (!isSharedFolderApiSupported()) {
    return { dir: null, failure: { reason: 'no-support', message: 'Perangkat ini belum mendukung akses folder bersama. Gunakan Chrome atau Edge terbaru.' } };
  }
  const { handle, needsPermission, denied } = await resolveHandle(forUserAction);
  if (!handle) {
    return {
      dir: null,
      failure: {
        reason: 'no-grant',
        message: getSharedFolderConfig().path
          ? 'Perangkat ini belum menghubungkan folder bersama. Klik "Hubungkan Folder" sekali saja.'
          : 'Folder bersama belum disetel dan belum dihubungkan ke perangkat ini.'
      }
    };
  }
  if (needsPermission || denied) {
    return { dir: null, failure: { reason: 'denied', message: 'Izin folder belum diberikan di perangkat ini.' } };
  }
  return { dir: handle };
}

async function statFile(handle: FileSystemFileHandle): Promise<{ size: number; modifiedMs: number } | null> {
  try {
    const file = await handle.getFile();
    return { size: file.size, modifiedMs: file.lastModified };
  } catch {
    return null;
  }
}

async function lookupExisting(dir: FileSystemDirectoryHandle, name: string) {
  try {
    const handle = await dir.getFileHandle(name);
    const stat = await statFile(handle);
    return { handle, stat };
  } catch {
    return null;
  }
}

/**
 * Nama tujuan anti-tabrakan: nama asli dipertahankan selama isinya sama.
 * Bila sudah ada file BEDA dengan nama sama, diberi imbuhan nomor SPK supaya
 * berkas SPK lain tidak tertimpa (ini penyebab klasik "salah file").
 */
async function resolveTargetName(
  dir: FileSystemDirectoryHandle,
  wanted: string,
  sourceSize: number,
  orderNumber?: string
): Promise<{ name: string; sameFileAlreadyThere: boolean; renamed: boolean }> {
  const existing = await lookupExisting(dir, wanted);
  if (!existing) return { name: wanted, sameFileAlreadyThere: false, renamed: false };
  if (existing.stat && existing.stat.size === sourceSize) {
    return { name: wanted, sameFileAlreadyThere: true, renamed: false };
  }

  const dot = wanted.lastIndexOf('.');
  const stem = dot > 0 ? wanted.slice(0, dot) : wanted;
  const ext = dot > 0 ? wanted.slice(dot) : '';
  const tag = (orderNumber || `dev${Date.now()}`).replace(/[^A-Za-z0-9_-]/g, '-');
  let candidate = `${stem}_${tag}${ext}`;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const found = await lookupExisting(dir, candidate);
    if (!found) return { name: candidate, sameFileAlreadyThere: false, renamed: true };
    if (found.stat && found.stat.size === sourceSize) {
      return { name: candidate, sameFileAlreadyThere: true, renamed: true };
    }
    candidate = `${stem}_${tag}-${attempt + 1}${ext}`;
  }
  return { name: `${stem}_${tag}-${Date.now()}${ext}`, sameFileAlreadyThere: false, renamed: true };
}

async function writeBytes(
  dir: FileSystemDirectoryHandle,
  name: string,
  data: Blob
): Promise<{ size: number } | null> {
  try {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    const stat = await statFile(handle);
    return stat ? { size: stat.size } : null;
  } catch {
    return null;
  }
}

/**
 * Salin berkas ke folder bersama. `forUserAction` harus true bila dipanggil
 * dari klik user, agar browser mengizinkan konfirmasi izin ulang.
 */
export async function copyFileToSharedFolder(
  file: File | Blob,
  fileName: string,
  orderNumber?: string,
  forUserAction = true
): Promise<SharedCopyResult> {
  const { dir, failure } = await openWritableDirectory(forUserAction);
  if (!dir) {
    return copyFail(failure?.reason || 'no-grant', failure?.message || 'Folder tidak siap.');
  }
  const sourceName = (fileName || (file as File)?.name || 'berkas_cetak').trim().replace(/\s+/g, '_');
  const folderDisplay = getSharedFolderConfig().path || `${dir.name}/`;
  const target = await resolveTargetName(dir, sourceName, file.size, orderNumber);
  if (target.sameFileAlreadyThere) {
    return copyOk(target.name, formatLocalShortcutPath(folderDisplay, target.name), file.size, target.renamed);
  }
  const written = await writeBytes(dir, target.name, file);
  if (!written || written.size !== file.size) {
    return copyFail(
      'write-failed',
      `Penyalinan ke folder bersama tidak tuntas (${written?.size ?? 0} dari ${file.size} byte).`
    );
  }
  return copyOk(target.name, formatLocalShortcutPath(folderDisplay, target.name), written.size, target.renamed);
}

/** Ambil isi berkas dari folder bersama lalu buka di browser (atau unduh). */
export async function openFileFromSharedFolder(
  attachment: SpkPrintFileAttachment
): Promise<{ ok: boolean; message: string }> {
  const name = attachment.fileName;
  if (!name) return { ok: false, message: 'Nama berkas tidak diketahui.' };
  const { dir, failure } = await openWritableDirectory(true);
  if (!dir) return { ok: false, message: failure?.message || 'Folder belum siap di perangkat ini.' };

  const found = await lookupExisting(dir, name);
  if (!found) return { ok: false, message: `Berkas "${name}" tidak ada di folder bersama.` };

  let blob: Blob;
  try {
    blob = await found.handle.getFile();
  } catch {
    return { ok: false, message: `Berkas "${name}" gagal dibaca dari folder bersama.` };
  }

  const url = URL.createObjectURL(blob);
  const viewable = /\.(pdf|jpe?g|png|webp|gif|txt)$/i.test(name);
  if (viewable) {
    window.open(url, '_blank');
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { ok: true, message: `Membuka "${name}" dari folder bersama.` };
}

/** Status keberadaan berkas sebenarnya di folder bersama. */
export async function verifySharedFolderFile(
  attachment: SpkPrintFileAttachment
): Promise<{ state: 'ok' | 'missing' | 'different-size' | 'no-access'; size?: number; message: string }> {
  const { dir, failure } = await openWritableDirectory(false);
  if (!dir) {
    return { state: 'no-access', message: failure?.message || 'Folder belum siap di perangkat ini.' };
  }
  const found = await lookupExisting(dir, attachment.fileName);
  if (!found) return { state: 'missing', message: `Berkas "${attachment.fileName}" tidak ada di folder bersama.` };
  if (!found.stat) return { state: 'missing', message: `Berkas "${attachment.fileName}" tidak dapat dibaca.` };
  if (typeof attachment.fileSize === 'number' && found.stat.size !== attachment.fileSize) {
    return {
      state: 'different-size',
      size: found.stat.size,
      message: `Ukuran berkas di folder (${found.stat.size} B) berbeda dari catatan SPK (${attachment.fileSize} B).`
    };
  }
  return { state: 'ok', size: found.stat.size, message: 'Berkas ada di folder bersama dan ukurannya cocok.' };
}

/** Isi folder bersama, terbaru lebih dulu, untuk ditampilkan di aplikasi. */
export async function listSharedFolderFiles(limit = 300): Promise<{
  entries: SharedFolderFileEntry[];
  error?: string;
}> {
  const { dir, failure } = await openWritableDirectory(false);
  if (!dir) return { entries: [], error: failure?.message || 'Folder belum siap.' };
  const entries: SharedFolderFileEntry[] = [];
  try {
    const iterable = dir as unknown as { values: () => AsyncIterable<FileSystemHandle> };
    for await (const handle of iterable.values()) {
      if (handle.kind !== 'file') continue;
      if (entries.length >= limit) break;
      const stat = await statFile(handle as FileSystemFileHandle);
      entries.push({
        name: handle.name,
        size: stat?.size ?? 0,
        modifiedMs: stat?.modifiedMs ?? 0
      });
    }
  } catch (err: any) {
    return { entries, error: err?.message || 'Folder tidak dapat dibaca.' };
  }
  return { entries: entries.sort((a, b) => b.modifiedMs - a.modifiedMs) };
}

/**
 * Salin berkas yang masih tersangkut di vault perangkat (IndexedDB) ke folder
 * bersama. Dipakai untuk merapikan SPK lama yang dulu hanya tercatat path-nya.
 */
export async function copyVaultFileToSharedFolder(
  attachment: SpkPrintFileAttachment,
  orderNumber?: string
): Promise<SharedCopyResult> {
  const blob = await getLocalPrintBlob(attachment.storageKey || attachment.id);
  if (!blob) {
    return copyFail(
      'not-found',
      'Isi berkas tidak ada di perangkat ini. Silakan pilih ulang berkasnya.'
    );
  }
  return copyFileToSharedFolder(blob, attachment.originalFileName || attachment.fileName, orderNumber, true);
}

/** Tempel hasil salinan ke descriptor lampiran agar tersimpan ikut tersinkron. */
export function applySharedCopyToAttachment(
  attachment: SpkPrintFileAttachment,
  result: SharedCopyResult,
  folderPath: string,
  folderName: string
): SpkPrintFileAttachment {
  return {
    ...attachment,
    fileName: result.fileName,
    originalFileName: attachment.originalFileName || result.fileName,
    fileSize: result.size,
    localPath: result.path,
    lanFolderUrl: normalizeFolderPath(folderPath),
    sharedCopy: true,
    sharedCopiedAt: Date.now(),
    sharedSize: result.size,
    sharedFolderName: folderName
  };
}
