# MASTER PROMPT & BLUEPRINT ARSITEKTUR APLIKASI — BEJO Digital Print

Dokumen ini menjelaskan **seluruh cara pembuatan aplikasi**: tampilan (frontend), lapisan server, basis data, teknologi, jumlah modul, dan mesin perhitungan yang dipakai. Semua angka dan nama berkas di bawah diverifikasi dari isi repo pada versi **4.13.0** (bukan perkiraan).

Cara memakai:
- Bagian 1–15 = spesifikasi/acuan membaca dan mengubah kode.
- Bagian 16 = blok prompt siap tempel untuk AI/developer lain yang harus membangun atau memperbaiki aplikasi ini.
- Berkas ini diunduh dari **Pengaturan toko → Backup Data** oleh DEVELOPER dalam format `.md` atau `.pdf`.

Dokumen ini **tidak memuat kredensial apa pun**. Nama variabel lingkungan disebut, nilainya tidak.

<!-- ANGKA-STRUKTURAL:START -->
## Angka struktural terukur

Angka-angka di bawah dibandingkan otomatis dengan isi repo oleh `npm run check:blueprint`. Kalau ada perubahan struktur dan angka ini tidak ikut berubah, build penjaga gagal — itu penanda dokumen perlu diperbarui.

- Rute API: 54
- Berkas modul server: 11
- Tab navigasi: 12
- Koleksi PocketBase dari skema: 31
- Koleksi jurnal dibuat saat boot: 2
- Kanal langganan realtime: 39
- Cermin localStorage seluruhnya: 42
- Berkas penjaga di scripts: 18
- Perintah npm: 31
<!-- ANGKA-STRUKTURAL:END -->


---

## 1. Ringkasan produk

Aplikasi toko satu pintu untuk BEJO Digital Print: kasir, stok, agen (reseller), cetak digital (SPK), invoice B2B, pajak, jurnal Google Sheet, pembukuan dua entitas (Dagang Perorangan → PT), marketing, dan situs publik toko.

- Bentuk: **SPA React** + **satu server Node/Express** yang juga menjadi broker ke basis data.
- Multi-perangkat: semua perubahan tampil di perangkat lain **langsung** (realtime) tanpa refresh.
- Dua mode jalan: **Hybrid Server** (tersambung) dan **Mode Lokal** (tidak tersambung; data hanya di perangkat itu).
- Bahasa antarmuka: Indonesia awam, pendek, tanpa istilah programmer.
- Versi: `major.minor.patch`, disimpan sinkron di `package.json` dan `src/config/brand.ts` (`APP_VERSION`), diperiksa `scripts/check-version.mjs`.

Ukuran kode (terukur): 183 berkas `.ts`/`.tsx` di `src/` (±105.908 baris) dan 11 berkas server (±5.708 baris).

---

## 2. Teknologi yang dipakai

| Lapisan | Teknologi | Versi |
|---|---|---|
| UI | React + TypeScript | 19.0.1 / ~5.8.2 |
| Build frontend | Vite + `@vitejs/plugin-react` | 6.2.3 |
| Gaya | Tailwind CSS v4 lewat `@tailwindcss/vite` (tanpa PostCSS config) | 4.1.14 |
| Ikon / animasi / grafik | `lucide-react`, `motion`, `recharts` | — |
| Tabel spreadsheet (Jurnal) | `@fortune-sheet/core`, `@fortune-sheet/react` | — |
| Dokumen | `jspdf`, `jspdf-autotable` (PDF), `xlsx` (Excel), `qrcode` | — |
| Server | Express 4.21.2 dijalankan `tsx` saat dev | — |
| Basis data + realtime | PocketBase 0.28.1 (SDK `pocketbase` di browser) | 0.28.1 |
| AI | `@google/genai` (gambar, video, asisten) | — |
| Bundel server produksi | esbuild → `dist/server.cjs` | 0.25.0 |
| Reverse proxy + HTTPS | Caddy | — |
| Layanan Windows di VPS | NSSM (BejoStikerPOS, Caddy, PocketBase) | — |

Perintah penting (`package.json`, 27 skrip npm):
- `npm run dev` → `tsx server.ts` (server + API di port 3000, Vite dilayani terpisah).
- `npm run build` → `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`.
- `npm start` → `node dist/server.cjs`.
- `prebuild` menjalankan 5 penjaga (lihat bagian 13).

---

## 3. Struktur berkas

```
server.ts                 2.112 baris — Express, rute invoice/AI/diagnostik, SPA wildcard
server/                   11 modul server (rute + kebijakan sisi server)
src/
  App.tsx                 2.886 baris — state utama, tab, sinkronisasi, tulis cloud
  main.tsx, index.html    entry
  components/             17 berkas *Screen.tsx, 19 berkas *Modal.tsx, 8 subfolder
  backend/pocketbaseBackend.ts   2.450 baris — SATU jalur tulis/baca/langganan cloud
  lib/                    8 berkas (pb client, branding, jurnal api, auth, blueprint)
  hooks/                  useAuth, useCollection, useRecord, useTaxYears, useEntityRegistry, useAccountChart, useLedgerEntries
  utils/                  61 berkas — mesin hitung, penyimpanan, kebijakan
  types/                  tax.ts, reconciliation.ts
  config/brand.ts         nama + APP_VERSION + identitas brand
  data/, assets/          seed awal dan aset statis
scripts/                  27 berkas: 18 penjaga + create-pocketbase-collections.mjs + util
deploy/                   skrip provisioning & deploy VPS (PowerShell)
AGENTS.md                 aturan wajib proyek
USER-ROLE.md              daftar wewenang role → tab & aksi (tabelnya dibandingkan penjaga dengan kode)
MASTER PROMPT & BLUEPRINT ARSITEKTUR APLIKASI.md   dokumen ini (unduh lewat menu Backup)
```

Subfolder komponen: `journal`, `landing`, `marketing`, `modals`, `reconciliation`, `reports`, `spk`, `tax`.

---

## 4. Modul aplikasi (frontend)

**12 tab navigasi** terdaftar di `src/components/Navbar.tsx:101` (`ALL_TABS`) dan di-render dari `src/App.tsx:404` (union 11 nilai tab state; `marketing` digabung di Navbar). Grup: Operasional, Produksi, Laporan & Keuangan, Pengaturan, Developer.

| # | key tab | Label | Gerbang akses (`Navbar.tsx:178-218`) | Layar |
|---|---|---|---|---|
| 1 | `pos` | POS Kasir | DEVELOPER/OWNER/ADMIN/KASIR | `PosScreen.tsx` |
| 2 | `inventory` | Katalog Produk | `canViewCatalog`: DEVELOPER/OWNER/ADMIN/SPK (SPK hanya melihat) | `InventoryScreen.tsx` |
| 3 | `stock` | Stok | DEVELOPER/OWNER/ADMIN + toko tersambung | `StockScreen.tsx` |
| 4 | `agen` | Portal Agen | AGEN/DEVELOPER/OWNER/ADMIN | `AgentScreen.tsx` |
| 5 | `shift` | Shift Kasir | selain AGEN/SPK | `ShiftScreen.tsx` |
| 6 | `spk` | SPK Cetak Digital | SPK/DEVELOPER/OWNER/ADMIN | `SpkScreen.tsx` (6 sub-tab) |
| 7 | `transactions` | Laporan | `canViewSalesReport`: DEVELOPER/OWNER/ADMIN/SPK (SPK hanya menu Laporan Penjualan) | `TransactionHistoryScreen.tsx` + `reports/` |
| 8 | `invoices` | Invoice B2B | DEVELOPER/OWNER/ADMIN | `InvoiceScreen.tsx` |
| 9 | `tax` | Pajak | DEVELOPER/OWNER/ADMIN | `tax/TaxScreen.tsx` |
| 10 | `marketing` | Marketing | DEVELOPER/OWNER/ADMIN | `MarketingScreen.tsx` |
| 11 | `customers` | Pengaturan Toko | DEVELOPER/OWNER/ADMIN | `CustomerScreen.tsx` |
| 12 | `landing_editor` | Website | **DEVELOPER saja** (`App.tsx:2663`) | `LandingPageEditorScreen.tsx` |

Halaman di luar tab: `LoginScreen.tsx`. Sub-tab penting: `agentScreenSubTab` (`App.tsx:465`), `spkInitialTab` 6 nilai (`App.tsx:466`), Laporan punya Laporan Penjualan / Laporan Keuangan / Rekonsiliasi / Jurnal — dua menu tengah hanya dipasang bila `canViewAllReportMenus(role)`, dan konten dibaca dari `visibleSubTab` supaya sub-tab yang tidak diizinkan tidak pernah ter-render (`reports/LaporanScreen.tsx:77` dan `:112`).

**Laporan Keuangan** (`reports/LaporanKeuanganScreen.tsx`) punya **14 menu** (`:332-345`): Laba Rugi, Perubahan Modal, Neraca, Arus Kas, Neraca Saldo, Buku Besar, Jurnal Umum, Gabungan Internal, Laporan Resmi PT, Pengaturan Entitas, Bagan Akun, Penutupan & Transisi, Input Data, Panduan. Lima layarnya dimuat `React.lazy` (`:54-58`): `EntitySettingsView`, `AccountChartView`, `TransitionWizardView`, `LedgerBooksView` (neraca saldo + buku besar + jurnal, dengan `LedgerBookSection`), `LedgerReportsView` (empat laporan + gabungan internal + laporan resmi PT). Semua angkanya dibaca dari jurnal entitas terpilih — tidak ada layar yang menjumlah tabel penjualan sendiri.

**6 peran** (`src/types.ts:229`): `DEVELOPER`, `OWNER`, `ADMIN`, `AGEN`, `KASIR`, `SPK` (+ string terbuka untuk peran khusus).

**Delapan aturan wewenang yang tidak boleh disatukan** (`src/utils/recordAccess.ts`, didaftar di `USER-ROLE.md`):
- `canManageRecords(role)` :7 → DEVELOPER + ADMIN saja → dipakai **tab SPK Cetak**.
- `canManageBusinessData(role)` :21 → DEVELOPER + ADMIN + OWNER → dipakai **Agen, Laporan, Invoice, Pajak, Marketing**.
- `canViewCatalog(role)` :31 → DEVELOPER + OWNER + ADMIN + SPK → membuka **tab Katalog**.
- `canEditCatalog(role)` :42 → DEVELOPER + ADMIN + OWNER → tambah/ubah produk & kelola kategori (SPK sengaja tidak: harga kulak ikut menggeser nilai aset toko).
- `canViewSalesReport(role)` :52 → DEVELOPER + OWNER + ADMIN + SPK → membuka **tab Laporan**.
- `canViewAllReportMenus(role)` :62 → DEVELOPER + ADMIN + OWNER → menu Laporan Keuangan & Rekonsiliasi di dalam tab Laporan.
- `canDownloadBlueprint(role)` :75 → DEVELOPER saja (tegakan server di `server/blueprintApi.ts`).
- OWNER sengaja **tidak** boleh hapus order/purge arsip SPK. Jurnal punya aturannya sendiri (`journalAccessPolicy.ts`: baca = DEVELOPER/OWNER/ADMIN, tulis = DEVELOPER saja).
- Jejak audit selalu lewat `describeAuditActor(user)` (`src/utils/auditActor.ts:10`); nama orang tidak boleh ditulis tetap di komponen.
- `USER-ROLE.md` adalah daftar wewenang yang bisa dibaca manusia **dan** mesin: `npm run check:access` seksi H membandingkan tiap sel tabel dengan hasil fungsi aslinya, `allowed()` Navbar (dievaluasi dari sumbernya), dan gerbang pasang layar di `App.tsx`. Berkas `.md` tidak menegakkan apa pun — yang menegakkan adalah fungsi + penjaga, jadi urutannya: ubah fungsi → sesuaikan tabel → `npm run check:access`.

---

## 5. Arsitektur frontend

- `App.tsx` memegang state global (produk, stok, transaksi, shift, SPK, invoice, pajak, agen, pengaturan toko, sesi), efek langganan realtime, dan semua handler tulis cloud.
- **Semua** akses cloud lewat `src/backend/pocketbaseBackend.ts`: baca, tulis, hapus, 39 kanal langganan (`export function subscribe*`), watchdog, outbox. Aturan: jangan menulis `pb.collection(x).subscribe(...)` di komponen.
- Pembukuan dua entitas ikut jalur yang sama tanpa menambah kanal baru yang tersebar: `subscribeEntityRegistry` (`:2224`) / `saveEntityRegistryCloud` (`:2234`) untuk record `settings/entity_registry`, `subscribeAccountChart` (`:2244`) / `saveAccountChartCloud` (`:2254`) untuk `settings/account_chart`, dan `subscribeLedgerEntries` (`:1745`) untuk koleksi `ledger_entries` — tulisannya lewat `saveLedgerEntryCloud` (`:1753`) dan `saveAllLedgerEntriesCloud` (`:1759`) (`src/backend/pocketbaseBackend.ts`). Ketiganya dipasang di efek langganan `App.tsx` (`:1193`, `:1198`, `:1203`) dan dibersihkan bersama saat unmount (`:1242-1244`); nilai dari server masuk lewat `applyEntityRegistryFromCloud`/`applyAccountChartFromCloud`/`applyLedgerEntriesFromCloud` (`fromCloud = true`) sehingga tidak ditulis balik.
- Kanal dibuat lewat `createSafeSubscription` → `subscribeCollection`/`subscribeRecord` dengan topik `'*'`, dipasang di efek langganan `App.tsx` (deps `[]`) sehingga hidup sepanjang sesi.
- Cermin offline: 42 kunci localStorage `bejo_pos_*` di seluruh `src/` (27 di antaranya terdaftar di `src/utils/storage.ts`) + IndexedDB (`src/utils/localDatabase.ts`) untuk Mode Lokal.
- Data URL avatar dibatasi `MAX_AVATAR_DATA_URL_LENGTH = 120000` (`src/utils/credentialPolicy.ts:16`).

---

## 6. Server (backend)

**54 rute API** = 21 di `server.ts` + 33 di 9 modul, ditambah 1 wildcard SPA (`app.get('*')`) yang menyajikan `dist/index.html`.

| Modul | Rute | Isi |
|---|---|---|
| `server.ts` | 21 | `/api/health`, diagnostik backend (`/api/backend/diagnostics`, `fix`, `clear-errors`, `simulate-error`), `/api/lan/ping-machine`, AI (`/api/generate-image`, `generate-video`, `video-status`, `ai-assistant`), 11 rute invoice B2B |
| `server/journalApi.ts` | 7 | `/api/journal/session`, `/config`, `/sheets` (baca + tulis) |
| `server/marketingApi.ts` | 9 | `/api/marketing/status`, `diagnostics`, `whatsapp-status-ads/*`, `tiktok-infeed-ads/*`, `shopee-discovery-ads/*` |
| `server/userAdmin.ts` | 5 | `/api/users`, `/me`, `/:id`, `/presence`, `/sync` |
| `server/posAuth.ts` | 4 | `/api/auth/mode`, `me`, `login`, `logout` |
| `server/devAuth.ts` | 3 | `/api/auth/session`, `developer-login`, `logout` |
| `server/landingApi.ts` | 2 | `/api/landing/published`, `/media/:id` |
| `server/pbSession.ts` | 1 | `/api/pocketbase/session` (broker token PocketBase) |
| `server/brandingApi.ts` | 1 | `/api/branding` (publik, satu-satunya jalur baca identitas sebelum login) |
| `server/blueprintApi.ts` | 1 | `/api/blueprint` — dokumen blueprint, **hanya DEVELOPER** (401 tanpa sesi, 403 peran lain, `no-store`) |
| `server/staffStore.ts`, `server/passwordHash.ts` | 0 | layanan internal (direktori staf, scrypt, `ensureSyncAccount`) |

Kebijakan akses rute:
- `PRIVATE_API_PREFIXES` (`server.ts:173`) menjaga rute privat dengan cookie sesi; `/api/branding` **sengaja tidak masuk** daftar itu supaya layar login bisa menampilkan nama + logo toko. Gagal baca branding = `200 {success:false}` (bukan 503) agar login tidak pernah ikut gagal. `/api/blueprint` justru **masuk** daftar itu dan ditambah penolakan peran di modulnya karena isinya dokumen proyek.
- mode `PUBLIC_SITE` membuat aplikasi menutup jalur tulis langsung dan memakai broker sesi; kredensial Basic (`REMOTE_ACCESS_USER`/`REMOTE_ACCESS_PASS`) menjaga panel tertentu.
- Token PocketBase tidak pernah turun ke kode browser: browser bicara ke `https://<domain>/api/pb` (Caddy), token diterbitkan `server/pbSession.ts` dari `PB_SYNC_*`.
- Variabel lingkungan yang dibaca server (nama saja): `PORT`, `NODE_ENV`, `APP_URL`, `PUBLIC_SITE`, `POCKETBASE_URL`, `POCKETBASE_UPSTREAM`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`, `PB_SYNC_EMAIL`, `PB_SYNC_PASSWORD`, `DEV_USERNAME`, `DEV_PASSWORD_HASH`, `APP_SESSION_SECRET`, `JOURNAL_DEV_USER`, `JOURNAL_DEV_PASSWORD`, `JOURNAL_SESSION_SECRET`, `GEMINI_API_KEY`, `META_*`, `TIKTOK_*`, `SHOPEE_*`.
- **Larangan keras:** variabel berprefix `VITE_` ikut dibundel ke browser, jadi `VITE_PB_SYNC_EMAIL`/`VITE_PB_SYNC_PASSWORD` tidak boleh ditulis ke `.env` oleh skrip mana pun (dijaga `npm run check:users` kasus J).

---

## 7. Basis data (PocketBase)

- **31 koleksi** dibuat `scripts/create-pocketbase-collections.mjs` (baris 79–620): `users`, `app_users`, `products`, `product_categories`, `customer_categories`, `customers`, `transactions`, `stock_transactions`, `shifts`, `cashiers`, `agents`, `suppliers`, `store_profiles`, `custom_roles`, `agent_notifications`, `activity_logs`, `asset_adjustments`, `reconciliation_runs`, `ledger_entries`, `spk_orders`, `machines`, `ai_chat_messages`, `user_mentions`, `private_chat_messages`, `printing_rejects`, `invoices`, `invoice_settings`, `settings`, `taxpayer_profile`, `tax_annual_returns`, `tax_monthly_billings`.
- **2 koleksi Jurnal** (`jurnal_config`, `jurnal_sheets`) dibuat saat boot oleh `server/journalApi.ts:366-417` dengan aturan lima API `null` (hanya superuser) — total **33 koleksi**.
- Pola wajib di semua koleksi: `legacyId` (penanda id aplikasi lama, supaya restore backup tidak menduplikasi orang yang sama) + kolom JSON `data` (mirror 5 MB untuk field yang tidak masuk skema, mis. `avatarUrl`, `mustChangePassword`).
- `users` dan `app_users` **terkunci superuser** (create/update/delete rule `null`) karena akun staf hanya boleh ditulis lewat server. Aturan baca/langganan koleksi bisnis berbunyi `@request.auth.id != ""`, jadi kanal realtime wajib dibuat setelah token sesi ada.
- Akun sinkronisasi (`PB_SYNC_EMAIL`) tidak boleh punya baris `app_users`; `ensureSyncAccount` menyamakan record dengan `.env` saat boot.
- URL PocketBase yang dibundel ke browser **wajib domain publik** (`VITE_POCKETBASE_URL = https://<domain>/api/pb`); nilai localhost membuat semua pengunjung jatuh ke Mode Lokal (dijaga `deploy-vps.ps1`).

---

## 8. Mesin perhitungan (isi tiap modul)

### 8.1 Aset toko — `src/utils/assetTrend.ts` + `src/utils/assetAdjustments.ts`
- Nilai kini: `currentStoreAssetValue(products)` :142 = Σ `assetUnitCost(product)` × stok; hanya produk terhitung aset (`isCountedInStoreAsset` :130).
- Garis waktu dibuat **rekonstruksi mundur**: nilai hari H = nilai kini − seluruh kejadian setelah hari itu; `bucketKeyOf` :80 mendukung HARIAN/MINGGUAN/BULANAN, batas mundur `maxBackDays` = 1460 hari (`assetTrend.ts:228`).
- Dua ledger wajib ada: `stock_transactions` (satuan utama × harga kulak) dan `asset_adjustments` (kejadian dalam rupiah).
- Dekomposisi penyesuaian persis (`adjustmentsFromProductEdit` :89): efek harga `(hargaBaru − hargaLama) × stokLama` **ditambah** efek stok `hargaBaru × (stokBaru − stokLama)`; jumlah keduanya = selisih nilai aset. Baris bernilai nol tidak ditulis (`adjustmentsFromCostEdit` :173, `adjustmentsFromStockDiff` :199, `aggregateAdjustment` :230).

### 8.2 Rekonsiliasi — `src/utils/reconciliationMath.ts`
- Satu fungsi untuk tabel, riwayat, dan PDF: `analyzeReconciliation(kind, rows, columns)` :210.
- Tiap **kolom** dinilai terpisah (`row.values` dikunci id kolom); angka antar kolom tidak boleh dijumlah.
- Varians = **A − B**; Komparatif = **B − A**. Arah untung dari `direction` kolom (`NAIK`/`TURUN`), jika `ROW` ikut sifat baris: PENDAPATAN untung bila capaian > rencana; BIAYA untung bila capaian < rencana.
- Sifat baris tiga: `PERBANDINGAN` (bawaan; verdict `NETRAL`, label dari tanda selisih lewat `verdictLabel` :332, tanpa warna untung/rugi), `PENDAPATAN`, `BIAYA`.
- Identitas wajib: `goodCount + badCount + matchCount + neutralCount === countedRows` (`summaryCountsText` :364). Baris tanpa nama atau semua kolom nol tidak terhitung.
- Persen selalu memakai Laporan A **pada kolom yang sama**; A = 0 → `percent: null` dan sel dikosongkan (`formatPercentValue` :301) — tidak pernah 0% atau ∞.
- Format hanya lewat `formatColumnValue` :310 (UANG → rupiah, JUMLAH → angka biasa). Selisih uang negatif ditulis `-Rp 850.000`.

### 8.3 Pajak — `src/utils/taxStorage.ts` + `src/utils/taxBillingMath.ts` + `src/types/tax.ts`
- PPh orang pribadi/pasal 25: lapisan **UU HPP** di `types/tax.ts:233-239` — 5% s.d. 60 jt, 15% s.d. 250 jt, 25% s.d. 500 jt, 30% s.d. 5 M, 35% di atasnya; dihitung bertingkat oleh `calculateTaxPayableUuHpp` (`taxStorage.ts:70`).
- PTKP 11 status (`types/tax.ts:217-231`): TK/0 = 54 jt, tiap tanggungan +4,5 jt, K/I menambah istri.
- **Dasar pengenaan PPh Final punya dua mode per tahun** (`DppBasisMode` di `types/tax.ts:317-347`): `BRUTO_PENUH` = seluruh peredaran bruto menjadi DPP, PPh = Bruto × tarif (bawaan, permintaan pemilik 2026-11-02); `AMBANG_500_JUTA` = fasilitas PP 55/2022, hanya omzet kumulatif di atas 500 jt/tahun yang masuk DPP (`max(0, totalBruto − 500.000.000) × 0,5%`, ambang dibaca dari `TAX_CONFIG_2025.umkmExemptThresholdOp` `:242`). `exemptThresholdForMode` `:343` memberi 0 untuk bruto penuh.
- Mesin hitung bulanan ada di `src/utils/taxBillingMath.ts` (murni, tanpa modul koneksi server supaya `check:tax-years` menjalankannya di Node): `recomputeMonthlyBillingYear` :26 menghitung dua arah — ketik Peredaran Bruto → DPP dan PPh terisi sendiri sesuai mode, ketik PPh Disetor → DPP = PPh ÷ tarif dan Bruto diisi bila kosong; `getYearDppBasisMode` :76 dan `setYearDppBasisMode` :90 memasang mode ke 12 bulan lalu menghitung ulang. Mode disimpan **di baris billing** (`billingsByYear` adalah field JSON), jadi tidak ada koleksi atau kolom server baru dan pengaturan ikut terkirim lewat kanal billing yang sudah ada.
- `taxStorage.ts` hanya mengimpor dan mengekspor ulang mesin itu. Layar pemilih mode ada di banner "Dasar DPP:" pada `TaxFilingHistoryView.tsx`; `TaxOfficialPrintView.tsx` mencetak dasar yang benar-benar dipakai tahun itu (kepala Lampiran III menulis "DASAR DPP", bukan klaim fasilitas). `TaxDashboard.tsx`, `TaxIncomeView.tsx`, dan `TaxFinalNonTaxableView.tsx` menampilkan ambang dari isian tahun (`formatRupiah(umkmThreshold)`), dengan penjelasan memakai `isFullGrossBasis` `types/tax.ts:347`.
- NPPN dan pembukuan jadi dua jalur alternatif perhitungan tahunan; `recomputeTaxReturn` :194 menyusun kembali SPT 1770, `syncReturnWithMonthlyBillings` :493 menjaga angka tahunan dan bulanan tetap sama — nilai tahunan dibaca dari **jumlah DPP tabel billing** (`umkmTaxableRevenue = totalDpp`, `umkmTaxExemptThreshold = totalGross − totalDpp` `:534-536`), bukan dihitung ulang dengan ambang, sehingga mode bruto penuh menulis ambang 0 apa adanya. Ambang di layar wajib dibaca dengan `??`, bukan `||`.
- **Daftar tahun pajak** (`src/utils/taxYears.ts`, aturan tunggal; tulis cloud di `taxStorage.ts`): `DEFAULT_TAX_YEARS` 2022–2028, `normalizeTaxYears` membuang nilai tidak sah/duplikat dan memotong ke 30 tahun (rentang 2000–2060), `withAddedTaxYear`/`withRemovedTaxYear` (tahun terakhir tidak boleh hilang), `writeTaxYears` menyimpan cermin `bejo_tax_years` dan menyiarkan `bejo_tax_years_updated`, `defaultTaxYear` memilih tahun aktif terbaru yang sudah berjalan. Berkas aturan ini tidak mengimpor `pocketbaseBackend` supaya `check:tax-years` dapat menjalankannya di Node.
- Seluruh layar tahun membaca daftar itu — `useTaxYears()` di `TaxScreen.tsx`, `TaxFilingHistoryView.tsx`, `TaxSettingsView.tsx` dan `getTaxYearsDescending()` di `TaxFilingWizard.tsx`; tidak ada lagi angka tahun atau perbandingan `=== 2026` di komponen pajak. Pemilik menambah/mengurangi tahun di submenu **13. Pengaturan Pajak** bagian "5. Tahun Pajak yang Diisi"; tahun yang dikurangi hanya disembunyikan (billing + draf SPT tetap tersimpan dan muncul lagi saat tahunnya ditambah kembali).
- Daftar tahun dikirim ke perangkat lain sebagai satu catatan `settings/tax_years` (`subscribeTaxYears`/`saveTaxYearsCloud` di `pocketbaseBackend.ts`, kanal dipasang di efek langganan `App.tsx`); nilai dari server masuk lewat `applyTaxYearsFromCloud` sehingga tidak ditulis balik, dan tahun baru langsung punya isian lewat `ensureTaxYearsSeeded()`.
- PKP: omzet > 4,8 M wajib dikukuhkan; kelipatan faktur dibulatkan ke bawah per 1.000. PPh 25: estimasi `(utang tahunan − kredit PPh 21) / 12`.

### 8.4 Stok, HPP, bahan — `src/utils/stockUtils.ts`
- `getProductRollPakQty` :154 menurunkan isi satu roll/pak dari satuan kemasan.
- Modal per satuan bahan: `calculateStockItemProfit` :507 = `hargaKulak ÷ qtyPerRollPak` → harga per meter/lembar.
- `calculateSalesItemCost` :572 menghitung HPP item penjualan, termasuk konversi luas **m²** untuk bahan cetak.
- `getMaterialStockFormula` :204 menghasilkan rumus stok bahan yang dipakai layar; `calculateBorrowReturnStock` :314 untuk pinjam/pulang agen; `calculateStockBreakdown` :367 untuk rincian.
- Satuan meter/lembar dikenali lewat `isMeterOrLembarUnit` :9.

### 8.5 Invoice B2B — `src/utils/invoiceStorage.ts` + `src/utils/formatters.ts`
- `calculateInvoiceTotals` :62: bruto = kuantitas × harga satuan, PPN bawaan 11%, DP bawaan 50%, lalu total, dibayar, kurang bayar.
- Nomor dokumen berjenjang: `generateNextDocumentNumber` :275 → `{INV|PI}/{pref}/{YYYY}/{MM}/{seq4}`; `generateNextCreditNoteNumber` :315 untuk nota retraksi.
- Jadwal pembayaran: `generateDefaultPaymentSchedules` :123, `recalculatePaymentSchedules` :216, `autoBalancePaymentSchedules` :235.
- Termin/DP efektif: `getTerminStageDisplayInfo` :888, `getProformaEffectivePaymentInfo` :1118; konversi PI→INV menjadi transaksi POS lewat `convertInvoicesToTransactions` :1245.
- **Status tahap dibaca dari keadaan yang tercatat, bukan dari posisi baris.** Fakta yang dipakai berurutan: flag lunas pada baris jadwal (`isStageMarkedPaid`), penanda tahap terstruktur lalu penanda akhir nomor dokumen (`findBilledStageIndex` :781), dokumen tertutup (`isDocumentSettled`: status `PAID` atau sisa ≤ 0), uang masuk kumulatif (`isStageCoveredByRecordedPayment` :818), dan dokumen yang menagih seluruh kontrak (`billsWholeContract` :804 — `grandTotal` ≥ jumlah jadwal atau `terminPercentage` ≥ 100). Keterangan bebas tidak pernah dibaca sebagai angka tahap.
- **Dokumen "Penuh (Full)" tidak pernah menulis satu tahap pun "Belum"**: tahap yang belum tertutup terbaca "Tagihan Ini". Aturan ini yang memperbaiki invoice pelunasan `INV/BJP/2026/11/0002` yang dulu menyatakan Termin 3 "Belum" padahal dokumennya Lunas dan sisa Rp 0 — tanpa migrasi data.
- Penanda nomor dokumen satu aturan: `resolveStageSuffix` :843 (`DP` → `/DP` untuk tahap pertama dan `/PELUNASAN` untuk **tahap terakhir** sesuai jumlah jadwal; skema lain → `/T{n}`), dibaca balik oleh `stageNumberAliases` :864. Dipakai penulis nomor (modal konversi, pratinjau form) dan pencocok hapus/batal/catat pembayaran di `InvoiceScreen.tsx` — tidak ada angka tahap yang ditulis tetap di layar.
- Riwayat Rekonsiliasi Pembayaran (layar detail **dan** PDF) dari `getInvoicePaymentHistory` :1064: dokumen seluruh kontrak mengumpulkan pembayaran miliknya + proforma induk (`resolveSourceProforma` :1016) + invoice final saudara (`linkedCommercialInvoices` :1030), diurutkan tanggal lalu `createdAt`, dedupe lewat `referenceNumber` dan tanda `tanggal|nominal|metode`. Hanya untuk tampilan — `amountPaid`/`balanceDue` tetap dari `getProformaEffectivePaymentInfo` agar baris tersalin tidak dihitung dua kali.
- Nomor struk POS: `generateUniqueInvoiceId` (formatters.ts:120) → `BS{YYYY}/{MM}/{seq}`.
- Rekonsiliasi uang tunai shift: `getNetCashAmount` :517 = `min(uangTunaiKasir, total − transfer − qris)`.

### 8.6 Periode riwayat agen & rekap — `src/utils/agentHistoryPeriod.ts`
- `matchesRecapPeriod` dan `buildRecapPeriodLabel` dipakai daftar, pratinjau, dan PDF sekaligus; kunci tanggal dinormalkan ke `YYYY-MM-DD` (data lama `DD/MM/YY`), rentang inklusif, input terbalik dinormalkan, baris tanpa tanggal tidak masuk periode.

### 8.7 Deadline SPK — `src/utils/spkDeadlineMonitor.ts`
- `evaluateSpkDeadlines` :51 menilai sisa waktu tiap order, `isUserEligibleForDeadlineAlert` :36 memfilter peran; bunyi lewat `notificationSound.ts` + `webNotifications.ts`.

### 8.8 Kredensial — `src/utils/credentialPolicy.ts`
- Satu aturan untuk UI **dan** server: panjang minimal 10 (`MIN_PASSWORD_LENGTH` :10), wajib huruf + angka, bukan publik/diketahui, tidak sama atau diawali username; password sementara minimal 6 (`:13`, hanya sah saat `mustChangePassword=true`); format username `^[a-z0-9][a-z0-9._-]{2,31}$` (`:18`); `generateStrongPassword` :159 memakai CSPRNG.

### 8.9 Ukuran muatan cloud — `src/utils/dbSanitize.ts` + `src/utils/storeLogoImage.ts`
- `BINARY_MAX_CHARS = 50.000` (`:9`) memotong lampiran base64; **khusus** `logoUrl` memakai `LOGO_MAX_CHARS = 400.000` (`:15`, daftar `LOGO_FIELDS` `:17`, pemilihan cap `:27`).
- Unggahan logo selalu dikompres: tangga 256/192/128 px × kualitas 0,9→0,6, berhenti pada hasil pertama ≤ `LOGO_TARGET_CHARS = 200.000` (`storeLogoImage.ts:11`). Bila terkecil masih besar, penyimpanan **dibatalkan** dengan pesan jelas — logo yang hanya terlihat di satu perangkat dilarang.

### 8.10 AI
- Server: `@google/genai` (`server.ts:241`) untuk `/api/generate-image`, `/api/generate-video` + `/api/video-status`, `/api/ai-assistant` (penawaran desain cetak).
- Browser: `src/utils/localBejoAiEngine.ts` menyiapkan jawaban lokal saat server tidak tersambung.

### 8.11 Berkas cadangan — `src/utils/backupDomains.ts` + `src/utils/backupUtils.ts`
- Registry **39 domain** dalam **11 kelompok** (`BACKUP_DOMAINS` :81) menjadi satu-satunya sumber untuk payload, pratinjau, pemulihan ke perangkat, dan antrean kirim ke server. Satu domain = `key`, `label`, `group`, `shape` (`array`/`object`/`scalar` :19), `storageKeys`, `cloudChannel`, `cloudWrite` (`record`/`payload`/`none` :22).
- Modul registry **murni**: tidak mengimpor `pocketbaseBackend` supaya penjaga dapat menjalankannya di Node. Akses nyata per domain ada di `DOMAIN_ACCESS` (`backupUtils.ts:138`) sebagai `read`/`restore`/`cloud`, dan `generateBackupPayload` :378, `payloadDomainCounts` :408, `restoreBackupToStorage` :490, `restoreBackupToCloud` :549 semuanya berputar mengikuti registry — tidak ada field atau ringkasan yang ditulis tangan per domain.
- **Akun login staf tidak ikut berkas** (`CREDENTIAL_EXCLUSION_NOTE` :500; `LOGIN_CREDENTIAL_FIELDS` :489 = `password`, `appPassword`, `mustChangePassword`, `authId`; `REMOVED_BACKUP_KEYS` :497). `validateBackupPayload` :459 menghapus `data.users`/`data.authUser` dari berkas lama, dan tidak ada task 'Pengguna' di pemulihan cloud — kode ini yang dulu menghasilkan `USERNAME_TAKEN`/`ACCOUNT_RESERVED` saat restore lintas perangkat.
- Bentuk berkas `version: '3.0.0'` :395 dengan `data` berisi kunci domain dan `summary: { totalRecords, counts }`; berkas lama tetap terukur (`payloadDomainCounts` menghitung ulang dari isi).
- 9 kunci sengaja dikeluarkan dengan alasan tertulis (`EXCLUDED_STORAGE_KEYS` :433): cermin akun login, siapa yang sedang masuk di perangkat ini, mode tema, folder cetak/izin LAN per peramban, konfigurasi basis data lokal, antrean kirim ulang, tanggal bersihin arsip SPK, dan alamat lembar Google Sheet toko. Domain tanpa jalur tulis server (`deviceOnlyDomainLabels` :523, 5 domain) tampil apa adanya di layar cadangan sebagai "hanya tersimpan di perangkat ini".
- Urutan registry dipakai restore: tagihan PPh bulanan sebelum SPT tahunan; `activeShift` satu-satunya domain `allowsNull` (hapus shift aktif = kirim `null`). Berkas pra-3.0 tanpa `assetAdjustments` mendapat satu baris `aggregateAdjustment(... 'RESTORE')` supaya garis nilai aset tidak melompat diam-diam.
- Uji regresi: `npm run check:backup` — A konsistensi registry, B pengecualian akun, C pemindaian seluruh pemakaian `localStorage` di `src/`, D jalur tulis per domain, E aturan registry-driven, F berkas lama, G perhitungan jumlah isi.

### 8.12 Pembukuan dua entitas (Dagang Perorangan → PT) — `src/utils/entityRegistry.ts` + `accountChart.ts` + `ledgerMath.ts` + `ledgerAggregates.ts` + `transitionMath.ts` + `ledgerReports.ts`

Bentuk usaha toko berganti menjadi **Perseroan Terbatas per 1 Juli 2026** (penetapan pemilik 2026-11-03). Histori 2022 ke atas tidak dipindahkan — entitas lama dibekukan sebagai saldo awal, buku PT dibangun dari jurnal.

- **Registry entitas** (`entityRegistry.ts`, 569 baris, murni): tiap entitas punya `kind` (`PERORANGAN`/`PT`), `startDate`, `endDate`, identitas hukum (NPWP, alamat, nomor akta) dan isian pajaknya sendiri. `entityForDateKey` :378 dan `entityForMonthKey` :398 menentukan pemilik satu tanggal tanpa menebak; `eraForDateKey` :389/`eraLabel` :395 memberi cap "Pra-PT"/"Pasca-PT"; `lastDayBefore` :188 menurunkan tanggal penutupan buku dari tanggal transisi, bukan dari angka tulis; `isDateLocked` :484 mengunci tanggal sampai `closedThroughDate`; `DEFAULT_TRANSITION_DATE` `:97` = `2026-07-01` dan `EARLIEST_BOOK_DATE` `:100` = `2022-01-01` adalah **satu-satunya** tempat kedua tanggal itu ditulis (penjaga memindai seluruh `src/`).
- **Bagan akun per entitas** (`accountChart.ts`, 394 baris): `LEGACY_ACCOUNT_CODES` :58 mempertahankan kode lama (1100 Kas Toko, 1110 Bank Pribadi, 3100 Modal, 3200 Prive, 1590 Akumulasi Penyusutan), `PT_ACCOUNT_CODES` :77 menambah akun PT (1101 Kas, 1102 Bank PT, 2300 Utang Pemegang Saham, 3150 Tambahan Modal Disetor, 3300 Saldo Laba, 3400 Dividen, 6200 Gaji Direksi, 8100 Beban Pajak). `applyTransitionRules` :277 = `archivePersonalBankAccounts` :257 + `disablePriveForPt` :266 (mengarsipkan, tidak menghapus), `ensureStandardAccounts` :288 melengkapi akun standar, `canDeleteAccount` :306 menolak hapus akun yang sudah dipakai baris jurnal terukur, dan `accountUsability` :329 adalah gerbang butir 12 — rekening pribadi dan prive ditolak untuk tanggal/entitas PT lengkap dengan alasannya.
- **Jurnal** (`ledgerMath.ts`, 458 baris): `entryProblems` :144 + `canPostEntry` :196 menampung semua penolakan (tidak seimbang, dua entitas dalam satu jurnal, tanggal di luar periode entitas, periode terkunci, nomor bukti kembar); `buildAggregateEntry` :382 memakai id `agg_<entity>_<YYYY-MM>` dan `buildOpeningEntry` :425 memakai `opn_<entity>_<date>` sehingga satu bulan hanya punya satu baris rekap dan satu jurnal saldo awal; `reverseLedgerEntry` (`ledgerStorage.ts:131`) mencatat jurnal pembalik, bukan menghapus aslinya. Pembacaan saldo hanya lewat `postedEntries` :137, `balanceOf` :257, `buildLedger` :325.
- **Rekap bulanan** (`ledgerAggregates.ts`, 358 baris): `aggregateMonth` :204 menyusun satu jurnal dari transaksi POS, mutasi stok, shift, dan invoice pada bulan itu — penjualan periodik maupun perpetual, dan nilai yang sudah tercatat di jalur lain tidak ditulis dua kali; bulan di luar periode entitas tidak menghasilkan jurnal apa pun.
- **Transisi** (`transitionMath.ts`, 462 baris): `measureThroughDate` :64 menentukan sampai tanggal mana angka benar-benar terukur, `closingFigures` :105 menghitung aset bersih per hari terakhir entitas lama, `buildTransitionPlan` :302 memindahkan **hanya** saldo yang memang dialihkan dan menolak dua keadaan (modal saham > aset bersih; saldo rekening pribadi ikut sebagai modal). `SIMULATION_FIGURES` :441 memegang angka uji pemilik (kas 50 jt, persediaan 40 jt, peralatan 20 jt, akum. penyusutan 5 jt, utang usaha 15 jt → modal 90 jt) sebagai fixture, bukan sebagai bawaan produksi. `transitionActions.ts` menyusun pratinjau (`openingDraft` :129, `monthPreview` :211) dan baru menulis setelah pemilik konfirmasi (`postOpeningJournal` :150, `postMonthJournals` :267).
- **Laporan dibaca dari jurnal** (`ledgerReports.ts`, 721 baris): `buildIncomeStatement` :274, `buildBalanceSheet` :324, `buildEquityStatement` :384, `buildCashFlow` :475, `buildPeriodTrialBalance` :191, `buildAccountLedger` :576, `buildCombinedStatement` :623 (kolom Pra-PT / Pasca-PT / Total Gabungan Internal, dengan `GABUNGAN_WARNING` :602 sebagai satu-satunya sumber teks peringatan), `ptReportScope` :679 (laporan resmi PT hanya sah mulai tanggal transisi), `buildPeriodIndicators` :704. Baris laporan bertanda terhadap arah normal seksinya supaya akun kontra negatif dan persamaan neraca tetap pas; kolom debit/kredit hanya lewat `debitColumn` :179 / `creditColumn` :183.
- **Pajak per entitas** (`entityTaxConfig.ts`, 172 baris, murni): `taxPeriodsForYear` :81 membelah tahun transisi jadi dua segmen, `billingTariffForMonth` :131 memberi tarif + alasan (0 disertai keterangan bila tarif entitas belum diisi), `taxSeparationNotes` :147 menghasilkan kalimat pemisahan untuk layar dan cetak. Tarif berlaku dari `appliedTaxRatePercent` (`entityRegistry.ts:159`): `PP55_OP` memakai tarif final isian pemilik, `BADAN` memakai tarif badan isian pemilik, `BELUM_DISETTEL` = `null`. Tidak ada angka tarif yang ditulis di layar billing; `syncReturnWithMonthlyBillings` (`taxStorage.ts:500`) membaca tarif dari baris billing tahun itu, dengan jatuhnya ke `billingTariffForMonth`.
- **Berkas unduhan** (`ledgerReportDocument.ts` 358 baris murni + `ledgerReportExport.ts` 213 baris): satu objek `LedgerReportDocument` (`officialReportDocument` :225, `combinedReportDocument` :261, `trialBalanceDocument` :304, `journalDocument` :320, `accountLedgerDocument` :342) dipakai PDF :73, Excel :155, dan CSV :181 sehingga angka berkas sama dengan angka layar; `entityIdentityLines` :67 menulis "NPWP belum diisi" bila kosong dan `status` laporan resmi ikut turun menjadi "belum sah" beserta alasannya di `notes`. Hanya modul ekspor ini yang boleh memuat jsPDF/autoTable/XLSX.
- **Layarnya** (subfolder `src/components/reports/`, dipasang sebagai menu **Laporan Keuangan**, `LaporanKeuanganScreen.tsx:332-345`): Laba Rugi, Perubahan Modal, Neraca, Arus Kas, Neraca Saldo, Buku Besar, Jurnal Umum, Gabungan Internal, Laporan Resmi PT, Pengaturan Entitas (`EntitySettingsView.tsx`), Bagan Akun (`AccountChartView.tsx`), Penutupan & Transisi (`TransitionWizardView.tsx`), Input Data, Panduan; `ReportExportBar.tsx` memasang lima tombol unduh — tiga di `LedgerBooksView` (neraca saldo, buku besar, jurnal) dan dua di `LedgerReportsView` (laporan resmi PT, gabungan internal).
- Uji regresi: `npm run check:entity` — 14 seksi, 86 kasus (A–P): kepemilikan tanggal, pindah transisi berjejak, bagan akun per entitas, gerbang akun, gerbang jurnal, pembalikan, neraca awal dari angka simulasi, penolakan plan, saldo awal beku, rekap bulanan tanpa nilai dua kali, bulan di luar periode, laporan dari jurnal, kemurnian modul di Node, pemasangan layar, pajak per entitas, dan berkas unduhan.


---

## 9. Sinkronisasi realtime & ketahanan jaringan

Semua konstanta ada di `src/backend/pocketbaseBackend.ts`:
- Watchdog koneksi: `REALTIME_WATCHDOG_MS = 15000` :527 menentukan `realtimeConnected`; SSE mati ≥ `REALTIME_REVIVE_AFTER_MS = 30000` :528 → kanal dibangun ulang.
- Pemulihan sesi: `REAUTH_MIN_INTERVAL_MS = 30000` :229 — satu percobaan token baru per 30 detik, digabung bila banyak kanal gagal bersamaan; pemicunya `isSessionRejected()` (401/403 atau token kedaluwarsa).
- Antrean tulis ulang: `bejo_pos_outbox_queue_v1` :382, maksimum `MAX_OUTBOX_ENTRIES = 500` :383; yang diulang adalah gagal karena jaringan/401/403/408/429/5xx, yang dibuang hanya penolakan payload (400/404).
- Snapshot server **menggantikan** isi perangkat (termasuk saat kosong); yang belum terkirim dilindungi outbox, bukan oleh penyaringan kosong.
- Kunci localStorage tidak boleh menulis balik ke server bila datanya baru datang dari server (helper pajak meneruskan `fromCloud = true`).
- Caddy mengalir SSE dengan `flush_interval -1` supaya tidak ter-buffer.

---

## 10. Fitur lintas modul

- **Folder SPK bersama**: `src/utils/sharedFolderAccess.ts` memakai File System Access API; lokasi hanya dari record `settings/spk_lan_folder`, izin per perangkat (satu kali "Hubungkan Folder di Perangkat Ini"), label status hanya dari hasil ukur.
- **Cetak**: struk via `receiptPdf.ts` + `thermalPrinter.ts`; laporan/invoice/rekonsiliasi via `pdfExport.ts`, `invoicePdf.ts`, `reconciliationPdf.ts`; unduhan via `pdfDownload.ts`; Excel via `excelExport.ts`; QR via `qrcode`.
- **Situs publik**: `LandingPageEditorScreen.tsx` + `landing/` (hanya DEVELOPER), diterbitkan lewat `/api/landing/published`; media disimpan di koleksi `settings`/`landing`.
- **Marketing**: `marketingApi.ts` menyambung Meta (WhatsApp status ads), TikTok (infeed ads), Shopee (discovery ads) — kredensial lewat variabel lingkungan, tanpa nilai di repo.
- **Jurnal Google Sheet**: `@fortune-sheet` di layar, state sheet disimpan sebagai `data_grid` JSON (maks 5 MB, `journalApi.ts:346`/`:516`), mirror localStorage, baca = DEVELOPER/OWNER/ADMIN, tulis = DEVELOPER saja; renewal cookie Jurnal 8 jam tanpa password untuk sesi dashboard DEVELOPER.
- **Manajemen akun**: `/api/users` mencocokkan berurutan `legacyId` → username → email kredensial → email cadangan, lalu **adopsi** (id cloud, status aktif, dan password yang berlaku tidak pernah ditimpa data backup).
- **Diagnostik DEVELOPER**: `BackendDiagnosticsModal.tsx` + `/api/backend/*`.

---

## 11. Keamanan

- Password DEVELOPER stabil: hanya hash scrypt di `.env` (`DEV_PASSWORD_HASH`, dibuat lewat `npm run dev-password:set`); deploy tidak boleh mengubahnya kecuali `-RotateDevPassword` diminta.
- Login staf: urutan verifikasi di `server/staffStore.ts` `verifyStaffPassword` — **hash PocketBase-native dulu**, baru salinan plaintext warisan; keberhasilan login native mengosongkan `appPassword` lama.
- Rate limiting login (`checkLoginRate`), penolakan username `sync`/`langgo`/id `user_dev` (`ACCOUNT_RESERVED`, `USERNAME_RESERVED`, `PROFILE_DEVELOPER_LOCKED`).
- Aturan koleksi terkunci superuser untuk `users`, `app_users`, `jurnal_config`, `jurnal_sheets`.
- Dokumen blueprint hanya untuk DEVELOPER: ditegakkan di `server/blueprintApi.ts` (401/403) + `PRIVATE_API_PREFIXES`, bukan sekadar menyembunyinya di menu (`canDownloadBlueprint` di `src/utils/recordAccess.ts:75`).
- Wewenang per peran didaftar di `USER-ROLE.md` dan dijaga `npm run check:access` (seksi H) — dokumen itu tidak boleh lebih cantik daripada kode.
- Kunci buku ada di jurnal, bukan di layar: periode yang sudah ditutup ditolak `isDateLocked` (`entityRegistry.ts:484`, dipegang `entryProblems` `ledgerMath.ts:178`), satu jurnal tidak boleh mencampur dua entitas, dan jurnal yang sudah tercatat dibalik dengan **jurnal pembalik** (`reverseLedgerEntry`, `ledgerStorage.ts:131`) — baris asli tidak pernah dihapus. Rekap bulanan dan saldo awal memakai id tetap (`agg_<entity>_<YYYY-MM>`, `opn_<entity>_<date>`) sehingga bulan yang sama tidak bisa dibuat dua kali.
- Tidak ada rahasia di repo, log, chat, maupun dokumen ini.

---

## 12. Build & penyebaran

1. `npm run build` (menjalankan 5 penjaga `prebuild`; gagal = tidak ada artefak).
2. Deploy ke VPS hanya lewat `deploy/deploy-vps.ps1` (bukan `git pull` di `C:\bejo-pos`, bukan skrip baru). Skrip menyalin source dengan robocopy tanpa purge, memverifikasi `.env` tidak localhost, memeriksa bundel browser, probe broker sesi (401 = benar, 503 = kredensial sinkron ditolak), menolak deploy bila modul Marketing belum LIVE, lalu memverifikasi DNS/HTTPS.
3. Layanan Windows: BejoStikerPOS (Node), Caddy, PocketBase — NSSM `AppExit` bawaan Restart **ditambah** `sc.exe failure <svc> reset= 0 actions= restart/5000`. Catatan: `nssm set <svc> AppExit Default Restart` bukan perintah pengaturan (NSSM membacanya sebagai "kembalikan ke bawaan"); verifikasi dengan `nssm get <svc> AppExit`.
4. Pemeriksaan kondisi server hanya lewat `scripts/diagnose-live.ps1` (jalankan sebagai Administrator di VPS, tutup dengan `-RequireClean`). Skrip hanya membaca — kecuali `-ProbeSession` yang login sekali untuk membuktikan cookie sesi diterima rute private; rahasia keluar sebagai status terisi/kosong + panjang; tidak menyimpulkan isi berkas database tanpa pengukuran (`GET /api/logs/records` + retensi dari `GET /api/settings`). Seksi K mengukur gejala "401 di panel diagnostik": sumber secret sesi (urutan `APP_SESSION_SECRET` → `JOURNAL_SESSION_SECRET` → `PB_ADMIN_PASSWORD` → `REMOTE_ACCESS_PASS` seperti `server/devAuth.ts`), umur cookie dari `SESSION_TTL_SECONDS`, dan tiap rute private dinilai dari **body** jawabannya (`gerbang-sesi-benar` / `cookie-ditolak` / `cookie-tidak-terkirim` / `rute-tidak-ada` / `ditahan-sebelum-express` / `rute-terbuka-tanpa-sesi` hanya bila body-nya JSON, `bukan-jawaban-api` bila 200 tanpa JSON). Body respons error dibaca dari `$_.ErrorDetails.Message` lebih dulu (`Resolve-ResponseErrorBody`) karena stream sudah dihabiskan `Invoke-WebRequest` di PowerShell 5.1. Cookie **hanya** dikirim lewat `-WebSession` (`WebRequestSession` dari hasil login dipakai untuk login dan seluruh probe, seperti browser): header `Cookie` manual dibuang PowerShell 5.1 sebelum permintaan berangkat — terukur dengan server echo (`-Headers` → `cookieReceived=null`, `-WebSession` → cookie diterima) — jadi probe mengembalikan `CookieSent`/`CookieCount` dan penilai tidak boleh menyebut "cookie ditolak" tanpa bukti terkirim; `/api/auth/me` ikut probe untuk membuktikan sesi yang sama dikenali server. Ikatan aturan firewall dibaca dari **semua** kolom yang namanya mengandung ikatan (`Get-FwBindingParts` + `$FW_BINDING_PROPERTY_PATTERN`), bukan satu kolom, karena nama kolom tebakan sudah tiga kali menghasilkan FAIL palsu.

---

## 13. Penjaga otomatis (build guard)

18 berkas `scripts/check-*`; 5 berjalan otomatis di `prebuild`:

| Perintah | Berkas | Menjaga |
|---|---|---|
| `check:brand` | `check-brand.mjs` | nama aplikasi lama tidak kembali ke source, dokumen, atau skrip |
| `check:version` | `check-version.mjs` | versi `package.json` = `APP_VERSION` |
| `check:paths` | `check-path-fabrication.mjs` | lokasi folder toko tidak muncul sebagai konstanta di `src/` |
| `check:copy` / `check:copy:strict` | `check-ui-language.mjs` | istilah programmer, kalimat > 130 karakter, klaim status teks tetap |
| `check:ps1` | `check-powershell-syntax.mjs` | tiap `.ps1` di `deploy/` + `scripts/` bisa dimuat parser |

Penjaga regresi non-prebuild: `check:users` (`check-staff-credential.mts` kasus G/H/I/J + `check-credential-policy.mts`), `check:trend` (kasus 9–17 dekomposisi aset), `check:agent-period`, `check:reconciliation`, `check:tax-years` (daftar tahun pajak: bawaan 2022–2028, aturan tambah/kurang, cermin + event, kanal `settings/tax_years`, `fromCloud`, dan layar tahun wajib membaca daftar bukan angka tetap), `check:backup` (cakupan berkas cadangan: registry 39 domain, semua cermin localStorage di `src/` tergolong, akun login keluar, jalur tulis server per domain nyata, dan isi layar berasal dari registry), `check:journal`, `check:invoice` (22 kasus status termin invoice: fixture pelunasan penuh `INV/BJP/2026/11/0002` seluruh termin Lunas, dokumen penuh tanpa flag per baris, teks "Pelunasan" tidak mengubah hasil, pelunasan belum dibayar tidak menulis "Belum", uang sebagian menutup dari depan, invoice per tahap, baris lunas mengalahkan posisi, `/PELUNASAN` mengenai tahap terakhir skema DP tiga tahap, tabel `resolveStageSuffix`, penggabungan riwayat + tanpa duplikat + invoice satu tahap hanya miliknya, sisa efektif tidak berubah, dan pemindaian sumber bahwa layar/PDF tidak menulis ulang aturannya), `check:entity` (14 seksi, 86 kasus: kepemilikan tanggal, bagan akun per entitas, gerbang akun & jurnal, neraca awal dari angka simulasi pemilik, penolakan plan, saldo awal dan rekap bulanan tidak dihitung dua kali, laporan dibaca dari jurnal, kemurnian modul di Node, pemasangan layar, pajak per entitas tanpa tarif karangan, berkas unduhan sama dengan layar), `check:access` (seksi A–G mengunci delapan aturan wewenang + gerbang tiap layar + label yang menyesatkan; seksi H membandingkan setiap sel tabel `USER-ROLE.md` dengan hasil fungsi aslinya, `allowed()` Navbar yang dievaluasi dari sumbernya, dan gerbang pasang layar `App.tsx`), `check:branding`, `check:blueprint` (dokumen blueprint: keberadaan, gerbang DEVELOPER di UI & server, tidak ada rahasia di isi, dan sembilan angka struktural harus sama dengan hasil ukur repo — penjaga ini yang menegur kalau dokumennya tertinggal).

Kebijakan proyek: kesalahan yang berulang diubah menjadi penjaga + aturan di `AGENTS.md`, bukan perbaikan satu kali. Setiap penambahan aturan hitung → tambahkan kasusnya di berkas `check-*` yang bersangkutan, jangan menguji manual saja.

---

## 14. Aturan wajib saat mengubah aplikasi

- Satu update = satu kenaikan versi (`npm run version:bump`; `version:minor` untuk fitur/modul baru; `version:major` hanya setelah rekomendasi disetujui).
- Tambah koleksi → perbarui `scripts/create-pocketbase-collections.mjs`, daftar koleksi di `scripts/diagnose-live.ps1` seksi F, dan `deploy/finish-deploy.ps1`. Tanpa itu tulis cloud gagal diam-diam.
- Tambah kanal realtime → pasang di efek langganan `App.tsx`, jangan di layar.
- Aturan hitung hanya satu tempat; layar, riwayat, dan PDF memanggil fungsi yang sama.
- Ubah wewenang peran: edit fungsi di `src/utils/recordAccess.ts` (atau `journalAccessPolicy.ts`) → samakan baris yang berubah di `USER-ROLE.md` → `npm run check:access`. Jangan menulis `role === '…'` baru di dalam komponen; penjaga tidak akan melihatnya dan wewenang jadi berbeda antar layar.
- Teks operator: Indonesia awam, pendek, fakta tidak dibuang, tidak mengarang status/kecepatan/lokasi/nama author.
- Berkas `.ps1` tidak diperiksa `tsc`/Vite; kode Node di dalam here-string `@' ... '@` wajib diperiksa terpisah dengan `node --check`.
- Perubahan struktural (rute/modul/tab/koleksi/kanal realtime/penjaga/perintah npm baru) → dokumen blueprint wajib ditinjau dan angkanya diperbarui; `npm run check:blueprint` akan gagal kalau tidak.

---

## 15. Dokumen blueprint & unduhannya

Berkas yang sedang Anda baca ini adalah bagian dari sistem, bukan catatan sampingan.

- Isi dokumen dibaca dari disk server lewat `server/blueprintApi.ts` (`readBlueprintDocument()`, path dari `process.cwd()` + konstanta `BLUEPRINT_FILE_NAME`, bukan dari permintaan). Browser mengambilnya di `src/lib/blueprint.ts` (`fetchBlueprintDocument()`), lalu `src/utils/blueprintDownload.ts` menghasilkan `.md` (Blob isi persis) atau `.pdf` (jsPDF A4, teks kaki berisi judul + versi + nomor halaman per lembar). Susunan halamannya dihitung lebih dulu di `src/utils/blueprintPdfPlan.ts` (`planBlueprintPdf()` — berkas murni, tanpa jsPDF dan tanpa browser, supaya hasilnya bisa diperiksa penjaga): penanda Markdown dibuang, baris tabel diratakan, judul jadi teks tebal, blok angka struktural yang ditandai komentar HTML tidak dicetak ulang, dan tanda yang tidak punya hurufnya di Helvetica (→ − Σ ≤ ≥ ∞) diganti padanan ASCII.
- Gerbang ada di dua tempat dan keduanya wajib: `canDownloadBlueprint(role)` di `src/utils/recordAccess.ts:75` (DEVELOPER saja) untuk UI, dan pemeriksaan `session.role` di modul server untuk tegakan sebenarnya. Rutenya ikut masuk `PRIVATE_API_PREFIXES` (`server.ts:174`) sehingga tanpa sesi dashboard jawabannya 401.
- Tempat unduh: Pengaturan toko → **Backup Data** → kartu "Master Prompt & Blueprint Arsitektur Aplikasi", dua tombol (`.md` dan `.pdf`). Tab ini memang hanya tampil untuk DEVELOPER.
- Alur penjaga: `npm run check:blueprint` mengukur rute API, modul server, tab, koleksi, kanal realtime, cermin localStorage, berkas penjaga, dan perintah npm dari repo, lalu membandingkannya dengan blok angka struktural di awal dokumen (blok yang ditandai komentar HTML khusus, sehingga tidak tercetak di PDF). Beda angka = penjaga gagal = dokumen perlu disamakan.

---

## 16. PROMPT SIAP PAKAI

MULAI PROMPT

Bangun aplikasi **BEJO Digital Print** (versi acuan 4.14.0): POS toko cetak digital satu pintu, React 19 + TypeScript + Vite 6 + Tailwind v4 di browser, Express 4 di server, PocketBase 0.28.1 sebagai basis data dan kanal realtime, Caddy reverse proxy + HTTPS, NSSM di Windows Server. Semua bahasa antarmuka Indonesia awam, pendek, tanpa istilah programmer, dan tanpa klaim status yang dikarang.

Struktur wajib:
- 1 modul frontend = 1 tab dari 12 tab (`pos`, `inventory`, `stock`, `agen`, `shift`, `spk`, `transactions`, `invoices`, `tax`, `marketing`, `customers`, `landing_editor`); tab dirender dari `src/App.tsx` dan difilter oleh fungsi `allowed(id)` di `src/components/Navbar.tsx`. Peran: DEVELOPER, OWNER, ADMIN, AGEN, KASIR, SPK. Wewenang per peran hidup di fungsi tunggal `src/utils/recordAccess.ts` + `src/utils/journalAccessPolicy.ts`, didaftar di `USER-ROLE.md`, dan tiap sel tabelnya dibandingkan penjaga `check:access` dengan kode (termasuk SPK: Katalog hanya melihat + Laporan hanya menu Laporan Penjualan, dengan seluruh format laporan tetap terbuka).
- Server: `server.ts` (21 rute + wildcard SPA) + 9 modul rute (`journalApi`, `marketingApi`, `userAdmin`, `posAuth`, `devAuth`, `landingApi`, `pbSession`, `brandingApi`, `blueprintApi`) + 2 modul layanan (`staffStore`, `passwordHash`) = 54 rute API.
- Data: 31 koleksi dari `scripts/create-pocketbase-collections.mjs` + 2 koleksi Jurnal yang dibuat saat boot (total 33). Setiap koleksi membawa `legacyId` dan kolom JSON `data`; `users`, `app_users`, `jurnal_config`, `jurnal_sheets` ber-aturan superuser.
- Cloud client: **satu** berkas (`src/backend/pocketbaseBackend.ts`) memuat 39 kanal langganan, watchdog 15 detik, revive SSE 30 detik, reauth minimal 30 detik, outbox `bejo_pos_outbox_queue_v1` maksimum 500 entri, cermin 42 kunci localStorage `bejo_pos_*` di seluruh `src/`, dan Mode Lokal dengan IndexedDB. Komponen tidak boleh memanggil SDK PocketBase langsung dan tidak boleh membuat langganan sendiri.
- Cadangan: registry 39 domain (`src/utils/backupDomains.ts:81`) — payload, pratinjau, pemulihan perangkat, dan kirim ke server semuanya berputar dari daftar itu; akun login staf (nama masuk + kata sandi) tidak pernah ikut.

Mesin perhitungan (satu aturan, dipakai UI dan ekspor bersama):
- Aset: `assetTrend.ts` (nilai kini = Σ modal × stok, garis tren rekonstruksi mundur maks 1460 hari, bucket HARIAN/MINGGUAN/BULANAN) dan `assetAdjustments.ts` (dua ledger; efek harga `(cBaru−cLama)×stokLama` + efek stok `cBaru×(stokBaru−stokLama)`; baris nol tidak ditulis).
- Rekonsiliasi: `reconciliationMath.ts` (varians A−B, komparatif B−A, tiap kolom dinilai terpisah, persen berbasis A dan null bila A=0, sifat baris PENDAPATAN/BIAYA/PERBANDINGAN, identitas `good+bad+match+neutral = countedRows`).
- Pajak: `taxStorage.ts` + `taxBillingMath.ts` + `types/tax.ts` (lapisan UU HPP 5/15/25/30/35%, PTKP 11 status mulai TK/0 = 54 juta, PPh Final 0,5% dengan dua dasar DPP — bruto penuh atau omzet di atas 500 juta/tahun, NPPN, pembukuan, PPh 25 = (utang − kredit PPh 21)/12, PKP).
- Stok/HPP: `stockUtils.ts` (`hargaKulak ÷ qtyPerRollPak`, HPP penjualan termasuk m², rumus stok bahan, pinjam/pulang agen).
- Invoice: `invoiceStorage.ts` (bruto = kuantitas × harga, PPN 11%, DP 50%, nomor `{INV|PI}/{pref}/{YYYY}/{MM}/{seq4}`) dan `formatters.ts` (`BS{YYYY}/{MM}/{seq}`, uang tunai efektif = `min(tunai, total − transfer − qris)`).
- Periode rekap: `agentHistoryPeriod.ts` (kunci `YYYY-MM-DD`, rentang inklusif, hanya satu predikat untuk daftar/pratinjau/PDF).
- Kredensial: `credentialPolicy.ts` (minimal 10 karakter, huruf + angka, bukan password publik, bukan awalan username; sementara minimal 6; CSPRNG generator).
- Muatan cloud: `dbSanitize.ts` (`BINARY_MAX_CHARS` 50.000; `LOGO_MAX_CHARS` 400.000 khusus `logoUrl`) + `storeLogoImage.ts` (tangga 256/192/128 px × 0,9→0,6, target ≤ 200.000 karakter, simpan dibatalkan bila masih besar).
- Pembukuan dua entitas: `entityRegistry.ts` (tanggal milik entitas mana, era Pra-PT/Pasca-PT, kunci periode; `2026-07-01` dan `2022-01-01` hanya hidup di berkas ini) + `accountChart.ts` (kode lama dipertahankan, akun standar PT ditambahkan, rekening pribadi diarsipkan dan prive dimatikan untuk tanggal PT lewat `accountUsability`) + `ledgerMath.ts`/`ledgerAggregates.ts` (jurnal berpasangan; rekap bulanan `agg_<entity>_<YYYY-MM>` dan saldo awal `opn_<entity>_<date>` idempoten) + `transitionMath.ts` (aset bersih hari terakhir entitas lama, hanya saldo yang benar-benar dialihkan, modal saham tidak boleh melebihi aset bersih) + `ledgerReports.ts` (seluruh laporan dibaca dari jurnal; baris bertanda terhadap arah normal seksinya) + `entityTaxConfig.ts` (tahun transisi terbelah dua, tarif dari isian pemilik, tidak ada angka tarif di layar) + `ledgerReportDocument.ts`/`ledgerReportExport.ts` (satu objek dokumen dipakai PDF, Excel, dan CSV).

Keamanan: hash scrypt untuk password DEVELOPER (tidak pernah plaintext, tidak dirotasi saat deploy), sesi cookie di server, broker token PocketBase di `server/pbSession.ts` dengan `PB_SYNC_*` (variabel berprefix `VITE_` tidak pernah dipakai untuk kredensial), pencocokan akun staf berurutan `legacyId` → username → email kredensial → email cadangan dengan adopsi (password cloud lama tidak pernah ditimpa), rate limit login, `/api/branding` sebagai satu-satunya rute publik pra-login (gagal = `200 {success:false}`), dan dokumen blueprint di `/api/blueprint` yang hanya dilayani untuk sesi DEVELOPER.

Penjaga: 17 `scripts/check-*`; yang wajib lulus saat build = brand, versi, lokasi folder fabrikasi, bahasa UI `--strict`, sintaks PowerShell. `check:blueprint` membandingkan angka struktural di dokumen dengan hasil ukur repo — perubahan struktur apa pun mewajibkan dokumen ini diperbarui. Tambah aturan baru = tambah kasus di berkas check terkait + tulis aturannya di `AGENTS.md`.

Ritme kerja: naikkan versi sekali per update lewat `npm run version:bump|minor|major`, jangan mengedit versi manual; build hanya jika `npm run build` lulus; deploy hanya lewat `deploy/deploy-vps.ps1` di VPS; pemeriksaan hanya lewat `scripts/diagnose-live.ps1` (tanpa skrip deploy/diagnostik baru, tanpa `git pull` di folder VPS).

SELESAI PROMPT
