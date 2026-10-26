import { useEffect } from 'react';
import { useData } from '@/hooks/DataProvider';
import { useToday } from '@/hooks/useToday';

/**
 * Adds the extra income that repeating rules owe, at launch, when the day changes and when rules change.
 * Safe to run repeatedly: a day a rule has handled is never added twice.
 */
export function IncomeSync() {
  const { incomeRules, runRecurringIncome } = useData();
  const today = useToday();
  useEffect(() => {
    runRecurringIncome(today).catch(() => {});
  }, [today, incomeRules, runRecurringIncome]);
  return null;
}
