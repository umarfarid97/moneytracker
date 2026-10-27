import { addDays, daysInMonth, todayKL } from './dates';
import type { Sen } from './money';
import type { Commitment } from './types';

const pad = (n: number) => n.toString().padStart(2, '0');

/** Next date (today included) a monthly commitment falls due; short months use their last day. */
export function nextDueDate(dayOfMonth: number, today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const thisMonthDay = Math.min(dayOfMonth, daysInMonth(y, m));
  if (thisMonthDay >= d) return `${y}-${pad(m)}-${pad(thisMonthDay)}`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(dayOfMonth, daysInMonth(ny, nm)))}`;
}

const dayNumber = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export function daysUntil(due: string, today: string): number {
  return dayNumber(due) - dayNumber(today);
}

/** Whether `date` falls inside the bill's optional start and end dates. */
export function isWithinWindow(c: Pick<Commitment, 'startsOn' | 'endsOn'>, date: string): boolean {
  return (c.startsOn === null || date >= c.startsOn) && (c.endsOn === null || date <= c.endsOn);
}

/** The first due date on or after `from` that the bill really applies to, or null once its end date has passed. */
export function nextScheduledDue(c: Pick<Commitment, 'dayOfMonth' | 'startsOn' | 'endsOn'>, from: string): string | null {
  const start = c.startsOn !== null && c.startsOn > from ? c.startsOn : from;
  const due = nextDueDate(c.dayOfMonth, start);
  return c.endsOn !== null && due > c.endsOn ? null : due;
}

/** Every due date from `from` to `to` (both included) that falls inside the bill's start and end dates. */
export function dueDatesBetween(c: Pick<Commitment, 'dayOfMonth' | 'startsOn' | 'endsOn'>, from: string, to: string): string[] {
  const out: string[] = [];
  for (let due = nextScheduledDue(c, from); due !== null && due <= to; due = nextScheduledDue(c, addDays(due, 1))) out.push(due);
  return out;
}

/** True once the bill's end date is behind us: it will never fall due again. */
export function hasEnded(c: Pick<Commitment, 'endsOn'>, today: string): boolean {
  return c.endsOn !== null && c.endsOn < today;
}

export function monthlyCommitmentTotal(list: Commitment[]): Sen {
  return list.reduce((sum, c) => (c.active ? sum + c.amount : sum), 0);
}

/**
 * The next reminder that is still in the future: 09:00 Kuala Lumpur time (01:00 UTC) `leadDays` days before a
 * due date (the day before by default, 0 for the morning of the due date). If this month's reminder has
 * already passed, it moves on to the following month.
 */
export function nextReminder(dayOfMonth: number, now: Date, leadDays = 1): { dueDate: string; fireAt: Date } {
  let dueDate = nextDueDate(dayOfMonth, todayKL(now));
  for (let i = 0; i < 24; i++) {
    const fireAt = new Date(`${addDays(dueDate, -leadDays)}T01:00:00Z`);
    if (fireAt.getTime() > now.getTime()) return { dueDate, fireAt };
    dueDate = nextDueDate(dayOfMonth, addDays(dueDate, 1));
  }
  throw new Error('no upcoming reminder found');
}

/** Like nextReminder, but only for due dates inside the bill's start and end dates; null when none is left. */
export function nextReminderFor(
  c: Pick<Commitment, 'dayOfMonth' | 'startsOn' | 'endsOn'>, now: Date, leadDays = 1,
): { dueDate: string; fireAt: Date } | null {
  let dueDate = nextScheduledDue(c, todayKL(now));
  for (let i = 0; i < 24 && dueDate !== null; i++) {
    const fireAt = new Date(`${addDays(dueDate, -leadDays)}T01:00:00Z`);
    if (fireAt.getTime() > now.getTime()) return { dueDate, fireAt };
    dueDate = nextScheduledDue(c, addDays(dueDate, 1));
  }
  return null;
}
