import { sanitizeNumber } from '@/ui/numeric';

describe('sanitizeNumber', () => {
  test('drops letters, signs, commas and symbols', () => {
    expect(sanitizeNumber('RM 1,2a3-4$')).toBe('1234');
  });
  test('keeps one decimal point and limits the digits after it', () => {
    expect(sanitizeNumber('1.2.3')).toBe('1.23');
    expect(sanitizeNumber('12.999')).toBe('12.99');
    expect(sanitizeNumber('12.5', 3)).toBe('12.5');
  });
  test('whole-number fields lose the decimal point', () => {
    expect(sanitizeNumber('3.5', 0)).toBe('35');
  });
});
