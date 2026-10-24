import { useEffect } from 'react';
import { useData } from '@/hooks/DataProvider';
import { useToday } from '@/hooks/useToday';

/**
 * Records the spending for bills set to "record automatically" at launch, when the day changes, and when
 * bills change. Safe to run repeatedly: a due date that already has its spending is never recorded again.
 */
export function BillsSync() {
  const { commitments, runAutoRecord } = useData();
  const today = useToday();
  useEffect(() => {
    runAutoRecord(today).catch(() => {});
  }, [today, commitments, runAutoRecord]);
  return null;
}
