import type { Express, Request, Response } from 'express';
import { createHmac } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

type Channel = 'Meta' | 'TikTok' | 'Shopee';

class MarketingError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status = 502, detail?: unknown) {
    super(message);
    this.name = 'MarketingError';
    this.status = status;
    this.detail = detail;
  }
}

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err) => sendError(res, err));
  };
}

function sendError(res: Response, err: unknown) {
  const status = err instanceof MarketingError && err.status >= 400 && err.status < 600 ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada integrasi marketing.';
  console.error('[Marketing]', message);
  if (res.headersSent) return;
  res.status(status).json({ error: message });
}

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

function appUrl(): string {
  return env('APP_URL').replace(/\/+$/, '');
}

function simulate(channel: Channel, missing: string[], extra: Record<string, unknown> = {}) {
  return {
    success: true,
    simulated: true,
    missingEnv: missing,
    message:
      `Mode simulasi ${channel}: ${missing.join(', ')} belum disetel di server. ` +
      'Iklan tidak dikirim ke platform sampai kredensial diisi di .env VPS.',
    ...extra,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBase64(input?: string): string {
  const value = String(input || '').trim();
  if (!value) return '';
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
}

function mediaBuffer(creative: any, kind: 'image' | 'video') {
  const media = creative?.media || {};
  const base64 = normalizeBase64(media.dataBase64);
  if (!base64) {
    throw new MarketingError(
      kind === 'video' ? 'File video iklan wajib diunggah.' : 'File gambar iklan wajib diunggah.',
      400
    );
  }
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw new MarketingError('File media kosong atau tidak valid.', 400);
  const maxBytes = kind === 'video' ? 70 * 1024 * 1024 : 12 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new MarketingError(
      kind === 'video'
        ? 'Ukuran video melebihi batas server (70 MB). Kompres video terlebih dahulu.'
        : 'Ukuran gambar melebihi batas server (12 MB).',
      413
    );
  }
  return {
    buffer,
    mimeType: String(media.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg')),
    fileName: String(media.fileName || (kind === 'video' ? 'video.mp4' : 'image.jpg')),
  };
}

function formatJakartaDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
}

function formatJakartaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('day')}-${get('month')}-${get('year')}`;
}

function toWhatsAppLink(number: string): string {
  let digits = String(number || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return digits ? `https://wa.me/${digits}` : appUrl();
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/* ===================================================================== */
/* META — WhatsApp Status Ads                                            */
/* ===================================================================== */

const ZERO_DECIMAL_CURRENCIES = new Set([
  'IDR',
  'VND',
  'JPY',
  'KRW',
  'CLP',
  'COP',
  'CRC',
  'HUF',
  'ISK',
  'PYG',
  'TWD',
]);

function metaConfig() {
  const versionRaw = env('META_GRAPH_VERSION') || 'v23.0';
  const version = versionRaw.startsWith('v') ? versionRaw : `v${versionRaw}`;
  return {
    token: env('META_ACCESS_TOKEN'),
    adAccountId: env('META_AD_ACCOUNT_ID').replace(/^act_/i, ''),
    version,
  };
}

let metaAccountCache: { at: number; account: any } | null = null;

async function getMetaAdAccount(force = false): Promise<any> {
  const config = metaConfig();
  if (!config.adAccountId) throw new MarketingError('META_AD_ACCOUNT_ID belum disetel.', 400);
  if (!force && metaAccountCache && Date.now() - metaAccountCache.at < 10 * 60_000) {
    return metaAccountCache.account;
  }
  const account = await graphGet(`act_${config.adAccountId}`, {
    fields: 'id,name,account_status,currency,timezone_name,disable_reason',
  });
  metaAccountCache = { at: Date.now(), account };
  return account;
}

function missingMetaConnect(): string[] {
  return metaConfig().token ? [] : ['META_ACCESS_TOKEN'];
}

function missingMetaPublish(): string[] {
  const config = metaConfig();
  const missing: string[] = [];
  if (!config.token) missing.push('META_ACCESS_TOKEN');
  if (!config.adAccountId) missing.push('META_AD_ACCOUNT_ID');
  return missing;
}

async function readGraphResponse(res: globalThis.Response): Promise<any> {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    const error = data?.error;
    const message = error?.error_user_msg || error?.message || `HTTP ${res.status}`;
    const code = error?.code
      ? ` (kode ${error.code}${error.error_subcode ? `/${error.error_subcode}` : ''})`
      : '';
    throw new MarketingError(`Meta: ${message}${code}`, res.ok ? 502 : 400, error);
  }
  return data;
}

async function graphGet(path: string, params: Record<string, unknown> = {}): Promise<any> {
  const config = metaConfig();
  if (!config.token) throw new MarketingError('META_ACCESS_TOKEN belum disetel.', 400);
  const url = new URL(`https://graph.facebook.com/${config.version}/${path.replace(/^\/+/, '')}`);
  url.searchParams.set('access_token', config.token);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.set(key, Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  const res = await fetch(url);
  return readGraphResponse(res);
}

async function graphPost(path: string, body: Record<string, unknown>, base = `https://graph.facebook.com`): Promise<any> {
  const config = metaConfig();
  if (!config.token) throw new MarketingError('META_ACCESS_TOKEN belum disetel.', 400);
  const url = new URL(`${base}/${config.version}/${path.replace(/^\/+/, '')}`);
  url.searchParams.set('access_token', config.token);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readGraphResponse(res);
}

async function resolveMetaLocations(locations: string[]) {
  const cities: Array<Record<string, unknown>> = [];
  const regions: Array<Record<string, unknown>> = [];
  let unresolved = 0;
  for (const text of locations.slice(0, 10)) {
    try {
      const data = await graphGet('search', {
        type: 'adgeolocation',
        q: text,
        location_types: ['city', 'region'],
        country_code: 'ID',
        limit: 5,
      });
      const match = Array.isArray(data?.data) ? data.data[0] : null;
      if (!match) {
        unresolved += 1;
        continue;
      }
      if (match.type === 'city') cities.push({ key: match.key, radius: 25, distance_unit: 'kilometer' });
      else regions.push({ key: match.key });
    } catch {
      unresolved += 1;
    }
  }
  return { cities, regions, unresolved };
}

async function resolveMetaInterests(interests: string[]) {
  const resolved: Array<{ id: string; name: string }> = [];
  for (const text of interests.slice(0, 10)) {
    try {
      const data = await graphGet('search', { type: 'adinterest', q: text, limit: 1 });
      const match = Array.isArray(data?.data) ? data.data[0] : null;
      if (match?.id) resolved.push({ id: String(match.id), name: String(match.name || text) });
    } catch {
      // Interest tidak wajib; lewati bila tidak ditemukan.
    }
  }
  return resolved;
}

async function uploadMetaImage(adAccountId: string, creative: any): Promise<string> {
  const { buffer, mimeType, fileName } = mediaBuffer(creative, 'image');
  const config = metaConfig();
  const body = new URLSearchParams();
  body.set('access_token', config.token);
  body.set('name', fileName);
  body.set('bytes', buffer.toString('base64'));
  const res = await fetch(`https://graph.facebook.com/${config.version}/act_${adAccountId}/adimages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await readGraphResponse(res);
  const images = data?.images && typeof data.images === 'object' ? data.images : {};
  const first = images[fileName] || Object.values(images)[0];
  const hash = (first as any)?.hash;
  if (!hash) {
    throw new MarketingError(`Meta: upload gambar tidak mengembalikan hash (${mimeType}).`, 502, data);
  }
  return String(hash);
}

async function uploadMetaVideo(adAccountId: string, creative: any): Promise<{ videoId: string; ready: boolean }> {
  const { buffer, mimeType, fileName } = mediaBuffer(creative, 'video');
  const config = metaConfig();
  const form = new FormData();
  form.set('access_token', config.token);
  form.set('name', fileName);
  form.append('source', new Blob([buffer], { type: mimeType }), fileName);
  const res = await fetch(`https://graph-video.facebook.com/${config.version}/act_${adAccountId}/advideos`, {
    method: 'POST',
    body: form,
  });
  const data = await readGraphResponse(res);
  const videoId = String(data?.id || '');
  if (!videoId) throw new MarketingError('Meta: upload video tidak mengembalikan video ID.', 502, data);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const statusData = await graphGet(videoId, { fields: 'status' });
      const status = statusData?.status?.video_status;
      if (status === 'ready') return { videoId, ready: true };
      if (status === 'error') {
        throw new MarketingError(
          `Meta: pemrosesan video gagal${statusData?.status?.processing_phase?.errors ? ` (${JSON.stringify(statusData.status.processing_phase.errors)})` : ''}.`,
          502,
          statusData
        );
      }
    } catch (err) {
      if (err instanceof MarketingError && err.message.includes('pemrosesan video gagal')) throw err;
    }
    await sleep(4000);
  }
  return { videoId, ready: false };
}

async function metaConnect(input: {
  metaBusinessId: string;
  facebookPageId: string;
  whatsappBusinessNumber: string;
}) {
  const missing = missingMetaConnect();
  if (missing.length) {
    return simulate('Meta', missing, { account: null });
  }

  const business = await graphGet(input.metaBusinessId, { fields: 'id,name' });
  const page = await graphGet(input.facebookPageId, { fields: 'id,name' });

  let linkedNumber = '';
  try {
    const extra = await graphGet(input.facebookPageId, { fields: 'whatsapp_number' });
    linkedNumber = String(extra?.whatsapp_number || '');
  } catch {
    // Field whatsapp_number tidak tersedia pada semua Page/token.
  }

  const normalize = (value: string) => value.replace(/\D/g, '');
  const inputDigits = normalize(input.whatsappBusinessNumber);
  const linkedDigits = normalize(linkedNumber);
  const numberVerified = linkedDigits
    ? inputDigits === linkedDigits ||
      inputDigits.endsWith(linkedDigits.slice(-9)) ||
      linkedDigits.endsWith(inputDigits.slice(-9))
    : null;

  return {
    success: true,
    simulated: false,
    message: numberVerified === false
      ? 'Akun Meta terhubung, tetapi nomor WhatsApp tidak cocok dengan nomor yang tertaut di Facebook Page.'
      : 'Akun bisnis terhubung ke Meta.',
    account: {
      businessId: String(business?.id || input.metaBusinessId),
      businessName: String(business?.name || ''),
      pageId: String(page?.id || input.facebookPageId),
      pageName: String(page?.name || ''),
      whatsappNumber: linkedNumber || input.whatsappBusinessNumber,
      numberVerified,
    },
  };
}

async function metaPublish(payload: any) {
  const { business, campaign, targeting, creative } = payload || {};
  if (!campaign?.name || !toNumber(campaign?.dailyBudget)) {
    throw new MarketingError('Nama kampanye dan anggaran harian wajib diisi.', 400);
  }
  if (!creative?.mediaType) {
    throw new MarketingError('Media iklan (foto/video 9:16) wajib diunggah.', 400);
  }
  if (!business?.facebookPageId || !business?.whatsappBusinessNumber) {
    throw new MarketingError('Facebook Page ID dan nomor WhatsApp Business wajib diisi.', 400);
  }

  const config = metaConfig();
  const missing = missingMetaPublish();
  if (missing.length) {
    return simulate('Meta', missing, {
      campaignId: `SIM-META-${Date.now()}`,
      adSetId: null,
      adId: null,
    });
  }

  // Anggaran form dalam Rupiah. Meta menerima daily_budget pada unit terkecil
  // mata uang akun; IDR tidak memiliki desimal, sehingga nominal dikirim apa adanya.
  const accountInfo = await getMetaAdAccount();
  const accountCurrency = String(accountInfo?.currency || '').toUpperCase();
  if (!accountCurrency) {
    throw new MarketingError(
      'Meta: mata uang akun iklan tidak terbaca. Periksa izin token terhadap akun iklan.',
      502
    );
  }
  if (accountCurrency !== 'IDR') {
    throw new MarketingError(
      `Meta: mata uang akun iklan adalah ${accountCurrency}, sedangkan anggaran form menggunakan Rupiah. ` +
        'Publikasi dihentikan agar nominal tidak salah. Gunakan akun iklan bermata uang IDR.',
      400
    );
  }

  const mediaKind = creative.mediaType === 'video' ? 'video' : 'image';
  const pageId = String(business.facebookPageId);
  const waLink = toWhatsAppLink(String(business.whatsappBusinessNumber));
  const caption = String(creative.caption || campaign.name || '').trim();
  const locations = Array.isArray(targeting?.locations) ? targeting.locations.filter(Boolean) : [];
  const interests = Array.isArray(targeting?.interests) ? targeting.interests.filter(Boolean) : [];
  const warnings: string[] = [];

  const { cities, regions, unresolved } = await resolveMetaLocations(locations);
  if (locations.length && unresolved) {
    warnings.push(`${unresolved} lokasi tidak ditemukan di Meta; targeting diperluas ke seluruh Indonesia.`);
  }
  const resolvedInterests = await resolveMetaInterests(interests);
  if (interests.length && !resolvedInterests.length) {
    warnings.push('Minat tidak ditemukan di Meta; targeting dijalankan tanpa filter minat.');
  }

  let imageHash = '';
  let videoId = '';
  let videoReady = true;
  if (mediaKind === 'video') {
    const uploaded = await uploadMetaVideo(config.adAccountId, creative);
    videoId = uploaded.videoId;
    videoReady = uploaded.ready;
    if (!videoReady) warnings.push('Video masih diproses Meta; iklan tetap dibuat dan akan tayang setelah video siap.');
  } else {
    imageHash = await uploadMetaImage(config.adAccountId, creative);
  }

  // Click-to-WhatsApp ads require a messaging objective; both UI objectives map to it.
  const objective = 'OUTCOME_ENGAGEMENT';
  const optimizationGoal = 'CONVERSATIONS';
  const dailyBudget = Math.max(1, Math.round(toNumber(campaign.dailyBudget)));

  const campaignRes = await graphPost(`act_${config.adAccountId}/campaigns`, {
    name: String(campaign.name),
    objective,
    status: 'ACTIVE',
    buying_type: 'AUCTION',
    special_ad_categories: [],
  });
  const campaignId = String(campaignRes?.id || '');
  if (!campaignId) throw new MarketingError('Meta: campaign ID tidak diterima.', 502, campaignRes);

  const geoLocations: Record<string, unknown> = { countries: ['ID'] };
  if (cities.length) geoLocations.cities = cities;
  if (regions.length) geoLocations.regions = regions;

  const metaTargeting: Record<string, unknown> = {
    geo_locations: geoLocations,
    age_min: Math.min(65, Math.max(18, Math.round(toNumber(targeting?.ageMin) || 18))),
    age_max: Math.min(65, Math.max(18, Math.round(toNumber(targeting?.ageMax) || 65))),
    publisher_platforms: ['whatsapp', 'instagram'],
    whatsapp_positions: ['status'],
    // Meta mewajibkan Instagram Story sebagai pasangan placement WhatsApp Status.
    instagram_positions: ['story'],
    device_platforms: ['mobile'],
  };
  if (targeting?.gender === 'MALE') metaTargeting.genders = [1];
  if (targeting?.gender === 'FEMALE') metaTargeting.genders = [2];
  if (resolvedInterests.length) metaTargeting.flexible_spec = [{ interests: resolvedInterests }];

  const adSetRes = await graphPost(`act_${config.adAccountId}/adsets`, {
    name: `${campaign.name} - WhatsApp Status`,
    campaign_id: campaignId,
    daily_budget: dailyBudget,
    billing_event: 'IMPRESSIONS',
    optimization_goal: optimizationGoal,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    destination_type: 'WHATSAPP',
    promoted_object: { page_id: pageId },
    targeting: metaTargeting,
    status: 'ACTIVE',
  });
  const adSetId = String(adSetRes?.id || '');
  if (!adSetId) throw new MarketingError('Meta: ad set ID tidak diterima.', 502, adSetRes);

  const callToAction = {
    type: 'WHATSAPP_MESSAGE',
    value: { link: waLink, app_destination: 'WHATSAPP' },
  };

  const objectStorySpec: Record<string, unknown> = { page_id: pageId };
  if (mediaKind === 'video') {
    objectStorySpec.video_data = {
      video_id: videoId,
      message: caption,
      title: String(campaign.name),
      call_to_action: callToAction,
    };
  } else {
    objectStorySpec.link_data = {
      link: waLink,
      message: caption,
      name: String(campaign.name),
      image_hash: imageHash,
      call_to_action: callToAction,
    };
  }

  const creativeRes = await graphPost(`act_${config.adAccountId}/adcreatives`, {
    name: `${campaign.name} - Creative`,
    object_story_spec: objectStorySpec,
  });
  const creativeId = String(creativeRes?.id || '');
  if (!creativeId) throw new MarketingError('Meta: creative ID tidak diterima.', 502, creativeRes);

  const adRes = await graphPost(`act_${config.adAccountId}/ads`, {
    name: String(campaign.name),
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'ACTIVE',
  });
  const adId = String(adRes?.id || '');
  if (!adId) throw new MarketingError('Meta: ad ID tidak diterima.', 502, adRes);

  return {
    success: true,
    simulated: false,
    campaignId,
    adSetId,
    creativeId,
    adId,
    accountCurrency,
    dailyBudget,
    videoId: videoId || undefined,
    videoReady: mediaKind === 'video' ? videoReady : undefined,
    warnings,
    message: 'Iklan WhatsApp Status berhasil dibuat dan sedang ditinjau Meta.',
  };
}

/* ===================================================================== */
/* TIKTOK — In-Feed Ads                                                  */
/* ===================================================================== */

function tiktokConfig() {
  return {
    token: env('TIKTOK_ACCESS_TOKEN'),
    advertiserId: env('TIKTOK_ADVERTISER_ID'),
    pixelId: env('TIKTOK_PIXEL_ID'),
    defaultBid: Number(env('TIKTOK_DEFAULT_BID') || 1000) || 1000,
    base: 'https://business-api.tiktok.com/open_api/v1.3',
  };
}

function missingTikTok(): string[] {
  const config = tiktokConfig();
  const missing: string[] = [];
  if (!config.token) missing.push('TIKTOK_ACCESS_TOKEN');
  if (!config.advertiserId) missing.push('TIKTOK_ADVERTISER_ID');
  return missing;
}

async function tiktokRequest(
  path: string,
  options: { method?: 'GET' | 'POST'; query?: Record<string, unknown>; body?: unknown; form?: FormData } = {}
): Promise<any> {
  const config = tiktokConfig();
  if (!config.token) throw new MarketingError('TIKTOK_ACCESS_TOKEN belum disetel.', 400);
  const url = new URL(`${config.base}${path}`);
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.set(key, Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value));
  });

  const headers: Record<string, string> = { 'Access-Token': config.token };
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method || (body ? 'POST' : 'GET'),
    headers,
    body,
  });
  const data = await res.json().catch(() => null);
  const code = Number(data?.code);
  if (!res.ok || !data || (code !== 0 && code !== 200)) {
    const requestId = data?.request_id ? ` (request_id: ${data.request_id})` : '';
    const codeLabel = data?.code !== undefined && Number(data.code) !== 0 ? ` (kode ${data.code})` : '';
    throw new MarketingError(
      `TikTok: ${data?.message || `HTTP ${res.status}`}${codeLabel}${requestId}`,
      res.ok ? 502 : 400,
      data
    );
  }
  return data;
}

let tiktokRegionCache: { at: number; list: any[] } | null = null;
let tiktokInterestCache: { at: number; list: any[] } | null = null;

async function getTikTokRegions(): Promise<any[]> {
  if (tiktokRegionCache && Date.now() - tiktokRegionCache.at < 10 * 60_000) return tiktokRegionCache.list;
  const config = tiktokConfig();
  const data = await tiktokRequest('/tool/region/', {
    query: { advertiser_id: config.advertiserId, placements: ['PLACEMENT_TIKTOK'] },
  });
  const list = data?.data?.region_list || data?.data?.regions || data?.data?.list || [];
  tiktokRegionCache = { at: Date.now(), list: Array.isArray(list) ? list : [] };
  return tiktokRegionCache.list;
}

async function getTikTokInterests(): Promise<any[]> {
  if (tiktokInterestCache && Date.now() - tiktokInterestCache.at < 10 * 60_000) return tiktokInterestCache.list;
  const config = tiktokConfig();
  const data = await tiktokRequest('/tool/interest_category/', {
    query: { advertiser_id: config.advertiserId },
  });
  const root = data?.data?.interest_category_list || data?.data?.list || [];
  const flat: any[] = [];
  const walk = (items: any[]) => {
    items.forEach((item) => {
      if (!item) return;
      flat.push(item);
      const children = item.sub_category_list || item.children;
      if (Array.isArray(children)) walk(children);
    });
  };
  if (Array.isArray(root)) walk(root);
  tiktokInterestCache = { at: Date.now(), list: flat };
  return flat;
}

function normalizeText(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchTikTokRegions(regions: any[], locations: string[]): string[] {
  const ids: string[] = [];
  const names = locations.map(normalizeText).filter(Boolean);
  regions.forEach((region) => {
    const name = normalizeText(region.region_name || region.name);
    if (!name) return;
    if (names.some((wanted) => name.includes(wanted) || wanted.includes(name))) {
      const id = region.region_id ?? region.id;
      if (id !== undefined && id !== null && !ids.includes(String(id))) ids.push(String(id));
    }
  });
  return ids.slice(0, 50);
}

function matchTikTokInterests(categories: any[], interests: string[]): string[] {
  const ids: string[] = [];
  const names = interests.map(normalizeText).filter(Boolean);
  categories.forEach((category) => {
    const name = normalizeText(category.interest_category_name || category.name);
    if (!name) return;
    if (names.some((wanted) => name.includes(wanted) || wanted.includes(name))) {
      const id = category.interest_category_id ?? category.id;
      if (id !== undefined && id !== null && !ids.includes(String(id))) ids.push(String(id));
    }
  });
  return ids.slice(0, 10);
}

const TIKTOK_AGE_GROUPS: Record<string, string> = {
  '13-17': 'AGE_13_17',
  '18-24': 'AGE_18_24',
  '25-34': 'AGE_25_34',
  '35-44': 'AGE_35_44',
  '45-54': 'AGE_45_54',
  '55+': 'AGE_55_100',
};

const TIKTOK_GENDER: Record<string, string> = {
  ALL: 'GENDER_UNLIMITED',
  MALE: 'GENDER_MALE',
  FEMALE: 'GENDER_FEMALE',
};

async function tiktokConnect(input: {
  tiktokForBusinessId: string;
  tiktokAdsManagerId: string;
  tiktokOrganicHandle: string;
}) {
  const missing = missingTikTok();
  if (missing.length) {
    return simulate('TikTok', missing, { account: null });
  }

  const config = tiktokConfig();
  const inputAdvertiserId = String(input.tiktokAdsManagerId || '').trim();
  if (inputAdvertiserId && inputAdvertiserId !== config.advertiserId) {
    throw new MarketingError(
      `Ads Manager ID (${inputAdvertiserId}) tidak cocok dengan TIKTOK_ADVERTISER_ID (${config.advertiserId}) di server.`,
      400
    );
  }

  const data = await tiktokRequest('/advertiser/info/', {
    query: { advertiser_ids: [config.advertiserId] },
  });
  const list = data?.data?.list || data?.data?.advertiser_info || [];
  const info = Array.isArray(list) ? list[0] : list;
  if (!info) throw new MarketingError('TikTok: advertiser tidak ditemukan untuk token ini.', 502, data);

  return {
    success: true,
    simulated: false,
    message: 'Akun bisnis TikTok terhubung.',
    account: {
      advertiserId: String(info.advertiser_id || config.advertiserId),
      name: String(info.name || info.advertiser_name || ''),
      company: String(info.company || ''),
      currency: String(info.currency || ''),
      status: info.status,
      organicHandle: String(input.tiktokOrganicHandle || ''),
      businessId: String(input.tiktokForBusinessId || ''),
    },
  };
}

async function uploadTikTokVideo(creative: any): Promise<string> {
  const { buffer, mimeType, fileName } = mediaBuffer(creative, 'video');
  const config = tiktokConfig();
  const form = new FormData();
  form.set('advertiser_id', config.advertiserId);
  form.set('upload_type', 'UPLOAD_BY_FILE');
  form.set('file_name', fileName);
  form.append('video_file', new Blob([buffer], { type: mimeType }), fileName);
  const data = await tiktokRequest('/file/video/ad/upload/', { form });
  const videoId = data?.data?.video_id;
  if (!videoId) throw new MarketingError('TikTok: upload video tidak mengembalikan video_id.', 502, data);
  return String(videoId);
}

async function tiktokPublish(payload: any) {
  const { business, campaign, targeting, creative } = payload || {};
  if (!campaign?.name || !toNumber(campaign?.dailyBudget)) {
    throw new MarketingError('Nama kampanye dan anggaran harian wajib diisi.', 400);
  }
  if (creative?.mediaType !== 'video') {
    throw new MarketingError('Video iklan (9:16) wajib diunggah.', 400);
  }

  const missing = missingTikTok();
  if (missing.length) {
    return simulate('TikTok', missing, {
      campaignId: `SIM-TIKTOK-${Date.now()}`,
      adGroupId: null,
      adId: null,
    });
  }

  const config = tiktokConfig();
  const objective = String(campaign.objective || 'VIDEO_VIEWS');
  if (objective === 'CONVERSIONS' && !config.pixelId) {
    throw new MarketingError(
      'Objective Konversi membutuhkan TIKTOK_PIXEL_ID pada .env server, atau pilih objective Lalu Lintas / Penayangan Video.',
      400
    );
  }

  const landingPageUrl = String(creative.landingPageUrl || appUrl()).trim();
  if (!landingPageUrl) {
    throw new MarketingError('Landing page URL wajib diisi, atau set APP_URL di .env server.', 400);
  }
  if (!/^https?:\/\//i.test(landingPageUrl)) {
    throw new MarketingError('Landing page URL harus diawali http:// atau https://.', 400);
  }
  const adText = String(creative.adText || '').trim();
  if (!adText) throw new MarketingError('Teks iklan TikTok wajib diisi.', 400);
  if (adText.length > 100) {
    throw new MarketingError('Teks iklan TikTok maksimal 100 karakter.', 400);
  }

  const videoId = await uploadTikTokVideo(creative);
  const objectiveMap: Record<string, { objective: string; optimization: string; billing: string }> = {
    VIDEO_VIEWS: { objective: 'VIDEO_VIEWS', optimization: 'VIDEO_VIEW', billing: 'CPM' },
    TRAFFIC: { objective: 'TRAFFIC', optimization: 'CLICK', billing: 'CPC' },
    CONVERSIONS: { objective: 'CONVERSIONS', optimization: 'CONVERT', billing: 'OCPM' },
  };
  const mapping = objectiveMap[objective] || objectiveMap.VIDEO_VIEWS;
  const warnings: string[] = [];

  let campaignId = '';
  let adGroupId = '';
  try {
    const campaignRes = await tiktokRequest('/campaign/create/', {
      body: {
        advertiser_id: config.advertiserId,
        campaign_name: String(campaign.name),
        objective_type: mapping.objective,
        operation_status: 'ENABLE',
      },
    });
    campaignId = String(campaignRes?.data?.campaign_id || '');
    if (!campaignId) throw new MarketingError('TikTok: campaign_id tidak diterima.', 502, campaignRes);

    const locations = Array.isArray(targeting?.locations) ? targeting.locations.filter(Boolean) : [];
    let locationIds: string[] = [];
    if (locations.length) {
      try {
        locationIds = matchTikTokRegions(await getTikTokRegions(), locations);
      } catch {
        throw new MarketingError(
          'Tidak dapat memuat daftar wilayah TikTok. Periksa izin token atau kosongkan lokasi targeting.',
          502
        );
      }
      if (!locationIds.length) {
        throw new MarketingError(`Lokasi TikTok tidak dikenali: ${locations.join(', ')}.`, 400);
      }
    }

    const interests = Array.isArray(targeting?.interests) ? targeting.interests.filter(Boolean) : [];
    let interestIds: string[] = [];
    if (interests.length) {
      try {
        interestIds = matchTikTokInterests(await getTikTokInterests(), interests);
      } catch {
        warnings.push('Daftar minat TikTok tidak dapat dimuat; targeting berjalan tanpa filter minat.');
      }
      if (interests.length && !interestIds.length) {
        warnings.push('Minat tidak ditemukan di TikTok; targeting berjalan tanpa filter minat.');
      }
    }

    const ageGroups = (Array.isArray(targeting?.ageGroups) ? targeting.ageGroups : [])
      .map((value: string) => TIKTOK_AGE_GROUPS[value])
      .filter(Boolean);

    const adGroupBody: Record<string, unknown> = {
      advertiser_id: config.advertiserId,
      campaign_id: campaignId,
      adgroup_name: `${campaign.name} - In-Feed`,
      billing_event: mapping.billing,
      optimization_goal: mapping.optimization,
      pacing: 'PACING_MODE_SMOOTH',
      budget_mode: 'BUDGET_MODE_DAY',
      budget: Math.max(1, Math.round(toNumber(campaign.dailyBudget))),
      schedule_type: 'SCHEDULE_FROM_NOW',
      schedule_start_time: formatJakartaDateTime(new Date(Date.now() + 10 * 60_000)),
      placements: ['PLACEMENT_TIKTOK'],
      bid_type: objective === 'CONVERSIONS' ? 'BID_TYPE_NO_BID' : 'BID_TYPE_CUSTOM',
      operation_status: 'ENABLE',
      gender: TIKTOK_GENDER[String(targeting?.gender || 'ALL')] || 'GENDER_UNLIMITED',
    };
    if (objective !== 'CONVERSIONS') adGroupBody.bid_price = config.defaultBid;
    if (ageGroups.length) adGroupBody.age_groups = ageGroups;
    if (locationIds.length) adGroupBody.location_ids = locationIds;
    if (interestIds.length) adGroupBody.interest_category_ids = interestIds;
    if (objective === 'CONVERSIONS') adGroupBody.pixel_id = config.pixelId;

    const adGroupRes = await tiktokRequest('/adgroup/create/', { body: adGroupBody });
    adGroupId = String(adGroupRes?.data?.adgroup_id || '');
    if (!adGroupId) throw new MarketingError('TikTok: adgroup_id tidak diterima.', 502, adGroupRes);

    const displayName = (
      String(business?.tiktokOrganicHandle || '')
        .replace(/^@/, '')
        .trim() || 'Bejo Stiker'
    ).slice(0, 40);

    const adRes = await tiktokRequest('/ad/create/', {
      body: {
        advertiser_id: config.advertiserId,
        adgroup_id: adGroupId,
        creatives: [
          {
            ad_name: `${campaign.name} - Video`,
            ad_format: 'SINGLE_VIDEO',
            ad_text: adText,
            call_to_action: String(creative.cta || 'LEARN_MORE'),
            landing_page_url: landingPageUrl,
            display_name: displayName,
            video_id: videoId,
          },
        ],
      },
    });
    const adIds = adRes?.data?.ad_ids || adRes?.data?.ad_id || [];
    const adId = Array.isArray(adIds) ? String(adIds[0] || '') : String(adIds || '');

    return {
      success: true,
      simulated: false,
      campaignId,
      adGroupId,
      adId,
      videoId,
      warnings,
      message: 'Iklan TikTok berhasil dibuat dan sedang ditinjau TikTok.',
    };
  } catch (err) {
    if (campaignId && err instanceof MarketingError) {
      const suffix = adGroupId ? `, adgroup: ${adGroupId}` : '';
      throw new MarketingError(`${err.message} (campaign TikTok sudah dibuat: ${campaignId}${suffix})`, err.status, err.detail);
    }
    throw err;
  }
}

/* ===================================================================== */
/* SHOPEE — Discovery Ads                                                */
/* ===================================================================== */

function shopeeConfig(inputShopId?: string) {
  const token = env('SHOPEE_ACCESS_TOKEN');
  const refreshToken = env('SHOPEE_REFRESH_TOKEN');
  const partnerId = env('SHOPEE_PARTNER_ID');
  const partnerKey = env('SHOPEE_PARTNER_KEY');
  const envShopId = env('SHOPEE_SHOP_ID');
  const input = String(inputShopId || '').trim();

  if (envShopId && input && envShopId !== input) {
    throw new MarketingError(
      `Shopee Seller ID (${input}) tidak cocok dengan SHOPEE_SHOP_ID (${envShopId}) di server.`,
      400
    );
  }

  return {
    token,
    refreshToken,
    partnerId,
    partnerKey,
    shopId: envShopId || input,
    base: (env('SHOPEE_API_BASE') || 'https://partner.shopeemobile.com').replace(/\/+$/, ''),
  };
}

function missingShopee(inputShopId?: string): string[] {
  const config = shopeeConfig(inputShopId);
  const missing: string[] = [];
  if (!config.token && !config.refreshToken) missing.push('SHOPEE_ACCESS_TOKEN');
  if (!config.partnerId) missing.push('SHOPEE_PARTNER_ID');
  if (!config.partnerKey) missing.push('SHOPEE_PARTNER_KEY');
  if (!config.shopId) missing.push('SHOPEE_SHOP_ID');
  return missing;
}

interface ShopeeTokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const SHOPEE_TOKEN_FILE = join(process.cwd(), 'data', 'shopee-tokens.json');
const SHOPEE_FOUR_HOURS = 4 * 60 * 60 * 1000;
let shopeeTokenCache: Record<string, ShopeeTokenRecord> | null = null;
const shopeeRefreshInFlight = new Map<string, Promise<ShopeeTokenRecord>>();

async function loadShopeeTokens(): Promise<Record<string, ShopeeTokenRecord>> {
  if (shopeeTokenCache) return shopeeTokenCache;
  try {
    const raw = await fs.readFile(SHOPEE_TOKEN_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    shopeeTokenCache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    shopeeTokenCache = {};
  }
  return shopeeTokenCache;
}

async function saveShopeeToken(shopId: string, record: ShopeeTokenRecord): Promise<void> {
  const cache = await loadShopeeTokens();
  cache[shopId] = record;
  try {
    await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
    await fs.writeFile(SHOPEE_TOKEN_FILE, JSON.stringify(cache, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error('[Marketing] Gagal menyimpan token Shopee:', err instanceof Error ? err.message : err);
  }
}

async function refreshShopeeToken(
  config: ReturnType<typeof shopeeConfig>,
  refreshToken: string
): Promise<ShopeeTokenRecord> {
  const pending = shopeeRefreshInFlight.get(config.shopId);
  if (pending) return pending;

  const task = (async () => {
    const partnerId = Number(config.partnerId);
    const shopId = Number(config.shopId);
    if (!config.partnerKey) throw new MarketingError('SHOPEE_PARTNER_KEY belum disetel.', 400);
    if (!Number.isFinite(partnerId) || !Number.isFinite(shopId)) {
      throw new MarketingError('SHOPEE_PARTNER_ID / SHOPEE_SHOP_ID harus berupa angka.', 400);
    }
    if (!refreshToken) {
      throw new MarketingError(
        'Access token Shopee kedaluwarsa dan SHOPEE_REFRESH_TOKEN belum disetel di .env VPS.',
        401
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const apiPath = '/api/v2/auth/access_token/get';
    const sign = createHmac('sha256', config.partnerKey)
      .update(`${config.partnerId}${apiPath}${timestamp}`)
      .digest('hex');
    const url = new URL(`${config.base}${apiPath}`);
    url.searchParams.set('partner_id', config.partnerId);
    url.searchParams.set('timestamp', String(timestamp));
    url.searchParams.set('sign', sign);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, partner_id: partnerId, shop_id: shopId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || (data.error && String(data.error).trim() !== '')) {
      const requestId = data?.request_id ? ` (request_id: ${data.request_id})` : '';
      throw new MarketingError(
        `Shopee: gagal refresh access token: ${data?.message || data?.error || `HTTP ${res.status}`}${requestId}`,
        400,
        data
      );
    }

    const accessToken = String(data.access_token || '');
    if (!accessToken) throw new MarketingError('Shopee: refresh token tidak mengembalikan access_token.', 502, data);
    const expireIn = Number(data.expire_in) > 0 ? Number(data.expire_in) : SHOPEE_FOUR_HOURS / 1000;
    const record: ShopeeTokenRecord = {
      accessToken,
      refreshToken: String(data.refresh_token || refreshToken),
      expiresAt: Date.now() + Math.max(60, expireIn - 120) * 1000,
    };
    await saveShopeeToken(config.shopId, record);
    return record;
  })();

  shopeeRefreshInFlight.set(config.shopId, task);
  try {
    return await task;
  } finally {
    shopeeRefreshInFlight.delete(config.shopId);
  }
}

async function getShopeeAccessToken(
  config: ReturnType<typeof shopeeConfig>,
  forceRefresh = false
): Promise<string> {
  const cache = await loadShopeeTokens();
  const saved = cache[config.shopId];
  const refreshToken = saved?.refreshToken || config.refreshToken;

  if (saved && !forceRefresh && saved.expiresAt - Date.now() > 5 * 60_000) {
    return saved.accessToken;
  }
  if (saved && refreshToken) {
    return (await refreshShopeeToken(config, refreshToken)).accessToken;
  }
  if (config.token && !forceRefresh) {
    return config.token;
  }
  if (refreshToken) {
    return (await refreshShopeeToken(config, refreshToken)).accessToken;
  }
  throw new MarketingError(
    'Access token Shopee kedaluwarsa. Isi SHOPEE_REFRESH_TOKEN di .env VPS agar token diperbarui otomatis.',
    401
  );
}

async function shopeeRequest(
  config: ReturnType<typeof shopeeConfig>,
  apiPath: string,
  options: { method?: 'GET' | 'POST'; query?: Record<string, unknown>; body?: unknown } = {},
  retried = false
): Promise<any> {
  const accessToken = await getShopeeAccessToken(config, retried);
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${config.partnerId}${apiPath}${timestamp}${accessToken}${config.shopId}`;
  const sign = createHmac('sha256', config.partnerKey).update(baseString).digest('hex');
  const url = new URL(`${config.base}${apiPath}`);
  url.searchParams.set('partner_id', config.partnerId);
  url.searchParams.set('timestamp', String(timestamp));
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('shop_id', config.shopId);
  url.searchParams.set('sign', sign);
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.set(key, String(value));
  });

  const method = options.method || 'GET';
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (method === 'POST' && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { method, headers, body });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || (data.error && String(data.error).trim() !== '')) {
    const detailText = `${data?.error || ''} ${data?.message || ''}`;
    const tokenProblem = /token/i.test(detailText) && /(expired|invalid|auth)/i.test(detailText);
    if (tokenProblem && !retried) {
      const cache = await loadShopeeTokens();
      if (cache[config.shopId]?.refreshToken || config.refreshToken) {
        return shopeeRequest(config, apiPath, options, true);
      }
    }
    const requestId = data?.request_id ? ` (request_id: ${data.request_id})` : '';
    throw new MarketingError(`Shopee: ${data?.message || data?.error || `HTTP ${res.status}`}${requestId}`, res.ok ? 502 : 400, data);
  }
  return data.response || {};
}

function parseShopeeBalance(response: any): number {
  return toNumber(
    response?.balance ??
      response?.total_balance ??
      response?.shop_ads_balance ??
      response?.balance_info?.total_balance ??
      response?.balance_info?.balance
  );
}

async function shopeeConnect(input: { shopeeSellerId: string }) {
  const missing = missingShopee(input.shopeeSellerId);
  if (missing.length) {
    return simulate('Shopee', missing, {
      account: null,
      balance: 500000,
    });
  }

  const config = shopeeConfig(input.shopeeSellerId);
  const shopInfo = await shopeeRequest(config, '/api/v2/shop/get_shop_info');
  const warnings: string[] = [];
  const tokenStore = await loadShopeeTokens();
  if (!config.refreshToken && !tokenStore[config.shopId]?.refreshToken) {
    warnings.push(
      'SHOPEE_REFRESH_TOKEN belum disetel; access token hanya berlaku 4 jam dan tidak diperbarui otomatis.'
    );
  }
  let balance = 0;
  try {
    balance = parseShopeeBalance(await shopeeRequest(config, '/api/v2/ads/get_total_balance'));
  } catch (err) {
    warnings.push(
      `Saldo Shopee Ads tidak dapat dibaca: ${err instanceof Error ? err.message : 'izin API Ads belum aktif'}.`
    );
  }

  return {
    success: true,
    simulated: false,
    message: `Akun toko Shopee "${shopInfo?.shop_name || config.shopId}" terhubung.`,
    balance,
    warnings,
    account: {
      shopId: String(shopInfo?.shop_id || config.shopId),
      shopName: String(shopInfo?.shop_name || ''),
      region: String(shopInfo?.region || ''),
      status: shopInfo?.status,
    },
  };
}

async function shopeeProducts(inputShopId: string) {
  const missing = missingShopee(inputShopId);
  if (missing.length) {
    return simulate('Shopee', missing, { products: [] });
  }

  const config = shopeeConfig(inputShopId);
  const listResponse = await shopeeRequest(config, '/api/v2/product/get_item_list', {
    query: { offset: 0, page_size: 50, item_status: 'NORMAL' },
  });
  const rawItems = Array.isArray(listResponse?.item)
    ? listResponse.item
    : Array.isArray(listResponse?.items)
    ? listResponse.items
    : [];
  const ids = rawItems
    .map((item: any) => item?.item_id)
    .filter((id: unknown) => id !== undefined && id !== null)
    .slice(0, 50);

  if (!ids.length) return { success: true, simulated: false, products: [] };

  const baseResponse = await shopeeRequest(config, '/api/v2/product/get_item_base_info', {
    query: {
      item_id_list: ids.join(','),
      need_tax_info: false,
      need_complaint_policy: false,
    },
  });
  const items = Array.isArray(baseResponse?.item_list) ? baseResponse.item_list : [];

  const products = items.map((item: any) => {
    const priceInfo = Array.isArray(item?.price_info)
      ? item.price_info
      : item?.price_info
      ? [item.price_info]
      : [];
    const priceEntry = priceInfo.find((entry: any) => entry?.current_price !== undefined) || priceInfo[0] || {};
    const summary = item?.stock_info_v2?.summary_info || {};
    return {
      itemId: String(item?.item_id || ''),
      name: String(item?.item_name || `Produk ${item?.item_id || ''}`),
      price: toNumber(priceEntry?.current_price ?? item?.price),
      imageUrl: String(item?.image?.image_url || item?.image_url || ''),
      stock: toNumber(summary?.total_available_stock ?? item?.stock_info_v2?.current_stock ?? item?.stock),
    };
  }).filter((product: any) => product.itemId);

  return { success: true, simulated: false, products };
}

async function shopeePublish(payload: any) {
  const { business, campaign, bidding, product } = payload || {};
  if (!campaign?.adName) throw new MarketingError('Nama iklan wajib diisi.', 400);
  if (!product?.itemId) throw new MarketingError('Pilih produk yang akan diiklankan.', 400);

  const shopId = String(business?.shopeeSellerId || '').trim();
  const missing = missingShopee(shopId);
  if (missing.length) {
    return simulate('Shopee', missing, {
      adId: `SIM-SHOPEE-${Date.now()}`,
      campaignId: null,
    });
  }

  const config = shopeeConfig(shopId);
  let budget = toNumber(campaign.dailyBudget);
  if (campaign.budgetMode !== 'FIXED' || budget <= 0) {
    budget = parseShopeeBalance(await shopeeRequest(config, '/api/v2/ads/get_total_balance'));
  }
  if (!(budget > 0)) {
    throw new MarketingError('Saldo Shopee Ads kosong atau budget iklan belum diisi.', 400);
  }

  const warnings: string[] = [];
  const manualBid = toNumber(bidding?.manualBid);
  const bidMode = String(bidding?.bidMode || 'AUTO').toUpperCase() === 'MANUAL' ? 'manual' : 'auto';
  const keywords = Array.from(
    new Set(
      (Array.isArray(bidding?.keywords) ? bidding.keywords : String(bidding?.keywords || '').split(','))
        .map((keyword: unknown) => String(keyword).trim())
        .filter(Boolean)
    )
  ).slice(0, 50);
  const placements = bidding?.placements || {};
  const selectedLocations = [
    { enabled: Boolean(placements.homeRecommendation), location: 'daily_discover' },
    { enabled: Boolean(placements.productDetail), location: 'you_may_also_like' },
  ].filter((entry) => entry.enabled);

  const body: Record<string, unknown> = {
    reference_id: `${String(campaign.adName).slice(0, 200)}-${Date.now()}`,
    budget: Math.round(budget * 100) / 100,
    start_date: formatJakartaDate(new Date()),
    bidding_method: bidMode,
    item_id: Number(product.itemId),
  };

  if (bidMode === 'manual') {
    if (!keywords.length) {
      throw new MarketingError('Bid manual Shopee memerlukan minimal satu keyword.', 400);
    }
    if (!(manualBid > 0)) {
      throw new MarketingError('Bid manual per klik wajib lebih besar dari 0.', 400);
    }
    body.selected_keywords = keywords.map((keyword) => ({
      keyword,
      match_type: 'broad',
      bid_price_per_click: manualBid,
    }));
    if (selectedLocations.length) {
      body.discovery_ads_locations = selectedLocations.map((entry) => ({
        location: entry.location,
        bid_price: manualBid,
      }));
    } else {
      warnings.push('Tidak ada penempatan yang dipilih; Shopee menentukan penempatan manual secara default.');
    }
  } else if (selectedLocations.length) {
    warnings.push(
      'Penempatan Discovery Ads hanya dapat dikirim pada bid manual; mode otomatis sepenuhnya diatur Shopee.'
    );
  }
  if (toNumber(bidding?.premiumRate) > 0) {
    warnings.push('Premium Rate tidak tersedia pada API pembuatan iklan; atur persentasenya melalui Shopee Ads Manager.');
  }

  const response = await shopeeRequest(config, '/api/v2/ads/create_manual_product_ads', {
    method: 'POST',
    body,
  });

  const campaignId = response?.campaign_id ?? response?.ad_id;
  if (campaignId === undefined || campaignId === null || campaignId === '') {
    throw new MarketingError('Shopee: campaign_id tidak diterima.', 502, response);
  }

  return {
    success: true,
    simulated: false,
    adId: String(campaignId),
    campaignId: String(campaignId),
    warnings,
    message: 'Iklan Shopee Discovery Ads berhasil diaktifkan.',
  };
}

/* ===================================================================== */
/* Diagnostics                                                           */
/* ===================================================================== */

function diagnosticError(err: unknown): string {
  return err instanceof Error ? err.message : 'Pemeriksaan API gagal.';
}

function withTimeout<T>(task: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new MarketingError(`${label}: pemeriksaan melebihi ${Math.round(ms / 1000)} detik.`, 504)),
      ms
    );
  });
  return Promise.race([task, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function metaDiagnostics() {
  const checkedAt = new Date().toISOString();
  const missing = missingMetaPublish();
  if (missing.length) return { configured: false, live: false, missing, checkedAt };

  const config = metaConfig();
  try {
    const me = await withTimeout(graphGet('me', { fields: 'id,name' }), 15000, 'Meta');
    const account = await withTimeout(getMetaAdAccount(true), 15000, 'Meta');
    const status = Number(account?.account_status);
    const active = status === 1 || status === 201;
    const currency = String(account?.currency || '').toUpperCase();
    const warnings: string[] = [];
    if (!active) {
      warnings.push(
        `Status akun iklan Meta: ${account?.account_status ?? 'tidak diketahui'}${
          account?.disable_reason ? ` (${account.disable_reason})` : ''
        }.`
      );
    }
    if (currency && currency !== 'IDR') {
      warnings.push(
        `Mata uang akun ${currency}; form Marketing memakai Rupiah. Publikasi Meta hanya diizinkan untuk akun IDR.`
      );
    }
    return {
      configured: true,
      live: active,
      missing: [],
      checkedAt,
      account: {
        id: String(account?.id || `act_${config.adAccountId}`),
        name: String(account?.name || ''),
        currency,
        timezone: String(account?.timezone_name || ''),
        status: account?.account_status ?? null,
        tokenUser: String(me?.name || me?.id || ''),
      },
      warnings,
    };
  } catch (err) {
    return { configured: true, live: false, missing: [], checkedAt, error: diagnosticError(err) };
  }
}

async function tiktokDiagnostics() {
  const checkedAt = new Date().toISOString();
  const missing = missingTikTok();
  if (missing.length) return { configured: false, live: false, missing, checkedAt };

  const config = tiktokConfig();
  const warnings: string[] = [];
  if (!config.pixelId) {
    warnings.push('TIKTOK_PIXEL_ID belum disetel; objective Konversi tidak dapat diterbitkan.');
  }
  try {
    const data = await withTimeout(
      tiktokRequest('/advertiser/info/', { query: { advertiser_ids: [config.advertiserId] } }),
      15000,
      'TikTok'
    );
    const raw = data?.data?.list ?? data?.data?.advertiser_info ?? data?.data;
    const account = Array.isArray(raw) ? raw[0] : raw && typeof raw === 'object' ? raw : null;
    if (!account) {
      return {
        configured: true,
        live: false,
        missing: [],
        checkedAt,
        warnings,
        error: 'TikTok tidak mengembalikan data advertiser. Periksa TIKTOK_ADVERTISER_ID dan izin token.',
      };
    }
    const status = String(account.status || '');
    const live = !status || status === 'STATUS_ENABLE';
    if (!live) warnings.push(`Status advertiser TikTok: ${status}.`);
    return {
      configured: true,
      live,
      missing: [],
      checkedAt,
      account: {
        id: String(account.advertiser_id || config.advertiserId),
        name: String(account.advertiser_name || account.name || ''),
        currency: String(account.currency || ''),
        timezone: String(account.timezone || ''),
        status,
      },
      warnings,
    };
  } catch (err) {
    return { configured: true, live: false, missing: [], checkedAt, warnings, error: diagnosticError(err) };
  }
}

async function shopeeDiagnostics(inputShopId: string) {
  const checkedAt = new Date().toISOString();
  let config: ReturnType<typeof shopeeConfig>;
  let missing: string[] = [];
  try {
    config = shopeeConfig(inputShopId);
    missing = missingShopee(inputShopId);
  } catch (err) {
    return { configured: false, live: false, missing: ['SHOPEE_SHOP_ID'], checkedAt, error: diagnosticError(err) };
  }
  if (missing.length) return { configured: false, live: false, missing, checkedAt };

  const warnings: string[] = [];
  try {
    const shop = await withTimeout(
      shopeeRequest(config, '/api/v2/shop/get_shop_info'),
      15000,
      'Shopee'
    );
    let balance: number | null = null;
    try {
      balance = parseShopeeBalance(
        await withTimeout(shopeeRequest(config, '/api/v2/ads/get_total_balance'), 15000, 'Shopee')
      );
    } catch (err) {
      warnings.push(`Saldo Shopee Ads tidak dapat dibaca: ${diagnosticError(err)}`);
    }
    const tokenStore = await loadShopeeTokens();
    if (!config.refreshToken && !tokenStore[config.shopId]?.refreshToken) {
      warnings.push('SHOPEE_REFRESH_TOKEN belum disetel; access token tidak diperbarui otomatis.');
    }
    return {
      configured: true,
      live: true,
      missing: [],
      checkedAt,
      account: {
        shopId: String(shop?.shop_id || config.shopId),
        shopName: String(shop?.shop_name || ''),
        region: String(shop?.region || ''),
        status: shop?.status ?? null,
        balance,
      },
      warnings,
    };
  } catch (err) {
    return { configured: true, live: false, missing: [], checkedAt, warnings, error: diagnosticError(err) };
  }
}

const diagnosticsCache = new Map<string, { at: number; data: any }>();
const DIAGNOSTICS_TTL_MS = 60_000;

async function getMarketingDiagnostics(shopeeSellerId: string, refresh: boolean) {
  const key = shopeeSellerId || 'env';
  const cached = diagnosticsCache.get(key);
  if (!refresh && cached && Date.now() - cached.at < DIAGNOSTICS_TTL_MS) return cached.data;

  const [meta, tiktok, shopee] = await Promise.all([
    metaDiagnostics(),
    tiktokDiagnostics(),
    shopeeDiagnostics(shopeeSellerId),
  ]);
  const channels = [meta, tiktok, shopee];
  const data = {
    success: true,
    checkedAt: new Date().toISOString(),
    appUrl: appUrl(),
    meta,
    tiktok,
    shopee,
    configuredCount: channels.filter((channel) => channel.configured).length,
    liveCount: channels.filter((channel) => channel.live).length,
  };
  diagnosticsCache.set(key, { at: Date.now(), data });
  return data;
}

/* ===================================================================== */
/* Routes                                                                */
/* ===================================================================== */

export function getMarketingStatus() {
  const metaMissing = missingMetaPublish();
  const tiktokMissing = missingTikTok();
  // Shop ID boleh diisi dari UI; access token boleh diperoleh lewat refresh token.
  const shopeeMissing = ['SHOPEE_PARTNER_ID', 'SHOPEE_PARTNER_KEY'].filter((name) => !env(name));
  if (!env('SHOPEE_ACCESS_TOKEN') && !env('SHOPEE_REFRESH_TOKEN')) {
    shopeeMissing.push('SHOPEE_ACCESS_TOKEN');
  }
  return {
    success: true,
    appUrl: appUrl(),
    meta: { configured: metaMissing.length === 0, missing: metaMissing },
    tiktok: { configured: tiktokMissing.length === 0, missing: tiktokMissing },
    shopee: { configured: shopeeMissing.length === 0, missing: shopeeMissing },
  };
}

export function registerMarketingRoutes(app: Express): void {
  app.get('/api/marketing/status', (_req, res) => {
    res.json(getMarketingStatus());
  });

  app.get(
    '/api/marketing/diagnostics',
    asyncRoute(async (req, res) => {
      const shopeeSellerId = String(req.query.shopeeSellerId || '').trim();
      const refresh = String(req.query.refresh || '') === '1';
      res.json(await getMarketingDiagnostics(shopeeSellerId, refresh));
    })
  );

  app.post(
    '/api/marketing/whatsapp-status-ads/connect',
    asyncRoute(async (req, res) => {
      const { metaBusinessId, facebookPageId, whatsappBusinessNumber } = req.body || {};
      if (!metaBusinessId || !facebookPageId || !whatsappBusinessNumber) {
        res.status(400).json({ error: 'Semua field akun bisnis wajib diisi.' });
        return;
      }
      const result = await metaConnect({
        metaBusinessId: String(metaBusinessId),
        facebookPageId: String(facebookPageId),
        whatsappBusinessNumber: String(whatsappBusinessNumber),
      });
      res.json(result);
    })
  );

  app.post(
    '/api/marketing/whatsapp-status-ads/publish',
    asyncRoute(async (req, res) => {
      const { business } = req.body || {};
      if (!business?.connected) {
        res.status(400).json({ error: 'Akun bisnis belum terhubung.' });
        return;
      }
      res.json(await metaPublish(req.body));
    })
  );

  app.post(
    '/api/marketing/tiktok-infeed-ads/connect',
    asyncRoute(async (req, res) => {
      const { tiktokForBusinessId, tiktokAdsManagerId, tiktokOrganicHandle } = req.body || {};
      if (!tiktokForBusinessId || !tiktokAdsManagerId || !tiktokOrganicHandle) {
        res.status(400).json({ error: 'Semua field akun bisnis TikTok wajib diisi.' });
        return;
      }
      const result = await tiktokConnect({
        tiktokForBusinessId: String(tiktokForBusinessId),
        tiktokAdsManagerId: String(tiktokAdsManagerId),
        tiktokOrganicHandle: String(tiktokOrganicHandle),
      });
      res.json(result);
    })
  );

  app.post(
    '/api/marketing/tiktok-infeed-ads/publish',
    asyncRoute(async (req, res) => {
      const { business } = req.body || {};
      if (!business?.connected) {
        res.status(400).json({ error: 'Akun bisnis TikTok belum terhubung.' });
        return;
      }
      res.json(await tiktokPublish(req.body));
    })
  );

  app.post(
    '/api/marketing/shopee-discovery-ads/connect',
    asyncRoute(async (req, res) => {
      const { shopeeSellerId } = req.body || {};
      if (!shopeeSellerId) {
        res.status(400).json({ error: 'Shopee Seller Account ID wajib diisi.' });
        return;
      }
      res.json(await shopeeConnect({ shopeeSellerId: String(shopeeSellerId) }));
    })
  );

  app.get(
    '/api/marketing/shopee-discovery-ads/products',
    asyncRoute(async (req, res) => {
      const shopeeSellerId = String(req.query.shopeeSellerId || '').trim();
      res.json(await shopeeProducts(shopeeSellerId));
    })
  );

  app.post(
    '/api/marketing/shopee-discovery-ads/publish',
    asyncRoute(async (req, res) => {
      const { business } = req.body || {};
      if (!business?.connected) {
        res.status(400).json({ error: 'Akun toko Shopee belum terhubung.' });
        return;
      }
      res.json(await shopeePublish(req.body));
    })
  );
}
