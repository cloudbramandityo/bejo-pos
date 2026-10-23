/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Marketing Module — Shopee Discovery Ads (Shopee Open Platform API)
 * Coded by Langgo Bramandityo.
 */
import React, { useState } from 'react';
import {
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Target,
  DollarSign,
  MapPin,
  Tag,
  Eye,
  Smartphone,
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
  placements: {
    homeRecommendation: boolean;
    productDetail: boolean;
  };
  premiumRate: number;
  selectedProduct: ShopeeProduct | null;
}

const DEFAULT_FORM: CampaignForm = {
  adName: '',
  budgetMode: 'UNLIMITED',
  dailyBudget: 50000,
  totalBudget: 0,
  bidMode: 'AUTO',
  manualBid: 500,
  placements: {
    homeRecommendation: true,
    productDetail: true,
  },
  premiumRate: 0,
  selectedProduct: null,
};

const MOCK_PRODUCTS: ShopeeProduct[] = [
  { itemId: '1001', name: 'Stiker Vinyl Glossy A3 (100 lembar)', price: 85000, imageUrl: '', stock: 250 },
  { itemId: '1002', name: 'Stiker Cutting Reflective (per meter)', price: 45000, imageUrl: '', stock: 500 },
  { itemId: '1003', name: 'Laminasi UV Glossy Roll 1.26m', price: 320000, imageUrl: '', stock: 30 },
  { itemId: '1004', name: 'Tinta Sublimation 100ml (4 warna)', price: 120000, imageUrl: '', stock: 80 },
];

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */
export const ShopeeDiscoveryAds: React.FC = () => {
  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState<BusinessAccount>({
    shopeeSellerId: '',
    shopeeAdsBalance: 0,
    connected: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [form, setForm] = useState<CampaignForm>(DEFAULT_FORM);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [publishMessage, setPublishMessage] = useState('');

  const totalSteps = 5;

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
      setBusiness((prev) => ({ ...prev, connected: true, shopeeAdsBalance: data?.balance ?? 0 }));
    } catch (err: any) {
      setConnectError(err?.message || 'Terjadi kesalahan saat menghubungkan.');
      setBusiness((prev) => ({ ...prev, connected: false }));
    } finally {
      setConnecting(false);
    }
  };

  const handleBusinessField = (key: keyof BusinessAccount, value: string) => {
    setBusiness((prev) => ({ ...prev, [key]: value, connected: false }));
  };

  /* ---- Step 2 helpers ---- */
  const setField = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectProduct = (p: ShopeeProduct) => {
    setField('selectedProduct', p);
    setProductModalOpen(false);
  };

  const filteredProducts = MOCK_PRODUCTS.filter((p) =>
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
          placements: form.placements,
          premiumRate: form.premiumRate,
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

      setPublishStatus('success');
      setPublishMessage(`Iklan Shopee berhasil diaktifkan! Ad ID: ${data.adId || '-'}`);
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
      case 3: return true;
      case 4: return true;
      default: return true;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {[
            { n: 1, label: 'Akun Toko' },
            { n: 2, label: 'Kampanye & Produk' },
            { n: 3, label: 'Biaya & Targeting' },
            { n: 4, label: 'Materi Iklan' },
            { n: 5, label: 'Terbitkan' },
          ].map((s, idx) => (
            <React.Fragment key={s.n}>
              <button
                type="button"
                onClick={() => s.n < step && setStep(s.n)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  step === s.n
                    ? 'bg-orange-500 text-white shadow-xs'
                    : step > s.n
                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                  step === s.n ? 'bg-white/20' : step > s.n ? 'bg-orange-200' : 'bg-slate-200'
                }`}>
                  {step > s.n ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.n}
                </span>
                {s.label}
              </button>
              {idx < 4 && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Toast */}
      {publishStatus !== 'idle' && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
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

      {/* Step content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
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
            <ShopeeBidding form={form} setField={setField} />
          )}
          {step === 4 && <ShopeeAdCreative form={form} />}
          {step === 5 && (
            <ShopeePublishReview business={business} form={form} publishing={publishing} onPublish={handlePublish} />
          )}
        </div>

        {/* Live Ad Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Pratinjau Iklan</h3>
          </div>
          <ShopeeLivePreview form={form} />
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Sebelumnya
        </button>
        {step < 5 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(5, s + 1))}
            disabled={!canGoNext()}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
          >
            Lanjut <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Product Selection Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Pilih Produk untuk Diiklankan</h3>
              <button type="button" onClick={() => setProductModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari produk..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredProducts.map((p) => (
                <button
                  key={p.itemId}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50 transition-all cursor-pointer text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-orange-600 font-bold">Rp {p.price.toLocaleString('id-ID')}</p>
                  </div>
                  <span className="text-[10px] text-slate-400">Stok: {p.stock}</span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
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
/* Step 1: Shopee Business Account Setup                             */
/* ------------------------------------------------------------------ */
const ShopeeBusinessSetup: React.FC<{
  business: BusinessAccount;
  connecting: boolean;
  connectError: string;
  onConnect: () => void;
  onChange: (key: keyof BusinessAccount, value: string) => void;
}> = ({ business, connecting, connectError, onConnect, onChange }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">1. Persiapan Akun Bisnis Shopee</h2>
    <p className="text-xs text-slate-500">
      Isi data akun toko Shopee Anda secara manual, lalu klik "Verifikasi & Hubungkan".
    </p>

    <div className="grid grid-cols-1 gap-3">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Shopee Seller Account ID</label>
        <input
          type="text"
          value={business.shopeeSellerId}
          onChange={(e) => onChange('shopeeSellerId', e.target.value)}
          placeholder="Contoh: 123456789"
          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <StatusCard label="Akun Toko Shopee" value={business.shopeeSellerId || '—'} connected={business.connected} />
      <StatusCard
        label="Saldo Shopee Ads"
        value={business.connected ? `Rp ${business.shopeeAdsBalance.toLocaleString('id-ID')}` : '—'}
        connected={business.connected}
      />
    </div>

    <button
      type="button"
      onClick={onConnect}
      disabled={connecting || !business.shopeeSellerId}
      className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
      {business.connected ? 'Terhubung ✓' : connecting ? 'Memverifikasi...' : 'Verifikasi & Hubungkan ke Shopee'}
    </button>

    {connectError && (
      <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> {connectError}
      </div>
    )}

    {business.connected && (
      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> Akun toko Shopee berhasil terhubung.
      </div>
    )}
  </div>
);

const StatusCard: React.FC<{ label: string; value: string; connected: boolean }> = ({ label, value, connected }) => (
  <div className={`rounded-xl border p-3 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
    <div className="flex items-center gap-2 mb-1">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
    </div>
    <div className="text-xs font-mono text-slate-700 truncate">{value}</div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 2: Campaign Setup & Product Selection                        */
/* ------------------------------------------------------------------ */
const ShopeeCampaignSetup: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  onOpenProductModal: () => void;
}> = ({ form, setField, onOpenProductModal }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">2. Setup Kampanye & Pilih Produk</h2>

    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Iklan</label>
      <input
        type="text"
        value={form.adName}
        onChange={(e) => setField('adName', e.target.value)}
        placeholder="Contoh: Promo Stiker Wrapping Shopee"
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
    </div>

    {/* Product selection */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Produk yang Diiklankan</label>
      {form.selectedProduct ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-orange-200 bg-orange-50">
          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{form.selectedProduct.name}</p>
            <p className="text-[11px] text-orange-600 font-bold">Rp {form.selectedProduct.price.toLocaleString('id-ID')}</p>
          </div>
          <button
            type="button"
            onClick={() => setField('selectedProduct', null)}
            className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
          >
            Ganti
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenProductModal}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:border-orange-400 hover:text-orange-600 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Package className="w-4 h-4" /> Pilih Produk dari Toko Shopee
        </button>
      )}
    </div>

    {/* Budget mode */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-2">Modal Iklan / Budget</label>
      <div className="grid grid-cols-2 gap-3">
        {([
          { value: 'UNLIMITED' as BudgetMode, label: 'Tanpa Batas', desc: 'Iklan berjalan selama saldo mencukupi' },
          { value: 'FIXED' as BudgetMode, label: 'Tetapkan Batas', desc: 'Batas harian / total pengeluaran' },
        ]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setField('budgetMode', opt.value)}
            className={`text-left rounded-xl border p-3 transition-all cursor-pointer ${
              form.budgetMode === opt.value
                ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                form.budgetMode === opt.value ? 'border-orange-500' : 'border-slate-300'
              }`}>
                {form.budgetMode === opt.value && <span className="w-2 h-2 rounded-full bg-orange-500" />}
              </span>
              <span className="text-sm font-bold text-slate-900">{opt.label}</span>
            </div>
            <p className="text-[10px] text-slate-500 ml-6">{opt.desc}</p>
          </button>
        ))}
      </div>
      {form.budgetMode === 'FIXED' && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Batas Harian (Rp)</label>
            <input
              type="number"
              value={form.dailyBudget}
              onChange={(e) => setField('dailyBudget', Number(e.target.value))}
              min={10000}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Batas Total (Rp)</label>
            <input
              type="number"
              value={form.totalBudget}
              onChange={(e) => setField('totalBudget', Number(e.target.value))}
              min={0}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      )}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 3: Bidding & Targeting                                       */
/* ------------------------------------------------------------------ */
const ShopeeBidding: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
}> = ({ form, setField }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">3. Pengaturan Biaya & Targeting</h2>

    {/* Bid mode */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-2">Mode Biaya per Klik (CPC Bid)</label>
      <div className="grid grid-cols-2 gap-3">
        {([
          { value: 'AUTO' as BidMode, label: 'Pilih Otomatis', desc: 'Shopee optimasi bid secara otomatis' },
          { value: 'MANUAL' as BidMode, label: 'Pilih Manual', desc: 'Tentukan biaya per klik sendiri' },
        ]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setField('bidMode', opt.value)}
            className={`text-left rounded-xl border p-3 transition-all cursor-pointer ${
              form.bidMode === opt.value
                ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                form.bidMode === opt.value ? 'border-orange-500' : 'border-slate-300'
              }`}>
                {form.bidMode === opt.value && <span className="w-2 h-2 rounded-full bg-orange-500" />}
              </span>
              <span className="text-sm font-bold text-slate-900">{opt.label}</span>
            </div>
            <p className="text-[10px] text-slate-500 ml-6">{opt.desc}</p>
          </button>
        ))}
      </div>
      {form.bidMode === 'MANUAL' && (
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-700 mb-1">Biaya per Klik (Rp)</label>
          <input
            type="number"
            value={form.manualBid}
            onChange={(e) => setField('manualBid', Number(e.target.value))}
            min={100}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      )}
    </div>

    {/* Placements */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-2">Target Penempatan</label>
      <div className="space-y-2">
        <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-slate-300">
          <div className="flex items-center gap-3">
            {form.placements.homeRecommendation ? <ToggleRight className="w-5 h-5 text-orange-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
            <span className="text-sm font-semibold text-slate-900">Halaman Utama Rekomendasi</span>
          </div>
          <input
            type="checkbox"
            checked={form.placements.homeRecommendation}
            onChange={(e) => setField('placements', { ...form.placements, homeRecommendation: e.target.checked })}
            className="sr-only"
          />
        </label>
        <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-slate-300">
          <div className="flex items-center gap-3">
            {form.placements.productDetail ? <ToggleRight className="w-5 h-5 text-orange-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
            <span className="text-sm font-semibold text-slate-900">Halaman Detail Produk</span>
          </div>
          <input
            type="checkbox"
            checked={form.placements.productDetail}
            onChange={(e) => setField('placements', { ...form.placements, productDetail: e.target.checked })}
            className="sr-only"
          />
        </label>
      </div>
    </div>

    {/* Premium rate */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">
        Persentase Premium (Premium Rate): {form.premiumRate}%
      </label>
      <input
        type="range"
        min={0}
        max={100}
        value={form.premiumRate}
        onChange={(e) => setField('premiumRate', Number(e.target.value))}
        className="w-full accent-orange-500"
      />
      <p className="text-[10px] text-slate-400 mt-1">Tambahan biaya untuk prioritas penempatan (0-100%)</p>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 4: Ad Creative & Preview                                     */
/* ------------------------------------------------------------------ */
const ShopeeAdCreative: React.FC<{ form: CampaignForm }> = ({ form }) => {
  const product = form.selectedProduct;
  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-slate-900">4. Materi Iklan (Auto dari Shopee)</h2>
      <p className="text-xs text-slate-500">
        Foto produk, judul, dan harga diambil otomatis dari sistem Shopee berdasarkan produk yang dipilih.
      </p>

      {product ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">{product.name}</p>
              <p className="text-base font-extrabold text-orange-600 mt-1">Rp {product.price.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Stok: {product.stock} | Item ID: {product.itemId}</p>
            </div>
          </div>
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
            <p className="font-bold">Data diambil real-time dari Shopee</p>
            <p className="text-[11px] text-blue-600 mt-0.5">
              Foto produk utama, judul, dan harga disinkronkan otomatis dari sistem Shopee.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Belum ada produk dipilih. Kembali ke Step 2 untuk memilih produk.</p>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Step 5: Publish Review                                            */
/* ------------------------------------------------------------------ */
const ShopeePublishReview: React.FC<{
  business: BusinessAccount;
  form: CampaignForm;
  publishing: boolean;
  onPublish: () => void;
}> = ({ business, form, publishing, onPublish }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">5. Ringkasan & Terbitkan</h2>

    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
      <Row label="Akun Toko" value={business.connected ? business.shopeeSellerId : 'Belum terhubung'} />
      <Row label="Saldo Ads" value={business.connected ? `Rp ${business.shopeeAdsBalance.toLocaleString('id-ID')}` : '—'} />
      <Row label="Nama Iklan" value={form.adName || '—'} />
      <Row label="Produk" value={form.selectedProduct?.name || '—'} />
      <Row label="Harga Produk" value={form.selectedProduct ? `Rp ${form.selectedProduct.price.toLocaleString('id-ID')}` : '—'} />
      <Row label="Mode Budget" value={form.budgetMode === 'UNLIMITED' ? 'Tanpa Batas' : 'Tetapkan Batas'} />
      {form.budgetMode === 'FIXED' && (
        <>
          <Row label="Batas Harian" value={`Rp ${form.dailyBudget.toLocaleString('id-ID')}`} />
          <Row label="Batas Total" value={`Rp ${form.totalBudget.toLocaleString('id-ID')}`} />
        </>
      )}
      <Row label="Mode Bid" value={form.bidMode === 'AUTO' ? 'Otomatis' : 'Manual'} />
      {form.bidMode === 'MANUAL' && <Row label="Bid per Klik" value={`Rp ${form.manualBid.toLocaleString('id-ID')}`} />}
      <Row label="Penempatan" value={[
        form.placements.homeRecommendation ? 'Halaman Utama Rekomendasi' : null,
        form.placements.productDetail ? 'Halaman Detail Produk' : null,
      ].filter(Boolean).join(', ') || '—'} />
      <Row label="Premium Rate" value={`${form.premiumRate}%`} />
    </div>

    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-xs text-orange-800">
      <p className="font-bold">Estimasi Pengeluaran</p>
      <p className="text-[11px] text-orange-700 mt-0.5">
        {form.bidMode === 'AUTO'
          ? 'Shopee akan mengoptimasi bid secara otomatis berdasarkan performa iklan.'
          : `Estimasi biaya per klik: Rp ${form.manualBid.toLocaleString('id-ID')}. Pengeluaran aktual tergantung jumlah klik yang diperoleh.`}
      </p>
    </div>

    <button
      type="button"
      onClick={onPublish}
      disabled={publishing}
      className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
      {publishing ? 'Mengaktifkan...' : 'Aktifkan Iklan Shopee'}
    </button>
  </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="font-semibold text-slate-500 shrink-0">{label}</span>
    <span className="text-slate-800 text-right break-words">{value}</span>
  </div>
);

/* ------------------------------------------------------------------ */
/* Live Ad Preview — Shopee product card mockup                      */
/* ------------------------------------------------------------------ */
const ShopeeLivePreview: React.FC<{ form: CampaignForm }> = ({ form }) => {
  const product = form.selectedProduct;
  return (
    <div className="mx-auto w-[220px] space-y-2">
      <p className="text-[10px] font-bold text-slate-500 text-center mb-2">Pratinjau di Aplikasi Shopee</p>
      {/* Product card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="relative w-full aspect-square bg-slate-100 flex items-center justify-center">
          <Package className="w-10 h-10 text-slate-300" />
          <span className="absolute top-2 left-2 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
            Ad
          </span>
        </div>
        <div className="p-2 space-y-1">
          <p className="text-[10px] font-semibold text-slate-800 line-clamp-2">
            {product ? product.name : 'Nama Produk'}
          </p>
          <p className="text-xs font-extrabold text-orange-600">
            {product ? `Rp ${product.price.toLocaleString('id-ID')}` : 'Rp 0'}
          </p>
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-slate-400">Terjual 1.2rb</span>
            <span className="text-[8px] text-slate-400">•</span>
            <span className="text-[8px] text-slate-400">⭐ 4.8</span>
          </div>
        </div>
      </div>
      {/* Surrounding organic products (blurred) */}
      <div className="grid grid-cols-2 gap-2 opacity-40">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="w-full aspect-square bg-slate-100" />
            <div className="p-1.5 space-y-0.5">
              <div className="h-2 bg-slate-200 rounded w-3/4" />
              <div className="h-2 bg-slate-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-slate-400 text-center mt-1">
        Iklan menyelinap di antara produk organik
      </p>
    </div>
  );
};