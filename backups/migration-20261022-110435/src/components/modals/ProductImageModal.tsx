import React, { useEffect } from 'react';
import { X, ZoomIn, ExternalLink } from 'lucide-react';

export interface ProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  code?: string;
  category?: string;
  dimensions?: string;
}

export const ProductImageModal: React.FC<ProductImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  code,
  category,
  dimensions,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 transition-all duration-200 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-xl sm:max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-slate-900 border-b border-slate-800 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            {code && (
              <span className="text-[11px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded font-bold shrink-0">
                {code}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate" title={title}>
                {title}
              </h3>
              {(category || dimensions) && (
                <p className="text-[11px] text-slate-400 capitalize truncate mt-0.5 font-medium">
                  {category}
                  {dimensions ? ` • ${dimensions}` : ''}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Tutup (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Image Container */}
        <div className="p-4 sm:p-6 bg-slate-950 flex items-center justify-center min-h-[260px] sm:min-h-[340px] max-h-[72vh] overflow-hidden flex-1 relative select-none">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-2xl border border-slate-800/80 bg-slate-900/60 transition-transform duration-200 hover:scale-[1.01]"
            onError={(e) => {
              const target = e.target as HTMLElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const fallback = parent.querySelector('.err-state') as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }
            }}
          />
          <div className="err-state hidden flex-col items-center justify-center text-slate-400 py-12">
            <p className="text-sm font-semibold text-slate-300">Gambar tidak dapat dimuat</p>
            <p className="text-xs text-slate-500 mt-1">URL gambar mungkin rusak atau tidak dapat diakses.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <ZoomIn className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Pratinjau Foto Resolusi Penuh</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1"
              title="Buka gambar asli di tab baru"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Tab Baru</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
