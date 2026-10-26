import { useMemo } from 'react';
import { balances, projectSummaries, totals } from '@/domain/owed';
import { useData } from './DataProvider';

/** Money lent to or borrowed from people, with one balance per person. */
export function useOwed() {
  const { owedEntries, owedOps, owedProjects, owedProjectOps } = useData();
  // Your own balances only: entries between two other people in a book are not money you owe or are owed.
  const people = useMemo(() => balances(owedEntries.filter((e) => e.counter === '')), [owedEntries]);
  const projects = useMemo(() => projectSummaries(owedProjects, owedEntries), [owedProjects, owedEntries]);
  const sum = useMemo(() => totals(people), [people]);
  return { data: owedEntries, people, projects, projectOps: owedProjectOps, totals: sum, ...owedOps };
}
