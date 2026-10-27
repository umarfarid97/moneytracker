import { billEstimate, paidDueDatesFor } from './bills';
import { periodEnd, periodKey, periodStart, DEFAULT_START_DAY } from './budgetPeriod';
import { dueDatesBetween } from './commitments';
import type { Sen } from './money';
import { estimateNetMonthly } from './netpay';
import type { IncomeEntry } from './income';
import type { Commitment, Expense, Profile } from './types';

export type UpcomingBill = {
  commitmentId: number;
  name: string;
  kind: Commitment['kind'];
  dueDate: string;
  amount: Sen;
  /** The amount is an estimate because the bill changes every month. */
  variable: boolean;
};

export type BalanceLeft = {
  /** Monthly take-home pay from the profile (see netpay). */
  income: Sen;
  /** Extra income (rent, freelance, allowance) received in the period; already part of `income`. */
  extra: Sen;
  /** Everything spent in the budget period, bill and loan payments included. */
  spent: Sen;
  /** Active bills and loan payments due later in the period that are not paid yet. */
  upcoming: Sen;
  /** The unpaid bills and loan payments `upcoming` adds up, soonest first. */
  upcomingItems: UpcomingBill[];
  /** income - spent; negative when more has gone out than came in. */
  left: Sen;
  /** left - upcoming: what is really free once the unpaid bills are covered. */
  afterBills: Sen;
};

/**
 * Unpaid due dates of active bills that fall inside the period, from the day the bill was added.
 * Dates before a bill's start date or after its end date never count.
 */
export function upcomingBills(commitments: Commitment[], expenses: Expense[], key: string, startDay: number): UpcomingBill[] {
  const start = periodStart(key, startDay);
  const end = periodEnd(key, startDay);
  const out: UpcomingBill[] = [];
  for (const c of commitments) {
    if (!c.active) continue;
    const paid = new Set(paidDueDatesFor(c.id, expenses));
    const amount = billEstimate(c, expenses);
    const from = c.startDate !== null && c.startDate > start ? c.startDate : start;
    for (const due of dueDatesBetween(c, from, end)) {
      if (!paid.has(due)) out.push({ commitmentId: c.id, name: c.name, kind: c.kind, dueDate: due, amount, variable: c.variable });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}

/**
 * Income minus spending for the budget period `today` falls in. Income is the profile's take-home pay
 * plus any extra income received in the period. Returns null while the profile has no salary.
 */
export function balanceLeft(i: {
  profile: Profile;
  expenses: Expense[];
  commitments: Commitment[];
  today: string;
  /** Extra income entries; only those dated inside the period count. */
  extraIncome?: IncomeEntry[];
  /** Monthly income tax (PCB) estimated from the tax calculation; used when the profile has none entered. */
  estimatedPcb?: Sen;
}): BalanceLeft | null {
  const startDay = i.profile.budgetStartDay ?? DEFAULT_START_DAY;
  const key = periodKey(i.today, startDay);
  const start = periodStart(key, startDay);
  const end = periodEnd(key, startDay);
  const extra = (i.extraIncome ?? []).filter((e) => e.date >= start && e.date <= end).reduce((s, e) => s + e.amount, 0);
  const income = estimateNetMonthly(i.profile, i.estimatedPcb) + extra;
  if (income <= 0) return null;
  const spent = i.expenses.filter((e) => periodKey(e.date, startDay) === key).reduce((s, e) => s + e.amount, 0);
  const upcomingItems = upcomingBills(i.commitments, i.expenses, key, startDay);
  const upcoming = upcomingItems.reduce((s, b) => s + b.amount, 0);
  const left = income - spent;
  return { income, extra, spent, upcoming, upcomingItems, left, afterBills: left - upcoming };
}
