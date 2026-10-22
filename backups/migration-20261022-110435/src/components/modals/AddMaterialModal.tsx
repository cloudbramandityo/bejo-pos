/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useMemo, useEffect } from 'react';
import { X, Layers, Plus, Check, Search, Tag, Sparkles, Package } from 'lucide-react';
import { Product, CartItem, Customer, CustomerCategory, ProductCategoryItem } from '../../types';
import { formatRupiah, getMaterialPrice, getProductionSuppliesPrice, formatNumberInput, parseNumber, parseDecimal } from '../../utils/formatters';
import { formatStockDisplay } from '../../utils/stockUtils';
import { isMaterialOrVinylProduct, isBahanProduct, isStikerVinylProduct, isProductionSuppliesProduct } from '../../utils/productFilters';

interface AddMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart: (item: CartItem) => void;
  selectedCustomer?: Customer | null;
  categories?: CustomerCategory[];
  productCategories?: ProductCategoryItem[];
}

export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddToCart,
  selectedCustomer,
  categories = [],
  productCategories = [],
}) => {
  const [saleType, setSaleType] = useState<'meter' | 'roll' | 'production_supplies'>('meter');
  const [suppliesUnit, setSuppliesUnit] = useState<'eceran' | 'pak'>('eceran');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'all' | 'bahan' | 'stiker_vinyl'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customDimension, setCustomDimension] = useState('45x15');
  
  // Dimensions for (P x L) meter
  const [lengthInMeters, setLengthInMeters] = useState<string | number>(1);
  const [widthInMeters, setWidthInMeters] = useState<string | number>(1);
  const [quantity, setQuantity] = useState(1);
  const [customNotes, setCustomNotes] = useState('');

  // Harga Khusus (Manual Price Overrides)
  const [customPriceMeter, setCustomPriceMeter] = useState<string>('');
  const [customPriceRoll, setCustomPriceRoll] = useState<string>('');
  const [customPriceSupplies, setCustomPriceSupplies] = useState<string>('');

  // Reset custom prices when selected product or sale type or modal open state changes
  useEffect(() => {
    setCustomPriceMeter('');
    setCustomPriceRoll('');
    setCustomPriceSupplies('');
  }, [selectedProduct?.id, saleType, isOpen]);

  // Filter products by sale type
  const activeProducts = useMemo(() => {
    if (saleType === 'production_supplies') {
      const filtered = products.filter((p) => isProductionSuppliesProduct(p, productCategories));
      return filtered;
    }
    const filtered = products.filter((p) => isMaterialOrVinylProduct(p, productCategories));
    return filtered.length > 0 ? filtered : products;
  }, [products, productCategories, saleType]);

  // Auto-select first product when activeProducts changes
  useEffect(() => {
    if (activeProducts.length > 0) {
      const stillValid = selectedProduct && activeProducts.some((p) => p.id === selectedProduct.id);
      if (!stillValid) {
        const initial = activeProducts[0];
        setSelectedProduct(initial);
        setCustomDimension(initial.dimensions || (saleType === 'production_supplies' ? '-' : '45x15'));
        
        if (saleType !== 'production_supplies' && initial.dimensions) {
          const match = initial.dimensions.match(/(\d+(\.\d+)?)/);
          if (match) {
            const val = parseFloat(match[1]);
            if (val > 10) {
              setWidthInMeters(val / 100);
            } else if (val > 0) {
              setWidthInMeters(val);
            }
          }
        }

        if (saleType === 'production_supplies') {
          setQuantity(1);
        } else if (initial.unit === 'roll' || initial.category === 'vinyl_roll') {
          setSaleType('roll');
        }
      }
    } else {
      setSelectedProduct(null);
    }
  }, [activeProducts, isOpen, saleType]);

  if (!isOpen) return null;

  const custCatName = selectedCustomer 
    ? categories.find(c => c.id === selectedCustomer.categoryId)?.name || 'GROSIR'
    : 'UMUM';

  // Filtered materials by search and category chip
  const displayedProducts = activeProducts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.dimensions && p.dimensions.toLowerCase().includes(q));
    
    if (!matchesSearch) return false;
    if (saleType === 'production_supplies') return true;
    if (selectedCategoryFilter === 'all') return true;
    if (selectedCategoryFilter === 'bahan') return isBahanProduct(p, productCategories);
    if (selectedCategoryFilter === 'stiker_vinyl') return isStikerVinylProduct(p, productCategories);
    return true;
  });

  // Parameter calculation:
  // Penjualan per Meter: (P x L) meter X Harga Jual
  // Penjualan per Roll: (jumlah) roll X Harga Jual
  // Production Supplies: (jumlah) pak/eceran X Harga Jual
  const standardUnitPrice = selectedProduct 
    ? (saleType === 'production_supplies'
        ? getProductionSuppliesPrice(selectedProduct, custCatName, suppliesUnit)
        : getMaterialPrice(selectedProduct, custCatName, saleType))
    : 0;

  const numCustomPriceMeter = parseNumber(customPriceMeter);
  const isCustomPriceMeterActive = saleType === 'meter' && customPriceMeter !== '' && numCustomPriceMeter > 0;

  const numCustomPriceRoll = parseNumber(customPriceRoll);
  const isCustomPriceRollActive = saleType === 'roll' && customPriceRoll !== '' && numCustomPriceRoll > 0;

  const numCustomPriceSupplies = parseNumber(customPriceSupplies);
  const isCustomPriceSuppliesActive = saleType === 'production_supplies' && customPriceSupplies !== '' && numCustomPriceSupplies > 0;

  const unitPrice = isCustomPriceMeterActive 
    ? numCustomPriceMeter 
    : isCustomPriceRollActive 
    ? numCustomPriceRoll 
    : isCustomPriceSuppliesActive 
    ? numCustomPriceSupplies 
    : standardUnitPrice;
  
  const numLength = parseDecimal(lengthInMeters);
  const numWidth = parseDecimal(widthInMeters);
  const totalSquareMeters = numLength * numWidth;
  const calculatedTotal = saleType === 'meter'
    ? Math.round(totalSquareMeters * quantity * unitPrice)
    : Math.round(quantity * unitPrice);

  const handleAdd = () => {
    if (!selectedProduct) return;

    let dimensions = customDimension || selectedProduct.dimensions || '-';
    let formattedSpec = '';
    let unitLabel = '';

    if (saleType === 'meter') {
      dimensions = customDimension || selectedProduct.dimensions || `${numWidth}x${numLength}m`;
      formattedSpec = `${lengthInMeters} x ${widthInMeters} x ${quantity}`;
      unitLabel = `${lengthInMeters} x ${widthInMeters} x ${quantity}`;
    } else if (saleType === 'roll') {
      formattedSpec = `${quantity} Roll`;
      unitLabel = `${quantity} Roll`;
    } else {
      // Production supplies
      const unitName = suppliesUnit === 'pak' ? 'Pak' : (selectedProduct.unit || 'Pcs');
      formattedSpec = `${quantity} ${unitName}`;
      unitLabel = `${quantity} ${unitName}`;
    }

    const newItem: CartItem = {
      id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      productId: selectedProduct.id,
      code: selectedProduct.code,
      name: selectedProduct.name,
      dimensions: dimensions,
      qty: saleType === 'meter' ? parseFloat((totalSquareMeters * quantity).toFixed(4)) : quantity,
      unit: unitLabel,
      unitPrice: unitPrice,
      totalPrice: calculatedTotal,
      category: selectedProduct.category,
      notes: customNotes,
      saleType: saleType === 'production_supplies' ? 'supplies' : saleType,
      lengthMeters: saleType === 'meter' ? numLength : undefined,
      widthMeters: saleType === 'meter' ? numWidth : undefined,
      itemCount: quantity,
      formattedSpec: formattedSpec
    };

    onAddToCart(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center sm:items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 max-sm:p-0 max-sm:items-end animate-in fade-in duration-200">
      <div 
        id="modal-tambah-penjualan-bahan"
        className="bg-white rounded-2xl max-sm:rounded-b-none max-sm:rounded-t-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="bg-[#1e295d] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Layers className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">TAMBAH PENJUALAN BAHAN</h2>
                <span className="bg-sky-500/20 text-sky-200 border border-sky-400/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {activeProducts.length} Produk {saleType === 'production_supplies' ? 'Supplies' : 'Bahan'}
                </span>
              </div>
              <p className="text-xs text-blue-200">
                {saleType === 'production_supplies' 
                  ? 'Perlengkapan & Production Supplies' 
                  : 'Stiker Vinyl roll & meteran, Bahan Baku Printing, Production Supplies'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer Price Tier Banner */}
        <div className="bg-blue-50/80 px-6 py-2.5 border-b border-blue-100 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Pelanggan Aktif:</span>
            <span className="font-bold text-slate-900">
              {selectedCustomer ? selectedCustomer.name : 'Pelanggan Umum'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Tarif Harga:</span>
            <span className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
              custCatName.includes('GROSIR') 
                ? 'bg-blue-600 text-white' 
                : custCatName.includes('AGEN') 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-white'
            }`}>
              {custCatName}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Sale Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Jenis Pembelian Bahan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                id="btn-saletype-meter"
                onClick={() => setSaleType('meter')}
                className={`py-2.5 px-3 rounded-xl font-semibold text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                  saleType === 'meter'
                    ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs ring-2 ring-blue-600'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${saleType === 'meter' ? 'bg-blue-600' : 'bg-slate-300'}`}></span>
                  Penjualan per Meter
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">(P x L) meter × Harga</span>
              </button>

              <button
                type="button"
                id="btn-saletype-roll"
                onClick={() => setSaleType('roll')}
                className={`py-2.5 px-3 rounded-xl font-semibold text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                  saleType === 'roll'
                    ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs ring-2 ring-blue-600'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${saleType === 'roll' ? 'bg-blue-600' : 'bg-slate-300'}`}></span>
                  Penjualan per Roll
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">(Jumlah) roll × Harga</span>
              </button>

              <button
                type="button"
                id="btn-saletype-supplies"
                onClick={() => setSaleType('production_supplies')}
                className={`py-2.5 px-3 rounded-xl font-semibold text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                  saleType === 'production_supplies'
                    ? 'bg-purple-50 border-purple-600 text-purple-800 shadow-xs ring-2 ring-purple-600'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-purple-900">
                  <Package className="w-3.5 h-3.5 text-purple-600" />
                  Production Supplies
                </div>
                <span className="text-[10px] text-purple-600 mt-0.5">Kategori Production Supplies</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Pilih Produk {saleType === 'production_supplies' ? 'Production Supplies' : 'Bahan'} ({displayedProducts.length})
              </label>
              {saleType !== 'production_supplies' && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    id="btn-cat-filter-all"
                    onClick={() => setSelectedCategoryFilter('all')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedCategoryFilter === 'all'
                        ? 'bg-[#1e295d] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    id="btn-cat-filter-bahan"
                    onClick={() => setSelectedCategoryFilter('bahan')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedCategoryFilter === 'bahan'
                        ? 'bg-[#1e295d] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Bahan
                  </button>
                  <button
                    type="button"
                    id="btn-cat-filter-stiker-vinyl"
                    onClick={() => setSelectedCategoryFilter('stiker_vinyl')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedCategoryFilter === 'stiker_vinyl'
                        ? 'bg-[#1e295d] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Stiker Vinyl
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={saleType === 'production_supplies' ? "Cari nama atau kode produk production supplies..." : "Cari kode SKU atau nama bahan vinyl..."}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Product Picker Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
              {displayedProducts.length > 0 ? (
                displayedProducts.map((p) => {
                  const isSelected = selectedProduct?.id === p.id;
                  const itemUnitPrice = saleType === 'production_supplies'
                    ? getProductionSuppliesPrice(p, custCatName, suppliesUnit)
                    : getMaterialPrice(p, custCatName, saleType);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(p);
                        if (p.dimensions && saleType !== 'production_supplies') {
                          setCustomDimension(p.dimensions);
                          const match = p.dimensions.match(/(\d+(\.\d+)?)/);
                          if (match) {
                            const val = parseFloat(match[1]);
                            if (val > 10) setWidthInMeters(val / 100);
                            else if (val > 0) setWidthInMeters(val);
                          }
                        }
                      }}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-600'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-800">
                          {p.code}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                      <div className="mt-1 font-bold text-xs text-slate-900 line-clamp-1">
                        {p.name}
                      </div>
                      <div className="mt-1.5 text-[10.5px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1">
                        <span className="truncate max-w-[130px]" title={p.dimensions ? `Dim: ${p.dimensions}` : (p.unit || 'Pcs')}>
                          {p.dimensions ? `Dim: ${p.dimensions}` : (p.unit || 'Pcs')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          Stok: {formatStockDisplay(p.stock, p)}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-right">
                        <span className="font-bold text-blue-700 font-mono">
                          {formatRupiah(itemUnitPrice)}/{saleType === 'meter' ? 'meter' : (saleType === 'roll' ? 'roll' : (suppliesUnit === 'pak' ? 'pak' : 'eceran'))}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="col-span-2 py-6 text-center text-xs text-slate-400">
                  {saleType === 'production_supplies'
                    ? 'Belum ada produk dengan kategori Production Supplies.'
                    : `Tidak ada bahan vinyl yang cocok dengan pencarian "${searchQuery}"`}
                </div>
              )}
            </div>
          </div>

          {/* Dimensions & Parameter Calculator */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                {saleType === 'meter' 
                  ? 'Kalkulator Penjualan per Meter:' 
                  : saleType === 'roll'
                  ? 'Kalkulator Penjualan per Roll:'
                  : 'Kalkulator Production Supplies:'}
              </span>
            </div>

            {saleType === 'meter' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Panjang (P) Meter */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Panjang (P) Meter
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={lengthInMeters}
                        onChange={(e) => setLengthInMeters(e.target.value)}
                        placeholder="1,7"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold font-mono"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">m</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[1, 2, 3, 5, 10].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setLengthInMeters(m)}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            numLength === m
                              ? 'bg-blue-600 text-white border-blue-600 font-bold'
                              : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lebar (L) Meter */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Lebar (L) Meter
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={widthInMeters}
                        onChange={(e) => setWidthInMeters(e.target.value)}
                        placeholder="0,3"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold font-mono"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">m</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[0.45, 0.5, 1.0, 1.26, 1.52].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setWidthInMeters(w)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                            numWidth === w
                              ? 'bg-blue-600 text-white border-blue-600 font-bold'
                              : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          {w}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Jumlah Qty */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Jumlah Potong (Qty)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value ? parseFloat(e.target.value) : 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold font-mono"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">pcs</span>
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      {[1, 2, 5, 10].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuantity(q)}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            quantity === q
                              ? 'bg-blue-600 text-white border-blue-600 font-bold'
                              : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          {q}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sub-calculation review */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-700 font-mono">
                  <span>Luas per item: <strong>{lengthInMeters}m × {widthInMeters}m = {totalSquareMeters.toFixed(2)} m²</strong></span>
                  <span className="text-blue-700 font-bold">Total Luas: {(totalSquareMeters * quantity).toFixed(2)} m²</span>
                </div>

                {/* Harga Khusus Manual Price Override for Meter */}
                <div className="pt-2.5 border-t border-slate-200 mt-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Harga Khusus (Per Meter)
                    </label>
                    {isCustomPriceMeterActive && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[11px] text-slate-400 font-bold">Rp</span>
                    <input
                      type="text"
                      id="input-harga-khusus-meter"
                      value={customPriceMeter}
                      onChange={(e) => setCustomPriceMeter(formatNumberInput(e.target.value))}
                      placeholder="Kosongkan jika menggunakan harga standar..."
                      className={`w-full bg-white border rounded-lg pl-8 pr-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 ${
                        isCustomPriceMeterActive 
                          ? 'border-amber-400 ring-2 ring-amber-400 text-amber-900 bg-amber-50/50' 
                          : 'border-slate-300 text-slate-800 focus:ring-blue-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-slate-500">Harga Standar ({custCatName}): <strong>{formatRupiah(standardUnitPrice)}</strong>/meter</span>
                    {isCustomPriceMeterActive && (
                      <button
                        type="button"
                        onClick={() => setCustomPriceMeter('')}
                        className="text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                      >
                        Reset / Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : saleType === 'roll' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jumlah Roll
                  </label>
                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value ? parseFloat(e.target.value) : 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold font-mono"
                    />
                    <span className="text-xs font-bold text-slate-600 shrink-0">Roll</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 3, 5, 10, 20].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setQuantity(r)}
                        className={`text-xs px-3 py-1 rounded-lg border transition-colors cursor-pointer ${
                          quantity === r
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {r} roll
                      </button>
                    ))}
                  </div>
                </div>

                {/* Harga Khusus Manual Price Override for Roll */}
                <div className="pt-2.5 border-t border-slate-200 mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Harga Khusus (Per Roll)
                    </label>
                    {isCustomPriceRollActive && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[11px] text-slate-400 font-bold">Rp</span>
                    <input
                      type="text"
                      id="input-harga-khusus-roll"
                      value={customPriceRoll}
                      onChange={(e) => setCustomPriceRoll(formatNumberInput(e.target.value))}
                      placeholder="Kosongkan jika menggunakan harga standar..."
                      className={`w-full bg-white border rounded-lg pl-8 pr-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 ${
                        isCustomPriceRollActive 
                          ? 'border-amber-400 ring-2 ring-amber-400 text-amber-900 bg-amber-50/50' 
                          : 'border-slate-300 text-slate-800 focus:ring-blue-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-slate-500">Harga Standar ({custCatName}): <strong>{formatRupiah(standardUnitPrice)}</strong>/roll</span>
                    {isCustomPriceRollActive && (
                      <button
                        type="button"
                        onClick={() => setCustomPriceRoll('')}
                        className="text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                      >
                        Reset / Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Production Supplies Calculator */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Satuan: Eceran vs Pak */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pilihan Pembelian
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSuppliesUnit('eceran')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          suppliesUnit === 'eceran'
                            ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Eceran ({selectedProduct?.unit || 'Pcs'})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuppliesUnit('pak')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          suppliesUnit === 'pak'
                            ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Per Pak / Box
                      </button>
                    </div>
                  </div>

                  {/* Jumlah Qty */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Jumlah {suppliesUnit === 'pak' ? 'Pak' : 'Eceran'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value ? parseFloat(e.target.value) : 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-bold font-mono"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">
                        {suppliesUnit === 'pak' ? 'Pak' : (selectedProduct?.unit || 'Pcs')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 5, 10, 20, 50, 100].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        quantity === q
                          ? 'bg-purple-600 text-white border-purple-600 font-bold'
                          : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {q} {suppliesUnit === 'pak' ? 'Pak' : 'Pcs'}
                    </button>
                  ))}
                </div>

                {/* Harga Khusus Manual Price Override */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Harga (Khusus)
                    </label>
                    {isCustomPriceSuppliesActive && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[11px] text-slate-400 font-bold">Rp</span>
                    <input
                      type="text"
                      id="input-harga-khusus-supplies"
                      value={customPriceSupplies}
                      onChange={(e) => setCustomPriceSupplies(formatNumberInput(e.target.value))}
                      placeholder="Kosongkan jika menggunakan harga standar..."
                      className={`w-full bg-white border rounded-lg pl-8 pr-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 ${
                        isCustomPriceSuppliesActive 
                          ? 'border-amber-400 ring-2 ring-amber-400 text-amber-900 bg-amber-50/50' 
                          : 'border-slate-300 text-slate-800 focus:ring-purple-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-slate-500">Harga Standar ({custCatName} - {suppliesUnit === 'pak' ? 'Pak' : 'Eceran'}): <strong>{formatRupiah(standardUnitPrice)}</strong></span>
                    {isCustomPriceSuppliesActive && (
                      <button
                        type="button"
                        onClick={() => setCustomPriceSupplies('')}
                        className="text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                      >
                        Reset / Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Khusus (Opsional)
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Contoh: Packing bubble wrap, warna hitam..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Total Calculation Banner */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-blue-700 font-medium">
                {saleType === 'meter' 
                  ? 'Estimasi Total Penjualan Meteran:' 
                  : saleType === 'roll'
                  ? 'Estimasi Total Penjualan Roll:'
                  : 'Estimasi Total Production Supplies:'}
              </span>
              <div className="text-xl font-extrabold text-blue-900">{formatRupiah(calculatedTotal)}</div>
              <div className="text-[11px] text-blue-600 mt-0.5">
                {saleType === 'meter' 
                  ? `Tarif ${custCatName}: ${formatRupiah(unitPrice)}/meter` 
                  : saleType === 'roll'
                  ? `Tarif ${custCatName}: ${formatRupiah(unitPrice)}/roll`
                  : `Tarif ${custCatName} (${suppliesUnit === 'pak' ? 'Per Pak' : 'Eceran'}): ${formatRupiah(unitPrice)}`}
              </div>
            </div>
            <div className="text-right text-xs text-blue-700">
              <span className="font-semibold">
                {saleType === 'meter' 
                  ? `${(totalSquareMeters * quantity).toFixed(2)} meter total` 
                  : saleType === 'roll'
                  ? `${quantity} roll`
                  : `${quantity} ${suppliesUnit === 'pak' ? 'Pak' : (selectedProduct?.unit || 'Pcs')}`}
              </span>
              <div className="font-semibold text-slate-700">@ {formatRupiah(unitPrice)}</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            id="btn-tambah-ke-keranjang-bahan"
            onClick={handleAdd}
            disabled={!selectedProduct}
            className="px-5 py-2.5 bg-[#1e295d] hover:bg-[#162049] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Tambahkan ke Keranjang
          </button>
        </div>
      </div>
    </div>
  );
};


