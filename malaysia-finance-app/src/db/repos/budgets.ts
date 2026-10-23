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
