import { buildReliefPack, reliefPackCsv } from '@/domain/reliefPack';
import { YA2025 } from '@/data/tax/ya2025';
import type { Expense, ReliefClaim } from '@/domain/types';

const exp = (over: Partial<Expense>): Expense => ({
  id: 1, amount: 10000, categoryId: 1, date: '2025-06-10', note: '', receiptUri: null,
  paymentMethodId: null, reliefId: null, reliefAmount: null, commitmentId: null, dueDate: null, ...over,
});
const claim = (over: Partial<ReliefClaim>): ReliefClaim => ({
  id: 1, reliefId: 'lifestyle', year: 2025, amount: 5000, receiptUri: null, note: '', ...over,
});
const pack = (expenses: Expense[], manual: ReliefClaim[] = [], year = 2025) =>
  buildReliefPack({ year, data: YA2025, expenses, manualClaims: manual });

describe('buildReliefPack', () => {
  test('groups spending and manual claims by relief, in the order LHDN lists reliefs', () => {
    const p = pack(
      [exp({ id: 1, reliefId: 'sports', note: 'Gym', receiptUri: 'receipts/a.jpg' }), exp({ id: 2, reliefId: 'lifestyle', note: 'Phone', amount: 120000, receiptUri: 'receipts/b.jpg' })],
      [claim({ id: 3, reliefId: 'lifestyle', amount: 50000, note: 'Book', receiptUri: 'receipts/c.jpg' })],
    );
    expect(p.sections.map((s) => s.reliefId)).toEqual(['lifestyle', 'sports']);
    const lifestyle = p.sections[0];
    expect(lifestyle.items.map((i) => [i.source, i.note, i.amount])).toEqual([
      ['spending', 'Phone', 120000],
      ['manual', 'Book', 50000],
    ]);
    expect(lifestyle).toMatchObject({ name: expect.stringContaining('Lifestyle'), limit: 250000, claimed: 170000, allowed: 170000 });
  });

  test('only the claimable part counts, and the spent amount is kept for the record', () => {
    const p = pack([exp({ id: 1, reliefId: 'lifestyle', amount: 100000, reliefAmount: 30000, receiptUri: 'x' })]);
    expect(p.sections[0].items[0]).toMatchObject({ amount: 30000, spent: 100000 });
  });

  test('caps each relief at its limit and totals the allowed amounts plus the automatic relief', () => {
    const p = pack([exp({ id: 1, reliefId: 'lifestyle', amount: 300000, receiptUri: 'x' }), exp({ id: 2, reliefId: 'sports', amount: 50000, receiptUri: 'x' })]);
    expect(p.sections[0]).toMatchObject({ claimed: 300000, allowed: 250000 });
    expect(p.automatic).toEqual([{ name: 'Individual and dependent relatives', amount: 900000 }]);
    expect(p.total).toBe(900000 + 250000 + 50000);
  });

  test('only the chosen year, and never untagged or unsaved spending', () => {
    const p = pack([
      exp({ id: 1, reliefId: 'lifestyle', date: '2024-12-31', receiptUri: 'x' }),
      exp({ id: 2, reliefId: 'lifestyle', date: '2026-01-01', receiptUri: 'x' }),
      exp({ id: 3, reliefId: null }),
      exp({ id: -4, reliefId: 'lifestyle' }),
    ]);
    expect(p.sections).toEqual([]);
  });

  test('counts receipts still missing, only where a receipt is needed', () => {
    const p = pack([
      exp({ id: 1, reliefId: 'lifestyle', receiptUri: null }),
      exp({ id: 2, reliefId: 'epf', receiptUri: null }),
      exp({ id: 3, reliefId: 'sports', receiptUri: 'x' }),
    ]);
    expect(p.missingReceipts).toBe(1);
    expect(p.sections.flatMap((sec) => sec.items).map((i) => i.receipt)).toEqual(['missing', 'ok', 'not-needed']);
  });
});

describe('reliefPackCsv', () => {
  const p = pack(
    [exp({ id: 1, reliefId: 'lifestyle', note: 'Phone, case "new"', amount: 120000, reliefAmount: 100000, date: '2025-06-10', receiptUri: 'receipts/a.jpg' })],
    [claim({ id: 2, reliefId: 'lifestyle', note: '=SUM(A1)', amount: 5000, receiptUri: null })],
  );
  const lines = reliefPackCsv(p).split('\r\n');

  test('starts with the year, then a header and one row per item', () => {
    expect(lines[0]).toBe('Year of assessment,2025');
    const header = lines.findIndex((l) => l.startsWith('Relief,Date,Description'));
    expect(header).toBeGreaterThan(0);
    expect(lines[header + 1]).toBe(
      '"Lifestyle: books, computer/phone/tablet, internet, skill courses",2025-06-10,"Phone, case ""new""",1200.00,1000.00,a.jpg,Spending',
    );
  });

  test('manual claims have no date, show a missing receipt, and formula-looking text is neutralised', () => {
    const row = lines.find((l) => l.includes("'=SUM(A1)"))!;
    expect(row).toContain(",,'=SUM(A1),50.00,50.00,Missing,Typed in");
  });

  test('ends with a summary per relief and the total', () => {
    expect(lines.some((l) => l.startsWith('Relief,Limit (RM),Claimed (RM),Allowed (RM)'))).toBe(true);
    expect(lines.some((l) => l.endsWith(',2500.00,1050.00,1050.00'))).toBe(true);
    expect(lines[lines.length - 1]).toBe('Total relief,10050.00');
  });
});

describe('reliefPackCsv privacy (review finding: device file paths were exported)', () => {
  test('the receipt column shows only the file name', () => {
    const p = pack([exp({ id: 1, reliefId: 'lifestyle', receiptUri: 'receipts/receipt-123.jpg' }), exp({ id: 2, reliefId: 'sports', receiptUri: 'file:///data/user/0/app/files/receipts/old.jpg' })]);
    const csv = reliefPackCsv(p);
    expect(csv).toContain(',receipt-123.jpg,Spending');
    expect(csv).toContain(',old.jpg,Spending');
    expect(csv).not.toContain('file://');
    expect(csv).not.toContain('receipts/');
  });
});
