import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface JournalEmptyStateProps {
  year: number | null;
  canEdit: boolean;
}

export const JournalEmptyState: React.FC<JournalEmptyStateProps> = ({ year, canEdit }) => (
  <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 bg-slate-50 overflow-y-auto">
    <div className="max-w-md w-full text-center space-y-3">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 text-emerald-600 flex items-center justify-center shadow-sm">
        <FileSpreadsheet className="w-7 h-7" />
      </div>
      <div>
        <h3 className="text-sm font-extrabold text-slate-900">
          {canEdit
            ? `Belum ada Google Sheet untuk tahun ${year ?? ''}`
            : `Tautan Google Sheet tahun ${year ?? ''} belum diatur`}
        </h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {canEdit
            ? 'Tempel tautan di atas lalu tekan Simpan. Iframe akan menampilkan sheet secara real-time lengkap dengan tab sheet, formula, baris, dan kolom.'
            : 'Hanya akun DEVELOPER yang dapat mengisi tautan ini. Hubungi Developer untuk melengkapi konfigurasi Jurnal tahun tersebut.'}
        </p>
      </div>
      {canEdit ? (
        <>
          <ol className="text-left text-[11px] text-slate-600 space-y-1.5 bg-white border border-slate-200 rounded-xl p-3">
            <li>1. Buka Google Sheet → Bagikan → Siapa saja yang memiliki link → Pelihat/Editor.</li>
            <li>2. Salin tautan /edit, /pubhtml, atau tautan berbagi ke kolom di atas.</li>
            <li>3. Pilih mode tampilan; sistem otomatis mengubah tautan menjadi URL embed.</li>
          </ol>
          <p className="text-[10px] text-slate-400">
            Format didukung: docs.google.com/spreadsheets/d/…/edit, /pubhtml, atau tautan berbagi.
          </p>
        </>
      ) : (
        <p className="text-[10px] text-slate-400">
          Tahun lain yang sudah tertaut tetap dapat dilihat dengan berpindah tab tahun di atas.
        </p>
      )}
    </div>
  </div>
);
