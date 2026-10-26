import { daysLeftInPeriod, parseStartDay, periodEnd, periodKey, periodLabel, periodStart } from '@/domain/budgetPeriod';
import { buildHome, budgetAlert } from '@/domain/summary';
import type { Budget, Category, Expense } from '@/domain/types';

describe('budget period', () => {
  test('start day 1 is the calendar month', () => {
    expect(periodKey('2026-10-24')).toBe('2026-10');
    expect(periodStart('2026-10')).toBe('2026-10-01');
    expect(periodEnd('2026-10')).toBe('2026-10-31');
    expect(periodLabel('2026-10')).toBe('October 2026');
    expect(daysLeftInPeriod('2026-10-24')).toBe(8);
  });

  test('a payday on the 25th runs from the 25th to the 24th', () => {
    expect(periodKey('2026-10-24', 25)).toBe('2026-09');
    expect(periodKey('2026-10-25', 25)).toBe('2026-10');
    expect(periodKey('2026-01-03', 25)).toBe('2025-12');
    expect(periodStart('2026-10', 25)).toBe('2026-10-25');
    expect(periodEnd('2026-10', 25)).toBe('2026-11-24');
    expect(periodLabel('2026-10', 25)).toBe('25 Oct - 24 Nov');
    expect(daysLeftInPeriod('2026-10-24', 25)).toBe(1);
    expect(daysLeftInPeriod('2026-10-25', 25)).toBe(31);
  });

  test('a start day past the end of a short month falls on its last day', () => {
    expect(periodStart('2026-02', 31)).toBe('2026-02-28');
    expect(periodEnd('2026-01', 31)).toBe('2026-02-27');
    expect(periodKey('2026-02-27', 31)).toBe('2026-01');
    expect(periodKey('2026-02-28', 31)).toBe('2026-02');
    expect(periodEnd('2026-02', 31)).toBe('2026-03-30');
    expect(periodKey('2024-02-29', 30)).toBe('2024-02');
  });

  test('every date belongs to exactly one period that contains it', () => {
    for (const startDay of [1, 15, 28, 29, 30, 31]) {
      for (let d = new Date('2026-01-01T00:00:00Z'); d < new Date('2028-03-05T00:00:00Z'); d = new Date(d.getTime() + 86_400_000)) {
        const date = d.toISOString().slice(0, 10);
        const key = periodKey(date, startDay);
        expect(date >= periodStart(key, startDay) && date <= periodEnd(key, startDay)).toBe(true);
      }
    }
  });

  test('parseStartDay accepts 1 to 31 only', () => {
    expect(parseStartDay(' 25 ')).toBe(25);
    for (const bad of ['', '0', '32', 'a', '2.5', '-1']) expect(parseStartDay(bad)).toBeNull();
  });
});

describe('budget summaries by period', () => {
  const categories: Category[] = [{ id: 1, name: 'Makan', icon: 'x', sortOrder: 1 }];
  const spend = (id: number, date: string, amount: number): Expense => ({
    id, amount, categoryId: 1, date, note: '', receiptUri: null, paymentMethodId: null, reliefId: null,
    reliefAmount: null, commitmentId: null, dueDate: null,
  });
  // Paid on the 25th: this period began on 25 Sep.
  const budgets: Budget[] = [{ categoryId: 1, month: '2026-09', limit: 100000 }];
  const expenses = [spend(1, '2026-09-24', 99999), spend(2, '2026-09-26', 30000), spend(3, '2026-10-20', 20000)];

  test('home counts spending since payday and the days left until the next one', () => {
    const home = buildHome({ categories, expenses, budgets, today: '2026-10-20', startDay: 25 });
    expect(home.tiles[0]).toMatchObject({ spent: 50000, limit: 100000 });
    // 5 days left (20th to 24th): RM 700 was left this morning, so RM 140 a day; RM 200 is gone already.
    expect(home.today).toEqual({ perDay: 14000, left: -6000 });
  });

  test('without a start day nothing changes', () => {
    const home = buildHome({ categories, expenses, budgets: [{ categoryId: 1, month: '2026-10', limit: 50000 }], today: '2026-10-20' });
    expect(home.tiles[0]).toMatchObject({ spent: 20000 });
  });

  test('spending alerts use the same period', () => {
    expect(budgetAlert({ expenses, budgets, categoryId: 1, date: '2026-10-21', amount: 30000, startDay: 25 })).toEqual({
      status: 'tight', spent: 80000, limit: 100000,
    });
    expect(budgetAlert({ expenses, budgets, categoryId: 1, date: '2026-10-21', amount: 30000 })).toBeNull();
  });
});
