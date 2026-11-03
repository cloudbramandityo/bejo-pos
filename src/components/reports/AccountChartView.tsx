import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ListTree,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useAccountChart } from '../../hooks/useAccountChart';
import { useEntityRegistry } from '../../hooks/useEntityRegistry';
import { useLedgerEntries } from '../../hooks/useLedgerEntries';
import {
  ACCOUNT_TYPE_LABEL,
  accountsForEntity,
  selectableAccounts,
  validateAccountChart,
  type Account,
  type AccountType,
} from '../../utils/accountChart';
import { accountUsageCount } from '../../utils/ledgerMath';
import {
  addAccount,
  applyChartTransitionRulesReport,
  removeAccount,
  updateAccount,
} from '../../utils/entityStorage';
import { formatRupiah } from '../../utils/formatters';

/**
 * Bagan akun per entitas.
 *
 * Rekening pribadi diarsipkan sejak tanggal transisi, Prive ditutup untuk PT,
 * dan akun modal/dividen PT tersedia. Akun yang sudah terpakai tidak bisa
 * dihapus — angka historinya harus tetap bisa ditelusuri.
 */

const TYPE_OPTIONS: AccountType[] = ['ASET', 'KEWAJIBAN', 'MODAL', 'PENDAPATAN', 'BEBAN'];

const AccountChartView: React.FC<{ actorLabel: string }> = ({ actorLabel }) => {
  const chart = useAccountChart();
  const registry = useEntityRegistry();
  const entries = useLedgerEntries();
  const [entityId, setEntityId] = useState(registry.entities[0]?.id || '');
  const [form, setForm] = useState({ code: '', name: '', type: 'ASET' as AccountType, normal: 'DEBIT' as 'DEBIT' | 'KREDIT' });
  const [notice, setNotice] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  /**
   * Isian tabel disimpan sebagai draf sampai kolom ditinggalkan. Menulis lewat
   * localStorage dan server tiap ketikan membuat perangkat lain ikut bergetar.
   */
  const commitText = (account: Account, field: 'name' | 'openingBalance') => {
    const key = `${account.entityId}:${account.code}:${field}`;
    const raw = drafts[key];
    if (raw === undefined) return;
    const clear = () =>
      setDrafts((state) => {
        const rest = { ...state };
        delete rest[key];
        return rest;
      });
    if (field === 'name') {
      const next = raw.trim();
      if (next === '') {
        clear();
        setNotice('Nama akun tidak boleh kosong, isian dikembalikan seperti semula.');
        return;
      }
      if (next !== account.name) updateAccount(account.entityId, account.code, { name: next });
      clear();
      return;
    }
    const next = Number(raw) || 0;
    if (next !== (account.openingBalance || 0)) {
      updateAccount(account.entityId, account.code, { openingBalance: next });
    }
    clear();
  };

  const activeEntityId = registry.entities.some((entity) => entity.id === entityId)
    ? entityId
    : registry.entities[0]?.id || '';
  const rows = useMemo(() => accountsForEntity(chart, activeEntityId), [chart, activeEntityId]);
  const problems = useMemo(() => validateAccountChart(chart, registry), [chart, registry]);
  const usableCount = selectableAccounts(chart, activeEntityId).length;

  const usage = (code: string) => accountUsageCount(entries, activeEntityId, code);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
          <ListTree className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">BAGAN AKUN PER ENTITAS</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Tiap entitas punya daftar akun sendiri. Kode lama tidak diubah artinya, jadi laporan
            periode sebelumnya tetap terbaca sama.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
          {registry.entities.map((entity) => (
            <button
              key={entity.id}
              type="button"
              onClick={() => {
                setEntityId(entity.id);
                setNotice('');
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                entity.id === activeEntityId
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {entity.legalName}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">
            {rows.length} akun · {usableCount} bisa dipakai
          </span>
          <button
            type="button"
            onClick={() => {
              const result = applyChartTransitionRulesReport();
              const parts = [
                result.addedCount > 0 ? `${result.addedCount} akun bawaan ditambahkan` : null,
                result.archivedCount > 0 ? `${result.archivedCount} rekening pribadi diarsipkan` : null,
                result.priveCount > 0 ? `${result.priveCount} akun Prive PT ditutup` : null,
              ].filter(Boolean);
              setNotice(
                parts.length > 0
                  ? `${parts.join(', ')}.`
                  : 'Aturan transisi sudah berlaku. Tidak ada akun yang perlu diubah lagi.'
              );
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
            title="Arsipkan rekening pribadi dan tutup Prive untuk PT"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Terapkan aturan transisi</span>
          </button>
        </div>
      </div>

      {notice && (
        <p className="text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          {notice} · dicatat oleh {actorLabel}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Kode</th>
              <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Nama akun</th>
              <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Jenis</th>
              <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Saldo awal</th>
              <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider text-center">Dipakai</th>
              <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-3 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((account) => {
              const used = usage(account.code);
              const nameKey = `${account.entityId}:${account.code}:name`;
              const balanceKey = `${account.entityId}:${account.code}:openingBalance`;
              return (
                <tr key={`${account.entityId}-${account.code}`} className="border-t border-slate-100 align-middle">
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-800">{account.code}</td>
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={drafts[nameKey] ?? account.name}
                      onChange={(event) => setDrafts({ ...drafts, [nameKey]: event.target.value })}
                      onBlur={() => commitText(account, 'name')}
                      className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
                    />
                    {account.source && (
                      <span className="text-[10px] text-slate-400">diisi dari: {account.source}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={account.type}
                      onChange={(event) =>
                        updateAccount(account.entityId, account.code, { type: event.target.value as AccountType })
                      }
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 focus:outline-none"
                    >
                      {TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {ACCOUNT_TYPE_LABEL[type]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <input
                      type="number"
                      value={drafts[balanceKey] ?? String(account.openingBalance || 0)}
                      onChange={(event) =>
                        setDrafts({ ...drafts, [balanceKey]: event.target.value })
                      }
                      onBlur={() => commitText(account, 'openingBalance')}
                      className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-right font-mono text-xs font-semibold text-slate-800 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-600">{used} jurnal</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                        account.archived
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {account.archived ? 'Arsip' : 'Aktif'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateAccount(account.entityId, account.code, {
                            archived: !account.archived,
                            postable: account.archived,
                          })
                        }
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        title={account.archived ? 'Pakai kembali akun ini' : 'Arsipkan akun ini'}
                      >
                        {account.archived ? (
                          <ArchiveRestore className="w-3.5 h-3.5" />
                        ) : (
                          <Archive className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const result = removeAccount(account.entityId, account.code, used);
                          setNotice(result.removed ? `Akun ${account.code} dikeluarkan dari bagan.` : result.reason);
                        }}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 cursor-pointer"
                        title="Keluarkan akun yang belum dipakai"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tambah akun baru */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-slate-400" />
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Tambah akun</h4>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            value={form.code}
            placeholder="Kode, mis. 2400"
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none"
          />
          <input
            type="text"
            value={form.name}
            placeholder="Nama akun"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          />
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as AccountType })}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          >
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {ACCOUNT_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
          <select
            value={form.normal}
            onChange={(event) => setForm({ ...form, normal: event.target.value as 'DEBIT' | 'KREDIT' })}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          >
            <option value="DEBIT">Normal debit</option>
            <option value="KREDIT">Normal kredit</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            const addedCode = form.code.trim();
            const result = addAccount({
              entityId: activeEntityId,
              code: form.code,
              name: form.name,
              type: form.type,
              normal: form.normal,
            });
            setNotice(result.ok ? `Akun ${addedCode} ditambahkan ke bagan entitas ini.` : result.reason);
            if (result.ok) setForm({ code: '', name: '', type: 'ASET', normal: 'DEBIT' });
          }}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah ke bagan</span>
        </button>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Saldo awal di kolom "Saldo awal" sebaiknya diisi lewat langkah penutupan buku, bukan
          diketik sendiri, supaya neraca awal PT tetap seimbang.
        </p>
      </div>

      {/* Pemeriksaan bagan */}
      {problems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              {problems.length} hal pada bagan akun
            </h4>
          </div>
          {problems.map((problem) => (
            <p key={problem} className="text-xs text-amber-900 leading-relaxed">
              {problem}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
        {rows
          .filter((account) => account.openingBalance)
          .slice(0, 8)
          .map((account) => (
            <span key={`saldo-${account.code}`} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
              {account.code} · {account.name}: {formatRupiah(account.openingBalance || 0)}
            </span>
          ))}
      </div>
    </div>
  );
};

export default AccountChartView;
