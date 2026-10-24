import { YA2025 } from './ya2025';
import type { TaxYearData } from './types';

export const TAX_YEARS: Record<number, TaxYearData> = { 2025: YA2025 };

/** The newest year this build has figures for. */
export const LATEST_TAX_YEAR: TaxYearData = TAX_YEARS[Math.max(...Object.keys(TAX_YEARS).map(Number))];

/**
 * Rates and reliefs to use for a year of assessment. LHDN publishes each year's figures late, so for a
 * year without data this returns the newest earlier year (or the oldest one if the year is before them
 * all) and `exact: false`, so screens can say which figures were used.
 */
export function resolveTaxData(
  year: number,
  years: Record<number, TaxYearData> = TAX_YEARS,
): { data: TaxYearData; exact: boolean } {
  const available = Object.keys(years).map(Number).sort((a, b) => a - b);
  const earlier = available.filter((y) => y <= year);
  const chosen = earlier.length > 0 ? earlier[earlier.length - 1] : available[0];
  return { data: years[chosen], exact: chosen === year };
}

export type { TaxYearData, ReliefDef, Bracket } from './types';
