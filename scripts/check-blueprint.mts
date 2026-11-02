/**
 * Guard dokumen "MASTER PROMPT & BLUEPRINT ARSITEKTUR APLIKASI.md".
 * Jalankan: npm run check:blueprint
 *
 * Yang dijaga:
 *   A   dokumen ada, isinya nyata, dan tidak memuat kredensial
 *   B   rute server hanya untuk DEVELOPER, path tidak diterima dari pemanggil
 *   C   gerbang UI memakai satu aturan di recordAccess.ts (bukan cek role mentah)
 *   D   angka struktural di dokumen = angka hasil ukur repo (pendeteksi dokumen
 *       tertinggal: perubahan struktur wajib ikut memperbarui dokumen)
 *   F   susunan halaman PDF dibangun dari isi dokumen itu sendiri, penanda
 *       Markdown & blok penjaga sudah dibuang
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BLUEPRINT_FILE_NAME } from '../server/blueprintApi.ts';
import { canDownloadBlueprint } from '../src/utils/recordAccess.ts';
import { planBlueprintPdf } from '../src/utils/blueprintPdfPlan.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const list = (rel: string) => readdirSync(path.join(ROOT, rel));

let failures = 0;
function check(label: string, condition: boolean, extra = '') {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!condition) failures += 1;
}

/* ---------------------------------------------------------------- */
/*  A. berkas dokumen                                                */
/* ---------------------------------------------------------------- */
const blueprintExists = existsSync(path.join(ROOT, BLUEPRINT_FILE_NAME));
check('A1 dokumen blueprint ada di root dengan nama baku', blueprintExists, BLUEPRINT_FILE_NAME);

const blueprint = blueprintExists ? read(BLUEPRINT_FILE_NAME) : '';
check('A2 dokumen berisi dan membuka dengan judul', blueprint.trim().length > 4000, `panjang ${blueprint.trim().length}`);
check('A3 dokumen memuat blok angka struktural', /<!-- ANGKA-STRUKTURAL:START -->[\s\S]*<!-- ANGKA-STRUKTURAL:END -->/.test(blueprint));

const SECRET_NAMES =
  /(PB_ADMIN_PASSWORD|PB_SYNC_PASSWORD|DEV_PASSWORD_HASH|DEV_PASSWORD|APP_SESSION_SECRET|JOURNAL_SESSION_SECRET|JOURNAL_DEV_PASSWORD|REMOTE_ACCESS_PASS|GEMINI_API_KEY|META_ACCESS_TOKEN|SHOPEE_ACCESS_TOKEN|SHOPEE_PARTNER_KEY|TIKTOK_ACCESS_TOKEN)\s*=\s*\S/;
const SECRET_SHAPES = [/[$]2[aby][$]/, /[$]scrypt[$]/, /\bsk-[A-Za-z0-9]{16,}/, /\/\/[^/\s:]+:[^@\s]{6,}@/, /[A-Za-z0-9+/]{60,}={0,2}/];
const secretHits = [
  ...(blueprint.match(SECRET_NAMES) || []),
  ...SECRET_SHAPES.flatMap((re) => blueprint.match(re) || []),
];
check('A4 dokumen tidak memuat nilai rahasia', !blueprintExists || secretHits.length === 0, secretHits.slice(0, 2).join(' | '));

/* ---------------------------------------------------------------- */
/*  B. gerbang di server                                             */
/* ---------------------------------------------------------------- */
const serverSource = read('server.ts');
const blueprintSource = read('server/blueprintApi.ts');

check('B1 rute /api/blueprint terdaftar', /app\.get\(['"]\/api\/blueprint['"]/.test(blueprintSource));
check('B2 hanya DEVELOPER yang dilayani', /session\.role[\s\S]{0,80}DEVELOPER/.test(blueprintSource) && /403/.test(blueprintSource));
check('B3 rute ikut dikunci sesi dashboard', /'\/api\/blueprint'/.test(serverSource.slice(serverSource.indexOf('PRIVATE_API_PREFIXES'), serverSource.indexOf('function isPrivateApiPath'))));
check('B4 modul dipasang di server', /registerBlueprintRoutes\(app\)/.test(serverSource));
check('B5 jawaban tidak disimpan browser', /Cache-Control', 'no-store/.test(blueprintSource));
check('B6 path berkas tidak datang dari pemanggil', !/req\.(query|params)|req\.path/.test(blueprintSource));
check('B7 isi respons hanya dokumen, tanpa data toko', /res\.json\(\{ success: true, \.\.\.document \}\)/.test(blueprintSource));
check('B8 nama berkas dipakai dari satu konstanta', new RegExp(BLUEPRINT_FILE_NAME.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')).test(blueprintSource) && !/readFileSync\(\s*['"]MASTER/.test(blueprintSource));

/* ---------------------------------------------------------------- */
/*  C. gerbang di UI                                                 */
/* ---------------------------------------------------------------- */
const settingsSource = read('src/components/CustomerScreen.tsx');
const downloadSource = read('src/utils/blueprintDownload.ts');
const clientSource = read('src/lib/blueprint.ts');

check('C1 DEVELOPER saja yang boleh unduh (kebijakan)', canDownloadBlueprint('DEVELOPER'));
check('C2 ADMIN/OWNER/KASIR/AGEN/SPK ditolak kebijakan', ['ADMIN', 'OWNER', 'KASIR', 'AGEN', 'SPK', '', null, undefined].every((role) => !canDownloadBlueprint(role)));
check('C3 komponen memakai fungsi kebijakan, bukan cek role mentah', /canDownloadBlueprint\(userRole\)/.test(settingsSource));
check('C4 dua opsi unduhan ada di menu Backup', /handleDownloadBlueprint\('md'\)/.test(settingsSource) && /handleDownloadBlueprint\('pdf'\)/.test(settingsSource) && /Unduh Berkas \.md/.test(settingsSource) && /Unduh Berkas \.pdf/.test(settingsSource));
check('C5 tombol kunci saat satu unduhan berjalan', /disabled=\{blueprintBusy !== null\}/.test(settingsSource));
check('C6 pesan hasil berasal dari jawaban, bukan teks tetap', /err instanceof Error \? err\.message/.test(settingsSource) && !/Blueprint selalu tersedia/.test(settingsSource));
check('C7 unduhan membaca dokumen dari server', /fetchBlueprintDocument\(\)/.test(downloadSource) && /\/api\/blueprint/.test(clientSource));
check('C8 PDF disusun dari dokumen hasil unduhan, bukan teks karangan', /planBlueprintPdf\(blueprint\.markdown\)/.test(downloadSource) && /buildBlueprintPdf\(items,/.test(downloadSource));
check('C9 berkas dokumen tidak ikut dibundel ke browser', !new RegExp(BLUEPRINT_FILE_NAME.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')).test(read('src/App.tsx')) && !/import .*MASTER PROMPT/.test(downloadSource));

/* ---------------------------------------------------------------- */
/*  D. angka struktural: dokumen harus ikut berubah saat repo berubah */
/* ---------------------------------------------------------------- */
const block = blueprint.match(/<!-- ANGKA-STRUKTURAL:START -->([\s\S]*?)<!-- ANGKA-STRUKTURAL:END -->/)?.[1] || '';
const documented = new Map<string, number>();
for (const [, label, value] of block.matchAll(/^-\s*(.+?):\s*(\d+)\s*$/gm)) documented.set(label.trim(), Number(value));

const serverModules = list('server').filter((f) => f.endsWith('.ts'));
const routeFiles = ['server.ts', ...serverModules.map((f) => `server/${f}`)];
let apiRoutes = 0;
for (const file of routeFiles) {
  for (const match of read(file).matchAll(/\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]*)\2/g)) {
    const routePath = match[3];
    if (routePath === '*' || routePath === '/*') continue; // wildcard SPA, bukan rute API
    apiRoutes += 1;
  }
}
const navSource = read('src/components/Navbar.tsx');
const tabsBlock = navSource.slice(navSource.indexOf('const ALL_TABS'), navSource.indexOf('];', navSource.indexOf('const ALL_TABS')));
const tabs = (tabsBlock.match(/\{ id: '/g) || []).length;
const schemaCollections = (read('scripts/create-pocketbase-collections.mjs').match(/name: '/g) || []).length;
const journalCollections = (read('server/journalApi.ts').match(/^const \w*COLLECTION\w* = '[a-z_]+'/gm) || []).length;
const realtimeChannels = (read('src/backend/pocketbaseBackend.ts').match(/export function subscribe/g) || []).length;

const mirrors = new Set<string>();
const srcFiles = readdirSync(path.join(ROOT, 'src'), { recursive: true })
  .map((entry) => String(entry).split(path.sep).join('/'))
  .filter((rel) => /\.tsx?$/.test(rel));
for (const rel of srcFiles) {
  for (const m of read(`src/${rel}`).matchAll(/'bejo_pos_[a-z0-9_]*'/g)) mirrors.add(m[0]);
}

const guardFiles = list('scripts').filter((f) => f.startsWith('check-')).length;
const npmScripts = Object.keys(JSON.parse(read('package.json')).scripts).length;

const expected: Array<[string, number]> = [
  ['Rute API', apiRoutes],
  ['Berkas modul server', serverModules.length],
  ['Tab navigasi', tabs],
  ['Koleksi PocketBase dari skema', schemaCollections],
  ['Koleksi jurnal dibuat saat boot', journalCollections],
  ['Kanal langganan realtime', realtimeChannels],
  ['Cermin localStorage seluruhnya', mirrors.size],
  ['Berkas penjaga di scripts', guardFiles],
  ['Perintah npm', npmScripts],
];

for (const [label, measured] of expected) {
  const written = documented.get(label);
  check(
    `D ${label}: dokumen ${written ?? 'tidak ditulis'} vs repo ${measured}`,
    written === measured,
    written === measured ? '' : 'perbarui blok ANGKA-STRUKTURAL di dokumen'
  );
}

/* ---------------------------------------------------------------- */
/*  E. penjaga & aturan terhubung                                    */
/* ---------------------------------------------------------------- */
const packageScripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
check('E1 npm run check:blueprint tersedia', typeof packageScripts['check:blueprint'] === 'string');
const agentsSource = read('AGENTS.md');
check('E2 AGENTS.md mewajibkan update dokumen saat struktur berubah', /MASTER PROMPT & BLUEPRINT ARSITEKTUR APLIKASI\.md[\s\S]{0,4000}check:blueprint/.test(agentsSource));
check('E3 AGENTS.md menyebut dokumen hanya untuk DEVELOPER', /Dokumen blueprint|MASTER PROMPT/.test(agentsSource) && /DEVELOPER/.test(agentsSource));

/* ---------------------------------------------------------------- */
/*  F. susunan PDF                                                   */
/* ---------------------------------------------------------------- */
const printableSource = blueprint.replace(/<!--\s*ANGKA-STRUKTURAL:START\s*-->[\s\S]*?<!--\s*ANGKA-STRUKTURAL:END\s*-->/g, '');
const pdfItems = planBlueprintPdf(blueprint);
const pdfLines = pdfItems.filter((item) => item.kind === 'text');
const proseLines = pdfLines.filter((item) => item.style !== 'monospace');
const docLineCount = printableSource.split(/\r?\n/).filter((line) => line.trim() !== '').length;
const headingCount = printableSource
  .replace(/<!--[\s\S]*?-->/g, '')
  .split(/\r?\n/)
  .filter((line) => /^#{1,3}\s/.test(line.trim())).length;
const tableRows = printableSource
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith('|') && !/^[\s|:-]+$/.test(line));
const printedTableRows = pdfLines.filter((item) => item.size === 8 && item.style === 'normal' && item.indent === 2);

check('F1 hampir seluruh baris dokumen tersusun', pdfLines.length > 150 && pdfLines.length >= docLineCount * 0.6, `${pdfLines.length} baris cetak dari ${docLineCount} baris dokumen`);
check('F2 komentar dan blok angka penjaga tidak tercetak', pdfLines.every((item) => !/<!--|ANGKA-STRUKTURAL/.test(item.text)) && !pdfLines.some((item) => /^•\s+(Rute API|Tab navigasi|Perintah npm):\s*\d+$/.test(item.text)));
check('F3 penanda tebal dan kutip kode dibuang', proseLines.every((item) => !/(\*\*|`)/.test(item.text)));
check('F4 pemisah tabel Markdown tidak tercetak', pdfLines.every((item) => !/^[-:\s|]+$/.test(item.text) || item.text.trim() === ''));
check('F5 tiap judul menjadi satu baris tebal', proseLines.filter((item) => item.style === 'bold').length === headingCount, `${headingCount} judul`);
check('F6 judul tingkat satu paling besar', pdfLines[0]?.style === 'bold' && pdfLines[0]?.size === 15 && !/^[#|>]/.test(pdfLines[0]?.text ?? ''));
check('F7 blok kode dicetak dengan huruf lebar tetap', pdfLines.some((item) => item.style === 'monospace'));
check('F8 baris tabel diratakan tanpa pipa', printedTableRows.length === tableRows.length && printedTableRows.every((item) => !item.text.includes('|')), `${printedTableRows.length} dari ${tableRows.length} baris tabel`);
check('F9 antarr blok diberi ruang', pdfItems.some((item) => item.kind === 'gap'));
// Huruf standar PDF hanya mengenal WinAnsi; di luarnya tercetak sebagai kotak.
const WINANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
  0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);
const unreadableGlyphs = new Set<string>();
for (const item of pdfLines) {
  for (const ch of item.text) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff || WINANSI_EXTRA.has(code)) continue;
    unreadableGlyphs.add(ch);
  }
}
check('F10 setiap karakter tercetak punya hurufnya di PDF', unreadableGlyphs.size === 0, [...unreadableGlyphs].join(' '));

if (failures > 0) {
  console.log(`\n${failures} pemeriksaan GAGAL`);
  process.exit(1);
}
console.log('\nSemua pemeriksaan dokumen blueprint & gerbang unduhnya lulus.');
