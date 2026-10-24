import { buildHome, groupByDay, monthSpent } from '@/domain/summary';
import type { Budget, Category, Expense } from '@/domain/types';

const cat = (id: number, name: string): Category => ({ id, name, icon: 'x', sortOrder: id });
const categories = [cat(1, 'Makan'), cat(2, 'Transport'), cat(3, 'Hiburan')];
const exp = (id: number, categoryId: number, amount: number, date: string): Expense => ({
  id, amount, categoryId, date, note: '', receiptUri: null,
  paymentMethodId: null, reliefId: null, reliefAmount: null, commitmentId: null, dueDate: null,
});
const budget = (categoryId: number, limit: number, month = '2026-10'): Budget => ({ categoryId, month, limit });

describe('buildHome', () => {
  const today = '2026-10-24';
  const expenses = [
    exp(1, 1, 8640, today), // Makan today
    exp(2, 1, 33360, '2026-10-10'), // Makan earlier this month -> Makan month 42000
    exp(3, 2, 31000, '2026-10-12'),
    exp(4, 3, 26000, '2026-10-05'),
    exp(5, 1, 99999, '2026-09-30'), // last month: ignored
  ];
  const budgets = [budget(1, 60000), budget(2, 35000), budget(3, 20000), budget(1, 1, '2026-09')];

  test('one tile per budgeted category with left amount and status', () => {
    const home = buildHome({ categories, expenses, budgets, today });
    expect(home.tiles.map((t) => [t.name, t.spent, t.left, t.status])).toEqual([
      ['Makan', 42000, 18000, 'on-track'],
      ['Transport', 31000, 4000, 'tight'],
      ['Hiburan', 26000, -6000, 'over'],
    ]);
  });

  test('today total includes every category', () => {
    const home = buildHome({ categories, expenses: [...expenses, exp(6, 3, 500, today)], budgets, today });
    expect(home.todaySpent).toBe(8640 + 500);
  });

  test('categories without a budget this month get no tile', () => {
    const home = buildHome({ categories, expenses, budgets: [budget(1, 60000)], today });
    expect(home.tiles.map((t) => t.name)).toEqual(['Makan']);
    expect(home.hasBudget).toBe(true);
  });

  test('no budgets at all means no tiles and no daily allowance', () => {
    const home = buildHome({ categories, expenses, budgets: [], today });
    expect(home.hasBudget).toBe(false);
    expect(home.tiles).toEqual([]);
    expect(home.today).toBeNull();
  });

  test('left for today uses the whole budget and the days remaining', () => {
    const home = buildHome({ categories, expenses, budgets, today });
    // limit 115000, spent in budgeted categories 99000, of which 8640 today, 8 days left (24..31)
    // start of day left = 115000 - (99000 - 8640) = 24640 -> 3080 a day -> minus 8640 = -5560
    expect(home.today).toEqual({ perDay: 3080, left: 3080 - 8640 });
  });

  test('a budget on a deleted category is ignored', () => {
    const home = buildHome({ categories, expenses, budgets: [budget(99, 1000)], today });
    expect(home.tiles).toEqual([]);
  });
});

describe('monthSpent', () => {
  test('sums only expenses in that month', () => {
    expect(monthSpent([exp(1, 1, 100, '2026-10-31'), exp(2, 1, 200, '2026-11-01')], '2026-10')).toBe(100);
  });
});

describe('groupByDay', () => {
  test('groups newest day first with a day total', () => {
    const groups = groupByDay([exp(1, 1, 100, '2026-10-24'), exp(2, 1, 250, '2026-10-24'), exp(3, 1, 400, '2026-10-20')]);
    expect(groups.map((g) => [g.date, g.total, g.items.length])).toEqual([
      ['2026-10-24', 350, 2],
      ['2026-10-20', 400, 1],
    ]);
  });
  test('empty list gives no groups', () => {
    expect(groupByDay([])).toEqual([]);
  });
});
