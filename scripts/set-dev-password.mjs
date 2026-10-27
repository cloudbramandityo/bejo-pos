#!/usr/bin/env node
/**
 * Menyimpan password DEVELOPER sebagai hash scrypt di `.env`.
 *
 * Password asli tidak pernah ditulis ke disk, tidak dicetak, dan tidak
 * melewati argumen proses (agar tidak terlihat di daftar proses/shell history).
 *
 * Contoh:
 *   # dari .env lama yang masih plaintext (migrasi otomatis)
 *   node scripts/set-dev-password.mjs --env .env --from-env
 *
 *   # setel password TETAP (disarankan: sekali saja, 10+ karakter)
 *   node scripts/set-dev-password.mjs --prompt
 *
 *   # cek password terhadap hash yang tersimpan (tanpa mengubah .env)
 *   node scripts/set-dev-password.mjs --verify
 *
 *   # password dari stdin (dipakai deploy untuk rotasi darurat)
 *   ... | node scripts/set-dev-password.mjs --env .env --stdin --base64
 *
 *   # hanya membuat hash untuk ditempel manual (non-ASCII: tambahkan --base64)
 *   echo "<password>" | node scripts/set-dev-password.mjs --hash
 *
 * Hasil di .env:
 *   DEV_PASSWORD_HASH=scrypt$16384$8$1$<salt>$<hash>
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const PREFIX = 'scrypt';
const COST = { N: 16384, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const PLAINTEXT_KEYS = ['DEV_PASSWORD', 'JOURNAL_DEV_PASSWORD'];

function fail(message) {
  console.error(`[GAGAL] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    env: '',
    fromEnv: false,
    stdin: false,
    prompt: false,
    verify: false,
    base64: false,
    hashOnly: false,
    printHash: false,
    noBackup: false,
    username: '',
    minLength: 10,
    allowWeak: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env') options.env = argv[++i] || '';
    else if (arg === '--from-env') options.fromEnv = true;
    else if (arg === '--stdin') options.stdin = true;
    else if (arg === '--prompt') options.prompt = true;
    else if (arg === '--verify') options.verify = true;
    else if (arg === '--base64') options.base64 = true;
    else if (arg === '--hash') options.hashOnly = true;
    else if (arg === '--print-hash') options.printHash = true;
    else if (arg === '--no-backup') options.noBackup = true;
    else if (arg === '--username') options.username = argv[++i] || '';
    else if (arg === '--min-length') options.minLength = Number(argv[++i] || 12);
    else if (arg === '--allow-weak') options.allowWeak = true;
    else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      fail(`Argumen tidak dikenal: ${arg}. Gunakan --help.`);
    }
  }
  if (!Number.isInteger(options.minLength) || options.minLength < 1) {
    fail('--min-length harus bilangan bulat positif.');
  }
  return options;
}

function printUsage() {
  console.log(
    [
      'Pemakaian: node scripts/set-dev-password.mjs [opsi]',
      '',
      '  --env <path>        File .env yang diperbarui (default: .env)',
      '  --prompt            Minta password sekali (input tersembunyi) lalu simpan hash',
      '  --verify            Periksa password terhadap DEV_PASSWORD_HASH (tanpa mengubah .env)',
      '  --from-env          Ambil DEV_PASSWORD/JOURNAL_DEV_PASSWORD dari .env lalu hash',
      '  --stdin             Baca password dari stdin (satu baris)',
      '  --base64            Password di stdin di-encode base64 (aman untuk non-ASCII)',
      '  --hash              Cetak hash saja, tanpa mengubah .env',
      '  --print-hash        Cetak hash setelah disimpan',
      '  --no-backup         Jangan buat backup .env',
      '  --username <nama>   Set juga DEV_USERNAME',
      '  --min-length <n>    Panjang minimum password (default 10)',
      '  --allow-weak        Lewati batas panjang minimum untuk --stdin/--prompt',
      '',
      'Untuk password tetap: jalankan --prompt sekali, lalu jangan dirotasi lagi.',
      'Password tidak pernah dicetak. Hash scrypt aman disimpan di .env.',
    ].join('\n')
  );
}

function readEnvFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const bom = raw.startsWith('\ufeff');
  const body = bom ? raw.slice(1) : raw;
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  return { lines: body.split(/\r?\n/), eol };
}

function parseValue(raw) {
  let value = raw.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function getValue(lines, key) {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    if (trimmed.slice(0, eq).trim() === key) return parseValue(trimmed.slice(eq + 1));
  }
  return '';
}

function formatValue(value) {
  if (/[\r\n]/.test(value)) fail('Nilai .env tidak boleh mengandung baris baru.');
  if (/[\s#'"]/.test(value)) {
    if (value.includes("'")) return `"${value.replace(/"/g, '\\"')}"`;
    return `'${value}'`;
  }
  return value;
}

function setValue(lines, key, value) {
  const pattern = new RegExp(`^\\s*${key}\\s*=`);
  const next = `${key}=${formatValue(value)}`;
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i])) {
      lines[i] = next;
      return;
    }
  }
  // Pertahankan newline akhir file: sisipkan sebelum elemen kosong terakhir.
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.splice(lines.length - 1, 0, next);
    return;
  }
  lines.push(next);
}

function deprecateKeys(lines, keys) {
  const stamp = new Date().toISOString().slice(0, 10);
  let changed = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const isActive = keys.some((key) => new RegExp(`^\\s*${key}\\s*=`).test(lines[i]));
    if (!isActive) continue;
    lines[i] = `# [DEPRECATED ${stamp}] ${lines[i].trim()}`;
    changed += 1;
  }
  return changed;
}

function writeEnvFile(file, lines, eol) {
  const dir = path.dirname(file);
  const temp = path.join(dir, `.env.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temp, lines.join(eol), { encoding: 'utf8' });
  fs.renameSync(temp, file);
}

function scryptOptions(N, r, p) {
  const memory = 128 * N * r;
  return { N, r, p, maxmem: Math.max(64 * 1024 * 1024, memory * 2) };
}

function derive(password, salt, keyLength, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function createHash(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, scryptOptions(COST.N, COST.r, COST.p));
  return [PREFIX, COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join('$');
}

/** Cermin dari server/passwordHash.ts: pastikan hash bisa diverifikasi sebelum disimpan. */
async function verifyHash(password, stored) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  const salt = Buffer.from(saltRaw, 'base64');
  const expected = Buffer.from(hashRaw, 'base64');
  if (expected.length < 16) return false;
  const actual = await derive(password, salt, expected.length, scryptOptions(N, r, p));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function readStdinLine() {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    let line = null;
    rl.on('line', (value) => {
      if (line === null) {
        line = value;
        rl.close();
      }
    });
    rl.on('close', () => resolve(line === null ? '' : line));
    rl.on('error', reject);
  });
}

/** Input password tanpa echo; hanya berjalan pada terminal interaktif. */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let muted = false;
    const writeOriginal = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (text) => {
      if (!muted) writeOriginal(text);
    };
    rl.output.write(question);
    muted = true;
    rl.question('', (answer) => {
      rl.close();
      rl.output.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceCount = [options.fromEnv, options.stdin, options.prompt].filter(Boolean).length;
  if (sourceCount > 1) {
    fail('Pilih salah satu sumber password: --prompt, --from-env, atau --stdin.');
  }
  if (options.verify && options.fromEnv) {
    fail('--verify tidak memakai --from-env; gunakan --prompt atau --stdin.');
  }
  if (options.verify && options.hashOnly) {
    fail('--verify tidak bisa digabung dengan --hash.');
  }
  if (sourceCount === 0) {
    if (options.verify) options.prompt = true;
    else fail('Tentukan sumber password: --prompt, --from-env, atau --stdin. Lihat --help.');
  }
  if (!options.env) options.env = '.env';
  const envPath = path.resolve(options.env);
  if (!options.hashOnly && !fs.existsSync(envPath)) {
    fail(`File .env tidak ditemukan: ${envPath}`);
  }

  let password = '';
  let source = '';

  if (options.stdin) {
    if (process.stdin.isTTY) {
      fail('--stdin membutuhkan input dari pipe. Contoh: $p | node scripts/set-dev-password.mjs --env .env --stdin --base64');
    }
    const raw = await readStdinLine();
    source = options.base64 ? 'stdin(base64)' : 'stdin';
    if (options.base64) {
      const normalized = raw.replace(/\s+/g, '');
      if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
        fail('Input stdin bukan base64 yang valid.');
      }
      password = Buffer.from(normalized, 'base64').toString('utf8');
    } else {
      password = raw;
    }
    if (!password) fail('Password kosong dari stdin.');
    if (!options.allowWeak && !options.verify && password.length < options.minLength) {
      fail(`Password minimal ${options.minLength} karakter.`);
    }
  } else if (options.prompt) {
    if (!process.stdin.isTTY) {
      fail('--prompt membutuhkan terminal interaktif. Jalankan langsung di PowerShell, bukan lewat pipe.');
    }
    const first = await promptHidden(
      options.verify ? 'Password DEVELOPER: ' : 'Password DEVELOPER (input tersembunyi): '
    );
    if (!options.verify) {
      const second = await promptHidden('Ulangi password DEVELOPER: ');
      if (first !== second) fail('Konfirmasi password tidak sama; .env tidak diubah.');
    }
    password = first;
    source = 'prompt';
    if (!password) fail('Password kosong.');
    if (!options.allowWeak && !options.verify && password.length < options.minLength) {
      fail(`Password minimal ${options.minLength} karakter.`);
    }
  } else {
    const { lines } = readEnvFile(envPath);
    const existingHash = getValue(lines, 'DEV_PASSWORD_HASH');
    if (existingHash && !getValue(lines, 'DEV_PASSWORD') && !getValue(lines, 'JOURNAL_DEV_PASSWORD')) {
      fail('DEV_PASSWORD_HASH sudah ada dan tidak ada plaintext untuk dimigrasi.');
    }
    password = getValue(lines, 'DEV_PASSWORD') || getValue(lines, 'JOURNAL_DEV_PASSWORD');
    source = '.env';
    if (!password) fail('DEV_PASSWORD / JOURNAL_DEV_PASSWORD kosong di .env.');
    if (password.length < options.minLength) {
      console.warn(
        `[PERINGATAN] Password lama hanya ${password.length} karakter (< ${options.minLength}). Ganti setelah migrasi.`
      );
    }
  }

  if (options.verify) {
    const { lines } = readEnvFile(envPath);
    const stored = getValue(lines, 'DEV_PASSWORD_HASH');
    if (!stored || !stored.startsWith(`${PREFIX}$`)) {
      fail('DEV_PASSWORD_HASH belum disetel atau formatnya tidak dikenal di .env.');
    }
    if (!(await verifyHash(password, stored))) {
      fail('Password TIDAK cocok dengan DEV_PASSWORD_HASH di .env.');
    }
    console.log('[OK] Password cocok dengan DEV_PASSWORD_HASH di .env.');
    return;
  }

  const hash = await createHash(password);
  if (!(await verifyHash(password, hash))) {
    fail('Verifikasi hash gagal; .env tidak diubah.');
  }

  if (options.hashOnly) {
    console.log(hash);
    return;
  }

  const { lines, eol } = readEnvFile(envPath);
  let backup = '';
  if (!options.noBackup) {
    // Backup ke folder backups/ (gitignored) karena masih memuat plaintext lama.
    const backupDir = path.join(path.dirname(envPath), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+$/, '')
      .replace('T', '-');
    backup = path.join(backupDir, `env-${stamp}.bak`);
    fs.copyFileSync(envPath, backup);
  }

  setValue(lines, 'DEV_PASSWORD_HASH', hash);
  if (options.username) setValue(lines, 'DEV_USERNAME', options.username);
  const deprecated = deprecateKeys(lines, PLAINTEXT_KEYS);
  writeEnvFile(envPath, lines, eol);

  console.log(`[OK] DEV_PASSWORD_HASH tersimpan di ${path.basename(envPath)} (sumber: ${source}).`);
  console.log('[PETUNJUK] Restart service aplikasi agar .env dibaca ulang (mis. Restart-Service BejoStikerPOS).');
  if (deprecated > 0) {
    console.log(`[OK] ${deprecated} baris password plaintext dinonaktifkan.`);
  }
  if (backup) {
    console.log(`[OK] Backup: ${path.join('backups', path.basename(backup))} (masih memuat nilai lama; amankan/hapus).`);
  } else {
    console.log('[OK] Backup .env dilewati (--no-backup).');
  }
  if (options.printHash) console.log(hash);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
