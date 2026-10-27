/**
 * =====================================================================
 *  BEJO Digital Print - Membuat Koleksi PocketBase + Skema
 * =====================================================================
 *  Menjalankan di PC (Node 18+):
 *
 *      set POCKETBASE_URL=http://localhost:8090
 *      set PB_ADMIN_EMAIL=admin@bejodigitalprint.com
 *      set PB_ADMIN_PASSWORD=password-anda
 *      node scripts\create-pocketbase-collections.mjs
 *
 *  Opsi:
 *      --drop     hapus koleksi lama lebih dulu (PENTING untuk data lama)
 *      --harden   perbarui aturan akses koleksi yang SUDAH ADA menjadi
 *                 wajib login (menutup akses publik tanpa menghapus data)
 * =====================================================================
 */
import PocketBase from 'pocketbase';

const args = process.argv.slice(2);
const DROP = args.includes('--drop');
const HARDEN = args.includes('--harden');

const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
const PB_EMAIL = process.env.PB_ADMIN_EMAIL || '';
const PB_PASSWORD = process.env.PB_ADMIN_PASSWORD || '';

const log = (m) => console.log(m);
const ok = (m) => console.log(`   [OK] ${m}`);
const fail = (m) => {
  console.error(`   [FAIL] ${m}`);
  process.exit(1);
};

// PocketBase v0.28: definisi field memakai format flat (bukan options{})
// CATATAN: `pattern` harus DILEWATI bila kosong (string kosong ditolak server)
const T = (name, required = false, max = 2000) => ({
  name,
  type: 'text',
  required,
  min: 0,
  max,
});
const N = (name, required = false) => ({
  name,
  type: 'number',
  required,
  onlyInt: false,
  min: null,
  max: null,
});
const B = (name, required = false) => ({
  name,
  type: 'bool',
  required,
});
const D = (name, required = false) => ({
  name,
  type: 'date',
  required,
});
const J = (name, required = false, max = 200000) => ({
  name,
  type: 'json',
  required,
  maxSize: max,
});
const SEL = (name, values, required = false) => ({
  name,
  type: 'select',
  required,
  maxSelect: 1,
  values,
});

/** Definisi semua koleksi aplikasi */
const COLLECTIONS = [
  {
    name: 'users',
    type: 'auth',
    fields: [
      T('name', true),
      T('username'),
      T('role'),
      T('phone'),
      B('isActive'),
      B('isOnline'),
      N('lastActiveAt'),
      N('lastLoginAt'),
      T('createdAt'),
      T('spkRoleCategory'),
      T('appPassword', false, 128),
    ],
  },
  {
    name: 'products',
    type: 'base',
    fields: [
      T('code'),
      T('name', true),
      T('category'),
      T('imageUrl'),
      N('hargaKulak'),
      N('hargaAgen'),
      N('hargaGrosir'),
      N('hargaUmum'),
      N('hargaMeterGrosir'),
      N('hargaMeterUmum'),
      N('hargaPaketGrosir'),
      N('hargaPaketUmum'),
      N('hargaEceranGrosir'),
      N('hargaEceranUmum'),
      N('minStock'),
      T('perRollPak'),
      N('perRollPakValue'),
      T('satuan'),
      N('stock'),
      T('description'),
      T('notes'),
      B('isAssetToko'),
      T('createdAt'),
      J('extra'),
    ],
  },
  {
    name: 'product_categories',
    type: 'base',
    fields: [T('name', true), T('color'), B('isDefault')],
  },
  {
    name: 'customer_categories',
    type: 'base',
    fields: [T('name', true), N('discountPercent'), T('color'), N('minSpend')],
  },
  {
    name: 'customers',
    type: 'base',
    fields: [
      T('phone', true),
      T('name', true),
      T('categoryId'),
      T('createdAt'),
      N('totalSpent'),
      N('transactionCount'),
      N('creditLimit'),
      N('totalDebt'),
      T('notes'),
      T('address'),
    ],
  },
  {
    name: 'transactions',
    type: 'base',
    fields: [
      T('invoiceNumber'),
      T('customerId'),
      T('customerName'),
      T('customerPhone'),
      T('categoryId'),
      T('cashier'),
      N('total'),
      N('subtotal'),
      N('discount'),
      N('tax'),
      N('paid'),
      N('change'),
      T('paymentMethod'),
      J('paymentMethods'),
      J('items'),
      N('timestamp'),
      T('date'),
      T('time'),
      T('shiftId'),
      T('notes'),
      T('createdAt'),
    ],
  },
  {
    name: 'stock_transactions',
    type: 'base',
    fields: [
      T('transactionNumber'),
      SEL('type', ['PEMBELIAN', 'PENGAMBILAN']),
      T('date'),
      T('time'),
      N('timestamp'),
      T('supplierName'),
      J('items'),
      N('totalQty'),
      N('totalAmount'),
      N('shippingCost'),
      T('notes'),
      B('isBackdated'),
      T('productId'),
      T('productName'),
      N('qty'),
      N('price'),
      N('totalPrice'),
    ],
  },
  {
    name: 'shifts',
    type: 'base',
    fields: [
      T('cashierName'),
      T('shiftName'),
      T('storeName'),
      T('startTime'),
      T('endTime'),
      N('startingCash'),
      N('initialCash'),
      SEL('status', ['OPEN', 'CLOSED']),
      T('date'),
      T('closedAt'),
      B('isActive'),
      N('totalCashSales'),
      N('totalTransferSales'),
      N('totalQrisSales'),
      N('transactionCount'),
      N('operationalExpenses'),
      T('operationalNotes'),
      N('actualEndingCash'),
      N('actualCashInDrawer'),
      N('cashDifference'),
      T('notes'),
    ],
  },
  {
    name: 'cashiers',
    type: 'base',
    fields: [
      T('name', true),
      T('shiftName'),
      T('phone'),
      T('role'),
      B('isActive'),
      T('notes'),
    ],
  },
  {
    name: 'agents',
    type: 'base',
    fields: [
      T('name', true),
      T('contactPerson'),
      T('phone'),
      T('address'),
      T('commissionRate'),
      T('notes'),
      T('createdAt'),
    ],
  },
  {
    name: 'suppliers',
    type: 'base',
    fields: [
      T('name', true),
      T('contactPerson'),
      T('phone'),
      T('address'),
      T('category'),
      T('notes'),
      T('createdAt'),
    ],
  },
  {
    name: 'store_profiles',
    type: 'base',
    fields: [
      T('storeName', true),
      T('branch'),
      T('phone'),
      T('address'),
      T('receiptFooter'),
      T('logoUrl'),
      B('isMaster'),
      B('canModifyMasterProducts'),
      T('storeStatus'),
      T('notes'),
      T('createdAt'),
    ],
  },
  {
    name: 'custom_roles',
    type: 'base',
    fields: [T('name', true), T('description'), T('createdAt')],
  },
  {
    name: 'agent_notifications',
    type: 'base',
    fields: [
      T('title'),
      T('message'),
      T('type'),
      T('agentName'),
      T('agentId'),
      N('timestamp'),
      J('readBy'),
      J('data'),
    ],
  },
  {
    name: 'activity_logs',
    type: 'base',
    fields: [
      T('userId'),
      T('username'),
      T('name'),
      T('role'),
      T('actionType'),
      T('actionTitle'),
      T('details'),
      N('timestamp'),
    ],
  },
  {
    name: 'spk_orders',
    type: 'base',
    fields: [
      T('orderNumber', true),
      T('date'),
      T('time'),
      N('timestamp'),
      T('deadlineDate'),
      T('deadlineTime'),
      T('priority'),
      T('status'),
      T('customerId'),
      T('customerName'),
      T('customerPhone'),
      T('customerCategory'),
      J('items'),
      N('totalQty'),
      N('totalAreaM2'),
      N('subtotal'),
      N('discount'),
      N('totalAmount'),
      J('printFile'),
      J('printFiles'),
      T('printFileShortcut'),
      N('dpPaid'),
      N('remainingAmount'),
      B('isPaid'),
      T('paymentMethod'),
      T('designerName'),
      T('operatorName'),
      T('finishingPerson'),
      T('assignedMachine'),
      J('assignedMachines'),
      T('customerNotes'),
      T('internalNotes'),
      J('statusLogs'),
    ],
  },
  {
    name: 'machines',
    type: 'base',
    fields: [
      T('name', true),
      T('category'),
      T('typeDescription'),
      SEL('status', ['READY', 'UNDER_MAINTENANCE']),
      T('speed'),
      T('headSpec'),
      N('maxWidthMeters'),
      T('operatorDefault'),
      T('notes'),
      T('createdAt'),
      T('ipAddress'),
      N('port'),
      T('hostName'),
      T('sharedFolderLanPath'),
      T('lanStatus'),
      N('lastPingTime'),
      N('pingLatencyMs'),
      T('ripSoftware'),
      B('isAutoDetected'),
    ],
  },
  {
    name: 'ai_chat_messages',
    type: 'base',
    fields: [
      T('userId'),
      T('username'),
      T('content'),
      T('role'),
      N('createdAt'),
      J('mentions'),
      J('attachments'),
    ],
  },
  {
    name: 'user_mentions',
    type: 'base',
    fields: [
      T('fromUser'),
      T('fromUsername'),
      T('targetUsername'),
      T('content'),
      N('timestamp'),
      B('isRead'),
    ],
  },
  {
    name: 'private_chat_messages',
    type: 'base',
    fields: [
      T('threadId'),
      T('senderUsername'),
      T('recipientUsername'),
      T('senderName'),
      T('content'),
      N('createdAt'),
      B('isRead'),
    ],
  },
  {
    name: 'printing_rejects',
    type: 'base',
    fields: [
      T('productId'),
      T('productName'),
      T('machine'),
      T('reason'),
      N('quantity'),
      T('notes'),
      T('rejectedBy'),
      N('timestamp'),
      J('photos'),
    ],
  },
  {
    name: 'invoices',
    type: 'base',
    fields: [
      T('documentType'),
      T('documentNumber'),
      T('status'),
      T('sourceProformaId'),
      T('sourceProformaNumber'),
      T('convertedInvoiceId'),
      T('convertedInvoiceNumber'),
      T('terminStageId'),
      T('terminStageName'),
      N('terminStageNumber'),
      N('terminPercentage'),
      N('contractTotalAmount'),
      T('referenceDescription'),
      J('childInvoiceIds'),
      J('childInvoiceNumbers'),
      T('projectTitle'),
      T('issueDate'),
      T('dueDate'),
      T('expiryDate'),
      J('customer'),
      J('items'),
      N('subtotal'),
      N('discountAmount'),
      N('taxableBase'),
      N('taxRate'),
      N('taxAmount'),
      N('grandTotal'),
      T('paymentScheme'),
      J('paymentSchedules'),
      N('dpRequiredPercent'),
      N('dpRequiredAmount'),
      N('amountPaid'),
      N('balanceDue'),
      J('payments'),
      J('cancellation'),
      T('paymentTerms'),
      T('notes'),
      J('bankAccounts'),
      T('issuedBy'),
      T('issuedByRole'),
      N('createdAt'),
      N('updatedAt'),
    ],
  },
  {
    name: 'invoice_settings',
    type: 'base',
    fields: [T('prefix'), N('nextNumber'), T('prefixFormat'), T('storeName'), T('storeAddress'), T('phone'), T('email'), T('npwp'), T('logoUrl')],
  },
  {
    name: 'settings',
    type: 'base',
    fields: [J('payload')],
  },  {
    name: 'taxpayer_profile',
    type: 'base',
    fields: [T('npwp'), T('name'), T('address'), T('phone'), T('email'), T('taxOfficer'), N('updatedAt'), J('extra')],
  },
  {
    name: 'tax_annual_returns',
    type: 'base',
    fields: [N('taxYear'), T('status'), N('totalTax'), J('data'), N('updatedAt')],
  },
  {
    name: 'tax_monthly_billings',
    type: 'base',
    fields: [J('billingsByYear'), N('updatedAt')],
  },
];

async function main() {
  console.log('==================================================================');
  console.log(' BEJO Digital Print - PEMBUATAN KOLEKSI POCKETBASE');
  console.log('==================================================================');

  const pb = new PocketBase(PB_URL);
  if (!PB_EMAIL || !PB_PASSWORD) {
    fail('PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD belum di-set.');
  }
  try {
    await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASSWORD);
  } catch (primaryError) {
    try {
      if (!pb.admins?.authWithPassword) throw primaryError;
      await pb.admins.authWithPassword(PB_EMAIL, PB_PASSWORD);
    } catch (e) {
      fail(`Login admin gagal: ${e.message}`);
    }
  }
  ok(`Terhubung ke ${PB_URL}`);

  if (DROP) {
    console.log('\n==> Menghapus koleksi lama');
    for (const def of COLLECTIONS) {
      try {
        await pb.collections.delete(def.name);
        console.log(`   - ${def.name}`);
      } catch {
        /* belum ada */
      }
    }
  }

  console.log('\n==> Membuat koleksi');
  let created = 0;
  let skipped = 0;

  // Aturan akses: tidak ada operasi publik. Koleksi auth (users) hanya boleh
  // dibaca/diubah oleh pemilik record; koleksi data wajib login.
  const rulesFor = (def) => {
    const isAuth = def.type === 'auth';
    const authRule = '@request.auth.id != ""';
    return {
      listRule: isAuth ? 'id = @request.auth.id' : authRule,
      viewRule: isAuth ? 'id = @request.auth.id' : authRule,
      // Pembuatan akun hanya lewat admin PocketBase (tidak ada signup publik).
      createRule: isAuth ? null : authRule,
      updateRule: isAuth ? 'id = @request.auth.id' : authRule,
      deleteRule: isAuth ? 'id = @request.auth.id' : authRule,
    };
  };

  for (const def of COLLECTIONS) {
    try {
      const existing = await pb.collections.getOne(def.name);
      if (HARDEN) {
        await pb.collections.update(existing.id, rulesFor(def));
        console.log(`   * ${def.name} (aturan akses diperketat)`);
      } else {
        console.log(`   = ${def.name} (sudah ada, dilewati — jalankan --harden untuk memperketat aturan)`);
      }
      skipped++;
      continue;
    } catch {
      /* belum ada -> buat */
    }

    const isAuth = def.type === 'auth';
    const body = {
      name: def.name,
      type: def.type || 'base',
      // Field id logis aplikasi (PocketBase memakai primary key sendiri)
      // + `data` = salinan utuh objek aplikasi (field baru tetap tersimpan)
      fields: [...(def.fields || []), T('legacyId', false, 128), J('data', false, 5000000)],
      // Tidak ada create/list publik: mencegah spam & pembacaan data tanpa login.
      ...rulesFor(def),
      options: {},
    };

    if (isAuth) {
      body.passwordAuth = { enabled: true, identityFields: ['email'] };
      body.authToken = { duration: 604800 };
      body.refreshToken = { enabled: true, duration: 2592000 };
    }

    try {
      await pb.collections.create(body);
      created++;
      console.log(`   + ${def.name} (${(def.fields || []).length} field)`);
    } catch (e) {
      const detail = e?.response?.data ? JSON.stringify(e.response.data) : e.message;
      fail(`Gagal membuat ${def.name}: ${detail}`);
    }
  }

  console.log('\n==================================================================');
  console.log(`   Dibuat : ${created}`);
  console.log(`   Sudah ada: ${skipped}`);
  console.log('==================================================================');
  console.log(' CATATAN: Aturan akses (API Rules) collection masih kosong.');
  console.log('   Buka Admin UI -> Settings -> API Rules, lalu isi:');
  console.log('     listRule/viewRule/createRule/updateRule/deleteRule = "@request.auth.id != \"\""');
  console.log('   (atau biarkan kosong bila Caddy + Basic Auth sudah melindungi)');
  console.log('==================================================================');
}

main().catch((e) => {
  console.error('\n   [FATAL]', e);
  process.exit(1);
});
