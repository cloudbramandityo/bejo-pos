/**
 * Uji regresi identitas toko penerbit invoice.
 * Jalankan: npm run check:invoice-identity
 *
 * Kasus lahir dari gejala nyata: operator mengetik nomor rekening baru atau menghapus
 * baris rekening di menu Invoice → beberapa detik kemudian layar kembali menampilkan
 * identitas lama dan perubahan terasa tidak tersimpan.
 *
 * Sebab yang diukur:
 *  - polling /api/invoices/store-identity tiap 5 detik selalu menghasilkan objek baru,
 *    lalu efek `setIdentityForm(storeIdentity)` menimpa isian yang belum disimpan;
 *  - hasil tulis ke cloud dan ke server tidak pernah diperiksa (catch dibuang / console.warn),
 *    sehingga nilai lama dijemput kembali dan terlihat seperti "tidak tersimpan";
 *  - satu pengaturan disimpan tiga tempat tanpa aturan nilai mana yang lebih baru.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  applyStoreProfileToIdentity,
  identityContentKey,
  identityEquals,
  identityStamp,
  incomingIdentityWins,
  stampIdentityForSave
} from '../src/utils/invoiceStoreIdentityRules';
import type { InvoiceStoreIdentity } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, '..', rel), 'utf8');

let passed = 0;
const check = (label: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`   ok  ${label}`);
};

const BASE: InvoiceStoreIdentity = {
  storeName: 'BEJO Digital Print',
  tagline: 'Stiker Vinyl & Digital Printing',
  address: 'Jl. Raya Diwek No 1',
  phone: '0819-1834-4716',
  email: 'bejodigitalmedia@gmail.com',
  npwp: '08.123.456.7-654.000',
  logoUrl: 'data:image/jpeg;base64,AAA',
  bankAccounts: [
    { id: 'bank-bca', bankName: 'BCA', accountNumber: '123-456-7890', accountHolder: 'BEJO', branch: 'Diwek', isDefault: true },
    { id: 'bank-mandiri', bankName: 'Mandiri', accountNumber: '987-654-3210', accountHolder: 'BEJO', branch: 'Jombang', isDefault: false }
  ],
  invoicePrefix: 'INV/BJP',
  proformaPrefix: 'PI/BJP',
  creditNotePrefix: 'CN/BJP',
  defaultTerms: 'Pelunasan sebelum barang dikirim',
  authorizedSignerName: 'Ahmad Irdianto',
  authorizedSignerRole: 'Pimpinan Toko'
};

const withBank = (accountNumber: string): InvoiceStoreIdentity => ({
  ...BASE,
  bankAccounts: BASE.bankAccounts.map((b) => (b.id === 'bank-bca' ? { ...b, accountNumber } : b))
});

/* ========================================================================= */
/* A. Kesamaan isi: dasar keputusan "boleh menimpa isian atau tidak"          */
/* ========================================================================= */

check('isi sama dianggap sama walau urutan kunci dan waktu simpan berbeda', () => {
  const a = { ...BASE, updatedAt: 1000 };
  const reordered: Record<string, any> = {};
  Object.keys(BASE)
    .reverse()
    .forEach((key) => {
      reordered[key] = (BASE as Record<string, any>)[key];
    });
  assert.equal(identityEquals(a, reordered as InvoiceStoreIdentity), true);
  assert.equal(identityContentKey(a), identityContentKey({ ...a, updatedAt: 999999 }));
});

check('nomor rekening yang baru diketik terbaca sebagai perubahan', () => {
  assert.equal(identityEquals(BASE, withBank('555-111-222')), false);
});

check('hapus satu baris rekening terbaca sebagai perubahan', () => {
  const deleted: InvoiceStoreIdentity = { ...BASE, bankAccounts: BASE.bankAccounts.filter((b) => b.id !== 'bank-mandiri') };
  assert.equal(identityEquals(BASE, deleted), false);
});

check('urutan baris rekening ikut dinilai (susunan yang tampil di dokumen)', () => {
  const swapped: InvoiceStoreIdentity = { ...BASE, bankAccounts: [...BASE.bankAccounts].reverse() };
  assert.equal(identityEquals(BASE, swapped), false);
});

check('nilai kosong dan null tidak dianggap sama', () => {
  assert.equal(identityEquals({ ...BASE, npwp: '' }, { ...BASE, npwp: null as any }), false);
});

/* ========================================================================= */
/* B. Arbitrase waktu: snapshot dari luar vs isian perangkat ini             */
/* ========================================================================= */

check('snapshot identik dari server tidak menimpa apa pun', () => {
  assert.equal(incomingIdentityWins(BASE, { ...BASE, updatedAt: Date.now() }), false);
});

check('snapshot lebih baru dipakai', () => {
  const mine = { ...BASE, updatedAt: 1000 };
  const theirs = { ...withBank('555-111-222'), updatedAt: 2000 };
  assert.equal(incomingIdentityWins(mine, theirs), true);
});

check('snapshot lebih tua tidak dipakai (ini penyebab nilai kembali ke lama)', () => {
  const mine = { ...withBank('555-111-222'), updatedAt: 2000 };
  const stale = { ...BASE, updatedAt: 1000 };
  assert.equal(incomingIdentityWins(mine, stale), false);
});

check('isian berstempel tidak pernah dikalahkan salinan tanpa stempel', () => {
  const mine = { ...withBank('555-111-222'), updatedAt: 2000 };
  assert.equal(incomingIdentityWins(mine, { ...BASE }), false);
});

check('salinan pertama tanpa stempel di kedua sisi: server yang menang', () => {
  assert.equal(incomingIdentityWins(BASE, withBank('555-111-222')), true);
});

check('nilai kosong atau tanpa nama toko tidak pernah dipakai', () => {
  assert.equal(incomingIdentityWins(BASE, null), false);
  assert.equal(incomingIdentityWins(BASE, { ...BASE, storeName: '' }), false);
});

check('stempel dibaca 0 bila tidak ada atau tidak wajar', () => {
  assert.equal(identityStamp(BASE), 0);
  assert.equal(identityStamp({ ...BASE, updatedAt: 'bukan angka' as any }), 0);
  assert.equal(identityStamp({ ...BASE, updatedAt: 123 }), 123);
});

check('simpan menandai waktu tanpa mengubah isi', () => {
  const saved = stampIdentityForSave(BASE, 4321);
  assert.equal(saved.updatedAt, 4321);
  assert.equal(identityEquals(saved, BASE), true);
  assert.equal(identityStamp(saved), 4321);
});

/* ========================================================================= */
/* C. Salinan identitas tetap utuh di kanal cloud                             */
/* ========================================================================= */

check('kanal cloud identitas memakai legacyId + salinan JSON (butuh skema invoice_settings)', () => {
  const backend = read('src/backend/pocketbaseBackend.ts');
  assert.match(backend, /subscribeRecord\(\s*'invoice_settings',\s*'store_identity'/);
  assert.match(backend, /upsertRecord\(\s*'invoice_settings',\s*'store_identity'/);
  const schema = read('scripts/create-pocketbase-collections.mjs');
  // executeUpsert menulis payload.legacyId + payload.data; tanpa dua field ini
  // fetchOneRecord tidak pernah menemukan record-nya dan isian hilang diam-diam.
  assert.match(schema, /\[\.\.\.\(def\.fields \|\| \[\]\), T\('legacyId', false, 128\), J\('data', false, 5000000\)\]/);
  assert.match(schema, /const wantedFields = \[\.\.\.\(def\.fields \|\| \[\]\), T\('legacyId', false, 128\), J\('data', false, 5000000\)\]/);
});

check('modul aturan identitas tetap murni supaya dapat diuji di Node', () => {
  const src = read('src/utils/invoiceStoreIdentityRules.ts');
  assert.doesNotMatch(src, /from '\.\.\/backend\//);
  assert.doesNotMatch(src, /localStorage|window\./);
});

/* ========================================================================= */
/* D. Layar: isian yang belum disimpan tidak boleh ditimpa                   */
/* ========================================================================= */

check('tidak ada lagi efek yang menimpa isian setiap kali nilai diperbarui', () => {
  const screen = read('src/components/InvoiceScreen.tsx');
  assert.doesNotMatch(screen, /useEffect\(\(\) => \{\s*setIdentityForm\(storeIdentity\)/);
  // Buang isian hanya boleh terjadi satu kali: tombol Batal (sadar), bukan efek otomatis.
  const discards = screen.match(/setIdentityForm\(storeIdentity\)/g) || [];
  assert.equal(discards.length, 1, `pembuangan isian ada ${discards.length}x, seharusnya hanya di tombol Batal`);
});

check('polling, kanal cloud, dan tab lain masuk lewat satu penilai', () => {
  const screen = read('src/components/InvoiceScreen.tsx');
  assert.match(screen, /const applyExternalIdentity = /);
  assert.match(screen, /const result = await readInvoiceIdentityFromServer\(\);\s*if \(result\.ok\) applyExternalIdentity\(result\.identity\)/);
  assert.match(screen, /subscribeInvoiceStoreIdentity\(\(cloudIdentity\) => \{\s*applyExternalIdentity\(cloudIdentity\);/);
  assert.match(screen, /applyExternalIdentity\(e\?\.detail \?\? null\)/);
  // Callback luar tidak boleh menulis state identitas sendiri; hanya penilai dan
  // jalur simpan yang boleh, dengan nilai yang baru saja dipakai layar ini.
  const writes = screen
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('setStoreIdentity(') && !line.includes('useState<InvoiceStoreIdentity>'));
  assert.equal(writes.length, 3, `tulisan state identitas ada ${writes.length}x: ${writes.join(' | ')}`);
  writes.forEach((line) => assert.match(line, /^setStoreIdentity\((next|draft|outcome\.identity)\);$/));
});

check('penilai menghormati isian yang belum disimpan', () => {
  const screen = read('src/components/InvoiceScreen.tsx');
  assert.match(screen, /if \(hasUnsavedIdentityEdits\(\)\)/);
  assert.match(screen, /!identityEquals\(identityFormRef\.current, storeIdentityRef\.current\)/);
});

check('hasil simpan dibaca, bukan dibuang ke console', () => {
  const screen = read('src/components/InvoiceScreen.tsx');
  assert.match(screen, /const outcome = await saveInvoiceIdentity\(draft\)/);
  assert.match(screen, /if \(!outcome\.sharedSaved\)/);
  assert.doesNotMatch(screen, /saveInvoiceStoreIdentityCloud\([^)]*\)\.catch\(console/);
  assert.doesNotMatch(screen, /saveStoredInvoiceStoreIdentity\(/);
});

check('layar menunjukkan isian belum disimpan dan mengunci tombol saat mengirim', () => {
  const screen = read('src/components/InvoiceScreen.tsx');
  assert.match(screen, /Isian ini belum disimpan\./);
  assert.match(screen, /disabled=\{savingIdentity\}/);
});

check('baris rekening boleh dihapus sampai daftar kosong', () => {
  const screen = read('src/components/InvoiceScreen.tsx');
  assert.match(screen, /identityForm\.bankAccounts\.length > 0 && \(\s*<button[\s\S]{0,200}handleRemoveBankAccount/);
  assert.doesNotMatch(screen, /identityForm\.bankAccounts\.length > 1 && \(/);
});

check('kaki cetak tidak mengarang alamat situs bila kolomnya kosong', () => {
  const screen = read('src/components/InvoiceScreen.tsx');
  assert.doesNotMatch(screen, /storeIdentity\.website \|\| 'www\./);
});

/* ========================================================================= */
/* E. Jalur tulis satu-satunya                                               */
/* ========================================================================= */

const SYNC = 'src/utils/invoiceStoreIdentitySync.ts';

check('satu modul yang menyimpan identitas ke semua tempat', () => {
  const sync = read(SYNC);
  assert.match(sync, /export async function saveInvoiceIdentity/);
  assert.match(sync, /saveStoredInvoiceStoreIdentity\(stamped\)/);
  assert.match(sync, /await saveInvoiceStoreIdentityCloud\(stamped\)/);
  assert.match(sync, /method: 'POST'/);
  // Status jawaban wajib diperiksa; kegagalan tidak boleh berubah menjadi pesan sukses.
  assert.match(sync, /serverSaved = res\.ok/);
  assert.doesNotMatch(sync, /\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(sync, /catch \{\s*\/\* (Offline|Graceful)/);
});

check('endpoint identitas hanya dikenal satu modul', () => {
  const files = ['src/components/InvoiceScreen.tsx', 'src/App.tsx'];
  for (const rel of files) {
    assert.doesNotMatch(read(rel), /\/api\/invoices\/store-identity/, `${rel} menulis endpoint sendiri`);
  }
  assert.match(read(SYNC), /const SERVER_ENDPOINT = '\/api\/invoices\/store-identity'/);
});

check('App memakai aturan dan jalur yang sama', () => {
  const app = read('src/App.tsx');
  assert.match(app, /applyStoreProfileToIdentity\(current, store\)/);
  assert.match(app, /void saveInvoiceIdentity\(merged\)/);
  assert.doesNotMatch(app, /saveInvoiceStoreIdentityCloud/);
  assert.doesNotMatch(app, /saveStoredInvoiceStoreIdentity/);
});

check('kanal identitas dipasang di App dan dibersihkan bersama', () => {
  const app = read('src/App.tsx');
  assert.match(app, /subscribeInvoiceStoreIdentity\(\(cloudIdentity\) =>/);
  assert.match(app, /unsubInvoiceIdentity\(\);/);
  assert.match(app, /incomingIdentityWins\(getStoredInvoiceStoreIdentity\(\), cloudIdentity\)/);
  assert.match(app, /rememberInvoiceIdentityLocally\(cloudIdentity\)/);
});

check('nilai dari server hanya menjadi cermin, tidak ditulis balik', () => {
  const sync = read(SYNC);
  const start = sync.indexOf('export function rememberInvoiceIdentityLocally');
  assert.ok(start >= 0, 'fungsi cermin perangkat tidak ada');
  const body = sync.slice(start, sync.indexOf('\n}', start));
  assert.match(body, /saveStoredInvoiceStoreIdentity\(identity\)/);
  assert.doesNotMatch(body, /fetch\(|saveInvoiceStoreIdentityCloud|POST/);
});

console.log(`\n${passed} kasus identitas toko penerbit invoice lolos.`);
