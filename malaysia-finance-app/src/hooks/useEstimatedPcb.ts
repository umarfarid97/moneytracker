import { useMemo } from 'react';
import { capReliefClaims } from '@/domain/reliefs';
import { estimateMonthlyPcb } from '@/domain/pcbEstimate';
import { useAllReliefClaims } from './useAllReliefClaims';
import { useProfile } from './useProfile';
import { useTaxYear } from './useTaxYear';

/** Monthly PCB estimated from the profile's salary and the reliefs, same as the tax calculator's figures. */
export function useEstimatedPcb(grossMonthly?: number): number {
  const { year, data } = useTaxYear();
  const { data: profile } = useProfile();
  const { data: claims } = useAllReliefClaims(year);
  const gross = grossMonthly ?? profile.grossMonthly;
  return useMemo(() => {
    const reliefs = data.automaticReliefs.reduce((sum, r) => sum + r.amount, 0) + capReliefClaims(claims, data.reliefs).total;
    return estimateMonthlyPcb(gross, reliefs, data);
  }, [gross, claims, data]);
}
