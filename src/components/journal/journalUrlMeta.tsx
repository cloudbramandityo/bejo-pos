import React from 'react';
import { convertGoogleSheetToEmbedUrl } from '../../utils/journalStorage';

type ParsedLink = ReturnType<typeof convertGoogleSheetToEmbedUrl>;
type ChipTone = 'slate' | 'emerald' | 'amber' | 'rose' | 'blue';

const CHIP_TONE: Record<ChipTone, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  blue: 'border-sky-200 bg-sky-50 text-sky-700',
};

const Chip: React.FC<{ tone: ChipTone; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${CHIP_TONE[tone]}`}>
    {children}
  </span>
);

interface JournalUrlMetaProps {
  parsed: ParsedLink;
  draftUrl: string;
  savedUrl: string;
  draftDiffers: boolean;
}

export const JournalUrlMeta: React.FC<JournalUrlMetaProps> = ({
  parsed,
  draftUrl,
  savedUrl,
  draftDiffers,
}) => {
  const hasInput = Boolean(draftUrl.trim() || savedUrl);
  if (!hasInput) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {parsed.sheetId && <Chip tone="slate">Sheet ID: {parsed.sheetId.slice(0, 12)}…</Chip>}
      {parsed.gid ? <Chip tone="blue">GID: {parsed.gid}</Chip> : parsed.sheetId ? <Chip tone="slate">GID: default</Chip> : null}
      {parsed.isPublishedHtml && <Chip tone="amber">Link publik /pubhtml</Chip>}
      {draftUrl.trim() && !parsed.isValid && <Chip tone="rose">Format belum valid</Chip>}
      {draftUrl.trim() && parsed.isValid && !parsed.isPublishedHtml && !parsed.sheetId && (
        <Chip tone="amber">Tautan eksternal (bukan Google Sheets)</Chip>
      )}
      {draftDiffers ? (
        <Chip tone="blue">Belum disimpan</Chip>
      ) : savedUrl ? (
        <Chip tone="emerald">Tersimpan</Chip>
      ) : null}
    </div>
  );
};
