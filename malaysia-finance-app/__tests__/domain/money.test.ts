import { formatRM, parseRM, rmToSen } from '@/domain/money';

describe('parseRM', () => {
  test('parses thousands separators and one decimal', () => {
    expect(parseRM('1,234.5')).toBe(123450);
  });
  test('parses a leading-dot amount', () => {
    expect(parseRM('.5')).toBe(50);
  });
  test('parses a whole number', () => {
    expect(parseRM('12')).toBe(1200);
  });
  test('rejects more than two decimals', () => {
    expect(parseRM('12.999')).toBeNull();
  });
  test('rejects empty, letters, negatives and lone dot', () => {
    expect(parseRM('')).toBeNull();
    expect(parseRM('   ')).toBeNull();
    expect(parseRM('abc')).toBeNull();
    expect(parseRM('-5')).toBeNull();
    expect(parseRM('.')).toBeNull();
  });
  test('rejects absurdly large amounts instead of losing precision', () => {
    expect(parseRM('99999999999999999999')).toBeNull();
  });
});

describe('formatRM', () => {
  test('formats with grouping and two decimals', () => {
    expect(formatRM(123450)).toBe('RM 1,234.50');
    expect(formatRM(0)).toBe('RM 0.00');
    expect(formatRM(5)).toBe('RM 0.05');
  });
  test('formats negatives with a leading minus', () => {
    expect(formatRM(-6000)).toBe('-RM 60.00');
  });
});

describe('rmToSen', () => {
  test('rounds half up', () => {
    expect(rmToSen(1.005)).toBe(101);
    expect(rmToSen(12.5)).toBe(1250);
  });
});
