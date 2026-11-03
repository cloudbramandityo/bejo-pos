import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  History,
  Landmark,
  Lock,
  Save,
  TriangleAlert,
  Unlock,
  User,
} from 'lucide-react';
import { useEntityRegistry } from '../../hooks/useEntityRegistry';
import {
  ENTITY_KIND_LABEL,
  TAX_REGIMES,
  TAX_REGIME_LABEL,
  entityPeriodLabel,
  formatEntityDateKey,
  isValidEntityDateKey,
  lastDayBefore,
  peroranganEntity,
  ptEntity,
  taxProfileProblems,
  validateEntityRegistry,
  type EntityProfile,
  type EntityTaxProfile,
  type TaxRegime,
} from '../../utils/entityRegistry';
import {
  changeTransitionDate,
  closeBooksThrough,
  updateEntityProfile,
} from '../../utils/entityStorage';

/**
 * Pengaturan entitas usaha: profil Perorangan, profil PT, tanggal efektif
 * transisi, riwayat perubahan, dan status penutupan buku.
 *
 * Yang diubah di sini hanya siapa pemilik periode, bukan isinya. Histori
 * transaksi 2022 sampai sehari sebelum tanggal transisi tetap utuh dan tetap
 * milik entitas lama.
 */

interface EntityProfileCardProps {
  entity: EntityProfile | null;
  actorLabel: string;
  emptyTitle: string;
  icon: React.ElementType;
  /** Dokumen yang menjadi dasar identitas, dibaca operator apa adanya. */
  documentHint: string;
}

const FIELDS: { key: keyof EntityProfile; label: string; placeholder: string }[] = [
  { key: 'legalName', label: 'Nama sesuai dokumen hukum', placeholder: 'PT ...' },
  { key: 'tradeName', label: 'Nama yang dipakai sehari-hari', placeholder: 'BEJO Digital Print' },
  { key: 'npwp', label: 'NPWP', placeholder: '00.000.000.0-000.000' },
  { key: 'legalDocNumber', label: 'Nomor akta / keputusan', placeholder: 'belum diisi' },
  { key: 'address', label: 'Alamat', placeholder: 'alamat lengkap' },
  { key: 'notes', label: 'Catatan', placeholder: 'catatan pembukuan' },
];

const rateText = (value: number | null): string => (value === null || value === 0 ? '' : String(value));

/** Nilai isian angka; kosong berarti belum diisi, bukan nol. */
const numberOf = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
};

/**
 * Isian pajak satu entitas. Tarif tidak pernah ditulis kode: yang kosong berarti
 * memang belum disetel pemiliknya, dan pajaknya tidak dihitung.
 */
const EntityTaxEditor: React.FC<{
  entity: EntityProfile;
  onChange: (next: EntityTaxProfile) => void;
}> = ({ entity, onChange }) => {
  const tax = entity.tax;
  const problems = taxProfileProblems(entity);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Pajak entitas ini</h5>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Hitungannya terpisah dari entitas lain. Yang belum diisi tidak dihitung.
          </p>
        </div>
        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-600">
          {TAX_REGIME_LABEL[tax.regime]}
        </span>
      </div>

      <label className="block">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cara penghitungan</span>
        <select
          value={tax.regime}
          onChange={(event) => onChange({ ...tax, regime: event.target.value as TaxRegime })}
          className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          {TAX_REGIMES.map((regime) => (
            <option key={regime} value={regime}>
              {TAX_REGIME_LABEL[regime]}
            </option>
          ))}
        </select>
      </label>

      {tax.regime === 'PP55_OP' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tarif PPh Final (%)</span>
            <input
              type="text"
              inputMode="decimal"
              value={rateText(tax.finalRatePercent)}
              placeholder="belum diisi"
              onChange={(event) => onChange({ ...tax, finalRatePercent: numberOf(event.target.value) })}
              className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>
          <label>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Omzet setahun yang bebas PPh Final (Rp)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={tax.exemptThreshold ? String(tax.exemptThreshold) : ''}
              placeholder="0 = tidak memakai fasilitas"
              onChange={(event) => onChange({ ...tax, exemptThreshold: numberOf(event.target.value) ?? 0 })}
              className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>
        </div>
      )}

      {tax.regime === 'BADAN' && (
        <label className="block">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tarif PPh Badan (%)</span>
          <input
            type="text"
            inputMode="decimal"
            value={rateText(tax.corporateRatePercent)}
            placeholder="belum diisi"
            onChange={(event) => onChange({ ...tax, corporateRatePercent: numberOf(event.target.value) })}
            className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </label>
      )}

      {problems.length > 0 && (
        <ul className="space-y-1 pt-1 border-t border-slate-200">
          {problems.map((problem) => (
            <li key={problem} className="text-[11px] text-amber-800 flex items-start gap-1.5">
              <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{problem}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const EntityProfileCard: React.FC<EntityProfileCardProps> = ({
  entity,
  actorLabel,
  emptyTitle,
  icon: Icon,
  documentHint,
}) => {
  const [draft, setDraft] = useState<EntityProfile | null>(entity);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    setDraft(entity);
    setSaved('');
  }, [entity]);

  if (!entity || !draft) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-5 bg-slate-50/60">
        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">{emptyTitle}</h4>
        <p className="text-xs text-slate-500 mt-1.5">
          Belum ada datanya. Isi lebih dulu supaya laporan punya kop yang benar.
        </p>
      </div>
    );
  }

  const dirty =
    FIELDS.some((field) => String(draft[field.key] ?? '') !== String(entity[field.key] ?? '')) ||
    JSON.stringify(draft.tax) !== JSON.stringify(entity.tax);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              {ENTITY_KIND_LABEL[entity.kind]}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">{entityPeriodLabel(entity)}</p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
            entity.active
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {entity.active ? 'Entitas berjalan' : 'Selesai / arsip'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map((field) => (
          <label key={field.key} className={field.key === 'address' || field.key === 'notes' ? 'sm:col-span-2' : ''}>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{field.label}</span>
            <input
              type="text"
              value={String(draft[field.key] ?? '')}
              placeholder={field.placeholder}
              onChange={(event) => {
                setDraft({ ...draft, [field.key]: event.target.value } as EntityProfile);
                setSaved('');
              }}
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>
        ))}
      </div>

      <EntityTaxEditor entity={draft} onChange={(tax) => { setDraft({ ...draft, tax }); setSaved(''); }} />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-[420px]">{documentHint}</p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saved}
            </span>
          )}
          <button
            type="button"
            disabled={!dirty}
            onClick={() => {
              const patch: Partial<EntityProfile> = {};
              for (const field of FIELDS) {
                (patch as Record<string, string>)[field.key] = String(draft[field.key] ?? '').trim();
              }
              patch.tax = draft.tax;
              updateEntityProfile(entity.id, patch);
              setSaved(`Tersimpan oleh ${actorLabel}`);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              dirty
                ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan profil</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const EntitySettingsView: React.FC<{ actorLabel: string }> = ({ actorLabel }) => {
  const registry = useEntityRegistry();
  const problems = useMemo(() => validateEntityRegistry(registry), [registry]);
  const [transitionDraft, setTransitionDraft] = useState(registry.transitionDate);
  const [notice, setNotice] = useState('');
  const [closingDraft, setClosingDraft] = useState(lastDayBefore(registry.transitionDate));

  useEffect(() => {
    setTransitionDraft(registry.transitionDate);
    setClosingDraft(lastDayBefore(registry.transitionDate));
  }, [registry.transitionDate]);

  const legacy = peroranganEntity(registry);
  const pt = ptEntity(registry);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
          <Landmark className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">PROFIL ENTITAS USAHA</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Perubahan bentuk usaha tidak memindahkan transaksi lama. Tanggal efektif di bawah yang
            menentukan sebuah transaksi dimiliki siapa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EntityProfileCard
          entity={legacy}
          actorLabel={actorLabel}
          emptyTitle="Entitas lama belum ada"
          icon={User}
          documentHint="Entitas lama memegang seluruh pembukuan sebelum tanggal efektif. Namanya dipakai sebagai kop laporan periode itu."
        />
        <EntityProfileCard
          entity={pt}
          actorLabel={actorLabel}
          emptyTitle="Entitas PT belum ada"
          icon={Building2}
          documentHint="Isi nama, NPWP, dan nomor akta persis seperti dokumen. Laporan resmi PT memakai identitas ini."
        />
      </div>

      {/* Tanggal efektif transisi */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Tanggal Efektif Perubahan</h4>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Hari pertama transaksi dihitung sebagai milik PT. Sehari sebelumnya adalah hari terakhir
          pembukuan entitas lama.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              PT mulai berlaku
            </span>
            <input
              type="date"
              value={transitionDraft}
              onChange={(event) => {
                setTransitionDraft(event.target.value);
                setNotice('');
              }}
              className="mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const result = changeTransitionDate(transitionDraft, actorLabel);
              setNotice(result.accepted ? `Tanggal efektif diubah ke ${formatEntityDateKey(transitionDraft)}.` : result.reason);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Terapkan tanggal</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            Pra-PT sampai {formatEntityDateKey(lastDayBefore(registry.transitionDate))}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
            Pasca-PT mulai {formatEntityDateKey(registry.transitionDate)}
          </span>
        </div>
        {notice && (
          <p className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            {notice}
          </p>
        )}
      </div>

      {/* Status penutupan buku */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          {registry.closedThroughDate ? (
            <Lock className="w-4 h-4 text-emerald-600" />
          ) : (
            <Unlock className="w-4 h-4 text-amber-600" />
          )}
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Status Penutupan Buku</h4>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          {registry.closedThroughDate
            ? `Buku ditutup sampai ${formatEntityDateKey(registry.closedThroughDate)}. Jurnal untuk tanggal sebelum itu tidak bisa dibuat atau diubah lagi.`
            : 'Buku lama belum ditutup. Menutup buku adalah langkah pertama sebelum saldo awal PT dibentuk.'}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Tutup buku sampai
            </span>
            <input
              type="date"
              value={closingDraft}
              onChange={(event) => setClosingDraft(event.target.value)}
              className="mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!isValidEntityDateKey(closingDraft)) {
                setNotice('Tanggal penutupan buku belum diisi dengan benar.');
                return;
              }
              closeBooksThrough(closingDraft, actorLabel);
              setNotice('');
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Tutup buku</span>
          </button>
          {registry.closedThroughDate && (
            <button
              type="button"
              onClick={() => closeBooksThrough(null, actorLabel)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Buka lagi</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Penutupan buku tidak menghapus atau memindahkan transaksi lama. Isian kasir lama tetap seperti
          adanya.
        </p>
      </div>

      {/* Riwayat perubahan entitas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Riwayat Perubahan Entitas</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Berlaku</th>
                <th className="py-2 pr-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Dari</th>
                <th className="py-2 pr-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Menjadi</th>
                <th className="py-2 pr-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Keterangan</th>
                <th className="py-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">Dicatat oleh</th>
              </tr>
            </thead>
            <tbody>
              {registry.history.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 text-xs font-mono font-bold text-slate-800">
                    {formatEntityDateKey(entry.effectiveDate)}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-600">
                    {registry.entities.find((item) => item.id === entry.fromEntityId)?.legalName || '-'}
                  </td>
                  <td className="py-2.5 pr-3 text-xs font-semibold text-slate-800">
                    {registry.entities.find((item) => item.id === entry.toEntityId)?.legalName ||
                      ENTITY_KIND_LABEL[entry.toKind]}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-600">{entry.note}</td>
                  <td className="py-2.5 text-[11px] font-mono text-slate-500">{entry.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pemeriksaan identitas */}
      <div
        className={`rounded-2xl border p-5 space-y-2 ${
          problems.length === 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'
        }`}
      >
        <div className="flex items-center gap-2">
          {problems.length === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <TriangleAlert className="w-4 h-4 text-amber-600" />
          )}
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            {problems.length === 0 ? 'Identitas entitas lengkap' : `${problems.length} hal yang belum lengkap`}
          </h4>
        </div>
        {problems.map((problem) => (
          <p key={problem} className="text-xs text-amber-900 leading-relaxed">
            {problem}
          </p>
        ))}
        {problems.length === 0 && (
          <p className="text-xs text-emerald-800 leading-relaxed">
            Tanggal transisi dan rentang kedua entitas sudah nyambung, tidak ada hari yang kosong.
          </p>
        )}
      </div>
    </div>
  );
};

export default EntitySettingsView;
