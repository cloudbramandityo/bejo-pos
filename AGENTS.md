# Aturan Proyek BEJO Digital Print

## Versi aplikasi (wajib)

Versi memakai format tampilan **major.minor** (contoh `v3.2`) dan disimpan di dua tempat yang dijaga tetap sinkron:

- `package.json` → semver penuh, contoh `3.2.0`
- `src/config/brand.ts` → `APP_VERSION`, contoh `3.2`

**Aturan default setiap update:**

1. Setiap update yang di-commit **wajib** menaikkan versi minor: `3.2` → `3.3`.
   - Jalankan: `npm run version:bump`
   - Jangan mengedit versi manual di `package.json` atau `brand.ts`.
2. Jika update bersifat besar — modul baru, perubahan arsitektur, atau fitur utama — **rekomendasikan** ke pengguna untuk naik versi major: `3.3` → `4.0`.
   - Jalankan: `npm run version:major`
   - Sampaikan rekomendasi tersebut sebelum/bersamaan dengan ringkasan perubahan.
3. Satu update = satu kenaikan versi. Jangan menaikkan versi berkali-kali untuk pekerjaan yang sama.
4. Cek versi berjalan kapan saja dengan `npm run version:show`.

`scripts/check-version.mjs` berjalan otomatis sebagai `prebuild`; build gagal jika versi di `package.json` dan `brand.ts` tidak sama.

Versi yang sedang berjalan ditampilkan di:

- Footer halaman login
- Menu pengguna (dropdown desktop dan drawer mobile) sebagai "Versi aplikasi vX.Y"
- `GET /api/health` pada field `version`

## Nama aplikasi

Nama resmi aplikasi adalah **BEJO Digital Print**. Nama lama (`Bejo Stiker`, `Stiker POS`) dilarang muncul di source, dokumen, maupun skrip. `scripts/check-brand.mjs` berjalan sebagai `prebuild` dan menggagalkan build jika nama lama masuk kembali.

## Deploy

Gunakan `deploy/deploy-vps.ps1` yang sudah ada. Jangan membuat skrip deploy baru. Build dan deploy hanya setelah `npm run build` lulus (termasuk check-brand dan check-version).
