import React from 'react';
import type { UserRole } from '../../types';
import { getJournalAccess } from './journalAccess';
import { JournalWorkspace } from './journalWorkspace';
import { useJournalScreenModel } from './useJournalScreenModel';

interface LaporanJurnalScreenProps {
  userRole?: UserRole;
}

const JournalAccessDenied: React.FC = () => (
  <div className="flex items-center justify-center py-24 text-sm text-slate-500">
    Modul Jurnal hanya dapat diakses oleh DEVELOPER, OWNER, dan ADMIN.
  </div>
);

const AuthorizedJurnal: React.FC<{ userRole?: UserRole }> = ({ userRole }) => {
  const canEdit = getJournalAccess(userRole) === 'edit';
  const model = useJournalScreenModel({ canEdit });
  return <JournalWorkspace model={model} userRole={userRole} />;
};

export const LaporanJurnalScreen: React.FC<LaporanJurnalScreenProps> = ({ userRole }) => {
  if (getJournalAccess(userRole) === 'none') return <JournalAccessDenied />;
  return <AuthorizedJurnal userRole={userRole} />;
};
