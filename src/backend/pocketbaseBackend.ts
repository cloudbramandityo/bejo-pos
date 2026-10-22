/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Backend PocketBase (menggantikan Firebase/Firestore sepenuhnya).
 *
 * API modul ini SAMA PERSA dengan modul `firebase` sebelumnya, sehingga
 * seluruh komponen aplikasi tidak perlu diubah call-site-nya.
 *
 * - Data disimpan di PocketBase (SQLite) yang di-host di VPS sendiri
 * - Real-time sync memakai PocketBase Realtime (WebSocket)
 * - Autentikasi memakai collections `users` (email + password)
 * - Fallback: bila PocketBase tidak terjangkau, aplikasi otomatis
 *   operates dalam "Mode Lokal" (localStorage) seperti sebelumnya.
 *
 * Coded by Langgo Bramandityo.
 */
import { getPB, subscribeRealtime } from '../lib/pocketbase';
import type { RecordModel, RecordService } from 'pocketbase';
import {
  Product,
  Customer,
  CustomerCategory,
  Shift,
  Transaction,
  ProductCategoryItem,
  CashierUser,
  AppUser,
  StockTransaction,
  Supplier,
  Agent,
  UserActivityLog,
  StoreProfile,
  CustomRole,
  AgentNotification,
  SpkOrder,
  MachineItem,
  AiInternalChatMessage,
  UserMentionNotification,
  PrivateChatMessage,
  PrintingRejectRecord,
  Invoice,
  InvoiceStoreIdentity
} from '../types';
import {
  TaxAnnualReturn1770,
  TaxpayerProfile,
  MonthlyBillingsByYear
} from '../types/tax';
import {
  StoreInfo,
  DEFAULT_STORE_INFO,
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_MASTER_STORE_PROFILE,
  DEFAULT_STORE_PROFILES,
  DEFAULT_MACHINES,
  DEFAULT_SPK_ORDERS
} from '../utils/storage';
import {
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_SHIFT,
  INITIAL_TRANSACTIONS,
  INITIAL_CASHIERS,
  INITIAL_USERS,
  INITIAL_SUPPLIERS,
  INITIAL_AGENTS
} from '../data/initialData';

/* -------------------------------------------------------------------------- */
/*  Koleksi PocketBase                                                        */
/* -------------------------------------------------------------------------- */
export const PB_COLLECTIONS = {
  products: 'products',
  product_categories: 'product_categories',
  customers: 'customers',
  customer_categories: 'customer_categories',
  transactions: 'transactions',
  stock_transactions: 'stock_transactions',
  shifts: 'shifts',
  cashiers: 'cashiers',
  users: 'users',
  agents: 'agents',
  suppliers: 'suppliers',
  settings: 'settings',
  store_profiles: 'store_profiles',
  custom_roles: 'custom_roles',
  agent_notifications: 'agent_notifications',
  activity_logs: 'activity_logs',
  spk_orders: 'spk_orders',
  machines: 'machines',
  ai_chat_messages: 'ai_chat_messages',
  user_mentions: 'user_mentions',
  private_chat_messages: 'private_chat_messages',
  printing_rejects: 'printing_rejects',
  invoices: 'invoices',
  invoice_settings: 'invoice_settings',
  taxpayer_profile: 'taxpayer_profile',
  tax_annual_returns: 'tax_annual_returns',
  tax_monthly_billings: 'tax_monthly_billings',
} as const;

/* -------------------------------------------------------------------------- */
/*  Status global                                                             */
/* -------------------------------------------------------------------------- */
let isCloudUnavailable = false;
let hasReportedUnavailable = false;

export function isPocketBaseUnavailable(): boolean {
  return isCloudUnavailable;
}

/** Alias lama (kompatibilitas) */
export const isFirestoreQuotaExceeded = isPocketBaseUnavailable;

/* -------------------------------------------------------------------------- */
/*  Autentikasi PocketBase                                                    */
/* -------------------------------------------------------------------------- */
/**
 * Kredensial user sinkronisasi (service account) yang dipakai aplikasi agar
 * seluruh client (kasir, admin, developer) dapat membaca/menulis basis data.
 * Di-set di .env:
 *   PB_SYNC_EMAIL=...
 *   PB_SYNC_PASSWORD=...
 *
 * Bila kosong, aplikasi mencoba memakai akun yang sedang login; bila gagal,
 * aplikasi otomatis masuk ke Mode Lokal.
 */
const SYNC_EMAIL = (import.meta.env.VITE_PB_SYNC_EMAIL as string) || '';
const SYNC_PASSWORD = (import.meta.env.VITE_PB_SYNC_PASSWORD as string) || '';
const GUEST_EMAIL = (import.meta.env.VITE_PB_GUEST_EMAIL as string) || 'sync@bejo.local';
const GUEST_PASSWORD = (import.meta.env.VITE_PB_GUEST_PASSWORD as string) || 'sync_password_bejo_2026';

export const authReady: Promise<void> = (async () => {
  const pb = getPB();
  try {
    if (pb.authStore.isValid) {
      // refresh sesi yang tersimpan
      try {
        await pb.collection('users').authRefresh();
      } catch {
        pb.authStore.clear();
      }
    }
    if (!pb.authStore.isValid) {
      if (SYNC_EMAIL && SYNC_PASSWORD) {
        await pb.collection('users').authWithPassword(SYNC_EMAIL, SYNC_PASSWORD);
      } else {
        // Akun sinkronisasi bersama (dibuat otomatis bila belum ada)
        try {
          await pb.collection('users').authWithPassword(GUEST_EMAIL, GUEST_PASSWORD);
        } catch {
          try {
            await pb.collection('users').create({
              email: GUEST_EMAIL,
              password: GUEST_PASSWORD,
              passwordConfirm: GUEST_PASSWORD,
              name: 'Bejo Sync Service',
              role: 'developer',
              isActive: true,
            });
            await pb.collection('users').authWithPassword(GUEST_EMAIL, GUEST_PASSWORD);
          } catch {
            /* biarkan; operasi cloud akan fallback ke mode lokal */
          }
        }
      }
    }
    console.log('[PocketBase] Terhubung & terautentikasi.');
  } catch (err) {
    isCloudUnavailable = true;
    console.warn(
      '[PocketBase] Gagal terhubung. Aplikasi berjalan dalam MODE LOKAL. Detail:',
      err
    );
    throw err;
  }
})();

/* -------------------------------------------------------------------------- */
/*  Error handling                                                            */
/* -------------------------------------------------------------------------- */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface BackendErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    isAnonymous?: boolean | null;
  };
}

function isNetworkError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('econnrefused') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('fetch failed')
  );
}

export function handleBackendError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): BackendErrorInfo {
  const errMessage = error instanceof Error ? error.message : String(error);
  const pb = getPB();

  if (isNetworkError(error)) {
    isCloudUnavailable = true;
    if (!hasReportedUnavailable) {
      hasReportedUnavailable = true;
      console.warn('[PocketBase] Server tidak terjangkau. Mode Lokal diaktifkan.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('app:backend-error', {
            detail: {
              source: 'POCKETBASE',
              title: 'Database Offline (Mode Lokal Aktif)',
              message:
                'Server PocketBase tidak dapat dijangkau. Seluruh data tetap AMAN dan beroperasi penuh menggunakan Mode Lokal (Local Storage) berkecepatan tinggi. Data akan otomatis tersinkronisasi ketika server online kembali.',
              code: 'ERR_POCKETBASE_UNAVAILABLE',
            },
          })
        );
        window.dispatchEvent(
          new CustomEvent('app:quota-exceeded', { detail: { isQuotaExceeded: true } })
        );
      }
    }
    return {
      error: 'Server tidak terjangkau. Operating in local storage mode.',
      authInfo: { userId: null },
      operationType,
      path,
    };
  }

  const errInfo: BackendErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: pb.authStore.model?.id ?? null,
      email: pb.authStore.model?.email ?? null,
      isAnonymous: pb.authStore.model?.email?.includes('sync@') ?? false,
    },
    operationType,
    path,
  };
  console.error('PocketBase Error: ', JSON.stringify(errInfo));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:backend-error', {
        detail: {
          source: 'POCKETBASE',
          title: `PocketBase DB ${operationType} Error (${path || 'Koleksi'})`,
          message: errMessage,
          code: `ERR_POCKETBASE_${operationType.toUpperCase()}`,
        },
      })
    );
  }

  return errInfo;
}

/** Alias lama (kompatibilitas) */
export const handleFirestoreError = handleBackendError;

/* -------------------------------------------------------------------------- */
/*  Sanitizer                                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Membersihkan data sebelum disimpan ke PocketBase:
 * - membuang undefined / function
 * - mengubah NaN menjadi 0
 * - membuang payload base64 gigantic (> 50.000 karakter)
 */
export function sanitizeForDb<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'number') return (isNaN(obj) ? 0 : obj) as unknown as T;
  if (typeof obj === 'string') {
    if (obj.length > 50000 && (obj.startsWith('data:') || obj.startsWith('blob:'))) {
      return '' as unknown as T;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined && typeof item !== 'function')
      .map((item) => sanitizeForDb(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as any)) {
      if (key === 'fileDataUrl' || key === 'previewThumbnail' || key === 'blob') continue;
      if (value !== undefined && typeof value !== 'function') {
        cleanObj[key] = sanitizeForDb(value);
      }
    }
    return cleanObj as T;
  }
  return obj;
}

/** Alias lama (kompatibilitas) */
export const sanitizeForFirestore = sanitizeForDb;

/* -------------------------------------------------------------------------- */
/*  Helper CRUD                                                               */
/* -------------------------------------------------------------------------- */
function pbService(collection: string): RecordService {
  return getPB().collection(collection);
}

/** Hapus field internal PocketBase sebelum disimpan/dibaca ulang. */
function stripPbFields(data: Record<string, any>): Record<string, any> {
  const {
    collectionId,
    collectionName,
    expand,
    tokenKey,
    ...rest
  } = data || {};
  return rest;
}

/**
 * PocketBase memakai primary key sendiri (pola [a-z0-9]{15}).
 * Aplikasi memakai id logis sendiri (mis. "A3-03", "admin", "store_info").
 * Supaya id aplikasi tetap utuh, id asli disimpan pada field `legacyId`
 * dan dikembalikan kembali ke aplikasi sebagai `id`.
 */
const LEGACY_ID_FIELD = 'legacyId';

/** Pola primary key PocketBase (15 karakter huruf/angka kecil). */
const PB_ID_PATTERN = /^[a-z0-9]{15}$/;

/** Koleksi users merupakan auth collection PocketBase (email + password). */
const USERS_COLLECTION = 'users';

/**
 * Setiap record menyimpan salinan UTUH objek aplikasi pada field JSON `data`.
 * Tujuannya: field yang belum ada di skema PocketBase (atau field baru di
 * aplikasi) tetap tersimpan utuh — tidak ada data yang hilang.
 * Field kolom yang ada di skema tetap dipakai agar tabel/filter di Admin UI
 * tetap rapi.
 */
const DATA_MIRROR_FIELD = 'data';

/** Gabungkan field datar + salinan `data` menjadi objek aplikasi. */
function withAppId<T>(record: any): T {
  if (!record) return record as T;
  const mirror =
    record[DATA_MIRROR_FIELD] && typeof record[DATA_MIRROR_FIELD] === 'object'
      ? record[DATA_MIRROR_FIELD]
      : null;
  const out: any = mirror ? { ...record, ...mirror } : { ...record };
  delete out[DATA_MIRROR_FIELD];
  delete out.collectionId;
  delete out.collectionName;
  delete out.expand;
  if (record[LEGACY_ID_FIELD]) {
    out.id = record[LEGACY_ID_FIELD];
  }
  if (out.appPassword) {
    out.password = out.appPassword;
  }
  return out as T;
}

/** Cari record berdasarkan id logis aplikasi. */
async function findByAppId(collection: string, appId: string): Promise<any | null> {
  try {
    const list = await pbService(collection).getList(1, 1, {
      filter: `${LEGACY_ID_FIELD} = "${appId.replace(/"/g, '')}"`,
    });
    return list.items[0] || null;
  } catch {
    return null;
  }
}

async function upsertRecord(
  collection: string,
  id: string,
  data: Record<string, any>
): Promise<void> {
  const service = pbService(collection);
  const payload = stripPbFields(sanitizeForDb(data));
  // Salinan utuh objek aplikasi (field yang tidak ada di skema tetap tersimpan)
  const mirror: Record<string, any> = { ...payload };
  delete payload.id;
  payload[LEGACY_ID_FIELD] = id;
  payload[DATA_MIRROR_FIELD] = mirror;

  const isUser = collection === USERS_COLLECTION;
  if (isUser) {
    // Simpan password versi aplikasi; password auth PocketBase hanya saat create.
    payload.appPassword = (data as any)?.password || '';
  } else {
    delete payload.password;
  }

  // 1) Coba update langsung memakai id (hanya bila id cocok pola primary key PocketBase)
  if (PB_ID_PATTERN.test(id)) {
    try {
      const updatePayload = { ...payload };
      if (isUser) {
        delete updatePayload.email;
        delete updatePayload.password;
        delete updatePayload.passwordConfirm;
      }
      await service.update(id, updatePayload);
      return;
    } catch (err: any) {
      if (err?.status !== 404) throw err;
    }
  }

  // 2) Cari berdasarkan legacyId
  const existing = await findByAppId(collection, id);
  if (existing) {
    const updatePayload = { ...payload };
    if (isUser) {
      delete updatePayload.email;
      delete updatePayload.password;
      delete updatePayload.passwordConfirm;
    }
    await service.update(existing.id, updatePayload);
    return;
  }

  // 3) Buat record baru (PocketBase membuat primary key sendiri)
  if (isUser) {
    const pwd =
      payload.password && String(payload.password).length >= 6
        ? String(payload.password)
        : 'bejo-' + id;
    const emailBase = String(payload.username || id)
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .toLowerCase();
    payload.password = pwd;
    payload.passwordConfirm = pwd;
    try {
      payload.email = emailBase + '@bejo.local';
      await service.create(payload);
    } catch (err: any) {
      if (err?.status !== 400) throw err;
      // Email sudah dipakai -> pakai email unik
      payload.email = emailBase + '-' + Date.now() + '@bejo.local';
      await service.create(payload);
    }
    return;
  }

  await service.create(payload);
}

async function removeRecord(collection: string, id: string): Promise<void> {
  const service = pbService(collection);
  if (PB_ID_PATTERN.test(id)) {
    try {
      await service.delete(id);
      return;
    } catch (err: any) {
      if (err?.status !== 404) throw err;
    }
  }
  const existing = await findByAppId(collection, id);
  if (existing) {
    await service.delete(existing.id);
  }
}

async function fetchAllRecords(
  collection: string,
  options?: { filter?: string; sort?: string; perPage?: number; expand?: string }
): Promise<any[]> {
  const service = pbService(collection);
  const result = await service.getList(1, options?.perPage || 500, {
    filter: options?.filter,
    sort: options?.sort,
    expand: options?.expand,
  });
  return result.items.map((item) => withAppId(stripPbFields(item as any)));
}

async function fetchOneRecord(
  collection: string,
  id: string,
  expand?: string
): Promise<any | null> {
  // Cari lewat legacyId terlebih dahulu (menghindari 404 pada id yang tidak valid)
  const byLegacy = await findByAppId(collection, id);
  if (byLegacy) return withAppId(stripPbFields(byLegacy));

  // Hanya probing getOne bila id resemble primary key PocketBase ([a-z0-9]{15})
  if (!PB_ID_PATTERN.test(id)) return null;

  try {
    const record = await pbService(collection).getOne(id, { expand });
    return withAppId(stripPbFields(record as any));
  } catch (err: any) {
    if (err?.status !== 404) throw err;
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Write / subscribe helpers                                                 */
/* -------------------------------------------------------------------------- */
export async function safeCloudWrite(
  operation: () => Promise<void>,
  opType: OperationType,
  path: string
): Promise<void> {
  if (isCloudUnavailable) return;
  try {
    await authReady;
    await operation();
  } catch (err: any) {
    if (isNetworkError(err)) {
      isCloudUnavailable = true;
      handleBackendError(err, opType, path);
      return;
    }
    handleBackendError(err, opType, path);
    throw err;
  }
}

/**
 * Membuat subscription real-time PocketBase.
 * `setupListener` menerima callback onError.
 */
function createSafeSubscription(
  path: string,
  opType: OperationType,
  setupListener: (onError: (error: any) => void) => () => void
): () => void {
  if (isCloudUnavailable) return () => {};

  let unsub: (() => void) | null = null;
  const onError = (error: any) => {
    handleBackendError(error, opType, path);
    if (isCloudUnavailable && unsub) {
      try {
        unsub();
        unsub = null;
      } catch {}
    }
  };

  let cancelled = false;
  try {
    authReady
      .then(() => {
        if (cancelled) return;
        unsub = setupListener(onError);
      })
      .catch((err) => onError(err));
  } catch (err) {
    onError(err);
    return () => {};
  }

  return () => {
    cancelled = true;
    if (unsub) {
      try {
        unsub();
        unsub = null;
      } catch {}
    }
  };
}

/**
 * Subscription daftar record (real-time).
 */
function subscribeCollection(
  collection: string,
  onData: (items: any[]) => void,
  onError: (error: any) => void,
  options?: { filter?: string; sort?: string }
): () => void {
  const service = pbService(collection);
  return subscribeRealtime(service as any, '*', async () => {
    try {
      const items = await fetchAllRecords(collection, {
        filter: options?.filter,
        sort: options?.sort,
      });
      onData(items);
    } catch (err) {
      onError(err);
    }
  });
}

/**
 * Subscription single record (settings / singletons).
 */
function subscribeRecord(
  collection: string,
  id: string,
  onData: (item: any | null) => void,
  onError: (error: any) => void
): () => void {
  const service = pbService(collection);
  return subscribeRealtime(service as any, id, async (e) => {
    try {
      if (e?.action === 'delete') {
        onData(null);
        return;
      }
      const item = await fetchOneRecord(collection, id);
      onData(item);
    } catch (err) {
      onError(err);
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Health check                                                              */
/* -------------------------------------------------------------------------- */
export async function testPocketBaseConnection(): Promise<boolean> {
  if (isCloudUnavailable) return false;
  try {
    await getPB().health.check();
    console.log('Connected to PocketBase successfully');
    return true;
  } catch (error: any) {
    if (isNetworkError(error)) {
      isCloudUnavailable = true;
      handleBackendError(error, OperationType.GET, 'health');
    } else {
      console.error('PocketBase configuration error:', error);
    }
    return false;
  }
}

/** Alias lama (kompatibilitas) */
export const testFirestoreConnection = testPocketBaseConnection;
export const testConnection = testPocketBaseConnection;

// Cek koneksi pada boot
testPocketBaseConnection();

/* -------------------------------------------------------------------------- */
/*  1. Products                                                               */
/* -------------------------------------------------------------------------- */
export function subscribeProducts(onData: (products: Product[]) => void): () => void {
  return createSafeSubscription('products', OperationType.LIST, (onError) =>
    subscribeCollection('products', (items) => onData(items as Product[]), onError)
  );
}

export async function saveProductCloud(product: Product): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('products', product.id, product as any);
  }, OperationType.WRITE, `products/${product.id}`);
}

export async function deleteProductCloud(productId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('products', productId);
  }, OperationType.DELETE, `products/${productId}`);
}

/* -------------------------------------------------------------------------- */
/*  2. Product Categories                                                      */
/* -------------------------------------------------------------------------- */
export function subscribeProductCategories(
  onData: (categories: ProductCategoryItem[]) => void
): () => void {
  return createSafeSubscription('product_categories', OperationType.LIST, (onError) =>
    subscribeCollection('product_categories', (items) => onData(items as ProductCategoryItem[]), onError)
  );
}

export async function saveProductCategoryCloud(category: ProductCategoryItem): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('product_categories', category.id, category as any);
  }, OperationType.WRITE, `product_categories/${category.id}`);
}

export async function deleteProductCategoryCloud(categoryId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('product_categories', categoryId);
  }, OperationType.DELETE, `product_categories/${categoryId}`);
}

/* -------------------------------------------------------------------------- */
/*  3. Customers                                                               */
/* -------------------------------------------------------------------------- */
export function subscribeCustomers(onData: (customers: Customer[]) => void): () => void {
  return createSafeSubscription('customers', OperationType.LIST, (onError) =>
    subscribeCollection('customers', (items) => onData(items as Customer[]), onError)
  );
}

export async function saveCustomerCloud(customer: Customer): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('customers', customer.id, customer as any);
  }, OperationType.WRITE, `customers/${customer.id}`);
}

export async function deleteCustomerCloud(customerId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('customers', customerId);
  }, OperationType.DELETE, `customers/${customerId}`);
}

/* -------------------------------------------------------------------------- */
/*  4. Customer Categories                                                     */
/* -------------------------------------------------------------------------- */
export function subscribeCustomerCategories(
  onData: (categories: CustomerCategory[]) => void
): () => void {
  return createSafeSubscription('customer_categories', OperationType.LIST, (onError) =>
    subscribeCollection('customer_categories', (items) => onData(items as CustomerCategory[]), onError)
  );
}

export async function saveCustomerCategoryCloud(category: CustomerCategory): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('customer_categories', category.id, category as any);
  }, OperationType.WRITE, `customer_categories/${category.id}`);
}

export async function deleteCustomerCategoryCloud(categoryId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('customer_categories', categoryId);
  }, OperationType.DELETE, `customer_categories/${categoryId}`);
}

/* -------------------------------------------------------------------------- */
/*  5. Transactions                                                            */
/* -------------------------------------------------------------------------- */
export function subscribeTransactions(onData: (transactions: Transaction[]) => void): () => void {
  return createSafeSubscription('transactions', OperationType.LIST, (onError) =>
    subscribeCollection('transactions', (items) => {
      const list = items as Transaction[];
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onData(list);
    }, onError)
  );
}

export async function saveTransactionCloud(tx: Transaction): Promise<void> {
  const safeDocId = tx.id.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    await upsertRecord('transactions', safeDocId, tx as any);
  }, OperationType.WRITE, `transactions/${safeDocId}`);
}

export async function deleteTransactionCloud(txId: string): Promise<void> {
  const safeDocId = txId.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    await removeRecord('transactions', safeDocId);
  }, OperationType.DELETE, `transactions/${safeDocId}`);
}

/* -------------------------------------------------------------------------- */
/*  6. Shifts                                                                  */
/* -------------------------------------------------------------------------- */
export function subscribeShifts(onData: (shifts: Shift[]) => void): () => void {
  return createSafeSubscription('shifts', OperationType.LIST, (onError) =>
    subscribeCollection('shifts', (items) => {
      const list = items as Shift[];
      list.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      onData(list);
    }, onError)
  );
}

export async function saveShiftCloud(shift: Shift): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('shifts', shift.id, shift as any);
  }, OperationType.WRITE, `shifts/${shift.id}`);
}

export async function deleteShiftCloud(shiftId: string): Promise<void> {
  const safeDocId = shiftId.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    await removeRecord('shifts', safeDocId);
  }, OperationType.DELETE, `shifts/${safeDocId}`);
}

/* -------------------------------------------------------------------------- */
/*  7. Store Info & Active Shift (collection: settings)                        */
/* -------------------------------------------------------------------------- */
export function subscribeStoreInfo(onData: (info: StoreInfo) => void): () => void {
  return createSafeSubscription('settings/store_info', OperationType.GET, (onError) =>
    subscribeRecord('settings', 'store_info', (item) => {
      if (item) onData(item as StoreInfo);
    }, onError)
  );
}

export async function saveStoreInfoCloud(info: StoreInfo): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('settings', 'store_info', info as any);
  }, OperationType.WRITE, 'settings/store_info');
}

/* -------------------------------------------------------------------------- */
/*  Multi-Store Profiles                                                       */
/* -------------------------------------------------------------------------- */
export function subscribeStoreProfiles(onData: (profiles: StoreProfile[]) => void): () => void {
  return createSafeSubscription('store_profiles', OperationType.LIST, (onError) =>
    subscribeCollection('store_profiles', (items) => {
      const list = items as StoreProfile[];
      if (list.length === 0) {
        onData([DEFAULT_MASTER_STORE_PROFILE]);
      } else {
        if (!list.some((p) => p.isMaster || p.id === 'bejo_polsek')) {
          list.unshift(DEFAULT_MASTER_STORE_PROFILE);
        }
        onData(list);
      }
    }, onError)
  );
}

export async function saveStoreProfileCloud(profile: StoreProfile): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('store_profiles', profile.id, profile as any);
  }, OperationType.WRITE, `store_profiles/${profile.id}`);
}

export async function deleteStoreProfileCloud(profileId: string): Promise<void> {
  if (profileId === 'bejo_polsek') return;
  return safeCloudWrite(async () => {
    await removeRecord('store_profiles', profileId);
  }, OperationType.DELETE, `store_profiles/${profileId}`);
}

export function subscribeActiveStoreProfileId(onData: (profileId: string) => void): () => void {
  return createSafeSubscription('settings/active_profile', OperationType.GET, (onError) =>
    subscribeRecord('settings', 'active_profile', (item) => {
      onData((item?.activeId as string) || 'bejo_polsek');
    }, onError)
  );
}

export async function saveActiveStoreProfileIdCloud(activeId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('settings', 'active_profile', { activeId: activeId || 'bejo_polsek' });
  }, OperationType.WRITE, 'settings/active_profile');
}

/* -------------------------------------------------------------------------- */
/*  Custom User Roles                                                          */
/* -------------------------------------------------------------------------- */
export function subscribeCustomRoles(onData: (roles: CustomRole[]) => void): () => void {
  return createSafeSubscription('custom_roles', OperationType.LIST, (onError) =>
    subscribeCollection('custom_roles', (items) => onData(items as CustomRole[]), onError)
  );
}

export async function saveCustomRoleCloud(role: CustomRole): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('custom_roles', role.id, role as any);
  }, OperationType.WRITE, `custom_roles/${role.id}`);
}

export async function deleteCustomRoleCloud(roleId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('custom_roles', roleId);
  }, OperationType.DELETE, `custom_roles/${roleId}`);
}

export function subscribeActiveShift(onData: (shift: Shift | null) => void): () => void {
  return createSafeSubscription('settings/active_shift', OperationType.GET, (onError) =>
    subscribeRecord('settings', 'active_shift', (item) => {
      onData(item && Object.keys(item).length > 0 ? (item as Shift) : null);
    }, onError)
  );
}

export async function saveActiveShiftCloud(shift: Shift | null): Promise<void> {
  return safeCloudWrite(async () => {
    if (!shift) {
      await removeRecord('settings', 'active_shift');
    } else {
      await upsertRecord('settings', 'active_shift', shift as any);
    }
  }, OperationType.WRITE, 'settings/active_shift');
}

/* -------------------------------------------------------------------------- */
/*  8. Cashiers                                                                */
/* -------------------------------------------------------------------------- */
export function subscribeCashiers(onData: (cashiers: CashierUser[]) => void): () => void {
  return createSafeSubscription('cashiers', OperationType.LIST, (onError) =>
    subscribeCollection('cashiers', (items) => onData(items as CashierUser[]), onError)
  );
}

export async function saveCashierCloud(cashier: CashierUser): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('cashiers', cashier.id, cashier as any);
  }, OperationType.WRITE, `cashiers/${cashier.id}`);
}

export async function deleteCashierCloud(cashierId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('cashiers', cashierId);
  }, OperationType.DELETE, `cashiers/${cashierId}`);
}

/* -------------------------------------------------------------------------- */
/*  9. Users                                                                   */
/* -------------------------------------------------------------------------- */
export function subscribeUsers(onData: (users: AppUser[]) => void): () => void {
  return createSafeSubscription('users', OperationType.LIST, (onError) =>
    subscribeCollection('users', (items) => onData(items as AppUser[]), onError, {
      filter: 'isActive = true',
    })
  );
}

export async function saveUserCloud(user: AppUser): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('users', user.id, user as any);
  }, OperationType.WRITE, `users/${user.id}`);
}

export async function deleteUserCloud(userId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('users', userId);
  }, OperationType.DELETE, `users/${userId}`);
}

/* -------------------------------------------------------------------------- */
/*  10. Stock Transactions                                                     */
/* -------------------------------------------------------------------------- */
export function subscribeStockTransactions(
  onData: (txs: StockTransaction[]) => void
): () => void {
  return createSafeSubscription('stock_transactions', OperationType.LIST, (onError) =>
    subscribeCollection('stock_transactions', (items) => onData(items as StockTransaction[]), onError)
  );
}

export async function saveStockTransactionCloud(tx: StockTransaction): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('stock_transactions', tx.id, tx as any);
  }, OperationType.WRITE, `stock_transactions/${tx.id}`);
}

export async function saveBatchStockTransactionsCloud(txs: StockTransaction[]): Promise<void> {
  if (!txs || txs.length === 0) return;
  return safeCloudWrite(async () => {
    for (const tx of txs) {
      await upsertRecord('stock_transactions', tx.id, tx as any);
    }
  }, OperationType.WRITE, 'stock_transactions');
}

export async function deleteStockTransactionCloud(txId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('stock_transactions', txId);
  }, OperationType.DELETE, `stock_transactions/${txId}`);
}

/* -------------------------------------------------------------------------- */
/*  11. Suppliers                                                              */
/* -------------------------------------------------------------------------- */
export function subscribeSuppliers(onData: (suppliers: Supplier[]) => void): () => void {
  return createSafeSubscription('suppliers', OperationType.LIST, (onError) =>
    subscribeCollection('suppliers', (items) => onData(items as Supplier[]), onError)
  );
}

export async function saveSupplierCloud(supplier: Supplier): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('suppliers', supplier.id, supplier as any);
  }, OperationType.WRITE, `suppliers/${supplier.id}`);
}

export async function deleteSupplierCloud(supplierId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('suppliers', supplierId);
  }, OperationType.DELETE, `suppliers/${supplierId}`);
}

/* -------------------------------------------------------------------------- */
/*  12. Agents                                                                 */
/* -------------------------------------------------------------------------- */
export function subscribeAgents(onData: (agents: Agent[]) => void): () => void {
  return createSafeSubscription('agents', OperationType.LIST, (onError) =>
    subscribeCollection('agents', (items) => onData(items as Agent[]), onError)
  );
}

export async function saveAgentCloud(agent: Agent): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('agents', agent.id, agent as any);
  }, OperationType.WRITE, `agents/${agent.id}`);
}

export async function deleteAgentCloud(agentId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('agents', agentId);
  }, OperationType.DELETE, `agents/${agentId}`);
}

/* -------------------------------------------------------------------------- */
/*  Activity Logs                                                              */
/* -------------------------------------------------------------------------- */
export function subscribeActivityLogs(onUpdate: (logs: UserActivityLog[]) => void): () => void {
  return createSafeSubscription('activity_logs', OperationType.LIST, (onError) =>
    subscribeCollection('activity_logs', (items) => {
      const list = items as UserActivityLog[];
      list.sort((a, b) => b.timestamp - a.timestamp);
      onUpdate(list);
    }, onError)
  );
}

export async function saveActivityLogCloud(logRecord: UserActivityLog): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('activity_logs', logRecord.id, logRecord as any);
  }, OperationType.WRITE, `activity_logs/${logRecord.id}`);
}

/* -------------------------------------------------------------------------- */
/*  13. Agent Notifications                                                    */
/* -------------------------------------------------------------------------- */
export function subscribeAgentNotifications(
  onData: (notifs: AgentNotification[]) => void
): () => void {
  return createSafeSubscription('agent_notifications', OperationType.LIST, (onError) =>
    subscribeCollection('agent_notifications', (items) => {
      const list = items as AgentNotification[];
      list.sort((a, b) => b.timestamp - a.timestamp);
      onData(list);
    }, onError)
  );
}

export async function saveAgentNotificationCloud(notif: AgentNotification): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('agent_notifications', notif.id, notif as any);
  }, OperationType.WRITE, `agent_notifications/${notif.id}`);
}

export async function markAgentNotificationReadCloud(
  notifId: string,
  userId: string
): Promise<void> {
  return safeCloudWrite(async () => {
    const current = await fetchOneRecord('agent_notifications', notifId);
    if (!current) return;
    const readBy: string[] = current.readBy || [];
    if (!readBy.includes(userId)) {
      await upsertRecord('agent_notifications', notifId, { readBy: [...readBy, userId] });
    }
  }, OperationType.WRITE, `agent_notifications/${notifId}`);
}

export async function deleteAgentNotificationCloud(notifId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('agent_notifications', notifId);
  }, OperationType.DELETE, `agent_notifications/${notifId}`);
}

/* -------------------------------------------------------------------------- */
/*  14. SPK Orders                                                             */
/* -------------------------------------------------------------------------- */
export function subscribeSpkOrders(onData: (orders: SpkOrder[]) => void): () => void {
  return createSafeSubscription('spk_orders', OperationType.LIST, (onError) =>
    subscribeCollection('spk_orders', (items) => {
      const list = items as SpkOrder[];
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onData(list);
    }, onError)
  );
}

export async function saveSpkOrderCloud(order: SpkOrder): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('spk_orders', order.id, order as any);
  }, OperationType.WRITE, `spk_orders/${order.id}`);
}

export async function deleteSpkOrderCloud(orderId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('spk_orders', orderId);
  }, OperationType.DELETE, `spk_orders/${orderId}`);
}

/* -------------------------------------------------------------------------- */
/*  15. Machines                                                               */
/* -------------------------------------------------------------------------- */
export function subscribeMachines(onData: (machines: MachineItem[]) => void): () => void {
  return createSafeSubscription('machines', OperationType.LIST, (onError) =>
    subscribeCollection('machines', (items) => onData(items as MachineItem[]), onError)
  );
}

export async function saveMachineCloud(machine: MachineItem): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('machines', machine.id, machine as any);
  }, OperationType.WRITE, `machines/${machine.id}`);
}

export async function deleteMachineCloud(machineId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('machines', machineId);
  }, OperationType.DELETE, `machines/${machineId}`);
}

/* -------------------------------------------------------------------------- */
/*  16. AI Chat Messages                                                       */
/* -------------------------------------------------------------------------- */
export function subscribeAiChatMessages(
  onData: (messages: AiInternalChatMessage[]) => void
): () => void {
  return createSafeSubscription('ai_chat_messages', OperationType.LIST, (onError) =>
    subscribeCollection('ai_chat_messages', (items) => {
      const list = items as AiInternalChatMessage[];
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      onData(list);
    }, onError)
  );
}

export async function saveAiChatMessageCloud(message: AiInternalChatMessage): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('ai_chat_messages', message.id, message as any);
  }, OperationType.WRITE, `ai_chat_messages/${message.id}`);
}

/* -------------------------------------------------------------------------- */
/*  17. User Mentions                                                          */
/* -------------------------------------------------------------------------- */
export function subscribeUserMentions(
  targetUsername: string,
  onData: (notifications: UserMentionNotification[]) => void
): () => void {
  return createSafeSubscription('user_mentions', OperationType.LIST, (onError) =>
    subscribeCollection(
      'user_mentions',
      (items) => {
        const list = (items as UserMentionNotification[]).filter((d) =>
          d.targetUsername ? d.targetUsername.toLowerCase() === targetUsername.toLowerCase() : false
        );
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        onData(list);
      },
      onError
    )
  );
}

export async function saveUserMentionCloud(notif: UserMentionNotification): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('user_mentions', notif.id, notif as any);
  }, OperationType.WRITE, `user_mentions/${notif.id}`);
}

export async function markUserMentionReadCloud(notifId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('user_mentions', notifId, { isRead: true });
  }, OperationType.WRITE, `user_mentions/${notifId}`);
}

/* -------------------------------------------------------------------------- */
/*  18. Private Chat Messages                                                   */
/* -------------------------------------------------------------------------- */
export function subscribePrivateChatMessages(
  user1: string,
  user2: string,
  onData: (messages: PrivateChatMessage[]) => void
): () => void {
  const u1 = user1.toLowerCase();
  const u2 = user2.toLowerCase();
  return createSafeSubscription('private_chat_messages', OperationType.LIST, (onError) =>
    subscribeCollection('private_chat_messages', (items) => {
      const list = (items as PrivateChatMessage[]).filter(
        (d) =>
          d.senderUsername?.toLowerCase() === u1 && d.recipientUsername?.toLowerCase() === u2
      );
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      onData(list);
    }, onError)
  );
}

export function subscribeAllMyPrivateMessages(
  myUsername: string,
  onData: (messages: PrivateChatMessage[]) => void
): () => void {
  const me = myUsername.toLowerCase();
  return createSafeSubscription('private_chat_messages', OperationType.LIST, (onError) =>
    subscribeCollection('private_chat_messages', (items) => {
      const list = (items as PrivateChatMessage[]).filter(
        (d) =>
          d.senderUsername?.toLowerCase() === me || d.recipientUsername?.toLowerCase() === me
      );
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      onData(list);
    }, onError)
  );
}

export async function savePrivateChatMessageCloud(message: PrivateChatMessage): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('private_chat_messages', message.id, message as any);
  }, OperationType.WRITE, `private_chat_messages/${message.id}`);
}

/* -------------------------------------------------------------------------- */
/*  19. Printing Rejects                                                       */
/* -------------------------------------------------------------------------- */
export function subscribePrintingRejects(
  callback: (rejects: PrintingRejectRecord[]) => void
): () => void {
  return createSafeSubscription('printing_rejects', OperationType.LIST, (onError) =>
    subscribeCollection('printing_rejects', (items) => {
      const list = items as PrintingRejectRecord[];
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(list);
    }, onError)
  );
}

export async function savePrintingRejectCloud(record: PrintingRejectRecord): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('printing_rejects', record.id, record as any);
  }, OperationType.WRITE, `printing_rejects/${record.id}`);
}

export async function deletePrintingRejectCloud(rejectId: string): Promise<void> {
  return safeCloudWrite(async () => {
    await removeRecord('printing_rejects', rejectId);
  }, OperationType.DELETE, `printing_rejects/${rejectId}`);
}

/* -------------------------------------------------------------------------- */
/*  20. Invoices                                                               */
/* -------------------------------------------------------------------------- */
export function subscribeInvoices(callback: (invoices: Invoice[]) => void): () => void {
  return createSafeSubscription('invoices', OperationType.LIST, (onError) =>
    subscribeCollection('invoices', (items) => {
      const list = items as Invoice[];
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    }, onError)
  );
}

export async function saveInvoiceCloud(invoice: Invoice): Promise<void> {
  const safeDocId = invoice.id.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    await upsertRecord('invoices', safeDocId, invoice as any);
  }, OperationType.WRITE, `invoices/${invoice.id}`);
}

export async function deleteInvoiceCloud(invoiceId: string): Promise<void> {
  const safeDocId = invoiceId.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    await removeRecord('invoices', safeDocId);
    if (invoiceId !== safeDocId) {
      await removeRecord('invoices', invoiceId).catch(() => {});
    }
  }, OperationType.DELETE, `invoices/${invoiceId}`);
}

/* -------------------------------------------------------------------------- */
/*  21. Invoice Store Identity                                                  */
/* -------------------------------------------------------------------------- */
export function subscribeInvoiceStoreIdentity(
  callback: (identity: InvoiceStoreIdentity | null) => void
): () => void {
  return createSafeSubscription('invoice_settings/store_identity', OperationType.GET, (onError) =>
    subscribeRecord('invoice_settings', 'store_identity', (item) => {
      callback((item as InvoiceStoreIdentity) ?? null);
    }, onError)
  );
}

export async function saveInvoiceStoreIdentityCloud(
  identity: InvoiceStoreIdentity
): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('invoice_settings', 'store_identity', identity as any);
  }, OperationType.WRITE, 'invoice_settings/store_identity');
}

/* -------------------------------------------------------------------------- */
/*  22. Tax Module                                                             */
/* -------------------------------------------------------------------------- */
export function subscribeTaxpayerProfile(
  callback: (profile: TaxpayerProfile | null) => void
): () => void {
  return createSafeSubscription('taxpayer_profile/primary', OperationType.GET, (onError) =>
    subscribeRecord('taxpayer_profile', 'primary', (item) => {
      callback((item as TaxpayerProfile) ?? null);
    }, onError)
  );
}

export async function saveTaxpayerProfileCloud(profile: TaxpayerProfile): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('taxpayer_profile', 'primary', profile as any);
  }, OperationType.WRITE, 'taxpayer_profile/primary');
}

export function subscribeTaxAnnualReturns(
  callback: (returns: TaxAnnualReturn1770[]) => void
): () => void {
  return createSafeSubscription('tax_annual_returns', OperationType.LIST, (onError) =>
    subscribeCollection('tax_annual_returns', (items) => {
      const list = items as TaxAnnualReturn1770[];
      list.sort((a, b) => b.taxYear - a.taxYear);
      callback(list);
    }, onError)
  );
}

export async function saveTaxAnnualReturnCloud(returnItem: TaxAnnualReturn1770): Promise<void> {
  const safeDocId = returnItem.id.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    await upsertRecord('tax_annual_returns', safeDocId, returnItem as any);
  }, OperationType.WRITE, `tax_annual_returns/${returnItem.id}`);
}

export async function saveAllTaxAnnualReturnsCloud(
  returns: TaxAnnualReturn1770[]
): Promise<void> {
  if (!returns || !returns.length) return;
  return safeCloudWrite(async () => {
    for (const r of returns) {
      const safeDocId = r.id.replace(/\//g, '_');
      await upsertRecord('tax_annual_returns', safeDocId, r as any);
    }
  }, OperationType.WRITE, 'tax_annual_returns/batch');
}

export async function deleteTaxAnnualReturnCloud(returnId: string): Promise<void> {
  const safeDocId = returnId.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    await removeRecord('tax_annual_returns', safeDocId);
  }, OperationType.DELETE, `tax_annual_returns/${returnId}`);
}

export function subscribeTaxMonthlyBillings(
  callback: (billings: MonthlyBillingsByYear | null) => void
): () => void {
  return createSafeSubscription('tax_monthly_billings/all_years', OperationType.GET, (onError) =>
    subscribeRecord('tax_monthly_billings', 'all_years', (item) => {
      if (item && (item as any).billingsByYear) {
        callback((item as any).billingsByYear as MonthlyBillingsByYear);
      } else {
        callback((item as unknown as MonthlyBillingsByYear) ?? null);
      }
    }, onError)
  );
}

export async function saveTaxMonthlyBillingsCloud(
  billings: MonthlyBillingsByYear
): Promise<void> {
  return safeCloudWrite(async () => {
    await upsertRecord('tax_monthly_billings', 'all_years', {
      billingsByYear: billings,
      updatedAt: Date.now(),
    });
  }, OperationType.WRITE, 'tax_monthly_billings/all_years');
}

/* -------------------------------------------------------------------------- */
/*  Seeding database                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Kunci modul agar seeding hanya berjalan SATU KALI per instance aplikasi.
 * (React StrictMode / multi-tab bisa memanggil seeding berkali-kali sehingga
 *  record duplikat pernah terjadi bila dua proses seeding berjalan bersamaan.)
 */
let seedPromise: Promise<void> | null = null;

export function seedDatabaseIfEmpty(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null; // izinkan percobaan ulang bila gagal
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  if (isCloudUnavailable) {
    console.warn('[PocketBase] Seeding dilewati karena server tidak terjangkau.');
    return;
  }
  try {
    await authReady;

    const initRecord = await fetchOneRecord('settings', 'database_init');
    if (initRecord?.isSeeded) {
      // Database sudah di-seed sebelumnya
      return;
    }

    // Pengaman lintas-tab: proses seeding lain sedang berjalan
    if (initRecord?.seedingAt) {
      const startedAt = Number(initRecord.seedingAt) || 0;
      if (Date.now() - startedAt < 5 * 60 * 1000) {
        console.log('[PocketBase] Seeding sedang berjalan di instance lain - dilewati.');
        return;
      }
    }

    const existing = await fetchAllRecords('products');
    if (existing.length > 0) {
      await upsertRecord('settings', 'database_init', {
        isSeeded: true,
        seededAt: new Date().toISOString(),
      });
      return;
    }

    console.log('Seeding initial Bejo Stiker data to PocketBase...');

    // Tandai sedang seeding (pengaman untuk tab/perangkat lain)
    await upsertRecord('settings', 'database_init', {
      isSeeded: false,
      seedingAt: Date.now(),
    });

    const seed = async (
      collection: string,
      items: Array<{ id: string } & Record<string, any>>
    ) => {
      for (const item of items) {
        const { id, ...rest } = item;
        await upsertRecord(collection, id, rest as any);
      }
    };

    await seed('products', INITIAL_PRODUCTS as any);
    await seed('product_categories', DEFAULT_PRODUCT_CATEGORIES as any);
    await seed('customer_categories', INITIAL_CATEGORIES as any);
    await seed('customers', INITIAL_CUSTOMERS as any);
    await seed('cashiers', INITIAL_CASHIERS as any);
    await seed('users', INITIAL_USERS as any);
    await seed('suppliers', INITIAL_SUPPLIERS as any);
    await seed('agents', INITIAL_AGENTS as any);
    await seed(
      'transactions',
      INITIAL_TRANSACTIONS.map((tx) => ({
        ...tx,
        id: tx.id.replace(/\//g, '_'),
      })) as any
    );
    await seed('store_profiles', DEFAULT_STORE_PROFILES as any);
    await seed('spk_orders', DEFAULT_SPK_ORDERS as any);
    await seed('machines', DEFAULT_MACHINES as any);
    await upsertRecord('settings', 'store_info', DEFAULT_STORE_INFO as any);

    await upsertRecord('settings', 'database_init', {
      isSeeded: true,
      seededAt: new Date().toISOString(),
      seedingAt: 0,
    });

    console.log('Successfully seeded database with initial data!');
  } catch (e: any) {
    if (isNetworkError(e)) {
      isCloudUnavailable = true;
      console.warn('[PocketBase] Server tidak terjangkau saat seeding. Mode Lokal diaktifkan.');
      handleBackendError(e, OperationType.WRITE, 'seedDatabase');
    } else {
      console.error('Error seeding initial data to PocketBase:', e);
    }
  }
}

/**
 * Keamanan: role, akun agen, profil toko, dan agen disinkronkan ke database.
 * (Deprecated — gunakan seedDatabaseIfEmpty)
 */
export async function syncAgentSettingsToCloud(): Promise<void> {
  return;
}
