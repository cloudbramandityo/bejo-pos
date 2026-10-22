/**
 * Coded by Langgo Bramandityo.
 * SPK Archive Auto-Cleanup & Manual Developer Purge Utility.
 * SPK dengan status SELESAI_LUNAS (ARSIP) otomatis terhapus dari list jam 19.00 WIB setiap hari
 * atau dapat dibersihkan secara manual oleh akun DEVELOPER.
 */

import { getStoredSpkOrders, saveStoredSpkOrders } from './storage';
import { deleteSpkOrderCloud } from '../backend/pocketbaseBackend';
import { SpkOrder } from '../types';

export interface WibTimeInfo {
  year: number;
  month: number;
  date: number;
  hour: number;
  minute: number;
  second: number;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm:ss
  isPast1900Wib: boolean;
}

/**
 * Returns current date and time formatted in WIB (UTC+7 / Asia/Jakarta).
 */
export function getCurrentWibDateTime(): WibTimeInfo {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const getVal = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);

  const year = getVal('year');
  const month = getVal('month');
  const date = getVal('day');
  const hour = getVal('hour');
  const minute = getVal('minute');
  const second = getVal('second');

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  const isPast1900Wib = hour >= 19;

  return {
    year,
    month,
    date,
    hour,
    minute,
    second,
    dateStr,
    timeStr,
    isPast1900Wib
  };
}

const STORAGE_KEY_LAST_CLEANUP = 'bejo_last_spk_archive_cleanup_date';

/**
 * Runs automatic cleanup for all SPK with status SELESAI_LUNAS when time is >= 19:00 WIB.
 * Ensures it runs once per day at or after 19:00 WIB.
 */
export async function checkAndRunSpkAutoCleanup(): Promise<{ cleaned: boolean; count: number; dateStr: string }> {
  try {
    const wib = getCurrentWibDateTime();
    if (!wib.isPast1900Wib) {
      return { cleaned: false, count: 0, dateStr: wib.dateStr };
    }

    const lastCleanupDate = localStorage.getItem(STORAGE_KEY_LAST_CLEANUP);
    if (lastCleanupDate === wib.dateStr) {
      // Already cleaned up today after 19:00 WIB
      return { cleaned: false, count: 0, dateStr: wib.dateStr };
    }

    const currentOrders = getStoredSpkOrders();
    const completedOrders = currentOrders.filter((o) => o.status === 'SELESAI_LUNAS');

    if (completedOrders.length > 0) {
      const activeOrders = currentOrders.filter((o) => o.status !== 'SELESAI_LUNAS');
      saveStoredSpkOrders(activeOrders);

      // Delete from cloud in background
      for (const order of completedOrders) {
        deleteSpkOrderCloud(order.id).catch((err) => {
          console.warn(`[Auto-Cleanup] Failed to delete cloud SPK #${order.orderNumber}:`, err);
        });
      }

      console.log(`[SPK Auto-Cleanup] Berhasil membersihkan ${completedOrders.length} SPK Arsip Selesai pada jam 19.00 WIB (${wib.dateStr}).`);
    }

    localStorage.setItem(STORAGE_KEY_LAST_CLEANUP, wib.dateStr);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('bejo_spk_archive_auto_cleaned', {
          detail: { count: completedOrders.length, dateStr: wib.dateStr, timeStr: wib.timeStr }
        })
      );
    }

    return { cleaned: true, count: completedOrders.length, dateStr: wib.dateStr };
  } catch (err) {
    console.error('[SPK Auto-Cleanup Error]:', err);
    return { cleaned: false, count: 0, dateStr: '' };
  }
}

/**
 * Manual purge by Developer to delete all SPK with status SELESAI_LUNAS (Arsip).
 */
export async function cleanupCompletedSpkManual(developerName: string = 'Developer'): Promise<{ success: boolean; count: number }> {
  try {
    const currentOrders = getStoredSpkOrders();
    const completedOrders = currentOrders.filter((o) => o.status === 'SELESAI_LUNAS');

    if (completedOrders.length === 0) {
      return { success: true, count: 0 };
    }

    const remainingOrders = currentOrders.filter((o) => o.status !== 'SELESAI_LUNAS');
    saveStoredSpkOrders(remainingOrders);

    // Delete from cloud
    for (const order of completedOrders) {
      deleteSpkOrderCloud(order.id).catch((err) => {
        console.warn(`[Manual-Cleanup] Failed to delete cloud SPK #${order.orderNumber}:`, err);
      });
    }

    console.log(`[SPK Manual Cleanup] ${developerName} membersihkan ${completedOrders.length} SPK Arsip Selesai.`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('bejo_spk_archive_manual_cleaned', {
          detail: { count: completedOrders.length, developerName }
        })
      );
    }

    return { success: true, count: completedOrders.length };
  } catch (err) {
    console.error('[SPK Manual Cleanup Error]:', err);
    return { success: false, count: 0 };
  }
}
