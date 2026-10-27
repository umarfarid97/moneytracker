import { balanceLeft } from '@/domain/balance';
import type { Commitment, Expense, Profile } from '@/domain/types';

const profile: Profile = {
  grossMonthly: 600000, netMonthlyOverride: 500000, epfRate: 0.11, socsoMonthly: 0, eisMonthly: 0, budgetStartDay: 1, reminderDays: 1, pcbMonthly: 0,
};
const spend = (amount: number, date: string, extra: Partial<Expense> = {}): Expense => ({
  id: 1, amount, categoryId: 1, date, note: '', receiptUri: null, paymentMethodId: null, reliefId: null,
  reliefAmount: null, commitmentId: null, dueDate: null, ...extra,
});
const bill = (extra: Partial<Commitment> = {}): Commitment => ({
  id: 7, name: 'Rent', amount: 100000, dayOfMonth: 28, kind: 'bill', active: true, categoryId: null,
  paymentMethodId: null, reliefId: null, autoRecord: false, startDate: '2026-01-01', lastAutoDue: null,
  variable: false, loanType: null, loanBalance: null, loanBalanceDate: null, loanOriginal: null, loanRatePct: null,
  ...extra,
});

describe('balanceLeft', () => {
  test('adds extra income received in the period to the take-home pay', () => {
    const r = balanceLeft({
      profile,
      expenses: [spend(30000, '2026-10-03')],
      commitments: [],
      today: '2026-10-24',
      extraIncome: [
        { id: 1, name: 'Rent', amount: 120000, date: '2026-10-05' },
        { id: 2, name: 'Old', amount: 99999, date: '2026-09-30' },
      ],
    })!;
    expect(r).toMatchObject({ income: 620000, extra: 120000, left: 590000 });
  });

  test('extra income alone is enough to show a balance', () => {
    const empty = { ...profile, grossMonthly: 0, netMonthlyOverride: null };
    const r = balanceLeft({ profile: empty, expenses: [], commitments: [], today: '2026-10-24', extraIncome: [{ id: 1, name: 'Gig', amount: 50000, date: '2026-10-02' }] });
    expect(r?.left).toBe(50000);
  });

  test('is null without a salary', () => {
    const empty = { ...profile, grossMonthly: 0, netMonthlyOverride: null };
    expect(balanceLeft({ profile: empty, expenses: [], commitments: [], today: '2026-10-24' })).toBeNull();
  });

  test('takes spending of this period off the take-home pay', () => {
    const r = balanceLeft({
      profile,
      expenses: [spend(30000, '2026-10-03'), spend(20000, '2026-09-30')],
      commitments: [],
      today: '2026-10-24',
    })!;
    expect(r).toMatchObject({ income: 500000, spent: 30000, left: 470000, upcoming: 0 });
  });

  test('counts unpaid bills still due in the period, not paid or paused ones', () => {
    const paid = spend(100000, '2026-10-28', { commitmentId: 8, dueDate: '2026-10-28' });
    const r = balanceLeft({
      profile,
      expenses: [paid],
      commitments: [bill(), bill({ id: 8 }), bill({ id: 9, active: false })],
      today: '2026-10-24',
    })!;
    expect(r.upcoming).toBe(100000);
    expect(r.afterBills).toBe(r.left - 100000);
  });

  test('follows the payday period', () => {
    const r = balanceLeft({
      profile: { ...profile, budgetStartDay: 25 },
      expenses: [spend(40000, '2026-10-26'), spend(90000, '2026-10-10')],
      commitments: [],
      today: '2026-10-27',
    })!;
    expect(r.spent).toBe(40000);
  });
});
