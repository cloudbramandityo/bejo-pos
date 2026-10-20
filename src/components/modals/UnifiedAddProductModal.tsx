/**
 * Unified Add Product Modal for Bejo Stiker POS System
 * Single-entry point for Adding Materials, Digital Printing, Laser Cutting, Supplies & Paket
 * Coded by Langgo Bramandityo.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Layers,
  Printer,
  Scissors,
  Package,
  Plus,
  Check,
  Search,
  Sparkles,
  ShoppingBag,
  RotateCcw,
  Tag,
  AlertCircle
} from 'lucide-react';
import { Product, CartItem, Customer, CustomerCategory, ProductCategoryItem } from '../../types';
import {
  formatRupiah,
  getMaterialPrice,
  getPrintServicePrice,
  getProductionSuppliesPrice,
  getPaketPrice,
  getProductPriceForCategory,
  formatNumberInput,
  parseNumber,
  parseDecimal
} from '../../utils/formatters';
import { formatStockDisplay } from '../../utils/stockUtils';
import {
  isMaterialOrVinylProduct,
  isBahanProduct,
  isStikerVinylProduct,
  isProductionSuppliesProduct,
  isPrintOrLaserProduct,
  isDigitalPrintingProduct,
  isLaserCuttingProduct,
  isPaketProduct
} from '../../utils/productFilters';

export type UnifiedTabType = 'all' | 'bahan' | 'digital_print' | 'laser_cutting' | 'supplies' | 'paket';

interface UnifiedAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart: (item: CartItem) => void;
  selectedCustomer?: Customer | null;
  categories?: CustomerCategory[];
  productCategories?: ProductCategoryItem[];
  initialTab?: UnifiedTabType;
  onNavigateToSpkCreate?: () => void;
}

export const UnifiedAddProductModal: React.FC<UnifiedAddProductModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddToCart,
  selectedCustomer,
  categories = [],
  productCategories = [],
  initialTab = 'all',
  onNavigateToSpkCreate
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<UnifiedTabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Sale Mode: meter, roll, lembar, supplies (eceran/pak), paket
  const [saleMode, setSaleMode] = useState<'meter' | 'roll' | 'lembar' | 'supplies' | 'paket'>('meter');
  const [suppliesUnit, setSuppliesUnit] = useState<'eceran' | 'pak'>('eceran');

  // Dimension & Parameter inputs
  const [lengthInMeters, setLengthInMeters] = useState<string | number>(1);
  const [widthInMeters, setWidthInMeters] = useState<string | number>(1);
  const [quantity, setQuantity] = useState(1);
  const [customDimension, setCustomDimension] = useState('');
  const [finishing, setFinishing] = useState('Standar (Potong Rapih)');
  const [customNotes, setCustomNotes] = useState('');

  // Manual Price Overrides
  const [customPrice, setCustomPrice] = useState<string>('');

  // Toast feedback state inside modal
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync initial tab when modal opens or initialTab prop changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setToastMessage(null);
      setCustomPrice('');
      setSearchQuery('');
    }
  }, [isOpen, initialTab]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Filter products based on active tab and search query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.dimensions && p.dimensions.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeTab === 'bahan') {
        return isMaterialOrVinylProduct(p, productCategories);
      }
      if (activeTab === 'digital_print') {
        return isDigitalPrintingProduct(p, productCategories);
      }
      if (activeTab === 'laser_cutting') {
        return isLaserCuttingProduct(p, productCategories);
      }
      if (activeTab === 'supplies') {
        return isProductionSuppliesProduct(p, productCategories);
      }
      if (activeTab === 'paket') {
        return isPaketProduct(p, productCategories);
      }

      return true; // 'all'
    });
  }, [products, productCategories, activeTab, searchQuery]);

  // Auto select first product when filtered list changes or modal opens
  useEffect(() => {
    if (filteredProducts.length > 0) {
      const stillValid = selectedProduct && filteredProducts.some((p) => p.id === selectedProduct.id);
      if (!stillValid) {
        handleSelectProduct(filteredProducts[0]);
      }
    } else {
      setSelectedProduct(null);
    }
  }, [filteredProducts, isOpen]);

  // Handler when a product is clicked from list
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setCustomPrice('');

    const isSupplies = isProductionSuppliesProduct(product, productCategories);
    const isDigitalPrint = isDigitalPrintingProduct(product, productCategories);
    const isLaser = isLaserCuttingProduct(product, productCategories);
    const isPaket = isPaketProduct(product, productCategories);

    if (isSupplies) {
      setSaleMode('supplies');
      setSuppliesUnit('eceran');
      setCustomDimension('-');
    } else if (isPaket) {
      setSaleMode('paket');
      setCustomDimension(product.dimensions || '-');
    } else if (isDigitalPrint) {
      const mode = product.printSaleMode || (product.unit === 'lembar' ? 'lembar' : 'meter');
      setSaleMode(mode === 'lembar' ? 'lembar' : 'meter');
      setCustomDimension(mode === 'lembar' ? 'A3+' : (product.dimensions || '1.52x50'));
    } else if (isLaser) {
      setSaleMode('meter');
      setCustomDimension(product.dimensions || '45x15');
    } else {
      // Default Bahan / Vinyl
      if (product.unit === 'roll' || product.category === 'vinyl_roll') {
        setSaleMode('roll');
        setCustomDimension(product.dimensions || 'Roll');
      } else {
        setSaleMode('meter');
        setCustomDimension(product.dimensions || '45x15');
      }
    }

    // Auto extract width from product dimensions if available
    if (product.dimensions) {
      const match = product.dimensions.match(/(\d+(\.\d+)?)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (val > 10) {
          setWidthInMeters(parseFloat((val / 100).toFixed(2)));
        } else if (val > 0) {
          setWidthInMeters(val);
        }
      }
    }
  };

  if (!isOpen) return null;

  const custCatName = selectedCustomer
    ? categories.find((c) => c.id === selectedCustomer.categoryId)?.name || 'GROSIR'
    : 'UMUM';

  // Determine standard unit price based on product category & sale mode
  const getStandardPrice = (): number => {
    if (!selectedProduct) return 0;

    const isSupplies = isProductionSuppliesProduct(selectedProduct, productCategories);
    const isPrintOrLaser = isPrintOrLaserProduct(selectedProduct, productCategories);
    const isPaket = isPaketProduct(selectedProduct, productCategories);

    if (isSupplies || saleMode === 'supplies') {
      return getProductionSuppliesPrice(selectedProduct, custCatName, suppliesUnit);
    }
    if (isPaket || saleMode === 'paket') {
      return getPaketPrice(selectedProduct, custCatName);
    }
    if (isPrintOrLaser) {
      return getPrintServicePrice(selectedProduct, custCatName, saleMode === 'lembar' ? 'lembar' : 'meter');
    }
    // Default Material
    return getMaterialPrice(selectedProduct, custCatName, saleMode === 'roll' ? 'roll' : 'meter');
  };

  const standardUnitPrice = getStandardPrice();
  const numCustomPrice = parseNumber(customPrice);
  const isCustomPriceActive = customPrice !== '' && numCustomPrice > 0;
  const activeUnitPrice = isCustomPriceActive ? numCustomPrice : standardUnitPrice;

  const numLength = parseDecimal(lengthInMeters);
  const numWidth = parseDecimal(widthInMeters);
  const totalSquareMeters = numLength * numWidth;

  const calculatedTotal =
    saleMode === 'meter'
      ? Math.round(totalSquareMeters * quantity * activeUnitPrice)
      : Math.round(quantity * activeUnitPrice);

  // Helper to construct CartItem
  const buildCartItem = (): CartItem | null => {
    if (!selectedProduct) return null;

    let dimensionsLabel = customDimension || selectedProduct.dimensions || '-';
    let formattedSpec = '';
    let unitLabel = '';

    if (saleMode === 'meter') {
      dimensionsLabel = customDimension || `${numWidth}x${numLength}m`;
      formattedSpec = `${lengthInMeters} x ${widthInMeters} x ${quantity}`;
      unitLabel = `${lengthInMeters} x ${widthInMeters} x ${quantity}`;
    } else if (saleMode === 'roll') {
      formattedSpec = `${quantity} Roll`;
      unitLabel = `${quantity} Roll`;
    } else if (saleMode === 'lembar') {
      dimensionsLabel = customDimension || 'A3+';
      formattedSpec = `${quantity} Lembar`;
      unitLabel = `${quantity} Lembar`;
    } else if (saleMode === 'supplies') {
      const uName = suppliesUnit === 'pak' ? 'Pak' : selectedProduct.unit || 'Pcs';
      formattedSpec = `${quantity} ${uName}`;
      unitLabel = `${quantity} ${uName}`;
    } else if (saleMode === 'paket') {
      formattedSpec = `${quantity} Paket`;
      unitLabel = `${quantity} Paket`;
    }

    const isPrintOrLaser = isPrintOrLaserProduct(selectedProduct, productCategories);
    const finalNotes = isPrintOrLaser && finishing
      ? customNotes ? `${finishing} - ${customNotes}` : finishing
      : customNotes;

    return {
      id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      productId: selectedProduct.id,
      code: selectedProduct.code,
      name: selectedProduct.name,
      dimensions: dimensionsLabel,
      qty: saleMode === 'meter' ? parseFloat((totalSquareMeters * quantity).toFixed(4)) : quantity,
      unit: unitLabel,
      unitPrice: activeUnitPrice,
      totalPrice: calculatedTotal,
      category: selectedProduct.category,
      notes: finalNotes,
      saleType: saleMode === 'supplies' ? 'supplies' : saleMode,
      lengthMeters: saleMode === 'meter' ? numLength : undefined,
      widthMeters: saleMode === 'meter' ? numWidth : undefined,
      itemCount: quantity,
      formattedSpec: formattedSpec
    };
  };

  const handleAddToCartAndClose = () => {
    const item = buildCartItem();
    if (item) {
      onAddToCart(item);
      onClose();
    }
  };

  const handleAddToCartAndNext = () => {
    const item = buildCartItem();
    if (item) {
      onAddToCart(item);
      setToastMessage(`✓ "${item.name}" berhasil masuk keranjang!`);
      
      // Reset temporary fields while keeping modal open
      setCustomNotes('');
      setCustomPrice('');
      setQuantity(1);

      // Timeout for toast
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);

      // Refocus search box
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 100);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        id="modal-tambah-produk-terpadu"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-xl border border-slate-700">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white uppercase">
                  TAMBAH PEMBELIAN BAHAN & CETAK
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] px-2 py-0.5 rounded-md font-bold">
                  {filteredProducts.length} Produk
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Satu layar untuk memilih Bahan Stiker, Jasa Cetak, Laser Cutting, dan Production Supplies.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer & Price Tier Banner */}
        <div className="bg-slate-100 px-5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Pelanggan:</span>
            <span className="font-bold text-slate-900">
              {selectedCustomer ? selectedCustomer.name : 'Pelanggan Umum'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Tarif Aktif:</span>
            <span
              className={`px-2.5 py-0.5 rounded font-bold text-[11px] ${
                custCatName.includes('GROSIR')
                  ? 'bg-blue-600 text-white'
                  : custCatName.includes('AGEN')
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-white'
              }`}
            >
              HARGA {custCatName}
            </span>
          </div>
        </div>

        {/* Toast Feedback Alert inside Modal */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-5 py-2 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-1 duration-150 shrink-0">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-200" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-100 hover:text-white underline text-[11px] cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Filter Category Chips Bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bahan')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'bahan'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Bahan & Stiker</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('digital_print')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'digital_print'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Digital Print</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paket')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'paket'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span>Paket Cetak</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('supplies')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'supplies'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>Supplies</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('laser_cutting')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'laser_cutting'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-rose-400" />
            <span>Laser Cutting</span>
          </button>
        </div>

        {/* Modal Main Content: Two Columns */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
          
          {/* ================= LEFT COLUMN: SEARCH & PRODUCT LIST ================= */}
          <div className="md:col-span-5 border-r border-slate-200 p-3.5 flex flex-col gap-3 bg-slate-50/50 overflow-hidden">
            {/* Instant Search Bar */}
            <div className="relative shrink-0">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode atau nama produk..."
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 shadow-2xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scrollable Product Items List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const isSelected = selectedProduct?.id === product.id;
                  const isZeroStock = (product.stock ?? 0) <= 0;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSelectProduct(product)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? isZeroStock
                            ? 'bg-red-950 text-white border-red-600 shadow-sm'
                            : 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : isZeroStock
                          ? 'bg-red-50/90 hover:bg-red-100/90 text-red-950 border-red-200'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              isSelected
                                ? isZeroStock
                                  ? 'bg-red-900 text-red-200 border border-red-700'
                                  : 'bg-slate-800 text-slate-200 border border-slate-700'
                                : isZeroStock
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {product.code}
                          </span>
                          <span
                            className={`text-[10px] font-bold truncate ${
                              isSelected
                                ? isZeroStock ? 'text-red-300' : 'text-emerald-300'
                                : isZeroStock ? 'text-red-700' : 'text-slate-500'
                            }`}
                          >
                            {product.dimensions || '-'}
                          </span>
                        </div>
                        <div
                          className={`font-bold text-xs sm:text-sm mt-0.5 truncate ${
                            isSelected
                              ? 'text-white'
                              : isZeroStock
                              ? 'text-red-950'
                              : 'text-slate-900'
                          }`}
                        >
                          {product.name}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-xs font-bold font-mono ${
                            isSelected
                              ? isZeroStock ? 'text-red-200' : 'text-emerald-300'
                              : isZeroStock ? 'text-red-800' : 'text-slate-900'
                          }`}
                        >
                          {formatRupiah(getProductPriceForCategory(product, custCatName, false))}
                        </div>
                        <div
                          className={`text-[10px] font-mono mt-0.5 ${
                            isSelected
                              ? isZeroStock ? 'text-red-300 font-bold' : 'text-slate-300'
                              : isZeroStock
                              ? 'text-red-700 font-bold bg-red-100 px-1.5 py-0.5 rounded border border-red-200'
                              : 'text-slate-500'
                          }`}
                        >
                          {isZeroStock ? 'Stok: 0 (HABIS)' : `Stok: ${formatStockDisplay(product.stock, product.unit)}`}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-center p-4">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs font-bold text-slate-600">Tidak ada produk ditemukan</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Coba kata kunci lain atau pilih tab kategori berbeda.</p>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: ADAPTIVE PARAMETERS & CALCULATOR ================= */}
          <div className="md:col-span-7 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto bg-white space-y-4">
            {selectedProduct ? (
              <div className="space-y-4">
                {/* Active Selected Product Summary Box */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                        {selectedProduct.code}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        {selectedProduct.unit ? `Satuan: ${selectedProduct.unit}` : 'Bahan'}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{selectedProduct.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      Ukuran Baku: {selectedProduct.dimensions || '-'} | Stok Saat Ini: {formatStockDisplay(selectedProduct.stock, selectedProduct.unit)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Harga Dasar</span>
                    <span className="text-sm font-extrabold font-mono text-slate-900">
                      {formatRupiah(standardUnitPrice)}
                    </span>
                  </div>
                </div>

                {/* Dynamic Sale Mode Tabs */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Mode Penjualan:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {/* Meteran Option */}
                    <button
                      type="button"
                      onClick={() => setSaleMode('meter')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        saleMode === 'meter'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Meteran (P x L)
                    </button>

                    {/* Roll Option */}
                    <button
                      type="button"
                      onClick={() => setSaleMode('roll')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        saleMode === 'roll'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Roll Utuh
                    </button>

                    {/* Lembar Option */}
                    <button
                      type="button"
                      onClick={() => setSaleMode('lembar')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        saleMode === 'lembar'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Lembaran (A3+)
                    </button>

                    {/* Supplies Option */}
                    <button
                      type="button"
                      onClick={() => setSaleMode('supplies')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        saleMode === 'supplies'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Eceran / Pak
                    </button>
                  </div>
                </div>

                {/* Adaptive Parameter Input Fields */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  {/* Meteran Inputs (Panjang x Lebar) */}
                  {saleMode === 'meter' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Panjang (Meter):
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={lengthInMeters}
                          onChange={(e) => setLengthInMeters(e.target.value)}
                          placeholder="contoh: 1,7 atau 1.7"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Lebar (Meter):
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={widthInMeters}
                          onChange={(e) => setWidthInMeters(e.target.value)}
                          placeholder="contoh: 0,3 atau 0.3"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {/* Supplies Unit Switcher */}
                  {saleMode === 'supplies' && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-700">Satuan Pembelian:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSuppliesUnit('eceran')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            suppliesUnit === 'eceran'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          Eceran ({selectedProduct.unit || 'Pcs'})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuppliesUnit('pak')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            suppliesUnit === 'pak'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          Pak / Dus
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quantity & Label Dimension Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Jumlah (Qty):
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Label Dimensi Struk:
                      </label>
                      <input
                        type="text"
                        value={customDimension}
                        onChange={(e) => setCustomDimension(e.target.value)}
                        placeholder="misal: 45x15 atau A3+"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  {/* Opsi Finishing for Print / Laser Products */}
                  {(isPrintOrLaserProduct(selectedProduct, productCategories) || activeTab === 'digital_print' || activeTab === 'laser_cutting') && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Opsi Finishing / Pemotongan:
                      </label>
                      <select
                        value={finishing}
                        onChange={(e) => setFinishing(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
                      >
                        <option value="Standar (Potong Rapih)">Standar (Potong Rapih)</option>
                        <option value="Kiss Cut (Potong Setengah Putus)">Kiss Cut (Setengah Putus)</option>
                        <option value="Die Cut (Potong Putus)">Die Cut (Potong Putus / Kontur)</option>
                        <option value="Laminasi Glossy + Potong">Laminasi Glossy + Potong</option>
                        <option value="Laminasi Doff + Potong">Laminasi Doff + Potong</option>
                        <option value="Tanpa Finishing (Roll/Lembaran Utuh)">Tanpa Finishing (Utuh)</option>
                      </select>
                    </div>
                  )}

                  {/* Catatan Tambahan */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Catatan Pembelian:
                    </label>
                    <input
                      type="text"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="misal: Bahan laminasi doff, dipotong per 10cm"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>

                  {/* Manual Override Custom Price Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Harga Khusus (Opsional):
                      </label>
                      {customPrice && (
                        <button
                          type="button"
                          onClick={() => setCustomPrice('')}
                          className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          Reset Harga Standar
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="text"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(formatNumberInput(e.target.value) || '')}
                        placeholder={`Standar: ${formatRupiah(standardUnitPrice)}`}
                        className={`w-full bg-white border rounded-xl pl-9 pr-3 py-2 text-xs font-bold font-mono text-slate-900 focus:outline-hidden ${
                          isCustomPriceActive ? 'border-amber-500 ring-1 ring-amber-400' : 'border-slate-300'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Live Total Price Bar */}
                <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                      Total Biaya Item
                    </span>
                    <div className="text-[11px] text-emerald-400 font-mono font-bold mt-0.5">
                      {saleMode === 'meter'
                        ? `${lengthInMeters}m x ${widthInMeters}m (${totalSquareMeters.toFixed(2)} m²) x ${quantity} Qty`
                        : `${quantity} Qty`}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg sm:text-xl font-bold font-mono text-emerald-300">
                      {formatRupiah(calculatedTotal)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center">
                <Layers className="w-10 h-10 mb-2 opacity-30 text-slate-500" />
                <p className="text-xs font-bold text-slate-700">Pilih produk di sebelah kiri</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                  Klik salah satu barang untuk mengatur dimensi, mode penjualan, dan opsi finishing.
                </p>
              </div>
            )}

            {/* Modal Bottom Action Buttons */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleAddToCartAndNext}
                disabled={!selectedProduct}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
                title="Tambahkan item ke keranjang dan lanjutkan memilih produk lain tanpa menutup modal"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>+ Tambah & Input Lagi</span>
              </button>

              <button
                type="button"
                onClick={handleAddToCartAndClose}
                disabled={!selectedProduct}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>+ Masukkan Keranjang</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
