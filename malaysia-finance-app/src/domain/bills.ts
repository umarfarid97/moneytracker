import { daysUntil, nextDueDate } from './commitments';
import { addDays, daysInMonth, monthKey } from './dates';
import type { Commitment, Expense } from './types';

const pad = (n: number) => n.toString().padStart(2, '0');

/** The latest due date on or before `today` (short months use their last day). */
export function previousDueDate(dayOfMonth: number, today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const thisMonth = Math.min(dayOfMonth, daysInMonth(y, m));
  if (thisMonth <= d) return `${y}-${pad(m)}-${pad(thisMonth)}`;
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${pad(pm)}-${pad(Math.min(dayOfMonth, daysInMonth(py, pm)))}`;
}

export type BillState = 'paused' | 'upcoming' | 'due' | 'overdue' | 'paid';
export type BillStatus = {
  state: BillState;
  /** The due date the state is about (the unpaid one for due/overdue, the next one otherwise). */
  dueDate: string;
  /** Days late for overdue, days until the due date for upcoming/paid/paused, 0 for due. */
  days: number;
};

/**
 * Where a bill stands today. `paidDueDates` are the due dates that already have their spending recorded.
 * Due dates before the day the bill was added are ignored, so a new bill is never shown as overdue.
 */
export function billStatus(i: { commitment: Commitment; today: string; paidDueDates: Iterable<string> }): BillStatus {
  const { commitment: c, today } = i;
  const paid = new Set(i.paidDueDates);
  const next = nextDueDate(c.dayOfMonth, addDays(today, 1));
  const untilNext = daysUntil(next, today);
  if (!c.active) return { state: 'paused', dueDate: next, days: untilNext };

  const prev = previousDueDate(c.dayOfMonth, today);
  // Due dates before the bill was added never count; a bill with no start date has no history to judge.
  const prevCounts = c.startDate !== null && prev >= c.startDate;
  if (prevCounts && !paid.has(prev)) {
    return prev === today
      ? { state: 'due', dueDate: prev, days: 0 }
      : { state: 'overdue', dueDate: prev, days: daysUntil(today, prev) };
  }
  if (paid.has(next) || (prevCounts && monthKey(prev) === monthKey(today))) {
    return { state: 'paid', dueDate: next, days: untilNext };
  }
  return { state: 'upcoming', dueDate: next, days: untilNext };
}

/** The due dates of one bill that already have their spending. */
export function paidDueDatesFor(commitmentId: number, expenses: Expense[]): string[] {
  return expenses.filter((e) => e.commitmentId === commitmentId && e.dueDate !== null).map((e) => e.dueDate as string);
}

/**
 * Due dates auto-record still has to handle: after the last one it handled, not before the bill was
 * added, up to today. Oldest first, at most the latest 12.
 */
export function missedDueDates(c: Commitment, today: string): string[] {
  const out: string[] = [];
  if (c.startDate === null) return out;
  let cursor = previousDueDate(c.dayOfMonth, today);
  for (let i = 0; i < 12; i++) {
    if (cursor < c.startDate) break;
    if (c.lastAutoDue !== null && cursor <= c.lastAutoDue) break;
    out.unshift(cursor);
    cursor = previousDueDate(c.dayOfMonth, addDays(cursor, -1));
  }
  return out;
}
