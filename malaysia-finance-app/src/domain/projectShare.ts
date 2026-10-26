import { shortDate } from './dates';
import { formatRM } from './money';
import {
  balances, normalizeName, participants, sameName,
  type NewOwedEntry, type NewOwedProject, type OwedEntry, type OwedKind, type OwedProject,
} from './owed';

/** Marks where the machine-readable part starts in a shared project, so it can be read back in. */
const MARKER = '--- Duit project data (keep this part to import) ---';

type Payload = {
  v: 1;
  name: string;
  startDate: string | null;
  endDate: string | null;
  /** The person who shared it; the entries are from their point of view. */
  owner: string;
  members: string[];
  entries: { person: string; kind: OwedKind; amount: number; date: string; note: string }[];
};

/** Who pays whom to square everything inside the project, from the sender's point of view. */
export function settlementLines(owner: string, entries: OwedEntry[]): string[] {
  return balances(entries)
    .filter((p) => p.balance !== 0)
    .map((p) => (p.balance > 0 ? `${p.person} pays ${owner} ${formatRM(p.balance)}` : `${owner} pays ${p.person} ${formatRM(-p.balance)}`));
}

/**
 * A text anyone can read (and paste into a chat), with the data to import it appended. `owner` is the sender's
 * name; the entries are written from their point of view.
 */
export function buildShare(project: OwedProject, entries: OwedEntry[], owner: string): string {
  const mine = entries.filter((e) => e.projectId === project.id);
  const dates = project.startDate ? ` (${shortDate(project.startDate)}${project.endDate ? ` - ${shortDate(project.endDate)}` : ''})` : '';
  const lines = [`${project.name}${dates}`, `Shared by ${owner}`];
  const who = participants(project, entries);
  if (who.length > 0) lines.push(`People: ${[owner, ...who].join(', ')}`);
  lines.push('');
  const settle = settlementLines(owner, mine);
  lines.push(...(settle.length > 0 ? ['To settle up:', ...settle.map((l) => `- ${l}`)] : ['All settled.']));
  if (mine.length > 0) {
    lines.push('', 'Entries:');
    for (const e of [...mine].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const what = { lent: `${owner} paid for`, repaid: 'paid back', borrowed: `${owner} borrowed from`, paidBack: `${owner} paid back` }[e.kind];
      lines.push(`- ${shortDate(e.date)}: ${what} ${e.person} ${formatRM(e.amount)}${e.note ? ` (${e.note})` : ''}`);
    }
  }
  const payload: Payload = {
    v: 1, name: project.name, startDate: project.startDate, endDate: project.endDate, owner,
    members: who,
    entries: mine.map((e) => ({ person: e.person, kind: e.kind, amount: e.amount, date: e.date, note: e.note })),
  };
  return `${lines.join('\n')}\n\n${MARKER}\n${JSON.stringify(payload)}`;
}

const KINDS: OwedKind[] = ['lent', 'repaid', 'borrowed', 'paidBack'];

/** Reads a shared project back; null when the text is not one (or was cut short). */
export function parseShare(text: string): Payload | null {
  const at = text.indexOf(MARKER);
  if (at === -1) return null;
  try {
    const p = JSON.parse(text.slice(at + MARKER.length).trim()) as Payload;
    if (p.v !== 1 || typeof p.name !== 'string' || typeof p.owner !== 'string' || !Array.isArray(p.entries) || !Array.isArray(p.members)) return null;
    const entriesOk = p.entries.every((e) => typeof e.person === 'string' && KINDS.includes(e.kind) && Number.isSafeInteger(e.amount) && e.amount > 0 && typeof e.date === 'string');
    return entriesOk && p.members.every((m) => typeof m === 'string') ? p : null;
  } catch {
    return null;
  }
}

/** Everyone you can be in a shared project: its people other than the sender. */
export const whoCanIBe = (p: Payload): string[] => p.members.filter((m) => !sameName(m, p.owner));

const FLIP: Record<OwedKind, OwedKind> = { lent: 'borrowed', repaid: 'paidBack', borrowed: 'lent', paidBack: 'repaid' };

/**
 * The shared project as `me` sees it: what the sender recorded with you becomes what you owe or are owed by the
 * sender. Entries between the sender and other people are not yours, so they are left out.
 */
export function importAs(p: Payload, me: string): { project: NewOwedProject; entries: Omit<NewOwedEntry, 'projectId'>[] } {
  const owner = normalizeName(p.owner) || 'Sender';
  return {
    project: {
      name: p.name, startDate: p.startDate, endDate: p.endDate, owner,
      members: [owner, ...p.members.filter((m) => !sameName(m, me) && !sameName(m, owner))],
    },
    entries: p.entries
      .filter((e) => sameName(e.person, me))
      .map((e) => ({ person: owner, kind: FLIP[e.kind], amount: e.amount, date: e.date, note: e.note })),
  };
}
