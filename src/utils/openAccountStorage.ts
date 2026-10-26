/**
 * Coded by Langgo Bramandityo.
 * Utilitas Penyimpanan & Logika Bisnis Rekening Terbuka (Open Account)
 * Konsolidasi Tagihan per ID Pelanggan, Penyesuaian Sisa Tagihan, dan Catatan
 */

import { InvoiceItem, SpkOrder } from '../types';

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

/**
 * Membentuk rincian item invoice/PI dari grup Open Account.
 * Jumlah seluruh baris dijamin sama dengan total tagihan grup: sisa tagihan
 * per SPK (setelah DP) ditambah penyesuaian pelanggan.
 */
export function buildOpenAccountInvoiceItems(group: OpenAccountCustomerGroup): InvoiceItem[] {
  const items: InvoiceItem[] = [];

  (group.orders || []).forEach((order) => {
    const orderItems = order.items || [];
    const itemsTotal = orderItems.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0);
    const storedTotal = Number(order.totalAmount);
    const orderTotal = Number.isFinite(storedTotal) && storedTotal > 0 ? storedTotal : itemsTotal;
    const remaining = Number(order.remainingAmount);
    const orderBilled = remaining > 0 ? remaining : (order.isPaid ? 0 : orderTotal);

    if (orderBilled <= 0) return;

    let importedTotal = 0;
    orderItems.forEach((it, idx) => {
      const qty = Number(it.qty) || 1;
      const lineTotal = Number(it.totalPrice) || 0;
      const finishingTotal = Math.max(0, Number(it.finishingPriceTotal) || 0);
      const baseTotal = Math.max(0, lineTotal - finishingTotal);
      const isLembar = it.saleMode === 'lembar';
      const fallbackArea =
        Math.round((Number(it.lengthMeters) || 1) * (Number(it.widthMeters) || 1) * qty * 100) / 100;
      const quantity = isLembar ? qty : (Number(it.areaM2) > 0 ? Number(it.areaM2) : fallbackArea);
      const unit = isLembar ? 'lembar' : 'm²';
      const rawUnitPrice = Number(it.unitPrice);
      const rawGross = quantity * rawUnitPrice;
      const unitPrice =
        rawUnitPrice > 0 && Math.abs(Math.round(rawGross) - baseTotal) <= 1
          ? rawUnitPrice
          : (quantity > 0 ? Math.round((baseTotal / quantity) * 100) / 100 : baseTotal);

      const length = Number(it.lengthMeters) || 0;
      const width = Number(it.widthMeters) || 0;
      const specParts = [it.materialName || 'Cetak'];
      if (length > 0 && width > 0) specParts.push(`${length}x${width}m`);
      specParts.push(`${qty} pcs`);

      items.push({
        id: `item-oa-${order.id}-${it.id || idx}`,
        itemName: `[${order.orderNumber}] ${it.jobName || it.materialName || 'Cetak'}`,
        description: specParts.join(' • '),
        quantity,
        unit,
        unitPrice,
        discountPercent: 0,
        discountAmount: 0,
        isTaxable: true,
        totalPrice: baseTotal
      });
      importedTotal += baseTotal;

      if (finishingTotal > 0) {
        const finishingNames = (it.finishings || []).map((fin) => fin.name).filter(Boolean);
        items.push({
          id: `item-oa-${order.id}-${it.id || idx}-finishing`,
          itemName: `[${order.orderNumber}] Finishing — ${it.jobName || it.materialName || 'Cetak'}`,
          description: finishingNames.length > 0 ? finishingNames.join(' • ') : 'Biaya finishing',
          quantity: 1,
          unit: 'paket',
          unitPrice: finishingTotal,
          discountPercent: 0,
          discountAmount: 0,
          isTaxable: true,
          totalPrice: finishingTotal
        });
        importedTotal += finishingTotal;
      }
    });

    // Selisih menampung DP/pembayaran sebelumnya, diskon level SPK, atau
    // pembulatan agar total invoice tetap sama dengan tagihan Open Account.
    const difference = orderBilled - importedTotal;
    if (difference !== 0) {
      items.push({
        id: `item-oa-settlement-${order.id}`,
        itemName:
          difference < 0
            ? `Potongan pembayaran sebelumnya (SPK ${order.orderNumber})`
            : `Penyesuaian nilai tagihan (SPK ${order.orderNumber})`,
        description:
          difference < 0
            ? `DP/pembayaran sebelumnya Rp ${Math.abs(difference).toLocaleString('id-ID')} dari total SPK Rp ${orderTotal.toLocaleString('id-ID')}`
            : `Selisih rincian terhadap total tagihan SPK Rp ${orderTotal.toLocaleString('id-ID')}`,
        quantity: 1,
        unit: 'paket',
        unitPrice: difference,
        discountPercent: 0,
        discountAmount: 0,
        isTaxable: true,
        totalPrice: difference
      });
    }
  });

  if (group.adjustment) {
    items.push({
      id: `item-oa-adjustment-${group.customerId}`,
      itemName: `Penyesuaian Sisa Tagihan (+/-): ${group.adjustmentReason || 'Penyesuaian Plafon'}`,
      description: group.adjustmentReason || 'Penyesuaian Biaya Tagihan Open Account',
      quantity: 1,
      unit: 'paket',
      unitPrice: group.adjustment,
      discountPercent: 0,
      discountAmount: 0,
      isTaxable: true,
      totalPrice: group.adjustment
    });
  }

  // Pastikan total seluruh baris tepat sama dengan total tagihan grup.
  // Selisih muncul bila penyesuaian negatif melebihi subtotal (total grup dibatasi 0)
  // atau karena pembulatan nilai per order.
  const itemsTotal = items.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0);
  const groupDifference = Math.round(group.totalAmount) - Math.round(itemsTotal);
  if (groupDifference !== 0) {
    items.push({
      id: `item-oa-balance-${group.customerId}`,
      itemName: 'Penyesuaian Pembulatan Tagihan Open Account',
      description: `Selisih pembulatan agar total rincian sama dengan total tagihan Open Account (Rp ${group.totalAmount.toLocaleString('id-ID')})`,
      quantity: 1,
      unit: 'paket',
      unitPrice: groupDifference,
      discountPercent: 0,
      discountAmount: 0,
      isTaxable: true,
      totalPrice: groupDifference
    });
  }

  return items;
}
