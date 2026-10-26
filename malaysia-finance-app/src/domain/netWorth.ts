import { loanBalance } from './loanTracker';
import type { Sen } from './money';
import type { SavingsAccount } from './savings';
import type { Commitment, Expense } from './types';

export type NetWorthLine = { id: string; name: string; amount: Sen };

export type NetWorth = {
  assets: NetWorthLine[];
  liabilities: NetWorthLine[];
  totalAssets: Sen;
  totalLiabilities: Sen;
  net: Sen;
  /** Loans with no balance entered, which are left out of the figures. */
  untrackedLoans: number;
};

/**
 * What you own (EPF, savings and investments) less what you owe (tracked loans). Loans count only once a
 * balance has been entered, and paid-off loans are left out.
 */
export function buildNetWorth(i: {
  epfBalance: Sen;
  savings: SavingsAccount[];
  commitments: Commitment[];
  expenses: Expense[];
}): NetWorth {
  const assets: NetWorthLine[] = [
    ...(i.epfBalance !== 0 ? [{ id: 'epf', name: 'EPF', amount: i.epfBalance }] : []),
    ...i.savings.map((a) => ({ id: `savings-${a.id}`, name: a.name, amount: a.balance })),
  ];
  const liabilities: NetWorthLine[] = [];
  let untrackedLoans = 0;
  for (const c of i.commitments) {
    if (c.kind !== 'loan' || !c.active) continue;
    const balance = loanBalance(c, i.expenses);
    if (balance === null) untrackedLoans++;
    else if (balance > 0) liabilities.push({ id: `loan-${c.id}`, name: c.name, amount: balance });
  }
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.amount, 0);
  return { assets, liabilities, totalAssets, totalLiabilities, net: totalAssets - totalLiabilities, untrackedLoans };
}
