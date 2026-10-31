/**
 * Guard penyebaran logo & identitas toko.
 * Jalankan: npm run check:branding
 *
 * Yang dijaga (laporan 2026-10-31: logo yang disetel developer di Pengaturan toko
 * tidak pernah muncul di perangkat lain; layar login dan dashboard tetap memakai
 * emblem bawaan):
 *   A     aturan ukuran lampiran — logo boleh lewat, lampiran berkas tidak
 *   B     pengekaman logo menghasilkan berkas cukup kecil
 *   C     endpoint publik branding hanya mengirim nama toko + logo
 *   D     layar login memakai endpoint itu (bukan hanya ingatan perangkat ini)
 *   E     unggahan logo selalu dikompres sebelum disimpan
 *   F     daftar batas hanya ada satu tempat (UI, server, dan uji ikut aturan itu)
 */
import { readFileSync } from 'node:fs';
import {
  BINARY_MAX_CHARS,
  LOGO_MAX_CHARS,
  sanitizeForDb,
} from '../src/utils/dbSanitize.ts';
import {
  LOGO_QUALITIES,
  LOGO_SIZES,
  LOGO_TARGET_CHARS,
  compressLogoWithEncoder,
  type LogoEncoder,
} from '../src/utils/storeLogoImage.ts';

let failures = 0;
function check(label: string, condition: boolean, extra = '') {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!condition) failures += 1;
}

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const backendSource = read('src/backend/pocketbaseBackend.ts');
const brandingSource = read('server/brandingApi.ts');
const entrySource = read('server.ts');
const landingSource = read('server/landingApi.ts');
const clientSource = read('src/lib/branding.ts');
const loginSource = read('src/components/LoginScreen.tsx');
const settingsSource = read('src/components/CustomerScreen.tsx');

const BINARY_REF_PREFIX = 'data:image/png;base64,';
const dataUrl = (chars: number) =>
  BINARY_REF_PREFIX + 'A'.repeat(Math.max(0, chars - BINARY_REF_PREFIX.length));

/* ---------------------------------------------------------------- */
/*  A. aturan ukuran lampiran                                        */
/* ---------------------------------------------------------------- */
check('A1 logo 250.000 karakter ikut tersimpan', (sanitizeForDb({ logoUrl: dataUrl(250_000) }) as any).logoUrl.length === 250_000);
check('A2 logo di atas batas tetap dipotong', (sanitizeForDb({ logoUrl: dataUrl(LOGO_MAX_CHARS + 10) }) as any).logoUrl === '');
check(
  'A3 lampiran berkas besar tetap dibuang',
  (sanitizeForDb({ signature: dataUrl(BINARY_MAX_CHARS + 10) }) as any).signature === ''
);
check('A4 lampiran berkas kecil tidak ganggu', (sanitizeForDb({ note: dataUrl(2_000) }) as any).note.length === 2_000);
check('A5 kunci lampiran diketahui dibuang apa adanya', (sanitizeForDb({ fileDataUrl: dataUrl(1_000) }) as any).fileDataUrl === undefined);
check('A6 logo di dalam objek bersarang juga lolos', (sanitizeForDb({ profile: { logoUrl: dataUrl(120_000) } }) as any).profile.logoUrl.length === 120_000);
check('A7 logo di dalam daftar juga lolos', (sanitizeForDb([{ logoUrl: dataUrl(80_000) }]) as any)[0].logoUrl.length === 80_000);
check('A8 NaN menjadi 0', (sanitizeForDb({ total: NaN }) as any).total === 0);
check('A9 function dibuang', (sanitizeForDb({ cb: () => 1, keep: 1 }) as any).cb === undefined);
check('A10 blob besar dianggap lampiran', (sanitizeForDb({ berkas: 'blob:http://x/'.padEnd(BINARY_MAX_CHARS + 5, 'b') }) as any).berkas === '');
check('A11 batas logo lebih longgar dari lampiran biasa', LOGO_MAX_CHARS > BINARY_MAX_CHARS);
check('A12 logo di dalam daftar nilai langsung juga lolos', (sanitizeForDb({ logoUrl: [dataUrl(90_000)] }) as any).logoUrl[0].length === 90_000);

/* ---------------------------------------------------------------- */
/*  B. pengekaman logo                                               */
/* ---------------------------------------------------------------- */
/** Encoder palsu: makin besar ukuran/kualitas, makin panjang hasilnya. */
const fakeEncoder: LogoEncoder = (size, quality) => dataUrl(Math.round(size * size * quality));

const firstFit = compressLogoWithEncoder(fakeEncoder);
check('B1 hasil pertama yang cukup kecil dipakai', !!firstFit && firstFit.dataUrl.length <= LOGO_TARGET_CHARS, firstFit ? `${firstFit.size}px q${firstFit.quality}` : 'null');
check('B2 tidak pernah mengembalikan hasil di atas target kecuali tidak ada yang muat', !firstFit || firstFit.dataUrl.length <= LOGO_TARGET_CHARS);
check('B3 target kompresi di bawah batas sanitizer', LOGO_TARGET_CHARS < LOGO_MAX_CHARS);

const neverFits = compressLogoWithEncoder((size, quality) => dataUrl(900_000 + size + Math.round(quality * 100)));
check('B4 logo raksasa: tetap dikembalikan versi terkecil, bukan dibuang diam-diam', !!neverFits && neverFits.size === LOGO_SIZES[LOGO_SIZES.length - 1]);
const nothingDrawn = compressLogoWithEncoder(() => '');
check('B5 kanvas gagal membaca menghasilkan null', nothingDrawn === null);
check('B6 tangga ukuran & kualitas diurut dari terbesar', LOGO_SIZES[0] > LOGO_SIZES[LOGO_SIZES.length - 1] && LOGO_QUALITIES[0] > LOGO_QUALITIES[LOGO_QUALITIES.length - 1]);

/* ---------------------------------------------------------------- */
/*  C. endpoint publik branding                                      */
/* ---------------------------------------------------------------- */
check('C1 rute GET /api/branding terdaftar', /app\.get\(\s*'\/api\/branding'/.test(brandingSource));
check('C2 rute dipasang di server', /registerBrandingRoutes\(app\)/.test(entrySource) && /from "\.\/server\/brandingApi"/.test(entrySource));
check(
  'C3 branding memang sengaja tidak dikunci sesi (layar login belum punya sesi)',
  !/'\/api\/branding'/.test(entrySource.slice(entrySource.indexOf('const PRIVATE_API_PREFIXES'), entrySource.indexOf('function isPrivateApiPath')))
);
check('C4 endpoint membaca catatan toko', /STORE_INFO_ID = 'store_info'/.test(brandingSource) && /readSettingsPayload\(STORE_INFO_ID\)/.test(brandingSource));
check('C5 endpoint memakai koneksi server yang sudah ada', /export async function readSettingsPayload/.test(landingSource) && /from '\.\/landingApi'/.test(brandingSource));
check('C6 kredensial toko lain tidak ikut terkirim', !/address|phone|receiptFooter|appTitle|branch/.test(brandingSource.replace(/\/\/[^\n]*/g, '')));
check('C7 hanya dua nilai yang dikirim', /res\.json\(\{ success: true, \.\.\.branding \}\)/.test(brandingSource));
check('C8 gambar tak waras tidak dikirim ke pengunjung', /logo\.length > MAX_LOGO_CHARS \? '' : logo/.test(brandingSource));
check('C9 hasil dibaca ulang dari cermin data', /record\.data/.test(landingSource));

/* ---------------------------------------------------------------- */
/*  D. layar login memakai endpoint                                  */
/* ---------------------------------------------------------------- */
check('D1 browser memanggil /api/branding', /fetch\('\/api\/branding'/.test(clientSource));
check('D2 kegagalan koneksi tidak memaksa login tertahan', /catch \{\n    \/\/ Server belum terjangkau/.test(clientSource) || /catch \{/.test(clientSource));
check('D3 layar login mengambil branding saat dibuka', /getPublicBranding\(\)/.test(loginSource));
check('D4 logo hasil branding dipakai StoreLogo', /customLogoUrl=\{branding\?\.logoUrl\}/.test(loginSource));
check('D5 nama toko hasil branding dipakai di layar login', /branding\?\.storeName \|\| storeName/.test(loginSource));

/* ---------------------------------------------------------------- */
/*  E. unggahan logo selalu dikompres                                */
/* ---------------------------------------------------------------- */
check('E1 unggahan memakai pengekaman bersama', /compressLogoImage\(img\)/.test(settingsSource));
check('E2 PNG 400px tanpa kompresi tidak dipakai lagi', !/toDataURL\('image\/png', 0\.92\)/.test(settingsSource));
check('E3 penyimpanan form toko mengurut logo terlalu besar lebih dulu', /prepareLogoForSave\(storeForm\.logoUrl\)/.test(settingsSource));
check('E4 logo yang tetap terlalu besar membatalkan simpan, tidak diam-diam', /Logo terlalu besar untuk dikirim ke perangkat lain/.test(settingsSource));

/* ---------------------------------------------------------------- */
/*  F. satu sumber aturan                                            */
/* ---------------------------------------------------------------- */
check('F1 modul backend mengimpor aturan yang sama', /from '\.\.\/utils\/dbSanitize'/.test(backendSource));
check('F2 backend tidak menulis ulang batas 50000', !/50000|50_000/.test(backendSource));

if (failures > 0) {
  console.log(`\n${failures} pemeriksaan GAGAL`);
  process.exit(1);
}
console.log('\nSemua pemeriksaan penyebaran logo & identitas toko lulus.');
