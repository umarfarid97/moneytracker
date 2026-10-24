import type { Category } from '@/domain/types';
import type { Db } from '../types';

export const FALLBACK_CATEGORY = 'Lain-lain';

export function listCategories(db: Db): Promise<Category[]> {
  return db.all<Category>(
    'SELECT id, name, icon, sort_order AS sortOrder FROM categories ORDER BY sort_order, id',
  );
}

export async function addCategory(db: Db, input: Omit<Category, 'id' | 'sortOrder'>): Promise<Category> {
  const next = await db.get<{ n: number }>('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM categories');
  const sortOrder = next?.n ?? 1;
  const r = await db.run('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)', [
    input.name, input.icon, sortOrder,
  ]);
  return { id: r.lastInsertRowId, sortOrder, ...input };
}

export async function renameCategory(db: Db, id: number, name: string): Promise<void> {
  await db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
}

/** Past expenses are kept: they move to the fallback category. Its budgets are removed. */
export async function deleteCategory(db: Db, id: number): Promise<void> {
  const target = await db.get<{ name: string }>('SELECT name FROM categories WHERE id = ?', [id]);
  if (!target) return;
  if (target.name === FALLBACK_CATEGORY) throw new Error(`"${FALLBACK_CATEGORY}" cannot be deleted`);
  const fallback = await db.get<{ id: number }>('SELECT id FROM categories WHERE name = ?', [FALLBACK_CATEGORY]);
  if (!fallback) throw new Error(`"${FALLBACK_CATEGORY}" category is missing`);
  await db.transaction(async () => {
    await db.run('UPDATE expenses SET category_id = ? WHERE category_id = ?', [fallback.id, id]);
    await db.run('UPDATE commitments SET category_id = ? WHERE category_id = ?', [fallback.id, id]);
    await db.run('DELETE FROM budgets WHERE category_id = ?', [id]);
    await db.run('DELETE FROM categories WHERE id = ?', [id]);
  });
}
