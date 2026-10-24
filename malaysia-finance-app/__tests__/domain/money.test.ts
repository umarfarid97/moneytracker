import { formatRM, parsePercent, parseRM, rmToSen, senToInput } from '@/domain/money';

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

describe('senToInput', () => {
  test('writes sen as editable text that parseRM reads back', () => {
    expect(senToInput(1250)).toBe('12.50');
    expect(senToInput(5)).toBe('0.05');
    expect(senToInput(123450)).toBe('1234.50');
    expect(parseRM(senToInput(987654))).toBe(987654);
  });
});

describe('parsePercent', () => {
  test('reads 0 to max with up to two decimals', () => {
    expect(parsePercent('100', 100)).toBe(100);
    expect(parsePercent('9', 100)).toBe(9);
    expect(parsePercent('11.25', 100)).toBe(11.25);
    expect(parsePercent('0', 30)).toBe(0);
  });
  test('rejects above max, bad text and too many decimals', () => {
    for (const [text, max] of [['100.01', 100], ['101', 100], ['31', 30], ['abc', 100], ['', 100], ['1.234', 100], ['-5', 100]] as const) {
      expect(parsePercent(text, max)).toBeNull();
    }
  });
});

describe('parseRM thousands separators (review finding: "12,50" must not become RM 1,250)', () => {
  test('commas are accepted only as proper groups of three digits', () => {
    expect(parseRM('1,234')).toBe(123400);
    expect(parseRM('12,345,678.90')).toBe(1234567890);
    expect(parseRM('999,999.5')).toBe(99999950);
  });
  test('a decimal comma or misplaced comma is rejected, not read as thousands', () => {
    for (const bad of ['12,50', '1,2,3', '1,23', ',5', '1,2345', '12,5', '1,234,56']) {
      expect(parseRM(bad)).toBeNull();
    }
  });
});
