# DOKUMEN SPESIFIKASI TEKNIS SISTEM
## Modul Penerbitan Proforma Invoice (PI) & Invoice Komersial (INV)
### Aplikasi Point of Sale (POS) & Manajemen Toko Bejo Stiker

---

## 1. PENDAHULUAN & TUJUAN SISTEM
Modul Proforma Invoice (PI) dan Invoice Komersial (INV) dirancang untuk memfasilitasi transaksi bernilai menengah hingga besar (B2B, instansi pemerintah, korporasi swasta, komunitas, dan pelanggan retail grosir) pada aplikasi POS Bejo Stiker.

Dokumen ini membagi siklus penagihan menjadi dua tahap hukum dan akuntansi:
1. **Proforma Invoice (PI)**: Dokumen penawaran harga dan komitmen sementara yang mengikat secara komersial untuk pembayaran uang muka (Down Payment / DP) atau pemesanan sebelum produksi dimulai.
2. **Invoice Komersial Final (INV)**: Dokumen penagihan resmi yang sah secara hukum, akuntansi, dan perpajakan yang diterbitkan saat pekerjaan selesai/dikirimkan, mencatat rekonsiliasi DP dan sisa pelunasan.

---

## 2. ALUR KERJA (WORKFLOW)

### 2.1 Diagram Transisi Status
```
[ DRAF ]
   │
   ├─► Simpan & Tinjau Internal (Bisa diedit/dihapus bebas)
   │
   ▼
[ PROFORMA INVOICE (PI) ]  ──► Memiliki Watermark "PROFORMA", Expiry Date, Instruksi DP
   │
   ├─► Pembayaran Uang Muka (DP Recorded) -> Status: DP_PAID / PARTIAL
   │
   ├─► Transaksi Batal / Expired -> Status: CANCELLED / EXPIRED
   │
   ▼  [ AKSI: KONVERSI KE INVOICE FINAL ]
   │  - Duplikasi data item & histori DP
   │  - Alokasi Nomor Invoice Resmi Sekuensial: INV/BJP/TAHUN/BULAN/NOMOR
   │  - Status PI berubah menjadi CONVERTED
   │
[ INVOICE FINAL (INV) ]  ──► Status: ISSUED (Belum Lunas) / PAID (Lunas)
   │
   ├─► Pencatatan Pelunasan Sisa Tagihan (Final Payment)
   │
   ▼
[ LUNAS (PAID) & ARSIP ] ──► Dokumen Terkunci Permanen (Immutable)
```

### 2.2 Penjelasan Rinci Tiap Tahapan:
1. **Draf (Draft)**:
   - Kondisi awal saat kasir atau admin sedang menyusun rincian kebutuhan pelanggan.
   - Belum memiliki nomor resmi dan tidak mengikat persediaan stok atau kas.
2. **Proforma Invoice (PI)**:
   - Diterbitkan untuk dikirimkan kepada calon pembeli / instansi sebagai dasar penerbitan PO (*Purchase Order*) atau transfer Down Payment (DP).
   - Memiliki batas waktu kedaluwarsa (*Expiration Date*), karena fluktuasi harga bahan baku stiker/tinta cetak.
   - Dilengkapi visual watermark jelas `"PROFORMA"`.
   - Mengizinkan pencatatan pembayaran uang muka (*Down Payment*).
3. **Konversi Otomatis dari PI ke INV**:
   - Ketika produksi selesai atau barang siap dikirim, tombol **"Konversi ke Invoice Final"** ditekan.
   - Sistem secara atomik:
     * Menghasilkan Nomor Invoice resmi berformat sekuensial (contoh: `INV/BJP/2026/10/0001`).
     * Memungkinkan penyesuaian manual nomor invoice jika instansi klien memerlukan format khusus.
     * Membawa seluruh rincian barang, kuantitas, harga, diskon, PPN, dan riwayat pembayaran DP dari PI.
     * Menghubungkan ID referensi antara dokumen PI dan INV (*source_proforma_id*).
     * Mengubah status PI menjadi `CONVERTED` (tidak dapat dikonversi ulang untuk mencegah *double billing*).
4. **Invoice Komersial Final (INV)**:
   - Dokumen hukum final berlabel `"INVOICE / FAKTUR PENJUALAN"`.
   - Menampilkan total tagihan, riwayat DP yang telah masuk, sisa tagihan (*balance due*), rekening bank toko, dan tanda tangan/stempel.
   - Dokumen ini terkunci (*immutable*) dari perubahan item demi menjaga integritas pembukuan dan audit pajak.

---

## 3. SKEMA BASIS DATA (DATABASE SCHEMA)

Perancangan basis data menggunakan prinsip normalisasi relasional (3NF) yang aman dari anomali data serta siap diterapkan pada database SQL (PostgreSQL/MySQL) maupun dokumen Firestore:

### 3.1 Tabel `invoices` (Master Dokumen PI & INV)
Menyimpan header faktur, jenis dokumen, nomor resmi, dan identitas pihak terkait.

| Kolom | Tipe Data | Constraint | Keterangan |
|---|---|---|---|
| `id` | VARCHAR(64) | PRIMARY KEY | ID unik dokumen (e.g. UUID atau INV-TIMESTAMP) |
| `document_type` | VARCHAR(16) | NOT NULL, CHECK (document_type IN ('PROFORMA', 'COMMERCIAL')) | Status pembeda: PI vs INV |
| `document_number` | VARCHAR(64) | NOT NULL, UNIQUE | No. Dokumen: `PI/BJP/YYYY/MM/XXXX` atau `INV/BJP/YYYY/MM/XXXX` |
| `status` | VARCHAR(24) | NOT NULL | `DRAFT`, `ISSUED`, `PARTIAL`, `PAID`, `CANCELLED`, `CONVERTED`, `EXPIRED` |
| `source_proforma_id`| VARCHAR(64) | FOREIGN KEY REFERENCES `invoices(id)` NULL | Relasi ke PI asal jika hasil konversi |
| `project_title` | VARCHAR(255)| NOT NULL | Judul pekerjaan (e.g. "Branding Armada Truk Box") |
| `issue_date` | DATE | NOT NULL | Tanggal penerbitan dokumen |
| `due_date` | DATE | NULL | Tanggal jatuh tempo pelunasan |
| `expiry_date` | DATE | NULL | Batas waktu berlakunya penawaran harga (khusus PI) |
| `customer_id` | VARCHAR(64) | NULL | ID referensi pelanggan dari POS jika ada |
| `customer_name` | VARCHAR(150)| NOT NULL | Nama Pelanggan / Perusahaan / Instansi |
| `customer_pic` | VARCHAR(100)| NULL | Nama PIC (Person in Charge) instansi |
| `customer_npwp` | VARCHAR(32) | NULL | Nomor Pokok Wajib Pajak (NPWP) pembeli |
| `customer_address`| TEXT | NULL | Alamat pengiriman / penagihan |
| `customer_phone` | VARCHAR(30) | NOT NULL | Nomor telepon / WhatsApp aktif |
| `customer_email` | VARCHAR(100)| NULL | Email instansi |
| `subtotal` | DECIMAL(15,2)| NOT NULL DEFAULT 0 | Jumlah total harga kotor seluruh item |
| `discount_amount`| DECIMAL(15,2)| NOT NULL DEFAULT 0 | Total potongan harga (diskon) |
| `taxable_base` | DECIMAL(15,2)| NOT NULL DEFAULT 0 | Dasar Pengenaan Pajak (DPP) |
| `tax_rate` | DECIMAL(5,2) | NOT NULL DEFAULT 11.00 | Persentase PPN (default 11%) |
| `tax_amount` | DECIMAL(15,2)| NOT NULL DEFAULT 0 | Nilai nominal pajak PPN |
| `grand_total` | DECIMAL(15,2)| NOT NULL DEFAULT 0 | Total akhir tagihan |
| `dp_required` | DECIMAL(15,2)| NOT NULL DEFAULT 0 | Nilai minimal DP yang diinstruksikan (PI) |
| `amount_paid` | DECIMAL(15,2)| NOT NULL DEFAULT 0 | Total akumulasi pembayaran yang telah diterima |
| `balance_due` | DECIMAL(15,2)| NOT NULL DEFAULT 0 | Sisa pembayaran yang belum terlunasi |
| `payment_terms` | TEXT | NULL | Catatan instruksi pembayaran / Term of Payment |
| `bank_details` | TEXT | NULL | Rincian nomor rekening tujuan transfer |
| `notes` | TEXT | NULL | Syarat & ketentuan tambahan cetak |
| `created_by` | VARCHAR(64) | NOT NULL | User pembuat dokumen (Admin / Developer) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu pembuatan |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu pembaruan terakhir |

### 3.2 Tabel `invoice_items` (Rincian Produk & Pekerjaan)
Menyimpan rincian tiap barang, bahan baku stiker, jasa cetak, dan kalkulasi pajaknya.

| Kolom | Tipe Data | Constraint | Keterangan |
|---|---|---|---|
| `id` | VARCHAR(64) | PRIMARY KEY | ID unik item |
| `invoice_id` | VARCHAR(64) | NOT NULL, FOREIGN KEY REFERENCES `invoices(id)` ON DELETE CASCADE | Relasi ke master invoice |
| `product_id` | VARCHAR(64) | NULL | ID produk POS jika diambil dari katalog |
| `item_name` | VARCHAR(255)| NOT NULL | Nama barang / jasa cetak |
| `description` | TEXT | NULL | Spesifikasi teknis (e.g. "Bahan Oracal 651 Glossy, Finishing Die-Cut") |
| `quantity` | DECIMAL(10,2)| NOT NULL | Kuantitas (bisa desimal untuk meter) |
| `unit` | VARCHAR(30) | NOT NULL DEFAULT 'pcs' | Satuan (meter, roll, lembar, pcs, rim) |
| `unit_price` | DECIMAL(15,2)| NOT NULL | Harga satuan produk |
| `discount_percent`| DECIMAL(5,2)| NOT NULL DEFAULT 0 | Diskon per item (%) |
| `discount_amount` | DECIMAL(15,2)| NOT NULL DEFAULT 0 | Nilai nominal diskon per item |
| `is_taxable` | BOOLEAN | NOT NULL DEFAULT TRUE | Apakah item terkena PPN |
| `total_price` | DECIMAL(15,2)| NOT NULL | Total bersih per baris item |
| `sort_order` | INT | DEFAULT 0 | Urutan tampilan pada dokumen cetak |

### 3.3 Tabel `payment_history` (Riwayat Transaksi & Pembayaran)
Mencatat setiap transaksi pembayaran (baik uang muka DP pada fase PI maupun pelunasan akhir pada fase INV).

| Kolom | Tipe Data | Constraint | Keterangan |
|---|---|---|---|
| `id` | VARCHAR(64) | PRIMARY KEY | ID unik pembayaran (e.g. PAY-XXXX) |
| `invoice_id` | VARCHAR(64) | NOT NULL, FOREIGN KEY REFERENCES `invoices(id)` ON DELETE RESTRICT | Faktur yang dibayar |
| `payment_type` | VARCHAR(20) | NOT NULL | `DOWN_PAYMENT` (DP), `SETTLEMENT` (Pelunasan), `INSTALLMENT` (Cicilan) |
| `payment_date` | DATE | NOT NULL | Tanggal transaksi pembayaran diterima |
| `amount` | DECIMAL(15,2)| NOT NULL | Nominal uang yang dibayarkan |
| `payment_method`| VARCHAR(30) | NOT NULL | `TRANSFER`, `CASH`, `QRIS`, `GIRO`, `EDC` |
| `reference_number`| VARCHAR(100)| NULL | No. bukti transfer bank / no. referensi |
| `received_by` | VARCHAR(64) | NOT NULL | Nama kasir/admin penerima dana |
| `notes` | TEXT | NULL | Catatan pembayaran |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu pencatatan sistem |

### 3.4 Tabel `invoice_store_settings` (Identitas Penerbit Toko)
Menyimpan konfigurasi kop surat, logo, nomor rekening, dan stempel toko.

| Kolom | Tipe Data | Constraint | Keterangan |
|---|---|---|---|
| `id` | VARCHAR(32) | PRIMARY KEY DEFAULT 'primary' | ID tunggal konfigurasi |
| `store_name` | VARCHAR(150)| NOT NULL | Nama resmi toko (e.g. "BEJO STIKER & DIGITAL PRINTING") |
| `address` | TEXT | NOT NULL | Alamat fisik toko lengkap |
| `phone` | VARCHAR(50) | NOT NULL | No. Telepon / WhatsApp kantor |
| `email` | VARCHAR(100)| NULL | Email resmi toko |
| `website` | VARCHAR(100)| NULL | Website toko |
| `npwp` | VARCHAR(50) | NULL | NPWP toko penerbit |
| `logo_url` | TEXT | NULL | URL logo toko (resolusi tinggi) |
| `bank_accounts` | JSON / TEXT | NOT NULL | Daftar rekening pembayaran (Nama Bank, No Rek, Atas Nama) |
| `invoice_prefix`| VARCHAR(20) | DEFAULT 'INV/BJP' | Prefix penomoran Invoice komersial |
| `proforma_prefix`| VARCHAR(20) | DEFAULT 'PI/BJP' | Prefix penomoran Proforma |
| `default_terms` | TEXT | NULL | Syarat & ketentuan baku |

---

## 4. FITUR KEAMANAN & ATURAN VALIDASI BISNIS

1. **Prinsip Immutability Dokumen Final (Kerahasiaan & Kepatuhan Audit)**:
   - Dokumen berstatus `COMMERCIAL` (INV) yang telah diterbitkan (`ISSUED`) tidak boleh diubah kuantitas item, harga satuan, maupun pajaknya.
   - Apabila terdapat koreksi pesanan setelah INV terbit, mekanisme standar akuntansi adalah menerbitkan Dokumen Revisi (Rev-01) atau Nota Pembatalan, bukan mengedit langsung dokumen lama.
2. **Penomoran Sekuensial Bebas Celah (*Gap-Free Sequential Numbering*)**:
   - Nomor Invoice Komersial wajib terurut dan tidak boleh memiliki nomor ganda (`UNIQUE`).
   - Format standar: `INV/BJP/{TAHUN}/{BULAN}/{4_DIGIT_SEKUENSI}` (contoh: `INV/BJP/2026/10/0001`).
   - Dokumen Proforma Invoice (PI) dapat memiliki nomor tersendiri (`PI/BJP/{TAHUN}/{BULAN}/{NOMOR}`) yang tidak mempengaruhi urutan nomor faktur komersial.
3. **Pencegahan SQL Injection**:
   - Semua operasi database menggunakan *Parameterized Queries* / ORM / Prepared Statements.
   - Input disanitasi secara ketat di sisi server sebelum diproses ke storage.
4. **Validasi Finansial & Pajak**:
   - `amount_paid` tidak boleh melebihi `grand_total` (mencegah kelebihan bayar tanpa alokasi).
   - Perhitungan Pajak PPN mematuhi aturan pembulatan resmi: $\text{PPN} = \text{ROUND}(\text{DPP} \times \frac{\text{Tarif}}{100})$.
   - `balance_due` dihitung secara ketat oleh sistem: $\text{balance\_due} = \text{grand\_total} - \text{amount\_paid}$.
5. **Kontrol Akses Berbasis Peran (RBAC)**:
   - Modul Invoice & Proforma **hanya dapat diakses oleh peran DEVELOPER dan ADMIN**. Kasir biasa (KASIR), Operator Cetak (SPK), dan Agen tidak diberikan akses ke modul penerbitan invoice B2B ini demi mencegah kebocoran data harga pokok dan kesepakatan khusus korporat.

---

## 5. SPESIFIKASI FORMAT TAMPILAN & CETAK (PRINT-READY)

1. **Tata Letak Bersih & Hemat Tinta**:
   - Tata letak menggunakan ukuran kertas standar **A4 (210 x 297 mm)** dengan margin 12 mm.
   - Garis pembatas tipis (*hairline borders*) warna abu-abu netral (#cbd5e1 / #94a3b8) yang menghemat konsumsi tinta printer laser maupun inkjet.
2. **Watermark Khusus Proforma**:
   - Teks besar `"PROFORMA INVOICE"` berputar 35 derajat di bagian tengah latar belakang dokumen dengan opasitas 6% agar tidak mengganggu keterbacaan teks saat dicetak maupun difotokopi.
3. **Tipografi**:
   - Menggunakan font resmi **Google Sans** dengan hierarki tipografi yang konsisten: judul dokumen tebal (*bold*), label data semi-tebal, dan teks nilai angka monospaced/tabular untuk kerapian desimal nilai mata uang.
4. **Area Tanda Tangan & Stempel**:
   - Kolom tanda tangan penerima (pelanggan) dan pengesahan toko penerbit lengkap dengan cap digital atau stempel basah.
