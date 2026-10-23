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

export function monthlyCommitmentTotal(list: Commitment[]): Sen {
  return list.reduce((sum, c) => (c.active ? sum + c.amount : sum), 0);
}

/**
 * The next reminder that is still in the future: 09:00 Kuala Lumpur time (01:00 UTC) the day before a due
 * date. If this month's reminder has already passed, it moves on to the following month.
 */
export function nextReminder(dayOfMonth: number, now: Date): { dueDate: string; fireAt: Date } {
  let dueDate = nextDueDate(dayOfMonth, todayKL(now));
  for (let i = 0; i < 24; i++) {
    const fireAt = new Date(`${addDays(dueDate, -1)}T01:00:00Z`);
    if (fireAt.getTime() > now.getTime()) return { dueDate, fireAt };
    dueDate = nextDueDate(dayOfMonth, addDays(dueDate, 1));
  }
  throw new Error('no upcoming reminder found');
}
