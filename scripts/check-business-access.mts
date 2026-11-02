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
 *   G     akun SPK melihat Katalog (hanya melihat) + Laporan Penjualan penuh
 *         (permintaan pemilik 2026-11-02)
 *   H     berkas USER-ROLE.md = daftar tunggal wewenang: tiap barisnya dibandingkan
 *         dengan fungsi aslinya, gerbang tab Navbar, dan gerbang pasang layar di App
 */
import { readFileSync } from 'node:fs';
import * as recordAccess from '../src/utils/recordAccess.ts';
import * as journalPolicy from '../src/utils/journalAccessPolicy.ts';
import {
  canManageRecords,
  canManageBusinessData,
  canViewCatalog,
  canEditCatalog,
  canViewSalesReport,
  canViewAllReportMenus,
} from '../src/utils/recordAccess.ts';

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
const navbarSource = read('src/components/Navbar.tsx');
const catalogSource = read('src/components/InventoryScreen.tsx');
const laporanMenuSource = read('src/components/reports/LaporanScreen.tsx');

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
for (const tab of ['agen', 'invoices', 'tax', 'marketing']) {
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

/* ---------------------------------------------------------------- */
/*  G. akun SPK: Katalog (hanya melihat) + Laporan Penjualan penuh   */
/* ---------------------------------------------------------------- */
const CATALOG_VIEWERS = ['DEVELOPER', 'OWNER', 'ADMIN', 'SPK'];
const BUSINESS_EDITORS = ['DEVELOPER', 'ADMIN', 'OWNER'];
const OTHER_STAFF = ['KASIR', 'AGEN', '', undefined, null];

for (const role of CATALOG_VIEWERS) {
  check(`G1 ${role} boleh membuka tab Katalog`, canViewCatalog(role));
}
for (const role of OTHER_STAFF) {
  check(`G2 ${JSON.stringify(role)} tidak boleh membuka tab Katalog`, !canViewCatalog(role as string));
}
for (const role of BUSINESS_EDITORS) {
  check(`G3 ${role} boleh mengubah katalog`, canEditCatalog(role));
}
check('G4 SPK hanya melihat katalog', canViewCatalog('SPK') && !canEditCatalog('SPK'));
check('G5 huruf kecil dan spasi dinormalkan (katalog)', canViewCatalog('  spk ') && !canEditCatalog(' Spk '));
for (const role of CATALOG_VIEWERS) {
  check(`G6 ${role} boleh membuka tab Laporan`, canViewSalesReport(role));
}
for (const role of OTHER_STAFF) {
  check(`G7 ${JSON.stringify(role)} tidak boleh membuka tab Laporan`, !canViewSalesReport(role as string));
}
for (const role of BUSINESS_EDITORS) {
  check(`G8 ${role} melihat semua menu laporan`, canViewAllReportMenus(role));
}
check('G9 SPK hanya melihat menu Laporan Penjualan', canViewSalesReport('SPK') && !canViewAllReportMenus('SPK'));
check('G10 wewenang melihat laporan lebih luas dari wewenang mengubah data', canViewSalesReport('SPK') && !canManageBusinessData('SPK'));

check(
  'G11 Navbar memakai fungsi aturan untuk Katalog & Laporan',
  /import \{ canViewCatalog, canViewSalesReport \} from '\.\.\/utils\/recordAccess'/.test(navbarSource) &&
    /const canAccessCatalog = canViewCatalog\(role\)/.test(navbarSource) &&
    /const canAccessTransactions = canViewSalesReport\(role\)/.test(navbarSource)
);
check(
  'G12 Navbar tidak menulis daftar role mentah di Katalog & Laporan',
  !/const canAccessInventory = /.test(navbarSource) &&
    !/const canAccessTransactions = isDeveloper \|\| isOwner \|\| isAdmin/.test(navbarSource)
);
check(
  'G13 App memasang layar lewat fungsi aturan',
  /currentTab === 'inventory' && canViewCatalog\(userRole\)/.test(appSource) &&
    /currentTab === 'transactions' && canViewSalesReport\(userRole\)/.test(appSource)
);
check(
  'G14 App tidak memantul dari tab Katalog & Laporan untuk SPK',
  /\(currentTab === 'inventory' && canViewCatalog\(currentUser\.role\)\)/.test(appSource) &&
    /\(currentTab === 'transactions' && canViewSalesReport\(currentUser\.role\)\)/.test(appSource)
);

check(
  'G15 InventoryScreen memakai canEditCatalog',
  /import \{ canEditCatalog \} from '\.\.\/utils\/recordAccess'/.test(catalogSource) &&
    /const canEdit = canEditCatalog\(userRole\)/.test(catalogSource)
);
check(
  'G16 InventoryScreen mengunci tiga jalan masuk perubahan',
  (catalogSource.match(/if \(!canEdit\) return;/g) || []).length === 3 &&
    /const openAddModal = \(\) => \{\s*if \(!canEdit\) return;/.test(catalogSource) &&
    /const openEditModal = \(p: Product\) => \{\s*if \(!canEdit\) return;/.test(catalogSource) &&
    /const handleOpenCategoryModal = \(\) => \{\s*if \(!canEdit\) return;/.test(catalogSource)
);
check(
  'G17 InventoryScreen menyembunyikan tombol ubah untuk SPK',
  /\{canEdit \? \(/.test(catalogSource) && /\{canEdit && \(\s*<button[^>]*onClick=\{\(\) => openEditModal\(product\)\}/.test(catalogSource)
);
check('G18 SPK diberi tulisan "Hanya melihat"', /Hanya melihat — ubah harga atau kategori memakai akun yang berhak\./.test(catalogSource));

check(
  'G19 LaporanScreen memanggil canViewAllReportMenus',
  /import \{ canViewAllReportMenus \} from '[^']*utils\/recordAccess'/.test(laporanMenuSource) &&
    /const canSeeAllMenus = canViewAllReportMenus\(props\.userRole\)/.test(laporanMenuSource)
);
check(
  'G20 menu Laporan Keuangan & Rekonsiliasi hanya untuk yang berhak',
  /\.\.\.\(canSeeAllMenus\s*\? \[\s*\{\s*key: 'keuangan' as const/.test(laporanMenuSource) &&
    /key: 'rekonsiliasi' as const/.test(laporanMenuSource)
);
check(
  'G21 Laporan Penjualan selalu ada dan jadi bawaan',
  /\{ key: 'penjualan', label: 'Laporan Penjualan'/.test(laporanMenuSource) &&
    /useState<LaporanSubTab>\('penjualan'\)/.test(laporanMenuSource) &&
    /const visibleSubTab: LaporanSubTab = subTabs\.some\(\(st\) => st\.key === activeSubTab\)\s*\?\s*activeSubTab\s*:\s*'penjualan'/.test(laporanMenuSource)
);
check('G22 menu Jurnal tetap dari kebijakan Jurnal sendiri', /getJournalAccess\(props\.userRole\)/.test(laporanMenuSource) && !/canSeeAllMenus[\s\S]{0,40}key: 'jurnal'/.test(laporanMenuSource));

const periodRegionStart = reportSource.indexOf('Period Tabs: Harian, Mingguan, Bulanan, Semua');
const periodRegionEnd = reportSource.indexOf('{/* Quick Search */}');
const periodRegion = periodRegionStart >= 0 && periodRegionEnd > periodRegionStart
  ? reportSource.slice(periodRegionStart, periodRegionEnd)
  : '';
for (const mode of ['HARIAN', 'MINGGUAN', 'BULANAN', 'SEMUA']) {
  check(`G23 format laporan ${mode} tersedia tanpa gerbang role`, new RegExp(`setPeriodType\\('${mode}'\\)`).test(periodRegion));
}
check(
  'G24 tombol & pemilih periode tidak digerbang role mana pun',
  periodRegion.length > 0 && !/canManage|canView|userRole ===/.test(periodRegion)
);
check('G25 pemilih tanggal harian & mingguan ikut terbuka', (periodRegion.match(/type="date"/g) || []).length === 2);

/* ---------------------------------------------------------------- */
/*  H. USER-ROLE.md harus sama dengan kode yang berjalan             */
/* ---------------------------------------------------------------- */
const docSource = read('USER-ROLE.md');
const typesSource = read('src/types.ts');
const agentsSource = read('AGENTS.md');
const roleUnionText = /export type UserRole = ([^;]+);/.exec(typesSource)?.[1] ?? '';
const codeRoles = [...roleUnionText.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);

function docTable(marker: string): { header: string[]; rows: string[][] } {
  const begin = docSource.indexOf(`<!-- ${marker}-BEGIN -->`);
  const end = docSource.indexOf(`<!-- ${marker}-END -->`);
  if (begin < 0 || end < 0) return { header: [], rows: [] };
  const lines = docSource.slice(begin, end).split('\n').filter((line) => line.trim().startsWith('|'));
  const parsed = lines.map((line) =>
    line.trim().slice(1, -1).split('|').map((cell) => cell.trim())
  );
  const header = parsed.shift() ?? [];
  const rows = parsed.filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
  return { header, rows };
}

function roleColumns(header: string[]): Map<string, number> {
  const found = new Map<string, number>();
  header.forEach((cell, index) => {
    if (codeRoles.includes(cell.toUpperCase())) found.set(cell.toUpperCase(), index);
  });
  return found;
}

const ruleModules: Record<string, unknown> = { ...recordAccess, ...journalPolicy };

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function evaluate(expr: string, scope: Record<string, unknown>): unknown {
  const literals: string[] = [];
  const withoutText = expr.replace(/'[^']*'/g, (match) => {
    literals.push(match.slice(1, -1));
    return `\u0001${literals.length - 1}\u0001`;
  });
  if (!/^[\sA-Za-z0-9_$.\u0001|&!()=-]+$/.test(withoutText)) {
    throw new Error(`ekspresi tidak dikenal: ${expr}`);
  }
  const identifiers = [...withoutText.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)].map((m) => m[0]);
  const missing = identifiers.filter((id) => id !== 'true' && id !== 'false' && !(id in scope));
  if (missing.length > 0) throw new Error(`variabel belum terdaftar: ${missing.join(', ')}`);
  const body = withoutText
    .replace(/[A-Za-z_$][A-Za-z0-9_$]*/g, (id) => (id === 'true' || id === 'false' ? id : `s.${id}`))
    .replace(/\u0001(\d+)\u0001/g, (_m, index: string) => JSON.stringify(literals[Number(index)]));
  return new Function('s', `return (${body});`)(scope);
}

const flagDefs = [...navbarSource.matchAll(/const (is[A-Za-z]+) = role === '([A-Z_]+)'/g)]
  .map((m) => ({ flag: m[1], role: m[2] }));
const gateDefs = [...navbarSource.matchAll(/const (canAccess[A-Za-z]+) = ([^;\n]+);/g)]
  .map((m) => ({ name: m[1], expr: m[2] }));
const navCases = new Map(
  [...navbarSource.matchAll(/case '([a-z_]+)':\s*\n\s*return ([^;]+);/g)].map((m) => [m[1], m[2]])
);

function navbarAllows(tab: string, role: string): boolean {
  const expr = navCases.get(tab);
  if (!expr) throw new Error(`tab ${tab} tidak ada di allowed() Navbar`);
  const scope: Record<string, unknown> = { role, isStoreOnline: true, ...ruleModules };
  for (const def of flagDefs) scope[def.flag] = role === def.role;
  let resolved = false;
  for (let pass = 0; pass < 4 && !resolved; pass += 1) {
    resolved = true;
    for (const gate of gateDefs) {
      if (typeof scope[gate.name] === 'boolean') continue;
      try {
        const value = evaluate(gate.expr, scope);
        if (typeof value === 'boolean') scope[gate.name] = value;
        else resolved = false;
      } catch {
        resolved = false;
      }
    }
  }
  const value = evaluate(expr, scope);
  if (typeof value !== 'boolean') throw new Error(`gerbang ${tab} untuk ${role} tidak boolean`);
  return value;
}

function appGate(tab: string): string {
  const bodyAt = appSource.indexOf('Main Content Body');
  if (bodyAt < 0) return '';
  const line = new RegExp(`currentTab === '${tab}' && ([^\\n]*)`).exec(appSource.slice(bodyAt))?.[1] ?? '';
  const stop = line.indexOf(' && (');
  if (stop < 0 || line.trim().startsWith('(')) return '';
  const raw = line.slice(0, stop).trim();
  return raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1) : raw;
}

function appAllows(expr: string, role: string): boolean {
  const value = evaluate(expr, { userRole: role, ...ruleModules });
  if (typeof value !== 'boolean') throw new Error(`gerbang App untuk ${role} tidak boolean`);
  return value;
}

const tabsTable = docTable('ROLE-TABS');
const capabilitiesTable = docTable('ROLE-CAPABILITIES');

check('H1 berkas USER-ROLE.md terbaca dan punya dua tabel', tabsTable.rows.length > 0 && capabilitiesTable.rows.length > 0);
check('H2 AGENTS.md menunjuk berkas USER-ROLE.md', /USER-ROLE\.md/.test(agentsSource));
check('H3 role tabel tab sama dengan src/types.ts', sameSet([...roleColumns(tabsTable.header).keys()], codeRoles));
check('H3b role tabel wewenang sama dengan src/types.ts', sameSet([...roleColumns(capabilitiesTable.header).keys()], codeRoles));

const navTabsFromCode = [...navCases.keys()];
const navTabsFromDoc = tabsTable.rows.map((cells) => cells[0]);
check(
  'H4 daftar tab di USER-ROLE.md sama dengan allowed() Navbar',
  navTabsFromCode.length === navTabsFromDoc.length && navTabsFromCode.every((t) => navTabsFromDoc.includes(t)) &&
    navTabsFromDoc.every((t) => navTabsFromCode.includes(t)),
  `kode ${navTabsFromCode.length} vs dokumen ${navTabsFromDoc.length}`
);

const tabsRoles = roleColumns(tabsTable.header);
const capRoles = roleColumns(capabilitiesTable.header);
const docCell = (cells: string[], map: Map<string, number>, role: string) => cells[map.get(role) ?? -1];

for (const cells of tabsTable.rows) {
  const tab = cells[0];
  const bad: string[] = [];
  let galat = '';
  for (const role of codeRoles) {
    const cell = docCell(cells, tabsRoles, role);
    try {
      const allowed = navbarAllows(tab, role);
      if ((cell === 'ya') !== allowed) bad.push(`${role}: dokumen "${cell}" vs Navbar "${allowed ? 'ya' : 'tidak'}"`);
    } catch (error) {
      galat = error instanceof Error ? error.message : String(error);
    }
  }
  check(`H5 tab ${tab}: dokumen = Navbar`, !galat && bad.length === 0, galat || bad.join(' | '));
}

for (const cells of tabsTable.rows) {
  const tab = cells[0];
  const gate = appGate(tab);
  if (!gate) continue;
  const bad: string[] = [];
  let galat = '';
  for (const role of codeRoles) {
    const cell = docCell(cells, tabsRoles, role);
    try {
      const allowed = appAllows(gate, role);
      if ((cell === 'ya') !== allowed) bad.push(`${role}: dokumen "${cell}" vs App "${allowed ? 'ya' : 'tidak'}"`);
    } catch (error) {
      galat = error instanceof Error ? error.message : String(error);
    }
  }
  check(`H6 App memasang tab ${tab} sama dengan dokumen`, !galat && bad.length === 0, galat || bad.join(' | '));
}

for (const cells of capabilitiesTable.rows) {
  const [wewenang, fungsiName, tipe] = cells;
  const fn = ruleModules[fungsiName];
  if (typeof fn !== 'function') {
    check(`H7 wewenang "${wewenang}" memakai fungsi yang ada`, false, `fungsi ${fungsiName} tidak ditemukan`);
    continue;
  }
  const callable = fn as (role: string) => unknown;
  const bad: string[] = [];
  let galat = '';
  for (const role of codeRoles) {
    const cell = docCell(cells, capRoles, role);
    try {
      const value = callable(role);
      const cocok = tipe === 'nilai' ? String(value) === cell : cell === 'ya' ? value === true : value === false;
      if (!cocok) bad.push(`${role}: dokumen "${cell}" vs kode "${String(value)}"`);
    } catch (error) {
      galat = error instanceof Error ? error.message : String(error);
    }
  }
  check(`H7 ${fungsiName} (${tipe}) sama dengan dokumen`, !galat && bad.length === 0, galat || bad.join(' | '));
}

check(
  'H8 tidak ada sel kosong di USER-ROLE.md',
  tabsTable.rows.every((cells) => codeRoles.every((role) => ['ya', 'tidak'].includes(docCell(cells, tabsRoles, role)))) &&
    capabilitiesTable.rows.every((cells) => codeRoles.every((role) => String(docCell(cells, capRoles, role) ?? '').length > 0))
);

if (failures > 0) {
  console.log(`\n${failures} pemeriksaan GAGAL`);
  process.exit(1);
}
console.log('\nSemua pemeriksaan hak akses lima tab lulus.');
