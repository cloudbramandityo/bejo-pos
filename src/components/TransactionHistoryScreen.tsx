/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  Receipt,
  Calendar,
  Eye,
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  Clock,
  Filter,
  Download,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  ShieldCheck,
  Package,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Boxes,
  Truck,
  UserCheck,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  AlertCircle,
  LayoutDashboard,
  BarChart3,
  Wallet,
  Flame,
  Award,
  Sparkles,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Transaction, StockTransaction, Product, Supplier, Agent, ProductCategoryItem, UserRole, Invoice } from '../types';
import { formatRupiah, formatItemTransactionSpec, formatVolume, isTransactionOnDate, getTransactionDateTimeEpoch } from '../utils/formatters';
import { exportTransactionsToExcel, exportStockTransactionsToExcel, exportSingleStockTransactionToExcel } from '../utils/excelExport';
import { exportTransactionsToPDF, exportStockTransactionsToPDF, exportSingleStockTransactionToPDF } from '../utils/pdfExport';
import { convertInvoicesToTransactions } from '../utils/invoiceStorage';
import { canManageRecords } from '../utils/recordAccess';

import { groupStockTransactionsByBatch, normalizeStockTransaction, calculateStockItemProfit, getProductRollPakQty, calculateSalesItemCost } from '../utils/stockUtils';
import { isDigitalPrintingProduct, isPaketProduct } from '../utils/productFilters';
import { StoreLogo } from './StoreLogo';
import { EditStockTransactionModal } from './modals/EditStockTransactionModal';
import { EditSalesTransactionModal } from './modals/EditSalesTransactionModal';
import { DashboardAnalysisView } from './DashboardAnalysisView';

interface TransactionHistoryScreenProps {
  transactions: Transaction[];
  stockTransactions?: StockTransaction[];
  invoices?: Invoice[];
  isStoreOnline?: boolean;
  storeName?: string;
  onPrintReceipt: (transaction: Transaction) => void;
  products: Product[];
  suppliers?: Supplier[];
  agents?: Agent[];
  categories?: any[];
  customers?: any[];
  productCategories?: ProductCategoryItem[];
  userRole?: UserRole;
  onUpdateStockTransaction?: (updatedTx: StockTransaction) => Promise<void> | void;
  onDeleteStockTransaction?: (transactionId: string) => Promise<void> | void;
  onUpdateTransaction?: (updatedTx: Transaction) => Promise<void> | void;
  onDeleteTransaction?: (transactionId: string) => Promise<void> | void;
}

type PeriodType = 'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'SEMUA';

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = ({
  transactions,
  stockTransactions = [],
  invoices = [],
  isStoreOnline = false,
  storeName = 'BEJO Digital Print',
  onPrintReceipt,
  products = [],
  suppliers = [],
  agents = [],
  categories = [],
  customers = [],
  productCategories = [],
  userRole,
  onUpdateStockTransaction,
  onDeleteStockTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  /** DEVELOPER dan ADMIN boleh mengedit/menghapus transaksi tersimpan. */
  const canManage = canManageRecords(userRole);

  const [reportTab, setReportTab] = useState<'analysis' | 'penjualan' | 'pembelian_bahan' | 'pengambilan_bahan'>('analysis');
  const [periodType, setPeriodType] = useState<PeriodType>('HARIAN');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  });
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('ALL'); // 'ALL', 'Shift 1', 'Shift 2', etc.
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  // Sort direction for Sales Report: 'desc' (Terbaru ke Terlama) or 'asc' (Terlama ke Terbaru)
  const [salesSortDirection, setSalesSortDirection] = useState<'desc' | 'asc'>('desc');

  // View modes for Rekap Bahan vs Invoice lists
  const [salesCategoryFilter, setSalesCategoryFilter] = useState<'ALL' | 'SPK_CETAK' | 'OPEN_ACCOUNT' | 'REGULAR' | 'INVOICE'>('ALL');
  const [viewModeSales, setViewModeSales] = useState<'transactions' | 'rekap_bahan'>('transactions');
  const [viewModePengambilan, setViewModePengambilan] = useState<'transactions' | 'rekap_bahan'>('transactions');
  const [jenisLaporanAgen, setJenisLaporanAgen] = useState<'SEMUA' | 'PENGAMBILAN_BAHAN' | 'CETAK_AGEN'>('SEMUA');
  const [subTabAgenList, setSubTabAgenList] = useState<'PENGAMBILAN' | 'CETAK'>('PENGAMBILAN');
  const [searchRekapSales, setSearchRekapSales] = useState('');
  const [searchRekapPengambilan, setSearchRekapPengambilan] = useState('');

  const isCetakAgenView =
    reportTab === 'pengambilan_bahan' &&
    (jenisLaporanAgen === 'CETAK_AGEN' || (jenisLaporanAgen === 'SEMUA' && subTabAgenList === 'CETAK'));

  // Redirect report tab if not allowed (exclusively for DEVELOPER and ADMIN)
  React.useEffect(() => {
    if (reportTab === 'pengambilan_bahan' && userRole !== 'DEVELOPER' && userRole !== 'ADMIN') {
      setReportTab('analysis');
    }
  }, [reportTab, userRole]);

  // Expanded rows state
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});

  // Edit Stock Transaction State
  const [editingStockTx, setEditingStockTx] = useState<StockTransaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete Stock Transaction State
  const [deletingStockTx, setDeletingStockTx] = useState<StockTransaction | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Sales Transaction State
  const [editingSalesTx, setEditingSalesTx] = useState<Transaction | null>(null);
  const [isEditSalesModalOpen, setIsEditSalesModalOpen] = useState(false);

  // Delete Sales Transaction State
  const [deletingSalesTx, setDeletingSalesTx] = useState<Transaction | null>(null);
  const [isDeleteSalesModalOpen, setIsDeleteSalesModalOpen] = useState(false);
  const [isDeletingSales, setIsDeletingSales] = useState(false);

  // Feedback Notification Toast
  const [actionToast, setActionToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleOpenEditSales = (tx: Transaction) => {
    setEditingSalesTx(tx);
    setIsEditSalesModalOpen(true);
  };

  const handleOpenDeleteSales = (tx: Transaction) => {
    setDeletingSalesTx(tx);
    setIsDeleteSalesModalOpen(true);
  };

  const handleConfirmDeleteSales = async () => {
    if (!deletingSalesTx || !onDeleteTransaction) return;
    setIsDeletingSales(true);
    try {
      await onDeleteTransaction(deletingSalesTx.id);
      setIsDeleteSalesModalOpen(false);
      const deletedId = deletingSalesTx.id;
      setDeletingSalesTx(null);
      setActionToast({
        type: 'success',
        message: `Transaksi Penjualan #${deletedId} berhasil dihapus permanen.`
      });
      setTimeout(() => setActionToast(null), 4000);
    } catch (err: any) {
      console.error('Error deleting sales transaction:', err);
      setActionToast({
        type: 'error',
        message: `Gagal menghapus transaksi: ${err?.message || 'Terjadi kesalahan'}`
      });
    } finally {
      setIsDeletingSales(false);
    }
  };

  const handleSaveEditedSalesTx = async (updatedTx: Transaction) => {
    if (!onUpdateTransaction) return;
    await onUpdateTransaction(updatedTx);
    setActionToast({
      type: 'success',
      message: `Transaksi Penjualan #${updatedTx.id} berhasil diperbarui.`
    });
    setTimeout(() => setActionToast(null), 4000);
  };

  const handleOpenEdit = (tx: StockTransaction) => {
    setEditingStockTx(tx);
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (tx: StockTransaction) => {
    setDeletingStockTx(tx);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingStockTx || !onDeleteStockTransaction) return;
    setIsDeleting(true);
    try {
      await onDeleteStockTransaction(deletingStockTx.id);
      setIsDeleteModalOpen(false);
      const deletedId = deletingStockTx.id;
      setDeletingStockTx(null);
      setActionToast({
        type: 'success',
        message: `Transaksi #${deletedId} berhasil dihapus permanen dari database cloud.`
      });
      setTimeout(() => setActionToast(null), 4000);
    } catch (err: any) {
      console.error('Error deleting stock transaction:', err);
      setActionToast({
        type: 'error',
        message: `Gagal menghapus transaksi: ${err?.message || 'Terjadi kesalahan sistem'}`
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEditedTx = async (updatedTx: StockTransaction) => {
    if (!onUpdateStockTransaction) return;
    await onUpdateStockTransaction(updatedTx);
    setActionToast({
      type: 'success',
      message: `Transaksi #${updatedTx.id} berhasil diperbarui.`
    });
    setTimeout(() => setActionToast(null), 4000);
  };

  const { productMap, productByNameMap, productByCodeMap } = useMemo(() => {
    const pMap = new Map<string, Product>();
    const pByName = new Map<string, Product>();
    const pByCode = new Map<string, Product>();

    products.forEach((p) => {
      if (p.id) pMap.set(p.id, p);
      if (p.name) pByName.set(p.name.trim().toLowerCase(), p);
      if (p.code) pByCode.set(p.code.trim().toLowerCase(), p);
    });

    return { productMap: pMap, productByNameMap: pByName, productByCodeMap: pByCode };
  }, [products]);

  const toggleRowExpansion = (id: string) => {
    setExpandedTxIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAllRows = (allIds: string[]) => {
    const next: Record<string, boolean> = {};
    allIds.forEach((id) => {
      next[id] = true;
    });
    setExpandedTxIds(next);
  };

  const collapseAllRows = () => {
    setExpandedTxIds({});
  };

  // 1. Group stock transactions into unified batches / single transaction objects
  const allGroupedStockTransactions = useMemo(() => {
    return groupStockTransactionsByBatch(stockTransactions);
  }, [stockTransactions]);

  // 1b. Konversi data Invoice ke format standar Transaction (Laporan Penjualan)
  // Selaras dengan ringkasan finansial InvoiceScreen (bebas double counting, piutang debit nol pada pembatalan)
  const invoiceTransactions = useMemo(() => {
    return convertInvoicesToTransactions(invoices || []);
  }, [invoices]);

  // Gabungkan transaksi POS toko fisik dan invoice B2B
  const allSalesTransactions = useMemo(() => {
    if (!invoiceTransactions || invoiceTransactions.length === 0) {
      return transactions;
    }
    const txMap = new Map<string, Transaction>();
    transactions.forEach((tx) => {
      txMap.set(tx.id, tx);
    });
    invoiceTransactions.forEach((tx) => {
      if (!txMap.has(tx.id)) {
        txMap.set(tx.id, tx);
      }
    });
    return Array.from(txMap.values());
  }, [transactions, invoiceTransactions]);

  // 2. Filter sales transactions according to selected period
  const periodFilteredTransactions = useMemo(() => {
    return allSalesTransactions.filter((tx) => {
      if (periodType === 'HARIAN') {
        const matchesDate = isTransactionOnDate(tx, selectedDate);
        if (!matchesDate) return false;

        if (selectedShiftFilter !== 'ALL') {
          const shiftVal = (tx.shiftName || '').toLowerCase();
          const filterVal = selectedShiftFilter.toLowerCase();
          if (!shiftVal.includes(filterVal)) {
            return false;
          }
        }
        return true;
      }

      if (periodType === 'MINGGUAN') {
        const targetDate = new Date(selectedDate);
        const day = targetDate.getDay();
        const diffToMonday = targetDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(targetDate.setDate(diffToMonday));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const txTime = getTransactionDateTimeEpoch(tx);
        return txTime >= monday.getTime() && txTime <= sunday.getTime();
      }

      if (periodType === 'BULANAN') {
        const txEpoch = getTransactionDateTimeEpoch(tx);
        if (!txEpoch) return false;
        const txDateObj = new Date(txEpoch);
        return (
          txDateObj.getMonth() === selectedMonth &&
          txDateObj.getFullYear() === selectedYear
        );
      }

      return true;
    });
  }, [allSalesTransactions, periodType, selectedDate, selectedShiftFilter, selectedMonth, selectedYear]);

  // Helper to identify if a POS transaction belongs to an AGEN customer
  const isAgenTransaction = useMemo(() => {
    return (tx: Transaction) => {
      if (!tx) return false;
      const catStr = (tx.customerCategory || '').trim().toUpperCase();
      if (catStr === 'AGEN' || catStr === 'CAT_AGEN') return true;

      if (tx.customer) {
        const custCatId = (tx.customer.categoryId || '').trim().toLowerCase();
        if (custCatId === 'cat_agen') return true;

        const catObj = (categories || []).find((c: any) => c.id === tx.customer?.categoryId);
        if (catObj && (catObj.name || '').trim().toUpperCase() === 'AGEN') return true;

        if (tx.customer.name) {
          const cName = tx.customer.name.trim().toLowerCase();
          if ((agents || []).some((a: any) => a.name.trim().toLowerCase() === cName)) return true;
        }
      }
      return false;
    };
  }, [categories, agents]);

  // Helper to identify if a POS transaction belongs to an SPK Cetak Digital order
  const isSpkTransaction = useMemo(() => {
    return (tx: Transaction) => {
      if (!tx) return false;
      if (tx.spkId || tx.spkOrderNumber) return true;
      if (
        tx.items?.some(
          (it) =>
            it.spkId ||
            it.spkOrderNumber ||
            it.category === 'digital_printing' ||
            it.code === 'CETAK' ||
            isDigitalPrintingProduct(it as any, productCategories) ||
            (it.name && (it.name.toLowerCase().includes('spk') || it.name.toLowerCase().includes('cetak'))) ||
            (it.formattedSpec && it.formattedSpec.toLowerCase().includes('m²'))
        )
      ) {
        return true;
      }
      return false;
    };
  }, [productCategories]);

  const isOpenAccountTransaction = (tx: Transaction) => {
    return !!(tx.isOpenAccount || tx.transactionType === 'Open Account');
  };

  // Separate POS & Invoice transactions: Retail Store Sales + Invoices vs Cetak Agen
  const posStoreSalesTransactions = useMemo(() => {
    return periodFilteredTransactions.filter((tx) => !isAgenTransaction(tx));
  }, [periodFilteredTransactions, isAgenTransaction]);

  const activeStoreSalesTransactions = useMemo(() => {
    if (salesCategoryFilter === 'SPK_CETAK') {
      return posStoreSalesTransactions.filter((tx) => !tx.isInvoice && !isOpenAccountTransaction(tx) && isSpkTransaction(tx));
    }
    if (salesCategoryFilter === 'OPEN_ACCOUNT') {
      return posStoreSalesTransactions.filter((tx) => isOpenAccountTransaction(tx));
    }
    if (salesCategoryFilter === 'REGULAR') {
      return posStoreSalesTransactions.filter((tx) => !tx.isInvoice && !isOpenAccountTransaction(tx) && !isSpkTransaction(tx));
    }
    if (salesCategoryFilter === 'INVOICE') {
      return posStoreSalesTransactions.filter((tx) => !!tx.isInvoice);
    }
    return posStoreSalesTransactions;
  }, [posStoreSalesTransactions, salesCategoryFilter, isSpkTransaction]);

  const posAgenSalesTransactions = useMemo(() => {
    return periodFilteredTransactions.filter((tx) => isAgenTransaction(tx));
  }, [periodFilteredTransactions, isAgenTransaction]);

  // Secondary text search filtering for Retail Store Sales & Invoices (Excludes AGEN POS)
  const finalFilteredTransactions = useMemo(() => {
    let list = activeStoreSalesTransactions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => {
        return (
          t.id.toLowerCase().includes(q) ||
          (t.projectTitle && t.projectTitle.toLowerCase().includes(q)) ||
          (t.spkOrderNumber && t.spkOrderNumber.toLowerCase().includes(q)) ||
          (t.spkId && t.spkId.toLowerCase().includes(q)) ||
          (t.customer && t.customer.name.toLowerCase().includes(q)) ||
          (t.customer && t.customer.phone.includes(q)) ||
          (t.customer && t.customer.address && t.customer.address.toLowerCase().includes(q)) ||
          t.cashierName.toLowerCase().includes(q) ||
          (t.shiftName && t.shiftName.toLowerCase().includes(q)) ||
          t.items.some(
            (it) =>
              it.name.toLowerCase().includes(q) ||
              (it.code && it.code.toLowerCase().includes(q)) ||
              (it.notes && it.notes.toLowerCase().includes(q)) ||
              (it.formattedSpec && it.formattedSpec.toLowerCase().includes(q))
          )
        );
      });
    }
    const seen = new Set<string>();
    const unique = list.filter((t) => {
      if (!t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // Urutkan list Laporan Penjualan Toko & Invoice berdasarkan tanggal dan waktu
    return unique.sort((a, b) => {
      const timeA = getTransactionDateTimeEpoch(a);
      const timeB = getTransactionDateTimeEpoch(b);
      if (timeA !== timeB) {
        return salesSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return salesSortDirection === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
    });
  }, [activeStoreSalesTransactions, searchQuery, salesSortDirection]);

  // Secondary text search filtering for Cetak Agen POS transactions
  const finalFilteredAgenSalesTransactions = useMemo(() => {
    let list = posAgenSalesTransactions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => {
        return (
          t.id.toLowerCase().includes(q) ||
          (t.customer && t.customer.name.toLowerCase().includes(q)) ||
          (t.customer && t.customer.phone.includes(q)) ||
          t.cashierName.toLowerCase().includes(q) ||
          (t.shiftName && t.shiftName.toLowerCase().includes(q)) ||
          t.items.some((it) => it.name.toLowerCase().includes(q) || (it.code && it.code.toLowerCase().includes(q)))
        );
      });
    }
    const seen = new Set<string>();
    const unique = list.filter((t) => {
      if (!t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // Urutkan berdasarkan tanggal dan waktu
    return unique.sort((a, b) => {
      const timeA = getTransactionDateTimeEpoch(a);
      const timeB = getTransactionDateTimeEpoch(b);
      if (timeA !== timeB) {
        return salesSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return salesSortDirection === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
    });
  }, [posAgenSalesTransactions, searchQuery, salesSortDirection]);

  // 3. Filter Stock Transactions according to report tab and period
  const periodFilteredStockTransactions = useMemo(() => {
    const targetType = reportTab === 'pembelian_bahan' ? 'PEMBELIAN' : 'PENGAMBILAN';
    const filteredByType = allGroupedStockTransactions.filter((stx) => stx.type === targetType);

    return filteredByType.filter((tx) => {
      if (periodType === 'HARIAN') {
        return tx.date === selectedDate;
      }

      if (periodType === 'MINGGUAN') {
        const targetDate = new Date(selectedDate);
        const day = targetDate.getDay();
        const diffToMonday = targetDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(targetDate.setDate(diffToMonday));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const txTime = getTransactionDateTimeEpoch(tx);
        return txTime >= monday.getTime() && txTime <= sunday.getTime();
      }

      if (periodType === 'BULANAN') {
        const txEpoch = getTransactionDateTimeEpoch(tx);
        if (!txEpoch) return false;
        const txDateObj = new Date(txEpoch);
        return (
          txDateObj.getMonth() === selectedMonth &&
          txDateObj.getFullYear() === selectedYear
        );
      }

      return true;
    });
  }, [allGroupedStockTransactions, reportTab, periodType, selectedDate, selectedMonth, selectedYear]);

  // Secondary text search filtering for Stock transactions
  const finalFilteredStockTransactions = useMemo(() => {
    let list = periodFilteredStockTransactions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((stx) => {
        return (
          stx.id.toLowerCase().includes(q) ||
          stx.supplierName.toLowerCase().includes(q) ||
          (stx.notes && stx.notes.toLowerCase().includes(q)) ||
          stx.items.some(
            (it) =>
              it.productName.toLowerCase().includes(q) ||
              (it.code && it.code.toLowerCase().includes(q)) ||
              (it.category && it.category.toLowerCase().includes(q)) ||
              (it.notes && it.notes.toLowerCase().includes(q))
          )
        );
      });
    }

    return [...list].sort((a, b) => {
      const timeA = getTransactionDateTimeEpoch(a);
      const timeB = getTransactionDateTimeEpoch(b);
      if (timeA !== timeB) {
        return salesSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return salesSortDirection === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
    });
  }, [periodFilteredStockTransactions, searchQuery, salesSortDirection]);

  // Financial KPIs for Sales (Selaras antara Laporan Penjualan dan Invoice)
  const totalOmzet = finalFilteredTransactions.reduce((acc, t) => acc + t.total, 0);
  const totalCash = finalFilteredTransactions.reduce((acc, t) => acc + (t.paymentMethods?.cash || 0), 0);
  const totalTransfer = finalFilteredTransactions.reduce((acc, t) => acc + (t.paymentMethods?.transfer || 0), 0);
  const totalQris = finalFilteredTransactions.reduce((acc, t) => acc + (t.paymentMethods?.qris || 0), 0);
  const totalDiskon = finalFilteredTransactions.reduce((acc, t) => acc + (t.discount || 0), 0);
  const totalPajak = finalFilteredTransactions.reduce((acc, t) => acc + (t.tax || 0), 0);

  // Total Realisasi Kas / Pembayaran Masuk yang sudah terkumpul
  const totalCollectedPayment = totalCash + totalTransfer + totalQris;

  // Total Piutang Aktif (Khusus invoice bertahap / belum lunas yang belum tertagih)
  const totalPiutangOutstanding = finalFilteredTransactions.reduce((acc, t) => {
    if (t.isInvoice && t.balanceDue) {
      return acc + (t.balanceDue > 0 ? t.balanceDue : 0);
    }
    return acc;
  }, 0);

  // Statistik rincian invoice pada filter saat ini
  const invoiceStatsInReport = useMemo(() => {
    const invList = finalFilteredTransactions.filter((t) => t.isInvoice);
    const countTotal = invList.length;
    const countPaid = invList.filter((t) => t.invoiceStatus === 'PAID').length;
    const countPartial = invList.filter((t) => t.invoiceStatus === 'PARTIAL').length;
    const countIssued = invList.filter((t) => t.invoiceStatus === 'ISSUED').length;
    const countCancelled = invList.filter((t) => t.invoiceStatus === 'CANCELLED').length;
    return { countTotal, countPaid, countPartial, countIssued, countCancelled };
  }, [finalFilteredTransactions]);

  // Hitung jumlah transaksi berdasarkan jenis (4 jenis: SPK Cetak, Open Account, Reguler POS, Invoice B2B)
  const salesCounts = useMemo(() => {
    const list = posStoreSalesTransactions;
    const totalCount = list.length;
    const openAccountCount = list.filter((t) => isOpenAccountTransaction(t)).length;
    const spkCount = list.filter((t) => !t.isInvoice && !isOpenAccountTransaction(t) && isSpkTransaction(t)).length;
    const regularCount = list.filter((t) => !t.isInvoice && !isOpenAccountTransaction(t) && !isSpkTransaction(t)).length;
    const invoiceCount = list.filter((t) => !!t.isInvoice).length;
    return { totalCount, spkCount, openAccountCount, regularCount, invoiceCount };
  }, [posStoreSalesTransactions, isSpkTransaction]);

  // Total area in square meters (m²) printed in the current filtered transactions
  const totalSqmPrinted = useMemo(() => {
    let sum = 0;
    finalFilteredTransactions.forEach((t) => {
      // Lewati invoice yang dibatalkan
      if (t.isInvoice && (t.invoiceStatus === 'CANCELLED' || t.total === 0)) return;
      t.items?.forEach((it) => {
        const sqm =
          typeof it.sqm === 'number' && it.sqm > 0
            ? it.sqm
            : typeof it.lengthMeters === 'number' && typeof it.widthMeters === 'number' && it.lengthMeters > 0 && it.widthMeters > 0
            ? it.lengthMeters * it.widthMeters * (it.itemCount || it.qty || 1)
            : 0;
        sum += sqm;
      });
    });
    return sum;
  }, [finalFilteredTransactions]);

  // Financial KPIs for Sales Laba Bersih
  const { totalHpp, totalLabaBersih, marginLabaPercent } = useMemo(() => {
    let sumCost = 0;

    finalFilteredTransactions.forEach((t) => {
      // Lewati invoice yang dibatalkan agar HPP tetap akurat dan selaras dengan omset Rp 0
      if (t.isInvoice && (t.invoiceStatus === 'CANCELLED' || t.total === 0)) return;

      t.items?.forEach((it) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);

        const profitRes = calculateSalesItemCost(it, prod);
        sumCost += profitRes.totalCost;
      });
    });

    // PPN yang dipungut bukan pendapatan, jadi laba dihitung dari omzet neto PPN
    const netRevenue = totalOmzet - totalPajak;
    const netProfit = netRevenue - sumCost;
    const margin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    return {
      totalHpp: sumCost,
      totalLabaBersih: netProfit,
      marginLabaPercent: margin,
    };
  }, [finalFilteredTransactions, totalOmzet, totalPajak, productMap, productByCodeMap, productByNameMap]);

  // Stock mutasi stats (per transaction aggregated)
  const totalStockTransactionsCount = finalFilteredStockTransactions.length;
  const totalStockQty = finalFilteredStockTransactions.reduce((acc, stx) => acc + (stx.totalQty || 0), 0);
  const totalStockValue = finalFilteredStockTransactions.reduce((acc, stx) => acc + (stx.totalAmount || 0), 0);
  const totalStockShippingCost = finalFilteredStockTransactions.reduce((acc, stx) => acc + (stx.shippingCost || 0), 0);
  const totalStockItemsValue = totalStockValue - totalStockShippingCost;

  // Nominal / Total transactions & Laba per Agent for the selected period
  const agentSummary = useMemo(() => {
    const filteredPengambilan = allGroupedStockTransactions.filter(
      (stx) => stx.type === 'PENGAMBILAN'
    );

    const activePengambilanList = filteredPengambilan.filter((tx) => {
      if (periodType === 'HARIAN') return tx.date === selectedDate;
      if (periodType === 'MINGGUAN') {
        const targetDate = new Date(selectedDate);
        const day = targetDate.getDay();
        const diffToMonday = targetDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(targetDate.setDate(diffToMonday));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        const txTime = getTransactionDateTimeEpoch(tx);
        return txTime >= monday.getTime() && txTime <= sunday.getTime();
      }
      if (periodType === 'BULANAN') {
        const txEpoch = getTransactionDateTimeEpoch(tx);
        if (!txEpoch) return false;
        const txDateObj = new Date(txEpoch);
        return (
          txDateObj.getMonth() === selectedMonth &&
          txDateObj.getFullYear() === selectedYear
        );
      }
      return true;
    });

    const activeCetakAgenList = posAgenSalesTransactions;

    const summaryMap: Record<
      string,
      {
        amountPengambilan: number;
        kulakPengambilan: number;
        labaPengambilan: number;
        qtyPengambilan: number;
        countPengambilan: number;
        amountCetak: number;
        kulakCetak: number;
        labaCetak: number;
        qtyCetak: number;
        countCetak: number;
      }
    > = {};

    const getOrInit = (rawName: string) => {
      const clean = (rawName || 'Umum / Tanpa Agen').trim();
      if (!summaryMap[clean]) {
        summaryMap[clean] = {
          amountPengambilan: 0,
          kulakPengambilan: 0,
          labaPengambilan: 0,
          qtyPengambilan: 0,
          countPengambilan: 0,
          amountCetak: 0,
          kulakCetak: 0,
          labaCetak: 0,
          qtyCetak: 0,
          countCetak: 0,
        };
      }
      return summaryMap[clean];
    };

    // 1. Accumulate Pengambilan Bahan
    activePengambilanList.forEach((tx) => {
      const entry = getOrInit(tx.supplierName);
      const norm = normalizeStockTransaction(tx);
      norm.items.forEach((item) => {
        const prod =
          (item.productId ? productMap.get(item.productId) : null) ||
          (item.code ? productByCodeMap.get(item.code.trim().toLowerCase()) : null) ||
          (item.productName ? productByNameMap.get(item.productName.trim().toLowerCase()) : null);

        const profitData = calculateStockItemProfit(item, prod);
        entry.amountPengambilan += profitData.totalAmount;
        entry.kulakPengambilan += profitData.totalCost;
        entry.labaPengambilan += profitData.totalProfit;
        entry.qtyPengambilan += profitData.qty;
      });
      entry.countPengambilan += 1;
    });

    // 2. Accumulate Cetak Agen
    activeCetakAgenList.forEach((tx) => {
      const agentName = tx.customer?.name || 'Agen';
      const entry = getOrInit(agentName);
      entry.amountCetak += Math.max(0, tx.total - (tx.tax || 0));
      let sumCost = 0;
      let sumQty = 0;
      tx.items?.forEach((it) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);

        const costRes = calculateSalesItemCost(it, prod);
        sumCost += costRes.totalCost;
        sumQty += (it.qty || 1);
      });
      entry.kulakCetak += sumCost;
      // PPN yang dipungut bukan pendapatan, jadi laba agen dihitung dari omzet neto PPN
      entry.labaCetak += (Math.max(0, tx.total - (tx.tax || 0)) - sumCost);
      entry.qtyCetak += sumQty;
      entry.countCetak += 1;
    });

    return Object.entries(summaryMap)
      .map(([name, data]) => {
        let displayAmount = 0;
        let displayKulak = 0;
        let displayLaba = 0;
        let displayQty = 0;
        let displayCount = 0;

        if (jenisLaporanAgen === 'PENGAMBILAN_BAHAN') {
          displayAmount = data.amountPengambilan;
          displayKulak = data.kulakPengambilan;
          displayLaba = data.labaPengambilan;
          displayQty = data.qtyPengambilan;
          displayCount = data.countPengambilan;
        } else if (jenisLaporanAgen === 'CETAK_AGEN') {
          displayAmount = data.amountCetak;
          displayKulak = data.kulakCetak;
          displayLaba = data.labaCetak;
          displayQty = data.qtyCetak;
          displayCount = data.countCetak;
        } else {
          displayAmount = data.amountPengambilan + data.amountCetak;
          displayKulak = data.kulakPengambilan + data.kulakCetak;
          displayLaba = data.labaPengambilan + data.labaCetak;
          displayQty = data.qtyPengambilan + data.qtyCetak;
          displayCount = data.countPengambilan + data.countCetak;
        }

        const marginPercent = displayAmount > 0 ? (displayLaba / displayAmount) * 100 : 0;

        return {
          name,
          ...data,
          totalAmount: displayAmount,
          totalKulak: displayKulak,
          totalLaba: displayLaba,
          totalQty: displayQty,
          count: displayCount,
          marginPercent,
        };
      })
      .filter((item) => item.count > 0 || item.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [
    allGroupedStockTransactions,
    posAgenSalesTransactions,
    periodType,
    selectedDate,
    selectedMonth,
    selectedYear,
    productMap,
    productByCodeMap,
    productByNameMap,
    jenisLaporanAgen,
  ]);

  // Aggregated totals across all agents in the selected period
  const totalAgentSummary = useMemo(() => {
    const totalAmount = agentSummary.reduce((acc, a) => acc + a.totalAmount, 0);
    const totalKulak = agentSummary.reduce((acc, a) => acc + a.totalKulak, 0);
    const totalLaba = agentSummary.reduce((acc, a) => acc + a.totalLaba, 0);
    const totalQty = agentSummary.reduce((acc, a) => acc + a.totalQty, 0);
    const totalTrx = agentSummary.reduce((acc, a) => acc + a.count, 0);
    const marginPercent = totalAmount > 0 ? (totalLaba / totalAmount) * 100 : 0;
    return { totalAmount, totalKulak, totalLaba, totalQty, totalTrx, marginPercent };
  }, [agentSummary]);

  // Total Aset Toko = (Harga Kulak x Stok) seluruh produk di Inventory Produk (Kecuali Digital Printing yang tidak dicentang 'isAssetToko' & Paket)
  const totalAssetValue = useMemo(() => {
    return products.reduce((acc, p) => {
      const isDigitalPrinting = isDigitalPrintingProduct(p);
      const isPaket = isPaketProduct(p);
      if (isPaket || (isDigitalPrinting && !p.isAssetToko)) return acc;

      const hargaKulak = p.costPrice || p.hargaKulak || 0;
      const stok = p.stock || 0;
      return acc + (hargaKulak * stok);
    }, 0);
  }, [products]);

  // Rekap Bahan Terpakai / Terjual pada POS Penjualan Toko (Fast Moving)
  const rekapBahanPenjualan = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        category: string;
        unit: string;
        totalQty: number;
        totalSquareMeters: number;
        trxCount: number;
        totalRevenue: number;
        totalCost: number;
        totalProfit: number;
      }
    >();

    finalFilteredTransactions.forEach((tx) => {
      // Lewati invoice yang dibatalkan agar tidak menambah volume rekap bahan
      if (tx.isInvoice && (tx.invoiceStatus === 'CANCELLED' || tx.total === 0)) return;

      const txItemsRevenue = (tx.items || []).reduce((acc, it) => {
        const qty = Number(it.qty ?? it.quantity) || 1;
        return acc + (it.totalPrice !== undefined && it.totalPrice !== null ? Number(it.totalPrice) : (Number(it.unitPrice) || 0) * qty);
      }, 0);
      const txNetRevenue = Math.max(0, (Number(tx.total) || 0) - (Number(tx.tax) || 0));
      // Alokasikan diskon transaksi & buang PPN secara proporsional ke tiap item
      const revenueFactor = txItemsRevenue > 0 ? txNetRevenue / txItemsRevenue : 1;

      tx.items?.forEach((it) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);

        let name = it.name || prod?.name || 'Produk Tanpa Nama';
        const isSpkItem = it.spkId || it.spkOrderNumber || it.category === 'digital_printing' || it.code === 'CETAK' || tx.spkId || tx.spkOrderNumber;
        
        if (salesCategoryFilter === 'SPK_CETAK' || isSpkItem) {
          if (it.notes && it.notes.trim()) {
            const rawMat = it.notes.split('•')[0].split('+')[0].trim();
            if (rawMat.length > 2 && !rawMat.toLowerCase().startsWith('pelunasan') && !rawMat.toLowerCase().startsWith('dp')) {
              name = rawMat;
            }
          }
        }

        const key = (salesCategoryFilter === 'SPK_CETAK' ? name : (it.productId || it.code || name || 'unknown')).trim().toLowerCase();

        const code = it.code || prod?.code || (isSpkItem ? 'CETAK' : '-');
        let rawCategory = prod?.category || it.saleType || (isSpkItem ? 'Digital Printing' : 'Umum');
        if (rawCategory === 'custom_sticker' || rawCategory === 'custom sticker' || rawCategory === 'custom_stiker') {
          rawCategory = 'vinyl_sticker';
        }
        const category = rawCategory;
        const unit = it.unit || prod?.unit || (isSpkItem ? 'm²' : 'pcs');

        const qty = Number(it.qty ?? it.quantity) || 1;
        const squareMetersPerItem =
          typeof it.sqm === 'number' && it.sqm > 0
            ? it.sqm / (it.itemCount || qty || 1)
            : typeof it.lengthMeters === 'number' && typeof it.widthMeters === 'number' && it.lengthMeters > 0 && it.widthMeters > 0
            ? it.lengthMeters * it.widthMeters
            : 0;

        const totalSqm = it.sqm && it.sqm > 0 ? it.sqm : squareMetersPerItem * (it.itemCount || qty);

        const profitRes = calculateSalesItemCost(it, prod);
        const rawItemRevenue =
          it.totalPrice !== undefined && it.totalPrice !== null
            ? Number(it.totalPrice)
            : (Number(it.unitPrice) || 0) * qty;
        const itemRevenue = rawItemRevenue * revenueFactor;
        const itemProfit = itemRevenue - profitRes.totalCost;

        const existing = map.get(key);
        if (existing) {
          existing.totalQty += qty;
          existing.totalSquareMeters += totalSqm;
          existing.trxCount += 1;
          existing.totalRevenue += itemRevenue;
          existing.totalCost += profitRes.totalCost;
          existing.totalProfit += itemProfit;
        } else {
          map.set(key, {
            id: key,
            code,
            name,
            category,
            unit,
            totalQty: qty,
            totalSquareMeters: totalSqm,
            trxCount: 1,
            totalRevenue: itemRevenue,
            totalCost: profitRes.totalCost,
            totalProfit: itemProfit,
          });
        }
      });
    });

    const items = Array.from(map.values());
    items.sort((a, b) => b.totalSquareMeters - a.totalSquareMeters || b.totalQty - a.totalQty || b.totalRevenue - a.totalRevenue);
    return items;
  }, [finalFilteredTransactions, salesCategoryFilter, productMap, productByCodeMap, productByNameMap]);

  // Rekap Bahan Terjual / Diambil Agen Rekanan (Fast Moving)
  const rekapBahanPengambilan = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        category: string;
        unit: string;
        totalQty: number;
        trxCount: number;
        totalRevenue: number;
        totalProfit: number;
      }
    >();

    // 1. Stock Transactions PENGAMBILAN
    if (jenisLaporanAgen !== 'CETAK_AGEN') {
      const pengambilanTx = finalFilteredStockTransactions.filter((stx) => stx.type === 'PENGAMBILAN');
      pengambilanTx.forEach((stx) => {
        stx.items?.forEach((it) => {
          const key = (it.productId || it.code || it.name || 'unknown').trim().toLowerCase();
          const prod =
            (it.productId ? productMap.get(it.productId) : null) ||
            (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
            (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);

          const code = it.code || prod?.code || '-';
          const name = it.productName || it.name || prod?.name || 'Bahan Tanpa Nama';
          let rawCategory = prod?.category || 'Bahan Stok';
          if (rawCategory === 'custom_sticker' || rawCategory === 'custom sticker' || rawCategory === 'custom_stiker') {
            rawCategory = 'vinyl_sticker';
          }
          const category = rawCategory;
          const unit = it.unit || prod?.unit || 'roll';

          const qty = Number(it.qty) || 1;
          const profitRes = calculateStockItemProfit(it, prod);
          const itemRevenue = Number(it.totalPrice) || 0;

          const existing = map.get(key);
          if (existing) {
            existing.totalQty += qty;
            existing.trxCount += 1;
            existing.totalRevenue += itemRevenue;
            existing.totalProfit += profitRes.totalProfit;
          } else {
            map.set(key, {
              id: key,
              code,
              name,
              category,
              unit,
              totalQty: qty,
              trxCount: 1,
              totalRevenue: itemRevenue,
              totalProfit: profitRes.totalProfit,
            });
          }
        });
      });
    }

    // 2. POS Transactions Cetak Agen
    if (jenisLaporanAgen !== 'PENGAMBILAN_BAHAN') {
      finalFilteredAgenSalesTransactions.forEach((tx) => {
        tx.items?.forEach((it) => {
          const key = (it.productId || it.code || it.name || 'unknown').trim().toLowerCase();
          const prod =
            (it.productId ? productMap.get(it.productId) : null) ||
            (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
            (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);

          const code = it.code || prod?.code || '-';
          const name = it.name || prod?.name || 'Produk Cetak Agen';
          let rawCategory = prod?.category || 'Cetak Agen';
          if (rawCategory === 'custom_sticker' || rawCategory === 'custom sticker' || rawCategory === 'custom_stiker') {
            rawCategory = 'vinyl_sticker';
          }
          const category = rawCategory;
          const unit = it.unit || prod?.unit || 'pcs';

          const qty = Number(it.qty) || 1;
          const profitRes = calculateSalesItemCost(it, prod);
          const itemRevenue = Number(it.totalPrice) || (Number(it.unitPrice) || 0) * qty;

          const existing = map.get(key);
          if (existing) {
            existing.totalQty += qty;
            existing.trxCount += 1;
            existing.totalRevenue += itemRevenue;
            existing.totalProfit += (itemRevenue - profitRes.totalCost);
          } else {
            map.set(key, {
              id: key,
              code,
              name,
              category,
              unit,
              totalQty: qty,
              trxCount: 1,
              totalRevenue: itemRevenue,
              totalProfit: (itemRevenue - profitRes.totalCost),
            });
          }
        });
      });
    }

    const items = Array.from(map.values());
    items.sort((a, b) => b.totalQty - a.totalQty || b.totalRevenue - a.totalRevenue);
    return items;
  }, [
    finalFilteredStockTransactions,
    finalFilteredAgenSalesTransactions,
    jenisLaporanAgen,
    productMap,
    productByCodeMap,
    productByNameMap,
  ]);

  const filteredRekapSales = useMemo(() => {
    if (!searchRekapSales.trim()) return rekapBahanPenjualan;
    const q = searchRekapSales.toLowerCase().trim();
    return rekapBahanPenjualan.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [rekapBahanPenjualan, searchRekapSales]);

  const filteredRekapPengambilan = useMemo(() => {
    if (!searchRekapPengambilan.trim()) return rekapBahanPengambilan;
    const q = searchRekapPengambilan.toLowerCase().trim();
    return rekapBahanPengambilan.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [rekapBahanPengambilan, searchRekapPengambilan]);


  // Period label for filenames & headers
  const periodLabel = useMemo(() => {
    if (periodType === 'HARIAN') {
      const shiftSuffix = selectedShiftFilter !== 'ALL' ? `_${selectedShiftFilter}` : '';
      return `${selectedDate}${shiftSuffix}`;
    }
    if (periodType === 'MINGGUAN') {
      return `Minggu_${selectedDate}`;
    }
    if (periodType === 'BULANAN') {
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${monthNames[selectedMonth]}_${selectedYear}`;
    }
    return 'Semua_Waktu';
  }, [periodType, selectedDate, selectedShiftFilter, selectedMonth, selectedYear]);

  // Export handlers
  const handleExportExcel = () => {
    if (reportTab === 'penjualan') {
      if (finalFilteredTransactions.length === 0) {
        alert('Tidak ada data transaksi untuk diekspor pada periode ini.');
        return;
      }
      const salesPrefix =
        salesCategoryFilter === 'SPK_CETAK'
          ? `Laporan_SPK_Cetak_${periodType}_${periodLabel}`
          : salesCategoryFilter === 'REGULAR'
          ? `Laporan_Penjualan_Reguler_${periodType}_${periodLabel}`
          : salesCategoryFilter === 'INVOICE'
          ? `Laporan_Invoice_B2B_${periodType}_${periodLabel}`
          : `Laporan_Penjualan_Toko_${periodType}_${periodLabel}`;

      exportTransactionsToExcel(
        finalFilteredTransactions,
        salesPrefix,
        products
      );
    } else if (reportTab === 'pembelian_bahan') {
      if (finalFilteredStockTransactions.length === 0) {
        alert('Tidak ada data transaksi mutasi stok untuk diekspor.');
        return;
      }
      exportStockTransactionsToExcel(
        finalFilteredStockTransactions,
        'PEMBELIAN',
        `Laporan_Pembelian_Bahan_PerTransaksi_${periodType}_${periodLabel}`,
        products
      );
    } else {
      // reportTab === 'pengambilan_bahan' (Laporan Agen: Pengambilan Bahan & Cetak Agen)
      const hasStock = finalFilteredStockTransactions.length > 0;
      const hasCetak = finalFilteredAgenSalesTransactions.length > 0;

      if (!hasStock && !hasCetak) {
        alert('Tidak ada data transaksi Agen untuk diekspor.');
        return;
      }

      if (jenisLaporanAgen === 'CETAK_AGEN') {
        exportTransactionsToExcel(
          finalFilteredAgenSalesTransactions,
          `Laporan_Cetak_Agen_${periodType}_${periodLabel}`,
          products
        );
      } else if (jenisLaporanAgen === 'PENGAMBILAN_BAHAN') {
        exportStockTransactionsToExcel(
          finalFilteredStockTransactions,
          'PENGAMBILAN',
          `Laporan_Pengambilan_Bahan_${periodType}_${periodLabel}`,
          products
        );
      } else {
        // SEMUA
        exportStockTransactionsToExcel(
          finalFilteredStockTransactions,
          'PENGAMBILAN',
          `Laporan_Lengkap_Agen_${periodType}_${periodLabel}`,
          products,
          finalFilteredAgenSalesTransactions
        );
      }
    }
  };

  const handleExportPDF = () => {
    try {
      if (reportTab === 'penjualan') {
      if (finalFilteredTransactions.length === 0) {
        alert('Tidak ada data transaksi untuk diekspor ke PDF pada periode ini.');
        return;
      }
      const title =
        salesCategoryFilter === 'SPK_CETAK'
          ? 'LAPORAN SPK CETAK (DIGITAL PRINTING)'
          : salesCategoryFilter === 'REGULAR'
          ? 'LAPORAN PENJUALAN REGULER (NON-SPK)'
          : salesCategoryFilter === 'INVOICE'
          ? 'LAPORAN INVOICE & PENJUALAN B2B'
          : 'LAPORAN PENJUALAN TOKO & B2B';

      exportTransactionsToPDF(finalFilteredTransactions, {
        periodType,
        periodLabel,
        storeName,
        shiftFilter: selectedShiftFilter,
        products,
        reportTitle: title,
      });
    } else if (reportTab === 'pembelian_bahan') {
      if (finalFilteredStockTransactions.length === 0) {
        alert('Tidak ada data transaksi mutasi stok untuk diekspor ke PDF.');
        return;
      }
      exportStockTransactionsToPDF(finalFilteredStockTransactions, 'PEMBELIAN', {
        periodType,
        periodLabel,
        storeName,
        products,
      });
    } else {
      // reportTab === 'pengambilan_bahan' (Laporan Agen: Pengambilan Bahan & Cetak Agen)
      const hasStock = finalFilteredStockTransactions.length > 0;
      const hasCetak = finalFilteredAgenSalesTransactions.length > 0;

      if (!hasStock && !hasCetak) {
        alert('Tidak ada data transaksi Agen untuk diekspor ke PDF.');
        return;
      }

      if (jenisLaporanAgen === 'CETAK_AGEN') {
        exportTransactionsToPDF(finalFilteredAgenSalesTransactions, {
          periodType,
          periodLabel,
          storeName,
          shiftFilter: selectedShiftFilter,
          products,
        });
      } else {
        exportStockTransactionsToPDF(
          finalFilteredStockTransactions,
          'PENGAMBILAN',
          {
            periodType,
            periodLabel,
            storeName,
            products,
          },
          finalFilteredAgenSalesTransactions
        );
      }
      }
    } catch (err) {
      console.error('Export PDF error:', err);
      alert('Gagal membuat file PDF. Silakan periksa data transaksi lalu coba lagi.');
    }
  };

  const currentVisibleIds = reportTab === 'penjualan'
    ? finalFilteredTransactions.map((t) => t.id)
    : finalFilteredStockTransactions.map((t) => t.id);

  const areAllExpanded = currentVisibleIds.length > 0 && currentVisibleIds.every((id) => expandedTxIds[id]);

  return (
    <div className="w-full max-w-[1440px] mx-auto p-3 sm:p-5 space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <StoreLogo size="lg" rounded="rounded-xl" storeName={storeName} />
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              LAPORAN TOKO & RIWAYAT TRANSAKSI
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Seluruh laporan direkap <strong>Per Transaksi</strong> (Penjualan, Pembelian Bahan, dan Pengambilan Bahan) dengan rincian multi-produk. Dapat di-export ke Excel (.xlsx) dan PDF (.pdf).
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Audit Trail Aman & Terkunci Permanen Per Transaksi</span>
            </div>
          </div>
        </div>

        {/* Download Buttons: Excel & PDF */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-export-excel-laporan"
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            title="Download file Excel spreadsheet (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>Download Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            id="btn-export-pdf-laporan"
            onClick={handleExportPDF}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            title="Download dokumen cetak PDF (.pdf)"
          >
            <FileText className="w-4 h-4 text-red-100" />
            <span>Download PDF (.pdf)</span>
          </button>
        </div>
      </div>

      {/* Tab Selector & Total Aset Toko container */}
      {isStoreOnline && (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 w-full">
          {/* Tab Selector: Dashboard Analysis vs Penjualan Toko vs Pembelian Bahan vs Pengambilan Bahan */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full lg:w-fit overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-1">
            <button
              type="button"
              id="tab-laporan-analysis"
              onClick={() => setReportTab('analysis')}
              className={`px-4 sm:px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                reportTab === 'analysis'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 ${reportTab === 'analysis' ? 'text-white' : 'text-slate-500'}`} />
              <span>Dashboard Analysis</span>
            </button>
            <button
              type="button"
              id="tab-laporan-penjualan"
              onClick={() => setReportTab('penjualan')}
              className={`px-4 sm:px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                reportTab === 'penjualan'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Receipt className={`w-4 h-4 ${reportTab === 'penjualan' ? 'text-white' : 'text-slate-500'}`} />
              <span>Laporan Penjualan Toko</span>
            </button>
            <button
              type="button"
              id="tab-laporan-pembelian"
              onClick={() => setReportTab('pembelian_bahan')}
              className={`px-4 sm:px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                reportTab === 'pembelian_bahan'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Truck className={`w-4 h-4 ${reportTab === 'pembelian_bahan' ? 'text-white' : 'text-slate-500'}`} />
              <span>Laporan Pembelian Bahan</span>
            </button>
            {(userRole === 'DEVELOPER' || userRole === 'ADMIN') && (
              <button
                type="button"
                id="tab-laporan-pengambilan"
                onClick={() => setReportTab('pengambilan_bahan')}
                className={`px-4 sm:px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                  reportTab === 'pengambilan_bahan'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <UserCheck className={`w-4 h-4 ${reportTab === 'pengambilan_bahan' ? 'text-white' : 'text-slate-500'}`} />
                <span>Laporan Agen</span>
              </button>
            )}
          </div>

          {/* Total Aset Toko Widget (Pojok Kanan, Sejajar dengan Tab) */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 shadow-2xs rounded-xl p-3 px-4 animate-in fade-in zoom-in-95 self-start lg:self-auto">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-lg">
              <Boxes className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Aset Toko
              </div>
              <div className="text-sm font-bold text-slate-900 font-mono">
                {formatRupiah(totalAssetValue)}
              </div>
              <div className="text-[9px] text-slate-500 font-medium">
                Harga Kulak (HPP) × Stok
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period Filter Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Period Tabs: Harian, Mingguan, Bulanan, Semua */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setPeriodType('HARIAN')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                periodType === 'HARIAN'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Laporan Harian (Per Hari)
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('MINGGUAN')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                periodType === 'MINGGUAN'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Laporan Mingguan (Per Minggu)
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('BULANAN')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                periodType === 'BULANAN'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Laporan Bulanan (Per Bulan)
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('SEMUA')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                periodType === 'SEMUA'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Waktu
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (areAllExpanded ? collapseAllRows() : expandAllRows(currentVisibleIds))}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {areAllExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{areAllExpanded ? 'Tutup Semua Rincian' : 'Buka Semua Rincian Produk'}</span>
            </button>
            <div className="text-xs font-bold text-slate-500 pl-2">
              Periode: <span className="text-blue-900 uppercase font-black">{periodLabel.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Controls based on selected period */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* HARIAN: Date Picker + Shift 1, Shift 2 Buttons */}
          {periodType === 'HARIAN' && (
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  Pilih Tanggal:
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Sub-filter Shift - Only for sales */}
              {reportTab === 'penjualan' && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Shift:
                  </span>
                  {['ALL', 'Shift 1', 'Shift 2', 'Full Shift', 'B2B / Invoice'].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSelectedShiftFilter(s)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        selectedShiftFilter === s
                          ? 'bg-white text-blue-900 shadow-2xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {s === 'ALL' ? 'Semua Shift' : s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MINGGUAN: Week Date Picker */}
          {periodType === 'MINGGUAN' && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                Pilih Tanggal Acuan Minggu:
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-500">
                (Menampilkan 7 hari kerja dalam minggu tersebut)
              </span>
            </div>
          )}

          {/* BULANAN: Month & Year Selectors */}
          {periodType === 'BULANAN' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <CalendarRange className="w-3.5 h-3.5 text-blue-600" />
                  Bulan:
                </span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {[
                    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                  ].map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Quick Search */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                reportTab === 'penjualan'
                  ? "Cari invoice, produk, pelanggan..."
                  : reportTab === 'pembelian_bahan'
                  ? "Cari no. trx, bahan, supplier..."
                  : "Cari no. trx, bahan, agen..."
              }
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Main Content: Dashboard Analysis vs Specific Reports */}
      {reportTab === 'analysis' ? (
        <DashboardAnalysisView
          transactions={allSalesTransactions}
          stockTransactions={stockTransactions}
          products={products}
          suppliers={suppliers}
          agents={agents}
          productCategories={productCategories}
          selectedDate={selectedDate}
          periodType={periodType}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          storeName={storeName}
          onPeriodTypeChange={setPeriodType}
        />
      ) : (
        <div className="space-y-4">
          {/* Sub-Filter Penjualan: Semua vs SPK Cetak vs Reguler vs Invoice B2B */}
          {reportTab === 'penjualan' && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 flex-wrap">
                <button
                  type="button"
                  id="filter-sales-all"
                  onClick={() => setSalesCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    salesCategoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Semua Penjualan</span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                    salesCategoryFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {salesCounts.totalCount}
                  </span>
                </button>

                <button
                  type="button"
                  id="filter-sales-spk"
                  onClick={() => setSalesCategoryFilter('SPK_CETAK')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    salesCategoryFilter === 'SPK_CETAK'
                      ? 'bg-indigo-600 text-white shadow-2xs ring-2 ring-indigo-300'
                      : 'text-indigo-700 hover:text-indigo-950 hover:bg-indigo-50'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${salesCategoryFilter === 'SPK_CETAK' ? 'text-amber-300' : 'text-indigo-600'}`} />
                  <span>SPK Cetak</span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                    salesCategoryFilter === 'SPK_CETAK' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {salesCounts.spkCount}
                  </span>
                </button>

                <button
                  type="button"
                  id="filter-sales-open-account"
                  onClick={() => setSalesCategoryFilter('OPEN_ACCOUNT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    salesCategoryFilter === 'OPEN_ACCOUNT'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-2xs ring-2 ring-amber-300'
                      : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
                  }`}
                >
                  <Layers className={`w-3.5 h-3.5 ${salesCategoryFilter === 'OPEN_ACCOUNT' ? 'text-slate-950' : 'text-amber-600'}`} />
                  <span>Open Account</span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                    salesCategoryFilter === 'OPEN_ACCOUNT' ? 'bg-amber-500 text-slate-950' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {salesCounts.openAccountCount}
                  </span>
                </button>

                <button
                  type="button"
                  id="filter-sales-regular"
                  onClick={() => setSalesCategoryFilter('REGULAR')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    salesCategoryFilter === 'REGULAR'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Reguler (POS)</span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                    salesCategoryFilter === 'REGULAR' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {salesCounts.regularCount}
                  </span>
                </button>

                <button
                  type="button"
                  id="filter-sales-invoice"
                  onClick={() => setSalesCategoryFilter('INVOICE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    salesCategoryFilter === 'INVOICE'
                      ? 'bg-blue-700 text-white shadow-2xs ring-2 ring-blue-300'
                      : 'text-blue-800 hover:text-blue-950 hover:bg-blue-50'
                  }`}
                >
                  <FileText className={`w-3.5 h-3.5 ${salesCategoryFilter === 'INVOICE' ? 'text-blue-200' : 'text-blue-600'}`} />
                  <span>Invoice B2B</span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                    salesCategoryFilter === 'INVOICE' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {salesCounts.invoiceCount}
                  </span>
                </button>
              </div>

              {salesCategoryFilter === 'SPK_CETAK' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Rekap Transaksi SPK & Volume Bahan Terpakai ({periodType})</span>
                </div>
              ) : salesCategoryFilter === 'INVOICE' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl text-[11px] font-bold">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Faktur Komersial & Proforma Invoice B2B ({periodType})</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 font-medium hidden md:block">
                  Laporan otomatis terintegrasi dengan mutasi kasir, invoice B2B & inventory
                </div>
              )}
            </div>
          )}

          {/* Dynamic Summary KPI Cards */}
          {reportTab === 'penjualan' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 font-sans">
              {/* Card 1: Total Omzet */}
              <div className={`rounded-2xl p-4 border shadow-xs flex items-center justify-between ${
                salesCategoryFilter === 'SPK_CETAK'
                  ? 'bg-indigo-50/40 border-indigo-200'
                  : salesCategoryFilter === 'INVOICE'
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-white border-slate-200'
              }`}>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {salesCategoryFilter === 'SPK_CETAK'
                      ? 'Omzet SPK Cetak'
                      : salesCategoryFilter === 'INVOICE'
                      ? 'Omzet Invoice B2B'
                      : 'Total Omzet'} ({periodType})
                  </span>
                  <div className="text-lg sm:text-xl font-black text-blue-900 mt-1 font-mono">
                    {formatRupiah(totalOmzet)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {finalFilteredTransactions.length} {
                      salesCategoryFilter === 'SPK_CETAK'
                        ? 'SPK Cetak Selesai'
                        : salesCategoryFilter === 'INVOICE'
                        ? 'Faktur / Dokumen'
                        : 'Transaksi (POS & Invoice)'
                    }
                  </span>
                </div>
                <div className={`p-3 rounded-xl ${
                  salesCategoryFilter === 'SPK_CETAK'
                    ? 'bg-indigo-100 text-indigo-700'
                    : salesCategoryFilter === 'INVOICE'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-blue-50 text-blue-600'
                }`}>
                  {salesCategoryFilter === 'SPK_CETAK' ? (
                    <Sparkles className="w-5 h-5" />
                  ) : salesCategoryFilter === 'INVOICE' ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <TrendingUp className="w-5 h-5" />
                  )}
                </div>
              </div>

              {/* Card 2: Laba Bersih */}
              <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    Total Laba Bersih ({periodType})
                  </span>
                  <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1 font-mono">
                    {formatRupiah(totalLabaBersih)}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    Margin: {marginLabaPercent.toFixed(1)}% | HPP: {formatRupiah(totalHpp)}
                  </span>
                </div>
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>

              {/* Card 3: SPK: Luas Bahan / Invoice: Pembayaran Masuk / Toko: Kas Masuk */}
              {salesCategoryFilter === 'SPK_CETAK' ? (
                <div className="bg-white rounded-2xl p-4 border border-purple-200 bg-purple-50/20 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                      Total Luas Bahan Cetak
                    </span>
                    <div className="text-lg sm:text-xl font-black text-purple-900 mt-1 font-mono">
                      {formatVolume(totalSqmPrinted)} m²
                    </div>
                    <span className="text-[10px] text-purple-600 font-semibold">
                      Akumulasi Bahan Terpakai
                    </span>
                  </div>
                  <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
                    <Boxes className="w-5 h-5" />
                  </div>
                </div>
              ) : salesCategoryFilter === 'INVOICE' ? (
                <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      Pembayaran Masuk
                    </span>
                    <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1 font-mono">
                      {formatRupiah(totalCollectedPayment)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Tunai: {formatRupiah(totalCash)} | Bank: {formatRupiah(totalTransfer)}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Total Tunai (Cash)
                    </span>
                    <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1 font-mono">
                      {formatRupiah(totalCash)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Uang Fisik Kasir</span>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Banknote className="w-5 h-5" />
                  </div>
                </div>
              )}

              {/* Card 4: Sisa Piutang (Invoice/All) vs Transfer Bank (POS) */}
              {salesCategoryFilter === 'INVOICE' ? (
                <div className="bg-white rounded-2xl p-4 border border-rose-200 bg-rose-50/20 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                      Sisa Tagihan (Piutang)
                    </span>
                    <div className="text-lg sm:text-xl font-black text-rose-700 mt-1 font-mono">
                      {formatRupiah(totalPiutangOutstanding)}
                    </div>
                    <span className="text-[10px] text-rose-600 font-medium">
                      {totalPiutangOutstanding > 0 ? 'Belum Tertagih / Termin' : 'Semua Invoice Lunas'}
                    </span>
                  </div>
                  <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              ) : salesCategoryFilter === 'SPK_CETAK' ? (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Total Kas (Tunai)
                    </span>
                    <div className="text-lg sm:text-xl font-black text-sky-700 mt-1 font-mono">
                      {formatRupiah(totalCash)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Penerimaan Kasir</span>
                  </div>
                  <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                    <Banknote className="w-5 h-5" />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Total Transfer Bank
                    </span>
                    <div className="text-lg sm:text-xl font-black text-sky-700 mt-1 font-mono">
                      {formatRupiah(totalTransfer)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Rekening Toko / B2B
                    </span>
                  </div>
                  <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                    <CreditCard className="w-5 h-5" />
                  </div>
                </div>
              )}

              {/* Card 5: QRIS, Sisa Piutang, & Status */}
              {salesCategoryFilter === 'INVOICE' ? (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Status Invoice
                    </span>
                    <div className="text-sm sm:text-base font-black text-slate-900 mt-1 font-mono">
                      {invoiceStatsInReport.countPaid} Lunas / {invoiceStatsInReport.countPartial} DP
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {invoiceStatsInReport.countIssued} Belum Bayar{invoiceStatsInReport.countCancelled > 0 ? ` | ${invoiceStatsInReport.countCancelled} Batal` : ''}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {salesCategoryFilter === 'SPK_CETAK' ? 'Transfer & QRIS' : 'QRIS & Piutang B2B'}
                    </span>
                    <div className="text-lg sm:text-xl font-black text-purple-700 mt-1 font-mono">
                      {salesCategoryFilter === 'SPK_CETAK' ? formatRupiah(totalTransfer + totalQris) : formatRupiah(totalQris)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {totalPiutangOutstanding > 0 ? `Piutang B2B: ${formatRupiah(totalPiutangOutstanding)}` : `Diskon: ${formatRupiah(totalDiskon)}`}
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                    {salesCategoryFilter === 'SPK_CETAK' ? <CreditCard className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
                  </div>
                </div>
              )}
            </div>
      ) : reportTab === 'pembelian_bahan' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-sans">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Transaksi ({periodType})
              </span>
              <div className="text-lg sm:text-xl font-black text-emerald-900 mt-1 font-mono">
                {totalStockTransactionsCount} Transaksi
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                Faktur Pembelian Bahan
              </span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Volume Bahan
              </span>
              <div className="text-lg sm:text-xl font-black text-blue-900 mt-1 font-mono">
                {totalStockQty} Pcs / Unit
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Akumulasi bahan masuk</span>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Ongkir Door to Door
              </span>
              <div className="text-lg sm:text-xl font-black text-indigo-700 mt-1 font-mono">
                {formatRupiah(totalStockShippingCost)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Biaya ekspedisi supplier</span>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Nilai Pembelian (+Ongkir)
              </span>
              <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1 font-mono">
                {formatRupiah(totalStockValue)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                Subtotal Bahan: {formatRupiah(totalStockItemsValue)}
              </span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 font-sans">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Transaksi Agen ({periodType})
              </span>
              <div className="text-lg sm:text-xl font-black text-rose-900 mt-1 font-mono">
                {totalStockTransactionsCount} Transaksi
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                Transaksi Pengambilan Bahan & Cetak Agen
              </span>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Volume Bahan / Cetak
              </span>
              <div className="text-lg sm:text-xl font-black text-purple-900 mt-1 font-mono">
                {totalStockQty} Pcs / Unit
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Akumulasi seluruh unit transaksi agen</span>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Nilai Transaksi Agen
              </span>
              <div className="text-lg sm:text-xl font-black text-rose-700 mt-1 font-mono">
                {formatRupiah(totalStockValue)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Total nilai tarif & cetak agen</span>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Main Table Block */}
      {reportTab === 'penjualan' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-4 space-y-4 font-sans">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-semibold px-1 pb-2 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Menampilkan <strong className="text-slate-800">{finalFilteredTransactions.length}</strong> transaksi penjualan pada laporan
              </span>
              <button
                type="button"
                onClick={() => setSalesSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                title="Klik untuk membalik urutan tanggal dan waktu"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                <span>Urutan:</span>
                <span className="text-blue-700 font-bold">
                  {salesSortDirection === 'desc' ? 'Tanggal & Waktu (Terbaru ↓)' : 'Tanggal & Waktu (Terlama ↑)'}
                </span>
              </button>
            </div>

            {/* Toggle View Mode: Invoice vs Rekap Bahan */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewModeSales('transactions')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  viewModeSales === 'transactions'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className={`w-3.5 h-3.5 ${viewModeSales === 'transactions' ? 'text-slate-800' : 'text-slate-500'}`} />
                <span>{salesCategoryFilter === 'SPK_CETAK' ? 'Daftar Transaksi SPK' : 'Daftar Invoice'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewModeSales('rekap_bahan')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  viewModeSales === 'rekap_bahan'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className={`w-3.5 h-3.5 ${viewModeSales === 'rekap_bahan' ? 'text-amber-600 fill-amber-500' : 'text-slate-500'}`} />
                <span className={viewModeSales === 'rekap_bahan' ? 'text-slate-900 font-bold' : 'text-slate-600'}>
                  {salesCategoryFilter === 'SPK_CETAK' ? 'REKAP BAHAN CETAK TERPAKAI (m²)' : 'REKAP BAHAN (Fast Moving)'}
                </span>
              </button>
            </div>
          </div>

          {viewModeSales === 'rekap_bahan' ? (
            <div className="space-y-4">
              {/* Header KPI Cards for Rekap Bahan Penjualan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                    <Flame className="w-5 h-5 fill-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                      {salesCategoryFilter === 'SPK_CETAK' ? 'Bahan Cetak Terbanyak (#1)' : 'Bahan / Produk Terlaris (#1)'}
                    </span>
                    <strong className="text-xs sm:text-sm font-black text-amber-950 block truncate">
                      {rekapBahanPenjualan[0] ? rekapBahanPenjualan[0].name : 'Belum Ada Transaksi'}
                    </strong>
                    {rekapBahanPenjualan[0] && (
                      <span className="text-[10px] text-amber-700 font-bold font-mono">
                        {rekapBahanPenjualan[0].totalSquareMeters > 0
                          ? `Total: ${formatVolume(rekapBahanPenjualan[0].totalSquareMeters)} m² (${rekapBahanPenjualan[0].trxCount}x SPK/Invoice)`
                          : `Terjual: ${formatVolume(rekapBahanPenjualan[0].totalQty)} ${rekapBahanPenjualan[0].unit} (${rekapBahanPenjualan[0].trxCount}x Invoice)`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                      {salesCategoryFilter === 'SPK_CETAK' ? 'Variasi Bahan Cetak Terpakai' : 'Total Variasi Bahan Terjual'}
                    </span>
                    <strong className="text-sm sm:text-base font-black text-blue-950 block font-mono">
                      {rekapBahanPenjualan.length} Macam Bahan
                    </strong>
                    <span className="text-[10px] text-blue-700 font-medium">
                      {salesCategoryFilter === 'SPK_CETAK' ? 'Akumulasi Bahan Digital Printing' : 'Penjualan Bahan & Cetak POS'}
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      {salesCategoryFilter === 'SPK_CETAK' ? 'Total Laba SPK Cetak' : 'Total Laba Penjualan Bahan'}
                    </span>
                    <strong className="text-sm sm:text-base font-black text-emerald-950 block font-mono">
                      {formatRupiah(rekapBahanPenjualan.reduce((a, b) => a + b.totalProfit, 0))}
                    </strong>
                    <span className="text-[10px] text-emerald-700 font-medium">
                      Laba Bersih Akumulasi
                    </span>
                  </div>
                </div>
              </div>

              {/* Search Box inside Rekap Bahan Table */}
              <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={salesCategoryFilter === 'SPK_CETAK' ? 'Cari nama bahan cetak pada rekap...' : 'Cari nama bahan / kode produk pada rekap...'}
                    value={searchRekapSales}
                    onChange={(e) => setSearchRekapSales(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                  Urutan: <strong>{salesCategoryFilter === 'SPK_CETAK' ? 'Volume m² Terbanyak' : 'Fast Moving (Volume Terbanyak)'}</strong>
                </span>
              </div>

              {/* Rekap Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 text-center">Peringkat</th>
                      <th className="py-3 px-4">Kode / SKU</th>
                      <th className="py-3 px-4">Nama Bahan / Produk</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4 text-center">Volume Terjual</th>
                      <th className="py-3 px-4 text-center">Frekuensi</th>
                      <th className="py-3 px-4 text-right">Total Omzet</th>
                      <th className="py-3 px-4 text-right bg-emerald-50 text-emerald-900">Estimasi Laba</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRekapSales.length > 0 ? (
                      filteredRekapSales.map((item, idx) => {
                        const isTop1 = idx === 0;
                        return (
                          <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${isTop1 ? 'bg-amber-50/30 font-semibold' : ''}`}>
                            <td className="py-3 px-4 text-center">
                              {isTop1 ? (
                                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xs">
                                  <Flame className="w-3 h-3 fill-white" /> #1 Fast Moving
                                </span>
                              ) : idx === 1 ? (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-bold text-[10px] px-2 py-0.5 rounded-full border border-amber-300">
                                  ⚡ #2
                                </span>
                              ) : idx === 2 ? (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-full border border-amber-200">
                                  ⭐ #3
                                </span>
                              ) : (
                                <span className="font-mono text-slate-500 font-bold">#{idx + 1}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-600">{item.code}</td>
                             <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{item.name}</div>
                              {item.totalSquareMeters > 0 && (
                                <div className="text-[10px] text-purple-700 font-mono">
                                  Luas Bahan Cetak: {formatVolume(item.totalSquareMeters)} m²
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                {item.category}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-mono font-black text-slate-900 text-sm bg-slate-100 px-2.5 py-1 rounded-lg">
                                {formatVolume(item.totalQty)} <span className="text-[10px] font-normal text-slate-500 uppercase">{item.unit}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                              {item.trxCount}x Invoice
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-blue-900">
                              {formatRupiah(item.totalRevenue)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                              {formatRupiah(item.totalProfit)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                          Tidak ada data rekap bahan penjualan pada periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">No. Invoice</th>
                    <th 
                      className="py-3.5 px-4 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                      onClick={() => setSalesSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                      title="Klik untuk membalik urutan tanggal dan waktu (Terbaru / Terlama)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Tgl & Jam</span>
                        <span className="inline-flex items-center">
                          {salesSortDirection === 'desc' ? (
                            <span className="flex items-center gap-0.5 bg-blue-100/90 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              Terbaru <ArrowDown className="w-3 h-3 inline" />
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 bg-blue-100/90 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              Terlama <ArrowUp className="w-3 h-3 inline" />
                            </span>
                          )}
                        </span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4">Kasir & Shift</th>
                    <th className="py-3.5 px-4">Pelanggan</th>
                    <th className="py-3.5 px-4">Rincian Barang / Jasa</th>
                    <th className="py-3.5 px-4 text-right">Total Bayar</th>
                    <th className="py-3.5 px-4">Metode Bayar</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finalFilteredTransactions.length > 0 ? (
                    finalFilteredTransactions.map((tx) => {
                      const isExpanded = !!expandedTxIds[tx.id];
                      return (
                        <React.Fragment key={tx.id}>
                        <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-blue-50/20' : ''}`}>
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-1 rounded text-xs ${
                                isOpenAccountTransaction(tx)
                                  ? 'bg-amber-100 text-amber-950 border border-amber-300 font-black'
                                  : tx.isInvoice
                                  ? 'bg-blue-100 text-blue-900 border border-blue-200 font-bold'
                                  : isSpkTransaction(tx)
                                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold'
                                  : 'bg-slate-100 text-slate-800 font-bold'
                              }`}>
                                {tx.id}
                              </span>

                              {/* 4 Tipe Transaksi Laporan Penjualan */}
                              {isOpenAccountTransaction(tx) ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-amber-400 text-slate-950 border-amber-500 shadow-2xs">
                                  Open Account
                                </span>
                              ) : tx.isInvoice ? (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded border bg-blue-600 text-white border-blue-700 shadow-2xs">
                                  Invoice B2B
                                </span>
                              ) : isSpkTransaction(tx) ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-indigo-600 text-white border-indigo-700 shadow-2xs">
                                  SPK Cetak
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-700 text-white border-slate-800 shadow-2xs">
                                  Reguler (POS)
                                </span>
                              )}

                              {tx.isInvoice && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  tx.invoiceDocumentType === 'PROFORMA'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                }`}>
                                  {tx.invoiceDocumentType === 'PROFORMA' ? 'PI' : 'INV'}
                                </span>
                              )}
                            </div>
                            {tx.isInvoice && tx.invoiceStatus && (
                              <div className="mt-1">
                                {tx.invoiceStatus === 'PAID' && (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    Lunas
                                  </span>
                                )}
                                {tx.invoiceStatus === 'PARTIAL' && (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                    <Clock className="w-2.5 h-2.5 text-amber-600" />
                                    DP / Sebagian
                                  </span>
                                )}
                                {tx.invoiceStatus === 'ISSUED' && (
                                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200">
                                    <Clock className="w-2.5 h-2.5 text-blue-600" />
                                    Belum Bayar
                                  </span>
                                )}
                                {tx.invoiceStatus === 'CANCELLED' && (
                                  <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-200">
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                    Batal / CN
                                  </span>
                                )}
                              </div>
                            )}
                            {tx.isInvoice && tx.projectTitle && (
                              <div className="text-[10px] text-slate-500 font-sans font-medium truncate max-w-[190px] mt-0.5" title={tx.projectTitle}>
                                📋 {tx.projectTitle}
                              </div>
                            )}
                            {(tx.spkOrderNumber || tx.spkId) && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                                  {tx.spkOrderNumber || tx.spkId}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-mono">
                            <div>{tx.date}</div>
                            <div className="text-[10px] text-slate-400">{tx.time}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 uppercase">{tx.cashierName}</div>
                            <span className="text-[10px] text-blue-600 font-semibold">{tx.shiftName || 'Shift 1'}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            {tx.customer ? (
                              <div>
                                <div className="font-bold text-slate-900">{tx.customer.name}</div>
                                <div className="text-[10px] font-mono text-slate-500">{tx.customer.phone}</div>
                                <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                                  isOpenAccountTransaction(tx)
                                    ? 'bg-amber-100 text-slate-950 font-black border border-amber-300'
                                    : tx.isInvoice
                                    ? 'bg-blue-100 text-blue-800 font-extrabold'
                                    : isSpkTransaction(tx)
                                    ? 'bg-indigo-100 text-indigo-900 font-bold'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {isOpenAccountTransaction(tx)
                                    ? 'OPEN ACCOUNT'
                                    : tx.isInvoice
                                    ? 'INVOICE B2B'
                                    : isSpkTransaction(tx)
                                    ? 'SPK CETAK'
                                    : (tx.customerCategory && tx.customerCategory.toUpperCase() !== 'RETAIL' ? tx.customerCategory : 'UMUM')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Pelanggan Umum</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(tx.id)}
                              className="text-left group cursor-pointer w-full"
                            >
                              <div className="flex items-center gap-1 font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                                <span>{tx.items.length} Macam Produk ({tx.items.reduce((s, i) => s + (i.qty || 1), 0)} item)</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                {tx.items.map((i) => i.name).join(', ')}
                              </div>
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            {formatRupiah(tx.total)}
                            {tx.isInvoice && tx.balanceDue !== undefined && tx.balanceDue > 0 ? (
                              <div className="text-[10px] text-rose-600 font-bold">
                                Piutang: {formatRupiah(tx.balanceDue)}
                              </div>
                            ) : null}
                            {tx.isInvoice && tx.paidAmount !== undefined && tx.paidAmount > 0 && tx.balanceDue !== undefined && tx.balanceDue > 0 ? (
                              <div className="text-[10px] text-emerald-700 font-normal">
                                Terbayar: {formatRupiah(tx.paidAmount)}
                              </div>
                            ) : null}
                            {tx.discount > 0 ? (
                              <div className="text-[10px] text-red-600 font-normal">
                                Diskon: -{formatRupiah(tx.discount)}
                              </div>
                            ) : tx.discount < 0 ? (
                              <div className="text-[10px] text-amber-700 font-normal">
                                Diskon: +{formatRupiah(Math.abs(tx.discount))} (Pembulatan)
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5 font-mono text-[11px]">
                              {tx.paymentMethods.cash > 0 && (
                                <div className="text-emerald-700 font-semibold">
                                  Tunai: {formatRupiah(tx.paymentMethods.cash)}
                                </div>
                              )}
                              {tx.paymentMethods.transfer > 0 && (
                                <div className="text-blue-700 font-semibold">
                                  Transfer: {formatRupiah(tx.paymentMethods.transfer)}
                                </div>
                              )}
                              {tx.paymentMethods.qris > 0 && (
                                <div className="text-purple-700 font-semibold">
                                  QRIS: {formatRupiah(tx.paymentMethods.qris)}
                                </div>
                              )}
                              {tx.paymentMethods.cash === 0 && tx.paymentMethods.transfer === 0 && tx.paymentMethods.qris === 0 && (
                                <div className="text-[10px] text-slate-400 italic">
                                  {tx.isInvoice ? 'Belum Ada Pembayaran' : 'Rp 0'}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => toggleRowExpansion(tx.id)}
                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                title="Lihat rincian produk dalam transaksi ini"
                              >
                                {isExpanded ? 'Tutup' : 'Rincian'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onPrintReceipt(tx)}
                                className="px-2.5 py-1.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-[11px] font-bold rounded-lg shadow-2xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                                title="Cetak Ulang Struk / Nota"
                              >
                                <Printer className="w-3.5 h-3.5 text-sky-400" />
                                Cetak
                              </button>
                              {tx.isInvoice && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('bejo_open_invoice_tab'));
                                  }}
                                  className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Buka Faktur di Modul Invoice"
                                >
                                  <FileText className="w-3 h-3 text-blue-600" />
                                  Invoice
                                </button>
                              )}
                              {isOpenAccountTransaction(tx) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.dispatchEvent(
                                      new CustomEvent('bejo_create_invoice_from_open_account', {
                                        detail: {
                                          customerName: tx.customer?.name || 'Pelanggan Open Account',
                                          customerPhone: tx.customer?.phone || '',
                                          notes: tx.cashierNotes || '',
                                          orders: [
                                            {
                                              id: tx.id,
                                              orderNumber: tx.spkOrderNumber || tx.id,
                                              items: tx.items.map(it => ({
                                                id: it.id,
                                                jobName: it.name,
                                                materialName: it.name,
                                                lengthMeters: it.lengthMeters || 1,
                                                widthMeters: it.widthMeters || 1,
                                                qty: it.qty || 1,
                                                totalPrice: it.totalPrice,
                                                saleMode: it.saleType
                                              }))
                                            }
                                          ]
                                        }
                                      })
                                    );
                                    window.dispatchEvent(new CustomEvent('bejo_open_invoice_tab'));
                                  }}
                                  className="px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-slate-950 border border-amber-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                  title="Terbitkan Invoice untuk Transaksi Open Account ini"
                                >
                                  <FileText className="w-3 h-3 text-amber-800" />
                                  <span>Invoice</span>
                                </button>
                              )}
                              {canManage && !tx.isInvoice && (
                                <div className="contents">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditSales(tx)}
                                    className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                    title="Edit Transaksi Penjualan (Khusus DEVELOPER & ADMIN)"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteSales(tx)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                    title="Hapus Transaksi Penjualan (Khusus DEVELOPER & ADMIN)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Product Breakdown */}
                        {isExpanded && (
                          <tr className="bg-blue-50/30 border-b border-blue-100">
                            <td colSpan={8} className="p-3 pl-8">
                              <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-2xs space-y-2">
                                <div className="text-[11px] font-bold text-blue-900 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5 text-blue-600" />
                                    Daftar Rincian Produk / Jasa pada Invoice {tx.id} ({tx.items.length} Item)
                                  </span>
                                  <span className="text-slate-500 font-normal">
                                    Subtotal: {formatRupiah(tx.subtotal)} | Total Bayar: {formatRupiah(tx.total)}
                                  </span>
                                </div>
                                <table className="w-full text-left text-[11px]">
                                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                    <tr>
                                      <th className="py-1.5 px-3">No</th>
                                      <th className="py-1.5 px-3">Kode</th>
                                      <th className="py-1.5 px-3">Nama Produk / Jasa</th>
                                      <th className="py-1.5 px-3">Dimensi / Spesifikasi</th>
                                      <th className="py-1.5 px-3 text-center">Jumlah</th>
                                      <th className="py-1.5 px-3 text-right">Harga Satuan</th>
                                      <th className="py-1.5 px-3 text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {tx.items.map((it, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="py-1.5 px-3 text-slate-500">{idx + 1}</td>
                                        <td className="py-1.5 px-3 font-mono text-slate-600">{it.code || '-'}</td>
                                        <td className="py-1.5 px-3">
                                          <div className="font-bold text-slate-900">{it.name}</div>
                                          {it.notes && (
                                            <div className="text-[10px] text-indigo-700 font-medium">{it.notes}</div>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-3 text-slate-600 font-mono">{formatItemTransactionSpec(it)}</td>
                                        <td className="py-1.5 px-3 text-center font-bold text-blue-700">{it.qty} {it.unit || ''}</td>
                                        <td className="py-1.5 px-3 text-right font-mono">{formatRupiah(it.unitPrice)}</td>
                                        <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(it.totalPrice)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <p className="text-sm font-semibold">Tidak ada data transaksi pada filter periode ini.</p>
                      <p className="text-xs mt-1">Coba ubah tanggal, filter shift, atau rentang waktu di atas.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      ) : (
        /* Stock Mutations: Pembelian Bahan & Pengambilan Bahan (Per Transaksi) */
        <div>
          {/* Rekap Nominal Transaksi Tiap Agen - Hanya untuk Laporan Pengambilan Bahan */}
          {reportTab === 'pengambilan_bahan' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 font-sans animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-rose-600 animate-pulse" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Rekap Nominal & Laba Transaksi Tiap Agen ({periodType === 'HARIAN' ? 'Hari Ini' : periodType === 'MINGGUAN' ? 'Minggu Ini' : periodType === 'BULANAN' ? 'Bulan Ini' : 'Semua Waktu'})
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Akumulasi nominal rupiah, modal kulak, dan laba bersih per Agen. <span className="text-emerald-700 font-bold">*</span>
                    </p>
                  </div>
                </div>

                {agentSummary.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                      <button
                        type="button"
                        onClick={() => setJenisLaporanAgen('SEMUA')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          jenisLaporanAgen === 'SEMUA'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Semua Laporan Agen
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setJenisLaporanAgen('PENGAMBILAN_BAHAN');
                          setSubTabAgenList('PENGAMBILAN');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          jenisLaporanAgen === 'PENGAMBILAN_BAHAN'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Pengambilan Bahan Agen
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setJenisLaporanAgen('CETAK_AGEN');
                          setSubTabAgenList('CETAK');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          jenisLaporanAgen === 'CETAK_AGEN'
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Cetak Agen
                      </button>
                    </div>

                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Total Laba: <strong className="font-mono text-emerald-900">{formatRupiah(totalAgentSummary.totalLaba)}</strong></span>
                    </span>
                  </div>
                )}
              </div>

              {agentSummary.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Total Pengambilan (Agen)</div>
                      <div className="text-sm sm:text-base font-black text-rose-700 font-mono mt-0.5">
                        {formatRupiah(totalAgentSummary.totalAmount)}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{totalAgentSummary.totalTrx} Transaksi</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Total Modal (Kulak HPP)</div>
                      <div className="text-sm sm:text-base font-black text-slate-700 font-mono mt-0.5">
                        {formatRupiah(totalAgentSummary.totalKulak)}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">HPP Pengambilan</div>
                    </div>

                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase flex items-center justify-between">
                        <span>Total Laba Bersih</span>
                        <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">
                          {totalAgentSummary.marginPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-black text-emerald-800 font-mono mt-0.5">
                        {formatRupiah(totalAgentSummary.totalLaba)}
                      </div>
                      <div className="text-[9px] text-emerald-700 mt-0.5">Akumulasi Laba Bersih</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Total Volume Produk</div>
                      <div className="text-sm sm:text-base font-black text-slate-800 font-mono mt-0.5">
                        {formatVolume(totalAgentSummary.totalQty)} <span className="text-xs font-normal">Unit</span>
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{agentSummary.length} Agen Aktif</div>
                    </div>
                  </div>

                  {/* Rekap Table with Laba Column */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10">No</th>
                          <th className="py-2.5 px-3">Nama Agen</th>
                          <th className="py-2.5 px-3 text-center">Jml Trx</th>
                          <th className="py-2.5 px-3 text-center">Total Volume</th>
                          <th className="py-2.5 px-3 text-right">Total Pengambilan (Harga Agen)</th>
                          <th className="py-2.5 px-3 text-right text-slate-600">Total Modal (Harga Kulak)</th>
                          <th className="py-2.5 px-3 text-right bg-emerald-50/50 text-emerald-900">
                            Laba Bersih
                          </th>
                          <th className="py-2.5 px-3 text-right">% Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {agentSummary.map((ag, idx) => (
                          <tr key={ag.name} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                <span>{ag.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                {ag.count} Trx
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                              {formatVolume(ag.totalQty)} Unit
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                              {formatRupiah(ag.totalAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {formatRupiah(ag.totalKulak)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                              {formatRupiah(ag.totalLaba)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                ag.marginPercent >= 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {ag.marginPercent.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-200 text-slate-900 text-xs">
                        <tr>
                          <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider text-[10px]">
                            Total Keseluruhan Agen
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-rose-800">
                            {totalAgentSummary.totalTrx} Trx
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-900">
                            {formatVolume(totalAgentSummary.totalQty)} Unit
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-black">
                            {formatRupiah(totalAgentSummary.totalAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            {formatRupiah(totalAgentSummary.totalKulak)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-800 font-black bg-emerald-100/60">
                            {formatRupiah(totalAgentSummary.totalLaba)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800 font-bold">
                            {totalAgentSummary.marginPercent.toFixed(1)}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-xs font-bold">Tidak ada transaksi pengambilan bahan pada periode ini.</p>
                  <p className="text-[10px] mt-0.5">Nominal dan laba tiap Agen akan muncul secara otomatis saat ada data transaksi.</p>
                </div>
              )}
            </div>
          )}

          {canManage && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 animate-in fade-in">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Akses Kelola Data Aktif:</strong> Anda memiliki wewenang untuk mengedit data item/harga atau menghapus transaksi tersimpan secara langsung.
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                ROLE: {userRole}
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-4 space-y-4 font-sans animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-semibold px-1 pb-2 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Menampilkan{' '}
                  <strong className="text-slate-800">
                    {isCetakAgenView ? finalFilteredAgenSalesTransactions.length : finalFilteredStockTransactions.length}
                  </strong>{' '}
                  transaksi{' '}
                  {reportTab === 'pembelian_bahan'
                    ? 'pembelian bahan'
                    : isCetakAgenView
                    ? 'Cetak Agen POS'
                    : 'pengambilan bahan'}{' '}
                  pada laporan
                </span>

                {reportTab === 'pengambilan_bahan' && jenisLaporanAgen === 'SEMUA' && (
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 gap-1">
                    <button
                      type="button"
                      onClick={() => setSubTabAgenList('PENGAMBILAN')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        subTabAgenList === 'PENGAMBILAN'
                          ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pengambilan Bahan ({finalFilteredStockTransactions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubTabAgenList('CETAK')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        subTabAgenList === 'CETAK'
                          ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Cetak Agen ({finalFilteredAgenSalesTransactions.length})
                    </button>
                  </div>
                )}
              </div>

              {reportTab === 'pengambilan_bahan' && (
                <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewModePengambilan('transactions')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                      viewModePengambilan === 'transactions'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Receipt className={`w-3.5 h-3.5 ${viewModePengambilan === 'transactions' ? 'text-slate-800' : 'text-slate-500'}`} />
                    <span>{isCetakAgenView ? 'Daftar Invoice Cetak Agen' : 'Daftar Invoice Pengambilan'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewModePengambilan('rekap_bahan')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                      viewModePengambilan === 'rekap_bahan'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Flame className={`w-3.5 h-3.5 ${viewModePengambilan === 'rekap_bahan' ? 'text-rose-600 fill-rose-500' : 'text-slate-500'}`} />
                    <span className={viewModePengambilan === 'rekap_bahan' ? 'text-slate-900 font-bold' : 'text-slate-600'}>REKAP BAHAN AGEN (Fast Moving)</span>
                  </button>
                </div>
              )}
            </div>

          {reportTab === 'pengambilan_bahan' && viewModePengambilan === 'rekap_bahan' ? (
            <div className="space-y-4 pt-1">
              {/* Header KPI Cards for Rekap Bahan Agen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs">
                    <Flame className="w-5 h-5 fill-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                      Bahan Agen Terlaris (#1)
                    </span>
                    <strong className="text-xs sm:text-sm font-black text-rose-950 block truncate">
                      {rekapBahanPengambilan[0] ? rekapBahanPengambilan[0].name : 'Belum Ada Transaksi'}
                    </strong>
                    {rekapBahanPengambilan[0] && (
                      <span className="text-[10px] text-rose-700 font-bold font-mono">
                        Volume: {formatVolume(rekapBahanPengambilan[0].totalQty)} {rekapBahanPengambilan[0].unit} ({rekapBahanPengambilan[0].trxCount}x Trx)
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-purple-50/80 border border-purple-200/80 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-xs">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                      Total Variasi Bahan Agen
                    </span>
                    <strong className="text-sm sm:text-base font-black text-purple-950 block font-mono">
                      {rekapBahanPengambilan.length} Macam Bahan
                    </strong>
                    <span className="text-[10px] text-purple-700 font-medium">
                      Diambil oleh Agen Rekanan
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Total Laba Pengambilan Agen
                    </span>
                    <strong className="text-sm sm:text-base font-black text-emerald-950 block font-mono">
                      {formatRupiah(rekapBahanPengambilan.reduce((a, b) => a + b.totalProfit, 0))}
                    </strong>
                    <span className="text-[10px] text-emerald-700 font-medium">
                      Laba Bersih Akumulasi
                    </span>
                  </div>
                </div>
              </div>

              {/* Search Box */}
              <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama bahan / kode produk pada rekap agen..."
                    value={searchRekapPengambilan}
                    onChange={(e) => setSearchRekapPengambilan(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                  Urutan: <strong>Fast Moving (Volume Terbanyak)</strong>
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 text-center">Peringkat</th>
                      <th className="py-3 px-4">Kode / SKU</th>
                      <th className="py-3 px-4">Nama Bahan</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4 text-center">Volume Diambil Agen</th>
                      <th className="py-3 px-4 text-center">Frekuensi Trx</th>
                      <th className="py-3 px-4 text-right">Total Nilai Tarif</th>
                      <th className="py-3 px-4 text-right bg-emerald-50 text-emerald-900">Total Laba Agen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRekapPengambilan.length > 0 ? (
                      filteredRekapPengambilan.map((item, idx) => {
                        const isTop1 = idx === 0;
                        return (
                          <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${isTop1 ? 'bg-rose-50/30 font-semibold' : ''}`}>
                            <td className="py-3 px-4 text-center">
                              {isTop1 ? (
                                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-rose-600 to-purple-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xs">
                                  <Flame className="w-3 h-3 fill-white" /> #1 Fast Moving Agen
                                </span>
                              ) : idx === 1 ? (
                                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-900 font-bold text-[10px] px-2 py-0.5 rounded-full border border-rose-300">
                                  ⚡ #2
                                </span>
                              ) : idx === 2 ? (
                                <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 font-bold text-[10px] px-2 py-0.5 rounded-full border border-rose-200">
                                  ⭐ #3
                                </span>
                              ) : (
                                <span className="font-mono text-slate-500 font-bold">#{idx + 1}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-600">{item.code}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                            <td className="py-3 px-4">
                              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                {item.category === 'custom_sticker' || item.category === 'custom sticker' ? 'vinyl_sticker' : item.category}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-mono font-black text-rose-900 text-sm bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                                {formatVolume(item.totalQty)} <span className="text-[10px] font-normal text-rose-600 uppercase">{item.unit}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                              {item.trxCount}x Transaksi
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                              {formatRupiah(item.totalRevenue)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                              {formatRupiah(item.totalProfit)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                          Tidak ada data rekap bahan pengambilan agen pada periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : isCetakAgenView ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-purple-50 text-purple-950 uppercase font-bold tracking-wider text-[11px] border-b border-purple-200">
                  <tr>
                    <th className="py-3.5 px-4">No. Invoice</th>
                    <th 
                      className="py-3.5 px-4 cursor-pointer select-none group hover:bg-purple-100/70 transition-colors"
                      onClick={() => setSalesSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                      title="Klik untuk membalik urutan tanggal dan waktu (Terbaru / Terlama)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Tgl & Waktu</span>
                        <span className="inline-flex items-center">
                          {salesSortDirection === 'desc' ? (
                            <span className="flex items-center gap-0.5 bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              Terbaru <ArrowDown className="w-3 h-3 inline" />
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              Terlama <ArrowUp className="w-3 h-3 inline" />
                            </span>
                          )}
                        </span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4">Kasir & Shift</th>
                    <th className="py-3.5 px-4">Nama Agen / Pelanggan</th>
                    <th className="py-3.5 px-4">Rincian Cetak / Produk</th>
                    <th className="py-3.5 px-4 text-right">Total Bayar (Tarif Agen)</th>
                    <th className="py-3.5 px-4">Metode Bayar</th>
                    <th className="py-3.5 px-4 text-center">Aksi / Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finalFilteredAgenSalesTransactions.length > 0 ? (
                    finalFilteredAgenSalesTransactions.map((tx) => {
                      const isExpanded = !!expandedTxIds[tx.id];
                      let totalCost = 0;
                      let totalQty = 0;
                      tx.items?.forEach((it) => {
                        const prod =
                          (it.productId ? productMap.get(it.productId) : null) ||
                          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
                          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);
                        const costRes = calculateSalesItemCost(it, prod);
                        totalCost += costRes.totalCost;
                        totalQty += (it.qty || 1);
                      });
                      const totalProfit = tx.total - totalCost;

                      return (
                        <React.Fragment key={tx.id}>
                          <tr className={`hover:bg-purple-50/30 transition-colors ${isExpanded ? 'bg-purple-50/40' : ''}`}>
                            <td className="py-3.5 px-4 font-mono font-bold text-purple-900">
                              <span className="bg-purple-100 text-purple-900 px-2 py-1 rounded border border-purple-200">
                                {tx.id}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-mono">
                              <div>{tx.date}</div>
                              <div className="text-[10px] text-slate-400">{tx.time}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 uppercase">{tx.cashierName}</div>
                              <span className="text-[10px] text-purple-600 font-semibold">{tx.shiftName || 'Shift 1'}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{tx.customer?.name || 'Agen'}</div>
                              <div className="text-[10px] font-mono text-slate-500">{tx.customer?.phone || '-'}</div>
                              <span className="inline-block bg-purple-100 text-purple-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded mt-0.5 border border-purple-200">
                                AGEN
                              </span>
                            </td>
                            <td className="py-3.5 px-4 max-w-xs">
                              <button
                                type="button"
                                onClick={() => toggleRowExpansion(tx.id)}
                                className="text-left group cursor-pointer w-full"
                              >
                                <div className="flex items-center gap-1 font-semibold text-slate-800 group-hover:text-purple-700 transition-colors">
                                  <span>{tx.items.length} Macam Cetakan ({totalQty} item)</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-purple-600" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono truncate">
                                  {tx.items.map((i) => i.name).join(', ')}
                                </div>
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono">
                              <div className="font-black text-slate-900">{formatRupiah(tx.total)}</div>
                              <div className="text-[10px] text-emerald-700 font-bold">
                                Laba: {formatRupiah(totalProfit)}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5 font-mono text-[11px]">
                                {tx.paymentMethods.cash > 0 && (
                                  <div className="text-emerald-700 font-semibold">Tunai: {formatRupiah(tx.paymentMethods.cash)}</div>
                                )}
                                {tx.paymentMethods.transfer > 0 && (
                                  <div className="text-blue-700 font-semibold">Transfer: {formatRupiah(tx.paymentMethods.transfer)}</div>
                                )}
                                {tx.paymentMethods.qris > 0 && (
                                  <div className="text-purple-700 font-semibold">QRIS: {formatRupiah(tx.paymentMethods.qris)}</div>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpansion(tx.id)}
                                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                  title="Lihat rincian cetakan"
                                >
                                  {isExpanded ? 'Tutup' : 'Rincian'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onPrintReceipt(tx)}
                                  className="px-2.5 py-1.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-[11px] font-bold rounded-lg shadow-2xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Cetak Struk / Nota Agen"
                                >
                                  <Printer className="w-3.5 h-3.5 text-sky-400" />
                                  Cetak
                                </button>
                                {canManage && (
                                  <div className="contents">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSales(tx)}
                                      className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                      title="Edit Transaksi (Khusus DEVELOPER & ADMIN)"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDeleteSales(tx)}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                      title="Hapus Transaksi (Khusus DEVELOPER & ADMIN)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Details for Cetak Agen POS Transaction */}
                          {isExpanded && (
                            <tr className="bg-purple-50/30 border-b border-purple-100">
                              <td colSpan={8} className="p-3 pl-8">
                                <div className="bg-white rounded-xl p-3 border border-purple-200 shadow-2xs space-y-2">
                                  <div className="text-[11px] font-bold text-purple-900 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <Package className="w-3.5 h-3.5 text-purple-600" />
                                      Rincian Item / Cetakan Agen pada Invoice #{tx.id} ({tx.items.length} Item)
                                    </span>
                                    <span className="text-slate-500 font-normal font-mono">
                                      Total Tarif: <strong className="text-slate-900">{formatRupiah(tx.total)}</strong> | Total Modal: <strong className="text-slate-700">{formatRupiah(totalCost)}</strong> | Total Laba: <strong className="text-emerald-700 font-bold">{formatRupiah(totalProfit)}</strong>
                                    </span>
                                  </div>

                                  <table className="w-full text-left text-[11px]">
                                    <thead className="bg-purple-50/80 text-purple-900 font-bold uppercase text-[10px]">
                                      <tr>
                                        <th className="py-2 px-3">No</th>
                                        <th className="py-2 px-3">Kode / SKU</th>
                                        <th className="py-2 px-3">Nama Cetakan / Produk</th>
                                        <th className="py-2 px-3">Spesifikasi / Ukuran</th>
                                        <th className="py-2 px-3 text-center">Jumlah (Qty)</th>
                                        <th className="py-2 px-3 text-right">Harga Satuan (Agen)</th>
                                        <th className="py-2 px-3 text-right text-slate-600">Modal Satuan (HPP)</th>
                                        <th className="py-2 px-3 text-right">Subtotal</th>
                                        <th className="py-2 px-3 text-right bg-emerald-50 text-emerald-900">Laba Bersih</th>
                                        <th className="py-2 px-3">Catatan</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {tx.items.map((it, idx) => {
                                        const prod =
                                          (it.productId ? productMap.get(it.productId) : null) ||
                                          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
                                          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);
                                        const costRes = calculateSalesItemCost(it, prod);
                                        const itemProfit = it.totalPrice - costRes.totalCost;
                                        const specText = formatItemTransactionSpec(it);

                                        return (
                                          <tr key={idx} className="hover:bg-slate-50/80">
                                            <td className="py-2 px-3 text-slate-500 font-medium">{idx + 1}</td>
                                            <td className="py-2 px-3 font-mono text-slate-600">{it.code || '-'}</td>
                                            <td className="py-2 px-3 font-bold text-slate-900">{it.name}</td>
                                            <td className="py-2 px-3 text-slate-600 font-mono text-[10px]">
                                              {specText || '-'}
                                            </td>
                                            <td className="py-2 px-3 text-center font-bold text-purple-800">
                                              {it.qty} {it.unit || 'pcs'}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                                              {formatRupiah(it.price)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-500">
                                              {formatRupiah(costRes.costPerUnit)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                              {formatRupiah(it.totalPrice)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                                              {formatRupiah(itemProfit)}
                                            </td>
                                            <td className="py-2 px-3 text-slate-500">
                                              {it.notes || '-'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>

                                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                                    <div>
                                      {tx.notes && <span><strong>Catatan:</strong> {tx.notes}</span>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => onPrintReceipt(tx)}
                                        className="px-2.5 py-1 bg-[#1e295d] text-white text-[10px] font-bold rounded-md inline-flex items-center gap-1 hover:bg-[#151e44] transition-colors cursor-pointer"
                                      >
                                        <Printer className="w-3 h-3 text-sky-400" />
                                        Cetak Struk Agen
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <p className="text-sm font-semibold">
                          Tidak ada data transaksi Cetak Agen pada filter periode ini.
                        </p>
                        <p className="text-xs mt-1">Coba ubah tanggal atau rentang waktu di atas.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">No. Transaksi</th>
                  <th 
                    className="py-3.5 px-4 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                    onClick={() => setSalesSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                    title="Klik untuk membalik urutan tanggal dan waktu (Terbaru / Terlama)"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Tanggal & Waktu</span>
                      <span className="inline-flex items-center">
                        {salesSortDirection === 'desc' ? (
                          <span className="flex items-center gap-0.5 bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            Terbaru <ArrowDown className="w-3 h-3 inline" />
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            Terlama <ArrowUp className="w-3 h-3 inline" />
                          </span>
                        )}
                      </span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4">
                    {reportTab === 'pembelian_bahan' ? 'Nama Supplier' : 'Nama Agen'}
                  </th>
                  <th className="py-3.5 px-4">Daftar Bahan / Produk</th>
                  <th className="py-3.5 px-4 text-center">Total Volume</th>
                  <th className="py-3.5 px-4 text-right">
                    {reportTab === 'pembelian_bahan' ? 'Total Nilai Pembelian' : 'Total Nilai Pengambilan'}
                  </th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 text-center">Aksi / Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finalFilteredStockTransactions.length > 0 ? (
                  finalFilteredStockTransactions.map((tx) => {
                    const isExpanded = !!expandedTxIds[tx.id];
                    const itemCount = tx.items.length;
                    const isPembelian = reportTab === 'pembelian_bahan';

                    return (
                      <React.Fragment key={tx.id}>
                        <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? (isPembelian ? 'bg-emerald-50/20' : 'bg-rose-50/20') : ''}`}>
                          <td className="py-3.5 px-4 font-mono font-bold">
                            <span className={`px-2 py-1 rounded text-xs ${
                              isPembelian ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                            }`}>
                              {tx.id}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-mono">
                            <div>{tx.date}</div>
                            <div className="text-[10px] text-slate-400">{tx.time}</div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              {isPembelian ? (
                                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              <span>{tx.supplierName}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(tx.id)}
                              className="text-left group cursor-pointer w-full"
                            >
                              <div className="flex items-center gap-1 font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                                <span>{itemCount} Macam Produk ({tx.totalQty} Unit)</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                {tx.items.map((i) => i.productName).join(', ')}
                              </div>
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center font-black text-slate-800">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isPembelian ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {formatVolume(tx.totalQty)} Unit
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900">
                            <div>{formatRupiah(tx.totalAmount)}</div>
                            {isPembelian && (
                              tx.shippingCost && tx.shippingCost > 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEdit(tx);
                                  }}
                                  className="text-[10px] font-normal text-indigo-700 hover:text-indigo-900 flex items-center justify-end gap-1 mt-0.5 transition-colors cursor-pointer w-full"
                                  title="Klik untuk ubah Ongkos Kirim Door to Door"
                                >
                                  <Truck className="w-3 h-3 text-indigo-500 shrink-0" />
                                  <span className="truncate">Ongkir: {formatRupiah(tx.shippingCost)}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEdit(tx);
                                  }}
                                  className="text-[10px] font-medium text-slate-400 hover:text-indigo-600 flex items-center justify-end gap-1 mt-0.5 transition-colors cursor-pointer w-full"
                                  title="Input Ongkos Kirim (Door to Door) untuk transaksi ini"
                                >
                                  <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>+ Ongkir</span>
                                </button>
                              )
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-medium max-w-xs truncate" title={tx.notes}>
                            {tx.notes || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleRowExpansion(tx.id)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                  isExpanded
                                    ? 'bg-slate-200 text-slate-800'
                                    : isPembelian
                                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                                }`}
                                title="Lihat Rincian Produk"
                              >
                                <span>{isExpanded ? 'Tutup' : 'Lihat'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              {/* Tombol Edit Transaksi (Untuk Developer/Admin atau Transaksi Pembelian Bahan agar user bisa menginput/mengubah Ongkir Door to Door) */}
                              {(canManage || isPembelian) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(tx)}
                                  className="p-1 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                                  title={`Edit Transaksi #${tx.id} (Input Ongkir / Koreksi)`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(tx)}
                                  className="p-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                  title={`Hapus Transaksi #${tx.id} (Developer & Admin)`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Table for Items in this Transaction */}
                        {isExpanded && (
                          <tr className={isPembelian ? 'bg-emerald-50/30' : 'bg-rose-50/30'}>
                            <td colSpan={8} className="p-3 pl-8">
                              <div className={`bg-white rounded-xl p-3.5 border shadow-2xs space-y-2.5 ${
                                isPembelian ? 'border-emerald-200' : 'border-rose-200'
                              }`}>
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span className={`flex items-center gap-1.5 font-bold text-xs ${
                                      isPembelian ? 'text-emerald-900' : 'text-rose-900'
                                    }`}>
                                      <Boxes className="w-4 h-4" />
                                      Rincian Seluruh Bahan / Produk pada Transaksi #{tx.id} ({itemCount} Macam Produk)
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      • Total Nilai: <strong className="text-slate-900">{formatRupiah(tx.totalAmount)}</strong>
                                    </span>
                                  </div>

                                  {/* Download and Developer/Pembelian Action Buttons for this Single Transaction */}
                                  <div className="flex items-center gap-2">
                                    {(canManage || isPembelian) && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEdit(tx)}
                                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                                        title={isPembelian ? `Edit Transaksi / Input Ongkir Door to Door #${tx.id}` : `Edit Data Transaksi #${tx.id} (Developer & Admin)`}
                                      >
                                        <Pencil className="w-3.5 h-3.5 text-amber-100" />
                                        <span>{isPembelian ? 'Edit Transaksi / Ongkir' : 'Edit Transaksi'}</span>
                                      </button>
                                    )}

                                    {canManage && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDelete(tx)}
                                        className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                                        title={`Hapus Permanen Transaksi #${tx.id} (Developer & Admin)`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-100" />
                                        <span>Hapus Transaksi</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => exportSingleStockTransactionToExcel(tx, isPembelian ? 'PEMBELIAN' : 'PENGAMBILAN', storeName, products)}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                                      title={`Download file Excel untuk Transaksi #${tx.id}`}
                                    >
                                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
                                      <span>Download Excel</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        try {
                                          exportSingleStockTransactionToPDF(tx, isPembelian ? 'PEMBELIAN' : 'PENGAMBILAN', { storeName, products });
                                        } catch (err) {
                                          console.error('Download single stock PDF error:', err);
                                          alert('Gagal membuat PDF transaksi ini. Silakan coba lagi.');
                                        }
                                      }}
                                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                                      title={`Download dokumen PDF untuk Transaksi #${tx.id}`}
                                    >
                                      <FileText className="w-3.5 h-3.5 text-red-100" />
                                      <span>Download PDF</span>
                                    </button>
                                  </div>
                                </div>

                                <table className="w-full text-left text-[11px]">
                                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                    <tr>
                                      <th className="py-2 px-3">No</th>
                                      <th className="py-2 px-3">Kode / SKU</th>
                                      <th className="py-2 px-3">Nama Produk / Bahan</th>
                                      <th className="py-2 px-3">Kategori</th>
                                      <th className="py-2 px-3 text-center">Jumlah (Qty)</th>
                                      <th className="py-2 px-3 text-right">
                                        {isPembelian ? 'Harga Kulak (HPP)' : 'Harga Jual Satuan'}
                                      </th>
                                      {!isPembelian && (
                                        <th className="py-2 px-3 text-right text-slate-600">
                                          Modal Satuan (HPP)
                                        </th>
                                      )}
                                      <th className="py-2 px-3 text-right">Subtotal</th>
                                      {!isPembelian && (
                                        <th className="py-2 px-3 text-right bg-emerald-50 text-emerald-900">
                                          Laba Bersih
                                        </th>
                                      )}
                                      <th className="py-2 px-3">Catatan Item</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {tx.items.map((it, idx) => {
                                      const prod =
                                        (it.productId ? productMap.get(it.productId) : null) ||
                                        (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
                                        (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
                                      const pData = !isPembelian ? calculateStockItemProfit(it, prod) : null;

                                      return (
                                        <tr key={idx} className="hover:bg-slate-50/80">
                                          <td className="py-2 px-3 text-slate-500 font-medium">{idx + 1}</td>
                                          <td className="py-2 px-3 font-mono text-slate-600">{it.code || '-'}</td>
                                          <td className="py-2 px-3 font-bold text-slate-900">{it.productName}</td>
                                          <td className="py-2 px-3 text-slate-600">
                                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                              {it.category || 'Bahan'}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold text-blue-700">
                                            {it.qty} {it.unit || 'pcs'}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                                            {formatRupiah(it.price)}
                                          </td>
                                          {!isPembelian && (
                                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                                              {formatRupiah(pData?.costPerUnit || 0)}
                                            </td>
                                          )}
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                            {formatRupiah(it.totalPrice)}
                                          </td>
                                          {!isPembelian && (
                                            <td className="py-2 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                                              {formatRupiah(pData?.totalProfit || 0)}
                                            </td>
                                          )}
                                          <td className="py-2 px-3 text-slate-500">
                                            {it.notes || '-'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>

                                {/* Footer Info / Summary in Expanded View */}
                                {(() => {
                                  let txCost = 0;
                                  let txProfit = 0;
                                  if (!isPembelian) {
                                    tx.items.forEach((it) => {
                                      const prod =
                                        (it.productId ? productMap.get(it.productId) : null) ||
                                        (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
                                        (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
                                      const pData = calculateStockItemProfit(it, prod);
                                      txCost += pData.totalCost;
                                      txProfit += pData.totalProfit;
                                    });
                                  }

                                  return (
                                    <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                                      <div>
                                        {tx.notes && (
                                          <span><strong>Catatan Faktur:</strong> {tx.notes}</span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-4 font-semibold">
                                        <span>Total Qty: <strong className="text-slate-900">{formatVolume(tx.totalQty)} {tx.items[0]?.unit || 'Unit'}</strong></span>
                                        {!isPembelian && (
                                          <span>Total Modal Kulak: <strong className="font-mono text-slate-700">{formatRupiah(txCost)}</strong></span>
                                        )}
                                        {isPembelian && (
                                          <span>
                                            Subtotal Bahan: <strong className="font-mono text-slate-800">{formatRupiah((tx.totalAmount || 0) - (tx.shippingCost || 0))}</strong>
                                          </span>
                                        )}
                                        {isPembelian && (
                                          tx.shippingCost && tx.shippingCost > 0 ? (
                                            <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1 font-sans">
                                              <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                              Ongkir Door to Door: <strong className="font-mono text-indigo-900 font-bold">{formatRupiah(tx.shippingCost)}</strong>
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenEdit(tx)}
                                              className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 cursor-pointer flex items-center gap-1 font-bold text-[10px]"
                                              title="Input Ongkos Kirim (Door to Door)"
                                            >
                                              <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                              <span>+ Input Ongkos Kirim</span>
                                            </button>
                                          )
                                        )}
                                        <span>Total Nilai Transaksi: <strong className={`font-mono text-sm ${isPembelian ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupiah(tx.totalAmount)}</strong></span>
                                        {!isPembelian && (
                                          <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                                            Total Laba: <strong className="font-mono text-emerald-900 font-bold">{formatRupiah(txProfit)}</strong>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        )}

                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <p className="text-sm font-semibold">
                        Tidak ada data transaksi {reportTab === 'pembelian_bahan' ? 'pembelian bahan' : 'pengambilan bahan'} pada filter periode ini.
                      </p>
                      <p className="text-xs mt-1">Coba ubah tanggal atau rentang waktu di atas.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
        </div>
      )}
      </div>
      )}

      {/* Edit Stock Transaction Modal (Developer & Pembelian Bahan) */}
      {isEditModalOpen && (
        <EditStockTransactionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingStockTx(null);
          }}
          transaction={editingStockTx}
          products={products}
          suppliers={suppliers}
          agents={agents}
          productCategories={productCategories}
          onSave={handleSaveEditedTx}
        />
      )}

      {/* Developer Delete Confirmation Modal */}
      {canManage && isDeleteModalOpen && deletingStockTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Konfirmasi Hapus Transaksi</h3>
                  <span className="text-[10px] font-mono text-rose-100 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-300" />
                    AKSES KHUSUS DEVELOPER & ADMIN
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingStockTx(null);
                }}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus transaksi <strong>{deletingStockTx.type === 'PEMBELIAN' ? 'Pembelian Bahan' : 'Pengambilan Bahan'}</strong> ini?
                Data akan dihapus secara permanen dari database cloud dan tidak dapat dikembalikan.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2 font-medium text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">No. Transaksi:</span>
                  <strong className="font-mono text-slate-900 bg-slate-200/70 px-2 py-0.5 rounded">#{deletingStockTx.id}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tanggal & Waktu:</span>
                  <span className="font-mono text-slate-900">{deletingStockTx.date} {deletingStockTx.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{deletingStockTx.type === 'PEMBELIAN' ? 'Supplier / Distributor:' : 'Penerima / Agen:'}</span>
                  <strong className="text-slate-900">{deletingStockTx.supplierName}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Nilai Transaksi:</span>
                  <strong className="font-mono text-rose-600 font-black text-sm">{formatRupiah(deletingStockTx.totalAmount || 0)}</strong>
                </div>
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                  <span>Produk: </span>
                  <strong className="text-slate-800">
                    {normalizeStockTransaction(deletingStockTx).items.map(i => `${i.productName} (${i.qty} ${i.unit || 'unit'})`).join(', ')}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeletingStockTx(null);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? 'Menghapus Data...' : 'Ya, Hapus Permanen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Developer Edit Sales Transaction Modal */}
      {canManage && isEditSalesModalOpen && editingSalesTx && (
        <EditSalesTransactionModal
          isOpen={isEditSalesModalOpen}
          onClose={() => {
            setIsEditSalesModalOpen(false);
            setEditingSalesTx(null);
          }}
          transaction={editingSalesTx}
          onSaveTransaction={handleSaveEditedSalesTx}
        />
      )}

      {/* Developer Delete Sales Transaction Confirmation Modal */}
      {canManage && isDeleteSalesModalOpen && deletingSalesTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Konfirmasi Hapus Transaksi Penjualan</h3>
                  <span className="text-[10px] font-mono text-rose-100 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-300" />
                    AKSES KHUSUS DEVELOPER & ADMIN
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteSalesModalOpen(false);
                  setDeletingSalesTx(null);
                }}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus <strong>Transaksi Penjualan Toko</strong> ini?
                Data akan dihapus secara permanen dari Laporan Penjualan dan database cloud.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2 font-medium text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">No. Invoice:</span>
                  <strong className="font-mono text-slate-900 bg-slate-200/70 px-2 py-0.5 rounded">#{deletingSalesTx.id}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tanggal & Waktu:</span>
                  <span className="font-mono text-slate-900">{deletingSalesTx.date} {deletingSalesTx.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Pelanggan:</span>
                  <strong className="text-slate-900">{deletingSalesTx.customer?.name || 'Pelanggan Umum'}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Kasir:</span>
                  <span className="font-bold text-blue-900 uppercase">{deletingSalesTx.cashierName} ({deletingSalesTx.shiftName || 'Shift 1'})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Tagihan:</span>
                  <strong className="font-mono text-rose-600 font-black text-sm">{formatRupiah(deletingSalesTx.total || 0)}</strong>
                </div>
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                  <span>Produk/Jasa: </span>
                  <strong className="text-slate-800">
                    {deletingSalesTx.items.map(i => `${i.name} (${i.qty}x)`).join(', ')}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteSalesModalOpen(false);
                    setDeletingSalesTx(null);
                  }}
                  disabled={isDeletingSales}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSales}
                  disabled={isDeletingSales}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeletingSales ? 'Menghapus Data...' : 'Ya, Hapus Permanen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Feedback Notification */}
      {actionToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-medium border ${
              actionToast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-rose-900 text-white border-rose-800'
            }`}
          >
            {actionToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
            )}
            <span>{actionToast.message}</span>
            <button
              type="button"
              onClick={() => setActionToast(null)}
              className="text-slate-400 hover:text-white ml-2 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
