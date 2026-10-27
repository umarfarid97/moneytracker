import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getSetting, setSetting } from '@/db/repos/appSettings';
import type { Db } from '@/db/types';
import { useData } from '@/hooks/DataProvider';

/** Whether unpaid bills show as pending entries in Spending. On by default; kept in the device's settings table. */
export const SHOW_PENDING_KEY = 'showPendingBills';

let current = true;
let loadedFor: Db | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/** Shared by Settings and Spending, so flipping it in one place shows in the other straight away. */
export function useShowPending(): [boolean, (value: boolean) => void] {
  const { db } = useData();
  const value = useSyncExternalStore(subscribe, () => current);
  useEffect(() => {
    if (loadedFor === db) return;
    loadedFor = db;
    current = true;
    emit();
    getSetting(db, SHOW_PENDING_KEY)
      .then((raw) => {
        if (loadedFor !== db) return;
        current = raw !== '0';
        emit();
      })
      .catch(() => {});
  }, [db]);
  const set = useCallback((next: boolean) => {
    current = next;
    emit();
    setSetting(db, SHOW_PENDING_KEY, next ? '1' : '0').catch(() => {});
  }, [db]);
  return [value, set];
}
