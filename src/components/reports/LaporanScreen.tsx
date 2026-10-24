/**
 * Tab "Laporan" — wadah untuk dua jenis laporan:
 *   1. Laporan Penjualan (seluruh fitur riwayat & analisis transaksi lama)
 *   2. Laporan Keuangan (Laba Rugi, Perubahan Modal, Neraca, Arus Kas — PSAK 1/2015)
 *
 * Tab "Laporan Penjualan" lama dipindahkan ke dalam tab ini sebagai sub-tab,
 * sehingga navigasi navbar lebih ringkas (satu tab "Laporan" untuk semua laporan).
 */
import React, { useState } from 'react';
import { Receipt, Landmark, BookOpen } from 'lucide-react';
import { TransactionHistoryScreen } from '../TransactionHistoryScreen';
import { LaporanKeuanganScreen } from './LaporanKeuanganScreen';
import {
  Transaction,
  StockTransaction,
  Product,
  Supplier,
  Agent,
  CustomerCategory,
  ProductCategoryItem,
  UserRole,
  Shift,
  Invoice,
} from '../../types';
import { FinancialSettings } from '../../utils/financialStorage';

const JurnalScreen = React.lazy(() =>
  import('../journal/JurnalScreen').then((module) => ({ default: module.JurnalScreen }))
);

interface LaporanScreenProps {
  transactions: Transaction[];
  stockTransactions: StockTransaction[];
  invoices: Invoice[];
  isStoreOnline?: boolean;
  storeName?: string;
  onPrintReceipt: (transaction: Transaction) => void;
  products: Product[];
  suppliers: Supplier[];
  agents: Agent[];
  categories: CustomerCategory[];
  customers: any[];
  productCategories: ProductCategoryItem[];
  userRole?: UserRole;
  currentUsername?: string;
  shifts: Shift[];
  onUpdateStockTransaction?: (updatedTx: StockTransaction) => Promise<void> | void;
  onDeleteStockTransaction?: (transactionId: string) => Promise<void> | void;
  onUpdateTransaction?: (updatedTx: Transaction) => Promise<void> | void;
  onDeleteTransaction?: (transactionId: string) => Promise<void> | void;
  financialSettings: FinancialSettings;
  onSaveFinancialSettings: (s: FinancialSettings) => void;
}

type LaporanSubTab = 'penjualan' | 'keuangan' | 'jurnal';

export const LaporanScreen: React.FC<LaporanScreenProps> = (props) => {
  const [activeSubTab, setActiveSubTab] = useState<LaporanSubTab>('penjualan');
  const isDeveloper = props.userRole === 'DEVELOPER';

  const subTabs: { key: LaporanSubTab; label: string; icon: React.ElementType; desc: string }[] = [
    { key: 'penjualan', label: 'Laporan Penjualan', icon: Receipt, desc: 'Riwayat & analisis transaksi penjualan' },
    { key: 'keuangan', label: 'Laporan Keuangan', icon: Landmark, desc: 'Laba Rugi, Modal, Neraca & Arus Kas' },
    ...(isDeveloper
      ? [{ key: 'jurnal' as const, label: 'Jurnal', icon: BookOpen, desc: 'Spreadsheet Kas Utama, Debit & Kredit (khusus DEVELOPER)' }]
      : []),
  ];

  return (
    <div className="w-full">
      {/* Header Tab Laporan + pemilih jenis laporan */}
      <div className="no-print bg-white border-b border-slate-200">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 pb-0">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight mb-1">
            Pusat Laporan
          </h1>
          <p className="text-xs text-slate-500 mb-3">
            Semua laporan toko dalam satu tempat — pilih jenis laporan di bawah ini.
          </p>
          <div className="flex flex-wrap gap-2">
            {subTabs.map((st) => {
              const Icon = st.icon;
              const active = activeSubTab === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setActiveSubTab(st.key)}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
                    active
                      ? 'bg-slate-900 text-white border-emerald-500 shadow-xs'
                      : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70'
                  }`}
                  title={st.desc}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-emerald-300' : 'text-slate-500'}`} />
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Konten sub-tab aktif */}
      {activeSubTab === 'jurnal' ? (
        isDeveloper ? (
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center py-24 text-sm text-slate-500">
                Memuat spreadsheet Jurnal...
              </div>
            }
          >
            <JurnalScreen currentUsername={props.currentUsername} />
          </React.Suspense>
        ) : (
          <div className="flex items-center justify-center py-24 text-sm text-slate-500">
            Modul Jurnal hanya dapat diakses oleh DEVELOPER.
          </div>
        )
      ) : activeSubTab === 'penjualan' ? (
        <TransactionHistoryScreen
          transactions={props.transactions}
          stockTransactions={props.stockTransactions}
          invoices={props.invoices}
          isStoreOnline={props.isStoreOnline}
          storeName={props.storeName}
          onPrintReceipt={props.onPrintReceipt}
          products={props.products}
          suppliers={props.suppliers}
          agents={props.agents}
          categories={props.categories}
          customers={props.customers}
          productCategories={props.productCategories}
          userRole={props.userRole}
          onUpdateStockTransaction={props.onUpdateStockTransaction}
          onDeleteStockTransaction={props.onDeleteStockTransaction}
          onUpdateTransaction={props.onUpdateTransaction}
          onDeleteTransaction={props.onDeleteTransaction}
        />
      ) : (
        <LaporanKeuanganScreen
          transactions={props.transactions}
          stockTransactions={props.stockTransactions}
          shifts={props.shifts}
          storeName={props.storeName}
          settings={props.financialSettings}
          onSaveSettings={props.onSaveFinancialSettings}
        />
      )}
    </div>
  );
};