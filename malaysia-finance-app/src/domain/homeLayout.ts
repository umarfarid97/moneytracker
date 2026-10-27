import { addDays } from './dates';
import type { Category } from './types';

/** The cards Home can show. The order here is the default order. */
export const HOME_WIDGETS = [
  { id: 'today', defaultOn: true },
  { id: 'balance', defaultOn: true },
  { id: 'getStarted', defaultOn: true },
  { id: 'categories', defaultOn: true },
  { id: 'upcomingBills', defaultOn: false },
  { id: 'recent', defaultOn: false },
  { id: 'topCategory', defaultOn: false },
  { id: 'weeklyTrend', defaultOn: false },
  { id: 'savings', defaultOn: false },
  { id: 'netWorth', defaultOn: false },
  { id: 'epf', defaultOn: false },
  { id: 'owed', defaultOn: false },
  { id: 'loans', defaultOn: false },
  { id: 'taxRelief', defaultOn: false },
  { id: 'zakat', defaultOn: false },
] as const;

export type WidgetId = (typeof HOME_WIDGETS)[number]['id'];

export const HOME_LAYOUT_KEY = 'homeLayout';

/**
 * What the person changed. Anything not mentioned keeps its default, so a card or category added by a later
 * version (or a new category) shows up on its own without resetting the layout.
 */
export type HomeLayoutPrefs = {
  /** Card ids in the order chosen; cards left out follow in default order. */
  order: string[];
  /** Cards switched on or off by hand; the rest use their default. */
  visible: Record<string, boolean>;
  /** Category ids in the order chosen; categories left out follow in their own order. */
  categoryOrder: number[];
  /** Category ids hidden from "This month by category". */
  categoryHidden: number[];
};

export const DEFAULT_HOME_LAYOUT: HomeLayoutPrefs = { order: [], visible: {}, categoryOrder: [], categoryHidden: [] };

const isIdList = (v: unknown): v is unknown[] => Array.isArray(v);

/** Reads the saved layout, ignoring anything that is not in the expected shape. */
export function parseHomeLayout(raw: string | null): HomeLayoutPrefs {
  if (!raw) return DEFAULT_HOME_LAYOUT;
  try {
    const v = JSON.parse(raw) as Partial<HomeLayoutPrefs> | null;
    if (!v || typeof v !== 'object') return DEFAULT_HOME_LAYOUT;
    const visible: Record<string, boolean> = {};
    if (v.visible && typeof v.visible === 'object') {
      for (const [k, on] of Object.entries(v.visible)) if (typeof on === 'boolean') visible[k] = on;
    }
    return {
      order: isIdList(v.order) ? v.order.filter((x): x is string => typeof x === 'string') : [],
      visible,
      categoryOrder: isIdList(v.categoryOrder) ? v.categoryOrder.filter((x): x is number => Number.isInteger(x)) : [],
      categoryHidden: isIdList(v.categoryHidden) ? v.categoryHidden.filter((x): x is number => Number.isInteger(x)) : [],
    };
  } catch {
    return DEFAULT_HOME_LAYOUT;
  }
}

export type WidgetEntry = { id: WidgetId; visible: boolean };

/** Every card in the order to show them, with whether each is on. */
export function resolveWidgets(prefs: HomeLayoutPrefs): WidgetEntry[] {
  const known = new Map<string, (typeof HOME_WIDGETS)[number]>(HOME_WIDGETS.map((w) => [w.id, w]));
  const chosen = prefs.order.filter((id, i) => known.has(id) && prefs.order.indexOf(id) === i);
  const rest = HOME_WIDGETS.map((w) => w.id as string).filter((id) => !chosen.includes(id));
  return [...chosen, ...rest].map((id) => ({
    id: id as WidgetId,
    visible: prefs.visible[id] ?? known.get(id)!.defaultOn,
  }));
}

export type CategoryEntry = { category: Category; visible: boolean };

/** Every category in the order to show them, with whether each is on. */
export function resolveCategories(prefs: HomeLayoutPrefs, categories: Category[]): CategoryEntry[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chosen = prefs.categoryOrder.filter((id, i) => byId.has(id) && prefs.categoryOrder.indexOf(id) === i);
  const rest = categories.map((c) => c.id).filter((id) => !chosen.includes(id));
  const hidden = new Set(prefs.categoryHidden);
  return [...chosen, ...rest].map((id) => ({ category: byId.get(id)!, visible: !hidden.has(id) }));
}

/** A copy of the list with the item at `from` moved to `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

export function withWidgets(prefs: HomeLayoutPrefs, entries: WidgetEntry[]): HomeLayoutPrefs {
  return { ...prefs, order: entries.map((e) => e.id), visible: Object.fromEntries(entries.map((e) => [e.id, e.visible])) };
}

export function withCategories(prefs: HomeLayoutPrefs, entries: CategoryEntry[]): HomeLayoutPrefs {
  return {
    ...prefs,
    categoryOrder: entries.map((e) => e.category.id),
    categoryHidden: entries.filter((e) => !e.visible).map((e) => e.category.id),
  };
}

export const isDefaultLayout = (prefs: HomeLayoutPrefs): boolean =>
  JSON.stringify(prefs) === JSON.stringify(DEFAULT_HOME_LAYOUT);

/** Spending in each of the 7 days up to and including `today` (oldest first), and the 7 days before them. */
export function weekTrend(
  expenses: { date: string; amount: number }[], today: string,
): { days: { date: string; total: number }[]; total: number; previous: number } {
  const days = Array.from({ length: 7 }, (_, i) => ({ date: addDays(today, i - 6), total: 0 }));
  const first = days[0].date;
  const prevFirst = addDays(first, -7);
  let previous = 0;
  for (const e of expenses) {
    if (e.date >= first && e.date <= today) days[days.findIndex((d) => d.date === e.date)].total += e.amount;
    else if (e.date >= prevFirst && e.date < first) previous += e.amount;
  }
  return { days, total: days.reduce((s, d) => s + d.total, 0), previous };
}
