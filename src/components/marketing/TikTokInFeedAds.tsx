/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Marketing Module — TikTok In-Feed Ads (TikTok Marketing API)
 * Coded by Langgo Bramandityo.
 */
import React, { useEffect, useState } from 'react';
import {
  Music2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
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
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  X,
} from 'lucide-react';
import {
  fileToBase64Payload,
  formatMb,
  MARKETING_MAX_VIDEO_BYTES,
} from '../../utils/marketingMedia';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type CampaignObjective = 'VIDEO_VIEWS' | 'TRAFFIC' | 'CONVERSIONS';
type Gender = 'ALL' | 'MALE' | 'FEMALE';
type CTA = 'SHOP_NOW' | 'LEARN_MORE' | 'SIGN_UP' | 'DOWNLOAD' | 'CONTACT_US';

interface BusinessAccount {
  tiktokForBusinessId: string;
  tiktokAdsManagerId: string;
  tiktokOrganicHandle: string;
  connected: boolean;
  simulated: boolean;
}

interface CampaignForm {
  name: string;
  objective: CampaignObjective;
  dailyBudget: number;
  locations: string[];
  ageGroups: string[];
  gender: Gender;
  interests: string[];
  mediaFile: File | null;
  mediaPreviewUrl: string;
  mediaDuration: number;
  adText: string;
  landingPageUrl: string;
  cta: CTA;
}

const DEFAULT_FORM: CampaignForm = {
  name: '',
  objective: 'VIDEO_VIEWS',
  dailyBudget: 50000,
  locations: [],
  ageGroups: [],
  gender: 'ALL',
  interests: [],
  mediaFile: null,
  mediaPreviewUrl: '',
  mediaDuration: 0,
  adText: '',
  landingPageUrl: '',
  cta: 'LEARN_MORE',
};

const AGE_GROUPS = [
  { value: '13-17', label: '13-17' },
  { value: '18-24', label: '18-24' },
  { value: '25-34', label: '25-34' },
  { value: '35-44', label: '35-44' },
  { value: '45-54', label: '45-54' },
  { value: '55+', label: '55+' },
];

const CTA_LABELS: Record<CTA, string> = {
  SHOP_NOW: 'Beli Sekarang',
  LEARN_MORE: 'Selengkapnya',
  SIGN_UP: 'Pelajari Selengkapnya',
  DOWNLOAD: 'Unduh',
  CONTACT_US: 'Hubungi Kami',
};

const OBJECTIVE_LABELS: Record<CampaignObjective, { label: string; desc: string }> = {
  VIDEO_VIEWS: { label: 'Penayangan Video', desc: 'Maksimalkan jumlah tayangan video iklan Anda' },
  TRAFFIC: { label: 'Lalu Lintas Web', desc: 'Arahkan pengguna ke website/landing page' },
  CONVERSIONS: { label: 'Konversi Produk', desc: 'Mendorong pembelian atau aksi konversi' },
};

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */
interface TikTokInFeedAdsProps {
  defaultLandingUrl?: string;
}

export const TikTokInFeedAds: React.FC<TikTokInFeedAdsProps> = ({ defaultLandingUrl = '' }) => {
  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState<BusinessAccount>({
    tiktokForBusinessId: '',
    tiktokAdsManagerId: '',
    tiktokOrganicHandle: '',
    connected: false,
    simulated: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [form, setForm] = useState<CampaignForm>(DEFAULT_FORM);
  const [locationInput, setLocationInput] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [publishMessage, setPublishMessage] = useState('');

  const totalSteps = 5;

  useEffect(() => {
    if (!defaultLandingUrl) return;
    setForm((prev) =>
      prev.landingPageUrl ? prev : { ...prev, landingPageUrl: defaultLandingUrl }
    );
  }, [defaultLandingUrl]);

  /* ---- Step 1: Business Account Setup ---- */
  const handleConnect = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch('/api/marketing/tiktok-infeed-ads/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiktokForBusinessId: business.tiktokForBusinessId,
          tiktokAdsManagerId: business.tiktokAdsManagerId,
          tiktokOrganicHandle: business.tiktokOrganicHandle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal menghubungkan.');
      setBusiness((prev) => ({ ...prev, connected: true, simulated: Boolean(data.simulated) }));
    } catch (err: any) {
      setConnectError(err?.message || 'Terjadi kesalahan saat menghubungkan.');
      setBusiness((prev) => ({ ...prev, connected: false, simulated: false }));
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

  /* ---- Step 3 helpers ---- */
  const addLocation = () => {
    const v = locationInput.trim();
    if (v && !form.locations.includes(v)) {
      setField('locations', [...form.locations, v]);
    }
    setLocationInput('');
  };
  const removeLocation = (v: string) => setField('locations', form.locations.filter((x) => x !== v));
  const toggleAgeGroup = (g: string) => {
    if (form.ageGroups.includes(g)) {
      setField('ageGroups', form.ageGroups.filter((x) => x !== g));
    } else {
      setField('ageGroups', [...form.ageGroups, g]);
    }
  };
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
    if (!file.type.startsWith('video/')) {
      alert('Hanya file video yang diperbolehkan untuk TikTok In-Feed Ads.');
      return;
    }
    if (file.size > MARKETING_MAX_VIDEO_BYTES) {
      alert(`Ukuran video terlalu besar. Maksimal ${formatMb(MARKETING_MAX_VIDEO_BYTES)}.`);
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      const ratio = video.videoWidth / video.videoHeight;
      const target = 9 / 16;
      if (Math.abs(ratio - target) > 0.05) {
        alert('Video harus ber-rasio 9:16 (vertikal full screen).');
        URL.revokeObjectURL(url);
        return;
      }
      if (video.duration < 9 || video.duration > 60) {
        alert('Durasi video disarankan 9-60 detik.');
      }
      setField('mediaFile', file);
      setField('mediaPreviewUrl', url);
      setField('mediaDuration', Math.round(video.duration));
    };
    video.src = url;
  };

  /* ---- Step 5: Publish ---- */
  const handlePublish = async () => {
    if (!business.connected) {
      setPublishStatus('error');
      setPublishMessage('Hubungkan akun bisnis terlebih dahulu (Step 1).');
      return;
    }
    if (!form.mediaFile) {
      setPublishStatus('error');
      setPublishMessage('Video iklan (9:16) wajib diunggah.');
      return;
    }
    setPublishing(true);
    setPublishStatus('idle');
    try {
      const media = await fileToBase64Payload(form.mediaFile);
      const payload = {
        business: business,
        campaign: {
          name: form.name,
          objective: form.objective,
          dailyBudget: form.dailyBudget,
        },
        targeting: {
          locations: form.locations,
          ageGroups: form.ageGroups,
          gender: form.gender,
          interests: form.interests,
          placements: 'TIKTOK_IN_FEED',
          priorityPlacements: ['FYP', 'FRIENDS_FEED'],
        },
        creative: {
          mediaType: 'video',
          media,
          duration: form.mediaDuration,
          adText: form.adText,
          landingPageUrl: form.landingPageUrl,
          cta: form.cta,
        },
      };

      const res = await fetch('/api/marketing/tiktok-infeed-ads/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal menerbitkan iklan.');

      const warnings =
        Array.isArray(data.warnings) && data.warnings.length ? ` Catatan: ${data.warnings.join(' ')}` : '';
      const ids = [
        data.campaignId ? `Campaign ID: ${data.campaignId}` : '',
        data.adGroupId ? `Ad Group ID: ${data.adGroupId}` : '',
        data.adId ? `Ad ID: ${data.adId}` : '',
      ].filter(Boolean).join(' | ');
      setPublishStatus('success');
      setPublishMessage(`${data.message || 'Iklan TikTok berhasil diterbitkan.'}${ids ? ` ${ids}.` : ''}${warnings}`);
      setStep(1);
      setForm({ ...DEFAULT_FORM, landingPageUrl: form.landingPageUrl || defaultLandingUrl });
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
      case 3: return form.locations.length > 0 && form.ageGroups.length > 0;
      case 4: return !!form.mediaFile && form.adText.trim().length > 0 && form.landingPageUrl.trim().length > 0;
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
                    ? 'bg-black text-white shadow-xs'
                    : step > s.n
                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                  step === s.n ? 'bg-white/20' : step > s.n ? 'bg-slate-300' : 'bg-slate-200'
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
            <TikTokBusinessSetup
              business={business}
              connecting={connecting}
              connectError={connectError}
              onConnect={handleConnect}
              onChange={handleBusinessField}
            />
          )}
          {step === 2 && (
            <TikTokCampaignSetup form={form} setField={setField} />
          )}
          {step === 3 && (
            <TikTokTargeting
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
              toggleAgeGroup={toggleAgeGroup}
            />
          )}
          {step === 4 && (
            <TikTokAdCreative form={form} setField={setField} onMediaChange={handleMediaChange} />
          )}
          {step === 5 && (
            <TikTokPublishReview business={business} form={form} publishing={publishing} onPublish={handlePublish} />
          )}
        </div>

        {/* Live Ad Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Pratinjau Iklan</h3>
          </div>
          <TikTokLivePreview form={form} />
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
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-black text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
          >
            Lanjut <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Step 1: TikTok Business Account Setup                              */
/* ------------------------------------------------------------------ */
const TikTokBusinessSetup: React.FC<{
  business: BusinessAccount;
  connecting: boolean;
  connectError: string;
  onConnect: () => void;
  onChange: (key: keyof BusinessAccount, value: string) => void;
}> = ({ business, connecting, connectError, onConnect, onChange }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">1. Persiapan Akun Bisnis TikTok</h2>
    <p className="text-xs text-slate-500">
      Isi data akun TikTok For Business Anda secara manual, lalu klik "Verifikasi & Hubungkan".
    </p>

    <div className="grid grid-cols-1 gap-3">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">TikTok For Business Account ID</label>
        <input
          type="text"
          value={business.tiktokForBusinessId}
          onChange={(e) => onChange('tiktokForBusinessId', e.target.value)}
          placeholder="Contoh: 7123456789012345678"
          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">TikTok Ads Manager Account ID</label>
        <input
          type="text"
          value={business.tiktokAdsManagerId}
          onChange={(e) => onChange('tiktokAdsManagerId', e.target.value)}
          placeholder="Contoh: 1234567890123456789"
          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Handle Akun TikTok Organik/Bisnis</label>
        <input
          type="text"
          value={business.tiktokOrganicHandle}
          onChange={(e) => onChange('tiktokOrganicHandle', e.target.value)}
          placeholder="Contoh: @bejostiker"
          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatusCard label="TikTok For Business" value={business.tiktokForBusinessId || '—'} connected={business.connected} />
      <StatusCard label="Ads Manager" value={business.tiktokAdsManagerId || '—'} connected={business.connected} />
      <StatusCard label="Akun Organik" value={business.tiktokOrganicHandle || '—'} connected={business.connected} />
    </div>

    <button
      type="button"
      onClick={onConnect}
      disabled={connecting || !business.tiktokForBusinessId || !business.tiktokAdsManagerId || !business.tiktokOrganicHandle}
      className="w-full py-3 bg-black hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
      {business.connected ? 'Terhubung ✓' : connecting ? 'Memverifikasi...' : 'Verifikasi & Hubungkan ke TikTok'}
    </button>

    {connectError && (
      <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> {connectError}
      </div>
    )}

    {business.connected && (
      <div
        className={`text-xs rounded-xl px-3 py-2 flex items-center gap-2 ${
          business.simulated
            ? 'text-amber-800 bg-amber-50 border border-amber-200'
            : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
        }`}
      >
        {business.simulated ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        {business.simulated
          ? 'Mode simulasi: kredensial TikTok belum disetel di server. Alur dapat diuji, tetapi iklan tidak dikirim ke TikTok.'
          : 'Akun bisnis TikTok berhasil terhubung.'}
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
const TikTokCampaignSetup: React.FC<{
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
        placeholder="Contoh: Promo Stiker Wrapping TikTok"
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black"
      />
    </div>

    <div>
      <label className="block text-xs font-bold text-slate-700 mb-2">Tujuan Kampanye</label>
      <div className="grid grid-cols-1 gap-3">
        {(Object.keys(OBJECTIVE_LABELS) as CampaignObjective[]).map((key) => {
          const opt = OBJECTIVE_LABELS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setField('objective', key)}
              className={`text-left rounded-xl border p-4 transition-all cursor-pointer ${
                form.objective === key
                  ? 'border-black bg-slate-50 ring-2 ring-slate-300'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  form.objective === key ? 'border-black' : 'border-slate-300'
                }`}>
                  {form.objective === key && <span className="w-2 h-2 rounded-full bg-black" />}
                </span>
                <span className="text-sm font-bold text-slate-900">{opt.label}</span>
              </div>
              <p className="text-[11px] text-slate-500 ml-6">{opt.desc}</p>
            </button>
          );
        })}
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
          className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">Minimum Rp 10.000 / hari</p>
    </div>

    {form.objective === 'CONVERSIONS' && (
      <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        Objective Konversi memerlukan <span className="font-mono font-semibold">TIKTOK_PIXEL_ID</span> pada
        konfigurasi server. Tanpa pixel, pilih Lalu Lintas atau Penayangan Video.
      </div>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 3: Targeting & Placement                                     */
/* ------------------------------------------------------------------ */
const TikTokTargeting: React.FC<{
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
  toggleAgeGroup: (g: string) => void;
}> = ({ form, setField, locationInput, setLocationInput, addLocation, removeLocation, interestInput, setInterestInput, addInterest, removeInterest, toggleAgeGroup }) => (
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
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button type="button" onClick={addLocation} className="px-4 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer">
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

    {/* Age groups */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-2">Kelompok Usia (TikTok)</label>
      <div className="flex flex-wrap gap-2">
        {AGE_GROUPS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => toggleAgeGroup(g.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
              form.ageGroups.includes(g.value)
                ? 'bg-black text-white border-black'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>

    {/* Gender */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Kelamin</label>
      <select
        value={form.gender}
        onChange={(e) => setField('gender', e.target.value as Gender)}
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black"
      >
        <option value="ALL">Semua</option>
        <option value="MALE">Laki-laki</option>
        <option value="FEMALE">Perempuan</option>
      </select>
    </div>

    {/* Interests */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Minat & Perilaku</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={interestInput}
          onChange={(e) => setInterestInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
          placeholder="Contoh: fashion, gaming, beauty"
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button type="button" onClick={addInterest} className="px-4 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer">
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
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 flex items-start gap-2">
      <Music2 className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold">Iklan akan ditayangkan secara alami di sela-sela FYP target audiens Anda</p>
        <p className="text-[11px] text-slate-600 mt-0.5">
          Penempatan otomatis ke TikTok In-Feed Ads (FYP & Friends Feed) dengan format video vertikal 9:16.
        </p>
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Step 4: Ad Creative & Preview                                     */
/* ------------------------------------------------------------------ */
const TikTokAdCreative: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  onMediaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ form, setField, onMediaChange }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">4. Materi Iklan & Pratinjau</h2>

    {/* Drop zone */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Video Iklan (9:16, 9-60 detik)</label>
      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all">
        <input type="file" accept="video/*" onChange={onMediaChange} className="hidden" />
        {form.mediaFile ? (
          <div className="text-center">
            <Video className="w-8 h-8 text-black mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">{form.mediaFile.name}</p>
            <p className="text-[10px] text-slate-400 mt-1">Durasi: {form.mediaDuration}s — Klik untuk ganti</p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">Drag & drop atau klik untuk upload video</p>
            <p className="text-[10px] text-slate-400 mt-1">Hanya rasio 9:16 (vertikal full screen)</p>
          </div>
        )}
      </label>
    </div>

    {/* Ad Text */}
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-bold text-slate-700">Teks Iklan (TikTok Caption)</label>
        <span className={`text-[10px] font-mono ${form.adText.length > 100 ? 'text-rose-600' : 'text-slate-400'}`}>
          {form.adText.length}/100
        </span>
      </div>
      <textarea
        value={form.adText}
        onChange={(e) => setField('adText', e.target.value.slice(0, 100))}
        rows={4}
        maxLength={100}
        placeholder="Tulis caption menarik untuk iklan TikTok Anda..."
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black resize-none"
      />
    </div>

    {/* Landing page */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Landing Page URL</label>
      <input
        type="url"
        value={form.landingPageUrl}
        onChange={(e) => setField('landingPageUrl', e.target.value)}
        placeholder="https://bejodigitalprint.com"
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black"
      />
      <p className="text-[10px] text-slate-400 mt-1">
        Tujuan klik tombol CTA. Terisi otomatis dari APP_URL server; dapat diubah.
      </p>
    </div>

    {/* CTA */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Call to Action (CTA)</label>
      <select
        value={form.cta}
        onChange={(e) => setField('cta', e.target.value as CTA)}
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black"
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
const TikTokPublishReview: React.FC<{
  business: BusinessAccount;
  form: CampaignForm;
  publishing: boolean;
  onPublish: () => void;
}> = ({ business, form, publishing, onPublish }) => (
  <div className="space-y-4">
    <h2 className="text-base font-extrabold text-slate-900">5. Ringkasan & Terbitkan</h2>

    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
      <Row label="Akun Bisnis" value={business.connected ? business.tiktokAdsManagerId : 'Belum terhubung'} />
      <Row label="Mode" value={business.simulated ? 'Simulasi (belum live)' : 'Live API TikTok'} />
      <Row label="Nama Kampanye" value={form.name || '—'} />
      <Row label="Tujuan" value={OBJECTIVE_LABELS[form.objective].label} />
      <Row label="Anggaran Harian" value={`Rp ${form.dailyBudget.toLocaleString('id-ID')}`} />
      <Row label="Lokasi" value={form.locations.join(', ') || '—'} />
      <Row label="Usia" value={form.ageGroups.join(', ') || '—'} />
      <Row label="Gender" value={form.gender === 'ALL' ? 'Semua' : form.gender === 'MALE' ? 'Laki-laki' : 'Perempuan'} />
      <Row label="Minat" value={form.interests.join(', ') || '—'} />
      <Row label="Landing Page" value={form.landingPageUrl || '—'} />
      <Row label="Media" value={form.mediaFile ? `${form.mediaFile.name} (${form.mediaDuration}s)` : '—'} />
      <Row label="CTA" value={CTA_LABELS[form.cta]} />
    </div>

    <button
      type="button"
      onClick={onPublish}
      disabled={publishing}
      className="w-full py-3.5 bg-black hover:bg-slate-800 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
      {publishing ? 'Menerbitkan...' : 'Terbitkan Iklan TikTok Sekarang'}
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
/* Live Ad Preview — TikTok FYP mockup                                */
/* ------------------------------------------------------------------ */
const TikTokLivePreview: React.FC<{ form: CampaignForm }> = ({ form }) => (
  <div className="mx-auto w-[220px] h-[400px] bg-black rounded-[2rem] border-4 border-slate-800 relative overflow-hidden shadow-xl">
    {/* Status bar */}
    <div className="absolute top-0 left-0 right-0 h-6 bg-black/60 z-10 flex items-center justify-between px-3">
      <span className="text-[8px] text-white font-bold">9:41</span>
      <span className="text-[8px] text-white">●●●</span>
    </div>
    {/* Video */}
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      {form.mediaPreviewUrl ? (
        <video src={form.mediaPreviewUrl} className="w-full h-full object-cover" autoPlay muted loop />
      ) : (
        <div className="text-center text-slate-500">
          <Video className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-[10px]">Upload video 9:16</p>
        </div>
      )}
    </div>
    {/* Gradient overlay bottom */}
    <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/80 to-transparent z-10" />
    {/* Right side icons */}
    <div className="absolute right-2 bottom-24 z-20 flex flex-col items-center gap-3">
      <div className="flex flex-col items-center">
        <Heart className="w-6 h-6 text-white" />
        <span className="text-[8px] text-white mt-0.5">12.4K</span>
      </div>
      <div className="flex flex-col items-center">
        <MessageCircle className="w-6 h-6 text-white" />
        <span className="text-[8px] text-white mt-0.5">342</span>
      </div>
      <div className="flex flex-col items-center">
        <Bookmark className="w-6 h-6 text-white" />
        <span className="text-[8px] text-white mt-0.5">891</span>
      </div>
      <div className="flex flex-col items-center">
        <Share2 className="w-6 h-6 text-white" />
        <span className="text-[8px] text-white mt-0.5">56</span>
      </div>
    </div>
    {/* Caption & CTA */}
    <div className="absolute bottom-3 left-3 right-12 z-20 space-y-2">
      {form.adText && (
        <p className="text-[10px] text-white font-medium line-clamp-2 drop-shadow">{form.adText}</p>
      )}
      <button className="bg-white text-black text-[10px] font-bold py-1.5 px-3 rounded-full">
        {CTA_LABELS[form.cta]}
      </button>
    </div>
    {/* Sponsored label */}
    <div className="absolute top-8 left-3 z-20">
      <span className="text-[8px] text-white/80 bg-black/40 px-2 py-0.5 rounded-full">Disponsori</span>
    </div>
    {/* Music disc */}
    <div className="absolute bottom-3 right-2 z-20">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-yellow-400 border-2 border-white animate-spin" style={{ animationDuration: '3s' }} />
    </div>
  </div>
);