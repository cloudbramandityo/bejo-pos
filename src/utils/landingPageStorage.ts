/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Landing Page Configuration Storage & Defaults (Dynamic & Adaptive CMS)
 * Struktur konten mengikuti referensi uprint.id.
 * Coded by Langgo Bramandityo.
 */
import { LandingPageConfig } from '../types';

export const LANDING_PAGE_STORAGE_KEY = 'bejo_pos_landing_page_config_v1';
export const LANDING_PAGE_DRAFT_STORAGE_KEY = 'bejo_pos_landing_page_draft_v1';

/* -------------------------------------------------------------------------- */
/*  Helper pembuat id sederhana untuk konten default                          */
/* -------------------------------------------------------------------------- */
const cid = (prefix: string, i: number) => `${prefix}_${i}`;

const categoryCard = (prefix: string, label: string, i: number) => ({
  id: cid(prefix, i),
  label,
  imageUrl: undefined as string | undefined,
  isActive: true
});

export const DEFAULT_LANDING_CONFIG: LandingPageConfig = {
  isPublished: true,
  lastModifiedAt: Date.now(),
  lastModifiedBy: 'Master Developer (Langgo)',

  hero: {
    badgeText: 'Percetakan Online Indonesia',
    headline: 'PERCETAKAN ONLINE INDONESIA - BEJO STIKER',
    subheadline:
      'Layanan percetakan offset dan digital printing terpadu untuk cetak kemasan custom, kartu nama, brosur, flyer, buku, katalog, stiker, kalender, banner, hingga souvenir bisnis dengan pengiriman ke seluruh Indonesia.',
    primaryCtaText: 'Konsultasi Gratis',
    secondaryCtaText: 'Download Katalog',
    bannerAnnouncement: ''
  },

  brand: {
    name: 'bejo stiker',
    tagline: 'percetakan online indonesia',
    logoUrl: undefined,
    faviconUrl: undefined,
    siteTitle: 'BEJO STIKER & DIGITAL PRINTING',
    metaDescription:
      'BEJO STIKER & DIGITAL PRINTING: percetakan online kemasan custom, kartu nama, media promosi, banner, kalender, dan souvenir bisnis kirim seluruh Indonesia.'
  },

  slides: [
    {
      id: 'slide_1',
      eyebrow: 'TEMPLATE DESIGN',
      title: 'Kemasan Custom Full Color\nuntuk Brand Anda',
      subtitle: 'Template kemasan siap pakai, tinggal ganti logo dan warna.',
      ctaText: 'Klik Di Sini',
      imageUrl: undefined,
      isActive: true
    },
    {
      id: 'slide_2',
      eyebrow: 'DIGITAL PRINTING',
      title: 'Cetak Stiker & Label\nPresisi Tinggi',
      subtitle: 'Hasil cetak tajam, laminasi rapi, siap kirim seluruh Indonesia.',
      ctaText: 'Klik Di Sini',
      imageUrl: undefined,
      isActive: true
    },
    {
      id: 'slide_3',
      eyebrow: 'SOUVENIR BISNIS',
      title: 'Souvenir Custom\nuntuk Klien & Tim',
      subtitle: 'Tumbler, tas canvas, plakat akrilik, hingga merchandise event.',
      ctaText: 'Klik Di Sini',
      imageUrl: undefined,
      isActive: true
    }
  ],

  menu: [
    {
      id: 'menu_cetak_custom',
      label: 'CETAK CUSTOM',
      type: 'mega',
      position: 'left',
      isActive: true,
      columns: [
        {
          id: 'col_kemasan',
          heading: 'Kemasan',
          links: [
            { id: 'lnk_k1', label: 'Stiker Label Produk', categoryKey: 'kemasan' },
            { id: 'lnk_k2', label: 'Box Kemasan Custom', categoryKey: 'kemasan' },
            { id: 'lnk_k3', label: 'Paper Bag', categoryKey: 'kemasan' },
            { id: 'lnk_k4', label: 'Standing Pouch', categoryKey: 'kemasan' },
            { id: 'lnk_k5', label: 'Sleeve & Belt', categoryKey: 'kemasan' },
            { id: 'lnk_k6', label: 'Wrapping Paper', categoryKey: 'kemasan' }
          ]
        },
        {
          id: 'col_stationery',
          heading: 'Stationery',
          links: [
            { id: 'lnk_s1', label: 'Kartu Nama', categoryKey: 'stationery' },
            { id: 'lnk_s2', label: 'Kop Surat', categoryKey: 'stationery' },
            { id: 'lnk_s3', label: 'Amplop Custom', categoryKey: 'stationery' },
            { id: 'lnk_s4', label: 'Notepad', categoryKey: 'stationery' },
            { id: 'lnk_s5', label: 'Agenda Custom', categoryKey: 'stationery' },
            { id: 'lnk_s6', label: 'Company Profile', categoryKey: 'stationery' }
          ]
        },
        {
          id: 'col_promosi',
          heading: 'Promosi',
          links: [
            { id: 'lnk_p1', label: 'Brosur', categoryKey: 'promosi' },
            { id: 'lnk_p2', label: 'Flyer', categoryKey: 'promosi' },
            { id: 'lnk_p3', label: 'Booklet', categoryKey: 'promosi' },
            { id: 'lnk_p4', label: 'Kalender', categoryKey: 'promosi' },
            { id: 'lnk_p5', label: 'Banner Spanduk', categoryKey: 'promosi' },
            { id: 'lnk_p6', label: 'X-Banner', categoryKey: 'promosi' }
          ]
        },
        {
          id: 'col_souvenir',
          heading: 'Souvenir',
          links: [
            { id: 'lnk_o1', label: 'Tumbler Custom', categoryKey: 'souvenir' },
            { id: 'lnk_o2', label: 'T-Shirt Sablon', categoryKey: 'souvenir' },
            { id: 'lnk_o3', label: 'Tas Canvas', categoryKey: 'souvenir' },
            { id: 'lnk_o4', label: 'Gantungan Kunci', categoryKey: 'souvenir' },
            { id: 'lnk_o5', label: 'Plakat Akrilik', categoryKey: 'souvenir' },
            { id: 'lnk_o6', label: 'Mug Custom', categoryKey: 'souvenir' }
          ]
        }
      ]
    },
    {
      id: 'menu_template',
      label: 'TEMPLATE DESIGN',
      type: 'mega',
      position: 'left',
      isActive: true,
      columns: [
        {
          id: 'col_tpl_kemasan',
          heading: 'Kemasan',
          links: [
            { id: 'lnk_tk1', label: 'Box Siap Pakai', categoryKey: 'kemasan' },
            { id: 'lnk_tk2', label: 'Label Siap Pakai', categoryKey: 'kemasan' },
            { id: 'lnk_tk3', label: 'Paper Bag Siap Pakai', categoryKey: 'kemasan' }
          ]
        },
        {
          id: 'col_tpl_stationery',
          heading: 'Stationery',
          links: [
            { id: 'lnk_ts1', label: 'Kartu Nama', categoryKey: 'stationery' },
            { id: 'lnk_ts2', label: 'Agenda', categoryKey: 'stationery' },
            { id: 'lnk_ts3', label: 'Notepad', categoryKey: 'stationery' }
          ]
        },
        {
          id: 'col_tpl_promosi',
          heading: 'Promosi',
          links: [
            { id: 'lnk_tp1', label: 'Kalender', categoryKey: 'promosi' },
            { id: 'lnk_tp2', label: 'Brosur', categoryKey: 'promosi' },
            { id: 'lnk_tp3', label: 'Banner', categoryKey: 'promosi' }
          ]
        },
        {
          id: 'col_tpl_souvenir',
          heading: 'Souvenir',
          links: [
            { id: 'lnk_to1', label: 'T-Shirt', categoryKey: 'souvenir' },
            { id: 'lnk_to2', label: 'Tumbler', categoryKey: 'souvenir' },
            { id: 'lnk_to3', label: 'Tas Canvas', categoryKey: 'souvenir' }
          ]
        }
      ]
    },
    {
      id: 'menu_events',
      label: 'EVENTS',
      type: 'mega',
      position: 'left',
      isActive: true,
      columns: [
        {
          id: 'col_events',
          heading: 'Momen Spesial',
          links: [
            { id: 'lnk_ev1', label: 'Imlek', categoryKey: 'kemasan' },
            { id: 'lnk_ev2', label: 'Lebaran', categoryKey: 'kemasan' },
            { id: 'lnk_ev3', label: 'Natal', categoryKey: 'kemasan' },
            { id: 'lnk_ev4', label: 'Tahun Baru', categoryKey: 'promosi' }
          ]
        }
      ]
    },
    { id: 'menu_inspirasi', label: 'INSPIRASI CETAK', type: 'link', position: 'right', page: 'blog', isActive: true },
    { id: 'menu_portfolio', label: 'PORTFOLIO', type: 'link', position: 'right', page: 'clients', isActive: true },
    {
      id: 'menu_tentang',
      label: 'TENTANG KAMI',
      type: 'mega',
      position: 'right',
      isActive: true,
      columns: [
        {
          id: 'col_tentang',
          heading: 'Perusahaan',
          links: [
            { id: 'lnk_ab1', label: 'Tentang Kami', page: 'about' },
            { id: 'lnk_ab2', label: 'Kontak', page: 'contact' },
            { id: 'lnk_ab3', label: 'Klien Kami', page: 'clients' },
            { id: 'lnk_ab4', label: 'FAQ', page: 'contact' }
          ]
        }
      ]
    }
  ],

  categories: [
    {
      id: 'cat_kemasan',
      key: 'kemasan',
      title: 'KEMASAN',
      heading: 'Cetak Custom Kemasan Berkualitas untuk Brand dan Bisnis Anda',
      description:
        'Dari hard box, paper bag, hingga stiker kemasan, semua diproduksi presisi dengan bahan pilihan agar produk Anda tampil profesional dan menarik pembeli.',
      isActive: true,
      cards: [
        categoryCard('card_kemasan', 'Stiker Label Produk', 1),
        categoryCard('card_kemasan', 'Box Kemasan Custom', 2),
        categoryCard('card_kemasan', 'Paper Bag', 3),
        categoryCard('card_kemasan', 'Standing Pouch', 4),
        categoryCard('card_kemasan', 'Sleeve & Belt', 5),
        categoryCard('card_kemasan', 'Wrapping Paper', 6),
        categoryCard('card_kemasan', 'Spunbond Bag', 7),
        categoryCard('card_kemasan', 'Corrugated Box', 8)
      ]
    },
    {
      id: 'cat_stationery',
      key: 'stationery',
      title: 'STATIONERY',
      heading: 'Cetak Custom Stationery untuk Identitas Bisnis yang Rapi',
      description:
        'Kartu nama, kop surat, amplop, hingga company profile dengan kertas pilihan dan finishing elegan untuk kebutuhan administrasi bisnis Anda.',
      isActive: true,
      cards: [
        categoryCard('card_stationery', 'Kartu Nama', 1),
        categoryCard('card_stationery', 'Kop Surat', 2),
        categoryCard('card_stationery', 'Amplop Custom', 3),
        categoryCard('card_stationery', 'Notepad', 4),
        categoryCard('card_stationery', 'Agenda Custom', 5),
        categoryCard('card_stationery', 'Company Profile', 6),
        categoryCard('card_stationery', 'Katalog Produk', 7),
        categoryCard('card_stationery', 'Map Folder', 8)
      ]
    },
    {
      id: 'cat_promosi',
      key: 'promosi',
      title: 'PROMOSI',
      heading: 'Cetak Custom Media Promosi untuk Kampanye yang Menjual',
      description:
        'Brosur, flyer, booklet, kalender, hingga banner dengan warna tajam dan bahan tahan cuaca agar pesan promosi Anda tersampaikan maksimal.',
      isActive: true,
      cards: [
        categoryCard('card_promosi', 'Brosur', 1),
        categoryCard('card_promosi', 'Flyer', 2),
        categoryCard('card_promosi', 'Booklet', 3),
        categoryCard('card_promosi', 'Kalender', 4),
        categoryCard('card_promosi', 'Banner Spanduk', 5),
        categoryCard('card_promosi', 'X-Banner', 6),
        categoryCard('card_promosi', 'Stiker Promo', 7),
        categoryCard('card_promosi', 'Voucher', 8)
      ]
    },
    {
      id: 'cat_souvenir',
      key: 'souvenir',
      title: 'SOUVENIR',
      heading: 'Cetak Custom Souvenir untuk Klien, Relasi, dan Tim Anda',
      description:
        'Tumbler, tas canvas, plakat akrilik, hingga merchandise event yang bisa dicetak sesuai logo dan identitas brand Anda.',
      isActive: true,
      cards: [
        categoryCard('card_souvenir', 'Tumbler Custom', 1),
        categoryCard('card_souvenir', 'T-Shirt Sablon', 2),
        categoryCard('card_souvenir', 'Tas Canvas', 3),
        categoryCard('card_souvenir', 'Gantungan Kunci', 4),
        categoryCard('card_souvenir', 'Plakat Akrilik', 5),
        categoryCard('card_souvenir', 'Mug Custom', 6)
      ]
    }
  ],

  templatePromos: [
    {
      id: 'tpl_1',
      eyebrow: 'TEMPLATE DESIGN',
      title: 'Stiker Label Kemasan Siap Pakai',
      ctaText: 'Klik Di Sini',
      imageUrl: undefined,
      isActive: true
    },
    {
      id: 'tpl_2',
      eyebrow: 'TEMPLATE DESIGN',
      title: 'Box Kemasan Full Color Siap Pakai',
      ctaText: 'Klik Di Sini',
      imageUrl: undefined,
      isActive: true
    }
  ],

  problem: {
    title: 'PROBLEM CUSTOMER',
    imageUrl: undefined,
    points: [
      { id: 'pp_1', text: 'MOQ (Minimum Order Quantity) terlalu besar', side: 'left' },
      { id: 'pp_2', text: 'Tidak mengerti teknik kemasan sehingga budget membengkak', side: 'left' },
      { id: 'pp_3', text: 'Tidak mengerti membuat layout kemasan yang diinginkan', side: 'left' },
      { id: 'pp_4', text: 'Vendor slow respon dalam melayani customer', side: 'right' },
      { id: 'pp_5', text: 'Hasil produksi tidak sesuai spesifikasi pesanan', side: 'right' },
      { id: 'pp_6', text: 'Produksi tidak sesuai deadline', side: 'right' }
    ],
    primaryCtaText: 'Konsultasi Gratis',
    secondaryCtaText: 'Download Katalog'
  },

  stats: [
    {
      id: 'stat_1',
      value: '8th',
      label: 'Tahun Pengalaman',
      description: 'Melayani kebutuhan cetak kemasan, stationery, promosi, dan souvenir sejak 2018.',
      iconUrl: undefined,
      isActive: true
    },
    {
      id: 'stat_2',
      value: '15rb',
      label: 'Customer telah Dilayani',
      description: 'Dari UMKM, brand lokal, hingga perusahaan yang rutin mencetak bersama kami.',
      iconUrl: undefined,
      isActive: true
    },
    {
      id: 'stat_3',
      value: '40rb',
      label: 'Produk Cetak telah Dihasilkan',
      description: 'Diproduksi dengan mesin sendiri dan kontrol kualitas di setiap tahap.',
      iconUrl: undefined,
      isActive: true
    }
  ],

  facilities: [
    { id: 'fac_1', title: 'Mesin Digital Printing', imageUrl: undefined, isActive: true },
    { id: 'fac_2', title: 'Mesin Laser Cutting', imageUrl: undefined, isActive: true },
    { id: 'fac_3', title: 'Mesin Laminasi & Finishing', imageUrl: undefined, isActive: true },
    { id: 'fac_4', title: 'Cutting Plotter Presisi', imageUrl: undefined, isActive: true }
  ],

  blogPosts: [
    {
      id: 'blog_1',
      title: 'Panduan Memilih Bahan Stiker Label untuk Produk UMKM',
      imageUrl: undefined,
      url: '',
      isActive: true
    },
    {
      id: 'blog_2',
      title: 'Ukuran Paper Bag Standar yang Cocok untuk Toko Anda',
      imageUrl: undefined,
      url: '',
      isActive: true
    },
    {
      id: 'blog_3',
      title: 'Tips Menyiapkan File Cetak Agar Hasil Tidak Melowong',
      imageUrl: undefined,
      url: '',
      isActive: true
    }
  ],

  faqs: [
    {
      id: 'faq_1',
      question: 'Berapa minimum order untuk cetak custom?',
      answer:
        'Minimum order menyesuaikan jenis produk. Untuk stiker label mulai 100 pcs, stationery mulai 1 rim, dan souvenir mulai 12 pcs. Silakan konsultasikan kebutuhan Anda untuk rekomendasi terbaik.',
      isActive: true
    },
    {
      id: 'faq_2',
      question: 'Berapa lama proses produksi?',
      answer:
        'Rata-rata 3–7 hari kerja setelah desain dan pembayaran dikonfirmasi. Untuk kebutuhan mendesak, tersedia layanan ekspres dengan penyesuaian biaya.',
      isActive: true
    },
    {
      id: 'faq_3',
      question: 'Apakah bisa kirim ke seluruh Indonesia?',
      answer:
        'Bisa. Kami bekerja sama dengan ekspedisi terpercaya dan mengirim ke seluruh Indonesia. Ongkos kirim dihitung berdasarkan berat dan tujuan.',
      isActive: true
    },
    {
      id: 'faq_4',
      question: 'Apakah menerima desain dari customer?',
      answer:
        'Tentu. Anda dapat mengirim file desain siap cetak (PDF, AI, CDR, atau PNG resolusi tinggi). Jika belum punya desain, tim kami siap membantu pembuatan layout.',
      isActive: true
    },
    {
      id: 'faq_5',
      question: 'Bagaimana cara pembayarannya?',
      answer:
        'Pembayaran dapat dilakukan melalui transfer bank atau QRIS. Untuk pesanan bernilai besar berlaku DP 50% sebelum produksi dan pelunasan sebelum pengiriman.',
      isActive: true
    },
    {
      id: 'faq_6',
      question: 'Apakah ada garansi jika hasil tidak sesuai?',
      answer:
        'Ya. Jika terdapat kesalahan produksi dari pihak kami, pesanan akan dicetak ulang tanpa biaya tambahan. Klaim dapat diajukan maksimal 3 hari setelah barang diterima.',
      isActive: true
    }
  ],

  contact: {
    whatsappNumber: '6281234567890',
    whatsappMessageTemplate: 'Halo Bejo Stiker! Saya ingin order / tanya info produk dan layanan berikut:',
    storeAddress: 'Jl. Raya Utama No. 88 (Dekat Polsek), Indonesia',
    phoneDisplay: '0812-3456-7890',
    operatingHours: 'Senin - Sabtu: 08.00 - 20.00 WIB | Minggu: 09.00 - 17.00 WIB',
    googleMapsUrl: 'https://maps.google.com',
    emailDisplay: 'order@bejostiker.id',
    factoryAddress: 'Jl. Industri Kecil No. 12, Workshop Produksi, Indonesia'
  },

  about: {
    eyebrow: 'Tentang Kami',
    title: 'Berkembang Bersama Dedikasi & Inovasi',
    intro:
      'Seperti benih yang tumbuh menjadi pohon besar, BEJO STIKER memulai perjalanan dengan dasar yang kuat: stok lengkap, harga tangan pertama, dan kerja keras setiap hari untuk memenuhi kebutuhan cetak pelanggan.',
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
    {
      id: 'gal_1',
      title: 'Rak Gudang Stiker Vinyl',
      description: 'Ratusan roll merk dunia selalu ready stock.',
      imageUrl: undefined,
      isActive: true
    },
    {
      id: 'gal_2',
      title: 'Mesin Digital Printing',
      description: 'Cetak hi-res tinta eco-solvent tahan lama.',
      imageUrl: undefined,
      isActive: true
    },
    {
      id: 'gal_3',
      title: 'Mesin Laser Cutting CNC',
      description: 'Potongan halus presisi ±0.1mm.',
      imageUrl: undefined,
      isActive: true
    },
    {
      id: 'gal_4',
      title: 'Proses Wrapping Mobil',
      description: 'Pemasangan dikerjakan teknisi berpengalaman.',
      imageUrl: undefined,
      isActive: true
    }
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
      company: 'Kreasi Gifts',
      logoUrl: undefined,
      isActive: true
    },
    {
      id: 'testi_4',
      quote: 'Pesanan kemasan produk kami selalu rapi dan konsisten. Timnya responsif saat ada revisi desain.',
      author: 'Sarah',
      role: 'Founder Skincare Lokal',
      company: 'Glowlab',
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
    { id: 'cli_6', name: 'Kreasi Gifts', logoUrl: undefined, websiteUrl: undefined, isActive: true },
    { id: 'cli_7', name: 'Glowlab', logoUrl: undefined, websiteUrl: undefined, isActive: true },
    { id: 'cli_8', name: 'Kopi Senja', logoUrl: undefined, websiteUrl: undefined, isActive: true }
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
    { id: 'soc_tokopedia', label: 'Tokopedia', url: 'https://tokopedia.com/bejostiker', isActive: true }
  ],

  footerColumns: [
    {
      id: 'fc_1',
      heading: 'CETAK CUSTOM',
      blocks: [
        {
          id: 'fcb_1',
          title: 'Kemasan',
          links: [
            { id: 'fcl_1', label: 'Stiker Label Produk', categoryKey: 'kemasan' },
            { id: 'fcl_2', label: 'Box Kemasan Custom', categoryKey: 'kemasan' },
            { id: 'fcl_3', label: 'Paper Bag', categoryKey: 'kemasan' },
            { id: 'fcl_4', label: 'Standing Pouch', categoryKey: 'kemasan' },
            { id: 'fcl_5', label: 'Sleeve & Belt', categoryKey: 'kemasan' },
            { id: 'fcl_6', label: 'Wrapping Paper', categoryKey: 'kemasan' }
          ]
        }
      ]
    },
    {
      id: 'fc_2',
      heading: 'CETAK CUSTOM',
      blocks: [
        {
          id: 'fcb_2',
          title: 'Stationery',
          links: [
            { id: 'fcl_7', label: 'Kartu Nama', categoryKey: 'stationery' },
            { id: 'fcl_8', label: 'Kop Surat', categoryKey: 'stationery' },
            { id: 'fcl_9', label: 'Amplop Custom', categoryKey: 'stationery' },
            { id: 'fcl_10', label: 'Notepad', categoryKey: 'stationery' },
            { id: 'fcl_11', label: 'Agenda Custom', categoryKey: 'stationery' },
            { id: 'fcl_12', label: 'Company Profile', categoryKey: 'stationery' },
            { id: 'fcl_13', label: 'Katalog Produk', categoryKey: 'stationery' },
            { id: 'fcl_14', label: 'Map Folder', categoryKey: 'stationery' }
          ]
        }
      ]
    },
    {
      id: 'fc_3',
      heading: 'CETAK CUSTOM',
      blocks: [
        {
          id: 'fcb_3',
          title: 'Promosi',
          links: [
            { id: 'fcl_15', label: 'Brosur', categoryKey: 'promosi' },
            { id: 'fcl_16', label: 'Flyer', categoryKey: 'promosi' },
            { id: 'fcl_17', label: 'Booklet', categoryKey: 'promosi' },
            { id: 'fcl_18', label: 'Kalender', categoryKey: 'promosi' },
            { id: 'fcl_19', label: 'Banner Spanduk', categoryKey: 'promosi' },
            { id: 'fcl_20', label: 'X-Banner', categoryKey: 'promosi' }
          ]
        },
        {
          id: 'fcb_4',
          title: 'Souvenir',
          links: [
            { id: 'fcl_21', label: 'Tumbler Custom', categoryKey: 'souvenir' },
            { id: 'fcl_22', label: 'T-Shirt Sablon', categoryKey: 'souvenir' },
            { id: 'fcl_23', label: 'Tas Canvas', categoryKey: 'souvenir' },
            { id: 'fcl_24', label: 'Gantungan Kunci', categoryKey: 'souvenir' },
            { id: 'fcl_25', label: 'Plakat Akrilik', categoryKey: 'souvenir' }
          ]
        }
      ]
    },
    {
      id: 'fc_4',
      heading: 'TEMPLATE DESIGN',
      blocks: [
        {
          id: 'fcb_5',
          title: 'Template',
          links: [
            { id: 'fcl_26', label: 'Box Siap Pakai', categoryKey: 'kemasan' },
            { id: 'fcl_27', label: 'Kartu Nama', categoryKey: 'stationery' },
            { id: 'fcl_28', label: 'Kalender', categoryKey: 'promosi' },
            { id: 'fcl_29', label: 'T-Shirt', categoryKey: 'souvenir' }
          ]
        },
        {
          id: 'fcb_6',
          title: 'Events',
          links: [
            { id: 'fcl_30', label: 'Imlek', categoryKey: 'kemasan' },
            { id: 'fcl_31', label: 'Lebaran', categoryKey: 'kemasan' },
            { id: 'fcl_32', label: 'Natal', categoryKey: 'kemasan' },
            { id: 'fcl_33', label: 'Tahun Baru', categoryKey: 'promosi' }
          ]
        }
      ]
    },
    {
      id: 'fc_5',
      heading: 'TENTANG KAMI',
      blocks: [
        {
          id: 'fcb_7',
          links: [
            { id: 'fcl_34', label: 'Tentang Kami', page: 'about' },
            { id: 'fcl_35', label: 'Kontak', page: 'contact' },
            { id: 'fcl_36', label: 'Klien Kami', page: 'clients' },
            { id: 'fcl_37', label: 'Inspirasi Cetak', page: 'blog' },
            { id: 'fcl_38', label: 'Portfolio', page: 'clients' },
            { id: 'fcl_39', label: 'FAQ', page: 'contact' },
            { id: 'fcl_40', label: 'Konsultasi Gratis', page: 'contact' }
          ]
        }
      ]
    }
  ],

  footerNote: 'Percetakan online untuk kemasan, stationery, promosi, dan souvenir bisnis Anda.'
};

/**
 * Melengkapi data lama (format subur.co.id) agar tetap kompatibel
 * dengan struktur baru (format uprint.id).
 */
function migrateConfig(parsed: unknown): LandingPageConfig {
  const raw = (parsed ?? {}) as Record<string, any>;
  const defaults = DEFAULT_LANDING_CONFIG;

  /* buang field format lama (subur.co.id) agar tidak menumpuk di localStorage */
  const {
    brands: _legacyBrands,
    services: _legacyServices,
    featuredProducts: _legacyProducts,
    benefits: _legacyBenefits,
    ...clean
  } = raw;

  const hero = { ...defaults.hero, ...(clean.hero || {}) };
  const contact = { ...defaults.contact, ...(clean.contact || {}) };

  // Slide lama belum punya `eyebrow`
  const slides = Array.isArray(clean.slides) && clean.slides.length > 0
    ? (clean.slides as any[]).map((s, i) => ({
        id: s?.id || `slide_${i + 1}`,
        eyebrow: typeof s?.eyebrow === 'string' ? s.eyebrow : defaults.slides[0]?.eyebrow || '',
        title: s?.title || '',
        subtitle: s?.subtitle || '',
        ctaText: s?.ctaText || '',
        imageUrl: s?.imageUrl,
        isActive: s?.isActive !== false
      }))
    : defaults.slides;

  const categories = Array.isArray(clean.categories) && clean.categories.length > 0
    ? (clean.categories as any[]).map((c) => ({
        ...c,
        cards: Array.isArray(c?.cards) ? c.cards : []
      }))
    : defaults.categories;

  /* menu lama belum punya `position` (kiri/kanan di header) */
  const menu = Array.isArray(clean.menu) && clean.menu.length > 0
    ? (clean.menu as any[]).map((m) => ({
        ...m,
        position:
          m?.position === 'right' || m?.position === 'left'
            ? m.position
            : defaults.menu.find((d) => d.id === m?.id)?.position ?? (m?.type === 'link' ? 'right' : 'left')
      }))
    : defaults.menu;

  return {
    ...defaults,
    ...clean,
    isPublished: clean.isPublished !== false,
    hero,
    brand: { ...defaults.brand, ...(clean.brand || {}) },
    contact,
    slides,
    categories,
    menu,
    templatePromos: Array.isArray(clean.templatePromos) && clean.templatePromos.length > 0
      ? clean.templatePromos
      : defaults.templatePromos,
    problem: { ...defaults.problem, ...(clean.problem || {}) },
    stats: Array.isArray(clean.stats) && clean.stats.length > 0 ? clean.stats : defaults.stats,
    facilities: Array.isArray(clean.facilities) && clean.facilities.length > 0 ? clean.facilities : defaults.facilities,
    blogPosts: Array.isArray(clean.blogPosts) && clean.blogPosts.length > 0 ? clean.blogPosts : defaults.blogPosts,
    faqs: Array.isArray(clean.faqs) && clean.faqs.length > 0 ? clean.faqs : defaults.faqs,
    about: { ...defaults.about, ...(clean.about || {}) },
    gallery: Array.isArray(clean.gallery) && clean.gallery.length > 0 ? clean.gallery : defaults.gallery,
    testimonials: Array.isArray(clean.testimonials) && clean.testimonials.length > 0
      ? clean.testimonials
      : defaults.testimonials,
    clients: Array.isArray(clean.clients) && clean.clients.length > 0 ? clean.clients : defaults.clients,
    offices: Array.isArray(clean.offices) && clean.offices.length > 0 ? clean.offices : defaults.offices,
    socials: Array.isArray(clean.socials) && clean.socials.length > 0 ? clean.socials : defaults.socials,
    footerColumns: Array.isArray(clean.footerColumns) && clean.footerColumns.length > 0
      ? clean.footerColumns
      : defaults.footerColumns,
    footerNote: typeof clean.footerNote === 'string' ? clean.footerNote : defaults.footerNote
  };
}

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
    return migrateConfig(JSON.parse(raw));
  } catch (err) {
    console.error('Failed to parse landing config, falling back to defaults:', err);
    return DEFAULT_LANDING_CONFIG;
  }
}

/**
 * Saves updated Landing Page configuration to LocalStorage and dispatches an event
 */
export function saveStoredLandingConfig(config: LandingPageConfig): LandingPageConfig {
  const toSave: LandingPageConfig = {
    ...config,
    lastModifiedAt: Date.now()
  };
  try {
    localStorage.setItem(LANDING_PAGE_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.error('Failed to save landing page config:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bejo_landing_config_updated', { detail: toSave }));
  }
  return toSave;
}

/* -------------------------------------------------------------------------- */
/*  Draft vs Published                                                        */
/* -------------------------------------------------------------------------- */
/**
 * Draft = konten yang sedang diedit di dashboard. Tidak pernah tampil ke publik
 * sampai tombol "Simpan & Publish" ditekan.
 */
export function getStoredLandingDraft(): LandingPageConfig {
  try {
    const raw = localStorage.getItem(LANDING_PAGE_DRAFT_STORAGE_KEY);
    if (!raw) return getStoredLandingConfig();
    return migrateConfig(JSON.parse(raw));
  } catch (err) {
    console.error('Failed to parse landing draft, falling back to published:', err);
    return getStoredLandingConfig();
  }
}

export function saveStoredLandingDraft(config: LandingPageConfig): LandingPageConfig {
  const toSave: LandingPageConfig = {
    ...config,
    lastModifiedAt: Date.now()
  };
  try {
    localStorage.setItem(LANDING_PAGE_DRAFT_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.error('Failed to save landing draft:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bejo_landing_draft_updated', { detail: toSave }));
  }
  return toSave;
}

export function resetLandingDraftToDefault(): LandingPageConfig {
  const def: LandingPageConfig = {
    ...JSON.parse(JSON.stringify(DEFAULT_LANDING_CONFIG)),
    lastModifiedAt: Date.now()
  };
  try {
    localStorage.setItem(LANDING_PAGE_DRAFT_STORAGE_KEY, JSON.stringify(def));
  } catch (err) {
    console.error('Failed to reset landing draft:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bejo_landing_draft_updated', { detail: def }));
  }
  return def;
}

/** Snapshot yang siap ditayangkan ke publik (wajib isPublished = true). */
export function buildPublishedLandingConfig(config: LandingPageConfig): LandingPageConfig {
  const now = Date.now();
  return {
    ...config,
    isPublished: true,
    lastModifiedAt: now,
    lastPublishedAt: now
  };
}

/** Field internal PocketBase yang tidak boleh memengaruhi perbandingan konten. */
const PB_META_KEYS = ['id', 'legacyId', 'created', 'updated', 'collectionId', 'collectionName', 'expand'];

function stripPbMeta(value: LandingPageConfig): Record<string, any> {
  const copy = JSON.parse(JSON.stringify(value));
  for (const key of PB_META_KEYS) delete copy[key];
  delete copy.lastModifiedAt;
  delete copy.lastPublishedAt;
  return copy;
}

/** Bandingkan draft vs published tanpa terpengaruh timestamp. */
export function isLandingConfigEqual(a: LandingPageConfig, b: LandingPageConfig): boolean {
  return JSON.stringify(stripPbMeta(a)) === JSON.stringify(stripPbMeta(b));
}

/**
 * Bandingkan ISI konten saja. Status publish (isPublished) tidak dihitung
 * karena tombol On Hold / Publish mengubah status, bukan isi halaman.
 */
export function isLandingContentEqual(a: LandingPageConfig, b: LandingPageConfig): boolean {
  const left = stripPbMeta(a);
  const right = stripPbMeta(b);
  delete left.isPublished;
  delete right.isPublished;
  return JSON.stringify(left) === JSON.stringify(right);
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
