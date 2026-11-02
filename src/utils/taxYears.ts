/**
 * Coded by Langgo Bramandityo.
 * Sumber tunggal aturan daftar tahun pajak untuk seluruh menu di tab Pajak.
 *
 * Semua layar (pemilih tahun, wizard, billing bulanan, riwayat, cetak) membaca
 * daftar ini. Tidak ada lagi angka tahun yang ditulis langsung di komponen,
 * supaya tahun yang ditambah atau dikurangi pemilik berlaku serentak.
 *
 * Berkas ini hanya mengatur nilainya (bersihkan, urutkan, simpan di perangkat
 * ini, umumkan ke layar). Pengiriman ke server ada di `taxStorage.ts`, sama
 * seperti isian pajak lain. Menghapus tahun hanya menyembunyikan tab inputnya;
 * isi SPT dan billing tahun itu tetap tersimpan dan muncul lagi saat tahunnya
 * ditambah kembali.
 */

export const STORAGE_KEY_TAX_YEARS = 'bejo_tax_years';

/** Event yang disiarkan setiap kali daftar tahun pajak berubah. */
export const TAX_YEARS_EVENT = 'bejo_tax_years_updated';

/**
 * Tahun yang tersedia saat aplikasi pertama dipakai. Ambang bebas pajak PP 55
 * berlaku sejak 2022, jadi tahun itu ikut disiapkan.
 */
export const DEFAULT_TAX_YEARS: readonly number[] = [2022, 2023, 2024, 2025, 2026, 2027, 2028];

/** Batas tahun yang boleh dipilih (tahun pajak Indonesia memakai tahun Masehi). */
export const MIN_TAX_YEAR = 2000;
export const MAX_TAX_YEAR = 2060;

/** Daftar tidak boleh membludak; layar pemilih tahun tetap terbaca. */
export const MAX_TAX_YEARS_COUNT = 30;

export const isValidTaxYear = (year: unknown): year is number =>
  typeof year === 'number' && Number.isInteger(year) && year >= MIN_TAX_YEAR && year <= MAX_TAX_YEAR;

/** Bersih, tanpa duplikat, terurut naik. Nilai tidak valid dibuang. */
export const normalizeTaxYears = (years: readonly unknown[]): number[] => {
  const unique = Array.from(
    new Set(years.filter((year): year is number => isValidTaxYear(year)))
  );
  return unique.sort((a, b) => a - b).slice(0, MAX_TAX_YEARS_COUNT);
};

/** Daftar tahun aktif (naik). Hasil selalu minimal satu tahun. */
export const getTaxYears = (): number[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TAX_YEARS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const clean = normalizeTaxYears(parsed);
        if (clean.length > 0) return clean;
      }
    }
  } catch (e) {
    console.error('Gagal membaca daftar tahun pajak', e);
  }
  const fallback = defaultTaxYearsList();
  try {
    localStorage.setItem(STORAGE_KEY_TAX_YEARS, JSON.stringify(fallback));
  } catch (e) {
    console.error('Gagal menyimpan daftar tahun pajak', e);
  }
  return fallback;
};

/** Daftar tahun aktif, terbaru lebih dulu — dipakai tombol pemilih tahun. */
export const getTaxYearsDescending = (): number[] => getTaxYears().slice().reverse();

export const latestTaxYear = (): number => {
  const years = getTaxYears();
  return years[years.length - 1];
};

/**
 * Tahun yang dipilih saat layar pertama dibuka: tahun aktif terbaru yang sudah
 * berjalan tahun ini. Bila daftar hanya berisi tahun mendatang, yang pertama dipakai.
 */
export const defaultTaxYear = (): number => {
  const years = getTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const alreadyRunning = years.filter((y) => y <= currentCalendarYear);
  return alreadyRunning.length > 0 ? alreadyRunning[alreadyRunning.length - 1] : years[0];
};

/** Label rentang, mis. "2022 - 2028"; satu tahun saja ditulis tanpa tanda hubung. */
export const formatYearRange = (years: readonly number[]): string => {
  if (years.length === 0) return '';
  if (years.length === 1) return `${years[0]}`;
  return `${years[0]} - ${years[years.length - 1]}`;
};

/** Label rentang tahun aktif untuk judul dan pesan, mis. "2022 - 2028". */
export const getTaxYearRangeLabel = (): string => formatYearRange(getTaxYears());

/** Label daftar bawaan, dipakai tombol "kembalikan ke bawaan". */
export const getDefaultTaxYearsLabel = (): string => formatYearRange(defaultTaxYearsList());

/**
 * Pasang daftar tahun pajak di perangkat ini dan umumkan ke semua layar.
 * Yang datang dari server jangan ditulis balik — pengirimannya diatur
 * `saveTaxYearsConfig` di util penyimpanan pajak, sama seperti isian pajak lain.
 */
export const writeTaxYears = (years: readonly unknown[]): number[] => {
  const clean = normalizeTaxYears(years);
  if (clean.length === 0) return getTaxYears();

  try {
    localStorage.setItem(STORAGE_KEY_TAX_YEARS, JSON.stringify(clean));
  } catch (e) {
    console.error('Gagal menyimpan daftar tahun pajak', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<number[]>(TAX_YEARS_EVENT, { detail: clean }));
  }
  return clean;
};

/**
 * Hasil sesudah menambah satu tahun: tanpa duplikat, terurut naik, dan tidak
 * melewati batas jumlah. Nilai tidak valid atau daftar penuh => tidak berubah.
 */
export const withAddedTaxYear = (
  current: readonly number[],
  year: number
): { years: number[]; added: boolean } => {
  const clean = normalizeTaxYears(current);
  if (!isValidTaxYear(year)) return { years: clean, added: false };
  if (clean.includes(year)) return { years: clean, added: false };
  if (clean.length >= MAX_TAX_YEARS_COUNT) return { years: clean, added: false };
  return { years: normalizeTaxYears([...clean, year]), added: true };
};

/**
 * Hasil sesudah mengurangi satu tahun. Tahun terakhir tidak boleh keluar supaya
 * tab input tidak hilang seluruhnya.
 */
export const withRemovedTaxYear = (
  current: readonly number[],
  year: number
): { years: number[]; removed: boolean } => {
  const clean = normalizeTaxYears(current);
  if (!clean.includes(year)) return { years: clean, removed: false };
  if (clean.length <= 1) return { years: clean, removed: false };
  return { years: clean.filter((y) => y !== year), removed: true };
};

/** Daftar bawaan, sudah terurut naik. */
export const defaultTaxYearsList = (): number[] => normalizeTaxYears(DEFAULT_TAX_YEARS);
