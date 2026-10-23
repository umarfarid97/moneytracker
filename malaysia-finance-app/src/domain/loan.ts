import { parsePercent, type Sen } from './money';

export type LoanKind = 'home' | 'car' | 'personal';
export type LoanMethod = 'reducing' | 'flat';
export type Verdict = 'comfortable' | 'tight' | 'not-suitable';

export const LOAN_DEFAULTS: Record<LoanKind, { ratePct: number; maxYears: number; method: LoanMethod }> = {
  home: { ratePct: 4.5, maxYears: 35, method: 'reducing' },
  car: { ratePct: 3.0, maxYears: 9, method: 'flat' },
  personal: { ratePct: 8.0, maxYears: 10, method: 'reducing' },
};

/** Share of net income all instalments may take (typical bank range 60-70%). */
export const DSR_LIMIT = 0.65;
/** Share below which a loan counts as comfortable. */
export const COMFORT_LIMIT = 0.5;

// Integer percentages keep the ratio maths free of float error.
const DSR_PCT = Math.round(DSR_LIMIT * 100);
const COMFORT_PCT = Math.round(COMFORT_LIMIT * 100);

const clampMonths = (months: number) => Math.max(1, Math.floor(months));

/** Annuity factor: instalment = principal * factor, for the reducing-balance method. */
function reducingFactor(ratePct: number, months: number): number {
  const r = ratePct / 100 / 12;
  if (r === 0) return 1 / months;
  return r / (1 - Math.pow(1 + r, -months));
}

/** Flat-rate factor: interest is charged on the original principal for the whole term. */
function flatFactor(ratePct: number, months: number): number {
  return (1 + (ratePct / 100) * (months / 12)) / months;
}

const factor = (method: LoanMethod, ratePct: number, months: number) =>
  method === 'flat' ? flatFactor(ratePct, months) : reducingFactor(ratePct, months);

export function monthlyInstalment(principal: Sen, ratePct: number, months: number, method: LoanMethod): Sen {
  if (principal <= 0) return 0;
  return Math.round(principal * factor(method, ratePct, clampMonths(months)));
}

/** Largest principal whose instalment does not exceed `instalment` (rounded down to a sen). */
export function maxPrincipal(instalment: Sen, ratePct: number, months: number, method: LoanMethod): Sen {
  if (instalment <= 0) return 0;
  return Math.floor(instalment / factor(method, ratePct, clampMonths(months)));
}

export type LoanAssessment = {
  maxInstalment: Sen;
  comfortableInstalment: Sen;
  maxPrincipal: Sen;
  comfortablePrincipal: Sen;
  verdict?: Verdict;
};

export function assessLoan(i: {
  netMonthly: Sen;
  commitments: Sen;
  kind: LoanKind;
  ratePct: number;
  months: number;
  method: LoanMethod;
  requestedPrincipal?: Sen;
}): LoanAssessment {
  const net = Math.max(0, i.netMonthly);
  const maxInstalment = Math.max(0, Math.floor((net * DSR_PCT) / 100) - i.commitments);
  const comfortableInstalment = Math.max(0, Math.floor((net * COMFORT_PCT) / 100) - i.commitments);
  const result: LoanAssessment = {
    maxInstalment,
    comfortableInstalment,
    maxPrincipal: maxPrincipal(maxInstalment, i.ratePct, i.months, i.method),
    comfortablePrincipal: maxPrincipal(comfortableInstalment, i.ratePct, i.months, i.method),
  };
  // Nothing is left to borrow once commitments use up the limit, whether or not an amount was typed.
  if (i.requestedPrincipal === undefined && maxInstalment === 0) result.verdict = 'not-suitable';
  if (i.requestedPrincipal !== undefined) {
    const total = i.commitments + monthlyInstalment(i.requestedPrincipal, i.ratePct, i.months, i.method);
    if (net === 0 || total * 100 > net * DSR_PCT) result.verdict = 'not-suitable';
    else if (total * 100 > net * COMFORT_PCT) result.verdict = 'tight';
    else result.verdict = 'comfortable';
  }
  return result;
}

/** Interest rate typed by the user: 0 to 30 with up to two decimals, as a percentage a year. */
export function parseRatePct(text: string): number | null {
  return parsePercent(text, 30);
}

/** Loan term typed by the user: a whole number of years from 1 to `maxYears`. */
export function parseYears(text: string, maxYears: number): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const years = Number(trimmed);
  return years >= 1 && years <= maxYears ? years : null;
}
