/**
 * BEJO Digital Print
 * Marketing Module — Shopee Discovery Ads (Shopee Open Platform API)
 * Coded by Langgo Bramandityo.
 */
import React, { useState } from 'react';
import {
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Send,
  Link2,
  Search,
  Package,
  ToggleLeft,
  ToggleRight,
  X,
  Coins,
  Tag,
  Eye,
  Star,
  Truck,
  Ticket,
  Heart,
  Share2,
  Home,
  Bell,
  User,
  MessageCircle,
  Zap,
  BadgeCheck,
  DollarSign,
  Video,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type BudgetMode = 'UNLIMITED' | 'FIXED';
type BidMode = 'AUTO' | 'MANUAL';

interface BusinessAccount {
  shopeeSellerId: string;
  shopeeAdsBalance: number;
  connected: boolean;
  simulated: boolean;
}

interface ShopeeProduct {
  itemId: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
}

interface CampaignForm {
  adName: string;
  budgetMode: BudgetMode;
  dailyBudget: number;
  totalBudget: number;
  bidMode: BidMode;
  manualBid: number;
  keywords: string;
  placements: {
    homeRecommendation: boolean;
    productDetail: boolean;
  };
  selectedProduct: ShopeeProduct | null;
}

const DEFAULT_FORM: CampaignForm = {
  adName: '',
  budgetMode: 'UNLIMITED',
  dailyBudget: 50000,
  totalBudget: 0,
  bidMode: 'AUTO',
  manualBid: 500,
  keywords: '',
  placements: {
    homeRecommendation: true,
    productDetail: true,
  },
  selectedProduct: null,
};

const MOCK_PRODUCTS: ShopeeProduct[] = [
  { itemId: '1001', name: 'Stiker Vinyl Glossy A3 (100 lembar)', price: 85000, imageUrl: '', stock: 250 },
  { itemId: '1002', name: 'Stiker Cutting Reflective (per meter)', price: 45000, imageUrl: '', stock: 500 },
  { itemId: '1003', name: 'Laminasi UV Glossy Roll 1.26m', price: 320000, imageUrl: '', stock: 30 },
  { itemId: '1004', name: 'Tinta Sublimation 100ml (4 warna)', price: 120000, imageUrl: '', stock: 80 },
];

const SHOPEE_STEPS = [
  { n: 1, label: 'Akun Toko' },
  { n: 2, label: 'Produk' },
  { n: 3, label: 'Anggaran & Bid' },
  { n: 4, label: 'Penempatan' },
  { n: 5, label: 'Tinjau' },
];

const formatRupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`;

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */
export const ShopeeDiscoveryAds: React.FC = () => {
  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState<BusinessAccount>({
    shopeeSellerId: '',
    shopeeAdsBalance: 0,
    connected: false,
    simulated: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [form, setForm] = useState<CampaignForm>(DEFAULT_FORM);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [publishMessage, setPublishMessage] = useState('');
  const [products, setProducts] = useState<ShopeeProduct[]>(MOCK_PRODUCTS);
  const [productsSimulated, setProductsSimulated] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');

  const totalSteps = 5;

  const loadProducts = async (shopId: string) => {
    if (!shopId.trim()) return;
    setProductsLoading(true);
    setProductsError('');
    try {
      const res = await fetch(
        `/api/marketing/shopee-discovery-ads/products?shopeeSellerId=${encodeURIComponent(shopId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat produk Shopee.');
      const remote = Array.isArray(data.products) ? (data.products as ShopeeProduct[]) : [];
      if (remote.length) {
        setProducts(remote);
        setProductsSimulated(Boolean(data.simulated));
      } else if (data.simulated) {
        setProducts(MOCK_PRODUCTS);
        setProductsSimulated(true);
      } else {
        setProducts([]);
        setProductsSimulated(false);
        setProductsError('Belum ada produk aktif di toko Shopee.');
      }
    } catch (err: any) {
      setProducts(MOCK_PRODUCTS);
      setProductsSimulated(true);
      setProductsError(`${err?.message || 'Gagal memuat produk Shopee.'} Menampilkan produk contoh.`);
    } finally {
      setProductsLoading(false);
    }
  };

  /* ---- Step 1: Business Account Setup ---- */
  const handleConnect = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch('/api/marketing/shopee-discovery-ads/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopeeSellerId: business.shopeeSellerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal menghubungkan.');
      setBusiness((prev) => ({
        ...prev,
        connected: true,
        simulated: Boolean(data.simulated),
        shopeeAdsBalance: data?.balance ?? 0,
      }));
      void loadProducts(business.shopeeSellerId);
    } catch (err: any) {
      setConnectError(err?.message || 'Terjadi kesalahan saat menghubungkan.');
      setBusiness((prev) => ({ ...prev, connected: false, simulated: false }));
    } finally {
      setConnecting(false);
    }
  };

  const handleBusinessField = (key: keyof BusinessAccount, value: string) => {
    setBusiness((prev) => ({ ...prev, [key]: value, connected: false, simulated: false }));
  };

  /* ---- Step 2 helpers ---- */
  const setField = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectProduct = (p: ShopeeProduct) => {
    setField('selectedProduct', p);
    setProductModalOpen(false);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  /* ---- Step 5: Publish ---- */
  const handlePublish = async () => {
    if (!business.connected) {
      setPublishStatus('error');
      setPublishMessage('Hubungkan akun toko Shopee terlebih dahulu (Step 1).');
      return;
    }
    if (!form.selectedProduct) {
      setPublishStatus('error');
      setPublishMessage('Pilih produk yang akan diiklankan (Step 2).');
      return;
    }
    setPublishing(true);
    setPublishStatus('idle');
    try {
      const payload = {
        business: business,
        campaign: {
          adName: form.adName,
          budgetMode: form.budgetMode,
          dailyBudget: form.dailyBudget,
          totalBudget: form.totalBudget,
        },
        bidding: {
          bidMode: form.bidMode,
          manualBid: form.manualBid,
          keywords: form.keywords
            .split(',')
            .map((keyword) => keyword.trim())
            .filter(Boolean),
          placements: form.placements,
        },
        product: form.selectedProduct,
      };

      const res = await fetch('/api/marketing/shopee-discovery-ads/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal menerbitkan iklan.');

      const warnings =
        Array.isArray(data.warnings) && data.warnings.length ? ` Catatan: ${data.warnings.join(' ')}` : '';
      setPublishStatus('success');
      setPublishMessage(
        `${data.message || 'Iklan Shopee berhasil diaktifkan.'}${
          data.adId ? ` Ad ID: ${data.adId}.` : ''
        }${warnings}`
      );
      setStep(1);
      setForm(DEFAULT_FORM);
    } catch (err: any) {
      setPublishStatus('error');
      setPublishMessage(err?.message || 'Terjadi kesalahan saat menerbitkan iklan.');
    } finally {
      setPublishing(false);
    }
  };

  const canGoNext = (): boolean => {
    switch (step) {
      case 1: return business.connected;
      case 2: return form.adName.trim().length > 0 && !!form.selectedProduct;
      case 3:
        return form.bidMode === 'AUTO'
          ? true
          : form.manualBid > 0 && form.keywords.split(',').some((keyword) => keyword.trim().length > 0);
      case 4: return true;
      default: return true;
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {publishStatus !== 'idle' && (
        <div className={`rounded-lg px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
          publishStatus === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {publishStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {publishMessage}
          <button type="button" onClick={() => setPublishStatus('idle')} className="ml-auto cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Shopee Ads shell */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#F5F5F5] shadow-xs">
        <div className="bg-[#EE4D2D] px-4 py-3 text-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/15">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold">Shopee Ads</span>
                <span className="hidden text-[11px] text-white/50 sm:inline">|</span>
                <span className="hidden text-[11px] text-white/85 sm:inline">Discovery Ads</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-semibold">
                <span className={`h-1.5 w-1.5 rounded-full ${business.connected ? 'bg-emerald-300' : 'bg-white/50'}`} />
                {business.connected
                  ? business.simulated
                    ? 'Toko terhubung · simulasi'
                    : 'Toko terhubung'
                  : 'Belum terhubung'}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold">Draf</span>
            </div>
          </div>
        </div>

        {/* Native step tabs */}
        <div className="border-b border-slate-200 bg-white px-1 sm:px-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {SHOPEE_STEPS.map((s) => {
              const active = step === s.n;
              const done = step > s.n;
              return (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => done && setStep(s.n)}
                  disabled={s.n > step}
                  className={`relative flex shrink-0 items-center gap-2 px-3 py-3 text-xs font-bold transition-colors ${
                    active
                      ? 'text-[#EE4D2D]'
                      : done
                      ? 'cursor-pointer text-slate-700 hover:text-[#EE4D2D]'
                      : 'cursor-not-allowed text-slate-400'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                      active
                        ? 'bg-[#EE4D2D] text-white'
                        : done
                        ? 'bg-[#FFF0EC] text-[#EE4D2D]'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3 w-3" /> : s.n}
                  </span>
                  {s.label}
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#EE4D2D]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Native two-column workspace */}
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            {step === 1 && (
              <ShopeeBusinessSetup
                business={business}
                connecting={connecting}
                connectError={connectError}
                onConnect={handleConnect}
                onChange={handleBusinessField}
              />
            )}
            {step === 2 && (
              <ShopeeCampaignSetup
                form={form}
                setField={setField}
                onOpenProductModal={() => setProductModalOpen(true)}
              />
            )}
            {step === 3 && (
              <ShopeeBudgetBidding form={form} setField={setField} />
            )}
            {step === 4 && (
              <ShopeePlacement form={form} setField={setField} simulated={productsSimulated} />
            )}
            {step === 5 && (
              <ShopeePublishReview business={business} form={form} publishing={publishing} onPublish={handlePublish} />
            )}
          </div>

          <div className="h-fit rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900">Pratinjau iklan</h3>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">Discovery</span>
            </div>
            <ShopeeLivePreview form={form} />
          </div>
        </div>

        {/* Manager footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-3.5 py-2 rounded-md text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Sebelumnya
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] text-slate-400 sm:block">
              Langkah {step} dari {totalSteps}
            </span>
            {step < 5 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                disabled={!canGoNext()}
                className="px-3.5 py-2 rounded-md text-xs font-bold bg-[#EE4D2D] text-white hover:bg-[#D73211] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
              >
                Lanjut <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product Selection Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-200 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF0EC] text-[#EE4D2D]">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900">Pilih Produk</h3>
                <p className="text-[10px] text-slate-500">Produk aktif dari toko Shopee Anda</p>
              </div>
              <button type="button" onClick={() => setProductModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="border-b border-slate-200 p-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari produk..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]"
                />
              </div>
            </div>
            {(productsSimulated || productsError) && (
              <div className="px-4 pt-4">
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {productsError ||
                    'Menampilkan produk contoh (mode simulasi). Produk asli dimuat otomatis setelah kredensial Shopee aktif.'}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {productsLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memuat produk dari Shopee...
                </div>
              )}
              {!productsLoading &&
                filteredProducts.map((p) => (
                <button
                  key={p.itemId}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-[#EE4D2D]/40 hover:bg-[#FFF8F6] transition-all cursor-pointer text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-[#EE4D2D] font-bold">{formatRupiah(p.price)}</p>
                  </div>
                  <span className="text-[10px] text-slate-400">Stok: {p.stock}</span>
                </button>
              ))}
              {!productsLoading && filteredProducts.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Produk tidak ditemukan.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Shared step header                                                 */
/* ------------------------------------------------------------------ */
const ShopeeStepHeader: React.FC<{ step: number; title: string; description: string }> = ({
  step,
  title,
  description,
}) => (
  <div className="border-b border-slate-100 pb-3">
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#EE4D2D]">Langkah {step} dari 5</p>
    <h2 className="mt-1 text-lg font-bold text-slate-900">{title}</h2>
    <p className="mt-0.5 text-xs text-slate-500">{description}</p>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 1: Shopee Store Account Setup                                 */
/* ------------------------------------------------------------------ */
const ShopeeBusinessSetup: React.FC<{
  business: BusinessAccount;
  connecting: boolean;
  connectError: string;
  onConnect: () => void;
  onChange: (key: keyof BusinessAccount, value: string) => void;
}> = ({ business, connecting, connectError, onConnect, onChange }) => (
  <div className="space-y-4">
    <ShopeeStepHeader
      step={1}
      title="Hubungkan toko Shopee"
      description="Masukkan Seller ID toko untuk menarik produk aktif dan saldo iklan dari Shopee Ads."
    />

    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <label className="block text-xs font-bold text-slate-800">Shopee Seller ID</label>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Dapat dilihat di Shopee Seller Centre → Pengaturan Toko → Informasi Toko.
      </p>
      <input
        type="text"
        value={business.shopeeSellerId}
        onChange={(e) => onChange('shopeeSellerId', e.target.value)}
        placeholder="Contoh: 123456789"
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#EE4D2D] focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/30"
      />
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StatusCard label="Akun toko" value={business.shopeeSellerId || 'Belum diisi'} connected={business.connected} />
      <StatusCard
        label={business.simulated ? 'Saldo iklan (simulasi)' : 'Saldo iklan'}
        value={business.connected ? formatRupiah(business.shopeeAdsBalance) : '—'}
        connected={business.connected}
      />
    </div>

    <button
      type="button"
      onClick={onConnect}
      disabled={connecting || !business.shopeeSellerId}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-[#EE4D2D] py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#D73211] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
      {business.connected ? 'Terhubung' : connecting ? 'Memverifikasi...' : 'Verifikasi & hubungkan ke Shopee'}
    </button>

    {connectError && (
      <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        <AlertCircle className="h-4 w-4" /> {connectError}
      </div>
    )}

    {business.connected && (
      <div
        className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
          business.simulated
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}
      >
        {business.simulated ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {business.simulated
            ? 'Mode simulasi: kredensial Shopee belum disetel di server. Alur dapat diuji, tetapi iklan tidak dikirim ke Shopee.'
            : 'Akun toko Shopee berhasil terhubung.'}
        </span>
      </div>
    )}
  </div>
);

const StatusCard: React.FC<{ label: string; value: string; connected: boolean }> = ({ label, value, connected }) => (
  <div className={`rounded-lg border p-3 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
    <div className="mb-1 flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
    </div>
    <div className="truncate text-xs font-semibold text-slate-700">{value}</div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 2: Product Selection                                         */
/* ------------------------------------------------------------------ */
const ShopeeCampaignSetup: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  onOpenProductModal: () => void;
}> = ({ form, setField, onOpenProductModal }) => {
  const product = form.selectedProduct;
  return (
    <div className="space-y-4">
      <ShopeeStepHeader
        step={2}
        title="Produk yang diiklankan"
        description="Shopee Discovery Ads memakai materi otomatis dari katalog toko. Pilih satu produk utama."
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-xs font-bold text-slate-800">Nama iklan</label>
        <p className="mt-0.5 text-[11px] text-slate-500">Gunakan nama yang mudah dikenali di daftar iklan toko.</p>
        <input
          type="text"
          value={form.adName}
          onChange={(e) => setField('adName', e.target.value)}
          placeholder="Contoh: Promo Stiker Wrapping Oktober"
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#EE4D2D] focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/30"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-800">Produk utama</p>
            <p className="text-[11px] text-slate-500">Hanya produk aktif yang dapat diiklankan.</p>
          </div>
          <span className="rounded bg-[#FFF0EC] px-2 py-0.5 text-[9px] font-bold text-[#EE4D2D]">Discovery</span>
        </div>

        {product ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#EE4D2D]/30 bg-[#FFF8F6] p-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-5 w-5 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-semibold text-slate-900">{product.name}</p>
              <p className="mt-1 text-sm font-bold text-[#EE4D2D]">{formatRupiah(product.price)}</p>
              <p className="text-[10px] text-slate-500">
                Stok {product.stock} · Item ID {product.itemId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setField('selectedProduct', null)}
              className="shrink-0 text-[11px] font-bold text-[#EE4D2D] hover:underline"
            >
              Ganti
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenProductModal}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-4 text-xs font-bold text-slate-600 transition-colors hover:border-[#EE4D2D] hover:text-[#EE4D2D]"
          >
            <Package className="h-4 w-4" /> Pilih produk dari toko
          </button>
        )}

        {product && (
          <button
            type="button"
            onClick={onOpenProductModal}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#EE4D2D]"
          >
            <Search className="h-3.5 w-3.5" /> Cari produk lain
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-[#F5F5F5] px-3 py-2.5 text-[11px] text-slate-600">
        <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#EE4D2D]" />
        <p>Foto, judul, dan harga iklan mengikuti data dari Shopee. Tidak perlu unggah materi manual.</p>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Step 3: Budget & Bidding                                          */
/* ------------------------------------------------------------------ */
const ShopeeBudgetBidding: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
}> = ({ form, setField }) => (
  <div className="space-y-4">
    <ShopeeStepHeader
      step={3}
      title="Anggaran & bid"
      description="Tentukan batas pengeluaran dan cara Shopee menetapkan biaya per klik."
    />

    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-[#EE4D2D]" />
        <p className="text-xs font-bold text-slate-800">Anggaran iklan</p>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {([
          { value: 'UNLIMITED' as BudgetMode, label: 'Tanpa batas', desc: 'Berjalan selama saldo iklan mencukupi' },
          { value: 'FIXED' as BudgetMode, label: 'Tetapkan batas', desc: 'Batas harian dan total pengeluaran' },
        ]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setField('budgetMode', opt.value)}
            className={`rounded-lg border p-3 text-left transition-all ${
              form.budgetMode === opt.value
                ? 'border-[#EE4D2D] bg-[#FFF8F6] ring-1 ring-[#EE4D2D]/30'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  form.budgetMode === opt.value ? 'border-[#EE4D2D]' : 'border-slate-300'
                }`}
              >
                {form.budgetMode === opt.value && <span className="h-2 w-2 rounded-full bg-[#EE4D2D]" />}
              </span>
              <span className="text-sm font-bold text-slate-900">{opt.label}</span>
            </div>
            <p className="ml-6 text-[10px] text-slate-500">{opt.desc}</p>
          </button>
        ))}
      </div>

      {form.budgetMode === 'FIXED' ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-700">Batas harian</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                value={form.dailyBudget}
                onChange={(e) => setField('dailyBudget', Number(e.target.value))}
                min={10000}
                className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-[#EE4D2D] focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/30"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[50000, 100000, 250000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setField('dailyBudget', v)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    form.dailyBudget === v
                      ? 'border-[#EE4D2D] bg-[#FFF0EC] text-[#EE4D2D]'
                      : 'border-slate-200 text-slate-500 hover:border-[#EE4D2D]/40'
                  }`}
                >
                  {formatRupiah(v)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700">Batas total</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                value={form.totalBudget}
                onChange={(e) => setField('totalBudget', Number(e.target.value))}
                min={0}
                className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-[#EE4D2D] focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/30"
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Isi 0 jika tidak ingin membatasi total pengeluaran.</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-md bg-[#F5F5F5] px-3 py-2 text-[11px] text-slate-600">
          Iklan jalan terus selama saldo Shopee Ads cukup. Saldo terlihat pada langkah Tinjau.
        </div>
      )}
    </div>

    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-800">Strategi bid (CPC)</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {([
          { value: 'AUTO' as BidMode, label: 'Otomatis', desc: 'Shopee yang mengatur bid, ikut performa iklan' },
          { value: 'MANUAL' as BidMode, label: 'Manual', desc: 'Tentukan biaya per klik sendiri' },
        ]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setField('bidMode', opt.value)}
            className={`rounded-lg border p-3 text-left transition-all ${
              form.bidMode === opt.value
                ? 'border-[#EE4D2D] bg-[#FFF8F6] ring-1 ring-[#EE4D2D]/30'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  form.bidMode === opt.value ? 'border-[#EE4D2D]' : 'border-slate-300'
                }`}
              >
                {form.bidMode === opt.value && <span className="h-2 w-2 rounded-full bg-[#EE4D2D]" />}
              </span>
              <span className="text-sm font-bold text-slate-900">{opt.label}</span>
            </div>
            <p className="ml-6 text-[10px] text-slate-500">{opt.desc}</p>
          </button>
        ))}
      </div>

      {form.bidMode === 'MANUAL' && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700">Bid maksimum per klik</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                value={form.manualBid}
                onChange={(e) => setField('manualBid', Number(e.target.value))}
                min={100}
                className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-[#EE4D2D] focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700">Keyword produk</label>
            <input
              type="text"
              value={form.keywords}
              onChange={(e) => setField('keywords', e.target.value)}
              placeholder="Contoh: stiker vinyl, stiker custom, cetak stiker"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#EE4D2D] focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/30"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Pisahkan kata kunci dengan koma. Semua kata kunci memakai pola broad dan bid yang sama.
            </p>
          </div>
        </div>
      )}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 4: Placements                                                */
/* ------------------------------------------------------------------ */
const ShopeePlacement: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  simulated: boolean;
}> = ({ form, setField, simulated }) => {
  const product = form.selectedProduct;
  return (
    <div className="space-y-4">
      <ShopeeStepHeader
        step={4}
        title="Penempatan iklan"
        description="Pilih posisi iklan. Pilihan ini dikirim ke Shopee saat bid diatur manual."
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-800">Materi otomatis</p>
          <span
            className={`rounded px-2 py-0.5 text-[9px] font-bold ${
              simulated ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {simulated ? 'Simulasi' : 'Live Shopee'}
          </span>
        </div>
        {product ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-5 w-5 text-slate-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-xs font-semibold text-slate-900">{product.name}</p>
              <p className="text-sm font-bold text-[#EE4D2D]">{formatRupiah(product.price)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Pilih produk pada langkah sebelumnya.</p>
        )}
      </div>

      <div className="space-y-2">
        <PlacementToggle
          title="Beranda · Rekomendasi"
          description="Iklan tampil di antara produk rekomendasi pada halaman utama Shopee."
          active={form.placements.homeRecommendation}
          onChange={(value) => setField('placements', { ...form.placements, homeRecommendation: value })}
          icon={Home}
        />
        <PlacementToggle
          title="Halaman detail produk"
          description="Iklan tampil di halaman produk sejenis yang sedang dilihat pembeli."
          active={form.placements.productDetail}
          onChange={(value) => setField('placements', { ...form.placements, productDetail: value })}
          icon={Tag}
        />
      </div>

      {form.bidMode === 'AUTO' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
          Saat bid otomatis, Shopee yang menentukan posisi dan bid sendiri. Pilihan posisi di atas hanya
          terpakai saat bid diatur manual.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-800">
          Posisi yang dipilih dikirim ke Shopee bersama bid per klik saat bid diatur manual.
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold text-slate-800">Premium rate</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Fitur premium rate belum tersedia di Shopee Open Platform. Setelah iklan aktif, atur premium rate di Shopee Ads Manager.
        </p>
      </div>
    </div>
  );
};

const PlacementToggle: React.FC<{
  title: string;
  description: string;
  active: boolean;
  onChange: (value: boolean) => void;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ title, description, active, onChange, icon: Icon }) => (
  <label
    className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 transition-colors ${
      active ? 'border-[#EE4D2D]/40 bg-[#FFF8F6]' : 'border-slate-200 bg-white hover:border-slate-300'
    }`}
  >
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          active ? 'bg-[#FFF0EC] text-[#EE4D2D]' : 'bg-slate-100 text-slate-400'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {active ? <ToggleRight className="h-5 w-5 text-[#EE4D2D]" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
      <input
        type="checkbox"
        checked={active}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
    </div>
  </label>
);

/* ------------------------------------------------------------------ */
/* Step 5: Publish Review                                            */
/* ------------------------------------------------------------------ */
const ShopeePublishReview: React.FC<{
  business: BusinessAccount;
  form: CampaignForm;
  publishing: boolean;
  onPublish: () => void;
}> = ({ business, form, publishing, onPublish }) => {
  const product = form.selectedProduct;
  const placements = [
    form.placements.homeRecommendation ? 'Beranda · Rekomendasi' : null,
    form.placements.productDetail ? 'Detail produk' : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-4">
      <ShopeeStepHeader
        step={5}
        title="Tinjau & aktifkan"
        description="Periksa produk, anggaran, dan penempatan sebelum iklan diaktifkan."
      />

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-[#F5F5F5] px-3 py-2">
          <Package className="h-3.5 w-3.5 text-[#EE4D2D]" />
          <span className="text-[11px] font-bold text-slate-700">Produk & materi</span>
        </div>
        <div className="flex items-center gap-3 p-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
            {product?.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-xs font-semibold text-slate-900">{product?.name || 'Belum ada produk dipilih'}</p>
            <p className="text-sm font-bold text-[#EE4D2D]">{product ? formatRupiah(product.price) : '—'}</p>
            <p className="text-[10px] text-slate-400">Materi otomatis dari Shopee</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-[#F5F5F5] px-3 py-2">
          <Coins className="h-3.5 w-3.5 text-[#EE4D2D]" />
          <span className="text-[11px] font-bold text-slate-700">Akun, anggaran & bid</span>
        </div>
        <div className="divide-y divide-slate-100 px-3 text-xs">
          <Row label="Akun toko" value={business.connected ? business.shopeeSellerId : 'Belum terhubung'} />
          <Row label="Status" value={business.simulated ? 'Simulasi (belum live)' : 'Live di Shopee'} />
          <Row label="Saldo iklan" value={business.connected ? formatRupiah(business.shopeeAdsBalance) : '—'} />
          <Row label="Nama iklan" value={form.adName || '—'} />
          <Row
            label="Anggaran"
            value={
              form.budgetMode === 'UNLIMITED'
                ? 'Tanpa batas'
                : `${formatRupiah(form.dailyBudget)} / hari`
            }
          />
          {form.budgetMode === 'FIXED' && (
            <Row
              label="Batas total"
              value={form.totalBudget > 0 ? formatRupiah(form.totalBudget) : 'Tanpa batas'}
            />
          )}
          <Row label="Bid" value={form.bidMode === 'AUTO' ? 'Otomatis' : `${formatRupiah(form.manualBid)} / klik`} />
          {form.bidMode === 'MANUAL' && (
            <Row
              label="Keyword"
              value={
                form.keywords
                  .split(',')
                  .map((keyword) => keyword.trim())
                  .filter(Boolean)
                  .join(', ') || '—'
              }
            />
          )}
          <Row label="Premium rate" value="Diatur di Shopee Ads Manager" />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-[11px] font-bold text-slate-700">Penempatan</p>
        {form.bidMode === 'AUTO' ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Ditentukan otomatis oleh Shopee karena strategi bid yang dipilih adalah otomatis.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {placements.length > 0 ? (
              placements.map((placement) => (
                <span
                  key={placement}
                  className="inline-flex items-center gap-1 rounded-full bg-[#FFF0EC] px-2.5 py-1 text-[10px] font-semibold text-[#EE4D2D]"
                >
                  {placement === 'Beranda · Rekomendasi' ? (
                    <Home className="h-3 w-3" />
                  ) : (
                    <Tag className="h-3 w-3" />
                  )}{' '}
                  {placement}
                </span>
              ))
            ) : (
              <p className="text-[11px] text-slate-500">Belum ada penempatan dipilih; Shopee memakai default.</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[#FFD9CF] bg-[#FFF8F6] px-3 py-2.5 text-[11px] text-[#B43A20]">
        <p className="font-bold">Estimasi pengeluaran</p>
        <p className="mt-0.5">
          {form.bidMode === 'AUTO'
            ? 'Shopee akan mengoptimasi bid secara otomatis berdasarkan performa iklan.'
            : `Estimasi biaya per klik: ${formatRupiah(form.manualBid)}. Pengeluaran aktual tergantung jumlah klik yang diperoleh.`}
        </p>
      </div>

      <button
        type="button"
        onClick={onPublish}
        disabled={publishing}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#EE4D2D] py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#D73211] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {publishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        {publishing ? 'Mengaktifkan...' : 'Aktifkan iklan'}
      </button>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <span className="shrink-0 font-semibold text-slate-500">{label}</span>
    <span className="break-words text-right text-slate-800">{value}</span>
  </div>
);

/* ------------------------------------------------------------------ */
/* Live Ad Preview — native Shopee surfaces                          */
/* ------------------------------------------------------------------ */
const ShopeeLivePreview: React.FC<{ form: CampaignForm }> = ({ form }) => {
  const [view, setView] = useState<'home' | 'detail'>('home');
  const product = form.selectedProduct;
  const productName = product?.name || 'Stiker Vinyl Glossy Custom A3';
  const price = product?.price ?? 85000;
  const imageUrl = product?.imageUrl || '';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {[
          { id: 'home' as const, label: 'Beranda', icon: Home },
          { id: 'detail' as const, label: 'Detail Produk', icon: Tag },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors ${
              view === tab.id ? 'bg-white text-[#EE4D2D] shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-xl border border-slate-200 bg-[#F5F5F5] shadow-lg">
        {view === 'home' ? (
          <ShopeeHomePreview productName={productName} price={price} imageUrl={imageUrl} />
        ) : (
          <ShopeeDetailPreview productName={productName} price={price} imageUrl={imageUrl} />
        )}
      </div>

      <p className="text-center text-[10px] text-slate-400">
        {view === 'home'
          ? 'Penempatan Beranda · iklan tampil di antara produk rekomendasi.'
          : 'Penempatan Detail Produk · tanpa frame perangkat.'}
      </p>
    </div>
  );
};

const ShopeeHomePreview: React.FC<{ productName: string; price: number; imageUrl: string }> = ({
  productName,
  price,
  imageUrl,
}) => (
  <div className="bg-[#F5F5F5]">
    {/* Shopee header */}
    <div className="bg-gradient-to-b from-[#F53D2D] to-[#EE4D2D] px-3 pb-2.5 pt-3 text-white">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm bg-white px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate text-[10px] text-slate-500">
            {productName.split(' ').slice(0, 3).join(' ').toLowerCase()}
          </span>
        </div>
        <MessageCircle className="h-4 w-4" />
        <Bell className="h-4 w-4" />
      </div>
      <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
        {['Stiker Custom', 'Vinyl Glossy', 'Cutting Reflective'].map((tag) => (
          <span key={tag} className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[8px] font-medium text-white/90">
            {tag}
          </span>
        ))}
      </div>
    </div>

    {/* Category shortcuts */}
    <div className="grid grid-cols-4 gap-1 bg-white px-1 py-2.5">
      {[
        { icon: Zap, label: 'Flash Sale', className: 'bg-[#FFF0EC] text-[#EE4D2D]' },
        { icon: Ticket, label: 'Voucher', className: 'bg-[#FFF7E6] text-[#F5A623]' },
        { icon: Truck, label: 'Gratis Ongkir', className: 'bg-[#E8F7F5] text-[#26AA99]' },
        { icon: Video, label: 'Shopee Live', className: 'bg-[#F3EEFF] text-[#8B5CF6]' },
      ].map((category) => (
        <div key={category.label} className="flex flex-col items-center gap-1">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${category.className}`}>
            <category.icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[8px] font-medium text-slate-600">{category.label}</span>
        </div>
      ))}
    </div>

    {/* Campaign banner */}
    <div className="px-2 pt-2">
      <div className="flex items-center justify-between overflow-hidden rounded-md bg-gradient-to-r from-[#EE4D2D] via-[#F96D41] to-[#FFB03A] px-3 py-3 text-white">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-white/80">9.9 Super Shopping Day</p>
          <p className="text-sm font-black leading-tight">Gratis Ongkir + Voucher</p>
          <p className="text-[8px] text-white/90">Hemat sampai Rp50.000</p>
        </div>
        <Coins className="h-8 w-8 text-white/40" />
      </div>
    </div>

    {/* Flash sale strip */}
    <div className="mt-2 bg-white px-2.5 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 fill-[#EE4D2D] text-[#EE4D2D]" />
          <span className="text-[11px] font-black italic text-[#EE4D2D]">FLASH SALE</span>
        </div>
        <div className="flex items-center gap-1 text-[8px] font-bold text-white">
          <span className="rounded-sm bg-[#222] px-1 py-0.5">02</span>:
          <span className="rounded-sm bg-[#222] px-1 py-0.5">18</span>:
          <span className="rounded-sm bg-[#222] px-1 py-0.5">45</span>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((index) => (
          <div key={index} className="overflow-hidden rounded-sm border border-slate-100">
            <div className="flex aspect-square items-center justify-center bg-slate-100">
              <Package className="h-5 w-5 text-slate-300" />
            </div>
            <div className="px-1 py-0.5">
              <p className="truncate text-[8px] font-bold text-[#EE4D2D]">
                Rp{['45.000', '32.000', '85.000'][index]}
              </p>
              <div className="mt-0.5 h-1 w-full rounded-full bg-[#FFD9CF]">
                <div className="h-full rounded-full bg-[#EE4D2D]" style={{ width: `${70 - index * 15}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Recommendation feed with the Discovery ad card */}
    <div className="mt-2 bg-white px-2.5 pb-3 pt-2">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-800">Rekomendasi Untukmu</p>
        <span className="text-[8px] text-slate-400">Lihat Semua</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="overflow-hidden rounded-sm border border-[#EE4D2D]/30 bg-white shadow-xs">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-slate-100">
            {imageUrl ? (
              <img src={imageUrl} alt={productName} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-8 w-8 text-slate-300" />
            )}
            <span className="absolute left-0 top-0 rounded-br-sm bg-[#EE4D2D]/90 px-1 py-0.5 text-[7px] font-bold text-white">
              Iklan
            </span>
            <span className="absolute bottom-1 right-1 rounded-sm bg-black/50 px-1 py-0.5 text-[7px] font-semibold text-white">
              Star+
            </span>
          </div>
          <div className="space-y-0.5 p-1.5">
            <p className="line-clamp-2 text-[9px] font-medium leading-snug text-slate-800">{productName}</p>
            <p className="text-[11px] font-bold text-[#EE4D2D]">{formatRupiah(price)}</p>
            <div className="flex items-center gap-1 text-[7px] text-slate-400">
              <span className="flex items-center gap-0.5">
                <Star className="h-2 w-2 fill-[#FFC107] text-[#FFC107]" /> 4,9
              </span>
              <span>Terjual 1,2rb</span>
            </div>
            <div className="flex items-center gap-0.5 text-[7px] text-[#26AA99]">
              <Truck className="h-2 w-2" /> Gratis Ongkir
            </div>
          </div>
        </div>
        {[0, 1, 2].map((index) => (
          <div key={index} className="overflow-hidden rounded-sm border border-slate-100 bg-white">
            <div className="flex aspect-square items-center justify-center bg-slate-100">
              <Package className="h-7 w-7 text-slate-300" />
            </div>
            <div className="space-y-0.5 p-1.5">
              <p className="h-1.5 w-full rounded bg-slate-200" />
              <p className="h-1.5 w-3/4 rounded bg-slate-200" />
              <p className="text-[9px] font-bold text-slate-400">Rp{['29.000', '55.000', '18.000'][index]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Shopee bottom navigation */}
    <div className="grid grid-cols-4 border-t border-slate-200 bg-white px-1 py-1.5">
      {[
        { icon: Home, label: 'Beranda', active: true },
        { icon: Video, label: 'Video', active: false },
        { icon: Bell, label: 'Notifikasi', active: false },
        { icon: User, label: 'Saya', active: false },
      ].map((tab) => (
        <div
          key={tab.label}
          className={`flex flex-col items-center gap-0.5 ${tab.active ? 'text-[#EE4D2D]' : 'text-slate-400'}`}
        >
          <tab.icon className="h-3.5 w-3.5" />
          <span className="text-[7px] font-medium">{tab.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const ShopeeDetailPreview: React.FC<{ productName: string; price: number; imageUrl: string }> = ({
  productName,
  price,
  imageUrl,
}) => (
  <div className="bg-[#F5F5F5]">
    {/* Product detail top bar */}
    <div className="flex items-center gap-2 bg-white px-2.5 py-2">
      <ChevronLeft className="h-4 w-4 text-slate-700" />
      <div className="flex min-w-0 flex-1 items-center gap-1 rounded-sm bg-[#F5F5F5] px-2 py-1">
        <Search className="h-3 w-3 text-slate-400" />
        <span className="truncate text-[9px] text-slate-500">Cari di toko</span>
      </div>
      <Share2 className="h-3.5 w-3.5 text-slate-600" />
      <Heart className="h-3.5 w-3.5 text-slate-600" />
      <ShoppingBag className="h-3.5 w-3.5 text-slate-600" />
    </div>

    {/* Product media */}
    <div className="relative flex aspect-square items-center justify-center bg-slate-100">
      {imageUrl ? (
        <img src={imageUrl} alt={productName} className="h-full w-full object-cover" />
      ) : (
        <Package className="h-12 w-12 text-slate-300" />
      )}
      <span className="absolute left-2 top-2 rounded-sm bg-[#EE4D2D] px-1.5 py-0.5 text-[7px] font-bold text-white">
        Iklan
      </span>
      <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-1.5 py-0.5 text-[8px] font-semibold text-white">
        1/4
      </span>
    </div>

    {/* Price & product info */}
    <div className="bg-white px-3 py-2">
      <div className="flex items-end gap-2">
        <p className="text-base font-bold leading-none text-[#EE4D2D]">{formatRupiah(price)}</p>
        <span className="rounded-sm bg-[#FFF0EC] px-1 py-0.5 text-[8px] font-bold text-[#EE4D2D]">Diskon 20%</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-snug text-slate-800">{productName}</p>
      <div className="mt-1 flex items-center gap-1.5 text-[8px] text-slate-500">
        <span className="flex items-center gap-0.5 font-bold text-slate-700">
          <Star className="h-2.5 w-2.5 fill-[#FFC107] text-[#FFC107]" /> 4,9
        </span>
        <span>·</span>
        <span>Terjual 1,2rb</span>
        <span>·</span>
        <span className="flex items-center gap-0.5 text-[#26AA99]">
          <BadgeCheck className="h-2.5 w-2.5" /> Star+
        </span>
      </div>
    </div>

    <div className="mt-1.5 space-y-1.5">
      <div className="flex items-center gap-2 bg-white px-3 py-2">
        <Truck className="h-3.5 w-3.5 text-[#26AA99]" />
        <div className="flex-1">
          <p className="text-[9px] font-semibold text-slate-800">Gratis Ongkir</p>
          <p className="text-[8px] text-slate-400">Estimasi tiba 2-4 hari · BEJO Digital Print</p>
        </div>
        <ChevronRight className="h-3 w-3 text-slate-300" />
      </div>

      <div className="flex items-center gap-2 bg-white px-3 py-2">
        <Ticket className="h-3.5 w-3.5 text-[#EE4D2D]" />
        <div className="flex-1">
          <p className="text-[9px] font-semibold text-slate-800">Voucher Toko</p>
          <p className="text-[8px] text-slate-400">Diskon Rp10.000 · Min. belanja Rp100.000</p>
        </div>
        <span className="rounded-sm border border-[#EE4D2D] px-1.5 py-0.5 text-[8px] font-bold text-[#EE4D2D]">Klaim</span>
      </div>

      <div className="flex items-center gap-2 bg-white px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EE4D2D] text-[9px] font-black text-white">
          B
        </div>
        <div className="flex-1">
          <p className="flex items-center gap-1 text-[9px] font-bold text-slate-800">
            BEJO Digital Print
            <span className="rounded-sm bg-[#EE4D2D] px-1 py-0.5 text-[6px] text-white">Star+</span>
          </p>
          <p className="text-[8px] text-slate-400">Aktif 5 menit lalu · Kota Surabaya</p>
        </div>
        <span className="rounded-sm border border-[#EE4D2D] px-1.5 py-0.5 text-[8px] font-bold text-[#EE4D2D]">
          Kunjungi Toko
        </span>
      </div>
    </div>

    {/* Sticky purchase bar */}
    <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-200 bg-white px-2 py-1.5">
      <div className="flex flex-col items-center gap-0.5 px-2 text-[#EE4D2D]">
        <MessageCircle className="h-4 w-4" />
        <span className="text-[7px] font-medium">Chat</span>
      </div>
      <div className="flex-1 rounded-sm border border-[#EE4D2D] py-1.5 text-center text-[9px] font-bold text-[#EE4D2D]">
        Masukkan Keranjang
      </div>
      <div className="flex-1 rounded-sm bg-[#EE4D2D] py-1.5 text-center text-[9px] font-bold text-white">
        Beli Sekarang
      </div>
    </div>
  </div>
);