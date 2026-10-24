import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestDb } from '../../test-support/sqljsDb';
import { migrate } from '@/db/migrations';
import type { Db } from '@/db/types';
import { DataProvider, useData } from '@/hooks/DataProvider';
import { useAllReliefClaims } from '@/hooks/useAllReliefClaims';
import { useCategories } from '@/hooks/useCategories';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

async function setup() {
  const db = await createTestDb();
  await migrate(db);
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider db={db}>{children}</DataProvider>;
  return { db, wrapper };
}
const ready = (result: { current: unknown }) => waitFor(() => expect(result.current).not.toBeNull());
const base = { amount: 10000, categoryId: 1, date: '2026-10-10', note: 'x', receiptUri: null };

describe('usePaymentMethods', () => {
  test('lists the defaults, and add / rename / remove keep spending on Cash', async () => {
    const { wrapper } = await setup();
    const { result } = await renderHook(() => ({ pm: usePaymentMethods(), ex: useExpenses() }), { wrapper });
    await ready(result);
    expect(result.current.pm.data.map((m) => m.name)).toEqual(['Cash', 'Debit card', 'Credit card', 'E-wallet', 'Online transfer']);
    let visaId = 0;
    await act(async () => {
      visaId = (await result.current.pm.add({ name: 'Maybank Visa', kind: 'credit' })).id;
    });
    await act(async () => {
      await result.current.ex.add({ ...base, paymentMethodId: visaId });
    });
    await act(async () => {
      await result.current.pm.rename(visaId, 'CIMB Visa');
    });
    expect(result.current.pm.data.find((m) => m.id === visaId)?.name).toBe('CIMB Visa');
    await act(async () => {
      await result.current.pm.remove(visaId);
    });
    expect(result.current.pm.data.some((m) => m.id === visaId)).toBe(false);
    expect(result.current.ex.data[0].paymentMethodId).toBe(result.current.pm.data[0].id);
  });
});

describe('useAllReliefClaims', () => {
  test('combines manual claims with relief-tagged spending for one year, counting each once', async () => {
    const { wrapper, db } = await setup();
    await db.run("INSERT INTO relief_claims (relief_id, year, amount, receipt_uri, note) VALUES ('lifestyle', 2026, 50000, NULL, 'Book')");
    const { result } = await renderHook(() => ({ claims: useAllReliefClaims(2026), ex: useExpenses() }), { wrapper });
    await ready(result);
    expect(result.current.claims.data).toHaveLength(1);
    await act(async () => {
      await result.current.ex.add({ ...base, reliefId: 'lifestyle', reliefAmount: 4000 });
      await result.current.ex.add({ ...base, reliefId: 'lifestyle', date: '2025-12-31' });
      await result.current.ex.add({ ...base });
    });
    const amounts = result.current.claims.data.map((c) => c.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([4000, 50000]);
    expect(result.current.claims.fromSpending.map((c) => c.amount)).toEqual([4000]);
    await act(async () => {
      const tagged = result.current.ex.data.find((e) => e.reliefId === 'lifestyle' && e.date === '2026-10-10')!;
      await result.current.ex.update({ ...tagged, reliefId: null, reliefAmount: null });
    });
    expect(result.current.claims.data.map((c) => c.amount)).toEqual([50000]);
  });
});

describe('payBill', () => {
  async function withBill(over: Record<string, unknown> = {}) {
    const ctx = await setup();
    const { result } = await renderHook(() => ({ data: useData(), bills: useCommitments(), ex: useExpenses(), cats: useCategories() }), { wrapper: ctx.wrapper });
    await ready(result);
    let bill!: Awaited<ReturnType<typeof result.current.bills.add>>;
    await act(async () => {
      bill = await result.current.bills.add({
        name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true,
        paymentMethodId: 3, reliefId: 'life-insurance', startDate: '2026-08-05', ...over,
      });
    });
    return { ...ctx, result, bill };
  }

  test('records the spending with the bill defaults, once per due date', async () => {
    const { result, bill } = await withBill();
    let first: unknown;
    let second: unknown;
    await act(async () => {
      first = await result.current.data.payBill(bill, '2026-10-05', { amount: 9500, date: '2026-10-07' });
      second = await result.current.data.payBill(bill, '2026-10-05', { amount: 9500, date: '2026-10-07' });
    });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const rows = result.current.ex.data.filter((e) => e.commitmentId === bill.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount: 9500, date: '2026-10-07', dueDate: '2026-10-05', note: 'Astro', paymentMethodId: 3,
      reliefId: 'life-insurance', categoryId: result.current.cats.data.find((c) => c.name === 'Bil')!.id,
    });
  });

  test('uses the bill category when it has one', async () => {
    const { result, bill } = await withBill({ categoryId: 5 });
    await act(async () => {
      await result.current.data.payBill(bill, '2026-10-05', { amount: 8900, date: '2026-10-05' });
    });
    expect(result.current.ex.data[0].categoryId).toBe(5);
  });
});

describe('runAutoRecord', () => {
  test('records every missed due date once, remembers it, and never brings back a deleted one', async () => {
    const ctx = await setup();
    const { result } = await renderHook(() => ({ data: useData(), bills: useCommitments(), ex: useExpenses() }), { wrapper: ctx.wrapper });
    await ready(result);
    await act(async () => {
      await result.current.bills.add({ name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true, autoRecord: true, startDate: '2026-08-05' });
      await result.current.bills.add({ name: 'Manual', amount: 100, dayOfMonth: 5, kind: 'bill', active: true, autoRecord: false, startDate: '2026-08-05' });
      await result.current.bills.add({ name: 'Paused', amount: 100, dayOfMonth: 5, kind: 'bill', active: false, autoRecord: true, startDate: '2026-08-05' });
    });
    let count = 0;
    await act(async () => {
      count = await result.current.data.runAutoRecord('2026-10-24');
    });
    expect(count).toBe(3);
    const astro = result.current.ex.data.filter((e) => e.note === 'Astro');
    expect(astro.map((e) => e.date).sort()).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
    expect(astro.every((e) => e.amount === 8900)).toBe(true);
    expect(result.current.ex.data.filter((e) => e.note !== 'Astro')).toHaveLength(0);

    await act(async () => {
      count = await result.current.data.runAutoRecord('2026-10-24');
    });
    expect(count).toBe(0);

    await act(async () => {
      await result.current.ex.remove(astro.find((e) => e.dueDate === '2026-10-05')!.id);
      count = await result.current.data.runAutoRecord('2026-10-24');
    });
    expect(count).toBe(0);
    expect(result.current.ex.data.filter((e) => e.note === 'Astro')).toHaveLength(2);
    expect(result.current.bills.data.find((b) => b.name === 'Astro')!.lastAutoDue).toBe('2026-10-05');
  });

  test('a due date that was already marked paid is not recorded again', async () => {
    const ctx = await setup();
    const { result } = await renderHook(() => ({ data: useData(), bills: useCommitments(), ex: useExpenses() }), { wrapper: ctx.wrapper });
    await ready(result);
    let bill!: Awaited<ReturnType<typeof result.current.bills.add>>;
    await act(async () => {
      bill = await result.current.bills.add({ name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true, autoRecord: true, startDate: '2026-10-01' });
      await result.current.data.payBill(bill, '2026-10-05', { amount: 9100, date: '2026-10-06' });
    });
    let count = 0;
    await act(async () => {
      count = await result.current.data.runAutoRecord('2026-10-24');
    });
    expect(count).toBe(0);
    expect(result.current.ex.data.filter((e) => e.commitmentId === bill.id)).toHaveLength(1);
  });
});

export type { Db };

describe('runAutoRecord under concurrency (review findings)', () => {
  async function auto() {
    const ctx = await setup();
    const { result } = await renderHook(() => ({ data: useData(), bills: useCommitments(), ex: useExpenses() }), { wrapper: ctx.wrapper });
    await ready(result);
    await act(async () => {
      await result.current.bills.add({ name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true, autoRecord: true, startDate: '2026-08-05' });
    });
    return result;
  }

  test('two runs started together record each due date once and report it once', async () => {
    const result = await auto();
    let counts: number[] = [];
    await act(async () => {
      counts = await Promise.all([result.current.data.runAutoRecord('2026-10-24'), result.current.data.runAutoRecord('2026-10-24')]);
    });
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
    expect(result.current.ex.data.filter((e) => e.note === 'Astro')).toHaveLength(3);
  });

  test('an edit saved while a run is in progress is not overwritten', async () => {
    const result = await auto();
    await act(async () => {
      const bill = result.current.bills.data[0];
      await Promise.all([result.current.data.runAutoRecord('2026-10-24'), result.current.bills.update({ ...bill, name: 'Astro Go', amount: 9900 })]);
    });
    expect(result.current.bills.data[0]).toMatchObject({ name: 'Astro Go', amount: 9900, lastAutoDue: '2026-10-05' });
  });
});
