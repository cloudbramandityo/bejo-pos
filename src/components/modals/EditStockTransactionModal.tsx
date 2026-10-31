/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Save,
  Trash2,
  Plus,
  Search,
  AlertTriangle,
  Package,
  Truck,
  UserCheck,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { StockTransaction, StockTransactionItem, Product, Supplier, Agent, ProductCategoryItem } from '../../types';
import { formatRupiah, formatNumberInput, parseNumber } from '../../utils/formatters';
import { normalizeStockTransaction, calculateStockItemProfit, getProductRollPakQty } from '../../utils/stockUtils';
import { isStockEligibleProduct } from '../../utils/productFilters';

interface EditStockTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: StockTransaction | null;
  products: Product[];
  suppliers: Supplier[];
  agents: Agent[];
  productCategories?: ProductCategoryItem[];
  onSave: (updatedTransaction: StockTransaction) => Promise<void> | void;
}

export const EditStockTransactionModal: React.FC<EditStockTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  products,
  suppliers,
  agents,
  productCategories = [],
  onSave,
}) => {
  if (!isOpen || !transaction) return null;

  const isPembelian = transaction.type === 'PEMBELIAN';
  const partyLabel = isPembelian ? 'Supplier / Distributor' : 'Penerima / Nama Agen';

  // Form states
  const [date, setDate] = useState(transaction.date || '');
  const [time, setTime] = useState(transaction.time || '');
  const [partyName, setPartyName] = useState(transaction.supplierName || '');
  const [notes, setNotes] = useState(transaction.notes || '');
  const [shippingCostInput, setShippingCostInput] = useState<string>(
    transaction.shippingCost ? transaction.shippingCost.toString() : ''
  );

  // Items state
  const [items, setItems] = useState<StockTransactionItem[]>(() => {
    const norm = normalizeStockTransaction(transaction);
    return norm.items.map((it) => ({ ...it }));
  });

  // Re-sync when transaction changes
  useEffect(() => {
    if (transaction) {
      setDate(transaction.date || '');
      setTime(transaction.time || '');
      setPartyName(transaction.supplierName || '');
      setNotes(transaction.notes || '');
      setShippingCostInput(transaction.shippingCost ? transaction.shippingCost.toString() : '');
      const norm = normalizeStockTransaction(transaction);
      setItems(norm.items.map((it) => ({ ...it })));
    }
  }, [transaction]);

  // Fast Product lookup maps
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

  // Add Item States
  const [showAddItemSection, setShowAddItemSection] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [selectedNewProduct, setSelectedNewProduct] = useState<Product | null>(null);
  const [newQty, setNewQty] = useState<number | ''>(1);
  const [newPrice, setNewPrice] = useState<string>('');
  const [newUnit, setNewUnit] = useState('roll');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [showAddProductDropdown, setShowAddProductDropdown] = useState(false);

  // Saving state & errors
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Eligible products for autocomplete
  const eligibleProducts = useMemo(() => {
    if (!addSearchQuery.trim()) return [];
    const q = addSearchQuery.toLowerCase();
    return products
      .filter((p) => isStockEligibleProduct(p, productCategories))
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [products, productCategories, addSearchQuery]);

  // Select a product to add
  const handleSelectNewProduct = (p: Product) => {
    setSelectedNewProduct(p);
    setAddSearchQuery(p.name);
    setShowAddProductDropdown(false);

    let defaultPrice = 0;
    if (isPembelian) {
      defaultPrice = p.costPrice || p.hargaKulak || 0;
    } else {
      defaultPrice = p.hargaAgen || p.hargaMeterGrosir || p.hargaGrosir || p.price || 0;
    }

    setNewPrice(defaultPrice.toString());
    setNewUnit(p.unit || 'roll');
  };

  // Price tier options for the new product
  const newProductPriceOptions = useMemo(() => {
    if (!selectedNewProduct) return [];
    const p = selectedNewProduct;
    const list: { label: string; price: number; unit?: string }[] = [];

    const addOpt = (label: string, price?: number, unit?: string) => {
      if (price && price > 0 && !list.some((item) => item.label === label && item.price === price)) {
        list.push({ label, price, unit: unit || p.unit || 'roll' });
      }
    };

    addOpt('Kulak (HPP)', p.costPrice || p.hargaKulak, p.unit || 'roll');
    addOpt('Harga Agen', p.hargaAgen, p.unit || 'roll');
    addOpt('Meter Grosir', p.hargaMeterGrosir, 'meter');
    addOpt('Meter Umum', p.hargaMeterUmum, 'meter');
    addOpt('Pak Grosir', p.hargaPakGrosir, 'pak');
    addOpt('Ecer Grosir', p.hargaEceranGrosir, 'lembar');
    addOpt('Harga Umum', p.hargaUmum || p.price, p.unit || 'roll');

    return list;
  }, [selectedNewProduct]);

  // Handle Add Item to items list
  const handleAddItemToList = () => {
    if (!selectedNewProduct) {
      setErrorMessage('Pilih produk terlebih dahulu.');
      return;
    }
    const qtyVal = Number(newQty);
    if (!qtyVal || qtyVal <= 0) {
      setErrorMessage('Jumlah (Qty) harus lebih besar dari 0.');
      return;
    }
    const priceVal = parseNumber(newPrice);
    if (priceVal < 0) {
      setErrorMessage('Harga satuan tidak boleh negatif.');
      return;
    }

    const newItem: StockTransactionItem = {
      id: `it_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      productId: selectedNewProduct.id,
      productName: selectedNewProduct.name,
      code: selectedNewProduct.code || '',
      category: selectedNewProduct.category || 'Bahan',
      qty: qtyVal,
      price: priceVal,
      totalPrice: qtyVal * priceVal,
      unit: newUnit || selectedNewProduct.unit || 'pcs',
      notes: newItemNotes.trim() || undefined,
    };

    setItems((prev) => [...prev, newItem]);

    // Reset add item inputs
    setSelectedNewProduct(null);
    setAddSearchQuery('');
    setNewQty(1);
    setNewPrice('');
    setNewUnit('roll');
    setNewItemNotes('');
    setShowAddItemSection(false);
    setErrorMessage(null);
  };

  // Item update handlers
  const handleUpdateItemQty = (index: number, newQtyVal: number) => {
    setItems((prev) => {
      const next = [...prev];
      const it = next[index];
      const validQty = Math.max(0.1, newQtyVal);
      next[index] = {
        ...it,
        qty: validQty,
        totalPrice: Math.round(validQty * (it.price || 0)),
      };
      return next;
    });
  };

  const handleUpdateItemPrice = (index: number, newPriceStr: string) => {
    const val = parseNumber(newPriceStr);
    setItems((prev) => {
      const next = [...prev];
      const it = next[index];
      next[index] = {
        ...it,
        price: val,
        totalPrice: Math.round((it.qty || 0) * val),
      };
      return next;
    });
  };

  const handleUpdateItemUnit = (index: number, newUnitStr: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        unit: newUnitStr,
      };
      return next;
    });
  };

  const handleUpdateItemNotes = (index: number, newNotesStr: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        notes: newNotesStr,
      };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMessage('Transaksi harus memiliki minimal 1 item produk. Jika ingin menghapus transaksi secara keseluruhan, gunakan tombol Hapus Transaksi.');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setErrorMessage(null);
  };

  // Totals calculations
  const totalQty = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  }, [items]);

  const itemsSubtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
  }, [items]);

  const parsedShippingCost = isPembelian ? parseNumber(shippingCostInput) : 0;
  const totalAmount = itemsSubtotal + parsedShippingCost;

  const { totalCost, totalProfit } = useMemo(() => {
    let cost = 0;
    let profit = 0;
    if (!isPembelian) {
      items.forEach((it) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
        const pData = calculateStockItemProfit(it, prod);
        cost += pData.totalCost;
        profit += pData.totalProfit;
      });
    }
    return { totalCost: cost, totalProfit: profit };
  }, [items, isPembelian, productMap, productByCodeMap, productByNameMap]);

  // Submit Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!partyName.trim()) {
      setErrorMessage(`${partyLabel} tidak boleh kosong.`);
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Daftar item produk tidak boleh kosong.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].qty || items[i].qty <= 0) {
        setErrorMessage(`Item ke-${i + 1} (${items[i].productName}) memiliki jumlah (qty) yang tidak valid.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const updatedTx: StockTransaction = {
        ...transaction,
        date: date.trim() || transaction.date,
        time: time.trim() || transaction.time,
        supplierName: partyName.trim(),
        shippingCost: isPembelian && parsedShippingCost > 0 ? parsedShippingCost : 0,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          ...it,
          qty: Number(it.qty) || 1,
          price: Number(it.price) || 0,
          totalPrice: Math.round((Number(it.qty) || 1) * (Number(it.price) || 0)),
        })),
        totalQty: totalQty,
        totalAmount: totalAmount,
        // Single item fallback
        productId: items[0]?.productId,
        productName: items[0]?.productName,
        qty: totalQty,
        price: items[0]?.price,
        totalPrice: totalAmount,
      };

      await onSave(updatedTx);
      onClose();
    } catch (err: any) {
      console.error('Error saving edited stock transaction:', err);
      setErrorMessage(err?.message || 'Gagal menyimpan perubahan transaksi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
                isPembelian ? 'bg-indigo-600' : 'bg-rose-600'
              }`}
            >
              {isPembelian ? <Truck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Edit Transaksi {isPembelian ? 'Pembelian Bahan' : 'Pengambilan Bahan'}
                </h2>
                {isPembelian ? (
                  <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Truck className="w-3 h-3 text-indigo-400" />
                    PEMBELIAN BAHAN & ONGKIR
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    MANAJEMEN STOK
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                No. Transaksi: <strong className="text-white">#{transaction.id}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Header Metadata Section */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Informasi Faktur & Tanggal
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Tanggal Transaksi
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Waktu / Jam
                </label>
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="HH:mm:ss"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Supplier / Agent */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  {isPembelian ? <Truck className="w-3.5 h-3.5 text-slate-500" /> : <UserCheck className="w-3.5 h-3.5 text-slate-500" />}
                  {partyLabel}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    placeholder={isPembelian ? 'Pilih atau ketik nama supplier...' : 'Pilih atau ketik nama agen...'}
                    required
                    list={isPembelian ? 'supplier-options-list' : 'agent-options-list'}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                  {isPembelian ? (
                    <datalist id="supplier-options-list">
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  ) : (
                    <datalist id="agent-options-list">
                      {agents.map((a) => (
                        <option key={a.id} value={a.name} />
                      ))}
                    </datalist>
                  )}
                </div>
              </div>
            </div>

            {/* Ongkos Kirim (Door to Door) - Khusus Pembelian Bahan */}
            {isPembelian && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Ongkos Kirim (Door to Door)</span>
                  </label>
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                    Opsional
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={shippingCostInput}
                    onChange={(e) => setShippingCostInput(formatNumberInput(e.target.value))}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Biaya pengiriman Door to Door dari supplier untuk transaksi ini.
                </span>
              </div>
            )}

            {/* General Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Catatan / Keterangan Faktur
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Pengambilan stok cabang utama, atau No. DO / Faktur Supplier..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                Rincian Item Bahan & Produk ({items.length} Item)
              </div>

              <button
                type="button"
                onClick={() => setShowAddItemSection((prev) => !prev)}
                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddItemSection ? 'Tutup Tambah Item' : 'Tambah Item Produk'}
              </button>
            </div>

            {/* Add Item Collapsible Panel */}
            {showAddItemSection && (
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3 animate-in fade-in">
                <div className="text-xs font-bold text-blue-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Tambah Produk Baru ke Transaksi Ini
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  {/* Search Product */}
                  <div className="sm:col-span-5 relative">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      Cari Nama / SKU Produk
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={addSearchQuery}
                        onChange={(e) => {
                          setAddSearchQuery(e.target.value);
                          setShowAddProductDropdown(true);
                        }}
                        onFocus={() => setShowAddProductDropdown(true)}
                        placeholder="Ketik nama bahan/stiker..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>

                    {showAddProductDropdown && eligibleProducts.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto">
                        {eligibleProducts.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => handleSelectNewProduct(p)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50/80 border-b border-slate-100 last:border-b-0 flex items-center justify-between text-xs cursor-pointer"
                          >
                            <div>
                              <div className="font-bold text-slate-900">{p.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                SKU: {p.code || '-'} | Kat: {p.category}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-blue-700">
                                {formatRupiah(isPembelian ? p.costPrice || p.hargaKulak || 0 : p.hargaAgen || p.price)}
                              </div>
                              <div className="text-[10px] text-slate-500">Stok: {p.stock} {p.unit || 'roll'}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      Jumlah (Qty)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 text-center font-bold"
                    />
                  </div>

                  {/* Unit */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      Satuan
                    </label>
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 font-medium"
                    >
                      <option value="roll">Roll</option>
                      <option value="meter">Meter</option>
                      <option value="pak">Pak</option>
                      <option value="lembar">Lembar</option>
                      <option value="pcs">Pcs</option>
                    </select>
                  </div>

                  {/* Price */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      {isPembelian ? 'Harga Kulak (HPP)' : 'Harga Satuan'}
                    </label>
                    <input
                      type="text"
                      value={formatNumberInput(newPrice)}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 font-mono font-bold text-right"
                    />
                  </div>
                </div>

                {/* Quick Price Buttons */}
                {newProductPriceOptions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 font-medium">Pilih Cepat:</span>
                    {newProductPriceOptions.map((opt, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => {
                          setNewPrice(opt.price.toString());
                          if (opt.unit) setNewUnit(opt.unit);
                        }}
                        className="text-[10px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-mono transition-colors cursor-pointer"
                      >
                        {opt.label}: {formatRupiah(opt.price)}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-blue-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddItemSection(false);
                      setSelectedNewProduct(null);
                      setAddSearchQuery('');
                    }}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItemToList}
                    disabled={!selectedNewProduct}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Masukkan Item
                  </button>
                </div>
              </div>
            )}

            {/* Editable Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Nama Produk / Bahan</th>
                    <th className="py-2.5 px-3 w-28 text-center">Jumlah (Qty)</th>
                    <th className="py-2.5 px-3 w-24 text-center">Satuan</th>
                    <th className="py-2.5 px-3 w-36 text-right">
                      {isPembelian ? 'Harga Kulak (HPP)' : 'Harga Jual Satuan'}
                    </th>
                    {!isPembelian && (
                      <th className="py-2.5 px-3 w-32 text-right text-slate-600">
                        Modal HPP
                      </th>
                    )}
                    <th className="py-2.5 px-3 w-36 text-right">Subtotal</th>
                    {!isPembelian && (
                      <th className="py-2.5 px-3 w-32 text-right bg-emerald-50 text-emerald-900">
                        Laba Bersih
                      </th>
                    )}
                    <th className="py-2.5 px-3 min-w-[120px]">Catatan Item</th>
                    <th className="py-2.5 px-2 w-10 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => {
                    const prod =
                      (it.productId ? productMap.get(it.productId) : null) ||
                      (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
                      (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
                    const pData = !isPembelian ? calculateStockItemProfit(it, prod) : null;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                          {idx + 1}
                        </td>

                        {/* Product Info */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{it.productName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            SKU: {it.code || '-'} | Kat: {it.category || 'Bahan'}
                          </div>
                        </td>

                        {/* Qty Input */}
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            step="any"
                            min="0.1"
                            value={it.qty}
                            onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-900 text-center font-bold focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* Unit Input */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={it.unit || 'pcs'}
                            onChange={(e) => handleUpdateItemUnit(idx, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-900 text-center font-medium focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* Price Input */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={formatNumberInput(it.price.toString())}
                            onChange={(e) => handleUpdateItemPrice(idx, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-900 font-mono font-bold text-right focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* Cost HPP */}
                        {!isPembelian && (
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatRupiah(pData?.costPerUnit || 0)}
                          </td>
                        )}

                        {/* Subtotal */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(it.totalPrice)}
                        </td>

                        {/* Profit */}
                        {!isPembelian && (
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                            {formatRupiah(pData?.totalProfit || 0)}
                          </td>
                        )}

                        {/* Notes Input */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={it.notes || ''}
                            onChange={(e) => handleUpdateItemNotes(idx, e.target.value)}
                            placeholder="Catatan..."
                            className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* Delete Button */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Hapus baris item ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-100/90 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-slate-700 font-medium">
                <span>Total Item: <strong className="text-slate-900">{items.length}</strong></span>
                <span>Total Volume: <strong className="text-slate-900">{totalQty} Unit</strong></span>
                {!isPembelian && (
                  <span>Total Modal: <strong className="text-slate-900 font-mono">{formatRupiah(totalCost)}</strong></span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">
                    {isPembelian && parsedShippingCost > 0 ? 'Total Pembelian + Ongkir' : 'Total Nilai Transaksi'}
                  </span>
                  <strong className={`font-mono text-base ${isPembelian ? 'text-indigo-700' : 'text-rose-700'}`}>
                    {formatRupiah(totalAmount)}
                  </strong>
                  {isPembelian && parsedShippingCost > 0 && (
                    <span className="text-[10px] text-slate-500 block">
                      Subtotal: {formatRupiah(itemsSubtotal)} • Ongkir: <span className="text-amber-700 font-bold">{formatRupiah(parsedShippingCost)}</span>
                    </span>
                  )}
                </div>

                {!isPembelian && (
                  <div className="text-right bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                    <span className="text-[10px] text-emerald-700 font-bold block">Total Laba Bersih</span>
                    <strong className="font-mono text-base text-emerald-900">
                      {formatRupiah(totalProfit)}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
