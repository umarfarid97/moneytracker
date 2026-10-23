import type { ReliefDef } from '@/data/tax/types';
import type { Sen } from './money';
import type { ReliefClaim } from './types';

export type ReliefSummary = {
  perRelief: Record<string, { claimed: Sen; allowed: Sen }>;
  total: Sen;
  /** Receipt-required reliefs that have at least one claim without a receipt. */
  missingReceipts: string[];
};

/** Applies each relief's limit, then each group's shared limit, in the order reliefs appear in `defs`. */
export function capReliefClaims(claims: ReliefClaim[], defs: ReliefDef[]): ReliefSummary {
  const perRelief: ReliefSummary['perRelief'] = {};
  const missingReceipts: string[] = [];
  const groupUsed: Record<string, number> = {};
  let total = 0;

  for (const def of defs) {
    const mine = claims.filter((c) => c.reliefId === def.id);
    if (mine.length === 0) continue;
    const claimed = mine.reduce((s, c) => s + c.amount, 0);
    let allowed = def.perItem
      ? mine.reduce((s, c) => s + Math.min(c.amount, def.limit), 0)
      : Math.min(claimed, def.limit);
    if (def.group && def.groupLimit !== undefined) {
      const room = Math.max(0, def.groupLimit - (groupUsed[def.group] ?? 0));
      allowed = Math.min(allowed, room);
      groupUsed[def.group] = (groupUsed[def.group] ?? 0) + allowed;
    }
    perRelief[def.id] = { claimed, allowed };
    total += allowed;
    if (def.requiresReceipt && mine.some((c) => c.receiptUri === null)) missingReceipts.push(def.id);
  }
  return { perRelief, total, missingReceipts };
}
