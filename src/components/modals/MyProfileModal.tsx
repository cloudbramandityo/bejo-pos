/**
 * Profil mandiri: setiap user mengganti nama tampilan, foto profil, username
 * login, dan password-nya sendiri. Username boleh berbeda dari nama tampilan.
 *
 * Saat password masih password sementara dari Developer, modal ini tampil
 * terkunci (`forced`) sampai user membuat password sendiri.
 *
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  Trash2,
  User,
  AtSign,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import { AppUser } from '../../types';
import { updateMyAccount, PosAuthError } from '../../lib/posAuth';
import {
  MAX_AVATAR_DATA_URL_LENGTH,
  checkPasswordPolicy,
  checkUsernameFormat,
} from '../../utils/credentialPolicy';

interface MyProfileModalProps {
  isOpen: boolean;
  user: AppUser;
  /** True = password sementara, wajib diganti sebelum memakai aplikasi. */
  forced?: boolean;
  onClose: () => void;
  /**
   * Penutup saat modal terkunci: keluar dari sesi ini dan kembali ke halaman
   * login. Tanpa ini user yang tidak bisa/mau mengganti password terperangkap
   * karena flag mustChangePassword di sesi terus membuka modal ini lagi.
   */
  onExit?: () => void;
  onUpdated: (user: AppUser) => void;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const AVATAR_SIDES = [256, 224, 192, 160, 128];

/** Kompres foto dari perangkat menjadi JPEG data URL kecil (<= batas direktori). */
async function compressAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File yang dipilih bukan gambar.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Ukuran foto maksimal 15 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    for (const side of AVATAR_SIDES) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Browser tidak mendukung kompresi foto.');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.82, 0.7, 0.58, 0.46]) {
        const url = canvas.toDataURL('image/jpeg', quality);
        if (url.length <= MAX_AVATAR_DATA_URL_LENGTH) return url;
      }
    }
  } finally {
    bitmap.close?.();
  }
  throw new Error('Foto masih terlalu besar setelah dikompres. Pilih foto lain.');
}

export const MyProfileModal: React.FC<MyProfileModalProps> = ({
  isOpen,
  user,
  forced = false,
  onClose,
  onExit,
  onUpdated,
}) => {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDeveloper = user.role === 'DEVELOPER';
  // Developer tidak pernah tunduk pada aturan wajib ganti password: kredensialnya
  // berasal dari server (DEV_PASSWORD_HASH), bukan dari direktori staf.
  const forceChange = forced && !isDeveloper;

  useEffect(() => {
    if (!isOpen) return;
    setName(user.name);
    setUsername(user.username);
    setAvatarUrl(user.avatarUrl || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setError(null);
    setIsSaving(false);
  }, [isOpen, user.id, user.name, user.username, user.avatarUrl]);

  if (!isOpen) return null;

  const usernameChanged = username.trim().toLowerCase() !== user.username.toLowerCase();
  const passwordChanged = newPassword.trim().length > 0;
  // Password sementara: bila hanya membuat password baru, sesi ini sudah
  // terbukti sah sehingga password lama tidak perlu diketik.
  const temporaryBypass = forceChange && !usernameChanged && passwordChanged;
  const needsCurrentPassword = (usernameChanged || passwordChanged) && !temporaryBypass;

  const handlePickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setIsCompressing(true);
    try {
      const dataUrl = await compressAvatar(file);
      setAvatarUrl(dataUrl);
    } catch (err: any) {
      setError(err?.message || 'Foto gagal diproses. Pilih foto lain.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isDeveloper || isSaving || isCompressing) return;
    setError(null);

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanNewPassword = newPassword.trim();

    if (cleanName.length < 3) {
      setError('Nama tampilan wajib diisi (minimal 3 karakter).');
      return;
    }
    const usernameProblem = checkUsernameFormat(cleanUsername);
    if (usernameProblem) {
      setError(usernameProblem);
      return;
    }
    if (forceChange && !cleanNewPassword) {
      setError('Password baru wajib dibuat untuk melanjutkan.');
      return;
    }
    if (cleanNewPassword) {
      if (cleanNewPassword !== confirmPassword.trim()) {
        setError('Konfirmasi password baru tidak sama.');
        return;
      }
      const problem = checkPasswordPolicy(cleanUsername, cleanNewPassword);
      if (problem) {
        setError(problem.message);
        return;
      }
    }
    if (needsCurrentPassword && !currentPassword.trim()) {
      setError('Masukkan password saat ini untuk mengganti username atau password.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateMyAccount({
        name: cleanName,
        username: cleanUsername,
        avatarUrl,
        currentPassword: currentPassword.trim() || undefined,
        newPassword: cleanNewPassword || undefined,
      });
      onUpdated({
        ...user,
        id: updated.id || user.id,
        username: updated.username || cleanUsername,
        name: updated.name || cleanName,
        avatarUrl: updated.avatarUrl ?? avatarUrl,
        mustChangePassword: false,
      });
      onClose();
    } catch (err: any) {
      if (err instanceof PosAuthError) {
        if (err.code === 'INVALID_CURRENT_PASSWORD') {
          setError('Password saat ini salah. Periksa kembali.');
        } else {
          setError(err.message || 'Profil gagal disimpan.');
        }
      } else {
        setError(err?.message || 'Profil gagal disimpan ke server.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const initial = (name.trim() || user.username || '?').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">
        <div className="bg-gradient-to-r from-[#1e295d] via-[#1a2350] to-[#0ea5e9] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <User className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight uppercase">Profil Saya</h2>
              <p className="text-[11px] text-blue-100">Nama tampilan, foto, username, dan password akun Anda</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (forceChange) (onExit ?? onClose)();
              else onClose();
            }}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer"
            aria-label={forceChange ? 'Keluar dan kembali ke halaman login' : 'Tutup profil'}
            title={forceChange ? 'Keluar ke halaman login' : 'Tutup profil'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {forceChange && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-start gap-2 text-amber-900">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="text-[11px] leading-snug">
              <p className="font-bold">Akun Anda masih memakai password sementara dari Developer.</p>
              <p>Buat password sendiri sekarang. Setelah tersimpan, halaman lain aplikasi bisa dipakai.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {isDeveloper ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700 text-xs">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
              <div className="leading-snug">
                <p className="font-bold">Akun developer dikelola lewat server.</p>
                <p>Username dan password developer diatur dari konfigurasi server (DEV_USERNAME / DEV_PASSWORD_HASH), sehingga tidak dapat diubah dari menu ini.</p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Foto profil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-slate-500">{initial}</span>
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-xs font-bold text-slate-700">Foto Profil</p>
                  <p className="text-[10px] leading-snug text-slate-500">
                    Otomatis dikompres di perangkat. Foto tampil pada menu pengguna di aplikasi.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isCompressing}
                      className="px-3 py-1.5 bg-[#1e295d] hover:bg-[#151e44] disabled:bg-slate-400 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {isCompressing ? 'Memproses...' : 'Unggah Foto'}
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Foto
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handlePickFile}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Nama Tampilan (muncul di aplikasi)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  placeholder="cth: FIRA (Kasir 1)"
                  maxLength={80}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-slate-500" />
                  Username Login
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder="cth: fira_kasir"
                  autoComplete="username"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-mono"
                  required
                />
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  Username untuk login boleh berbeda dari nama tampilan. 3-32 karakter: huruf, angka, titik, garis bawah, atau strip.
                </p>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-3">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  Ganti Password {forceChange ? '(wajib)' : '(opsional)'}
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Password Saat Ini</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder={
                        needsCurrentPassword
                          ? 'Wajib diisi untuk mengganti username/password'
                          : forceChange
                            ? 'Tidak perlu bila hanya membuat password baru'
                            : 'Hanya perlu bila mengganti username/password'
                      }
                      autoComplete="current-password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Password Baru</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder={forceChange ? 'Password baru Anda' : 'Kosongkan bila tetap'}
                      autoComplete="new-password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Ulangi Password Baru</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="Ulangi password baru"
                      autoComplete="new-password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                    />
                  </div>
                </div>
                <p className="text-[10px] leading-snug text-slate-500">
                  Minimal 10 karakter, gabungan huruf dan angka, tidak memakai password yang dikenal publik (admin123, agen123, dll.) dan tidak mengikuti username.
                </p>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            {!forceChange && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                {isDeveloper ? 'Tutup' : 'Batal'}
              </button>
            )}
            {!isDeveloper && (
              <button
                type="submit"
                disabled={isSaving || isCompressing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                {isSaving ? 'Menyimpan...' : forceChange ? 'Simpan & Lanjutkan' : 'Simpan Profil'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
