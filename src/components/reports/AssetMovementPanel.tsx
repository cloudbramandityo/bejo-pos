/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { Boxes, SlidersHorizontal, TrendingDown, TrendingUp, Wallet, Info } from 'lucide-react';
import { AssetAdjustment, Product, StockTransaction } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  buildAssetTrend,
  currentStoreAssetValue,
  type TrendBucket
} from '../../utils/assetTrend';
import TrendPeriodControls, { type TrendPeriodState } from './TrendPeriodControls';

interface AssetMovementPanelProps {
  products: Product[];
  stockTransactions: StockTransaction[];
  assetAdjustments?: AssetAdjustment[];
}

const ASSET_COLOR = '#059669';

const shortRupiah = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} jt`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)} rb`;
  return String(Math.round(value));
};

const todayKey = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function AssetMovementPanel({
  products,
  stockTransactions,
  assetAdjustments = []
}: AssetMovementPanelProps) {
  const [period, setPeriod] = useState<TrendPeriodState>({
    mode: 'MINGGUAN',
    customBucket: 'HARIAN',
    from: todayKey(),
    to: todayKey()
  });

  const bucket: TrendBucket = period.mode === 'KUSTOM' ? period.customBucket : period.mode;

  const trend = useMemo(
    () =>
      buildAssetTrend({
        products,
        stockTransactions,
        adjustments: assetAdjustments,
        bucket,
        from: period.mode === 'KUSTOM' ? period.from : undefined,
        to: period.mode === 'KUSTOM' ? period.to : undefined
      }),
    [products, stockTransactions, assetAdjustments, bucket, period.mode, period.from, period.to]
  );

  const liveValue = useMemo(() => currentStoreAssetValue(products), [products]);
  const lastPoint = trend.points[trend.points.length - 1];
  const firstPoint = trend.points[0];
  const periodChange = trend.points.reduce((acc, p) => acc + p.change, 0);
  const totalAdded = trend.points.reduce((acc, p) => acc + p.added, 0);
  const totalRemoved = trend.points.reduce((acc, p) => acc + p.removed, 0);
  const totalAdjusted = trend.points.reduce((acc, p) => acc + p.adjustments, 0);
  const totalAdjustmentRows = trend.points.reduce((acc, p) => acc + p.adjustmentRows, 0);

  const chartData = trend.points.map((p) => ({
    label: p.label,
    rangeLabel: p.rangeLabel,
    aset: Math.round(p.value),
    change: Math.round(p.change),
    added: Math.round(p.added),
    removed: Math.round(p.removed),
    adjusted: Math.round(p.adjustments),
    mutationRows: p.mutationRows,
    adjustmentRows: p.adjustmentRows
  }));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Pergerakan Total Aset Toko (Harga Kulak)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                Nilai barang dihitung berdasarkan harga modal saat ini, ditambah/dikurangi dengan
                penyesuaian uang yang tercatat saat kejadian (seperti perubahan harga kulak, koreksi
                stok manual, penjualan, atau produk baru).
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aset saat ini</div>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-800 tracking-tight">
              {formatRupiah(liveValue)}
            </div>
            <div className="text-[10.5px] text-slate-500 font-medium">
              {trend.points.length} periode &bull; catatan terakhir {lastPoint?.endDate || '-'}
            </div>
          </div>
        </div>

        <TrendPeriodControls
          state={period}
          onChange={setPeriod}
          activeBucket={bucket}
          rangeFrom={trend.rangeFrom}
          rangeTo={trend.rangeTo}
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat
          icon={periodChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          label="Perubahan selama periode ini"
          value={formatRupiah(periodChange)}
          tone={periodChange >= 0 ? 'emerald' : 'rose'}
          hint={`${firstPoint?.label || '-'} -> ${lastPoint?.label || '-'}`}
        />
        <MiniStat
          icon={<Wallet className="w-4 h-4" />}
          label="Bahan masuk (Pembelian)"
          value={formatRupiah(totalAdded)}
          tone="blue"
          hint={`${trend.points.reduce((acc, p) => acc + p.mutationRows, 0)} catatan stok`}
        />
        <MiniStat
          icon={<TrendingDown className="w-4 h-4" />}
          label="Bahan keluar (Pengambilan Agen)"
          value={formatRupiah(totalRemoved)}
          tone="amber"
          hint="Dihitung dengan harga kulak, bukan harga agen"
        />
        <MiniStat
          icon={<SlidersHorizontal className="w-4 h-4" />}
          label="Penyesuaian nilai"
          value={formatRupiah(totalAdjusted)}
          tone={totalAdjusted >= 0 ? 'emerald' : 'rose'}
          hint={`${totalAdjustmentRows} catatan: harga kulak berubah, koreksi stok, penjualan`}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Garis Nilai Aset per Periode
          </h4>
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: ASSET_COLOR }} />
            Total Aset Toko
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Belum ada catatan stok pada rentang ini.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `Rp ${shortRupiah(Number(val))}`}
                  width={72}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0].payload as (typeof chartData)[number];
                    return (
                      <div className="bg-slate-900 text-white rounded-xl px-3 py-2 text-[11px] shadow-lg border border-slate-700">
                        <div className="font-bold mb-1">{label}</div>
                        <div className="font-mono text-emerald-300">{formatRupiah(row.aset)}</div>
                        <div className="mt-1 space-y-0.5 text-slate-300">
                          <div>
                            Perubahan:{' '}
                            <span className={row.change >= 0 ? 'text-emerald-300 font-mono' : 'text-rose-300 font-mono'}>
                              {row.change >= 0 ? '+' : '-'}
                              {formatRupiah(Math.abs(row.change))}
                            </span>
                          </div>
                          <div>Masuk: <span className="font-mono text-sky-300">{formatRupiah(row.added)}</span></div>
                          <div>Keluar: <span className="font-mono text-amber-300">{formatRupiah(row.removed)}</span></div>
                          {row.adjusted !== 0 && (
                            <div>
                              Penyesuaian:{' '}
                              <span
                                className={
                                  row.adjusted >= 0
                                    ? 'font-mono text-emerald-300'
                                    : 'font-mono text-rose-300'
                                }
                              >
                                {row.adjusted >= 0 ? '+' : '-'}
                                {formatRupiah(Math.abs(row.adjusted))}
                              </span>
                            </div>
                          )}
                          <div className="text-slate-400">{row.rangeLabel}</div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="aset"
                  name="Total Aset Toko"
                  stroke={ASSET_COLOR}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: ASSET_COLOR }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-sans">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                <th className="text-left font-bold px-2.5 py-2 rounded-l-lg">Periode</th>
                <th className="text-right font-bold px-2.5 py-2">Nilai Aset Akhir</th>
                <th className="text-right font-bold px-2.5 py-2">Perubahan</th>
                <th className="text-right font-bold px-2.5 py-2">Bahan Masuk</th>
                <th className="text-right font-bold px-2.5 py-2">Bahan Keluar</th>
                <th className="text-right font-bold px-2.5 py-2">Penyesuaian</th>
                <th className="text-right font-bold px-2.5 py-2 rounded-r-lg">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {trend.points.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2.5 py-6 text-center text-slate-400">
                    Belum ada data untuk ditampilkan.
                  </td>
                </tr>
              )}
              {[...trend.points].reverse().map((point) => {
                const positive = point.change >= 0;
                return (
                  <tr key={point.key} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors">
                    <td className="px-2.5 py-2 text-left">
                      <div className="font-bold text-slate-800">{point.label}</div>
                      <div className="text-[9.5px] text-slate-400 font-mono">{point.rangeLabel}</div>
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-800">
                      {formatRupiah(point.value)}
                    </td>
                    <td
                      className={`px-2.5 py-2 text-right font-mono font-bold ${
                        positive ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {positive ? '+' : '-'}
                      {formatRupiah(Math.abs(point.change))}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-sky-700">
                      {point.added > 0 ? formatRupiah(point.added) : '-'}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-amber-700">
                      {point.removed > 0 ? formatRupiah(point.removed) : '-'}
                    </td>
                    <td
                      className={`px-2.5 py-2 text-right font-mono ${
                        point.adjustments === 0
                          ? 'text-slate-400'
                          : point.adjustments > 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                      }`}
                    >
                      {point.adjustments === 0
                        ? '-'
                        : `${point.adjustments > 0 ? '+' : '-'}${formatRupiah(Math.abs(point.adjustments))}`}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-slate-500">
                      {point.mutationRows + point.adjustmentRows}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 text-[10.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Nilai tiap periode dihitung mundur dari nilai hari ini. Catatan paling awal yang tersedia
            adalah {trend.rangeFrom}
            {trend.untrackedItemRows > 0
              ? ` • ${trend.untrackedItemRows} barang di catatan stok sudah tidak ada di daftar produk, jadi nilainya tidak ikut dihitung`
              : ''}
            . Perubahan harga kulak, koreksi stok manual, dan penjualan baru dicatat sebagai penyesuaian
            nilai sejak fitur ini aktif, jadi sebelum tanggal {trend.rangeFrom} garis hanya mengikuti stok
            masuk dan keluar.
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  hint,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: 'emerald' | 'rose' | 'blue' | 'amber';
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700'
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex items-start gap-2.5">
      <div className={`p-2 rounded-xl shrink-0 ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</div>
        <div className="text-base font-black font-mono text-slate-900 tracking-tight truncate">{value}</div>
        <div className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">{hint}</div>
      </div>
    </div>
  );
}
