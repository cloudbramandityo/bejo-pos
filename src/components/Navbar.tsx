/**
 * BEJO STIKER POS & DIGITAL PRINTING
 * Navbar aplikasi — dirapikan agar tidak menumpuk & nyaman dipakai di desktop & smartphone.
 *
 * Desktop  : 2 baris (identitas/status di atas, strip tab di bawah)
 * Mobile   : app bar + bottom tab bar + drawer "Lainnya" (semua tab selalu terjangkau)
 *
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Store,
  Layers,
  Users,
  Receipt,
  Clock,
  CloudCheck,
  Shield,
  Crown,
  ShoppingCart,
  LogOut,
  UserCog,
  ChevronDown,
  Package,
  UserCheck,
  Printer,
  Globe,
  FileText,
  Calculator,
  Menu,
  X,
  LayoutGrid,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { Shift, AppUser } from '../types';
import { DeveloperJokerIcon } from './DeveloperJokerIcon';
import { StoreLogo } from './StoreLogo';

type TabId =
  | 'pos'
  | 'inventory'
  | 'stock'
  | 'customers'
  | 'transactions'
  | 'shift'
  | 'agen'
  | 'spk'
  | 'landing_editor'
  | 'invoices'
  | 'tax';

type Tone = 'slate' | 'amber' | 'indigo' | 'blue' | 'emerald' | 'rose';
type GroupKey = 'Operasional' | 'Produksi' | 'Laporan & Keuangan' | 'Pengaturan' | 'Developer';

interface TabDef {
  id: TabId;
  label: string;
  nav: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  group: GroupKey;
  badge?: string;
}

const TONE_ACTIVE: Record<Tone, string> = {
  slate: 'bg-slate-900 text-white',
  amber: 'bg-amber-600 text-white',
  indigo: 'bg-indigo-600 text-white',
  blue: 'bg-blue-600 text-white',
  emerald: 'bg-emerald-600 text-white',
  rose: 'bg-rose-700 text-white',
};

const TONE_ICON: Record<Tone, string> = {
  slate: 'text-slate-500',
  amber: 'text-amber-600',
  indigo: 'text-indigo-600',
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
};

const TONE_HOVER: Record<Tone, string> = {
  slate: 'hover:bg-slate-200/80 hover:text-slate-900',
  amber: 'hover:bg-amber-100/80 hover:text-amber-900',
  indigo: 'hover:bg-indigo-100/80 hover:text-indigo-900',
  blue: 'hover:bg-blue-100/80 hover:text-blue-900',
  emerald: 'hover:bg-emerald-100/80 hover:text-emerald-900',
  rose: 'hover:bg-rose-100/80 hover:text-rose-900',
};

const GROUP_ORDER: GroupKey[] = ['Operasional', 'Produksi', 'Laporan & Keuangan', 'Pengaturan', 'Developer'];

const ALL_TABS: TabDef[] = [
  { id: 'pos', label: 'POS Kasir', nav: 'POS Kasir', short: 'POS', icon: Store, tone: 'slate', group: 'Operasional' },
  { id: 'inventory', label: 'Katalog Produk', nav: 'Katalog', short: 'Katalog', icon: Layers, tone: 'slate', group: 'Operasional' },
  { id: 'stock', label: 'Stok', nav: 'Stok', short: 'Stok', icon: Package, tone: 'slate', group: 'Operasional' },
  { id: 'agen', label: 'Portal Agen', nav: 'Agen', short: 'Agen', icon: UserCheck, tone: 'amber', group: 'Operasional' },
  { id: 'shift', label: 'Shift Kasir', nav: 'Shift', short: 'Shift', icon: Clock, tone: 'slate', group: 'Operasional' },
  { id: 'spk', label: 'SPK Cetak Digital', nav: 'SPK Cetak', short: 'SPK', icon: Printer, tone: 'indigo', group: 'Produksi', badge: 'DEV' },
  { id: 'transactions', label: 'Laporan', nav: 'Laporan', short: 'Laporan', icon: Receipt, tone: 'slate', group: 'Laporan & Keuangan' },
  { id: 'invoices', label: 'Invoice B2B', nav: 'Invoice', short: 'Invoice', icon: FileText, tone: 'blue', group: 'Laporan & Keuangan', badge: 'B2B' },
  { id: 'tax', label: 'Pajak', nav: 'Pajak', short: 'Pajak', icon: Calculator, tone: 'rose', group: 'Laporan & Keuangan', badge: 'DEV' },
  { id: 'customers', label: 'Pengaturan Toko', nav: 'Pengaturan', short: 'Toko', icon: Users, tone: 'slate', group: 'Pengaturan' },
  { id: 'landing_editor', label: 'Website', nav: 'Website', short: 'Website', icon: Globe, tone: 'emerald', group: 'Developer', badge: 'DEV' },
];

/* urutan prioritas tab pada bottom bar (mobile) */
const BOTTOM_PRIORITY: TabId[] = [
  'pos',
  'spk',
  'inventory',
  'transactions',
  'stock',
  'agen',
  'customers',
  'shift',
  'invoices',
  'tax',
  'landing_editor',
];

interface NavbarProps {
  currentTab: TabId;
  setCurrentTab: (tab: TabId) => void;
  activeShift: Shift | null;
  storeName?: string;
  /** Judul aplikasi (dapat diedit manual di tab Pengaturan) */
  appTitle?: string;
  logoUrl?: string;
  isCloudConnected?: boolean;
  onOpenShiftModal: () => void;
  currentUser: AppUser | null;
  onLogout: () => void;
  onOpenUserManagement?: () => void;
  onOpenDatabaseModal?: () => void;
  isStoreOnline?: boolean;
  onViewLandingPage?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  activeShift,
  storeName,
  appTitle,
  logoUrl,
  isCloudConnected = true,
  onOpenShiftModal,
  currentUser,
  onLogout,
  onOpenUserManagement,
  onOpenDatabaseModal,
  isStoreOnline = true,
  onViewLandingPage,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const displayStoreName = storeName || activeShift?.storeName || 'BEJO Polsek';
  const role = currentUser?.role || 'SPK';
  const isAgent = role === 'AGEN';
  const isDeveloper = role === 'DEVELOPER';
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN';
  const isSpk = role === 'SPK';

  const canAccessPos = !isAgent && !isSpk;
  const canAccessInventory = isDeveloper || isOwner || isAdmin;
  const canAccessCustomers = isDeveloper || isOwner || isAdmin;
  const canAccessTransactions = isDeveloper || isOwner || isAdmin;
  const canAccessShift = !isAgent && !isSpk;
  const canAccessAgen = isAgent || isDeveloper || isOwner || isAdmin;
  const canAccessSpk = isSpk || isDeveloper || isOwner || isAdmin || canAccessPos;
  const canAccessInvoice = isDeveloper || isAdmin || isOwner;

  const allowed = (id: TabId): boolean => {
    switch (id) {
      case 'pos':
        return canAccessPos;
      case 'inventory':
        return canAccessInventory;
      case 'stock':
        return canAccessInventory && isStoreOnline;
      case 'customers':
        return canAccessCustomers;
      case 'transactions':
        return canAccessTransactions;
      case 'shift':
        return canAccessShift;
      case 'agen':
        return canAccessAgen;
      case 'spk':
        return canAccessSpk;
      case 'landing_editor':
        return isDeveloper;
      case 'invoices':
        return canAccessInvoice;
      case 'tax':
        return isDeveloper || isAdmin;
      default:
        return false;
    }
  };

  const tabs = useMemo(() => ALL_TABS.filter((t) => allowed(t.id)), [role, isStoreOnline]);

  const bottomTabs = useMemo(
    () => BOTTOM_PRIORITY.filter((id) => allowed(id))
      .slice(0, 4)
      .map((id) => ALL_TABS.find((t) => t.id === id)!)
      .filter(Boolean),
    [role, isStoreOnline]
  );

  const groupedTabs = useMemo(
    () =>
      GROUP_ORDER.map((g) => ({ group: g, items: tabs.filter((t) => t.group === g) })).filter(
        (g) => g.items.length > 0
      ),
    [tabs]
  );

  const activeTab = tabs.find((t) => t.id === currentTab);

  const go = (id: TabId) => {
    setCurrentTab(id);
    setDrawerOpen(false);
    setShowUserMenu(false);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      /* ignore */
    }
  };

  /* tutup drawer saat tekan ESC */
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  /* kunci scroll body saat drawer terbuka (mobile) */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const RoleAvatar = () => {
    if (role === 'DEVELOPER') return <DeveloperJokerIcon size="md" rounded="rounded-md" />;
    if (role === 'OWNER')
      return (
        <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs">
          <Crown className="w-3.5 h-3.5" />
        </div>
      );
    if (role === 'ADMIN')
      return (
        <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs">
          <Shield className="w-3.5 h-3.5" />
        </div>
      );
    if (role === 'AGEN')
      return (
        <div className="w-6 h-6 rounded-md bg-amber-600 flex items-center justify-center text-white text-xs">
          <UserCheck className="w-3.5 h-3.5" />
        </div>
      );
    if (role === 'KASIR')
      return (
        <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center text-white text-xs">
          <ShoppingCart className="w-3.5 h-3.5" />
        </div>
      );
    if (role === 'SPK')
      return (
        <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs">
          <Printer className="w-3.5 h-3.5" />
        </div>
      );
    return (
      <div className="w-6 h-6 rounded-md bg-purple-600 flex items-center justify-center text-white text-xs">
        <UserCog className="w-3.5 h-3.5" />
      </div>
    );
  };

  return (
    <header className="no-print sticky top-0 z-40 bg-white border-b border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.06)] print:shadow-none">
      {/* ================= BARIS ATAS ================= */}
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 h-14 flex items-center gap-2 sm:gap-3">
        {/* Tombol menu (mobile) */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu aplikasi"
          className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 bg-white active:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand */}
        <button
          type="button"
          onClick={() => go(isSpk ? 'spk' : isAgent ? 'agen' : 'pos')}
          className="flex items-center gap-2.5 min-w-0 shrink sm:shrink"
          title={displayStoreName}
        >
          <StoreLogo size="md" rounded="rounded-xl" customLogoUrl={logoUrl} storeName={displayStoreName} />
          <div className="min-w-0 text-left">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-tight truncate whitespace-nowrap">
              {isSpk ? 'SPK Cetak Digital' : isAgent ? 'Portal Toko Agen' : appTitle || 'Point of Sales'}
            </h1>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate whitespace-nowrap hidden sm:block">
              {displayStoreName}
            </p>
            {/* judul tab aktif (mobile) */}
            <p className="text-[10.5px] font-semibold text-slate-500 truncate whitespace-nowrap sm:hidden">
              {activeTab?.label || 'Point of Sales'}
            </p>
          </div>
        </button>

        <div className="flex-1" />

        {/* Status cloud (developer) */}
        {isDeveloper && (
          <button
            type="button"
            onClick={onOpenDatabaseModal}
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isCloudConnected
                ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
            title="Pengaturan Database Lokal & Sinkronisasi Real-time (Khusus Developer)"
          >
            <CloudCheck className={`w-3.5 h-3.5 ${isCloudConnected ? 'text-indigo-600' : 'text-amber-600'}`} />
            <span>{isCloudConnected ? 'Hybrid Sync' : 'Mode Lokal'}</span>
          </button>
        )}

        {/* Status shift */}
        {canAccessShift ? (
          <button
            type="button"
            onClick={onOpenShiftModal}
            className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              activeShift
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
            }`}
            title="Lihat status shift kasir"
          >
            <span className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
            <span className="hidden sm:inline">Kasir:</span>
            <span className="font-bold uppercase truncate max-w-[84px]">{activeShift?.cashierName || 'Tutup'}</span>
          </button>
        ) : isAgent ? (
          <div
            className="px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-amber-50 text-amber-900 border-amber-300 max-w-[150px]"
            title="Cabang Agen Aktif"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
            <span className="font-bold uppercase truncate">{displayStoreName}</span>
          </div>
        ) : isSpk ? (
          <div
            className="px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-indigo-50 text-indigo-900 border-indigo-300"
            title="Operator Cetak Digital Aktif"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-bold uppercase hidden sm:inline">OPERATOR SPK</span>
          </div>
        ) : null}

        {/* Profil pengguna */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="Menu pengguna"
            className="flex items-center gap-2 p-1 pl-1.5 pr-1.5 sm:pl-2 sm:pr-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RoleAvatar />
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[140px]">
                {currentUser?.name || 'Pengguna'}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{role}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-60 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 divide-y divide-slate-100">
                <div className="px-3.5 py-2">
                  <div className="text-xs font-bold text-slate-900 truncate">{currentUser?.name}</div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">@{currentUser?.username}</div>
                  <div className="mt-1">
                    <span className="text-[10px] bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded inline-block border border-slate-200">
                      {role === 'DEVELOPER'
                        ? 'Master Developer'
                        : role === 'OWNER'
                          ? 'Owner / Pemilik Usaha'
                          : role === 'ADMIN'
                            ? 'Administrator'
                            : role === 'AGEN'
                              ? 'Agen Resmi'
                              : role === 'KASIR'
                                ? 'Kasir POS'
                                : role === 'SPK'
                                  ? 'Operator SPK Cetak'
                                  : `Role ${role}`}
                    </span>
                  </div>
                </div>

                {isDeveloper && onOpenUserManagement && (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenUserManagement();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <UserCog className="w-4 h-4 text-slate-600" />
                      <span>Kelola Wewenang Pengguna</span>
                    </button>
                  </div>
                )}

                {onViewLandingPage && (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onViewLandingPage();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 text-xs font-semibold text-indigo-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Globe className="w-4 h-4 text-indigo-600" />
                      <span>Lihat Landing Page Toko</span>
                    </button>
                  </div>
                )}

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-xs font-semibold text-rose-700 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar / Ganti Akun
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= STRIP TAB (DESKTOP) ================= */}
      <nav className="hidden lg:flex w-full max-w-[1440px] mx-auto px-3 sm:px-5 pb-2 -mt-0.5 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => go(tab.id)}
              title={tab.label}
              className={`shrink-0 flex items-center gap-1.5 px-2 xl:px-2.5 py-2 rounded-xl text-[11.5px] xl:text-[12.5px] font-semibold transition-all cursor-pointer ${
                isActive ? `${TONE_ACTIVE[tab.tone]} shadow-xs` : `text-slate-600 ${TONE_HOVER[tab.tone]}`
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : TONE_ICON[tab.tone]}`} />
              <span className="whitespace-nowrap">{tab.nav}</span>
              {tab.badge && (
                <span
                  className={`hidden xl:inline-block text-[8px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ================= DRAWER (MOBILE) ================= */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10 flex h-full w-[86%] max-w-[330px] flex-col bg-white shadow-2xl">
            {/* header drawer */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <StoreLogo size="md" rounded="rounded-xl" customLogoUrl={logoUrl} storeName={displayStoreName} />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 leading-tight truncate">
                    {isSpk ? 'SPK Cetak Digital' : isAgent ? 'Portal Toko Agen' : appTitle || 'Point of Sales'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                    {displayStoreName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 active:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* isi drawer */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-4">
              {groupedTabs.map(({ group, items }) => (
                <div key={group}>
                  <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {items.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = currentTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => go(tab.id)}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            isActive ? `${TONE_ACTIVE[tab.tone]}` : 'text-slate-700 active:bg-slate-100'
                          }`}
                        >
                          <Icon className={`w-4.5 h-4.5 w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : TONE_ICON[tab.tone]}`} />
                          <span className="flex-1 text-[13px] font-semibold truncate">{tab.label}</span>
                          {tab.badge && (
                            <span
                              className={`text-[8px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                                isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {tab.badge}
                            </span>
                          )}
                          {isActive && <ChevronRight className="w-4 h-4 text-white/80" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* tools developer */}
              {isDeveloper && (
                <div>
                  <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Tools</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenDatabaseModal?.();
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-slate-700 active:bg-slate-100"
                  >
                    <CloudCheck className="w-[18px] h-[18px] shrink-0 text-indigo-600" />
                    <span className="flex-1 text-[13px] font-semibold truncate">
                      {isCloudConnected ? 'Hybrid Sync (Lokal & Cloud)' : 'Mode Lokal (Offline)'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* footer drawer */}
            <div className="border-t border-slate-200 p-3 space-y-1">
              {onViewLandingPage && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onViewLandingPage();
                  }}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-indigo-700 active:bg-indigo-50"
                >
                  <Globe className="w-[18px] h-[18px] shrink-0 text-indigo-600" />
                  <span className="text-[13px] font-semibold">Lihat Landing Page Toko</span>
                </button>
              )}
              {isDeveloper && onOpenUserManagement && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenUserManagement();
                  }}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-slate-700 active:bg-slate-100"
                >
                  <UserCog className="w-[18px] h-[18px] shrink-0 text-slate-600" />
                  <span className="text-[13px] font-semibold">Kelola Wewenang Pengguna</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-rose-700 active:bg-rose-50"
              >
                <LogOut className="w-[18px] h-[18px] shrink-0" />
                <span className="text-[13px] font-semibold">Keluar / Ganti Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BOTTOM BAR (MOBILE) ================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-2px_12px_rgba(15,23,42,0.06)] flex items-stretch px-1 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))]">
        {bottomTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => go(tab.id)}
              className={`flex-1 min-w-0 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
                isActive ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-lg transition-colors ${
                  isActive ? 'bg-slate-900 text-white' : ''
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <span className={`text-[10px] truncate max-w-full px-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.short}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex-1 min-w-0 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500 transition-colors cursor-pointer"
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-lg">
            <LayoutGrid className="w-[18px] h-[18px]" />
          </span>
          <span className="text-[10px] font-medium truncate max-w-full px-0.5">Lainnya</span>
        </button>
      </nav>
    </header>
  );
};
