/** Dates are `YYYY-MM-DD` strings in Asia/Kuala_Lumpur (UTC+8, no DST). */
const KL_OFFSET_MS = 8 * 60 * 60 * 1000;

export function todayKL(now: Date = new Date()): string {
  return new Date(now.getTime() + KL_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Days remaining in the month, counting the given day itself. */
export function daysLeftInMonth(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return daysInMonth(y, m) - d + 1;
}
