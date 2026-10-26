import type { GivingRecord, NewGivingRecord } from '@/domain/giving';
import type { Db } from '../types';

type Row = Omit<GivingRecord, 'countsForTax'> & { countsForTax: number };

const toRecord = (r: Row): GivingRecord => ({ ...r, countsForTax: r.countsForTax === 1 });

export async function listGivingRecords(db: Db): Promise<GivingRecord[]> {
  const rows = await db.all<Row>(
    `SELECT id, kind, date, amount, recipient, note, counts_for_tax AS countsForTax
     FROM giving_records ORDER BY date DESC, id DESC`,
  );
  return rows.map(toRecord);
}

export async function addGivingRecord(db: Db, input: NewGivingRecord): Promise<GivingRecord> {
  const r = await db.run(
    'INSERT INTO giving_records (kind, date, amount, recipient, note, counts_for_tax) VALUES (?, ?, ?, ?, ?, ?)',
    [input.kind, input.date, input.amount, input.recipient, input.note, input.countsForTax ? 1 : 0],
  );
  return { id: r.lastInsertRowId, ...input };
}

export async function updateGivingRecord(db: Db, g: GivingRecord): Promise<void> {
  await db.run(
    'UPDATE giving_records SET kind = ?, date = ?, amount = ?, recipient = ?, note = ?, counts_for_tax = ? WHERE id = ?',
    [g.kind, g.date, g.amount, g.recipient, g.note, g.countsForTax ? 1 : 0, g.id],
  );
}

export async function deleteGivingRecord(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM giving_records WHERE id = ?', [id]);
}
