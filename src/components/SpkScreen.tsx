/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 * SPK & Digital Printing Workflow Module (Tahap 1 - Developer Mode)
 * Ultra-Clear Typography, High Contrast & Theme Uniformity with POS Ecosystem
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Printer,
  Plus,
  Search,
  Filter,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Phone,
  Calendar,
  Sparkles,
  ArrowRight,
  Maximize2,
  Settings,
  Scissors,
  Tag,
  Download,
  Share2,
  Trash2,
  Edit3,
  Flame,
  Check,
  X,
  Play,
  CheckCheck,
  ChevronRight,
  Eye,
  Sliders,
  RefreshCw,
  Cpu,
  Monitor,
  Building2,
  DollarSign,
  AlertTriangle,
  FileCheck2,
  ShieldCheck,
  HelpCircle,
  TrendingUp,
  Boxes,
  ShoppingCart,
  Users,
  Wifi,
  WifiOff,
  UserCheck,
  UserX,
  Activity,
  Briefcase,
  Radio,
  CheckCircle,
  Folder,
  FolderOpen,
  FileUp,
  Copy,
  ExternalLink,
  HardDrive,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  FolderSymlink,
  Paperclip
} from 'lucide-react';
import {
  SpkOrder,
  SpkStatus,
  SpkPriority,
  MachineType,
  MachineItem,
  SpkDigitalPrintItem,
  SpkFinishingItem,
  Product,
  Customer,
  CustomerCategory,
  AppUser,
  SpkRoleCategory,
  SpkPrintFileAttachment,
  PrintingRejectRecord
} from '../types';

export interface FormItemFinishing {
  laminasi: boolean;
  laminasiType: string;
  laminasiPrice: number;
  cutting: boolean;
  cuttingType: string;
  cuttingPrice: number;
  mataAyam: boolean;
  mataAyamQty: number;
  mataAyamPrice: number;
  lipatLem: boolean;
  lipatLemPrice: number;
  selongsong: boolean;
  selongsongPrice: number;
}
import {
  getStoredSpkOrders,
  saveStoredSpkOrders,
  addStoredSpkOrder,
  updateStoredSpkOrder,
  deleteStoredSpkOrder,
  generateSpkOrderNumber,
  getStoredStoreInfo,
  type StoreInfo,
  getStoredMachines,
  saveStoredMachines,
  getStoredPrintingRejects,
  saveStoredPrintingRejects
} from '../utils/storage';
import {
  saveLocalPrintFile,
  openOrDownloadPrintFile,
  copyLocalShortcutToClipboard,
  formatBytes,
  getFileExtensionMeta,
  formatLocalShortcutPath
} from '../utils/localFileVault';
import {
  applySharedCopyToAttachment,
  copyFileToSharedFolder,
  copyVaultFileToSharedFolder,
  getSharedFolderConfig,
  getSharedFolderGrantStatus,
  isSharedFolderApiSupported,
  normalizeFolderPath,
  openFileFromSharedFolder,
  pickSharedFolder,
  pickSharedFolderFiles,
  saveSharedFolderConfig,
  startSharedFolderCloudSync,
  verifySharedFolderFile,
  type SharedFolderGrantStatus,
  type SharedFolderPickResult
} from '../utils/sharedFolderAccess';
import {
  formatRupiah,
  formatNumber,
  getPrintServicePrice,
  getPaketPrice,
  getProductPriceForCategory
} from '../utils/formatters';
import { printThermalElement } from '../utils/thermalPrinter';
import { StoreLogo } from './StoreLogo';
import { OpenAccountGroupCard } from './spk/OpenAccountGroupCard';
import { groupOpenAccountOrders, OpenAccountCustomerGroup } from '../utils/openAccountStorage';
import { getPermanentDeveloperUser } from '../utils/authSecurity';
import { checkPasswordPolicy } from '../utils/credentialPolicy';
import { canManageRecords } from '../utils/recordAccess';
import {
  saveSpkOrderCloud,
  deleteSpkOrderCloud,
  saveMachineCloud,
  deleteMachineCloud,
  saveUserCloud,
  subscribePrintingRejects,
  savePrintingRejectCloud,
  deletePrintingRejectCloud
} from '../backend/pocketbaseBackend';
import { PrintingRejectView } from './PrintingRejectView';
import { LanNetworkFolderModal } from './modals/LanNetworkFolderModal';
import {
  scanAllLanMachines,
  pingLanMachine,
  copyUncPathWithCommand
} from '../utils/lanMachineDetector';
import {
  checkAndRunSpkAutoCleanup,
  cleanupCompletedSpkManual,
  getCurrentWibDateTime
} from '../utils/spkAutoCleanup';

interface SpkScreenProps {
  products: Product[];
  customers: Customer[];
  categories?: CustomerCategory[];
  currentUser: AppUser | null;
  users?: AppUser[];
  storeInfo?: StoreInfo;
  initialTab?: 'kanban' | 'list' | 'create' | 'machines' | 'team_status' | 'reject_log';
  onNavigateToPos?: (spkData?: any) => void;
  onNavigateToInvoice?: (invoiceData?: any) => void;
  onSaveCustomer?: (customer: Customer) => void;
  onSaveUser?: (user: AppUser) => void;
  onDeleteUser?: (userId: string) => void;
}

export const SpkScreen: React.FC<SpkScreenProps> = ({
  products,
  customers,
  categories,
  currentUser,
  users = [],
  storeInfo: storeInfoProp,
  initialTab,
  onNavigateToPos,
  onNavigateToInvoice,
  onSaveCustomer,
  onSaveUser,
  onDeleteUser
}) => {
  const localStoreInfo = useMemo(() => getStoredStoreInfo(), []);
  const storeInfo = storeInfoProp || localStoreInfo;
  const [orders, setOrders] = useState<SpkOrder[]>(() => getStoredSpkOrders());
  const [activeTab, setActiveTab] = useState<'kanban' | 'list' | 'create' | 'machines' | 'team_status' | 'reject_log'>(() => initialTab || 'kanban');

  // React to initialTab changes from parent
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Listen to global open create SPK event (triggered from POS "+ Jasa Cetak & Laser")
  useEffect(() => {
    const handleOpenCreate = () => {
      setActiveTab('create');
    };
    window.addEventListener('bejo_open_create_spk', handleOpenCreate);
    return () => window.removeEventListener('bejo_open_create_spk', handleOpenCreate);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');

  // Printing Rejects State & Handlers (Personal Printing Reject)
  const [printingRejects, setPrintingRejects] = useState<PrintingRejectRecord[]>(() => getStoredPrintingRejects());

  useEffect(() => {
    const unsub = subscribePrintingRejects((cloudRejects) => {
      if (cloudRejects) {
        setPrintingRejects(cloudRejects);
        saveStoredPrintingRejects(cloudRejects);
      }
    });
    return () => unsub();
  }, []);

  const handleSavePrintingReject = (record: PrintingRejectRecord) => {
    const existingIndex = printingRejects.findIndex((r) => r.id === record.id);
    let updated: PrintingRejectRecord[];
    if (existingIndex >= 0) {
      updated = [...printingRejects];
      updated[existingIndex] = record;
    } else {
      updated = [record, ...printingRejects];
    }
    setPrintingRejects(updated);
    saveStoredPrintingRejects(updated);
    savePrintingRejectCloud(record).catch(console.error);
  };

  const handleDeletePrintingReject = (rejectId: string) => {
    const updated = printingRejects.filter((r) => r.id !== rejectId);
    setPrintingRejects(updated);
    saveStoredPrintingRejects(updated);
    deletePrintingRejectCloud(rejectId).catch(console.error);
  };

  // Team SPK User Status Management State
  const [teamCategoryFilter, setTeamCategoryFilter] = useState<string>('ALL');
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');

  // Add User Form States (Developer Only)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUName, setNewUName] = useState('');
  const [newUUsername, setNewUUsername] = useState('');
  const [newUPassword, setNewUPassword] = useState('');
  const [newUPhone, setNewUPhone] = useState('');
  const [newURole, setNewURole] = useState<'DEVELOPER' | 'ADMIN' | 'KASIR' | 'SPK'>('SPK');
  const [newUSpkCategory, setNewUSpkCategory] = useState<SpkRoleCategory>('OPERATOR_CETAK');

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUName.trim() || !newUUsername.trim() || !newUPassword.trim()) {
      alert('Silakan lengkapi Nama, Username, dan Password!');
      return;
    }
    const cleanUsername = newUUsername.trim().toLowerCase();
    const cleanPhone = newUPhone.trim();

    if (teamUsers.some((u) => u.username.toLowerCase() === cleanUsername)) {
      alert('Username ini sudah terdaftar! Gunakan username lain.');
      return;
    }

    const passwordProblem = checkPasswordPolicy(cleanUsername, newUPassword.trim());
    if (passwordProblem) {
      alert(passwordProblem.message);
      return;
    }

    const newUserObj: AppUser = {
      id: `user_${Date.now()}`,
      name: newUName.trim(),
      username: cleanUsername,
      password: newUPassword.trim(),
      phone: cleanPhone,
      role: newURole,
      spkRoleCategory: newUSpkCategory,
      isActive: true,
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    };

    if (onSaveUser) {
      try {
        await onSaveUser(newUserObj);
      } catch (err: any) {
        alert(err?.message || 'Akun gagal disimpan ke database cloud. Coba lagi.');
        return;
      }
    } else {
      saveUserCloud(newUserObj).catch((err) => {
        alert(err?.message || 'Akun gagal disimpan ke database cloud. Coba lagi.');
      });
    }

    // Reset Form
    setNewUName('');
    setNewUUsername('');
    setNewUPassword('');
    setNewUPhone('');
    setNewURole('SPK');
    setNewUSpkCategory('OPERATOR_CETAK');
    setIsAddUserModalOpen(false);
  };

  const teamUsers = useMemo(() => {
    const rawList = users || [];
    const permanentDev = getPermanentDeveloperUser();
    const hasDev = rawList.some((u) => u.id === permanentDev.id || u.role === 'DEVELOPER');
    const combined = hasDev ? rawList : [permanentDev, ...rawList];

    return combined.map((u) => {
      let resolvedCategory: SpkRoleCategory = u.spkRoleCategory || 'OPERATOR_CETAK';
      if (!u.spkRoleCategory) {
        if (u.role === 'DEVELOPER' || u.role === 'OWNER') resolvedCategory = 'SUPERVISOR';
        else if (u.role === 'ADMIN' || u.role === 'KASIR') resolvedCategory = 'KASIR_ADMIN';
        else if (u.username.includes('desain') || u.name.toLowerCase().includes('desain')) resolvedCategory = 'DESAINER';
        else if (u.username.includes('finishing') || u.name.toLowerCase().includes('finishing')) resolvedCategory = 'FINISHING';
        else if (u.role === 'SPK' || u.username.includes('spk') || u.name.toLowerCase().includes('operator')) resolvedCategory = 'OPERATOR_CETAK';
      }
      return {
        ...u,
        spkRoleCategory: resolvedCategory
      };
    });
  }, [users]);

  const isUserOnline = useCallback((u: AppUser): boolean => {
    if (currentUser && currentUser.id === u.id) return true;
    if (u.isOnline === true) return true;
    if (u.lastActiveAt && (Date.now() - u.lastActiveAt) < 10 * 60 * 1000) return true;
    return false;
  }, [currentUser]);

  const formatUserPresence = useCallback((u: AppUser): { isOnline: boolean; statusText: string; timeText: string } => {
    const online = isUserOnline(u);
    if (currentUser && currentUser.id === u.id) {
      return { isOnline: true, statusText: 'Online (Perangkat Ini)', timeText: 'Sedang Aktif' };
    }
    if (online) {
      if (u.lastActiveAt) {
        const diffMins = Math.max(0, Math.floor((Date.now() - u.lastActiveAt) / 60000));
        const timeLabel = diffMins === 0 ? 'Baru saja' : `${diffMins}m lalu`;
        return { isOnline: true, statusText: 'Terhubung / Logged In', timeText: `Aktif ${timeLabel}` };
      }
      return { isOnline: true, statusText: 'Terhubung / Logged In', timeText: 'Sedang Aktif' };
    }
    if (u.lastActiveAt) {
      const dateStr = new Date(u.lastActiveAt).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      return { isOnline: false, statusText: 'Belum Login / Offline', timeText: `Terakhir aktif: ${dateStr}` };
    }
    if (u.lastLoginAt) {
      const dateStr = new Date(u.lastLoginAt).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      return { isOnline: false, statusText: 'Belum Login / Offline', timeText: `Terakhir login: ${dateStr}` };
    }
    return { isOnline: false, statusText: 'Belum Login / Offline', timeText: 'Belum login hari ini' };
  }, [currentUser, isUserOnline]);

  // Team SPK Live Metrics
  const onlineTeamUsersCount = useMemo(() => teamUsers.filter(isUserOnline).length, [teamUsers, isUserOnline]);

  const categoryOnlineCounts = useMemo(() => {
    const counts: Record<SpkRoleCategory, { total: number; online: number }> = {
      DESAINER: { total: 0, online: 0 },
      OPERATOR_CETAK: { total: 0, online: 0 },
      FINISHING: { total: 0, online: 0 },
      KASIR_ADMIN: { total: 0, online: 0 },
      SUPERVISOR: { total: 0, online: 0 }
    };
    teamUsers.forEach((u) => {
      const cat = u.spkRoleCategory || 'OPERATOR_CETAK';
      if (counts[cat]) {
        counts[cat].total += 1;
        if (isUserOnline(u)) {
          counts[cat].online += 1;
        }
      }
    });
    return counts;
  }, [teamUsers, isUserOnline]);

  // Handle re-assigning user SPK category position
  const handleChangeUserSpkCategory = (userId: string, newCat: SpkRoleCategory) => {
    const targetUser = teamUsers.find((u) => u.id === userId);
    if (!targetUser) return;
    const updatedUser: AppUser = {
      ...targetUser,
      spkRoleCategory: newCat
    };
    if (onSaveUser) {
      onSaveUser(updatedUser);
    }
    saveUserCloud(updatedUser).catch(console.error);
  };

  // Selected Order for Detail Modal
  const [selectedOrder, setSelectedOrder] = useState<SpkOrder | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [statusUpdateNote, setStatusUpdateNote] = useState('');

  // Form State for Creating New SPK
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerSearchDropdown, setShowCustomerSearchDropdown] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCategory, setNewCustomerCategory] = useState('UMUM');

  const selectedCustomerObj = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const filteredCustomersForSpk = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.slice(0, 10);
    const q = customerSearchQuery.toLowerCase().trim();
    return customers.filter(
      (c) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    );
  }, [customers, customerSearchQuery]);

  // Filter products for Order Cetak (Digital Printing, Laser Cutting, Paket)
  const spkProducts = useMemo(() => {
    return products.filter((p) => {
      const cat = (p.category || '').toLowerCase();
      return cat === 'digital_printing' || cat === 'laser_cutting' || cat === 'paket';
    });
  }, [products]);

  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const selectedProductObj = useMemo(() => {
    return spkProducts.find((p) => p.id === selectedProductId);
  }, [spkProducts, selectedProductId]);

  // Compute tariff based on customer category (UMUM, GROSIR, AGEN)
  const [saleMode, setSaleMode] = useState<'meter' | 'lembar'>('meter');

  const computePriceForSpkProduct = useCallback((prod: Product | undefined, categoryName: string, mode: 'meter' | 'lembar' = 'meter'): number => {
    if (!prod) return 0;
    const cat = (prod.category || '').toLowerCase();
    if (cat === 'paket') {
      return getPaketPrice(prod, categoryName);
    }
    return getPrintServicePrice(prod, categoryName, mode);
  }, []);

  // Multi-Product Form Items State
  const defaultItemFinishing = (): FormItemFinishing => ({
    laminasi: false,
    laminasiType: 'Laminasi Doff Dingin',
    laminasiPrice: 0,
    cutting: false,
    cuttingType: 'Kiss Cut Presisi (Pola)',
    cuttingPrice: 0,
    mataAyam: false,
    mataAyamQty: 4,
    mataAyamPrice: 0,
    lipatLem: false,
    lipatLemPrice: 0,
    selongsong: false,
    selongsongPrice: 0
  });

  const createDefaultFormItem = useCallback((index: number = 0) => ({
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${index}`,
    jobName: '',
    productId: '',
    materialName: '',
    saleMode: 'meter' as 'meter' | 'lembar',
    lengthMeters: 1,
    widthMeters: 1,
    qty: 1,
    unitPrice: 0,
    areaM2: 1,
    totalPrice: 0,
    designFileName: '',
    operatorNotes: '',
    finishings: defaultItemFinishing()
  }), []);

  const [orderItems, setOrderItems] = useState([createDefaultFormItem(0)]);
  const [newMachines, setNewMachines] = useState<string[]>([]);

  // Update finishing for specific product item
  const handleUpdateItemFinishing = (itemId: string, finishingUpdates: Partial<FormItemFinishing>) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          finishings: {
            ...item.finishings,
            ...finishingUpdates
          }
        };
      })
    );
  };

  // Update item field and auto-calculate area & subtotal
  const handleUpdateOrderItem = (id: string, updates: any) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };

        if (updates.productId !== undefined && updates.productId !== item.productId) {
          const prod = spkProducts.find((p) => p.id === updates.productId);
          if (prod) {
            updated.materialName = prod.name;
            updated.unitPrice = computePriceForSpkProduct(prod, newCustomerCategory, updated.saleMode);
          } else {
            updated.materialName = '';
            updated.unitPrice = 0;
          }
        }

        if (updates.saleMode !== undefined && updates.saleMode !== item.saleMode) {
          const prod = spkProducts.find((p) => p.id === updated.productId);
          if (prod) {
            updated.unitPrice = computePriceForSpkProduct(prod, newCustomerCategory, updates.saleMode);
          }
        }

        const length = Number(updated.lengthMeters) || 0;
        const width = Number(updated.widthMeters) || 0;
        const qty = Number(updated.qty) || 1;
        const unitPrice = Number(updated.unitPrice) || 0;

        if (updated.saleMode === 'lembar') {
          updated.areaM2 = qty;
          updated.totalPrice = Math.round(qty * unitPrice);
        } else {
          const totalArea = Math.round(length * width * qty * 100) / 100;
          updated.areaM2 = totalArea;
          updated.totalPrice = Math.round(totalArea * unitPrice);
        }

        return updated;
      })
    );
  };

  const handleAddOrderItem = () => {
    setOrderItems((prev) => [...prev, createDefaultFormItem(prev.length)]);
  };

  const handleRemoveOrderItem = (id: string) => {
    setOrderItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  // Sync unit prices across all items when customer category changes
  useEffect(() => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (!item.productId) return item;
        const prod = spkProducts.find((p) => p.id === item.productId);
        if (!prod) return item;
        const newPrice = computePriceForSpkProduct(prod, newCustomerCategory, item.saleMode);
        const length = Number(item.lengthMeters) || 0;
        const width = Number(item.widthMeters) || 0;
        const qty = Number(item.qty) || 1;

        let newArea = item.areaM2;
        let newTotal = 0;
        if (item.saleMode === 'lembar') {
          newArea = qty;
          newTotal = Math.round(qty * newPrice);
        } else {
          newArea = Math.round(length * width * qty * 100) / 100;
          newTotal = Math.round(newArea * newPrice);
        }
        return {
          ...item,
          unitPrice: newPrice,
          areaM2: newArea,
          totalPrice: newTotal
        };
      })
    );
  }, [newCustomerCategory, computePriceForSpkProduct, spkProducts]);

  // Machines Management State
  const [machines, setMachines] = useState<MachineItem[]>(() => getStoredMachines());
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<MachineItem | null>(null);
  const [mName, setMName] = useState('');
  const [mCategory, setMCategory] = useState<'CETAK' | 'CUTTING' | 'FINISHING' | 'OTHER'>('CETAK');
  const [mTypeDescription, setMTypeDescription] = useState('');
  const [mStatus, setMStatus] = useState<'READY' | 'UNDER_MAINTENANCE'>('READY');
  const [mSpeed, setMSpeed] = useState('');
  const [mHeadSpec, setMHeadSpec] = useState('');
  const [mOperator, setMOperator] = useState('');
  const [mNotes, setMNotes] = useState('');
  const [mIpAddress, setMIpAddress] = useState('');
  const [mPort, setMPort] = useState('9100');
  const [mHostName, setMHostName] = useState('');
  const [mSharedFolderLanPath, setMSharedFolderLanPath] = useState('');
  const [mRipSoftware, setMRipSoftware] = useState('');

  // LAN Network Hub Modal State (Accessible to DEVELOPER & SPK roles)
  const [isLanNetworkHubModalOpen, setIsLanNetworkHubModalOpen] = useState(false);
  const [lanHubInitialTab, setLanHubInitialTab] = useState<'files' | 'machines' | 'settings'>('files');
  const [isScanningLan, setIsScanningLan] = useState(false);

  // Sync machines across tabs and run LAN auto-detection
  useEffect(() => {
    const handleMachineSync = (e: any) => {
      if (e.detail) {
        setMachines(e.detail);
      } else {
        setMachines(getStoredMachines());
      }
    };
    window.addEventListener('bejo_machines_updated', handleMachineSync);

    // Initial background ping & auto-scan
    scanAllLanMachines(undefined, false).catch(() => {});

    // Periodic heartbeat every 45 seconds
    const interval = setInterval(() => {
      scanAllLanMachines(undefined, false).catch(() => {});
    }, 45000);

    const handleLanStatusUpdate = (e: any) => {
      if (e.detail?.machines) {
        setMachines(e.detail.machines);
      }
    };
    window.addEventListener('bejo_lan_machines_status_updated', handleLanStatusUpdate);

    return () => {
      window.removeEventListener('bejo_machines_updated', handleMachineSync);
      window.removeEventListener('bejo_lan_machines_status_updated', handleLanStatusUpdate);
      clearInterval(interval);
    };
  }, []);

  // Filter READY machines for SPK Selection (ENFORCE RULE: Only READY machines can be picked)
  const readyMachines = useMemo(() => {
    return machines.filter((m) => m.status === 'READY');
  }, [machines]);

  // Ensure any machines that transition to non-READY are removed from selection
  useEffect(() => {
    setNewMachines((prev) => {
      const valid = prev.filter((id) => readyMachines.some((m) => m.id === id));
      return valid.length === prev.length ? prev : valid;
    });
  }, [readyMachines]);

  const toggleMachineInForm = (machineId: string) => {
    const targetMch = machines.find((m) => m.id === machineId);
    if (targetMch && targetMch.status !== 'READY') {
      alert(`Mesin "${targetMch.name}" sedang dalam status UNDER MAINTENANCE dan tidak dapat digunakan untuk produksi.`);
      return;
    }
    setNewMachines((prev) => {
      if (prev.includes(machineId)) {
        return prev.filter((id) => id !== machineId);
      } else {
        return [...prev, machineId];
      }
    });
  };

  const handleOpenAddMachineModal = () => {
    setEditingMachine(null);
    setMName('');
    setMCategory('CETAK');
    setMTypeDescription('');
    setMStatus('READY');
    setMSpeed('');
    setMHeadSpec('');
    setMOperator('');
    setMNotes('');
    setMIpAddress(`192.168.1.${100 + machines.length + 1}`);
    setMPort('9100');
    setMHostName('');
    setMSharedFolderLanPath(`\\\\192.168.1.${100 + machines.length + 1}\\HOTFOLDER\\`);
    setMRipSoftware('');
    setIsMachineModalOpen(true);
  };

  const handleOpenEditMachineModal = (m: MachineItem) => {
    setEditingMachine(m);
    setMName(m.name);
    setMCategory(m.category);
    setMTypeDescription(m.typeDescription || '');
    setMStatus(m.status);
    setMSpeed(m.speed || '');
    setMHeadSpec(m.headSpec || '');
    setMOperator(m.operatorDefault || '');
    setMNotes(m.notes || '');
    setMIpAddress(m.ipAddress || '');
    setMPort(m.port ? String(m.port) : '9100');
    setMHostName(m.hostName || '');
    setMSharedFolderLanPath(m.sharedFolderLanPath || '');
    setMRipSoftware(m.ripSoftware || '');
    setIsMachineModalOpen(true);
  };

  const handleSaveMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mName.trim()) {
      alert('Mohon isi nama mesin.');
      return;
    }

    const newMch: MachineItem = {
      id: editingMachine ? editingMachine.id : `mch_${Date.now()}`,
      name: mName.trim(),
      category: mCategory,
      typeDescription: mTypeDescription.trim() || (mCategory === 'CETAK' ? 'Mesin Cetak Digital' : 'Mesin Cutting Presisi'),
      status: mStatus,
      speed: mSpeed.trim() || undefined,
      headSpec: mHeadSpec.trim() || undefined,
      operatorDefault: mOperator.trim() || undefined,
      notes: mNotes.trim() || undefined,
      ipAddress: mIpAddress.trim() || undefined,
      port: mPort.trim() ? Number(mPort) : 9100,
      hostName: mHostName.trim() || undefined,
      sharedFolderLanPath: mSharedFolderLanPath.trim() || undefined,
      ripSoftware: mRipSoftware.trim() || undefined,
      lanStatus: mStatus === 'UNDER_MAINTENANCE' ? 'STANDBY' : (editingMachine?.lanStatus || 'CHECKING'),
      pingLatencyMs: mStatus === 'UNDER_MAINTENANCE' ? 0 : editingMachine?.pingLatencyMs,
      createdAt: editingMachine ? editingMachine.createdAt : new Date().toISOString().split('T')[0]
    };

    const updated = editingMachine
      ? machines.map((m) => (m.id === editingMachine.id ? newMch : m))
      : [...machines, newMch];

    setMachines(updated);
    saveStoredMachines(updated);
    saveMachineCloud(newMch).catch(console.error);
    setIsMachineModalOpen(false);
    setEditingMachine(null);
  };

  const handleToggleMachineStatus = (machineId: string) => {
    const updated = machines.map((m) => {
      if (m.id === machineId) {
        const nextStatus: 'READY' | 'UNDER_MAINTENANCE' =
          m.status === 'READY' ? 'UNDER_MAINTENANCE' : 'READY';
        const target = { ...m, status: nextStatus };
        saveMachineCloud(target).catch(console.error);
        return target;
      }
      return m;
    });
    setMachines(updated);
    saveStoredMachines(updated);
  };

  const handleDeleteMachine = (machineId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus mesin ini dari sistem?')) return;
    const updated = machines.filter((m) => m.id !== machineId);
    setMachines(updated);
    saveStoredMachines(updated);
    deleteMachineCloud(machineId).catch(console.error);
  };
  const [newPriority, setNewPriority] = useState<SpkPriority>('NORMAL');
  const [newDeadlineDate, setNewDeadlineDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newDeadlineTime, setNewDeadlineTime] = useState<string>('17:00');
  const [newFileName, setNewFileName] = useState('');
  const [newOperatorNotes, setNewOperatorNotes] = useState('');
  const [newCustomerNotes, setNewCustomerNotes] = useState('');
  const [newDpPaid, setNewDpPaid] = useState<number>(0);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS' | 'UNPAID'>('UNPAID');

  // Local Print File Vault & Directory Configuration States (Supports Multiple Files)
  const [newPrintFiles, setNewPrintFiles] = useState<SpkPrintFileAttachment[]>([]);
  const newPrintFile = newPrintFiles[0] || null;
  const [newLocalDir, setNewLocalDir] = useState<string>(() => getSharedFolderConfig().path);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileToast, setFileToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isLanFolderModalOpen, setIsLanFolderModalOpen] = useState(false);
  const [tempLanDirInput, setTempLanDirInput] = useState<string>(() => getSharedFolderConfig().path);
  const [grantStatus, setGrantStatus] = useState<SharedFolderGrantStatus | null>(null);
  const [isSharedFolderBusy, setIsSharedFolderBusy] = useState(false);
  const lanDirectoryInputRef = useRef<HTMLInputElement>(null);

  const showFileToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFileToast({ message, type });
    setTimeout(() => setFileToast(null), 3500);
  };

  const handleOpenLanFolderModal = () => {
    setTempLanDirInput(newLocalDir);
    setIsLanFolderModalOpen(true);
  };

  const refreshGrantStatus = useCallback(async () => {
    setGrantStatus(await getSharedFolderGrantStatus());
  }, []);

  // Lokasi folder bersama adalah konfigurasi bersama antar perangkat: dibaca dari
  // cloud, localStorage hanyalah cache agar aplikasi tetap jalan saat cloud Offline.
  useEffect(() => {
    const stopCloudSync = startSharedFolderCloudSync();
    const syncFromConfig = () => {
      const path = getSharedFolderConfig().path;
      setNewLocalDir(path);
      setTempLanDirInput((prev) => prev || path);
      void refreshGrantStatus();
    };
    syncFromConfig();
    window.addEventListener('bejo_lan_folder_updated', syncFromConfig);
    return () => {
      stopCloudSync();
      window.removeEventListener('bejo_lan_folder_updated', syncFromConfig);
    };
  }, [refreshGrantStatus]);

  /**
   * Path display untuk catatan lampiran. Browser tidak pernah memberi tahu path
   * UNC dari folder yang dipilih, jadi urutannya: konfigurasi bersama -> nama
   * folder di perangkat ini -> hanya nama berkas (tidak mengarang drive).
   */
  const sharedFolderDisplayPath = useMemo(() => {
    if (newLocalDir) return newLocalDir;
    return grantStatus?.folderName ? `${grantStatus.folderName}/` : '';
  }, [newLocalDir, grantStatus]);

  const buildSharedFilePath = useCallback(
    (fileName?: string): string => {
      if (!fileName) return '';
      return sharedFolderDisplayPath ? formatLocalShortcutPath(sharedFolderDisplayPath, fileName) : fileName;
    },
    [sharedFolderDisplayPath]
  );

  /** Folder bersama adalah alat kerja sehari-hari, bukan fitur khusus developer. */
  const canUseLanHub = Boolean(currentUser) && currentUser?.role !== 'AGEN';

  /** DEVELOPER dan ADMIN boleh mengubah/menghapus order SPK yang tersimpan. */
  const canManageSpk = canManageRecords(currentUser?.role);

  /**
   * Lencana status folder pada form pesanan. Hanya boleh menyebut "tersambung"
   * bila izin baca-tulis benar-benar ada di perangkat ini.
   */
  const sharedFolderBadge = (() => {
    if (!grantStatus) {
      return { label: 'Memeriksa izin...', cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
    }
    if (!grantStatus.supported) {
      return { label: 'Browser Tidak Dukung', cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
    }
    if (!grantStatus.configuredPath) {
      return { label: 'Folder Belum Disetel', cls: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' };
    }
    if (grantStatus.granted && grantStatus.nameMatches) {
      return { label: 'Folder Siap Dipakai', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-600' };
    }
    if (grantStatus.granted) {
      return {
        label: `Folder Perangkat Ini: "${grantStatus.folderName}"`,
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
      };
    }
    return { label: 'Izin Perlu Dikonfirmasi', cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' };
  })();

  const handleBrowseLanFolder = async () => {
    if (!isSharedFolderApiSupported()) {
      if (lanDirectoryInputRef.current) lanDirectoryInputRef.current.click();
      return;
    }
    setIsSharedFolderBusy(true);
    try {
      const res = await pickSharedFolder();
      showFileToast(res.message, res.ok ? 'success' : 'error');
      await refreshGrantStatus();
    } finally {
      setIsSharedFolderBusy(false);
    }
  };

  const handleDirectoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Fallback browser tanpa File System Access API: dialog ini hanya bisa
    // membaca daftar isi folder, jadi nama folder saja yang dipakai sebagai
    // display dan tidak ada path palsu yang disimpan.
    const files = e.target.files;
    if (files && files.length > 0) {
      const relPath = (files[0] as any).webkitRelativePath || '';
      const rootFolder = relPath.split('/')[0] || files[0].name;
      setTempLanDirInput((prev) => prev || `${rootFolder}/`);
      showFileToast(
        `Folder "${rootFolder}" terbaca, tetapi browser ini tidak dapat memberi izin tulis. Gunakan Chrome/Edge di komputer tersebut lalu klik "Hubungkan Folder".`,
        'info'
      );
    }
    if (e.target) e.target.value = '';
  };

  const handleApplyLanFolder = async (customPath?: string) => {
    const target = normalizeFolderPath((customPath || tempLanDirInput || '').trim());
    if (!target) {
      alert('Mohon masukkan lokasi folder jaringan / lokal, contoh: \\\\SERVER-TOKO\\DATA_CETAK\\');
      return;
    }

    setIsSharedFolderBusy(true);
    try {
      const res = await saveSharedFolderConfig(target, currentUser?.name || 'Operator');
      const savedPath = normalizeFolderPath(res.path);
      setNewLocalDir(savedPath);
      setTempLanDirInput(savedPath);
      await refreshGrantStatus();
      setIsLanFolderModalOpen(false);
      if (res.cloudError) {
        showFileToast(`Folder disetel ke ${savedPath}, tetapi belum tersimpan ke cloud: ${res.cloudError}`, 'error');
      } else {
        showFileToast(`Folder bersama tersimpan untuk semua perangkat: ${savedPath}`, 'success');
      }
    } finally {
      setIsSharedFolderBusy(false);
    }
  };

  /**
   * Satu-satunya jalur lampiran berkas SPK: simpan salinan perangkat (IndexedDB)
   * DAN salin berkasnya ke folder bersama. Berkas hanya dianggap "ada di folder"
   * kalau penulisannya sudah diverifikasi dari folder tersebut.
   */
  const attachPrintFile = useCallback(
    async (
      file: File,
      orderNumber?: string
    ): Promise<{ attachment: SpkPrintFileAttachment; warning?: string }> => {
      const attachment = await saveLocalPrintFile(file, undefined, newLocalDir || undefined, currentUser?.name);
      const originalName = attachment.fileName;
      const copy = await copyFileToSharedFolder(file, originalName, orderNumber, true);

      if (copy.ok) {
        const shared = applySharedCopyToAttachment(
          { ...attachment, originalFileName: originalName },
          copy,
          newLocalDir,
          grantStatus?.folderName || ''
        );
        return {
          attachment: shared,
          warning: copy.renamed
            ? `Nama berkas diubah menjadi "${copy.fileName}" agar tidak menimpa berkas SPK lain di folder bersama.`
            : undefined
        };
      }

      return {
        attachment: {
          ...attachment,
          localPath: undefined,
          lanFolderUrl: undefined,
          sharedCopy: false,
          originalFileName: originalName
        },
        warning: `${copy.message} Berkas baru tersimpan di perangkat ini, belum di folder bersama.`
      };
    },
    [newLocalDir, currentUser?.name, grantStatus?.folderName]
  );

  /** Ulangi penyalinan berkas yang masih tertahan di vault perangkat. */
  const retryCopyNewFileToFolder = async (index: number) => {
    const target = newPrintFiles[index];
    if (!target) return;
    setIsSharedFolderBusy(true);
    try {
      const result = await copyVaultFileToSharedFolder(target);
      if (!result.ok) {
        showFileToast(result.message, 'error');
        return;
      }
      const updated = applySharedCopyToAttachment(target, result, newLocalDir, grantStatus?.folderName || '');
      setNewPrintFiles((prev) => prev.map((f, i) => (i === index ? updated : f)));
      setNewFileName(updated.fileName);
      showFileToast(result.message, 'success');
    } finally {
      setIsSharedFolderBusy(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingFile(true);
    try {
      const attachments: SpkPrintFileAttachment[] = [];
      const warnings: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const result = await attachPrintFile(files[i]);
        attachments.push(result.attachment);
        if (result.warning) warnings.push(result.warning);
      }
      setNewPrintFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.fileName.toLowerCase()));
        const toAdd = attachments.filter((f) => !existingNames.has(f.fileName.toLowerCase()));
        return [...prev, ...toAdd];
      });
      const first = attachments[0];
      setNewFileName(first ? first.fileName : '');
      if (warnings.length > 0) {
        showFileToast(warnings[0], warnings[0].startsWith('Nama berkas') ? 'info' : 'error');
      } else if (attachments.length === 1) {
        showFileToast(`File "${first.fileName}" ditambahkan dan tersalin ke folder bersama.`, 'success');
      } else {
        showFileToast(`${attachments.length} file tersalin ke folder bersama.`, 'success');
      }
    } catch (err) {
      console.error('Failed to attach file', err);
      showFileToast('Gagal memproses file lokal', 'error');
    } finally {
      setIsUploadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePrintFile = (index: number) => {
    setNewPrintFiles((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length === 0) {
        setNewFileName('');
      } else {
        setNewFileName(updated[0].fileName);
      }
      return updated;
    });
  };

  const handleClearAllPrintFiles = () => {
    setNewPrintFiles([]);
    setNewFileName('');
    showFileToast('Semua file cetak terlampir dibersihkan', 'info');
  };

  const handleCopyShortcut = async (path?: string) => {
    if (!path) return;
    const ok = await copyLocalShortcutToClipboard(path);
    if (ok) {
      showFileToast(`Shortcut path disalin ke clipboard: "${path}"`, 'success');
    } else {
      showFileToast('Gagal menyalin shortcut ke clipboard', 'error');
    }
  };

  const handleOpenFile = async (fileAttachment?: SpkPrintFileAttachment, fallbackName?: string, localPath?: string) => {
    if (fileAttachment) {
      // 1. File di folder bersama LAN: semua perangkat membuka berkas yang
      //    sama persis (yang dilampirkan desainer), bukan path local perangkat
      //    yang bikin operator "salah file". Bila folder belum disambungkan,
      //    langsung bawa ke modal folder LAN (bukan coba buka yang gagal).
      if (fileAttachment.sharedCopy) {
        if (!grantStatus?.granted || grantStatus?.needsPermission) {
          setIsLanNetworkHubModalOpen(true);
          showFileToast(
            `Berkas "${fileAttachment.fileName}" ada di folder bersama. Buka modal LAN, sambungkan folder di perangkat ini, lalu klik "Buka dari Folder LAN".`,
            'info'
          );
          return;
        }
        const fromFolder = await openFileFromSharedFolder(fileAttachment);
        if (fromFolder.ok) {
          showFileToast(fromFolder.message, 'info');
          return;
        }
        showFileToast(`${fromFolder.message} Beralih ke salinan perangkat ini.`, 'error');
      }
      // 2. Salinan lokal perangkat yang dulu mengunggah
      const ok = await openOrDownloadPrintFile(fileAttachment);
      if (ok) {
        showFileToast(`Membuka file cetak dari vault perangkat: ${fileAttachment.fileName}`, 'info');
      } else {
        if (fileAttachment.localPath) {
          await copyLocalShortcutToClipboard(fileAttachment.localPath);
          showFileToast(`Berkas tidak tersedia di perangkat ini. Path disalin: ${fileAttachment.localPath}`, 'info');
        } else {
          showFileToast('File tidak ditemukan di folder bersama maupun vault perangkat', 'error');
        }
      }
    } else if (localPath) {
      await copyLocalShortcutToClipboard(localPath);
      showFileToast(`Shortcut lokasi disalin: ${localPath}`, 'info');
    } else if (fallbackName) {
      const cleanDir = newLocalDir.endsWith('/') || newLocalDir.endsWith('\\') ? newLocalDir : `${newLocalDir}/`;
      const path = `${cleanDir}${fallbackName}`;
      await copyLocalShortcutToClipboard(path);
      showFileToast(`Shortcut lokasi disalin: ${path}`, 'info');
    }
  };

  const handleSaveDefaultDirectory = async (dir: string) => {
    const res = await saveSharedFolderConfig(dir, currentUser?.name || 'Operator');
    const savedPath = normalizeFolderPath(res.path);
    setNewLocalDir(savedPath);
    setTempLanDirInput(savedPath);
    await refreshGrantStatus();
    showFileToast(
      res.cloudError
        ? `Folder diubah ke ${savedPath}, tetapi belum tersimpan ke cloud: ${res.cloudError}`
        : `Folder bersama diubah ke ${savedPath} untuk semua perangkat.`,
      res.cloudError ? 'error' : 'success'
    );
  };

  /** Perbarui lampiran sebuah SPK yang sudah tersimpan (pakai jalur cloud yang sama). */
  const replaceOrderAttachments = useCallback(
    async (order: SpkOrder, printFiles: SpkPrintFileAttachment[], note: string): Promise<void> => {
      const primary = printFiles[0];
      const updatedItems = order.items.map((it, idx) =>
        idx === 0
          ? {
              ...it,
              printFile: primary,
              printFiles,
              printFileLocalPath: primary?.localPath,
              designFileName: primary?.fileName
            }
          : it
      );
      const updatedOrder: SpkOrder = {
        ...order,
        items: updatedItems,
        printFile: primary,
        printFiles,
        printFileShortcut: primary?.localPath,
        statusLogs: [
          ...order.statusLogs,
          {
            status: order.status,
            timestamp: Date.now(),
            formattedTime: new Date().toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            changedBy: currentUser?.name || 'Operator',
            note
          }
        ]
      };
      const updatedList = updateStoredSpkOrder(order.id, updatedOrder, currentUser?.name);
      setOrders(updatedList);
      setSelectedOrder(updatedOrder);
      await saveSpkOrderCloud(updatedOrder);
    },
    [currentUser?.name]
  );

  /**
   * Salin berkas SPK ke folder bersama. Dipakai untuk lampiran lama yang dulu
   * hanya dicatat path-nya tanpa pernah benar-benar disalin.
   */
  const handleCopyAttachmentToFolder = async (order: SpkOrder, attachment: SpkPrintFileAttachment) => {
    setIsSharedFolderBusy(true);
    try {
      const result = await copyVaultFileToSharedFolder(attachment, order.orderNumber);
      if (!result.ok) {
        showFileToast(result.message, 'error');
        return;
      }
      const updated = applySharedCopyToAttachment(
        attachment,
        result,
        newLocalDir,
        grantStatus?.folderName || ''
      );
      const nextFiles = (order.printFiles && order.printFiles.length > 0
        ? order.printFiles
        : order.printFile
        ? [order.printFile]
        : []
      ).map((f) => (f.id === attachment.id ? updated : f));
      await replaceOrderAttachments(order, nextFiles, `Salin ke folder bersama: ${updated.fileName}`);
      showFileToast(
        result.renamed
          ? `Tersalin sebagai "${updated.fileName}" (nama diberi imbuhan SPK agar tidak menimpa).`
          : `Berkas "${updated.fileName}" tersalin ke folder bersama.`,
        'success'
      );
    } finally {
      setIsSharedFolderBusy(false);
    }
  };

  /** Cek apakah berkas yang tercatat di SPK benar-benar ada di folder bersama. */
  const handleVerifyAttachment = async (attachment: SpkPrintFileAttachment) => {
    setIsSharedFolderBusy(true);
    try {
      const result = await verifySharedFolderFile(attachment);
      const type = result.state === 'ok' ? 'success' : result.state === 'no-access' ? 'info' : 'error';
      showFileToast(result.message, type);
    } finally {
      setIsSharedFolderBusy(false);
    }
  };

  const handleDetailModalAddPrintFiles = async (order: SpkOrder, filesList: FileList | File[]) => {
    if (!filesList || filesList.length === 0) return;
    setIsUploadingFile(true);
    try {
      const newAttachments: SpkPrintFileAttachment[] = [];
      const warnings: string[] = [];
      for (let i = 0; i < filesList.length; i++) {
        const result = await attachPrintFile(filesList[i], order.orderNumber);
        newAttachments.push(result.attachment);
        if (result.warning) warnings.push(result.warning);
      }
      if (warnings.length > 0) {
        showFileToast(warnings[0], warnings[0].startsWith('Nama berkas') ? 'info' : 'error');
      }

      const existingAttachments = order.printFiles || (order.printFile ? [order.printFile] : []);
      const existingNames = new Set(existingAttachments.map((f) => f.fileName.toLowerCase()));
      const filteredNew = newAttachments.filter((f) => !existingNames.has(f.fileName.toLowerCase()));
      const updatedPrintFiles = [...existingAttachments, ...filteredNew];
      const primaryAttachment = updatedPrintFiles[0];

      const updatedItems = order.items.map((it, idx) => {
        if (idx === 0) {
          return {
            ...it,
            printFile: primaryAttachment,
            printFiles: updatedPrintFiles,
            printFileLocalPath: primaryAttachment?.localPath,
            designFileName: primaryAttachment?.fileName
          };
        }
        return it;
      });

      const updatedOrder: SpkOrder = {
        ...order,
        items: updatedItems,
        printFile: primaryAttachment,
        printFiles: updatedPrintFiles,
        printFileShortcut: primaryAttachment?.localPath,
        statusLogs: [
          ...order.statusLogs,
          {
            status: order.status,
            timestamp: Date.now(),
            formattedTime: new Date().toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            changedBy: currentUser?.name || 'Operator',
            note: `Upload ${newAttachments.length} File Cetak Lokal Baru (${newAttachments.map((f) => f.fileName).join(', ')})`
          }
        ]
      };

      const updatedList = updateStoredSpkOrder(order.id, updatedOrder, currentUser?.name);
      setOrders(updatedList);
      saveSpkOrderCloud(updatedOrder).catch(console.error);
      setSelectedOrder(updatedOrder);
      showFileToast(`${newAttachments.length} File Cetak berhasil dihubungkan ke SPK #${order.orderNumber}!`, 'success');
    } catch (e) {
      console.error('Error updating print file in modal', e);
      showFileToast('Gagal mengunggah file cetak', 'error');
    } finally {
      setIsUploadingFile(false);
    }
  };

  /**
   * Memilih berkas dari folder bersama LAN (File System Access API Open File Picker)
   * lalu meng-attachkannya ke SPK. Dipakai desainer/operator yang "memilih data dari
   * folder LAN" untuk lampiran SPK. Berkas hasil pick memang berasal dari folder
   * bersama, sehingga setelah terlampir statusnya benar-benar "Ada di folder bersama"
   * dan user lain (operator printing) membukanya dari folder yang sama — tidak ada
   * lagi salah file dalam SPK.
   */
  const handlePickFilesFromLanFolder = async (order?: SpkOrder) => {
    if (grantStatus && (!grantStatus.granted || grantStatus.needsPermission)) {
      setIsLanNetworkHubModalOpen(true);
      showFileToast(
        'Folder LAN belum tersambung di perangkat ini. Buka modal Folder File Asli (LAN), sambungkan folder, lalu pilih file dari folder bersama.',
        'info'
      );
      return;
    }
    const res: SharedFolderPickResult = await pickSharedFolderFiles();
    if (!res.ok) {
      showFileToast(res.message, 'error');
      return;
    }
    if (res.files.length === 0) {
      showFileToast('Tidak ada berkas yang dipilih dari folder bersama.', 'info');
      return;
    }
    const files = res.files;
    if (order) {
      await handleDetailModalAddPrintFiles(order, files);
      return;
    }
    const attachments: SpkPrintFileAttachment[] = [];
    const warnings: string[] = [];
    for (const f of files) {
      const result = await attachPrintFile(f);
      attachments.push(result.attachment);
      if (result.warning) warnings.push(result.warning);
    }
    setNewPrintFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.fileName.toLowerCase()));
      const toAdd = attachments.filter((f) => f.fileName && !existingNames.has(f.fileName.toLowerCase()));
      return [...prev, ...toAdd];
    });
    const first = attachments[0];
    if (first) setNewFileName(first.fileName);
    if (warnings.length > 0) {
      showFileToast(warnings[0], warnings[0].startsWith('Nama berkas') ? 'info' : 'error');
    } else {
      showFileToast(`${attachments.length} file dipilih dari folder bersama dan tersimpan ke folder LAN.`, 'success');
    }
  };

  // Sync orders with local storage events & auto-cleanup trigger
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setOrders(e.detail);
      } else {
        setOrders(getStoredSpkOrders());
      }
    };

    const handleAutoCleaned = (e: any) => {
      if (e.detail && e.detail.count > 0) {
        showFileToast(`Pembersihan Otomatis: ${e.detail.count} SPK Arsip Selesai telah dihapus (Jadwal 19.00 WIB)`, 'info');
        setOrders(getStoredSpkOrders());
      }
    };

    window.addEventListener('bejo_spk_orders_updated', handleSync);
    window.addEventListener('bejo_spk_archive_auto_cleaned', handleAutoCleaned);
    window.addEventListener('bejo_spk_archive_manual_cleaned', handleSync);

    // Initial check on mount + 30s interval
    checkAndRunSpkAutoCleanup();
    const interval = setInterval(() => {
      checkAndRunSpkAutoCleanup();
    }, 30000);

    return () => {
      window.removeEventListener('bejo_spk_orders_updated', handleSync);
      window.removeEventListener('bejo_spk_archive_auto_cleaned', handleAutoCleaned);
      window.removeEventListener('bejo_spk_archive_manual_cleaned', handleSync);
      clearInterval(interval);
    };
  }, []);

  // Manual Purge of Completed/Archived SPK by Developer
  const handleManualPurgeArchive = async () => {
    const completedList = orders.filter((o) => o.status === 'SELESAI_LUNAS');
    if (completedList.length === 0) {
      alert('Tidak ada SPK berstatus SELESAI (ARSIP) dalam list.');
      return;
    }

    if (
      !confirm(
        `PERINGATAN DEVELOPER:\n\nApakah Anda yakin ingin menghapus seluruh ${completedList.length} SPK berstatus SELESAI (ARSIP) dari database & list?\n\nTindakan ini permanen. SPK yang masih dalam proses produksi tidak akan terpengaruh.`
      )
    ) {
      return;
    }

    const res = await cleanupCompletedSpkManual(currentUser?.name || 'Developer');
    if (res.success) {
      setOrders(getStoredSpkOrders());
      showFileToast(`Berhasil membersihkan ${res.count} SPK berstatus Selesai (Arsip) dari sistem!`, 'success');
    } else {
      alert('Gagal menghapus arsip SPK.');
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerPhone && o.customerPhone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        o.items.some(
          (it) =>
            it.jobName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            it.materialName.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchStatus = selectedStatusFilter === 'ALL' || o.status === selectedStatusFilter;
      const matchMachine = selectedMachineFilter === 'ALL' || o.assignedMachine === selectedMachineFilter;
      const matchPriority = selectedPriorityFilter === 'ALL' || o.priority === selectedPriorityFilter;

      return matchSearch && matchStatus && matchMachine && matchPriority;
    });
  }, [orders, searchQuery, selectedStatusFilter, selectedMachineFilter, selectedPriorityFilter]);

  // Status Metrics
  const metrics = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'SELESAI_LUNAS' && o.status !== 'DIBATALKAN').length;
    const setting = orders.filter((o) => o.status === 'MENUNGGU_SETTING' || o.status === 'SETTING_SELESAI').length;
    const printing = orders.filter((o) => o.status === 'SEDANG_CETAK').length;
    const finishing = orders.filter((o) => o.status === 'FINISHING').length;
    const ready = orders.filter((o) => o.status === 'SIAP_AMBIL').length;
    const openAccount = orders.filter((o) => o.status === 'OPEN_ACCOUNT').length;
    const completed = orders.filter((o) => o.status === 'SELESAI_LUNAS').length;
    return { active, setting, printing, finishing, ready, openAccount, completed };
  }, [orders]);

  // Open Account Consolidated Groups per Customer ID
  const openAccountOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'OPEN_ACCOUNT');
  }, [filteredOrders]);

  const openAccountGroups = useMemo(() => {
    return groupOpenAccountOrders(openAccountOrders);
  }, [openAccountOrders]);

  // Form Calculations (Multi-product totals)
  const calculatedTotalItems = useMemo(() => {
    let totalArea = 0;
    let totalQty = 0;
    let totalPrice = 0;

    orderItems.forEach((it) => {
      totalArea += it.areaM2 || 0;
      totalQty += Number(it.qty) || 0;
      totalPrice += it.totalPrice || 0;
    });

    return {
      totalArea: Math.round(totalArea * 100) / 100,
      totalQty,
      totalPrice: Math.round(totalPrice)
    };
  }, [orderItems]);

  const calculatedTotalSpk = calculatedTotalItems.totalPrice;

  // Handle Form Submit
  const handleCreateSpk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      alert('Mohon lengkapi Nama Pelanggan.');
      return;
    }

    // Check that every item in orderItems has a product selected
    const unselectedIdx = orderItems.findIndex((it) => !it.productId);
    if (unselectedIdx !== -1) {
      alert(`Mohon pilih jenis Order Cetak (Katalog Produk) pada Item #${unselectedIdx + 1}.`);
      return;
    }

    if (newMachines.length === 0) {
      alert('Wajib memilih minimal 1 target mesin produksi (status READY) sebelum menerbitkan SPK.');
      return;
    }

    if (newDpPaid < 0) {
      alert('Nominal DP tidak boleh negatif.');
      return;
    }

    if (newDpPaid > calculatedTotalSpk) {
      alert(
        `Nominal DP (${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(newDpPaid)}) tidak boleh melebihi total tagihan SPK (${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(calculatedTotalSpk)}).`
      );
      return;
    }

    const nonReadySelected = newMachines
      .map((id) => machines.find((m) => m.id === id))
      .filter((m) => m && m.status !== 'READY');

    if (nonReadySelected.length > 0) {
      alert(`Mesin berikut sedang tidak READY (Under Maintenance): ${nonReadySelected.map((m) => m?.name).join(', ')}. Silakan pilih mesin yang berstatus READY.`);
      return;
    }

    const spkNumber = generateSpkOrderNumber();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    // Hanya lampirkan file yang benar-benar dilampirkan & tersalin ke folder
    // bersama. JANGAN pakai `newFileName` (nama kosong) sebagai "shortcut"
    // palsu ke folder bersama: operator akan baca berkas di SPK yang tidak
    // ada di folder (salah file).
    const resolvedPrintFiles: SpkPrintFileAttachment[] = [...newPrintFiles];

    const finalPrintFiles = resolvedPrintFiles.map((pf) => ({
      ...pf,
      // localPath asli (UNC/berbagi antar perangkat) yang sudah ditulis ke
      // folder. Jangan re-konstruksi dari nama berkas saja.
      localPath: pf.localPath,
      sharedCopy: Boolean(pf.sharedCopy),
    }));
    const primaryPrintFile = finalPrintFiles[0] || undefined;
    const computedLocalPath = primaryPrintFile?.localPath;
    const resolvedFileName = primaryPrintFile?.fileName || newFileName.trim() || undefined;

    const primaryMachine = (newMachines[0] || 'OUTDOOR_KONICA') as MachineType;
    const allSelectedMachines = newMachines.length > 0 ? newMachines : [primaryMachine];

    const convertedItems: SpkDigitalPrintItem[] = orderItems.map((it, idx) => {
      const itemJobName = it.jobName.trim() || it.materialName || `Item Cetak ${idx + 1}`;
      const matchingFile = finalPrintFiles[idx] || primaryPrintFile;
      const itemDesignFile = it.designFileName?.trim() || matchingFile?.fileName;
      const itemLocalPath = matchingFile?.localPath || (itemDesignFile ? buildSharedFilePath(itemDesignFile) : undefined);
      const itemPrintFile = matchingFile || (itemDesignFile ? {
        id: `file_${Date.now()}_${idx}`,
        fileName: itemDesignFile,
        localPath: itemLocalPath,
        uploadedAt: Date.now(),
        uploadedBy: currentUser?.name || 'Operator'
      } : undefined);

      // Extract and format finishing options specific to this item
      const itemFinishingsList: SpkFinishingItem[] = [];
      if (it.finishings?.mataAyam) {
        itemFinishingsList.push({
          id: `fin_ma_${Date.now()}_${idx}`,
          name: `Mata Ayam (${it.finishings.mataAyamQty || 4} Titik)`,
          type: 'mata_ayam',
          price: it.finishings.mataAyamPrice || 0,
          qty: it.finishings.mataAyamQty || 4
        });
      }
      if (it.finishings?.lipatLem) {
        itemFinishingsList.push({
          id: `fin_lipat_${Date.now()}_${idx}`,
          name: 'Lipat Lem Keliling',
          type: 'lipat_lem',
          price: it.finishings.lipatLemPrice || 0
        });
      }
      if (it.finishings?.laminasi) {
        itemFinishingsList.push({
          id: `fin_lam_${Date.now()}_${idx}`,
          name: it.finishings.laminasiType || 'Laminasi Doff Dingin',
          type: 'laminasi',
          price: it.finishings.laminasiPrice || 0
        });
      }
      if (it.finishings?.cutting) {
        itemFinishingsList.push({
          id: `fin_cut_${Date.now()}_${idx}`,
          name: it.finishings.cuttingType || 'Kiss Cut Presisi (Pola)',
          type: 'cutting',
          price: it.finishings.cuttingPrice || 0
        });
      }
      if (it.finishings?.selongsong) {
        itemFinishingsList.push({
          id: `fin_sel_${Date.now()}_${idx}`,
          name: 'Selongsong Atas Bawah',
          type: 'selongsong',
          price: it.finishings.selongsongPrice || 0
        });
      }

      return {
        id: `item_${Date.now()}_${idx}`,
        jobName: itemJobName,
        saleMode: it.saleMode,
        materialId: it.productId || undefined,
        materialName: it.materialName || 'Cetak Digital',
        lengthMeters: it.saleMode === 'meter' ? (Number(it.lengthMeters) || 1) : 0,
        widthMeters: it.saleMode === 'meter' ? (Number(it.widthMeters) || 1) : 0,
        qty: Number(it.qty) || 1,
        areaM2: it.areaM2,
        unitPrice: Number(it.unitPrice) || 0,
        materialPriceTotal: it.totalPrice,
        finishings: itemFinishingsList,
        finishingPriceTotal: 0,
        totalPrice: it.totalPrice,
        printMachine: primaryMachine,
        printMachines: allSelectedMachines,
        colorProfile: 'CMYK',
        designFileName: itemDesignFile,
        operatorNotes: it.operatorNotes?.trim() || (idx === 0 ? newOperatorNotes.trim() || undefined : undefined),
        printFile: itemPrintFile,
        printFiles: finalPrintFiles.length > 0 ? finalPrintFiles : itemPrintFile ? [itemPrintFile] : undefined,
        printFileLocalPath: itemLocalPath
      };
    });

    const newOrder: SpkOrder = {
      id: spkNumber,
      orderNumber: spkNumber,
      date: dateStr,
      time: timeStr,
      timestamp: Date.now(),
      deadlineDate: newDeadlineDate,
      deadlineTime: newDeadlineTime,
      priority: newPriority,
      status: 'MENUNGGU_SETTING',
      customerId: selectedCustomerId || undefined,
      customerName: newCustomerName.trim(),
      customerPhone: newCustomerPhone.trim() || undefined,
      customerCategory: newCustomerCategory,
      items: convertedItems,
      totalQty: calculatedTotalItems.totalQty,
      totalAreaM2: calculatedTotalItems.totalArea,
      subtotal: calculatedTotalItems.totalPrice,
      discount: 0,
      totalAmount: calculatedTotalItems.totalPrice,
      dpPaid: Number(newDpPaid) || 0,
      remainingAmount: Math.max(0, calculatedTotalItems.totalPrice - (Number(newDpPaid) || 0)),
      isPaid: (Number(newDpPaid) || 0) >= calculatedTotalItems.totalPrice && calculatedTotalItems.totalPrice > 0,
      paymentMethod: (Number(newDpPaid) || 0) > 0 ? newPaymentMethod : 'UNPAID',
      designerName: 'Andi (Prepress)',
      assignedMachine: primaryMachine,
      assignedMachines: allSelectedMachines,
      customerNotes: newCustomerNotes.trim() || undefined,
      printFile: primaryPrintFile,
      printFiles: finalPrintFiles.length > 0 ? finalPrintFiles : undefined,
      printFileShortcut: computedLocalPath,
      statusLogs: [
        {
          status: 'MENUNGGU_SETTING',
          timestamp: Date.now(),
          formattedTime: now.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          changedBy: currentUser?.name || 'Developer',
          note: `Input SPK baru (${convertedItems.length} Produk: ${convertedItems.map((c) => `${c.jobName} - ${c.materialName}`).join(' | ')})${finalPrintFiles.length > 0 ? ` • ${finalPrintFiles.length} File: ${finalPrintFiles.map((f) => f.fileName).join(', ')}` : resolvedFileName ? ` • File: ${resolvedFileName}` : ''}`
        }
      ]
    };

    const updated = addStoredSpkOrder(newOrder);
    setOrders(updated);
    saveSpkOrderCloud(newOrder).catch(console.error);

    // Auto-save Customer to Daftar Pelanggan & Cloud PocketBase Real-time
    const cleanName = newCustomerName.trim();
    const cleanPhone = newCustomerPhone.trim() || `08${Date.now().toString().slice(-8)}`;

    const existingCust = customers.find(
      (c) =>
        (newCustomerPhone.trim() && c.phone === newCustomerPhone.trim()) ||
        c.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (cleanName && onSaveCustomer) {
      const matchedCat = categories?.find(
        (cat) => cat.name.toLowerCase() === newCustomerCategory.toLowerCase()
      );
      const custToSave: Customer = {
        id: existingCust ? existingCust.id : cleanPhone,
        phone: existingCust ? existingCust.phone : cleanPhone,
        name: cleanName,
        categoryId: matchedCat?.id || existingCust?.categoryId || 'cat_umum',
        createdAt: existingCust ? existingCust.createdAt : new Date().toISOString().split('T')[0]
      };
      onSaveCustomer(custToSave);
    }

    // Reset Form (Default finishing options unchecked, multi-product reset & default machines)
    setSelectedCustomerId('');
    setCustomerSearchQuery('');
    setShowCustomerSearchDropdown(false);
    setOrderItems([createDefaultFormItem(0)]);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerCategory('UMUM');
    setNewPrintFiles([]);
    setNewFileName('');
    setNewOperatorNotes('');
    setNewCustomerNotes('');
    setNewDpPaid(0);
    setNewMachines([]);
    setActiveTab('kanban');
    setSelectedOrder(newOrder);
    setIsDetailModalOpen(true);
  };

  // Status Change Handler
  const handleUpdateStatus = (orderId: string, targetStatus: SpkStatus) => {
    const updated = updateStoredSpkOrder(
      orderId,
      {
        status: targetStatus,
        internalNotes: statusUpdateNote || `Status diubah ke ${getStatusLabel(targetStatus)}`
      },
      currentUser?.name || 'Developer'
    );
    setOrders(updated);
    const refreshed = updated.find((o) => o.id === orderId);
    if (refreshed) {
      saveSpkOrderCloud(refreshed).catch(console.error);
    }
    if (selectedOrder && selectedOrder.id === orderId) {
      if (refreshed) setSelectedOrder(refreshed);
    }
    setStatusUpdateNote('');
  };

  // Delete SPK Handler (Developer & Admin)
  const handleDeleteSpk = (orderId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus SPK ini dari sistem secara permanen?')) return;
    const updated = deleteStoredSpkOrder(orderId);
    setOrders(updated);
    deleteSpkOrderCloud(orderId).catch(console.error);
    if (selectedOrder && selectedOrder.id === orderId) {
      setIsDetailModalOpen(false);
      setSelectedOrder(null);
    }
  };

  // Status Badge Colors & Labels - Clean, High-Contrast Palette
  const getStatusBadge = (status: SpkStatus) => {
    switch (status) {
      case 'MENUNGGU_SETTING':
        return {
          label: '1. Menunggu Setting',
          bg: 'bg-amber-100 text-amber-950 border-amber-300 font-bold',
          dot: 'bg-amber-600',
          columnBg: 'bg-amber-50/70 border-amber-200'
        };
      case 'SETTING_SELESAI':
        return {
          label: '2. Setting Siap Cetak',
          bg: 'bg-blue-100 text-blue-950 border-blue-300 font-bold',
          dot: 'bg-blue-600',
          columnBg: 'bg-blue-50/70 border-blue-200'
        };
      case 'SEDANG_CETAK':
        return {
          label: '3. Sedang Cetak Mesin',
          bg: 'bg-indigo-100 text-indigo-950 border-indigo-300 font-bold',
          dot: 'bg-indigo-600 animate-pulse',
          columnBg: 'bg-indigo-50/70 border-indigo-200'
        };
      case 'FINISHING':
        return {
          label: '4. Proses Finishing',
          bg: 'bg-purple-100 text-purple-950 border-purple-300 font-bold',
          dot: 'bg-purple-600',
          columnBg: 'bg-purple-50/70 border-purple-200'
        };
      case 'SIAP_AMBIL':
        return {
          label: '5. Siap Ambil / Bayar',
          bg: 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold',
          dot: 'bg-emerald-600',
          columnBg: 'bg-emerald-50/70 border-emerald-200'
        };
      case 'OPEN_ACCOUNT':
        return {
          label: '6. Open Account (Rekening Terbuka)',
          bg: 'bg-amber-100 text-amber-950 border-amber-400 font-bold',
          dot: 'bg-amber-500 animate-pulse',
          columnBg: 'bg-amber-50/80 border-amber-400'
        };
      case 'SELESAI_LUNAS':
        return {
          label: '7. Selesai (Arsip)',
          bg: 'bg-slate-200 text-slate-900 border-slate-300 font-bold',
          dot: 'bg-slate-600',
          columnBg: 'bg-slate-100 border-slate-200'
        };
      case 'DIBATALKAN':
        return {
          label: 'Dibatalkan',
          bg: 'bg-red-100 text-red-950 border-red-300 font-bold',
          dot: 'bg-red-600',
          columnBg: 'bg-red-50/60 border-red-200'
        };
      default:
        return {
          label: status,
          bg: 'bg-slate-100 text-slate-900 border-slate-200 font-bold',
          dot: 'bg-slate-500',
          columnBg: 'bg-slate-50 border-slate-200'
        };
    }
  };

  const getStatusLabel = (status: SpkStatus) => getStatusBadge(status).label;

  const getMachineName = (machineIdOrType?: string): string => {
    if (!machineIdOrType) return 'Mesin Cetak Standar Toko';
    const found = machines.find((m) => m.id === machineIdOrType || m.name === machineIdOrType);
    if (found) return found.name;
    switch (machineIdOrType) {
      case 'OUTDOOR_KONICA':
        return 'Mesin Outdoor Konica 512i (3.2m)';
      case 'INDOOR_ROLAND':
        return 'Mesin Indoor Roland Eco-Solvent (1.6m)';
      case 'UV_FLATBED':
        return 'Mesin UV Flatbed & Roll (High-End)';
      case 'DTF_TEXTILE':
        return 'Mesin DTF Sablon Kaos & Kain';
      case 'LASER_ACRYLIC':
        return 'Mesin Laser Cutting Akrilik';
      case 'PLOTTER_CUTTING':
        return 'Mesin Plotter Cutting Stiker (Graphtec)';
      case 'DIGITAL_A3_PLUS':
        return 'Mesin Digital Press A3+ (Konica Minolta)';
      default:
        return machineIdOrType;
    }
  };

  const getMachineItemObj = (machineIdOrType?: string): MachineItem | undefined => {
    if (!machineIdOrType) return undefined;
    return machines.find((m) => m.id === machineIdOrType || m.name === machineIdOrType);
  };

  const getOrderMachinesList = (order?: SpkOrder | null): string[] => {
    if (!order) return [];
    if (order.assignedMachines && Array.isArray(order.assignedMachines) && order.assignedMachines.length > 0) {
      return order.assignedMachines;
    }
    const itemMachines: string[] = [];
    (order.items || []).forEach((it: any) => {
      if (it.printMachines && Array.isArray(it.printMachines)) {
        itemMachines.push(...it.printMachines);
      } else if (it.printMachine) {
        itemMachines.push(it.printMachine);
      }
    });
    if (itemMachines.length > 0) {
      return Array.from(new Set(itemMachines));
    }
    if (order.assignedMachine) {
      return [order.assignedMachine];
    }
    return [];
  };

  // Print Thermal SPK Work Order Sheet (80mm 1-Sheet)
  const handlePrintSpkSheet = (order: SpkOrder) => {
    const printEl = document.getElementById(`thermal-spk-sheet-${order.id}`);
    if (printEl) {
      printThermalElement(printEl, { paperSize: '80mm' });
    }
  };

  // 1-Klik Integrasi Tarik ke POS Kasir (Tahap 2)
  const handleSendSpkToPos = (order: SpkOrder) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_load_spk_to_pos', { detail: order }));
    }
    if (onNavigateToPos) {
      onNavigateToPos(order);
    }
  };

  // 1-Klik Integrasi Tarik Open Account ke POS Kasir
  const handleSendOpenAccountGroupToPos = (group: OpenAccountCustomerGroup) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_load_open_account_to_pos', { detail: group }));
    }
    if (onNavigateToPos) {
      onNavigateToPos(group);
    }
  };

  // 1-Klik Integrasi Buat Invoice Baru dari Open Account
  const handleCreateInvoiceFromOpenAccount = (group: OpenAccountCustomerGroup) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bejo_create_invoice_from_open_account', { detail: group }));
    }
    if (onNavigateToInvoice) {
      onNavigateToInvoice(group);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Banner - Matching Master Theme & High Contrast Readability */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-md relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600/30 text-indigo-300 text-[10.5px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/40 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                TAHAP 1 • DEVELOPER PREVIEW
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10.5px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                Sistem Cetak Digital Terpadu
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Printer className="w-6 h-6 text-indigo-400" />
              SPK & ALUR KERJA CETAK DIGITAL
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Monitoring alur kerja produksi: <strong className="text-white font-bold">1. File Masuk / Setting ➔ 2. Antrean Mesin ➔ 3. Finishing ➔ 4. Siap Ambil / Bayar di Kasir</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Folder bersama & mesin LAN: bisa diakses semua peran kerja, tidak lagi khusus developer */}
            {canUseLanHub && (
              <>
                {/* Button: Folder Berkas Asli (LAN) */}
                <button
                  type="button"
                  onClick={() => {
                    setLanHubInitialTab('files');
                    setIsLanNetworkHubModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xs"
                  title="Akses folder penyimpanan berkas asli SPK di jaringan LAN toko"
                >
                  <FolderOpen className="w-4 h-4 text-indigo-400" />
                  <span>Folder File Asli (LAN)</span>
                </button>

                {/* Button: Deteksi Mesin Online di LAN */}
                <button
                  type="button"
                  onClick={() => {
                    setLanHubInitialTab('machines');
                    setIsLanNetworkHubModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xs"
                  title="Deteksi mesin cetak & cutting yang online di jaringan LAN"
                >
                  <span className={`w-2 h-2 rounded-full ${machines.some((m) => m.lanStatus === 'ONLINE') ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span>Mesin LAN ({machines.filter((m) => m.lanStatus === 'ONLINE').length}/{machines.length})</span>
                </button>
              </>
            )}

            {currentUser?.role === 'DEVELOPER' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('team_status')}
                  className="px-3.5 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  title="Cek keaktifan tim SPK di tiap posisi"
                >
                  <Users className="w-4 h-4 text-indigo-300" />
                  <span>Tim SPK ({onlineTeamUsersCount}/{teamUsers.length})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Buat SPK Cetak Baru</span>
            </button>
          </div>
        </div>

        {/* Live Team Status Banner Bar */}
        {currentUser?.role === 'DEVELOPER' && (
          <div className="pt-3.5 mt-4 border-t border-slate-800 flex items-center justify-between gap-3 text-xs overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
              <span className="text-slate-400 font-bold uppercase flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Status Posisi Tim:
              </span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto text-[11px] font-bold">
              <span className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                categoryOnlineCounts.DESAINER.online > 0 ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span>🎨 Desainer:</span>
                <span className="font-mono">{categoryOnlineCounts.DESAINER.online}/{categoryOnlineCounts.DESAINER.total}</span>
              </span>

              <span className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                categoryOnlineCounts.OPERATOR_CETAK.online > 0 ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span>🖨️ Operator:</span>
                <span className="font-mono">{categoryOnlineCounts.OPERATOR_CETAK.online}/{categoryOnlineCounts.OPERATOR_CETAK.total}</span>
              </span>

              <span className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                categoryOnlineCounts.FINISHING.online > 0 ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span>✂️ Finishing:</span>
                <span className="font-mono">{categoryOnlineCounts.FINISHING.online}/{categoryOnlineCounts.FINISHING.total}</span>
              </span>

              <span className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                categoryOnlineCounts.KASIR_ADMIN.online > 0 ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span>💰 Kasir/Admin:</span>
                <span className="font-mono">{categoryOnlineCounts.KASIR_ADMIN.online}/{categoryOnlineCounts.KASIR_ADMIN.total}</span>
              </span>

              <span className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                categoryOnlineCounts.SUPERVISOR.online > 0 ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span>🛡️ Supervisor:</span>
                <span className="font-mono">{categoryOnlineCounts.SUPERVISOR.online}/{categoryOnlineCounts.SUPERVISOR.total}</span>
              </span>
            </div>
          </div>
        )}

        {/* Quick Metrics Bar - Clean, Professional Dark Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4 mt-4 border-t border-slate-800">
          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
            <div className="text-[10.5px] text-slate-400 font-semibold uppercase tracking-wider">Total SPK Aktif</div>
            <div className="text-lg font-bold text-white mt-0.5">
              {metrics.active} <span className="text-xs font-normal text-slate-400">Order</span>
            </div>
          </div>
          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
            <div className="text-[10.5px] text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              1. Setting File
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {metrics.setting} <span className="text-xs font-normal text-slate-400">SPK</span>
            </div>
          </div>
          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
            <div className="text-[10.5px] text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              2. Sedang Cetak
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {metrics.printing} <span className="text-xs font-normal text-slate-400">Mesin</span>
            </div>
          </div>
          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
            <div className="text-[10.5px] text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              3. Finishing
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {metrics.finishing} <span className="text-xs font-normal text-slate-400">SPK</span>
            </div>
          </div>
          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
            <div className="text-[10.5px] text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              4. Siap Ambil
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {metrics.ready} <span className="text-xs font-normal text-slate-400">Rak POS</span>
            </div>
          </div>
          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
            <div className="text-[10.5px] text-slate-400 font-semibold uppercase tracking-wider">5. Selesai Lunas</div>
            <div className="text-lg font-bold text-slate-300 mt-0.5">
              {metrics.completed} <span className="text-xs font-normal text-slate-400">Order</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigation & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Sub Navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-xs font-bold -mx-1 px-1">
            <button
              type="button"
              onClick={() => setActiveTab('kanban')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                activeTab === 'kanban'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Pipeline Alur Kerja</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Daftar SPK ({filteredOrders.length})</span>
            </button>

            {/* Antrean Mesin Cetak - DEVELOPER ONLY */}
            {currentUser?.role === 'DEVELOPER' && (
              <button
                type="button"
                onClick={() => setActiveTab('machines')}
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                  activeTab === 'machines'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Antrean Mesin Cetak</span>
              </button>
            )}

            {currentUser?.role === 'DEVELOPER' && (
              <button
                type="button"
                onClick={() => setActiveTab('team_status')}
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                  activeTab === 'team_status'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Status Tim & User SPK</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('reject_log')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                activeTab === 'reject_log'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/80'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${activeTab === 'reject_log' ? 'text-white' : 'text-rose-600'}`} />
              <span>Printing Reject</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. SPK, Pelanggan, atau Bahan..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </div>

        {/* Filter Controls for List & Kanban */}
        {(activeTab === 'kanban' || activeTab === 'list') && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 text-[11px] font-bold uppercase mr-1">
              <Filter className="w-3 h-3 text-slate-500" />
              Filter Data:
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">Semua Status Tahapan</option>
              <option value="MENUNGGU_SETTING">1. Menunggu Setting</option>
              <option value="SETTING_SELESAI">2. Setting Selesai</option>
              <option value="SEDANG_CETAK">3. Sedang Cetak Mesin</option>
              <option value="FINISHING">4. Proses Finishing</option>
              <option value="SIAP_AMBIL">5. Siap Ambil / Bayar</option>
              <option value="SELESAI_LUNAS">6. Selesai Lunas</option>
            </select>

            {/* Machine Filter */}
            <select
              value={selectedMachineFilter}
              onChange={(e) => setSelectedMachineFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">Semua Mesin Cetak</option>
              <option value="OUTDOOR_KONICA">Outdoor Konica 512i</option>
              <option value="INDOOR_ROLAND">Indoor Roland Eco-Solvent</option>
              <option value="UV_FLATBED">UV Flatbed & Roll</option>
              <option value="DTF_TEXTILE">DTF Sablon Kaos</option>
              <option value="LASER_ACRYLIC">Laser Cutting Akrilik</option>
              <option value="PLOTTER_CUTTING">Plotter Cutting Stiker</option>
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">Semua Prioritas</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">🔥 Urgent / Ditunggu</option>
            </select>

            {(selectedStatusFilter !== 'ALL' || selectedMachineFilter !== 'ALL' || selectedPriorityFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStatusFilter('ALL');
                  setSelectedMachineFilter('ALL');
                  setSelectedPriorityFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold underline cursor-pointer ml-auto"
              >
                Reset Filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* VIEW 1: KANBAN BOARD ALUR KERJA - High Contrast & Crisp Card Layout */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start">
          {/* Column 1: Penerimaan & Menunggu Setting */}
          <div className="bg-amber-50/60 rounded-2xl border border-amber-300 p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h3 className="text-xs font-black text-amber-950 uppercase tracking-tight">1. File Masuk / Setting</h3>
              </div>
              <span className="bg-amber-200 text-amber-950 font-mono text-[10.5px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                {filteredOrders.filter((o) => o.status === 'MENUNGGU_SETTING' || o.status === 'SETTING_SELESAI').length}
              </span>
            </div>

            <div className="space-y-2.5 min-h-[400px]">
              {filteredOrders
                .filter((o) => o.status === 'MENUNGGU_SETTING' || o.status === 'SETTING_SELESAI')
                .map((order) => (
                  <SpkKanbanCard
                    key={order.id}
                    order={order}
                    onOpenDetail={() => {
                      setSelectedOrder(order);
                      setIsDetailModalOpen(true);
                    }}
                    onQuickAdvance={() => handleUpdateStatus(order.id, 'SEDANG_CETAK')}
                    advanceLabel="➔ Kirim ke Mesin"
                    onSendToPos={() => handleSendSpkToPos(order)}
                    sendToPosLabel="🛒 POS"
                    onDelete={canManageSpk ? () => handleDeleteSpk(order.id) : undefined}
                  />
                ))}
            </div>
          </div>

          {/* Column 2: Sedang Cetak Mesin */}
          <div className="bg-indigo-50/60 rounded-2xl border border-indigo-300 p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-tight">2. Sedang Cetak Mesin</h3>
              </div>
              <span className="bg-indigo-200 text-indigo-950 font-mono text-[10.5px] font-black px-2 py-0.5 rounded-full border border-indigo-300">
                {filteredOrders.filter((o) => o.status === 'SEDANG_CETAK').length}
              </span>
            </div>

            <div className="space-y-2.5 min-h-[400px]">
              {filteredOrders
                .filter((o) => o.status === 'SEDANG_CETAK')
                .map((order) => (
                  <SpkKanbanCard
                    key={order.id}
                    order={order}
                    onOpenDetail={() => {
                      setSelectedOrder(order);
                      setIsDetailModalOpen(true);
                    }}
                    onQuickAdvance={() => handleUpdateStatus(order.id, 'FINISHING')}
                    advanceLabel="➔ Kirim ke Finishing"
                    onSendToPos={() => handleSendSpkToPos(order)}
                    sendToPosLabel="🛒 POS"
                    onDelete={canManageSpk ? () => handleDeleteSpk(order.id) : undefined}
                  />
                ))}
            </div>
          </div>

          {/* Column 3: Proses Finishing */}
          <div className="bg-purple-50/60 rounded-2xl border border-purple-300 p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-purple-200 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                <h3 className="text-xs font-black text-purple-950 uppercase tracking-tight">3. Finishing & Potong</h3>
              </div>
              <span className="bg-purple-200 text-purple-950 font-mono text-[10.5px] font-black px-2 py-0.5 rounded-full border border-purple-300">
                {filteredOrders.filter((o) => o.status === 'FINISHING').length}
              </span>
            </div>

            <div className="space-y-2.5 min-h-[400px]">
              {filteredOrders
                .filter((o) => o.status === 'FINISHING')
                .map((order) => (
                  <SpkKanbanCard
                    key={order.id}
                    order={order}
                    onOpenDetail={() => {
                      setSelectedOrder(order);
                      setIsDetailModalOpen(true);
                    }}
                    onQuickAdvance={() => handleUpdateStatus(order.id, 'SIAP_AMBIL')}
                    advanceLabel="➔ Tandai Siap Ambil"
                    onSendToPos={() => handleSendSpkToPos(order)}
                    sendToPosLabel="🛒 POS"
                    onDelete={canManageSpk ? () => handleDeleteSpk(order.id) : undefined}
                  />
                ))}
            </div>
          </div>

          {/* Column 4: Siap Ambil / Siap Bayar di Kasir */}
          <div className="bg-emerald-50/60 rounded-2xl border border-emerald-400 p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <h3 className="text-xs font-black text-emerald-950 uppercase tracking-tight">4. Siap Ambil / Bayar</h3>
              </div>
              <span className="bg-emerald-200 text-emerald-950 font-mono text-[10.5px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                {filteredOrders.filter((o) => o.status === 'SIAP_AMBIL').length}
              </span>
            </div>

            <div className="space-y-2.5 min-h-[400px]">
              {filteredOrders
                .filter((o) => o.status === 'SIAP_AMBIL')
                .map((order) => (
                  <SpkKanbanCard
                    key={order.id}
                    order={order}
                    onOpenDetail={() => {
                      setSelectedOrder(order);
                      setIsDetailModalOpen(true);
                    }}
                    onQuickAdvance={() => handleUpdateStatus(order.id, 'SELESAI_LUNAS')}
                    advanceLabel="✓ Lunas"
                    onSendToPos={() => handleSendSpkToPos(order)}
                    sendToPosLabel="🛒 Tarik ke POS"
                    onOpenAccount={() => handleUpdateStatus(order.id, 'OPEN_ACCOUNT')}
                    onDelete={canManageSpk ? () => handleDeleteSpk(order.id) : undefined}
                  />
                ))}
            </div>
          </div>

          {/* Column 5: Open Account (Rekening Terbuka - Konsolidasi Tagihan per Pelanggan) */}
          <div className="bg-amber-50/70 rounded-2xl border-2 border-amber-400 p-3 space-y-3">
            <div className="space-y-1.5 border-b border-amber-300 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <h3 className="text-xs font-black text-amber-950 uppercase tracking-tight">5. Open Account</h3>
                </div>
                <span className="bg-amber-300 text-slate-950 font-mono text-[10.5px] font-black px-2 py-0.5 rounded-full border border-amber-400 shadow-2xs">
                  {openAccountGroups.length} Tagihan ({filteredOrders.filter((o) => o.status === 'OPEN_ACCOUNT').length} SPK)
                </span>
              </div>
              <p className="text-[10px] text-amber-900 font-medium leading-tight">
                Rekening Terbuka: Barang diserahkan, tagihan dikonsolidasi per ID Pelanggan.
              </p>
            </div>

            <div className="space-y-3 min-h-[400px]">
              {openAccountGroups.length > 0 ? (
                openAccountGroups.map((group) => (
                  <OpenAccountGroupCard
                    key={group.customerId}
                    group={group}
                    onOpenDetail={(order) => {
                      setSelectedOrder(order);
                      setIsDetailModalOpen(true);
                    }}
                    onReturnToReady={(orderId) => handleUpdateStatus(orderId, 'SIAP_AMBIL')}
                    onSendToPos={(grp) => handleSendOpenAccountGroupToPos(grp)}
                    onCreateInvoice={(grp) => handleCreateInvoiceFromOpenAccount(grp)}
                  />
                ))
              ) : (
                <div className="text-center py-10 px-3 bg-white/70 rounded-xl border border-dashed border-amber-300 text-amber-800 text-xs">
                  <p className="font-bold">Belum ada tagihan Open Account.</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Klik tombol kuning <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded font-black">Open Account</span> di bawah Tarik ke POS pada kolom Siap Ambil / Bayar.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Column 6: Riwayat Selesai & Lunas */}
          <div className="bg-slate-100 rounded-2xl border border-slate-300 p-3 space-y-3">
            <div className="space-y-1.5 border-b border-slate-200 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">6. Selesai (Arsip)</h3>
                </div>
                <span className="bg-slate-200 text-slate-900 font-mono text-[10.5px] font-black px-2 py-0.5 rounded-full border border-slate-300">
                  {filteredOrders.filter((o) => o.status === 'SELESAI_LUNAS' || o.status === 'DIBATALKAN').length}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span>Auto-Hapus: Jam 19:00 WIB</span>
                {canManageSpk && metrics.completed > 0 && (
                  <button
                    type="button"
                    onClick={handleManualPurgeArchive}
                    className="text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer inline-flex items-center gap-0.5"
                    title="Hapus manual seluruh SPK Selesai (Arsip) sekarang"
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>Hapus ({metrics.completed})</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 min-h-[400px] max-h-[620px] overflow-y-auto pr-0.5">
              {filteredOrders
                .filter((o) => o.status === 'SELESAI_LUNAS' || o.status === 'DIBATALKAN')
                .map((order) => (
                  <SpkKanbanCard
                    key={order.id}
                    order={order}
                    isCompact={true}
                    onOpenDetail={() => {
                      setSelectedOrder(order);
                      setIsDetailModalOpen(true);
                    }}
                    onDelete={canManageSpk ? () => handleDeleteSpk(order.id) : undefined}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LIST VIEW TABEL SPK - Clean Typography & High-Contrast Rows */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {canManageSpk && metrics.completed > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-sans">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Terdapat {metrics.completed} SPK Selesai (Arsip). Otomatis dibersihkan jam 19.00 WIB setiap hari.</span>
              </div>
              <button
                type="button"
                onClick={handleManualPurgeArchive}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Hapus manual seluruh SPK Selesai (Arsip) sekarang"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Arsip Sekarang ({metrics.completed})</span>
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10.5px]">
                <tr>
                  <th className="py-3.5 px-4">No. SPK & Waktu</th>
                  <th className="py-3.5 px-4">Pelanggan</th>
                  <th className="py-3.5 px-4">Pekerjaan & Ukuran</th>
                  <th className="py-3.5 px-4">Mesin Cetak</th>
                  <th className="py-3.5 px-4">Status Produksi</th>
                  <th className="py-3.5 px-4 text-right">Total Biaya</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-bold">
                      Tidak ada SPK cetak yang cocok dengan kriteria pencarian/filter.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const badge = getStatusBadge(order.status);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-black text-slate-950 text-xs">{order.orderNumber}</div>
                          <div className="text-[11px] text-slate-600 font-medium">{order.date} • {order.time}</div>
                          {order.priority === 'URGENT' && (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[9.5px] font-black px-1.5 py-0.2 rounded mt-1 border border-red-300">
                              <Flame className="w-2.5 h-2.5 text-red-600" /> URGENT
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-950">{order.customerName}</div>
                          <div className="text-[11px] text-slate-600 font-medium">{order.customerPhone || '-'}</div>
                          <span className="text-[9.5px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 mt-0.5 inline-block">
                            {order.customerCategory || 'UMUM'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="space-y-0.5">
                              <div className="font-bold text-slate-950">{it.jobName}</div>
                              <div className="text-[11px] text-slate-700 font-medium">
                                {it.materialName} •{' '}
                                {it.saleMode === 'lembar' ? (
                                  <strong className="text-slate-950 font-bold">{it.qty} Lembar</strong>
                                ) : (
                                  <>
                                    <strong className="text-slate-950 font-bold">{it.lengthMeters}x{it.widthMeters}m</strong> ({it.qty} pcs = {it.areaM2} m²)
                                  </>
                                )}
                              </div>
                              {it.finishings.length > 0 && (
                                <div className="text-[10px] text-indigo-900 font-semibold">
                                  Finishing: {it.finishings.map((f) => f.name).join(', ')}
                                </div>
                              )}
                              {(() => {
                                const allFiles = order.printFiles && order.printFiles.length > 0
                                  ? order.printFiles
                                  : order.printFile
                                  ? [order.printFile]
                                  : it.printFile
                                  ? [it.printFile]
                                  : it.designFileName
                                  ? [{ fileName: it.designFileName }]
                                  : [];
                                if (allFiles.length === 0) return null;
                                return (
                                  <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-200 mt-0.5 max-w-full">
                                    <FolderSymlink className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span className="truncate max-w-[150px]">
                                      {allFiles[0].fileName}
                                    </span>
                                    {allFiles.length > 1 && (
                                      <span className="bg-indigo-600 text-white text-[9px] font-sans px-1 rounded font-bold">
                                        +{allFiles.length - 1}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {getOrderMachinesList(order).map((mId, mIdx) => (
                              <div key={mIdx} className="font-bold text-slate-900 text-[11px] flex items-center gap-1">
                                <Cpu className="w-3 h-3 text-indigo-600 shrink-0" />
                                <span>{getMachineName(mId)}</span>
                              </div>
                            ))}
                          </div>
                          {order.designerName && (
                            <div className="text-[10.5px] text-slate-600 font-medium mt-1">Desain: {order.designerName}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                            {badge.label}
                          </span>
                          <div className="max-w-[210px]">
                            <SpkDeadlineTimerBadge order={order} />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-black text-slate-950 text-xs">
                            {formatRupiah(order.totalAmount)}
                          </div>
                          <div className="text-[10.5px] mt-0.5">
                            {order.isPaid ? (
                              <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">LUNAS</span>
                            ) : order.dpPaid > 0 ? (
                              <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">DP: {formatRupiah(order.dpPaid)}</span>
                            ) : (
                              <span className="text-red-800 font-bold bg-red-50 px-1.5 py-0.2 rounded border border-red-200">BELUM BAYAR</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {order.status !== 'SELESAI_LUNAS' && order.status !== 'DIBATALKAN' && (
                              <button
                                type="button"
                                onClick={() => handleSendSpkToPos(order)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-black rounded-lg cursor-pointer transition-all active:scale-95 shadow-xs flex items-center gap-1"
                                title="Tarik ke Kasir POS untuk Pembayaran Langsung"
                              >
                                <span>🛒 POS</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrder(order);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg cursor-pointer transition-colors border border-slate-200"
                              title="Buka Detail SPK"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {canManageSpk && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSpk(order.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer transition-colors border border-rose-200"
                                title="Hapus SPK Permanen (Developer & Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePrintSpkSheet(order)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg cursor-pointer transition-colors border border-indigo-200"
                              title="Cetak SPK Kerja (Thermal 80mm)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: FORM BUAT SPK CETAK BARU - Clean & Professional Design */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateSpk} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Input SPK & Order Cetak Digital Baru
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-normal">
                Kalkulasi otomatis tarif cetak, pemilihan mesin, dan opsi finishing terpadu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('kanban')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Batal / Kembali
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Data Pelanggan & Spesifikasi Bahan */}
            <div className="lg:col-span-2 space-y-5">
              {/* Section 1: Customer Info */}
              <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    1. Informasi Pelanggan
                  </h3>

                  {selectedCustomerObj && (
                    <span className="bg-emerald-50 text-emerald-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 self-start sm:self-auto">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Pelanggan Terdaftar ({selectedCustomerObj.name})
                    </span>
                  )}
                </div>

                {/* Search Box: Cari Pelanggan Terdaftar / Input Baru di Bawah */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Search className="w-3.5 h-3.5 text-indigo-600" />
                      Cari Pelanggan Terdaftar / Input Baru
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal">Pencarian Real-Time ({customers.length} Terdaftar)</span>
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onFocus={() => setShowCustomerSearchDropdown(true)}
                      onChange={(e) => {
                        setCustomerSearchQuery(e.target.value);
                        setShowCustomerSearchDropdown(true);
                      }}
                      placeholder="Cari berdasarkan nama atau No. WhatsApp..."
                      className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-indigo-600 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 font-normal focus:outline-hidden focus:ring-2 focus:ring-indigo-100 shadow-2xs transition-all"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    {customerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerSearchQuery('');
                          setSelectedCustomerId('');
                          setNewCustomerName('');
                          setNewCustomerPhone('');
                          setNewCustomerCategory('UMUM');
                        }}
                        className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                        title="Bersihkan pencarian"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Live Search Results Dropdown */}
                  {showCustomerSearchDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-150">
                      {filteredCustomersForSpk.length > 0 ? (
                        <>
                          <div className="p-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                            Hasil Pencarian Pelanggan ({filteredCustomersForSpk.length})
                          </div>
                          {filteredCustomersForSpk.map((c) => {
                            const catName = categories?.find((cat) => cat.id === c.categoryId)?.name || 'UMUM';
                            const isSelected = c.id === selectedCustomerId;

                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setNewCustomerName(c.name);
                                  setNewCustomerPhone(c.phone || '');
                                  setNewCustomerCategory(catName);
                                  setCustomerSearchQuery(`${c.name} (${c.phone || 'No WA -'})`);
                                  setShowCustomerSearchDropdown(false);
                                }}
                                className={`w-full text-left p-2.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                                  isSelected ? 'bg-indigo-50/70 font-semibold text-indigo-900' : ''
                                }`}
                              >
                                <div>
                                  <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                                    <User className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span>{c.name}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    {c.phone ? `WA: ${c.phone}` : 'Tanpa No WA'}
                                  </div>
                                </div>
                                <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                  {catName}
                                </span>
                              </button>
                            );
                          })}
                        </>
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-500 font-normal">
                          Tidak ditemukan pelanggan dengan kata kunci "{customerSearchQuery}"
                        </div>
                      )}

                      {/* Option: Input Pelanggan Baru */}
                      {customerSearchQuery.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId('');
                            const q = customerSearchQuery.trim();
                            if (/^\d+$/.test(q)) {
                              setNewCustomerPhone(q);
                            } else {
                              setNewCustomerName(q);
                            }
                            setShowCustomerSearchDropdown(false);
                          }}
                          className="w-full text-left p-3 text-xs bg-indigo-50/60 hover:bg-indigo-50 text-indigo-900 font-semibold flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-indigo-600" />
                            Gunakan sebagai Pelanggan Baru: "{customerSearchQuery}"
                          </span>
                          <span className="bg-indigo-600 text-white text-[10px] font-medium px-2 py-0.5 rounded">
                            BARU
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pelanggan *</label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => {
                        setNewCustomerName(e.target.value);
                        setSelectedCustomerId('');
                      }}
                      placeholder="misal: Bu Joko / Toko Berkah"
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-normal focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">No. WhatsApp / HP</label>
                    <input
                      type="text"
                      value={newCustomerPhone}
                      onChange={(e) => {
                        setNewCustomerPhone(e.target.value);
                        setSelectedCustomerId('');
                      }}
                      placeholder="0812-xxxx-xxxx"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-normal focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori Pelanggan</label>
                    <select
                      value={newCustomerCategory}
                      onChange={(e) => setNewCustomerCategory(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 cursor-pointer"
                    >
                      {categories && categories.length > 0 ? (
                        categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>
                            {cat.name.toUpperCase()}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="UMUM">UMUM (Retail)</option>
                          <option value="AGEN">AGEN (Mitra Agen)</option>
                          <option value="GROSIR">GROSIR / Instansi</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {!selectedCustomerId && newCustomerName.trim() && (
                  <div className="bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100 text-[11px] text-indigo-900 font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      Pelanggan baru akan otomatis tersimpan di Daftar Pelanggan & Database.
                    </span>
                    <span className="bg-indigo-100 text-indigo-800 text-[9.5px] font-mono px-2 py-0.5 rounded border border-indigo-200 shrink-0">AUTO-SYNC</span>
                  </div>
                )}
              </div>

              {/* Section 2: Order Cetak & Spesifikasi Produk (Multi-Produk) */}
              <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                      2. Order Cetak & Rincian Produk ({orderItems.length} Produk)
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Pilih lebih dari 1 produk dengan rincian ukuran & harga masing-masing.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddOrderItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs cursor-pointer transition-all active:scale-[0.99] self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Produk Cetak</span>
                  </button>
                </div>

                {/* List of Item Cards */}
                <div className="space-y-4">
                  {orderItems.map((item, index) => {
                    const itemProductObj = spkProducts.find((p) => p.id === item.productId);

                    return (
                      <div
                        key={item.id}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5 transition-all hover:border-slate-300"
                      >
                        {/* Item Card Header */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <span className="font-semibold text-xs text-slate-900">
                              Item #{index + 1} {item.materialName ? `• ${item.materialName}` : ''}
                            </span>
                            <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-md border bg-slate-100 text-slate-700 border-slate-200">
                              {item.saleMode === 'meter' ? 'Hitung per Meter (P × L)' : 'Hitung per Lembar (Qty)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                              Subtotal: {formatRupiah(item.totalPrice)}
                            </span>

                            {orderItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOrderItem(item.id)}
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg border border-slate-200 hover:border-rose-200 cursor-pointer transition-all active:scale-95"
                                title={`Hapus Item #${index + 1}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Nama Pekerjaan & Mode Selector */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Nama Pekerjaan / File *
                            </label>
                            <input
                              type="text"
                              value={item.jobName}
                              onChange={(e) => handleUpdateOrderItem(item.id, { jobName: e.target.value })}
                              placeholder={
                                item.saleMode === 'meter'
                                  ? 'misal: Spanduk Warung Soto 3x1m / Banner Event'
                                  : 'misal: Cetak Stiker A3+ / Sertifikat / Poster'
                              }
                              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-normal focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Mode Perhitungan
                            </label>
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderItem(item.id, { saleMode: 'meter' })}
                                className={`flex-1 py-1.5 rounded-md text-[10.5px] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  item.saleMode === 'meter'
                                    ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                                    : 'text-slate-600 hover:text-slate-900 font-medium'
                                }`}
                              >
                                <Maximize2 className="w-3 h-3" />
                                <span>Meter (P×L)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderItem(item.id, { saleMode: 'lembar' })}
                                className={`flex-1 py-1.5 rounded-md text-[10.5px] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  item.saleMode === 'lembar'
                                    ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                                    : 'text-slate-600 hover:text-slate-900 font-medium'
                                }`}
                              >
                                <FileText className="w-3 h-3" />
                                <span>Lembar (Qty)</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Order Cetak (Katalog Produk) - Clean & Highly Visible Component */}
                        <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-200/90 shadow-2xs space-y-3">
                          {/* Accent Top Badge */}
                          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-indigo-100 pb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                                <Boxes className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide">
                                  Pilih Dari Katalog Produk SPK *
                                </label>
                                <p className="text-[11px] text-slate-500 font-normal">
                                  Pilih jenis bahan atau layanan cetak digital ({spkProducts.length} produk katalog)
                                </p>
                              </div>
                            </div>

                            <span className="text-[10px] font-medium bg-white text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-2xs uppercase tracking-wider">
                              {itemProductObj ? itemProductObj.category.replace('_', ' ') : 'Katalog SPK'}
                            </span>
                          </div>

                          {/* Large, High-Visibility Select Input */}
                          <div className="relative">
                            <select
                              value={item.productId}
                              onChange={(e) => handleUpdateOrderItem(item.id, { productId: e.target.value })}
                              required
                              className="w-full bg-white text-slate-900 border-2 border-indigo-300 hover:border-indigo-400 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-3 focus:ring-indigo-100 cursor-pointer shadow-2xs transition-all pr-10"
                            >
                              <option value="" disabled className="text-slate-400 font-normal">
                                -- Pilih Produk / Jenis Bahan Cetak ({spkProducts.length} Katalog Tersedia) --
                              </option>
                              {spkProducts.map((p) => {
                                const catLabel = p.category === 'digital_printing' ? 'Digital Print' : p.category === 'laser_cutting' ? 'Laser Cutting' : 'Paket';
                                const price = computePriceForSpkProduct(p, newCustomerCategory, item.saleMode);
                                return (
                                  <option key={p.id} value={p.id} className="text-slate-900 font-medium py-1">
                                    {p.name} [{catLabel}] — {formatRupiah(price)} / {item.saleMode === 'meter' ? (p.unit || 'm²') : 'lembar'}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Product Details Summary Pill when selected */}
                          {itemProductObj ? (
                            <div className="bg-white border border-indigo-100 p-3 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                                <span className="text-slate-700 font-normal">
                                  Bahan Dipilih: <strong className="text-slate-900 font-semibold">{itemProductObj.name}</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 font-mono flex-wrap">
                                <span className="text-[11px] text-slate-500 font-sans">
                                  {item.saleMode === 'meter' ? 'Hitung per Meter (m²)' : 'Hitung per Lembar (Qty)'}
                                </span>
                                <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold px-2.5 py-1 rounded-md text-xs">
                                  Tarif {newCustomerCategory}: {formatRupiah(item.unitPrice)} / {item.saleMode === 'meter' ? (itemProductObj.unit || 'm²') : 'lembar'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                              <span className="font-normal">Pilih salah satu produk katalog di atas untuk menentukan spesifikasi bahan dan tarif SPK.</span>
                            </div>
                          )}
                        </div>

                        {/* Dimensions & Qty Calculator */}
                        {item.saleMode === 'meter' ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Panjang (m)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                value={item.lengthMeters}
                                onChange={(e) => handleUpdateOrderItem(item.id, { lengthMeters: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Lebar (m)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                value={item.widthMeters}
                                onChange={(e) => handleUpdateOrderItem(item.id, { widthMeters: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jumlah (Qty)</label>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => handleUpdateOrderItem(item.id, { qty: parseInt(e.target.value) || 1 })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarif / m² (Rp)</label>
                              <input
                                type="number"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => handleUpdateOrderItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jumlah Lembar (Qty)</label>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => handleUpdateOrderItem(item.id, { qty: parseInt(e.target.value) || 1 })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarif / Lembar (Rp)</label>
                              <input
                                type="number"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => handleUpdateOrderItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden"
                              />
                            </div>
                          </div>
                        )}

                        {/* Item Calculation Details Box */}
                        <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg text-slate-700 font-normal border border-slate-200">
                          {item.saleMode === 'meter' ? (
                            <>
                              <span>
                                Ukuran: <strong className="text-slate-900 font-semibold">{item.lengthMeters} × {item.widthMeters} m</strong> ({item.qty} Pcs = <strong className="text-slate-900 font-mono font-semibold">{item.areaM2} m²</strong>)
                              </span>
                              <span>
                                Subtotal: <strong className="text-slate-900 font-bold font-mono text-xs">{formatRupiah(item.totalPrice)}</strong>
                              </span>
                            </>
                          ) : (
                            <>
                              <span>
                                Jumlah: <strong className="text-slate-900 font-semibold">{item.qty} Lembar</strong> @ {formatRupiah(item.unitPrice)}
                              </span>
                              <span>
                                Subtotal: <strong className="text-slate-900 font-bold font-mono text-xs">{formatRupiah(item.totalPrice)}</strong>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Per-Item Finishing & Accessories Options */}
                        <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                              <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                              Opsi Finishing (Produk #{index + 1})
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                              Opsi per produk
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {/* Mata Ayam */}
                            <div className={`p-2.5 rounded-lg border transition-all ${
                              item.finishings.mataAyam ? 'bg-indigo-50/50 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.finishings.mataAyam}
                                  onChange={(e) => handleUpdateItemFinishing(item.id, { mataAyam: e.target.checked })}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-800 text-xs">Mata Ayam / Keling</div>
                                  <div className="text-[10.5px] text-slate-500 font-normal">Lubang ring gantungan</div>
                                </div>
                              </label>
                              {item.finishings.mataAyam && (
                                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                                  <span className="font-medium text-slate-600">Jumlah Titik:</span>
                                  <div className="flex items-center gap-1">
                                    {[4, 6, 8].map((qtyVal) => (
                                      <button
                                        key={qtyVal}
                                        type="button"
                                        onClick={() => handleUpdateItemFinishing(item.id, { mataAyamQty: qtyVal })}
                                        className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border cursor-pointer transition-all ${
                                          item.finishings.mataAyamQty === qtyVal
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        {qtyVal} Titik
                                      </button>
                                    ))}
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.finishings.mataAyamQty || 4}
                                      onChange={(e) => handleUpdateItemFinishing(item.id, { mataAyamQty: parseInt(e.target.value) || 4 })}
                                      className="w-12 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                                      title="Ketik jumlah titik kustom"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Lipat Lem */}
                            <div className={`p-2.5 rounded-lg border transition-all ${
                              item.finishings.lipatLem ? 'bg-indigo-50/50 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.finishings.lipatLem}
                                  onChange={(e) => handleUpdateItemFinishing(item.id, { lipatLem: e.target.checked })}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-800 text-xs">Lipat Lem Keliling</div>
                                  <div className="text-[10.5px] text-slate-500 font-normal">Perkuat tepi banner keliling</div>
                                </div>
                              </label>
                            </div>

                            {/* Laminasi */}
                            <div className={`p-2.5 rounded-lg border transition-all ${
                              item.finishings.laminasi ? 'bg-indigo-50/50 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.finishings.laminasi}
                                  onChange={(e) => handleUpdateItemFinishing(item.id, { laminasi: e.target.checked })}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-800 text-xs">Laminasi Pelindung</div>
                                  <div className="text-[10.5px] text-slate-500 font-normal">Doff / Glossy / Panas / Dingin</div>
                                </div>
                              </label>
                              {item.finishings.laminasi && (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                  <select
                                    value={item.finishings.laminasiType}
                                    onChange={(e) => handleUpdateItemFinishing(item.id, { laminasiType: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 cursor-pointer focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="Laminasi Doff Dingin">Laminasi Doff Dingin</option>
                                    <option value="Laminasi Glossy Dingin">Laminasi Glossy Dingin</option>
                                    <option value="Laminasi Doff Panas (Thermal)">Laminasi Doff Panas (Thermal)</option>
                                    <option value="Laminasi Glossy Panas (Thermal)">Laminasi Glossy Panas (Thermal)</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Cutting Plotter */}
                            <div className={`p-2.5 rounded-lg border transition-all ${
                              item.finishings.cutting ? 'bg-indigo-50/50 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.finishings.cutting}
                                  onChange={(e) => handleUpdateItemFinishing(item.id, { cutting: e.target.checked })}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-800 text-xs">Potong / Cutting</div>
                                  <div className="text-[10.5px] text-slate-500 font-normal">Kiss cut / Die cut</div>
                                </div>
                              </label>
                              {item.finishings.cutting && (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                  <select
                                    value={item.finishings.cuttingType}
                                    onChange={(e) => handleUpdateItemFinishing(item.id, { cuttingType: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 cursor-pointer focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="Kiss Cut Presisi (Pola)">Kiss Cut Presisi (Pola Stiker)</option>
                                    <option value="Die Cut Tembus (Sticker Cut)">Die Cut Tembus (Potong Putus)</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Selongsong */}
                            <div className={`p-2.5 rounded-lg border transition-all sm:col-span-2 ${
                              item.finishings.selongsong ? 'bg-indigo-50/50 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.finishings.selongsong}
                                  onChange={(e) => handleUpdateItemFinishing(item.id, { selongsong: e.target.checked })}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-800 text-xs">Selongsong Banner</div>
                                  <div className="text-[10.5px] text-slate-500 font-normal">Selongsong untuk selipan bambu / pipa kayu (Atas Bawah / Kiri Kanan)</div>
                                </div>
                              </label>
                            </div>
                          </div>

                          {/* Operator Notes for this specific item */}
                          <div className="pt-1">
                            <input
                              type="text"
                              value={item.operatorNotes || ''}
                              onChange={(e) => handleUpdateOrderItem(item.id, { operatorNotes: e.target.value })}
                              placeholder={`Catatan finishing / instruksi khusus produk #${index + 1} (opsional, misal: lebihkan putih 3cm keliling)...`}
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 font-normal focus:outline-hidden"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Another Product Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAddOrderItem}
                    className="w-full py-2.5 bg-white hover:bg-slate-50 text-indigo-700 font-semibold text-xs rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs"
                  >
                    <Plus className="w-4 h-4 text-indigo-600" />
                    <span>+ Tambah Produk / Item Cetak Lainnya ke SPK Ini</span>
                  </button>
                </div>

                {/* Multi-Item Order Summary Banner */}
                <div className="bg-slate-100 text-slate-800 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    <span className="text-slate-600 font-normal">
                      Rincian Order: <strong className="text-slate-900 font-semibold">{orderItems.length} Produk</strong> ({calculatedTotalItems.totalQty} Pcs, {calculatedTotalItems.totalArea} m²)
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 font-mono">
                    Total Order: {formatRupiah(calculatedTotalItems.totalPrice)}
                  </div>
                </div>
              </div>

              {/* Section 3: Target Mesin Produksi */}
              <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                    <span>3. Target Mesin Produksi (Bisa Pilih &gt; 2 Mesin) *</span>
                  </label>
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {newMachines.length} Mesin Dipilih
                  </span>
                </div>

                {/* Multi-machine select cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {machines.map((m) => {
                    const isReady = m.status === 'READY';
                    const isSelected = newMachines.includes(m.id);

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (isReady) {
                            toggleMachineInForm(m.id);
                          } else {
                            alert(`Mesin "${m.name}" sedang status UNDER MAINTENANCE dan tidak dapat dipilih.`);
                          }
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 select-none ${
                          !isReady
                            ? 'bg-slate-100/80 border-slate-200 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-50/60 border-indigo-400 ring-1 ring-indigo-400/30 shadow-2xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div className="font-semibold text-xs text-slate-900 truncate">
                              {m.name}
                            </div>
                          </div>
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded uppercase shrink-0 bg-slate-100 text-slate-700 border border-slate-200">
                            {m.category}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-500 flex items-center justify-between font-normal pt-1 border-t border-slate-100">
                          <span>{m.typeDescription || (m.category === 'CETAK' ? 'Mesin Cetak' : 'Mesin Cutting')}</span>
                          {isReady ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> READY
                            </span>
                          ) : (
                            <span className="text-rose-600 font-semibold">MAINTENANCE</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Machines Summary Banner */}
                {newMachines.length > 0 ? (
                  <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium text-[11px] truncate">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {newMachines.length} Mesin Produksi Terpilih:{' '}
                        <strong className="text-slate-900 font-semibold">
                          {newMachines.map((id) => getMachineName(id)).join(' + ')}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                      Siap Produksi
                    </span>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-normal flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Pilih minimal 1 mesin untuk memproses SPK ini.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Deadlines, Pricing & Summary */}
            <div className="space-y-5">
              {/* Deadline & Priority */}
              <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  Prioritas & Deadline
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat Prioritas</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPriority('NORMAL')}
                      className={`p-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        newPriority === 'NORMAL'
                          ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPriority('URGENT')}
                      className={`p-2 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        newPriority === 'URGENT'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      🔥 Urgent
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tgl Deadline</label>
                    <input
                      type="date"
                      value={newDeadlineDate}
                      onChange={(e) => setNewDeadlineDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Selesai</label>
                    <input
                      type="time"
                      value={newDeadlineTime}
                      onChange={(e) => setNewDeadlineTime(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* File Desain & Catatan - Enhanced with Local File Input & Shortcut Management */}
              <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    4. File Cetak & Catatan
                  </h3>
                  <span className="text-[10.5px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-slate-500" />
                    Penyimpanan Lokal Aktif
                  </span>
                </div>

                {/* Upload File Cetak Dropzone (Bisa Pilih > 1 File Sekaligus) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <FileUp className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Input File Cetak (Bisa Pilih Banyak File)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePickFilesFromLanFolder()}
                        disabled={isSharedFolderBusy}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold rounded-lg border border-indigo-200 hover:border-indigo-400 cursor-pointer flex items-center gap-1 transition-all shadow-2xs disabled:opacity-50 disabled:cursor-wait"
                        title="Pilih file dari folder bersama LAN lalu lampirkan ke SPK"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>+ Pilih dari Folder LAN</span>
                      </button>
                      <span className="text-[10.5px] text-slate-500 font-normal">Tersimpan lokal & LAN</span>
                    </div>
                  </div>

                  {newPrintFiles.length > 0 ? (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                          <span>Terlampir {newPrintFiles.length} File Cetak</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold rounded-lg border border-indigo-200 cursor-pointer flex items-center gap-1 transition-all shadow-2xs">
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Tambah File</span>
                            <input
                              type="file"
                              multiple
                              onChange={handleFileInputChange}
                              accept=".pdf,.cdr,.psd,.ai,.eps,.tiff,.tif,.jpg,.jpeg,.png,.zip,.rar,.7z,.svg"
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={handleClearAllPrintFiles}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-[11px] font-medium rounded-lg border border-slate-200 hover:border-rose-200 cursor-pointer transition-all shadow-2xs"
                            title="Hapus semua file terlampir"
                          >
                            Hapus Semua
                          </button>
                        </div>
                      </div>

                      {/* File Items List */}
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {newPrintFiles.map((fileObj, fIdx) => {
                          const extMeta = getFileExtensionMeta(fileObj.fileName);
                          const shortcutPath = buildSharedFilePath(fileObj.fileName);
                          return (
                            <div key={fileObj.id || fIdx} className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 space-y-2 hover:border-slate-300 transition-all">
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {fIdx + 1}
                                  </span>
                                  <div className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border uppercase shrink-0 ${extMeta.color}`}>
                                    {extMeta.ext}
                                  </div>
                                  <div className="overflow-hidden min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 truncate" title={fileObj.fileName}>
                                      {fileObj.fileName}
                                    </div>
                                    <div className="text-[10.5px] text-slate-500 font-normal flex items-center gap-1.5 mt-0.5">
                                      {fileObj.fileSize ? (
                                        <>
                                          <span>Ukuran: <strong className="text-slate-700 font-medium">{formatBytes(fileObj.fileSize)}</strong></span>
                                          <span>•</span>
                                        </>
                                      ) : null}
                                      {fileObj.sharedCopy ? (
                                        <span className="text-emerald-700 font-medium flex items-center gap-0.5">
                                          <CheckCircle className="w-3 h-3" /> Ada di folder bersama
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => retryCopyNewFileToFolder(fIdx)}
                                          disabled={isSharedFolderBusy}
                                          className="text-amber-700 font-medium flex items-center gap-1 hover:underline cursor-pointer disabled:cursor-wait disabled:opacity-60"
                                          title="Klik untuk menyalinkan berkas ini ke folder bersama"
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                          {isSharedFolderBusy ? 'Menyalinkan...' : 'Baru di perangkat ini, salinkan'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenFile(fileObj)}
                                    className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 cursor-pointer flex items-center gap-1 shadow-2xs"
                                    title={fileObj.sharedCopy ? 'Buka dari folder bersama' : 'Buka berkas dari vault perangkat ini'}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePrintFile(fIdx)}
                                    className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg text-xs font-medium border border-slate-200 hover:border-rose-200 cursor-pointer shadow-2xs"
                                    title="Hapus file ini dari lampiran SPK"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Lokasi berkas */}
                              <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                                  <FolderSymlink className={`w-3.5 h-3.5 shrink-0 ${fileObj.sharedCopy ? 'text-indigo-600' : 'text-slate-400'}`} />
                                  {fileObj.sharedCopy ? (
                                    <span className="font-mono text-slate-700 font-medium text-[11px] truncate select-all" title={shortcutPath}>
                                      {shortcutPath}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 text-[11px]">
                                      Berkas hanya ada di vault perangkat ini
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyShortcut(shortcutPath)}
                                  disabled={!fileObj.sharedCopy}
                                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10.5px] font-medium rounded border border-slate-200 cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={fileObj.sharedCopy ? 'Salin path lokasi bersama' : 'Salinkan dulu ke folder bersama agar path tersedia'}
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Salin Path</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Dropzone mini to add more files */}
                      <label className="border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 p-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-center">
                        <input
                          type="file"
                          multiple
                          onChange={handleFileInputChange}
                          accept=".pdf,.cdr,.psd,.ai,.eps,.tiff,.tif,.jpg,.jpeg,.png,.zip,.rar,.7z,.svg"
                          className="hidden"
                        />
                        <FileUp className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-medium text-slate-700">
                          {isUploadingFile ? 'Sedang Memproses...' : '+ Tambahkan File Cetak Lainnya'}
                        </span>
                      </label>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white hover:bg-slate-50/80 rounded-xl p-4.5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group text-center">
                      <input
                        type="file"
                        multiple
                        onChange={handleFileInputChange}
                        accept=".pdf,.cdr,.psd,.ai,.eps,.tiff,.tif,.jpg,.jpeg,.png,.zip,.rar,.7z,.svg"
                        className="hidden"
                      />
                      <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-50 text-slate-600 group-hover:text-indigo-600 flex items-center justify-center transition-colors">
                        <FileUp className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-slate-800 group-hover:text-indigo-900">
                          {isUploadingFile ? 'Sedang Memproses File...' : 'Klik atau Tarik File Cetak ke Sini'}
                        </div>
                        <div className="text-[10.5px] text-slate-500 mt-0.5 font-normal">
                          Mendukung PDF, CDR, PSD, AI, TIFF, JPG, PNG, ZIP (Bisa pilih banyak file)
                        </div>
                      </div>
                    </label>
                  )}
                </div>

                {/* Lokasi Penyimpanan File LAN / Jaringan */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 text-xs shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <FolderOpen className="w-4 h-4 text-indigo-600" />
                      <span>Folder Penyimpanan Jaringan LAN / Lokal</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenLanFolderModal}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs text-[11px] active:scale-95"
                      title="Klik untuk memilih folder dalam jaringan LAN atau komputer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ubah Folder</span>
                    </button>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      <HardDrive className="w-4 h-4 text-slate-600 shrink-0" />
                      <div className="truncate">
                        <span className="text-[10px] text-slate-500 font-medium uppercase block">Folder Bersama Saat Ini:</span>
                        <span className="font-mono font-medium text-slate-800 text-xs truncate block">
                          {newLocalDir || 'Belum disetel. Klik "Ubah Folder".'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-medium border px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${sharedFolderBadge.cls}`}
                      title={grantStatus?.message || 'Sedang memeriksa izin folder perangkat ini.'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${sharedFolderBadge.dot}`}></span>
                      <span>{sharedFolderBadge.label}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleBrowseLanFolder}
                      disabled={isSharedFolderBusy}
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md border border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
                      title="Pilih folder yang sama di komputer ini supaya berkas bisa dibaca-tulis langsung"
                    >
                      {grantStatus?.granted ? 'Pindah / Ganti Folder Perangkat Ini' : 'Hubungkan Folder di Perangkat Ini'}
                    </button>
                    <span className="text-[10.5px] text-slate-500">
                      Izin folder diberikan per komputer. Lokasi foldernya sendiri sudah otomatis sama untuk semua pengguna.
                    </span>
                  </div>
                </div>

                {/* Nama File Desain Manual / Auto */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama File Desain</label>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="misal: Faktur_Pembelian_PB-261001-9280.pdf"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-normal focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden"
                  />
                  {newFileName.trim() && !newPrintFile && (
                    <div className="mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        <FolderSymlink className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div className="overflow-hidden">
                          <span className="text-[10px] text-slate-500 font-medium uppercase block">link shortcut :</span>
                          <span className="font-mono text-slate-800 font-medium text-xs truncate block select-all">
                            {buildSharedFilePath(newFileName)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyShortcut(buildSharedFilePath(newFileName))}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs active:scale-95"
                        title="Salin shortcut path lokasi lokal"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Path</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Catatan Instruksi Khusus Operator */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Instruksi Khusus Operator / Mesin</label>
                  <textarea
                    rows={2}
                    value={newOperatorNotes}
                    onChange={(e) => setNewOperatorNotes(e.target.value)}
                    placeholder="Catatan warna CMYK, kerapatan mata ayam, sambungan banner, atau bleed..."
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-normal focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden resize-none"
                  ></textarea>
                </div>
              </div>

              {/* Total & Action - Clean, Professional Summary Card */}
              <div className="bg-white p-5 rounded-2xl space-y-4 shadow-sm border border-slate-200">
                <div className="space-y-2 border-b border-slate-200 pb-3">
                  <div className="flex justify-between text-xs text-slate-500 font-normal">
                    <span>
                      Rincian ({orderItems.length} Produk • {calculatedTotalItems.totalQty} Pcs • {calculatedTotalItems.totalArea} m²)
                    </span>
                    <span className="font-semibold text-slate-700 font-mono">{formatRupiah(calculatedTotalSpk)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">TOTAL SPK</span>
                    <span className="text-xl font-bold text-slate-900 font-mono">{formatRupiah(calculatedTotalSpk)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">DP / Uang Muka (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    max={calculatedTotalSpk}
                    value={newDpPaid}
                    onChange={(e) => setNewDpPaid(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-xl px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-hidden transition-all"
                  />
                  <div className="flex justify-between text-[11px] text-slate-600 font-normal mt-1.5">
                    <span>Sisa Pelunasan di Kasir:</span>
                    <strong className="text-slate-900 font-semibold font-mono">
                      {formatRupiah(Math.max(0, calculatedTotalSpk - newDpPaid))}
                    </strong>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Terbitkan SPK Cetak ({orderItems.length} Produk)</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* VIEW 4: MESIN CETAK & CUTTING MONITORING & MANAGEMENT (DEVELOPER ONLY) */}
      {currentUser?.role === 'DEVELOPER' && activeTab === 'machines' && (
        <div className="space-y-4">
          {/* LAN Machine Network Radar & Action Bar */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  Deteksi Mesin & Antrean Cetak Digital (Jaringan LAN)
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Pantau status online mesin di LAN (<strong className="text-emerald-400">ONLINE</strong> / <strong className="text-amber-400">MAINTENANCE</strong>), latency soket port 9100/IPP, dan RIP hotfolder spooler.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  setIsScanningLan(true);
                  try {
                    const res = await scanAllLanMachines(machines, true);
                    setMachines(res.machines);
                    showFileToast(`Scan LAN selesai: ${res.onlineCount} mesin online (${res.averageLatencyMs}ms)!`, 'success');
                  } catch {
                    showFileToast('Gagal memindai mesin di LAN', 'error');
                  } finally {
                    setIsScanningLan(false);
                  }
                }}
                disabled={isScanningLan}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                title="Pindai koneksi socket TCP mesin di subnet LAN"
              >
                <RefreshCw className={`w-4 h-4 ${isScanningLan ? 'animate-spin' : ''}`} />
                <span>{isScanningLan ? 'Scanning LAN...' : 'Scan Mesin di LAN'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddMachineModal}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>+ Tambah Mesin Baru</span>
              </button>
            </div>
          </div>

          {/* Machine Grid List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machines.map((m) => {
              const activeCount = orders.filter(
                (o) => (o.assignedMachine === m.id || (o.assignedMachines && o.assignedMachines.includes(m.id))) && (o.status === 'SEDANG_CETAK' || o.status === 'FINISHING')
              ).length;
              const queueCount = orders.filter(
                (o) => (o.assignedMachine === m.id || (o.assignedMachines && o.assignedMachines.includes(m.id))) && (o.status === 'MENUNGGU_SETTING' || o.status === 'SETTING_SELESAI')
              ).length;

              const isReady = m.status === 'READY';
              const latency = m.pingLatencyMs || 0;

              return (
                <div
                  key={m.id}
                  className={`bg-white p-5 rounded-2xl border-2 shadow-xs space-y-4 transition-all hover:shadow-md ${
                    !isReady ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-950 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200">
                          {m.category}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {m.ipAddress ? `${m.ipAddress}:${m.port || 9100}` : 'IP belum disetel'}
                        </span>
                      </div>
                      <h3 className="font-black text-sm text-slate-950 mt-1.5">{m.name}</h3>
                      <p className="text-[11px] text-slate-500 font-medium">{m.typeDescription}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10.5px] font-black border flex items-center gap-1 shrink-0 ${
                          isReady
                            ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                            : 'bg-amber-100 text-amber-950 border-amber-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`}></span>
                        {isReady ? (m.lanStatus === 'ONLINE' ? `ONLINE (${latency}ms)` : 'SIAP (belum dipindai)') : 'MAINTENANCE'}
                      </span>
                    </div>
                  </div>

                  {/* Work Queue Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <div className="text-[10.5px] text-slate-600 uppercase font-bold">Sedang Cetak/Potong</div>
                      <div className="text-base font-black text-indigo-950 mt-0.5">{activeCount} SPK</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] text-slate-600 uppercase font-bold">Antrean Masuk</div>
                      <div className="text-base font-black text-amber-950 mt-0.5">{queueCount} SPK</div>
                    </div>
                  </div>

                  {/* Specs & RIP Details */}
                  <div className="text-[11.5px] text-slate-600 font-medium space-y-1.5 bg-slate-50/60 p-2.5 rounded-lg border border-slate-200/80">
                    {m.ripSoftware && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500 font-bold">RIP Software:</span>
                        <span className="font-black text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">{m.ripSoftware}</span>
                      </div>
                    )}
                    {m.speed && (
                      <div className="flex justify-between">
                        <span>Kecepatan:</span>
                        <span className="font-bold text-slate-900">{m.speed}</span>
                      </div>
                    )}
                    {m.headSpec && (
                      <div className="flex justify-between">
                        <span>Spesifikasi / Head:</span>
                        <span className="font-bold text-slate-900">{m.headSpec}</span>
                      </div>
                    )}
                    {m.operatorDefault && (
                      <div className="flex justify-between">
                        <span>Operator Default:</span>
                        <span className="font-bold text-indigo-950">{m.operatorDefault}</span>
                      </div>
                    )}
                    {m.sharedFolderLanPath && (
                      <div className="text-[10.5px] font-mono text-slate-600 bg-white p-1.5 rounded border border-slate-200 flex items-center justify-between gap-1.5">
                        <span className="truncate" title={m.sharedFolderLanPath}>Hotfolder: {m.sharedFolderLanPath}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyShortcut(m.sharedFolderLanPath!)}
                          className="text-indigo-600 hover:text-indigo-800 p-0.5"
                          title="Salin path hotfolder"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {m.notes && (
                      <div className="text-[11px] text-slate-500 italic pt-0.5 border-t border-slate-200 mt-1 truncate">
                        "{m.notes}"
                      </div>
                    )}
                  </div>

                  {/* Action Buttons: Toggle Status, Ping, Edit, Delete */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleMachineStatus(m.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs ${
                          isReady
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                        }`}
                        title="Ubah status kesiapan mesin"
                      >
                        {isReady ? '➔ Set Maintenance' : '➔ Set Ready'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          showFileToast(`Ping ${m.name}...`, 'info');
                          const res = await pingLanMachine(m);
                          showFileToast(`Respon ${m.name}: ${res.status} (${res.latencyMs}ms)`, 'success');
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 cursor-pointer"
                        title="Test ping koneksi LAN mesin"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMachineModal(m)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg cursor-pointer border border-slate-200"
                        title="Edit rincian mesin & jaringan LAN"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMachine(m.id)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg cursor-pointer border border-red-200"
                        title="Hapus mesin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 5: STATUS KONEKSI & KEHADIRAN TIM USER SPK */}
      {activeTab === 'team_status' && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Status Koneksi & Logged-In User Tim SPK Cetak
              </h2>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Pengecekan real-time status login tiap pengguna di posisi alur SPK (<strong className="text-emerald-700">Desainer, Operator Cetak, Finishing, Kasir/Admin, Supervisor</strong>).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {currentUser?.role === 'DEVELOPER' && (
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>+ Tambah Anggota Tim</span>
                </button>
              )}
              <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-950">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>{onlineTeamUsersCount} / {teamUsers.length} User Terhubung & Ready</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
              <span className="text-slate-600 text-[11px] font-bold uppercase mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-500" />
                Filter Posisi:
              </span>
              {[
                { id: 'ALL', label: 'Semua Posisi SPK' },
                { id: 'DESAINER', label: '🎨 Desainer & Setting' },
                { id: 'OPERATOR_CETAK', label: '🖨️ Operator Cetak' },
                { id: 'FINISHING', label: '✂️ Finishing & Potong' },
                { id: 'KASIR_ADMIN', label: '💰 Kasir & Admin' },
                { id: 'SUPERVISOR', label: '🛡️ Supervisor & Dev' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTeamCategoryFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    teamCategoryFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                placeholder="Cari nama atau @username..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          {/* Position Category Grouped Lists */}
          {[
            {
              id: 'DESAINER',
              title: '🎨 1. DESAINER & SETTING FILE',
              desc: 'Tugas: Penyiapan file cetak, layouting, proofing ke pelanggan, & approval cetak.',
              bgHeader: 'bg-amber-500/10 border-amber-300 text-amber-950'
            },
            {
              id: 'OPERATOR_CETAK',
              title: '🖨️ 2. OPERATOR CETAK MESIN',
              desc: 'Tugas: Pengoperasian mesin cetak Outdoor, Indoor, UV, DTF, & Plotter.',
              bgHeader: 'bg-indigo-500/10 border-indigo-300 text-indigo-950'
            },
            {
              id: 'FINISHING',
              title: '✂️ 3. OPERATOR FINISHING & POTONG',
              desc: 'Tugas: Laminasi, cutting presisi, laser acrylic, klem mata ayam, & packing.',
              bgHeader: 'bg-purple-500/10 border-purple-300 text-purple-950'
            },
            {
              id: 'KASIR_ADMIN',
              title: '💰 4. KASIR & ADMINISTRASI SPK',
              desc: 'Tugas: Terima order SPK, pencatatan DP, pelunasan POS, & pendaftaran pelanggan.',
              bgHeader: 'bg-emerald-500/10 border-emerald-300 text-emerald-950'
            },
            {
              id: 'SUPERVISOR',
              title: '🛡️ 5. SUPERVISOR & DEVELOPER OPERASIONAL',
              desc: 'Tugas: Kontrol kelancaran sistem, penugasan mesin, & manajemen alur produksi.',
              bgHeader: 'bg-slate-800/10 border-slate-300 text-slate-950'
            }
          ]
            .filter((cat) => teamCategoryFilter === 'ALL' || teamCategoryFilter === cat.id)
            .map((catGroup) => {
              const categoryUsers = teamUsers.filter((u) => {
                const matchesCat = u.spkRoleCategory === catGroup.id;
                if (!matchesCat) return false;
                if (!teamSearchQuery.trim()) return true;
                const q = teamSearchQuery.toLowerCase();
                return (
                  u.name.toLowerCase().includes(q) ||
                  u.username.toLowerCase().includes(q) ||
                  (u.phone || '').includes(q)
                );
              });

              const onlineCount = categoryUsers.filter(isUserOnline).length;

              return (
                <div key={catGroup.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  {/* Category Header */}
                  <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${catGroup.bgHeader}`}>
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-tight flex items-center gap-2">
                        {catGroup.title}
                      </h3>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">{catGroup.desc}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                        onlineCount > 0
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          : 'bg-rose-100 text-rose-950 border-rose-300'
                      }`}>
                        {onlineCount > 0 ? `🟢 ${onlineCount} Terhubung & Ready` : '🔴 Belum Ada User Login'}
                      </span>
                    </div>
                  </div>

                  {/* Users Grid */}
                  <div className="p-4">
                    {categoryUsers.length === 0 ? (
                      <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs font-semibold">
                        Belum ada user terdaftar di posisi ini atau tidak cocok dengan filter pencarian.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {categoryUsers.map((userItem) => {
                          const presence = formatUserPresence(userItem);
                          const isOnline = presence.isOnline;

                          // Compute active workload for this user / stage
                          let userWorkload = 0;
                          let workloadLabel = 'Active Job';
                          if (catGroup.id === 'DESAINER') {
                            userWorkload = orders.filter((o) => o.status === 'MENUNGGU_SETTING').length;
                            workloadLabel = 'File Menunggu Setting';
                          } else if (catGroup.id === 'OPERATOR_CETAK') {
                            userWorkload = orders.filter((o) => o.status === 'SEDANG_CETAK').length;
                            workloadLabel = 'Cetak Mesin';
                          } else if (catGroup.id === 'FINISHING') {
                            userWorkload = orders.filter((o) => o.status === 'FINISHING').length;
                            workloadLabel = 'Finishing & Potong';
                          } else if (catGroup.id === 'KASIR_ADMIN') {
                            userWorkload = orders.filter((o) => o.status === 'SIAP_AMBIL').length;
                            workloadLabel = 'Siap Ambil di Kasir';
                          } else {
                            userWorkload = orders.filter((o) => o.status !== 'SELESAI_LUNAS' && o.status !== 'DIBATALKAN').length;
                            workloadLabel = 'Total SPK Aktif';
                          }

                          return (
                            <div
                              key={userItem.id}
                              className={`p-4 rounded-xl border-2 transition-all space-y-3 relative ${
                                isOnline
                                  ? 'bg-white border-emerald-300 shadow-xs hover:shadow-md'
                                  : 'bg-slate-50/80 border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  {/* Avatar with Status Badge */}
                                  <div className="relative">
                                    <div className={`w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center border shadow-xs ${
                                      isOnline
                                        ? 'bg-indigo-600 text-white border-indigo-400'
                                        : 'bg-slate-200 text-slate-700 border-slate-300'
                                    }`}>
                                      {userItem.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span
                                      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                        isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                      }`}
                                      title={isOnline ? 'Online / Logged In' : 'Offline'}
                                    ></span>
                                  </div>

                                  <div>
                                    <h4 className="font-black text-xs sm:text-sm text-slate-950 line-clamp-1">{userItem.name}</h4>
                                    <div className="text-[11px] font-mono text-slate-500 font-semibold flex items-center gap-1">
                                      <span>@{userItem.username}</span>
                                      <span>•</span>
                                      <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-[10px]">
                                        {userItem.role}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Status Tag */}
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border flex items-center gap-1 shrink-0 ${
                                  isOnline
                                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                    : 'bg-slate-200 text-slate-700 border-slate-300'
                                }`}>
                                  {isOnline ? (
                                    <>
                                      <Wifi className="w-3 h-3 text-emerald-600 animate-pulse" />
                                      <span>LOGGED IN</span>
                                    </>
                                  ) : (
                                    <>
                                      <WifiOff className="w-3 h-3 text-slate-500" />
                                      <span>OFFLINE</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* Login Time Details */}
                              <div className="bg-slate-100/80 p-2.5 rounded-lg border border-slate-200 text-[11px] font-medium space-y-1">
                                <div className="flex items-center justify-between text-slate-700">
                                  <span className="text-slate-500 font-bold">Status Koneksi:</span>
                                  <span className={`font-black ${isOnline ? 'text-emerald-700' : 'text-slate-600'}`}>
                                    {presence.statusText}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-slate-700">
                                  <span className="text-slate-500 font-bold">Aktivitas Terakhir:</span>
                                  <span className="font-bold text-slate-900">{presence.timeText}</span>
                                </div>
                              </div>

                              {/* Workload Metric */}
                              <div className="flex items-center justify-between bg-indigo-50/60 p-2 rounded-lg border border-indigo-100 text-xs">
                                <span className="text-indigo-950 font-bold text-[11px]">{workloadLabel}:</span>
                                <span className="font-black text-indigo-900 bg-indigo-200/80 px-2 py-0.5 rounded-md font-mono text-[11px]">
                                  {userWorkload} SPK
                                </span>
                              </div>

                              {/* Action Footer */}
                              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                                {userItem.phone ? (
                                  <a
                                    href={`https://wa.me/${userItem.phone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 rounded-lg border border-emerald-200 transition-all truncate"
                                    title={`Hubungi ${userItem.name} via WhatsApp`}
                                  >
                                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span className="truncate">{userItem.phone}</span>
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-slate-400 font-medium">No Phone</span>
                                )}

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Category Selector */}
                                  <select
                                    value={userItem.spkRoleCategory || 'OPERATOR_CETAK'}
                                    onChange={(e) => handleChangeUserSpkCategory(userItem.id, e.target.value as SpkRoleCategory)}
                                    className="text-[10px] font-bold bg-white border border-slate-300 rounded-lg px-1.5 py-1 text-slate-800 cursor-pointer focus:ring-2 focus:ring-indigo-500"
                                    title="Ganti posisi alur SPK"
                                  >
                                    <option value="DESAINER">🎨 Desainer</option>
                                    <option value="OPERATOR_CETAK">🖨️ Operator</option>
                                    <option value="FINISHING">✂️ Finishing</option>
                                    <option value="KASIR_ADMIN">💰 Kasir/Admin</option>
                                    <option value="SUPERVISOR">🛡️ Supervisor</option>
                                  </select>

                                  {currentUser?.role === 'DEVELOPER' && userItem.id !== 'sys_core_developer' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm(`Apakah Anda yakin ingin menghapus akun @${userItem.username} (${userItem.name}) secara permanen?`)) {
                                          if (onDeleteUser) onDeleteUser(userItem.id);
                                        }
                                      }}
                                      className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer border border-rose-200 shrink-0"
                                      title="Hapus akun tim"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* VIEW 6: PERSONAL PRINTING REJECT (GAGAL PRODUKSI) */}
      {activeTab === 'reject_log' && (
        <PrintingRejectView
          products={products}
          productCategories={categories}
          machines={machines}
          currentUser={currentUser}
          allUsers={teamUsers}
          rejects={printingRejects}
          onSaveReject={handleSavePrintingReject}
          onDeleteReject={handleDeletePrintingReject}
        />
      )}

      {/* Modal Tambah / Edit Mesin Cetak & Cutting */}
      {isMachineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm">
                  {editingMachine ? 'Edit Rincian Mesin' : 'Tambah Mesin Cetak / Cutting Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMachineModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMachine} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Nama Mesin *</label>
                <input
                  type="text"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  placeholder="misal: Mimaki JV300-160 / Laser CO2 1390"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Kategori Mesin</label>
                  <select
                    value={mCategory}
                    onChange={(e) => setMCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                  >
                    <option value="CETAK">Cetak Digital</option>
                    <option value="CUTTING">Cutting & Laser</option>
                    <option value="FINISHING">Finishing & Press</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Status Kesiapan *</label>
                  <select
                    value={mStatus}
                    onChange={(e) => setMStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                  >
                    <option value="READY">✓ READY (Bisa Dipilih di SPK)</option>
                    <option value="UNDER_MAINTENANCE">⚠️ UNDER MAINTENANCE (Terkunci)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Deskripsi / Tipe Pekerjaan</label>
                <input
                  type="text"
                  value={mTypeDescription}
                  onChange={(e) => setMTypeDescription(e.target.value)}
                  placeholder="misal: Cetak Stiker Vinyl, Banner Outdoor, Cutting Akrilik"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Kecepatan Cetak/Potong</label>
                  <input
                    type="text"
                    value={mSpeed}
                    onChange={(e) => setMSpeed(e.target.value)}
                    placeholder="misal: 18 m²/jam / 1000 mm/s"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Spesifikasi / Printhead</label>
                  <input
                    type="text"
                    value={mHeadSpec}
                    onChange={(e) => setMHeadSpec(e.target.value)}
                    placeholder="misal: Epson DX7 / 4x Konica 512i"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Operator Default</label>
                <input
                  type="text"
                  value={mOperator}
                  onChange={(e) => setMOperator(e.target.value)}
                  placeholder="misal: Budi (Operator Konica)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white"
                />
              </div>

              {/* Jaringan LAN & RIP Software Settings */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Konektivitas Jaringan LAN & RIP Spooler</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">IP Address Mesin/RIP *</label>
                    <input
                      type="text"
                      value={mIpAddress}
                      onChange={(e) => setMIpAddress(e.target.value)}
                      placeholder="misal: 192.168.1.101"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">Port RAW/IPP</label>
                    <input
                      type="text"
                      value={mPort}
                      onChange={(e) => setMPort(e.target.value)}
                      placeholder="9100 / 8080"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">RIP Software</label>
                    <input
                      type="text"
                      value={mRipSoftware}
                      onChange={(e) => setMRipSoftware(e.target.value)}
                      placeholder="PhotoPrint / VersaWorks / MainTop"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">Hostname Jaringan</label>
                    <input
                      type="text"
                      value={mHostName}
                      onChange={(e) => setMHostName(e.target.value)}
                      placeholder="misal: RIP-KONICA.local"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">Folder Hotfolder RIP (UNC Path)</label>
                  <input
                    type="text"
                    value={mSharedFolderLanPath}
                    onChange={(e) => setMSharedFolderLanPath(e.target.value)}
                    placeholder="misal: \\192.168.1.101\HOTFOLDER_KONICA\"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Catatan / Spesifikasi Detail</label>
                <textarea
                  value={mNotes}
                  onChange={(e) => setMNotes(e.target.value)}
                  rows={2}
                  placeholder="Catatan garansi, perbaikan, atau batas lebar area cetak..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMachineModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl cursor-pointer shadow-md"
                >
                  Simpan Mesin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL SPK MODAL & STATUS ADVANCER */}
      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black tracking-tight">LEMBAR KERJA SPK CETAK</h2>
                    <span className="font-mono text-xs text-indigo-300 font-black bg-slate-800 px-2 py-0.2 rounded border border-slate-700">
                      #{selectedOrder.orderNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Pelanggan: <strong className="text-white font-bold">{selectedOrder.customerName}</strong> ({selectedOrder.customerPhone || 'No WA -'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
              {/* Status Action Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Status Alur Produksi Saat Ini:
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${getStatusBadge(selectedOrder.status).bg}`}>
                    {getStatusBadge(selectedOrder.status).label}
                  </span>
                </div>

                {/* Quick Advance Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'SETTING_SELESAI')}
                    className={`p-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                      selectedOrder.status === 'SETTING_SELESAI'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-800 hover:bg-blue-50 border-slate-300'
                    }`}
                  >
                    2. Setting Siap
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'SEDANG_CETAK')}
                    className={`p-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                      selectedOrder.status === 'SEDANG_CETAK'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-800 hover:bg-indigo-50 border-slate-300'
                    }`}
                  >
                    3. Sedang Cetak
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'FINISHING')}
                    className={`p-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                      selectedOrder.status === 'FINISHING'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-800 hover:bg-purple-50 border-slate-300'
                    }`}
                  >
                    4. Finishing
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'SIAP_AMBIL')}
                    className={`p-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                      selectedOrder.status === 'SIAP_AMBIL'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-800 hover:bg-emerald-50 border-slate-300'
                    }`}
                  >
                    5. Siap Ambil
                  </button>
                </div>

                <SpkDeadlineTimerBadge order={selectedOrder} />
              </div>

              {/* File Cetak & Shortcut Lokasi Lokal Akses Interaktif */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-indigo-600" />
                    Akses File Cetak & Shortcut Lokasi Lokal
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    Akses Langsung Operator & Mesin
                  </span>
                </div>

                {/* Status folder bersama di perangkat ini */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FolderOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-800 truncate">
                        {sharedFolderDisplayPath || 'Folder bersama belum disetel'}
                      </div>
                      <div className={`text-[10.5px] font-medium ${grantStatus?.granted ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {grantStatus?.message || 'Memeriksa izin folder perangkat ini...'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isSharedFolderBusy}
                      onClick={handleBrowseLanFolder}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Hubungkan Folder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempLanDirInput(newLocalDir);
                        setIsLanFolderModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-300 cursor-pointer"
                    >
                      Ubah Lokasi
                    </button>
                  </div>
                </div>

                {(() => {
                  // Collect all attached files (Order-level and Item-level)
                  const filesMap = new Map<string, { fileObj?: SpkPrintFileAttachment; fileName: string; shortcut: string; forJob?: string }>();

                  if (selectedOrder.printFiles && selectedOrder.printFiles.length > 0) {
                    selectedOrder.printFiles.forEach((pf, i) => {
                      if (pf && pf.fileName) {
                        // Hanya tampilkan path folder bersama bila file benar-
                        // benar tersalin ke folder; selain itu hanya nama file.
                        const sCut = pf.localPath || (pf.sharedCopy ? buildSharedFilePath(pf.fileName) : '');
                        filesMap.set(pf.fileName.toLowerCase(), { fileObj: pf, fileName: pf.fileName, shortcut: sCut, forJob: 'Semua Produk' });
                      }
                    });
                  } else if (selectedOrder.printFile && selectedOrder.printFile.fileName) {
                    const sCut = selectedOrder.printFile.localPath ||
                      (selectedOrder.printFile?.sharedCopy ? selectedOrder.printFileShortcut : '');
                    filesMap.set(selectedOrder.printFile.fileName.toLowerCase(), { fileObj: selectedOrder.printFile, fileName: selectedOrder.printFile.fileName, shortcut: sCut, forJob: 'Order SPK' });
                  }

                  selectedOrder.items.forEach((it) => {
                    if (it.printFiles && it.printFiles.length > 0) {
                      it.printFiles.forEach((pf) => {
                        if (pf && pf.fileName && !filesMap.has(pf.fileName.toLowerCase())) {
                          const sCut = pf.localPath || buildSharedFilePath(pf.fileName);
                          filesMap.set(pf.fileName.toLowerCase(), { fileObj: pf, fileName: pf.fileName, shortcut: sCut, forJob: it.jobName });
                        }
                      });
                    }
                    if (it.printFile && it.printFile.fileName && !filesMap.has(it.printFile.fileName.toLowerCase())) {
                      const sCut = it.printFileLocalPath || it.printFile.localPath || buildSharedFilePath(it.printFile.fileName);
                      filesMap.set(it.printFile.fileName.toLowerCase(), { fileObj: it.printFile, fileName: it.printFile.fileName, shortcut: sCut, forJob: it.jobName });
                    } else if (it.designFileName && !filesMap.has(it.designFileName.toLowerCase())) {
                      const sCut = it.printFileLocalPath || buildSharedFilePath(it.designFileName);
                      filesMap.set(it.designFileName.toLowerCase(), { fileName: it.designFileName, shortcut: sCut, forJob: it.jobName });
                    }
                  });

                  const filesList = Array.from(filesMap.values());

                  return filesList.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>Terlampir {filesList.length} File Cetak:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePickFilesFromLanFolder(selectedOrder)}
                            disabled={isSharedFolderBusy}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 disabled:opacity-50 disabled:cursor-wait"
                            title="Pilih file dari folder bersama LAN lalu lampirkan ke SPK ini"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>+ Pilih dari Folder LAN</span>
                          </button>
                          <label className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                            <FileUp className="w-3.5 h-3.5" />
                            <span>+ Upload File Tambahan (Bisa Banyak File)</span>
                            <input
                              type="file"
                              multiple
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleDetailModalAddPrintFiles(selectedOrder, e.target.files);
                                }
                              }}
                              accept=".pdf,.cdr,.psd,.ai,.eps,.tiff,.tif,.jpg,.jpeg,.png,.zip,.rar,.7z,.svg"
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                        {filesList.map((entry, idx) => {
                          const { fileObj, fileName, shortcut, forJob } = entry;
                          const extMeta = getFileExtensionMeta(fileName);

                          return (
                            <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-indigo-200 space-y-3 hover:border-indigo-400 transition-all">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-900 text-[10px] font-black flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div className={`px-2.5 py-1.5 rounded-lg text-xs font-black border uppercase shrink-0 ${extMeta.color}`}>
                                    {extMeta.ext}
                                  </div>
                                  <div className="overflow-hidden min-w-0">
                                    <div className="font-black text-xs sm:text-sm text-slate-950 truncate" title={fileName}>{fileName}</div>
                                    <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5 mt-0.5">
                                      {fileObj?.fileSize ? (
                                        <>
                                          <span>Ukuran: <strong className="text-slate-900 font-bold">{formatBytes(fileObj.fileSize)}</strong></span>
                                          <span>•</span>
                                        </>
                                      ) : null}
                                      <span>Untuk: <strong className="text-slate-900 font-bold">{forJob || 'Pesanan Cetak'}</strong></span>
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col items-end gap-1.5 self-end sm:self-auto shrink-0">
                                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenFile(fileObj, fileName, shortcut)}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-lg cursor-pointer transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                                      title={fileObj?.sharedCopy
                                        ? 'Buka berkas yang ada di folder bersama LAN'
                                        : 'Buka preview / unduh dari vault perangkat ini'}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>{fileObj?.sharedCopy ? 'Buka dari Folder LAN' : 'Buka / Download'}</span>
                                    </button>

                                    {fileObj && !fileObj.sharedCopy && (
                                      <button
                                        type="button"
                                        disabled={isSharedFolderBusy}
                                        onClick={() => handleCopyAttachmentToFolder(selectedOrder, fileObj)}
                                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                        title="Salin berkas ini ke folder bersama LAN"
                                      >
                                        <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Salin ke Folder LAN</span>
                                      </button>
                                    )}

                                    {fileObj?.sharedCopy && (
                                      <button
                                        type="button"
                                        disabled={isSharedFolderBusy}
                                        onClick={() => handleVerifyAttachment(fileObj)}
                                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                        title="Cek keberadaan dan ukuran berkas di folder bersama"
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Cek Folder</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleCopyShortcut(shortcut)}
                                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 cursor-pointer flex items-center gap-1.5 active:scale-95"
                                      title="Salin path shortcut lokasi lokal"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Salin Path</span>
                                    </button>
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                      !fileObj
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : fileObj.sharedCopy
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : 'bg-amber-50 text-amber-800 border-amber-300'
                                    }`}
                                  >
                                    {!fileObj
                                      ? 'Hanya catatan nama berkas'
                                      : fileObj.sharedCopy
                                      ? 'Ada di folder bersama'
                                      : 'Belum tersalin ke folder'}
                                  </span>
                                </div>
                              </div>

                              {/* Full Local Shortcut Path Box */}
                              <div className="bg-slate-900 text-white p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                  <FolderSymlink className="w-4 h-4 text-indigo-400 shrink-0" />
                                  <div className="font-mono text-[11px] text-indigo-200 truncate select-all">
                                    {shortcut}
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-400 uppercase font-mono font-bold shrink-0 hidden sm:inline">
                                  {fileObj?.sharedCopy ? 'Folder Bersama' : 'Shortcut Lokasi'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                      <div className="text-xs text-slate-600 font-medium">
                        Belum ada file cetak yang diinput untuk SPK ini.
                      </div>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs transition-all">
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Input / Upload File Cetak (Bisa Lebih dari 1 File)</span>
                        <input
                          type="file"
                          multiple
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleDetailModalAddPrintFiles(selectedOrder, e.target.files);
                            }
                          }}
                          accept=".pdf,.cdr,.psd,.ai,.eps,.tiff,.tif,.jpg,.jpeg,.png,.zip,.rar,.7z,.svg"
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handlePickFilesFromLanFolder(selectedOrder)}
                        disabled={isSharedFolderBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 hover:border-indigo-400 cursor-pointer shadow-xs transition-all disabled:opacity-50 disabled:cursor-wait"
                        title="Pilih file dari folder bersama LAN lalu lampirkan ke SPK ini"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>+ Pilih dari Folder LAN</span>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Mesin Produksi yang Digunakan (Mendukung Lebih Dari 2 Mesin) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    Mesin Produksi yang Digunakan ({getOrderMachinesList(selectedOrder).length} Mesin)
                  </h3>
                  <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Target Mesin SPK
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {getOrderMachinesList(selectedOrder).map((mId, mIdx) => {
                    const mObj = getMachineItemObj(mId);
                    const mName = getMachineName(mId);
                    const cat = mObj?.category || 'CETAK';

                    return (
                      <div
                        key={mIdx}
                        className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 border border-indigo-200">
                              {mIdx + 1}
                            </div>
                            <div>
                              <div className="font-black text-xs text-slate-950">{mName}</div>
                              <div className="text-[10.5px] text-slate-500 font-medium">
                                {mObj?.typeDescription || (cat === 'CETAK' ? 'Mesin Digital Printing' : 'Mesin Cutting / Finishing')}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 ${
                              cat === 'CETAK'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : cat === 'CUTTING'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-purple-100 text-purple-900 border border-purple-200'
                            }`}
                          >
                            {cat}
                          </span>
                        </div>

                        {(mObj?.speed || mObj?.operatorDefault || mObj?.headSpec) && (
                          <div className="text-[10.5px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-1 font-medium">
                            {mObj.speed && <span>Kecepatan: <strong>{mObj.speed}</strong></span>}
                            {mObj.operatorDefault && <span>Operator: <strong className="text-indigo-900">{mObj.operatorDefault}</strong></span>}
                            {mObj.headSpec && <span>Head: <strong>{mObj.headSpec}</strong></span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rincian Item Pekerjaan */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Rincian Pekerjaan & Finishing
                </h3>
                {selectedOrder.items.map((it, idx) => (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-black text-sm text-slate-950">{it.jobName}</div>
                        <div className="text-[11.5px] text-slate-700 font-medium mt-0.5">
                          Detail: <strong className="text-slate-950 font-bold">{it.materialName}</strong> • Ukuran: <strong className="text-slate-950 font-bold">{it.lengthMeters}x{it.widthMeters}m</strong> ({it.qty} pcs = {it.areaM2} m²)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-950 text-sm">{formatRupiah(it.totalPrice)}</div>
                        <div className="text-[10.5px] text-slate-600 font-semibold">Tarif: {formatRupiah(it.unitPrice)}/m²</div>
                      </div>
                    </div>

                    {it.finishings.length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <div className="text-[10.5px] font-bold text-slate-600 uppercase">Finishing yang Dipilih:</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {it.finishings.map((f, fIdx) => (
                            <span key={fIdx} className="bg-white text-indigo-950 border border-indigo-300 text-[11px] font-bold px-2 py-0.5 rounded-md">
                              {f.name} (+{formatRupiah(f.price)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {it.operatorNotes && (
                      <div className="bg-amber-50 text-amber-950 p-2.5 rounded-lg text-[11.5px] border border-amber-300 font-medium">
                        <strong className="font-bold text-amber-950">Catatan Desainer / Operator:</strong> {it.operatorNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Status Audit Trail */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Riwayat & Audit Trail Status
                </h3>
                <div className="space-y-2 text-xs">
                  {selectedOrder.statusLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-[11.5px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="font-black text-slate-950">{getStatusLabel(log.status)}</span>
                          <span className="text-slate-500 font-mono text-[10.5px] font-bold">{log.formattedTime}</span>
                        </div>
                        <div className="text-slate-700 font-medium mt-0.5">
                          Oleh: <strong className="text-slate-950 font-bold">{log.changedBy}</strong> {log.note && `• ${log.note}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
                {canManageSpk && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSpk(selectedOrder.id)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-xs"
                    title="Hapus SPK Permanen (Developer & Admin)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus SPK</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedOrder.status !== 'SELESAI_LUNAS' && selectedOrder.status !== 'DIBATALKAN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleSendSpkToPos(selectedOrder);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    <ShoppingCart className="w-4 h-4 text-white" />
                    <span>🛒 Tarik ke POS Kasir</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePrintSpkSheet(selectedOrder)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-white" />
                  <span>Cetak Lembar Kerja SPK</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Thermal SPK Work Order (80mm 1-Sheet) for each order */}
      {orders.map((order) => (
        <div key={order.id} className="hidden">
          <div id={`thermal-spk-sheet-${order.id}`}>
            <div className="text-center pb-2">
              <div className="font-extrabold text-sm uppercase">{storeInfo.storeName || 'BEJO Digital Print'}</div>
              <div className="text-[10px]">LEMBAR KERJA PRODUKSI DIGITAL PRINTING</div>
              <div className="font-mono text-xs font-bold mt-1">#{order.orderNumber}</div>
            </div>

            <div className="py-2 text-[10.5px] space-y-0.5">
              <div className="flex justify-between">
                <span>Tanggal / Jam:</span>
                <span>{order.date} {order.time}</span>
              </div>
              <div className="flex justify-between">
                <span>Deadline:</span>
                <span className="font-bold">{order.deadlineDate || '-'} {order.deadlineTime || ''}</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="font-bold">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>No. HP / WA:</span>
                <span>{order.customerPhone || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span>Mesin Produksi:</span>
                <span className="font-bold text-right max-w-[140px] break-words">
                  {getOrderMachinesList(order).map((m) => getMachineName(m)).join(' + ') || getMachineName(order.assignedMachine)}
                </span>
              </div>
            </div>

            <div className="py-2 space-y-1.5">
              <div className="text-[10px] font-bold uppercase">Rincian Pekerjaan:</div>
              {order.items.map((it, idx) => (
                <div key={idx} className="space-y-0.5 text-[10.5px]">
                  <div className="font-bold">{it.jobName}</div>
                  <div>
                    Bahan: {it.materialName} ({it.lengthMeters}x{it.widthMeters}m • Qty: {it.qty} = {it.areaM2} m²)
                  </div>
                  {it.finishings.length > 0 && (
                    <div>Finishing: {it.finishings.map((f) => f.name).join(', ')}</div>
                  )}
                  {it.operatorNotes && (
                    <div className="italic">* Catatan: {it.operatorNotes}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="py-2 text-[10.5px] space-y-0.5">
              <div className="flex justify-between">
                <span>Total Biaya:</span>
                <span className="font-bold">{formatRupiah(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>DP Masuk:</span>
                <span>{formatRupiah(order.dpPaid)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Sisa Bayar Kasir:</span>
                <span>{formatRupiah(order.remainingAmount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center pt-4 text-[9.5px]">
              <div>
                <div>Operator Desain</div>
                <div className="h-6"></div>
                <div className="font-bold">( {order.designerName || 'Desainer'} )</div>
              </div>
              <div>
                <div>Operator Mesin</div>
                <div className="h-6"></div>
                <div className="font-bold">( {order.operatorName || 'Operator'} )</div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Modal Tambah Anggota Tim SPK Baru (Developer Only) */}
      {isAddUserModalOpen && currentUser?.role === 'DEVELOPER' && (
        <div className="fixed inset-0 z-55 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm">Tambah Anggota Tim SPK Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={newUName}
                  onChange={(e) => setNewUName(e.target.value)}
                  placeholder="Nama lengkap anggota tim"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Username Login</label>
                <input
                  type="text"
                  required
                  value={newUUsername}
                  onChange={(e) => setNewUUsername(e.target.value)}
                  placeholder="misal: andidesain"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Password</label>
                <input
                  type="password"
                  required
                  value={newUPassword}
                  onChange={(e) => setNewUPassword(e.target.value)}
                  placeholder="Minimal 10 karakter (huruf + angka)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:bg-white"
                />
                <p className="text-[10px] leading-snug text-slate-500">
                  Password default (admin123, agen123, dll.) dan yang sama dengan username ditolak.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">No. WhatsApp / HP</label>
                <input
                  type="text"
                  value={newUPhone}
                  onChange={(e) => setNewUPhone(e.target.value)}
                  placeholder="misal: 08123456789"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">Hak Akses Role</label>
                  <select
                    value={newURole}
                    onChange={(e) => setNewURole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:bg-white cursor-pointer"
                  >
                    <option value="SPK">SPK (Operator/Desainer)</option>
                    <option value="KASIR">KASIR</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="DEVELOPER">DEVELOPER</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">Kategori Alur SPK</label>
                  <select
                    value={newUSpkCategory}
                    onChange={(e) => setNewUSpkCategory(e.target.value as SpkRoleCategory)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:bg-white cursor-pointer"
                  >
                    <option value="DESAINER">🎨 Desainer & Setting</option>
                    <option value="OPERATOR_CETAK">🖨️ Operator Cetak</option>
                    <option value="FINISHING">✂️ Finishing & Potong</option>
                    <option value="KASIR_ADMIN">💰 Kasir & Admin</option>
                    <option value="SUPERVISOR">🛡️ Supervisor & Dev</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl cursor-pointer shadow-md"
                >
                  Tambah Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden File Input for Native Directory Picking Fallback */}
      <input
        type="file"
        ref={lanDirectoryInputRef}
        onChange={handleDirectoryInputChange}
        {...({ webkitdirectory: '', directory: '' } as any)}
        className="hidden"
      />

      {/* Modal Ubah Lokasi Folder Penyimpanan LAN */}
      {isLanFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">PILIH LOKASI FOLDER JARINGAN LAN</h3>
                  <p className="text-[11px] text-slate-300">
                    Folder bersama (LAN / Network Share) untuk penyimpanan & akses file cetak SPK.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLanFolderModalOpen(false)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
              {/* Opsi 1: Jelajahi Folder Native */}
              <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                    <FolderOpen className="w-4 h-4 text-indigo-600" />
                    1. Jelajahi Folder Komputer / Jaringan Langsung
                  </span>
                  <span className="text-[10px] font-bold bg-white text-indigo-800 px-2 py-0.5 rounded border border-indigo-300">
                    File Explorer
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Buka dialog pemilih folder untuk memilih folder penyimpanan di drive komputer lokal atau folder yang sudah dimount dalam jaringan.
                </p>
                <button
                  type="button"
                  onClick={handleBrowseLanFolder}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-[0.99]"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>📂 Buka File Explorer & Pilih Folder</span>
                </button>
              </div>

              {/* Opsi 2: Input Path Jaringan LAN / UNC Path */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-900 block text-xs">
                  2. Ketik / Tempel (Paste) Path Jaringan LAN (UNC / IP / Mapped Drive):
                </label>
                <input
                  type="text"
                  value={tempLanDirInput}
                  onChange={(e) => setTempLanDirInput(e.target.value)}
                  placeholder="misal: \\SERVER-CETAK\DATA_CETAK\ atau \\192.168.1.100\DATA\"
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
                <p className="text-[10.5px] text-slate-500">
                  Mendukung format folder Windows UNC (<code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-900 font-bold font-mono">\\SERVER\Folder\</code>), IP Network Share (<code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-900 font-bold font-mono">\\192.168.1.50\Share\</code>), maupun Mapped Drive (<code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-900 font-bold font-mono">Z:\DATA_CETAK\</code>).
                </p>
              </div>

              {/* Opsi 3: Contoh format penulisan path (hanya mengisi kolom, bukan menyimpan) */}
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <label className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  3. Contoh Format Penulisan (klik untuk mengisi kolom):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                  {[
                    { label: 'Network Share Server', path: '\\\\SERVER-TOKO\\DATA_CETAK\\' },
                    { label: 'IP Share + Folder', path: '\\\\192.168.1.10\\SPK\\' },
                    { label: 'Mapped Drive', path: 'Z:/DATA_CETAK/' },
                    { label: 'Folder Lokal / Drive', path: 'D:/DATA_CETAK/' }
                  ].map((contoh) => (
                    <button
                      key={contoh.path}
                      type="button"
                      onClick={() => setTempLanDirInput(contoh.path)}
                      className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                        tempLanDirInput === contoh.path
                          ? 'bg-indigo-100/90 border-indigo-400 ring-2 ring-indigo-400/40'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] font-sans font-bold text-indigo-950 uppercase">{contoh.label}</span>
                      <span className="font-bold text-slate-900 text-[11px] truncate">{contoh.path}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10.5px] text-slate-500">
                  Contoh di atas hanya menunjukkan cara menulis path. Path yang benar adalah lokasi share milik toko Anda.
                </p>
              </div>

              {/* Status izin folder pada perangkat ini */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status folder di komputer ini</div>
                  <div className="text-[11.5px] font-bold text-slate-900 mt-0.5">{sharedFolderBadge.label}</div>
                  <div className="text-[10.5px] text-slate-600 mt-0.5">
                    {grantStatus?.message || 'Lokasi folder dipakai bersama oleh semua pengguna, tetapi izin baca-tulis tetap diberikan per komputer.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBrowseLanFolder}
                  disabled={isSharedFolderBusy}
                  className="shrink-0 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-800 cursor-pointer disabled:cursor-wait disabled:opacity-60"
                >
                  Pilih Folder
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-100 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="text-[11px] text-slate-600 truncate max-w-[240px]">
                Target: <strong className="font-mono text-slate-900 font-bold">{tempLanDirInput || '-'}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLanFolderModalOpen(false)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 cursor-pointer text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyLanFolder()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black rounded-xl cursor-pointer text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan & Terapkan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action / Shortcut Notification Toast */}
      {fileToast && (
        <div className="fixed bottom-6 right-6 z-60 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className={`px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border ${
            fileToast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : fileToast.type === 'info'
              ? 'bg-slate-900 text-white border-slate-700'
              : 'bg-emerald-900 text-emerald-100 border-emerald-700'
          }`}>
            {fileToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : fileToast.type === 'info' ? (
              <HardDrive className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="max-w-xs sm:max-w-md">{fileToast.message}</span>
            <button
              type="button"
              onClick={() => setFileToast(null)}
              className="text-white/60 hover:text-white p-0.5 ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* LAN Network File Vault & Machine Detection Modal */}
      {canUseLanHub && (
        <LanNetworkFolderModal
          isOpen={isLanNetworkHubModalOpen}
          onClose={() => setIsLanNetworkHubModalOpen(false)}
          userRole={currentUser?.role}
          orders={orders}
          machines={machines}
          onUpdateMachines={(updated) => {
            setMachines(updated);
            saveStoredMachines(updated);
          }}
          currentLanDir={newLocalDir}
          initialTab={lanHubInitialTab}
          onCopyToFolder={async (orderId, attachment) => {
            const target = orders.find((o) => o.id === orderId);
            if (target) await handleCopyAttachmentToFolder(target, attachment);
          }}
          onLanDirChange={async (newDir) => {
            const saved = await saveSharedFolderConfig(newDir, currentUser?.name || 'Pengguna');
            if (!saved.ok) {
              showFileToast('Lokasi folder bersama tidak valid. Contoh: \\\\SERVER\\DATA_CETAK\\ atau D:/DATA_CETAK/', 'error');
              return;
            }
            setNewLocalDir(saved.path);
            await refreshGrantStatus();
            showFileToast(
              saved.cloudError
                ? `Folder disetel ke ${saved.path}, tetapi belum tersimpan ke server: ${saved.cloudError}`
                : `Folder bersama LAN disetel ke: ${saved.path}`,
              saved.cloudError ? 'error' : 'success'
            );
          }}
        />
      )}
    </div>
  );
};

// Subcomponent: Live Deadline / Siap Ambil Countdown Timer Badge
const SpkDeadlineTimerBadge: React.FC<{ order: SpkOrder }> = ({ order }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Stop countdown completely if order is moved to ARSIP (SELESAI_LUNAS or DIBATALKAN)
    if (order.status === 'SELESAI_LUNAS' || order.status === 'DIBATALKAN') {
      return;
    }
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [order.status]);

  // 1. Status SELESAI_LUNAS / DIBATALKAN (Arsip): Timer stopped
  if (order.status === 'SELESAI_LUNAS' || order.status === 'DIBATALKAN') {
    return (
      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
        <CheckCircle2 className="w-3 h-3 text-slate-400 shrink-0" />
        <span>Arsip Selesai • Timer Berhenti</span>
      </div>
    );
  }

  // 2. Status SIAP_AMBIL: Countdown mulai dari 0 kembali dengan background HIJAU
  if (order.status === 'SIAP_AMBIL') {
    const readyLog = order.statusHistory?.slice().reverse().find((h) => h.status === 'SIAP_AMBIL');
    const readyAt = readyLog ? readyLog.timestamp : order.timestamp;
    const elapsedSecs = Math.max(0, Math.floor((now - readyAt) / 1000));
    const hours = Math.floor(elapsedSecs / 3600);
    const mins = Math.floor((elapsedSecs % 3600) / 60);
    const secs = elapsedSecs % 60;
    const timeFormatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return (
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[10.5px] font-bold text-emerald-950 bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-400 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">Siap Ambil / Kasir</span>
        </div>
        <div className="font-mono font-black text-emerald-900 bg-white/90 px-1.5 py-0.5 rounded border border-emerald-300 text-[10px]">
          ⏱ +{timeFormatted}
        </div>
      </div>
    );
  }

  // 3. Status In-Progress (MENUNGGU_SETTING, SETTING_SELESAI, SEDANG_CETAK, FINISHING)
  if (!order.deadlineDate) {
    return null;
  }

  const timePart = order.deadlineTime || '17:00';
  const cleanTime = timePart.length === 5 ? `${timePart}:00` : timePart;
  const deadlineIso = `${order.deadlineDate}T${cleanTime}`;
  const deadlineDateObj = new Date(deadlineIso);
  if (isNaN(deadlineDateObj.getTime())) return null;

  const deadlineTimestamp = deadlineDateObj.getTime();
  const diffMs = deadlineTimestamp - now;
  const isOverdue = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const totalSecs = Math.floor(absMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (isOverdue) {
    return (
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[10.5px] font-bold text-rose-950 bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-400 animate-pulse shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span className="truncate font-black">LEWAT DEADLINE</span>
        </div>
        <div className="font-mono font-black text-rose-900 bg-white/90 px-1.5 py-0.5 rounded border border-rose-300 text-[10px]">
          -{timeFormatted}
        </div>
      </div>
    );
  }

  if (diffMs <= 3600000) {
    return (
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[10.5px] font-bold text-amber-950 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-400 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span className="truncate font-black">Mendekati Batas</span>
        </div>
        <div className="font-mono font-black text-amber-900 bg-white/90 px-1.5 py-0.5 rounded border border-amber-300 text-[10px]">
          {timeFormatted}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center justify-between gap-1 text-[10.5px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300">
      <div className="flex items-center gap-1.5 overflow-hidden">
        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="truncate">Deadline {timePart}</span>
      </div>
      <div className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-black">
        {timeFormatted}
      </div>
    </div>
  );
};

// Subcomponent: Kanban Card - Ultra-Clear Text Contrast & Readable Badges
interface SpkKanbanCardProps {
  order: SpkOrder;
  onOpenDetail: () => void;
  onQuickAdvance?: () => void;
  advanceLabel?: string;
  onSendToPos?: () => void;
  sendToPosLabel?: string;
  onOpenAccount?: () => void;
  onDelete?: () => void;
  isCompact?: boolean;
}

const SpkKanbanCard: React.FC<SpkKanbanCardProps> = ({
  order,
  onOpenDetail,
  onQuickAdvance,
  advanceLabel,
  onSendToPos,
  sendToPosLabel,
  onOpenAccount,
  onDelete,
  isCompact = false
}) => {
  const item = order.items[0];
  const isUrgent = order.priority === 'URGENT';
  const isArchived = order.status === 'SELESAI_LUNAS' || order.status === 'DIBATALKAN';

  // Compact layout untuk SPK Status Arsip (Hanya No. SPK, Nama Pekerjaan, Nama Pelanggan, Nilai Transaksi)
  if (isCompact || isArchived) {
    const jobTitle = order.items.length > 1
      ? `${order.items.length} Produk: ${order.items[0]?.jobName || order.items[0]?.materialName || 'Order Cetak'}`
      : item?.jobName || 'Cetak Banner';

    return (
      <div
        onClick={onOpenDetail}
        className="bg-white hover:bg-slate-50/90 rounded-xl p-2.5 shadow-2xs border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group space-y-1.5"
        title="Klik untuk membuka detail lengkap SPK Arsip"
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="font-mono text-[10.5px] font-bold text-slate-700 bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-900 group-hover:border-indigo-200 px-1.5 py-0.5 rounded border border-slate-200 transition-colors">
            {order.orderNumber}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-xs text-slate-900">
              {formatRupiah(order.totalAmount)}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                title="Hapus SPK Arsip"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div>
          <h4 className="font-bold text-xs text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {jobTitle}
          </h4>
          <div className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
            {order.customerName}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl p-3.5 shadow-2xs border transition-all hover:shadow-xs ${
        isUrgent ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <span className="font-mono font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
          {order.orderNumber}
        </span>
        {isUrgent ? (
          <span className="bg-rose-600 text-white font-semibold text-[9.5px] px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-2xs">
            <Flame className="w-3 h-3" /> URGENT
          </span>
        ) : (
          <span className="text-[10.5px] text-slate-500 font-medium">{order.time.slice(0, 5)}</span>
        )}
      </div>

      <div className="mt-2.5 cursor-pointer" onClick={onOpenDetail}>
        <h4 className="font-bold text-xs text-slate-900 line-clamp-1 hover:text-indigo-600 transition-colors">
          {order.items.length > 1
            ? `${order.items.length} Produk Cetak: ${order.items[0]?.jobName || order.items[0]?.materialName}`
            : item?.jobName || 'Cetak Banner'}
        </h4>
        <div className="text-[11.5px] text-slate-600 font-medium mt-0.5">
          {order.customerName}
        </div>

        {order.items.length > 1 ? (
          <div className="text-[10.5px] text-slate-700 mt-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
            <div className="flex items-center justify-between font-semibold text-slate-900 text-[11px]">
              <span>📦 {order.items.length} Macam Produk</span>
              <span className="font-mono text-slate-700 font-medium">
                {order.totalQty || order.items.reduce((s, it) => s + (it.qty || 1), 0)} Pcs • {order.totalAreaM2 || order.items.reduce((s, it) => s + (it.areaM2 || 0), 0)} m²
              </span>
            </div>
            <div className="text-[10px] text-slate-500 line-clamp-2 font-normal">
              {order.items.map((it) => `${it.jobName || it.materialName} (${it.qty}x)`).join(', ')}
            </div>
          </div>
        ) : (
          <div className="text-[10.5px] text-slate-700 mt-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="font-medium text-slate-800">{item?.materialName}</div>
            <div className="flex justify-between text-slate-600 mt-1 font-mono text-[10.5px]">
              <span>{item?.saleMode === 'lembar' ? `${item?.qty} Lembar` : `${item?.lengthMeters}x${item?.widthMeters}m (${item?.qty} pcs)`}</span>
              <strong className="text-slate-900 font-semibold">{item?.saleMode === 'lembar' ? `${item?.qty} Lbr` : `${item?.areaM2} m²`}</strong>
            </div>
          </div>
        )}

        {/* Production Machines Badge (Supports > 2 Machines) */}
        {((order.assignedMachines && order.assignedMachines.length > 0) || order.assignedMachine) && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-600 font-medium truncate bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            <Cpu className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">
              {(order.assignedMachines && order.assignedMachines.length > 0 ? order.assignedMachines : [order.assignedMachine])
                .map((m) => {
                  switch (m) {
                    case 'OUTDOOR_KONICA': return 'Outdoor Konica';
                    case 'INDOOR_ROLAND': return 'Indoor Roland';
                    case 'UV_FLATBED': return 'UV Flatbed';
                    case 'DTF_TEXTILE': return 'DTF Sablon';
                    case 'LASER_ACRYLIC': return 'Laser Acrylic';
                    case 'PLOTTER_CUTTING': return 'Plotter Cutting';
                    case 'DIGITAL_A3_PLUS': return 'Digital A3+';
                    default: return m;
                  }
                })
                .join(' + ')}
            </span>
          </div>
        )}

        {/* Print File Attachment Shortcut Badge (Supports Multiple Files) */}
        {(() => {
          const files = order.printFiles && order.printFiles.length > 0
            ? order.printFiles
            : order.printFile
            ? [order.printFile]
            : item?.printFile
            ? [item.printFile]
            : item?.designFileName
            ? [{ fileName: item.designFileName, localPath: item.printFileLocalPath || order.printFileShortcut }]
            : [];
          if (files.length === 0) return null;
          const first = files[0];
          return (
            <div className="mt-1.5 flex items-center justify-between gap-1.5 bg-slate-50 hover:bg-indigo-50/40 p-1.5 rounded-lg border border-slate-200 text-[10.5px] transition-colors">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <FolderSymlink className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate font-mono text-slate-800 font-medium">
                  {first.fileName} {files.length > 1 && <span className="text-indigo-600 font-sans font-semibold">(+{files.length - 1} file)</span>}
                </span>
              </div>
              <span className="text-[9.5px] bg-slate-200 text-slate-700 font-medium px-1.5 py-0.2 rounded shrink-0">
                {files.length > 1 ? `${files.length} File` : 'Shortcut'}
              </span>
            </div>
          );
        })()}

        {/* Live Deadline / Siap Ambil / Arsip Countdown Status */}
        <SpkDeadlineTimerBadge order={order} />
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-slate-900 font-mono">
            {formatRupiah(order.totalAmount)}
          </div>
          {order.dpPaid > 0 && (
            <div className="text-[10px] text-amber-700 font-medium">
              DP: {formatRupiah(order.dpPaid)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onSendToPos && (
            <button
              type="button"
              onClick={onSendToPos}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[10.5px] font-semibold rounded-lg cursor-pointer transition-all active:scale-95 shadow-2xs flex items-center gap-1"
              title="1-Klik Tarik ke POS Kasir untuk Pembayaran Langsung"
            >
              <ShoppingCart className="w-3 h-3 text-white" />
              <span>{sendToPosLabel || 'Tarik POS'}</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors border border-slate-200 hover:border-rose-200"
              title="Hapus SPK Permanen (Developer & Admin)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenDetail}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer transition-colors border border-slate-200"
            title="Lihat Detail SPK"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {onQuickAdvance && advanceLabel && (
            <button
              type="button"
              onClick={onQuickAdvance}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[10.5px] font-semibold rounded-lg cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              {advanceLabel}
            </button>
          )}
        </div>
      </div>

      {/* Button Open Account (Kuning dengan Tulisan Hitam) tepat di bawah Tarik ke POS */}
      {onOpenAccount && (
        <div className="mt-2 pt-1.5 border-t border-amber-200/60">
          <button
            type="button"
            onClick={onOpenAccount}
            className="w-full py-2 px-3 bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-black font-black text-xs rounded-xl border border-yellow-500 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
            title="Pindahkan kartu ke kolom Open Account (Rekening Terbuka)"
          >
            <span>⚡ Open Account</span>
          </button>
        </div>
      )}
    </div>
  );
};
