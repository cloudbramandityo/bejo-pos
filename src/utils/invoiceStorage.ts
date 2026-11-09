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
  defaultTerms: '1. DP minimal 50% dibayar sebelum proses cetak & cutting dimulai.\n2. Sisa tagihan dilunasi saat pesanan selesai, sebelum barang diserahkan.\n3. Barang yang sudah dicetak/dipotong sesuai acc desain tidak dapat dibatalkan atau dikembalikan.',
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

const STAGE_BADGE_LUNAS = 'text-emerald-700 bg-emerald-100 font-bold';
const STAGE_BADGE_TAGIHAN_INI = 'text-indigo-700 bg-indigo-100 font-bold ring-1 ring-indigo-300';
const STAGE_BADGE_BELUM = 'text-slate-500 bg-slate-100 font-medium';

function asStageAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Baris jadwal yang memang sudah dicatat lunas (fakta yang tersimpan di data). */
function isStageMarkedPaid(sched?: InvoiceTerminSchedule): boolean {
  if (!sched) return false;
  return sched.isPaid === true || String(sched.status ?? '').trim().toUpperCase() === 'LUNAS';
}

/** Dokumen sudah tertutup seluruh tagihannya (status lunas atau sisa nol). */
function isDocumentSettled(inv: Invoice): boolean {
  if (inv.status === 'PAID') return true;
  // Draf dan dokumen batal menyimpan balanceDue 0 sebagai placeholder, bukan bukti lunas.
  if (inv.status === 'DRAFT' || inv.status === 'CANCELLED') return false;
  return typeof inv.balanceDue === 'number' && inv.balanceDue <= 0 && asStageAmount(inv.grandTotal) > 0;
}

/**
 * Tahap ke-berapa yang ditagih dokumen ini, dibaca dari field tahap yang
 * ditulis saat konversi; bila tidak ada, dari nomor dokumen itu sendiri
 * (penanda /T1.. atau /DP, /PELUNASAN). Tidak ada angka tahap yang ditulis
 * tetap untuk keterangan bebas: menafsirkan kata "pelunasan" sebagai tahap ke-2
 * adalah sebab invoice pelunasan penuh menyatakan Termin 3 "Belum" padahal
 * dokumennya sendiri berstatus Lunas.
 */
function findBilledStageIndex(inv: Invoice, scheds: InvoiceTerminSchedule[]): number {
  if (inv.terminStageId) {
    const byId = scheds.findIndex(s => s.id === inv.terminStageId);
    if (byId !== -1) return byId;
  }
  if (typeof inv.terminStageNumber === 'number' && inv.terminStageNumber >= 1) {
    return inv.terminStageNumber - 1;
  }
  const docNum = String(inv.documentNumber ?? '');
  const termin = docNum.match(/\/T(\d+)/i);
  if (termin) return Number(termin[1]) - 1;
  if (/\/DP\b/i.test(docNum)) return 0;
  // Pelunasan dalam skema dua tahap adalah tahap TERAKHIR, bukan tahap kedua
  // dari daftar yang panjangnya selalu dua — jadi nilainya dari jumlah tahap.
  if (/\/PELUNASAN\b/i.test(docNum)) return Math.max(0, scheds.length - 1);
  return -1;
}

/**
 * Dokumen komersial yang menagih SELURUH kontrak (mode konversi "Penuh (Full)"):
 * tidak ada satu pun tahap yang belum ditagih, jadi tahap tidak boleh dinilai
 * dari posisinya terhadap satu tahap yang ditebak.
 */
function billsWholeContract(inv: Invoice, scheds: InvoiceTerminSchedule[]): boolean {
  if (scheds.length === 0) return false;
  const totalScheduled = scheds.reduce((acc, s) => acc + asStageAmount(s.amount), 0);
  if (totalScheduled <= 0) return false;
  const billed = asStageAmount(inv.grandTotal);
  // Toleransi Rp 1 untuk pembulatan per tahap.
  return billed >= totalScheduled - 1 || (typeof inv.terminPercentage === 'number' && inv.terminPercentage >= 100);
}

/**
 * Uang yang benar-benar masuk ke dokumen ini, menutup tahap dari depan sesuai
 * urutan jadwal. Dipakai hanya untuk dokumen yang menagih seluruh kontrak,
 * karena invoice satu tahap hanya menerima uang untuk tahapnya sendiri.
 */
function isStageCoveredByRecordedPayment(
  inv: Invoice,
  scheds: InvoiceTerminSchedule[],
  schedIdx: number
): boolean {
  const paid = Math.max(asStageAmount(inv.amountPaid), (inv.payments || [])
    .reduce((acc, p) => acc + asStageAmount(p.amount), 0));
  if (paid <= 0) return false;
  let cumulative = 0;
  for (let i = 0; i <= schedIdx; i++) {
    cumulative += asStageAmount(scheds[i]?.amount);
  }
  return cumulative > 0 && paid >= cumulative - 1;
}

/**
 * Penanda tahap pada akhir nomor dokumen (contoh INV/BJP/2026/11/0002/T3).
 *
 * Nilainya SELALU hasil pembacaan skema + posisi tahap, bukan angka yang ditulis
 * tetap di layar atau di alur konversi: skema DP memakai /DP untuk tahap pertama
 * dan /PELUNASAN untuk tahap TERAKHIR (jumlah tahapnya dibaca, jadi skema DP tiga
 * tahap tidak lagi menyalahkan tahap tengah sebagai pelunasan), skema lain memakai
 * /T{nomor tahap}. Pembaca status tahap (findBilledStageIndex) memakai aturan yang
 * sama, jadi nomor dan isian tidak pernah saling bertentangan.
 */
export function resolveStageSuffix(
  scheme: InvoicePaymentMethodType | undefined,
  stageIndex: number,
  totalStages: number
): string {
  if (scheme === 'DP') {
    if (stageIndex <= 0) return 'DP';
    if (stageIndex >= totalStages - 1) return 'PELUNASAN';
  }
  return `T${stageIndex + 1}`;
}

/**
 * Semua penanda nomor dokumen yang sah untuk satu tahap.
 *
 * Daftar ini dibangun dari resolveStageSuffix (aturan tunggal) plus bentuk /T{n}
 * umum, jadi membandingkan nomor dokumen tidak pernah menulis angka tahap di
 * tempat lain. Skema DP ikut menerima /DP dan /PELUNASAN karena dokumen lama
 * bisa memakai keduanya, dan tahap terakhir skema DP bernama /PELUNASAN apa pun
 * jumlah tahapnya.
 */
export function stageNumberAliases(
  scheme: InvoicePaymentMethodType | undefined,
  stageIndex: number,
  totalStages: number
): string[] {
  const aliases = [`/${resolveStageSuffix(scheme, stageIndex, totalStages)}`, `/T${stageIndex + 1}`];
  if (scheme === 'DP') {
    if (stageIndex === 0) aliases.push('/DP');
    if (stageIndex === totalStages - 1) aliases.push('/PELUNASAN');
  }
  return Array.from(new Set(aliases));
}

/**
 * Mendapatkan status tampilan jadwal termin / DP (Tagihan Ini, Lunas, Belum).
 *
 * Dasarnya selalu keadaan yang tercatat, bukan posisi baris:
 * - Invoice Final (INV) yang menagih seluruh kontrak: setiap tahap dinilai dari
 *   flag lunas pada barisnya, status dokumen, atau uang yang masuk. Tidak ada
 *   tahap yang dinyatakan "Belum" karena dokumen itu sendiri sudah menagihnya.
 * - Invoice Final per tahap: tahap sebelumnya lunas, tahap ini mengikuti status
 *   pembayaran, tahap sesudahnya "Belum" KECUALI barisnya sudah dicatat lunas.
 * - Proforma Invoice: mengikuti tahap yang sudah diterbitkan child invoice-nya.
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
    return { status: 'Belum', badgeClass: STAGE_BADGE_BELUM, isCurrent: false };
  }

  const scheds = Array.isArray(inv.paymentSchedules) ? inv.paymentSchedules : [];

  // 1. Jika dokumen merupakan INVOICE FINAL KOMERSIAL (INV)
  if (inv.documentType === 'COMMERCIAL') {
    const billedIdx = findBilledStageIndex(inv, scheds);

    if (billedIdx === -1 && billsWholeContract(inv, scheds)) {
      const settled = isStageMarkedPaid(sched) || isDocumentSettled(inv) || isStageCoveredByRecordedPayment(inv, scheds, schedIdx);
      if (settled) {
        return { status: 'Lunas', badgeClass: STAGE_BADGE_LUNAS, isCurrent: false };
      }
      return { status: 'Tagihan Ini', badgeClass: STAGE_BADGE_TAGIHAN_INI, isCurrent: true };
    }

    if (billedIdx !== -1) {
      if (schedIdx < billedIdx) {
        return { status: 'Lunas', badgeClass: STAGE_BADGE_LUNAS, isCurrent: false };
      }
      if (schedIdx === billedIdx) {
        if (isDocumentSettled(inv) || isStageMarkedPaid(sched)) {
          return { status: 'Lunas', badgeClass: STAGE_BADGE_LUNAS, isCurrent: true };
        }
        return { status: 'Tagihan Ini', badgeClass: STAGE_BADGE_TAGIHAN_INI, isCurrent: true };
      }
      // Tahap sesudahnya: flag lunas yang tercatat menang atas urutan posisi.
      if (isStageMarkedPaid(sched) || isDocumentSettled(inv)) {
        return { status: 'Lunas', badgeClass: STAGE_BADGE_LUNAS, isCurrent: false };
      }
      return { status: 'Belum', badgeClass: STAGE_BADGE_BELUM, isCurrent: false };
    }

    // Invoice komersial tanpa penanda tahap dan tidak menagih seluruh kontrak:
    // tutup tahap dari depan sesuai uang yang masuk, sisanya belum tertagih.
    if (isStageMarkedPaid(sched) || isStageCoveredByRecordedPayment(inv, scheds, schedIdx)) {
      return { status: 'Lunas', badgeClass: STAGE_BADGE_LUNAS, isCurrent: false };
    }
    const firstOpen = scheds.findIndex((s, i) => !isStageMarkedPaid(s) && !isStageCoveredByRecordedPayment(inv, scheds, i));
    if (firstOpen === schedIdx) {
      return { status: 'Tagihan Ini', badgeClass: STAGE_BADGE_TAGIHAN_INI, isCurrent: true };
    }
    return { status: 'Belum', badgeClass: STAGE_BADGE_BELUM, isCurrent: false };
  }

  // 2. Jika dokumen merupakan PROFORMA INVOICE (PI) atau draf umum
  const childNums = (Array.isArray(inv.childInvoiceNumbers) ? inv.childInvoiceNumbers : [])
    .map(num => String(num ?? ''));

  // Periksa apakah ada invoice final yang menagih SELURUH kontrak di bawah PI
  // ini. Kalau ada, tidak ada tahap yang belum ditagih — jadi tahap terakhir
  // tidak boleh tertulis "Belum" hanya karena nomor dokumennya tanpa /T3.
  const fullContractChild = (Array.isArray(allInvoices) ? allInvoices : []).find(ci => {
    if (!ci || ci.documentType !== 'COMMERCIAL' || ci.status === 'CANCELLED') return false;
    const linked = (ci.sourceProformaId && ci.sourceProformaId === inv.id) ||
      (ci.sourceProformaNumber && ci.sourceProformaNumber === inv.documentNumber) ||
      (inv.childInvoiceIds?.includes(ci.id)) ||
      (inv.childInvoiceNumbers?.includes(String(ci.documentNumber ?? '')));
    if (!linked) return false;
    return findBilledStageIndex(ci, Array.isArray(ci.paymentSchedules) ? ci.paymentSchedules : []) === -1 &&
      billsWholeContract(ci, Array.isArray(ci.paymentSchedules) ? ci.paymentSchedules : []);
  });

  // Penanda nomor yang mungkin dipakai child invoice untuk tahap ini. Daftarnya
  // berasal dari skema + posisi tahap (resolveStageSuffix), bukan dari angka
  // tahap yang ditulis tetap per posisi.
  const aliases = stageNumberAliases(inv.paymentScheme, schedIdx, scheds.length);
  const billedByChild = (num: string) => aliases.some(alias => num.endsWith(alias));

  // Periksa apakah termin ini sudah pernah diterbitkan invoice-nya
  const isSchedBilled = !!fullContractChild || childNums.some(billedByChild);

  // Periksa apakah ada termin sesudahnya yang sudah diterbitkan
  const isSubsequentBilled = !fullContractChild && scheds.some((_, laterIdx) => {
    if (laterIdx <= schedIdx) return false;
    const laterAliases = stageNumberAliases(inv.paymentScheme, laterIdx, scheds.length);
    return childNums.some(num => laterAliases.some(alias => num.endsWith(alias)));
  });

  if (isSubsequentBilled) {
    return { status: 'Lunas', badgeClass: STAGE_BADGE_LUNAS, isCurrent: false };
  }

  if (isSchedBilled) {
    let isChildPaid = false;
    if (fullContractChild) {
      isChildPaid = isDocumentSettled(fullContractChild) ||
        isStageCoveredByRecordedPayment(fullContractChild, scheds, schedIdx);
    }
    if (!isChildPaid && Array.isArray(allInvoices)) {
      const childInv = allInvoices.find(ci => {
        const docNumber = typeof ci?.documentNumber === 'string' ? ci.documentNumber : '';
        return childNums.includes(docNumber) && (
          ci.terminStageNumber === schedIdx + 1 ||
          billedByChild(docNumber) ||
          sched.invoiceNumber === docNumber
        );
      });
      if (childInv && isDocumentSettled(childInv)) {
        isChildPaid = true;
      }
    }

    if (isChildPaid || isStageMarkedPaid(sched)) {
      return { status: 'Lunas', badgeClass: STAGE_BADGE_LUNAS, isCurrent: false };
    }
    return { status: 'Tagihan Ini', badgeClass: STAGE_BADGE_TAGIHAN_INI, isCurrent: true };
  }

  if (isStageMarkedPaid(sched)) {
    return { status: 'Lunas', badgeClass: STAGE_BADGE_LUNAS, isCurrent: false };
  }

  return { status: 'Belum', badgeClass: STAGE_BADGE_BELUM, isCurrent: false };
}

/** Induk proforma dari satu dokumen tagihan (dibaca dari relasi yang tersimpan). */
function resolveSourceProforma(inv: Invoice, allInvoices: Invoice[]): Invoice | undefined {
  if (inv.documentType === 'PROFORMA') return inv;
  return allInvoices.find(p => p && p.documentType === 'PROFORMA' && (
    (inv.sourceProformaId && p.id === inv.sourceProformaId) ||
    (inv.sourceProformaNumber && p.documentNumber === inv.sourceProformaNumber) ||
    (p.convertedInvoiceId === inv.id) ||
    (p.convertedInvoiceNumber === inv.documentNumber) ||
    (p.childInvoiceIds?.includes(inv.id)) ||
    (p.childInvoiceNumbers?.includes(String(inv.documentNumber ?? '')))
  ));
}

/** Seluruh invoice final yang diterbitkan dari satu proforma (tanpa yang dibatalkan). */
function linkedCommercialInvoices(proforma: Invoice, allInvoices: Invoice[]): Invoice[] {
  return allInvoices.filter(ci => ci && ci.documentType === 'COMMERCIAL' && ci.status !== 'CANCELLED' && (
    (ci.sourceProformaId && ci.sourceProformaId === proforma.id) ||
    (ci.sourceProformaNumber && ci.sourceProformaNumber === proforma.documentNumber) ||
    (proforma.childInvoiceIds?.includes(ci.id)) ||
    (proforma.childInvoiceNumbers?.includes(String(ci.documentNumber ?? ''))) ||
    (proforma.convertedInvoiceId === ci.id) ||
    (proforma.convertedInvoiceNumber === ci.documentNumber)
  ));
}

function paymentSignature(p: InvoicePayment): string {
  const date = String(p.paymentDate ?? '').trim();
  const amount = asStageAmount(p.amount);
  if (date && amount > 0) {
    return `${date}|${amount}|${String(p.paymentMethod ?? '').trim().toUpperCase()}`;
  }
  return `id:${String(p.id ?? '')}`;
}

/**
 * Riwayat pembayaran yang benar-benar tercatat untuk satu dokumen tagihan.
 *
 * Dokumen yang menagih seluruh kontrak (invoice "Penuh (Full)" dan proforma
 * induknya) harus menampilkan seluruh pembayaran yang masuk ke kontrak itu,
 * termasuk yang dicatat pada invoice termin di bawahnya. Cara lama hanya
 * membaca `invoice.payments` milik dokumen itu sendiri, sehingga invoice
 * pelunasan penuh tidak punya satu pun baris riwayat padahal termin 1-3 sudah
 * dibayar dan tercetak di faktur terminnya masing-masing.
 *
 * Hanya untuk ditampilkan: angka `amountPaid`/`balanceDue` tidak dihitung dari
 * daftar ini, supaya pembayaran yang tersalin antar dokumen tidak dihitung dua
 * kali (perhitungan efektif tetap di getProformaEffectivePaymentInfo).
 */
export function getInvoicePaymentHistory(
  inv: Invoice,
  allInvoices?: Invoice[]
): InvoicePayment[] {
  if (!inv) return [];
  const own = Array.isArray(inv.payments) ? inv.payments : [];
  if (!Array.isArray(allInvoices) || allInvoices.length === 0) return [...own];

  const scheds = Array.isArray(inv.paymentSchedules) ? inv.paymentSchedules : [];
  const billsWholeContractDoc = inv.documentType === 'PROFORMA' ||
    (inv.documentType === 'COMMERCIAL' &&
      findBilledStageIndex(inv, scheds) === -1 &&
      billsWholeContract(inv, scheds));

  if (!billsWholeContractDoc) return [...own];

  const pool = [...own];
  const source = resolveSourceProforma(inv, allInvoices);
  if (source) {
    pool.push(...(Array.isArray(source.payments) ? source.payments : []));
    for (const sibling of linkedCommercialInvoices(source, allInvoices)) {
      if (sibling.id === inv.id) continue;
      pool.push(...(Array.isArray(sibling.payments) ? sibling.payments : []));
    }
  }

  const seenKeys = new Set<string>();
  const seenReferences = new Set<string>();
  const ordered = pool
    .filter(p => p && asStageAmount(p.amount) > 0)
    .sort((a, b) => {
      const dateCompare = String(a.paymentDate ?? '').localeCompare(String(b.paymentDate ?? ''));
      return dateCompare !== 0 ? dateCompare : Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0);
    });

  const history: InvoicePayment[] = [];
  for (const p of ordered) {
    const reference = String(p.referenceNumber ?? '').trim().toUpperCase();
    if (reference && seenReferences.has(reference)) continue;
    const signature = paymentSignature(p);
    // Baris tanpa tanggal/nominal tidak punya tanda yang bisa dibandingkan.
    if (signature !== 'id:' && seenKeys.has(signature)) continue;
    seenKeys.add(signature);
    if (reference) seenReferences.add(reference);
    history.push(p);
  }
  return history;
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
      storeName: 'BEJO Digital Print',
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



