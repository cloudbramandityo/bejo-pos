import {
  ENTITY_ID_PERORANGAN,
  ENTITY_ID_PT,
  getEntityRegistry,
  normalizeEntityRegistry,
  setTransitionDate as applyTransitionDate,
  setClosedThroughDate as applyClosedThroughDate,
  writeEntityRegistry,
  type EntityProfile,
  type EntityRegistry,
} from './entityRegistry';
import {
  applyTransitionRules,
  defaultAccountChart,
  ensureStandardAccounts,
  getAccountChart,
  isPersonalBankAccount,
  isPriveAccount,
  normalizeAccountChart,
  writeAccountChart,
  type Account,
  type AccountChart,
} from './accountChart';
import { saveAccountChartCloud, saveEntityRegistryCloud } from '../backend/pocketbaseBackend';

/**
 * Penyimpanan profil entitas usaha dan bagan akun.
 *
 * Aturan wajib: nilai yang baru datang dari server hanya dipasang di perangkat
 * ini, tidak dikirim balik. Tanpa penanda `fromCloud`, setiap perangkat mengulang
 * tulis yang sama dan angka laporan bisa berubah karena gema.
 */

/** Pasang profil entitas di perangkat ini lalu kirim ke server. */
export const saveEntityRegistry = (registry: unknown, fromCloud = false): EntityRegistry => {
  const clean = writeEntityRegistry(registry);
  if (!fromCloud) {
    saveEntityRegistryCloud(clean).catch((error) =>
      console.error('[Server] Gagal menyimpan profil entitas:', error)
    );
  }
  return clean;
};

/** Nilai dari server: pasang, jangan dikirim balik. */
export const applyEntityRegistryFromCloud = (registry: unknown): EntityRegistry =>
  saveEntityRegistry(registry, true);

/** Ganti tanggal transisi; rentang kedua entitas disusun ulang, histori tidak disentuh. */
export const changeTransitionDate = (
  nextDate: string,
  actor: string
): { accepted: boolean; reason: string; registry: EntityRegistry } => {
  const result = applyTransitionDate(getEntityRegistry(), nextDate, actor);
  if (result.accepted) saveEntityRegistry(result.registry);
  return result;
};

/** Tutup buku pembukuan lama pada tanggal terakhir periode tersebut. */
export const closeBooksThrough = (dateKey: string | null, actor = ''): EntityRegistry => {
  const next = applyClosedThroughDate(getEntityRegistry(), dateKey, actor);
  return saveEntityRegistry(next);
};

/**
 * Isi identitas entitas dari dokumen hukum. Nama/NPWP/alamat tidak pernah
 * dikarang sistem — yang kosong berarti memang belum diisi pemiliknya.
 */
export const updateEntityProfile = (entityId: string, patch: Partial<EntityProfile>): EntityProfile | null => {
  const registry = getEntityRegistry();
  const index = registry.entities.findIndex((entity) => entity.id === entityId);
  if (index === -1) return null;
  const current = registry.entities[index];
  const updated: EntityProfile = {
    ...current,
    ...patch,
    id: current.id,
    kind: current.kind,
    startDate: current.startDate,
    endDate: current.endDate,
  };
  const entities = registry.entities.slice();
  entities[index] = updated;
  saveEntityRegistry({ ...registry, entities });
  return updated;
};

/** Simpan bagan akun (perangkat ini + server). */
export const saveChart = (chart: unknown, fromCloud = false): AccountChart => {
  const clean = writeAccountChart(chart);
  if (!fromCloud) {
    saveAccountChartCloud(clean).catch((error) =>
      console.error('[Server] Gagal menyimpan bagan akun:', error)
    );
  }
  return clean;
};

export const applyAccountChartFromCloud = (chart: unknown): AccountChart => saveChart(chart, true);

/**
 * Bagan akun siap pakai. Bila server belum pernah mengirim apa pun, bagan
 * bawaan dipasang lebih dulu supaya layar tidak kosong.
 */
export const ensureAccountChartSeeded = (): AccountChart => {
  try {
    if (localStorage.getItem('bejo_account_chart_v1')) return getAccountChart();
  } catch {
    /* cermin tidak tersedia — pakai bawaan tanpa mengirim ke server */
  }
  return writeAccountChart(defaultAccountChart());
};

/**
 * Terapkan aturan transisi dan laporkan apa yang berubah, dalam jumlah nyata.
 * Dipakai layar supaya operator melihat hasil, bukan janji.
 */
export const applyChartTransitionRulesReport = (): {
  archivedCount: number;
  priveCount: number;
  addedCount: number;
  chart: AccountChart;
} => {
  const before = ensureAccountChartSeeded();
  const standard = ensureStandardAccounts(before).chart;
  const after = applyTransitionRules(standard);
  const isArchivedNow = (item: Account): boolean => {
    const previous = before.accounts.find(
      (candidate) => candidate.entityId === item.entityId && candidate.code === item.code
    );
    return item.archived && previous !== undefined && !previous.archived;
  };
  return {
    archivedCount: after.accounts.filter((item) => isArchivedNow(item) && isPersonalBankAccount(item)).length,
    priveCount: after.accounts.filter((item) => isArchivedNow(item) && isPriveAccount(item)).length,
    addedCount: after.accounts.length - before.accounts.length,
    chart: saveChart(after),
  };
};

/** Isi akun baru yang diminta layar; status arsip selalu bawaan aktif. */
export interface AccountDraft {
  entityId: string;
  code: string;
  name: string;
  type: Account['type'];
  normal: Account['normal'];
  source?: string;
}

/** Tambah akun baru milik satu entitas; kode rangkap ditolak. */
export const addAccount = (draft: AccountDraft): {
  ok: boolean;
  reason: string;
  chart: AccountChart;
} => {
  const chart = ensureAccountChartSeeded();
  const code = draft.code.trim();
  if (!code) return { ok: false, reason: 'Kode akun belum diisi.', chart };
  if (!draft.name.trim()) return { ok: false, reason: 'Nama akun belum diisi.', chart };
  if (chart.accounts.some((item) => item.entityId === draft.entityId && item.code === code)) {
    return { ok: false, reason: `Kode ${code} sudah dipakai di entitas ini.`, chart };
  }
  const next: AccountChart = {
    ...chart,
    accounts: [
      ...chart.accounts,
      { code, name: draft.name.trim(), type: draft.type, normal: draft.normal, entityId: draft.entityId, archived: false, postable: true },
    ],
  };
  return { ok: true, reason: '', chart: saveChart(next) };
};

/** Ubah akun yang sudah ada. Kode dan entitas pemilik tidak boleh bergeser. */
export const updateAccount = (
  entityId: string,
  code: string,
  patch: Partial<Account>
): { changed: boolean; chart: AccountChart } => {
  const chart = ensureAccountChartSeeded();
  let changed = false;
  const accounts = chart.accounts.map((item) => {
    if (item.entityId !== entityId || item.code !== code) return item;
    changed = true;
    return { ...item, ...patch, entityId: item.entityId, code: item.code };
  });
  return { changed, chart: changed ? saveChart({ ...chart, accounts }) : chart };
};

/**
 * Buang akun dari bagan. Ditolak bila akun itu masih terhitung dipakai —
 * penolakan ini yang menjaga histori tidak hilang.
 */
export const removeAccount = (
  entityId: string,
  code: string,
  usage: number
): { removed: boolean; reason: string; chart: AccountChart } => {
  const chart = ensureAccountChartSeeded();
  const target = chart.accounts.find((item) => item.entityId === entityId && item.code === code);
  if (!target) return { removed: false, reason: 'Akun tidak ditemukan.', chart };
  if (usage > 0) {
    return {
      removed: false,
      reason: `Akun ${target.code} - ${target.name} masih dipakai ${usage} baris jurnal. Arsipkan saja.`,
      chart,
    };
  }
  return {
    removed: true,
    reason: '',
    chart: saveChart({ ...chart, accounts: chart.accounts.filter((item) => item !== target) }),
  };
};

/** Kunci untuk membaca kedua susunan sekaligus (dipakai layar & penjaga). */
export const entityIds = { perorangan: ENTITY_ID_PERORANGAN, pt: ENTITY_ID_PT } as const;

export { normalizeEntityRegistry, normalizeAccountChart };
