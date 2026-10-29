import { convertDdMmYyToYyyyMmDd } from './formatters';

/**
 * Periode riwayat agen (tab Agen) dan rekap PDF-nya.
 *
 * Tanggal transaksi Kasir POS tersimpan 'DD/MM/YY' sedangkan mutasi stok
 * 'YYYY-MM-DD'. Semua perbandingan di modul ini memakai kunci tanggal lokal
 * 'YYYY-MM-DD' hasil normalisasi supaya satu format lama tidak membuat baris
 * hilang dari daftar maupun berkas PDF.
 */

export type RecapPeriodType = 'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'KUSTOM';

export interface RecapPeriodConfig {
  periodType: RecapPeriodType;
  /** 'YYYY-MM-DD' — hari untuk HARIAN, tanggal acuan minggu untuk MINGGUAN. */
  date: string;
  /** 0-based, dipakai BULANAN. */
  month: number;
  year: number;
  /** Batas rentang inklusif, dipakai KUSTOM (boleh terbalik, dinormalkan di sini). */
  rangeFrom: string;
  rangeTo: string;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

const dayKeyOfDate = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 'YYYY-MM-DD' dari nilai tanggal transaksi format apa pun ('' bila tidak jelas). */
export const toAgentDateKey = (value?: string): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return convertDdMmYyToYyyyMmDd(raw.split(/[T ]/)[0]);
};

/** Kunci bulan 'YYYY-MM' sebuah transaksi; `timestamp` dipakai bila tanggal kosong. */
export const getAgentMonthKey = (tx: { date?: string; timestamp?: number }): string => {
  const dateKey = toAgentDateKey(tx.date);
  if (dateKey) return dateKey.slice(0, 7);
  if (tx.timestamp && tx.timestamp > 0) {
    const d = new Date(tx.timestamp);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }
  return '';
};

/** Kunci hari 'YYYY-MM-DD' sebuah transaksi; `timestamp` dipakai bila tanggal kosong. */
export const getAgentDayKey = (tx: { date?: string; timestamp?: number }): string => {
  const dateKey = toAgentDateKey(tx.date);
  if (dateKey) return dateKey;
  if (tx.timestamp && tx.timestamp > 0) {
    const d = new Date(tx.timestamp);
    return dayKeyOfDate(d);
  }
  return '';
};

export const getCurrentLocalMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

/** Batas inklusif minggu Senin–Minggu yang memuat `dateKey`. */
export const getWeekRangeKeys = (dateKey: string): { from: string; to: string } => {
  const target = new Date(`${dateKey}T00:00:00`);
  if (isNaN(target.getTime())) return { from: dateKey, to: dateKey };
  const day = target.getDay();
  target.setDate(target.getDate() - day + (day === 0 ? -6 : 1));
  const from = dayKeyOfDate(target);
  target.setDate(target.getDate() + 6);
  const to = dayKeyOfDate(target);
  return { from, to };
};

/** Rentang selalu bawah/atas, apa pun urutan input pengguna. */
export const normalizeAgentDateRange = (from: string, to: string): { from: string; to: string } =>
  from <= to ? { from, to } : { from: to, to: from };

/** Satu predikat periode untuk daftar riwayat, pratinjau, dan berkas PDF. */
export const matchesRecapPeriod = (
  tx: { date?: string; timestamp?: number },
  config: RecapPeriodConfig
): boolean => {
  const dayKey = getAgentDayKey(tx);
  if (!dayKey) return false;

  if (config.periodType === 'HARIAN') return dayKey === config.date;

  if (config.periodType === 'KUSTOM') {
    const bounds = normalizeAgentDateRange(config.rangeFrom, config.rangeTo);
    return dayKey >= bounds.from && dayKey <= bounds.to;
  }

  if (config.periodType === 'MINGGUAN') {
    const week = getWeekRangeKeys(config.date);
    return dayKey >= week.from && dayKey <= week.to;
  }

  return dayKey.slice(0, 7) === `${config.year}-${pad2(config.month + 1)}`;
};

/** Label tanggal panjang berbahasa Indonesia untuk header/label periode. */
export const formatRecapDayLabel = (dayKey: string): string => {
  if (!dayKey) return '-';
  const d = new Date(`${dayKey}T00:00:00`);
  if (isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Label periode siap pakai untuk judul PDF dan banner riwayat. */
export const buildRecapPeriodLabel = (config: RecapPeriodConfig): string => {
  if (config.periodType === 'HARIAN') return formatRecapDayLabel(config.date);

  if (config.periodType === 'MINGGUAN') {
    const week = getWeekRangeKeys(config.date);
    return `Minggu ${formatRecapDayLabel(week.from)} s.d ${formatRecapDayLabel(week.to)}`;
  }

  if (config.periodType === 'KUSTOM') {
    const bounds = normalizeAgentDateRange(config.rangeFrom, config.rangeTo);
    return `${formatRecapDayLabel(bounds.from)} s.d ${formatRecapDayLabel(bounds.to)}`;
  }

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${monthNames[config.month] || config.month + 1} ${config.year}`;
};
