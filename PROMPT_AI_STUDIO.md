# PROMPT UNTUK AI STUDIO — Modifikasi Tab Laporan + Redesain UI Laporan Keuangan (Bejo Stiker POS)

Tempelkan isi file ini (dari baris "MULAI PROMPT" sampai "SELESAI PROMPT") ke AI Studio.

---

## MULAI PROMPT

### Konteks
Repo: aplikasi React 19 + Vite + TypeScript "Bejo Stiker POS" (AI Studio applet).
Pekerjaan terdiri dari 2 bagian:
- **BAGIAN A — Struktur Tab Laporan**: buat tab navigasi baru **"Laporan"** berisi DUA jenis laporan: (1) **Laporan Penjualan** (seluruh isi tab lama `transactions` dipindahkan apa adanya) dan (2) **Laporan Keuangan** (BARU).
- **BAGIAN B — Redesain UI Laporan Keuangan**: tampilan diselaraskan dengan tab lain aplikasi (clean, profesional, seperti aplikasi pembukuan modern yang simple & minimalis) dan input data dibuat jauh lebih mudah (auto-save + form bergrup).

Catatan integrasi: key tab internal TETAP `'transactions'` (jangan ganti nama key). Yang berubah hanya label UI, isi sub-tab, dan rendering-nya.

### Pola UI WAJIB (agar selaras dengan tab lain, khususnya TransactionHistoryScreen)
- Container halaman: `w-full max-w-[1440px] mx-auto p-3 sm:p-5 space-y-4`
- Kartu: `bg-white rounded-2xl border border-slate-200 shadow-xs`
- Kartu header: ikon kotak berwarna + `<h1>` `text-xl font-black tracking-tight` + deskripsi `text-xs text-slate-500` + badge status
- Tab pil: wadah `flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit flex-wrap gap-1`; aktif `bg-slate-900 text-white shadow-xs`; tidak aktif `text-slate-600 hover:text-slate-900 hover:bg-slate-200/60`
- Tombol utama: `bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md`
- Kartu KPI: grid `grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4`, isi label kecil uppercase + nilai `font-mono font-black` + chip ikon berwarna
- Cetak: elemen kontrol diberi kelas `no-print`; wadah laporan diberi `print:border-0 print:rounded-none print:shadow-none`
- Ikon: `lucide-react`; format uang: `formatRupiah` dari `src/utils/formatters.ts`

---

## BAGIAN A — STRUKTUR TAB

### A1. FILE BARU: `src/utils/financialStorage.ts`
Penyimpanan input manual laporan keuangan. Isi persis:

```ts
/**
 * Penyimpanan pengaturan & input manual Laporan Keuangan.
 * Nilai-nilai awal (modal, utang, aset, prive, dsb.) diisi manual oleh user
 * dan disimpan di localStorage. Angka pendapatan/HPP/beban otomatis diambil
 * dari data transaksi & stok aplikasi, sehingga laporan bisa "diisi manual
 * atau mengambil dari data aplikasi toko".
 */

export interface FinancialSettings {
  entityName: string;        // Nama entitas pada kop laporan
  periodLabel: string;       // Label periode (opsional)
  openingCapital: number;    // Modal awal / ekuitas awal
  ownerDrawings: number;     // Prive / penarikan pribadi
  openingInventory: number;  // Persediaan awal
  closingInventory: number;  // Persediaan akhir
  accountsPayable: number;   // Utang usaha
  otherLiabilities: number;  // Utang lain-lain
  accountsReceivable: number;// Piutang usaha
  cashBalance: number;       // Kas & bank akhir (0 = dihitung otomatis)
  openingCash: number;       // Kas & bank awal
  fixedAssets: number;       // Aset tetap
  otherExpenses: number;     // Beban operasional tambahan
  notes: string;             // Catatan pembukuan
}

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  entityName: 'BEJO STIKER', periodLabel: '',
  openingCapital: 0, ownerDrawings: 0,
  openingInventory: 0, closingInventory: 0,
  accountsPayable: 0, otherLiabilities: 0, accountsReceivable: 0,
  cashBalance: 0, openingCash: 0, fixedAssets: 0,
  otherExpenses: 0, notes: '',
};

const STORAGE_KEY = 'bejo_laporan_keuangan_settings_v1';

export function getStoredFinancialSettings(): FinancialSettings {
  if (typeof window === 'undefined') return DEFAULT_FINANCIAL_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FINANCIAL_SETTINGS;
    return { ...DEFAULT_FINANCIAL_SETTINGS, ...(JSON.parse(raw) || {}) };
  } catch { return DEFAULT_FINANCIAL_SETTINGS; }
}

export function saveStoredFinancialSettings(settings: FinancialSettings): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* abaikan */ }
}
```

### A2. FILE BARU: `src/components/reports/LaporanScreen.tsx`
Wrapper tab "Laporan" dengan 2 sub-tab. Spesifikasi:
- Props: `transactions, stockTransactions, invoices, isStoreOnline?, storeName?, onPrintReceipt, products, suppliers, agents, categories, customers, productCategories, userRole?, shifts, onUpdateStockTransaction?, onDeleteStockTransaction?, onUpdateTransaction?, onDeleteTransaction?, financialSettings, onSaveFinancialSettings`
- State: `activeSubTab: 'penjualan' | 'keuangan'` (default `'penjualan'`)
- Header: judul "Pusat Laporan" + deskripsi + baris tombol sub-tab (ikon `Receipt` untuk Laporan Penjualan, `Landmark` untuk Laporan Keuangan). Sub-tab aktif = `bg-slate-900 text-white border-emerald-500`
- Konten: jika `penjualan` render `<TransactionHistoryScreen {...props Penjualan} />` (SEMUA props lama diteruskan apa adanya); jika `keuangan` render `<LaporanKeuanganScreen transactions stockTransactions shifts storeName settings={financialSettings} onSaveSettings={onSaveFinancialSettings} />`

### A3. FILE DIMODIFIKASI: `src/components/Navbar.tsx`
- Navigasi desktop: label tombol tab `transactions` → **"Laporan"** (sebelumnya "Laporan Penjualan"). Ikon `Receipt` tetap, key `'transactions'` tetap.
- Navigasi mobile (bottom bar): tetap menampilkan `<span className="text-[10px]">Laporan</span>`. Pastikan tag `</button>` utuh.

### A4. FILE DIMODIFIKASI: `src/App.tsx` (5 edit)
1. Ganti import: HAPUS `import { TransactionHistoryScreen } from './components/TransactionHistoryScreen';` → TAMBAH `import { LaporanScreen } from './components/reports/LaporanScreen';`
2. Tambah setelah import `./utils/storage`:
```ts
import {
  FinancialSettings,
  getStoredFinancialSettings,
  saveStoredFinancialSettings
} from './utils/financialStorage';
```
3. Tambah state setelah `const [transactions, ...] = useState<Transaction[]>(getStoredTransactions);`:
```ts
const [financialSettings, setFinancialSettings] = useState<FinancialSettings>(getStoredFinancialSettings);
```
4. Tambah handler setelah komentar `// Persist handlers (...)`:
```ts
const handleSaveFinancialSettings = (updated: FinancialSettings) => {
  setFinancialSettings(updated);
  saveStoredFinancialSettings(updated);
};
```
5. Ganti render `{currentTab === 'transactions' && (...)}`: ganti `<TransactionHistoryScreen ... />` menjadi:
```tsx
{currentTab === 'transactions' && (userRole === 'DEVELOPER' || userRole === 'OWNER' || userRole === 'ADMIN') && (
  <LaporanScreen
    transactions={transactions}
    stockTransactions={stockTransactions}
    invoices={invoices}
    isStoreOnline={storeInfo.storeStatus === 'ONLINE'}
    storeName={storeInfo.storeName}
    onPrintReceipt={handlePrintReceiptDirect}
    products={products} suppliers={suppliers} agents={agents}
    categories={categories} customers={customers}
    productCategories={productCategories} userRole={userRole}
    shifts={pastShifts}
    onUpdateStockTransaction={handleUpdateStockTransaction}
    onDeleteStockTransaction={handleDeleteStockTransaction}
    onUpdateTransaction={handleUpdateTransaction}
    onDeleteTransaction={handleDeleteTransaction}
    financialSettings={financialSettings}
    onSaveFinancialSettings={handleSaveFinancialSettings}
  />
)}
```

---

## BAGIAN B — REDESAIN UI LAPORAN KEUANGAN

### B1. FILE BARU: `src/components/reports/LaporanKeuanganScreen.tsx`

**Props**: `{ transactions: Transaction[]; stockTransactions: StockTransaction[]; shifts: Shift[]; storeName?: string; settings: FinancialSettings; onSaveSettings: (s: FinancialSettings) => void }`

**State**: `activeReport` (default `'laba_rugi'`), `draft` (dari `settings`), `fromDate`/`toDate` (default **bulan lalu**).

**AUTO-SAVE (wajib)**: `useEffect(() => { onSaveSettings(draft); }, [draft]);` — tidak ada tombol Simpan; tombol "Kosongkan" memakai `window.confirm` lalu `setDraft({...DEFAULT_FINANCIAL_SETTINGS})`.

**Helper**: `withinRange(dateStr, from, to)` (bandingkan `dateStr.slice(0,10)` string YYYY-MM-DD), `prevMonthRange()`.

**Perhitungan otomatis (SISTEM AKRUAL) dari data aplikasi**:
- `revenue` = Σ `transaction.total` pada periode; `qtySold` = Σ `totalQty`; `txCount`
- `cashIn` = Σ `paymentMethods.cash + transfer + qris`
- `purchases` = Σ `totalPrice` item `StockTransaction.type === 'PEMBELIAN'` (+ `shippingCost`) pada periode
- `hpp` = `openingInventory` + `totalPurchases` − `closingInventory`
- `operationalFromShifts` = Σ `shift.operationalExpenses` pada periode; `totalExpenses` = itu + `otherExpenses`
- `grossProfit` = revenue − hpp; `netProfit` = grossProfit − totalExpenses
- `endingCapital` = `openingCapital` + netProfit − `ownerDrawings`
- Arus kas: masuk = `cashIn`; keluar = `totalPurchases + operationalFromShifts + otherExpenses`; bersih = selisih
- `computedCash` = `cashBalance > 0 ? cashBalance : openingCash + netCashFlow`
- Neraca: `totalAssets` = computedCash + piutang + persediaan akhir + aset tetap; `totalLiabilities` = utang usaha + utang lain; `equity` = endingCapital; `balanceDiff`, `isBalanced = |balanceDiff| <= 1`
- Semua dibungkus `useMemo` dengan dependency `[transactions, stockTransactions, shifts, fromDate, toDate, settings]`

**Layout halaman (urut dari atas)**:
1. **Kartu Header** (`no-print`, kartu putih pola aplikasi): ikon kotak `bg-emerald-600 text-white rounded-xl w-12 h-12` (`Landmark`), judul `LAPORAN KEUANGAN & PEMBUKUAN` (`text-xl font-black tracking-tight`), deskripsi menyebut PSAK No.1/2015, badge hijau `CheckCircle2` "Sistem Akrual · Data Tersimpan Otomatis di Perangkat". Sisi kanan: kontrol periode dalam satu kotak `bg-slate-50 border rounded-xl` berisi ikon `CalendarDays` + `<input type="date">` (Dari) + teks "s.d." + `<input type="date">` (Sampai), lalu tombol **Cetak** (`Printer`, gaya tombol utama).
2. **4 Kartu KPI** (`no-print`, grid `grid-cols-2 xl:grid-cols-4`): **Pendapatan** (chip `bg-emerald-50 text-emerald-600`, ikon `TrendingUp`), **Laba Bersih** (ikon `CheckCircle2` hijau bila ≥0, `TriangleAlert` merah bila rugi), **Total Aset** (chip indigo, `Landmark`), **Saldo Kas & Bank** (chip sky; sub-teks "Neraca seimbang ✓" bila `isBalanced`, else "Selisih neraca …" chip amber). Tiap kartu: label uppercase, nilai `text-lg font-black font-mono`, sub-teks `text-[10px]`.
3. **Tab pil jenis laporan** (`no-print`): 7 tombol — `Laba Rugi` (`TrendingUp`), `Perubahan Modal` (`PencilLine`), `Neraca` (`Scale`), `Arus Kas` (`Banknote`), `Neraca Saldo` (`BookOpen`), `Input Data` (`Settings2`), `Panduan` (`Info`). Ikon aktif `text-emerald-300`.
4. **Wadah konten** kartu putih + `print:border-0 print:rounded-none print:shadow-none`.

**Sub-komponen wajib**:
- `Row({label, value, strong?, indent?, negative?})` — baris laporan `flex justify-between py-2.5`, border bawah tipis, `strong` = border atas tebal slate-900 + font extrabold, `negative` = teks rose bila nilai < 0.
- `KopLaporan({title, subtitle?})` — kop cetak: nama entitas `uppercase font-black`, subtitle kecil, judul laporan bold, baris "Untuk Periode {from} s.d. {to} — Sistem Akrual", dengan garis bawah `border-b-2 border-slate-800`.
- `FieldGroup({title, desc?, icon, iconChip, children})` — kartu `rounded-2xl border p-4` dengan header ikon berwarna + judul uppercase + deskripsi kecil.
- `RupiahField({label, hint?, value, onChange})` — input angka dengan prefix "Rp" absolute-left, `text-right font-mono font-semibold`, `bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-400`, plus hint `text-[10px] text-slate-400`.
- `TextField`, `AreaField` (textarea), `MiniStat({label, value, tone})` dengan tone `emerald|indigo|sky|rose|amber`.
- `NeracaSaldoRow({name, debit?, credit?})` — baris tabel zebra `odd:bg-slate-50/50 hover:bg-emerald-50/40`, tanda "—" bila 0.

**Isi tiap tampilan**:
- **Laba Rugi**: KopLaporan + Row Pendapatan → HPP → Laba Kotor (strong) → Beban Operasional → Laba Bersih (strong) + catatan kecil rumus HPP.
- **Perubahan Modal**: Modal Awal → (+) Laba Bersih → (−) Prive → Modal Akhir (strong).
- **Neraca**: 2 kartu berdampingan (`grid lg:grid-cols-2 gap-4`, tiap kartu `bg-slate-50/60` + header ikon): kiri "Aset (Aktiva)" (Kas & Bank, Piutang Usaha, Persediaan, Aset Tetap, Total Aset), kanan "Kewajiban & Ekuitas" (Utang Usaha, Utang Lain-lain, Total Kewajiban, Ekuitas, Total Kewajiban + Ekuitas). Di bawah: banner hijau (`CheckCircle2`) "Neraca seimbang…" bila `isBalanced`, atau banner kuning (`TriangleAlert`) berisi selisih + saran lengkapi tab **Input Data**.
- **Arus Kas**: 2 kartu — "Aktivitas Operasional" (Kas Masuk, Kas Keluar, Arus Kas Operasional Bersih strong) dan "Investasi, Pendanaan & Posisi Kas" (Investasi 0, Pendanaan 0, Kenaikan/Penurunan, Saldo Kas Awal, Saldo Kas Akhir strong).
- **Neraca Saldo**: tabel dalam `rounded-xl border` — header `bg-slate-100` kolom Nama Akun | Debit | Kredit; baris: Kas & Bank, Piutang Usaha, Persediaan Barang, Aset Tetap, Utang Usaha, Utang Lain-lain, Modal Usaha, Pendapatan Penjualan, HPP, Beban Operasional, Prive Pemilik.
- **Input Data** (bagian redesain inti): judul "Input Data Pembukuan" + badge hijau "Tersimpan Otomatis" (`Save`) + tombol "Kosongkan" (`RotateCcw`, rose). Dua chip penanda: hijau "Otomatis dari aplikasi: Pendapatan, HPP (Pembelian Bahan), Beban Shift" + kuning "Diisi manual: Modal, Persediaan, Piutang, Utang, Aset, Beban Lain". Lalu grid `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4` berisi **6 FieldGroup**:
  1. *Identitas & Modal* (`PencilLine`, indigo): Nama Entitas (TextField), Modal Awal (hint "Ekuitas pemilik di awal periode"), Prive.
  2. *Persediaan Barang* (`Boxes`, amber): Persediaan Awal, Persediaan Akhir.
  3. *Kas, Piutang & Aset* (`Wallet`, emerald): Kas & Bank (Awal, hint "Saldo awal untuk Laporan Arus Kas"), Kas & Bank (Akhir, hint "Kosongkan bila ingin dihitung otomatis"), Piutang Usaha, Aset Tetap.
  4. *Kewajiban (Utang)* (`ReceiptText`, rose): Utang Usaha (hint "Hutang dagang ke supplier"), Utang Lain-lain.
  5. *Beban Lain-Lain* (`TrendingUp`, sky): Beban Operasional Tambahan (hint "Sewa, listrik, gaji, dll").
  6. *Catatan Pembukuan* (`Info`, slate): Catatan (AreaField).
  Di bawah grid: 4 `MiniStat` — Laba Bersih, Modal Akhir, Total Aset, Status Neraca (Seimbang / Selisih …).
- **Panduan**: (a) Definisi PSAK No.1 Tahun 2015 + definisi Baridwan 2004 (buku *Intermediate Accounting*) + paragraf kewajiban laporan keuangan bagi pengusaha; (b) "Urutan Jenis Laporan Keuangan" sebagai 4 kartu grid (Laba Rugi, Perubahan Modal, Neraca, Arus Kas + deskripsi); (c) "Alur Membuat Laporan Keuangan (8 Langkah)" sebagai list bernomor bulat hitam: 1 Jurnal, 2 Buku Besar, 3 Neraca Saldo, 4 Jurnal Penyesuaian, 5 Neraca Lajur, 6 Membuat Laporan Keuangan, 7 Jurnal Penutup, 8 Neraca Saldo Setelah Penutupan; (d) kotak kuning "Catatan Penting": Gunakan Sistem Akrual, Catat Semua Pengeluaran & Pemasukan, Beri Penjelasan yang Detail, Patuhi Tenggat Waktu.

Ikon lucide yang dipakai: `Landmark, TrendingUp, PencilLine, Scale, Banknote, BookOpen, Settings2, Info, Printer, CalendarDays, CheckCircle2, TriangleAlert, Wallet, Boxes, ReceiptText, RotateCcw, Save`.

---

## YANG TIDAK BOLEH DIUBAH
- Key tab `'transactions'` dan union type tab di App.tsx & Navbar.tsx
- Isi/fitur komponen `TransactionHistoryScreen` (hanya dipindah sebagai sub-tab)
- Komponen lain (PosScreen, InventoryScreen, tax, invoices, spk, dll)

## VERIFIKASI WAJIB SETELAH EKSEKUSI
1. `npx tsc --noEmit` → exit 0 (tanpa error)
2. `npm run dev` → `http://localhost:3000` → login → klik tab **Laporan**
3. Sub-tab **Laporan Penjualan** tampil persis seperti sebelumnya
4. Sub-tab **Laporan Keuangan** menampilkan: kartu header, 4 KPI, 7 tab pil, dan konten laporan
5. Tab **Input Data**: isi salah satu kolom → refresh halaman → nilai tetap tersimpan (localStorage key `bejo_laporan_keuangan_settings_v1`), tanpa perlu menekan tombol simpan
6. Tombol **Cetak** menghasilkan halaman bersih (elemen `no-print` tidak tercetak)

## SELESAI PROMPT
