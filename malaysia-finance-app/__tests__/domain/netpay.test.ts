import { YA2025 } from '@/data/tax/ya2025';
import { estimateEis, estimateNetMonthly, estimateSocso, takeHomeBreakdown } from '@/domain/netpay';
import { estimateMonthlyPcb } from '@/domain/pcbEstimate';
import { calculateTaxBill } from '@/domain/taxBill';
import type { Profile } from '@/domain/types';

const base: Profile = {
  grossMonthly: 500000, netMonthlyOverride: null, epfRate: 0.11, socsoMonthly: 1000, eisMonthly: 400, budgetStartDay: 1, reminderDays: 1, pcbMonthly: 0,
};

describe('estimateNetMonthly', () => {
  test('gross minus EPF, SOCSO and EIS', () => {
    expect(estimateNetMonthly(base)).toBe(443600);
  });
  test('estimates SOCSO and EIS from the salary when left empty', () => {
    expect(estimateSocso(550000)).toBe(2750);
    expect(estimateEis(550000)).toBe(1100);
    expect(estimateNetMonthly({ ...base, grossMonthly: 550000, socsoMonthly: 0, eisMonthly: 0 })).toBe(550000 - 60500 - 2750 - 1100);
  });
  test('wages above the ceiling stop adding SOCSO and EIS', () => {
    expect(estimateSocso(1000000)).toBe(3000);
    expect(estimateEis(1000000)).toBe(1200);
  });
  test('override wins when set', () => {
    expect(estimateNetMonthly({ ...base, netMonthlyOverride: 420000 })).toBe(420000);
  });
  test('never below zero', () => {
    expect(estimateNetMonthly({ ...base, grossMonthly: 500 })).toBe(0);
  });
});

describe('PCB in take-home pay', () => {
  test('an entered PCB is taken off and labelled entered', () => {
    const b = takeHomeBreakdown({ ...base, pcbMonthly: 25000 }, 99999);
    expect(b.pcb).toEqual({ amount: 25000, estimated: false });
    expect(b.net).toBe(443600 - 25000);
  });
  test('an empty PCB uses the estimate and labels it estimated', () => {
    const b = takeHomeBreakdown(base, 30000);
    expect(b.pcb).toEqual({ amount: 30000, estimated: true });
    expect(b.net).toBe(443600 - 30000);
  });
  test('SOCSO and EIS are labelled entered or estimated', () => {
    expect(takeHomeBreakdown(base).socso.estimated).toBe(false);
    const b = takeHomeBreakdown({ ...base, socsoMonthly: 0, eisMonthly: 0 });
    expect([b.socso.estimated, b.eis.estimated]).toEqual([true, true]);
  });
  test('the take-home override still wins over PCB', () => {
    expect(estimateNetMonthly({ ...base, netMonthlyOverride: 420000, pcbMonthly: 25000 }, 30000)).toBe(420000);
  });
  test('the estimate is the annual tax from the tax calculation divided by 12', () => {
    const reliefs = YA2025.automaticReliefs.reduce((s, r) => s + r.amount, 0);
    const annual = calculateTaxBill(
      { salary: 6_000_000, freelanceGross: 0, businessGross: 0, allowableExpenses: 0, reliefsTotal: reliefs, pcb: 0, zakat: 0, spouseRebate: false },
      YA2025,
    ).tax;
    expect(annual).toBeGreaterThan(0);
    expect(estimateMonthlyPcb(500000, reliefs, YA2025)).toBe(Math.round(annual / 12));
  });
  test('no salary means no estimated PCB', () => {
    expect(estimateMonthlyPcb(0, 900000, YA2025)).toBe(0);
  });
});
