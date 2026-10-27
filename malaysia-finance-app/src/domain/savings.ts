import type { Sen } from './money';

export type SavingsKind = 'tabung_haji' | 'asb' | 'hajj' | 'prs' | 'unit_trust' | 'other';

export type SavingsAccount = {
  id: number;
  name: string;
  kind: SavingsKind;
  /** What it is worth now. */
  balance: Sen;
  /** What you have put in, so gain = balance - invested. */
  invested: Sen;
  target: Sen | null;
  /** What you plan to add each month. */
  monthly: Sen | null;
  note: string;
};
export type NewSavingsAccount = Omit<SavingsAccount, 'id'>;

export const SAVINGS_KINDS: { kind: SavingsKind; label: string; icon: string; defaultName: string }[] = [
  { kind: 'tabung_haji', label: 'Tabung Haji', icon: 'moon', defaultName: 'Tabung Haji' },
  { kind: 'asb', label: 'ASB / ASNB', icon: 'trending-up', defaultName: 'ASB' },
  { kind: 'hajj', label: 'Hajj fund', icon: 'airplane', defaultName: 'Hajj fund' },
  { kind: 'prs', label: 'PRS', icon: 'umbrella', defaultName: 'PRS' },
  { kind: 'unit_trust', label: 'Unit trust', icon: 'pie-chart', defaultName: 'Unit trust' },
  { kind: 'other', label: 'Bank, cash or other', icon: 'wallet', defaultName: '' },
];

/** Part of the target reached, 0 to 1, or null when there is no target. */
export function progress(a: Pick<SavingsAccount, 'balance' | 'target'>): number | null {
  if (!a.target || a.target <= 0) return null;
  return Math.min(1, Math.max(0, a.balance / a.target));
}

export const gain = (a: Pick<SavingsAccount, 'balance' | 'invested'>): Sen => a.balance - a.invested;

/** Months to reach the target at the planned monthly amount (no growth assumed); null when it cannot be worked out. */
export function monthsToTarget(a: Pick<SavingsAccount, 'balance' | 'target' | 'monthly'>): number | null {
  if (!a.target || !a.monthly || a.monthly <= 0) return null;
  return Math.max(0, Math.ceil((a.target - a.balance) / a.monthly));
}

export function totals(accounts: SavingsAccount[]): { balance: Sen; invested: Sen; gain: Sen } {
  const balance = accounts.reduce((s, a) => s + a.balance, 0);
  const invested = accounts.reduce((s, a) => s + a.invested, 0);
  return { balance, invested, gain: balance - invested };
}
