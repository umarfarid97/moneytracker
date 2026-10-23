import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export type CollectionOps<T extends { id: number }, In> = {
  add: (input: In) => Promise<T>;
  update: (item: T) => Promise<void>;
  remove: (id: number) => Promise<void>;
};

type Persist<T extends { id: number }, In> = {
  add: (input: In) => Promise<T>;
  update: (item: T) => Promise<void>;
  remove: (id: number) => Promise<void>;
};

let tempId = 0;

/**
 * Builds add/update/remove that change React state first and the database second.
 * A failed write puts state back as it was and rethrows, so the UI never shows data that was not saved.
 * New items carry a negative temporary id until the database returns the real one.
 */
export function makeOptimisticOps<T extends { id: number }, In extends Omit<T, 'id'>>(
  itemsRef: MutableRefObject<T[]>,
  setItems: Dispatch<SetStateAction<T[]>>,
  persist: Persist<T, In>,
  compare: (a: T, b: T) => number,
): CollectionOps<T, In> {
  const sorted = (list: T[]) => [...list].sort(compare);

  return {
    async add(input) {
      const temp = { ...input, id: --tempId } as unknown as T;
      setItems((prev) => sorted([temp, ...prev]));
      try {
        const saved = await persist.add(input);
        setItems((prev) => sorted(prev.map((i) => (i.id === temp.id ? saved : i))));
        return saved;
      } catch (e) {
        setItems((prev) => prev.filter((i) => i.id !== temp.id));
        throw e;
      }
    },

    async update(item) {
      const before = itemsRef.current.find((i) => i.id === item.id);
      setItems((prev) => sorted(prev.map((i) => (i.id === item.id ? item : i))));
      try {
        await persist.update(item);
      } catch (e) {
        if (before) setItems((prev) => sorted(prev.map((i) => (i.id === item.id ? before : i))));
        throw e;
      }
    },

    async remove(id) {
      const removed = itemsRef.current.find((i) => i.id === id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      try {
        await persist.remove(id);
      } catch (e) {
        if (removed) setItems((prev) => sorted([...prev, removed]));
        throw e;
      }
    },
  };
}
