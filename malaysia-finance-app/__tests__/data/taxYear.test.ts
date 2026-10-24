import { resolveTaxData, TAX_YEARS } from '@/data/tax';
import { YA2025 } from '@/data/tax/ya2025';
import type { TaxYearData } from '@/data/tax/types';

describe('resolveTaxData', () => {
  test('uses the exact year when LHDN figures exist for it', () => {
    expect(resolveTaxData(2025)).toEqual({ data: YA2025, exact: true });
  });

  test('a year with no published figures uses the newest earlier year and says it is not exact', () => {
    expect(resolveTaxData(2026)).toEqual({ data: YA2025, exact: false });
    expect(resolveTaxData(2031)).toEqual({ data: YA2025, exact: false });
  });

  test('a year before any data falls back to the oldest available year', () => {
    expect(resolveTaxData(2022)).toEqual({ data: YA2025, exact: false });
  });

  test('with several years it picks the newest year that is not after the requested one', () => {
    const ya2026 = { ...YA2025, ya: 2026 } as TaxYearData;
    const years = { 2025: YA2025, 2026: ya2026, 2028: { ...YA2025, ya: 2028 } as TaxYearData };
    expect(resolveTaxData(2026, years).data.ya).toBe(2026);
    expect(resolveTaxData(2027, years)).toEqual({ data: ya2026, exact: false });
    expect(resolveTaxData(2028, years).exact).toBe(true);
  });

  test('every registered year is keyed by its own ya', () => {
    for (const [key, data] of Object.entries(TAX_YEARS)) expect(data.ya).toBe(Number(key));
  });
});
