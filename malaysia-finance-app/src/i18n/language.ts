/**
 * Which language the app speaks. English is the default; Bahasa Malaysia is chosen from More > Language.
 * To add a string for a new screen, add the key to en.ts and ms.ts (the compiler insists on both).
 */
import { useSyncExternalStore } from 'react';
import { loadLanguage, saveLanguage } from '@/ui/appearanceStorage';

export type Language = 'en' | 'ms';
export const LANGUAGES: readonly Language[] = ['en', 'ms'];
/** Each language is named in itself so it can always be found. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', ms: 'Bahasa Malaysia' };

const isLanguage = (v: unknown): v is Language => v === 'en' || v === 'ms';

let current: Language | undefined;
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  if (current === undefined) {
    const saved = loadLanguage();
    current = isLanguage(saved) ? saved : 'en';
  }
  return current;
}

export function setLanguage(next: Language): void {
  current = next;
  saveLanguage(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}
