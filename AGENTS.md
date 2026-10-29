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

## Kebijakan kredensial akun staf (wajib)

Aturan tunggal ada di `src/utils/credentialPolicy.ts` dan dipakai UI **dan** server.

- Password: minimal 10 karakter, memuat huruf dan angka, bukan password default/publik (`admin123`, `agen123`, `kasir123`, dst.), dan tidak sama/diawali username. Aturan berlaku di semua mode situs, bukan hanya `PUBLIC_SITE`.
- Validasi di UI hanya umpan balik cepat; `POST /api/users` tetap menegakkan aturan yang sama. Jangan melemahkan pengecekan server.
- Username developer (`DEV_USERNAME`, bawaan `langgo`) tidak boleh dibuat sebagai akun staf karena login selalu memeriksanya lebih dulu.
- Jangan mengisi form akun dengan password default publik; tombol preset memakai `generateStrongPassword()`.
- Tambahkan kasus baru ke `scripts/check-credential-policy.mts` (dijalankan lewat `npm run check:users`).

## Profil mandiri & password sementara (wajib)

Setiap staf mengatur sendiri nama tampilan, foto profil, username login, dan password lewat menu **Profil Saya**.

- Endpoint `POST /api/users/me` (sesi server wajib) hanya mengubah baris direktori milik pemanggil. Mengganti username/password **wajib** menyertakan password saat ini; nama tampilan & foto boleh berubah tanpa password.
- Nama tampilan boleh berbeda dari username login; keduanya milik akun yang sama.
- Setelah username/password berubah, `issueStaffSession` (dari `server/posAuth.ts`) menerbitkan ulang cookie sesi supaya user tidak perlu logout.
- `avatarUrl` (data URL JPEG hasil kompresi di browser, maksimum `MAX_AVATAR_DATA_URL_LENGTH`) dan `mustChangePassword` **hanya disimpan di salinan `data` koleksi `app_users`** — jangan menambah kolom skema tanpa memperbarui `scripts/create-pocketbase-collections.mjs` dan verifikasi deploy. Field JSON `data` berukuran 5 MB, tetapi batas avatar tetap dijaga kecil agar muatan realtime ringan.
- Password sementara dari Developer: `checkTemporaryPassword` (minimal 6 karakter) hanya berlaku saat password **ditulis** bersama `mustChangePassword=true`. Login dengan password publik yang sementara diizinkan di mode publik, tetapi aplikasi langsung menampilkan modal profil terkunci (`forced`) sampai user membuat password sendiri.
- Password baru buatan user selalu divalidasi kebijakan kuat; menyimpan password baru otomatis menghapus flag `mustChangePassword`.
- Developer mereset password lewat Hak Akses & Akun (tombol kunci per baris / centang "password sementara"). Reset tersedia di tabel **Hak Akses & Akun** (tab Pengaturan) dan di modal **Kelola Wewenang Pengguna**; keduanya selalu menghasilkan password sementara yang wajib diganti.
- Jangan menaruh `return null` sebelum seluruh hook pada komponen modal yang selalu ter-mount (mis. `UserManagementModal`): urutan hook berubah saat modal pertama dibuka dan React melempar error #310 (layar blank). Uji buka-tutup modal setiap kali mengubah komponen tersebut.
- Akun DEVELOPER tidak punya baris direktori; perubahan profilnya ditolak server (`PROFILE_DEVELOPER_LOCKED`) dan diatur lewat `DEV_USERNAME` / `DEV_PASSWORD_HASH`.
- Aturan wajib ganti password **tidak pernah** berlaku untuk DEVELOPER. Kredensialnya berasal dari `DEV_PASSWORD_HASH`, bukan direktori staf, sehingga flag `mustChangePassword` selalu `false` di respons login/sesi dan modal terkunci tidak boleh muncul — termasuk bila localStorage menyimpan flag lama (`true`); merge sesi di `App.tsx` menimpanya dan modal memakai `forceChange = forced && !isDeveloper`. ID `user_dev`/`sys_core_developer` juga ditolak untuk buat/ubah/hapus akun (`ACCOUNT_RESERVED`).

## Wewenang ADMIN atas data operasional (wajib)

ADMIN = akses operasional penuh terhadap **data** di tab SPK Cetak, Laporan, dan Invoice. Aturan tunggal ada di `src/utils/recordAccess.ts` (`canManageRecords(role)` → DEVELOPER atau ADMIN) dan dipakai `SpkScreen`, `TransactionHistoryScreen`, `InvoiceScreen`.

- Yang termasuk wewenang ADMIN: hapus order SPK (kartu Kanban, baris tabel, modal detail), purge arsip SPK Selesai, edit/hapus transaksi penjualan, edit/hapus mutasi stok, dan hapus dokumen PI/INV termasuk status Lunas.
- Yang **tetap** khusus DEVELOPER: antrean/status mesin cetak, status tim, kelola akun SPK, panel diagnostik backend, dan **modul Jurnal** — server menolak selain sesi DEVELOPER (`requireDeveloper` di `server/journalApi.ts`), jadi jangan membuka tombol edit Jurnal di UI karena akan selalu gagal HTTP 401.
- Gerbang ini ada di sisi UI; hak tulis data ke PocketBase tidak berubah. Bagian yang benar-benar ditegakkan server hanyalah manajemen akun (`requireManageRole`, DEVELOPER/ADMIN/OWNER) dan profil mandiri.
- Label tombol tidak boleh lagi berbunyi "Khusus DEVELOPER" bila aksinya sudah dipakai bersama ADMIN — tulisan yang menyesatkan membuat operator mengira akunnya rusak.
- Ubah wewenang cukup di `canManageRecords`; jangan menambah pemeriksaan `role === 'DEVELOPER'` baru di komponen.

## Akun sinkronisasi PocketBase (wajib)

`PB_SYNC_EMAIL` / `PB_SYNC_PASSWORD` di `.env` adalah **sumber kebenaran** kredensial akun sinkronisasi yang dipakai broker `/api/pocketbase/session`. Record `users` miliknya dikelola server, bukan staf.

- Akun sinkronisasi **tidak boleh punya baris `app_users`**. Baris seperti itu tampil di Hak Akses dan pernah membuat restore backup menulis ulang email/password akun tersebut, sehingga broker 503 dan aplikasi jatuh ke Mode Lokal.
- `ensureStaffDirectory` menghapus baris direktori yang `authId`-nya record sinkronisasi; `loadStaffAccounts` menyembunyikan akun ber-email sinkronisasi; `saveCredential` dan `deleteAccount` menolaknya (`ACCOUNT_RESERVED`); username `sync` ditolak (`USERNAME_RESERVED`); restore backup menghitung kedua kode itu sebagai dilewati.
- `ensureSyncAccount` (`server/staffStore.ts`) menyamakan record dengan `.env` saat boot dan sekali lagi ketika login sinkronisasi ditolak; **jangan** menghapus panggilan ini. Tanpa `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD` yang valid perbaikan dilewati (tidak menebak).
- Bila live terlanjur Mode Lokal, jalankan di VPS: `powershell -ExecutionPolicy Bypass -File C:\bejo-pos\scripts\repair-sync-account.ps1` (periksa) lalu tambahkan `-Apply` (menulis) atau `-Apply -RestartService`. Skrip tidak pernah merotasi password superuser.
- Skrip PowerShell yang memanggil Node: PowerShell 5.1 **membuang argumen string kosong**, jadi URL PocketBase harus menjadi argumen terakhir dan skrip Node wajib menolak URL yang tidak diawali `http://`/`https://`. Tanpa itu URL bisa menerima nilai seperti `check` dan semua login gagal dengan pesan SDK "Something went wrong." yang menyesatkan.
- Probe broker di deploy berjalan tanpa cookie sesi staf; HTTP 401 adalah jawaban yang benar. Kredensial sinkronisasi yang ditolak menghasilkan HTTP 503.
- Uji regresi penjaga: `npm run check:users` (kasus G/H di `scripts/check-staff-credential.mts`).

## Penyesuaian aset toko (wajib)

Nilai "Total Aset Toko" dibangun dari **dua ledger**, tidak boleh salah satu dihapus:

- `stock_transactions` — mutasi stok (Pembelian masuk, Pengambilan agen keluar). Nilainya dihitung dari selisih satuan utama × HPP produk saat ini.
- `asset_adjustments` — kejadian yang mengubah nilai aset **langsung dalam rupiah** saat kejadiannya terjadi.

Setiap jalur tulis yang mengubah stok atau harga kulak produk terhitung aset di luar mutasi stok **wajib** mencatat penyesuaian lewat `src/utils/assetAdjustments.ts` lalu `recordAssetAdjustments()` di `App.tsx`:

- Edit produk (Inventory / modal tambah-ubah produk) → `adjustmentsFromProductEdit()`; menghasilkan `PRODUK_BARU`, `PRODUK_HAPUS`, `PERHITUNGAN_ASET` (saat centang "Masuk Aset Toko" atau kategori paket berubah), `HARGA_KULAK`, `KOREKSI_STOK`.
- Penjualan kasir yang mengurangi stok bahan (tidak menulis mutasi) → `adjustmentsFromStockDiff(..., 'PENJUALAN_POS', ...)`.
- `handleUpdateBatchProductStockAndCost()` (dipakai StockScreen & AgentScreen) → **hanya** `adjustmentsFromCostEdit()`. Selisih stoknya sudah tercatat di `stock_transactions` pada layar yang sama; memakai `adjustmentsFromProductEdit()` di sini membuat nilai aset terhitung dua kali.
- Pulihkan backup → `aggregateAdjustment()` dengan `kind: 'PULIHKAN_BACKUP'`, `source: 'RESTORE'`.

Aturan turun-temurun:

- Dekomposisi wajib persis: efek harga pada stok lama `(hargaBaru − hargaLama) × stokLama`, efek stok pada harga baru `hargaBaru × (stokBaru − stokLama)`. Jumlah kedua baris harus sama dengan selisih nilai aset — itu yang diuji.
- Baris dengan `valueDelta` nol tidak boleh ditulis.
- Produk tidak terhitung aset (`isPaketProduct`, Digital Printing tanpa `isAssetToko`) tidak menghasilkan baris.
- Jangan pernah menaksir lokasi, nilai, atau tanggal penyesuaian dari kode; nilai diambil dari kondisi produk sebelum/sesudah edit.
- Tambah jenis baru di `AssetAdjustmentKind` → perbarui `select` `kind` di `scripts/create-pocketbase-collections.mjs` dan verifikasi koleksi saat deploy, kalau tidak tulis cloud gagal.
- Cermin localStorage `bejo_pos_asset_adjustments_v1` dibatasi 4000 baris terakhir; ia hanya cadangan Mode Lokal, sumber tetap koleksi PocketBase `asset_adjustments` dengan langganan realtime.
- Panel "Pergerakan Aset" harus menulis dasar perhitungannya apa adanya (rekonstruksi mundur, tanggal awal penelusuran, baris item yang produknya sudah dihapus dilaporkan sebagai tidak dinilai — bukan diam-diam diabaikan).
- Uji regresi: `npm run check:trend` (kasus 9–17 di `scripts/check-asset-trend.mts`).

## Deploy

Gunakan `deploy/deploy-vps.ps1` yang sudah ada. Jangan membuat skrip deploy baru. Build dan deploy hanya setelah `npm run build` lulus (termasuk check-brand, check-version, dan check-path-fabrication).

Untuk memeriksa kondisi aplikasi live (koneksi PocketBase, akun sinkronisasi, `app_users`, log, disk), jalankan skrip read-only yang sudah ada **di VPS**:

```powershell
powershell -ExecutionPolicy Bypass -File C:\bejo-pos\scripts\diagnose-live.ps1
```

Skrip hanya membaca (tidak menulis database), menyembunyikan nilai rahasia, dan menghasilkan laporan `.txt` + `.json` di `%TEMP%`. Jangan mendiagnosis live dari workstation: `.env` lokal bisa berbeda dari VPS.
