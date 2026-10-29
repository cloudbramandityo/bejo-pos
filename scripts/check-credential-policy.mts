/**
 * Guard kebijakan kredensial akun staf.
 * Jalankan: npm run check:users (bagian dari pemeriksaan kredensial).
 *
 * Yang dijaga: password default repo & tebakan publik tidak bisa dipakai
 * membuat akun, password tidak boleh mengikuti username, dan generator
 * password selalu menghasilkan password yang lolos kebijakan.
 */
import {
  MIN_PASSWORD_LENGTH,
  MIN_TEMPORARY_PASSWORD_LENGTH,
  checkPasswordPolicy,
  checkTemporaryPassword,
  checkUsernameFormat,
  generateStrongPassword,
  isPasswordMasked,
  isPubliclyKnownPassword,
} from '../src/utils/credentialPolicy.ts';

let failures = 0;
function check(label: string, condition: boolean, extra = '') {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!condition) failures += 1;
}

const reject = (username: string, password: string, code: string) => {
  const problem = checkPasswordPolicy(username, password);
  return problem?.code === code;
};

check('default repo admin123 ditolak', reject('admin', 'admin123', 'PUBLIC_PASSWORD'));
check('default repo agen123 ditolak', reject('tanon', 'agen123', 'PUBLIC_PASSWORD'));
check('default repo kasir123 ditolak', reject('kasir', 'kasir123', 'PUBLIC_PASSWORD'));
check('default repo spk123 ditolak', reject('spk', 'spk123', 'PUBLIC_PASSWORD'));
check('default repo desain123 ditolak', reject('desain', 'desain123', 'PUBLIC_PASSWORD'));
check('default repo finishing123 ditolak', reject('finishing', 'finishing123', 'PUBLIC_PASSWORD'));
check('varian Admin12345! ditolak', reject('budi', 'Admin12345!', 'PUBLIC_PASSWORD'));
check('password publik kebal huruf besar ditolak', reject('budi', 'PaSsWoRd123', 'PUBLIC_PASSWORD'));
check('password terlalu pendek ditolak', reject('budi', 'Cetak26', 'WEAK_PASSWORD'));
check('password tanpa angka ditolak', reject('budi', 'cetakpresisi', 'WEAK_PASSWORD'));
check('password satu karakter berulang ditolak', reject('budi', 'aaaaaaaaaa', 'WEAK_PASSWORD'));
check(
  'password sama dengan username ditolak',
  reject('cetakpresisi', 'cetakpresisi1', 'PASSWORD_FOLLOWS_USERNAME')
);
check(
  'password diawali username ditolak',
  reject('kasir2', 'Kasir2-2026', 'PASSWORD_FOLLOWS_USERNAME')
);
check('password kuat diterima', checkPasswordPolicy('budi', 'CetakPresisi2026') === null);
check('password kuat dengan simbol diterima', checkPasswordPolicy('budi', 'X7#mejaCetak') === null);
check('mask server bukan password', isPasswordMasked('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'));
check('mask tidak dianggap password publik', !isPubliclyKnownPassword('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'));

check('password sementara admin123 diterima', checkTemporaryPassword('admin123') === null);
check(
  'password sementara terlalu pendek ditolak',
  checkTemporaryPassword('a'.repeat(MIN_TEMPORARY_PASSWORD_LENGTH - 1))?.code === 'WEAK_PASSWORD'
);
check('username valid diterima', checkUsernameFormat('kasir_pagi.1') === null);
check('username terlalu pendek ditolak', checkUsernameFormat('ab') !== null);
check('username diawali simbol ditolak', checkUsernameFormat('_kasir') !== null);
check('username huruf besar dinormalisasi diterima', checkUsernameFormat('KASIR_PAGI') === null);

let generatedOk = true;
for (let i = 0; i < 200; i += 1) {
  const password = generateStrongPassword();
  if (password.length < MIN_PASSWORD_LENGTH || checkPasswordPolicy('staf', password)) {
    generatedOk = false;
    console.log(`FAIL password generator menghasilkan password lemah: ${password}`);
    break;
  }
}
check('password generator selalu lolos kebijakan', generatedOk);

console.log(failures === 0 ? 'SEMUA LULUS' : `${failures} GAGAL`);
process.exit(failures === 0 ? 0 : 1);
