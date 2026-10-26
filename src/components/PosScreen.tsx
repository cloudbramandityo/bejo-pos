/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  UserCheck,
  UserPlus,
  UserX,
  Edit2,
  Printer,
  CreditCard,
  Banknote,
  QrCode,
  Layers,
  Sparkles,
  Delete,
  Clock,
  Store,
  ChevronRight,
  Calendar,
  AlertTriangle,
  PlusCircle
} from 'lucide-react';
import {
  Product,
  Customer,
  CustomerCategory,
  CartItem,
  Shift,
  Transaction,
  UserRole,
  SpkOrder
} from '../types';
import { StoreLogo } from './StoreLogo';
import {
  saveSpkOrderCloud
} from '../backend/pocketbaseBackend';
import {
  getStoredSpkOrders,
  updateStoredSpkOrder
} from '../utils/storage';
import { clearOpenAccountConfigForCustomer, groupOpenAccountOrders, OpenAccountCustomerGroup } from '../utils/openAccountStorage';
import { SpkPickerModal } from './modals/SpkPickerModal';
import {
  formatRupiah,
  formatNumber,
  formatNumberInput,
  parseNumber,
  getFormattedDate,
  getFormattedTime,
  getInvoiceNumber,
  generateUniqueInvoiceId,
  getProductPriceForCategory,
  formatItemTransactionSpec
} from '../utils/formatters';

/**
 * Membagi sisa tagihan SPK/Open Account (setelah DP) ke setiap item secara
 * proporsional. Sisa pembulatan ditaruh di item terakhir supaya jumlah nilai
 * item selalu sama dengan tagihan order.
 */
function allocateOrderItemCharges(order: SpkOrder): number[] {
  const items = order.items || [];
  if (items.length === 0) return [];

  const itemsTotal = items.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
  const billable = order.remainingAmount > 0
    ? Number(order.remainingAmount) || 0
    : (order.isPaid ? 0 : (Number(order.totalAmount) || itemsTotal));

  if (billable <= 0) return items.map(() => 0);
  if (Math.abs(billable - itemsTotal) < 0.01) return items.map((it) => Number(it.totalPrice) || 0);

  if (itemsTotal <= 0) {
    return items.map((_, idx) => (idx === items.length - 1 ? billable : 0));
  }

  let allocated = 0;
  return items.map((it, idx) => {
    if (idx === items.length - 1) return Math.max(0, billable - allocated);
    const share = Math.round(billable * ((Number(it.totalPrice) || 0) / itemsTotal));
    allocated += share;
    return share;
  });
}

interface PosScreenProps {
  cartItems: CartItem[];
  onAddToCart: (item: CartItem) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  products: Product[];
  customers: Customer[];
  categories: CustomerCategory[];
  activeShift: Shift | null;
  storeName?: string;
  transactions: Transaction[];
  onOpenMaterialModal: () => void;
  onOpenPrintModal: () => void;
  onOpenUnifiedModal?: (tab?: 'all' | 'bahan' | 'digital_print' | 'laser_cutting' | 'supplies' | 'paket') => void;
  onOpenNewCustomerModal: () => void;
  onOpenEditCustomerModal?: (customer: Customer) => void;
  onOpenShiftModal: () => void;
  onCompleteTransaction: (transaction: Transaction) => void;
  latestCustomer: Customer | null;
  selectedCustomer?: Customer | null;
  onSelectCustomer?: (customer: Customer | null) => void;
  userRole?: UserRole;
  pendingSpkOrderToLoad?: SpkOrder | null;
  onClearPendingSpkOrder?: () => void;
  onNavigateToSpkCreate?: () => void;
}

export const PosScreen: React.FC<PosScreenProps> = ({
  cartItems,
  onAddToCart,
  onRemoveItem,
  onClearCart,
  products,
  customers,
  categories,
  activeShift,
  storeName,
  transactions,
  onOpenMaterialModal,
  onOpenPrintModal,
  onOpenUnifiedModal,
  onOpenNewCustomerModal,
  onOpenEditCustomerModal,
  onOpenShiftModal,
  onCompleteTransaction,
  latestCustomer,
  selectedCustomer: propSelectedCustomer,
  onSelectCustomer,
  userRole,
  pendingSpkOrderToLoad,
  onClearPendingSpkOrder,
  onNavigateToSpkCreate,
}) => {
  // Custom Date state for DEVELOPER account
  const [customPosDate, setCustomPosDate] = useState<string>('');
  // Customer selection
  const [internalSelectedCustomer, setInternalSelectedCustomer] = useState<Customer | null>(null);
  const selectedCustomer = propSelectedCustomer !== undefined ? propSelectedCustomer : internalSelectedCustomer;
  const setSelectedCustomer = onSelectCustomer || setInternalSelectedCustomer;
  const [waSearchInput, setWaSearchInput] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Sync if latest customer created
  useEffect(() => {
    if (latestCustomer) {
      setSelectedCustomer(latestCustomer);
    }
  }, [latestCustomer]);

  // Product quick search
  const [productSearchInput, setProductSearchInput] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Monetary calculations
  const [discountInput, setDiscountInput] = useState('0');
  const [discountIsManual, setDiscountIsManual] = useState(false);
  const [cashierNotes, setCashierNotes] = useState('');

  // Payment Breakdown
  const [cashAmount, setCashAmount] = useState<string>('0');
  const [transferAmount, setTransferAmount] = useState<string>('0');
  const [qrisAmount, setQrisAmount] = useState<string>('0');
  const [activePaymentMethod, setActivePaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS'>('CASH');

  // Currently focused input for virtual keypad
  const [focusedKeypadTarget, setFocusedKeypadTarget] = useState<'cash' | 'transfer' | 'qris' | 'discount'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Transaction Reset Handler (Clears all cart items and restores clean default state)
  const handleNewTransaction = () => {
    onClearCart();
    setSelectedCustomer(null);
    setWaSearchInput('');
    setShowCustomerDropdown(false);
    setProductSearchInput('');
    setShowProductDropdown(false);
    setDiscountIsManual(false);
    setDiscountInput('0');
    setCashierNotes('');
    setCashAmount('0');
    setTransferAmount('0');
    setQrisAmount('0');
    setActivePaymentMethod('CASH');
    setFocusedKeypadTarget('cash');
    setLoadedSpkOrders([]);
    setLoadedOpenAccountNotice(null);
  };

  // SPK Cetak Digital Integration & Open Account Integration
  const [isSpkPickerOpen, setIsSpkPickerOpen] = useState(false);
  const [spkPickerInitialTab, setSpkPickerInitialTab] = useState<'ALL' | 'SIAP_AMBIL' | 'OPEN_ACCOUNT'>('ALL');
  const [spkOrdersList, setSpkOrdersList] = useState<SpkOrder[]>(() => getStoredSpkOrders());
  const [loadedSpkOrders, setLoadedSpkOrders] = useState<SpkOrder[]>([]);
  const [loadedOpenAccountNotice, setLoadedOpenAccountNotice] = useState<any | null>(null);
  const [blockingErrorModal, setBlockingErrorModal] = useState<string | null>(null);

  // Sync loadedSpkOrders with current cartItems (remove SPK from banner if its items were removed)
  useEffect(() => {
    const activeSpkIds = new Set(cartItems.map((it) => it.spkId).filter(Boolean));
    setLoadedSpkOrders((prev) => prev.filter((o) => activeSpkIds.has(o.id)));
  }, [cartItems]);

  // Handle pendingSpkOrderToLoad from Tab Navigation (supports single SPK or consolidated Open Account group)
  useEffect(() => {
    if (pendingSpkOrderToLoad) {
      if (
        (pendingSpkOrderToLoad as any).orders &&
        Array.isArray((pendingSpkOrderToLoad as any).orders) &&
        (pendingSpkOrderToLoad as any).customerId
      ) {
        handleLoadOpenAccountToCart(pendingSpkOrderToLoad);
      } else {
        handleLoadSpkToCart(pendingSpkOrderToLoad);
      }
      onClearPendingSpkOrder?.();
    }
  }, [pendingSpkOrderToLoad]);

  useEffect(() => {
    const handleSpkSync = (e: any) => {
      if (e.detail) {
        setSpkOrdersList(e.detail);
      } else {
        setSpkOrdersList(getStoredSpkOrders());
      }
    };
    window.addEventListener('bejo_spk_orders_updated', handleSpkSync);
    return () => window.removeEventListener('bejo_spk_orders_updated', handleSpkSync);
  }, []);

  const readySpkCount = useMemo(() => {
    return spkOrdersList.filter((o) => o.status === 'SIAP_AMBIL').length;
  }, [spkOrdersList]);

  const openAccountGroups = useMemo(() => {
    const oaOrders = spkOrdersList.filter((o) => o.status === 'OPEN_ACCOUNT' || o.isOpenAccount);
    return groupOpenAccountOrders(oaOrders);
  }, [spkOrdersList]);

  // Handle Loading SPK Order into POS Cart (Mendukung Lebih dari 1 SPK)
  const handleLoadSpkToCart = (order: SpkOrder, options?: { skipAutoFill?: boolean }) => {
    // 1. Validasi Aturan: Open Account tidak boleh digabung dengan transaksi lainnya
    if (cartItems.some((it) => it.isOpenAccount)) {
      setBlockingErrorModal('Transaksi Open Account tidak boleh digabung dengan transaksi lainnya.');
      return;
    }

    // Jika SPK ini berstatus OPEN_ACCOUNT, tolak jika keranjang sudah ada transaksi apa pun
    if (order.status === 'OPEN_ACCOUNT' || order.isOpenAccount) {
      if (cartItems.length > 0) {
        setBlockingErrorModal('Transaksi Open Account tidak boleh digabung dengan transaksi lainnya.');
        return;
      }
    }

    // 2. Cegah duplikasi SPK yang sama di dalam keranjang kasir
    if (cartItems.some((it) => it.spkId === order.id)) {
      alert(`Pesanan SPK #${order.orderNumber} sudah ada di dalam keranjang kasir.`);
      return;
    }

    // 3. Cocokkan atau buat data pelanggan
    let matchedCustomer = customers.find(
      (c) =>
        (order.customerPhone && c.phone === order.customerPhone) ||
        c.name.toLowerCase() === order.customerName.toLowerCase()
    );

    if (!matchedCustomer) {
      const catObj = categories.find(
        (cat) => cat.name.toLowerCase() === (order.customerCategory || 'umum').toLowerCase()
      );
      matchedCustomer = {
        id: 'cust_spk_' + order.id,
        name: order.customerName,
        phone: order.customerPhone || '',
        categoryId: catObj?.id || 'cat_umum',
        createdAt: order.date
      };
    }

    // Atur pelanggan jika belum ada pelanggan yang dipilih atau masih umum
    if (!selectedCustomer || selectedCustomer.id === 'cat_umum' || selectedCustomer.name === 'Pelanggan Umum' || selectedCustomer.id.startsWith('cust_spk_')) {
      setSelectedCustomer(matchedCustomer);
      if (order.customerPhone) {
        setWaSearchInput(order.customerPhone);
      }
    }

    // 4. Masukkan seluruh item SPK ke keranjang kasir TANPA MENGHAPUS item sebelumnya
    setLoadedOpenAccountNotice(null);

    let spkChargedTotal = 0;
    const chargedPrices = allocateOrderItemCharges(order);
    const orderCharge = chargedPrices.reduce((acc, val) => acc + val, 0);

    if (orderCharge <= 0) {
      setBlockingErrorModal(
        `SPK ${order.orderNumber} tidak memiliki sisa tagihan yang perlu dibayar. Periksa status pembayaran SPK tersebut.`
      );
      return;
    }

    order.items.forEach((item, idx) => {
      const finishingsText = item.finishings.length > 0 ? ` + ${item.finishings.map((f) => f.name).join(', ')}` : '';
      const dpText = order.dpPaid > 0 ? ` (DP: -${formatRupiah(order.dpPaid)})` : '';
      const specLabel = `${item.materialName} • ${item.lengthMeters}x${item.widthMeters}m (${item.qty || 1} pcs)${finishingsText}${dpText}`;

      const chargedPrice = chargedPrices[idx] ?? 0;
      spkChargedTotal += chargedPrice;

      const newCartItem: CartItem = {
        id: `cart_spk_${order.id}_${item.id || idx}`,
        spkId: order.id,
        spkOrderNumber: order.orderNumber,
        code: 'CETAK',
        name: `[SPK ${order.orderNumber}] ${item.jobName}`,
        dimensions: `${item.lengthMeters}x${item.widthMeters}m`,
        qty: item.qty || 1,
        itemCount: item.qty || 1,
        unit: `${item.lengthMeters}x${item.widthMeters}m (${item.areaM2} m²)`,
        formattedSpec: specLabel,
        unitPrice: chargedPrice,
        totalPrice: chargedPrice,
        category: 'digital_printing',
        saleType: 'meter',
        lengthMeters: item.lengthMeters,
        widthMeters: item.widthMeters,
        sqm: item.areaM2,
        notes: `SPK: ${order.orderNumber} • ${item.materialName}${finishingsText}${
          order.dpPaid > 0 ? ` • DP: -Rp ${formatNumber(order.dpPaid)}` : ''
        }`
      };

      onAddToCart(newCartItem);
    });

    // 5. Daftarkan ke daftar SPK yang dimuat di kasir
    setLoadedSpkOrders((prev) => {
      const filtered = prev.filter((o) => o.id !== order.id);
      return [...filtered, order];
    });

    // 6. Update ringkasan catatan kasir
    const spkNote = `SPK #${order.orderNumber} (${order.customerName})`;
    setCashierNotes((prev) => {
      if (!prev) return `Pelunasan SPK: ${spkNote}`;
      if (prev.includes(order.orderNumber)) return prev;
      return `${prev} + ${spkNote}`;
    });

    // 7. Auto-fill jumlah bayar kasir ke akumulasi total keranjang baru
    if (!options?.skipAutoFill) {
      const currentSubtotal = cartItems.reduce((acc, it) => acc + it.totalPrice, 0);
      const newGrandTotal = Math.max(0, currentSubtotal + spkChargedTotal - discountVal);
      setCashAmount(formatNumber(newGrandTotal));
      setTransferAmount('0');
      setQrisAmount('0');
      setActivePaymentMethod('CASH');
      setFocusedKeypadTarget('cash');
    }
  };

  // Handle Loading Multiple SPK Orders sekaligus ke POS Cart
  const handleLoadBatchSpkToCart = (ordersToAdd: SpkOrder[]) => {
    if (cartItems.some((it) => it.isOpenAccount)) {
      setBlockingErrorModal('Transaksi Open Account tidak boleh digabung dengan transaksi lainnya.');
      return;
    }

    if (ordersToAdd.some((o) => o.status === 'OPEN_ACCOUNT' || o.isOpenAccount)) {
      if (cartItems.length > 0 || ordersToAdd.length > 1) {
        setBlockingErrorModal('Transaksi Open Account tidak boleh digabung dengan transaksi lainnya.');
        return;
      }
    }

    const unadded = ordersToAdd.filter((o) => !cartItems.some((it) => it.spkId === o.id));
    if (unadded.length === 0) {
      alert('Semua SPK yang dipilih sudah ada di dalam keranjang.');
      return;
    }

    let batchCharge = 0;
    unadded.forEach((o) => {
      const charge = allocateOrderItemCharges(o).reduce((acc, val) => acc + val, 0);
      if (charge <= 0) return;
      batchCharge += charge;
      handleLoadSpkToCart(o, { skipAutoFill: true });
    });

    const currentSubtotal = cartItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const newGrandTotal = Math.max(0, currentSubtotal + batchCharge - discountVal);
    setCashAmount(formatNumber(newGrandTotal));
    setTransferAmount('0');
    setQrisAmount('0');
    setActivePaymentMethod('CASH');
    setFocusedKeypadTarget('cash');
  };

  // Handle Loading Consolidated Open Account Billing into POS Cart
  const handleLoadOpenAccountToCart = (group: any) => {
    // Validasi Aturan Mutlak: Transaksi Open Account tidak boleh digabung dengan transaksi lainnya
    if (cartItems.length > 0) {
      if (
        confirm(
          `Keranjang kasir saat ini sudah berisi transaksi lain (${cartItems.length} item).\nTransaksi Open Account (${group.customerName || 'Pelanggan'}) tidak dapat digabung dengan transaksi lainnya.\n\nKosongkan keranjang sekarang dan muat tagihan Open Account ini?`
        )
      ) {
        onClearCart();
        setLoadedSpkOrders([]);
      } else {
        setBlockingErrorModal(
          'Transaksi Open Account tidak boleh digabung dengan transaksi lainnya. Kosongkan keranjang terlebih dahulu jika ingin memproses tagihan Open Account.'
        );
        return;
      }
    }

    // 1. Cocokkan atau buat pelanggan
    let matchedCustomer = customers.find(
      (c) =>
        (group.customerPhone && c.phone === group.customerPhone) ||
        c.name.toLowerCase() === group.customerName.toLowerCase() ||
        c.id === group.customerId
    );

    if (!matchedCustomer) {
      const catObj = categories.find(
        (cat) => cat.name.toLowerCase() === (group.customerCategory || 'umum').toLowerCase()
      );
      matchedCustomer = {
        id: group.customerId || 'cust_oa_' + Date.now(),
        name: group.customerName,
        phone: group.customerPhone || '',
        categoryId: catObj?.id || 'cat_umum',
        createdAt: group.latestDate || getFormattedDate()
      };
    }

    setSelectedCustomer(matchedCustomer);
    if (group.customerPhone) {
      setWaSearchInput(group.customerPhone);
    }

    // 2. Kosongkan keranjang dan masukkan seluruh item SPK konsolidasi Open Account
    onClearCart();
    setLoadedSpkOrders([]);
    setDiscountIsManual(false);

    (group.orders || []).forEach((order: SpkOrder) => {
      const chargedPrices = allocateOrderItemCharges(order);
      const orderCharge = chargedPrices.reduce((acc, val) => acc + val, 0);
      if (orderCharge <= 0) return;

      order.items.forEach((item, idx) => {
        const finishingsText = item.finishings.length > 0 ? ` + ${item.finishings.map((f) => f.name).join(', ')}` : '';
        const dpText = order.dpPaid > 0 ? ` (DP: -${formatRupiah(order.dpPaid)})` : '';
        const specLabel = `${item.materialName} • ${item.lengthMeters}x${item.widthMeters}m (${item.qty || 1} pcs)${finishingsText}${dpText}`;
        const chargedPrice = chargedPrices[idx] ?? 0;

        const newCartItem: CartItem = {
          id: `cart_oa_${order.id}_${item.id || idx}`,
          spkId: order.id,
          spkOrderNumber: order.orderNumber,
          isOpenAccount: true,
          openAccountCustomerId: group.customerId,
          openAccountCustomerName: group.customerName,
          code: 'OPEN_ACCOUNT',
          name: `[OA ${order.orderNumber}] ${item.jobName}`,
          dimensions: `${item.lengthMeters}x${item.widthMeters}m`,
          qty: item.qty || 1,
          itemCount: item.qty || 1,
          unit: `${item.lengthMeters}x${item.widthMeters}m (${item.areaM2} m²)`,
          formattedSpec: specLabel,
          unitPrice: chargedPrice,
          totalPrice: chargedPrice,
          category: 'digital_printing',
          saleType: 'meter',
          lengthMeters: item.lengthMeters,
          widthMeters: item.widthMeters,
          sqm: item.areaM2,
          notes: `SPK: ${order.orderNumber} • ${item.materialName}${finishingsText}`
        };

        onAddToCart(newCartItem);
      });
    });

    // Handle penambahan / pengurangan tagihan (Sisa Tagihan / Penyesuaian)
    if (group.adjustment && group.adjustment !== 0) {
      if (group.adjustment > 0) {
        const adjItem: CartItem = {
          id: `cart_oa_adj_${group.customerId}`,
          isOpenAccount: true,
          openAccountCustomerId: group.customerId,
          openAccountCustomerName: group.customerName,
          code: 'PENYESUAIAN_OA',
          name: `Penyesuaian Biaya (+): ${group.adjustmentReason || 'Sisa Tagihan'}`,
          dimensions: '-',
          qty: 1,
          itemCount: 1,
          unit: '1 Paket',
          formattedSpec: group.adjustmentReason || 'Penyesuaian Sisa Tagihan',
          unitPrice: group.adjustment,
          totalPrice: group.adjustment,
          category: 'digital_printing',
          notes: group.adjustmentReason || 'Penyesuaian Tagihan Open Account'
        };
        onAddToCart(adjItem);
        setDiscountInput('0');
      } else {
        setDiscountInput(formatNumber(Math.abs(group.adjustment)));
        setDiscountIsManual(true);
      }
    } else {
      setDiscountInput('0');
    }

    // 3. Set ringkasan notes dan auto-fill jumlah bayar
    const notesSummary = `Tagihan Open Account (${group.orders.length} SPK): ${group.orders.map((o: any) => o.orderNumber).join(', ')}${group.notes ? ` • Catatan: ${group.notes}` : ''}${group.adjustmentReason ? ` • Sisa Tagihan: ${group.adjustmentReason}` : ''}`;
    setCashierNotes(notesSummary);
    setCashAmount(formatNumber(group.totalAmount));
    setTransferAmount('0');
    setQrisAmount('0');
    setActivePaymentMethod('CASH');
    setFocusedKeypadTarget('cash');
    setLoadedOpenAccountNotice(group);
  };

  // Listen to external events when triggered from SpkScreen
  useEffect(() => {
    const handleExternalSpkLoad = (e: any) => {
      if (e.detail) {
        handleLoadSpkToCart(e.detail);
      }
    };
    const handleExternalOpenAccountLoad = (e: any) => {
      if (e.detail) {
        handleLoadOpenAccountToCart(e.detail);
      }
    };
    window.addEventListener('bejo_load_spk_to_pos', handleExternalSpkLoad);
    window.addEventListener('bejo_load_open_account_to_pos', handleExternalOpenAccountLoad);
    return () => {
      window.removeEventListener('bejo_load_spk_to_pos', handleExternalSpkLoad);
      window.removeEventListener('bejo_load_open_account_to_pos', handleExternalOpenAccountLoad);
    };
  }, [customers, categories, cartItems]);
  const [currentDate, setCurrentDate] = useState(getFormattedDate());
  const [currentTime, setCurrentTime] = useState(getFormattedTime(true));

  useEffect(() => {
    const updateClock = () => {
      setCurrentDate(getFormattedDate());
      setCurrentTime(getFormattedTime(true));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Diskon kategori pelanggan hanya untuk transaksi retail, bukan pelunasan SPK/Open Account
  useEffect(() => {
    if (discountIsManual) return;

    const hasSpkOrOpenAccountItem = cartItems.some(
      (it) => !!it.spkId || it.isOpenAccount || it.code === 'CETAK' || it.code === 'OPEN_ACCOUNT' || it.code === 'PENYESUAIAN_OA'
    );
    const category = selectedCustomer
      ? categories.find((c) => c.id === selectedCustomer.categoryId)
      : undefined;
    const sub = cartItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const autoDiscount = !hasSpkOrOpenAccountItem && category && category.discountPercent > 0
      ? Math.round((sub * category.discountPercent) / 100)
      : 0;

    setDiscountInput(autoDiscount > 0 ? formatNumber(autoDiscount) : '0');
  }, [selectedCustomer, cartItems, categories, discountIsManual]);

  // Derived calculations
  const totalQty = cartItems.reduce((acc, item) => acc + (item.qty || 1), 0);
  const subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const discountVal = parseNumber(discountInput);
  const tax = 0; // tax is 0 as seen in reference
  const grandTotal = Math.max(0, subtotal - discountVal + tax);

  const numCash = parseNumber(cashAmount);
  const numTransfer = parseNumber(transferAmount);
  const numQris = parseNumber(qrisAmount);
  const totalPaid = numCash + numTransfer + numQris;
  const change = Math.max(0, totalPaid - grandTotal);

  // Cart operations
  const handleRemoveItem = (id: string) => {
    onRemoveItem(id);
  };

  const existingSpkIds = useMemo(() => {
    return Array.from(new Set(cartItems.map((it) => it.spkId).filter(Boolean))) as string[];
  }, [cartItems]);

  const handleClearCart = () => {
    if (confirm('Kosongkan semua barang di keranjang kasir?')) {
      onClearCart();
      setLoadedSpkOrders([]);
      setLoadedOpenAccountNotice(null);
      setDiscountIsManual(false);
      setDiscountInput('0');
      setCashAmount('0');
      setTransferAmount('0');
      setQrisAmount('0');
      setCashierNotes('');
    }
  };

  const handleSelectProduct = (product: Product) => {
    // Validasi Aturan: Open Account tidak boleh digabung dengan transaksi lainnya
    if (cartItems.some((it) => it.isOpenAccount)) {
      setBlockingErrorModal('Transaksi Open Account tidak boleh digabung dengan transaksi lainnya.');
      return;
    }

    const custCatName = selectedCustomer 
      ? categories.find(c => c.id === selectedCustomer.categoryId)?.name || 'GROSIR'
      : 'GROSIR';
    const isMeter = product.unit === 'meter' || product.category === 'vinyl_meteran' || product.category === 'digital_printing';
    const unitPrice = getProductPriceForCategory(product, custCatName, isMeter);

    const saleType = product.unit === 'roll' ? 'roll' : (product.unit === 'lembar' ? 'lembar' : (isMeter ? 'meter' : undefined));
    const formattedSpec = saleType === 'roll'
      ? '1 Roll'
      : saleType === 'lembar'
      ? '1 Lembar'
      : (product.dimensions ? `${product.dimensions} x 1` : '1 pcs');

    const newItem: CartItem = {
      id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      productId: product.id,
      code: product.code,
      name: product.name,
      dimensions: product.dimensions || '',
      qty: 1,
      itemCount: 1,
      unit: formattedSpec,
      formattedSpec: formattedSpec,
      saleType: saleType,
      unitPrice: unitPrice,
      totalPrice: unitPrice,
      category: product.category
    };
    onAddToCart(newItem);
    setProductSearchInput('');
    setShowProductDropdown(false);
  };

  // Virtual Keypad handling
  const handleKeypadPress = (val: string) => {
    if (focusedKeypadTarget === 'discount') setDiscountIsManual(true);

    let currentVal = '';
    if (focusedKeypadTarget === 'cash') currentVal = cashAmount;
    if (focusedKeypadTarget === 'transfer') currentVal = transferAmount;
    if (focusedKeypadTarget === 'qris') currentVal = qrisAmount;
    if (focusedKeypadTarget === 'discount') currentVal = discountInput;

    const isNegative = currentVal.trim().startsWith('-');
    let rawNum = currentVal.replace(/[^0-9]/g, '');

    if (val === 'C') {
      rawNum = '0';
      if (focusedKeypadTarget === 'cash') setCashAmount('0');
      if (focusedKeypadTarget === 'transfer') setTransferAmount('0');
      if (focusedKeypadTarget === 'qris') setQrisAmount('0');
      if (focusedKeypadTarget === 'discount') setDiscountInput('0');
      return;
    } else if (val === 'DEL') {
      rawNum = rawNum.slice(0, -1) || '0';
      const numVal = parseInt(rawNum, 10) || 0;
      const formatted = numVal === 0 ? '0' : (isNegative ? `-${formatNumber(numVal)}` : formatNumber(numVal));
      if (focusedKeypadTarget === 'cash') setCashAmount(formatted);
      if (focusedKeypadTarget === 'transfer') setTransferAmount(formatted);
      if (focusedKeypadTarget === 'qris') setQrisAmount(formatted);
      if (focusedKeypadTarget === 'discount') setDiscountInput(formatted);
      return;
    } else if (val === '00') {
      rawNum = rawNum === '0' ? '0' : rawNum + '00';
    } else if (val === '+/-' || val === '-') {
      const newNeg = !isNegative;
      const numVal = parseInt(rawNum, 10) || 0;
      const formatted = numVal === 0 ? (newNeg ? '-' : '0') : (newNeg ? `-${formatNumber(numVal)}` : formatNumber(numVal));
      if (focusedKeypadTarget === 'cash') setCashAmount(formatted);
      if (focusedKeypadTarget === 'transfer') setTransferAmount(formatted);
      if (focusedKeypadTarget === 'qris') setQrisAmount(formatted);
      if (focusedKeypadTarget === 'discount') setDiscountInput(formatted);
      return;
    } else if (val === '.') {
      return;
    } else {
      rawNum = rawNum === '0' ? val : rawNum + val;
    }

    const numVal = parseInt(rawNum, 10) || 0;
    const formatted = isNegative ? `-${formatNumber(numVal)}` : formatNumber(numVal);

    if (focusedKeypadTarget === 'cash') setCashAmount(formatted);
    if (focusedKeypadTarget === 'transfer') setTransferAmount(formatted);
    if (focusedKeypadTarget === 'qris') setQrisAmount(formatted);
    if (focusedKeypadTarget === 'discount') setDiscountInput(formatted);
  };

  // Quick payment method selector
  const handleSelectQuickPayment = (method: 'CASH' | 'TRANSFER' | 'QRIS') => {
    setActivePaymentMethod(method);
    if (method === 'CASH') {
      setCashAmount(formatNumber(grandTotal));
      setTransferAmount('0');
      setQrisAmount('0');
      setFocusedKeypadTarget('cash');
    } else if (method === 'TRANSFER') {
      setCashAmount('0');
      setTransferAmount(formatNumber(grandTotal));
      setQrisAmount('0');
      setFocusedKeypadTarget('transfer');
    } else if (method === 'QRIS') {
      setCashAmount('0');
      setTransferAmount('0');
      setQrisAmount(formatNumber(grandTotal));
      setFocusedKeypadTarget('qris');
    }
  };

  // Execute payment
  const handleProcessPayment = () => {
    if (isSubmitting) return;

    if (cartItems.length === 0) {
      alert('Keranjang masih kosong! Silakan tambahkan barang.');
      return;
    }

    if (!activeShift) {
      if (confirm('Shift kasir belum dibuka. Buka shift kasir terlebih dahulu?')) {
        onOpenShiftModal();
      }
      return;
    }

    if (totalPaid < grandTotal) {
      alert(
        `Pembayaran kurang! Total tagihan: ${formatRupiah(grandTotal)}, baru dibayar: ${formatRupiah(
          totalPaid
        )}`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const currentCustomerCategory = selectedCustomer
        ? (categories.find((c) => c.id === selectedCustomer.categoryId)?.name || 'GROSIR')
        : 'UMUM';

      const invoiceId = generateUniqueInvoiceId(transactions);

      let txDateStr = currentDate;
      let txTimestamp = Date.now();

      if (customPosDate) {
        const parts = customPosDate.split('-');
        if (parts.length === 3) {
          const yearShort = parts[0].length === 4 ? parts[0].slice(-2) : parts[0];
          txDateStr = `${parts[2]}/${parts[1]}/${yearShort}`;
        }
        const parsedTs = new Date(`${customPosDate}T${currentTime}:00`).getTime();
        if (!isNaN(parsedTs)) {
          txTimestamp = parsedTs;
        }
      }

      const isBackdated = !!(customPosDate && txDateStr !== currentDate);

      // Collect any linked SPK Order IDs & Open Account metadata
      const isOpenAccountTx = cartItems.some((it) => it.isOpenAccount);
      const oaCustId = cartItems.find((it) => it.isOpenAccount)?.openAccountCustomerId;
      const linkedSpkIds = Array.from(new Set(cartItems.map((it) => it.spkId).filter(Boolean))) as string[];
      const linkedSpkNumbers = Array.from(new Set(cartItems.map((it) => it.spkOrderNumber).filter(Boolean))) as string[];

      const newTx: Transaction = {
        id: invoiceId,
        shiftId: isBackdated ? undefined : activeShift.id,
        isBackdated: isBackdated ? true : undefined,
        cashierName: activeShift.cashierName,
        storeName: activeShift.storeName || storeName || 'BEJO Pelsek',
        date: txDateStr,
        time: currentTime,
        timestamp: txTimestamp,
        customer: selectedCustomer || undefined,
        customerCategory: currentCustomerCategory,
        items: [...cartItems],
        totalQty: totalQty,
        subtotal: subtotal,
        tax: 0,
        discount: discountVal,
        total: grandTotal,
        paymentMethods: {
          cash: Math.max(0, numCash - change),
          transfer: numTransfer,
          qris: numQris
        },
        paidAmount: totalPaid,
        change: change,
        cashierNotes: cashierNotes,
        spkId: linkedSpkIds.join(', ') || undefined,
        spkOrderNumber: linkedSpkNumbers.join(', ') || undefined,
        isOpenAccount: isOpenAccountTx || undefined,
        transactionType: isOpenAccountTx ? 'Open Account' : (linkedSpkIds.length > 0 ? 'SPK Cetak' : 'Reguler (POS)'),
        openAccountCustomerId: oaCustId || undefined,
        openAccountSpkIds: isOpenAccountTx && linkedSpkIds.length > 0 ? linkedSpkIds : undefined,
        openAccountNotes: isOpenAccountTx ? cashierNotes : undefined
      };

      // Automatically complete and close linked SPK orders (pindah ke Selesai / Arsip)
      if (linkedSpkIds.length > 0) {
        linkedSpkIds.forEach((sId) => {
          const updated = updateStoredSpkOrder(
            sId,
            {
              status: 'SELESAI_LUNAS',
              isPaid: true,
              isOpenAccount: isOpenAccountTx ? true : undefined,
              posTransactionId: invoiceId,
              remainingAmount: 0
            },
            activeShift.cashierName || 'Kasir POS'
          );
          const refreshed = updated.find((o) => o.id === sId);
          if (refreshed) {
            saveSpkOrderCloud(refreshed).catch(console.error);
          }
        });
      }

      if (isOpenAccountTx && oaCustId) {
        clearOpenAccountConfigForCustomer(oaCustId);
      }

      onCompleteTransaction(newTx);

      // Reset after success
      onClearCart();
      setDiscountIsManual(false);
      setDiscountInput('0');
      setCashAmount('0');
      setTransferAmount('0');
      setQrisAmount('0');
      setCashierNotes('');
      setLoadedSpkOrders([]);
      setLoadedOpenAccountNotice(null);
    } finally {
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
  };

  // Filter products for quick search
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearchInput.toLowerCase()) ||
      p.code.toLowerCase().includes(productSearchInput.toLowerCase())
  );

  // Filter customers
  const filteredCustomers = customers.filter(
    (c) =>
      c.phone.includes(waSearchInput) ||
      c.name.toLowerCase().includes(waSearchInput.toLowerCase())
  );

  const selectedCustomerCategory = selectedCustomer
    ? categories.find((c) => c.id === selectedCustomer.categoryId)
    : null;

  // Filter customer past transactions
  const customerHistory = selectedCustomer
    ? transactions.filter((t) => t.customer?.phone === selectedCustomer.phone)
    : [];

  return (
    <div id="pos-main-container" className="w-full max-w-[1440px] mx-auto p-2 sm:p-4">
      {/* Outer Card Wrapper */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col xl:flex-row">
        
        {/* ================= LEFT SECTION: CART & TRANSACTIONS ================= */}
        <div className="w-full xl:w-[58%] border-b xl:border-b-0 xl:border-r border-slate-200 flex flex-col justify-between p-4 sm:p-5 bg-white">
          <div className="space-y-4">
            
            {/* Search Input Bar */}
            <div className="relative">
              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent transition-all">
                <input
                  type="text"
                  value={productSearchInput}
                  onChange={(e) => {
                    setProductSearchInput(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Cari barang atau scan barcode"
                  className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
                />
                <div className="flex items-center gap-2 text-slate-400 shrink-0">
                  <Search className="w-4 h-4 hover:text-slate-600 cursor-pointer" />
                  <div className="w-px h-4 bg-slate-300"></div>
                  <Barcode className="w-5 h-5 hover:text-slate-600 cursor-pointer" />
                </div>
              </div>

              {/* Product quick search dropdown */}
              {showProductDropdown && productSearchInput && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto z-30 divide-y divide-slate-100">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => {
                      const isZeroStock = (p.stock ?? 0) <= 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProduct(p)}
                          className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-xs transition-colors ${
                            isZeroStock
                              ? 'bg-red-50 hover:bg-red-100/80 border-l-4 border-l-red-600'
                              : 'hover:bg-blue-50/70'
                          }`}
                        >
                          <div>
                            <span
                              className={`font-mono font-bold mr-2 px-1.5 py-0.5 rounded text-[11px] ${
                                isZeroStock
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {p.code}
                            </span>
                            <span className={`font-semibold ${isZeroStock ? 'text-red-900 font-bold' : 'text-slate-800'}`}>
                              {p.name}
                            </span>
                            <span className={`text-[11px] ml-2 ${isZeroStock ? 'text-red-700' : 'text-slate-400'}`}>
                              ({p.dimensions || '-'})
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`font-bold block ${isZeroStock ? 'text-red-700' : 'text-blue-700'}`}>
                              {formatRupiah(p.price)}
                            </span>
                            {isZeroStock && (
                              <span className="inline-block text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.2 rounded mt-0.5">
                                STOK HABIS (0)
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Barang tidak ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Store & Invoice Meta Header */}
            <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-700 font-mono gap-y-2">
              <div className="flex items-center gap-3">
                <StoreLogo size="sm" rounded="rounded-lg" storeName={activeShift?.storeName || storeName} />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-10">Toko</span>
                    <span className="text-slate-400">:</span>
                    <span className="font-bold text-slate-900">{activeShift?.storeName || storeName || 'BEJO Pelsek'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400 w-10">Waktu</span>
                    <span className="text-slate-400">:</span>
                    <span>
                      {customPosDate ? (
                        <strong className="text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300">
                          {(() => {
                            const p = customPosDate.split('-');
                            return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(-2)}` : customPosDate;
                          })()}{' '}
                          {currentTime}
                        </strong>
                      ) : (
                        `${currentDate} ${currentTime}`
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-0.5 text-right sm:text-right">
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="text-slate-400">No. Invoice:</span>
                  <span className="font-bold text-slate-900">{getInvoiceNumber(transactions.length)}</span>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="text-slate-400">Kasir:</span>
                  <span className="font-bold text-blue-700 uppercase">{activeShift?.cashierName || 'FIRA'}</span>
                </div>
              </div>

              {/* Developer Date Selector Bar */}
              {userRole === 'DEVELOPER' && (
                <div className="w-full pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 font-sans">
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1 text-xs text-amber-900 font-bold">
                    <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Pilih Tanggal Transaksi:</span>
                    <input
                      type="date"
                      value={customPosDate}
                      onChange={(e) => setCustomPosDate(e.target.value)}
                      className="bg-white border border-amber-300 rounded px-2 py-0.5 font-mono font-bold text-amber-900 text-xs focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                    {customPosDate && (
                      <button
                        type="button"
                        onClick={() => setCustomPosDate('')}
                        className="text-amber-700 hover:text-amber-900 underline text-[11px] font-bold cursor-pointer ml-1"
                        title="Reset ke tanggal hari ini"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider bg-amber-100/60 px-2 py-0.5 rounded">
                    AKSES DEVELOPER
                  </span>
                </div>
              )}
            </div>

            {/* SPK Loaded Banner Alert - Mendukung 1 atau Lebih dari 1 SPK */}
            {loadedSpkOrders.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-slate-900">
                        {loadedSpkOrders.length > 1
                          ? `${loadedSpkOrders.length} Transaksi SPK Dimuat di Kasir`
                          : `Pesanan SPK: ${loadedSpkOrders[0].customerName}`}
                      </span>
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.2 rounded-full shadow-2xs">
                        {loadedSpkOrders.length > 1 ? `${loadedSpkOrders.length} SPK Digabung` : 'Siap Bayar'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5 font-medium">
                      <span className="text-slate-600">
                        No. SPK: <strong className="text-indigo-900 font-bold font-mono">{loadedSpkOrders.map((o) => `#${o.orderNumber}`).join(', ')}</strong>
                      </span>
                      <span className="text-slate-600">
                        Pelanggan: <strong className="text-slate-900 font-bold">{Array.from(new Set(loadedSpkOrders.map((o) => o.customerName))).join(', ')}</strong>
                      </span>
                      <span className="text-emerald-900 bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded text-[11px] font-black font-mono">
                        Sisa Tagihan SPK: {formatRupiah(loadedSpkOrders.reduce((sum, o) => sum + (o.remainingAmount ?? o.totalAmount), 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsSpkPickerOpen(true)}
                    className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
                    title="Tambah SPK lain ke keranjang kasir"
                  >
                    + Tambah SPK Lain
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoadedSpkOrders([])}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-300 cursor-pointer transition-colors"
                    title="Tutup banner pemberitahuan"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}

            {/* Open Account Loaded Banner Alert */}
            {loadedOpenAccountNotice && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-black border border-amber-500 shadow-2xs">
                    <Layers className="w-4 h-4 text-slate-950" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-slate-950">
                        Tagihan Open Account: <span className="text-amber-950 underline">{loadedOpenAccountNotice.customerName}</span>
                      </span>
                      <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.2 rounded-full border border-amber-500">
                        Konsolidasi ({loadedOpenAccountNotice.orders?.length || 0} SPK)
                      </span>
                      <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.2 rounded-full shadow-2xs">
                        🔒 Mode Khusus Open Account
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5 font-medium">
                      <span className="text-slate-700">Subtotal SPK: <strong className="text-slate-900">{formatRupiah(loadedOpenAccountNotice.subtotal)}</strong></span>
                      {loadedOpenAccountNotice.adjustment !== 0 && (
                        <span className={`px-1.5 py-0.2 rounded text-[11px] font-bold ${loadedOpenAccountNotice.adjustment > 0 ? 'bg-amber-200 text-amber-950' : 'bg-emerald-100 text-emerald-900'}`}>
                          Penyesuaian: {loadedOpenAccountNotice.adjustment > 0 ? '+' : ''}{formatRupiah(loadedOpenAccountNotice.adjustment)} {loadedOpenAccountNotice.adjustmentReason ? `(${loadedOpenAccountNotice.adjustmentReason})` : ''}
                        </span>
                      )}
                      <span className="text-slate-950 bg-amber-300 px-2 py-0.5 rounded text-xs font-black border border-amber-400">
                        Total Tagihan: {formatRupiah(loadedOpenAccountNotice.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setLoadedOpenAccountNotice(null)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 cursor-pointer shrink-0 transition-colors"
                >
                  Tutup
                </button>
              </div>
            )}

            {/* Cart Table List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden min-h-[280px] max-h-[380px] overflow-y-auto bg-slate-50/40">
              {cartItems.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {cartItems.map((item, index) => {
                    const isOAItem = !!item.isOpenAccount;
                    const isSpkItem = !isOAItem && !!(item.spkId || item.code?.startsWith('SPK-') || item.name?.startsWith('[SPK]') || item.code === 'CETAK');
                    const cleanJobName = item.name.replace(/^\[SPK\]\s*/i, '');

                    return (
                      <div
                        key={item.id}
                        className={`p-3 text-xs sm:text-sm flex items-center justify-between gap-3 transition-colors ${
                          isOAItem
                            ? 'bg-amber-50/70 border-l-4 border-l-amber-500 hover:bg-amber-100/50'
                            : isSpkItem
                            ? 'bg-emerald-50/40 border-l-4 border-l-emerald-600 hover:bg-emerald-100/40'
                            : index % 2 === 0
                            ? 'bg-white hover:bg-blue-50/40'
                            : 'bg-slate-50 hover:bg-blue-50/40'
                        }`}
                      >
                        {/* Code and Specs */}
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          {isOAItem ? (
                            <span className="font-black text-slate-950 bg-amber-300 border border-amber-400 px-2 py-0.5 rounded text-[10px] shrink-0 flex items-center gap-1 shadow-2xs">
                              <Layers className="w-3 h-3 text-slate-950" />
                              <span>Open Account</span>
                            </span>
                          ) : isSpkItem ? (
                            <span className="font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] shrink-0 flex items-center gap-1">
                              <Printer className="w-3 h-3 text-emerald-700" />
                              <span>Cetak</span>
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs shrink-0">
                              {item.code}
                            </span>
                          )}

                          <div className="truncate flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                {cleanJobName}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span>
                                {formatItemTransactionSpec(item)}
                              </span>
                              {item.notes && !item.notes.startsWith('SPK #') && (
                                <span className="text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                                  {item.notes}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Subtotal Price & Delete Button */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-bold text-slate-900 text-xs sm:text-sm font-mono">
                              {formatRupiah(item.totalPrice)}
                            </div>
                            {isSpkItem && (
                              <div className="text-[10px] font-bold text-emerald-800">
                                Sisa Bayar
                              </div>
                            )}
                          </div>

                          {/* Red Trash Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="w-6 h-6 sm:w-7 sm:h-7 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                            title="Hapus item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <Layers className="w-10 h-10 mb-2 opacity-30" />
                  <p className="font-semibold text-xs text-slate-600">Keranjang kasir masih kosong</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Masukkan No. WhatsApp pelanggan kemudian gunakan tombol <span className="text-blue-900 font-bold">TAMBAH PENJUALAN BAHAN</span> atau <span className="text-sky-600 font-bold">TAMBAH PENJUALAN CETAK</span> di sebelah kanan.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Left Controls: Diskon, Quick Payment Toggle, Catatan Kasir */}
          <div className="space-y-3 pt-3 border-t border-slate-200 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Diskon Input */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Diskon:</span>
                <div className="relative w-36 sm:w-44">
                  <input
                    type="text"
                    value={discountInput}
                    onFocus={() => setFocusedKeypadTarget('discount')}
                    onChange={(e) => {
                      setDiscountIsManual(true);
                      setDiscountInput(formatNumberInput(e.target.value) || '0');
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 transition-all ${
                      focusedKeypadTarget === 'discount'
                        ? 'border-blue-600 ring-2 ring-blue-500/20 bg-white'
                        : 'border-slate-300'
                    }`}
                  />
                  {discountVal < 0 && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded pointer-events-none">
                      (Pembulatan)
                    </span>
                  )}
                </div>
              </div>

              {/* Payment Buttons (CASH, TRANSFER) */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="btn-pos-cash"
                  onClick={() => handleSelectQuickPayment('CASH')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-xs cursor-pointer ${
                    activePaymentMethod === 'CASH'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  CASH
                </button>
                <button
                  type="button"
                  id="btn-pos-transfer"
                  onClick={() => handleSelectQuickPayment('TRANSFER')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-xs cursor-pointer ${
                    activePaymentMethod === 'TRANSFER'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  TRANSFER
                </button>
              </div>
            </div>

            {/* Catatan Kasir Box */}
            <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50">
              <label className="block text-xs font-bold text-slate-800 tracking-wide uppercase mb-1">
                CATATAN KASIR:
              </label>
              <textarea
                rows={2}
                value={cashierNotes}
                onChange={(e) => setCashierNotes(e.target.value)}
                placeholder="Anda dapat membuat catatan terkait transaksi berlangsung."
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 resize-none focus:outline-hidden font-medium"
              />
            </div>
          </div>
        </div>

        {/* ================= RIGHT SECTION: ACTIONS, CUSTOMER, SUMMARY & KEYPAD ================= */}
        <div className="w-full xl:w-[42%] flex flex-col justify-between p-4 sm:p-5 bg-slate-50/60">
          <div className="space-y-4">
            
            {/* Top Prominent Action Buttons */}
            <div className="space-y-2">
              {/* Primary Unified Add Product Button */}
              <button
                type="button"
                id="btn-tambah-produk-terpadu"
                onClick={() => {
                  if (onOpenUnifiedModal) {
                    onOpenUnifiedModal('all');
                  } else {
                    onOpenMaterialModal();
                  }
                }}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-2xl shadow-md transition-all text-center flex items-center justify-between gap-3 active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2.5 bg-slate-800 rounded-xl text-emerald-400 border border-slate-700">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-black tracking-wider uppercase block leading-tight text-white">
                      + TAMBAH ITEM / JASA
                    </span>
                    <span className="text-[11px] text-emerald-300 font-medium">
                      Bahan, Cetak, Laser, Supplies & Paket
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>

              {/* Quick Category Direct Shortcuts */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-tambah-penjualan-bahan"
                  onClick={() => {
                    if (onOpenUnifiedModal) {
                      onOpenUnifiedModal('bahan');
                    } else {
                      onOpenMaterialModal();
                    }
                  }}
                  className="py-2.5 px-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl transition-all text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5 text-sky-600" />
                  <span>+ Bahan & Stiker</span>
                </button>

                <button
                  type="button"
                  id="btn-tambah-penjualan-cetak"
                  onClick={() => {
                    if (onNavigateToSpkCreate) {
                      onNavigateToSpkCreate();
                    } else if (onOpenPrintModal) {
                      onOpenPrintModal();
                    }
                  }}
                  className="py-2.5 px-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl transition-all text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Otomatis Buka Buat SPK Cetak Baru untuk Transaksi Jasa Cetak & Laser"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>+ Jasa Cetak & Laser</span>
                </button>
              </div>

              {/* Dual Tarik Transaksi Buttons: SPK Cetak & Open Account (Consolidated) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  id="btn-tarik-spk-cetak"
                  onClick={() => {
                    setSpkPickerInitialTab('SIAP_AMBIL');
                    setIsSpkPickerOpen(true);
                  }}
                  className="w-full py-3 px-3.5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl shadow-xs border-2 border-slate-300 hover:border-indigo-500 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200 group-hover:bg-indigo-100 transition-colors shadow-2xs">
                      <Printer className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-black tracking-wider uppercase block leading-tight text-slate-950 flex items-center gap-1.5">
                        TARIK DARI SPK
                      </span>
                      <span className="text-[11px] text-slate-600 font-bold">
                        {readySpkCount > 0
                          ? `${readySpkCount} Siap Bayar`
                          : 'Tarik pesanan cetak'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="bg-emerald-600 text-white text-[10.5px] font-mono font-black px-2 py-0.5 rounded-full shadow-2xs">
                      {readySpkCount}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition-all" />
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-tarik-open-account"
                  onClick={() => {
                    setSpkPickerInitialTab('OPEN_ACCOUNT');
                    setIsSpkPickerOpen(true);
                  }}
                  className="w-full py-3 px-3.5 bg-amber-50/80 hover:bg-amber-100/80 text-slate-950 rounded-2xl shadow-xs border-2 border-amber-400 hover:border-amber-500 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2 bg-amber-400 text-slate-950 rounded-xl border border-amber-500 shadow-2xs font-black">
                      <Layers className="w-5 h-5 text-slate-950" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-black tracking-wider uppercase block leading-tight text-slate-950 flex items-center gap-1.5">
                        TARIK OPEN ACCOUNT
                      </span>
                      <span className="text-[11px] text-amber-950 font-bold">
                        {openAccountGroups.length > 0 ? `${openAccountGroups.length} Tagihan Konsolidasi` : 'Rekening Terbuka'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="bg-amber-400 text-slate-950 text-[10.5px] font-mono font-black px-2 py-0.5 rounded-full border border-amber-500">
                      {openAccountGroups.length}
                    </span>
                    <ChevronRight className="w-4 h-4 text-amber-700 group-hover:text-amber-950 transition-all" />
                  </div>
                </button>
              </div>
            </div>

            {/* Customer Box with WhatsApp search & History */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-3">
              {/* Customer WA search bar */}
              <div className="relative">
                <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
                  <input
                    type="text"
                    value={waSearchInput}
                    onChange={(e) => {
                      setWaSearchInput(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="No. WhatsApp / Cari Pelanggan"
                    className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden font-mono"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </div>

                {showCustomerDropdown && waSearchInput && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 max-h-48 overflow-y-auto z-30 divide-y divide-slate-100 text-xs">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setWaSearchInput('');
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-blue-50 flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{c.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">{c.phone}</div>
                        </div>
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                          {(() => {
                            const cat = categories.find((cat) => cat.id === c.categoryId);
                            if (c.categoryId === 'cat_agen' || cat?.name.toUpperCase() === 'AGEN') return 'AGEN';
                            return cat ? (cat.name.toUpperCase() === 'RETAIL' ? 'UMUM' : cat.name) : 'UMUM';
                          })()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Data Customer & Riwayat Transaksi Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Customer Details Box */}
                <div className="border border-slate-200 bg-slate-50/60 rounded-xl p-2.5 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-700 pb-1 border-b border-slate-200 flex items-center justify-between">
                      <span>Data Customer:</span>
                      {selectedCustomer && (
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(null)}
                          className="text-[10px] text-slate-400 hover:text-red-600 flex items-center gap-0.5 cursor-pointer"
                          title="Batal pilih customer"
                        >
                          <UserX className="w-3 h-3" />
                          <span>Batal</span>
                        </button>
                      )}
                    </div>
                    {selectedCustomer ? (
                      <div>
                        <div className="text-[11px] text-slate-600">
                          <span className="text-slate-400">Nama : </span>
                          <span className="font-bold text-slate-900">{selectedCustomer.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono">
                          <span className="text-slate-400">No. WA : </span>
                          <span className="font-semibold">{selectedCustomer.phone}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          <span className="text-slate-400">Sejak : </span>
                          <span>{selectedCustomer.createdAt}</span>
                        </div>
                        <div className="text-[11px] pt-1">
                          <span className="text-slate-400">Status : </span>
                          <span className="text-sm font-black text-blue-700 tracking-wider">
                            {selectedCustomerCategory?.name || 'GROSIR'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-slate-400 text-center text-xs flex flex-col items-center justify-center gap-1">
                        <span className="font-medium text-slate-500">Pelanggan Umum</span>
                        <span className="text-[10px] text-slate-400">Belum ada data customer dipilih</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {selectedCustomer && onOpenEditCustomerModal && (
                      <button
                        type="button"
                        id="btn-edit-pelanggan-pos"
                        onClick={() => onOpenEditCustomerModal(selectedCustomer)}
                        className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-[10px] font-bold tracking-wider uppercase rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-blue-600" />
                        EDIT DATA CUSTOMER INI
                      </button>
                    )}
                    <button
                      type="button"
                      id="btn-tambah-pelanggan-baru"
                      onClick={onOpenNewCustomerModal}
                      className="w-full py-1.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-[10px] font-bold tracking-wider uppercase rounded-lg transition-colors shadow-2xs text-center cursor-pointer"
                    >
                      TAMBAH PELANGGAN BARU
                    </button>
                  </div>
                </div>

                {/* Riwayat Transaksi mini list */}
                <div className="border border-slate-200 bg-slate-50/60 rounded-xl p-2.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-700 pb-1 border-b border-slate-200">
                      Riwayat Transaksi:
                    </div>
                    <div className="mt-1 space-y-1 max-h-24 overflow-y-auto text-[10px] font-mono">
                      {customerHistory.length > 0 ? (
                        customerHistory.slice(0, 3).map((tx) => (
                          <div key={tx.id} className="text-slate-600 border-b border-slate-100 pb-1">
                            <div className="truncate font-semibold text-slate-800">
                              {tx.items[0]?.dimensions} {tx.items[0]?.name}
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>{tx.date}</span>
                              <span className="font-bold text-blue-700">{formatRupiah(tx.total)}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-4 text-slate-400 text-center text-xs flex flex-col items-center justify-center gap-1">
                          <span className="text-[11px] text-slate-400">Tidak ada riwayat transaksi</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculations & Keypad Section */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Calculations and Payment Methods (Left column of summary) */}
              <div className="sm:col-span-7 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-2.5">
                <div className="space-y-1.5 text-xs text-slate-700 pb-2 border-b border-slate-200 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total QTY</span>
                    <span className="font-bold text-slate-900">{totalQty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sub Total</span>
                    <span className="font-bold text-slate-900">{formatRupiah(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax</span>
                    <span className="text-slate-600">{tax}</span>
                  </div>
                  <div className={`flex justify-between font-semibold ${discountVal < 0 ? 'text-amber-800' : 'text-red-600'}`}>
                    <span>Diskon</span>
                    <span className="flex items-center gap-1">
                      {discountVal < 0 ? (
                        <>
                          <span>+ {formatRupiah(Math.abs(discountVal))}</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                            (Pembulatan)
                          </span>
                        </>
                      ) : discountVal > 0 ? (
                        `-${formatRupiah(discountVal)}`
                      ) : (
                        formatRupiah(0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total</span>
                    <span className="text-blue-900">{formatRupiah(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>Kembalian</span>
                    <span>{formatRupiah(change)}</span>
                  </div>
                </div>

                {/* Metode Pembayaran Input Breakdown */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Metode Pembayaran:
                  </div>

                  {/* Cash [C] */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                        C
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cashAmount}
                        onFocus={() => setFocusedKeypadTarget('cash')}
                        onChange={(e) => setCashAmount(formatNumberInput(e.target.value) || '0')}
                        className={`w-full bg-slate-50 border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 transition-all ${
                          focusedKeypadTarget === 'cash'
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white'
                            : 'border-slate-300'
                        }`}
                      />
                    </div>

                    {/* Quick Nominal Presets for Mobile/Smartphone */}
                    <div className="flex flex-wrap gap-1 pl-7 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCashAmount(formatNumber(grandTotal));
                          setTransferAmount('0');
                          setQrisAmount('0');
                          setFocusedKeypadTarget('cash');
                        }}
                        className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-200 cursor-pointer"
                      >
                        Uang Pas
                      </button>
                      {[10000, 20000, 50000, 100000, 200000].map((nominal) => (
                        <button
                          key={nominal}
                          type="button"
                          onClick={() => {
                            setCashAmount(formatNumber(nominal));
                            setTransferAmount('0');
                            setQrisAmount('0');
                            setFocusedKeypadTarget('cash');
                          }}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-mono font-bold rounded border border-slate-200 cursor-pointer"
                        >
                          {nominal / 1000}k
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transfer [T] */}
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                      T
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={transferAmount}
                      onFocus={() => setFocusedKeypadTarget('transfer')}
                      onChange={(e) => setTransferAmount(formatNumberInput(e.target.value) || '0')}
                      className={`w-full bg-slate-50 border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 transition-all ${
                        focusedKeypadTarget === 'transfer'
                          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                </div>

                {/* Big Orange Action Button: BAYAR > */}
                <button
                  type="button"
                  id="btn-pos-bayar"
                  onClick={handleProcessPayment}
                  className="w-full py-3.5 bg-[#ff4a1c] hover:bg-[#e03b10] active:scale-[0.99] text-white text-base font-black tracking-wider uppercase rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  BAYAR &gt;
                </button>
              </div>

              {/* Virtual Numeric Keypad (Right column of summary) */}
              <div className="sm:col-span-5 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
                <div className="grid grid-cols-3 gap-1.5 text-center font-bold text-slate-800">
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3', '+/-', '0', '00'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeypadPress(key)}
                      className="py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-sm sm:text-base font-bold text-slate-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      {key}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('DEL')}
                    className="py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Delete className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('C')}
                    className="py-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Clear (C)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Floating Sticky Cart Summary Bar for Smartphones */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-14 left-2 right-2 z-30 bg-[#1e295d] text-white p-3 rounded-2xl shadow-2xl md:hidden flex items-center justify-between border border-blue-400/30">
          <div>
            <div className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">
              {totalQty} Item di Keranjang
            </div>
            <div className="text-base font-black font-mono text-white">
              {formatRupiah(grandTotal)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('btn-pos-bayar');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2 bg-[#ff4a1c] hover:bg-[#e03b10] text-white font-black text-xs tracking-wider uppercase rounded-xl shadow-md flex items-center gap-1 active:scale-95 cursor-pointer"
          >
            <span>Proses Bayar</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal Tarik SPK Cetak Digital & Open Account ke Keranjang POS */}
      <SpkPickerModal
        isOpen={isSpkPickerOpen}
        initialTab={spkPickerInitialTab}
        onClose={() => setIsSpkPickerOpen(false)}
        onSelectSpk={(spkOrder) => {
          handleLoadSpkToCart(spkOrder);
        }}
        onSelectBatchSpk={(orders) => {
          handleLoadBatchSpkToCart(orders);
        }}
        onSelectOpenAccountGroup={(group) => {
          handleLoadOpenAccountToCart(group);
        }}
        existingSpkIds={existingSpkIds}
        hasOpenAccountInCart={cartItems.some((it) => it.isOpenAccount)}
      />

      {/* Modal Notifikasi Penolakan Gabung Transaksi Open Account */}
      {blockingErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full border-2 border-amber-400 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Ketentuan Transaksi</h3>
                <p className="text-xs text-slate-500">Sistem Kasir & Open Account</p>
              </div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200 text-xs font-bold text-slate-900 leading-relaxed">
              {blockingErrorModal}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setBlockingErrorModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
