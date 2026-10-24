import { chargeableIncome, computeTax } from '@/domain/tax';
import { YA2025 } from '@/data/tax/ya2025';

const rm = (n: number) => n * 100;
const tax = (chargeableRM: number, opts?: Parameters<typeof computeTax>[2]) =>
  computeTax(rm(chargeableRM), YA2025, opts);

describe('YA2025 data', () => {
  test('cites its official LHDN sources', () => {
    expect(YA2025.ya).toBe(2025);
    expect(YA2025.rateSourceUrl).toContain('hasil.gov.my');
    expect(YA2025.reliefSourceUrl).toContain('hasil.gov.my');
    expect(YA2025.fetchedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('computeTax: bracket edges (LHDN YA 2023-2025 table)', () => {
  test('zero and negative chargeable income is RM 0', () => {
    expect(computeTax(0, YA2025).tax).toBe(0);
    expect(computeTax(-500, YA2025).tax).toBe(0);
  });
  test('RM 5,000 is tax free and 1 sen above costs less than 1 sen', () => {
    expect(tax(5000).tax).toBe(0);
    expect(computeTax(rm(5000) + 1, YA2025).tax).toBe(0);
  });
  test('RM 20,000 is RM 150 and the RM 400 rebate wipes it out', () => {
    const r = tax(20000);
    expect(r.rebate).toBe(rm(400));
    expect(r.tax).toBe(0);
  });
  test('RM 35,000 gets the rebate: RM 600 less RM 400 is RM 200', () => {
    const r = tax(35000);
    expect(r.rebate).toBe(rm(400));
    expect(r.tax).toBe(rm(200));
  });
  test('1 sen above RM 35,000 loses the rebate entirely', () => {
    const r = computeTax(rm(35000) + 1, YA2025);
    expect(r.rebate).toBe(0);
    expect(r.tax).toBe(rm(600));
  });
  test('RM 50,000 is RM 1,500 and RM 100,000 is RM 9,400', () => {
    expect(tax(50000).tax).toBe(rm(1500));
    expect(tax(100000).tax).toBe(rm(9400));
  });
  test('RM 400,000 is RM 84,400 and RM 600,000 is RM 136,400', () => {
    expect(tax(400000).tax).toBe(rm(84400));
    expect(tax(600000).tax).toBe(rm(136400));
  });
  test('RM 2,000,000 is RM 528,400 and each ringgit above costs 30 sen', () => {
    expect(tax(2000000).tax).toBe(rm(528400));
    expect(tax(2000100).tax).toBe(rm(528430));
  });
});

describe('computeTax: rebates and zakat', () => {
  test('spouse rebate doubles the rebate for low incomes and tax never goes negative', () => {
    expect(tax(30000).tax).toBe(rm(50));
    const withSpouse = tax(30000, { spouseRebate: true });
    expect(withSpouse.rebate).toBe(rm(800));
    expect(withSpouse.tax).toBe(0);
  });
  test('spouse rebate does not apply above RM 35,000', () => {
    expect(tax(40000, { spouseRebate: true }).rebate).toBe(0);
  });
  test('zakat reduces tax but never below zero', () => {
    expect(tax(100000, { zakat: rm(2000) }).tax).toBe(rm(7400));
    expect(tax(100000, { zakat: rm(99999) }).tax).toBe(0);
  });
  test('byBracket taxed amounts add up to the chargeable income', () => {
    const r = tax(250000);
    expect(r.byBracket.reduce((s, b) => s + b.taxed, 0)).toBe(rm(250000));
    expect(r.byBracket.reduce((s, b) => s + b.tax, 0)).toBe(r.tax + r.rebate);
  });
});

describe('chargeableIncome', () => {
  const zero = { salary: 0, freelanceGross: 0, businessGross: 0, allowableExpenses: 0, reliefsTotal: 0 };
  test('adds all income kinds, subtracts expenses against business income, then reliefs', () => {
    expect(
      chargeableIncome({
        salary: rm(60000), freelanceGross: rm(20000), businessGross: rm(10000),
        allowableExpenses: rm(6000), reliefsTotal: rm(15000),
      }),
    ).toBe(rm(69000));
  });
  test('floors at zero when reliefs exceed income', () => {
    expect(chargeableIncome({ ...zero, salary: rm(10000), reliefsTotal: rm(30000) })).toBe(0);
  });
  test('expenses cannot reduce salary', () => {
    expect(chargeableIncome({ ...zero, salary: rm(50000), allowableExpenses: rm(9000) })).toBe(rm(50000));
  });
});
