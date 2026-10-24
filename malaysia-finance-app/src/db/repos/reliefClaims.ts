import type { ReliefClaim } from '@/domain/types';
import type { Db } from '../types';

export function listReliefClaims(db: Db, year: number): Promise<ReliefClaim[]> {
  return db.all<ReliefClaim>(
    `SELECT id, relief_id AS reliefId, year, amount, receipt_uri AS receiptUri, note
     FROM relief_claims WHERE year = ? ORDER BY id`,
    [year],
  );
}

export async function addReliefClaim(db: Db, input: Omit<ReliefClaim, 'id'>): Promise<ReliefClaim> {
  const r = await db.run(
    'INSERT INTO relief_claims (relief_id, year, amount, receipt_uri, note) VALUES (?, ?, ?, ?, ?)',
    [input.reliefId, input.year, input.amount, input.receiptUri, input.note],
  );
  return { id: r.lastInsertRowId, ...input };
}

export async function updateReliefClaim(db: Db, c: ReliefClaim): Promise<void> {
  await db.run(
    'UPDATE relief_claims SET relief_id = ?, year = ?, amount = ?, receipt_uri = ?, note = ? WHERE id = ?',
    [c.reliefId, c.year, c.amount, c.receiptUri, c.note, c.id],
  );
}

export async function deleteReliefClaim(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM relief_claims WHERE id = ?', [id]);
}

export function listAllReliefClaims(db: Db): Promise<ReliefClaim[]> {
  return db.all<ReliefClaim>(
    `SELECT id, relief_id AS reliefId, year, amount, receipt_uri AS receiptUri, note
     FROM relief_claims ORDER BY id`,
  );
}
