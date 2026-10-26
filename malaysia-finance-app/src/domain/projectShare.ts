import { shortDate } from './dates';
import { formatRM } from './money';
import {
  entryOf, netPositions, normalizeName, participants, sameName, settleTransfers, transferOf,
  type NewOwedEntry, type NewOwedProject, type OwedEntry, type OwedKind, type OwedProject, type Transfer,
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
  /** `counter` is who the entry is with besides `person`; missing or '' means the sender. */
  entries: { person: string; kind: OwedKind; amount: number; date: string; note: string; counter?: string }[];
};

const named = (owner: string, who: string) => (who === '' ? owner : who);

/** The fewest payments that settle the whole book, named from the sender's point of view. */
export function settlementLines(owner: string, entries: OwedEntry[]): string[] {
  return settleTransfers(netPositions(entries)).map((t) => `${named(owner, t.from)} pays ${named(owner, t.to)} ${formatRM(t.amount)}`);
}

/** What each person is owed (+) or owes (-) across the whole book, named from the sender's point of view. */
export function netLines(owner: string, entries: OwedEntry[]): string[] {
  return netPositions(entries).map((p) => `${named(owner, p.name)}: ${p.net > 0 ? 'is owed' : 'owes'} ${formatRM(Math.abs(p.net))}`);
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
  if (settle.length > 0) lines.push('Net:', ...netLines(owner, mine).map((l) => `- ${l}`), '', 'To settle up:', ...settle.map((l) => `- ${l}`));
  else lines.push('All settled.');
  if (mine.length > 0) {
    lines.push('', 'Entries:');
    for (const e of [...mine].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const t = transferOf(e);
      const what = t.type === 'lend' ? 'paid for' : 'paid back';
      lines.push(`- ${shortDate(e.date)}: ${named(owner, t.from)} ${what} ${named(owner, t.to)} ${formatRM(e.amount)}${e.note ? ` (${e.note})` : ''}`);
    }
  }
  const payload: Payload = {
    v: 1, name: project.name, startDate: project.startDate, endDate: project.endDate, owner,
    members: who,
    entries: mine.map((e) => ({ person: e.person, kind: e.kind, amount: e.amount, date: e.date, note: e.note, counter: e.counter })),
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
    const entriesOk = p.entries.every((e) => typeof e.person === 'string' && KINDS.includes(e.kind) && Number.isSafeInteger(e.amount) && e.amount > 0 && typeof e.date === 'string' && (e.counter === undefined || typeof e.counter === 'string'));
    return entriesOk && p.members.every((m) => typeof m === 'string') ? p : null;
  } catch {
    return null;
  }
}

/** Everyone you can be in a shared project: its people other than the sender. */
export const whoCanIBe = (p: Payload): string[] => p.members.filter((m) => !sameName(m, p.owner));

/**
 * The shared project as `me` sees it. The sender's entries are written from their point of view ('' is the sender);
 * here the sender gets their name and `me` becomes '', so everything in the book is kept, whoever it is between.
 */
export function importAs(p: Payload, me: string): { project: NewOwedProject; entries: Omit<NewOwedEntry, 'projectId'>[] } {
  const owner = normalizeName(p.owner) || 'Sender';
  const mapName = (who: string) => (sameName(who, me) ? '' : who);
  return {
    project: {
      name: p.name, startDate: p.startDate, endDate: p.endDate, owner,
      members: [owner, ...p.members.filter((m) => !sameName(m, me) && !sameName(m, owner))],
    },
    entries: p.entries.map((e) => {
      const t = transferOf({ person: e.person, kind: e.kind, amount: e.amount, counter: e.counter ?? '' });
      const mine: Transfer = { ...t, from: mapName(t.from === '' ? owner : t.from), to: mapName(t.to === '' ? owner : t.to) };
      return { ...entryOf(mine), date: e.date, note: e.note };
    }),
  };
}
