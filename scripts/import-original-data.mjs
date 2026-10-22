/**
 * =====================================================================
 *  BEJO STIKER POS - Import Data Original ke PocketBase
 * =====================================================================
 *  Menjalankan di PC (Node 18+):
 *
 *      # 1. Set environment variables
 *      $env:POCKETBASE_URL="http://localhost:8090"
 *      $env:PB_ADMIN_EMAIL="admin@bejodigitalprint.com"
 *      $env:PB_ADMIN_PASSWORD="Bejo#PB2026"
 *
 *      # 2. Jalankan
 *      node scripts\import-original-data.mjs
 *
 *  Catatan:
 *  - Script ini akan HAPUS data lama di PocketBase lalu import data baru
 *  - Backup file: backup_pos_bejo_stiker_22-10-2026_1338.json
 *  - Memerlukan akses admin PocketBase
 * =====================================================================
 */

import PocketBase from 'pocketbase';
import fs from 'node:fs';
import path from 'node:path';

// Konfigurasi
const BACKUP_FILE = 'D:/DOWNLOADS/backup_pos_bejo_stiker_22-10-2026_1338.json';
const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || '';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || '';

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.warn(`  ⚠ ${m}`);
const fail = (m) => { console.error(`  ✗ ${m}`); process.exit(1); };

// Mapping nama file backup -> nama koleksi PocketBase
const COLLECTION_MAP = {
  products: 'products',
  productCategories: 'product_categories',
  customers: 'customers',
  customerCategories: 'customer_categories',
  suppliers: 'suppliers',
  agents: 'agents',
  transactions: 'transactions',
  shifts: 'shifts',
  stockTransactions: 'stock_transactions',
  users: 'users',
  cashiers: 'cashiers',
  activityLogs: 'activity_logs',
};

// Koleksi yang butuh ID khusus (settings)
const SETTINGS_DOCS = ['store_info', 'active_shift', 'database_init'];

async function main() {
  console.log('==================================================================');
  console.log('  BEJO STIKER POS - IMPORT DATA ORIGINAL KE POCKETBASE');
  console.log('==================================================================');
  console.log(`Backup file: ${BACKUP_FILE}`);
  console.log(`PocketBase:  ${PB_URL}`);
  console.log('');

  // Load backup
  if (!fs.existsSync(BACKUP_FILE)) {
    fail(`Backup file tidak ditemukan: ${BACKUP_FILE}`);
  }
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  log(`Backup dimuat: ${backup.app} v${backup.version} (${backup.exportedAt})`);
  log(`Summary: ${backup.summary.totalProducts} produk, ${backup.summary.totalCustomers} pelanggan, ${backup.summary.totalTransactions} transaksi`);

  // Connect PocketBase
  const pb = new PocketBase(PB_URL);
  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    fail('PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD belum di-set di environment variable');
  }
  try {
    await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  } catch (e) {
    fail(`Login admin gagal: ${e.message}`);
  }
  ok(`Admin login OK`);

  // Helper: clear collection
  async function clearCollection(name) {
    try {
      const list = await pb.collection(name).getFullList(5000);
      for (const rec of list) {
        await pb.collection(name).delete(rec.id);
      }
      ok(`Cleared ${name} (${list.length} records)`);
    } catch (e) {
      warn(`Clear ${name} skipped: ${e.message}`);
    }
  }

  // Helper: import array to collection
  async function importCollection(pbCol, items, idField = 'id') {
    let success = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const id = item[idField];
        const payload = { ...item, legacyId: id };
        delete payload.id; // PocketBase will generate its own ID
        await pb.collection(pbCol).create(payload);
        success++;
      } catch (e) {
        failed++;
        if (failed <= 3) warn(`Failed to import item: ${e.message}`);
      }
    }
    return { success, failed };
  }

  // 1. Hapus data lama
  log('\n=== [1/5] Menghapus data lama di PocketBase ===');
  const allCollections = [
    'products', 'product_categories', 'customers', 'customer_categories',
    'suppliers', 'agents', 'transactions', 'shifts',
    'stock_transactions', 'users', 'cashiers', 'activity_logs',
    'settings'
  ];
  for (const col of allCollections) {
    await clearCollection(col);
  }

  // 2. Import koleksi utama
  log('\n=== [2/5] Import koleksi utama ===');
  const data = backup.data;
  
  // Import regular collections first
  const regularCollections = [
    ['products', 'products'],
    ['productCategories', 'product_categories'],
    ['customers', 'customers'],
    ['customerCategories', 'customer_categories'],
    ['suppliers', 'suppliers'],
    ['agents', 'agents'],
    ['transactions', 'transactions'],
    ['shifts', 'shifts'],
    ['stockTransactions', 'stock_transactions'],
    ['cashiers', 'cashiers'],
    ['activityLogs', 'activity_logs'],
  ];
  
  for (const [backupKey, pbCol] of regularCollections) {
    const items = data[backupKey];
    if (!Array.isArray(items) || items.length === 0) {
      warn(`${backupKey}: kosong, dilewati`);
      continue;
    }
    log(`Import ${backupKey} -> ${pbCol} (${items.length} items)...`);
    const { success, failed } = await importCollection(pbCol, items);
    ok(`${backupKey}: ${success} berhasil, ${failed} gagal`);
  }

  // Import users (auth collection - needs special handling)
  log('\n=== Import users (auth collection) ===');
  const users = data.users;
  if (Array.isArray(users) && users.length > 0) {
    log(`Import users -> users (${users.length} items)...`);
    
    // Fetch existing emails from database
    const existingUsers = await pb.collection('users').getList(1, 100);
    const usedEmails = new Set(existingUsers.items.map(u => u.email));
    log(`Existing emails in DB: ${usedEmails.size}`);
    
    let success = 0, failed = 0;
    for (const user of users) {
      try {
        const id = user.id;
        const baseUsername = user.username || id;
        let email = user.email;
        if (!email) {
          let base = baseUsername.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
          let candidate = `${base}@bejo.local`;
          let counter = 1;
          while (usedEmails.has(candidate)) {
            candidate = `${base}${counter}@bejo.local`;
            counter++;
          }
          email = candidate;
        }
        usedEmails.add(email);
        // PocketBase auth requires password min 8 chars
        let password = user.password || 'bejo-' + id;
        if (password.length < 8) {
          password = password + '12345678'.slice(0, 8 - password.length);
        }
        const payload = {
          ...user,
          legacyId: id,
          email,
          password,
          passwordConfirm: password,
        };
        delete payload.id;
        await pb.collection('users').create(payload);
        success++;
      } catch (e) {
        failed++;
        if (failed <= 5) warn(`Failed to import user ${user.id}: ${e.message}`);
      }
    }
    ok(`users: ${success} berhasil, ${failed} gagal`);
  }

  // 3. Import settings (store_info, active_shift, database_init)
  log('\n=== [3/5] Import settings (storeInfo, activeShift, database_init) ===');
  
  // store_info
  const storeInfo = data.storeInfo;
  if (storeInfo) {
    try {
      await pb.collection('settings').create({ legacyId: 'store_info', ...storeInfo, data: storeInfo });
      ok('store_info imported');
    } catch (e) {
      if (e.status === 400) {
        // Update existing
        const existing = await pb.collection('settings').getList(1, 1, { filter: 'legacyId = "store_info"' });
        if (existing.items.length > 0) {
          await pb.collection('settings').update(existing.items[0].id, { ...storeInfo, data: storeInfo });
          ok('store_info updated');
        }
      } else {
        throw e;
      }
    }
  }
  
  // active_shift
  const activeShift = data.activeShift;
  if (activeShift && Object.keys(activeShift).length > 0) {
    try {
      await pb.collection('settings').create({ legacyId: 'active_shift', ...activeShift, data: activeShift });
      ok('active_shift imported');
    } catch (e) {
      if (e.status === 400) {
        const existing = await pb.collection('settings').getList(1, 1, { filter: 'legacyId = "active_shift"' });
        if (existing.items.length > 0) {
          await pb.collection('settings').update(existing.items[0].id, { ...activeShift, data: activeShift });
          ok('active_shift updated');
        }
      } else {
        throw e;
      }
    }
  }
  
  // database_init
  try {
    await pb.collection('settings').create({
      legacyId: 'database_init',
      isSeeded: true,
      seededAt: new Date().toISOString(),
      data: { isSeeded: true, seededAt: new Date().toISOString() }
    });
    ok('database_init created');
  } catch (e) {
    if (e.status === 400) {
      ok('database_init already exists');
    } else {
      throw e;
    }
  }

  // 4. Verifikasi
  log('\n=== [4/5] Verifikasi import ===');
  for (const [backupKey, pbCol] of Object.entries(COLLECTION_MAP)) {
    const count = (await pb.collection(pbCol).getList(1, 1)).totalItems;
    log(`  ${pbCol}: ${count} records`);
  }
  const settingsCount = (await pb.collection('settings').getList(1, 10)).totalItems;
  log(`  settings: ${settingsCount} records`);

  // 5. Ringkasan
  console.log('\n==================================================================');
  console.log('  IMPORT SELESAI');
  console.log('==================================================================');
  log('Data original berhasil diimport ke PocketBase');
  log('Cek di Admin UI: http://localhost:8090/_/');
  console.log('==================================================================');
}

main().catch((e) => {
  console.error('\n  [FATAL]', e);
  process.exit(1);
});