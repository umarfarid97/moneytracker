import type { Expense, ReliefClaim } from './types';

/**
 * Spending tagged to a tax relief, as relief claims. The year of assessment is the year of the spending
 * date, and only the claimable part counts (all of it unless a claimable amount was entered).
 * Ids are the negative of the spending id so they never clash with manual claims.
 */
export function claimsFromExpenses(expenses: Expense[]): ReliefClaim[] {
  return expenses
    .filter((e) => e.reliefId !== null && e.id > 0)
    .map((e) => ({
      id: -e.id,
      reliefId: e.reliefId as string,
      year: Number(e.date.slice(0, 4)),
      amount: Math.min(Math.max(e.reliefAmount ?? e.amount, 0), e.amount),
      receiptUri: e.receiptUri,
      note: e.note,
    }));
}

const SUGGESTIONS: Record<string, string> = {
  kesihatan: 'medical-serious',
  pendidikan: 'education-self',
};

/** The relief a category usually belongs to, offered as a suggestion only. */
export function suggestRelief(categoryName: string): string | null {
  return SUGGESTIONS[categoryName.trim().toLowerCase()] ?? null;
}
