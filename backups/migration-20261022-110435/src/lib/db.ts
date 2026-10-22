import { getPB } from './pocketbase';
import type { RecordModel } from 'pocketbase';

// Collection names mapping
export const COLLECTIONS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  CUSTOMERS: 'customers',
  TRANSACTIONS: 'transactions',
  STOCK_TRANSACTIONS: 'stock_transactions',
  SHIFTS: 'shifts',
  CASHIERS: 'cashiers',
  USERS: 'users',
  AGENTS: 'agents',
  SUPPLIERS: 'suppliers',
  PRODUCT_CATEGORIES: 'product_categories',
  CUSTOMER_CATEGORIES: 'customer_categories',
  SETTINGS: 'settings',
  STORE_PROFILES: 'store_profiles',
  INVOICES: 'invoices',
  INVOICE_SETTINGS: 'invoice_settings',
  STOCK_TRANSACTIONS: 'stock_transactions',
  SHIFTS: 'shifts',
  CASHIERS: 'cashiers',
  USERS: 'users',
  AGENTS: 'agents',
  SUPPLIERS: 'suppliers',
  PRODUCT_CATEGORIES: 'product_categories',
  CUSTOMER_CATEGORIES: 'customer_categories',
  SETTINGS: 'settings',
  STORE_PROFILES: 'store_profiles',
  INVOICES: 'invoices',
  INVOICE_SETTINGS: 'invoice_settings',
  STOCK_TRANSACTIONS: 'stock_transactions',
  SHIFTS: 'shifts',
  CASHIERS: 'cashiers',
  USERS: 'users',
  AGENTS: 'agents',
  SUPPLIERS: 'suppliers',
  PRODUCT_CATEGORIES: 'product_categories',
  CUSTOMER_CATEGORIES: 'customer_categories',
  SETTINGS: 'settings',
  STORE_PROFILES: 'store_profiles',
  INVOICES: 'invoices',
  INVOICE_SETTINGS: 'invoice_settings',
  STOCK_TRANSACTIONS: 'stock_transactions',
  SHIFTS: 'shifts',
  CASHIERS: 'cashiers',
  USERS: 'users',
  AGENTS: 'agents',
  SUPPLIERS: 'suppliers',
  PRODUCT_CATEGORIES: 'product_categories',
  CUSTOMER_CATEGORIES: 'customer_categories',
  SETTINGS: 'settings',
  STORE_PROFILES: 'store_profiles',
  INVOICES: 'invoices',
  INVOICE_SETTINGS: 'invoice_settings',
  STOCK_TRANSACTIONS: 'stock_transactions',
  SHIFTS: 'shifts',
  CASHIERS: 'cashiers',
  USERS: 'users',
  AGENTS: 'agents',
  SUPPLIERS: 'suppliers',
  PRODUCT_CATEGORIES: 'product_categories',
  CUSTOMER_CATEGORIES: 'customer_categories',
  SETTINGS: 'settings',
  STORE_PROFILES: 'store_profiles',
  INVOICES: 'invoices',
  INVOICE_SETTINGS: 'invoice_settings',
} as const;

type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// Generic CRUD operations
export const db = {
  // Get all records with optional filter/sort
  async getAll<T>(collection: string, options?: {
    filter?: string;
    sort?: string;
    perPage?: number;
    page?: number;
    expand?: string;
  }): Promise<any[]> {
    const pb = getPB();
    return pb.collection(collection).getFullList({
      filter: options?.filter,
      sort: options?.sort || '-created',
      perPage: options?.perPage || 200,
      page: options?.page || 1,
      expand: options?.expand,
    });
  },

  // Get single record
  async getOne(collection: string, id: string, expand?: string) {
    const pb = getPB();
    return pb.collection(collection).getOne(id, { expand: options?.expand });
  },

  // Create record
  async create(collection: string, data: Record<string, any>) {
    const pb = getPB();
    return pb.collection(collection).create(data);
  },

  // Update record
  async update(collection: string, id: string, data: Partial<any>) {
    const pb = getPB();
    return pb.collection(collection).update(id, data);
  },

  // Delete record
  async delete(collection: string, id: string) {
    const pb = getPB();
    return pb.collection(collection).delete(id);
  },

  // Real-time subscription
  subscribe(collection: string, callback: (records: any[]) => void, options?: {
    filter?: string;
    sort?: string;
  }) {
    const pb = getPB();
    return pb.collection(collection).subscribe('*', (e) => {
      // Re-fetch all data on change (simple approach)
      this.getAll(collection).then(callback);
    });
  },

  // Real-time subscription with callback per event
  subscribeRealtime(collection: string, callbacks: {
    onCreate?: (record: any) => void;
    onUpdate?: (record: any) => void;
    onDelete?: (record: any) => void;
  }) {
    const pb = getPB();
    return pb.collection(collection).subscribe('*', (e) => {
      switch (e.action) {
        case 'create':
          callbacks.onCreate?.(e.record);
          break;
        case 'update':
          callbacks.onUpdate?.(e.record);
          break;
        case 'delete':
          callbacks.onDelete?.(e.record);
          break;
      }
    });
  }
};

// Specific collection helpers
export const products = {
  getAll: (options?) => db.getAll('products', options),
  getOne: (id: string) => db.getOne('products', id),
  create: (data: any) => db.create('products', data),
  update: (id: string, data: any) => db.update('products', id, data),
  delete: (id: string) => db.delete('products', id),
  subscribe: (callback) => db.subscribe('products', callback),
};

export const categories = {
  getAll: (options?) => db.getAll('categories', options),
  getOne: (id: string) => db.getOne('categories', id),
  create: (data) => db.create('categories', data),
  update: (id: string, data: any) => db.update('categories', id, data),
  delete: (id: string) => db.delete('categories', id),
};

export const customers = {
  getAll: (options?) => db.getAll('customers', options),
  getOne: (id: string) => db.getOne('customers', id),
  create: (data) => db.create('customers', data),
  update: (id: string, data: any) => db.update('customers', id, data),
  delete: (id: string) => db.delete('customers', id),
};

export const transactions = {
  getAll: (options?) => db.getAll('transactions', { sort: '-created', ...options }),
  getOne: (id: string) => db.getOne('transactions', id),
  create: (data) => db.create('transactions', data),
  update: (id: string, data: any) => db.update('transactions', id, data),
  delete: (id: string) => db.delete('transactions', id),
};

export const stockTransactions = {
  getAll: (options?) => db.getAll('stock_transactions', { sort: '-created', ...options }),
  getOne: (id: string) => db.getOne('stock_transactions', id),
  create: (data) => db.create('stock_transactions', data),
  update: (id: string, data: any) => db.update('stock_transactions', id, data),
  delete: (id: string) => db.delete('stock_transactions', id),
};

export const shifts = {
  getAll: (options?) => db.getAll('shifts', { sort: '-created', ...options }),
  getOne: (id: string) => db.getOne('shifts', id),
  create: (data) => db.create('shifts', data),
  update: (id: string, data: any) => db.update('shifts', id, data),
  delete: (id: string) => db.delete('shifts', id),
};

export const cashiers = {
  getAll: (options?) => db.getAll('cashiers', options),
  getOne: (id: string) => db.getOne('cashiers', id),
  create: (data) => db.create('cashiers', data),
  update: (id: string, data: any) => db.update('cashiers', id, data),
  delete: (id: string) => db.delete('cashiers', id),
};

export const users = {
  getAll: (options?) => db.getAll('users', { filter: 'isActive=true' }),
  getOne: (id: string) => db.getOne('users', id),
  create: (data) => db.create('users', data),
  update: (id: string, data: any) => db.update('users', id, data),
  delete: (id: string) => db.delete('users', id),
  // Auth helpers
  async authenticate(email: string, password: string) {
    const pb = getPB();
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData;
  },
  async login(email: string, password: string) {
    const pb = getPB();
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData;
  },
  async register(data: { email: string; password: string; name: string; role?: string }) {
    const pb = getPB();
    return pb.collection('users').create({
      email: data.email,
      password: data.password,
      passwordConfirm: data.password,
      name: data.name,
      role: data.role || 'kasir',
      isActive: true
    });
  }
};