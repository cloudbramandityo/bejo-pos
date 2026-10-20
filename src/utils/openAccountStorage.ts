/**
 * Coded by Langgo Bramandityo.
 * Utilitas Penyimpanan & Logika Bisnis Rekening Terbuka (Open Account)
 * Konsolidasi Tagihan per ID Pelanggan, Penyesuaian Sisa Tagihan, dan Catatan
 */

import { SpkOrder } from '../types';

const STORAGE_KEY_OPEN_ACCOUNT_CONFIGS = 'bejo_open_account_configs';

export interface OpenAccountCustomerConfig {
  customerId: string;
  adjustment: number; // Nilai penyesuaian: positif (tambah) atau negatif (kurang)
  adjustmentReason: string; // Keterangan Sisa Tagihan (contoh: "Potongan kesepakatan plafon", "Biaya packing kayu")
  notes: string; // Catatan tagihan (contoh: "Jatuh tempo 14 hari", "Plafon kredit Rp 5.000.000")
  updatedAt: number;
}

export interface OpenAccountCustomerGroup {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerCategory: string;
  orders: SpkOrder[];
  subtotal: number;
  adjustment: number;
  adjustmentReason: string;
  notes: string;
  totalAmount: number;
  earliestDate: string;
  latestDate: string;
}

/**
 * Mengambil konfigurasi penyesuaian & catatan tagihan Open Account per customer dari localStorage
 */
export function getStoredOpenAccountConfigs(): Record<string, OpenAccountCustomerConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OPEN_ACCOUNT_CONFIGS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('Gagal membaca bejo_open_account_configs:', err);
    return {};
  }
}

/**
 * Menyimpan konfigurasi penyesuaian & catatan tagihan Open Account ke localStorage
 */
export function saveStoredOpenAccountConfigs(configs: Record<string, OpenAccountCustomerConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEY_OPEN_ACCOUNT_CONFIGS, JSON.stringify(configs));
  } catch (err) {
    console.error('Gagal menyimpan bejo_open_account_configs:', err);
  }
}

/**
 * Mendapatkan konfigurasi Open Account untuk ID Pelanggan tertentu
 */
export function getOpenAccountConfigForCustomer(customerId: string): OpenAccountCustomerConfig {
  const configs = getStoredOpenAccountConfigs();
  return (
    configs[customerId] || {
      customerId,
      adjustment: 0,
      adjustmentReason: '',
      notes: '',
      updatedAt: Date.now()
    }
  );
}

/**
 * Mengupdate konfigurasi penyesuaian atau catatan untuk ID Pelanggan tertentu
 */
export function updateOpenAccountConfigForCustomer(
  customerId: string,
  updates: Partial<Omit<OpenAccountCustomerConfig, 'customerId'>>
): OpenAccountCustomerConfig {
  const configs = getStoredOpenAccountConfigs();
  const current = configs[customerId] || {
    customerId,
    adjustment: 0,
    adjustmentReason: '',
    notes: '',
    updatedAt: Date.now()
  };

  const updated: OpenAccountCustomerConfig = {
    ...current,
    ...updates,
    updatedAt: Date.now()
  };

  configs[customerId] = updated;
  saveStoredOpenAccountConfigs(configs);

  window.dispatchEvent(
    new CustomEvent('bejo_open_account_configs_updated', {
      detail: { customerId, config: updated }
    })
  );

  return updated;
}

/**
 * Menghapus konfigurasi penyesuaian ID Pelanggan (misal setelah tagihan lunas di POS)
 */
export function clearOpenAccountConfigForCustomer(customerId: string): void {
  const configs = getStoredOpenAccountConfigs();
  if (configs[customerId]) {
    delete configs[customerId];
    saveStoredOpenAccountConfigs(configs);

    window.dispatchEvent(
      new CustomEvent('bejo_open_account_configs_updated', {
        detail: { customerId, config: null }
      })
    );
  }
}

/**
 * Standarisasi kunci ID Pelanggan untuk grouping Open Account
 */
export function getCustomerGroupKey(order: SpkOrder): string {
  if (order.customerId && order.customerId.trim()) {
    return order.customerId.trim();
  }
  if (order.customerPhone && order.customerPhone.trim()) {
    return `phone_${order.customerPhone.trim().replace(/[^0-9]/g, '')}`;
  }
  return `name_${(order.customerName || 'umum').trim().toLowerCase().replace(/\s+/g, '_')}`;
}

/**
 * Mengelompokkan seluruh SPK Open Account menjadi 1 Tagihan Gabungan per ID Pelanggan (Consolidated Billing)
 */
export function groupOpenAccountOrders(openAccountOrders: SpkOrder[]): OpenAccountCustomerGroup[] {
  const configs = getStoredOpenAccountConfigs();
  const groupMap = new Map<string, OpenAccountCustomerGroup>();

  openAccountOrders.forEach((order) => {
    const custKey = getCustomerGroupKey(order);
    let group = groupMap.get(custKey);

    if (!group) {
      const cfg = configs[custKey] || {
        customerId: custKey,
        adjustment: 0,
        adjustmentReason: '',
        notes: '',
        updatedAt: Date.now()
      };

      group = {
        customerId: custKey,
        customerName: order.customerName || 'Pelanggan Umum',
        customerPhone: order.customerPhone || '',
        customerCategory: order.customerCategory || 'UMUM',
        orders: [],
        subtotal: 0,
        adjustment: cfg.adjustment || 0,
        adjustmentReason: cfg.adjustmentReason || '',
        notes: cfg.notes || '',
        totalAmount: 0,
        earliestDate: order.date,
        latestDate: order.date
      };
      groupMap.set(custKey, group);
    }

    group.orders.push(order);
    // Nilai tagihan SPK: sisa tagihan bila ada DP, atau total tagihan
    const orderBilling = order.remainingAmount > 0 ? order.remainingAmount : (order.isPaid ? 0 : order.totalAmount);
    group.subtotal += orderBilling;

    if (order.date < group.earliestDate) group.earliestDate = order.date;
    if (order.date > group.latestDate) group.latestDate = order.date;
  });

  // Hitung total akhir per pelanggan (subtotal + adjustment)
  const result: OpenAccountCustomerGroup[] = [];
  groupMap.forEach((group) => {
    // Total amount tidak boleh minus
    group.totalAmount = Math.max(0, group.subtotal + (group.adjustment || 0));
    result.push(group);
  });

  // Urutkan grup pelanggan berdasarkan abjad nama
  return result.sort((a, b) => a.customerName.localeCompare(b.customerName));
}
