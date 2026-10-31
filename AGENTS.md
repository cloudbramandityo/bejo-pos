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
- Urutan pemeriksaan password staf ada di `verifyStaffPassword` (`server/staffStore.ts`): **hash PocketBase-native dulu**, baru salinan plaintext warisan `appPassword`. Kalau dibalik, password baru yang diset Developer tidak pernah berlaku selama record masih menyimpan `appPassword` lama (gejala: reset seolah gagal). Login native yang berhasil langsung mengosongkan `appPassword` record itu (`clearLegacyAppPassword`); kegagalannya hanya dicatat di log dan tidak boleh membatalkan login. Akun yang tidak pernah login lagi (mis. nama developer) dikosongkan manual lewat Admin UI PocketBase. Uji regresi: kasus I di `scripts/check-staff-credential.mts` (`npm run check:users`).
- Jangan menaruh `return null` sebelum seluruh hook pada komponen modal yang selalu ter-mount (mis. `UserManagementModal`): urutan hook berubah saat modal pertama dibuka dan React melempar error #310 (layar blank). Uji buka-tutup modal setiap kali mengubah komponen tersebut.
- Akun DEVELOPER tidak punya baris direktori; perubahan profilnya ditolak server (`PROFILE_DEVELOPER_LOCKED`) dan diatur lewat `DEV_USERNAME` / `DEV_PASSWORD_HASH`.
- Aturan wajib ganti password **tidak pernah** berlaku untuk DEVELOPER. Kredensialnya berasal dari `DEV_PASSWORD_HASH`, bukan direktori staf, sehingga flag `mustChangePassword` selalu `false` di respons login/sesi dan modal terkunci tidak boleh muncul — termasuk bila localStorage menyimpan flag lama (`true`); merge sesi di `App.tsx` menimpanya dan modal memakai `forceChange = forced && !isDeveloper`. ID `user_dev`/`sys_core_developer` juga ditolak untuk buat/ubah/hapus akun (`ACCOUNT_RESERVED`).

## Wewenang ADMIN & OWNER atas data operasional (wajib)

Ada **dua** aturan di `src/utils/recordAccess.ts` dan keduanya dipakai layar — jangan menyatukannya:

- `canManageRecords(role)` → DEVELOPER atau ADMIN. Dipakai **tab SPK Cetak** saja (`SpkScreen`).
- `canManageBusinessData(role)` → DEVELOPER, ADMIN, **dan OWNER**. Dipakai lima tab yang diminta pemilik (2026-10-31): **Agen, Laporan, Invoice, Pajak, Marketing** — `AgentScreen`, `TransactionHistoryScreen`, `ReconciliationScreen`, `InvoiceScreen`, `TaxScreen`.

- Yang termasuk wewenang ADMIN: hapus order SPK (kartu Kanban, baris tabel, modal detail), purge arsip SPK Selesai, edit/hapus transaksi penjualan, edit/hapus mutasi stok, dan hapus dokumen PI/INV termasuk status Lunas.
- Wewenang OWNER sama persis **kecuali** tab SPK Cetak: OWNER tidak boleh hapus order/purge arsip SPK. Perluasan sengaja tidak dilakukan lewat `canManageRecords` supaya aturan SPK tidak ikut berubah.
- Yang **tetap** khusus DEVELOPER: antrean/status mesin cetak, status tim, kelola akun SPK, panel diagnostik backend, penyunting Website (`currentTab === 'landing_editor'`), pengaturan SI BEJO AI, dan **menyimpan** modul Jurnal (baca Jurnal punya aturannya sendiri di bawah).
- Gerbang ini ada di sisi UI; hak tulis data ke PocketBase tidak berubah. Bagian yang benar-benar ditegakkan server hanyalah manajemen akun (`requireManageRole`, DEVELOPER/ADMIN/OWNER), profil mandiri, dan rute Jurnal.
- Label tombol tidak boleh lagi berbunyi "Khusus DEVELOPER" (atau "Khusus DEVELOPER & ADMIN", "DEVELOPER MODULE", "Under Development by …") bila aksinya sudah dipakai bersama ADMIN/OWNER — tulisan yang menyesatkan membuat operator mengira akunnya rusak. Badge modal hapus transaksi kini "AKSES MANAJEMEN TOKO", modal edit mutasi stok "MANAJEMEN STOK", dan placeholder PPh Badan "DALAM PENGEMBANGAN".
- Jejak perubahan (audit trail) wajib memakai akun yang sedang login lewat `describeAuditActor(currentUser)` (`src/utils/auditActor.ts`) — `TaxFilingWizard` dan `TaxFilingHistoryView` menerima `actorLabel` dari `TaxScreen`, dan `App.tsx` meneruskan `currentUser`. Nama orang tetap ("Langgo Bramandityo (DEVELOPER)") membuat perubahan ADMIN/OWNER tercatat atas nama developer.
- Ubah wewenang cukup di satu fungsi `recordAccess.ts`; jangan menambah pemeriksaan `role === 'DEVELOPER'` baru di komponen.
- Uji regresi: `npm run check:access` (`scripts/check-business-access.mts`) — mengunci pemisahan dua aturan itu (OWNER **false** di SPK, **true** di lima tab), memanggil gerbang yang benar per layar, dan memindai label menyesatkan + nama author tetap di modul pajak.

## Hak akses modul Jurnal (wajib)

Aturan tunggal ada di `src/utils/journalAccessPolicy.ts` (`canReadJournal` = DEVELOPER/OWNER/ADMIN, `canWriteJournal` = DEVELOPER saja, `getJournalAccess` → `edit`/`view`/`none`) dan **diimpor oleh UI maupun server**. Jangan menulis ulang daftar role di salah satu sisi — dulu `server/journalApi.ts` punya daftarnya sendiri dan itu membuat layar kosong.

- Gejala yang diperbaiki (laporan 2026-10-30): ADMIN di perangkat lain membuka menu Jurnal, data Google Sheet kiriman developer tidak muncul, muncul tulisan "Sesi DEVELOPER tidak aktif. Klik Coba lagi untuk membuat sesi baru." Penyebabnya semua rute Jurnal menuntut cookie `bejo_jurnal_session`, yang hanya terbit saat login DEVELOPER; tombol "Coba lagi" cuma membaca info sesi (GET) sehingga tidak akan pernah berhasil untuk ADMIN.
- Rute baca (`GET /api/journal/config`, `GET /api/journal/sheets`) memakai `requireJournalReader(req, deps)`: boleh lewat cookie sesi Jurnal **atau** peran dashboard. Tanpa sesi dashboard = 401; peran di luar pembaca = 403.
- Rute tulis (`PUT` keduanya) tetap `requireDeveloper` — yang dinilai adalah cookie sesi Jurnal, bukan peran dashboard.
- `registerJournalRoutes(app, deps)` menerima `getDashboardRole` dari `server.ts` (`getPosSession(req)?.role ?? null`). **Jangan** mengimpor `server/posAuth.ts` dari `server/journalApi.ts`: `journalApi → posAuth → devAuth → journalApi` adalah siklus impor.
- `POST /api/journal/session` dengan `{ renew: true }` menerbitkan ulang cookie Jurnal untuk sesi dashboard DEVELOPER tanpa password (cookie Jurnal berumur 8 jam, sesi dashboard 12 jam — tanpa jalur ini developer kehilangan hak tulis di tengah jam kerja). Peran lain ditolak 403 dan `checkLoginRate` hanya dipakai login berkredensial, jadi tombol "Coba lagi" tidak menghabiskan kuota login developer.
- Sisi browser (`src/lib/journalApi.ts`): `ensureJournalSession()` tidak boleh melempar 401 untuk pembaca — `canRead` dari `GET /api/journal/session` sudah cukup. Pesan 401/403 di `describeJournalCloudError` (`src/lib/journalMirrorSync.ts`) **tidak boleh** menyebut "Sesi DEVELOPER"; ADMIN membacanya sebagai akunnya rusak, padahal tulisan itu berasal dari sesi dashboard yang belum aktif.
- Data Jurnal tidak punya langganan realtime: `jurnal_config` dan `jurnal_sheets` dikunci superuser (kelima API rule `null`, dipasang ulang saat boot) sehingga token sinkronisasi milik browser tidak bisa membacanya langsung. Jangan menambah jalur baca dari browser dan jangan berdalih "nanti ketarik saat tab dibuka" — nilainya hanya berubah lewat rute Express ini.
- Uji regresi: `npm run check:journal` (aturan per role, gerbang tiap rute, suntik `getDashboardRole`, jalur renewal + pesan 401 lewat `fetch` palsu).

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

## Periode riwayat agen & rekap PDF (wajib)

Lihat dan unduh memakai predikat periode yang sama; jangan menulis ulang perbandingan tanggal di komponen.

- Aturan tunggal ada di `src/utils/agentHistoryPeriod.ts` (`matchesRecapPeriod`, `buildRecapPeriodLabel`). Daftar Riwayat Pengambilan, pratinjau "Isi rekap", dan `exportStockTransactionsToPDF` semuanya memanggil `recapPeriodConfig` yang sama — kalau salah satu punya predikat sendiri, PDF tidak lagi sama dengan tabel.
- Perbandingan selalu lewat kunci hari `YYYY-MM-DD` hasil normalisasi. Transaksi Kasir POS tersimpan `DD/MM/YY`, mutasi stok `YYYY-MM-DD`; membandingkan string mentah atau `new Date(tx.date)` membuat baris lama hilang dari hasil (gejala: jumlah PDF < jumlah di layar).
- Rentang tanggal bersifat inklusif di kedua ujung dan input terbalik dinormalkan (`normalizeAgentDateRange`); baris tanpa tanggal yang terbaca **tidak boleh** ikut masuk periode.
- Mode `RENTANG` pada filter riwayat mengabaikan pilihan bulan (`historyMonthFilter`) dan berlaku untuk tampilan list maupun kartu Rekap Bahan; mode `BULAN` mengabaikan rentang. Tombol unduh PDF meniru periode aktif (`KUSTOM` saat rentang, `BULANAN` saat bulan terpilih).
- `periodType: 'KUSTOM'` wajib tetap ada di `PDFExportOptions` (`src/utils/pdfExport.ts`) dan label periode ditulis dari `buildRecapPeriodLabel`, bukan digabung manual.
- Tambah mode periode baru → perluas `RecapPeriodType` + kasus di `scripts/check-agent-period.mts` (`npm run check:agent-period`), jangan menambah cabang `if` di `AgentScreen.tsx`.
- Uji regresi: `npm run check:agent-period` (format lama, batas minggu Senin–Minggu, inklusivitas rentang, dan label periode).

## Rekonsiliasi laporan (wajib)

Sub-tab **Rekonsiliasi** di tab Laporan punya dua menu: **Analisis Varians** (Laporan A = rencana, Laporan B = capaian) dan **Analisis Komparatif** (Laporan A = periode acuan, Laporan B = periode pembanding). Baris **dan** kolom pembanding sama-sama dinamis: satu analisa bisa membandingkan lebih dari satu ukuran sekaligus (misalnya kuantitas diambil, frekuensi ambil, total nominal), tanpa batas jumlah baris maupun kolom.

- Aturan hitung tunggal ada di `src/utils/reconciliationMath.ts` (`analyzeReconciliation(kind, rows, columns)`). Tabel layar, riwayat, dan PDF sama-sama memanggil fungsi itu; kalau salah satu punya rumus sendiri, angka di layar tidak lagi sama dengan berkas PDF.
- **Tiap kolom dinilai terpisah.** Angka baris disimpan di `row.values` yang dikunci `id` kolom (baca lewat `getCellValues`), dan hasilnya keluar per kolom (`analysis.summaries`). Jangan menjumlahkan atau membandingkan angka antar kolom berbeda — kuantitas 120 dan nominal 6.000.000 bukan dua angka yang boleh dijumlah.
- Varians: selisih = **A − B**. Arah untung diambil dari `direction` kolom (`NAIK`/`TURUN`) bila kolomnya mengatur sendiri; bila `ROW`, ikut sifat baris (`PENDAPATAN` menguntungkan bila capaian di atas rencana, `BIAYA` menguntungkan bila capaian di bawah rencana) — jadi selisih positif pada baris pendapatan justru **tidak menguntungkan** dan warnanya mengikuti kesimpulan, bukan tanda angkanya.
- **Sifat baris ada tiga: `PERBANDINGAN` (bawaan), `PENDAPATAN`, `BIAYA`.** Baris Perbandingan murni membandingkan angka A dengan B (misalnya agen Tanon vs Ceweng, atau pengambilan lewat admin A vs admin B): verdictnya `NETRAL`, kesimpulannya dibaca dari tanda selisih lewat `verdictLabel(kind, verdict, difference)` ("Laporan B lebih besar" / "Laporan B lebih kecil" / "Sama besar"), dan **tidak ada** klaim untung/rugi serta tidak ada warna hijau/merah. Arah kolom (`NAIK`/`TURUN`) tidak boleh menilainya — kalau bisa, baris perbandingan akan disebut rugi padahal hanya berbeda ukuran.
- Bawaan baris baru = Perbandingan (`createReconciliationRow`, nilai sifat yang tidak dikenal dinormalkan ke sana oleh `normalizeRowNature` supaya data lama tidak dinilai tanpa dasar). Lima baris contoh punya nama yang sudah menyebut isinya, jadi sifatnya ikut nama (`DEFAULT_ROW_SEEDS`).
- Hitungan kesimpulan per kolom wajib lengkap: `goodCount + badCount + matchCount + neutralCount === countedRows`. Baris Perbandingan masuk `neutralCount` dan ditampilkan sebagai "Dibandingkan: n" lewat `summaryCountsText` (tabel layar dan PDF memakai fungsi yang sama).
- Komparatif: selisih = **B − A** (naik/turun/tetap); sifat baris dan `direction` kolom diabaikan karena yang dibaca pergerakan antar periode — termasuk baris Perbandingan, yang di sana tetap terbaca Naik/Turun/Tetap.
- Format angka hanya lewat `formatColumnValue` (`UANG` → rupiah, `JUMLAH` → angka biasa). Memakai `formatRupiah` langsung di komponen Rekonsiliasi membuat kuantitas terbaca "Rp 120". Selisih uang negatif ditulis **`-Rp 850.000`** (tanda di depan, bukan `Rp -850.000`); nilai yang membulat jadi nol tetap `Rp 0`.
- Persen selalu memakai Laporan A **pada kolom yang sama** sebagai penyebut. Laporan A nol → `percent: null` dan tampilannya **dikosongkan** (`formatPercentValue` memberi `-`); jangan mengarang 0% atau ∞.
- Baris tanpa nama, atau bernama tetapi semua kolomnya nol, tidak ikut dinilai (`countedRows`). Nilai uang dibulatkan dua desimal sebelum dijumlahkan. Menghapus kolom wajib ikut menghapus kunci nilainya di semua baris.
- Isian dan hasilnya disimpan bersama: koleksi PocketBase `reconciliation_runs` (`title`, `kind`, `labelA`, `labelB`, `columns`, `rows`, `analysis`, `notes`, `authorId`, `authorName`, `createdAt`, `updatedAt`) + cermin `bejo_pos_reconciliation_runs_v1` (200 analisa terakhir) di `src/utils/reconciliationStorage.ts`. `analysis` ikut disimpan (termasuk `columns` dan `summaries` saat itu) supaya riwayat yang dibuka kembali menampilkan hitungan pada saat itu, bukan hasil hitung ulang.
- Bentuk data lama (satu angka `valueA`/`valueB` per baris) dinormalkan menjadi satu kolom "Nominal"; `analysis` bentuk lama di-null-kan agar layar tidak mencampur dua bentuk. Jangan menambah field total sendiri di skema — jumlahnya ada di dalam `analysis`.
- Skema koleksi baru wajib masuk `scripts/create-pocketbase-collections.mjs`; daftar koleksi wajib di `scripts/diagnose-live.ps1` (variabel `required` di seksi F) dan `deploy/finish-deploy.ps1` ikut ditambah. Tanpa koleksi di server, tulis cloud gagal (`Missing or invalid collection context`) dan riwayat hanya tersimpan di perangkat.
- PDF mencetak **satu tabel per kolom** (`exportReconciliationToPDF`) plus ringkasan tiap kolom di akhir; jangan menggabungkan beberapa kolom ke satu tabel.
- Simpan/buka bisa untuk semua role yang membuka tab Laporan (DEVELOPER, OWNER, ADMIN). hapus riwayat tetap memakai `canManageRecords(role)` (`src/utils/recordAccess.ts`) — jangan menambah pemeriksaan role di komponen.
- Status server di layar wajib dari `getSyncStatus()`/`onSyncStatusChange()`; dilarang menulis "tersambung" atau jumlah record sebagai teks tetap.
- Uji regresi: `npm run check:reconciliation` (kolom dinilai terpisah, identitas jumlah per kolom, arah kolom melawan sifat baris, baris Perbandingan tidak dinilai untung/rugi, label dari tanda selisih, persen tanpa dasar, baris tidak terhitung, format uang vs jumlah, pembacaan riwayat bentuk lama).

## Koneksi server & sinkronisasi realtime (wajib)

Semua perangkat yang membuka aplikasi lewat internet harus berakhir di PocketBase, dan tiap perubahan muncul di perangkat lain tanpa refresh. Aturan tunggal sisi browser ada di `src/backend/pocketbaseBackend.ts` (klien `src/lib/pocketbase.ts`); jangan menambah jalur tulis/baca sendiri di layar.

- Kanal realtime **selalu** dibuat lewat `createSafeSubscription` → `subscribeCollection`/`subscribeRecord` dengan topik `'*'` (satu-satunya tempat langganan dipasang). Jangan membuat `pb.collection(x).subscribe(...)` di komponen: kanal seperti itu tidak ikut di-watchdog dan mati diam-diam saat jaringan tersendat.
- Kanal baru **wajib** dipasang di efek langganan `App.tsx` (deps `[]`) supaya hidup sepanjang sesi. Langganan yang menempel di satu layar (`ReconciliationScreen`, `TaxScreen`, `SpkScreen`, `InvoiceScreen`) hanya boleh jadi pelengkap — layar itu memang snapshot ulang saat dibuka, jadi jangan pernah berdalih "n juga ketarik ketika tab dibuka" untuk data yang harus dilihat pengguna lain segera.
- Langganan dipasang **setelah** token ada (`attempt()` menunggu `authReady` dan menolak saat `!hasDashboardSession || isCloudUnavailable`). Aturan akses koleksi berbunyi `@request.auth.id != ""`, jadi kanal yang dibuka tanpa sesi akan menolak dan layar terlihat kosong.
- Watchdog 15 detik (`tickRealtimeWatchdog`) yang menentukan `realtimeConnected`; saat pulih ia menarik snapshot semua kanal (`refetchAllChannels`) lalu mengosongkan outbox (`flushOutbox`), dan bila SSE mati > 30 detik kanal dibangun ulang (`reviveAllChannels`). Tambah koleksi → tambahkan langganannya di `App.tsx`, bukan di layar.
- **Token kedaluwarsa tidak boleh menghapus pekerjaan.** `isSessionRejected()` (401/403 atau pesan token kedaluwarsa) memicu `ensureCloudSession()` — satu kali minta token baru per 30 detik (`REAUTH_MIN_INTERVAL_MS`), digabung kalau banyak kanal gagal bersamaan. Setelah token baru, `performAuth` sudah menghidupkan semua kanal dan mengirim antrean.
- Tulis yang tetap gagal **masuk outbox** (`isRetryableWriteError` = jaringan, 401/403, 408/429, 5xx) dan dikirim ulang saat auth/pulih/`online`/tab kembali terlihat. Yang dibuang hanya penolakan payload (400/404) supaya antrean tidak macet. Jangan pernah memakai `console.error` sebagai akhir dari tulis cloud — data itu tidak akan pernah terlihat user lain.
- Snapshot dari server **menggantikan** isi perangkat, termasuk saat kosong: `subscribeInvoices`/`subscribeActivityLogs` di `App.tsx` tidak lagi menyaring `length > 0`. Menyaring ulang dengan alasan "nanti data lokal hilang" membuat hapus di perangkat A meninggalkan bayangan di perangkat B selamanya; yang belum terkirim sudah dilindungi outbox, bukan oleh penyaringan kosong.
- Kunci localStorage **tidak boleh** menulis balik ke server saat isinya baru saja datang dari server. Helper pajak (`src/utils/taxStorage.ts`) menulis cloud dan menaruh tanda `fromCloud`; pemanggil dari callback langganan wajib meneruskan `fromCloud = true`, kalau tidak tiap perangkat mengulang tulis yang sama dan gema itu tidak berhenti.
- Event `bejo_tax_monthly_billings_updated` didengar `TaxFilingHistoryView` supaya layar yang terbuka ikut berubah; isian yang belum disimpan (`hasUnsavedChanges`) tidak ditimpa.
- URL PocketBase yang dipakai browser adalah **domain publik** (`https://<domain>/api/pb`, lewat Caddy `handle_path` dengan `flush_interval -1` supaya SSE tidak ter-buffer). `deploy-vps.ps1` menolak `.env` bernilai localhost (baris ~1035) dan memverifikasi bundel hasil build (~1328) — jangan dilemahkan; bundel localhost = semua pengunjung jatuh ke Mode Lokal.
- Status koneksi yang tampil di layar hanya dari `getSyncStatus()`/`onSyncStatusChange()`. Label pemilik untuk badge DEVELOPER di `Navbar.tsx`: **"Hybrid Server"** (tersambung) dan **"Mode Lokal"** (tidak tersambung); tombol preset Rekonsiliasi bernama **"Rekonsiliasi Agen"**.

## Penyebaran logo & identitas toko (wajib)

Gejala yang diperbaiki (laporan 2026-10-31): logo yang disetel developer di Pengaturan toko tidak pernah muncul di perangkat lain — layar login dan dashboard tetap memakai emblem bawaan. Dua penyebab, keduanya soal **isi**, bukan jalur langganan: (1) sanitizer memotong `logoUrl` sebelum tulis ke server karena data URL PNG 400×400 jauh di atas 50.000 karakter (`canvas.toDataURL('image/png', …)` mengabaikan parameter kualitas), (2) koleksi `settings` hanya terbaca setelah login, sedangkan halaman login tampil sebelum ada sesi. Kanal realtime saat itu sudah sehat (`legacyId` + cermin `data` + snapshot awal), jadi **Jangan menambah langganan** untuk masalah ini.

- Aturan ukuran hanya ada di `src/utils/dbSanitize.ts`: `BINARY_MAX_CHARS` (50.000) untuk lampiran umum dan `LOGO_MAX_CHARS` (400.000) **khusus kunci `logoUrl`** (`LOGO_FIELDS`). Batas longgar boleh dipakai hanya oleh kunci yang disebut di `LOGO_FIELDS`; jangan menaikkan `BINARY_MAX_CHARS` supaya lampiran SPK tidak ikut bocor ke server.
- `sanitizeForDb` mewariskan nama kunci ke objek bersarang **dan** unsur di dalam array (`.map((item) => sanitizeForDb(item, key))`), jadi logo di dalam `storeProfiles[]` tetap lolos. Jangan memanggil ulang sanitizer tanpa argumen `key`.
- Unggahan logo selalu dikompres lewat `src/utils/storeLogoImage.ts` (tangga 256/192/128 px × kualitas 0.9→0.6, keluar saat hasil pertama ≤ `LOGO_TARGET_CHARS` = 200.000). Target wajib **di bawah** `LOGO_MAX_CHARS`. Jangan menulis `toDataURL('image/png')` untuk logo toko.
- Bila tangga terkecil masih di atas target, simpan **dibatalkan** dengan pesan "Logo terlalu besar untuk dikirim ke perangkat lain…" (`prepareLogoForSave` di `src/components/CustomerScreen.tsx`, dipakai unggahan, "Jadikan Bawaan", dan submit form). Menyimpan logo yang hanya terlihat di perangkat ini dilarang — inilah gejala awal bugnya.
- `GET /api/branding` (`server/brandingApi.ts`) adalah satu-satunya jalur baca identitas sebelum login: kredensial PocketBase tetap di server lewat `readSettingsPayload()` (diekspor dari `server/landingApi.ts` — **jangan** menyalakan koneksi/auth PB di modul baru), hanya mengirim `storeName` + `logoUrl`, dan field lain (alamat, telepon, catatan struk, `appPassword`) tidak pernah ikut.
- Rutenya **publik**: sengaja tidak masuk `PRIVATE_API_PREFIXES` (`server.ts`). Rute privat lain tidak boleh diturunkan jadi publik hanya supaya tampilannya muncul di layar login.
- Gagal baca = `200 { success: false }` (bukan 503) dengan penyebab asli di log `[Branding]`; `src/lib/branding.ts` menelan error dan layar login tetap memakai emblem bawaan. Jangan menahan atau membuat login gagal hanya karena branding tidak terambil.
- Cache: 30 detik di server + `Cache-Control: public, max-age=30`. Nilai gagal **tidak** di-cache (`cache` hanya hasil sukses), jadi perangkat langsung pulih begitu sambungan benar. Jangan menaikkan TTL — pemilik mengharapkan logo baru terlihat dalam hitungan detik setelah menyimpan Pengaturan toko.
- Record lama yang pernah dipotong masih berisi `logoUrl` kosong sampai form Pengaturan toko disimpan lagi; menyimpan ulang mengompres dari cermin perangkat (`bejo_pos_default_logo_v1`) tanpa wajib unggah ulang.
- Penjaga: `npm run check:branding` (`scripts/check-branding.mts`) — aturan ukuran per kunci, tangga pengekaman (tidak pernah mengembalikan hasil di atas target), rute publik + isi respons hanya dua nilai, pemasangan di `server.ts`, layar login memakai hasil server, dan tidak ada angka 50000 yang ditulis ulang di backend. Tambah kasus baru di sana, jangan hanya menguji manual.

## Bahasa deskripsi antarmuka (wajib)

Semua kalimat yang dibaca operator/pemilik toko harus bahasa Indonesia awam: **singkat, padat, jelas**. Contoh yang disahkan pemilik (panel Pergerakan Aset): bukan "Riwayat nilai tidak disimpan sebagai snapshot, jadi tiap titik dihitung mundur...", tetapi "Nilai barang dihitung berdasarkan harga modal saat ini, ditambah/dikurangi dengan penyesuaian uang yang tercatat saat kejadian (seperti perubahan harga kulak, koreksi stok manual, penjualan, atau produk baru)."

- Yang diubah **hanya teks tampilan**: node JSX, `title`/`placeholder`/`label`/`aria-label`/`hint`, dan pesan `alert`/`confirm`. Identifier, props, tipe, className, kunci localStorage, nama record, dan label menu/navigasi yang sudah dikenal operator tidak diubah.
- dilarang istilah programmer di teks pengguna: `browser` → "Chrome atau Edge di perangkat ini", `localStorage` → "tersimpan di perangkat ini", `PocketBase`/`cloud database`/`backend`/`API`/`endpoint` → "server", `sinkronisasi` → "terkirim ke server", `real-time` → "langsung", `field` → "kolom isian", `dummy` → "data contoh", `rekapitulasi` → "rekap", `HPP` → "harga kulak", `snapshot` → "catatan nilai per hari", `mutasi stok` → "stok masuk/keluar" (kata "Mutasi Stok" tetap hanya untuk nama fitur/tab-nya).
- Istilah domain toko (harga kulak, agen, SPK, stok, kasir, PI/INV) dan istilah akuntansi/pajak baku (PSAK, PTKP, PPh Final, Formulir 1770, BPE/NTTE, nama regulasi) **boleh** dipertahankan; hanya kalimat pengantarnya yang disederhanakan. Label yang harus dicocokkan dengan pihak luar (mis. "Set as default", "Anyone with the link") dibiarkan persis.
- Memendekkan kalimat tidak boleh membuang fakta: efek permanen ("dihapus permanen", "tidak bisa dikembalikan"), syarat perangkat/koneksi, dasar perhitungan angka, dan apa yang harus dilakukan pengguna berikutnya. Status, kecepatan, latency, atau lokasi folder tidak boleh dikarang — kalau tidak ada datanya, tulis "belum tersambung".
- Jangan menulis status, kecepatan, latency, atau kesiapan layanan sebagai teks tetap di komponen — nilainya wajib berasal dari hasil pengukuran. Kalau datanya tidak ada, tulis "belum tersambung" / "belum terukur". Kartu diagnostik tidak boleh memakai badge hijau statis.
- Panel diagnostik khusus DEVELOPER (`BackendDiagnosticsModal`, `backendDiagnostics`, log di `src/backend/`) boleh menyebut nama teknis karena dipakai untuk memperbaiki sistem, tetapi kalimatnya tetap pendek.
- Penjaga: `npm run check:copy` (memindai `src/`, melaporkan istilah teknis, kalimat > 130 karakter, dan klaim status tetap) dan `node scripts/check-ui-language.mjs --strict` yang berjalan sebagai `prebuild` — build gagal jika masih ada istilah teknis atau klaim status tetap di teks pengguna. Tambah istilah baru ke tabel `JARGON` dan pola baru ke `FAKE_STATUS` di `scripts/check-ui-language.mjs`; pengecualian hanya lewat `DEV_ONLY`, `CONTENT`, atau `OFFICIAL_NAMES` di berkas yang sama, disertai alasan.
- Gaya header judul layar diseragamkan: `text-xl font-black text-slate-900 tracking-tight` di keempat layar Laporan (Laporan Penjualan, Laporan Keuangan, Rekonsiliasi, Jurnal). Judul ditulis CAPS LOCK, kecuali Jurnal yang bentuk kombinasi **JURNAL - Google Sheet**. Sebutan modulnya cukup "Google Sheet" — kata "Mirror/Mirroring" hanya boleh muncul di identifier kode (`journalMirrorSync`, kunci localStorage), tidak di teks pengguna.
- Uji regresi: `npm run check:copy:strict` lulus, dan `npm run build` lulus karena penjaga itu ikut berjalan di `prebuild`.

## Deploy

Gunakan `deploy/deploy-vps.ps1` yang sudah ada. Jangan membuat skrip deploy baru. Build dan deploy hanya setelah `npm run build` lulus (termasuk check-brand, check-version, check-path-fabrication, check-ui-language --strict, dan check-powershell-syntax).

Berkas `.ps1` tidak ikut diperiksa `tsc` atau `vite build` — kesalahan sintaksisnya baru meledak di layar VPS setelah deploy (`ExpectedValueExpression`, "You must provide a value expression following the '-and' operator"). Karena itu `scripts/check-powershell-syntax.mjs` (`npm run check:ps1`, otomatis di `prebuild`) menyuruh PowerShell membaca tiap `.ps1` di `deploy/` dan `scripts/` dengan `Parser::ParseFile` tanpa menjalankannya; skrip yang tidak bisa dimuat menggagalkan build. Penjaga ini melewat dirinya di luar Windows. Kasus yang sudah ditemukan: `if ($a -and Test-Path $b)` tanpa kurung; `"$cat: $name"` yang dibaca PowerShell sebagai variabel bervalifikasi drive (tulis `"${cat}: $name"`); `[System.Security.Authentication.SslProtocol]` — nama enum .NET yang benar `SslProtocols` (jamak), versi salah membuat PowerShell melempar "Unable to find type" dan sertifikat HTTPS dilaporkan tidak terbaca; dan `& $exe 2>&1` yang mengubah stderr native menjadi ErrorRecord sehingga laporan build mencetak "System.Management.Automation.RemoteException" alih-alih pesan aslinya. `Invoke-NativeCapture` di `deploy-vps.ps1` menormalkan ErrorRecord ke teksnya lebih dulu — jangan dicetak mentah. Parser PowerShell **tidak** menangkap tiga kasus terakhir karena sintaksnya sah; kesalahan baru muncul saat skrip dijalankan.

Berkas yang dihapus dari repo tetap tertinggal di VPS karena penyalinan memakai robocopy tanpa purge (`-PurgeSource` hanya membersihkan `src/`). Penghapusan berkas lama dilakukan `Remove-ObsoleteWrappers` di `deploy-vps.ps1`: daftarnya **nama lengkap** (bukan pola wildcard, supaya penjaga baru di `scripts/` tidak ikut terhapus) dan jalan lewat `Get-ChildItem -Force` agar berkas hidden/system juga kena. Tambah berkas yang dihapus → taruh namanya di daftar itu, jangan menyuruh operator menghapus manual.

Penyalinan source memakai `robocopy /E` (tanpa purge), sehingga berkas versi lama yang sudah dihapus dari branch tetap tertinggal di `C:\bejo-pos`. Tambahkan `-PurgeSource` bila build di VPS gagal karena berkas yang tidak ada di `main` (gejala: penjaga teks atau tsc menyingkap nama berkas yang tidak muncul di repo); opsinya hanya mengosongkan `src/` lalu menulis ulang dari arsip — `.env`, `data/`, `logs/`, `backups/`, `dist/`, dan `node_modules/` tidak disentuh.

**Jangan pernah menjalankan `git pull` di `C:\bejo-pos`.** Deploy menyalin source di atas folder kerja tanpa commit, sehingga tree VPS selalu berbeda dari HEAD-nya: pull akan abort ("Your local changes ... would be overwritten by merge" / "untracked working tree files ... would be overwritten") dan kalau dipaksa ia menimpa `.env` serta merusak deploy. Cara menaikkan versi di VPS hanya `deploy-vps.ps1`. Jumlah "file belum di-commit" yang dilaporkan diagnostik di VPS adalah konsekuensi desain ini, bukan temuan.

## Diagnostik VPS (wajib)

`scripts/diagnose-live.ps1` adalah **satu-satunya** skrip pemeriksaan kondisi server: status provisioning (software, folder, service, firewall), isi `.env`, service & port, endpoint lokal/publik, sertifikat TLS, integritas akun sinkronisasi & direktori `app_users`, log & disk, Caddyfile/DNS/isi bundel browser, lalu ringkasan. Skrip lama `scripts/check-vps-status.ps1` dan `scripts/check-vps-simple.ps1` sudah dihapus dan isinya diserap ke sini — **jangan membuat skrip diagnostik baru**, cukup edit skrip ini (sama seperti kebijakan skrip deploy). Jalankan **di VPS** sebagai Administrator:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\scripts\diagnose-live.ps1
```

- Skrip hanya membaca: tidak menulis database, tidak merestart service, dan nilai rahasia hanya keluar sebagai status terisi/kosong + panjang. Hasilnya laporan `.txt` (transcript) + `.json` di `%TEMP%`; path dicetak di akhir.
- Kode keluar mengikuti gaya skrip deploy: `0` bersih, `1` ada FAIL, `2` lolos FAIL tetapi ada WARN saat `-RequireClean` dipakai (pakai `-RequireClean` sebagai gerbang setelah deploy).
- Opsi penyesuaian tersedia lewat param (`-AppDir -Domain -LocalPbUrl -LocalAppUrl -CaddyDir -PbDir -NssmDir -BackupRoot -ExpectedPbVersion -LogLines -ReportPath -SkipAccounts -SkipProvisioning -RequireClean`); tambah pemeriksaan baru sebagai seksi di skrip ini, bukan sebagai file lain.
- Jangan mendiagnosis live dari workstation: `.env` lokal bisa berbeda dari VPS. Menjalankannya di workstation tetap sah untuk menguji skrip, tetapi WARN/FAIL kondisi toko (service, folder, DNS, bundel) hanya bermakna kalau berasal dari VPS.
- Yang tidak boleh ditebak: keberadaan koleksi PocketBase (dibaca dari API), aturan firewall (dibaca dari filter port sungguhan), versi binary, dan status koneksi. Bila datanya tidak terukur — misalnya aturan firewall butuh Administrator — skrip wajib menulis "tidak terbaca / tidak disimpulkan", **bukan** `[OK]`. Kesimpulan "port aman" dari run non-Administrator adalah temuan palsu.
- Kesimpulan "port dibuka ke internet" hanya boleh dari aturan yang **empat syaratnya** terpenuhi sekaligus: protokol TCP/Any, port cocok (termasuk rentang), `RemoteAddress` internet (`Any`/`0.0.0.0/0`/`::/0`/`Internet`), profil berlaku publik — **dan** tidak dipatok program/service. Aturan bawaan Windows (AllJoyn Router UDP-In, Cortana, Desktop App Web Viewer, Remote Desktop Shadow) ber-`LocalPort *` dan `RemoteAddress Any` tetapi terikat satu aplikasi/service, jadi dulu dianggap pembuka port dan menghasilkan FAIL palsu "Port 3000 diizinkan masuk dari internet" di VPS. Penjaganya: `powershell -File scripts\diagnose-live.ps1 -SelfTest` (contoh aturannya diambil dari laporan VPS nyata, dijalankan tanpa menyentuh sistem sehingga bisa dipakai di workstation).
- Jebakan PowerShell 5.1 yang sudah dipelajari di skrip ini: `2>&1` pada perintah native mengubah stderr Node menjadi ErrorRecord (`PS>TerminatingError(...)`) di laporan — pakai `Start-Process -RedirectStandardOutput/-RedirectStandardError`; `-ErrorAction Stop` pada cmdlet tetap meninggalkan baris noise transcript — kumpulkan lewat `-ErrorVariable` lalu `2>$null`; `\"` di dalam string skrip menghasilkan filter WQL tidak valid (`Get-CimInstance : Invalid query`), bangun filter dengan `$"Name='$svcName'"`; `Win32_Service` tidak punya properti `ExitAction`, jadi aksi pemulihan dibaca dari registry `FailureActions`; dan `[System.Security.Authentication.SslProtocols]` bernama jamak.
- Tambah koleksi wajib aplikasi → perluas daftar `required` di seksi F; ganti versi PocketBase → `-ExpectedPbVersion`.
- Uji: `npm run check:ps1` (sintaks), `-SelfTest` (logika penilaian port, jalan di mana saja) **dan** jalankan skripnya sekali penuh — parser PowerShell tidak menangkap galat tipe atau cmdlet yang salah nama.
