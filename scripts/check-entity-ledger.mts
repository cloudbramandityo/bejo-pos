/**
 * Uji regresi pembukuan dua entitas: Dagang Perorangan → PT per 1 Juli 2026.
 * Jalankan: npm run check:entity
 *
 * Yang dijaga (brief pemilik: histori 2022 ke atas tetap utuh, buku PT mulai
 * 1 Juli 2026 dibangun dari jurnal saldo awal + rekap bulanan):
 *   A  registry entitas: rentang periode, pemilik tiap tanggal, label era
 *   B  pindah tanggal transisi & penutupan buku (dengan jejak pencatatnya)
 *   C  bagan akun per entitas: arsip rekening pribadi, prive PT, akun standar baru
 *   D  gerbang akun per tanggal (butir 12: transaksi PT tidak memakai akun pribadi)
 *   E  gerbang jurnal: seimbang, satu entitas, periode terkunci, bukti kembar
 *   F  pembalik jurnal & saldo akun
 *   G  angka simulasi pemilik (50/40/20/5/15/90 juta) menjadi neraca awal seimbang
 *   H  penolakan plan: modal saham melebihi aset bersih, saldo pribadi ikut dialihkan
 *   I  saldo awal beku per akun tujuan (tidak dihitung dua kali)
 *   J  rekap bulanan: periodik & perpetual, tanpa nilai yang dibukukan dua kali
 *   K  bulan yang jatuh di luar periode entitas tidak menghasilkan jurnal
 *   L  laporan per entitas dibaca dari jurnal: laba rugi, neraca, modal, arus kas,
 *      neraca saldo, buku besar, gabungan internal, dan lingkup laporan resmi PT
 *   M  modul murni: penjaga boleh menjalankannya di Node, tanpa koneksi server
 *   N  pemasangan layar: menu laporan terpasang dan angkanya hanya dari jurnal
 *   O  pajak per entitas: tarif dari isian pemilik, tahun transisi terbagi dua
 *   P  berkas unduhan: angka sama dengan layar, kop dan status ikut terbawa
 *
 * Angka simulasi pemilik dipakai sebagai fixture, sesuai brief butir 16.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { TAX_CONFIG_2025 } from '../src/types/tax';
import {
  appliedTaxRatePercent,
  defaultEntityRegistry,
  defaultEntityTaxProfile,
  entityForDateKey,
  entityForMonthKey,
  eraForDateKey,
  eraLabel,
  isDateLocked,
  lastDayBefore,
  normalizeEntityRegistry,
  normalizeEntityTaxProfile,
  setClosedThroughDate,
  setTransitionDate,
  toEntityDateKey,
  validateEntityRegistry,
  ENTITY_ID_PERORANGAN,
  ENTITY_ID_PT,
  EARLIEST_BOOK_DATE,
  DEFAULT_TRANSITION_DATE,
  type EntityProfile,
  type EntityRegistry,
} from '../src/utils/entityRegistry';
import {
  billingTariffForMonth,
  taxPeriodOfMonth,
  taxPeriodsForYear,
  taxSeparationNotes,
} from '../src/utils/entityTaxConfig';
import {
  REPORT_CURRENCY,
  accountLedgerDocument,
  combinedReportDocument,
  entityIdentityLines,
  journalDocument,
  officialReportDocument,
  safeFileName,
  trialBalanceDocument,
} from '../src/utils/ledgerReportDocument';
import {
  PT_ACCOUNT_CODES,
  LEGACY_ACCOUNT_CODES,
  accountUsability,
  accountsForEntity,
  applyTransitionRules,
  archivePersonalBankAccounts,
  canDeleteAccount,
  defaultAccountChart,
  deleteAccountBlockReason,
  disablePriveForPt,
  ensureStandardAccounts,
  findAccount,
  isPersonalBankAccount,
  selectableAccounts,
  type Account,
  type AccountChart,
} from '../src/utils/accountChart';
import {
  buildAggregateEntry,
  buildLedger,
  buildOpeningEntry,
  buildReversal,
  buildTrialBalance,
  alreadyReversed,
  balanceOf,
  canPostEntry,
  entryProblems,
  entryTotals,
  money,
  normalizeJournalEntry,
  postedEntries,
  type JournalEntry,
} from '../src/utils/ledgerMath';
import {
  aggregateMonth,
  codeMapForEntity,
  monthEndOf,
  monthKeysBetween,
  monthStartOf,
  monthsWithData,
  purchaseValues,
  withdrawalValue,
  type SaleRow,
  type ShiftRow,
  type StockRow,
} from '../src/utils/ledgerAggregates';
import {
  SIMULATION_FIGURES,
  buildTransitionPlan,
  closingFigures,
  measureThroughDate,
  openingBalancesFromPlan,
  type AllocationChoice,
} from '../src/utils/transitionMath';
import {
  GABUNGAN_WARNING,
  buildAccountLedger,
  buildBalanceSheet,
  buildCashFlow,
  buildCombinedStatement,
  buildEquityStatement,
  buildIncomeStatement,
  buildPeriodIndicators,
  buildPeriodTrialBalance,
  creditColumn,
  debitColumn,
  filterEntries,
  ptReportScope,
} from '../src/utils/ledgerReports';

let passed = 0;
const check = (label: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`   ok  ${label}`);
};

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

/** Semua berkas sumber di src/, nama relatif sama seperti yang dipakai read(). */
const listSource = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...listSource(`${dir}${entry.name}/`));
    else if (/\.tsx?$/.test(entry.name)) out.push(`${dir}${entry.name}`);
  }
  return out;
};
const SOURCE_FILES = listSource('src/');

/** Berkas sumber yang memuat teks tertentu, di luar berkas yang diizinkan. */
const filesWriting = (pattern: RegExp, allowed: string[]): string[] =>
  SOURCE_FILES.filter((rel) => !allowed.includes(rel) && pattern.test(read(rel)));

const registry = (): EntityRegistry => defaultEntityRegistry();
const chart = (): AccountChart => defaultAccountChart();

/** Isi Pengaturan Laporan Keuangan per 30 Juni 2026 memakai angka simulasi. */
const simulationSettings = () => ({
  cashBalance: SIMULATION_FIGURES.cash,
  openingCash: 0,
  closingInventory: SIMULATION_FIGURES.inventory,
  accountsReceivable: 0,
  accountsPayable: SIMULATION_FIGURES.accountsPayable,
  otherLiabilities: 0,
  fixedAssets: SIMULATION_FIGURES.equipment,
  openingCapital: 60_000_000,
  ownerDrawings: 0,
});

/** Akumulasi penyusutan tidak ada di isian lama, jadi angkanya masuk lewat alokasi. */
const simulationAllocations = (): AllocationChoice[] => [
  { code: LEGACY_ACCOUNT_CODES.cashOnHand, transferred: SIMULATION_FIGURES.cash },
  { code: LEGACY_ACCOUNT_CODES.inventory, transferred: SIMULATION_FIGURES.inventory },
  { code: LEGACY_ACCOUNT_CODES.receivable, transferred: 0 },
  { code: LEGACY_ACCOUNT_CODES.equipment, transferred: SIMULATION_FIGURES.equipment },
  { code: LEGACY_ACCOUNT_CODES.accumulatedDepreciation, transferred: SIMULATION_FIGURES.accumulatedDepreciation },
  { code: LEGACY_ACCOUNT_CODES.accountsPayable, transferred: SIMULATION_FIGURES.accountsPayable },
  { code: LEGACY_ACCOUNT_CODES.vatPayable, transferred: 0 },
  { code: LEGACY_ACCOUNT_CODES.otherLiabilities, transferred: 0 },
  { code: LEGACY_ACCOUNT_CODES.ownerLoan, transferred: 0 },
];

const emptyMeasures = () => ({
  cash: null,
  inventory: null,
  receivable: null,
  basisCash: 'tidak ada data',
  basisInventory: 'tidak ada data',
  basisReceivable: 'tidak ada data',
});

const figures = () => {
  const reg = registry();
  return closingFigures(
    simulationSettings(),
    emptyMeasures(),
    defaultAccountChart(),
    reg.entities.find((item) => item.id === ENTITY_ID_PERORANGAN)!,
    reg.entities.find((item) => item.id === ENTITY_ID_PT)!
  );
};

const plan = (overrides: { shareCapital?: number; retainedEarnings?: number; allocations?: AllocationChoice[]; figures?: ReturnType<typeof figures> } = {}) => {
  const reg = registry();
  return buildTransitionPlan({
    figures: overrides.figures || figures(),
    allocations: overrides.allocations || simulationAllocations(),
    shareCapital: overrides.shareCapital ?? SIMULATION_FIGURES.shareCapital,
    retainedEarnings: overrides.retainedEarnings ?? 0,
    chart: defaultAccountChart(),
    oldEntity: reg.entities.find((item) => item.id === ENTITY_ID_PERORANGAN)!,
    newEntity: reg.entities.find((item) => item.id === ENTITY_ID_PT)!,
  });
};

const entry = (raw: Partial<JournalEntry> & Record<string, unknown>): JournalEntry =>
  normalizeJournalEntry({ entityId: ENTITY_ID_PT, date: '2026-07-15', ...raw });

console.log('\n[1] Registry entitas & periode pembukuan');

check('bawaan: Perorangan 1 Jan 2022 - 30 Jun 2026, PT mulai 1 Jul 2026', () => {
  const reg = registry();
  assert.equal(reg.transitionDate, DEFAULT_TRANSITION_DATE);
  const lama = reg.entities.find((item) => item.id === ENTITY_ID_PERORANGAN)!;
  const baru = reg.entities.find((item) => item.id === ENTITY_ID_PT)!;
  assert.equal(lama.startDate, EARLIEST_BOOK_DATE);
  assert.equal(lama.endDate, '2026-06-30');
  assert.equal(baru.startDate, '2026-07-01');
  assert.equal(baru.endDate, null);
  assert.equal(baru.active, true);
  assert.equal(lama.active, false);
  assert.equal(lastDayBefore('2026-07-01'), '2026-06-30');
});

check('identitas hukum tidak dikarang: hanya sebutan bentuk usaha yang terisi', () => {
  const reg = registry();
  const baru = reg.entities.find((item) => item.id === ENTITY_ID_PT)!;
  assert.equal(baru.npwp, '');
  assert.equal(baru.legalDocNumber, '');
  assert.equal(baru.address, '');
  assert.equal(baru.legalName, 'Perseroan Terbatas (PT)');
  // Nama bentuk usaha bukan identitas: wajib muncul sebagai pekerjaan yang belum selesai.
  assert.ok(
    validateEntityRegistry(reg).some((problem) => problem.includes('Nama PT sesuai dokumen hukum belum diisi')),
    validateEntityRegistry(reg).join(' | ')
  );
});

check('satu tanggal hanya dimiliki satu entitas, termasuk tanggal transisi', () => {
  const reg = registry();
  assert.equal(entityForDateKey(reg, '2026-06-30')?.id, ENTITY_ID_PERORANGAN);
  assert.equal(entityForDateKey(reg, '2026-07-01')?.id, ENTITY_ID_PT);
  assert.equal(entityForDateKey(reg, '2022-01-01')?.id, ENTITY_ID_PERORANGAN);
  assert.equal(entityForDateKey(reg, '2021-12-31'), null);
  assert.equal(entityForDateKey(reg, 'samt'), null);
});

check('tanggal transaksi lama DD/MM/YY dikenali sebagai kunci hari yang sama', () => {
  assert.equal(toEntityDateKey('26/06/26'), '2026-06-26');
  assert.equal(toEntityDateKey('2026-06-26'), '2026-06-26');
  assert.equal(toEntityDateKey('2026-06-26T23:59:00'), '2026-06-26');
});

check('label era Pra-PT / Pasca-PT dipakai laporan, bukan dihitung di layar', () => {
  const reg = registry();
  assert.equal(eraForDateKey(reg, '2026-06-30'), 'PRA_PT');
  assert.equal(eraForDateKey(reg, '2026-07-01'), 'PASCA_PT');
  assert.equal(eraLabel('PRA_PT'), 'Pra-PT');
  assert.equal(eraLabel('PASCA_PT'), 'Pasca-PT');
  assert.equal(entityForMonthKey(reg, '2026-06')?.id, ENTITY_ID_PERORANGAN);
  assert.equal(entityForMonthKey(reg, '2026-07')?.id, ENTITY_ID_PT);
});

console.log('\n[2] Pindah tanggal transisi & penutupan buku');

check('transisi hanya boleh sesudah awal buku supaya histori tetap ada', () => {
  const reg = registry();
  const tooEarly = setTransitionDate(reg, '2021-12-31', 'Langgo (DEVELOPER)');
  assert.equal(tooEarly.accepted, false);
  assert.match(tooEarly.reason, /harus sesudah/);
  assert.equal(tooEarly.registry.transitionDate, DEFAULT_TRANSITION_DATE);

  const unreadable = setTransitionDate(reg, 'besok');
  assert.equal(unreadable.accepted, false);
  assert.match(unreadable.reason, /belum terbaca/);

  const same = setTransitionDate(reg, DEFAULT_TRANSITION_DATE);
  assert.equal(same.accepted, false);
  assert.match(same.reason, /sudah memakai tanggal ini/);
});

check('transisi baru menyusun ulang rentang, tidak menyentuh histori', () => {
  const moved = setTransitionDate(registry(), '2026-01-01', 'Langgo (DEVELOPER)');
  assert.equal(moved.accepted, true);
  const lama = moved.registry.entities.find((item) => item.id === ENTITY_ID_PERORANGAN)!;
  const baru = moved.registry.entities.find((item) => item.id === ENTITY_ID_PT)!;
  assert.equal(lama.startDate, EARLIEST_BOOK_DATE);
  assert.equal(lama.endDate, '2025-12-31');
  assert.equal(baru.startDate, '2026-01-01');
  assert.equal(moved.registry.history[0]?.actor, 'Langgo (DEVELOPER)');
});

check('penutupan buku ikut digeser hanya bila jatuh sesudah transisi baru', () => {
  const closed = setClosedThroughDate(registry(), '2026-06-30', 'Langgo (DEVELOPER)');
  assert.equal(closed.closedThroughDate, '2026-06-30');
  // transisi maju: buku lama tetap tertutup sampai tanggal yang sudah dipilih
  const maju = setTransitionDate(closed, '2026-09-01');
  assert.equal(maju.registry.closedThroughDate, '2026-06-30');
  // transisi mundur sampai menutup tanggal yang sudah ditutup: penarikan kembali
  const lebar = setClosedThroughDate(registry(), '2026-08-31', 'Langgo (DEVELOPER)');
  const mundur = setTransitionDate(lebar, '2026-08-01');
  assert.equal(mundur.registry.closedThroughDate, '2026-07-31');
});

check('penutupan buku tercatat dengan nama yang melakukannya', () => {
  const closed = setClosedThroughDate(registry(), '2026-06-30', 'Andi (ADMIN)');
  // riwayat terurut tanggal efektif, jadi catatannya dicari isinya, bukan posisinya
  const record = closed.history.find((item) => /ke bawah ditutup/.test(item.note))!;
  assert.ok(record, closed.history.map((item) => item.note).join(' | '));
  assert.equal(record.actor, 'Andi (ADMIN)');
  assert.match(record.note, /Buku 30 Juni 2026 ke bawah ditutup/);
  assert.equal(isDateLocked(closed, '2026-06-30'), true);
  assert.equal(isDateLocked(closed, '2026-07-01'), false);

  // nilai sama tidak menghasilkan catatan ganda
  const again = setClosedThroughDate(closed, '2026-06-30', 'Andi (ADMIN)');
  assert.equal(again.history.length, closed.history.length);

  const reopened = setClosedThroughDate(closed, null, 'Andi (ADMIN)');
  assert.equal(reopened.closedThroughDate, null);
  const buka = reopened.history.find((item) => /dibuka kembali/.test(item.note))!;
  assert.equal(buka.actor, 'Andi (ADMIN)');
});

console.log('\n[3] Bagan akun per entitas');

check('kode lama dipertahankan, akun PT baru ditambahkan', () => {
  const coa = chart();
  assert.ok(findAccount(coa, ENTITY_ID_PERORANGAN, '1100'));
  assert.ok(findAccount(coa, ENTITY_ID_PERORANGAN, '1110'));
  assert.ok(findAccount(coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.bank));
  assert.ok(findAccount(coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.capital));
  assert.ok(findAccount(coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.paidInCapitalExtra));
  assert.ok(findAccount(coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.retainedEarnings));
  assert.ok(findAccount(coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.dividends));
  assert.ok(findAccount(coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.dividendsPayable));
  assert.ok(findAccount(coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.shareholderLoan));
  assert.equal(accountsForEntity(coa, ENTITY_ID_PERORANGAN).length, 15);
});

check('arsip & prive tidak menghapus akun: jumlah akun utuh', () => {
  const coa = chart();
  const total = coa.accounts.length;
  const ruled = applyTransitionRules(coa);
  assert.equal(ruled.accounts.length, total);
  const pribadi = findAccount(ruled, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.personalBank)!;
  assert.equal(pribadi.archived, true);
  assert.equal(pribadi.postable, false);
  assert.equal(isPersonalBankAccount(pribadi), true);
  assert.equal(findAccount(ruled, ENTITY_ID_PT, PT_ACCOUNT_CODES.bank)!.archived, false);
});

check('prive hanya ditutup di PT; Prive perorangan tetap utuh', () => {
  const ruled = disablePriveForPt(chart());
  assert.equal(findAccount(ruled, ENTITY_ID_PT, '3200'), null);
  assert.equal(findAccount(ruled, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.drawings)!.archived, false);
  const privePt: AccountChart = {
    schemaVersion: '1',
    accounts: [...chart().accounts, { code: '3200', name: 'Prive Pemilik', type: 'MODAL', normal: 'DEBIT', entityId: ENTITY_ID_PT, archived: false, postable: true }],
  };
  assert.equal(findAccount(disablePriveForPt(privePt), ENTITY_ID_PT, '3200')!.archived, true);
});

check('akun standar baru ditambah tanpa menimpa isian pemilik', () => {
  const lama = chart();
  const tanpaPpn: AccountChart = {
    schemaVersion: '1',
    accounts: lama.accounts
      .filter((item) => item.code !== LEGACY_ACCOUNT_CODES.vatPayable && item.code !== LEGACY_ACCOUNT_CODES.otherLiabilities)
      .map((item) => (item.code === '1100' && item.entityId === ENTITY_ID_PERORANGAN ? { ...item, name: 'Kas Toko Saya', openingBalance: 123_000 } : item)),
  };
  const { chart: hasil, added } = ensureStandardAccounts(tanpaPpn);
  assert.deepEqual(added.sort(), [
    `${LEGACY_ACCOUNT_CODES.otherLiabilities} Utang Lain-lain`,
    `${LEGACY_ACCOUNT_CODES.otherLiabilities} Utang Lain-lain`,
    `${LEGACY_ACCOUNT_CODES.vatPayable} Utang PPN`,
    `${LEGACY_ACCOUNT_CODES.vatPayable} Utang PPN`,
  ].sort());
  assert.ok(findAccount(hasil, ENTITY_ID_PT, PT_ACCOUNT_CODES.vatPayable));
  assert.equal(findAccount(hasil, ENTITY_ID_PERORANGAN, '1100')!.name, 'Kas Toko Saya');
  assert.equal(findAccount(hasil, ENTITY_ID_PERORANGAN, '1100')!.openingBalance, 123_000);
  // aman dipanggil ulang
  assert.deepEqual(ensureStandardAccounts(hasil).added, []);
});

check('akun bersejarah hanya diarsipkan, tidak dihapus', () => {
  const kas = findAccount(chart(), ENTITY_ID_PERORANGAN, '1100')!;
  assert.equal(canDeleteAccount(4), false);
  assert.match(deleteAccountBlockReason(kas, 4, false), /sudah dipakai 4 baris jurnal/);
  assert.equal(canDeleteAccount(0, true), false);
  assert.match(deleteAccountBlockReason(kas, 0, true), /punya saldo awal/);
  assert.equal(canDeleteAccount(0, false), true);
  assert.equal(deleteAccountBlockReason(kas, 0, false), '');
});

console.log('\n[4] Gerbang transaksi per tanggal (butir 12)');

check('rekening pribadi tidak boleh dipakai pada tanggal PT', () => {
  const reg = registry();
  const coa = archivePersonalBankAccounts(chart());
  const before = accountUsability(coa, reg, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.personalBank, '2026-06-15');
  assert.match(before.reason, /sudah diarsipkan/);
  // bagan tanpa aturan arsip pun tetap ditolak untuk tanggal PT
  const after = accountUsability(chart(), reg, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.personalBank, '2026-07-15');
  assert.equal(after.ok, false);
  assert.match(after.reason, /tidak boleh dipakai sebagai rekening operasional PT/);
});

check('prive ditolak untuk PT, dengan jalan keluar yang benar', () => {
  const reg = registry();
  const coa: AccountChart = {
    schemaVersion: '1',
    accounts: [...chart().accounts, { code: '3200', name: 'Prive Pemilik', type: 'MODAL', normal: 'DEBIT', entityId: ENTITY_ID_PT, archived: false, postable: true }],
  };
  const result = accountUsability(coa, reg, ENTITY_ID_PT, '3200', '2026-08-01');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'Prive tidak berlaku untuk PT. Gunakan dividen, gaji direksi, atau pinjaman pemegang saham.');
  assert.equal(accountUsability(coa, reg, ENTITY_ID_PT, PT_ACCOUNT_CODES.dividends, '2026-08-01').ok, true);
  assert.equal(accountUsability(coa, reg, ENTITY_ID_PT, PT_ACCOUNT_CODES.boardSalary, '2026-08-01').ok, true);
  assert.equal(accountUsability(coa, reg, ENTITY_ID_PT, PT_ACCOUNT_CODES.shareholderLoan, '2026-08-01').ok, true);
});

check('akun entitas lain & akun tidak dikenal ditolak', () => {
  const reg = registry();
  const result = accountUsability(chart(), reg, ENTITY_ID_PT, LEGACY_ACCOUNT_CODES.ownerLoan, '2026-08-01');
  assert.equal(result.ok, false);
  assert.match(result.reason, /tidak ada pada entitas ini/);
});

check('form jurnal hanya menawarkan akun yang masih boleh dipakai', () => {
  const ruled = applyTransitionRules(chart());
  const ptCodes = selectableAccounts(ruled, ENTITY_ID_PT).map((item) => item.code);
  assert.ok(ptCodes.includes(PT_ACCOUNT_CODES.bank));
  assert.ok(!selectableAccounts(ruled, ENTITY_ID_PERORANGAN).some((item) => item.code === LEGACY_ACCOUNT_CODES.personalBank));
});

console.log('\n[5] Gerbang jurnal');

const reg = registry();
const coa = chart();

check('jurnal seimbang milik entitas dan tanggalnya boleh dicatat', () => {
  const good = entry({
    lines: [
      { code: PT_ACCOUNT_CODES.cashOnHand, debit: 5_000_000, credit: 0 },
      { code: PT_ACCOUNT_CODES.sales, debit: 0, credit: 5_000_000 },
    ],
  });
  assert.deepEqual(entryProblems(good, coa, reg, []), []);
  assert.equal(canPostEntry(good, coa, reg, []).ok, true);
});

check('debit tidak sama kredit ditolak dengan selisih yang terlihat', () => {
  const off = entry({
    lines: [
      { code: PT_ACCOUNT_CODES.cashOnHand, debit: 5_000_000, credit: 0 },
      { code: PT_ACCOUNT_CODES.sales, debit: 0, credit: 4_500_000 },
    ],
  });
  const problems = entryProblems(off, coa, reg, []);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Debit 5.000.000 tidak sama dengan kredit 4.500.000/);
});

check('satu baris saja belum disebut jurnal', () => {
  const oneLine = entry({ lines: [{ code: PT_ACCOUNT_CODES.cashOnHand, debit: 1_000, credit: 1_000 }] });
  const problems = entryProblems(oneLine, coa, reg, []);
  assert.ok(problems.some((text) => /minimal dua baris/.test(text)));
  assert.ok(problems.some((text) => /tidak boleh berisi debit sekaligus kredit/.test(text)));
});

check('jurnal PT pada tanggal perorangan ditolak (bukan dipindah diam-diam)', () => {
  const wrongEra = entry({
    date: '2026-06-15',
    lines: [
      { code: PT_ACCOUNT_CODES.cashOnHand, debit: 1_000_000, credit: 0 },
      { code: PT_ACCOUNT_CODES.sales, debit: 0, credit: 1_000_000 },
    ],
  });
  const problems = entryProblems(wrongEra, coa, reg, []);
  assert.ok(problems.some((text) => /adalah milik/.test(text)), problems.join(' | '));
});

check('tanggal di luar periode entitas mana pun ditolak', () => {
  const orphan = entry({
    date: '2021-05-05',
    lines: [
      { code: PT_ACCOUNT_CODES.cashOnHand, debit: 1_000, credit: 0 },
      { code: PT_ACCOUNT_CODES.sales, debit: 0, credit: 1_000 },
    ],
  });
  assert.ok(entryProblems(orphan, coa, reg, []).some((text) => /tidak jatuh pada periode/.test(text)));
});

check('periode terkunci menolak jurnal biasa, saldo awal tetap boleh', () => {
  const closed = setClosedThroughDate(reg, '2026-06-30', 'Langgo (DEVELOPER)');
  const lama = normalizeJournalEntry({
    entityId: ENTITY_ID_PERORANGAN,
    date: '2026-06-20',
    lines: [
      { code: LEGACY_ACCOUNT_CODES.cashOnHand, debit: 1_000_000, credit: 0 },
      { code: LEGACY_ACCOUNT_CODES.sales, debit: 0, credit: 1_000_000 },
    ],
  });
  const problems = entryProblems(lama, coa, closed, []);
  assert.ok(problems.some((text) => /sudah ditutup/.test(text)), problems.join(' | '));

  const opening = normalizeJournalEntry({
    entityId: ENTITY_ID_PT,
    date: '2026-06-20',
    source: 'SALDO_AWAL',
    lines: [
      { code: PT_ACCOUNT_CODES.cashOnHand, debit: 1_000_000, credit: 0 },
      { code: PT_ACCOUNT_CODES.sales, debit: 0, credit: 1_000_000 },
    ],
  });
  assert.deepEqual(entryProblems(opening, coa, closed, []).filter((text) => /sudah ditutup/.test(text)), []);
});

check('nomor bukti kembar pada tanggal yang sama ditolak', () => {
  const first = entry({ ref: 'MJ-001', lines: [{ code: PT_ACCOUNT_CODES.cashOnHand, debit: 2_000, credit: 0 }, { code: PT_ACCOUNT_CODES.sales, debit: 0, credit: 2_000 }] });
  const twin = entry({ id: 'jen_twin', ref: 'MJ-001', lines: first.lines });
  assert.match(entryProblems(twin, coa, reg, [first]).join(' '), /Jurnal kembar ditolak/);
  // beda tanggal atau beda entitas bukan kembar
  const otherDay = entry({ id: 'jen_lain', ref: 'MJ-001', date: '2026-07-16', lines: first.lines });
  assert.deepEqual(entryProblems(otherDay, coa, reg, [first]), []);
});

console.log('\n[6] Pembalik jurnal & saldo akun');

check('pembalik menukar arah, tercatat, dan menandai jurnal asal', () => {
  const asal = entry({ ref: 'MJ-009', lines: [{ code: PT_ACCOUNT_CODES.cashOnHand, debit: 3_000_000, credit: 0 }, { code: PT_ACCOUNT_CODES.sales, debit: 0, credit: 3_000_000 }] });
  const balik = buildReversal(asal, '2026-07-31', 'Langgo (DEVELOPER)');
  assert.equal(balik.source, 'BALIK');
  assert.equal(balik.status, 'POSTED');
  assert.equal(balik.reversalOf, asal.id);
  assert.equal(balik.ref, 'MJ-009/BALIK');
  assert.equal(balik.lines.find((line) => line.code === PT_ACCOUNT_CODES.cashOnHand)!.credit, 3_000_000);
  assert.equal(entryTotals(balik).balanced, true);
  assert.equal(alreadyReversed([asal, balik], asal.id), true);
  assert.equal(alreadyReversed([asal], asal.id), false);
  assert.deepEqual(entryProblems(balik, coa, reg, [asal]), []);
});

check('saldo dihitung sekali per akun, draf dan batal tidak ikut', () => {
  const posted = entry({ status: 'POSTED', lines: [{ code: PT_ACCOUNT_CODES.cashOnHand, debit: 4_000_000, credit: 0 }, { code: PT_ACCOUNT_CODES.sales, debit: 0, credit: 4_000_000 }] });
  const draft = entry({ id: 'jen_draf', status: 'DRAF', lines: [{ code: PT_ACCOUNT_CODES.cashOnHand, debit: 999_000, credit: 0 }, { code: PT_ACCOUNT_CODES.sales, debit: 0, credit: 999_000 }] });
  const cancelledEntry = entry({ id: 'jen_batal', status: 'BATAL', lines: draft.lines });
  const entries = [posted, draft, cancelledEntry];
  assert.equal(postedEntries(entries).length, 1);
  assert.equal(balanceOf(entries, coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.cashOnHand), 4_000_000);
  assert.equal(balanceOf(entries, coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.sales), 4_000_000);
  const ledger = buildLedger(entries, coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.cashOnHand);
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.rows[0].running, 4_000_000);
});

check('neraca saldo: total debit sama kredit, akun tak bergerak tidak ikut', () => {
  const saldoAwal = buildOpeningEntry({
    entityId: ENTITY_ID_PT,
    date: '2026-07-01',
    counterCode: PT_ACCOUNT_CODES.capital,
    actor: 'Langgo (DEVELOPER)',
    lines: [
      { code: PT_ACCOUNT_CODES.cashOnHand, debit: 50_000_000, credit: 0 },
      { code: PT_ACCOUNT_CODES.equipment, debit: 20_000_000, credit: 0 },
      { code: PT_ACCOUNT_CODES.accumulatedDepreciation, debit: 0, credit: 5_000_000 },
    ],
  });
  const posted = { ...saldoAwal, status: 'POSTED' as const };
  const trial = buildTrialBalance([posted], coa, ENTITY_ID_PT);
  assert.equal(trial.balanced, true);
  assert.equal(trial.totalDebit, 70_000_000);
  assert.equal(trial.totalCredit, 70_000_000);
  assert.equal(trial.rows.length, 4);
  assert.equal(trial.rows.find((row) => row.account.code === PT_ACCOUNT_CODES.capital)!.credit, 65_000_000);
  const akumulasi = trial.rows.find((row) => row.account.code === PT_ACCOUNT_CODES.accumulatedDepreciation)!;
  assert.equal(akumulasi.credit, 5_000_000);
});

console.log('\n[7] Angka simulasi pemilik menjadi neraca awal');

check('30 Juni 2026 terukur dari data toko, bukan dari taksiran', () => {
  const sales: SaleRow[] = [
    { id: 'trx_1', date: '01/06/26', total: 10_000_000, paymentMethods: { cash: 6_000_000, transfer: 4_000_000 } },
    { id: 'trx_2', date: '20/06/26', total: 3_000_000, paymentMethods: {} },
  ];
  const stock: StockRow[] = [
    { id: 'st_1', date: '2026-06-05', type: 'PEMBELIAN', items: [{ totalPrice: 4_000_000 }], shippingCost: 200_000 },
    { id: 'st_2', date: '2026-06-20', type: 'PENGAMBILAN', items: [{ totalPrice: 1_500_000 }] },
  ];
  const shifts: ShiftRow[] = [{ date: '2026-06-30', operationalExpenses: 500_000 }];
  const measured = measureThroughDate({ sales, stock, shifts, throughDate: '2026-06-30' });
  assert.equal(measured.cash, 10_000_000 - 4_200_000 - 500_000);
  assert.equal(measured.inventory, 4_200_000 - 1_500_000);
  assert.equal(measured.receivable, 3_000_000);
  assert.match(measured.basisCash, /sampai 30 Juni 2026/);
  // transaksi sesudah tanggal penutupan tidak ikut terukur
  const beforeOnly = measureThroughDate({ sales: [...sales, { id: 'trx_3', date: '2026-07-02', total: 90_000_000, paymentMethods: { cash: 90_000_000 } }], stock, shifts, throughDate: '2026-06-30' });
  assert.equal(beforeOnly.cash, measured.cash);
});

check('daftar penutupan memuat 12 saldo, tiga di antaranya tidak dialihkan', () => {
  const rows = figures();
  assert.equal(rows.length, 12);
  const tidak = rows.filter((row) => !row.transferable).map((row) => row.code);
  assert.deepEqual(tidak, [LEGACY_ACCOUNT_CODES.personalBank, LEGACY_ACCOUNT_CODES.capital, LEGACY_ACCOUNT_CODES.drawings]);
  assert.match(rows.find((row) => row.code === LEGACY_ACCOUNT_CODES.personalBank)!.reason!, /Rekening pribadi tidak dialihkan/);
  assert.match(rows.find((row) => row.code === LEGACY_ACCOUNT_CODES.capital)!.basis, /modal PT dibentuk dari akta pendirian/);
  assert.match(rows.find((row) => row.code === LEGACY_ACCOUNT_CODES.capital)!.reason!, /Isian Modal Saham diambil dari akta/);
  assert.equal(rows.find((row) => row.code === LEGACY_ACCOUNT_CODES.drawings)!.reason, 'Prive tidak berlaku untuk PT.');
  // dasar angka dibaca apa adanya: yang tidak ada sumbernya ditulis begitu
  assert.equal(rows.find((row) => row.code === LEGACY_ACCOUNT_CODES.equipment)!.measured, null);
  assert.match(rows.find((row) => row.code === LEGACY_ACCOUNT_CODES.accumulatedDepreciation)!.basis, /belum menghitung penyusutan otomatis/);
});

check('simulasi 50/40/20/5/15 → aset bersih 90 juta = modal saham, seimbang', () => {
  const result = plan();
  assert.deepEqual(result.problems, [], result.problems.join(' | '));
  assert.equal(result.totalAssets, 110_000_000);
  assert.equal(result.totalLiabilities, 20_000_000);
  assert.equal(result.netTransferred, 90_000_000);
  assert.equal(result.additionalPaidIn, 0);
  assert.equal(result.difference, 0);
  assert.equal(result.balanced, true);
  const line = (code: string) => result.lines.find((item) => item.code === code)!;
  assert.equal(line(PT_ACCOUNT_CODES.cashOnHand).debit, 50_000_000);
  assert.equal(line(PT_ACCOUNT_CODES.inventory).debit, 40_000_000);
  assert.equal(line(PT_ACCOUNT_CODES.equipment).debit, 20_000_000);
  assert.equal(line(PT_ACCOUNT_CODES.accumulatedDepreciation).credit, 5_000_000);
  assert.equal(line(PT_ACCOUNT_CODES.accountsPayable).credit, 15_000_000);
  assert.equal(line(PT_ACCOUNT_CODES.capital).credit, 90_000_000);
  assert.equal(result.lines.some((item) => item.code === PT_ACCOUNT_CODES.paidInCapitalExtra), false);
});

check('seluruh aset bersih tidak dianggap modal saham: sisanya Tambahan Modal Disetor', () => {
  const result = plan({ shareCapital: 70_000_000 });
  assert.equal(result.additionalPaidIn, 20_000_000);
  assert.equal(result.balanced, true);
  assert.equal(result.lines.find((item) => item.code === PT_ACCOUNT_CODES.paidInCapitalExtra)!.credit, 20_000_000);

  const withRetained = plan({ shareCapital: 60_000_000, retainedEarnings: 10_000_000 });
  assert.equal(withRetained.additionalPaidIn, 20_000_000);
  assert.equal(withRetained.lines.find((item) => item.code === PT_ACCOUNT_CODES.retainedEarnings)!.credit, 10_000_000);
  assert.equal(withRetained.balanced, true);
});

check('modal saham belum diisi → peringatan, bukan angka karangan', () => {
  const result = plan({ shareCapital: 0 });
  assert.equal(result.problems.length, 0, result.problems.join(' | '));
  assert.ok(result.warnings.some((text) => /Tambahan Modal Disetor/.test(text)), result.warnings.join(' | '));
});

console.log('\n[8] Penolakan yang harus tetap ada');

check('modal saham melebihi aset bersih ditolak', () => {
  const result = plan({ shareCapital: 100_000_000 });
  assert.equal(result.balanced, false);
  assert.ok(result.problems.some((text) => /melebihi aset bersih/.test(text)), result.problems.join(' | '));
});

check('saldo pribadi / modal lama / prive tidak bisa dipaksa ikut dialihkan', () => {
  const result = plan({
    allocations: [
      ...simulationAllocations(),
      { code: LEGACY_ACCOUNT_CODES.personalBank, transferred: 5_000_000 },
      { code: LEGACY_ACCOUNT_CODES.capital, transferred: 60_000_000 },
      { code: LEGACY_ACCOUNT_CODES.drawings, transferred: 1_000_000 },
    ],
  });
  const text = result.problems.join(' | ');
  assert.match(text, /Rekening pribadi tidak dialihkan/);
  assert.match(text, /Modal pemilik lama/);
  assert.match(text, /Prive tidak berlaku untuk PT/);
});

check('nilai dialihkan melebihi yang tercatat → peringatan; negatif → ditolak', () => {
  const lebih = plan({ allocations: [{ code: LEGACY_ACCOUNT_CODES.cashOnHand, transferred: 70_000_000 }] });
  assert.ok(lebih.warnings.some((text) => /lebih besar dari yang tercatat/.test(text)), lebih.warnings.join(' | '));
  const minus = plan({ allocations: [{ code: LEGACY_ACCOUNT_CODES.cashOnHand, transferred: -1 }] });
  assert.ok(minus.problems.some((text) => /tidak boleh negatif/.test(text)), minus.problems.join(' | '));
});

check('akumulasi penyusutan melebihi harga perolehan ditolak', () => {
  const result = plan({
    allocations: [
      { code: LEGACY_ACCOUNT_CODES.equipment, transferred: 20_000_000 },
      { code: LEGACY_ACCOUNT_CODES.accumulatedDepreciation, transferred: 30_000_000 },
      { code: LEGACY_ACCOUNT_CODES.cashOnHand, transferred: 50_000_000 },
    ],
    shareCapital: 40_000_000,
  });
  assert.ok(result.problems.some((text) => /Nilai buku jadi negatif/.test(text)), result.problems.join(' | '));
});

check('aset bersih nol ditolak (tidak ada neraca awal yang bisa dibentuk)', () => {
  const result = plan({ allocations: [], shareCapital: 0 });
  assert.match(result.problems.join(' '), /Aset bersih yang dialihkan nol atau negatif/);
});

console.log('\n[9] Saldo awal beku & jurnal saldo awal');

check('saldo awal dipasang sekali per akun tujuan', () => {
  const result = plan();
  const accounts = openingBalancesFromPlan(result, coa, ENTITY_ID_PT);
  const value = (code: string) => accounts.find((item) => item.code === code)?.openingBalance;
  assert.equal(value(PT_ACCOUNT_CODES.cashOnHand), 50_000_000);
  assert.equal(value(PT_ACCOUNT_CODES.inventory), 40_000_000);
  assert.equal(value(PT_ACCOUNT_CODES.accumulatedDepreciation), -5_000_000);
  assert.equal(value(PT_ACCOUNT_CODES.accountsPayable), -15_000_000);
  assert.equal(value(PT_ACCOUNT_CODES.capital), -90_000_000);
  assert.equal(value(PT_ACCOUNT_CODES.dividends), undefined);
});

check('jurnal saldo awal menyeimbangkan sendiri lawan akun modal saham', () => {
  const result = plan();
  const draft = buildOpeningEntry({
    entityId: ENTITY_ID_PT,
    date: '2026-07-01',
    lines: result.lines,
    counterCode: PT_ACCOUNT_CODES.capital,
    actor: 'Langgo (DEVELOPER)',
  });
  assert.equal(draft.source, 'SALDO_AWAL');
  assert.equal(draft.status, 'DRAF');
  assert.equal(draft.id, `opn_${ENTITY_ID_PT}_2026-07-01`);
  assert.equal(entryTotals(draft).balanced, true);
  // rencana sudah memuat modal saham → tidak ditambah baris penyeimbang ganda
  const capitalLines = draft.lines.filter((line) => line.code === PT_ACCOUNT_CODES.capital);
  assert.equal(capitalLines.length, 1);
  assert.equal(capitalLines[0].credit, 90_000_000);
  const posted = { ...draft, status: 'POSTED' as const };
  assert.deepEqual(entryProblems(posted, coa, registry(), []), []);
  const trial = buildTrialBalance([posted], coa, ENTITY_ID_PT);
  assert.equal(trial.balanced, true);
  assert.equal(trial.totalDebit, 110_000_000);
  assert.equal(trial.totalDebit, trial.totalCredit);
  // saldo awal beku di bagan tidak ditambahkan lagi ke neraca saldo
  const withFrozen = { ...coa, accounts: openingBalancesFromPlan(result, coa, ENTITY_ID_PT) };
  assert.equal(buildTrialBalance([posted], withFrozen, ENTITY_ID_PT).totalDebit, 110_000_000);
});

console.log('\n[10] Rekap bulanan (agregat)');

const perorangan = registry().entities.find((item) => item.id === ENTITY_ID_PERORANGAN)!;
const pt = registry().entities.find((item) => item.id === ENTITY_ID_PT)!;

check('kode akun perorangan tidak pernah menunjuk rekening pribadi', () => {
  const lama = codeMapForEntity(perorangan);
  const baru = codeMapForEntity(pt);
  assert.equal(lama.cash, LEGACY_ACCOUNT_CODES.cashOnHand);
  assert.equal(lama.bank, LEGACY_ACCOUNT_CODES.cashOnHand);
  assert.equal(lama.drawings, LEGACY_ACCOUNT_CODES.drawings);
  assert.ok(!Object.values(lama).includes(LEGACY_ACCOUNT_CODES.personalBank));
  assert.equal(baru.bank, PT_ACCOUNT_CODES.bank);
  assert.equal(baru.ownerLoan, PT_ACCOUNT_CODES.shareholderLoan);
  assert.equal(baru.drawings, PT_ACCOUNT_CODES.dividends);
});

const juneSales: SaleRow[] = [
  { id: 'trx_a', date: '2026-06-10', total: 1_100_000, tax: 100_000, paymentMethods: { cash: 1_100_000 } },
  { id: 'trx_b', date: '2026-06-20', total: 2_000_000, paymentMethods: { transfer: 1_500_000 } },
  { id: 'trx_batal', date: '2026-06-25', total: 7_000_000, paymentMethods: { cash: 7_000_000 }, invoiceStatus: 'CANCELLED' },
];
const juneStock: StockRow[] = [
  { id: 'st_buy', date: '2026-06-05', type: 'PEMBELIAN', items: [{ totalPrice: 500_000 }], shippingCost: 50_000 },
  { id: 'st_pick', date: '2026-06-15', type: 'PENGAMBILAN', items: [{ totalPrice: 200_000 }] },
];
const juneShifts: ShiftRow[] = [{ date: '2026-06-30', operationalExpenses: 100_000 }];

check('pembelian & pengambilan dinilai dari baris barang, ongkir dihitung', () => {
  const bought = purchaseValues(juneStock);
  assert.deepEqual(bought, { goods: 500_000, shipping: 50_000, total: 550_000 });
  assert.equal(withdrawalValue(juneStock), 200_000);
});

check('periodik: penjualan tunai/transfer/piutang, PPN dipungut, opname memindahkan nilai', () => {
  const result = aggregateMonth({
    periodKey: '2026-06',
    entity: perorangan,
    sales: juneSales,
    stock: juneStock,
    shifts: juneShifts,
    mode: 'PERIODIK',
    priorInventoryBalance: 0,
    countedInventory: 300_000,
  });
  assert.equal(result.totals.saleCount, 2);
  assert.equal(result.totals.revenueNet, 3_100_000 - 100_000);
  assert.equal(result.totals.taxCollected, 100_000);
  assert.equal(result.totals.cashReceived, 1_100_000);
  assert.equal(result.totals.bankReceived, 1_500_000);
  assert.equal(result.totals.receivableAdded, 500_000);
  assert.equal(result.totals.purchases, 500_000);
  assert.equal(result.totals.operationalExpenses, 100_000);
  // periodik: pengambilan agen tidak dibukukan terpisah, dan itu ditulis
  assert.ok(result.notes.some((text) => /tidak dibukukan terpisah/.test(text)), result.notes.join(' | '));
  const journal = buildAggregateEntry({ periodKey: '2026-06', entityId: ENTITY_ID_PERORANGAN, date: '2026-06-30', groups: result.groups, actor: 'Langgo (DEVELOPER)' });
  assert.equal(entryTotals(journal).balanced, true);
  assert.equal(journal.id, `agg_${ENTITY_ID_PERORANGAN}_2026-06`);
  assert.deepEqual(entryProblems(journal, coa, registry(), []), []);
  // kas: 1.100.000 + 1.500.000 masuk (transfer tercatat di kas toko), 550.000 + 100.000 keluar
  const entries = [journal];
  assert.equal(balanceOf(entries, coa, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.cashOnHand), 1_950_000);
  assert.equal(balanceOf(entries, coa, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.sales), 3_000_000);
  assert.equal(balanceOf(entries, coa, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.vatPayable), 100_000);
  assert.equal(balanceOf(entries, coa, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.inventory), 300_000);
  assert.equal(balanceOf(entries, coa, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.receivable), 500_000);
  // periodik: pembelian 550.000 dikurangi nilai barang sisa hasil opname 300.000 = harga pokok barang yang terpakai
  assert.equal(balanceOf(entries, coa, ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.costOfGoods), 250_000);
  // satu bulan = satu jurnal, jadi histori 2022 ke atas tidak membuat ribuan baris
  assert.equal(postedEntries(entries).length, 1);
});

check('perpetual: pembelian masuk persediaan, pengambilan jadi HPP, opname mengoreksi selisihnya', () => {
  const result = aggregateMonth({
    periodKey: '2026-08',
    entity: pt,
    sales: [{ id: 'trx_pt', date: '2026-08-12', total: 4_000_000, paymentMethods: { transfer: 4_000_000 } }],
    stock: juneStock.map((row) => ({ ...row, date: row.date.replace('2026-06', '2026-08') })),
    shifts: [{ date: '2026-08-31', operationalExpenses: 250_000 }],
    mode: 'PERPETUAL',
    priorInventoryBalance: 1_000_000,
    countedInventory: 1_100_000,
    purchasePaidFrom: 'bank',
  });
  assert.equal(result.totals.withdrawals, 200_000);
  assert.equal(result.notes.length, 0, result.notes.join(' | '));
  const codes = result.groups.map((group) => `${group.debitCode}>${group.creditCode}`);
  assert.ok(codes.includes(`${PT_ACCOUNT_CODES.inventory}>${PT_ACCOUNT_CODES.bank}`), codes.join(' | '));
  assert.ok(codes.includes(`${PT_ACCOUNT_CODES.costOfGoods}>${PT_ACCOUNT_CODES.inventory}`), codes.join(' | '));
  // buku perpetual = 1.000.000 + 550.000 - 200.000 = 1.350.000; opname 1.100.000 → koreksi turun 250.000
  const koreksi = result.groups.filter((group) => group.memo === 'Koreksi turun nilai persediaan');
  assert.equal(koreksi.length, 1);
  assert.equal(koreksi[0].amount, 250_000);
  const journal = buildAggregateEntry({ periodKey: '2026-08', entityId: ENTITY_ID_PT, date: '2026-08-31', groups: result.groups, actor: 'Langgo (DEVELOPER)' });
  assert.equal(entryTotals(journal).balanced, true);
  assert.deepEqual(entryProblems(journal, coa, registry(), []), []);
  assert.equal(balanceOf([journal], coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.bank), 3_450_000);
  assert.equal(balanceOf([journal], coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.inventory), 100_000);
  assert.equal(balanceOf([journal], coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.costOfGoods), 450_000);
});

check('opname belum diisi → bulan tetap boleh dicatat dengan catatan, bukan angka taksiran', () => {
  const result = aggregateMonth({
    periodKey: '2026-06',
    entity: perorangan,
    sales: juneSales,
    stock: juneStock,
    shifts: juneShifts,
    mode: 'PERIODIK',
    priorInventoryBalance: 0,
    countedInventory: null,
  });
  assert.ok(result.notes.some((text) => /belum diisi/.test(text)), result.notes.join(' | '));
  assert.equal(result.groups.some((group) => group.debitCode === LEGACY_ACCOUNT_CODES.inventory || group.creditCode === LEGACY_ACCOUNT_CODES.inventory), false);
});

check('bulan di luar periode entitas tidak menghasilkan jurnal', () => {
  const result = aggregateMonth({
    periodKey: '2026-07',
    entity: perorangan,
    sales: [{ id: 'trx_x', date: '2026-07-10', total: 1_000_000, paymentMethods: { cash: 1_000_000 } }],
    stock: [],
    shifts: [],
    mode: 'PERIODIK',
    priorInventoryBalance: 0,
    countedInventory: 0,
  });
  assert.equal(result.groups.length, 0);
  assert.match(result.notes.join(' '), /tidak jatuh pada periode/);
  const empty = buildAggregateEntry({ periodKey: '2026-07', entityId: ENTITY_ID_PERORANGAN, date: '2026-06-30', groups: result.groups, actor: 'x' });
  assert.equal(empty.lines.length, 0);
  assert.equal(canPostEntry(empty, coa, registry(), []).ok, false);
});

check('rentang bulan & bulan berisi data terukur dari transaksi', () => {
  assert.deepEqual(monthKeysBetween('2026-05-31', '2026-07-02'), ['2026-05', '2026-06', '2026-07']);
  assert.equal(monthStartOf('2026-02'), '2026-02-01');
  assert.equal(monthEndOf('2026-02'), '2026-02-28');
  assert.equal(monthEndOf('2024-02'), '2024-02-29');
  assert.equal(monthEndOf('2026-12'), '2026-12-31');
  assert.deepEqual(monthsWithData({ sales: juneSales, stock: juneStock, shifts: juneShifts, from: '2026-01-01', to: '2026-12-31' }), ['2026-01', '2026-06']);
  assert.equal(money('1.234'), 1);
  assert.equal(money(1_000_500.4), 1_000_500);
});

console.log('\n[11] Laporan keuangan dibaca dari jurnal (butir 8-9)');

const ptJournal = (
  date: string,
  ref: string,
  lines: { code: string; debit?: number; credit?: number }[],
  status: 'POSTED' | 'DRAF' = 'POSTED',
  source: 'SALDO_AWAL' | 'AGREGAT_BULANAN' | 'MANUAL' = 'MANUAL'
): JournalEntry =>
  normalizeJournalEntry({
    id: `jr_${ref}`,
    entityId: ENTITY_ID_PT,
    date,
    ref,
    description: ref,
    source,
    status,
    lines,
    createdBy: 'Andi (ADMIN)',
    createdAt: 1,
  });

const JULY = { from: '2026-07-01', to: '2026-07-31' };
const YEAR_2026 = { from: '2026-01-01', to: '2026-12-31' };

/** Buku PT Juli 2026: saldo awal, penjualan, beban, beli mesin, pinjaman, dividen. */
const ptJuly = (): JournalEntry[] => [
  ptJournal('2026-07-01', 'SA-01', [
    { code: PT_ACCOUNT_CODES.cashOnHand, debit: 50_000_000 },
    { code: PT_ACCOUNT_CODES.capital, credit: 50_000_000 },
  ], 'POSTED', 'SALDO_AWAL'),
  ptJournal('2026-07-31', 'MJ-001', [
    { code: PT_ACCOUNT_CODES.cashOnHand, debit: 10_000_000 },
    { code: PT_ACCOUNT_CODES.sales, credit: 10_000_000 },
  ]),
  ptJournal('2026-07-31', 'MJ-002', [
    { code: PT_ACCOUNT_CODES.operatingExpense, debit: 3_000_000 },
    { code: PT_ACCOUNT_CODES.cashOnHand, credit: 3_000_000 },
  ]),
  ptJournal('2026-07-31', 'MJ-003', [
    { code: PT_ACCOUNT_CODES.equipment, debit: 5_000_000 },
    { code: PT_ACCOUNT_CODES.cashOnHand, credit: 5_000_000 },
  ]),
  ptJournal('2026-07-31', 'MJ-004', [
    { code: PT_ACCOUNT_CODES.cashOnHand, debit: 4_000_000 },
    { code: PT_ACCOUNT_CODES.shareholderLoan, credit: 4_000_000 },
  ]),
  ptJournal('2026-07-31', 'MJ-005', [
    { code: PT_ACCOUNT_CODES.dividends, debit: 1_000_000 },
    { code: PT_ACCOUNT_CODES.cashOnHand, credit: 1_000_000 },
  ]),
  // pindah kas ke rekening PT sendiri: angkanya benar, tapi kelompok arus kasnya tidak terukur
  ptJournal('2026-07-31', 'MJ-006', [
    { code: PT_ACCOUNT_CODES.bank, debit: 500_000 },
    { code: PT_ACCOUNT_CODES.cashOnHand, credit: 500_000 },
  ]),
  ptJournal('2026-07-31', 'MJ-BELUM', [
    { code: PT_ACCOUNT_CODES.bank, debit: 9_000_000 },
    { code: PT_ACCOUNT_CODES.sales, credit: 9_000_000 },
  ], 'DRAF'),
];

const juneJournal = (): JournalEntry[] => {
  const result = aggregateMonth({
    periodKey: '2026-06',
    entity: perorangan,
    sales: juneSales,
    stock: juneStock,
    shifts: juneShifts,
    mode: 'PERIODIK',
    priorInventoryBalance: 0,
    countedInventory: 300_000,
  });
  return [
    buildAggregateEntry({
      periodKey: '2026-06',
      entityId: ENTITY_ID_PERORANGAN,
      date: '2026-06-30',
      groups: result.groups,
      actor: 'Andi (ADMIN)',
    }),
  ];
};

const reports = (...groups: JournalEntry[][]) => groups.flat();
const book = () => reports(ptJuly(), juneJournal());

check('laba rugi: pendapatan neto dikurangi beban, draf tidak ikut', () => {
  const statement = buildIncomeStatement(ptJuly(), coa, pt, JULY);
  assert.equal(statement.totalRevenue, 10_000_000);
  assert.equal(statement.revenues.length, 1);
  assert.equal(statement.revenues[0].code, PT_ACCOUNT_CODES.sales);
  assert.equal(statement.totalExpense, 3_000_000);
  assert.equal(statement.expenses[0].amount, 3_000_000);
  assert.equal(statement.netResult, 7_000_000);
  assert.equal(statement.journalCount, 7);
  // draf dilaporkan ada supaya operator tahu laporan belum lengkap, bukan diam-diam
  assert.equal(statement.draftCount, 1);
});

check('neraca: aset = utang + modal, dividen mengurangi modal apa adanya', () => {
  const sheet = buildBalanceSheet(ptJuly(), coa, pt, '2026-07-31');
  assert.equal(sheet.totalAssets, 60_000_000);
  assert.equal(sheet.assets.find((row) => row.code === PT_ACCOUNT_CODES.cashOnHand)?.amount, 54_500_000);
  assert.equal(sheet.assets.find((row) => row.code === PT_ACCOUNT_CODES.bank)?.amount, 500_000);
  assert.equal(sheet.totalLiabilities, 4_000_000);
  assert.equal(sheet.equity.find((row) => row.code === PT_ACCOUNT_CODES.capital)?.amount, 50_000_000);
  assert.equal(sheet.equity.find((row) => row.code === PT_ACCOUNT_CODES.dividends)?.amount, -1_000_000);
  assert.equal(sheet.currentEarnings, 7_000_000);
  assert.equal(sheet.totalEquity, 56_000_000);
  assert.equal(sheet.difference, 0);
  assert.equal(sheet.balanced, true);
  assert.deepEqual(sheet.problems, []);
});

check('akun lawan tidak menambah bagian yang salah', () => {
  const entries = [
    ptJournal('2026-07-01', 'SA-02', [
      { code: PT_ACCOUNT_CODES.equipment, debit: 20_000_000 },
      { code: PT_ACCOUNT_CODES.cashOnHand, debit: 5_000_000 },
      { code: PT_ACCOUNT_CODES.accumulatedDepreciation, credit: 5_000_000 },
      { code: PT_ACCOUNT_CODES.capital, credit: 20_000_000 },
    ], 'POSTED', 'SALDO_AWAL'),
    ptJournal('2026-07-20', 'MJ-010', [
      { code: PT_ACCOUNT_CODES.dividends, debit: 2_000_000 },
      { code: PT_ACCOUNT_CODES.cashOnHand, credit: 2_000_000 },
    ]),
  ];
  const sheet = buildBalanceSheet(entries, coa, pt, '2026-07-31');
  // akumulasi penyusutan mengurangi aset, dividen mengurangi modal — bukan sebaliknya
  assert.equal(sheet.assets.find((row) => row.code === PT_ACCOUNT_CODES.accumulatedDepreciation)?.amount, -5_000_000);
  assert.equal(sheet.equity.find((row) => row.code === PT_ACCOUNT_CODES.dividends)?.amount, -2_000_000);
  assert.equal(sheet.totalAssets, 18_000_000);
  assert.equal(sheet.totalEquity, 18_000_000);
  assert.equal(sheet.difference, 0);
  assert.equal(buildTrialBalance(entries, coa, ENTITY_ID_PT).balanced, true);
});

check('perubahan modal: awal + setoran - dividen + laba = akhir', () => {
  const equity = buildEquityStatement(ptJuly(), coa, pt, JULY);
  assert.equal(equity.opening, 0);
  assert.equal(equity.additions.length, 1);
  assert.equal(equity.additions[0].amount, 50_000_000);
  assert.equal(equity.withdrawals.length, 1);
  assert.equal(equity.withdrawals[0].name, 'Dividen');
  assert.equal(equity.withdrawals[0].amount, 1_000_000);
  assert.equal(equity.netResult, 7_000_000);
  assert.equal(equity.closing, 56_000_000);
  assert.equal(equity.difference, 0);
  assert.equal(equity.balanced, true);
});

check('arus kas: kelompok dari akun lawan dan jumlah bagian = perubahan kas', () => {
  const flow = buildCashFlow(ptJuly(), coa, pt, JULY);
  const total = (key: string) => flow.sections.find((section) => section.key === key)?.total ?? 0;
  assert.equal(total('OPERASI'), 7_000_000);
  assert.equal(total('INVESTASI'), -5_000_000);
  assert.equal(total('PENDANAAN'), 53_000_000);
  assert.equal(flow.netChange, 55_000_000);
  assert.equal(flow.sections.reduce((sum, section) => sum + section.total, 0), flow.netChange);
  assert.equal(flow.endingCash, 55_000_000);
  // jurnal kas-ke-kas tidak boleh diklaim masuk kelompok tertentu
  assert.equal(flow.problems.length, 1, flow.problems.join(' | '));
  assert.match(flow.problems[0], /MJ-006/);
  assert.ok(flow.basis.includes('akun lawan'), flow.basis);
});

check('buku besar: saldo awal periode dihitung dari jurnal sebelum periode', () => {
  const juli = buildAccountLedger(ptJuly(), coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.cashOnHand, JULY);
  assert.equal(juli.account?.name, 'Kas PT');
  assert.equal(juli.openingBalance, 0);
  assert.equal(juli.rows.length, 7);
  assert.equal(juli.balance, 54_500_000);
  const agustus = buildAccountLedger(ptJuly(), coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.cashOnHand, {
    from: '2026-08-01',
    to: '2026-08-31',
  });
  assert.equal(agustus.openingBalance, 54_500_000);
  assert.equal(agustus.rows.length, 0);
  assert.equal(agustus.balance, 54_500_000);
  // neraca saldo tetap seimbang walau ada akun saldo kredit
  const trial = buildTrialBalance(ptJuly(), coa, ENTITY_ID_PT);
  assert.equal(trial.balanced, true);
  assert.equal(trial.totalDebit, trial.totalCredit);
});

check('penyaring jurnal: entitas, status, dan akun', () => {
  const all = filterEntries(ptJuly(), { entityId: ENTITY_ID_PT, period: JULY, status: 'SEMUA' });
  assert.equal(all.length, 8);
  assert.equal(filterEntries(ptJuly(), { entityId: ENTITY_ID_PT, period: JULY, status: 'TERCATAT' }).length, 7);
  assert.equal(filterEntries(ptJuly(), { entityId: ENTITY_ID_PT, period: JULY, status: 'DRAF' }).length, 1);
  assert.equal(filterEntries(ptJuly(), { entityId: ENTITY_ID_PT, period: JULY, code: PT_ACCOUNT_CODES.cashOnHand }).length, 7);
  assert.equal(filterEntries(ptJuly(), { entityId: ENTITY_ID_PT, period: JULY, code: PT_ACCOUNT_CODES.bank }).length, 2);
  assert.equal(filterEntries(ptJuly(), { entityId: ENTITY_ID_PERORANGAN, period: JULY }).length, 0);
});

check('gabungan internal: kolom Pra-PT dan Pasca-PT menjumlah jadi satu angka', () => {
  const combined = buildCombinedStatement(book(), coa, registry(), YEAR_2026);
  assert.equal(combined.splitDate, DEFAULT_TRANSITION_DATE);
  assert.equal(combined.pra?.totalRevenue, 3_000_000);
  assert.equal(combined.pra?.totalExpense, 350_000);
  assert.equal(combined.pra?.netResult, 2_650_000);
  assert.equal(combined.pasca?.totalRevenue, 10_000_000);
  assert.equal(combined.totalRevenue, 13_000_000);
  assert.equal(combined.totalExpense, 3_350_000);
  assert.equal(combined.netResult, 9_650_000);
  assert.equal(combined.warning, GABUNGAN_WARNING);
  assert.deepEqual(combined.notes, []);
  // peringatan bukan laporan resmi / bukan dasar pajak harus ada isinya, bukan judul kosong
  assert.match(GABUNGAN_WARNING, /bukan laporan resmi/i);
  assert.match(GABUNGAN_WARNING, /bukan dasar pelaporan pajak/i);
  // kalimatnya pendek: satu kalimat tidak boleh melewati batas teks pemilik
  assert.ok(GABUNGAN_WARNING.length <= 130, `peringatan gabungan ${GABUNGAN_WARNING.length} karakter`);
});

check('periode yang tidak menyentuh satu era tidak menampilkan kolom kosong', () => {
  const cumaSesudah = buildCombinedStatement(book(), coa, registry(), { from: '2026-08-01', to: '2026-12-31' });
  assert.equal(cumaSesudah.pra, null);
  assert.ok(!cumaSesudah.notes.join(' ').includes('Pra-PT'), cumaSesudah.notes.join(' | '));
  assert.equal(cumaSesudah.pasca?.journalCount, 0);
  const cumaSebelum = buildCombinedStatement(book(), coa, registry(), { from: '2026-01-01', to: '2026-06-30' });
  assert.equal(cumaSebelum.pasca, null);
  assert.ok(!cumaSebelum.notes.join(' ').includes('Pasca-PT'), cumaSebelum.notes.join(' | '));
  assert.equal(cumaSebelum.pra?.totalRevenue, 3_000_000);
  // era yang memang masuk periode tapi belum direkap → arahannya jelas
  const belum = buildCombinedStatement(book(), coa, registry(), { from: '2026-01-01', to: '2026-05-31' });
  assert.match(belum.notes.join(' '), /rekap bulanan/);
});

check('laporan resmi PT menolak tanggal perorangan dan identitas yang belum diisi', () => {
  const setahun = ptReportScope(registry(), YEAR_2026);
  assert.equal(setahun.ok, false);
  assert.match(setahun.problems.join(' '), new RegExp(`Laporan resmi PT hanya mulai ${DEFAULT_TRANSITION_DATE}`));
  const resmi = ptReportScope(registry(), { from: DEFAULT_TRANSITION_DATE, to: '2026-12-31' });
  assert.equal(resmi.ok, true, resmi.problems.join(' | '));
  // registry bawaan tidak mengarang nama perusahaan, jadi kop resmi belum lengkap
  assert.equal(resmi.warnings.length, 3, resmi.warnings.join(' | '));
  assert.match(resmi.warnings.join(' '), /Nama PT sesuai dokumen hukum belum diisi/);
  assert.match(resmi.warnings.join(' '), /NPWP PT belum diisi/);
  assert.match(resmi.warnings.join(' '), /Nomor akta pendirian belum diisi/);
  const filled: EntityRegistry = {
    ...registry(),
    entities: registry().entities.map((item) =>
      item.id === ENTITY_ID_PT
        ? { ...item, legalName: 'PT Tiga Sekawan Digital', npwp: '01.234.567.8-001.000', legalDocNumber: 'AHU-0012345' }
        : item
    ),
  };
  const complete = ptReportScope(filled, { from: DEFAULT_TRANSITION_DATE, to: '2026-12-31' });
  assert.deepEqual(complete.warnings, []);
});

check('indikator dashboard membaca tiga kolom dari jurnal yang sama', () => {
  const strip = buildPeriodIndicators(book(), coa, registry(), YEAR_2026);
  assert.equal(strip.pra?.revenue, 3_000_000);
  assert.equal(strip.pra?.journals, 1);
  assert.equal(strip.pasca?.revenue, 10_000_000);
  assert.equal(strip.pasca?.journals, 7);
  assert.equal(strip.gabungan.revenue, 13_000_000);
  assert.equal(strip.gabungan.netResult, 9_650_000);
  assert.equal(strip.gabungan.journals, 8);
});

check('neraca saldo periode: saldo awal, mutasi, saldo akhir pada kolom yang benar', () => {
  const trial = buildPeriodTrialBalance(ptJuly(), coa, pt, JULY);
  // buku PT baru dimulai 1 Juli, jadi saldo awal periode Juli kosong
  assert.equal(trial.totalOpeningDebit, 0);
  assert.equal(trial.totalOpeningCredit, 0);
  assert.equal(trial.totalDebit, 73_500_000);
  assert.equal(trial.totalCredit, 73_500_000);
  assert.equal(trial.totalClosingDebit, 64_000_000);
  assert.equal(trial.totalClosingCredit, 64_000_000);
  assert.equal(trial.balanced, true);
  const rowOf = (code: string) => trial.rows.find((row) => row.code === code);
  assert.equal(rowOf(PT_ACCOUNT_CODES.cashOnHand)?.closing, 54_500_000);
  assert.equal(rowOf(PT_ACCOUNT_CODES.cashOnHand)?.debitColumn, 54_500_000);
  assert.equal(rowOf(PT_ACCOUNT_CODES.cashOnHand)?.creditColumn, 0);
  // draf MJ-BELUM (bank 9 juta) tidak boleh ikut mutasi maupun saldo akhir
  assert.equal(rowOf(PT_ACCOUNT_CODES.bank)?.debit, 500_000);
  assert.equal(rowOf(PT_ACCOUNT_CODES.bank)?.closing, 500_000);
  assert.equal(rowOf(PT_ACCOUNT_CODES.sales)?.closing, 10_000_000);
  // dividen punya arah debit: mengurangi modal tetapi tetap tampil di kolom debit
  assert.equal(rowOf(PT_ACCOUNT_CODES.dividends)?.debitColumn, 1_000_000);
  assert.equal(rowOf(PT_ACCOUNT_CODES.dividends)?.creditColumn, 0);
  assert.equal(rowOf(PT_ACCOUNT_CODES.capital)?.creditColumn, 50_000_000);
});

check('neraca saldo bulan berikutnya memakai saldo akhir bulan lalu sebagai saldo awal', () => {
  const agustus = buildPeriodTrialBalance(book(), coa, pt, { from: '2026-08-01', to: '2026-08-31' });
  assert.equal(agustus.totalDebit, 0);
  assert.equal(agustus.totalCredit, 0);
  assert.equal(agustus.totalOpeningDebit, 64_000_000);
  assert.equal(agustus.totalOpeningCredit, 64_000_000);
  assert.equal(agustus.totalClosingDebit, 64_000_000);
  assert.equal(agustus.balanced, true);
});

check('kolom debit/kredit menilai akun lawan pada sisi yang menguranginya', () => {
  // akumulasi penyusutan & dividen: saldo normalnya berlawanan, jadi negatif
  assert.equal(debitColumn(-5_000_000, 'KREDIT'), 5_000_000);
  assert.equal(creditColumn(-5_000_000, 'KREDIT'), 0);
  assert.equal(debitColumn(1_000_000, 'DEBIT'), 1_000_000);
  assert.equal(creditColumn(1_000_000, 'DEBIT'), 0);
  assert.equal(debitColumn(-1_000_000, 'DEBIT'), 0);
  assert.equal(creditColumn(-1_000_000, 'DEBIT'), 1_000_000);
});

console.log('\n[12] Penjaga kemurnian & pemasangan layar');

check('modul aturan tidak menyentuh koneksi server (penjaga jalan di Node)', () => {
  for (const file of [
    'src/utils/entityRegistry.ts',
    'src/utils/accountChart.ts',
    'src/utils/ledgerMath.ts',
    'src/utils/ledgerAggregates.ts',
    'src/utils/transitionMath.ts',
    'src/utils/ledgerReports.ts',
    'src/utils/entityTaxConfig.ts',
    'src/utils/ledgerReportDocument.ts',
  ]) {
    const source = read(file);
    assert.ok(!source.includes('pocketbaseBackend'), `${file} tidak boleh memanggil server`);
    assert.ok(!/from '\.\.\/backend\//.test(source), `${file} tidak boleh mengimpor modul koneksi server`);
  }
  // penataan dokumen harus tetap bisa dijalankan penjaga di Node: tanpa pustaka cetak
  const doc = read('src/utils/ledgerReportDocument.ts');
  assert.ok(!/jspdf|xlsx/.test(doc), 'penataan dokumen laporan ikut memuat pustaka cetak');
});

check('tanggal buku kunci hanya hidup di satu berkas aturan', () => {
  const hits = filesWriting(/2026-07-01|2022-01-01/, ['src/utils/entityRegistry.ts']);
  assert.deepEqual(hits, [], `tanggal transisi/awal buku ditulis ulang di ${hits.join(', ')}`);
});

check('jurnal yang sudah tercatat tidak bisa ditimpa, kecuali rekap bulan yang sama', () => {
  const storage = read('src/utils/ledgerStorage.ts');
  assert.match(storage, /status === 'POSTED'/);
  assert.match(storage, /Jangan ditimpa/);
  assert.match(storage, /AGREGAT_BULANAN/);
});

check('wizard transisi terpasang sebagai menu Laporan Keuangan', () => {
  const screen = read('src/components/reports/LaporanKeuanganScreen.tsx');
  assert.match(screen, /key: 'transisi', label: 'Penutupan & Transisi'/);
  assert.match(screen, /TransitionWizardView/);
  assert.match(screen, /settings=\{draft\}/);
  const wizard = read('src/components/reports/TransitionWizardView.tsx');
  assert.match(wizard, /Saya sudah membaca jumlah di atas dan dokumen pendukungnya/);
  assert.match(wizard, /Tambahan Modal Disetor/);
  assert.match(wizard, /buildTransitionPlan|planOf/);
});

check('penutupan buku & perubahan transisi memakai nama yang login', () => {
  const storage = read('src/utils/entityStorage.ts');
  assert.match(storage, /closeBooksThrough = \(\s*dateKey: string \| null,\s*actor = ''/);
  assert.match(storage, /applyClosedThroughDate\(getEntityRegistry\(\), dateKey, actor\)/);
  const view = read('src/components/reports/EntitySettingsView.tsx');
  assert.match(view, /closeBooksThrough\(closingDraft, actorLabel\)/);
  assert.match(view, /closeBooksThrough\(null, actorLabel\)/);
  const actions = read('src/utils/transitionActions.ts');
  assert.match(actions, /closeBooksThrough\(pair\.closingDate, actor\)/);
  assert.match(actions, /saveLedgerEntry\(\{ \.\.\.draft, status: 'POSTED' \}, actor\)/);
});

check('neraca saldo, buku besar, jurnal umum, dan dua laporan era terpasang sebagai menu', () => {
  const screen = read('src/components/reports/LaporanKeuanganScreen.tsx');
  for (const pill of [
    "key: 'neraca_saldo', label: 'Neraca Saldo'",
    "key: 'buku_besar', label: 'Buku Besar'",
    "key: 'jurnal', label: 'Jurnal Umum'",
    "key: 'gabungan', label: 'Gabungan Internal'",
    "key: 'resmi', label: 'Laporan Resmi PT'",
  ]) {
    assert.ok(screen.includes(pill), `menu "${pill}" tidak terpasang`);
  }
  assert.match(screen, /import\('\.\/LedgerBooksView'\)/);
  assert.match(screen, /import\('\.\/LedgerReportsView'\)/);
  assert.match(screen, /<LedgerBooksView/);
  assert.match(screen, /<LedgerReportsView/);
  // seluruh menu laporan memakai periode yang sedang dipilih di layar
  assert.match(screen, /period=\{\{ from: fromDate, to: toDate \}\}/);
});

check('angka laporan hanya dari jurnal — baris karangan dari data toko dibuang', () => {
  const screen = read('src/components/reports/LaporanKeuanganScreen.tsx');
  assert.ok(!screen.includes('NeracaSaldoRow'), 'baris neraca saldo hasil hitungan toko masih terpasang');
  assert.ok(!screen.includes('value={0}'), 'masih ada angka arus kas yang ditulis sebagai nol');
  const books = read('src/components/reports/LedgerBooksView.tsx');
  for (const fn of ['buildPeriodTrialBalance', 'buildAccountLedger', 'filterEntries']) {
    assert.ok(books.includes(fn), `layar buku tidak memakai ${fn}`);
  }
  assert.match(books, /saveLedgerEntry\(/);
  assert.match(books, /Prive tidak tersedia untuk PT/);
  const reports = read('src/components/reports/LedgerReportsView.tsx');
  // peringatan gabungan datang dari mesin, bukan tulisan yang disalin per layar
  assert.match(reports, /\{combined\.warning\}/);
  assert.match(reports, /ptReportScope\(/);
  for (const fn of ['buildIncomeStatement', 'buildBalanceSheet', 'buildEquityStatement', 'buildCashFlow']) {
    assert.ok(reports.includes(fn), `laporan resmi tidak memakai ${fn}`);
  }
});

console.log('\n[13] Pajak dihitung terpisah per entitas (butir 11)');

check('bawaan isian pajak: perorangan mengutip konfigurasi, PT mulai tanpa tarif', () => {
  const op = defaultEntityTaxProfile('PERORANGAN');
  assert.equal(op.regime, 'PP55_OP');
  // tarif dibaca dari konfigurasi pajak aplikasi, bukan angka yang ditulis di kode
  assert.equal(op.finalRatePercent, TAX_CONFIG_2025.umkmPp55Rate * 100);
  assert.equal(op.exemptThreshold, TAX_CONFIG_2025.umkmExemptThresholdOp);
  const badan = defaultEntityTaxProfile('PT');
  assert.equal(badan.regime, 'BELUM_DISETTEL');
  assert.equal(badan.finalRatePercent, null);
  assert.equal(badan.corporateRatePercent, null);
  assert.equal(badan.exemptThreshold, 0);
});

check('isian pajak yang kosong tetap kosong, nilai ngawur dibuang', () => {
  const kosong = normalizeEntityTaxProfile({ regime: 'PP55_OP', finalRatePercent: null }, 'PT');
  assert.equal(kosong.finalRatePercent, null);
  const ngawur = normalizeEntityTaxProfile({ regime: 'PP55_OP', finalRatePercent: 150, exemptThreshold: -5 }, 'PT');
  // tarif tidak sah → kembali ke bawaan bentuk usaha; PT bawaannya tidak bertarif
  assert.equal(ngawur.finalRatePercent, null);
  // fasilitas hanya dipakai pada PPh Final
  assert.equal(ngawur.exemptThreshold, 0);
  const tanpaFasilitas = normalizeEntityTaxProfile(
    { regime: 'PP55_OP', finalRatePercent: 0.5, exemptThreshold: 0 },
    'PERORANGAN'
  );
  assert.equal(tanpaFasilitas.exemptThreshold, 0);
  const badan = normalizeEntityTaxProfile({ regime: 'BADAN', corporateRatePercent: 22 }, 'PT');
  assert.equal(badan.corporateRatePercent, 22);
  assert.equal(badan.finalRatePercent, null);
});

check('satu tahun yang memuat transisi terbagi dua periode pajak', () => {
  const periods = taxPeriodsForYear(registry(), 2026);
  assert.equal(periods.length, 2);
  assert.equal(periods[0].from, '2026-01-01');
  assert.equal(periods[0].to, '2026-06-30');
  assert.equal(periods[0].regime, 'PP55_OP');
  assert.equal(periods[0].finalRatePercent, TAX_CONFIG_2025.umkmPp55Rate * 100);
  assert.equal(periods[1].from, DEFAULT_TRANSITION_DATE);
  assert.equal(periods[1].to, '2026-12-31');
  assert.equal(periods[1].finalRatePercent, null);
  assert.ok(periods[1].problems.length > 0, 'PT tanpa tarif harus dilaporkan, bukan didiamkan');
  const sebelum = taxPeriodsForYear(registry(), 2025);
  assert.equal(sebelum.length, 1);
  assert.equal(sebelum[0].from, '2025-01-01');
  assert.equal(sebelum[0].to, '2025-12-31');
});

check('tarif billing dibaca dari entitas pemilik bulan, bukan ditulis di kode', () => {
  const reg = registry();
  const juni = billingTariffForMonth(reg, '2026-06');
  assert.equal(juni.percent, TAX_CONFIG_2025.umkmPp55Rate * 100);
  assert.equal(juni.note, '');
  const juli = billingTariffForMonth(reg, '2026-07');
  // PT belum memilih cara pajaknya → PPh Final tidak dihitung, dan alasannya ditulis
  assert.equal(juli.percent, 0);
  assert.match(juli.note, /belum disetel|tidak dihitung/);
  const luar = billingTariffForMonth(reg, '2020-05');
  assert.equal(luar.percent, TAX_CONFIG_2025.umkmPp55Rate * 100);
  assert.equal(billingTariffForMonth(reg, '2026/07').percent, TAX_CONFIG_2025.umkmPp55Rate * 100);
  assert.equal(taxPeriodOfMonth(reg, 'salah'), null);
});

check('kalimat pemisahan pajak menyebut dua era dan isian yang kurang', () => {
  const notes = taxSeparationNotes(registry(), 2026);
  assert.ok(notes.length >= 2, notes.join(' | '));
  assert.match(notes[0], /Pajak 2026 dihitung terpisah/);
  assert.match(notes[0], new RegExp(DEFAULT_TRANSITION_DATE));
  assert.ok(notes.slice(1).join(' ').match(/belum dipilih|belum diisi/), notes.join(' | '));
  const luar = taxSeparationNotes(registry(), 2019);
  assert.equal(luar.length, 1);
  assert.match(luar[0], /tidak dihitung/);
});

check('tarif yang berlaku mengikuti cara pajak yang dipilih entitas', () => {
  const reg = registry();
  const op = reg.entities.find((item) => item.kind === 'PERORANGAN');
  const pt = reg.entities.find((item) => item.kind === 'PT');
  assert.ok(op && pt, 'registry bawaan harus punya perorangan dan PT');
  assert.equal(appliedTaxRatePercent(op), TAX_CONFIG_2025.umkmPp55Rate * 100);
  // PT belum memilih cara → tidak ada tarif, bukan mewarisi tarif pemilik lama
  assert.equal(appliedTaxRatePercent(pt), null);
  const badanRegistry = normalizeEntityRegistry({
    ...reg,
    entities: reg.entities.map((item) =>
      item.kind === 'PT'
        ? {
            ...item,
            legalDocNumber: 'AHU-1',
            tax: normalizeEntityTaxProfile({ regime: 'BADAN', corporateRatePercent: 22 }, 'PT'),
          }
        : item
    ),
  });
  const badan = badanRegistry.entities.find((item) => item.kind === 'PT');
  assert.ok(badan);
  assert.equal(appliedTaxRatePercent(badan), 22);
});

check('penjaga entitas melaporkan isian pajak yang belum dipilih', () => {
  const problems = validateEntityRegistry(registry());
  assert.ok(problems.some((text) => /cara penghitungan pajaknya belum dipilih/.test(text)), problems.join(' | '));
  const disetel = normalizeEntityRegistry({
    ...registry(),
    entities: registry().entities.map((item) =>
      item.kind === 'PT'
        ? {
            ...item,
            legalDocNumber: 'AHU-1',
            tax: normalizeEntityTaxProfile({ regime: 'PP55_OP', finalRatePercent: 0.5 }, 'PT'),
          }
        : item
    ),
  });
  assert.deepEqual(validateEntityRegistry(disetel).filter((text) => /pajak/i.test(text)), []);
});

check('layar pajak membaca pemisahan dari aturan, tidak menulis tarif sendiri', () => {
  const settings = read('src/components/tax/TaxSettingsView.tsx');
  assert.match(settings, /taxPeriodsForYear\(entityRegistry, year\)/);
  assert.match(settings, /taxSeparationNotes\(entityRegistry, year\)/);
  assert.ok(!/tariffRatePercent:\s*0\.[0-9]/.test(settings), 'layar pajak menulis tarif sendiri');
  const billing = read('src/utils/taxBillingMath.ts');
  assert.match(billing, /DEFAULT_TARIFF_PERCENT = TAX_CONFIG_2025\.umkmPp55Rate \* 100/);
  assert.ok(!/:\s*0\.5;/.test(billing), 'mesin hitung memakai tarif 0,5 sebagai angka mentah');
  const storage = read('src/utils/taxStorage.ts');
  assert.match(storage, /billingTariffForMonth\(registry, `\$\{year\}-\$\{monthStr\}`\)/);
  assert.ok(!/tariffRatePercent: 0\.5/.test(storage), 'billing masih diisi tarif tetap');
  assert.match(storage, /taxRatePercent: tariffPercent/);
  assert.ok(!/taxRatePercent: 0\.[0-9]/.test(storage), 'SPT 1770 diisi tarif karangan, bukan tarif billing tahun itu');
  const editor = read('src/components/reports/EntitySettingsView.tsx');
  assert.match(editor, /TAX_REGIMES\.map/);
  assert.match(editor, /patch\.tax = draft\.tax/);
  assert.match(editor, /updateEntityProfile\(entity\.id, patch\)/);
});

console.log('\n[14] Berkas unduhan laporan (butir 14)');

const ptProfile = (): EntityProfile => registry().entities.find((item) => item.kind === 'PT')!;
const julyStatements = () => {
  const entity = ptProfile();
  const entries = book();
  return {
    entity,
    statements: {
      income: buildIncomeStatement(entries, coa, entity, JULY),
      sheet: buildBalanceSheet(entries, coa, entity, JULY.to),
      equity: buildEquityStatement(entries, coa, entity, JULY),
      flow: buildCashFlow(entries, coa, entity, JULY),
    },
  };
};

check('berkas laporan resmi membawa nama entitas, periode, tanggal cetak, dan mata uang', () => {
  const { entity, statements } = julyStatements();
  const doc = officialReportDocument(entity, JULY, statements, ptReportScope(registry(), JULY), {
    printedAt: '3 November 2026 10:00',
  });
  assert.equal(doc.entityName, entity.legalName);
  assert.equal(doc.printedAt, '3 November 2026 10:00');
  assert.equal(doc.currency, REPORT_CURRENCY);
  assert.match(doc.periodLabel, /^Periode .+ s\.d\. .+$/);
  assert.equal(doc.tables.length, 4);
  assert.ok(doc.status.length > 0, 'status laporan tidak boleh kosong');
  assert.match(doc.fileName, /^Laporan_Resmi_PT_2026-07-01_2026-07-31$/);
});

check('angka di berkas sama dengan angka laporan di layar', () => {
  const { entity, statements } = julyStatements();
  const doc = officialReportDocument(entity, JULY, statements, ptReportScope(registry(), JULY), {
    printedAt: 'x',
  });
  const incomeRows = doc.tables[0].rows;
  const labelled = (rows: (string | number)[][], label: string) =>
    rows.find((row) => row[1] === label)?.[2];
  assert.equal(labelled(incomeRows, 'Jumlah pendapatan'), statements.income.totalRevenue);
  assert.equal(labelled(incomeRows, 'Jumlah beban'), statements.income.totalExpense);
  assert.equal(labelled(incomeRows, 'Laba (rugi) berjalan'), statements.income.netResult);
  const balanceRows = doc.tables[2].rows;
  assert.ok(
    balanceRows.some((row) => row[1] === 'Jumlah aset' && row[2] === statements.sheet.totalAssets),
    'jumlah aset berkas berbeda dengan neraca di layar'
  );
  const flowRows = doc.tables[3].rows;
  assert.equal(flowRows[flowRows.length - 1][2], statements.flow.endingCash);
});

check('laporan resmi yang belum sah ditulis apa adanya pada status dan catatannya', () => {
  const { entity, statements } = julyStatements();
  const sah = officialReportDocument(entity, JULY, statements, ptReportScope(registry(), JULY), { printedAt: 'x' });
  assert.equal(sah.status, 'Laporan resmi PT — basis jurnal');
  const awal = { from: '2026-05-01', to: '2026-07-31' };
  const belum = officialReportDocument(entity, awal, statements, ptReportScope(registry(), awal), { printedAt: 'x' });
  assert.match(belum.status, /belum sah/);
  assert.ok(belum.notes.some((text) => /hanya mulai/.test(text)), belum.notes.join(' | '));
});

check('kop identitas menulis isian yang masih kosong sebagai belum diisi', () => {
  const kosong = entityIdentityLines(ptProfile());
  assert.ok(kosong.some((line) => /Alamat belum diisi/.test(line)), kosong.join(' | '));
  assert.ok(kosong.some((line) => /NPWP belum diisi/.test(line)), kosong.join(' | '));
  assert.ok(kosong.some((line) => /Nomor akta belum diisi/.test(line)), kosong.join(' | '));
  const lengkap = entityIdentityLines({
    ...ptProfile(),
    address: 'Jalan Merdeka 1',
    npwp: '12.345.678-9-012.345',
    legalDocNumber: 'AHU-1',
  });
  assert.deepEqual(lengkap, [
    'Perseroan Terbatas (PT)',
    'Jalan Merdeka 1',
    'NPWP 12.345.678-9-012.345',
    'Akta / SK: AHU-1',
  ]);
});

check('neraca saldo unduhan memakai kolom debit dan kredit yang sama dengan layar', () => {
  const trial = buildPeriodTrialBalance(book(), coa, ptProfile(), JULY);
  const doc = trialBalanceDocument(trial, { printedAt: 'x' });
  const table = doc.tables[0];
  assert.deepEqual(table.columns, [
    'Kode',
    'Nama akun',
    'Awal debit',
    'Awal kredit',
    'Debit',
    'Kredit',
    'Akhir debit',
    'Akhir kredit',
  ]);
  const last = table.rows[table.rows.length - 1];
  assert.equal(last[6], trial.totalClosingDebit);
  assert.equal(last[7], trial.totalClosingCredit);
  assert.match(doc.status, trial.balanced ? /Seimbang/ : /Tidak seimbang/);
});

check('buku besar unduhan dimulai dari saldo awal dan berhenti di saldo akhir', () => {
  const ledgerData = buildAccountLedger(book(), coa, ENTITY_ID_PT, PT_ACCOUNT_CODES.cashOnHand, JULY);
  const doc = accountLedgerDocument(ledgerData, ptProfile().legalName, JULY, { printedAt: 'x' });
  const rows = doc.tables[0].rows;
  assert.equal(rows[0][5], ledgerData.openingBalance);
  assert.equal(rows[rows.length - 1][5], ledgerData.balance);
  const debit = rows.reduce((total, row) => total + (typeof row[3] === 'number' ? row[3] : 0), 0);
  const credit = rows.reduce((total, row) => total + (typeof row[4] === 'number' ? row[4] : 0), 0);
  assert.equal(ledgerData.openingBalance + debit - credit, ledgerData.balance);
});

check('jurnal unduhan menandai draf, bukan menghapus barisnya', () => {
  const rows = filterEntries(book(), { period: JULY });
  const doc = journalDocument(rows, coa, ptProfile().legalName, JULY, { printedAt: 'x' });
  const table = doc.tables[0];
  assert.equal(table.rows.length, rows.reduce((total, item) => total + item.lines.length, 0));
  assert.ok(table.rows.some((row) => row.includes('Draf')), 'draf harus terbaca statusnya di berkas');
  assert.ok(doc.notes.some((text) => /draf/.test(text)), doc.notes.join(' | '));
});

check('dokumen gabungan memakai peringatan mesin sebagai statusnya', () => {
  const entries = book();
  const combined = buildCombinedStatement(entries, coa, registry(), YEAR_2026);
  const indicators = buildPeriodIndicators(entries, coa, registry(), YEAR_2026);
  const doc = combinedReportDocument(combined, indicators, { printedAt: 'x' });
  assert.equal(doc.status, GABUNGAN_WARNING);
  assert.match(doc.entityName, /Dagang Perorangan/);
  assert.match(doc.entityName, /Perseroan Terbatas/);
  assert.equal(doc.tables[0].rows.length, 3);
  assert.equal(doc.tables[0].rows[2][1], combined.totalRevenue);
  assert.ok(doc.tables.some((table) => table.heading === 'Total gabungan'));
  // periode Juli saja tidak boleh memunculkan kolom Pra-PT yang kosong
  const juli = combinedReportDocument(
    buildCombinedStatement(entries, coa, registry(), JULY),
    buildPeriodIndicators(entries, coa, registry(), JULY),
    { printedAt: 'x' }
  );
  assert.equal(juli.tables[0].rows.length, 2);
});

check('nama berkas unduhan bersih dari karakter yang ditolak sistem', () => {
  const name = safeFileName('Laporan/Resmi PT: Juli 2026 *final*? <versi>');
  assert.ok(!/[/\\?*:|"<>\s]/.test(name), name);
  assert.ok(name.length <= 80);
  assert.equal(safeFileName(''), '');
});

check('layar laporan memasang tombol unduh dan cetak hanya lewat satu modul', () => {
  const books = read('src/components/reports/LedgerBooksView.tsx');
  assert.equal((books.match(/<ReportExportBar/g) || []).length, 3, 'ketiga buku harus bisa diunduh');
  for (const fn of ['trialBalanceDocument', 'accountLedgerDocument', 'journalDocument']) {
    assert.ok(books.includes(fn), `buku tidak menyusun dokumennya sendiri (${fn})`);
  }
  const reports = read('src/components/reports/LedgerReportsView.tsx');
  assert.equal((reports.match(/<ReportExportBar/g) || []).length, 2);
  assert.ok(reports.includes('combinedReportDocument') && reports.includes('officialReportDocument'));
  for (const source of [books, reports]) {
    assert.ok(!/jspdf|xlsx/.test(source), 'layar memuat pustaka cetak sendiri');
  }
  const printer = read('src/utils/ledgerReportExport.ts');
  for (const fn of ['exportLedgerReportToPDF', 'exportLedgerReportToExcel', 'exportLedgerReportToCSV']) {
    assert.ok(printer.includes(fn), `berkas tidak menyediakan ${fn}`);
  }
  assert.match(printer, /formatRupiah/);
  assert.match(printer, /report\.fileName/);
});

console.log(`\n[ OK ] check-entity-ledger: ${passed} kasus lulus\n`);
