import { buildImportItems, mergeIntoPrevious, suggestCategory, suggestPaymentMethod, tidyDescription, toNewExpenses } from '@/domain/statementImport';
import type { StatementRow } from '@/domain/statementParse';
import type { Category, Expense, PaymentMethod } from '@/domain/types';

const names = ['Makan', 'Transport', 'Bil', 'Rumah', 'Hiburan', 'Kesihatan', 'Pendidikan', 'Lain-lain'];
const categories: Category[] = names.map((name, i) => ({ id: i + 1, name, icon: 'dots', sortOrder: i + 1 }));
const methods: PaymentMethod[] = [
  { id: 1, name: 'Cash', kind: 'cash', sortOrder: 1 },
  { id: 2, name: 'Debit card', kind: 'debit', sortOrder: 2 },
  { id: 4, name: 'E-wallet', kind: 'ewallet', sortOrder: 4 },
  { id: 5, name: 'Online transfer', kind: 'transfer', sortOrder: 5 },
  { id: 6, name: 'Maybank', kind: 'debit', sortOrder: 6 },
];
const spent = (o: Partial<Expense>): Expense => ({
  id: 1, amount: 1000, categoryId: 8, date: '2026-10-01', note: '', receiptUri: null, paymentMethodId: null,
  reliefId: null, reliefAmount: null, commitmentId: null, dueDate: null, ...o,
});
const row = (o: Partial<StatementRow>): StatementRow => ({ date: '2026-10-01', description: 'X', amount: 1000, direction: 'out', balance: null, ...o });

describe('suggestCategory', () => {
  test.each([
    ['PETRONAS STATION 1234', 'Transport'],
    ['GRABFOOD KL', 'Makan'],
    ['TNB BILL PAYMENT', 'Bil'],
    ['NETFLIX.COM', 'Hiburan'],
    ['KLINIK DR LIM', 'Kesihatan'],
    ['SOMETHING UNKNOWN', 'Lain-lain'],
  ])('%s', (text, category) => {
    const id = suggestCategory(text, categories, []);
    expect(categories.find((c) => c.id === id)?.name).toBe(category);
  });

  test('what you chose for the same merchant before wins', () => {
    const history = [spent({ note: 'Mydin Subang', categoryId: 1 })];
    expect(suggestCategory('POS DEBIT MYDIN SUBANG 99', categories, history)).toBe(1);
  });
});

describe('suggestPaymentMethod', () => {
  test('matches the bank in the file name, then the kind, then transfer', () => {
    expect(suggestPaymentMethod('maybank-oct.csv', '', methods)).toBe(6);
    expect(suggestPaymentMethod('tng.csv', '', methods)).toBe(4);
    expect(suggestPaymentMethod('statement.csv', '', methods)).toBe(5);
  });
});

describe('buildImportItems', () => {
  test('skips money in, flags repeats of existing spending and repeats in the file', () => {
    const rows = [
      row({ description: 'STARBUCKS', amount: 1590 }),
      row({ description: 'SALARY', amount: 300000, direction: 'in' }),
      row({ description: 'PETRONAS', amount: 5000, date: '2026-10-02' }),
      row({ description: 'PETRONAS', amount: 5000, date: '2026-10-02' }),
    ];
    const { items, skippedIn } = buildImportItems(rows, {
      categories, methods, existing: [spent({ amount: 1590, date: '2026-10-02' })], source: 'a.csv', sourceText: '',
    });
    expect(skippedIn).toBe(1);
    expect(items.map((i) => [i.note, i.duplicate, i.selected])).toEqual([
      ['Starbucks', true, false], ['Petronas', false, true], ['Petronas', true, false],
    ]);
  });
});

describe('merge and save', () => {
  const base = buildImportItems([row({ description: 'A', amount: 1000 }), row({ description: 'B', amount: 250, date: '2026-10-03' })], {
    categories, methods, existing: [], source: 'a.csv', sourceText: '',
  }).items;

  test('merging adds the amounts and keeps the earlier date', () => {
    const merged = mergeIntoPrevious(base, base[1].key);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ amount: 1250, note: 'A + B', date: '2026-10-01' });
  });

  test('the first line cannot merge up', () => {
    expect(mergeIntoPrevious(base, base[0].key)).toBe(base);
  });

  test('only ticked lines become spending', () => {
    const list = [{ ...base[0], selected: false }, base[1]];
    expect(toNewExpenses(list)).toEqual([expect.objectContaining({ amount: 250, note: 'B', date: '2026-10-03' })]);
  });
});

test('tidyDescription removes long reference numbers and softens capitals', () => {
  expect(tidyDescription('POS DEBIT STARBUCKS KLCC 12345678')).toBe('Starbucks KLCC');
});

describe('wallet top-ups', () => {
  const ctx = { categories: [{ id: 1, name: 'Lain-lain', icon: 'x', sortOrder: 1 }] as never, methods: [], existing: [], source: 'maybank.csv', sourceText: 'Date,Description,Debit' };
  test('a Touch n Go reload is left unticked and flagged', () => {
    const { items } = buildImportItems(
      [{ date: '2026-10-24', description: 'TNG EWALLET RELOAD', amount: 5000, direction: 'out' }, { date: '2026-10-25', description: 'MYDIN SUBANG', amount: 14230, direction: 'out' }] as never,
      ctx,
    );
    expect(items[0]).toMatchObject({ topUp: true, selected: false });
    expect(items[1]).toMatchObject({ topUp: false, selected: true });
  });
  test('keeps place names such as KLCC and PJ in capitals', () => {
    expect(tidyDescription('PETRONAS KLCC PJ')).toBe('Petronas KLCC PJ');
  });
});
