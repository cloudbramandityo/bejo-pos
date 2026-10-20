/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  Layers,
  Printer,
  Scissors,
  Tags,
  FolderEdit,
  Tag,
  Save,
  Palette,
  Cloud,
  Check,
  Image as ImageIcon,
  UploadCloud,
  DollarSign,
  AlertCircle,
  Eye,
  RefreshCw,
  Sparkles,
  HardDriveDownload,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ZoomIn
} from 'lucide-react';
import { Product, ProductCategory, ProductCategoryItem, UserRole } from '../types';
import { formatRupiah, formatNumber, formatNumberInput, parseNumber } from '../utils/formatters';
import { StoreInfo, DEFAULT_PRODUCT_CATEGORIES, isDefaultProductCategory } from '../utils/storage';
import { isDigitalPrintingProduct, isProductionSuppliesProduct, isPaketProduct } from '../utils/productFilters';
import { getMaterialStockFormula, formatStandardKemasan, formatStockDisplay } from '../utils/stockUtils';
import { StoreLogo } from './StoreLogo';
import { downloadBackupJSON } from '../utils/backupUtils';
import { ProductImageModal } from './modals/ProductImageModal';

interface InventoryScreenProps {
  products: Product[];
  productCategories?: ProductCategoryItem[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onSaveProductCategory?: (category: ProductCategoryItem) => void;
  onRenameProductCategory?: (oldIdOrName: string, updated: ProductCategoryItem) => void;
  onDeleteProductCategory?: (categoryId: string) => void;
  userRole?: UserRole;
  storeInfo?: StoreInfo;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  products,
  productCategories,
  onSaveProduct,
  onDeleteProduct,
  onSaveProductCategory,
  onRenameProductCategory,
  onDeleteProductCategory,
  userRole = 'DEVELOPER',
  storeInfo,
}) => {
  const isDeveloper = userRole === 'DEVELOPER';
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Category Management Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormColor, setCatFormColor] = useState('blue');

  // Product Form states (Multi-Tier & Categories)
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState<string>('bahan');
  const [isManualCategoryInput, setIsManualCategoryInput] = useState(false);
  const [formName, setFormName] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [formHargaKulak, setFormHargaKulak] = useState<number>(0);
  const [formHargaAgen, setFormHargaAgen] = useState<number>(0);
  const [formHargaGrosir, setFormHargaGrosir] = useState<number>(0);
  const [formHargaUmum, setFormHargaUmum] = useState<number>(0);
  const [formHargaMeterGrosir, setFormHargaMeterGrosir] = useState<number>(0);
  const [formHargaMeterUmum, setFormHargaMeterUmum] = useState<number>(0);

  // Production Supplies specific tiers
  const [formHargaPakGrosir, setFormHargaPakGrosir] = useState<number>(0);
  const [formHargaPakUmum, setFormHargaPakUmum] = useState<number>(0);
  const [formHargaEceranGrosir, setFormHargaEceranGrosir] = useState<number>(0);
  const [formHargaEceranUmum, setFormHargaEceranUmum] = useState<number>(0);

  // Paket specific tiers
  const [formHargaPaketGrosir, setFormHargaPaketGrosir] = useState<number>(0);
  const [formHargaPaketUmum, setFormHargaPaketUmum] = useState<number>(0);

  const [formPrintSaleMode, setFormPrintSaleMode] = useState<'meter' | 'lembar'>('meter');
  const [formMinStock, setFormMinStock] = useState<number>(10);
  const [formPerRollPak, setFormPerRollPak] = useState('50 meter/roll');
  const [formPerRollPakValue, setFormPerRollPakValue] = useState<number | ''>(50);
  const [formPackagingType, setFormPackagingType] = useState<'roll' | 'pak' | 'botol' | 'custom'>('roll');
  const [showCustomPackaging, setShowCustomPackaging] = useState<boolean>(false);
  const [formIsAssetToko, setFormIsAssetToko] = useState<boolean>(false);
  const [formDescription, setFormDescription] = useState('');

  // Operational inventory states
  const [formStock, setFormStock] = useState<number>(50);
  const [formStockUnit, setFormStockUnit] = useState('roll');
  const [formDimensions, setFormDimensions] = useState('');
  const [formUnit, setFormUnit] = useState<string>('roll');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  // Image Zoom / Preview Modal
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
    code?: string;
    category?: string;
    dimensions?: string;
  } | null>(null);

  // Confirmation & Feedback states
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategoryItem | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [catFormError, setCatFormError] = useState<string | null>(null);

  useEffect(() => {
    if (notificationMsg) {
      const timer = setTimeout(() => {
        setNotificationMsg(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notificationMsg]);

  // Merge available categories from props and existing products
  const categoriesList = useMemo(() => {
    const list = [...(productCategories && productCategories.length > 0 ? productCategories : DEFAULT_PRODUCT_CATEGORIES)];
    products.forEach((p) => {
      if (p.category && !list.some((c) => c.id.toLowerCase() === p.category.toLowerCase() || c.name.toLowerCase() === p.category.toLowerCase())) {
        list.push({
          id: p.category,
          name: p.category.replace(/_/g, ' '),
          color: 'slate'
        });
      }
    });
    return list;
  }, [productCategories, products]);

  // Check if current active category in form is Digital Printing
  const isCategoryDigitalPrinting = useMemo(() => {
    return isDigitalPrintingProduct(
      { category: formCategory, name: formName } as Product,
      categoriesList
    );
  }, [formCategory, formName, categoriesList]);

  // Check if current active category in form is Production Supplies
  const isCategoryProductionSupplies = useMemo(() => {
    return (
      formCategory.toLowerCase() === 'production_supplies' ||
      formCategory.toLowerCase() === 'supplies' ||
      isProductionSuppliesProduct(
        { category: formCategory, name: formName } as Product,
        categoriesList
      )
    );
  }, [formCategory, formName, categoriesList]);

  // Check if current active category in form is Paket
  const isCategoryPaket = useMemo(() => {
    return (
      formCategory.toLowerCase() === 'paket' ||
      formCategory.toLowerCase() === 'package' ||
      isPaketProduct(
        { category: formCategory, name: formName } as Product,
        categoriesList
      )
    );
  }, [formCategory, formName, categoriesList]);

  // Generate random SKU helper
  const handleGenerateSku = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setFormCode(`SKU-${randomNum}`);
  };

  // Image Upload handler
  const processImageFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setFormError('Ukuran file foto maksimal 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormCode('');
    setFormName('');
    setFormCategory(categoriesList[0]?.id || 'bahan');
    setIsManualCategoryInput(false);
    setFormImageUrl('');
    setIsUrlMode(false);
    setFormHargaKulak(0);
    setFormHargaAgen(0);
    setFormHargaGrosir(0);
    setFormHargaUmum(0);
    setFormHargaMeterGrosir(0);
    setFormHargaMeterUmum(0);
    setFormHargaPakGrosir(0);
    setFormHargaPakUmum(0);
    setFormHargaEceranGrosir(0);
    setFormHargaEceranUmum(0);
    setFormHargaPaketGrosir(0);
    setFormHargaPaketUmum(0);
    setFormPrintSaleMode('meter');
    setFormMinStock(10);
    setFormPackagingType('roll');
    setShowCustomPackaging(false);
    setFormPerRollPak('50 meter/roll');
    setFormPerRollPakValue(50);
    setFormIsAssetToko(false);
    setFormDescription('');
    setFormStock(50);
    setFormStockUnit('roll');
    setFormDimensions('');
    setFormUnit('roll');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormCode(p.code);
    setFormName(p.name);
    setFormCategory(p.category);
    setIsManualCategoryInput(false);
    setFormImageUrl(p.imageUrl || '');
    setIsUrlMode(false);
    setFormHargaKulak(p.hargaKulak ?? p.costPrice ?? 0);
    setFormHargaAgen(p.hargaAgen ?? 0);
    setFormHargaGrosir(p.hargaGrosir ?? 0);
    setFormHargaUmum(p.hargaUmum ?? p.price ?? 0);
    setFormHargaMeterGrosir(p.hargaMeterGrosir ?? 0);
    setFormHargaMeterUmum(p.hargaMeterUmum ?? 0);
    setFormHargaPakGrosir(p.hargaPakGrosir ?? 0);
    setFormHargaPakUmum(p.hargaPakUmum ?? 0);
    setFormHargaEceranGrosir(p.hargaEceranGrosir ?? 0);
    setFormHargaEceranUmum(p.hargaEceranUmum ?? 0);
    setFormHargaPaketGrosir(p.hargaPaketGrosir ?? 0);
    setFormHargaPaketUmum(p.hargaPaketUmum ?? 0);
    setFormPrintSaleMode(p.printSaleMode || (p.unit === 'lembar' ? 'lembar' : 'meter'));
    setFormMinStock(p.minStock ?? 10);
    
    // Auto-detect standard packaging formula
    const formula = getMaterialStockFormula(p);
    if (formula.isStandardBotol) {
      setFormPackagingType('botol');
      setFormPerRollPakValue(1);
      setFormPerRollPak(p.perRollPak || '1 botol/pak');
    } else if (formula.isStandardPak) {
      setFormPackagingType('pak');
      setFormPerRollPakValue(formula.qtyPerRollPak || 100);
      setFormPerRollPak(p.perRollPak || `${formula.qtyPerRollPak || 100} lembar/pak`);
    } else {
      setFormPackagingType('roll');
      setFormPerRollPakValue(formula.qtyPerRollPak || 50);
      setFormPerRollPak(p.perRollPak || `${formula.qtyPerRollPak || 50} meter/roll`);
    }
    setShowCustomPackaging(false);

    setFormIsAssetToko(!!p.isAssetToko);
    setFormDescription(p.description || '');
    setFormStock(p.stock ?? 0);
    const resolvedUnit = p.unit || p.stockUnit || (formula.isStandardBotol ? 'botol' : formula.isStandardPak ? 'pak' : 'roll');
    setFormStockUnit(resolvedUnit);
    setFormDimensions(p.dimensions || '');
    setFormUnit(resolvedUnit);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Otomatis buat kode SKU jika dikosongkan
    const finalCode = formCode.trim()
      ? formCode.trim().toUpperCase()
      : `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

    // Otomatis beri nama produk jika dikosongkan
    const finalName = formName.trim() || `Produk ${finalCode}`;

    const trimmedCat = formCategory.trim() || (categoriesList[0]?.id || 'bahan');

    // If user typed a brand new category manually, register it in the categories list
    if (onSaveProductCategory && formCategory.trim()) {
      const alreadyExists = categoriesList.some(
        (c) => c.id.toLowerCase() === trimmedCat.toLowerCase() || c.name.toLowerCase() === trimmedCat.toLowerCase()
      );
      if (!alreadyExists) {
        onSaveProductCategory({
          id: trimmedCat,
          name: trimmedCat.replace(/_/g, ' '),
          color: 'teal'
        });
      }
    }

    const numKulak = Number(formHargaKulak) || 0;
    const numUmum = Number(formHargaUmum) || 0;
    const numAgen = Number(formHargaAgen) || 0;
    const numGrosir = Number(formHargaGrosir) || 0;
    const numMeterGrosir = Number(formHargaMeterGrosir) || 0;
    const numMeterUmum = Number(formHargaMeterUmum) || 0;
    const numPakGrosir = Number(formHargaPakGrosir) || 0;
    const numPakUmum = Number(formHargaPakUmum) || 0;
    const numEceranGrosir = Number(formHargaEceranGrosir) || 0;
    const numEceranUmum = Number(formHargaEceranUmum) || 0;
    const numPaketGrosir = Number(formHargaPaketGrosir) || 0;
    const numPaketUmum = Number(formHargaPaketUmum) || 0;
    const numMinStock = Number(formMinStock) || 0;
    const numStock = Number(formStock) || 0;

    // Determine primary display selling price
    let primarySellingPrice = numUmum;
    if (isCategoryProductionSupplies) {
      primarySellingPrice = numEceranUmum || numPakUmum || numUmum;
    } else if (isCategoryPaket) {
      primarySellingPrice = numPaketUmum || numUmum;
    }

    const productData: Product = {
      id: editingProduct ? editingProduct.id : 'prod_' + Date.now(),
      code: finalCode,
      name: finalName,
      category: trimmedCat as ProductCategory,
      imageUrl: formImageUrl.trim(),
      hargaKulak: numKulak,
      hargaAgen: numAgen,
      hargaGrosir: numGrosir,
      hargaUmum: numUmum,
      hargaMeterGrosir: numMeterGrosir,
      hargaMeterUmum: numMeterUmum,
      hargaPakGrosir: numPakGrosir,
      hargaPakUmum: numPakUmum,
      hargaEceranGrosir: numEceranGrosir,
      hargaEceranUmum: numEceranUmum,
      hargaPaketGrosir: numPaketGrosir,
      hargaPaketUmum: numPaketUmum,
      minStock: numMinStock,
      perRollPak: formPerRollPak.trim(),
      perRollPakValue: formPerRollPakValue !== '' ? Number(formPerRollPakValue) : undefined,
      isAssetToko: isCategoryDigitalPrinting ? formIsAssetToko : undefined,
      description: formDescription.trim(),

      // Compatibility fields with POS and existing calculations
      dimensions: formDimensions.trim() || formPerRollPak.trim(),
      unit: formUnit.trim() || 'roll',
      printSaleMode: formPrintSaleMode,
      price: primarySellingPrice, // Synced with primary selling price
      costPrice: numKulak, // Synced with Harga Kulak
      stock: numStock,
      stockUnit: formUnit.trim() || 'roll'
    };

    onSaveProduct(productData);
    setNotificationMsg(
      editingProduct
        ? `Perubahan produk "${productData.name}" berhasil disimpan ke database cloud.`
        : `Produk baru "${productData.name}" berhasil ditambahkan ke database cloud.`
    );
    setIsModalOpen(false);
  };

  // Category modal actions
  const handleOpenCategoryModal = () => {
    setEditingCatId(null);
    setCatFormName('');
    setCatFormColor('blue');
    setCatFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleEditCategoryClick = (cat: ProductCategoryItem) => {
    if (isDefaultProductCategory(cat.id) || isDefaultProductCategory(cat.name)) {
      alert('Kategori permanen sistem tidak dapat diubah.');
      return;
    }
    setEditingCatId(cat.id);
    setCatFormName(cat.name);
    setCatFormColor(cat.color || 'blue');
    setCatFormError(null);
  };

  const handleSaveCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = catFormName.trim();
    if (!name) {
      setCatFormError('Nama kategori wajib diisi.');
      return;
    }
    setCatFormError(null);

    if (editingCatId) {
      if (isDefaultProductCategory(editingCatId) || isDefaultProductCategory(name)) {
        setCatFormError('Kategori permanen sistem tidak dapat diubah.');
        return;
      }
      // Renaming / updating existing category
      if (onRenameProductCategory) {
        onRenameProductCategory(editingCatId, {
          id: editingCatId,
          name: name,
          color: catFormColor
        });
      }
      setNotificationMsg(`Kategori "${name}" berhasil diperbarui.`);
      setEditingCatId(null);
      setCatFormName('');
    } else {
      // Adding new category
      const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const newCat: ProductCategoryItem = {
        id: slug || 'cat_' + Date.now(),
        name: name,
        color: catFormColor
      };
      if (onSaveProductCategory) {
        onSaveProductCategory(newCat);
      }
      setNotificationMsg(`Kategori "${name}" berhasil ditambahkan.`);
      setCatFormName('');
    }
  };

  const handleDeleteCategoryClick = (cat: ProductCategoryItem) => {
    if (isDefaultProductCategory(cat.id) || isDefaultProductCategory(cat.name)) {
      alert('Kategori permanen sistem tidak dapat dihapus.');
      return;
    }
    setCategoryToDelete(cat);
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesCat =
          activeCategory === 'all' ||
          p.category === activeCategory ||
          p.category.toLowerCase() === activeCategory.toLowerCase();
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.dimensions.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
      })
      .sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, {
          sensitivity: 'base',
          numeric: true
        })
      );
  }, [products, activeCategory, searchQuery]);

  const getCategoryColorClasses = (color?: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'indigo':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'sky':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'amber':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'purple':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'rose':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'teal':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getCategoryBadge = (cat: string) => {
    const matched = categoriesList.find(
      (c) => c.id.toLowerCase() === cat.toLowerCase() || c.name.toLowerCase() === cat.toLowerCase()
    );
    const label = matched ? matched.name : cat.replace(/_/g, ' ');
    const colorClass = getCategoryColorClasses(matched?.color);

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto p-3 sm:p-5 space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <StoreLogo size="lg" rounded="rounded-xl" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                INVENTORY PRODUK
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cloud Sync Aktif</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Kelola data produk & harga. Seluruh produk selalu tersedia (tanpa batasan stok) dan tersinkron otomatis ke database cloud.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDeveloper && (
            <button
              type="button"
              onClick={() => {
                try {
                  const res = downloadBackupJSON(storeInfo?.storeName);
                  setNotificationMsg(`Cadangan data offline (${res.fileName}) berhasil diunduh! Total ${res.summary.totalProducts} produk tersimpan.`);
                } catch (err) {
                  setNotificationMsg('Gagal mengunduh cadangan data.');
                }
              }}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              title="Cadangkan seluruh data POS & inventaris ke file JSON (Khusus Developer)"
            >
              <HardDriveDownload className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Backup Data (JSON)</span>
              <span className="sm:hidden">Backup</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCategoryModal}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            title="Kelola & Ubah Kategori Produk"
          >
            <Tags className="w-4 h-4 text-blue-600" />
            Kelola Kategori
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            Input Produk Baru
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeCategory === 'all'
                ? 'bg-[#1e295d] text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Produk ({products.length})
          </button>

          {categoriesList.map((cat) => {
            const count = products.filter(
              (p) => p.category === cat.id || p.category.toLowerCase() === cat.name.toLowerCase()
            ).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  activeCategory === cat.id || activeCategory === cat.name
                    ? 'bg-[#1e295d] text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode, nama, ukuran, atau kategori..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 text-center w-14">Foto</th>
                <th className="py-3.5 px-4">Kode SKU</th>
                <th className="py-3.5 px-4">Nama Produk & Jasa</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Per Roll / Pak</th>
                <th className="py-3.5 px-4 text-right">
                  {activeCategory.toLowerCase() === 'paket' ? 'Harga Paket Grosir' : 'Harga Grosir'}
                </th>
                <th className="py-3.5 px-4 text-right">Harga Kulak (Modal)</th>
                <th className="py-3.5 px-4 text-center">Status Ketersediaan</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const isPaket = isPaketProduct(product, categoriesList) || product.category.toLowerCase() === 'paket';

                  const hargaGrosirDisplay = isPaket
                    ? (product.hargaPaketGrosir && product.hargaPaketGrosir > 0
                        ? product.hargaPaketGrosir
                        : (product.hargaGrosir && product.hargaGrosir > 0
                            ? product.hargaGrosir
                            : (product.hargaUmum ?? product.price ?? 0)))
                    : (product.hargaGrosir && product.hargaGrosir > 0
                        ? product.hargaGrosir
                        : (product.hargaPaketGrosir && product.hargaPaketGrosir > 0
                            ? product.hargaPaketGrosir
                            : (product.hargaMeterGrosir && product.hargaMeterGrosir > 0
                                ? product.hargaMeterGrosir
                                : (product.hargaPakGrosir && product.hargaPakGrosir > 0
                                    ? product.hargaPakGrosir
                                    : (product.hargaUmum ?? product.price ?? 0)))));

                  const hargaKulak = product.hargaKulak ?? product.costPrice ?? 0;
                  const hargaUmum = isPaket
                    ? (product.hargaPaketUmum ?? product.hargaUmum ?? product.price ?? 0)
                    : (product.hargaUmum ?? product.price ?? 0);

                  const isZeroStock = !(isDigitalPrintingProduct(product, categoriesList) && !product.isAssetToko) && !isPaketProduct(product, categoriesList) && (product.stock ?? 0) <= 0;

                  return (
                    <tr key={product.id} className={`transition-colors ${isZeroStock ? 'bg-red-50/70 hover:bg-red-100/60' : 'hover:bg-slate-50/80'}`}>
                      {/* Foto Thumbnail */}
                      <td className="py-3 px-4 text-center">
                        {product.imageUrl ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage({
                                url: product.imageUrl!,
                                name: product.name,
                                code: product.code,
                                category: typeof product.category === 'string' ? product.category : undefined,
                                dimensions: product.dimensions
                              });
                            }}
                            className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 mx-auto shadow-2xs relative group/img cursor-pointer hover:border-slate-400 hover:shadow-xs transition-all"
                            title={`Klik untuk memperbesar foto ${product.name}`}
                          >
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                                const parent = (e.target as HTMLElement).parentElement;
                                if (parent) {
                                  const fallback = parent.querySelector('.inv-img-fallback') as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }
                              }}
                            />
                            <div className="inv-img-fallback hidden absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-0.5">
                              <ImageIcon className="w-4 h-4 text-slate-300" />
                              <span className="text-[7px] text-slate-400 font-medium">Gagal</span>
                            </div>
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <ZoomIn className="w-4 h-4 text-white drop-shadow-xs" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 mx-auto">
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                            <span className="text-[8px] font-medium text-slate-400 mt-0.5">No Foto</span>
                          </div>
                        )}
                      </td>

                      {/* Kode SKU */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        <span className={`px-2 py-1 rounded text-[11px] border ${isZeroStock ? 'bg-red-100 text-red-800 border-red-200' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                          {product.code}
                        </span>
                      </td>

                      {/* Nama Produk / Jasa & Deskripsi */}
                      <td className="py-3.5 px-4">
                        <div className={`font-bold text-xs ${isZeroStock ? 'text-red-950 font-extrabold' : 'text-slate-900'}`}>{product.name}</div>
                        {product.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{product.description}</div>
                        )}
                        {/* Multi-tier pricing summary pill for quick glance */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-mono">
                          {Boolean(hargaUmum) && (
                            <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">
                              {isPaket ? 'Paket Umum' : 'Umum'}: {formatRupiah(hargaUmum)}
                            </span>
                          )}
                          {Boolean(product.hargaAgen) && (
                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                              Agen: {formatRupiah(product.hargaAgen!)}
                            </span>
                          )}
                          {Boolean(product.hargaMeterUmum) && (
                            <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100">
                              Mtr Umum: {formatRupiah(product.hargaMeterUmum!)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Kategori */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getCategoryBadge(product.category)}
                          {isDigitalPrintingProduct(product, categoriesList) && product.isAssetToko && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Aset Toko
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Per Roll / Pak & Rumus Stok */}
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        <div className="font-semibold text-slate-800">
                          {product.perRollPak || product.dimensions || '-'}
                        </div>
                        {(() => {
                          const formula = getMaterialStockFormula(product);
                          return (
                            <div className="mt-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                💡 {formula.formulaText}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Harga Grosir / Harga Paket Grosir */}
                      <td className="py-3.5 px-4 text-right font-bold text-amber-900 font-mono text-xs">
                        {formatRupiah(hargaGrosirDisplay)}
                        <span className="text-[10px] text-slate-400 font-sans block font-normal">
                          {isPaket ? 'Harga Paket Grosir' : `/${product.unit || 'roll'}`}
                        </span>
                      </td>

                      {/* Harga Kulak */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 text-xs">
                        {formatRupiah(hargaKulak)}
                      </td>

                      {/* Status Ketersediaan */}
                      <td className="py-3.5 px-4 text-center">
                        {(isDigitalPrintingProduct(product, categoriesList) && !product.isAssetToko) || isPaketProduct(product, categoriesList) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Selalu Tersedia
                          </span>
                        ) : isZeroStock ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300 shadow-2xs">
                            <Package className="w-3.5 h-3.5 text-red-600" />
                            <span>{formatStockDisplay(product.stock, product)}</span>
                            <span className="text-[10px] text-red-800 font-extrabold uppercase">(STOK HABIS)</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                            (product.stock ?? 0) <= (product.minStock ?? 10)
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            <Package className="w-3.5 h-3.5" />
                            <span>{formatStockDisplay(product.stock, product)}</span>
                            {(product.stock ?? 0) <= (product.minStock ?? 10) && <span className="text-[10px] text-amber-600 font-semibold">(Min. Menipis)</span>}
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Produk"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                            {isDeveloper && (
                              <button
                                type="button"
                                id={`btn-delete-product-${product.id}`}
                                onClick={() => setProductToDelete(product)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Produk dari Database (Developer Only)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Tidak ada produk yang cocok dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal - INPUT DETAIL PRODUK BARU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            {/* Header Modal */}
            <div className="bg-[#1e295d] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-sky-400" />
                <h2 className="text-base font-bold tracking-tight">
                  {editingProduct ? 'EDIT DETAIL PRODUK' : 'INPUT DETAIL PRODUK BARU'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields:
                1. Kode SKU, 2. Kategori Produk, 3. Nama Produk / Jasa, 4. Foto Produk,
                5. Harga Kulak, 6. Harga Agen, 7. Harga Grosir, 8. Harga Umum,
                9. Harga Meter Grosir, 10. Harga Meter Umum, 11. Stok Minimal, 12. Per Roll / Pak, 13. Deskripsi / Keterangan */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                <span>
                  <strong>Notes:</strong> Tidak semua kolom wajib diisi. Kolom yang dikosongkan akan diisi dengan nilai default secara otomatis.
                </span>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* SECTION 1: IDENTITAS & FOTO PRODUK */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  Identitas & Kategori Produk
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Kode SKU */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Kode SKU <span className="text-[10px] text-slate-400 font-normal">(opsional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                        title="Buat SKU Acak Otomatis"
                      >
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        Auto SKU
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="misal: SKU-8846 (otomatis jika kosong)"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 2. Kategori Produk */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Kategori Produk <span className="text-[10px] text-slate-400 font-normal">(opsional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsManualCategoryInput(!isManualCategoryInput)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FolderEdit className="w-3 h-3" />
                        {isManualCategoryInput ? 'Pilih dari Daftar' : '+ Ketik Manual'}
                      </button>
                    </div>

                    {isManualCategoryInput ? (
                      <div>
                        <input
                          type="text"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          placeholder="Ketik kategori: Akrilik, Banner, DTF..."
                          className="w-full bg-blue-50/70 border border-blue-300 rounded-xl px-3 py-2 text-xs font-bold text-blue-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <select
                        value={formCategory}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsManualCategoryInput(true);
                            setFormCategory('');
                          } else {
                            setFormCategory(e.target.value);
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      >
                        {categoriesList.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                        <option value="__custom__">+ Ketik Kategori Baru / Manual...</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Checklist Aset Toko (Khusus Digital Printing) */}
                {isCategoryDigitalPrinting && (
                  <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl flex items-start gap-2.5 animate-in slide-in-from-top-1 duration-150">
                    <input
                      type="checkbox"
                      id="checkbox-is-asset-toko"
                      checked={formIsAssetToko}
                      onChange={(e) => setFormIsAssetToko(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5 cursor-pointer"
                    />
                    <label htmlFor="checkbox-is-asset-toko" className="cursor-pointer select-none">
                      <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                        <span>Aset Toko</span>
                        <span className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.2 rounded font-semibold font-sans">
                          Khusus Digital Printing
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-700/90 mt-0.5 leading-relaxed font-medium">
                        Secara default stok Digital Printing <strong>Selalu Tersedia</strong>. Centang opsi ini jika produk ingin diinput stok manual dan dihitung ke dalam <strong>Total Aset Toko</strong>.
                      </p>
                    </label>
                  </div>
                )}

                {/* 3. Nama Produk / Jasa */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Produk / Jasa <span className="text-[10px] text-slate-400 font-normal">(opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="misal: Laser Putih GL DECOFIX (otomatis jika kosong)"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                  />
                </div>

                {/* 4. Foto Produk (Upload / Drag & Drop / URL) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Foto Produk
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsUrlMode(!isUrlMode)}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {isUrlMode ? 'Gunakan Upload File' : 'Gunakan Link URL'}
                    </button>
                  </div>

                  {formImageUrl ? (
                    <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200">
                      <div
                        onClick={() => setPreviewImage({
                          url: formImageUrl,
                          name: formName || 'Preview Foto Produk',
                          code: formCode || undefined,
                          category: formCategory || undefined
                        })}
                        className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0 relative group cursor-pointer shadow-2xs hover:border-slate-400 transition-all"
                        title="Klik untuk melihat resolusi penuh"
                      >
                        <img
                          src={formImageUrl}
                          alt="Preview Produk"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-4 h-4 text-white drop-shadow-xs" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">Foto Produk Terpasang</div>
                        <div className="text-[10px] text-slate-400 truncate">Klik thumbnail untuk perbesar foto</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormImageUrl('')}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus
                      </button>
                    </div>
                  ) : isUrlMode ? (
                    <input
                      type="url"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://example.com/foto-produk.jpg"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingPhoto(true);
                      }}
                      onDragLeave={() => setIsDraggingPhoto(false)}
                      onDrop={handlePhotoDrop}
                      className={`border-2 border-dashed rounded-xl p-3 text-center transition-colors cursor-pointer ${
                        isDraggingPhoto
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-slate-300 hover:border-slate-400 bg-white'
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        id="product-photo-upload"
                        onChange={handlePhotoFileChange}
                        className="hidden"
                      />
                      <label htmlFor="product-photo-upload" className="cursor-pointer flex flex-col items-center gap-1">
                        <UploadCloud className="w-6 h-6 text-slate-400" />
                        <span className="text-xs font-semibold text-blue-600 hover:underline">
                          Pilih foto atau tarik ke sini
                        </span>
                        <span className="text-[10px] text-slate-400">
                          PNG, JPG, WebP (Maks. 2MB)
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 13. Deskripsi / Keterangan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deskripsi / Keterangan
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Keterangan bahan, daya rekat lem, spesifikasi warna atau catatan cetak"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* SECTION 2: STRUKTUR HARGA JUAL & MODAL (MULTI-TIER PRICING) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    Struktur Harga Jual (Multi-Tier)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Format Rupiah (Rp)</span>
                </div>

                {isCategoryProductionSupplies ? (
                  /* Format Khusus: Production Supplies */
                  <div className="space-y-3">
                    <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-2.5 text-[11px] text-purple-800 flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Format Harga Khusus Kategori <strong>Production Supplies</strong>.</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. Harga Kulak (HPP Modal) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Kulak (HPP Modal)
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Modal beli dari supplier / distributor</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaKulak ? formatNumber(formHargaKulak) : ''}
                            onChange={(e) => setFormHargaKulak(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      {/* 2. Harga Agen */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Agen
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif khusus mitra reseller / agen</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaAgen ? formatNumber(formHargaAgen) : ''}
                            onChange={(e) => setFormHargaAgen(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      {/* 3. Harga per Pak Grosir */}
                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-0.5">
                          Harga per Pak Grosir
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif 1 pak untuk pelanggan grosir</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-purple-500 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaPakGrosir ? formatNumber(formHargaPakGrosir) : ''}
                            onChange={(e) => setFormHargaPakGrosir(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-purple-200 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-purple-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      {/* 4. Harga per Pak Umum */}
                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-0.5">
                          Harga per Pak Umum
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif 1 pak untuk pelanggan umum/retail</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-purple-500 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaPakUmum ? formatNumber(formHargaPakUmum) : ''}
                            onChange={(e) => setFormHargaPakUmum(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-purple-200 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-purple-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      {/* 5. Harga Eceran Grosir */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Eceran Grosir
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif per satuan/pcs untuk pelanggan grosir</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaEceranGrosir ? formatNumber(formHargaEceranGrosir) : ''}
                            onChange={(e) => setFormHargaEceranGrosir(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      {/* 6. Harga Eceran Umum */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Eceran Umum
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif per satuan/pcs untuk pelanggan umum</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaEceranUmum ? formatNumber(formHargaEceranUmum) : ''}
                            onChange={(e) => setFormHargaEceranUmum(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : isCategoryPaket ? (
                  /* Format Khusus: Paket */
                  <div className="space-y-3">
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Format Harga Khusus Kategori <strong>Paket</strong>.</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. Harga Kulak (HPP Modal) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Kulak (HPP Modal)
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Modal beli dari supplier / distributor</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaKulak ? formatNumber(formHargaKulak) : ''}
                            onChange={(e) => setFormHargaKulak(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* 2. Harga Agen */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Agen
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif khusus mitra reseller / agen</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaAgen ? formatNumber(formHargaAgen) : ''}
                            onChange={(e) => setFormHargaAgen(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* 3. Harga Paket Grosir */}
                      <div>
                        <label className="block text-xs font-bold text-amber-900 mb-0.5">
                          Harga Paket Grosir
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif per paket untuk pelanggan grosir</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-amber-500 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaPaketGrosir ? formatNumber(formHargaPaketGrosir) : ''}
                            onChange={(e) => setFormHargaPaketGrosir(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-amber-200 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-amber-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* 4. Harga Paket Umum */}
                      <div>
                        <label className="block text-xs font-bold text-amber-900 mb-0.5">
                          Harga Paket Umum
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif per paket untuk pelanggan umum/retail</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-amber-500 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaPaketUmum ? formatNumber(formHargaPaketUmum) : ''}
                            onChange={(e) => setFormHargaPaketUmum(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-amber-200 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-amber-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Format Standar (Bahan, Stiker Vinyl, Digital Printing, Laser Cutting, Kategori Kustom) */
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. Harga Kulak */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Kulak (HPP Modal)
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Modal beli dari supplier / distributor</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaKulak ? formatNumber(formHargaKulak) : ''}
                            onChange={(e) => setFormHargaKulak(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* 2. Harga Agen */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Agen
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif khusus mitra reseller / agen</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaAgen ? formatNumber(formHargaAgen) : ''}
                            onChange={(e) => setFormHargaAgen(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* 3. Harga Grosir */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Grosir
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Tarif pembelian partai banyak</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaGrosir ? formatNumber(formHargaGrosir) : ''}
                            onChange={(e) => setFormHargaGrosir(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* 4. Harga Umum */}
                      <div>
                        <label className="block text-xs font-bold text-blue-900 mb-0.5">
                          Harga Umum (Retail) <span className="text-[10px] text-slate-400 font-normal">(opsional)</span>
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Harga eceran umum ke pelanggan</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-blue-500 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaUmum ? formatNumber(formHargaUmum) : ''}
                            onChange={(e) => setFormHargaUmum(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-blue-50/40 border border-blue-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-blue-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* 5. Harga Meter Grosir */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Meter Grosir
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Per meter untuk pembelian grosir</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaMeterGrosir ? formatNumber(formHargaMeterGrosir) : ''}
                            onChange={(e) => setFormHargaMeterGrosir(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* 6. Harga Meter Umum */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Harga Meter Umum
                        </label>
                        <span className="text-[10px] text-slate-400 block mb-1">Per meter untuk retail biasa</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formHargaMeterUmum ? formatNumber(formHargaMeterUmum) : ''}
                            onChange={(e) => setFormHargaMeterUmum(parseNumber(formatNumberInput(e.target.value)))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Button METER dan LEMBAR (Khusus Digital Printing) */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 mt-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-800">
                          Tipe Penjualan Cetak (POS Penjualan Cetak)
                        </label>
                        {isCategoryDigitalPrinting ? (
                          <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full border border-sky-200 flex items-center gap-1">
                            <Check className="w-3 h-3 text-sky-600" />
                            Kategori: Digital Printing
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            (Aturan khusus Kategori Digital Printing)
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Kategori khusus di menu <strong>TAMBAH PENJUALAN CETAK</strong>:
                      </p>

                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          id="btn-inventory-mode-meter"
                          onClick={() => {
                            setFormPrintSaleMode('meter');
                            if (formUnit === 'lembar') setFormUnit('meter');
                          }}
                          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            formPrintSaleMode === 'meter'
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${formPrintSaleMode === 'meter' ? 'bg-white' : 'bg-slate-400'}`}></span>
                          METER
                        </button>

                        <button
                          type="button"
                          id="btn-inventory-mode-lembar"
                          onClick={() => {
                            setFormPrintSaleMode('lembar');
                            if (formUnit === 'meter') setFormUnit('lembar');
                          }}
                          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            formPrintSaleMode === 'lembar'
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${formPrintSaleMode === 'lembar' ? 'bg-white' : 'bg-slate-400'}`}></span>
                          LEMBAR
                        </button>
                      </div>

                      <div className="text-[10.5px] text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-start gap-1.5">
                        <span className="font-bold text-blue-700 shrink-0">• Aturan:</span>
                        <span>
                          {formPrintSaleMode === 'meter'
                            ? 'Ketika button METER dipilih, produk secara otomatis hanya muncul di TAMBAH PENJUALAN CETAK – Penjualan per Meter.'
                            : 'Ketika button LEMBAR dipilih, produk secara otomatis hanya muncul di TAMBAH PENJUALAN CETAK – Penjualan per Lembar.'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: KEMASAN & RUMUS STOK PRODUK (MODEL SIMPEL 2-LANGKAH) */}
              <div className="border border-purple-200/80 rounded-2xl p-4 bg-gradient-to-b from-purple-50/40 via-white to-purple-50/20 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-purple-600 text-white rounded-lg shadow-2xs">
                      <Package className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-950">
                        Bentuk Kemasan & Rumus Stok
                      </h4>
                      <p className="text-[10.5px] text-slate-500">
                        Pilih jenis kemasan & isi. Rumus, satuan stok, dan teks kemasan diatur 100% otomatis.
                      </p>
                    </div>
                  </div>
                  {isCategoryDigitalPrinting && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Selalu Tersedia
                    </span>
                  )}
                </div>

                {/* LANGKAH 1: Pilih Jenis Kemasan Utama */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase text-slate-600 tracking-wide">
                    1. Pilih Bentuk Kemasan
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Option 1: ROLL */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormPackagingType('roll');
                        const qty = formPerRollPakValue && Number(formPerRollPakValue) > 0 ? Number(formPerRollPakValue) : 50;
                        setFormPerRollPakValue(qty);
                        setFormUnit('roll');
                        setFormStockUnit('roll');
                        setFormPerRollPak(`${qty} meter/roll`);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formPackagingType === 'roll'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-400/30'
                          : 'bg-white hover:bg-purple-50/50 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base">🌀</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          formPackagingType === 'roll' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          meter
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-black">Roll (Gulungan)</div>
                        <div className={`text-[10px] ${formPackagingType === 'roll' ? 'text-purple-100' : 'text-slate-400'}`}>
                          Isi per meter
                        </div>
                      </div>
                    </button>

                    {/* Option 2: PAK */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormPackagingType('pak');
                        const qty = formPerRollPakValue && Number(formPerRollPakValue) > 0 ? Number(formPerRollPakValue) : 100;
                        setFormPerRollPakValue(qty);
                        setFormUnit('pak');
                        setFormStockUnit('pak');
                        setFormPerRollPak(`${qty} lembar/pak`);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formPackagingType === 'pak'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-400/30'
                          : 'bg-white hover:bg-purple-50/50 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base">📦</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          formPackagingType === 'pak' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          lembar
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-black">Pak (Lembaran)</div>
                        <div className={`text-[10px] ${formPackagingType === 'pak' ? 'text-purple-100' : 'text-slate-400'}`}>
                          Isi per lembar
                        </div>
                      </div>
                    </button>

                    {/* Option 3: BOTOL */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormPackagingType('botol');
                        setFormPerRollPakValue(1);
                        setFormUnit('botol');
                        setFormStockUnit('botol');
                        setFormPerRollPak('1 botol/pak');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formPackagingType === 'botol'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-400/30'
                          : 'bg-white hover:bg-purple-50/50 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base">🍾</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          formPackagingType === 'botol' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          botol
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-black">Botol (Satuan)</div>
                        <div className={`text-[10px] ${formPackagingType === 'botol' ? 'text-purple-100' : 'text-slate-400'}`}>
                          1 botol/pak
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* LANGKAH 2: Isi per Kemasan (Single Clean Input) */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase text-slate-600 tracking-wide">
                    2. Jumlah Isi per Kemasan
                  </label>

                  {formPackagingType === 'roll' && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="1"
                          value={formPerRollPakValue}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : '';
                            setFormPerRollPakValue(val);
                            if (val && typeof val === 'number') {
                              setFormPerRollPak(`${val} meter/roll`);
                            }
                          }}
                          placeholder="misal: 50"
                          className="w-full bg-white border border-slate-300 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 focus:outline-hidden focus:ring-3 focus:ring-purple-400/20"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          meter per roll
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[17, 20, 45, 50, 100].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setFormPerRollPakValue(preset);
                              setFormPerRollPak(`${preset} meter/roll`);
                            }}
                            className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              formPerRollPakValue === preset
                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {preset}m
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {formPackagingType === 'pak' && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="1"
                          value={formPerRollPakValue}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : '';
                            setFormPerRollPakValue(val);
                            if (val && typeof val === 'number') {
                              setFormPerRollPak(`${val} lembar/pak`);
                            }
                          }}
                          placeholder="misal: 100"
                          className="w-full bg-white border border-slate-300 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 focus:outline-hidden focus:ring-3 focus:ring-purple-400/20"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          lembar per pak
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[50, 100, 250, 500].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setFormPerRollPakValue(preset);
                              setFormPerRollPak(`${preset} lembar/pak`);
                            }}
                            className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              formPerRollPakValue === preset
                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {preset} lbr
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {formPackagingType === 'botol' && (
                    <div className="p-3 bg-white border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Kemasan Botol Standar Toko:</span>
                      <span className="bg-purple-100 text-purple-800 font-bold px-2.5 py-1 rounded-lg">
                        1 botol per pak (1 unit)
                      </span>
                    </div>
                  )}
                </div>

                {/* LIVE FORMULA AUTO-DERIVED PREVIEW */}
                {(() => {
                  const formula = getMaterialStockFormula({
                    unit: formUnit,
                    perRollPak: formPerRollPak,
                    perRollPakValue: formPerRollPakValue !== '' ? Number(formPerRollPakValue) : undefined
                  });

                  return (
                    <div className="p-3 bg-purple-900 text-white rounded-xl shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-black flex items-center gap-1.5 text-purple-200 uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                          Rumus Stok Terbentuk:
                        </span>
                        <span className="bg-purple-700/80 text-purple-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          Otomatis
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 font-mono text-xs">
                        <div className="font-black text-yellow-300 text-sm">
                          Maka {formula.formulaText}
                        </div>
                        <div className="text-[11px] text-purple-200 flex items-center gap-2">
                          <span>Kemasan: <strong>{formPerRollPak || formula.kemasanText}</strong></span>
                          <span>•</span>
                          <span>Satuan: <strong>{formUnit || formula.unit}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ACCORDION: OPSI KUSTOM / SATUAN KHUSUS (TERSEMBUNYI RAPI) */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCustomPackaging(!showCustomPackaging)}
                    className="w-full flex items-center justify-between py-1.5 px-3 rounded-lg text-[11px] font-bold text-slate-500 hover:text-purple-700 hover:bg-purple-50/50 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>⚙️ Pengaturan Satuan Kustom / Manual (Opsional)</span>
                    </span>
                    {showCustomPackaging ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showCustomPackaging && (
                    <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl space-y-3">
                      <p className="text-[10.5px] text-slate-500">
                        Ubah kolom teks di bawah ini hanya jika produk Anda menggunakan satuan selain Roll, Pak, atau Botol (misal: <em>rim, pcs, kaleng, set</em>).
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                            Teks Keterangan Kemasan Manual
                          </label>
                          <input
                            type="text"
                            value={formPerRollPak}
                            onChange={(e) => setFormPerRollPak(e.target.value)}
                            placeholder="misal: 500 lembar/rim"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                            Satuan Utama Manual
                          </label>
                          <input
                            type="text"
                            value={formUnit}
                            onChange={(e) => {
                              setFormUnit(e.target.value);
                              setFormStockUnit(e.target.value);
                            }}
                            placeholder="misal: rim, pcs, dus"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 4: MANAJEMEN STOK & BATAS MINIMUM (Aktif saat ONLINE) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    Manajemen Stok & Batas Minimum
                  </span>
                  <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold">
                    Toko Aktif
                  </span>
                </div>

                {(isCategoryDigitalPrinting && !formIsAssetToko) || isCategoryPaket ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-emerald-900">
                          Stok Selalu Tersedia {isCategoryPaket ? '(Kategori Paket)' : '(Default Digital Printing)'}
                        </div>
                        <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                          {isCategoryPaket ? (
                            <span>Produk kategori <strong>Paket</strong> berstatus <strong>Selalu Tersedia</strong> dan tidak masuk dalam perhitungan Total Aset Toko.</span>
                          ) : (
                            <span>Produk kategori <strong>Digital Printing</strong> secara default berstatus <strong>Selalu Tersedia</strong> dan tidak memerlukan input stok manual.</span>
                          )}
                        </p>
                        {!isCategoryPaket && (
                          <p className="text-[10px] text-emerald-700 font-medium pt-0.5">
                            💡 Jika produk ini merupakan persediaan/bahan baku fisik yang perlu dihitung stoknya dan dimasukkan ke dalam <strong>Total Aset Toko</strong>, silakan centang opsi <strong>Aset Toko</strong> di atas.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Live Preview Status Ketersediaan */}
                    <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-emerald-600" />
                        <span className="font-semibold text-emerald-950">
                          Status Ketersediaan Produk:
                        </span>
                      </div>
                      <span className="font-bold text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg shadow-2xs flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        Selalu Tersedia
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {isCategoryDigitalPrinting && formIsAssetToko && (
                      <div className="p-2.5 bg-blue-50/90 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2 font-medium">
                        <Package className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          <strong>Opsi Aset Toko Aktif:</strong> Stok produk ini dapat diinput secara manual dan dihitung ke dalam kalkulasi <strong>Total Aset Toko</strong>.
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Jumlah Stok Awal ({formUnit.trim() || 'roll'})
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formStock}
                            onChange={(e) => setFormStock(parseFloat(e.target.value) || 0)}
                            placeholder="50"
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500 pr-16"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold pointer-events-none">
                            {formUnit.trim() || 'roll'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Batas Minimum Stok ({formUnit.trim() || 'roll'})
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formMinStock}
                            onChange={(e) => setFormMinStock(parseFloat(e.target.value) || 0)}
                            placeholder="10"
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500 pr-16"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold pointer-events-none">
                            {formUnit.trim() || 'roll'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Live Preview Status Ketersediaan */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-blue-900">
                          Status Ketersediaan Produk:
                        </span>
                      </div>
                      <span className="font-mono font-bold text-xs bg-blue-600 text-white px-3 py-1 rounded-lg shadow-2xs">
                        {formStock} {formUnit.trim() || 'roll'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-sky-400" />
                  {editingProduct ? 'Simpan Perubahan' : 'Simpan ke Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-[#1e295d] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tags className="w-5 h-5 text-sky-400" />
                <h2 className="text-base font-bold tracking-tight">
                  KELOLA KATEGORI PRODUK
                </h2>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Add / Edit Category Form */}
              <form onSubmit={handleSaveCategorySubmit} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FolderEdit className="w-3.5 h-3.5 text-blue-600" />
                    {editingCatId ? 'Ubah Nama Kategori' : 'Tambah Kategori Baru'}
                  </span>
                  {editingCatId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(null);
                        setCatFormName('');
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-700 underline font-medium"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>

                {catFormError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{catFormError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nama Kategori
                  </label>
                  <input
                    type="text"
                    value={catFormName}
                    onChange={(e) => setCatFormName(e.target.value)}
                    placeholder="misal: Akrilik Lembaran, Banner Outdoor, DTF Print..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {editingCatId && (
                    <span className="text-[10px] text-blue-700 mt-1 block">
                      Mengubah nama kategori ini akan otomatis memperbarui semua produk yang terkait.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Pilihan Warna Label
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'blue', label: 'Biru', bg: 'bg-blue-500' },
                      { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
                      { id: 'sky', label: 'Sky', bg: 'bg-sky-500' },
                      { id: 'emerald', label: 'Hijau', bg: 'bg-emerald-500' },
                      { id: 'amber', label: 'Amber', bg: 'bg-amber-500' },
                      { id: 'purple', label: 'Ungu', bg: 'bg-purple-500' },
                      { id: 'rose', label: 'Merah', bg: 'bg-rose-500' },
                      { id: 'teal', label: 'Teal', bg: 'bg-teal-500' },
                    ].map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setCatFormColor(col.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 transition-all ${col.bg} ${
                          catFormColor === col.id ? 'ring-2 ring-offset-1 ring-slate-800 scale-105' : 'opacity-80 hover:opacity-100'
                        }`}
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingCatId ? 'Simpan Perubahan Kategori' : 'Tambah Kategori'}
                  </button>
                </div>
              </form>

              {/* List of Existing Categories */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Daftar Kategori ({categoriesList.length})</span>
                  <span className="text-[11px] font-normal text-slate-500">Klik icon pensil untuk ubah nama</span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {categoriesList.map((cat) => {
                    const isDefault = isDefaultProductCategory(cat.id) || isDefaultProductCategory(cat.name);
                    const count = products.filter(
                      (p) => p.category === cat.id || p.category.toLowerCase() === cat.name.toLowerCase()
                    ).length;
                    return (
                      <div key={cat.id} className="p-3 bg-white flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          {getCategoryBadge(cat.id)}
                          {isDefault && (
                            <span className="text-[9.5px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold border border-slate-200 flex items-center gap-1">
                              Default Sistem
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-slate-500 font-mono">
                            {count} produk
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {isDefault ? (
                            <span
                              className="p-1.5 text-slate-300 cursor-not-allowed"
                              title="Kategori permanen sistem tidak dapat diubah"
                            >
                              <Edit2 className="w-3.5 h-3.5 opacity-40" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEditCategoryClick(cat)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Ubah Nama Kategori"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isDefault ? (
                            <span
                              className="p-1.5 text-slate-300 cursor-not-allowed"
                              title="Kategori permanen sistem tidak dapat dihapus"
                            >
                              <Trash2 className="w-3.5 h-3.5 opacity-40" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteCategoryClick(cat)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Kategori"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Produk (Bebas dari hambatan iframe confirm) */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-red-50 p-6 flex items-start gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Hapus Produk dari Database?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin menghapus produk{' '}
                  <span className="font-bold text-slate-900">"{productToDelete.name}"</span> (Kode:{' '}
                  <span className="font-mono font-bold text-slate-800">{productToDelete.code}</span>)?
                </p>
                <div className="mt-3 p-2.5 bg-red-100/70 border border-red-200 rounded-xl text-[11px] text-red-800 font-medium">
                  Produk akan dihapus permanen dari inventori dan langsung terupdate di cloud database Firestore.
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-delete-product"
                onClick={() => {
                  onDeleteProduct(productToDelete.id);
                  setNotificationMsg(`Produk "${productToDelete.name}" berhasil dihapus dari database.`);
                  setProductToDelete(null);
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Produk</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Kategori */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-amber-50 p-6 flex items-start gap-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Hapus Kategori "{categoryToDelete.name}"?
                </h3>
                {(() => {
                  const count = products.filter(
                    (p) => p.category === categoryToDelete.id || p.category.toLowerCase() === categoryToDelete.name.toLowerCase()
                  ).length;
                  return count > 0 ? (
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Perhatian: Ada <span className="font-bold">{count} produk</span> yang saat ini menggunakan kategori ini. Tetap hapus kategori ini?
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Kategori ini akan dihapus dari daftar kategori produk.
                    </p>
                  );
                })()}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-delete-category"
                onClick={() => {
                  if (onDeleteProductCategory) {
                    onDeleteProductCategory(categoryToDelete.id);
                  }
                  setNotificationMsg(`Kategori "${categoryToDelete.name}" berhasil dihapus.`);
                  setCategoryToDelete(null);
                }}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Hapus Kategori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {notificationMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 text-xs font-medium animate-in slide-in-from-bottom duration-200">
          <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg">
            <CheckCircle className="w-4 h-4" />
          </div>
          <span>{notificationMsg}</span>
          <button
            type="button"
            onClick={() => setNotificationMsg(null)}
            className="ml-2 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modal Zoom / Preview Foto Produk Interaktif */}
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
