import { useData } from './DataProvider';

export function useExpenses() {
  const { expenses, expenseOps } = useData();
  return { data: expenses, ...expenseOps };
}
