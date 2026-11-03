import { toAgentDateKey } from './agentHistoryPeriod';
import { TAX_CONFIG_2025 } from '../types/tax';

/**
 * Registry entitas usaha: siapa yang memiliki sebuah transaksi.
 *
 * Toko berubah bentuk dari Dagang Perorangan menjadi Perseroan Terbatas (PT)
 * pada satu tanggal efektif. Histori lama tidak dipindahkan dan tidak diubah
 * pemiliknya — tanggal transisi saja yang menentukan entitas mana yang punya.
 *
 * Berkas ini murni aturan (hanya membaca cermin perangkat ini) supaya penjaga
 * `npm run check:entity` bisa menjalankannya di Node. Pengiriman ke server ada
 * di `entityStorage.ts`, sama seperti isian pajak.
 */

export type EntityKind = 'PERORANGAN' | 'PT';

/** Letak satu tanggal terhadap tanggal transisi. */
export type EntityEra = 'PRA_PT' | 'PASCA_PT';

/**
 * Cara satu entitas menghitung PPh atas peredarannya. Nilainya diisi pemilik
 * dari ketentuan yang berlaku padanya — sistem tidak menentukan sendiri.
 */
export type TaxRegime = 'PP55_OP' | 'BADAN' | 'BELUM_DISETTEL';

export const TAX_REGIMES: readonly TaxRegime[] = ['PP55_OP', 'BADAN', 'BELUM_DISETTEL'];

/** Label yang dibaca operator di layar Pengaturan Entitas. */
export const TAX_REGIME_LABEL: Record<TaxRegime, string> = {
  PP55_OP: 'PPh Final UMKM (PP 55/2022)',
  BADAN: 'PPh Badan',
  BELUM_DISETTEL: 'Belum disetel',
};

export interface EntityTaxProfile {
  regime: TaxRegime;
  /** Tarif PPh Final dalam persen (0,5 berarti 0,5%). null = belum diisi. */
  finalRatePercent: number | null;
  /** Tarif PPh Badan dalam persen (22 berarti 22%). null = belum diisi. */
  corporateRatePercent: number | null;
  /** Peredaran bruto setahun yang bebas PPh Final. 0 = tidak memakai fasilitas. */
  exemptThreshold: number;
}

export interface EntityProfile {
  id: string;
  kind: EntityKind;
  /** Nama sesuai dokumen hukum. */
  legalName: string;
  /** Nama yang dipakai sehari-hari / kop laporan. */
  tradeName: string;
  npwp: string;
  address: string;
  /** Nomor akta pendirian / keputusan; kosong untuk usaha perorangan. */
  legalDocNumber: string;
  /** Hari pertama (inklusif) transaksi dimiliki entitas ini. */
  startDate: string;
  /** Hari terakhir (inklusif); null berarti masih berjalan. */
  endDate: string | null;
  /** Hanya satu entitas boleh aktif sebagai entitas berjalan. */
  active: boolean;
  notes: string;
  /** Isian pajak entitas ini; terpisah dari entitas lain. */
  tax: EntityTaxProfile;
}

export interface EntityChangeRecord {
  id: string;
  /** Waktu pencatatan (bukan tanggal efektif). */
  recordedAt: string;
  effectiveDate: string;
  fromEntityId: string | null;
  toEntityId: string;
  toKind: EntityKind;
  note: string;
  actor: string;
}

export interface EntityRegistry {
  schemaVersion: '1';
  /** Tanggal pertama milik PT; transaksi sebelumnya milik entitas lama. */
  transitionDate: string;
  entities: EntityProfile[];
  history: EntityChangeRecord[];
  /**
   * Tutup buku: tanggal terakhir yang sudah tidak boleh diubah.
   * null berarti pembukuan lama belum ditutup.
   */
  closedThroughDate: string | null;
}

export const STORAGE_KEY_ENTITY_REGISTRY = 'bejo_entity_registry_v1';
export const ENTITY_REGISTRY_EVENT = 'bejo_entity_registry_updated';

/** Tanggal transisi skenario toko: PT mulai berlaku 1 Juli 2026. */
export const DEFAULT_TRANSITION_DATE = '2026-07-01';

/** Awal pembukuan yang ada di aplikasi (histori 2022 ke atas harus tetap utuh). */
export const EARLIEST_BOOK_DATE = '2022-01-01';

export const ENTITY_ID_PERORANGAN = 'ent_perorangan';
export const ENTITY_ID_PT = 'ent_pt';

export const ENTITY_KIND_LABEL: Record<EntityKind, string> = {
  PERORANGAN: 'Dagang Perorangan',
  PT: 'Perseroan Terbatas (PT)',
};

/**
 * Isian pajak bawaan per bentuk usaha. Bawaan perorangan mengutip konfigurasi
 * pajak yang sudah ada di aplikasi (satu sumber tarif, bukan angka yang ditulis
 * ulang di layar). PT sengaja mulai tanpa tarif: ketentuannya dibaca dari
 * dokumen pemilik, tidak dikarang sistem.
 */
export const defaultEntityTaxProfile = (kind: EntityKind): EntityTaxProfile =>
  kind === 'PERORANGAN'
    ? {
        regime: 'PP55_OP',
        finalRatePercent: roundRate(TAX_CONFIG_2025.umkmPp55Rate * 100),
        corporateRatePercent: null,
        exemptThreshold: TAX_CONFIG_2025.umkmExemptThresholdOp,
      }
    : { regime: 'BELUM_DISETTEL', finalRatePercent: null, corporateRatePercent: null, exemptThreshold: 0 };

/** Persen tarif yang sah: 0 < nilai <= 100, dibulatkan empat desimal. */
const rateOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100 ? roundRate(value) : null;

const roundRate = (value: number): number => Math.round(value * 10_000) / 10_000;

const isTaxRegime = (value: unknown): value is TaxRegime =>
  typeof value === 'string' && TAX_REGIMES.includes(value as TaxRegime);

/**
 * Bersihkan isian pajak. Regime yang cocok dengan bentuk usaha tetap dipakai;
 * nilai yang tidak terbaca jatuh ke bawaan bentuk usaha itu, bukan ke angka
 * karangan.
 */
export const normalizeEntityTaxProfile = (raw: unknown, kind: EntityKind): EntityTaxProfile => {
  const fallback = defaultEntityTaxProfile(kind);
  const row = (raw || {}) as Partial<EntityTaxProfile> & Record<string, unknown>;
  const regime = isTaxRegime(row.regime) ? row.regime : fallback.regime;
  const threshold =
    typeof row.exemptThreshold === 'number' && Number.isFinite(row.exemptThreshold) && row.exemptThreshold >= 0
      ? Math.round(row.exemptThreshold)
      : fallback.exemptThreshold;
  return {
    regime,
    finalRatePercent: row.finalRatePercent === null ? null : rateOf(row.finalRatePercent) ?? fallback.finalRatePercent,
    corporateRatePercent:
      row.corporateRatePercent === null ? null : rateOf(row.corporateRatePercent) ?? fallback.corporateRatePercent,
    // fasilitas hanya berlaku pada PPh Final; cara pajak lain tidak memakainya
    exemptThreshold: regime === 'PP55_OP' ? threshold : 0,
  };
};

/** Tarif yang berlaku untuk cara pajak yang dipilih entitas; null bila belum diisi. */
export const appliedTaxRatePercent = (entity: EntityProfile): number | null =>
  entity.tax.regime === 'PP55_OP'
    ? entity.tax.finalRatePercent
    : entity.tax.regime === 'BADAN'
      ? entity.tax.corporateRatePercent
      : null;

const pad2 = (value: number): string => String(value).padStart(2, '0');

const DAY_NAMES: readonly string[] = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Kunci hari 'YYYY-MM-DD'; nilai yang tidak terbaca menghasilkan ''. */
export const toEntityDateKey = (value?: string): string => toAgentDateKey(value || '');

export const isValidEntityDateKey = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Geser tanggal sebanyak hari (boleh negatif) pada kunci 'YYYY-MM-DD'. */
export const shiftEntityDateKey = (dateKey: string, days: number): string => {
  if (!isValidEntityDateKey(dateKey)) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
};

/** Hari terakhir sebelum tanggal transisi = hari terakhir entitas lama. */
export const lastDayBefore = (dateKey: string): string => shiftEntityDateKey(dateKey, -1);

export const formatEntityDateKey = (dateKey: string): string => {
  if (!isValidEntityDateKey(dateKey)) return '-';
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${day} ${DAY_NAMES[month - 1]} ${year}`;
};

const isEntityKind = (value: unknown): value is EntityKind =>
  value === 'PERORANGAN' || value === 'PT';

const textOf = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const makeEntity = (
  id: string,
  kind: EntityKind,
  legalName: string,
  startDate: string,
  endDate: string | null,
  active: boolean
): EntityProfile => ({
  id,
  kind,
  legalName,
  tradeName: legalName,
  npwp: '',
  address: '',
  legalDocNumber: '',
  startDate,
  endDate,
  active,
  notes: '',
  tax: defaultEntityTaxProfile(kind),
});

/**
 * Susunan bawaan sesuai skenario toko: Perorangan sampai 30 Juni 2026,
 * PT mulai 1 Juli 2026. Nama dan NPWP sengaja kosong sampai pemilik
 * mengisinya dari dokumen hukum — sistem tidak mengarang identitas.
 * Yang tampil sebelum diisi hanyalah sebutan bentuk usahanya
 * ("Dagang Perorangan" / "Perseroan Terbatas (PT)"), bukan nama badan hukum.
 */
export const defaultEntityRegistry = (transitionDate = DEFAULT_TRANSITION_DATE): EntityRegistry => {
  const transition = isValidEntityDateKey(transitionDate) ? transitionDate : DEFAULT_TRANSITION_DATE;
  const ptStart = transition;
  const peroranganEnd = lastDayBefore(ptStart);
  return normalizeEntityRegistry({
    schemaVersion: '1',
    transitionDate: transition,
    entities: [
      makeEntity(ENTITY_ID_PERORANGAN, 'PERORANGAN', '', EARLIEST_BOOK_DATE, peroranganEnd, false),
      makeEntity(ENTITY_ID_PT, 'PT', '', ptStart, null, true),
    ],
    history: [
      {
        id: 'chg_default_pt',
        recordedAt: new Date(0).toISOString(),
        effectiveDate: ptStart,
        fromEntityId: ENTITY_ID_PERORANGAN,
        toEntityId: ENTITY_ID_PT,
        toKind: 'PT',
        note: 'Perubahan bentuk usaha menjadi Perseroan Terbatas.',
        actor: 'sistem',
      },
    ],
    closedThroughDate: null,
  });
};

/**
 * Bersihkan susunan entitas. Rentang tanggal selalu disusun ulang dari tanggal
 * transisi supaya tidak ada hari yang jatuh ke dua entitas sekaligus, atau tidak
 * dimiliki sama sekali.
 */
export function normalizeEntityRegistry(raw: unknown): EntityRegistry {
  const source = (raw || {}) as Partial<EntityRegistry> & Record<string, unknown>;
  const transitionDate = isValidEntityDateKey(source.transitionDate)
    ? source.transitionDate
    : DEFAULT_TRANSITION_DATE;
  const peroranganEnd = lastDayBefore(transitionDate);

  const incoming = Array.isArray(source.entities) ? source.entities : [];
  const entities: EntityProfile[] = [];
  for (const item of incoming) {
    const row = (item || {}) as Partial<EntityProfile> & Record<string, unknown>;
    if (!isEntityKind(row.kind)) continue;
    const id = textOf(row.id, row.kind === 'PT' ? ENTITY_ID_PT : ENTITY_ID_PERORANGAN);
    entities.push({
      id,
      kind: row.kind,
      legalName: textOf(row.legalName, ENTITY_KIND_LABEL[row.kind]),
      tradeName: textOf(row.tradeName, textOf(row.legalName, ENTITY_KIND_LABEL[row.kind])),
      npwp: textOf(row.npwp),
      address: textOf(row.address),
      legalDocNumber: textOf(row.legalDocNumber),
      startDate: '',
      endDate: null,
      active: row.kind === 'PT',
      notes: textOf(row.notes),
      tax: normalizeEntityTaxProfile(row.tax, row.kind),
    });
  }

  // Satu usaha perorangan saja yang boleh jadi pemilik histori, satu PT berjalan.
  const legacy = entities.find((entity) => entity.kind === 'PERORANGAN');
  const limited = entities.filter((entity) => entity.kind === 'PT').slice(0, 1);
  const ordered: EntityProfile[] = [];

  if (legacy) {
    ordered.push({ ...legacy, startDate: EARLIEST_BOOK_DATE, endDate: peroranganEnd, active: false });
  }
  for (const pt of limited) {
    ordered.push({ ...pt, startDate: transitionDate, endDate: null, active: true });
  }
  // Entitas tambahan (mis. cabang badan hukum lain) tetap disimpan setelah yang pokok.
  for (const entity of entities) {
    if (!ordered.some((kept) => kept.id === entity.id)) {
      ordered.push({ ...entity, startDate: entity.startDate || transitionDate, active: false });
    }
  }

  const history = (Array.isArray(source.history) ? source.history : [])
    .map((item) => {
      const row = (item || {}) as Partial<EntityChangeRecord> & Record<string, unknown>;
      if (!isValidEntityDateKey(row.effectiveDate)) return null;
      return {
        id: textOf(row.id, `chg_${row.effectiveDate}`),
        recordedAt: textOf(row.recordedAt, new Date(0).toISOString()),
        effectiveDate: row.effectiveDate as string,
        fromEntityId: typeof row.fromEntityId === 'string' ? row.fromEntityId : null,
        toEntityId: textOf(row.toEntityId, ENTITY_ID_PT),
        toKind: isEntityKind(row.toKind) ? row.toKind : 'PT',
        note: textOf(row.note, 'Perubahan entitas usaha.'),
        actor: textOf(row.actor, 'sistem'),
      } satisfies EntityChangeRecord;
    })
    .filter((entry): entry is EntityChangeRecord => entry !== null)
    .sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : 0));

  return {
    schemaVersion: '1',
    transitionDate,
    entities: ordered,
    history: history.length > 0 ? history : defaultEntityRegistry(transitionDate).history,
    closedThroughDate: isValidEntityDateKey(source.closedThroughDate)
      ? source.closedThroughDate
      : null,
  };
}

export const getEntityRegistry = (): EntityRegistry => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENTITY_REGISTRY);
    if (raw) return normalizeEntityRegistry(JSON.parse(raw));
  } catch (error) {
    console.error('Gagal membaca profil entitas usaha', error);
  }
  const fallback = defaultEntityRegistry();
  try {
    localStorage.setItem(STORAGE_KEY_ENTITY_REGISTRY, JSON.stringify(fallback));
  } catch (error) {
    console.error('Gagal menyimpan profil entitas usaha', error);
  }
  return fallback;
};

export const writeEntityRegistry = (registry: EntityRegistry | unknown): EntityRegistry => {
  const clean = normalizeEntityRegistry(registry);
  try {
    localStorage.setItem(STORAGE_KEY_ENTITY_REGISTRY, JSON.stringify(clean));
  } catch (error) {
    console.error('Gagal menyimpan profil entitas usaha', error);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<EntityRegistry>(ENTITY_REGISTRY_EVENT, { detail: clean }));
  }
  return clean;
};

export const getEntityById = (registry: EntityRegistry, id: string): EntityProfile | null =>
  registry.entities.find((entity) => entity.id === id) || null;

export const peroranganEntity = (registry: EntityRegistry): EntityProfile | null =>
  registry.entities.find((entity) => entity.kind === 'PERORANGAN') || null;

export const ptEntity = (registry: EntityRegistry): EntityProfile | null =>
  registry.entities.find((entity) => entity.kind === 'PT') || null;

/** Entitas pemilik satu tanggal transaksi. '' di luar rentang manapun => null. */
export const entityForDateKey = (registry: EntityRegistry, dateKey: string): EntityProfile | null => {
  const key = toEntityDateKey(dateKey);
  if (!key) return null;
  return (
    registry.entities.find(
      (entity) => entity.startDate && key >= entity.startDate && (!entity.endDate || key <= entity.endDate)
    ) || null
  );
};

/** Pembandingan cepat terhadap tanggal transisi, untuk label laporan. */
export const eraForDateKey = (registry: EntityRegistry, dateKey: string): EntityEra | null => {
  const key = toEntityDateKey(dateKey);
  if (!key) return null;
  return key < registry.transitionDate ? 'PRA_PT' : 'PASCA_PT';
};

export const eraLabel = (era: EntityEra): string => (era === 'PRA_PT' ? 'Pra-PT' : 'Pasca-PT');

/** Kunci bulan 'YYYY-MM' milik entitas yang berjalan pada bulan itu. */
export const entityForMonthKey = (registry: EntityRegistry, monthKey: string): EntityProfile | null => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null;
  return entityForDateKey(registry, `${monthKey}-01`);
};

/**
 * Pindahkan tanggal transisi. Rentang kedua entitas disusun ulang, riwayat
 * perubahan ditambah, dan penutupan buku ikut digeser bila sudah jatuh sesudah
 * transisi baru. Histori transaksi tidak disentuh.
 */
export const setTransitionDate = (
  registry: EntityRegistry,
  nextTransitionDate: string,
  actor = 'sistem'
): { registry: EntityRegistry; accepted: boolean; reason: string } => {
  const key = toEntityDateKey(nextTransitionDate);
  if (!isValidEntityDateKey(key)) {
    return { registry, accepted: false, reason: 'Tanggal transisi belum terbaca. Gunakan format tanggal yang benar.' };
  }
  if (key <= EARLIEST_BOOK_DATE) {
    return {
      registry,
      accepted: false,
      reason: `Tanggal transisi harus sesudah ${formatEntityDateKey(EARLIEST_BOOK_DATE)} agar histori tetap ada.`,
    };
  }
  if (key === registry.transitionDate) {
    return { registry, accepted: false, reason: 'Tanggal transisi sudah memakai tanggal ini.' };
  }

  const next = normalizeEntityRegistry({ ...registry, transitionDate: key });
  const closed = next.closedThroughDate && next.closedThroughDate >= key ? lastDayBefore(key) : next.closedThroughDate;
  const change: EntityChangeRecord = {
    id: `chg_${key}_${Date.now()}`,
    recordedAt: new Date().toISOString(),
    effectiveDate: key,
    fromEntityId: ENTITY_ID_PERORANGAN,
    toEntityId: ENTITY_ID_PT,
    toKind: 'PT',
    note: `Tanggal efektif perubahan entitas diubah ke ${formatEntityDateKey(key)}.`,
    actor,
  };

  return {
    registry: normalizeEntityRegistry({
      ...next,
      closedThroughDate: closed,
      history: [...next.history.filter((entry) => entry.effectiveDate !== key), change],
    }),
    accepted: true,
    reason: '',
  };
};

/**
 * Tutup buku pembukuan lama; tanggal sesudahnya tidak boleh diubah lagi.
 * Setiap perubahan status penutupan dicatat di riwayat bersama nama yang
 * melakukannya, supaya jejak migrasi bisa dibaca kembali.
 */
export const setClosedThroughDate = (
  registry: EntityRegistry,
  dateKey: string | null,
  actor = ''
): EntityRegistry => {
  const key = dateKey === null ? null : toEntityDateKey(dateKey);
  if (dateKey !== null && !isValidEntityDateKey(key)) return registry;
  const next = normalizeEntityRegistry({ ...registry, closedThroughDate: key });
  if (key === registry.closedThroughDate) return next;

  const closingEntity = key ? entityForDateKey(next, key) : null;
  const openingEntity = entityForDateKey(next, next.transitionDate);
  const change: EntityChangeRecord = {
    id: `clo_${key || 'buka'}_${Date.now()}`,
    recordedAt: new Date().toISOString(),
    effectiveDate: key || next.transitionDate,
    fromEntityId: closingEntity?.id ?? null,
    toEntityId: openingEntity?.id ?? ENTITY_ID_PT,
    toKind: openingEntity?.kind ?? 'PT',
    note: key
      ? `Buku ${formatEntityDateKey(key)} ke bawah ditutup. Jurnal baru untuk tanggal itu ditolak.`
      : 'Penutupan buku dibuka kembali; tanggal lama boleh diperbaiki lagi.',
    actor: actor || 'sistem',
  };
  return normalizeEntityRegistry({ ...next, history: [...next.history, change] });
};

export const isDateLocked = (registry: EntityRegistry, dateKey: string): boolean => {
  const key = toEntityDateKey(dateKey);
  if (!key || !registry.closedThroughDate) return false;
  return key <= registry.closedThroughDate;
};

/** Rentang tanggal sebuah entitas untuk kop laporan. */
export const entityPeriodLabel = (entity: EntityProfile): string => {
  const start = formatEntityDateKey(entity.startDate);
  const end = entity.endDate ? formatEntityDateKey(entity.endDate) : 'sekarang';
  return `${start} - ${end}`;
};

/**
 * Kelengkapan isian pajak satu entitas. Yang belum dipilih diminta, tidak
 * digantikan tarif taksiran — pajak dua entitas dihitung terpisah dan hanya
 * dari isian pemiliknya.
 */
export const taxProfileProblems = (entity: EntityProfile): string[] => {
  const label = entity.tradeName || ENTITY_KIND_LABEL[entity.kind];
  const problems: string[] = [];
  if (entity.kind === 'PERORANGAN' && entity.tax.regime === 'BADAN') {
    problems.push(`${label}: usaha perorangan tidak dikenai PPh Badan.`);
  }
  if (entity.tax.regime === 'BELUM_DISETTEL') {
    problems.push(`${label}: cara penghitungan pajaknya belum dipilih.`);
  }
  if (entity.tax.regime === 'PP55_OP' && entity.tax.finalRatePercent === null) {
    problems.push(`${label}: tarif PPh Final belum diisi, jadi pajaknya tidak dihitung.`);
  }
  if (entity.tax.regime === 'BADAN' && entity.tax.corporateRatePercent === null) {
    problems.push(`${label}: tarif PPh Badan belum diisi, jadi pajaknya tidak dihitung.`);
  }
  return problems;
};

/**
 * Periksaan yang harus lulus sebelum tanggal transisi dipakai.
 * Daftarnya dibaca operator apa adanya, bukan dibaguskan.
 */
export const validateEntityRegistry = (registry: EntityRegistry): string[] => {
  const problems: string[] = [];
  if (registry.entities.length === 0) problems.push('Belum ada entitas usaha yang terdaftar.');
  if (peroranganEntity(registry) === null) {
    problems.push('Entitas lama (Dagang Perorangan) belum ada, padahal histori 2022 ke atas butuh pemilik.');
  }
  if (ptEntity(registry) === null) problems.push('Entitas PT belum terdaftar.');

  const active = registry.entities.filter((entity) => entity.active);
  if (active.length !== 1) {
    problems.push(`Harus ada satu entitas berjalan; saat ini ada ${active.length}.`);
  }
  for (const entity of registry.entities) {
    if (!isValidEntityDateKey(entity.startDate)) {
      problems.push(`${entity.legalName}: tanggal mulai belum diisi.`);
    }
    if (entity.endDate && entity.endDate < entity.startDate) {
      problems.push(`${entity.legalName}: tanggal akhir mendahului tanggal mulai.`);
    }
    if (entity.active && entity.endDate) {
      problems.push(`${entity.legalName}: entitas berjalan tidak boleh punya tanggal akhir.`);
    }
    if (entity.kind === 'PT' && !entity.legalDocNumber) {
      problems.push(`${entity.legalName}: nomor akta pendirian belum diisi (diperlukan untuk laporan resmi).`);
    }
    if (entity.kind === 'PT' && entity.legalName === ENTITY_KIND_LABEL.PT) {
      problems.push('Nama PT sesuai dokumen hukum belum diisi. Laporan resmi memakai nama asli dari akta, bukan sebutan bentuk usaha.');
    }
    problems.push(...taxProfileProblems(entity));
  }

  const sorted = registry.entities
    .filter((entity) => isValidEntityDateKey(entity.startDate))
    .slice()
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.endDate === null) {
      problems.push(`${previous.legalName}: masih berjalan padahal ada entitas sesudahnya.`);
    } else if (current.startDate !== shiftEntityDateKey(previous.endDate, 1)) {
      problems.push(`Ada celah tanggal antara ${previous.legalName} dan ${current.legalName}.`);
    }
  }
  return problems;
};
