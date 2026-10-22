/**
 * Thermal Printing Engine for Struk Penjualan & Surat Jalan
 * Ensures 1-page output with zero background layout pollution.
 */

export interface ThermalPrintOptions {
  paperSize?: '80mm' | '58mm';
  printMarginMm?: number;
  onComplete?: () => void;
}

export function printThermalElement(
  elementIdOrHtml: string | HTMLElement,
  options: ThermalPrintOptions = {}
): void {
  const paperSize = options.paperSize || '80mm';
  const paperWidth = paperSize === '58mm' ? '58mm' : '80mm';
  const contentWidth = paperSize === '58mm' ? '54mm' : '76mm';
  const marginMm = typeof options.printMarginMm === 'number' ? Math.max(0, Math.min(10, options.printMarginMm)) : 0;

  try {
    let contentHtml = '';
    if (typeof elementIdOrHtml === 'string') {
      const el = document.getElementById(elementIdOrHtml);
      if (el) {
        contentHtml = el.innerHTML;
      } else {
        contentHtml = elementIdOrHtml;
      }
    } else if (elementIdOrHtml && elementIdOrHtml.innerHTML) {
      contentHtml = elementIdOrHtml.innerHTML;
    }

    if (!contentHtml || contentHtml.trim().length === 0) {
      console.warn('printThermalElement: No content found, falling back to window.print()');
      window.print();
      return;
    }

    // Remove any previous print iframe to prevent memory leaks and DOM pollution
    const existingIframe = document.getElementById('bejo-isolated-thermal-printer');
    if (existingIframe) {
      existingIframe.remove();
    }

    // Create an invisible, isolated iframe directly attached to body
    const iframe = document.createElement('iframe');
    iframe.id = 'bejo-isolated-thermal-printer';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    // Write a standalone, self-contained HTML document containing ONLY the receipt/surat jalan
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Cetak POS</title>
          <style>
            @page {
              size: ${paperWidth} auto;
              margin: ${marginMm}mm;
            }
            *, *:before, *:after {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: ${paperWidth} !important;
              max-width: ${paperWidth} !important;
              height: auto !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: 'Courier New', Courier, Monaco, Consolas, monospace !important;
              font-weight: 900 !important;
              font-size: 11px !important;
              line-height: 1.28 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              overflow: visible !important;
            }
            body {
              margin: 0 auto !important;
              padding: 2mm 2.5mm !important;
              width: ${contentWidth} !important;
              max-width: ${contentWidth} !important;
            }
            .thermal-content-wrapper {
              width: 100% !important;
              max-width: 100% !important;
              color: #000000 !important;
              font-weight: 900 !important;
              border: none !important;
              box-shadow: none !important;
            }
            .thermal-content-wrapper * {
              font-family: 'Courier New', Courier, Monaco, Consolas, monospace !important;
              font-weight: 900 !important;
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
            }
            /* Flex & Layout utilities */
            .flex { display: flex !important; }
            .flex-col { flex-direction: column !important; }
            .justify-between { justify-content: space-between !important; }
            .justify-center { justify-content: center !important; }
            .items-center { align-items: center !important; }
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .text-left { text-align: left !important; }
            .font-bold, .font-extrabold, .font-black, .font-semibold { font-weight: 900 !important; }
            .uppercase { text-transform: uppercase !important; }
            .tracking-widest { letter-spacing: 0.1em !important; }
            .tracking-wider { letter-spacing: 0.05em !important; }
            .tracking-tight { letter-spacing: -0.025em !important; }
            .italic { font-style: italic !important; }
            
            /* Sembunyikan seluruh border garis putus-putus dan border di sekeliling isi transaksi pada mode cetak */
            *, *:before, *:after,
            .thermal-content-wrapper,
            .thermal-content-wrapper *,
            .thermal-receipt-container,
            #thermal-receipt,
            .border,
            .border-dashed,
            .border-dotted,
            .border-b,
            .border-t,
            .border-l,
            .border-r,
            [class*="border"],
            [class*="shadow"] {
              border: none !important;
              border-width: 0 !important;
              border-style: none !important;
              border-color: transparent !important;
              box-shadow: none !important;
              -webkit-box-shadow: none !important;
              outline: none !important;
            }
            /* Paddings and Margins */
            .p-4 { padding: 4px !important; }
            .py-1 { padding-top: 2px !important; padding-bottom: 2px !important; }
            .py-2 { padding-top: 4px !important; padding-bottom: 4px !important; }
            .py-2\\.5, .py-2\\.5 { padding-top: 5px !important; padding-bottom: 5px !important; }
            .pb-2 { padding-bottom: 4px !important; }
            .pb-3 { padding-bottom: 6px !important; }
            .pt-1 { padding-top: 2px !important; }
            .pt-2 { padding-top: 4px !important; }
            .pt-6 { padding-top: 12px !important; }
            .mb-1 { margin-bottom: 2px !important; }
            .mb-1\\.5 { margin-bottom: 4px !important; }
            .mt-0\\.5 { margin-top: 2px !important; }
            .mt-1 { margin-top: 3px !important; }
            .mt-1\\.5 { margin-top: 4px !important; }
            /* Spacers */
            .space-y-0\\.5 > * + * { margin-top: 2px !important; }
            .space-y-1 > * + * { margin-top: 3px !important; }
            .space-y-1\\.5 > * + * { margin-top: 4px !important; }
            .space-y-2 > * + * { margin-top: 5px !important; }
            /* Grid & Signatures */
            .grid { display: grid !important; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .gap-4 { gap: 12px !important; }
            .h-10 { height: 28px !important; }
            /* High Contrast Images & Logos */
            img, svg {
              filter: contrast(200%) grayscale(100%) !important;
              image-rendering: pixelated !important;
              max-width: 100% !important;
            }
          </style>
        </head>
        <body>
          <div class="thermal-content-wrapper">
            ${contentHtml}
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Give browser time to parse DOM, render QR/Images, and prepare print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        if (options.onComplete) {
          options.onComplete();
        }
      } catch (printErr) {
        console.error('Iframe print focus error, fallback to window.print():', printErr);
        window.print();
      }
    }, 200);
  } catch (err) {
    console.error('printThermalElement error, fallback to window.print():', err);
    window.print();
  }
}
