import { useMemo } from 'react';
import { balances, eventBalances, totals } from '@/domain/owed';
import { useData } from './DataProvider';

/** Money lent to or borrowed from people, with one balance per person. */
export function useOwed() {
  const { owedEntries, owedOps } = useData();
  const people = useMemo(() => balances(owedEntries), [owedEntries]);
  const events = useMemo(() => eventBalances(owedEntries), [owedEntries]);
  const sum = useMemo(() => totals(people), [people]);
  return { data: owedEntries, people, events, totals: sum, ...owedOps };
}
