import { YA2025 } from '@/data/tax/ya2025';
import { beSummaryCsv, beSummaryText, buildBeSummary } from '@/domain/beForm';
import { buildReliefPack } from '@/domain/reliefPack';
import type { Expense, ReliefClaim } from '@/domain/types';

const exp = (over: Partial<Expense>): Expense => ({
  id: 1, amount: 10000, categoryId: 1, date: '2025-06-10', note: '', receiptUri: null,
  paymentMethodId: null, reliefId: null, reliefAmount: null, commitmentId: null, dueDate: null, ...over,
});
const claim: ReliefClaim = { id: 5, reliefId: 'epf', year: 2025, amount: 500000, receiptUri: null, note: 'EPF' };

const summary = () =>
  buildBeSummary(buildReliefPack({
    year: 2025, data: YA2025, manualClaims: [claim],
    expenses: [exp({ id: 1, reliefId: 'lifestyle', amount: 300000, receiptUri: 'receipts/a.jpg' }), exp({ id: 2, reliefId: 'medical-dental', amount: 8000 })],
  }));

describe('buildBeSummary', () => {
  test('groups lines by form section and applies limits', () => {
    const s = summary();
    expect(s.sections.map((x) => x.id)).toEqual(['medical', 'lifestyle', 'savings']);
    const lifestyle = s.sections.find((x) => x.id === 'lifestyle')!;
    expect(lifestyle.lines[0]).toMatchObject({ reliefId: 'lifestyle', claimed: 300000, enter: 250000, items: 1 });
    expect(s.sections.find((x) => x.id === 'savings')!.lines[0].enter).toBe(400000);
    expect(s.missingReceipts).toBe(1);
  });

  test('text and csv list every line and the total', () => {
    const s = summary();
    const text = beSummaryText(s);
    expect(text).toContain('Lifestyle');
    expect(text).toContain('limit applied');
    expect(text).toContain('[1 receipt missing]');
    expect(beSummaryCsv(s)).toContain('Enter in e-Filing (RM)');
  });
});
