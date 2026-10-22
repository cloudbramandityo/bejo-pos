/**
 * Coded by Langgo Bramandityo.
 * Tipe Data & Skema Resmi Modul Pengisian Pajak - SPT Tahunan Orang Pribadi 2025
 * Berdasarkan acuan resmi Formulir SPT Tahunan Orang Pribadi (Formulir 1770 / DJP) & UU HPP
 */

export type TaxReportingStatus = 'DRAFT' | 'SELESAI' | 'SIAP_LAPOR' | 'DILAPORKAN';
export type SptType = 'NORMAL' | 'PEMBETULAN';
export type AccountingMethod = 'PENCATATAN' | 'PEMBUKUAN_KAS' | 'PEMBUKUAN_AKRUAL';
export type MaritalTaxStatus = 'KK' | 'HB' | 'PH' | 'MT'; // KK: Kepala Keluarga, HB: Hidup Berpisah, PH: Pisah Harta, MT: Memilih Terpisah
export type PtkpStatus = 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3' | 'K/I/0' | 'K/I/1' | 'K/I/2' | 'K/I/3';

export interface TaxpayerProfile {
  npwp: string; // 16 digit NPWP / NIK
  nik: string;
  fullName: string;
  idType: 'KTP' | 'PASPOR' | 'KITAS';
  idNumber: string;
  phoneNumber: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  kluCode?: string; // Klasifikasi Lapangan Usaha (misal 47611 - Perdagangan Eceran Alat Tulis & Percetakan)
  kluDescription?: string;
  maritalTaxStatus: MaritalTaxStatus;
  spouseNpwp?: string;
  spouseName?: string;
  spouseNik?: string;
  ptkpStatus: PtkpStatus;
}

// 1. DAFTAR HARTA PADA AKHIR TAHUN (Lampiran 1 - Bagian A)
export interface TaxAssetItem {
  id: string;
  code: string; // Kode Harta DJP (misal: 011 Kas/Uang Tunai, 012 Tabungan, 041 Mobil, 061 Tanah)
  name: string; // Nama Harta
  acquisitionYear: number; // Tahun Perolehan
  acquisitionPrice: number; // Harga Perolehan (Rupiah)
  marketValue?: number; // Nilai Wajar / Taksiran
  description: string; // Keterangan (misal: Nomor Rekening, Plat Nomor, NOP/Sertifikat)
}

// 2. DAFTAR UTANG / KEWAJIBAN PADA AKHIR TAHUN (Lampiran 1 - Bagian B)
export interface TaxDebtItem {
  id: string;
  code: string; // Kode Utang DJP (misal: 101 Utang Bank/Lembaga Keuangan, 102 Kartu Kredit, 103 Utang Afiliasi)
  lenderName: string; // Nama Pemberi Pinjaman
  lenderAddress: string;
  loanYear: number; // Tahun Peminjaman
  initialAmount: number; // Jumlah Pinjaman Awal
  endingBalance: number; // Saldo Sisa Utang Akhir Tahun
  description?: string;
}

// 3. DAFTAR TANGGUNGAN KELUARGA (Lampiran 1 - Bagian C)
export interface TaxDependentItem {
  id: string;
  fullName: string;
  nik: string;
  familyRelationship: 'ISTRI' | 'ANAK_KANDUNG' | 'ANAK_ANGKAT' | 'ORANG_TUA' | 'MERTUA';
  jobOrStatus: string; // Misal: Pelajar, Mahasiswa, Belum Bekerja, Mengurus Rumah Tangga
  description?: string;
}

// 4. BUKTI PEMOTONGAN / PEMUNGUTAN PPH PIHAK LAIN (Lampiran 1 - Bagian D & E)
export interface TaxWithholdingItem {
  id: string;
  taxType: 'PASAL_21' | 'PASAL_22' | 'PASAL_23' | 'PASAL_24' | 'PASAL_26';
  withholderNpwp: string; // NPWP Pemotong / Pemungut
  withholderName: string; // Nama Pemotong / Pemungut
  withholdingSlipNumber: string; // Nomor Bukti Potong (contoh: 1721-A1 atau Bukti Potong Bupot Unifikasi)
  withholdingDate: string; // Tanggal Bukti Potong (YYYY-MM-DD)
  incomeCategory: string; // Jenis Penghasilan
  grossIncome: number; // Jumlah Penghasilan Bruto
  withheldTaxAmount: number; // Jumlah PPh yang Dipotong / Dipungut
}

// 5. PENGHASILAN FINAL & BUKAN OBJEK PAJAK (Lampiran 2)
export interface TaxFinalIncomeItem {
  id: string;
  categoryCode: string; // Kode Kategori (misal: UMKM_PP55, DEPOSITO, SEWA_TANAH, SAHAM, DIVIDEN)
  description: string;
  grossAmount: number;
  taxRatePercent: number; // Misal 0.5% (UMKM), 10% (Sewa), 20% (Bunga Deposito)
  finalTaxAmount: number;
}

export interface TaxNonTaxableIncomeItem {
  id: string;
  categoryCode: string; // BANTUAN_SUMBANGAN, WARISAN, KLAIM_ASURANSI, BEASISWA, SISA_LEBIH_YAYASAN
  description: string;
  amount: number;
}

// 6. PENGHASILAN LUAR NEGERI
export interface TaxForeignIncomeItem {
  id: string;
  country: string;
  incomeType: string;
  grossAmountIdr: number;
  foreignTaxPaidIdr: number;
  allowableCreditIdr: number; // Kredit Pajak Luar Negeri (Pasal 24) Maksimal
}

// 7. PENGHASILAN USAHA & PEKERJAAN BEBAS (Lampiran Usaha Formulir 1770-I)
export interface TaxBusinessActivity {
  hasBusinessIncome: boolean;
  accountingMethod: AccountingMethod;
  klu: string;
  grossRevenue: number; // Peredaran Usaha Bruto
  nppnRatePercent?: number; // Norma Penghitungan Penghasilan Neto (%) jika menggunakan Pencatatan
  netIncomeCalculated: number; // Penghasilan Neto dari Usaha
  // Rincian Pembukuan (jika metode pembukuan)
  cogs?: number; // Harga Pokok Penjualan (HPP)
  operatingExpenses?: number; // Biaya Usaha
  positiveFiscalAdjustment?: number; // Koreksi Fiskal Positif
  negativeFiscalAdjustment?: number; // Koreksi Fiskal Negatif
  // PPh Final UMKM PP 55/2022 (0.5% dengan fasilitas batasan Rp 500 jt bebas pajak bagi OP)
  isUmkmPp55: boolean;
  umkmTaxExemptThreshold: number; // Default: 500,000,000
  umkmTaxableRevenue: number;
  umkmTaxAmount: number;
}

// 8. PENGURANG PENGHASILAN NETO (Zakat, Sumbangan, dsb)
export interface TaxDeductions {
  zakatOrReligiousCharity: number; // Zakat / Sumbangan Keagamaan Sifatnya Wajib melalui Lembaga Resmi
  pastLossCarryForward: number; // Kompensasi Kerugian (Bagi yang Pembukuan)
  otherAllowableDeductions: number;
}

// 9. INDUK SPT TAHUNAN ORANG PRIBADI (Summary & Calculation)
export interface TaxAnnualReturn1770 {
  id: string;
  taxYear: number; // Contoh: 2024 atau 2025
  sptType: SptType;
  amendmentNumber: number; // 0 jika NORMAL, 1, 2, dst jika PEMBETULAN
  filingStatus: TaxReportingStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;

  // Profil Wajib Pajak
  taxpayer: TaxpayerProfile;

  // Pertanyaan Bercabang & Pilihan Profil
  hasEmploymentIncome: boolean; // Penghasilan dari Pekerjaan (Pegawai)
  hasBusinessIncome: boolean; // Usaha / Pekerjaan Bebas
  hasOtherDomesticIncome: boolean; // Royalti, Bunga, Sewa Harta, Hadiah
  hasForeignIncome: boolean;
  hasFinalIncome: boolean;
  hasNonTaxableIncome: boolean;
  hasAssets: boolean;
  hasDebts: boolean;
  hasDependents: boolean;
  hasWithholdingSlips: boolean;

  // Data Rinci
  employmentGrossIncome: number;
  employmentDeductions: number; // Biaya jabatan (maks 6 jt) + iuran pensiun
  employmentNetIncome: number; // Neto dari pekerjaan

  businessActivity: TaxBusinessActivity;
  otherDomesticNetIncome: number;
  foreignNetIncome: number;

  totalNetIncome: number; // Total Penghasilan Neto
  deductions: TaxDeductions;
  netIncomeAfterDeductions: number; // Penghasilan Neto setelah Zakat/Kompensasi

  ptkpAmount: number; // Nilai PTKP (misal Rp 54.000.000 untuk TK/0)
  taxableIncome: number; // Penghasilan Kena Pajak (PKP) dibulatkan ke ribuan ke bawah

  // Perhitungan Pajak Terutang (Pasal 17 UU HPP)
  taxTariffBrackets: {
    bracket: string;
    ratePercent: number;
    taxableAmountInBracket: number;
    taxAmountInBracket: number;
  }[];
  totalTaxPayable: number; // PPh Terutang (Pasal 17)

  // Kredit Pajak
  totalWithholdingCredit: number; // Kredit PPh 21, 22, 23, 24
  pph25PaidYearly: number; // Angsuran PPh Pasal 25 yang telah dibayar sendiri
  stpPph25Principal: number; // STP PPh Pasal 25 (Hanya Pokok Pajak)
  totalTaxCredits: number;

  // Status Akhir
  taxDifferenceAmount: number; // PPh Kurang / Lebih Bayar
  settlementStatus: 'NIHIL' | 'KURANG_BAYAR' | 'LEBIH_BAYAR'; // PPh Pasal 29 atau Pasal 28A
  refundOption?: 'RESTITUSI' | 'PENGEMBALIAN_PENDAHULUAN_17C' | 'PENGEMBALIAN_PENDAHULUAN_17D';

  // Angsuran PPh Pasal 25 Tahun Berikutnya
  nextYearPph25MonthlyEstimate: number;

  // Lampiran Detail
  assets: TaxAssetItem[];
  debts: TaxDebtItem[];
  dependents: TaxDependentItem[];
  withholdings: TaxWithholdingItem[];
  finalIncomes: TaxFinalIncomeItem[];
  nonTaxableIncomes: TaxNonTaxableIncomeItem[];
  foreignIncomes: TaxForeignIncomeItem[];

  // Riwayat Perubahan & Audit Trail
  auditTrail: {
    timestamp: string;
    action: string;
    changedBy: string;
    notes?: string;
  }[];
}

// Konfigurasi Standar Tarif Pajak Indonesia (UU HPP No 7 Tahun 2021)
export const TAX_CONFIG_2025 = {
  ptkpRates: {
    'TK/0': 54000000,
    'TK/1': 58500000,
    'TK/2': 63000000,
    'TK/3': 67500000,
    'K/0': 58500000,
    'K/1': 63000000,
    'K/2': 67500000,
    'K/3': 72000000,
    'K/I/0': 112500000,
    'K/I/1': 117000000,
    'K/I/2': 121500000,
    'K/I/3': 126000000,
  } as Record<PtkpStatus, number>,

  bracketsUuHpp: [
    { maxLimit: 60000000, rate: 0.05, label: '0 s.d Rp 60 Juta (5%)' },
    { maxLimit: 250000000, rate: 0.15, label: 'Diatas Rp 60 Juta s.d Rp 250 Juta (15%)' },
    { maxLimit: 500000000, rate: 0.25, label: 'Diatas Rp 250 Juta s.d Rp 500 Juta (25%)' },
    { maxLimit: 5000000000, rate: 0.30, label: 'Diatas Rp 500 Juta s.d Rp 5 Miliar (30%)' },
    { maxLimit: Infinity, rate: 0.35, label: 'Diatas Rp 5 Miliar (35%)' },
  ],

  umkmPp55Rate: 0.005, // 0.5% PPh Final
  umkmExemptThresholdOp: 500000000, // Rp 500 Juta peredaran bruto tidak kena pajak per tahun untuk OP

  // Kode Harta Resmi DJP
  djpAssetCategories: [
    { code: '011', name: 'Uang Tunai (Cash)', group: 'Kas dan Setara Kas' },
    { code: '012', name: 'Tabungan', group: 'Kas dan Setara Kas' },
    { code: '013', name: 'Giro', group: 'Kas dan Setara Kas' },
    { code: '014', name: 'Deposito', group: 'Kas dan Setara Kas' },
    { code: '019', name: 'Setara Kas Lainnya', group: 'Kas dan Setara Kas' },
    { code: '021', name: 'Piutang Dagang / Usaha', group: 'Piutang' },
    { code: '022', name: 'Piutang Afiliasi / Lainnya', group: 'Piutang' },
    { code: '031', name: 'Saham yang Diperjualbelikan di Bursa (BEI)', group: 'Investasi' },
    { code: '032', name: 'Saham Non-Bursa / Penyertaan Modal', group: 'Investasi' },
    { code: '033', name: 'Obligasi / Sukuk / Surat Utang', group: 'Investasi' },
    { code: '034', name: 'Reksadana', group: 'Investasi' },
    { code: '039', name: 'Investasi Lainnya (Crypto/Emas Batangan)', group: 'Investasi' },
    { code: '041', name: 'Sepeda Motor', group: 'Harta Bergerak' },
    { code: '042', name: 'Mobil', group: 'Harta Bergerak' },
    { code: '043', name: 'Alat Transportasi Lainnya (Perahu/Kapal)', group: 'Harta Bergerak' },
    { code: '051', name: 'Logam Mulia / Perhiasan', group: 'Harta Bergerak Lainnya' },
    { code: '052', name: 'Barang Elektronik & Mesin Percetakan', group: 'Harta Bergerak Lainnya' },
    { code: '053', name: 'Perabot Rumah Tangga', group: 'Harta Bergerak Lainnya' },
    { code: '061', name: 'Tanah dan/atau Bangunan Tempat Tinggal', group: 'Harta Tidak Bergerak' },
    { code: '062', name: 'Tanah dan/atau Bangunan Usaha / Ruko', group: 'Harta Tidak Bergerak' },
    { code: '063', name: 'Tanah Kosong / Kebun / Sawah', group: 'Harta Tidak Bergerak' },
    { code: '071', name: 'Paten / Merek Dagang / Hak Cipta', group: 'Harta Tidak Berwujud' },
    { code: '099', name: 'Harta Lainnya', group: 'Lainnya' },
  ],

  // Kode Utang Resmi DJP
  djpDebtCategories: [
    { code: '101', name: 'Utang Bank / Lembaga Keuangan Bukan Bank (Kredit Usaha/Modal Kerja)' },
    { code: '102', name: 'Kartu Kredit' },
    { code: '103', name: 'Utang Afiliasi / Pinjaman Pemegang Saham' },
    { code: '104', name: 'Utang Dagang / Supplier' },
    { code: '105', name: 'Kredit Pemilikan Rumah (KPR)' },
    { code: '106', name: 'Kredit Kendaraan Bermotor (KKB/Leasing)' },
    { code: '109', name: 'Utang Lainnya' },
  ],
};

export const TAX_CONFIG_2026 = {
  ...TAX_CONFIG_2025,
  taxYear: 2026,
};

// 10. REKAPITULASI BILLING PPh FINAL BULANAN (PP 23/2018 & PP 55/2022)
export interface MonthlyTaxBilling {
  id: string;
  year: number;
  month: number; // 1 - 12
  monthName: string; // 'Januari' .. 'Desember'
  pphFinalPaid: number; // PPh Final Disetor (Rp)
  tariffRatePercent: number; // Tarif PPh Final (contoh: 0.5% atau 1%)
  taxableBaseDpp: number; // DPP Dikenakan berdasarkan Tarif yang diinput
  grossRevenue: number; // Peredaran Bruto Bulanan (Omzet)
  cumulativeRevenue: number; // Kumulatif Omzet s.d. bulan berjalan
  billingCode?: string; // Kode Billing 15 Digit DJP
  ntpn?: string; // NTPN (Nomor Transaksi Penerimaan Negara 16 Karakter)
  paymentDate?: string; // Tanggal Bayar (YYYY-MM-DD)
  paymentBank?: string; // Bank Persepsi / Pos (Mandiri, BCA, BRI, BNI, Pos Indonesia)
  isPaid: boolean;
  notes?: string;
}

export type MonthlyBillingsByYear = Record<number, MonthlyTaxBilling[]>;
