/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 * Modul Manajemen Proforma Invoice (PI) & Invoice Komersial (INV)
 * Dapat dipakai akun DEVELOPER, ADMIN, dan OWNER
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Printer,
  Download,
  Trash2,
  Edit,
  DollarSign,
  Building,
  User,
  CreditCard,
  Settings,
  Calendar,
  Layers,
  ChevronDown,
  X,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Receipt,
  Eye,
  Maximize2,
  Sparkles,
  Link2,
  Ban,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import {
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceDocumentType,
  InvoiceStatus,
  InvoiceStoreIdentity,
  InvoiceCustomerInfo,
  Product,
  Customer,
  AppUser,
  InvoicePaymentMethodType,
  InvoiceTerminSchedule,
  CancellationReasonType,
  InvoiceCancellationInfo
} from '../types';
import {
  getStoredInvoices,
  saveStoredInvoices,
  getStoredInvoiceStoreIdentity,
  saveStoredInvoiceStoreIdentity,
  calculateInvoiceTotals,
  generateNextDocumentNumber,
  generateNextCreditNoteNumber,
  generateDefaultPaymentSchedules,
  recalculatePaymentSchedules,
  autoBalancePaymentSchedules,
  DEFAULT_INVOICE_STORE_IDENTITY,
  getTerminStageDisplayInfo,
  getProformaEffectivePaymentInfo
} from '../utils/invoiceStorage';
import {
  subscribeInvoices,
  saveInvoiceCloud,
  deleteInvoiceCloud,
  subscribeInvoiceStoreIdentity,
  saveInvoiceStoreIdentityCloud
} from '../backend/pocketbaseBackend';
import { buildOpenAccountInvoiceItems } from '../utils/openAccountStorage';
import { canManageBusinessData } from '../utils/recordAccess';
import { exportInvoiceToPDF } from '../utils/invoicePdf';
import { StoreLogo } from './StoreLogo';
import { SalesTransactionPickerModal } from './modals/SalesTransactionPickerModal';

interface InvoiceScreenProps {
  products: Product[];
  customers: Customer[];
  currentUser: AppUser | null;
  userRole?: string;
  pendingOpenAccountGroup?: any;
  onClearPendingOpenAccountGroup?: () => void;
}

function parseLocalizedDecimal(value: string): number {
  const normalized = String(value ?? '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampDpPercent(value: number): number {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function dpPercentFromAmount(amount: number, grandTotal: number): number {
  if (grandTotal <= 0) return 0;
  return (amount / grandTotal) * 100;
}

function formatPercentInput(value: number): string {
  const rounded = Math.round((Number(value) || 0) * 10000) / 10000;
  return String(rounded).replace('.', ',');
}

export const InvoiceScreen: React.FC<InvoiceScreenProps> = ({
  products,
  customers,
  currentUser,
  userRole,
  pendingOpenAccountGroup,
  onClearPendingOpenAccountGroup
}) => {
  // Wewenang hapus dokumen manual: DEVELOPER, ADMIN, dan OWNER.
  const canManage = canManageBusinessData(currentUser?.role || userRole);

  // Main Data States
  const [invoices, setInvoices] = useState<Invoice[]>(() => getStoredInvoices());
  const [storeIdentity, setStoreIdentity] = useState<InvoiceStoreIdentity>(() => getStoredInvoiceStoreIdentity());
  
  // View & Tab States
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'create' | 'settings'>('list');
  const [filterType, setFilterType] = useState<'ALL' | 'PROFORMA' | 'COMMERCIAL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Selected Invoice for View / Print / Edit / Payment / Conversion / Cancellation
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printDocType, setPrintDocType] = useState<'invoice' | 'credit_note'>('invoice');
  const [printMode, setPrintMode] = useState<'a4' | 'thermal'>('a4');
  const [paperSize, setPaperSize] = useState<'a4' | 'f4'>('a4');
  const [paperOrientation, setPaperOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState<boolean>(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Cancellation Modal & Credit Note Generation States
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);
  const [cancelReasonCategory, setCancelReasonCategory] = useState<CancellationReasonType>('MUTUAL_AGREEMENT');
  const [cancelReasonDetails, setCancelReasonDetails] = useState<string>('');
  const [cancelProofUrl, setCancelProofUrl] = useState<string>('');
  const [cancelCreditNoteNumber, setCancelCreditNoteNumber] = useState<string>('');
  const [cancelCreditNoteDate, setCancelCreditNoteDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [cancelTaxReturnNumber, setCancelTaxReturnNumber] = useState<string>('');
  const [cancelCancellationFee, setCancelCancellationFee] = useState<number>(0);
  const [cancelRefundAmount, setCancelRefundAmount] = useState<number>(0);
  const [cancelRefundMethod, setCancelRefundMethod] = useState<string>('TRANSFER');
  const [cancelRefundBankTarget, setCancelRefundBankTarget] = useState<string>('');
  const [cancelRefundProofUrl, setCancelRefundProofUrl] = useState<string>('');
  const [cancelRefundDate, setCancelRefundDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  
  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync with Backend Server API (Dual-Storage Fallback: API + LocalStorage)
  const fetchInvoicesFromBackend = async () => {
    try {
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        if (data.invoices && Array.isArray(data.invoices) && data.invoices.length > 0) {
          setInvoices(data.invoices);
          saveStoredInvoices(data.invoices);
        }
      }
    } catch {
      // Graceful offline fallback to LocalStorage
    }
  };

  const fetchIdentityFromBackend = async () => {
    try {
      const res = await fetch('/api/invoices/store-identity');
      if (res.ok) {
        const data = await res.json();
        if (data.identity && data.identity.storeName) {
          setStoreIdentity(data.identity);
          saveStoredInvoiceStoreIdentity(data.identity);
        }
      }
    } catch {
      // Graceful offline fallback
    }
  };

  useEffect(() => {
    fetchInvoicesFromBackend();
    fetchIdentityFromBackend();

    // 1. Real-time Cloud Sync via PocketBase PocketBase subscriptions
    let hasReceivedCloudSnapshot = false;
    const unsubInvoices = subscribeInvoices((cloudInvoices) => {
      if (cloudInvoices && Array.isArray(cloudInvoices)) {
        if (cloudInvoices.length > 0) {
          hasReceivedCloudSnapshot = true;
          setInvoices(cloudInvoices);
          saveStoredInvoices(cloudInvoices);
        } else if (hasReceivedCloudSnapshot) {
          setInvoices([]);
          saveStoredInvoices([]);
        } else {
          // Inisialisasi awal jika koleksi cloud kosong: upload dokumen lokal yang ada
          const local = getStoredInvoices();
          if (local && local.length > 0) {
            local.forEach(inv => saveInvoiceCloud(inv).catch(console.warn));
          }
          hasReceivedCloudSnapshot = true;
        }
      }
    });

    const unsubIdentity = subscribeInvoiceStoreIdentity((cloudIdentity) => {
      if (cloudIdentity && cloudIdentity.storeName) {
        setStoreIdentity(cloudIdentity);
        saveStoredInvoiceStoreIdentity(cloudIdentity);
      }
    });

    // 2. Cross-tab & local storage events
    const handleLocalInvoicesUpdated = (e: any) => {
      if (e?.detail) {
        setInvoices(e.detail);
      }
    };

    const handleLocalIdentityUpdated = (e: any) => {
      if (e?.detail) {
        setStoreIdentity(e.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bejo_pos_invoices_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setInvoices(parsed);
        } catch {}
      }
      if (e.key === 'bejo_pos_invoice_store_identity_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setStoreIdentity(parsed);
        } catch {}
      }
    };

    window.addEventListener('bejo_invoices_updated', handleLocalInvoicesUpdated);
    window.addEventListener('bejo_invoice_identity_updated', handleLocalIdentityUpdated);
    window.addEventListener('storage', handleStorageChange);

    // 3. Periodic background poll to Express backend (every 5 seconds) to ensure multi-account sync across different devices/browsers
    const pollInterval = setInterval(() => {
      fetchInvoicesFromBackend();
      fetchIdentityFromBackend();
    }, 5000);

    return () => {
      unsubInvoices();
      unsubIdentity();
      window.removeEventListener('bejo_invoices_updated', handleLocalInvoicesUpdated);
      window.removeEventListener('bejo_invoice_identity_updated', handleLocalIdentityUpdated);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, []);

  // Save changes locally and try syncing to backend
  const updateInvoicesState = (newList: Invoice[]) => {
    setInvoices(newList);
    saveStoredInvoices(newList);
  };

  // =========================================================================
  // FORM STATE FOR CREATE / EDIT INVOICE
  // =========================================================================
  const [formDocType, setFormDocType] = useState<InvoiceDocumentType>('PROFORMA');
  const [formDocNumber, setFormDocNumber] = useState<string>('');
  const [formIsCustomNumber, setFormIsCustomNumber] = useState<boolean>(false);
  const [formProjectTitle, setFormProjectTitle] = useState<string>('');
  const [formIssueDate, setFormIssueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formDueDate, setFormDueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formExpiryDate, setFormExpiryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  
  // Customer Info in Form
  const [formCustomer, setFormCustomer] = useState<InvoiceCustomerInfo>({
    name: '',
    pic: '',
    npwp: '',
    address: '',
    phone: '',
    email: ''
  });
  const [selectedCustomerOption, setSelectedCustomerOption] = useState<string>('custom');

  // Items in Form
  const [formItems, setFormItems] = useState<InvoiceItem[]>([
    {
      id: 'item-1',
      itemName: '',
      description: '',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      isTaxable: true,
      totalPrice: 0
    }
  ]);

  // Tax, Payment Scheme (Termin / DP / Full) and Terms in Form
  const [formTaxRate, setFormTaxRate] = useState<number>(11);
  const [formApplyTax, setFormApplyTax] = useState<boolean>(true);
  const [formPaymentScheme, setFormPaymentScheme] = useState<InvoicePaymentMethodType>('DP');
  const [formDpPercent, setFormDpPercent] = useState<number>(50);
  const [formPaymentSchedules, setFormPaymentSchedules] = useState<InvoiceTerminSchedule[]>([]);
  // Input DP dua mode: persentase (boleh desimal) atau nominal bulat
  const [dpPercentInput, setDpPercentInput] = useState<string>('50');
  const [dpAmountInput, setDpAmountInput] = useState<string>('0');
  const [isDpInputFocused, setIsDpInputFocused] = useState<boolean>(false);
  const [formPaymentTerms, setFormPaymentTerms] = useState<string>(storeIdentity.defaultTerms || '');
  const [formNotes, setFormNotes] = useState<string>('');

  // Reference Number State (Berdasarkan Proforma Invoice)
  const [formSourceProformaNumber, setFormSourceProformaNumber] = useState<string>('');
  const [formReferenceDescription, setFormReferenceDescription] = useState<string>('');
  const [formContractTotalAmount, setFormContractTotalAmount] = useState<number>(0);
  // Tarik Transaksi dari Laporan Penjualan State & Listeners
  const [isSalesPickerModalOpen, setIsSalesPickerModalOpen] = useState<boolean>(false);

  const loadOpenAccountGroup = (group: any) => {
    if (!group) return;

    const importedItems = buildOpenAccountInvoiceItems(group);
    if (importedItems.length === 0) {
      showToast('Tidak ada sisa tagihan Open Account untuk diterbitkan invoice.', 'info');
      return;
    }

    setActiveSubTab('create');
    setFormDocType('COMMERCIAL');
    setFormCustomer({
      name: group.customerName || '',
      pic: '',
      npwp: '',
      address: '',
      phone: group.customerPhone || '',
      email: ''
    });
    setSelectedCustomerOption('custom');
    setFormProjectTitle(`Tagihan Open Account - ${group.customerName || 'Pelanggan'}`);
    setFormNotes(group.notes ? `Catatan Rekening Terbuka (Open Account):\n${group.notes}` : '');
    setFormItems(importedItems);
    showToast(`Tagihan Open Account ${group.customerName} berhasil dimuat ke rincian invoice!`, 'success');
  };

  // Listen to pendingOpenAccountGroup from tab navigation (e.g. from SPK tab "Terbitkan Invoice")
  useEffect(() => {
    if (pendingOpenAccountGroup) {
      loadOpenAccountGroup(pendingOpenAccountGroup);
      onClearPendingOpenAccountGroup?.();
    }
  }, [pendingOpenAccountGroup]);

  const handleSelectTransactionForInvoice = (tx: any) => {
    if (tx.openAccountGroupData) {
      loadOpenAccountGroup(tx.openAccountGroupData);
      return;
    }

    if (tx.customer?.name) {
      setFormCustomer({
        name: tx.customer.name,
        pic: '',
        npwp: '',
        address: tx.customer.address || '',
        phone: tx.customer.phone || '',
        email: ''
      });
      setSelectedCustomerOption('custom');
    }

    const isOA = tx.isOpenAccount || tx.transactionType === 'Open Account';
    const isSpk = !!(tx.spkId || tx.spkOrderNumber);
    const title =
      tx.projectTitle ||
      (isOA
        ? `Tagihan Open Account - ${tx.customer?.name || 'Pelanggan'}`
        : isSpk
        ? `Pekerjaan SPK Cetak ${tx.spkOrderNumber || tx.spkId}`
        : `Pesanan POS ${tx.id}`);
    setFormProjectTitle(title);

    if (tx.items && tx.items.length > 0) {
      const mappedItems: InvoiceItem[] = tx.items.map((it: any, idx: number) => {
        const qty = it.qty || it.itemCount || 1;
        const total = it.totalPrice || 0;
        const unitP = it.unitPrice || Math.round(total / qty);
        return {
          id: `item-tx-${Date.now()}-${idx}`,
          itemName: it.name,
          description: it.formattedSpec || it.notes || it.dimensions || '',
          quantity: qty,
          unit: it.unit || 'pcs',
          unitPrice: unitP,
          discountPercent: 0,
          discountAmount: 0,
          isTaxable: true,
          totalPrice: total
        };
      });
      setFormItems(mappedItems);
    }

    if (tx.cashierNotes) {
      setFormNotes(prev => (prev ? `${prev}\n${tx.cashierNotes}` : tx.cashierNotes));
    }
    showToast(`Berhasil menarik transaksi ${tx.id} (${tx.items?.length || 0} item) ke rincian invoice!`, 'success');
  };

  useEffect(() => {
    const handleOpenAccountToInvoice = (e: any) => {
      const group = e.detail;
      if (!group) return;
      loadOpenAccountGroup(group);
    };

    window.addEventListener('bejo_create_invoice_from_open_account', handleOpenAccountToInvoice);
    return () => window.removeEventListener('bejo_create_invoice_from_open_account', handleOpenAccountToInvoice);
  }, []);

  // Auto-generate next document number when docType changes
  useEffect(() => {
    if (!formIsCustomNumber && !editingInvoiceId) {
      const generated = generateNextDocumentNumber(formDocType, invoices, storeIdentity);
      setFormDocNumber(generated);
    }
  }, [formDocType, invoices, storeIdentity, formIsCustomNumber, editingInvoiceId]);

  // Handle Customer Selection Dropdown
  const handleSelectCustomerPreset = (phoneOrId: string) => {
    setSelectedCustomerOption(phoneOrId);
    if (phoneOrId === 'custom') {
      setFormCustomer({
        name: '',
        pic: '',
        npwp: '',
        address: '',
        phone: '',
        email: ''
      });
      return;
    }
    const found = customers.find(c => c.phone === phoneOrId || c.id === phoneOrId);
    if (found) {
      setFormCustomer({
        customerId: found.id,
        name: found.name,
        pic: found.name,
        npwp: '',
        address: found.notes || '',
        phone: found.phone,
        email: ''
      });
    }
  };

  // Item Management in Form
  const handleAddItemRow = () => {
    setFormItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        itemName: '',
        description: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        discountPercent: 0,
        discountAmount: 0,
        isTaxable: formApplyTax,
        totalPrice: 0
      }
    ]);
  };

  const handleRemoveItemRow = (id: string) => {
    if (formItems.length <= 1) {
      showToast('Minimal harus ada 1 item pekerjaan.', 'info');
      return;
    }
    setFormItems(prev => prev.filter(it => it.id !== id));
  };

  const handleUpdateItemField = (id: string, field: keyof InvoiceItem, value: any) => {
    setFormItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };
      
      // Auto recalculate row total
      const qty = Math.max(0.01, Number(updated.quantity) || 1);
      const price = Number(updated.unitPrice) || 0;
      const rawTotal = qty * price;
      
      let disc = 0;
      if (updated.discountPercent && updated.discountPercent > 0) {
        disc = (rawTotal * updated.discountPercent) / 100;
        updated.discountAmount = Math.round(disc);
      } else if (field === 'discountPercent') {
        updated.discountAmount = 0;
      } else if (updated.discountAmount) {
        disc = Number(updated.discountAmount) || 0;
      }
      
      updated.totalPrice = Math.round(rawTotal - disc);
      return updated;
    }));
  };

  const handlePickProductForItem = (itemId: string, productCode: string) => {
    const prod = products.find(p => p.code === productCode || p.id === productCode);
    if (!prod) return;

    handleUpdateItemField(itemId, 'itemName', prod.name);
    handleUpdateItemField(itemId, 'productCode', prod.code);
    handleUpdateItemField(itemId, 'productId', prod.id);
    handleUpdateItemField(itemId, 'unit', prod.unit || 'pcs');
    handleUpdateItemField(itemId, 'unitPrice', prod.price || prod.hargaUmum || 0);
    if (prod.dimensions) {
      handleUpdateItemField(itemId, 'description', `Ukuran: ${prod.dimensions} | Kategori: ${prod.category}`);
    }
  };

  // Form Calculations
  const calculatedTotals = useMemo(() => {
    const effectiveTaxRate = formApplyTax ? formTaxRate : 0;
    return calculateInvoiceTotals(formItems, effectiveTaxRate, formDpPercent, 0);
  }, [formItems, formApplyTax, formTaxRate, formDpPercent]);

  // Keep payment schedules in sync with grand total when not manually modified or initialized
  const prevGrandTotalRef = useRef<number>(calculatedTotals.grandTotal);
  useEffect(() => {
    if (formPaymentSchedules.length === 0) {
      const generated = generateDefaultPaymentSchedules(formPaymentScheme, calculatedTotals.grandTotal, formIssueDate);
      setFormPaymentSchedules(generated);
      prevGrandTotalRef.current = calculatedTotals.grandTotal;
    } else if (prevGrandTotalRef.current !== calculatedTotals.grandTotal) {
      prevGrandTotalRef.current = calculatedTotals.grandTotal;
      setFormPaymentSchedules(prev => recalculatePaymentSchedules(prev, calculatedTotals.grandTotal));
    }
  }, [calculatedTotals.grandTotal, formPaymentScheme]);

  // Handle switching payment scheme (FULL / DP / TERMIN)
  const handleChangePaymentScheme = (scheme: InvoicePaymentMethodType) => {
    setFormPaymentScheme(scheme);
    const generated = generateDefaultPaymentSchedules(scheme, calculatedTotals.grandTotal, formIssueDate);
    setFormPaymentSchedules(generated);
    if (scheme === 'DP') {
      const dpItem = generated.find(s => s.name.toLowerCase().includes('dp'));
      if (dpItem) setFormDpPercent(dpItem.percentage);
    }
  };

  // Handle updating a single schedule row with 2-way percentage <-> nominal sync
  const handleUpdateScheduleRow = (id: string, field: keyof InvoiceTerminSchedule, value: any) => {
    const grandTotal = calculatedTotals.grandTotal;

    setFormPaymentSchedules(prev => {
      if (formPaymentScheme === 'DP') {
        // DP memiliki tepat 2 tahap: DP dan Pelunasan
        const dpIndex = prev.findIndex(s => s.id === id);
        const otherIndex = dpIndex === 0 ? 1 : 0;
        const next = prev.map(item => ({ ...item }));
        const current = { ...next[dpIndex] };

        if (field === 'percentage') {
          const pct = Math.max(0, Math.min(100, Number(value) || 0));
          current.percentage = pct;
          current.amount = Math.round((grandTotal * pct) / 100);
          next[dpIndex] = current;
          if (next[otherIndex]) {
            const otherPct = Math.max(0, parseFloat((100 - pct).toFixed(1)));
            next[otherIndex] = {
              ...next[otherIndex],
              percentage: otherPct,
              amount: Math.max(0, grandTotal - current.amount)
            };
          }
          if (dpIndex === 0) setFormDpPercent(pct);
        } else if (field === 'amount') {
          const amt = Math.max(0, Math.min(grandTotal, Number(value) || 0));
          current.amount = amt;
          current.percentage = grandTotal > 0 ? parseFloat(((amt / grandTotal) * 100).toFixed(1)) : 0;
          next[dpIndex] = current;
          if (next[otherIndex]) {
            const otherAmt = Math.max(0, grandTotal - amt);
            const otherPct = grandTotal > 0 ? parseFloat(((otherAmt / grandTotal) * 100).toFixed(1)) : 0;
            next[otherIndex] = {
              ...next[otherIndex],
              amount: otherAmt,
              percentage: otherPct
            };
          }
          if (dpIndex === 0) setFormDpPercent(current.percentage);
        } else {
          next[dpIndex] = { ...current, [field]: value };
        }
        return next;
      }

      // Untuk TERMIN atau FULL
      return prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'percentage') {
          const pct = Math.max(0, Math.min(100, Number(value) || 0));
          updated.percentage = pct;
          updated.amount = Math.round((grandTotal * pct) / 100);
        } else if (field === 'amount') {
          const amt = Math.max(0, Number(value) || 0);
          updated.amount = amt;
          if (grandTotal > 0) {
            updated.percentage = parseFloat(((amt / grandTotal) * 100).toFixed(1));
          }
        }
        return updated;
      });
    });
  };

  // Sinkronkan tampilan input DP saat jadwal berubah dari luar (ganti skema, load invoice, grand total berubah)
  useEffect(() => {
    if (formPaymentScheme !== 'DP' || isDpInputFocused) return;
    const dp = formPaymentSchedules[0];
    if (!dp) return;
    setDpPercentInput(formatPercentInput(dp.percentage));
    setDpAmountInput(String(Math.round(dp.amount || 0)));
  }, [formPaymentScheme, formPaymentSchedules, isDpInputFocused]);

  const applyDpSchedules = (rawAmount: number, rawPercent: number) => {
    const grandTotal = calculatedTotals.grandTotal;
    const dpAmount = Math.max(0, Math.min(grandTotal, Math.round(rawAmount || 0)));
    const balanceAmount = Math.max(0, grandTotal - dpAmount);
    const dpPercent = Math.max(0, Math.min(100, Number(rawPercent) || 0));
    const balancePercent = dpPercentFromAmount(balanceAmount, grandTotal);
    const dpLabel = formatPercentInput(dpPercent);
    const balanceLabel = formatPercentInput(balancePercent);

    setFormDpPercent(dpPercent);
    setFormPaymentSchedules(prev => {
      if (prev.length < 2) return prev;
      const next = prev.map(item => ({ ...item }));
      next[0] = {
        ...next[0],
        name: `DP (Down Payment) ${dpLabel}%`,
        percentage: dpPercent,
        amount: dpAmount
      };
      next[1] = {
        ...next[1],
        name: `Pelunasan ${balanceLabel}%`,
        percentage: balancePercent,
        amount: balanceAmount
      };
      return next;
    });

    return { dpAmount, balanceAmount };
  };

  const applyDpPercentInput = (raw: string, keepRawText: boolean) => {
    const percent = clampDpPercent(parseLocalizedDecimal(raw));
    const grandTotal = calculatedTotals.grandTotal;
    const dpAmount = grandTotal > 0 ? Math.round((grandTotal * percent) / 100) : 0;
    applyDpSchedules(dpAmount, percent);
    if (!keepRawText) setDpPercentInput(formatPercentInput(percent));
    setDpAmountInput(String(dpAmount));
  };

  const applyDpAmountInput = (rawDigits: string, keepRawText: boolean) => {
    const grandTotal = calculatedTotals.grandTotal;
    const dpAmount = Math.max(0, Math.min(grandTotal, Math.round(Number(rawDigits) || 0)));
    const percent = dpPercentFromAmount(dpAmount, grandTotal);
    applyDpSchedules(dpAmount, percent);
    setDpPercentInput(formatPercentInput(percent));
    if (!keepRawText) setDpAmountInput(String(dpAmount));
  };

  const handleDpPercentChange = (raw: string) => {
    setDpPercentInput(raw);
    applyDpPercentInput(raw, true);
  };

  const handleDpPercentBlur = () => {
    const parsed = clampDpPercent(parseLocalizedDecimal(dpPercentInput));
    const current = formPaymentSchedules[0]?.percentage || 0;
    if (Math.abs(parsed - current) > 0.00005) {
      applyDpPercentInput(dpPercentInput, false);
    } else {
      setDpPercentInput(formatPercentInput(current));
    }
    setIsDpInputFocused(false);
  };

  const handleDpAmountChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setDpAmountInput(digits);
    applyDpAmountInput(digits, true);
  };

  const handleDpAmountBlur = () => {
    const current = Math.round(formPaymentSchedules[0]?.amount || 0);
    const typed = Math.round(Number(dpAmountInput) || 0);
    if (typed !== current) {
      applyDpAmountInput(dpAmountInput, false);
    } else {
      setDpAmountInput(String(current));
    }
    setIsDpInputFocused(false);
  };

  // Add a new termin step
  const handleAddTerminRow = () => {
    const nextIndex = formPaymentSchedules.length + 1;
    const baseDate = formIssueDate ? new Date(formIssueDate) : new Date();
    baseDate.setDate(baseDate.getDate() + nextIndex * 7);
    const dueDateStr = baseDate.toISOString().slice(0, 10);
    
    // Hitung sisa persentase dan sisa nominal
    const sumPct = formPaymentSchedules.reduce((acc, s) => acc + (s.percentage || 0), 0);
    const sumAmt = formPaymentSchedules.reduce((acc, s) => acc + (s.amount || 0), 0);
    const remPct = Math.max(0, parseFloat((100 - sumPct).toFixed(1)));
    const remAmt = Math.max(0, calculatedTotals.grandTotal - sumAmt);

    setFormPaymentSchedules(prev => [
      ...prev,
      {
        id: `sched-${Date.now()}-${nextIndex}`,
        name: `Termin ${nextIndex}`,
        percentage: remPct,
        amount: remAmt,
        dueDate: dueDateStr,
        notes: `Tahap ${nextIndex}`
      }
    ]);
  };

  // Remove a termin step
  const handleRemoveTerminRow = (id: string) => {
    if (formPaymentSchedules.length <= 1) {
      showToast('Minimal harus ada 1 jadwal pembayaran.', 'info');
      return;
    }
    setFormPaymentSchedules(prev => prev.filter(s => s.id !== id));
  };

  // Auto-balance termin schedules to 100%
  const handleAutoBalanceTermin = () => {
    setFormPaymentSchedules(prev => autoBalancePaymentSchedules(prev, calculatedTotals.grandTotal));
    showToast('Jadwal termin berhasil diseimbangkan tepat 100%.', 'success');
  };

  // Summary statistics for payment schedules in form
  const paymentSchedulesSummary = useMemo(() => {
    const totalAmount = formPaymentSchedules.reduce((acc, s) => acc + (s.amount || 0), 0);
    const totalPercentage = formPaymentSchedules.reduce((acc, s) => acc + (s.percentage || 0), 0);
    const diffAmount = calculatedTotals.grandTotal - totalAmount;
    const diffPercentage = parseFloat((100 - totalPercentage).toFixed(1));
    const isBalanced = Math.abs(diffAmount) <= 1 && Math.abs(diffPercentage) <= 0.1;

    return {
      totalAmount,
      totalPercentage: parseFloat(totalPercentage.toFixed(1)),
      diffAmount,
      diffPercentage,
      isBalanced
    };
  }, [formPaymentSchedules, calculatedTotals.grandTotal]);

  // Derived live invoice object for real-time split-screen preview
  const previewInvoiceData: Invoice = useMemo(() => {
    return {
      id: editingInvoiceId || 'draft-preview',
      documentType: formDocType,
      documentNumber: formDocNumber || (formDocType === 'PROFORMA' ? 'PI/BJP/YYYY/MM/XXXX' : 'INV/BJP/YYYY/MM/XXXX'),
      orderId: '',
      projectTitle: formProjectTitle || 'Belum ada judul pekerjaan',
      customer: {
        name: formCustomer.name || 'Nama Pelanggan / Instansi',
        pic: formCustomer.pic || '',
        address: formCustomer.address || 'Alamat Penagihan Pelanggan',
        phone: formCustomer.phone || '-',
        email: formCustomer.email || '',
        npwp: formCustomer.npwp || '',
      },
      issueDate: formIssueDate,
      dueDate: formDocType === 'COMMERCIAL' ? formDueDate : undefined,
      expiryDate: formDocType === 'PROFORMA' ? formExpiryDate : undefined,
      items: formItems.map((it, idx) => ({
        ...it,
        itemName: it.itemName || `Item #${idx + 1}`,
      })),
      subtotal: calculatedTotals.subtotal,
      discountAmount: calculatedTotals.discountAmount,
      taxableBase: calculatedTotals.taxableBase,
      taxRate: formApplyTax ? formTaxRate : 0,
      taxAmount: calculatedTotals.taxAmount,
      grandTotal: calculatedTotals.grandTotal,
      downPaymentAmount: formPaymentScheme === 'DP' ? (formPaymentSchedules[0]?.amount || 0) : 0,
      paidAmount: 0,
      remainingAmount: calculatedTotals.grandTotal,
      status: formDocType === 'PROFORMA' ? 'PENDING_DP' : 'UNPAID',
      notes: formNotes,
      paymentTerms: formPaymentTerms,
      paymentScheme: formPaymentScheme,
      paymentSchedules: formPaymentSchedules,
      sourceProformaNumber: formSourceProformaNumber.trim() || undefined,
      referenceDescription: formReferenceDescription.trim() || undefined,
      contractTotalAmount: formContractTotalAmount > 0 ? formContractTotalAmount : undefined,
      payments: [],
      bankAccounts: storeIdentity.bankAccounts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [
    editingInvoiceId,
    formDocType,
    formDocNumber,
    formProjectTitle,
    formCustomer,
    formIssueDate,
    formDueDate,
    formExpiryDate,
    formItems,
    calculatedTotals,
    formApplyTax,
    formTaxRate,
    formPaymentScheme,
    formPaymentSchedules,
    formNotes,
    formPaymentTerms,
    formSourceProformaNumber,
    formReferenceDescription,
    formContractTotalAmount,
    storeIdentity
  ]);

  // Reset form to blank create state
  const resetForm = () => {
    setEditingInvoiceId(null);
    setFormDocType('PROFORMA');
    setFormIsCustomNumber(false);
    setFormProjectTitle('');
    setFormIssueDate(new Date().toISOString().slice(0, 10));
    setFormDueDate(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setFormExpiryDate(d.toISOString().slice(0, 10));
    setFormCustomer({ name: '', pic: '', npwp: '', address: '', phone: '', email: '' });
    setSelectedCustomerOption('custom');
    setFormItems([
      {
        id: 'item-1',
        itemName: '',
        description: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        discountPercent: 0,
        discountAmount: 0,
        isTaxable: true,
        totalPrice: 0
      }
    ]);
    setFormApplyTax(true);
    setFormTaxRate(11);
    setFormPaymentScheme('DP');
    setFormDpPercent(50);
    setFormPaymentSchedules(generateDefaultPaymentSchedules('DP', 0));
    setFormPaymentTerms(storeIdentity.defaultTerms || '');
    setFormNotes('');
    setFormSourceProformaNumber('');
    setFormReferenceDescription('');
    setFormContractTotalAmount(0);
  };

  // Edit existing invoice
  const handleOpenEdit = (inv: Invoice) => {
    if (inv.documentType === 'COMMERCIAL' && inv.status === 'PAID') {
      showToast('Invoice Final yang telah Lunas tidak dapat diedit demi integritas audit akuntansi.', 'error');
      return;
    }

    setEditingInvoiceId(inv.id);
    setFormDocType(inv.documentType);
    setFormDocNumber(inv.documentNumber);
    setFormIsCustomNumber(true);
    setFormProjectTitle(inv.projectTitle);
    setFormIssueDate(inv.issueDate);
    setFormDueDate(inv.dueDate || inv.issueDate);
    setFormExpiryDate(inv.expiryDate || '');
    setFormCustomer({ ...inv.customer });
    setFormItems(inv.items.map(it => ({ ...it })));
    setFormApplyTax(inv.taxRate > 0);
    setFormTaxRate(inv.taxRate || 11);
    setFormSourceProformaNumber(inv.sourceProformaNumber || '');
    setFormReferenceDescription(inv.referenceDescription || '');
    setFormContractTotalAmount(inv.contractTotalAmount || 0);
    
    // Load payment scheme & schedules
    const loadedScheme = inv.paymentScheme || (inv.dpRequiredPercent ? 'DP' : 'FULL');
    const loadedSchedules = inv.paymentSchedules && inv.paymentSchedules.length > 0
      ? inv.paymentSchedules.map(s => ({ ...s }))
      : generateDefaultPaymentSchedules(loadedScheme, inv.grandTotal, inv.issueDate);
    setFormPaymentScheme(loadedScheme);
    setFormPaymentSchedules(loadedSchedules);
    setFormDpPercent(
      loadedScheme === 'DP' && loadedSchedules[0]
        ? Number(loadedSchedules[0].percentage) || 50
        : (inv.dpRequiredPercent || 50)
    );

    setFormPaymentTerms(inv.paymentTerms || '');
    setFormNotes(inv.notes || '');
    setActiveSubTab('create');
  };

  // Save / Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formProjectTitle.trim()) {
      showToast('Judul pekerjaan / nama proyek wajib diisi.', 'error');
      return;
    }

    if (!formCustomer.name.trim()) {
      showToast('Nama pelanggan atau instansi wajib diisi.', 'error');
      return;
    }

    // Check items
    const validItems = formItems.filter(it => it.itemName.trim() !== '');
    if (validItems.length === 0) {
      showToast('Minimal harus ada 1 item dengan nama produk/pekerjaan.', 'error');
      return;
    }

    const effectiveTaxRate = formApplyTax ? formTaxRate : 0;
    const totals = calculateInvoiceTotals(validItems, effectiveTaxRate, formDpPercent, 0);

    const scheduleTotal = formPaymentSchedules.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    if (formPaymentSchedules.length > 0 && Math.abs(scheduleTotal - totals.grandTotal) > 1) {
      showToast(
        `Total jadwal pembayaran (Rp ${scheduleTotal.toLocaleString('id-ID')}) tidak sama dengan grand total (Rp ${totals.grandTotal.toLocaleString('id-ID')}). Seimbangkan jadwal pembayaran terlebih dahulu.`,
        'error'
      );
      return;
    }

    const now = Date.now();
    const currentUserName = currentUser?.name || 'Administrator';
    const currentUserRole = currentUser?.role || 'ADMIN';

    if (editingInvoiceId) {
      // UPDATE EXISTING INVOICE
      const existingInvoice = invoices.find(inv => inv.id === editingInvoiceId);
      const alreadyPaid = existingInvoice?.amountPaid || 0;
      if (alreadyPaid > totals.grandTotal + 1) {
        showToast(
          `Grand total baru (Rp ${totals.grandTotal.toLocaleString('id-ID')}) lebih kecil dari pembayaran yang sudah diterima (Rp ${alreadyPaid.toLocaleString('id-ID')}). Proses pembatalan/refund terlebih dahulu sebelum mengubah nilai invoice.`,
          'error'
        );
        return;
      }

      const updatedList = invoices.map(inv => {
        if (inv.id !== editingInvoiceId) return inv;

        const updated: Invoice = {
          ...inv,
          projectTitle: formProjectTitle.trim(),
          issueDate: formIssueDate,
          dueDate: formDueDate,
          expiryDate: formDocType === 'PROFORMA' ? formExpiryDate : undefined,
          customer: { ...formCustomer },
          items: validItems,
          ...totals,
          paymentScheme: formPaymentScheme,
          paymentSchedules: formPaymentSchedules,
          dpRequiredPercent: formPaymentScheme === 'DP' ? formDpPercent : undefined,
          dpRequiredAmount: formPaymentScheme === 'DP'
            ? (formPaymentSchedules[0]?.amount ?? totals.dpRequiredAmount)
            : undefined,
          amountPaid: inv.amountPaid || 0,
          balanceDue: Math.max(0, totals.grandTotal - (inv.amountPaid || 0)),
          paymentTerms: formPaymentTerms,
          notes: formNotes,
          sourceProformaNumber: formSourceProformaNumber.trim() || undefined,
          referenceDescription: formReferenceDescription.trim() || undefined,
          contractTotalAmount: formContractTotalAmount > 0 ? formContractTotalAmount : undefined,
          updatedAt: now
        };
        return updated;
      });

      updateInvoicesState(updatedList);
      showToast('Dokumen invoice berhasil diperbarui.', 'success');

      // Save to PocketBase Cloud PocketBase for instant cross-account sync
      saveInvoiceCloud(updatedList.find(i => i.id === editingInvoiceId)!).catch(console.warn);

      // Try syncing to server API
      try {
        await fetch(`/api/invoices/${editingInvoiceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectTitle: formProjectTitle,
            issueDate: formIssueDate,
            dueDate: formDueDate,
            expiryDate: formExpiryDate,
            customer: formCustomer,
            items: validItems,
            taxRate: effectiveTaxRate,
            paymentScheme: formPaymentScheme,
            paymentSchedules: formPaymentSchedules,
            dpRequiredPercent: formPaymentScheme === 'DP' ? formDpPercent : undefined,
            dpRequiredAmount: formPaymentScheme === 'DP' ? formPaymentSchedules[0]?.amount : undefined,
            paymentTerms: formPaymentTerms,
            notes: formNotes,
            sourceProformaNumber: formSourceProformaNumber.trim() || undefined,
            referenceDescription: formReferenceDescription.trim() || undefined,
            contractTotalAmount: formContractTotalAmount > 0 ? formContractTotalAmount : undefined
          })
        });
      } catch (err) {
        // Offline resilience
      }

      resetForm();
      setActiveSubTab('list');
      return;
    }

    // CREATE NEW INVOICE
    const newDocNumber = formDocNumber.trim() || generateNextDocumentNumber(formDocType, invoices, storeIdentity);
    const newInvoice: Invoice = {
      id: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      documentType: formDocType,
      documentNumber: newDocNumber,
      status: 'ISSUED',
      projectTitle: formProjectTitle.trim(),
      issueDate: formIssueDate,
      dueDate: formDueDate,
      expiryDate: formDocType === 'PROFORMA' ? formExpiryDate : undefined,
      customer: { ...formCustomer },
      items: validItems,
      ...totals,
      paymentScheme: formPaymentScheme,
      paymentSchedules: formPaymentSchedules,
      dpRequiredPercent: formPaymentScheme === 'DP' ? formDpPercent : undefined,
      dpRequiredAmount: formPaymentScheme === 'DP'
        ? (formPaymentSchedules[0]?.amount ?? totals.dpRequiredAmount)
        : undefined,
      amountPaid: 0,
      balanceDue: totals.grandTotal,
      payments: [],
      paymentTerms: formPaymentTerms,
      notes: formNotes,
      sourceProformaNumber: formSourceProformaNumber.trim() || undefined,
      referenceDescription: formReferenceDescription.trim() || undefined,
      contractTotalAmount: formContractTotalAmount > 0 ? formContractTotalAmount : undefined,
      bankAccounts: storeIdentity.bankAccounts,
      issuedBy: currentUserName,
      issuedByRole: currentUserRole,
      createdAt: now,
      updatedAt: now
    };

    const updatedList = [newInvoice, ...invoices];
    updateInvoicesState(updatedList);
    showToast(`${formDocType === 'PROFORMA' ? 'Proforma Invoice' : 'Invoice Komersial'} ${newDocNumber} berhasil diterbitkan!`, 'success');

    // Save to PocketBase Cloud PocketBase for real-time multi-account sync
    saveInvoiceCloud(newInvoice).catch(console.warn);

    // Try posting to backend API
    try {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInvoice)
      });
    } catch {
      // Offline fallback
    }

    resetForm();
    setActiveSubTab('list');
  };

  // Hapus manual dokumen (Developer, Admin, Owner) — mendukung status apa pun termasuk Lunas / Paid
  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!canManage) {
      showToast('Penghapusan dokumen manual hanya dapat dilakukan oleh akun DEVELOPER, ADMIN, atau OWNER.', 'error');
      return;
    }

    if (!window.confirm(`Yakin ingin menghapus ${inv.documentType === 'PROFORMA' ? 'Proforma Invoice' : 'Invoice'} No: ${inv.documentNumber} (${inv.projectTitle || 'Tanpa Judul'}) secara manual dari database? Tindakan ini permanen.`)) {
      return;
    }

    // Jika yang dihapus adalah child invoice dari suatu Proforma:
    // Update referensi parent Proforma (lepaskan child invoice, sesuaikan amountPaid, balanceDue dan status schedule)
    const updatedList = invoices
      .filter(item => item.id !== inv.id)
      .map(item => {
        const isParent = (inv.sourceProformaId && item.id === inv.sourceProformaId) ||
          (inv.sourceProformaNumber && item.documentNumber === inv.sourceProformaNumber) ||
          (item.childInvoiceIds && item.childInvoiceIds.includes(inv.id)) ||
          (item.childInvoiceNumbers && item.childInvoiceNumbers.includes(inv.documentNumber)) ||
          (item.convertedInvoiceId === inv.id) ||
          (item.convertedInvoiceNumber === inv.documentNumber);

        if (isParent) {
          const newChildIds = (item.childInvoiceIds || []).filter(id => id !== inv.id);
          const newChildNums = (item.childInvoiceNumbers || []).filter(num => num !== inv.documentNumber);

          const newSchedules = (item.paymentSchedules || []).map((sched, idx) => {
            const isMatch = (inv.terminStageId && sched.id === inv.terminStageId) ||
              (inv.terminStageNumber && idx === inv.terminStageNumber - 1) ||
              (sched.invoiceNumber === inv.documentNumber) ||
              (inv.documentNumber.endsWith(`/T${idx + 1}`));
            if (isMatch) {
              return { ...sched, isPaid: false, status: 'Belum', invoiceNumber: undefined };
            }
            return sched;
          });

          if (item.status === 'CANCELLED') {
            return {
              ...item,
              childInvoiceIds: newChildIds,
              childInvoiceNumbers: newChildNums,
              convertedInvoiceId: item.convertedInvoiceId === inv.id ? (newChildIds[0] || undefined) : item.convertedInvoiceId,
              convertedInvoiceNumber: item.convertedInvoiceNumber === inv.documentNumber ? (newChildNums[0] || undefined) : item.convertedInvoiceNumber,
              paymentSchedules: newSchedules,
              updatedAt: Date.now()
            };
          }

          const remainingChildInvoices = invoices.filter(ci =>
            ci.id !== inv.id &&
            ci.documentType === 'COMMERCIAL' &&
            ci.status !== 'CANCELLED' && (
              (ci.sourceProformaId && ci.sourceProformaId === item.id) ||
              (ci.sourceProformaNumber && ci.sourceProformaNumber === item.documentNumber) ||
              (newChildIds.includes(ci.id)) ||
              (newChildNums.includes(ci.documentNumber))
            )
          );
          const remChildPaid = remainingChildInvoices.reduce((sum, ci) => sum + (ci.amountPaid || 0), 0);

          // Hindari double counting pembayaran yang tersalin ke child invoice
          const childPaymentRefIds = new Set<string>();
          remainingChildInvoices.forEach(ci => {
            (ci.payments || []).forEach(p => {
              if (p.id) childPaymentRefIds.add(p.id);
              if (p.referenceNumber) childPaymentRefIds.add(p.referenceNumber);
            });
          });
          const directPaid = (item.payments || [])
            .filter(p => !((p.id && childPaymentRefIds.has(p.id)) || (p.referenceNumber && childPaymentRefIds.has(p.referenceNumber))))
            .reduce((sum, p) => sum + (p.amount || 0), 0);
          const updatedPaid = Math.min(item.grandTotal, remChildPaid + directPaid);
          const updatedBalance = Math.max(0, item.grandTotal - updatedPaid);
          const updatedStatus: InvoiceStatus = updatedBalance === 0 && item.grandTotal > 0
            ? 'PAID'
            : (updatedPaid > 0 ? 'PARTIAL' : (newChildIds.length > 0 ? 'CONVERTED' : 'ISSUED'));

          return {
            ...item,
            childInvoiceIds: newChildIds,
            childInvoiceNumbers: newChildNums,
            convertedInvoiceId: item.convertedInvoiceId === inv.id ? (newChildIds[0] || undefined) : item.convertedInvoiceId,
            convertedInvoiceNumber: item.convertedInvoiceNumber === inv.documentNumber ? (newChildNums[0] || undefined) : item.convertedInvoiceNumber,
            paymentSchedules: newSchedules,
            amountPaid: updatedPaid,
            balanceDue: updatedBalance,
            status: updatedStatus,
            updatedAt: Date.now()
          };
        }
        return item;
      });

    updateInvoicesState(updatedList);
    showToast(`Dokumen ${inv.documentNumber} (${inv.status === 'PAID' ? 'Lunas' : inv.status}) berhasil dihapus manual dari sistem & database.`, 'info');

    // Real-time Cloud PocketBase delete (instant real-time sync to all other users)
    try {
      await deleteInvoiceCloud(inv.id);
    } catch (cloudErr) {
      console.warn('Error deleting invoice from PocketBase PocketBase:', cloudErr);
    }

    const parentUpdated = updatedList.find(item =>
      (inv.sourceProformaId && item.id === inv.sourceProformaId) ||
      (inv.sourceProformaNumber && item.documentNumber === inv.sourceProformaNumber)
    );
    if (parentUpdated) {
      try {
        await saveInvoiceCloud(parentUpdated);
      } catch (cloudErr) {
        console.warn('Error saving updated parent proforma to PocketBase PocketBase:', cloudErr);
      }
    }

    try {
      await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' });
    } catch {
      // Offline resilience
    }
  };

  // =========================================================================
  // CONVERT PROFORMA INVOICE TO COMMERCIAL INVOICE (CRITICAL ACTION)
  // =========================================================================
  const [conversionNumber, setConversionNumber] = useState<string>('');
  const [conversionDueDate, setConversionDueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [conversionMode, setConversionMode] = useState<'FULL' | 'STAGE'>('STAGE');
  const [conversionStageId, setConversionStageId] = useState<string>('ALL');
  const [conversionStageSuffix, setConversionStageSuffix] = useState<string>('');
  const [conversionReferenceDesc, setConversionReferenceDesc] = useState<string>('');

  const handleOpenConvertModal = (pi: Invoice) => {
    if (pi.documentType !== 'PROFORMA') {
      showToast('Dokumen ini sudah merupakan Invoice Komersial.', 'info');
      return;
    }

    setSelectedInvoice(pi);
    setConversionDueDate(new Date().toISOString().slice(0, 10));

    // Cek apakah PI memiliki skema pembayaran bertahap (TERMIN atau DP)
    const schedules = pi.paymentSchedules || [];
    if (pi.paymentScheme === 'TERMIN' && schedules.length > 0) {
      // Cari termin pertama yang belum ada di childInvoiceNumbers
      const unbilledIdx = schedules.findIndex((_, idx) => !pi.childInvoiceNumbers?.some(num => num.endsWith(`/T${idx + 1}`)));
      const chosenIdx = unbilledIdx !== -1 ? unbilledIdx : 0;
      const chosenStage = schedules[chosenIdx];
      const suffix = `T${chosenIdx + 1}`;

      setConversionMode('STAGE');
      setConversionStageId(chosenStage.id);
      setConversionStageSuffix(suffix);
      setConversionReferenceDesc(`Pembayaran ${chosenStage.name} (${formatPercentInput(chosenStage.percentage)}%) dari Total Kontrak`);
      const nextInvNumber = generateNextDocumentNumber('COMMERCIAL', invoices, storeIdentity, suffix);
      setConversionNumber(nextInvNumber);
    } else if (pi.paymentScheme === 'DP' && schedules.length > 0) {
      const hasDpBilled = pi.childInvoiceNumbers?.some(num => num.endsWith('/DP'));
      const chosenIdx = hasDpBilled ? 1 : 0;
      const chosenStage = schedules[chosenIdx] || schedules[0];
      const suffix = chosenIdx === 0 ? 'DP' : 'PELUNASAN';

      setConversionMode('STAGE');
      setConversionStageId(chosenStage.id);
      setConversionStageSuffix(suffix);
      setConversionReferenceDesc(`Pembayaran ${chosenStage.name} (${formatPercentInput(chosenStage.percentage)}%) dari Total Kontrak`);
      const nextInvNumber = generateNextDocumentNumber('COMMERCIAL', invoices, storeIdentity, suffix);
      setConversionNumber(nextInvNumber);
    } else {
      setConversionMode('FULL');
      setConversionStageId('ALL');
      setConversionStageSuffix('');
      setConversionReferenceDesc('Pelunasan Penuh Kontrak');
      const nextInvNumber = generateNextDocumentNumber('COMMERCIAL', invoices, storeIdentity);
      setConversionNumber(nextInvNumber);
    }

    setIsConvertModalOpen(true);
  };

  const handleSelectConversionStage = (stageId: string) => {
    if (!selectedInvoice) return;
    if (stageId === 'ALL') {
      setConversionMode('FULL');
      setConversionStageId('ALL');
      setConversionStageSuffix('');
      setConversionReferenceDesc('Pelunasan Penuh Kontrak');
      const nextInv = generateNextDocumentNumber('COMMERCIAL', invoices, storeIdentity);
      setConversionNumber(nextInv);
      return;
    }

    const scheds = selectedInvoice.paymentSchedules || [];
    const schedIdx = scheds.findIndex(s => s.id === stageId);
    const sched = scheds[schedIdx];
    if (sched) {
      const suffix = selectedInvoice.paymentScheme === 'DP'
        ? (schedIdx === 0 ? 'DP' : 'PELUNASAN')
        : `T${schedIdx + 1}`;
      setConversionMode('STAGE');
      setConversionStageId(sched.id);
      setConversionStageSuffix(suffix);
      setConversionReferenceDesc(`Pembayaran ${sched.name} (${formatPercentInput(sched.percentage)}%) dari Total Kontrak`);
      const nextInv = generateNextDocumentNumber('COMMERCIAL', invoices, storeIdentity, suffix);
      setConversionNumber(nextInv);
    }
  };

  const handleExecuteConversion = async () => {
    if (!selectedInvoice) return;

    const proforma = selectedInvoice;
    const finalDocNumber = conversionNumber.trim() || generateNextDocumentNumber('COMMERCIAL', invoices, storeIdentity, conversionStageSuffix);
    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    const newInvoiceId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const stage = (proforma.paymentSchedules || []).find(s => s.id === conversionStageId);
    const isStageBilling = conversionMode === 'STAGE' && !!stage;

    // Salin pembayaran DP hanya jika bukan penagihan tahap baru yang belum dibayar
    const copiedPayments = (!isStageBilling || stage?.isPaid)
      ? (proforma.payments || []).map(p => ({
          ...p,
          id: `PAY-CONV-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          invoiceId: newInvoiceId,
          notes: p.notes ? `${p.notes} (Ditransfer dari PI ${proforma.documentNumber})` : `Down Payment dari PI ${proforma.documentNumber}`
        }))
      : [];

    const amountPaid = proforma.amountPaid || 0;
    const balanceDue = Math.max(0, proforma.grandTotal - amountPaid);
    const finalStatus: InvoiceStatus = isStageBilling
      ? (stage?.isPaid ? 'PAID' : 'ISSUED')
      : (balanceDue === 0 ? 'PAID' : (amountPaid > 0 ? 'PARTIAL' : 'ISSUED'));

    // Menandai jadwal pembayaran yang sudah tertutupi
    let runningPaid = amountPaid;
    const baseSchedules = proforma.paymentSchedules && proforma.paymentSchedules.length > 0
      ? proforma.paymentSchedules
      : generateDefaultPaymentSchedules(proforma.paymentScheme || 'DP', proforma.grandTotal, proforma.issueDate);

    const chosenStageIdx = isStageBilling
      ? (proforma.paymentSchedules || []).findIndex(s => s.id === stage?.id)
      : -1;

    const reconciledSchedules = baseSchedules.map((sched, sIdx) => {
      let isPaid = false;
      let stageStatus = 'Belum';

      if (isStageBilling && chosenStageIdx !== -1) {
        if (sIdx < chosenStageIdx) {
          isPaid = true;
          stageStatus = 'Lunas';
        } else if (sIdx === chosenStageIdx) {
          isPaid = false;
          stageStatus = 'Tagihan Ini';
        } else {
          isPaid = false;
          stageStatus = 'Belum';
        }
      } else {
        isPaid = (runningPaid >= sched.amount && sched.amount > 0);
        stageStatus = isPaid ? 'Lunas' : 'Belum';
        if (runningPaid >= sched.amount) {
          runningPaid -= sched.amount;
        }
      }

      return {
        ...sched,
        isPaid,
        status: stageStatus,
        invoiceNumber: sIdx === chosenStageIdx ? finalDocNumber : sched.invoiceNumber
      };
    });

    // Nilai tahap mengikuti grand total (termasuk PPN), jadi PPN harus dipisahkan
    // agar invoice komersial tahap tidak menghilangkan komponen pajak.
    const stageTaxAmount = isStageBilling && stage
      ? (proforma.grandTotal > 0
          ? Math.round(stage.amount * ((proforma.taxAmount || 0) / proforma.grandTotal))
          : 0)
      : 0;
    const stageDpp = isStageBilling && stage ? stage.amount - stageTaxAmount : 0;

    // Item rincian pekerjaan untuk faktur
    const billedItems: InvoiceItem[] = isStageBilling && stage
      ? [
          {
            id: `item-stage-${Date.now()}`,
            itemName: `${proforma.projectTitle} - ${stage.name} (${formatPercentInput(stage.percentage)}%)`,
            description: `Berdasarkan Proforma Invoice ${proforma.documentNumber}. Nilai Total Kontrak: Rp ${proforma.grandTotal.toLocaleString('id-ID')}`,
            quantity: 1,
            unit: 'tahap',
            unitPrice: stageDpp,
            discountPercent: 0,
            discountAmount: 0,
            isTaxable: stageTaxAmount > 0,
            totalPrice: stageDpp
          }
        ]
      : proforma.items.map(it => ({ ...it }));

    const stageSubtotal = isStageBilling && stage ? stageDpp : proforma.subtotal;
    const stageGrandTotal = isStageBilling && stage ? stage.amount : proforma.grandTotal;

    const commercialInvoice: Invoice = {
      id: newInvoiceId,
      documentType: 'COMMERCIAL',
      documentNumber: finalDocNumber,
      status: finalStatus,
      sourceProformaId: proforma.id,
      sourceProformaNumber: proforma.documentNumber,
      terminStageId: isStageBilling ? stage?.id : undefined,
      terminStageName: isStageBilling ? stage?.name : undefined,
      terminStageNumber: isStageBilling ? (selectedInvoice.paymentSchedules || []).findIndex(s => s.id === stage?.id) + 1 : undefined,
      terminPercentage: isStageBilling ? stage?.percentage : 100,
      contractTotalAmount: proforma.grandTotal,
      referenceDescription: conversionReferenceDesc || (isStageBilling && stage ? `Pembayaran ${stage.name} (${formatPercentInput(stage.percentage)}%) dari Total Kontrak` : undefined),
      projectTitle: proforma.projectTitle,
      issueDate: todayStr,
      dueDate: conversionDueDate,
      customer: { ...proforma.customer },
      items: billedItems,
      subtotal: stageSubtotal,
      discountAmount: isStageBilling ? 0 : proforma.discountAmount,
      taxableBase: isStageBilling ? stageDpp : proforma.taxableBase,
      taxRate: proforma.taxRate,
      taxAmount: isStageBilling ? stageTaxAmount : proforma.taxAmount,
      grandTotal: stageGrandTotal,
      paymentScheme: proforma.paymentScheme || 'DP',
      paymentSchedules: reconciledSchedules,
      dpRequiredPercent: proforma.dpRequiredPercent,
      dpRequiredAmount: proforma.dpRequiredAmount,
      amountPaid: isStageBilling ? (stage?.isPaid ? stage.amount : 0) : amountPaid,
      balanceDue: isStageBilling ? (stage?.isPaid ? 0 : stage.amount) : balanceDue,
      payments: copiedPayments,
      paymentTerms: proforma.paymentTerms,
      notes: proforma.notes ? `${proforma.notes}\n[Berdasarkan ${proforma.documentNumber} - ${conversionReferenceDesc}]` : `Berdasarkan ${proforma.documentNumber} - ${conversionReferenceDesc}`,
      bankAccounts: proforma.bankAccounts || storeIdentity.bankAccounts,
      issuedBy: currentUser?.name || proforma.issuedBy,
      issuedByRole: currentUser?.role || 'ADMIN',
      createdAt: now,
      updatedAt: now
    };

    // Update Proforma: catat childInvoiceNumbers dan childInvoiceIds
    const updatedChildIds = Array.from(new Set([...(proforma.childInvoiceIds || []), newInvoiceId]));
    const updatedChildNums = Array.from(new Set([...(proforma.childInvoiceNumbers || []), finalDocNumber]));

    const updatedInvoices = invoices.map(item => {
      if (item.id === proforma.id) {
        const proformaStatus: InvoiceStatus = isStageBilling
          ? (item.balanceDue === 0 ? 'PAID' : 'PARTIAL')
          : 'CONVERTED';

        return {
          ...item,
          status: proformaStatus,
          convertedInvoiceId: newInvoiceId,
          convertedInvoiceNumber: finalDocNumber,
          childInvoiceIds: updatedChildIds,
          childInvoiceNumbers: updatedChildNums,
          paymentSchedules: reconciledSchedules,
          updatedAt: now
        };
      }
      return item;
    });

    const finalInvoiceList = [commercialInvoice, ...updatedInvoices];
    updateInvoicesState(finalInvoiceList);
    setIsConvertModalOpen(false);
    showToast(`Berhasil menerbitkan Invoice Final ${finalDocNumber}!`, 'success');

    // Save to PocketBase Cloud PocketBase for real-time multi-account sync
    saveInvoiceCloud(commercialInvoice).catch(console.warn);
    const updatedProforma = updatedInvoices.find(item => item.id === proforma.id);
    if (updatedProforma) {
      saveInvoiceCloud(updatedProforma).catch(console.warn);
    }

    // Try posting to API
    try {
      await fetch(`/api/invoices/${proforma.id}/convert-to-final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customInvoiceNumber: finalDocNumber,
          dueDate: conversionDueDate,
          stageSuffix: conversionStageSuffix,
          terminStageId: isStageBilling ? stage?.id : undefined,
          terminStageName: isStageBilling ? stage?.name : undefined,
          terminPercentage: isStageBilling ? stage?.percentage : undefined,
          contractTotalAmount: proforma.grandTotal,
          referenceDescription: conversionReferenceDesc,
          issuedBy: currentUser?.name,
          issuedByRole: currentUser?.role
        })
      });
    } catch {
      // Offline fallback
    }
  };

  // =========================================================================
  // RECORD PAYMENT (DP / SETTLEMENT)
  // =========================================================================
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payType, setPayType] = useState<'DOWN_PAYMENT' | 'SETTLEMENT'>('DOWN_PAYMENT');
  const [payMethod, setPayMethod] = useState<string>('TRANSFER');
  const [payRefNumber, setPayRefNumber] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  const handleOpenPaymentModal = (inv: Invoice) => {
    const isPi = inv.documentType === 'PROFORMA';
    const effectiveInv: Invoice = isPi
      ? (() => {
          const eff = getProformaEffectivePaymentInfo(inv, invoices);
          return { ...inv, amountPaid: eff.amountPaid, balanceDue: eff.balanceDue, status: eff.status };
        })()
      : inv;

    setSelectedInvoice(effectiveInv);
    const suggestedAmount = effectiveInv.amountPaid === 0 && effectiveInv.dpRequiredAmount && effectiveInv.dpRequiredAmount > 0
      ? effectiveInv.dpRequiredAmount
      : effectiveInv.balanceDue;
    setPayAmount(suggestedAmount);
    setPayType(effectiveInv.amountPaid === 0 ? 'DOWN_PAYMENT' : 'SETTLEMENT');
    setPayMethod('TRANSFER');
    setPayRefNumber('');
    setPayNotes(effectiveInv.amountPaid === 0 ? 'Pembayaran Uang Muka (DP)' : 'Pelunasan sisa tagihan');
    setIsPaymentModalOpen(true);
  };

  const handleExecutePayment = async () => {
    if (!selectedInvoice) return;

    if (payAmount <= 0) {
      showToast('Nominal pembayaran harus lebih besar dari 0.', 'error');
      return;
    }

    if (payAmount > selectedInvoice.balanceDue) {
      showToast(`Nominal pembayaran (Rp ${payAmount.toLocaleString('id-ID')}) melebihi sisa tagihan.`, 'error');
      return;
    }

    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    const newPayment: InvoicePayment = {
      id: `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      invoiceId: selectedInvoice.id,
      paymentType: payType,
      paymentDate: todayStr,
      amount: payAmount,
      paymentMethod: payMethod,
      referenceNumber: payRefNumber.trim() || undefined,
      receivedBy: currentUser?.name || 'Kasir / Admin',
      notes: payNotes.trim() || undefined,
      createdAt: now
    };

    const newAmountPaid = (selectedInvoice.amountPaid || 0) + payAmount;
    const newBalanceDue = Math.max(0, selectedInvoice.grandTotal - newAmountPaid);
    const newStatus: InvoiceStatus = newBalanceDue === 0 ? 'PAID' : 'PARTIAL';

    let runningPaid = newAmountPaid;
    const isNowFullyPaid = newStatus === 'PAID';

    const updatedSchedules = (selectedInvoice.paymentSchedules || []).map((sched, sIdx) => {
      const isThisStage = (selectedInvoice.terminStageId && sched.id === selectedInvoice.terminStageId)
        || (selectedInvoice.terminStageNumber && sIdx === selectedInvoice.terminStageNumber - 1);
      
      const isPaid = isNowFullyPaid || (runningPaid >= sched.amount && sched.amount > 0) || sched.isPaid;
      if (runningPaid >= sched.amount) {
        runningPaid -= sched.amount;
      }
      return {
        ...sched,
        isPaid: isThisStage ? isNowFullyPaid : isPaid,
        status: (isThisStage && isNowFullyPaid) ? 'Lunas' : (sched.status || (isPaid ? 'Lunas' : 'Belum'))
      };
    });

    const updatedList = invoices.map(item => {
      if (item.id === selectedInvoice.id) {
        return {
          ...item,
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
          paymentSchedules: updatedSchedules.length > 0 ? updatedSchedules : item.paymentSchedules,
          payments: [...(item.payments || []), newPayment],
          updatedAt: now
        };
      }

      // Jika item ini adalah parent Proforma Invoice dari invoice yang dibayar
      if (
        item.status !== 'CANCELLED' && (
          (selectedInvoice.sourceProformaId && item.id === selectedInvoice.sourceProformaId) ||
          (selectedInvoice.sourceProformaNumber && item.documentNumber === selectedInvoice.sourceProformaNumber)
        )
      ) {
        // Hitung ulang dari pembayaran efektif agar pembayaran yang tersalin tidak dobel
        const parentEffectivePaid = getProformaEffectivePaymentInfo(item, invoices).amountPaid;
        const parentNewPaid = Math.min(item.grandTotal, parentEffectivePaid + payAmount);
        const parentNewBalance = Math.max(0, item.grandTotal - parentNewPaid);
        const parentNewStatus: InvoiceStatus = parentNewBalance === 0 ? 'PAID' : 'PARTIAL';
        const parentSchedules = (item.paymentSchedules || []).map((ps, psIdx) => {
          const isTargetStage = (selectedInvoice.terminStageId && ps.id === selectedInvoice.terminStageId)
            || (selectedInvoice.terminStageNumber && psIdx === selectedInvoice.terminStageNumber - 1)
            || (selectedInvoice.documentNumber.endsWith(`/T${psIdx + 1}`));
          if (isTargetStage && isNowFullyPaid) {
            return { ...ps, isPaid: true, status: 'Lunas' };
          }
          return ps;
        });

        return {
          ...item,
          amountPaid: parentNewPaid,
          balanceDue: parentNewBalance,
          status: parentNewStatus,
          paymentSchedules: parentSchedules,
          updatedAt: now
        };
      }

      return item;
    });

    updateInvoicesState(updatedList);
    setIsPaymentModalOpen(false);
    showToast(`Pembayaran Rp ${payAmount.toLocaleString('id-ID')} berhasil dicatat. Status: ${newStatus}`, 'success');

    // Save to PocketBase Cloud PocketBase for real-time multi-account sync
    const updatedInvoiceRecord = updatedList.find(item => item.id === selectedInvoice.id);
    if (updatedInvoiceRecord) {
      saveInvoiceCloud(updatedInvoiceRecord).catch(console.warn);
    }
    const updatedParentRecord = updatedList.find(item =>
      (selectedInvoice.sourceProformaId && item.id === selectedInvoice.sourceProformaId) ||
      (selectedInvoice.sourceProformaNumber && item.documentNumber === selectedInvoice.sourceProformaNumber)
    );
    if (updatedParentRecord) {
      saveInvoiceCloud(updatedParentRecord).catch(console.warn);
    }

    // Try posting to API
    try {
      await fetch(`/api/invoices/${selectedInvoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: payAmount,
          paymentType: payType,
          paymentMethod: payMethod,
          referenceNumber: payRefNumber,
          receivedBy: currentUser?.name || 'Kasir / Admin',
          notes: payNotes,
          paymentDate: todayStr
        })
      });
    } catch {
      // Offline fallback
    }
  };

  // =========================================================================
  // PRINT & PDF GENERATION MODAL
  // =========================================================================
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handleOpenPrint = (inv: Invoice) => {
    const isPi = inv.documentType === 'PROFORMA';
    const effectiveInv: Invoice = isPi
      ? (() => {
          const eff = getProformaEffectivePaymentInfo(inv, invoices);
          return { ...inv, amountPaid: eff.amountPaid, balanceDue: eff.balanceDue, status: eff.status };
        })()
      : inv;

    setSelectedInvoice(effectiveInv);
    setPrintDocType('invoice');
    setPrintMode('a4');
    setIsPrintModalOpen(true);
  };

  const handleOpenCreditNotePrint = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPrintDocType('credit_note');
    setPrintMode('a4');
    setIsPrintModalOpen(true);
  };

  const handleExecutePrint = () => {
    window.print();
  };

  const handleDownloadInvoicePdf = () => {
    if (!selectedInvoice) return;
    try {
      const { filename, pageCount } = exportInvoiceToPDF(selectedInvoice, {
        paperSize,
        orientation: paperOrientation,
        docType: printDocType,
        storeIdentity,
        allInvoices: invoices,
      });
      showToast(`PDF ${filename} berhasil dibuat (${pageCount} halaman).`, 'success');
    } catch (error) {
      console.error('Gagal membuat PDF invoice', error);
      showToast('Gagal membuat file PDF. Silakan coba lagi atau gunakan tombol Cetak.', 'error');
    }
  };

  // =========================================================================
  // CANCELLATION & CREDIT NOTE (NOTA KREDIT) MANAGEMENT
  // =========================================================================
  const getInvoicePaidAmount = (inv: Invoice): number =>
    inv.documentType === 'PROFORMA'
      ? getProformaEffectivePaymentInfo(inv, invoices).amountPaid
      : (inv.amountPaid || 0);

  const cancellingPaidAmount = cancellingInvoice ? getInvoicePaidAmount(cancellingInvoice) : 0;

  const handleOpenCancelModal = (inv: Invoice) => {
    setCancellingInvoice(inv);
    setCancelReasonCategory('MUTUAL_AGREEMENT');
    setCancelReasonDetails(inv.cancellation?.reasonDetails || '');
    setCancelProofUrl(inv.cancellation?.cancellationProofUrl || '');

    const isCommercial = inv.documentType === 'COMMERCIAL';
    const nextCn = isCommercial ? (inv.cancellation?.creditNoteNumber || generateNextCreditNoteNumber(invoices, storeIdentity)) : '';
    setCancelCreditNoteNumber(nextCn);
    setCancelCreditNoteDate(inv.cancellation?.creditNoteDate || new Date().toISOString().slice(0, 10));
    setCancelTaxReturnNumber(inv.cancellation?.taxReturnNumber || '');

    const paid = getInvoicePaidAmount(inv);
    const initialFee = Math.min(paid, inv.cancellation?.cancellationFee || 0);
    const storedRefund = inv.cancellation?.refundAmount;
    const initialRefund = storedRefund !== undefined
      ? Math.min(paid - initialFee, storedRefund)
      : Math.max(0, paid - initialFee);

    setCancelCancellationFee(initialFee);
    setCancelRefundAmount(initialRefund);
    setCancelRefundMethod(inv.cancellation?.refundMethod || 'TRANSFER');
    setCancelRefundBankTarget(inv.cancellation?.refundBankTarget || (inv.customer?.name ? `${inv.customer.name}` : ''));
    setCancelRefundProofUrl(inv.cancellation?.refundProofUrl || '');
    setCancelRefundDate(inv.cancellation?.refundDate || new Date().toISOString().slice(0, 10));

    setIsCancelModalOpen(true);
  };

  const handleReasonCategoryChange = (cat: CancellationReasonType) => {
    setCancelReasonCategory(cat);
    const paid = cancellingInvoice ? getInvoicePaidAmount(cancellingInvoice) : 0;
    if (cat === 'FORCE_MAJEURE') {
      // Bencana Alam: Pasal 1244 & 1245 KUHPerdata membebaskan ganti rugi, dana dikembalikan penuh
      setCancelCancellationFee(0);
      setCancelRefundAmount(paid);
    } else if (cat === 'BREACH_OF_CONTRACT') {
      // Pembatalan sepihak: Toko berhak menahan DP atau kenakan denda
      const fee = Math.round(paid * 0.5);
      setCancelCancellationFee(fee);
      setCancelRefundAmount(Math.max(0, paid - fee));
    }
  };

  const handleCancellationFeeChange = (fee: number) => {
    const paid = cancellingInvoice ? getInvoicePaidAmount(cancellingInvoice) : 0;
    const cleanFee = Math.max(0, Math.min(paid, fee));
    setCancelCancellationFee(cleanFee);
    setCancelRefundAmount(Math.max(0, paid - cleanFee));
  };

  const handleCancellationRefundChange = (refund: number) => {
    const paid = cancellingInvoice ? getInvoicePaidAmount(cancellingInvoice) : 0;
    setCancelRefundAmount(Math.max(0, Math.min(paid - cancelCancellationFee, refund)));
  };

  const handleExecuteCancellation = async () => {
    if (!cancellingInvoice) return;
    if (!cancelReasonDetails.trim()) {
      showToast('Harap isi keterangan/rincian alasan pembatalan dokumen.', 'error');
      return;
    }

    const isCommercial = cancellingInvoice.documentType === 'COMMERCIAL';
    const paid = getInvoicePaidAmount(cancellingInvoice);
    const fee = Math.max(0, cancelCancellationFee);
    const refund = Math.max(0, cancelRefundAmount);

    if (fee > paid) {
      showToast('Biaya pembatalan tidak boleh melebihi dana yang sudah diterima.', 'error');
      return;
    }
    if (fee + refund > paid + 1) {
      showToast(
        `Total biaya pembatalan + refund (Rp ${(fee + refund).toLocaleString('id-ID')}) melebihi dana diterima (Rp ${paid.toLocaleString('id-ID')}).`,
        'error'
      );
      return;
    }

    const cancellationInfo: InvoiceCancellationInfo = {
      cancelledAt: Date.now(),
      cancelledBy: currentUser?.name || 'Admin',
      reasonCategory: cancelReasonCategory,
      reasonDetails: cancelReasonDetails.trim(),
      cancellationProofUrl: cancelProofUrl.trim() || undefined,
      creditNoteNumber: isCommercial ? (cancelCreditNoteNumber.trim() || generateNextCreditNoteNumber(invoices, storeIdentity)) : undefined,
      creditNoteDate: isCommercial ? cancelCreditNoteDate : undefined,
      creditNoteAmount: isCommercial ? cancellingInvoice.grandTotal : undefined,
      taxCancellationRequired: isCommercial && cancellingInvoice.taxAmount > 0,
      taxReturnNumber: cancelTaxReturnNumber.trim() || undefined,
      refundRequired: refund > 0,
      originalPaidAmount: paid,
      cancellationFee: fee,
      refundAmount: refund,
      refundDate: cancelRefundDate,
      refundMethod: cancelRefundMethod,
      refundBankTarget: cancelRefundBankTarget.trim() || undefined,
      refundProofUrl: cancelRefundProofUrl.trim() || undefined
    };

    const updatedInvoice: Invoice = {
      ...cancellingInvoice,
      status: 'CANCELLED',
      balanceDue: 0,
      cancellation: cancellationInfo,
      updatedAt: Date.now()
    };

    let parentUpdated: Invoice | undefined;
    const updatedList = invoices.map(item => {
      if (item.id === cancellingInvoice.id) {
        return updatedInvoice;
      }

      const isParent = (cancellingInvoice.sourceProformaId && item.id === cancellingInvoice.sourceProformaId) ||
        (cancellingInvoice.sourceProformaNumber && item.documentNumber === cancellingInvoice.sourceProformaNumber) ||
        (item.childInvoiceIds && item.childInvoiceIds.includes(cancellingInvoice.id)) ||
        (item.childInvoiceNumbers && item.childInvoiceNumbers.includes(cancellingInvoice.documentNumber));

      if (isParent && item.status !== 'CANCELLED') {
        const newSchedules = (item.paymentSchedules || []).map((sched, idx) => {
          const isMatch = (cancellingInvoice.terminStageId && sched.id === cancellingInvoice.terminStageId) ||
            (cancellingInvoice.terminStageNumber && idx === cancellingInvoice.terminStageNumber - 1) ||
            (sched.invoiceNumber === cancellingInvoice.documentNumber) ||
            (cancellingInvoice.documentNumber.endsWith(`/T${idx + 1}`));
          if (isMatch) {
            return { ...sched, isPaid: false, status: 'Belum' };
          }
          return sched;
        });

        const remainingChildInvoices = invoices.filter(ci =>
          ci.id !== cancellingInvoice.id &&
          ci.status !== 'CANCELLED' &&
          ci.documentType === 'COMMERCIAL' && (
            (ci.sourceProformaId && ci.sourceProformaId === item.id) ||
            (ci.sourceProformaNumber && ci.sourceProformaNumber === item.documentNumber) ||
            (item.childInvoiceIds && item.childInvoiceIds.includes(ci.id)) ||
            (item.childInvoiceNumbers && item.childInvoiceNumbers.includes(ci.documentNumber))
          )
        );

        const remChildPaid = remainingChildInvoices.reduce((sum, ci) => sum + (ci.amountPaid || 0), 0);

        // Hindari double counting pembayaran yang tersalin ke child invoice
        const childPaymentRefIds = new Set<string>();
        remainingChildInvoices.forEach(ci => {
          (ci.payments || []).forEach(p => {
            if (p.id) childPaymentRefIds.add(p.id);
            if (p.referenceNumber) childPaymentRefIds.add(p.referenceNumber);
          });
        });
        const directPaid = (item.payments || [])
          .filter(p => !((p.id && childPaymentRefIds.has(p.id)) || (p.referenceNumber && childPaymentRefIds.has(p.referenceNumber))))
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        const updatedPaid = Math.min(item.grandTotal, remChildPaid + directPaid);
        const updatedBalance = Math.max(0, item.grandTotal - updatedPaid);
        const updatedStatus: InvoiceStatus = updatedBalance === 0 && item.grandTotal > 0
          ? 'PAID'
          : (updatedPaid > 0 ? 'PARTIAL' : 'ISSUED');

        parentUpdated = {
          ...item,
          paymentSchedules: newSchedules,
          amountPaid: updatedPaid,
          balanceDue: updatedBalance,
          status: updatedStatus,
          updatedAt: Date.now()
        };
        return parentUpdated;
      }

      return item;
    });

    updateInvoicesState(updatedList);
    setIsCancelModalOpen(false);
    setCancellingInvoice(null);

    const msg = isCommercial
      ? `Invoice ${cancellingInvoice.documentNumber} berhasil dibatalkan & Credit Note ${cancellationInfo.creditNoteNumber} diterbitkan.`
      : `Proforma Invoice ${cancellingInvoice.documentNumber} berhasil dibatalkan (Void).`;
    showToast(msg, 'success');

    // Save to PocketBase PocketBase Cloud
    try {
      await saveInvoiceCloud(updatedInvoice);
      if (parentUpdated) {
        await saveInvoiceCloud(parentUpdated);
      }
    } catch (cloudErr) {
      console.warn('Error saving cancellation to PocketBase:', cloudErr);
    }

    // Call backend API
    try {
      await fetch(`/api/invoices/${cancellingInvoice.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellation: cancellationInfo })
      });
    } catch {
      // Offline fallback
    }
  };

  // =========================================================================
  // STORE IDENTITY SETTINGS
  // =========================================================================
  const [identityForm, setIdentityForm] = useState<InvoiceStoreIdentity>(storeIdentity);

  // Sync identity form state whenever storeIdentity is updated by other users/cloud
  useEffect(() => {
    setIdentityForm(storeIdentity);
  }, [storeIdentity]);

  const handleSaveIdentitySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreIdentity(identityForm);
    saveStoredInvoiceStoreIdentity(identityForm);
    showToast('Identitas penerbit invoice berhasil disimpan!', 'success');

    // Save to PocketBase Cloud PocketBase for real-time multi-account sync
    saveInvoiceStoreIdentityCloud(identityForm).catch(console.warn);

    try {
      await fetch('/api/invoices/store-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(identityForm)
      });
    } catch {
      // Offline fallback
    }
  };

  const handleAddBankAccount = () => {
    setIdentityForm(prev => ({
      ...prev,
      bankAccounts: [
        ...prev.bankAccounts,
        {
          id: `bank-${Date.now()}`,
          bankName: 'BCA',
          accountNumber: '',
          accountHolder: prev.storeName,
          branch: '',
          isDefault: false
        }
      ]
    }));
  };

  const handleRemoveBankAccount = (id: string) => {
    setIdentityForm(prev => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter(b => b.id !== id)
    }));
  };

  const handleUpdateBankAccount = (id: string, field: string, val: any) => {
    setIdentityForm(prev => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map(b => b.id === id ? { ...b, [field]: val } : b)
    }));
  };

  // =========================================================================
  // FILTERED INVOICES LIST
  // =========================================================================
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const isPi = inv.documentType === 'PROFORMA';
      const effectivePayInfo = isPi
        ? getProformaEffectivePaymentInfo(inv, invoices)
        : { amountPaid: inv.amountPaid || 0, balanceDue: inv.balanceDue ?? 0, status: inv.status };

      // Type Filter
      if (filterType !== 'ALL' && inv.documentType !== filterType) return false;

      // Status Filter
      if (filterStatus !== 'ALL') {
        const curStatus = effectivePayInfo.status;
        if (filterStatus === 'UNPAID' && curStatus !== 'ISSUED') return false;
        if (filterStatus === 'PARTIAL' && curStatus !== 'PARTIAL') return false;
        if (filterStatus === 'PAID' && curStatus !== 'PAID') return false;
        if (filterStatus === 'CONVERTED' && inv.status !== 'CONVERTED') return false;
        if (filterStatus === 'CANCELLED' && curStatus !== 'CANCELLED') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = inv.documentNumber?.toLowerCase().includes(q);
        const matchTitle = inv.projectTitle?.toLowerCase().includes(q);
        const matchCust = inv.customer?.name?.toLowerCase().includes(q) || inv.customer?.phone?.includes(q);
        const matchCn = inv.cancellation?.creditNoteNumber?.toLowerCase().includes(q);
        const matchReason = inv.cancellation?.reasonDetails?.toLowerCase().includes(q);
        if (!matchNumber && !matchTitle && !matchCust && !matchCn && !matchReason) return false;
      }

      return true;
    });
  }, [invoices, filterType, filterStatus, searchQuery]);

  // Financial Summary Cards (Mengacu pada status dokumen, piutang debit nol, dan kas refund riil)
  const statsSummary = useMemo(() => {
    const totalPi = invoices.filter(i => i.documentType === 'PROFORMA' && i.status !== 'CANCELLED').length;
    const totalInv = invoices.filter(i => i.documentType === 'COMMERCIAL' && i.status !== 'CANCELLED').length;
    const totalCancelled = invoices.filter(i => i.status === 'CANCELLED').length;
    const totalCreditNotes = invoices.filter(i => i.status === 'CANCELLED' && i.cancellation?.creditNoteNumber).length;

    // Sisa Tagihan (Piutang): Dokumen yang dibatalkan / Credit Note otomatis bersaldo piutang Rp 0
    const totalOutstanding = invoices
      .filter(i => i.documentType === 'COMMERCIAL' && i.status !== 'PAID' && i.status !== 'CANCELLED')
      .reduce((acc, curr) => acc + (curr.balanceDue || 0), 0);

    // Total Penerimaan Kas Terkumpul (Mengurangi nominal refund riil pada transaksi yang dibatalkan)
    const totalCollected = invoices
      .filter(i => i.documentType === 'COMMERCIAL' || (i.documentType === 'PROFORMA' && (!i.childInvoiceIds || i.childInvoiceIds.length === 0)))
      .reduce((acc, curr) => {
        if (curr.status === 'CANCELLED') {
          const refund = curr.cancellation?.refundAmount || 0;
          return acc + Math.max(0, (curr.amountPaid || 0) - refund);
        }
        return acc + (curr.amountPaid || 0);
      }, 0);

    return { totalPi, totalInv, totalCancelled, totalCreditNotes, totalOutstanding, totalCollected };
  }, [invoices]);

  const getStatusBadge = (status: InvoiceStatus, docType: InvoiceDocumentType) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Lunas (Paid)
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            DP / Sebagian
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Belum Bayar
          </span>
        );
      case 'CONVERTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <Check className="w-3.5 h-3.5 text-purple-600" />
            Terkonversi ke INV
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Kedaluwarsa
          </span>
        );
      case 'CANCELLED':
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
            docType === 'PROFORMA'
              ? 'bg-slate-100 text-slate-700 border-slate-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}>
            <Ban className="w-3.5 h-3.5 text-rose-600" />
            {docType === 'PROFORMA' ? 'Dibatalkan (Void)' : 'Dibatalkan (Credit Note)'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
            Draf
          </span>
        );
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 animate-bounce ${
          toastMessage.type === 'success'
            ? 'bg-emerald-900 text-white border-emerald-700'
            : toastMessage.type === 'error'
            ? 'bg-rose-900 text-white border-rose-700'
            : 'bg-slate-900 text-white border-slate-700'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Screen Header */}
      <div className={`${activeSubTab === 'create' ? 'max-w-[1760px]' : 'max-w-7xl'} mx-auto mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
              B2B & POS Billing
            </span>
            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
              Akses Manajemen Toko
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Proforma Invoice & Faktur Penjualan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Penerbitan Proforma Invoice (PI) dan Invoice (INV) dengan alur konversi otomatis.
          </p>
        </div>

        {/* Top Action Tabs */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={() => { setActiveSubTab('list'); resetForm(); }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'list'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Daftar Dokumen ({invoices.length})
          </button>

          <button
            type="button"
            onClick={() => { resetForm(); setActiveSubTab('create'); }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'create'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50'
            }`}
          >
            <Plus className="w-4 h-4" />
            Buat Invoice Baru
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'settings'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Pengaturan Identitas Toko Penerbit (Kop, No. Rekening, Stempel)"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Identitas Toko</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW: SETTINGS TAB (IDENTITAS TOKO PENERBIT) */}
      {/* =================================================================== */}
      {activeSubTab === 'settings' && (
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-base font-bold">Identitas Toko Penerbit Invoice</h2>
                <p className="text-xs text-slate-400">Data ini akan muncul pada kop surat, footer rekening, dan stempel dokumen.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('list')}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveIdentitySettings} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Resmi Toko / Usaha *</label>
                <input
                  type="text"
                  required
                  value={identityForm.storeName}
                  onChange={e => setIdentityForm(prev => ({ ...prev, storeName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="e.g. BEJO Digital Print"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tagline / Spesialisasi</label>
                <input
                  type="text"
                  value={identityForm.tagline || ''}
                  onChange={e => setIdentityForm(prev => ({ ...prev, tagline: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="e.g. Spesialis Stiker Vinyl, Custom Decal & Laser Cutting"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Fisik Lengkap *</label>
                <textarea
                  required
                  rows={2}
                  value={identityForm.address}
                  onChange={e => setIdentityForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="Jl. Raya Utama No. 45..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Telepon / WhatsApp Kantor *</label>
                <input
                  type="text"
                  required
                  value={identityForm.phone}
                  onChange={e => setIdentityForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="0812-3456-7890"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Kantor</label>
                <input
                  type="email"
                  value={identityForm.email || ''}
                  onChange={e => setIdentityForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="bejo.stiker@gmail.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">NPWP Toko (Opsional)</label>
                <input
                  type="text"
                  value={identityForm.npwp || ''}
                  onChange={e => setIdentityForm(prev => ({ ...prev, npwp: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="08.123.456.7-654.000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Logo URL (Format Gambar PNG/JPG)</label>
                <input
                  type="text"
                  value={identityForm.logoUrl || ''}
                  onChange={e => setIdentityForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prefix Nomor Proforma (PI)</label>
                <input
                  type="text"
                  value={identityForm.proformaPrefix}
                  onChange={e => setIdentityForm(prev => ({ ...prev, proformaPrefix: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="PI/BJP"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prefix Nomor Invoice Komersial (INV)</label>
                <input
                  type="text"
                  value={identityForm.invoicePrefix}
                  onChange={e => setIdentityForm(prev => ({ ...prev, invoicePrefix: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="INV/BJP"
                />
              </div>
            </div>

            {/* Bank Accounts Section */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  Daftar Rekening Pembayaran Toko
                </h3>
                <button
                  type="button"
                  onClick={handleAddBankAccount}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Rekening
                </button>
              </div>

              <div className="space-y-3">
                {identityForm.bankAccounts.map((acc, idx) => (
                  <div key={acc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500">Nama Bank</label>
                      <input
                        type="text"
                        value={acc.bankName}
                        onChange={e => handleUpdateBankAccount(acc.id, 'bankName', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-bold"
                        placeholder="e.g. BCA"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500">Nomor Rekening</label>
                      <input
                        type="text"
                        value={acc.accountNumber}
                        onChange={e => handleUpdateBankAccount(acc.id, 'accountNumber', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-bold"
                        placeholder="123-456-7890"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500">Atas Nama (A/N)</label>
                        <input
                          type="text"
                          value={acc.accountHolder}
                          onChange={e => handleUpdateBankAccount(acc.id, 'accountHolder', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-semibold"
                          placeholder="Ahmad Irdianto"
                        />
                      </div>
                      {identityForm.bankAccounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBankAccount(acc.id)}
                          className="mt-4 p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Default Terms & Signer */}
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Syarat & Ketentuan Baku (Term of Payment)</label>
                <textarea
                  rows={3}
                  value={identityForm.defaultTerms || ''}
                  onChange={e => setIdentityForm(prev => ({ ...prev, defaultTerms: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Penanda Tangan / Pimpinan</label>
                <input
                  type="text"
                  value={identityForm.authorizedSignerName || ''}
                  onChange={e => setIdentityForm(prev => ({ ...prev, authorizedSignerName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  placeholder="Ahmad Irdianto"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jabatan Penanda Tangan</label>
                <input
                  type="text"
                  value={identityForm.authorizedSignerRole || ''}
                  onChange={e => setIdentityForm(prev => ({ ...prev, authorizedSignerRole: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  placeholder="Owner / Pimpinan Toko"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveSubTab('list')}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                Simpan Identitas Toko
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW: CREATE & EDIT INVOICE FORM (DYNAMIC COLUMNS + 1/2 LIVE PREVIEW) */}
      {/* =================================================================== */}
      {activeSubTab === 'create' && (
        <div className="max-w-[1760px] mx-auto pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* =============================================================== */}
            {/* SISI KIRI (1/2 HALAMAN): FORM INPUT DINAMIS, BERSIH & KOMPAK */}
            {/* =============================================================== */}
            <div className="lg:col-span-6 xl:col-span-6 space-y-4">
              <form onSubmit={handleSubmitForm} className="space-y-4">
                
                {/* 1. Pengaturan Dokumen & Nomor */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-200 gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        1
                      </div>
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900 leading-tight">
                          {editingInvoiceId ? 'Edit Dokumen' : 'Parameter & Jenis Dokumen'}
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          Pilih format dokumen Proforma Invoice (PI) atau Invoice Final (INV).
                        </p>
                      </div>
                    </div>

                    {/* Type Switcher Pills */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                      <button
                        type="button"
                        disabled={!!editingInvoiceId}
                        onClick={() => setFormDocType('PROFORMA')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formDocType === 'PROFORMA'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Proforma (PI)
                      </button>
                      <button
                        type="button"
                        disabled={!!editingInvoiceId}
                        onClick={() => setFormDocType('COMMERCIAL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formDocType === 'COMMERCIAL'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Invoice Final (INV)
                      </button>
                    </div>
                  </div>

                  {/* Document Details Grid: 3 Dynamic Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">No. Dokumen *</label>
                        <button
                          type="button"
                          onClick={() => setFormIsCustomNumber(!formIsCustomNumber)}
                          className="text-[10px] font-bold text-indigo-600 hover:underline"
                        >
                          {formIsCustomNumber ? 'Auto Urut' : 'Edit Manual'}
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        readOnly={!formIsCustomNumber}
                        value={formDocNumber}
                        onChange={e => setFormDocNumber(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold focus:outline-hidden ${
                          formIsCustomNumber ? 'bg-white border-indigo-400 text-indigo-900' : 'bg-slate-100 border-slate-300 text-slate-700'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Terbit *</label>
                      <input
                        type="date"
                        required
                        value={formIssueDate}
                        onChange={e => setFormIssueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {formDocType === 'PROFORMA' ? 'Masa Berlaku (Expiry) *' : 'Jatuh Tempo *'}
                      </label>
                      <input
                        type="date"
                        required
                        value={formDocType === 'PROFORMA' ? formExpiryDate : formDueDate}
                        onChange={e => formDocType === 'PROFORMA' ? setFormExpiryDate(e.target.value) : setFormDueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Judul Pekerjaan / Nama Proyek *</label>
                      <input
                        type="text"
                        required
                        value={formProjectTitle}
                        onChange={e => setFormProjectTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        placeholder="Contoh: Branding Armada Box & Signage Akrilik Kantor Cabang"
                      />
                    </div>

                    {/* Kolom Khusus: Parent ID & Referensi Acuan (PO untuk PI / PI untuk Invoice Final) */}
                    <div className="sm:col-span-3 pt-3 mt-1 border-t border-slate-200">
                      <div className="bg-indigo-50/70 rounded-xl p-3.5 border border-indigo-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            <div>
                              <span className="text-xs font-bold text-indigo-950 block">
                                {formDocType === 'PROFORMA'
                                  ? 'Reference Number: Purchase Order (PO Acuan)'
                                  : 'Reference Number (Proforma Invoice Induk)'}
                              </span>
                              <span className="text-[10px] text-indigo-700 block">
                                {formDocType === 'PROFORMA'
                                  ? 'Diisi manual nomor Purchase Order (PO) acuan pelanggan dan deskripsi spesifikasi pekerjaan.'
                                  : 'Diisi manual atau dipilih dari database untuk menghubungkan invoice dengan Proforma Invoice induk.'}
                              </span>
                            </div>
                          </div>

                          {/* Quick pick from existing Proforma Invoices (Khusus Invoice Final) */}
                          {formDocType === 'COMMERCIAL' && invoices.some(inv => inv.documentType === 'PROFORMA') && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold text-slate-500">Pilih dari PI:</span>
                              <select
                                onChange={e => {
                                  const piNum = e.target.value;
                                  if (!piNum) return;
                                  const targetPi = invoices.find(inv => inv.documentNumber === piNum);
                                  if (targetPi) {
                                    setFormSourceProformaNumber(targetPi.documentNumber);
                                    if (!formProjectTitle) setFormProjectTitle(targetPi.projectTitle);
                                    if (!formCustomer.name) setFormCustomer({ ...targetPi.customer });
                                    setFormContractTotalAmount(targetPi.grandTotal);
                                    if (!formReferenceDescription) {
                                      setFormReferenceDescription(`Pembayaran Termin 1 (30%) dari Total Kontrak Rp ${targetPi.grandTotal.toLocaleString('id-ID')}`);
                                    }
                                  }
                                }}
                                className="px-2 py-1 rounded-lg border border-indigo-300 text-xs font-semibold bg-white text-indigo-900 focus:outline-hidden max-w-[210px]"
                                defaultValue=""
                              >
                                <option value="" disabled>-- Ambil dari PI Induk --</option>
                                {invoices
                                  .filter(inv => inv.documentType === 'PROFORMA')
                                  .map(pi => (
                                    <option key={pi.id} value={pi.documentNumber}>
                                      {pi.documentNumber} - {pi.customer.name} (Rp {pi.grandTotal.toLocaleString('id-ID')})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">
                              {formDocType === 'PROFORMA' ? 'Berdasarkan Purchase Order :' : 'Berdasarkan Proforma Invoice :'}
                            </label>
                            <input
                              type="text"
                              value={formSourceProformaNumber}
                              onChange={e => setFormSourceProformaNumber(e.target.value)}
                              placeholder={formDocType === 'PROFORMA' ? 'contoh: 02/PO/BNK/XI/2026' : 'contoh: PI/BJP/2026/10/0007'}
                              className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-white text-xs font-bold text-indigo-950 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            />
                            <span className="text-[10px] text-slate-500 mt-0.5 block">
                              {formDocType === 'PROFORMA'
                                ? 'Dapat diisi manual nomor Purchase Order (PO) acuan (contoh: 02/PO/BNK/XI/2026).'
                                : 'Dapat diisi manual nomor Proforma Invoice acuan (contoh: PI/BJP/2026/10/0007).'}
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">
                              Keterangan :
                            </label>
                            <input
                              type="text"
                              value={formReferenceDescription}
                              onChange={e => setFormReferenceDescription(e.target.value)}
                              placeholder={formDocType === 'PROFORMA' ? 'contoh: Pekerjaan Stiker Cutting SAICHOLITE & Jasa Pasang' : 'contoh: Pembayaran Termin 1 (30%) dari Total Kontrak'}
                              className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            />
                            <span className="text-[10px] text-slate-500 mt-0.5 block">
                              {formDocType === 'PROFORMA'
                                ? 'Dapat diisi keterangan spesifikasi / pengadaan pekerjaan.'
                                : 'Dapat diisi manual keterangan termin / persentase pembayaran.'}
                            </span>
                          </div>
                        </div>

                        {/* Presets Cepat */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
                          <span className="font-bold text-slate-500">Pilihan Keterangan Cepat:</span>
                          {formDocType === 'PROFORMA' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setFormReferenceDescription('Pekerjaan Stiker Cutting SAICHOLITE & Jasa Pasang')}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer font-medium"
                              >
                                Stiker Cutting SAICHOLITE & Jasa Pasang
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormReferenceDescription('Pengadaan & Pemasangan Signage Akrilik Kantor')}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer font-medium"
                              >
                                Signage Akrilik Kantor
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormReferenceDescription('Branding Armada Mobil Toko & Box Full Wrapping')}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer font-medium"
                              >
                                Branding Armada Box
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setFormReferenceDescription('Pembayaran Termin 1 (30%) dari Total Kontrak')}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer font-medium"
                              >
                                Termin 1 (30%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormReferenceDescription('Pembayaran Termin 2 (40%) dari Total Kontrak')}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer font-medium"
                              >
                                Termin 2 (40%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormReferenceDescription('Pembayaran Termin 3 / Pelunasan (30%) dari Total Kontrak')}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer font-medium"
                              >
                                Pelunasan (30%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormReferenceDescription(`Pembayaran Uang Muka / Down Payment (DP ${formatPercentInput(formDpPercent || 50)}%)`)}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer font-medium"
                              >
                                DP ({formatPercentInput(formDpPercent || 50)}%)
                              </button>
                            </>
                          )}
                          {(formSourceProformaNumber || formReferenceDescription) && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormSourceProformaNumber('');
                                setFormReferenceDescription('');
                                setFormContractTotalAmount(0);
                              }}
                              className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer font-bold ml-auto"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Customer / Instansi Penerima Tagihan */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-200 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        2
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 leading-tight flex items-center gap-1.5">
                          Data Pelanggan / Instansi Penerima
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Identitas tujuan penagihan pada kop invoice.
                        </p>
                      </div>
                    </div>

                    {/* Quick Customer Picker */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">Database:</span>
                      <select
                        value={selectedCustomerOption}
                        onChange={e => handleSelectCustomerPreset(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-slate-50 focus:outline-hidden max-w-[200px]"
                      >
                        <option value="custom">+ Input Pelanggan Baru</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.phone}>
                            {c.name} ({c.phone})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 mt-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pelanggan / PT *</label>
                      <input
                        type="text"
                        required
                        value={formCustomer.name}
                        onChange={e => setFormCustomer(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="PT. Sinar Jaya Abadi"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nama PIC (Person In Charge)</label>
                      <input
                        type="text"
                        value={formCustomer.pic || ''}
                        onChange={e => setFormCustomer(prev => ({ ...prev, pic: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="Bpk. Hendro Wicaksono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp / Telp *</label>
                      <input
                        type="text"
                        required
                        value={formCustomer.phone}
                        onChange={e => setFormCustomer(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="0812-3456-7890"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Email Instansi</label>
                      <input
                        type="email"
                        value={formCustomer.email || ''}
                        onChange={e => setFormCustomer(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="finance@perusahaan.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">NPWP Instansi (Opsional)</label>
                      <input
                        type="text"
                        value={formCustomer.npwp || ''}
                        onChange={e => setFormCustomer(prev => ({ ...prev, npwp: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="01.234.567.8-012.000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Penagihan / Kirim</label>
                      <input
                        type="text"
                        value={formCustomer.address}
                        onChange={e => setFormCustomer(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="Kawasan Industri Blok B-12"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Items & Services Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        3
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                          Rincian Barang & Jasa ({formItems.length} Item)
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Daftar spesifikasi barang atau pekerjaan yang ditagihkan.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsSalesPickerModalOpen(true)}
                        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors border border-amber-500 shadow-2xs"
                        title="Tarik transaksi SPK Cetak, Open Account, Reguler POS, atau Invoice B2B dari Laporan Penjualan"
                      >
                        <Layers className="w-3.5 h-3.5 text-slate-950" />
                        <span>Tarik dari Laporan Penjualan</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddItemRow}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Baris
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto mt-3.5 border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse min-w-[620px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-2.5 px-2.5 w-10 text-center">No</th>
                          <th className="py-2.5 px-3">Nama Barang & Pekerjaan</th>
                          <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                          <th className="py-2.5 px-2 w-20 text-center">Satuan</th>
                          <th className="py-2.5 px-2.5 w-28 text-right">Harga</th>
                          <th className="py-2.5 px-2 w-16 text-center">Disc %</th>
                          <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                          <th className="py-2.5 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {formItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            <td className="py-2 px-2 text-center font-bold text-slate-400 align-top pt-3">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  required
                                  value={item.itemName}
                                  onChange={e => handleUpdateItemField(item.id, 'itemName', e.target.value)}
                                  placeholder="Nama item / judul pekerjaan..."
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                />
                                <input
                                  type="text"
                                  value={item.description || ''}
                                  onChange={e => handleUpdateItemField(item.id, 'description', e.target.value)}
                                  placeholder="Spesifikasi teknis, ukuran, atau detail pengerjaan..."
                                  className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-600 focus:outline-hidden"
                                />
                                {/* Quick pick product dropdown */}
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                  <span>Katalog:</span>
                                  <select
                                    onChange={e => {
                                      if (e.target.value) handlePickProductForItem(item.id, e.target.value);
                                    }}
                                    className="bg-transparent text-indigo-600 font-medium focus:outline-hidden cursor-pointer"
                                    defaultValue=""
                                  >
                                    <option value="" disabled>-- Pilih Cepat Produk --</option>
                                    {products.slice(0, 30).map(p => (
                                      <option key={p.id} value={p.code}>
                                        {p.name} (Rp {p.price?.toLocaleString('id-ID')})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2 align-top pt-2.5">
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                required
                                value={item.quantity}
                                onChange={e => handleUpdateItemField(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-center focus:outline-hidden"
                              />
                            </td>
                            <td className="py-2 px-2 align-top pt-2.5">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={e => handleUpdateItemField(item.id, 'unit', e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs text-center focus:outline-hidden"
                                placeholder="pcs"
                              />
                            </td>
                            <td className="py-2 px-2.5 align-top pt-2.5">
                              <input
                                type="number"
                                required
                                value={item.unitPrice}
                                onChange={e => handleUpdateItemField(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-right focus:outline-hidden"
                              />
                            </td>
                            <td className="py-2 px-2 align-top pt-2.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.discountPercent || 0}
                                onChange={e => handleUpdateItemField(item.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                                className="w-full px-1.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-center focus:outline-hidden"
                              />
                            </td>
                            <td className="py-2 px-3 align-top pt-3.5 text-right">
                              <span className="text-xs font-extrabold text-slate-900 block whitespace-nowrap">
                                Rp {item.totalPrice.toLocaleString('id-ID')}
                              </span>
                            </td>
                            <td className="py-2 px-2 align-top pt-2.5 text-center">
                              {formItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(item.id)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex justify-start">
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Baris Item Pekerjaan
                    </button>
                  </div>
                </div>

                {/* 4. Pajak & Ringkasan Nilai Keuangan */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    {/* Pajak & Catatan Kolom Kiri */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={formApplyTax}
                            onChange={e => setFormApplyTax(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          Kenakan PPN
                        </label>
                        {formApplyTax ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 ml-auto">
                            <span>Tarif:</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={formTaxRate}
                              onChange={e => setFormTaxRate(parseFloat(e.target.value) || 0)}
                              className="w-14 px-2 py-1 rounded-lg border border-slate-300 text-center font-bold bg-white"
                            />
                            <span>%</span>
                          </div>
                        ) : (
                          <span className="text-[10.5px] font-bold text-slate-600 bg-slate-200/80 border border-slate-300 px-2 py-0.5 rounded-md ml-auto">
                            (Non-PKP)
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Dokumen / Syarat Khusus</label>
                        <textarea
                          rows={3}
                          value={formNotes}
                          onChange={e => setFormNotes(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          placeholder="Instruksi pembayaran, revisi desain max 2x, pengiriman bertahap, dll..."
                        />
                      </div>
                    </div>

                    {/* Ringkasan Finansial Kolom Kanan */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs font-medium">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-semibold text-slate-800">Rp {calculatedTotals.subtotal.toLocaleString('id-ID')}</span>
                      </div>
                      {calculatedTotals.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Diskon:</span>
                          <span className="font-semibold">- Rp {calculatedTotals.discountAmount.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600">
                        <span>Dasar Pengenaan Pajak (DPP):</span>
                        <span className="font-semibold text-slate-800">Rp {calculatedTotals.taxableBase.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>PPN {formApplyTax && calculatedTotals.taxRate > 0 ? `(${calculatedTotals.taxRate}%)` : '(Non-PKP)'}:</span>
                        <span className="font-semibold text-slate-800">
                          {formApplyTax && calculatedTotals.taxRate > 0
                            ? `Rp ${calculatedTotals.taxAmount.toLocaleString('id-ID')}`
                            : 'Rp 0'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base font-extrabold text-slate-900 pt-2.5 border-t border-slate-200">
                        <span>Total Tagihan (Grand Total):</span>
                        <span className="font-black text-indigo-700">Rp {calculatedTotals.grandTotal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Metode & Skema Pembayaran */}
                <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-xs p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        5
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 leading-tight">
                          Metode Pembayaran
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Pilihan metode pembayaran DP, Termin, atau Pelunasan Penuh (100%).
                        </p>
                      </div>
                    </div>

                    {/* Payment Scheme Buttons */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleChangePaymentScheme('FULL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formPaymentScheme === 'FULL'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Pelunasan Penuh (100%)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangePaymentScheme('DP')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formPaymentScheme === 'DP'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        DP (Down Payment)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangePaymentScheme('TERMIN')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formPaymentScheme === 'TERMIN'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Termin (Bertahap)
                      </button>
                    </div>
                  </div>

                  {/* SKEMA DP: 2 TAHAP */}
                  {formPaymentScheme === 'DP' && (
                    <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                            Skema Down Payment (DP) — Pembayaran Dibagi dalam 2 Tahap
                          </span>
                          <p className="text-[11px] text-amber-800">
                            Masukkan DP dalam persentase (boleh desimal, contoh 12,5%) atau nominal bulat; tahap pelunasan dihitung otomatis.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-amber-900">
                            Total: Rp {calculatedTotals.grandTotal.toLocaleString('id-ID')} (100%)
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Tahap 1: DP */}
                        {formPaymentSchedules[0] && (
                          <div className="p-3 bg-white rounded-xl border border-amber-300 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">
                                Tahap 1: {formPaymentSchedules[0].name}
                              </span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                Uang Muka
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">DP dalam Persentase (%)</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={dpPercentInput}
                                    onFocus={() => setIsDpInputFocused(true)}
                                    onBlur={handleDpPercentBlur}
                                    onChange={e => handleDpPercentChange(e.target.value)}
                                    placeholder="Contoh: 12,5"
                                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900"
                                  />
                                  <span className="text-xs font-bold text-slate-500">%</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">Boleh desimal (koma atau titik).</p>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">DP dalam Nominal (Rp)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={dpAmountInput}
                                  onFocus={() => setIsDpInputFocused(true)}
                                  onBlur={handleDpAmountBlur}
                                  onChange={e => handleDpAmountChange(e.target.value)}
                                  placeholder="Contoh: 1500000"
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900"
                                />
                                <p className="text-[10px] text-slate-500 mt-0.5">Nominal bulat, otomatis dikonversi ke persentase.</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Waktu Pembayaran</label>
                                <input
                                  type="date"
                                  value={formPaymentSchedules[0].dueDate || ''}
                                  onChange={e => handleUpdateScheduleRow(formPaymentSchedules[0].id, 'dueDate', e.target.value)}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-medium"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Keterangan</label>
                                <input
                                  type="text"
                                  value={formPaymentSchedules[0].notes || ''}
                                  onChange={e => handleUpdateScheduleRow(formPaymentSchedules[0].id, 'notes', e.target.value)}
                                  placeholder="DP sebelum produksi"
                                  className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-medium"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tahap 2: Pelunasan */}
                        {formPaymentSchedules[1] && (
                          <div className="p-3 bg-white rounded-xl border border-amber-300 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">
                                Tahap 2: {formPaymentSchedules[1].name}
                              </span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                Pelunasan
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Persentase (%)</label>
                                <div className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
                                  {formatPercentInput(formPaymentSchedules[1].percentage)}%
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Nominal (Rp)</label>
                                <div className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
                                  Rp {Math.round(formPaymentSchedules[1].amount || 0).toLocaleString('id-ID')}
                                </div>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500">Dihitung otomatis dari nilai DP di Tahap 1.</p>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Waktu Pembayaran</label>
                                <input
                                  type="date"
                                  value={formPaymentSchedules[1].dueDate || ''}
                                  onChange={e => handleUpdateScheduleRow(formPaymentSchedules[1].id, 'dueDate', e.target.value)}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-medium"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Keterangan</label>
                                <input
                                  type="text"
                                  value={formPaymentSchedules[1].notes || ''}
                                  onChange={e => handleUpdateScheduleRow(formPaymentSchedules[1].id, 'notes', e.target.value)}
                                  placeholder="Pelunasan sebelum kirim"
                                  className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-medium"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SKEMA TERMIN: MULTI-STAGE */}
                  {formPaymentScheme === 'TERMIN' && (
                    <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                            Skema Pembayaran Termin — Dibagi Atas Beberapa Tahap
                          </span>
                          <p className="text-[11px] text-indigo-800">
                            Waktu pembayaran tiap termin dapat ditentukan secara manual.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAddTerminRow}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" /> Tambah Termin
                          </button>
                          <button
                            type="button"
                            onClick={handleAutoBalanceTermin}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Sesuaikan termin terakhir agar pas 100%"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Seimbangkan 100%
                          </button>
                        </div>
                      </div>

                      {/* Termin Table */}
                      <div className="overflow-x-auto bg-white rounded-xl border border-indigo-200 shadow-2xs">
                        <table className="w-full text-left text-xs min-w-[550px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                              <th className="py-2 px-2.5">Tahap / Termin</th>
                              <th className="py-2 px-2.5 w-24">Porsi (%)</th>
                              <th className="py-2 px-2.5 w-36">Nominal (Rp)</th>
                              <th className="py-2 px-2.5 w-32">Waktu Pembayaran</th>
                              <th className="py-2 px-2.5">Keterangan</th>
                              <th className="py-2 px-2 w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {formPaymentSchedules.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50/60">
                                <td className="py-1.5 px-2.5">
                                  <input
                                    type="text"
                                    value={s.name}
                                    onChange={e => handleUpdateScheduleRow(s.id, 'name', e.target.value)}
                                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-800"
                                  />
                                </td>
                                <td className="py-1.5 px-2.5">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={s.percentage}
                                      onChange={e => handleUpdateScheduleRow(s.id, 'percentage', e.target.value)}
                                      className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-center text-slate-900"
                                    />
                                    <span className="text-xs font-semibold text-slate-500">%</span>
                                  </div>
                                </td>
                                <td className="py-1.5 px-2.5">
                                  <input
                                    type="number"
                                    min="0"
                                    value={s.amount}
                                    onChange={e => handleUpdateScheduleRow(s.id, 'amount', e.target.value)}
                                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-right text-slate-900"
                                  />
                                </td>
                                <td className="py-1.5 px-2.5">
                                  <input
                                    type="date"
                                    value={s.dueDate || ''}
                                    onChange={e => handleUpdateScheduleRow(s.id, 'dueDate', e.target.value)}
                                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-medium"
                                  />
                                </td>
                                <td className="py-1.5 px-2.5">
                                  <input
                                    type="text"
                                    value={s.notes || ''}
                                    onChange={e => handleUpdateScheduleRow(s.id, 'notes', e.target.value)}
                                    placeholder="Milestone pengerjaan..."
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-600"
                                  />
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  {formPaymentSchedules.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTerminRow(s.id)}
                                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                                      title="Hapus termin ini"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-xs text-slate-900">
                              <td className="py-2 px-2.5">Total:</td>
                              <td className="py-2 px-2.5 text-center">
                                <span className={paymentSchedulesSummary.isBalanced ? 'text-emerald-700 font-black' : 'text-amber-700 font-black'}>
                                  {paymentSchedulesSummary.totalPercentage}%
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                <span className={paymentSchedulesSummary.isBalanced ? 'text-emerald-700 font-black' : 'text-amber-700 font-black'}>
                                  Rp {paymentSchedulesSummary.totalAmount.toLocaleString('id-ID')}
                                </span>
                              </td>
                              <td colSpan={3} className="py-2 px-2.5 text-right">
                                {paymentSchedulesSummary.isBalanced ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-bold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Pas 100%
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-bold">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Selisih: Rp {paymentSchedulesSummary.diffAmount.toLocaleString('id-ID')} ({paymentSchedulesSummary.diffPercentage}%)
                                  </span>
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SKEMA FULL: 1 TAHAP */}
                  {formPaymentScheme === 'FULL' && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                      <span>Pelunasan 100% penuh sebesar <strong className="font-bold text-slate-900">Rp {calculatedTotals.grandTotal.toLocaleString('id-ID')}</strong> pada tanggal jatuh tempo.</span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-bold">1 Tahap (100%)</span>
                    </div>
                  )}
                </div>

                {/* Form Action Buttons Bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Nilai Tagihan Dokumen:</span>
                    <span className="text-sm font-black text-slate-900">
                      Rp {calculatedTotals.grandTotal.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 justify-end">
                    <button
                      type="button"
                      onClick={() => { resetForm(); setActiveSubTab('list'); }}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {editingInvoiceId ? 'Simpan Perubahan' : `Terbitkan ${formDocType === 'PROFORMA' ? 'Proforma Invoice' : 'Invoice Final'}`}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* =============================================================== */}
            {/* SISI KANAN (1/2 HALAMAN): TAMPILAN LIVE PREVIEW DOKUMEN REAL-TIME */}
            {/* =============================================================== */}
            <div className="lg:col-span-6 xl:col-span-6 lg:sticky lg:top-4 flex flex-col space-y-3">
              
              {/* Header Preview Bar */}
              <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Live Preview Invoice
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Real-Time Sync
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Tampilan otomatis diperbarui saat Anda mengisi kolom input di samping.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    formDocType === 'PROFORMA' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {formDocType === 'PROFORMA' ? 'PI' : 'INV'}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => handleOpenPrint(previewInvoiceData)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    title="Buka pratinjau format cetak A4 / Unduh PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Layar Penuh / Cetak</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Live Document Sheet */}
              <div className="overflow-y-auto bg-slate-200/70 p-3 sm:p-5 rounded-2xl border border-slate-300 shadow-inner flex justify-center max-h-[calc(100vh-135px)]">
                <div className="w-full max-w-[800px] bg-white rounded-xl shadow-md border border-slate-200 p-5 sm:p-7 text-slate-900 text-xs font-sans relative">
                  
                  {/* WATERMARK PROFORMA */}
                  {formDocType === 'PROFORMA' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                      <span className="text-[60px] sm:text-[90px] font-black tracking-widest text-slate-300/20 rotate-[-35deg] uppercase border-8 border-dashed border-slate-300/20 px-6 py-2 rounded-3xl">
                        PROFORMA
                      </span>
                    </div>
                  )}

                  <div className="relative z-10 space-y-4">
                    {/* Header Kop Toko & Info Dokumen */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 gap-3">
                      <div className="flex items-start gap-3">
                        <StoreLogo size="md" rounded="rounded-lg" customLogoUrl={storeIdentity.logoUrl} storeName={storeIdentity.storeName} />
                        <div>
                          <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                            {storeIdentity.storeName}
                          </h1>
                          {storeIdentity.tagline && (
                            <p className="text-[10px] font-semibold text-slate-600 mt-0.5">{storeIdentity.tagline}</p>
                          )}
                          <p className="text-[9.5px] text-slate-500 max-w-xs mt-0.5 leading-snug">{storeIdentity.address}</p>
                          <p className="text-[9.5px] text-slate-600 font-medium mt-0.5">
                            Telp/WA: {storeIdentity.phone} {storeIdentity.email ? `• ${storeIdentity.email}` : ''}
                          </p>
                          {storeIdentity.npwp && (
                            <p className="text-[8.5px] text-slate-500 font-semibold">NPWP Toko: {storeIdentity.npwp}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <h2 className={`text-base sm:text-lg font-black tracking-tight leading-tight uppercase ${
                          formDocType === 'PROFORMA' ? 'text-amber-700' : 'text-slate-900'
                        }`}>
                          {formDocType === 'PROFORMA' ? 'PROFORMA INVOICE' : 'INVOICE / FAKTUR'}
                        </h2>
                        <p className="text-xs font-extrabold text-slate-800 mt-0.5">
                          No: {formDocNumber || (formDocType === 'PROFORMA' ? 'PI/BJP/...' : 'INV/BJP/...')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Tanggal Terbit: <strong className="text-slate-800">{formIssueDate}</strong>
                        </p>
                        {formDocType === 'PROFORMA' && formExpiryDate && (
                          <p className="text-[10px] text-amber-800 font-bold mt-0.5">
                            Berlaku Hingga: {formExpiryDate}
                          </p>
                        )}
                        {formDocType === 'COMMERCIAL' && formDueDate && (
                          <p className="text-[10px] text-slate-700 font-semibold mt-0.5">
                            Jatuh Tempo: {formDueDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Kolom Khusus Dibawah Header Invoice: Berdasarkan PO (PI) / Berdasarkan PI (INV) & Keterangan */}
                    {(formSourceProformaNumber || formReferenceDescription) && (
                      <div className="mt-2.5 mb-2 p-2.5 sm:p-3 bg-slate-50/95 rounded-xl border border-slate-300 text-xs text-slate-900 shadow-2xs">
                        <div className="space-y-1 font-sans text-[10px]">
                          <div className="flex items-start gap-1.5">
                            <span className="font-bold text-slate-900 shrink-0">
                              • {formDocType === 'PROFORMA' ? 'Berdasarkan Purchase Order :' : 'Berdasarkan Proforma Invoice :'}
                            </span>
                            <span className="font-black text-indigo-950">
                              {formSourceProformaNumber || '-'}
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <span className="font-bold text-slate-900 shrink-0">
                              • Keterangan :
                            </span>
                            <span className="font-semibold text-slate-800">
                              {formReferenceDescription || '-'}
                            </span>
                          </div>
                        </div>
                        {formContractTotalAmount > 0 && (
                          <div className="mt-1.5 pt-1 border-t border-slate-200 flex justify-between items-center text-[9.5px]">
                            <span className="text-slate-600 font-medium">• Total Nilai Kontrak Induk (100%):</span>
                            <strong className="text-indigo-950 font-black">
                              Rp {formContractTotalAmount.toLocaleString('id-ID')}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Customer & Project Title Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2.5 border-b border-slate-200">
                      <div>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                          Ditagihkan Kepada:
                        </span>
                        <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {formCustomer.name || 'Nama Pelanggan / Perusahaan'}
                        </h3>
                        {formCustomer.pic && (
                          <p className="text-[10px] text-slate-700 mt-0.5">UP/PIC: {formCustomer.pic}</p>
                        )}
                        <p className="text-[9.5px] text-slate-600 mt-0.5 leading-snug">
                          {formCustomer.address || 'Alamat Penagihan Instansi'}
                        </p>
                        <p className="text-[9.5px] text-slate-600 font-medium mt-0.5">
                          Telp/WA: {formCustomer.phone || '-'} {formCustomer.email ? `• ${formCustomer.email}` : ''}
                        </p>
                        {formCustomer.npwp && (
                          <p className="text-[9px] font-semibold text-slate-500 mt-0.5">NPWP: {formCustomer.npwp}</p>
                        )}
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 block">
                          Pekerjaan / Proyek:
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                          {formProjectTitle || 'Belum ada judul pekerjaan'}
                        </h4>
                        <div className="mt-2 pt-1.5 border-t border-slate-200 flex justify-between items-center text-[9.5px]">
                          <span className="text-slate-500">Status Pembayaran:</span>
                          <span className={`px-2 py-0.5 rounded font-extrabold uppercase ${
                            formDocType === 'PROFORMA' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'
                          }`}>
                            {formDocType === 'PROFORMA' ? 'Menunggu DP' : 'Belum Lunas'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Product & Services Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse my-1">
                        <thead>
                          <tr className="border-b-2 border-slate-800 text-[9.5px] font-black text-slate-800 uppercase tracking-wider">
                            <th className="py-1.5 px-1 w-6">No</th>
                            <th className="py-1.5 px-2">Rincian Barang / Jasa</th>
                            <th className="py-1.5 px-1.5 text-center w-12">Qty</th>
                            <th className="py-1.5 px-1.5 text-center w-14">Satuan</th>
                            <th className="py-1.5 px-2 text-right w-20">Harga</th>
                            <th className="py-1.5 px-1 text-center w-12">Disc</th>
                            <th className="py-1.5 px-2 text-right w-24">Jumlah (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-[10px]">
                          {formItems.length === 0 || formItems.every(it => !it.itemName && it.unitPrice === 0) ? (
                            <tr>
                              <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                                Belum ada item ditambahkan. Masukkan barang atau jasa di formulir sebelah kiri.
                              </td>
                            </tr>
                          ) : (
                            formItems.map((it, idx) => (
                              <tr key={it.id || idx}>
                                <td className="py-1.5 px-1 text-slate-400 font-bold">{idx + 1}</td>
                                <td className="py-1.5 px-2">
                                  <span className="font-bold text-slate-900 block">{it.itemName || `Item #${idx + 1}`}</span>
                                  {it.description && (
                                    <span className="text-[9px] text-slate-500 block leading-tight">{it.description}</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-1.5 text-center font-bold">{it.quantity}</td>
                                <td className="py-1.5 px-1.5 text-center text-slate-600">{it.unit}</td>
                                <td className="py-1.5 px-2 text-right font-semibold text-slate-800">
                                  Rp {it.unitPrice.toLocaleString('id-ID')}
                                </td>
                                <td className="py-1.5 px-1 text-center font-medium text-slate-500">
                                  {it.discountPercent ? `${it.discountPercent}%` : '-'}
                                </td>
                                <td className="py-1.5 px-2 text-right font-bold text-slate-900">
                                  Rp {it.totalPrice.toLocaleString('id-ID')}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Financial Summary Calculation & Payment Schedules */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-300">
                      
                      {/* Left: Instruksi Pembayaran (Termin / DP) */}
                      <div className="space-y-2.5">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                            <span className="font-extrabold text-[10px] text-slate-900 uppercase tracking-wider">
                              Instruksi & Rincian Pembayaran:
                            </span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                              {formPaymentScheme === 'TERMIN'
                                ? 'Pembayaran Termin'
                                : formPaymentScheme === 'DP'
                                ? 'Down Payment (DP)'
                                : 'Pelunasan Penuh (100%)'}
                            </span>
                          </div>

                          {/* Tabel Rincian Tahapan Pembayaran (Termin / DP) */}
                          {formPaymentSchedules && formPaymentSchedules.length > 0 && formPaymentScheme !== 'FULL' ? (
                            <div className="space-y-1">
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="w-full text-[9px] text-left">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                      <th className="py-1 px-1.5">Tahap Pembayaran</th>
                                      <th className="py-1 px-1.5 text-right">Nominal (Rp)</th>
                                      <th className="py-1 px-1.5 text-center">Waktu</th>
                                      <th className="py-1 px-1.5 text-center">Status</th>
                                    </tr>
                                  </thead>
                                   <tbody className="divide-y divide-slate-100">
                                    {formPaymentSchedules.map((s, sIdx) => {
                                      let stageStatus = 'Belum';
                                      let badgeStyle = 'text-[8px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded';

                                      if (formDocType === 'COMMERCIAL') {
                                        const refDesc = (formReferenceDescription || '').toLowerCase();
                                        const docNum = (formSourceProformaNumber || '').toUpperCase();
                                        let activeStageIdx = 0;
                                        if (refDesc.includes('termin 1') || docNum.includes('/T1')) activeStageIdx = 0;
                                        else if (refDesc.includes('termin 2') || docNum.includes('/T2')) activeStageIdx = 1;
                                        else if (refDesc.includes('termin 3') || docNum.includes('/T3')) activeStageIdx = 2;
                                        else if (refDesc.includes('termin 4') || docNum.includes('/T4')) activeStageIdx = 3;
                                        else if (refDesc.includes('pelunasan') || docNum.includes('/PELUNASAN')) activeStageIdx = 1;

                                        if (sIdx < activeStageIdx) {
                                          stageStatus = 'Lunas';
                                          badgeStyle = 'text-[8px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded';
                                        } else if (sIdx === activeStageIdx) {
                                          stageStatus = 'Tagihan Ini';
                                          badgeStyle = 'text-[8px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded ring-1 ring-indigo-300';
                                        } else {
                                          stageStatus = 'Belum';
                                          badgeStyle = 'text-[8px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded';
                                        }
                                      }

                                      return (
                                        <tr key={s.id || sIdx} className={stageStatus === 'Tagihan Ini' ? 'bg-indigo-50/70 font-bold' : ''}>
                                          <td className="py-1 px-1.5 text-slate-800">
                                            <div className="font-bold">{s.name} ({formatPercentInput(s.percentage)}%)</div>
                                            {s.notes && <div className="text-[8px] text-slate-500 font-normal leading-tight">{s.notes}</div>}
                                          </td>
                                          <td className="py-1 px-1.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                            Rp {s.amount.toLocaleString('id-ID')}
                                          </td>
                                          <td className="py-1 px-1.5 text-center text-slate-600 whitespace-nowrap">
                                            {s.dueDate || '-'}
                                          </td>
                                          <td className="py-1 px-1.5 text-center">
                                            <span className={badgeStyle}>
                                              {stageStatus}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-slate-50 font-bold border-t border-slate-200 text-[9.5px]">
                                      <td className="py-1 px-1.5 text-slate-800">Total Pembayaran:</td>
                                      <td className="py-1 px-1.5 text-right text-slate-900 font-extrabold whitespace-nowrap">
                                        Rp {calculatedTotals.grandTotal.toLocaleString('id-ID')}
                                      </td>
                                      <td colSpan={2} className="py-1 px-1.5 text-center text-slate-500 font-normal">
                                        {formPaymentSchedules.length} Tahap
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[9.5px] text-slate-600 leading-relaxed">
                              Pelunasan 100% sebesar <strong>Rp {calculatedTotals.grandTotal.toLocaleString('id-ID')}</strong> saat tagihan diterima / serah terima pekerjaan.
                            </p>
                          )}

                          {/* Rekening Pembayaran Resmi */}
                          <div className="pt-1.5 border-t border-slate-200">
                            <span className="text-[9.5px] font-bold text-slate-800 block mb-1">
                              Rekening Pembayaran Resmi:
                            </span>
                            <div className="space-y-1">
                              {(storeIdentity.bankAccounts || []).map(b => (
                                <div key={b.id} className="text-[9px] text-slate-700 bg-white p-1 rounded-lg border border-slate-200 flex justify-between items-center">
                                  <div>
                                    <strong className="text-slate-900">{b.bankName}</strong>: {b.accountNumber}
                                    <span className="text-slate-500 text-[8px] block">a/n {b.accountHolder}</span>
                                  </div>
                                  <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded">Resmi</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Perhitungan Finansial */}
                      <div className="space-y-1 text-[11px] text-slate-700">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-semibold text-slate-800">Rp {calculatedTotals.subtotal.toLocaleString('id-ID')}</span>
                        </div>
                        {calculatedTotals.discountAmount > 0 && (
                          <div className="flex justify-between text-emerald-700">
                            <span>Diskon:</span>
                            <span className="font-semibold">- Rp {calculatedTotals.discountAmount.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Dasar Pengenaan Pajak (DPP):</span>
                          <span className="font-semibold text-slate-800">Rp {calculatedTotals.taxableBase.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>PPN {formApplyTax && calculatedTotals.taxRate > 0 ? `(${calculatedTotals.taxRate}%)` : '(Non-PKP)'}:</span>
                          <span className="font-semibold text-slate-800">
                            {formApplyTax && calculatedTotals.taxRate > 0
                              ? `Rp ${calculatedTotals.taxAmount.toLocaleString('id-ID')}`
                              : 'Rp 0'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm font-extrabold text-slate-900 pt-2 border-t-2 border-slate-900">
                          <span>Total Tagihan (Grand Total):</span>
                          <span className="font-black text-indigo-700">Rp {calculatedTotals.grandTotal.toLocaleString('id-ID')}</span>
                        </div>

                        {formPaymentScheme === 'DP' && formPaymentSchedules[0] && (
                          <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-900">
                            <div className="flex justify-between font-bold">
                              <span>Nilai DP ({formatPercentInput(formPaymentSchedules[0].percentage)}%):</span>
                              <span>Rp {Math.round(formPaymentSchedules[0].amount || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-[9px] text-amber-800 mt-0.5">
                              <span>Sisa Pelunasan:</span>
                              <span>Rp {Math.round(formPaymentSchedules[1]?.amount || 0).toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Catatan Dokumen */}
                    {formNotes && (
                      <div className="pt-2 border-t border-slate-200 text-[9.5px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                        <strong className="text-slate-800 font-bold block mb-0.5">Catatan & Syarat:</strong>
                        <p className="whitespace-pre-line leading-relaxed">{formNotes}</p>
                      </div>
                    )}

                    {/* Tanda Tangan & Stempel Resmi */}
                    <div className="pt-3 border-t border-slate-200 flex justify-between items-end text-[10px]">
                      <div className="text-slate-400 text-[9px]">
                        Dokumen dicetak secara digital oleh sistem POS & Billing.
                      </div>
                      <div className="text-center w-36">
                        <p className="text-slate-600 text-[9.5px]">Hormat Kami,</p>
                        <p className="font-bold text-slate-900 mt-0.5 text-[10px]">{storeIdentity.storeName}</p>
                        <div className="h-10 flex items-center justify-center my-0.5">
                          <span className="text-[8.5px] text-slate-300 italic border border-dashed border-slate-300 rounded px-2 py-0.5">
                            Tanda Tangan & Stempel
                          </span>
                        </div>
                        <p className="text-[9.5px] font-bold text-slate-800 border-t border-slate-400 pt-0.5">
                          Authorized Signature
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW: INVOICES LIST TAB */}
      {/* =================================================================== */}
      {activeSubTab === 'list' && (
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Summary Metric Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Proforma Aktif (PI)</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">{statsSummary.totalPi} Dokumen</span>
              <span className="text-[10px] text-slate-500">Penawaran & Booking DP</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">Invoice Final (INV)</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">{statsSummary.totalInv} Dokumen</span>
              <span className="text-[10px] text-slate-500">Faktur Penjualan Resmi</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Sisa Tagihan (Piutang)</span>
              <span className="text-lg sm:text-xl font-black text-rose-600 mt-0.5 block">
                Rp {statsSummary.totalOutstanding.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-slate-500">Saldo piutang aktif</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Total Terbayar</span>
              <span className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5 block">
                Rp {statsSummary.totalCollected.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-slate-500">Uang masuk bersih (net refund)</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">Batal & Credit Note</span>
              <span className="text-xl sm:text-2xl font-black text-rose-900 mt-0.5 block">
                {statsSummary.totalCancelled} Dokumen
              </span>
              <span className="text-[10px] text-rose-700 font-semibold">
                {statsSummary.totalCreditNotes > 0 ? `${statsSummary.totalCreditNotes} Nota Kredit Diterbitkan` : 'Void / Dibatalkan'}
              </span>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  filterType === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua ({invoices.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('PROFORMA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  filterType === 'PROFORMA' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                Proforma (PI)
              </button>
              <button
                type="button"
                onClick={() => setFilterType('COMMERCIAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  filterType === 'COMMERCIAL' ? 'bg-indigo-600 text-white' : 'text-indigo-800 hover:bg-indigo-50'
                }`}
              >
                Invoice Final (INV)
              </button>

              <div className="h-4 w-px bg-slate-300 mx-1" />

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold bg-slate-50 cursor-pointer"
              >
                <option value="ALL">Status: Semua</option>
                <option value="UNPAID">Belum Bayar</option>
                <option value="PARTIAL">DP / Sebagian</option>
                <option value="PAID">Lunas (Paid)</option>
                <option value="CONVERTED">Terkonversi ke INV</option>
                <option value="CANCELLED">Dibatalkan / Credit Note</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari no. invoice, proyek, pelanggan..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Invoices Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredInvoices.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">Daftar Dokumen Masih Kosong</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Belum ada dokumen. Tekan tombol di bawah untuk membuat baru: PI untuk penawaran, INV untuk tagihan.
                </p>
                <button
                  type="button"
                  onClick={() => { resetForm(); setActiveSubTab('create'); }}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 cursor-pointer"
                >
                  + Buat Invoice Baru Sekarang
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Tipe & No. Dokumen</th>
                      <th className="py-3 px-4">Judul Pekerjaan</th>
                      <th className="py-3 px-4">Pelanggan / Instansi</th>
                      <th className="py-3 px-4">Tgl Terbit</th>
                      <th className="py-3 px-4">Total Tagihan</th>
                      <th className="py-3 px-4">Status & Sisa</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredInvoices.map(inv => {
                      const isPi = inv.documentType === 'PROFORMA';
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                isPi ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                              }`}>
                                {isPi ? 'PROFORMA' : 'INVOICE'}
                              </span>
                              <span className="font-bold text-slate-900">{inv.documentNumber}</span>
                            </div>

                            {/* Relasi Child Invoices pada Proforma Invoice */}
                            {isPi && inv.childInvoiceNumbers && inv.childInvoiceNumbers.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                <span className="text-[10px] text-purple-700 font-bold block">
                                  Terkonversi ({inv.childInvoiceNumbers.length}/{inv.paymentSchedules?.length || 1} Tahap):
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {inv.childInvoiceNumbers.map(cn => (
                                    <span key={cn} className="inline-block text-[10px] text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-semibold">
                                      {cn}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {isPi && inv.convertedInvoiceNumber && (!inv.childInvoiceNumbers || inv.childInvoiceNumbers.length === 0) && (
                              <span className="text-[10px] text-purple-700 font-semibold block mt-0.5">
                                Terkonversi: {inv.convertedInvoiceNumber}
                              </span>
                            )}

                            {/* Relasi Parent Proforma pada Invoice Komersial */}
                            {!isPi && inv.sourceProformaNumber && (
                              <div className="mt-1 p-1 bg-indigo-50/70 border border-indigo-100 rounded text-[10px] text-indigo-900 leading-tight">
                                <span className="font-bold block">Berdasarkan PI: {inv.sourceProformaNumber}</span>
                                {inv.referenceDescription && (
                                  <span className="text-[9.5px] text-indigo-700 block mt-0.2">{inv.referenceDescription}</span>
                                )}
                              </div>
                            )}

                            {/* Info Pembatalan & Credit Note jika Dokumen Dibatalkan */}
                            {inv.status === 'CANCELLED' && (
                              <div className="mt-1.5 p-1.5 bg-rose-50/80 rounded border border-rose-200 text-[10px] leading-tight space-y-0.5">
                                {inv.cancellation?.creditNoteNumber && (
                                  <span className="font-extrabold text-rose-800 block">
                                    Nota Kredit: {inv.cancellation.creditNoteNumber}
                                  </span>
                                )}
                                {inv.cancellation?.taxReturnNumber && (
                                  <span className="text-[9.5px] text-slate-600 font-semibold block">
                                    No. Retur Pajak: {inv.cancellation.taxReturnNumber}
                                  </span>
                                )}
                                {inv.cancellation?.cancellationProofUrl && (
                                  <a
                                    href={inv.cancellation.cancellationProofUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[9.5px] text-indigo-600 hover:underline font-semibold flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Bukti Batal Pelanggan
                                  </a>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[200px] truncate" title={inv.projectTitle}>
                            {inv.projectTitle}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{inv.customer.name}</span>
                            <span className="text-[11px] text-slate-500">{inv.customer.phone}</span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600">
                            {inv.issueDate}
                            {isPi && inv.expiryDate && (
                              <span className="text-[10px] text-amber-700 block">Exp: {inv.expiryDate}</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            Rp {inv.grandTotal.toLocaleString('id-ID')}
                          </td>

                          <td className="py-3.5 px-4">
                            {(() => {
                              const eff = isPi
                                ? getProformaEffectivePaymentInfo(inv, invoices)
                                : {
                                    amountPaid: inv.amountPaid || 0,
                                    balanceDue: inv.balanceDue !== undefined ? inv.balanceDue : Math.max(0, inv.grandTotal - (inv.amountPaid || 0)),
                                    status: inv.status
                                  };

                              return (
                                <div className="space-y-1">
                                  {getStatusBadge(eff.status, inv.documentType)}
                                  {eff.status === 'CANCELLED' ? (
                                    <div>
                                      <span className="text-[10px] text-slate-500 font-bold block">
                                        Sisa: Rp 0 (Piutang Nol)
                                      </span>
                                      {inv.cancellation?.refundAmount !== undefined && inv.cancellation.refundAmount > 0 && (
                                        <span className="text-[9.5px] text-emerald-700 font-semibold block">
                                          Refund: Rp {inv.cancellation.refundAmount.toLocaleString('id-ID')}
                                        </span>
                                      )}
                                    </div>
                                  ) : eff.balanceDue > 0 ? (
                                    <span className="text-[10px] text-rose-600 font-bold block">
                                      Sisa: Rp {eff.balanceDue.toLocaleString('id-ID')}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-emerald-600 font-bold block">
                                      Sisa: Rp 0
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Action: Convert to Final (Mendukung Proforma Bertahap / Multi-Termin) */}
                              {(() => {
                                const scheds = inv.paymentSchedules || [];
                                const childNums = inv.childInvoiceNumbers || [];
                                const isMultiStage = (inv.paymentScheme === 'TERMIN' || inv.paymentScheme === 'DP') && scheds.length > 1;
                                const hasUnbilledStages = isMultiStage && (childNums.length < scheds.length);
                                const canConvert = isPi && inv.status !== 'CANCELLED' && (inv.status !== 'CONVERTED' || hasUnbilledStages);
                                
                                if (!canConvert) return null;

                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenConvertModal(inv)}
                                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 cursor-pointer"
                                    title={childNums.length > 0 ? "Terbitkan invoice tahap termin berikutnya" : "Konversi ke Invoice Final resmi"}
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                    {childNums.length > 0 ? '+ Tagihan Tahap Lanjutan' : 'Konversi ke INV'}
                                  </button>
                                );
                              })()}

                              {/* Action: Record Payment */}
                              {inv.status !== 'PAID' && inv.status !== 'CONVERTED' && inv.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentModal(inv)}
                                  className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-all flex items-center gap-1 cursor-pointer"
                                  title="Catat penerimaan pembayaran DP atau pelunasan"
                                >
                                  <DollarSign className="w-3.5 h-3.5" /> Bayar
                                </button>
                              )}

                              {/* Action: Print / PDF */}
                              <button
                                type="button"
                                onClick={() => handleOpenPrint(inv)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Cetak / Unduh PDF A4 Bersih"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Action: Cetak Nota Kredit (Khusus Invoice yang dibatalkan dengan Credit Note) */}
                              {inv.status === 'CANCELLED' && inv.cancellation?.creditNoteNumber && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCreditNotePrint(inv)}
                                  className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title={`Cetak Nota Kredit (${inv.cancellation.creditNoteNumber})`}
                                >
                                  <Receipt className="w-4 h-4" />
                                </button>
                              )}

                              {/* Action: Batalkan Dokumen (Proforma Void / Invoice Final dengan Credit Note) */}
                              {inv.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCancelModal(inv)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title={isPi ? "Batalkan Proforma Invoice (Void Internal)" : "Batalkan Invoice & Terbitkan Credit Note (Nota Kredit)"}
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}

                              {/* Action: Edit */}
                              {inv.status !== 'CANCELLED' && !(inv.documentType === 'COMMERCIAL' && inv.status === 'PAID') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(inv)}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                                  title="Edit Dokumen"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {/* Action: Delete (Developer & Admin) */}
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInvoice(inv)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="Hapus Dokumen (Developer & Admin)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CONVERT PROFORMA INVOICE TO COMMERCIAL INVOICE */}
      {/* =================================================================== */}
      {isConvertModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ArrowRight className="w-5 h-5 text-indigo-300" />
                <div>
                  <h3 className="text-base font-extrabold">Konversi ke Invoice Final Resmi</h3>
                  <p className="text-xs text-indigo-200">Dari Proforma: {selectedInvoice.documentNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConvertModalOpen(false)}
                className="text-indigo-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-indigo-950">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Alur Konversi Proforma ke Invoice Final (Relasi Data Induk)
                </p>
                <p className="text-[11px] text-indigo-800">
                  Nomor invoice bertambah otomatis mengikuti urutan pembuatan. Kaitannya dengan PI induk ikut tampil di layar dan PDF.
                </p>
              </div>

              {/* Pilihan Tahap Penagihan (Termin / DP / Penuh) */}
              {selectedInvoice.paymentSchedules && selectedInvoice.paymentSchedules.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pilih Tahap Penagihan yang Diterbitkan:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedInvoice.paymentSchedules.map((s, idx) => {
                      const suffix = selectedInvoice.paymentScheme === 'DP' 
                        ? (idx === 0 ? 'DP' : 'PELUNASAN') 
                        : `T${idx + 1}`;
                      const isSelected = conversionStageId === s.id && conversionMode === 'STAGE';
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectConversionStage(s.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{s.name} ({formatPercentInput(s.percentage)}%)</span>
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                              /{suffix}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-900 mt-1">
                            Rp {s.amount.toLocaleString('id-ID')}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Jatuh tempo: {s.dueDate || selectedInvoice.issueDate}
                          </div>
                        </button>
                      );
                    })}

                    {/* Option: Faktur Kontrak Penuh */}
                    <button
                      type="button"
                      onClick={() => handleSelectConversionStage('ALL')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        conversionMode === 'FULL'
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Faktur Kontrak Penuh</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${conversionMode === 'FULL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                          100%
                        </span>
                      </div>
                      <div className={`text-[11px] font-bold mt-1 ${conversionMode === 'FULL' ? 'text-white' : 'text-slate-900'}`}>
                        Rp {selectedInvoice.grandTotal.toLocaleString('id-ID')}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${conversionMode === 'FULL' ? 'text-slate-300' : 'text-slate-500'}`}>
                        Pelunasan Penuh Seluruh Item
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Nomor Invoice Global & Reference Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Invoice Resmi (Running Number Global):
                </label>
                <input
                  type="text"
                  required
                  value={conversionNumber}
                  onChange={e => setConversionNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-indigo-300 text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="INV/BJP/2026/10/0145/T1"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Nomor sequence global berjalan maju kronologis untuk audit akuntansi.
                </span>
              </div>

              {/* Kolom Khusus: Keterangan Relasi ke PI Induk */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Berdasarkan Proforma Invoice (Parent ID):
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {selectedInvoice.documentNumber}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Keterangan Penagihan (Akan Muncul di UI & PDF):
                  </label>
                  <input
                    type="text"
                    required
                    value={conversionReferenceDesc}
                    onChange={e => setConversionReferenceDesc(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-hidden"
                    placeholder="Pembayaran Termin 1 (40%) dari Total Kontrak"
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200 text-slate-600">
                  <span>Total Nilai Kontrak Induk:</span>
                  <span className="font-bold text-slate-900">Rp {selectedInvoice.grandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Jatuh Tempo Penagihan *</label>
                <input
                  type="date"
                  required
                  value={conversionDueDate}
                  onChange={e => setConversionDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteConversion}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-700 transition-all cursor-pointer"
                >
                  Konfirmasi & Terbitkan Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: RECORD PAYMENT (DP / SETTLEMENT) */}
      {/* =================================================================== */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-extrabold">Catat Pembayaran</h3>
                  <p className="text-xs text-slate-400">Dokumen: {selectedInvoice.documentNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayType('DOWN_PAYMENT')}
                  className={`py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                    payType === 'DOWN_PAYMENT'
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  Down Payment (DP)
                </button>
                <button
                  type="button"
                  onClick={() => setPayType('SETTLEMENT')}
                  className={`py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                    payType === 'SETTLEMENT'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  Pelunasan Akhir
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nominal Pembayaran (Rp) *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedInvoice.balanceDue}
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base font-extrabold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Sisa Tagihan:</span>
                  <span className="font-bold text-rose-600">Rp {selectedInvoice.balanceDue.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Metode Pembayaran</label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="TRANSFER">Transfer Bank</option>
                    <option value="CASH">Tunai (Cash)</option>
                    <option value="QRIS">QRIS Statis/Dinamis</option>
                    <option value="GIRO">Bilyet Giro / Cek</option>
                    <option value="EDC">Debit / Kartu Kredit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">No. Bukti / Referensi</label>
                  <input
                    type="text"
                    value={payRefNumber}
                    onChange={e => setPayRefNumber(e.target.value)}
                    placeholder="TRF-BCA-998822"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Pembayaran</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="DP 50% via Bank BCA..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecutePayment}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  Simpan Pembayaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CANCELLATION (PEMBATALAN DOKUMEN & PENERBITAN CREDIT NOTE) */}
      {/* =================================================================== */}
      {isCancelModalOpen && cancellingInvoice && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95">
            {/* Header Modal */}
            <div className={`p-4 sm:p-5 flex items-center justify-between text-white ${
              cancellingInvoice.documentType === 'PROFORMA' ? 'bg-amber-900' : 'bg-rose-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  {cancellingInvoice.documentType === 'PROFORMA' ? (
                    <Ban className="w-5 h-5 text-amber-300" />
                  ) : (
                    <Receipt className="w-5 h-5 text-rose-300" />
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight">
                    {cancellingInvoice.documentType === 'PROFORMA'
                      ? 'Pembatalan Proforma Invoice (Void Internal)'
                      : 'Pembatalan Invoice Final & Penerbitan Credit Note'}
                  </h3>
                  <p className="text-xs text-white/80">
                    Dokumen No: {cancellingInvoice.documentNumber} • {cancellingInvoice.projectTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsCancelModalOpen(false); setCancellingInvoice(null); }}
                className="text-white/70 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 max-h-[78vh] overflow-y-auto space-y-5">
              {/* Callout Penjelasan Akuntansi Sesuai Ketentuan */}
              {cancellingInvoice.documentType === 'PROFORMA' ? (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <ShieldCheck className="w-4 h-4 text-amber-700" /> Mekanisme Pembatalan Proforma Invoice (PI):
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-900/90">
                    Proforma Invoice adalah penawaran awal sekaligus perkiraan tagihan, bukan faktur pajak resmi. Cukup ubah status jadi <strong>Cancelled / Void</strong>, tanpa tindakan hukum atau nota retur; sisa piutang otomatis Rp 0.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <Receipt className="w-4 h-4 text-rose-700" /> Mekanisme Pembatalan Invoice Final (INV) & Credit Note:
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-900/90">
                    Invoice Final adalah tagihan resmi yang sudah dicatat sebagai piutang. Pembatalannya wajib menerbitkan <strong>Credit Note (Nota Kredit)</strong> untuk mengurangi piutang sampai saldo pelanggan <strong>Rp 0</strong>.
                  </p>
                </div>
              )}

              {/* 1. Kategori & Alasan Pembatalan (Force Majeure vs Sepihak vs Kesepakatan) */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Alasan & Bukti Pembatalan Transaksi *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'FORCE_MAJEURE', label: 'Force Majeure (Bencana Alam)', desc: 'Pasal 1244 & 1245 KUHPerdata, bebas ganti rugi' },
                    { id: 'BREACH_OF_CONTRACT', label: 'Pembatalan Sepihak Pelanggan', desc: 'Breach of contract / Denda pembatalan berlaku' },
                    { id: 'MUTUAL_AGREEMENT', label: 'Kesepakatan Bersama', desc: 'Disetujui kedua belah pihak secara kekeluargaan' },
                    { id: 'OTHER', label: 'Lainnya / Revisi Total', desc: 'Kebutuhan proyek atau spek berubah' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleReasonCategoryChange(cat.id as CancellationReasonType)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        cancelReasonCategory === cat.id
                          ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600 text-indigo-950'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <span className="font-bold text-xs block">{cat.label}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{cat.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Banner Penjelasan Khusus Sesuai Regulasi */}
                {cancelReasonCategory === 'FORCE_MAJEURE' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                    <strong>Ketentuan Khusus Force Majeure:</strong> Sesuai Pasal 1244 & 1245 KUHPerdata di Indonesia, jika terjadi bencana alam, perang, atau regulasi yang membuat transaksi mustahil dilakukan, kedua belah pihak dibebaskan dari tuntutan ganti rugi. Dana dikembalikan penuh (atau dikurangi biaya riil yang sudah dikeluarkan untuk persiapan) secara kekeluargaan.
                  </div>
                )}

                {cancelReasonCategory === 'BREACH_OF_CONTRACT' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                    <strong>Ketentuan Pembatalan Sepihak (Breach of Contract):</strong> Jika pembatalan sepihak tanpa alasan sah, perusahaan (toko) berhak menahan Uang Muka (Down Payment) atau mengenakan Denda Pembatalan (Cancellation Fee) sebelum menerbitkan Credit Note dan melakukan sisa refund.
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Rincian Keterangan / Alasan Pembatalan *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={cancelReasonDetails}
                    onChange={e => setCancelReasonDetails(e.target.value)}
                    placeholder="Tuliskan keterangan detail alasan pembatalan dokumen transaksi..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Link Arsip Bukti Pembatalan (Surat / Email Pelanggan)
                  </label>
                  <input
                    type="url"
                    value={cancelProofUrl}
                    onChange={e => setCancelProofUrl(e.target.value)}
                    placeholder="https://drive.google.com/... (Link Drive bukti pernyataan pembatalan pelanggan)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Isi tautan Drive surat atau email pembatalan dari pelanggan sebagai bukti transaksi tidak dilanjutkan.
                  </span>
                </div>
              </div>

              {/* 2. Khusus Invoice Final (INV): Credit Note & Pajak */}
              {cancellingInvoice.documentType === 'COMMERCIAL' && (
                <div className="space-y-4 pt-3 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Penerbitan Credit Note (Nota Kredit) & Status Pajak
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Nomor Nota Kredit (CN)</label>
                      <input
                        type="text"
                        required
                        value={cancelCreditNoteNumber}
                        onChange={e => setCancelCreditNoteNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-rose-700 bg-rose-50/50"
                        placeholder="CN/BJP/2026/10/0001"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Tanggal Penerbitan CN</label>
                      <input
                        type="date"
                        required
                        value={cancelCreditNoteDate}
                        onChange={e => setCancelCreditNoteDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Peringatan e-Faktur Pajak jika ada PPN */}
                  {cancellingInvoice.taxAmount > 0 && (
                    <div className="p-3.5 bg-rose-100/70 border border-rose-300 rounded-xl text-xs text-rose-950 space-y-2">
                      <div className="font-extrabold flex items-center gap-2 text-rose-900">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        Pemberitahuan Wajib Pajak (e-Faktur PPN):
                      </div>
                      <p className="text-[11px] leading-relaxed font-semibold">
                        “Wajib melakukan Pembatalan Faktur Pajak melalui aplikasi e-Faktur Pajak resmi pemerintah agar Perusahaan tidak terutang PPN atas transaksi yang batal.”
                      </p>
                      <div className="pt-2 border-t border-rose-200">
                        <label className="block text-[11px] font-bold text-slate-900 mb-1">
                          Nomor Nota Retur atau Nota Pembatalan dari Pelanggan:
                        </label>
                        <input
                          type="text"
                          value={cancelTaxReturnNumber}
                          onChange={e => setCancelTaxReturnNumber(e.target.value)}
                          placeholder="Nomor Nota Retur / Nota Pembatalan Resmi dari Pelanggan"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                        />
                        <span className="text-[10px] text-slate-600 mt-0.5 block">
                          Jika barang atau jasa sempat diserahkan, pelanggan menerbitkan Nota Retur atau Nota Pembatalan resmi. PPN yang sudah dibayar bisa disesuaikan di laporan pajak kedua pihak.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Khusus Jika Pelanggan Sudah Bayar (Refund Kas / Denda) */}
              {(cancellingPaidAmount || 0) > 0 && (
                <div className="space-y-4 pt-3 border-t border-slate-200 bg-amber-50/50 p-4 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                      3. Proses Pengembalian Dana (Refund)
                    </label>
                    <span className="text-xs font-bold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-md">
                      Dana Diterima: Rp {(cancellingPaidAmount || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Potongan Biaya Administrasi / Denda Pembatalan (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={cancellingPaidAmount || 0}
                        value={cancelCancellationFee}
                        onChange={e => handleCancellationFeeChange(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-rose-700"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Dikenakan jika pembatalan sepihak (breach of contract) atau biaya riil persiapan.
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nominal Dana yang Dikembalikan ke Pelanggan (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={cancellingPaidAmount || 0}
                        value={cancelRefundAmount}
                        onChange={e => handleCancellationRefundChange(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-emerald-700 bg-emerald-50/60"
                      />
                      <span className="text-[10px] text-emerald-700 font-bold mt-0.5 block">
                        Total refund riil yang dibayarkan kembali kepada pelanggan.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Metode Refund</label>
                      <select
                        value={cancelRefundMethod}
                        onChange={e => setCancelRefundMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium bg-white"
                      >
                        <option value="TRANSFER">Transfer Rekening Bank</option>
                        <option value="CASH">Tunai / Kasir Toko</option>
                        <option value="GIRO">Bilyet Giro / Cek</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Rekening Tujuan Refund Pelanggan</label>
                      <input
                        type="text"
                        value={cancelRefundBankTarget}
                        onChange={e => setCancelRefundBankTarget(e.target.value)}
                        placeholder="e.g. BCA 12345678 a/n Pelanggan"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Tanggal Eksekusi Refund</label>
                      <input
                        type="date"
                        value={cancelRefundDate}
                        onChange={e => setCancelRefundDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Link Bukti Transfer Refund</label>
                      <input
                        type="url"
                        value={cancelRefundProofUrl}
                        onChange={e => setCancelRefundProofUrl(e.target.value)}
                        placeholder="https://drive.google.com/... (Bukti Transfer)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => { setIsCancelModalOpen(false); setCancellingInvoice(null); }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleExecuteCancellation}
                className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                  cancellingInvoice.documentType === 'PROFORMA'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {cancellingInvoice.documentType === 'PROFORMA'
                  ? 'Konfirmasi Batalkan PI (Void)'
                  : 'Batalkan & Terbitkan Credit Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: PRINT PREVIEW & PDF A4 / F4 CLEAN DOCUMENT */}
      {/* =================================================================== */}
      {isPrintModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          {/* Dynamic Print CSS for custom Page Size (A4 / F4) and Orientation (Portrait / Landscape) */}
          <style>{`
            @media print {
              @page {
                size: ${paperSize === 'f4' ? '215mm 330mm' : 'A4'} ${paperOrientation};
                margin: 8mm 10mm;
              }
              html, body {
                width: ${paperOrientation === 'landscape' ? (paperSize === 'f4' ? '330mm' : '297mm') : (paperSize === 'f4' ? '215mm' : '210mm')} !important;
                height: auto !important;
                overflow: visible !important;
                background: #ffffff !important;
              }
              #root {
                position: static !important;
                width: 100% !important;
                overflow: visible !important;
              }
              #invoice-print-clean {
                position: relative !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
              }
            }
          `}</style>

          <div className="bg-white rounded-2xl max-w-6xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[96vh] overflow-hidden animate-in fade-in">
            {/* Modal Control Header (Hidden in Print) */}
            <div className="print:hidden bg-slate-900 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <Printer className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-extrabold flex items-center gap-2">
                    <span>Pratinjau Cetak & Unduh PDF</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-bold uppercase">
                      {paperSize.toUpperCase()} • {paperOrientation === 'portrait' ? 'Vertikal' : 'Horizontal'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedInvoice.documentType === 'PROFORMA' ? 'Proforma Invoice' : 'Invoice Komersial Final'} — {selectedInvoice.documentNumber}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Mode & Ukuran Kertas: A4, F4, Thermal */}
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                  <span className="text-[10px] text-slate-400 font-bold px-1.5 hidden sm:inline">Kertas:</span>
                  <button
                    type="button"
                    onClick={() => { setPrintMode('a4'); setPaperSize('a4'); }}
                    className={`px-2.5 py-1 rounded font-bold transition-all ${printMode === 'a4' && paperSize === 'a4' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPrintMode('a4'); setPaperSize('f4'); }}
                    className={`px-2.5 py-1 rounded font-bold transition-all ${printMode === 'a4' && paperSize === 'f4' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
                  >
                    F4 (Folio)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('thermal')}
                    className={`px-2 py-1 rounded font-bold transition-all ${printMode === 'thermal' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Struk
                  </button>
                </div>

                {/* Orientasi Kertas: Vertikal (Portrait) & Horizontal (Landscape) */}
                {printMode === 'a4' && (
                  <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                    <span className="text-[10px] text-slate-400 font-bold px-1.5 hidden sm:inline">Orientasi:</span>
                    <button
                      type="button"
                      onClick={() => setPaperOrientation('portrait')}
                      className={`px-2.5 py-1 rounded font-bold transition-all ${paperOrientation === 'portrait' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
                      title="Format Vertikal (Portrait)"
                    >
                      Vertikal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperOrientation('landscape')}
                      className={`px-2.5 py-1 rounded font-bold transition-all ${paperOrientation === 'landscape' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
                      title="Format Horizontal (Landscape)"
                    >
                      Horizontal
                    </button>
                  </div>
                )}

                {/* Mode Pilihan Dokumen: Faktur vs Nota Kredit (jika dibatalkan dengan Credit Note) */}
                {selectedInvoice.cancellation?.creditNoteNumber && (
                  <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setPrintDocType('invoice')}
                      className={`px-2.5 py-1 rounded font-bold transition-all ${printDocType === 'invoice' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
                    >
                      Faktur Asli
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintDocType('credit_note')}
                      className={`px-2.5 py-1 rounded font-bold transition-all ${printDocType === 'credit_note' ? 'bg-rose-600 text-white' : 'text-slate-300 hover:text-white'}`}
                    >
                      Nota Kredit (CN)
                    </button>
                  </div>
                )}

                {printMode === 'a4' && (
                  <button
                    type="button"
                    onClick={handleDownloadInvoicePdf}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title={`Unduh file PDF ${paperSize.toUpperCase()} ${paperOrientation === 'portrait' ? 'vertikal' : 'horizontal'}`}
                  >
                    <Download className="w-4 h-4" /> Unduh PDF
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExecutePrint}
                  className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title={printMode === 'thermal' ? 'Cetak struk thermal' : 'Buka dialog cetak browser'}
                >
                  <Printer className="w-4 h-4" /> {printMode === 'thermal' ? 'Cetak Struk' : 'Cetak'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Container */}
            <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100 flex justify-center">
              {/* ============================================================= */}
              {/* FORMAT 1: A4 / F4 CLEAN PRINT-READY DOCUMENT */}
              {/* ============================================================= */}
              {printMode === 'a4' && (
                <div
                  ref={printAreaRef}
                  id="invoice-print-clean"
                  style={{
                    width: paperOrientation === 'landscape'
                      ? (paperSize === 'f4' ? '330mm' : '297mm')
                      : (paperSize === 'f4' ? '215mm' : '210mm'),
                    minHeight: paperOrientation === 'landscape'
                      ? (paperSize === 'f4' ? '215mm' : '210mm')
                      : (paperSize === 'f4' ? '330mm' : '297mm'),
                  }}
                  className="relative bg-white p-8 sm:p-12 shadow-md border border-slate-200 text-slate-900 text-xs font-sans print:border-none print:shadow-none print:p-0 print:m-0 mx-auto transition-all"
                >
                  {/* WATERMARK PROFORMA (KHUSUS PROFORMA INVOICE) / VOID / CREDIT NOTE */}
                  {printDocType === 'credit_note' ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                      <span className="text-[70px] sm:text-[110px] font-black tracking-widest text-rose-300/20 rotate-[-35deg] uppercase border-8 border-dashed border-rose-300/20 px-8 py-2 rounded-3xl">
                        CREDIT NOTE
                      </span>
                    </div>
                  ) : selectedInvoice.status === 'CANCELLED' ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                      <span className="text-[80px] sm:text-[120px] font-black tracking-widest text-rose-300/20 rotate-[-35deg] uppercase border-8 border-dashed border-rose-300/20 px-8 py-2 rounded-3xl">
                        DIBATALKAN / VOID
                      </span>
                    </div>
                  ) : selectedInvoice.documentType === 'PROFORMA' ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                      <span className="text-[90px] sm:text-[130px] font-black tracking-widest text-slate-300/25 rotate-[-35deg] uppercase border-8 border-dashed border-slate-300/20 px-8 py-2 rounded-3xl">
                        PROFORMA
                      </span>
                    </div>
                  ) : null}

                  <div className="relative z-10">
                    {/* Header Kop Toko & Document Title */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                      <div className="flex items-start gap-4">
                        <StoreLogo size="lg" rounded="rounded-xl" customLogoUrl={storeIdentity.logoUrl} storeName={storeIdentity.storeName} />
                        <div>
                          <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">
                            {storeIdentity.storeName}
                          </h1>
                          {storeIdentity.tagline && (
                            <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{storeIdentity.tagline}</p>
                          )}
                          <p className="text-[10px] text-slate-500 max-w-sm mt-1 leading-snug">{storeIdentity.address}</p>
                          <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                            Telp/WA: {storeIdentity.phone} {storeIdentity.email ? `• ${storeIdentity.email}` : ''}
                          </p>
                          {storeIdentity.npwp && (
                            <p className="text-[9px] text-slate-500 font-semibold">NPWP Toko: {storeIdentity.npwp}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <h2 className={`text-xl sm:text-2xl font-black tracking-tight leading-tight uppercase ${
                          printDocType === 'credit_note'
                            ? 'text-rose-700'
                            : selectedInvoice.documentType === 'PROFORMA'
                            ? 'text-amber-700'
                            : selectedInvoice.status === 'CANCELLED'
                            ? 'text-rose-700'
                            : 'text-slate-900'
                        }`}>
                          {printDocType === 'credit_note'
                            ? 'NOTA KREDIT (CREDIT NOTE)'
                            : selectedInvoice.status === 'CANCELLED'
                            ? (selectedInvoice.documentType === 'PROFORMA' ? 'PROFORMA INVOICE (VOID)' : 'INVOICE (DIBATALKAN)')
                            : selectedInvoice.documentType === 'PROFORMA'
                            ? 'PROFORMA INVOICE'
                            : 'INVOICE / FAKTUR'}
                        </h2>
                        <p className="text-xs font-extrabold text-slate-800 mt-1">
                          {printDocType === 'credit_note'
                            ? `No: ${selectedInvoice.cancellation?.creditNoteNumber || selectedInvoice.documentNumber}`
                            : `No: ${selectedInvoice.documentNumber}`}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Tanggal Terbit: <strong className="text-slate-800">
                            {printDocType === 'credit_note'
                              ? (selectedInvoice.cancellation?.creditNoteDate || selectedInvoice.issueDate)
                              : selectedInvoice.issueDate}
                          </strong>
                        </p>
                        {printDocType === 'credit_note' && (
                          <p className="text-[10px] text-rose-700 font-bold mt-0.5">
                            Mengacu Faktur: {selectedInvoice.documentNumber}
                          </p>
                        )}
                        {printDocType !== 'credit_note' && selectedInvoice.documentType === 'PROFORMA' && selectedInvoice.expiryDate && (
                          <p className="text-[10px] text-amber-800 font-bold mt-0.5">
                            Berlaku Hingga: {selectedInvoice.expiryDate}
                          </p>
                        )}
                        {printDocType !== 'credit_note' && selectedInvoice.documentType === 'COMMERCIAL' && selectedInvoice.dueDate && (
                          <p className="text-[10px] text-slate-700 font-semibold mt-0.5">
                            Jatuh Tempo: {selectedInvoice.dueDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Kolom Khusus: Berdasarkan PO (Proforma Invoice) / Berdasarkan PI (Invoice Final) & Keterangan */}
                    {(selectedInvoice.sourceProformaNumber || selectedInvoice.referenceDescription) && (
                      <div className="mt-4 mb-3 p-3.5 sm:p-4 bg-slate-50/95 rounded-xl border border-slate-300 text-xs text-slate-900 shadow-2xs">
                        <div className="space-y-1.5 text-xs font-sans">
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-slate-900 min-w-[210px] shrink-0">
                              • {selectedInvoice.documentType === 'PROFORMA' ? 'Berdasarkan Purchase Order :' : 'Berdasarkan Proforma Invoice :'}
                            </span>
                            <span className="font-black text-indigo-950 text-xs">
                              {selectedInvoice.sourceProformaNumber || '-'}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-slate-900 min-w-[210px] shrink-0">
                              • Keterangan :
                            </span>
                            <span className="font-semibold text-slate-800 text-xs">
                              {selectedInvoice.referenceDescription || (selectedInvoice.terminStageName ? `Pembayaran ${selectedInvoice.terminStageName} (${formatPercentInput(selectedInvoice.terminPercentage || 0)}%) dari Total Kontrak` : '-')}
                            </span>
                          </div>
                        </div>
                        {selectedInvoice.contractTotalAmount && selectedInvoice.contractTotalAmount > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200 flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 font-medium">• Total Nilai Kontrak Proforma (100%):</span>
                            <strong className="text-indigo-950 font-black">
                              Rp {selectedInvoice.contractTotalAmount.toLocaleString('id-ID')}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Customer & Project Title Banner */}
                    <div className="grid grid-cols-2 gap-6 my-4 py-3 border-b border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Ditagihkan Kepada:
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900">{selectedInvoice.customer.name}</h3>
                        {selectedInvoice.customer.pic && (
                          <p className="text-[11px] text-slate-700 mt-0.5">UP/PIC: {selectedInvoice.customer.pic}</p>
                        )}
                        <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{selectedInvoice.customer.address}</p>
                        <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                          Telp/WA: {selectedInvoice.customer.phone} {selectedInvoice.customer.email ? `• ${selectedInvoice.customer.email}` : ''}
                        </p>
                        {selectedInvoice.customer.npwp && (
                          <p className="text-[9.5px] font-semibold text-slate-500 mt-0.5">NPWP: {selectedInvoice.customer.npwp}</p>
                        )}
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Pekerjaan / Proyek:
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 mt-1 leading-snug">
                          {selectedInvoice.projectTitle}
                        </h4>
                        <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">Status Dokumen:</span>
                          <strong className="uppercase font-bold text-slate-800">
                            {selectedInvoice.status === 'CANCELLED'
                              ? 'Dibatalkan (Void / Credit Note)'
                              : selectedInvoice.status === 'PAID'
                              ? 'Lunas (Paid)'
                              : selectedInvoice.status === 'PARTIAL'
                              ? 'DP Terbayar (Partial)'
                              : 'Belum Lunas'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Banner Keterangan Khusus Pembatalan / Nota Kredit */}
                    {selectedInvoice.cancellation && (
                      <div className="mb-4 p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-950">
                        <div className="flex items-center justify-between pb-1 border-b border-rose-200/80 font-bold">
                          <span className="flex items-center gap-1.5 text-rose-900">
                            <Receipt className="w-4 h-4 text-rose-600" />
                            {printDocType === 'credit_note' ? 'RINCIAN NOTA KREDIT (PEMBALIK PIUTANG)' : 'DOKUMEN DIBATALKAN'}
                          </span>
                          <span className="text-[10px] text-rose-700 font-semibold">
                            Dibatalkan oleh: {selectedInvoice.cancellation.cancelledBy}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-0.5">
                          <div>
                            <span className="font-semibold text-slate-700">Kategori Alasan:</span>{' '}
                            <strong>
                              {selectedInvoice.cancellation.reasonCategory === 'FORCE_MAJEURE'
                                ? 'Force Majeure (Bencana Alam / Regulasi - Bebas Ganti Rugi)'
                                : selectedInvoice.cancellation.reasonCategory === 'BREACH_OF_CONTRACT'
                                ? 'Pembatalan Sepihak (Breach of Contract)'
                                : selectedInvoice.cancellation.reasonCategory === 'MUTUAL_AGREEMENT'
                                ? 'Kesepakatan Bersama'
                                : 'Lainnya'}
                            </strong>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">Keterangan:</span>{' '}
                            <span>{selectedInvoice.cancellation.reasonDetails}</span>
                          </div>
                          {selectedInvoice.cancellation.creditNoteNumber && (
                            <div>
                              <span className="font-semibold text-slate-700">Nomor Nota Kredit:</span>{' '}
                              <strong className="text-rose-800">{selectedInvoice.cancellation.creditNoteNumber}</strong>
                            </div>
                          )}
                          {selectedInvoice.cancellation.taxReturnNumber && (
                            <div>
                              <span className="font-semibold text-slate-700">No. Nota Retur / Pembatalan Pajak:</span>{' '}
                              <strong className="text-slate-900">{selectedInvoice.cancellation.taxReturnNumber}</strong>
                            </div>
                          )}
                          {selectedInvoice.cancellation.refundRequired && (
                            <div className="col-span-full pt-1 border-t border-rose-200/60 flex flex-wrap gap-4 text-[10px]">
                              <span>Dana Diterima: <strong>Rp {(selectedInvoice.cancellation.originalPaidAmount || 0).toLocaleString('id-ID')}</strong></span>
                              <span>Denda / Biaya: <strong className="text-rose-700">Rp {(selectedInvoice.cancellation.cancellationFee || 0).toLocaleString('id-ID')}</strong></span>
                              <span>Dana Refund: <strong className="text-emerald-700 font-bold">Rp {(selectedInvoice.cancellation.refundAmount || 0).toLocaleString('id-ID')}</strong></span>
                              <span>Metode: <strong>{selectedInvoice.cancellation.refundMethod} ({selectedInvoice.cancellation.refundBankTarget || '-'})</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Product & Services Table */}
                    <table className="w-full text-left border-collapse my-4">
                      <thead>
                        <tr className="border-b-2 border-slate-800 text-[10px] font-black text-slate-800 uppercase tracking-wider">
                          <th className="py-2 px-1 w-8">No</th>
                          <th className="py-2 px-2">Rincian Barang / Jasa</th>
                          <th className="py-2 px-2 text-center w-16">Qty</th>
                          <th className="py-2 px-2 text-center w-16">Satuan</th>
                          <th className="py-2 px-2 text-right w-24">Harga</th>
                          <th className="py-2 px-2 text-center w-16">Disc</th>
                          <th className="py-2 px-2 text-right w-28">Jumlah (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        {selectedInvoice.items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td className="py-2 px-1 text-slate-400 font-bold">{idx + 1}</td>
                            <td className="py-2 px-2">
                              <span className="font-bold text-slate-900 block">{it.itemName}</span>
                              {it.description && (
                                <span className="text-[10px] text-slate-500 block leading-tight">{it.description}</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center font-bold">{it.quantity}</td>
                            <td className="py-2 px-2 text-center text-slate-600">{it.unit}</td>
                            <td className="py-2 px-2 text-right font-semibold text-slate-800">
                              Rp {it.unitPrice.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2 text-center font-medium text-slate-500">
                              {it.discountPercent ? `${it.discountPercent}%` : '-'}
                            </td>
                            <td className="py-2 px-2 text-right font-bold text-slate-900">
                              Rp {it.totalPrice.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Financial Summary Calculation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-300">
                      {/* Left: Instruksi Pembayaran & Rincian Jadwal Termin / DP */}
                      <div className="space-y-3">
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                            <span className="font-extrabold text-[11px] text-slate-900 uppercase tracking-wider">
                              Instruksi & Rincian Pembayaran:
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                              {selectedInvoice.paymentScheme === 'TERMIN'
                                ? 'Metode Termin (Bertahap)'
                                : selectedInvoice.paymentScheme === 'DP'
                                ? 'Metode Down Payment (DP)'
                                : 'Pelunasan Penuh (100%)'}
                            </span>
                          </div>

                          {/* Tabel Rincian Tahapan Pembayaran (Termin / DP) */}
                          {selectedInvoice.paymentSchedules && selectedInvoice.paymentSchedules.length > 0 ? (
                            <div className="space-y-1">
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="w-full text-[10px] text-left">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                      <th className="py-1.5 px-2">Tahap Pembayaran</th>
                                      <th className="py-1.5 px-2 text-right">Nominal (Rp)</th>
                                      <th className="py-1.5 px-2 text-center">Waktu Pembayaran</th>
                                      <th className="py-1.5 px-2 text-center">Status</th>
                                    </tr>
                                  </thead>
                                   <tbody className="divide-y divide-slate-100">
                                    {selectedInvoice.paymentSchedules.map((s, sIdx) => {
                                      const stageInfo = getTerminStageDisplayInfo(selectedInvoice, s, sIdx, invoices);
                                      return (
                                        <tr key={s.id || sIdx} className={stageInfo.isCurrent ? 'bg-indigo-50/80 font-bold' : ''}>
                                          <td className="py-1.5 px-2 text-slate-800">
                                            <div className="font-bold">{s.name} ({formatPercentInput(s.percentage)}%)</div>
                                            {s.notes && <div className="text-[9px] text-slate-500 font-normal leading-tight">{s.notes}</div>}
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                                            Rp {s.amount.toLocaleString('id-ID')}
                                          </td>
                                          <td className="py-1.5 px-2 text-center text-slate-600 whitespace-nowrap">
                                            {s.dueDate || '-'}
                                          </td>
                                          <td className="py-1.5 px-2 text-center">
                                            <span className={`text-[8.5px] px-2 py-0.5 rounded ${stageInfo.badgeClass}`}>
                                              {stageInfo.status}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-slate-50 font-bold border-t border-slate-200 text-[10px]">
                                      <td className="py-1.5 px-2 text-slate-800">Total Pembayaran (100%):</td>
                                      <td className="py-1.5 px-2 text-right text-slate-900 font-extrabold whitespace-nowrap">
                                        Rp {(selectedInvoice.contractTotalAmount || selectedInvoice.grandTotal).toLocaleString('id-ID')}
                                      </td>
                                      <td colSpan={2} className="py-1.5 px-2 text-center text-slate-500 font-normal">
                                        {selectedInvoice.paymentSchedules.length} Tahap
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-600 leading-relaxed">
                              Pelunasan 100% sebesar <strong>Rp {selectedInvoice.grandTotal.toLocaleString('id-ID')}</strong> saat tagihan diterima / serah terima pekerjaan.
                            </p>
                          )}

                          {/* Riwayat Rekonsiliasi Pembayaran jika ada */}
                          {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                            <div className="pt-2 border-t border-slate-200 text-[10px]">
                              <span className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                Riwayat Rekonsiliasi Pembayaran:
                              </span>
                              <div className="space-y-0.5">
                                {selectedInvoice.payments.map((p, pIdx) => (
                                  <div key={p.id || pIdx} className="flex justify-between text-slate-600">
                                    <span>
                                      {p.paymentDate} • {p.paymentType === 'DOWN_PAYMENT' ? 'DP' : 'Pelunasan'} ({p.paymentMethod})
                                      {p.referenceNumber ? ` [${p.referenceNumber}]` : ''}
                                    </span>
                                    <strong className="text-emerald-700 font-bold">Rp {p.amount.toLocaleString('id-ID')}</strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Rekening Pembayaran Resmi */}
                          <div className="pt-2 border-t border-slate-200">
                            <span className="text-[10px] font-bold text-slate-800 block mb-1">
                              Rekening Pembayaran Resmi:
                            </span>
                            <div className="space-y-1">
                              {(storeIdentity.bankAccounts && storeIdentity.bankAccounts.length > 0
                                ? storeIdentity.bankAccounts
                                : selectedInvoice.bankAccounts || []
                              ).map(b => (
                                <div key={b.id} className="text-[10px] text-slate-700 bg-white p-1.5 rounded-lg border border-slate-200 flex justify-between items-center">
                                  <div>
                                    <strong className="text-slate-900">{b.bankName}</strong>: {b.accountNumber}
                                    <span className="text-slate-500 text-[9px] block">a/n {b.accountHolder}</span>
                                  </div>
                                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Resmi</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Calculations */}
                      <div className="space-y-1.5 text-xs text-slate-700">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-semibold text-slate-800">Rp {selectedInvoice.subtotal.toLocaleString('id-ID')}</span>
                        </div>
                        {selectedInvoice.discountAmount > 0 && (
                          <div className="flex justify-between text-emerald-700">
                            <span>Diskon:</span>
                            <span className="font-semibold">- Rp {selectedInvoice.discountAmount.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Dasar Pengenaan Pajak (DPP):</span>
                          <span className="font-semibold text-slate-800">Rp {selectedInvoice.taxableBase.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>PPN {selectedInvoice.taxRate > 0 ? `(${selectedInvoice.taxRate}%)` : '(Non-PKP)'}:</span>
                          <span className="font-semibold text-slate-800">
                            {selectedInvoice.taxRate > 0
                              ? `Rp ${selectedInvoice.taxAmount.toLocaleString('id-ID')}`
                              : 'Rp 0'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-800">
                          <span>TOTAL TAGIHAN:</span>
                          <span className="text-slate-900 font-extrabold">Rp {selectedInvoice.grandTotal.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-emerald-700 pt-1">
                          <span>Sudah Dibayar:</span>
                          <span>Rp {selectedInvoice.amountPaid.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-xs font-black text-rose-700 pt-1 border-t border-dashed border-slate-300">
                          <span>SISA PELUNASAN:</span>
                          <span>Rp {selectedInvoice.balanceDue.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Terms & Conditions */}
                    <div className="my-5 p-3 rounded-xl bg-slate-50/60 border border-slate-200 text-[9.5px] text-slate-500 leading-snug">
                      <span className="font-bold text-slate-700 block mb-0.5">Syarat & Ketentuan:</span>
                      <p className="whitespace-pre-line">
                        {storeIdentity.defaultTerms === undefined ? selectedInvoice.paymentTerms : storeIdentity.defaultTerms}
                      </p>
                    </div>

                    {/* Signatures & Stamp Area */}
                    <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200 text-center">
                      <div>
                        <p className="text-[10px] text-slate-500 mb-16">Penerima / Pelanggan,</p>
                        <p className="text-xs font-bold text-slate-800 border-t border-slate-400 pt-1 inline-block min-w-[150px]">
                          ({selectedInvoice.customer.pic || selectedInvoice.customer.name})
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500 mb-16">
                          Hormat Kami, <strong>{storeIdentity.storeName}</strong>
                        </p>
                        <p className="text-xs font-bold text-slate-800 border-t border-slate-400 pt-1 inline-block min-w-[150px]">
                          ({storeIdentity.authorizedSignerName || selectedInvoice.issuedBy})
                          <span className="text-[9px] text-slate-400 block font-normal">
                            {storeIdentity.authorizedSignerRole || 'Pimpinan Toko'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* FORMAT 2: MINI THERMAL RECEIPT (80mm/58mm) */}
              {/* ============================================================= */}
              {printMode === 'thermal' && (
                <div
                  id="thermal-receipt"
                  className="w-[80mm] bg-white p-4 shadow-md border border-slate-200 font-mono text-[11px] leading-tight text-slate-900 print:border-none print:shadow-none print:p-0"
                >
                  <div className="text-center pb-2 border-b border-dashed border-slate-400">
                    <h3 className="font-extrabold text-xs">{storeIdentity.storeName}</h3>
                    <p className="text-[9px]">{storeIdentity.address}</p>
                    <p className="text-[9px]">Telp: {storeIdentity.phone}</p>
                    <h4 className="font-bold text-xs uppercase mt-2">
                      {selectedInvoice.documentType === 'PROFORMA' ? 'PROFORMA INVOICE' : 'FAKTUR INVOICE'}
                    </h4>
                    <p className="text-[10px]">{selectedInvoice.documentNumber}</p>
                  </div>

                  <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
                    <div>Tgl: {selectedInvoice.issueDate}</div>
                    <div>Kepada: {selectedInvoice.customer.name}</div>
                    <div>Proyek: {selectedInvoice.projectTitle}</div>
                    {selectedInvoice.sourceProformaNumber && (
                      <div className="pt-1 mt-1 border-t border-dashed border-slate-300 font-bold text-indigo-900">
                        <div>Berdasar PI: {selectedInvoice.sourceProformaNumber}</div>
                        {selectedInvoice.referenceDescription && (
                          <div className="text-[9px] font-normal text-slate-700">{selectedInvoice.referenceDescription}</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5">
                    {selectedInvoice.items.map((it, idx) => (
                      <div key={idx} className="text-[10px]">
                        <div className="font-bold">{it.itemName}</div>
                        <div className="flex justify-between text-slate-600">
                          <span>{it.quantity} {it.unit} x {it.unitPrice.toLocaleString('id-ID')}</span>
                          <span>Rp {it.totalPrice.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>Rp {selectedInvoice.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    {selectedInvoice.discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Diskon:</span>
                        <span>- Rp {selectedInvoice.discountAmount.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>PPN {selectedInvoice.taxRate > 0 ? `(${selectedInvoice.taxRate}%)` : '(Non-PKP)'}:</span>
                      <span>{selectedInvoice.taxRate > 0 ? `Rp ${selectedInvoice.taxAmount.toLocaleString('id-ID')}` : 'Rp 0'}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-slate-300">
                      <span>TOTAL:</span>
                      <span>Rp {selectedInvoice.grandTotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Terbayar:</span>
                      <span>Rp {selectedInvoice.amountPaid.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-rose-700">
                      <span>Sisa:</span>
                      <span>Rp {selectedInvoice.balanceDue.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  {/* Instruksi & Rincian Jadwal Pembayaran di Struk Thermal */}
                  {selectedInvoice.paymentSchedules && selectedInvoice.paymentSchedules.length > 0 && (
                    <div className="py-2 border-b border-dashed border-slate-400 text-[9.5px] space-y-1">
                      <div className="font-bold uppercase tracking-wider text-slate-800">
                        Rincian Jadwal Pembayaran ({selectedInvoice.paymentScheme || 'TERMIN'}):
                      </div>
                      {selectedInvoice.paymentSchedules.map((s, idx) => {
                        const stageInfo = getTerminStageDisplayInfo(selectedInvoice, s, idx, invoices);
                        return (
                          <div key={idx} className="flex justify-between">
                            <span>{s.name} ({formatPercentInput(s.percentage)}%){s.dueDate ? ` [${s.dueDate}]` : ''}:</span>
                            <span className="font-bold">Rp {s.amount.toLocaleString('id-ID')} ({stageInfo.status})</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between font-extrabold pt-0.5 border-t border-dashed border-slate-300">
                        <span>Total Kontrak (100%):</span>
                        <span>Rp {(selectedInvoice.contractTotalAmount || selectedInvoice.grandTotal).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  )}

                  {/* Rekening Bank di Struk */}
                  <div className="py-1.5 border-b border-dashed border-slate-400 text-[9px] text-slate-700 space-y-0.5">
                    <div className="font-bold text-slate-800">Rekening Pembayaran:</div>
                    {(storeIdentity.bankAccounts && storeIdentity.bankAccounts.length > 0
                      ? storeIdentity.bankAccounts
                      : selectedInvoice.bankAccounts || []
                    ).map(b => (
                      <div key={b.id}>
                        {b.bankName}: {b.accountNumber} (a/n {b.accountHolder})
                      </div>
                    ))}
                  </div>

                  <div className="text-center pt-3 text-[9px] text-slate-500">
                    <p>Terima kasih atas kerja samanya.</p>
                    <p>{storeIdentity.website || 'www.bejostiker.com'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal Tarik Transaksi dari Laporan Penjualan */}
      <SalesTransactionPickerModal
        isOpen={isSalesPickerModalOpen}
        onClose={() => setIsSalesPickerModalOpen(false)}
        onSelectTransaction={handleSelectTransactionForInvoice}
      />
    </div>
  );
};
