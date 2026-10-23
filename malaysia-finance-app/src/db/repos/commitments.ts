import type { Commitment } from '@/domain/types';
import type { Db } from '../types';

type Row = Omit<Commitment, 'active'> & { active: number };

const SELECT =
  'SELECT id, name, amount, day_of_month AS dayOfMonth, kind, active FROM commitments';

const toCommitment = (r: Row): Commitment => ({ ...r, active: r.active === 1 });

export async function listCommitments(db: Db): Promise<Commitment[]> {
  const rows = await db.all<Row>(`${SELECT} ORDER BY day_of_month, id`);
  return rows.map(toCommitment);
}

export async function addCommitment(db: Db, input: Omit<Commitment, 'id'>): Promise<Commitment> {
  const r = await db.run(
    'INSERT INTO commitments (name, amount, day_of_month, kind, active) VALUES (?, ?, ?, ?, ?)',
    [input.name, input.amount, input.dayOfMonth, input.kind, input.active ? 1 : 0],
  );
  return { id: r.lastInsertRowId, ...input };
}

export async function updateCommitment(db: Db, c: Commitment): Promise<void> {
  await db.run(
    'UPDATE commitments SET name = ?, amount = ?, day_of_month = ?, kind = ?, active = ? WHERE id = ?',
    [c.name, c.amount, c.dayOfMonth, c.kind, c.active ? 1 : 0, c.id],
  );
}

export async function deleteCommitment(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM commitments WHERE id = ?', [id]);
}
