/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useMemo, useEffect } from 'react';
import { X, Printer, Scissors, Plus, Check, Search, Sparkles, Package } from 'lucide-react';
import { Product, CartItem, Customer, CustomerCategory, ProductCategoryItem } from '../../types';
import { formatRupiah, getPrintServicePrice, getPaketPrice, formatNumberInput, parseNumber, parseDecimal } from '../../utils/formatters';
import { isPrintOrLaserProduct, isDigitalPrintingProduct, isLaserCuttingProduct, isPaketProduct } from '../../utils/productFilters';

interface AddPrintServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart: (item: CartItem) => void;
  selectedCustomer?: Customer | null;
  categories?: CustomerCategory[];
  productCategories?: ProductCategoryItem[];
}

export const AddPrintServiceModal: React.FC<AddPrintServiceModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddToCart,
  selectedCustomer,
  categories = [],
  productCategories = [],
}) => {
  const [saleType, setSaleType] = useState<'meter' | 'lembar' | 'paket'>('meter');
  const [activeTab, setActiveTab] = useState<'digital_print' | 'laser_cutting'>('digital_print');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Dimension & Parameter inputs
  const [lengthMeters, setLengthMeters] = useState<string | number>(1);
  const [widthMeters, setWidthMeters] = useState<string | number>(1);
  const [quantity, setQuantity] = useState(1);
  const [customDimensionText, setCustomDimensionText] = useState('A3');
  const [finishing, setFinishing] = useState('Standar (Potong Rapih)');
  const [customNotes, setCustomNotes] = useState('');

  // Harga Khusus (Manual Price Override)
  const [customPriceMeter, setCustomPriceMeter] = useState<string>('');
  const [customPriceLembar, setCustomPriceLembar] = useState<string>('');
  const [customPricePaket, setCustomPricePaket] = useState<string>('');

  // Strict category lists
  const digitalPrintProducts = useMemo(() => {
    return products.filter((p) => isDigitalPrintingProduct(p, productCategories));
  }, [products, productCategories]);

  const laserCuttingProducts = useMemo(() => {
    return products.filter((p) => isLaserCuttingProduct(p, productCategories));
  }, [products, productCategories]);

  const paketProducts = useMemo(() => {
    return products.filter((p) => isPaketProduct(p, productCategories));
  }, [products, productCategories]);

  const activeCategoryProducts = useMemo(() => {
    if (saleType === 'paket') {
      return paketProducts;
    }
    if (activeTab === 'digital_print') {
      return digitalPrintProducts.filter((p) => {
        // Aturan khusus Digital Printing: filter berdasarkan printSaleMode (meter vs lembar)
        const mode = p.printSaleMode || (p.unit === 'lembar' ? 'lembar' : 'meter');
        return mode === saleType;
      });
    }
    // Kategori Laser Cutting: aturan printSaleMode tidak berlaku khusus, tampilkan seluruh laser cutting
    return laserCuttingProducts;
  }, [activeTab, digitalPrintProducts, laserCuttingProducts, paketProducts, saleType]);

  // Auto-select when modal opens or tab/products change
  useEffect(() => {
    if (activeCategoryProducts.length > 0) {
      const stillValid = selectedProduct && activeCategoryProducts.some((p) => p.id === selectedProduct.id);
      if (!stillValid) {
        const initial = activeCategoryProducts[0];
        setSelectedProduct(initial);
        
        if (saleType === 'lembar') {
          setCustomDimensionText('A3');
        } else if (saleType === 'paket') {
          setCustomDimensionText(initial.dimensions || '-');
        } else {
          setCustomDimensionText(initial.dimensions || '1.52x50');
        }
      }
    } else {
      setSelectedProduct(null);
    }
  }, [activeCategoryProducts, isOpen, activeTab, saleType]);

  if (!isOpen) return null;

  const custCatName = selectedCustomer 
    ? categories.find(c => c.id === selectedCustomer.categoryId)?.name || 'GROSIR'
    : 'UMUM';

  // Filter products strictly by active tab and search
  const currentProducts = activeCategoryProducts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.dimensions && p.dimensions.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  // Standard pricing calculation per customer category tier:
  const standardUnitPrice = selectedProduct 
    ? (saleType === 'paket'
        ? getPaketPrice(selectedProduct, custCatName)
        : getPrintServicePrice(selectedProduct, custCatName, saleType))
    : 0;
  const numLength = parseDecimal(lengthMeters);
  const numWidth = parseDecimal(widthMeters);
  const totalSquareMeters = numLength * numWidth;

  // Check if Harga Khusus is active for current sale type
  const numCustomPriceMeter = parseNumber(customPriceMeter);
  const numCustomPriceLembar = parseNumber(customPriceLembar);
  const numCustomPricePaket = parseNumber(customPricePaket);
  const isCustomPriceMeterActive = customPriceMeter !== '' && numCustomPriceMeter > 0;
  const isCustomPriceLembarActive = customPriceLembar !== '' && numCustomPriceLembar > 0;
  const isCustomPricePaketActive = customPricePaket !== '' && numCustomPricePaket > 0;

  const effectiveUnitPrice = saleType === 'paket'
    ? (isCustomPricePaketActive ? numCustomPricePaket : standardUnitPrice)
    : saleType === 'meter'
    ? (isCustomPriceMeterActive ? numCustomPriceMeter : standardUnitPrice)
    : (isCustomPriceLembarActive ? numCustomPriceLembar : standardUnitPrice);

  // Rumus Penjualan:
  const calculatedTotal = saleType === 'paket'
    ? Math.round(totalSquareMeters * quantity * effectiveUnitPrice)
    : saleType === 'meter'
    ? Math.round(totalSquareMeters * quantity * effectiveUnitPrice)
    : Math.round(quantity * effectiveUnitPrice);

  const unitDisplay = saleType === 'paket'
    ? `x ${quantity} Paket (P:${lengthMeters}m x L:${widthMeters}m)`
    : saleType === 'meter'
    ? `x ${(totalSquareMeters * quantity).toFixed(2)} m² (P:${lengthMeters}m x L:${widthMeters}m)`
    : `x ${quantity} lembar`;

  const isCurrentCustomPriceActive = saleType === 'paket' 
    ? isCustomPricePaketActive 
    : saleType === 'meter' 
    ? isCustomPriceMeterActive 
    : isCustomPriceLembarActive;

  const handleAdd = () => {
    if (!selectedProduct) return;

    const dimensions = customDimensionText || selectedProduct.dimensions || `${numWidth}x${numLength}m`;

    const formattedSpec = saleType === 'paket'
      ? `${lengthMeters} x ${widthMeters} x ${quantity}`
      : saleType === 'meter'
      ? `${lengthMeters} x ${widthMeters} x ${quantity}`
      : `${quantity} Lembar`;

    const unitDisplayLabel = saleType === 'paket'
      ? `${lengthMeters} x ${widthMeters} x ${quantity}`
      : saleType === 'meter'
      ? `${lengthMeters} x ${widthMeters} x ${quantity}`
      : `${quantity} Lembar`;

    const priceNote = isCurrentCustomPriceActive ? `(Harga Khusus: ${formatRupiah(effectiveUnitPrice)})` : '';
    const combinedNotes = [
      finishing ? `Finishing: ${finishing}` : '',
      priceNote,
      customNotes
    ].filter(Boolean).join('. ');

    const newItem: CartItem = {
      id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      productId: selectedProduct.id,
      code: selectedProduct.code,
      name: selectedProduct.name,
      dimensions: dimensions,
      qty: saleType === 'paket' ? parseFloat((totalSquareMeters * quantity).toFixed(4)) : (saleType === 'meter' ? parseFloat((totalSquareMeters * quantity).toFixed(4)) : quantity),
      unit: unitDisplayLabel,
      unitPrice: effectiveUnitPrice,
      totalPrice: calculatedTotal,
      category: selectedProduct.category,
      notes: combinedNotes,
      saleType: saleType === 'paket' ? 'paket' : saleType,
      lengthMeters: (saleType === 'meter' || saleType === 'paket') ? numLength : undefined,
      widthMeters: (saleType === 'meter' || saleType === 'paket') ? numWidth : undefined,
      itemCount: quantity,
      formattedSpec: formattedSpec
    };

    onAddToCart(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center sm:items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 max-sm:p-0 max-sm:items-end animate-in fade-in duration-200">
      <div 
        id="modal-tambah-penjualan-cetak"
        className="bg-white rounded-2xl max-sm:rounded-b-none max-sm:rounded-t-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-[#0ea5e9] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">TAMBAH PENJUALAN CETAK & PAKET</h2>
                <span className="bg-white/20 text-white border border-white/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {digitalPrintProducts.length + laserCuttingProducts.length + paketProducts.length} Produk
                </span>
              </div>
              <p className="text-xs text-sky-100">Digital Printing UV / Eco-Solvent, Jasa Laser Cutting & Paket Produk</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer Price Tier Banner */}
        <div className="bg-sky-50 px-6 py-2.5 border-b border-sky-100 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Pelanggan Aktif:</span>
            <span className="font-bold text-slate-900">
              {selectedCustomer ? selectedCustomer.name : 'Pelanggan Umum'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Tarif Standar:</span>
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

        {/* Tab Selection: Digital Printing & Laser Cutting (hidden when Paket is selected) */}
        {saleType !== 'paket' && (
          <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-100 p-1.5 gap-1.5 shrink-0">
            <button
              type="button"
              id="tab-digital-printing"
              onClick={() => setActiveTab('digital_print')}
              className={`py-2 px-3 font-bold text-xs flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'digital_print'
                  ? 'bg-[#0ea5e9] text-white shadow-sm ring-1 ring-[#0ea5e9]'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Printer className="w-4 h-4" />
              Digital Printing ({digitalPrintProducts.length})
            </button>

            <button
              type="button"
              id="tab-laser-cutting"
              onClick={() => setActiveTab('laser_cutting')}
              className={`py-2 px-3 font-bold text-xs flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'laser_cutting'
                  ? 'bg-[#0ea5e9] text-white shadow-sm ring-1 ring-[#0ea5e9]'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Scissors className="w-4 h-4" />
              Laser Cutting ({laserCuttingProducts.length})
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Sale Type Selector for Penjualan Cetak & Paket */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              JENIS PEMBELIAN CETAK & PAKET
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-penjualan-per-meter"
                onClick={() => {
                  setSaleType('meter');
                  setCustomDimensionText(selectedProduct?.dimensions || '1.52x50');
                }}
                className={`py-3 px-3 rounded-xl font-semibold text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                  saleType === 'meter'
                    ? 'bg-sky-50 border-sky-600 text-sky-900 shadow-xs ring-2 ring-sky-600'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${saleType === 'meter' ? 'bg-sky-600' : 'bg-slate-300'}`}></span>
                  Per Meter
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 text-center">(P x L) × Jumlah × Harga</span>
              </button>

              <button
                type="button"
                id="btn-penjualan-per-lembar"
                onClick={() => {
                  setSaleType('lembar');
                  setCustomDimensionText('A3');
                }}
                className={`py-3 px-3 rounded-xl font-semibold text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                  saleType === 'lembar'
                    ? 'bg-sky-50 border-sky-600 text-sky-900 shadow-xs ring-2 ring-sky-600'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${saleType === 'lembar' ? 'bg-sky-600' : 'bg-slate-300'}`}></span>
                  Per Lembar
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 text-center">Jumlah × Harga</span>
              </button>

              <button
                type="button"
                id="btn-penjualan-paket"
                onClick={() => {
                  setSaleType('paket');
                  setCustomDimensionText('-');
                }}
                className={`py-3 px-3 rounded-xl font-semibold text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                  saleType === 'paket'
                    ? 'bg-sky-50 border-sky-600 text-sky-900 shadow-xs ring-2 ring-sky-600'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${saleType === 'paket' ? 'bg-sky-600' : 'bg-slate-300'}`}></span>
                  Paket
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 text-center">Jumlah × Harga</span>
              </button>
            </div>
          </div>

          {/* Search & Product selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Pilih Produk {saleType === 'paket' ? 'Paket' : (activeTab === 'digital_print' ? 'Digital Printing' : 'Laser Cutting')} ({currentProducts.length})
              </label>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Cari produk ${saleType === 'paket' ? 'paket' : (activeTab === 'digital_print' ? 'digital printing' : 'laser cutting')}...`}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Product Picker Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
              {currentProducts.length > 0 ? (
                currentProducts.map((p) => {
                  const isSelected = selectedProduct?.id === p.id;
                  const itemPrice = saleType === 'paket' 
                    ? getPaketPrice(p, custCatName)
                    : getPrintServicePrice(p, custCatName, saleType as 'meter' | 'lembar');
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(p);
                        if (saleType === 'lembar') {
                          setCustomDimensionText('A3');
                        } else if (saleType === 'paket') {
                          setCustomDimensionText(p.dimensions || '-');
                        } else if (p.dimensions) {
                          setCustomDimensionText(p.dimensions);
                        } else {
                          setCustomDimensionText('1.52x50');
                        }
                      }}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/80 shadow-xs ring-2 ring-sky-500'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold font-mono bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                          {p.code}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                      </div>
                      <div className="mt-1 font-bold text-xs text-slate-900 line-clamp-1">
                        {p.name}
                      </div>
                      <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1">
                        <span>Ukuran: {p.dimensions || (saleType === 'lembar' ? 'A3' : '-')}</span>
                        <span className="font-bold text-sky-700">
                          {formatRupiah(itemPrice)}/{saleType === 'paket' ? 'paket' : (saleType === 'meter' ? 'meter' : 'lembar')}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="col-span-2 py-6 text-center text-xs text-slate-400">
                  Tidak ada produk {saleType === 'paket' ? 'paket' : (activeTab === 'digital_print' ? 'digital printing' : 'laser cutting')} yang cocok dengan pencarian "{searchQuery}"
                </div>
              )}
            </div>
          </div>

          {/* Dimension & Parameter Calculator */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              {saleType === 'paket'
                ? 'Kalkulator Penjualan Paket:'
                : saleType === 'meter' 
                ? 'Kalkulator Penjualan Cetak per Meter:' 
                : 'Kalkulator Penjualan Cetak per Lembar:'}
            </div>

            {saleType === 'paket' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* 1. Panjang (P) Meter */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Panjang (P) Meter
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={lengthMeters}
                        onChange={(e) => setLengthMeters(e.target.value)}
                        placeholder="1,7"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">m</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[1, 2, 3, 5].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setLengthMeters(m)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                            numLength === m ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          +{m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Lebar (L) Meter */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Lebar (L) Meter
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={widthMeters}
                        onChange={(e) => setWidthMeters(e.target.value)}
                        placeholder="0,3"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">m</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[0.5, 1.0, 1.2, 1.52].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setWidthMeters(w)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                            numWidth === w ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          {w}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Jumlah Paket */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Jumlah Paket
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value ? parseFloat(e.target.value) : 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">Paket</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[1, 2, 5, 10].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuantity(q)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                            quantity === q ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          {q} Paket
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Kolom Harga Khusus */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Harga Khusus
                      </label>
                      {isCustomPricePaketActive && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 rounded">
                          Aktif
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-[11px] text-slate-400 font-bold">Rp</span>
                      <input
                        type="text"
                        id="input-harga-khusus-paket"
                        value={customPricePaket}
                        onChange={(e) => setCustomPricePaket(formatNumberInput(e.target.value))}
                        placeholder="Harga /paket..."
                        className={`w-full bg-white border rounded-lg pl-8 pr-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 ${
                          isCustomPricePaketActive 
                            ? 'border-amber-400 ring-2 ring-amber-400 text-amber-900 bg-amber-50/50' 
                            : 'border-slate-300 text-slate-800 focus:ring-sky-500'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-slate-500">
                        {custCatName.includes('UMUM') ? 'Harga Umum: ' : 'Harga Grosir: '}{formatRupiah(standardUnitPrice)}
                      </span>
                      {isCustomPricePaketActive && (
                        <button
                          type="button"
                          onClick={() => setCustomPricePaket('')}
                          className="text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-calculation review for Paket */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-700 font-mono">
                  <span>
                    Format: <strong>{lengthMeters}m (P) × {widthMeters}m (L) × {quantity} Paket × {formatRupiah(effectiveUnitPrice)}</strong>
                  </span>
                  <span className="text-sky-700 font-bold">Total: {formatRupiah(calculatedTotal)}</span>
                </div>
              </div>
            ) : saleType === 'meter' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Panjang (P) Meter */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Panjang (P) Meter
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={lengthMeters}
                        onChange={(e) => setLengthMeters(e.target.value)}
                        placeholder="1,7"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">m</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[1, 2, 3, 5].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setLengthMeters(m)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                            numLength === m ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          +{m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lebar (L) Meter */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Lebar (L) Meter
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={widthMeters}
                        onChange={(e) => setWidthMeters(e.target.value)}
                        placeholder="0,3"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">m</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[0.5, 1.0, 1.2, 1.52].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setWidthMeters(w)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                            numWidth === w ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          {w}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Jumlah Rangkap / Qty */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Jumlah Cetak
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value ? parseFloat(e.target.value) : 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">pcs</span>
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      {[1, 2, 5, 10].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuantity(q)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                            quantity === q ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          {q}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kolom Harga Khusus (Penjualan per Meter) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Harga Khusus
                      </label>
                      {isCustomPriceMeterActive && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 rounded">
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
                        placeholder="Harga /meter..."
                        className={`w-full bg-white border rounded-lg pl-8 pr-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 ${
                          isCustomPriceMeterActive 
                            ? 'border-amber-400 ring-2 ring-amber-400 text-amber-900 bg-amber-50/50' 
                            : 'border-slate-300 text-slate-800 focus:ring-sky-500'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-slate-400">Standar: {formatRupiah(standardUnitPrice)}</span>
                      {isCustomPriceMeterActive && (
                        <button
                          type="button"
                          onClick={() => setCustomPriceMeter('')}
                          className="text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-calculation review */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-700 font-mono">
                  <span>Luas: <strong>{lengthMeters}m × {widthMeters}m = {totalSquareMeters.toFixed(2)} m²</strong> × {quantity} pcs</span>
                  <span className="text-sky-700 font-bold">Total Luas: {(totalSquareMeters * quantity).toFixed(2)} m²</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Jumlah Lembar */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jumlah Lembar
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value ? parseFloat(e.target.value) : 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    />
                    <span className="text-xs font-bold text-slate-600 shrink-0">Lembar</span>
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {[1, 2, 5, 10, 25, 50].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuantity(q)}
                        className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer ${
                          quantity === q ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {q} lbr
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ukuran / Format Lembar (Default A3) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ukuran / Format Lembar (Opsional)
                  </label>
                  <input
                    type="text"
                    id="input-ukuran-lembar"
                    value={customDimensionText}
                    onChange={(e) => setCustomDimensionText(e.target.value)}
                    placeholder="misal: A3, A3+, 3mm 40x60cm"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="flex gap-1 mt-1.5">
                    {['A3', 'A3+', 'A4', '40x60'].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setCustomDimensionText(fmt)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                          customDimensionText === fmt ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kolom Harga Khusus (Penjualan per Lembar) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Harga Khusus
                    </label>
                    {isCustomPriceLembarActive && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[11px] text-slate-400 font-bold">Rp</span>
                    <input
                      type="text"
                      id="input-harga-khusus-lembar"
                      value={customPriceLembar}
                      onChange={(e) => setCustomPriceLembar(formatNumberInput(e.target.value))}
                      placeholder="Harga /lembar..."
                      className={`w-full bg-white border rounded-lg pl-8 pr-2.5 py-2 text-xs font-bold font-mono focus:outline-hidden focus:ring-2 ${
                        isCustomPriceLembarActive 
                          ? 'border-amber-400 ring-2 ring-amber-400 text-amber-900 bg-amber-50/50' 
                          : 'border-slate-300 text-slate-800 focus:ring-sky-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-slate-400">Standar: {formatRupiah(standardUnitPrice)}</span>
                    {isCustomPriceLembarActive && (
                      <button
                        type="button"
                        onClick={() => setCustomPriceLembar('')}
                        className="text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Finishing options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Finishing / Opsi Pengerjaan
                </label>
                <select
                  value={finishing}
                  onChange={(e) => setFinishing(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-medium"
                >
                  <option value="Standar (Potong Rapih)">Standar (Potong Rapih)</option>
                  <option value="Potong Putus (Die Cut)">Potong Putus (Die Cut)</option>
                  <option value="Potong Setengah (Kiss Cut)">Potong Setengah (Kiss Cut)</option>
                  <option value="Mata Ayam / Ring Setiap Sudut">Mata Ayam / Ring Setiap Sudut</option>
                  <option value="Slongsong Kiri Kanan">Slongsong Kiri Kanan</option>
                  <option value="Laminasi Glossy Dingin">Laminasi Glossy Dingin</option>
                  <option value="Laminasi Doff Dingin">Laminasi Doff Dingin</option>
                  <option value="Grafir & Potong Laser Kayu">Grafir & Potong Laser Kayu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Catatan Pengerjaan
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Contoh: File sudah siap cetak, warna tajam"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Total Calculation */}
          <div className="bg-sky-50 p-4 rounded-xl border border-sky-200 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-sky-700 font-medium">
                  {saleType === 'paket' ? 'Estimasi Total Penjualan Paket:' : saleType === 'meter' ? 'Estimasi Total Penjualan Cetak Meteran:' : 'Estimasi Total Penjualan Cetak Lembaran:'}
                </span>
                {isCurrentCustomPriceActive && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
                    Harga Khusus
                  </span>
                )}
              </div>
              <div className="text-xl font-extrabold text-sky-900">{formatRupiah(calculatedTotal)}</div>
              <div className="text-[11px] text-sky-700 mt-0.5">
                {saleType === 'paket' ? (
                  isCurrentCustomPriceActive ? (
                    <span className="text-amber-800 font-semibold">
                      Rumus: {quantity} Paket × {formatRupiah(effectiveUnitPrice)} (Harga Khusus)
                    </span>
                  ) : (
                    <span>Tarif {custCatName}: {formatRupiah(standardUnitPrice)}/paket (Harga Paket Grosir / Umum)</span>
                  )
                ) : saleType === 'meter' ? (
                  isCurrentCustomPriceActive ? (
                    <span className="text-amber-800 font-semibold">
                      Rumus: ({lengthMeters}m × {widthMeters}m) × {quantity} pcs × {formatRupiah(effectiveUnitPrice)} (Harga Khusus)
                    </span>
                  ) : (
                    <span>Tarif {custCatName}: {formatRupiah(standardUnitPrice)}/meter (Harga Grosir / Umum)</span>
                  )
                ) : (
                  isCurrentCustomPriceActive ? (
                    <span className="text-amber-800 font-semibold">
                      Rumus: {quantity} lembar × {formatRupiah(effectiveUnitPrice)} (Harga Khusus)
                    </span>
                  ) : (
                    <span>Tarif {custCatName}: {formatRupiah(standardUnitPrice)}/lembar (Harga Meter Grosir / Umum)</span>
                  )
                )}
              </div>
            </div>
            <div className="text-right text-xs text-sky-700">
              <span className="font-semibold">{unitDisplay}</span>
              <div className="text-slate-600 font-medium">@ {formatRupiah(effectiveUnitPrice)}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
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
            id="btn-tambah-ke-keranjang-cetak"
            onClick={handleAdd}
            disabled={!selectedProduct}
            className="px-5 py-2.5 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Tambahkan ke Keranjang
          </button>
        </div>
      </div>
    </div>
  );
};


