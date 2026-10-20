/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState } from 'react';
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
  Calculator
} from 'lucide-react';
import { Shift, AppUser } from '../types';
import { DeveloperJokerIcon } from './DeveloperJokerIcon';
import { StoreLogo } from './StoreLogo';

interface NavbarProps {
  currentTab: 'pos' | 'inventory' | 'stock' | 'customers' | 'transactions' | 'shift' | 'agen' | 'spk' | 'landing_editor' | 'invoices' | 'tax';
  setCurrentTab: (tab: 'pos' | 'inventory' | 'stock' | 'customers' | 'transactions' | 'shift' | 'agen' | 'spk' | 'landing_editor' | 'invoices' | 'tax') => void;
  activeShift: Shift | null;
  storeName?: string;
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
  logoUrl,
  isCloudConnected = true,
  onOpenShiftModal,
  currentUser,
  onLogout,
  onOpenUserManagement,
  onOpenDatabaseModal,
  isStoreOnline = false,
  onViewLandingPage,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setCurrentTab(isSpk ? 'spk' : isAgent ? 'agen' : 'pos')}>
            <StoreLogo size="md" rounded="rounded-xl" customLogoUrl={logoUrl} storeName={displayStoreName} />
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-tight">
                {isSpk ? 'SPK Cetak Digital' : isAgent ? 'Portal Toko Agen' : 'Point of Sales'}
              </h1>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:block">
                {displayStoreName}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Clean Solid Navigation Buttons */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto text-xs font-semibold">
          {/* POS Tab */}
          {canAccessPos && (
            <button
              type="button"
              onClick={() => setCurrentTab('pos')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'pos'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Store className={`w-3.5 h-3.5 ${currentTab === 'pos' ? 'text-white' : 'text-slate-500'}`} />
              POS Kasir
            </button>
          )}

          {/* Inventory Tab */}
          {canAccessInventory && (
            <button
              type="button"
              onClick={() => setCurrentTab('inventory')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'inventory'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${currentTab === 'inventory' ? 'text-white' : 'text-slate-500'}`} />
              Katalog Produk
            </button>
          )}

          {/* Stock Tab */}
          {canAccessInventory && isStoreOnline && (
            <button
              type="button"
              onClick={() => setCurrentTab('stock')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'stock'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Package className={`w-3.5 h-3.5 ${currentTab === 'stock' ? 'text-white' : 'text-slate-500'}`} />
              Stok
            </button>
          )}

          {/* Agen Portal Tab */}
          {canAccessAgen && (
            <button
              type="button"
              onClick={() => setCurrentTab('agen')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'agen'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-amber-700 hover:text-amber-900 hover:bg-amber-100/70'
              }`}
              title="Portal Agen: Katalog & Pengambilan Bahan"
            >
              <UserCheck className={`w-3.5 h-3.5 ${currentTab === 'agen' ? 'text-white' : 'text-amber-600'}`} />
              <span>Agen</span>
            </button>
          )}

          {/* Customer & Settings Tab */}
          {canAccessCustomers && (
            <button
              type="button"
              onClick={() => setCurrentTab('customers')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'customers'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Users className={`w-3.5 h-3.5 ${currentTab === 'customers' ? 'text-white' : 'text-slate-500'}`} />
              Pengaturan Toko
            </button>
          )}

          {/* Transactions Tab */}
          {canAccessTransactions && (
            <button
              type="button"
              onClick={() => setCurrentTab('transactions')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'transactions'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Receipt className={`w-3.5 h-3.5 ${currentTab === 'transactions' ? 'text-white' : 'text-slate-500'}`} />
              Laporan
            </button>
          )}

          {/* Shift Tab */}
          {canAccessShift && (
            <button
              type="button"
              onClick={() => setCurrentTab('shift')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'shift'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${currentTab === 'shift' ? 'text-white' : 'text-slate-500'}`} />
              Shift Kasir
            </button>
          )}

          {/* SPK Cetak Digital Tab */}
          {canAccessSpk && (
            <button
              type="button"
              onClick={() => setCurrentTab('spk')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'spk'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100/70'
              }`}
              title="SPK & Alur Kerja Cetak Digital"
            >
              <Printer className={`w-3.5 h-3.5 ${currentTab === 'spk' ? 'text-white' : 'text-indigo-600'}`} />
              <span>SPK Cetak</span>
              {isDeveloper && (
                <span className="bg-indigo-800/80 text-[8.5px] text-white px-1.5 py-0.2 rounded-full font-mono font-bold">DEV</span>
              )}
            </button>
          )}

          {/* Invoice & Proforma Management Tab (DEVELOPER & ADMIN ONLY) */}
          {canAccessInvoice && (
            <button
              type="button"
              onClick={() => setCurrentTab('invoices')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'invoices'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-blue-700 hover:text-blue-900 hover:bg-blue-100/70'
              }`}
              title="Penerbitan Proforma Invoice (PI) & Invoice Final (INV)"
            >
              <FileText className={`w-3.5 h-3.5 ${currentTab === 'invoices' ? 'text-white' : 'text-blue-600'}`} />
              <span>Invoice</span>
              <span className="bg-blue-800 text-[8px] text-white px-1 py-0.2 rounded-full font-mono font-bold">B2B</span>
            </button>
          )}

          {/* Landing Page CMS Tab (DEVELOPER ONLY) */}
          {isDeveloper && (
            <button
              type="button"
              onClick={() => setCurrentTab('landing_editor')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'landing_editor'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/70'
              }`}
              title="Pengaturan & CMS Landing Page Toko (Khusus Developer)"
            >
              <Globe className={`w-3.5 h-3.5 ${currentTab === 'landing_editor' ? 'text-white' : 'text-emerald-600'}`} />
              <span>Landing Page</span>
              <span className="bg-emerald-800 text-[8.5px] text-white px-1.5 py-0.2 rounded-full font-mono font-bold">DEV</span>
            </button>
          )}

          {/* Tax / Pajak Module Tab (DEVELOPER ONLY) */}
          {isDeveloper && (
            <button
              type="button"
              onClick={() => setCurrentTab('tax')}
              className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'tax'
                  ? 'bg-rose-700 text-white shadow-xs font-bold'
                  : 'text-rose-700 hover:text-rose-900 hover:bg-rose-100/70'
              }`}
              title="Modul Pengisian Pajak Internal (Khusus Akun Developer)"
            >
              <Calculator className={`w-3.5 h-3.5 ${currentTab === 'tax' ? 'text-white' : 'text-rose-600'}`} />
              <span>Pajak</span>
              <span className="bg-rose-800 text-[8.5px] text-white px-1.5 py-0.2 rounded-full font-mono font-bold">DEV</span>
            </button>
          )}
        </nav>

        {/* Right: Cloud Sync, Shift Status & Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dual Database Sync Button (DEVELOPER ONLY) */}
          {isDeveloper && (
            <button
              type="button"
              onClick={onOpenDatabaseModal}
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isCloudConnected
                  ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
              title="Klik untuk membuka Pengaturan Database Lokal & Sinkronisasi Real-time (Khusus Developer)"
            >
              <CloudCheck className={`w-3.5 h-3.5 ${isCloudConnected ? 'text-indigo-600' : 'text-amber-600'}`} />
              <span>{isCloudConnected ? 'Hybrid Sync (Lokal & Cloud)' : 'Mode Lokal (Offline)'}</span>
            </button>
          )}

          {/* Shift Cashier Button (Only for Cashier/Admin/Owner/Dev, hidden for Agent & SPK role) */}
          {canAccessShift ? (
            <button
              type="button"
              onClick={onOpenShiftModal}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                activeShift
                  ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
              }`}
              title="Klik untuk melihat status shift"
            >
              <span className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
              <span className="hidden sm:inline">Kasir:</span>
              <span className="font-bold uppercase">{activeShift?.cashierName || 'Tutup'}</span>
            </button>
          ) : isAgent ? (
            <div
              className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-amber-50 text-amber-900 border-amber-300"
              title="Cabang Agen Aktif"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="font-bold uppercase">{displayStoreName}</span>
            </div>
          ) : isSpk ? (
            <div
              className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-indigo-50 text-indigo-900 border-indigo-300"
              title="Operator Cetak Digital Aktif"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-bold uppercase">OPERATOR SPK</span>
            </div>
          ) : null}

          {/* User Profile & Role Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer"
            >
              {role === 'DEVELOPER' && (
                <DeveloperJokerIcon size="md" rounded="rounded-md" />
              )}
              {role === 'OWNER' && (
                <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs">
                  <Crown className="w-3.5 h-3.5" />
                </div>
              )}
              {role === 'ADMIN' && (
                <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs">
                  <Shield className="w-3.5 h-3.5" />
                </div>
              )}
              {role === 'AGEN' && (
                <div className="w-6 h-6 rounded-md bg-amber-600 flex items-center justify-center text-white text-xs">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
              )}
              {role === 'KASIR' && (
                <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center text-white text-xs">
                  <ShoppingCart className="w-3.5 h-3.5" />
                </div>
              )}
              {role === 'SPK' && (
                <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs">
                  <Printer className="w-3.5 h-3.5" />
                </div>
              )}
              {!['DEVELOPER', 'OWNER', 'ADMIN', 'AGEN', 'KASIR', 'SPK'].includes(role) && (
                <div className="w-6 h-6 rounded-md bg-purple-600 flex items-center justify-center text-white text-xs">
                  <UserCog className="w-3.5 h-3.5" />
                </div>
              )}

              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser?.name || 'Pengguna'}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {role}
                </div>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <>
                {/* Backdrop to close dropdown on clicking outside */}
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setShowUserMenu(false)}
                />
                <div
                  className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 divide-y divide-slate-100"
                  onMouseLeave={() => setShowUserMenu(false)}
                >
                  <div className="px-3.5 py-2">
                    <div className="text-xs font-bold text-slate-900">{currentUser?.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">@{currentUser?.username}</div>
                    <div className="mt-1">
                      <span className="text-[10px] bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded inline-block border border-slate-200">
                        {role === 'DEVELOPER' ? 'Master Developer' : role === 'OWNER' ? 'Owner / Pemilik Usaha' : role === 'ADMIN' ? 'Administrator' : role === 'AGEN' ? 'Agen Resmi' : role === 'KASIR' ? 'Kasir POS' : role === 'SPK' ? 'Operator SPK Cetak' : `Role ${role}`}
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
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg md:hidden flex items-center justify-around px-1 py-1">
        {canAccessSpk && (
          <button
            type="button"
            onClick={() => setCurrentTab('spk')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'spk' ? 'text-indigo-600 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <Printer className="w-5 h-5" />
            <span className="text-[10px]">SPK Cetak</span>
          </button>
        )}

        {canAccessPos && (
          <button
            type="button"
            onClick={() => setCurrentTab('pos')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'pos' ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <Store className="w-5 h-5" />
            <span className="text-[10px]">POS Kasir</span>
          </button>
        )}

        {canAccessInventory && (
          <button
            type="button"
            onClick={() => setCurrentTab('inventory')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'inventory' ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[10px]">Katalog</span>
          </button>
        )}

        {canAccessInventory && isStoreOnline && (
          <button
            type="button"
            onClick={() => setCurrentTab('stock')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'stock' ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px]">Stok</span>
          </button>
        )}

        {canAccessAgen && (
          <button
            type="button"
            onClick={() => setCurrentTab('agen')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'agen' ? 'text-amber-600 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <UserCheck className="w-5 h-5" />
            <span className="text-[10px]">Agen</span>
          </button>
        )}

        {canAccessCustomers && (
          <button
            type="button"
            onClick={() => setCurrentTab('customers')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'customers' ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Toko</span>
          </button>
        )}

        {canAccessTransactions && (
          <button
            type="button"
            onClick={() => setCurrentTab('transactions')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'transactions' ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px]">Laporan</span>
          </button>
        )}

        {canAccessShift && (
          <button
            type="button"
            onClick={() => setCurrentTab('shift')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'shift' ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">Shift</span>
          </button>
        )}

        {canAccessInvoice && (
          <button
            type="button"
            onClick={() => setCurrentTab('invoices')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'invoices' ? 'text-blue-600 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px]">Invoice</span>
          </button>
        )}

        {isDeveloper && (
          <button
            type="button"
            onClick={() => setCurrentTab('tax')}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all cursor-pointer ${
              currentTab === 'tax' ? 'text-rose-600 font-bold' : 'text-slate-500 font-medium'
            }`}
          >
            <Calculator className="w-5 h-5" />
            <span className="text-[10px]">Pajak</span>
          </button>
        )}
      </nav>
    </header>
  );
};
