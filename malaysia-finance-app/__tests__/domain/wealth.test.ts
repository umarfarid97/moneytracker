import { calculateZakat, donationDeduction, summariseGiving, type GivingRecord } from '@/domain/giving';
import {
  projectRetirement, suggestedEpf, summariseEpf, summariseSocso, type RetirementEntry,
} from '@/domain/retirement';
import { gain, monthsToTarget, progress, totals } from '@/domain/savings';
import { calculateTaxBill } from '@/domain/taxBill';
import { resolveTaxData } from '@/data/tax';

const entry = (o: Partial<RetirementEntry>): RetirementEntry => ({
  id: 1, scheme: 'epf', kind: 'contribution', date: '2026-01-31', amount: 0, employerShare: 0, note: '', ...o,
});

describe('EPF', () => {
  test('balance is opening + contributions + dividends - withdrawals, with this year split out', () => {
    const s = summariseEpf(
      [
        entry({ kind: 'opening', date: '2025-12-31', amount: 1_000_000 }),
        entry({ amount: 50_000, employerShare: 30_000 }),
        entry({ date: '2026-02-28', amount: 50_000, employerShare: 30_000 }),
        entry({ kind: 'dividend', date: '2026-03-01', amount: 20_000 }),
        entry({ kind: 'withdrawal', date: '2026-04-01', amount: 100_000 }),
        entry({ date: '2025-11-30', amount: 40_000, employerShare: 20_000 }),
        entry({ scheme: 'socso', amount: 9_999 }),
      ],
      2026,
    );
    expect(s.balance).toBe(1_000_000 + 140_000 + 20_000 - 100_000);
    expect(s.year).toEqual({ employee: 40_000, employer: 60_000, dividends: 20_000 });
  });

  test('suggests 11% from you and 13% (wage up to RM5,000) or 12% from the employer, rounded up to the ringgit', () => {
    expect(suggestedEpf(400_000)).toEqual({ employee: 44_000, employer: 52_000 });
    expect(suggestedEpf(600_000)).toEqual({ employee: 66_000, employer: 72_000 });
    expect(suggestedEpf(123_456)).toEqual({ employee: 13_600, employer: 16_100 });
    expect(suggestedEpf(0)).toEqual({ employee: 0, employer: 0 });
  });

  test('projects a balance month by month and spreads it over 20 years', () => {
    const flat = projectRetirement({ balance: 100_000, monthly: 10_000, years: 1, dividendPct: 0 });
    expect(flat).toMatchObject({ atRetirement: 220_000, contributions: 120_000, growth: 0, monthlyIncome: Math.round(220_000 / 240) });
    const grown = projectRetirement({ balance: 1_000_000, monthly: 0, years: 10, dividendPct: 6 });
    expect(grown.atRetirement).toBeGreaterThan(1_790_000);
    expect(grown.atRetirement).toBeLessThan(1_820_000);
    expect(grown.growth).toBe(grown.atRetirement - 1_000_000);
  });
});

describe('SOCSO and EIS', () => {
  test('totals both schemes and the employee part for the year', () => {
    const s = summariseSocso(
      [
        entry({ scheme: 'socso', amount: 3_000, employerShare: 2_000 }),
        entry({ scheme: 'socso', date: '2026-02-28', amount: 3_000, employerShare: 2_000 }),
        entry({ scheme: 'eis', amount: 800, employerShare: 400 }),
        entry({ scheme: 'socso', date: '2025-12-31', amount: 3_000, employerShare: 2_000 }),
      ],
      2026,
    );
    expect(s.socso).toEqual({ employee: 3_000, employer: 6_000, months: 3 });
    expect(s.eis).toEqual({ employee: 400, employer: 400, months: 1 });
    expect(s.yearEmployee).toBe(1_000 + 1_000 + 400);
  });
});

describe('giving and zakat', () => {
  const rec = (o: Partial<GivingRecord>): GivingRecord => ({
    id: 1, kind: 'zakat', date: '2026-03-10', amount: 10_000, recipient: '', note: '', countsForTax: true, ...o,
  });

  test('splits a year into zakat and sedekah, and what counts toward tax', () => {
    const s = summariseGiving(
      [
        rec({ amount: 10_000 }),
        rec({ kind: 'fitrah', amount: 1_400 }),
        rec({ kind: 'sedekah', amount: 5_000 }),
        rec({ kind: 'waqf', amount: 2_000, countsForTax: false }),
        rec({ amount: 99_000, date: '2025-03-10' }),
        rec({ amount: 7_000, countsForTax: false }),
      ],
      2026,
    );
    expect(s).toEqual({ total: 25_400, zakat: 18_400, sedekah: 7_000, zakatForTax: 11_400, donationsForTax: 5_000 });
  });

  test('donations are deducted up to 10% of income', () => {
    expect(donationDeduction(500_000, 6_000_000)).toBe(500_000);
    expect(donationDeduction(900_000, 6_000_000)).toBe(600_000);
    expect(donationDeduction(100, 0)).toBe(0);
  });

  test('zakat is 2.5% of each part that reaches the nisab of 85 g of gold', () => {
    const base = { savings: 0, goldGrams: 0, goldPricePerGram: 40_000, annualIncome: 0, annualNeeds: 0 };
    expect(calculateZakat({ ...base, savings: 3_000_000 })).toMatchObject({ nisab: 3_400_000, savings: 0, total: 0 });
    expect(calculateZakat({ ...base, savings: 4_000_000 })).toMatchObject({ savings: 100_000, total: 100_000 });
    expect(calculateZakat({ ...base, goldGrams: 100 })).toMatchObject({ gold: 100_000 });
    expect(calculateZakat({ ...base, goldGrams: 50 }).gold).toBe(0);
    expect(calculateZakat({ ...base, annualIncome: 6_000_000, annualNeeds: 2_000_000 })).toMatchObject({ income: 100_000 });
    expect(calculateZakat({ ...base, goldPricePerGram: 0, savings: 9_000_000 })).toMatchObject({ total: 0, hasNisab: false });
  });
});

describe('savings', () => {
  const a = { balance: 25_000, invested: 20_000, target: 100_000, monthly: 5_000 };
  test('progress, gain, months to goal and totals', () => {
    expect(progress(a)).toBe(0.25);
    expect(progress({ ...a, target: null })).toBeNull();
    expect(progress({ ...a, balance: 200_000 })).toBe(1);
    expect(gain(a)).toBe(5_000);
    expect(monthsToTarget(a)).toBe(15);
    expect(monthsToTarget({ ...a, monthly: null })).toBeNull();
    expect(totals([{ id: 1, name: 'a', kind: 'asb', note: '', ...a }, { id: 2, name: 'b', kind: 'prs', note: '', ...a }]))
      .toEqual({ balance: 50_000, invested: 40_000, gain: 10_000 });
  });
});

describe('tax bill with donations', () => {
  const data = resolveTaxData(2025).data;
  const input = { salary: 6_000_000, freelanceGross: 0, businessGross: 0, allowableExpenses: 0, reliefsTotal: 900_000, pcb: 0, zakat: 0, spouseRebate: false };
  test('approved donations lower chargeable income, up to 10% of income', () => {
    const none = calculateTaxBill(input, data);
    const some = calculateTaxBill({ ...input, donations: 200_000 }, data);
    expect(some.donationDeduction).toBe(200_000);
    expect(some.chargeable).toBe(none.chargeable - 200_000);
    expect(calculateTaxBill({ ...input, donations: 9_000_000 }, data).donationDeduction).toBe(600_000);
    expect(none.donationDeduction).toBe(0);
  });
});
