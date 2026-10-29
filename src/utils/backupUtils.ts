/**
 * Backup and Export/Import Utilities for BEJO POS
 * Coded by Langgo Bramandityo.
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
  getStoredUsers,
  saveStoredUsers,
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
  saveStoredPrintSettings
} from './storage';
import { getStoredInvoices, saveStoredInvoices } from './invoiceStorage';
import { getStoredLandingConfig, saveStoredLandingConfig } from './landingPageStorage';
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
  saveUserCloud,
  saveStockTransactionCloud,
  saveAssetAdjustmentCloud,
  saveSupplierCloud,
  saveAgentCloud,
  saveActivityLogCloud,
  saveSpkOrderCloud,
  saveMachineCloud,
  saveInvoiceCloud,
  saveLandingConfigCloud
} from '../backend/pocketbaseBackend';
import { aggregateAdjustment } from './assetAdjustments';
import { currentStoreAssetValue } from './assetTrend';

export interface PosBackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  timestamp: number;
  storeName: string;
  summary: {
    totalProducts: number;
    totalCustomers: number;
    totalSuppliers: number;
    totalAgents: number;
    totalTransactions: number;
    totalShifts: number;
    totalStockTransactions: number;
    totalAssetAdjustments: number;
    totalProductCategories: number;
    totalCustomerCategories: number;
    totalUsers: number;
    totalSpkOrders?: number;
    totalMachines?: number;
    totalInvoices?: number;
    totalCustomRoles?: number;
  };
  data: {
    storeInfo: any;
    products: any[];
    productCategories: any[];
    customers: any[];
    customerCategories: any[];
    suppliers: any[];
    agents: any[];
    transactions: any[];
    shifts: any[];
    activeShift: any;
    stockTransactions: any[];
    assetAdjustments?: any[];
    users: any[];
    cashiers: any[];
    activityLogs: any[];
    defaultLogo: string | null;
    spkOrders?: any[];
    machines?: any[];
    storeProfiles?: any[];
    activeProfileId?: string;
    customRoles?: any[];
    printSettings?: any;
    invoices?: any[];
    landingConfig?: any;
  };
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
  /** Record yang memang sudah ada di cloud dan digabungkan/dilewati. */
  skippedRecords: number;
  /** True hanya bila kegagalan berpotensi hilang saat dicoba ulang (jaringan/5xx). */
  retryable: boolean;
  errors: string[];
}

/**
 * Builds the complete offline backup payload object
 */
export function generateBackupPayload(): PosBackupPayload {
  const storeInfo = getStoredStoreInfo();
  const products = getStoredProducts();
  const productCategories = getStoredProductCategories();
  const customers = getStoredCustomers();
  const customerCategories = getStoredCategories();
  const suppliers = getStoredSuppliers();
  const agents = getStoredAgents();
  const transactions = getStoredTransactions();
  const shifts = getStoredShifts();
  const activeShift = getStoredActiveShift();
  const stockTransactions = getStoredStockTransactions();
  const assetAdjustments = getStoredAssetAdjustments();
  const users = getStoredUsers();
  const cashiers = getStoredCashiers();
  const activityLogs = getStoredActivityLogs();
  const defaultLogo = getStoredDefaultLogo();
  const spkOrders = getStoredSpkOrders();
  const machines = getStoredMachines();
  const storeProfiles = getStoredStoreProfiles();
  const activeProfileId = getStoredActiveProfileId();
  const customRoles = getStoredCustomRoles();
  const printSettings = getStoredPrintSettings();
  const invoices = getStoredInvoices();
  const landingConfig = getStoredLandingConfig();

  const now = new Date();
  const isoString = now.toISOString();

  return {
    app: 'BEJO Digital Print & INVENTORY',
    version: '2.1.0',
    exportedAt: isoString,
    timestamp: now.getTime(),
    storeName: storeInfo?.storeName || 'BEJO Digital Print',
    summary: {
      totalProducts: products.length,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      totalAgents: agents.length,
      totalTransactions: transactions.length,
      totalShifts: shifts.length,
      totalStockTransactions: stockTransactions.length,
      totalAssetAdjustments: assetAdjustments.length,
      totalProductCategories: productCategories.length,
      totalCustomerCategories: customerCategories.length,
      totalUsers: users.length,
      totalSpkOrders: spkOrders.length,
      totalMachines: machines.length,
      totalInvoices: invoices.length,
      totalCustomRoles: customRoles.length,
    },
    data: {
      storeInfo,
      products,
      productCategories,
      customers,
      customerCategories,
      suppliers,
      agents,
      transactions,
      shifts,
      activeShift,
      stockTransactions,
      assetAdjustments,
      users,
      cashiers,
      activityLogs,
      defaultLogo,
      spkOrders,
      machines,
      storeProfiles,
      activeProfileId,
      customRoles,
      printSettings,
      invoices,
      landingConfig,
    },
  };
}

/**
 * Triggers a browser download of the backup JSON file
 */
export function downloadBackupJSON(customStoreName?: string): { fileName: string; sizeBytes: number; summary: PosBackupPayload['summary'] } {
  const payload = generateBackupPayload();
  const jsonString = JSON.stringify(payload, null, 2);

  const cleanStoreName = (customStoreName || payload.storeName || 'bejostiker')
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
    return { isValid: false, error: 'File cadangan tidak valid atau rusak (format bukan JSON objek).' };
  }

  if (!parsed.data || typeof parsed.data !== 'object') {
    return { isValid: false, error: 'Struktur file backup tidak sesuai (field data tidak ditemukan).' };
  }

  const { data } = parsed;

  if (
    !Array.isArray(data.products) &&
    !Array.isArray(data.customers) &&
    !Array.isArray(data.transactions)
  ) {
    return { isValid: false, error: 'File tidak memuat data produk, pelanggan, atau transaksi yang valid.' };
  }

  return { isValid: true, payload: parsed as PosBackupPayload };
}

/**
 * Restores backup data into local storage
 */
export function restoreBackupToStorage(payload: PosBackupPayload): boolean {
  try {
    const { data } = payload;
    const productsBeforeRestore = getStoredProducts();
    if (data.storeInfo) saveStoredStoreInfo(data.storeInfo);
    if (Array.isArray(data.products)) saveStoredProducts(data.products);
    if (Array.isArray(data.productCategories)) saveStoredProductCategories(data.productCategories);
    if (Array.isArray(data.customers)) saveStoredCustomers(data.customers);
    if (Array.isArray(data.customerCategories)) saveStoredCategories(data.customerCategories);
    if (Array.isArray(data.suppliers)) saveStoredSuppliers(data.suppliers);
    if (Array.isArray(data.agents)) saveStoredAgents(data.agents);
    if (Array.isArray(data.transactions)) saveStoredTransactions(data.transactions);
    if (Array.isArray(data.shifts)) saveStoredShifts(data.shifts);
    if (data.activeShift !== undefined) saveStoredActiveShift(data.activeShift);
    if (Array.isArray(data.stockTransactions)) saveStoredStockTransactions(data.stockTransactions);
    if (Array.isArray(data.assetAdjustments)) {
      saveStoredAssetAdjustments(data.assetAdjustments);
    } else if (Array.isArray(data.products)) {
      // Cadangan lama tidak punya buku penyesuaian. Lonjakan nilai aset dari
      // pemulihan dicatat satu baris agregat supaya garis tidak melompat diam-diam.
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
    if (Array.isArray(data.users)) saveStoredUsers(data.users);
    if (Array.isArray(data.cashiers)) saveStoredCashiers(data.cashiers);
    if (Array.isArray(data.activityLogs)) saveStoredActivityLogs(data.activityLogs);
    if (data.defaultLogo) saveStoredDefaultLogo(data.defaultLogo);
    if (Array.isArray(data.spkOrders)) saveStoredSpkOrders(data.spkOrders);
    if (Array.isArray(data.machines)) saveStoredMachines(data.machines);
    if (Array.isArray(data.storeProfiles) && data.storeProfiles.length > 0) {
      saveStoredStoreProfiles(data.storeProfiles);
    }
    if (typeof data.activeProfileId === 'string' && data.activeProfileId) {
      saveStoredActiveProfileId(data.activeProfileId);
    }
    if (Array.isArray(data.customRoles)) saveStoredCustomRoles(data.customRoles);
    if (data.printSettings && typeof data.printSettings === 'object') {
      saveStoredPrintSettings(data.printSettings);
    }
    if (Array.isArray(data.invoices)) saveStoredInvoices(data.invoices);
    if (data.landingConfig && typeof data.landingConfig === 'object') {
      saveStoredLandingConfig(data.landingConfig);
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
 * Penolakan data oleh PocketBase/server tidak akan berubah bila diulang, jadi
 * jangan sarankan "Coba Lagi". Hanya gangguan jaringan atau server sibuk yang
 * layak dicoba ulang.
 */
function isRetryableRestoreFailure(reason: any): boolean {
  const status = Number(reason?.status || 0);
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  const message = String(reason?.message || '');
  return !/pocketbase menolak|sudah dipakai|tidak valid|wajib diisi|minimal \d+ karakter/i.test(
    message
  );
}

/**
 * Pushes restored backup data to PocketBase so it survives the realtime
 * subscription reload that would otherwise overwrite local-only changes.
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
      skippedRecords: 0,
      retryable: false,
      errors: ['Struktur file backup tidak memuat field data.'],
    };
  }

  const connected = await testPocketBaseConnection();
  if (!connected) {
    return {
      success: false,
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      retryable: true,
      errors: ['Tidak dapat terhubung ke database cloud PocketBase. Periksa koneksi internet lalu coba lagi.'],
    };
  }

  const tasks: CloudRestoreTask[] = [];
  const addArray = (label: string, records: any, save: (record: any) => Promise<void>) => {
    if (Array.isArray(records) && records.length > 0) {
      tasks.push({ label, records, save });
    }
  };
  const addSingle = (label: string, record: any, save: (record: any) => Promise<void>) => {
    if (record !== undefined && record !== null) {
      tasks.push({ label, records: [record], save });
    }
  };

  addSingle('Info Toko', data.storeInfo, saveStoreInfoCloud);
  addArray('Profil Toko', data.storeProfiles, saveStoreProfileCloud);
  if (typeof data.activeProfileId === 'string' && data.activeProfileId) {
    tasks.push({
      label: 'Profil Toko Aktif',
      records: [{ activeId: data.activeProfileId }],
      save: (record) => saveActiveStoreProfileIdCloud(record.activeId),
    });
  }
  addArray('Kategori Produk', data.productCategories, saveProductCategoryCloud);
  addArray('Produk', data.products, saveProductCloud);
  addArray('Kategori Pelanggan', data.customerCategories, saveCustomerCategoryCloud);
  addArray('Pelanggan', data.customers, saveCustomerCloud);
  addArray('Supplier', data.suppliers, saveSupplierCloud);
  addArray('Agen', data.agents, saveAgentCloud);
  addArray('Transaksi', data.transactions, saveTransactionCloud);
  addArray('Shift', data.shifts, saveShiftCloud);
  if (data.activeShift !== undefined) {
    tasks.push({
      label: 'Shift Aktif',
      records: [data.activeShift],
      save: (record) => saveActiveShiftCloud(record || null),
    });
  }
  addArray('Mutasi Stok', data.stockTransactions, saveStockTransactionCloud);
  addArray('Penyesuaian Aset', data.assetAdjustments, saveAssetAdjustmentCloud);
  addArray('Kasir', data.cashiers, saveCashierCloud);
  if (Array.isArray(data.users) && data.users.length > 0) {
    tasks.push({
      label: 'Pengguna',
      records: data.users.map((u: any) => {
        const sanitized: any = { ...u };
        // Pastikan username valid
        if (typeof sanitized.username === 'string') {
          sanitized.username = sanitized.username.trim().toLowerCase();
        }
        // Pastikan password minimal 8 karakter jika ada
        if (typeof sanitized.password === 'string') {
          if (sanitized.password.length < 8) {
            // Jangan kirim password kosong/tidak valid, biarkan server handle
            // atau ganti dengan placeholder - tapi lebih baik hapus agar server minta password
            delete sanitized.password;
            delete sanitized.appPassword;
          } else if (/^\u2022+$/.test(sanitized.password)) {
            // Mask password, hapus agar tidak mengubah
            delete sanitized.password;
            delete sanitized.appPassword;
          }
        } else {
          delete sanitized.password;
          delete sanitized.appPassword;
        }
        // Pastikan role valid
        if (typeof sanitized.role === 'string') {
          sanitized.role = sanitized.role.trim().toUpperCase();
          if (sanitized.role === 'DEVELOPER') sanitized.role = 'ADMIN';
        }
        // Pastikan name ada
        if (!sanitized.name || String(sanitized.name).trim().length < 3) {
          sanitized.name = sanitized.username || sanitized.id || 'User';
        }
        return sanitized;
      }),
      save: saveUserCloud,
    });
  }
  addArray('Log Aktivitas', data.activityLogs, saveActivityLogCloud);
  addArray('SPK', data.spkOrders, saveSpkOrderCloud);
  addArray('Mesin', data.machines, saveMachineCloud);
  addArray('Hak Akses', data.customRoles, saveCustomRoleCloud);
  addArray('Invoice', data.invoices, saveInvoiceCloud);
  addSingle('Landing Page', data.landingConfig, saveLandingConfigCloud);

  const overallTotal = tasks.reduce((sum, task) => sum + task.records.length, 0);
  let syncedRecords = 0;
  let failedRecords = 0;
  let skippedRecords = 0;
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
        const lowerMsg = message.toLowerCase();
        // Akun sistem (developer/sinkronisasi) memang tidak boleh ditulis dari
        // restore; bukan kegagalan data user.
        const systemCode = String(result.reason?.code || '');
        if (task.label === 'Pengguna' && (systemCode === 'ACCOUNT_RESERVED' || systemCode === 'USERNAME_RESERVED')) {
          skippedRecords += 1;
          if (errors.length < 10) {
            errors.push(`${task.label} #${recordId}: ${message} (dilewati: akun sistem)`);
          }
          return;
        }
        // Username sudah dipakai atau duplikasi diizinkan - jangan anggap gagal total
        if (
          task.label === 'Pengguna' &&
          (lowerMsg.includes('username') && (lowerMsg.includes('sudah dipakai') || lowerMsg.includes('taken') || lowerMsg.includes('duplicate'))) ||
          (lowerMsg.includes('already exists') || lowerMsg.includes('unique constraint'))
        ) {
          skippedRecords += 1;
          if (errors.length < 10) {
            errors.push(`${task.label} #${recordId}: ${message} (dilewati)`);
          }
          return;
        }
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
      errors.push('Koneksi ke database cloud terputus saat proses restore.');
      failedRecords = Math.max(failedRecords, 1);
      retryable = true;
    }
  }

  return {
    success: failedRecords === 0,
    totalRecords: overallTotal,
    syncedRecords,
    failedRecords,
    skippedRecords,
    retryable,
    errors,
  };
}
