import { daysLeftInMonth, monthKey, todayKL } from '@/domain/dates';

describe('todayKL', () => {
  test('rolls to the next day after 16:00 UTC (00:00 in Kuala Lumpur)', () => {
    expect(todayKL(new Date('2026-10-31T16:30:00Z'))).toBe('2026-11-01');
  });
  test('stays on the same day just before midnight KL', () => {
    expect(todayKL(new Date('2026-10-31T15:59:00Z'))).toBe('2026-10-31');
  });
});

describe('monthKey', () => {
  test('extracts YYYY-MM', () => {
    expect(monthKey('2026-10-24')).toBe('2026-10');
  });
});

describe('daysLeftInMonth', () => {
  test('counts the given day itself', () => {
    expect(daysLeftInMonth('2026-10-31')).toBe(1);
    expect(daysLeftInMonth('2026-10-24')).toBe(8);
  });
  test('handles leap February', () => {
    expect(daysLeftInMonth('2028-02-01')).toBe(29);
    expect(daysLeftInMonth('2027-02-01')).toBe(28);
  });
});
