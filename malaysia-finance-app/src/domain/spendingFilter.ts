import type { ReliefDef } from '@/data/tax/types';
import { senToInput, type Sen } from './money';
import type { Category, Expense, PaymentKind, PaymentMethod } from './types';

export type SpendingFilters = {
  text: string;
  categoryId: number | null;
  paymentMethodId: number | null;
  /** Only spending counted toward a tax relief. */
  taggedOnly: boolean;
  /** Only spending tagged to a relief that needs a receipt and has none. */
  missingReceipt: boolean;
};

export const EMPTY_FILTERS: SpendingFilters = {
  text: '', categoryId: null, paymentMethodId: null, taggedOnly: false, missingReceipt: false,
};

type Context = { categories: Category[]; methods: PaymentMethod[]; reliefs: ReliefDef[] };

export function filterExpenses(expenses: Expense[], f: SpendingFilters, ctx: Context): Expense[] {
  const text = f.text.trim().toLowerCase();
  const categoryName = new Map(ctx.categories.map((c) => [c.id, c.name]));
  const methodName = new Map(ctx.methods.map((m) => [m.id, m.name]));
  const relief = new Map(ctx.reliefs.map((r) => [r.id, r]));

  return expenses.filter((e) => {
    if (f.categoryId !== null && e.categoryId !== f.categoryId) return false;
    if (f.paymentMethodId !== null && e.paymentMethodId !== f.paymentMethodId) return false;
    if (f.taggedOnly && e.reliefId === null) return false;
    if (f.missingReceipt) {
      const needsReceipt = e.reliefId !== null && relief.get(e.reliefId)?.requiresReceipt === true;
      if (!needsReceipt || e.receiptUri) return false;
    }
    if (text === '') return true;
    const haystack = [
      e.note,
      categoryName.get(e.categoryId) ?? '',
      e.paymentMethodId === null ? '' : methodName.get(e.paymentMethodId) ?? '',
      e.reliefId === null ? '' : relief.get(e.reliefId)?.name ?? '',
      senToInput(e.amount),
    ];
    return haystack.some((h) => h.toLowerCase().includes(text));
  });
}

/** How many of the choice filters are on (the search text is not counted). */
export function activeFilterCount(f: SpendingFilters): number {
  return [f.categoryId !== null, f.paymentMethodId !== null, f.taggedOnly, f.missingReceipt].filter(Boolean).length;
}

export type MethodTotal = { methodId: number | null; name: string; kind: PaymentKind | null; total: Sen };

/** Spending per payment method, biggest first; methods with nothing spent are left out. */
export function totalsByMethod(expenses: Expense[], methods: PaymentMethod[], noMethodLabel: string): MethodTotal[] {
  const totals = new Map<number | null, number>();
  for (const e of expenses) totals.set(e.paymentMethodId, (totals.get(e.paymentMethodId) ?? 0) + e.amount);
  const byId = new Map(methods.map((m) => [m.id, m]));
  const rows: MethodTotal[] = [];
  for (const [methodId, total] of totals) {
    if (total <= 0) continue;
    const m = methodId === null ? undefined : byId.get(methodId);
    rows.push(
      methodId === null || !m
        ? { methodId: null, name: noMethodLabel, kind: null, total }
        : { methodId, name: m.name, kind: m.kind, total },
    );
  }
  return rows.sort((a, b) => b.total - a.total);
}

export type SpendingTemplate = Pick<
  Expense, 'note' | 'categoryId' | 'amount' | 'paymentMethodId' | 'reliefId' | 'reliefAmount'
>;

/** The newest distinct entries that have a note, for one-tap re-adding. */
export function recentTemplates(expenses: Expense[], count: number): SpendingTemplate[] {
  const newestFirst = [...expenses].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  const seen = new Set<string>();
  const out: SpendingTemplate[] = [];
  for (const e of newestFirst) {
    const note = e.note.trim();
    if (note === '') continue;
    const key = `${note.toLowerCase()}|${e.categoryId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      note, categoryId: e.categoryId, amount: e.amount, paymentMethodId: e.paymentMethodId,
      reliefId: e.reliefId, reliefAmount: e.reliefAmount,
    });
    if (out.length === count) break;
  }
  return out;
}
