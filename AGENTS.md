# Aturan Proyek BEJO Digital Print

## Versi aplikasi (wajib)

Versi memakai format **major.minor.patch** (contoh `v4.4.0`) dan disimpan di dua tempat yang dijaga tetap sinkron:

- `package.json` → versi penuh, contoh `4.4.0`
- `src/config/brand.ts` → `APP_VERSION`, contoh `4.4.0`

**Aturan default setiap update:**

1. Setiap update yang di-commit **wajib** menaikkan versi patch: `4.4.0` → `4.4.1`.
   - Jalankan: `npm run version:bump`
   - Jangan mengedit versi manual di `package.json` atau `brand.ts`.
2. Jika update menambah **fitur atau modul baru** (aplikasi tetap terasa seperti versi yang sama), naikkan versi minor: `4.4.1` → `4.5.0`.
   - Jalankan: `npm run version:minor`
   - Sampaikan perubahan versi ini pada ringkasan perubahan.
3. Jika **sistem menilai aplikasi sudah terlihat berbeda** dari versi sebelumnya — perubahan besar pada alur kerja, tampilan menyeluruh, atau arsitektur — **rekomendasikan** ke pengguna untuk naik versi major: `4.5.0` → `5.0.0`.
   - Jalankan: `npm run version:major` **hanya setelah rekomendasi disetujui**.
   - Rekomendasi disampaikan sebelum/bersamaan dengan ringkasan perubahan.
4. Satu update = satu kenaikan versi. Jangan menaikkan versi berkali-kali untuk pekerjaan yang sama.
5. Cek versi berjalan kapan saja dengan `npm run version:show`.

`scripts/check-version.mjs` berjalan otomatis sebagai `prebuild`; build gagal jika versi di `package.json` dan `brand.ts` tidak sama.

Versi yang sedang berjalan ditampilkan di:

- Footer halaman login
- Menu pengguna (dropdown desktop dan drawer mobile) sebagai "Versi aplikasi vX.Y.Z"
- `GET /api/health` pada field `version`

## Nama aplikasi

Nama resmi aplikasi adalah **BEJO Digital Print**. Nama lama (`Bejo Stiker`, `Stiker POS`) dilarang muncul di source, dokumen, maupun skrip. `scripts/check-brand.mjs` berjalan sebagai `prebuild` dan menggagalkan build jika nama lama masuk kembali.

## Password DEVELOPER (wajib)

Password DEVELOPER bersifat **stabil**: disetel sekali oleh pemilik dan tidak dirotasi setiap deploy.

- Set/ubah: `npm run dev-password:set` (input tersembunyi, minimal 10 karakter), atau di VPS lewat `deploy\deploy-vps.ps1 -SetDevPassword`.
- Verifikasi: `npm run dev-password:verify`.
- Hanya hash scrypt yang disimpan di `.env` (`DEV_PASSWORD_HASH`). Plaintext tidak boleh ditulis ke repo, file di server, atau chat.
- Deploy **tidak boleh** mengubah password DEVELOPER kecuali `-RotateDevPassword` diminta eksplisit (hanya untuk keadaan darurat).

## Lokasi folder berkas SPK (wajib)

Lokasi folder hanya boleh datang dari konfigurasi bersama, tidak pernah dikarang oleh kode.

- Sumber kebenaran lokasi folder bersama: record `settings/spk_lan_folder` di PocketBase (`src/utils/sharedFolderAccess.ts`).
- Berkas SPK dianggap "ada di folder bersama" hanya jika `copyFileToSharedFolder()` menulis dan verifikasi berhasil dari folder tersebut.
- Status izin ditulis apa adanya: folder belum dipilih, izin perlu dikonfirmasi, atau folder tersambung. Label seperti "LAN Aktif" / "ONLINE (8ms)" tanpa data nyata dilarang.
- Nilai bawaan seperti `D:/DATA_CETAK_BEJO/`, `\\192.168.1.100\DATA_CETAK\`, `HOTFOLDER_KONICA`, atau latency acak adalah fabrikasi dan menjadi penyebab salah file.
- Izin baca-tulis folder (File System Access API) melekat per browser/perangkat dan tidak dapat dikirim lewat cloud. Setiap perangkat menekan "Hubungkan Folder di Perangkat Ini" satu kali; lokasinya sendiri tetap sama untuk semua pengguna.
- Format path yang muncul di UI diambil dari `sharedFolderDisplayPath` (path konfigurasi atau nama folder hasil grant), bukan gabungan string yang terkesan meyakinkan.
- `scripts/check-path-fabrication.mjs` berjalan sebagai `prebuild`; build gagal jika lokasi folder toko muncul lagi sebagai konstanta di `src/`. Cek manual: `npm run check:paths`.

## Identitas akun staf di cloud (wajib)

Akun staf tidak boleh dikenali hanya dari id aplikasi.

- Restore backup dari perangkat lain membawa id lama (`user_1789...`), sedangkan orang yang sama di cloud bisa punya id PocketBase. Mencocokkan per id saja membuat akun ditolak (`USERNAME_TAKEN`) atau digandakan.
- `POST /api/users` mencocokkan berurutan: `legacyId` → username → email kredensial `<username>@staff.bejo.local` → email cadangan `<username>-<id>@staff.bejo.local`. Bila sudah ada, akun **diadopsi**: profil diperbarui, tetapi id cloud, status aktif, dan password yang berlaku dipertahankan.
- Password akun cloud yang sudah ada tidak pernah ditimpa data backup.
- Record kredensial tidak pernah dibuat tanpa pengecekan ketiga penanda di atas, dan record hasil email cadangan selalu membawa `legacyId` agar bisa ditemukan lagi.
- Penolakan PocketBase diteruskan beserta detail field (`details`) supaya penyebabnya tidak berhenti di "Failed to create record.".
- Hasil restore memisahkan `skippedRecords` (digabungkan) dari `failedRecords`, dan hanya menyarankan "Coba Lagi" bila `retryable` (jaringan/5xx).
- Uji regresi tanpa database: `npm run check:users` (PocketBase palsu di memori).

## Deploy

Gunakan `deploy/deploy-vps.ps1` yang sudah ada. Jangan membuat skrip deploy baru. Build dan deploy hanya setelah `npm run build` lulus (termasuk check-brand, check-version, dan check-path-fabrication).
