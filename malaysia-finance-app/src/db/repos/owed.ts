import type { NewOwedEntry, OwedEntry } from '@/domain/owed';
import type { Db } from '../types';

export function listOwedEntries(db: Db): Promise<OwedEntry[]> {
  return db.all<OwedEntry>('SELECT id, person, kind, amount, date, note FROM owed_entries ORDER BY date DESC, id DESC');
}

export async function addOwedEntry(db: Db, input: NewOwedEntry): Promise<OwedEntry> {
  const r = await db.run('INSERT INTO owed_entries (person, kind, amount, date, note) VALUES (?, ?, ?, ?, ?)', [
    input.person, input.kind, input.amount, input.date, input.note,
  ]);
  return { id: r.lastInsertRowId, ...input };
}

export async function updateOwedEntry(db: Db, e: OwedEntry): Promise<void> {
  await db.run('UPDATE owed_entries SET person = ?, kind = ?, amount = ?, date = ?, note = ? WHERE id = ?', [
    e.person, e.kind, e.amount, e.date, e.note, e.id,
  ]);
}

export async function deleteOwedEntry(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM owed_entries WHERE id = ?', [id]);
}
