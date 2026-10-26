import { previousDueDate } from './bills';
import { addDays } from './dates';
import type { Sen } from './money';

/**
 * Extra income that your salary in Profile cannot express: freelance work, rent from a tenant, an
 * allowance. A rule adds an entry on its day each month; entries can also be added once.
 */
export type IncomeRule = {
  id: number;
  name: string;
  amount: Sen;
  dayOfMonth: number;
  active: boolean;
  /** Day the rule was added: earlier days are never filled in. */
  startDate: string;
  /** Latest day an entry was added for, so a deleted entry is not recreated. */
  lastRun: string | null;
};
export type NewIncomeRule = Omit<IncomeRule, 'id' | 'lastRun'> & Partial<Pick<IncomeRule, 'lastRun'>>;
export const withRuleDefaults = (i: NewIncomeRule): Omit<IncomeRule, 'id'> => ({ lastRun: null, ...i });

export type IncomeEntry = { id: number; name: string; amount: Sen; date: string };
export type NewIncomeEntry = Omit<IncomeEntry, 'id'>;

/** Days a rule has not added an entry for yet, oldest first, up to and including `today`. */
export function missedRuns(rule: IncomeRule, today: string): string[] {
  if (!rule.active) return [];
  const days: string[] = [];
  let cursor = previousDueDate(rule.dayOfMonth, today);
  for (let i = 0; i < 36; i++) {
    const done = rule.lastRun !== null ? cursor <= rule.lastRun : false;
    if (done || cursor < rule.startDate) break;
    days.unshift(cursor);
    cursor = previousDueDate(rule.dayOfMonth, addDays(cursor, -1));
  }
  return days;
}

/** Same id on every phone for the same rule and day, so two phones adding it merge into one entry. */
export const runUid = (ruleUid: string, date: string) => `inc-${ruleUid}-${date}`;

export function monthTotal(entries: IncomeEntry[], month: string): Sen {
  return entries.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
}
