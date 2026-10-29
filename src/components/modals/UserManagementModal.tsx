/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useMemo } from 'react';
import {
  X,
  UserCheck,
  UserPlus,
  Shield,
  Crown,
  ShoppingCart,
  Trash2,
  Edit2,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Users,
  Clock,
  History,
  FileText,
  Search,
  Filter,
  Download,
  Trash,
  LogIn,
  LogOut,
  Package,
  Activity,
  UserCog,
  ArrowUpDown,
  Printer,
  ShieldAlert
} from 'lucide-react';
import { AppUser, UserRole, UserActivityLog, ActivityActionType } from '../../types';
import { DeveloperJokerIcon } from '../DeveloperJokerIcon';
import { isReservedDeveloperUsername } from '../../utils/authSecurity';
import {
  checkPasswordPolicy,
  checkTemporaryPassword,
  generateStrongPassword,
  isPasswordMasked,
  MIN_PASSWORD_LENGTH,
  MIN_TEMPORARY_PASSWORD_LENGTH,
} from '../../utils/credentialPolicy';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AppUser[];
  currentUserId?: string;
  currentUserRole?: UserRole;
  activityLogs?: UserActivityLog[];
  onSaveUser: (user: AppUser) => Promise<void> | void;
  onDeleteUser: (userId: string) => Promise<void> | void;
  onClearLogs?: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUserId,
  currentUserRole = 'DEVELOPER',
  activityLogs = [],
  onSaveUser,
  onDeleteUser,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'logs'>('accounts');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('SPK');
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formTemporaryPassword, setFormTemporaryPassword] = useState(true);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Extract all custom user roles dynamically
  const customRolesFromUsers = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.role && !['ADMIN', 'KASIR', 'AGEN', 'OWNER', 'DEVELOPER', 'SPK'].includes(u.role.toUpperCase())) {
        set.add(u.role.toUpperCase());
      }
    });
    return Array.from(set);
  }, [users]);

  // Log filter states
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedLogUser, setSelectedLogUser] = useState<string>('ALL');
  const [selectedLogAction, setSelectedLogAction] = useState<string>('ALL');

  // Jangan mengembalikan null sebelum semua hook di bawah: modal selalu
  // ter-mount untuk developer, jadi early return di sini membuat urutan hook
  // berubah saat modal pertama dibuka (React error #310, layar blank).
  const isDeveloper = currentUserRole === 'DEVELOPER';

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormPassword('');
    setFormName('');
    setFormRole('SPK');
    setCustomRoleInput('');
    setFormPhone('');
    setFormIsActive(true);
    // Akun baru selalu diberi password sementara: username + password awal
    // boleh sederhana (mis. admin / admin123), lalu wajib diganti saat login.
    setFormTemporaryPassword(true);
    setFormNotice(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword(user.password || '');
    setFormName(user.name);
    setFormRole(user.role);
    if (!['ADMIN', 'KASIR', 'AGEN', 'OWNER', 'DEVELOPER', 'SPK'].includes(user.role.toUpperCase())) {
      setCustomRoleInput(user.role);
    } else {
      setCustomRoleInput('');
    }
    setFormPhone(user.phone || '');
    setFormIsActive(user.isActive !== false);
    // Saat mengedit tanpa mengganti password, flag tidak berpengaruh di server.
    setFormTemporaryPassword(user.mustChangePassword === true);
    setFormNotice(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  /** Reset password oleh Developer: isi password baru sementara + wajib ganti. */
  const handleOpenResetPassword = (user: AppUser) => {
    handleOpenEdit(user);
    setFormPassword(generateStrongPassword());
    setFormTemporaryPassword(true);
    setShowPassword(true);
    setFormNotice(
      'Password sementara baru sudah dibuat. Salin password di kolom Password dan berikan ke pengguna — ia wajib mengganti sendiri saat login pertama.'
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUsername = formUsername.trim().toLowerCase();
    const cleanPassword = formPassword.trim();
    const cleanName = formName.trim();

    if (!cleanUsername) {
      setFormError('Username wajib diisi.');
      return;
    }
    if (!cleanPassword && !editingUser) {
      setFormError('Password wajib diisi untuk akun baru.');
      return;
    }
    if (!cleanName) {
      setFormError('Nama pengguna wajib diisi.');
      return;
    }

    // Protect reserved developer username
    if (isReservedDeveloperUsername(cleanUsername)) {
      setFormError('Username ini dicadangkan untuk sistem internal.');
      return;
    }

    // Check username duplication
    const duplicate = users.find(
      (u) =>
        u.username.toLowerCase() === cleanUsername &&
        (!editingUser || u.id !== editingUser.id)
    );
    if (duplicate) {
      setFormError(`Username "${cleanUsername}" sudah digunakan oleh pengguna lain.`);
      return;
    }

    if (cleanPassword && !isPasswordMasked(cleanPassword)) {
      const problem = formTemporaryPassword
        ? checkTemporaryPassword(cleanPassword)
        : checkPasswordPolicy(cleanUsername, cleanPassword);
      if (problem) {
        setFormError(problem.message);
        return;
      }
    }

    const today = new Date();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dateFormatted = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

    const updatedUser: AppUser = {
      id: editingUser ? editingUser.id : `user_${Date.now()}`,
      username: cleanUsername,
      password: cleanPassword,
      name: cleanName,
      role: formRole,
      phone: formPhone.trim() || undefined,
      isActive: formIsActive,
      createdAt: editingUser ? editingUser.createdAt : dateFormatted,
      avatarUrl: editingUser?.avatarUrl || '',
      mustChangePassword: formTemporaryPassword,
    };

    // Server yang menyimpan akun ini (browser tidak punya hak tulis koleksi auth),
    // jadi form baru boleh ditutup setelah penyimpanan dikonfirmasi.
    setIsSaving(true);
    try {
      await onSaveUser(updatedUser);
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Akun gagal disimpan ke database cloud. Coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered activity logs
  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      // Search text match
      const query = logSearchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        log.username.toLowerCase().includes(query) ||
        log.name.toLowerCase().includes(query) ||
        log.actionTitle.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        log.formattedDateTime.toLowerCase().includes(query);

      // User filter match
      const matchUser =
        selectedLogUser === 'ALL' ||
        log.username.toLowerCase() === selectedLogUser.toLowerCase() ||
        log.role.toLowerCase() === selectedLogUser.toLowerCase();

      // Action type match
      let matchAction = true;
      if (selectedLogAction !== 'ALL') {
        if (selectedLogAction === 'LOGIN_LOGOUT') {
          matchAction = log.actionType === 'LOGIN' || log.actionType === 'LOGOUT';
        } else if (selectedLogAction === 'TRANSACTION') {
          matchAction = log.actionType === 'TRANSACTION';
        } else if (selectedLogAction === 'SHIFT') {
          matchAction = log.actionType === 'SHIFT_OPEN' || log.actionType === 'SHIFT_CLOSE';
        } else if (selectedLogAction === 'STOCK') {
          matchAction = log.actionType === 'STOCK_MUTATION';
        } else if (selectedLogAction === 'USER_MANAGEMENT') {
          matchAction = log.actionType === 'USER_MANAGEMENT';
        } else {
          matchAction = log.actionType === selectedLogAction;
        }
      }

      return matchSearch && matchUser && matchAction;
    });
  }, [activityLogs, logSearchQuery, selectedLogUser, selectedLogAction]);

  if (!isOpen) return null;

  // Export logs to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('Tidak ada data log yang dapat diekspor.');
      return;
    }

    const headers = ['Waktu', 'Username', 'Nama Pengguna', 'Role', 'Tipe Aksi', 'Aktivitas', 'Detail Ringkasan'];
    const rows = filteredLogs.map((log) => [
      `"${log.formattedDateTime}"`,
      `"${log.username}"`,
      `"${log.name}"`,
      `"${log.role}"`,
      `"${log.actionType}"`,
      `"${log.actionTitle.replace(/"/g, '""')}"`,
      `"${log.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Log_Record_Aktivitas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper relative time formatter
  const getRelativeTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam lalu`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} hari lalu`;
  };

  // Action badge helper
  const renderActionBadge = (actionType: ActivityActionType) => {
    switch (actionType) {
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
            <LogIn className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            LOGIN
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            <LogOut className="w-3 h-3 text-slate-500" />
            LOGOUT
          </span>
        );
      case 'TRANSACTION':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
            <ShoppingCart className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            TRANSAKSI
          </span>
        );
      case 'SHIFT_OPEN':
      case 'SHIFT_CLOSE':
      case 'SHIFT_DELETE':
      case 'SHIFT_CLEAR_ALL':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
            <Clock className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            SHIFT KASIR
          </span>
        );
      case 'STOCK_MUTATION':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
            <Package className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            MUTASI STOK
          </span>
        );
      case 'USER_MANAGEMENT':
        return (
          <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
            <UserCog className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            KELOLA AKUN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            <Activity className="w-3 h-3 text-slate-500" />
            SISTEM
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-[#3c3c3c] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1e295d] via-[#1a2350] to-[#0ea5e9] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Users className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight uppercase flex items-center gap-2">
                Manajemen Akun Pengguna & Hak Akses
                {isDeveloper && (
                  <span className="text-[10px] bg-black/50 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-mono normal-case">
                    Mode Developer
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-blue-100">
                Kelola wewenang akun (Developer, Admin, Agen, Kasir) & Audit Log Record Waktu Login & Aktivitas Sistem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Developer Tab Navigation (Hanya Muncul Untuk DEVELOPER) */}
        {isDeveloper && (
          <div className="bg-slate-100 dark:bg-[#202020] border-b border-slate-200 dark:border-[#3c3c3c] px-4 py-2 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('accounts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'accounts'
                  ? 'bg-white dark:bg-[#2b2b2b] text-blue-900 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-[#3c3c3c]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#2b2b2b]'
              }`}
            >
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Daftar Akun & Wewenang</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-[#2b2b2b] text-purple-900 dark:text-purple-300 shadow-sm border border-slate-200 dark:border-[#3c3c3c]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#2b2b2b]'
              }`}
            >
              <History className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Log Record Aktivitas & Login</span>
              <span className="bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ml-0.5">
                {activityLogs.length}
              </span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'accounts' ? (
            /* TAB 1: ACCOUNTS & USER MANAGEMENT */
            isFormOpen ? (
              /* Add/Edit User Form */
              <form onSubmit={handleSubmit} className="bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#3c3c3c] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#3c3c3c]">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white">
                    {editingUser ? 'Edit Akun Pengguna' : 'Tambah Pengguna Baru'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium"
                  >
                    Kembali ke Daftar
                  </button>
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span>{formError}</span>
                  </div>
                )}

                {formNotice && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs rounded-xl flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span className="leading-snug">{formNotice}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Username (Login) *
                    </label>
                    <input
                      type="text"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="cth: kasir_pagi"
                      className="w-full bg-white dark:bg-[#2b2b2b] border border-slate-300 dark:border-[#3c3c3c] rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Password {editingUser ? '(opsional)' : '*'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder={editingUser ? 'Kosongkan bila tidak diganti' : 'Masukkan password'}
                        className="w-full bg-white dark:bg-[#2b2b2b] border border-slate-300 dark:border-[#3c3c3c] rounded-xl pl-3 pr-9 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 dark:text-white"
                        required={!editingUser}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                      {formTemporaryPassword
                        ? `Password sementara minimal ${MIN_TEMPORARY_PASSWORD_LENGTH} karakter (boleh sederhana, mis. admin123). User wajib mengganti sendiri saat login.`
                        : `Minimal ${MIN_PASSWORD_LENGTH} karakter, gabungan huruf dan angka. Password default (admin123, agen123, dll.) ditolak.`}
                    </p>
                    <label className="mt-1.5 flex items-start gap-1.5 text-[10px] font-semibold text-amber-900 dark:text-amber-300 leading-snug cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formTemporaryPassword}
                        onChange={(e) => setFormTemporaryPassword(e.target.checked)}
                        className="mt-0.5 w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span>Password sementara — user wajib mengganti username & password saat login pertama</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Lengkap / Tampilan *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="cth: FIRA (Kasir 1)"
                      className="w-full bg-white dark:bg-[#2b2b2b] border border-slate-300 dark:border-[#3c3c3c] rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      No. WhatsApp / HP (Opsional)
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="08123456789"
                      className="w-full bg-white dark:bg-[#2b2b2b] border border-slate-300 dark:border-[#3c3c3c] rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Pilihan Hak Akses (Role) Default Akun *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {/* 1. OWNER */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormRole('OWNER');
                        setCustomRoleInput('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formRole === 'OWNER'
                          ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                          : 'border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#2b2b2b]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300 font-black text-xs mb-1">
                          <Crown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Owner (Pemilik)
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                          Akses eksekutif penuh: POS Kasir, Katalog Produk, Stok Gudang, Pengaturan Toko & Profil Cabang, Laporan Penjualan & Keuangan, Pelanggan, Mitra & Shift.
                        </div>
                      </div>
                    </button>

                    {/* 2. ADMIN */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormRole('ADMIN');
                        setCustomRoleInput('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formRole === 'ADMIN'
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-500'
                          : 'border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#2b2b2b]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300 font-bold text-xs mb-1">
                          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          Admin
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                          Akses operasional penuh: POS Kasir, Katalog Produk, Stok Gudang & Mutasi, Pelanggan, Supplier, Agen & Laporan Penjualan Transaksi.
                        </div>
                      </div>
                    </button>

                    {/* 3. AGEN */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormRole('AGEN');
                        setCustomRoleInput('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formRole === 'AGEN'
                          ? 'border-amber-600 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-500'
                          : 'border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#2b2b2b]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold text-xs mb-1">
                          <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          Agen
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                          Akses khusus Portal Agen: Pemesanan & Pengambilan bahan baku, katalog harga agen, serta cetak surat jalan cabang agen terkait.
                        </div>
                      </div>
                    </button>

                    {/* 4. KASIR */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormRole('KASIR');
                        setCustomRoleInput('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formRole === 'KASIR'
                          ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-500'
                          : 'border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#2b2b2b]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-300 font-bold text-xs mb-1">
                          <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Kasir
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                          Akses kasir harian: POS penjualan reguler, buka/tutup shift kasir & cetak struk nota thermal 80mm.
                        </div>
                      </div>
                    </button>

                    {/* 5. SPK */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormRole('SPK');
                        setCustomRoleInput('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        formRole === 'SPK'
                          ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                          : 'border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#2b2b2b]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300 font-bold text-xs mb-1">
                          <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          SPK Cetak
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                          Akses operator & produksi SPK Cetak Digital: Manajemen mesin, alur kerja Kanban & detail order cetak.
                        </div>
                      </div>
                    </button>

                    {/* DYNAMIC CUSTOM ROLES */}
                    {customRolesFromUsers.map((cr) => (
                      <button
                        key={cr}
                        type="button"
                        onClick={() => {
                          setFormRole(cr as UserRole);
                          setCustomRoleInput(cr);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          formRole.toUpperCase() === cr
                            ? 'border-purple-600 dark:border-purple-500 bg-purple-50 dark:bg-purple-950/40 ring-2 ring-purple-500'
                            : 'border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#2b2b2b]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-300 font-bold text-xs mb-1">
                            <UserCog className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            Role {cr}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                            Role kustom tersimpan.
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Quick Preset Selector for Role AGEN */}
                  {formRole === 'AGEN' && (
                    <div className="mt-2.5 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-300 dark:border-amber-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          Pilih Cepat Profil Cabang Agen:
                        </label>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                          Klik untuk isi otomatis
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          { username: 'tanon', name: 'BEJO Tanon' },
                          { username: 'ceweng', name: 'BEJO Ceweng' },
                          { username: 'jombang', name: 'BEJO Jombang' },
                          { username: 'somet', name: 'BEJO Somet' }
                        ].map((preset) => (
                          <button
                            key={preset.username}
                            type="button"
                            onClick={() => {
                              setFormUsername(preset.username);
                              setFormName(preset.name);
                              // Jangan isi password default publik: buat acak kuat
                              // supaya admin bisa menyalinnya dari kolom password.
                              if (!formPassword || isPasswordMasked(formPassword)) {
                                setFormPassword(generateStrongPassword());
                                setShowPassword(true);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer text-left ${
                              formUsername.toLowerCase() === preset.username.toLowerCase()
                                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                : 'bg-white dark:bg-[#2b2b2b] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-[#3c3c3c] hover:border-amber-400'
                            }`}
                          >
                            <div className="leading-tight">{preset.name}</div>
                            <div className={`text-[10px] font-mono ${formUsername.toLowerCase() === preset.username.toLowerCase() ? 'text-amber-100' : 'text-slate-500'}`}>
                              @{preset.username}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Custom Role Input Field */}
                  <div className="mt-2.5 bg-slate-100 dark:bg-[#252525] p-3 rounded-xl border border-dashed border-slate-300 dark:border-[#444] space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <UserCog className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        Atau Tambah Role Baru (Isi Manual)
                      </label>
                      {formRole && !['ADMIN', 'KASIR', 'AGEN', 'DEVELOPER'].includes(formRole.toUpperCase()) && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-extrabold px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                          Role Terpilih: {formRole}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customRoleInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomRoleInput(val);
                          if (val.trim()) {
                            setFormRole(val.trim().toUpperCase() as UserRole);
                          } else {
                            setFormRole('KASIR');
                          }
                        }}
                        onFocus={() => {
                          if (customRoleInput.trim()) {
                            setFormRole(customRoleInput.trim().toUpperCase() as UserRole);
                          }
                        }}
                        placeholder="Ketik nama role baru (cth: MANAGER, SUPERVISOR, SPV)"
                        className="w-full bg-white dark:bg-[#2b2b2b] border border-slate-300 dark:border-[#3c3c3c] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 uppercase"
                      />
                      {customRoleInput.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomRoleInput('');
                            setFormRole('KASIR');
                          }}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-[#353535] hover:bg-slate-300 dark:hover:bg-[#454545] text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer"
                          title="Reset pilihan role ke Kasir"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      Ketika diketik, role baru akan otomatis dibuat dan tersimpan untuk akun ini layaknya role Admin, Kasir, dan Agen.
                    </p>
                  </div>
                </div>

                {/* Status active switch */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="user-is-active"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="user-is-active" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Akun Aktif (Dapat digunakan untuk login)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#3c3c3c]">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#353535] rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Menyimpan ke cloud...' : editingUser ? 'Perbarui Akun' : 'Simpan Pengguna'}
                  </button>
                </div>
              </form>
            ) : (
              /* User List Table */
              <div className="space-y-3">
                {(() => {
                  const visibleUsers = users.filter((u) => u.role !== 'DEVELOPER' && u.id !== 'user_dev' && u.id !== 'sys_core_developer');
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Total Pengguna Terdaftar ({visibleUsers.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          className="px-3.5 py-2 bg-[#1e295d] hover:bg-[#151e44] text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-sky-400" />
                          Tambah Pengguna Baru
                        </button>
                      </div>

                      <div className="border border-slate-200 dark:border-[#3c3c3c] rounded-2xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-[#202020] text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200 dark:border-[#3c3c3c]">
                            <tr>
                              <th className="py-3 px-3.5">Pengguna & Username</th>
                              <th className="py-3 px-3.5">Password</th>
                              <th className="py-3 px-3.5">Role & Wewenang</th>
                              <th className="py-3 px-3.5">Status</th>
                              <th className="py-3 px-3.5 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-[#3c3c3c]">
                            {visibleUsers.map((u) => {
                              const isCurrent = u.id === currentUserId;
                              return (
                                <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-[#252525] transition-colors">
                                  <td className="py-3 px-3.5">
                                    <div className="flex items-center gap-2">
                                      {u.avatarUrl ? (
                                        <img
                                          src={u.avatarUrl}
                                          alt={`Foto ${u.name}`}
                                          className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-[#3c3c3c] bg-slate-100 dark:bg-[#202020] shrink-0"
                                        />
                                      ) : (
                                        <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-[#353535] text-slate-600 dark:text-slate-300 flex items-center justify-center text-[11px] font-black shrink-0">
                                          {(u.name || u.username || '?').charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                          {u.name}
                                          {isCurrent && (
                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1.5 py-0.2 rounded font-bold">
                                              Akun Anda
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                          @{u.username}
                                        </div>
                                        {u.mustChangePassword && (
                                          <span className="mt-0.5 inline-block text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded">
                                            Wajib ganti password
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-300">
                                    <span className="bg-slate-100 dark:bg-[#202020] px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-[#3c3c3c]">
                                      {u.password || '••••••••'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5">
                                    {u.role === 'OWNER' && (
                                      <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-300 dark:border-indigo-700 shadow-2xs">
                                        <Crown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                        OWNER
                                      </span>
                                    )}
                                    {u.role === 'ADMIN' && (
                                      <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                        <Shield className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        ADMIN
                                      </span>
                                    )}
                                    {u.role === 'KASIR' && (
                                      <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                        <ShoppingCart className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        KASIR
                                      </span>
                                    )}
                                    {u.role === 'AGEN' && (
                                      <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                        <UserCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                        AGEN
                                      </span>
                                    )}
                                    {!['OWNER', 'ADMIN', 'KASIR', 'AGEN', 'DEVELOPER'].includes(u.role?.toUpperCase()) && (
                                      <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                                        <UserCog className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                        {u.role?.toUpperCase()}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5">
                                    {u.isActive !== false ? (
                                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                                        Aktif
                                      </span>
                                    ) : (
                                      <span className="text-red-600 dark:text-red-400 font-semibold text-[11px] flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400"></span>
                                        Non-aktif
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenResetPassword(u)}
                                        className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors cursor-pointer"
                                        title="Reset Password Sementara"
                                      >
                                        <KeyRound className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEdit(u)}
                                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                                        title="Edit Pengguna"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      {visibleUsers.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!confirm(`Hapus akun @${u.username} (${u.name})?`)) return;
                                            try {
                                              await onDeleteUser(u.id);
                                            } catch (err: any) {
                                              alert(err?.message || 'Akun gagal dihapus dari database cloud.');
                                            }
                                          }}
                                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                                          title="Hapus Pengguna"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
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
                  );
                })()}
              </div>
            )
          ) : (
            /* TAB 2: LOG RECORD AKTIVITAS & LOGIN (KHUSUS DEVELOPER) */
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Summary Stats Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#3c3c3c] rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="p-2.5 bg-purple-100 dark:bg-purple-950/80 rounded-xl text-purple-700 dark:text-purple-300">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Log Terekam</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">{activityLogs.length} Log</div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#3c3c3c] rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-950/80 rounded-xl text-blue-700 dark:text-blue-300">
                    <LogIn className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Aktivitas Login</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {activityLogs.filter((l) => l.actionType === 'LOGIN').length} Sesi
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#3c3c3c] rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/80 rounded-xl text-emerald-700 dark:text-emerald-300">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Aktivitas Transaksi POS</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {activityLogs.filter((l) => l.actionType === 'TRANSACTION').length} Entri
                    </div>
                  </div>
                </div>
              </div>

              {/* Toolbar Controls: Search, Filters & Export/Clear Actions */}
              <div className="bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#3c3c3c] rounded-2xl p-3 flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
                {/* Search & Filters */}
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      placeholder="Cari waktu, username, atau kata kunci..."
                      className="w-full bg-white dark:bg-[#2b2b2b] border border-slate-300 dark:border-[#3c3c3c] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 font-medium"
                    />
                  </div>

                  {/* Filter by User */}
                  <select
                    value={selectedLogUser}
                    onChange={(e) => setSelectedLogUser(e.target.value)}
                    className="bg-white dark:bg-[#2b2b2b] border border-slate-300 dark:border-[#3c3c3c] rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ALL">Semua Akun Pengguna</option>
                    <option value="DEVELOPER">Role DEVELOPER</option>
                    <option value="OWNER">Role OWNER (Pemilik)</option>
                    <option value="ADMIN">Role ADMIN</option>
                    <option value="AGEN">Role AGEN</option>
                    <option value="KASIR">Role KASIR</option>
                    {customRolesFromUsers.map((cr) => (
                      <option key={cr} value={cr}>
                        Role {cr}
                      </option>
                    ))}
                  </select>

                  {/* Filter by Action Type */}
                  <select
                    value={selectedLogAction}
                    onChange={(e) => setSelectedLogAction(e.target.value)}
                    className="bg-white dark:bg-[#2b2b2b] border border-slate-300 dark:border-[#3c3c3c] rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ALL">Semua Tipe Aktivitas</option>
                    <option value="LOGIN_LOGOUT">Sesi Login / Logout</option>
                    <option value="TRANSACTION">Transaksi POS</option>
                    <option value="SHIFT">Shift Kasir</option>
                    <option value="STOCK">Mutasi Stok</option>
                    <option value="USER_MANAGEMENT">Kelola User</option>
                  </select>
                </div>

                {/* Right Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Unduh log record dalam format CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  {onClearLogs && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Apakah Anda yakin ingin menghapus seluruh log aktivitas record? Data ini akan dibersihkan.')) {
                          onClearLogs();
                        }
                      }}
                      className="px-2.5 py-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      title="Bersihkan riwayat log"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Log List Table / List */}
              <div className="border border-slate-200 dark:border-[#3c3c3c] rounded-2xl overflow-hidden shadow-2xs">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-[#2b2b2b] text-slate-500 dark:text-slate-400 text-xs space-y-2">
                    <History className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
                    <div className="font-bold">Tidak ada log aktivitas ditemukan.</div>
                    <p className="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau filter tipe aktivitas di atas.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-[#202020] text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider text-[10px] border-b border-slate-200 dark:border-[#3c3c3c]">
                        <tr>
                          <th className="py-3 px-3.5 w-40">Waktu & Tanggal</th>
                          <th className="py-3 px-3.5 w-48">Akun Pengguna</th>
                          <th className="py-3 px-3.5 w-32">Kategori Aksi</th>
                          <th className="py-3 px-3.5">Detail Ringkasan Aktivitas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#3c3c3c]">
                        {filteredLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-[#252525] transition-colors">
                            {/* Timestamp Column */}
                            <td className="py-3 px-3.5 align-top">
                              <div className="font-bold text-slate-800 dark:text-white text-[11px]">
                                {log.formattedDateTime}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {getRelativeTime(log.timestamp)}
                              </div>
                            </td>

                            {/* User Column */}
                            <td className="py-3 px-3.5 align-top">
                              <div className="flex items-center gap-1.5">
                                {log.role === 'DEVELOPER' ? (
                                  <DeveloperJokerIcon size="xs" rounded="rounded-md" />
                                ) : log.role === 'OWNER' ? (
                                  <div className="w-4 h-4 rounded bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold">
                                    OW
                                  </div>
                                ) : log.role === 'ADMIN' ? (
                                  <div className="w-4 h-4 rounded bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
                                    A
                                  </div>
                                ) : log.role === 'AGEN' ? (
                                  <div className="w-4 h-4 rounded bg-amber-600 text-white flex items-center justify-center text-[9px] font-bold">
                                    AG
                                  </div>
                                ) : log.role === 'KASIR' ? (
                                  <div className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                                    K
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 rounded bg-purple-600 text-white flex items-center justify-center text-[9px] font-bold">
                                    {log.role ? log.role.substring(0, 2).toUpperCase() : 'RC'}
                                  </div>
                                )}
                                <span className="font-bold text-slate-900 dark:text-white text-xs">
                                  {log.name}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                @{log.username}
                              </div>
                            </td>

                            {/* Action Type Column */}
                            <td className="py-3 px-3.5 align-top">
                              {renderActionBadge(log.actionType)}
                            </td>

                            {/* Details Column */}
                            <td className="py-3 px-3.5 align-top">
                              <div className="font-bold text-slate-900 dark:text-white text-xs">
                                {log.actionTitle}
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                                {log.details}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-[#202020] border-t border-slate-200 dark:border-[#3c3c3c] px-5 py-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>Hanya Developer yang memiliki wewenang untuk mengakses halaman ini.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-[#353535] hover:bg-slate-300 dark:hover:bg-[#404040] text-slate-800 dark:text-white font-bold rounded-xl cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
