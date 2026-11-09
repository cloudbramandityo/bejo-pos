/**
 * Uji regresi status termin invoice + riwayat rekonsiliasi pembayaran.
 * Jalankan: npm run check:invoice
 *
 * Kasus lahir dari gejala nyata: invoice pelunasan penuh INV/BJP/2026/11/0002
 * menyatakan "Termin 3 ... Belum" padahal dokumennya sendiri berstatus Lunas,
 * dan riwayat pembayarannya kosong walaupun termin 1-3 sudah dibayar.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getTerminStageDisplayInfo,
  getInvoicePaymentHistory,
  resolveStageSuffix,
  getProformaEffectivePaymentInfo,
  stageNumberAliases
} from '../src/utils/invoiceStorage';
import type { Invoice, InvoiceCustomerInfo, InvoicePayment, InvoiceTerminSchedule } from '../src/types';

let passed = 0;
const check = (label: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`   ok  ${label}`);
};

const CUSTOMER: InvoiceCustomerInfo = { name: 'CV Mitra Daerah', address: 'Jl. Raya Diwek No 1', phone: '0812-3456-7890' };

const CONTRACT_TOTAL = 18_345_142;
const STAGE_AMOUNTS = [5_503_543, 5_503_543, 7_338_056];

function stage(index: number, overrides: Partial<InvoiceTerminSchedule> = {}): InvoiceTerminSchedule {
  return {
    id: `st-${index + 1}`,
    name: `Termin ${index + 1}`,
    percentage: [30, 30, 40][index],
    amount: STAGE_AMOUNTS[index],
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> & { id: string; documentNumber: string }): Invoice {
  const grandTotal = overrides.grandTotal ?? CONTRACT_TOTAL;
  return {
    documentType: 'COMMERCIAL',
    status: 'ISSUED',
    projectTitle: 'Branding kantor',
    issueDate: '2026-11-01',
    customer: CUSTOMER,
    items: [],
    subtotal: grandTotal,
    discountAmount: 0,
    taxableBase: grandTotal,
    taxRate: 0,
    taxAmount: 0,
    grandTotal,
    amountPaid: 0,
    balanceDue: grandTotal,
    payments: [],
    issuedBy: 'Admin',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as Invoice;
}

function payment(
  id: string,
  invoiceId: string,
  amount: number,
  paymentDate: string,
  referenceNumber?: string
): InvoicePayment {
  return { id, invoiceId, paymentType: 'INSTALLMENT', paymentDate, amount, paymentMethod: 'TRANSFER', referenceNumber, receivedBy: 'Syafira', createdAt: Number(paymentDate.replace(/-/g, '')) };
}

/** Jadwal tiga tahap milik PI/BJP/2026/10/0007 (skema TERMIN). */
const piSchedules = () => [stage(0), stage(1), stage(2)];

const proforma = () => invoice({
  id: 'pi-0007',
  documentNumber: 'PI/BJP/2026/10/0007',
  documentType: 'PROFORMA',
  status: 'CONVERTED',
  paymentScheme: 'TERMIN',
  paymentSchedules: piSchedules(),
  childInvoiceNumbers: ['INV/BJP/2026/11/0001/T1', 'INV/BJP/2026/11/0001/T2', 'INV/BJP/2026/11/0001/T3', 'INV/BJP/2026/11/0002'],
});

/** Invoice termin per tahap (T1/T2/T3) seperti yang diterbitkan dari PI. */
function terminInvoice(index: number, paid: boolean): Invoice {
  return invoice({
    id: `inv-t${index + 1}`,
    documentNumber: `INV/BJP/2026/11/0001/T${index + 1}`,
    sourceProformaId: 'pi-0007',
    sourceProformaNumber: 'PI/BJP/2026/10/0007',
    paymentScheme: 'TERMIN',
    paymentSchedules: piSchedules(),
    terminStageId: `st-${index + 1}`,
    terminStageNumber: index + 1,
    terminStageName: `Termin ${index + 1}`,
    terminPercentage: [30, 30, 40][index],
    referenceDescription: `Pembayaran Termin ${index + 1} dari Total Kontrak`,
    grandTotal: STAGE_AMOUNTS[index],
    amountPaid: paid ? STAGE_AMOUNTS[index] : 0,
    balanceDue: paid ? 0 : STAGE_AMOUNTS[index],
    status: paid ? 'PAID' : 'ISSUED',
    payments: paid
      ? [payment(`pay-t${index + 1}`, `inv-t${index + 1}`, STAGE_AMOUNTS[index], `2026-11-0${index + 2}`, `TRF-000${index + 1}`)]
      : [],
  });
}

/**
 * INV/BJP/2026/11/0002 — konversi mode "Penuh (Full)": tanpa penanda tahap,
 * terminPercentage 100, grandTotal sebesar seluruh kontrak.
 */
function fullSettlement(overrides: Partial<Invoice> = {}): Invoice {
  return invoice({
    id: 'inv-0002',
    documentNumber: 'INV/BJP/2026/11/0002',
    sourceProformaId: 'pi-0007',
    sourceProformaNumber: 'PI/BJP/2026/10/0007',
    paymentScheme: 'TERMIN',
    referenceDescription: 'Pelunasan Penuh Kontrak',
    terminPercentage: 100,
    paymentSchedules: piSchedules().map(s => ({ ...s, isPaid: true, status: 'Lunas' })),
    amountPaid: CONTRACT_TOTAL,
    balanceDue: 0,
    status: 'PAID',
    ...overrides,
  });
}

const statuses = (inv: Invoice, all?: Invoice[]) =>
  (inv.paymentSchedules || []).map((s, i) => getTerminStageDisplayInfo(inv, s, i, all).status);

const settledChildren = () => [terminInvoice(0, true), terminInvoice(1, true), terminInvoice(2, true)];

// A. Kasus pemilik: invoice pelunasan penuh tidak boleh punya tahap "Belum"
check('invoice pelunasan penuh menyatakan seluruh termin Lunas', () => {
  const pool = [proforma(), ...settledChildren(), fullSettlement()];
  assert.deepEqual(statuses(fullSettlement(), pool), ['Lunas', 'Lunas', 'Lunas']);
});

check('tanpa flag lunas di baris jadwal pun dokumennya tetap menilai dari status/sisa', () => {
  const pool = [proforma(), ...settledChildren()];
  const doc = fullSettlement({ paymentSchedules: piSchedules() });
  assert.deepEqual(statuses(doc, pool), ['Lunas', 'Lunas', 'Lunas']);
});

check('keterangan bebas "Pelunasan" tidak lagi dipetakan ke tahap kedua', () => {
  const pool = [proforma(), ...settledChildren()];
  const withText = fullSettlement({ paymentSchedules: piSchedules() });
  const withoutText = fullSettlement({ paymentSchedules: piSchedules(), referenceDescription: undefined });
  assert.deepEqual(statuses(withText, pool), statuses(withoutText, pool));
});

// B. Pelunasan penuh yang belum dibayar: tetap tidak ada tahap "Belum"
check('pelunasan penuh belum dibayar tidak menandai tahap mana pun "Belum"', () => {
  const unpaid = fullSettlement({
    status: 'ISSUED',
    amountPaid: 0,
    balanceDue: CONTRACT_TOTAL,
    paymentSchedules: piSchedules().map(s => ({ ...s, isPaid: false, status: 'Belum' })),
  });
  const hasil = statuses(unpaid);
  assert.equal(hasil.includes('Belum'), false);
  assert.deepEqual(hasil, ['Tagihan Ini', 'Tagihan Ini', 'Tagihan Ini']);
});

check('uang masuk sebagian menutup tahap dari depan, sisanya tetap tertagih', () => {
  const partial = fullSettlement({
    status: 'PARTIAL',
    amountPaid: STAGE_AMOUNTS[0] + STAGE_AMOUNTS[1],
    balanceDue: STAGE_AMOUNTS[2],
    paymentSchedules: piSchedules(),
  });
  assert.deepEqual(statuses(partial), ['Lunas', 'Lunas', 'Tagihan Ini']);
});

// C. Invoice satu tahap: urutan tetap dihormati
check('invoice termin T3: termin 1-2 Lunas, termin 3 mengikuti status dokumen', () => {
  const unpaidT3 = terminInvoice(2, false);
  assert.deepEqual(statuses(unpaidT3), ['Lunas', 'Lunas', 'Tagihan Ini']);
  assert.deepEqual(statuses(terminInvoice(2, true)), ['Lunas', 'Lunas', 'Lunas']);
});

check('tahap sesudah tagihan berjalan yang sudah dicatat lunas tidak ditulis "Belum"', () => {
  const doc = terminInvoice(0, false);
  doc.paymentSchedules = [stage(0), stage(1, { isPaid: true, status: 'Lunas' }), stage(2)];
  const hasil = statuses(doc);
  assert.equal(hasil[0], 'Tagihan Ini');
  assert.equal(hasil[1], 'Lunas');
});

// D. PI induk mengikuti dokumen yang diterbitkan darinya
check('PI dengan tiga termin terbit dan terlunasi menampilkan Lunas semua', () => {
  const pool = [proforma(), ...settledChildren(), fullSettlement()];
  assert.deepEqual(statuses(proforma(), pool), ['Lunas', 'Lunas', 'Lunas']);
});

check('PI hanya menampilkan "Belum" untuk tahap yang belum tertagih', () => {
  const pi = invoice({
    id: 'pi-baru',
    documentNumber: 'PI/BJP/2026/11/0099',
    documentType: 'PROFORMA',
    status: 'ISSUED',
    paymentScheme: 'TERMIN',
    paymentSchedules: piSchedules(),
    childInvoiceNumbers: ['INV/BJP/2026/11/0099/T1'],
  });
  const pool = [pi, terminInvoice(0, true)];
  assert.deepEqual(statuses(pi, pool).slice(1), ['Belum', 'Belum']);
});

check('dokumen penuh di bawah PI membuat tahap terakhir PI tidak "Belum"', () => {
  const pi = proforma();
  const pool = [pi, fullSettlement()];
  assert.equal(statuses(pi, pool).includes('Belum'), false);
});

// E. Skema DP: pelunasan = tahap TERAKHIR, jumlahnya dibaca, bukan angka tetap
check('penanda /PELUNASAN mengenai tahap terakhir pada skema DP tiga tahap', () => {
  const pi = invoice({
    id: 'pi-dp',
    documentNumber: 'PI/BJP/2026/11/0100',
    documentType: 'PROFORMA',
    status: 'CONVERTED',
    paymentScheme: 'DP',
    paymentSchedules: [stage(0, { name: 'DP' }), stage(1, { name: 'Termin 2' }), stage(2, { name: 'Pelunasan' })],
    childInvoiceNumbers: ['INV/BJP/2026/11/0100/DP', 'INV/BJP/2026/11/0100/T2', 'INV/BJP/2026/11/0100/PELUNASAN'],
  });
  const hasil = statuses(pi, [pi]);
  assert.equal(hasil[2], 'Tagihan Ini', 'tahap pelunasan harus terbuka, bukan "Belum"');
  assert.equal(hasil[1], 'Lunas');
});

// F. Aturan tunggal penanda tahap
check('resolveStageSuffix mengikuti skema dan jumlah tahap, tanpa angka tetap', () => {
  assert.deepEqual([0, 1, 2].map(i => resolveStageSuffix('TERMIN', i, 3)), ['T1', 'T2', 'T3']);
  assert.deepEqual([0, 1, 2].map(i => resolveStageSuffix('DP', i, 3)), ['DP', 'T2', 'PELUNASAN']);
  assert.deepEqual([0, 1].map(i => resolveStageSuffix('DP', i, 2)), ['DP', 'PELUNASAN']);
  assert.equal(resolveStageSuffix('FULL', 0, 1), 'T1');
  assert.equal(resolveStageSuffix(undefined, 2, 5), 'T3');
});

// G. Riwayat rekonsiliasi pembayaran
check('invoice pelunasan penuh menampilkan pembayaran termin 1-3', () => {
  const pool = [proforma(), ...settledChildren(), fullSettlement()];
  const riwayat = getInvoicePaymentHistory(fullSettlement({ payments: [] }), pool);
  assert.equal(riwayat.length, 3);
  assert.deepEqual(riwayat.map(p => p.amount), STAGE_AMOUNTS);
  assert.deepEqual(riwayat.map(p => p.paymentDate), ['2026-11-02', '2026-11-03', '2026-11-04']);
});

check('riwayat digabung tanpa baris ganda (nomor referensi sama)', () => {
  const anak = settledChildren();
  const penuh = fullSettlement({ payments: [payment('pay-t3', 'inv-0002', STAGE_AMOUNTS[2], '2026-11-04', 'TRF-0003')] });
  const pool = [proforma(), ...anak, penuh];
  const riwayat = getInvoicePaymentHistory(penuh, pool);
  assert.equal(riwayat.filter(p => p.referenceNumber === 'TRF-0003').length, 1);
  assert.equal(riwayat.length, 3);
});

check('invoice satu tahap hanya menampilkan pembayaran miliknya sendiri', () => {
  const pool = [proforma(), ...settledChildren(), fullSettlement()];
  const t2 = terminInvoice(1, true);
  const riwayat = getInvoicePaymentHistory(t2, pool);
  assert.deepEqual(riwayat.map(p => p.amount), [STAGE_AMOUNTS[1]]);
});

check('PI induk ikut menampilkan pembayaran dari invoice termin', () => {
  const pool = [proforma(), ...settledChildren(), fullSettlement()];
  assert.equal(getInvoicePaymentHistory(proforma(), pool).length, 3);
});

check('riwayat gabungan tidak mengubah sisa tagihan efektif', () => {
  const pool = [proforma(), ...settledChildren(), fullSettlement()];
  const pi = proforma();
  const eff = getProformaEffectivePaymentInfo(pi, pool);
  assert.equal(eff.balanceDue, 0);
  assert.equal(eff.amountPaid, CONTRACT_TOTAL);
});

check('tanpa daftar invoice lain, riwayat hanya berisi pembayaran dokumen itu', () => {
  const t1 = terminInvoice(0, true);
  assert.equal(getInvoicePaymentHistory(t1, []).length, 1);
  assert.equal(getInvoicePaymentHistory(t1, undefined).length, 1);
});

// H. Pemindaian sumber: aturan tidak boleh ditulis ulang di layar atau PDF
const src = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const storageSrc = () => src('../src/utils/invoiceStorage.ts');
const screenSrc = () => src('../src/components/InvoiceScreen.tsx');
const pdfSrc = () => src('../src/utils/invoicePdf.ts');

check('penafsir tahap tidak lagi membaca kata "pelunasan" dari keterangan bebas', () => {
  const body = storageSrc();
  assert.equal(/referenceDescription[\s\S]{0,80}pelunasan/i.test(body), false);
  assert.equal(/refDesc\.includes\(/.test(body), false);
});

check('layar invoice memakai resolveStageSuffix, bukan angka tahap ditulis tetap', () => {
  const body = screenSrc();
  assert.match(body, /resolveStageSuffix\(/);
  assert.equal(/['"`]\/T\$\{/.test(body), false, 'tidak boleh menyusun penanda /T{n} sendiri');
  assert.equal(/endsWith\('\/T\d'\)/.test(body), false);
});

check('riwayat rekonsiliasi dibaca dari getInvoicePaymentHistory di layar dan PDF', () => {
  assert.match(screenSrc(), /getInvoicePaymentHistory\(selectedInvoice,\s*invoices\)/);
  assert.match(pdfSrc(), /getInvoicePaymentHistory\(invoice,\s*allInvoices\)/);
  assert.equal(/invoice\.payments\s*\.map/.test(pdfSrc()), false, 'PDF tidak memakai baris milik dokumen saja');
});

check('satu sumber penanda tahap dipakai penulis maupun pembaca status', () => {
  const body = storageSrc();
  assert.equal((body.match(/function resolveStageSuffix/g) || []).length, 1);
  assert.match(body, /export function resolveStageSuffix/);
  assert.match(body, /function stageNumberAliases/);
  assert.equal((body.match(/`T\$\{stageIndex \+ 1\}`/g) || []).length, 1, 'angka tahap hanya dirakit satu kali');
});

// I. Alias nomor tahap: dokumen lama berbentuk /T{n} pada skema DP tetap terbaca
check('stageNumberAliases membangun daftar dari aturan tunggal tanpa duplikat', () => {
  assert.deepEqual([0, 1, 2].map(i => stageNumberAliases('TERMIN', i, 3)), [['/T1'], ['/T2'], ['/T3']]);
  assert.deepEqual(stageNumberAliases('DP', 0, 3), ['/DP', '/T1']);
  assert.deepEqual(stageNumberAliases('DP', 1, 3), ['/T2']);
  assert.deepEqual(stageNumberAliases('DP', 2, 3), ['/PELUNASAN', '/T3']);
  assert.deepEqual(stageNumberAliases('DP', 1, 2), ['/PELUNASAN', '/T2']);
});

check('PI skema DP dengan nomor child lama /T1../T3 tidak menulis tahap "Belum"', () => {
  const pi = invoice({
    id: 'pi-0007',
    documentNumber: 'PI/BJP/2026/10/0007',
    documentType: 'PROFORMA',
    status: 'CONVERTED',
    paymentScheme: 'DP',
    paymentSchedules: [stage(0, { name: 'DP' }), stage(1), stage(2, { name: 'Pelunasan' })],
    childInvoiceNumbers: ['INV/BJP/2026/11/0001/T1', 'INV/BJP/2026/11/0001/T2', 'INV/BJP/2026/11/0001/T3'],
  });
  const pool = [pi, ...settledChildren()];
  assert.deepEqual(statuses(pi, pool), ['Lunas', 'Lunas', 'Lunas']);
});

// J. Draf/batal dengan balanceDue 0 bukan bukti lunas
check('invoice penuh berstatus DRAFT dengan sisa 0 placeholder tidak dinyatakan Lunas', () => {
  const draf = fullSettlement({
    status: 'DRAFT',
    amountPaid: 0,
    balanceDue: 0,
    payments: [],
    paymentSchedules: piSchedules(),
  });
  assert.deepEqual(statuses(draf), ['Tagihan Ini', 'Tagihan Ini', 'Tagihan Ini']);
});

check('invoice penuh CANCELLED dengan sisa 0 tidak dinyatakan Lunas', () => {
  const batal = fullSettlement({
    status: 'CANCELLED',
    amountPaid: 0,
    balanceDue: 0,
    payments: [],
    paymentSchedules: piSchedules(),
  });
  assert.equal(statuses(batal).includes('Lunas'), false);
});

check('status PAID tetap Lunas walau field sisa belum ikut diperbarui', () => {
  const doc = fullSettlement({ paymentSchedules: piSchedules(), balanceDue: CONTRACT_TOTAL });
  assert.deepEqual(statuses(doc), ['Lunas', 'Lunas', 'Lunas']);
});

check('PI dengan child DRAFT/CANCELLED sisa 0 tidak menulis tahapnya Lunas', () => {
  const pi = invoice({
    id: 'pi-0007',
    documentNumber: 'PI/BJP/2026/10/0007',
    documentType: 'PROFORMA',
    status: 'CONVERTED',
    paymentScheme: 'TERMIN',
    paymentSchedules: piSchedules(),
    childInvoiceNumbers: ['INV/BJP/2026/11/0001/T1'],
  });
  const batal = { ...terminInvoice(0, false), status: 'CANCELLED' as const, balanceDue: 0 };
  const hasil = statuses(pi, [pi, batal]);
  assert.equal(hasil[0], 'Tagihan Ini');
  assert.deepEqual(hasil.slice(1), ['Belum', 'Belum']);
});

// K. Pemindaian sumber untuk keempat celah yang ditutup
check('pencocokan hapus/konversi/pembayaran/pembatalan di layar lewat stageNumberAliases', () => {
  const body = screenSrc();
  assert.equal((body.match(/const aliases = stageNumberAliases\(/g) || []).length, 4, 'empat titik pencocokan harus memakai alias');
  assert.equal(/endsWith\(`\/\$\{/.test(body), false, 'tidak boleh menyusun akhiran nomor sendiri di layar');
});

check('hapus dan pembatalan meng-unbill tahap: invoiceNumber jadwal ikut dibersihkan', () => {
  const body = screenSrc();
  assert.equal((body.match(/isPaid: false, status: 'Belum', invoiceNumber: undefined/g) || []).length, 2);
  assert.equal((body.match(/childInvoiceNumbers: newChildNums/g) || []).length, 3, 'tautan child induk ikut dilepas di dua cabang hapus dan satu pembatalan');
});

check('penilai lunas menolak placeholder balanceDue 0 milik DRAFT/CANCELLED', () => {
  assert.match(storageSrc(), /inv\.status === 'DRAFT' \|\| inv\.status === 'CANCELLED'\) return false/);
});

console.log(`\n${passed} kasus status termin & riwayat pembayaran lolos.`);
