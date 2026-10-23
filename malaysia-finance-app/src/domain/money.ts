/** Integer sen (1 RM = 100 sen). Money is never stored or computed as a float. */
export type Sen = number;

/** Largest amount accepted from user input: RM 9,999,999,999.99. */
const MAX_SEN: Sen = 999_999_999_999;

/** Parse user text like "1,234.5" into sen. Returns null when invalid. */
export function parseRM(input: string): Sen | null {
  const text = input.trim().replace(/,/g, '');
  if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(text)) return null;
  const [whole = '', frac = ''] = text.split('.');
  const sen = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(sen) || sen > MAX_SEN) return null;
  return sen;
}

/** Format sen as "RM 1,234.50" (negatives as "-RM 60.00"). */
export function formatRM(sen: Sen): string {
  const negative = sen < 0;
  const abs = Math.abs(sen);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '-' : ''}RM ${whole}.${frac}`;
}

/** Convert a ringgit number to sen, rounding half up. */
export function rmToSen(rm: number): Sen {
  return Math.round((rm + Number.EPSILON) * 100);
}
