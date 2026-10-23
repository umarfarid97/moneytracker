import { categoryStatus, todayLeft, type Status } from './budget';
import { daysLeftInMonth, monthKey } from './dates';
import type { Sen } from './money';
import type { Budget, Category, Expense } from './types';

export type Tile = {
  categoryId: number;
  name: string;
  spent: Sen;
  limit: Sen;
  left: Sen;
  status: Status;
};

export type HomeSummary = {
  /** Everything spent today, in every category. */
  todaySpent: Sen;
  /** One tile per category that has a budget this month, in category order. */
  tiles: Tile[];
  hasBudget: boolean;
  /** Daily allowance and what is left of it today; null when no budget is set. */
  today: { perDay: Sen; left: Sen } | null;
};

const sum = (items: Expense[]) => items.reduce((s, e) => s + e.amount, 0);

export function monthSpent(expenses: Expense[], month: string): Sen {
  return sum(expenses.filter((e) => monthKey(e.date) === month));
}

export function buildHome(i: {
  categories: Category[];
  expenses: Expense[];
  budgets: Budget[];
  today: string;
}): HomeSummary {
  const month = monthKey(i.today);
  const monthExpenses = i.expenses.filter((e) => monthKey(e.date) === month);
  const limits = new Map(i.budgets.filter((b) => b.month === month).map((b) => [b.categoryId, b.limit]));

  const tiles: Tile[] = i.categories
    .filter((c) => limits.has(c.id))
    .map((c) => {
      const limit = limits.get(c.id)!;
      const spent = sum(monthExpenses.filter((e) => e.categoryId === c.id));
      return { categoryId: c.id, name: c.name, spent, limit, ...categoryStatus(spent, limit) };
    });

  const budgeted = new Set(tiles.map((t) => t.categoryId));
  const budgetedToday = sum(
    monthExpenses.filter((e) => e.date === i.today && budgeted.has(e.categoryId)),
  );
  const hasBudget = tiles.length > 0;

  return {
    todaySpent: sum(i.expenses.filter((e) => e.date === i.today)),
    tiles,
    hasBudget,
    today: hasBudget
      ? todayLeft({
          monthLimit: tiles.reduce((s, t) => s + t.limit, 0),
          monthSpent: tiles.reduce((s, t) => s + t.spent, 0),
          todaySpent: budgetedToday,
          daysLeft: daysLeftInMonth(i.today),
        })
      : null,
  };
}

export type DayGroup = { date: string; total: Sen; items: Expense[] };

/** Groups expenses by date, newest day first (input order is kept within a day). */
export function groupByDay(expenses: Expense[]): DayGroup[] {
  const byDate = new Map<string, Expense[]>();
  for (const e of expenses) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, items]) => ({ date, total: sum(items), items }));
}
