/**
 * Sub-tab Rekonsiliasi: dua menu (Analisis Varians dan Analisis Komparatif),
 * isian dinamis, hasil analisa, penyimpanan ke server, riwayat, dan cetak PDF.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Save, FileDown, Scale, TrendingUp } from 'lucide-react';
import {
  ReconciliationKind,
  ReconciliationRun,
} from '../../types/reconciliation';
import {
  analyzeReconciliation,
  createDefaultColumns,
  createDefaultRows,
  defaultLabelsFor,
  defaultTitleFor,
} from '../../utils/reconciliationMath';
import {
  createReconciliationRunId,
  getStoredReconciliationRuns,
  removeStoredReconciliationRun,
  saveStoredReconciliationRuns,
  upsertStoredReconciliationRun,
} from '../../utils/reconciliationStorage';
import { exportReconciliationToPDF } from '../../utils/reconciliationPdf';
import {
  deleteReconciliationRunCloud,
  getSyncStatus,
  onSyncStatusChange,
  saveReconciliationRunCloud,
  subscribeReconciliationRuns,
} from '../../backend/pocketbaseBackend';
import { canManageRecords } from '../../utils/recordAccess';
import type { UserRole } from '../../types';
import { ReconciliationEditor } from './ReconciliationEditor';
import { ReconciliationResults } from './ReconciliationResults';
import { ReconciliationHistoryList } from './ReconciliationHistoryList';

interface ReconciliationScreenProps {
  userRole?: UserRole;
  storeName?: string;
  authorId?: string;
  authorName?: string;
}

const createDraft = (kind: ReconciliationKind): ReconciliationRun => {
  const labels = defaultLabelsFor(kind);
  const now = Date.now();
  return {
    id: createReconciliationRunId(),
    kind,
    title: defaultTitleFor(kind),
    labelA: labels.labelA,
    labelB: labels.labelB,
    columns: createDefaultColumns(kind),
    rows: createDefaultRows(),
    analysis: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
};

const newerFirst = (a: ReconciliationRun, b: ReconciliationRun) =>
  (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);

const mergeRuns = (
  local: ReconciliationRun[],
  incoming: ReconciliationRun[]
): ReconciliationRun[] => {
  const byId = new Map<string, ReconciliationRun>();
  for (const run of local) byId.set(run.id, run);
  for (const run of incoming) {
    const current = byId.get(run.id);
    if (!current || (run.updatedAt || 0) >= (current.updatedAt || 0)) byId.set(run.id, run);
  }
  return [...byId.values()].sort(newerFirst);
};

const syncCopy = (state: string, pendingWrites: number): string => {
  if (pendingWrites > 0) return `${pendingWrites} perubahan menunggu terkirim ke server`;
  if (state === 'connected') return 'Riwayat tersambung ke server';
  if (state === 'reconnecting') return 'Sambungan server sedang dipulihkan';
  if (state === 'connecting') return 'Menyiapkan sambungan server';
  return 'Riwayat tersimpan di perangkat ini, server belum tersambung';
};

export const ReconciliationScreen: React.FC<ReconciliationScreenProps> = ({
  userRole,
  storeName,
  authorId,
  authorName,
}) => {
  const [kind, setKind] = useState<ReconciliationKind>('VARIANS');
  const [draft, setDraft] = useState<ReconciliationRun>(() => createDraft('VARIANS'));
  const [runs, setRuns] = useState<ReconciliationRun[]>(() => getStoredReconciliationRuns());
  const [isDirty, setIsDirty] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [sync, setSync] = useState(() => getSyncStatus());

  const runsRef = useRef(runs);
  runsRef.current = runs;

  useEffect(() => {
    const unsubscribe = subscribeReconciliationRuns((cloudRuns) => {
      const merged = mergeRuns(runsRef.current, cloudRuns);
      runsRef.current = merged;
      setRuns(merged);
      saveStoredReconciliationRuns(merged);
      setIsLoadingHistory(false);
    });
    const unsubscribeStatus = onSyncStatusChange((status) => setSync(status));
    const timer = window.setTimeout(() => setIsLoadingHistory(false), 8000);
    return () => {
      unsubscribe();
      unsubscribeStatus();
      window.clearTimeout(timer);
    };
  }, []);

  const visibleRuns = useMemo(() => runs.filter((run) => run.kind === kind).sort(newerFirst), [runs, kind]);
  const canDelete = canManageRecords(userRole);

  const patchDraft = useCallback((patch: Partial<ReconciliationRun>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
    setSavedMessage('');
  }, []);

  const changeKind = (nextKind: ReconciliationKind) => {
    if (nextKind === kind) return;
    if (isDirty && !window.confirm('Ganti menu? Isian yang belum disimpan akan hilang.')) return;
    setKind(nextKind);
    setDraft(createDraft(nextKind));
    setIsDirty(false);
    setSavedMessage('');
  };

  const startNew = () => {
    if (isDirty && !window.confirm('Buang isian yang belum disimpan?')) return;
    setDraft(createDraft(kind));
    setIsDirty(false);
    setSavedMessage('');
  };

  const execute = () => {
    setDraft((prev) => ({
      ...prev,
      analysis: analyzeReconciliation(prev.kind, prev.rows, prev.columns),
    }));
    setSavedMessage('');
  };

  const save = async () => {
    const analysis =
      draft.analysis ?? analyzeReconciliation(draft.kind, draft.rows, draft.columns);
    const named = analysis.countedRows;
    if (named === 0) {
      window.alert('Isi nama baris beserta angkanya lebih dulu supaya ada yang dianalisa.');
      return;
    }
    const now = Date.now();
    const record: ReconciliationRun = {
      ...draft,
      analysis,
      createdAt: draft.createdAt || now,
      updatedAt: now,
      authorId,
      authorName,
    };
    setDraft(record);
    const merged = mergeRuns(runsRef.current, [record]);
    runsRef.current = merged;
    setRuns(merged);
    upsertStoredReconciliationRun(record);
    setIsDirty(false);
    setSavedMessage('Analisa dan isannya tersimpan.');
    try {
      await saveReconciliationRunCloud(record);
    } catch {
      setSavedMessage('Tersimpan di perangkat ini. Pengiriman ulang ke server dicoba otomatis.');
    }
  };

  const openRun = (id: string) => {
    const found = runsRef.current.find((run) => run.id === id);
    if (!found) return;
    if (isDirty && !window.confirm('Ganti ke analisa tersimpan? Isian yang belum disimpan akan hilang.')) return;
    setKind(found.kind);
    setDraft({
      ...found,
      columns: found.columns.map((column) => ({ ...column })),
      rows: found.rows.map((row) => ({ ...row, values: { ...row.values } })),
    });
    setIsDirty(false);
    setSavedMessage(`Membuka: ${found.title || 'tanpa nama'}`);
  };

  const download = (id: string) => {
    const target = id === draft.id ? draft : runsRef.current.find((run) => run.id === id);
    if (!target || !target.analysis) {
      window.alert('Analisa belum dijalankan.');
      return;
    }
    exportReconciliationToPDF(target, storeName);
  };

  const remove = (id: string) => {
    const target = runsRef.current.find((run) => run.id === id);
    if (!target) return;
    if (!window.confirm(`Hapus analisa "${target.title || 'tanpa nama'}"? Yang terhapus tidak bisa kembali.`)) return;
    const next = runsRef.current.filter((run) => run.id !== id);
    runsRef.current = next;
    setRuns(next);
    removeStoredReconciliationRun(id);
    deleteReconciliationRunCloud(id).catch(() => {});
    if (draft.id === id) {
      setDraft(createDraft(kind));
      setIsDirty(false);
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Rekonsiliasi Laporan
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                Bandingkan dua laporan: rencana dengan capaian, atau dua periode berbeda.
                Baris dan kolom isian bisa ditambah sesuai laporan yang dibandingkan.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Server
            </div>
            <div className="text-[11px] text-slate-600 font-medium mt-0.5 max-w-[260px]">
              {syncCopy(sync.state, sync.pendingWrites)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {[
            {
              key: 'VARIANS' as ReconciliationKind,
              label: 'Analisis Varians',
              desc: 'Selisih rencana dengan capaian nyata',
              icon: Scale,
            },
            {
              key: 'KOMPARATIF' as ReconciliationKind,
              label: 'Analisis Komparatif',
              desc: 'Perkembangan dua periode yang sama',
              icon: TrendingUp,
            },
          ].map((option) => {
            const active = kind === option.key;
            const Icon = option.icon;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => changeKind(option.key)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title={option.desc}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-emerald-300' : 'text-slate-400'}`} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <ReconciliationEditor
        run={draft}
        canEdit
        onPatch={patchDraft}
        onRowsChange={(rows) => patchDraft({ rows })}
        onColumnsChange={(columns) => patchDraft({ columns })}
        onExecute={execute}
      />

      {draft.analysis && draft.analysis.kind === draft.kind ? (
        <ReconciliationResults run={draft} analysis={draft.analysis} />
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
          <p className="text-sm font-bold text-slate-700">Hasil analisa muncul di sini</p>
          <p className="text-xs text-slate-500 mt-1">
            Tekan Jalankan Analisa setelah kedua laporan terisi.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-2 hover:bg-slate-800 shadow-xs cursor-pointer"
          title="Simpan isian dan hasilnya di server"
        >
          <Save className="w-4 h-4 text-emerald-300" />
          Simpan
        </button>
        <button
          type="button"
          onClick={() => download(draft.id)}
          disabled={!draft.analysis}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2 hover:border-emerald-400 disabled:opacity-40 cursor-pointer"
          title="Unduh hasil analisa sebagai PDF"
        >
          <FileDown className="w-4 h-4 text-emerald-600" />
          Unduh PDF
        </button>
        <button
          type="button"
          onClick={startNew}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2 hover:border-emerald-400 cursor-pointer"
          title="Mulai analisa kosong"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          Analisa Baru
        </button>
        {isDirty && (
          <span className="text-[11px] font-bold text-amber-600">Isian belum disimpan</span>
        )}
        {!isDirty && savedMessage && (
          <span className="text-[11px] font-bold text-emerald-700">{savedMessage}</span>
        )}
      </div>

      <ReconciliationHistoryList
        runs={visibleRuns}
        activeId={draft.id}
        canDelete={canDelete}
        isLoading={isLoadingHistory && visibleRuns.length === 0}
        onOpen={openRun}
        onDownload={download}
        onDelete={remove}
      />
    </div>
  );
};
