import { categoryStatus, todayLeft, type Status } from './budget';
import { daysLeftInMonth, monthKey } from './dates';
import type { Sen } from './money';
import type { Budget, Category, Expense } from './types';

export type BudgetTile = {
  categoryId: number;
  name: string;
  spent: Sen;
  limit: Sen;
  left: Sen;
  status: Status;
};

/** A category with no budget this month: only what was spent. */
export type UnbudgetedTile = { categoryId: number; name: string; spent: Sen; limit: null };

export type Tile = BudgetTile | UnbudgetedTile;

export type HomeSummary = {
  /** Everything spent today, in every category. */
  todaySpent: Sen;
  /** One tile per category, in category order; categories without a budget this month have `limit: null`. */
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

  const tiles: Tile[] = i.categories.map((c) => {
    const spent = sum(monthExpenses.filter((e) => e.categoryId === c.id));
    const limit = limits.get(c.id);
    if (limit === undefined) return { categoryId: c.id, name: c.name, spent, limit: null };
    return { categoryId: c.id, name: c.name, spent, limit, ...categoryStatus(spent, limit) };
  });

  const withBudget = tiles.filter((t): t is BudgetTile => t.limit !== null);
  const budgeted = new Set(withBudget.map((t) => t.categoryId));
  const budgetedToday = sum(
    monthExpenses.filter((e) => e.date === i.today && budgeted.has(e.categoryId)),
  );
  const hasBudget = withBudget.length > 0;

  return {
    todaySpent: sum(i.expenses.filter((e) => e.date === i.today)),
    tiles,
    hasBudget,
    today: hasBudget
      ? todayLeft({
          monthLimit: withBudget.reduce((s, t) => s + t.limit, 0),
          monthSpent: withBudget.reduce((s, t) => s + t.spent, 0),
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

const STATUS_RANK: Record<Status, number> = { 'on-track': 0, tight: 1, over: 2 };

export type BudgetAlert = { status: 'tight' | 'over'; spent: Sen; limit: Sen };

/**
 * Whether adding `amount` to a category moves it to a worse budget status for that month
 * (on-track to tight, or to over). Returns null when the status does not get worse, so a warning
 * is sent once per step rather than on every save.
 */
export function budgetAlert(i: {
  expenses: Expense[];
  budgets: Budget[];
  categoryId: number;
  date: string;
  amount: Sen;
}): BudgetAlert | null {
  const month = monthKey(i.date);
  const budget = i.budgets.find((b) => b.categoryId === i.categoryId && b.month === month);
  if (!budget) return null;
  const spent = sum(i.expenses.filter((e) => e.categoryId === i.categoryId && monthKey(e.date) === month));
  const before = categoryStatus(spent, budget.limit).status;
  const after = categoryStatus(spent + i.amount, budget.limit).status;
  if (STATUS_RANK[after] <= STATUS_RANK[before] || after === 'on-track') return null;
  return { status: after, spent: spent + i.amount, limit: budget.limit };
}
