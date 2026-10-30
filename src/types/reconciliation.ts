/**
 * Tipe modul Rekonsiliasi (tab Laporan).
 *
 * Dua jenis analisa:
 * - VARIANS: membandingkan rencana (Laporan A) dengan capaian (Laporan B).
 * - KOMPARATIF: membandingkan laporan yang sama pada dua periode
 *   (Laporan A = periode acuan, Laporan B = periode pembanding).
 *
 * Satu analisa punya beberapa kolom pembanding (kuantitas, frekuensi, nominal),
 * dan tiap baris punya satu angka untuk tiap kolom pada kedua laporan.
 */

export type ReconciliationKind = 'VARIANS' | 'KOMPARATIF';

/**
 * Sifat baris menentukan bagaimana selisih dibaca pada analisa varians.
 * - PENDAPATAN / BIAYA: dinilai untung atau tidak menguntungkan.
 * - PERBANDINGAN: angka A dan B hanya dibandingkan, tidak dinilai untung/rugi.
 */
export type ReconciliationRowNature = 'PENDAPATAN' | 'BIAYA' | 'PERBANDINGAN';

/** Cara angka sebuah kolom dibaca: uang atau hitungan (pcs, lembar, kali). */
export type ReconciliationColumnKind = 'UANG' | 'JUMLAH';

/**
 * Arah menguntungkan sebuah kolom pada analisa varians.
 * ROW berarti mengikuti sifat baris (pendapatan/biaya).
 */
export type ReconciliationColumnDirection = 'ROW' | 'NAIK' | 'TURUN';

export interface ReconciliationColumn {
  id: string;
  label: string;
  kind: ReconciliationColumnKind;
  direction: ReconciliationColumnDirection;
}

/** Sepasang angka untuk satu kolom: Laporan A dan Laporan B. */
export interface ReconciliationCell {
  a: number;
  b: number;
}

/** Satu baris isian; angkanya disimpan per kolom lewat `values`. */
export interface ReconciliationRow {
  id: string;
  label: string;
  nature: ReconciliationRowNature;
  /** Kunci = id kolom. Kolom yang tidak ada entri dianggap nol. */
  values: Record<string, ReconciliationCell>;
}

/**
 * Kesimpulan satu sel. GOOD/BAD/MATCH dibaca untung-rugi (varians) atau
 * naik-turun (komparatif); NETRAL khusus baris Perbandingan pada analisa varians.
 */
export type ReconciliationVerdict = 'GOOD' | 'BAD' | 'MATCH' | 'NETRAL';

export interface ReconciliationCellResult {
  columnId: string;
  valueA: number;
  valueB: number;
  /** Varians: A - B. Komparatif: B - A. */
  difference: number;
  /** Selisih terhadap Laporan A dalam persen (2 desimal); null bila Laporan A nol. */
  percent: number | null;
  /** NETRAL hanya untuk baris Perbandingan pada analisa varians. */
  verdict: ReconciliationVerdict;
  /** Alasan persen tidak tersedia, ditampilkan apa adanya di layar. */
  percentUnavailable: boolean;
}

export interface ReconciliationRowResult {
  id: string;
  label: string;
  nature: ReconciliationRowNature;
  /** Satu hasil per kolom, urut sama dengan analysis.columns. */
  cells: ReconciliationCellResult[];
}

/** Jumlah dan hitungan kesimpulan untuk satu kolom pembanding. */
export interface ReconciliationColumnSummary {
  columnId: string;
  label: string;
  kind: ReconciliationColumnKind;
  totalA: number;
  totalB: number;
  totalDifference: number;
  totalPercent: number | null;
  goodCount: number;
  badCount: number;
  matchCount: number;
  /** Baris Perbandingan pada analisa varians: dibandingkan tanpa dinilai untung/rugi. */
  neutralCount: number;
}

export interface ReconciliationAnalysis {
  kind: ReconciliationKind;
  generatedAt: number;
  /** Kolom yang ikut dinilai saat analisa dijalankan. */
  columns: ReconciliationColumn[];
  rows: ReconciliationRowResult[];
  summaries: ReconciliationColumnSummary[];
  /** Baris terisi (label + minimal satu angka) yang ikut dihitung. */
  countedRows: number;
}

export interface ReconciliationRun {
  id: string;
  kind: ReconciliationKind;
  title: string;
  /** Judul kolom A, contoh "Target Oktober 2026". */
  labelA: string;
  /** Judul kolom B, contoh "Realisasi Oktober 2026". */
  labelB: string;
  columns: ReconciliationColumn[];
  rows: ReconciliationRow[];
  analysis: ReconciliationAnalysis | null;
  notes: string;
  createdAt: number;
  updatedAt: number;
  authorId?: string;
  authorName?: string;
}
