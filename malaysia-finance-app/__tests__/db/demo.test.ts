import { CAT, freshDb } from '../screens/helpers';
import type { Db } from '@/db/types';
import { clearDemoData, isDemoLoaded, loadDemoData } from '@/db/repos/demo';
import { addExpense, listAllExpenses } from '@/db/repos/expenses';
import { setBudget, listAllBudgets } from '@/db/repos/budgets';
import { addCommitment } from '@/db/repos/commitments';
import { addOwedEntry, addOwedProject, listOwedEntries, listOwedProjects } from '@/db/repos/owed';
import { addSavingsAccount, listSavingsAccounts } from '@/db/repos/savings';
import { getProfile, saveProfile } from '@/db/repos/profile';
import { periodKey } from '@/domain/budgetPeriod';
import { createBackup, parseBackup, restoreBackup } from '@/sync/backup';
import { DemoLoadedError, syncWithDrive } from '@/sync/driveSync';

jest.mock('@/sync/receiptFiles', () => ({
  RECEIPT_FILES: false,
  isStoredReceipt: () => false,
  readReceiptBase64: jest.fn(),
  writeReceiptBase64: jest.fn(),
}));

const TODAY = '2026-10-27';
const TABLES = [
  'expenses', 'budgets', 'commitments', 'relief_claims', 'retirement_entries', 'giving_records', 'savings_accounts',
  'owed_projects', 'owed_entries', 'income_rules', 'income_entries',
];

const counts = async (db: Db) => {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))!.n;
  return out;
};

/** A little real data of every kind the demo also touches. */
async function addRealData(db: Db) {
  await addExpense(db, { amount: 1234, categoryId: CAT.Makan, date: '2026-10-05', note: 'my own nasi', receiptUri: null });
  await setBudget(db, { categoryId: CAT.Makan, month: periodKey(TODAY, 25), limit: 77_700 });
  await setBudget(db, { categoryId: CAT.Rumah, month: '2026-01', limit: 5_000 });
  await addCommitment(db, { name: 'My gym', amount: 8000, dayOfMonth: 3, kind: 'subscription', active: true, categoryId: CAT.Hiburan });
  await addSavingsAccount(db, { name: 'My savings', kind: 'other', balance: 50_000, invested: 0, target: null, monthly: null, note: '' });
  const project = await addOwedProject(db, { name: 'My trip', startDate: null, endDate: null, members: ['Ali'], owner: '' });
  await addOwedEntry(db, { person: 'Ali', kind: 'lent', amount: 2000, date: '2026-10-02', note: 'real', projectId: project.id, counter: '' });
}

describe('demo data', () => {
  test('loading fills every feature and tags every row', async () => {
    const db = await freshDb();
    const base = await counts(db);
    expect(await isDemoLoaded(db)).toBe(false);
    expect(await loadDemoData(db, TODAY)).toBe(true);
    expect(await isDemoLoaded(db)).toBe(true);

    const n = await counts(db);
    for (const t of TABLES) expect(n[t]).toBeGreaterThan(base[t]);
    const tagged = await db.all<{ tbl: string; n: number }>('SELECT tbl, COUNT(*) AS n FROM demo_records GROUP BY tbl');
    const added = Object.fromEntries(TABLES.map((t) => [t, n[t] - base[t]]));
    expect(Object.fromEntries(tagged.map((r) => [r.tbl, r.n]))).toEqual(added);

    // Spending in both the current and the previous month, with notes and payment methods.
    const expenses = await listAllExpenses(db);
    expect(new Set(expenses.map((e) => e.date.slice(0, 7)))).toEqual(new Set(['2026-09', '2026-10']));
    expect(expenses.every((e) => e.date <= TODAY)).toBe(true);
    expect(expenses.every((e) => e.note !== '' && e.paymentMethodId !== null)).toBe(true);

    const profile = await getProfile(db);
    expect(profile.grossMonthly).toBe(650_000);
    expect(profile.budgetStartDay).toBe(25);
  });

  test('loading twice does nothing the second time', async () => {
    const db = await freshDb();
    await loadDemoData(db, TODAY);
    const before = await counts(db);
    expect(await loadDemoData(db, TODAY)).toBe(false);
    expect(await counts(db)).toEqual(before);
  });

  test('clearing removes only demo records and leaves real data intact', async () => {
    const db = await freshDb();
    await addRealData(db);
    const real = await counts(db);
    const realExpenses = await listAllExpenses(db);

    await loadDemoData(db, TODAY);
    // The person's own budget for the same category and period is not replaced.
    const budget = (await listAllBudgets(db)).find((b) => b.categoryId === CAT.Makan && b.month === periodKey(TODAY, 25));
    expect(budget?.limit).toBe(77_700);

    await clearDemoData(db);
    expect(await counts(db)).toEqual(real);
    expect(await listAllExpenses(db)).toEqual(realExpenses);
    expect((await listAllBudgets(db)).map((b) => `${b.categoryId}|${b.month}|${b.limit}`).sort()).toEqual(
      [`${CAT.Makan}|${periodKey(TODAY, 25)}|77700`, `${CAT.Rumah}|2026-01|5000`].sort(),
    );
    expect((await listSavingsAccounts(db)).map((s) => s.name)).toEqual(['My savings']);
    expect((await listOwedProjects(db)).map((p) => p.name)).not.toContain('Langkawi trip');
    expect((await listOwedEntries(db)).map((e) => e.note)).toContain('real');
    expect(await isDemoLoaded(db)).toBe(false);
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM demo_records'))!.n).toBe(0);
    // Clearing is not a real deletion, so nothing is left for sync to spread.
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sync_deleted'))!.n).toBe(0);
  });

  test('clearing also removes what was added inside demo bills, projects and recurring income', async () => {
    const db = await freshDb();
    const real = await counts(db);
    await loadDemoData(db, TODAY);
    const bill = (await db.get<{ id: number }>(`SELECT id FROM commitments WHERE uid = 'demo-bill-tnb'`))!;
    await db.run('INSERT INTO expenses (amount, category_id, date, note, commitment_id, due_date) VALUES (1, ?, ?, ?, ?, ?)', [CAT.Bil, '2026-10-26', 'paid by me', bill.id, '2026-10-26']);
    const project = (await listOwedProjects(db)).find((p) => p.name === 'Langkawi trip')!;
    await addOwedEntry(db, { person: 'Aiman', kind: 'lent', amount: 100, date: TODAY, note: 'extra', projectId: project.id, counter: '' });
    await db.run(`INSERT INTO income_entries (name, amount, date, uid) VALUES ('Freelance design', 1, '2026-11-20', 'inc-demo-income-freelance-2026-11-20')`);

    await clearDemoData(db);
    expect(await counts(db)).toEqual(real);
  });

  test('an empty profile is filled in and put back; a real one is never touched', async () => {
    const empty = await freshDb();
    const before = await getProfile(empty);
    await loadDemoData(empty, TODAY);
    await clearDemoData(empty);
    expect(await getProfile(empty)).toEqual(before);

    const real = await freshDb();
    await saveProfile(real, { ...(await getProfile(real)), grossMonthly: 900_000, budgetStartDay: 3 });
    const mine = await getProfile(real);
    await loadDemoData(real, TODAY);
    expect(await getProfile(real)).toEqual(mine);
    await clearDemoData(real);
    expect(await getProfile(real)).toEqual(mine);
  });

  test('a profile field edited while demo data was loaded keeps the edit', async () => {
    const db = await freshDb();
    await loadDemoData(db, TODAY);
    await saveProfile(db, { ...(await getProfile(db)), grossMonthly: 777_700 });
    await clearDemoData(db);
    const p = await getProfile(db);
    expect(p.grossMonthly).toBe(777_700);
    expect(p.socsoMonthly).toBe(0);
  });

  test('backups leave demo data out and show the profile as it was', async () => {
    const db = await freshDb();
    await addRealData(db);
    await loadDemoData(db, TODAY);
    const backup = JSON.parse(await createBackup(db));
    expect(backup.tables.expenses.map((e: { note: string }) => e.note)).toEqual(['my own nasi']);
    expect(backup.tables.commitments.map((c: { name: string }) => c.name)).toEqual(['My gym']);
    expect(backup.tables.budgets).toHaveLength(2);
    expect(backup.tables.owed_projects.map((p: { name: string }) => p.name)).not.toContain('Langkawi trip');
    expect(backup.profile.gross_monthly).toBe(0);
  });

  test('Drive sync refuses to run while demo data is loaded', async () => {
    const db = await freshDb();
    await loadDemoData(db, TODAY);
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(syncWithDrive(db, 'token')).rejects.toBeInstanceOf(DemoLoadedError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('restoring a backup replaces demo data and stops tracking it', async () => {
    const db = await freshDb();
    await addRealData(db);
    const text = await createBackup(db);
    await loadDemoData(db, TODAY);
    await restoreBackup(db, await parseBackup(db, text));
    expect(await isDemoLoaded(db)).toBe(false);
    expect((await listAllExpenses(db)).map((e) => e.note)).toEqual(['my own nasi']);
    expect(await counts(db)).toMatchObject({ commitments: 1, savings_accounts: 1, owed_projects: 2 });
  });
});
