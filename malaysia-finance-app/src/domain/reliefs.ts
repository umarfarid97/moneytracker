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
    // Per-child reliefs: each claim typed in by hand is one child. Spending tagged to the relief does not say
    // which child it is for, so all of it counts as a single child (never more than the per-child limit).
    let allowed = def.perItem
      ? mine.filter((c) => c.id > 0).reduce((s, c) => s + Math.min(c.amount, def.limit), 0) +
        Math.min(mine.filter((c) => c.id <= 0).reduce((s, c) => s + c.amount, 0), def.limit)
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

export type ReliefSectionKey = 'family' | 'medical' | 'education' | 'savings' | 'home' | 'other';

const SECTION_OF: Record<string, ReliefSectionKey> = {
  spouse: 'family', 'spouse-disabled': 'family', 'disabled-individual': 'family', 'disabled-equipment': 'family',
  'child-under-18': 'family', 'child-fulltime-18': 'family', 'child-higher-ed': 'family', 'child-disabled': 'family',
  'child-disabled-higher-ed': 'family', childcare: 'family', breastfeeding: 'family',
  'parents-medical': 'medical', 'parents-medical-exam': 'medical', 'medical-serious': 'medical', 'medical-vaccination': 'medical',
  'medical-dental': 'medical', 'medical-checkup': 'medical', 'child-intervention': 'medical',
  'education-self': 'education', 'education-upskilling': 'education', lifestyle: 'education', sports: 'education',
  epf: 'savings', 'life-insurance': 'savings', prs: 'savings', sspn: 'savings', socso: 'savings', 'insurance-edu-medical': 'savings',
  'housing-interest-500k': 'home', 'housing-interest-750k': 'home', 'ev-charging': 'home',
};

const SECTION_ORDER: ReliefSectionKey[] = ['family', 'medical', 'education', 'savings', 'home', 'other'];

/** The reliefs split into the sections shown on the Tax reliefs screen; empty sections are left out. */
export function groupReliefs(reliefs: ReliefDef[]): { key: ReliefSectionKey; reliefs: ReliefDef[] }[] {
  return SECTION_ORDER.map((key) => ({
    key,
    reliefs: reliefs.filter((r) => (SECTION_OF[r.id] ?? 'other') === key),
  })).filter((section) => section.reliefs.length > 0);
}
