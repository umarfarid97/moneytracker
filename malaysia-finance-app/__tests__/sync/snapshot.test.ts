import { freshDb, CAT } from '../screens/helpers';
import { createTestDb } from '../../test-support/sqljsDb';
import { migrate, MIGRATIONS } from '@/db/migrations';
import { deleteOwedProject } from '@/db/repos/owed';
import { addExpense, deleteExpense, listAllExpenses, updateExpense } from '@/db/repos/expenses';
import { addCategory, deleteCategory, listCategories, renameCategory } from '@/db/repos/categories';
import { addCommitment } from '@/db/repos/commitments';
import { setBudget, listAllBudgets, deleteBudget } from '@/db/repos/budgets';
import { getProfile, saveProfile } from '@/db/repos/profile';
import { getSetting, setSetting } from '@/db/repos/appSettings';
import type { Db } from '@/db/types';
import { mergeSnapshots } from '@/sync/merge';
import { ENTITY_TABLES, applySnapshot, canonical, exportSnapshot, isSnapshot, restoreSnapshot, withAllTables } from '@/sync/snapshot';

const spend = (db: Db, amount: number, note: string, categoryId: number = CAT.Makan, date = '2026-10-01') =>
  addExpense(db, { amount, categoryId, date, note, receiptUri: null });

/** One sync round between a phone and the Drive copy: merge, write the result to the phone, return it. */
async function sync(db: Db, remote: Awaited<ReturnType<typeof exportSnapshot>> | null) {
  const local = await exportSnapshot(db);
  const merged = remote ? mergeSnapshots(local, remote) : local;
  await applySnapshot(db, merged);
  return exportSnapshot(db);
}

async function tick() {
  // updated_at has millisecond resolution; make sure later edits get a later time.
  await new Promise((r) => setTimeout(r, 5));
}

describe('upgrading an existing database', () => {
  it('gives existing rows ids and edit times without counting it as an edit', async () => {
    const db = await createTestDb();
    await migrate(db, MIGRATIONS.slice(0, 3));
    await db.run(`INSERT INTO expenses (amount, category_id, date, note) VALUES (500, 1, '2026-09-01', 'old')`);
    await db.run(`INSERT INTO budgets (category_id, month, limit_sen) VALUES (1, '2026-09', 10000)`);
    await db.run('UPDATE profile SET gross_monthly = 400000');
    await migrate(db);

    const snap = await exportSnapshot(db);
    expect(snap.tables.expenses[0]).toMatchObject({ note: 'old', category_id: 'cat-Makan' });
    expect(snap.tables.expenses[0].uid).toMatch(/^[0-9a-f]{32}$/);
    expect(snap.tables.categories.every((c) => c.updated_at === 0)).toBe(true);
    expect(snap.tables.budgets[0].updated_at).toBeGreaterThan(0);
    expect(snap.profile!.updated_at).toBeGreaterThan(0);
    expect(snap.deleted).toEqual([]);
  });
});

describe('change tracking', () => {
  it('gives new rows a uid and an edit time, bumps it on edit, and records deletions', async () => {
    const db = await freshDb();
    const e = await spend(db, 1000, 'nasi');
    const row = await db.get<{ uid: string; updated_at: number }>('SELECT uid, updated_at FROM expenses WHERE id = ?', [e.id]);
    expect(row!.uid).toMatch(/^[0-9a-f]{32}$/);
    expect(row!.updated_at).toBeGreaterThan(Date.now() - 60_000);

    await tick();
    await updateExpense(db, { ...e, amount: 1200 });
    const edited = await db.get<{ updated_at: number }>('SELECT updated_at FROM expenses WHERE id = ?', [e.id]);
    expect(edited!.updated_at).toBeGreaterThan(row!.updated_at);

    await deleteExpense(db, e.id);
    const tomb = await db.get<{ tbl: string; uid: string }>('SELECT tbl, uid FROM sync_deleted');
    expect(tomb).toEqual({ tbl: 'expenses', uid: row!.uid });
  });

  it('gives the default categories the same ids on every phone', async () => {
    const a = await exportSnapshot(await freshDb());
    const b = await exportSnapshot(await freshDb());
    expect(a.tables.categories.map((r) => r.uid)).toEqual(b.tables.categories.map((r) => r.uid));
    expect(a.tables.categories[0].uid).toBe('cat-Makan');
  });

  it('records a deleted budget by category and month', async () => {
    const db = await freshDb();
    await setBudget(db, { categoryId: CAT.Makan, month: '2026-10', limit: 50000 });
    await deleteBudget(db, CAT.Makan, '2026-10');
    expect(await db.all('SELECT tbl, uid FROM sync_deleted')).toEqual([{ tbl: 'budgets', uid: 'cat-Makan|2026-10' }]);
  });
});

describe('snapshot', () => {
  it('stores references as uids and round-trips through JSON', async () => {
    const db = await freshDb();
    const bill = await addCommitment(db, { name: 'TNB', amount: 9000, dayOfMonth: 5, kind: 'bill', active: true, categoryId: CAT.Bil });
    await addExpense(db, { amount: 9000, categoryId: CAT.Bil, date: '2026-10-05', note: 'TNB', receiptUri: null, commitmentId: bill.id, dueDate: '2026-10-05' });
    const snap = await exportSnapshot(db);
    expect(isSnapshot(JSON.parse(JSON.stringify(snap)))).toBe(true);
    const exp = snap.tables.expenses[0];
    expect(exp.category_id).toBe('cat-Bil');
    expect(exp.commitment_id).toBe(snap.tables.commitments[0].uid);
    expect(exp).not.toHaveProperty('id');
  });

  it('applying a snapshot to an empty phone reproduces the data', async () => {
    const a = await freshDb();
    const food = await addCategory(a, { name: 'Groceries', icon: 'cart-outline' });
    await spend(a, 2500, 'tesco', food.id);
    await setBudget(a, { categoryId: food.id, month: '2026-10', limit: 30000 });
    await saveProfile(a, { ...(await getProfile(a)), grossMonthly: 500000 });

    const b = await freshDb();
    await applySnapshot(b, await exportSnapshot(a));
    expect(canonical(await exportSnapshot(b))).toBe(canonical(await exportSnapshot(a)));
    const [e] = await listAllExpenses(b);
    const cats = await listCategories(b);
    expect(cats.find((c) => c.id === e.categoryId)?.name).toBe('Groceries');
    expect((await getProfile(b)).grossMonthly).toBe(500000);
    expect(await listAllBudgets(b)).toHaveLength(1);
  });

  it('keeps row ids when applying and does not log the sync as edits', async () => {
    const db = await freshDb();
    const e = await spend(db, 1000, 'nasi');
    const before = await exportSnapshot(db);
    await applySnapshot(db, before);
    expect((await listAllExpenses(db))[0].id).toBe(e.id);
    expect(canonical(await exportSnapshot(db))).toBe(canonical(before));
  });
});

describe('two phones syncing through one copy', () => {
  it('combines spending added on both phones', async () => {
    const phone = await freshDb();
    const tablet = await freshDb();
    await spend(phone, 1000, 'nasi lemak');
    let drive = await sync(phone, null);
    await spend(tablet, 2000, 'grab');
    drive = await sync(tablet, drive);
    drive = await sync(phone, drive);
    expect((await listAllExpenses(phone)).map((e) => e.note).sort()).toEqual(['grab', 'nasi lemak']);
    expect((await listAllExpenses(tablet)).map((e) => e.note).sort()).toEqual(['grab', 'nasi lemak']);
  });

  it('keeps the later of two edits to the same spending', async () => {
    const phone = await freshDb();
    const tablet = await freshDb();
    await spend(phone, 1000, 'nasi');
    let drive = await sync(phone, null);
    drive = await sync(tablet, drive);

    const [onPhone] = await listAllExpenses(phone);
    await updateExpense(phone, { ...onPhone, amount: 1100 });
    await tick();
    const [onTablet] = await listAllExpenses(tablet);
    await updateExpense(tablet, { ...onTablet, amount: 1300 });

    drive = await sync(phone, drive);
    drive = await sync(tablet, drive);
    await sync(phone, drive);
    expect((await listAllExpenses(phone))[0].amount).toBe(1300);
    expect((await listAllExpenses(tablet))[0].amount).toBe(1300);
  });

  it('spreads deletions, and an edit made after a deletion brings the row back', async () => {
    const phone = await freshDb();
    const tablet = await freshDb();
    await spend(phone, 1000, 'a');
    await spend(phone, 2000, 'b');
    let drive = await sync(phone, null);
    drive = await sync(tablet, drive);

    const [b, a] = await listAllExpenses(phone);
    await deleteExpense(phone, a.id);
    await deleteExpense(phone, b.id);
    drive = await sync(phone, drive);
    await tick();
    const bOnTablet = (await listAllExpenses(tablet)).find((e) => e.note === 'b')!;
    await updateExpense(tablet, { ...bOnTablet, amount: 2500 });

    drive = await sync(tablet, drive);
    await sync(phone, drive);
    expect((await listAllExpenses(tablet)).map((e) => [e.note, e.amount])).toEqual([['b', 2500]]);
    expect((await listAllExpenses(phone)).map((e) => [e.note, e.amount])).toEqual([['b', 2500]]);
  });

  it('folds a category created on both phones under the same name into one', async () => {
    const phone = await freshDb();
    const tablet = await freshDb();
    let drive = await sync(phone, null);
    drive = await sync(tablet, drive);
    const p = await addCategory(phone, { name: 'Pets', icon: 'paw-outline' });
    const t = await addCategory(tablet, { name: 'Pets', icon: 'paw-outline' });
    await spend(phone, 100, 'kibble', p.id);
    await spend(tablet, 200, 'vet', t.id);
    drive = await sync(phone, drive);
    drive = await sync(tablet, drive);
    await sync(phone, drive);
    for (const db of [phone, tablet]) {
      const pets = (await listCategories(db)).filter((c) => c.name === 'Pets');
      expect(pets).toHaveLength(1);
      const spending = await listAllExpenses(db);
      expect(spending.map((e) => e.categoryId)).toEqual([pets[0].id, pets[0].id]);
    }
  });

  it('moves spending to Lain-lain when its category was deleted on the other phone', async () => {
    const phone = await freshDb();
    const tablet = await freshDb();
    let drive = await sync(phone, null);
    drive = await sync(tablet, drive);
    await deleteCategory(phone, CAT.Hiburan);
    drive = await sync(phone, drive);
    await spend(tablet, 1500, 'wayang', CAT.Hiburan);
    drive = await sync(tablet, drive);
    const [e] = await listAllExpenses(tablet);
    expect(e.categoryId).toBe(CAT.Lain);
    expect((await listCategories(tablet)).some((c) => c.name === 'Hiburan')).toBe(false);
  });

  it('keeps one spending when both phones record the same bill due date', async () => {
    const phone = await freshDb();
    const tablet = await freshDb();
    await addCommitment(phone, { name: 'Unifi', amount: 12900, dayOfMonth: 1, kind: 'bill', active: true });
    let drive = await sync(phone, null);
    drive = await sync(tablet, drive);
    for (const db of [phone, tablet]) {
      const billId = (await db.get<{ id: number }>('SELECT id FROM commitments'))!.id;
      await addExpense(db, { amount: 12900, categoryId: CAT.Bil, date: '2026-10-01', note: 'Unifi', receiptUri: null, commitmentId: billId, dueDate: '2026-10-01' });
    }
    drive = await sync(phone, drive);
    drive = await sync(tablet, drive);
    await sync(phone, drive);
    expect(await listAllExpenses(phone)).toHaveLength(1);
    expect(await listAllExpenses(tablet)).toHaveLength(1);
  });

  it('keeps a filled-in profile over a new phone’s blank one, and renames spread', async () => {
    const phone = await freshDb();
    await saveProfile(phone, { ...(await getProfile(phone)), grossMonthly: 600000 });
    await renameCategory(phone, CAT.Makan, 'Food');
    let drive = await sync(phone, null);
    const tablet = await freshDb();
    drive = await sync(tablet, drive);
    expect((await getProfile(tablet)).grossMonthly).toBe(600000);
    expect((await listCategories(tablet))[0].name).toBe('Food');
  });
});

describe('restore', () => {
  it('replaces the phone’s data and marks the rest deleted so sync does not bring it back', async () => {
    const db = await freshDb();
    await spend(db, 1000, 'kept');
    const backup = await exportSnapshot(db);
    await spend(db, 2000, 'after backup');
    let drive = await sync(db, null);

    await restoreSnapshot(db, backup);
    expect((await listAllExpenses(db)).map((e) => e.note)).toEqual(['kept']);
    drive = await sync(db, drive);
    expect(drive.tables.expenses.map((e) => e.note)).toEqual(['kept']);
  });
});

describe('savings, EPF and giving records', () => {
  const addAll = async (db: Db) => {
    await db.run(`INSERT INTO retirement_entries (scheme, kind, date, amount, employer_share) VALUES ('epf', 'contribution', '2026-01-31', 50000, 30000)`);
    await db.run(`INSERT INTO giving_records (kind, date, amount) VALUES ('zakat', '2026-03-01', 10000)`);
    await db.run(`INSERT INTO savings_accounts (name, kind, balance, invested) VALUES ('ASB', 'asb', 500000, 400000)`);
  };

  it('are exported with ids and edit times, and merged between phones', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await addAll(a);
    const snap = await exportSnapshot(a);
    expect(snap.tables.retirement_entries[0]).toMatchObject({ scheme: 'epf', amount: 50000 });
    expect(snap.tables.retirement_entries[0].uid).toMatch(/^[0-9a-f]{32}$/);
    expect(snap.tables.giving_records).toHaveLength(1);
    expect(snap.tables.savings_accounts[0]).toMatchObject({ name: 'ASB', balance: 500000 });

    const synced = await sync(b, snap);
    expect(synced.tables.savings_accounts).toHaveLength(1);
    expect(await b.get('SELECT amount FROM giving_records')).toEqual({ amount: 10000 });
  });

  it('deleting one on a phone deletes it on the other', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await addAll(a);
    const first = await sync(b, await exportSnapshot(a));
    await tick();
    await b.run('DELETE FROM savings_accounts');
    const merged = await sync(a, await exportSnapshot(b));
    expect(first.tables.savings_accounts).toHaveLength(1);
    expect(merged.tables.savings_accounts).toHaveLength(0);
  });

  it('an older backup without these tables still restores, and leaves them empty', async () => {
    const db = await freshDb();
    await addAll(db);
    const old = JSON.parse(JSON.stringify(await exportSnapshot(await freshDb()))) as Record<string, any>;
    delete old.tables.retirement_entries;
    delete old.tables.giving_records;
    delete old.tables.savings_accounts;
    old.schema = 4;
    expect(isSnapshot(old)).toBe(true);
    await restoreSnapshot(db, withAllTables(old as any));
    expect(await db.all('SELECT * FROM savings_accounts')).toEqual([]);
    expect(await db.all('SELECT * FROM giving_records')).toEqual([]);
  });
});

describe('foreign currency, owed money and extra income', () => {
  it('are exported and merged between phones', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await a.run(`INSERT INTO expenses (amount, category_id, date, currency, foreign_amount, fx_rate) VALUES (6600, 1, '2026-10-20', 'SGD', 2000, 3.3)`);
    await a.run(`INSERT INTO owed_entries (person, kind, amount, date) VALUES ('Aina', 'lent', 5000, '2026-10-20')`);
    await a.run(`INSERT INTO income_rules (name, amount, day_of_month, active, start_date) VALUES ('Rent', 100, 5, 1, '2026-10-01')`);
    await a.run(`INSERT INTO income_entries (name, amount, date) VALUES ('Rent', 100, '2026-10-05')`);
    const snap = await exportSnapshot(a);
    expect(snap.tables.expenses[0]).toMatchObject({ currency: 'SGD', foreign_amount: 2000, fx_rate: 3.3 });
    await sync(b, snap);
    expect(await b.get('SELECT person, amount FROM owed_entries')).toEqual({ person: 'Aina', amount: 5000 });
    expect(await b.get('SELECT currency, foreign_amount AS f FROM expenses')).toEqual({ currency: 'SGD', f: 2000 });
    expect(await b.all('SELECT name FROM income_rules')).toEqual([{ name: 'Rent' }]);
    expect(await b.all('SELECT name FROM income_entries')).toEqual([{ name: 'Rent' }]);
  });
});

describe('Others: projects', () => {
  it('the upgrade turns event names into projects and puts the rest in the default project', async () => {
    const db = await createTestDb();
    await migrate(db, MIGRATIONS.slice(0, 10));
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, event) VALUES
      ('Aina', 'lent', 5000, '2026-10-20', 'Penang trip'), ('Ben', 'lent', 100, '2026-10-21', 'penang trip'),
      ('Aina', 'lent', 700, '2026-10-22', ''), ('Chen', 'lent', 300, '2026-10-23', 'Dinner')`);
    await migrate(db);
    const projects = await db.all('SELECT name, uid, members FROM owed_projects ORDER BY uid');
    expect(projects.map((p: any) => p.uid)).toEqual(['proj-dinner', 'proj-general', 'proj-penang trip']);
    const rows = await db.all<{ person: string; project: string }>(
      'SELECT e.person AS person, p.uid AS project FROM owed_entries e JOIN owed_projects p ON p.id = e.project_id ORDER BY e.id',
    );
    expect(rows.map((r) => [r.person, r.project])).toEqual([
      ['Aina', 'proj-penang trip'], ['Ben', 'proj-penang trip'], ['Aina', 'proj-general'], ['Chen', 'proj-dinner'],
    ]);
    expect((projects.find((p: any) => p.uid === 'proj-penang trip') as any).members.split('\n').sort()).toEqual(['Aina', 'Ben']);
  });

  it('projects and the entries in them are exported and merged between phones', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await a.run(`INSERT INTO owed_projects (name, members) VALUES ('Trip', 'Aina')`);
    const project = await a.get<{ id: number }>(`SELECT id FROM owed_projects WHERE name = 'Trip'`);
    await a.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES ('Aina', 'lent', 5000, '2026-10-20', ?)`, [project!.id]);
    const snap = await exportSnapshot(a);
    expect(snap.tables.owed_entries[0].project_id).toBe(snap.tables.owed_projects.find((p) => p.name === 'Trip')!.uid);
    await sync(b, snap);
    expect(await b.get(`SELECT e.person AS person, p.name AS project FROM owed_entries e JOIN owed_projects p ON p.id = e.project_id`)).toEqual({
      person: 'Aina', project: 'Trip',
    });
    // The default project is the same on both phones, so it is not duplicated.
    expect((await b.all(`SELECT 1 FROM owed_projects WHERE uid = 'proj-general'`)).length).toBe(1);
  });

  it('who paid (counter) travels between phones, and rows from before it get an empty one', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await a.run(`INSERT INTO owed_entries (person, kind, amount, date, counter, project_id) VALUES ('Ben', 'lent', 900, '2026-10-20', 'Aina', (SELECT id FROM owed_projects WHERE uid = 'proj-general'))`);
    await sync(b, await exportSnapshot(a));
    expect(await b.get('SELECT person, counter FROM owed_entries')).toEqual({ person: 'Ben', counter: 'Aina' });

    const old = JSON.parse(JSON.stringify(await exportSnapshot(a))) as Record<string, any>;
    for (const row of old.tables.owed_entries) delete row.counter;
    const c = await freshDb();
    await sync(c, old as Awaited<ReturnType<typeof exportSnapshot>>);
    expect(await c.get('SELECT person, counter FROM owed_entries')).toEqual({ person: 'Ben', counter: '' });
  });

  it('deleting a project deletes its entries, and that reaches the other phone', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await a.run(`INSERT INTO owed_projects (name) VALUES ('Trip')`);
    const project = (await a.get<{ id: number }>(`SELECT id FROM owed_projects WHERE name = 'Trip'`))!;
    await a.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES ('Aina', 'lent', 5000, '2026-10-20', ?)`, [project.id]);
    await sync(b, await exportSnapshot(a));
    await tick();
    await deleteOwedProject(b, (await b.get<{ id: number }>(`SELECT id FROM owed_projects WHERE name = 'Trip'`))!.id);
    await sync(a, await exportSnapshot(b));
    expect(await a.all('SELECT 1 FROM owed_projects WHERE name = ?', ['Trip'])).toEqual([]);
    expect(await a.all('SELECT 1 FROM owed_entries')).toEqual([]);
  });

  it('the default project cannot be deleted', async () => {
    const db = await freshDb();
    const general = (await db.get<{ id: number }>(`SELECT id FROM owed_projects WHERE uid = 'proj-general'`))!;
    await deleteOwedProject(db, general.id);
    expect((await db.all('SELECT 1 FROM owed_projects WHERE uid = ?', ['proj-general'])).length).toBe(1);
  });

  it('a backup from before projects restores its event names as projects', async () => {
    const db = await freshDb();
    const old = JSON.parse(JSON.stringify(await exportSnapshot(await freshDb()))) as Record<string, any>;
    delete old.tables.owed_projects;
    old.tables.owed_entries = [
      { uid: 'old1', updated_at: 5, person: 'Aina', kind: 'lent', amount: 100, date: '2026-10-01', note: '', event: 'Penang trip' },
      { uid: 'old2', updated_at: 5, person: 'Ben', kind: 'lent', amount: 200, date: '2026-10-01', note: '' },
    ];
    await restoreSnapshot(db, withAllTables(old as any));
    const rows = await db.all<{ person: string; project: string }>(
      'SELECT e.person AS person, p.uid AS project FROM owed_entries e JOIN owed_projects p ON p.id = e.project_id ORDER BY e.id',
    );
    expect(rows.map((r) => [r.person, r.project])).toEqual([['Aina', 'proj-penang trip'], ['Ben', 'proj-general']]);
  });

  it('an entry whose project was deleted on another phone moves to the default project', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await a.run(`INSERT INTO owed_projects (name) VALUES ('Trip')`);
    const trip = (await a.get<{ id: number }>(`SELECT id FROM owed_projects WHERE name = 'Trip'`))!;
    await sync(b, await exportSnapshot(a));
    await tick();
    await deleteOwedProject(b, (await b.get<{ id: number }>(`SELECT id FROM owed_projects WHERE name = 'Trip'`))!.id);
    await tick();
    // Meanwhile phone A adds an entry to the project that B just deleted.
    await a.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES ('Aina', 'lent', 100, '2026-10-20', ?)`, [trip.id]);
    const merged = await sync(b, await exportSnapshot(a));
    expect(merged.tables.owed_entries).toHaveLength(1);
    expect(await b.get(`SELECT p.uid AS project FROM owed_entries e JOIN owed_projects p ON p.id = e.project_id`)).toEqual({ project: 'proj-general' });
  });
});

describe('backup coverage', () => {
  test('every table that tracks changes (has a uid) is part of the snapshot', async () => {
    const db = await freshDb();
    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    const tracked: string[] = [];
    for (const { name } of tables) {
      const cols = await db.all<{ name: string }>(`PRAGMA table_info(${name})`);
      if (cols.some((c) => c.name === 'uid')) tracked.push(name);
    }
    expect(tracked.filter((n) => n !== 'sync_deleted').sort()).toEqual([...ENTITY_TABLES].sort());
  });
});

describe('Home layout sync', () => {
  const layout = (categoryOrder: number[], categoryHidden: number[] = []) =>
    JSON.stringify({ order: ['balance', 'today'], visible: { recent: true }, categoryOrder, categoryHidden });

  it('carries the layout to another phone, mapping categories by uid', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await setSetting(a, 'homeLayout', layout([CAT.Makan, CAT.Lain], [CAT.Lain]));
    await setSetting(a, 'homeLayoutAt', '1000');
    const snap = await exportSnapshot(a);
    expect(snap.homeLayout!.updatedAt).toBe(1000);
    expect(snap.homeLayout!.categoryOrder.every((u) => typeof u === 'string')).toBe(true);
    await applySnapshot(b, mergeSnapshots(await exportSnapshot(b), snap));
    const got = JSON.parse((await getSetting(b, 'homeLayout'))!);
    expect(got.order).toEqual(['balance', 'today']);
    expect(got.categoryOrder).toEqual([CAT.Makan, CAT.Lain]);
    expect(got.categoryHidden).toEqual([CAT.Lain]);
  });

  it('keeps the newest layout and tolerates snapshots without one', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await setSetting(a, 'homeLayout', layout([CAT.Makan]));
    await setSetting(a, 'homeLayoutAt', '1000');
    await setSetting(b, 'homeLayout', layout([CAT.Lain]));
    await setSetting(b, 'homeLayoutAt', '2000');
    const merged = mergeSnapshots(await exportSnapshot(a), await exportSnapshot(b));
    expect(merged.homeLayout!.updatedAt).toBe(2000);
    const old = await exportSnapshot(a);
    delete old.homeLayout;
    expect(isSnapshot(old)).toBe(true);
    expect(mergeSnapshots(await exportSnapshot(b), old).homeLayout!.updatedAt).toBe(2000);
    await applySnapshot(b, old);
    expect(await getSetting(b, 'homeLayout')).toBe(layout([CAT.Lain]));
  });
});
