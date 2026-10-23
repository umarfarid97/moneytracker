import type { TaxYearData } from '@/data/tax/types';
import type { Sen } from './money';

export type BracketResult = {
  from: Sen;
  to: Sen | null;
  ratePct: number;
  taxed: Sen;
  tax: Sen;
};

export type TaxResult = {
  /** Tax payable after rebates and zakat; never negative. */
  tax: Sen;
  /** Rebate the person is entitled to (before it is capped by the tax charged). */
  rebate: Sen;
  byBracket: BracketResult[];
};

/** Progressive tax for a resident individual. Only bands that income reaches are listed. */
export function computeTax(
  chargeable: Sen,
  data: TaxYearData,
  opts: { spouseRebate?: boolean; zakat?: Sen } = {},
): TaxResult {
  const income = Math.max(0, chargeable);
  const byBracket: BracketResult[] = [];
  let from = 0;
  let charged = 0;
  for (const band of data.brackets) {
    if (income <= from) break;
    const top = band.upTo === null ? income : Math.min(income, band.upTo);
    const taxed = top - from;
    const tax = Math.round((taxed * band.ratePct) / 100);
    byBracket.push({ from, to: band.upTo, ratePct: band.ratePct, taxed, tax });
    charged += tax;
    from = band.upTo ?? income;
  }
  const eligible = income <= data.rebateThreshold;
  const rebate = eligible ? data.rebateAmount + (opts.spouseRebate ? data.spouseRebate : 0) : 0;
  const afterRebate = Math.max(0, charged - rebate);
  const tax = Math.max(0, afterRebate - Math.max(0, opts.zakat ?? 0));
  return { tax, rebate, byBracket };
}

/** Income that is taxed: all income, less business expenses (against business/freelance income only), less reliefs. */
export function chargeableIncome(i: {
  salary: Sen;
  freelanceGross: Sen;
  businessGross: Sen;
  allowableExpenses: Sen;
  reliefsTotal: Sen;
}): Sen {
  const businessNet = Math.max(0, i.freelanceGross + i.businessGross - i.allowableExpenses);
  return Math.max(0, i.salary + businessNet - i.reliefsTotal);
}
