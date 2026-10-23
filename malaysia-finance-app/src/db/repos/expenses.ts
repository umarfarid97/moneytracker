import type { Expense } from '@/domain/types';
import type { Db } from '../types';

const SELECT =
  'SELECT id, amount, category_id AS categoryId, date, note, receipt_uri AS receiptUri FROM expenses';

export async function addExpense(db: Db, input: Omit<Expense, 'id'>): Promise<Expense> {
  const r = await db.run(
    'INSERT INTO expenses (amount, category_id, date, note, receipt_uri) VALUES (?, ?, ?, ?, ?)',
    [input.amount, input.categoryId, input.date, input.note, input.receiptUri],
  );
  return { id: r.lastInsertRowId, ...input };
}

export async function updateExpense(db: Db, e: Expense): Promise<void> {
  await db.run(
    'UPDATE expenses SET amount = ?, category_id = ?, date = ?, note = ?, receipt_uri = ? WHERE id = ?',
    [e.amount, e.categoryId, e.date, e.note, e.receiptUri, e.id],
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
