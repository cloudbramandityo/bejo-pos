/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
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
} from './types';
import {
  TaxAnnualReturn1770,
  TaxpayerProfile,
  MonthlyBillingsByYear
} from './types/tax';
import {
  StoreInfo,
  DEFAULT_STORE_INFO,
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_MASTER_STORE_PROFILE,
  DEFAULT_STORE_PROFILES,
  DEFAULT_MACHINES,
  DEFAULT_SPK_ORDERS
} from './utils/storage';
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
} from './data/initialData';

// Initialize Firebase App safely
export const app = initializeApp(firebaseConfig);

let firestoreInstance;
try {
  if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
    firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    firestoreInstance = getFirestore(app);
  }
} catch (err) {
  console.warn('[Firebase Init] Failed to initialize Firestore with custom database ID, using default instance:', err);
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Global Firestore Quota & Health State Flag
let isQuotaExceededFlag = false;
let hasReportedQuotaExceeded = false;

export function isFirestoreQuotaExceeded(): boolean {
  return isQuotaExceededFlag;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code || '';
  
  const isPayloadSizeErr = errMessage.includes('exceeds the limit') || errMessage.includes('payload size');
  if (isPayloadSizeErr) {
    console.warn(`[Firestore Payload] Write payload for ${path} was too large for Firestore direct upload. Operating in Local Vault storage.`);
    return {
      error: 'Payload size exceeds limit. Stored locally.',
      authInfo: { providerInfo: [] },
      operationType,
      path
    };
  }

  const isQuotaErr =
    errMessage.includes('Quota exceeded') ||
    errMessage.includes('quota') ||
    errMessage.includes('resource-exhausted') ||
    errMessage.includes('RESOURCE_EXHAUSTED') ||
    String(errCode).includes('resource-exhausted') ||
    String(errCode).includes('quota');

  if (isQuotaErr) {
    isQuotaExceededFlag = true;

    if (!hasReportedQuotaExceeded) {
      hasReportedQuotaExceeded = true;
      console.warn('[Firestore Quota] Cloud database daily free quota limit reached. System automatically operating in Local Storage Mode.');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('app:backend-error', {
            detail: {
              source: 'FIRESTORE',
              title: 'Database Offline (Mode Lokal Aktif)',
              message: 'Seluruh data transaksi, stok, dan akun aplikasi Bejo Stiker tetap AMAN dan beroperasi penuh menggunakan Mode Lokal (Local Storage) berkecepatan tinggi. Data akan otomatis tersinkronisasi ketika Database online.',
              code: 'ERR_FIRESTORE_QUOTA_EXCEEDED'
            }
          })
        );
        window.dispatchEvent(
          new CustomEvent('app:quota-exceeded', {
            detail: { isQuotaExceeded: true }
          })
        );
      }
    }

    return {
      error: 'Quota exceeded. Operating in local storage mode.',
      authInfo: { providerInfo: [] },
      operationType,
      path
    };
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  // Dispatch client error event for backend diagnostics if running in browser
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:backend-error', {
        detail: {
          source: 'FIRESTORE',
          title: `Firestore DB ${operationType} Error (${path || 'Koleksi'})`,
          message: errMessage,
          code: `ERR_FIRESTORE_${operationType.toUpperCase()}`
        }
      })
    );
  }

  return errInfo;
}

export async function testConnection(): Promise<boolean> {
  if (isQuotaExceededFlag) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Connected to Firestore successfully');
    return true;
  } catch (error: any) {
    if (error?.message?.includes('Quota exceeded') || error?.message?.includes('quota')) {
      isQuotaExceededFlag = true;
      handleFirestoreError(error, OperationType.GET, 'test/connection');
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
    return false;
  }
}

// Call testConnection on initial boot as required by Firebase skill
testConnection();
export const testFirestoreConnection = testConnection;

// Helper to sanitize data for Firestore (recursively removes undefined fields, drops oversized base64/data URLs, and handles NaN/functions)
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'number') {
    if (isNaN(obj)) return 0 as unknown as T;
    return obj;
  }
  if (typeof obj === 'string') {
    // Prevent giant base64 payloads from overflowing Firestore's 1MB document limit
    if (obj.length > 50000 && (obj.startsWith('data:') || obj.startsWith('blob:'))) {
      return '' as unknown as T;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined && typeof item !== 'function')
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Omit local binary blob keys or massive embedded data
      if (key === 'fileDataUrl' || key === 'previewThumbnail' || key === 'blob') {
        continue;
      }
      if (value !== undefined && typeof value !== 'function') {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj as T;
  }
  return obj;
}

// Helper to execute cloud write/delete safely when quota is exceeded
export async function safeCloudWrite(operation: () => Promise<void>, opType: OperationType, path: string): Promise<void> {
  if (isQuotaExceededFlag) return;
  try {
    await operation();
  } catch (err: any) {
    if (err?.message?.includes('Quota exceeded') || err?.message?.includes('quota')) {
      isQuotaExceededFlag = true;
      handleFirestoreError(err, opType, path);
      return;
    }
    handleFirestoreError(err, opType, path);
    throw err;
  }
}

// Helper to manage realtime subscriptions safely without persistent stream retries when quota is exceeded
function createSafeSubscription(
  path: string,
  opType: OperationType,
  setupListener: (onError: (error: any) => void) => Unsubscribe
): Unsubscribe {
  if (isQuotaExceededFlag) return () => {};

  let unsub: Unsubscribe | null = null;
  const onError = (error: any) => {
    handleFirestoreError(error, opType, path);
    if (isQuotaExceededFlag && unsub) {
      try {
        unsub();
        unsub = null;
      } catch {}
    }
  };

  try {
    unsub = setupListener(onError);
  } catch (err) {
    onError(err);
    return () => {};
  }

  return () => {
    if (unsub) {
      try {
        unsub();
        unsub = null;
      } catch {}
    }
  };
}

// ----------------------------------------------------
// Realtime Sync Handlers & Cloud Persistence Methods
// ----------------------------------------------------

// 1. Products
export function subscribeProducts(onData: (products: Product[]) => void): Unsubscribe {
  return createSafeSubscription('products', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'products');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: Product[] = [];
        snapshot.forEach((d) => items.push(d.data() as Product));
        onData(items);
      },
      onError
    );
  });
}

export async function saveProductCloud(product: Product): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'products', product.id);
    await setDoc(docRef, sanitizeForFirestore(product), { merge: true });
  }, OperationType.WRITE, `products/${product.id}`);
}

export async function deleteProductCloud(productId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `products/${productId}`);
}

// 2. Product Categories
export function subscribeProductCategories(onData: (categories: ProductCategoryItem[]) => void): Unsubscribe {
  return createSafeSubscription('product_categories', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'product_categories');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: ProductCategoryItem[] = [];
        snapshot.forEach((d) => items.push(d.data() as ProductCategoryItem));
        onData(items);
      },
      onError
    );
  });
}

export async function saveProductCategoryCloud(category: ProductCategoryItem): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'product_categories', category.id);
    await setDoc(docRef, sanitizeForFirestore(category), { merge: true });
  }, OperationType.WRITE, `product_categories/${category.id}`);
}

export async function deleteProductCategoryCloud(categoryId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'product_categories', categoryId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `product_categories/${categoryId}`);
}

// 3. Customers
export function subscribeCustomers(onData: (customers: Customer[]) => void): Unsubscribe {
  return createSafeSubscription('customers', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'customers');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: Customer[] = [];
        snapshot.forEach((d) => items.push(d.data() as Customer));
        onData(items);
      },
      onError
    );
  });
}

export async function saveCustomerCloud(customer: Customer): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'customers', customer.id);
    await setDoc(docRef, sanitizeForFirestore(customer), { merge: true });
  }, OperationType.WRITE, `customers/${customer.id}`);
}

export async function deleteCustomerCloud(customerId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'customers', customerId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `customers/${customerId}`);
}

// 4. Customer Categories
export function subscribeCustomerCategories(onData: (categories: CustomerCategory[]) => void): Unsubscribe {
  return createSafeSubscription('customer_categories', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'customer_categories');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: CustomerCategory[] = [];
        snapshot.forEach((d) => items.push(d.data() as CustomerCategory));
        onData(items);
      },
      onError
    );
  });
}

export async function saveCustomerCategoryCloud(category: CustomerCategory): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'customer_categories', category.id);
    await setDoc(docRef, sanitizeForFirestore(category), { merge: true });
  }, OperationType.WRITE, `customer_categories/${category.id}`);
}

export async function deleteCustomerCategoryCloud(categoryId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'customer_categories', categoryId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `customer_categories/${categoryId}`);
}

// 5. Transactions
export function subscribeTransactions(onData: (transactions: Transaction[]) => void): Unsubscribe {
  return createSafeSubscription('transactions', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'transactions');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: Transaction[] = [];
        snapshot.forEach((d) => items.push(d.data() as Transaction));
        // Sort newest first
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        onData(items);
      },
      onError
    );
  });
}

export async function saveTransactionCloud(tx: Transaction): Promise<void> {
  const safeDocId = tx.id.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'transactions', safeDocId);
    await setDoc(docRef, sanitizeForFirestore(tx), { merge: true });
  }, OperationType.WRITE, `transactions/${safeDocId}`);
}

export async function deleteTransactionCloud(txId: string): Promise<void> {
  const safeDocId = txId.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'transactions', safeDocId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `transactions/${safeDocId}`);
}

// 6. Shifts
export function subscribeShifts(onData: (shifts: Shift[]) => void): Unsubscribe {
  return createSafeSubscription('shifts', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'shifts');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: Shift[] = [];
        snapshot.forEach((d) => items.push(d.data() as Shift));
        // Sort newest first
        items.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        onData(items);
      },
      onError
    );
  });
}

export async function saveShiftCloud(shift: Shift): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'shifts', shift.id);
    await setDoc(docRef, sanitizeForFirestore(shift), { merge: true });
  }, OperationType.WRITE, `shifts/${shift.id}`);
}

export async function deleteShiftCloud(shiftId: string): Promise<void> {
  const safeDocId = shiftId.replace(/\//g, '_');
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'shifts', safeDocId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `shifts/${safeDocId}`);
}

// 7. Store Info & Active Shift (Settings collection)
export function subscribeStoreInfo(onData: (info: StoreInfo) => void): Unsubscribe {
  return createSafeSubscription('settings/store_info', OperationType.GET, (onError) => {
    const docRef = doc(db, 'settings', 'store_info');
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onData(snapshot.data() as StoreInfo);
        }
      },
      onError
    );
  });
}

export async function saveStoreInfoCloud(info: StoreInfo): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'settings', 'store_info');
    await setDoc(docRef, sanitizeForFirestore(info), { merge: true });
  }, OperationType.WRITE, 'settings/store_info');
}

// Multi-Store Profiles Sync
export function subscribeStoreProfiles(onData: (profiles: StoreProfile[]) => void): Unsubscribe {
  return createSafeSubscription('store_profiles', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'store_profiles');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: StoreProfile[] = [];
        snapshot.forEach((d) => items.push(d.data() as StoreProfile));
        if (items.length === 0) {
          onData([DEFAULT_MASTER_STORE_PROFILE]);
        } else {
          if (!items.some((p) => p.isMaster || p.id === 'bejo_polsek')) {
            items.unshift(DEFAULT_MASTER_STORE_PROFILE);
          }
          onData(items);
        }
      },
      onError
    );
  });
}

export async function saveStoreProfileCloud(profile: StoreProfile): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'store_profiles', profile.id);
    await setDoc(docRef, sanitizeForFirestore(profile), { merge: true });
  }, OperationType.WRITE, `store_profiles/${profile.id}`);
}

export async function deleteStoreProfileCloud(profileId: string): Promise<void> {
  if (profileId === 'bejo_polsek') return;
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'store_profiles', profileId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `store_profiles/${profileId}`);
}

export function subscribeActiveStoreProfileId(onData: (profileId: string) => void): Unsubscribe {
  return createSafeSubscription('settings/active_profile', OperationType.GET, (onError) => {
    const docRef = doc(db, 'settings', 'active_profile');
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onData(data?.activeId || 'bejo_polsek');
        } else {
          onData('bejo_polsek');
        }
      },
      onError
    );
  });
}

export async function saveActiveStoreProfileIdCloud(activeId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'settings', 'active_profile');
    await setDoc(docRef, { activeId: activeId || 'bejo_polsek' }, { merge: true });
  }, OperationType.WRITE, 'settings/active_profile');
}

// Custom User Roles Cloud Sync
export function subscribeCustomRoles(onData: (roles: CustomRole[]) => void): Unsubscribe {
  return createSafeSubscription('custom_roles', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'custom_roles');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: CustomRole[] = [];
        snapshot.forEach((d) => items.push(d.data() as CustomRole));
        onData(items);
      },
      onError
    );
  });
}

export async function saveCustomRoleCloud(role: CustomRole): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'custom_roles', role.id);
    await setDoc(docRef, sanitizeForFirestore(role), { merge: true });
  }, OperationType.WRITE, `custom_roles/${role.id}`);
}

export async function deleteCustomRoleCloud(roleId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'custom_roles', roleId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `custom_roles/${roleId}`);
}

export function subscribeActiveShift(onData: (shift: Shift | null) => void): Unsubscribe {
  return createSafeSubscription('settings/active_shift', OperationType.GET, (onError) => {
    const docRef = doc(db, 'settings', 'active_shift');
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onData(data && Object.keys(data).length > 0 ? (data as Shift) : null);
        } else {
          onData(null);
        }
      },
      onError
    );
  });
}

export async function saveActiveShiftCloud(shift: Shift | null): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'settings', 'active_shift');
    if (!shift) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, sanitizeForFirestore(shift));
    }
  }, OperationType.WRITE, 'settings/active_shift');
}

// 7. Cashiers Management
export function subscribeCashiers(onData: (cashiers: CashierUser[]) => void): Unsubscribe {
  return createSafeSubscription('cashiers', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'cashiers');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: CashierUser[] = [];
        snapshot.forEach((d) => items.push(d.data() as CashierUser));
        onData(items);
      },
      onError
    );
  });
}

export async function saveCashierCloud(cashier: CashierUser): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'cashiers', cashier.id);
    await setDoc(docRef, sanitizeForFirestore(cashier), { merge: true });
  }, OperationType.WRITE, `cashiers/${cashier.id}`);
}

export async function deleteCashierCloud(cashierId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'cashiers', cashierId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `cashiers/${cashierId}`);
}

// 8. Users & Role-Based Auth Management
export function subscribeUsers(onData: (users: AppUser[]) => void): Unsubscribe {
  return createSafeSubscription('users', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'users');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: AppUser[] = [];
        snapshot.forEach((d) => items.push(d.data() as AppUser));
        onData(items);
      },
      onError
    );
  });
}

export async function saveUserCloud(user: AppUser): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'users', user.id);
    await setDoc(docRef, sanitizeForFirestore(user), { merge: true });
  }, OperationType.WRITE, `users/${user.id}`);
}

export async function deleteUserCloud(userId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'users', userId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `users/${userId}`);
}

// 9. Stock Transactions
export function subscribeStockTransactions(onData: (txs: StockTransaction[]) => void): Unsubscribe {
  return createSafeSubscription('stock_transactions', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'stock_transactions');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: StockTransaction[] = [];
        snapshot.forEach((d) => items.push(d.data() as StockTransaction));
        onData(items);
      },
      onError
    );
  });
}

export async function saveStockTransactionCloud(tx: StockTransaction): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'stock_transactions', tx.id);
    await setDoc(docRef, sanitizeForFirestore(tx), { merge: true });
  }, OperationType.WRITE, `stock_transactions/${tx.id}`);
}

export async function saveBatchStockTransactionsCloud(txs: StockTransaction[]): Promise<void> {
  if (!txs || txs.length === 0) return;
  return safeCloudWrite(async () => {
    const batch = writeBatch(db);
    txs.forEach((tx) => {
      const docRef = doc(db, 'stock_transactions', tx.id);
      batch.set(docRef, sanitizeForFirestore(tx), { merge: true });
    });
    await batch.commit();
  }, OperationType.WRITE, 'stock_transactions');
}

export async function deleteStockTransactionCloud(txId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'stock_transactions', txId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `stock_transactions/${txId}`);
}

// 10. Suppliers
export function subscribeSuppliers(onData: (suppliers: Supplier[]) => void): Unsubscribe {
  return createSafeSubscription('suppliers', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'suppliers');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: Supplier[] = [];
        snapshot.forEach((d) => items.push(d.data() as Supplier));
        onData(items);
      },
      onError
    );
  });
}

export async function saveSupplierCloud(supplier: Supplier): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'suppliers', supplier.id);
    await setDoc(docRef, sanitizeForFirestore(supplier), { merge: true });
  }, OperationType.WRITE, `suppliers/${supplier.id}`);
}

export async function deleteSupplierCloud(supplierId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'suppliers', supplierId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `suppliers/${supplierId}`);
}

// 11. Agents
export function subscribeAgents(onData: (agents: Agent[]) => void): Unsubscribe {
  return createSafeSubscription('agents', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'agents');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: Agent[] = [];
        snapshot.forEach((d) => items.push(d.data() as Agent));
        onData(items);
      },
      onError
    );
  });
}

export async function saveAgentCloud(agent: Agent): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'agents', agent.id);
    await setDoc(docRef, sanitizeForFirestore(agent), { merge: true });
  }, OperationType.WRITE, `agents/${agent.id}`);
}

export async function deleteAgentCloud(agentId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'agents', agentId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `agents/${agentId}`);
}

// Activity Logs Cloud Synchronization
export function subscribeActivityLogs(onUpdate: (logs: UserActivityLog[]) => void): Unsubscribe {
  return createSafeSubscription('activity_logs', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'activity_logs');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: UserActivityLog[] = snapshot.docs.map((docSnap) => docSnap.data() as UserActivityLog);
        items.sort((a, b) => b.timestamp - a.timestamp);
        onUpdate(items);
      },
      onError
    );
  });
}

export async function saveActivityLogCloud(logRecord: UserActivityLog): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'activity_logs', logRecord.id);
    await setDoc(docRef, sanitizeForFirestore(logRecord), { merge: true });
  }, OperationType.WRITE, `activity_logs/${logRecord.id}`);
}

// ----------------------------------------------------
// 12. Agent Notifications (Real-time for DEVELOPER & ADMIN)
// ----------------------------------------------------
export function subscribeAgentNotifications(onData: (notifs: AgentNotification[]) => void): Unsubscribe {
  return createSafeSubscription('agent_notifications', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'agent_notifications');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: AgentNotification[] = [];
        snapshot.forEach((d) => items.push(d.data() as AgentNotification));
        items.sort((a, b) => b.timestamp - a.timestamp);
        onData(items);
      },
      onError
    );
  });
}

export async function saveAgentNotificationCloud(notif: AgentNotification): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'agent_notifications', notif.id);
    await setDoc(docRef, sanitizeForFirestore(notif), { merge: true });
  }, OperationType.WRITE, `agent_notifications/${notif.id}`);
}

export async function markAgentNotificationReadCloud(notifId: string, userId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'agent_notifications', notifId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as AgentNotification;
      const currentRead = data.readBy || [];
      if (!currentRead.includes(userId)) {
        await setDoc(docRef, { readBy: [...currentRead, userId] }, { merge: true });
      }
    }
  }, OperationType.WRITE, `agent_notifications/${notifId}`);
}

export async function deleteAgentNotificationCloud(notifId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'agent_notifications', notifId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `agent_notifications/${notifId}`);
}

// 13. SPK Orders Real-time Sync
export function subscribeSpkOrders(onData: (orders: SpkOrder[]) => void): Unsubscribe {
  return createSafeSubscription('spk_orders', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'spk_orders');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: SpkOrder[] = [];
        snapshot.forEach((d) => items.push(d.data() as SpkOrder));
        // Sort newest first
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        onData(items);
      },
      onError
    );
  });
}

export async function saveSpkOrderCloud(order: SpkOrder): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'spk_orders', order.id);
    await setDoc(docRef, sanitizeForFirestore(order), { merge: true });
  }, OperationType.WRITE, `spk_orders/${order.id}`);
}

export async function deleteSpkOrderCloud(orderId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'spk_orders', orderId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `spk_orders/${orderId}`);
}

// 14. Machines Real-time Sync
export function subscribeMachines(onData: (machines: MachineItem[]) => void): Unsubscribe {
  return createSafeSubscription('machines', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'machines');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: MachineItem[] = [];
        snapshot.forEach((d) => items.push(d.data() as MachineItem));
        onData(items);
      },
      onError
    );
  });
}

export async function saveMachineCloud(machine: MachineItem): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'machines', machine.id);
    await setDoc(docRef, sanitizeForFirestore(machine), { merge: true });
  }, OperationType.WRITE, `machines/${machine.id}`);
}

export async function deleteMachineCloud(machineId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'machines', machineId);
    await deleteDoc(docRef);
  }, OperationType.DELETE, `machines/${machineId}`);
}

// 15. AI Internal Chat Messages Real-time Sync
export function subscribeAiChatMessages(onData: (messages: AiInternalChatMessage[]) => void): Unsubscribe {
  return createSafeSubscription('ai_chat_messages', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'ai_chat_messages');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: AiInternalChatMessage[] = [];
        snapshot.forEach((d) => items.push(d.data() as AiInternalChatMessage));
        // Sort chronologically
        items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        onData(items);
      },
      onError
    );
  });
}

export async function saveAiChatMessageCloud(message: AiInternalChatMessage): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'ai_chat_messages', message.id);
    await setDoc(docRef, sanitizeForFirestore(message), { merge: true });
  }, OperationType.WRITE, `ai_chat_messages/${message.id}`);
}

// 16. User Mention Notifications Real-time Sync (@userX)
export function subscribeUserMentions(targetUsername: string, onData: (notifications: UserMentionNotification[]) => void): Unsubscribe {
  return createSafeSubscription('user_mentions', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'user_mentions');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: UserMentionNotification[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as UserMentionNotification;
          if (data.targetUsername && data.targetUsername.toLowerCase() === targetUsername.toLowerCase()) {
            items.push(data);
          }
        });
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        onData(items);
      },
      onError
    );
  });
}

export async function saveUserMentionCloud(notif: UserMentionNotification): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'user_mentions', notif.id);
    await setDoc(docRef, sanitizeForFirestore(notif), { merge: true });
  }, OperationType.WRITE, `user_mentions/${notif.id}`);
}

export async function markUserMentionReadCloud(notifId: string): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'user_mentions', notifId);
    await setDoc(docRef, { isRead: true }, { merge: true });
  }, OperationType.WRITE, `user_mentions/${notifId}`);
}

// 17. 1-on-1 Private Chat Messages Real-time Sync
export function subscribePrivateChatMessages(
  user1: string,
  user2: string,
  onData: (messages: PrivateChatMessage[]) => void
): Unsubscribe {
  const u1 = user1.toLowerCase();
  const u2 = user2.toLowerCase();
  const threadId = [u1, u2].sort().join('_');

  return createSafeSubscription('private_chat_messages', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'private_chat_messages');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: PrivateChatMessage[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as PrivateChatMessage;
          if (
            data.threadId === threadId ||
            (data.senderUsername?.toLowerCase() === u1 && data.recipientUsername?.toLowerCase() === u2) ||
            (data.senderUsername?.toLowerCase() === u2 && data.recipientUsername?.toLowerCase() === u1)
          ) {
            items.push(data);
          }
        });
        items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        onData(items);
      },
      onError
    );
  });
}

export function subscribeAllMyPrivateMessages(
  myUsername: string,
  onData: (messages: PrivateChatMessage[]) => void
): Unsubscribe {
  const me = myUsername.toLowerCase();
  return createSafeSubscription('private_chat_messages', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'private_chat_messages');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: PrivateChatMessage[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as PrivateChatMessage;
          if (
            data.senderUsername?.toLowerCase() === me ||
            data.recipientUsername?.toLowerCase() === me
          ) {
            items.push(data);
          }
        });
        items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        onData(items);
      },
      onError
    );
  });
}

export async function savePrivateChatMessageCloud(message: PrivateChatMessage): Promise<void> {
  return safeCloudWrite(async () => {
    const docRef = doc(db, 'private_chat_messages', message.id);
    await setDoc(docRef, sanitizeForFirestore(message), { merge: true });
  }, OperationType.WRITE, `private_chat_messages/${message.id}`);
}

// Initial Database Seeding
export async function seedDatabaseIfEmpty(): Promise<void> {
  if (isQuotaExceededFlag) {
    console.warn('[Firestore Seeding] Skipping cloud database seeding because quota is exceeded.');
    return;
  }
  try {
    const initRef = doc(db, 'settings', 'database_init');
    const initSnap = await getDoc(initRef);
    if (initSnap.exists() && initSnap.data()?.isSeeded) {
      // Database has already been initialized previously; do not overwrite user additions/deletions
      return;
    }

    const productsSnap = await getDocs(collection(db, 'products'));
    if (!productsSnap.empty) {
      // Database already has documents; mark as seeded
      await setDoc(initRef, { isSeeded: true, seededAt: new Date().toISOString() }, { merge: true });
      return;
    }

    console.log('Seeding initial Bejo Stiker data to Firestore Cloud Database...');
    const batch = writeBatch(db);

    // Initial Products
    INITIAL_PRODUCTS.forEach((p) => {
      batch.set(doc(db, 'products', p.id), sanitizeForFirestore(p));
    });

    // Initial Product Categories
    DEFAULT_PRODUCT_CATEGORIES.forEach((c) => {
      batch.set(doc(db, 'product_categories', c.id), sanitizeForFirestore(c));
    });

    // Initial Customer Categories
    INITIAL_CATEGORIES.forEach((c) => {
      batch.set(doc(db, 'customer_categories', c.id), sanitizeForFirestore(c));
    });

    // Initial Customers
    INITIAL_CUSTOMERS.forEach((c) => {
      batch.set(doc(db, 'customers', c.id), sanitizeForFirestore(c));
    });

    // Initial Cashiers
    INITIAL_CASHIERS.forEach((c) => {
      batch.set(doc(db, 'cashiers', c.id), sanitizeForFirestore(c));
    });

    // Initial App Users (Developer, Admin, Kasir)
    INITIAL_USERS.forEach((u) => {
      batch.set(doc(db, 'users', u.id), sanitizeForFirestore(u));
    });

    // Initial Suppliers
    INITIAL_SUPPLIERS.forEach((s) => {
      batch.set(doc(db, 'suppliers', s.id), sanitizeForFirestore(s));
    });

    // Initial Agents
    INITIAL_AGENTS.forEach((a) => {
      batch.set(doc(db, 'agents', a.id), sanitizeForFirestore(a));
    });

    // Initial Transactions
    INITIAL_TRANSACTIONS.forEach((tx) => {
      const safeId = tx.id.replace(/\//g, '_');
      batch.set(doc(db, 'transactions', safeId), sanitizeForFirestore(tx));
    });

    // Initial Store Profiles
    DEFAULT_STORE_PROFILES.forEach((sp) => {
      batch.set(doc(db, 'store_profiles', sp.id), sanitizeForFirestore(sp));
    });

    // Initial SPK Orders
    DEFAULT_SPK_ORDERS.forEach((o) => {
      batch.set(doc(db, 'spk_orders', o.id), sanitizeForFirestore(o));
    });

    // Initial Machines
    DEFAULT_MACHINES.forEach((m) => {
      batch.set(doc(db, 'machines', m.id), sanitizeForFirestore(m));
    });

    // Store Info
    batch.set(doc(db, 'settings', 'store_info'), sanitizeForFirestore(DEFAULT_STORE_INFO));

    // Mark as initialized
    batch.set(initRef, { isSeeded: true, seededAt: new Date().toISOString() });

    await batch.commit();
    console.log('Successfully seeded database with initial data!');
  } catch (e: any) {
    if (e?.message?.includes('Quota exceeded') || e?.message?.includes('quota')) {
      isQuotaExceededFlag = true;
      console.warn('[Firestore Quota] Quota limit reached during database seeding. Operating in local storage mode.');
      handleFirestoreError(e, OperationType.WRITE, 'seedDatabase');
    } else {
      console.error('Error seeding initial data to Firestore:', e);
    }
  }
}


/**
 * Ensures all role settings, agent user accounts, store profiles, and agents
 * are synced and stored in the Firestore database once on startup.
 * (REMOVED - Use seedDatabaseIfEmpty instead)
 */
export async function syncAgentSettingsToCloud(): Promise<void> {
    return;
}

/**
 * Printing Rejects Cloud Sync
 */
export function subscribePrintingRejects(callback: (rejects: PrintingRejectRecord[]) => void): Unsubscribe {
  if (isQuotaExceededFlag) {
    return () => {};
  }
  try {
    const rejectsRef = collection(db, 'printing_rejects');
    return onSnapshot(
      rejectsRef,
      (snapshot) => {
        const list: PrintingRejectRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as PrintingRejectRecord);
        });
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        callback(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'printing_rejects');
        callback([]);
      }
    );
  } catch (err: any) {
    handleFirestoreError(err, OperationType.LIST, 'printing_rejects');
    return () => {};
  }
}

export async function savePrintingRejectCloud(record: PrintingRejectRecord): Promise<void> {
  if (isQuotaExceededFlag) return;
  try {
    const ref = doc(db, 'printing_rejects', record.id);
    await setDoc(ref, sanitizeForFirestore(record), { merge: true });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `printing_rejects/${record.id}`);
  }
}

export async function deletePrintingRejectCloud(rejectId: string): Promise<void> {
  if (isQuotaExceededFlag) return;
  try {
    const ref = doc(db, 'printing_rejects', rejectId);
    await deleteDoc(ref);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `printing_rejects/${rejectId}`);
  }
}

/**
 * Invoice & Proforma Invoice Cloud Firestore Sync
 */
export function subscribeInvoices(callback: (invoices: Invoice[]) => void): Unsubscribe {
  if (isQuotaExceededFlag) {
    return () => {};
  }
  return createSafeSubscription('invoices', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'invoices');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: Invoice[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Invoice);
        });
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        callback(list);
      },
      onError
    );
  });
}

export async function saveInvoiceCloud(invoice: Invoice): Promise<void> {
  if (isQuotaExceededFlag) return;
  return safeCloudWrite(async () => {
    const safeDocId = invoice.id.replace(/\//g, '_');
    const ref = doc(db, 'invoices', safeDocId);
    await setDoc(ref, sanitizeForFirestore(invoice), { merge: true });
  }, OperationType.WRITE, `invoices/${invoice.id}`);
}

export async function deleteInvoiceCloud(invoiceId: string): Promise<void> {
  if (isQuotaExceededFlag) return;
  return safeCloudWrite(async () => {
    const safeDocId = invoiceId.replace(/\//g, '_');
    const ref = doc(db, 'invoices', safeDocId);
    await deleteDoc(ref);
    if (invoiceId !== safeDocId) {
      const origRef = doc(db, 'invoices', invoiceId);
      await deleteDoc(origRef).catch(() => {});
    }
  }, OperationType.DELETE, `invoices/${invoiceId}`);
}

/**
 * Invoice Store Identity Cloud Firestore Sync
 */
export function subscribeInvoiceStoreIdentity(callback: (identity: InvoiceStoreIdentity | null) => void): Unsubscribe {
  if (isQuotaExceededFlag) {
    return () => {};
  }
  return createSafeSubscription('invoice_settings/store_identity', OperationType.GET, (onError) => {
    const docRef = doc(db, 'invoice_settings', 'store_identity');
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as InvoiceStoreIdentity);
        } else {
          callback(null);
        }
      },
      onError
    );
  });
}

export async function saveInvoiceStoreIdentityCloud(identity: InvoiceStoreIdentity): Promise<void> {
  if (isQuotaExceededFlag) return;
  return safeCloudWrite(async () => {
    const ref = doc(db, 'invoice_settings', 'store_identity');
    await setDoc(ref, sanitizeForFirestore(identity), { merge: true });
  }, OperationType.WRITE, 'invoice_settings/store_identity');
}

/**
 * Tax Module Cloud Firestore Sync
 * 1. Taxpayer Profile (Profil Wajib Pajak)
 * 2. Annual Tax Returns (SPT Tahunan Orang Pribadi 1770)
 * 3. Monthly Tax Billings (Riwayat Pelaporan PPh Final PP 23 / PP 55)
 */
export function subscribeTaxpayerProfile(callback: (profile: TaxpayerProfile | null) => void): Unsubscribe {
  if (isQuotaExceededFlag) return () => {};
  return createSafeSubscription('taxpayer_profile/primary', OperationType.GET, (onError) => {
    const docRef = doc(db, 'taxpayer_profile', 'primary');
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as TaxpayerProfile);
        } else {
          callback(null);
        }
      },
      onError
    );
  });
}

export async function saveTaxpayerProfileCloud(profile: TaxpayerProfile): Promise<void> {
  if (isQuotaExceededFlag) return;
  return safeCloudWrite(async () => {
    const ref = doc(db, 'taxpayer_profile', 'primary');
    await setDoc(ref, sanitizeForFirestore(profile), { merge: true });
  }, OperationType.WRITE, 'taxpayer_profile/primary');
}

export function subscribeTaxAnnualReturns(callback: (returns: TaxAnnualReturn1770[]) => void): Unsubscribe {
  if (isQuotaExceededFlag) return () => {};
  return createSafeSubscription('tax_annual_returns', OperationType.LIST, (onError) => {
    const colRef = collection(db, 'tax_annual_returns');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: TaxAnnualReturn1770[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as TaxAnnualReturn1770);
        });
        list.sort((a, b) => b.taxYear - a.taxYear);
        callback(list);
      },
      onError
    );
  });
}

export async function saveTaxAnnualReturnCloud(returnItem: TaxAnnualReturn1770): Promise<void> {
  if (isQuotaExceededFlag) return;
  return safeCloudWrite(async () => {
    const safeDocId = returnItem.id.replace(/\//g, '_');
    const ref = doc(db, 'tax_annual_returns', safeDocId);
    await setDoc(ref, sanitizeForFirestore(returnItem), { merge: true });
  }, OperationType.WRITE, `tax_annual_returns/${returnItem.id}`);
}

export async function saveAllTaxAnnualReturnsCloud(returns: TaxAnnualReturn1770[]): Promise<void> {
  if (isQuotaExceededFlag || !returns.length) return;
  return safeCloudWrite(async () => {
    const batch = writeBatch(db);
    returns.forEach((r) => {
      const safeDocId = r.id.replace(/\//g, '_');
      const ref = doc(db, 'tax_annual_returns', safeDocId);
      batch.set(ref, sanitizeForFirestore(r), { merge: true });
    });
    await batch.commit();
  }, OperationType.WRITE, 'tax_annual_returns/batch');
}

export async function deleteTaxAnnualReturnCloud(returnId: string): Promise<void> {
  if (isQuotaExceededFlag) return;
  return safeCloudWrite(async () => {
    const safeDocId = returnId.replace(/\//g, '_');
    const ref = doc(db, 'tax_annual_returns', safeDocId);
    await deleteDoc(ref);
  }, OperationType.DELETE, `tax_annual_returns/${returnId}`);
}

export function subscribeTaxMonthlyBillings(callback: (billings: MonthlyBillingsByYear | null) => void): Unsubscribe {
  if (isQuotaExceededFlag) return () => {};
  return createSafeSubscription('tax_monthly_billings/all_years', OperationType.GET, (onError) => {
    const docRef = doc(db, 'tax_monthly_billings', 'all_years');
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.billingsByYear) {
            callback(data.billingsByYear as MonthlyBillingsByYear);
          } else {
            callback(data as MonthlyBillingsByYear);
          }
        } else {
          callback(null);
        }
      },
      onError
    );
  });
}

export async function saveTaxMonthlyBillingsCloud(billings: MonthlyBillingsByYear): Promise<void> {
  if (isQuotaExceededFlag) return;
  return safeCloudWrite(async () => {
    const ref = doc(db, 'tax_monthly_billings', 'all_years');
    await setDoc(ref, sanitizeForFirestore({ billingsByYear: billings, updatedAt: Date.now() }), { merge: true });
  }, OperationType.WRITE, 'tax_monthly_billings/all_years');
}
