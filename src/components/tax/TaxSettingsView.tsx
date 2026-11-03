/**
 * Coded by Langgo Bramandityo.
 * Submenu 13: Pengaturan Pajak & Parameter Resmi Perpajakan Indonesia
 * Sesuai UU HPP No 7/2021 & PP 55/2022
 */
import React from 'react';
import { TAX_CONFIG_2025 } from '../../types/tax';
import { formatRupiah } from '../../utils/formatters';
import { useTaxYears } from '../../hooks/useTaxYears';
import {
  MAX_TAX_YEAR,
  MAX_TAX_YEARS_COUNT,
  MIN_TAX_YEAR,
  formatYearRange,
  getDefaultTaxYearsLabel,
  isValidTaxYear
} from '../../utils/taxYears';
import {
  addConfiguredTaxYear,
  removeConfiguredTaxYear,
  resetTaxYearsConfig
} from '../../utils/taxStorage';
import {
  getSyncStatus,
  onSyncStatusChange,
  type SyncStatus
} from '../../backend/pocketbaseBackend';
import { useEntityRegistry } from '../../hooks/useEntityRegistry';
import { taxPeriodsForYear, taxSeparationNotes } from '../../utils/entityTaxConfig';
import {
  Settings,
  ShieldCheck,
  Scale,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Trash2,
  RefreshCw,
  Calendar,
  Plus,
  X
} from 'lucide-react';

/** Status koneksi ke server dibaca dari ukuran asli, bukan tulisan tetap. */
const describeSyncState = (status: SyncStatus): string => {
  switch (status.state) {
    case 'connected':
      return 'Tahun pajak tersimpan di server, jadi perangkat lain ikut berubah.';
    case 'connecting':
      return 'Menyambungkan ke server...';
    case 'reconnecting':
      return 'Belum tersambung ke server. Perubahan disimpan di perangkat ini dulu.';
    default:
      return 'Aplikasi berjalan di perangkat ini, jadi tahun pajak belum tersimpan di server.';
  }
};

interface TaxSettingsViewProps {
  onClearDummyData?: () => void;
}

export const TaxSettingsView: React.FC<TaxSettingsViewProps> = ({ onClearDummyData }) => {
  const [clearedNotice, setClearedNotice] = React.useState(false);

  // Daftar tahun pajak: satu pengaturan untuk seluruh menu di tab Pajak
  const taxYears = useTaxYears();
  // Profil entitas pemilik pajak per periode, dibaca apa adanya dari Pengaturan Entitas
  const entityRegistry = useEntityRegistry();
  const [sync, setSync] = React.useState<SyncStatus>(() => getSyncStatus());
  const [yearDraft, setYearDraft] = React.useState('');
  const [yearNotice, setYearNotice] = React.useState<string | null>(null);

  React.useEffect(() => onSyncStatusChange(setSync), []);

  const showYearNotice = (message: string) => {
    setYearNotice(message);
    window.setTimeout(() => setYearNotice(null), 6000);
  };

  const handleAddYear = () => {
    const value = Number(yearDraft.trim());
    if (!isValidTaxYear(value)) {
      showYearNotice(`Tulis tahun pajak antara ${MIN_TAX_YEAR} dan ${MAX_TAX_YEAR}.`);
      return;
    }
    if (taxYears.includes(value)) {
      showYearNotice(`Tahun ${value} sudah ada di daftar.`);
      return;
    }
    const { added } = addConfiguredTaxYear(value);
    if (!added) {
      showYearNotice(`Daftar tahun pajak maksimal ${MAX_TAX_YEARS_COUNT} tahun.`);
      return;
    }
    setYearDraft('');
    showYearNotice(`Tahun ${value} ditambahkan. Tab input di seluruh menu pajak ikut berubah.`);
  };

  const handleRemoveYear = (year: number) => {
    if (taxYears.length <= 1) {
      showYearNotice('Minimal satu tahun pajak harus tetap aktif.');
      return;
    }
    const confirmed = window.confirm(
      `Sembunyikan tahun ${year} dari tab Pajak? Isian SPT dan billing tahun itu tetap tersimpan dan muncul lagi bila tahunnya ditambahkan kembali.`
    );
    if (!confirmed) return;
    const { removed } = removeConfiguredTaxYear(year);
    if (!removed) return;
    showYearNotice(`Tahun ${year} tidak ditampilkan lagi. Isian tahun itu tetap tersimpan.`);
  };

  const handleResetYears = () => {
    const confirmed = window.confirm(
      `Kembalikan daftar tahun pajak ke bawaan (${getDefaultTaxYearsLabel()})? Tahun di luar daftar hanya disembunyikan, isinya tidak dihapus.`
    );
    if (!confirmed) return;
    resetTaxYearsConfig();
    showYearNotice('Daftar tahun pajak kembali ke bawaan.');
  };

  const handleClear = () => {
    if (window.confirm('Hapus semua data contoh di tab Pajak? Profil contoh, simulasi harta, utang, dan billing contoh akan dikosongkan, jadi isian SPT hanya berisi data asli Anda.')) {
      if (onClearDummyData) {
        onClearDummyData();
      }
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 4000);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-8 max-w-4xl">
      <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Pengaturan &amp; Dasar Hukum Pajak Indonesia (Tahun Pajak {formatYearRange(taxYears)})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tarif, PTKP, dan kode akun pajak sudah dikunci sesuai aturan pajak resmi Indonesia.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <FileCheck className="w-4 h-4" />
          <span>Terverifikasi UU HPP</span>
        </div>
      </div>

      {/* 1. Tarif Progresif Pasal 17 UU HPP */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-600" />
          <span>1. Lapisan Tarif Progresif PPh Pasal 17 ayat (1) huruf a UU HPP</span>
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">Rentang Penghasilan Kena Pajak (PKP)</th>
                <th className="px-3 py-2.5 text-center">Tarif Pajak</th>
                <th className="px-3 py-2.5">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Rp 0 s.d. Rp 60.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-blue-600">5%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Pertama (Batas naik dari 50jt jadi 60jt)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Diatas Rp 60.000.000 s.d. Rp 250.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-blue-600">15%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Kedua</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Diatas Rp 250.000.000 s.d. Rp 500.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-blue-600">25%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Ketiga</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Diatas Rp 500.000.000 s.d. Rp 5.000.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-blue-600">30%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Keempat</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold text-slate-900">Diatas Rp 5.000.000.000</td>
                <td className="px-3 py-2.5 text-center font-bold text-rose-600">35%</td>
                <td className="px-3 py-2.5 font-sans text-slate-500">Lapisan Tertinggi (UU HPP)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Besaran PTKP (Penghasilan Tidak Kena Pajak) 2025 */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>2. Daftar Tarif PTKP (PMK 101/PMK.010/2016)</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {Object.entries(TAX_CONFIG_2025.ptkpRates).map(([status, amount]) => (
            <div key={status} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="font-bold text-slate-900 block">{status}</span>
              <span className="font-mono text-emerald-700 font-bold text-xs mt-0.5 block">{formatRupiah(amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Fasilitas UMKM PP 55 / 2022 */}
      <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span>3. Fasilitas Insentif UMKM Orang Pribadi (PP No 55 Tahun 2022)</span>
        </div>
        <p className="text-amber-800 leading-relaxed">
          Usaha orang pribadi dengan omzet sampai <strong>Rp 500.000.000,00 (lima ratus juta rupiah)</strong> dalam satu tahun tidak kena Pajak Penghasilan (PPh). Omzet di atas itu kena PPh Final <strong>0,5%</strong>.
        </p>
        <p className="text-amber-800 leading-relaxed">
          Dasar hitung yang dipakai toko ini bisa dipilih per tahun di Riwayat Pelaporan, bagian "Dasar DPP:".
        </p>
      </div>

      {/* 4. Pembersihan Data Dummy & Reset Formulir Pajak */}
      <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>4. Hapus Data Contoh &amp; Bersihkan Formulir</span>
            </h4>
            <p className="text-slate-500 mt-1 max-w-xl leading-relaxed">
              Pastikan data contoh lama tidak tercampur dengan data asli Anda. Tombol ini mengosongkan
              seluruh formulir SPT dan billing menjadi Rp 0.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center gap-2 shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Hapus Data Contoh Pajak</span>
          </button>
        </div>

        {clearedNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Data contoh terhapus. Formulir pajak kembali kosong dan siap diisi data asli Anda.</span>
          </div>
        )}
      </div>

      {/* 5. Tahun Pajak yang Diisi */}
      <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4 text-xs">
        <div className="space-y-1">
          <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>5. Tahun Pajak yang Diisi</span>
          </h4>
          <p className="text-slate-500 leading-relaxed max-w-xl">
            Pilih tahun yang tampil di seluruh menu tab Pajak: pemilih tahun, isian billing bulanan,
            grafik, wizard SPT 1770, dan arsip pelaporan. Menambah tahun membuat tab isian tahun itu
            muncul; menghapusnya hanya menyembunyikan tab, isian tahun tersebut tetap tersimpan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {taxYears.map((year) => (
            <span
              key={year}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-white border border-slate-300 font-mono font-bold text-slate-900"
            >
              <span>{year}</span>
              <button
                type="button"
                onClick={() => handleRemoveYear(year)}
                aria-label={`Sembunyikan tahun ${year}`}
                title={`Sembunyikan tahun ${year} dari tab Pajak`}
                className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={MIN_TAX_YEAR}
            max={MAX_TAX_YEAR}
            step={1}
            value={yearDraft}
            onChange={(event) => setYearDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddYear();
              }
            }}
            placeholder="Contoh: 2029"
            aria-label="Tahun pajak yang ditambahkan"
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-32"
          />
          <button
            type="button"
            onClick={handleAddYear}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Tahun</span>
          </button>
          <button
            type="button"
            onClick={handleResetYears}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kembalikan ke bawaan ({getDefaultTaxYearsLabel()})</span>
          </button>
        </div>

        <div className="space-y-1.5">
          <p className="text-slate-600">
            <span className="font-bold text-slate-900">Aktif: {formatYearRange(taxYears)}</span>
            {' · '}
            {taxYears.length} dari maksimal {MAX_TAX_YEARS_COUNT} tahun.
          </p>
          <p className="text-slate-500">{describeSyncState(sync)}</p>
        </div>

        {yearNotice && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 font-semibold flex items-start gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>{yearNotice}</span>
          </div>
        )}
      </div>

      {/* 6. Pajak Tiap Entitas Usaha */}
      <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4 text-xs">
        <div className="space-y-1">
          <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <Scale className="w-4 h-4 text-indigo-600" />
            <span>6. Pajak Tiap Entitas Usaha</span>
          </h4>
          <p className="text-slate-500 leading-relaxed max-w-xl">
            Setelah toko berubah jadi PT, pajak dihitung terpisah per entitas. Tarif dan cara
            penghitungannya diisi di Laporan Keuangan, menu Pengaturan Entitas.
          </p>
        </div>

        {taxYears
          .slice()
          .reverse()
          .map((year) => {
            const periods = taxPeriodsForYear(entityRegistry, year);
            const notes = taxSeparationNotes(entityRegistry, year);
            return (
              <div key={year} className="space-y-2">
                <p className="font-bold text-slate-900">Tahun {year}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {periods.map((period) => (
                    <div
                      key={`${period.entityId}-${period.from}`}
                      className="p-3 rounded-xl bg-white border border-slate-200 space-y-1"
                    >
                      <p className="font-bold text-slate-900">{period.entityLabel}</p>
                      <p className="text-slate-500">
                        {period.from} s.d. {period.to} · {period.regimeLabel}
                      </p>
                      <p className="text-slate-700 font-semibold">
                        {period.finalRatePercent !== null
                          ? `Tarif PPh Final ${period.finalRatePercent}% · omzet bebas ${formatRupiah(
                              period.exemptThreshold
                            )}`
                          : period.corporateRatePercent !== null
                            ? `Tarif PPh Badan ${period.corporateRatePercent}%`
                            : 'Tarif pajaknya belum diisi, jadi tidak dihitung.'}
                      </p>
                    </div>
                  ))}
                </div>
                {notes.map((note) => (
                  <p key={note} className="text-slate-500 leading-relaxed flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </p>
                ))}
              </div>
            );
          })}
      </div>
    </div>
  );
};
