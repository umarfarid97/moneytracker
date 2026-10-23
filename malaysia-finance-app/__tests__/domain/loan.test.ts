import {
  assessLoan, LOAN_DEFAULTS, maxPrincipal, monthlyInstalment, parseRatePct, parseYears,
} from '@/domain/loan';

describe('monthlyInstalment', () => {
  test('reducing balance: RM 300,000 at 4.5% for 30 years is RM 1,520.06', () => {
    expect(monthlyInstalment(30000000, 4.5, 360, 'reducing')).toBe(152006);
  });
  test('flat rate: RM 50,000 at 3% for 5 years is RM 958.33', () => {
    expect(monthlyInstalment(5000000, 3, 60, 'flat')).toBe(95833);
  });
  test('0% rate is principal divided by months, for both methods', () => {
    expect(monthlyInstalment(1200000, 0, 12, 'reducing')).toBe(100000);
    expect(monthlyInstalment(1200000, 0, 12, 'flat')).toBe(100000);
  });
  test('tenure of 0 months is treated as 1 month, never NaN or Infinity', () => {
    const zero = monthlyInstalment(100000, 5, 0, 'reducing');
    expect(Number.isFinite(zero)).toBe(true);
    expect(zero).toBe(monthlyInstalment(100000, 5, 1, 'reducing'));
  });
  test('0 principal gives 0', () => {
    expect(monthlyInstalment(0, 4.5, 360, 'reducing')).toBe(0);
  });
});

describe('maxPrincipal', () => {
  test.each([
    ['reducing', 4.5, 360],
    ['reducing', 0, 120],
    ['flat', 3, 60],
  ] as const)('round-trips within 1 sen (%s, %s%%, %s months)', (method, rate, months) => {
    const instalment = 225000;
    const principal = maxPrincipal(instalment, rate, months, method);
    expect(Math.abs(monthlyInstalment(principal, rate, months, method) - instalment)).toBeLessThanOrEqual(1);
    expect(monthlyInstalment(principal, rate, months, method)).toBeLessThanOrEqual(instalment + 1);
  });
  test('zero or negative instalment gives 0', () => {
    expect(maxPrincipal(0, 4.5, 360, 'reducing')).toBe(0);
    expect(maxPrincipal(-100, 4.5, 360, 'reducing')).toBe(0);
  });
});

describe('LOAN_DEFAULTS', () => {
  test('match the design document', () => {
    expect(LOAN_DEFAULTS.home).toEqual({ ratePct: 4.5, maxYears: 35, method: 'reducing' });
    expect(LOAN_DEFAULTS.car).toEqual({ ratePct: 3.0, maxYears: 9, method: 'flat' });
    expect(LOAN_DEFAULTS.personal).toEqual({ ratePct: 8.0, maxYears: 10, method: 'reducing' });
  });
});

describe('assessLoan', () => {
  const home = { kind: 'home' as const, ratePct: 4.5, months: 360, method: 'reducing' as const };

  test('net RM 5,000 with RM 1,000 commitments: max RM 2,250, comfortable RM 1,500', () => {
    const r = assessLoan({ netMonthly: 500000, commitments: 100000, ...home });
    expect(r.maxInstalment).toBe(225000);
    expect(r.comfortableInstalment).toBe(150000);
    expect(r.comfortablePrincipal).toBeLessThan(r.maxPrincipal);
    expect(r.verdict).toBeUndefined();
  });

  test('commitments above 65% of net give zero everywhere and not-suitable', () => {
    const r = assessLoan({ netMonthly: 500000, commitments: 400000, requestedPrincipal: 1000000, ...home });
    expect(r.maxInstalment).toBe(0);
    expect(r.maxPrincipal).toBe(0);
    expect(r.comfortablePrincipal).toBe(0);
    expect(r.verdict).toBe('not-suitable');
  });

  test('net income of 0 is always not-suitable', () => {
    const r = assessLoan({ netMonthly: 0, commitments: 0, requestedPrincipal: 1000, ...home });
    expect(r.verdict).toBe('not-suitable');
    expect(r.maxPrincipal).toBe(0);
  });

  test('verdict thresholds: comfortable up to 50%, tight up to 65%, else not-suitable', () => {
    const net = 1000000;
    const at = (instalmentSen: number) =>
      assessLoan({
        netMonthly: net, commitments: 0, kind: 'personal', ratePct: 0, months: 1, method: 'reducing',
        requestedPrincipal: instalmentSen,
      }).verdict;
    expect(at(500000)).toBe('comfortable');
    expect(at(500001)).toBe('tight');
    expect(at(650000)).toBe('tight');
    expect(at(650001)).toBe('not-suitable');
  });
});

describe('parseRatePct', () => {
  test('accepts rates from 0 to 30 with up to two decimals', () => {
    expect(parseRatePct('4.5')).toBe(4.5);
    expect(parseRatePct('0')).toBe(0);
    expect(parseRatePct(' 3.25 ')).toBe(3.25);
    expect(parseRatePct('30')).toBe(30);
  });
  test('rejects blank, text, negatives, too many decimals and rates above 30', () => {
    for (const bad of ['', '  ', 'abc', '-1', '4.555', '30.01', '31', '4,5', '.']) {
      expect(parseRatePct(bad)).toBeNull();
    }
  });
});

describe('parseYears', () => {
  test('whole years from 1 up to the maximum', () => {
    expect(parseYears('35', 35)).toBe(35);
    expect(parseYears('1', 35)).toBe(1);
  });
  test('rejects zero, above the maximum, decimals and text', () => {
    for (const bad of ['0', '36', '1.5', '', 'x', '-3']) {
      expect(parseYears(bad, 35)).toBeNull();
    }
  });
});

describe('assessLoan without a requested amount (review finding)', () => {
  const home = { kind: 'home' as const, ratePct: 4.5, months: 360, method: 'reducing' as const };
  test('says not-suitable when commitments already use up the limit', () => {
    expect(assessLoan({ netMonthly: 500000, commitments: 400000, ...home }).verdict).toBe('not-suitable');
    expect(assessLoan({ netMonthly: 500000, commitments: 325000, ...home }).verdict).toBe('not-suitable');
  });
  test('has no verdict while there is room to borrow', () => {
    expect(assessLoan({ netMonthly: 500000, commitments: 324999, ...home }).verdict).toBeUndefined();
  });
});
