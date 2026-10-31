import type { TaxYearData } from '@/data/tax/types';
import { isReceiptReference } from '@/receiptReference';
import { isValidDate } from './dates';
import type { ReliefPack, PackSection } from './reliefPack';
import { capReliefClaims } from './reliefs';
import { calculateTaxBill, type TaxBillInput } from './taxBill';
import type { Expense, ReliefClaim } from './types';

/** Detect records a category-based pack cannot display (e.g. imported unknown relief ids). */
export function auditTaxRecords(year: number, data: TaxYearData, expenses: Expense[], claims: ReliefClaim[]): number {
  const known = new Set(data.reliefs.map(r => r.id));
  const valid = (n: number) => Number.isSafeInteger(n) && n > 0;
  return claims.filter(c => c.year === year && (!known.has(c.reliefId) || !valid(c.amount))).length +
    expenses.filter(e => e.id > 0 && e.reliefId !== null &&
      (Number(e.date.slice(0, 4)) === year || !/^\d{4}-/.test(e.date)) &&
      (!known.has(e.reliefId) || !isValidDate(e.date) || !valid(e.amount) ||
        (e.reliefAmount !== null && (!valid(e.reliefAmount) || e.reliefAmount > e.amount)))).length;
}

export type ReviewKind = 'missing' | 'note' | 'duplicate' | 'cap' | 'invalid';
export type ReviewIssue = { reliefId: string; kind: ReviewKind; count: number };

/** Include the entire pack: changes in another category can consume a shared limit or introduce a duplicate. */
export function reviewKey(pack: ReliefPack, section: PackSection): string {
  return JSON.stringify([pack.year, pack.ya, section.reliefId, pack.sections]);
}

export function reviewTaxPack(pack: ReliefPack, data: TaxYearData) {
  const issues: ReviewIssue[] = [];
  const all = pack.sections.flatMap(s => s.items.map(it => ({ ...it, reliefId: s.reliefId })));
  for (const section of pack.sections) {
    const add = (kind: ReviewKind, count: number) => { if (count) issues.push({ reliefId: section.reliefId, kind, count }); };
    add('missing', section.items.filter(it => it.receipt === 'missing').length);
    add('note', section.items.filter(it => !it.note.trim()).length);
    add('invalid', section.items.filter(it => !Number.isSafeInteger(it.amount) || it.amount <= 0 || it.amount > it.spent ||
      (it.receiptUri !== null && !isReceiptReference(it.receiptUri)) ||
      (it.date !== null && (!isValidDate(it.date) || Number(it.date.slice(0, 4)) !== pack.year))).length);
    add('duplicate', section.items.filter(it => all.some(other =>
      (other.source !== it.source || other.id !== it.id) && (
        (it.receiptUri !== null && it.receiptUri === other.receiptUri) ||
        (it.note.trim().length > 0 && it.note.trim().toLowerCase() === other.note.trim().toLowerCase() &&
          it.amount === other.amount && it.date === other.date && section.reliefId === other.reliefId)
      ))).length);
    add('cap', section.claimed > section.allowed ? 1 : 0);
  }
  return { items: all.length, issues, exact: pack.year === data.ya && pack.ya === data.ya };
}

/** Only user-reviewed, evidenced, valid records can appear as confirmed reference figures. */
export function confirmedTaxPack(pack: ReliefPack, data: TaxYearData, confirmations: string[], acknowledged: string[]): ReliefPack {
  const review = reviewTaxPack(pack, data);
  const sections = !review.exact ? [] : pack.sections.filter(s => {
    const key = reviewKey(pack, s);
    return confirmations.includes(key) && !review.issues.some(i => i.reliefId === s.reliefId &&
      (i.kind === 'missing' || i.kind === 'note' || i.kind === 'invalid' || (i.kind === 'duplicate' && !acknowledged.includes(key))));
  });
  // Keep the full pack's allocation of shared limits. Excluding a section must not increase another's allowance.
  const automatic = review.exact ? pack.automatic : [];
  return { ...pack, sections, automatic, total: automatic.reduce((n, a) => n + a.amount, 0) + sections.reduce((n, s) => n + s.allowed, 0), missingReceipts: 0 };
}

export function previewTaxSaving(input: TaxBillInput, claims: ReliefClaim[], reliefId: string, amount: number, data: TaxYearData) {
  const beforeReliefs = capReliefClaims(claims, data.reliefs).total;
  const candidate: ReliefClaim = { id: Math.max(0, ...claims.map(c => c.id)) + 1, year: data.ya, reliefId,
    amount: Number.isSafeInteger(amount) ? Math.max(0, amount) : 0, note: '', receiptUri: null };
  const afterReliefs = capReliefClaims([...claims, candidate], data.reliefs).total;
  const automatic = data.automaticReliefs.reduce((n, r) => n + r.amount, 0);
  const before = calculateTaxBill({ ...input, reliefsTotal: automatic + beforeReliefs }, data);
  const after = calculateTaxBill({ ...input, reliefsTotal: automatic + afterReliefs }, data);
  return { eligible: Math.max(0, afterReliefs - beforeReliefs), saving: Math.max(0, before.tax - after.tax), before: before.tax, after: after.tax };
}
