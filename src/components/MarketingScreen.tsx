/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Marketing Module — Panel Iklan Resmi WhatsApp Status (Meta Marketing API)
 * Coded by Langgo Bramandityo.
 */
import React, { useState } from 'react';
import {
  Megaphone,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
  Video,
  Target,
  DollarSign,
  MapPin,
  Users,
  Tag,
  Eye,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Send,
  Link2,
  Globe,
  BarChart3,
  RefreshCw,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type CampaignObjective = 'AWARENESS' | 'SALES';
type Gender = 'ALL' | 'MALE' | 'FEMALE';
type CTA = 'WHATSAPP_MESSAGE' | 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP';

interface BusinessAccount {
  metaBusinessId: string;
  facebookPageId: string;
  whatsappBusinessNumber: string;
  connected: boolean;
}

interface CampaignForm {
  name: string;
  objective: CampaignObjective;
  dailyBudget: number;
  locations: string[];
  ageMin: number;
  ageMax: number;
  gender: Gender;
  interests: string[];
  mediaFile: File | null;
  mediaPreviewUrl: string;
  mediaType: 'image' | 'video' | null;
  caption: string;
  cta: CTA;
}

const DEFAULT_FORM: CampaignForm = {
  name: '',
  objective: 'AWARENESS',
  dailyBudget: 50000,
  locations: [],
  ageMin: 18,
  ageMax: 45,
  gender: 'ALL',
  interests: [],
  mediaFile: null,
  mediaPreviewUrl: '',
  mediaType: null,
  caption: '',
  cta: 'WHATSAPP_MESSAGE',
};

const CTA_LABELS: Record<CTA, string> = {
  WHATSAPP_MESSAGE: 'Kirim Pesan WhatsApp',
  LEARN_MORE: 'Pelajari Selengkapnya',
  SHOP_NOW: 'Belanja Sekarang',
  SIGN_UP: 'Daftar Sekarang',
};

/* ------------------------------------------------------------------ */
/* Sub-menu definitions                                               */
/* ------------------------------------------------------------------ */
const SUB_MENUS = [
  { id: 'whatsapp-status-ads', label: 'WhatsApp Status Ads', icon: MessageCircle },
];

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */
export const MarketingScreen: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState('whatsapp-status-ads');

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
            <Megaphone className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Marketing — Iklan WhatsApp Status
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Buat iklan resmi Meta yang tayang di jeda interval Status WhatsApp pengguna lain.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-menu tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start w-fit">
        {SUB_MENUS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveSubMenu(m.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubMenu === m.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <m.icon className="w-4 h-4" />
            {m.label}
          </button>
        ))}
      </div>

      {activeSubMenu === 'whatsapp-status-ads' && <WhatsAppStatusAds />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* WhatsApp Status Ads — 5-step flow                                 */
/* ------------------------------------------------------------------ */
const WhatsAppStatusAds: React.FC = () => {
  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState<BusinessAccount>({
    metaBusinessId: '',
    facebookPageId: '',
    whatsappBusinessNumber: '',
    connected: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [form, setForm] = useState<CampaignForm>(DEFAULT_FORM);
  const [locationInput, setLocationInput] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [publishMessage, setPublishMessage] = useState('');

  const totalSteps = 5;

  /* ---- Step 1: Business Account Setup ---- */
  const handleConnectFacebook = async () => {
    setConnecting(true);
    // TODO: integrasi OAuth Facebook Login for Business
    // window.location.href = 'https://www.facebook.com/v19.0/dialog/oauth?client_id=...&redirect_uri=...&scope=...';
    setTimeout(() => {
      setBusiness({
        metaBusinessId: 'MB-123456789',
        facebookPageId: 'FB-PAGE-987654',
        whatsappBusinessNumber: '6281234567890',
        connected: true,
      });
      setConnecting(false);
    }, 1500);
  };

  /* ---- Step 2 helpers ---- */
  const setField = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /* ---- Step 3 helpers ---- */
  const addLocation = () => {
    const v = locationInput.trim();
    if (v && !form.locations.includes(v)) {
      setField('locations', [...form.locations, v]);
    }
    setLocationInput('');
  };
  const removeLocation = (v: string) => setField('locations', form.locations.filter((x) => x !== v));
  const addInterest = () => {
    const v = interestInput.trim();
    if (v && !form.interests.includes(v)) {
      setField('interests', [...form.interests, v]);
    }
    setInterestInput('');
  };
  const removeInterest = (v: string) => setField('interests', form.interests.filter((x) => x !== v));

  /* ---- Step 4: Media upload ---- */
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      alert('Hanya file gambar atau video yang diperbolehkan.');
      return;
    }
    // Validasi rasio 9:16 (cek via Image/Video metadata)
    const url = URL.createObjectURL(file);
    if (isImage) {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        const target = 9 / 16;
        if (Math.abs(ratio - target) > 0.05) {
          alert('Media harus ber-rasio 9:16 (vertikal full screen).');
          URL.revokeObjectURL(url);
          return;
        }
        setField('mediaFile', file);
        setField('mediaPreviewUrl', url);
        setField('mediaType', 'image');
      };
      img.src = url;
    } else {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        const ratio = video.videoWidth / video.videoHeight;
        const target = 9 / 16;
        if (Math.abs(ratio - target) > 0.05) {
          alert('Video harus ber-rasio 9:16 (vertikal full screen).');
          URL.revokeObjectURL(url);
          return;
        }
        setField('mediaFile', file);
        setField('mediaPreviewUrl', url);
        setField('mediaType', 'video');
      };
      video.src = url;
    }
  };

  /* ---- Step 5: Publish ---- */
  const handlePublish = async () => {
    if (!business.connected) {
      setPublishStatus('error');
      setPublishMessage('Hubungkan akun bisnis terlebih dahulu (Step 1).');
      return;
    }
    setPublishing(true);
    setPublishStatus('idle');
    try {
      // Payload yang akan dikirim ke backend (Meta Marketing API)
      const payload = {
        business: business,
        campaign: {
          name: form.name,
          objective: form.objective,
          dailyBudget: form.dailyBudget,
        },
        targeting: {
          locations: form.locations,
          ageMin: form.ageMin,
          ageMax: form.ageMax,
          gender: form.gender,
          interests: form.interests,
          placements: 'ADVANTAGE_PLUS',
          priorityPlacements: ['WHATSAPP_STATUS', 'INSTAGRAM_STORIES'],
        },
        creative: {
          mediaType: form.mediaType,
          caption: form.caption,
          cta: form.cta,
        },
      };

      const res = await fetch('/api/marketing/whatsapp-status-ads/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal menerbitkan iklan.');

      setPublishStatus('success');
      setPublishMessage(`Iklan berhasil diterbitkan! Campaign ID: ${data.campaignId || '-'}`);
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
      case 2: return form.name.trim().length > 0 && form.dailyBudget > 0;
      case 3: return form.locations.length > 0;
      case 4: return !!form.mediaFile && form.caption.trim().length > 0;
      default: return true;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {[
            { n: 1, label: 'Akun Bisnis' },
            { n: 2, label: 'Kampanye' },
            { n: 3, label: 'Target & Penempatan' },
            { n: 4, label: 'Materi Iklan' },
            { n: 5, label: 'Terbitkan' },
          ].map((s, idx) => (
            <React.Fragment key={s.n}>
              <button
                type="button"
                onClick={() => s.n < step && setStep(s.n)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  step === s.n
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : step > s.n
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                  step === s.n ? 'bg-white/20' : step > s.n ? 'bg-emerald-200' : 'bg-slate-200'
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
        {/* Form panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          {step === 1 && (
            <BusinessAccountSetup business={business} connecting={connecting} onConnect={handleConnectFacebook} />
          )}
          {step === 2 && (
            <CampaignSetup form={form} setField={setField} />
          )}
          {step === 3 && (
            <TargetingPlacement
              form={form}
              setField={setField}
              locationInput={locationInput}
              setLocationInput={setLocationInput}
              addLocation={addLocation}
              removeLocation={removeLocation}
              interestInput={interestInput}
              setInterestInput={setInterestInput}
              addInterest={addInterest}
              removeInterest={removeInterest}
            />
          )}
          {step === 4 && (
            <AdCreative
              form={form}
              setField={setField}
              onMediaChange={handleMediaChange}
            />
          )}
          {step === 5 && (
            <PublishReview
              business={business}
              form={form}
              publishing={publishing}
              onPublish={handlePublish}
            />
          )}
        </div>

        {/* Live Ad Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Pratinjau Iklan</h3>
          </div>
          <LiveAdPreview form={form} />
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
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
          >
            Lanjut <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Step 1: Business Account Setup                                     */
/* ------------------------------------------------------------------ */
const BusinessAccountSetup: React.FC<{
  business: BusinessAccount;
  connecting: boolean;
  onConnect: () => void;
}> = ({ business, connecting, onConnect }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">1. Persiapan Akun Bisnis</h2>
    <p className="text-xs text-slate-500">
      Hubungkan akun Meta Business Manager, Facebook Page, dan Nomor WhatsApp Business Anda.
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatusCard label="Meta Business Manager" value={business.metaBusinessId || '—'} connected={business.connected} />
      <StatusCard label="Facebook Page" value={business.facebookPageId || '—'} connected={business.connected} />
      <StatusCard label="Nomor WhatsApp Business" value={business.whatsappBusinessNumber || '—'} connected={business.connected} />
    </div>

    <button
      type="button"
      onClick={onConnect}
      disabled={connecting || business.connected}
      className="w-full py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
      {business.connected ? 'Terhubung' : connecting ? 'Menghubungkan...' : 'Hubungkan dengan Facebook'}
    </button>

    {business.connected && (
      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> Akun bisnis berhasil terhubung.
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
/* Step 2: Campaign Setup                                            */
/* ------------------------------------------------------------------ */
const CampaignSetup: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
}> = ({ form, setField }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">2. Setup Kampanye</h2>

    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kampanye</label>
      <input
        type="text"
        value={form.name}
        onChange={(e) => setField('name', e.target.value)}
        placeholder="Contoh: Promo Stiker Wrapping Ramadan"
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>

    <div>
      <label className="block text-xs font-bold text-slate-700 mb-2">Tujuan Kampanye</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          { value: 'AWARENESS' as CampaignObjective, label: 'Kesadaran Merek', desc: 'Meningkatkan awareness brand Anda' },
          { value: 'SALES' as CampaignObjective, label: 'Penjualan / Pesan Masuk', desc: 'Mendorong chat & pembelian' },
        ]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setField('objective', opt.value)}
            className={`text-left rounded-xl border p-4 transition-all cursor-pointer ${
              form.objective === opt.value
                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                form.objective === opt.value ? 'border-emerald-500' : 'border-slate-300'
              }`}>
                {form.objective === opt.value && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
              </span>
              <span className="text-sm font-bold text-slate-900">{opt.label}</span>
            </div>
            <p className="text-[11px] text-slate-500 ml-6">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Anggaran Harian (Rp)</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">Rp</span>
        <input
          type="number"
          value={form.dailyBudget}
          onChange={(e) => setField('dailyBudget', Number(e.target.value))}
          min={10000}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">Minimum Rp 10.000 / hari</p>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 3: Targeting & Placement                                     */
/* ------------------------------------------------------------------ */
const TargetingPlacement: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  locationInput: string;
  setLocationInput: (v: string) => void;
  addLocation: () => void;
  removeLocation: (v: string) => void;
  interestInput: string;
  setInterestInput: (v: string) => void;
  addInterest: () => void;
  removeInterest: (v: string) => void;
}> = ({ form, setField, locationInput, setLocationInput, addLocation, removeLocation, interestInput, setInterestInput, addInterest, removeInterest }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">3. Target & Penempatan</h2>

    {/* Locations */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Target</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={locationInput}
          onChange={(e) => setLocationInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
          placeholder="Ketik kota/kabupaten, Enter untuk tambah"
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button type="button" onClick={addLocation} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 cursor-pointer">
          Tambah
        </button>
      </div>
      {form.locations.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {form.locations.map((loc) => (
            <span key={loc} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-semibold">
              <MapPin className="w-3 h-3" /> {loc}
              <button type="button" onClick={() => removeLocation(loc)} className="ml-1 hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>

    {/* Age range */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">
        Rentang Usia: {form.ageMin} — {form.ageMax} tahun
      </label>
      <div className="flex gap-4">
        <input
          type="range"
          min={13}
          max={65}
          value={form.ageMin}
          onChange={(e) => setField('ageMin', Math.min(Number(e.target.value), form.ageMax - 1))}
          className="flex-1 accent-emerald-600"
        />
        <input
          type="range"
          min={13}
          max={65}
          value={form.ageMax}
          onChange={(e) => setField('ageMax', Math.max(Number(e.target.value), form.ageMin + 1))}
          className="flex-1 accent-emerald-600"
        />
      </div>
    </div>

    {/* Gender */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Kelamin</label>
      <select
        value={form.gender}
        onChange={(e) => setField('gender', e.target.value as Gender)}
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="ALL">Semua</option>
        <option value="MALE">Laki-laki</option>
        <option value="FEMALE">Perempuan</option>
      </select>
    </div>

    {/* Interests */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Minat / Interest</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={interestInput}
          onChange={(e) => setInterestInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
          placeholder="Contoh: stiker, digital printing, branding"
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button type="button" onClick={addInterest} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 cursor-pointer">
          Tambah
        </button>
      </div>
      {form.interests.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {form.interests.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 text-xs font-semibold">
              <Tag className="w-3 h-3" /> {tag}
              <button type="button" onClick={() => removeInterest(tag)} className="ml-1 hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>

    {/* Placement info */}
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
      <Globe className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold">Penempatan dioptimalkan otomatis untuk WhatsApp Status</p>
        <p className="text-[11px] text-blue-700 mt-0.5">
          Backend menggunakan Advantage+ Placements dengan prioritas WhatsApp Status & Instagram Stories (rasio 9:16).
        </p>
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 4: Ad Creative & Preview                                     */
/* ------------------------------------------------------------------ */
const AdCreative: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  onMediaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ form, setField, onMediaChange }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">4. Materi Iklan & Pratinjau</h2>

    {/* Drop zone */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Media (Foto/Video 9:16)</label>
      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all">
        <input type="file" accept="image/*,video/*" onChange={onMediaChange} className="hidden" />
        {form.mediaFile ? (
          <div className="text-center">
            {form.mediaType === 'image' ? <ImageIcon className="w-8 h-8 text-emerald-600 mx-auto mb-2" /> : <Video className="w-8 h-8 text-emerald-600 mx-auto mb-2" />}
            <p className="text-xs font-semibold text-slate-700">{form.mediaFile.name}</p>
            <p className="text-[10px] text-slate-400 mt-1">Klik untuk ganti media</p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">Drag & drop atau klik untuk upload</p>
            <p className="text-[10px] text-slate-400 mt-1">Hanya rasio 9:16 (vertikal full screen)</p>
          </div>
        )}
      </label>
    </div>

    {/* Caption */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Caption / Teks Promosi (Hook)</label>
      <textarea
        value={form.caption}
        onChange={(e) => setField('caption', e.target.value)}
        rows={4}
        placeholder="Tulis caption menarik untuk iklan Anda..."
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
      />
    </div>

    {/* CTA */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Call to Action (CTA)</label>
      <select
        value={form.cta}
        onChange={(e) => setField('cta', e.target.value as CTA)}
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {Object.entries(CTA_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 5: Publish Review                                            */
/* ------------------------------------------------------------------ */
const PublishReview: React.FC<{
  business: BusinessAccount;
  form: CampaignForm;
  publishing: boolean;
  onPublish: () => void;
}> = ({ business, form, publishing, onPublish }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">5. Ringkasan & Terbitkan</h2>

    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
      <Row label="Akun Bisnis" value={business.connected ? business.facebookPageId : 'Belum terhubung'} />
      <Row label="Nama Kampanye" value={form.name || '—'} />
      <Row label="Tujuan" value={form.objective === 'AWARENESS' ? 'Kesadaran Merek' : 'Penjualan / Pesan Masuk'} />
      <Row label="Anggaran Harian" value={`Rp ${form.dailyBudget.toLocaleString('id-ID')}`} />
      <Row label="Lokasi" value={form.locations.join(', ') || '—'} />
      <Row label="Usia" value={`${form.ageMin} — ${form.ageMax} tahun`} />
      <Row label="Gender" value={form.gender === 'ALL' ? 'Semua' : form.gender === 'MALE' ? 'Laki-laki' : 'Perempuan'} />
      <Row label="Minat" value={form.interests.join(', ') || '—'} />
      <Row label="Media" value={form.mediaFile ? form.mediaFile.name : '—'} />
      <Row label="CTA" value={CTA_LABELS[form.cta]} />
    </div>

    <button
      type="button"
      onClick={onPublish}
      disabled={publishing}
      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
      {publishing ? 'Menerbitkan...' : 'Terbitkan Iklan Sekarang'}
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
/* Live Ad Preview — WhatsApp Status mockup                          */
/* ------------------------------------------------------------------ */
const LiveAdPreview: React.FC<{ form: CampaignForm }> = ({ form }) => (
  <div className="mx-auto w-[220px] h-[400px] bg-black rounded-[2rem] border-4 border-slate-800 relative overflow-hidden shadow-xl">
    {/* Status bar */}
    <div className="absolute top-0 left-0 right-0 h-6 bg-black/60 z-10 flex items-center justify-between px-3">
      <span className="text-[8px] text-white font-bold">9:41</span>
      <span className="text-[8px] text-white">●●●</span>
    </div>
    {/* Media */}
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      {form.mediaPreviewUrl ? (
        form.mediaType === 'image' ? (
          <img src={form.mediaPreviewUrl} alt="preview" className="w-full h-full object-cover" />
        ) : (
          <video src={form.mediaPreviewUrl} className="w-full h-full object-cover" autoPlay muted loop />
        )
      ) : (
        <div className="text-center text-slate-500">
          <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-[10px]">Upload media 9:16</p>
        </div>
      )}
    </div>
    {/* Gradient overlay bottom */}
    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent z-10" />
    {/* Caption & CTA */}
    <div className="absolute bottom-3 left-3 right-3 z-20 space-y-2">
      {form.caption && (
        <p className="text-[10px] text-white font-medium line-clamp-3 drop-shadow">{form.caption}</p>
      )}
      <button className="w-full bg-emerald-600 text-white text-[10px] font-bold py-1.5 rounded-lg">
        {CTA_LABELS[form.cta]}
      </button>
    </div>
    {/* Sponsored label */}
    <div className="absolute top-8 left-3 z-20">
      <span className="text-[8px] text-white/80 bg-black/40 px-2 py-0.5 rounded-full">Disponsori</span>
    </div>
  </div>
);