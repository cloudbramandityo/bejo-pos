/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Landing Page Configuration Storage & Defaults (Dynamic & Adaptive CMS)
 * Coded by Langgo Bramandityo.
 */
import { LandingPageConfig } from '../types';

export const LANDING_PAGE_STORAGE_KEY = 'bejo_pos_landing_page_config_v1';

export const DEFAULT_LANDING_CONFIG: LandingPageConfig = {
  isPublished: true, // Default: PUBLISHED as initial landing screen
  lastModifiedAt: Date.now(),
  lastModifiedBy: 'Master Developer (Langgo)',
  hero: {
    badgeText: 'Pusat Grosir & Eceran Stiker Vinyl Terlengkap',
    headline: 'Distributor Resmi Stiker Vinyl Roll & Meteran, Digital Printing & Laser Cutting Presisi',
    subheadline: 'Menyediakan merk terbaik dunia: Decofix, Oracal, Derek, 3M, Car Diary, Duratac, dll. Kualitas premium langsung tangan pertama untuk variasi otomotif, advertising signage, dan industri kreatif.',
    primaryCtaText: 'Konsultasi & Order via WhatsApp',
    secondaryCtaText: 'Katalog Merk & Estimasi Harga',
    bannerAnnouncement: '🔥 PROMO KHUSUS MINGGU INI: Diskon khusus pembelian Stiker Vinyl per Roll & Gratis Potong Presisi!'
  },
  slides: [
    {
      id: 'slide_promo',
      title: 'Promo Grosir Stiker Vinyl Minggu Ini',
      subtitle: 'Diskon khusus pembelian roll utuh untuk bengkel, toko stiker, dan agen. Gratis potong presisi sesuai kebutuhan Anda.',
      ctaText: 'Lihat Produk & Harga',
      imageUrl: undefined,
      isActive: true
    },
    {
      id: 'slide_layanan',
      title: 'Digital Printing & Laser Cutting Presisi',
      subtitle: 'Mesin cetak hi-res dan laser CNC milik sendiri. Hasil tajam, finishing rapi, dan pengerjaan cepat.',
      ctaText: 'Konsultasi Gratis',
      imageUrl: undefined,
      isActive: true
    },
    {
      id: 'slide_merk',
      title: '11 Merk Stiker Dunia Tangan Pertama',
      subtitle: 'Decofix, Oracal, Derek, 3M, Saicholite, Duratac — siap eceran maupun grosir di gudang kami.',
      ctaText: 'Lihat Katalog Merk',
      imageUrl: undefined,
      isActive: true
    }
  ],
  brands: [
    {
      id: 'brand_decofix',
      name: 'DECOFIX',
      tagline: 'Premium Glossy & Super Matte Automotive Wrap',
      category: 'wrapping',
      description: 'Pilihan utama modifikator otomotif dengan daya rekat stabil, bubble-free adhesive, serta kilau warna tajam tahan cuaca ekstrem.',
      badge: 'Best Seller',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      isPopular: true,
      isActive: true,
      features: ['Glossy / Matte / Satin', 'Lentur mudah ditarik', 'Anti gelembung udara', 'Lem tidak merusak cat'],
      imageUrl: undefined
    },
    {
      id: 'brand_oracal',
      name: 'ORACAL',
      tagline: 'German Quality Intermediate Vinyl Series (651 / 8500 / 970)',
      category: 'cutting',
      description: 'Standar emas dunia untuk stiker cutting, signage huruf timbul, dan striping outdoor dengan ketahanan warna hingga 5 tahun.',
      badge: 'Grade Jerman',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      isPopular: true,
      isActive: true,
      features: ['Seri 651 / 8500 Translucent', 'Akurasi cutting mikro', 'Tahan UV sinar matahari', 'Pilihan 60+ warna solid']
    },
    {
      id: 'brand_derek',
      name: 'DEREK',
      tagline: 'Ultra Metallic Gloss & Candy Chrome Wrapping',
      category: 'wrapping',
      description: 'Film pembungkus mobil & motor dengan kilau efek metalik, gliter kristal, dan bunglon yang mewah serta berkelas.',
      badge: 'Luxury Finish',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      isPopular: true,
      isActive: true,
      features: ['Super Gloss Metallic', 'Efek Candy & Bunglon', 'Lapisan pelindung PET', 'High Gloss Mirror Clear']
    },
    {
      id: 'brand_cardiary',
      name: 'CAR DIARY',
      tagline: 'High Durability Automotive Styling & Decals',
      category: 'wrapping',
      description: 'Stiker vinyl otomotif berteknologi perekat inovatif, sangat cocok untuk striping motor, wrapping bodi, dan interior.',
      badge: 'Favorit Bengkel',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      isPopular: true,
      isActive: true,
      features: ['Mudah dipasang', 'Ketebalan pas & presisi', 'Banyak pilihan warna tren', 'Harga ekonomis']
    },
    {
      id: 'brand_wtpremium',
      name: 'WT PREMIUM',
      tagline: 'Superior Wrapping & Color Film Formula',
      category: 'wrapping',
      description: 'Material premium bertekstur halus dan elastisitas tinggi untuk lekukan rumit bodi kendaraan tanpa gelembung.',
      badge: 'High Elasticity',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      isPopular: false,
      isActive: true,
      features: ['Elastis saat dipanaskan', 'Lem bening ramah cat', 'Finishing super mulus', 'Cocok bodi cembung']
    },
    {
      id: 'brand_saicholite',
      name: 'SAICHOLITE',
      tagline: 'Micro-Prismatic Reflective & Scotchlite Safety',
      category: 'reflective',
      description: 'Stiker scotlite pemantul cahaya kualitas tinggi untuk rambu keselamatan, marka jalan, armada logistik, dan variasi velg.',
      badge: 'Reflective Tinggi',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      isPopular: true,
      isActive: true,
      features: ['Menyala saat disorot lampu', 'Tahan air & cuaca malam', 'Warna fluoresen terang', 'Daya rekat kuat']
    },
    {
      id: 'brand_duratac',
      name: 'DURATAC',
      tagline: 'Heavy Duty Digital Printing Vinyl & Laminating',
      category: 'printing',
      description: 'Bahan cetak stiker digital printing solvent & eco-solvent dengan penyerapan tinta maksimal dan ketajaman warna spektakuler.',
      badge: 'Hasil Cetak Tajam',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      isPopular: true,
      isActive: true,
      features: ['Serap tinta maksimal', 'Tidak mudah robek', 'Laminasi doff & glossy', 'Ketahanan outdoor prima']
    },
    {
      id: 'brand_brite',
      name: 'BRITE',
      tagline: 'Commercial Advertising & Signage Vinyl Media',
      category: 'cutting',
      description: 'Pilihan tepat untuk display promosi toko, cutting stiker kaca etalase, branding booth pameran, dan neon box.',
      badge: 'Value Pack',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
      isPopular: false,
      isActive: true,
      features: ['Daya rekat instan', 'Warna tajam merata', 'Mudah di-peeling', 'Sangat ekonomis untuk proyek besar']
    },
    {
      id: 'brand_3m',
      name: '3M',
      tagline: 'World Class Scotchcal & Diamond Grade Reflective',
      category: 'reflective',
      description: 'Merk legendaris dunia bersertifikasi internasional untuk stiker reflektif keselamatan jalan, industrial striping, dan perekat spesialis.',
      badge: 'Standar Industri',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
      isPopular: true,
      isActive: true,
      features: ['Sertifikasi uji resmi', 'Pantulan jarak jauh', 'Daya tahan 7-10 tahun', 'Lem ekstra kuat']
    },
    {
      id: 'brand_nanogard',
      name: 'NANO GARD',
      tagline: 'Paint Protection Film (PPF) Self-Healing Coating',
      category: 'protection',
      description: 'Pelindung cat mobil & motor transparan berbahan TPU/TPH optik jernih dengan fitur pemulihan goresan otomatis (self-healing).',
      badge: 'Self-Healing PPF',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      isPopular: true,
      isActive: true,
      features: ['Anti gores kerikil & benturan', 'Self-healing kena panas', 'Hydrophobic efek daun talas', 'Tidak menguning (Anti-yellowing)']
    },
    {
      id: 'brand_blackprotector',
      name: 'BLACK PROTECTOR',
      tagline: 'Headlamp Smoke Tint & Carbon Protective Film',
      category: 'protection',
      description: 'Film pelindung khusus lampu mobil/motor (smoke / hybrid black) serta carbon protector untuk cover bodi dan knalpot.',
      badge: 'Pelindung Lampu',
      badgeColor: 'bg-zinc-100 text-zinc-800 border-zinc-300',
      isPopular: false,
      isActive: true,
      features: ['Transmisi cahaya lampu aman', 'Anti retak kaca mika', 'Tekstur carbon 5D timbul', 'Tahan panas lampu']
    }
  ],
  services: [
    {
      id: 'serv_vinyl',
      title: 'Stiker Vinyl Roll & Meteran',
      subtitle: 'Grosir Roll Utuh & Eceran Meteran',
      description: 'Menyediakan ribuan pilihan warna dan tekstur stiker vinyl berkualitas tinggi (Glossy, Matte, Satin, Metallic, Carbon, Scotlite, Transparan, Smoke). Tersedia eceran per meter maupun grosir roll utuh (panjang 15m - 50m) dengan harga tangan pertama.',
      iconName: 'package',
      highlights: [
        'Eceran mulai 1 meter hingga roll utuh',
        'Stok ready di toko tanpa perlu inden',
        'Lebar standar 45cm, 120cm, hingga 152cm',
        'Bisa konsultasi kebutuhan bahan langsung'
      ],
      ctaLabel: 'Tanya Stok & Harga Vinyl',
      isActive: true
    },
    {
      id: 'serv_digital_print',
      title: 'Digital Printing Indoor & Outdoor',
      subtitle: 'Cetak Hi-Resolution Tinta Tahan Cuaca',
      description: 'Layanan percetakan digital profesional menggunakan mesin cetak beresolusi tinggi. Melayani cetak stiker vinyl, stiker one way vision, banner spanduk flexi, stiker label kemasan, kanvas, poster, dan laminasi dingin (glossy/doff) tahan air dan tahan panas.',
      iconName: 'printer',
      highlights: [
        'Mesin cetak sendiri di workshop kami',
        'Tinta solvent & eco-solvent anti pudar',
        'Bisa sekaligus potong stiker (Print & Cut)',
        'Pengerjaan cepat (Same Day Service tersedia)'
      ],
      ctaLabel: 'Order Cetak Digital Print',
      isActive: true
    },
    {
      id: 'serv_laser_cut',
      title: 'Laser Cutting & Engraving Presisi',
      subtitle: 'Pemotongan Akrilik, Kayu & Merchandise',
      description: 'Teknologi potong dan grafir sinar laser CNC dengan akurasi mikro. Siap memproduksi huruf timbul neon box, plakat akrilik, gantungan kunci, nomor rumah custom, dekorasi dinding, merchandise, serta part custom berbahan akrilik hingga ketebalan 10mm.',
      iconName: 'scissors',
      highlights: [
        'Potongan halus tanpa bekas serabut',
        'Presisi sesuai file vektor (Corel / AI / CAD)',
        'Akrilik bening, warna, mirror gold/silver',
        'Bisa satuan maupun partai ribuan pcs'
      ],
      ctaLabel: 'Konsultasi Laser Cutting',
      isActive: true
    }
  ],
  featuredProducts: [
    {
      id: 'prod_feat_1',
      name: 'Stiker Decofix Super Gloss Series (Eceran Meteran)',
      brand: 'DECOFIX',
      category: 'meteran',
      unit: 'per meter (Lebar 45cm)',
      priceEstimated: 'Rp 22.000 / meter',
      specs: 'Lebar 45cm, Ketebalan 100 micron, Bubble-free adhesive',
      description: 'Pilihan favorit untuk variasi striping dan bodi motor. Lentur dan lem aman bagi cat orisinil.',
      badge: 'Terlaris',
      isActive: true
    },
    {
      id: 'prod_feat_2',
      name: 'Stiker Decofix Glossy / Matte 1 Roll Utuh (Panjang 15 Meter)',
      brand: 'DECOFIX',
      category: 'roll',
      unit: 'per roll (Lebar 45cm x 15m)',
      priceEstimated: 'Rp 255.000 / roll',
      specs: '1 Roll isi 15 meter, Segel pabrik original',
      description: 'Harga spesial grosir khusus bengkel, toko stiker, dan agen.',
      badge: 'Harga Grosir',
      isActive: true
    },
    {
      id: 'prod_feat_3',
      name: 'Stiker Oracal 651 Intermediate Cal (Meteran Lebar 126cm)',
      brand: 'ORACAL',
      category: 'meteran',
      unit: 'per meter (Lebar 126cm)',
      priceEstimated: 'Rp 85.000 / meter',
      specs: 'Made in Germany, Outdoor durability 4-5 tahun',
      description: 'Standar baku signage etalase toko, huruf timbul, dan striping premium.',
      badge: 'Grade Jerman',
      isActive: true
    },
    {
      id: 'prod_feat_4',
      name: 'Cetak Stiker Vinyl Ritrama / Duratac + Cutting Presisi',
      brand: 'DURATAC',
      category: 'print',
      unit: 'per m² (meter persegi)',
      priceEstimated: 'Rp 75.000 / m²',
      specs: 'Tinta Eco-Solvent Hi-Res + Free Laminasi Doff/Glossy',
      description: 'Cetak stiker branding mobil operasional, stiker komunitas, dan etalase kaca.',
      badge: 'Print & Cut',
      isActive: true
    },
    {
      id: 'prod_feat_5',
      name: 'Jasa Laser Cutting Akrilik Presisi Tebal 2mm - 5mm',
      brand: 'BEJO LASER',
      category: 'laser',
      unit: 'per cm² / custom project',
      priceEstimated: 'Mulai Rp 35 / cm²',
      specs: 'Toleransi presisi ±0.1mm, Polished edge hasil potong',
      description: 'Pembuatan plakat, gantungan kunci, huruf timbul, dan display toko.',
      badge: 'Presisi CNC',
      isActive: true
    },
    {
      id: 'prod_feat_6',
      name: 'Stiker Scotlite Saicholite Pemantul Cahaya (Lebar 60cm)',
      brand: 'SAICHOLITE',
      category: 'meteran',
      unit: 'per meter (Lebar 60cm)',
      priceEstimated: 'Rp 45.000 / meter',
      specs: 'Prismatic reflector, High visibility at night',
      description: 'Menyala terang saat disorot lampu di kegelapan. Sangat diminati untuk safety & armada angkutan.',
      badge: 'Scotlite Glow',
      isActive: true
    }
  ],
  contact: {
    whatsappNumber: '6281234567890',
    whatsappMessageTemplate: 'Halo Bejo Stiker! Saya ingin order / tanya info produk dan layanan berikut:',
    storeAddress: 'Jl. Raya Utama No. 88 (Dekat Polsek), Indonesia',
    phoneDisplay: '0812-3456-7890',
    operatingHours: 'Senin - Sabtu: 08.00 - 20.00 WIB | Minggu: 09.00 - 17.00 WIB',
    googleMapsUrl: 'https://maps.google.com'
  },
  benefits: [
    {
      title: 'Stok Terlengkap & Selalu Siap',
      description: 'Ratusan roll stiker vinyl aneka merk dunia selalu ready stock di rak workshop tanpa perlu menunggu barang inden.',
      icon: 'package'
    },
    {
      title: 'Mesin Produksi Milik Sendiri',
      description: 'Digital printing hi-res dan mesin laser cutting kami kerjakan langsung di tempat, menjamin waktu selesai lebih cepat.',
      icon: 'printer'
    },
    {
      title: 'Harga Grosir Tangan Pertama',
      description: 'Mendapatkan harga kulak langsung pabrik untuk pembelian roll utuh, paket bengkel variasi, dan agen resmi.',
      icon: 'sparkles'
    },
    {
      title: 'Bisa Eceran & Konsultasi Gratis',
      description: 'Melayani pembelian mulai dari eceran 1 meter dengan potongan presisi dan bantuan konsultasi pemilihan bahan yang tepat.',
      icon: 'scissors'
    }
  ],
  about: {
    eyebrow: 'Tentang Kami',
    title: 'Berkembang Bersama Dedikasi & Inovasi',
    intro: 'Seperti benih yang tumbuh menjadi pohon besar, BEJO STIKER memulai perjalanan dengan dasar yang kuat: stok lengkap, harga tangan pertama, dan kerja keras setiap hari untuk memenuhi kebutuhan cetak pelanggan.',
    paragraphs: [
      'BEJO STIKER & DIGITAL PRINTING berdiri sebagai toko stiker dan workshop digital printing yang melayani variasi otomotif, bengkel, toko stiker, agen, hingga industri kreatif. Kami menyediakan material stiker terbaik dunia — Decofix, Oracal, Derek, 3M, Saicholite, Duratac, dan banyak lagi — siap eceran maupun grosir.',
      'Produksi kami dikerjakan sendiri di workshop: mulai dari digital printing resolusi tinggi, laminasi, hingga laser cutting akrilik presisi mikro. Dengan mesin milik sendiri, kualitas dan waktu pengerjaan sepenuhnya terkendali.',
      'Kami percaya hubungan jangka panjang dibangun dengan konsistensi: hasil cetak sesuai permintaan, pengiriman tepat waktu, dan layanan purna jual yang responsif. Itulah alasan pelanggan terus kembali dan merekomendasikan kami.'
    ],
    imageUrl: undefined,
    imageCaption: 'Workshop & Gudang BEJO STIKER',
    stats: [
      { value: '8+', label: 'Tahun Pengalaman' },
      { value: '40+', label: 'Merk & Warna Vinyl' },
      { value: '15.000+', label: 'Order Terpenuhi' },
      { value: '24 Jam', label: 'Respon Layanan' }
    ],
    ctaText: 'Konsultasi Kebutuhan Cetak Anda'
  },
  gallery: [
    { id: 'gal_1', title: 'Rak Gudang Stiker Vinyl', description: 'Ratusan roll merk dunia selalu ready stock.', imageUrl: undefined, isActive: true },
    { id: 'gal_2', title: 'Mesin Digital Printing', description: 'Cetak hi-res tinta eco-solvent tahan lama.', imageUrl: undefined, isActive: true },
    { id: 'gal_3', title: 'Mesin Laser Cutting CNC', description: 'Potongan halus presisi ±0.1mm.', imageUrl: undefined, isActive: true },
    { id: 'gal_4', title: 'Proses Wrapping Mobil', description: 'Pemasangan dikerjakan teknisi berpengalaman.', imageUrl: undefined, isActive: true }
  ],
  testimonials: [
    {
      id: 'testi_1',
      quote: 'Stoknya lengkap banget, roll utuh langsung ambil di gudang. Harga grosir jauh lebih hemat buat bengkel saya.',
      author: 'Pak Hendra',
      role: 'Pemilik Bengkel Variasi',
      company: 'AVS Auto Care',
      logoUrl: undefined,
      isActive: true
    },
    {
      id: 'testi_2',
      quote: 'Hasil cetak digitalnya tajam dan laminasinya rapi. Koordinasi produksi mudah dan selalu tepat waktu.',
      author: 'Rina',
      role: 'Marketing Communication',
      company: 'Event Planning Co.',
      logoUrl: undefined,
      isActive: true
    },
    {
      id: 'testi_3',
      quote: 'Laser cutting akriliknya presisi, tepi polos tanpa bekas serabut. Pasti langganan untuk merch tulisan timbul.',
      author: 'Dimas',
      role: 'Owner Souvenir Shop',
      company: 'Kreasi gifts',
      logoUrl: undefined,
      isActive: true
    }
  ],
  clients: [
    { id: 'cli_1', name: 'Bengkel Ajaib', logoUrl: undefined, websiteUrl: undefined, isActive: true },
    { id: 'cli_2', name: 'Toko Kiraya', logoUrl: undefined, websiteUrl: undefined, isActive: true },
    { id: 'cli_3', name: 'Flinker Trimshop', logoUrl: undefined, websiteUrl: undefined, isActive: true },
    { id: 'cli_4', name: 'Event Plan Co.', logoUrl: undefined, websiteUrl: undefined, isActive: true },
    { id: 'cli_5', name: 'AVA Carbody', logoUrl: undefined, websiteUrl: undefined, isActive: true },
    { id: 'cli_6', name: 'Kreasi Gifts', logoUrl: undefined, websiteUrl: undefined, isActive: true }
  ],
  offices: [
    {
      id: 'office_main',
      name: 'Toko & Workshop Pusat',
      address: 'Jl. Raya Utama No. 88 (Dekat Polsek), Pekokon, Indonesia',
      phone: '0812-3456-7890',
      isActive: true
    }
  ],
  socials: [
    { id: 'soc_ig', label: 'Instagram', url: 'https://instagram.com/bejostiker', isActive: true },
    { id: 'soc_tiktok', label: 'TikTok', url: 'https://tiktok.com/@bejostiker', isActive: true },
    { id: 'soc_fb', label: 'Facebook', url: 'https://facebook.com/bejostiker', isActive: true }
  ]
};

/**
 * Retrieves the current Landing Page configuration from LocalStorage
 * If absent, initializes with defaults.
 */
export function getStoredLandingConfig(): LandingPageConfig {
  try {
    const raw = localStorage.getItem(LANDING_PAGE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LANDING_PAGE_STORAGE_KEY, JSON.stringify(DEFAULT_LANDING_CONFIG));
      return DEFAULT_LANDING_CONFIG;
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_LANDING_CONFIG,
      ...parsed,
      hero: { ...DEFAULT_LANDING_CONFIG.hero, ...(parsed.hero || {}) },
      contact: { ...DEFAULT_LANDING_CONFIG.contact, ...(parsed.contact || {}) },
      brands: Array.isArray(parsed.brands) && parsed.brands.length > 0 ? parsed.brands : DEFAULT_LANDING_CONFIG.brands,
      services: Array.isArray(parsed.services) && parsed.services.length > 0 ? parsed.services : DEFAULT_LANDING_CONFIG.services,
      featuredProducts: Array.isArray(parsed.featuredProducts) && parsed.featuredProducts.length > 0 ? parsed.featuredProducts : DEFAULT_LANDING_CONFIG.featuredProducts,
      benefits: Array.isArray(parsed.benefits) && parsed.benefits.length > 0 ? parsed.benefits : DEFAULT_LANDING_CONFIG.benefits,
      slides: Array.isArray(parsed.slides) && parsed.slides.length > 0 ? parsed.slides : DEFAULT_LANDING_CONFIG.slides,
      about: { ...DEFAULT_LANDING_CONFIG.about, ...(parsed.about || {}) },
      gallery: Array.isArray(parsed.gallery) && parsed.gallery.length > 0 ? parsed.gallery : DEFAULT_LANDING_CONFIG.gallery,
      testimonials: Array.isArray(parsed.testimonials) && parsed.testimonials.length > 0 ? parsed.testimonials : DEFAULT_LANDING_CONFIG.testimonials,
      clients: Array.isArray(parsed.clients) && parsed.clients.length > 0 ? parsed.clients : DEFAULT_LANDING_CONFIG.clients,
      offices: Array.isArray(parsed.offices) && parsed.offices.length > 0 ? parsed.offices : DEFAULT_LANDING_CONFIG.offices,
      socials: Array.isArray(parsed.socials) && parsed.socials.length > 0 ? parsed.socials : DEFAULT_LANDING_CONFIG.socials
    };
  } catch (err) {
    console.error('Failed to parse landing config, falling back to defaults:', err);
    return DEFAULT_LANDING_CONFIG;
  }
}

/**
 * Saves updated Landing Page configuration to LocalStorage and dispatches an event
 */
export function saveStoredLandingConfig(config: LandingPageConfig): void {
  try {
    const toSave: LandingPageConfig = {
      ...config,
      lastModifiedAt: Date.now()
    };
    localStorage.setItem(LANDING_PAGE_STORAGE_KEY, JSON.stringify(toSave));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_landing_config_updated', { detail: toSave }));
    }
  } catch (err) {
    console.error('Failed to save landing page config:', err);
  }
}

/**
 * Resets Landing Page configuration back to pristine defaults
 */
export function resetLandingConfigToDefault(): LandingPageConfig {
  try {
    localStorage.setItem(LANDING_PAGE_STORAGE_KEY, JSON.stringify(DEFAULT_LANDING_CONFIG));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_landing_config_updated', { detail: DEFAULT_LANDING_CONFIG }));
    }
    return DEFAULT_LANDING_CONFIG;
  } catch (err) {
    console.error('Failed to reset landing page config:', err);
    return DEFAULT_LANDING_CONFIG;
  }
}
