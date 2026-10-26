import type { Sen } from './money';

export type Category = { id: number; name: string; icon: string; sortOrder: number };

export type PaymentKind = 'cash' | 'debit' | 'credit' | 'ewallet' | 'transfer';
export type PaymentMethod = { id: number; name: string; kind: PaymentKind; sortOrder: number };

export type Expense = {
  id: number;
  amount: Sen;
  categoryId: number;
  date: string;
  note: string;
  receiptUri: string | null;
  paymentMethodId: number | null;
  /** Tax relief this spending counts toward (see data/tax), or null. */
  reliefId: string | null;
  /** Part of `amount` that qualifies for the relief; null means all of it. */
  reliefAmount: Sen | null;
  /** SST (service tax) included in `amount`, as read from the receipt; null when unknown. */
  sst?: Sen | null;
  /** The bill this spending paid, with the due date it paid (both null for ordinary spending). */
  commitmentId: number | null;
  dueDate: string | null;
};

type ExpenseExtras = 'paymentMethodId' | 'reliefId' | 'reliefAmount' | 'commitmentId' | 'dueDate';
/** What callers pass when adding spending: the extras may be left out and become null. */
export type NewExpense = Omit<Expense, 'id' | ExpenseExtras> & Partial<Pick<Expense, ExpenseExtras>>;

export function withExpenseDefaults(input: NewExpense): Omit<Expense, 'id'> {
  return {
    paymentMethodId: null,
    reliefId: null,
    reliefAmount: null,
    sst: null,
    commitmentId: null,
    dueDate: null,
    ...input,
  };
}

export type Budget = { categoryId: number; month: string; limit: Sen };
export type CommitmentKind = 'bill' | 'loan' | 'subscription';

export type Commitment = {
  id: number;
  name: string;
  amount: Sen;
  dayOfMonth: number;
  kind: CommitmentKind;
  active: boolean;
  /** Defaults applied to the spending this bill records. */
  categoryId: number | null;
  paymentMethodId: number | null;
  reliefId: string | null;
  /** Record the spending automatically on the due date. */
  autoRecord: boolean;
  /** Day the bill was added: earlier due dates are never shown as overdue. */
  startDate: string | null;
  /** Latest due date auto-record has handled, so a deleted spending is not recreated. */
  lastAutoDue: string | null;
  /** The amount changes every month (e.g. electricity): `amount` is only an estimate. */
  variable: boolean;
};

type CommitmentExtras = 'categoryId' | 'paymentMethodId' | 'reliefId' | 'autoRecord' | 'startDate' | 'lastAutoDue' | 'variable';
export type NewCommitment = Omit<Commitment, 'id' | CommitmentExtras> & Partial<Pick<Commitment, CommitmentExtras>>;

export function withCommitmentDefaults(input: NewCommitment): Omit<Commitment, 'id'> {
  return {
    categoryId: null,
    paymentMethodId: null,
    reliefId: null,
    autoRecord: false,
    startDate: null,
    lastAutoDue: null,
    variable: false,
    ...input,
  };
}

export type ReliefClaim = {
  id: number;
  reliefId: string;
  year: number;
  amount: Sen;
  receiptUri: string | null;
  note: string;
};
export type Profile = {
  grossMonthly: Sen;
  netMonthlyOverride: Sen | null;
  epfRate: number;
  socsoMonthly: Sen;
  eisMonthly: Sen;
};
