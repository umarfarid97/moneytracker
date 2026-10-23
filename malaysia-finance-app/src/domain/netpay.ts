import type { Sen } from './money';
import type { Profile } from './types';

/** Take-home pay estimate: an explicit override wins, else gross minus EPF, SOCSO and EIS. */
export function estimateNetMonthly(p: Profile): Sen {
  if (p.netMonthlyOverride !== null) return p.netMonthlyOverride;
  const epf = Math.round(p.grossMonthly * p.epfRate);
  return Math.max(0, p.grossMonthly - epf - p.socsoMonthly - p.eisMonthly);
}
