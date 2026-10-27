import { getPB } from './pocketbase';
import type { RecordModel } from 'pocketbase';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'developer' | 'admin' | 'kasir' | 'agen' | 'spk';
  isActive: boolean;
  avatar?: string;
  created: string;
  updated: string;
}

/**
 * Wrapper autentikasi PocketBase.
 * - `signInWithEmail` : login user nyata (email + password)
 * - `signInAnonymously`: meminta token akun sinkronisasi dari server
 * - `signOut`         : keluar & hapus token
 */
export const auth = {
  /** User yang sedang login (null bila belum login) */
  get currentUser(): RecordModel | null {
    return (getPB().authStore.model as RecordModel | null) ?? null;
  },

  /** true bila session masih valid */
  get isAuthenticated(): boolean {
    return getPB().authStore.isValid;
  },

  /** true bila user yang login adalah akun sinkronisasi bersama */
  get isAnonymous(): boolean {
    const user = this.currentUser;
    return !!user && !!user.email && user.email.includes('sync@');
  },

  /** Inisialisasi: pulihkan sesi dari localStorage bila masih valid */
  async initialize(): Promise<void> {
    const pb = getPB();
    if (!pb.authStore.isValid) return;
    try {
      await pb.collection('users').authRefresh();
      console.log('[Auth] Sesi dipulihkan:', pb.authStore.model?.email);
    } catch {
      console.warn('[Auth] Sesi kedaluwarsa, dibersihkan.');
      pb.authStore.clear();
    }
  },

  /** Login dengan email + password */
  async signInWithEmail(email: string, password: string): Promise<RecordModel> {
    const pb = getPB();
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record;
  },

  /** Daftar user baru */
  async signUp(
    email: string,
    password: string,
    name: string,
    role: string = 'kasir'
  ): Promise<RecordModel> {
    const pb = getPB();
    return (await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name,
      role,
      isActive: true,
    })) as unknown as RecordModel;
  },

  /** Login memakai akun sinkronisasi bersama (diverifikasi server) */
  async signInAnonymously(): Promise<RecordModel | null> {
    const pb = getPB();
    try {
      const response = await fetch('/api/pocketbase/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.token || !data?.record) {
        console.warn('[Auth] Sesi sinkronisasi tidak tersedia:', data?.error || response.status);
        return null;
      }
      pb.authStore.save(data.token, data.record);
      return data.record as RecordModel;
    } catch (err) {
      console.warn('[Auth] Login sinkronisasi gagal:', err);
      return null;
    }
  },

  /** Keluar & hapus token */
  signOut(): void {
    getPB().authStore.clear();
  },

  /** Perbarui session dari server */
  async refreshAuth(): Promise<boolean> {
    const pb = getPB();
    if (!pb.authStore.isValid) return false;
    try {
      await pb.collection('users').authRefresh();
      return true;
    } catch {
      pb.authStore.clear();
      return false;
    }
  },

  /** Pantau perubahan session */
  onAuthChange(callback: (user: RecordModel | null) => void): () => void {
    return getPB().authStore.onChange((_token, model) =>
      callback((model as RecordModel | null) ?? null)
    );
  },
};
