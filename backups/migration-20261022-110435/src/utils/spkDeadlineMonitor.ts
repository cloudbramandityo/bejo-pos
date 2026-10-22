/**
 * Coded by Langgo Bramandityo.
 * SPK Deadline Monitor & Si BEJO AI Real-time Deadline Alert System.
 * Memantau SPK yang mendekati batas deadline atau melewati batas waktu,
 * dan mengirimkan notifikasi interaktif Si BEJO AI kepada SPK, Admin, Kasir, dan Developer.
 */

import { SpkOrder, SpkStatus, SpkPriority, UserRole } from '../types';
import { getStoredSpkOrders } from './storage';

export interface SpkDeadlineAlert {
  id: string; // unique alert key e.g. "alert_spk_SPK-260930-0005"
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  jobName: string;
  materialName: string;
  deadlineDate: string;
  deadlineTime: string;
  deadlineTimestamp: number;
  status: SpkStatus;
  priority: SpkPriority;
  assignedMachine: string;
  diffMinutes: number; // Positive = minutes left, Negative = minutes overdue
  isOverdue: boolean;
  urgencyLevel: 'CRITICAL' | 'WARNING' | 'OVERDUE';
  timeRemainingText: string;
  detectedAt: number;
}

/**
 * Checks if the user role is eligible for SPK deadline alerts.
 * Targets: SPK, Admin, Kasir, Developer (and Owner).
 */
export function isUserEligibleForDeadlineAlert(role?: UserRole): boolean {
  if (!role) return false;
  const upper = role.toUpperCase();
  return (
    upper === 'SPK' ||
    upper === 'ADMIN' ||
    upper === 'KASIR' ||
    upper === 'DEVELOPER' ||
    upper === 'OWNER'
  );
}

/**
 * Calculates deadline remaining minutes and format readable string in Indonesian.
 */
export function evaluateSpkDeadlines(orders?: SpkOrder[]): SpkDeadlineAlert[] {
  const currentOrders = orders || getStoredSpkOrders();
  const now = Date.now();
  const alerts: SpkDeadlineAlert[] = [];

  // Filter only in-production orders (exclude completed, cancelled, and ready for pickup)
  // Notifikasi deadline terhenti ketika status SPK berubah menjadi SIAP AMBIL / BAYAR
  const activeOrders = currentOrders.filter(
    (o) => o.status !== 'SELESAI_LUNAS' && o.status !== 'DIBATALKAN' && o.status !== 'SIAP_AMBIL'
  );

  for (const order of activeOrders) {
    if (!order.deadlineDate) continue;

    const timePart = order.deadlineTime || '17:00';
    const cleanTime = timePart.length === 5 ? `${timePart}:00` : timePart;
    const deadlineIso = `${order.deadlineDate}T${cleanTime}`;
    const deadlineDateObj = new Date(deadlineIso);

    if (isNaN(deadlineDateObj.getTime())) continue;

    const deadlineTimestamp = deadlineDateObj.getTime();
    const diffMs = deadlineTimestamp - now;
    const diffMinutes = Math.round(diffMs / 60000);

    const isOverdue = diffMinutes < 0;
    const isWithin2Hours = diffMinutes <= 120 && diffMinutes >= 0;
    const isUrgentDueToday = order.priority === 'URGENT' && diffMinutes <= 360; // 6 hours for Urgent

    // Alert triggered if overdue, within 2 hours, or urgent due within 6 hours
    if (isOverdue || isWithin2Hours || isUrgentDueToday) {
      let urgencyLevel: 'CRITICAL' | 'WARNING' | 'OVERDUE' = 'WARNING';
      let timeRemainingText = '';

      if (isOverdue) {
        urgencyLevel = 'OVERDUE';
        const overdueMins = Math.abs(diffMinutes);
        if (overdueMins < 60) {
          timeRemainingText = `Lewat ${overdueMins} Menit!`;
        } else {
          const hours = Math.floor(overdueMins / 60);
          const remMins = overdueMins % 60;
          timeRemainingText = `Lewat ${hours}j ${remMins}m!`;
        }
      } else if (diffMinutes <= 30) {
        urgencyLevel = 'CRITICAL';
        timeRemainingText = `Tersisa ${diffMinutes} Menit Lagi!`;
      } else if (diffMinutes < 60) {
        urgencyLevel = 'CRITICAL';
        timeRemainingText = `Tersisa ${diffMinutes} Menit`;
      } else {
        urgencyLevel = 'WARNING';
        const hours = Math.floor(diffMinutes / 60);
        const remMins = diffMinutes % 60;
        timeRemainingText = `Tersisa ${hours} Jam ${remMins > 0 ? `${remMins}m` : ''}`;
      }

      const firstItem = order.items && order.items[0];
      const jobName = firstItem?.jobName || 'Pesanan Cetak Digital';
      const materialName = firstItem?.materialName || 'Bahan Digital Printing';

      alerts.push({
        id: `deadline_alert_${order.id}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        jobName,
        materialName,
        deadlineDate: order.deadlineDate,
        deadlineTime: timePart,
        deadlineTimestamp,
        status: order.status,
        priority: order.priority,
        assignedMachine: order.assignedMachine,
        diffMinutes,
        isOverdue,
        urgencyLevel,
        timeRemainingText,
        detectedAt: now
      });
    }
  }

  // Sort by urgency: overdue first, then lowest remaining minutes
  return alerts.sort((a, b) => a.diffMinutes - b.diffMinutes);
}
