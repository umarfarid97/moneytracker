import { useSyncExternalStore } from 'react';

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => version;

/** A receipt can arrive after its expense was already rendered from the snapshot. */
export function receiptFilesChanged(): void {
  version++;
  listeners.forEach(listener => listener());
}

export const useReceiptVersion = (): number => useSyncExternalStore(subscribe, snapshot, snapshot);
