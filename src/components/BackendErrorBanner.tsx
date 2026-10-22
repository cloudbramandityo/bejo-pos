/**
 * Backend Error Notification Banner with Instant "Fix" Button
 * Coded for Bejo Stiker POS System
 */
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Wrench,
  CheckCircle2,
  X,
  RefreshCw,
  Activity,
  Server,
  Sparkles,
  Database
} from 'lucide-react';
import { BackendErrorItem } from '../types';
import {
  subscribeBackendErrorNotification,
  runBackendAutoFix,
  dismissActiveBackendNotification
} from '../utils/backendDiagnostics';

interface BackendErrorBannerProps {
  onOpenDiagnosticsModal?: () => void;
  userRole?: string;
}

export const BackendErrorBanner: React.FC<BackendErrorBannerProps> = ({
  onOpenDiagnosticsModal,
  userRole
}) => {
  const [activeError, setActiveError] = useState<BackendErrorItem | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeBackendErrorNotification((err) => {
      setActiveError(err);
      if (err) {
        setFixSuccessMessage(null);
      }
    });
    return unsub;
  }, []);

  const handleFixNow = async () => {
    setIsFixing(true);
    try {
      const report = await runBackendAutoFix();
      if (report.success) {
        setFixSuccessMessage(report.message || 'Sistem backend & koneksi berhasil dinormalisasi.');
        setTimeout(() => {
          setFixSuccessMessage(null);
          dismissActiveBackendNotification();
        }, 3500);
      }
    } catch (err: any) {
      console.error('Error during auto-fix:', err);
    } finally {
      setIsFixing(false);
    }
  };

  const handleDismiss = () => {
    dismissActiveBackendNotification();
  };

  const isCriticalPocketBaseQuotaErr = 
    activeError?.code === 'ERR_POCKETBASE_QUOTA_EXCEEDED' || 
    activeError?.message?.includes('Quota exceeded') || 
    activeError?.message?.includes('quota') || 
    activeError?.message?.includes('resource-exhausted') ||
    activeError?.message?.includes('RESOURCE_EXHAUSTED');

  if (userRole !== 'DEVELOPER' && !isCriticalPocketBaseQuotaErr) {
    return null;
  }

  if (!activeError && !fixSuccessMessage) {
    return null;
  }

  // Get friendly source badge
  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'SERVER':
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border border-red-300/80">
            <Server className="w-3 h-3" /> Backend Server
          </span>
        );
      case 'AI_API':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border border-purple-300/80">
            <Sparkles className="w-3 h-3" /> Gemini AI Engine
          </span>
        );
      case 'POCKETBASE':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border border-amber-300/80">
            <Database className="w-3 h-3" /> Cloud PocketBase
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border border-rose-300/80">
            <Activity className="w-3 h-3" /> Backend System
          </span>
        );
    }
  };

  return (
    <div className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl animate-in slide-in-from-top-4 duration-300">
      {fixSuccessMessage ? (
        <div className="bg-emerald-600 text-white p-3 sm:p-4 rounded-2xl shadow-2xl border border-emerald-400 flex items-center justify-between gap-3 font-sans">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black tracking-tight">
                Perbaikan Berhasil!
              </div>
              <div className="text-[11px] text-emerald-100">
                {fixSuccessMessage}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFixSuccessMessage(null)}
            className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : activeError ? (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-rose-500/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 font-sans ring-4 ring-rose-500/20">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                {getSourceBadge(activeError.source)}
                <span className="text-[10px] font-mono text-slate-400">
                  {activeError.formattedTime || 'Baru saja'}
                </span>
                {activeError.code && (
                  <span className="text-[9px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded">
                    {activeError.code}
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                {activeError.title}
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2 max-w-md">
                {activeError.message}
              </p>
            </div>
          </div>

          {/* Action Buttons: FIX and Details */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {onOpenDiagnosticsModal && (
              <button
                type="button"
                onClick={onOpenDiagnosticsModal}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                title="Lihat status sistem dan rincian diagnostik"
              >
                Diagnostik
              </button>
            )}

            <button
              type="button"
              onClick={handleFixNow}
              disabled={isFixing}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
              title="Jalankan perbaikan otomatis backend dan reset koneksi"
            >
              {isFixing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Wrench className="w-3.5 h-3.5 text-white" />
              )}
              <span>{isFixing ? 'Memperbaiki...' : 'Fix Sekarang'}</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
              title="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
