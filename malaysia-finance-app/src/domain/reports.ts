import { periodKey, periodLabel } from './budgetPeriod';
import { toCsv } from './csv';
import { monthKey, monthLabel, shiftMonth } from './dates';
import { formatRM, type Sen } from './money';
import type { Category, Expense } from './types';

export type TrendPoint = { key: string; total: Sen };

/** Spending in each of the last `count` budget periods ending at `endKey`, oldest first. */
export function monthlyTrend(expenses: Expense[], endKey: string, count: number, startDay = 1): TrendPoint[] {
  const totals = new Map<string, Sen>();
  for (const e of expenses) {
    const key = periodKey(e.date, startDay);
    totals.set(key, (totals.get(key) ?? 0) + e.amount);
  }
  return Array.from({ length: count }, (_, i) => {
    const key = shiftMonth(endKey, i - count + 1);
    return { key, total: totals.get(key) ?? 0 };
  });
}

export type CategoryShare = { categoryId: number; name: string; total: Sen; share: number };

/** Where one period's spending went, biggest category first; categories with nothing spent are left out. */
export function categoryBreakdown(
  expenses: Expense[], categories: Category[], key: string, startDay = 1,
): CategoryShare[] {
  return breakdown(expenses.filter((e) => periodKey(e.date, startDay) === key), categories);
}

function breakdown(expenses: Expense[], categories: Category[]): CategoryShare[] {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return categories
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      total: expenses.filter((e) => e.categoryId === c.id).reduce((s, e) => s + e.amount, 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((c) => ({ ...c, share: total > 0 ? c.total / total : 0 }));
}

export type YearInReview = {
  year: number;
  total: Sen;
  count: number;
  /** Twelve calendar-month totals, January first. */
  months: Sen[];
  /** Average over the months that had any spending; 0 when there is none. */
  averagePerMonth: Sen;
  /** The calendar month (1-12) with the most spending, or null when nothing was spent. */
  busiestMonth: number | null;
  biggest: Expense | null;
  categories: CategoryShare[];
};

/** A calendar year of spending at a glance. */
export function yearInReview(expenses: Expense[], categories: Category[], year: number): YearInReview {
  const inYear = expenses.filter((e) => e.date.startsWith(`${year}-`));
  const months = Array.from({ length: 12 }, () => 0);
  for (const e of inYear) months[Number(monthKey(e.date).slice(5)) - 1] += e.amount;
  const total = months.reduce((s, m) => s + m, 0);
  const active = months.filter((m) => m > 0).length;
  const peak = Math.max(...months);
  const biggest = inYear.reduce<Expense | null>((best, e) => (best === null || e.amount > best.amount ? e : best), null);
  return {
    year,
    total,
    count: inYear.length,
    months,
    averagePerMonth: active > 0 ? Math.round(total / active) : 0,
    busiestMonth: peak > 0 ? months.indexOf(peak) + 1 : null,
    biggest,
    categories: breakdown(inYear, categories),
  };
}

const rm = (sen: Sen) => (sen / 100).toFixed(2);

export type ReportInput = {
  expenses: Expense[];
  categories: Category[];
  /** Budget period the report covers (`YYYY-MM`), and the day that period starts. */
  key: string;
  startDay: number;
  year: number;
};

/** Spending lines in one period, newest first, with category names. */
function periodExpenses({ expenses, key, startDay }: ReportInput): Expense[] {
  return expenses
    .filter((e) => periodKey(e.date, startDay) === key)
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
}

/** CSV (opens in Excel) with the period's spending, its category split, and the year's monthly totals. */
export function reportCsv(i: ReportInput): string {
  const names = new Map(i.categories.map((c) => [c.id, c.name]));
  const lines = periodExpenses(i);
  const review = yearInReview(i.expenses, i.categories, i.year);
  const split = categoryBreakdown(i.expenses, i.categories, i.key, i.startDay);
  const rows: (string | number)[][] = [
    ['Spending', periodLabel(i.key, i.startDay)],
    ['Date', 'Category', 'Note', 'Amount (RM)'],
    ...lines.map((e) => [e.date, names.get(e.categoryId) ?? '', e.note, rm(e.amount)]),
    ['Total', '', '', rm(lines.reduce((s, e) => s + e.amount, 0))],
    [],
    ['By category', periodLabel(i.key, i.startDay)],
    ['Category', 'Amount (RM)', 'Share (%)'],
    ...split.map((c) => [c.name, rm(c.total), (c.share * 100).toFixed(1)]),
    [],
    ['Year in review', i.year],
    ['Month', 'Amount (RM)'],
    ...review.months.map((m, idx) => [monthLabel(`${i.year}-${String(idx + 1).padStart(2, '0')}`), rm(m)]),
    ['Total', rm(review.total)],
  ];
  return toCsv(rows);
}

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A printable HTML page for the PDF export. */
export function reportHtml(i: ReportInput, title: string): string {
  const names = new Map(i.categories.map((c) => [c.id, c.name]));
  const lines = periodExpenses(i);
  const split = categoryBreakdown(i.expenses, i.categories, i.key, i.startDay);
  const review = yearInReview(i.expenses, i.categories, i.year);
  const label = periodLabel(i.key, i.startDay);
  const table = (head: string[], body: string[][]) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body
      .map((r) => `<tr>${r.map((c, n) => `<td${n === r.length - 1 ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:Helvetica,Arial,sans-serif;color:#111;padding:24px}h1{color:#0d5bd3;margin:0 0 4px}h2{margin:24px 0 8px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e3e6ea}
th{color:#555}.n{text-align:right;white-space:nowrap}</style></head><body>
<h1>${esc(title)}</h1><div>${esc(label)}</div>
<h2>${esc(label)}</h2>
${table(['Date', 'Category', 'Note', 'RM'], lines.map((e) => [e.date, names.get(e.categoryId) ?? '', e.note, formatRM(e.amount)]))}
<h2>By category</h2>
${table(['Category', '%', 'RM'], split.map((c) => [c.name, (c.share * 100).toFixed(1), formatRM(c.total)]))}
<h2>${i.year}</h2>
${table(['Month', 'RM'], review.months.map((m, idx) => [monthLabel(`${i.year}-${String(idx + 1).padStart(2, '0')}`), formatRM(m)]))}
</body></html>`;
}
