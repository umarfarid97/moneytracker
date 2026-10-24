import { billStatus, missedDueDates, paidDueDatesFor, previousDueDate } from '@/domain/bills';
import type { Commitment, Expense } from '@/domain/types';

const bill = (over: Partial<Commitment> = {}): Commitment => ({
  id: 1, name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true,
  categoryId: null, paymentMethodId: null, reliefId: null, autoRecord: false, startDate: '2026-01-01', lastAutoDue: null,
  ...over,
});

describe('previousDueDate', () => {
  test('is the latest due date on or before today', () => {
    expect(previousDueDate(5, '2026-10-24')).toBe('2026-10-05');
    expect(previousDueDate(24, '2026-10-24')).toBe('2026-10-24');
    expect(previousDueDate(25, '2026-10-24')).toBe('2026-09-25');
  });
  test('short months use their last day and years roll over', () => {
    expect(previousDueDate(31, '2026-11-10')).toBe('2026-10-31');
    expect(previousDueDate(31, '2026-11-30')).toBe('2026-11-30');
    expect(previousDueDate(30, '2027-03-02')).toBe('2027-02-28');
    expect(previousDueDate(20, '2027-01-05')).toBe('2026-12-20');
  });
});

describe('billStatus', () => {
  const status = (c: Commitment, today: string, paid: string[] = []) => billStatus({ commitment: c, today, paidDueDates: paid });

  test('due today when today is the due date and nothing is recorded', () => {
    expect(status(bill(), '2026-10-05')).toEqual({ state: 'due', dueDate: '2026-10-05', days: 0 });
  });

  test('overdue, with how many days late, when the due date passed unpaid', () => {
    expect(status(bill(), '2026-10-08')).toEqual({ state: 'overdue', dueDate: '2026-10-05', days: 3 });
  });

  test('upcoming when the latest due date is paid and the next is ahead', () => {
    // paid on the 5th, today the 20th: shown as paid for this cycle
    expect(status(bill(), '2026-10-20', ['2026-10-05'])).toEqual({ state: 'paid', dueDate: '2026-11-05', days: 16 });
  });

  test('upcoming (not paid) when last month was paid and a new month has not started its due date', () => {
    expect(status(bill(), '2026-11-02', ['2026-10-05'])).toEqual({ state: 'upcoming', dueDate: '2026-11-05', days: 3 });
  });

  test('paid early: the next due date already has its spending', () => {
    expect(status(bill(), '2026-11-02', ['2026-10-05', '2026-11-05'])).toEqual({ state: 'paid', dueDate: '2026-11-05', days: 3 });
  });

  test('due today and already paid is paid, pointing at the next due date', () => {
    expect(status(bill(), '2026-10-05', ['2026-10-05'])).toEqual({ state: 'paid', dueDate: '2026-11-05', days: 31 });
  });

  test('a bill added after its due date this month is not overdue', () => {
    expect(status(bill({ startDate: '2026-10-20' }), '2026-10-24')).toEqual({ state: 'upcoming', dueDate: '2026-11-05', days: 12 });
  });

  test('a bill added on its due date is due today', () => {
    expect(status(bill({ startDate: '2026-10-05' }), '2026-10-05')).toEqual({ state: 'due', dueDate: '2026-10-05', days: 0 });
  });

  test('paused bills show their next date and are never due or overdue', () => {
    expect(status(bill({ active: false }), '2026-10-08')).toEqual({ state: 'paused', dueDate: '2026-11-05', days: 28 });
  });

  test('day 31 in a short month is due on the last day', () => {
    expect(status(bill({ dayOfMonth: 31 }), '2026-11-30')).toEqual({ state: 'due', dueDate: '2026-11-30', days: 0 });
  });

  test('a bill with no start date is never shown as due or overdue, only upcoming', () => {
    expect(status(bill({ startDate: null }), '2026-10-08')).toEqual({ state: 'upcoming', dueDate: '2026-11-05', days: 28 });
    expect(status(bill({ startDate: null }), '2026-10-05').state).toBe('upcoming');
  });
});

describe('paidDueDatesFor', () => {
  const e = (over: Partial<Expense>): Expense => ({
    id: 1, amount: 1, categoryId: 1, date: '2026-10-05', note: '', receiptUri: null, paymentMethodId: null,
    reliefId: null, reliefAmount: null, commitmentId: null, dueDate: null, ...over,
  });
  test('lists the due dates already recorded for one bill only', () => {
    const list = [
      e({ id: 1, commitmentId: 1, dueDate: '2026-10-05' }),
      e({ id: 2, commitmentId: 2, dueDate: '2026-10-05' }),
      e({ id: 3, commitmentId: 1, dueDate: '2026-09-05' }),
      e({ id: 4 }),
    ];
    expect(paidDueDatesFor(1, list).sort()).toEqual(['2026-09-05', '2026-10-05']);
  });
});

describe('missedDueDates (what auto-record still has to record)', () => {
  const auto = (over: Partial<Commitment> = {}) => bill({ autoRecord: true, ...over });

  test('every due date from the day the bill was added up to today, oldest first', () => {
    expect(missedDueDates(auto({ startDate: '2026-08-05' }), '2026-10-24')).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
  });

  test('only the ones after the last due date already handled', () => {
    expect(missedDueDates(auto({ startDate: '2026-08-05', lastAutoDue: '2026-09-05' }), '2026-10-24')).toEqual(['2026-10-05']);
    expect(missedDueDates(auto({ startDate: '2026-08-05', lastAutoDue: '2026-10-05' }), '2026-10-24')).toEqual([]);
  });

  test('nothing before the bill was added, nothing in the future', () => {
    expect(missedDueDates(auto({ startDate: '2026-10-20' }), '2026-10-24')).toEqual([]);
    expect(missedDueDates(auto({ startDate: '2026-10-05' }), '2026-10-05')).toEqual(['2026-10-05']);
  });

  test('is capped at a year so an old bill cannot flood the list', () => {
    expect(missedDueDates(auto({ startDate: '2020-01-01' }), '2026-10-24')).toHaveLength(12);
  });

  test('a bill with no start date has nothing to catch up on', () => {
    expect(missedDueDates(auto({ startDate: null }), '2026-10-24')).toEqual([]);
  });

  test('uses the last day of short months', () => {
    expect(missedDueDates(auto({ dayOfMonth: 31, startDate: '2026-09-01' }), '2026-11-30')).toEqual(['2026-09-30', '2026-10-31', '2026-11-30']);
  });
});
