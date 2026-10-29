import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let reduced = true;
let revision = 0;
let subscription: { remove: () => void } | undefined;
const listeners = new Set<() => void>();
const snapshot = () => reduced;
const serverSnapshot = () => true;
function publish(value: boolean) {
  reduced = value;
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const queryRevision = ++revision;
    try {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
        revision++;
        publish(value);
      });
      void AccessibilityInfo.isReduceMotionEnabled().then(value => {
        if (queryRevision === revision && listeners.size && typeof value === 'boolean') publish(value);
      }).catch(() => { /* Unknown preference stays conservative. */ });
    } catch { /* Accessibility APIs may be unavailable during startup. */ }
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      revision++;
      subscription?.remove();
      subscription = undefined;
      reduced = true;
    }
  };
}

/** True means reduce nonessential motion. A single OS listener serves the whole app. */
export const useMotion = (): boolean => useSyncExternalStore(subscribe, snapshot, serverSnapshot);
