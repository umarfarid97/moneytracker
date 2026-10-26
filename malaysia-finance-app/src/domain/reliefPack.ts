import type { TaxYearData } from '@/data/tax/types';
import { toCsv } from './csv';
import { senToInput, type Sen } from './money';
import { claimsFromExpenses } from './reliefSpending';
import { capReliefClaims } from './reliefs';
import type { Expense, ReliefClaim } from './types';

export type PackItem = {
  /** Id of the spending or the typed-in claim, depending on `source`. */
  id: number;
  source: 'spending' | 'manual';
  date: string | null;
  note: string;
  /** The part that counts toward the relief. */
  amount: Sen;
  /** What was actually spent (the same as `amount` for claims typed in by hand). */
  spent: Sen;
  receiptUri: string | null;
  receipt: 'ok' | 'missing' | 'not-needed';
};

export type PackSection = {
  reliefId: string;
  name: string;
  limit: Sen;
  claimed: Sen;
  allowed: Sen;
  items: PackItem[];
};

export type ReliefPack = {
  year: number;
  /** The year whose rates and limits were used (can be earlier than `year` if LHDN has not published it). */
  ya: number;
  sections: PackSection[];
  automatic: { name: string; amount: Sen }[];
  total: Sen;
  missingReceipts: number;
};

/** Everything claimed for one year of assessment, grouped by relief, with receipt status, ready to review or export. */
export function buildReliefPack(i: {
  year: number;
  data: TaxYearData;
  expenses: Expense[];
  manualClaims: ReliefClaim[];
}): ReliefPack {
  const { year, data } = i;
  const needsReceipt = new Map(data.reliefs.map((r) => [r.id, r.requiresReceipt]));
  const receiptStatus = (reliefId: string, uri: string | null): PackItem['receipt'] =>
    needsReceipt.get(reliefId) !== true ? 'not-needed' : uri ? 'ok' : 'missing';

  const spending = i.expenses
    .filter((e) => e.reliefId !== null && e.id > 0 && Number(e.date.slice(0, 4)) === year)
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
  const manual = i.manualClaims.filter((c) => c.year === year);

  const claims = [...claimsFromExpenses(spending), ...manual];
  const summary = capReliefClaims(claims, data.reliefs);

  const itemsFor = (reliefId: string): PackItem[] => [
    ...spending
      .filter((e) => e.reliefId === reliefId)
      .map((e) => ({
        id: e.id,
        source: 'spending' as const,
        date: e.date,
        note: e.note,
        amount: Math.min(Math.max(e.reliefAmount ?? e.amount, 0), e.amount),
        spent: e.amount,
        receiptUri: e.receiptUri,
        receipt: receiptStatus(reliefId, e.receiptUri),
      })),
    ...manual
      .filter((c) => c.reliefId === reliefId)
      .map((c) => ({
        id: c.id,
        source: 'manual' as const,
        date: null,
        note: c.note,
        amount: c.amount,
        spent: c.amount,
        receiptUri: c.receiptUri,
        receipt: receiptStatus(reliefId, c.receiptUri),
      })),
  ];

  const sections: PackSection[] = data.reliefs
    .map((def) => ({ def, items: itemsFor(def.id) }))
    .filter(({ items }) => items.length > 0)
    .map(({ def, items }) => ({
      reliefId: def.id,
      name: def.name,
      limit: def.limit,
      claimed: summary.perRelief[def.id]?.claimed ?? 0,
      allowed: summary.perRelief[def.id]?.allowed ?? 0,
      items,
    }));

  const automatic = data.automaticReliefs.map((r) => ({ name: r.name, amount: r.amount }));
  return {
    year,
    ya: data.ya,
    sections,
    automatic,
    total: automatic.reduce((sum, r) => sum + r.amount, 0) + summary.total,
    missingReceipts: sections.reduce((n, s) => n + s.items.filter((it) => it.receipt === 'missing').length, 0),
  };
}

/** The pack as CSV text: one row per item, then a summary per relief and the total. */
export function reliefPackCsv(pack: ReliefPack): string {
  const rows: (string | number)[][] = [['Year of assessment', pack.year]];
  if (pack.ya !== pack.year) rows.push(['Rates and limits used', `YA ${pack.ya}`]);
  rows.push([], ['Relief', 'Date', 'Description', 'Amount spent (RM)', 'Claimed (RM)', 'Receipt', 'Source']);
  for (const s of pack.sections) {
    for (const it of s.items) {
      // Only the file name: a full path would expose where the app keeps its files and means nothing to the reader.
      const receipt = it.receipt === 'missing' ? 'Missing' : it.receiptUri?.split('/').pop() ?? 'Not needed';
      rows.push([
        s.name, it.date ?? '', it.note, senToInput(it.spent), senToInput(it.amount), receipt,
        it.source === 'spending' ? 'Spending' : 'Typed in',
      ]);
    }
  }
  rows.push([], ['Relief', 'Limit (RM)', 'Claimed (RM)', 'Allowed (RM)']);
  for (const s of pack.sections) rows.push([s.name, senToInput(s.limit), senToInput(s.claimed), senToInput(s.allowed)]);
  for (const a of pack.automatic) rows.push([`${a.name} (automatic)`, '', '', senToInput(a.amount)]);
  rows.push(['Total relief', senToInput(pack.total)]);
  return toCsv(rows);
}
