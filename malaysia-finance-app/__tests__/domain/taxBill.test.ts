import { calculateTaxBill, type TaxBillInput } from '@/domain/taxBill';
import { YA2025 } from '@/data/tax/ya2025';

const rm = (n: number) => n * 100;
const base: TaxBillInput = {
  salary: 0, freelanceGross: 0, businessGross: 0, allowableExpenses: 0,
  reliefsTotal: rm(9000), pcb: 0, zakat: 0, spouseRebate: false,
};
const bill = (over: Partial<TaxBillInput>) => calculateTaxBill({ ...base, ...over }, YA2025);

describe('calculateTaxBill', () => {
  test('no income gives a zero bill and never goes negative', () => {
    const b = bill({});
    expect(b).toMatchObject({ chargeable: 0, tax: 0, balance: 0 });
  });

  test('RM 60,000 salary less RM 9,000 relief is RM 51,000 chargeable and RM 1,610 tax', () => {
    const b = bill({ salary: rm(60000) });
    expect(b.chargeable).toBe(rm(51000));
    expect(b.tax).toBe(rm(1610));
    expect(b.balance).toBe(rm(1610));
  });

  test('tax already paid (PCB) reduces the balance, and overpaying gives a refund', () => {
    expect(bill({ salary: rm(60000), pcb: rm(1500) }).balance).toBe(rm(110));
    expect(bill({ salary: rm(60000), pcb: rm(2000) }).balance).toBe(-rm(390));
  });

  test('freelance and business income count after their expenses; expenses never reduce salary', () => {
    expect(bill({ freelanceGross: rm(20000), allowableExpenses: rm(6000) }).chargeable).toBe(rm(5000));
    expect(bill({ salary: rm(30000), allowableExpenses: rm(8000) }).chargeable).toBe(rm(21000));
    expect(bill({ salary: rm(30000), businessGross: rm(10000), freelanceGross: rm(5000), allowableExpenses: rm(3000) }).chargeable)
      .toBe(rm(33000));
  });

  test('low incomes get the RM 400 rebate, and RM 800 when the spouse has no income', () => {
    const one = bill({ salary: rm(40000) });
    expect(one.chargeable).toBe(rm(31000));
    expect(one.rebate).toBe(rm(400));
    expect(one.tax).toBe(rm(80));
    expect(bill({ salary: rm(40000), spouseRebate: true }).tax).toBe(0);
  });

  test('zakat paid reduces tax but not below zero', () => {
    expect(bill({ salary: rm(60000), zakat: rm(600) }).tax).toBe(rm(1010));
    expect(bill({ salary: rm(60000), zakat: rm(99999) }).tax).toBe(0);
  });

  test('the bracket breakdown adds up to the chargeable income', () => {
    const b = bill({ salary: rm(250000) });
    expect(b.byBracket.reduce((s, x) => s + x.taxed, 0)).toBe(b.chargeable);
  });

  test('negative inputs are treated as zero', () => {
    expect(bill({ salary: -rm(5), pcb: -rm(5) }).balance).toBe(0);
  });
});
