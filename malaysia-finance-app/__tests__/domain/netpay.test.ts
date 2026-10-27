import { estimateEis, estimateNetMonthly, estimateSocso } from '@/domain/netpay';
import type { Profile } from '@/domain/types';

const base: Profile = {
  grossMonthly: 500000, netMonthlyOverride: null, epfRate: 0.11, socsoMonthly: 1000, eisMonthly: 400, budgetStartDay: 1, reminderDays: 1, defaultCurrency: 'MYR',
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
