import { useMemo } from 'react';
import { balances, projectSummaries, totals } from '@/domain/owed';
import { useData } from './DataProvider';

/** Money lent to or borrowed from people, with one balance per person. */
export function useOwed() {
  const { owedEntries, owedOps, owedProjects, owedProjectOps } = useData();
  const people = useMemo(() => balances(owedEntries), [owedEntries]);
  const projects = useMemo(() => projectSummaries(owedProjects, owedEntries), [owedProjects, owedEntries]);
  const sum = useMemo(() => totals(people), [people]);
  return { data: owedEntries, people, projects, projectOps: owedProjectOps, totals: sum, ...owedOps };
}
