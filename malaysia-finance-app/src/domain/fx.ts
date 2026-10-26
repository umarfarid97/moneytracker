import type { Sen } from './money';

/** Currencies offered for overseas spending. `minor` is the digits after the point (JPY and IDR have none in daily use). */
export const CURRENCIES = [
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'USD', name: 'US dollar' },
  { code: 'THB', name: 'Thai baht' },
  { code: 'IDR', name: 'Indonesian rupiah' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Pound sterling' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'VND', name: 'Vietnamese dong' },
  { code: 'SAR', name: 'Saudi riyal' },
] as const;

export const HOME_CURRENCY = 'MYR';
export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

/** Ringgit per 1 unit of a foreign currency, as typed (up to 6 decimals). Null when empty, zero or invalid. */
export function parseRate(text: string): number | null {
  const trimmed = text.trim();
  if (!/^(\d+\.?\d{0,6}|\.\d{1,6})$/.test(trimmed)) return null;
  const rate = Number(trimmed);
  return rate > 0 ? rate : null;
}

/** A foreign amount (in its smallest unit, like sen) turned into ringgit sen at `rate` ringgit per unit. */
export function toMyr(foreign: Sen, rate: number): Sen {
  return Math.round(foreign * rate);
}

/** Rate text for an input box: no trailing zeros, at least 2 digits that matter for small rates (IDR, VND). */
export function rateToInput(rate: number): string {
  const digits = rate >= 1 ? 4 : rate >= 0.01 ? 5 : 6;
  return String(Number(rate.toFixed(digits)));
}

export type Rates = {
  /** Ringgit per 1 unit of each currency. */
  perUnit: Record<string, number>;
  /** When the rates were fetched (ms). */
  fetchedAt: number;
};

/** Turns the answer of the rate service (units of currency per RM 1) into ringgit per unit. */
export function ratesFromResponse(json: unknown, now: number): Rates | null {
  const body = json as { result?: string; rates?: Record<string, unknown> } | null;
  if (!body || body.result === 'error' || !body.rates || typeof body.rates !== 'object') return null;
  const perUnit: Record<string, number> = {};
  for (const { code } of CURRENCIES) {
    const perRinggit = body.rates[code];
    if (typeof perRinggit === 'number' && perRinggit > 0) perUnit[code] = 1 / perRinggit;
  }
  return Object.keys(perUnit).length > 0 ? { perUnit, fetchedAt: now } : null;
}

/** Rates are refreshed when older than this. */
export const RATE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
