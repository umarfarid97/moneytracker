import {
  activeFilterCount, EMPTY_FILTERS, filterExpenses, noteSuggestions, recentTemplates, totalsByMethod,
} from '@/domain/spendingFilter';
import { YA2025 } from '@/data/tax/ya2025';
import type { Category, Expense, PaymentMethod } from '@/domain/types';

const categories: Category[] = [
  { id: 1, name: 'Makan', icon: 'x', sortOrder: 1 },
  { id: 2, name: 'Kesihatan', icon: 'x', sortOrder: 2 },
];
const methods: PaymentMethod[] = [
  { id: 1, name: 'Cash', kind: 'cash', sortOrder: 1 },
  { id: 3, name: 'Maybank Visa', kind: 'credit', sortOrder: 3 },
];
const ctx = { categories, methods, reliefs: YA2025.reliefs };
const exp = (over: Partial<Expense>): Expense => ({
  id: 1, amount: 1000, categoryId: 1, date: '2026-10-10', note: '', receiptUri: null,
  paymentMethodId: null, reliefId: null, reliefAmount: null, commitmentId: null, dueDate: null,
  ...over,
});
const ids = (list: Expense[]) => list.map((e) => e.id);

describe('filterExpenses', () => {
  const data = [
    exp({ id: 1, note: 'Nasi lemak', amount: 1250 }),
    exp({ id: 2, note: 'Klinik Dr Ali', categoryId: 2, paymentMethodId: 3, reliefId: 'medical-serious', receiptUri: null }),
    exp({ id: 3, note: 'Farmasi', categoryId: 2, paymentMethodId: 1, reliefId: 'medical-serious', receiptUri: 'receipts/a.jpg' }),
    exp({ id: 4, note: 'Insurance', reliefId: 'epf', receiptUri: null }),
  ];

  test('no filters returns everything', () => {
    expect(ids(filterExpenses(data, EMPTY_FILTERS, ctx))).toEqual([1, 2, 3, 4]);
  });

  test('text matches note, category, payment method, relief name and amount, ignoring case', () => {
    const find = (text: string) => ids(filterExpenses(data, { ...EMPTY_FILTERS, text }, ctx));
    expect(find('NASI')).toEqual([1]);
    expect(find('kesihatan')).toEqual([2, 3]);
    expect(find('visa')).toEqual([2]);
    expect(find('serious diseases')).toEqual([2, 3]);
    expect(find('12.50')).toEqual([1]);
    expect(find('zzz')).toEqual([]);
    expect(find('   ')).toEqual([1, 2, 3, 4]);
  });

  test('category and payment method filters', () => {
    expect(ids(filterExpenses(data, { ...EMPTY_FILTERS, categoryId: 2 }, ctx))).toEqual([2, 3]);
    expect(ids(filterExpenses(data, { ...EMPTY_FILTERS, paymentMethodId: 3 }, ctx))).toEqual([2]);
  });

  test('tagged only keeps spending counted toward a relief', () => {
    expect(ids(filterExpenses(data, { ...EMPTY_FILTERS, taggedOnly: true }, ctx))).toEqual([2, 3, 4]);
  });

  test('missing receipt means tagged to a relief that needs one and has none', () => {
    // 2: medical needs a receipt, none -> missing. 3: has one. 4: EPF needs no receipt. 1: not tagged.
    expect(ids(filterExpenses(data, { ...EMPTY_FILTERS, missingReceipt: true }, ctx))).toEqual([2]);
  });

  test('filters combine', () => {
    expect(ids(filterExpenses(data, { ...EMPTY_FILTERS, categoryId: 2, taggedOnly: true, text: 'farmasi' }, ctx))).toEqual([3]);
  });
});

describe('activeFilterCount', () => {
  test('counts the filters that are switched on, not the text', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, text: 'x', categoryId: 1, paymentMethodId: 3, taggedOnly: true, missingReceipt: true })).toBe(4);
  });
});

describe('totalsByMethod', () => {
  test('sums spending per payment method, biggest first, skipping empty ones', () => {
    const rows = totalsByMethod(
      [exp({ id: 1, amount: 500, paymentMethodId: 1 }), exp({ id: 2, amount: 2000, paymentMethodId: 3 }), exp({ id: 3, amount: 700, paymentMethodId: 3 }), exp({ id: 4, amount: 300 })],
      methods,
      'No method',
    );
    expect(rows).toEqual([
      { methodId: 3, name: 'Maybank Visa', kind: 'credit', total: 2700 },
      { methodId: 1, name: 'Cash', kind: 'cash', total: 500 },
      { methodId: null, name: 'No method', kind: null, total: 300 },
    ]);
  });
  test('empty list gives no rows', () => {
    expect(totalsByMethod([], methods, 'No method')).toEqual([]);
  });
});

describe('recentTemplates', () => {
  test('returns the newest distinct entries that have a note', () => {
    const list = [
      exp({ id: 5, note: 'Teh tarik', amount: 350, date: '2026-10-24' }),
      exp({ id: 4, note: '', amount: 999, date: '2026-10-24' }),
      exp({ id: 3, note: 'teh tarik', amount: 400, date: '2026-10-20' }),
      exp({ id: 2, note: 'Grab', amount: 1500, categoryId: 2, paymentMethodId: 3, reliefId: 'lifestyle', reliefAmount: 500, date: '2026-10-19' }),
      exp({ id: 1, note: 'Nasi', amount: 800, date: '2026-10-01' }),
    ];
    const t = recentTemplates(list, 3);
    expect(t.map((x) => x.note)).toEqual(['Teh tarik', 'Grab', 'Nasi']);
    expect(t[0].amount).toBe(350);
    expect(t[1]).toMatchObject({ categoryId: 2, paymentMethodId: 3, reliefId: 'lifestyle', reliefAmount: 500, amount: 1500 });
  });
  test('works on an unsorted list and with fewer entries than asked', () => {
    const t = recentTemplates([exp({ id: 1, note: 'old', date: '2026-01-01' }), exp({ id: 2, note: 'new', date: '2026-02-01' })], 6);
    expect(t.map((x) => x.note)).toEqual(['new', 'old']);
  });
});

describe('noteSuggestions', () => {
  const list = [
    exp({ id: 3, note: 'Petronas Kajang', categoryId: 2, date: '2026-10-22' }),
    exp({ id: 2, note: 'Teh tarik', date: '2026-10-20' }),
    exp({ id: 1, note: 'Kopi O', date: '2026-10-01' }),
  ];
  const notes = (q: string, l = list) => noteSuggestions(q, l, 6).map((s) => `${s.kind}:${s.note}`);

  test('with nothing typed: recent notes first, topped up with defaults', () => {
    expect(notes('')).toEqual(['recent:Petronas Kajang', 'recent:Teh tarik', 'recent:Kopi O', 'default:Breakfast', 'default:Lunch', 'default:Dinner']);
  });

  test('recent matches come before defaults, starts-with before contains, no duplicates', () => {
    expect(notes('pet')).toEqual(['recent:Petronas Kajang', 'default:Petrol']);
    expect(notes('teh')).toEqual(['recent:Teh tarik']);
    expect(notes('TARIK')).toEqual(['recent:Teh tarik']);
    expect(notes('tnb')).toEqual(['default:Electricity (TNB)']);
  });

  test('a note typed in full is not offered again, and nothing matches gives nothing', () => {
    expect(notes('Teh tarik')).toEqual([]);
    expect(notes('zzz')).toEqual([]);
  });

  test('defaults carry their usual category', () => {
    expect(noteSuggestions('petr', [], 6)[0]).toEqual({ kind: 'default', note: 'Petrol', category: 'Transport' });
  });
});

