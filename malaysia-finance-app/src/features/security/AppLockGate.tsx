import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, View, type AppStateStatus } from 'react-native';
import { noteBackground, noteForeground, useAppLock } from '@/security/appLock';
import { LockScreen } from './LockScreen';

/**
 * Wraps the app. Asks for the PIN on a cold start and after the app has been in the background for the chosen
 * time, and hides the app from the app switcher while the lock is on.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { enabled, locked } = useAppLock();
  const [appState, setAppState] = useState<AppStateStatus>((AppState.currentState ?? 'active') as AppStateStatus);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setAppState(next);
      if (next === 'background') noteBackground();
      else if (next === 'active') noteForeground();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => { if (enabled && locked) closeModals(); }, [enabled, locked]);

  // A native iOS modal (Add spending) sits above this gate, so close any open one when the lock engages.
  const covered = enabled && (locked || appState === 'inactive' || appState === 'background');
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={locked}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
        pointerEvents={locked ? 'none' : 'auto'}
      >
        {children}
      </View>
      {covered ? <LockScreen interactive={locked} /> : null}
    </View>
  );
}

function closeModals(): void {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    // Not inside a navigator yet: nothing to close.
  }
}
