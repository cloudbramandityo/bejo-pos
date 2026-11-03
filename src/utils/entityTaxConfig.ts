/**
 * Pemisahan pajak per entitas usaha (brief butir 11).
 *
 * Dua bentuk usaha dalam satu tahun pajak menghitung pajaknya masing-masing:
 *   - tarif dibaca dari isian pemilik pada profil entitas, bukan dari angka
 *     yang ditulis di kode atau di layar;
 *   - bulan yang belum punya tarif tidak dihitung, dan itu ditulis apa adanya.
 *
 * Berkas ini murni aturan (tanpa koneksi server) supaya penjaga
 * `npm run check:entity` dapat menjalankannya di Node.
 */

import { TAX_CONFIG_2025 } from '../types/tax';
import {
  ENTITY_KIND_LABEL,
  TAX_REGIME_LABEL,
  appliedTaxRatePercent,
  entityForMonthKey,
  eraLabel,
  lastDayBefore,
  ptEntity,
  peroranganEntity,
  taxProfileProblems,
  type EntityProfile,
  type EntityRegistry,
  type TaxRegime,
} from './entityRegistry';

/** Tarif PPh Final yang tertulis di konfigurasi pajak aplikasi (persen). */
export const CONFIG_UMKM_TARIFF_PERCENT = TAX_CONFIG_2025.umkmPp55Rate * 100;

export interface EntityTaxPeriod {
  entityId: string;
  entityLabel: string;
  kind: EntityProfile['kind'];
  regime: TaxRegime;
  regimeLabel: string;
  /** Potongan tahun pajak yang dimiliki entitas ini (inklusif). */
  from: string;
  to: string;
  /** Tarif PPh Final entitas; null bila cara pajaknya bukan PPh Final. */
  finalRatePercent: number | null;
  /** Tarif PPh Badan entitas; null bila belum diisi. */
  corporateRatePercent: number | null;
  /** Omzet setahun yang bebas PPh Final menurut isian pemilik. */
  exemptThreshold: number;
  /** Isian yang masih kurang — dibaca layar apa adanya. */
  problems: string[];
}

const yearStart = (year: number): string => `${year}-01-01`;
const yearEnd = (year: number): string => `${year}-12-31`;

const clamp = (value: string, min: string, max: string): string => (value < min ? min : value > max ? max : value);

/** Hari terakhir bulan kunci 'YYYY-MM'. */
const monthLastDay = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(days).padStart(2, '0')}`;
};

const periodOf = (entity: EntityProfile, from: string, to: string): EntityTaxPeriod => ({
  entityId: entity.id,
  entityLabel: entity.tradeName || ENTITY_KIND_LABEL[entity.kind],
  kind: entity.kind,
  regime: entity.tax.regime,
  regimeLabel: TAX_REGIME_LABEL[entity.tax.regime],
  from,
  to,
  finalRatePercent: entity.tax.regime === 'PP55_OP' ? entity.tax.finalRatePercent : null,
  corporateRatePercent: entity.tax.regime === 'BADAN' ? entity.tax.corporateRatePercent : null,
  exemptThreshold: entity.tax.regime === 'PP55_OP' ? entity.tax.exemptThreshold : 0,
  problems: taxProfileProblems(entity),
});

/**
 * Tahun pajak satu entitas: hanya bagian tahun yang benar-benar dimilikinya.
 * Tahun 2026 terbagi dua — Januari–Juni milik perorangan, Juli–Desember milik PT.
 */
export const taxPeriodsForYear = (registry: EntityRegistry, year: number): EntityTaxPeriod[] => {
  const from = yearStart(year);
  const to = yearEnd(year);
  const periods: EntityTaxPeriod[] = [];
  for (const entity of registry.entities) {
    if (!entity.startDate) continue;
    const end = entity.endDate || to;
    if (end < from || entity.startDate > to) continue;
    periods.push(periodOf(entity, clamp(entity.startDate, from, to), clamp(end, from, to)));
  }
  return periods.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
};

/** Pemilik satu bulan kunci 'YYYY-MM' beserta cara pajaknya. */
export const taxPeriodOfMonth = (registry: EntityRegistry, monthKey: string): EntityTaxPeriod | null => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const entity = entityForMonthKey(registry, monthKey);
  if (!entity) return null;
  const lastDay = monthLastDay(monthKey);
  const firstDay = `${monthKey}-01`;
  return periodOf(
    entity,
    clamp(entity.startDate, firstDay, lastDay),
    clamp(entity.endDate || lastDay, firstDay, lastDay)
  );
};

/**
 * Tarif PPh Final untuk satu bulan, atau null bila entitas pemilik bulan itu
 * tidak memakai PPh Final / tarifnya belum diisi.
 */
export const finalTariffPercentForMonth = (registry: EntityRegistry, monthKey: string): number | null => {
  const period = taxPeriodOfMonth(registry, monthKey);
  if (!period) return null;
  return period.finalRatePercent;
};

export interface MonthTariff {
  /** Persen tarif; 0 berarti pajaknya tidak dihitung bulan ini. */
  percent: number;
  /** Kenapa tarifnya begitu — dipakai sebagai catatan billing, bukan alasan karangan. */
  note: string;
}

/**
 * Tarif PPh Final yang dipakai layar billing. Bulan yang pemiliknya tidak dikenal
 * memakai tarif bawaan konfigurasi (perilaku lama); bulan milik entitas yang cara
 * pajaknya bukan PPh Final, atau tarifnya belum diisi, menghasilkan 0 disertai
 * alasan — bukan dihitung dengan tarif entitas lain.
 */
export const billingTariffForMonth = (registry: EntityRegistry, monthKey: string): MonthTariff => {
  const period = taxPeriodOfMonth(registry, monthKey);
  if (!period) return { percent: CONFIG_UMKM_TARIFF_PERCENT, note: '' };
  if (period.regime === 'PP55_OP') {
    if (period.finalRatePercent === null) {
      return { percent: 0, note: `Tarif PPh Final ${period.entityLabel} belum diisi, jadi pajaknya tidak dihitung.` };
    }
    return { percent: period.finalRatePercent, note: '' };
  }
  return {
    percent: 0,
    note: `${period.entityLabel} memakai ${period.regimeLabel}, jadi PPh Final bulanan tidak dihitung.`,
  };
};

/** Kalimat jujur tentang pembagian pajak satu tahun untuk layar & cetak. */
export const taxSeparationNotes = (registry: EntityRegistry, year: number): string[] => {
  const periods = taxPeriodsForYear(registry, year);
  if (periods.length === 0) return [`Belum ada entitas pemilik tahun ${year}, jadi pajak tahun itu tidak dihitung.`];
  const lama = peroranganEntity(registry);
  const baru = ptEntity(registry);
  const notes: string[] = [];
  if (lama && baru && lama.startDate <= yearEnd(year) && baru.startDate <= yearEnd(year)) {
    const split = registry.transitionDate;
    if (split > yearStart(year) && split <= yearEnd(year)) {
      notes.push(
        `Pajak ${year} dihitung terpisah: ${eraLabel('PRA_PT')} s.d. ${lastDayBefore(split)} atas nama ${
          lama.tradeName || ENTITY_KIND_LABEL.PERORANGAN
        }, ${eraLabel('PASCA_PT')} mulai ${split} atas nama ${baru.tradeName || ENTITY_KIND_LABEL.PT}.`
      );
    }
  }
  for (const period of periods) {
    if (period.problems.length > 0) {
      notes.push(`${period.entityLabel} (${period.from} s.d. ${period.to}): ${period.problems.join(' ')}`);
    }
  }
  return notes;
};

/** Tarif yang berlaku menurut cara pajak yang dipilih entitas. */
export const effectiveTaxRatePercent = (entity: EntityProfile): number | null => appliedTaxRatePercent(entity);
