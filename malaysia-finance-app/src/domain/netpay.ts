import type { Sen } from './money';
import type { Profile } from './types';

/** SOCSO and EIS are worked out on wages up to this monthly ceiling (RM 6,000). */
const WAGE_CEILING: Sen = 600_000;

/** What an employee roughly pays SOCSO a month: about 0.5% of wages up to the ceiling. */
export function estimateSocso(grossMonthly: Sen): Sen {
  return Math.round(Math.min(grossMonthly, WAGE_CEILING) * 0.005);
}

/** What an employee roughly pays EIS a month: 0.2% of wages up to the ceiling. */
export function estimateEis(grossMonthly: Sen): Sen {
  return Math.round(Math.min(grossMonthly, WAGE_CEILING) * 0.002);
}

export type Deduction = { amount: Sen; estimated: boolean };

export type TakeHome = {
  gross: Sen;
  epf: Sen;
  socso: Deduction;
  eis: Deduction;
  pcb: Deduction;
  net: Sen;
  /** True when the figure is the typed-in take-home pay, so the deductions above are not what it was worked out from. */
  overridden: boolean;
};

const entered = (typed: Sen, estimate: Sen): Deduction =>
  typed > 0 ? { amount: typed, estimated: false } : { amount: estimate, estimated: true };

/**
 * Take-home pay: an explicit override wins, else gross minus EPF, SOCSO, EIS and income tax (PCB). Each of
 * SOCSO, EIS and PCB uses the payslip figure when entered and otherwise an estimate (`estimatedPcb` comes
 * from the tax calculation; 0 when not given), so the figure is not rosier than a real payslip.
 */
export function takeHomeBreakdown(p: Profile, estimatedPcb: Sen = 0): TakeHome {
  const epf = Math.round(p.grossMonthly * p.epfRate);
  const socso = entered(p.socsoMonthly, estimateSocso(p.grossMonthly));
  const eis = entered(p.eisMonthly, estimateEis(p.grossMonthly));
  const pcb = entered(p.pcbMonthly ?? 0, Math.max(0, estimatedPcb));
  const overridden = p.netMonthlyOverride !== null;
  const net = overridden
    ? (p.netMonthlyOverride as Sen)
    : Math.max(0, p.grossMonthly - epf - socso.amount - eis.amount - pcb.amount);
  return { gross: p.grossMonthly, epf, socso, eis, pcb, net, overridden };
}

export function estimateNetMonthly(p: Profile, estimatedPcb: Sen = 0): Sen {
  return takeHomeBreakdown(p, estimatedPcb).net;
}
