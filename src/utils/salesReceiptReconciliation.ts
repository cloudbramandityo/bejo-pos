/**
 * Aturan tunggal rekonsiliasi nomor struk penjualan yang tercatat dua kali.
 *
 * Gejala yang diperbaiki (run live 4.14.4, 2026-11-07): 639 record penjualan di
 * server, 317 nomor struk tercatat sebagai DUA record — satu `legacyId` berbentuk
 * "/" (versi lama sebelum scrub) dan satu "_" (versi setelah scrub). Bug id bentuk
 * itu sudah dihentikan, tetapi data lamanya tetap dihitung dua kali oleh laporan.
 *
 * Modul ini murni (hanya mengimpor pengenal nomor struk) supaya penjaga regresi
 * dapat menjalankannya di Node tanpa database. Semua keputusan destruktif
 * (hapus record kembar, beri nomor baru pada penjualan berbeda) disusun di sini
 * dan dicetak sebagai rencana; skrip hanya menjalankan rencana itu.
 */
import { parseReceiptId } from './formatters';
import { toStoredDocId } from './appRecordId';

/** Satu record penjualan sebagaimana dibaca dari server. */
export type ReceiptRecordInput = {
  /** id record PocketBase (bukan nomor struk). */
  recordId: string;
  /** Id aplikasi: cermin `data.id` lebih dulu, lalu `legacyId`, lalu id record. */
  appId: string;
  legacyId: string;
  mirrorId: string;
  hasMirror: boolean;
  createdAt: string;
  updated: string;
  timestamp: number;
  total: number;
  date: string;
  time: string;
  items: unknown;
};

/** Order SPK yang menunjuk nomor struk lewat `data.posTransactionId`. */
export type SpkOrderInput = {
  recordId: string;
  orderNumber: string;
  posTransactionId: string;
  timestamp: number;
};

export type ReceiptDeleteDecision = {
  receipt: string;
  recordId: string;
  appId: string;
  keepRecordId: string;
  reason: string;
};

export type ReceiptRenameDecision = {
  receipt: string;
  newReceipt: string;
  recordId: string;
  appId: string;
  timestamp: number;
  total: number;
  date: string;
  time: string;
  reason: string;
};

export type ReceiptNormalizeDecision = {
  receipt: string;
  recordId: string;
  appId: string;
  legacyId: string;
  mirrorId: string;
  /** Bentuk id aplikasi yang benar (selalu "/" untuk nomor struk). */
  desiredAppId: string;
  /**
   * `true` bila record belum membawa cermin `data`; penulisan hanya menambah
   * `data.id`, bukan mengarang field lain — nilai lama tetap dibaca dari kolom.
   */
  createsMirror: boolean;
  reason: string;
};

export type SpkRelinkDecision = {
  recordId: string;
  orderNumber: string;
  fromReceipt: string;
  toReceipt: string;
  distanceMs: number;
  reason: string;
};

export type SpkAmbiguousDecision = {
  recordId: string;
  orderNumber: string;
  receipt: string;
  reason: string;
};

export type ReceiptGroupPlan = {
  receipt: string;
  kind: 'IDENTIK' | 'KONFLIK';
  count: number;
  keepRecordId: string;
  keepAppId: string;
  records: Array<{
    recordId: string;
    appId: string;
    legacyId: string;
    mirrorId: string;
    timestamp: number;
    total: number;
    date: string;
    time: string;
  }>;
};

export type ReceiptReconciliationPlan = {
  receiptRecords: number;
  duplicateGroups: number;
  identicalGroups: number;
  conflictGroups: number;
  deletes: ReceiptDeleteDecision[];
  renames: ReceiptRenameDecision[];
  normalizes: ReceiptNormalizeDecision[];
  spkRelinks: SpkRelinkDecision[];
  spkAmbiguous: SpkAmbiguousDecision[];
  groups: ReceiptGroupPlan[];
};

/**
 * Kunci nomor struk yang sadar kedua bentuk pemisah. "BS2026/10/0155" dan
 * "BS2026_10_0155" adalah struk yang sama; urutan dinormalkan (0155, bukan 155)
 * supaya kunci tidak bergantung pada bentuk aslinya.
 */
export function receiptKeyOf(value: string): string | null {
  const parsed = parseReceiptId(value);
  if (!parsed) return null;
  return `BS${parsed.year}/${parsed.month}/${String(parsed.seq).padStart(4, '0')}`;
}

/** JSON dengan kunci objek terurut, supaya isi yang sama selalu berbentuk sama. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

/**
 * Tanda satu penjualan: total + waktu + tanggal + jam + isi keranjang.
 * Dipakai untuk membedakan duplikat murni (isi sama persis) dari dua penjualan
 * berbeda yang kebetulan memakai nomor struk yang sama.
 */
export function saleSignature(record: ReceiptRecordInput): string {
  return [record.total, record.timestamp, record.date, record.time, stableStringify(record.items)].join('|');
}

function parseKey(key: string): { year: number; month: string; seq: number } {
  const parsed = parseReceiptId(key);
  if (!parsed) throw new Error(`Kunci nomor struk tidak sah: ${key}`);
  return parsed;
}

/** Nomor struk bebas berikutnya di bulan yang sama; hasilnya langsung dipesan. */
function takeNextFreeReceipt(monthKey: string, taken: Set<string>): string {
  const month = parseKey(`${monthKey}/0000`);
  let highest = 0;
  for (const key of taken) {
    const parsed = parseReceiptId(key);
    if (parsed && parsed.year === month.year && parsed.month === month.month && parsed.seq > highest) {
      highest = parsed.seq;
    }
  }
  for (let seq = highest + 1; seq <= highest + 100000; seq += 1) {
    const candidate = `BS${month.year}/${month.month}/${String(seq).padStart(4, '0')}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Tidak ada nomor struk bebas di ${monthKey}.`);
}

const timeOf = (record: ReceiptRecordInput): number =>
  Number.isFinite(record.timestamp) ? record.timestamp : 0;

/** Urutan stabil: penjualan paling awal lebih dulu, lalu createdAt, lalu id record. */
function compareOldestFirst(a: ReceiptRecordInput, b: ReceiptRecordInput): number {
  return (
    timeOf(a) - timeOf(b) ||
    String(a.createdAt).localeCompare(String(b.createdAt)) ||
    a.recordId.localeCompare(b.recordId)
  );
}

/**
 * Pilih record yang dipertahankan pada duplikat identik: yang membawa cermin
 * `data` lebih dulu, lalu cermin berbentuk "/", lalu `legacyId` "_" (bentuk yang
 * ditulis kode sekarang). Record tanpa cermin paling akhir karena isinya tidak
 * bisa dipulihkan utuh.
 */
function provenanceScore(record: ReceiptRecordInput): number {
  let score = 0;
  if (record.hasMirror) score += 4;
  if (receiptKeyOf(record.mirrorId)) score += 2;
  if (record.legacyId.includes('_')) score += 1;
  return score;
}

function compareKeepFirst(a: ReceiptRecordInput, b: ReceiptRecordInput): number {
  return (
    provenanceScore(b) - provenanceScore(a) ||
    String(b.updated).localeCompare(String(a.updated)) ||
    a.recordId.localeCompare(b.recordId)
  );
}

function describe(record: ReceiptRecordInput): string {
  return `Rp${record.total} ${record.date || '?'} ${record.time || '?'}`.trim();
}

/**
 * Susun rencana rekonsiliasi dari seluruh record penjualan.
 *
 * - Kelompok dengan isi sama persis = duplikat murni: satu record dipertahankan,
 *   sisanya dihapus.
 * - Kelompok dengan isi berbeda = dua penjualan nyata memakai nomor yang sama:
 *   penjualan paling awal mempertahankan nomor yang sudah tercetak, penjualan
 *   berikutnya diberi nomor bebas di bulan yang sama. Tidak ada yang dihapus.
 * - Record yang dipertahankan dinormalkan ke bentuk yang ditulis kode sekarang
 *   (`legacyId` "_" + cermin `data.id` "/") supaya tulis berikutnya menemukannya
 *   dan tidak membuat duplikat baru.
 */
export function planReceiptReconciliation(
  records: ReceiptRecordInput[],
  spkOrders: SpkOrderInput[] = []
): ReceiptReconciliationPlan {
  const byReceipt = new Map<string, ReceiptRecordInput[]>();
  const taken = new Set<string>();
  let receiptRecords = 0;

  for (const record of records) {
    const key = receiptKeyOf(record.appId) || receiptKeyOf(record.legacyId) || receiptKeyOf(record.mirrorId);
    if (!key) continue;
    receiptRecords += 1;
    taken.add(key);
    const list = byReceipt.get(key) || [];
    list.push(record);
    byReceipt.set(key, list);
  }

  const plan: ReceiptReconciliationPlan = {
    receiptRecords,
    duplicateGroups: 0,
    identicalGroups: 0,
    conflictGroups: 0,
    deletes: [],
    renames: [],
    normalizes: [],
    spkRelinks: [],
    spkAmbiguous: [],
    groups: [],
  };

  const keepByReceipt = new Map<string, ReceiptRecordInput>();
  const renamedTo = new Map<string, string>();

  for (const receipt of [...byReceipt.keys()].sort()) {
    const list = [...(byReceipt.get(receipt) as ReceiptRecordInput[])];
    if (list.length < 2) continue;
    plan.duplicateGroups += 1;

    const signature = saleSignature(list[0]);
    const identical = list.every((record) => saleSignature(record) === signature);
    const keep = identical ? [...list].sort(compareKeepFirst)[0] : [...list].sort(compareOldestFirst)[0];
    keepByReceipt.set(receipt, keep);

    const groupRecords = list
      .sort(compareOldestFirst)
      .map((record) => ({
        recordId: record.recordId,
        appId: record.appId,
        legacyId: record.legacyId,
        mirrorId: record.mirrorId,
        timestamp: record.timestamp,
        total: record.total,
        date: record.date,
        time: record.time,
      }));

    if (identical) {
      plan.identicalGroups += 1;
      for (const record of list) {
        if (record.recordId === keep.recordId) continue;
        plan.deletes.push({
          receipt,
          recordId: record.recordId,
          appId: record.appId,
          keepRecordId: keep.recordId,
          reason: `duplikat murni dari ${describe(record)}; record yang dipertahankan ${keep.recordId}`,
        });
      }
      plan.groups.push({
        receipt,
        kind: 'IDENTIK',
        count: list.length,
        keepRecordId: keep.recordId,
        keepAppId: keep.appId,
        records: groupRecords,
      });
      continue;
    }

    plan.conflictGroups += 1;
    const monthKey = receipt.slice(0, receipt.lastIndexOf('/'));
    const others = list
      .filter((record) => record.recordId !== keep.recordId)
      .sort(compareOldestFirst);

    for (const record of others) {
      const newReceipt = takeNextFreeReceipt(monthKey, taken);
      renamedTo.set(record.recordId, newReceipt);
      plan.renames.push({
        receipt,
        newReceipt,
        recordId: record.recordId,
        appId: record.appId,
        timestamp: record.timestamp,
        total: record.total,
        date: record.date,
        time: record.time,
        reason: `penjualan berbeda memakai nomor yang sama; penjualan paling awal (${describe(keep)}) mempertahankan ${receipt}`,
      });
    }

    plan.groups.push({
      receipt,
      kind: 'KONFLIK',
      count: list.length,
      keepRecordId: keep.recordId,
      keepAppId: keep.appId,
      records: groupRecords,
    });
  }

  // Normalkan penanda record yang bertahan agar tulis berikutnya menemukannya.
  // Record tunggal pun ikut: `legacyId` berbentuk "/" tidak ditemukan
  // `findByAppId` saat aplikasi menyimpan id "_", jadi record seperti itu adalah
  // calon duplikat berikutnya walaupun sekarang belum kembar.
  for (const [receipt, group] of byReceipt.entries()) {
    const keep = keepByReceipt.get(receipt) || (group.length === 1 ? group[0] : undefined);
    if (!keep) continue;
    if (plan.renames.some((item) => item.recordId === keep.recordId)) continue;
    const desiredAppId = receipt;
    const desiredLegacyId = toStoredDocId(desiredAppId);
    if (keep.appId === desiredAppId && keep.legacyId === desiredLegacyId && keep.mirrorId === desiredAppId) {
      continue;
    }
    plan.normalizes.push({
      receipt,
      recordId: keep.recordId,
      appId: keep.appId,
      legacyId: keep.legacyId,
      mirrorId: keep.mirrorId,
      desiredAppId,
      createsMirror: !keep.hasMirror,
      reason: keep.hasMirror
        ? 'samakan bentuk id: legacyId "_" + cermin data.id "/"'
        : 'record belum punya cermin data — hanya menambah data.id, field lama tetap dibaca dari kolom',
    });
  }

  // Tautan SPK hanya dipindahkan bila waktunya jelas menunjuk penjualan yang diberi nomor baru.
  for (const order of spkOrders) {
    const receipt = receiptKeyOf(order.posTransactionId);
    if (!receipt) continue;
    const renamed = plan.renames.filter((item) => item.receipt === receipt);
    if (renamed.length === 0) continue;
    const keep = keepByReceipt.get(receipt);
    const group = byReceipt.get(receipt);
    if (!keep || !group) continue;

    const orderTime = Number(order.timestamp) || 0;
    const candidates = renamed
      .map((item) => {
        const record = group.find((candidate) => candidate.recordId === item.recordId);
        return record ? { record, newReceipt: item.newReceipt } : null;
      })
      .filter((item): item is { record: ReceiptRecordInput; newReceipt: string } => Boolean(item));

    let bestDistance = Math.abs(timeOf(keep) - orderTime);
    let bestNewReceipt: string | null = null;
    let tied = false;
    for (const candidate of candidates) {
      const distance = Math.abs(timeOf(candidate.record) - orderTime);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestNewReceipt = candidate.newReceipt;
        tied = false;
      } else if (distance === bestDistance) {
        tied = true;
      }
    }

    if (bestNewReceipt && !tied) {
      plan.spkRelinks.push({
        recordId: order.recordId,
        orderNumber: order.orderNumber,
        fromReceipt: receipt,
        toReceipt: bestNewReceipt,
        distanceMs: bestDistance,
        reason: 'waktu order lebih dekat ke penjualan yang diberi nomor baru',
      });
    } else if (tied) {
      plan.spkAmbiguous.push({
        recordId: order.recordId,
        orderNumber: order.orderNumber,
        receipt,
        reason: 'waktu order sama dekat dengan dua record penjualan — tidak dipindahkan, periksa manual',
      });
    }
  }

  return plan;
}

/** Rencana sudah bersih: tidak ada yang perlu dihapus, diganti, atau dinormalkan. */
export function planIsEmpty(plan: ReceiptReconciliationPlan): boolean {
  return (
    plan.deletes.length === 0 &&
    plan.renames.length === 0 &&
    plan.normalizes.length === 0 &&
    plan.spkRelinks.length === 0
  );
}
