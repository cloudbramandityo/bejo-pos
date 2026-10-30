/**
 * Mesin hitung Rekonsiliasi.
 *
 * Aturan yang diuji di scripts/check-reconciliation.mts:
 * - Satu analisa punya beberapa kolom pembanding (kuantitas, frekuensi, nominal).
 *   Setiap kolom dinilai terpisah: angkanya tidak boleh dicampur antar kolom.
 * - Varians: selisih = Laporan A - Laporan B (rencana dikurangi capaian).
 *   Arah menguntungkan mengikuti sifat baris (pendapatan di atas rencana, biaya di
 *   bawah rencana), kecuali kolomnya memberi arah sendiri. Baris bersifat
 *   Perbandingan tidak dinilai untung/rugi: selisihnya tetap A - B, kesimpulannya
 *   hanya menyebut mana yang lebih besar.
 * - Komparatif: selisih = Laporan B - Laporan A (periode pembanding dikurangi periode acuan).
 *   Naik bila positif, turun bila negatif; sifat baris diabaikan.
 * - Persen selalu terhadap Laporan A. Laporan A nol berarti persennya tidak ada,
 *   jadi ditampilkan kosong, bukan angka karangan.
 * - Baris tanpa nama atau tanpa angka sama sekali tidak ikut dihitung.
 */
import {
  ReconciliationAnalysis,
  ReconciliationCell,
  ReconciliationColumn,
  ReconciliationColumnDirection,
  ReconciliationColumnKind,
  ReconciliationColumnSummary,
  ReconciliationKind,
  ReconciliationRow,
  ReconciliationRowNature,
  ReconciliationRowResult,
  ReconciliationVerdict,
} from '../types/reconciliation';
import { formatRupiah } from './formatters';

const MONEY_DP = 2;

const roundMoney = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** MONEY_DP;
  return Math.round(value * factor) / factor;
};

const roundPercent = (value: number): number => Math.round(value * 100) / 100;

export const toReconciliationNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '')
    .replace(/[^0-9.,-]/g, '')
    .replace(/\.(?=[0-9]{3}([^0-9]|$))/g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

let idSequence = 0;

const nextId = (prefix: string): string => {
  idSequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSequence}_${Math.random().toString(36).slice(2, 6)}`;
};

const isColumnKind = (value: unknown): value is ReconciliationColumnKind =>
  value === 'JUMLAH' || value === 'UANG';

const isColumnDirection = (value: unknown): value is ReconciliationColumnDirection =>
  value === 'NAIK' || value === 'TURUN' || value === 'ROW';

const isRowNature = (value: unknown): value is ReconciliationRowNature =>
  value === 'PENDAPATAN' || value === 'BIAYA' || value === 'PERBANDINGAN';

/**
 * Sifat baris dari data tersimpan. Nilai yang tidak dikenal diperlakukan sebagai
 * Perbandingan supaya barisnya tidak ikut dinilai untung/rugi tanpa dasar.
 */
export const normalizeRowNature = (value: unknown): ReconciliationRowNature =>
  isRowNature(value) ? value : 'PERBANDINGAN';

export const createReconciliationColumn = (
  seed: Partial<ReconciliationColumn> = {}
): ReconciliationColumn => ({
  id: seed.id || nextId('rccol'),
  label: seed.label ?? '',
  kind: isColumnKind(seed.kind) ? seed.kind : 'UANG',
  direction: isColumnDirection(seed.direction) ? seed.direction : 'ROW',
});

export const createReconciliationRow = (
  seed: Partial<ReconciliationRow> = {}
): ReconciliationRow => ({
  id: seed.id || nextId('rcrow'),
  label: seed.label ?? '',
  nature: normalizeRowNature(seed.nature),
  values: Object.fromEntries(
    Object.entries(seed.values ?? {}).map(([columnId, cell]) => [
      columnId,
      {
        a: roundMoney(toReconciliationNumber((cell as ReconciliationCell)?.a)),
        b: roundMoney(toReconciliationNumber((cell as ReconciliationCell)?.b)),
      },
    ])
  ),
});

/** Kolom bawaan: satu kolom uang, sama seperti laporan satu angka. */
export function createDefaultColumns(kind: ReconciliationKind): ReconciliationColumn[] {
  return [
    createReconciliationColumn({
      id: kind === 'VARIANS' ? 'rccol_nominal_varians' : 'rccol_nominal_komparatif',
      label: 'Nominal',
      kind: 'UANG',
      direction: 'ROW',
    }),
  ];
}

/** Contoh tiga kolom untuk membandingkan laporan pengambilan agen. */
export function createPickupColumns(): ReconciliationColumn[] {
  return [
    createReconciliationColumn({ label: 'Kuantitas diambil', kind: 'JUMLAH', direction: 'NAIK' }),
    createReconciliationColumn({ label: 'Frekuensi ambil', kind: 'JUMLAH', direction: 'NAIK' }),
    createReconciliationColumn({ label: 'Total nominal', kind: 'UANG', direction: 'ROW' }),
  ];
}

/**
 * Baris bawaan sebuah analisa baru. Namanya sudah menyebut isinya, jadi sifatnya
 * ikut nama itu; baris tambahan yang belum bernama memakai Perbandingan.
 */
const DEFAULT_ROW_SEEDS: { label: string; nature: ReconciliationRowNature }[] = [
  { label: 'Pendapatan', nature: 'PENDAPATAN' },
  { label: 'Beban tetap', nature: 'BIAYA' },
  { label: 'Beban variabel', nature: 'BIAYA' },
  { label: 'Bahan baku', nature: 'BIAYA' },
  { label: 'Biaya operasional', nature: 'BIAYA' },
];

export function createDefaultRows(): ReconciliationRow[] {
  return DEFAULT_ROW_SEEDS.map((seed) => createReconciliationRow(seed));
}

/** Nilai contoh baris pengambilan agen (satu agen per baris). */
export function createPickupRows(): ReconciliationRow[] {
  return ['Agen A', 'Agen B', 'Agen C'].map((label) =>
    createReconciliationRow({ label, nature: 'PENDAPATAN' })
  );
}

export const getCellValues = (
  row: ReconciliationRow,
  columnId: string
): { valueA: number; valueB: number } => {
  const cell = row?.values?.[columnId];
  return {
    valueA: roundMoney(toReconciliationNumber(cell?.a)),
    valueB: roundMoney(toReconciliationNumber(cell?.b)),
  };
};

const isNamedRow = (row: ReconciliationRow): boolean => String(row?.label ?? '').trim().length > 0;

/** Baris ikut dihitung bila bernama dan minimal satu kolomnya berisi angka. */
const isCountedRow = (row: ReconciliationRow, columns: ReconciliationColumn[]): boolean => {
  if (!isNamedRow(row)) return false;
  return columns.some((column) => {
    const { valueA, valueB } = getCellValues(row, column.id);
    return valueA !== 0 || valueB !== 0;
  });
};

const resolveDirection = (
  column: ReconciliationColumn,
  nature: ReconciliationRowNature
): ReconciliationColumnDirection =>
  column.direction !== 'ROW'
    ? column.direction
    : nature === 'BIAYA'
      ? 'TURUN'
      : 'NAIK';

/**
 * Baris Perbandingan tidak dinilai untung/rugi, apa pun arah kolomnya:
 * pemakainya sedang membandingkan dua subjek (misalnya dua agen), bukan rencana
 * dengan capaian.
 */
const isPureComparison = (kind: ReconciliationKind, nature: ReconciliationRowNature): boolean =>
  kind === 'VARIANS' && nature === 'PERBANDINGAN';

const varianceVerdict = (
  column: ReconciliationColumn,
  nature: ReconciliationRowNature,
  movement: number
): ReconciliationVerdict => {
  if (movement === 0) return 'MATCH';
  const wantsUp = resolveDirection(column, nature) === 'NAIK';
  return wantsUp === movement > 0 ? 'GOOD' : 'BAD';
};

const comparativeVerdict = (movement: number): ReconciliationVerdict => {
  if (movement > 0) return 'GOOD';
  if (movement < 0) return 'BAD';
  return 'MATCH';
};

const percentOf = (
  difference: number,
  base: number
): { percent: number | null; unavailable: boolean } => {
  if (base === 0) return { percent: null, unavailable: true };
  return { percent: roundPercent((difference / base) * 100), unavailable: false };
};

export function analyzeReconciliation(
  kind: ReconciliationKind,
  rows: ReconciliationRow[],
  columns: ReconciliationColumn[]
): ReconciliationAnalysis {
  const cols = (Array.isArray(columns) ? columns : []).filter((column) => column?.id);
  const source = Array.isArray(rows) ? rows : [];
  const counted = source.filter((row) => isCountedRow(row, cols));

  const totals = new Map<
    string,
    { totalA: number; totalB: number; good: number; bad: number; match: number; neutral: number }
  >();
  for (const column of cols) {
    totals.set(column.id, { totalA: 0, totalB: 0, good: 0, bad: 0, match: 0, neutral: 0 });
  }

  const resultRows: ReconciliationRowResult[] = counted.map((row) => {
    const nature = normalizeRowNature(row.nature);
    const compareOnly = isPureComparison(kind, nature);
    const cells = cols.map((column) => {
      const { valueA, valueB } = getCellValues(row, column.id);
      const movement = roundMoney(valueB - valueA);
      const difference = roundMoney(kind === 'VARIANS' ? valueA - valueB : valueB - valueA);
      const { percent, unavailable } = percentOf(difference, valueA);
      const verdict: ReconciliationVerdict = compareOnly
        ? 'NETRAL'
        : kind === 'VARIANS'
          ? varianceVerdict(column, nature, movement)
          : comparativeVerdict(movement);

      const bucket = totals.get(column.id);
      if (bucket) {
        bucket.totalA += valueA;
        bucket.totalB += valueB;
        if (verdict === 'GOOD') bucket.good += 1;
        else if (verdict === 'BAD') bucket.bad += 1;
        else if (verdict === 'NETRAL') bucket.neutral += 1;
        else bucket.match += 1;
      }

      return {
        columnId: column.id,
        valueA,
        valueB,
        difference,
        percent,
        verdict,
        percentUnavailable: unavailable,
      };
    });

    return { id: row.id, label: String(row.label ?? '').trim(), nature, cells };
  });

  const summaries: ReconciliationColumnSummary[] = cols.map((column) => {
    const bucket =
      totals.get(column.id) ??
      { totalA: 0, totalB: 0, good: 0, bad: 0, match: 0, neutral: 0 };
    const roundedTotalA = roundMoney(bucket.totalA);
    const roundedTotalB = roundMoney(bucket.totalB);
    const totalDifference = roundMoney(
      kind === 'VARIANS' ? roundedTotalA - roundedTotalB : roundedTotalB - roundedTotalA
    );
    return {
      columnId: column.id,
      label: column.label,
      kind: isColumnKind(column.kind) ? column.kind : 'UANG',
      totalA: roundedTotalA,
      totalB: roundedTotalB,
      totalDifference,
      totalPercent:
        roundedTotalA === 0 ? null : roundPercent((totalDifference / roundedTotalA) * 100),
      goodCount: bucket.good,
      badCount: bucket.bad,
      matchCount: bucket.match,
      neutralCount: bucket.neutral,
    };
  });

  return {
    kind,
    generatedAt: Date.now(),
    columns: cols.map((column) => createReconciliationColumn(column)),
    rows: resultRows,
    summaries,
    countedRows: resultRows.length,
  };
}

/** Persen gaya Indonesia: koma desimal dan tanda arah; kosong bila tidak ada dasar. */
export function formatPercentValue(percent: number | null | undefined): string {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return '-';
  const fixed = Math.abs(percent).toFixed(2).replace('.', ',');
  if (percent > 0) return `+${fixed}%`;
  if (percent < 0) return `-${fixed}%`;
  return '0,00%';
}

/** Angka kolom: uang memakai format rupiah, hitungan memakai angka biasa. */
export function formatColumnValue(
  kind: ReconciliationColumnKind | undefined,
  value: number
): string {
  if (kind === 'JUMLAH') {
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  }
  // Tanda minus di depan "Rp" supaya selisih negatif terbaca sebagai pengurang,
  // bukan sebagai bagian dari nama mata uang.
  if (Number.isFinite(value) && value < 0) {
    const rounded = Math.round(Math.abs(value));
    return rounded > 0 ? `-Rp ${rounded.toLocaleString('id-ID')}` : 'Rp 0';
  }
  return formatRupiah(value);
}

export function columnKindLabel(kind: ReconciliationColumnKind | undefined): string {
  return kind === 'JUMLAH' ? 'Jumlah' : 'Uang';
}

/** Label kesimpulan satu sel, dipakai tabel hasil dan berkas PDF. */
export function verdictLabel(
  kind: ReconciliationKind,
  verdict: ReconciliationVerdict,
  difference = 0
): string {
  // Baris Perbandingan: arahnya dibaca dari selisih yang tampil di sebelahnya.
  if (verdict === 'NETRAL') {
    if (difference < 0) return 'Laporan B lebih besar';
    if (difference > 0) return 'Laporan B lebih kecil';
    return 'Sama besar';
  }
  if (kind === 'VARIANS') {
    if (verdict === 'GOOD') return 'Menguntungkan';
    if (verdict === 'BAD') return 'Tidak menguntungkan';
    return 'Sesuai rencana';
  }
  if (verdict === 'GOOD') return 'Naik';
  if (verdict === 'BAD') return 'Turun';
  return 'Tetap';
}

/** Urutan pilihan sifat baris di layar; Perbandingan paling dulu karena itu bawaannya. */
export const ROW_NATURES: ReconciliationRowNature[] = ['PERBANDINGAN', 'PENDAPATAN', 'BIAYA'];

/** Nama sifat baris seperti yang muncul di dropdown isian. */
export function natureLabel(nature: ReconciliationRowNature): string {
  if (nature === 'BIAYA') return 'Biaya/Beban';
  if (nature === 'PERBANDINGAN') return 'Perbandingan';
  return 'Pendapatan';
}

/** Hitungan kesimpulan satu kolom; baris Perbandingan disebut terpisah. */
export function summaryCountsText(
  kind: ReconciliationKind,
  summary: ReconciliationColumnSummary | undefined
): string {
  const isVarians = kind === 'VARIANS';
  const parts = [
    `${isVarians ? 'Menguntungkan' : 'Naik'}: ${summary?.goodCount ?? 0}`,
    `${isVarians ? 'Tidak menguntungkan' : 'Turun'}: ${summary?.badCount ?? 0}`,
    `${isVarians ? 'Sesuai rencana' : 'Tetap'}: ${summary?.matchCount ?? 0}`,
  ];
  if ((summary?.neutralCount ?? 0) > 0) parts.push(`Dibandingkan: ${summary?.neutralCount}`);
  return parts.join(' • ');
}

export function defaultLabelsFor(kind: ReconciliationKind): { labelA: string; labelB: string } {
  return kind === 'VARIANS'
    ? { labelA: 'Laporan A (Rencana)', labelB: 'Laporan B (Capaian)' }
    : { labelA: 'Laporan A (Periode Acuan)', labelB: 'Laporan B (Periode Pembanding)' };
}

export function defaultTitleFor(kind: ReconciliationKind): string {
  return kind === 'VARIANS' ? 'Analisis Varians' : 'Analisis Komparatif';
}

/** Judul kolom selisih, dipakai tabel hasil dan PDF. */
export function differenceHeading(kind: ReconciliationKind): string {
  return kind === 'VARIANS' ? 'Varians (A - B)' : 'Selisih (B - A)';
}
