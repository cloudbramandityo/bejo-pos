# PANDUAN MIGRASI KEMBALI KE AI STUDIO
## BEJO Digital Print — Redesain Landing Page + Tab Laporan

Dokumen ini menjelaskan cara memindahkan kembali (migrasi) seluruh pekerjaan yang sudah dilakukan di lingkungan lokal (`D:\DOCUMENTS\Default Project`) ke **Google AI Studio**, baik untuk melanjutkan pengembangan di sana maupun menyinkronkan dua arah.

> **Ringkasan cepat:** AI Studio hanya mengenal file yang ada di dalam project applet-nya. Jadi migrasi = **menyalin isi file yang berubah** (dan membuat file baru) ke AI Studio, lalu memverifikasi dengan `tsc --noEmit` + menjalankan preview.

---

## 0. Cara Pakai Dokumen Ini

Pilih salah satu dari 3 skenario berikut sesuai kebutuhan Anda:

| Skenario | Kapan dipakai | Bagian yang dibaca |
|---|---|---|
| **A. Sinkronisasi penuh** | AI Studio sudah punya versi lama app ini, dan Anda ingin menyamakan dengan versi lokal terkini | Bagian 1 → 2 → 3 → 4 → 6 |
| **B. Mulai dari nol** | Project AI Studio baru / rusak / ingin dibangun ulang | Bagian 1 → 2 → 3 → 4 → 5 → 6 |
| **C. Perubahan kecil saja** | Hanya ingin memindahkan revisi terakhir (slider gambar saja) | Bagian 5 (patch mini) saja |

---

## 1. Peta Perubahan — File Apa Saja yang Harus Dibawa

### 1.1 File BARU (belum ada di AI Studio versi lama)

| Path | Baris | Peran |
|---|---:|---|
| `src/components/landing/LandingPage.tsx` | 1796 | Landing page publik multi-halaman (Beranda, Tentang, Produk, Klien, Kontak) + hero slider + lightbox |
| `src/components/reports/LaporanScreen.tsx` | 123 | Wrapper tab "Laporan" dengan 2 sub-tab |
| `src/components/reports/LaporanKeuanganScreen.tsx` | 789 | UI Laporan Keuangan (PSAK No.1/2015), 7 sub-laporan |
| `src/utils/financialStorage.ts` | ~90 | Penyimpanan input manual laporan keuangan (localStorage) |
| `src/utils/landingPageStorage.ts` | 474 | **Sudah ada**, tapi isinya diganti total: default + migrasi config landing |

### 1.2 File DIMODIFIKASI

| Path | Perubahan | Cara pindah |
|---|---|---|
| `src/types.ts` | +9 interface landing baru (baris ~637–790) | Salin blok tipe (Bagian 3.1) |
| `src/App.tsx` | Import `LandingPage`, `LaporanScreen`, `financialStorage`; state `financialSettings`, `isViewingPublicLanding`; 3 blok render | Salin patch (Bagian 3.3) |
| `src/components/Navbar.tsx` | Label tab `transactions` → "Laporan" | Salin patch (Bagian 3.4) |
| `src/components/LandingPageEditorScreen.tsx` | Editor CMS gaya WordPress + 11 seksi + `ImageUploadField` + `LivePreview` baru | **Ganti seluruh file** |
| `PROMPT_AI_STUDIO.md` | Dokumentasi prompt | Salin apa adanya |

### 1.3 File TIDAK BOLEH DIUBAH (jangan disentuh saat migrasi)

- Key tab `'transactions'` dan union type tab di `App.tsx` & `Navbar.tsx`
- Isi `TransactionHistoryScreen.tsx` (hanya dipindah sebagai sub-tab)
- `PosScreen`, `InventoryScreen`, `InvoiceScreen`, `SpkScreen`, semua `tax/*`, `agents`, `modals/*`, dll.
- `.env` — **jangan** unggah ke AI Studio. Isi API key lewat panel Secrets AI Studio.

### 1.4 Ukuran file (untuk memilih cara transfer)

| File | Ukuran | Saran cara pindah |
|---|---:|---|
| `LandingPageEditorScreen.tsx` | ~110 KB | **Zip batch** (Bagian 2.2) |
| `LandingPage.tsx` | 87 KB | **Zip batch** |
| `LaporanKeuanganScreen.tsx` | 38 KB | Tempel / zip batch |
| `landingPageStorage.ts` | 21,5 KB | Tempel / zip batch |
| `types.ts` | ~30 KB | Salin hanya blok tipe (jangan ganti seluruh file) |
| `financialStorage.ts`, `LaporanScreen.tsx` | < 5 KB | Tempel langsung |

---

## 2. Strategi Transfer File — Pilih Salah Satu

### 2.1 Cara A — Tempel langsung (paling sederhana, file kecil)

1. Buka AI Studio → project applet → panel **Code** (atau editor file).
2. Untuk setiap file di tabel 1.1/1.2, buka file tujuan.
3. **Ctrl+A → Delete → Ctrl+V** isi file lokal (kecuali `types.ts` & `App.tsx` yang memakai patch).
4. Simpan.

> Cocok untuk `financialStorage.ts`, `LaporanScreen.tsx`, `types.ts`, `App.tsx`, `Navbar.tsx`.
> Untuk file besar ada risiko browser berat — pakai cara B.

### 2.2 Cara B — Zip batch (disarankan untuk file besar)

Di PowerShell lokal:

```powershell
cd 'D:\DOCUMENTS\Default Project'
$files = @(
  'src\components\landing\LandingPage.tsx',
  'src\components\reports\LaporanScreen.tsx',
  'src\components\reports\LaporanKeuanganScreen.tsx',
  'src\components\LandingPageEditorScreen.tsx',
  'src\utils\financialStorage.ts',
  'src\utils\landingPageStorage.ts'
)
$tmp = "$env:TEMP\bejo-migrasi"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
foreach ($f in $files) {
  $dest = Join-Path $tmp ($f -replace '\\','__')
  Copy-Item $f $dest
}
Compress-Archive -Path "$tmp\*" -DestinationPath "$env:TEMP\bejo-migrasi.zip" -Force
"Zip siap: $env:TEMP\bejo-migrasi.zip"
```

Di AI Studio: unggah/paste zip, buka file satu per satu (nama memakai `__` sebagai pemisah folder), lalu salin isinya ke file tujuan.

### 2.3 Cara C — Lewat Git (paling aman & bisa diulang)

Repo lokal sudah di-`git init` dengan commit awal `9cbf35e`. Untuk migrasi berulang:

```powershell
cd 'D:\DOCUMENTS\Default Project'
$git = 'C:\Program Files\Git\cmd\git.exe'
& $git status --short          # lihat file berubah
& $git diff --stat HEAD        # ringkasan perubahan
& $git diff HEAD -- src/types.ts src/App.tsx src/components/Navbar.tsx > "$env:TEMP\patch-inti.diff"
& $git archive -o "$env:TEMP\bejo-src.zip" HEAD src
```

`patch-inti.diff` berisi perubahan presisi untuk 3 file inti (langsung bisa dibaca AI Studio), sedangkan `bejo-src.zip` berisi seluruh folder `src` untuk unggah massal.

> AI Studio tidak menerima `.diff` sebagai patch otomatis, jadi isi diff lebih baik **dibaca lalu diterapkan manual** oleh agent di AI Studio.

---

## 3. Template Prompt untuk AI Studio

Tempelkan teks di bawah (dari `MULAI PROMPT` sampai `SELESAI PROMPT`) ke AI Studio, **lalu lampirkan/paste isi file** sesuai instruksi di Bagian 4.

```
## MULAI PROMPT

### Konteks
Repo: aplikasi React 19 + Vite + TypeScript "BEJO Digital Print" (AI Studio applet).
Ada 2 pekerjaan besar yang harus diterapkan ulang, dan sudah selesai di lingkungan lokal:
- BAGIAN A — Tab "Laporan" (key tetap 'transactions') berisi 2 sub-tab: Laporan Penjualan (isi tab lama apa adanya) + Laporan Keuangan (baru, PSAK No.1/2015).
- BAGIAN B — Landing Page publik: dari 1 halaman dengan anchor-scroll menjadi SITUS MULTI-HALAMAN (Beranda, Tentang Kami, Produk & Layanan, Klien, Kontak) meniru struktur subur.co.id, plus editor CMS gaya WordPress, hero image slider, dan lightbox foto produk.

ATURAN WAJIB:
1. JANGAN mengubah key tab 'transactions' maupun union type tab di App.tsx/Navbar.tsx.
2. JANGAN mengubah isi TransactionHistoryScreen, PosScreen, InventoryScreen, tax/*, invoices, spk, modals/*.
3. Semua tetap berjalan LOKAL (localStorage), tanpa backend baru.
4. Ikuti pola UI aplikasi yang sudah ada (kartu `bg-white rounded-2xl border border-slate-200`, ikon lucide-react, format uang dari `formatRupiah`).

### Pola UI WAJIB
- Container halaman: `w-full max-w-[1440px] mx-auto p-3 sm:p-5 space-y-4`
- Kartu: `bg-white rounded-2xl border border-slate-200 shadow-xs`
- Kartu header: ikon kotak berwarna (w-12 h-12 rounded-xl) + `<h1>` `text-xl font-black tracking-tight` + deskripsi `text-xs text-slate-500` + badge status
- Tab pil: `flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit flex-wrap gap-1`; aktif `bg-slate-900 text-white shadow-xs`
- Tombol utama: `bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md`
- Cetak: kontrol `no-print`; wadah `print:border-0 print:rounded-none print:shadow-none`

### BAGIAN A — TAB LAPORAN
A1. Buat `src/utils/financialStorage.ts` (interface FinancialSettings + DEFAULT_FINANCIAL_SETTINGS + get/save, key localStorage `bejo_laporan_keuangan_settings_v1`).
A2. Buat `src/components/reports/LaporanScreen.tsx` — wrapper dengan state `activeSubTab: 'penjualan' | 'keuangan'` (default 'penjualan'), header "Pusat Laporan", sub-tab `Receipt` (Laporan Penjualan) & `Landmark` (Laporan Keuangan), meneruskan SEMUA props lama apa adanya ke TransactionHistoryScreen.
A3. Buat `src/components/reports/LaporanKeuanganScreen.tsx` — 7 sub-laporan: Laba Rugi, Perubahan Modal, Neraca, Arus Kas, Neraca Saldo, Input Data, Panduan. AUTO-SAVE (`useEffect` → `onSaveSettings(draft)`), perhitungan sistem AKRUAL dari data transaksi/stok/shift, 4 kartu KPI, KopLaporan untuk cetak, rumus HPP = persediaan awal + pembelian − persediaan akhir.
A4. `src/App.tsx`: tambah import + state `financialSettings` + handler `handleSaveFinancialSettings`, lalu render `<LaporanScreen .../>` pada `currentTab === 'transactions'`.
A5. `src/components/Navbar.tsx`: label tab `transactions` → "Laporan" (ikon `Receipt` tetap).

### BAGIAN B — LANDING PAGE PUBLIK MULTI-HALAMAN
B1. `src/types.ts` — TAMBAHKAN (jangan hapus yang lama) interface: LandingBrandItem (+imageUrl), LandingProductItem (+imageUrl), LandingSlide, LandingAboutStat, LandingAboutConfig, LandingTestimonial, LandingClientLogo, LandingGalleryItem, LandingOffice, LandingSocialLink; dan perluas `LandingPageConfig` dengan field: slides, about, gallery, testimonials, clients, offices, socials.
B2. `src/utils/landingPageStorage.ts` — default config baru (3 slide, about + 4 stat, 4 galeri, 3 testimoni, 6 klien, 1 kantor, 3 sosial) DAN fungsi migrasi backward-compatible yang menggabungkan default untuk field yang belum ada di localStorage (key `bejo_pos_landing_page_config_v1`).
B3. Buat `src/components/landing/LandingPage.tsx` — situs publik multi-halaman dengan internal state `page: 'home' | 'about' | 'products' | 'clients' | 'contact'`:
    - Komponen: HeroSlider (autoplay 5,5 detik, jeda saat hover, panah, dots), SectionHeading, SmartImage, TestimonialSlider, TestimonialCard, ProductCard, BrandCard, SolutionsAccordion, PageHero, Lightbox.
    - Hero slider HANYA menampilkan GAMBAR (tanpa judul, tombol CTA, atau deskripsi di atas banner).
    - Lightbox: menampilkan gabungan foto produk + galeri sebagai satu set navigasi (panah, dots, keyboard Esc/←/→, strip thumbnail, counter "n / total").
    - PENTING: pasang listener klik NATIVE (addEventListener) pada komponen SmartImage, karena delegasi event React pada elemen <img> tidak reliable → lightbox jadi tidak terbuka.
B4. `src/App.tsx`: render `<LandingPage/>` saat belum login dan config published, dan saat `isViewingPublicLanding` bernilai true (tombol "Lihat Halaman Publik" dari editor).
B5. `src/components/LandingPageEditorScreen.tsx` — editor CMS gaya WordPress dengan 3 kolom (sidebar 11 seksi, kanvas, Pratinjau Langsung), accordion list editor, tombol Simpan/Batal + badge perubahan, switch Publish/On-Hold, dan komponen `ImageUploadField` (kompresi canvas → base64 JPEG, rekomendasi ukuran tampil di UI).
    Ukuran rekomendasi gambar: banner slide 1600×700, merk 800×600, produk 800×800 (1:1), tentang 900×700, galeri 800×600, logo testimoni 200×200, logo klien 300×300.
    Field editor slide: HANYA "Foto Banner" + "Nama Slide" (penanda editor, tidak tampil di publik).

### YANG TIDAK BOLEH DIUBAH
- Key tab 'transactions' dan union type tab
- Isi TransactionHistoryScreen (hanya dipindah sebagai sub-tab)
- Komponen lain (PosScreen, InventoryScreen, tax, invoices, spk, dll)

### VERIFIKASI WAJIB SETELAH EKSEKUSI
1. `npx tsc --noEmit` → exit 0 tanpa error
2. `npm run dev` → http://localhost:3000 → login → klik tab "Laporan"
3. Sub-tab Laporan Penjualan tampil persis seperti sebelumnya
4. Sub-tab Laporan Keuangan menampilkan kartu header, 4 KPI, 7 tab pil, dan konten laporan
5. Tab Input Data: isi kolom → refresh → nilai tetap tersimpan (key `bejo_laporan_keuangan_settings_v1`) tanpa menekan simpan
6. Landing page publik: 5 menu halaman bisa diklik dan berpindah halaman
7. Slider banner menampilkan gambar saja (autoplay + panah + dots)
8. Klik foto produk → lightbox terbuka; uji panah, keyboard Esc/←/→, strip thumbnail, counter "n / total", dan tombol tutup
9. Editor Landing Page: unggah gambar di seksi Slider Banner → tampil di Pratinjau Langsung dan di halaman publik

## SELESAI PROMPT
```

---

## 4. Urutan Eksekusi Migrasi (Langkah demi Langkah)

> **Prinsip:** AI Studio harus selalu dalam kondisi bisa di-`tsc` di setiap akhir langkah. Jangan gabungkan tipe + komponen dalam satu langkah besar, karena akan muncul error "cannot find module/type" yang membingungkan.

### Langkah 1 — Amankan kondisi awal AI Studio
1. Di AI Studio, buat **checkpoint/versi baru** dulu (menu versi/riwayat) supaya bisa rollback.
2. Catat 3 file yang paling berisiko: `types.ts`, `App.tsx`, `Navbar.tsx`.
3. Pastikan AI Studio **belum** punya `src/components/landing/` dan `src/components/reports/`.

### Langkah 2 — Bagian A dulu (Tab Laporan), karena tidak bergantung pada landing
Urutan agar tidak ada error tipe:

1. `src/utils/financialStorage.ts` → **file baru**, tanpa dependensi.
2. `src/components/reports/LaporanKeuanganScreen.tsx` → **file baru**, butuh `Transaction`, `StockTransaction`, `Shift` dari `types.ts` (sudah ada) + `financialStorage.ts`.
3. `src/components/reports/LaporanScreen.tsx` → **file baru**, butuh `TransactionHistoryScreen` (sudah ada) + `LaporanKeuanganScreen.tsx`.
4. `src/App.tsx` → patch: import + state + handler + render. **Jalankan `tsc` sekarang**, harus exit 0.
5. `src/components/Navbar.tsx` → ubah label.
6. **Verifikasi A** (poin 1–5 di daftar verifikasi prompt).

### Langkah 3 — Tipe landing
7. `src/types.ts` → tambahkan 9 interface baru + perluas `LandingPageConfig`.
   - Salin dari blok yang ditandai di Bagian 3.1 (atau ambil dari repo lokal baris ~637–800).
   - Karena `LandingPageConfig` diperluas, `landingPageStorage.ts` lama akan error tipe sampai Langkah 4 selesai. **Itu wajar** — catat saja, jangan panik.

### Langkah 4 — Storage + landing page
8. `src/utils/landingPageStorage.ts` → ganti seluruh isi (default baru + migrasi).
   → `tsc` harus exit 0 di sini.
9. `src/components/landing/LandingPage.tsx` → file baru.
10. `src/App.tsx` → patch kedua: import `LandingPage`, state `isViewingPublicLanding`, 2 blok render.
11. `tsc` + buka halaman publik → verifikasi poin 6–8.

### Langkah 5 — Editor CMS
12. `src/components/LandingPageEditorScreen.tsx` → ganti seluruh isi.
13. `tsc` + verifikasi poin 9.

### Langkah 6 — Dokumentasi & finalisasi
14. Ganti `PROMPT_AI_STUDIO.md` dengan versi terbaru (opsional tapi disarankan, agar sesi AI Studio berikutnya punya konteks).
15. Jalankan checklist final di Bagian 6.

---

## 5. Patch Mini — Revisi Terakhir Saja (Slider Gambar Saja)

Kalau AI Studio sudah punya versi baru landing page (hanya ketinggalan revisi terakhir: **slider hanya gambar**), cukup 3 edit kecil ini:

### 5.1 `src/components/landing/LandingPage.tsx` — `HeroSlider`

Ubah signature (hapus 2 prop yang tak terpakai):

```tsx
const HeroSlider: React.FC<{
  slides: LandingSlide[];
}> = ({ slides }) => {
```

Di dalam render tiap slide, **hapus blok konten teks** (badge, `<h1>{slide.title}</h1>`, paragraf subtitle, dan tombol CTA) beserta blok `<div className="absolute inset-0">...` pembungkusnya, dan ganti overlay-nya menjadi:

```tsx
{/* Overlay tipis agar tetap menyatu dengan navbar/footer */}
<div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/20" />
```

Lalu di call-site (halaman Beranda):

```tsx
{/* 1. Slider banner */}
<HeroSlider slides={activeSlides} />
```

### 5.2 `src/components/LandingPageEditorScreen.tsx` — form slide

Ganti grid "Judul Slide" + "Teks Tombol CTA" dan field "Deskripsi Singkat" menjadi satu field penanda:

```tsx
<ImageUploadField
  label="Foto Banner"
  value={slide.imageUrl}
  onChange={(imageUrl) => updateSlide(slide.id, { imageUrl })}
  recWidth={1600}
  recHeight={700}
  maxWidth={1600}
/>

<Field label="Nama Slide" hint="Hanya untuk penanda di editor — tidak tampil di halaman publik">
  <input
    type="text"
    value={slide.title}
    onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
    className={inputCls}
  />
</Field>
```

Dan pada `handleAddSlide`, seed slide baru jadi:

```tsx
const slide: LandingSlide = {
  id: newId('slide'),
  title: `Slide Banner ${config.slides.length + 1}`,
  subtitle: '',
  ctaText: '',
  imageUrl: undefined,
  isActive: true,
};
```

### 5.3 `src/components/LandingPageEditorScreen.tsx` — `LivePreview`

Pada blok "Slider banner utama", ganti `<div className="h-24 sm:h-28 relative">` menjadi `<div className="aspect-[1600/700] relative">`, lalu hapus overlay teks + blok `<div className="absolute inset-0 p-2.5 ...">` (badge/judul/subtitle/CTA mini), dan ganti fallback tanpa gambar menjadi placeholder:

```tsx
<div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400">
  <ImageIcon className="w-3.5 h-3.5" />
  <span className="text-[6.5px] font-bold uppercase tracking-wider">Banner belum diunggah</span>
</div>
```

> Catatan: `textareaCls` masih dipakai di 10 tempat lain, jadi **jangan** dihapus dari file.

---

## 6. Checklist Verifikasi Final

Jalankan di AI Studio setelah semua file masuk:

```
[ ] 1. npx tsc --noEmit          → exit 0
[ ] 2. npm run dev               → http://localhost:3000 terbuka
[ ] 3. Login                     → tab "Laporan" ada (label, bukan "Laporan Penjualan")
[ ] 4. Laporan → Laporan Penjualan → identik dengan sebelumnya
[ ] 5. Laporan → Laporan Keuangan → header + 4 KPI + 7 tab pil tampil
[ ] 6. Input Data → isi nilai → refresh → nilai tetap (auto-save)
[ ] 7. Tombol Cetak → elemen no-print tidak ikut tercetak
[ ] 8. Landing Page (navbar) → "Lihat Halaman Publik" → 5 menu halaman berpindah
[ ] 9. Slider banner: gambar saja, autoplay, panah, dots berfungsi
[ ] 10. Klik foto produk → lightbox terbuka; panah/keyboard/thumbnail/counter OK
[ ] 11. Editor: unggah gambar → muncul di Pratinjau Langsung & halaman publik
[ ] 12. Refresh browser → config landing tetap tersimpan (localStorage)
```

---

## 7. Pitfall — Hal yang Sering Bikin Gagal

| Gejala | Penyebab | Solusi |
|---|---|---|
| `Property 'slides' does not exist on type 'LandingPageConfig'` | `types.ts` belum diperbarui | Kerjakan Langkah 3 sebelum Langkah 4 |
| `landingPageStorage.ts` error setelah update `types.ts` | Default lama belum punya field baru | Selesaikan Langkah 4 (ganti storage) — error hilang |
| Config lama hilang setelah update | Fungsi migrasi tidak dijalankan | Pastikan merge default di `getStoredLandingConfig`, jangan `JSON.parse` mentah |
| Lightbox tidak terbuka saat foto produk diklik | Delegasi event React pada `<img>` tidak jalan | Pakai listener native `addEventListener` di `SmartImage` (Bagian 3.B3) |
| Gambar hilang setelah refresh | base64 terlalu besar / penyimpanan penuh | Kompresi canvas (max width per field, kualitas 0,82) + peringatan kuota |
| Layar putih setelah ganti `App.tsx` | Import ganda / blok JSX tidak seimbang | Bandingkan diff `App.tsx` lokal (Bagian 3.3), pastikan hanya 3 titik tambahan |
| Label tab berubah tapi key ikut berubah | Salah rename key | Cek union type tab tetap `'transactions'` |
| Pratinjau Langsung tampak lama (gelap) | File editor belum diganti utuh | Ganti seluruh `LandingPageEditorScreen.tsx`, jangan potong sebagian |

---

## 8. Sinkronisasi Balik (AI Studio → Lokal)

Setelah perubahan dilakukan di AI Studio, tarik kembali ke lokal:

1. Unduh semua file dari AI Studio (download project / export).
2. Ekstrak ke folder sementara, mis. `$env:TEMP\bejo-balik`.
3. Baca diff dulu sebelum menimpa:

```powershell
$git = 'C:\Program Files\Git\cmd\git.exe'
cd 'D:\DOCUMENTS\Default Project'
$src = "$env:TEMP\bejo-balik"
foreach ($f in @('src\types.ts','src\App.tsx','src\components\Navbar.tsx','src\components\landing\LandingPage.tsx','src\components\LandingPageEditorScreen.tsx')) {
  "=== $f ==="
  & $git diff --no-index -- "$f" (Join-Path $src $f)
}
```

4. Setelah yakin, timpa file, lalu:

```powershell
& $git add -A
& $git commit -m "Sinkronisasi dari AI Studio: <ringkasan perubahan>"
```

5. Jalankan `npx tsc --noEmit` + `npm run dev` untuk verifikasi lokal.

---

## 9. Catatan Teknis Tambahan

- **Node & perintah di Windows:** gunakan `npm.cmd` (PowerShell memblokir `npm.ps1`). Node v24.20.0. Untuk `git`, executable ada di `C:\Program Files\Git\cmd\git.exe`.
- **Dev server:** `npm.cmd run dev` menjalankan `tsx server.ts`, melayani `http://localhost:3000`.
- **Tanpa Firestore:** aplikasi otomatis fallback ke localStorage/offline bila Firestore tidak terjangkau. Log "Connected to Firestore successfully" bersifat informatif.
- **API key AI:** `.env` lokal berisi `GEMINI_API_KEY` kosong (fitur AI nonaktif, sengaja, lokal saja). Di AI Studio isi lewat panel Secrets, **jangan** commit `.env`.
- **Storage key yang dipakai:**
  - Landing page: `bejo_pos_landing_page_config_v1`
  - Laporan keuangan: `bejo_laporan_keuangan_settings_v1`
- **Urutan render di `App.tsx`:** (1) belum login + published → LandingPage; (2) belum login → LoginScreen; (3) `isViewingPublicLanding` → LandingPage; (4) aplikasi utama.
- **Akses editor landing:** hanya role `DEVELOPER`, tab internal `landing_editor`.

---

*Dokumen ini dibuat untuk memudahkan migrasi dua arah antara lingkungan lokal dan Google AI Studio. Simpan bersama `PROMPT_AI_STUDIO.md` di root repo.*
