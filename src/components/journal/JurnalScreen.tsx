import React from 'react';
import { JournalWorkspace } from './journalWorkspace';
import { useJournalScreenModel } from './useJournalScreenModel';

export const JurnalScreen: React.FC = () => {
  const model = useJournalScreenModel();
  return <JournalWorkspace model={model} />;
};
