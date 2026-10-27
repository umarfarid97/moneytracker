import { billerFor } from './billers';
import { subscriptionFor } from './subscriptions';
import { bnplFor } from './loanTracker';

export type BillBrand = { id: string; initials: string; color: string; ink: string };

/** Words that name a kind of expense, not a company: "Gym shoes" or "Rent deposit" should not get a brand badge in Spending. */
const GENERIC = new Set(['gym', 'rent', 'maintenance', 'assessment', 'yes', 'takaful', 'time']);

/**
 * The brand a bill, loan or subscription is named after, or null for custom names. Subscriptions are tried
 * before billers so "Astro" and "Notion" resolve the same way everywhere.
 */
export function brandForBill(name: string, kind?: 'bill' | 'loan' | 'subscription'): BillBrand | null {
  if (kind === 'loan') return bnplFor(name);
  return (kind !== 'bill' ? subscriptionFor(name) : null) ?? billerFor(name) ?? subscriptionFor(name) ?? bnplFor(name);
}

/** The brand an expense's note names (a paid Netflix bill, "Spotify"), ignoring generic words. Null when the note is empty. */
export function brandForNote(note: string): BillBrand | null {
  if (!note.trim()) return null;
  const brand = brandForBill(note);
  return brand && !GENERIC.has(brand.id) ? brand : null;
}
