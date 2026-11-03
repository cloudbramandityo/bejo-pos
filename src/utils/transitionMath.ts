import {
  LEGACY_ACCOUNT_CODES,
  PT_ACCOUNT_CODES,
  isPersonalBankAccount,
  isPriveAccount,
  type Account,
  type AccountChart,
} from './accountChart';
import {
  formatEntityDateKey,
  toEntityDateKey,
  type EntityProfile,
} from './entityRegistry';
import { money, type JournalLine } from './ledgerMath';
import { purchaseValues, withdrawalValue, type SaleRow, type ShiftRow, type StockRow } from './ledgerAggregates';

/**
 * Perhitungan penutupan buku dan pemindahan saldo ke entitas baru.
 *
 * Dua hal dijaga di sini:
 *  1. Angka hanya berasal dari isian pembukuan atau hasil ukur data toko. Nilai
 *     yang tidak punya sumber ditandai dan harus diisi pemilik, tidak ditaksir.
 *  2. Yang masuk neraca awal PT hanyalah saldo yang memang dialihkan. Saldo
 *     pribadi (rekening pribadi, prive, modal pemilik lama) tidak ikut pindah,
 *     dan seluruh aset bersih tidak otomatis dianggap modal saham — modal saham
 *     diisi sesuai akta, sisanya menjadi Tambahan Modal Disetor atau Saldo Laba.
 */

export type FigureKind = 'ASET' | 'KEWAJIBAN' | 'MODAL';

export interface ClosingFigure {
  /** Kode akun pada entitas lama. */
  code: string;
  label: string;
  kind: FigureKind;
  normal: 'DEBIT' | 'KREDIT';
  /** Isi di Pengaturan Laporan Keuangan. */
  entered: number;
  /** Hasil ukur data toko; null bila aplikasi tidak punya sumbernya. */
  measured: number | null;
  /** Dasar angka, dibaca apa adanya di layar. */
  basis: string;
  /** Kode akun PT tujuan. '' berarti tidak dialihkan. */
  targetCode: string;
  /** Boleh dialihkan ke PT atau tidak (akun pribadi & modal lama: tidak). */
  transferable: boolean;
  reason?: string;
}

export interface MeasuredThroughDate {
  cash: number | null;
  inventory: number | null;
  receivable: number | null;
  basisCash: string;
  basisInventory: string;
  basisReceivable: string;
}

/**
 * Ukur nilai yang benar-benar tercatat di data toko sampai tanggal penutupan.
 * Hanya tiga hal yang bisa diukur dari aplikasi ini; selain itu tidak ada
 * sumber datanya dan itu ditulis apa adanya.
 */
export const measureThroughDate = (options: {
  sales: readonly SaleRow[];
  stock: readonly StockRow[];
  shifts: readonly ShiftRow[];
  throughDate: string;
}): MeasuredThroughDate => {
  const through = toEntityDateKey(options.throughDate);
  const inRange = (date: string): boolean => {
    const key = toEntityDateKey(date);
    return key !== '' && key <= through;
  };
  const sales = options.sales.filter((row) => inRange(row.date) && !cancelled(row));
  const stock = options.stock.filter((row) => inRange(row.date));
  const shifts = options.shifts.filter((row) => inRange(row.date));

  const received = sales.reduce(
    (sum, row) => sum + money(row.paymentMethods?.cash) + money(row.paymentMethods?.transfer) + money(row.paymentMethods?.qris),
    0
  );
  const bought = purchaseValues(stock);
  const expenses = shifts.reduce((sum, shift) => sum + money(shift.operationalExpenses), 0);
  const withdrawn = withdrawalValue(stock);
  const unpaid = sales.reduce((sum, row) => sum + Math.max(0, money(row.total) - money(row.paymentMethods?.cash) - money(row.paymentMethods?.transfer) - money(row.paymentMethods?.qris)), 0);

  return {
    cash: received - bought.total - expenses,
    inventory: bought.total - withdrawn,
    receivable: unpaid,
    basisCash: `Selisih penerimaan kasir/bank dikurangi pembelian dan beban shift yang tercatat sampai ${formatEntityDateKey(through)}`,
    basisInventory: `Pembelian barang dikurangi pengambilan agen yang tercatat sampai ${formatEntityDateKey(through)}`,
    basisReceivable: `Penjualan yang belum dibayar sampai ${formatEntityDateKey(through)}`,
  };
};

const cancelled = (row: SaleRow): boolean =>
  !!row.invoiceStatus && row.invoiceStatus.toUpperCase() === 'CANCELLED';

/**
 * Susun daftar saldo penutupan entitas lama beserta tujuan akunnya di PT.
 * Urutan daftar ini yang tampil di wizard, jadi satu tempat saja.
 */
export const closingFigures = (
  settings: {
    cashBalance: number;
    openingCash: number;
    closingInventory: number;
    accountsReceivable: number;
    accountsPayable: number;
    otherLiabilities: number;
    fixedAssets: number;
    openingCapital: number;
    ownerDrawings: number;
  },
  measured: MeasuredThroughDate,
  chart: AccountChart,
  oldEntity: EntityProfile,
  newEntity: EntityProfile
): ClosingFigure[] => {
  const owned = new Set(
    chart.accounts.filter((item) => item.entityId === oldEntity.id).map((item) => item.code)
  );
  const ptCodes = new Set(
    chart.accounts.filter((item) => item.entityId === newEntity.id).map((item) => item.code)
  );
  const label = (code: string, fallback: string): string => {
    const found = chart.accounts.find((item) => item.entityId === oldEntity.id && item.code === code);
    return found ? found.name : fallback;
  };

  const rows: ClosingFigure[] = [
    {
      code: LEGACY_ACCOUNT_CODES.cashOnHand,
      label: label(LEGACY_ACCOUNT_CODES.cashOnHand, 'Kas Toko'),
      kind: 'ASET',
      normal: 'DEBIT',
      entered: money(settings.cashBalance) || money(settings.openingCash),
      measured: measured.cash,
      basis: measured.basisCash,
      targetCode: ptCodes.has(PT_ACCOUNT_CODES.cashOnHand) ? PT_ACCOUNT_CODES.cashOnHand : '',
      transferable: true,
    },
    {
      code: LEGACY_ACCOUNT_CODES.personalBank,
      label: label(LEGACY_ACCOUNT_CODES.personalBank, 'Bank Pribadi Pemilik'),
      kind: 'ASET',
      normal: 'DEBIT',
      entered: 0,
      measured: null,
      basis: 'Rekening pribadi pemilik — aplikasi tidak menyimpan saldonya.',
      targetCode: '',
      transferable: false,
      reason: 'Rekening pribadi tidak dialihkan ke PT. Bila pemilik menyetor uang ke PT, catat sebagai setoran modal dengan buktinya.',
    },
    {
      code: LEGACY_ACCOUNT_CODES.inventory,
      label: label(LEGACY_ACCOUNT_CODES.inventory, 'Persediaan Barang'),
      kind: 'ASET',
      normal: 'DEBIT',
      entered: money(settings.closingInventory),
      measured: measured.inventory,
      basis: measured.basisInventory,
      targetCode: ptCodes.has(PT_ACCOUNT_CODES.inventory) ? PT_ACCOUNT_CODES.inventory : '',
      transferable: true,
    },
    {
      code: LEGACY_ACCOUNT_CODES.receivable,
      label: label(LEGACY_ACCOUNT_CODES.receivable, 'Piutang Usaha'),
      kind: 'ASET',
      normal: 'DEBIT',
      entered: money(settings.accountsReceivable),
      measured: measured.receivable,
      basis: measured.basisReceivable,
      targetCode: ptCodes.has(PT_ACCOUNT_CODES.receivable) ? PT_ACCOUNT_CODES.receivable : '',
      transferable: true,
    },
    {
      code: LEGACY_ACCOUNT_CODES.equipment,
      label: label(LEGACY_ACCOUNT_CODES.equipment, 'Peralatan & Mesin'),
      kind: 'ASET',
      normal: 'DEBIT',
      entered: money(settings.fixedAssets),
      measured: null,
      basis: 'Harga perolehan aset tetap — diisi dari daftar aset toko, bukan dari stok harian.',
      targetCode: ptCodes.has(PT_ACCOUNT_CODES.equipment) ? PT_ACCOUNT_CODES.equipment : '',
      transferable: true,
    },
    {
      code: LEGACY_ACCOUNT_CODES.accumulatedDepreciation,
      label: label(LEGACY_ACCOUNT_CODES.accumulatedDepreciation, 'Akumulasi Penyusutan'),
      kind: 'ASET',
      normal: 'KREDIT',
      entered: 0,
      measured: null,
      basis: 'Akumulasi penyusutan — aplikasi belum menghitung penyusutan otomatis, jadi nilai ini diisi dari catatan penyusutan toko.',
      targetCode: ptCodes.has(PT_ACCOUNT_CODES.accumulatedDepreciation) ? PT_ACCOUNT_CODES.accumulatedDepreciation : '',
      transferable: true,
    },
    {
      code: LEGACY_ACCOUNT_CODES.accountsPayable,
      label: label(LEGACY_ACCOUNT_CODES.accountsPayable, 'Utang Usaha'),
      kind: 'KEWAJIBAN',
      normal: 'KREDIT',
      entered: money(settings.accountsPayable),
      measured: null,
      basis: 'Isian utang usaha di Pengaturan Laporan Keuangan.',
      targetCode: ptCodes.has(PT_ACCOUNT_CODES.accountsPayable) ? PT_ACCOUNT_CODES.accountsPayable : '',
      transferable: true,
    },
    {
      code: LEGACY_ACCOUNT_CODES.vatPayable,
      label: label(LEGACY_ACCOUNT_CODES.vatPayable, 'Utang PPN'),
      kind: 'KEWAJIBAN',
      normal: 'KREDIT',
      entered: 0,
      measured: null,
      basis: 'Pajak keluaran yang dipungut dan belum disetor.',
      targetCode: ptCodes.has(PT_ACCOUNT_CODES.vatPayable) ? PT_ACCOUNT_CODES.vatPayable : '',
      transferable: true,
    },
    {
      code: LEGACY_ACCOUNT_CODES.otherLiabilities,
      label: label(LEGACY_ACCOUNT_CODES.otherLiabilities, 'Utang Lain-lain'),
      kind: 'KEWAJIBAN',
      normal: 'KREDIT',
      entered: money(settings.otherLiabilities),
      measured: null,
      basis: 'Isian utang lain-lain di Pengaturan Laporan Keuangan.',
      targetCode: ptCodes.has(PT_ACCOUNT_CODES.otherLiabilities) ? PT_ACCOUNT_CODES.otherLiabilities : '',
      transferable: true,
    },
    {
      code: LEGACY_ACCOUNT_CODES.ownerLoan,
      label: label(LEGACY_ACCOUNT_CODES.ownerLoan, 'Utang kepada Pemilik'),
      kind: 'KEWAJIBAN',
      normal: 'KREDIT',
      entered: 0,
      measured: null,
      basis: 'Utang toko kepada pemilik — perlu dokumen pinjaman untuk dialihkan.',
      targetCode: ptCodes.has(PT_ACCOUNT_CODES.shareholderLoan) ? PT_ACCOUNT_CODES.shareholderLoan : '',
      transferable: true,
    },
    {
      code: LEGACY_ACCOUNT_CODES.capital,
      label: label(LEGACY_ACCOUNT_CODES.capital, 'Modal Pemilik'),
      kind: 'MODAL',
      normal: 'KREDIT',
      entered: money(settings.openingCapital),
      measured: null,
      basis: 'Modal usaha perorangan lama. Tidak dialihkan apa adanya: modal PT dibentuk dari akta pendirian.',
      targetCode: '',
      transferable: false,
      reason: 'Modal pemilik lama menjadi dasar perhitungan aset bersih, bukan akun PT. Isian Modal Saham diambil dari akta.',
    },
    {
      code: LEGACY_ACCOUNT_CODES.drawings,
      label: label(LEGACY_ACCOUNT_CODES.drawings, 'Prive Pemilik'),
      kind: 'MODAL',
      normal: 'DEBIT',
      entered: money(settings.ownerDrawings),
      measured: null,
      basis: 'Penarikan pemilik selama periode perorangan. Tidak dipindahkan ke PT.',
      targetCode: '',
      transferable: false,
      reason: 'Prive tidak berlaku untuk PT.',
    },
  ];

  return rows.filter((row) => owned.size === 0 || owned.has(row.code));
};

export interface AllocationChoice {
  code: string;
  transferred: number;
}

export interface TransitionPlan {
  /** Nilai yang benar-benar dialihkan, per akun tujuan. */
  lines: JournalLine[];
  totalAssets: number;
  totalLiabilities: number;
  netTransferred: number;
  shareCapital: number;
  additionalPaidIn: number;
  retainedEarnings: number;
  /** Selisih neraca awal; 0 berarti seimbang. */
  difference: number;
  balanced: boolean;
  problems: string[];
  warnings: string[];
}

/**
 * Susun neraca awal entitas baru dari saldo yang dialihkan.
 *
 * Modal saham memakai angka pemilik sesuai akta. Sisa aset bersih setelah modal
 * saham dan saldo laba yang diakui menjadi Tambahan Modal Disetor — jadi tidak
 * ada langkah "seluruh aset bersih = modal saham".
 */
export const buildTransitionPlan = (options: {
  figures: readonly ClosingFigure[];
  allocations: readonly AllocationChoice[];
  shareCapital: number;
  retainedEarnings: number;
  chart: AccountChart;
  oldEntity: EntityProfile;
  newEntity: EntityProfile;
}): TransitionPlan => {
  const byCode = new Map(
    options.allocations.map((item): [string, number] => [item.code, money(item.transferred)])
  );
  const problems: string[] = [];
  const warnings: string[] = [];
  const lines: JournalLine[] = [];

  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const figure of options.figures) {
    const transferred = money(byCode.get(figure.code));
    if (transferred === 0) continue;

    if (transferred < 0) {
      problems.push(`Nilai dialihkan ${figure.label} tidak boleh negatif (${transferred.toLocaleString('id-ID')}).`);
      continue;
    }
    if (!figure.transferable) {
      problems.push(`${figure.label}: ${figure.reason || 'saldo ini tidak dialihkan ke entitas baru.'}`);
      continue;
    }
    if (!figure.targetCode) {
      problems.push(`${figure.label}: akun tujuan di ${options.newEntity.legalName} belum ada di bagan akun.`);
      continue;
    }
    if (transferred > figure.entered && figure.entered > 0) {
      warnings.push(
        `${figure.label}: nilai dialihkan ${transferred.toLocaleString('id-ID')} lebih besar dari yang tercatat ${figure.entered.toLocaleString('id-ID')}.`
      );
    }
    const target = options.chart.accounts.find(
      (item) => item.entityId === options.newEntity.id && item.code === figure.targetCode
    );
    if (!target) {
      problems.push(`Akun tujuan ${figure.targetCode} (${figure.label}) tidak ditemukan pada ${options.newEntity.legalName}.`);
      continue;
    }
    if (isPersonalBankAccount(target)) {
      problems.push(`${figure.label}: tidak boleh dipindahkan ke rekening pribadi (${target.name}).`);
      continue;
    }
    if (isPriveAccount(target)) {
      problems.push(`${figure.label}: tidak boleh dipindahkan ke Prive — akun itu tidak berlaku untuk PT.`);
      continue;
    }

    if (figure.kind === 'ASET' && figure.normal === 'DEBIT') totalAssets += transferred;
    else if (figure.kind === 'ASET') totalLiabilities += transferred;
    else if (figure.kind === 'KEWAJIBAN') totalLiabilities += transferred;

    lines.push({
      code: figure.targetCode,
      debit: figure.normal === 'DEBIT' ? transferred : 0,
      credit: figure.normal === 'KREDIT' ? transferred : 0,
      memo: `Dialihkan dari ${options.oldEntity.legalName} (${figure.code})`,
    });
  }

  const transferredEquipment = money(byCode.get(LEGACY_ACCOUNT_CODES.equipment));
  const transferredDepreciation = money(byCode.get(LEGACY_ACCOUNT_CODES.accumulatedDepreciation));
  if (transferredDepreciation > transferredEquipment && transferredEquipment > 0) {
    problems.push(
      `Akumulasi penyusutan ${transferredDepreciation.toLocaleString('id-ID')} melebihi harga perolehan aset ${transferredEquipment.toLocaleString('id-ID')}. Nilai buku jadi negatif.`
    );
  }

  const shareCapital = money(options.shareCapital);
  const retainedEarnings = money(options.retainedEarnings);
  const netTransferred = totalAssets - totalLiabilities;
  const additionalPaidIn = netTransferred - shareCapital - retainedEarnings;

  if (netTransferred <= 0) {
    problems.push('Aset bersih yang dialihkan nol atau negatif. Tidak ada neraca awal yang bisa dibentuk.');
  }
  if (shareCapital <= 0 && netTransferred > 0) {
    warnings.push(
      `Modal saham belum diisi. Seluruh aset bersih ${netTransferred.toLocaleString('id-ID')} tercatat sebagai Tambahan Modal Disetor, bukan modal saham.`
    );
  }
  if (additionalPaidIn < 0) {
    problems.push(
      `Modal saham dan saldo laba (${(shareCapital + retainedEarnings).toLocaleString('id-ID')}) melebihi aset bersih yang dialihkan (${netTransferred.toLocaleString('id-ID')}). Periksa dokumen setoran.`
    );
  }

  const capitalCode = options.chart.accounts.find(
    (item) => item.entityId === options.newEntity.id && item.code === PT_ACCOUNT_CODES.capital
  )?.code;
  if (!capitalCode) problems.push(`${options.newEntity.legalName}: akun Modal Saham belum ada di bagan akun.`);
  const extraCode = options.chart.accounts.find(
    (item) => item.entityId === options.newEntity.id && item.code === PT_ACCOUNT_CODES.paidInCapitalExtra
  )?.code;
  const retainedCode = options.chart.accounts.find(
    (item) => item.entityId === options.newEntity.id && item.code === PT_ACCOUNT_CODES.retainedEarnings
  )?.code;

  if (capitalCode && shareCapital > 0) {
    lines.push({ code: capitalCode, debit: 0, credit: shareCapital, memo: `Sesuai akta ${options.newEntity.legalDocNumber || 'pendirian'}` });
  }
  if (extraCode && additionalPaidIn > 0) {
    lines.push({ code: extraCode, debit: 0, credit: additionalPaidIn, memo: 'Sisa aset bersih di atas modal saham' });
  }
  if (retainedCode && retainedEarnings > 0) {
    lines.push({ code: retainedCode, debit: 0, credit: retainedEarnings, memo: 'Laba yang diakui ikut ke PT' });
  }

  const debit = lines.reduce((sum, line) => sum + money(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + money(line.credit), 0);
  const difference = debit - credit;
  if (difference !== 0) {
    problems.push(`Neraca awal belum seimbang: selisih ${Math.abs(difference).toLocaleString('id-ID')}.`);
  }

  return {
    lines,
    totalAssets,
    totalLiabilities,
    netTransferred,
    shareCapital,
    additionalPaidIn: Math.max(0, additionalPaidIn),
    retainedEarnings,
    difference,
    balanced: difference === 0 && lines.length >= 2,
    problems,
    warnings,
  };
}

/** Angka simulasi pemilik (kas 50, persediaan 40, peralatan 20, akum. 5, utang 15, modal 90 juta). */
export const SIMULATION_FIGURES = {
  cash: 50_000_000,
  inventory: 40_000_000,
  equipment: 20_000_000,
  accumulatedDepreciation: 5_000_000,
  accountsPayable: 15_000_000,
  shareCapital: 90_000_000,
} as const;

/** Saldo awal beku per akun tujuan, untuk dipasang pada bagan akun entitas baru. */
export const openingBalancesFromPlan = (
  plan: TransitionPlan,
  chart: AccountChart,
  newEntityId: string
): Account[] =>
  chart.accounts
    .filter((item) => item.entityId === newEntityId)
    .map((item) => {
      const line = plan.lines.find((candidate) => candidate.code === item.code);
      if (!line) return item;
      return { ...item, openingBalance: money(line.debit) - money(line.credit) };
    });
