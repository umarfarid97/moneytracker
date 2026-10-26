import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode, type SetStateAction,
} from 'react';
import { openDb } from '@/db/client';
import {
  addCategory, deleteCategory, listCategories, renameCategory, setCategoryIcon,
} from '@/db/repos/categories';
import { deleteBudget, listAllBudgets, setBudget } from '@/db/repos/budgets';
import {
  addCommitment, deleteCommitment, listCommitments, updateCommitment,
} from '@/db/repos/commitments';
import {
  addBillExpense, addExpense, deleteExpense, listAllExpenses, updateExpense,
} from '@/db/repos/expenses';
import {
  addPaymentMethod, deletePaymentMethod, listPaymentMethods, renamePaymentMethod,
} from '@/db/repos/paymentMethods';
import { getProfile, saveProfile } from '@/db/repos/profile';
import {
  addReliefClaim, deleteReliefClaim, listAllReliefClaims, updateReliefClaim,
} from '@/db/repos/reliefClaims';
import { addGivingRecord, deleteGivingRecord, listGivingRecords, updateGivingRecord } from '@/db/repos/giving';
import {
  addRetirementEntry, deleteRetirementEntry, listRetirementEntries, updateRetirementEntry,
} from '@/db/repos/retirement';
import {
  addSavingsAccount, deleteSavingsAccount, listSavingsAccounts, updateSavingsAccount,
} from '@/db/repos/savings';
import type { Db } from '@/db/types';
import { missedDueDates } from '@/domain/bills';
import { byDateDesc as givingNewest, type GivingRecord, type NewGivingRecord } from '@/domain/giving';
import type { Sen } from '@/domain/money';
import { byDateDesc as entryNewest, type NewRetirementEntry, type RetirementEntry } from '@/domain/retirement';
import type { NewSavingsAccount, SavingsAccount } from '@/domain/savings';
import {
  withCommitmentDefaults, withExpenseDefaults,
  type PaymentKind, type PaymentMethod,
  type Budget, type Category, type Commitment, type Expense, type NewCommitment, type NewExpense,
  type Profile, type ReliefClaim,
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
    setIcon: (id: number, icon: string) => Promise<void>;
    remove: (id: number) => Promise<void>;
  };
  paymentMethods: PaymentMethod[];
  paymentMethodOps: {
    add: (input: { name: string; kind: PaymentKind }) => Promise<PaymentMethod>;
    rename: (id: number, name: string) => Promise<void>;
    remove: (id: number) => Promise<void>;
  };
  expenses: Expense[];
  expenseOps: CollectionOps<Expense, NewExpense>;
  /**
   * Records the spending for one due date of a bill, using the bill's category, payment method and relief.
   * Returns null (and records nothing) if that due date already has its spending.
   */
  payBill: (c: Commitment, dueDate: string, opts: { amount: Sen; date: string }) => Promise<Expense | null>;
  /** Records the spending for every due date up to today of bills set to record automatically; returns how many. */
  runAutoRecord: (today: string) => Promise<number>;
  budgets: Budget[];
  /** Latest budgets, readable inside async callbacks without a stale closure. */
  getBudgets: () => Budget[];
  setBudget: (b: Budget) => Promise<void>;
  removeBudget: (categoryId: number, month: string) => Promise<void>;
  commitments: Commitment[];
  commitmentOps: CollectionOps<Commitment, NewCommitment>;
  reliefClaims: ReliefClaim[];
  reliefClaimOps: CollectionOps<ReliefClaim, Omit<ReliefClaim, 'id'>>;
  /** EPF, SOCSO and EIS records (see domain/retirement). */
  retirementEntries: RetirementEntry[];
  retirementOps: CollectionOps<RetirementEntry, NewRetirementEntry>;
  /** Zakat and sedekah given (see domain/giving). */
  givingRecords: GivingRecord[];
  givingOps: CollectionOps<GivingRecord, NewGivingRecord>;
  /** Tabung Haji, ASB, Hajj fund, PRS and unit trusts (see domain/savings). */
  savingsAccounts: SavingsAccount[];
  savingsOps: CollectionOps<SavingsAccount, NewSavingsAccount>;
  profile: Profile;
  saveProfile: (p: Profile) => Promise<void>;
  /** Year of assessment picked on the tax screens (null = the current year). */
  taxYearChoice: number | null;
  setTaxYearChoice: (year: number | null) => void;
  /** Reads everything from the database again, after a sync or a restore changed it underneath. */
  reload: () => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside <DataProvider>');
  return value;
}

type Loaded = {
  categories: Category[]; expenses: Expense[]; budgets: Budget[];
  commitments: Commitment[]; reliefClaims: ReliefClaim[]; profile: Profile; paymentMethods: PaymentMethod[];
  retirementEntries: RetirementEntry[]; givingRecords: GivingRecord[]; savingsAccounts: SavingsAccount[];
};

async function loadAll(db: Db): Promise<Loaded> {
  const [
    categories, expenses, budgets, commitments, reliefClaims, profile, paymentMethods,
    retirementEntries, givingRecords, savingsAccounts,
  ] = await Promise.all([
    listCategories(db), listAllExpenses(db), listAllBudgets(db),
    listCommitments(db), listAllReliefClaims(db), getProfile(db), listPaymentMethods(db),
    listRetirementEntries(db), listGivingRecords(db), listSavingsAccounts(db),
  ]);
  return {
    categories, expenses, budgets, commitments, reliefClaims, profile, paymentMethods,
    retirementEntries, givingRecords, savingsAccounts,
  };
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
  const [taxYearChoice, setTaxYearChoice] = useState<number | null>(null);

  const [categories, setCategories] = useSyncedState<Category[]>([]);
  const [expenses, setExpenses, expensesRef] = useSyncedState<Expense[]>([]);
  const [budgets, setBudgets, budgetsRef] = useSyncedState<Budget[]>([]);
  const [commitments, setCommitments, commitmentsRef] = useSyncedState<Commitment[]>([]);
  const [reliefClaims, setReliefClaims, claimsRef] = useSyncedState<ReliefClaim[]>([]);
  const [profile, setProfile, profileRef] = useSyncedState<Profile | null>(null);
  const [paymentMethods, setPaymentMethods] = useSyncedState<PaymentMethod[]>([]);
  const [retirementEntries, setRetirementEntries, retirementRef] = useSyncedState<RetirementEntry[]>([]);
  const [givingRecords, setGivingRecords, givingRef] = useSyncedState<GivingRecord[]>([]);
  const [savingsAccounts, setSavingsAccounts, savingsRef] = useSyncedState<SavingsAccount[]>([]);

  const apply = useCallback((data: Loaded) => {
    setCategories(data.categories); setExpenses(data.expenses); setBudgets(data.budgets);
    setCommitments(data.commitments); setReliefClaims(data.reliefClaims); setProfile(data.profile);
    setPaymentMethods(data.paymentMethods);
    setRetirementEntries(data.retirementEntries); setGivingRecords(data.givingRecords);
    setSavingsAccounts(data.savingsAccounts);
  }, [
    setCategories, setExpenses, setBudgets, setCommitments, setReliefClaims, setProfile, setPaymentMethods,
    setRetirementEntries, setGivingRecords, setSavingsAccounts,
  ]);

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
    }, byNewest, withExpenseDefaults);
    const commitmentOps = makeOptimisticOps(commitmentsRef, setCommitments, {
      add: (input) => addCommitment(db, input),
      update: (c) => updateCommitment(db, c),
      remove: (id) => deleteCommitment(db, id),
    }, byDay, withCommitmentDefaults);
    const reliefClaimOps = makeOptimisticOps(claimsRef, setReliefClaims, {
      add: (input) => addReliefClaim(db, input),
      update: (c) => updateReliefClaim(db, c),
      remove: (id) => deleteReliefClaim(db, id),
    }, byId, (input: Omit<ReliefClaim, 'id'>) => input);

    const retirementOps = makeOptimisticOps(retirementRef, setRetirementEntries, {
      add: (input) => addRetirementEntry(db, input),
      update: (e) => updateRetirementEntry(db, e),
      remove: (id) => deleteRetirementEntry(db, id),
    }, entryNewest, (input: NewRetirementEntry) => input);
    const givingOps = makeOptimisticOps(givingRef, setGivingRecords, {
      add: (input) => addGivingRecord(db, input),
      update: (g) => updateGivingRecord(db, g),
      remove: (id) => deleteGivingRecord(db, id),
    }, givingNewest, (input: NewGivingRecord) => input);
    const savingsOps = makeOptimisticOps(savingsRef, setSavingsAccounts, {
      add: (input) => addSavingsAccount(db, input),
      update: (a) => updateSavingsAccount(db, a),
      remove: (id) => deleteSavingsAccount(db, id),
    }, (a, b) => a.id - b.id, (input: NewSavingsAccount) => input);

    const billCategoryId = (c: Commitment) =>
      c.categoryId ??
      categories.find((x) => x.name === 'Bil')?.id ??
      categories.find((x) => x.name === 'Lain-lain')?.id ??
      categories[0]?.id ??
      1;

    const payBill: DataContextValue['payBill'] = async (c, dueDate, opts) => {
      const saved = await addBillExpense(db, {
        amount: opts.amount, categoryId: billCategoryId(c), date: opts.date, note: c.name, receiptUri: null,
        paymentMethodId: c.paymentMethodId, reliefId: c.reliefId, reliefAmount: null, commitmentId: c.id, dueDate,
      });
      if (saved) setExpenses((prev) => [saved, ...prev].sort(byNewest));
      return saved;
    };

    const runAutoRecord: DataContextValue['runAutoRecord'] = async (today) => {
      let count = 0;
      for (const c of commitmentsRef.current) {
        // A variable bill's amount is only known when it is paid, so it is never recorded automatically.
        if (!c.active || !c.autoRecord || c.variable) continue;
        const dates = missedDueDates(c, today);
        if (dates.length === 0) continue;
        for (const due of dates) {
          if (await payBill(c, due, { amount: c.amount, date: due })) count++;
        }
        // Re-read the bill: it may have been edited (or deleted) while the payments above were saved.
        const latest = commitmentsRef.current.find((x) => x.id === c.id);
        if (latest) await commitmentOps.update({ ...latest, lastAutoDue: dates[dates.length - 1] });
      }
      return count;
    };

    return {
      db, categories, expenses, budgets, commitments, reliefClaims, profile, taxYearChoice, setTaxYearChoice,
      paymentMethods, payBill, runAutoRecord,
      async reload() {
        apply(await loadAll(db));
      },
      expenseOps, commitmentOps, reliefClaimOps,
      retirementEntries, retirementOps, givingRecords, givingOps, savingsAccounts, savingsOps,
      paymentMethodOps: {
        async add(input) {
          const saved = await addPaymentMethod(db, input);
          setPaymentMethods((prev) => [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id));
          return saved;
        },
        async rename(id, name) {
          await renamePaymentMethod(db, id, name);
          setPaymentMethods((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
        },
        async remove(id) {
          await deletePaymentMethod(db, id);
          apply(await loadAll(db));
        },
      },
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
        async setIcon(id, icon) {
          await setCategoryIcon(db, id, icon);
          setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, icon } : c)));
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
  }, [db, loaded, profile, categories, expenses, budgets, commitments, reliefClaims, paymentMethods,
    retirementEntries, givingRecords, savingsAccounts, taxYearChoice, apply]);

  if (failure) throw failure;
  if (!value) return null;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
