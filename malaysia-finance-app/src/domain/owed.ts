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
  /** The project this belongs to (a trip, a dinner). */
  projectId: number;
  /** The other side of the entry: '' when it is between you and `person`, otherwise someone else in the book. */
  counter: string;
  /** The split bill this entry came from (see `SplitBill`), as JSON; '' or missing for a plain entry. */
  bill?: string;
};
export type NewOwedEntry = Omit<OwedEntry, 'id'>;

export const OWED_KINDS: OwedKind[] = ['lent', 'repaid', 'borrowed', 'paidBack'];

export const signOf = (kind: OwedKind): 1 | -1 => (kind === 'lent' || kind === 'paidBack' ? 1 : -1);

export const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ');
export const sameName = (a: string, b: string) => normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();


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
export function settleUp(p: PersonBalance, date: string, projectId: number): NewOwedEntry | null {
  if (p.balance === 0) return null;
  return {
    person: p.person,
    kind: p.balance > 0 ? 'repaid' : 'paidBack',
    amount: Math.abs(p.balance),
    date,
    note: '',
    projectId,
    counter: '',
  };
}

export type SplitMode = 'equal' | 'amount' | 'percent' | 'shares';

export type SplitPart = { name: string; amount: Sen };
export type SplitResult = {
  parts: SplitPart[];
  /** What is left for you: the total minus what the others owe. */
  mine: Sen;
  /** Every person owes something and you are not left with a negative share. */
  ok: boolean;
};

/**
 * Shares out `total` sen in proportion to `weights`, to the sen: everyone gets the whole sen of their proportion and the
 * sen left over go one each to those with the biggest fractions (ties go to the earlier one), so the parts always add up
 * to the total and the same input always gives the same answer.
 */
export function allocate(total: Sen, weights: number[]): Sen[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (weights.length === 0 || !(sum > 0)) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  // A tiny nudge so 2999.9999999999995 counts as 3000.
  const parts = exact.map((x) => Math.floor(x + 1e-9));
  let left = total - parts.reduce((s, p) => s + p, 0);
  const order = exact.map((x, i) => ({ i, frac: x - parts[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const o of order) {
    if (left <= 0) break;
    parts[o.i] += 1;
    left -= 1;
  }
  return parts;
}

/**
 * Splits a bill between you and `others`, whoever paid it. `value` is what was typed for each person: sen for
 * `amount`, a percentage for `percent`, a number of shares for `shares` (you hold `myShares`), and ignored for
 * `equal`. Your own share is what is left of the amounts, the percent or the shares; for equal, percent and shares
 * the odd sen are shared out by `allocate` (you first on a tie), so the parts always add up to the total.
 */
export function splitBill(i: {
  total: Sen; mode: SplitMode; others: { name: string; value: number }[]; myShares?: number;
}): SplitResult {
  const seen: { name: string; value: number }[] = [];
  for (const o of i.others) {
    const name = normalizeName(o.name);
    if (name !== '' && !seen.some((x) => sameName(x.name, name))) seen.push({ name, value: o.value });
  }
  let mine: Sen;
  let amounts: Sen[];
  if (i.mode === 'amount') {
    amounts = seen.map((o) => Math.round(o.value));
    mine = i.total - amounts.reduce((s, a) => s + a, 0);
  } else {
    const myWeight = i.mode === 'equal' ? 1 : i.mode === 'percent' ? 100 - seen.reduce((s, o) => s + o.value, 0) : i.myShares ?? 1;
    if (i.mode === 'percent' && myWeight < 0) {
      // Over 100%: show by how much instead of sharing anything out.
      amounts = seen.map((o) => Math.round((i.total * o.value) / 100));
      mine = i.total - amounts.reduce((s, a) => s + a, 0);
    } else {
      const [m, ...rest] = allocate(i.total, [myWeight, ...seen.map((o) => (i.mode === 'equal' ? 1 : o.value))]);
      mine = m;
      amounts = rest;
    }
  }
  const parts = seen.map((o, idx) => ({ name: o.name, amount: amounts[idx] }));
  return { parts, mine, ok: i.total > 0 && parts.length > 0 && parts.every((p) => p.amount > 0) && mine >= 0 };
}

/** Entries for a bill you paid: each other person owes their part. */
export function splitEntries(i: {
  total: Sen; others: string[]; date: string; note: string; projectId: number;
  mode?: SplitMode; values?: number[]; myShares?: number;
}): { mine: Sen; entries: NewOwedEntry[] } {
  const { parts, mine } = splitBill({
    total: i.total, mode: i.mode ?? 'equal', myShares: i.myShares,
    others: i.others.map((name, idx) => ({ name, value: i.values?.[idx] ?? 1 })),
  });
  return {
    mine,
    entries: parts.filter((p) => p.amount > 0).map((p) => ({
      person: p.name, kind: 'lent' as const, amount: p.amount, date: i.date, note: i.note, projectId: i.projectId, counter: '',
    })),
  };
}

/** The bill split equally: the same share for everyone else, and the leftover sen stay with you. */
export function splitEqually(total: Sen, others: string[]): { mine: Sen; share: Sen } {
  const { parts, mine } = splitBill({ total, mode: 'equal', others: others.map((name) => ({ name, value: 1 })) });
  return { mine, share: parts[0]?.amount ?? Math.floor(total / (others.length + 1)) };
}

export type OwedProject = {
  id: number;
  /** Same on every phone for the default project; random for the rest. */
  uid: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  /** The people in the project (not you), by name. */
  members: string[];
  /** Whose phone this project was made on, when it was imported from someone else's share; '' otherwise. */
  owner: string;
};
export type NewOwedProject = Omit<OwedProject, 'id' | 'uid'>;

export { DEFAULT_PROJECT_UID } from '@/db/migrations';
import { DEFAULT_PROJECT_UID } from '@/db/migrations';
export const isDefaultProject = (p: Pick<OwedProject, 'uid'>) => p.uid === DEFAULT_PROJECT_UID;

/** The people in a project: those listed on it plus anyone with an entry in it, by name without repeats. */
export function participants(project: OwedProject, entries: OwedEntry[]): string[] {
  const out: string[] = [];
  const inBook = entries.filter((e) => e.projectId === project.id);
  for (const raw of [...project.members, ...inBook.flatMap((e) => [e.person, e.counter])]) {
    const name = normalizeName(raw);
    if (name !== '' && !out.some((x) => sameName(x, name))) out.push(name);
  }
  return out;
}

export type ProjectSummary = {
  project: OwedProject;
  /** Each person's balance with you only. */
  people: PersonBalance[];
  /** Everyone's net position in the book ('' is you): positive is owed money, negative owes. */
  net: NetPosition[];
  /** The fewest payments that settle the whole book. */
  settlements: Transfer[];
  /** Everyone in the project, including people with no entries yet. */
  everyone: string[];
  owedToMe: Sen;
  iOwe: Sen;
  entries: OwedEntry[];
  lastDate: string;
};

/** One summary per project, most recent activity first; the default project goes last. */
export function projectSummaries(projects: OwedProject[], entries: OwedEntry[]): ProjectSummary[] {
  return projects
    .map((project) => {
      const all = entries.filter((e) => e.projectId === project.id);
      const people = balances(all.filter((e) => e.counter === ''));
      const net = netPositions(all);
      return {
        project, people, net, settlements: settleTransfers(net), ...totals(people), entries: all, everyone: participants(project, entries),
        lastDate: all.reduce((d, e) => (e.date > d ? e.date : d), project.startDate ?? ''),
      };
    })
    .sort((a, b) =>
      isDefaultProject(a.project) !== isDefaultProject(b.project)
        ? (isDefaultProject(a.project) ? 1 : -1)
        : a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : b.project.id - a.project.id);
}

/** Money moving from one person to another; '' is you. `lend` is paying for or lending to someone, `payback` is paying a debt. */
export type Transfer = { from: string; to: string; type: 'lend' | 'payback'; amount: Sen };

/** Who an entry is from and to. */
export function transferOf(e: Pick<OwedEntry, 'person' | 'kind' | 'counter' | 'amount'>): Transfer {
  const { person, counter, amount } = e;
  switch (e.kind) {
    case 'lent': return { from: counter, to: person, type: 'lend', amount };
    case 'borrowed': return { from: person, to: counter, type: 'lend', amount };
    case 'repaid': return { from: person, to: counter, type: 'payback', amount };
    case 'paidBack': return { from: counter, to: person, type: 'payback', amount };
  }
}

/** The entry fields that record a transfer; entries with you in them keep `counter` empty. */
export function entryOf(t: Transfer): Pick<OwedEntry, 'person' | 'kind' | 'counter' | 'amount'> {
  const lend = t.type === 'lend';
  if (t.from === '') return { person: t.to, kind: lend ? 'lent' : 'paidBack', counter: '', amount: t.amount };
  if (t.to === '') return { person: t.from, kind: lend ? 'borrowed' : 'repaid', counter: '', amount: t.amount };
  return lend
    ? { person: t.to, kind: 'lent', counter: t.from, amount: t.amount }
    : { person: t.from, kind: 'repaid', counter: t.to, amount: t.amount };
}

export type NetPosition = { name: string; net: Sen };

/** Everyone's net in a set of entries: whoever paid gains the amount, whoever received it loses it. Settled people are left out. */
export function netPositions(entries: OwedEntry[]): NetPosition[] {
  const out: NetPosition[] = [];
  const at = (name: string) => {
    let p = out.find((x) => sameName(x.name, name));
    if (!p) out.push((p = { name: normalizeName(name), net: 0 }));
    return p;
  };
  for (const e of entries) {
    const t = transferOf(e);
    at(t.from).net += t.amount;
    at(t.to).net -= t.amount;
  }
  return out.filter((p) => p.net !== 0).sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
}

/** The fewest payments that bring everyone to zero: the biggest debtor pays the biggest creditor, and so on. */
export function settleTransfers(net: NetPosition[]): Transfer[] {
  const owed = net.filter((p) => p.net > 0).map((p) => ({ ...p }));
  const owing = net.filter((p) => p.net < 0).map((p) => ({ name: p.name, net: -p.net }));
  const out: Transfer[] = [];
  const biggest = (l: NetPosition[]) => l.reduce((a, b) => (b.net > a.net || (b.net === a.net && b.name < a.name) ? b : a));
  while (owed.length > 0 && owing.length > 0) {
    const c = biggest(owed);
    const d = biggest(owing);
    const amount = Math.min(c.net, d.net);
    out.push({ from: d.name, to: c.name, type: 'payback', amount });
    c.net -= amount;
    d.net -= amount;
    if (c.net === 0) owed.splice(owed.indexOf(c), 1);
    if (d.net === 0) owing.splice(owing.indexOf(d), 1);
  }
  return out;
}

/** Who paid how much towards a bill, and what each person's part came to: the transfers that put it right. '' is you. */
export function splitTransfers(i: {
  paid: { name: string; amount: Sen }[]; parts: SplitPart[]; mine: Sen;
}): Transfer[] {
  const net: NetPosition[] = [];
  const add = (name: string, n: Sen) => {
    const p = net.find((x) => sameName(x.name, name));
    if (p) p.net += n;
    else net.push({ name: normalizeName(name), net: n });
  };
  for (const p of i.paid) add(p.name, p.amount);
  add('', -i.mine);
  for (const p of i.parts) add(p.name, -p.amount);
  // Whoever put in more than their part lent the difference to whoever put in less.
  return settleTransfers(net.filter((p) => p.net !== 0)).map((t) => ({ from: t.to, to: t.from, type: 'lend' as const, amount: t.amount }));
}

/** The original bill behind a split, kept on each entry it produced so the entries can be shown as one item. */
export type SplitBill = {
  /** Same on every entry of the bill. */
  id: string;
  total: Sen;
  /** Who paid how much ('' is you). */
  paid: { name: string; amount: Sen }[];
  /** What each other person's part came to. */
  parts: SplitPart[];
  /** Your own part. */
  mine: Sen;
  mode: SplitMode;
  /** What was typed for each of `parts`, in the same order, so the bill can be edited. */
  typed: string[];
  myShares: string;
};

export const encodeBill = (b: SplitBill): string => JSON.stringify(b);

/** The bill stored on an entry, or null for a plain entry or text that is not a bill. */
export function parseBill(raw: string | undefined): SplitBill | null {
  if (!raw) return null;
  try {
    const b = JSON.parse(raw) as SplitBill;
    const ok = b && typeof b.id === 'string' && b.id !== '' && Number.isSafeInteger(b.total) && Array.isArray(b.paid) && Array.isArray(b.parts)
      && Number.isSafeInteger(b.mine) && MODES_ALL.includes(b.mode);
    return ok ? { ...b, typed: Array.isArray(b.typed) ? b.typed : [], myShares: typeof b.myShares === 'string' ? b.myShares : '1' } : null;
  } catch {
    return null;
  }
}
const MODES_ALL: SplitMode[] = ['equal', 'amount', 'percent', 'shares'];

/** Everyone in a bill, you included. */
export const billPeople = (b: SplitBill): number => b.parts.length + 1;

export type EntryItem =
  | { type: 'entry'; entry: OwedEntry }
  | { type: 'bill'; bill: SplitBill; note: string; date: string; entries: OwedEntry[] };

/**
 * Entries as the list shows them: the entries of one split bill become a single item (at the place of its first
 * entry), everything else stays as it is. Entries whose bill cannot be read show as plain entries.
 */
export function groupEntries(entries: OwedEntry[]): EntryItem[] {
  const items: EntryItem[] = [];
  const open = new Map<string, Extract<EntryItem, { type: 'bill' }>>();
  for (const entry of entries) {
    const bill = parseBill(entry.bill);
    if (!bill) {
      items.push({ type: 'entry', entry });
      continue;
    }
    const group = open.get(bill.id);
    if (group) {
      group.entries.push(entry);
    } else {
      const item: Extract<EntryItem, { type: 'bill' }> = { type: 'bill', bill, note: entry.note, date: entry.date, entries: [entry] };
      open.set(bill.id, item);
      items.push(item);
    }
  }
  return items;
}
