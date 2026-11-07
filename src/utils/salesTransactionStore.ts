/**
 * Aturan penyusunan daftar penjualan di satu perangkat.
 *
 * Modul murni (hanya mengimpor tipe + pengenal nomor struk) supaya penjaga
 * regresi dapat menjalankannya di Node.
 */
import type { Transaction } from '../types';
import { parseReceiptId } from './formatters';

export type PlacedTransaction = {
  /** Transaksi yang benar-benar masuk daftar; null bila nomornya tidak bisa diselamatkan. */
  saved: Transaction | null;
  /** Daftar baru; sama dengan daftar lama bila tidak ada yang tersimpan. */
  list: Transaction[];
  /** Nomor yang berubah karena nomor usulan sudah dipakai. */
  renumberedFrom: string | null;
};

/**
 * Hasil satu tulis data penjualan, dipakai layar untuk menulis status yang
 * sebenarnya: tercatat di perangkat, terkirim ke server, atau menunggu dikirim.
 */
export type SalesWriteOutcome = {
  deviceSaved: boolean;
  serverSaved: boolean;
  queuedForRetry: boolean;
  error?: string;
};

/** Hasil pencatatan satu penjualan kasir. */
export type SalesSaveOutcome = SalesWriteOutcome & {
  saved: boolean;
  savedId?: string;
  renumberedFrom?: string | null;
};

/** Kalimat status untuk layar: apa yang sebenarnya terjadi pada satu tulis penjualan. */
export type SalesWriteNotice = { tone: 'success' | 'warning'; message: string };

/**
 * Satu tempat untuk kalimat "tersimpan / belum terkirim". `prefix` menyebut
 * aksinya ("Penjualan #X", "Perubahan #X", "Penghapusan #X"); layar tidak boleh
 * menyimpulkan keberhasilan hanya dari tombol yang baru ditekan operator.
 */
export function salesWriteNotice(prefix: string, outcome: SalesWriteOutcome): SalesWriteNotice {
  if (!outcome.deviceSaved) {
    return {
      tone: 'warning',
      message: `${prefix} tercatat, tetapi penyimpanan perangkat ini penuh sehingga salinan lama dipangkas.`,
    };
  }
  if (outcome.serverSaved) {
    return { tone: 'success', message: `${prefix} berhasil dan terkirim ke server.` };
  }
  if (outcome.queuedForRetry) {
    return {
      tone: 'warning',
      message: `${prefix} tersimpan di perangkat ini dan akan terkirim otomatis saat koneksi kembali.`,
    };
  }
  return {
    tone: 'warning',
    message: `${prefix} tersimpan di perangkat ini, belum terkirim ke server. Alasan: ${outcome.error || 'tidak ada jawaban.'}`,
  };
}

/** Urutkan terbaru lebih dulu, sama seperti daftar yang dibaca layar penjualan. */
export function sortTransactionsNewestFirst(list: Transaction[]): Transaction[] {
  return [...list].sort(
    (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  );
}

function hasId(list: Transaction[], id: string): boolean {
  return list.some((t) => t && sameReceiptId(t.id, id));
}

/**
 * Dua nomor struk adalah struk yang sama walau pemisahnya berbeda ("/" vs "_"),
 * karena id yang lewat server bisa kembali tanpa garis miring. Tanpa ini,
 * penjualan baru dengan nomor "/" tidak dianggap tabrakan dengan struk lama
 * berbentuk "_" dan keduanya tersimpan sebagai dua baris untuk satu struk.
 */
function sameReceiptId(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = parseReceiptId(a);
  const pb = parseReceiptId(b);
  return !!pa && !!pb && pa.year === pb.year && pa.month === pb.month && pa.seq === pb.seq;
}

/** Nomor struk berikutnya dalam bulan yang sama yang masih bebas. */
function nextFreeReceiptId(list: Transaction[], tx: Transaction): string | null {
  const parsed = parseReceiptId(tx.id);
  if (!parsed) return null;

  let highest = parsed.seq;
  list.forEach((t) => {
    const other = parseReceiptId(t.id);
    if (other && other.year === parsed.year && other.month === parsed.month && other.seq > highest) {
      highest = other.seq;
    }
  });

  for (let seq = highest + 1; seq <= highest + 500; seq += 1) {
    const candidate = `BS${parsed.year}/${parsed.month}/${String(seq).padStart(4, '0')}`;
    if (!hasId(list, candidate)) return candidate;
  }
  return null;
}

/**
 * Masukkan penjualan baru ke daftar.
 *
 * Nomor yang sudah dipakai tidak pernah menimpa struk lama: selama nomornya
 * berbentuk nomor struk, penjualannya disimpan dengan nomor berikutnya yang bebas.
 * Bentuk nomor lain (mis. hasil pemulihan cadangan) ditolak supaya tidak ada
 * transaksi yang hilang tanpa jejak.
 */
export function placeNewTransaction(list: Transaction[], tx: Transaction): PlacedTransaction {
  if (!tx || !tx.id) {
    return { saved: null, list, renumberedFrom: null };
  }

  if (!hasId(list, tx.id)) {
    return { saved: tx, list: sortTransactionsNewestFirst([tx, ...list]), renumberedFrom: null };
  }

  const rescuedId = nextFreeReceiptId(list, tx);
  if (!rescuedId) {
    return { saved: null, list, renumberedFrom: null };
  }

  const renumbered: Transaction = { ...tx, id: rescuedId };
  return {
    saved: renumbered,
    list: sortTransactionsNewestFirst([renumbered, ...list]),
    renumberedFrom: tx.id,
  };
}

/** Ganti satu transaksi (hasil edit) — baris lain tetap utuh. */
export function replaceTransaction(list: Transaction[], tx: Transaction): Transaction[] {
  return list.map((t) => (t.id === tx.id ? tx : t));
}

/** Buang satu transaksi (hasil hapus). */
export function removeTransaction(list: Transaction[], txId: string): Transaction[] {
  return list.filter((t) => t.id !== txId);
}
