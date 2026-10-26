/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */

export const CODE_WATERMARK = 'Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!';

export type ProductCategory = 
  | 'bahan'
  | 'stiker_vinyl'
  | 'digital_printing'
  | 'laser_cutting'
  | 'paket'
  | 'production_supplies'
  | 'vinyl_meteran'
  | 'vinyl_roll'
  | 'vinyl_sticker'
  | (string & {});

export interface ProductCategoryItem {
  id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
}

export interface Product {
  id: string;
  code: string; // Kode SKU
  name: string; // Nama Produk / Jasa
  category: ProductCategory; // Kategori Produk
  imageUrl?: string; // Foto Produk
  hargaKulak?: number; // Harga Kulak (HPP Modal)
  hargaAgen?: number; // Harga Agen
  hargaGrosir?: number; // Harga Grosir
  hargaUmum?: number; // Harga Umum
  hargaMeterGrosir?: number; // Harga Meter Grosir
  hargaMeterUmum?: number; // Harga Meter Umum
  // Specific tiers for Production Supplies
  hargaPakGrosir?: number; // Harga per Pak Grosir
  hargaPakUmum?: number; // Harga per Pak Umum
  hargaEceranGrosir?: number; // Harga Eceran Grosir
  hargaEceranUmum?: number; // Harga Eceran Umum
  // Specific tiers for Paket
  hargaPaketGrosir?: number; // Harga Paket Grosir
  hargaPaketUmum?: number; // Harga Paket Umum
  minStock?: number; // Stok Minimal
  perRollPak?: string; // Per Roll / Pak
  perRollPakValue?: number; // Jumlah meter/lembar dalam 1 roll/pak
  isAssetToko?: boolean; // Khusus Digital Printing: Masuk perhitungan Aset Toko
  description?: string; // Deskripsi / Keterangan
  dimensions?: string; // e.g., "30x15", "1.52x50", "3mm 40x60"
  unit?: 'meter' | 'roll' | 'pcs' | 'lembar' | 'pak' | 'paket' | 'cm2' | string;
  printSaleMode?: 'meter' | 'lembar'; // Khusus Digital Printing: METER atau LEMBAR
  price: number; // Synced with hargaUmum / hargaPaketUmum / hargaEceranUmum
  costPrice: number; // Synced with hargaKulak
  stock: number;
  stockUnit?: string;
}

export interface CustomerCategory {
  id: string;
  name: string;
  discountPercent: number;
  color: string;
  minSpend?: number;
}

export interface Customer {
  id: string; // WhatsApp number
  phone: string;
  name: string;
  categoryId: string;
  createdAt: string;
  totalSpent?: number;
  transactionCount?: number;
  notes?: string;
  address?: string;
}

export interface CartItem {
  id: string;
  productId?: string;
  code: string;
  name: string;
  dimensions: string; // e.g., "30x15" or "1.52x50"
  qty: number;
  unit: string; // e.g., "x 1" or "x 10 meter"
  unitPrice: number;
  price?: number;
  totalPrice: number;
  category?: ProductCategory;
  notes?: string;
  saleType?: 'meter' | 'roll' | 'lembar' | 'supplies' | 'paket' | string;
  lengthMeters?: number;
  widthMeters?: number;
  itemCount?: number;
  formattedSpec?: string;
  suppliesPriceType?: 'eceran' | 'pak';
  isCustomPrice?: boolean;
  customPriceUsed?: number;
  width?: number;
  height?: number;
  length?: number;
  sqm?: number;
  spkId?: string;
  spkOrderNumber?: string;
  isOpenAccount?: boolean;
  openAccountCustomerId?: string;
  openAccountCustomerName?: string;
}

export interface CashierUser {
  id: string;
  name: string;
  shiftName: string; // e.g. "Shift 1", "Shift 2", "Shift 1 (Pagi)", "Shift 2 (Malam)", "Full Shift"
  phone?: string;
  role?: string;
  isActive: boolean;
  notes?: string;
}

export interface Shift {
  id: string;
  cashierName: string;
  shiftName?: string; // e.g. "Shift 1", "Shift 2"
  storeName: string;
  startTime: string;
  endTime?: string;
  startingCash: number;
  initialCash?: number;
  status: 'OPEN' | 'CLOSED';
  date?: string;
  closedAt?: string;
  isActive?: boolean;
  totalCashSales: number;
  totalTransferSales: number;
  totalQrisSales: number;
  transactionCount: number;
  operationalExpenses?: number;
  operationalNotes?: string;
  actualEndingCash?: number;
  actualCashInDrawer?: number;
  cashDifference?: number;
  notes?: string;
}

export interface Transaction {
  id: string; // e.g. "BS2026/07/0001"
  shiftId?: string;
  isBackdated?: boolean;
  cashierName: string;
  shiftName?: string; // e.g. "Shift 1", "Shift 2"
  storeName: string;
  date: string;
  time: string;
  timestamp: number;
  customer?: Customer;
  customerCategory?: string;
  items: CartItem[];
  totalQty: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethods: {
    cash: number;
    transfer: number;
    qris: number;
  };
  paidAmount: number;
  change: number;
  cashierNotes: string;
  notes?: string;
  spkId?: string;
  spkOrderNumber?: string;
  // Metadata Integrasi Invoice
  isInvoice?: boolean;
  invoiceDoc?: any;
  invoiceStatus?: InvoiceStatus;
  invoiceDocumentType?: InvoiceDocumentType;
  balanceDue?: number;
  projectTitle?: string;
  // Metadata Integrasi Open Account
  isOpenAccount?: boolean;
  openAccountCustomerId?: string;
  openAccountSpkIds?: string[];
  openAccountAdjustment?: number;
  openAccountAdjustmentReason?: string;
  openAccountNotes?: string;
  transactionType?: 'SPK Cetak' | 'Open Account' | 'Reguler (POS)' | 'Invoice B2B';
}

export type UserRole = 'DEVELOPER' | 'OWNER' | 'ADMIN' | 'AGEN' | 'KASIR' | 'SPK' | (string & {});

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  address?: string;
  category?: string;
  notes?: string;
  createdAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  address?: string;
  commissionRate?: string;
  notes?: string;
  createdAt?: string;
}

export type SpkRoleCategory = 'DESAINER' | 'OPERATOR_CETAK' | 'FINISHING' | 'KASIR_ADMIN' | 'SUPERVISOR';

export interface AppUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  isOnline?: boolean;
  lastActiveAt?: number;
  lastLoginAt?: number;
  spkRoleCategory?: SpkRoleCategory;
}

export type ActivityActionType = 
  | 'LOGIN'
  | 'LOGOUT'
  | 'TRANSACTION'
  | 'SHIFT_OPEN'
  | 'SHIFT_CLOSE'
  | 'SHIFT_DELETE'
  | 'SHIFT_CLEAR_ALL'
  | 'STOCK_MUTATION'
  | 'USER_MANAGEMENT'
  | 'STORE_SETTINGS'
  | 'SYSTEM';

export interface UserActivityLog {
  id: string;
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  actionType: ActivityActionType;
  actionTitle: string;
  details: string;
  timestamp: number;
  formattedDateTime: string;
}

export interface StockTransactionItem {
  id?: string;
  productId: string;
  productName: string;
  category?: string;
  code?: string;
  qty: number;
  price: number;
  totalPrice: number;
  unit?: string;
  notes?: string;
}

export interface StockTransaction {
  id: string; // e.g. "PB-260916-0001", "PG-260916-0001", or "STK_..."
  transactionNumber?: string;
  type: 'PEMBELIAN' | 'PENGAMBILAN';
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  timestamp: number;
  supplierName: string; // Nama Supplier (for Pembelian) or Nama Agen (for Pengambilan)
  items?: StockTransactionItem[]; // Multi-item products within this 1 transaction
  totalQty?: number;
  totalAmount?: number;
  shippingCost?: number; // Ongkos Kirim (Door to Door) untuk Pembelian Bahan
  notes?: string;
  isBackdated?: boolean;

  // Single-item compatibility fields:
  productId?: string;
  productName?: string;
  qty?: number;
  price?: number;
  totalPrice?: number;
}

export interface AgentNotification {
  id: string; // e.g. "notif_PG-AGEN-123456"
  orderId: string;
  orderType: 'PENGAMBILAN_BAHAN' | 'CETAK_AGEN';
  agentName: string;
  agentUsername?: string;
  totalQty: number;
  totalAmount: number;
  itemsCount: number;
  itemSummary?: string;
  items?: {
    productName: string;
    qty: number;
    unit: string;
    totalPrice: number;
  }[];
  date: string;
  time: string;
  timestamp: number;
  notes?: string;
  readBy?: string[]; // Array of user IDs who have seen/dismissed this notification
}

export interface AiInternalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  createdAt: number;
  senderId?: string;
  senderName?: string;
  senderUsername?: string;
  senderRole?: string;
  mentions?: string[]; // Tagged usernames e.g. ['admin', 'langgo', 'kasir']
  isAiResponseTo?: string;
  readBy?: string[];
}

export interface UserMentionNotification {
  id: string;
  messageId: string;
  senderName: string;
  senderUsername: string;
  senderRole: string;
  targetUsername: string; // User who was tagged with @userX
  content: string;
  timestamp: number;
  formattedTime: string;
  isRead: boolean;
}

export interface PrivateChatMessage {
  id: string;
  threadId: string; // e.g. "langgo_admin" (sorted alphabetical username thread ID)
  senderId?: string;
  senderUsername: string;
  senderName: string;
  recipientUsername: string;
  recipientName: string;
  content: string;
  timestamp: string;
  createdAt: number;
  isRead: boolean;
}

export interface BackendErrorItem {
  id: string;
  source: 'SERVER' | 'AI_API' | 'POCKETBASE' | 'CLIENT_CACHE' | 'NETWORK';
  title: string;
  message: string;
  code?: string;
  timestamp: number;
  formattedTime?: string;
  isResolved?: boolean;
  resolutionNote?: string;
}

export interface BackendDiagnostics {
  status: 'healthy' | 'warning' | 'error';
  uptimeSeconds: number;
  memoryUsageMb: number;
  nodeVersion: string;
  aiApiStatus: 'ready' | 'degraded' | 'unavailable';
  pocketbaseStatus: 'connected' | 'offline' | 'checking';
  activeErrors: BackendErrorItem[];
  recentFixLogs?: string[];
  lastChecked: number;
}

export interface BackendFixReport {
  success: boolean;
  message: string;
  fixedCount: number;
  fixedIssues: string[];
  diagnostics: Partial<BackendDiagnostics>;
  timestamp: number;
}

export interface StoreProfile {
  id: string; // e.g. "bejo_polsek" or "store_123"
  storeName: string;
  branch?: string;
  phone?: string;
  address?: string;
  receiptFooter?: string;
  logoUrl?: string;
  isMaster?: boolean; // Default true for BEJO Polsek
  canModifyMasterProducts?: boolean;
  storeStatus?: 'OFFLINE' | 'ONLINE';
  notes?: string;
  createdAt?: string;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface PrintSettings {
  paperSize: '80mm' | '58mm';
  defaultPrinter?: 'pos_80' | 'pos_58' | 'system_default' | 'inkjet_a4' | 'custom' | string;
  printerDeviceName?: string;
  printMarginMm?: number; // 0mm to 10mm
  autoPrintOnCheckout: boolean;
  autoPrintOnSuratJalan?: boolean;
  density: 'compact' | 'standard' | 'large';
  contrast: 'normal' | 'bold' | 'ultra-black';
  showLogo: boolean;
  showStoreHeader: boolean;
  showCustomerInfo: boolean;
  showQrCode: boolean;
  showFooterNotes: boolean;
  showCashierName: boolean;
  showCutLine: boolean;
  feedLines: number;
  customHeaderNote?: string;
  customFooterNote?: string;
}

// =========================================================================
// DIGITAL PRINTING & SPK WORK ORDER PIPELINE (TAHAP 1 - DEVELOPER ONLY)
// =========================================================================

export type SpkStatus =
  | 'MENUNGGU_SETTING'  // 1. Penerimaan File & Baru Masuk
  | 'SETTING_SELESAI'   // 2. Prepress / Layouting Selesai
  | 'SEDANG_CETAK'      // 3. Masuk Antrean & Sedang Cetak Mesin
  | 'FINISHING'         // 4. Proses Finishing (Laminasi, Cutting, Mata Ayam)
  | 'SIAP_AMBIL'        // 5. Selesai Produksi & Siap Bayar / Diambil
  | 'OPEN_ACCOUNT'      // 6. Rekening Terbuka / Open Account (Konsolidasi per Pelanggan)
  | 'SELESAI_LUNAS'     // 7. Sudah Masuk POS & Lunas
  | 'DIBATALKAN';       // Dibatalkan

export type SpkPriority = 'NORMAL' | 'URGENT' | 'HIGH';

export type MachineType = 
  | 'OUTDOOR_KONICA'
  | 'INDOOR_ROLAND'
  | 'UV_FLATBED'
  | 'DTF_TEXTILE'
  | 'LASER_ACRYLIC'
  | 'PLOTTER_CUTTING'
  | 'DIGITAL_A3_PLUS'
  | 'MANUAL_OTHER'
  | string;

export type MachineCategory = 'CETAK' | 'CUTTING' | 'FINISHING' | 'OTHER';

export interface MachineItem {
  id: string;
  name: string;
  category: MachineCategory;
  typeDescription: string;
  status: 'READY' | 'UNDER_MAINTENANCE';
  speed?: string;
  headSpec?: string;
  maxWidthMeters?: number;
  operatorDefault?: string;
  notes?: string;
  createdAt?: string;
  // Network / LAN Integration & Auto-detection
  ipAddress?: string; // e.g. "192.168.1.101"
  port?: number; // e.g. 9100 (RAW print), 8080, 80
  hostName?: string; // e.g. "RIP-KONICA-512I.local"
  sharedFolderLanPath?: string; // e.g. "\\192.168.1.101\HOTFOLDER_KONICA\"
  lanStatus?: 'ONLINE' | 'OFFLINE' | 'PRINTING' | 'CHECKING' | 'STANDBY';
  lastPingTime?: number;
  pingLatencyMs?: number;
  ripSoftware?: string; // e.g. "PhotoPrint 19", "VersaWorks 6", "Maintop 6.1"
  isAutoDetected?: boolean;
}

export interface SpkPrintFileAttachment {
  id: string;
  fileName: string;
  fileSize?: number; // in bytes
  fileType?: string;
  localPath?: string; // full shortcut path e.g. \\192.168.1.100\DATA_CETAK_BEJO\file.pdf or D:/DATA_CETAK_BEJO/file.pdf
  lanFolderUrl?: string; // UNC network folder e.g. \\SERVER-PRINT\DATA_CETAK\
  storageKey?: string; // IndexedDB key
  uploadedAt: number;
  uploadedBy?: string;
  originHostIp?: string;
}

export interface SpkFinishingItem {
  id: string;
  name: string;
  type: 'laminasi' | 'cutting' | 'mata_ayam' | 'selongsong' | 'lipat_lem' | 'custom';
  price: number;
  qty?: number;
  notes?: string;
}

export interface SpkDigitalPrintItem {
  id: string;
  jobName: string; // e.g. "Spanduk Warung Makan Bu Joko"
  saleMode?: 'meter' | 'lembar'; // Model perhitungan: per Meter atau per Lembar
  materialId?: string; // Product ID
  materialName: string; // e.g. "Flexi China 280g"
  lengthMeters: number; // Panjang dalam meter
  widthMeters: number; // Lebar dalam meter
  areaM2: number; // Panjang x Lebar x Qty
  qty: number;
  unitPrice: number; // Tarif per m2 / per lembar
  materialPriceTotal: number;
  finishings: SpkFinishingItem[];
  finishingPriceTotal: number;
  totalPrice: number;
  designFileUrl?: string;
  designFileName?: string;
  previewImageUrl?: string;
  printMachine?: MachineType;
  printMachines?: string[];
  colorProfile?: 'CMYK' | 'RGB';
  operatorNotes?: string;
  // Local Print File & Shortcut Integration
  printFile?: SpkPrintFileAttachment;
  printFiles?: SpkPrintFileAttachment[];
  printFileLocalPath?: string;
}

export interface SpkOrder {
  id: string; // e.g. "SPK-260930-0001"
  orderNumber: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  timestamp: number;
  deadlineDate?: string;
  deadlineTime?: string;
  priority: SpkPriority;
  status: SpkStatus;
  
  // Customer
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerCategory?: string;

  // Items
  items: SpkDigitalPrintItem[];
  totalQty: number;
  totalAreaM2: number;
  subtotal: number;
  discount: number;
  totalAmount: number;
  
  // Local Print File Attachment Shortcut at Order level
  printFile?: SpkPrintFileAttachment;
  printFiles?: SpkPrintFileAttachment[];
  printFileShortcut?: string;
  
  // Payment tracking
  dpPaid: number;
  remainingAmount: number;
  isPaid: boolean;
  paymentMethod?: 'CASH' | 'TRANSFER' | 'QRIS' | 'SPLIT' | 'UNPAID';
  
  // Assigned Operator / Machine
  designerName?: string;
  operatorName?: string;
  finishingPerson?: string;
  assignedMachine?: MachineType;
  assignedMachines?: string[];
  
  // Notes & History
  customerNotes?: string;
  internalNotes?: string;
  statusLogs: {
    status: SpkStatus;
    timestamp: number;
    formattedTime: string;
    changedBy: string;
    note?: string;
  }[];
  
  // Pos integration
  posTransactionId?: string;
  // Open Account integration
  isOpenAccount?: boolean;
  openAccountAt?: string;
  openAccountNotes?: string;
}

// Printing Reject Personal Record (Catatan Personal Gagal Produksi)
export type PrintingRejectReason = 'Adjustment' | 'Jamming' | 'Human Error';

export interface PrintingRejectRecord {
  id: string; // e.g. "REJ-261006-0001"
  userId: string; // ID personal user / operator (Private per user)
  userName: string; // Nama user
  userRole?: string; // Role user saat mencatat
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  timestamp: number;
  
  // Material details dari Katalog Produk (Kategori Bahan)
  materialId: string;
  materialCode?: string;
  materialName: string;
  unit: 'meter' | 'lembar' | 'pcs' | string; // per meter atau per lembar
  
  // Reject Quantity
  rejectQty: number; // e.g. 2.5 meter atau 3 lembar
  costPerUnit?: number; // HPP bahan per unit
  estimatedCostLoss?: number; // Kerugian estimasi HPP (rejectQty * costPerUnit)
  
  // Reason & details
  reason: PrintingRejectReason;
  reasonDetail?: string; // Penjelasan kendala
  
  // Context / Machine (Opsional)
  machineId?: string;
  machineName?: string;
  spkOrderNumber?: string; // No. SPK terkait jika ada
  notes?: string;
}

// Landing Page Configuration Types (Dynamic & Adaptive CMS)
export interface LandingBrandItem {
  id: string;
  name: string; // e.g. "DECOFIX", "CAR DIARY", "WT PREMIUM", "ORACAL", "DEREK", "SAICHOLITE", "DURATAC", "BRITE", "3M", "NANO GARD", "BLACK PROTECTOR"
  tagline: string;
  category: 'wrapping' | 'cutting' | 'reflective' | 'protection' | 'printing' | 'general';
  description: string;
  badge?: string;
  badgeColor?: string;
  isPopular?: boolean;
  isActive: boolean;
  features: string[];
  imageUrl?: string; // foto dokumentasi / swatch merk (rekomendasi 800 x 600 px)
}

export interface LandingServiceItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  iconName: 'scissors' | 'printer' | 'layers' | 'sparkles' | 'shield' | 'package';
  highlights: string[];
  ctaLabel?: string;
  isActive: boolean;
}

export interface LandingProductItem {
  id: string;
  name: string;
  brand: string;
  category: 'roll' | 'meteran' | 'print' | 'laser';
  unit: string; // e.g. "per meter", "per roll (50m)", "per cm²"
  priceEstimated: string; // e.g. "Mulai Rp 25.000 / m" atau "Rp 850.000 / roll"
  specs: string;
  description: string;
  badge?: string;
  isActive: boolean;
  imageUrl?: string; // foto produk (rekomendasi 800 x 800 px, rasio 1:1)
}

export interface LandingHeroConfig {
  badgeText: string;
  headline: string;
  subheadline: string;
  primaryCtaText: string;
  secondaryCtaText: string;
  bannerAnnouncement?: string;
}

export interface LandingContactConfig {
  whatsappNumber: string; // e.g. "6281234567890"
  whatsappMessageTemplate: string;
  storeAddress: string;
  phoneDisplay: string;
  operatingHours: string;
  googleMapsUrl?: string;
  emailDisplay?: string; // tampil di top bar & footer, mis. "order@bejostiker.id"
  factoryAddress?: string; // alamat workshop/pabrik (footer)
}

export interface LandingBenefitItem {
  title: string;
  description: string;
  icon: string;
}

// ===== Konten ala situs percetakan online (referensi: uprint.id) =====

/** Halaman internal landing page */
export type LandingPageKey = 'home' | 'about' | 'products' | 'clients' | 'contact' | 'blog';

/** Rute internal landing page (tanpa router eksternal) */
export interface LandingRoute {
  page: LandingPageKey;
  /** bila diisi, halaman produk menampilkan kategori tertentu */
  categoryKey?: string;
}

/** Slide banner utama (slider hero). Rekomendasi gambar: 1280 x 720 px (16:9) */
export interface LandingSlide {
  id: string;
  eyebrow: string; // label kecil di atas judul, mis. "TEMPLATE DESIGN"
  title: string;
  subtitle?: string; // tidak ditampilkan di banner, dipakai sebagai metadata
  ctaText?: string; // teks tombol pil di dalam banner
  imageUrl?: string;
  isActive: boolean;
}

/** Kartu produk pada slider kategori. Rekomendasi gambar: 640 x 1138 px (9:16) */
export interface LandingCategoryCard {
  id: string;
  label: string;
  imageUrl?: string;
  isActive: boolean;
}

/** Grup kategori utama (tab KEMASAN / STATIONERY / PROMOSI / SOUVENIR) */
export interface LandingCategoryGroup {
  id: string;
  key: string; // 'kemasan' | 'stationery' | 'promosi' | 'souvenir'
  title: string; // label tab, mis. "KEMASAN"
  heading: string; // judul seksi
  description: string; // paragraf pendukung
  cards: LandingCategoryCard[];
  isActive: boolean;
}

/** Tautan di dalam mega menu header */
export interface LandingMenuLink {
  id: string;
  label: string;
  categoryKey?: string; // membuka halaman produk dengan kategori terkait
  page?: LandingPageKey; // membuka halaman internal tertentu
}

/** Kolom mega menu header */
export interface LandingMenuColumn {
  id: string;
  heading: string;
  links: LandingMenuLink[];
}

/** Item menu utama header */
export interface LandingMenuItem {
  id: string;
  label: string;
  type: 'mega' | 'link';
  /** posisi di header: kiri (3 menu pertama) atau kanan */
  position: 'left' | 'right';
  page?: LandingPageKey; // tujuan bila type = 'link'
  columns?: LandingMenuColumn[]; // dipakai bila type = 'mega'
  isActive: boolean;
}

/** Promo template design (kartu besar di bawah slider kategori) */
export interface LandingTemplatePromo {
  id: string;
  eyebrow: string;
  title: string;
  ctaText: string;
  imageUrl?: string; // rekomendasi 1280 x 640 px
  isActive: boolean;
}

/** Poin keluhan pelanggan pada seksi "Problem Customer" */
export interface LandingProblemPoint {
  id: string;
  text: string;
  side: 'left' | 'right';
}

/** Seksi "Problem Customer" */
export interface LandingProblemConfig {
  title: string;
  imageUrl?: string; // ilustrasi line-art, rekomendasi 1024 x 1024 px
  points: LandingProblemPoint[];
  primaryCtaText: string;
  secondaryCtaText: string;
}

/** Statistik pada seksi "Mengapa Kami" */
export interface LandingStatItem {
  id: string;
  value: string; // mis. "20th"
  label: string;
  description: string;
  iconUrl?: string; // ikon lingkaran 200 x 200 px
  isActive: boolean;
}

/** Foto fasilitas produksi. Rekomendasi gambar: 640 x 480 px */
export interface LandingFacilityItem {
  id: string;
  title: string;
  imageUrl?: string;
  isActive: boolean;
}

/** Artikel blog / inspirasi cetak. Rekomendasi gambar: 640 x 420 px */
export interface LandingBlogPost {
  id: string;
  title: string;
  imageUrl?: string;
  url?: string;
  isActive: boolean;
}

/** Pertanyaan umum (FAQ) */
export interface LandingFaqItem {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
}

/** Tautan footer */
export interface LandingFooterLink {
  id: string;
  label: string;
  categoryKey?: string;
  page?: LandingPageKey;
}

/** Blok tautan footer (satu sub-judul + daftar tautan) */
export interface LandingFooterBlock {
  id: string;
  title?: string;
  links: LandingFooterLink[];
}

/** Kolom footer */
export interface LandingFooterColumn {
  id: string;
  heading: string;
  blocks: LandingFooterBlock[];
}

export interface LandingAboutStat {
  value: string; // e.g. "8+ Tahun"
  label: string;
}

/** Konten halaman / seksi "Tentang Kami" */
export interface LandingAboutConfig {
  eyebrow: string;
  title: string;
  intro: string; // paragraf pembuka singkat (ringkasan)
  paragraphs: string[]; // paragraf isi halaman Tentang Kami
  imageUrl?: string; // foto profil workshop/toko (rekomendasi 900 x 700 px)
  imageCaption?: string;
  stats: LandingAboutStat[];
  ctaText?: string;
}

/** Testimoni pelanggan (logo perusahaan: 200 x 200 px lingkaran) */
export interface LandingTestimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  logoUrl?: string;
  isActive: boolean;
}

/** Logo klien / pelanggan (rekomendasi 300 x 300 px / PNG transparan) */
export interface LandingClientLogo {
  id: string;
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  isActive: boolean;
}

/** Galeri foto workshop / hasil produksi (rekomendasi 800 x 600 px) */
export interface LandingGalleryItem {
  id: string;
  title: string;
  imageUrl?: string;
  description?: string;
  isActive: boolean;
}

/** Info cabang / kantor (untuk halaman Kontak) */
export interface LandingOffice {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
}

/** Media sosial / tautan eksternal */
export interface LandingSocialLink {
  id: string;
  label: string;
  url: string;
  isActive: boolean;
}

/** Identitas merek pada header & footer */
export interface LandingBrandingConfig {
  name: string; // teks logo jika gambar belum diunggah, mis. "bejo stiker"
  tagline: string; // mis. "percetakan online indonesia"
  logoUrl?: string; // rekomendasi 400 x 150 px (PNG transparan)
  faviconUrl?: string; // ikon tab browser, rekomendasi 64 x 64 px (PNG transparan)
  siteTitle?: string; // judul tab browser (tampil di sebelah favicon)
  metaDescription?: string; // deskripsi website (meta description), ideal 150-160 karakter
}

export interface LandingPageConfig {
  isPublished: boolean; // Slide button: true = PUBLISH (Tampilan Awal Aktif), false = ON HOLD
  lastModifiedAt: number;
  lastPublishedAt?: number;
  lastModifiedBy?: string;
  /** Judul H1 + paragraf pembuka di bawah slider banner */
  hero: LandingHeroConfig;
  brand: LandingBrandingConfig; // logo & tagline header/footer
  slides: LandingSlide[]; // slider banner utama (halaman Beranda)
  menu: LandingMenuItem[]; // navigasi header + mega menu
  categories: LandingCategoryGroup[]; // tab kategori + slider kartu
  templatePromos: LandingTemplatePromo[]; // seksi "Produk Template Design"
  problem: LandingProblemConfig; // seksi "Problem Customer"
  stats: LandingStatItem[]; // seksi "Mengapa Kami"
  facilities: LandingFacilityItem[]; // seksi "Fasilitas Produksi"
  blogPosts: LandingBlogPost[]; // seksi "Blog / Inspirasi Cetak"
  faqs: LandingFaqItem[]; // seksi FAQ
  contact: LandingContactConfig;
  about: LandingAboutConfig; // seksi & halaman Tentang Kami
  gallery: LandingGalleryItem[]; // dokumentasi workshop (halaman Tentang Kami)
  testimonials: LandingTestimonial[]; // testimoni (beranda & halaman Klien)
  clients: LandingClientLogo[]; // logo klien (beranda & halaman Klien)
  offices: LandingOffice[]; // alamat cabang (halaman Kontak)
  socials: LandingSocialLink[]; // media sosial (footer & halaman Kontak)
  footerColumns: LandingFooterColumn[]; // tautan footer multi-kolom
  footerNote?: string; // teks hak cipta tambahan
}

// =========================================================================
// INVOICE & PROFORMA INVOICE MANAGEMENT MODULE (DEVELOPER & ADMIN ONLY)
// =========================================================================

export type InvoiceDocumentType = 'PROFORMA' | 'COMMERCIAL';

export type InvoiceStatus = 
  | 'DRAFT'        // Draf internal
  | 'ISSUED'       // Diterbitkan (Belum ada pembayaran)
  | 'PARTIAL'      // DP terbayar / Terbayar sebagian
  | 'PAID'         // Lunas sepenuhnya
  | 'CANCELLED'    // Dibatalkan
  | 'CONVERTED'    // Proforma yang sudah dikonversi ke Invoice Final
  | 'EXPIRED';     // Kedaluwarsa (Proforma melewati masa berlaku)

export interface InvoiceItem {
  id: string;
  productId?: string;
  productCode?: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string; // 'pcs' | 'meter' | 'roll' | 'lembar' | 'paket'
  unitPrice: number;
  discountPercent: number; // 0 - 100
  discountAmount: number;
  isTaxable: boolean;
  totalPrice: number;
  sortOrder?: number;
}

export type InvoicePaymentType = 'DOWN_PAYMENT' | 'SETTLEMENT' | 'INSTALLMENT';

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  paymentType: InvoicePaymentType;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: 'TRANSFER' | 'CASH' | 'QRIS' | 'GIRO' | 'EDC' | string;
  referenceNumber?: string; // No. referensi bukti bank
  receivedBy: string; // Nama kasir/admin penerima
  notes?: string;
  createdAt: number;
}

export type InvoicePaymentMethodType = 'FULL' | 'DP' | 'TERMIN';

export interface InvoiceTerminSchedule {
  id: string;
  name: string; // e.g. "Termin 1", "Termin 2", "DP (Down Payment)", "Pelunasan"
  percentage: number; // 0 - 100
  amount: number; // Nominal Rupiah
  dueDate?: string; // YYYY-MM-DD
  notes?: string;
  isPaid?: boolean;
  status?: 'Belum' | 'Tagihan Ini' | 'Lunas' | string;
  invoiceNumber?: string;
}

export interface InvoicePaymentTypeInfo {
  type: InvoicePaymentMethodType; // 'FULL' | 'DP' | 'TERMIN'
  schedules: InvoiceTerminSchedule[];
}

export interface InvoiceCustomerInfo {
  customerId?: string; // ID dari master pelanggan POS
  name: string; // Nama Pelanggan / Instansi / Perusahaan
  pic?: string; // Nama Person In Charge
  npwp?: string; // NPWP Instansi
  address: string; // Alamat Penagihan / Pengiriman
  phone: string; // No. Telp / WhatsApp
  email?: string; // Alamat email instansi
}

export interface InvoiceBankAccount {
  id: string;
  bankName: string; // e.g. "BCA", "Mandiri", "BRI", "BNI"
  accountNumber: string; // e.g. "123-456-7890"
  accountHolder: string; // e.g. "Bejo Stiker & Printing"
  branch?: string;
  isDefault?: boolean;
}

export type CancellationReasonType = 
  | 'FORCE_MAJEURE'       // Bencana Alam / Regulasi / Perang (Pasal 1244-1245 KUHPerdata)
  | 'BREACH_OF_CONTRACT'  // Pembatalan Sepihak oleh Pelanggan (Breach of Contract / Denda Berlaku)
  | 'MUTUAL_AGREEMENT'    // Kesepakatan Bersama Kedua Belah Pihak
  | 'OTHER';              // Alasan Lainnya

export interface InvoiceCancellationInfo {
  cancelledAt: number; // Timestamp pembatalan
  cancelledBy: string; // Nama kasir/admin yang membatalkan
  reasonCategory: CancellationReasonType;
  reasonDetails: string; // Deskripsi rincian alasan pembatalan
  cancellationProofUrl?: string; // Link Drive surat / email pernyataan pembatalan pelanggan

  // Khusus Invoice Final (INV) - Penerbitan Credit Note (Nota Kredit):
  creditNoteNumber?: string; // e.g. "CN/BJP/2026/10/0001"
  creditNoteDate?: string; // YYYY-MM-DD
  creditNoteAmount?: number; // Nilai Credit Note untuk mendebit piutang (senilai invoice / sisa piutang)

  // Aspek Perpajakan (PPN / e-Faktur Pajak):
  taxCancellationRequired?: boolean; // Peringatan pembatalan Faktur Pajak melalui aplikasi e-Faktur Pajak resmi pemerintah
  taxReturnNumber?: string; // Kolom input: Nomor Nota Retur atau Nomor Nota Pembatalan dari pelanggan
  taxNotes?: string; // Catatan pembatalan faktur pajak

  // Aspek Pengembalian Dana (Refund):
  refundRequired?: boolean; // True jika pelanggan sudah membayar DP / lunas
  originalPaidAmount?: number; // Nominal yang sudah dibayar sebelum batal
  cancellationFee?: number; // Denda pembatalan / potongan biaya riil (jika breach of contract)
  refundAmount?: number; // Nominal dana yang dikembalikan riil ke pelanggan
  refundDate?: string; // YYYY-MM-DD
  refundMethod?: string; // 'TRANSFER' | 'CASH' | string
  refundBankTarget?: string; // Rekening tujuan pengembalian dana
  refundProofUrl?: string; // Link bukti transfer refund
}

export interface InvoiceStoreIdentity {
  storeName: string;
  tagline?: string;
  address: string;
  phone: string;
  email?: string;
  website?: string;
  npwp?: string;
  logoUrl?: string;
  bankAccounts: InvoiceBankAccount[];
  invoicePrefix: string; // Default: 'INV/BJP'
  proformaPrefix: string; // Default: 'PI/BJP'
  creditNotePrefix?: string; // Default: 'CN/BJP'
  defaultTerms?: string;
  authorizedSignerName?: string;
  authorizedSignerRole?: string;
}

export interface Invoice {
  id: string; // e.g. "INV-17109283749" atau UUID
  documentType: InvoiceDocumentType; // 'PROFORMA' atau 'COMMERCIAL'
  documentNumber: string; // e.g. "PI/BJP/2026/10/0001" atau "INV/BJP/2026/10/0001"
  status: InvoiceStatus;
  
  // Hubungan Proforma -> Commercial
  sourceProformaId?: string; // Jika ini adalah Invoice Final hasil konversi dari PI
  sourceProformaNumber?: string;
  convertedInvoiceId?: string; // Jika ini adalah PI yang sudah dikonversi ke INV
  convertedInvoiceNumber?: string;
  
  // Relasi Termin / DP Spesifik & Kontrak Induk
  terminStageId?: string; // ID schedule yang ditagih pada invoice ini
  terminStageName?: string; // e.g. "Termin 1", "Termin 2", "DP (Down Payment)", "Pelunasan"
  terminStageNumber?: number; // 1, 2, 3...
  terminPercentage?: number; // e.g. 40 (%)
  contractTotalAmount?: number; // Total nilai kontrak penuh (misal Rp 10.000.000)
  referenceDescription?: string; // e.g. "Pembayaran Termin 1 (40%) dari Total Kontrak"
  childInvoiceIds?: string[]; // Daftar ID Invoice termin yang telah diterbitkan dari PI ini
  childInvoiceNumbers?: string[]; // Daftar nomor invoice termin yang telah diterbitkan (e.g. INV/BJP/2026/10/0145/T1)
  
  // Rincian Pekerjaan
  projectTitle: string; // Judul Pekerjaan (e.g. "Branding Mobil Toko & Neon Box")
  issueDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD (Jatuh tempo pelunasan)
  expiryDate?: string; // YYYY-MM-DD (Masa berlaku penawaran harga - khusus PI)
  
  // Data Pelanggan / Instansi
  customer: InvoiceCustomerInfo;
  
  // Rincian Item Barang / Jasa
  items: InvoiceItem[];
  
  // Kalkulasi Finansial
  subtotal: number;
  discountAmount: number;
  taxableBase: number; // DPP (Dasar Pengenaan Pajak)
  taxRate: number; // e.g. 11 (%)
  taxAmount: number; // Nominal PPN
  grandTotal: number;
  
  // Down Payment & Pembayaran (Metode Pembayaran: FULL / DP / TERMIN)
  paymentScheme?: InvoicePaymentMethodType; // 'FULL' | 'DP' | 'TERMIN'
  paymentSchedules?: InvoiceTerminSchedule[]; // Rincian tahapan termin atau DP & Pelunasan
  dpRequiredPercent?: number; // Persentase instruksi DP (misal 50%)
  dpRequiredAmount?: number; // Nominal instruksi DP
  amountPaid: number; // Total akumulasi pembayaran yang sudah masuk
  balanceDue: number; // Sisa tagihan (grandTotal - amountPaid)
  payments: InvoicePayment[]; // Riwayat pembayaran detail
  
  // Mekanisme Pembatalan Dokumen & Credit Note (Nota Kredit)
  cancellation?: InvoiceCancellationInfo;

  // Catatan & Identitas Rekening
  paymentTerms?: string; // Instruksi pembayaran / Term of Payment
  notes?: string;
  bankAccounts?: InvoiceBankAccount[];
  
  // Pengesahan
  issuedBy: string; // Nama user penerbit
  issuedByRole?: string;
  
  createdAt: number;
  updatedAt: number;
}
