import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode, type SetStateAction,
} from 'react';
import { openDb } from '@/db/client';
import {
  addCategory, deleteCategory, listCategories, renameCategory,
} from '@/db/repos/categories';
import { deleteBudget, listAllBudgets, setBudget } from '@/db/repos/budgets';
import {
  addCommitment, deleteCommitment, listCommitments, updateCommitment,
} from '@/db/repos/commitments';
import {
  addExpense, deleteExpense, listAllExpenses, updateExpense,
} from '@/db/repos/expenses';
import { getProfile, saveProfile } from '@/db/repos/profile';
import {
  addReliefClaim, deleteReliefClaim, listAllReliefClaims, updateReliefClaim,
} from '@/db/repos/reliefClaims';
import type { Db } from '@/db/types';
import type {
  Budget, Category, Commitment, Expense, Profile, ReliefClaim,
} from '@/domain/types';
import { makeOptimisticOps, type CollectionOps } from './optimistic';

/** Newest date first; within a day, unsaved (negative id) items first, then newest id first. */
const byNewest = (a: Expense, b: Expense) => {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if ((a.id < 0) !== (b.id < 0)) return a.id < 0 ? -1 : 1;
  return b.id - a.id;
};
const byOrder = (a: Category, b: Category) => a.sortOrder - b.sortOrder || a.id - b.id;
const byDay = (a: Commitment, b: Commitment) => a.dayOfMonth - b.dayOfMonth || a.id - b.id;
const byId = (a: { id: number }, b: { id: number }) => a.id - b.id;

/**
 * useState whose latest value is also readable synchronously through a ref, so several writes in
 * one tick (and rollbacks) always start from the newest state instead of a stale render.
 */
function useSyncedState<T>(initial: T) {
  const [state, setState] = useState(initial);
  const ref = useRef(initial);
  const set = useCallback((update: SetStateAction<T>) => {
    const next = typeof update === 'function' ? (update as (prev: T) => T)(ref.current) : update;
    ref.current = next;
    setState(next);
  }, []);
  return [state, set, ref] as const;
}

export type DataContextValue = {
  db: Db;
  categories: Category[];
  categoryOps: {
    add: (input: Omit<Category, 'id' | 'sortOrder'>) => Promise<Category>;
    rename: (id: number, name: string) => Promise<void>;
    remove: (id: number) => Promise<void>;
  };
  expenses: Expense[];
  expenseOps: CollectionOps<Expense, Omit<Expense, 'id'>>;
  budgets: Budget[];
  /** Latest budgets, readable inside async callbacks without a stale closure. */
  getBudgets: () => Budget[];
  setBudget: (b: Budget) => Promise<void>;
  removeBudget: (categoryId: number, month: string) => Promise<void>;
  commitments: Commitment[];
  commitmentOps: CollectionOps<Commitment, Omit<Commitment, 'id'>>;
  reliefClaims: ReliefClaim[];
  reliefClaimOps: CollectionOps<ReliefClaim, Omit<ReliefClaim, 'id'>>;
  profile: Profile;
  saveProfile: (p: Profile) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside <DataProvider>');
  return value;
}

type Loaded = {
  categories: Category[]; expenses: Expense[]; budgets: Budget[];
  commitments: Commitment[]; reliefClaims: ReliefClaim[]; profile: Profile;
};

async function loadAll(db: Db): Promise<Loaded> {
  const [categories, expenses, budgets, commitments, reliefClaims, profile] = await Promise.all([
    listCategories(db), listAllExpenses(db), listAllBudgets(db),
    listCommitments(db), listAllReliefClaims(db), getProfile(db),
  ]);
  return { categories, expenses, budgets, commitments, reliefClaims, profile };
}

/**
 * Opens the database (or uses the one passed in tests), loads everything once and holds it in memory.
 * Children render only after the first load, so screens never see an empty "loading" state.
 * Local data is small (a few thousand rows over years); revisit paging if that stops being true.
 */
export function DataProvider({ db: injected, children }: { db?: Db; children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(injected ?? null);
  const [failure, setFailure] = useState<Error | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [categories, setCategories] = useSyncedState<Category[]>([]);
  const [expenses, setExpenses, expensesRef] = useSyncedState<Expense[]>([]);
  const [budgets, setBudgets, budgetsRef] = useSyncedState<Budget[]>([]);
  const [commitments, setCommitments, commitmentsRef] = useSyncedState<Commitment[]>([]);
  const [reliefClaims, setReliefClaims, claimsRef] = useSyncedState<ReliefClaim[]>([]);
  const [profile, setProfile, profileRef] = useSyncedState<Profile | null>(null);

  const apply = useCallback((data: Loaded) => {
    setCategories(data.categories); setExpenses(data.expenses); setBudgets(data.budgets);
    setCommitments(data.commitments); setReliefClaims(data.reliefClaims); setProfile(data.profile);
  }, [setCategories, setExpenses, setBudgets, setCommitments, setReliefClaims, setProfile]);

  useEffect(() => {
    if (injected) { setDb(injected); return; }
    let alive = true;
    openDb().then((d) => alive && setDb(d)).catch((e: Error) => alive && setFailure(e));
    return () => { alive = false; };
  }, [injected]);

  useEffect(() => {
    if (!db) return;
    let alive = true;
    loadAll(db)
      .then((data) => { if (alive) { apply(data); setLoaded(true); } })
      .catch((e: Error) => alive && setFailure(e));
    return () => { alive = false; };
  }, [db, apply]);

  const value = useMemo<DataContextValue | null>(() => {
    if (!db || !loaded || !profile) return null;

    const expenseOps = makeOptimisticOps(expensesRef, setExpenses, {
      add: (input) => addExpense(db, input),
      update: (e) => updateExpense(db, e),
      remove: (id) => deleteExpense(db, id),
    }, byNewest);
    const commitmentOps = makeOptimisticOps(commitmentsRef, setCommitments, {
      add: (input) => addCommitment(db, input),
      update: (c) => updateCommitment(db, c),
      remove: (id) => deleteCommitment(db, id),
    }, byDay);
    const reliefClaimOps = makeOptimisticOps(claimsRef, setReliefClaims, {
      add: (input) => addReliefClaim(db, input),
      update: (c) => updateReliefClaim(db, c),
      remove: (id) => deleteReliefClaim(db, id),
    }, byId);

    return {
      db, categories, expenses, budgets, commitments, reliefClaims, profile,
      expenseOps, commitmentOps, reliefClaimOps,
      getBudgets: () => budgetsRef.current,
      categoryOps: {
        async add(input) {
          const saved = await addCategory(db, input);
          setCategories((prev) => [...prev, saved].sort(byOrder));
          return saved;
        },
        async rename(id, name) {
          await renameCategory(db, id, name);
          setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
        },
        async remove(id) {
          await deleteCategory(db, id);
          apply(await loadAll(db));
        },
      },
      async setBudget(b) {
        const before = budgetsRef.current;
        setBudgets((prev) => [
          ...prev.filter((x) => !(x.categoryId === b.categoryId && x.month === b.month)), b,
        ]);
        try {
          await setBudget(db, b);
        } catch (e) {
          setBudgets(before);
          throw e;
        }
      },
      async removeBudget(categoryId, month) {
        const before = budgetsRef.current;
        setBudgets((prev) => prev.filter((x) => !(x.categoryId === categoryId && x.month === month)));
        try {
          await deleteBudget(db, categoryId, month);
        } catch (e) {
          setBudgets(before);
          throw e;
        }
      },
      async saveProfile(p) {
        const before = profileRef.current;
        setProfile(p);
        try {
          await saveProfile(db, p);
        } catch (e) {
          setProfile(before);
          throw e;
        }
      },
    };
  }, [db, loaded, profile, categories, expenses, budgets, commitments, reliefClaims, apply]);

  if (failure) throw failure;
  if (!value) return null;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
