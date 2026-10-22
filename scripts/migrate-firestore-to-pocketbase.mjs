/**
 * =====================================================================
 *  BEJO STIKER POS - Migrasi Data: Firestore -> PocketBase
 * =====================================================================
 *  Menjalankan di PC (Node 18+):
 *
 *      # 1. Login ke Firebase (service account)
 *      set GOOGLE_APPLICATION_CREDENTIALS=D:\DOCUMENTS\Default Project\service-account-key.json
 *
 *      # 2. Login ke PocketBase
 *      set POCKETBASE_URL=http://localhost:8090
 *      set PB_ADMIN_EMAIL=admin@bejodigitalprint.com
 *      set PB_ADMIN_PASSWORD=password-anda
 *
 *      # 3. Jalankan
 *      node scripts\migrate-firestore-to-pocketbase.mjs
 *
 *  Opsi:
 *      --dry-run              hanya uji koneksi + hitung data, tidak menulis
 *      --collections=a,b      migrasi koleksi tertentu saja
 *      --truncate             kosongkan koleksi PocketBase tujuan lebih dulu
 * =====================================================================
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import PocketBase from 'pocketbase';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TRUNCATE = args.includes('--truncate');
const onlyArg = args.find((a) => a.startsWith('--collections='));
const ONLY = onlyArg ? onlyArg.split('=')[1].split(',').map((s) => s.trim()) : null;

// ---------------------------------------------------------------- CONFIG
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'noted-segment-9xjsq';
const KEY_FILE =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(process.cwd(), 'service-account-key.json');
const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
const PB_EMAIL = process.env.PB_ADMIN_EMAIL || '';
const PB_PASSWORD = process.env.POCKETBASE_PASSWORD || '';

/** Koleksi Firestore -> Koleksi PocketBase (1:1) */
const COLLECTION_MAP = {
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
};

/** Sub-dokumen Firestore (collection `settings`) -> record PocketBase di collection `settings` */
const SETTINGS_DOCS = ['store_info', 'active_profile', 'active_shift', 'database_init'];

// ---------------------------------------------------------------- HELPERS
const log = (m) => console.log(m);
const ok = (m) => console.log(`   [OK] ${m}`);
const warn = (m) => console.log(`   [!]  ${m}`);
const fail = (m) => {
  console.error(`   [FAIL] ${m}`);
  process.exit(1);
};

function convertValue(value) {
  if (value === null || value === undefined) return value;

  // Firestore Timestamp -> ISO string
  if (typeof value.toDate === 'function' && value.constructor?.name === 'Timestamp') {
    return value.toDate().toISOString();
  }
  // Firestore DocumentReference -> id string
  if (value.constructor?.name === 'DocumentReference') return value.id;
  if (value.constructor?.name === 'DocumentSnapshot') return value.id;
  // GeoPoint
  if (value.constructor?.name === 'GeoPoint') {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  // Array
  if (Array.isArray(value)) return value.map(convertValue);
  // Object
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = convertValue(v);
    }
    return out;
  }
  return value;
}

function stripInternal(data) {
  const out = { ...data };
  delete out.collectionId;
  delete out.collectionName;
  delete out.expand;
  delete out.password;
  delete out.tokenKey;
  return out;
}

// ---------------------------------------------------------------- MAIN
async function main() {
  console.log('==================================================================');
  console.log(' BEJO STIKER POS - MIGRASI DATA FIRESTORE -> POCKETBASE');
  console.log('==================================================================');
  if (DRY_RUN) console.log('   MODE: DRY RUN (tidak ada data yang ditulis)');

  // --- Koneksi Firestore ---
  console.log('\n==> [1/4] Koneksi Firestore');
  if (!fs.existsSync(KEY_FILE)) {
    fail(
      `Service account key tidak ditemukan: ${KEY_FILE}\n` +
        '   Download dari Firebase Console > Project Settings > Service Accounts > Generate New Private Key'
    );
  }
  initializeApp({ credential: cert(KEY_FILE), projectId: PROJECT_ID });
  const db = getFirestore();
  ok(`Firestore terhubung (project: ${PROJECT_ID})`);

  // --- Koneksi PocketBase ---
  console.log('\n==> [2/4] Koneksi PocketBase');
  const pb = new PocketBase(PB_URL);
  if (!PB_EMAIL || !PB_PASSWORD) {
    fail(
      'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD belum di-set.\n' +
        '   Contoh: $env:PB_ADMIN_EMAIL="admin@bejodigitalprint.com"; $env:PB_ADMIN_PASSWORD="..."'
    );
  }
  try {
    await pb.admins.authWithPassword(PB_EMAIL, PB_PASSWORD);
  } catch (e) {
    fail(`Login admin PocketBase gagal: ${e.message}`);
  }
  ok(`PocketBase terhubung (${PB_URL})`);

  // --- Daftar koleksi ---
  console.log('\n==> [3/4] Mengambil data dari Firestore');
  const collections = await db.listCollections();
  const available = collections.map((c) => c.id);
  const targets = (ONLY || Object.keys(COLLECTION_MAP)).filter(
    (c) => available.includes(c) && (!ONLY || ONLY.includes(c))
  );

  if (targets.length === 0) {
    warn('Tidak ada koleksi yang cocok untuk dimigrasi.');
  }
  ok(`${targets.length} koleksi ditemukan: ${targets.join(', ')}`);

  // --- Migrasi ---
  console.log('\n==> [4/4] Migrasi data');
  let totalDocs = 0;
  let totalOk = 0;
  let totalFail = 0;
  const failures = [];

  for (const fsCol of targets) {
    const pbCol = COLLECTION_MAP[fsCol] || fsCol;
    process.stdout.write(`   ${fsCol} -> ${pbCol} ... `);

    try {
      const snapshot = await db.collection(fsCol).get();
      const docs = snapshot.docs;

      if (DRY_RUN) {
        console.log(`${docs.length} dokumen (dry-run, dilewati)`);
        totalDocs += docs.length;
        continue;
      }

      if (TRUNCATE) {
        try {
          const existing = await pb.collection(pbCol).getFullList(500);
          for (const rec of existing) {
            await pb.collection(pbCol).delete(rec.id);
          }
        } catch {
          /* koleksi belum ada */
        }
      }

      let okCount = 0;
      let failCount = 0;

      for (const doc of docs) {
        try {
          const payload = stripInternal(convertValue(doc.data()));
          const id = doc.id.replace(/\//g, '_');
          try {
            await pb.collection(pbCol).update(id, payload);
          } catch (e) {
            if (e.status === 404) {
              await pb.collection(pbCol).create({ ...payload, id });
            } else {
              throw e;
            }
          }
          okCount++;
        } catch (e) {
          failCount++;
          failures.push(`${fsCol}/${doc.id}: ${e.message}`);
        }
      }

      console.log(`${okCount} berhasil, ${failCount} gagal`);
      totalDocs += docs.length;
      totalOk += okCount;
      totalFail += failCount;
    } catch (e) {
      console.log(`GAGAL: ${e.message}`);
      failures.push(`${fsCol}: ${e.message}`);
      totalFail++;
    }
  }

  // --- Sub-dokumen settings ---
  if (!DRY_RUN && (!ONLY || ONLY.includes('settings'))) {
    process.stdout.write('   settings (sub-dokumen) -> settings ... ');
    let okCount = 0;
    try {
      for (const docId of SETTINGS_DOCS) {
        const snap = await db.collection('settings').doc(docId).get();
        if (!snap.exists) continue;
        const payload = stripInternal(convertValue(snap.data()));
        try {
          await pb.collection('settings').update(docId, payload);
        } catch (e) {
          if (e.status === 404) {
            await pb.collection('settings').create({ ...payload, id: docId });
          } else {
            throw e;
          }
        }
        okCount++;
      }
      console.log(`${okCount} dokumen`);
      totalOk += okCount;
    } catch (e) {
      console.log(`GAGAL: ${e.message}`);
      failures.push(`settings: ${e.message}`);
    }
  }

  // --- Ringkasan ---
  console.log('\n==================================================================');
  console.log(' RINGKASAN MIGRASI');
  console.log('==================================================================');
  console.log(`   Dokumen diproses : ${totalDocs}`);
  console.log(`   Berhasil         : ${totalOk}`);
  console.log(`   Gagal            : ${totalFail}`);
  if (failures.length) {
    console.log('\n   Detail kegagalan (10 pertama):');
    failures.slice(0, 10).forEach((f) => console.log(`     - ${f}`));
  }
  console.log('\n   Verifikasi: buka Admin UI PocketBase -> cek isi tiap koleksi.');
  console.log('==================================================================');
}

main().catch((e) => {
  console.error('\n   [FATAL]', e);
  process.exit(1);
});
