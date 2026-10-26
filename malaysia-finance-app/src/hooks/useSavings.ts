import { useMemo } from 'react';
import { totals } from '@/domain/savings';
import { useData } from './DataProvider';

/** Savings and investment accounts with their combined balance. */
export function useSavings() {
  const { savingsAccounts, savingsOps } = useData();
  const sum = useMemo(() => totals(savingsAccounts), [savingsAccounts]);
  return { data: savingsAccounts, totals: sum, ...savingsOps };
}
