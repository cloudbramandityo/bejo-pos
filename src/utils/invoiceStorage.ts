/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 * Modul Manajemen Data Proforma Invoice (PI) & Invoice Komersial (INV)
 */

import {
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceStoreIdentity,
  InvoiceDocumentType,
  InvoiceStatus,
  InvoicePaymentMethodType,
  InvoiceTerminSchedule,
  Transaction,
  CartItem
} from '../types';

export const DEFAULT_INVOICE_STORE_IDENTITY: InvoiceStoreIdentity = {
  storeName: 'PT BEJO DIGITAL MEDIA',
  tagline: 'Spesialis Stiker Vinyl, Custom Decal, Digital Printing & Laser Cutting',
  address: 'Jl. Raya Diwek (Belakang Polsek), Kab Jombang, Jawa Timur',
  phone: '0819-1834-4716 / 0851-3336-0276',
  email: 'bejodigitalmedia@gmail.com',
  website: 'www.bejostiker.com',
  npwp: '10.000.000.1-000.7421',
  logoUrl: '',
  bankAccounts: [
    {
      id: 'bank-bca',
      bankName: 'BCA (Bank Central Asia)',
      accountNumber: '113-274-7096',
      accountHolder: 'BEJO DIGITAL MEDIA PT',
      branch: 'KCP Jombang',
      isDefault: true
    },
    {
      id: 'bank-mandiri',
      bankName: 'Bank Mandiri',
      accountNumber: '144-00-9876543-2',
      accountHolder: 'Ahmad Irdianto',
      branch: 'Cabang Sutoyo Malang',
      isDefault: false
    }
  ],
  invoicePrefix: 'INV/BJP',
  proformaPrefix: 'PI/BJP',
  creditNotePrefix: 'CN/BJP',
  defaultTerms: '1. Pembayaran DP minimal 50% sebelum proses cetak & cutting dimulai.\n2. Pelunasan sisa tagihan wajib diselesaikan saat pesanan selesai / sebelum serah terima barang.\n3. Barang yang sudah dicetak/dipotong sesuai acc desain tidak dapat dibatalkan atau dikembalikan.',
  authorizedSignerName: 'Ahmad Irdianto',
  authorizedSignerRole: 'Owner / Pimpinan'
};

const STORAGE_KEYS = {
  INVOICES: 'bejo_pos_invoices_v1',
  STORE_IDENTITY: 'bejo_pos_invoice_store_identity_v1'
};

/**
 * Kalkulasi otomatis finansial invoice: Subtotal, Diskon, DPP, PPN, Grand Total, Balance Due
 */
export function calculateInvoiceTotals(
  items: InvoiceItem[],
  taxRatePercent: number = 11,
  dpPercent: number = 50,
  amountPaid: number = 0
) {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableSubtotal = 0;

  for (const item of items) {
    const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    let discAmt = 0;
    if (item.discountPercent && item.discountPercent > 0) {
      discAmt = (gross * item.discountPercent) / 100;
    } else if (item.discountAmount) {
      discAmt = Number(item.discountAmount) || 0;
    }
    const calculatedNet = gross - discAmt;

    // totalPrice adalah nilai baris yang ditampilkan dan disimpan. Untuk item
    // hasil tarikan SPK berbasis m2, nilai ini bisa berbeda dari qty x harga.
    const storedTotal = Number(item.totalPrice);
    const lineNet =
      Number.isFinite(storedTotal) && (storedTotal !== 0 || gross === 0)
        ? storedTotal
        : calculatedNet;

    subtotal += lineNet + discAmt;
    totalDiscount += discAmt;
    if (item.isTaxable) {
      taxableSubtotal += lineNet;
    }
  }

  const roundedSubtotal = Math.round(subtotal);
  const roundedDiscount = Math.round(totalDiscount);
  const taxableBase = Math.max(0, Math.round(taxableSubtotal));
  const taxAmount = taxRatePercent > 0 ? Math.round((taxableBase * taxRatePercent) / 100) : 0;
  const grandTotal = Math.max(0, roundedSubtotal - roundedDiscount + taxAmount);
  
  const dpRequiredAmount = dpPercent > 0 ? Math.round((grandTotal * dpPercent) / 100) : 0;
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  return {
    subtotal: roundedSubtotal,
    discountAmount: roundedDiscount,
    taxableBase,
    taxRate: taxRatePercent,
    taxAmount,
    grandTotal,
    dpRequiredPercent: dpPercent,
    dpRequiredAmount,
    amountPaid,
    balanceDue
  };
}

/**
 * Membuat jadwal pembayaran default berdasarkan skema (FULL, DP, TERMIN)
 */
export function generateDefaultPaymentSchedules(
  scheme: InvoicePaymentMethodType,
  grandTotal: number,
  baseDateStr?: string
): InvoiceTerminSchedule[] {
  const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
  
  const formatDate = (date: Date) => {
    return date.toISOString().slice(0, 10);
  };

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return formatDate(d);
  };

  if (scheme === 'FULL') {
    return [
      {
        id: `sched-${Date.now()}-1`,
        name: 'Pelunasan Penuh (100%)',
        percentage: 100,
        amount: grandTotal,
        dueDate: formatDate(baseDate),
        notes: 'Pelunasan 100% saat order disetujui / serah terima'
      }
    ];
  }

  if (scheme === 'DP') {
    // DP (Down Payment) 2 Tahap: DP 50% dan Pelunasan 50% (atau 40% & 60%)
    const dpAmount = Math.round(grandTotal * 0.5);
    const balanceAmount = grandTotal - dpAmount;
    return [
      {
        id: `sched-${Date.now()}-1`,
        name: 'DP (Down Payment) 50%',
        percentage: 50,
        amount: dpAmount,
        dueDate: formatDate(baseDate),
        notes: 'Uang Muka sebelum proses produksi & cetak dimulai'
      },
      {
        id: `sched-${Date.now()}-2`,
        name: 'Pelunasan 50%',
        percentage: 50,
        amount: balanceAmount,
        dueDate: addDays(baseDate, 7),
        notes: 'Pelunasan saat pekerjaan selesai / sebelum serah terima barang'
      }
    ];
  }

  if (scheme === 'TERMIN') {
    // Termin 3 Tahap default: 30%, 30%, 40%
    const t1Amount = Math.round(grandTotal * 0.3);
    const t2Amount = Math.round(grandTotal * 0.3);
    const t3Amount = grandTotal - t1Amount - t2Amount;
    return [
      {
        id: `sched-${Date.now()}-1`,
        name: 'Termin 1',
        percentage: 30,
        amount: t1Amount,
        dueDate: formatDate(baseDate),
        notes: 'Tahap 1: ACC Desain & Uang Muka Bahan'
      },
      {
        id: `sched-${Date.now()}-2`,
        name: 'Termin 2',
        percentage: 30,
        amount: t2Amount,
        dueDate: addDays(baseDate, 7),
        notes: 'Tahap 2: Selesai Cetak & Fabrikasi Lapangan'
      },
      {
        id: `sched-${Date.now()}-3`,
        name: 'Termin 3',
        percentage: 40,
        amount: t3Amount,
        dueDate: addDays(baseDate, 14),
        notes: 'Tahap 3: Serah terima pekerjaan / Pelunasan Akhir'
      }
    ];
  }

  return [];
}

/**
 * Menyelaraskan nominal / persentase rincian jadwal pembayaran terhadap Grand Total
 */
export function recalculatePaymentSchedules(
  schedules: InvoiceTerminSchedule[],
  grandTotal: number
): InvoiceTerminSchedule[] {
  if (!schedules || schedules.length === 0) return [];
  
  return schedules.map((item) => {
    // Hitung amount berdasarkan persentase
    const calcAmount = Math.round((grandTotal * (item.percentage || 0)) / 100);
    return {
      ...item,
      amount: calcAmount
    };
  });
}

/**
 * Otomatis menyeimbangkan sisa nominal/persentase pada tahap termin terakhir agar genap 100% dan Grand Total
 */
export function autoBalancePaymentSchedules(
  schedules: InvoiceTerminSchedule[],
  grandTotal: number
): InvoiceTerminSchedule[] {
  if (!schedules || schedules.length === 0) return [];
  if (schedules.length === 1) {
    return [{
      ...schedules[0],
      percentage: 100,
      amount: grandTotal
    }];
  }

  const updated = schedules.map(s => ({ ...s }));
  let sumAmount = 0;
  let sumPct = 0;

  for (let i = 0; i < updated.length - 1; i++) {
    sumAmount += updated[i].amount || 0;
    sumPct += updated[i].percentage || 0;
  }

  const lastIdx = updated.length - 1;
  const remAmount = Math.max(0, grandTotal - sumAmount);
  const remPct = Math.max(0, parseFloat((100 - sumPct).toFixed(1)));

  updated[lastIdx] = {
    ...updated[lastIdx],
    amount: remAmount,
    percentage: remPct
  };

  return updated;
}

/**
 * Generate nomor invoice / proforma berikutnya secara sekuensial bebas-celah (Global Running Number)
 * Format baku: {PREFIX}/{YEAR}/{MONTH}/{XXXX} atau {PREFIX}/{YEAR}/{MONTH}/{XXXX}/{SUFFIX}
 * Contoh: INV/BJP/2026/10/0145/T1, INV/BJP/2026/10/0146, PI/BJP/2026/10/0007
 */
export function generateNextDocumentNumber(
  type: InvoiceDocumentType,
  existingInvoices: Invoice[],
  storeIdentity?: InvoiceStoreIdentity,
  stageSuffix?: string
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  const prefix = type === 'PROFORMA' 
    ? (storeIdentity?.proformaPrefix || 'PI/BJP')
    : (storeIdentity?.invoicePrefix || 'INV/BJP');
  
  const prefixPattern = `${prefix}/${year}/${month}/`;
  
  // Cari nomor urut global tertinggi di bulan dan tahun yang sama (mendukung suffix /T1, /T2, /DP, dll)
  let maxSeq = 0;
  for (const inv of existingInvoices) {
    if (inv.documentType === type && inv.documentNumber && inv.documentNumber.startsWith(prefixPattern)) {
      const rest = inv.documentNumber.slice(prefixPattern.length);
      const match = rest.match(/^(\d+)/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  const nextSeqStr = String(maxSeq + 1).padStart(4, '0');
  const cleanSuffix = stageSuffix ? `/${stageSuffix.replace(/^\//, '').toUpperCase()}` : '';
  return `${prefixPattern}${nextSeqStr}${cleanSuffix}`;
}

/**
 * Generate nomor Credit Note (Nota Kredit) berikutnya secara sekuensial
 * Format baku: CN/BJP/{YEAR}/{MONTH}/{XXXX} (Contoh: CN/BJP/2026/10/0001)
 */
export function generateNextCreditNoteNumber(
  existingInvoices: Invoice[],
  storeIdentity?: InvoiceStoreIdentity
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = storeIdentity?.creditNotePrefix || 'CN/BJP';
  const prefixPattern = `${prefix}/${year}/${month}/`;

  let maxSeq = 0;
  for (const inv of existingInvoices) {
    const cnNumber = inv.cancellation?.creditNoteNumber;
    if (cnNumber && cnNumber.startsWith(prefixPattern)) {
      const rest = cnNumber.slice(prefixPattern.length);
      const match = rest.match(/^(\d+)/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  const nextSeqStr = String(maxSeq + 1).padStart(4, '0');
  return `${prefixPattern}${nextSeqStr}`;
}

/**
 * Mendapatkan Identitas Toko Penerbit Invoice dari LocalStorage
 */
export function getStoredInvoiceStoreIdentity(): InvoiceStoreIdentity {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORE_IDENTITY);
    if (!raw) return DEFAULT_INVOICE_STORE_IDENTITY;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_INVOICE_STORE_IDENTITY, ...parsed };
  } catch (err) {
    console.error('Error reading invoice store identity from storage:', err);
    return DEFAULT_INVOICE_STORE_IDENTITY;
  }
}

/**
 * Menyimpan Identitas Toko Penerbit Invoice ke LocalStorage
 */
export function saveStoredInvoiceStoreIdentity(identity: InvoiceStoreIdentity): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STORE_IDENTITY, JSON.stringify(identity));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_invoice_identity_updated', { detail: identity }));
    }
  } catch (err) {
    console.error('Error saving invoice store identity to storage:', err);
  }
}

/**
 * Helper: Identifikasi dummy invoice (Protokol clean sheet dinonaktifkan)
 */
export function isDummyInvoice(_inv: any): boolean {
  return false;
}

/**
 * Mendapatkan Daftar Invoice dari LocalStorage tanpa pemfilteran paksa clean sheet
 */
export function getStoredInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (raw === null) {
      const initial = generateSampleInvoices();
      saveStoredInvoices(initial);
      return initial;
    }
    const parsed: Invoice[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (err) {
    console.error('Error reading invoices from storage:', err);
    return [];
  }
}

/**
 * Menyimpan Daftar Invoice ke LocalStorage (seluruh dokumen tersimpan secara presisi)
 */
export function saveStoredInvoices(invoices: Invoice[]): void {
  try {
    const list = Array.isArray(invoices) ? invoices : [];
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_invoices_updated', { detail: list }));
    }
  } catch (err) {
    console.error('Error saving invoices to storage:', err);
  }
}

/**
 * Membersihkan seluruh invoice (Deprecated - protokol clean sheet dinonaktifkan)
 */
export function clearAllStoredInvoices(): void {
  // Protokol clean sheet dinonaktifkan sesuai permintaan pengguna.
}

/**
 * Data sampel awal untuk ilustrasi Proforma Invoice & Invoice Final jika data kosong
 */
function generateSampleInvoices(): Invoice[] {
  const identity = DEFAULT_INVOICE_STORE_IDENTITY;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dateStr = now.toISOString().slice(0, 10);
  
  // 1. Proforma Invoice dengan Skema Termin (3 Tahap: 30%, 30%, 40% dari Total Rp 18.345.142)
  const piTerminId = `PI-${Date.now()}-0007`;
  const piTerminNumber = `PI/BJP/${year}/${month}/0007`;
  const t1InvoiceId = `INV-${Date.now()}-0007-T1`;
  const t1InvoiceNumber = `INV/BJP/${year}/${month}/0007/T1`;

  const piTerminItems: InvoiceItem[] = [
    {
      id: 'item-pi-term-1',
      itemName: 'Pekerjaan Stiker Cutting SAICHOLITE & Jasa Pasang',
      description: 'Stiker Cutting Reflective SAICHOLITE High-Grade, Rangka & Jasa Pemasangan Lapangan',
      quantity: 1,
      unit: 'paket',
      unitPrice: 18345142,
      discountPercent: 0,
      discountAmount: 0,
      isTaxable: false,
      totalPrice: 18345142
    }
  ];

  const piTerminSchedules: InvoiceTerminSchedule[] = [
    {
      id: 'sched-t1',
      name: 'Termin 1',
      percentage: 30,
      amount: 5503543,
      dueDate: dateStr,
      notes: 'Pembayaran Termin 1 (30%) dari Total Kontrak',
      isPaid: true,
      status: 'Lunas',
      invoiceNumber: t1InvoiceNumber
    },
    {
      id: 'sched-t2',
      name: 'Termin 2',
      percentage: 30,
      amount: 5503543,
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      notes: 'Termin 2 30% saat progres fisik mencapai 50%',
      isPaid: false,
      status: 'Belum'
    },
    {
      id: 'sched-t3',
      name: 'Termin 3',
      percentage: 40,
      amount: 7338056,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      notes: 'Termin 3 40% pelunasan setelah serah terima pekerjaan & uji fungsi',
      isPaid: false,
      status: 'Belum'
    }
  ];

  const sampleProformaTermin: Invoice = {
    id: piTerminId,
    documentType: 'PROFORMA',
    documentNumber: piTerminNumber,
    status: 'PARTIAL',
    sourceProformaNumber: '02/PO/BNK/XI/2026',
    referenceDescription: 'Pekerjaan Stiker Cutting SAICHOLITE & Jasa Pasang',
    projectTitle: 'Pekerjaan Stiker Cutting SAICHOLITE & Jasa Pasang',
    issueDate: dateStr,
    expiryDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    customer: {
      name: 'PT. Bank Negara Katulistiwa (BNK)',
      pic: 'Bpk. Hendro Wicaksono',
      npwp: '01.234.567.8-012.000',
      address: 'Kawasan Perkantoran Grand Central No. 45, Surabaya',
      phone: '0812-3456-7890',
      email: 'procurement@bnk.co.id'
    },
    items: piTerminItems,
    subtotal: 18345142,
    discountAmount: 0,
    taxableBase: 18345142,
    taxRate: 0,
    taxAmount: 0,
    grandTotal: 18345142,
    paymentScheme: 'TERMIN',
    paymentSchedules: piTerminSchedules,
    dpRequiredPercent: 30,
    dpRequiredAmount: 5503543,
    amountPaid: 5503543,
    balanceDue: 12841599,
    childInvoiceIds: [t1InvoiceId],
    childInvoiceNumbers: [t1InvoiceNumber],
    payments: [],
    paymentTerms: identity.defaultTerms,
    bankAccounts: identity.bankAccounts,
    issuedBy: 'Kak Syafira (Admin)',
    issuedByRole: 'ADMIN',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now()
  };

  // 2. Invoice Komersial Hasil Konversi Termin 1 (Relasi ke PI/BJP/2026/10/0007)
  const sampleTermin1Invoice: Invoice = {
    id: t1InvoiceId,
    documentType: 'COMMERCIAL',
    documentNumber: t1InvoiceNumber,
    status: 'PAID',
    sourceProformaId: piTerminId,
    sourceProformaNumber: piTerminNumber,
    terminStageId: 'sched-t1',
    terminStageName: 'Termin 1',
    terminStageNumber: 1,
    terminPercentage: 30,
    contractTotalAmount: 18345142,
    referenceDescription: 'Pembayaran Termin 1 (30%) dari Total Kontrak',
    projectTitle: 'Pekerjaan Stiker Cutting SAICHOLITE & Jasa Pasang',
    issueDate: dateStr,
    dueDate: dateStr,
    customer: {
      name: 'PT. Bank Negara Katulistiwa (BNK)',
      pic: 'Bpk. Hendro Wicaksono',
      npwp: '01.234.567.8-012.000',
      address: 'Kawasan Perkantoran Grand Central No. 45, Surabaya',
      phone: '0812-3456-7890',
      email: 'procurement@bnk.co.id'
    },
    items: [
      {
        id: 'item-stage-t1',
        itemName: 'Pekerjaan Stiker Cutting SAICHOLITE & Jasa Pasang - Termin 1 (30%)',
        description: `Berdasarkan Proforma Invoice ${piTerminNumber}. Nilai Total Kontrak: Rp 18.345.142`,
        quantity: 1,
        unit: 'tahap',
        unitPrice: 5503543,
        discountPercent: 0,
        discountAmount: 0,
        isTaxable: false,
        totalPrice: 5503543
      }
    ],
    subtotal: 5503543,
    discountAmount: 0,
    taxableBase: 5503543,
    taxRate: 0,
    taxAmount: 0,
    grandTotal: 5503543,
    paymentScheme: 'TERMIN',
    paymentSchedules: piTerminSchedules,
    amountPaid: 5503543,
    balanceDue: 0,
    payments: [
      {
        id: 'pay-conv-t1',
        invoiceId: t1InvoiceId,
        paymentType: 'DOWN_PAYMENT',
        paymentDate: dateStr,
        amount: 5503543,
        paymentMethod: 'TRANSFER',
        referenceNumber: 'TRF-BCA-998822',
        receivedBy: 'Kak Syafira (Admin)',
        notes: `Pembayaran Termin 1 (30%) dari Total Kontrak (Ditransfer dari PI ${piTerminNumber})`,
        createdAt: Date.now() - 1800000
      }
    ],
    paymentTerms: identity.defaultTerms,
    bankAccounts: identity.bankAccounts,
    issuedBy: 'Kak Syafira (Admin)',
    issuedByRole: 'ADMIN',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now()
  };

  // 3. Invoice Komersial Independen Berikutnya (Global Running Number: 0146)
  const sampleInvoice146: Invoice = {
    id: `INV-${Date.now()}-0146`,
    documentType: 'COMMERCIAL',
    documentNumber: `INV/BJP/${year}/${month}/0146`,
    status: 'PAID',
    projectTitle: 'Pengadaan Bahan Stiker Wrapping Bengkel Modifikasi Max Auto',
    issueDate: dateStr,
    dueDate: dateStr,
    customer: {
      name: 'Max Auto Custom Workshop',
      pic: 'Mas Deny Pratama',
      npwp: '09.876.543.2-123.000',
      address: 'Jl. Soekarno Hatta No. 88, Lowokwaru, Malang',
      phone: '0812-8877-6655',
      email: 'maxautocustom@gmail.com'
    },
    items: [
      {
        id: 'item-inv-1',
        itemName: 'Stiker Oracal 651 Hitam Glossy (Roll 50 Meter)',
        description: 'Lebar 1.26 meter x 50 meter, Made in Germany',
        quantity: 2,
        unit: 'roll',
        unitPrice: 950000,
        discountPercent: 5,
        discountAmount: 95000,
        isTaxable: true,
        totalPrice: 1805000
      },
      {
        id: 'item-inv-2',
        itemName: 'Squeegee Felt Rakel Pemasang Stiker',
        description: 'Rakel beludru premium anti baret',
        quantity: 5,
        unit: 'pcs',
        unitPrice: 25000,
        discountPercent: 0,
        discountAmount: 0,
        isTaxable: true,
        totalPrice: 125000
      }
    ],
    subtotal: 2025000,
    discountAmount: 95000,
    taxableBase: 1930000,
    taxRate: 11,
    taxAmount: 212300,
    grandTotal: 2142300,
    paymentScheme: 'FULL',
    amountPaid: 2142300,
    balanceDue: 0,
    payments: [
      {
        id: 'pay-inv-146',
        invoiceId: `INV-${Date.now()}-0146`,
        paymentType: 'SETTLEMENT',
        paymentDate: dateStr,
        amount: 2142300,
        paymentMethod: 'TRANSFER',
        referenceNumber: 'MANDIRI-774411',
        receivedBy: 'Kak Langgo (Developer)',
        notes: 'Pelunasan transaksi pengadaan bahan stiker',
        createdAt: Date.now() - 7200000
      }
    ],
    paymentTerms: identity.defaultTerms,
    bankAccounts: identity.bankAccounts,
    issuedBy: 'Kak Langgo (Developer)',
    issuedByRole: 'DEVELOPER',
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now()
  };

  // 4. Proforma Invoice dengan Skema DP 2 Tahap (DP 40% & Pelunasan 60% dari Total Rp 10.000.000)
  const piDpSchedules: InvoiceTerminSchedule[] = [
    {
      id: 'sched-dp-1',
      name: 'Down Payment (DP 40%)',
      percentage: 40,
      amount: 4000000,
      dueDate: dateStr,
      notes: 'Uang Muka 40% sebelum produksi dimulai',
      isPaid: false
    },
    {
      id: 'sched-dp-2',
      name: 'Pelunasan (60%)',
      percentage: 60,
      amount: 6000000,
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      notes: 'Pelunasan 60% sebelum serah terima pekerjaan',
      isPaid: false
    }
  ];

  const sampleProformaDp: Invoice = {
    id: `PI-${Date.now()}-0008`,
    documentType: 'PROFORMA',
    documentNumber: `PI/BJP/${year}/${month}/0008`,
    status: 'ISSUED',
    projectTitle: 'Branding Mobil Truk Box & Neon Box Kantor Cabang CV Bintang Abadi',
    issueDate: dateStr,
    expiryDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    customer: {
      name: 'CV Bintang Abadi Transport',
      pic: 'Bpk. Hendro Wicaksono',
      npwp: '01.234.567.8-012.000',
      address: 'Jl. Industri Raya Blok C-12, Kawasan Pergudangan, Malang',
      phone: '0813-9876-5432',
      email: 'logistik.bintangabadi@gmail.com'
    },
    items: [
      {
        id: 'item-pi-dp-1',
        itemName: 'Branding Sticker Truk Box Full Wrapping (2 Unit)',
        description: 'Bahan Ritrama + Laminasi UV Glossy, Resolusi Cetak 1200 DPI High-Definition',
        quantity: 2,
        unit: 'unit',
        unitPrice: 5000000,
        discountPercent: 0,
        discountAmount: 0,
        isTaxable: false,
        totalPrice: 10000000
      }
    ],
    subtotal: 10000000,
    discountAmount: 0,
    taxableBase: 10000000,
    taxRate: 0,
    taxAmount: 0,
    grandTotal: 10000000,
    paymentScheme: 'DP',
    paymentSchedules: piDpSchedules,
    dpRequiredPercent: 40,
    dpRequiredAmount: 4000000,
    amountPaid: 0,
    balanceDue: 10000000,
    payments: [],
    paymentTerms: identity.defaultTerms,
    bankAccounts: identity.bankAccounts,
    issuedBy: 'Kak Syafira (Admin)',
    issuedByRole: 'ADMIN',
    createdAt: Date.now() - 14400000,
    updatedAt: Date.now()
  };

  return [sampleProformaTermin, sampleTermin1Invoice, sampleInvoice146, sampleProformaDp];
}

/**
 * Mendapatkan status tampilan jadwal termin / DP (Tagihan Ini, Lunas, Belum)
 * Sesuai skema perubahan status pada Invoice & Proforma Invoice UI & PDF:
 * - Proforma Invoice:
 *   - Termin yang sudah diterbitkan & belum bayar: "Tagihan Ini"
 *   - Termin yang sudah menerima pelunasan / termin berikutnya sudah diterbitkan: "Lunas"
 *   - Termin yang belum diterbitkan: "Belum"
 * - Invoice Final (INV):
 *   - Termin tahap ini: "Tagihan Ini" (atau "Lunas" jika invoice sudah dibayar/PAID)
 *   - Termin sebelum tahap ini: "Lunas"
 *   - Termin sesudah tahap ini: "Belum"
 */
export function getTerminStageDisplayInfo(
  inv: Invoice,
  sched: InvoiceTerminSchedule,
  schedIdx: number,
  allInvoices?: Invoice[]
): {
  status: 'Lunas' | 'Tagihan Ini' | 'Belum';
  badgeClass: string;
  isCurrent: boolean;
} {
  if (!inv) {
    return { status: 'Belum', badgeClass: 'text-slate-500 bg-slate-100 font-medium', isCurrent: false };
  }

  // 1. Jika dokumen merupakan INVOICE FINAL KOMERSIAL (INV)
  if (inv.documentType === 'COMMERCIAL') {
    let billedIdx = -1;
    const scheds = Array.isArray(inv.paymentSchedules) ? inv.paymentSchedules : [];

    if (inv.terminStageId) {
      billedIdx = scheds.findIndex(s => s.id === inv.terminStageId);
    }
    if (billedIdx === -1 && inv.terminStageNumber !== undefined) {
      billedIdx = inv.terminStageNumber - 1;
    }
    if (billedIdx === -1) {
      const docNum = inv.documentNumber || '';
      const refDesc = (inv.referenceDescription || '').toLowerCase();
      if (docNum.includes('/T1') || refDesc.includes('termin 1')) billedIdx = 0;
      else if (docNum.includes('/T2') || refDesc.includes('termin 2')) billedIdx = 1;
      else if (docNum.includes('/T3') || refDesc.includes('termin 3')) billedIdx = 2;
      else if (docNum.includes('/T4') || refDesc.includes('termin 4')) billedIdx = 3;
      else if (docNum.includes('/DP') || refDesc.includes('dp') || refDesc.includes('uang muka')) billedIdx = 0;
      else if (docNum.includes('/PELUNASAN') || refDesc.includes('pelunasan')) billedIdx = 1;
    }

    if (billedIdx !== -1) {
      if (schedIdx < billedIdx) {
        return { status: 'Lunas', badgeClass: 'text-emerald-700 bg-emerald-100 font-bold', isCurrent: false };
      }
      if (schedIdx === billedIdx) {
        const isPaid = inv.status === 'PAID' || (inv.balanceDue !== undefined && inv.balanceDue <= 0) || sched.isPaid;
        if (isPaid) {
          return { status: 'Lunas', badgeClass: 'text-emerald-700 bg-emerald-100 font-bold', isCurrent: true };
        }
        return { status: 'Tagihan Ini', badgeClass: 'text-indigo-700 bg-indigo-100 font-bold ring-1 ring-indigo-300', isCurrent: true };
      }
      return { status: 'Belum', badgeClass: 'text-slate-500 bg-slate-100 font-medium', isCurrent: false };
    }
  }

  // 2. Jika dokumen merupakan PROFORMA INVOICE (PI) atau draf umum
  const childNums = (Array.isArray(inv.childInvoiceNumbers) ? inv.childInvoiceNumbers : [])
    .map(num => String(num ?? ''));
  const scheds = Array.isArray(inv.paymentSchedules) ? inv.paymentSchedules : [];

  // Periksa apakah termin ini sudah pernah diterbitkan invoice-nya
  const isSchedBilled = childNums.some(num => {
    if (num.endsWith(`/T${schedIdx + 1}`)) return true;
    if (schedIdx === 0 && (num.endsWith('/DP') || num.includes('/T1'))) return true;
    if (schedIdx === 1 && (num.endsWith('/PELUNASAN') || num.includes('/T2'))) return true;
    return false;
  });

  // Periksa apakah ada termin sesudahnya yang sudah diterbitkan
  const isSubsequentBilled = scheds.some((_, laterIdx) => {
    if (laterIdx <= schedIdx) return false;
    return childNums.some(num => num.endsWith(`/T${laterIdx + 1}`) || (laterIdx === 1 && num.endsWith('/PELUNASAN')));
  });

  if (isSubsequentBilled) {
    return { status: 'Lunas', badgeClass: 'text-emerald-700 bg-emerald-100 font-bold', isCurrent: false };
  }

  if (isSchedBilled) {
    let isChildPaid = false;
    if (Array.isArray(allInvoices)) {
      const childInv = allInvoices.find(ci => {
        const docNumber = typeof ci?.documentNumber === 'string' ? ci.documentNumber : '';
        return childNums.includes(docNumber) && (
          ci.terminStageNumber === schedIdx + 1 ||
          docNumber.endsWith(`/T${schedIdx + 1}`) ||
          (schedIdx === 0 && docNumber.endsWith('/DP')) ||
          (schedIdx === 1 && docNumber.endsWith('/PELUNASAN'))
        );
      });
      if (childInv && (childInv.status === 'PAID' || (childInv.balanceDue !== undefined && childInv.balanceDue <= 0))) {
        isChildPaid = true;
      }
    }

    if (isChildPaid || sched.isPaid) {
      return { status: 'Lunas', badgeClass: 'text-emerald-700 bg-emerald-100 font-bold', isCurrent: false };
    }
    return { status: 'Tagihan Ini', badgeClass: 'text-indigo-700 bg-indigo-100 font-bold ring-1 ring-indigo-300', isCurrent: true };
  }

  if (sched.isPaid) {
    return { status: 'Lunas', badgeClass: 'text-emerald-700 bg-emerald-100 font-bold', isCurrent: false };
  }

  return { status: 'Belum', badgeClass: 'text-slate-500 bg-slate-100 font-medium', isCurrent: false };
}

/**
 * Menghitung status & sisa tagihan efektif Proforma Invoice secara otomatis
 * berdasarkan seluruh pembayaran (direct maupun child invoice seperti INV/.../T1, T2, DP, dsb.)
 * Menjamin perubahan sisa pembayaran otomatis terupdate pada seluruh metode pembayaran.
 */
export function getProformaEffectivePaymentInfo(
  inv: Invoice,
  allInvoices?: Invoice[]
): {
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  statusLabel: string;
} {
  if (inv.status === 'CANCELLED') {
    const netPaid = Math.max(0, (inv.amountPaid || 0) - (inv.cancellation?.refundAmount || 0));
    return {
      amountPaid: netPaid,
      balanceDue: 0,
      status: 'CANCELLED',
      statusLabel: inv.documentType === 'PROFORMA' 
        ? 'Dibatalkan / Void' 
        : (inv.cancellation?.creditNoteNumber ? `Nota Kredit (${inv.cancellation.creditNoteNumber})` : 'Dibatalkan')
    };
  }

  if (inv.documentType !== 'PROFORMA') {
    const paid = inv.amountPaid || 0;
    const due = inv.balanceDue !== undefined ? inv.balanceDue : Math.max(0, inv.grandTotal - paid);
    return {
      amountPaid: paid,
      balanceDue: due,
      status: inv.status,
      statusLabel: inv.status === 'PAID' ? 'Lunas (Paid)' : (inv.status === 'PARTIAL' ? 'DP / Sebagian' : 'Belum Bayar')
    };
  }

  // Cari seluruh child invoice komersial yang terhubung ke proforma ini
  let totalChildPaid = 0;
  const childPaymentRefIds = new Set<string>();
  const childPaymentSignatures = new Set<string>();
  let hasLinkedChildren = false;

  if (allInvoices && allInvoices.length > 0) {
    const linkedChildInvoices = allInvoices.filter(ci =>
      ci.documentType === 'COMMERCIAL' && (
        (ci.sourceProformaId && ci.sourceProformaId === inv.id) ||
        (ci.sourceProformaNumber && ci.sourceProformaNumber === inv.documentNumber) ||
        (inv.childInvoiceIds && inv.childInvoiceIds.includes(ci.id)) ||
        (inv.childInvoiceNumbers && inv.childInvoiceNumbers.includes(ci.documentNumber)) ||
        (inv.convertedInvoiceId && inv.convertedInvoiceId === ci.id) ||
        (inv.convertedInvoiceNumber && inv.convertedInvoiceNumber === ci.documentNumber)
      )
    );
    hasLinkedChildren = linkedChildInvoices.length > 0;

    const childInvoices = linkedChildInvoices.filter(ci => ci.status !== 'CANCELLED');
    totalChildPaid = childInvoices.reduce((acc, ci) => acc + (ci.amountPaid || 0), 0);
    childInvoices.forEach(ci => {
      (ci.payments || []).forEach(p => {
        if (p.id) childPaymentRefIds.add(p.id);
        if (p.referenceNumber) childPaymentRefIds.add(p.referenceNumber);
        if (p.paymentDate && p.amount) {
          childPaymentSignatures.add(
            `${p.paymentDate}|${p.amount}|${(p.paymentMethod || '').toUpperCase()}`
          );
        }
      });
    });
  }

  // Hitung pembayaran langsung pada proforma yang tidak duplikasi dengan child invoice
  const directPaid = (inv.payments || [])
    .filter(p => {
      if ((p.id && childPaymentRefIds.has(p.id)) || (p.referenceNumber && childPaymentRefIds.has(p.referenceNumber))) {
        return false;
      }
      const signature = p.paymentDate && p.amount
        ? `${p.paymentDate}|${p.amount}|${(p.paymentMethod || '').toUpperCase()}`
        : '';
      return !(signature && childPaymentSignatures.has(signature));
    })
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  // Jika proforma sudah memiliki child invoice, nilai amountPaid lama bisa saja
  // masih memuat pembayaran child yang kemudian dibatalkan. Gunakan rekonsiliasi
  // berbasis pembayaran agar tidak terjadi double counting / overstated.
  const reconciledPaid = directPaid + totalChildPaid;
  const totalPaid = Math.min(
    inv.grandTotal,
    hasLinkedChildren
      ? reconciledPaid
      : Math.max(inv.amountPaid || 0, reconciledPaid)
  );
  const balanceDue = Math.max(0, inv.grandTotal - totalPaid);

  let status: InvoiceStatus = inv.status;
  let statusLabel = 'DP / Sebagian';

  if (balanceDue === 0 && inv.grandTotal > 0) {
    status = 'PAID';
    statusLabel = 'Lunas (Paid)';
  } else if (totalPaid > 0) {
    status = 'PARTIAL';
    statusLabel = 'DP / Sebagian';
  } else {
    // Belum ada pembayaran masuk
    // Sesuai ketentuan untuk Proforma dengan Termin / DP / Skema bertahap:
    if (inv.paymentScheme === 'TERMIN' || inv.paymentScheme === 'DP' || (inv.paymentSchedules && inv.paymentSchedules.length > 1)) {
      status = 'PARTIAL';
      statusLabel = 'DP / Sebagian';
    } else {
      status = inv.status === 'CONVERTED' ? 'CONVERTED' : (inv.status || 'ISSUED');
      statusLabel = status === 'CONVERTED' ? 'Terkonversi ke INV' : 'Belum Bayar';
    }
  }

  return {
    amountPaid: totalPaid,
    balanceDue,
    status,
    statusLabel
  };
}

/**
 * Mengonversi data Invoice ke format standar Transaction (Laporan Penjualan)
 * Selaras dengan metode perhitungan InvoiceScreen:
 * - Menghindari double counting antara Proforma Invoice dan Invoice Komersial hasil konversi termin/DP
 * - Invoice yang Dibatalkan (CANCELLED) / Credit Note memiliki kontribusi omzet Rp 0 & piutang Rp 0
 * - Memetakan pembayaran rincian ke kas (tunai), transfer bank, dan QRIS
 */
export function convertInvoicesToTransactions(invoices: Invoice[]): Transaction[] {
  if (!Array.isArray(invoices) || invoices.length === 0) return [];

  // Filter dokumen invoice agar selaras dengan ringkasan finansial InvoiceScreen:
  // 1. Dokumen COMMERCIAL selalu disertakan (baik independen maupun child termin dari PI)
  // 2. Dokumen PROFORMA hanya disertakan jika belum memiliki child invoice komersial dan belum terkonversi
  // 3. Exclude status DRAFT dan EXPIRED (karena belum menjadi kesepakatan/transaksi riil)
  const eligibleInvoices = invoices.filter((inv) => {
    if (!inv || !inv.id) return false;
    if (inv.status === 'DRAFT' || inv.status === 'EXPIRED') return false;

    if (inv.documentType === 'COMMERCIAL') return true;
    if (inv.documentType === 'PROFORMA') {
      const hasChildInvoices = Array.isArray(inv.childInvoiceIds) && inv.childInvoiceIds.length > 0;
      const isConverted = inv.status === 'CONVERTED' || Boolean(inv.convertedInvoiceId);
      return !hasChildInvoices && !isConverted;
    }
    return false;
  });

  return eligibleInvoices.map((inv) => {
    const isCancelled = inv.status === 'CANCELLED';
    const effectiveInfo = inv.documentType === 'PROFORMA'
      ? getProformaEffectivePaymentInfo(inv, invoices)
      : {
          amountPaid: inv.amountPaid || 0,
          balanceDue: inv.balanceDue ?? Math.max(0, inv.grandTotal - (inv.amountPaid || 0)),
          status: inv.status,
          statusLabel: inv.status === 'PAID' ? 'Lunas (Paid)' : inv.status === 'PARTIAL' ? 'DP / Sebagian' : 'Belum Bayar'
        };

    // Hitung rincian metode pembayaran dari payments
    let cash = 0;
    let transfer = 0;
    let qris = 0;

    (inv.payments || []).forEach((p) => {
      const m = (p.paymentMethod || '').toUpperCase();
      const amt = p.amount || 0;
      if (m === 'CASH' || m === 'TUNAI') {
        cash += amt;
      } else if (m === 'QRIS') {
        qris += amt;
      } else {
        // TRANSFER, GIRO, BANK, EDC, dll
        transfer += amt;
      }
    });

    // Fallback jika tidak ada record payments detail tapi amountPaid > 0
    if (cash === 0 && transfer === 0 && qris === 0 && effectiveInfo.amountPaid > 0) {
      transfer = effectiveInfo.amountPaid;
    }

    if (isCancelled) {
      const netPaid = Math.max(0, (inv.amountPaid || 0) - (inv.cancellation?.refundAmount || 0));
      if (netPaid <= 0) {
        cash = 0;
        transfer = 0;
        qris = 0;
      } else {
        const ratio = (inv.amountPaid && inv.amountPaid > 0) ? netPaid / inv.amountPaid : 1;
        cash = Math.round(cash * ratio);
        transfer = Math.round(transfer * ratio);
        qris = Math.round(qris * ratio);
      }
    }

    const createdAtEpoch = inv.createdAt || (inv.issueDate ? new Date(`${inv.issueDate}T12:00:00`).getTime() : Date.now());
    const timeStr = inv.createdAt
      ? new Date(inv.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '12:00';

    const mappedItems: CartItem[] = (inv.items || []).map((it, idx) => ({
      id: it.id || `inv_item_${inv.id}_${idx}`,
      code: it.productCode || 'INV-ITEM',
      name: it.itemName,
      dimensions: it.description || it.unit || '-',
      price: it.unitPrice,
      unitPrice: it.unitPrice,
      qty: it.quantity || 1,
      subtotal: it.totalPrice,
      totalPrice: it.totalPrice,
      discount: it.discountAmount || 0,
      notes: it.description || '',
      unit: it.unit || 'pcs',
      category: 'digital_printing',
      formattedSpec: `${it.quantity} ${it.unit}${it.description ? ` (${it.description})` : ''}`,
      productId: it.productId,
    }));

    const balanceDue = isCancelled ? 0 : effectiveInfo.balanceDue;
    const finalTotal = isCancelled ? 0 : inv.grandTotal;

    const tx: Transaction = {
      id: inv.documentNumber || inv.id,
      shiftId: 'shift_invoice',
      shiftName: 'B2B / Invoice',
      cashierName: inv.issuedBy || 'Admin Invoice',
      storeName: 'BEJO STIKER POS',
      date: inv.issueDate || new Date(createdAtEpoch).toISOString().slice(0, 10),
      time: timeStr,
      timestamp: createdAtEpoch,
      customer: {
        id: inv.customer?.customerId || `cust_inv_${inv.id}`,
        name: inv.customer?.name || 'Pelanggan Invoice',
        phone: inv.customer?.phone || '-',
        address: inv.customer?.address || '-',
        categoryId: 'cat_invoice',
        createdAt: new Date(createdAtEpoch).toISOString(),
      },
      customerCategory: 'INVOICE',
      items: mappedItems,
      totalQty: mappedItems.reduce((s, it) => s + (it.qty || 1), 0),
      // Invoice batal tidak boleh menyumbang omzet, DPP, PPN, maupun diskon ke laporan
      subtotal: isCancelled ? 0 : (inv.subtotal || 0),
      tax: isCancelled ? 0 : (inv.taxAmount || 0),
      discount: isCancelled ? 0 : (inv.discountAmount || 0),
      total: finalTotal,
      paymentMethods: {
        cash,
        transfer,
        qris,
      },
      paidAmount: isCancelled ? Math.max(0, (inv.amountPaid || 0) - (inv.cancellation?.refundAmount || 0)) : effectiveInfo.amountPaid,
      change: 0,
      cashierNotes: inv.notes || inv.projectTitle || `Invoice ${inv.documentNumber}`,
      notes: inv.projectTitle,
      // Metadata Invoice
      isInvoice: true,
      invoiceDoc: inv,
      invoiceStatus: isCancelled ? 'CANCELLED' : effectiveInfo.status,
      invoiceDocumentType: inv.documentType,
      balanceDue,
      projectTitle: inv.projectTitle,
    };

    return tx;
  });
}



