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

/**
 * Take-home pay estimate: an explicit override wins, else gross minus EPF, SOCSO and EIS. SOCSO and EIS
 * left at 0 are estimated from the salary, so the figure is not rosier than a real payslip. Income tax
 * (PCB) is not taken off.
 */
export function estimateNetMonthly(p: Profile): Sen {
  if (p.netMonthlyOverride !== null) return p.netMonthlyOverride;
  const epf = Math.round(p.grossMonthly * p.epfRate);
  const socso = p.socsoMonthly > 0 ? p.socsoMonthly : estimateSocso(p.grossMonthly);
  const eis = p.eisMonthly > 0 ? p.eisMonthly : estimateEis(p.grossMonthly);
  return Math.max(0, p.grossMonthly - epf - socso - eis);
}
