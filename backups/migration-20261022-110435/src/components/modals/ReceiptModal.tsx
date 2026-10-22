/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React, { useState, useEffect } from 'react';
import { X, Printer, Share2, CheckCircle, Download, FileText, QrCode, Sliders } from 'lucide-react';
import { Transaction, PrintSettings } from '../../types';
import { formatRupiah, formatItemTransactionSpec } from '../../utils/formatters';
import { getStoredStoreInfo, getStoredPrintSettings, saveStoredPrintSettings } from '../../utils/storage';
import { exportReceiptToPDF, generateReceiptQRDataUrl } from '../../utils/receiptPdf';
import { StoreLogo } from '../StoreLogo';
import { PrintSettingsModal } from './PrintSettingsModal';
import { printThermalElement } from '../../utils/thermalPrinter';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  printSettings?: PrintSettings;
  onUpdatePrintSettings?: (settings: PrintSettings) => void;
  isAutoPrintTriggered?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  printSettings: initialPrintSettings,
  onUpdatePrintSettings,
  isAutoPrintTriggered = false
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [currentPrintSettings, setCurrentPrintSettings] = useState<PrintSettings>(() => {
    return initialPrintSettings || getStoredPrintSettings();
  });

  const storeInfo = getStoredStoreInfo();

  useEffect(() => {
    if (initialPrintSettings) {
      setCurrentPrintSettings(initialPrintSettings);
    }
  }, [initialPrintSettings]);

  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      if (e.detail) {
        setCurrentPrintSettings(e.detail);
      } else {
        setCurrentPrintSettings(getStoredPrintSettings());
      }
    };
    window.addEventListener('bejo_print_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('bejo_print_settings_updated', handleSettingsUpdated);
  }, []);

  useEffect(() => {
    if (isOpen && storeInfo.phone) {
      generateReceiptQRDataUrl(storeInfo.phone).then((dataUrl) => {
        setQrCodeDataUrl(dataUrl);
      });
    }
  }, [isOpen, storeInfo.phone]);

  // Auto print trigger if enabled in printSettings and invoked after checkout
  useEffect(() => {
    if (isOpen && transaction && currentPrintSettings.autoPrintOnCheckout) {
      const timer = setTimeout(() => {
        printThermalElement('thermal-receipt', {
          paperSize: currentPrintSettings.paperSize,
          printMarginMm: currentPrintSettings.printMarginMm
        });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, transaction?.id, currentPrintSettings.autoPrintOnCheckout, currentPrintSettings.paperSize, currentPrintSettings.printMarginMm]);

  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    printThermalElement('thermal-receipt', {
      paperSize: currentPrintSettings.paperSize,
      printMarginMm: currentPrintSettings.printMarginMm
    });
  };

  const handleSavePrintSettings = (newSettings: PrintSettings) => {
    setCurrentPrintSettings(newSettings);
    saveStoredPrintSettings(newSettings);
    if (onUpdatePrintSettings) {
      onUpdatePrintSettings(newSettings);
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      await exportReceiptToPDF(transaction, true);
    } catch (err) {
      console.error('Download PDF error:', err);
      alert('Gagal mendownload struk PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!transaction.customer?.phone) {
      alert('Nomor WhatsApp pelanggan belum terdaftar pada transaksi ini.');
      return;
    }

    // Generate & download matching PDF receipt
    try {
      await exportReceiptToPDF(transaction, true);
    } catch (err) {
      console.warn('Auto download PDF notice:', err);
    }

    let phone = transaction.customer.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }

    const itemsSummary = transaction.items
      .map((it, idx) => {
        const cleanName = it.name.replace(/^\[SPK\]\s*/i, '');
        return `${idx + 1}. *${cleanName}*%0A   Spesifikasi: ${formatItemTransactionSpec(it)}%0A   Subtotal: ${formatRupiah(it.totalPrice)}`;
      })
      .join('%0A');

    const cleanCashierNotes = transaction.cashierNotes
      ? transaction.cashierNotes.replace(/SPK\s*#?[\w-]+/gi, '').replace(/\s{2,}/g, ' ').trim()
      : '';

    const message = `*STRUK PENJUALAN ${storeInfo.storeName.toUpperCase()}*%0A` +
      `No. Invoice: ${transaction.id}%0A` +
      `Tanggal: ${transaction.date} ${transaction.time}%0A` +
      `Kasir: ${transaction.cashierName}%0A` +
      `Pelanggan: ${transaction.customer.name}%0A` +
      `--------------------------------%0A` +
      `${itemsSummary}%0A` +
      `--------------------------------%0A` +
      `Subtotal: ${formatRupiah(transaction.subtotal)}%0A` +
      (transaction.discount > 0
        ? `Diskon: -${formatRupiah(transaction.discount)}%0A`
        : transaction.discount < 0
        ? `Diskon: +${formatRupiah(Math.abs(transaction.discount))} (Pembulatan)%0A`
        : '') +
      `*Total: ${formatRupiah(transaction.total)}*%0A` +
      `Metode Bayar: ${transaction.paymentMethods.cash > 0 ? `Tunai ${formatRupiah(transaction.paymentMethods.cash)} ` : ''}${transaction.paymentMethods.transfer > 0 ? `Transfer ${formatRupiah(transaction.paymentMethods.transfer)} ` : ''}${transaction.paymentMethods.qris > 0 ? `QRIS ${formatRupiah(transaction.paymentMethods.qris)}` : ''}%0A` +
      (cleanCashierNotes ? `Catatan: ${cleanCashierNotes}%0A` : '') +
      `--------------------------------%0A` +
      `📄 *Struk resmi format PDF (Struk_${transaction.id.replace(/[/\\?%*:|"<>]/g, '_')}.pdf) telah di-generate otomatis.*%0A` +
      `%0ATerima kasih atas kepercayaan Anda di ${storeInfo.storeName}!`;

    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${message}`, '_blank');
  };

  const is58mm = currentPrintSettings.paperSize === '58mm';
  const densityClass =
    currentPrintSettings.density === 'compact'
      ? 'leading-tight text-[10px]'
      : currentPrintSettings.density === 'large'
      ? 'leading-loose text-[13px]'
      : 'leading-relaxed text-xs';

  const contrastClass =
    currentPrintSettings.contrast === 'ultra-black'
      ? 'font-black'
      : currentPrintSettings.contrast === 'bold'
      ? 'font-bold'
      : 'font-semibold';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div 
          id="modal-cetak-struk"
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <StoreLogo size="sm" rounded="rounded-lg" storeName={storeInfo.storeName} />
              <div>
                <h2 className="text-sm font-bold tracking-tight">STRUK PENJUALAN TRANSAKSI</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-slate-300">Invoice: {transaction.id}</p>
                  <span className="bg-slate-800 text-slate-300 text-[9px] font-mono px-1.5 py-0.2 rounded border border-slate-700">
                    {currentPrintSettings.paperSize === '80mm' ? '80mm x roll' : currentPrintSettings.paperSize === '58mm' ? '58mm x roll' : currentPrintSettings.paperSize}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="text-slate-300 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                title="Setting Ukuran Kertas & Format Struk Printer"
              >
                <Sliders className="w-4 h-4 text-emerald-400" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Receipt Preview */}
          <div className="p-4 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
            <div 
              id="thermal-receipt"
              className={`thermal-receipt-container ${is58mm ? 'paper-58mm max-w-[240px]' : 'paper-80mm max-w-xs'} w-full bg-white p-4 shadow-sm border border-dashed border-slate-300 text-slate-900 font-mono ${densityClass} ${contrastClass}`}
            >
              {/* Receipt Header */}
              {(currentPrintSettings.showLogo || currentPrintSettings.showStoreHeader) && (
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  {currentPrintSettings.showLogo && (
                    <div className="flex justify-center mb-1.5">
                      <StoreLogo size="sm" rounded="rounded-md" storeName={storeInfo.storeName} />
                    </div>
                  )}

                  {currentPrintSettings.showStoreHeader && (
                    <div>
                      <div className="font-extrabold text-sm tracking-widest uppercase text-black">
                        {storeInfo.storeName}
                      </div>
                      <div className="text-[10px] text-slate-600 uppercase font-sans">
                        {storeInfo.branch ? `Cabang ${storeInfo.branch}` : 'Pusat Stiker & Digital Printing'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                        {storeInfo.address}
                      </div>
                      <div className="text-[10px] text-slate-600 font-sans">
                        WA: {storeInfo.phone}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata Info */}
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>No. Invoice</span>
                  <span className="font-bold">{transaction.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tgl / Jam</span>
                  <span>{transaction.date} {transaction.time}</span>
                </div>
                {currentPrintSettings.showCashierName && (
                  <div className="flex justify-between">
                    <span>Kasir</span>
                    <span className="uppercase">{transaction.cashierName}</span>
                  </div>
                )}
                {currentPrintSettings.showCustomerInfo && transaction.customer && (
                  <div>
                    <div className="flex justify-between pt-1 border-t border-slate-100">
                      <span>Pelanggan</span>
                      <span className="font-semibold">{transaction.customer.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>No. WA</span>
                      <span>{transaction.customer.phone}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-2">
                {transaction.items.map((item, idx) => {
                  const cleanName = item.name.replace(/^\[SPK\]\s*/i, '');
                  const isSpkCode = item.code?.startsWith('SPK-') || item.code?.startsWith('#SPK') || item.code === 'CETAK';
                  const displayCode = isSpkCode ? '' : item.code;
                  const cleanNotes = item.notes ? item.notes.replace(/SPK\s*#?[\w-]+(\s*•\s*)?/gi, '').trim() : '';

                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="font-semibold flex justify-between">
                        <span className="text-slate-900 font-bold">{cleanName}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span className="font-mono">
                          {displayCode ? `${displayCode} | ` : ''}{formatItemTransactionSpec(item)}
                        </span>
                        <span className="text-slate-900 font-bold">
                          {formatRupiah(item.totalPrice)}
                        </span>
                      </div>
                      {cleanNotes && (
                        <div className="text-[9px] text-slate-400 italic">
                          * {cleanNotes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Calculations & Totals */}
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>Total QTY</span>
                  <span>{transaction.totalQty}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sub Total</span>
                  <span>{formatRupiah(transaction.subtotal)}</span>
                </div>
                {transaction.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Pajak (Tax)</span>
                    <span>{formatRupiah(transaction.tax)}</span>
                  </div>
                )}
                {transaction.discount !== 0 && (
                  <div className="flex justify-between font-semibold">
                    <span>Diskon</span>
                    <span>
                      {transaction.discount > 0 ? (
                        `-${formatRupiah(transaction.discount)}`
                      ) : (
                        `+${formatRupiah(Math.abs(transaction.discount))} (Pembulatan)`
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-black pt-1 border-t border-slate-200">
                  <span>TOTAL</span>
                  <span>{formatRupiah(transaction.total)}</span>
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-0.5">
                {transaction.paymentMethods.cash > 0 && (
                  <div className="flex justify-between">
                    <span>Tunai (Cash)</span>
                    <span>{formatRupiah(transaction.paymentMethods.cash)}</span>
                  </div>
                )}
                {transaction.paymentMethods.transfer > 0 && (
                  <div className="flex justify-between">
                    <span>Transfer Bank</span>
                    <span>{formatRupiah(transaction.paymentMethods.transfer)}</span>
                  </div>
                )}
                {transaction.paymentMethods.qris > 0 && (
                  <div className="flex justify-between">
                    <span>QRIS</span>
                    <span>{formatRupiah(transaction.paymentMethods.qris)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-0.5">
                  <span>Kembalian</span>
                  <span>{formatRupiah(transaction.change)}</span>
                </div>
              </div>

              {/* Cashier Notes */}
              {transaction.cashierNotes && (
                <div className="py-2 border-b border-dashed border-slate-300 text-[10px]">
                  <span className="font-bold block text-slate-700">Catatan Kasir:</span>
                  <p className="text-slate-600 italic mt-0.5">{transaction.cashierNotes}</p>
                </div>
              )}

              {/* Footer Notice */}
              {currentPrintSettings.showFooterNotes && (
                <div className="pt-2 text-center text-[9px] text-slate-500 font-sans space-y-1">
                  <p className="whitespace-pre-line">{storeInfo.receiptFooter || currentPrintSettings.customFooterNote}</p>
                </div>
              )}

              {/* QR Code Section at Bottom of Receipt */}
              {currentPrintSettings.showQrCode && (
                <div className="pt-3 pb-1 flex flex-col items-center justify-center text-center">
                  {qrCodeDataUrl ? (
                    <div className="bg-white p-1 rounded-lg border border-slate-300 shadow-2xs inline-block">
                      <img
                        src={qrCodeDataUrl}
                        alt="QR Code WhatsApp Toko"
                        className="w-20 h-20 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                      <QrCode className="w-8 h-8" />
                    </div>
                  )}
                  <span className="text-[8px] font-sans font-bold text-slate-600 uppercase tracking-tight mt-1">
                    SCAN QR UNTUK CHAT / ORDER WA TOKO
                  </span>
                </div>
              )}

              <div className="font-mono text-[8px] text-slate-400 mt-2 text-center">
                -- TERIMA KASIH --
              </div>

              {/* Feed lines for auto-cutter padding */}
              {Array.from({ length: Math.max(1, currentPrintSettings.feedLines || 2) }).map((_, i) => (
                <div key={i} className="h-3 border-b border-transparent"></div>
              ))}
              {currentPrintSettings.showCutLine && (
                <div className="text-center text-[7.5px] text-slate-400 border-t border-dotted border-slate-400 pt-0.5 mt-1">
                  - - - - - - - - - - [ Gunting di Sini ] - - - - - - - - - -
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="p-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Selesai
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-download-pdf-struk"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Download Struk PDF format cetak"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>

              <button
                type="button"
                id="btn-kirim-wa-struk"
                onClick={handleShareWhatsApp}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Kirim Struk ke WhatsApp Pelanggan + Generate PDF"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Kirim WA</span>
              </button>

              <button
                type="button"
                id="btn-cetak-struk-print"
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Cetak Struk ({currentPrintSettings.paperSize})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Print Settings Modal */}
      {isSettingsModalOpen && (
        <PrintSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={currentPrintSettings}
          onSaveSettings={handleSavePrintSettings}
          storeName={storeInfo.storeName}
          storePhone={storeInfo.phone}
          storeAddress={storeInfo.address}
          storeBranch={storeInfo.branch}
        />
      )}
    </>
  );
};
