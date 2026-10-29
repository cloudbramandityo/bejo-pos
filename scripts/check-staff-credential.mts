/**
 * Uji regresi penulisan kredensial staf memakai PocketBase palsu di memori.
 * Tidak menyentuh database cloud. Jalankan: npm run check:users
 *
 * Yang dijaga: record lama (email cadangan tanpa legacyId) diadopsi, bukan
 * digandakan; create selalu membawa legacyId; percobaan ulang idempoten; dan
 * akun yang memakai email cadangan tetap bisa diperbarui.
 */
import {
  saveCredential,
  credentialEmail,
  credentialFallbackEmail,
} from '../server/staffStore.ts';

type Rec = Record<string, any>;

class FakePB {
  records: Rec[];
  noLegacyField: boolean;
  creates: Rec[] = [];

  constructor(records: Rec[], noLegacyField = false) {
    this.records = records;
    this.noLegacyField = noLegacyField;
  }

  collection(_name: string) {
    const self = this;
    return {
      async getFullList({ filter }: { filter: string }) {
        const m = /^(\w+) = "([^"]*)"$/.exec(String(filter).trim());
        if (!m) throw { status: 400, response: { data: { filter: {} } } };
        const [, field, value] = m;
        return self.records.filter((r) => String(r[field] ?? '') === value);
      },
      async create(body: Rec) {
        if (self.noLegacyField && 'legacyId' in body) {
          throw { status: 400, message: 'Failed to create record.', response: { data: { legacyId: { code: 'unknown_field', message: 'Unknown field.' } } } };
        }
        if (body.email && self.records.some((r) => r.email === body.email)) {
          throw { status: 400, message: 'Failed to create record.', response: { data: { email: { code: 'validation_not_unique', message: 'The email is invalid or already in use.' } } } };
        }
        const rec = { id: `rec_${self.records.length + 1}`, ...body };
        self.records.push(rec);
        self.creates.push(rec);
        return rec;
      },
      async update(id: string, patch: Rec) {
        const rec = self.records.find((r) => r.id === id);
        if (!rec) throw { status: 404 };
        if (self.noLegacyField && 'legacyId' in patch) {
          throw { status: 400, message: 'Failed to update record.', response: { data: { legacyId: { code: 'unknown_field' } } } };
        }
        if (patch.email && self.records.some((r) => r.id !== id && r.email === patch.email)) {
          throw { status: 400, message: 'Failed to update record.', response: { data: { email: { code: 'validation_not_unique', message: 'The email is invalid or already in use.' } } } };
        }
        Object.assign(rec, patch);
        return rec;
      },
    };
  }
}

function entry(id: string, username: string, password = 'rahasia123') {
  return {
    id,
    username,
    name: `Nama ${username}`,
    role: 'KASIR',
    phone: '',
    isActive: true,
    spkRoleCategory: '',
    createdAt: '',
    password,
    authId: '',
    presence: {},
  };
}

let failures = 0;
function check(label: string, condition: boolean, extra = '') {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!condition) failures += 1;
}

// A. Record yatim hasil restore lama (email cadangan, tanpa legacyId) harus diadopsi.
{
  const pb: any = new FakePB([
    { id: 'rec_lain', email: credentialEmail('budi', 'user_lain'), legacyId: 'user_lain' },
    { id: 'rec_yatim', email: credentialFallbackEmail('budi', 'u1'), name: 'Budi Lama' },
  ]);
  const antes = pb.records.length;
  const id = await saveCredential(pb, entry('u1', 'budi') as any);
  check('A: adopsi record email cadangan', id === 'rec_yatim');
  check('A: tidak membuat record baru', pb.creates.length === 0, `create=${pb.creates.length}/${antes}`);
  check('A: legacyId terisi', pb.records.find((r: Rec) => r.id === 'rec_yatim')?.legacyId === 'u1');
}

// B. Akun baru: satu create, membawa legacyId.
{
  const pb: any = new FakePB([]);
  const id = await saveCredential(pb, entry('u2', 'sari') as any);
  check('B: create baru', pb.creates.length === 1 && id === pb.creates[0].id);
  check('B: email utama + legacyId', pb.creates[0].email === credentialEmail('sari', 'u2') && pb.creates[0].legacyId === 'u2');
}

// C. Email utama milik akun lain: pakai email cadangan, lalu percobaan kedua mengadopsinya.
{
  const pb: any = new FakePB([{ id: 'rec_lama', email: credentialEmail('andi', 'user_lama'), legacyId: 'user_lama' }]);
  const first = await saveCredential(pb, entry('u3', 'andi') as any);
  check('C: fallback membawa legacyId', pb.creates.length === 1 && pb.creates[0].legacyId === 'u3');
  const second = await saveCredential(pb, entry('u3', 'andi') as any);
  check('C: percobaan ulang tidak membuat record baru', pb.creates.length === 1 && second === first);
}

// E. Record dengan email cadangan diperbarui: email tidak boleh dipaksa berubah.
{
  const pb: any = new FakePB([
    { id: 'rec_taken', email: credentialEmail('rina', 'user_lain'), legacyId: 'user_lain' },
    { id: 'rec_rina', email: credentialFallbackEmail('rina', 'u5'), legacyId: 'u5', name: 'Lama' },
  ]);
  const next = { ...entry('u5', 'rina', 'passwordBaru123'), authId: 'rec_rina' };
  const id = await saveCredential(pb, next as any);
  const rec = pb.records.find((r: Rec) => r.id === 'rec_rina');
  check('E: update tetap berhasil', id === 'rec_rina');
  check('E: email cadangan dipertahankan', rec?.email === credentialFallbackEmail('rina', 'u5'));
  check('E: password ikut diperbarui', rec?.password === 'passwordBaru123');
}

// D. Skema `users` tanpa field legacyId: create tanpa field itu.
{
  const pb: any = new FakePB([], true);
  const id = await saveCredential(pb, entry('u4', 'tono') as any);
  check('D: create tanpa legacyId', pb.creates.length === 1 && id === pb.creates[0].id);
  check('D: tidak menyertakan legacyId', !('legacyId' in pb.creates[0]));
}

// F. Kontrak kebijakan password saat create: (username, password).
{
  const pb: any = new FakePB([]);
  let seen = '';
  const id = await saveCredential(
    pb,
    entry('u6', 'budi', 'CetakPresisi2026') as any,
    (username: string, password: string) => {
      seen = `${username}|${password}`;
    }
  );
  check(
    'F: kebijakan menerima (username, password)',
    id === pb.creates[0].id && seen === 'budi|CetakPresisi2026',
    seen
  );
}

console.log(failures === 0 ? 'SEMUA LULUS' : `${failures} GAGAL`);
process.exit(failures === 0 ? 0 : 1);
