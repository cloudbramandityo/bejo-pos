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
  Tooltip,
  Legend
} from 'recharts';
import { Users, Info, ShoppingCart } from 'lucide-react';
import { Agent, Product, StockTransaction } from '../../types';
import { formatRupiah, formatVolume } from '../../utils/formatters';
import { buildAgentPickupTrend, type TrendBucket } from '../../utils/assetTrend';
import TrendPeriodControls, { type TrendPeriodState } from './TrendPeriodControls';

interface AgentPickupPanelProps {
  stockTransactions: StockTransaction[];
  products: Product[];
  agents?: Agent[];
}

const AGENT_COLORS = [
  '#d97706', '#7c3aed', '#0891b2', '#db2777', '#059669',
  '#e11d48', '#4f46e5', '#65a30d', '#ea580c', '#0284c7'
];

const MAX_LINES = 10;

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

export default function AgentPickupPanel({ stockTransactions, products, agents }: AgentPickupPanelProps) {
  const [period, setPeriod] = useState<TrendPeriodState>({
    mode: 'MINGGUAN',
    customBucket: 'HARIAN',
    from: todayKey(),
    to: todayKey()
  });
  const [hiddenAgents, setHiddenAgents] = useState<Set<string>>(new Set());

  const bucket: TrendBucket = period.mode === 'KUSTOM' ? period.customBucket : period.mode;

  const trend = useMemo(
    () =>
      buildAgentPickupTrend({
        stockTransactions,
        products,
        agents,
        bucket,
        from: period.mode === 'KUSTOM' ? period.from : undefined,
        to: period.mode === 'KUSTOM' ? period.to : undefined
      }),
    [stockTransactions, products, agents, bucket, period.mode, period.from, period.to]
  );

  const linedAgents = trend.rows.slice(0, MAX_LINES);
  const chartData = trend.chartData.map((point) => {
    const filtered: Record<string, string | number> = { label: String(point.label ?? '') };
    linedAgents.forEach((row) => {
      if (hiddenAgents.has(row.name)) return;
      filtered[`agent_${row.name}`] = Number(point[`agent_${row.name}`] || 0);
    });
    return filtered;
  });

  const activeAgents = trend.rows.filter((r) => r.trxCount > 0).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700 shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Total Pengambilan tiap Agen</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                Nilai bahan yang diambil agen tiap minggu, bulan, atau rentang tanggal yang Anda pilih.
                Yang dihitung harga agen atau harga meter grosir yang tercatat di transaksinya.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total rentang ini</div>
            <div className="text-lg sm:text-xl font-black font-mono text-blue-900 tracking-tight">
              {formatRupiah(trend.grandTotalAmount)}
            </div>
            <div className="text-[10.5px] text-slate-500 font-medium">
              {activeAgents} agen aktif &bull; {trend.grandTrxCount} transaksi
            </div>
          </div>
        </div>

        <TrendPeriodControls
          state={period}
          onChange={setPeriod}
          activeBucket={bucket}
          rangeFrom={trend.rangeFrom}
          rangeTo={trend.rangeTo}
          accent="blue"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Garis Pengambilan per Agen
          </h4>
          <span className="text-[10.5px] text-slate-400 font-semibold">
            Klik nama agen untuk menyembunyikan garisnya
          </span>
        </div>

        {linedAgents.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Belum ada pengambilan agen pada rentang ini.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {linedAgents.map((row, idx) => {
                const hidden = hiddenAgents.has(row.name);
                return (
                  <button
                    key={row.name}
                    type="button"
                    onClick={() =>
                      setHiddenAgents((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.name)) next.delete(row.name);
                        else next.add(row.name);
                        return next;
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      hidden
                        ? 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: hidden ? '#cbd5e1' : AGENT_COLORS[idx % AGENT_COLORS.length] }}
                    />
                    <span className="truncate max-w-[140px]">{row.name}</span>
                  </button>
                );
              })}
            </div>

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
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 12,
                      fontSize: 11,
                      color: '#fff'
                    }}
                    formatter={(value: number | string, name: string) => [
                      formatRupiah(Number(value) || 0),
                      String(name).replace(/^agent_/, '')
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, color: '#475569' }}
                    formatter={(value) => String(value).replace(/^agent_/, '')}
                  />
                  {linedAgents.map((row, idx) => (
                    <Line
                      key={row.name}
                      type="monotone"
                      dataKey={`agent_${row.name}`}
                      name={`agent_${row.name}`}
                      stroke={AGENT_COLORS[idx % AGENT_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Tabel Rekapitulasi Pengambilan Agen
          </h4>
          <span className="text-[10px] text-slate-400 font-mono ml-auto">
            {trend.rangeFrom} s.d. {trend.rangeTo}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-sans">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                <th className="text-left font-bold px-3 py-2">Agen</th>
                <th className="text-right font-bold px-3 py-2">Transaksi</th>
                <th className="text-right font-bold px-3 py-2">Total Qty</th>
                <th className="text-right font-bold px-3 py-2">Total Pengambilan</th>
                <th className="text-right font-bold px-3 py-2">Nilai Kulak</th>
                <th className="text-right font-bold px-3 py-2">Laba Toko</th>
                <th className="text-right font-bold px-3 py-2">Porsi</th>
              </tr>
            </thead>
            <tbody>
              {trend.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                    Tidak ada pengambilan agen pada rentang ini.
                  </td>
                </tr>
              )}
              {trend.rows.map((row) => (
                <tr key={row.name} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2 font-bold text-slate-800">{row.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{row.trxCount}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">{formatVolume(row.totalQty)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-blue-900">
                    {formatRupiah(row.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">{formatRupiah(row.totalCost)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                    {formatRupiah(row.totalProfit)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {trend.grandTotalAmount > 0 ? `${((row.totalAmount / trend.grandTotalAmount) * 100).toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            {trend.rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white">
                  <td className="px-3 py-2.5 font-bold text-[10.5px] uppercase tracking-wider rounded-l-lg">
                    Total Semua Agen
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">{trend.grandTrxCount}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">{formatVolume(trend.grandTotalQty)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">{formatRupiah(trend.grandTotalAmount)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">{formatRupiah(trend.grandTotalCost)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-300">
                    {formatRupiah(trend.grandTotalProfit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold rounded-r-lg">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="px-4 sm:px-5 py-3 flex items-start gap-2 text-[10.5px] text-slate-500 bg-slate-50 border-t border-slate-100">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Baris grafik menampilkan {Math.min(linedAgents.length, MAX_LINES)} agen dengan nilai pengambilan
            terbesar. Nilai kulak dan laba memakai harga kulak produk saat ini; untuk rincian per produk dan
            jasa cetak agen, gunakan tab Laporan Agen.
          </span>
        </div>
      </div>
    </div>
  );
}
