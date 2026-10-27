import type { TaxYearData } from '@/data/tax/types';
import type { Sen } from './money';
import { calculateTaxBill } from './taxBill';

/**
 * Monthly income tax (PCB) worked out from the same calculation as the tax calculator: a year of the salary
 * less reliefs, taxed by the bands (rebates taken off), divided by 12. Zakat and donations are left out
 * because an employer's PCB does not know about them.
 */
export function estimateMonthlyPcb(grossMonthly: Sen, reliefsTotal: Sen, data: TaxYearData): Sen {
  if (grossMonthly <= 0) return 0;
  const { tax } = calculateTaxBill(
    { salary: grossMonthly * 12, freelanceGross: 0, businessGross: 0, allowableExpenses: 0, reliefsTotal, pcb: 0, zakat: 0, spouseRebate: false },
    data,
  );
  return Math.round(tax / 12);
}
