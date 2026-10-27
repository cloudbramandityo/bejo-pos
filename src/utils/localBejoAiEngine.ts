/**
 * Coded by Langgo Bramandityo (Tech Lead & Master Developer).
 * SI BEJO AI - Real-Time Offline & Hybrid Local Intelligence Engine.
 * 
 * Provides instantaneous, sub-second responses even when disconnected from internet/server,
 * with full real-time access to POS Database, Stock Inventory, Shift Cash, SPK Pipeline,
 * Offline Sticker Design Canvas, Marketing Insights, and conversational intelligence.
 */

import { Product, Shift, Transaction, Customer, Agent, SpkOrder } from '../types';
import { formatRupiah } from './formatters';

export type AiPersonaStyle = 'CERIA' | 'FORMAL' | 'SANTAI' | 'RINGKAS';

export interface LocalAiContext {
  storeName?: string;
  userCallName?: string;
  userRole?: string;
  activeShift?: Shift | null;
  products?: Product[];
  customers?: Customer[];
  agents?: Agent[];
  transactions?: Transaction[];
  spkOrders?: SpkOrder[];
  currentTab?: string;
  todayRevenue?: number;
  todaySalesCount?: number;
  personaStyle?: AiPersonaStyle;
}

/**
 * Generate instantaneous sticker mockup visual as SVG Data URI when offline
 */
export function generateOfflineStickerSvg(prompt: string): string {
  const cleanTitle = prompt
    .replace(/^(buatkan|bikinin|bikin|buat|generate|desainkan|rancang)\s+(gambar|desain|stiker|mockup|logo|vektor)?\s*/i, '')
    .trim() || 'BEJO CUSTOM STIKER';

  const uppercaseTitle = cleanTitle.toUpperCase().slice(0, 24);

  const colors = [
    { bg1: '#3b82f6', bg2: '#1d4ed8', border: '#60a5fa', text: '#ffffff', accent: '#fbbf24' },
    { bg1: '#ec4899', bg2: '#be185d', border: '#f472b6', text: '#ffffff', accent: '#38bdf8' },
    { bg1: '#10b981', bg2: '#047857', border: '#34d399', text: '#ffffff', accent: '#f59e0b' },
    { bg1: '#8b5cf6', bg2: '#6d28d9', border: '#a78bfa', text: '#ffffff', accent: '#34d399' },
    { bg1: '#f59e0b', bg2: '#b45309', border: '#fbbf24', text: '#111827', accent: '#ef4444' }
  ];

  const palette = colors[Math.abs(cleanTitle.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % colors.length];

  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <defs>
    <linearGradient id="gradBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.bg1}" />
      <stop offset="100%" stop-color="${palette.bg2}" />
    </linearGradient>
    <filter id="stickerShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="4" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.3" />
    </filter>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="500" height="500" fill="#0f172a" rx="24" />

  <!-- Outer Cutline (Contour Die-Cut Preview) -->
  <rect x="35" y="35" width="430" height="430" rx="36" fill="none" stroke="${palette.border}" stroke-width="3" stroke-dasharray="8 6" opacity="0.8" />

  <!-- Main Sticker Body -->
  <g filter="url(#stickerShadow)">
    <rect x="50" y="50" width="400" height="400" rx="30" fill="url(#gradBg)" stroke="#ffffff" stroke-width="6" />

    <!-- Inner Geometric Graphic -->
    <circle cx="250" cy="200" r="85" fill="#ffffff" fill-opacity="0.12" stroke="${palette.accent}" stroke-width="3" />
    <path d="M 250 135 L 290 230 L 210 230 Z" fill="${palette.accent}" opacity="0.9" />
    <circle cx="250" cy="180" r="16" fill="#ffffff" />

    <!-- Star Badges -->
    <polygon points="250,85 256,102 274,102 260,113 265,130 250,120 235,130 240,113 226,102 244,102" fill="${palette.accent}" />
    <polygon points="120,160 124,172 136,172 127,180 130,192 120,185 110,192 113,180 104,172 116,172" fill="#ffffff" opacity="0.7" />
    <polygon points="380,160 384,172 396,172 387,180 390,192 380,185 370,192 373,180 364,172 376,172" fill="#ffffff" opacity="0.7" />

    <!-- Brand / Title Text -->
    <text x="250" y="310" text-anchor="middle" fill="${palette.text}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="24" letter-spacing="1">
      ${uppercaseTitle}
    </text>

    <!-- Subtitle / Spec Badge -->
    <rect x="130" y="335" width="240" height="34" rx="17" fill="#0f172a" fill-opacity="0.5" stroke="#ffffff" stroke-width="1.5" />
    <text x="250" y="358" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="12" letter-spacing="2">
      PREMIUM VINYL CUT
    </text>

    <!-- Quality Seal Footer -->
    <text x="250" y="415" text-anchor="middle" fill="#ffffff" opacity="0.85" font-family="system-ui, sans-serif" font-weight="600" font-size="11">
      ★ BEJO Digital Print DIGITAL PRINTING & CUTTING ★
    </text>
  </g>
</svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
}

/**
 * Main Real-Time Offline Response Generator
 */
export function generateLocalBejoAiReply(userMessage: string, ctx: LocalAiContext): string {
  const msg = (userMessage || '').trim().toLowerCase();
  const rawMsg = userMessage.trim();
  const callName = ctx.userCallName || 'Kak';
  const prefixTitle = callName.startsWith('Pak') ? callName : `Kak ${callName}`;
  const storeName = ctx.storeName || 'BEJO Digital Print';
  const style = ctx.personaStyle || 'CERIA';

  // Format tone based on persona style
  const greeting = style === 'FORMAL'
    ? `Selamat bertugas, ${prefixTitle}.`
    : style === 'RINGKAS'
    ? `Halo ${prefixTitle}.`
    : style === 'SANTAI'
    ? `Yo ${prefixTitle}! Asyik nih.`
    : `Halo ${prefixTitle}! 😊 Senang bisa bantu kamu.`;

  // 1. IMAGE / STICKER GENERATION REQUEST
  const isImageRequest = /(buatkan|bikinin|bikin|buat|generate|desainkan|rancang|lukiskan)\s+(gambar|desain|stiker|mockup|logo|vektor|vector|foto|ilustrasi|karakter|banner|poster)/i.test(msg) ||
    /generate\s+(image|gambar|sticker|logo|photo|design|mockup)/i.test(msg);

  if (isImageRequest) {
    const svgDataUri = generateOfflineStickerSvg(rawMsg);
    return `${greeting}\n\nIni dia preview visual desain stiker hasil racikan **SI BEJO AI Engine** untuk kamu: ✨🎨\n\n![Desain Stiker AI: ${rawMsg.slice(0, 40)}](${svgDataUri})\n\n💡 **Spesifikasi & Rekomendasi Cetak Toko:**\n- **Bahan Terbaik:** *Vinyl Ritrama / Oracal 651 Glossy* (Tahan air & outdoor).\n- **Finishing:** Cutting Die-Cut Contour / Laminasi Glossy 100gr.\n- **Kualitas:** Vektor Ultra HD siap cetak.\n\nGimana ${prefixTitle}, desainnya keren kan? Mau langsung diproses ke antrean cetak SPK atau disesuaikan lagi? 😉🔥`;
  }

  // 2. CHECK REVENUE / SALES / SHIFT CASH
  if (
    msg.includes('omset') ||
    msg.includes('penjualan') ||
    msg.includes('kasir') ||
    msg.includes('shift') ||
    msg.includes('uang kas') ||
    msg.includes('pendapatan') ||
    msg.includes('laporan hari ini')
  ) {
    const activeShift = ctx.activeShift;
    const txs = ctx.transactions || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTxs = txs.filter((t) => t.date === todayStr);
    const totalTodayRevenue = ctx.todayRevenue ?? todayTxs.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalTodayCount = ctx.todaySalesCount ?? todayTxs.length;

    let shiftInfo = 'Saat ini belum ada shift kasir yang aktif.';
    if (activeShift) {
      const modalAwal = activeShift.startingCash ?? activeShift.initialCash ?? 0;
      shiftInfo = `Shift aktif: **${activeShift.shiftName || 'Shift 1'}** oleh **${activeShift.cashierName || 'Kasir'}** (Modal Awal: ${formatRupiah(modalAwal)}).`;
    }

    return `${greeting}\n\nBerikut ringkasan data penjualan real-time di **${storeName}**: 📊\n\n` +
      `• **Status Shift:** ${shiftInfo}\n` +
      `• **Total Transaksi Hari Ini:** **${totalTodayCount} transaksi**\n` +
      `• **Total Omset Terkumpul:** **${formatRupiah(totalTodayRevenue)}**\n` +
      `• **Metode Pembayaran:** Tunai (Cash), Transfer Bank, dan QRIS aktif.\n\n` +
      `Semua mutasi tercatat aman di database lokal & sinkronisasi otomatis. Ada rincian kasir lain yang mau dicek, ${prefixTitle}? 💰✨`;
  }

  // 3. CHECK STOCK SPECIFIC PRODUCT
  const products = ctx.products || [];
  const matchedProduct = products.find((p) => {
    const pName = p.name.toLowerCase();
    const pCode = (p.code || '').toLowerCase();
    const words = msg.replace(/(cek|stok|harga|berapa|sisa|ada|gak|dong|produk|bahan|barang)/g, '').trim().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return false;
    return words.every(w => pName.includes(w) || pCode.includes(w));
  });

  if (matchedProduct) {
    const stockVal = matchedProduct.stock || 0;
    const unit = matchedProduct.unit || 'unit';
    const pricePcs = formatRupiah(matchedProduct.price || 0);
    const priceGrosir = matchedProduct.hargaMeterGrosir ? formatRupiah(matchedProduct.hargaMeterGrosir) : (matchedProduct.hargaGrosir ? formatRupiah(matchedProduct.hargaGrosir) : pricePcs);
    const statusText = stockVal > 10 ? '🟢 Stok Aman' : (stockVal > 0 ? '🟡 Stok Menipis' : '🔴 Stok Habis');

    return `${greeting}\n\nInformasi stok real-time untuk **${matchedProduct.name}** (${matchedProduct.code || 'SKU'}): 📦\n\n` +
      `• **Sisa Stok:** **${stockVal} ${unit}** (${statusText})\n` +
      `• **Kategori:** ${matchedProduct.category.toUpperCase()}\n` +
      `• **Harga Satuan / Eceran:** ${pricePcs}\n` +
      `• **Harga Grosir / Agen:** ${priceGrosir}\n` +
      `${matchedProduct.dimensions ? `• **Dimensi Bahan:** ${matchedProduct.dimensions}\n` : ''}` +
      `\nBarang siap langsung ditambahkan ke Keranjang Kasir atau SPK Cetak ya ${prefixTitle}! 👍`;
  }

  // 4. CHECK LOW STOCK / HABIS
  if (msg.includes('stok habis') || msg.includes('stok tipis') || msg.includes('stok menipis') || msg.includes('habis') || (msg.includes('stok') && msg.includes('peringatan'))) {
    const lowStockList = products.filter((p) => (p.stock || 0) <= 5);
    if (lowStockList.length === 0) {
      return `${greeting}\n\nKabar baik ${prefixTitle}! Seluruh stok katalog bahan di **${storeName}** saat ini dalam status **AMAN** (tidak ada yang di bawah batas minimum). Operasional siap melayani order besar! 🚀✨`;
    }

    const itemsSummary = lowStockList.slice(0, 6).map((p) => `• **${p.name}**: Sisa **${p.stock || 0} ${p.unit || 'unit'}**`).join('\n');
    return `${greeting}\n\n⚠️ **Peringatan Stok Menipis / Perlu Restock Segera:**\n\n${itemsSummary}\n\nTotal ada **${lowStockList.length} produk** yang stoknya perlu segera di-reorder ke supplier agar proses cetak & penjualan tidak terhambat. Mau dibuatkan catatan order ke supplier, ${prefixTitle}? 📋`;
  }

  // 5. SPK CETAK & PIPELINE
  if (msg.includes('spk') || msg.includes('antrean') || msg.includes('deadline') || msg.includes('cetak digital') || msg.includes('mesin')) {
    const spkList = ctx.spkOrders || [];
    const activeSpk = spkList.filter(s => s.status !== 'SELESAI_LUNAS' && s.status !== 'DIBATALKAN');
    const waitingSetting = spkList.filter(s => s.status === 'MENUNGGU_SETTING').length;
    const inPrinting = spkList.filter(s => s.status === 'SEDANG_CETAK').length;
    const inFinishing = spkList.filter(s => s.status === 'FINISHING').length;
    const readyPickup = spkList.filter(s => s.status === 'SIAP_AMBIL').length;

    return `${greeting}\n\nBerikut pantauan alur kerja **SPK Cetak Digital** di **${storeName}**: 🖨️✨\n\n` +
      `• **Total SPK Berjalan:** **${activeSpk.length} pesanan**\n` +
      `• 📥 **1. Menunggu Setting:** ${waitingSetting} berkas\n` +
      `• ⚡ **2. Antrean / Proses Cetak:** ${inPrinting} mesin aktif\n` +
      `• ✂️ **3. Proses Finishing:** ${inFinishing} pesanan\n` +
      `• 🛍️ **4. Siap Ambil / Kasir:** ${readyPickup} pesanan siap bayar\n\n` +
      `Folder berkas asli LAN dan mesin cetak online terhubung real-time. Ada nomor SPK tertentu yang ingin dicek statusnya, ${prefixTitle}? 😊`;
  }

  // 6. AGEN & PENGAMBILAN BAHAN
  if (msg.includes('agen') || msg.includes('rekanan') || msg.includes('pengambilan bahan') || msg.includes('cabang')) {
    const agents = ctx.agents || [];
    return `${greeting}\n\nInformasi kemitraan **Toko Cabang & Agen Resmi ${storeName}**: 🤝📦\n\n` +
      `• **Total Agen Terdaftar:** **${agents.length} Mitra Cabang**\n` +
      `• **Jadwal Update Stok Agen:** Otomatis tiap pukul 16.00 WIB setiap hari.\n` +
      `• **Fitur Agen:** Pemesanan bahan per roll/meter, riwayat pengambilan bahan bulanan, dan order cetak langsung tersinkronisasi.\n\n` +
      `Semua Surat Jalan dan mutasi bahan agen dapat langsung dicetak atau diekspor ke PDF dari Tab Agen ya ${prefixTitle}!`;
  }

  // 7. MARKETING & PROMO STRATEGIES
  if (msg.includes('promo') || msg.includes('marketing') || msg.includes('ide') || msg.includes('diskon') || msg.includes('laris') || msg.includes('jual')) {
    return `${greeting}\n\nIni 3 strategi promosi kreatif & praktis untuk dongkrak omset **${storeName}** minggu ini: 💡🚀\n\n` +
      `1. **Paket Promo Branding UMKM & Komunitas**\n` +
      `   Tawarkan bundle cetak stiker logo kemasan + free 10 stiker cutting hologram untuk pembelian minimal 100 pcs.\n\n` +
      `2. **Program Loyalitas Agen & Reseller**\n` +
      `   Beri diskon khusus potongan harga bahan per roll untuk mitra agen yang mencapai akumulasi order 5 roll dalam sebulan.\n\n` +
      `3. **Flash Sale Jam Sepi (Happy Hour)**\n` +
      `   Adakan harga hemat khusus cetak banner / laser cutting di jam 13.00 - 15.00 WIB untuk menyeimbangkan antrean mesin.\n\n` +
      `Mau kita buatkan draf pesan promosi WhatsApp buat disebar ke pelanggan terdaftar, ${prefixTitle}? 😎👍`;
  }

  // 8. DRAKOR & ENTERTAINMENT
  if (msg.includes('drakor') || msg.includes('drama') || msg.includes('korea') || msg.includes('nonton') || msg.includes('film')) {
    return `${greeting}\n\nWah seru banget nih bahas drakor! 😍🍿\n\n` +
      `Rekomendasi drakor terpopuler yang wajib masuk watchlist kamu:\n` +
      `• **Queen of Tears** – Chemistry baper abis & visual menawan!\n` +
      `• **Lovely Runner** – Cerita time-travel romcom yang bikin senyum-senyum sendiri!\n` +
      `• **Marry My Husband** – Balas dendam epik yang memuaskan banget alurnya!\n\n` +
      `Btw ${prefixTitle}, seru juga nih kalau kita bikin merchandise stiker decal quotes / karakter drakor lucu buat display etalase toko. Pasti banyak yang suka! 😉✨`;
  }

  // 9. HOROSCOPE & ZODIAK
  if (msg.includes('horoskop') || msg.includes('zodiak') || msg.includes('ramalan') || msg.includes('bintang') || msg.includes('nasib')) {
    return `${greeting}\n\n🔮 **Horoskop & Energi Positif Hari Ini Spesial untuk ${prefixTitle}:** ✨\n\n` +
      `⭐ **Aura Keberuntungan:** Lagi cerah banget! Peluang rezeki dan kerja sama baru terbuka lebar hari ini.\n` +
      `💼 **Fokus Operasional:** Transaksi kasir lancar, komunikasi dengan pelanggan dan rekan tim terjalin hangat.\n` +
      `💖 **Tips Mood:** Tetap tersenyum ramah, jaga stamina dengan minum air putih cukup, dan nikmati setiap prosesnya!\n\n` +
      `Semoga hari ini penuh berkah dan toko selalu ramai pembeli ya ${prefixTitle}! Amin! 🥰🙌`;
  }

  // 10. TROUBLESHOOTING & POS TIPS
  if (msg.includes('bantuan') || msg.includes('cara') || msg.includes('error') || msg.includes('printer') || msg.includes('nota') || msg.includes('thermal')) {
    return `${greeting}\n\n🛠️ **Panduan Cepat Operasional POS ${storeName}:**\n\n` +
      `• **Cetak Nota / Struk:** Otomatis keluar setelah pembayaran lunas atau klik ikon printer di riwayat transaksi.\n` +
      `• **Transaksi Cetak & Laser:** Klik tombol **+ Jasa Cetak & Laser** di kasir untuk langsung membuat SPK terintegrasi.\n` +
      `• **Tarik SPK di Kasir:** Gunakan tombol **📥 TARIK DARI SPK CETAK** untuk pelunasan atau potong DP.\n` +
      `• **Mode Offline:** Aplikasi tetap dapat mencatat transaksi kasir & kalkulasi secara lokal saat internet terputus.\n\n` +
      `Jika butuh bantuan teknis lain, tanyakan saja ya ${prefixTitle}!`;
  }

  // 11. GENERAL CONVERSATION & COMPANION
  return `${greeting}\n\nSebagai asisten pintar dan sahabat setia di **${storeName}**, aku selalu siap sedia tiap saat (baik saat online maupun offline):\n\n` +
    `• 💰 Cek omset, kas kasir, & laporan penjualan real-time\n` +
    `• 📦 Cari stok barang, harga ecer/grosir, & info bahan menipis\n` +
    `• 🖨️ Pantau alur SPK Cetak Digital & deadline antrean mesin\n` +
    `• 🎨 Buat konsep visual stiker AI & ide promo toko\n` +
    `• 💬 Teman ngobrol santai, horoskop, rekomendasi drakor, & curhat!\n\n` +
    `Ada hal apa yang ingin kita bahas atau selesaikan bersama sekarang, ${prefixTitle}? He..he..he.. 😊✨`;
}
