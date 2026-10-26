import { daysUntil } from './commitments';
import { addDays, daysInMonth, dayMonth, monthKey, monthLabel, shiftMonth } from './dates';

/**
 * Budget periods. Most people's month runs from the 1st, but many are paid at month end and want the
 * budget to run from payday to the day before the next one. A period is named by the month it starts in
 * (`YYYY-MM`), which is also how budgets are stored, so a start day of 1 is exactly the calendar month.
 * A start day past the end of a short month falls on that month's last day (31 means "last day").
 */
export const DEFAULT_START_DAY = 1;

const pad = (n: number) => n.toString().padStart(2, '0');

/** The first day of period `key`. */
export function periodStart(key: string, startDay: number = DEFAULT_START_DAY): string {
  const [y, m] = key.split('-').map(Number);
  return `${key}-${pad(Math.min(startDay, daysInMonth(y, m)))}`;
}

/** The last day of period `key`: the day before the next period starts. */
export function periodEnd(key: string, startDay: number = DEFAULT_START_DAY): string {
  return addDays(periodStart(shiftMonth(key, 1), startDay), -1);
}

/** The period a date falls in. */
export function periodKey(date: string, startDay: number = DEFAULT_START_DAY): string {
  const key = monthKey(date);
  return date >= periodStart(key, startDay) ? key : shiftMonth(key, -1);
}

/** Days left in the period, counting the given day itself. */
export function daysLeftInPeriod(date: string, startDay: number = DEFAULT_START_DAY): number {
  return daysUntil(periodEnd(periodKey(date, startDay), startDay), date) + 1;
}

/** "October 2026" for a calendar month, "25 Oct - 24 Nov" when the period starts mid-month. */
export function periodLabel(key: string, startDay: number = DEFAULT_START_DAY): string {
  if (startDay === 1) return monthLabel(key);
  return `${dayMonth(periodStart(key, startDay))} - ${dayMonth(periodEnd(key, startDay))}`;
}

/** A start day typed by the user: a whole number from 1 to 31. */
export function parseStartDay(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const day = Number(trimmed);
  return day >= 1 && day <= 31 ? day : null;
}
