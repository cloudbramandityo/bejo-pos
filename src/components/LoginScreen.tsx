/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useEffect, useState } from 'react';
import {
  User,
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle
} from 'lucide-react';
import { AppUser } from '../types';
import { StoreLogo } from './StoreLogo';
import {
  getSiteMode,
  loginAccount,
  PosAuthError,
  type SiteMode,
} from '../lib/posAuth';
import { getPublicBranding, type PublicBranding } from '../lib/branding';
import { APP_NAME, APP_VERSION } from '../config/brand';

interface LoginScreenProps {
  users: AppUser[];
  onLoginSuccess: (user: AppUser) => void;
  storeName?: string;
  onBackToLanding?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  users,
  onLoginSuccess,
  storeName = 'BEJO Digital Print',
  onBackToLanding,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [siteMode, setSiteMode] = useState<SiteMode | null>(null);
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSiteMode()
      .then((mode) => {
        if (!cancelled) setSiteMode(mode);
      })
      .catch(() => {
        // Mode publik dianggap aman secara default: tanpa konfirmasi server,
        // login lokal (password tersimpan di browser) tidak diizinkan.
        if (!cancelled) setSiteMode({ publicSite: true, mode: 'public', staffLoginReady: false, developerLoginReady: false });
      });
    getPublicBranding().then((value) => {
      if (!cancelled && value) setBranding(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const brandName = branding?.storeName || storeName;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMsg('Silakan masukkan username dan password.');
      return;
    }

    setIsLoading(true);

    try {
      // Verifikasi utama selalu di server. Password tidak pernah dibandingkan
      // di browser pada mode publik.
      const result = await loginAccount(cleanUsername, cleanPassword);
      const account = result.user;
      onLoginSuccess({
        id: account.id,
        username: account.username,
        password: '••••••••',
        name: account.name,
        role: account.role as AppUser['role'],
        phone: account.phone || '',
        spkRoleCategory: account.spkRoleCategory as AppUser['spkRoleCategory'],
        isActive: account.isActive !== false,
        createdAt: account.createdAt || '',
        avatarUrl: account.avatarUrl || '',
        mustChangePassword: account.mustChangePassword === true,
      });
      return;
    } catch (error) {
      const isPosError = error instanceof PosAuthError;
      const status = isPosError ? error.status : 0;

      // Fallback lokal HANYA untuk instalasi LAN/privat (bukan mode publik),
      // saat server atau PocketBase sedang tidak dapat memeriksa akun.
      const allowLegacyFallback = siteMode !== null && !siteMode.publicSite;
      const serverUnavailable =
        status === 0 ||
        (!isPosError && error instanceof TypeError) ||
        (isPosError && error.status === 503);

      if (allowLegacyFallback && serverUnavailable) {
        const knownUser = users.find(
          (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
        );
        if (knownUser && knownUser.password === cleanPassword) {
          if (knownUser.isActive === false) {
            setErrorMsg('Akun ini sedang dinonaktifkan. Hubungi Developer / Administrator.');
          } else {
            onLoginSuccess(knownUser);
          }
          return;
        }
      }

      if (status === 401) {
        setErrorMsg('Username atau Password salah! Periksa kembali data login Anda.');
      } else if (status === 403 || status === 429) {
        setErrorMsg(isPosError ? error.message : 'Login ditolak oleh server.');
      } else if (isPosError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Login gagal. Periksa koneksi ke server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 selection:bg-slate-350 selection:text-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Solid Header Branding */}
        <div className="bg-slate-50 text-slate-900 p-6 text-center border-b border-slate-200">
          <div className="flex justify-center mb-3">
            <StoreLogo
              size="2xl"
              rounded="rounded-xl"
              storeName={brandName}
              customLogoUrl={branding?.logoUrl}
              className="p-1 bg-white rounded-xl border border-slate-250 shadow-xs"
            />
          </div>
          <h1 className="text-lg font-black tracking-tight uppercase text-slate-900">
            {APP_NAME}
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Sistem Point of Sales & Manajemen Operasional
          </p>
        </div>

        {/* Login Form */}
        <div className="p-6 sm:p-7 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="font-medium">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Masukkan username"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all font-bold"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Masukkan password"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all font-bold"
                  autoComplete="current-password"
                  required
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#1e295d] hover:bg-[#151e44] active:scale-[0.99] text-white font-black text-xs tracking-wider uppercase rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>{isLoading ? 'Memproses...' : 'Masuk Aplikasi'}</span>
            </button>

            {onBackToLanding && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 mt-2"
              >
                <span>&larr; Kembali ke Halaman Awal</span>
              </button>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-2.5 text-center text-[11px] text-slate-500 font-mono">
          Coded by Langgo Bramandityo • {APP_NAME} v{APP_VERSION}
        </div>
      </div>
    </div>
  );
};
