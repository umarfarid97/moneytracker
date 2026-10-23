import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestDb } from '../../test-support/sqljsDb';
import { migrate } from '@/db/migrations';
import type { Db } from '@/db/types';
import { DataProvider } from '@/hooks/DataProvider';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { useProfile } from '@/hooks/useProfile';
import { useReliefClaims } from '@/hooks/useReliefClaims';

/** Wraps a Db so writes can be held (to observe optimistic state) or made to fail. */
function controllable(db: Db) {
  const control = { hold: false, fail: false, release: () => {} };
  let pending: (() => void)[] = [];
  control.release = () => {
    pending.forEach((fn) => fn());
    pending = [];
  };
  const wrapped: Db = {
    ...db,
    async run(sql, params) {
      if (control.hold) await new Promise<void>((resolve) => pending.push(resolve));
      if (control.fail) throw new Error('disk full');
      return db.run(sql, params);
    },
    transaction: (fn) => db.transaction(fn),
  };
  return { wrapped, control };
}

async function setup() {
  const raw = await createTestDb();
  await migrate(raw);
  const { wrapped, control } = controllable(raw);
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider db={wrapped}>{children}</DataProvider>;
  return { wrapper, control, db: raw };
}

const sample = { amount: 1250, categoryId: 1, date: '2026-10-24', note: 'nasi lemak', receiptUri: null };

describe('useExpenses', () => {
  test('add shows the expense immediately, then swaps in the real id', async () => {
    const { wrapper, control } = await setup();
    const { result } = await renderHook(() => useExpenses(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current.data).toEqual([]);

    control.hold = true;
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.add(sample);
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]).toMatchObject({ amount: 1250, note: 'nasi lemak' });
    expect(result.current.data[0].id).toBeLessThan(0);

    control.hold = false;
    await act(async () => {
      control.release();
      await pending;
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].id).toBeGreaterThan(0);
  });

  test('add rolls back and rejects when the write fails', async () => {
    const { wrapper, control } = await setup();
    const { result } = await renderHook(() => useExpenses(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    control.fail = true;
    await act(async () => {
      await expect(result.current.add(sample)).rejects.toThrow('disk full');
    });
    expect(result.current.data).toEqual([]);
  });

  test('update and remove are optimistic and roll back on failure', async () => {
    const { wrapper, control } = await setup();
    const { result } = await renderHook(() => useExpenses(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    await act(async () => {
      await result.current.add(sample);
    });
    const saved = result.current.data[0];

    control.fail = true;
    await act(async () => {
      await expect(result.current.update({ ...saved, amount: 9999 })).rejects.toThrow();
    });
    expect(result.current.data[0].amount).toBe(1250);
    await act(async () => {
      await expect(result.current.remove(saved.id)).rejects.toThrow();
    });
    expect(result.current.data).toHaveLength(1);

    control.fail = false;
    await act(async () => {
      await result.current.update({ ...saved, amount: 9999 });
    });
    expect(result.current.data[0].amount).toBe(9999);
    await act(async () => {
      await result.current.remove(saved.id);
    });
    expect(result.current.data).toEqual([]);
  });

  test('data is kept newest date first', async () => {
    const { wrapper } = await setup();
    const { result } = await renderHook(() => useExpenses(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    await act(async () => {
      await result.current.add({ ...sample, date: '2026-10-20' });
      await result.current.add({ ...sample, date: '2026-10-24' });
    });
    expect(result.current.data.map((e) => e.date)).toEqual(['2026-10-24', '2026-10-20']);
  });

  test('persisted expenses are loaded when the app starts', async () => {
    const { wrapper, db } = await setup();
    await db.run('INSERT INTO expenses (amount, category_id, date, note) VALUES (500, 1, ?, ?)', ['2026-10-01', 'teh']);
    const { result } = await renderHook(() => useExpenses(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useCategories', () => {
  test('removing a category moves its expenses to Lain-lain in state too', async () => {
    const { wrapper } = await setup();
    const { result } = await renderHook(() => ({ cats: useCategories(), exp: useExpenses() }), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    const hiburan = result.current.cats.data.find((c) => c.name === 'Hiburan')!;
    const lain = result.current.cats.data.find((c) => c.name === 'Lain-lain')!;
    await act(async () => {
      await result.current.exp.add({ ...sample, categoryId: hiburan.id });
    });
    await act(async () => {
      await result.current.cats.remove(hiburan.id);
    });
    expect(result.current.cats.data.some((c) => c.id === hiburan.id)).toBe(false);
    expect(result.current.exp.data[0].categoryId).toBe(lain.id);
  });
});

describe('useBudgets', () => {
  test('set overrides a category budget for the month and filters by month', async () => {
    const { wrapper } = await setup();
    const { result } = await renderHook(() => useBudgets('2026-10'), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    await act(async () => {
      await result.current.set({ categoryId: 1, month: '2026-10', limit: 60000 });
      await result.current.set({ categoryId: 1, month: '2026-10', limit: 65000 });
      await result.current.set({ categoryId: 1, month: '2026-09', limit: 1 });
    });
    expect(result.current.data).toEqual([{ categoryId: 1, month: '2026-10', limit: 65000 }]);
  });

  test('copyFromLast copies last month without overwriting limits already set', async () => {
    const { wrapper } = await setup();
    const { result } = await renderHook(() => useBudgets('2026-10'), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    await act(async () => {
      await result.current.set({ categoryId: 1, month: '2026-09', limit: 50000 });
      await result.current.set({ categoryId: 2, month: '2026-09', limit: 30000 });
      await result.current.set({ categoryId: 2, month: '2026-10', limit: 35000 });
      await result.current.copyFromLast();
    });
    const byCat = Object.fromEntries(result.current.data.map((b) => [b.categoryId, b.limit]));
    expect(byCat).toEqual({ 1: 50000, 2: 35000 });
  });

  test('copyFromLast wraps from January to December of the year before', async () => {
    const { wrapper } = await setup();
    const { result } = await renderHook(() => useBudgets('2027-01'), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    await act(async () => {
      await result.current.set({ categoryId: 1, month: '2026-12', limit: 40000 });
      await result.current.copyFromLast();
    });
    expect(result.current.data).toEqual([{ categoryId: 1, month: '2027-01', limit: 40000 }]);
  });
});

describe('useCommitments, useReliefClaims, useProfile', () => {
  test('commitments add, update and remove', async () => {
    const { wrapper } = await setup();
    const { result } = await renderHook(() => useCommitments(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    await act(async () => {
      await result.current.add({ name: 'Astro', amount: 8900, dayOfMonth: 5, kind: 'subscription', active: true });
    });
    expect(result.current.data[0]).toMatchObject({ name: 'Astro', active: true });
    await act(async () => {
      await result.current.update({ ...result.current.data[0], active: false });
    });
    expect(result.current.data[0].active).toBe(false);
    await act(async () => {
      await result.current.remove(result.current.data[0].id);
    });
    expect(result.current.data).toEqual([]);
  });

  test('relief claims are filtered by year', async () => {
    const { wrapper } = await setup();
    const { result } = await renderHook(() => useReliefClaims(2025), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    await act(async () => {
      await result.current.add({ reliefId: 'lifestyle', year: 2025, amount: 10000, receiptUri: null, note: '' });
      await result.current.add({ reliefId: 'lifestyle', year: 2024, amount: 5000, receiptUri: null, note: '' });
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].year).toBe(2025);
  });

  test('profile saves optimistically', async () => {
    const { wrapper } = await setup();
    const { result } = await renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    await act(async () => {
      await result.current.save({ ...result.current.data, grossMonthly: 500000 });
    });
    expect(result.current.data.grossMonthly).toBe(500000);
  });
});
