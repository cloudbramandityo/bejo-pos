/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useMemo } from 'react';
import {
  Truck,
  Briefcase,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Package,
  DollarSign,
  Trash2,
  ShoppingCart,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Product, Supplier, Agent, StockTransaction, ProductCategoryItem } from '../types';
import { formatRupiah, formatNumber, formatNumberInput, parseNumber } from '../utils/formatters';
import {
  getProductStockPrice,
  getMaterialStockFormula,
  calculateBorrowReturnStock,
  formatStockDisplay
} from '../utils/stockUtils';
import { isStockEligibleProduct } from '../utils/productFilters';

export interface StockItemRow {
  productId: string;
  productName: string;
  code?: string;
  category: string;
  unit: string;
  unitMode: 'roll_pak' | 'meter_lembar';
  currentStock: number;
  qty: number;
  price: number;
  defaultPrice: number;
  notes?: string;
}

interface StockScreenProps {
  products: Product[];
  suppliers: Supplier[];
  agents: Agent[];
  productCategories?: ProductCategoryItem[];
  onAddStockTransaction: (tx: Omit<StockTransaction, 'id' | 'timestamp' | 'date' | 'time'> & { date?: string }) => void;
  onAddBatchStockTransactions?: (txList: (Omit<StockTransaction, 'id' | 'timestamp' | 'date' | 'time'> & { date?: string })[]) => void;
  onUpdateProductStockAndCost: (productId: string, newStock: number, newCostPrice: number) => void;
  onUpdateBatchProductStockAndCost?: (updates: { productId: string; newStock: number; newCostPrice?: number; newHargaAgen?: number; newHargaMeterGrosir?: number }[]) => void;
}

export const StockScreen: React.FC<StockScreenProps> = ({
  products,
  suppliers,
  agents,
  productCategories = [],
  onAddStockTransaction,
  onAddBatchStockTransactions,
  onUpdateProductStockAndCost,
  onUpdateBatchProductStockAndCost,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pembelian' | 'pengambilan'>('pembelian');

  // Transaction header states
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [transactionDate, setTransactionDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [shippingCostInput, setShippingCostInput] = useState<string>(''); // Ongkos Kirim (Door to Door)
  const [generalNotesInput, setGeneralNotesInput] = useState('');

  // Cart / Multi-Product Item list
  const [cartItems, setCartItems] = useState<StockItemRow[]>([]);

  // Item Builder Inputs
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qtyInput, setQtyInput] = useState<number | ''>('');
  const [priceInput, setPriceInput] = useState<string>('');
  const [itemNotesInput, setItemNotesInput] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Unit mode options
  const [selectedUnitMode, setSelectedUnitMode] = useState<'roll_pak' | 'meter_lembar'>('roll_pak');

  // Manual price change confirmation states
  const [showPriceWarningModal, setShowPriceWarningModal] = useState(false);
  const [pendingPriceValue, setPendingPriceValue] = useState<string>('');
  const [hasConfirmedManualPriceChange, setHasConfirmedManualPriceChange] = useState(false);

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Opsi autofill harga dinamis mengikuti pola multi-tier pricing di Inventory Produk
  const autofillOptions = useMemo(() => {
    if (!selectedProduct) return [];
    const p = selectedProduct;
    const list: {
      label: string;
      price: number;
      unitMode?: 'roll_pak' | 'meter_lembar';
      badge?: string;
    }[] = [];

    const addOpt = (
      label: string,
      price?: number,
      unitMode?: 'roll_pak' | 'meter_lembar',
      badge?: string
    ) => {
      if (price && price > 0) {
        if (!list.some((item) => item.label === label && item.price === price)) {
          list.push({ label, price, unitMode, badge });
        }
      }
    };

    const isSupplies = (p.category || '').toLowerCase().includes('supplies');
    const isPaket = (p.category || '').toLowerCase().includes('paket');

    if (isSupplies) {
      addOpt('Kulak (HPP)', p.costPrice || p.hargaKulak, 'roll_pak', 'HPP');
      addOpt('Harga Agen', p.hargaAgen, 'roll_pak', 'Agen');
      addOpt('Pak Grosir', p.hargaPakGrosir, 'roll_pak', 'Pak Grosir');
      addOpt('Pak Umum', p.hargaPakUmum, 'roll_pak', 'Pak Umum');
      addOpt('Eceran Grosir', p.hargaEceranGrosir, 'meter_lembar', 'Ecer Grosir');
      addOpt('Eceran Umum', p.hargaEceranUmum, 'meter_lembar', 'Ecer Umum');
    } else if (isPaket) {
      addOpt('Kulak (HPP)', p.costPrice || p.hargaKulak, 'roll_pak', 'HPP');
      addOpt('Harga Agen', p.hargaAgen, 'roll_pak', 'Agen');
      addOpt('Paket Grosir', p.hargaPaketGrosir, 'roll_pak', 'Grosir');
      addOpt('Paket Umum', p.hargaPaketUmum, 'roll_pak', 'Umum');
    } else {
      // Standar (Bahan, Stiker Vinyl, Digital Printing, Laser Cutting, Kategori Kustom)
      addOpt('Kulak (HPP)', p.costPrice || p.hargaKulak, 'roll_pak', 'HPP');
      addOpt('Harga Agen', p.hargaAgen, 'roll_pak', 'Agen');
      addOpt('Meter Grosir', p.hargaMeterGrosir, 'meter_lembar', 'Mtr Grosir');
      addOpt('Meter Umum', p.hargaMeterUmum, 'meter_lembar', 'Mtr Umum');
      addOpt('Harga Grosir', p.hargaGrosir, 'roll_pak', 'Grosir');
      addOpt('Harga Umum', p.hargaUmum || p.price, 'roll_pak', 'Retail');
    }

    return list;
  }, [selectedProduct]);

  // Filtered products for search autocomplete (Only Bahan, Stiker Vinyl, Production Supplies are eligible)
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return [];
    const q = productSearchQuery.toLowerCase();
    return products
      .filter((p) => isStockEligibleProduct(p, productCategories))
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, productSearchQuery, productCategories]);

  // Handle selecting a product from dropdown
  const handleSelectProduct = (product: Product) => {
    if (!isStockEligibleProduct(product, productCategories)) {
      setErrorMessage('Hanya produk kategori Bahan, Stiker Vinyl, atau Production Supplies yang bisa dipakai untuk Pembelian / Pengambilan Bahan.');
      return;
    }
    setSelectedProduct(product);
    setProductSearchQuery(product.name);
    setShowProductDropdown(false);
    setSelectedUnitMode('roll_pak');
    setHasConfirmedManualPriceChange(false);

    // Get default price based on transaction type and roll_pak mode
    const defaultPrice = getProductStockPrice(
      product,
      activeSubTab === 'pembelian' ? 'PEMBELIAN' : 'PENGAMBILAN',
      'roll_pak'
    );
    setPriceInput(defaultPrice > 0 ? formatNumber(defaultPrice) : '0');

    if (!qtyInput) {
      setQtyInput(1);
    }
  };

  // Change selected unit mode (roll/pak vs meter/lembar) and set corresponding price
  const handleUnitModeChange = (mode: 'roll_pak' | 'meter_lembar') => {
    setSelectedUnitMode(mode);
    setHasConfirmedManualPriceChange(false);
    if (selectedProduct) {
      const defaultPrice = getProductStockPrice(
        selectedProduct,
        activeSubTab === 'pembelian' ? 'PEMBELIAN' : 'PENGAMBILAN',
        mode
      );
      setPriceInput(defaultPrice > 0 ? formatNumber(defaultPrice) : '0');
    }
  };

  // Handle selecting an autofill option
  const handleSelectAutofill = (opt: {
    label: string;
    price: number;
    unitMode?: 'roll_pak' | 'meter_lembar';
  }) => {
    setPriceInput(formatNumber(opt.price));
    if (opt.unitMode) {
      setSelectedUnitMode(opt.unitMode);
    }
    setHasConfirmedManualPriceChange(true);
  };

  // Reset or switch tabs
  const handleTabChange = (tab: 'pembelian' | 'pengambilan') => {
    setActiveSubTab(tab);
    setSelectedSupplierName('');
    setProductSearchQuery('');
    setSelectedProduct(null);
    setQtyInput('');
    setPriceInput('');
    setItemNotesInput('');
    setShippingCostInput('');
    setGeneralNotesInput('');
    setCartItems([]);
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setSuccessMessage(null);
    setErrorMessage(null);
    setSelectedUnitMode('roll_pak');
    setHasConfirmedManualPriceChange(false);
  };

  // Handle manual price editing with real-time format xx.xxx.xxx
  const handlePriceInputChange = (rawVal: string) => {
    const formatted = formatNumberInput(rawVal);
    setPriceInput(formatted);
    setHasConfirmedManualPriceChange(true);
  };

  const handleConfirmPriceChange = () => {
    setPriceInput(pendingPriceValue);
    setHasConfirmedManualPriceChange(true);
    setShowPriceWarningModal(false);
  };

  const handleCancelPriceChange = () => {
    setShowPriceWarningModal(false);
  };

  // Add product to transaction list
  const handleAddItemToCart = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProduct) {
      setErrorMessage('Silakan cari dan pilih produk terlebih dahulu.');
      return;
    }

    if (!isStockEligibleProduct(selectedProduct, productCategories)) {
      setErrorMessage('Hanya produk kategori Bahan, Stiker Vinyl, atau Production Supplies yang bisa dimasukkan ke Pembelian / Pengambilan Bahan.');
      return;
    }

    if (!qtyInput || Number(qtyInput) <= 0) {
      setErrorMessage('Jumlah produk harus lebih dari 0.');
      return;
    }

    const numericPrice = parseNumber(priceInput);
    if (priceInput.trim() === '' || numericPrice < 0) {
      setErrorMessage('Harga satuan produk tidak boleh kosong atau negatif.');
      return;
    }

    const qty = Number(qtyInput);
    const price = numericPrice;
    const defaultPrice = getProductStockPrice(
      selectedProduct,
      activeSubTab === 'pembelian' ? 'PEMBELIAN' : 'PENGAMBILAN',
      selectedUnitMode
    );

    const formula = getMaterialStockFormula(selectedProduct);
    const rowUnit = selectedUnitMode === 'roll_pak'
      ? formula.unit
      : formula.subUnit;

    // Check if product is already in cart
    const existingIndex = cartItems.findIndex((item) => item.productId === selectedProduct.id && item.unitMode === selectedUnitMode);

    if (existingIndex >= 0) {
      // Update existing item in cart of the same unit mode
      setCartItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? {
                ...item,
                qty: item.qty + qty,
                price: price, // latest price
                notes: itemNotesInput.trim() || item.notes
              }
            : item
        )
      );
    } else {
      // Add new row
      const newRow: StockItemRow = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        code: selectedProduct.code,
        category: selectedProduct.category,
        unit: rowUnit,
        unitMode: selectedUnitMode,
        currentStock: selectedProduct.stock || 0,
        qty: qty,
        price: price,
        defaultPrice: defaultPrice,
        notes: itemNotesInput.trim() || undefined
      };
      setCartItems((prev) => [...prev, newRow]);
    }

    // Reset item builder inputs for next product
    setSelectedProduct(null);
    setProductSearchQuery('');
    setQtyInput('');
    setPriceInput('');
    setItemNotesInput('');
  };

  // Remove item from cart
  const handleRemoveCartItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Update item quantity in cart
  const handleUpdateCartItemQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, qty: newQty } : item
      )
    );
  };

  // Update item price in cart
  const handleUpdateCartItemPrice = (productId: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, price: newPrice } : item
      )
    );
  };

  // Totals calculation
  const totalKindsOfProducts = cartItems.length;
  const totalUnits = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const itemsSubtotalValue = cartItems.reduce((acc, item) => acc + item.qty * item.price, 0);
  const parsedShippingCost = activeSubTab === 'pembelian' ? parseNumber(shippingCostInput) : 0;
  const grandTotalValue = itemsSubtotalValue + parsedShippingCost;

  // Final Submit of entire transaction batch
  const handleConfirmTransaction = () => {
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!selectedSupplierName.trim()) {
      setErrorMessage(
        activeSubTab === 'pembelian'
          ? 'Silakan pilih Nama Supplier sebelum memproses transaksi.'
          : 'Silakan pilih Nama Agen sebelum memproses transaksi.'
      );
      return;
    }

    if (cartItems.length === 0) {
      setErrorMessage('Daftar produk masih kosong. Tambahkan minimal satu produk ke daftar.');
      return;
    }

    try {
      const productUpdates: { productId: string; newStock: number; newCostPrice?: number; newHargaMeterGrosir?: number }[] = [];
      const txItems = cartItems.map((item) => ({
        id: item.productId,
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        code: item.code,
        qty: item.qty,
        price: item.price,
        totalPrice: item.qty * item.price,
        unit: item.unit,
        notes: item.notes
      }));

      for (const item of cartItems) {
        // Find product to get latest base values
        const prod = products.find((p) => p.id === item.productId);
        const currentStock = prod ? (prod.stock || 0) : item.currentStock;
        const formula = getMaterialStockFormula(prod);
        const conversionRate = formula.qtyPerRollPak || 1;

        let newStock = currentStock;
        if (activeSubTab === 'pembelian') {
          // Pembelian: if meter/lembar, convert to primary unit
          const addPrimary = item.unitMode === 'meter_lembar'
            ? item.qty / conversionRate
            : item.qty;
          newStock = currentStock + addPrimary;
        } else {
          // Pengambilan: applies borrow/return conversion
          const smallQtyDeducted = item.unitMode === 'meter_lembar'
            ? item.qty
            : item.qty * conversionRate;
          const breakdown = calculateBorrowReturnStock(
            currentStock,
            0,
            conversionRate,
            smallQtyDeducted,
            formula.unit,
            formula.subUnit
          );
          newStock = Math.max(0, breakdown.totalInPrimaryUnits);
        }

        const updateObj: {
          productId: string;
          newStock: number;
          newCostPrice?: number;
          newHargaAgen?: number;
          newHargaMeterGrosir?: number;
        } = {
          productId: item.productId,
          newStock: newStock
        };

        if (item.price !== item.defaultPrice) {
          if (activeSubTab === 'pembelian') {
            if (item.unitMode === 'roll_pak') {
              updateObj.newCostPrice = item.price;
            } else {
              updateObj.newHargaMeterGrosir = item.price;
            }
          } else {
            if (item.unitMode === 'roll_pak') {
              updateObj.newHargaAgen = item.price;
            } else {
              updateObj.newHargaMeterGrosir = item.price;
            }
          }
        }

        productUpdates.push(updateObj);
      }

      // Execute product updates
      if (onUpdateBatchProductStockAndCost) {
        onUpdateBatchProductStockAndCost(productUpdates);
      } else {
        productUpdates.forEach((u) => {
          onUpdateProductStockAndCost(u.productId, u.newStock, u.newCostPrice || 0);
        });
      }

      // Execute 1 single stock transaction with all products
      const singleTransaction: Omit<StockTransaction, 'id' | 'timestamp' | 'time'> & { date?: string } = {
        type: activeSubTab === 'pembelian' ? 'PEMBELIAN' : 'PENGAMBILAN',
        supplierName: selectedSupplierName,
        items: txItems,
        totalQty: totalUnits,
        totalAmount: grandTotalValue,
        shippingCost: activeSubTab === 'pembelian' && parsedShippingCost > 0 ? parsedShippingCost : undefined,
        notes: generalNotesInput.trim() || undefined,
        date: transactionDate,
        productId: txItems[0]?.productId,
        productName: txItems[0]?.productName,
        qty: totalUnits,
        price: txItems[0]?.price,
        totalPrice: grandTotalValue
      };

      onAddStockTransaction(singleTransaction);

      // Feedback message
      const formattedDate = new Date(transactionDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const shippingMsg = parsedShippingCost > 0 ? ` (Termasuk Ongkir Door to Door: ${formatRupiah(parsedShippingCost)})` : '';

      setSuccessMessage(
        activeSubTab === 'pembelian'
          ? `Sukses! Berhasil memproses Pembelian ${totalKindsOfProducts} macam produk (${totalUnits} unit • ${formatRupiah(grandTotalValue)}${shippingMsg}) dari supplier "${selectedSupplierName}" pada tanggal ${formattedDate}.`
          : `Sukses! Berhasil memproses Pengambilan ${totalKindsOfProducts} macam produk (${totalUnits} unit • ${formatRupiah(grandTotalValue)}) oleh agen "${selectedSupplierName}" pada tanggal ${formattedDate}.`
      );

      // Reset cart, notes, and shipping cost
      setCartItems([]);
      setShippingCostInput('');
      setGeneralNotesInput('');
      setSelectedProduct(null);
      setProductSearchQuery('');
      setQtyInput('');
      setPriceInput('');
      setItemNotesInput('');
    } catch (err) {
      setErrorMessage('Terjadi kesalahan saat memproses transaksi stok.');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Header Title with Sub Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            Kelola Stok Bahan & Produk
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pilih tanggal, lalu masukkan beberapa produk sekaligus dalam satu catatan stok masuk/keluar.
          </p>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={() => handleTabChange('pembelian')}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'pembelian'
                ? 'bg-white text-[#1e295d] shadow-xs ring-1 ring-slate-200/60'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Pembelian Bahan
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('pengambilan')}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'pengambilan'
                ? 'bg-white text-[#1e295d] shadow-xs ring-1 ring-slate-200/60'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            Pengambilan Bahan
          </button>
        </div>
      </div>

      {/* Visual Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 text-xs font-semibold animate-in zoom-in-95 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-emerald-900">{successMessage}</p>
            <p className="font-normal text-emerald-700">Data stok fisik produk dan log rekap mutasi telah disinkronkan secara real-time.</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs font-semibold animate-in zoom-in-95 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-900">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Header Info & Item Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Setup Informasi Transaksi */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Pengaturan Transaksi
            </div>

            {/* Supplier / Agent Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {activeSubTab === 'pembelian' ? 'Nama Supplier' : 'Nama Agen'}
                <span className="text-rose-500 ml-0.5">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedSupplierName}
                  onChange={(e) => setSelectedSupplierName(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                >
                  <option value="">
                    {activeSubTab === 'pembelian' ? '-- Pilih Supplier --' : '-- Pilih Agen --'}
                  </option>
                  {activeSubTab === 'pembelian'
                    ? suppliers.map((sup) => (
                        <option key={sup.id} value={sup.name}>
                          {sup.name}
                        </option>
                      ))
                    : agents.map((ag) => (
                        <option key={ag.id} value={ag.name}>
                          {ag.name}
                        </option>
                      ))
                  }
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Tanggal Transaksi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tanggal Transaksi <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Seluruh produk dalam daftar di bawah akan dicatat pada tanggal ini.
              </p>
            </div>

            {/* Ongkos Kirim (Door to Door) - Khusus Pembelian Bahan */}
            {activeSubTab === 'pembelian' && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Ongkos Kirim (Door to Door)</span>
                  </label>
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                    Opsional
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={shippingCostInput}
                    onChange={(e) => setShippingCostInput(formatNumberInput(e.target.value))}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold font-mono text-slate-900"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Biaya ekspedisi / pengiriman langsung dari supplier ke alamat toko.
                </p>
              </div>
            )}
          </div>

          {/* Card 2: Builder - Tambah Produk ke Daftar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                <Layers className="w-4 h-4 text-blue-600" />
                Pilih Produk
              </div>
            </div>

            <form onSubmit={handleAddItemToCart} className="space-y-3.5">
              {/* Autocomplete Product Search */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Cari Nama / SKU Produk</span>
                  <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    Bahan • Stiker Vinyl • Supplies
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                      if (!e.target.value) {
                        setSelectedProduct(null);
                      }
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Ketik nama produk atau kode barang (Bahan / Stiker Vinyl / Production Supplies)..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>

                {/* Autocomplete popup */}
                {showProductDropdown && productSearchQuery.trim().length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((p) => {
                        const isZeroStock = (p.stock ?? 0) <= 0;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectProduct(p)}
                            className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                              isZeroStock ? 'bg-red-50 hover:bg-red-100/80' : 'hover:bg-blue-50'
                            }`}
                          >
                            <div>
                              <div className={`font-bold ${isZeroStock ? 'text-red-950 font-extrabold' : 'text-slate-800'}`}>{p.name}</div>
                              <div className={`text-[10px] mt-0.5 ${isZeroStock ? 'text-red-700' : 'text-slate-400'}`}>
                                Kategori: <span className="font-semibold">{p.category}</span> {p.code ? `• SKU: ${p.code}` : ''}
                              </div>
                            </div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                              isZeroStock
                                ? 'text-red-700 bg-red-100 border-red-200'
                                : 'text-blue-700 bg-blue-50 border-blue-100'
                            }`}>
                              {isZeroStock ? 'Stok: 0 (HABIS)' : `Stok: ${formatStockDisplay(p.stock, p)}`}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-3.5 text-center text-xs text-slate-400">
                        Produk tidak ada di kategori <span className="font-semibold text-slate-600">Bahan</span>, <span className="font-semibold text-slate-600">Stiker Vinyl</span>, atau <span className="font-semibold text-slate-600">Production Supplies</span>.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Product Banner */}
              {selectedProduct && (() => {
                const formula = getMaterialStockFormula(selectedProduct);
                const isRollOrPakMode = selectedUnitMode === 'roll_pak';
                const numericQty = qtyInput ? Number(qtyInput) : 1;
                const convertedEquiv = isRollOrPakMode
                  ? numericQty * formula.qtyPerRollPak
                  : numericQty / (formula.qtyPerRollPak || 1);

                return (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-950">{selectedProduct.name}</span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                        {selectedProduct.category}
                      </span>
                    </div>

                    <div className="bg-white/80 p-1.5 rounded-lg border border-blue-100 flex items-center justify-between text-[10.5px] font-mono">
                      <span className="text-blue-900 font-bold">💡 Rumus: {formula.formulaText}</span>
                      <span className="text-slate-500">Kemasan: {formula.kemasanText}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-blue-800 pt-1 border-t border-blue-100/60">
                      <span>Stok Gudang: <strong>{formatStockDisplay(selectedProduct.stock, selectedProduct)}</strong></span>
                      <span>
                        {activeSubTab === 'pembelian'
                          ? (selectedUnitMode === 'roll_pak' ? 'Kulak (HPP)' : 'Meter Grosir')
                          : (selectedUnitMode === 'roll_pak' ? 'Harga Agen' : 'Harga Meter Grosir')}:{' '}
                        <strong>
                          {formatRupiah(
                            getProductStockPrice(
                              selectedProduct,
                              activeSubTab === 'pembelian' ? 'PEMBELIAN' : 'PENGAMBILAN',
                              selectedUnitMode
                            )
                          )}
                        </strong>
                      </span>
                    </div>

                    {qtyInput !== '' && numericQty > 0 && (
                      <div className="text-[10.5px] text-indigo-700 bg-indigo-50/70 px-2 py-1 rounded-md font-medium">
                        {isRollOrPakMode
                          ? `➡️ Konversi: ${numericQty} ${formula.unit} setara dengan ${convertedEquiv} ${formula.subUnit}`
                          : `➡️ Konversi: ${numericQty} ${formula.subUnit} setara dengan ${convertedEquiv.toFixed(2)} ${formula.unit}`}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Opsi Satuan Transaksi (Roll/Pak vs Meter/Lembar) */}
              {selectedProduct && (() => {
                const prodFormula = getMaterialStockFormula(selectedProduct);
                const primaryLabel = prodFormula.unit ? prodFormula.unit.toUpperCase() : 'ROLL / PAK';
                const subLabel = prodFormula.subUnit ? prodFormula.subUnit.toUpperCase() : 'METER / LEMBAR';

                return (
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Pilihan Satuan & Harga Terkait:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUnitModeChange('roll_pak')}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between h-14 cursor-pointer ${
                          selectedUnitMode === 'roll_pak'
                            ? 'bg-blue-50 border-blue-500 text-blue-950 ring-2 ring-blue-500/20 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-wider font-extrabold flex items-center justify-between">
                          <span>{primaryLabel}</span>
                          {selectedUnitMode === 'roll_pak' && <span className="text-[9px] text-blue-600 font-bold bg-blue-100/70 px-1 py-0.2 rounded">Aktif</span>}
                        </span>
                        <span className="text-slate-500 font-medium text-[10px] mt-0.5 truncate">
                          {activeSubTab === 'pembelian' ? 'Kulak (HPP): ' : 'Harga Agen: '}
                          <strong className="text-slate-900 font-mono font-bold">
                            {formatRupiah(
                              getProductStockPrice(
                                selectedProduct,
                                activeSubTab === 'pembelian' ? 'PEMBELIAN' : 'PENGAMBILAN',
                                'roll_pak'
                              )
                            )}
                          </strong>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUnitModeChange('meter_lembar')}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between h-14 cursor-pointer ${
                          selectedUnitMode === 'meter_lembar'
                            ? 'bg-blue-50 border-blue-500 text-blue-950 ring-2 ring-blue-500/20 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-wider font-extrabold flex items-center justify-between">
                          <span>{subLabel}</span>
                          {selectedUnitMode === 'meter_lembar' && <span className="text-[9px] text-blue-600 font-bold bg-blue-100/70 px-1 py-0.2 rounded">Aktif</span>}
                        </span>
                        <span className="text-slate-500 font-medium text-[10px] mt-0.5 truncate">
                          {activeSubTab === 'pembelian' ? 'Grosir: ' : 'Meter Grosir: '}
                          <strong className="text-slate-900 font-mono font-bold">
                            {formatRupiah(
                              getProductStockPrice(
                                selectedProduct,
                                activeSubTab === 'pembelian' ? 'PEMBELIAN' : 'PENGAMBILAN',
                                'meter_lembar'
                              )
                            )}
                          </strong>
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Qty and Price Input Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jumlah ({selectedProduct ? (selectedUnitMode === 'roll_pak' ? 'roll/pak' : 'meter/lembar') : 'Qty'})
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value ? Number(e.target.value) : '')}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Harga (Rp)
                    </label>
                    {selectedProduct && parseNumber(priceInput) > 0 && parseNumber(priceInput) !== getProductStockPrice(selectedProduct, activeSubTab === 'pembelian' ? 'PEMBELIAN' : 'PENGAMBILAN', selectedUnitMode) && (
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                        Khusus
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={priceInput}
                      onChange={(e) => handlePriceInputChange(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Opsi Autofill Pola Inventory Produk */}
              {selectedProduct && autofillOptions.length > 0 && (
                <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Opsi Autofill Harga (Pola Inventory):
                    </span>
                    <span className="text-[10px] text-slate-400">Pilih opsi / ketik manual</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {autofillOptions.map((opt, idx) => {
                      const currentPriceNum = parseNumber(priceInput);
                      const isSelected =
                        currentPriceNum === opt.price &&
                        (opt.unitMode ? selectedUnitMode === opt.unitMode : true);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectAutofill(opt)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs ring-2 ring-blue-300/40 font-bold'
                              : 'bg-white hover:bg-blue-50 border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-800'
                          }`}
                          title={`Gunakan harga ${opt.label} (${formatRupiah(opt.price)})`}
                        >
                          <span>{opt.label}:</span>
                          <span
                            className={`font-mono font-bold ${
                              isSelected ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {formatNumber(opt.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Item Note (Optional) */}
              <div>
                <input
                  type="text"
                  value={itemNotesInput}
                  onChange={(e) => setItemNotesInput(e.target.value)}
                  placeholder="Keterangan item ini (opsional)..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Add to List Button */}
              <button
                type="submit"
                disabled={!selectedProduct}
                className="w-full py-2.5 bg-[#1e295d] hover:bg-[#151e44] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 text-sky-400" />
                + Tambah Produk ke Daftar
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Transaction Cart / List of Products (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col h-full justify-between">
            <div>
              {/* Header List */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Daftar Produk Transaksi ({cartItems.length} Produk)
                  </h3>
                </div>

                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCartItems([])}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    Kosongkan Semua
                  </button>
                )}
              </div>

              {/* Cart Table / Empty State */}
              <div className="mt-4">
                {cartItems.length === 0 ? (
                  <div className="py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50/50">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Daftar Produk Masih Kosong</p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                        Cari produk di sebelah kiri, atur jumlah dan harga, lalu klik <strong>+ Tambah Produk ke Daftar</strong>. Boleh lebih dari satu produk.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-2">No</th>
                          <th className="py-2.5 px-2">Produk</th>
                          <th className="py-2.5 px-2 text-center">Jumlah</th>
                          <th className="py-2.5 px-2 text-right">Harga</th>
                          <th className="py-2.5 px-2 text-right">Subtotal</th>
                          <th className="py-2.5 px-2 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {cartItems.map((item, index) => {
                          const isPriceModified = item.price !== item.defaultPrice;
                          const prod = products.find((p) => p.id === item.productId);
                          const formula = prod ? getMaterialStockFormula(prod) : null;
                          const conversionRate = formula ? formula.qtyPerRollPak : 1;
                          const availableInSelectedUnit = item.unitMode === 'meter_lembar'
                            ? (item.currentStock || 0) * conversionRate
                            : (item.currentStock || 0);
                          const isExcessPengambilan =
                            activeSubTab === 'pengambilan' && item.qty > availableInSelectedUnit;

                          return (
                            <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-2 font-medium text-slate-400 text-[11px]">
                                {index + 1}
                              </td>
                              <td className="py-3 px-2">
                                <div className="font-bold text-slate-900">{item.productName}</div>
                                <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span>{item.category}</span>
                                  {item.code && <span>• SKU: {item.code}</span>}
                                  <span>• Stok: {formatStockDisplay(item.currentStock, products.find((p) => p.id === item.productId))}</span>
                                  {(() => {
                                    const prod = products.find((p) => p.id === item.productId);
                                    if (!prod) return null;
                                    const formula = getMaterialStockFormula(prod);
                                    return (
                                      <span className="text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded font-semibold text-[9.5px]">
                                        💡 {formula.formulaText}
                                      </span>
                                    );
                                  })()}
                                </div>
                                {item.notes && (
                                  <div className="text-[10px] text-indigo-600 italic mt-0.5">
                                    Catatan: {item.notes}
                                  </div>
                                )}
                                {isExcessPengambilan && (
                                  <div className="text-[10px] font-bold text-rose-600 mt-0.5 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Qty melebihi stok gudang ({item.currentStock})
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCartItemQty(item.productId, item.qty - 1)}
                                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    value={item.qty}
                                    onChange={(e) =>
                                      handleUpdateCartItemQty(
                                        item.productId,
                                        e.target.value ? parseFloat(e.target.value) : 1
                                      )
                                    }
                                    className="w-12 text-center py-0.5 px-1 bg-slate-50 border border-slate-300 rounded font-bold text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCartItemQty(item.productId, item.qty + 1)}
                                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="text-[10px] text-center text-slate-400 mt-0.5 font-medium">
                                  {item.unit}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="font-semibold text-slate-800">
                                  {formatRupiah(item.price)}
                                </div>
                                {isPriceModified && (
                                  <div className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                    {activeSubTab === 'pembelian' ? 'Update HPP' : 'Harga Khusus'}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right font-bold text-slate-900">
                                {formatRupiah(item.qty * item.price)}
                              </td>
                              <td className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCartItem(item.productId)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus dari daftar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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

            {/* Bottom Summary & Confirmation Area */}
            {cartItems.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
                {/* Notes for Entire Transaction */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Catatan Keseluruhan Transaksi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={generalNotesInput}
                    onChange={(e) => setGeneralNotesInput(e.target.value)}
                    placeholder="Contoh: Restok bahan mingguan batch 1, no surat jalan: SJ-091..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Grand Summary Box */}
                <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider">
                      Ringkasan Mutasi ({activeSubTab === 'pembelian' ? 'Pembelian' : 'Pengambilan'})
                    </div>
                    <div className="text-xs text-slate-300 font-medium">
                      <strong>{totalKindsOfProducts}</strong> Macam Produk • Total <strong>{totalUnits}</strong> Unit / Satuan
                    </div>
                    {activeSubTab === 'pembelian' && parsedShippingCost > 0 && (
                      <div className="text-[11px] text-slate-400 flex flex-wrap gap-2 pt-0.5">
                        <span>Subtotal Barang: <strong className="text-slate-200">{formatRupiah(itemsSubtotalValue)}</strong></span>
                        <span>• Ongkir Door to Door: <strong className="text-amber-400">{formatRupiah(parsedShippingCost)}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="text-center sm:text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {activeSubTab === 'pembelian' && parsedShippingCost > 0 ? 'Total Pembelian + Ongkir' : 'Total Nilai Biaya'}
                    </div>
                    <div className="text-lg font-black text-emerald-400">
                      {formatRupiah(grandTotalValue)}
                    </div>
                  </div>
                </div>

                {/* Confirm Process Button */}
                <button
                  type="button"
                  onClick={handleConfirmTransaction}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs shadow-md hover:shadow-lg cursor-pointer text-white flex items-center justify-center gap-2 transition-all ${
                    activeSubTab === 'pembelian'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {activeSubTab === 'pembelian' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>
                    {activeSubTab === 'pembelian' ? 'Proses Pembelian' : 'Proses Pengambilan'} ({totalKindsOfProducts} Produk • {formatRupiah(grandTotalValue)})
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Custom Price Change Warning Modal */}
      {showPriceWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-black text-slate-900">Peringatan Ubah Harga</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  Anda akan mengubah harga dan akan tersave otomatis pada Inventory Produk. Apakah anda ingin melanjutkan?
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancelPriceChange}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmPriceChange}
                className="px-4 py-2 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

