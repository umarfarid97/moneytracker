import { daysUntil, monthlyCommitmentTotal, nextDueDate } from '@/domain/commitments';
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
  });
  test('sums active commitments only', () => {
    expect(monthlyCommitmentTotal([c(100, true), c(250, true), c(999, false)])).toBe(350);
  });
});
