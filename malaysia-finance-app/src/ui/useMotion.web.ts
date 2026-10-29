import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';
let media: MediaQueryList | undefined;
let subscribers = 0;
function preference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  return media ??= window.matchMedia(query);
}
const snapshot = () => preference()?.matches ?? true;
const serverSnapshot = () => true;
function subscribe(listener: () => void) {
  const current = preference();
  if (!current) return () => {};
  subscribers++;
  if (current.addEventListener) current.addEventListener('change', listener);
  else current.addListener(listener);
  return () => {
    if (current.removeEventListener) current.removeEventListener('change', listener);
    else current.removeListener(listener);
    if (--subscribers === 0) media = undefined;
  };
}

/** Live browser preference; safe during static export and hydration. */
export const useMotion = (): boolean => useSyncExternalStore(subscribe, snapshot, serverSnapshot);
