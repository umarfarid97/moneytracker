import { useMemo } from 'react';
import { summariseGiving } from '@/domain/giving';
import { useData } from './DataProvider';

/** Zakat and sedekah records with their totals for one calendar year. */
export function useGiving(year: number) {
  const { givingRecords, givingOps } = useData();
  const summary = useMemo(() => summariseGiving(givingRecords, year), [givingRecords, year]);
  const inYear = useMemo(
    () => givingRecords.filter((r) => Number(r.date.slice(0, 4)) === year),
    [givingRecords, year],
  );
  return { data: givingRecords, inYear, summary, ...givingOps };
}
