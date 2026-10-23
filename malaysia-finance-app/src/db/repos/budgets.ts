import type { Budget } from '@/domain/types';
import type { Db } from '../types';

export function listBudgets(db: Db, month: string): Promise<Budget[]> {
  return db.all<Budget>(
    'SELECT category_id AS categoryId, month, limit_sen AS "limit" FROM budgets WHERE month = ? ORDER BY category_id',
    [month],
  );
}

export async function setBudget(db: Db, b: Budget): Promise<void> {
  await db.run(
    `INSERT INTO budgets (category_id, month, limit_sen) VALUES (?, ?, ?)
     ON CONFLICT(category_id, month) DO UPDATE SET limit_sen = excluded.limit_sen`,
    [b.categoryId, b.month, b.limit],
  );
}

export function listAllBudgets(db: Db): Promise<Budget[]> {
  return db.all<Budget>(
    'SELECT category_id AS categoryId, month, limit_sen AS "limit" FROM budgets ORDER BY month, category_id',
  );
}

export async function deleteBudget(db: Db, categoryId: number, month: string): Promise<void> {
  await db.run('DELETE FROM budgets WHERE category_id = ? AND month = ?', [categoryId, month]);
}
