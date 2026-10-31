/**
 * Guard hak kelola data pada lima tab kerja (Agen, Laporan, Invoice, Pajak, Marketing).
 * Jalankan: npm run check:access
 *
 * Yang dijaga (permintaan pemilik 2026-10-31: akun ADMIN & OWNER boleh melihat dan
 * memakai seluruh isi lima tab itu):
 *   A     canManageRecords tetap DEVELOPER + ADMIN (SPK Cetak tidak ikut terbuka)
 *   B     canManageBusinessData = DEVELOPER + ADMIN + OWNER
 *   C     tiap layar memanggil aturan yang benar — tidak ada daftar role di komponen
 *   D     sub-tab "Laporan Agen" tidak lagi mengunci OWNER
 *   E     jejak perubahan pajak memakai akun yang login, bukan nama tetap
 *   F     tidak ada label "khusus DEVELOPER" yang menyesatkan di lima tab itu
 */
import { readFileSync } from 'node:fs';
import { canManageRecords, canManageBusinessData } from '../src/utils/recordAccess.ts';

let failures = 0;
function check(label: string, condition: boolean, extra = '') {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!condition) failures += 1;
}

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const spkSource = read('src/components/SpkScreen.tsx');
const invoiceSource = read('src/components/InvoiceScreen.tsx');
const reportSource = read('src/components/TransactionHistoryScreen.tsx');
const recapSource = read('src/components/reconciliation/ReconciliationScreen.tsx');
const agentSource = read('src/components/AgentScreen.tsx');
const appSource = read('src/App.tsx');
const wizardSource = read('src/components/tax/TaxFilingWizard.tsx');
const historySource = read('src/components/tax/TaxFilingHistoryView.tsx');
const taxScreenSource = read('src/components/tax/TaxScreen.tsx');
const corporateSource = read('src/components/tax/TaxCorporatePlaceholder.tsx');
const stockModalSource = read('src/components/modals/EditStockTransactionModal.tsx');
const serverSource = read('server.ts');

/* ---------------------------------------------------------------- */
/*  A. SPK Cetak tidak ikut melebar                                  */
/* ---------------------------------------------------------------- */
check('A1 DEVELOPER boleh mengelola data SPK', canManageRecords('DEVELOPER'));
check('A2 ADMIN boleh mengelola data SPK', canManageRecords('ADMIN'));
check('A3 OWNER tidak boleh mengelola data SPK', !canManageRecords('OWNER'));
check('A4 KASIR tidak boleh mengelola data SPK', !canManageRecords('KASIR'));

/* ---------------------------------------------------------------- */
/*  B. lima tab: DEVELOPER + ADMIN + OWNER                           */
/* ---------------------------------------------------------------- */
for (const role of ['DEVELOPER', 'ADMIN', 'OWNER']) {
  check(`B1 ${role} boleh memakai lima tab`, canManageBusinessData(role));
}
for (const role of ['KASIR', 'AGEN', '', undefined, null]) {
  check(`B2 ${JSON.stringify(role)} tidak boleh memakai lima tab`, !canManageBusinessData(role as string));
}
check('B3 huruf kecil dan spasi dinormalkan', canManageBusinessData('  owner '));
check('B4 canManageBusinessData lebih luas dari canManageRecords', canManageBusinessData('OWNER') && !canManageRecords('OWNER'));

/* ---------------------------------------------------------------- */
/*  C. layar memanggil aturan tunggal                                */
/* ---------------------------------------------------------------- */
check('C1 SpkScreen tetap pakai canManageRecords', /canManageRecords\(/.test(spkSource) && !/canManageBusinessData\(/.test(spkSource));
for (const [name, source] of [
  ['InvoiceScreen', invoiceSource],
  ['TransactionHistoryScreen', reportSource],
  ['ReconciliationScreen', recapSource],
] as const) {
  check(
    `C2 ${name} pakai canManageBusinessData`,
    /import \{ canManageBusinessData \} from '[^']*utils\/recordAccess'/.test(source) &&
      /canManageBusinessData\(/.test(source)
  );
  check(`C3 ${name} tidak menulis daftar role sendiri`, !/=== 'DEVELOPER' \|\| .*=== 'ADMIN' \|\|.*=== 'OWNER'/.test(source));
}

/* ---------------------------------------------------------------- */
/*  D. sub-tab Laporan Agen                                          */
/* ---------------------------------------------------------------- */
check(
  'D1 tab pengambilan_bahan dilepas lewat canManage',
  /reportTab === 'pengambilan_bahan' && !canManage/.test(reportSource)
);
check(
  'D2 tombol Laporan Agen tidak memakai gerbang role mentah',
  !/\(userRole === 'DEVELOPER' \|\| userRole === 'ADMIN'\) && \(\s*<button[^>]*id="tab-laporan-pengambilan"/.test(reportSource)
);
check('D3 AgentScreen memakai gerbang DEVELOPER/ADMIN/OWNER', /isDeveloperOrAdminOrOwner/.test(agentSource) && !/const isDeveloperOrAdmin =/.test(agentSource));
function tabGate(tab: string): string {
  const match = new RegExp(`currentTab === '${tab}' && \\(([^)]*)\\)`).exec(appSource);
  return match ? match[1] : '';
}
for (const tab of ['agen', 'transactions', 'invoices', 'tax', 'marketing']) {
  const gate = tabGate(tab);
  check(
    `D4 tab ${tab} dapat dibuka ADMIN & OWNER`,
    ['DEVELOPER', 'ADMIN', 'OWNER'].every((role) => gate.includes(`'${role}'`)),
    gate || 'gerbang tidak ditemukan'
  );
}

/* ---------------------------------------------------------------- */
/*  E. jejak perubahan pajak dari akun yang login                    */
/* ---------------------------------------------------------------- */
check('E1 TaxScreen mengirim akun login ke anak layar', /<TaxScreen currentUser=\{currentUser\} \/>/.test(appSource));
check('E2 TaxScreen menghitung penulis dari akun login', /describeAuditActor\(currentUser\)/.test(taxScreenSource) && /actorLabel=\{auditActor\}/.test(taxScreenSource));
check('E3 Wizard memakai actorLabel', /changedBy: actorLabel/.test(wizardSource));
check('E4 Riwayat memakai actorLabel', /changedBy: actorLabel/.test(historySource));
for (const [name, source] of [
  ['TaxFilingWizard', wizardSource],
  ['TaxFilingHistoryView', historySource],
  ['TaxScreen', taxScreenSource],
] as const) {
  check(`E5 ${name} tidak mengarang nama DEVELOPER`, !/Langgo Bramandityo \(DEVELOPER\)/.test(source));
}

/* ---------------------------------------------------------------- */
/*  F. label yang menyesatkan                                         */
/* ---------------------------------------------------------------- */
const MISLEADING = [/Khusus DEVELOPER/i, /KHUSUS DEVELOPER & ADMIN/, /DEVELOPER MODULE/, /Under Development/i];
for (const [name, source] of [
  ['InvoiceScreen', invoiceSource],
  ['TransactionHistoryScreen', reportSource],
  ['ReconciliationScreen', recapSource],
  ['TaxScreen', taxScreenSource],
  ['TaxCorporatePlaceholder', corporateSource],
  ['EditStockTransactionModal', stockModalSource],
] as const) {
  for (const pattern of MISLEADING) {
    check(`F1 ${name} bersih dari label "${pattern.source.slice(0, 22)}"`, !pattern.test(source));
  }
}
check(
  'F2 pesan tolak InvoiceScreen menyebut tiga peran',
  /DEVELOPER, ADMIN, atau OWNER/.test(invoiceSource)
);
check(
  'F3 label peran AI mengenal OWNER',
  /userRole === 'OWNER'\s*\n?\s*\?\s*'Pemilik Toko'|:\s*'Pemilik Toko'/.test(serverSource)
);

if (failures > 0) {
  console.log(`\n${failures} pemeriksaan GAGAL`);
  process.exit(1);
}
console.log('\nSemua pemeriksaan hak akses lima tab lulus.');
