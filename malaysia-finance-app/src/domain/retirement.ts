import type { Sen } from './money';

export type RetirementScheme = 'epf' | 'socso' | 'eis';
export type RetirementKind = 'contribution' | 'dividend' | 'withdrawal' | 'opening';

/**
 * One line of an EPF (KWSP), SOCSO (PERKESO) or EIS record. `amount` is the whole figure; for a
 * contribution `employerShare` is the part the employer paid, so the employee part is the rest.
 */
export type RetirementEntry = {
  id: number;
  scheme: RetirementScheme;
  kind: RetirementKind;
  date: string;
  amount: Sen;
  employerShare: Sen;
  note: string;
};
export type NewRetirementEntry = Omit<RetirementEntry, 'id'>;

export const employeeShare = (e: RetirementEntry) => e.amount - e.employerShare;

const yearOf = (date: string) => Number(date.slice(0, 4));
const sum = (list: RetirementEntry[], pick: (e: RetirementEntry) => number) => list.reduce((s, e) => s + pick(e), 0);

/** Newest first; within a day the higher id first. */
export const byDateDesc = (a: RetirementEntry, b: RetirementEntry) =>
  a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1;

export type EpfSummary = {
  /** Opening balance + contributions + dividends - withdrawals. */
  balance: Sen;
  contributed: Sen;
  dividends: Sen;
  withdrawn: Sen;
  /** The same figures for one calendar year. */
  year: { employee: Sen; employer: Sen; dividends: Sen };
};

export function summariseEpf(entries: RetirementEntry[], year: number): EpfSummary {
  const epf = entries.filter((e) => e.scheme === 'epf');
  const of = (kind: RetirementKind) => epf.filter((e) => e.kind === kind);
  const inYear = of('contribution').filter((e) => yearOf(e.date) === year);
  const contributed = sum(of('contribution'), (e) => e.amount);
  const dividends = sum(of('dividend'), (e) => e.amount);
  const withdrawn = sum(of('withdrawal'), (e) => e.amount);
  return {
    balance: sum(of('opening'), (e) => e.amount) + contributed + dividends - withdrawn,
    contributed,
    dividends,
    withdrawn,
    year: {
      employee: sum(inYear, employeeShare),
      employer: sum(inYear, (e) => e.employerShare),
      dividends: sum(of('dividend').filter((e) => yearOf(e.date) === year), (e) => e.amount),
    },
  };
}

/** EPF rates for an employee under 60: 11% from the employee, and 13% (wage up to RM5,000) or 12% from the employer. */
export const EMPLOYEE_EPF_RATE = 0.11;
export const employerEpfRate = (monthlyWage: Sen) => (monthlyWage <= 500_000 ? 0.13 : 0.12);

/** Whole-ringgit contribution on a wage, as EPF rounds it up to the next ringgit. */
const roundUpRinggit = (sen: number) => Math.ceil(sen / 100 - 1e-9) * 100;

export function suggestedEpf(monthlyWage: Sen, employeeRate: number = EMPLOYEE_EPF_RATE): { employee: Sen; employer: Sen } {
  if (monthlyWage <= 0) return { employee: 0, employer: 0 };
  return {
    employee: roundUpRinggit(monthlyWage * employeeRate),
    employer: roundUpRinggit(monthlyWage * employerEpfRate(monthlyWage)),
  };
}

export type SocsoSummary = {
  socso: { employee: Sen; employer: Sen; months: number };
  eis: { employee: Sen; employer: Sen; months: number };
  /** Employee SOCSO and EIS paid in the year, which count toward the SOCSO tax relief. */
  yearEmployee: Sen;
};

export function summariseSocso(entries: RetirementEntry[], year: number): SocsoSummary {
  const part = (scheme: 'socso' | 'eis') => {
    const list = entries.filter((e) => e.scheme === scheme && e.kind === 'contribution');
    return {
      employee: sum(list, employeeShare),
      employer: sum(list, (e) => e.employerShare),
      months: new Set(list.map((e) => e.date.slice(0, 7))).size,
    };
  };
  const yearEmployee = sum(
    entries.filter((e) => e.scheme !== 'epf' && e.kind === 'contribution' && yearOf(e.date) === year),
    employeeShare,
  );
  return { socso: part('socso'), eis: part('eis'), yearEmployee };
}

export type Projection = {
  /** Balance at retirement. */
  atRetirement: Sen;
  /** What is added from your own and your employer's contributions. */
  contributions: Sen;
  /** What the dividends add. */
  growth: Sen;
  /** Spread evenly over `payoutYears` with no further growth. */
  monthlyIncome: Sen;
};

export const RETIREMENT_PAYOUT_YEARS = 20;

/** Grows a balance month by month with a yearly dividend rate (%) and a fixed monthly contribution. */
export function projectRetirement(input: {
  balance: Sen;
  monthly: Sen;
  years: number;
  dividendPct: number;
}): Projection {
  const months = Math.max(0, Math.round(input.years * 12));
  const rate = Math.max(0, input.dividendPct) / 100 / 12;
  let balance = Math.max(0, input.balance);
  for (let i = 0; i < months; i++) balance = balance * (1 + rate) + Math.max(0, input.monthly);
  const atRetirement = Math.round(balance);
  const contributions = Math.max(0, input.monthly) * months;
  return {
    atRetirement,
    contributions,
    growth: Math.max(0, atRetirement - Math.max(0, input.balance) - contributions),
    monthlyIncome: Math.round(atRetirement / (RETIREMENT_PAYOUT_YEARS * 12)),
  };
}
