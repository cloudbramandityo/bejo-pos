import { getPB, subscribeRealtime } from './pocketbase';

/** Nama koleksi PocketBase */
export const COLLECTIONS = {
  PRODUCTS: 'products',
  PRODUCT_CATEGORIES: 'product_categories',
  CUSTOMERS: 'customers',
  CUSTOMER_CATEGORIES: 'customer_categories',
  TRANSACTIONS: 'transactions',
  STOCK_TRANSACTIONS: 'stock_transactions',
  SHIFTS: 'shifts',
  CASHIERS: 'cashiers',
  USERS: 'users',
  AGENTS: 'agents',
  SUPPLIERS: 'suppliers',
  SETTINGS: 'settings',
  STORE_PROFILES: 'store_profiles',
  CUSTOM_ROLES: 'custom_roles',
  AGENT_NOTIFICATIONS: 'agent_notifications',
  ACTIVITY_LOGS: 'activity_logs',
  SPK_ORDERS: 'spk_orders',
  MACHINES: 'machines',
  AI_CHAT_MESSAGES: 'ai_chat_messages',
  USER_MENTIONS: 'user_mentions',
  PRIVATE_CHAT_MESSAGES: 'private_chat_messages',
  PRINTING_REJECTS: 'printing_rejects',
  INVOICES: 'invoices',
  INVOICE_SETTINGS: 'invoice_settings',
  TAXPAYER_PROFILE: 'taxpayer_profile',
  TAX_ANNUAL_RETURNS: 'tax_annual_returns',
  TAX_MONTHLY_BILLINGS: 'tax_monthly_billings',
} as const;

export interface PBQueryOptions {
  filter?: string;
  sort?: string;
  perPage?: number;
  page?: number;
  expand?: string;
}

/** Buang field internal PocketBase (collectionId, expand, dll) */
export function stripPbFields(data: Record<string, any>): Record<string, any> {
  const { collectionId, collectionName, expand, tokenKey, ...rest } = data || {};
  return rest;
}

/** Ambil semua record (dengan pagination penuh) */
export async function pbGetAll(
  collection: string,
  options?: PBQueryOptions
): Promise<any[]> {
  const pb = getPB();
  const result = await pb.collection(collection).getList(1, options?.perPage || 500, {
    filter: options?.filter,
    sort: options?.sort,
    expand: options?.expand,
  });
  return result.items.map((item) => stripPbFields(item as any));
}

/** Ambil satu record (null bila tidak ada) */
export async function pbGetOne(
  collection: string,
  id: string,
  expand?: string
): Promise<any | null> {
  try {
    const record = await getPB().collection(collection).getOne(id, { expand });
    return stripPbFields(record as any);
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

/** Buat record baru */
export async function pbCreate(collection: string, data: Record<string, any>) {
  return getPB().collection(collection).create(data);
}

/** Update record */
export async function pbUpdate(
  collection: string,
  id: string,
  data: Record<string, any>
) {
  return getPB().collection(collection).update(id, data);
}

/** Hapus record */
export async function pbDelete(collection: string, id: string) {
  return getPB().collection(collection).delete(id);
}

/** Upsert: update bila ada, create bila belum */
export async function pbUpsert(
  collection: string,
  id: string,
  data: Record<string, any>
) {
  const pb = getPB();
  const payload = stripPbFields(data);
  try {
    await pb.collection(collection).update(id, payload);
  } catch (err: any) {
    if (err?.status === 404) {
      await pb.collection(collection).create({ ...payload, id });
    } else {
      throw err;
    }
  }
}

/** Subscribe realtime sebuah koleksi */
export function pbSubscribe(
  collection: string,
  callback: (e: any) => void
): () => void {
  const pb = getPB();
  return subscribeRealtime(pb.collection(collection) as any, '*', callback);
}

/** Subscribe realtime satu record (koleksi settings, dlsb) */
export function pbSubscribeRecord(
  collection: string,
  id: string,
  callback: (e: any) => void
): () => void {
  const pb = getPB();
  return subscribeRealtime(pb.collection(collection) as any, id, callback);
}

/** Helper koleksi umum */
export const products = {
  getAll: (options?: PBQueryOptions) => pbGetAll('products', options),
  getOne: (id: string) => pbGetOne('products', id),
  create: (data: any) => pbCreate('products', data),
  update: (id: string, data: any) => pbUpdate('products', id, data),
  delete: (id: string) => pbDelete('products', id),
};

export const customers = {
  getAll: (options?: PBQueryOptions) => pbGetAll('customers', options),
  getOne: (id: string) => pbGetOne('customers', id),
  create: (data: any) => pbCreate('customers', data),
  update: (id: string, data: any) => pbUpdate('customers', id, data),
  delete: (id: string) => pbDelete('customers', id),
};

export const transactions = {
  getAll: (options?: PBQueryOptions) =>
    pbGetAll('transactions', { sort: '-created', ...options }),
  getOne: (id: string) => pbGetOne('transactions', id),
  create: (data: any) => pbCreate('transactions', data),
  update: (id: string, data: any) => pbUpdate('transactions', id, data),
  delete: (id: string) => pbDelete('transactions', id),
};

export const users = {
  getAll: (options?: PBQueryOptions) =>
    pbGetAll('users', { filter: 'isActive = true', ...options }),
  getOne: (id: string) => pbGetOne('users', id),
  create: (data: any) => pbCreate('users', data),
  update: (id: string, data: any) => pbUpdate('users', id, data),
  delete: (id: string) => pbDelete('users', id),
  async login(email: string, password: string) {
    const pb = getPB();
    return pb.collection('users').authWithPassword(email, password);
  },
  async register(data: {
    email: string;
    password: string;
    name: string;
    role?: string;
  }) {
    const pb = getPB();
    return pb.collection('users').create({
      email: data.email,
      password: data.password,
      passwordConfirm: data.password,
      name: data.name,
      role: data.role || 'kasir',
      isActive: true,
    });
  },
};
