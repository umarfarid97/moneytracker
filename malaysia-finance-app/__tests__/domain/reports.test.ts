import { buildNetWorth } from '@/domain/netWorth';
import { categoryBreakdown, monthlyTrend, reportCsv, reportHtml, yearInReview } from '@/domain/reports';
import type { Category, Commitment, Expense } from '@/domain/types';
import { withCommitmentDefaults } from '@/domain/types';

const cats: Category[] = [
  { id: 1, name: 'Makan', icon: 'x', sortOrder: 1 },
  { id: 2, name: 'Transport', icon: 'x', sortOrder: 2 },
];
const e = (id: number, categoryId: number, amount: number, date: string, note = ''): Expense => ({
  id, categoryId, amount, date, note, receiptUri: null, paymentMethodId: null, reliefId: null, reliefAmount: null,
  commitmentId: null, dueDate: null,
});
const expenses = [
  e(1, 1, 1000, '2026-10-02', 'Lunch'), e(2, 2, 3000, '2026-10-05'), e(3, 1, 500, '2026-09-30'),
  e(4, 1, 700, '2026-08-10', '=SUM(A1)'),
];

describe('reports', () => {
  test('monthly trend covers the last N periods, oldest first, zero-filled', () => {
    expect(monthlyTrend(expenses, '2026-10', 3)).toEqual([
      { key: '2026-08', total: 700 }, { key: '2026-09', total: 500 }, { key: '2026-10', total: 4000 },
    ]);
  });

  test('trend follows the payday period', () => {
    // With a 25th start, 30 Sep belongs to the period that began 25 Sep (key 2026-09); 2 Oct too.
    const t = monthlyTrend(expenses, '2026-09', 1, 25);
    expect(t).toEqual([{ key: '2026-09', total: 1500 + 3000 }]);
  });

  test('category breakdown is sorted with shares', () => {
    const b = categoryBreakdown(expenses, cats, '2026-10');
    expect(b.map((x) => x.name)).toEqual(['Transport', 'Makan']);
    expect(b[0].share).toBeCloseTo(0.75);
  });

  test('year in review', () => {
    const y = yearInReview(expenses, cats, 2026);
    expect(y.total).toBe(5200);
    expect(y.busiestMonth).toBe(10);
    expect(y.biggest?.id).toBe(2);
    expect(y.months[7]).toBe(700);
    expect(y.averagePerMonth).toBe(Math.round(5200 / 3));
    expect(yearInReview([], cats, 2026).busiestMonth).toBeNull();
  });

  test('csv guards formulas and html escapes', () => {
    const input = { expenses, categories: cats, key: '2026-08', startDay: 1, year: 2026 };
    const csv = reportCsv(input);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('Year in review');
    expect(reportHtml({ ...input, expenses: [e(9, 1, 100, '2026-08-01', '<b>')] }, 'T')).toContain('&lt;b&gt;');
  });
});

describe('net worth', () => {
  const loan = (o: Partial<Commitment>): Commitment => ({
    id: 1, ...withCommitmentDefaults({ name: 'Car', amount: 100000, dayOfMonth: 1, kind: 'loan', active: true }), ...o,
  });
  test('assets less tracked loans', () => {
    const nw = buildNetWorth({
      epfBalance: 1_000_000,
      savings: [{ id: 1, name: 'ASB', kind: 'asb', balance: 500_000, invested: 400_000, target: null, monthly: null, note: '' }],
      commitments: [
        loan({ id: 1, loanBalance: 300_000, loanBalanceDate: '2026-01-01' }),
        loan({ id: 2, name: 'Untracked' }),
        loan({ id: 3, name: 'Paid', loanBalance: 0, loanBalanceDate: '2026-01-01' }),
      ],
      expenses: [],
    });
    expect(nw.totalAssets).toBe(1_500_000);
    expect(nw.totalLiabilities).toBe(300_000);
    expect(nw.net).toBe(1_200_000);
    expect(nw.untrackedLoans).toBe(1);
  });
});
