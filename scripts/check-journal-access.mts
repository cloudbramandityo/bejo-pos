/**
 * Guard hak akses modul Jurnal.
 * Jalankan: npm run check:journal
 *
 * Yang dijaga (bug 2026-10-30: ADMIN di perangkat lain melihat menu Jurnal tapi
 * datanya kosong karena server menuntut cookie sesi DEVELOPER untuk membaca):
 *   A-C  aturan baca/tulis di src/utils/journalAccessPolicy.ts
 *   D-E  server ikut aturan yang sama dan menaruh gerbang yang benar per rute
 *   F    sisi browser: ADMIN tidak dihambat, DEVELOPER dengan cookie kedaluwarsa
 *        memperbarui sesi, sesi kosong tetap ditolak
 *   G    pesan 401 tidak lagi menyalahkan "Sesi DEVELOPER"
 */
import { readFileSync } from 'node:fs';
import {
  canReadJournal,
  canWriteJournal,
  getJournalAccess,
} from '../src/utils/journalAccessPolicy.ts';

let failures = 0;
function check(label: string, condition: boolean, extra = '') {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!condition) failures += 1;
}

const serverSource = readFileSync(new URL('../server/journalApi.ts', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const mirrorSource = readFileSync(new URL('../src/lib/journalMirrorSync.ts', import.meta.url), 'utf8');

/* ---------------------------------------------------------------- */
/*  A-B-C. aturan tunggal                                            */
/* ---------------------------------------------------------------- */
check('A1 DEVELOPER boleh menulis', canWriteJournal('DEVELOPER'));
check('A2 ADMIN tidak boleh menulis', !canWriteJournal('ADMIN'));
check('A3 OWNER tidak boleh menulis', !canWriteJournal('OWNER'));
check('A4 role kosong tidak boleh menulis', !canWriteJournal(undefined));

for (const role of ['DEVELOPER', 'OWNER', 'ADMIN']) {
  check(`B1 ${role} boleh membaca`, canReadJournal(role));
}
for (const role of ['KASIR', 'AGEN', '', undefined, null]) {
  check(`B2 ${JSON.stringify(role)} tidak boleh membaca`, !canReadJournal(role as string));
}
check('B3 huruf kecil dan spasi dinormalkan', canReadJournal('  admin '));

check('C1 DEVELOPER = edit', getJournalAccess('DEVELOPER') === 'edit');
check('C2 ADMIN = view', getJournalAccess('ADMIN') === 'view');
check('C3 OWNER = view', getJournalAccess('OWNER') === 'view');
check('C4 KASIR = none', getJournalAccess('KASIR') === 'none');

/* ---------------------------------------------------------------- */
/*  D-E. gerbang per rute di server                                  */
/* ---------------------------------------------------------------- */
check(
  'D1 server mengimpor aturan yang sama dengan UI',
  /from ['"]\.\.\/src\/utils\/journalAccessPolicy['"]/.test(serverSource)
);
check('D2 server tidak punya daftar role pembaca sendiri', !/JOURNAL_READERS/.test(serverSource));

function firstGateOf(method: 'get' | 'put', path: string): string {
  const route = new RegExp(`app\\.${method}\\(\\s*'${path}'`, 'm').exec(serverSource);
  if (!route) return 'ROTE TIDAK ADA';
  const body = serverSource.slice(route.index, route.index + 1200);
  const gate = /require(JournalReader|Developer)\(/.exec(body);
  return gate ? `require${gate[1]}` : '';
}

check(
  'E1 GET /api/journal/config dibaca lewat gerbang reader',
  firstGateOf('get', '/api/journal/config') === 'requireJournalReader'
);
check(
  'E2 GET /api/journal/sheets dibaca lewat gerbang reader',
  firstGateOf('get', '/api/journal/sheets') === 'requireJournalReader'
);
check(
  'E3 PUT /api/journal/config tetap khusus DEVELOPER',
  firstGateOf('put', '/api/journal/config') === 'requireDeveloper'
);
check(
  'E4 PUT /api/journal/sheets tetap khusus DEVELOPER',
  firstGateOf('put', '/api/journal/sheets') === 'requireDeveloper'
);
check(
  'E5 perpanjangan sesi Jurnal tanpa kredensial dikunci role DEVELOPER',
  /getDashboardRole\(req\)\s*!==\s*'DEVELOPER'/.test(serverSource)
);
check(
  'E6 sesi dashboard dibaca lewat dependensi, bukan impor posAuth (hindari siklus)',
  !/from ['"]\.\/posAuth['"]/.test(serverSource) &&
    /getDashboardRole: \(req: Request\) => string \| null/.test(serverSource)
);
check(
  'E7 server.ts menyuntik peran dari cookie sesi dashboard',
  /registerJournalRoutes\(app,\s*\{\s*getDashboardRole:\s*\(req\)\s*=>\s*getPosSession\(req\)\?\.role/.test(
    entrySource
  )
);

/* ---------------------------------------------------------------- */
/*  F. sisi browser dengan fetch palsu                               */
/* ---------------------------------------------------------------- */
interface SessionPayload {
  authenticated: boolean;
  username: string | null;
  dashboardRole: string | null;
  canRead: boolean;
  canWrite: boolean;
  configured: { developerLogin: boolean; pocketbaseAdmin: boolean; sessionSecret: boolean };
}

const configured = { developerLogin: true, pocketbaseAdmin: true, sessionSecret: true };
const calls: string[] = [];
let sessionSteps: SessionPayload[] = [];

(globalThis as unknown as { fetch: unknown }).fetch = async (
  path: string,
  init?: RequestInit
) => {
  const method = String(init?.method || 'GET').toUpperCase();
  calls.push(`${method} ${path}`);
  if (method === 'POST') {
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  }
  const next = sessionSteps.shift();
  if (!next) throw new Error('skenario sesi habis');
  return { ok: true, status: 200, json: async () => ({ success: true, ...next }) };
};

const { ensureJournalSession, JournalApiError } = await import('../src/lib/journalApi.ts');

async function scenario(
  steps: SessionPayload[],
  run: () => Promise<unknown>
): Promise<{ ok: boolean; error?: unknown; calls: string[] }> {
  sessionSteps = steps;
  calls.length = 0;
  try {
    await run();
    return { ok: true, calls: [...calls] };
  } catch (error) {
    return { ok: false, error, calls: [...calls] };
  }
}

const readerSession: SessionPayload = {
  authenticated: false,
  username: null,
  dashboardRole: 'ADMIN',
  canRead: true,
  canWrite: false,
  configured,
};
const devExpired: SessionPayload = { ...readerSession, dashboardRole: 'DEVELOPER' };
const devRenewed: SessionPayload = {
  ...devExpired,
  authenticated: true,
  username: 'langgo',
  canWrite: true,
};
const noSession: SessionPayload = {
  ...readerSession,
  dashboardRole: null,
  canRead: false,
};

const readerRun = await scenario([readerSession], () => ensureJournalSession());
check(
  'F1 ADMIN boleh langsung membaca tanpa dipaksa login developer',
  readerRun.ok && readerRun.calls.length === 1 && readerRun.calls[0] === 'GET /api/journal/session',
  readerRun.calls.join('|')
);

const devRun = await scenario([devExpired, devRenewed], () => ensureJournalSession());
check(
  'F2 cookie DEVELOPER kedaluwarsa diperbarui lalu dibaca ulang',
  devRun.calls.join('|') ===
    'GET /api/journal/session|POST /api/journal/session|GET /api/journal/session' && devRun.ok,
  devRun.calls.join('|')
);

const anonymousRun = await scenario([noSession], () => ensureJournalSession());
const anonymousError = anonymousRun.error as { status?: number; message?: string };
check('F3 tanpa sesi dashboard tetap ditolak', !anonymousRun.ok);
check('F3b penolakannya status 401', anonymousError?.status === 401);
check(
  'F3c pesannya tidak menyalahkan peran DEVELOPER',
  !String(anonymousError?.message).includes('DEVELOPER'),
  String(anonymousError?.message)
);
check(
  'F3d pesannya menyebut langkah berikutnya (login ulang)',
  /login ulang/i.test(String(anonymousError?.message))
);

/* ---------------------------------------------------------------- */
/*  G. pesan galat cloud                                             */
/* ---------------------------------------------------------------- */
const { describeJournalCloudError } = await import('../src/lib/journalMirrorSync.ts');
const message401 = describeJournalCloudError(new JournalApiError('Sesi habis.', 401));
check('G1 pesan 401 tidak berbunyi "Sesi DEVELOPER tidak aktif"', !message401.includes('DEVELOPER'), message401);
check('G2 pesan 401 menawarkan aksi yang benar', message401.includes('Coba lagi'), message401);
const message403 = describeJournalCloudError(new JournalApiError('Ditolak.', 403));
check('G3 pesan 403 menjelaskan hak akses', !message403.includes('DEVELOPER tidak aktif'), message403);
check('G4 teks lama hilang dari source', !mirrorSource.includes('Sesi DEVELOPER tidak aktif'));

console.log(failures === 0 ? '\nSemua pemeriksaan akses Jurnal lulus.' : `\n${failures} pemeriksaan gagal.`);
process.exit(failures === 0 ? 0 : 1);
