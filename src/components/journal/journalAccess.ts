import type { UserRole } from '../../types';

export type JournalAccess = 'edit' | 'view' | 'none';

export function getJournalAccess(role?: UserRole): JournalAccess {
  if (role === 'DEVELOPER') return 'edit';
  if (role === 'OWNER' || role === 'ADMIN') return 'view';
  return 'none';
}
