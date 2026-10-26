import { useMemo } from 'react';
import { summariseEpf, summariseSocso } from '@/domain/retirement';
import { useData } from './DataProvider';

/** EPF, SOCSO and EIS records with their totals for one calendar year. */
export function useRetirement(year: number) {
  const { retirementEntries, retirementOps } = useData();
  const epfEntries = useMemo(() => retirementEntries.filter((e) => e.scheme === 'epf'), [retirementEntries]);
  const socsoEntries = useMemo(() => retirementEntries.filter((e) => e.scheme !== 'epf'), [retirementEntries]);
  const epf = useMemo(() => summariseEpf(retirementEntries, year), [retirementEntries, year]);
  const socso = useMemo(() => summariseSocso(retirementEntries, year), [retirementEntries, year]);
  return { entries: retirementEntries, epfEntries, socsoEntries, epf, socso, ...retirementOps };
}
