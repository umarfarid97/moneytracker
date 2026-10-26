import { parseRate, ratesFromResponse, rateToInput, toMyr } from '@/domain/fx';

describe('exchange rates', () => {
  test('parses a typed rate and rejects zero, text and too many decimals', () => {
    expect(parseRate('3.4')).toBe(3.4);
    expect(parseRate('.5')).toBe(0.5);
    expect(parseRate('0.000289')).toBe(0.000289);
    expect(parseRate('0')).toBeNull();
    expect(parseRate('')).toBeNull();
    expect(parseRate('abc')).toBeNull();
    expect(parseRate('1.1234567')).toBeNull();
  });

  test('converts a foreign amount to ringgit sen, rounding to the nearest sen', () => {
    expect(toMyr(2000, 3.3)).toBe(6600);
    expect(toMyr(1001, 3.3333)).toBe(3337);
    expect(toMyr(50_000_000, 0.000289)).toBe(14450);
  });

  test('shows a rate without trailing zeros', () => {
    expect(rateToInput(3.3)).toBe('3.3');
    expect(rateToInput(3.30001234)).toBe('3.3');
    expect(rateToInput(0.000289)).toBe('0.000289');
  });

  test('turns the service answer (currency per RM 1) into ringgit per unit', () => {
    const rates = ratesFromResponse({ result: 'success', rates: { SGD: 0.3, USD: 0.25, ZZZ: 9 } }, 123);
    expect(rates?.fetchedAt).toBe(123);
    expect(rates?.perUnit.SGD).toBeCloseTo(3.3333, 3);
    expect(rates?.perUnit.USD).toBeCloseTo(4, 5);
    expect(rates?.perUnit.ZZZ).toBeUndefined();
  });

  test('ignores an error or empty answer', () => {
    expect(ratesFromResponse({ result: 'error' }, 1)).toBeNull();
    expect(ratesFromResponse({ rates: {} }, 1)).toBeNull();
    expect(ratesFromResponse(null, 1)).toBeNull();
  });
});
