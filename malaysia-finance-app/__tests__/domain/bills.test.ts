import { NO_LOAN } from '@/domain/loanTracker';
import { applyBillChange, billEstimate, billStatus, clampPaymentDate, payMode, lastPaidFor, missedDueDates, paidDueDatesFor, previousDueDate } from '@/domain/bills';
import type { Commitment, Expense } from '@/domain/types';

const bill = (over: Partial<Commitment> = {}): Commitment => ({
  id: 1, name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true,
  categoryId: null, paymentMethodId: null, reliefId: null, autoRecord: false, startDate: '2026-01-01', lastAutoDue: null, variable: false, ...NO_LOAN, startsOn: null, endsOn: null,
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

describe('applyBillChange (review findings: edits must not invent payments)', () => {
  const old = bill({ autoRecord: true, startDate: '2026-01-02', lastAutoDue: '2026-07-05', active: false });
  const today = '2026-10-24';

  test('resuming a paused bill starts its schedule today, so the paused months are not recorded', () => {
    const next = applyBillChange(old, { ...old, active: true }, today);
    expect(next).toMatchObject({ active: true, startDate: '2026-10-24', lastAutoDue: null });
    expect(missedDueDates(next, today)).toEqual([]);
  });

  test('changing the day of month starts the schedule today, so a paid month is not due again', () => {
    const paid = bill({ autoRecord: true, startDate: '2026-01-02', lastAutoDue: '2026-10-05', dayOfMonth: 5 });
    const next = applyBillChange(paid, { ...paid, dayOfMonth: 20 }, today);
    expect(next).toMatchObject({ dayOfMonth: 20, startDate: '2026-10-24', lastAutoDue: null });
    expect(missedDueDates(next, today)).toEqual([]);
    expect(billStatus({ commitment: next, today, paidDueDates: [] })).toEqual({ state: 'upcoming', dueDate: '2026-11-20', days: 27 });
  });

  test('switching automatic recording on does not back-fill earlier months', () => {
    const manual = bill({ autoRecord: false, startDate: '2026-01-02', lastAutoDue: null });
    const next = applyBillChange(manual, { ...manual, autoRecord: true }, today);
    expect(next.lastAutoDue).toBe('2026-10-05');
    expect(missedDueDates(next, today)).toEqual([]);
  });

  test('ordinary edits and new bills are left alone', () => {
    const live = bill({ autoRecord: true, startDate: '2026-01-02', lastAutoDue: '2026-10-05' });
    expect(applyBillChange(live, { ...live, name: 'Astro Go', amount: 9900 }, today)).toEqual({ ...live, name: 'Astro Go', amount: 9900 });
    const added = bill({ autoRecord: true, startDate: today });
    expect(applyBillChange(null, added, today)).toEqual(added);
  });
});

describe('billEstimate', () => {
  const paid = (amount: number, dueDate: string, commitmentId = 1): Expense => ({
    id: amount, amount, categoryId: 3, date: dueDate, note: '', receiptUri: null,
    paymentMethodId: null, reliefId: null, reliefAmount: null, commitmentId, dueDate,
  });
  const expenses = [paid(12000, '2026-08-05'), paid(14000, '2026-09-05'), paid(99900, '2026-10-05', 2)];

  test('a fixed bill is always its amount', () => {
    expect(billEstimate(bill(), expenses)).toBe(8900);
  });

  test('a variable bill uses the latest payment, or its estimate before the first one', () => {
    expect(lastPaidFor(1, expenses)).toBe(14000);
    expect(billEstimate(bill({ variable: true }), expenses)).toBe(14000);
    expect(billEstimate(bill({ variable: true }), [])).toBe(8900);
    expect(lastPaidFor(1, [])).toBeNull();
  });
});


describe('bill start and end dates', () => {
  const status = (c: Commitment, today: string, paid: string[] = []) => billStatus({ commitment: c, today, paidDueDates: paid });

  test('before the start date the first due date is the first one on or after it, and nothing is overdue', () => {
    const c = bill({ dayOfMonth: 5, startDate: '2026-01-01', startsOn: '2026-12-10' });
    expect(status(c, '2026-10-24')).toEqual({ state: 'upcoming', dueDate: '2027-01-05', days: 73 });
  });

  test('a start date exactly on a due date makes that day the first due date', () => {
    const c = bill({ dayOfMonth: 5, startDate: '2026-01-01', startsOn: '2026-12-05' });
    expect(status(c, '2026-12-04').dueDate).toBe('2026-12-05');
    expect(status(c, '2026-12-05')).toMatchObject({ state: 'due', dueDate: '2026-12-05' });
  });

  test('after the end date the bill is ended, not due or overdue', () => {
    const c = bill({ dayOfMonth: 5, endsOn: '2026-12-25' });
    expect(status(c, '2027-02-01', ['2026-12-05']).state).toBe('ended');
    expect(status(c, '2026-12-26', ['2026-12-05']).state).toBe('ended');
  });

  test('the last due date before the end date is still due, then overdue, until it is paid', () => {
    const c = bill({ dayOfMonth: 20, endsOn: '2026-12-25' });
    expect(status(c, '2026-12-20')).toMatchObject({ state: 'due', dueDate: '2026-12-20' });
    expect(status(c, '2027-02-01')).toMatchObject({ state: 'overdue', dueDate: '2026-12-20' });
  });

  test('the due date on the end date itself still counts; one day later it does not', () => {
    const c = bill({ dayOfMonth: 25, endsOn: '2026-12-25' });
    expect(status(c, '2026-12-01', ['2026-11-25']).dueDate).toBe('2026-12-25');
    expect(status(bill({ dayOfMonth: 25, endsOn: '2026-12-24' }), '2026-12-01', ['2026-11-25']).state).toBe('ended');
  });

  test('auto-record never reaches before the start date or past the end date', () => {
    const auto = bill({ autoRecord: true, dayOfMonth: 5, startDate: '2026-01-01', startsOn: '2026-09-10', endsOn: '2026-11-30' });
    expect(missedDueDates(auto, '2026-10-24')).toEqual(['2026-10-05']);
    expect(missedDueDates(auto, '2027-03-01')).toEqual(['2026-10-05', '2026-11-05']);
  });
});

describe('payMode', () => {
  const mode = (c: Commitment, today: string, paid: string[] = [], startDay = 1) =>
    payMode({ commitment: c, status: billStatus({ commitment: c, today, paidDueDates: paid }), today, startDay });

  test('due today and overdue can be marked paid', () => {
    expect(mode(bill(), '2026-10-05')).toBe('now');
    expect(mode(bill(), '2026-10-08')).toBe('now');
  });

  test('due later in the same period can be marked paid', () => {
    expect(mode(bill({ dayOfMonth: 30 }), '2026-10-24', ['2026-09-30'])).toBe('now');
  });

  test('due in the next period waits', () => {
    expect(mode(bill({ dayOfMonth: 5 }), '2026-10-24', ['2026-10-05'])).toBe('none'); // already paid this cycle
    expect(mode(bill({ dayOfMonth: 5, startDate: '2026-10-25' }), '2026-10-27')).toBe('wait');
  });

  test('a bill that has not started yet only waits', () => {
    expect(mode(bill({ startsOn: '2026-11-25', dayOfMonth: 25 }), '2026-10-27')).toBe('wait');
    // even when it starts later this period
    expect(mode(bill({ startsOn: '2026-10-28', dayOfMonth: 28 }), '2026-10-24')).toBe('wait');
  });

  test('a bill two periods away waits', () => {
    expect(mode(bill({ startsOn: '2026-12-10', dayOfMonth: 10 }), '2026-10-27')).toBe('wait');
  });

  test('period boundary: the last day of the period vs the first of the next', () => {
    const c = bill({ dayOfMonth: 1, startDate: '2026-01-01' });
    // due 1 Nov, today 31 Oct: next period
    expect(mode(c, '2026-10-31', ['2026-10-01'])).toBe('none');
    expect(mode(bill({ dayOfMonth: 1, startDate: '2026-10-15' }), '2026-10-31')).toBe('wait');
    // on the 1st it is due today
    expect(mode(c, '2026-11-01', ['2026-10-01'])).toBe('now');
  });

  test('payday periods: a bill due after payday is next period', () => {
    // period starts on the 25th: today 20 Oct is in the period that started 25 Sep and ends 24 Oct
    const c = bill({ dayOfMonth: 26, startDate: '2026-10-01' });
    expect(mode(c, '2026-10-20', ['2026-09-26'], 25)).toBe('wait'); // due 26 Oct = next period
    expect(mode(bill({ dayOfMonth: 22, startDate: '2026-10-01' }), '2026-10-20', ['2026-09-22'], 25)).toBe('now'); // due 22 Oct = this period
    // on payday itself the 26th is in the current period
    expect(mode(c, '2026-10-25', ['2026-09-26'], 25)).toBe('now');
  });

  test('paused, ended and paid bills offer nothing', () => {
    expect(mode(bill({ active: false }), '2026-10-24')).toBe('none');
    expect(mode(bill({ endsOn: '2026-09-30' }), '2026-10-24', ['2026-09-05'])).toBe('none');
  });
});

describe('clampPaymentDate', () => {
  test('keeps today and earlier, replaces later or invalid dates with today', () => {
    expect(clampPaymentDate('2026-10-24', '2026-10-24')).toBe('2026-10-24');
    expect(clampPaymentDate('2026-10-01', '2026-10-24')).toBe('2026-10-01');
    expect(clampPaymentDate('2026-11-05', '2026-10-24')).toBe('2026-10-24');
    expect(clampPaymentDate('nope', '2026-10-24')).toBe('2026-10-24');
  });
});
