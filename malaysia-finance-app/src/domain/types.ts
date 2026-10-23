import type { Sen } from './money';

export type Category = { id: number; name: string; icon: string; sortOrder: number };
export type Expense = {
  id: number;
  amount: Sen;
  categoryId: number;
  date: string;
  note: string;
  receiptUri: string | null;
};
export type Budget = { categoryId: number; month: string; limit: Sen };
export type CommitmentKind = 'bill' | 'loan' | 'subscription';
export type Commitment = {
  id: number;
  name: string;
  amount: Sen;
  dayOfMonth: number;
  kind: CommitmentKind;
  active: boolean;
};
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
