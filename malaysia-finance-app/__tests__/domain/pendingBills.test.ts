import { NO_LOAN } from '@/domain/loanTracker';
import { pendingBills } from '@/domain/pendingBills';
import { balanceLeft } from '@/domain/balance';
import type { Commitment, Expense } from '@/domain/types';

const bill = (over: Partial<Commitment> = {}): Commitment => ({
  id: 1, name: 'Astro', amount: 8900, dayOfMonth: 30, kind: 'bill', active: true,
  categoryId: null, paymentMethodId: null, reliefId: null, autoRecord: false, startDate: '2026-10-01', lastAutoDue: null, variable: false, ...NO_LOAN, startsOn: null, endsOn: null,
  ...over,
});
const pending = (list: Commitment[], expenses: Expense[] = [], today = '2026-10-24', startDay = 1) =>
  pendingBills({ commitments: list, expenses, today, startDay });

describe('pendingBills', () => {
  test('lists unpaid bills due this period and overdue ones, oldest due date first', () => {
    const list = [bill({ id: 1, name: 'Soon', dayOfMonth: 30 }), bill({ id: 2, name: 'Late', dayOfMonth: 20 })];
    expect(pending(list).map((p) => [p.commitment.name, p.dueDate, p.overdue])).toEqual([
      ['Late', '2026-10-20', true], ['Soon', '2026-10-30', false],
    ]);
  });

  test('leaves out bills due in a later period, not started, paused or paid', () => {
    const list = [
      bill({ id: 1, name: 'Next month', dayOfMonth: 5, startDate: '2026-10-25' }),
      bill({ id: 2, name: 'Not started', startsOn: '2026-11-25', dayOfMonth: 25 }),
      bill({ id: 3, name: 'Paused', active: false }),
      bill({ id: 4, name: 'Paid', dayOfMonth: 30 }),
    ];
    const paid = [{ commitmentId: 4, dueDate: '2026-10-30', amount: 8900 } as Expense];
    expect(pending(list, paid)).toEqual([]);
  });

  test('payday periods decide what is "this period"', () => {
    const list = [bill({ dayOfMonth: 26 })];
    expect(pending(list, [], '2026-10-20', 25)).toEqual([]); // 26 Oct is next period
    expect(pending(list, [], '2026-10-25', 25)).toHaveLength(1);
  });

  test('pending bills are not spending: the balance only counts them as still to pay, and not twice once paid', () => {
    const profile = { grossMonthly: 500000, netMonthlyOverride: 400000, epfRate: 0.11, socsoMonthly: 0, eisMonthly: 0, budgetStartDay: 1, reminderDays: 1, pcbMonthly: 0 };
    const c = bill({ dayOfMonth: 30 });
    const base = { profile, commitments: [c], today: '2026-10-24' };
    const before = balanceLeft({ ...base, expenses: [] });
    expect(before).not.toBeNull();
    expect(before!.spent).toBe(0);
    expect(before!.upcoming).toBe(8900);
    const paid = { id: 1, amount: 8900, date: '2026-10-24', commitmentId: 1, dueDate: '2026-10-30' } as Expense;
    const after = balanceLeft({ ...base, expenses: [paid] });
    expect(after!.spent).toBe(8900);
    expect(after!.upcoming).toBe(0);
    expect(after!.afterBills).toBe(before!.afterBills);
    expect(pending([c], [paid])).toEqual([]);
  });
});
