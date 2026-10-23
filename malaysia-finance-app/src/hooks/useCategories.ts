import { useData } from './DataProvider';

export function useCategories() {
  const { categories, categoryOps } = useData();
  return { data: categories, ...categoryOps };
}
