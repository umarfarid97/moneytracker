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
  /** The occasion this belongs to ("Penang trip"); empty when it doesn't belong to one. */
  event: string;
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
    event: '',
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

export type ShareInput = { person: string; amount: Sen };

/**
 * Splits a bill you paid with each person owing their own amount. What is left of the total is your share;
 * null when the amounts add up to more than the total.
 */
export function splitByAmounts(total: Sen, shares: ShareInput[]): { mine: Sen; shares: ShareInput[] } | null {
  const merged: ShareInput[] = [];
  for (const s of shares) {
    const person = normalizeName(s.person);
    if (person === '') continue;
    const same = merged.find((m) => sameName(m.person, person));
    if (same) same.amount += s.amount;
    else merged.push({ person, amount: s.amount });
  }
  const kept = merged.filter((m) => m.amount > 0);
  const mine = total - kept.reduce((sum, m) => sum + m.amount, 0);
  return mine < 0 ? null : { mine, shares: kept };
}

/** Entries for a bill you paid: each other person owes their share, equal or the amount given in `amounts`. */
export function splitEntries(i: {
  total: Sen; others: string[]; date: string; note: string; event?: string;
  /** Amount per person, keyed by name as in `others`. Without it everyone pays the same. */
  amounts?: Record<string, Sen>;
}): { mine: Sen; entries: NewOwedEntry[] } {
  const event = normalizeName(i.event ?? '');
  const make = (person: string, amount: Sen): NewOwedEntry => ({ person, kind: 'lent', amount, date: i.date, note: i.note, event });
  const names = i.others.map(normalizeName).filter((n, idx, all) => n !== '' && all.findIndex((x) => sameName(x, n)) === idx);
  if (i.amounts) {
    const split = splitByAmounts(i.total, names.map((person) => ({ person, amount: i.amounts![person] ?? 0 })));
    return split ? { mine: split.mine, entries: split.shares.map((x) => make(x.person, x.amount)) } : { mine: i.total, entries: [] };
  }
  const { share, mine } = splitEqually(i.total, names);
  return { mine, entries: share > 0 ? names.map((person) => make(person, share)) : [] };
}

export type EventBalance = {
  /** Empty for entries that don't belong to an event. */
  event: string;
  /** Positive: people still owe you for this event. */
  balance: Sen;
  /** Each person's balance within this event, biggest first. */
  people: { person: string; balance: Sen }[];
  entries: OwedEntry[];
};

/** One balance per event (names match ignoring case), unsettled ones first, "no event" last. */
export function eventBalances(entries: OwedEntry[]): EventBalance[] {
  const events: EventBalance[] = [];
  for (const e of entries) {
    const name = normalizeName(e.event ?? '');
    let ev = events.find((x) => sameName(x.event, name));
    if (!ev) {
      ev = { event: name, balance: 0, people: [], entries: [] };
      events.push(ev);
    }
    const amount = signOf(e.kind) * e.amount;
    ev.balance += amount;
    ev.entries.push(e);
    const p = ev.people.find((x) => sameName(x.person, e.person));
    if (p) p.balance += amount;
    else ev.people.push({ person: normalizeName(e.person), balance: amount });
  }
  for (const ev of events) {
    ev.people.sort((a, b) => (a.balance === 0) !== (b.balance === 0)
      ? (a.balance === 0 ? 1 : -1)
      : Math.abs(b.balance) - Math.abs(a.balance) || a.person.localeCompare(b.person));
    ev.entries.sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  }
  return events.sort((a, b) => (a.event === '') !== (b.event === '')
    ? (a.event === '' ? 1 : -1)
    : (a.balance === 0) !== (b.balance === 0)
      ? (a.balance === 0 ? 1 : -1)
      : Math.abs(b.balance) - Math.abs(a.balance) || a.event.localeCompare(b.event));
}

/** Entries that bring every person's balance within one event back to zero. */
export function settleEvent(ev: EventBalance, date: string): NewOwedEntry[] {
  return ev.people
    .filter((p) => p.balance !== 0)
    .map((p) => ({
      person: p.person,
      kind: p.balance > 0 ? ('repaid' as const) : ('paidBack' as const),
      amount: Math.abs(p.balance),
      date,
      note: '',
      event: ev.event,
    }));
}
