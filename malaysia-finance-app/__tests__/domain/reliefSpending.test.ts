import { claimsFromExpenses, suggestRelief } from '@/domain/reliefSpending';
import type { Expense } from '@/domain/types';

const exp = (over: Partial<Expense>): Expense => ({
  id: 1, amount: 10000, categoryId: 1, date: '2026-03-10', note: '', receiptUri: null,
  paymentMethodId: null, reliefId: null, reliefAmount: null, commitmentId: null, dueDate: null,
  ...over,
});

describe('claimsFromExpenses', () => {
  test('only spending tagged to a relief becomes a claim', () => {
    const claims = claimsFromExpenses([exp({ id: 1 }), exp({ id: 2, reliefId: 'lifestyle' })]);
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ reliefId: 'lifestyle', year: 2026, amount: 10000 });
  });

  test('the year of assessment is the year of the spending date', () => {
    const claims = claimsFromExpenses([
      exp({ id: 1, reliefId: 'lifestyle', date: '2025-12-31' }),
      exp({ id: 2, reliefId: 'lifestyle', date: '2026-01-01' }),
    ]);
    expect(claims.map((c) => c.year)).toEqual([2025, 2026]);
  });

  test('a claimable amount replaces the full amount, and is kept between 0 and the amount', () => {
    const amounts = claimsFromExpenses([
      exp({ id: 1, reliefId: 'x', reliefAmount: 4000 }),
      exp({ id: 2, reliefId: 'x', reliefAmount: 99999 }),
      exp({ id: 3, reliefId: 'x', reliefAmount: -50 }),
      exp({ id: 4, reliefId: 'x', reliefAmount: 0 }),
    ]).map((c) => c.amount);
    expect(amounts).toEqual([4000, 10000, 0, 0]);
  });

  test('carries the receipt and note, and uses negative ids that cannot clash with manual claims', () => {
    const [c] = claimsFromExpenses([exp({ id: 7, reliefId: 'lifestyle', receiptUri: 'receipts/a.jpg', note: 'Phone' })]);
    expect(c).toMatchObject({ id: -7, receiptUri: 'receipts/a.jpg', note: 'Phone' });
  });

  test('a tagged expense that is still unsaved (negative id) is skipped until it has a real id', () => {
    expect(claimsFromExpenses([exp({ id: -3, reliefId: 'lifestyle' })])).toEqual([]);
  });
});

describe('suggestRelief', () => {
  test('suggests the matching relief for health and education spending, ignoring case', () => {
    expect(suggestRelief('Kesihatan')).toBe('medical-serious');
    expect(suggestRelief('pendidikan')).toBe('education-self');
  });
  test('suggests nothing for other categories', () => {
    for (const name of ['Makan', 'Transport', 'Bil', 'Rumah', 'Hiburan', 'Lain-lain', 'Kucing']) {
      expect(suggestRelief(name)).toBeNull();
    }
  });
});
