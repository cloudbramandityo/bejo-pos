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
  ChevronRight,
  ChevronLeft,
  Send,
  Link2,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  X,
  Search,
  Plus,
  BadgeCheck,
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

const TIKTOK_STEPS = [
  { n: 1, label: 'Akun Bisnis' },
  { n: 2, label: 'Kampanye' },
  { n: 3, label: 'Grup Iklan' },
  { n: 4, label: 'Iklan' },
  { n: 5, label: 'Tinjau' },
];

const OBJECTIVE_ICONS: Record<CampaignObjective, React.ComponentType<{ className?: string }>> = {
  VIDEO_VIEWS: Video,
  TRAFFIC: Link2,
  CONVERSIONS: Target,
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

      {/* TikTok Ads Manager shell */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#F7F7F8] shadow-xs">
        <div className="bg-[#0F0F10] px-4 py-3 text-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#FE2C55]">
                <Music2 className="h-4 w-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold">TikTok Ads Manager</span>
                <span className="hidden text-[11px] text-white/40 sm:inline">|</span>
                <span className="hidden text-[11px] text-white/70 sm:inline">In-Feed Ads</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-semibold">
                <span className={`h-1.5 w-1.5 rounded-full ${business.connected ? 'bg-emerald-400' : 'bg-white/40'}`} />
                {business.connected
                  ? business.simulated
                    ? 'Akun terhubung · simulasi'
                    : 'Akun terhubung'
                  : 'Belum terhubung'}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold">Draf</span>
            </div>
          </div>
        </div>

        {/* Native step tabs */}
        <div className="border-b border-slate-200 bg-white px-1 sm:px-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {TIKTOK_STEPS.map((s) => {
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
                      ? 'text-[#FE2C55]'
                      : done
                      ? 'cursor-pointer text-slate-700 hover:text-[#FE2C55]'
                      : 'cursor-not-allowed text-slate-400'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                      active
                        ? 'bg-[#FE2C55] text-white'
                        : done
                        ? 'bg-[#FFF0F3] text-[#FE2C55]'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3 w-3" /> : s.n}
                  </span>
                  {s.label}
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#FE2C55]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Native two-column workspace */}
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
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

          <div className="h-fit rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900">Pratinjau iklan</h3>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">9:16</span>
            </div>
            <TikTokLivePreview form={form} />
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
                className="px-3.5 py-2 rounded-md text-xs font-bold bg-[#FE2C55] text-white hover:bg-[#E0264C] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
              >
                Lanjut <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Step 1: TikTok Business Account Setup                              */
/* ------------------------------------------------------------------ */
const TikTokStepHeader: React.FC<{ step: number; title: string; description: string }> = ({
  step,
  title,
  description,
}) => (
  <div className="border-b border-slate-100 pb-3">
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FE2C55]">
      Langkah {step} dari 5
    </p>
    <h2 className="mt-1 text-lg font-bold text-slate-900">{title}</h2>
    <p className="mt-0.5 text-xs text-slate-500">{description}</p>
  </div>
);

const TikTokBusinessSetup: React.FC<{
  business: BusinessAccount;
  connecting: boolean;
  connectError: string;
  onConnect: () => void;
  onChange: (key: keyof BusinessAccount, value: string) => void;
}> = ({ business, connecting, connectError, onConnect, onChange }) => (
  <div className="space-y-4">
    <TikTokStepHeader
      step={1}
      title="Akun Bisnis"
      description="Hubungkan akun TikTok For Business yang akan menayangkan In-Feed Ads."
    />

    <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-[#0F0F10] px-3.5 py-3 text-white">
      <Music2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FE2C55]" />
      <div className="text-[11px] leading-relaxed">
        <p className="font-bold">TikTok Ads Manager</p>
        <p className="text-white/60">Kredensial diperiksa di server. Token tidak pernah dikirim dari browser.</p>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-3">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">TikTok For Business Account ID</label>
        <input
          type="text"
          value={business.tiktokForBusinessId}
          onChange={(e) => onChange('tiktokForBusinessId', e.target.value)}
          placeholder="Contoh: 7123456789012345678"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">TikTok Ads Manager Account ID</label>
        <input
          type="text"
          value={business.tiktokAdsManagerId}
          onChange={(e) => onChange('tiktokAdsManagerId', e.target.value)}
          placeholder="Contoh: 1234567890123456789"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Handle Akun TikTok Organik/Bisnis</label>
        <input
          type="text"
          value={business.tiktokOrganicHandle}
          onChange={(e) => onChange('tiktokOrganicHandle', e.target.value)}
          placeholder="Contoh: @bejostiker"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
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
      className="w-full py-3 bg-[#FE2C55] hover:bg-[#E0264C] text-white font-bold text-xs rounded-md shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
      {business.connected ? 'Terhubung ✓' : connecting ? 'Memverifikasi...' : 'Verifikasi & Hubungkan ke TikTok'}
    </button>

    {connectError && (
      <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> {connectError}
      </div>
    )}

    {business.connected && (
      <div
        className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${
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
  <div className={`rounded-lg border p-3 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
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
    <TikTokStepHeader
      step={2}
      title="Kampanye"
      description="Tentukan tujuan dan anggaran kampanye In-Feed Ads."
    />

    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kampanye</label>
      <input
        type="text"
        value={form.name}
        onChange={(e) => setField('name', e.target.value)}
        placeholder="Contoh: Promo Stiker Wrapping TikTok"
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
      />
    </div>

    <div>
      <label className="block text-xs font-bold text-slate-700 mb-2">Tujuan Kampanye</label>
      <div className="grid grid-cols-1 gap-2.5">
        {(Object.keys(OBJECTIVE_LABELS) as CampaignObjective[]).map((key) => {
          const opt = OBJECTIVE_LABELS[key];
          const Icon = OBJECTIVE_ICONS[key];
          const selected = form.objective === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setField('objective', key)}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all cursor-pointer ${
                selected
                  ? 'border-[#FE2C55] bg-[#FFF0F3] ring-2 ring-[#FE2C55]/15'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                selected ? 'bg-[#FE2C55] text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-slate-900">{opt.label}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
              </div>
              <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                selected ? 'border-[#FE2C55]' : 'border-slate-300'
              }`}>
                {selected && <span className="h-2 w-2 rounded-full bg-[#FE2C55]" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>

    <div className="rounded-lg border border-slate-200 p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700">Anggaran Harian</label>
        <span className="text-[10px] text-slate-400">Minimum Rp 10.000</span>
      </div>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">Rp</span>
        <input
          type="number"
          value={form.dailyBudget}
          onChange={(e) => setField('dailyBudget', Number(e.target.value))}
          min={10000}
          className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
        />
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
        <DollarSign className="h-3 w-3" /> Biaya dihentikan otomatis saat batas harian tercapai.
      </div>
    </div>

    {form.objective === 'CONVERSIONS' && (
      <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
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
    <TikTokStepHeader
      step={3}
      title="Grup Iklan"
      description="Tentukan audiens dan penempatan video In-Feed Anda."
    />

    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
      <Users className="h-3.5 w-3.5 text-[#FE2C55]" /> Target audiens
    </div>

    {/* Locations */}
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-700">
        <MapPin className="h-3 w-3 text-slate-400" /> Lokasi Target
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={locationInput}
          onChange={(e) => setLocationInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
          placeholder="Ketik kota/kabupaten, Enter untuk tambah"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
        />
        <button type="button" onClick={addLocation} className="px-4 py-2.5 bg-[#FE2C55] text-white rounded-md text-xs font-bold hover:bg-[#E0264C] cursor-pointer">
          Tambah
        </button>
      </div>
      {form.locations.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {form.locations.map((loc) => (
            <span key={loc} className="inline-flex items-center gap-1 rounded-full border border-[#FE2C55]/20 bg-[#FFF0F3] px-3 py-1 text-xs font-semibold text-[#C81445]">
              <MapPin className="w-3 h-3" /> {loc}
              <button type="button" onClick={() => removeLocation(loc)} className="ml-1 hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>

    {/* Age groups */}
    <div>
      <label className="mb-2 block text-xs font-bold text-slate-700">Kelompok Usia</label>
      <div className="flex flex-wrap gap-2">
        {AGE_GROUPS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => toggleAgeGroup(g.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
              form.ageGroups.includes(g.value)
                ? 'bg-[#FE2C55] text-white border-[#FE2C55]'
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
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
      >
        <option value="ALL">Semua</option>
        <option value="MALE">Laki-laki</option>
        <option value="FEMALE">Perempuan</option>
      </select>
    </div>

    {/* Interests */}
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-700">
        <Tag className="h-3 w-3 text-slate-400" /> Minat & Perilaku
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={interestInput}
          onChange={(e) => setInterestInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
          placeholder="Contoh: fashion, gaming, beauty"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
        />
        <button type="button" onClick={addInterest} className="px-4 py-2.5 bg-[#FE2C55] text-white rounded-md text-xs font-bold hover:bg-[#E0264C] cursor-pointer">
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

    {/* Placement */}
    <div className="rounded-lg bg-[#0F0F10] p-3.5 text-white">
      <div className="flex items-start gap-2.5">
        <Music2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FE2C55]" />
        <div>
          <p className="text-xs font-bold">Penempatan In-Feed</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-white/60">
            Iklan ditayangkan secara alami di sela video For You dan Friends Feed audiens.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold">For You (FYP)</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold">Friends Feed</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold">Video 9:16</span>
          </div>
        </div>
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
    <TikTokStepHeader
      step={4}
      title="Iklan"
      description="Unggah video vertikal dan lengkapi teks iklan In-Feed."
    />

    <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
      <div>
        <p className="text-[10px] font-bold text-slate-800">9:16</p>
        <p className="text-[9px] text-slate-400">Vertikal</p>
      </div>
      <div className="border-x border-slate-200">
        <p className="text-[10px] font-bold text-slate-800">9–60 detik</p>
        <p className="text-[9px] text-slate-400">Durasi video</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-800">1 video</p>
        <p className="text-[9px] text-slate-400">MP4 / MOV</p>
      </div>
    </div>

    {/* Drop zone */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Video Iklan</label>
      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-[#FFF0F3] hover:border-[#FE2C55]/50 cursor-pointer transition-all">
        <input type="file" accept="video/*" onChange={onMediaChange} className="hidden" />
        {form.mediaFile ? (
          <div className="text-center">
            <Video className="w-8 h-8 text-[#FE2C55] mx-auto mb-2" />
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
        <label className="block text-xs font-bold text-slate-700">Teks Iklan</label>
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
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE2C55] resize-none"
      />
    </div>

    {/* Landing page */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">URL Tujuan</label>
      <input
        type="url"
        value={form.landingPageUrl}
        onChange={(e) => setField('landingPageUrl', e.target.value)}
        placeholder="https://bejodigitalprint.com"
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
      />
      <p className="text-[10px] text-slate-400 mt-1">
        Tujuan klik tombol CTA. Terisi otomatis dari APP_URL server; dapat diubah.
      </p>
    </div>

    {/* CTA */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Ajakan Bertindak (CTA)</label>
      <select
        value={form.cta}
        onChange={(e) => setField('cta', e.target.value as CTA)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FE2C55]"
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
    <TikTokStepHeader
      step={5}
      title="Tinjau & terbitkan"
      description="Periksa kembali kampanye sebelum dikirim ke TikTok Ads Manager."
    />

    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="bg-slate-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Kampanye
      </div>
      <div className="space-y-2.5 p-3.5 text-xs">
        <Row label="Akun Bisnis" value={business.connected ? business.tiktokAdsManagerId : 'Belum terhubung'} />
        <Row label="Mode" value={business.simulated ? 'Simulasi (belum live)' : 'Live API TikTok'} />
        <Row label="Nama Kampanye" value={form.name || '—'} />
        <Row label="Tujuan" value={OBJECTIVE_LABELS[form.objective].label} />
        <Row label="Anggaran Harian" value={`Rp ${form.dailyBudget.toLocaleString('id-ID')}`} />
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Grup Iklan
      </div>
      <div className="space-y-2.5 p-3.5 text-xs">
        <Row label="Lokasi" value={form.locations.join(', ') || '—'} />
        <Row label="Usia" value={form.ageGroups.join(', ') || '—'} />
        <Row label="Gender" value={form.gender === 'ALL' ? 'Semua' : form.gender === 'MALE' ? 'Laki-laki' : 'Perempuan'} />
        <Row label="Minat" value={form.interests.join(', ') || '—'} />
        <Row label="Penempatan" value="In-Feed · For You & Friends Feed" />
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Iklan
      </div>
      <div className="space-y-2.5 p-3.5 text-xs">
        <Row label="URL Tujuan" value={form.landingPageUrl || '—'} />
        <Row label="Media" value={form.mediaFile ? `${form.mediaFile.name} (${form.mediaDuration}s)` : '—'} />
        <Row label="CTA" value={CTA_LABELS[form.cta]} />
      </div>
    </div>

    <button
      type="button"
      onClick={onPublish}
      disabled={publishing}
      className="w-full py-3.5 bg-[#FE2C55] hover:bg-[#E0264C] text-white font-bold text-sm rounded-md shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
/* Live Ad Preview — TikTok In-Feed (FYP)                             */
/* ------------------------------------------------------------------ */
const TikTokLivePreview: React.FC<{ form: CampaignForm }> = ({ form }) => {
  const [feed, setFeed] = useState<'following' | 'foryou'>('foryou');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px]">
        <span className="font-bold text-slate-700">In-Feed Ads</span>
        <span className="text-slate-400">For You & Friends Feed · 9:16</span>
      </div>

      <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-black shadow-lg">
        <div className="relative aspect-[9/16]">
          {/* Video */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-800 via-slate-900 to-black">
            {form.mediaPreviewUrl ? (
              <video src={form.mediaPreviewUrl} className="h-full w-full object-cover" autoPlay muted loop playsInline />
            ) : (
              <div className="px-6 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <Video className="h-6 w-6 text-white/60" />
                </div>
                <p className="text-[11px] font-semibold text-white/80">Video iklan 9:16</p>
                <p className="mt-0.5 text-[9px] text-white/45">Unggah video di langkah Iklan</p>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

          {/* Feed tabs */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-4 pt-2.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setFeed('following')}
              className={`relative pb-1.5 transition-colors cursor-pointer ${
                feed === 'following' ? 'text-white' : 'text-white/55'
              }`}
            >
              Mengikuti
              {feed === 'following' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
            </button>
            <span className="mb-1.5 h-3 w-px bg-white/25" />
            <button
              type="button"
              onClick={() => setFeed('foryou')}
              className={`relative pb-1.5 transition-colors cursor-pointer ${
                feed === 'foryou' ? 'text-white' : 'text-white/55'
              }`}
            >
              Untuk Kamu
              {feed === 'foryou' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
            </button>
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-white" />
          </div>

          <div className="absolute left-2.5 top-12 z-20">
            <span className="rounded bg-black/35 px-1.5 py-0.5 text-[8px] font-semibold text-white backdrop-blur-sm">
              Disponsori
            </span>
          </div>

          {/* Right action rail */}
          <div className="absolute bottom-28 right-2 z-20 flex flex-col items-center gap-3 text-white">
            <div className="relative mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#FE2C55] text-[10px] font-black">
                BS
              </div>
              <span className="absolute -bottom-1 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55] text-white">
                <Plus className="h-2.5 w-2.5" />
              </span>
            </div>
            <div className="flex flex-col items-center">
              <Heart className="h-6 w-6" fill="white" />
              <span className="mt-0.5 text-[8px]">12.4K</span>
            </div>
            <div className="flex flex-col items-center">
              <MessageCircle className="h-6 w-6" fill="white" />
              <span className="mt-0.5 text-[8px]">342</span>
            </div>
            <div className="flex flex-col items-center">
              <Bookmark className="h-6 w-6" fill="white" />
              <span className="mt-0.5 text-[8px]">891</span>
            </div>
            <div className="flex flex-col items-center">
              <Share2 className="h-6 w-6" fill="white" />
              <span className="mt-0.5 text-[8px]">56</span>
            </div>
            <div
              className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border-[6px] border-slate-800 bg-gradient-to-br from-pink-500 to-yellow-400 animate-spin"
              style={{ animationDuration: '3s' }}
            >
              <Music2 className="h-2.5 w-2.5 text-white" />
            </div>
          </div>

          {/* Caption & CTA */}
          <div className="absolute inset-x-0 bottom-0 z-20 p-3 pr-14">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-white">@bejostiker</span>
              <BadgeCheck className="h-3 w-3 text-white" />
              <span className="rounded bg-white/20 px-1 py-0.5 text-[7px] font-bold text-white">Iklan</span>
            </div>
            {form.adText ? (
              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white">{form.adText}</p>
            ) : (
              <p className="mt-1 text-[10px] italic text-white/45">Teks iklan akan tampil di sini</p>
            )}
            <div className="mt-1.5 flex items-center gap-1 text-[9px] text-white/85">
              <Music2 className="h-3 w-3" />
              <span className="truncate">Original sound · Bejo Stiker</span>
            </div>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-[10px] font-bold text-black shadow-sm"
            >
              {CTA_LABELS[form.cta]}
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-30 h-0.5 bg-white/25">
            <div className="h-full w-1/3 bg-[#FE2C55]" />
          </div>
        </div>
      </div>

      <p className="text-center text-[9px] text-slate-400">
        Pratinjau TikTok In-Feed · video 9:16 · tanpa frame perangkat
      </p>
    </div>
  );
};