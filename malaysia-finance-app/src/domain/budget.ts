import type { Sen } from './money';

export type Status = 'on-track' | 'tight' | 'over';

/** On-track below 80% of the limit, tight from 80% to 100% inclusive, over above. */
export function categoryStatus(spent: Sen, limit: Sen): { left: Sen; status: Status } {
  const left = limit - spent;
  if (limit === 0) return { left, status: spent > 0 ? 'over' : 'on-track' };
  if (spent * 100 > limit * 100) return { left, status: 'over' };
  if (spent * 100 >= limit * 80) return { left, status: 'tight' };
  return { left, status: 'on-track' };
}

/** What can still be spent per remaining day; never negative. */
export function dailyAllowance(totalLimitLeft: Sen, daysLeft: number): Sen {
  return Math.floor(Math.max(0, totalLimitLeft) / Math.max(1, daysLeft));
}
