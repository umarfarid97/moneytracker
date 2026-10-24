/**
 * Which colour scheme the app uses. It opens in the light design by default, whatever the device
 * is set to; "system" follows the device and "dark" forces dark. Changed from More > Appearance.
 */
import { useSyncExternalStore } from 'react';
import { loadAppearance, saveAppearance } from './appearanceStorage';

export type Appearance = 'system' | 'light' | 'dark';
export const APPEARANCES: readonly Appearance[] = ['light', 'dark', 'system'];

const isAppearance = (v: unknown): v is Appearance => v === 'system' || v === 'light' || v === 'dark';

let current: Appearance | undefined;
const listeners = new Set<() => void>();

export function getAppearance(): Appearance {
  if (current === undefined) {
    const saved = loadAppearance();
    current = isAppearance(saved) ? saved : 'light';
  }
  return current;
}

export function setAppearance(next: Appearance): void {
  current = next;
  saveAppearance(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, getAppearance, getAppearance);
}
