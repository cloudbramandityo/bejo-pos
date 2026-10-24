/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Marketing Module — Panel Iklan Resmi WhatsApp Status (Meta Marketing API)
 * Coded by Langgo Bramandityo.
 */
import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  MessageCircle,
  Music2,
  ShoppingBag,
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
  ChevronRight,
  ChevronLeft,
  Send,
  Link2,
  Globe,
  X,
  Facebook,
  Instagram,
  MoreHorizontal,
  Camera,
  Heart,
  Bookmark,
  Check,
} from 'lucide-react';

import { TikTokInFeedAds } from './marketing/TikTokInFeedAds';
import { ShopeeDiscoveryAds } from './marketing/ShopeeDiscoveryAds';
import {
  fileToBase64Payload,
  formatMb,
  MARKETING_MAX_IMAGE_BYTES,
  MARKETING_MAX_VIDEO_BYTES,
} from '../utils/marketingMedia';

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
  simulated: boolean;
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

const META_STEPS = [
  { n: 1, label: 'Akun & Aset' },
  { n: 2, label: 'Kampanye' },
  { n: 3, label: 'Grup Iklan' },
  { n: 4, label: 'Iklan' },
  { n: 5, label: 'Tinjau' },
];

/* ------------------------------------------------------------------ */
/* Sub-menu definitions                                               */
/* ------------------------------------------------------------------ */
const SUB_MENUS = [
  {
    id: 'whatsapp-status-ads',
    label: 'WhatsApp Status Ads',
    subtitle: 'Meta · Status & Stories',
    icon: MessageCircle,
    activeClass: 'border-[#128C7E] bg-[#128C7E]',
    iconClass: 'bg-[#25D366] text-white',
  },
  {
    id: 'tiktok-infeed-ads',
    label: 'TikTok In-Feed Ads',
    subtitle: 'TikTok Ads Manager · FYP',
    icon: Music2,
    activeClass: 'border-[#111111] bg-[#111111]',
    iconClass: 'bg-[#FE2C55] text-white',
  },
  {
    id: 'shopee-discovery-ads',
    label: 'Shopee Discovery Ads',
    subtitle: 'Shopee Ads · Discovery',
    icon: ShoppingBag,
    activeClass: 'border-[#EE4D2D] bg-[#EE4D2D]',
    iconClass: 'bg-[#EE4D2D] text-white',
  },
];

interface ChannelStatus {
  configured: boolean;
  missing: string[];
}

interface MarketingStatus {
  success: boolean;
  appUrl?: string;
  meta: ChannelStatus;
  tiktok: ChannelStatus;
  shopee: ChannelStatus;
}

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */
export const MarketingScreen: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState('whatsapp-status-ads');
  const [status, setStatus] = useState<MarketingStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/marketing/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success) setStatus(data as MarketingStatus);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const channelOf = (id: string): ChannelStatus | null => {
    if (!status) return null;
    if (id === 'whatsapp-status-ads') return status.meta;
    if (id === 'tiktok-infeed-ads') return status.tiktok;
    return status.shopee;
  };

  const simulationChannels = status
    ? SUB_MENUS.filter((menu) => !channelOf(menu.id)?.configured).map((menu) =>
        menu.label.replace(' Ads', '')
      )
    : [];
  const missingVars = status
    ? Array.from(new Set([...status.meta.missing, ...status.tiktok.missing, ...status.shopee.missing]))
    : [];

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Marketing
              </h1>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Pusat Iklan
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola iklan WhatsApp Status (Meta), TikTok In-Feed, dan Shopee Discovery Ads.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
          <span className={`w-2 h-2 rounded-full ${status && simulationChannels.length === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {status
            ? simulationChannels.length === 0
              ? 'Semua kanal API aktif'
              : `${simulationChannels.length} kanal dalam mode simulasi`
            : 'Memeriksa koneksi API...'}
        </div>
      </div>

      {/* Integration status */}
      {status && simulationChannels.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Mode simulasi aktif: {simulationChannels.join(', ')}.</p>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Isi kredensial berikut di <span className="font-mono font-semibold">.env</span> VPS lalu restart
              server: <span className="font-mono font-semibold">{missingVars.join(', ')}</span>. Selama belum
              diisi, iklan hanya dibuat sebagai data simulasi dan tidak dikirim ke platform.
            </p>
          </div>
        </div>
      )}

      {/* Platform selector — each tab uses the native brand identity */}
      <div>
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Pilih platform iklan
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {SUB_MENUS.map((m) => {
            const channel = channelOf(m.id);
            const active = activeSubMenu === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveSubMenu(m.id)}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                  active
                    ? `${m.activeClass} text-white shadow-md`
                    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    active ? 'bg-white/15 text-white' : m.iconClass
                  }`}
                >
                  <m.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{m.label}</p>
                  <p className={`mt-0.5 truncate text-[10px] ${active ? 'text-white/70' : 'text-slate-500'}`}>
                    {m.subtitle}
                  </p>
                </div>
                {channel && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      active
                        ? 'bg-white/15 text-white'
                        : channel.configured
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {channel.configured ? 'LIVE' : 'SIMULASI'}
                  </span>
                )}
                <ChevronRight className={`h-4 w-4 shrink-0 ${active ? 'text-white/60' : 'text-slate-300'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {activeSubMenu === 'whatsapp-status-ads' && <WhatsAppStatusAds />}
      {activeSubMenu === 'tiktok-infeed-ads' && (
        <TikTokInFeedAds defaultLandingUrl={status?.appUrl || ''} />
      )}
      {activeSubMenu === 'shopee-discovery-ads' && <ShopeeDiscoveryAds />}
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

  /* ---- Step 1: Business Account Setup ---- */
  const handleConnectFacebook = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch('/api/marketing/whatsapp-status-ads/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaBusinessId: business.metaBusinessId,
          facebookPageId: business.facebookPageId,
          whatsappBusinessNumber: business.whatsappBusinessNumber,
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
    const maxBytes = isImage ? MARKETING_MAX_IMAGE_BYTES : MARKETING_MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      alert(
        `Ukuran file terlalu besar. Maksimal ${formatMb(maxBytes)} untuk ${isImage ? 'gambar' : 'video'}.`
      );
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
    if (!form.mediaFile) {
      setPublishStatus('error');
      setPublishMessage('Media iklan (foto/video 9:16) wajib diunggah.');
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
          ageMin: form.ageMin,
          ageMax: form.ageMax,
          gender: form.gender,
          interests: form.interests,
        },
        creative: {
          mediaType: form.mediaType,
          media,
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

      const warnings =
        Array.isArray(data.warnings) && data.warnings.length ? ` Catatan: ${data.warnings.join(' ')}` : '';
      setPublishStatus('success');
      setPublishMessage(
        `${data.message || 'Iklan berhasil diterbitkan.'}${
          data.campaignId ? ` Campaign ID: ${data.campaignId}.` : ''
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
      case 2: return form.name.trim().length > 0 && form.dailyBudget > 0;
      case 3: return form.locations.length > 0;
      case 4: return !!form.mediaFile && form.caption.trim().length > 0;
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

      {/* Meta Ads Manager shell */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#F0F2F5] shadow-xs">
        <div className="bg-[#1877F2] px-4 py-3 text-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <Facebook className="h-4 w-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold">Meta Ads Manager</span>
                <span className="hidden text-[11px] text-white/50 sm:inline">|</span>
                <span className="hidden text-[11px] text-white/80 sm:inline">WhatsApp Status Ads</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-semibold">
                <span className={`h-1.5 w-1.5 rounded-full ${business.connected ? 'bg-emerald-300' : 'bg-white/50'}`} />
                {business.connected
                  ? business.simulated
                    ? 'Akun terhubung · simulasi'
                    : 'Akun terhubung'
                  : 'Belum terhubung'}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold">Draf</span>
            </div>
          </div>
        </div>

        {/* Native step tabs */}
        <div className="border-b border-slate-200 bg-white px-1 sm:px-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {META_STEPS.map((s) => {
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
                      ? 'text-[#1877F2]'
                      : done
                      ? 'cursor-pointer text-slate-700 hover:text-[#1877F2]'
                      : 'cursor-not-allowed text-slate-400'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                      active
                        ? 'bg-[#1877F2] text-white'
                        : done
                        ? 'bg-[#E7F0FD] text-[#1877F2]'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : s.n}
                  </span>
                  {s.label}
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#1877F2]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Native two-column workspace */}
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            {step === 1 && (
              <BusinessAccountSetup
                business={business}
                connecting={connecting}
                connectError={connectError}
                onConnect={handleConnectFacebook}
                onChange={(key, value) => setBusiness((prev) => ({ ...prev, [key]: value, connected: false }))}
              />
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

          <div className="h-fit rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900">Pratinjau iklan</h3>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">9:16</span>
            </div>
            <LiveAdPreview form={form} />
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
                className="px-3.5 py-2 rounded-md text-xs font-bold bg-[#1877F2] text-white hover:bg-[#166FE5] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
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
/* Step 1: Business Account Setup                                     */
/* ------------------------------------------------------------------ */
const MetaStepHeader: React.FC<{ step: number; title: string; description: string }> = ({
  step,
  title,
  description,
}) => (
  <div className="border-b border-slate-100 pb-3">
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1877F2]">
      Langkah {step} dari 5
    </p>
    <h2 className="mt-1 text-lg font-bold text-slate-900">{title}</h2>
    <p className="mt-0.5 text-xs text-slate-500">{description}</p>
  </div>
);

const BusinessAccountSetup: React.FC<{
  business: BusinessAccount;
  connecting: boolean;
  connectError: string;
  onConnect: () => void;
  onChange: (key: keyof BusinessAccount, value: string) => void;
}> = ({ business, connecting, connectError, onConnect, onChange }) => (
  <div className="space-y-4">
    <MetaStepHeader
      step={1}
      title="Akun & Aset"
      description="Hubungkan aset Meta yang akan menayangkan iklan WhatsApp Status dan Instagram Stories."
    />

    <div className="flex items-start gap-2.5 rounded-lg border border-[#1877F2]/20 bg-[#F5F9FF] px-3.5 py-3">
      <Facebook className="mt-0.5 h-4 w-4 shrink-0 text-[#1877F2]" />
      <div className="text-[11px] leading-relaxed text-slate-600">
        <p className="font-bold text-slate-800">Aset iklan Meta</p>
        <p>Kredensial diverifikasi di server sebelum kampanye dibuat. Tidak ada token yang dikirim dari browser.</p>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-3">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Meta Business Manager ID</label>
        <input
          type="text"
          value={business.metaBusinessId}
          onChange={(e) => onChange('metaBusinessId', e.target.value)}
          placeholder="Contoh: 123456789012345"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Facebook Page ID</label>
        <input
          type="text"
          value={business.facebookPageId}
          onChange={(e) => onChange('facebookPageId', e.target.value)}
          placeholder="Contoh: 987654321098765"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp Business</label>
        <input
          type="text"
          value={business.whatsappBusinessNumber}
          onChange={(e) => onChange('whatsappBusinessNumber', e.target.value)}
          placeholder="Contoh: 6281234567890"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
        />
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatusCard label="Meta Business Manager" value={business.metaBusinessId || '—'} connected={business.connected} />
      <StatusCard label="Facebook Page" value={business.facebookPageId || '—'} connected={business.connected} />
      <StatusCard label="Nomor WhatsApp Business" value={business.whatsappBusinessNumber || '—'} connected={business.connected} />
    </div>

    <button
      type="button"
      onClick={onConnect}
      disabled={connecting || !business.metaBusinessId || !business.facebookPageId || !business.whatsappBusinessNumber}
      className="w-full py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-xs rounded-md shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
      {business.connected ? 'Terhubung ✓' : connecting ? 'Memverifikasi...' : 'Verifikasi & Hubungkan ke Meta'}
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
          ? 'Mode simulasi: kredensial Meta belum disetel di server. Alur dapat diuji, tetapi iklan tidak dikirim ke Meta.'
          : 'Akun bisnis berhasil terhubung ke Meta.'}
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
const CampaignSetup: React.FC<{
  form: CampaignForm;
  setField: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
}> = ({ form, setField }) => (
  <div className="space-y-4">
    <MetaStepHeader
      step={2}
      title="Kampanye"
      description="Tentukan tujuan dan anggaran kampanye WhatsApp Status Ads."
    />

    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kampanye</label>
      <input
        type="text"
        value={form.name}
        onChange={(e) => setField('name', e.target.value)}
        placeholder="Contoh: Promo Stiker Wrapping Ramadan"
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
      />
    </div>

    <div>
      <label className="block text-xs font-bold text-slate-700 mb-2">Tujuan Kampanye</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          { value: 'AWARENESS' as CampaignObjective, label: 'Kesadaran Merek', desc: 'Menjangkau lebih banyak orang di sekitar toko', icon: Target },
          { value: 'SALES' as CampaignObjective, label: 'Penjualan / Pesan Masuk', desc: 'Mendorong chat dan pembelian via WhatsApp', icon: MessageCircle },
        ]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setField('objective', opt.value)}
            className={`text-left rounded-lg border p-4 transition-all cursor-pointer ${
              form.objective === opt.value
                ? 'border-[#1877F2] bg-[#F5F9FF] ring-2 ring-[#1877F2]/20'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${
                form.objective === opt.value ? 'bg-[#1877F2] text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <opt.icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-bold text-slate-900">{opt.label}</span>
            </div>
            <p className="text-[11px] text-slate-500 ml-9">{opt.desc}</p>
          </button>
        ))}
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
          className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
        />
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
        <DollarSign className="h-3 w-3" /> Anggaran dihentikan otomatis saat batas harian tercapai.
      </div>
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
    <MetaStepHeader
      step={3}
      title="Grup Iklan"
      description="Tentukan siapa yang melihat iklan dan di mana iklan ditayangkan."
    />

    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
        <Users className="h-3.5 w-3.5 text-[#1877F2]" /> Audiens
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Target</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
            placeholder="Ketik kota/kabupaten, Enter untuk tambah"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
          />
          <button type="button" onClick={addLocation} className="px-4 py-2.5 bg-[#1877F2] text-white rounded-md text-xs font-bold hover:bg-[#166FE5] cursor-pointer">
            Tambah
          </button>
        </div>
        {form.locations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {form.locations.map((loc) => (
              <span key={loc} className="inline-flex items-center gap-1 bg-[#F5F9FF] text-[#1877F2] border border-[#1877F2]/20 rounded-full px-3 py-1 text-xs font-semibold">
                <MapPin className="w-3 h-3" /> {loc}
                <button type="button" onClick={() => removeLocation(loc)} className="ml-1 hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Rentang Usia: {form.ageMin} — {form.ageMax} tahun
        </label>
        <div className="flex gap-4">
          <input
            type="range"
            min={18}
            max={65}
            value={form.ageMin}
            onChange={(e) => setField('ageMin', Math.min(Number(e.target.value), form.ageMax - 1))}
            className="flex-1 accent-[#1877F2]"
          />
          <input
            type="range"
            min={18}
            max={65}
            value={form.ageMax}
            onChange={(e) => setField('ageMax', Math.max(Number(e.target.value), form.ageMin + 1))}
            className="flex-1 accent-[#1877F2]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Kelamin</label>
        <select
          value={form.gender}
          onChange={(e) => setField('gender', e.target.value as Gender)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
        >
          <option value="ALL">Semua</option>
          <option value="MALE">Laki-laki</option>
          <option value="FEMALE">Perempuan</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Minat / Interest</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
            placeholder="Contoh: stiker, digital printing, branding"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
          />
          <button type="button" onClick={addInterest} className="px-4 py-2.5 bg-[#1877F2] text-white rounded-md text-xs font-bold hover:bg-[#166FE5] cursor-pointer">
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
    </div>

    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800">
        <Globe className="h-3.5 w-3.5 text-[#1877F2]" /> Penempatan
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800">WhatsApp Status</p>
            <p className="text-[10px] text-emerald-700">Aktif · 9:16</p>
          </div>
          <Check className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-pink-200 bg-pink-50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#962FBF] text-white">
            <Instagram className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800">Instagram Stories</p>
            <p className="text-[10px] text-pink-700">Aktif · 9:16</p>
          </div>
          <Check className="h-4 w-4 text-pink-600" />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Placements dikelola otomatis oleh Meta: WhatsApp Status selalu berpasangan dengan Instagram Stories.
      </p>
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
    <MetaStepHeader
      step={4}
      title="Iklan"
      description="Materi iklan akan tampil full-screen di WhatsApp Status dan Instagram Stories."
    />

    <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
      <div>
        <p className="text-[10px] font-bold text-slate-800">9:16</p>
        <p className="text-[9px] text-slate-400">Rasio vertikal</p>
      </div>
      <div className="border-x border-slate-200">
        <p className="text-[10px] font-bold text-slate-800">1 media</p>
        <p className="text-[9px] text-slate-400">Foto atau video</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-800">CTA</p>
        <p className="text-[9px] text-slate-400">Kirim pesan</p>
      </div>
    </div>

    {/* Drop zone */}
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Media Iklan (Foto/Video 9:16)</label>
      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-[#F5F9FF] hover:border-[#1877F2]/50 cursor-pointer transition-all">
        <input type="file" accept="image/*,video/*" onChange={onMediaChange} className="hidden" />
        {form.mediaFile ? (
          <div className="text-center">
            {form.mediaType === 'image' ? <ImageIcon className="w-8 h-8 text-[#1877F2] mx-auto mb-2" /> : <Video className="w-8 h-8 text-[#1877F2] mx-auto mb-2" />}
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
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700">Teks Iklan / Caption</label>
        <span className="text-[10px] font-mono text-slate-400">{form.caption.length}</span>
      </div>
      <textarea
        value={form.caption}
        onChange={(e) => setField('caption', e.target.value)}
        rows={4}
        placeholder="Tulis caption menarik untuk iklan Anda..."
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2] resize-none"
      />
    </div>

    {/* CTA */}
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 flex items-start gap-2">
      <MessageCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold">Tombol: Kirim Pesan WhatsApp</p>
        <p className="text-[11px] text-emerald-700 mt-0.5">
          WhatsApp Status Ads selalu mengarahkan klik ke chat WhatsApp Business. Nomor tujuan diambil dari
          akun bisnis pada langkah Akun & Aset.
        </p>
      </div>
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
    <MetaStepHeader
      step={5}
      title="Tinjau & terbitkan"
      description="Periksa kembali pengaturan kampanye sebelum dikirim ke Meta."
    />

    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="bg-slate-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Kampanye
      </div>
      <div className="space-y-2.5 p-3.5 text-xs">
        <Row label="Akun Bisnis" value={business.connected ? business.facebookPageId : 'Belum terhubung'} />
        <Row label="Mode" value={business.simulated ? 'Simulasi (belum live)' : 'Live API Meta'} />
        <Row label="Nama Kampanye" value={form.name || '—'} />
        <Row label="Tujuan" value={form.objective === 'AWARENESS' ? 'Kesadaran Merek' : 'Penjualan / Pesan Masuk'} />
        <Row label="Anggaran Harian" value={`Rp ${form.dailyBudget.toLocaleString('id-ID')}`} />
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Grup Iklan
      </div>
      <div className="space-y-2.5 p-3.5 text-xs">
        <Row label="Lokasi" value={form.locations.join(', ') || '—'} />
        <Row label="Usia" value={`${form.ageMin} — ${form.ageMax} tahun`} />
        <Row label="Gender" value={form.gender === 'ALL' ? 'Semua' : form.gender === 'MALE' ? 'Laki-laki' : 'Perempuan'} />
        <Row label="Minat" value={form.interests.join(', ') || '—'} />
        <Row label="Penempatan" value="WhatsApp Status + Instagram Stories" />
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Iklan
      </div>
      <div className="space-y-2.5 p-3.5 text-xs">
        <Row label="Media" value={form.mediaFile ? form.mediaFile.name : '—'} />
        <Row label="CTA" value={CTA_LABELS[form.cta]} />
      </div>
    </div>

    <button
      type="button"
      onClick={onPublish}
      disabled={publishing}
      className="w-full py-3.5 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-sm rounded-md shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
/* Live Ad Preview — WhatsApp Status / Instagram Stories              */
/* ------------------------------------------------------------------ */
const LiveAdPreview: React.FC<{ form: CampaignForm }> = ({ form }) => {
  const [placement, setPlacement] = useState<'whatsapp' | 'instagram'>('whatsapp');
  const isWhatsApp = placement === 'whatsapp';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setPlacement('whatsapp')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-bold transition-all cursor-pointer ${
            isWhatsApp ? 'bg-white text-[#128C7E] shadow-xs' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </button>
        <button
          type="button"
          onClick={() => setPlacement('instagram')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-bold transition-all cursor-pointer ${
            !isWhatsApp ? 'bg-white text-[#D62976] shadow-xs' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Instagram className="h-3.5 w-3.5" /> Instagram
        </button>
      </div>

      <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-black shadow-lg">
        <div className="relative aspect-[9/16]">
          {/* Media */}
          <div className="absolute inset-0 flex items-center justify-center bg-[#0B141A]">
            {form.mediaPreviewUrl ? (
              form.mediaType === 'video' ? (
                <video src={form.mediaPreviewUrl} className="h-full w-full object-cover" autoPlay muted loop playsInline />
              ) : (
                <img src={form.mediaPreviewUrl} alt="Pratinjau media iklan" className="h-full w-full object-cover" />
              )
            ) : (
              <div className="px-6 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <ImageIcon className="h-6 w-6 text-white/60" />
                </div>
                <p className="text-[11px] font-semibold text-white/80">Media iklan 9:16</p>
                <p className="mt-0.5 text-[9px] text-white/45">Unggah foto atau video di langkah Iklan</p>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/75 via-black/35 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

          {/* Progress bars */}
          <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-2.5 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-0.5 flex-1 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/35'}`} />
            ))}
          </div>

          {/* Account header */}
          <div className="absolute inset-x-0 top-4 z-20 flex items-center gap-2 px-2.5">
            <div
              className={
                isWhatsApp
                  ? 'flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-[#128C7E] text-[10px] font-black text-white'
                  : 'rounded-full bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#962FBF] p-[2px]'
              }
            >
              <div className={`flex h-full w-full items-center justify-center rounded-full text-[10px] font-black text-white ${
                isWhatsApp ? '' : 'bg-[#0B141A]'
              }`}>
                BS
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="truncate text-[11px] font-bold text-white">
                  {isWhatsApp ? 'Bejo Stiker' : 'bejostiker'}
                </p>
                {!isWhatsApp && <CheckCircle2 className="h-3 w-3 text-white" />}
              </div>
              <p className="text-[9px] text-white/70">
                {isWhatsApp ? 'Baru saja · Disponsori' : 'Disponsori'}
              </p>
            </div>
            <MoreHorizontal className="h-4 w-4 text-white/90" />
            <X className="h-4 w-4 text-white/90" />
          </div>

          {/* Instagram right rail */}
          {!isWhatsApp && (
            <div className="absolute bottom-36 right-2 z-20 flex flex-col items-center gap-3.5 text-white">
              <Heart className="h-5 w-5" />
              <Send className="h-5 w-5" />
              <Bookmark className="h-5 w-5" />
            </div>
          )}

          {/* Caption & CTA */}
          <div className={`absolute inset-x-0 bottom-0 z-20 space-y-2 p-3 ${!isWhatsApp ? 'pr-11' : ''}`}>
            {form.caption ? (
              <p className="line-clamp-3 text-[10px] font-medium leading-relaxed text-white drop-shadow">
                {form.caption}
              </p>
            ) : (
              <p className="text-[10px] italic text-white/45">Teks iklan akan tampil di sini</p>
            )}
            <div className="flex items-center gap-1.5 text-[9px] text-white/65">
              <Link2 className="h-3 w-3" /> bejodigitalprint.com
            </div>
            <button
              type="button"
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold shadow-sm ${
                isWhatsApp ? 'bg-[#25D366] text-white' : 'bg-white text-slate-900'
              }`}
            >
              {isWhatsApp ? <MessageCircle className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {CTA_LABELS[form.cta]}
            </button>
            <div className="flex items-center gap-1.5 rounded-full border border-white/40 bg-black/20 px-2.5 py-1.5 backdrop-blur-sm">
              <span className="flex-1 text-[9px] text-white/70">
                {isWhatsApp ? 'Balas...' : 'Kirim pesan'}
              </span>
              {isWhatsApp && <Camera className="h-3.5 w-3.5 text-white/80" />}
              <Send className="h-3.5 w-3.5 text-white/80" />
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[9px] text-slate-400">
        Pratinjau {isWhatsApp ? 'WhatsApp Status' : 'Instagram Stories'} · media 9:16 · tanpa frame perangkat
      </p>
    </div>
  );
};