import { useMemo } from 'react';
import type { Budget } from '@/domain/types';
import { useData } from './DataProvider';

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Budgets for one month (`YYYY-MM`). */
export function useBudgets(month: string) {
  const { budgets, getBudgets, setBudget, removeBudget } = useData();
  const data = useMemo(() => budgets.filter((b) => b.month === month), [budgets, month]);

  /** Copies last month's limits into this month, keeping any limit already set here. */
  async function copyFromLast(): Promise<void> {
    const latest = getBudgets();
    const last = latest.filter((b) => b.month === previousMonth(month));
    const have = new Set(latest.filter((b) => b.month === month).map((b) => b.categoryId));
    for (const b of last) {
      if (!have.has(b.categoryId)) await setBudget({ ...b, month } satisfies Budget);
    }
  }

  /** Removes this month's budget for a category. */
  const remove = (categoryId: number) => removeBudget(categoryId, month);

  return { data, set: setBudget, remove, copyFromLast };
}
