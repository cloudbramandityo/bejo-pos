/**
 * Rekonsiliasi nomor struk penjualan yang tercatat dua kali di server.
 *
 * Jalankan: npm run sales:reconcile            (pratinjau, tidak menulis apa pun)
 *           npm run sales:reconcile -- --apply (menulis; cadangan dibuat dulu)
 *
 * Latar belakang: run live 4.14.4 (2026-11-07) menemukan 639 record penjualan
 * dengan 317 nomor struk tercatat sebagai dua record — satu `legacyId` berbentuk
 * "/" (sebelum perbaikan id) dan satu "_" (sesudahnya). Bug tulisnya sudah
 * dihentikan; skrip ini merapikan data lamanya.
 *
 * Aturan keputusan ada di satu tempat: `src/utils/salesReceiptReconciliation.ts`.
 * Skrip ini hanya membaca, mencetak rencana, membuat cadangan, lalu menjalankan
 * rencana itu. Bawaannya PRATINJAU; tanpa `--apply` tidak ada yang ditulis.
 *
 * Opsi:
 *   --apply              Jalankan rencana (bawaan: hanya pratinjau).
 *   --env <path>         Berkas env berisi PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD (bawaan .env).
 *   --url <url>          Alamat PocketBase (bawaan PB_URL di .env, lalu http://127.0.0.1:8090).
 *   --only-identical     Batasi ke duplikat berisi sama persis (hapus redundan).
 *   --only-conflicts     Batasi ke penjualan berbeda bernomor sama (beri nomor baru).
 *   --receipt <nomor>    Batasi ke satu/lebih nomor struk (boleh diulang).
 *   --json <path>        Tujuan berkas rencana JSON (bawaan backups/sales-reconcile-plan-<waktu>.json).
 *   --backup-dir <dir>   Folder cadangan sebelum menulis (bawaan backups).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import PocketBase from 'pocketbase';
import {
  planReceiptReconciliation,
  planIsEmpty,
  receiptKeyOf,
  type ReceiptRecordInput,
  type ReceiptReconciliationPlan,
  type SpkOrderInput,
} from '../src/utils/salesReceiptReconciliation';
import { resolveAppId, toStoredDocId } from '../src/utils/appRecordId';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Args = {
  apply: boolean;
  envPath: string;
  url: string;
  onlyIdentical: boolean;
  onlyConflicts: boolean;
  receipts: string[];
  jsonPath: string | null;
  backupDir: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    envPath: path.join(ROOT, '.env'),
    url: '',
    onlyIdentical: false,
    onlyConflicts: false,
    receipts: [],
    jsonPath: null,
    backupDir: path.join(ROOT, 'backups'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--only-identical') args.onlyIdentical = true;
    else if (arg === '--only-conflicts') args.onlyConflicts = true;
    else if (arg === '--env') args.envPath = path.resolve(argv[++i] || '');
    else if (arg === '--url') args.url = String(argv[++i] || '');
    else if (arg === '--receipt') args.receipts.push(String(argv[++i] || ''));
    else if (arg === '--json') args.jsonPath = path.resolve(argv[++i] || '');
    else if (arg === '--backup-dir') args.backupDir = path.resolve(argv[++i] || '');
    else if (arg === '--help' || arg === '-h') {
      console.log('Pakai: npm run sales:reconcile -- [--apply] [--only-identical|--only-conflicts] [--receipt <nomor>] [--json <path>]');
      process.exit(0);
    } else {
      console.error(`Argumen tidak dikenal: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function brief(error: any): string {
  const original = String(error?.originalError?.message || '').trim();
  const message = String(error?.message || error || '').trim() || 'galat tanpa pesan';
  return original && original !== message ? `${message} (${original})` : message;
}

function recordToInput(record: any): ReceiptRecordInput {
  const mirror = record?.data && typeof record.data === 'object' ? record.data : null;
  return {
    recordId: String(record?.id || ''),
    appId: resolveAppId(record),
    legacyId: String(record?.legacyId || ''),
    mirrorId: mirror && typeof mirror.id === 'string' ? mirror.id : '',
    hasMirror: Boolean(mirror),
    createdAt: String(record?.createdAt || record?.created || ''),
    updated: String(record?.updated || ''),
    timestamp: Number(record?.timestamp ?? mirror?.timestamp ?? 0),
    total: Number(record?.total ?? mirror?.total ?? 0),
    date: String(record?.date ?? mirror?.date ?? ''),
    time: String(record?.time ?? mirror?.time ?? ''),
    items: mirror?.items ?? record?.items ?? [],
  };
}

function spkToInput(record: any): SpkOrderInput {
  const mirror = record?.data && typeof record.data === 'object' ? record.data : null;
  return {
    recordId: String(record?.id || ''),
    orderNumber: String(record?.orderNumber ?? mirror?.orderNumber ?? ''),
    posTransactionId: String(mirror?.posTransactionId ?? record?.posTransactionId ?? ''),
    timestamp: Number(record?.timestamp ?? mirror?.timestamp ?? 0),
  };
}

/** Batasi rencana ke kelompok yang dipilih operator; sisa kelompok tidak disentuh. */
function filterPlan(plan: ReceiptReconciliationPlan, args: Args): ReceiptReconciliationPlan {
  if (!args.onlyIdentical && !args.onlyConflicts && args.receipts.length === 0) return plan;

  const wanted = new Set(args.receipts.map((value) => receiptKeyOf(value) || value));
  const allowedGroups = plan.groups.filter((group) => {
    if (args.onlyIdentical && group.kind !== 'IDENTIK') return false;
    if (args.onlyConflicts && group.kind !== 'KONFLIK') return false;
    if (wanted.size > 0 && !wanted.has(group.receipt)) return false;
    return true;
  });
  const allowed = new Set(allowedGroups.map((group) => group.receipt));

  return {
    ...plan,
    duplicateGroups: allowedGroups.length,
    identicalGroups: allowedGroups.filter((group) => group.kind === 'IDENTIK').length,
    conflictGroups: allowedGroups.filter((group) => group.kind === 'KONFLIK').length,
    deletes: plan.deletes.filter((item) => allowed.has(item.receipt)),
    renames: plan.renames.filter((item) => allowed.has(item.receipt)),
    normalizes: plan.normalizes.filter((item) => allowed.has(item.receipt)),
    spkRelinks: plan.spkRelinks.filter((item) => allowed.has(item.fromReceipt)),
    spkAmbiguous: plan.spkAmbiguous.filter((item) => allowed.has(item.receipt)),
    groups: allowedGroups,
  };
}

function printPlan(plan: ReceiptReconciliationPlan): void {
  console.log('');
  console.log(`Record bernomor struk : ${plan.receiptRecords}`);
  console.log(`Nomor struk ganda     : ${plan.duplicateGroups} (identik ${plan.identicalGroups}, konflik ${plan.conflictGroups})`);
  console.log(`Akan dihapus          : ${plan.deletes.length} record duplikat murni`);
  console.log(`Akan dinomori ulang   : ${plan.renames.length} penjualan berbeda`);
  console.log(`Penanda id disamakan  : ${plan.normalizes.length} record`);
  console.log(`Tautan SPK dipindah   : ${plan.spkRelinks.length}`);
  if (plan.spkAmbiguous.length > 0) {
    console.log(`Tautan SPK manual     : ${plan.spkAmbiguous.length} (waktu order tidak bisa dibedakan)`);
  }

  if (plan.conflictGroups > 0) {
    console.log('');
    console.log('PENJUALAN BERBEDA DENGAN NOMOR SAMA');
    for (const group of plan.groups.filter((item) => item.kind === 'KONFLIK')) {
      console.log(`  ${group.receipt} (${group.count} record)`);
      for (const record of group.records) {
        const role = record.recordId === group.keepRecordId ? 'tetap' : 'nomor baru';
        console.log(
          `    - [${role}] Rp${record.total} ${record.date} ${record.time} | id=${record.recordId} legacy=${record.legacyId || '-'} cermin=${record.mirrorId || '-'}`
        );
      }
      for (const rename of plan.renames.filter((item) => item.receipt === group.receipt)) {
        console.log(`      -> ${rename.recordId} menjadi ${rename.newReceipt}`);
      }
    }
  }

  if (plan.deletes.length > 0) {
    console.log('');
    console.log('DUPLIKAT MURNI (isi sama persis)');
    for (const group of plan.groups.filter((item) => item.kind === 'IDENTIK')) {
      const keep = group.records.find((record) => record.recordId === group.keepRecordId);
      console.log(
        `  ${group.receipt} (${group.count} record) -> simpan ${group.keepRecordId} (Rp${keep?.total ?? 0} ${keep?.date ?? ''} ${keep?.time ?? ''}), hapus ${group.count - 1}`
      );
    }
  }

  if (plan.spkRelinks.length > 0) {
    console.log('');
    console.log('TAUTAN SPK IKUT DIPINDAH');
    for (const relink of plan.spkRelinks) {
      console.log(`  ${relink.orderNumber || relink.recordId}: ${relink.fromReceipt} -> ${relink.toReceipt}`);
    }
  }
  if (plan.spkAmbiguous.length > 0) {
    console.log('');
    console.log('TAUTAN SPK PERLU DIPERIKSA MANUAL');
    for (const item of plan.spkAmbiguous) {
      console.log(`  ${item.orderNumber || item.recordId}: ${item.reason}`);
    }
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.envPath)) {
    console.error(`Berkas env tidak ditemukan: ${args.envPath}`);
    return 1;
  }
  const env = dotenv.config({ path: args.envPath, override: true, quiet: true }).parsed || {};
  const email = String(env.PB_ADMIN_EMAIL || process.env.PB_ADMIN_EMAIL || '').trim();
  const password = String(env.PB_ADMIN_PASSWORD || process.env.PB_ADMIN_PASSWORD || '');
  const url = String(args.url || env.PB_URL || env.VITE_PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');

  if (!email || !password) {
    console.error('PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD belum diisi di berkas env. Skrip ini butuh akun admin PocketBase.');
    return 1;
  }

  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  try {
    await pb.collection('_superusers').authWithPassword(email, password);
  } catch (error: any) {
    try {
      if (pb.admins?.authWithPassword) await pb.admins.authWithPassword(email, password);
      else throw error;
    } catch (fallbackError: any) {
      console.error(`Login admin PocketBase gagal: ${brief(fallbackError)}`);
      return 1;
    }
  }

  console.log(`PocketBase: ${url}`);
  console.log(`Mode       : ${args.apply ? 'TERAPKAN (menulis)' : 'PRATINJAU (tidak menulis)'}`);

  const transactions = await pb.collection('transactions').getFullList({ requestKey: null });
  const spkOrders = await pb
    .collection('spk_orders')
    .getFullList({ fields: 'id,orderNumber,timestamp,data', requestKey: null })
    .catch((error) => {
      console.warn(`Order SPK tidak terbaca (${brief(error)}); tautan SPK tidak diperiksa.`);
      return [] as any[];
    });

  const inputs = transactions.map(recordToInput);
  const fullPlan = planReceiptReconciliation(inputs, spkOrders.map(spkToInput));
  const plan = filterPlan(fullPlan, args);
  printPlan(plan);

  const when = stamp();
  const planPath = args.jsonPath || path.join(args.backupDir, `sales-reconcile-plan-${when}.json`);
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(
    planPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), pbUrl: url, mode: args.apply ? 'apply' : 'dry-run', plan }, null, 2),
    'utf8'
  );
  console.log('');
  console.log(`Rencana lengkap ditulis: ${planPath}`);

  if (planIsEmpty(plan)) {
    console.log('Tidak ada yang perlu dirapikan.');
    return 0;
  }
  if (!args.apply) {
    console.log('Belum ada yang ditulis. Jalankan ulang dengan --apply setelah rencana ini diperiksa.');
    return 0;
  }

  // Cadangan wajib berhasil sebelum satu pun record diubah.
  fs.mkdirSync(args.backupDir, { recursive: true });
  const backupPath = path.join(args.backupDir, `sales-reconcile-backup-${when}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), pbUrl: url, transactions, spkOrders }, null, 2),
    'utf8'
  );
  if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size < 100) {
    console.error('Cadangan gagal dibuat; tidak ada yang ditulis.');
    return 1;
  }
  console.log(`Cadangan sebelum menulis: ${backupPath}`);

  const byRecordId = new Map(transactions.map((record) => [record.id, record]));
  const failures: string[] = [];

  // 1) Penjualan berbeda: nomor baru + penanda id yang benar.
  for (const rename of plan.renames) {
    const record = byRecordId.get(rename.recordId);
    if (!record) {
      failures.push(`nomor baru ${rename.recordId}: record tidak ditemukan`);
      continue;
    }
    const mirror = record.data && typeof record.data === 'object' ? record.data : {};
    try {
      await pb.collection('transactions').update(rename.recordId, {
        legacyId: toStoredDocId(rename.newReceipt),
        data: { ...mirror, id: rename.newReceipt },
      });
      console.log(`  nomor baru: ${rename.receipt} -> ${rename.newReceipt} (${rename.recordId})`);
    } catch (error) {
      failures.push(`nomor baru ${rename.recordId}: ${brief(error)}`);
    }
  }

  // 2) Duplikat murni dihapus lebih dulu; record yang dipertahankan berisi isi
  //    yang sama persis, jadi tidak ada penjualan yang hilang di langkah ini.
  for (const deletion of plan.deletes) {
    try {
      await pb.collection('transactions').delete(deletion.recordId);
      console.log(`  hapus: ${deletion.recordId} (${deletion.receipt})`);
    } catch (error) {
      failures.push(`hapus ${deletion.recordId}: ${brief(error)}`);
    }
  }

  // 3) Penanda id record yang bertahan disamakan terakhir. Bila langkah ini
  //    gagal, penjualannya tetap ada dan pratinjau berikutnya memuatnya lagi.
  for (const normalize of plan.normalizes) {
    const record = byRecordId.get(normalize.recordId);
    if (!record) {
      failures.push(`penanda ${normalize.recordId}: record tidak ditemukan`);
      continue;
    }
    const mirror = record.data && typeof record.data === 'object' ? record.data : {};
    try {
      await pb.collection('transactions').update(normalize.recordId, {
        legacyId: toStoredDocId(normalize.desiredAppId),
        data: { ...mirror, id: normalize.desiredAppId },
      });
      console.log(`  penanda: ${normalize.recordId} -> ${normalize.desiredAppId}`);
    } catch (error) {
      failures.push(`penanda ${normalize.recordId}: ${brief(error)}`);
    }
  }

  // 4) Tautan SPK yang waktunya jelas menunjuk penjualan bernomor baru.
  for (const relink of plan.spkRelinks) {
    try {
      const order = spkOrders.find((item) => item.id === relink.recordId);
      const mirror = order?.data && typeof order.data === 'object' ? order.data : {};
      await pb.collection('spk_orders').update(relink.recordId, {
        data: { ...mirror, posTransactionId: relink.toReceipt },
      });
      console.log(`  tautan SPK: ${relink.orderNumber || relink.recordId} -> ${relink.toReceipt}`);
    } catch (error) {
      failures.push(`tautan SPK ${relink.recordId}: ${brief(error)}`);
    }
  }

  if (failures.length > 0) {
    console.error('');
    console.error(`${failures.length} langkah gagal:`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    console.error('Jalankan ulang pratinjau untuk melihat sisa pekerjaan; rencana bersifat idempoten.');
    return 1;
  }

  // 5) Bukti sesudah menulis: baca ulang dan pastikan lingkup yang dipilih bersih.
  const after = await pb.collection('transactions').getFullList({ requestKey: null });
  const afterPlan = filterPlan(planReceiptReconciliation(after.map(recordToInput), spkOrders.map(spkToInput)), args);
  const verifyPath = path.join(args.backupDir, `sales-reconcile-verify-${when}.json`);
  fs.writeFileSync(
    verifyPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        before: transactions.length,
        after: after.length,
        duplicateGroupsRemaining: afterPlan.duplicateGroups,
        groupsRemaining: afterPlan.groups,
        skripSelesai: failures.length === 0,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('');
  console.log(`Record sebelum ${transactions.length}, sesudah ${after.length}.`);
  if (!planIsEmpty(afterPlan)) {
    console.error(
      `Lingkup ini belum bersih: ${afterPlan.deletes.length} duplikat, ${afterPlan.renames.length} nomor baru, ${afterPlan.normalizes.length} penanda. Lihat ${verifyPath}.`
    );
    return 1;
  }
  console.log(`Tidak ada nomor struk ganda tersisa. Bukti: ${verifyPath}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`Gagal: ${brief(error)}`);
    process.exit(1);
  });
