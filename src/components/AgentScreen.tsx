/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  UserCheck,
  Package,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Send,
  Calendar,
  Sparkles,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Check,
  Tag,
  ArrowRight,
  Phone,
  Store,
  X,
  MessageSquare,
  MessageCircle,
  ExternalLink,
  Copy,
  CheckCheck,
  Download,
  BarChart3,
  List,
  TrendingUp,
  CalendarDays,
  Image as ImageIcon,
  ZoomIn
} from 'lucide-react';

const INDONESIAN_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function formatMonthYearLabel(monthKey: string): string {
  if (!monthKey || monthKey === 'ALL') return 'Semua Bulan';
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const year = parseInt(yearStr, 10);
  if (isNaN(monthIdx) || isNaN(year) || monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${INDONESIAN_MONTH_NAMES[monthIdx]} ${year}`;
}
import {
  Product,
  Agent,
  ProductCategoryItem,
  StockTransaction,
  StockTransactionItem,
  UserRole,
  AppUser,
  Transaction,
  Customer,
  AgentNotification
} from '../types';
import { saveAgentNotificationCloud } from '../backend/pocketbaseBackend';
import { exportStockTransactionsToPDF } from '../utils/pdfExport';
import { resolveAgentForUser } from '../utils/agentMapping';
import {
  buildRecapPeriodLabel,
  formatRecapDayLabel,
  getAgentDayKey,
  getAgentMonthKey,
  getCurrentLocalMonthKey,
  matchesRecapPeriod,
  normalizeAgentDateRange,
  type RecapPeriodConfig
} from '../utils/agentHistoryPeriod';
import {
  formatRupiah,
  formatNumber,
  formatNumberInput,
  parseNumber,
  getTransactionDateTimeEpoch
} from '../utils/formatters';
import {
  getProductStockPrice,
  getMaterialStockFormula,
  formatStockDisplay,
  isMeterOrLembarUnit,
  getProductRollPakQty,
  getProductAvailabilityStatus,
  groupStockTransactionsByBatch
} from '../utils/stockUtils';
import {
  isDigitalPrintingProduct,
  isProductionSuppliesProduct,
  isPaketProduct,
  getAgentProductActionLabel,
  isAgentJasaCetakProduct
} from '../utils/productFilters';
import { StoreInfo, getStoredPrintSettings } from '../utils/storage';
import { printThermalElement } from '../utils/thermalPrinter';
import { ProductImageModal } from './modals/ProductImageModal';

export interface AgentOrderItem {
  id: string;
  productId: string;
  productName: string;
  code?: string;
  category: string;
  unit: string;
  unitMode: 'roll_pak' | 'meter_lembar';
  qty: number;
  lengthMeters?: number;
  widthMeters?: number;
  sqm?: number;
  price: number; // Harga Agen per unit/meter
  totalPrice: number;
  notes?: string; // Catatan file cetak / finishing
  availableStock: number;
  stockFormulaText?: string;
}

// Periode riwayat agen & rekap PDF: normalisasi tanggal ada di utils/agentHistoryPeriod.

interface AgentScreenProps {
  products: Product[];
  agents: Agent[];
  productCategories?: ProductCategoryItem[];
  stockTransactions?: StockTransaction[];
  transactions?: Transaction[];
  customers?: Customer[];
  storeInfo?: StoreInfo;
  userRole?: UserRole;
  currentUser?: AppUser | null;
  onAddStockTransaction: (tx: Omit<StockTransaction, 'id' | 'timestamp' | 'date' | 'time'> & { date?: string; id?: string }) => void;
  onAddBatchStockTransactions?: (txList: (Omit<StockTransaction, 'id' | 'timestamp' | 'date' | 'time'> & { date?: string; id?: string })[]) => void;
  onUpdateProductStockAndCost?: (productId: string, newStock: number, newCostPrice: number) => void;
  onUpdateBatchProductStockAndCost?: (updates: { productId: string; newStock: number; newCostPrice?: number; newHargaAgen?: number; newHargaMeterGrosir?: number }[]) => void;
  onPrintReceiptDirect?: (tx: any) => void;
  defaultSubTab?: 'katalog_order' | 'riwayat';
}

export const AgentScreen: React.FC<AgentScreenProps> = ({
  products,
  agents,
  productCategories = [],
  stockTransactions = [],
  transactions = [],
  customers = [],
  storeInfo,
  userRole = 'DEVELOPER',
  currentUser,
  onAddStockTransaction,
  onAddBatchStockTransactions,
  onUpdateProductStockAndCost,
  onUpdateBatchProductStockAndCost,
  onPrintReceiptDirect,
  defaultSubTab
}) => {
  // Determine if active user is an AGEN account
  const isAgentUser = userRole === 'AGEN' || currentUser?.role === 'AGEN';
  const isAdminUser = userRole === 'ADMIN' || currentUser?.role === 'ADMIN';
  const isDeveloperUser = userRole === 'DEVELOPER' || currentUser?.role === 'DEVELOPER';
  const isOwnerUser = userRole === 'OWNER' || currentUser?.role === 'OWNER';
  const isDeveloperOrAdminOrOwner = isDeveloperUser || isAdminUser || isOwnerUser;
  const assignedAgentInfo = useMemo(() => {
    return resolveAgentForUser(currentUser);
  }, [currentUser]);
  const assignedAgentName = assignedAgentInfo.agentName;

  // Filter visible agents list: if AGEN user, strictly only display their own agent profile (others hidden)
  const visibleAgents = useMemo(() => {
    if (isAgentUser) {
      const cleanAssigned = assignedAgentName.toLowerCase().trim();
      const matched = agents.filter(
        (a) =>
          a.name.toLowerCase().trim() === cleanAssigned ||
          (currentUser?.username && a.name.toLowerCase().includes(currentUser.username.toLowerCase().trim()))
      );
      if (matched.length > 0) {
        return [matched[0]];
      }
      return [
        {
          id: `agent_${currentUser?.username || 'assigned'}`,
          name: assignedAgentName,
          phone: currentUser?.phone || '0812-3456-7890',
          address: assignedAgentInfo.storeName,
          commissionRate: 'Mitra Resmi Agen'
        }
      ];
    }
    return agents;
  }, [agents, isAgentUser, assignedAgentName, currentUser, assignedAgentInfo]);

  // Sub-tabs: 'katalog_order' (Katalog + Pengambilan Bahan) or 'riwayat' (Histori Pengambilan)
  const [activeSubTab, setActiveSubTab] = useState<'katalog_order' | 'riwayat'>(() => {
    if (defaultSubTab) return defaultSubTab;
    const isPowerUser = userRole === 'ADMIN' || currentUser?.role === 'ADMIN' || userRole === 'OWNER' || currentUser?.role === 'OWNER';
    return isPowerUser ? 'riwayat' : 'katalog_order';
  });

  React.useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  // Selected Agent State
  const [selectedAgentName, setSelectedAgentName] = useState<string>(() => {
    if (isAgentUser) return assignedAgentName;
    return agents.length > 0 ? agents[0].name : 'Agen Utama';
  });
  const [customAgentInput, setCustomAgentInput] = useState('');
  const [isCustomAgentMode, setIsCustomAgentMode] = useState(false);

  // Lock selected agent when logged in as AGEN
  React.useEffect(() => {
    if (isAgentUser) {
      setSelectedAgentName(assignedAgentName);
      setIsCustomAgentMode(false);
    }
  }, [isAgentUser, assignedAgentName]);

  // Lock active sub-tab for non-authorized roles
  React.useEffect(() => {
    if (!isDeveloperOrAdminOrOwner && !isAgentUser) {
      setActiveSubTab('katalog_order');
    }
  }, [isDeveloperOrAdminOrOwner, isAgentUser]);

  // Transaction Info
  const [transactionDate, setTransactionDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [generalOrderNotes, setGeneralOrderNotes] = useState('');

  // Cart / Items Builder
  const [orderItems, setOrderItems] = useState<AgentOrderItem[]>([]);

  // Product Catalog Search & Category Filters
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK'>('ALL');

  // Quick Add Item / Custom Dimension Modal
  const [activeConfigureProduct, setActiveConfigureProduct] = useState<Product | null>(null);
  const [configUnitMode, setConfigUnitMode] = useState<'roll_pak' | 'meter_lembar'>('roll_pak');
  const [configQty, setConfigQty] = useState<number | ''>(1);
  const [configLength, setConfigLength] = useState<string>('1');
  const [configWidth, setConfigWidth] = useState<string>('1');
  const [configPrice, setConfigPrice] = useState<string>('');
  const [configNotes, setConfigNotes] = useState<string>('');
  const [configError, setConfigError] = useState<string | null>(null);

  // Image Zoom / Preview Modal
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
    code?: string;
    category?: string;
    dimensions?: string;
  } | null>(null);

  // Riwayat Filters & Monthly View Mode
  const [historySearch, setHistorySearch] = useState('');
  const [historyAgentFilter, setHistoryAgentFilter] = useState<string>('ALL');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'ALL' | 'PENGAMBILAN_BAHAN' | 'CETAK_AGEN'>('ALL');
  const [historyMonthFilter, setHistoryMonthFilter] = useState<string>('ALL');
  const [historyPeriodMode, setHistoryPeriodMode] = useState<'BULAN' | 'RENTANG'>('BULAN');
  const [historyRangeFrom, setHistoryRangeFrom] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [historyRangeTo, setHistoryRangeTo] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [historyViewMode, setHistoryViewMode] = useState<'list' | 'monthly_summary'>('list');
  const [expandedMonthlyCards, setExpandedMonthlyCards] = useState<Record<string, boolean>>({});

  // PDF Download Recap Modal State
  const [showDownloadRecapModal, setShowDownloadRecapModal] = useState(false);
  const [recapPeriodType, setRecapPeriodType] = useState<'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'KUSTOM'>('BULANAN');
  const [recapDate, setRecapDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [recapMonth, setRecapMonth] = useState<number>(new Date().getMonth());
  const [recapYear, setRecapYear] = useState<number>(new Date().getFullYear());
  const [recapAgent, setRecapAgent] = useState<string>('ALL');
  const [recapRangeFrom, setRecapRangeFrom] = useState<string>(historyRangeFrom);
  const [recapRangeTo, setRecapRangeTo] = useState<string>(historyRangeTo);

  // Receipt / Surat Jalan Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [printedTransactionData, setPrintedTransactionData] = useState<{
    transactionNumber: string;
    date: string;
    time: string;
    agentName: string;
    items: AgentOrderItem[];
    totalAmount: number;
    notes?: string;
  } | null>(null);

  // Auto-Print Surat Jalan if enabled in Print Settings
  useEffect(() => {
    if (showReceiptModal && printedTransactionData) {
      const settings = getStoredPrintSettings();
      if (settings.autoPrintOnSuratJalan) {
        const timer = setTimeout(() => {
          printThermalElement('thermal-receipt', {
            paperSize: settings.paperSize,
            printMarginMm: settings.printMarginMm
          });
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [showReceiptModal, printedTransactionData?.transactionNumber]);

  // Success / Alert message
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // WhatsApp Admin Pusat Features
  const ADMIN_WA_NUMBER = '6285133360276';
  const ADMIN_WA_DISPLAY = '085133360276';
  const ADMIN_WA_FORMATTED = '0851-3336-0276';

  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatTemplateKey, setChatTemplateKey] = useState<string>('umum');
  const [isCopied, setIsCopied] = useState(false);

  const displayAgentName = isCustomAgentMode ? (customAgentInput.trim() || 'Agen Kustom') : selectedAgentName;
  const matchedAgentObject = agents.find((a) => a.name.toLowerCase() === displayAgentName.toLowerCase());

  const getRealTimeTimestamp = () => {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `\n\n_(Dikirim pada: ${dayName}, ${day} ${monthName} ${year} - Pukul ${hours}:${minutes} WIB)_`;
  };

  // Function to open WhatsApp Chat modal with appropriate template
  const handleOpenChat = (
    presetType: 'umum' | 'stok' | 'order' | 'cetak' | 'order_cart' = 'umum',
    specificProduct?: Product
  ) => {
    const agentName = displayAgentName || 'Mitra Agen';
    let defaultMsg = '';

    if (specificProduct) {
      const avail = getProductAvailabilityStatus(specificProduct);
      defaultMsg = `Halo Admin Pusat BEJO Digital Print,\nSaya ${agentName}.\n\nKak, mau cek donk produk ini ready stock ga ya?:\n• *Nama Produk:* ${specificProduct.name}\n• *Kode SKU:* ${specificProduct.code || '-'}\n• *Status Ketersediaan di POS:* ${avail.text}\n\nApakah stok siap diambil sekarang? Lek Amin mau titip dibawaain apa :) Terima kasih!`;
      setChatTemplateKey('stok_produk');
    } else if (presetType === 'order_cart' && orderItems.length > 0) {
      const itemsList = orderItems
        .map(
          (it, idx) =>
            `${idx + 1}. *${it.productName}*\n   - Qty: ${it.qty} ${it.unit}${it.lengthMeters && it.widthMeters ? ` (${it.lengthMeters}x${it.widthMeters}m = ${it.sqm?.toFixed(2)} m²)` : ''}`
        )
        .join('\n');
      defaultMsg = `Halo Mba Fira,\nSaya ${agentName}.\n\nIni ya Kak detail pesanan ambil bahan dan cetak yang udah aku buat di Portal Agen:\n\n${itemsList}\n\n*TOTAL BARANG: ${orderTotalQty} Unit*\n${generalOrderNotes ? `*Catatan Khusus:* ${generalOrderNotes}\n` : ''}\nMohon dicek dan dipersiapkan barangnya ya mba Fira. Terima kasih!`;
      setChatTemplateKey('order_cart');
    } else if (presetType === 'stok') {
      defaultMsg = `Halo Mba Fira,\nSaya ${agentName}.\n\nKak, tolong cek stok bahan toko buat hari ini donk, masih ada gak ya? Makasih banyak!`;
      setChatTemplateKey('stok');
    } else if (presetType === 'cetak') {
      defaultMsg = `Halo Mba Fira,\nSaya ${agentName}.\n\nHalo! Mau kirim file desain buat orderan cetak nih. Boleh info antrean mesin hari ini sama kira-kira selesainya kapan? Makasih ya!`;
      setChatTemplateKey('cetak');
    } else if (presetType === 'order') {
      defaultMsg = `Halo Mba Fira,\nSaya ${agentName}.\n\nHalo, mau konfirmasi nih kalau hari ini jadwalnya anter bahan dari gudang Polsek. Lek Amin udah siap belom ya? Kabarin ya, makasih!`;
      setChatTemplateKey('order');
    } else {
      defaultMsg = `Halo Mba Fira,\nSaya dari *${agentName}*.\n\nHalo Kak, mau ngobrol-ngobrol santai dulu dong soal pesanan sama ketersediaan stok produknya. Lagi senggang gak? Makasih ya!`;
      setChatTemplateKey('umum');
    }

    setChatMessage(defaultMsg + getRealTimeTimestamp());
    setShowChatModal(true);
  };

  const handleSelectTemplate = (key: 'umum' | 'stok' | 'order' | 'cetak' | 'order_cart') => {
    handleOpenChat(key);
  };

  const handleSendWhatsApp = () => {
    let textToSend = chatMessage.trim() || `Halo Admin Pusat BEJO Digital Print, saya ${displayAgentName}.`;
    if (!textToSend.includes('(Dikirim pada:')) {
      textToSend = `${textToSend}${getRealTimeTimestamp()}`;
    }
    const encodedText = encodeURIComponent(textToSend);
    const waUrl = `https://wa.me/${ADMIN_WA_NUMBER}?text=${encodedText}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMessage = () => {
    if (!chatMessage) return;
    let textToCopy = chatMessage.trim();
    if (!textToCopy.includes('(Dikirim pada:')) {
      textToCopy = `${textToCopy}${getRealTimeTimestamp()}`;
    }
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Filtered Catalog Products
  const filteredCatalogProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query
      const q = catalogSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.dimensions && p.dimensions.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);

      // 2. Category Filter
      let matchCategory = true;
      if (selectedCategoryFilter !== 'ALL') {
        matchCategory = p.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
      }

      // 3. Stock Status Filter
      let matchStock = true;
      const status = getProductAvailabilityStatus(p);
      if (stockStatusFilter === 'IN_STOCK') {
        matchStock = status.isAlwaysAvailable || (!status.isZeroStock && (p.stock || 0) > 0);
      } else if (stockStatusFilter === 'LOW_STOCK') {
        matchStock = status.isZeroStock || status.isLowStock;
      }

      return matchSearch && matchCategory && matchStock;
    });
  }, [products, catalogSearch, selectedCategoryFilter, stockStatusFilter]);

  // All Category List with Count
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: products.length };
    products.forEach((p) => {
      const cat = p.category || 'bahan';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Calculate Order Totals
  const orderTotalAmount = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [orderItems]);

  const orderTotalQty = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.qty, 0);
  }, [orderItems]);

  // Open Configure Product for Adding to Order
  const handleOpenConfigure = (product: Product) => {
    setActiveConfigureProduct(product);
    setConfigError(null);
    setConfigNotes('');

    const isJasaCetak = isAgentJasaCetakProduct(product, productCategories);
    const defaultMode: 'roll_pak' | 'meter_lembar' = isJasaCetak ? 'meter_lembar' : 'roll_pak';
    setConfigUnitMode(defaultMode);
    setConfigQty(1);
    setConfigLength('1');
    setConfigWidth('1');

    // Get default agent price
    const defaultPrice = getProductStockPrice(product, 'PENGAMBILAN', defaultMode);
    const finalPrice = defaultPrice > 0 ? defaultPrice : (product.hargaAgen || product.price || 0);
    setConfigPrice(formatNumber(finalPrice));
  };

  // Change unit mode in configuration modal
  const handleConfigUnitModeChange = (mode: 'roll_pak' | 'meter_lembar') => {
    setConfigUnitMode(mode);
    if (activeConfigureProduct) {
      const price = getProductStockPrice(activeConfigureProduct, 'PENGAMBILAN', mode);
      const finalPrice = price > 0 ? price : (activeConfigureProduct.hargaAgen || activeConfigureProduct.price || 0);
      setConfigPrice(formatNumber(finalPrice));
    }
  };

  // Add configured item to order cart
  const handleConfirmAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConfigureProduct) return;

    const numQty = typeof configQty === 'number' ? configQty : parseFloat(String(configQty)) || 0;
    if (numQty <= 0) {
      setConfigError('Jumlah / Qty harus lebih dari 0.');
      return;
    }

    const numericPrice = parseNumber(configPrice);
    if (numericPrice < 0) {
      setConfigError('Harga satuan tidak boleh negatif.');
      return;
    }

    const formula = getMaterialStockFormula(activeConfigureProduct);
    const isJasaCetak = isAgentJasaCetakProduct(activeConfigureProduct, productCategories);

    let calculatedItemTotal = 0;
    let lengthNum: number | undefined;
    let widthNum: number | undefined;
    let sqmNum: number | undefined;

    if (configUnitMode === 'meter_lembar' && isJasaCetak) {
      const cleanLenStr = configLength.replace(',', '.').trim();
      const cleanWidStr = configWidth.replace(',', '.').trim();
      lengthNum = parseFloat(cleanLenStr) || 1;
      widthNum = parseFloat(cleanWidStr) || 1;
      sqmNum = lengthNum * widthNum;
      calculatedItemTotal = Math.round(sqmNum * numQty * numericPrice);
    } else {
      calculatedItemTotal = Math.round(numQty * numericPrice);
    }

    const unitLabel = configUnitMode === 'roll_pak' ? formula.unit : formula.subUnit;

    const newItem: AgentOrderItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: activeConfigureProduct.id,
      productName: activeConfigureProduct.name,
      code: activeConfigureProduct.code,
      category: activeConfigureProduct.category,
      unit: unitLabel,
      unitMode: configUnitMode,
      qty: numQty,
      lengthMeters: lengthNum,
      widthMeters: widthNum,
      sqm: sqmNum,
      price: numericPrice,
      totalPrice: calculatedItemTotal,
      notes: configNotes.trim() || undefined,
      availableStock: activeConfigureProduct.stock || 0,
      stockFormulaText: formula.formulaText
    };

    setOrderItems((prev) => [...prev, newItem]);
    setActiveConfigureProduct(null);
    setFeedbackMessage({
      type: 'success',
      text: `Berhasil menambahkan "${activeConfigureProduct.name}" ke daftar pengambilan.`
    });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Remove Item from Order
  const handleRemoveOrderItem = (itemId: string) => {
    setOrderItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Update Item Qty in Cart
  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) return;
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const isPrinting = item.sqm && item.sqm > 0;
          const newTotal = isPrinting
            ? Math.round(item.sqm! * newQty * item.price)
            : Math.round(newQty * item.price);
          return { ...item, qty: newQty, totalPrice: newTotal };
        }
        return item;
      })
    );
  };

  // Process & Submit Agent Order / Retrieval
  const handleSubmitAgentOrder = () => {
    if (orderItems.length === 0) {
      setFeedbackMessage({
        type: 'error',
        text: 'Daftar pengambilan bahan masih kosong. Silakan pilih produk dari katalog.'
      });
      setTimeout(() => setFeedbackMessage(null), 3500);
      return;
    }

    const agentName = displayAgentName.trim();
    if (!agentName) {
      setFeedbackMessage({
        type: 'error',
        text: 'Nama Agen Mitra wajib dipilih atau diisi.'
      });
      setTimeout(() => setFeedbackMessage(null), 3500);
      return;
    }

    const today = new Date();
    const dateFormatted = transactionDate || today.toISOString().slice(0, 10);
    const timeFormatted = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:${String(today.getSeconds()).padStart(2, '0')}`;
    const txId = `PG-AGEN-${Date.now().toString().slice(-6)}`;

    // Prepare StockTransaction Multi-Item format
    const stockItems: StockTransactionItem[] = orderItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      code: item.code,
      qty: item.qty,
      price: item.price,
      totalPrice: item.totalPrice,
      unit: item.unit,
      notes: item.notes
        ? `${item.notes}${item.lengthMeters && item.widthMeters ? ` (${item.lengthMeters}x${item.widthMeters}m)` : ''}`
        : item.lengthMeters && item.widthMeters
        ? `Dimensi: ${item.lengthMeters}m x ${item.widthMeters}m (${item.sqm?.toFixed(2)} m²)`
        : undefined
    }));

    // Check if order contains printing/cetak materials or custom dimensions
    const hasPrintingItem = orderItems.some((it) => {
      const prod = products.find((p) => p.id === it.productId);
      return (
        (prod && isDigitalPrintingProduct(prod)) ||
        (it.sqm && it.sqm > 0) ||
        (it.category && (it.category.toLowerCase().includes('cetak') || it.category.toLowerCase().includes('digital')))
      );
    });

    const orderType: 'PENGAMBILAN_BAHAN' | 'CETAK_AGEN' = hasPrintingItem ? 'CETAK_AGEN' : 'PENGAMBILAN_BAHAN';
    const orderTypeLabel = orderType === 'CETAK_AGEN' ? 'Cetak Agen' : 'Pengambilan Bahan';

    // 1. Record stock transaction
    onAddStockTransaction({
      id: txId,
      type: 'PENGAMBILAN',
      date: dateFormatted,
      supplierName: agentName,
      items: stockItems,
      totalQty: orderTotalQty,
      totalAmount: orderTotalAmount,
      notes: generalOrderNotes.trim()
        ? `[${orderTypeLabel} Portal] ${generalOrderNotes.trim()}`
        : `[${orderTypeLabel} Portal] Pesanan Mitra Agen ${agentName}`
    });

    // 2. Broadcast Real-time Notification to Cloud Database (PocketBase) for DEVELOPER & ADMIN
    const agentNotif: AgentNotification = {
      id: `notif_${txId}`,
      orderId: txId,
      orderType,
      agentName,
      agentUsername: currentUser?.username || 'agen',
      totalQty: orderTotalQty,
      totalAmount: orderTotalAmount,
      itemsCount: orderItems.length,
      itemSummary: orderItems.map((it) => `${it.productName} (${it.qty} ${it.unit})`).join(', '),
      items: orderItems.map((it) => ({
        productName: it.productName,
        qty: it.qty,
        unit: it.unit,
        totalPrice: it.totalPrice
      })),
      date: dateFormatted,
      time: timeFormatted,
      timestamp: Date.now(),
      notes: generalOrderNotes.trim() || undefined,
      readBy: []
    };
    saveAgentNotificationCloud(agentNotif).catch(console.error);

    // 2. Deduct product stocks
    if (onUpdateBatchProductStockAndCost) {
      const stockUpdates = orderItems.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const currentStock = prod?.stock || 0;
        const formula = getMaterialStockFormula(prod);

        let stockDeduction = item.qty;
        if (item.unitMode === 'meter_lembar' && formula.qtyPerRollPak > 1) {
          const lengthTotal = (item.lengthMeters && item.widthMeters)
            ? (item.lengthMeters * item.qty)
            : item.qty;
          stockDeduction = lengthTotal / formula.qtyPerRollPak;
        }

        const calculatedNewStock = Math.max(0, currentStock - stockDeduction);
        return {
          productId: item.productId,
          newStock: Number(calculatedNewStock.toFixed(2))
        };
      });

      onUpdateBatchProductStockAndCost(stockUpdates);
    }

    // 3. Prepare receipt modal
    setPrintedTransactionData({
      transactionNumber: txId,
      date: dateFormatted,
      time: timeFormatted,
      agentName: agentName,
      items: [...orderItems],
      totalAmount: orderTotalAmount,
      notes: generalOrderNotes
    });
    setShowReceiptModal(true);

    // 4. Reset cart
    setOrderItems([]);
    setGeneralOrderNotes('');
    setFeedbackMessage({
      type: 'success',
      text: `Pengambilan Bahan Agen #${txId} berhasil diproses & stok produk telah diperbarui!`
    });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Helper function to check if a transaction belongs to the logged-in agent
  const isTxForAgent = (supplierOrCustName: string | undefined, assignedName: string, username?: string): boolean => {
    const cleanSupplier = (supplierOrCustName || '').toLowerCase().trim();
    const cleanAssigned = (assignedName || '').toLowerCase().trim();
    const cleanUser = (username || '').toLowerCase().trim();

    if (!cleanSupplier) return false;
    if (cleanSupplier === cleanAssigned) return true;

    const branchKey = cleanAssigned.replace(/^bejo\s+/, '').trim();
    if (branchKey && cleanSupplier.includes(branchKey)) return true;
    if (cleanUser && cleanSupplier.includes(cleanUser)) return true;

    return false;
  };

  // Helper to identify if a POS transaction belongs to an AGEN customer (matches Laporan Agen)
  const isPosAgenTransaction = (tx: Transaction): boolean => {
    if (!tx) return false;
    const catStr = (tx.customerCategory || '').trim().toUpperCase();
    if (catStr === 'AGEN' || catStr === 'CAT_AGEN') return true;

    if (tx.customer) {
      const custCatId = (tx.customer.categoryId || '').trim().toLowerCase();
      if (custCatId === 'cat_agen') return true;

      const catObj = (productCategories || []).find((c: any) => c.id === tx.customer?.categoryId);
      if (catObj && (catObj.name || '').trim().toUpperCase() === 'AGEN') return true;

      if (tx.customer.name) {
        const cName = tx.customer.name.trim().toLowerCase();
        if ((agents || []).some((a: any) => a.name.trim().toLowerCase() === cName)) return true;
      }
    }
    return false;
  };

  // Konfigurasi periode rekap: satu sumber untuk predikat, pratinjau, dan judul PDF
  const recapPeriodConfig = useMemo<RecapPeriodConfig>(
    () => ({
      periodType: recapPeriodType,
      date: recapDate,
      month: recapMonth,
      year: recapYear,
      rangeFrom: recapRangeFrom,
      rangeTo: recapRangeTo,
    }),
    [recapPeriodType, recapDate, recapMonth, recapYear, recapRangeFrom, recapRangeTo]
  );

  // Dataset rekap untuk modal unduh PDF (satu sumber untuk pratinjau dan berkas)
  const recapDataset = useMemo(() => {
    const forAgent = (name?: string) =>
      recapAgent === 'ALL' || (name || '').toLowerCase().trim() === recapAgent.toLowerCase().trim();

    const filteredStockTx = (stockTransactions || []).filter(
      (tx) => tx.type === 'PENGAMBILAN' && forAgent(tx.supplierName) && matchesRecapPeriod(tx, recapPeriodConfig)
    );
    const filteredCetakTx = (transactions || []).filter(
      (tx) => isPosAgenTransaction(tx) && forAgent(tx.customer?.name) && matchesRecapPeriod(tx, recapPeriodConfig)
    );

    return { filteredStockTx, filteredCetakTx };
  }, [stockTransactions, transactions, recapAgent, recapPeriodConfig, isPosAgenTransaction]);

  // PDF Download Recap Helper
  const handleDownloadPdfRecap = () => {
    const { filteredStockTx, filteredCetakTx } = recapDataset;

    if (filteredStockTx.length === 0 && filteredCetakTx.length === 0) {
      alert('Belum ada transaksi untuk pilihan agen dan periode ini.');
      return;
    }

    const agentLabelText = recapAgent === 'ALL' ? 'Semua Agen' : recapAgent;
    const finalPeriodLabel = `${buildRecapPeriodLabel(recapPeriodConfig)} (${agentLabelText})`;

    try {
      exportStockTransactionsToPDF(
        filteredStockTx,
        'PENGAMBILAN',
        {
          periodType: recapPeriodType,
          periodLabel: finalPeriodLabel,
          storeName: storeInfo?.storeName || 'BEJO Digital Print',
          products: products
        },
        filteredCetakTx
      );
      setShowDownloadRecapModal(false);
    } catch (err) {
      console.error('Download recap PDF error:', err);
      alert('Gagal membuat file PDF rekap. Silakan coba lagi.');
    }
  };

  // Convert StockTransactions and POS Transactions into Unified Agent Transactions (1-to-1 matching Laporan Agen)
  const allUnifiedTransactions = useMemo(() => {
    const list: {
      id: string;
      transactionNumber: string;
      kind: 'PENGAMBILAN_BAHAN' | 'CETAK_AGEN';
      kindLabel: 'Pengambilan Bahan' | 'Cetak Agen';
      source: 'PORTAL_AGEN' | 'KASIR_POS';
      date: string;
      time: string;
      timestamp: number;
      agentName: string;
      items: {
        productId?: string;
        productName: string;
        code?: string;
        category?: string;
        qty: number;
        unit: string;
        price: number;
        totalPrice: number;
        notes?: string;
        lengthMeters?: number;
        widthMeters?: number;
        sqm?: number;
      }[];
      totalAmount: number;
      totalQty: number;
      notes?: string;
      rawStockTx?: StockTransaction;
      rawPosTx?: Transaction;
    }[] = [];

    // 1. Process Stock Transactions of type PENGAMBILAN grouped by batch (Exact 84 records, matches Laporan Agen Pengambilan Bahan)
    const groupedPengambilan = groupStockTransactionsByBatch(stockTransactions || []).filter(
      (stx) => stx.type === 'PENGAMBILAN'
    );

    groupedPengambilan.forEach((st) => {
      const timestamp = st.timestamp || getTransactionDateTimeEpoch(st);

      const itemsList = (st.items || []).map((it) => ({
        productId: it.productId,
        productName: it.productName,
        code: it.code,
        category: it.category || 'bahan',
        qty: it.qty,
        unit: it.unit || 'unit',
        price: it.price || 0,
        totalPrice: it.totalPrice || ((it.qty || 1) * (it.price || 0)),
        notes: it.notes
      }));

      list.push({
        id: st.id,
        transactionNumber: st.transactionNumber || st.id,
        kind: 'PENGAMBILAN_BAHAN',
        kindLabel: 'Pengambilan Bahan',
        source: 'PORTAL_AGEN',
        date: st.date || new Date().toISOString().slice(0, 10),
        time: st.time || '12:00:00',
        timestamp: timestamp,
        agentName: st.supplierName || 'Mitra Agen',
        items: itemsList,
        totalAmount: st.totalAmount || st.totalPrice || 0,
        totalQty: st.totalQty || itemsList.reduce((sum, it) => sum + it.qty, 0),
        notes: st.notes,
        rawStockTx: st
      });
    });

    // 2. Process POS Transactions for Agents (Exact 3 records, matches Laporan Agen Cetak Agen)
    const agenPosTxList = (transactions || []).filter((pt) => isPosAgenTransaction(pt));

    agenPosTxList.forEach((pt) => {
      const timestamp = pt.timestamp || getTransactionDateTimeEpoch(pt);

      const itemsList = (pt.items || []).map((it) => ({
        productId: it.productId,
        productName: it.productName || it.name,
        code: it.code,
        category: it.category || 'digital_printing',
        qty: it.qty,
        unit: it.unit || 'pcs',
        price: it.price,
        totalPrice: it.totalPrice || (it.qty * it.price),
        notes: it.notes || (it.length && it.width ? `Dimensi: ${it.length}x${it.width}m (${it.sqm?.toFixed(2)} m²)` : undefined),
        lengthMeters: it.length,
        widthMeters: it.width,
        sqm: it.sqm
      }));

      list.push({
        id: pt.id,
        transactionNumber: pt.id,
        kind: 'CETAK_AGEN',
        kindLabel: 'Cetak Agen',
        source: 'KASIR_POS',
        date: pt.date || new Date().toISOString().slice(0, 10),
        time: pt.time || '12:00:00',
        timestamp: timestamp,
        agentName: pt.customer?.name || 'Mitra Agen',
        items: itemsList,
        totalAmount: pt.total || pt.subtotal || 0,
        totalQty: pt.totalQty || itemsList.reduce((sum, it) => sum + it.qty, 0),
        notes: pt.notes || `[Transaksi Kasir POS] Kasir: ${pt.cashierName || 'Kasir'}`,
        rawPosTx: pt
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [stockTransactions, transactions, agents, productCategories]);

  // Available distinct months (YYYY-MM) from all transactions
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    allUnifiedTransactions.forEach((tx) => {
      const monthKey = getAgentMonthKey(tx);
      if (monthKey) {
        monthsSet.add(monthKey);
      }
    });
    const currentMonthKey = getCurrentLocalMonthKey();
    monthsSet.add(currentMonthKey);
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [allUnifiedTransactions]);

  // Statistics Breakdown for Current Filtered Agent Scope
  const scopedAgentTransactions = useMemo(() => {
    return allUnifiedTransactions.filter((tx) => {
      if (isAgentUser) {
        return isTxForAgent(tx.agentName, assignedAgentName, currentUser?.username);
      } else if (historyAgentFilter !== 'ALL') {
        return tx.agentName.toLowerCase().trim() === historyAgentFilter.toLowerCase().trim();
      }
      return true;
    });
  }, [allUnifiedTransactions, isAgentUser, assignedAgentName, currentUser, historyAgentFilter]);

  // Transaksi agen yang sudah dipotong pilihan periode (rentang tanggal / semua bulan)
  const periodScopedTransactions = useMemo(() => {
    if (historyPeriodMode !== 'RENTANG') return scopedAgentTransactions;
    const bounds = normalizeAgentDateRange(historyRangeFrom, historyRangeTo);
    return scopedAgentTransactions.filter((tx) => {
      const dayKey = getAgentDayKey(tx);
      return !!dayKey && dayKey >= bounds.from && dayKey <= bounds.to;
    });
  }, [scopedAgentTransactions, historyPeriodMode, historyRangeFrom, historyRangeTo]);

  // Label periode aktif untuk banner riwayat (rentang manual atau bulan terpilih)
  const historyPeriodLabel = useMemo(() => {
    if (historyPeriodMode === 'RENTANG') {
      const bounds = normalizeAgentDateRange(historyRangeFrom, historyRangeTo);
      return `${formatRecapDayLabel(bounds.from)} s.d ${formatRecapDayLabel(bounds.to)}`;
    }
    return formatMonthYearLabel(historyMonthFilter);
  }, [historyPeriodMode, historyRangeFrom, historyRangeTo, historyMonthFilter]);

  // Filtered Unified Agent Transactions (Applying Agent, Type, Month/Range, Search)
  const filteredUnifiedTransactions = useMemo(() => {
    return periodScopedTransactions.filter((tx) => {
      // 1. Transaction Type Filter (Pengambilan Bahan vs Cetak Agen)
      if (historyTypeFilter !== 'ALL') {
        if (tx.kind !== historyTypeFilter) {
          return false;
        }
      }

      // 2. Bulan hanya dipakai sebagai filter pada mode periode 'BULAN'
      if (historyPeriodMode === 'BULAN' && historyMonthFilter !== 'ALL') {
        const txMonth = getAgentMonthKey(tx);
        if (txMonth !== historyMonthFilter) {
          return false;
        }
      }

      // 3. Search query
      const q = historySearch.toLowerCase().trim();
      if (!q) return true;

      const matchId = (tx.id && tx.id.toLowerCase().includes(q)) || (tx.transactionNumber && tx.transactionNumber.toLowerCase().includes(q));
      const matchAgent = tx.agentName && tx.agentName.toLowerCase().includes(q);
      const matchNotes = tx.notes && tx.notes.toLowerCase().includes(q);
      const matchItems = tx.items && tx.items.some((it) => it.productName.toLowerCase().includes(q));

      return matchId || matchAgent || matchNotes || matchItems;
    });
  }, [periodScopedTransactions, historyTypeFilter, historyPeriodMode, historyMonthFilter, historySearch]);

  // Monthly Aggregated Summary Engine for Pengambilan Bahan & Cetak Agen
  const monthlyBahanSummary = useMemo(() => {
    const map = new Map<string, {
      monthKey: string;
      monthLabel: string;
      totalAmount: number;
      totalBahanAmount: number;
      totalBahanCount: number;
      totalBahanQty: number;
      totalCetakAmount: number;
      totalCetakCount: number;
      productsMap: Map<string, {
        productId?: string;
        productName: string;
        category: string;
        unit: string;
        totalQty: number;
        totalAmount: number;
        timesTaken: number;
      }>;
      transactions: typeof periodScopedTransactions;
    }>();

    // Group transactions by month
    periodScopedTransactions.forEach((tx) => {
      const monthKey = getAgentMonthKey(tx);
      if (!monthKey) return;

      if (!map.has(monthKey)) {
        map.set(monthKey, {
          monthKey,
          monthLabel: formatMonthYearLabel(monthKey),
          totalAmount: 0,
          totalBahanAmount: 0,
          totalBahanCount: 0,
          totalBahanQty: 0,
          totalCetakAmount: 0,
          totalCetakCount: 0,
          productsMap: new Map(),
          transactions: []
        });
      }

      const mData = map.get(monthKey)!;
      mData.totalAmount += tx.totalAmount;
      mData.transactions.push(tx);

      if (tx.kind === 'PENGAMBILAN_BAHAN') {
        mData.totalBahanAmount += tx.totalAmount;
        mData.totalBahanCount += 1;
        mData.totalBahanQty += tx.totalQty;

        (tx.items || []).forEach((it) => {
          const pKey = (it.productId || it.productName || 'unknown').toLowerCase().trim();
          if (!mData.productsMap.has(pKey)) {
            mData.productsMap.set(pKey, {
              productId: it.productId,
              productName: it.productName,
              category: it.category || 'bahan',
              unit: it.unit || 'unit',
              totalQty: 0,
              totalAmount: 0,
              timesTaken: 0
            });
          }
          const pData = mData.productsMap.get(pKey)!;
          pData.totalQty += it.qty || 0;
          pData.totalAmount += it.totalPrice || ((it.qty || 1) * (it.price || 0));
          pData.timesTaken += 1;
        });
      } else if (tx.kind === 'CETAK_AGEN') {
        mData.totalCetakAmount += tx.totalAmount;
        mData.totalCetakCount += 1;
      }
    });

    // Convert map to sorted array with structured product lists
    const result = Array.from(map.values()).map((m) => {
      const productsSummary = Array.from(m.productsMap.values()).map((p) => ({
        ...p,
        percentage: m.totalBahanAmount > 0 ? (p.totalAmount / m.totalBahanAmount) * 100 : 0
      })).sort((a, b) => b.totalAmount - a.totalAmount);

      return {
        monthKey: m.monthKey,
        monthLabel: m.monthLabel,
        totalAmount: m.totalAmount,
        totalBahanAmount: m.totalBahanAmount,
        totalBahanCount: m.totalBahanCount,
        totalBahanQty: m.totalBahanQty,
        totalCetakAmount: m.totalCetakAmount,
        totalCetakCount: m.totalCetakCount,
        productsSummary,
        transactions: m.transactions
      };
    });

    // Sort newest month first
    return result.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [periodScopedTransactions]);

  // Overall Stats based on current month filter or all
  const statsBahan = useMemo(() => {
    const list = filteredUnifiedTransactions.filter((t) => t.kind === 'PENGAMBILAN_BAHAN');
    return {
      count: list.length,
      totalAmount: list.reduce((sum, t) => sum + t.totalAmount, 0),
      totalQty: list.reduce((sum, t) => sum + t.totalQty, 0)
    };
  }, [filteredUnifiedTransactions]);

  const statsCetak = useMemo(() => {
    const list = filteredUnifiedTransactions.filter((t) => t.kind === 'CETAK_AGEN');
    return {
      count: list.length,
      totalAmount: list.reduce((sum, t) => sum + t.totalAmount, 0)
    };
  }, [filteredUnifiedTransactions]);

  const statsTotal = useMemo(() => {
    return {
      count: filteredUnifiedTransactions.length,
      totalAmount: filteredUnifiedTransactions.reduce((sum, t) => sum + t.totalAmount, 0)
    };
  }, [filteredUnifiedTransactions]);

  // Compatibility alias
  const filteredAgentTransactions = filteredUnifiedTransactions;
  const totalAgentTransactionsMonth = statsTotal.totalAmount;

  return (
    <div className="space-y-4 max-w-[1440px] mx-auto pb-12 animate-in fade-in duration-150">
      {/* Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold shadow-xs transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{feedbackMessage.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Professional Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
            isAgentUser
              ? 'bg-amber-100 border-amber-300 text-amber-800'
              : 'bg-slate-100 border-slate-200 text-slate-800'
          }`}>
            <UserCheck className={`w-6 h-6 ${isAgentUser ? 'text-amber-700' : 'text-slate-700'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase">
                {isAgentUser ? `Portal Agen • ${assignedAgentName}` : 'Portal Agen & Pengambilan Bahan'}
              </h1>
              {isAgentUser ? (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Profil Toko: {assignedAgentName} (Aktif)
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                  Mode {userRole === 'ADMIN' ? 'Administrator' : userRole === 'OWNER' ? 'Owner / Pemilik' : 'Developer'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAgentUser
                ? `Profil toko cabang ${assignedAgentName} aktif otomatis. Seluruh data & pengambilan bahan akan diupdate tiap pukul 16.00 WIB.`
                : 'Katalog ketersediaan stok produk & modul pesanan pengambilan bahan toko cabang'}
            </p>
          </div>
        </div>

        {/* Actions & Sub-tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Chat Admin Pusat WhatsApp Button */}
          <button
            type="button"
            onClick={() => handleOpenChat('umum')}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer border border-emerald-700 shrink-0"
            title="Chat langsung dengan Admin Pusat via WhatsApp (085133360276)"
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-100" />
            <span className="font-extrabold">Chat Admin</span>
            <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-800/80 text-emerald-100 text-[10px] px-2 py-0.5 rounded-md font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
              0851-3336-0276
            </span>
          </button>

          {/* Sub-tab Navigation */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveSubTab('katalog_order')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'katalog_order'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Katalog & Pengambilan</span>
              {orderItems.length > 0 && (
                <span className="bg-amber-400 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                  {orderItems.length}
                </span>
              )}
            </button>

            {(isDeveloperOrAdminOrOwner || isAgentUser) && (
              <button
                type="button"
                onClick={() => setActiveSubTab('riwayat')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'riwayat'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Riwayat Pengambilan</span>
                <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                  {filteredAgentTransactions.length}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Status Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Katalog Produk</div>
          <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">{products.length} Item</div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Bahan Siap Ambil</div>
          <div className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5">
            {products.filter((p) => {
              const s = getProductAvailabilityStatus(p);
              return s.isAlwaysAvailable || !s.isZeroStock;
            }).length} Tersedia
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            <span>Pengambilan Bahan</span>
            <span className="bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono">{statsBahan.count} Tx</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-sky-900 mt-0.5">
            {formatRupiah(statsBahan.totalAmount)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            <span>Cetak Agen</span>
            <span className="bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-mono">{statsCetak.count} Tx</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-purple-900 mt-0.5">
            {formatRupiah(statsCetak.totalAmount)}
          </div>
        </div>
      </div>

      {activeSubTab === 'katalog_order' ? (
        /* MAIN VIEW: KATALOG PRODUK + MODUL PENGAMBILAN BAHAN AGEN */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT COLUMN: KATALOG DATABASE & STOK (COL 7) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-700" />
                    Katalog & Stok Produk
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Klik tombol "Ambil Bahan" untuk memasukkan produk ke daftar pesanan agen
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-semibold">Filter Stok:</span>
                  <select
                    value={stockStatusFilter}
                    onChange={(e) => setStockStatusFilter(e.target.value as any)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="ALL">Semua Stok</option>
                    <option value="IN_STOCK">Tersedia (&gt;0)</option>
                    <option value="LOW_STOCK">Stok Kritis / Habis</option>
                  </select>
                </div>
              </div>

              {/* Search & Category Pills */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Cari nama produk, SKU, ukuran (cth: oracal, spanduk, akrilik)..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Horizontal Category Badges */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryFilter('ALL')}
                    className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategoryFilter === 'ALL'
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({categoryCounts['ALL'] || 0})
                  </button>

                  {productCategories.map((cat) => {
                    const count = categoryCounts[cat.id] || categoryCounts[cat.name.toLowerCase()] || 0;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategoryFilter(cat.id)}
                        className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          selectedCategoryFilter.toLowerCase() === cat.id.toLowerCase()
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {cat.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[580px] overflow-y-auto pr-1">
                {filteredCatalogProducts.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 space-y-2 bg-slate-50 rounded-xl border border-slate-200">
                    <Package className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
                    <p className="text-xs font-semibold text-slate-600">Tidak ada produk yang sesuai.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogSearch('');
                        setSelectedCategoryFilter('ALL');
                        setStockStatusFilter('ALL');
                      }}
                      className="text-xs text-slate-800 font-bold hover:underline"
                    >
                      Reset Filter
                    </button>
                  </div>
                ) : (
                  filteredCatalogProducts.map((product) => {
                    const formula = getMaterialStockFormula(product);
                    const availStatus = getProductAvailabilityStatus(product);
                    const actionLabel = getAgentProductActionLabel(product, productCategories);

                    return (
                      <div
                        key={product.id}
                        className={`bg-white border rounded-xl p-3 sm:p-3.5 flex flex-col justify-between transition-all hover:shadow-xs ${
                          availStatus.isZeroStock ? 'border-rose-200' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          {/* Card Top: Code & Stock Status */}
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-bold truncate max-w-[120px]">
                              {product.code || 'SKU'}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${
                                availStatus.isZeroStock
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : availStatus.isAlwaysAvailable
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : availStatus.isLowStock
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  availStatus.isZeroStock
                                    ? 'bg-rose-600'
                                    : availStatus.isAlwaysAvailable
                                    ? 'bg-emerald-600'
                                    : availStatus.isLowStock
                                    ? 'bg-amber-600'
                                    : 'bg-emerald-600'
                                }`}
                              ></span>
                              {availStatus.isZeroStock
                                ? 'Habis'
                                : availStatus.isAlwaysAvailable
                                ? 'Selalu Tersedia'
                                : availStatus.isLowStock
                                ? 'Stok Kritis'
                                : 'Tersedia'}
                            </span>
                          </div>

                          {/* Main Row: Thumbnail Image + Title & Category */}
                          <div className="flex items-start gap-2.5 mb-2.5">
                            {/* Product Photo Thumbnail */}
                            <div
                              onClick={(e) => {
                                if (product.imageUrl) {
                                  e.stopPropagation();
                                  setPreviewImage({
                                    url: product.imageUrl,
                                    name: product.name,
                                    code: product.code,
                                    category: typeof product.category === 'string' ? product.category : undefined,
                                    dimensions: product.dimensions
                                  });
                                }
                              }}
                              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0 relative flex items-center justify-center shadow-2xs group/img ${
                                product.imageUrl ? 'cursor-pointer hover:border-slate-400 hover:shadow-xs transition-all' : ''
                              }`}
                              title={product.imageUrl ? `Klik untuk memperbesar foto ${product.name}` : `${product.name} (Belum ada foto)`}
                            >
                              {product.imageUrl ? (
                                <>
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                      const parent = (e.target as HTMLElement).parentElement;
                                      if (parent) {
                                        const fallback = parent.querySelector('.img-err-fallback') as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                      }
                                    }}
                                  />
                                  <div className="img-err-fallback hidden absolute inset-0 flex-col items-center justify-center bg-slate-100 text-slate-400 text-center p-1">
                                    <ImageIcon className="w-5 h-5 text-slate-300" />
                                    <span className="text-[8px] font-medium text-slate-400">Gagal Muat</span>
                                  </div>
                                  <div className="absolute inset-0 bg-slate-900/35 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="w-4 h-4 text-white drop-shadow-xs" />
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 p-1 text-center">
                                  <ImageIcon className="w-5 h-5 text-slate-300" />
                                  <span className="text-[8px] font-medium text-slate-400 mt-0.5">No Foto</span>
                                </div>
                              )}
                            </div>

                            {/* Title & Category Info */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug" title={product.name}>
                                {product.name}
                              </h3>
                              <div className="text-[11px] text-slate-500 mt-1 capitalize flex items-center gap-1 font-medium truncate">
                                <span>{product.category}</span>
                                {product.dimensions && <span>• {product.dimensions}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Stock Box */}
                          <div className={`border p-2 rounded-xl space-y-0.5 ${
                            availStatus.isZeroStock
                              ? 'bg-rose-50/70 border-rose-200'
                              : availStatus.isAlwaysAvailable
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : availStatus.isLowStock
                              ? 'bg-amber-50/50 border-amber-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium text-[11px]">Sisa Stok:</span>
                              <span className={`font-bold ${
                                availStatus.isZeroStock
                                  ? 'text-rose-700'
                                  : availStatus.isAlwaysAvailable
                                  ? 'text-emerald-700'
                                  : availStatus.isLowStock
                                  ? 'text-amber-700'
                                  : 'text-slate-900'
                              }`}>
                                {availStatus.text}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono truncate">
                              Formula: {formula.formulaText}
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom: Prices & Action */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                          <div className="flex items-baseline justify-between">
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Harga Produk Agen
                              </div>
                              <div className="text-xs font-bold text-slate-700 italic">
                                Status: Diperbarui otomatis
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[10px] text-slate-400">Harga Umum</div>
                              <div className="text-xs font-semibold text-slate-400 italic">
                                Dihitung di Total
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenConfigure(product)}
                              className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-white" />
                              <span>{actionLabel}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenChat('stok', product)}
                              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0"
                              title={`Tanya ketersediaan "${product.name}" ke Admin Pusat via WhatsApp (085133360276)`}
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: MODUL FORM PENGAMBILAN BAHAN (COL 5) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 sticky top-16">
              {/* Module Header */}
              <div className="pb-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-slate-700" />
                    Modul Pengambilan Bahan Agen
                  </h2>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-full">
                    {orderItems.length} Item
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Formulir pengambilan stok & order cetak mitra resmi
                </p>
              </div>

              {/* Agent Selection Box */}
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                    Pilih Agen Mitra *
                  </label>
                  {!isAgentUser ? (
                    <button
                      type="button"
                      onClick={() => setIsCustomAgentMode(!isCustomAgentMode)}
                      className="text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                    >
                      {isCustomAgentMode ? 'Pilih dari Daftar' : '+ Input Manual Agen'}
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                      Terkunci Otomatis
                    </span>
                  )}
                </div>

                {!isCustomAgentMode ? (
                  <select
                    value={selectedAgentName}
                    onChange={(e) => {
                      if (!isAgentUser) {
                        setSelectedAgentName(e.target.value);
                      }
                    }}
                    disabled={isAgentUser}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-amber-50/70 disabled:text-amber-950 disabled:border-amber-300 disabled:opacity-100 cursor-default"
                  >
                    {visibleAgents.map((ag) => (
                      <option key={ag.id} value={ag.name}>
                        {ag.name} {ag.phone ? `(${ag.phone})` : ''}
                      </option>
                    ))}
                    {visibleAgents.length === 0 && <option value={assignedAgentName}>{assignedAgentName}</option>}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customAgentInput}
                    onChange={(e) => setCustomAgentInput(e.target.value)}
                    placeholder="Masukkan nama agen (cth: Agen Bram, Mitra Jaya)"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                )}

                {matchedAgentObject && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-3 pt-0.5">
                    {matchedAgentObject.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-600" />
                        {matchedAgentObject.phone}
                      </span>
                    )}
                    {matchedAgentObject.commissionRate && (
                      <span>Status: {matchedAgentObject.commissionRate}</span>
                    )}
                  </div>
                )}

                {/* Transaction Date */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    Tanggal Pengambilan
                  </label>
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Order Items Cart */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Daftar Barang yang Diambil:</span>
                  {orderItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOrderItems([])}
                      className="text-[10px] text-rose-600 hover:underline font-semibold cursor-pointer"
                    >
                      Kosongkan Semua
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {orderItems.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 bg-slate-50 space-y-1">
                      <Package className="w-5 h-5 mx-auto opacity-50" />
                      <div className="text-xs font-semibold text-slate-600">
                        Belum ada item dipilih
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Pilih produk di katalog sebelah kiri lalu klik tombol Ambil Bahan.
                      </p>
                    </div>
                  ) : (
                    orderItems.map((item) => {
                      const matchedProd = products.find((p) => p.id === item.productId || (p.code && p.code === item.code));
                      const itemImg = matchedProd?.imageUrl;

                      return (
                        <div
                          key={item.id}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              {itemImg ? (
                                <div
                                  onClick={() => setPreviewImage({ url: itemImg, name: item.productName, code: item.code })}
                                  className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 shadow-2xs cursor-pointer hover:border-slate-400 transition-all"
                                  title="Lihat foto produk"
                                >
                                  <img src={itemImg} alt={item.productName} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-9 h-9 rounded-lg border border-slate-200 bg-white shrink-0 flex items-center justify-center text-slate-400">
                                  <Package className="w-4 h-4 text-slate-300" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-xs text-slate-900 leading-snug truncate" title={item.productName}>
                                  {item.productName}
                                </h4>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium truncate">
                                  <span className="font-mono">{item.code || 'SKU'}</span>
                                  <span>• Satuan: {item.unit}</span>
                                  {item.lengthMeters && item.widthMeters && (
                                    <span className="text-slate-700 font-bold">
                                      ({item.lengthMeters}m x {item.widthMeters}m = {item.sqm?.toFixed(2)} m²)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveOrderItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer shrink-0"
                              title="Hapus item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                        {item.notes && (
                          <div className="text-[10px] bg-white text-slate-700 p-1.5 rounded-lg border border-slate-200">
                            <strong>Catatan:</strong> {item.notes}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                          {/* Qty changer */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item.id, item.qty - 1)}
                              disabled={item.qty <= 1}
                              className="w-6 h-6 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-xs font-bold disabled:opacity-40 hover:bg-slate-100"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold w-7 text-center text-slate-900">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item.id, item.qty + 1)}
                              className="w-6 h-6 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-xs font-bold hover:bg-slate-100"
                            >
                              +
                            </button>
                            <span className="text-[11px] text-slate-500 ml-1.5">
                              {item.unit} siap diambil
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>

              {/* General Order Notes */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                  Catatan Surat Jalan / Keterangan
                </label>
                <textarea
                  value={generalOrderNotes}
                  onChange={(e) => setGeneralOrderNotes(e.target.value)}
                  placeholder="Catatan pesanan atau instruksi pengambilan barang..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800 placeholder-slate-400 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Summary Box */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Total Jumlah Barang:</span>
                  <span className="font-bold text-white">{orderTotalQty} Unit</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Penerima (Agen):</span>
                  <span className="font-bold text-slate-100">{displayAgentName}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-200">Status Pengambilan:</span>
                  <span className="text-xs font-bold text-emerald-400 uppercase">
                    Agen Terverifikasi
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSubmitAgentOrder}
                  disabled={orderItems.length === 0}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Proses & Simpan Pengambilan Bahan</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenChat('order_cart')}
                  className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 active:scale-[0.99] border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                  title="Kirim rincian pesanan pengambilan bahan langsung ke WhatsApp Admin Pusat (085133360276)"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Kirim Rincian via WhatsApp Admin (0851-3336-0276)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SUB-TAB 2: RIWAYAT TRANSAKSI PENGAMBILAN BAHAN & CETAK AGEN */
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-700" />
                Riwayat Transaksi Agen (Pengambilan Bahan & Cetak)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Rekap mutasi pengambilan stok bahan baku dan pesanan jasa cetak mitra resmi agen tiap bulan
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Bar */}
              <div className="relative min-w-[180px] sm:min-w-[210px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Cari no. transaksi, barang..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Periode Riwayat: per bulan ATAU rentang tanggal manual */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setHistoryPeriodMode('BULAN')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    historyPeriodMode === 'BULAN' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Saring riwayat berdasarkan bulan"
                >
                  Per Bulan
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryPeriodMode('RENTANG')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    historyPeriodMode === 'RENTANG' ? 'bg-indigo-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Saring riwayat berdasarkan tanggal awal - akhir"
                >
                  Rentang Tanggal
                </button>
              </div>

              {historyPeriodMode === 'BULAN' ? (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus-within:ring-2 focus-within:ring-slate-900 shadow-2xs">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <select
                    value={historyMonthFilter}
                    onChange={(e) => setHistoryMonthFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                    title="Saring pengambilan bahan per bulan"
                  >
                    <option value="ALL">📅 Semua Bulan ({availableMonths.length} Periode)</option>
                    {availableMonths.map((mKey) => (
                      <option key={mKey} value={mKey}>
                        📅 {formatMonthYearLabel(mKey)} {mKey === getCurrentLocalMonthKey() ? '• Bulan Ini' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus-within:ring-2 focus-within:ring-slate-900 shadow-2xs">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <input
                    type="date"
                    value={historyRangeFrom}
                    max={historyRangeTo}
                    onChange={(e) => setHistoryRangeFrom(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none"
                    title="Tanggal awal riwayat"
                  />
                  <span className="text-slate-400 font-bold">s/d</span>
                  <input
                    type="date"
                    value={historyRangeTo}
                    min={historyRangeFrom}
                    onChange={(e) => setHistoryRangeTo(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none"
                    title="Tanggal akhir riwayat"
                  />
                </div>
              )}

              {/* Agent Filter */}
              {isDeveloperOrAdminOrOwner ? (
                <select
                  value={historyAgentFilter}
                  onChange={(e) => setHistoryAgentFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ALL">Semua Agen ({agents.length})</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.name}>
                      {ag.name}
                    </option>
                  ))}
                </select>
              ) : isAgentUser ? (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>Riwayat: {assignedAgentName} (Terkunci)</span>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-700 animate-pulse" />
                  <span>Akses Terbatas: Developer / Admin / Owner</span>
                </div>
              )}

              {/* PDF Download Recap Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  setRecapAgent(historyAgentFilter);
                  if (historyPeriodMode === 'RENTANG') {
                    setRecapPeriodType('KUSTOM');
                    setRecapRangeFrom(historyRangeFrom);
                    setRecapRangeTo(historyRangeTo);
                  } else if (historyMonthFilter !== 'ALL') {
                    const [yStr, mStr] = historyMonthFilter.split('-');
                    const mIdx = parseInt(mStr, 10) - 1;
                    const y = parseInt(yStr, 10);
                    if (!isNaN(mIdx) && !isNaN(y)) {
                      setRecapPeriodType('BULANAN');
                      setRecapMonth(mIdx);
                      setRecapYear(y);
                    }
                  }
                  setShowDownloadRecapModal(true);
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer border border-red-700 shrink-0"
                title="Unduh Rekap Pengambilan & Cetak Agen (PDF)"
              >
                <FileText className="w-3.5 h-3.5 text-red-100" />
                <span>Unduh PDF Rekap</span>
              </button>
            </div>
          </div>

          {/* Sub-Filters & View Switcher Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
            {/* Transaction Type Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setHistoryTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  historyTypeFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>Semua Transaksi</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  historyTypeFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'
                }`}>
                  {statsTotal.count}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryTypeFilter('PENGAMBILAN_BAHAN')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  historyTypeFilter === 'PENGAMBILAN_BAHAN'
                    ? 'bg-sky-700 text-white border-sky-800 font-bold shadow-xs'
                    : 'bg-sky-50/70 hover:bg-sky-100/70 text-sky-800 border-sky-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Pengambilan Bahan</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  historyTypeFilter === 'PENGAMBILAN_BAHAN' ? 'bg-sky-900 text-white' : 'bg-sky-200 text-sky-900'
                }`}>
                  {statsBahan.count}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryTypeFilter('CETAK_AGEN')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  historyTypeFilter === 'CETAK_AGEN'
                    ? 'bg-purple-700 text-white border-purple-800 font-bold shadow-xs'
                    : 'bg-purple-50/70 hover:bg-purple-100/70 text-purple-800 border-purple-200'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Agen</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  historyTypeFilter === 'CETAK_AGEN' ? 'bg-purple-900 text-white' : 'bg-purple-200 text-purple-900'
                }`}>
                  {statsCetak.count}
                </span>
              </button>
            </div>

            {/* View Mode Toggle: Tabel Transaksi vs Rekap Tiap Bulan */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setHistoryViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  historyViewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan riwayat dalam format tabel transaksi individual"
              >
                <List className="w-3.5 h-3.5 text-slate-700" />
                <span>Transaksi Pengambilan</span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryViewMode('monthly_summary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  historyViewMode === 'monthly_summary'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan rekap pengambilan bahan per bulan"
              >
                <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                <span>Rekap Bahan</span>
              </button>
            </div>
          </div>

          {/* Active Period Filter Info Banner */}
          {(historyPeriodMode === 'RENTANG' || historyMonthFilter !== 'ALL') && (
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-indigo-950 font-medium">
                <CalendarDays className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Menampilkan data periode: <strong className="font-bold text-indigo-900">{historyPeriodLabel}</strong>
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-indigo-800 font-bold">
                  Total Bahan: {formatRupiah(statsBahan.totalAmount)} ({statsBahan.count}x ambil, {statsBahan.totalQty} barang)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (historyPeriodMode === 'RENTANG') setHistoryPeriodMode('BULAN');
                  setHistoryMonthFilter('ALL');
                }}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 cursor-pointer"
              >
                <span>Tampilkan Semua Bulan</span>
              </button>
            </div>
          )}

          {/* ================= VIEW MODE 1: REKAP PENGAMBILAN BAHAN TIAP BULAN (MONTHLY ANALYTICS & BREAKDOWN) ================= */}
          {historyViewMode === 'monthly_summary' ? (
            <div className="space-y-4">
              {monthlyBahanSummary.length === 0 ? (
                <div className="p-10 text-center text-slate-400 space-y-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <CalendarDays className="w-8 h-8 mx-auto opacity-50 text-slate-400" />
                  <div className="font-semibold text-xs text-slate-600">
                    Belum ada rekap bulanan pengambilan untuk agen ini.
                  </div>
                </div>
              ) : (
                monthlyBahanSummary
                  .filter((m) => historyPeriodMode !== 'BULAN' || historyMonthFilter === 'ALL' || m.monthKey === historyMonthFilter)
                  .map((monthData) => {
                    const isExpanded = expandedMonthlyCards[monthData.monthKey] !== false; // default expanded
                    const isCurrentMonth = monthData.monthKey === getCurrentLocalMonthKey();

                    return (
                      <div
                        key={monthData.monthKey}
                        className={`border rounded-2xl overflow-hidden transition-all shadow-xs ${
                          isCurrentMonth
                            ? 'bg-white border-indigo-300 ring-1 ring-indigo-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        {/* Month Header Banner */}
                        <div className="p-4 sm:px-5 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/15">
                              <CalendarDays className="w-5 h-5 text-indigo-300" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-black text-white">
                                  {monthData.monthLabel}
                                </h3>
                                {isCurrentMonth && (
                                  <span className="bg-indigo-500 text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Bulan Ini
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-300 font-medium">
                                Rekap konsumsi bahan baku mitra agen periode {monthData.monthLabel}
                              </p>
                            </div>
                          </div>

                          {/* Quick Summary Numbers on Header */}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <div className="bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl text-left">
                              <div className="text-[10px] text-slate-400 font-semibold">Total Ambil Bahan</div>
                              <div className="text-xs sm:text-sm font-mono font-black text-emerald-400">
                                {formatRupiah(monthData.totalBahanAmount)}
                              </div>
                            </div>

                            <div className="bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl text-left">
                              <div className="text-[10px] text-slate-400 font-semibold">Frekuensi Transaksi</div>
                              <div className="text-xs sm:text-sm font-mono font-black text-white">
                                {monthData.totalBahanCount}x Ambil
                              </div>
                            </div>

                            <div className="bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl text-left">
                              <div className="text-[10px] text-slate-400 font-semibold">Kuantitas / Volume</div>
                              <div className="text-xs sm:text-sm font-mono font-black text-indigo-300">
                                {monthData.totalBahanQty} Unit / Item
                              </div>
                            </div>

                            {/* Actions on Card Header */}
                            <div className="flex items-center gap-1.5 ml-auto md:ml-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setHistoryMonthFilter(monthData.monthKey);
                                  setHistoryViewMode('list');
                                }}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border border-slate-700"
                                title="Buka transaksi bulan ini di tabel"
                              >
                                <List className="w-3.5 h-3.5 text-slate-300" />
                                <span className="hidden sm:inline">Lihat Transaksi</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setRecapAgent(historyAgentFilter);
                                  const [yStr, mStr] = monthData.monthKey.split('-');
                                  const mIdx = parseInt(mStr, 10) - 1;
                                  const y = parseInt(yStr, 10);
                                  if (!isNaN(mIdx) && !isNaN(y)) {
                                    setRecapPeriodType('BULANAN');
                                    setRecapMonth(mIdx);
                                    setRecapYear(y);
                                  }
                                  setShowDownloadRecapModal(true);
                                }}
                                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Unduh Rekap PDF Bulan Ini"
                              >
                                <FileText className="w-3.5 h-3.5 text-white" />
                                <span className="hidden sm:inline">PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedMonthlyCards((prev) => ({
                                    ...prev,
                                    [monthData.monthKey]: !isExpanded
                                  }))
                                }
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-700"
                                title={isExpanded ? 'Sembunyikan Rincian' : 'Tampilkan Rincian'}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Month Body */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 space-y-4">
                            {/* Top 3 Consumed Materials Visual Bar */}
                            {monthData.productsSummary.length > 0 && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                                    Komposisi Bahan Utama Terbanyak ({monthData.monthLabel})
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {monthData.productsSummary.length} varian bahan diambil
                                  </span>
                                </div>

                                {/* Stacked Progress Bar */}
                                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                                  {monthData.productsSummary.slice(0, 5).map((p, idx) => {
                                    const colors = [
                                      'bg-indigo-600',
                                      'bg-emerald-600',
                                      'bg-amber-500',
                                      'bg-sky-500',
                                      'bg-purple-600'
                                    ];
                                    const color = colors[idx % colors.length];
                                    return (
                                      <div
                                        key={idx}
                                        style={{ width: `${Math.max(p.percentage, 2)}%` }}
                                        className={`${color} h-full transition-all`}
                                        title={`${p.productName}: ${formatRupiah(p.totalAmount)} (${p.percentage.toFixed(1)}%)`}
                                      />
                                    );
                                  })}
                                </div>

                                {/* Legend Pills */}
                                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                                  {monthData.productsSummary.slice(0, 4).map((p, idx) => {
                                    const dotColors = [
                                      'bg-indigo-600',
                                      'bg-emerald-600',
                                      'bg-amber-500',
                                      'bg-sky-500'
                                    ];
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium text-slate-700"
                                      >
                                        <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`} />
                                        <span className="font-bold text-slate-900 truncate max-w-[140px]">
                                          {p.productName}
                                        </span>
                                        <span className="text-slate-500 font-mono">
                                          ({p.totalQty} {p.unit})
                                        </span>
                                        <span className="font-bold text-slate-800">
                                          {formatRupiah(p.totalAmount)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Itemized Materials Table for this Month */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                              <div className="bg-slate-100/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-slate-600" />
                                  Daftar Rincian Pengambilan Bahan Tiap Bulan ({monthData.monthLabel})
                                </span>
                                <span className="text-[11px] font-bold text-slate-600">
                                  {monthData.productsSummary.length} Jenis Produk
                                </span>
                              </div>

                              {monthData.productsSummary.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400">
                                  Tidak ada pengambilan bahan baku pada bulan ini (hanya transaksi cetak/lainnya).
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
                                      <tr>
                                        <th className="py-2.5 px-3">No</th>
                                        <th className="py-2.5 px-3">Nama Bahan Baku / Produk</th>
                                        <th className="py-2.5 px-3">Kategori</th>
                                        <th className="py-2.5 px-3 text-center">Total Kuantitas Diambil</th>
                                        <th className="py-2.5 px-3 text-center">Frekuensi Ambil</th>
                                        <th className="py-2.5 px-3 text-right">Subtotal Biaya (Rp)</th>
                                        <th className="py-2.5 px-3 text-right">% Porsi</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {monthData.productsSummary.map((prod, pIdx) => (
                                        <tr key={pIdx} className="hover:bg-slate-50/80 transition-colors">
                                          <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                                            {pIdx + 1}
                                          </td>
                                          <td className="py-2 px-3 font-bold text-slate-900">
                                            {prod.productName}
                                          </td>
                                          <td className="py-2 px-3">
                                            <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px] border border-slate-200 uppercase">
                                              {prod.category || 'Bahan'}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold text-slate-900">
                                            <span className="bg-sky-50 text-sky-900 border border-sky-200 font-mono font-bold px-2 py-0.5 rounded-md text-[11px]">
                                              {prod.totalQty} {prod.unit || 'unit'}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-center text-slate-600 font-medium">
                                            {prod.timesTaken}x transaksi
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                            {formatRupiah(prod.totalAmount)}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-600 text-[11px]">
                                            {prod.percentage.toFixed(1)}%
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                                      <tr>
                                        <td colSpan={3} className="py-2.5 px-3 text-right text-slate-700">
                                          TOTAL PENGAMBILAN BAHAN ({monthData.monthLabel}):
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-mono text-indigo-700">
                                          {monthData.totalBahanQty} Unit
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-slate-700">
                                          {monthData.totalBahanCount}x
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-sm">
                                          {formatRupiah(monthData.totalBahanAmount)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                          100%
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          ) : (
            /* ================= VIEW MODE 2: TABEL DAFTAR TRANSAKSI INDIVIDUAL ================= */
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              {filteredUnifiedTransactions.length === 0 ? (
                <div className="p-10 text-center text-slate-400 space-y-2 bg-slate-50">
                  <Clock className="w-8 h-8 mx-auto opacity-50 text-slate-400" />
                  <div className="font-semibold text-xs text-slate-600">
                    {historyTypeFilter === 'PENGAMBILAN_BAHAN'
                      ? 'Belum ada riwayat Pengambilan Bahan untuk kriteria ini.'
                      : historyTypeFilter === 'CETAK_AGEN'
                      ? 'Belum ada riwayat Cetak Agen untuk kriteria ini.'
                      : 'Belum ada riwayat transaksi pengambilan bahan atau cetak agen.'}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Ganti periode bulan atau ubah kata kunci pencarian di atas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3.5">No. Transaksi & Waktu</th>
                        <th className="py-3 px-3.5">Jenis Transaksi</th>
                        <th className="py-3 px-3.5">Agen Mitra</th>
                        <th className="py-3 px-3.5">Rincian Barang / Jasa Cetak</th>
                        <th className="py-3 px-3.5 text-right">Total Nilai</th>
                        <th className="py-3 px-3.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUnifiedTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5 align-top">
                            <div className="font-mono font-bold text-slate-900 text-[11px]">
                              #{tx.transactionNumber || tx.id}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {tx.date} • {tx.time}
                            </div>
                          </td>

                          <td className="py-3 px-3.5 align-top">
                            {tx.kind === 'CETAK_AGEN' ? (
                              <span className="bg-purple-50 text-purple-800 border border-purple-300 font-bold px-2 py-0.5 rounded-md text-[10px] inline-flex items-center gap-1">
                                <Printer className="w-3 h-3 text-purple-600" />
                                Cetak Agen
                              </span>
                            ) : (
                              <span className="bg-sky-50 text-sky-800 border border-sky-300 font-bold px-2 py-0.5 rounded-md text-[10px] inline-flex items-center gap-1">
                                <Package className="w-3 h-3 text-sky-600" />
                                Pengambilan Bahan
                              </span>
                            )}
                            <div className="mt-1">
                              <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${
                                tx.source === 'PORTAL_AGEN'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {tx.source === 'PORTAL_AGEN' ? 'Portal Agen' : 'Kasir POS'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3.5 align-top">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                              {tx.agentName}
                            </div>
                            {tx.notes && (
                              <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                {tx.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3.5 align-top">
                            <div className="space-y-1">
                              {tx.items && tx.items.length > 0 ? (
                                tx.items.map((it, idx) => (
                                  <div key={idx} className="text-[11px] text-slate-700">
                                    <span className="font-bold text-slate-900">
                                      {it.qty} {it.unit || 'unit'}
                                    </span>{' '}
                                    <span>{it.productName}</span>
                                    {it.lengthMeters && it.widthMeters ? (
                                      <span className="text-purple-700 font-semibold text-[10px] ml-1">
                                        ({it.lengthMeters}x{it.widthMeters}m = {it.sqm?.toFixed(2)} m²)
                                      </span>
                                    ) : null}
                                    {it.notes ? (
                                      <span className="text-slate-400 text-[10px] italic ml-1 block">
                                        Catatan: {it.notes}
                                      </span>
                                    ) : null}
                                  </div>
                                ))
                              ) : (
                                <div className="text-[11px] text-slate-700">
                                  {tx.totalQty || 1} unit Barang
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3.5 align-top text-right font-bold text-slate-900">
                            {formatRupiah(tx.totalAmount)}
                          </td>

                          <td className="py-3 px-3.5 align-top text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (tx.rawPosTx && onPrintReceiptDirect) {
                                  onPrintReceiptDirect(tx.rawPosTx);
                                  return;
                                }

                                const printableItems: AgentOrderItem[] = (tx.items || []).map((it) => ({
                                  id: it.productId || String(Math.random()),
                                  productId: it.productId || String(Math.random()),
                                  productName: it.productName,
                                  code: it.code,
                                  category: it.category || 'bahan',
                                  unit: it.unit || 'unit',
                                  unitMode: 'roll_pak',
                                  qty: it.qty,
                                  lengthMeters: it.lengthMeters,
                                  widthMeters: it.widthMeters,
                                  sqm: it.sqm,
                                  price: it.price,
                                  totalPrice: it.totalPrice,
                                  notes: it.notes,
                                  availableStock: 0
                                }));

                                setPrintedTransactionData({
                                  transactionNumber: tx.transactionNumber || tx.id,
                                  date: tx.date,
                                  time: tx.time,
                                  agentName: tx.agentName,
                                  items: printableItems,
                                  totalAmount: tx.totalAmount,
                                  notes: tx.notes
                                });
                                setShowReceiptModal(true);
                              }}
                              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 font-bold text-[11px]"
                              title="Cetak Surat Jalan / Bukti Transaksi"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Cetak</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* POP-UP MODAL: AMBIL BAHAN AGEN & KONFIGURASI (BACKGROUND ABU TERANG & PUTIH BERSIH) */}
      {activeConfigureProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-100 border-b border-slate-200 text-slate-900 p-4 sm:px-5 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                {activeConfigureProduct.imageUrl ? (
                  <div
                    onClick={() => setPreviewImage({ url: activeConfigureProduct.imageUrl!, name: activeConfigureProduct.name, code: activeConfigureProduct.code })}
                    className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-2xs cursor-pointer hover:border-blue-400 hover:scale-105 transition-all"
                    title="Klik untuk perbesar foto"
                  >
                    <img
                      src={activeConfigureProduct.imageUrl}
                      alt={activeConfigureProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white shrink-0 flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="w-5 h-5 text-slate-300" />
                    <span className="text-[7px] font-semibold text-slate-400 mt-0.5">No Foto</span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-md uppercase">
                      {getAgentProductActionLabel(activeConfigureProduct, productCategories)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-semibold truncate">
                      {activeConfigureProduct.code || 'SKU'}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 mt-0.5 truncate">
                    {activeConfigureProduct.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveConfigureProduct(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleConfirmAddItem} className="p-4 sm:p-5 space-y-4 bg-white">
              {configError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{configError}</span>
                </div>
              )}

              {/* Product Info & Sisa Stok */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="text-slate-500 text-[10px] font-medium">Sisa Stok Tersedia:</div>
                  <div className="font-bold text-slate-900">
                    {getProductAvailabilityStatus(activeConfigureProduct).text}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-[10px] font-medium">Status Kategori:</div>
                  <div className="font-bold text-emerald-700 uppercase">
                    Mitra Agen
                  </div>
                </div>
              </div>

              {/* Satuan Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilihan Satuan Pengambilan:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfigUnitModeChange('roll_pak')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                      configUnitMode === 'roll_pak'
                        ? 'border-slate-900 bg-slate-50 text-slate-900 ring-2 ring-slate-900'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>Per Roll / Pak (Utuh)</div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                      Kemasan standar gudang
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfigUnitModeChange('meter_lembar')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                      configUnitMode === 'meter_lembar'
                        ? 'border-slate-900 bg-slate-50 text-slate-900 ring-2 ring-slate-900'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>Eceran / Meter / PxL</div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                      Potongan meteran custom
                    </div>
                  </button>
                </div>
              </div>

              {/* Hitung Meteran PxL jika mode meter/lembar */}
              {configUnitMode === 'meter_lembar' && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Hitung Ukuran Meteran (Panjang x Lebar)</span>
                    <span className="text-[10px] bg-slate-200 text-slate-800 font-mono font-bold px-1.5 py-0.2 rounded">
                      Luas: {(parseFloat(configLength.replace(',', '.')) || 0) * (parseFloat(configWidth.replace(',', '.')) || 0)} m²
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Panjang (meter)
                      </label>
                      <input
                        type="text"
                        value={configLength}
                        onChange={(e) => setConfigLength(e.target.value)}
                        placeholder="cth: 1.7"
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Lebar (meter)
                      </label>
                      <input
                        type="text"
                        value={configWidth}
                        onChange={(e) => setConfigWidth(e.target.value)}
                        placeholder="cth: 0.3"
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity & Harga Satuan */}
              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jumlah / Qty *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={configQty}
                    onChange={(e) => setConfigQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>

                <div className="hidden">
                  <input
                    type="text"
                    value={configPrice}
                    onChange={(e) => setConfigPrice(formatNumberInput(e.target.value))}
                    required
                  />
                </div>
              </div>

              {/* Catatan / Keterangan File */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan File / Finishing (Opsional)
                </label>
                <input
                  type="text"
                  value={configNotes}
                  onChange={(e) => setConfigNotes(e.target.value)}
                  placeholder="cth: File spanduk-agen.pdf, Finishing mata ayam 4 sudut"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveConfigureProduct(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  + Tambah ke Daftar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP SURAT JALAN / BUKTI PENGAMBILAN AGEN (CLEAN WHITE & HIGH CONTRAST) */}
      {showReceiptModal && printedTransactionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-100 border-b border-slate-200 text-slate-900 p-4 px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Bukti Pengambilan Bahan & Cetak Agen
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Receipt Preview */}
            <div className="p-4 overflow-y-auto bg-slate-50 flex-1 flex justify-center">
              <div 
                id="thermal-receipt"
                className="thermal-receipt-container w-full max-w-xs bg-white p-4 shadow-sm border border-dashed border-slate-300 text-slate-900 text-xs font-mono leading-relaxed print:p-0 print:border-none print:shadow-none"
              >
                {/* Receipt Header */}
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  <div className="font-extrabold text-sm tracking-widest uppercase text-black">
                    {storeInfo?.storeName || 'BEJO Digital Print'}
                  </div>
                  <div className="text-[10px] text-slate-600 uppercase font-sans">
                    {storeInfo?.address || 'Jl. Raya Percetakan No. 1, Yogyakarta'}
                  </div>
                  <div className="text-[10px] font-bold text-slate-800 mt-1.5 uppercase tracking-widest">
                    SURAT JALAN / PENGAMBILAN AGEN
                  </div>
                </div>

                {/* Metadata */}
                <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>No. Transaksi</span>
                    <span className="font-bold">#{printedTransactionData.transactionNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu</span>
                    <span>{printedTransactionData.date} {printedTransactionData.time}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-dashed border-slate-100">
                    <span>Agen Mitra</span>
                    <span className="font-bold uppercase">{printedTransactionData.agentName}</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="py-2.5 border-b border-dashed border-slate-300 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Rincian Barang Diambil:
                  </div>
                  {printedTransactionData.items.map((it, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="font-semibold flex justify-between">
                        <span className="text-slate-900 font-bold">{it.productName}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>
                          Jumlah: <strong className="text-slate-950 font-bold">{it.qty} {it.unit}</strong>
                          {it.lengthMeters && it.widthMeters && (
                            <span> • {it.lengthMeters}x{it.widthMeters}m</span>
                          )}
                        </span>
                      </div>
                      {it.notes && (
                        <div className="text-[9px] text-slate-400 italic">
                          * {it.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total Qty Summary */}
                <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1">
                  <div className="flex justify-between text-xs font-extrabold text-black">
                    <span>TOTAL UNIT DIAMBIL:</span>
                    <span className="font-black text-black">
                      {printedTransactionData.items.reduce((sum, item) => sum + item.qty, 0)} Unit
                    </span>
                  </div>
                </div>

                {printedTransactionData.notes && (
                  <div className="py-2 text-[10px] text-slate-600 border-b border-dashed border-slate-300">
                    <strong>Catatan:</strong> {printedTransactionData.notes}
                  </div>
                )}

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4 text-center pt-6 text-[10px] text-slate-600 font-sans">
                  <div>
                    <div>Penerima (Agen)</div>
                    <div className="h-10"></div>
                    <div className="font-bold text-slate-900 border-t border-dashed border-slate-300 pt-1">
                      {printedTransactionData.agentName}
                    </div>
                  </div>
                  <div>
                    <div>Petugas Gudang/Toko</div>
                    <div className="h-10"></div>
                    <div className="font-bold text-slate-900 border-t border-dashed border-slate-300 pt-1">
                      Admin / Kasir
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={() => {
                  const settings = getStoredPrintSettings();
                  printThermalElement('thermal-receipt', {
                    paperSize: settings.paperSize,
                    printMarginMm: settings.printMarginMm
                  });
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                <span>Cetak Surat Jalan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP MODAL: CHAT WHATSAPP ADMIN PUSAT (085133360276) */}
      {showChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-emerald-700 text-white p-4 px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">Chat Admin Pusat</h3>
                    <span className="inline-flex items-center gap-1 bg-emerald-900/60 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Online di Smartphone
                    </span>
                  </div>
                  <div className="text-xs text-emerald-100 font-mono mt-0.5 flex items-center gap-1.5">
                    <span>WhatsApp: <strong>0851-3336-0276</strong></span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChatModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-white text-slate-800 text-xs">
              {/* Info Note */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-emerald-950">
                    Terhubung Langsung dengan WhatsApp Admin Pusat
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Pesan akan dikirim langsung ke nomor <strong>085133360276</strong>. Admin Pusat mba Syafira akan segera membalas pesan Anda.
                  </p>
                </div>
              </div>

              {/* Template Quick Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Format Template Pesan Cepat:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate('umum')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      chatTemplateKey === 'umum'
                        ? 'bg-slate-900 text-white border-slate-900 font-bold'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    💬 Pesan Umum
                  </button>

                  {orderItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate('order_cart')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                        chatTemplateKey === 'order_cart'
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      📦 Rincian Pesanan ({orderItems.length} Item)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSelectTemplate('stok')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      chatTemplateKey === 'stok'
                        ? 'bg-slate-900 text-white border-slate-900 font-bold'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    🏷️ Tanya Stok Bahan
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTemplate('order')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      chatTemplateKey === 'order'
                        ? 'bg-slate-900 text-white border-slate-900 font-bold'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    🚚 Konfirmasi Pengambilan
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTemplate('cetak')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      chatTemplateKey === 'cetak'
                        ? 'bg-slate-900 text-white border-slate-900 font-bold'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    🖨️ Order Jasa Cetak
                  </button>
                </div>
              </div>

              {/* Message Box Input / Preview */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Isi Pesan WhatsApp *
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                  >
                    {isCopied ? (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className={isCopied ? 'text-emerald-700 font-bold' : ''}>
                      {isCopied ? 'Tersalin!' : 'Salin Teks'}
                    </span>
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Ketik pesan atau instruksi untuk Admin Pusat..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-mono leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all shadow-inner"
                />
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Dapat diedit bebas sebelum dikirim ke WhatsApp</span>
                  <span>{chatMessage.length} karakter</span>
                </div>
              </div>

              {/* Contact Card Summary */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Tujuan Penerima Chat:</div>
                  <div className="text-xs font-bold text-slate-900">Admin Pusat (BEJO Digital Print)</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-medium">Nomor WhatsApp:</div>
                  <div className="text-xs font-mono font-bold text-emerald-700">085133360276</div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowChatModal(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-all"
              >
                Batal
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                  title="Salin teks pesan"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md transition-all border border-emerald-700"
                >
                  <MessageSquare className="w-4 h-4 text-white" />
                  <span>Buka & Kirim via WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP MODAL: DOWNLOAD REKAP PENGAMBILAN & CETAK PER AGEN (HARI, MINGGU, BULAN) */}
      {showDownloadRecapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Unduh Rekap PDF Agen</h3>
                  <p className="text-[10px] text-slate-300">Unduh rekap transaksi agen dalam format PDF</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDownloadRecapModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 bg-white text-slate-800 text-xs">
              
              {/* Select Agent Field (Only for Dev / Admin / Owner) */}
              {isDeveloperOrAdminOrOwner ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    1. Pilih Target Agen:
                  </label>
                  <select
                    value={recapAgent}
                    onChange={(e) => setRecapAgent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="ALL">Semua Agen Rekanan ({agents.length})</option>
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.name}>
                        {ag.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. Target Agen:
                  </label>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                    {assignedAgentName} (Cabang Anda)
                  </div>
                </div>
              )}

              {/* Period Type Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. Pilih Rentang Periode:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setRecapPeriodType('HARIAN')}
                    className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                      recapPeriodType === 'HARIAN'
                        ? 'bg-slate-900 text-white font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/50'
                    }`}
                  >
                    Harian
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecapPeriodType('MINGGUAN')}
                    className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                      recapPeriodType === 'MINGGUAN'
                        ? 'bg-slate-900 text-white font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/50'
                    }`}
                  >
                    Mingguan
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecapPeriodType('BULANAN')}
                    className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                      recapPeriodType === 'BULANAN'
                        ? 'bg-slate-900 text-white font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/50'
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecapPeriodType('KUSTOM')}
                    className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                      recapPeriodType === 'KUSTOM'
                        ? 'bg-indigo-700 text-white font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/50'
                    }`}
                  >
                    Rentang Tanggal
                  </button>
                </div>
              </div>

              {/* Dynamic Inputs based on Period Type */}
              {recapPeriodType === 'HARIAN' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-100">
                  <label className="block text-xs font-bold text-slate-700">
                    3. Tentukan Tanggal:
                  </label>
                  <input
                    type="date"
                    value={recapDate}
                    onChange={(e) => setRecapDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">Pesan/transaksi pada tanggal spesifik ini akan dimasukkan.</p>
                </div>
              )}

              {recapPeriodType === 'MINGGUAN' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-100">
                  <label className="block text-xs font-bold text-slate-700">
                    3. Pilih Tanggal Acuan Minggu:
                  </label>
                  <input
                    type="date"
                    value={recapDate}
                    onChange={(e) => setRecapDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">
                    Sistem akan otomatis menghitung 1 minggu penuh (Senin s.d Minggu) berdasarkan tanggal yang dipilih.
                  </p>
                </div>
              )}

              {recapPeriodType === 'BULANAN' && (
                <div className="grid grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-top-1 duration-100">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      3. Pilih Bulan:
                    </label>
                    <select
                      value={recapMonth}
                      onChange={(e) => setRecapMonth(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {[
                        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                      ].map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Tahun:
                    </label>
                    <select
                      value={recapYear}
                      onChange={(e) => setRecapYear(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {[2024, 2025, 2026, 2027, 2028].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {recapPeriodType === 'KUSTOM' && (
                <div className="grid grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-top-1 duration-100">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      3. Tanggal Awal:
                    </label>
                    <input
                      type="date"
                      value={recapRangeFrom}
                      max={recapRangeTo}
                      onChange={(e) => setRecapRangeFrom(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Tanggal Akhir:
                    </label>
                    <input
                      type="date"
                      value={recapRangeTo}
                      min={recapRangeFrom}
                      onChange={(e) => setRecapRangeTo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <p className="col-span-2 text-[10px] text-slate-500">
                    Rekap PDF berisi pengambilan bahan &amp; cetak agen pada {buildRecapPeriodLabel(recapPeriodConfig)}
                    {recapAgent === 'ALL' ? ' untuk semua agen.' : ` milik agen ${recapAgent}.`}
                  </p>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 space-y-0.5">
                <div className="font-bold text-slate-800">
                  Isi rekap: {recapDataset.filteredStockTx.length} transaksi pengambilan bahan
                  {recapDataset.filteredCetakTx.length > 0 && ` + ${recapDataset.filteredCetakTx.length} transaksi cetak agen`}
                </div>
                <div className="text-slate-500">
                  Isi PDF sama dengan daftar yang tampil, selama agen dan periodenya sama.
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Dokumen rekap PDF ini mencakup detail volume pengambilan bahan mentah toko, serta semua tagihan digital printing/cetak agen mitra.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDownloadRecapModal(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-all"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleDownloadPdfRecap}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all border border-red-700"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Unduh PDF Rekap</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom / Preview Foto Produk */}
      {previewImage && (
        <ProductImageModal
          isOpen={Boolean(previewImage)}
          onClose={() => setPreviewImage(null)}
          imageUrl={previewImage.url}
          title={previewImage.name}
          code={previewImage.code}
          category={previewImage.category}
          dimensions={previewImage.dimensions}
        />
      )}

    </div>
  );
};
