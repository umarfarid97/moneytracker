import type { Sen } from './money';

export type GivingKind = 'zakat' | 'fitrah' | 'sedekah' | 'waqf';

export type GivingRecord = {
  id: number;
  kind: GivingKind;
  date: string;
  amount: Sen;
  recipient: string;
  note: string;
  /** Counts toward tax: zakat and fitrah as a rebate, sedekah and waqf as an approved donation. */
  countsForTax: boolean;
};
export type NewGivingRecord = Omit<GivingRecord, 'id'>;

export const GIVING_KINDS: GivingKind[] = ['zakat', 'fitrah', 'sedekah', 'waqf'];
export const isZakat = (k: GivingKind) => k === 'zakat' || k === 'fitrah';

export const byDateDesc = (a: GivingRecord, b: GivingRecord) =>
  a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1;

export type GivingSummary = {
  total: Sen;
  zakat: Sen;
  sedekah: Sen;
  /** Zakat and fitrah counted toward tax: taken off the tax itself, ringgit for ringgit. */
  zakatForTax: Sen;
  /** Sedekah and waqf counted toward tax: deducted from income, up to 10% of it. */
  donationsForTax: Sen;
};

export function summariseGiving(records: GivingRecord[], year: number): GivingSummary {
  const list = records.filter((r) => Number(r.date.slice(0, 4)) === year);
  const sum = (pick: (r: GivingRecord) => boolean) => list.filter(pick).reduce((s, r) => s + r.amount, 0);
  return {
    total: sum(() => true),
    zakat: sum((r) => isZakat(r.kind)),
    sedekah: sum((r) => !isZakat(r.kind)),
    zakatForTax: sum((r) => isZakat(r.kind) && r.countsForTax),
    donationsForTax: sum((r) => !isZakat(r.kind) && r.countsForTax),
  };
}

/** Approved donations are deductible up to 10% of aggregate income. */
export function donationDeduction(donations: Sen, aggregateIncome: Sen): Sen {
  return Math.max(0, Math.min(donations, Math.floor(Math.max(0, aggregateIncome) / 10)));
}

/** Gold is weighed in grams; the nisab (smallest amount zakat is due on) is 85 g of gold. */
export const NISAB_GOLD_GRAMS = 85;
const ZAKAT_RATE_PER_MILLE = 25; // 2.5%

export type ZakatInput = {
  /** Savings and investments held for a full year (haul). */
  savings: Sen;
  goldGrams: number;
  goldPricePerGram: Sen;
  /** Income for the year, and what you spent on basic needs from it. */
  annualIncome: Sen;
  annualNeeds: Sen;
};

export type ZakatResult = {
  nisab: Sen;
  savings: Sen;
  gold: Sen;
  income: Sen;
  total: Sen;
  /** False when the gold price is missing, so there is no nisab to compare with. */
  hasNisab: boolean;
};

const rate = (sen: number) => Math.round((sen * ZAKAT_RATE_PER_MILLE) / 1000);

/** Zakat on savings, gold and income: 2.5% of each part that reaches the nisab. A planning aid, not a ruling. */
export function calculateZakat(i: ZakatInput): ZakatResult {
  const nisab = Math.round(NISAB_GOLD_GRAMS * Math.max(0, i.goldPricePerGram));
  const hasNisab = nisab > 0;
  const due = (value: Sen) => (hasNisab && value >= nisab ? rate(value) : 0);
  const goldValue = Math.round(Math.max(0, i.goldGrams) * Math.max(0, i.goldPricePerGram));
  const goldDue = Math.max(0, i.goldGrams) >= NISAB_GOLD_GRAMS ? rate(goldValue) : 0;
  const savings = due(Math.max(0, i.savings));
  const income = due(Math.max(0, i.annualIncome - i.annualNeeds));
  return { nisab, savings, gold: goldDue, income, total: savings + goldDue + income, hasNisab };
}
