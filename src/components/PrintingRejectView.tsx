/**
 * BEJO Digital Print
 * Personal Printing Reject Management (Catatan Personal Gagal Produksi)
 * Coded by Langgo Bramandityo.
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Plus,
  Calendar,
  Layers,
  Filter,
  Trash2,
  Edit2,
  Clock,
  Cpu,
  FileText,
  Search,
  CheckCircle2,
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  Info,
  Sliders,
  Sparkles
} from 'lucide-react';
import {
  Product,
  AppUser,
  MachineItem,
  PrintingRejectRecord,
  PrintingRejectReason,
  ProductCategoryItem
} from '../types';
import { isMaterialOrVinylProduct } from '../utils/productFilters';
import { formatNumber } from '../utils/formatters';

interface PrintingRejectViewProps {
  products: Product[];
  productCategories?: ProductCategoryItem[];
  machines?: MachineItem[];
  currentUser: AppUser | null;
  allUsers?: AppUser[];
  rejects: PrintingRejectRecord[];
  onSaveReject: (record: PrintingRejectRecord) => void;
  onDeleteReject: (id: string) => void;
}

type TimeFilterMode = 'daily' | 'weekly' | 'monthly';

export const PrintingRejectView: React.FC<PrintingRejectViewProps> = ({
  products,
  productCategories,
  machines = [],
  currentUser,
  allUsers = [],
  rejects,
  onSaveReject,
  onDeleteReject
}) => {
  const userRole = (currentUser?.role || '').toUpperCase();
  const isDeveloper = userRole === 'DEVELOPER';
  const isAdmin = userRole === 'ADMIN';
  const isOwner = userRole === 'OWNER';
  const canAuditAll = isDeveloper || isAdmin || isOwner;

  // View Scope: Personal vs All (Default to Personal)
  const [viewScope, setViewScope] = useState<'personal' | 'all'>('personal');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>(currentUser?.id || '');

  // Time Filter Mode: Daily | Weekly | Monthly
  const [timeMode, setTimeMode] = useState<TimeFilterMode>('daily');
  
  // Date selection states
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const currentMonthStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [searchMaterial, setSearchMaterial] = useState<string>('');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string>('ALL');

  // Modal State for New/Edit Reject
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingReject, setEditingReject] = useState<PrintingRejectRecord | null>(null);

  // Form State
  const [formMaterialId, setFormMaterialId] = useState<string>('');
  const [formUnit, setFormUnit] = useState<'meter' | 'lembar' | 'pcs'>('meter');
  const [formQty, setFormQty] = useState<string>('1');
  const [formReason, setFormReason] = useState<PrintingRejectReason>('Adjustment');
  const [formReasonDetail, setFormReasonDetail] = useState<string>('');
  const [formMachineId, setFormMachineId] = useState<string>('');
  const [formSpkNumber, setFormSpkNumber] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formTime, setFormTime] = useState<string>(() => new Date().toTimeString().split(' ')[0]);

  // Available Materials (Katalog Produk: Kategori Bahan)
  const materialProducts = useMemo(() => {
    return products.filter((p) => isMaterialOrVinylProduct(p, productCategories));
  }, [products, productCategories]);

  // Filter only users with role 'SPK' for the Audit view
  const spkUsers = useMemo(() => {
    return allUsers.filter((u) => (u.role || '').toUpperCase() === 'SPK');
  }, [allUsers]);

  const spkUserIds = useMemo(() => {
    return new Set(spkUsers.map((u) => u.id));
  }, [spkUsers]);

  // Selected Material Details in Form
  const activeSelectedProduct = useMemo(() => {
    return materialProducts.find((p) => p.id === formMaterialId);
  }, [materialProducts, formMaterialId]);

  // Scope Filter: Strict Personal Isolation
  const scopedRejects = useMemo(() => {
    if (!canAuditAll || viewScope === 'personal') {
      const myId = currentUser?.id || 'guest';
      return rejects.filter((r) => r.userId === myId);
    }
    // Audit mode for DEVELOPER, ADMIN, OWNER -> Only display SPK role users
    if (selectedUserFilter && selectedUserFilter !== 'ALL') {
      return rejects.filter((r) => r.userId === selectedUserFilter);
    }
    // 'ALL' in audit mode only includes records belonging to SPK users
    return rejects.filter((r) => spkUserIds.has(r.userId) || (r.userRole || '').toUpperCase() === 'SPK');
  }, [rejects, canAuditAll, viewScope, currentUser, selectedUserFilter, spkUserIds]);

  // Filtered rejects based on Time Mode (Daily, Weekly, Monthly) and Search
  const filteredRejects = useMemo(() => {
    return scopedRejects.filter((r) => {
      // 1. Time Filter
      if (timeMode === 'daily') {
        if (r.date !== selectedDate) return false;
      } else if (timeMode === 'weekly') {
        // Calculate 7-day range ending on selectedDate or current week
        const baseDate = new Date(selectedDate);
        const dayOfWeek = baseDate.getDay(); // 0 is Sunday
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(baseDate);
        monday.setDate(baseDate.getDate() + mondayOffset);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const recordDate = new Date(r.date + 'T12:00:00');
        if (recordDate < monday || recordDate > sunday) return false;
      } else if (timeMode === 'monthly') {
        if (!r.date.startsWith(selectedMonth)) return false;
      }

      // 2. Reason Filter
      if (selectedReasonFilter !== 'ALL' && r.reason !== selectedReasonFilter) {
        return false;
      }

      // 3. Search Material / SPK / Reason detail
      if (searchMaterial.trim()) {
        const query = searchMaterial.toLowerCase().trim();
        const matName = (r.materialName || '').toLowerCase();
        const spk = (r.spkOrderNumber || '').toLowerCase();
        const detail = (r.reasonDetail || '').toLowerCase();
        const opName = (r.userName || '').toLowerCase();
        if (!matName.includes(query) && !spk.includes(query) && !detail.includes(query) && !opName.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [scopedRejects, timeMode, selectedDate, selectedMonth, selectedReasonFilter, searchMaterial]);

  // Aggregate Metrics for Active View
  const metrics = useMemo(() => {
    let totalMeter = 0;
    let totalLembar = 0;
    let totalCostLoss = 0;
    let countAdjustment = 0;
    let countJamming = 0;
    let countHumanError = 0;

    filteredRejects.forEach((r) => {
      const unitLower = (r.unit || '').toLowerCase();
      if (unitLower.includes('meter') || unitLower === 'm') {
        totalMeter += r.rejectQty || 0;
      } else {
        totalLembar += r.rejectQty || 0;
      }

      totalCostLoss += r.estimatedCostLoss || 0;

      if (r.reason === 'Adjustment') countAdjustment++;
      else if (r.reason === 'Jamming') countJamming++;
      else if (r.reason === 'Human Error') countHumanError++;
    });

    const totalCases = filteredRejects.length;

    return {
      totalMeter: parseFloat(totalMeter.toFixed(2)),
      totalLembar: parseFloat(totalLembar.toFixed(1)),
      totalCostLoss,
      totalCases,
      countAdjustment,
      countJamming,
      countHumanError,
      pctAdjustment: totalCases ? Math.round((countAdjustment / totalCases) * 100) : 0,
      pctJamming: totalCases ? Math.round((countJamming / totalCases) * 100) : 0,
      pctHumanError: totalCases ? Math.round((countHumanError / totalCases) * 100) : 0,
    };
  }, [filteredRejects]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingReject(null);
    const firstMat = materialProducts[0];
    setFormMaterialId(firstMat?.id || '');
    const isMeter = (firstMat?.unit || '').toLowerCase().includes('meter') || (firstMat?.unit || '').toLowerCase().includes('roll');
    setFormUnit(isMeter ? 'meter' : 'lembar');
    setFormQty('1');
    setFormReason('Adjustment');
    setFormReasonDetail('');
    setFormMachineId(machines[0]?.id || '');
    setFormSpkNumber('');
    setFormDate(todayStr);
    setFormTime(new Date().toTimeString().split(' ')[0]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (record: PrintingRejectRecord) => {
    setEditingReject(record);
    setFormMaterialId(record.materialId);
    setFormUnit(record.unit as any || 'meter');
    setFormQty(String(record.rejectQty || 1));
    setFormReason(record.reason);
    setFormReasonDetail(record.reasonDetail || '');
    setFormMachineId(record.machineId || '');
    setFormSpkNumber(record.spkOrderNumber || '');
    setFormDate(record.date);
    setFormTime(record.time || new Date().toTimeString().split(' ')[0]);
    setIsModalOpen(true);
  };

  // When Material Changes in Form, auto-detect unit
  const handleMaterialChange = (matId: string) => {
    setFormMaterialId(matId);
    const prod = materialProducts.find((p) => p.id === matId);
    if (prod) {
      const u = (prod.unit || '').toLowerCase();
      if (u.includes('meter') || u.includes('roll')) {
        setFormUnit('meter');
      } else {
        setFormUnit('lembar');
      }
    }
  };

  // Submit Save Form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMaterialId) {
      alert('Silakan pilih jenis bahan terlebih dahulu.');
      return;
    }

    const qtyNum = parseFloat(formQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert('Jumlah reject harus berupa angka positif.');
      return;
    }

    const matProd = materialProducts.find((p) => p.id === formMaterialId);
    const matName = matProd ? `${matProd.name} ${matProd.dimensions ? `(${matProd.dimensions})` : ''}` : 'Bahan Cetak';
    const costPerUnit = matProd?.costPrice || matProd?.hargaKulak || 0;
    const estimatedLoss = costPerUnit * qtyNum;

    const machineObj = machines.find((m) => m.id === formMachineId);
    const machineName = machineObj ? `${machineObj.name} (${machineObj.brand})` : undefined;

    const newRecord: PrintingRejectRecord = {
      id: editingReject?.id || `REJ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      userId: editingReject?.userId || currentUser?.id || 'guest',
      userName: editingReject?.userName || currentUser?.name || currentUser?.username || 'Operator',
      userRole: editingReject?.userRole || currentUser?.role || 'OPERATOR',
      date: formDate || todayStr,
      time: formTime || new Date().toTimeString().split(' ')[0],
      timestamp: editingReject ? editingReject.timestamp : Date.now(),
      materialId: formMaterialId,
      materialCode: matProd?.code,
      materialName: matName,
      unit: formUnit,
      rejectQty: qtyNum,
      costPerUnit,
      estimatedCostLoss: estimatedLoss,
      reason: formReason,
      reasonDetail: formReasonDetail.trim() || undefined,
      machineId: formMachineId || undefined,
      machineName,
      spkOrderNumber: formSpkNumber.trim() ? formSpkNumber.trim().toUpperCase() : undefined
    };

    onSaveReject(newRecord);
    setIsModalOpen(false);
  };

  // Reason Badge Helper
  const renderReasonBadge = (reason: PrintingRejectReason) => {
    switch (reason) {
      case 'Adjustment':
        return (
          <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-300 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-blue-600" />
            Adjustment / Kalibrasi
          </span>
        );
      case 'Jamming':
        return (
          <span className="bg-amber-100 text-amber-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            Jamming (Nyangkut)
          </span>
        );
      case 'Human Error':
        return (
          <span className="bg-rose-100 text-rose-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
            <X className="w-3 h-3 text-rose-600" />
            Human Error (Salah)
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-slate-300">
            {reason}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Banner & Scope Info */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Printing Reject Notes (Catatan Gagal Cetak)
                </h2>
                <span className="bg-indigo-500/30 text-indigo-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-400/40 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  PERSONAL NOTES
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Catatan operator untuk bahan gagal produksi: Adjustment, Jamming, atau Human Error
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Catat Reject Baru</span>
          </button>
        </div>

        {/* User Scope Indicator / Toggle (Audit Switch for Admin/Dev) */}
        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Operator Aktif:{' '}
              <strong className="text-white font-bold">{currentUser?.name || currentUser?.username || 'Saya'}</strong>{' '}
              <span className="text-[11px] text-slate-400">({currentUser?.role})</span>
            </span>
          </div>

          {!canAuditAll ? (
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold bg-indigo-950/70 border border-indigo-500/40 px-2.5 py-1 rounded-lg text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Mode Personal: catatan reject akun Anda</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Mode Tampilan:</span>
              <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                <button
                  type="button"
                  onClick={() => setViewScope('personal')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer transition-all ${
                    viewScope === 'personal'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Catatan Personal Saya
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope('all')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer transition-all ${
                    viewScope === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua Operator (Audit)
                </button>
              </div>

              {viewScope === 'all' && (
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Operator SPK ({spkUsers.length})</option>
                  {spkUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.username} {u.spkRoleCategory ? `• ${u.spkRoleCategory}` : '• SPK'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Filter & Time Mode Switcher Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Time Filter Mode Tabs: Harian | Mingguan | Bulanan */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setTimeMode('daily')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                timeMode === 'daily'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Harian (Daily)</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeMode('weekly')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                timeMode === 'weekly'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Mingguan (Weekly)</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeMode('monthly')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                timeMode === 'monthly'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bulanan (Monthly)</span>
            </button>
          </div>

          {/* Date Picker Selector */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {timeMode === 'daily' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-slate-900 font-bold">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pilih Tanggal:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent font-mono text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                />
              </div>
            )}

            {timeMode === 'weekly' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-slate-900 font-bold">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Rentang Minggu Dari:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent font-mono text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                />
              </div>
            )}

            {timeMode === 'monthly' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-slate-900 font-bold">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pilih Bulan:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent font-mono text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sub Filter: Reason & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Alasan:</span>
            {['ALL', 'Adjustment', 'Jamming', 'Human Error'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedReasonFilter(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  selectedReasonFilter === r
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {r === 'ALL' ? 'Semua Alasan' : r}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchMaterial}
              onChange={(e) => setSearchMaterial(e.target.value)}
              placeholder="Cari Bahan / No. SPK / Alasan..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </div>
      </div>

      {/* 3. Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Total Reject Meter</span>
            <span className="text-indigo-600">📏 METER</span>
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {metrics.totalMeter} <span className="text-xs font-semibold text-slate-500">Meter</span>
          </div>
          <div className="text-[10.5px] font-sans text-slate-500">Bahan roll/meteran terbuang</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Total Reject Lembar</span>
            <span className="text-emerald-600">📄 LEMBAR</span>
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {metrics.totalLembar} <span className="text-xs font-semibold text-slate-500">Lembar</span>
          </div>
          <div className="text-[10.5px] font-sans text-slate-500">Bahan sheet/lembaran terbuang</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Total Kejadian Reject</span>
            <span className="text-rose-600">⚠️ KASUS</span>
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {metrics.totalCases} <span className="text-xs font-semibold text-slate-500">Catatan</span>
          </div>
          <div className="text-[10.5px] font-sans text-slate-500">
            {timeMode === 'daily' ? 'Pada hari terpilih' : timeMode === 'weekly' ? 'Dalam 1 minggu' : 'Dalam 1 bulan'}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Persentase Error</span>
            <span className="text-amber-600">📊 ANALISA</span>
          </div>
          <div className="text-xs font-sans text-slate-700 space-y-0.5 mt-1 font-semibold">
            <div className="flex justify-between">
              <span>Adjustment:</span>
              <strong className="text-blue-600 font-bold font-mono">{metrics.countAdjustment} ({metrics.pctAdjustment}%)</strong>
            </div>
            <div className="flex justify-between">
              <span>Jamming:</span>
              <strong className="text-amber-600 font-bold font-mono">{metrics.countJamming} ({metrics.pctJamming}%)</strong>
            </div>
            <div className="flex justify-between">
              <span>Human Error:</span>
              <strong className="text-rose-600 font-bold font-mono">{metrics.countHumanError} ({metrics.pctHumanError}%)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Table / List of Printing Rejects */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Daftar Catatan Reject ({filteredRejects.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Format Waktu: <strong className="text-slate-900 font-bold uppercase">{timeMode}</strong>
          </span>
        </div>

        {filteredRejects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800">Tidak ada catatan printing reject pada periode ini</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Produksi lancar, tidak ada bahan terbuang pada periode ini. Tekan tombol <strong>+ Catat Reject Baru</strong> jika ada cetak gagal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Waktu & Tanggal</th>
                  <th className="py-3 px-4">Bahan (Katalog Produk)</th>
                  <th className="py-3 px-4 text-right">Jumlah Reject</th>
                  <th className="py-3 px-4">Alasan Reject</th>
                  <th className="py-3 px-4">Mesin & SPK Terkait</th>
                  <th className="py-3 px-4">Keterangan / Detail</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRejects.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                      <div className="font-bold text-slate-900">{r.date}</div>
                      <div className="text-slate-500 text-[10px]">{r.time || '-'} WIB</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{r.materialName}</div>
                      {r.materialCode && (
                        <div className="text-[10px] font-mono text-slate-500">SKU: {r.materialCode}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono">
                      <span className="inline-block bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-lg font-black text-xs">
                        {r.rejectQty} {r.unit}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderReasonBadge(r.reason)}
                    </td>

                    <td className="py-3 px-4 text-xs">
                      {r.machineName ? (
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-indigo-500" />
                          <span>{r.machineName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                      {r.spkOrderNumber && (
                        <div className="text-[10.5px] font-mono font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded mt-0.5 inline-block border border-indigo-200">
                          SPK: {r.spkOrderNumber}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs max-w-xs">
                      <div className="text-slate-700 line-clamp-2">
                        {r.reasonDetail || <span className="text-slate-400 italic">Tanpa catatan detail</span>}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <div className="font-bold text-slate-900">{r.userName}</div>
                      {r.userRole && (
                        <div className="text-[10px] text-slate-500 font-mono">{r.userRole}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      {(canAuditAll || r.userId === currentUser?.id) ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(r)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                            title="Edit Catatan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Hapus catatan reject bahan "${r.materialName}" (${r.rejectQty} ${r.unit})?`)) {
                                onDeleteReject(r.id);
                              }
                            }}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 hover:text-rose-800 cursor-pointer transition-colors"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">Terkunci</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Create / Edit Printing Reject Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto flex flex-col text-slate-900">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/30 border border-rose-500/50 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">
                    {editingReject ? 'Edit Catatan Printing Reject' : 'Catat Personal Printing Reject'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Tercatat personal untuk operator: <strong className="text-white">{currentUser?.name || currentUser?.username}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto max-h-[80vh]">
              {/* Field 1: Pilih Bahan dari Katalog Produk */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Pilih Jenis Bahan (Katalog Produk: Kategori Bahan) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formMaterialId}
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                  required
                >
                  <option value="">-- Pilih Jenis Bahan --</option>
                  {materialProducts.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.name} {mat.dimensions ? `(${mat.dimensions})` : ''} — [Stok: {mat.stock} {mat.unit || 'm'}]
                    </option>
                  ))}
                </select>
                {activeSelectedProduct && (
                  <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                    <span>Satuan Standar: <strong>{activeSelectedProduct.unit || 'meter'}</strong></span>
                    <span>Stok Bahan: <strong>{activeSelectedProduct.stock} {activeSelectedProduct.unit || 'm'}</strong></span>
                  </div>
                )}
              </div>

              {/* Field 2: Jumlah Reject & Satuan */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Jumlah Terbuang / Reject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formQty}
                    onChange={(e) => setFormQty(e.target.value)}
                    placeholder="misal: 1.5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Satuan Reject <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                  >
                    <option value="meter">Meter (m / m²)</option>
                    <option value="lembar">Lembar (Sheet)</option>
                    <option value="pcs">Pcs / Lembar Potongan</option>
                  </select>
                </div>
              </div>

              {/* Field 3: Alasan Reject */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Alasan Reject / Penyebab Kegagalan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Adjustment', 'Jamming', 'Human Error'] as PrintingRejectReason[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormReason(r)}
                      className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                        formReason === r
                          ? r === 'Adjustment'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : r === 'Jamming'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r === 'Adjustment' && <Sliders className="w-4 h-4" />}
                      {r === 'Jamming' && <AlertTriangle className="w-4 h-4" />}
                      {r === 'Human Error' && <X className="w-4 h-4" />}
                      <span>{r}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 4: Detail Penjelasan Kendala */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Penjelasan Detail Kendala (Keterangan)
                </label>
                <textarea
                  value={formReasonDetail}
                  onChange={(e) => setFormReasonDetail(e.target.value)}
                  placeholder="misal: Test kalibrasi profil warna oracal / head nyangkut di meter ke-3 / salah setting ukuran file cetak..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                />
              </div>

              {/* Field 5: Mesin Terkait & No. SPK (Opsional) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Mesin Cetak Terkait (Opsional)
                  </label>
                  <select
                    value={formMachineId}
                    onChange={(e) => setFormMachineId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:outline-hidden"
                  >
                    <option value="">-- Tanpa Mesin Spesifik --</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.brand})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    No. SPK Terkait (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formSpkNumber}
                    onChange={(e) => setFormSpkNumber(e.target.value)}
                    placeholder="misal: SPK-261006-0001"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Field 6: Tanggal & Waktu Reject */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">Tanggal Kejadian</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">Waktu Kejadian</label>
                  <input
                    type="time"
                    step="1"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-all active:scale-95"
                >
                  {editingReject ? 'Simpan Perubahan' : 'Simpan Catatan Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
