import { billStatus, paidDueDatesFor, payMode } from './bills';
import { loanProgress } from './loanTracker';
import type { Commitment, Expense } from './types';

export type PendingBill = { commitment: Commitment; dueDate: string; overdue: boolean };

/**
 * Bills and loan instalments that are due in the current budget period (or overdue) and not paid yet.
 * The Spending list shows them as pending entries; they are not spending, so no total counts them.
 * Overdue first, then by due date.
 */
export function pendingBills(i: { commitments: Commitment[]; expenses: Expense[]; today: string; startDay: number }): PendingBill[] {
  const out: PendingBill[] = [];
  for (const c of i.commitments) {
    if (c.id <= 0 || !c.active) continue;
    const status = billStatus({ commitment: c, today: i.today, paidDueDates: paidDueDatesFor(c.id, i.expenses) });
    if (payMode({ commitment: c, status, today: i.today, startDay: i.startDay }) !== 'now') continue;
    if (loanProgress(c, i.expenses, status.dueDate)?.paidOff) continue;
    out.push({ commitment: c, dueDate: status.dueDate, overdue: status.state === 'overdue' });
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.commitment.name.localeCompare(b.commitment.name));
}
