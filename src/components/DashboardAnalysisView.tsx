/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  Truck,
  UserCheck,
  Receipt,
  ArrowRight,
  Layers,
  Wallet,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Sparkles,
  ArrowUpRight,
  Boxes,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  Percent,
  ChevronRight,
  Info,
  Building2,
  Users,
  Flame,
  Award
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RePieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { Transaction, StockTransaction, Product, Supplier, Agent, ProductCategoryItem } from '../types';
import { formatRupiah, formatVolume, isTransactionOnDate, getTransactionDateTimeEpoch } from '../utils/formatters';
import { normalizeStockTransaction, calculateStockItemProfit, calculateSalesItemCost } from '../utils/stockUtils';

interface DashboardAnalysisViewProps {
  transactions: Transaction[];
  stockTransactions: StockTransaction[];
  products: Product[];
  suppliers?: Supplier[];
  agents?: Agent[];
  productCategories?: ProductCategoryItem[];
  selectedDate: string;
  periodType: 'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'SEMUA';
  selectedMonth: number;
  selectedYear: number;
  storeName?: string;
  onPeriodTypeChange?: (period: 'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'SEMUA') => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const CHART_COLORS = {
  sales: '#2563eb',     // Blue 600
  agent: '#e11d48',     // Rose 600
  purchase: '#059669',  // Emerald 600
  profit: '#10b981',    // Emerald 500
  cash: '#16a34a',      // Green 600
  qris: '#7c3aed',      // Violet 600
  transfer: '#0284c7',  // Sky 600
  edc: '#ea580c',       // Orange 600
};

const PIE_PALETTE = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#4f46e5', '#db2777'];

/**
 * Laba penjualan bersih: pendapatan setelah PPN dikurangi HPP item.
 * PPN adalah kewajiban pajak, bukan pendapatan, sehingga tidak boleh menambah laba.
 */
function calculateNetSalesProfit(
  tx: Transaction,
  productMap: Map<string, Product>,
  productByCodeMap: Map<string, Product>,
  productByNameMap: Map<string, Product>
): number {
  let totalCost = 0;
  tx.items?.forEach((it) => {
    const prod =
      (it.productId ? productMap.get(it.productId) : null) ||
      (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
      (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);
    totalCost += calculateSalesItemCost(it, prod).totalCost;
  });
  const netRevenue = (Number(tx.total) || 0) - (Number(tx.tax) || 0);
  return netRevenue - totalCost;
}

const AGENT_COLORS = [
  '#d97706', // Amber 600
  '#7c3aed', // Violet 600
  '#0891b2', // Cyan 600
  '#db2777', // Pink 600
  '#059669', // Emerald 600
  '#e11d48', // Rose 600
  '#4f46e5', // Indigo 600
  '#65a30d', // Lime 600
  '#ea580c', // Orange 600
  '#0284c7', // Sky 600
];

/** Kunci tanggal lokal YYYY-MM-DD (hindari pergeseran hari akibat konversi UTC) */
const toLocalDateKey = (date: Date): string => {
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Kunci tanggal transaksi/stock: pakai field date bila sudah ISO, selain itu konversi timestamp ke tanggal lokal */
const getTransactionDateKey = (tx: { date?: string; time?: string; timestamp?: number }): string => {
  if (tx.date && /^\d{4}-\d{2}-\d{2}/.test(tx.date.trim())) return tx.date.trim().slice(0, 10);
  const epoch = getTransactionDateTimeEpoch(tx);
  if (!epoch) return '';
  return toLocalDateKey(new Date(epoch));
};

export const DashboardAnalysisView: React.FC<DashboardAnalysisViewProps> = ({
  transactions,
  stockTransactions,
  products,
  suppliers = [],
  agents = [],
  productCategories = [],
  selectedDate,
  periodType,
  selectedMonth,
  selectedYear,
  storeName = 'BEJO STIKER POS',
  onPeriodTypeChange,
}) => {
  const [activeTabSub, setActiveTabSub] = useState<'ringkasan' | 'arus_alur' | 'grafik_analisis'>('ringkasan');
  const [chartFilter, setChartFilter] = useState<'semua' | 'pembelian' | 'agen' | 'pos'>('semua');

  // Multi-Parameter Charting Controls
  const [showSalesLine, setShowSalesLine] = useState<boolean>(true);
  const [showPurchaseLine, setShowPurchaseLine] = useState<boolean>(true);
  const [showAllAgentsLine, setShowAllAgentsLine] = useState<boolean>(true);
  const [selectedAgentsForChart, setSelectedAgentsForChart] = useState<string[]>([]);

  // Simple Line Chart Toggles for KPI & Rangkuman
  const [simpleSalesLine, setSimpleSalesLine] = useState<boolean>(true);
  const [simplePurchaseLine, setSimplePurchaseLine] = useState<boolean>(true);
  const [simpleAgentLine, setSimpleAgentLine] = useState<boolean>(true);

  // Product Lookup Maps
  const { productMap, productByNameMap, productByCodeMap } = useMemo(() => {
    const pMap = new Map<string, Product>();
    const pByName = new Map<string, Product>();
    const pByCode = new Map<string, Product>();

    products.forEach((p) => {
      if (p.id) pMap.set(p.id, p);
      if (p.name) pByName.set(p.name.trim().toLowerCase(), p);
      if (p.code) pByCode.set(p.code.trim().toLowerCase(), p);
    });

    return { productMap: pMap, productByNameMap: pByName, productByCodeMap: pByCode };
  }, [products]);

  // Group Stock Transactions into multi-item transactions
  const normalizedStockTxs = useMemo(() => {
    return stockTransactions.map((tx) => normalizeStockTransaction(tx));
  }, [stockTransactions]);

  // Filter Transactions and Stock Transactions by current period
  const { filteredSales, filteredPurchases, filteredAgentTakes } = useMemo(() => {
    const isMatch = (tx: { date?: string; time?: string; timestamp?: number }) => {
      if (periodType === 'HARIAN') {
        return isTransactionOnDate(tx, selectedDate);
      }
      // Gunakan fallback date + time agar transaksi tanpa timestamp tetap masuk periode
      const txEpoch = getTransactionDateTimeEpoch(tx);
      if (!txEpoch) return false;
      if (periodType === 'MINGGUAN') {
        const targetDate = new Date(selectedDate);
        const day = targetDate.getDay();
        const diffToMonday = targetDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(targetDate.setDate(diffToMonday));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return txEpoch >= monday.getTime() && txEpoch <= sunday.getTime();
      }
      if (periodType === 'BULANAN') {
        const d = new Date(txEpoch);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      }
      return true; // SEMUA
    };

    // Invoice batal / bernilai nol tidak boleh menambah omzet maupun HPP
    const sales = transactions.filter(
      (t) =>
        isMatch(t) &&
        !(t.isInvoice && (t.invoiceStatus === 'CANCELLED' || t.total === 0))
    );
    const purchases = normalizedStockTxs.filter((st) => st.type === 'PEMBELIAN' && isMatch(st));
    const agentTakes = normalizedStockTxs.filter((st) => st.type === 'PENGAMBILAN' && isMatch(st));

    return {
      filteredSales: sales,
      filteredPurchases: purchases,
      filteredAgentTakes: agentTakes,
    };
  }, [transactions, normalizedStockTxs, periodType, selectedDate, selectedMonth, selectedYear]);

  // Calculations for Sales
  const salesMetrics = useMemo(() => {
    let totalOmset = 0;
    let totalItemsSold = 0;
    let totalCash = 0;
    let totalTransfer = 0;
    let totalQris = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalEstimatedCost = 0;

    filteredSales.forEach((t) => {
      totalOmset += t.total;
      totalCash += t.paymentMethods?.cash || 0;
      totalTransfer += t.paymentMethods?.transfer || 0;
      totalQris += t.paymentMethods?.qris || 0;
      totalDiscount += t.discount || 0;
      totalTax += t.tax || 0;

      t.items?.forEach((it) => {
        totalItemsSold += it.qty || it.quantity || 1;
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);

        const costRes = calculateSalesItemCost(it, prod);
        totalEstimatedCost += costRes.totalCost;
      });
    });

    const totalEstimatedProfit = totalOmset - totalTax - totalEstimatedCost;

    return {
      trxCount: filteredSales.length,
      totalOmset,
      totalItemsSold,
      totalCash,
      totalTransfer,
      totalQris,
      totalDiscount,
      totalEstimatedCost,
      totalEstimatedProfit,
      avgTicket: filteredSales.length > 0 ? Math.round(totalOmset / filteredSales.length) : 0,
    };
  }, [filteredSales, productMap, productByCodeMap, productByNameMap]);

  // Calculations for Purchases (Pembelian Bahan)
  const purchaseMetrics = useMemo(() => {
    let totalSpend = 0;
    let totalVolume = 0;
    const supplierMap = new Map<string, { count: number; spend: number }>();

    filteredPurchases.forEach((p) => {
      totalSpend += p.totalAmount || 0;
      totalVolume += p.totalQty || 0;

      const sName = p.supplierName || 'Supplier Umum';
      const existing = supplierMap.get(sName) || { count: 0, spend: 0 };
      supplierMap.set(sName, {
        count: existing.count + 1,
        spend: existing.spend + (p.totalAmount || 0),
      });
    });

    const topSuppliers = Array.from(supplierMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.spend - a.spend);

    return {
      trxCount: filteredPurchases.length,
      totalSpend,
      totalVolume,
      topSuppliers,
    };
  }, [filteredPurchases]);

  // Calculations for Agent Takes (Pengambilan Bahan)
  const agentTakeMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalVolume = 0;
    let totalKulakHPP = 0;
    let totalAgentProfit = 0;
    const agentMap = new Map<string, { count: number; revenue: number; volume: number; profit: number }>();

    filteredAgentTakes.forEach((tx) => {
      totalRevenue += tx.totalAmount || 0;
      totalVolume += tx.totalQty || 0;

      let txCost = 0;
      let txProfit = 0;

      tx.items.forEach((it) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);

        const pData = calculateStockItemProfit(it, prod);
        txCost += pData.totalCost;
        txProfit += pData.totalProfit;
      });

      totalKulakHPP += txCost;
      totalAgentProfit += txProfit;

      const aName = tx.supplierName || 'Agen Umum';
      const existing = agentMap.get(aName) || { count: 0, revenue: 0, volume: 0, profit: 0 };
      agentMap.set(aName, {
        count: existing.count + 1,
        revenue: existing.revenue + (tx.totalAmount || 0),
        volume: existing.volume + (tx.totalQty || 0),
        profit: existing.profit + txProfit,
      });
    });

    const topAgents = Array.from(agentMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      trxCount: filteredAgentTakes.length,
      totalRevenue,
      totalVolume,
      totalKulakHPP,
      totalAgentProfit,
      topAgents,
    };
  }, [filteredAgentTakes, productMap, productByCodeMap, productByNameMap]);

  // Available Agent List for Chart Comparison Selection
  const availableAgentsList = useMemo(() => {
    const map = new Map<string, number>();
    filteredAgentTakes.forEach((at) => {
      const name = (at.supplierName || 'Agen Umum').trim();
      if (name) {
        map.set(name, (map.get(name) || 0) + (at.totalAmount || 0));
      }
    });
    agents.forEach((ag) => {
      if (ag.name && !map.has(ag.name.trim())) {
        map.set(ag.name.trim(), 0);
      }
    });

    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredAgentTakes, agents]);

  // Grand Total Financial Overview
  const grandFinancial = useMemo(() => {
    // Total uang masuk toko: Penjualan Kasir + Pengambilan Bahan Agen
    const totalGrossInflow = salesMetrics.totalOmset + agentTakeMetrics.totalRevenue;
    // Total uang keluar toko (pembelian bahan)
    const totalOutflow = purchaseMetrics.totalSpend;
    // Total estimasi laba kotor / bersih gabungan
    const totalCombinedProfit = salesMetrics.totalEstimatedProfit + agentTakeMetrics.totalAgentProfit;
    // Net cashflow
    const netCashflow = totalGrossInflow - totalOutflow;

    return {
      totalGrossInflow,
      totalOutflow,
      totalCombinedProfit,
      netCashflow,
      totalAllTransactions: salesMetrics.trxCount + purchaseMetrics.trxCount + agentTakeMetrics.trxCount,
    };
  }, [salesMetrics, purchaseMetrics, agentTakeMetrics]);

  // Timeline Trend Data for Chart
  const timelineChartData = useMemo(() => {
    // ----------------------------------------------------
    // CASE 1: HARIAN (Realtime dari Buka Kasir s/d Closing per jam)
    // ----------------------------------------------------
    if (periodType === 'HARIAN') {
      const hourMap = new Map<number, { hour: number; displayDate: string; sales: number; agent: number; purchase: number; profit: number }>();

      // Operational range default: 07:00 to 22:00
      let minHour = 7;
      let maxHour = 22;

      // Expand min/max hour if transactions fall outside 07:00-22:00
      const checkTimestamps = (ts: number) => {
        if (!ts) return;
        const d = new Date(ts);
        const h = d.getHours();
        if (h < minHour) minHour = Math.max(0, h);
        if (h > maxHour) maxHour = Math.min(23, h);
      };

      filteredSales.forEach((s) => checkTimestamps(s.timestamp));
      filteredAgentTakes.forEach((at) => checkTimestamps(at.timestamp));
      filteredPurchases.forEach((p) => checkTimestamps(p.timestamp));

      // Also include current hour if date is today
      const now = new Date();
      const isToday = selectedDate === toLocalDateKey(now);
      if (isToday) {
        const currentH = now.getHours();
        if (currentH > maxHour) maxHour = Math.min(23, currentH);
      }

      // Initialize all hourly slots from minHour to maxHour
      for (let h = minHour; h <= maxHour; h++) {
        const hourLabel = `${String(h).padStart(2, '0')}:00`;
        hourMap.set(h, {
          hour: h,
          displayDate: hourLabel,
          sales: 0,
          agent: 0,
          purchase: 0,
          profit: 0,
        });
      }

      // Populate Sales by hour
      filteredSales.forEach((s) => {
        const d = new Date(s.timestamp);
        const h = d.getHours();
        const slot = hourMap.get(h);
        if (slot) {
          slot.sales += s.total;
          slot.profit += calculateNetSalesProfit(s, productMap, productByCodeMap, productByNameMap);
        }
      });

      // Populate Agent Takes by hour
      filteredAgentTakes.forEach((at) => {
        const d = new Date(at.timestamp);
        const h = d.getHours();
        const slot = hourMap.get(h);
        if (slot) {
          const amt = at.totalAmount || 0;
          slot.agent += amt;
          const aName = (at.supplierName || 'Agen Umum').trim();
          if (aName) {
            (slot as any)[`agent_${aName}`] = ((slot as any)[`agent_${aName}`] || 0) + amt;
          }
          let atProfit = 0;
          at.items.forEach((it) => {
            const prod =
              (it.productId ? productMap.get(it.productId) : null) ||
              (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
              (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
            atProfit += calculateStockItemProfit(it, prod).totalProfit;
          });
          slot.profit += atProfit;
        }
      });

      // Populate Purchases by hour
      filteredPurchases.forEach((p) => {
        const d = new Date(p.timestamp);
        const h = d.getHours();
        const slot = hourMap.get(h);
        if (slot) {
          slot.purchase += p.totalAmount || 0;
        }
      });

      return Array.from(hourMap.values()).sort((a, b) => a.hour - b.hour);
    }

    // ----------------------------------------------------
    // CASE 2: MINGGUAN (Awal Minggu s/d Akhir Minggu)
    // ----------------------------------------------------
    if (periodType === 'MINGGUAN') {
      const dayMap = new Map<string, { date: string; displayDate: string; sales: number; agent: number; purchase: number; profit: number }>();
      const DAY_NAMES_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Ming'];

      const targetDate = new Date(selectedDate);
      const day = targetDate.getDay();
      const diffToMonday = targetDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(targetDate);
      monday.setDate(diffToMonday);
      monday.setHours(0, 0, 0, 0);

      // Populate 7 days of the week (Monday through Sunday)
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateKey = toLocalDateKey(d);
        const dayLabel = `${DAY_NAMES_ID[i]} (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')})`;

        dayMap.set(dateKey, {
          date: dateKey,
          displayDate: dayLabel,
          sales: 0,
          agent: 0,
          purchase: 0,
          profit: 0,
        });
      }

      // Populate Sales
      filteredSales.forEach((s) => {
        const dateKey = getTransactionDateKey(s);
        const slot = dayMap.get(dateKey);
        if (slot) {
          slot.sales += s.total;
          slot.profit += calculateNetSalesProfit(s, productMap, productByCodeMap, productByNameMap);
        }
      });

      // Populate Agent Takes
      filteredAgentTakes.forEach((at) => {
        const dateKey = getTransactionDateKey(at);
        const slot = dayMap.get(dateKey);
        if (slot) {
          const amt = at.totalAmount || 0;
          slot.agent += amt;
          const aName = (at.supplierName || 'Agen Umum').trim();
          if (aName) {
            (slot as any)[`agent_${aName}`] = ((slot as any)[`agent_${aName}`] || 0) + amt;
          }
          let atProfit = 0;
          at.items.forEach((it) => {
            const prod =
              (it.productId ? productMap.get(it.productId) : null) ||
              (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
              (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
            atProfit += calculateStockItemProfit(it, prod).totalProfit;
          });
          slot.profit += atProfit;
        }
      });

      // Populate Purchases
      filteredPurchases.forEach((p) => {
        const dateKey = getTransactionDateKey(p);
        const slot = dayMap.get(dateKey);
        if (slot) {
          slot.purchase += p.totalAmount || 0;
        }
      });

      return Array.from(dayMap.values());
    }

    // ----------------------------------------------------
    // CASE 3: BULANAN (Awal Bulan s/d Akhir Bulan)
    // ----------------------------------------------------
    if (periodType === 'BULANAN') {
      const dayMap = new Map<string, { date: string; displayDate: string; sales: number; agent: number; purchase: number; profit: number }>();
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const dayLabel = `${String(dayNum).padStart(2, '0')}/${String(selectedMonth + 1).padStart(2, '0')}`;

        dayMap.set(dateKey, {
          date: dateKey,
          displayDate: dayLabel,
          sales: 0,
          agent: 0,
          purchase: 0,
          profit: 0,
        });
      }

      // Populate Sales
      filteredSales.forEach((s) => {
        const dateKey = getTransactionDateKey(s);
        const slot = dayMap.get(dateKey);
        if (slot) {
          slot.sales += s.total;
          slot.profit += calculateNetSalesProfit(s, productMap, productByCodeMap, productByNameMap);
        }
      });

      // Populate Agent Takes
      filteredAgentTakes.forEach((at) => {
        const dateKey = getTransactionDateKey(at);
        const slot = dayMap.get(dateKey);
        if (slot) {
          const amt = at.totalAmount || 0;
          slot.agent += amt;
          const aName = (at.supplierName || 'Agen Umum').trim();
          if (aName) {
            (slot as any)[`agent_${aName}`] = ((slot as any)[`agent_${aName}`] || 0) + amt;
          }
          let atProfit = 0;
          at.items.forEach((it) => {
            const prod =
              (it.productId ? productMap.get(it.productId) : null) ||
              (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
              (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
            atProfit += calculateStockItemProfit(it, prod).totalProfit;
          });
          slot.profit += atProfit;
        }
      });

      // Populate Purchases
      filteredPurchases.forEach((p) => {
        const dateKey = getTransactionDateKey(p);
        const slot = dayMap.get(dateKey);
        if (slot) {
          slot.purchase += p.totalAmount || 0;
        }
      });

      return Array.from(dayMap.values());
    }

    // ----------------------------------------------------
    // CASE 4: SEMUA (Aggregated by dates)
    // ----------------------------------------------------
    const dayMap = new Map<string, { date: string; displayDate: string; sales: number; agent: number; purchase: number; profit: number }>();

    const getDayKey = (tx: { date?: string; time?: string; timestamp?: number }) => {
      return getTransactionDateKey(tx);
    };

    const formatDisplay = (dateKey: string) => {
      const parts = dateKey.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      return dateKey;
    };

    filteredSales.forEach((s) => {
      const key = getDayKey(s);
      const cur = dayMap.get(key) || { date: key, displayDate: formatDisplay(key), sales: 0, agent: 0, purchase: 0, profit: 0 };
      cur.sales += s.total;
      cur.profit += calculateNetSalesProfit(s, productMap, productByCodeMap, productByNameMap);
      dayMap.set(key, cur);
    });

    filteredAgentTakes.forEach((at) => {
      const key = getDayKey(at);
      const cur = dayMap.get(key) || { date: key, displayDate: formatDisplay(key), sales: 0, agent: 0, purchase: 0, profit: 0 };
      const amt = at.totalAmount || 0;
      cur.agent += amt;
      const aName = (at.supplierName || 'Agen Umum').trim();
      if (aName) {
        (cur as any)[`agent_${aName}`] = ((cur as any)[`agent_${aName}`] || 0) + amt;
      }

      let atProfit = 0;
      at.items.forEach((it) => {
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);
        atProfit += calculateStockItemProfit(it, prod).totalProfit;
      });
      cur.profit += atProfit;
      dayMap.set(key, cur);
    });

    filteredPurchases.forEach((p) => {
      const key = getDayKey(p);
      const cur = dayMap.get(key) || { date: key, displayDate: formatDisplay(key), sales: 0, agent: 0, purchase: 0, profit: 0 };
      cur.purchase += p.totalAmount || 0;
      dayMap.set(key, cur);
    });

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [
    periodType,
    selectedDate,
    selectedMonth,
    selectedYear,
    filteredSales,
    filteredAgentTakes,
    filteredPurchases,
    productMap,
    productByCodeMap,
    productByNameMap,
  ]);

  // Revenue Source Breakdown (Pie Chart)
  const revenueBreakdownData = useMemo(() => {
    const list = [
      { name: 'Penjualan Kasir POS', value: salesMetrics.totalOmset, color: CHART_COLORS.sales },
      { name: 'Pengambilan Bahan Agen', value: agentTakeMetrics.totalRevenue, color: CHART_COLORS.agent },
    ].filter((item) => item.value > 0);

    return list.length > 0 ? list : [{ name: 'Belum Ada Transaksi', value: 1, color: '#94a3b8' }];
  }, [salesMetrics.totalOmset, agentTakeMetrics.totalRevenue]);

  // Payment Method Breakdown
  const paymentMethodData = useMemo(() => {
    const list = [
      { name: 'Tunai (Cash)', value: salesMetrics.totalCash, color: CHART_COLORS.cash },
      { name: 'QRIS', value: salesMetrics.totalQris, color: CHART_COLORS.qris },
      { name: 'Transfer Bank', value: salesMetrics.totalTransfer, color: CHART_COLORS.transfer },
    ].filter((item) => item.value > 0);

    return list.length > 0 ? list : [{ name: 'Belum Ada Data', value: 1, color: '#cbd5e1' }];
  }, [salesMetrics]);

  // Top Sold Products from POS
  const topSoldProducts = useMemo(() => {
    const prodMap = new Map<string, { name: string; qty: number; revenue: number; category?: string }>();

    filteredSales.forEach((s) => {
      s.items?.forEach((it) => {
        const name = it.name || 'Produk';
        const cur = prodMap.get(name) || { name, qty: 0, revenue: 0, category: it.category };
        cur.qty += it.quantity || 1;
        cur.revenue += (it.totalPrice || (it.price * (it.quantity || 1))) || 0;
        prodMap.set(name, cur);
      });
    });

    return Array.from(prodMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales]);

  // Top Fast Moving Materials from POS Sales
  const rekapBahanFastMovingSales = useMemo(() => {
    const map = new Map<
      string,
      { name: string; category: string; qty: number; unit: string; totalRevenue: number; totalProfit: number }
    >();

    filteredSales.forEach((s) => {
      const txItemsRevenue = (s.items || []).reduce((acc, it) => {
        const qty = Number(it.qty ?? it.quantity) || 1;
        return acc + (it.totalPrice !== undefined && it.totalPrice !== null ? Number(it.totalPrice) : (Number(it.unitPrice) || 0) * qty);
      }, 0);
      const txNetRevenue = Math.max(0, (Number(s.total) || 0) - (Number(s.tax) || 0));
      const revenueFactor = txItemsRevenue > 0 ? txNetRevenue / txItemsRevenue : 1;

      s.items?.forEach((it) => {
        const key = (it.productId || it.code || it.name || 'unknown').trim().toLowerCase();
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.name ? productByNameMap.get(it.name.trim().toLowerCase()) : null);

        const name = it.name || prod?.name || 'Produk POS';
        let rawCategory = prod?.category || it.saleType || 'Umum';
        if (rawCategory === 'custom_sticker' || rawCategory === 'custom sticker' || rawCategory === 'custom_stiker') {
          rawCategory = 'vinyl_sticker';
        }
        const category = rawCategory;
        const unit = it.unit || prod?.unit || 'pcs';
        const qty = Number(it.qty ?? it.quantity) || 1;

        const profitRes = calculateSalesItemCost(it, prod);
        const rawRevenue =
          it.totalPrice !== undefined && it.totalPrice !== null
            ? Number(it.totalPrice)
            : (Number(it.unitPrice) || 0) * qty;
        const revenue = rawRevenue * revenueFactor;
        const itemProfit = revenue - profitRes.totalCost;

        const existing = map.get(key);
        if (existing) {
          existing.qty += qty;
          existing.totalRevenue += revenue;
          existing.totalProfit += itemProfit;
        } else {
          map.set(key, { name, category, qty, unit, totalRevenue: revenue, totalProfit: itemProfit });
        }
      });
    });

    const items = Array.from(map.values());
    items.sort((a, b) => b.qty - a.qty || b.totalRevenue - a.totalRevenue);
    return items.slice(0, 5);
  }, [filteredSales, productMap, productByCodeMap, productByNameMap]);

  // Top Fast Moving Materials from Agent Takes
  const rekapBahanFastMovingAgent = useMemo(() => {
    const map = new Map<
      string,
      { name: string; category: string; qty: number; unit: string; totalRevenue: number; totalProfit: number }
    >();

    filteredAgentTakes.forEach((stx) => {
      stx.items?.forEach((it) => {
        const key = (it.productId || it.code || it.name || 'unknown').trim().toLowerCase();
        const prod =
          (it.productId ? productMap.get(it.productId) : null) ||
          (it.code ? productByCodeMap.get(it.code.trim().toLowerCase()) : null) ||
          (it.productName ? productByNameMap.get(it.productName.trim().toLowerCase()) : null);

        const name = it.productName || it.name || prod?.name || 'Bahan Agen';
        let rawCategory = prod?.category || 'Bahan Stok';
        if (rawCategory === 'custom_sticker' || rawCategory === 'custom sticker' || rawCategory === 'custom_stiker') {
          rawCategory = 'vinyl_sticker';
        }
        const category = rawCategory;
        const unit = it.unit || prod?.unit || 'roll';
        const qty = Number(it.qty) || 1;

        const profitRes = calculateStockItemProfit(it, prod);
        const revenue = Number(it.totalPrice) || 0;

        const existing = map.get(key);
        if (existing) {
          existing.qty += qty;
          existing.totalRevenue += revenue;
          existing.totalProfit += profitRes.totalProfit;
        } else {
          map.set(key, { name, category, qty, unit, totalRevenue: revenue, totalProfit: profitRes.totalProfit });
        }
      });
    });

    const items = Array.from(map.values());
    items.sort((a, b) => b.qty - a.qty || b.totalRevenue - a.totalRevenue);
    return items.slice(0, 5);
  }, [filteredAgentTakes, productMap, productByCodeMap, productByNameMap]);

  // Format period badge label
  const periodLabelText = useMemo(() => {
    if (periodType === 'HARIAN') return `Harian (${selectedDate})`;
    if (periodType === 'MINGGUAN') return `Mingguan (Sekitar ${selectedDate})`;
    if (periodType === 'BULANAN') return `Bulan ${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    return 'Semua Data Transaksi';
  }, [periodType, selectedDate, selectedMonth, selectedYear]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Banner Executive Overview */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-sm relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-slate-800 text-slate-200 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                EXECUTIVE DASHBOARD ANALYSIS
              </span>
              <span className="bg-slate-800 text-slate-300 text-[11px] font-mono px-2 py-0.5 rounded-lg border border-slate-700">
                {periodLabelText}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Ringkasan Kinerja & Alur Finansial {storeName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Analisis menyeluruh mencakup penjualan ritel kasir POS, pengambilan stok bahan oleh agen rekanan, kulakan belanja supplier, dan estimasi arus kas bersih.
            </p>
          </div>

          {/* Sub Navigation Pill */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveTabSub('ringkasan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTabSub === 'ringkasan'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>KPI & Rangkuman</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabSub('arus_alur')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTabSub === 'arus_alur'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flow Chart Alur Toko</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabSub('grafik_analisis')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTabSub === 'grafik_analisis'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Grafik & Diagram</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Main Summary KPI Cards (Visible in KPI & Rangkuman tab) */}
      {activeTabSub === 'ringkasan' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Penjualan POS */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                1. Penjualan Kasir POS
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black font-mono text-blue-900 tracking-tight">
                {formatRupiah(salesMetrics.totalOmset)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 pt-1.5 border-t border-slate-100 font-medium">
                <span>{salesMetrics.trxCount} Transaksi ({salesMetrics.totalItemsSold} Item)</span>
                <span className="text-emerald-700 font-bold font-mono">
                  Laba: {formatRupiah(salesMetrics.totalEstimatedProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Pengambilan Bahan Agen */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                2. Pengambilan Bahan Agen
              </span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-700 tracking-tight">
                {formatRupiah(agentTakeMetrics.totalRevenue)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 pt-1.5 border-t border-slate-100 font-medium">
                <span>{agentTakeMetrics.trxCount} Trx ({agentTakeMetrics.totalVolume} Unit)</span>
                <span className="text-emerald-700 font-bold font-mono bg-emerald-50 px-1.5 py-0.2 rounded">
                  Laba: {formatRupiah(agentTakeMetrics.totalAgentProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Pembelian Bahan Supplier */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                3. Belanja / Kulakan Supplier
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-800 tracking-tight">
                {formatRupiah(purchaseMetrics.totalSpend)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 pt-1.5 border-t border-slate-100 font-medium">
                <span>{purchaseMetrics.trxCount} Trx Pembelian</span>
                <span>{purchaseMetrics.totalVolume} Unit Masuk</span>
              </div>
            </div>
          </div>

          {/* Card 4: Total Estimasi Laba Bersih Toko */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                4. Total Estimasi Laba Toko
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 group-hover:scale-110 transition-transform">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tracking-tight">
                {formatRupiah(grandFinancial.totalCombinedProfit)}
              </div>
              <div className="flex flex-col gap-1 text-[11px] text-slate-600 mt-1 pt-1.5 border-t border-slate-100 font-medium">
                <div className="flex justify-between items-center">
                  <span>Laba Retail POS:</span>
                  <strong className="font-mono text-slate-900 font-bold">{formatRupiah(salesMetrics.totalEstimatedProfit)}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>Laba Agen:</span>
                  <strong className="font-mono text-slate-900 font-bold">{formatRupiah(agentTakeMetrics.totalAgentProfit)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIMPLE LINE CHART FOR MODE KPI & RANGKUMAN */}
      {activeTabSub === 'ringkasan' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Grafik Finansial BEJO STIKER
              </h3>
              <p className="text-xs text-slate-500">
                Penjualan Kasir POS, Pembelian Bahan, dan Pengambilan Agen ({periodLabelText}).
              </p>
            </div>

            {/* Quick Parameter Toggles */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSimpleSalesLine(!simpleSalesLine)}
                className={`px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  simpleSalesLine
                    ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${simpleSalesLine ? 'bg-white' : 'bg-blue-600'}`} />
                <Receipt className="w-3.5 h-3.5" />
                <span>Penjualan POS</span>
              </button>

              <button
                type="button"
                onClick={() => setSimplePurchaseLine(!simplePurchaseLine)}
                className={`px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  simplePurchaseLine
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${simplePurchaseLine ? 'bg-white' : 'bg-emerald-600'}`} />
                <Truck className="w-3.5 h-3.5" />
                <span>Pembelian Bahan</span>
              </button>

              <button
                type="button"
                onClick={() => setSimpleAgentLine(!simpleAgentLine)}
                className={`px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  simpleAgentLine
                    ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${simpleAgentLine ? 'bg-white' : 'bg-rose-600'}`} />
                <UserCheck className="w-3.5 h-3.5" />
                <span>Pengambilan Agen</span>
              </button>
            </div>
          </div>

          <div className="h-64 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `Rp ${(val / 1000).toFixed(0)}k`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800 font-sans">
                          <p className="font-bold text-slate-300 pb-1 border-b border-slate-800">
                            {periodType === 'HARIAN'
                              ? `Jam ${label} WIB (Realtime)`
                              : periodType === 'MINGGUAN'
                              ? `Hari ${label}`
                              : periodType === 'BULANAN'
                              ? `Tanggal ${label}`
                              : `Periode: ${label}`}
                          </p>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex justify-between gap-4 items-center">
                              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}:
                              </span>
                              <strong className="font-mono text-white">
                                {formatRupiah(Number(entry.value) || 0)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                {simpleSalesLine && (
                  <Line type="linear" dataKey="sales" name="Penjualan POS" stroke={CHART_COLORS.sales} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} activeDot={{ r: 7 }} />
                )}
                {simpleAgentLine && (
                  <Line type="linear" dataKey="agent" name="Pengambilan Agen" stroke={CHART_COLORS.agent} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} activeDot={{ r: 7 }} />
                )}
                {simplePurchaseLine && (
                  <Line type="linear" dataKey="purchase" name="Pembelian Bahan" stroke={CHART_COLORS.purchase} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} activeDot={{ r: 7 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Opsi rentang waktu: Hari, Minggu, Bulan */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Rentang Waktu Line Chart:
            </span>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => onPeriodTypeChange?.('HARIAN')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  periodType === 'HARIAN'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Hari</span>
              </button>

              <button
                type="button"
                onClick={() => onPeriodTypeChange?.('MINGGUAN')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  periodType === 'MINGGUAN'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Minggu</span>
              </button>

              <button
                type="button"
                onClick={() => onPeriodTypeChange?.('BULANAN')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  periodType === 'BULANAN'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Bulan</span>
              </button>

              <button
                type="button"
                onClick={() => onPeriodTypeChange?.('SEMUA')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  periodType === 'SEMUA'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: FLOW CHART ALUR TRANSAKSI & FINANSIAL TOKO */}
      {activeTabSub === 'arus_alur' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  Flow Chart: Alur Terpadu Transaksi & Keuangan Toko
                </h3>
                <p className="text-xs text-slate-500">
                  Visualisasi sederhana pergerakan arus barang (stok) dan aliran dana dari supplier hingga ke kas toko.
                </p>
              </div>
            </div>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-200/60 self-start sm:self-auto">
              Total {grandFinancial.totalAllTransactions} Transaksi Terproses
            </span>
          </div>

          {/* Interactive Flow Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
            {/* Step 1: Input / Supplier */}
            <div className="bg-linear-to-b from-emerald-50/70 to-emerald-100/30 border border-emerald-200 rounded-2xl p-4 flex flex-col justify-between relative group hover:shadow-md transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
                    Tahap 1: Inflow Stok
                  </span>
                  <Truck className="w-4 h-4 text-emerald-600" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Kulakan dari Supplier</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Penerimaan bahan mentah, stiker vinyl, tinta, dan supplies dari distributor.
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-emerald-200/80 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Belanja:</span>
                  <strong className="font-mono text-emerald-900">{formatRupiah(purchaseMetrics.totalSpend)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Volume:</span>
                  <span className="font-bold text-slate-800">{purchaseMetrics.totalVolume} Unit</span>
                </div>
              </div>
            </div>

            {/* Step 2: Storage & Toko */}
            <div className="bg-linear-to-b from-slate-50 to-slate-100/70 border border-slate-300 rounded-2xl p-4 flex flex-col justify-between relative group hover:shadow-md transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider bg-slate-200 px-2 py-0.5 rounded">
                    Tahap 2: Inventory
                  </span>
                  <Boxes className="w-4 h-4 text-slate-700" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Gudang & Display Toko</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Penyimpanan stok bahan, antrean produksi cetak, dan display stiker retail.
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Katalog Aktif:</span>
                  <strong className="text-slate-800">{products.length} SKU Produk</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Toko:</span>
                  <span className="text-emerald-700 font-bold">Online & Sinkron</span>
                </div>
              </div>
            </div>

            {/* Step 3: 2 Saluran Output Distribusi */}
            <div className="bg-linear-to-b from-blue-50/70 to-indigo-50/40 border border-blue-200 rounded-2xl p-4 flex flex-col justify-between relative group hover:shadow-md transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider bg-blue-100 px-2 py-0.5 rounded">
                    Tahap 3: 2 Saluran Penjualan
                  </span>
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Penjualan & Distribusi</h4>
                <div className="space-y-1.5 text-[11px] text-slate-600">
                  <div className="bg-white/80 p-1.5 rounded-lg border border-blue-100 flex justify-between items-center">
                    <span>Kasir POS:</span>
                    <strong className="font-mono text-blue-900">{formatRupiah(salesMetrics.totalOmset)}</strong>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded-lg border border-rose-100 flex justify-between items-center">
                    <span>Agen Rekanan:</span>
                    <strong className="font-mono text-rose-700">{formatRupiah(agentTakeMetrics.totalRevenue)}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-blue-200/80 text-[11px] text-blue-800 font-semibold text-center">
                Total Omset: <strong className="font-mono text-xs">{formatRupiah(grandFinancial.totalGrossInflow)}</strong>
              </div>
            </div>

            {/* Step 4: Net Cash Flow & Profit */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col justify-between relative hover:shadow-xs transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-emerald-900 tracking-wider bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                    Tahap 4: Hasil Akhir
                  </span>
                  <Wallet className="w-4 h-4 text-emerald-700" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Laba Bersih & Kas Toko</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Uang tunai, QRIS, dan transfer bank setelah dikurangi seluruh HPP bahan.
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-emerald-200 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Laba Toko:</span>
                  <strong className="font-mono text-sm text-emerald-800 font-bold">
                    {formatRupiah(grandFinancial.totalCombinedProfit)}
                  </strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600">Arus Kas Masuk:</span>
                  <span className="font-mono text-slate-900 font-bold">{formatRupiah(grandFinancial.netCashflow)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: CHARTS & VISUAL DIAGRAMS */}
      {activeTabSub === 'grafik_analisis' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Chart: Tren Perbandingan Finansial Timeline */}
          <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Grafik Perbandingan Multi-Parameter
                </h3>
                <p className="text-xs text-slate-500">
                  Pilih beberapa parameter & agen sekaligus untuk melihat grafik perbandingan lurus ({periodLabelText}).
                </p>
              </div>

              {/* Quick Scenario Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Preset:</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesLine(true);
                    setShowPurchaseLine(true);
                    setShowAllAgentsLine(true);
                    setSelectedAgentsForChart([]);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold transition-all cursor-pointer border border-slate-200"
                >
                  📊 Semua Finansial
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesLine(false);
                    setShowPurchaseLine(false);
                    setShowAllAgentsLine(false);
                    const topNames = availableAgentsList.slice(0, 3).map(a => a.name);
                    setSelectedAgentsForChart(topNames);
                  }}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                >
                  👥 Antar Agen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesLine(true);
                    setShowPurchaseLine(false);
                    setShowAllAgentsLine(false);
                    const firstAgent = availableAgentsList[0]?.name;
                    setSelectedAgentsForChart(firstAgent ? [firstAgent] : []);
                  }}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                >
                  👤 Agen vs POS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesLine(false);
                    setShowPurchaseLine(true);
                    setShowAllAgentsLine(true);
                    setSelectedAgentsForChart([]);
                  }}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                >
                  🚚 Supplier vs Agen
                </button>
              </div>
            </div>

            {/* Parameter & Agent Selector Panel */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
              {/* Main Parameter Toggles */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  1. Pilih Parameter Utama:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSalesLine(!showSalesLine)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      showSalesLine
                        ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${showSalesLine ? 'bg-white' : 'bg-blue-600'}`} />
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Penjualan POS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPurchaseLine(!showPurchaseLine)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      showPurchaseLine
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${showPurchaseLine ? 'bg-white' : 'bg-emerald-600'}`} />
                    <Truck className="w-3.5 h-3.5" />
                    <span>Belanja Supplier</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAllAgentsLine(!showAllAgentsLine)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      showAllAgentsLine
                        ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${showAllAgentsLine ? 'bg-white' : 'bg-rose-600'}`} />
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Total Semua Agen</span>
                  </button>
                </div>
              </div>

              {/* Specific Agent Comparison Chips */}
              {availableAgentsList.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200/70">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                      2. Filter Per Agen Rekanan (Klik untuk tambah ke grafik):
                    </span>
                    {selectedAgentsForChart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedAgentsForChart([])}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                      >
                        Reset Agen ({selectedAgentsForChart.length})
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {availableAgentsList.map((ag) => {
                      const isSelected = selectedAgentsForChart.includes(ag.name);
                      const index = selectedAgentsForChart.indexOf(ag.name);
                      const color = isSelected ? AGENT_COLORS[index % AGENT_COLORS.length] : undefined;

                      return (
                        <button
                          key={ag.name}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAgentsForChart(selectedAgentsForChart.filter(n => n !== ag.name));
                            } else {
                              setSelectedAgentsForChart([...selectedAgentsForChart, ag.name]);
                            }
                          }}
                          style={isSelected ? { backgroundColor: color, borderColor: color } : undefined}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isSelected
                              ? 'text-white shadow-2xs font-black'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <UserCheck className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                          <span>{ag.name}</span>
                          {ag.total > 0 && (
                            <span className={`text-[10px] font-mono ${isSelected ? 'text-white/90' : 'text-slate-400'}`}>
                              ({formatRupiah(ag.total)})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Metrics Bar for Active Parameters */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
              {showSalesLine && (
                <div className="flex flex-col min-w-[110px]">
                  <span className="text-[10px] text-blue-700 font-bold uppercase flex items-center gap-1">
                    <Receipt className="w-3 h-3 text-blue-600" /> Penjualan POS
                  </span>
                  <strong className="font-mono text-slate-900 text-xs sm:text-sm font-black">{formatRupiah(salesMetrics.totalOmset)}</strong>
                </div>
              )}

              {showAllAgentsLine && (
                <div className="flex flex-col min-w-[110px] sm:border-l sm:border-slate-200 sm:pl-3">
                  <span className="text-[10px] text-rose-700 font-bold uppercase flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-rose-600" /> Total Agen
                  </span>
                  <strong className="font-mono text-slate-900 text-xs sm:text-sm font-black">{formatRupiah(agentTakeMetrics.totalRevenue)}</strong>
                </div>
              )}

              {showPurchaseLine && (
                <div className="flex flex-col min-w-[110px] sm:border-l sm:border-slate-200 sm:pl-3">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase flex items-center gap-1">
                    <Truck className="w-3 h-3 text-emerald-600" /> Belanja Supplier
                  </span>
                  <strong className="font-mono text-slate-900 text-xs sm:text-sm font-black">{formatRupiah(purchaseMetrics.totalSpend)}</strong>
                </div>
              )}

              {selectedAgentsForChart.map((aName, idx) => {
                const agData = agentTakeMetrics.topAgents.find((a) => a.name === aName);
                const color = AGENT_COLORS[idx % AGENT_COLORS.length];
                return (
                  <div key={`metric-${aName}`} className="flex flex-col min-w-[110px] sm:border-l sm:border-slate-200 sm:pl-3">
                    <span className="text-[10px] font-bold uppercase flex items-center gap-1" style={{ color }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      Agen: {aName}
                    </span>
                    <strong className="font-mono text-slate-900 text-xs sm:text-sm font-black">
                      {formatRupiah(agData?.revenue || 0)}
                    </strong>
                  </div>
                );
              })}
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={timelineChartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `Rp ${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800 font-sans">
                            <p className="font-bold text-slate-300 pb-1 border-b border-slate-800">
                              {periodType === 'HARIAN'
                                ? `Jam ${label} WIB (Harian Realtime Kasir)`
                                : periodType === 'MINGGUAN'
                                ? `Hari ${label}`
                                : periodType === 'BULANAN'
                                ? `Tanggal ${label}`
                                : `Periode: ${label}`}
                            </p>
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex justify-between gap-4 items-center">
                                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  {entry.name}:
                                </span>
                                <strong className="font-mono text-white">
                                  {formatRupiah(Number(entry.value) || 0)}
                                </strong>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                  />
                  {showSalesLine && (
                    <Line
                      type="linear"
                      dataKey="sales"
                      name="Penjualan POS"
                      stroke={CHART_COLORS.sales}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 8 }}
                    />
                  )}
                  {showAllAgentsLine && (
                    <Line
                      type="linear"
                      dataKey="agent"
                      name="Total Semua Agen"
                      stroke={CHART_COLORS.agent}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 8 }}
                    />
                  )}
                  {showPurchaseLine && (
                    <Line
                      type="linear"
                      dataKey="purchase"
                      name="Belanja Supplier"
                      stroke={CHART_COLORS.purchase}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 8 }}
                    />
                  )}
                  {selectedAgentsForChart.map((agentName, idx) => {
                    const color = AGENT_COLORS[idx % AGENT_COLORS.length];
                    return (
                      <Line
                        key={`agent-line-${agentName}`}
                        type="linear"
                        dataKey={`agent_${agentName}`}
                        name={`Agen: ${agentName}`}
                        stroke={color}
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                        activeDot={{ r: 8 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Timeframe Selector Options: Hari, Minggu, Bulan */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Rentang Waktu Grafik:
              </span>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
                <button
                  type="button"
                  onClick={() => onPeriodTypeChange?.('HARIAN')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    periodType === 'HARIAN'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Hari</span>
                </button>

                <button
                  type="button"
                  onClick={() => onPeriodTypeChange?.('MINGGUAN')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    periodType === 'MINGGUAN'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Minggu</span>
                </button>

                <button
                  type="button"
                  onClick={() => onPeriodTypeChange?.('BULANAN')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    periodType === 'BULANAN'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Bulan</span>
                </button>
              </div>
            </div>
          </div>

          {/* Donut Chart: Komposisi Saluran Pendapatan */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-rose-600" />
                Komposisi Pendapatan
              </h3>
              <p className="text-xs text-slate-500">
                Porsi kontribusi Penjualan Kasir vs Pengambilan Agen
              </p>
            </div>

            <div className="h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={revenueBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {revenueBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatRupiah(Number(value))}
                    contentStyle={{ borderRadius: '10px', backgroundColor: '#0f172a', color: '#fff', fontSize: '11px' }}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs font-medium">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  Penjualan Kasir:
                </span>
                <strong className="font-mono text-slate-900">{formatRupiah(salesMetrics.totalOmset)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  Pengambilan Agen:
                </span>
                <strong className="font-mono text-slate-900">{formatRupiah(agentTakeMetrics.totalRevenue)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: SIMPLIFIED SUMMARY TABLES (KPI & RANGKUMAN TAB) */}
      {activeTabSub === 'ringkasan' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Table 1: Rekap Saluran Bisnis Terpadu */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Tabel Rekapitulasi Saluran Bisnis Toko
                </h3>
                <span className="text-[11px] text-slate-400">Ringkas & Jelas</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Saluran Transaksi</th>
                      <th className="py-2.5 px-3 text-center">Jml Trx</th>
                      <th className="py-2.5 px-3 text-center">Volume</th>
                      <th className="py-2.5 px-3 text-right">Total Nilai</th>
                      <th className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-900">Laba Bersih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Row 1: Penjualan POS */}
                    <tr className="hover:bg-slate-50/80">
                      <td className="py-3 px-3">
                        <div className="font-bold text-blue-900 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-blue-600" />
                          Penjualan Retail Kasir POS
                        </div>
                        <div className="text-[10px] text-slate-500">Walk-in & Retail Customer</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                        {salesMetrics.trxCount} Trx
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-slate-600">
                        {salesMetrics.totalItemsSold} Item
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                        {formatRupiah(salesMetrics.totalOmset)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                        {formatRupiah(salesMetrics.totalEstimatedProfit)}
                      </td>
                    </tr>

                    {/* Row 2: Pengambilan Bahan Agen */}
                    <tr className="hover:bg-slate-50/80">
                      <td className="py-3 px-3">
                        <div className="font-bold text-rose-900 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-rose-600" />
                          Pengambilan Bahan (Agen Rekanan)
                        </div>
                        <div className="text-[10px] text-slate-500">Harga Agen & Meter Grosir</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                        {agentTakeMetrics.trxCount} Trx
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-slate-600">
                        {agentTakeMetrics.totalVolume} Unit
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                        {formatRupiah(agentTakeMetrics.totalRevenue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                        {formatRupiah(agentTakeMetrics.totalAgentProfit)}
                      </td>
                    </tr>

                    {/* Row 3: Belanja Supplier */}
                    <tr className="hover:bg-slate-50/80">
                      <td className="py-3 px-3">
                        <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-emerald-600" />
                          Kulakan / Belanja Supplier
                        </div>
                        <div className="text-[10px] text-slate-500">Restock Bahan Baku & Stiker</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                        {purchaseMetrics.trxCount} Trx
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-slate-600">
                        {purchaseMetrics.totalVolume} Unit
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">
                        ({formatRupiah(purchaseMetrics.totalSpend)})
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        -
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                    <tr>
                      <td className="py-2.5 px-3 text-slate-800 font-black">TOTAL FINANSIAL BERSIH</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-900">
                        {grandFinancial.totalAllTransactions} Trx
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-900">
                        {salesMetrics.totalItemsSold + agentTakeMetrics.totalVolume + purchaseMetrics.totalVolume} Unit
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                        {formatRupiah(grandFinancial.totalGrossInflow)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-900 bg-emerald-100">
                        {formatRupiah(grandFinancial.totalCombinedProfit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Table 2: Top Agen Rekanan Teraktif */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-600" />
                  Peringkat Agen Rekanan Teraktif
                </h3>
                <span className="text-[11px] text-slate-400">Berdasarkan Nilai Pengambilan</span>
              </div>

              {agentTakeMetrics.topAgents.length > 0 ? (
                <div className="space-y-2.5">
                  {agentTakeMetrics.topAgents.slice(0, 4).map((ag, idx) => (
                    <div
                      key={ag.name}
                      className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-rose-50/50 rounded-xl border border-slate-200/80 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-800 font-black flex items-center justify-center text-[11px]">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">{ag.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {ag.count}x Transaksi • {ag.volume} Unit Bahan
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-rose-700">
                          {formatRupiah(ag.revenue)}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-bold font-mono">
                          Laba: {formatRupiah(ag.profit)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs font-semibold">Belum ada transaksi pengambilan oleh Agen pada periode ini.</p>
                </div>
              )}

              {/* Metode Pembayaran Ringkas */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  Metode Pembayaran Kasir POS
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
                    <span className="text-[10px] text-emerald-800 font-bold block">Tunai / Cash</span>
                    <strong className="font-mono text-emerald-900">{formatRupiah(salesMetrics.totalCash)}</strong>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 p-2 rounded-xl">
                    <span className="text-[10px] text-purple-800 font-bold block">QRIS</span>
                    <strong className="font-mono text-purple-900">{formatRupiah(salesMetrics.totalQris)}</strong>
                  </div>
                  <div className="bg-sky-50 border border-sky-200 p-2 rounded-xl">
                    <span className="text-[10px] text-sky-800 font-bold block">Transfer</span>
                    <strong className="font-mono text-sky-900">{formatRupiah(salesMetrics.totalTransfer)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Rekap Bahan Fast Moving (Simpel & Mudah Dipahami) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-r from-amber-500 to-rose-600 text-white rounded-xl shadow-xs">
                  <Flame className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                    REKAP BAHAN FAST MOVING (PALING LARIS & TERPAKAI)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Analisis bahan/produk terpopuler berdasarkan volume transaksi tercatat.
                  </p>
                </div>
              </div>
              <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                ⚡ Fast Moving Analytics
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Card 1: Top Bahan POS Penjualan Toko */}
              <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    Top 5 Bahan / Produk Penjualan Kasir POS
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                    POS Retail & Cetak
                  </span>
                </div>

                {rekapBahanFastMovingSales.length > 0 ? (
                  <div className="space-y-2">
                    {rekapBahanFastMovingSales.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-lg font-black flex items-center justify-center text-[11px] ${
                            idx === 0 ? 'bg-amber-500 text-white shadow-xs' : idx === 1 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                          }`}>
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">{item.name}</div>
                            <div className="text-[10px] text-slate-500">{item.category}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-black text-slate-900 text-xs">
                            {formatVolume(item.qty)} <span className="text-[10px] text-slate-500 uppercase">{item.unit}</span>
                          </div>
                          <div className="text-[10px] text-emerald-700 font-bold font-mono">
                            Laba: {formatRupiah(item.totalProfit)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                    Belum ada data penjualan bahan pada periode ini.
                  </div>
                )}
              </div>

              {/* Card 2: Top Bahan Pengambilan Agen */}
              <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-rose-600" />
                    Top 5 Bahan Pengambilan Agen Rekanan
                  </span>
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                    Pengambilan Agen
                  </span>
                </div>

                {rekapBahanFastMovingAgent.length > 0 ? (
                  <div className="space-y-2">
                    {rekapBahanFastMovingAgent.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-lg font-black flex items-center justify-center text-[11px] ${
                            idx === 0 ? 'bg-rose-600 text-white shadow-xs' : idx === 1 ? 'bg-rose-100 text-rose-900' : 'bg-slate-100 text-slate-700'
                          }`}>
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">{item.name}</div>
                            <div className="text-[10px] text-slate-500">{item.category === 'custom_sticker' || item.category === 'custom sticker' ? 'vinyl_sticker' : item.category}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-black text-rose-900 text-xs">
                            {formatVolume(item.qty)} <span className="text-[10px] text-rose-600 uppercase">{item.unit}</span>
                          </div>
                          <div className="text-[10px] text-emerald-700 font-bold font-mono">
                            Laba: {formatRupiah(item.totalProfit)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                    Belum ada data pengambilan bahan oleh Agen pada periode ini.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
