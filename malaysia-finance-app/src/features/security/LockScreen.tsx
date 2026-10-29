import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/i18n/t';
import { biometricAvailable, authenticateToUnlock, authenticateWithPin, useAppLock } from '@/security/appLock';
import { AppText } from '@/ui/AppText';
import { useTheme } from '@/ui/useTheme';
import { PinPad } from './PinPad';

/**
 * Covers the whole app. With `interactive` off it is only a privacy cover (shown while the app is in the
 * app switcher); with it on it asks for the PIN, and offers fingerprint / Face ID when that is switched on.
 */
export function LockScreen({ interactive }: { interactive: boolean }) {
  const { c } = useTheme();
  const { biometric, pinLength } = useAppLock();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [canBiometric, setCanBiometric] = useState(false);
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);

  const tryBiometric = useCallback(async () => {
    if (!(await authenticateToUnlock())) setMessage('Unable to unlock with biometrics. Retry storage or use your PIN.');
  }, []);

  useEffect(() => {
    if (!interactive || !biometric) return;
    let alive = true;
    biometricAvailable().then((ok) => {
      if (!alive) return;
      setCanBiometric(ok);
      // Ask straight away, once per time the lock screen appears.
      if (ok && !asked.current) {
        asked.current = true;
        tryBiometric();
      }
    });
    return () => {
      alive = false;
    };
  }, [interactive, biometric, tryBiometric]);

  useEffect(() => {
    if (!interactive) asked.current = false;
  }, [interactive]);

  async function onChange(next: string) {
    setPin(next);
    if (next.length < pinLength) return;
    setBusy(true);
    const result = await authenticateWithPin(next);
    setBusy(false);
    if (result.ok) {
      setPin('');
      setMessage(null);
      return;
    }
    setPin('');
    setMessage(result.storageError ? 'Lock storage is unavailable. Retry your PIN when storage works. If configured, use biometrics. An OS app reset and restoring a backup is a last resort and may lose unsynced data.' : result.waitSeconds > 0 ? t('lock.wait', { seconds: result.waitSeconds }) : t('lock.wrong'));
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.ground, zIndex: 1000 }]} testID="lock-screen">
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, padding: 24 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <AppText variant="title" tone="accent">
            Duit
          </AppText>
          {interactive ? (
            <AppText variant="body" tone="muted">
              {t('lock.enter')}
            </AppText>
          ) : null}
        </View>
        {interactive ? (
          <>
            <PinPad
              value={pin}
              length={pinLength}
              onChange={onChange}
              disabled={busy}
              extraKey={
                biometric && canBiometric
                  ? { icon: 'finger-print', label: t('lock.useBiometric'), onPress: tryBiometric }
                  : undefined
              }
            />
            <AppText variant="small" tone="negative" accessibilityLiveRegion="polite" style={{ minHeight: 20 }}>
              {message ?? ' '}
            </AppText>
          </>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
