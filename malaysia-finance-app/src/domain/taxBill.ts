import type { TaxYearData } from '@/data/tax/types';
import type { Sen } from './money';
import { donationDeduction } from './giving';
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
  /** Approved donations (sedekah, waqf), deducted from income up to 10% of it. */
  donations?: Sen;
  /** Spouse has no income, so the spouse rebate may apply. */
  spouseRebate: boolean;
};

export type TaxBill = {
  chargeable: Sen;
  /** The part of the donations that is deducted from income. */
  donationDeduction: Sen;
  tax: Sen;
  rebate: Sen;
  byBracket: BracketResult[];
  /** Tax minus tax already paid: positive is still to pay, negative is a refund. */
  balance: Sen;
};

const positive = (n: Sen) => Math.max(0, n);

/** Estimates a resident individual's tax for one year of assessment. Negative inputs count as zero. */
export function calculateTaxBill(input: TaxBillInput, data: TaxYearData): TaxBill {
  const income = {
    salary: positive(input.salary),
    freelanceGross: positive(input.freelanceGross),
    businessGross: positive(input.businessGross),
    allowableExpenses: positive(input.allowableExpenses),
  };
  const aggregate = chargeableIncome({ ...income, reliefsTotal: 0 });
  const deduction = donationDeduction(positive(input.donations ?? 0), aggregate);
  const chargeable = chargeableIncome({ ...income, reliefsTotal: positive(input.reliefsTotal) + deduction });
  const { tax, rebate, byBracket } = computeTax(chargeable, data, {
    spouseRebate: input.spouseRebate,
    zakat: positive(input.zakat),
  });
  return { chargeable, donationDeduction: deduction, tax, rebate, byBracket, balance: tax - positive(input.pcb) };
}
