import { billEstimate, paidDueDatesFor } from './bills';
import { periodEnd, periodKey, periodStart, DEFAULT_START_DAY } from './budgetPeriod';
import { nextDueDate } from './commitments';
import { addDays } from './dates';
import type { Sen } from './money';
import { estimateNetMonthly } from './netpay';
import type { Commitment, Expense, Profile } from './types';

export type BalanceLeft = {
  /** Monthly take-home pay from the profile (see netpay). */
  income: Sen;
  /** Everything spent in the budget period, bill and loan payments included. */
  spent: Sen;
  /** Active bills and loan payments due later in the period that are not paid yet. */
  upcoming: Sen;
  /** income - spent; negative when more has gone out than came in. */
  left: Sen;
  /** left - upcoming: what is really free once the unpaid bills are covered. */
  afterBills: Sen;
};

/** Unpaid due dates of active bills that fall inside the period, from the day the bill was added. */
function upcomingBills(commitments: Commitment[], expenses: Expense[], key: string, startDay: number): Sen {
  const start = periodStart(key, startDay);
  const end = periodEnd(key, startDay);
  let total = 0;
  for (const c of commitments) {
    if (!c.active) continue;
    const paid = new Set(paidDueDatesFor(c.id, expenses));
    const estimate = billEstimate(c, expenses);
    const from = c.startDate !== null && c.startDate > start ? c.startDate : start;
    for (let due = nextDueDate(c.dayOfMonth, from); due <= end; due = nextDueDate(c.dayOfMonth, addDays(due, 1))) {
      if (!paid.has(due)) total += estimate;
    }
  }
  return total;
}

/**
 * Income minus spending for the budget period `today` falls in. Income is the profile's take-home pay,
 * so there is no separate income to record. Returns null while the profile has no salary.
 */
export function balanceLeft(i: {
  profile: Profile;
  expenses: Expense[];
  commitments: Commitment[];
  today: string;
}): BalanceLeft | null {
  const startDay = i.profile.budgetStartDay ?? DEFAULT_START_DAY;
  const income = estimateNetMonthly(i.profile);
  if (income <= 0) return null;
  const key = periodKey(i.today, startDay);
  const spent = i.expenses.filter((e) => periodKey(e.date, startDay) === key).reduce((s, e) => s + e.amount, 0);
  const upcoming = upcomingBills(i.commitments, i.expenses, key, startDay);
  const left = income - spent;
  return { income, spent, upcoming, left, afterBills: left - upcoming };
}
