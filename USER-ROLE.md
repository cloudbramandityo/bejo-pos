# USER-ROLE — Daftar Wewenang Akun

Berkas ini adalah **daftar tunggal** siapa boleh membuka apa di BEJO Digital Print.
Isinya dibaca penjaga: `npm run check:access` membandingkan tiap baris di bawah
dengan kode yang benar-benar berjalan. Tabel dan kode berbeda = build gagal.

Kode keputusannya ada di `src/utils/recordAccess.ts` (wewenang data) dan
`src/utils/journalAccessPolicy.ts` (modul Jurnal). Tombol menu dibaca dari
`allowed()` di `src/components/Navbar.tsx`.

## Cara mengubah wewenang

1. Ubah fungsi di `src/utils/recordAccess.ts` — satu tempat, bukan di komponen.
2. Perbarui baris yang berubah di tabel berkas ini.
3. Jalankan `npm run check:access`, lalu `npm run build`.
4. Kalau yang berubah adalah tab kerja ADMIN/OWNER/SPK, ikuti aturan
   "Wewenang ADMIN & OWNER atas data operasional (wajib)" di `AGENTS.md`.

Menambah `role === 'DEVELOPER'` langsung di dalam komponen **dilarang** —
penjaga tidak akan melihatnya dan wewenang bisa berbeda antar layar.

## Role yang dikenal

Diambil dari `UserRole` di `src/types.ts`: **DEVELOPER, OWNER, ADMIN, AGEN, KASIR, SPK**.
Penjaga menolak tabel yang daftarnya tidak sama dengan daftar di `src/types.ts`.

## 1. Tab yang muncul di menu

`ya` = tab terlihat dan bisa dibuka. Kolom "Catatan" tidak ikut diperiksa.

<!-- ROLE-TABS-BEGIN -->
| Tab | Nama di layar | DEVELOPER | OWNER | ADMIN | AGEN | KASIR | SPK | Catatan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pos | POS Kasir | ya | ya | ya | tidak | ya | tidak | penjualan di kasir |
| shift | Shift Kasir | ya | ya | ya | tidak | ya | tidak | buka/tutup kas |
| inventory | Katalog | ya | ya | ya | tidak | tidak | ya | SPK hanya melihat |
| stock | Stok | ya | ya | ya | tidak | tidak | tidak | butuh toko tersambung |
| agen | Agen | ya | ya | ya | ya | tidak | tidak | |
| spk | SPK Cetak | ya | ya | ya | tidak | tidak | ya | |
| transactions | Laporan | ya | ya | ya | tidak | tidak | ya | SPK hanya menu Laporan Penjualan |
| invoices | Invoice | ya | ya | ya | tidak | tidak | tidak | dokumen PI/INV |
| tax | Pajak | ya | ya | ya | tidak | tidak | tidak | |
| marketing | Marketing | ya | ya | ya | tidak | tidak | tidak | |
| customers | Pengaturan | ya | ya | ya | tidak | tidak | tidak | termasuk Backup Data |
| landing_editor | Website | ya | tidak | tidak | tidak | tidak | tidak | khusus DEVELOPER |
<!-- ROLE-TABS-END -->

## 2. Wewenang per fungsi

Kolom "Fungsi" adalah nama fungsi yang dipanggil penjaga. Tipe `ya/tidak`
menilai hasil boolean; tipe `nilai` membandingkan teks yang dikembalikan
(`edit`, `view`, `none`).

<!-- ROLE-CAPABILITIES-BEGIN -->
| Wewenang | Fungsi | Tipe | DEVELOPER | OWNER | ADMIN | AGEN | KASIR | SPK |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ubah/hapus data di tab SPK Cetak | canManageRecords | ya/tidak | ya | tidak | ya | tidak | tidak | tidak |
| Pakai penuh tab Agen, Laporan, Invoice, Pajak, Marketing | canManageBusinessData | ya/tidak | ya | ya | ya | tidak | tidak | tidak |
| Buka tab Katalog | canViewCatalog | ya/tidak | ya | ya | ya | tidak | tidak | ya |
| Ubah isi Katalog (tambah, ubah, kelola kategori) | canEditCatalog | ya/tidak | ya | ya | ya | tidak | tidak | tidak |
| Buka tab Laporan | canViewSalesReport | ya/tidak | ya | ya | ya | tidak | tidak | ya |
| Lihat menu Laporan Keuangan & Rekonsiliasi | canViewAllReportMenus | ya/tidak | ya | ya | ya | tidak | tidak | tidak |
| Unduh dokumen blueprint | canDownloadBlueprint | ya/tidak | ya | tidak | tidak | tidak | tidak | tidak |
| Baca modul Jurnal | canReadJournal | ya/tidak | ya | ya | ya | tidak | tidak | tidak |
| Simpan modul Jurnal | canWriteJournal | ya/tidak | ya | tidak | tidak | tidak | tidak | tidak |
| Modes akses Jurnal | getJournalAccess | nilai | edit | view | view | none | none | none |
<!-- ROLE-CAPABILITIES-END -->

## 3. Wewenang di dalam layar

Aturan ini tidak muat dalam satu sel boolean, jadi dijaga per kasus oleh
penjaga yang sama (seksi C, D, dan G):

- **Katalog untuk SPK = hanya melihat.** `InventoryScreen` menyembunyikan
  "Kelola Kategori", "Input Produk Baru", dan tombol "Edit Produk", lalu
  mengunci tiga jalan masuk perubahan (`openAddModal`, `openEditModal`,
  `handleOpenCategoryModal`). Tulisan "Hanya melihat — ubah harga atau kategori
  memakai akun yang berhak." muncul di tempat tombol-tombol itu.
- **Hapus produk tetap hanya DEVELOPER**, walau ADMIN/OWNER boleh mengubah isi
  katalog.
- **Laporan untuk SPK = hanya menu Laporan Penjualan.** Laporan Keuangan,
  Rekonsiliasi, dan Jurnal tidak dipasang di daftar menu; sub-tab yang tidak
  diizinkan tidak pernah ter-render.
- **Seluruh format laporan terbuka untuk SPK**: Harian, Mingguan, Bulanan,
  Semua Waktu, plus pemilih tanggal/bulan/tahun. Yang digerbang wewenang hanya
  tulis (edit/hapus baris) dan tab "Laporan Agen".
- **Jejak perubahan pajak** memakai akun yang sedang login, bukan nama tetap.

## 4. Yang ditegakkan server

Gerbang di atas ada di sisi tampilan. Yang benar-benar diperiksa server:
manajemen akun (`requireManageRole`: DEVELOPER/ADMIN/OWNER), profil mandiri,
rute Jurnal (baca: DEVELOPER/OWNER/ADMIN; tulis: DEVELOPER), dan unduhan
blueprint (`server/blueprintApi.ts`: 401 tanpa sesi, 403 untuk peran lain).
Hak tulis data operasional ke PocketBase belum ditegakkan server — jangan
menyebut daftar ini sebagai pengamanan.
