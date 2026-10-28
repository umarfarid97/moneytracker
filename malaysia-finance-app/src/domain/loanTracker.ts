import { matcher } from './brandMatch';
import { daysInMonth, monthKey, shiftMonth } from './dates';
import type { Sen } from './money';
import type { Commitment, Expense, LoanType } from './types';

/**
 * Loans and instalments that are tracked down to a remaining balance: PTPTN, car and home loans,
 * personal loans, and buy-now-pay-later plans. They are ordinary monthly commitments (kind 'loan') with a
 * few extra fields, so they get due dates, reminders, payments and backup the same way bills do.
 */
export type { LoanType };

export const LOAN_TYPES: LoanType[] = ['home', 'car', 'ptptn', 'personal', 'bnpl', 'installment'];

export type Bnpl = {
  id: string;
  name: string;
  initials: string;
  color: string;
  ink: string;
  aliases: string[];
};

/** Buy-now-pay-later providers, drawn like the banks and billers: brand-like colour plus initials. */
export const BNPL_PROVIDERS: Bnpl[] = [
  { id: 'atome', name: 'Atome', initials: 'At', color: '#d4f24a', ink: '#111111', aliases: ['atome pay later'] },
  { id: 'grab', name: 'Grab PayLater', initials: 'G', color: '#00b14f', ink: '#ffffff', aliases: ['grabpaylater', 'grab pay later', 'grab paylater'] },
  { id: 'spaylater', name: 'ShopeePayLater', initials: 'SP', color: '#ee4d2d', ink: '#ffffff', aliases: ['spaylater', 'shopee pay later', 'shopee paylater', 'spl'] },
];

export const bnplFor = matcher(BNPL_PROVIDERS);

/** Loan details held on a commitment. All fields are null on an ordinary bill. */
export type LoanFields = Pick<Commitment, 'loanType' | 'loanBalance' | 'loanBalanceDate' | 'loanOriginal' | 'loanRatePct' | 'loanStart'>;

const MAX_MONTHS = 1200;

/** Interest charged for one month on `balance` at `ratePct` a year, to the sen. */
const monthlyInterest = (balance: Sen, ratePct: number | null): Sen =>
  ratePct ? Math.round((balance * ratePct) / 1200) : 0;

/** Payments recorded against a loan since its balance was entered, oldest due date first. */
function paymentsSince(c: Commitment, expenses: Expense[]): Expense[] {
  if (c.loanBalanceDate === null) return [];
  return expenses
    .filter((e) => e.commitmentId === c.id && e.dueDate !== null && e.date >= c.loanBalanceDate!)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : a.id - b.id));
}

/**
 * What is still owed: the balance that was entered, less the part of each payment recorded since then
 * that was not interest. Null when the loan has no balance entered.
 */
export function loanBalance(c: Commitment, expenses: Expense[]): Sen | null {
  if (c.loanBalance === null || c.loanBalanceDate === null) return null;
  let balance = c.loanBalance;
  for (const p of paymentsSince(c, expenses)) {
    balance = Math.max(0, balance - Math.max(0, p.amount - monthlyInterest(balance, c.loanRatePct)));
  }
  return balance;
}

export const isPaidOff = (c: Commitment, expenses: Expense[]): boolean => loanBalance(c, expenses) === 0;

/** The next payment: the instalment, or less when that clears what is left. */
export function nextPayment(c: Commitment, balance: Sen | null): Sen {
  if (balance === null) return c.amount;
  return Math.min(c.amount, balance + monthlyInterest(balance, c.loanRatePct));
}

/** How many more payments of `payment` it takes to clear `balance`; null if they never would. */
export function paymentsLeft(balance: Sen, payment: Sen, ratePct: number | null): number | null {
  let left = balance;
  for (let n = 0; n < MAX_MONTHS; n++) {
    if (left <= 0) return n;
    const principal = payment - monthlyInterest(left, ratePct);
    if (principal <= 0) return null;
    left -= principal;
  }
  return null;
}

/** The due date `months` after `dueDate`, keeping the bill's day (short months use their last day). */
export function addMonthsToDue(dueDate: string, dayOfMonth: number, months: number): string {
  const key = shiftMonth(monthKey(dueDate), months);
  const [y, m] = key.split('-').map(Number);
  return `${key}-${String(Math.min(dayOfMonth, daysInMonth(y, m))).padStart(2, '0')}`;
}

export type LoanProgress = {
  balance: Sen;
  /** Share paid off, 0 to 1; null when the original amount is not known. */
  fraction: number | null;
  /** Payments still to make; null when the instalment never clears the balance. */
  left: number | null;
  /** Due date of the last payment; null with `left`. */
  payoffDate: string | null;
  paidOff: boolean;
};

/** Where a loan stands. `nextDue` is the due date of the next payment still to make. Null for ordinary bills. */
export function loanProgress(c: Commitment, expenses: Expense[], nextDue: string): LoanProgress | null {
  const balance = loanBalance(c, expenses);
  if (balance === null) return null;
  const left = paymentsLeft(balance, c.amount, c.loanRatePct);
  return {
    balance,
    fraction: c.loanOriginal && c.loanOriginal > 0 ? Math.min(1, Math.max(0, 1 - balance / c.loanOriginal)) : null,
    left,
    payoffDate: left === null ? null : left === 0 ? null : addMonthsToDue(nextDue, c.dayOfMonth, left - 1),
    paidOff: balance === 0,
  };
}

/** Everything still owed on active loans that have a balance. */
export function totalOwed(list: Commitment[], expenses: Expense[]): Sen {
  return list.reduce((sum, c) => (c.active ? sum + (loanBalance(c, expenses) ?? 0) : sum), 0);
}

/** Monthly total that leaves out loans that are paid off. */
export function activeMonthly(list: Commitment[], expenses: Expense[], amountOf: (c: Commitment) => Sen): Sen {
  return list.reduce((sum, c) => (c.active && !isPaidOff(c, expenses) ? sum + amountOf(c) : sum), 0);
}

export const NO_LOAN: LoanFields = {
  loanType: null, loanBalance: null, loanBalanceDate: null, loanOriginal: null, loanRatePct: null, loanStart: null,
};

/** The due date of the instalment that falls in `today`'s month, keeping the loan's due day. */
export function dueThisMonth(dayOfMonth: number, today: string): string {
  return addMonthsToDue(today, dayOfMonth, 0);
}

/** Which instalment `today`'s month holds, counting the one on `loanStart` as number 1; null when not known or not started yet. */
export function instalmentNumber(c: Pick<Commitment, 'loanStart'>, today: string): number | null {
  if (c.loanStart === null) return null;
  const [sy, sm] = c.loanStart.split('-').map(Number);
  const [ty, tm] = today.split('-').map(Number);
  const n = (ty - sy) * 12 + (tm - sm) + 1;
  return n >= 1 ? n : null;
}

/** The first instalment's date when the loan is on instalment `n` this month. */
export function startFromCycle(n: number, dayOfMonth: number, today: string): string {
  return addMonthsToDue(dueThisMonth(dayOfMonth, today), dayOfMonth, -(n - 1));
}

