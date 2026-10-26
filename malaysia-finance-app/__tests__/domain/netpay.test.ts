import { estimateNetMonthly } from '@/domain/netpay';
import type { Profile } from '@/domain/types';

const base: Profile = {
  grossMonthly: 500000, netMonthlyOverride: null, epfRate: 0.11, socsoMonthly: 1000, eisMonthly: 400, budgetStartDay: 1, reminderDays: 1, defaultCurrency: 'MYR',
};

describe('estimateNetMonthly', () => {
  test('gross minus EPF, SOCSO and EIS', () => {
    expect(estimateNetMonthly(base)).toBe(443600);
  });
  test('override wins when set', () => {
    expect(estimateNetMonthly({ ...base, netMonthlyOverride: 420000 })).toBe(420000);
  });
  test('never below zero', () => {
    expect(estimateNetMonthly({ ...base, grossMonthly: 500 })).toBe(0);
  });
});
