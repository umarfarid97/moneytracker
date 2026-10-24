import { addDays, dayLabel, dayMonth, shortDate, daysLeftInMonth, isValidDate, monthKey, monthLabel, shiftMonth, todayKL } from '@/domain/dates';

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

describe('addDays', () => {
  test('moves across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('dayLabel', () => {
  test('says Today and Yesterday, otherwise weekday and date', () => {
    expect(dayLabel('2026-10-24', '2026-10-24')).toBe('Today');
    expect(dayLabel('2026-10-23', '2026-10-24')).toBe('Yesterday');
    expect(dayLabel('2026-10-20', '2026-10-24')).toBe('Tue 20 Oct');
  });
});

describe('monthLabel and shiftMonth', () => {
  test('labels a month and shifts across years', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-10', -10)).toBe('2025-12');
  });
});

describe('isValidDate', () => {
  test('accepts real dates only', () => {
    expect(isValidDate('2026-10-24')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2027-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('24/10/2026')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('shortDate', () => {
  test('weekday, day and month', () => {
    expect(shortDate('2026-10-24')).toBe('Sat 24 Oct');
    expect(shortDate('2027-01-01')).toBe('Fri 1 Jan');
  });
});

describe('dayMonth', () => {
  test('day and short month', () => {
    expect(dayMonth('2025-06-10')).toBe('10 Jun');
    expect(dayMonth('2026-12-01')).toBe('1 Dec');
  });
});
