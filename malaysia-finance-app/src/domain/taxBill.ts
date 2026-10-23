import type { TaxYearData } from '@/data/tax/types';
import type { Sen } from './money';
import { chargeableIncome, computeTax, type BracketResult } from './tax';

export type TaxBillInput = {
  salary: Sen;
  freelanceGross: Sen;
  businessGross: Sen;
  allowableExpenses: Sen;
  /** Every relief the person gets: the automatic ones plus what they claimed. */
  reliefsTotal: Sen;
  /** Tax already paid in the year (PCB / instalments). */
  pcb: Sen;
  zakat: Sen;
  /** Spouse has no income, so the spouse rebate may apply. */
  spouseRebate: boolean;
};

export type TaxBill = {
  chargeable: Sen;
  tax: Sen;
  rebate: Sen;
  byBracket: BracketResult[];
  /** Tax minus tax already paid: positive is still to pay, negative is a refund. */
  balance: Sen;
};

const positive = (n: Sen) => Math.max(0, n);

/** Estimates a resident individual's tax for one year of assessment. Negative inputs count as zero. */
export function calculateTaxBill(input: TaxBillInput, data: TaxYearData): TaxBill {
  const chargeable = chargeableIncome({
    salary: positive(input.salary),
    freelanceGross: positive(input.freelanceGross),
    businessGross: positive(input.businessGross),
    allowableExpenses: positive(input.allowableExpenses),
    reliefsTotal: positive(input.reliefsTotal),
  });
  const { tax, rebate, byBracket } = computeTax(chargeable, data, {
    spouseRebate: input.spouseRebate,
    zakat: positive(input.zakat),
  });
  return { chargeable, tax, rebate, byBracket, balance: tax - positive(input.pcb) };
}
