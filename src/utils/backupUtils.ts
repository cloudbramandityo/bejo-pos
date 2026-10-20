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
  getStoredStoreInfo,
  saveStoredStoreInfo,
  getStoredUsers,
  saveStoredUsers,
  getStoredCashiers,
  saveStoredCashiers,
  getStoredActivityLogs,
  saveStoredActivityLogs,
  getStoredDefaultLogo,
  saveStoredDefaultLogo
} from './storage';

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
    totalProductCategories: number;
    totalCustomerCategories: number;
    totalUsers: number;
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
    users: any[];
    cashiers: any[];
    activityLogs: any[];
    defaultLogo: string | null;
  };
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
  const users = getStoredUsers();
  const cashiers = getStoredCashiers();
  const activityLogs = getStoredActivityLogs();
  const defaultLogo = getStoredDefaultLogo();

  const now = new Date();
  const isoString = now.toISOString();

  return {
    app: 'BEJO STIKER POS & INVENTORY',
    version: '2.0.0',
    exportedAt: isoString,
    timestamp: now.getTime(),
    storeName: storeInfo?.storeName || 'BEJO Stiker',
    summary: {
      totalProducts: products.length,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      totalAgents: agents.length,
      totalTransactions: transactions.length,
      totalShifts: shifts.length,
      totalStockTransactions: stockTransactions.length,
      totalProductCategories: productCategories.length,
      totalCustomerCategories: customerCategories.length,
      totalUsers: users.length,
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
      users,
      cashiers,
      activityLogs,
      defaultLogo,
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
    if (Array.isArray(data.users)) saveStoredUsers(data.users);
    if (Array.isArray(data.cashiers)) saveStoredCashiers(data.cashiers);
    if (Array.isArray(data.activityLogs)) saveStoredActivityLogs(data.activityLogs);
    if (data.defaultLogo) saveStoredDefaultLogo(data.defaultLogo);

    return true;
  } catch (err) {
    console.error('Failed to restore backup data', err);
    return false;
  }
}
