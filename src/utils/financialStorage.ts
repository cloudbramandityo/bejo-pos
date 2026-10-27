/**
 * Penyimpanan pengaturan & input manual Laporan Keuangan.
 * Nilai-nilai awal (modal, utang, aset, prive, dsb.) diisi manual oleh user
 * dan disimpan di localStorage. Angka pendapatan/HPP/beban otomatis diambil
 * dari data transaksi & stok aplikasi, sehingga laporan bisa "diisi manual
 * atau mengambil dari data aplikasi toko".
 */

export interface FinancialSettings {
  /** Nama entitas usaha yang tampil di kop laporan */
  entityName: string;
  /** Periode pelaporan (mis. "Tahun 2026", "Januari 2026") */
  periodLabel: string;
  /** Modal awal / ekuitas pemilik di awal periode */
  openingCapital: number;
  /** Prive / penarikan pribadi owner selama periode (mengurangi ekuitas) */
  ownerDrawings: number;
  /** Persediaan barang dagang di awal periode (untuk HPP periode berjalan) */
  openingInventory: number;
  /** Persediaan barang dagang di akhir periode */
  closingInventory: number;
  /** Utang usaha (hutang dagang) di akhir periode */
  accountsPayable: number;
  /** Utang lain-lain (bank, pribadi, dll) di akhir periode */
  otherLiabilities: number;
  /** Piutang usaha (hutang pelanggan belum diterima) di akhir periode */
  accountsReceivable: number;
  /** Kas & bank di akhir periode (opsional; jika 0 dihitung otomatis dari arus kas) */
  cashBalance: number;
  /** Perkiraan kas & bank di awal periode (modal kas awal untuk arus kas) */
  openingCash: number;
  /** Aset tetap di akhir periode (mesin, kendaraan, bangunan, dll) */
  fixedAssets: number;
  /** Beban operasional tambahan di luar yang tercatat di shift (sewa, listrik, gaji) */
  otherExpenses: number;
  /** Catatan pembukuan manual (opsional) */
  notes: string;
}

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  entityName: 'BEJO Digital Print',
  periodLabel: '',
  openingCapital: 0,
  ownerDrawings: 0,
  openingInventory: 0,
  closingInventory: 0,
  accountsPayable: 0,
  otherLiabilities: 0,
  accountsReceivable: 0,
  cashBalance: 0,
  openingCash: 0,
  fixedAssets: 0,
  otherExpenses: 0,
  notes: '',
};

const STORAGE_KEY = 'bejo_laporan_keuangan_settings_v1';

export function getStoredFinancialSettings(): FinancialSettings {
  if (typeof window === 'undefined') return DEFAULT_FINANCIAL_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FINANCIAL_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FINANCIAL_SETTINGS, ...(parsed || {}) };
  } catch {
    return DEFAULT_FINANCIAL_SETTINGS;
  }
}

export function saveStoredFinancialSettings(settings: FinancialSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* localStorage penuh atau tidak tersedia — abaikan */
  }
}
