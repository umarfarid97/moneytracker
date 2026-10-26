import {
  addMonthsToDue, bnplFor, isPaidOff, loanBalance, loanProgress, NO_LOAN, nextPayment, paymentsLeft, totalOwed,
} from '@/domain/loanTracker';
import type { Commitment, Expense } from '@/domain/types';

const loan = (over: Partial<Commitment> = {}): Commitment => ({
  id: 1, name: 'PTPTN', amount: 20000, dayOfMonth: 28, kind: 'loan', active: true,
  categoryId: null, paymentMethodId: null, reliefId: null, autoRecord: false, startDate: '2026-09-01',
  lastAutoDue: null, variable: false, ...NO_LOAN,
  loanType: 'ptptn', loanBalance: 100000, loanBalanceDate: '2026-09-01', loanOriginal: 200000, ...over,
});
const pay = (id: number, due: string, amount: number, date = due, commitmentId = 1): Expense => ({
  id, amount, categoryId: 3, date, note: '', receiptUri: null, paymentMethodId: null, reliefId: null,
  reliefAmount: null, commitmentId, dueDate: due,
});

describe('loan balance', () => {
  test('each payment recorded since the balance was entered brings it down', () => {
    expect(loanBalance(loan(), [])).toBe(100000);
    expect(loanBalance(loan(), [pay(1, '2026-09-28', 20000), pay(2, '2026-10-28', 20000)])).toBe(60000);
  });

  test('payments before the balance date, or for other bills, do not count', () => {
    const c = loan({ loanBalanceDate: '2026-10-01' });
    expect(loanBalance(c, [pay(1, '2026-09-28', 20000), pay(2, '2026-10-28', 20000, '2026-10-28', 2)])).toBe(100000);
  });

  test('interest is taken out of each payment first', () => {
    // 12% a year is 1% a month: RM 1,000.00 owed, RM 100.00 paid, RM 10.00 of it interest.
    const c = loan({ loanBalance: 100000, loanRatePct: 12, amount: 10000 });
    expect(loanBalance(c, [pay(1, '2026-09-28', 10000)])).toBe(100000 - 9000);
  });

  test('never goes below zero and is null when no balance was entered', () => {
    expect(loanBalance(loan(), [pay(1, '2026-09-28', 999999)])).toBe(0);
    expect(isPaidOff(loan(), [pay(1, '2026-09-28', 999999)])).toBe(true);
    expect(loanBalance(loan({ ...NO_LOAN }), [])).toBeNull();
    expect(isPaidOff(loan({ ...NO_LOAN }), [])).toBe(false);
  });

  test('the last payment is only what is left', () => {
    expect(nextPayment(loan(), 100000)).toBe(20000);
    expect(nextPayment(loan(), 5000)).toBe(5000);
    expect(nextPayment(loan(), null)).toBe(20000);
  });
});

describe('payments left and payoff', () => {
  test('rounds up and handles interest', () => {
    expect(paymentsLeft(100000, 20000, null)).toBe(5);
    expect(paymentsLeft(100001, 20000, null)).toBe(6);
    expect(paymentsLeft(0, 20000, null)).toBe(0);
    expect(paymentsLeft(100000, 10000, 12)).toBe(11);
  });

  test('an instalment that does not cover the interest never pays it off', () => {
    expect(paymentsLeft(100000, 500, 12)).toBeNull();
  });

  test('due dates keep the day and use the last day of short months', () => {
    expect(addMonthsToDue('2026-10-31', 31, 4)).toBe('2027-02-28');
    expect(addMonthsToDue('2026-11-30', 31, 1)).toBe('2026-12-31');
    expect(addMonthsToDue('2026-12-15', 15, 1)).toBe('2027-01-15');
  });

  test('progress: fraction paid, payments left and the month of the last one', () => {
    const p = loanProgress(loan(), [pay(1, '2026-09-28', 20000)], '2026-10-28')!;
    expect(p).toMatchObject({ balance: 80000, left: 4, payoffDate: '2027-01-28', paidOff: false });
    expect(p.fraction).toBeCloseTo(0.6);
    expect(loanProgress(loan({ loanOriginal: null }), [], '2026-10-28')!.fraction).toBeNull();
    expect(loanProgress(loan({ ...NO_LOAN }), [], '2026-10-28')).toBeNull();
    expect(loanProgress(loan(), [pay(1, '2026-09-28', 100000)], '2026-10-28')).toMatchObject({ paidOff: true, left: 0, payoffDate: null });
  });

  test('total owed adds active loans only', () => {
    const list = [loan(), loan({ id: 2, loanBalance: 5000 }), loan({ id: 3, active: false }), loan({ id: 4, ...NO_LOAN })];
    expect(totalOwed(list, [])).toBe(105000);
  });
});

describe('pay later providers', () => {
  test('are found by name', () => {
    expect(bnplFor('Atome')?.id).toBe('atome');
    expect(bnplFor('SPayLater iPhone')?.id).toBe('spaylater');
    expect(bnplFor('Grab PayLater')?.id).toBe('grab');
    expect(bnplFor('Car loan')).toBeNull();
  });
});
