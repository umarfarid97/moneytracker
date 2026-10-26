import { createTestDb } from '../../test-support/sqljsDb';
import type { Db } from '@/db/types';
import { MIGRATIONS, migrate } from '@/db/migrations';
import { listCategories, deleteCategory } from '@/db/repos/categories';
import {
  addExpense, updateExpense, deleteExpense, listExpensesByDate, listExpensesByMonth,
} from '@/db/repos/expenses';
import { setBudget, listBudgets } from '@/db/repos/budgets';
import { addCommitment, listCommitments, updateCommitment, deleteCommitment } from '@/db/repos/commitments';
import { addReliefClaim, listReliefClaims, deleteReliefClaim } from '@/db/repos/reliefClaims';
import { getProfile, saveProfile } from '@/db/repos/profile';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
});

const version = async () => (await db.get<{ user_version: number }>('PRAGMA user_version'))!.user_version;

describe('migrate', () => {
  test('empty database reaches latest version with 8 default categories', async () => {
    expect(await version()).toBe(MIGRATIONS.length);
    const cats = await listCategories(db);
    expect(cats.map((c) => c.name)).toEqual([
      'Makan', 'Transport', 'Bil', 'Rumah', 'Hiburan', 'Kesihatan', 'Pendidikan', 'Lain-lain',
    ]);
  });

  test('running migrate again changes nothing', async () => {
    await migrate(db);
    expect(await version()).toBe(MIGRATIONS.length);
    expect((await listCategories(db)).length).toBe(8);
  });

  test('upgrades an older seeded database without losing data', async () => {
    const cats = await listCategories(db);
    await addExpense(db, { amount: 1234, categoryId: cats[0].id, date: '2026-10-24', note: 'nasi', receiptUri: null });
    const next = [...MIGRATIONS, 'ALTER TABLE expenses ADD COLUMN tag TEXT;'];
    await migrate(db, next);
    expect(await version()).toBe(next.length);
    expect((await listExpensesByDate(db, '2026-10-24')).length).toBe(1);
  });

  test('bills saved before the variable type existed come back as fixed', async () => {
    const old = await createTestDb();
    await migrate(old, MIGRATIONS.slice(0, 2));
    await old.run("INSERT INTO commitments (name, amount, day_of_month, kind) VALUES ('Astro', 8900, 5, 'subscription')");
    await migrate(old);
    expect((await listCommitments(old))[0]).toMatchObject({ name: 'Astro', amount: 8900, variable: false });
  });

  test('a failing migration rolls back and keeps the old version', async () => {
    const bad = [...MIGRATIONS, 'CREATE TABLE ok_table (id INTEGER); THIS IS NOT SQL;'];
    await expect(migrate(db, bad)).rejects.toThrow();
    expect(await version()).toBe(MIGRATIONS.length);
    const t = await db.get('SELECT name FROM sqlite_master WHERE name = ?', ['ok_table']);
    expect(t).toBeNull();
  });
});

describe('expenses', () => {
  test('amounts round-trip as integer sen', async () => {
    const [makan] = await listCategories(db);
    const e = await addExpense(db, { amount: 1999, categoryId: makan.id, date: '2026-10-24', note: '', receiptUri: null });
    const [row] = await listExpensesByDate(db, '2026-10-24');
    expect(row.id).toBe(e.id);
    expect(row.amount).toBe(1999);
    expect(Number.isInteger(row.amount)).toBe(true);
  });

  test('update and delete work', async () => {
    const [makan] = await listCategories(db);
    const e = await addExpense(db, { amount: 500, categoryId: makan.id, date: '2026-10-24', note: 'a', receiptUri: null });
    await updateExpense(db, { ...e, amount: 700, note: 'b' });
    expect((await listExpensesByDate(db, '2026-10-24'))[0]).toMatchObject({ amount: 700, note: 'b' });
    await deleteExpense(db, e.id);
    expect(await listExpensesByDate(db, '2026-10-24')).toEqual([]);
  });

  test('month listing includes the last day and excludes the next month', async () => {
    const [makan] = await listCategories(db);
    const base = { categoryId: makan.id, note: '', receiptUri: null, amount: 100 };
    await addExpense(db, { ...base, date: '2026-10-31' });
    await addExpense(db, { ...base, date: '2026-11-01' });
    expect((await listExpensesByMonth(db, '2026-10')).length).toBe(1);
  });
});

describe('deleteCategory', () => {
  test('moves expenses to Lain-lain and removes its budgets', async () => {
    const cats = await listCategories(db);
    const hiburan = cats.find((c) => c.name === 'Hiburan')!;
    const lain = cats.find((c) => c.name === 'Lain-lain')!;
    await addExpense(db, { amount: 800, categoryId: hiburan.id, date: '2026-10-24', note: '', receiptUri: null });
    await setBudget(db, { categoryId: hiburan.id, month: '2026-10', limit: 20000 });
    await deleteCategory(db, hiburan.id);
    const rows = await listExpensesByMonth(db, '2026-10');
    expect(rows.length).toBe(1);
    expect(rows[0].categoryId).toBe(lain.id);
    expect(await listBudgets(db, '2026-10')).toEqual([]);
    expect((await listCategories(db)).some((c) => c.id === hiburan.id)).toBe(false);
  });

  test('Lain-lain cannot be deleted', async () => {
    const lain = (await listCategories(db)).find((c) => c.name === 'Lain-lain')!;
    await expect(deleteCategory(db, lain.id)).rejects.toThrow();
  });
});

describe('budgets', () => {
  test('setBudget upserts per category and month', async () => {
    const [makan] = await listCategories(db);
    await setBudget(db, { categoryId: makan.id, month: '2026-10', limit: 60000 });
    await setBudget(db, { categoryId: makan.id, month: '2026-10', limit: 65000 });
    expect(await listBudgets(db, '2026-10')).toEqual([{ categoryId: makan.id, month: '2026-10', limit: 65000 }]);
  });
});

describe('commitments', () => {
  test('crud with boolean active flag', async () => {
    const c = await addCommitment(db, { name: 'Rumah', amount: 120000, dayOfMonth: 1, kind: 'loan', active: true });
    expect((await listCommitments(db))[0]).toMatchObject({ name: 'Rumah', active: true, variable: false });
    await updateCommitment(db, { ...c, variable: true });
    expect((await listCommitments(db))[0].variable).toBe(true);
    await updateCommitment(db, { ...c, active: false });
    expect((await listCommitments(db))[0].active).toBe(false);
    await deleteCommitment(db, c.id);
    expect(await listCommitments(db)).toEqual([]);
  });
});

describe('relief claims', () => {
  test('add, list by year, delete', async () => {
    const r = await addReliefClaim(db, { reliefId: 'lifestyle', year: 2025, amount: 100000, receiptUri: null, note: '' });
    await addReliefClaim(db, { reliefId: 'lifestyle', year: 2024, amount: 50000, receiptUri: null, note: '' });
    expect((await listReliefClaims(db, 2025)).length).toBe(1);
    await deleteReliefClaim(db, r.id);
    expect(await listReliefClaims(db, 2025)).toEqual([]);
  });
});

describe('profile', () => {
  test('has a default row and saves changes', async () => {
    expect(await getProfile(db)).toEqual({
      grossMonthly: 0, netMonthlyOverride: null, epfRate: 0.11, socsoMonthly: 0, eisMonthly: 0, budgetStartDay: 1,
    });
    await saveProfile(db, { grossMonthly: 500000, netMonthlyOverride: 420000, epfRate: 0.11, socsoMonthly: 1000, eisMonthly: 400, budgetStartDay: 28 });
    expect((await getProfile(db)).netMonthlyOverride).toBe(420000);
    expect((await getProfile(db)).budgetStartDay).toBe(28);
  });
});
