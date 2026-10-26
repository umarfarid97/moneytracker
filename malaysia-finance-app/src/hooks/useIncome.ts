import { useMemo } from 'react';
import { monthTotal } from '@/domain/income';
import { useData } from './DataProvider';

/** Extra income: the repeating rules and everything received. */
export function useIncome(month: string) {
  const { incomeRules, incomeRuleOps, incomeEntries, incomeEntryOps } = useData();
  const received = useMemo(() => monthTotal(incomeEntries, month), [incomeEntries, month]);
  return { rules: incomeRules, ruleOps: incomeRuleOps, entries: incomeEntries, entryOps: incomeEntryOps, received };
}
