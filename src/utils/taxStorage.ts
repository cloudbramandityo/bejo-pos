/**
 * Coded by Langgo Bramandityo.
 * Utilitas Penyimpanan & Engine Perhitungan Pajak SPT Tahunan Orang Pribadi 2025
 * Mengacu pada UU HPP No 7/2021 & PP 55/2022
 */
import {
  TaxAnnualReturn1770,
  TaxpayerProfile,
  TAX_CONFIG_2025,
  TAX_CONFIG_2026,
  PtkpStatus,
  MonthlyTaxBilling,
  MonthlyBillingsByYear
} from '../types/tax';
import { getStoredTransactions } from './storage';
import {
  saveTaxpayerProfileCloud,
  saveAllTaxAnnualReturnsCloud,
  saveTaxMonthlyBillingsCloud
} from '../backend/pocketbaseBackend';

const STORAGE_KEY_TAXPAYER = 'bejo_taxpayer_profile';
const STORAGE_KEY_ANNUAL_RETURNS = 'bejo_annual_tax_returns';
const STORAGE_KEY_MONTHLY_BILLINGS = 'bejo_tax_monthly_billings';

// Helper: Detect whether a taxpayer profile is the legacy dummy/example profile
export const isDummyTaxpayerProfile = (p?: Partial<TaxpayerProfile> | null): boolean => {
  if (!p) return false;
  return (
    p.npwp === '09.345.678.9-521.000' ||
    p.nik === '3302198765432001' ||
    p.fullName === 'Ahmad Irdianto' ||
    p.phoneNumber === '081234567890' ||
    p.email === 'bejo@bejostiker.com' ||
    p.address === 'Jl. Raya DIwek, Jombang'
  );
};

// Default initial Taxpayer Profile - Clean and unpopulated so it NEVER mixes with real user data
export const getDefaultTaxpayerProfile = (): TaxpayerProfile => ({
  npwp: '',
  nik: '',
  fullName: '',
  idType: 'KTP',
  idNumber: '',
  phoneNumber: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  kluCode: '47611',
  kluDescription: 'Perdagangan Eceran Hasil Percetakan dan Penerbitan',
  maritalTaxStatus: 'KK',
  ptkpStatus: 'TK/0',
});
export const calculateTaxPayableUuHpp = (taxableIncome: number) => {
  let remaining = Math.max(0, Math.floor(taxableIncome / 1000) * 1000); // PKP dibulatkan ke bawah dalam ribuan rupiah
  const brackets = TAX_CONFIG_2025.bracketsUuHpp;
  let totalTax = 0;
  const breakdown: {
    bracket: string;
    ratePercent: number;
    taxableAmountInBracket: number;
    taxAmountInBracket: number;
  }[] = [];

  let previousLimit = 0;
  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const bracketSpan = bracket.maxLimit - previousLimit;
    const taxableInThisBracket = Math.min(remaining, bracketSpan);
    const taxInThisBracket = Math.round(taxableInThisBracket * bracket.rate);

    breakdown.push({
      bracket: bracket.label,
      ratePercent: bracket.rate * 100,
      taxableAmountInBracket: taxableInThisBracket,
      taxAmountInBracket: taxInThisBracket,
    });

    totalTax += taxInThisBracket;
    remaining -= taxableInThisBracket;
    previousLimit = bracket.maxLimit;
  }

  return { totalTax, breakdown };
};

// Create a new blank or templated SPT Return
export const createInitialTaxReturn = (year: number, taxpayer?: TaxpayerProfile): TaxAnnualReturn1770 => {
  const profile = taxpayer || getDefaultTaxpayerProfile();
  const ptkpAmount = TAX_CONFIG_2025.ptkpRates[profile.ptkpStatus] || 54000000;

  return {
    id: `spt-op-${year}-${Date.now()}`,
    taxYear: year,
    sptType: 'NORMAL',
    amendmentNumber: 0,
    filingStatus: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    taxpayer: profile,

    hasEmploymentIncome: false,
    hasBusinessIncome: true,
    hasOtherDomesticIncome: false,
    hasForeignIncome: false,
    hasFinalIncome: true,
    hasNonTaxableIncome: false,
    hasAssets: false,
    hasDebts: false,
    hasDependents: false,
    hasWithholdingSlips: false,

    // Employment
    employmentGrossIncome: 0,
    employmentDeductions: 0,
    employmentNetIncome: 0,

    // Business
    businessActivity: {
      hasBusinessIncome: true,
      accountingMethod: 'PENCATATAN',
      klu: profile.kluCode || '47611',
      grossRevenue: 0,
      nppnRatePercent: 20, // 20% misal norma industri percetakan
      netIncomeCalculated: 0,
      isUmkmPp55: true,
      umkmTaxExemptThreshold: 500000000,
      umkmTaxableRevenue: 0,
      umkmTaxAmount: 0,
    },

    otherDomesticNetIncome: 0,
    foreignNetIncome: 0,
    totalNetIncome: 0,

    deductions: {
      zakatOrReligiousCharity: 0,
      pastLossCarryForward: 0,
      otherAllowableDeductions: 0,
    },
    netIncomeAfterDeductions: 0,

    ptkpAmount,
    taxableIncome: 0,
    taxTariffBrackets: [],
    totalTaxPayable: 0,

    totalWithholdingCredit: 0,
    pph25PaidYearly: 0,
    stpPph25Principal: 0,
    totalTaxCredits: 0,

    taxDifferenceAmount: 0,
    settlementStatus: 'NIHIL',

    nextYearPph25MonthlyEstimate: 0,

    assets: [],
    debts: [],
    dependents: [],
    withholdings: [],
    finalIncomes: [],
    nonTaxableIncomes: [],
    foreignIncomes: [],

    auditTrail: [
      {
        timestamp: new Date().toISOString(),
        action: 'INISIASI_DRAFT',
        changedBy: profile.fullName || 'Wajib Pajak',
        notes: `Draft SPT Tahunan Orang Pribadi Tahun Pajak ${year} disiapkan`,
      },
    ],
  };
};

// Recompute all tax sums and deductions consistently
export const recomputeTaxReturn = (spt: TaxAnnualReturn1770): TaxAnnualReturn1770 => {
  const updated = { ...spt };

  // 1. Employment Net Income
  const empGross = Math.max(0, updated.employmentGrossIncome || 0);
  const empDed = Math.max(0, updated.employmentDeductions || 0);
  updated.employmentNetIncome = Math.max(0, empGross - empDed);

  // 2. Business Income
  if (updated.hasBusinessIncome) {
    if (updated.businessActivity.isUmkmPp55) {
      // UMKM PP 55/2022
      const gross = Math.max(0, updated.businessActivity.grossRevenue || 0);
      const threshold = updated.businessActivity.umkmTaxExemptThreshold || 500000000;
      const taxable = Math.max(0, gross - threshold);
      // Prefer explicit umkmTaxAmount if already set/synced from monthly billing records
      const tax = typeof updated.businessActivity.umkmTaxAmount === 'number' && updated.businessActivity.umkmTaxAmount > 0
        ? updated.businessActivity.umkmTaxAmount
        : Math.round(taxable * (TAX_CONFIG_2025.umkmPp55Rate));

      updated.businessActivity.umkmTaxableRevenue = updated.businessActivity.umkmTaxableRevenue > 0
        ? updated.businessActivity.umkmTaxableRevenue
        : (taxable > 0 ? taxable : gross);
      updated.businessActivity.umkmTaxAmount = tax;
      // UMKM PP 55 is PPh Final, so it does not add to regular progressive net income
      updated.businessActivity.netIncomeCalculated = 0;

      // Sync to final incomes table if present
      const umkmFinalIdx = updated.finalIncomes.findIndex(f => f.categoryCode === 'UMKM_PP55');
      if (umkmFinalIdx >= 0) {
        updated.finalIncomes[umkmFinalIdx].grossAmount = gross;
        updated.finalIncomes[umkmFinalIdx].finalTaxAmount = tax;
      }
    } else if (updated.businessActivity.accountingMethod === 'PENCATATAN') {
      // NPPN (Norma Penghitungan Penghasilan Neto)
      const gross = Math.max(0, updated.businessActivity.grossRevenue || 0);
      const normRate = (updated.businessActivity.nppnRatePercent || 20) / 100;
      updated.businessActivity.netIncomeCalculated = Math.round(gross * normRate);
    } else {
      // Pembukuan (Laba Bersih Usaha = Bruto - HPP - Biaya Operasional + Koreksi Positif - Koreksi Negatif)
      const gross = Math.max(0, updated.businessActivity.grossRevenue || 0);
      const cogs = Math.max(0, updated.businessActivity.cogs || 0);
      const opex = Math.max(0, updated.businessActivity.operatingExpenses || 0);
      const posCorr = Math.max(0, updated.businessActivity.positiveFiscalAdjustment || 0);
      const negCorr = Math.max(0, updated.businessActivity.negativeFiscalAdjustment || 0);
      updated.businessActivity.netIncomeCalculated = Math.max(0, (gross - cogs - opex) + posCorr - negCorr);
    }
  } else {
    updated.businessActivity.netIncomeCalculated = 0;
  }

  // 3. Total Net Income
  const empNet = updated.hasEmploymentIncome ? updated.employmentNetIncome : 0;
  const bizNet = updated.hasBusinessIncome ? updated.businessActivity.netIncomeCalculated : 0;
  const othNet = updated.hasOtherDomesticIncome ? (updated.otherDomesticNetIncome || 0) : 0;
  const forNet = updated.hasForeignIncome ? (updated.foreignNetIncome || 0) : 0;

  updated.totalNetIncome = empNet + bizNet + othNet + forNet;

  // 4. Deductions (Zakat, Kompensasi Kerugian)
  const zakat = Math.max(0, updated.deductions?.zakatOrReligiousCharity || 0);
  const lossComp = Math.max(0, updated.deductions?.pastLossCarryForward || 0);
  const otherDed = Math.max(0, updated.deductions?.otherAllowableDeductions || 0);
  const totalDeductions = zakat + lossComp + otherDed;

  updated.netIncomeAfterDeductions = Math.max(0, updated.totalNetIncome - totalDeductions);

  // 5. PTKP & PKP
  const ptkpStatus = updated.taxpayer.ptkpStatus || 'TK/0';
  updated.ptkpAmount = TAX_CONFIG_2025.ptkpRates[ptkpStatus] || 54000000;

  const rawPkp = updated.netIncomeAfterDeductions - updated.ptkpAmount;
  updated.taxableIncome = rawPkp > 0 ? Math.floor(rawPkp / 1000) * 1000 : 0;

  // 6. Tax Payable (Pasal 17 UU HPP)
  const { totalTax, breakdown } = calculateTaxPayableUuHpp(updated.taxableIncome);
  updated.taxTariffBrackets = breakdown;
  updated.totalTaxPayable = totalTax;

  // 7. Tax Credits (Kredit Pajak Pemotongan PPh 21, 22, 23, 24)
  const withholdingCredit = updated.withholdings.reduce((sum, item) => sum + (item.withheldTaxAmount || 0), 0);
  updated.totalWithholdingCredit = withholdingCredit;

  const pph25Paid = Math.max(0, updated.pph25PaidYearly || 0);
  const stp25 = Math.max(0, updated.stpPph25Principal || 0);
  updated.totalTaxCredits = withholdingCredit + pph25Paid + stp25;

  // 8. Tax Settlement Difference (Pasal 28A / 29)
  const diff = updated.totalTaxPayable - updated.totalTaxCredits;
  updated.taxDifferenceAmount = Math.abs(diff);

  if (diff > 0) {
    updated.settlementStatus = 'KURANG_BAYAR'; // PPh Pasal 29
  } else if (diff < 0) {
    updated.settlementStatus = 'LEBIH_BAYAR'; // PPh Pasal 28A
  } else {
    updated.settlementStatus = 'NIHIL';
  }

  // 9. Next Year Pasal 25 Monthly Estimate
  // Dasar perhitungan: (PPh Terutang - Kredit PPh 21/22/23/24) / 12
  const netPayableForPph25 = Math.max(0, updated.totalTaxPayable - updated.totalWithholdingCredit);
  updated.nextYearPph25MonthlyEstimate = Math.round(netPayableForPph25 / 12);

  updated.updatedAt = new Date().toISOString();
  return updated;
};

// Storage Helpers
export const getStoredTaxpayerProfile = (): TaxpayerProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TAXPAYER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (isDummyTaxpayerProfile(parsed)) {
          // Immediately purge legacy dummy profile so it never contaminates user input
          const clean = getDefaultTaxpayerProfile();
          saveStoredTaxpayerProfile(clean);
          return clean;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse stored taxpayer profile', e);
  }
  return getDefaultTaxpayerProfile();
};

export const saveStoredTaxpayerProfile = (profile: TaxpayerProfile): void => {
  try {
    localStorage.setItem(STORAGE_KEY_TAXPAYER, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save taxpayer profile', e);
  }
  // Realtime Cloud PocketBase persistence & cross-tab / user update broadcast
  saveTaxpayerProfileCloud(profile).catch((err) => console.error('[Tax Cloud] Error saving taxpayer profile:', err));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bejo_taxpayer_profile_updated', { detail: profile }));
  }
};

// Note: getStoredAnnualReturns and saveStoredAnnualReturns are defined below with billing sync helpers.

// -------------------------------------------------------------
// MONTHLY TAX BILLING (PPh Final PP 23/2018 & PP 55/2022)
// -------------------------------------------------------------

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Recomputes monthly billing for a year:
 * - If PPh Final Disetor is entered and rate is provided:
 *   DPP = PPh Final Disetor / (Tarif / 100)
 *   Peredaran Bruto = DPP
 * - Calculates Kumulatif Omzet (Running Cumulative Sum)
 */
export const recomputeMonthlyBillingYear = (items: MonthlyTaxBilling[]): MonthlyTaxBilling[] => {
  let runningCumulative = 0;
  return items.map((item) => {
    const tariff = typeof item.tariffRatePercent === 'number' && item.tariffRatePercent > 0
      ? item.tariffRatePercent
      : 0.5;

    let pph = Number(item.pphFinalPaid) || 0;
    let dpp = Number(item.taxableBaseDpp) || 0;
    let gross = Number(item.grossRevenue) || 0;

    // Intelligent auto-calculation
    if (pph > 0) {
      dpp = Math.round(pph / (tariff / 100));
      if (!gross || gross === 0) {
        gross = dpp;
      }
    } else if (gross > 0) {
      dpp = gross;
      pph = Math.round(dpp * (tariff / 100));
    }

    runningCumulative += gross;

    return {
      ...item,
      pphFinalPaid: pph,
      tariffRatePercent: tariff,
      taxableBaseDpp: dpp,
      grossRevenue: gross,
      cumulativeRevenue: runningCumulative,
    };
  });
};

/**
 * Generate clean default template for monthly billing 2023, 2024, 2025, 2026
 * Entirely clean without any dummy data or pre-filled seed amounts
 */
export const generateDefaultMonthlyBillings = (): MonthlyBillingsByYear => {
  const createEmptyYearList = (year: number) => {
    const rawList: MonthlyTaxBilling[] = MONTH_NAMES.map((monthName, idx) => {
      const monthNum = idx + 1;
      return {
        id: `billing-${year}-${monthNum}`,
        year,
        month: monthNum,
        monthName,
        pphFinalPaid: 0,
        tariffRatePercent: 0.5,
        taxableBaseDpp: 0,
        grossRevenue: 0,
        cumulativeRevenue: 0,
        billingCode: '',
        ntpn: '',
        paymentDate: '',
        paymentBank: '',
        isPaid: false,
        notes: '',
      };
    });

    return recomputeMonthlyBillingYear(rawList);
  };

  return {
    2023: createEmptyYearList(2023),
    2024: createEmptyYearList(2024),
    2025: createEmptyYearList(2025),
    2026: createEmptyYearList(2026),
  };
};

export const getStoredMonthlyBillings = (): MonthlyBillingsByYear => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MONTHLY_BILLINGS);
    if (raw) {
      const parsed: MonthlyBillingsByYear = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const result: MonthlyBillingsByYear = {};
        for (const yearStr of Object.keys(parsed)) {
          const y = Number(yearStr);
          // Purge any dummy seed billings (matching generated pattern from previous seeds)
          const cleanedList = (parsed[y] || []).map(b => {
            const isDummyNtpn = typeof b.ntpn === 'string' && /^[0-9]{4}A[0-9A-F]+9B1$/.test(b.ntpn);
            const isDummyCode = typeof b.billingCode === 'string' && /^09345(2023|2024|2025|2026)[0-9]{4}$/.test(b.billingCode);
            if (isDummyNtpn || isDummyCode) {
              return {
                ...b,
                pphFinalPaid: 0,
                taxableBaseDpp: 0,
                grossRevenue: 0,
                cumulativeRevenue: 0,
                billingCode: '',
                ntpn: '',
                paymentDate: '',
                paymentBank: '',
                isPaid: false,
                notes: '',
              };
            }
            return b;
          });
          result[y] = recomputeMonthlyBillingYear(cleanedList);
        }
        // Ensure 2023, 2024, 2025, and 2026 exist
        const defaults = generateDefaultMonthlyBillings();
        for (const yr of [2023, 2024, 2025, 2026]) {
          if (!result[yr] || !Array.isArray(result[yr]) || result[yr].length === 0) {
            result[yr] = defaults[yr];
          }
        }
        return result;
      }
    }
  } catch (e) {
    console.error('Failed to parse stored monthly billings', e);
  }

  const initial = generateDefaultMonthlyBillings();
  saveStoredMonthlyBillings(initial);
  return initial;
};

export const saveStoredMonthlyBillings = (data: MonthlyBillingsByYear): void => {
  try {
    localStorage.setItem(STORAGE_KEY_MONTHLY_BILLINGS, JSON.stringify(data));
    // Auto-sync stored annual returns so they are never out of sync with Riwayat Pelaporan
    const rawReturns = localStorage.getItem(STORAGE_KEY_ANNUAL_RETURNS);
    if (rawReturns) {
      const parsed: TaxAnnualReturn1770[] = JSON.parse(rawReturns);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const synced = parsed.map((r) => syncReturnWithMonthlyBillings(r, data));
        localStorage.setItem(STORAGE_KEY_ANNUAL_RETURNS, JSON.stringify(synced));
        saveAllTaxAnnualReturnsCloud(synced).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Failed to save monthly billings', e);
  }
  // Realtime Cloud PocketBase persistence
  saveTaxMonthlyBillingsCloud(data).catch((err) => console.error('[Tax Cloud] Error saving monthly billings:', err));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bejo_tax_monthly_billings_updated', { detail: data }));
  }
};

/**
 * Synchronize an annual return (Formulir 1770) with the monthly billing records from Riwayat Pelaporan
 * - Aligns gross revenue, DPP, and PPh Final disetor
 * - Updates finalIncomes (UMKM PP 55) and audit trail
 */
export const syncReturnWithMonthlyBillings = (
  ret: TaxAnnualReturn1770,
  billingsByYear?: MonthlyBillingsByYear
): TaxAnnualReturn1770 => {
  const billings = billingsByYear || getStoredMonthlyBillings();
  const yearBillings = billings[ret.taxYear] || [];

  const totalGross = yearBillings.reduce((sum, item) => sum + (item.grossRevenue || 0), 0);
  const totalPphPaid = yearBillings.reduce((sum, item) => sum + (item.pphFinalPaid || 0), 0);
  const totalDpp = yearBillings.reduce((sum, item) => sum + (item.taxableBaseDpp || 0), 0);

  const updatedFinalIncomes = [...(ret.finalIncomes || [])];
  const pp55Idx = updatedFinalIncomes.findIndex(f => f.categoryCode === 'UMKM_PP55');
  if (pp55Idx >= 0) {
    updatedFinalIncomes[pp55Idx] = {
      ...updatedFinalIncomes[pp55Idx],
      grossAmount: totalGross,
      finalTaxAmount: totalPphPaid,
      taxRatePercent: 0.5,
    };
  } else {
    updatedFinalIncomes.push({
      id: `fin-umkm-${ret.taxYear}`,
      categoryCode: 'UMKM_PP55',
      description: 'Peredaran Usaha Percetakan UMKM (PP 55/2022 tarif 0.5%)',
      grossAmount: totalGross,
      taxRatePercent: 0.5,
      finalTaxAmount: totalPphPaid,
    });
  }

  const updated: TaxAnnualReturn1770 = {
    ...ret,
    hasBusinessIncome: true,
    hasFinalIncome: true,
    businessActivity: {
      ...ret.businessActivity,
      hasBusinessIncome: true,
      isUmkmPp55: true,
      grossRevenue: totalGross,
      umkmTaxExemptThreshold: 500000000,
      umkmTaxableRevenue: totalDpp > 0 ? totalDpp : totalGross,
      umkmTaxAmount: totalPphPaid,
    },
    finalIncomes: updatedFinalIncomes,
  };

  return recomputeTaxReturn(updated);
};

/**
 * Synchronize an array of annual returns with monthly billings
 */
export const syncAllReturnsWithMonthlyBillings = (
  returns: TaxAnnualReturn1770[],
  billingsByYear?: MonthlyBillingsByYear
): TaxAnnualReturn1770[] => {
  const billings = billingsByYear || getStoredMonthlyBillings();
  return returns.map(r => syncReturnWithMonthlyBillings(r, billings));
};

export const getStoredAnnualReturns = (): TaxAnnualReturn1770[] => {
  const billings = getStoredMonthlyBillings();
  const currentProfile = getStoredTaxpayerProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANNUAL_RETURNS);
    if (raw) {
      const parsed: TaxAnnualReturn1770[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let list = parsed.map(r => {
          // Purge dummy taxpayer info if found so it never contaminates user input
          const taxpayerToUse = isDummyTaxpayerProfile(r.taxpayer) ? currentProfile : (r.taxpayer || currentProfile);

          // Purge any lingering dummy assets from previous initial seeds
          const cleanAssets = (r.assets || []).filter(a =>
            a.id !== 'asset-1' && a.id !== 'asset-2' && a.id !== 'asset-3' &&
            !a.id?.startsWith('dummy-') &&
            !a.name?.toLowerCase().includes('roland') &&
            !a.name?.toLowerCase().includes('granmax') &&
            !a.name?.toLowerCase().includes('operasional toko bejo')
          );
          // Purge any lingering dummy debts from previous initial seeds
          const cleanDebts = (r.debts || []).filter(d =>
            d.id !== 'debt-1' &&
            !d.id?.startsWith('dummy-') &&
            !d.lenderName?.toLowerCase().includes('kredit modal kerja')
          );
          // Purge any lingering dummy dependents from previous initial seeds
          const cleanDependents = (r.dependents || []).filter(dep =>
            dep.id !== 'dep-1' && dep.id !== 'dep-2' &&
            !dep.id?.startsWith('dummy-') &&
            dep.fullName !== 'Istri Tercinta' && dep.fullName !== 'Anak Pratama'
          );
          // Purge any lingering dummy withholdings
          const cleanWithholdings = (r.withholdings || []).filter(w =>
            !w.id?.startsWith('dummy-') &&
            w.withholderName !== 'PT Percetakan Nusantara'
          );

          return {
            ...r,
            taxpayer: taxpayerToUse,
            assets: cleanAssets,
            hasAssets: cleanAssets.length > 0,
            debts: cleanDebts,
            hasDebts: cleanDebts.length > 0,
            dependents: cleanDependents,
            hasDependents: cleanDependents.length > 0,
            withholdings: cleanWithholdings,
            hasWithholdingSlips: cleanWithholdings.length > 0,
          };
        });

        for (const yr of [2026, 2025, 2024, 2023]) {
          if (!list.some(r => r.taxYear === yr)) {
            list.push(createInitialTaxReturn(yr, currentProfile));
          }
        }
        list.sort((a, b) => b.taxYear - a.taxYear);
        const syncedList = syncAllReturnsWithMonthlyBillings(list, billings);
        saveStoredAnnualReturns(syncedList);
        return syncedList;
      }
    }
  } catch (e) {
    console.error('Failed to parse stored annual tax returns', e);
  }

  // Default clean seed with 2026, 2025, 2024, and 2023 returns, fully synced with Riwayat Pelaporan
  const defaultReturns = syncAllReturnsWithMonthlyBillings([
    createInitialTaxReturn(2026, currentProfile),
    createInitialTaxReturn(2025, currentProfile),
    createInitialTaxReturn(2024, currentProfile),
    createInitialTaxReturn(2023, currentProfile),
  ], billings);
  saveStoredAnnualReturns(defaultReturns);
  return defaultReturns;
};

export const saveStoredAnnualReturns = (returns: TaxAnnualReturn1770[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_ANNUAL_RETURNS, JSON.stringify(returns));
  } catch (e) {
    console.error('Failed to save annual tax returns', e);
  }
};

/**
 * Hard reset/clean function to completely purge any dummy artifacts from Tax data in localStorage
 */
export const clearAllDummyTaxData = (): { billings: MonthlyBillingsByYear; returns: TaxAnnualReturn1770[]; taxpayer: TaxpayerProfile } => {
  const cleanProfile = getDefaultTaxpayerProfile();
  saveStoredTaxpayerProfile(cleanProfile);

  const cleanBillings = generateDefaultMonthlyBillings();
  saveStoredMonthlyBillings(cleanBillings);

  const cleanReturns = syncAllReturnsWithMonthlyBillings([
    createInitialTaxReturn(2026, cleanProfile),
    createInitialTaxReturn(2025, cleanProfile),
    createInitialTaxReturn(2024, cleanProfile),
    createInitialTaxReturn(2023, cleanProfile),
  ], cleanBillings);
  saveStoredAnnualReturns(cleanReturns);

  return { billings: cleanBillings, returns: cleanReturns, taxpayer: cleanProfile };
};

/**
 * Helper: Import actual turnover per month directly from real store POS transactions (if available)
 */
export const importBillingsFromPosTransactions = (year: number): MonthlyTaxBilling[] => {
  const transactions = getStoredTransactions();
  // Filter for transactions belonging to the requested year
  const yearTx = transactions.filter(t => {
    if (!t.date) return false;
    const y = parseInt(t.date.slice(0, 4), 10);
    return y === year;
  });

  const rawList: MonthlyTaxBilling[] = MONTH_NAMES.map((monthName, idx) => {
    const monthNum = idx + 1;
    const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
    const monthTransactions = yearTx.filter(t => t.date && t.date.slice(5, 7) === monthStr);
    const monthGross = monthTransactions.reduce((sum, t) => sum + (t.total || 0), 0);

    return {
      id: `billing-${year}-${monthNum}`,
      year,
      month: monthNum,
      monthName,
      pphFinalPaid: 0,
      tariffRatePercent: 0.5,
      taxableBaseDpp: 0,
      grossRevenue: monthGross,
      cumulativeRevenue: 0,
      billingCode: '',
      ntpn: '',
      paymentDate: '',
      paymentBank: '',
      isPaid: false,
      notes: monthGross > 0 ? `Sinkronisasi omzet riil dari ${monthTransactions.length} transaksi kasir Toko Bejo` : '',
    };
  });

  return recomputeMonthlyBillingYear(rawList);
};

