import type { JournalEmbedMode } from '../../utils/journalStorage';

export interface JournalModeOption {
  key: JournalEmbedMode;
  label: string;
  description: string;
}

export const JOURNAL_MODE_OPTIONS: JournalModeOption[] = [
  {
    key: 'preview',
    label: 'Tinjau Bersih (Preview)',
    description: 'Tampilan bersih tanpa menu edit Google. Rekomendasi untuk pembacaan harian.',
  },
  {
    key: 'edit',
    label: 'Interaktif (Embedded Edit)',
    description: 'Sheet tetap dapat diklik dan diedit langsung dari dalam aplikasi.',
  },
  {
    key: 'html',
    label: 'Web Ringan (HTML Embed)',
    description: 'Versi HTML ringan, paling cepat dimuat pada koneksi lambat.',
  },
];

export function journalModeLabel(mode: JournalEmbedMode): string {
  const found = JOURNAL_MODE_OPTIONS.find((option) => option.key === mode);
  return found ? found.label : JOURNAL_MODE_OPTIONS[0].label;
}
