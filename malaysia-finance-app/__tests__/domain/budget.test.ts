import { categoryStatus, dailyAllowance } from '@/domain/budget';

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
