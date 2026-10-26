import { withExpenseDefaults, type Expense, type NewExpense } from '@/domain/types';
import type { Db } from '../types';

const SELECT = `SELECT id, amount, category_id AS categoryId, date, note, receipt_uri AS receiptUri,
  payment_method_id AS paymentMethodId, relief_id AS reliefId, relief_amount AS reliefAmount, sst,
  commitment_id AS commitmentId, due_date AS dueDate FROM expenses`;

const COLUMNS =
  'amount, category_id, date, note, receipt_uri, payment_method_id, relief_id, relief_amount, sst, commitment_id, due_date';

const values = (e: Omit<Expense, 'id'>) => [
  e.amount, e.categoryId, e.date, e.note, e.receiptUri, e.paymentMethodId, e.reliefId, e.reliefAmount, e.sst ?? null,
  e.commitmentId, e.dueDate,
];

export async function addExpense(db: Db, input: NewExpense): Promise<Expense> {
  const full = withExpenseDefaults(input);
  const r = await db.run(`INSERT INTO expenses (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values(full));
  return { id: r.lastInsertRowId, ...full };
}

/**
 * Records spending for a bill's due date. If that due date already has its spending (marked paid or
 * auto-recorded earlier) nothing is inserted and null is returned, so a bill can never be recorded twice.
 */
export async function addBillExpense(db: Db, input: NewExpense): Promise<Expense | null> {
  const full = withExpenseDefaults(input);
  const r = await db.run(`INSERT OR IGNORE INTO expenses (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values(full));
  return r.changes === 0 ? null : { id: r.lastInsertRowId, ...full };
}

export async function updateExpense(db: Db, e: Expense): Promise<void> {
  await db.run(
    `UPDATE expenses SET amount = ?, category_id = ?, date = ?, note = ?, receipt_uri = ?,
       payment_method_id = ?, relief_id = ?, relief_amount = ?, sst = ?, commitment_id = ?, due_date = ? WHERE id = ?`,
    [...values(e), e.id],
  );
}

export async function deleteExpense(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM expenses WHERE id = ?', [id]);
}

export function listExpensesByDate(db: Db, date: string): Promise<Expense[]> {
  return db.all<Expense>(`${SELECT} WHERE date = ? ORDER BY id DESC`, [date]);
}

/** month is `YYYY-MM`. */
export function listExpensesByMonth(db: Db, month: string): Promise<Expense[]> {
  return db.all<Expense>(`${SELECT} WHERE substr(date, 1, 7) = ? ORDER BY date DESC, id DESC`, [month]);
}

export function listAllExpenses(db: Db): Promise<Expense[]> {
  return db.all<Expense>(`${SELECT} ORDER BY date DESC, id DESC`);
}
