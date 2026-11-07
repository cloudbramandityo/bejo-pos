/**
 * Mesin hitung billing PPh Final bulanan — aturan murni, tanpa koneksi server.
 *
 * Berkas ini tidak boleh menggantung ke modul koneksi server supaya penjaga
 * (`npm run check:tax-years`) dapat menjalankan perhitungannya langsung.
 * Penyimpanan dan pengiriman ke server tetap ada di `taxStorage.ts`.
 */
import {
  MonthlyTaxBilling,
  MonthlyBillingsByYear,
  DppBasisMode,
  normalizeDppBasisMode,
  dppBasisModeOfYear,
  exemptThresholdForMode,
  TAX_CONFIG_2025
} from '../types/tax';

/** Tarif PPh Final bawaan aplikasi, dalam persen — dibaca dari konfigurasi pajak. */
export const DEFAULT_TARIFF_PERCENT = TAX_CONFIG_2025.umkmPp55Rate * 100;

/**
 * Hitung ulang billing satu tahun:
 * - Bila PPh Final Disetor yang diinput: DPP = PPh / (Tarif / 100) dan
 *   Peredaran Bruto ikut diisi bila masih kosong.
 * - Bila hanya Peredaran Bruto yang diinput, dasar DPP ikut mode di baris itu:
 *   BRUTO_PENUH     -> DPP = Peredaran Bruto, PPh = Bruto x (Tarif / 100)
 *   AMBANG_500_JUTA -> PP 55/2022: hanya omzet kumulatif di atas ambang Rp 500 juta
 * - Kumulatif Omzet selalu dihitung berjalan dari Januari.
 *
 * Baris yang tidak membawa tarif memakai `fallbackTariffPercent`. Pemanggil yang
 * tahu bulan itu milik entitas yang tidak memakai PPh Final mengirim `null`:
 * pajaknya tetap nol, bukan dihitung dengan tarif entitas lain.
 */
export const recomputeMonthlyBillingYear = (
  items: MonthlyTaxBilling[],
  fallbackTariffPercent: number | null = DEFAULT_TARIFF_PERCENT
): MonthlyTaxBilling[] => {
  let runningCumulative = 0;
  return items.map((item) => {
    // Tarif 0 yang tersimpan adalah nilai sah (bulan PT/rezim tanpa PPh Final),
    // bukan "belum diisi" — hanya nilai yang tidak ada yang memakai fallback.
    const tariff = typeof item.tariffRatePercent === 'number' &&
      Number.isFinite(item.tariffRatePercent) && item.tariffRatePercent >= 0
      ? item.tariffRatePercent
      : (fallbackTariffPercent ?? 0);
    const mode = normalizeDppBasisMode(item.dppBasisMode);

    let pph = Number(item.pphFinalPaid) || 0;
    let dpp = Number(item.taxableBaseDpp) || 0;
    let gross = Number(item.grossRevenue) || 0;

    if (pph > 0 && tariff > 0) {
      // Tarif 0 dengan PPh terisi tidak bisa dibalik menjadi DPP (pembagian nol);
      // DPP yang sudah tercatat dipertahankan, bukan dijadikan Infinity.
      dpp = Math.round(pph / (tariff / 100));
      if (!gross || gross === 0) {
        gross = dpp;
      }
    }

    const cumulativeBefore = runningCumulative;
    runningCumulative += gross;

    if (pph <= 0 && gross > 0) {
      if (mode === 'BRUTO_PENUH') {
        dpp = gross;
        pph = Math.round(gross * (tariff / 100));
      } else {
        // PP 55/2022: omzet s.d. Rp 500 juta/tahun tidak dikenai PPh Final.
        const exemptThreshold = exemptThresholdForMode(mode);
        const cumulativeTaxable = Math.max(0, runningCumulative - exemptThreshold);
        const previousTaxable = Math.max(0, cumulativeBefore - exemptThreshold);
        const monthlyTaxable = Math.max(0, cumulativeTaxable - previousTaxable);
        dpp = Math.round(monthlyTaxable);
        pph = Math.round(monthlyTaxable * (tariff / 100));
      }
    }

    return {
      ...item,
      pphFinalPaid: pph,
      tariffRatePercent: tariff,
      taxableBaseDpp: dpp,
      grossRevenue: gross,
      cumulativeRevenue: runningCumulative,
      dppBasisMode: mode,
    };
  });
};

/** Mode yang berlaku untuk satu tahun billing; tahun tanpa catatan memakai bawaan. */
export const getYearDppBasisMode = (
  billingsByYear: MonthlyBillingsByYear,
  year: number
): DppBasisMode => dppBasisModeOfYear(billingsByYear[year]);

/**
 * Ganti dasar DPP untuk seluruh bulan satu tahun lalu hitung ulang.
 * Mode tersimpan di baris billing, jadi ia ikut terkirim ke server dan muncul di
 * perangkat lain tanpa menambah kolom baru.
 *
 * PPh dan DPP hasil hitungan sebelumnya dibuang bila Peredaran Bruto bulan itu
 * terisi. Tanpa itu, angka yang tadi dihitung otomatis terbaca seperti input
 * manual dan pergantian dasar tidak pernah mengubah apa pun.
 */
export const setYearDppBasisMode = (
  billingsByYear: MonthlyBillingsByYear,
  year: number,
  mode: DppBasisMode
): MonthlyBillingsByYear => {
  const cleanMode = normalizeDppBasisMode(mode);
  const list = (billingsByYear[year] || []).map((item) => {
    const gross = Number(item.grossRevenue) || 0;
    return {
      ...item,
      dppBasisMode: cleanMode,
      pphFinalPaid: gross > 0 ? 0 : Number(item.pphFinalPaid) || 0,
      taxableBaseDpp: 0,
    };
  });
  return { ...billingsByYear, [year]: recomputeMonthlyBillingYear(list) };
};
