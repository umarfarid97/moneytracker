import { monthName, shortMonthName, weekdayName } from '@/i18n/content';
import { t } from '@/i18n/t';

/** Dates are `YYYY-MM-DD` strings in Asia/Kuala_Lumpur (UTC+8, no DST). */
const KL_OFFSET_MS = 8 * 60 * 60 * 1000;

export function todayKL(now: Date = new Date()): string {
  return new Date(now.getTime() + KL_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Days remaining in the month, counting the given day itself. */
export function daysLeftInMonth(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return daysInMonth(y, m) - d + 1;
}

const pad2 = (n: number) => n.toString().padStart(2, '0');
const parts = (date: string) => date.split('-').map(Number) as [number, number, number];
const fromUtc = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date);
  return fromUtc(new Date(Date.UTC(y, m - 1, d + days)));
}

/** "Today", "Yesterday", otherwise "Tue 20 Oct". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return t('expense.today');
  if (date === addDays(today, -1)) return t('expense.yesterday');
  const [y, m, d] = parts(date);
  const weekday = weekdayName(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
  return `${weekday} ${d} ${shortMonthName(m)}`;
}

/** "October 2026" from `2026-10`. */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${monthName(m)} ${y}`;
}

/** Moves a `YYYY-MM` key by a number of months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
}

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = parts(date);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** "Sat 24 Oct". */
export function shortDate(date: string): string {
  const [y, m, d] = parts(date);
  return `${weekdayName(new Date(Date.UTC(y, m - 1, d)).getUTCDay())} ${d} ${shortMonthName(m)}`;
}

/** "10 Jun". */
export function dayMonth(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${shortMonthName(m)}`;
}
