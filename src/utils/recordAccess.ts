import type { UserRole } from '../types';

/**
 * Wewenang mengubah atau menghapus data yang sudah tersimpan di tab SPK Cetak.
 * DEVELOPER dan ADMIN boleh; role lain hanya memakai alur kerja biasa.
 */
export function canManageRecords(role?: UserRole | string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'DEVELOPER' || normalized === 'ADMIN';
}

/**
 * Wewenang memakai seluruh fitur dan isi pada tab Agen, Laporan (Laporan
 * Penjualan, Rekonsiliasi), Invoice, Pajak, dan Marketing: DEVELOPER, ADMIN,
 * dan OWNER.
 *
 * OWNER sengaja tidak dimasukkan ke `canManageRecords` di atas karena wewenang
 * itu juga dipakai tab SPK Cetak, yang aturannya masih DEVELOPER + ADMIN.
 * Menyimpan modul Jurnal tetap khusus DEVELOPER (`journalAccessPolicy.ts`).
 */
export function canManageBusinessData(role?: UserRole | string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'DEVELOPER' || normalized === 'ADMIN' || normalized === 'OWNER';
}

/**
 * Wewenang membuka tab Katalog di navigasi. DEVELOPER, ADMIN, OWNER, dan akun
 * kategori SPK. Yang tiga peran pertama boleh mengubah isi; SPK hanya melihat
 * (hak ubahnya ada di `canEditCatalog` di bawah).
 */
export function canViewCatalog(role?: UserRole | string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'DEVELOPER' || normalized === 'OWNER' || normalized === 'ADMIN' || normalized === 'SPK';
}

/**
 * Wewenang mengubah isi Katalog: tambah produk, ubah produk, kelola kategori.
 * DEVELOPER, ADMIN, OWNER — SPK sengaja tidak termasuk supaya operator cetak
 * tidak bisa mengubah harga kulak yang ikut menggeser nilai aset toko.
 * Menghapus produk tetap hanya DEVELOPER (diperiksa terpisah di layar).
 */
export function canEditCatalog(role?: UserRole | string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'DEVELOPER' || normalized === 'ADMIN' || normalized === 'OWNER';
}

/**
 * Wewenang membuka tab Laporan. DEVELOPER, ADMIN, OWNER, dan akun kategori SPK.
 * Untuk SPK menu yang muncul hanya Laporan Penjualan — lihat
 * `canViewAllReportMenus` di bawah.
 */
export function canViewSalesReport(role?: UserRole | string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'DEVELOPER' || normalized === 'OWNER' || normalized === 'ADMIN' || normalized === 'SPK';
}

/**
 * Wewenang melihat menu Laporan Keuangan dan Rekonsiliasi di dalam tab Laporan:
 * DEVELOPER, ADMIN, OWNER. Modul Jurnal punya aturannya sendiri di
 * `journalAccessPolicy.ts` dan tidak ikut dibuka di sini.
 */
export function canViewAllReportMenus(role?: UserRole | string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'DEVELOPER' || normalized === 'ADMIN' || normalized === 'OWNER';
}

/**
 * Wewenang mengunduh "Master Prompt & Blueprint Arsitektur Aplikasi" dari menu
 * Backup Data. Hanya DEVELOPER.
 *
 * Aturan ini dipakai UI dan ikut diperiksa penjaga; server menegakkan hal yang
 * sama di `server/blueprintApi.ts`, jadi menyembunyikan tombolnya saja tidak
 * cukup dan tidak boleh dianggap sebagai pengamanan.
 */
export function canDownloadBlueprint(role?: UserRole | string | null): boolean {
  return normalizeRole(role) === 'DEVELOPER';
}

function normalizeRole(role?: UserRole | string | null): string {
  return String(role ?? '').trim().toUpperCase();
}
