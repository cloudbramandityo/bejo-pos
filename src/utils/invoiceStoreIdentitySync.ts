/**
 * Jalur simpan & baca identitas penerbit invoice.
 *
 * Satu-satunya tempat yang boleh menulis identitas ke server dan ke salinan
 * bersama. Layar (InvoiceScreen) dan App memakai fungsi yang sama supaya tidak
 * ada lagi dua jalur yang saling menimpa dengan hasil berbeda.
 */

import type { InvoiceStoreIdentity } from '../types';
import { saveStoredInvoiceStoreIdentity } from './invoiceStorage';
import { stampIdentityForSave } from './invoiceStoreIdentityRules';
import { saveInvoiceStoreIdentityCloud } from '../backend/pocketbaseBackend';

const SERVER_ENDPOINT = '/api/invoices/store-identity';

export type IdentityWriteOutcome = {
  /** Nilai yang sekarang dipakai perangkat ini, termasuk waktu simpannya. */
  identity: InvoiceStoreIdentity;
  /** Terkirim ke penyimpanan bersama (server database). */
  sharedSaved: boolean;
  /** Terkirim ke layanan toko ini. */
  serverSaved: boolean;
  /** Alasan singkat bila salah satu tidak terkirim; kosong bila keduanya berhasil. */
  error?: string;
};

function shortReason(err: any): string {
  const raw = String(err?.message || err || '').trim();
  if (!raw) return 'tidak ada jawaban dari server';
  return raw.length > 90 ? `${raw.slice(0, 90)}…` : raw;
}

/**
 * Simpan identitas: selalu tersimpan di perangkat ini lebih dulu, lalu dikirim
 * ke salinan bersama dan layanan toko. Kegagalan kirim dilaporkan apa adanya —
 * bukan ditutupi dengan pesan sukses.
 */
export async function saveInvoiceIdentity(
  identity: InvoiceStoreIdentity
): Promise<IdentityWriteOutcome> {
  const stamped = stampIdentityForSave(identity);
  saveStoredInvoiceStoreIdentity(stamped);

  let sharedSaved = false;
  let error = '';

  try {
    await saveInvoiceStoreIdentityCloud(stamped);
    sharedSaved = true;
  } catch (err) {
    error = shortReason(err);
  }

  let serverSaved = false;
  try {
    const res = await fetch(SERVER_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stamped),
    });
    serverSaved = res.ok;
    if (!res.ok && !error) {
      error = res.status === 401 ? 'sesi login sudah lewat, silakan login lagi' : `server menolak (kode ${res.status})`;
    }
  } catch (err) {
    if (!error) error = shortReason(err);
  }

  return { identity: stamped, sharedSaved, serverSaved, error: error || undefined };
}

/**
 * Salin identitas ke penyimpanan perangkat ini TANPA mengirim ke mana pun.
 * Dipakai saat nilai baru datang dari server/perangkat lain, supaya tidak ada
 * gema kirim ulang.
 */
export function rememberInvoiceIdentityLocally(identity: InvoiceStoreIdentity): void {
  saveStoredInvoiceStoreIdentity(identity);
}

/**
 * Baca identitas yang disimpan layanan toko.
 * `ok` false berarti nilainya TIDAK terbaca — pemanggil tidak boleh menganggap
 * jawaban kosong sebagai "identitas dihapus".
 */
export async function readInvoiceIdentityFromServer(): Promise<{
  ok: boolean;
  identity: InvoiceStoreIdentity | null;
}> {
  try {
    const res = await fetch(SERVER_ENDPOINT, { credentials: 'same-origin' });
    if (!res.ok) return { ok: false, identity: null };
    const data = await res.json();
    const identity = data?.identity as InvoiceStoreIdentity | null;
    if (!identity || !identity.storeName) return { ok: false, identity: null };
    return { ok: true, identity };
  } catch {
    return { ok: false, identity: null };
  }
}
