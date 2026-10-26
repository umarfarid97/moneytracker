import type { Sen } from './money';

/**
 * Money between you and other people. `lent` and `paidBack` move the balance toward "they owe me";
 * `borrowed` and `repaid` move it the other way. A positive balance means the person owes you.
 */
export type OwedKind = 'lent' | 'repaid' | 'borrowed' | 'paidBack';

export type OwedEntry = {
  id: number;
  person: string;
  kind: OwedKind;
  /** Always positive; the kind says which way it goes. */
  amount: Sen;
  date: string;
  note: string;
};
export type NewOwedEntry = Omit<OwedEntry, 'id'>;

export const OWED_KINDS: OwedKind[] = ['lent', 'repaid', 'borrowed', 'paidBack'];

export const signOf = (kind: OwedKind): 1 | -1 => (kind === 'lent' || kind === 'paidBack' ? 1 : -1);

export const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ');
const sameName = (a: string, b: string) => normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();

export type PersonBalance = {
  person: string;
  /** Positive: they owe you. Negative: you owe them. */
  balance: Sen;
  entries: OwedEntry[];
};

/** One balance per person (names match ignoring case and extra spaces). Biggest amounts first, settled people last. */
export function balances(entries: OwedEntry[]): PersonBalance[] {
  const people: PersonBalance[] = [];
  for (const e of entries) {
    let p = people.find((x) => sameName(x.person, e.person));
    if (!p) {
      p = { person: normalizeName(e.person), balance: 0, entries: [] };
      people.push(p);
    }
    p.balance += signOf(e.kind) * e.amount;
    p.entries.push(e);
  }
  for (const p of people) p.entries.sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  return people.sort((a, b) => (a.balance === 0) !== (b.balance === 0)
    ? (a.balance === 0 ? 1 : -1)
    : Math.abs(b.balance) - Math.abs(a.balance) || a.person.localeCompare(b.person));
}

export function totals(list: PersonBalance[]): { owedToMe: Sen; iOwe: Sen } {
  return {
    owedToMe: list.reduce((s, p) => s + Math.max(0, p.balance), 0),
    iOwe: list.reduce((s, p) => s + Math.max(0, -p.balance), 0),
  };
}

/** The entry that brings a person's balance back to zero, or null if it already is. */
export function settleUp(p: PersonBalance, date: string): NewOwedEntry | null {
  if (p.balance === 0) return null;
  return {
    person: p.person,
    kind: p.balance > 0 ? 'repaid' : 'paidBack',
    amount: Math.abs(p.balance),
    date,
    note: '',
  };
}

/**
 * Splits a bill you paid equally between you and `others`. Everyone else gets the same whole-sen share and the
 * leftover sen stay with you, so the shares always add up to the total.
 */
export function splitEqually(total: Sen, others: string[]): { mine: Sen; share: Sen } {
  const share = Math.floor(total / (others.length + 1));
  return { share, mine: total - share * others.length };
}

/** Entries for a bill you paid: each other person owes their share. */
export function splitEntries(i: {
  total: Sen; others: string[]; date: string; note: string;
}): { mine: Sen; entries: NewOwedEntry[] } {
  const names = i.others.map(normalizeName).filter((n, idx, all) => n !== '' && all.findIndex((x) => sameName(x, n)) === idx);
  const { share, mine } = splitEqually(i.total, names);
  return {
    mine,
    entries: share > 0 ? names.map((person) => ({ person, kind: 'lent' as const, amount: share, date: i.date, note: i.note })) : [],
  };
}
