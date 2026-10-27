/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import {
  Product,
  Customer,
  CustomerCategory,
  Shift,
  Transaction,
  ProductCategoryItem,
  CashierUser,
  AppUser,
  Supplier,
  Agent,
  StockTransaction,
  UserActivityLog,
  ActivityActionType,
  StoreProfile,
  CustomRole,
  PrintSettings,
  SpkOrder,
  SpkStatus,
  MachineItem,
  AiInternalChatMessage,
  UserMentionNotification,
  PrintingRejectRecord
} from '../types';
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
import { getPermanentDeveloperUser } from './authSecurity';
import {
  DEFAULT_AGENT_PROFILES,
  DEFAULT_AGENTS_LIST,
  DEFAULT_AGENT_USERS,
  PRESET_AGENT_ACCOUNTS,
  resolveAgentForUser
} from './agentMapping';
import { sanitizeProductItem } from './stockUtils';

const STORAGE_KEYS = {
  PRODUCTS: 'bejo_pos_products_v1',
  CUSTOMERS: 'bejo_pos_customers_v1',
  SUPPLIERS: 'bejo_pos_suppliers_v1',
  AGENTS: 'bejo_pos_agents_v1',
  CATEGORIES: 'bejo_pos_categories_v1',
  CASHIERS: 'bejo_pos_cashiers_v1',
  SHIFTS: 'bejo_pos_shifts_v1',
  ACTIVE_SHIFT: 'bejo_pos_active_shift_v1',
  TRANSACTIONS: 'bejo_pos_transactions_v1',
  STOCK_TRANSACTIONS: 'bejo_pos_stock_transactions_v1',
  STORE_INFO: 'bejo_pos_store_info_v1',
  DEFAULT_LOGO: 'bejo_pos_default_logo_v1',
  PRODUCT_CATEGORIES: 'bejo_pos_product_categories_v1',
  USERS: 'bejo_pos_users_v1',
  AUTH_USER: 'bejo_pos_auth_user_v1',
  THEME_MODE: 'bejo_pos_theme_mode_v1',
  ACTIVITY_LOGS: 'bejo_pos_activity_logs_v1',
  STORE_PROFILES: 'bejo_pos_store_profiles_v1',
  ACTIVE_PROFILE_ID: 'bejo_pos_active_profile_id_v1',
  CUSTOM_ROLES: 'bejo_pos_custom_roles_v1',
  PRINT_SETTINGS: 'bejo_pos_print_settings_v1',
  SPK_ORDERS: 'bejo_pos_spk_orders_v1',
  MACHINES: 'bejo_pos_machines_v1',
  AI_CHAT_MESSAGES: 'bejo_pos_ai_chat_messages_v1',
  USER_MENTIONS: 'bejo_pos_user_mentions_v1',
  PRINTING_REJECTS: 'bejo_pos_printing_rejects_v1',
};

export function getStoredDefaultLogo(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.DEFAULT_LOGO) || null;
  } catch (e) {
    return null;
  }
}

export function saveStoredDefaultLogo(logoUrl: string): void {
  try {
    if (logoUrl) {
      localStorage.setItem(STORAGE_KEYS.DEFAULT_LOGO, logoUrl);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('bejo_logo_updated'));
      }
    }
  } catch (e) {
    console.error('Failed to save default logo', e);
  }
}

export function clearStoredDefaultLogo(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.DEFAULT_LOGO);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('bejo_logo_updated'));
    }
  } catch (e) {
    console.error('Failed to clear default logo', e);
  }
}

export const DEFAULT_PRODUCT_CATEGORIES: ProductCategoryItem[] = [
  { id: 'bahan', name: 'Bahan', color: 'blue', isDefault: true },
  { id: 'stiker_vinyl', name: 'Stiker Vinyl', color: 'indigo', isDefault: true },
  { id: 'digital_printing', name: 'Digital Printing', color: 'sky', isDefault: true },
  { id: 'laser_cutting', name: 'Laser Cutting', color: 'amber', isDefault: true },
  { id: 'paket', name: 'Paket', color: 'purple', isDefault: true },
  { id: 'production_supplies', name: 'Production Supplies', color: 'emerald', isDefault: true },
];

export const IMMUTABLE_DEFAULT_CATEGORY_IDS = [
  'bahan',
  'stiker_vinyl',
  'digital_printing',
  'laser_cutting',
  'paket',
  'production_supplies',
  'vinyl_meteran',
  'vinyl_roll',
  'vinyl_sticker',
  'custom_sticker'
];

export function isDefaultCustomerCategory(catIdOrName: string): boolean {
  if (!catIdOrName) return false;
  const clean = catIdOrName.trim().toLowerCase();
  return (
    clean === 'cat_grosir' ||
    clean === 'grosir' ||
    clean === 'cat_umum' ||
    clean === 'umum' ||
    clean === 'cat_agen' ||
    clean === 'agen' ||
    clean === 'cat_retail' ||
    clean === 'retail'
  );
}

export function isDefaultProductCategory(catIdOrName: string): boolean {
  if (!catIdOrName) return false;
  const normalized = catIdOrName.toLowerCase().trim();
  if (IMMUTABLE_DEFAULT_CATEGORY_IDS.includes(normalized)) return true;
  const defaultNames = [
    'bahan',
    'stiker vinyl',
    'stiker_vinyl',
    'digital printing',
    'digital_printing',
    'laser cutting',
    'laser_cutting',
    'laser cutting plywood',
    'paket',
    'production supplies',
    'production_supplies',
    'vinyl meteran',
    'vinyl roll utuh',
    'vinyl sticker',
    'vinyl_sticker',
    'custom stiker',
    'custom_sticker'
  ];
  return defaultNames.some((d) => normalized === d);
}

export function getStoredProductCategories(): ProductCategoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCT_CATEGORIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PRODUCT_CATEGORIES, JSON.stringify(DEFAULT_PRODUCT_CATEGORIES));
      return DEFAULT_PRODUCT_CATEGORIES;
    }
    const parsed: ProductCategoryItem[] = JSON.parse(raw);
    
    // Ensure all 6 core default categories always exist
    const merged = [...parsed];
    for (const def of DEFAULT_PRODUCT_CATEGORIES) {
      const exists = merged.some(
        (c) => c.id.toLowerCase() === def.id.toLowerCase() || c.name.toLowerCase() === def.name.toLowerCase()
      );
      if (!exists) {
        merged.push(def);
      }
    }
    return merged;
  } catch (e) {
    console.error('Failed to parse product categories', e);
    return DEFAULT_PRODUCT_CATEGORIES;
  }
}

export function saveStoredProductCategories(categories: ProductCategoryItem[]): void {
  localStorage.setItem(STORAGE_KEYS.PRODUCT_CATEGORIES, JSON.stringify(categories));
}

export interface StoreInfo {
  storeName: string;
  /** Judul aplikasi pada header (dapat diedit manual di tab Pengaturan) */
  appTitle?: string;
  branch: string;
  address: string;
  phone: string;
  receiptFooter: string;
  logoUrl?: string;
  storeStatus?: 'OFFLINE' | 'ONLINE';
  isMaster?: boolean;
}

export const DEFAULT_STORE_INFO: StoreInfo = {
  storeName: 'BEJO Digital Print',
  appTitle: 'Point of Sales',
  branch: 'Pelsek',
  address: 'Jl. Raya Utama No. 45 (Sebelah Polsek), Kota',
  phone: '0812-3456-7890',
  receiptFooter: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dipotong/dicetak tidak dapat dibatalkan.',
  logoUrl: '',
  storeStatus: 'ONLINE',
  isMaster: true
};

export const DEFAULT_MASTER_STORE_PROFILE: StoreProfile = {
  id: 'bejo_polsek',
  storeName: 'BEJO Polsek',
  branch: 'Polsek',
  address: 'Jl. Raya Utama No. 45 (Sebelah Polsek), Kota',
  phone: '0812-3456-7890',
  receiptFooter: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dipotong/dicetak tidak dapat dibatalkan.',
  isMaster: true,
  canModifyMasterProducts: true,
  storeStatus: 'ONLINE'
};

export const DEFAULT_STORE_PROFILES: StoreProfile[] = [
  DEFAULT_MASTER_STORE_PROFILE,
  ...DEFAULT_AGENT_PROFILES
];

export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const list: Product[] = raw ? JSON.parse(raw) : INITIAL_PRODUCTS;
    const sanitized = list.map(sanitizeProductItem);
    return sanitized.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  } catch (e) {
    console.error('Failed to parse products', e);
    return [...INITIAL_PRODUCTS].map(sanitizeProductItem).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }
}

export function saveStoredProducts(products: Product[]): void {
  const sanitized = products.map(sanitizeProductItem);
  const sorted = [...sanitized].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
  );
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(sorted));
}

export function getStoredCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const list: Customer[] = raw ? JSON.parse(raw) : INITIAL_CUSTOMERS;
    const sanitized = list.map((c) => {
      let catId = c.categoryId;
      if (!catId || catId === 'cat_retail' || catId === 'retail' || catId === 'RETAIL') {
        catId = 'cat_umum';
      }
      return {
        ...c,
        categoryId: catId
      };
    });
    return sanitized.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  } catch (e) {
    console.error('Failed to parse customers', e);
    return [...INITIAL_CUSTOMERS].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }
}

export function saveStoredCustomers(customers: Customer[]): void {
  const sanitized = customers.map((c) => {
    let catId = c.categoryId;
    if (!catId || catId === 'cat_retail' || catId === 'retail' || catId === 'RETAIL') {
      catId = 'cat_umum';
    }
    return {
      ...c,
      categoryId: catId
    };
  });
  const sorted = [...sanitized].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
  );
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(sorted));
}

export function getStoredSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    const list: Supplier[] = raw ? JSON.parse(raw) : INITIAL_SUPPLIERS;
    return list.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  } catch (e) {
    console.error('Failed to parse suppliers', e);
    return [...INITIAL_SUPPLIERS].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }
}

export function saveStoredSuppliers(suppliers: Supplier[]): void {
  const sorted = [...suppliers].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
  );
  localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(sorted));
}

export function getStoredAgents(): Agent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AGENTS);
    const list: Agent[] = raw ? JSON.parse(raw) : INITIAL_AGENTS;
    
    // Ensure all predefined agents exist
    const merged = [...list];
    for (const defAgent of DEFAULT_AGENTS_LIST) {
      const exists = merged.some(
        (a) => a.id === defAgent.id || a.name.toLowerCase() === defAgent.name.toLowerCase()
      );
      if (!exists) {
        merged.push(defAgent);
      }
    }

    return merged.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  } catch (e) {
    console.error('Failed to parse agents', e);
    return [...INITIAL_AGENTS].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }
}

export function saveStoredAgents(agents: Agent[]): void {
  const sorted = [...agents].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
  );
  localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(sorted));
}

export function getStoredCategories(): CustomerCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    let list: CustomerCategory[] = raw ? JSON.parse(raw) : INITIAL_CATEGORIES;
    if (!Array.isArray(list) || list.length === 0) {
      list = INITIAL_CATEGORIES;
    }
    // Sanitize any RETAIL category to UMUM
    const sanitized = list.map((c) => {
      if (c.id === 'cat_retail' || c.name.toUpperCase() === 'RETAIL') {
        return {
          ...c,
          id: c.id === 'cat_retail' ? 'cat_umum' : c.id,
          name: 'UMUM',
          color: c.color || 'bg-slate-100 text-slate-700 border-slate-300'
        };
      }
      return c;
    });

    // Ensure GROSIR, UMUM, AGEN all exist
    const hasGrosir = sanitized.some((c) => c.name.toUpperCase() === 'GROSIR' || c.id === 'cat_grosir');
    const hasUmum = sanitized.some((c) => c.name.toUpperCase() === 'UMUM' || c.id === 'cat_umum');
    const hasAgen = sanitized.some((c) => c.name.toUpperCase() === 'AGEN' || c.id === 'cat_agen');

    if (!hasGrosir) sanitized.unshift({ id: 'cat_grosir', name: 'GROSIR', discountPercent: 0, color: 'bg-blue-100 text-blue-700 border-blue-400' });
    if (!hasUmum) sanitized.splice(1, 0, { id: 'cat_umum', name: 'UMUM', discountPercent: 0, color: 'bg-slate-100 text-slate-700 border-slate-300' });
    if (!hasAgen) sanitized.push({ id: 'cat_agen', name: 'AGEN', discountPercent: 0, color: 'bg-purple-100 text-purple-700 border-purple-400' });

    return sanitized;
  } catch (e) {
    console.error('Failed to parse categories', e);
    return INITIAL_CATEGORIES;
  }
}

export function saveStoredCategories(categories: CustomerCategory[]): void {
  const sanitized = categories.map((c) => {
    if (c.id === 'cat_retail' || c.name.toUpperCase() === 'RETAIL') {
      return {
        ...c,
        id: c.id === 'cat_retail' ? 'cat_umum' : c.id,
        name: 'UMUM'
      };
    }
    return c;
  });
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(sanitized));
}

export function getStoredActiveShift(): Shift | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(INITIAL_SHIFT));
      return INITIAL_SHIFT;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SHIFT;
  }
}

export function saveStoredActiveShift(shift: Shift | null): void {
  if (!shift) {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);
  } else {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(shift));
  }
}

export function getStoredShifts(): Shift[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredShifts(shifts: Shift[]): void {
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
}

export function getStoredTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
      return INITIAL_TRANSACTIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_TRANSACTIONS;
  }
}

export function saveStoredTransactions(transactions: Transaction[]): void {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

export function getStoredStoreProfiles(): StoreProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORE_PROFILES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STORE_PROFILES, JSON.stringify(DEFAULT_STORE_PROFILES));
      return DEFAULT_STORE_PROFILES;
    }
    const parsed: StoreProfile[] = JSON.parse(raw);
    
    // Ensure master store profile exists
    const hasMaster = parsed.some((p) => p.isMaster || p.id === 'bejo_polsek');
    if (!hasMaster) {
      parsed.unshift(DEFAULT_MASTER_STORE_PROFILE);
    }

    // Ensure all predefined agent profiles (BEJO Tanon, BEJO Ceweng, BEJO Jombang, BEJO Somet) exist
    for (const defProf of DEFAULT_AGENT_PROFILES) {
      const exists = parsed.some(
        (p) => p.id === defProf.id || p.storeName.toLowerCase() === defProf.storeName.toLowerCase()
      );
      if (!exists) {
        parsed.push(defProf);
      }
    }

    return parsed;
  } catch (e) {
    return DEFAULT_STORE_PROFILES;
  }
}

export function saveStoredStoreProfiles(profiles: StoreProfile[]): void {
  try {
    const sanitized: StoreProfile[] = profiles.map((p) => {
      if (p.id === 'bejo_polsek' || p.isMaster) {
        return { ...p, isMaster: true, canModifyMasterProducts: true };
      }
      return { ...p, isMaster: false, canModifyMasterProducts: false };
    });
    if (!sanitized.some((p) => p.isMaster || p.id === 'bejo_polsek')) {
      sanitized.unshift(DEFAULT_MASTER_STORE_PROFILE);
    }
    localStorage.setItem(STORAGE_KEYS.STORE_PROFILES, JSON.stringify(sanitized));
  } catch (e) {
    console.error('Failed to save store profiles', e);
  }
}

export function getStoredActiveProfileId(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID) || 'bejo_polsek';
  } catch (e) {
    return 'bejo_polsek';
  }
}

export function saveStoredActiveProfileId(profileId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, profileId || 'bejo_polsek');
  } catch (e) {
    console.error('Failed to save active profile id', e);
  }
}

export function getActiveStoreProfile(): StoreProfile {
  const profiles = getStoredStoreProfiles();
  const activeId = getStoredActiveProfileId();
  const matched = profiles.find((p) => p.id === activeId);
  return matched || profiles[0] || DEFAULT_MASTER_STORE_PROFILE;
}

export function getStoredStoreInfo(): StoreInfo {
  try {
    const activeProf = getActiveStoreProfile();
    const raw = localStorage.getItem(STORAGE_KEYS.STORE_INFO);
    const defaultLogo = getStoredDefaultLogo();
    if (!raw) {
      const info: StoreInfo = {
        storeName: activeProf.storeName || 'BEJO Polsek',
        branch: activeProf.branch || 'Polsek',
        address: activeProf.address || '',
        phone: activeProf.phone || '',
        receiptFooter: activeProf.receiptFooter || '',
        logoUrl: activeProf.logoUrl || defaultLogo || '',
        storeStatus: activeProf.storeStatus || 'ONLINE',
        isMaster: activeProf.isMaster ?? (activeProf.id === 'bejo_polsek')
      };
      return info;
    }
    const parsed: StoreInfo = JSON.parse(raw);
    if (!parsed.logoUrl && defaultLogo) {
      parsed.logoUrl = defaultLogo;
    }
    if (!parsed.appTitle) {
      parsed.appTitle = DEFAULT_STORE_INFO.appTitle;
    }
    parsed.isMaster = activeProf.isMaster ?? (activeProf.id === 'bejo_polsek');
    return parsed;
  } catch (e) {
    const defaultLogo = getStoredDefaultLogo();
    return defaultLogo ? { ...DEFAULT_STORE_INFO, logoUrl: defaultLogo } : DEFAULT_STORE_INFO;
  }
}

export function saveStoredStoreInfo(info: StoreInfo): void {
  localStorage.setItem(STORAGE_KEYS.STORE_INFO, JSON.stringify(info));
  if (info.logoUrl) {
    saveStoredDefaultLogo(info.logoUrl);
  }
  const activeId = getStoredActiveProfileId();
  const profiles = getStoredStoreProfiles();
  const updatedProfiles = profiles.map((p) => {
    if (p.id === activeId) {
      return {
        ...p,
        storeName: info.storeName,
        branch: info.branch,
        address: info.address,
        phone: info.phone,
        receiptFooter: info.receiptFooter,
        logoUrl: info.logoUrl,
        storeStatus: info.storeStatus,
        isMaster: p.id === 'bejo_polsek' ? true : p.isMaster
      };
    }
    return p;
  });
  saveStoredStoreProfiles(updatedProfiles);
}

export function getProfileTransactionsKey(profileId: string = getStoredActiveProfileId()): string {
  return profileId === 'bejo_polsek' ? STORAGE_KEYS.TRANSACTIONS : `${STORAGE_KEYS.TRANSACTIONS}_${profileId}`;
}

export function getStoredTransactionsForProfile(profileId: string = getStoredActiveProfileId()): Transaction[] {
  try {
    const key = getProfileTransactionsKey(profileId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      if (profileId === 'bejo_polsek') {
        localStorage.setItem(key, JSON.stringify(INITIAL_TRANSACTIONS));
        return INITIAL_TRANSACTIONS;
      }
      return [];
    }
    return JSON.parse(raw);
  } catch (e) {
    return profileId === 'bejo_polsek' ? INITIAL_TRANSACTIONS : [];
  }
}

export function saveStoredTransactionsForProfile(transactions: Transaction[], profileId: string = getStoredActiveProfileId()): void {
  const key = getProfileTransactionsKey(profileId);
  localStorage.setItem(key, JSON.stringify(transactions));
}

export function getProfileShiftsKey(profileId: string = getStoredActiveProfileId()): string {
  return profileId === 'bejo_polsek' ? STORAGE_KEYS.SHIFTS : `${STORAGE_KEYS.SHIFTS}_${profileId}`;
}

export function getStoredShiftsForProfile(profileId: string = getStoredActiveProfileId()): Shift[] {
  try {
    const key = getProfileShiftsKey(profileId);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredShiftsForProfile(shifts: Shift[], profileId: string = getStoredActiveProfileId()): void {
  const key = getProfileShiftsKey(profileId);
  localStorage.setItem(key, JSON.stringify(shifts));
}

export function getProfileActiveShiftKey(profileId: string = getStoredActiveProfileId()): string {
  return profileId === 'bejo_polsek' ? STORAGE_KEYS.ACTIVE_SHIFT : `${STORAGE_KEYS.ACTIVE_SHIFT}_${profileId}`;
}

export function getStoredActiveShiftForProfile(profileId: string = getStoredActiveProfileId()): Shift | null {
  try {
    const key = getProfileActiveShiftKey(profileId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      if (profileId === 'bejo_polsek') {
        localStorage.setItem(key, JSON.stringify(INITIAL_SHIFT));
        return INITIAL_SHIFT;
      }
      return null;
    }
    return JSON.parse(raw);
  } catch (e) {
    return profileId === 'bejo_polsek' ? INITIAL_SHIFT : null;
  }
}

export function saveStoredActiveShiftForProfile(shift: Shift | null, profileId: string = getStoredActiveProfileId()): void {
  const key = getProfileActiveShiftKey(profileId);
  if (!shift) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(shift));
  }
}

export function getStoredCashiers(): CashierUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CASHIERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CASHIERS, JSON.stringify(INITIAL_CASHIERS));
      return INITIAL_CASHIERS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_CASHIERS;
  }
}

export function saveStoredCashiers(cashiers: CashierUser[]): void {
  localStorage.setItem(STORAGE_KEYS.CASHIERS, JSON.stringify(cashiers));
}

export function getStoredUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    const parsed: AppUser[] = JSON.parse(raw);
    // Developer account is permanent and completely hidden from the standard user management UI
    const filtered = parsed.filter((u) => u.role !== 'DEVELOPER' && u.id !== 'user_dev' && u.id !== 'sys_core_developer');
    
    // Ensure all predefined agent accounts (tanon, ceweng, jombang, somet) exist
    const merged = [...filtered];
    for (const defUser of DEFAULT_AGENT_USERS) {
      const exists = merged.some(
        (u) => u.username.toLowerCase() === defUser.username.toLowerCase()
      );
      if (!exists) {
        merged.push(defUser);
      }
    }

    return merged.length > 0 ? merged : INITIAL_USERS;
  } catch (e) {
    return INITIAL_USERS;
  }
}

export function saveStoredUsers(users: AppUser[]): void {
  // Ensure developer account is never mixed into or overridden by user management edits
  const filtered = users.filter((u) => u.role !== 'DEVELOPER' && u.id !== 'user_dev' && u.id !== 'sys_core_developer');
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
}

export function getStoredAuthUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (!raw) return null;
    const user: AppUser = JSON.parse(raw);
    if (user.role === 'DEVELOPER' || user.id === 'user_dev' || user.id === 'sys_core_developer') {
      const permanentDev = getPermanentDeveloperUser();
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(permanentDev));
      return permanentDev;
    }
    return user;
  } catch (e) {
    return null;
  }
}

export function saveStoredAuthUser(user: AppUser | null): void {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  } else {
    localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
  }
}

export function getStoredStockTransactions(): StockTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STOCK_TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredStockTransactions(txs: StockTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STOCK_TRANSACTIONS, JSON.stringify(txs));
  } catch (e) {
    console.error('Failed to save stock transactions', e);
  }
}

export function getStoredThemeMode(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME_MODE);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return 'light';
  } catch (e) {
    return 'light';
  }
}

export function saveStoredThemeMode(mode: 'light' | 'dark'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
  } catch (e) {
    console.error('Failed to save theme mode', e);
  }
}

export function formatDateTimeLog(ts: number = Date.now()): string {
  const d = new Date(ts);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`;
}

export function generateInitialActivityLogs(): UserActivityLog[] {
  const now = Date.now();
  const min = 60 * 1000;
  const hour = 60 * min;

  return [
    {
      id: `log_init_1`,
      userId: 'sys_core_developer',
      username: 'langgo_dev',
      name: 'Langgo Bramandityo (Lead Developer)',
      role: 'DEVELOPER',
      actionType: 'LOGIN',
      actionTitle: 'Login Ke Sistem (Developer Mode)',
      details: 'Pengguna DEVELOPER @langgo_dev berhasil masuk ke sistem POS dengan hak akses penuh',
      timestamp: now - 15 * min,
      formattedDateTime: formatDateTimeLog(now - 15 * min),
    },
    {
      id: `log_init_2`,
      userId: 'sys_core_developer',
      username: 'langgo_dev',
      name: 'Langgo Bramandityo (Lead Developer)',
      role: 'DEVELOPER',
      actionType: 'USER_MANAGEMENT',
      actionTitle: 'Cek Log Record & Hak Akses',
      details: 'Developer melakukan peninjauan audit riwayat aktivitas sistem & wewenang pengguna',
      timestamp: now - 10 * min,
      formattedDateTime: formatDateTimeLog(now - 10 * min),
    },
    {
      id: `log_init_3`,
      userId: 'user_admin',
      username: 'admin',
      name: 'Administrator Toko',
      role: 'ADMIN',
      actionType: 'LOGIN',
      actionTitle: 'Login Ke Sistem',
      details: 'Pengguna ADMIN @admin masuk ke portal administrasi & manajemen inventaris',
      timestamp: now - 1 * hour,
      formattedDateTime: formatDateTimeLog(now - 1 * hour),
    },
    {
      id: `log_init_4`,
      userId: 'user_admin',
      username: 'admin',
      name: 'Administrator Toko',
      role: 'ADMIN',
      actionType: 'STOCK_MUTATION',
      actionTitle: 'Input Transaksi Stok Pembelian',
      details: 'Menambahkan stok masuk dari PT. Multi Stiker Jaya (Bahan Oracal 651 - 5 Roll)',
      timestamp: now - 50 * min,
      formattedDateTime: formatDateTimeLog(now - 50 * min),
    },
    {
      id: `log_init_5`,
      userId: 'user_kasir_fira',
      username: 'kasir',
      name: 'FIRA (Kasir Utama)',
      role: 'KASIR',
      actionType: 'LOGIN',
      actionTitle: 'Login Ke Modul Kasir',
      details: 'Pengguna KASIR @kasir berhasil masuk ke layar POS Kasir Utama',
      timestamp: now - 3 * hour,
      formattedDateTime: formatDateTimeLog(now - 3 * hour),
    },
    {
      id: `log_init_6`,
      userId: 'user_kasir_fira',
      username: 'kasir',
      name: 'FIRA (Kasir Utama)',
      role: 'KASIR',
      actionType: 'SHIFT_OPEN',
      actionTitle: 'Membuka Shift Kasir',
      details: 'FIRA membuka Shift 1 (Pagi) dengan modal kas awal Rp 200.000',
      timestamp: now - 2.8 * hour,
      formattedDateTime: formatDateTimeLog(now - 2.8 * hour),
    },
    {
      id: `log_init_7`,
      userId: 'user_kasir_fira',
      username: 'kasir',
      name: 'FIRA (Kasir Utama)',
      role: 'KASIR',
      actionType: 'TRANSACTION',
      actionTitle: 'Transaksi Penjualan POS #BS2026/09/0001',
      details: 'Total Transaksi Rp 175.000 (3 item) - Pelanggan: Umum • Metode: Cash (Rp 200.000)',
      timestamp: now - 2 * hour,
      formattedDateTime: formatDateTimeLog(now - 2 * hour),
    },
    {
      id: `log_init_8`,
      userId: 'user_kasir_fira',
      username: 'kasir',
      name: 'FIRA (Kasir Utama)',
      role: 'KASIR',
      actionType: 'TRANSACTION',
      actionTitle: 'Transaksi Penjualan POS #BS2026/09/0002',
      details: 'Total Transaksi Rp 85.000 (1 item) - Pelanggan: Stiker Mania • Metode: QRIS',
      timestamp: now - 1.2 * hour,
      formattedDateTime: formatDateTimeLog(now - 1.2 * hour),
    },
  ];
}

export function getStoredActivityLogs(): UserActivityLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    if (!raw) {
      const initial = generateInitialActivityLogs();
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(initial));
      return initial;
    }
    const parsed: UserActivityLog[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return generateInitialActivityLogs();
  }
}

export function saveStoredActivityLogs(logs: UserActivityLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(logs.slice(0, 500)));
  } catch (e) {
    console.error('Failed to save activity logs', e);
  }
}

export function addActivityLogRecord(
  log: Omit<UserActivityLog, 'id' | 'timestamp' | 'formattedDateTime'> & {
    timestamp?: number;
    formattedDateTime?: string;
  }
): UserActivityLog {
  const ts = log.timestamp || Date.now();
  const newLog: UserActivityLog = {
    id: `log_${ts}_${Math.random().toString(36).substring(2, 7)}`,
    userId: log.userId,
    username: log.username,
    name: log.name,
    role: log.role,
    actionType: log.actionType,
    actionTitle: log.actionTitle,
    details: log.details,
    timestamp: ts,
    formattedDateTime: log.formattedDateTime || formatDateTimeLog(ts),
  };

  const existing = getStoredActivityLogs();
  const updated = [newLog, ...existing].slice(0, 500);
  saveStoredActivityLogs(updated);
  return newLog;
}

export function clearStoredActivityLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
  } catch (e) {
    console.error('Failed to clear activity logs', e);
  }
}

export function getStoredCustomRoles(): CustomRole[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_ROLES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredCustomRoles(roles: CustomRole[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_ROLES, JSON.stringify(roles));
  } catch (e) {
    console.error('Failed to save custom roles', e);
  }
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: '80mm',
  defaultPrinter: 'pos_80',
  printerDeviceName: 'POS-80 Thermal Printer (80mm x roll)',
  printMarginMm: 0,
  autoPrintOnCheckout: false,
  autoPrintOnSuratJalan: false,
  density: 'standard',
  contrast: 'bold',
  showLogo: true,
  showStoreHeader: true,
  showCustomerInfo: true,
  showQrCode: true,
  showFooterNotes: true,
  showCashierName: true,
  showCutLine: true,
  feedLines: 2,
  customHeaderNote: '',
  customFooterNote: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan kecuali ada perjanjian.'
};

export function applyPrintSettingsToDOM(settings: PrintSettings): void {
  if (typeof document === 'undefined') return;
  const marginMm = typeof settings.printMarginMm === 'number' ? Math.max(0, Math.min(10, settings.printMarginMm)) : 0;
  let styleEl = document.getElementById('bejo-dynamic-print-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'bejo-dynamic-print-style';
    document.head.appendChild(styleEl);
  }
  const paperWidth = settings.paperSize === '58mm' ? '58mm' : '80mm';
  const containerWidth = settings.paperSize === '58mm' ? '54mm' : '76mm';
  styleEl.textContent = `
    @media print {
      @page {
        size: ${paperWidth} auto;
        margin: ${marginMm}mm !important;
      }
      #thermal-receipt, .thermal-receipt-container {
        width: ${containerWidth} !important;
        padding: ${marginMm}mm !important;
        border: none !important;
        box-shadow: none !important;
      }
    }
  `;
}

export function getStoredPrintSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRINT_SETTINGS);
    if (!raw) {
      applyPrintSettingsToDOM(DEFAULT_PRINT_SETTINGS);
      return { ...DEFAULT_PRINT_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_PRINT_SETTINGS, ...parsed };
    applyPrintSettingsToDOM(merged);
    return merged;
  } catch (e) {
    applyPrintSettingsToDOM(DEFAULT_PRINT_SETTINGS);
    return { ...DEFAULT_PRINT_SETTINGS };
  }
}

export function saveStoredPrintSettings(settings: PrintSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRINT_SETTINGS, JSON.stringify(settings));
    applyPrintSettingsToDOM(settings);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_print_settings_updated', { detail: settings }));
    }
  } catch (e) {
    console.error('Failed to save print settings', e);
  }
}

// =========================================================================
// SPK WORK ORDERS INITIAL DATA & STORAGE (TAHAP 1)
// =========================================================================

export const DEFAULT_SPK_ORDERS: SpkOrder[] = [
  {
    id: 'SPK-260930-0001',
    orderNumber: 'SPK-260930-0001',
    date: '2026-09-30',
    time: '08:30:00',
    timestamp: Date.now() - 3 * 3600 * 1000,
    deadlineDate: '2026-09-30',
    deadlineTime: '17:00:00',
    priority: 'HIGH',
    status: 'MENUNGGU_SETTING',
    customerName: 'CV. Berkah Abadi Jaya',
    customerPhone: '0812-9876-5432',
    customerCategory: 'Umum',
    items: [
      {
        id: 'item_spk_1',
        jobName: 'Spanduk Banner Toko Kelontong Berkah',
        materialName: 'Flexi China 280g Outdoor',
        lengthMeters: 3,
        widthMeters: 1,
        qty: 2,
        areaM2: 6,
        unitPrice: 25000,
        materialPriceTotal: 150000,
        finishings: [
          { id: 'fin_1', name: 'Mata Ayam (4 Sudut)', type: 'mata_ayam', price: 10000, qty: 8 },
          { id: 'fin_2', name: 'Lipat Lem Keliling', type: 'lipat_lem', price: 10000 }
        ],
        finishingPriceTotal: 20000,
        totalPrice: 170000,
        printMachine: 'OUTDOOR_KONICA',
        colorProfile: 'CMYK',
        designFileName: 'spanduk_berkah_3x1m_rev2.pdf',
        operatorNotes: 'Pastikan warna hijau brand bold dan teks tajam.'
      }
    ],
    totalQty: 2,
    totalAreaM2: 6,
    subtotal: 170000,
    discount: 0,
    totalAmount: 170000,
    dpPaid: 50000,
    remainingAmount: 120000,
    isPaid: false,
    paymentMethod: 'TRANSFER',
    designerName: 'Andi (Prepress)',
    assignedMachine: 'OUTDOOR_KONICA',
    customerNotes: 'Mau diambil sore jam 5 untuk dipasang besok pagi.',
    statusLogs: [
      {
        status: 'MENUNGGU_SETTING',
        timestamp: Date.now() - 3 * 3600 * 1000,
        formattedTime: '30 Sep 2026, 08:30',
        changedBy: 'Kasir Front Office',
        note: 'Penerimaan file dari WA pelanggan & DP Rp 50.000 via Transfer'
      }
    ]
  },
  {
    id: 'SPK-260930-0002',
    orderNumber: 'SPK-260930-0002',
    date: '2026-09-30',
    time: '09:15:00',
    timestamp: Date.now() - 2 * 3600 * 1000,
    deadlineDate: '2026-09-30',
    deadlineTime: '15:30:00',
    priority: 'URGENT',
    status: 'SETTING_SELESAI',
    customerName: 'Kopi Senja Utama (Agen)',
    customerPhone: '0857-1122-3344',
    customerCategory: 'Agen',
    items: [
      {
        id: 'item_spk_2',
        jobName: 'Stiker Kemasan Botol Kopi 250ml',
        materialName: 'Stiker Vinyl Camel Doff',
        lengthMeters: 1.5,
        widthMeters: 1,
        qty: 2,
        areaM2: 3,
        unitPrice: 65000,
        materialPriceTotal: 195000,
        finishings: [
          { id: 'fin_3', name: 'Laminasi Doff Dingin', type: 'laminasi', price: 30000 },
          { id: 'fin_4', name: 'Kiss Cut Presisi (Cutting Pola)', type: 'cutting', price: 45000 }
        ],
        finishingPriceTotal: 75000,
        totalPrice: 270000,
        printMachine: 'INDOOR_ROLAND',
        colorProfile: 'CMYK',
        designFileName: 'label_kopi_senja_cmyk_cutline.tif',
        operatorNotes: 'Gunakan contour cutline magenta 100% untuk mesin cutting plotter.'
      }
    ],
    totalQty: 2,
    totalAreaM2: 3,
    subtotal: 270000,
    discount: 20000,
    totalAmount: 250000,
    dpPaid: 100000,
    remainingAmount: 150000,
    isPaid: false,
    paymentMethod: 'QRIS',
    designerName: 'Andi (Prepress)',
    operatorName: 'Budi (Operator Roland)',
    assignedMachine: 'INDOOR_ROLAND',
    customerNotes: 'Harap laminasi doff jangan sampai ada gelembung udara.',
    statusLogs: [
      {
        status: 'MENUNGGU_SETTING',
        timestamp: Date.now() - 2 * 3600 * 1000,
        formattedTime: '30 Sep 2026, 09:15',
        changedBy: 'Kasir Front Office',
        note: 'Input pesanan stiker label botol'
      },
      {
        status: 'SETTING_SELESAI',
        timestamp: Date.now() - 1.5 * 3600 * 1000,
        formattedTime: '30 Sep 2026, 09:45',
        changedBy: 'Andi (Prepress)',
        note: 'Layout nesting 500 pcs per lembar selesai + cutline siap kirim ke Roland'
      }
    ]
  },
  {
    id: 'SPK-260930-0003',
    orderNumber: 'SPK-260930-0003',
    date: '2026-09-30',
    time: '10:00:00',
    timestamp: Date.now() - 1 * 3600 * 1000,
    deadlineDate: '2026-09-30',
    deadlineTime: '13:00:00',
    priority: 'URGENT',
    status: 'SEDANG_CETAK',
    customerName: 'Dr. Hendra Prakoso',
    customerPhone: '0813-2233-4455',
    customerCategory: 'Umum',
    items: [
      {
        id: 'item_spk_3',
        jobName: 'Backdrop Seminar Kesehatan 4x2m',
        materialName: 'Flexi Korea Korchin 440g High-Res',
        lengthMeters: 4,
        widthMeters: 2,
        qty: 1,
        areaM2: 8,
        unitPrice: 45000,
        materialPriceTotal: 360000,
        finishings: [
          { id: 'fin_5', name: 'Mata Ayam Keliling (12 titik)', type: 'mata_ayam', price: 20000, qty: 12 },
          { id: 'fin_6', name: 'Lipat Lem Keliling Tebal', type: 'lipat_lem', price: 15000 }
        ],
        finishingPriceTotal: 35000,
        totalPrice: 395000,
        printMachine: 'OUTDOOR_KONICA',
        colorProfile: 'CMYK',
        designFileName: 'backdrop_seminar_kedokteran.pdf',
        operatorNotes: 'Bahan tebal korchin, tinta outdoor 4 pass high density.'
      }
    ],
    totalQty: 1,
    totalAreaM2: 8,
    subtotal: 395000,
    discount: 0,
    totalAmount: 395000,
    dpPaid: 395000,
    remainingAmount: 0,
    isPaid: true,
    paymentMethod: 'CASH',
    designerName: 'Andi (Prepress)',
    operatorName: 'Doni (Operator Konica)',
    assignedMachine: 'OUTDOOR_KONICA',
    customerNotes: 'Lunas di awal tunai di kasir.',
    statusLogs: [
      {
        status: 'MENUNGGU_SETTING',
        timestamp: Date.now() - 1 * 3600 * 1000,
        formattedTime: '30 Sep 2026, 10:00',
        changedBy: 'Kasir Front Office',
        note: 'Order lunas cash'
      },
      {
        status: 'SETTING_SELESAI',
        timestamp: Date.now() - 45 * 60 * 1000,
        formattedTime: '30 Sep 2026, 10:15',
        changedBy: 'Andi (Prepress)',
        note: 'RIP file resolusi 720 dpi siap'
      },
      {
        status: 'SEDANG_CETAK',
        timestamp: Date.now() - 25 * 60 * 1000,
        formattedTime: '30 Sep 2026, 10:35',
        changedBy: 'Doni (Operator Konica)',
        note: 'Sedang proses running di mesin Konica 512i (Progress 60%)'
      }
    ]
  },
  {
    id: 'SPK-260930-0004',
    orderNumber: 'SPK-260930-0004',
    date: '2026-09-30',
    time: '07:45:00',
    timestamp: Date.now() - 4 * 3600 * 1000,
    deadlineDate: '2026-09-30',
    deadlineTime: '12:00:00',
    priority: 'NORMAL',
    status: 'FINISHING',
    customerName: 'Komunitas Motor Beat Matic Club',
    customerPhone: '0878-3344-5566',
    customerCategory: 'Grosir',
    items: [
      {
        id: 'item_spk_4',
        jobName: 'Stiker Logo Komunitas Die-Cut Hologram',
        materialName: 'Stiker Hologram Rainbow Premium',
        lengthMeters: 2,
        widthMeters: 1,
        qty: 1,
        areaM2: 2,
        unitPrice: 95000,
        materialPriceTotal: 190000,
        finishings: [
          { id: 'fin_7', name: 'Laminasi Glossy Tebal', type: 'laminasi', price: 25000 },
          { id: 'fin_8', name: 'Die-Cut Putus Bentuk Logo', type: 'cutting', price: 35000 }
        ],
        finishingPriceTotal: 60000,
        totalPrice: 250000,
        printMachine: 'UV_FLATBED',
        colorProfile: 'CMYK',
        designFileName: 'stiker_hologram_beat_club.cdr'
      }
    ],
    totalQty: 1,
    totalAreaM2: 2,
    subtotal: 250000,
    discount: 0,
    totalAmount: 250000,
    dpPaid: 100000,
    remainingAmount: 150000,
    isPaid: false,
    paymentMethod: 'TRANSFER',
    designerName: 'Andi (Prepress)',
    operatorName: 'Fajar (Operator UV)',
    finishingPerson: 'Riko (Finishing & Potong)',
    assignedMachine: 'UV_FLATBED',
    customerNotes: 'Stiker jangan sampai tergores saat proses potong die-cut.',
    statusLogs: [
      {
        status: 'MENUNGGU_SETTING',
        timestamp: Date.now() - 4 * 3600 * 1000,
        formattedTime: '30 Sep 2026, 07:45',
        changedBy: 'Kasir Front Office'
      },
      {
        status: 'SEDANG_CETAK',
        timestamp: Date.now() - 2.5 * 3600 * 1000,
        formattedTime: '30 Sep 2026, 08:30',
        changedBy: 'Fajar (Operator UV)'
      },
      {
        status: 'FINISHING',
        timestamp: Date.now() - 40 * 60 * 1000,
        formattedTime: '30 Sep 2026, 10:20',
        changedBy: 'Riko (Finishing)',
        note: 'Sedang laminasi glossy & masuk mesin potong die-cut'
      }
    ]
  },
  {
    id: 'SPK-260930-0005',
    orderNumber: 'SPK-260930-0005',
    date: '2026-09-30',
    time: '07:00:00',
    timestamp: Date.now() - 5 * 3600 * 1000,
    deadlineDate: '2026-09-30',
    deadlineTime: '11:00:00',
    priority: 'NORMAL',
    status: 'SIAP_AMBIL',
    customerName: 'Siti Nurhaliza (Wisudawan UNY)',
    customerPhone: '0896-1234-5678',
    customerCategory: 'Umum',
    items: [
      {
        id: 'item_spk_5',
        jobName: 'X-Banner Wisuda Stand Fiber + Banner Luster',
        materialName: 'Albatros / Luster Glossy',
        lengthMeters: 1.6,
        widthMeters: 0.6,
        qty: 1,
        areaM2: 0.96,
        unitPrice: 55000,
        materialPriceTotal: 65000,
        finishings: [
          { id: 'fin_9', name: 'Laminasi Doff Anti Pantul', type: 'laminasi', price: 15000 },
          { id: 'fin_10', name: 'Kaki Stand X-Banner Fiber Hitam', type: 'custom', price: 35000 }
        ],
        finishingPriceTotal: 50000,
        totalPrice: 115000,
        printMachine: 'INDOOR_ROLAND',
        colorProfile: 'CMYK',
        designFileName: 'xbanner_wisuda_siti.pdf'
      }
    ],
    totalQty: 1,
    totalAreaM2: 0.96,
    subtotal: 115000,
    discount: 0,
    totalAmount: 115000,
    dpPaid: 50000,
    remainingAmount: 65000,
    isPaid: false,
    paymentMethod: 'QRIS',
    designerName: 'Andi (Prepress)',
    operatorName: 'Budi (Operator Roland)',
    finishingPerson: 'Riko (Finishing)',
    assignedMachine: 'INDOOR_ROLAND',
    customerNotes: 'Pelanggan sudah dikonfirmasi via WA bahwa barang sudah siap di rak kasir.',
    statusLogs: [
      {
        status: 'MENUNGGU_SETTING',
        timestamp: Date.now() - 5 * 3600 * 1000,
        formattedTime: '30 Sep 2026, 07:00',
        changedBy: 'Kasir Front Office'
      },
      {
        status: 'SEDANG_CETAK',
        timestamp: Date.now() - 3.5 * 3600 * 1000,
        formattedTime: '30 Sep 2026, 07:30',
        changedBy: 'Budi (Operator Roland)'
      },
      {
        status: 'FINISHING',
        timestamp: Date.now() - 2 * 3600 * 1000,
        formattedTime: '30 Sep 2026, 08:30',
        changedBy: 'Riko (Finishing)'
      },
      {
        status: 'SIAP_AMBIL',
        timestamp: Date.now() - 30 * 60 * 1000,
        formattedTime: '30 Sep 2026, 10:30',
        changedBy: 'Riko (Finishing)',
        note: 'Produk sudah dipacking rapi & ditaruh di rak pick-up kasir. Siap pelunasan Rp 65.000'
      }
    ]
  }
];

/**
 * Helper to strip any oversized embedded binary/dataUrl fields from SPK orders.
 * Binary print files are stored strictly inside IndexedDB (localFileVault),
 * so localStorage and Cloud PocketBase always remain ultra-lightweight.
 */
export function sanitizeSpkOrderForStorage(order: SpkOrder): SpkOrder {
  const sanitizeAttachment = (att: any) => {
    if (!att || typeof att !== 'object') return undefined;
    return {
      id: att.id || `file_${Date.now()}`,
      fileName: att.fileName || 'file_cetak.pdf',
      fileSize: typeof att.fileSize === 'number' ? att.fileSize : undefined,
      fileType: att.fileType || 'application/octet-stream',
      localPath: att.localPath || '',
      lanFolderUrl: att.lanFolderUrl || '',
      storageKey: att.storageKey || att.id || '',
      uploadedAt: att.uploadedAt || Date.now(),
      uploadedBy: att.uploadedBy || 'Operator',
      sharedCopy: att.sharedCopy === true,
      sharedCopiedAt: att.sharedCopiedAt || undefined,
      sharedSize: typeof att.sharedSize === 'number' ? att.sharedSize : undefined,
      sharedFolderName: att.sharedFolderName || '',
      originalFileName: att.originalFileName || ''
    };
  };

  return {
    ...order,
    printFile: sanitizeAttachment(order.printFile),
    printFiles: order.printFiles ? order.printFiles.map(sanitizeAttachment).filter(Boolean) as any : undefined,
    items: (order.items || []).map((it) => ({
      ...it,
      printFile: sanitizeAttachment(it.printFile),
      printFiles: it.printFiles ? it.printFiles.map(sanitizeAttachment).filter(Boolean) as any : undefined,
      designFileUrl: undefined,
      previewImageUrl: undefined
    }))
  };
}

export function getStoredSpkOrders(): SpkOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SPK_ORDERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SPK_ORDERS, JSON.stringify(DEFAULT_SPK_ORDERS));
      return DEFAULT_SPK_ORDERS;
    }
    const parsed: SpkOrder[] = JSON.parse(raw);
    // Sanitize any existing orders that may contain large base64 strings from earlier uploads
    const sanitized = parsed.map(sanitizeSpkOrderForStorage);
    return sanitized;
  } catch (e) {
    console.error('Failed to parse SPK orders', e);
    return DEFAULT_SPK_ORDERS;
  }
}

export function saveStoredSpkOrders(orders: SpkOrder[]): void {
  try {
    const sanitized = orders.map(sanitizeSpkOrderForStorage);
    localStorage.setItem(STORAGE_KEYS.SPK_ORDERS, JSON.stringify(sanitized));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_spk_orders_updated', { detail: sanitized }));
    }
  } catch (e) {
    console.error('Failed to save SPK orders to localStorage, attempting emergency compaction', e);
    try {
      // Emergency fallback: slice newest 50 orders with minimal fields
      const compacted = orders.slice(0, 50).map(sanitizeSpkOrderForStorage);
      localStorage.setItem(STORAGE_KEYS.SPK_ORDERS, JSON.stringify(compacted));
    } catch (err2) {
      console.error('Critical localStorage quota exhaustion', err2);
    }
  }
}

export function generateSpkOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SPK-${yy}${mm}${dd}-${rand}`;
}

export function addStoredSpkOrder(order: SpkOrder): SpkOrder[] {
  const current = getStoredSpkOrders();
  const updated = [order, ...current];
  saveStoredSpkOrders(updated);
  return updated;
}

export function updateStoredSpkOrder(orderId: string, updates: Partial<SpkOrder>, changedBy: string = 'Developer'): SpkOrder[] {
  const current = getStoredSpkOrders();
  const updated = current.map((order) => {
    if (order.id === orderId) {
      const newStatus = updates.status || order.status;
      const statusChanged = updates.status && updates.status !== order.status;
      
      const updatedLogs = statusChanged
        ? [
            ...order.statusLogs,
            {
              status: newStatus,
              timestamp: Date.now(),
              formattedTime: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              changedBy,
              note: updates.internalNotes || `Perubahan status ke ${newStatus}`
            }
          ]
        : order.statusLogs;

      return {
        ...order,
        ...updates,
        statusLogs: updatedLogs
      };
    }
    return order;
  });

  saveStoredSpkOrders(updated);
  return updated;
}

export function deleteStoredSpkOrder(orderId: string): SpkOrder[] {
  const current = getStoredSpkOrders();
  const updated = current.filter((o) => o.id !== orderId);
  saveStoredSpkOrders(updated);
  return updated;
}

export const DEFAULT_MACHINES: MachineItem[] = [
  {
    id: 'OUTDOOR_KONICA',
    name: 'Outdoor Konica 512i (3.2m)',
    category: 'CETAK',
    typeDescription: 'High Speed Banner & Flexi Outdoor',
    status: 'READY',
    speed: '80 m²/jam',
    headSpec: '4x Konica 512i 30pl',
    operatorDefault: 'Budi (Operator Konica)',
    notes: 'Mesin utama spanduk & banner outdoor lebar 3.2m',
    ipAddress: '192.168.1.101',
    port: 9100,
    hostName: 'RIP-KONICA-512I',
    lanStatus: 'CHECKING',
    ripSoftware: 'PhotoPrint 19 / MainTop 6.1 RIP'
  },
  {
    id: 'INDOOR_ROLAND',
    name: 'Indoor Roland Eco-Solvent (1.6m)',
    category: 'CETAK',
    typeDescription: 'Stiker Vinyl, Albatros, Backlite, Luster',
    status: 'READY',
    speed: '18 m²/jam (High-Res 1440 DPI)',
    headSpec: 'Epson DX7 Printhead',
    operatorDefault: 'Andi (Operator Roland)',
    notes: 'Mesin indoor cetak stiker halus presisi 1.6m',
    ipAddress: '192.168.1.102',
    port: 8080,
    hostName: 'ROLAND-VERSAWORKS-PC',
    lanStatus: 'CHECKING',
    ripSoftware: 'Roland VersaWorks 6'
  },
  {
    id: 'UV_FLATBED',
    name: 'UV Flatbed & Roll High-End',
    category: 'CETAK',
    typeDescription: 'Akrilik, Kaca, Hologram, Kulit, Wood',
    status: 'READY',
    speed: '12 m²/jam (Tinta UV Curing)',
    headSpec: 'Ricoh Gen5 + White Ink',
    operatorDefault: 'Dedi (Operator UV)',
    notes: 'Cetak timbul UV flatbed & roll bahan khusus',
    ipAddress: '192.168.1.103',
    port: 9100,
    hostName: 'UV-FLATBED-CONTROLLER',
    lanStatus: 'CHECKING',
    ripSoftware: 'Wasatch SoftRIP UV'
  },
  {
    id: 'PLOTTER_CUTTING',
    name: 'Plotter Cutting Graphtec CE7000',
    category: 'CUTTING',
    typeDescription: 'Kiss Cut & Die Cut Stiker Presisi',
    status: 'READY',
    speed: '1000 mm/s',
    headSpec: 'Dual Sensor ARMS 8.0',
    operatorDefault: 'Riko (Operator Cutting)',
    notes: 'Cutting stiker pola otomatis sensor titik registrasi',
    ipAddress: '192.168.1.104',
    port: 9100,
    hostName: 'GRAPHTEC-CUTTING-STATION',
    lanStatus: 'CHECKING',
    ripSoftware: 'Cutting Master 4 / Cutting Controller'
  },
  {
    id: 'DTF_TEXTILE',
    name: 'DTF Sablon Kaos Textile (60cm)',
    category: 'CETAK',
    typeDescription: 'Sablon Kaos, Topi, Totebag, Jersey',
    status: 'READY',
    speed: '10 m²/jam',
    headSpec: 'Dual i3200 + Powder Shaker',
    operatorDefault: 'Fajar (Operator DTF)',
    notes: 'Transfer film sablon kaos meteran',
    ipAddress: '192.168.1.105',
    port: 9100,
    hostName: 'DTF-PRINT-STATION',
    lanStatus: 'CHECKING',
    ripSoftware: 'Maintop 6.1 DTF Edition'
  },
  {
    id: 'LASER_ACRYLIC',
    name: 'Laser Cutting Acrylic CO2 1390',
    category: 'CUTTING',
    typeDescription: 'Plakat, Huruf Timbul, Display Akrilik',
    status: 'READY',
    speed: '600 mm/s (100W Tube)',
    headSpec: 'CO2 Sealed Glass 100W',
    operatorDefault: 'Hendra (Operator Laser)',
    notes: 'Potong & grafir akrilik, kayu, MDF, spon',
    ipAddress: '192.168.1.106',
    port: 50200,
    hostName: 'RUIDA-LASER-CONTROLLER',
    lanStatus: 'CHECKING',
    ripSoftware: 'RDWorks V8.0 / LightBurn'
  }
];

export function getStoredMachines(): MachineItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MACHINES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(DEFAULT_MACHINES));
      return DEFAULT_MACHINES;
    }
    const parsed = JSON.parse(raw);
    // Ensure LAN properties exist from defaults if missing
    return parsed.map((m: MachineItem) => {
      const def = DEFAULT_MACHINES.find((d) => d.id === m.id);
      if (def) {
        return {
          ...def,
          ...m,
          ipAddress: m.ipAddress || def.ipAddress,
          port: m.port || def.port,
          hostName: m.hostName || def.hostName,
          sharedFolderLanPath: m.sharedFolderLanPath,
          lanStatus: m.lanStatus || def.lanStatus || 'CHECKING',
          ripSoftware: m.ripSoftware || def.ripSoftware
        };
      }
      return m;
    });
  } catch (e) {
    console.error('Failed to parse machines', e);
    return DEFAULT_MACHINES;
  }
}

export function saveStoredMachines(machines: MachineItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(machines));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_machines_updated', { detail: machines }));
    }
  } catch (e) {
    console.error('Failed to save machines', e);
  }
}

// ----------------------------------------------------
// AI Internal Chat & User Mentions (@userX) Engine
// ----------------------------------------------------

export function getStoredAiChatMessages(): AiInternalChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_CHAT_MESSAGES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse AI Chat Messages', e);
    return [];
  }
}

export function saveStoredAiChatMessages(messages: AiInternalChatMessage[]): void {
  try {
    // Keep max 150 recent messages to prevent storage bloat
    const trimmed = messages.slice(-150);
    localStorage.setItem(STORAGE_KEYS.AI_CHAT_MESSAGES, JSON.stringify(trimmed));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_ai_chat_updated', { detail: trimmed }));
    }
  } catch (e) {
    console.error('Failed to save AI Chat Messages', e);
  }
}

export function addStoredAiChatMessage(message: AiInternalChatMessage): AiInternalChatMessage[] {
  const current = getStoredAiChatMessages();
  // Check duplicate
  if (current.some((m) => m.id === message.id)) return current;
  const updated = [...current, message];
  saveStoredAiChatMessages(updated);
  return updated;
}

export function getStoredUserMentions(): UserMentionNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_MENTIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse User Mentions', e);
    return [];
  }
}

export function saveStoredUserMentions(notifications: UserMentionNotification[]): void {
  try {
    const trimmed = notifications.slice(-50);
    localStorage.setItem(STORAGE_KEYS.USER_MENTIONS, JSON.stringify(trimmed));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_user_mentions_updated', { detail: trimmed }));
    }
  } catch (e) {
    console.error('Failed to save User Mentions', e);
  }
}

export function addStoredUserMention(notif: UserMentionNotification): UserMentionNotification[] {
  const current = getStoredUserMentions();
  if (current.some((n) => n.id === notif.id)) return current;
  const updated = [notif, ...current];
  saveStoredUserMentions(updated);
  return updated;
}

export function markStoredUserMentionRead(notifId: string): UserMentionNotification[] {
  const current = getStoredUserMentions();
  const updated = current.map((n) => (n.id === notifId ? { ...n, isRead: true } : n));
  saveStoredUserMentions(updated);
  return updated;
}

export function getStoredPrintingRejects(): PrintingRejectRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRINTING_REJECTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse Printing Rejects', e);
    return [];
  }
}

export function saveStoredPrintingRejects(rejects: PrintingRejectRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRINTING_REJECTS, JSON.stringify(rejects));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_printing_rejects_updated', { detail: rejects }));
    }
  } catch (e) {
    console.error('Failed to save Printing Rejects', e);
  }
}

export interface BejoAiSettings {
  engineMode: 'HYBRID_AUTO' | 'ONLINE_ONLY' | 'OFFLINE_ONLY';
  personaStyle: 'CERIA' | 'FORMAL' | 'SANTAI' | 'RINGKAS';
  customCallName?: string;
  enableTts: boolean;
  ttsSpeed: number;
  enableSystemNotifications: boolean;
  enableDeadlineAlerts: boolean;
  autoGreetingOnShift: boolean;
}

export const DEFAULT_AI_SETTINGS: BejoAiSettings = {
  engineMode: 'HYBRID_AUTO',
  personaStyle: 'CERIA',
  customCallName: '',
  enableTts: false,
  ttsSpeed: 1.0,
  enableSystemNotifications: true,
  enableDeadlineAlerts: true,
  autoGreetingOnShift: true
};

export function getStoredAiSettings(): BejoAiSettings {
  try {
    const raw = localStorage.getItem('bejo_ai_settings');
    if (!raw) return DEFAULT_AI_SETTINGS;
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveStoredAiSettings(settings: BejoAiSettings): void {
  try {
    localStorage.setItem('bejo_ai_settings', JSON.stringify(settings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_ai_settings_updated', { detail: settings }));
    }
  } catch (e) {
    console.error('Failed to save AI Settings', e);
  }
}




