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
 * Splits a bill you paid between you and `others`. `value` is what was typed for each person: sen for
 * `amount`, a percentage for `percent`, a number of shares for `shares` (you hold `myShares`), and ignored for
 * `equal`. Your own share is always what is left, so the shares add up to the total to the sen.
 */
export function splitBill(i: {
  total: Sen; mode: SplitMode; others: { name: string; value: number }[]; myShares?: number;
}): SplitResult {
  const seen: { name: string; value: number }[] = [];
  for (const o of i.others) {
    const name = normalizeName(o.name);
    if (name !== '' && !seen.some((x) => sameName(x.name, name))) seen.push({ name, value: o.value });
  }
  const shareSum = seen.reduce((s, o) => s + o.value, 0) + (i.myShares ?? 1);
  const amountOf = (value: number): Sen =>
    i.mode === 'equal' ? Math.floor(i.total / (seen.length + 1))
    : i.mode === 'amount' ? Math.round(value)
    : i.mode === 'percent' ? Math.round((i.total * value) / 100)
    : shareSum > 0 ? Math.floor((i.total * value) / shareSum) : 0;
  const parts = seen.map((o) => ({ name: o.name, amount: amountOf(o.value) }));
  const mine = i.total - parts.reduce((s, p) => s + p.amount, 0);
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
      person: p.name, kind: 'lent' as const, amount: p.amount, date: i.date, note: i.note, projectId: i.projectId,
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
  for (const raw of [...project.members, ...entries.filter((e) => e.projectId === project.id).map((e) => e.person)]) {
    const name = normalizeName(raw);
    if (name !== '' && !out.some((x) => sameName(x, name))) out.push(name);
  }
  return out;
}

export type ProjectSummary = {
  project: OwedProject;
  people: PersonBalance[];
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
      const mine = entries.filter((e) => e.projectId === project.id);
      const people = balances(mine);
      return {
        project, people, ...totals(people), entries: mine, everyone: participants(project, entries),
        lastDate: mine.reduce((d, e) => (e.date > d ? e.date : d), project.startDate ?? ''),
      };
    })
    .sort((a, b) =>
      isDefaultProject(a.project) !== isDefaultProject(b.project)
        ? (isDefaultProject(a.project) ? 1 : -1)
        : a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : b.project.id - a.project.id);
}
