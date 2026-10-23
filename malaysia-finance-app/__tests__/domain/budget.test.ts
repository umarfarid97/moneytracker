import { categoryStatus, dailyAllowance, todayLeft } from '@/domain/budget';

describe('categoryStatus', () => {
  test('below 80% is on-track', () => {
    expect(categoryStatus(7999, 10000)).toEqual({ left: 2001, status: 'on-track' });
  });
  test('exactly 80% is tight', () => {
    expect(categoryStatus(8000, 10000).status).toBe('tight');
  });
  test('exactly 100% is tight with nothing left', () => {
    expect(categoryStatus(10000, 10000)).toEqual({ left: 0, status: 'tight' });
  });
  test('above 100% is over and left is negative', () => {
    expect(categoryStatus(10001, 10000)).toEqual({ left: -1, status: 'over' });
  });
  test('limit 0: any spend is over, no spend is on-track', () => {
    expect(categoryStatus(1, 0).status).toBe('over');
    expect(categoryStatus(0, 0).status).toBe('on-track');
  });
});

describe('dailyAllowance', () => {
  test('divides what is left by the days left, rounded down', () => {
    expect(dailyAllowance(10000, 3)).toBe(3333);
  });
  test('never negative', () => {
    expect(dailyAllowance(-500, 5)).toBe(0);
  });
  test('zero days left is treated as one', () => {
    expect(dailyAllowance(1200, 0)).toBe(1200);
  });
});

describe('todayLeft', () => {
  test('splits what was left at the start of today over the days remaining, then subtracts today', () => {
    // RM600 limit, RM420 spent this month of which RM20 today, 6 days left including today:
    // start of day left = 600 - 400 = 200 -> RM33.33 a day -> minus RM20 spent = RM13.33
    expect(todayLeft({ monthLimit: 60000, monthSpent: 42000, todaySpent: 2000, daysLeft: 6 })).toEqual({
      perDay: 3333,
      left: 1333,
    });
  });
  test('going over today gives a negative left', () => {
    expect(todayLeft({ monthLimit: 10000, monthSpent: 9000, todaySpent: 5000, daysLeft: 2 }).left).toBe(-2000);
  });
  test('already over the month budget gives zero per day', () => {
    expect(todayLeft({ monthLimit: 10000, monthSpent: 12000, todaySpent: 0, daysLeft: 3 })).toEqual({
      perDay: 0,
      left: 0,
    });
  });
});
