import { ENTITY_ID_PERORANGAN, ENTITY_ID_PT, type EntityRegistry } from './entityRegistry';

/**
 * Bagan akun per entitas.
 *
 * Aplikasi ini belum punya buku berpasangan, jadi bagan akun di bawah adalah
 * kode tetap untuk kelompok nilai yang selama ini sudah dihitung dari data toko
 * (kas, stok, piutang, utang, modal, prive, penjualan, harga kulak, beban).
 * Kode lama tidak berubah artinya, sehingga angka laporan lama tetap terbaca.
 *
 * Aturan yang ditegakkan di sini:
 * - akun yang sudah dipakai tidak bisa dihapus, hanya bisa diarsipkan;
 * - rekening pribadi diarsipkan sejak tanggal transisi, historinya tetap ada;
 * - Prive tidak bisa dipakai lagi oleh PT;
 * - jurnal sebuah tanggal hanya boleh memakai akun milik entitas tanggal itu.
 *
 * Berkas ini murni aturan, tanpa menggantung ke modul koneksi server.
 */

export type AccountType = 'ASET' | 'KEWAJIBAN' | 'MODAL' | 'PENDAPATAN' | 'BEBAN';
export type AccountNormal = 'DEBIT' | 'KREDIT';

export interface Account {
  /** Kode akun, mis. '1100'. Unik di dalam satu entitas. */
  code: string;
  name: string;
  type: AccountType;
  normal: AccountNormal;
  /** Entitas pemilik akun. */
  entityId: string;
  /** Arsip: tetap muncul di laporan histori, tidak boleh dipakai jurnal baru. */
  archived: boolean;
  /** Boleh dipakai pada jurnal baru. */
  postable: boolean;
  /** Saldo awal beku per entitas, hasil penutupan buku. */
  openingBalance?: number;
  /** Jalur data aplikasi yang mengisi akun ini (untuk penjelasan laporan). */
  source?: string;
}

export interface AccountChart {
  schemaVersion: '1';
  accounts: Account[];
}

export const STORAGE_KEY_ACCOUNT_CHART = 'bejo_account_chart_v1';
export const ACCOUNT_CHART_EVENT = 'bejo_account_chart_updated';

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  ASET: 'Aset',
  KEWAJIBAN: 'Utang',
  MODAL: 'Modal',
  PENDAPATAN: 'Pendapatan',
  BEBAN: 'Beban',
};

/** Perode lama: kode yang selama ini dipakai pembukuan perorangan toko. */
export const LEGACY_ACCOUNT_CODES = {
  cashOnHand: '1100',
  personalBank: '1110',
  inventory: '1200',
  receivable: '1300',
  equipment: '1500',
  accumulatedDepreciation: '1590',
  accountsPayable: '2100',
  vatPayable: '2150',
  otherLiabilities: '2190',
  ownerLoan: '2900',
  capital: '3100',
  drawings: '3200',
  sales: '4100',
  costOfGoods: '5100',
  operatingExpense: '6100',
} as const;

/** Kode baru milik PT, termasuk akun modal & dividen yang belum pernah ada. */
export const PT_ACCOUNT_CODES = {
  ...LEGACY_ACCOUNT_CODES,
  personalBank: '1111',
  cashOnHand: '1101',
  bank: '1102',
  retainedEarnings: '3300',
  dividends: '3400',
  dividendsPayable: '2200',
  shareholderLoan: '2300',
  paidInCapitalExtra: '3150',
  taxExpense: '8100',
  boardSalary: '6200',
} as const;

/** Rekening pribadi: tidak boleh jadi rekening operasional PT. */
export const PERSONAL_BANK_CODES: readonly string[] = [
  LEGACY_ACCOUNT_CODES.personalBank,
  '1115',
  '1116',
];

export const isPersonalBankAccount = (account: Account): boolean =>
  PERSONAL_BANK_CODES.includes(account.code) || /pribadi/i.test(account.name);

export const isPriveAccount = (account: Account): boolean =>
  account.code === LEGACY_ACCOUNT_CODES.drawings || /prive|penarikan pemilik/i.test(account.name);

const account = (
  entityId: string,
  code: string,
  name: string,
  type: AccountType,
  normal: AccountNormal,
  options: Partial<Account> = {}
): Account => ({
  code,
  name,
  type,
  normal,
  entityId,
  archived: false,
  postable: true,
  ...options,
});

/**
 * Bagan bawaan. Saldo awal diisi nol dulu: angka aslinya baru masuk setelah
 * wizard penutupan buku mengukur nilai aset toko — sistem tidak menaksir.
 */
export const defaultAccountChart = (): AccountChart => {
  const legacy: Account[] = [
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.cashOnHand, 'Kas Toko', 'ASET', 'DEBIT', { source: 'Shift kasir' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.personalBank, 'Bank Pribadi Pemilik', 'ASET', 'DEBIT', { source: 'Rekening pribadi' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.inventory, 'Persediaan Barang', 'ASET', 'DEBIT', { source: 'Stok masuk/keluar' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.receivable, 'Piutang Usaha', 'ASET', 'DEBIT', { source: 'Invoice belum lunas' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.equipment, 'Peralatan & Mesin', 'ASET', 'DEBIT', { source: 'Aset tetap toko' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.accumulatedDepreciation, 'Akumulasi Penyusutan', 'ASET', 'KREDIT'),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.accountsPayable, 'Utang Usaha', 'KEWAJIBAN', 'KREDIT', { source: 'Pembelian belum dibayar' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.vatPayable, 'Utang PPN', 'KEWAJIBAN', 'KREDIT', { source: 'Pajak keluaran transaksi' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.otherLiabilities, 'Utang Lain-lain', 'KEWAJIBAN', 'KREDIT', { source: 'Isian Laporan Keuangan' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.ownerLoan, 'Utang kepada Pemilik', 'KEWAJIBAN', 'KREDIT'),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.capital, 'Modal Pemilik', 'MODAL', 'KREDIT', { source: 'Isian Laporan Keuangan' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.drawings, 'Prive Pemilik', 'MODAL', 'DEBIT', { source: 'Isian Laporan Keuangan' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.sales, 'Penjualan', 'PENDAPATAN', 'KREDIT', { source: 'Transaksi kasir & invoice' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.costOfGoods, 'Harga Pokok Penjualan', 'BEBAN', 'DEBIT', { source: 'Harga kulak barang keluar' }),
    account(ENTITY_ID_PERORANGAN, LEGACY_ACCOUNT_CODES.operatingExpense, 'Beban Operasional', 'BEBAN', 'DEBIT', { source: 'Beban shift & isian manual' }),
  ];

  const pt: Account[] = [
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.cashOnHand, 'Kas PT', 'ASET', 'DEBIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.bank, 'Bank PT', 'ASET', 'DEBIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.inventory, 'Persediaan Barang', 'ASET', 'DEBIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.receivable, 'Piutang Usaha', 'ASET', 'DEBIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.equipment, 'Peralatan & Mesin', 'ASET', 'DEBIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.accumulatedDepreciation, 'Akumulasi Penyusutan', 'ASET', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.accountsPayable, 'Utang Usaha', 'KEWAJIBAN', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.vatPayable, 'Utang PPN', 'KEWAJIBAN', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.otherLiabilities, 'Utang Lain-lain', 'KEWAJIBAN', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.dividendsPayable, 'Utang Dividen', 'KEWAJIBAN', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.shareholderLoan, 'Utang kepada Pemegang Saham', 'KEWAJIBAN', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.capital, 'Modal Saham', 'MODAL', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.paidInCapitalExtra, 'Tambahan Modal Disetor', 'MODAL', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.retainedEarnings, 'Saldo Laba', 'MODAL', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.dividends, 'Dividen', 'MODAL', 'DEBIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.sales, 'Penjualan', 'PENDAPATAN', 'KREDIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.costOfGoods, 'Harga Pokok Penjualan', 'BEBAN', 'DEBIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.operatingExpense, 'Beban Operasional', 'BEBAN', 'DEBIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.boardSalary, 'Beban Gaji Direksi', 'BEBAN', 'DEBIT'),
    account(ENTITY_ID_PT, PT_ACCOUNT_CODES.taxExpense, 'Beban Pajak', 'BEBAN', 'DEBIT'),
  ];

  return normalizeAccountChart({ schemaVersion: '1', accounts: [...legacy, ...pt] });
};

const textOf = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const TYPES: readonly AccountType[] = ['ASET', 'KEWAJIBAN', 'MODAL', 'PENDAPATAN', 'BEBAN'];

/**
 * Bersihkan bagan akun. Akun arsip tidak pernah dibuang pembersihan ini:
 * historinya harus tetap bisa dibaca di laporan.
 */
export function normalizeAccountChart(raw: unknown): AccountChart {
  const source = (raw || {}) as Partial<AccountChart> & Record<string, unknown>;
  const incoming = Array.isArray(source.accounts) ? source.accounts : [];
  const seen = new Set<string>();
  const accounts: Account[] = [];
  for (const item of incoming) {
    const row = (item || {}) as Partial<Account> & Record<string, unknown>;
    const entityId = textOf(row.entityId);
    const code = textOf(row.code);
    if (!entityId || !code) continue;
    const dedupeKey = `${entityId}::${code}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const type = TYPES.includes(row.type as AccountType) ? (row.type as AccountType) : 'ASET';
    accounts.push({
      code,
      name: textOf(row.name, code),
      type,
      normal: row.normal === 'KREDIT' ? 'KREDIT' : 'DEBIT',
      entityId,
      archived: row.archived === true,
      postable: row.postable !== false,
      openingBalance: typeof row.openingBalance === 'number' && Number.isFinite(row.openingBalance)
        ? row.openingBalance
        : undefined,
      source: textOf(row.source) || undefined,
    });
  }
  accounts.sort((a, b) =>
    a.entityId === b.entityId ? (a.code < b.code ? -1 : 1) : a.entityId < b.entityId ? -1 : 1
  );
  return { schemaVersion: '1', accounts };
}

export const getAccountChart = (): AccountChart => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNT_CHART);
    if (raw) return normalizeAccountChart(JSON.parse(raw));
  } catch (error) {
    console.error('Gagal membaca bagan akun', error);
  }
  const fallback = defaultAccountChart();
  try {
    localStorage.setItem(STORAGE_KEY_ACCOUNT_CHART, JSON.stringify(fallback));
  } catch (error) {
    console.error('Gagal menyimpan bagan akun', error);
  }
  return fallback;
};

export const writeAccountChart = (chart: AccountChart | unknown): AccountChart => {
  const clean = normalizeAccountChart(chart);
  try {
    localStorage.setItem(STORAGE_KEY_ACCOUNT_CHART, JSON.stringify(clean));
  } catch (error) {
    console.error('Gagal menyimpan bagan akun', error);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<AccountChart>(ACCOUNT_CHART_EVENT, { detail: clean }));
  }
  return clean;
};

export const accountsForEntity = (chart: AccountChart, entityId: string): Account[] =>
  chart.accounts.filter((item) => item.entityId === entityId);

export const findAccount = (chart: AccountChart, entityId: string, code: string): Account | null =>
  chart.accounts.find((item) => item.entityId === entityId && item.code === code.trim()) || null;

/** Akun yang boleh ditawarkan pada form jurnal entitas itu. */
export const selectableAccounts = (chart: AccountChart, entityId: string): Account[] =>
  accountsForEntity(chart, entityId).filter((item) => !item.archived && item.postable);

/**
 * Arsipkan rekening pribadi saat buku lama ditutup. Histori dan kodenya tetap
 * ada di bagan, hanya tidak bisa dipakai jurnal baru.
 */
export const archivePersonalBankAccounts = (chart: AccountChart): AccountChart =>
  normalizeAccountChart({
    ...chart,
    accounts: chart.accounts.map((item) =>
      isPersonalBankAccount(item) ? { ...item, archived: true, postable: false } : item
    ),
  });

/** Prive ditutup untuk PT: pengambilan pemilik bukan lagi jalan keluar dana. */
export const disablePriveForPt = (chart: AccountChart): AccountChart =>
  normalizeAccountChart({
    ...chart,
    accounts: chart.accounts.map((item) =>
      item.entityId === ENTITY_ID_PT && isPriveAccount(item)
        ? { ...item, archived: true, postable: false }
        : item
    ),
  });

/** Terapkan aturan transisi pada bagan; aman dipanggil berulang kali. */
export const applyTransitionRules = (chart: AccountChart): AccountChart =>
  disablePriveForPt(archivePersonalBankAccounts(chart));

/**
 * Lengkapi akun bawaan yang belum ada di bagan perangkat ini.
 *
 * Bagan yang sudah terpasang tidak ditimpa: akun buatan operator dan saldo
 * awalnya tetap utuh, yang ditambah hanya kode bawaan yang belum pernah muncul.
 * Dipakai saat aturan standar bertambah (mis. Utang PPN ditambahkan karena
 * pajak keluaran harus punya tempat).
 */
export const ensureStandardAccounts = (chart: AccountChart): { chart: AccountChart; added: string[] } => {
  const known = new Set(chart.accounts.map((item) => `${item.entityId}::${item.code}`));
  const added: string[] = [];
  const extra: Account[] = [];
  for (const item of defaultAccountChart().accounts) {
    const key = `${item.entityId}::${item.code}`;
    if (known.has(key)) continue;
    known.add(key);
    extra.push(item);
    added.push(`${item.code} ${item.name}`);
  }
  return { chart: normalizeAccountChart({ ...chart, accounts: [...chart.accounts, ...extra] }), added };
};

/**
 * Akun dengan histori tidak boleh dihapus — hanya diarsipkan. `usage` jumlah
 * baris jurnal yang sudah memakai akun itu; hasil pengukuran, bukan taksiran.
 */
export const canDeleteAccount = (usage: number, hasOpeningBalance = false): boolean =>
  usage === 0 && !hasOpeningBalance;

/** Alasan penolakan penghapusan, dibaca operator apa adanya. */
export const deleteAccountBlockReason = (
  accountToDelete: Account,
  usage: number,
  hasOpeningBalance: boolean
): string => {
  if (usage > 0) {
    return `Akun ${accountToDelete.code} - ${accountToDelete.name} sudah dipakai ${usage} baris jurnal. Diarsipkan saja, jangan dihapus.`;
  }
  if (hasOpeningBalance) {
    return `Akun ${accountToDelete.code} - ${accountToDelete.name} punya saldo awal. Hapus saldo awalnya lebih dulu.`;
  }
  return '';
};

/**
 * Gerbang transaksi (butir 12): hanya akun milik entitas pada tanggal jurnal,
 * tidak diarsipkan, dan boleh dipakai. Rekening pribadi tidak pernah lolos
 * untuk tanggal PT.
 */
export const accountUsability = (
  chart: AccountChart,
  registry: EntityRegistry,
  entityId: string,
  code: string,
  dateKey: string
): { ok: boolean; reason: string } => {
  const found = findAccount(chart, entityId, code);
  if (!found) {
    return { ok: false, reason: `Akun ${code} tidak ada pada entitas ini. Pakai akun entitas yang benar.` };
  }
  if (found.archived || !found.postable) {
    return { ok: false, reason: `Akun ${found.code} - ${found.name} sudah diarsipkan dan tidak bisa dipakai jurnal baru.` };
  }
  if (isPersonalBankAccount(found) && dateKey >= registry.transitionDate) {
    return {
      ok: false,
      reason: `Rekening pribadi (${found.name}) tidak boleh dipakai sebagai rekening operasional PT.`,
    };
  }
  if (isPriveAccount(found) && entityId === ENTITY_ID_PT) {
    return { ok: false, reason: 'Prive tidak berlaku untuk PT. Gunakan dividen, gaji direksi, atau pinjaman pemegang saham.' };
  }
  return { ok: true, reason: '' };
};

/** Daftar masalah bagan akun; dipakai layar pemeriksaan sebelum posting. */
export const validateAccountChart = (chart: AccountChart, registry: EntityRegistry): string[] => {
  const problems: string[] = [];
  const knownEntities = new Set(registry.entities.map((entity) => entity.id));
  const counter = new Map<string, number>();
  for (const item of chart.accounts) {
    if (!knownEntities.has(item.entityId)) {
      problems.push(`Akun ${item.code} menunjuk entitas yang tidak dikenal (${item.entityId}).`);
    }
    const key = `${item.entityId}::${item.code}`;
    counter.set(key, (counter.get(key) || 0) + 1);
  }
  for (const [key, count] of counter) {
    if (count > 1) problems.push(`Kode akun rangkap pada satu entitas: ${key.split('::')[1]}.`);
  }
  for (const entity of registry.entities) {
    const owned = accountsForEntity(chart, entity.id);
    if (owned.length === 0) {
      problems.push(`${entity.legalName} belum punya akun sama sekali.`);
      continue;
    }
    const cash = owned.filter((item) => item.type === 'ASET' && !item.archived && /^11/.test(item.code));
    if (entity.active && cash.length === 0) {
      problems.push(`${entity.legalName}: belum ada akun kas/bank aktif.`);
    }
    if (entity.kind === 'PT') {
      const modal = owned.filter((item) => item.type === 'MODAL' && !item.archived);
      if (!modal.some((item) => /modal saham/i.test(item.name))) {
        problems.push(`${entity.legalName}: akun Modal Saham belum ada.`);
      }
      if (owned.some((item) => isPriveAccount(item) && !item.archived)) {
        problems.push(`${entity.legalName}: Prive masih aktif. Prive tidak berlaku untuk PT.`);
      }
      if (owned.some((item) => isPersonalBankAccount(item) && !item.archived)) {
        problems.push(`${entity.legalName}: rekening pribadi masih aktif. Arsipkan sejak tanggal transisi.`);
      }
    }
  }
  return problems;
};
