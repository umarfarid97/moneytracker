import { daysUntil, monthlyCommitmentTotal, nextDueDate, nextReminder } from '@/domain/commitments';
import type { Commitment } from '@/domain/types';

describe('nextDueDate', () => {
  test('day 31 in a 30-day month falls on the last day', () => {
    expect(nextDueDate(31, '2026-11-10')).toBe('2026-11-30');
  });
  test('day 29 in a non-leap February falls on Feb 28', () => {
    expect(nextDueDate(29, '2027-02-05')).toBe('2027-02-28');
  });
  test('due today returns today', () => {
    expect(nextDueDate(24, '2026-10-24')).toBe('2026-10-24');
  });
  test('already passed this month rolls to next month', () => {
    expect(nextDueDate(5, '2026-10-24')).toBe('2026-11-05');
  });
  test('December rolls into January of the next year', () => {
    expect(nextDueDate(5, '2026-12-20')).toBe('2027-01-05');
  });
  test('day 31 passed in January rolls to Feb 28', () => {
    expect(nextDueDate(31, '2027-01-31')).toBe('2027-01-31');
    expect(nextDueDate(30, '2027-01-31')).toBe('2027-02-28');
  });
});

describe('daysUntil', () => {
  test('counts calendar days', () => {
    expect(daysUntil('2026-11-05', '2026-10-24')).toBe(12);
    expect(daysUntil('2026-10-24', '2026-10-24')).toBe(0);
  });
});

describe('monthlyCommitmentTotal', () => {
  const c = (amount: number, active: boolean): Commitment => ({
    id: 1, name: 'x', amount, dayOfMonth: 1, kind: 'bill', active,
    categoryId: null, paymentMethodId: null, reliefId: null, autoRecord: false, startDate: null, lastAutoDue: null, variable: false,
  });
  test('sums active commitments only', () => {
    expect(monthlyCommitmentTotal([c(100, true), c(250, true), c(999, false)])).toBe(350);
  });
});

describe('nextReminder', () => {
  // 09:00 in Kuala Lumpur (UTC+8) is 01:00 UTC.
  test('fires at 09:00 KL the day before the due date', () => {
    const r = nextReminder(24, new Date('2026-10-20T04:00:00Z'));
    expect(r.dueDate).toBe('2026-10-24');
    expect(r.fireAt.toISOString()).toBe('2026-10-23T01:00:00.000Z');
  });

  test('if that moment has passed, uses next month so a reminder is never in the past', () => {
    // 2026-10-23 10:00 KL = 02:00Z, after the 09:00 KL reminder for the 24th
    const r = nextReminder(24, new Date('2026-10-23T02:00:00Z'));
    expect(r.dueDate).toBe('2026-11-24');
    expect(r.fireAt.toISOString()).toBe('2026-11-23T01:00:00.000Z');
  });

  test('a due date on the 1st reminds on the last day of the previous month', () => {
    const r = nextReminder(1, new Date('2026-10-28T04:00:00Z'));
    expect(r.dueDate).toBe('2026-11-01');
    expect(r.fireAt.toISOString()).toBe('2026-10-31T01:00:00.000Z');
  });

  test('day 31 in a short month is due on the last day', () => {
    const r = nextReminder(31, new Date('2026-11-02T04:00:00Z'));
    expect(r.dueDate).toBe('2026-11-30');
    expect(r.fireAt.toISOString()).toBe('2026-11-29T01:00:00.000Z');
  });

  test('uses the Kuala Lumpur date, not the UTC date', () => {
    // 2026-10-23 17:00Z is already 2026-10-24 01:00 KL, so the 24th is due today and its reminder has passed
    const r = nextReminder(24, new Date('2026-10-23T17:00:00Z'));
    expect(r.dueDate).toBe('2026-11-24');
  });
});
