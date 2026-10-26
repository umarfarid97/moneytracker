import type { NewRetirementEntry, RetirementEntry } from '@/domain/retirement';
import type { Db } from '../types';

const SELECT = `SELECT id, scheme, kind, date, amount, employer_share AS employerShare, note FROM retirement_entries`;

export function listRetirementEntries(db: Db): Promise<RetirementEntry[]> {
  return db.all<RetirementEntry>(`${SELECT} ORDER BY date DESC, id DESC`);
}

export async function addRetirementEntry(db: Db, input: NewRetirementEntry): Promise<RetirementEntry> {
  const r = await db.run(
    'INSERT INTO retirement_entries (scheme, kind, date, amount, employer_share, note) VALUES (?, ?, ?, ?, ?, ?)',
    [input.scheme, input.kind, input.date, input.amount, input.employerShare, input.note],
  );
  return { id: r.lastInsertRowId, ...input };
}

export async function updateRetirementEntry(db: Db, e: RetirementEntry): Promise<void> {
  await db.run(
    'UPDATE retirement_entries SET scheme = ?, kind = ?, date = ?, amount = ?, employer_share = ?, note = ? WHERE id = ?',
    [e.scheme, e.kind, e.date, e.amount, e.employerShare, e.note, e.id],
  );
}

export async function deleteRetirementEntry(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM retirement_entries WHERE id = ?', [id]);
}
