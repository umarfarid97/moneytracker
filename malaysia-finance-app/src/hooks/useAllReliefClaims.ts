import { useMemo } from 'react';
import { claimsFromExpenses } from '@/domain/reliefSpending';
import { useExpenses } from './useExpenses';
import { useReliefClaims } from './useReliefClaims';

/**
 * Everything counted toward the reliefs of one year: claims typed in by hand plus spending tagged to a
 * relief. This is the only place the two are combined, so every screen shows the same totals.
 */
export function useAllReliefClaims(year: number) {
  const manual = useReliefClaims(year);
  const { data: expenses } = useExpenses();
  const fromSpending = useMemo(() => claimsFromExpenses(expenses).filter((c) => c.year === year), [expenses, year]);
  const data = useMemo(() => [...manual.data, ...fromSpending], [manual.data, fromSpending]);
  return { data, manual: manual.data, fromSpending, add: manual.add, update: manual.update, remove: manual.remove };
}
