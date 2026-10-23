import { YA2025 } from './ya2025';
import type { TaxYearData } from './types';

export const TAX_YEARS: Record<number, TaxYearData> = { 2025: YA2025 };

/** The newest year this build has figures for. */
export const LATEST_TAX_YEAR: TaxYearData = TAX_YEARS[Math.max(...Object.keys(TAX_YEARS).map(Number))];

export type { TaxYearData, ReliefDef, Bracket } from './types';
