import { withCommitmentDefaults, type Commitment, type NewCommitment } from '@/domain/types';
import type { Db } from '../types';

type Row = Omit<Commitment, 'active' | 'autoRecord' | 'variable'> & { active: number; autoRecord: number; variable: number };

const SELECT = `SELECT id, name, amount, day_of_month AS dayOfMonth, kind, active,
  category_id AS categoryId, payment_method_id AS paymentMethodId, relief_id AS reliefId,
  auto_record AS autoRecord, start_date AS startDate, last_auto_due AS lastAutoDue, variable,
  loan_type AS loanType, loan_balance AS loanBalance, loan_balance_date AS loanBalanceDate,
  loan_original AS loanOriginal, loan_rate_pct AS loanRatePct FROM commitments`;

const toCommitment = (r: Row): Commitment => ({
  ...r, active: r.active === 1, autoRecord: r.autoRecord === 1, variable: r.variable === 1,
});

const values = (c: Omit<Commitment, 'id'>) => [
  c.name, c.amount, c.dayOfMonth, c.kind, c.active ? 1 : 0, c.categoryId, c.paymentMethodId, c.reliefId,
  c.autoRecord ? 1 : 0, c.startDate, c.lastAutoDue, c.variable ? 1 : 0,
  c.loanType, c.loanBalance, c.loanBalanceDate, c.loanOriginal, c.loanRatePct,
];

export async function listCommitments(db: Db): Promise<Commitment[]> {
  const rows = await db.all<Row>(`${SELECT} ORDER BY day_of_month, id`);
  return rows.map(toCommitment);
}

export async function addCommitment(db: Db, input: NewCommitment): Promise<Commitment> {
  const full = withCommitmentDefaults(input);
  const r = await db.run(
    `INSERT INTO commitments (name, amount, day_of_month, kind, active, category_id, payment_method_id,
       relief_id, auto_record, start_date, last_auto_due, variable, loan_type, loan_balance, loan_balance_date,
       loan_original, loan_rate_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values(full),
  );
  return { id: r.lastInsertRowId, ...full };
}

export async function updateCommitment(db: Db, c: Commitment): Promise<void> {
  await db.run(
    `UPDATE commitments SET name = ?, amount = ?, day_of_month = ?, kind = ?, active = ?, category_id = ?,
       payment_method_id = ?, relief_id = ?, auto_record = ?, start_date = ?, last_auto_due = ?, variable = ?,
       loan_type = ?, loan_balance = ?, loan_balance_date = ?, loan_original = ?, loan_rate_pct = ? WHERE id = ?`,
    [...values(c), c.id],
  );
}

export async function deleteCommitment(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM commitments WHERE id = ?', [id]);
}
