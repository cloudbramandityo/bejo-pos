/**
 * Daftar tunggal isi berkas cadangan (.json) aplikasi.
 *
 * Berkas ini murni aturan — tidak boleh menggantung ke modul koneksi server —
 * supaya penjaga (`npm run check:backup`) dapat membacanya langsung.
 *
 * Aturan wajib: setiap cermin data di perangkat masuk salah satu dari dua daftar
 * di bawah, yaitu `BACKUP_DOMAINS` (ikut dicadangkan) atau
 * `EXCLUDED_STORAGE_KEYS` (sengaja tidak ikut, lengkap dengan alasannya).
 * Domain baru yang belum tercatat membuat penjaga gagal, sehingga tidak ada
 * data yang hilang diam-diam dari cadangan.
 *
 * Akun login staf (nama masuk, kata sandi, foto profil, flag wajib ganti sandi)
 * sengaja TIDAK ikut dicadangkan maupun dipulihkan. Yang tetap ikut adalah data
 * kerja akun tersebut (hak akses, transaksi buatannya, catatan aktivitas).
 */

/** Bentuk nilai di dalam berkas cadangan. */
export type BackupDomainShape = 'array' | 'object' | 'scalar';

/** Cara nilai domain dikirim ke server saat pemulihan. */
export type BackupCloudWrite = 'record' | 'payload' | 'none';

export interface BackupDomainDefinition {
  /** Kunci di dalam `data` berkas cadangan. */
  key: string;
  /** Label pendek yang dibaca operator (progres pemulihan & daftar isi). */
  label: string;
  /** Kelompok untuk daftar isi di layar. */
  group: BackupGroupName;
  shape: BackupDomainShape;
  storageKeys: readonly string[];
  /** Nama kanal langganan tempat nilai ini tampil di perangkat lain. */
  cloudChannel?: string;
  /**
   * `record` = satu kirim per baris (khusus bentuk array),
   * `payload` = satu kirim untuk seluruh nilai,
   * `none` = hanya tersimpan di perangkat ini.
   */
  cloudWrite: BackupCloudWrite;
  /**
   * `true` hanya untuk domain yang memang boleh kosong di berkas cadangan dan
   * pengosongannya harus ikut dipulihkan, yaitu shift yang sedang berjalan.
   */
  allowsNull?: boolean;
}

export type BackupGroupName =
  | 'Toko'
  | 'Katalog'
  | 'Pelanggan'
  | 'Penjualan'
  | 'Stok & Aset'
  | 'SPK & Mesin'
  | 'Invoice'
  | 'Pajak'
  | 'Laporan'
  | 'Pemasaran'
  | 'AI & Akun Kerja';

export const BACKUP_GROUP_ORDER: readonly BackupGroupName[] = [
  'Toko',
  'Katalog',
  'Pelanggan',
  'Penjualan',
  'Stok & Aset',
  'SPK & Mesin',
  'Invoice',
  'Pajak',
  'Laporan',
  'Pemasaran',
  'AI & Akun Kerja',
];

/**
 * Urutan dipakai saat menulis dan memulihkan: pengaturan toko lebih dulu, lalu
 * induk data (produk), baru daftar yang menyebut produk/pelanggan, dan terakhir
 * buku catatan turunan. Penyesuaian aset dibaca setelah mutasi stok supaya nilai
 * aset tidak dihitung dari produk yang belum selesai dipulihkan.
 */
export const BACKUP_DOMAINS: readonly BackupDomainDefinition[] = [
  // --- Toko ----------------------------------------------------------------
  {
    key: 'storeInfo',
    label: 'Info Toko',
    group: 'Toko',
    shape: 'object',
    storageKeys: ['bejo_pos_store_info_v1'],
    cloudChannel: 'settings/store_info',
    cloudWrite: 'payload',
  },
  {
    // Logo yang dilihat perangkat lain ikut Info Toko; entri ini salinan aslinya
    // di perangkat ini, dipakai ulang saat logo perlu dikompres kembali.
    key: 'defaultLogo',
    label: 'Salinan Logo Toko',
    group: 'Toko',
    shape: 'scalar',
    storageKeys: ['bejo_pos_default_logo_v1'],
    cloudWrite: 'none',
  },
  {
    key: 'storeProfiles',
    label: 'Profil Toko',
    group: 'Toko',
    shape: 'array',
    storageKeys: ['bejo_pos_store_profiles_v1'],
    cloudChannel: 'store_profiles',
    cloudWrite: 'record',
  },
  {
    key: 'activeProfileId',
    label: 'Profil Toko Aktif',
    group: 'Toko',
    shape: 'scalar',
    storageKeys: ['bejo_pos_active_profile_id_v1'],
    cloudChannel: 'settings/active_profile',
    cloudWrite: 'payload',
  },

  // --- Katalog -------------------------------------------------------------
  {
    key: 'productCategories',
    label: 'Kategori Produk',
    group: 'Katalog',
    shape: 'array',
    storageKeys: ['bejo_pos_product_categories_v1'],
    cloudChannel: 'product_categories',
    cloudWrite: 'record',
  },
  {
    key: 'products',
    label: 'Produk',
    group: 'Katalog',
    shape: 'array',
    storageKeys: ['bejo_pos_products_v1'],
    cloudChannel: 'products',
    cloudWrite: 'record',
  },

  // --- Pelanggan -----------------------------------------------------------
  {
    key: 'customerCategories',
    label: 'Kategori Pelanggan',
    group: 'Pelanggan',
    shape: 'array',
    storageKeys: ['bejo_pos_categories_v1'],
    cloudChannel: 'customer_categories',
    cloudWrite: 'record',
  },
  {
    key: 'customers',
    label: 'Pelanggan',
    group: 'Pelanggan',
    shape: 'array',
    storageKeys: ['bejo_pos_customers_v1'],
    cloudChannel: 'customers',
    cloudWrite: 'record',
  },
  {
    key: 'openAccountConfigs',
    label: 'Aturan Tagihan Tempo',
    group: 'Pelanggan',
    shape: 'object',
    storageKeys: ['bejo_open_account_configs'],
    cloudWrite: 'none',
  },
  {
    key: 'suppliers',
    label: 'Supplier',
    group: 'Pelanggan',
    shape: 'array',
    storageKeys: ['bejo_pos_suppliers_v1'],
    cloudChannel: 'suppliers',
    cloudWrite: 'record',
  },
  {
    key: 'agents',
    label: 'Agen',
    group: 'Pelanggan',
    shape: 'array',
    storageKeys: ['bejo_pos_agents_v1'],
    cloudChannel: 'agents',
    cloudWrite: 'record',
  },

  // --- Penjualan -----------------------------------------------------------
  {
    key: 'transactions',
    label: 'Transaksi Penjualan',
    group: 'Penjualan',
    shape: 'array',
    storageKeys: ['bejo_pos_transactions_v1'],
    cloudChannel: 'transactions',
    cloudWrite: 'record',
  },
  {
    key: 'shifts',
    label: 'Shift',
    group: 'Penjualan',
    shape: 'array',
    storageKeys: ['bejo_pos_shifts_v1'],
    cloudChannel: 'shifts',
    cloudWrite: 'record',
  },
  {
    key: 'activeShift',
    label: 'Shift Aktif',
    group: 'Penjualan',
    shape: 'object',
    storageKeys: ['bejo_pos_active_shift_v1'],
    cloudChannel: 'settings/active_shift',
    cloudWrite: 'payload',
    allowsNull: true,
  },
  {
    key: 'cashiers',
    label: 'Data Kasir',
    group: 'Penjualan',
    shape: 'array',
    storageKeys: ['bejo_pos_cashiers_v1'],
    cloudChannel: 'cashiers',
    cloudWrite: 'record',
  },

  // --- Stok & aset ---------------------------------------------------------
  {
    key: 'stockTransactions',
    label: 'Mutasi Stok',
    group: 'Stok & Aset',
    shape: 'array',
    storageKeys: ['bejo_pos_stock_transactions_v1'],
    cloudChannel: 'stock_transactions',
    cloudWrite: 'record',
  },
  {
    key: 'assetAdjustments',
    label: 'Penyesuaian Aset',
    group: 'Stok & Aset',
    shape: 'array',
    storageKeys: ['bejo_pos_asset_adjustments_v1'],
    cloudChannel: 'asset_adjustments',
    cloudWrite: 'record',
  },

  // --- SPK & mesin ---------------------------------------------------------
  {
    key: 'spkOrders',
    label: 'Order SPK',
    group: 'SPK & Mesin',
    shape: 'array',
    storageKeys: ['bejo_pos_spk_orders_v1'],
    cloudChannel: 'spk_orders',
    cloudWrite: 'record',
  },
  {
    key: 'machines',
    label: 'Mesin Cetak',
    group: 'SPK & Mesin',
    shape: 'array',
    storageKeys: ['bejo_pos_machines_v1'],
    cloudChannel: 'machines',
    cloudWrite: 'record',
  },
  {
    key: 'printingRejects',
    label: 'Daftar Tolak Cetak',
    group: 'SPK & Mesin',
    shape: 'array',
    storageKeys: ['bejo_pos_printing_rejects_v1'],
    cloudChannel: 'printing_rejects',
    cloudWrite: 'record',
  },
  {
    key: 'printSettings',
    label: 'Pengaturan Cetak',
    group: 'SPK & Mesin',
    shape: 'object',
    storageKeys: ['bejo_pos_print_settings_v1'],
    cloudWrite: 'none',
  },

  // --- Invoice -------------------------------------------------------------
  {
    key: 'invoices',
    label: 'Invoice & Proforma',
    group: 'Invoice',
    shape: 'array',
    storageKeys: ['bejo_pos_invoices_v1'],
    cloudChannel: 'invoices',
    cloudWrite: 'record',
  },
  {
    key: 'invoiceStoreIdentity',
    label: 'Identitas Penerbit Invoice',
    group: 'Invoice',
    shape: 'object',
    storageKeys: ['bejo_pos_invoice_store_identity_v1'],
    cloudChannel: 'invoice_settings/store_identity',
    cloudWrite: 'payload',
  },

  // --- Pajak ---------------------------------------------------------------
  {
    key: 'taxpayerProfile',
    label: 'Profil Wajib Pajak',
    group: 'Pajak',
    shape: 'object',
    storageKeys: ['bejo_taxpayer_profile'],
    cloudChannel: 'taxpayer_profile/primary',
    cloudWrite: 'payload',
  },
  {
    key: 'taxYears',
    label: 'Daftar Tahun Pajak',
    group: 'Pajak',
    shape: 'array',
    storageKeys: ['bejo_tax_years'],
    cloudChannel: 'settings/tax_years',
    cloudWrite: 'payload',
  },
  {
    key: 'taxMonthlyBillings',
    label: 'Tagihan PPh Bulanan',
    group: 'Pajak',
    shape: 'object',
    storageKeys: ['bejo_tax_monthly_billings'],
    cloudChannel: 'tax_monthly_billings/all_years',
    cloudWrite: 'payload',
  },
  {
    key: 'taxAnnualReturns',
    label: 'SPT Tahunan 1770',
    group: 'Pajak',
    shape: 'array',
    storageKeys: ['bejo_annual_tax_returns'],
    cloudChannel: 'tax_annual_returns',
    cloudWrite: 'record',
  },

  // --- Laporan -------------------------------------------------------------
  {
    key: 'reconciliationRuns',
    label: 'Riwayat Rekonsiliasi',
    group: 'Laporan',
    shape: 'array',
    storageKeys: ['bejo_pos_reconciliation_runs_v1'],
    cloudChannel: 'reconciliation_runs',
    cloudWrite: 'record',
  },
  {
    key: 'entityRegistry',
    label: 'Profil Entitas Usaha',
    group: 'Laporan',
    shape: 'object',
    storageKeys: ['bejo_entity_registry_v1'],
    cloudChannel: 'settings/entity_registry',
    cloudWrite: 'payload',
  },
  {
    key: 'accountChart',
    label: 'Bagan Akun per Entitas',
    group: 'Laporan',
    shape: 'object',
    storageKeys: ['bejo_account_chart_v1'],
    cloudChannel: 'settings/account_chart',
    cloudWrite: 'payload',
  },
  {
    key: 'ledgerEntries',
    label: 'Jurnal Pembukuan per Entitas',
    group: 'Laporan',
    shape: 'array',
    storageKeys: ['bejo_ledger_entries_v1'],
    cloudChannel: 'ledger_entries',
    cloudWrite: 'record',
  },
  {
    key: 'financialSettings',
    label: 'Pengaturan Laporan Keuangan',
    group: 'Laporan',
    shape: 'object',
    storageKeys: ['bejo_laporan_keuangan_settings_v1'],
    cloudWrite: 'none',
  },
  {
    key: 'activityLogs',
    label: 'Log Aktivitas',
    group: 'Laporan',
    shape: 'array',
    storageKeys: ['bejo_pos_activity_logs_v1'],
    cloudChannel: 'activity_logs',
    cloudWrite: 'record',
  },

  // --- Pemasaran -----------------------------------------------------------
  {
    key: 'landingConfig',
    label: 'Isi Website Toko',
    group: 'Pemasaran',
    shape: 'object',
    storageKeys: ['bejo_pos_landing_page_config_v1'],
    cloudChannel: 'settings/landing_config',
    cloudWrite: 'payload',
  },
  {
    key: 'landingDraft',
    label: 'Draf Isi Website',
    group: 'Pemasaran',
    shape: 'object',
    storageKeys: ['bejo_pos_landing_page_draft_v1'],
    cloudChannel: 'settings/landing_config_draft',
    cloudWrite: 'payload',
  },

  // --- AI & akun kerja -----------------------------------------------------
  {
    key: 'customRoles',
    label: 'Hak Akses Menu',
    group: 'AI & Akun Kerja',
    shape: 'array',
    storageKeys: ['bejo_pos_custom_roles_v1'],
    cloudChannel: 'custom_roles',
    cloudWrite: 'record',
  },
  {
    key: 'aiSettings',
    label: 'Pengaturan SI BEJO AI',
    group: 'AI & Akun Kerja',
    shape: 'object',
    storageKeys: ['bejo_ai_settings'],
    cloudWrite: 'none',
  },
  {
    key: 'aiChatMessages',
    label: 'Percakapan SI BEJO AI',
    group: 'AI & Akun Kerja',
    shape: 'array',
    storageKeys: ['bejo_pos_ai_chat_messages_v1'],
    cloudChannel: 'ai_chat_messages',
    cloudWrite: 'record',
  },
  {
    key: 'userMentions',
    label: 'Pemberitahuan Sebutan',
    group: 'AI & Akun Kerja',
    shape: 'array',
    storageKeys: ['bejo_pos_user_mentions_v1'],
    cloudChannel: 'user_mentions',
    cloudWrite: 'record',
  },
];

/** Kunci yang sengaja tidak pernah masuk berkas cadangan, beserta alasannya. */
export interface ExcludedStorageKey {
  key: string;
  reason: string;
}

export const EXCLUDED_STORAGE_KEYS: readonly ExcludedStorageKey[] = [
  {
    key: 'bejo_pos_users_v1',
    reason: 'Akun login staf: nama masuk, kata sandi, foto, dan flag wajib ganti sandi.',
  },
  {
    key: 'bejo_pos_auth_user_v1',
    reason: 'Akun login yang sedang aktif di perangkat ini, beserta nama masuk dan kata sandinya.',
  },
  {
    key: 'bejo_pos_theme_mode_v1',
    reason: 'Tampilan terang/gelap sesuai selera tiap perangkat.',
  },
  {
    key: 'bejo_pos_default_print_directory_v1',
    reason: 'Alamat folder di perangkat ini, berbeda-beda tiap komputer.',
  },
  {
    key: 'bejo_pos_lan_folder_meta_v1',
    reason: 'Izin buka folder bersama melekat pada peramban perangkat ini.',
  },
  {
    key: 'bejo_pos_local_database_config_v1',
    reason: 'Cadangan kerja offline di perangkat ini saja.',
  },
  {
    key: 'bejo_pos_outbox_queue_v1',
    reason: 'Antrean kirim yang tertunda; isinya sudah diusahakan terkirim sendiri.',
  },
  {
    key: 'bejo_last_spk_archive_cleanup_date',
    reason: 'Penanda jadwal bersih-bersih arsip di perangkat ini.',
  },
  {
    key: 'bejo_journal_mirror_settings_v1',
    reason: 'Berisi alamat lembar Google Sheet milik toko — berkasnya di luar aplikasi ini.',
  },
];

/**
 * Nama berkas penyimpanan di luar kendali cadangan: isinya berkas atau izin per
 * perangkat, bukan data toko. Penjaga memakainya untuk mengenali kunci yang
 * memang tidak dimaksudkan sebagai cermin data.
 */
export const DEVICE_ONLY_STORAGE_PREFIXES: readonly string[] = [
  'bejo_pos_lan_grants_db',
  'bejo_pos_print_files_db',
  'bejo_pos_database_backup_',
  'bejo_pos_master',
  'bejo_pos_offline_master',
];

/**
 * Kolom isian milik akun login. Penjaga memastikan tidak satu pun nama ini
 * muncul di dalam berkas cadangan.
 */
export const LOGIN_CREDENTIAL_FIELDS: readonly string[] = [
  'password',
  'appPassword',
  'mustChangePassword',
  'authId',
];

/** Kunci lama yang pernah ada di berkas cadangan dan tidak dipakai lagi. */
export const REMOVED_BACKUP_KEYS: readonly string[] = ['users', 'authUser'];

/** Label yang dipakai di layar cadangan bila sebuah kelompok tidak terisi. */
export const CREDENTIAL_EXCLUSION_NOTE =
  'Akun login staf (nama masuk dan kata sandi) tidak ikut dicadangkan maupun dipulihkan.';

export const backupDomainLabel = (key: string): string =>
  BACKUP_DOMAINS.find((domain) => domain.key === key)?.label ?? key;

export const backupDomainKeys = (): string[] => BACKUP_DOMAINS.map((domain) => domain.key);

/** Semua kunci cermin yang ikut dicadangkan, untuk dibandingkan dengan isi perangkat. */
export const backedUpStorageKeys = (): string[] =>
  BACKUP_DOMAINS.flatMap((domain) => [...domain.storageKeys]);

export const excludedStorageKeys = (): string[] =>
  EXCLUDED_STORAGE_KEYS.map((item) => item.key);

/** Kelompok yang punya isi, dipakai daftar di layar Pengaturan toko. */
export const backupGroups = (): { group: BackupGroupName; labels: string[] }[] =>
  BACKUP_GROUP_ORDER.map((group) => ({
    group,
    labels: BACKUP_DOMAINS.filter((domain) => domain.group === group).map((domain) => domain.label),
  })).filter((entry) => entry.labels.length > 0);

/** Domain yang hanya tersimpan di perangkat — dipakai untuk menulis keterangan jujur. */
export const deviceOnlyDomainLabels = (): string[] =>
  BACKUP_DOMAINS.filter((domain) => domain.cloudWrite === 'none').map((domain) => domain.label);

/** Jumlah baris nilai domain, untuk ringkasan yang terbaca di layar. */
export const countBackupDomainValue = (shape: BackupDomainShape, value: unknown): number => {
  if (shape === 'array') return Array.isArray(value) ? value.length : 0;
  if (shape === 'object') return value && typeof value === 'object' ? 1 : 0;
  return value === undefined || value === null || value === '' ? 0 : 1;
};
