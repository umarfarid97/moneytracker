import { daysUntil, nextScheduledDue } from './commitments';
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

export type BillState = 'paused' | 'upcoming' | 'due' | 'overdue' | 'paid' | 'ended';
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
  // The next due date inside the bill's start and end dates; null once it has ended.
  const next = nextScheduledDue(c, addDays(today, 1));
  const untilNext = next === null ? 0 : daysUntil(next, today);
  if (!c.active) return { state: 'paused', dueDate: next ?? c.endsOn ?? today, days: untilNext };

  // After the end date the last due date is the one on or before it.
  const prev = previousDueDate(c.dayOfMonth, c.endsOn !== null && c.endsOn < today ? c.endsOn : today);
  // Due dates before the bill was added or started never count; a bill with no start date has no history to judge.
  const prevCounts = c.startDate !== null && prev >= c.startDate && (c.startsOn === null || prev >= c.startsOn);
  if (prevCounts && !paid.has(prev)) {
    return prev === today
      ? { state: 'due', dueDate: prev, days: 0 }
      : { state: 'overdue', dueDate: prev, days: daysUntil(today, prev) };
  }
  if (next === null) return { state: 'ended', dueDate: c.endsOn ?? today, days: 0 };
  if (paid.has(next) || (prevCounts && monthKey(prev) === monthKey(today))) {
    return { state: 'paid', dueDate: next, days: untilNext };
  }
  return { state: 'upcoming', dueDate: next, days: untilNext };
}

/**
 * What a bill is expected to cost this month. A variable bill uses what was last paid, since that is
 * closer than the estimate typed in when it was added; a fixed bill is always its amount.
 */
export function billEstimate(c: Commitment, expenses: Expense[]): number {
  if (!c.variable) return c.amount;
  return lastPaidFor(c.id, expenses) ?? c.amount;
}

/** The latest amount paid for a bill (by due date), or null when it was never paid. */
export function lastPaidFor(commitmentId: number, expenses: Expense[]): number | null {
  let best: Expense | null = null;
  for (const e of expenses) {
    if (e.commitmentId !== commitmentId || e.dueDate === null) continue;
    if (!best || (e.dueDate as string) > (best.dueDate as string)) best = e;
  }
  return best ? best.amount : null;
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
  // Nothing falls due after the end date, so look back from it once it has passed.
  let cursor = previousDueDate(c.dayOfMonth, c.endsOn !== null && c.endsOn < today ? c.endsOn : today);
  for (let i = 0; i < 12; i++) {
    if (cursor < c.startDate || (c.startsOn !== null && cursor < c.startsOn)) break;
    if (c.lastAutoDue !== null && cursor <= c.lastAutoDue) break;
    out.unshift(cursor);
    cursor = previousDueDate(c.dayOfMonth, addDays(cursor, -1));
  }
  return out;
}

/**
 * Adjusts a bill that is being edited so the edit cannot invent payments:
 * - resuming a paused bill, or changing its day of month, starts its schedule today (months paused, or
 *   already paid under the old day, are not due again);
 * - switching automatic recording on starts from the latest due date, so earlier months that were
 *   entered by hand are not recorded a second time.
 * New bills (`old` is null) and ordinary edits are returned unchanged.
 */
export function applyBillChange(old: Commitment | null, next: Commitment, today: string): Commitment {
  if (!old) return next;
  const resumed = !old.active && next.active;
  const dayChanged = old.dayOfMonth !== next.dayOfMonth;
  if (resumed || dayChanged) return { ...next, startDate: today, lastAutoDue: null };
  if (!old.autoRecord && next.autoRecord) return { ...next, lastAutoDue: previousDueDate(next.dayOfMonth, today) };
  return next;
}
