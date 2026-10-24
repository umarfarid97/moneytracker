import { createTestDb } from '../../test-support/sqljsDb';
import type { Db } from '@/db/types';
import { MIGRATIONS, migrate } from '@/db/migrations';
import { deleteCategory, listCategories } from '@/db/repos/categories';
import {
  addPaymentMethod, deletePaymentMethod, listPaymentMethods, renamePaymentMethod,
} from '@/db/repos/paymentMethods';
import {
  addBillExpense, addExpense, listAllExpenses, updateExpense,
} from '@/db/repos/expenses';
import { addCommitment, listCommitments, updateCommitment } from '@/db/repos/commitments';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
});

describe('migration 2 upgrades a version 1 database without losing anything', () => {
  test('existing expenses, bills and claims survive and get empty new fields', async () => {
    const old = await createTestDb();
    await migrate(old, MIGRATIONS.slice(0, 1));
    await old.run("INSERT INTO expenses (amount, category_id, date, note, receipt_uri) VALUES (1250, 1, '2026-10-20', 'nasi', 'r.jpg')");
    await old.run("INSERT INTO commitments (name, amount, day_of_month, kind, active) VALUES ('Astro', 8900, 5, 'subscription', 1)");
    await old.run("INSERT INTO relief_claims (relief_id, year, amount, receipt_uri, note) VALUES ('lifestyle', 2025, 100000, NULL, 'Phone')");
    await migrate(old);
    const [e] = await listAllExpenses(old);
    expect(e).toMatchObject({ amount: 1250, note: 'nasi', receiptUri: 'r.jpg', paymentMethodId: null, reliefId: null, reliefAmount: null, commitmentId: null, dueDate: null });
    const [c] = await listCommitments(old);
    expect(c).toMatchObject({ name: 'Astro', categoryId: null, paymentMethodId: null, reliefId: null, autoRecord: false, lastAutoDue: null });
    expect(c.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await old.all('SELECT * FROM relief_claims')).length).toBe(1);
    expect((await listPaymentMethods(old)).length).toBe(5);
    expect((await old.get<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(MIGRATIONS.length);
  });
});

describe('payment methods', () => {
  test('are seeded with Cash first', async () => {
    const names = (await listPaymentMethods(db)).map((m) => m.name);
    expect(names).toEqual(['Cash', 'Debit card', 'Credit card', 'E-wallet', 'Online transfer']);
  });

  test('can be added and renamed', async () => {
    const m = await addPaymentMethod(db, { name: 'Maybank Visa', kind: 'credit' });
    expect(m).toMatchObject({ name: 'Maybank Visa', kind: 'credit' });
    await renamePaymentMethod(db, m.id, 'CIMB Visa');
    expect((await listPaymentMethods(db)).map((x) => x.name)).toContain('CIMB Visa');
  });

  test('deleting one moves its spending and bills to Cash; Cash itself is protected', async () => {
    const cats = await listCategories(db);
    const [cash] = await listPaymentMethods(db);
    const visa = await addPaymentMethod(db, { name: 'Maybank Visa', kind: 'credit' });
    await addExpense(db, { amount: 500, categoryId: cats[0].id, date: '2026-10-24', note: 'a', receiptUri: null, paymentMethodId: visa.id });
    await addCommitment(db, { name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true, paymentMethodId: visa.id });
    await deletePaymentMethod(db, visa.id);
    expect((await listAllExpenses(db))[0].paymentMethodId).toBe(cash.id);
    expect((await listCommitments(db))[0].paymentMethodId).toBe(cash.id);
    expect((await listPaymentMethods(db)).some((m) => m.id === visa.id)).toBe(false);
    await expect(deletePaymentMethod(db, cash.id)).rejects.toThrow();
  });
});

describe('expenses with the new fields', () => {
  test('default to null and round trip relief tag, claimable amount and method', async () => {
    const cats = await listCategories(db);
    const plain = await addExpense(db, { amount: 100, categoryId: cats[0].id, date: '2026-10-24', note: '', receiptUri: null });
    expect(plain).toMatchObject({ paymentMethodId: null, reliefId: null, reliefAmount: null, commitmentId: null, dueDate: null });
    const tagged = await addExpense(db, {
      amount: 20000, categoryId: cats[5].id, date: '2026-10-24', note: 'klinik', receiptUri: 'r.jpg',
      paymentMethodId: 3, reliefId: 'medical-serious', reliefAmount: 4000,
    });
    const saved = (await listAllExpenses(db)).find((e) => e.id === tagged.id)!;
    expect(saved).toMatchObject({ paymentMethodId: 3, reliefId: 'medical-serious', reliefAmount: 4000 });
    await updateExpense(db, { ...saved, reliefId: null, reliefAmount: null });
    expect((await listAllExpenses(db)).find((e) => e.id === tagged.id)).toMatchObject({ reliefId: null, reliefAmount: null });
  });

  test('a bill due date can be recorded only once', async () => {
    const cats = await listCategories(db);
    const bill = await addCommitment(db, { name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true });
    const base = { amount: 8900, categoryId: cats[2].id, date: '2026-10-05', note: 'Astro', receiptUri: null, commitmentId: bill.id, dueDate: '2026-10-05' };
    const first = await addBillExpense(db, base);
    const second = await addBillExpense(db, { ...base, date: '2026-10-06' });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect((await listAllExpenses(db)).filter((e) => e.commitmentId === bill.id)).toHaveLength(1);
    const next = await addBillExpense(db, { ...base, date: '2026-11-05', dueDate: '2026-11-05' });
    expect(next).not.toBeNull();
  });

  test('ordinary spending is not affected by the bill uniqueness rule', async () => {
    const cats = await listCategories(db);
    const e = { amount: 100, categoryId: cats[0].id, date: '2026-10-24', note: '', receiptUri: null };
    await addExpense(db, e);
    await addExpense(db, e);
    expect(await listAllExpenses(db)).toHaveLength(2);
  });
});

describe('commitments with the new fields', () => {
  test('round trip category, method, relief tag, auto switch and dates', async () => {
    const c = await addCommitment(db, {
      name: 'Insurance', amount: 30000, dayOfMonth: 12, kind: 'bill', active: true,
      categoryId: 3, paymentMethodId: 2, reliefId: 'life-insurance', autoRecord: true, startDate: '2026-10-01',
    });
    expect(c).toMatchObject({ categoryId: 3, paymentMethodId: 2, reliefId: 'life-insurance', autoRecord: true, startDate: '2026-10-01', lastAutoDue: null });
    await updateCommitment(db, { ...c, autoRecord: false, lastAutoDue: '2026-10-12' });
    expect((await listCommitments(db))[0]).toMatchObject({ autoRecord: false, lastAutoDue: '2026-10-12', reliefId: 'life-insurance' });
  });
});

describe('deleting a category used by a bill', () => {
  test('the bill moves to Lain-lain along with the spending', async () => {
    const cats = await listCategories(db);
    const hiburan = cats.find((c) => c.name === 'Hiburan')!;
    const lain = cats.find((c) => c.name === 'Lain-lain')!;
    await addCommitment(db, { name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true, categoryId: hiburan.id });
    await deleteCategory(db, hiburan.id);
    expect((await listCommitments(db))[0].categoryId).toBe(lain.id);
  });
});
