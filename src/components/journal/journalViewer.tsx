import React from 'react';
import { Copy, ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { ToolButton } from './journalDialog';
import { JournalEmptyState } from './journalEmptyState';

interface JournalViewerProps {
  shellRef: React.RefObject<HTMLDivElement | null>;
  year: number | null;
  modeLabel: string;
  embedUrl: string;
  iframeKey: number;
  refreshing: boolean;
  isFullscreen: boolean;
  canEdit: boolean;
  onRefresh: () => void;
  onCopy: () => void;
  onOpen: () => void;
  onFullscreen: () => void;
}

export const JournalViewer: React.FC<JournalViewerProps> = ({
  shellRef,
  year,
  modeLabel,
  embedUrl,
  iframeKey,
  refreshing,
  isFullscreen,
  canEdit,
  onRefresh,
  onCopy,
  onOpen,
  onFullscreen,
}) => (
  <div
    ref={shellRef}
    className={
      isFullscreen
        ? 'fixed inset-0 z-[120] bg-slate-950 flex flex-col'
        : 'bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden'
    }
  >
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-[11px] sm:text-xs font-bold text-slate-700 truncate">
          Jurnal {year ?? ''} · {modeLabel}
        </span>
        {embedUrl && (
          <span className="hidden xl:inline text-[10px] text-slate-400 truncate max-w-[280px]">
            {embedUrl}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <ToolButton
          label="Segarkan"
          icon={RefreshCw}
          onClick={onRefresh}
          disabled={!embedUrl}
        />
        <ToolButton label="Salin Link" icon={Copy} onClick={onCopy} />
        <ToolButton label="Buka di Tab Baru" icon={ExternalLink} onClick={onOpen} />
        <ToolButton
          label={isFullscreen ? 'Keluar' : 'Layar Penuh'}
          icon={isFullscreen ? Minimize2 : Maximize2}
          onClick={onFullscreen}
          active={isFullscreen}
        />
      </div>
    </div>
    <div
      className={
        isFullscreen
          ? 'relative flex-1 min-h-0 bg-slate-900'
          : 'relative h-[68vh] min-h-[460px] max-h-[820px] bg-slate-50'
      }
    >
      {embedUrl ? (
        <>
          <iframe
            key={`${embedUrl}-${iframeKey}`}
            src={embedUrl}
            title={`Google Sheet Jurnal ${year ?? ''}`}
            className="absolute inset-0 w-full h-full bg-white"
            allow="clipboard-read; clipboard-write; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          {refreshing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Menyegarkan iframe…
              </span>
            </div>
          )}
        </>
      ) : (
        <JournalEmptyState year={year} canEdit={canEdit} />
      )}
    </div>
  </div>
);
