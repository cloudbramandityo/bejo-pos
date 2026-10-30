/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Tag,
  Phone,
  Percent,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  History,
  Store,
  Type,
  Save,
  Building2,
  PhoneCall,
  MapPin,
  FileText,
  Info,
  Shield,
  Crown,
  ShoppingCart,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  AlertCircle,
  Lock,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  Check,
  Truck,
  Briefcase,
  HardDriveDownload,
  FileJson,
  Download,
  Server,
  Wrench,
  AlertTriangle,
  Activity,
  Sun,
  Moon,
  Palette,
  Plus,
  ArrowRight,
  Printer,
  Sliders,
  Zap,
  Scissors,
  QrCode
} from 'lucide-react';
import { Customer, CustomerCategory, Transaction, UserRole, AppUser, Supplier, Agent, StoreProfile, CustomRole, PrintSettings, StockTransaction, Product } from '../types';
import { formatRupiah } from '../utils/formatters';
import { StoreInfo, getStoredDefaultLogo, saveStoredDefaultLogo, clearStoredDefaultLogo, isDefaultCustomerCategory, DEFAULT_MASTER_STORE_PROFILE, getStoredPrintSettings, saveStoredPrintSettings, DEFAULT_PRINT_SETTINGS } from '../utils/storage';
import { downloadBackupJSON, validateBackupPayload, restoreBackupToStorage, restoreBackupToCloud, PosBackupPayload } from '../utils/backupUtils';
import { DeveloperJokerIcon } from './DeveloperJokerIcon';
import { StoreLogo } from './StoreLogo';
import { isReservedDeveloperUsername } from '../utils/authSecurity';
import { checkPasswordPolicy, checkTemporaryPassword, generateStrongPassword, isPasswordMasked } from '../utils/credentialPolicy';
import { runBackendAutoFix, triggerSimulatedBackendError } from '../utils/backendDiagnostics';
import { GoogleDriveUrlConverter } from './GoogleDriveUrlConverter';

interface CustomerScreenProps {
  customers: Customer[];
  suppliers: Supplier[];
  agents: Agent[];
  categories: CustomerCategory[];
  transactions: Transaction[];
  storeInfo: StoreInfo;
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onSaveAgent: (agent: Agent) => void;
  onDeleteAgent: (agentId: string) => void;
  onSaveCategory: (category: CustomerCategory) => void;
  onDeleteCategory: (categoryId: string) => void;
  onSaveStoreInfo: (storeInfo: StoreInfo) => void;
  storeProfiles?: StoreProfile[];
  activeProfileId?: string;
  onSaveStoreProfile?: (profile: StoreProfile) => void;
  onDeleteStoreProfile?: (profileId: string) => void;
  onSwitchStoreProfile?: (profileId: string) => void;
  userRole?: UserRole;
  users?: AppUser[];
  onSaveUser?: (user: AppUser) => void;
  onDeleteUser?: (userId: string) => void;
  customRoles?: CustomRole[];
  onSaveCustomRole?: (role: CustomRole) => void;
  onDeleteCustomRole?: (roleId: string) => void;
  onOpenBackendDiagnostics?: () => void;
  currentUserId?: string;
  stockTransactions?: StockTransaction[];
  products?: Product[];
  onSaveProduct?: (product: Product) => void;
}

export const CustomerScreen: React.FC<CustomerScreenProps> = ({
  customers,
  suppliers = [],
  agents = [],
  categories,
  transactions,
  storeInfo,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveSupplier,
  onDeleteSupplier,
  onSaveAgent,
  onDeleteAgent,
  onSaveCategory,
  onDeleteCategory,
  onSaveStoreInfo,
  storeProfiles = [DEFAULT_MASTER_STORE_PROFILE],
  activeProfileId = 'bejo_polsek',
  onSaveStoreProfile,
  onDeleteStoreProfile,
  onSwitchStoreProfile,
  userRole = 'DEVELOPER',
  users = [],
  onSaveUser,
  onDeleteUser,
  customRoles = [],
  onSaveCustomRole,
  onDeleteCustomRole,
  onOpenBackendDiagnostics,
  currentUserId,
  stockTransactions = [],
  products = [],
  onSaveProduct,
}) => {
  const isDeveloper = userRole === 'DEVELOPER';
  const isAdminOrDev = userRole === 'DEVELOPER' || userRole === 'ADMIN';
  const [isFixingBackend, setIsFixingBackend] = useState(false);
  const [quickFixMsg, setQuickFixMsg] = useState<string | null>(null);

  const handleQuickAutoFix = async () => {
    setIsFixingBackend(true);
    try {
      const res = await runBackendAutoFix();
      setQuickFixMsg(res.message);
      setTimeout(() => setQuickFixMsg(null), 4000);
    } finally {
      setIsFixingBackend(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'agents' | 'categories' | 'store' | 'printer' | 'users' | 'backup'>('customers');
  const [selectedAgentForHistory, setSelectedAgentForHistory] = useState<Agent | null>(null);

  // Print Settings State for Pengaturan Toko
  const [printSettingsForm, setPrintSettingsForm] = useState<PrintSettings>(() => getStoredPrintSettings());
  const [printerTabSubView, setPrinterTabSubView] = useState<'settings' | 'preview' | 'kiosk_guide'>('settings');
  const [printSettingsSavedToast, setPrintSettingsSavedToast] = useState(false);

  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      if (e.detail) {
        setPrintSettingsForm(e.detail);
      } else {
        setPrintSettingsForm(getStoredPrintSettings());
      }
    };
    window.addEventListener('bejo_print_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('bejo_print_settings_updated', handleSettingsUpdated);
  }, []);

  const handleSavePrintSettingsTab = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveStoredPrintSettings(printSettingsForm);
    setPrintSettingsSavedToast(true);
    setTimeout(() => setPrintSettingsSavedToast(false), 3000);
  };

  const handleResetPrintSettingsDefault = () => {
    if (window.confirm('Kembalikan semua pengaturan printer ke setelan rekomendasi POS 80mm?')) {
      const def = { ...DEFAULT_PRINT_SETTINGS };
      setPrintSettingsForm(def);
      saveStoredPrintSettings(def);
      setPrintSettingsSavedToast(true);
      setTimeout(() => setPrintSettingsSavedToast(false), 3000);
    }
  };

  const handleTestPrintFromTab = () => {
    saveStoredPrintSettings(printSettingsForm);
    setTimeout(() => {
      window.print();
    }, 150);
  };


  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Supplier Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supCategory, setSupCategory] = useState('');
  const [supNotes, setSupNotes] = useState('');
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);

  // Agent Modal State
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentContact, setAgentContact] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentAddress, setAgentAddress] = useState('');
  const [agentCommission, setAgentCommission] = useState('');
  const [agentNotes, setAgentNotes] = useState('');
  const [agentFormError, setAgentFormError] = useState<string | null>(null);

  const openAddAgent = () => {
    setEditingAgent(null);
    setAgentName('');
    setAgentContact('');
    setAgentPhone('');
    setAgentAddress('');
    setAgentCommission('');
    setAgentNotes('');
    setAgentFormError(null);
    setIsAgentModalOpen(true);
  };

  const openEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentName(agent.name);
    setAgentContact(agent.contactPerson || '');
    setAgentPhone(agent.phone);
    setAgentAddress(agent.address || '');
    setAgentCommission(agent.commissionRate || '');
    setAgentNotes(agent.notes || '');
    setAgentFormError(null);
    setIsAgentModalOpen(true);
  };

  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim() || !agentPhone.trim()) {
      setAgentFormError('Nama agen dan nomor WhatsApp wajib diisi.');
      return;
    }
    onSaveAgent({
      id: editingAgent ? editingAgent.id : '',
      name: agentName.trim(),
      contactPerson: agentContact.trim(),
      phone: agentPhone.trim(),
      address: agentAddress.trim(),
      commissionRate: agentCommission.trim(),
      notes: agentNotes.trim(),
      createdAt: editingAgent ? editingAgent.createdAt : undefined
    });
    setIsAgentModalOpen(false);
  };

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
    a.phone.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
    (a.commissionRate && a.commissionRate.toLowerCase().includes(agentSearchQuery.toLowerCase()))
  );

  const openAddSupplier = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupAddress('');
    setSupCategory('');
    setSupNotes('');
    setSupplierFormError(null);
    setIsSupplierModalOpen(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupName(supplier.name || '');
    setSupContact(supplier.contactPerson || '');
    setSupPhone(supplier.phone || '');
    setSupAddress(supplier.address || '');
    setSupCategory(supplier.category || '');
    setSupNotes(supplier.notes || '');
    setSupplierFormError(null);
    setIsSupplierModalOpen(true);
  };

  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      setSupplierFormError('Nama supplier wajib diisi.');
      return;
    }
    if (!supPhone.trim()) {
      setSupplierFormError('No. WhatsApp / Telepon supplier wajib diisi.');
      return;
    }

    const newSupplier: Supplier = {
      id: editingSupplier ? editingSupplier.id : 'sup_' + Date.now(),
      name: supName.trim(),
      contactPerson: supContact.trim(),
      phone: supPhone.trim(),
      address: supAddress.trim(),
      category: supCategory.trim(),
      notes: supNotes.trim(),
      createdAt: editingSupplier ? editingSupplier.createdAt : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    };

    onSaveSupplier(newSupplier);
    setIsSupplierModalOpen(false);
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = supplierSearchQuery.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.category || '').toLowerCase().includes(q) ||
      (s.contactPerson || '').toLowerCase().includes(q)
    );
  });

  // User Management State (for Developer)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [uUsername, setUUsername] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uName, setUName] = useState('');
  const [uRole, setURole] = useState<UserRole>('SPK');
  const [uPhone, setUPhone] = useState('');
  const [uIsActive, setUIsActive] = useState(true);
  const [uTemporaryPassword, setUTemporaryPassword] = useState(true);
  const [uFormNotice, setUFormNotice] = useState<string | null>(null);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUUsername('');
    setUPassword('');
    setUName('');
    setURole('SPK');
    setUPhone('');
    setUIsActive(true);
    setUTemporaryPassword(true);
    setUFormNotice(null);
    setShowModalPassword(false);
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  const openEditUser = (user: AppUser) => {
    setEditingUser(user);
    setUUsername(user.username);
    setUPassword(user.password || '');
    setUName(user.name);
    setURole(user.role);
    setUPhone(user.phone || '');
    setUIsActive(user.isActive !== false);
    setUTemporaryPassword(user.mustChangePassword === true);
    setUFormNotice(null);
    setShowModalPassword(false);
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  /** Reset password dari menu Hak Akses & Akun: password sementara + wajib ganti. */
  const openResetUserPassword = (user: AppUser) => {
    openEditUser(user);
    setUPassword(generateStrongPassword());
    setUTemporaryPassword(true);
    setShowModalPassword(true);
    setUFormNotice(
      'Password sementara sudah dibuat. Salin dan berikan ke pengguna; ia wajib menggantinya sendiri saat login.'
    );
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    const cleanUsername = uUsername.trim().toLowerCase();
    const cleanPassword = uPassword.trim();
    const cleanName = uName.trim();

    if (!cleanUsername) {
      setUserFormError('Username wajib diisi.');
      return;
    }
    if (!cleanPassword && !editingUser) {
      setUserFormError('Password wajib diisi untuk akun baru.');
      return;
    }
    if (!cleanName) {
      setUserFormError('Nama lengkap pengguna wajib diisi.');
      return;
    }

    // Protect reserved developer username
    if (isReservedDeveloperUsername(cleanUsername)) {
      setUserFormError('Username ini dicadangkan untuk sistem internal.');
      return;
    }

    // Check username duplicate
    const duplicate = users.find(
      (u) =>
        u.username.toLowerCase() === cleanUsername &&
        (!editingUser || u.id !== editingUser.id)
    );
    if (duplicate) {
      setUserFormError(`Username "${cleanUsername}" sudah digunakan oleh akun lain.`);
      return;
    }

    if (cleanPassword && !isPasswordMasked(cleanPassword)) {
      const passwordProblem = uTemporaryPassword
        ? checkTemporaryPassword(cleanPassword)
        : checkPasswordPolicy(cleanUsername, cleanPassword);
      if (passwordProblem) {
        setUserFormError(passwordProblem.message);
        return;
      }
    }

    const today = new Date();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dateFormatted = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

    const userObj: AppUser = {
      id: editingUser ? editingUser.id : `user_${Date.now()}`,
      username: cleanUsername,
      password: cleanPassword,
      name: cleanName,
      role: uRole === 'DEVELOPER' ? 'ADMIN' : uRole,
      phone: uPhone.trim() || undefined,
      isActive: uIsActive,
      createdAt: editingUser ? editingUser.createdAt : dateFormatted,
      avatarUrl: editingUser?.avatarUrl || '',
      mustChangePassword: uTemporaryPassword,
    };

    if (onSaveUser) {
      onSaveUser(userObj);
    }
    setIsUserModalOpen(false);
  };

  // Store profile & logo state
  const [storeForm, setStoreForm] = useState<StoreInfo>(storeInfo);
  const [storeSavedToast, setStoreSavedToast] = useState(false);
  const [logoUploadLoading, setLogoUploadLoading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoSuccessToast, setLogoSuccessToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-Store Profiles Management State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StoreProfile | null>(null);
  const [profStoreName, setProfStoreName] = useState('');
  const [profBranch, setProfBranch] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [profReceiptFooter, setProfReceiptFooter] = useState('');
  const [profNotes, setProfNotes] = useState('');
  const [profileFormError, setProfileFormError] = useState<string | null>(null);
  const [profileToast, setProfileToast] = useState<string | null>(null);

  // Custom User Roles States
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [roleFormError, setRoleFormError] = useState<string | null>(null);

  const openAddRoleModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setRoleFormError(null);
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role: CustomRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setRoleFormError(null);
    setIsRoleModalOpen(true);
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      setRoleFormError('Nama level hak akses wajib diisi.');
      return;
    }
    const roleId = editingRole ? editingRole.id : 'role_' + Date.now().toString(36);
    const updatedRole: CustomRole = {
      id: roleId,
      name: roleName.trim(),
      description: roleDescription.trim(),
      createdAt: editingRole?.createdAt || new Date().toLocaleDateString('id-ID')
    };

    if (onSaveCustomRole) {
      onSaveCustomRole(updatedRole);
    }
    setIsRoleModalOpen(false);
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setRoleFormError(null);
  };

  const handleDeleteRoleClick = (role: CustomRole) => {
    if (window.confirm(`Yakin ingin menghapus level hak akses "${role.name}"? Pengguna dengan hak akses ini akan beralih ke Kasir.`)) {
      if (onDeleteCustomRole) {
        onDeleteCustomRole(role.id);
      }
    }
  };

  const openAddProfileModal = () => {
    setEditingProfile(null);
    setProfStoreName('');
    setProfBranch('');
    setProfPhone('');
    setProfAddress('');
    setProfReceiptFooter('Jika terdapat kesalahan warna bahan atau harga harap segera menghubungi nomor toko. Terima kasih sudah berbelanja di toko kami.');
    setProfNotes('');
    setProfileFormError(null);
    setIsProfileModalOpen(true);
  };

  const openEditProfileModal = (profile: StoreProfile) => {
    setEditingProfile(profile);
    setProfStoreName(profile.storeName || '');
    setProfBranch(profile.branch || '');
    setProfPhone(profile.phone || '');
    setProfAddress(profile.address || '');
    setProfReceiptFooter(profile.receiptFooter || '');
    setProfNotes(profile.notes || '');
    setProfileFormError(null);
    setIsProfileModalOpen(true);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profStoreName.trim()) {
      setProfileFormError('Nama profil toko wajib diisi.');
      return;
    }

    const isMaster = editingProfile ? Boolean(editingProfile.isMaster || editingProfile.id === 'bejo_polsek') : false;
    const profId = editingProfile ? editingProfile.id : 'store_' + Date.now().toString(36);

    const updatedProfile: StoreProfile = {
      id: profId,
      storeName: profStoreName.trim(),
      branch: profBranch.trim(),
      phone: profPhone.trim(),
      address: profAddress.trim(),
      receiptFooter: profReceiptFooter.trim(),
      notes: profNotes.trim() || undefined,
      isMaster: isMaster,
      canModifyMasterProducts: isMaster,
      storeStatus: editingProfile?.storeStatus || 'ONLINE',
      logoUrl: editingProfile?.logoUrl || storeForm.logoUrl || '',
      createdAt: editingProfile?.createdAt || new Date().toISOString().slice(0, 10)
    };

    if (onSaveStoreProfile) {
      onSaveStoreProfile(updatedProfile);
    }
    setProfileToast(`Profil Toko "${updatedProfile.storeName}" berhasil disimpan!`);
    setTimeout(() => setProfileToast(null), 3500);
    setIsProfileModalOpen(false);
  };

  const handleSwitchProfileClick = (profileId: string) => {
    if (onSwitchStoreProfile) {
      onSwitchStoreProfile(profileId);
      const target = storeProfiles.find((p) => p.id === profileId);
      setProfileToast(`Berhasil beralih ke Profil Toko: "${target?.storeName || profileId}"`);
      setTimeout(() => setProfileToast(null), 3500);
    }
  };

  const handleDeleteProfileClick = (profile: StoreProfile) => {
    if (profile.isMaster || profile.id === 'bejo_polsek') {
      alert('Profil utama toko (BEJO Polsek) bersifat permanen dan tidak bisa dihapus.');
      return;
    }
    if (window.confirm(`Hapus Profil Toko "${profile.storeName}" dari daftar pilihan toko? Catatan transaksi yang sudah ada tidak ikut terhapus.`)) {
      if (onDeleteStoreProfile) {
        onDeleteStoreProfile(profile.id);
      }
      setProfileToast(`Profil Toko "${profile.storeName}" berhasil dihapus.`);
      setTimeout(() => setProfileToast(null), 3500);
    }
  };

  useEffect(() => {
    setStoreForm(storeInfo);
  }, [storeInfo]);

  const processAndSetLogo = (file: File) => {
    setLogoUploadError(null);
    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Format file harus berupa gambar (JPG, PNG, WEBP, atau SVG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError('Ukuran file maksimal 5 MB.');
      return;
    }

    setLogoUploadLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Resize to maximum 400x400 while preserving aspect ratio
          const maxDimension = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png', 0.92);
            
            // Set and save as permanent default logo across storage and store info
            saveStoredDefaultLogo(dataUrl);
            const updatedStoreInfo: StoreInfo = {
              ...storeForm,
              logoUrl: dataUrl
            };
            setStoreForm(updatedStoreInfo);
            onSaveStoreInfo(updatedStoreInfo);
            setLogoSuccessToast('Logo berhasil diunggah dan dijadikan Logo Default aplikasi.');
            setTimeout(() => setLogoSuccessToast(null), 4000);
          }
        } catch (err) {
          setLogoUploadError('Gagal memproses gambar logo.');
        } finally {
          setLogoUploadLoading(false);
        }
      };
      img.onerror = () => {
        setLogoUploadError('File gambar rusak atau tidak dapat dibaca.');
        setLogoUploadLoading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setLogoUploadError('Gagal membaca file gambar.');
      setLogoUploadLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndSetLogo(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleSetAsDefaultLogo = () => {
    if (storeForm.logoUrl) {
      saveStoredDefaultLogo(storeForm.logoUrl);
      onSaveStoreInfo({ ...storeForm, logoUrl: storeForm.logoUrl });
      setLogoSuccessToast('Logo ini ditetapkan sebagai Logo Default aplikasi.');
      setTimeout(() => setLogoSuccessToast(null), 3500);
    }
  };

  const handleResetLogo = () => {
    if (confirm('Kembalikan ke logo standar bawaan aplikasi?')) {
      clearStoredDefaultLogo();
      const updatedStoreInfo: StoreInfo = {
        ...storeForm,
        logoUrl: ''
      };
      setStoreForm(updatedStoreInfo);
      onSaveStoreInfo(updatedStoreInfo);
      setLogoSuccessToast('Logo toko berhasil dikembalikan ke logo standar bawaan.');
      setTimeout(() => setLogoSuccessToast(null), 3500);
    }
  };

  const handleSaveStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeForm.storeName.trim()) {
      alert('Nama toko wajib diisi.');
      return;
    }
    onSaveStoreInfo({
      storeName: storeForm.storeName.trim(),
      appTitle: (storeForm.appTitle || '').trim() || 'Point of Sales',
      branch: storeForm.branch.trim(),
      address: storeForm.address.trim(),
      phone: storeForm.phone.trim(),
      receiptFooter: storeForm.receiptFooter.trim(),
      logoUrl: storeForm.logoUrl || '',
      storeStatus: 'ONLINE'
    });
    setStoreSavedToast(true);
    setTimeout(() => setStoreSavedToast(false), 3000);
  };

  // Customer Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [cPhone, setCPhone] = useState('');
  const [cName, setCName] = useState('');
  const [cCategoryId, setCCategoryId] = useState(categories[0]?.id || '');
  const [cNotes, setCNotes] = useState('');

  // Backup & Restore state
  const [backupToastMsg, setBackupToastMsg] = useState<string | null>(null);
  const [restorePendingPayload, setRestorePendingPayload] = useState<PosBackupPayload | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');
  const [restoreProgressPercent, setRestoreProgressPercent] = useState(0);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = () => {
    try {
      const res = downloadBackupJSON(storeInfo?.name);
      setBackupToastMsg(`Cadangan berhasil diunduh (${res.fileName}). Isi: ${res.summary.totalProducts} produk, ${res.summary.totalCustomers} pelanggan, ${res.summary.totalTransactions} transaksi.`);
      setTimeout(() => setBackupToastMsg(null), 5000);
    } catch (e) {
      setBackupToastMsg('Gagal mengunduh berkas cadangan.');
      setTimeout(() => setBackupToastMsg(null), 5000);
    }
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const validation = validateBackupPayload(parsed);
        if (!validation.isValid || !validation.payload) {
          setRestorePendingPayload(null);
          setRestoreError(validation.error || 'Berkas cadangan tidak dikenali.');
          setIsRestoreModalOpen(true);
          return;
        }
        setRestorePendingPayload(validation.payload);
        setIsRestoreModalOpen(true);
      } catch (err) {
        setRestorePendingPayload(null);
        setRestoreError('Gagal membaca file. Pastikan yang dipilih berkas .json hasil cadangan aplikasi ini.');
        setIsRestoreModalOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restorePendingPayload || isRestoringBackup) return;

    setRestoreError(null);
    setIsRestoringBackup(true);
    setRestoreProgressPercent(0);
    setRestoreProgress('Memulihkan data ke perangkat ini...');

    try {
      const localSuccess = restoreBackupToStorage(restorePendingPayload);
      if (!localSuccess) {
        setRestoreError('Gagal memulihkan data ke perangkat ini.');
        return;
      }

      const cloudResult = await restoreBackupToCloud(restorePendingPayload, (progress) => {
        const percent = progress.overallTotal > 0
          ? Math.round((progress.overallProcessed / progress.overallTotal) * 100)
          : 100;
        setRestoreProgressPercent(percent);
        setRestoreProgress(`Mengirim ${progress.step} ke server (${progress.processed}/${progress.total})...`);
      });

      if (!cloudResult.success) {
        const detail = cloudResult.errors.length > 0 ? ` Detail: ${cloudResult.errors.slice(0, 3).join(' | ')}` : '';
        const adopted = cloudResult.skippedRecords > 0
          ? ` ${cloudResult.skippedRecords} data digabungkan ke akun server yang sudah ada.`
          : '';
        // Penolakan data tidak akan berubah walau diulang, jadi jangan sarankan
        // "Coba Lagi" untuk kasus itu.
        const hint = cloudResult.retryable
          ? ' Periksa koneksi internet lalu klik "Coba Lagi".'
          : ' Perbaiki data yang ditolak dulu; mengulang restore akan memberi hasil yang sama.';
        setRestoreError(
          `Data di perangkat ini berhasil dipulihkan, tetapi ${cloudResult.failedRecords} data gagal dikirim ke server.${detail}${adopted}${hint}`
        );
        return;
      }

      setRestoreProgressPercent(100);
      setRestoreProgress('Data terkirim ke server. Memuat ulang aplikasi...');
      setIsRestoreModalOpen(false);
      setRestorePendingPayload(null);
      const adoptedNote = cloudResult.skippedRecords > 0
        ? ` ${cloudResult.skippedRecords} data digabungkan ke akun yang sudah ada.`
        : '';
      setBackupToastMsg(`Restore berhasil: ${cloudResult.syncedRecords} data terkirim ke server.${adoptedNote} Memuat ulang aplikasi...`);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setRestoreError(`Gagal memulihkan data: ${err?.message || 'Terjadi kesalahan tidak terduga.'}`);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const closeRestoreModal = () => {
    if (isRestoringBackup) return;
    setIsRestoreModalOpen(false);
    setRestorePendingPayload(null);
    setRestoreError(null);
    setRestoreProgress('');
    setRestoreProgressPercent(0);
  };

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomerCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catDiscount, setCatDiscount] = useState<number>(0);

  // Customer History Modal
  const [viewHistoryCustomer, setViewHistoryCustomer] = useState<Customer | null>(null);

  const isAgenCustomer = (c: Customer) => {
    const cat = categories.find((k) => k.id === c.categoryId);
    return (
      c.categoryId === 'cat_agen' ||
      (cat && cat.name.trim().toUpperCase() === 'AGEN')
    );
  };

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCPhone('');
    setCName('');
    setCCategoryId(categories.find((c) => c.name.toUpperCase() !== 'AGEN')?.id || categories[0]?.id || '');
    setCNotes('');
    setIsCustomerModalOpen(true);
  };

  const openEditCustomer = (c: Customer) => {
    if (isAgenCustomer(c)) {
      alert('Pelanggan kategori AGEN tidak bisa diedit di sini. Silakan edit lewat tab Daftar Agen.');
      return;
    }
    setEditingCustomer(c);
    setCPhone(c.phone);
    setCName(c.name);
    setCCategoryId(c.categoryId);
    setCNotes(c.notes || '');
    setIsCustomerModalOpen(true);
  };

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cPhone.replace(/[^0-9]/g, '');
    if (!cleaned || !cName.trim()) {
      alert('Nomor HP/WA dan Nama pelanggan wajib diisi.');
      return;
    }

    const selectedCatObj = categories.find((k) => k.id === cCategoryId);
    if (cCategoryId === 'cat_agen' || (selectedCatObj && selectedCatObj.name.trim().toUpperCase() === 'AGEN')) {
      alert('Kategori AGEN tidak bisa dipilih manual. Data pelanggan AGEN mengikuti Daftar Agen.');
      return;
    }

    const today = new Date();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dateFormatted = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

    const customerObj: Customer = {
      id: cleaned,
      phone: cleaned,
      name: cName.trim(),
      categoryId: cCategoryId,
      createdAt: editingCustomer ? editingCustomer.createdAt : dateFormatted,
      totalSpent: editingCustomer ? editingCustomer.totalSpent : 0,
      transactionCount: editingCustomer ? editingCustomer.transactionCount : 0,
      notes: cNotes.trim()
    };

    onSaveCustomer(customerObj);
    setIsCustomerModalOpen(false);
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatDiscount(5);
    setIsCategoryModalOpen(true);
  };

  const openEditCategory = (cat: CustomerCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatDiscount(cat.discountPercent);
    setIsCategoryModalOpen(true);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      alert('Nama kategori wajib diisi.');
      return;
    }

    const newCategory: CustomerCategory = {
      id: editingCategory ? editingCategory.id : 'cat_' + Date.now(),
      name: catName.trim().toUpperCase(),
      discountPercent: catDiscount,
      color: 'bg-blue-100 text-blue-700 border-blue-400'
    };

    onSaveCategory(newCategory);
    setIsCategoryModalOpen(false);
  };

  const filteredCustomers = [...customers]
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    )
    .sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base',
        numeric: true
      })
    );

  const customerTransactions = viewHistoryCustomer
    ? transactions.filter((t) => t.customer?.phone === viewHistoryCustomer.phone)
    : [];

  return (
    <div className="w-full max-w-[1440px] mx-auto p-3 sm:p-5 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            PENGATURAN TOKO
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur data pelanggan, diskon kategori, dan profil toko. Perubahan langsung tampil di POS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'customers' && (
            <button
              type="button"
              onClick={openAddCustomer}
              className="px-4 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-sky-400" />
              Tambah Pelanggan Baru
            </button>
          )}
          {activeTab === 'agents' && (
            <button
              type="button"
              onClick={openAddAgent}
              className="px-4 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-sky-400" />
              Tambah Agen Baru
            </button>
          )}
          {activeTab === 'suppliers' && (
            <button
              type="button"
              onClick={openAddSupplier}
              className="px-4 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <Truck className="w-4 h-4 text-sky-400" />
              Tambah Supplier Baru
            </button>
          )}
          {activeTab === 'categories' && (
            <button
              type="button"
              onClick={openAddCategory}
              className="px-4 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <Tag className="w-4 h-4 text-sky-400" />
              Tambah Kategori Diskon
            </button>
          )}
          {activeTab === 'store' && isDeveloper && (
            <button
              type="button"
              onClick={handleSaveStoreSubmit}
              className="px-4 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4 text-sky-400" />
              Simpan Profil Toko
            </button>
          )}
          {activeTab === 'printer' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestPrintFromTab}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
                title="Cetak struk uji coba ke printer thermal sekarang"
              >
                <Printer className="w-4 h-4 text-slate-700" />
                <span className="hidden sm:inline">Test Print Struk</span>
                <span className="sm:hidden">Test Print</span>
              </button>
              <button
                type="button"
                onClick={handleSavePrintSettingsTab}
                className="px-4 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4 text-sky-400" />
                Simpan Pengaturan Printer
              </button>
            </div>
          )}
          {activeTab === 'users' && isDeveloper && (
            <button
              type="button"
              onClick={openAddUser}
              className="px-4 py-2.5 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-sky-400" />
              Tambah Akun Pengguna
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-5 pt-3 gap-3 overflow-x-auto">
        {/* 1. Pelanggan */}
        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'customers'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Pelanggan ({customers.length})
        </button>

        {/* 2. Agen */}
        {(
          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'agents'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4 text-slate-700" />
            Agen ({agents.length})
          </button>
        )}

        {/* 3. Supplier */}
        {(
          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'suppliers'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4 text-slate-700" />
            Supplier ({suppliers.length})
          </button>
        )}

        {/* 4. Kategori & Diskon */}
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'categories'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Percent className="w-4 h-4 text-slate-700" />
          Kategori & Diskon ({categories.length})
        </button>

        {/* 5. Profil & Nama Toko */}
        {isDeveloper && (
          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'store'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-4 h-4 text-slate-700" />
            Profil & Nama Toko
          </button>
        )}

        {/* 6. Printer & Auto-Print */}
        <button
          type="button"
          onClick={() => setActiveTab('printer')}
          className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'printer'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Printer className="w-4 h-4 text-slate-700" />
          Printer Setting
        </button>

        {/* 7. Hak Akses & Akun */}
        {isDeveloper && (
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'users'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4 text-purple-600" />
            Hak Akses & Akun ({users.length})
          </button>
        )}

        {/* 8. Backup Data */}
        {isDeveloper && (
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`pb-3 px-3 font-bold text-xs flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'backup'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDriveDownload className="w-4 h-4 text-emerald-600" />
            Backup Data
          </button>
        )}
      </div>

      {/* Tab: Customers List */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-b-2xl border border-slate-200 shadow-xs overflow-hidden p-4 space-y-4">
          {/* Search bar */}
          <div className="relative max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama atau no WhatsApp..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">No. WhatsApp (ID)</th>
                  <th className="py-3.5 px-4">Nama Pelanggan</th>
                  <th className="py-3.5 px-4">Kategori & Diskon</th>
                  <th className="py-3.5 px-4">Terdaftar Sejak</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 text-center">Riwayat</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c) => {
                    const isAgen = isAgenCustomer(c);
                    const cat = categories.find((k) => k.id === c.categoryId || k.name.toUpperCase() === (c.categoryId || '').toUpperCase());
                    const categoryDisplayName = isAgen ? 'AGEN' : (cat ? (cat.name.toUpperCase() === 'RETAIL' ? 'UMUM' : cat.name) : 'UMUM');
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          <span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1.5 w-max">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            {c.phone}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {c.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            isAgen ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {categoryDisplayName}
                            {cat && cat.discountPercent > 0 && ` (${cat.discountPercent}%)`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {c.createdAt}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                          {c.notes || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setViewHistoryCustomer(c)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <History className="w-3.5 h-3.5" />
                            Lihat Nota
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isAgen ? (
                            <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[10px] font-bold" title="Akun AGEN tidak bisa diubah atau dihapus dari sini. Datanya mengikuti Daftar Agen.">
                              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Terkunci (Daftar Agen)</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditCustomer(c)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {isDeveloper && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Hapus pelanggan ${c.name}?`)) {
                                      onDeleteCustomer(c.id);
                                    }
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                  title="Hapus Pelanggan (Developer Only)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Tidak ada data pelanggan yang sesuai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Agents List */}
      {activeTab === 'agents' && (
        <div className="bg-white rounded-b-2xl border border-slate-200 shadow-xs overflow-hidden p-4 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-sm">
              <input
                type="text"
                value={agentSearchQuery}
                onChange={(e) => setAgentSearchQuery(e.target.value)}
                placeholder="Cari berdasarkan nama agen, komisi, atau no HP..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <button
              type="button"
              onClick={openAddAgent}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Briefcase className="w-4 h-4" />
              Tambah Agen Baru
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Nama Agen / Mitra</th>
                  <th className="py-3.5 px-4">Kontak (PIC) & Telp</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Alamat</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada data agen yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((ag) => (
                    <tr key={ag.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {ag.name}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          Terdaftar: {ag.createdAt || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{ag.contactPerson || '-'}</div>
                        <div className="text-[11px] font-mono text-emerald-700 flex items-center gap-1 mt-0.5">
                          <PhoneCall className="w-3 h-3 text-emerald-600" />
                          {ag.phone}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-md text-[11px] font-bold">
                          {ag.commissionRate || 'Standar'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={ag.address}>
                        {ag.address || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={ag.notes}>
                        {ag.notes || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isAdminOrDev && (
                            <button
                              type="button"
                              onClick={() => setSelectedAgentForHistory(ag)}
                              className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              title="Lihat Riwayat Pengambilan & Cetak"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Riwayat</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditAgent(ag)}
                            className="p-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Agen"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Yakin ingin menghapus agen "${ag.name}"?`)) {
                                onDeleteAgent(ag.id);
                              }
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Agen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Suppliers List */}
      {activeTab === 'suppliers' && (
        <div className="bg-white rounded-b-2xl border border-slate-200 shadow-xs overflow-hidden p-4 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-sm">
              <input
                type="text"
                value={supplierSearchQuery}
                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                placeholder="Cari berdasarkan nama supplier, kategori, atau no HP..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <button
              type="button"
              onClick={openAddSupplier}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              Tambah Supplier Baru
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Nama Supplier</th>
                  <th className="py-3.5 px-4">Kontak (PIC) & Telp</th>
                  <th className="py-3.5 px-4">Kategori / Bahan</th>
                  <th className="py-3.5 px-4">Alamat</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada data supplier yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {sup.name}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          Terdaftar: {sup.createdAt || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{sup.contactPerson || '-'}</div>
                        <div className="text-[11px] font-mono text-emerald-700 flex items-center gap-1 mt-0.5">
                          <PhoneCall className="w-3 h-3 text-emerald-600" />
                          {sup.phone}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[11px] font-bold">
                          {sup.category || 'Umum'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={sup.address}>
                        {sup.address || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={sup.notes}>
                        {sup.notes || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditSupplier(sup)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Supplier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Yakin ingin menghapus supplier "${sup.name}"?`)) {
                                onDeleteSupplier(sup.id);
                              }
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Categories and Discounts */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-b-2xl border border-slate-200 shadow-xs overflow-hidden p-6 space-y-4">
          <div className="max-w-2xl">
            <h3 className="font-bold text-sm text-slate-800">
              Aturan Diskon Berdasarkan Kategori Pelanggan
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Pelanggan dengan kategori di bawah otomatis dapat diskon saat transaksi di kasir.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditCategory(cat)}
                        className="p-1 text-slate-500 hover:text-blue-600 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {isDeveloper && !isDefaultCustomerCategory(cat.id) && !isDefaultCustomerCategory(cat.name) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Hapus kategori ${cat.name}?`)) {
                              onDeleteCategory(cat.id);
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-red-600 rounded cursor-pointer"
                          title="Hapus Kategori (Developer Only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-[11px] text-slate-500">Diskon Otomatis:</span>
                    <div className="text-2xl font-black text-blue-700">
                      {cat.discountPercent}%
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                  {customers.filter((c) => c.categoryId === cat.id).length} Pelanggan Terdaftar
                </div>
              </div>
            ))}
          </div>

          {/* Modul Konverter URL Google Drive Otomatis (Khusus Akun DEVELOPER) */}
          {isDeveloper && (
            <GoogleDriveUrlConverter
              products={products}
              onSaveProduct={onSaveProduct}
            />
          )}
        </div>
      )}

      {/* Tab: Store Settings */}
      {activeTab === 'store' && isDeveloper && (
        <div className="bg-white rounded-b-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
          {storeSavedToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-semibold animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Profil dan nama toko tersimpan. Perubahan langsung tampil di POS.</span>
              </div>
              <button
                type="button"
                onClick={() => setStoreSavedToast(false)}
                className="text-emerald-700 hover:text-emerald-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {profileToast && (
            <div className="p-3.5 bg-blue-50 border border-blue-300 rounded-xl flex items-center justify-between text-xs text-blue-900 font-semibold animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <span>{profileToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setProfileToast(null)}
                className="text-blue-700 hover:text-blue-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Multi-Store Profiles Manager Card */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                      MANAJEMEN PROFIL & NAMA TOKO
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {storeProfiles.length} Profil Tersimpan
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Atur profil toko. Setiap profil punya data transaksi dan shift sendiri, tidak bercampur.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openAddProfileModal}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tambah Profil Toko Baru
              </button>
            </div>

            {/* Master Database Info Banner */}
            <div className="bg-gradient-to-r from-amber-50 via-amber-50/70 to-emerald-50/80 border border-amber-300/80 rounded-xl p-4 flex items-start gap-3.5 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <div className="font-black text-amber-950 flex items-center gap-2 flex-wrap">
                  <span>👑 Toko BEJO Polsek adalah profil utama (stok berpusat di sini)</span>
                  <span className="px-2 py-0.5 bg-amber-200/90 text-amber-900 font-bold text-[10px] rounded-md border border-amber-300">
                    STOK DIPERBARUI OTOMATIS
                  </span>
                </div>
                <p className="text-amber-900/90 text-[11px] leading-relaxed">
                  Jumlah stok di <strong>Katalog Produk</strong> dan <strong>Agen</strong> mengikuti stok di <strong>BEJO Polsek</strong>.
                  Setiap Profil Toko punya data transaksi penjualan dan rekap shift sendiri, tidak bercampur.
                </p>
              </div>
            </div>

            {/* Profiles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeProfiles.map((prof) => {
                const isMaster = prof.isMaster || prof.id === 'bejo_polsek';
                const isActive = (prof.id === activeProfileId) || (!activeProfileId && isMaster);

                return (
                  <div
                    key={prof.id}
                    className={`rounded-2xl border-2 transition-all p-4 flex flex-col justify-between space-y-3.5 relative select-none ${
                      isActive
                        ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {isMaster ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            👑 PROFIL UTAMA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            🏢 STOK SENDIRI
                          </span>
                        )}

                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-500 text-white shadow-2xs">
                            <Check className="w-3 h-3" />
                            PROFIL AKTIF
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">
                            ID: {prof.id}
                          </span>
                        )}
                      </div>

                      {/* Store Name & Branch */}
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <StoreLogo size="md" rounded="rounded-xl" customUrl={prof.logoUrl} storeName={prof.storeName} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-sm text-slate-900 truncate">
                            {prof.storeName || 'BEJO Digital Print'}
                          </h4>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Store className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Cabang: <strong>{prof.branch || 'Polsek'}</strong></span>
                          </div>
                          {prof.phone && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <PhoneCall className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="font-mono">{prof.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Address preview */}
                      {prof.address && (
                        <div className="mt-2.5 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 line-clamp-2">
                          📍 {prof.address}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditProfileModal(prof)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          title="Edit Informasi Profil Toko"
                        >
                          <Edit2 className="w-3 h-3 text-slate-600" />
                          Edit
                        </button>
                        {!isMaster && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProfileClick(prof)}
                            className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                            title="Hapus Profil Toko Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {isActive ? (
                        <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Sedang Digunakan
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSwitchProfileClick(prof.id)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowRight className="w-3 h-3 text-sky-400" />
                          Gunakan Profil Ini
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Store Logo Management Card (Developer Only) */}
          {isDeveloper && (
            <div className="bg-slate-50 rounded-xl p-5 text-slate-900 border border-slate-200 shadow-2xs relative">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-200 text-slate-800 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-slate-800" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm tracking-tight text-slate-900">LOGO TOKO & IDENTITAS APLIKASI</h3>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-white flex items-center gap-1 shadow-2xs">
                        <DeveloperJokerIcon size="xs" rounded="rounded-sm" />
                        KHUSUS DEVELOPER
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ganti logo toko utama yang tampil di seluruh POS, header navigasi, dan struk belanja.
                    </p>
                  </div>
                </div>

                {storeForm.logoUrl && (
                  <button
                    type="button"
                    onClick={handleResetLogo}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Kembalikan ke logo bawaan"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset ke Logo Standar
                  </button>
                )}
              </div>

              {logoSuccessToast && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-semibold animate-in fade-in duration-200">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{logoSuccessToast}</span>
                </div>
              )}

              {logoUploadError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded-xl flex items-center gap-2 text-xs text-red-900 font-semibold animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{logoUploadError}</span>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* Logo Display & Status */}
                <div className="md:col-span-4 flex items-center gap-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="relative shrink-0">
                    <StoreLogo size="xl" rounded="rounded-xl" customUrl={storeForm.logoUrl} storeName={storeForm.storeName} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900">Status Logo Saat Ini:</div>
                    {storeForm.logoUrl ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          <Sparkles className="w-3 h-3 text-emerald-700" />
                          Logo Default Toko (Aktif)
                        </span>
                        <div className="text-[10px] text-emerald-700 font-bold">
                          ✓ Ditetapkan sebagai Logo Default
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                        Logo Standar Bawaan (Default Awal)
                      </span>
                    )}
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {storeForm.logoUrl ? 'Tersimpan dan dipakai sebagai logo utama di semua halaman.' : 'Memakai logo bawaan aplikasi.'}
                    </p>
                  </div>
                </div>

                {/* Upload & Action Area */}
                <div className="md:col-span-8 flex flex-col sm:flex-row items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploadLoading}
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    {logoUploadLoading ? 'Memproses Logo...' : 'Upload & Jadikan Logo Default'}
                  </button>

                  {storeForm.logoUrl && (
                    <button
                      type="button"
                      onClick={handleSetAsDefaultLogo}
                      className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Jadikan logo ini logo utama di semua halaman"
                    >
                      <Check className="w-4 h-4 text-emerald-600" />
                      Setel Ulang Default
                    </button>
                  )}

                  <div className="text-xs text-slate-600 leading-relaxed text-center sm:text-left">
                    Logo yang diunggah langsung jadi <strong>Logo Default</strong> untuk identitas toko, POS kasir, dan struk.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Column */}
            <form onSubmit={handleSaveStoreSubmit} className="lg:col-span-7 space-y-4">
              <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3.5 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900">
                  <p className="font-bold">Edit Informasi Profil Aktif ({storeForm.storeName})</p>
                  <p className="text-blue-700 text-[11px] mt-0.5">
                    Nama toko di bawah ini otomatis tampil di <strong>header navigasi atas</strong>, <strong>halaman transaksi kasir POS</strong>, dan <strong>cetak struk thermal</strong>.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Nama Toko (Wajib)
                </label>
                <input
                  type="text"
                  value={storeForm.storeName}
                  onChange={(e) => setStoreForm({ ...storeForm, storeName: e.target.value })}
                  placeholder="misal: BEJO Digital Print"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Nama utama toko yang ditampilkan di header navigasi dan halaman kasir POS.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                  <Type className="w-3.5 h-3.5 text-blue-600" />
                  Judul Aplikasi (Header)
                </label>
                <input
                  type="text"
                  value={storeForm.appTitle || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, appTitle: e.target.value })}
                  placeholder="misal: Point of Sales"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Teks besar di samping logo pada header. Bebas diubah, misal: &ldquo;Point of Sales&rdquo;.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 text-slate-500" />
                    Cabang / Lokasi
                  </label>
                  <input
                    type="text"
                    value={storeForm.branch}
                    onChange={(e) => setStoreForm({ ...storeForm, branch: e.target.value })}
                    placeholder="misal: Pelsek"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                    No. WhatsApp / Telepon
                  </label>
                  <input
                    type="text"
                    value={storeForm.phone}
                    onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                    placeholder="misal: 08123456789"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  Alamat Lengkap Toko
                </label>
                <textarea
                  rows={2}
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                  placeholder="Jl. Raya Diwek (Sebelah Polsek), Kota..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Pesan Kaki Struk (Receipt Footer)
                </label>
                <textarea
                  rows={2}
                  value={storeForm.receiptFooter}
                  onChange={(e) => setStoreForm({ ...storeForm, receiptFooter: e.target.value })}
                  placeholder="Terima kasih atas kunjungan Anda!..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Simpan Perubahan Profil Toko
                </button>
              </div>
            </form>

            {/* Live Preview Column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pratinjau Tampilan di POS
              </div>

              {/* Preview 1: Top Navigation Header */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  1. Header Navigasi Atas
                </span>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2 shadow-2xs">
                  <StoreLogo size="sm" rounded="rounded-lg" storeName={storeForm.storeName} />
                  <div>
                    <div className="text-xs font-black text-slate-900 leading-tight">Point of Sales</div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      {storeForm.storeName || 'NAMA TOKO'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview 2: POS Transaction Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  2. Halaman Kasir POS (Meta Header Transaksi)
                </span>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-12">Toko</span>
                    <span className="text-slate-400">:</span>
                    <span className="font-bold text-slate-900">{storeForm.storeName || 'NAMA TOKO'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                    <span className="text-slate-400 w-12">Kasir</span>
                    <span className="text-slate-400">:</span>
                    <span className="font-bold text-blue-700">FIRA</span>
                  </div>
                </div>
              </div>

              {/* Preview 3: Receipt Preview */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  3. Header Struk Thermal
                </span>
                <div className="bg-white p-3 rounded-lg border border-dashed border-slate-300 text-center font-mono text-xs shadow-2xs">
                  <div className="font-black text-slate-900 uppercase text-xs">
                    {storeForm.storeName || 'NAMA TOKO'}
                  </div>
                  {storeForm.branch && (
                    <div className="text-[10px] text-slate-600 uppercase font-sans">
                      Cabang {storeForm.branch}
                    </div>
                  )}
                  {storeForm.phone && (
                    <div className="text-[10px] text-slate-500 font-sans">
                      WA: {storeForm.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Shortcut Pengaturan Printer & Auto-Print Kasir */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="p-5 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-200 text-slate-800 rounded-lg">
                    <Printer className="w-5 h-5 text-slate-800" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                        PENGATURAN PRINTER THERMAL POS & AUTO-PRINT
                      </h3>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                        {printSettingsForm.paperSize} • Margin: {printSettingsForm.printMarginMm || 0}mm
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Atur printer utama ({printSettingsForm.defaultPrinter || 'POS 80'}), margin cetak (0-10mm), dan cetak otomatis untuk struk & surat jalan.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('printer')}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  Buka Pengaturan Printer & Auto-Print
                </button>
              </div>
            </div>
          </div>

          {/* Shortcut & Diagnostik Backend (Khusus Akun Developer) */}
          {isDeveloper && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="p-5 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-200 text-slate-800 rounded-lg">
                      <Server className="w-5 h-5 text-slate-800" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                          BACKEND & DIAGNOSTIK SISTEM
                        </h3>
                        <span className="text-[10px] bg-slate-900 text-white font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                          <DeveloperJokerIcon size="xs" rounded="rounded-sm" />
                          KHUSUS DEVELOPER
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Cek kondisi server (port 3000), Gemini AI, database di server, dan perbaikan otomatis.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onOpenBackendDiagnostics && (
                      <button
                        type="button"
                        onClick={onOpenBackendDiagnostics}
                        className="px-4 py-2.5 bg-white hover:bg-slate-100 active:scale-95 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
                        title="Buka panel diagnostik lengkap dan daftar error"
                      >
                        <Activity className="w-4 h-4 text-slate-700" />
                        Buka Panel Diagnostik Backend
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleQuickAutoFix}
                      disabled={isFixingBackend}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      title="Jalankan perbaikan otomatis sistem dan sambungkan ulang ke server"
                    >
                      <Wrench className={`w-4 h-4 text-white ${isFixingBackend ? 'animate-spin' : ''}`} />
                      {isFixingBackend ? 'Memperbaiki...' : 'Perbaiki Otomatis (FIX)'}
                    </button>
                  </div>
                </div>

                {quickFixMsg && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{quickFixMsg}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Printer & Auto-Print Settings */}
      {activeTab === 'printer' && (
        <div className="bg-white rounded-b-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6 animate-in fade-in duration-200">
          {/* Header & Subtabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  PENGATURAN PRINTER THERMAL POS & FORMAT STRUK
                </h2>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md">
                  {printSettingsForm.paperSize} • {printSettingsForm.printMarginMm || 0}mm Margin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur printer utama, margin cetak (0-10mm), cetak otomatis tanpa klik kasir, dan hemat kertas.
              </p>
            </div>

            {/* Sub-Tabs Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPrinterTabSubView('settings')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  printerTabSubView === 'settings'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Format & Margin</span>
              </button>
              <button
                type="button"
                onClick={() => setPrinterTabSubView('preview')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  printerTabSubView === 'preview'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Preview Struk</span>
              </button>
              <button
                type="button"
                onClick={() => setPrinterTabSubView('kiosk_guide')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  printerTabSubView === 'kiosk_guide'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Panduan Auto Direct Print</span>
              </button>
            </div>
          </div>

          {/* Toast Notification when saved */}
          {printSettingsSavedToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs animate-in zoom-in-95">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan printer dan margin tersimpan, langsung dipakai POS.</span>
            </div>
          )}

          {/* Subview 1: Settings Form */}
          {printerTabSubView === 'settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Printer & Margin & Auto-Print Settings (7 cols) */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* Card 1: Default Printer Selection */}
                  <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200 space-y-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Printer className="w-4 h-4 text-indigo-600" />
                        Pilihan Printer Default
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Pilih printer yang tersambung di komputer kasir ini.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setPrintSettingsForm({ ...printSettingsForm, defaultPrinter: 'pos_80', paperSize: '80mm' })}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          printSettingsForm.defaultPrinter === 'pos_80' || (!printSettingsForm.defaultPrinter && printSettingsForm.paperSize === '80mm')
                            ? 'border-indigo-600 bg-white text-indigo-950 font-bold shadow-xs ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">POS 80 mm</span>
                          <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-1.5 py-0.2 rounded">Rekomendasi</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal mt-1">
                          Printer thermal 80mm lewat USB / Bluetooth, standar kasir.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPrintSettingsForm({ ...printSettingsForm, defaultPrinter: 'pos_58', paperSize: '58mm' })}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          printSettingsForm.defaultPrinter === 'pos_58' || (!printSettingsForm.defaultPrinter && printSettingsForm.paperSize === '58mm')
                            ? 'border-indigo-600 bg-white text-indigo-950 font-bold shadow-xs ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">POS 58 mm</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-1">
                          Printer thermal mini 58mm, portabel lewat Bluetooth.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPrintSettingsForm({ ...printSettingsForm, defaultPrinter: 'system_default' })}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          printSettingsForm.defaultPrinter === 'system_default'
                            ? 'border-indigo-600 bg-white text-indigo-950 font-bold shadow-xs ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">Default OS</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-1">
                          Mengikuti printer default di Windows atau Chrome/Edge perangkat ini.
                        </div>
                      </button>
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama / Label Perangkat Printer Kasir (Opsional)
                      </label>
                      <input
                        type="text"
                        value={printSettingsForm.printerDeviceName || ''}
                        onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, printerDeviceName: e.target.value })}
                        placeholder="misal: POS-80 USB Printer Kasir 1 / EPSON TM-T82"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Card 2: Margin Cetak (0mm - 10mm) */}
                  <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-indigo-600" />
                          Format Margin Cetak (0mm – 10mm)
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Atur jarak tepi kertas. <strong>0mm paling disarankan</strong> untuk printer thermal agar struk rapat dan hemat kertas.
                        </p>
                      </div>
                      <div className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-mono font-bold text-xs px-2.5 py-1 rounded-lg">
                        {printSettingsForm.printMarginMm || 0} mm
                      </div>
                    </div>

                    {/* Slider Control */}
                    <div className="pt-2 space-y-2">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={printSettingsForm.printMarginMm || 0}
                        onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, printMarginMm: parseInt(e.target.value, 10) || 0 })}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>0 mm (Nol Margin / Hemat Kertas)</span>
                        <span>2 mm</span>
                        <span>5 mm</span>
                        <span>8 mm</span>
                        <span>10 mm (Lebar)</span>
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { val: 0, label: '0 mm (Hemat Kertas POS 80)', badge: 'Rekomendasi' },
                        { val: 2, label: '2 mm (Standar POS)' },
                        { val: 3, label: '3 mm' },
                        { val: 5, label: '5 mm (Rapi)' },
                        { val: 10, label: '10 mm (Lebar)' }
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setPrintSettingsForm({ ...printSettingsForm, printMarginMm: preset.val })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            (printSettingsForm.printMarginMm || 0) === preset.val
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span>{preset.label}</span>
                          {preset.badge && (
                            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                              (printSettingsForm.printMarginMm || 0) === preset.val ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {preset.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card 3: Auto-Print Options */}
                  <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-emerald-600" />
                        Aktivasi Opsi Auto-Print
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Kasir tidak perlu klik tombol cetak lagi setelah transaksi selesai.
                      </p>
                    </div>

                    <div className="space-y-3 pt-1">
                      {/* Option 1: Auto-Print on Selesai Transaksi */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-4 shadow-2xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">Auto-Print Saat 'Selesai Transaksi' (POS)</span>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.2 rounded">
                              Struk POS
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Struk langsung tercetak ke printer kasir begitu tombol 'Selesai Transaksi' ditekan.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={printSettingsForm.autoPrintOnCheckout}
                            onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, autoPrintOnCheckout: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>

                      {/* Option 2: Auto-Print on Cetak Surat Jalan */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-4 shadow-2xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">Auto-Print Saat 'Cetak Surat Jalan' / Pengambilan Bahan</span>
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-1.5 py-0.2 rounded">
                              Surat Jalan
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Surat Jalan / Bukti Pengambilan Bahan langsung tercetak begitu pesanan diproses.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={!!printSettingsForm.autoPrintOnSuratJalan}
                            onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, autoPrintOnSuratJalan: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Paper Size, Density & Contrast */}
                  <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        Ukuran Kertas & Ketajaman Font Thermal
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Ukuran Kertas Thermal</label>
                        <select
                          value={printSettingsForm.paperSize}
                          onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, paperSize: e.target.value as any })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        >
                          <option value="80mm">80 mm (Standar POS 80 - Rekomendasi)</option>
                          <option value="58mm">58 mm (Mini Thermal 58mm)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Kerapatan / Spasi Baris</label>
                        <select
                          value={printSettingsForm.density}
                          onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, density: e.target.value as any })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        >
                          <option value="compact">Hemat Kertas (Compact - Rapat 30%)</option>
                          <option value="standard">Standar (Seimbang & Rapi)</option>
                          <option value="large">Besar & Jelas (Large Font)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Ketajaman & Kontras Teks</label>
                        <select
                          value={printSettingsForm.contrast}
                          onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, contrast: e.target.value as any })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        >
                          <option value="normal">Normal (Font 600)</option>
                          <option value="bold">Tebal & Tajam (Font 700 - Rekomendasi)</option>
                          <option value="ultra-black">Hitam Pekat Solid (Font 900)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Baris Potong Kertas (Auto-Cutter)</label>
                        <select
                          value={printSettingsForm.feedLines}
                          onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, feedLines: parseInt(e.target.value, 10) || 2 })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        >
                          <option value="1">1 Baris (Hemat Kertas Ekstra)</option>
                          <option value="2">2 Baris (Standar POS 80)</option>
                          <option value="3">3 Baris</option>
                          <option value="4">4 Baris</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Receipt Elements & Quick Actions (5 cols) */}
                <div className="lg:col-span-5 space-y-5">
                  
                  {/* Card: Receipt Elements Checkboxes */}
                  <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200 space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-indigo-600" />
                      Elemen Yang Dicetak Pada Struk
                    </h3>
                    
                    <div className="space-y-2 pt-1">
                      {[
                        { key: 'showLogo', label: 'Logo Toko di Header' },
                        { key: 'showStoreHeader', label: 'Alamat, Cabang & No. WA Toko' },
                        { key: 'showCustomerInfo', label: 'Data Pelanggan (Nama & No. WA)' },
                        { key: 'showCashierName', label: 'Nama Kasir yang Bertugas' },
                        { key: 'showFooterNotes', label: 'Catatan Garansi / Footer Toko' },
                        { key: 'showQrCode', label: 'QR Code WhatsApp Toko' },
                        { key: 'showCutLine', label: 'Garis Panduan Potong Kertas' }
                      ].map((item) => (
                        <label key={item.key} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100/80 cursor-pointer transition-all shadow-2xs">
                          <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                          <input
                            type="checkbox"
                            checked={Boolean((printSettingsForm as any)[item.key])}
                            onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, [item.key]: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Pesan Catatan Kaki Struk Kustom (Opsional)
                      </label>
                      <textarea
                        rows={2}
                        value={printSettingsForm.customFooterNote || ''}
                        onChange={(e) => setPrintSettingsForm({ ...printSettingsForm, customFooterNote: e.target.value })}
                        placeholder="Jika terdapat kesalahan warna bahan atau harga harap segera menghubungi nomor toko."
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Actions Box */}
                  <div className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">Aksi & Simpan Pengaturan</div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={handleResetPrintSettingsDefault}
                        className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        title="Kembali ke pengaturan standar POS 80 yang disarankan"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Standar POS 80</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTestPrintFromTab}
                        className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        title="Cetak struk uji coba ke printer thermal sekarang"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-700" />
                        <span>Test Print Struk</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleSavePrintSettingsTab}
                      className="w-full py-3 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4 text-sky-400" />
                      Simpan Semua Pengaturan Printer
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* Subview 2: Live Preview */}
          {printerTabSubView === 'preview' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Contoh struk dengan pengaturan ini: kertas <strong>{printSettingsForm.paperSize}</strong>, margin <strong>{printSettingsForm.printMarginMm || 0}mm</strong>, spasi baris <strong>{printSettingsForm.density}</strong>, ketajaman <strong>{printSettingsForm.contrast}</strong>.
                </span>
              </div>

              <div className="flex justify-center p-4 bg-slate-100 rounded-2xl">
                <div
                  style={{
                    padding: `${printSettingsForm.printMarginMm || 0}mm`
                  }}
                  className={`bg-white shadow-md border border-dashed border-slate-300 text-black font-mono leading-relaxed transition-all ${
                    printSettingsForm.paperSize === '58mm' ? 'w-full max-w-[240px] text-[10px]' : 'w-full max-w-xs text-xs'
                  } ${
                    printSettingsForm.density === 'compact' ? 'leading-tight text-[10.5px]' : printSettingsForm.density === 'large' ? 'leading-loose text-[12.5px]' : 'leading-relaxed'
                  } ${
                    printSettingsForm.contrast === 'ultra-black' ? 'font-black' : printSettingsForm.contrast === 'bold' ? 'font-bold' : 'font-semibold'
                  }`}
                >
                  {/* Logo & Header */}
                  {printSettingsForm.showLogo && (
                    <div className="flex justify-center mb-1.5">
                      <StoreLogo size="sm" rounded="rounded-md" storeName={storeForm.storeName} />
                    </div>
                  )}

                  {printSettingsForm.showStoreHeader && (
                    <div className="text-center pb-2.5 border-b border-dashed border-black">
                      <div className="font-extrabold text-sm tracking-widest uppercase">{storeForm.storeName || 'BEJO Digital Print'}</div>
                      <div className="text-[10px] text-slate-700 uppercase font-sans">{storeForm.branch || 'Polsek Utama'}</div>
                      <div className="text-[9.5px] text-slate-600 font-sans mt-0.5">{storeForm.address || 'Jl. Raya Utama No. 45'}</div>
                      <div className="text-[9.5px] text-slate-700 font-sans">WA: {storeForm.phone || '0812-3456-7890'}</div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="py-2 border-b border-dashed border-black text-[10.5px] space-y-0.5">
                    <div className="flex justify-between">
                      <span>No. Invoice</span>
                      <span className="font-bold">#INV-2026/09/001</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tgl / Jam</span>
                      <span>27/09/26 14:30</span>
                    </div>
                    {printSettingsForm.showCashierName && (
                      <div className="flex justify-between">
                        <span>Kasir</span>
                        <span className="uppercase">FIRA (KASIR 1)</span>
                      </div>
                    )}
                    {printSettingsForm.showCustomerInfo && (
                      <div className="flex justify-between pt-0.5 border-t border-slate-100">
                        <span>Pelanggan</span>
                        <span className="font-bold">Bramandityo (08123456789)</span>
                      </div>
                    )}
                  </div>

                  {/* Sample Items */}
                  <div className="py-2 border-b border-dashed border-black space-y-1.5 text-[10.5px]">
                    <div className="space-y-0.5">
                      <div className="font-bold flex justify-between">
                        <span>Stiker Ritrama Glossy</span>
                      </div>
                      <div className="flex justify-between text-[9.5px]">
                        <span>RTM-01 | 5 meter</span>
                        <span className="font-bold">Rp 125.000</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold flex justify-between">
                        <span>Oracal 651 Black Glossy</span>
                      </div>
                      <div className="flex justify-between text-[9.5px]">
                        <span>ORC-651 | 1 Roll (50m)</span>
                        <span className="font-bold">Rp 850.000</span>
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="py-2 border-b border-dashed border-black text-[10.5px] space-y-0.5">
                    <div className="flex justify-between">
                      <span>Sub Total</span>
                      <span>Rp 975.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Diskon (Member Grosir)</span>
                      <span>-Rp 25.000</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-black">
                      <span>TOTAL BAYAR</span>
                      <span>Rp 950.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tunai (Cash)</span>
                      <span>Rp 1.000.000</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Kembalian</span>
                      <span>Rp 50.000</span>
                    </div>
                  </div>

                  {/* Footer Notes */}
                  {printSettingsForm.showFooterNotes && (
                    <div className="pt-2 text-center text-[8.5px] font-sans text-slate-600 leading-tight">
                      <p>{printSettingsForm.customFooterNote || 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.'}</p>
                    </div>
                  )}

                  {/* QR Code */}
                  {printSettingsForm.showQrCode && (
                    <div className="pt-2.5 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center border border-slate-300">
                        <QrCode className="w-12 h-12 text-slate-800" />
                      </div>
                      <span className="text-[7.5px] font-sans font-bold text-slate-700 uppercase mt-1">
                        SCAN QR UNTUK ORDER WA
                      </span>
                    </div>
                  )}

                  <div className="text-center font-mono text-[8px] text-slate-400 mt-2">
                    -- TERIMA KASIH --
                  </div>

                  {/* Cutting feed line simulation */}
                  {Array.from({ length: printSettingsForm.feedLines || 2 }).map((_, i) => (
                    <div key={i} className="h-3.5 border-b border-transparent"></div>
                  ))}
                  {printSettingsForm.showCutLine && (
                    <div className="text-center text-[8px] text-slate-400 border-t border-dotted border-slate-400 pt-0.5">
                      - - - - - - - - - - [ Gunting di Sini ] - - - - - - - - - -
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Subview 3: Kiosk Direct Printing Guide */}
          {printerTabSubView === 'kiosk_guide' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span>Panduan Cetak Otomatis Tanpa Jendela Print</span>
                </div>
                <p className="text-xs text-indigo-800 leading-relaxed font-normal">
                  Supaya struk langsung keluar <strong>otomatis tanpa jendela print</strong>, lakukan 3 langkah ini di komputer kasir:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                    <span>Set Default Printer POS 80</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Buka <em>Windows Settings &rarr; Bluetooth & devices &rarr; Printers & Scanners</em>. Pilih printer kasir Anda, klik <strong>Set as default</strong>.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <span>Hilangkan Header & Footer</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Saat jendela print pertama kali muncul, klik <em>More settings</em>. <strong>Hilangkan centang "Headers and footers"</strong>, pilih <strong>Margins: None</strong>.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                    <span>Mode Kiosk Direct Print</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Tambahkan <code className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold">--kiosk-printing</code> di akhir Target shortcut Chrome / Edge di desktop.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Tab: Users & Permissions */}
      {activeTab === 'users' && isDeveloper && (
        <div className="bg-white rounded-b-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left side: Users accounts list */}
            <div className="lg:col-span-8 space-y-4">
              {/* Top Role Guidelines Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-start gap-2.5">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-lg shrink-0">
                    <Crown className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-indigo-950 uppercase">OWNER (Pemilik)</div>
                    <div className="text-[10px] text-indigo-800 mt-0.5 leading-relaxed">
                      Akses penuh: POS, stok, toko, laporan keuangan, pelanggan, dan shift.
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-2.5">
                  <div className="p-1.5 bg-blue-600 text-white rounded-lg shrink-0">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-blue-950 uppercase">ADMIN (Kelola Data)</div>
                    <div className="text-[10px] text-blue-800 mt-0.5 leading-relaxed">
                      Akses harian: POS, stok gudang, pelanggan, supplier, agen, dan laporan.
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
                  <div className="p-1.5 bg-amber-600 text-white rounded-lg shrink-0">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-amber-950 uppercase">AGEN (Mitra Toko)</div>
                    <div className="text-[10px] text-amber-800 mt-0.5 leading-relaxed">
                      Hanya untuk agen: ambil bahan, lihat katalog agen, cetak surat jalan.
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-2.5">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg shrink-0">
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-emerald-950 uppercase">KASIR (Operasional POS)</div>
                    <div className="text-[10px] text-emerald-800 mt-0.5 leading-relaxed">
                      Hanya untuk kasir: POS, buka/tutup shift, dan cetak struk nota.
                    </div>
                  </div>
                </div>
              </div>

              {/* Search, Filter & Action Toolbar */}
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Cari nama, username, atau no HP akun..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>

                  {/* Add User Button inside tab view */}
                  <button
                    type="button"
                    onClick={openAddUser}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Tambah Akun
                  </button>
                </div>

                {/* Role filter pills */}
                {(() => {
                  const visibleUsers = users.filter((u) => u.role !== 'DEVELOPER' && u.id !== 'user_dev' && u.id !== 'sys_core_developer');
                  return (
                    <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          userRoleFilter === 'ALL'
                            ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Semua ({visibleUsers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('OWNER')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                          userRoleFilter === 'OWNER'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-indigo-700 hover:text-indigo-950'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5" />
                        Owner ({visibleUsers.filter((u) => u.role === 'OWNER').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('ADMIN')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                          userRoleFilter === 'ADMIN'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-blue-700 hover:text-blue-950'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Admin ({visibleUsers.filter((u) => u.role === 'ADMIN').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('AGEN')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                          userRoleFilter === 'AGEN'
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'text-amber-700 hover:text-amber-950'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Agen ({visibleUsers.filter((u) => u.role === 'AGEN').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('KASIR')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                          userRoleFilter === 'KASIR'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-emerald-700 hover:text-emerald-950'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Kasir ({visibleUsers.filter((u) => u.role === 'KASIR').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('SPK')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                          userRoleFilter === 'SPK'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-indigo-700 hover:text-indigo-950'
                        }`}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        SPK ({visibleUsers.filter((u) => u.role === 'SPK').length})
                      </button>
                      {customRoles.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setUserRoleFilter(role.id)}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                            userRoleFilter === role.id
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'text-purple-700 hover:text-purple-950'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          {role.name} ({visibleUsers.filter((u) => u.role === role.id).length})
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Pengguna / Nama</th>
                      <th className="py-3 px-4">Username Login</th>
                      <th className="py-3 px-4">Hak Akses (Role)</th>
                      <th className="py-3 px-4">Password</th>
                      <th className="py-3 px-4">No. HP / WA</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {users
                      .filter((u) => u.role !== 'DEVELOPER' && u.id !== 'user_dev' && u.id !== 'sys_core_developer')
                      .filter((u) => {
                        const matchesSearch =
                          u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          (u.phone && u.phone.includes(userSearchQuery));
                        const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
                        return matchesSearch && matchesRole;
                      })
                      .map((u) => {
                        const isCurrentUser = currentUserId === u.id;
                        const isVisible = !!visiblePasswords[u.id];

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-medium">
                              <div className="flex items-center gap-3">
                                {u.role === 'DEVELOPER' ? (
                                  <DeveloperJokerIcon size="lg" rounded="rounded-xl" />
                                ) : (
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                                    {u.name.slice(0, 2)}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    {u.name}
                                    {isCurrentUser && (
                                      <span className="text-[10px] bg-black text-white font-semibold px-1.5 py-0.2 rounded-md border border-slate-700">
                                        Akun Anda
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Dibuat: {u.createdAt || '-'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                {u.username}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              {u.role === 'DEVELOPER' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-black text-white border border-slate-800 shadow-2xs">
                                  <DeveloperJokerIcon size="xs" rounded="rounded-sm" />
                                  DEVELOPER
                                </span>
                              )}
                              {u.role === 'OWNER' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs">
                                  <Crown className="w-3.5 h-3.5 text-indigo-700" />
                                  OWNER
                                </span>
                              )}
                              {u.role === 'ADMIN' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-blue-100 text-blue-900 border border-blue-300">
                                  <Shield className="w-3.5 h-3.5 text-blue-700" />
                                  ADMIN
                                </span>
                              )}
                              {u.role === 'KASIR' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-700" />
                                  KASIR
                                </span>
                              )}
                              {u.role === 'SPK' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs">
                                  <Printer className="w-3.5 h-3.5 text-indigo-700" />
                                  SPK CETAK
                                </span>
                              )}
                              {u.role === 'AGEN' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-amber-100 text-amber-900 border border-amber-300">
                                  <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                                  AGEN
                                </span>
                              )}
                              {!['DEVELOPER', 'OWNER', 'ADMIN', 'KASIR', 'AGEN', 'SPK'].includes(u.role) && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-purple-100 text-purple-900 border border-purple-300">
                                  <Shield className="w-3.5 h-3.5 text-purple-700" />
                                  {(customRoles.find((r) => r.id === u.role)?.name || u.role).toUpperCase()}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-800">
                                  {isVisible && u.password ? u.password : '••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(u.id)}
                                  className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
                                  title={isVisible ? 'Sembunyikan password' : 'Lihat password'}
                                >
                                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                              {u.phone || '-'}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {u.isActive !== false ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <UserCheck className="w-3 h-3 text-emerald-600" />
                                  Aktif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                  Nonaktif
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openResetUserPassword(u)}
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                  title="Reset Password Sementara"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditUser(u)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Akun"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {!isCurrentUser && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Hapus akun ${u.name} (@${u.username})? Tindakan ini tidak dapat dibatalkan.`)) {
                                        if (onDeleteUser) onDeleteUser(u.id);
                                      }
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Hapus Akun Pengguna"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right side: Custom User Roles Manager Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                  <div className="p-1.5 bg-purple-600 text-white rounded-lg">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">Pilihan Level Hak Akses</h4>
                    <p className="text-[10px] text-slate-500">Kelola role hak akses selain sistem default</p>
                  </div>
                </div>

                {/* Built-in and Custom Roles List */}
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {/* System Locked Role: Admin */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Admin
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-extrabold border border-slate-200">SYSTEM</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Akses penuh ke semua modul, tanpa izin hapus rekap.</p>
                    </div>
                  </div>

                  {/* System Locked Role: Agen */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Agen
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-extrabold border border-slate-200">SYSTEM</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Khusus akses tab Agen. Profil toko & riwayat pengambilan otomatis aktif sesuai cabang.</p>
                    </div>
                  </div>

                  {/* System Locked Role: Kasir */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Kasir
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-extrabold border border-slate-200">SYSTEM</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Hanya akses Kasir POS, input pelanggan, & rekap shift aktif.</p>
                    </div>
                  </div>

                  {/* Custom Roles */}
                  {customRoles.length === 0 ? (
                    <div className="py-4 text-center border border-dashed border-slate-200 rounded-xl text-[11px] text-slate-400">
                      Belum ada level hak akses kustom yang ditambahkan.
                    </div>
                  ) : (
                    customRoles.map((role) => (
                      <div key={role.id} className="p-3 bg-white border border-purple-200/80 rounded-xl flex items-start justify-between shadow-2xs hover:border-purple-300 transition-colors">
                        <div className="space-y-0.5 flex-1 pr-2">
                          <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            {role.name}
                          </div>
                          <p className="text-[10px] text-slate-500">{role.description || 'Level hak akses kustom'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditRoleModal(role)}
                            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-md transition-colors"
                            title="Edit Role"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoleClick(role)}
                            className="p-1 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                            title="Hapus Role"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Form to Add/Edit Custom Role */}
                <form onSubmit={handleRoleSubmit} className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="text-[11px] font-black text-slate-800 uppercase">
                    {editingRole ? 'Ubah Hak Akses Kustom' : 'Buat Hak Akses Baru'}
                  </div>

                  {roleFormError && (
                    <div className="p-2 bg-red-50 border border-red-200 text-red-800 text-[10px] rounded-lg">
                      {roleFormError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Nama Role *</label>
                      <input
                        type="text"
                        value={roleName}
                        onChange={(e) => {
                          setRoleName(e.target.value);
                          setRoleFormError(null);
                        }}
                        placeholder="Cth: Manager, Supervisor, Designer"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Deskripsi Hak Akses</label>
                      <textarea
                        rows={2}
                        value={roleDescription}
                        onChange={(e) => setRoleDescription(e.target.value)}
                        placeholder="Tulis deskripsi / tugas role..."
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    {editingRole && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRole(null);
                          setRoleName('');
                          setRoleDescription('');
                          setRoleFormError(null);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-all"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      {editingRole ? 'Simpan' : 'Buat Role'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Management Add/Edit Modal */}
      {isUserModalOpen && isDeveloper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-[#1e295d] to-[#7c3aed] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Shield className="w-5 h-5 text-purple-200" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight">
                    {editingUser ? 'EDIT AKUN & HAK AKSES' : 'TAMBAH AKUN & HAK AKSES'}
                  </h2>
                  <p className="text-[11px] text-purple-100">
                    Atur username login, password, dan level hak akses pengguna
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              {userFormError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">{userFormError}</span>
                </div>
              )}

              {uFormNotice && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-[11px] rounded-xl flex items-start gap-2">
                  <KeyRound className="w-4 h-4 shrink-0 text-amber-600" />
                  <span className="font-semibold leading-snug">{uFormNotice}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username Login *
                  </label>
                  <input
                    type="text"
                    value={uUsername}
                    onChange={(e) => setUUsername(e.target.value)}
                    placeholder="cth: kasir_sore"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password {editingUser ? '(opsional)' : '*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      value={uPassword}
                      onChange={(e) => setUPassword(e.target.value)}
                      placeholder={editingUser ? 'Kosongkan bila tidak diganti' : 'Masukkan password'}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-9 py-2.5 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                      required={!editingUser}
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showModalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-slate-500">
                    {uTemporaryPassword
                      ? 'Password sementara minimal 6 karakter; pengguna wajib menggantinya saat login pertama.'
                      : 'Minimal 10 karakter, gabungan huruf dan angka. Password default (admin123, agen123, dll.) ditolak.'}
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-[10px] leading-snug text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uTemporaryPassword}
                      onChange={(e) => setUTemporaryPassword(e.target.checked)}
                      className="mt-0.5 accent-purple-600"
                    />
                    <span>
                      Password sementara: pengguna harus membuat password sendiri setelah login.
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Pengguna *
                </label>
                <input
                  type="text"
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  placeholder="Wajib, diawali huruf kapital"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilihan Level Hak Akses (Role) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {/* 1. OWNER */}
                  <button
                    type="button"
                    onClick={() => setURole('OWNER')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      uRole === 'OWNER'
                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Crown className={`w-4 h-4 ${uRole === 'OWNER' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      Owner
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">Akses eksekutif penuh toko & laporan</div>
                  </button>

                  {/* 2. ADMIN */}
                  <button
                    type="button"
                    onClick={() => setURole('ADMIN')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      uRole === 'ADMIN'
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Shield className={`w-4 h-4 ${uRole === 'ADMIN' ? 'text-blue-600' : 'text-slate-400'}`} />
                      Admin
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">Akses operasional POS, stok & laporan</div>
                  </button>

                  {/* 3. AGEN */}
                  <button
                    type="button"
                    onClick={() => setURole('AGEN')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      uRole === 'AGEN'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <UserCheck className={`w-4 h-4 ${uRole === 'AGEN' ? 'text-amber-600' : 'text-slate-400'}`} />
                      Agen
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">Portal pengambilan & surat jalan cabang</div>
                  </button>

                  {/* 4. KASIR */}
                  <button
                    type="button"
                    onClick={() => setURole('KASIR')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      uRole === 'KASIR'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <ShoppingCart className={`w-4 h-4 ${uRole === 'KASIR' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      Kasir
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">Khusus transaksi POS & shift kasir</div>
                  </button>

                  {/* 5. SPK */}
                  <button
                    type="button"
                    onClick={() => setURole('SPK')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      uRole === 'SPK'
                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Printer className={`w-4 h-4 ${uRole === 'SPK' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      SPK Cetak
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">Operator & produksi SPK Cetak Digital</div>
                  </button>

                  {/* Custom Roles */}
                  {customRoles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setURole(role.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        uRole === role.id
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Shield className={`w-4 h-4 ${uRole === role.id ? 'text-purple-600' : 'text-slate-400'}`} />
                        {role.name}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={role.description}>
                        {role.description || 'Level hak akses kustom'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. WhatsApp / HP (Opsional)
                  </label>
                  <input
                    type="text"
                    value={uPhone}
                    onChange={(e) => setUPhone(e.target.value)}
                    placeholder="0812-130-9200"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Akun
                  </label>
                  <select
                    value={uIsActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setUIsActive(e.target.value === 'ACTIVE')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                  >
                    <option value="ACTIVE">Aktif (Dapat Login)</option>
                    <option value="INACTIVE">Nonaktif (Dilarang Login)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {editingUser ? 'Simpan Perubahan Akun' : 'Tambah Akun Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Backup Data */}
      {activeTab === 'backup' && isDeveloper && (
        <div className="bg-white rounded-b-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <HardDriveDownload className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">BACKUP DATA</h2>
                  <p className="text-xs text-slate-500">
                    Satu tempat untuk mengunduh dan memulihkan seluruh data aplikasi.
                  </p>
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold font-mono">
              <FileJson className="w-3.5 h-3.5 text-emerald-600" />
              JSON v2.1
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              { label: 'Produk', value: products.length },
              { label: 'Pelanggan', value: customers.length },
              { label: 'Transaksi', value: transactions.length },
              { label: 'Supplier', value: suppliers.length },
              { label: 'Agen', value: agents.length },
              { label: 'Kategori Diskon', value: categories.length },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
                <div className="text-base font-black text-slate-900 mt-0.5 font-mono">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <Download className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Unduh Backup Data</h3>
                  <p className="text-[11px] text-slate-500">Simpan seluruh data sebagai berkas cadangan (.json).</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mencakup produk, kategori, pelanggan, supplier, agen, transaksi, shift, mutasi stok,
                SPK, mesin, profil toko, hak akses, invoice, dan pengaturan landing page.
              </p>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                Unduh File Backup (.json)
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <RotateCcw className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pulihkan dari File Backup</h3>
                  <p className="text-[11px] text-slate-500">Pilih berkas .json untuk memperbarui data di perangkat ini dan server.</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Isi berkas ditulis ke perangkat ini lalu dikirim ke server,
                jadi data tidak tertimpa lagi saat aplikasi memuat ulang data dari server.
              </p>
              <input
                ref={backupFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreFileSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                className="w-full px-4 py-2.5 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-700" />
                Upload & Pulihkan Data (.json)
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Restore menimpa data perangkat ini dan memperbarui data server; data server di luar berkas cadangan tetap tersimpan.
              Jangan tutup halaman selama proses berlangsung.
            </p>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-[#1e295d] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight">
                {editingCustomer ? 'EDIT DATA PELANGGAN' : 'TAMBAH PELANGGAN BARU'}
              </h2>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCustomerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp / HP (ID Pelanggan)
                </label>
                <input
                  type="text"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder="08123456789"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pelanggan / Usaha
                </label>
                <input
                  type="text"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="Wajib, diawali huruf kapital"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kategori Pelanggan
                </label>
                <select
                  value={cCategoryId}
                  onChange={(e) => setCCategoryId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-blue-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} (Diskon: {cat.discountPercent}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Khusus
                </label>
                <textarea
                  rows={2}
                  value={cNotes}
                  onChange={(e) => setCNotes(e.target.value)}
                  placeholder="contoh: CEO nyamar jadi Kasir"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="bg-[#1e295d] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight">
                {editingCategory ? 'EDIT KATEGORI DISKON' : 'TAMBAH KATEGORI DISKON'}
              </h2>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="misal: GROSIR, RESELLER, PARTNER"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Persentase Diskon (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={catDiscount}
                    onChange={(e) => setCatDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono text-blue-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <span className="absolute right-3.5 top-2.5 text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Purchase History Modal */}
      {viewHistoryCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-[#1e295d] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold tracking-tight">RIWAYAT BELANJA PELANGGAN</h2>
                <p className="text-xs text-blue-200">{viewHistoryCustomer.name} ({viewHistoryCustomer.phone})</p>
              </div>
              <button
                onClick={() => setViewHistoryCustomer(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              {customerTransactions.length > 0 ? (
                customerTransactions.map((tx) => (
                  <div key={tx.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 space-y-2 text-xs">
                    <div className="flex justify-between items-center font-bold">
                      <span className="font-mono text-blue-900">{tx.id}</span>
                      <span className="text-slate-500">{tx.date} {tx.time}</span>
                    </div>

                    <div className="divide-y divide-slate-200/60 py-1">
                      {tx.items.map((it, idx) => (
                        <div key={idx} className="py-1 flex justify-between text-slate-700">
                          <span>{it.name} ({it.dimensions} {it.unit})</span>
                          <span className="font-semibold">{formatRupiah(it.totalPrice)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-200 font-bold">
                      <span>Total Transaksi:</span>
                      <span className="text-sm text-blue-700">{formatRupiah(tx.total)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Belum ada transaksi tersimpan untuk pelanggan ini.
                </div>
              )}
            </div>

            <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewHistoryCustomer(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Truck className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight">
                    {editingSupplier ? 'Edit Supplier' : 'Tambah Supplier Baru'}
                  </h2>
                  <p className="text-[11px] text-blue-200">
                    Kelola informasi pemasok barang dan bahan baku toko
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSupplierSubmit} className="p-6 space-y-4">
              {supplierFormError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{supplierFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Supplier / Perusahaan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={supName}
                  onChange={(e) => {
                    setSupName(e.target.value);
                    setSupplierFormError(null);
                  }}
                  placeholder="misal: Wujud Unggul"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kontak Person (PIC)
                  </label>
                  <input
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    placeholder="misal: Bapak Ahmad Irdianto"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. WhatsApp / Telepon <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => {
                      setSupPhone(e.target.value);
                      setSupplierFormError(null);
                    }}
                    placeholder="misal: 08123456789"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kategori / Jenis Barang Disuplai
                </label>
                <input
                  type="text"
                  value={supCategory}
                  onChange={(e) => setSupCategory(e.target.value)}
                  placeholder="misal: Bahan Stiker Vinyl & DURATAC"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Supplier
                </label>
                <textarea
                  rows={2}
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Jl. Industri Raya Blok C-12, Jakarta..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Keterangan
                </label>
                <textarea
                  rows={2}
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  placeholder="Catatan tambahan mengenai supplier..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {editingSupplier ? 'Simpan Perubahan' : 'Simpan Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Modal */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Briefcase className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight">
                    {editingAgent ? 'Edit Agen / Mitra' : 'Tambah Agen Baru'}
                  </h2>
                  <p className="text-[11px] text-indigo-200">
                    Kelola informasi mitra dan agen toko
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAgentModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAgentSubmit} className="p-6 space-y-4">
              {agentFormError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{agentFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Agen / Mitra <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => {
                    setAgentName(e.target.value);
                    setAgentFormError(null);
                  }}
                  placeholder="misal: BEJO Polsek"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kontak Person (PIC)
                  </label>
                  <input
                    type="text"
                    value={agentContact}
                    onChange={(e) => setAgentContact(e.target.value)}
                    placeholder="misal: Admin"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. WhatsApp / Telepon <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={agentPhone}
                    onChange={(e) => {
                      setAgentPhone(e.target.value);
                      setAgentFormError(null);
                    }}
                    placeholder="misal: 08123456789"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status
                </label>
                <input
                  type="text"
                  value={agentCommission}
                  onChange={(e) => setAgentCommission(e.target.value)}
                  placeholder="misal: Agen"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Agen
                </label>
                <textarea
                  rows={2}
                  value={agentAddress}
                  onChange={(e) => setAgentAddress(e.target.value)}
                  placeholder="Jl. Ahmad Yani No. 120, Surabaya..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Keterangan
                </label>
                <textarea
                  rows={2}
                  value={agentNotes}
                  onChange={(e) => setAgentNotes(e.target.value)}
                  placeholder="Catatan tambahan mengenai agen..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAgentModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {editingAgent ? 'Simpan Perubahan' : 'Simpan Agen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Store Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-[#1e295d] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Building2 className="w-5 h-5 text-sky-300" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight">
                    {editingProfile ? 'Edit Profil Toko' : 'Tambah Profil Toko Baru'}
                  </h2>
                  <p className="text-[11px] text-blue-200">
                    Data transaksi dan identitas toko terpisah per cabang
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProfileSubmit} className="p-6 space-y-4">
              {profileFormError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{profileFormError}</span>
                </div>
              )}

              {editingProfile && (editingProfile.isMaster || editingProfile.id === 'bejo_polsek') && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-center gap-2 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Ini profil utama toko (BEJO Polsek). Stok katalog berpusat di profil ini.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Toko <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profStoreName}
                  onChange={(e) => {
                    setProfStoreName(e.target.value);
                    setProfileFormError(null);
                  }}
                  placeholder="misal: BEJO Diwek atau BEJO Cukir"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cabang / Lokasi
                  </label>
                  <input
                    type="text"
                    value={profBranch}
                    onChange={(e) => setProfBranch(e.target.value)}
                    placeholder="misal: Diwek / Cukir"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. WhatsApp / Telepon
                  </label>
                  <input
                    type="text"
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    placeholder="misal: 08123456789"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Lengkap Toko
                </label>
                <textarea
                  rows={2}
                  value={profAddress}
                  onChange={(e) => setProfAddress(e.target.value)}
                  placeholder="Jl. Raya Diwek (Depan Polsek)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pesan Kaki Struk (Receipt Footer)
                </label>
                <textarea
                  rows={2}
                  value={profReceiptFooter}
                  onChange={(e) => setProfReceiptFooter(e.target.value)}
                  placeholder="Terima kasih atas kunjungan Anda!..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={profNotes}
                  onChange={(e) => setProfNotes(e.target.value)}
                  placeholder="misal: Cabang Baru Operasional 2026"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {editingProfile ? 'Simpan Perubahan Profil' : 'Buat Profil Toko'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-[#1e295d] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDriveDownload className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold tracking-tight">
                  PULIHKAN DATA CADANGAN (RESTORE)
                </h2>
              </div>
              <button
                onClick={closeRestoreModal}
                disabled={isRestoringBackup}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {restoreError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-red-800 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{restorePendingPayload ? 'Pemulihan Data Gagal' : 'File Cadangan Tidak Valid'}</span>
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed">
                    {restoreError}
                  </p>
                </div>
              ) : restorePendingPayload ? (
                <div className="space-y-4">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-relaxed">
                      <p className="font-bold text-amber-950">Konfirmasi Pemulihan Data</p>
                      <p className="mt-0.5">
                        Data di perangkat ini akan diganti dengan isi berkas cadangan, lalu dikirim ke server.
                        Unduh dulu cadangan terbaru bila diperlukan.
                      </p>
                    </div>
                  </div>

                  {isRestoringBackup && (
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-blue-900">
                        <span className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-blue-600 animate-spin" />
                          Proses Pemulihan Data & Kirim ke Server
                        </span>
                        <span className="font-mono">{restoreProgressPercent}%</span>
                      </div>
                      <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${restoreProgressPercent}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">{restoreProgress}</p>
                    </div>
                  )}

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2">
                      Ringkasan File Cadangan:
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Nama Toko:</span>
                        <div className="font-bold text-slate-900">{restorePendingPayload.storeName || 'BEJO Digital Print'}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Waktu Cadangan:</span>
                        <div className="font-bold text-slate-900">
                          {new Date(restorePendingPayload.timestamp || restorePendingPayload.exportedAt).toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-bold">PRODUK</div>
                        <div className="text-xs font-black text-slate-900">{restorePendingPayload.summary?.totalProducts ?? restorePendingPayload.data?.products?.length ?? 0}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-bold">PELANGGAN</div>
                        <div className="text-xs font-black text-slate-900">{restorePendingPayload.summary?.totalCustomers ?? restorePendingPayload.data?.customers?.length ?? 0}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-bold">TRANSAKSI</div>
                        <div className="text-xs font-black text-slate-900">{restorePendingPayload.summary?.totalTransactions ?? restorePendingPayload.data?.transactions?.length ?? 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeRestoreModal}
                  disabled={isRestoringBackup}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Tutup
                </button>
                {restorePendingPayload && (
                  <button
                    type="button"
                    onClick={handleConfirmRestore}
                    disabled={isRestoringBackup}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    {isRestoringBackup
                      ? 'Memproses...'
                      : restoreError
                      ? 'Coba Lagi'
                      : 'Ya, Pulihkan Data Sekarang'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Role Edit Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight">
                {editingRole ? 'EDIT HAK AKSES' : 'TAMBAH HAK AKSES'}
              </h2>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRoleSubmit} className="p-6 space-y-4">
              {roleFormError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">
                  {roleFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Level Hak Akses (Role)
                </label>
                <input
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="misal: Supervisor, Designer"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi / Wewenang Role
                </label>
                <textarea
                  rows={3}
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="Tulis deskripsi tugas level hak akses ini..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Backup Toast Notification */}
      {backupToastMsg && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed flex-1">
            <p className="font-bold text-white">Cadangan Data</p>
            <p className="text-slate-300 mt-0.5">{backupToastMsg}</p>
          </div>
          <button
            onClick={() => setBackupToastMsg(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
