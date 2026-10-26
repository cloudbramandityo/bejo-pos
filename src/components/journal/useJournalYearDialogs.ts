import { useCallback, useEffect, useState } from 'react';
import {
  addJournalYear,
  convertGoogleSheetToEmbedUrl,
  removeJournalYear,
  type JournalSettings,
} from '../../utils/journalStorage';
import type { JournalCore } from './useJournalCore';

const YEAR_MIN = 2000;
const YEAR_MAX = 2100;

interface DialogInput {
  core: JournalCore;
  persist: (next: JournalSettings, immediate?: boolean) => void;
  showToast: (message: string, tone?: 'ok' | 'error') => void;
  canEdit: boolean;
}

export function useJournalYearDialogs({ core, persist, showToast, canEdit }: DialogInput) {
  const { settingsRef } = core;
  const [addOpen, setAddOpen] = useState(false);
  const [addYear, setAddYear] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!addOpen && !deleteOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (addOpen) setAddOpen(false);
      if (deleteOpen) setDeleteOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [addOpen, deleteOpen]);

  const openAddDialog = useCallback(() => {
    if (!canEdit) {
      showToast('Hanya akun DEVELOPER yang dapat menambah tahun Jurnal.', 'error');
      return;
    }
    const years = settingsRef.current.years.map((item) => item.year);
    const suggested = years.length
      ? Math.min(YEAR_MAX, Math.max(...years) + 1)
      : new Date().getFullYear();
    setAddYear(String(suggested));
    setAddUrl('');
    setAddOpen(true);
  }, [canEdit, settingsRef, showToast]);

  const confirmAddYear = useCallback(() => {
    if (!canEdit) {
      setAddOpen(false);
      showToast('Hanya akun DEVELOPER yang dapat menambah tahun Jurnal.', 'error');
      return;
    }
    const year = Number(addYear);
    if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) {
      showToast(`Tahun harus berupa angka antara ${YEAR_MIN} dan ${YEAR_MAX}.`, 'error');
      return;
    }
    if (settingsRef.current.years.some((item) => item.year === year)) {
      showToast(`Tahun ${year} sudah ada.`, 'error');
      return;
    }
    const trimmed = addUrl.trim();
    if (trimmed) {
      const parsed = convertGoogleSheetToEmbedUrl(trimmed, settingsRef.current.embedMode);
      if (!parsed.isValid) {
        showToast(parsed.error || 'Tautan Google Sheet tidak valid.', 'error');
        return;
      }
    }
    persist(addJournalYear(settingsRef.current, year, trimmed), true);
    setAddOpen(false);
    showToast(`Tahun ${year} ditambahkan.`);
  }, [addUrl, addYear, canEdit, persist, settingsRef, showToast]);

  const confirmDeleteYear = useCallback(() => {
    if (!canEdit) {
      setDeleteOpen(false);
      showToast('Hanya akun DEVELOPER yang dapat menghapus tahun Jurnal.', 'error');
      return;
    }
    const current = settingsRef.current;
    const year = current.selectedYear;
    if (current.years.length <= 1) {
      setDeleteOpen(false);
      showToast('Minimal satu tahun harus tetap ada.', 'error');
      return;
    }
    persist(removeJournalYear(current, year), true);
    setDeleteOpen(false);
    showToast(`Tahun ${year} dihapus dari daftar. Google Sheet aslinya tidak diubah.`);
  }, [canEdit, persist, settingsRef, showToast]);

  return {
    addOpen,
    addYear,
    addUrl,
    deleteOpen,
    setAddOpen,
    setAddYear,
    setAddUrl,
    setDeleteOpen,
    openAddDialog,
    confirmAddYear,
    confirmDeleteYear,
  };
}
