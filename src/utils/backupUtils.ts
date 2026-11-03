/**
 * Backup and Export/Import Utilities for BEJO POS
 * Coded by Langgo Bramandityo.
 *
 * Isi berkas cadangan tidak ditulis di sini: semuanya dibaca dari daftar domain
 * di `./backupDomains`. Menambah data baru cukup satu entri di daftar itu plus
 * satu akses di `DOMAIN_ACCESS` di bawah — penjaga `npm run check:backup`
 * menggagalkan build kalau salah satu dari keduanya lupa dipasang.
 *
 * Akun login staf (nama masuk, kata sandi, foto profil, flag wajib ganti sandi)
 * tidak ikut dicadangkan dan tidak ikut dipulihkan.
 */
import {
  getStoredProducts,
  saveStoredProducts,
  getStoredCustomers,
  saveStoredCustomers,
  getStoredSuppliers,
  saveStoredSuppliers,
  getStoredAgents,
  saveStoredAgents,
  getStoredCategories,
  saveStoredCategories,
  getStoredProductCategories,
  saveStoredProductCategories,
  getStoredTransactions,
  saveStoredTransactions,
  getStoredShifts,
  saveStoredShifts,
  getStoredActiveShift,
  saveStoredActiveShift,
  getStoredStockTransactions,
  saveStoredStockTransactions,
  getStoredAssetAdjustments,
  saveStoredAssetAdjustments,
  getStoredStoreInfo,
  saveStoredStoreInfo,
  getStoredCashiers,
  saveStoredCashiers,
  getStoredActivityLogs,
  saveStoredActivityLogs,
  getStoredDefaultLogo,
  saveStoredDefaultLogo,
  getStoredSpkOrders,
  saveStoredSpkOrders,
  getStoredMachines,
  saveStoredMachines,
  getStoredStoreProfiles,
  saveStoredStoreProfiles,
  getStoredActiveProfileId,
  saveStoredActiveProfileId,
  getStoredCustomRoles,
  saveStoredCustomRoles,
  getStoredPrintSettings,
  saveStoredPrintSettings,
  getStoredAiChatMessages,
  saveStoredAiChatMessages,
  getStoredUserMentions,
  saveStoredUserMentions,
  getStoredPrintingRejects,
  saveStoredPrintingRejects,
  getStoredAiSettings,
  saveStoredAiSettings
} from './storage';
import {
  getStoredInvoices,
  saveStoredInvoices,
  getStoredInvoiceStoreIdentity,
  saveStoredInvoiceStoreIdentity
} from './invoiceStorage';
import {
  getStoredLandingConfig,
  saveStoredLandingConfig,
  getStoredLandingDraft,
  saveStoredLandingDraft
} from './landingPageStorage';
import { getStoredOpenAccountConfigs, saveStoredOpenAccountConfigs } from './openAccountStorage';
import { getStoredFinancialSettings, saveStoredFinancialSettings } from './financialStorage';
import { getStoredReconciliationRuns, saveStoredReconciliationRuns } from './reconciliationStorage';
import {
  getStoredTaxpayerProfile,
  saveStoredTaxpayerProfile,
  getStoredMonthlyBillings,
  saveStoredMonthlyBillings,
  getStoredAnnualReturns,
  saveStoredAnnualReturns
} from './taxStorage';
import { getTaxYears, writeTaxYears } from './taxYears';
import { getEntityRegistry, writeEntityRegistry } from './entityRegistry';
import { getAccountChart, writeAccountChart } from './accountChart';
import { getLedgerEntries, writeLedgerEntries } from './ledgerStorage';
import {
  testPocketBaseConnection,
  saveProductCloud,
  saveProductCategoryCloud,
  saveCustomerCloud,
  saveCustomerCategoryCloud,
  saveTransactionCloud,
  saveShiftCloud,
  saveStoreInfoCloud,
  saveStoreProfileCloud,
  saveActiveStoreProfileIdCloud,
  saveCustomRoleCloud,
  saveActiveShiftCloud,
  saveCashierCloud,
  saveStockTransactionCloud,
  saveAssetAdjustmentCloud,
  saveSupplierCloud,
  saveAgentCloud,
  saveActivityLogCloud,
  saveSpkOrderCloud,
  saveMachineCloud,
  saveInvoiceCloud,
  saveInvoiceStoreIdentityCloud,
  saveLandingConfigCloud,
  saveLandingDraftCloud,
  savePrintingRejectCloud,
  saveAiChatMessageCloud,
  saveUserMentionCloud,
  saveReconciliationRunCloud,
  saveTaxpayerProfileCloud,
  saveTaxAnnualReturnCloud,
  saveTaxMonthlyBillingsCloud,
  saveTaxYearsCloud,
  saveEntityRegistryCloud,
  saveAccountChartCloud,
  saveLedgerEntryCloud
} from '../backend/pocketbaseBackend';
import { BACKUP_DOMAINS, countBackupDomainValue } from './backupDomains';
import { aggregateAdjustment } from './assetAdjustments';
import { currentStoreAssetValue } from './assetTrend';

/**
 * Pembaca, pemulih, dan pengirim satu domain.
 * `read` membaca salinan di perangkat ini, `restore` menulisnya kembali,
 * `cloud` mengirimnya ke server (hanya untuk domain yang punya jalur tulis).
 */
interface DomainAccess {
  read: () => any;
  restore: (value: any) => void;
  cloud?: (value: any) => Promise<void>;
}

const DOMAIN_ACCESS: Record<string, DomainAccess> = {
  storeInfo: {
    read: getStoredStoreInfo,
    restore: (value) => saveStoredStoreInfo(value),
    cloud: (value) => saveStoreInfoCloud(value),
  },
  defaultLogo: {
    read: getStoredDefaultLogo,
    restore: (value) => saveStoredDefaultLogo(String(value || '')),
  },
  storeProfiles: {
    read: getStoredStoreProfiles,
    restore: (value) => saveStoredStoreProfiles(value),
    cloud: (value) => saveStoreProfileCloud(value),
  },
  activeProfileId: {
    read: getStoredActiveProfileId,
    restore: (value) => saveStoredActiveProfileId(String(value || '')),
    cloud: (value) => saveActiveStoreProfileIdCloud(String(value || '')),
  },

  productCategories: {
    read: getStoredProductCategories,
    restore: (value) => saveStoredProductCategories(value),
    cloud: (value) => saveProductCategoryCloud(value),
  },
  products: {
    read: getStoredProducts,
    restore: (value) => saveStoredProducts(value),
    cloud: (value) => saveProductCloud(value),
  },

  customerCategories: {
    read: getStoredCategories,
    restore: (value) => saveStoredCategories(value),
    cloud: (value) => saveCustomerCategoryCloud(value),
  },
  customers: {
    read: getStoredCustomers,
    restore: (value) => saveStoredCustomers(value),
    cloud: (value) => saveCustomerCloud(value),
  },
  openAccountConfigs: {
    read: getStoredOpenAccountConfigs,
    restore: (value) => saveStoredOpenAccountConfigs(value),
  },
  suppliers: {
    read: getStoredSuppliers,
    restore: (value) => saveStoredSuppliers(value),
    cloud: (value) => saveSupplierCloud(value),
  },
  agents: {
    read: getStoredAgents,
    restore: (value) => saveStoredAgents(value),
    cloud: (value) => saveAgentCloud(value),
  },

  transactions: {
    read: getStoredTransactions,
    restore: (value) => saveStoredTransactions(value),
    cloud: (value) => saveTransactionCloud(value),
  },
  shifts: {
    read: getStoredShifts,
    restore: (value) => saveStoredShifts(value),
    cloud: (value) => saveShiftCloud(value),
  },
  activeShift: {
    read: getStoredActiveShift,
    restore: (value) => saveStoredActiveShift(value ?? null),
    cloud: (value) => saveActiveShiftCloud(value ?? null),
  },
  cashiers: {
    read: getStoredCashiers,
    restore: (value) => saveStoredCashiers(value),
    cloud: (value) => saveCashierCloud(value),
  },

  stockTransactions: {
    read: getStoredStockTransactions,
    restore: (value) => saveStoredStockTransactions(value),
    cloud: (value) => saveStockTransactionCloud(value),
  },
  assetAdjustments: {
    read: getStoredAssetAdjustments,
    restore: (value) => saveStoredAssetAdjustments(value),
    cloud: (value) => saveAssetAdjustmentCloud(value),
  },

  spkOrders: {
    read: getStoredSpkOrders,
    restore: (value) => saveStoredSpkOrders(value),
    cloud: (value) => saveSpkOrderCloud(value),
  },
  machines: {
    read: getStoredMachines,
    restore: (value) => saveStoredMachines(value),
    cloud: (value) => saveMachineCloud(value),
  },
  printingRejects: {
    read: getStoredPrintingRejects,
    restore: (value) => saveStoredPrintingRejects(value),
    cloud: (value) => savePrintingRejectCloud(value),
  },
  printSettings: {
    read: getStoredPrintSettings,
    restore: (value) => saveStoredPrintSettings(value),
  },

  invoices: {
    read: getStoredInvoices,
    restore: (value) => saveStoredInvoices(value),
    cloud: (value) => saveInvoiceCloud(value),
  },
  invoiceStoreIdentity: {
    read: getStoredInvoiceStoreIdentity,
    restore: (value) => saveStoredInvoiceStoreIdentity(value),
    cloud: (value) => saveInvoiceStoreIdentityCloud(value),
  },

  taxpayerProfile: {
    read: getStoredTaxpayerProfile,
    restore: (value) => saveStoredTaxpayerProfile(value, true),
    cloud: (value) => saveTaxpayerProfileCloud(value),
  },
  taxYears: {
    read: getTaxYears,
    restore: (value) => writeTaxYears(Array.isArray(value) ? value : []),
    cloud: (value) => saveTaxYearsCloud({ years: value, updatedAt: Date.now() }),
  },
  taxMonthlyBillings: {
    read: getStoredMonthlyBillings,
    restore: (value) => saveStoredMonthlyBillings(value, true),
    cloud: (value) => saveTaxMonthlyBillingsCloud(value),
  },
  taxAnnualReturns: {
    read: getStoredAnnualReturns,
    restore: (value) => saveStoredAnnualReturns(value),
    cloud: (value) => saveTaxAnnualReturnCloud(value),
  },

  reconciliationRuns: {
    read: getStoredReconciliationRuns,
    restore: (value) => saveStoredReconciliationRuns(value),
    cloud: (value) => saveReconciliationRunCloud(value),
  },
  entityRegistry: {
    read: getEntityRegistry,
    restore: (value) => writeEntityRegistry(value),
    cloud: (value) => saveEntityRegistryCloud(value),
  },
  accountChart: {
    read: getAccountChart,
    restore: (value) => writeAccountChart(value),
    cloud: (value) => saveAccountChartCloud(value),
  },
  ledgerEntries: {
    read: getLedgerEntries,
    restore: (value) => writeLedgerEntries(Array.isArray(value) ? value : []),
    cloud: (value) => saveLedgerEntryCloud(value),
  },
  financialSettings: {
    read: getStoredFinancialSettings,
    restore: (value) => saveStoredFinancialSettings(value),
  },
  activityLogs: {
    read: getStoredActivityLogs,
    restore: (value) => saveStoredActivityLogs(value),
    cloud: (value) => saveActivityLogCloud(value),
  },

  landingConfig: {
    read: getStoredLandingConfig,
    restore: (value) => saveStoredLandingConfig(value),
    cloud: (value) => saveLandingConfigCloud(value),
  },
  landingDraft: {
    read: getStoredLandingDraft,
    restore: (value) => saveStoredLandingDraft(value),
    cloud: (value) => saveLandingDraftCloud(value),
  },

  customRoles: {
    read: getStoredCustomRoles,
    restore: (value) => saveStoredCustomRoles(value),
    cloud: (value) => saveCustomRoleCloud(value),
  },
  aiSettings: {
    read: getStoredAiSettings,
    restore: (value) => saveStoredAiSettings(value),
  },
  aiChatMessages: {
    read: getStoredAiChatMessages,
    restore: (value) => saveStoredAiChatMessages(value),
    cloud: (value) => saveAiChatMessageCloud(value),
  },
  userMentions: {
    read: getStoredUserMentions,
    restore: (value) => saveStoredUserMentions(value),
    cloud: (value) => saveUserMentionCloud(value),
  },
};

/** Nilai domain dianggap ikut dipulihkan bila bentuknya cocok dengan daftarnya. */
function domainHasValue(domain: (typeof BACKUP_DOMAINS)[number], value: any): boolean {
  if (value === undefined) return false;
  if (value === null) return domain.allowsNull === true;
  if (domain.shape === 'array') return Array.isArray(value);
  if (domain.shape === 'object') return typeof value === 'object';
  return value !== '';
}

export interface PosBackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  timestamp: number;
  storeName: string;
  summary: {
    /** Jumlah baris/nilai di seluruh domain yang terbaca dari perangkat. */
    totalRecords: number;
    /** Kunci domain -> jumlah isinya. */
    counts: Record<string, number>;
  };
  data: Record<string, any>;
}

export interface BackupDomainCount {
  key: string;
  label: string;
  group: string;
  count: number;
}

export interface BackupCloudRestoreProgress {
  step: string;
  processed: number;
  total: number;
  overallProcessed: number;
  overallTotal: number;
}

export interface BackupCloudRestoreResult {
  success: boolean;
  totalRecords: number;
  syncedRecords: number;
  failedRecords: number;
  /** True hanya bila kegagalan berpotensi hilang saat dicoba ulang (jaringan/5xx). */
  retryable: boolean;
  errors: string[];
}

/**
 * Builds the complete offline backup payload object
 */
export function generateBackupPayload(): PosBackupPayload {
  const data: Record<string, any> = {};
  const counts: Record<string, number> = {};
  let totalRecords = 0;

  for (const domain of BACKUP_DOMAINS) {
    const value = DOMAIN_ACCESS[domain.key]?.read();
    data[domain.key] = value;
    const count = countBackupDomainValue(domain.shape, value);
    counts[domain.key] = count;
    totalRecords += count;
  }

  const now = new Date();

  return {
    app: 'BEJO Digital Print & INVENTORY',
    version: '3.0.0',
    exportedAt: now.toISOString(),
    timestamp: now.getTime(),
    storeName: data.storeInfo?.storeName || 'BEJO Digital Print',
    summary: { totalRecords, counts },
    data,
  };
}

/**
 * Jumlah isi per domain untuk pratinjau pemulihan. Berkas lama belum menyimpan
 * ringkasan ini, jadi angkanya dihitung dari isinya.
 */
export function payloadDomainCounts(payload: PosBackupPayload | null): BackupDomainCount[] {
  if (!payload || !payload.data) return [];
  const savedCounts = payload.summary?.counts;
  return BACKUP_DOMAINS.map((domain) => ({
    key: domain.key,
    label: domain.label,
    group: domain.group,
    count:
      savedCounts && typeof savedCounts[domain.key] === 'number'
        ? savedCounts[domain.key]
        : countBackupDomainValue(domain.shape, payload.data[domain.key]),
  }));
}

/**
 * Triggers a browser download of the backup JSON file
 */
export function downloadBackupJSON(customStoreName?: string): { fileName: string; sizeBytes: number; summary: PosBackupPayload['summary'] } {
  const payload = generateBackupPayload();
  const jsonString = JSON.stringify(payload, null, 2);

  const cleanStoreName = (customStoreName || payload.storeName || 'BEJO Digital Print')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `backup_pos_${cleanStoreName}_${dateStr}_${timeStr}.json`;

  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    fileName,
    sizeBytes: blob.size,
    summary: payload.summary,
  };
}

/**
 * Validates a parsed JSON payload for restore compatibility
 */
export function validateBackupPayload(parsed: any): { isValid: boolean; error?: string; payload?: PosBackupPayload } {
  if (!parsed || typeof parsed !== 'object') {
    return { isValid: false, error: 'Berkas cadangan tidak valid atau rusak. Pilih berkas .json hasil simpan dari aplikasi ini.' };
  }

  if (!parsed.data || typeof parsed.data !== 'object') {
    return { isValid: false, error: 'Berkas cadangan tidak sesuai. Bagian data utamanya tidak ditemukan.' };
  }

  const { data } = parsed;

  if (
    !Array.isArray(data.products) &&
    !Array.isArray(data.customers) &&
    !Array.isArray(data.transactions)
  ) {
    return { isValid: false, error: 'File tidak memuat data produk, pelanggan, atau transaksi yang valid.' };
  }

  // Berkas lama masih memuat daftar akun login. Isinya dibuang di sini supaya
  // pemulihan tidak pernah menimpa akun yang berlaku di perangkat ini.
  const cleanData = { ...data };
  delete cleanData.users;
  delete cleanData.authUser;

  return { isValid: true, payload: { ...parsed, data: cleanData } as PosBackupPayload };
}

/**
 * Restores backup data into local storage
 */
export function restoreBackupToStorage(payload: PosBackupPayload): boolean {
  try {
    const { data } = payload;
    const productsBeforeRestore = getStoredProducts();

    for (const domain of BACKUP_DOMAINS) {
      const access = DOMAIN_ACCESS[domain.key];
      if (!access) continue;
      const value = data[domain.key];
      if (!domainHasValue(domain, value)) continue;
      access.restore(value);
    }

    // Cadangan lama tidak punya buku penyesuaian aset. Lonjakan nilai akibat
    // pemulihan dicatat satu baris rekap supaya garis tren tidak melompat diam-diam.
    if (!Array.isArray(data.assetAdjustments) && Array.isArray(data.products)) {
      const row = aggregateAdjustment(
        currentStoreAssetValue(productsBeforeRestore),
        currentStoreAssetValue(data.products),
        { source: 'RESTORE', notes: `Pulihkan cadangan ${payload.exportedAt}` }
      );
      if (row) {
        saveStoredAssetAdjustments([row, ...getStoredAssetAdjustments()]);
        saveAssetAdjustmentCloud(row).catch(console.error);
      }
    }

    return true;
  } catch (err) {
    console.error('Failed to restore backup data', err);
    return false;
  }
}

interface CloudRestoreTask {
  label: string;
  records: any[];
  save: (record: any) => Promise<void>;
}

/**
 * Penolakan data oleh server tidak akan berubah bila diulang, jadi
 * jangan sarankan "Coba Lagi". Hanya gangguan jaringan atau server sibuk yang
 * layak dicoba ulang.
 */
function isRetryableRestoreFailure(reason: any): boolean {
  const status = Number(reason?.status || 0);
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  const message = String(reason?.message || '');
  return !/server menolak|sudah dipakai|tidak valid|wajib diisi|minimal \d+ karakter/i.test(
    message
  );
}

/**
 * Pushes restored backup data to PocketBase so it survives the realtime
 * subscription reload that would otherwise overwrite local-only changes.
 * Domain tanpa jalur tulis ke server berhenti di perangkat ini saja.
 */
export async function restoreBackupToCloud(
  payload: PosBackupPayload,
  onProgress?: (progress: BackupCloudRestoreProgress) => void
): Promise<BackupCloudRestoreResult> {
  const data = payload?.data;
  if (!data) {
    return {
      success: false,
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      retryable: false,
      errors: ['Berkas cadangan tidak memuat bagian data utama.'],
    };
  }

  const connected = await testPocketBaseConnection();
  if (!connected) {
    return {
      success: false,
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      retryable: true,
      errors: ['Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.'],
    };
  }

  const tasks: CloudRestoreTask[] = [];

  for (const domain of BACKUP_DOMAINS) {
    if (domain.cloudWrite === 'none') continue;
    const access = DOMAIN_ACCESS[domain.key];
    if (!access?.cloud) continue;
    const value = data[domain.key];
    if (!domainHasValue(domain, value)) continue;

    if (domain.cloudWrite === 'record') {
      if (Array.isArray(value) && value.length > 0) {
        tasks.push({ label: domain.label, records: value, save: access.cloud });
      }
    } else {
      tasks.push({ label: domain.label, records: [value], save: access.cloud });
    }
  }

  const overallTotal = tasks.reduce((sum, task) => sum + task.records.length, 0);
  let syncedRecords = 0;
  let failedRecords = 0;
  let retryable = false;
  let overallProcessed = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 4;

  for (const task of tasks) {
    for (let index = 0; index < task.records.length; index += BATCH_SIZE) {
      const batch = task.records.slice(index, index + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((record) => task.save(record)));

      results.forEach((result, offset) => {
        if (result.status === 'fulfilled') {
          syncedRecords += 1;
          return;
        }
        const recordId = batch[offset]?.id ?? index + offset + 1;
        const message = String(result.reason?.message || result.reason || '');
        failedRecords += 1;
        if (isRetryableRestoreFailure(result.reason)) retryable = true;
        if (errors.length < 10) {
          errors.push(`${task.label} #${recordId}: ${message}`);
        }
      });

      overallProcessed += batch.length;
      onProgress?.({
        step: task.label,
        processed: Math.min(index + batch.length, task.records.length),
        total: task.records.length,
        overallProcessed,
        overallTotal,
      });
    }
  }

  if (overallTotal > 0) {
    const stillConnected = await testPocketBaseConnection();
    if (!stillConnected) {
      errors.push('Koneksi ke server terputus saat proses pemulihan.');
      failedRecords = Math.max(failedRecords, 1);
      retryable = true;
    }
  }

  return {
    success: failedRecords === 0,
    totalRecords: overallTotal,
    syncedRecords,
    failedRecords,
    retryable,
    errors,
  };
}
