import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { createTestDb } from '../../test-support/sqljsDb';
import { migrate } from '@/db/migrations';
import type { Db } from '@/db/types';
import { DataProvider } from '@/hooks/DataProvider';

/** A migrated in-memory database seeded with the default categories (ids 1-8 in default order). */
export async function freshDb(): Promise<Db> {
  const db = await createTestDb();
  await migrate(db);
  return db;
}

export const CAT = {
  Makan: 1, Transport: 2, Bil: 3, Rumah: 4, Hiburan: 5, Kesihatan: 6, Pendidikan: 7, Lain: 8,
} as const;

export async function addExpenseRow(db: Db, categoryId: number, amount: number, date: string, note = '') {
  await db.run('INSERT INTO expenses (amount, category_id, date, note) VALUES (?, ?, ?, ?)', [
    amount, categoryId, date, note,
  ]);
}

export async function setBudgetRow(db: Db, categoryId: number, month: string, limit: number) {
  await db.run('INSERT INTO budgets (category_id, month, limit_sen) VALUES (?, ?, ?)', [categoryId, month, limit]);
}

export function renderWithData(db: Db, ui: ReactElement) {
  return render(<DataProvider db={db}>{ui}</DataProvider>);
}
