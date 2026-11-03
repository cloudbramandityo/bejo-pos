import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useAccountChart } from '../../hooks/useAccountChart';
import { useEntityRegistry } from '../../hooks/useEntityRegistry';
import { useLedgerEntries } from '../../hooks/useLedgerEntries';
import { findAccount, accountsForEntity } from '../../utils/accountChart';
import { entityPeriodLabel, formatEntityDateKey } from '../../utils/entityRegistry';
import {
  existingOpeningEntry,
  monthPreview,
  planOf,
  postMonthJournals,
  postOpeningJournal,
  readClosingFigures,
  transitionPair,
  defaultAllocations,
  type MonthPreview,
  type TransitionSource,
} from '../../utils/transitionActions';
import { monthKeysBetween } from '../../utils/ledgerAggregates';
import { JOURNAL_STATUS_LABEL } from '../../utils/ledgerMath';
import { reverseLedgerEntry } from '../../utils/ledgerStorage';
import { formatRupiah } from '../../utils/formatters';
import type { FinancialSettings } from '../../utils/financialStorage';

/**
 * Wizard penutupan buku dan pemindahan saldo ke entitas baru.
 *
 * Urutan langkahnya sengaja dipaksa: nilai diperiksa dulu, baru dipilih yang
 * dialihkan, lalu bagiannya, dan hanya boleh dicatat setelah pratinjau jurnal
 * dibaca. Tidak ada langkah yang menulis sebelum operator menekan tombolnya.
 */

type StepKey = 'cek' | 'alokasi' | 'bagian' | 'pratinjau' | 'rekap';

const STEPS: { key: StepKey; label: string; hint: string }[] = [
  { key: 'cek', label: '1. Cek Nilai', hint: 'Bandingkan isian pembukuan dengan hitungan data toko' },
  { key: 'alokasi', label: '2. Yang Dialihkan', hint: 'Pilih saldo yang benar-benar pindah ke entitas baru' },
  { key: 'bagian', label: '3. Bagian Modal', hint: 'Modal saham sesuai akta, sisanya tambahan modal' },
  { key: 'pratinjau', label: '4. Pratinjau & Catat', hint: 'Baca jurnalnya sebelum dicatat' },
  { key: 'rekap', label: '5. Rekap Bulanan', hint: 'Bentuk jurnal rekap untuk bulan berjalan' },
];

const todayKey = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

interface TransitionWizardViewProps {
  sales: TransitionSource['sales'];
  stock: TransitionSource['stock'];
  shifts: TransitionSource['shifts'];
  settings: FinancialSettings;
  actorLabel: string;
}

const TransitionWizardView: React.FC<TransitionWizardViewProps> = ({
  sales,
  stock,
  shifts,
  settings,
  actorLabel,
}) => {
  const registry = useEntityRegistry();
  const chart = useAccountChart();
  const entries = useLedgerEntries();

  const [step, setStep] = useState<StepKey>('cek');
  const [allocationDraft, setAllocationDraft] = useState<Record<string, string>>({});
  const [seededFor, setSeededFor] = useState('');
  const [shareCapital, setShareCapital] = useState('');
  const [retainedEarnings, setRetainedEarnings] = useState('');
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'PERIODIK' | 'PERPETUAL'>('PERIODIK');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState('');
  const [rejection, setRejection] = useState<string[]>([]);

  const pair = useMemo(() => transitionPair(registry, chart), [registry, chart]);
  const source = useMemo<TransitionSource>(() => ({ sales, stock, shifts }), [sales, stock, shifts]);

  const figures = useMemo(
    () => (pair.oldEntity && pair.newEntity ? readClosingFigures(pair, source, settings) : []),
    [pair, source, settings]
  );

  const seedKey = `${pair.closingDate}|${figures.map((figure) => figure.code).join(',')}`;
  useEffect(() => {
    if (!seedKey || seedKey === seededFor) return;
    const next: Record<string, string> = {};
    for (const item of defaultAllocations(figures)) next[item.code] = String(item.transferred);
    setAllocationDraft(next);
    setSeededFor(seedKey);
  }, [seedKey, seededFor, figures]);

  const allocations = figures.map((figure) => ({
    code: figure.code,
    transferred: Number(allocationDraft[figure.code] ?? '0') || 0,
  }));

  const plan = useMemo(
    () => planOf(pair, figures, allocations, Number(shareCapital) || 0, Number(retainedEarnings) || 0),
    // allocations dibangun ulang tiap render; plan dihitung ulang saat isian berubah memang yang diinginkan.
    [pair, figures, allocationDraft, shareCapital, retainedEarnings]
  );

  const openingEntry = pair.newEntity ? existingOpeningEntry(entries, pair.newEntity.id) : undefined;
  const ptMonths = pair.newEntity
    ? monthKeysBetween(pair.registry.transitionDate, todayKey())
    : [];

  const previews: MonthPreview[] = ptMonths.length > 0 && pair.newEntity
    ? ptMonths
        .map((periodKey) =>
          monthPreview({
            pair,
            entity: pair.newEntity!,
            periodKey,
            source,
            mode,
            countedInventory: counted[periodKey] === undefined || counted[periodKey] === ''
              ? null
              : Number(counted[periodKey]) || 0,
            actor: actorLabel,
            entries,
            throughDate: todayKey(),
          })
        )
        .filter((preview): preview is MonthPreview => preview !== null)
    : [];

  const accountName = (entityId: string, code: string): string =>
    findAccount(chart, entityId, code)?.name || code;

  const readyToPost = Boolean(plan && plan.balanced && plan.problems.length === 0 && confirmed && !openingEntry);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">PENUTUPAN BUKU & PEMINDAHAN SALDO</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Histori lama tidak diubah. Nilai akhir periode lama dipindahkan sebagai saldo awal
            entitas baru pada {formatEntityDateKey(pair.registry.transitionDate)}.
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusCard
          label="Tanggal transisi"
          value={formatEntityDateKey(pair.registry.transitionDate)}
          note="Hari pertama entitas baru"
        />
        <StatusCard
          label="Buku lama ditutup sampai"
          value={
            registry.closedThroughDate
              ? formatEntityDateKey(registry.closedThroughDate)
              : 'belum ditutup'
          }
          note={registry.closedThroughDate ? 'Tanggal sebelumnya tidak bisa diubah lagi' : 'Saldo awal belum dicatat'}
        />
        <StatusCard
          label="Saldo awal entitas baru"
          value={openingEntry ? `tercatat ${formatEntityDateKey(openingEntry.date)}` : 'belum dicatat'}
          note={openingEntry ? `Dicatat oleh ${openingEntry.createdBy || 'belum tercatat'}` : 'Catat lewat langkah 4'}
        />
        <StatusCard
          label="Jumlah bulan direkap"
          value={`${previews.filter((preview) => preview.alreadyPosted).length} dari ${previews.length}`}
          note="Bulan entitas baru yang sudah punya jurnal rekap"
        />
      </div>

      {/* Langkah */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setStep(item.key);
              setResult('');
              setRejection([]);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              item.key === step
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
            title={item.hint}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!pair.oldEntity || !pair.newEntity ? (
        <Notice tone="warn">
          Rentang periode entitas belum lengkap. Atur tanggal transisinya lebih dulu di menu
          Pengaturan Entitas.
        </Notice>
      ) : (
        <>
          {step === 'cek' && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Akun lama', 'Isian pengaturan', 'Hitungan data toko', 'Selisih', 'Dasar angka'].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider"
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {figures.map((figure) => {
                      const diff = figure.measured === null ? null : figure.measured - figure.entered;
                      return (
                        <tr key={figure.code} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2.5">
                            <p className="text-sm font-bold text-slate-800">{figure.label}</p>
                            <p className="text-[11px] font-mono text-slate-400">{figure.code}</p>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sm text-slate-800">
                            {formatRupiah(figure.entered)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sm text-slate-800">
                            {figure.measured === null ? (
                              <span className="text-[11px] font-sans text-slate-400">tidak ada datanya</span>
                            ) : (
                              formatRupiah(figure.measured)
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {diff === null ? (
                              <span className="text-[11px] text-slate-400">-</span>
                            ) : (
                              <span
                                className={`font-mono text-xs font-bold ${
                                  diff === 0 ? 'text-emerald-600' : 'text-amber-600'
                                }`}
                              >
                                {formatRupiah(diff)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-500 leading-relaxed max-w-[280px]">
                            {figure.basis}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Selisih bukan kesalahan: nilai di aplikasi dihitung dari struk dan bon yang tercatat.
                Angka resmi penutupan memakai isian pemilik. Isilah kolom "Isian pengaturan" di menu
                Input Data bila ada yang belum sesuai.
              </p>
              <StepNav direction="next" onClick={() => setStep('alokasi')} label="Lanjut ke saldo yang dialihkan" />
            </div>
          )}

          {step === 'alokasi' && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Dialihkan</th>
                      <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Akun lama</th>
                      <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Akun tujuan</th>
                      <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Nilai dialihkan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {figures.map((figure) => (
                      <tr key={figure.code} className="border-t border-slate-100">
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={figure.transferable && (Number(allocationDraft[figure.code]) || 0) > 0}
                            disabled={!figure.transferable}
                            onChange={(event) =>
                              setAllocationDraft({
                                ...allocationDraft,
                                [figure.code]: event.target.checked ? String(figure.entered) : '0',
                              })
                            }
                            className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-sm font-bold text-slate-800">{figure.label}</p>
                          <p className="text-[11px] font-mono text-slate-400">{figure.code}</p>
                          {!figure.transferable && (
                            <p className="text-[11px] text-amber-700 mt-1 leading-relaxed max-w-[300px]">
                              {figure.reason}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {figure.targetCode
                            ? `${figure.targetCode} · ${accountName(pair.newEntity!.id, figure.targetCode)}`
                            : 'tidak pindah'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="number"
                            value={allocationDraft[figure.code] ?? '0'}
                            disabled={!figure.transferable}
                            onChange={(event) =>
                              setAllocationDraft({ ...allocationDraft, [figure.code]: event.target.value })
                            }
                            className="w-40 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-right font-mono text-xs font-semibold text-slate-800 focus:outline-none disabled:opacity-50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, string> = {};
                    for (const item of defaultAllocations(figures)) next[item.code] = String(item.transferred);
                    setAllocationDraft(next);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Pakai nilai tercatat semua</span>
                </button>
                <span>
                  Aset bersih yang dialihkan:{' '}
                  <strong className="font-mono text-slate-800">
                    {plan ? formatRupiah(plan.netTransferred) : '-'}
                  </strong>
                </span>
              </div>
              <StepNav direction="both" onBack={() => setStep('cek')} onClick={() => setStep('bagian')} label="Lanjut ke bagian modal" />
            </div>
          )}

          {step === 'bagian' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-slate-400" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Bagian modal</h4>
                </div>
                <NumberField
                  label="Modal saham sesuai akta"
                  hint="Diisi dari akta pendirian. Sistem tidak mengakui seluruh aset bersih sebagai modal saham."
                  value={shareCapital}
                  onChange={setShareCapital}
                />
                <NumberField
                  label="Saldo laba yang diakui ikut"
                  hint="Bila ada laba lama yang diakui masuk PT, isi di sini dengan dasar dokumennya."
                  value={retainedEarnings}
                  onChange={setRetainedEarnings}
                />
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <PlanRow label="Aset yang dialihkan" value={plan?.totalAssets ?? 0} />
                  <PlanRow label="Utang yang dialihkan" value={plan?.totalLiabilities ?? 0} />
                  <PlanRow label="Aset bersih" value={plan?.netTransferred ?? 0} strong />
                  <PlanRow
                    label="Tambahan Modal Disetor (sisa)"
                    value={plan?.additionalPaidIn ?? 0}
                    strong
                  />
                </div>
              </div>
              <div className="space-y-3">
                {plan && plan.problems.length > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-rose-600" />
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Belum bisa dicatat
                      </h4>
                    </div>
                    {plan.problems.map((problem) => (
                      <p key={problem} className="text-xs text-rose-900 leading-relaxed">
                        {problem}
                      </p>
                    ))}
                  </div>
                )}
                {plan && plan.warnings.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <TriangleAlert className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Perlu dicek
                      </h4>
                    </div>
                    {plan.warnings.map((warning) => (
                      <p key={warning} className="text-xs text-amber-900 leading-relaxed">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Tambahan Modal Disetor dihitung otomatis sebagai sisa aset bersih setelah modal saham
                  dan saldo laba. Bila angkanya negatif, bagiannya belum cocok dengan nilai yang
                  dialihkan.
                </p>
                <StepNav
                  direction="both"
                  onBack={() => setStep('alokasi')}
                  onClick={() => setStep('pratinjau')}
                  label="Lanjut ke pratinjau jurnal"
                />
              </div>
            </div>
          )}

          {step === 'pratinjau' && plan && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Jurnal saldo awal {pair.newEntity!.legalName}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatEntityDateKey(pair.registry.transitionDate)} · {entityPeriodLabel(pair.oldEntity!)}{' '}
                      → {entityPeriodLabel(pair.newEntity!)}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      plan.balanced
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {plan.balanced ? 'Debit = Kredit' : `Selisih ${formatRupiah(Math.abs(plan.difference))}`}
                  </span>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">Akun</th>
                      <th className="px-3 py-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">Keterangan</th>
                      <th className="px-3 py-2 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Debit</th>
                      <th className="px-3 py-2 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.lines.map((line, index) => (
                      <tr key={`${line.code}-${index}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-sm text-slate-800">
                          <span className="font-mono text-[11px] text-slate-400 mr-2">{line.code}</span>
                          {accountName(pair.newEntity!.id, line.code)}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-500">{line.memo || '-'}</td>
                        <td className="px-3 py-2 text-right font-mono text-sm text-slate-800">
                          {line.debit ? formatRupiah(line.debit) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm text-slate-800">
                          {line.credit ? formatRupiah(line.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-900">
                      <td className="px-3 py-2.5 text-xs font-black text-slate-900 uppercase" colSpan={2}>
                        Jumlah
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-black text-slate-900">
                        {formatRupiah(plan.lines.reduce((sum, line) => sum + line.debit, 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-black text-slate-900">
                        {formatRupiah(plan.lines.reduce((sum, line) => sum + line.credit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {plan.problems.length > 0 && (
                <Notice tone="error">
                  {plan.problems.map((problem) => (
                    <p key={problem}>{problem}</p>
                  ))}
                </Notice>
              )}

              {openingEntry ? (
                <Notice tone="ok">
                  Saldo awal sudah tercatat pada {formatEntityDateKey(openingEntry.date)} dengan bukti{' '}
                  {openingEntry.ref}. Status {JOURNAL_STATUS_LABEL[openingEntry.status]}. Untuk mengubahnya,
                  balik jurnalnya lebih dulu di menu Jurnal Umum.
                </Notice>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      className="mt-0.5 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      Saya sudah membaca jumlah di atas dan dokumen pendukungnya (akta, daftar aset,
                      hasil hitung fisik barang).
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={!readyToPost}
                    onClick={() => {
                      const posted = postOpeningJournal({ pair, plan, actor: actorLabel, confirmed });
                      if (posted.ok && posted.entry) {
                        setResult(
                          `Saldo awal ${pair.newEntity!.legalName} tercatat ${formatEntityDateKey(posted.entry.date)} dengan bukti ${posted.entry.ref}, dicatat oleh ${actorLabel}. Buku periode lama ditutup sampai ${formatEntityDateKey(pair.closingDate)}.`
                        );
                        setRejection([]);
                      } else {
                        setResult('');
                        setRejection(posted.problems);
                      }
                    }}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Catat saldo awal & tutup buku</span>
                  </button>
                  {!readyToPost && !openingEntry && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Tombol aktif setelah jurnal seimbang dan centang pemeriksaan diisi.
                    </p>
                  )}
                </div>
              )}

              {result && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-900 leading-relaxed">{result}</p>
                </div>
              )}
              {rejection.length > 0 && (
                <Notice tone="error">
                  {rejection.map((problem) => (
                    <p key={problem}>{problem}</p>
                  ))}
                </Notice>
              )}
            </div>
          )}

          {step === 'rekap' && pair.newEntity && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">Cara mencatat persediaan:</span>
                {(['PERIODIK', 'PERPETUAL'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                      mode === option
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {option === 'PERIODIK' ? 'Nilai barang dari hitung fisik' : 'Nilai barang berjalan'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {mode === 'PERIODIK'
                  ? 'Pembelian langsung menjadi harga pokok. Nilai barang yang masih ada diambil dari hasil hitung fisik tiap bulan.'
                  : 'Pembelian masuk ke persediaan dan pengambilan agen keluar dari persediaan. Hitung fisik hanya koreksi selisih.'}
              </p>

              {accountsForEntity(chart, pair.newEntity.id).length === 0 && (
                <Notice tone="warn">Bagan akun entitas ini masih kosong.</Notice>
              )}

              <div className="space-y-2.5">
                {previews.map((preview) => (
                  <div key={preview.periodKey} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-sm font-black text-slate-900">Bulan {preview.periodKey}</h5>
                        <p className="text-[11px] text-slate-500">
                          {preview.entry.date} · {preview.entry.lines.length} baris · {preview.entry.ref}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.alreadyPosted ? (
                          <>
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Sudah tercatat
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const reversed = reverseLedgerEntry(preview.entry.id, todayKey(), actorLabel);
                                setResult(
                                  reversed.ok && reversed.reversal
                                    ? `Jurnal rekap ${preview.periodKey} dibalik pada ${formatEntityDateKey(reversed.reversal.date)} oleh ${actorLabel}.`
                                    : ''
                                );
                                setRejection(reversed.problems);
                              }}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer flex items-center gap-1.5"
                              title="Buat jurnal pembalik untuk bulan ini"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Balik</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={preview.problems.length > 0}
                            onClick={() => {
                              const posted = postMonthJournals([preview], actorLabel);
                              if (posted.posted.length > 0) {
                                setResult(`Rekap ${preview.periodKey} tercatat, dicatat oleh ${actorLabel}.`);
                                setRejection([]);
                              } else {
                                setResult('');
                                setRejection(posted.failed[0]?.problems || []);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white cursor-pointer flex items-center gap-1.5"
                          >
                            <ListChecks className="w-3.5 h-3.5" />
                            <span>Catat bulan ini</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                      <MiniStat label="Penjualan bersih" value={preview.totals.revenueNet} />
                      <MiniStat label="Kas & bank masuk" value={preview.totals.cashReceived + preview.totals.bankReceived} />
                      <MiniStat label="Pembelian bahan" value={preview.totals.purchases + preview.totals.shipping} />
                      <MiniStat label="Beban tercatat" value={preview.totals.operationalExpenses} />
                    </div>

                    <label className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                      Nilai barang hasil hitung fisik akhir bulan
                      <input
                        type="number"
                        value={counted[preview.periodKey] ?? ''}
                        placeholder="belum diisi"
                        onChange={(event) =>
                          setCounted({ ...counted, [preview.periodKey]: event.target.value })
                        }
                        className="w-40 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-right font-mono text-xs font-semibold text-slate-800 focus:outline-none"
                      />
                    </label>

                    {preview.notes.map((note) => (
                      <p key={note} className="text-[11px] text-amber-700 leading-relaxed">
                        {note}
                      </p>
                    ))}
                    {preview.problems.map((problem) => (
                      <p key={problem} className="text-[11px] text-rose-700 leading-relaxed">
                        {problem}
                      </p>
                    ))}
                  </div>
                ))}
                {previews.length === 0 && (
                  <Notice tone="warn">
                    Belum ada bulan yang bisa direkap. Rekap dibentuk mulai{' '}
                    {formatEntityDateKey(pair.registry.transitionDate)}.
                  </Notice>
                )}
              </div>

              {result && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-900 leading-relaxed">{result}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StatusCard: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-bold text-slate-900 mt-1">{value}</p>
    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{note}</p>
  </div>
);

const NumberField: React.FC<{
  label: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
}> = ({ label, hint, value, onChange }) => (
  <label className="block space-y-1">
    <span className="block text-xs font-bold text-slate-700">{label}</span>
    <input
      type="number"
      value={value}
      placeholder="diisi pemilik"
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
    />
    <span className="block text-[11px] text-slate-400 leading-relaxed">{hint}</span>
  </label>
);

const PlanRow: React.FC<{ label: string; value: number; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-center justify-between gap-3">
    <span className={`text-xs ${strong ? 'font-black text-slate-900' : 'text-slate-500'}`}>{label}</span>
    <span className={`font-mono text-sm ${strong ? 'font-black text-slate-900' : 'text-slate-700'}`}>
      {formatRupiah(value)}
    </span>
  </div>
);

const MiniStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <span className="px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
    <span className="block text-slate-400 font-bold uppercase tracking-wider">{label}</span>
    <span className="font-mono text-slate-800">{formatRupiah(value)}</span>
  </span>
);

const Notice: React.FC<{ tone: 'ok' | 'warn' | 'error'; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const styles = {
    ok: 'border-emerald-200 bg-emerald-50/60 text-emerald-900',
    warn: 'border-amber-200 bg-amber-50/60 text-amber-900',
    error: 'border-rose-200 bg-rose-50/60 text-rose-900',
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 space-y-1 text-xs leading-relaxed ${styles}`}>{children}</div>
  );
};

const StepNav: React.FC<{
  direction: 'next' | 'both';
  label: string;
  onClick: () => void;
  onBack?: () => void;
}> = ({ direction, label, onClick, onBack }) => (
  <div className="flex items-center gap-2 pt-1">
    {direction === 'both' && onBack && (
      <button
        type="button"
        onClick={onBack}
        className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-slate-400 cursor-pointer flex items-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Kembali</span>
      </button>
    )}
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
    >
      <span>{label}</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

export default TransitionWizardView;
