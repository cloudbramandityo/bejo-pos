/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, X, ExternalLink, Sparkles } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { PosScreen } from './components/PosScreen';
import { InventoryScreen } from './components/InventoryScreen';
import { CustomerScreen } from './components/CustomerScreen';
import { StockScreen } from './components/StockScreen';
import { LaporanScreen } from './components/reports/LaporanScreen';
import { ShiftScreen } from './components/ShiftScreen';
import { AgentScreen } from './components/AgentScreen';
import { SpkScreen } from './components/SpkScreen';
import { LoginScreen } from './components/LoginScreen';
import { AiAssistant } from './components/AiAssistant';

// Modals
import { UnifiedAddProductModal, UnifiedTabType } from './components/modals/UnifiedAddProductModal';
import { AddMaterialModal } from './components/modals/AddMaterialModal';
import { AddPrintServiceModal } from './components/modals/AddPrintServiceModal';
import { NewCustomerModal } from './components/modals/NewCustomerModal';
import { ReceiptModal } from './components/modals/ReceiptModal';
import { ShiftModal } from './components/modals/ShiftModal';
import { CashierGateModal } from './components/modals/CashierGateModal';
import { UserManagementModal } from './components/modals/UserManagementModal';
import { BackendErrorBanner } from './components/BackendErrorBanner';
import { BackendDiagnosticsModal } from './components/BackendDiagnosticsModal';
import { LocalDatabaseSyncModal } from './components/modals/LocalDatabaseSyncModal';
import { LandingPage } from './components/landing/LandingPage';
import { LandingPageEditorScreen } from './components/LandingPageEditorScreen';
import { MarketingScreen } from './components/MarketingScreen';
import { InvoiceScreen } from './components/InvoiceScreen';
import { TaxScreen } from './components/tax/TaxScreen';
import { fetchBackendDiagnostics } from './utils/backendDiagnostics';
import { persistSnapshotToIndexedDb, initAutoDatabaseSync } from './utils/localDatabase';
import {
  getStoredLandingConfig,
  getStoredLandingDraft,
  saveStoredLandingConfig,
  saveStoredLandingDraft
} from './utils/landingPageStorage';
import { getAccountSession, logoutAccount } from './lib/posAuth';

import {
  Product,
  Customer,
  CustomerCategory,
  Shift,
  Transaction,
  CartItem,
  ProductCategoryItem,
  CashierUser,
  AppUser,
  Supplier,
  Agent,
  StockTransaction,
  StockTransactionItem,
  UserActivityLog,
  ActivityActionType,
  StoreProfile,
  CustomRole,
  AgentNotification,
  SpkOrder,
  Invoice,
  LandingPageConfig
} from './types';
import {
  getStoredInvoices,
  saveStoredInvoices,
  getStoredInvoiceStoreIdentity,
  saveStoredInvoiceStoreIdentity
} from './utils/invoiceStorage';
import {
  generateStockTransactionNumber,
  normalizeStockTransaction,
  applyNewPricingToStockTransactions,
  calculateBorrowReturnStock,
  getMaterialStockFormula,
  isMeterOrLembarUnit,
  sanitizeProductItem
} from './utils/stockUtils';
import { checkAndRunSpkAutoCleanup } from './utils/spkAutoCleanup';
import { isDigitalPrintingProduct, isPaketProduct, isLaserCuttingProduct } from './utils/productFilters';
import { getTransactionsForShift, isAgenTransaction, getNetCashAmount } from './utils/formatters';
import {
  StoreInfo,
  getStoredStoreInfo,
  saveStoredStoreInfo,
  getStoredProducts,
  saveStoredProducts,
  getStoredCustomers,
  saveStoredCustomers,
  getStoredSuppliers,
  saveStoredSuppliers,
  getStoredAgents,
  saveStoredAgents,
  getStoredCategories,
  saveStoredCategories,
  getStoredProductCategories,
  saveStoredProductCategories,
  isDefaultProductCategory,
  isDefaultCustomerCategory,
  getStoredActiveShift,
  saveStoredActiveShift,
  getStoredShifts,
  saveStoredShifts,
  getStoredTransactions,
  saveStoredTransactions,
  getStoredCashiers,
  saveStoredCashiers,
  getStoredUsers,
  saveStoredUsers,
  getStoredAuthUser,
  saveStoredAuthUser,
  saveStoredSpkOrders,
  saveStoredMachines,
  getStoredStockTransactions,
  saveStoredStockTransactions,
  getStoredActivityLogs,
  saveStoredActivityLogs,
  addActivityLogRecord,
  clearStoredActivityLogs,
  getStoredStoreProfiles,
  saveStoredStoreProfiles,
  getStoredActiveProfileId,
  saveStoredActiveProfileId,
  getStoredTransactionsForProfile,
  saveStoredTransactionsForProfile,
  getStoredShiftsForProfile,
  saveStoredShiftsForProfile,
  getStoredActiveShiftForProfile,
  saveStoredActiveShiftForProfile,
  DEFAULT_MASTER_STORE_PROFILE,
  getStoredCustomRoles,
  saveStoredCustomRoles
} from './utils/storage';
import {
  FinancialSettings,
  getStoredFinancialSettings,
  saveStoredFinancialSettings
} from './utils/financialStorage';
import {
  testPocketBaseConnection,
  refreshPocketBaseAuth,
  onSyncStatusChange,
  seedDatabaseIfEmpty,
  subscribeProducts,
  saveProductCloud,
  deleteProductCloud,
  subscribeProductCategories,
  saveProductCategoryCloud,
  deleteProductCategoryCloud,
  subscribeCustomers,
  saveCustomerCloud,
  deleteCustomerCloud,
  subscribeCustomerCategories,
  saveCustomerCategoryCloud,
  deleteCustomerCategoryCloud,
  subscribeTransactions,
  saveTransactionCloud,
  deleteTransactionCloud,
  subscribeShifts,
  saveShiftCloud,
  deleteShiftCloud,
  subscribeStoreInfo,
  saveStoreInfoCloud,
  subscribeActiveShift,
  saveActiveShiftCloud,
  subscribeCashiers,
  saveCashierCloud,
  deleteCashierCloud,
  subscribeUsers,
  saveUserCloud,
  deleteUserCloud,
  updateUserPresenceCloud,
  subscribeStockTransactions,
  saveStockTransactionCloud,
  saveBatchStockTransactionsCloud,
  deleteStockTransactionCloud,
  subscribeSuppliers,
  saveSupplierCloud,
  deleteSupplierCloud,
  subscribeAgents,
  saveAgentCloud,
  deleteAgentCloud,
  subscribeActivityLogs,
  saveActivityLogCloud,
  subscribeStoreProfiles,
  saveStoreProfileCloud,
  deleteStoreProfileCloud,
  subscribeActiveStoreProfileId,
  saveActiveStoreProfileIdCloud,
  subscribeCustomRoles,
  saveCustomRoleCloud,
  deleteCustomRoleCloud,
  subscribeAgentNotifications,
  markAgentNotificationReadCloud,
  subscribeSpkOrders,
  subscribeMachines,
  subscribeInvoices,
  saveInvoiceStoreIdentityCloud,
  subscribeLandingConfig,
  subscribeLandingDraft,
  saveLandingDraftCloud,
  saveLandingPublishedCloud
} from './backend/pocketbaseBackend';
import { DEFAULT_AGENTS_LIST } from './utils/agentMapping';

/**
 * Samakan kop faktur Invoice dengan profil toko yang aktif.
 * Identitas juga dipush ke PocketBase dan API server karena InvoiceScreen
 * melakukan polling /api/invoices/store-identity yang bisa menimpa localStorage.
 */
function syncInvoiceIdentityFromStore(store: {
  storeName: string;
  address: string;
  phone: string;
  logoUrl?: string;
}) {
  const current = getStoredInvoiceStoreIdentity();
  const merged = {
    ...current,
    storeName: store.storeName || current.storeName,
    address: store.address || current.address,
    phone: store.phone || current.phone,
    logoUrl: store.logoUrl || current.logoUrl,
  };
  saveStoredInvoiceStoreIdentity(merged);
  saveInvoiceStoreIdentityCloud(merged).catch(console.error);
  fetch('/api/invoices/store-identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(merged),
  }).catch(() => {});
}

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(getStoredAuthUser);
  const currentUserRef = useRef<AppUser | null>(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  const [users, setUsers] = useState<AppUser[]>(getStoredUsers);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isBackendDiagnosticsModalOpen, setIsBackendDiagnosticsModalOpen] = useState(false);
  const [isLocalDatabaseModalOpen, setIsLocalDatabaseModalOpen] = useState(false);

  // Initialize Zero-Touch Automated Real-Time Database Sync & Snapshot Loop
  useEffect(() => {
    const cleanup = initAutoDatabaseSync();
    return () => cleanup();
  }, []);

  // Poll backend diagnostics on initial load and periodically
  useEffect(() => {
    fetchBackendDiagnostics();
    const interval = setInterval(() => {
      fetchBackendDiagnostics();
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  // NOTE: Mode Terang / Gelap (dark mode) telah dihapus — aplikasi selalu memakai tema terang.

  // Heartbeat to update current logged in user's online presence in PocketBase
  // Optimized to 5 minutes (300,000ms) to conserve PocketBase daily read/write quota
  useEffect(() => {
    if (!currentUser?.id) return;

    const touchPresence = (onlineState: boolean) => {
      const updatedUser: AppUser = {
        ...currentUser,
        isOnline: onlineState,
        lastActiveAt: Date.now()
      };
      updateUserPresenceCloud(updatedUser).catch((err) => {
        console.warn('[Presence] Cloud sync paused (using Local Storage Mode):', err);
      });
    };

    touchPresence(true);

    const interval = setInterval(() => {
      touchPresence(true);
    }, 300000); // 5 minutes instead of 20 seconds

    const handleBeforeUnload = () => {
      touchPresence(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.id]);

  // Periodic Auto-Cleanup of Completed/Archived SPK at 19:00 WIB
  useEffect(() => {
    checkAndRunSpkAutoCleanup();
    const timer = setInterval(() => {
      checkAndRunSpkAutoCleanup();
    }, 30000); // Check every 30 seconds
    return () => clearInterval(timer);
  }, []);

  const [landingConfig, setLandingConfig] = useState(() => getStoredLandingConfig());
  const [landingDraft, setLandingDraft] = useState(() => getStoredLandingDraft());
  const [isViewingPublicLanding, setIsViewingPublicLanding] = useState<boolean>(false);
  const [isShowingLoginModal, setIsShowingLoginModal] = useState<boolean>(false);

  useEffect(() => {
    const handleLandingConfigUpdate = (e: any) => {
      if (e.detail) {
        setLandingConfig(e.detail);
      }
    };
    const handleLandingDraftUpdate = (e: any) => {
      if (e.detail) {
        setLandingDraft(e.detail);
      }
    };
    window.addEventListener('bejo_landing_config_updated', handleLandingConfigUpdate);
    window.addEventListener('bejo_landing_draft_updated', handleLandingDraftUpdate);
    return () => {
      window.removeEventListener('bejo_landing_config_updated', handleLandingConfigUpdate);
      window.removeEventListener('bejo_landing_draft_updated', handleLandingDraftUpdate);
    };
  }, []);

  /* Konten live diambil dari server tanpa perlu login (pengunjung anonim). */
  useEffect(() => {
    let cancelled = false;
    fetch('/api/landing/published', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { published?: boolean; config?: LandingPageConfig } | null) => {
        if (cancelled || !data) return;
        if (data.published === false) {
          const stored = getStoredLandingConfig();
          if (stored.isPublished) {
            saveStoredLandingConfig({ ...stored, isPublished: false });
          }
          return;
        }
        if (data.config) {
          setLandingConfig(data.config);
          saveStoredLandingConfig(data.config);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Teks tab browser mengikuti identitas website yang sudah dipublish,
     termasuk saat pengguna berada di dashboard atau pratinjau website. */
  useEffect(() => {
    if (!landingConfig.isPublished) return;
    const siteTitle = (landingConfig.brand?.siteTitle || '').trim();
    if (siteTitle) document.title = siteTitle;
  }, [landingConfig.isPublished, landingConfig.brand?.siteTitle]);

  useEffect(() => {
    const handleInvoicesUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setInvoices(e.detail);
      }
    };
    const handleOpenInvoiceTab = () => {
      setCurrentTab('invoices');
    };
    window.addEventListener('bejo_invoices_updated', handleInvoicesUpdated);
    window.addEventListener('bejo_open_invoice_tab', handleOpenInvoiceTab);
    return () => {
      window.removeEventListener('bejo_invoices_updated', handleInvoicesUpdated);
      window.removeEventListener('bejo_open_invoice_tab', handleOpenInvoiceTab);
    };
  }, []);

  const [currentTab, setCurrentTab] = useState<'pos' | 'inventory' | 'stock' | 'customers' | 'transactions' | 'shift' | 'agen' | 'spk' | 'landing_editor' | 'invoices' | 'tax'>(() => {
    const user = getStoredAuthUser();
    if (user?.role === 'SPK') return 'spk';
    if (user?.role === 'AGEN') return 'agen';
    if (user?.role === 'KASIR') return 'pos';
    return 'spk';
  });

  // Sesi dashboard hanya sah bila cookie HttpOnly di server masih valid.
  // Berlaku untuk semua akun (developer & staf), bukan hanya developer.
  useEffect(() => {
    if (!currentUserRef.current) return;
    let cancelled = false;
    getAccountSession()
      .then((session) => {
        if (cancelled || session.authenticated) return;
        currentUserRef.current = null;
        saveStoredAuthUser(null);
        setCurrentUser(null);
        setCurrentTab('spk');
      })
      .catch(() => {
        // Server tidak dapat dihubungi: biarkan sesi lokal agar mode offline tetap berjalan.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [agentScreenSubTab, setAgentScreenSubTab] = useState<'katalog_order' | 'riwayat' | undefined>(undefined);
  const [spkInitialTab, setSpkInitialTab] = useState<'kanban' | 'list' | 'create' | 'machines' | 'team_status' | 'reject_log'>('kanban');
  const [pendingSpkOrderToLoad, setPendingSpkOrderToLoad] = useState<any | null>(null);
  const [pendingOpenAccountForInvoice, setPendingOpenAccountForInvoice] = useState<any | null>(null);

  // Navigate to SPK screen directly on "Buat SPK Cetak Baru" view
  const handleNavigateToSpkCreate = () => {
    setSpkInitialTab('create');
    setCurrentTab('spk');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_open_create_spk'));
    }
  };
  const [activeNotification, setActiveNotification] = useState<{
    txId: string;
    agentName: string;
  } | null>(null);
  const [agentNotifications, setAgentNotifications] = useState<AgentNotification[]>([]);

  const knownStockTxIds = useRef<Set<string>>(new Set());
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);

  // Multi-Store Profiles State
  const [storeProfiles, setStoreProfiles] = useState<StoreProfile[]>(getStoredStoreProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string>(getStoredActiveProfileId);

  // Custom User Roles State
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(getStoredCustomRoles);

  // Core Data States
  const [products, setProducts] = useState<Product[]>(getStoredProducts);
  const [productCategories, setProductCategories] = useState<ProductCategoryItem[]>(getStoredProductCategories);
  const [customers, setCustomers] = useState<Customer[]>(getStoredCustomers);
  const [categories, setCategories] = useState<CustomerCategory[]>(getStoredCategories);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(getStoredStoreInfo);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>(getStoredStockTransactions);
  const [activeShift, setActiveShift] = useState<Shift | null>(getStoredActiveShift);
  const [pastShifts, setPastShifts] = useState<Shift[]>(getStoredShifts);
  const [transactions, setTransactions] = useState<Transaction[]>(getStoredTransactions);
  const [financialSettings, setFinancialSettings] = useState<FinancialSettings>(getStoredFinancialSettings);
  const [cashiers, setCashiers] = useState<CashierUser[]>(getStoredCashiers);
  const [suppliers, setSuppliers] = useState<Supplier[]>(getStoredSuppliers);
  const [agents, setAgents] = useState<Agent[]>(getStoredAgents);
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>(getStoredActivityLogs);
  const [invoices, setInvoices] = useState<Invoice[]>(getStoredInvoices);

  // Auto-sync state snapshot to local IndexedDB (Offline-first resilience)
  useEffect(() => {
    const timer = setTimeout(() => {
      persistSnapshotToIndexedDb().catch((e) => console.warn('IndexedDB auto-snapshot notice:', e));
    }, 1500);
    return () => clearTimeout(timer);
  }, [products, transactions, customers, pastShifts, stockTransactions, suppliers, agents, users]);

  // Real-time calculation of active shift transactions and financial stats based on login date & shift ID
  const activeShiftTransactions = useMemo(() => {
    return getTransactionsForShift(activeShift, transactions, categories, agents);
  }, [activeShift, transactions, categories, agents]);

  const computedActiveShift = useMemo(() => {
    if (!activeShift) return null;

    const shiftCashSales = activeShiftTransactions.reduce((acc, t) => acc + getNetCashAmount(t), 0);
    const shiftTransferSales = activeShiftTransactions.reduce((acc, t) => acc + (t.paymentMethods?.transfer || 0), 0);
    const shiftQrisSales = activeShiftTransactions.reduce((acc, t) => acc + (t.paymentMethods?.qris || 0), 0);

    return {
      ...activeShift,
      totalCashSales: shiftCashSales,
      totalTransferSales: shiftTransferSales,
      totalQrisSales: shiftQrisSales,
      transactionCount: activeShiftTransactions.length,
    };
  }, [activeShift, activeShiftTransactions]);

  // Helper to record user activity log
  const recordActivityLog = (
    actionType: ActivityActionType,
    actionTitle: string,
    details: string,
    userOverride?: AppUser
  ) => {
    const user = userOverride || currentUser || {
      id: 'sys_core_developer',
      username: 'langgo_dev',
      password: '',
      name: 'Langgo Bramandityo (Developer on Duty)',
      role: 'DEVELOPER' as const
    };

    const newLog = addActivityLogRecord({
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      actionType,
      actionTitle,
      details,
    });

    setActivityLogs((prev) => [newLog, ...prev]);
    saveActivityLogCloud(newLog).catch(console.error);
  };

  const handleClearActivityLogs = () => {
    clearStoredActivityLogs();
    setActivityLogs([]);
  };

  const handleSaveSupplier = (supplier: Supplier) => {
    let toSave: Supplier = supplier;
    setSuppliers((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === supplier.id);
      let updated: Supplier[];
      if (existingIndex >= 0) {
        toSave = supplier;
        updated = [...prev];
        updated[existingIndex] = supplier;
      } else {
        toSave = {
          ...supplier,
          id: supplier.id || 'sup_' + Date.now(),
          createdAt: supplier.createdAt || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
        };
        updated = [toSave, ...prev];
      }
      saveStoredSuppliers(updated);
      return updated;
    });
    saveSupplierCloud(toSave).catch(console.error);
  };

  const handleDeleteSupplier = (supplierId: string) => {
    setSuppliers((prev) => {
      const updated = prev.filter((s) => s.id !== supplierId);
      saveStoredSuppliers(updated);
      return updated;
    });
    deleteSupplierCloud(supplierId).catch(console.error);
  };

  const syncAgentsToCustomers = (
    agentList: Agent[],
    currentCustomers: Customer[],
    oldAgent?: Agent,
    newAgent?: Agent,
    deletedAgent?: Agent,
    writeToCloud: boolean = true
  ) => {
    if (!agentList) return;

    const agenCat = categories.find((c) => c.name.toUpperCase() === 'AGEN') || { id: 'cat_agen', name: 'AGEN' };
    const agenCatId = agenCat.id || 'cat_agen';

    let hasChanges = false;
    let updatedCusts = [...currentCustomers];

    // Case 1: Agent was deleted
    if (deletedAgent) {
      const delPhone = (deletedAgent.phone || '').trim();
      const delDigits = delPhone.replace(/[^0-9]/g, '');
      const delName = (deletedAgent.name || '').trim().toLowerCase();

      const toDelete = updatedCusts.filter(
        (c) =>
          c.categoryId === agenCatId &&
          ((delPhone && c.phone.trim() === delPhone) ||
            (delDigits && c.phone.replace(/[^0-9]/g, '') === delDigits) ||
            (delName && c.name.trim().toLowerCase() === delName))
      );

      if (toDelete.length > 0) {
        updatedCusts = updatedCusts.filter((c) => !toDelete.some((d) => d.id === c.id));
        if (writeToCloud) {
          toDelete.forEach((d) => {
            deleteCustomerCloud(d.id).catch(console.error);
          });
        }
        hasChanges = true;
      }
    }

    // Case 2: Agent was updated (oldAgent & newAgent)
    if (oldAgent && newAgent) {
      const oldPhone = (oldAgent.phone || '').trim();
      const oldDigits = oldPhone.replace(/[^0-9]/g, '');
      const oldName = (oldAgent.name || '').trim().toLowerCase();
      const cleanName = newAgent.name.trim();
      const cleanPhone = (newAgent.phone || '').trim();
      const newDigits = cleanPhone.replace(/[^0-9]/g, '');

      const existingIndex = updatedCusts.findIndex(
        (c) =>
          c.categoryId === agenCatId &&
          ((oldPhone && c.phone.trim() === oldPhone) ||
            (oldDigits && c.phone.replace(/[^0-9]/g, '') === oldDigits) ||
            (oldName && c.name.trim().toLowerCase() === oldName) ||
            (cleanPhone && c.phone.trim() === cleanPhone) ||
            (newDigits && c.phone.replace(/[^0-9]/g, '') === newDigits) ||
            c.name.trim().toLowerCase() === cleanName.toLowerCase())
      );

      if (existingIndex >= 0) {
        const existingCust = updatedCusts[existingIndex];
        const updatedCust: Customer = {
          ...existingCust,
          name: cleanName,
          phone: cleanPhone || existingCust.phone,
          categoryId: agenCatId
        };
        updatedCusts[existingIndex] = updatedCust;
        if (writeToCloud) {
          saveCustomerCloud(updatedCust).catch(console.error);
        }
        hasChanges = true;
      }
    }

    // Case 3: Standard alignment pass for ALL agents in agentList
    const activeAgentPhones = new Set<string>();
    const activeAgentDigits = new Set<string>();
    const activeAgentNames = new Set<string>();

    agentList.forEach((ag) => {
      if (!ag.name || !ag.name.trim()) return;
      const cleanName = ag.name.trim();
      const cleanPhone = (ag.phone || '').trim();
      const cleanDigits = cleanPhone.replace(/[^0-9]/g, '');

      if (cleanPhone) activeAgentPhones.add(cleanPhone);
      if (cleanDigits) activeAgentDigits.add(cleanDigits);
      activeAgentNames.add(cleanName.toLowerCase());

      // Find all matching customer records
      const matchingIndices: number[] = [];
      updatedCusts.forEach((c, idx) => {
        const cPhone = (c.phone || '').trim();
        const cDigits = cPhone.replace(/[^0-9]/g, '');
        const cName = (c.name || '').trim().toLowerCase();

        const matchName = cName === cleanName.toLowerCase();
        const matchPhone = (cleanPhone && cPhone === cleanPhone) || (cleanDigits && cDigits === cleanDigits && cleanDigits.length >= 5);
        if (matchName || matchPhone) {
          matchingIndices.push(idx);
        }
      });

      if (matchingIndices.length > 0) {
        const primaryIdx = matchingIndices[0];
        const existingCust = updatedCusts[primaryIdx];
        if (
          existingCust.categoryId !== agenCatId ||
          existingCust.name !== cleanName ||
          (cleanPhone && existingCust.phone !== cleanPhone)
        ) {
          const updatedCust: Customer = {
            ...existingCust,
            name: cleanName,
            phone: cleanPhone || existingCust.phone,
            categoryId: agenCatId
          };
          updatedCusts[primaryIdx] = updatedCust;
          if (writeToCloud) {
            saveCustomerCloud(updatedCust).catch(console.error);
          }
          hasChanges = true;
        }

        // If duplicate customer entries exist for this agent, purge the excess duplicates
        if (matchingIndices.length > 1) {
          const duplicates = matchingIndices.slice(1).map((i) => updatedCusts[i]);
          if (writeToCloud) {
            duplicates.forEach((dup) => {
              deleteCustomerCloud(dup.id).catch(console.error);
            });
          }
          updatedCusts = updatedCusts.filter((c) => !duplicates.some((d) => d.id === c.id));
          hasChanges = true;
        }
      } else {
        const custId = cleanDigits || cleanPhone || `cust_agen_${ag.id || Date.now()}`;
        const newCust: Customer = {
          id: custId,
          phone: cleanPhone || '081234567800',
          name: cleanName,
          categoryId: agenCatId,
          createdAt: ag.createdAt || '01 Januari 2026',
          totalSpent: 0,
          transactionCount: 0,
          notes: `Otomatis disinkronisasi dari DAFTAR AGEN (${cleanName})`
        };
        updatedCusts.push(newCust);
        if (writeToCloud) {
          saveCustomerCloud(newCust).catch(console.error);
        }
        hasChanges = true;
      }
    });

    // Case 4: General cleanup for orphaned AGEN customers
    if (agentList.length > 0) {
      const orphanedCusts: Customer[] = [];
      updatedCusts = updatedCusts.filter((c) => {
        if (c.categoryId === agenCatId) {
          const cPhone = (c.phone || '').trim();
          const cDigits = cPhone.replace(/[^0-9]/g, '');
          const matchPhone = (cPhone && activeAgentPhones.has(cPhone)) || (cDigits && activeAgentDigits.has(cDigits));
          const matchName = c.name && activeAgentNames.has(c.name.trim().toLowerCase());
          if (!matchPhone && !matchName) {
            orphanedCusts.push(c);
            hasChanges = true;
            return false;
          }
        }
        return true;
      });

      if (writeToCloud) {
        orphanedCusts.forEach((c) => {
          deleteCustomerCloud(c.id).catch(console.error);
        });
      }
    }

    if (hasChanges) {
      const sorted = updatedCusts.sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
      );
      setCustomers(sorted);
      saveStoredCustomers(sorted);
    }
  };

  const handleSaveAgent = (agent: Agent) => {
    let toSave: Agent = agent;
    let oldAgent: Agent | undefined;
    setAgents((prev) => {
      const existingIndex = prev.findIndex((a) => a.id === agent.id);
      let updated: Agent[];
      if (existingIndex >= 0) {
        oldAgent = prev[existingIndex];
        toSave = agent;
        updated = [...prev];
        updated[existingIndex] = agent;
      } else {
        toSave = {
          ...agent,
          id: agent.id || 'agent_' + Date.now(),
          createdAt: agent.createdAt || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
        };
        updated = [toSave, ...prev];
      }
      saveStoredAgents(updated);
      syncAgentsToCustomers(updated, customers, oldAgent, toSave, undefined, true);
      return updated;
    });
    saveAgentCloud(toSave).catch(console.error);
  };

  // Continuous synchronization of Agents into Customers list
  useEffect(() => {
    if (agents.length > 0 && categories.length > 0) {
      syncAgentsToCustomers(agents, customers, undefined, undefined, undefined, true);
    }
  }, [agents, categories, customers.length]);

  const handleDeleteAgent = (agentId: string) => {
    let deletedAgent: Agent | undefined;
    setAgents((prev) => {
      deletedAgent = prev.find((a) => a.id === agentId);
      const updated = prev.filter((a) => a.id !== agentId);
      saveStoredAgents(updated);
      if (deletedAgent) {
        syncAgentsToCustomers(updated, customers, undefined, undefined, deletedAgent, true);
      }
      return updated;
    });
    deleteAgentCloud(agentId).catch(console.error);
  };

  // When logged in user role changes or on switch, enforce tab access restrictions
  useEffect(() => {
    if (currentUser?.role === 'SPK') {
      if (currentTab !== 'spk') {
        setCurrentTab('spk');
      }
    } else if (currentUser?.role === 'AGEN') {
      if (currentTab !== 'agen') {
        setCurrentTab('agen');
      }
    } else if (currentUser?.role === 'KASIR') {
      if (currentTab !== 'pos' && currentTab !== 'shift') {
        setCurrentTab('pos');
      }
    } else if (currentUser?.role !== 'DEVELOPER' && currentUser?.role !== 'ADMIN' && currentUser?.role !== 'OWNER' && (currentTab === 'landing_editor' || currentTab === 'tax' || currentTab === 'marketing')) {
      setCurrentTab('pos');
    }
  }, [currentUser, currentTab]);

  // Auto-sync with PocketBase Cloud Database
  useEffect(() => {
    let isMounted = true;

    const handleQuotaExceededEvent = () => {
      if (isMounted) setIsCloudConnected(false);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('app:quota-exceeded', handleQuotaExceededEvent);
    }

    // Status koneksi realtime + antrean tulis adalah satu-satunya sumber benar;
    // health check server saja tidak membuktikan browser tersambung ke PocketBase.
    const unsubSyncStatus = onSyncStatusChange((status) => {
      if (status.state === 'connecting') return;
      setIsCloudConnected(status.state === 'connected');
    });

    // Test connection & seed database if initial empty
    testPocketBaseConnection();
    seedDatabaseIfEmpty();

    // 1. Subscribe Products
    const unsubProducts = subscribeProducts((cloudProducts) => {
      if (cloudProducts) {
        const sanitized = cloudProducts.map(sanitizeProductItem);
        const sorted = [...sanitized].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
        );
        setProducts(sorted);
        saveStoredProducts(sorted);
      }
    });

    // 2. Subscribe Product Categories
    const unsubCategories = subscribeProductCategories((cloudCategories) => {
      if (cloudCategories) {
        setProductCategories(cloudCategories);
        saveStoredProductCategories(cloudCategories);
      }
    });

    // 3. Subscribe Customer Categories
    const unsubCustCategories = subscribeCustomerCategories((cloudCustCats) => {
      if (cloudCustCats) {
        // Sanitize any RETAIL category to UMUM in local memory
        const sanitizedCats = cloudCustCats.map((c) => {
          if (c.id === 'cat_retail' || c.name.toUpperCase() === 'RETAIL') {
            return {
              ...c,
              id: 'cat_umum',
              name: 'UMUM'
            };
          }
          return c;
        });

        const hasGrosir = sanitizedCats.some((c) => c.name.toUpperCase() === 'GROSIR' || c.id === 'cat_grosir');
        const hasUmum = sanitizedCats.some((c) => c.name.toUpperCase() === 'UMUM' || c.id === 'cat_umum');
        const hasAgen = sanitizedCats.some((c) => c.name.toUpperCase() === 'AGEN' || c.id === 'cat_agen');

        if (!hasGrosir) sanitizedCats.unshift({ id: 'cat_grosir', name: 'GROSIR', discountPercent: 0, color: 'bg-blue-100 text-blue-700 border-blue-400' });
        if (!hasUmum) sanitizedCats.splice(1, 0, { id: 'cat_umum', name: 'UMUM', discountPercent: 0, color: 'bg-slate-100 text-slate-700 border-slate-300' });
        if (!hasAgen) sanitizedCats.push({ id: 'cat_agen', name: 'AGEN', discountPercent: 0, color: 'bg-purple-100 text-purple-700 border-purple-400' });

        setCategories(sanitizedCats);
        saveStoredCategories(sanitizedCats);
      }
    });

    // 4. Subscribe Customers
    const unsubCustomers = subscribeCustomers((cloudCustomers) => {
      if (cloudCustomers) {
        const sanitizedCusts = cloudCustomers
          .filter((c) => !['081398765432', '085712345678'].includes(c.id) && !c.name.includes('(Studio Kreasi)') && !c.name.includes('Dewi Lestari'))
          .map((c) => {
            let catId = c.categoryId;
            if (!catId || catId === 'cat_retail' || catId === 'retail' || catId === 'RETAIL') {
              catId = 'cat_umum';
              return { ...c, categoryId: catId };
            }
            return c;
          });

        const sorted = [...sanitizedCusts].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
        );
        setCustomers(sorted);
        saveStoredCustomers(sorted);
      }
    });

    // 5. Subscribe Cashiers
    const unsubCashiers = subscribeCashiers((cloudCashiers) => {
      if (cloudCashiers) {
        setCashiers(cloudCashiers);
        saveStoredCashiers(cloudCashiers);
      }
    });

    // 6. Subscribe App Users (Auth & RBAC)
    const unsubUsers = subscribeUsers((cloudUsers) => {
      if (cloudUsers) {
        // Akun DEVELOPER tidak lagi disimpan di daftar pengguna maupun disinkronkan
        // ke perangkat lain; login developer diverifikasi oleh server.
        const sanitizedUsers = cloudUsers.filter(
          (u) => u.role !== 'DEVELOPER' && u.id !== 'user_dev' && u.id !== 'sys_core_developer'
        );

        setUsers(sanitizedUsers);
        saveStoredUsers(sanitizedUsers);

        // Update current user if permissions/details changed
        const curr = currentUserRef.current;
        if (curr) {
          const updatedCurrent = sanitizedUsers.find((u) => u.id === curr.id);
          if (updatedCurrent) {
            setCurrentUser(updatedCurrent);
            saveStoredAuthUser(updatedCurrent);
          }
        }
      }
    });

    // 7. Subscribe Transactions
    const unsubTx = subscribeTransactions((cloudTx) => {
      if (cloudTx) {
        const uniqueTxMap = new Map<string, Transaction>();
        cloudTx.forEach((tx) => {
          if (tx && tx.id) uniqueTxMap.set(tx.id, tx);
        });
        const sorted = Array.from(uniqueTxMap.values()).sort(
          (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        );
        setTransactions(sorted);
        saveStoredTransactions(sorted);
      }
    });

    // 8. Subscribe Shifts
    const unsubShifts = subscribeShifts((cloudShifts) => {
      if (cloudShifts) {
        const sorted = [...cloudShifts].sort(
          (a, b) => new Date(b.closedAt || b.date).getTime() - new Date(a.closedAt || a.date).getTime()
        );
        setPastShifts(sorted);
        saveStoredShifts(sorted);
      }
    });

    // 9. Subscribe Store Info
    const unsubStore = subscribeStoreInfo((cloudStoreInfo) => {
      if (cloudStoreInfo) {
        setStoreInfo(cloudStoreInfo);
        saveStoredStoreInfo(cloudStoreInfo);
      }
    });

    // 10. Subscribe Active Shift
    const unsubActiveShift = subscribeActiveShift((cloudActiveShift) => {
      setActiveShift(cloudActiveShift);
      saveStoredActiveShift(cloudActiveShift);
    });

    // 11. Subscribe Stock Transactions
    const unsubStockTx = subscribeStockTransactions((cloudStockTx) => {
      if (cloudStockTx) {
        const sorted = [...cloudStockTx].sort((a, b) => b.timestamp - a.timestamp);
        setStockTransactions(sorted);
        saveStoredStockTransactions(sorted);
      }
    });

    // 12. Subscribe Suppliers
    const unsubSuppliers = subscribeSuppliers((cloudSuppliers) => {
      if (cloudSuppliers) {
        setSuppliers(cloudSuppliers);
        saveStoredSuppliers(cloudSuppliers);
      }
    });

    // 13. Subscribe Agents
    const unsubAgents = subscribeAgents((cloudAgents) => {
      if (cloudAgents) {
        const filteredAgents = cloudAgents.filter(a => !['agent_1', 'agent_2'].includes(a.id) && !a.name.includes('Studio Kreasi') && !a.name.includes('Mitra Advertising'));
        setAgents(filteredAgents);
        saveStoredAgents(filteredAgents);
      }
    });

    // 14. Subscribe Activity Logs
    const unsubLogs = subscribeActivityLogs((cloudLogs) => {
      if (cloudLogs && cloudLogs.length > 0) {
        setActivityLogs(cloudLogs);
        saveStoredActivityLogs(cloudLogs);
      }
    });

    // 15. Subscribe Store Profiles
    const unsubProfiles = subscribeStoreProfiles((cloudProfiles) => {
      if (cloudProfiles && cloudProfiles.length > 0) {
        setStoreProfiles(cloudProfiles);
        saveStoredStoreProfiles(cloudProfiles);
      }
    });

    // 16. Subscribe Active Store Profile ID
    const unsubActiveProfId = subscribeActiveStoreProfileId((cloudActiveId) => {
      if (cloudActiveId) {
        setActiveProfileId(cloudActiveId);
        saveStoredActiveProfileId(cloudActiveId);
      }
    });

    // 17. Subscribe Custom Roles
    const unsubCustomRoles = subscribeCustomRoles((cloudCustomRoles) => {
      if (cloudCustomRoles) {
        setCustomRoles(cloudCustomRoles);
        saveStoredCustomRoles(cloudCustomRoles);
      }
    });

    // 18. Subscribe Agent Notifications (Real-time synchronization for multi-role accounts)
    const unsubAgentNotifs = subscribeAgentNotifications((cloudNotifs) => {
      if (cloudNotifs) {
        setAgentNotifications(cloudNotifs);
      }
    });

    // 19. Subscribe SPK Orders (Real-time cloud sync across all users)
    const unsubSpkOrders = subscribeSpkOrders((cloudSpkOrders) => {
      if (cloudSpkOrders) {
        saveStoredSpkOrders(cloudSpkOrders);
      }
    });

    // 20. Subscribe Machines (Real-time cloud sync across all users)
    const unsubMachines = subscribeMachines((cloudMachines) => {
      if (cloudMachines) {
        saveStoredMachines(cloudMachines);
      }
    });

    // 21. Subscribe Invoices (Real-time cloud sync for sales reporting)
    const unsubInvoices = subscribeInvoices((cloudInvoices) => {
      if (Array.isArray(cloudInvoices) && cloudInvoices.length > 0) {
        setInvoices(cloudInvoices);
        saveStoredInvoices(cloudInvoices);
      }
    });

    // 21b. Subscribe Landing Page CMS Config (Real-time cloud sync)
    const unsubLanding = subscribeLandingConfig((cloudConfig) => {
      if (cloudConfig) {
        setLandingConfig(cloudConfig);
        saveStoredLandingConfig(cloudConfig);
      }
    });

    const unsubLandingDraft = subscribeLandingDraft((cloudDraft) => {
      if (cloudDraft) {
        setLandingDraft(cloudDraft);
        saveStoredLandingDraft(cloudDraft);
      }
    });

    // 22. Periodic Auto-Cleanup for SPK Archives (Runs daily at 19:00 WIB)
    checkAndRunSpkAutoCleanup();
    const cleanupInterval = setInterval(() => {
      checkAndRunSpkAutoCleanup();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(cleanupInterval);
      unsubSyncStatus();
      unsubProducts();
      unsubCategories();
      unsubCustCategories();
      unsubCustomers();
      unsubCashiers();
      unsubUsers();
      unsubTx();
      unsubShifts();
      unsubStore();
      unsubActiveShift();
      unsubStockTx();
      unsubSuppliers();
      unsubAgents();
      unsubLogs();
      unsubProfiles();
      unsubActiveProfId();
      unsubCustomRoles();
      unsubAgentNotifs();
      unsubSpkOrders();
      unsubMachines();
      unsubInvoices();
      unsubLanding();
      unsubLandingDraft();
    };
  }, []);

  // Real-time stock transaction listener for Agent Material Procurement (PENGAMBILAN) popup notification
  useEffect(() => {
    if (stockTransactions && stockTransactions.length > 0) {
      // If we haven't populated our known stock tx IDs, populate it now on startup/mount
      if (knownStockTxIds.current.size === 0) {
        stockTransactions.forEach((tx) => {
          if (tx.id) {
            knownStockTxIds.current.add(tx.id);
          }
        });
        return;
      }

      // Check for any newly added PENGAMBILAN transaction that we don't know about yet
      const newTx = stockTransactions.find(
        (tx) => tx.id && tx.type === 'PENGAMBILAN' && !knownStockTxIds.current.has(tx.id)
      );

      if (newTx) {
        // Update the known transactions so we do not notify about this transaction again
        stockTransactions.forEach((tx) => {
          if (tx.id) {
            knownStockTxIds.current.add(tx.id);
          }
        });

        // Trigger the popup only for ADMIN, OWNER, or DEVELOPER users
        if (currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER' || currentUser?.role === 'DEVELOPER') {
          setActiveNotification({
            txId: newTx.id,
            agentName: newTx.supplierName || 'Mitra Agen'
          });
        }
      }
    }
  }, [stockTransactions, currentUser]);



  // Cart state - default empty
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [latestCustomer, setLatestCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (latestCustomer) {
      setSelectedCustomer(latestCustomer);
    }
  }, [latestCustomer]);

  // Modal States
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [unifiedModalTab, setUnifiedModalTab] = useState<UnifiedTabType>('all');
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const handleOpenUnifiedModal = (tab: UnifiedTabType = 'all') => {
    if (tab === 'digital_print' || tab === 'laser_cutting') {
      handleNavigateToSpkCreate();
      return;
    }
    setUnifiedModalTab(tab);
    setIsUnifiedModalOpen(true);
  };
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomerForModal, setEditingCustomerForModal] = useState<Customer | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Auth Handlers
  const handleLoginSuccess = (user: AppUser) => {
    const updatedUser: AppUser = {
      ...user,
      isOnline: true,
      lastActiveAt: Date.now(),
      lastLoginAt: Date.now()
    };
    currentUserRef.current = updatedUser; // Update ref immediately to prevent race conditions
    setCurrentUser(updatedUser);
    saveStoredAuthUser(updatedUser);
    // Akun developer hanya hidup di sesi server; jangan pernah disinkronkan ke PocketBase.
    if (user.role !== 'DEVELOPER') {
      updateUserPresenceCloud(updatedUser).catch(console.error);
    }

    if (user.role === 'SPK') {
      setCurrentTab('spk');
    } else if (user.role === 'AGEN') {
      setCurrentTab('agen');
    } else if (user.role === 'KASIR') {
      setCurrentTab('pos');
    }
    recordActivityLog(
      'LOGIN',
      `Login Ke Sistem (${user.role})`,
      `Pengguna @${user.username} (${user.name}) berhasil masuk ke aplikasi POS BEJO Digital Print`,
      updatedUser
    );

    // Cookie sesi server sudah terpasang. Ambil token PocketBase setelah itu,
    // lalu muat ulang agar semua langganan realtime dimulai dengan sesi sah.
    void refreshPocketBaseAuth().finally(() => {
      window.setTimeout(() => window.location.reload(), 250);
    });
  };

  const handleLogout = () => {
    currentUserRef.current = null; // Clear ref immediately to prevent race condition re-logins from PocketBase snapshot listener
    if (currentUser) {
      // Presence dikirim sebelum logoutAccount() menghapus cookie sesi server.
      const offlineUser: AppUser = {
        ...currentUser,
        isOnline: false,
        lastActiveAt: Date.now()
      };
      updateUserPresenceCloud(offlineUser).catch(console.error);

      recordActivityLog(
        'LOGOUT',
        'Logout Dari Sistem',
        `Pengguna @${currentUser.username} (${currentUser.name}) keluar dari aplikasi`
      );
    }
    logoutAccount().catch(() => {});
    setCurrentUser(null);
    saveStoredAuthUser(null);
    setCurrentTab('spk');
  };

  const handleSaveAppUser = async (userToSave: AppUser) => {
    // Akun staf tidak lagi bisa ditulis browser ke PocketBase, jadi server adalah
    // satu-satunya tempat data itu hidup. Simpan ke cloud TERLEBIH DAHULU: kalau
    // server menolak, jangan perbarui state lokal (kalau tidak, akun tampak jadi
    // sesaat lalu hilang saat refresh).
    await saveUserCloud(userToSave);

    setUsers((prev) => {
      const exists = prev.some((u) => u.id === userToSave.id);
      const next = exists
        ? prev.map((u) => (u.id === userToSave.id ? userToSave : u))
        : [...prev, userToSave];
      saveStoredUsers(next);
      return next;
    });

    recordActivityLog(
      'USER_MANAGEMENT',
      `Simpan/Edit Akun (@${userToSave.username})`,
      `Nama: ${userToSave.name} • Role: ${userToSave.role} • Status: ${userToSave.isActive !== false ? 'Aktif' : 'Non-aktif'}`
    );

    // If updating currently logged in user
    if (currentUser && currentUser.id === userToSave.id) {
      setCurrentUser(userToSave);
      saveStoredAuthUser(userToSave);
    }
  };

  const handleSaveCustomRole = (role: CustomRole) => {
    setCustomRoles((prev) => {
      const exists = prev.some((r) => r.id === role.id);
      const next = exists
        ? prev.map((r) => (r.id === role.id ? role : r))
        : [...prev, role];
      saveStoredCustomRoles(next);
      return next;
    });
    saveCustomRoleCloud(role).catch(console.error);

    recordActivityLog(
      'USER_MANAGEMENT',
      `Simpan Hak Akses Baru / Edit Role "${role.name}"`,
      `Oleh: ${currentUser?.name || 'Admin'}`
    );
  };

  const handleDeleteCustomRole = (roleId: string) => {
    setCustomRoles((prev) => {
      const next = prev.filter((r) => r.id !== roleId);
      saveStoredCustomRoles(next);
      return next;
    });
    deleteCustomRoleCloud(roleId).catch(console.error);

    recordActivityLog(
      'USER_MANAGEMENT',
      `Hapus Hak Akses (Role)`,
      `Menghapus role custom dengan ID: ${roleId}`
    );
  };

  const handleDeleteAppUser = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    await deleteUserCloud(userId);

    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== userId);
      saveStoredUsers(next);
      return next;
    });

    recordActivityLog(
      'USER_MANAGEMENT',
      `Hapus Akun Pengguna`,
      `Menghapus akun pengguna @${targetUser?.username || userId} (${targetUser?.name || 'User'}) dari sistem`
    );
  };

  // Cart Handlers
  const handleAddToCart = (newItem: CartItem) => {
    // Validasi Aturan Transaksi Open Account
    if (cartItems.some((it) => it.isOpenAccount)) {
      if (
        !newItem.isOpenAccount ||
        (newItem.openAccountCustomerId &&
          cartItems.some(
            (it) => it.openAccountCustomerId && it.openAccountCustomerId !== newItem.openAccountCustomerId
          ))
      ) {
        alert('Transaksi Open Account tidak boleh digabung dengan transaksi lainnya.');
        return;
      }
    } else if (cartItems.length > 0 && newItem.isOpenAccount) {
      alert('Transaksi Open Account tidak boleh digabung dengan transaksi lainnya.');
      return;
    }

    setCartItems((prev) => [...prev, newItem]);
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Persist handlers (Instant state + LocalStorage fallback + Realtime Cloud PocketBase)
  const handleSaveFinancialSettings = (updated: FinancialSettings) => {
    setFinancialSettings(updated);
    saveStoredFinancialSettings(updated);
  };

  const handleSaveProduct = (updatedProduct: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === updatedProduct.id);
      const next = exists
        ? prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
        : [updatedProduct, ...prev];
      const sorted = next.sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
      );
      saveStoredProducts(sorted);
      return sorted;
    });
    saveProductCloud(updatedProduct).catch(console.error);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== productId);
      saveStoredProducts(next);
      return next;
    });
    deleteProductCloud(productId).catch(console.error);
  };

  const handleAddStockTransaction = (
    txData: Omit<StockTransaction, 'id' | 'timestamp' | 'date' | 'time'> & { date?: string; id?: string }
  ) => {
    const today = new Date();
    const timeFormatted = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:${String(today.getSeconds()).padStart(2, '0')}`;
    const now = Date.now();
    const dateFormatted = txData.date || today.toISOString().slice(0, 10);

    let timestamp = now;
    if (txData.date) {
      const parts = txData.date.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        dateObj.setHours(today.getHours(), today.getMinutes(), today.getSeconds());
        timestamp = dateObj.getTime();
      }
    }

    const txId = txData.id || generateStockTransactionNumber(txData.type, dateFormatted);
    const isBackdated = dateFormatted !== today.toISOString().slice(0, 10);

    const newTx: StockTransaction = {
      ...txData,
      id: txId,
      transactionNumber: txId,
      timestamp,
      date: dateFormatted,
      time: timeFormatted,
      isBackdated: isBackdated ? true : undefined
    };

    setStockTransactions((prev) => {
      const updated = [newTx, ...prev];
      saveStoredStockTransactions(updated);
      return updated;
    });

    saveStockTransactionCloud(newTx).catch(console.error);

    // Record Activity Log
    const labelType = txData.type === 'PEMBELIAN' ? 'Pembelian Bahan' : 'Pengambilan Bahan';
    const detailLog = `Sistem mencatat transaksi ${labelType} #${txId} • Total Unit: ${txData.totalQty || txData.qty || 0} • Supplier/Agen: ${txData.supplierName}${isBackdated ? ' (Lupa diinput Kasir / Backdated oleh Developer)' : ''}`;
    recordActivityLog('STOCK_MUTATION', `Mutasi Stok: ${labelType}`, detailLog);
  };

  const handleAddBatchStockTransactions = (
    txList: (Omit<StockTransaction, 'id' | 'timestamp' | 'date' | 'time'> & { date?: string; id?: string })[]
  ) => {
    if (txList.length === 0) return;
    const today = new Date();
    const timeFormatted = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:${String(today.getSeconds()).padStart(2, '0')}`;
    const now = Date.now();

    const newTxs: StockTransaction[] = txList.map((txData, index) => {
      const dateFormatted = txData.date || today.toISOString().slice(0, 10);
      let timestamp = now + index;
      if (txData.date) {
        const parts = txData.date.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const dateObj = new Date(year, month, day);
          dateObj.setHours(today.getHours(), today.getMinutes(), today.getSeconds(), today.getMilliseconds() + index);
          timestamp = dateObj.getTime();
        }
      }

      const txId = txData.id || generateStockTransactionNumber(txData.type, dateFormatted);
      const isBackdated = dateFormatted !== today.toISOString().slice(0, 10);

      return {
        ...txData,
        id: txId,
        transactionNumber: txId,
        timestamp,
        date: dateFormatted,
        time: timeFormatted,
        isBackdated: isBackdated ? true : undefined
      };
    });

    setStockTransactions((prev) => {
      const updated = [...newTxs, ...prev];
      saveStoredStockTransactions(updated);
      return updated;
    });

    newTxs.forEach((tx) => {
      saveStockTransactionCloud(tx).catch(console.error);

      // Record Activity Log
      const isBackdated = tx.isBackdated;
      const labelType = tx.type === 'PEMBELIAN' ? 'Pembelian Bahan' : 'Pengambilan Bahan';
      const detailLog = `Sistem mencatat transaksi batch ${labelType} #${tx.id} • Total Unit: ${tx.totalQty || tx.qty || 0} • Supplier/Agen: ${tx.supplierName}${isBackdated ? ' (Lupa diinput Kasir / Backdated oleh Developer)' : ''}`;
      recordActivityLog('STOCK_MUTATION', `Mutasi Stok (Batch): ${labelType}`, detailLog);
    });
  };

  const handleUpdateStockTransaction = async (updatedTx: StockTransaction) => {
    setStockTransactions((prev) => {
      const updated = prev.map((t) => (t.id === updatedTx.id ? updatedTx : t));
      saveStoredStockTransactions(updated);
      return updated;
    });
    await saveStockTransactionCloud(updatedTx);
  };

  const handleDeleteStockTransaction = async (txId: string) => {
    setStockTransactions((prev) => {
      const updated = prev.filter((t) => t.id !== txId);
      saveStoredStockTransactions(updated);
      return updated;
    });
    await deleteStockTransactionCloud(txId);
  };

  const handleUpdateProductStockAndCost = (productId: string, newStock: number, newCostPrice: number) => {
    handleUpdateBatchProductStockAndCost([{ productId, newStock, newCostPrice }]);
  };

  const handleUpdateBatchProductStockAndCost = (
    updates: {
      productId: string;
      newStock: number;
      newCostPrice?: number;
      newHargaAgen?: number;
      newHargaMeterGrosir?: number;
    }[]
  ) => {
    if (updates.length === 0) return;
    const updateMap = new Map<
      string,
      {
        productId: string;
        newStock: number;
        newCostPrice?: number;
        newHargaAgen?: number;
        newHargaMeterGrosir?: number;
      }
    >();
    updates.forEach((u) => updateMap.set(u.productId, u));

    setProducts((prev) => {
      const updated = prev.map((p) => {
        const u = updateMap.get(p.id);
        if (u) {
          const updatedProd: Product = {
            ...p,
            stock: u.newStock,
            costPrice: u.newCostPrice !== undefined ? u.newCostPrice : p.costPrice,
            hargaKulak: u.newCostPrice !== undefined ? u.newCostPrice : p.hargaKulak,
            hargaAgen: u.newHargaAgen !== undefined ? u.newHargaAgen : p.hargaAgen,
            hargaMeterGrosir: u.newHargaMeterGrosir !== undefined ? u.newHargaMeterGrosir : p.hargaMeterGrosir
          };
          saveProductCloud(updatedProd).catch(console.error);
          return updatedProd;
        }
        return p;
      });
      saveStoredProducts(updated);
      return updated;
    });
  };

  const handleSaveCustomer = (newCustomer: Customer) => {
    setCustomers((prev) => {
      const exists = prev.some((c) => c.id === newCustomer.id);
      const next = exists
        ? prev.map((c) => (c.id === newCustomer.id ? newCustomer : c))
        : [newCustomer, ...prev];
      const sorted = next.sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
      );
      saveStoredCustomers(sorted);
      return sorted;
    });
    saveCustomerCloud(newCustomer).catch(console.error);
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomers((prev) => {
      const next = prev.filter((c) => c.id !== customerId);
      saveStoredCustomers(next);
      return next;
    });
    deleteCustomerCloud(customerId).catch(console.error);
  };

  const handleSaveCategory = (category: CustomerCategory) => {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === category.id);
      const next = exists
        ? prev.map((c) => (c.id === category.id ? category : c))
        : [...prev, category];
      saveStoredCategories(next);
      return next;
    });
    saveCustomerCategoryCloud(category).catch(console.error);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (isDefaultCustomerCategory(categoryId)) {
      alert('Kategori pelanggan standar (GROSIR, UMUM, AGEN) bersifat permanen dan tidak dapat dihapus.');
      return;
    }
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== categoryId);
      saveStoredCategories(next);
      return next;
    });
    deleteCustomerCategoryCloud(categoryId).catch(console.error);
  };

  // Product Categories Handlers
  const handleSaveProductCategory = (category: ProductCategoryItem) => {
    setProductCategories((prev) => {
      const exists = prev.some((c) => c.id.toLowerCase() === category.id.toLowerCase() || c.name.toLowerCase() === category.name.toLowerCase());
      const next = exists
        ? prev.map((c) => (c.id.toLowerCase() === category.id.toLowerCase() || c.name.toLowerCase() === category.name.toLowerCase() ? category : c))
        : [...prev, category];
      saveStoredProductCategories(next);
      return next;
    });
    saveProductCategoryCloud(category).catch(console.error);
  };

  const handleRenameProductCategory = (oldIdOrName: string, updatedCategory: ProductCategoryItem) => {
    if (isDefaultProductCategory(oldIdOrName) || isDefaultProductCategory(updatedCategory.id) || isDefaultProductCategory(updatedCategory.name)) {
      console.warn('Permanent default category cannot be renamed.');
      return;
    }
    setProductCategories((prev) => {
      const next = prev.map((c) => {
        if (c.id.toLowerCase() === oldIdOrName.toLowerCase() || c.name.toLowerCase() === oldIdOrName.toLowerCase()) {
          return updatedCategory;
        }
        return c;
      });
      saveStoredProductCategories(next);
      return next;
    });
    saveProductCategoryCloud(updatedCategory).catch(console.error);

    setProducts((prev) => {
      const updated = prev.map((p) => {
        if (p.category.toLowerCase() === oldIdOrName.toLowerCase()) {
          const updatedProd = { ...p, category: updatedCategory.name };
          saveProductCloud(updatedProd).catch(console.error);
          return updatedProd;
        }
        return p;
      });
      saveStoredProducts(updated);
      return updated;
    });
  };

  const handleDeleteProductCategory = (categoryId: string) => {
    if (isDefaultProductCategory(categoryId)) {
      console.warn('Permanent default category cannot be deleted.');
      return;
    }
    setProductCategories((prev) => {
      const next = prev.filter((c) => c.id !== categoryId);
      saveStoredProductCategories(next);
      return next;
    });
    deleteProductCategoryCloud(categoryId).catch(console.error);
  };

  /* Identitas toko yang dipakai bersama website ikut diperbarui. Hanya field
     yang masih mencerminkan data toko sebelumnya yang diubah, sehingga
     kustomisasi khusus website (mis. nama merek "BEJO Print") tidak tertimpa. */
  const syncStoreIdentityToLanding = (prev: StoreInfo, next: StoreInfo) => {
    const digits = (value: string) => (value || '').replace(/[^0-9]/g, '');
    const prevName = (prev.storeName || '').trim();
    const nextName = (next.storeName || '').trim();
    const prevPhone = (prev.phone || '').trim();
    const nextPhone = (next.phone || '').trim();
    const prevAddress = (prev.address || '').trim();
    const nextAddress = (next.address || '').trim();

    const apply = (config: LandingPageConfig): LandingPageConfig | null => {
      let changed = false;
      const brand = { ...config.brand };
      const contact = { ...config.contact };

      if (nextName && (brand.name || '').trim() === prevName) {
        brand.name = nextName;
        changed = true;
      }
      if (nextPhone && (contact.phoneDisplay || '').trim() === prevPhone) {
        contact.phoneDisplay = nextPhone;
        changed = true;
      }
      if (nextAddress && (contact.storeAddress || '').trim() === prevAddress) {
        contact.storeAddress = nextAddress;
        changed = true;
      }
      if (nextPhone && digits(contact.whatsappNumber) === digits(prevPhone)) {
        const usesCountryCode = /^\+?62/.test((contact.whatsappNumber || '').trim());
        const nextDigits = digits(nextPhone);
        contact.whatsappNumber = usesCountryCode
          ? nextDigits.replace(/^0/, '62')
          : nextDigits.replace(/^62/, '0');
        changed = true;
      }

      return changed
        ? { ...config, brand, contact, lastModifiedAt: Date.now() }
        : null;
    };

    const draft = apply(landingDraft);
    if (draft) {
      saveStoredLandingDraft(draft);
      saveLandingDraftCloud(draft).catch(console.error);
    }

    const published = apply(landingConfig);
    if (published) {
      saveStoredLandingConfig(published);
      saveLandingPublishedCloud(published).catch(console.error);
    }
  };

  // Store Info Handler
  const handleSaveStoreInfo = (newStoreInfo: StoreInfo) => {
    syncStoreIdentityToLanding(storeInfo, newStoreInfo);
    setStoreInfo(newStoreInfo);
    saveStoredStoreInfo(newStoreInfo);
    saveStoreInfoCloud(newStoreInfo).catch(console.error);
    syncInvoiceIdentityFromStore(newStoreInfo);

    /* Profil aktif harus ikut tersimpan ke database, bukan hanya store_info,
       agar daftar profil di dashboard dan perangkat lain tidak tertinggal. */
    const activeProfile = storeProfiles.find((p) => p.id === activeProfileId);
    if (activeProfile) {
      const updatedProfile: StoreProfile = {
        ...activeProfile,
        storeName: newStoreInfo.storeName,
        branch: newStoreInfo.branch,
        address: newStoreInfo.address,
        phone: newStoreInfo.phone,
        receiptFooter: newStoreInfo.receiptFooter,
        logoUrl: newStoreInfo.logoUrl,
        storeStatus: newStoreInfo.storeStatus,
        isMaster: activeProfile.id === 'bejo_polsek' ? true : activeProfile.isMaster
      };
      setStoreProfiles((prev) => prev.map((p) => (p.id === updatedProfile.id ? updatedProfile : p)));
      saveStoreProfileCloud(updatedProfile).catch(console.error);
    }

    recordActivityLog(
      'STORE_SETTINGS',
      `Simpan Profil Toko "${newStoreInfo.storeName}"`,
      `Oleh: ${currentUser?.name || 'Admin'} • Cabang: ${newStoreInfo.branch || '-'}`
    );
  };

  // Multi-Store Profile Handlers
  const handleSaveStoreProfile = (profile: StoreProfile) => {
    setStoreProfiles((prev) => {
      const exists = prev.some((p) => p.id === profile.id);
      const next = exists
        ? prev.map((p) => (p.id === profile.id ? profile : p))
        : [...prev, profile];
      saveStoredStoreProfiles(next);
      return next;
    });
    saveStoreProfileCloud(profile).catch(console.error);

    // If saving active profile, update storeInfo
    if (profile.id === activeProfileId) {
      const updatedInfo: StoreInfo = {
        storeName: profile.storeName,
        appTitle: storeInfo.appTitle || 'Point of Sales',
        branch: profile.branch,
        address: profile.address,
        phone: profile.phone,
        receiptFooter: profile.receiptFooter,
        logoUrl: profile.logoUrl,
        storeStatus: profile.storeStatus || storeInfo.storeStatus || 'ONLINE',
        isMaster: profile.isMaster || profile.id === 'bejo_polsek'
      };
      setStoreInfo(updatedInfo);
      saveStoredStoreInfo(updatedInfo);
      saveStoreInfoCloud(updatedInfo).catch(console.error);
      syncInvoiceIdentityFromStore(updatedInfo);
    }

    recordActivityLog(
      'STORE_SETTINGS',
      `Simpan Profil Toko "${profile.storeName}"`,
      `Oleh: ${currentUser?.name || 'Admin'} • Cabang: ${profile.branch || '-'}`
    );
  };

  const handleDeleteStoreProfile = (profileId: string) => {
    if (profileId === 'bejo_polsek') return;
    setStoreProfiles((prev) => {
      const next = prev.filter((p) => p.id !== profileId);
      saveStoredStoreProfiles(next);
      return next;
    });
    deleteStoreProfileCloud(profileId).catch(console.error);

    // If deleted profile was active, fallback to master
    if (activeProfileId === profileId) {
      handleSwitchStoreProfile('bejo_polsek');
    }
  };

  const handleSwitchStoreProfile = (profileId: string) => {
    const target = storeProfiles.find((p) => p.id === profileId) || DEFAULT_MASTER_STORE_PROFILE;
    setActiveProfileId(target.id);
    saveStoredActiveProfileId(target.id);
    saveActiveStoreProfileIdCloud(target.id).catch(console.error);

    // Switch store info metadata
    const updatedInfo: StoreInfo = {
      storeName: target.storeName,
      appTitle: storeInfo.appTitle || 'Point of Sales',
      branch: target.branch,
      address: target.address,
      phone: target.phone,
      receiptFooter: target.receiptFooter,
      logoUrl: target.logoUrl || storeInfo.logoUrl,
      storeStatus: target.storeStatus || storeInfo.storeStatus || 'ONLINE',
      isMaster: target.isMaster || target.id === 'bejo_polsek'
    };
    setStoreInfo(updatedInfo);
    saveStoredStoreInfo(updatedInfo);
    saveStoreInfoCloud(updatedInfo).catch(console.error);
    syncInvoiceIdentityFromStore(updatedInfo);

    // Load profile-specific transactions and shifts
    const profTx = getStoredTransactionsForProfile(target.id);
    const profShifts = getStoredShiftsForProfile(target.id);
    const profActiveShift = getStoredActiveShiftForProfile(target.id);

    setTransactions(profTx);
    setPastShifts(profShifts);
    setActiveShift(profActiveShift);

    recordActivityLog(
      'STORE_SETTINGS',
      `Beralih ke Profil Toko "${target.storeName}"`,
      `Aktif sekarang: ${target.storeName} (${target.branch}) • Database Transaksi Stand-alone`
    );
  };

  // Cashiers Handlers
  const handleSaveCashier = (cashier: CashierUser) => {
    setCashiers((prev) => {
      const exists = prev.some((c) => c.id === cashier.id);
      const next = exists
        ? prev.map((c) => (c.id === cashier.id ? cashier : c))
        : [...prev, cashier];
      saveStoredCashiers(next);
      return next;
    });
    saveCashierCloud(cashier).catch(console.error);
  };

  const handleDeleteCashier = (cashierId: string) => {
    setCashiers((prev) => {
      const next = prev.filter((c) => c.id !== cashierId);
      saveStoredCashiers(next);
      return next;
    });
    deleteCashierCloud(cashierId).catch(console.error);
  };

  // Shift Handlers
  const handleOpenShift = (cashierName: string, shiftName: string, initialCash: number, store: string) => {
    const today = new Date();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dateFormatted = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
    const isoNow = today.toISOString();

    const newShift: Shift = {
      id: `shift_${Date.now()}`,
      cashierName,
      shiftName,
      startingCash: initialCash,
      initialCash,
      status: 'OPEN',
      startTime: isoNow,
      date: dateFormatted,
      totalCashSales: 0,
      totalTransferSales: 0,
      totalQrisSales: 0,
      transactionCount: 0,
      isActive: true,
      storeName: store || storeInfo.storeName,
    };

    setActiveShift(newShift);
    saveStoredActiveShift(newShift);
    saveActiveShiftCloud(newShift).catch(console.error);
    setIsShiftModalOpen(false);

    recordActivityLog(
      'SHIFT_OPEN',
      `Membuka Shift Kasir (${shiftName})`,
      `Kasir: ${cashierName} • Kas Awal: Rp ${initialCash.toLocaleString('id-ID')} • Toko: ${store || storeInfo.storeName}`
    );
  };

  const handleCloseShift = (
    actualCashInDrawer: number,
    notes?: string,
    operationalExpenses: number = 0,
    operationalNotes?: string
  ) => {
    const currentActive = computedActiveShift || activeShift;
    if (!currentActive) return;

    const today = new Date();
    const isoNow = today.toISOString();
    const startCash = currentActive.startingCash || currentActive.initialCash || 0;
    const shiftCashSales = currentActive.totalCashSales || 0;

    const closedShift: Shift = {
      ...currentActive,
      endTime: isoNow,
      status: 'CLOSED',
      actualEndingCash: actualCashInDrawer,
      actualCashInDrawer,
      cashDifference: actualCashInDrawer - (startCash + shiftCashSales - operationalExpenses),
      notes: notes || '',
      operationalExpenses: operationalExpenses || 0,
      operationalNotes: operationalNotes || '',
      isActive: false,
      closedAt: new Date().toISOString(),
    };

    const nextShifts = [closedShift, ...pastShifts];
    setPastShifts(nextShifts);
    saveStoredShifts(nextShifts);
    saveShiftCloud(closedShift).catch(console.error);

    recordActivityLog(
      'SHIFT_CLOSE',
      `Menutup Shift Kasir (${currentActive.shiftName})`,
      `Kasir: ${currentActive.cashierName} • Kas Fisik: Rp ${actualCashInDrawer.toLocaleString('id-ID')} • Total Penjualan Kas: Rp ${shiftCashSales.toLocaleString('id-ID')}`
    );

    setActiveShift(null);
    saveStoredActiveShift(null);
    saveActiveShiftCloud(null).catch(console.error);
    setIsShiftModalOpen(false);
  };

  const handleDeleteShift = async (shiftId: string) => {
    const updated = pastShifts.filter((s) => s.id !== shiftId);
    setPastShifts(updated);
    saveStoredShifts(updated);
    try {
      await deleteShiftCloud(shiftId);
    } catch (e) {
      console.error('Failed to delete shift from cloud:', e);
    }
    recordActivityLog(
      'SHIFT_DELETE',
      `Menghapus Riwayat Rekap Shift ${shiftId}`,
      `Oleh: ${currentUser.name} (${currentUser.role})`
    );
  };

  const handleClearAllShifts = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus SELURUH Riwayat Rekap Shift Kasir? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    const shiftsToDelete = [...pastShifts];
    setPastShifts([]);
    saveStoredShifts([]);
    for (const s of shiftsToDelete) {
      try {
        await deleteShiftCloud(s.id);
      } catch (e) {
        console.error('Failed to delete shift from cloud:', e);
      }
    }
    recordActivityLog(
      'SHIFT_CLEAR_ALL',
      'Menghapus SELURUH Riwayat Rekap Shift Kasir',
      `Oleh: ${currentUser.name} (${currentUser.role})`
    );
  };

  // Transaction Handler
  const handleCompleteTransaction = (tx: Transaction) => {
    // 1. Deduct Product stock using borrow/return conversion logic
    setProducts((prev) => {
      const updated = prev.map((p) => {
        const prodItems = tx.items.filter((item) => item.productId === p.id);
        if (prodItems.length > 0 && p.stock !== undefined) {
          const isDigital = isDigitalPrintingProduct(p, productCategories);
          const isLaser = isLaserCuttingProduct(p, productCategories);
          const isPaket = isPaketProduct(p, productCategories);
          if (isDigital || isLaser || isPaket) {
            // Khusus transaksi produk kategori Digital Printing, Paket, Laser Cutting tidak akan mengurangi jumlah stok produk
            return p;
          }

          const formula = getMaterialStockFormula(p);
          const conversionRate = formula.qtyPerRollPak || 1;

          // Calculate total small units deducted across all items of this product
          let totalSmallUnitsSold = 0;
          for (const item of prodItems) {
            const isSmallUnit =
              item.saleType === 'meter' ||
              item.saleType === 'lembar' ||
              isMeterOrLembarUnit(item.unit);

            if (isSmallUnit) {
              // Sold in small units (meter, lembar)
              const smallQty =
                typeof item.lengthMeters === 'number' && typeof item.widthMeters === 'number' && item.lengthMeters > 0 && item.widthMeters > 0
                  ? item.lengthMeters * item.widthMeters * (item.itemCount || item.qty || 1)
                  : Number(item.qty) || 1;
              totalSmallUnitsSold += smallQty;
            } else {
              // Sold in primary units (roll, pak, botol)
              const largeQty = Number(item.qty) || 1;
              totalSmallUnitsSold += largeQty * conversionRate;
            }
          }

          // Apply Borrow-Return Formula:
          // Total Sisa = (Stok Satuan Besar Awal x Konversi) - Penjualan Satuan Kecil
          // Sisa Satuan Besar = Sisa Satuan Kecil / Konversi
          const breakdown = calculateBorrowReturnStock(
            p.stock,
            0,
            conversionRate,
            totalSmallUnitsSold,
            formula.unit,
            formula.subUnit
          );

          const newStock = Math.max(0, breakdown.totalInPrimaryUnits);
          const updatedProd = { ...p, stock: newStock };
          saveProductCloud(updatedProd).catch(console.error);
          return updatedProd;
        }
        return p;
      });
      saveStoredProducts(updated);
      return updated;
    });

    // 2. Update Customer spend
    if (tx.customer) {
      setCustomers((prev) => {
        const updated = prev.map((cust) => {
          if (cust.id === tx.customer?.id) {
            const updatedCust = {
              ...cust,
              totalSpent: (cust.totalSpent || 0) + tx.total,
              transactionCount: (cust.transactionCount || 0) + 1
            };
            saveCustomerCloud(updatedCust).catch(console.error);
            return updatedCust;
          }
          return cust;
        });
        saveStoredCustomers(updated);
        return updated;
      });
    }

    // 3. Record Activity Log
    const methodStr = tx.paymentMethods.cash > 0 ? 'Cash' : tx.paymentMethods.qris > 0 ? 'QRIS' : 'Transfer';
    const backdatedSuffix = tx.isBackdated ? ' (Lupa diinput Kasir / Backdated oleh Developer)' : '';
    recordActivityLog(
      'TRANSACTION',
      `Transaksi POS #${tx.id}`,
      `Total: Rp ${tx.total.toLocaleString('id-ID')} (${tx.totalQty} item) • Pelanggan: ${tx.customer?.name || 'Umum'} • Metode: ${methodStr}${backdatedSuffix}`
    );

    // 3. Update Shift stats if active and NOT backdated
    if (activeShift && !tx.isBackdated) {
      const netCash = getNetCashAmount(tx);
      const updatedShift: Shift = {
        ...activeShift,
        totalCashSales: (activeShift.totalCashSales || 0) + netCash,
        totalTransferSales: (activeShift.totalTransferSales || 0) + (tx.paymentMethods?.transfer || 0),
        totalQrisSales: (activeShift.totalQrisSales || 0) + (tx.paymentMethods?.qris || 0),
        transactionCount: (activeShift.transactionCount || 0) + 1
      };
      setActiveShift(updatedShift);
      saveStoredActiveShift(updatedShift);
      saveActiveShiftCloud(updatedShift).catch(console.error);
    }

    // 4. Save to Transactions state, localStorage & Cloud PocketBase
    setTransactions((prev) => {
      const map = new Map<string, Transaction>();
      map.set(tx.id, tx);
      prev.forEach((t) => {
        if (!map.has(t.id)) map.set(t.id, t);
      });
      const updated = Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
      saveStoredTransactions(updated);
      return updated;
    });
    saveTransactionCloud(tx).catch(console.error);

    // 5. Open Thermal Receipt preview immediately
    setReceiptTransaction(tx);
    setIsReceiptModalOpen(true);
  };

  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    const previous = transactions.find((t) => t.id === updatedTx.id);

    setTransactions((prev) => {
      const updated = prev.map((t) => (t.id === updatedTx.id ? updatedTx : t));
      saveStoredTransactions(updated);
      return updated;
    });

    // Sesuaikan akumulasi belanja pelanggan saat nominal / pelanggan transaksi diedit
    const prevCustId = previous?.customer?.id;
    const nextCustId = updatedTx.customer?.id;
    if (previous && (prevCustId || nextCustId)) {
      const prevTotal = previous.total || 0;
      const nextTotal = updatedTx.total || 0;
      setCustomers((prev) => {
        const updated = prev.map((cust) => {
          let next = cust;
          if (prevCustId === nextCustId && cust.id === nextCustId) {
            next = {
              ...cust,
              totalSpent: Math.max(0, (cust.totalSpent || 0) + (nextTotal - prevTotal)),
            };
          } else {
            if (prevCustId && cust.id === prevCustId) {
              next = {
                ...next,
                totalSpent: Math.max(0, (next.totalSpent || 0) - prevTotal),
                transactionCount: Math.max(0, (next.transactionCount || 0) - 1),
              };
            }
            if (nextCustId && cust.id === nextCustId) {
              next = {
                ...next,
                totalSpent: (next.totalSpent || 0) + nextTotal,
                transactionCount: (next.transactionCount || 0) + 1,
              };
            }
          }
          if (next !== cust) {
            saveCustomerCloud(next).catch(console.error);
          }
          return next;
        });
        saveStoredCustomers(updated);
        return updated;
      });
    }

    await saveTransactionCloud(updatedTx);
    recordActivityLog(
      'TRANSACTION',
      `Edit Transaksi Penjualan #${updatedTx.id}`,
      `Total: Rp ${updatedTx.total.toLocaleString('id-ID')} • Pelanggan: ${updatedTx.customer?.name || 'Umum'} • Tgl: ${updatedTx.date}`
    );
  };

  const handleDeleteTransaction = async (txId: string) => {
    const target = transactions.find((t) => t.id === txId);
    setTransactions((prev) => {
      const updated = prev.filter((t) => t.id !== txId);
      saveStoredTransactions(updated);
      return updated;
    });

    // Kembalikan akumulasi belanja pelanggan agar tidak meninggalkan saldo transaksi terhapus
    if (target?.customer?.id) {
      const custId = target.customer.id;
      setCustomers((prev) => {
        const updated = prev.map((cust) => {
          if (cust.id !== custId) return cust;
          const next = {
            ...cust,
            totalSpent: Math.max(0, (cust.totalSpent || 0) - (target.total || 0)),
            transactionCount: Math.max(0, (cust.transactionCount || 0) - 1),
          };
          saveCustomerCloud(next).catch(console.error);
          return next;
        });
        saveStoredCustomers(updated);
        return updated;
      });
    }

    await deleteTransactionCloud(txId);
    recordActivityLog(
      'TRANSACTION',
      `Hapus Transaksi Penjualan #${txId}`,
      `Menghapus transaksi senilai Rp ${target?.total ? target.total.toLocaleString('id-ID') : 0} dari Laporan Penjualan Toko`
    );
  };

  const handlePrintReceiptDirect = (tx: Transaction) => {
    setReceiptTransaction(tx);
    setIsReceiptModalOpen(true);
  };

  // If user is not authenticated: Check whether Landing Page is published
  if (!currentUser) {
    if (landingConfig.isPublished && !isShowingLoginModal) {
      return (
        <LandingPage
          config={landingConfig}
          storeName={storeInfo.storeName || 'BEJO Digital Print'}
          logoUrl={storeInfo.logoUrl}
          currentUser={null}
          onOpenLogin={() => setIsShowingLoginModal(true)}
        />
      );
    }

    return (
      <LoginScreen
        users={users}
        onLoginSuccess={handleLoginSuccess}
        storeName={storeInfo.storeName || 'BEJO Digital Print'}
        onBackToLanding={landingConfig.isPublished ? () => setIsShowingLoginModal(false) : undefined}
      />
    );
  }

  const userRole = currentUser.role;

  // If logged-in user is previewing or viewing the public Landing Page
  if (isViewingPublicLanding) {
    return (
      <LandingPage
        config={landingConfig}
        storeName={storeInfo.storeName || 'BEJO Digital Print'}
        logoUrl={storeInfo.logoUrl}
        currentUser={currentUser}
        onOpenLogin={() => {}}
        onEnterApp={() => setIsViewingPublicLanding(false)}
        onOpenDeveloperCms={userRole === 'DEVELOPER' ? () => {
          setIsViewingPublicLanding(false);
          setCurrentTab('landing_editor');
        } : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-20 md:pb-10 print:pb-0 print:p-0 print:m-0 print:bg-white transition-colors duration-250">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeShift={computedActiveShift}
        storeName={computedActiveShift?.storeName || storeInfo.storeName}
        appTitle={storeInfo.appTitle}
        logoUrl={storeInfo.logoUrl}
        isCloudConnected={isCloudConnected}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        onOpenDatabaseModal={() => setIsLocalDatabaseModalOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        onViewLandingPage={() => setIsViewingPublicLanding(true)}
      />

      {/* Real-time Backend Error Notification Banner with Instant Auto-Fix */}
      <div className="no-print">
        <BackendErrorBanner
          onOpenDiagnosticsModal={() => setIsBackendDiagnosticsModalOpen(true)}
          userRole={userRole}
        />
      </div>

      {/* Main Content Body */}
      <main className="flex-1 w-full pt-2 print:pt-0 print:p-0 print:m-0">
        {currentTab === 'pos' && (
          <PosScreen
            cartItems={cartItems}
            onAddToCart={handleAddToCart}
            onRemoveItem={handleRemoveCartItem}
            onClearCart={handleClearCart}
            products={products}
            customers={customers}
            categories={categories}
            activeShift={computedActiveShift}
            storeName={computedActiveShift?.storeName || storeInfo.storeName}
            transactions={transactions}
            onOpenMaterialModal={() => setIsMaterialModalOpen(true)}
            onOpenPrintModal={handleNavigateToSpkCreate}
            onOpenUnifiedModal={handleOpenUnifiedModal}
            onNavigateToSpkCreate={handleNavigateToSpkCreate}
            onOpenNewCustomerModal={() => {
              setEditingCustomerForModal(null);
              setIsCustomerModalOpen(true);
            }}
            onOpenEditCustomerModal={(cust) => {
              setEditingCustomerForModal(cust);
              setIsCustomerModalOpen(true);
            }}
            onOpenShiftModal={() => setIsShiftModalOpen(true)}
            onCompleteTransaction={handleCompleteTransaction}
            latestCustomer={latestCustomer}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            userRole={userRole}
            pendingSpkOrderToLoad={pendingSpkOrderToLoad}
            onClearPendingSpkOrder={() => setPendingSpkOrderToLoad(null)}
          />
        )}

        {currentTab === 'inventory' && (userRole === 'DEVELOPER' || userRole === 'OWNER' || userRole === 'ADMIN') && (
          <InventoryScreen
            products={products}
            productCategories={productCategories}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onSaveProductCategory={handleSaveProductCategory}
            onRenameProductCategory={handleRenameProductCategory}
            onDeleteProductCategory={handleDeleteProductCategory}
            userRole={userRole}
          />
        )}

        {currentTab === 'stock' && (userRole === 'DEVELOPER' || userRole === 'OWNER' || userRole === 'ADMIN') && (
          <StockScreen
            products={products}
            suppliers={suppliers}
            agents={agents}
            productCategories={productCategories}
            onAddStockTransaction={handleAddStockTransaction}
            onAddBatchStockTransactions={handleAddBatchStockTransactions}
            onUpdateProductStockAndCost={handleUpdateProductStockAndCost}
            onUpdateBatchProductStockAndCost={handleUpdateBatchProductStockAndCost}
          />
        )}

        {currentTab === 'customers' && (userRole === 'DEVELOPER' || userRole === 'OWNER' || userRole === 'ADMIN') && (
          <CustomerScreen
            products={products}
            onSaveProduct={handleSaveProduct}
            customers={customers}
            suppliers={suppliers}
            agents={agents}
            categories={categories}
            transactions={transactions}
            stockTransactions={stockTransactions}
            storeInfo={storeInfo}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onSaveSupplier={handleSaveSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onSaveAgent={handleSaveAgent}
            onDeleteAgent={handleDeleteAgent}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onSaveStoreInfo={handleSaveStoreInfo}
            storeProfiles={storeProfiles}
            activeProfileId={activeProfileId}
            onSaveStoreProfile={handleSaveStoreProfile}
            onDeleteStoreProfile={handleDeleteStoreProfile}
            onSwitchStoreProfile={handleSwitchStoreProfile}
            userRole={userRole}
            users={users}
            onSaveUser={handleSaveAppUser}
            onDeleteUser={handleDeleteAppUser}
            customRoles={customRoles}
            onSaveCustomRole={handleSaveCustomRole}
            onDeleteCustomRole={handleDeleteCustomRole}
            onOpenBackendDiagnostics={() => setIsBackendDiagnosticsModalOpen(true)}
            currentUserId={currentUser.id}
          />
        )}

        {currentTab === 'transactions' && (userRole === 'DEVELOPER' || userRole === 'OWNER' || userRole === 'ADMIN') && (
          <LaporanScreen
            transactions={transactions}
            stockTransactions={stockTransactions}
            invoices={invoices}
            storeName={storeInfo.storeName}
            isStoreOnline={storeInfo.storeStatus === 'ONLINE'}
            onPrintReceipt={handlePrintReceiptDirect}
            products={products}
            suppliers={suppliers}
            agents={agents}
            categories={categories}
            customers={customers}
            productCategories={productCategories}
            userRole={userRole}
            shifts={pastShifts}
            onUpdateStockTransaction={handleUpdateStockTransaction}
            onDeleteStockTransaction={handleDeleteStockTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            financialSettings={financialSettings}
            onSaveFinancialSettings={handleSaveFinancialSettings}
          />
        )}

        {currentTab === 'shift' && (
          <ShiftScreen
            activeShift={computedActiveShift}
            pastShifts={pastShifts}
            transactions={transactions}
            cashiers={cashiers}
            categories={categories}
            customers={customers}
            userRole={userRole}
            onOpenShiftModal={() => setIsShiftModalOpen(true)}
            onCloseActiveShift={handleCloseShift}
            onSaveCashier={handleSaveCashier}
            onDeleteCashier={handleDeleteCashier}
            onDeleteShift={handleDeleteShift}
            onClearAllShifts={handleClearAllShifts}
          />
        )}

        {currentTab === 'agen' && (userRole === 'DEVELOPER' || userRole === 'ADMIN' || userRole === 'AGEN' || userRole === 'OWNER') && (
          <AgentScreen
            products={products}
            agents={agents}
            productCategories={productCategories}
            stockTransactions={stockTransactions}
            transactions={transactions}
            customers={customers}
            storeInfo={storeInfo}
            userRole={userRole}
            currentUser={currentUser}
            onAddStockTransaction={handleAddStockTransaction}
            onAddBatchStockTransactions={handleAddBatchStockTransactions}
            onUpdateProductStockAndCost={handleUpdateProductStockAndCost}
            onUpdateBatchProductStockAndCost={handleUpdateBatchProductStockAndCost}
            onPrintReceiptDirect={handlePrintReceiptDirect}
            defaultSubTab={agentScreenSubTab}
          />
        )}

        {currentTab === 'spk' && (userRole === 'DEVELOPER' || userRole === 'SPK' || userRole === 'OWNER' || userRole === 'ADMIN') && (
          <SpkScreen
            products={products}
            customers={customers}
            categories={categories}
            currentUser={currentUser}
            users={users}
            storeInfo={storeInfo}
            initialTab={spkInitialTab}
            onSaveUser={handleSaveAppUser}
            onDeleteUser={handleDeleteAppUser}
            onNavigateToPos={(spkData) => {
              if (spkData) {
                setPendingSpkOrderToLoad(spkData);
              }
              setCurrentTab('pos');
            }}
            onNavigateToInvoice={(groupData) => {
              if (groupData) {
                setPendingOpenAccountForInvoice(groupData);
              }
              setCurrentTab('invoices');
            }}
            onSaveCustomer={handleSaveCustomer}
          />
        )}

        {currentTab === 'landing_editor' && userRole === 'DEVELOPER' && (
          <LandingPageEditorScreen
            initialConfig={landingDraft}
            publishedConfig={landingConfig}
            onDraftUpdated={async (updated) => {
              setLandingDraft(updated);
              saveStoredLandingDraft(updated);
              await saveLandingDraftCloud(updated);
            }}
            onPublish={async (published) => {
              await saveLandingPublishedCloud(published);
              setLandingConfig(published);
              saveStoredLandingConfig(published);
            }}
            onUnpublish={async () => {
              const next = { ...landingConfig, isPublished: false, lastModifiedAt: Date.now() };
              await saveLandingPublishedCloud(next);
              setLandingConfig(next);
              saveStoredLandingConfig(next);
            }}
            onPreviewLandingPage={() => setIsViewingPublicLanding(true)}
          />
        )}

        {currentTab === 'invoices' && (userRole === 'DEVELOPER' || userRole === 'ADMIN' || userRole === 'OWNER') && (
          <InvoiceScreen
            products={products}
            customers={customers}
            currentUser={currentUser}
            userRole={userRole}
            pendingOpenAccountGroup={pendingOpenAccountForInvoice}
            onClearPendingOpenAccountGroup={() => setPendingOpenAccountForInvoice(null)}
          />
        )}

        {currentTab === 'tax' && (userRole === 'DEVELOPER' || userRole === 'ADMIN' || userRole === 'OWNER') && (
          <TaxScreen />
        )}

        {currentTab === 'marketing' && (userRole === 'DEVELOPER' || userRole === 'ADMIN' || userRole === 'OWNER') && (
          <MarketingScreen />
        )}
      </main>

      {/* Startup & Re-open Cashier & Shift Gate Modal */}
      <CashierGateModal
        isOpen={activeShift === null && userRole !== 'SPK' && userRole !== 'AGEN'}
        cashiers={cashiers}
        defaultStoreName={storeInfo.storeName}
        onOpenShift={handleOpenShift}
      />

      {/* Modals */}
      <UnifiedAddProductModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        products={products}
        categories={categories}
        productCategories={productCategories}
        selectedCustomer={selectedCustomer}
        initialTab={unifiedModalTab}
        onNavigateToSpkCreate={handleNavigateToSpkCreate}
        onAddToCart={(item) => {
          handleAddToCart(item);
          setCurrentTab('pos');
        }}
      />

      <AddMaterialModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        products={products}
        categories={categories}
        productCategories={productCategories}
        selectedCustomer={selectedCustomer}
        onAddToCart={(item) => {
          handleAddToCart(item);
          setCurrentTab('pos');
        }}
      />

      <AddPrintServiceModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        products={products}
        categories={categories}
        productCategories={productCategories}
        selectedCustomer={selectedCustomer}
        onAddToCart={(item) => {
          handleAddToCart(item);
          setCurrentTab('pos');
        }}
      />

      <NewCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => {
          setIsCustomerModalOpen(false);
          setEditingCustomerForModal(null);
        }}
        categories={categories}
        customerToEdit={editingCustomerForModal}
        onSaveCustomer={(savedCustomer) => {
          handleSaveCustomer(savedCustomer);
          setLatestCustomer(savedCustomer);
          setSelectedCustomer(savedCustomer);
        }}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        transaction={receiptTransaction}
      />

      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        activeShift={computedActiveShift}
        transactions={transactions}
        categories={categories}
        customers={customers}
        defaultStoreName={storeInfo.storeName}
        onOpenShift={(cashier, cash, store, shiftName) => handleOpenShift(cashier, shiftName || 'Shift 1', cash, store)}
        onCloseShift={handleCloseShift}
      />

      {/* Developer User Management Modal */}
      {userRole === 'DEVELOPER' && (
        <UserManagementModal
          isOpen={isUserManagementModalOpen}
          onClose={() => setIsUserManagementModalOpen(false)}
          users={users}
          currentUserId={currentUser.id}
          currentUserRole={userRole}
          activityLogs={activityLogs}
          onSaveUser={handleSaveAppUser}
          onDeleteUser={handleDeleteAppUser}
          onClearLogs={handleClearActivityLogs}
        />
      )}

      {/* Backend Diagnostics & System Health Control Modal */}
      <BackendDiagnosticsModal
        isOpen={isBackendDiagnosticsModalOpen}
        onClose={() => setIsBackendDiagnosticsModalOpen(false)}
        userRole={userRole}
      />

      {/* Local Database & Cloud Real-Time Sync Configuration Modal (DEVELOPER ONLY) */}
      {userRole === 'DEVELOPER' && (
        <LocalDatabaseSyncModal
          isOpen={isLocalDatabaseModalOpen}
          onClose={() => setIsLocalDatabaseModalOpen(false)}
          isCloudConnected={isCloudConnected}
        />
      )}

      {/* Floating AI Assistant Widget with full system knowledge, bonding memory & Agent Order popup */}
      <AiAssistant
        currentTab={currentTab}
        userRole={userRole}
        currentUser={currentUser}
        users={users}
        products={products}
        customers={customers}
        suppliers={suppliers}
        agents={agents}
        categories={categories}
        transactions={transactions}
        activeShift={computedActiveShift}
        storeInfo={storeInfo}
        agentNotifications={agentNotifications}
        onNavigateTab={(tab) => {
          if (tab === 'agen') {
            setAgentScreenSubTab('riwayat');
          }
          setCurrentTab(tab as any);
        }}
        onMarkNotificationRead={(notifId) => {
          markAgentNotificationReadCloud(notifId, currentUser?.id || 'sys').catch(console.error);
        }}
      />
    </div>
  );
}
