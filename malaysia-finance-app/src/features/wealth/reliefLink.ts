import type { Sen } from '@/domain/money';
import type { ReliefClaim } from '@/domain/types';

/** Marks a relief claim that this app keeps up to date from the EPF / SOCSO records, so it never doubles up. */
export const RECORDS_NOTE = 'From my records';

/**
 * Makes the claim for one relief and year equal `amount`: adds it, updates the one made earlier from the
 * records, or removes it when `amount` is zero. Claims typed in by hand are left alone.
 */
export async function syncRecordClaim(
  manual: ReliefClaim[],
  ops: {
    add: (c: Omit<ReliefClaim, 'id'>) => Promise<unknown>;
    update: (c: ReliefClaim) => Promise<void>;
    remove: (id: number) => Promise<void>;
  },
  reliefId: string,
  year: number,
  amount: Sen,
): Promise<void> {
  const existing = manual.find((c) => c.reliefId === reliefId && c.year === year && c.note === RECORDS_NOTE);
  if (amount <= 0) {
    if (existing) await ops.remove(existing.id);
  } else if (existing) {
    if (existing.amount !== amount) await ops.update({ ...existing, amount });
  } else {
    await ops.add({ reliefId, year, amount, receiptUri: null, note: RECORDS_NOTE });
  }
}
