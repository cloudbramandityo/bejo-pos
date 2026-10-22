/**
 * Coded by Langgo Bramandityo.
 * Native System Web Notifications API for Windows (Action Center/Toast) and iOS (PWA / Web Push).
 */

export async function requestSystemNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function isSystemNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getSystemNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function sendSystemNotification(title: string, options?: { body?: string; icon?: string; tag?: string }) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
      body: options?.body || '',
      icon: options?.icon || '/pwa-192x192.png',
      tag: options?.tag || 'bejo_pos_notif',
      silent: false
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.warn('System notification blocked or failed:', err);
  }
}
