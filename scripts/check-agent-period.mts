/**
 * Uji regresi periode Riwayat Pengambilan agen (rentang tanggal) dan rekap PDF-nya.
 * Jalankan: npm run check:agent-period
 */
import assert from 'node:assert/strict';
import {
  buildRecapPeriodLabel,
  getAgentDayKey,
  getAgentMonthKey,
  matchesRecapPeriod,
  normalizeAgentDateRange,
  getWeekRangeKeys,
  toAgentDateKey,
  type RecapPeriodConfig
} from '../src/utils/agentHistoryPeriod';

let passed = 0;
const check = (label: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`   ok  ${label}`);
};

const config = (overrides: Partial<RecapPeriodConfig> = {}): RecapPeriodConfig => ({
  periodType: 'KUSTOM',
  date: '2026-10-29',
  month: 9,
  year: 2026,
  rangeFrom: '2026-10-01',
  rangeTo: '2026-10-31',
  ...overrides,
});

// 1. Normalisasi format tanggal lama
check('tanggal YYYY-MM-DD dan DD/MM/YY jadi kunci hari yang sama', () => {
  assert.equal(toAgentDateKey('2026-10-26'), '2026-10-26');
  assert.equal(toAgentDateKey('26/10/26'), '2026-10-26');
  assert.equal(toAgentDateKey('2026-10-26T14:05:00'), '2026-10-26');
  assert.equal(toAgentDateKey(''), '');
});

check('kunci hari memakai timestamp bila tanggal tidak terbaca', () => {
  const localNoon = new Date(2026, 9, 15, 12, 0, 0).getTime();
  assert.equal(getAgentDayKey({ date: 'bukan-tanggal', timestamp: localNoon }), '2026-10-15');
  assert.equal(getAgentDayKey({ date: '15/10/26' }), '2026-10-15');
  assert.equal(getAgentMonthKey({ date: '15/10/26' }), '2026-10');
  assert.equal(getAgentDayKey({}), '');
});

// 2. Batas minggu (Senin–Minggu), termasuk acuan Minggu
check('minggu selalu Senin s.d Minggu', () => {
  assert.deepEqual(getWeekRangeKeys('2026-10-29'), { from: '2026-10-26', to: '2026-11-01' });
  assert.deepEqual(getWeekRangeKeys('2026-10-26'), { from: '2026-10-26', to: '2026-11-01' });
  assert.deepEqual(getWeekRangeKeys('2026-11-01'), { from: '2026-10-26', to: '2026-11-01' });
});

check('rentang terbalik dinormalkan tanpa menukar hasil', () => {
  assert.deepEqual(normalizeAgentDateRange('2026-10-20', '2026-10-05'), { from: '2026-10-05', to: '2026-10-20' });
});

// 3. Rentang tanggal manual: inklusif di kedua ujung, termasuk data lama
check('periode KUSTOM inklusif dan menerima format lama', () => {
  const cfg = config({ rangeFrom: '2026-10-10', rangeTo: '2026-10-12' });
  assert.equal(matchesRecapPeriod({ date: '2026-10-10' }, cfg), true);
  assert.equal(matchesRecapPeriod({ date: '2026-10-12T23:59:00' }, cfg), true);
  assert.equal(matchesRecapPeriod({ date: '11/10/26' }, cfg), true, 'baris DD/MM/YY tidak boleh hilang');
  assert.equal(matchesRecapPeriod({ date: '2026-10-09' }, cfg), false);
  assert.equal(matchesRecapPeriod({ date: '2026-10-13' }, cfg), false);
  assert.equal(matchesRecapPeriod({ date: '2026-11-01' }, cfg), false);
  assert.equal(matchesRecapPeriod({ date: '', timestamp: 0 }, cfg), false, 'tanpa tanggal tidak boleh ikut');
});

check('periode KUSTOM memakai acuan bulan lain bila rentang dibalik', () => {
  const cfg = config({ rangeFrom: '2026-10-12', rangeTo: '2026-10-10' });
  assert.equal(matchesRecapPeriod({ date: '2026-10-11' }, cfg), true);
  assert.equal(matchesRecapPeriod({ date: '2026-10-13' }, cfg), false);
});

// 4. Periode lama harus tetap berlaku seperti sebelumnya
check('periode HARIAN hanya mengambil satu hari', () => {
  const cfg = config({ periodType: 'HARIAN', date: '2026-10-29' });
  assert.equal(matchesRecapPeriod({ date: '2026-10-29' }, cfg), true);
  assert.equal(matchesRecapPeriod({ date: '29/10/26' }, cfg), true, 'POS lama format DD/MM/YY tetap ikut');
  assert.equal(matchesRecapPeriod({ date: '2026-10-28' }, cfg), false);
});

check('periode MINGGUAN memuat kedua ujung minggu dan menolak Senin berikutnya', () => {
  const cfg = config({ periodType: 'MINGGUAN', date: '2026-10-29' });
  assert.equal(matchesRecapPeriod({ date: '2026-10-26' }, cfg), true);
  assert.equal(matchesRecapPeriod({ date: '2026-11-01' }, cfg), true);
  assert.equal(matchesRecapPeriod({ date: '2026-11-02' }, cfg), false);
});

check('periode BULANAN memakai bulan+tahun, bukan batas tanggal', () => {
  const cfg = config({ periodType: 'BULANAN', month: 9, year: 2026 });
  assert.equal(matchesRecapPeriod({ date: '2026-10-01' }, cfg), true);
  assert.equal(matchesRecapPeriod({ date: '31/10/26' }, cfg), true);
  assert.equal(matchesRecapPeriod({ date: '2026-11-01' }, cfg), false);
  assert.equal(matchesRecapPeriod({ date: '2025-10-05' }, cfg), false);
});

// 5. Label periode untuk banner dan judul PDF
check('label periode terbaca untuk tiap mode', () => {
  assert.equal(buildRecapPeriodLabel(config({ periodType: 'BULANAN' })), 'Oktober 2026');
  assert.match(buildRecapPeriodLabel(config()), /s\.d/);
  assert.match(buildRecapPeriodLabel(config({ periodType: 'HARIAN' })), /2026/);
  assert.match(buildRecapPeriodLabel(config({ periodType: 'MINGGUAN' })), /^Minggu .* s\.d /);
});

console.log(`\n${passed} kasus periode riwayat agen lolos.`);
