import { missedRuns, monthTotal, type IncomeRule } from '@/domain/income';

const rule = (over: Partial<IncomeRule> = {}): IncomeRule => ({
  id: 1, name: 'Rent', amount: 120000, dayOfMonth: 5, active: true, startDate: '2026-08-10', lastRun: null, ...over,
});

describe('recurring income', () => {
  test('a new rule fills in the days since it was added, oldest first', () => {
    expect(missedRuns(rule(), '2026-10-26')).toEqual(['2026-09-05', '2026-10-05']);
  });

  test('a rule added today waits for its first day', () => {
    expect(missedRuns(rule({ startDate: '2026-10-26' }), '2026-10-26')).toEqual([]);
    expect(missedRuns(rule({ startDate: '2026-10-05' }), '2026-10-05')).toEqual(['2026-10-05']);
  });

  test('days already handled are not added again', () => {
    expect(missedRuns(rule({ lastRun: '2026-09-05' }), '2026-10-26')).toEqual(['2026-10-05']);
    expect(missedRuns(rule({ lastRun: '2026-10-05' }), '2026-10-26')).toEqual([]);
  });

  test('a paused rule adds nothing', () => {
    expect(missedRuns(rule({ active: false }), '2026-10-26')).toEqual([]);
  });

  test('day 31 uses the last day of a short month', () => {
    expect(missedRuns(rule({ dayOfMonth: 31, startDate: '2026-01-20' }), '2026-03-01')).toEqual(['2026-01-31', '2026-02-28']);
  });

  test('sums a month of entries', () => {
    const entries = [
      { id: 1, name: 'a', amount: 100, date: '2026-10-01' },
      { id: 2, name: 'b', amount: 250, date: '2026-10-31' },
      { id: 3, name: 'c', amount: 999, date: '2026-09-30' },
    ];
    expect(monthTotal(entries, '2026-10')).toBe(350);
  });
});
