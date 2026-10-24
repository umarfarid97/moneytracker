import { useMemo } from 'react';
import { useData } from './DataProvider';

/** Relief claims for one year of assessment. */
export function useReliefClaims(year: number) {
  const { reliefClaims, reliefClaimOps } = useData();
  const data = useMemo(() => reliefClaims.filter((c) => c.year === year), [reliefClaims, year]);
  return { data, ...reliefClaimOps };
}
