import { billerFor } from './billers';
import { subscriptionFor } from './subscriptions';
import { bnplFor } from './loanTracker';
import { brandFor as bankFor } from './banks';
import { matcher } from './brandMatch';
import type { LoanType } from './types';

/** `icon` is an Ionicons name drawn on the badge when no real logo or brand mark is bundled for the id. */
export type BillBrand = { id: string; initials: string; color: string; ink: string; icon?: string };

export const LOAN_ICON: Record<LoanType, string> = { home: 'home', car: 'car', ptptn: 'school', personal: 'cash', bnpl: 'card' };

const LOAN_LOOK: Record<LoanType, { color: string; initials: string }> = {
  home: { color: '#2563eb', initials: 'HL' },
  car: { color: '#0e7490', initials: 'CL' },
  ptptn: { color: '#1e3a8a', initials: 'PTPTN' },
  personal: { color: '#7c3aed', initials: 'PL' },
  bnpl: { color: '#475569', initials: 'PL' },
};

/** Lenders that are not payment methods in banks.ts. Brand-like colours, no logos. */
const LENDERS = [
  { id: 'ptptn', name: 'PTPTN', initials: 'PTPTN', color: '#1e3a8a', ink: '#ffffff', aliases: ['perbadanan tabung pendidikan tinggi nasional'] },
  { id: 'mbsb', name: 'MBSB', initials: 'MBSB', color: '#0f766e', ink: '#ffffff', aliases: ['mbsb bank'] },
  { id: 'aeon-credit', name: 'AEON Credit', initials: 'AEON', color: '#c8007a', ink: '#ffffff', aliases: ['aeon'] },
];
const lenderFor = matcher(LENDERS);
const LOANISH = /\b(loan|loans|financing|pinjaman|ptptn|hire purchase|instalment|installment)\b/i;

/** The bank or lender a loan is with ("Maybank car loan" is Maybank), shown with the loan type's icon. */
function lenderBrand(name: string, loanType?: LoanType | null): BillBrand | null {
  const l = lenderFor(name) ?? bankFor(name);
  if (!l) return null;
  return { id: l.id, initials: l.initials, color: l.color, ink: l.ink, icon: LOAN_ICON[loanType ?? (l.id === 'ptptn' ? 'ptptn' : 'personal')] };
}

/** Words that name a kind of expense, not a company: "Gym shoes" or "Rent deposit" should not get a brand badge in Spending. */
const GENERIC = new Set(['gym', 'rent', 'maintenance', 'assessment', 'yes', 'takaful', 'time']);

/**
 * The brand a bill, loan or subscription is named after, or null for custom names. Subscriptions are tried
 * before billers so "Astro" and "Notion" resolve the same way everywhere.
 */
export function brandForBill(name: string, kind?: 'bill' | 'loan' | 'subscription', loanType?: LoanType | null): BillBrand | null {
  if (kind === 'loan') {
    const pay = bnplFor(name);
    if (pay) return { ...pay, icon: LOAN_ICON.bnpl };
    const lender = lenderBrand(name, loanType);
    if (lender) return lender;
    // No lender named: still a tile of the loan type (car, home, PTPTN) rather than a plain icon.
    const type = loanType ?? 'personal';
    return { id: `loan-${type}`, initials: LOAN_LOOK[type].initials, color: LOAN_LOOK[type].color, ink: '#ffffff', icon: LOAN_ICON[type] };
  }
  const found = (kind !== 'bill' ? subscriptionFor(name) : null) ?? billerFor(name) ?? subscriptionFor(name) ?? bnplFor(name);
  if (found) return found;
  // A payment note such as "Maybank car loan" in Spending.
  return kind === undefined && LOANISH.test(name) ? lenderBrand(name) : null;
}

/** The brand an expense's note names (a paid Netflix bill, "Spotify"), ignoring generic words. Null when the note is empty. */
export function brandForNote(note: string): BillBrand | null {
  if (!note.trim()) return null;
  const brand = brandForBill(note);
  return brand && !GENERIC.has(brand.id) ? brand : null;
}
