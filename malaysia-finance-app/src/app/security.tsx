import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { PinPad } from '@/features/security/PinPad';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import {
  TIMEOUTS, biometricAvailable, changePin, disableLock, enableLock, promptBiometric, setBiometric, setLockTimeout,
  useAppLock, verifyPin,
} from '@/security/appLock';
import { PIN_LENGTHS, isWeakPin, type PinLength } from '@/security/pin';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';
import { Toggle } from '@/ui/Toggle';

type Step = 'create' | 'confirm' | 'turnOff' | 'current' | 'new' | 'newConfirm';

const PROMPT: Record<Step, StringKey> = {
  create: 'security.createPin',
  confirm: 'security.confirmPin',
  turnOff: 'security.turnOffPin',
  current: 'security.currentPin',
  new: 'security.newPin',
  newConfirm: 'security.confirmPin',
};

export default function Security() {
  const { c } = useTheme();
  const lock = useAppLock();
  const [step, setStep] = useState<Step | null>(null);
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [length, setLength] = useState<PinLength>(lock.pinLength);
  const [error, setError] = useState<string | null>(null);
  const [canBiometric, setCanBiometric] = useState(false);

  useEffect(() => {
    biometricAvailable().then(setCanBiometric);
  }, []);

  function start(next: Step) {
    setStep(next);
    setPin('');
    setFirst('');
    setError(null);
    setLength(next === 'turnOff' || next === 'current' ? lock.pinLength : length);
  }

  function cancel() {
    setStep(null);
    setPin('');
    setFirst('');
    setError(null);
  }

  /** Called with every digit typed; acts once the PIN is complete. */
  async function onChange(next: string) {
    setPin(next);
    if (!step || next.length < length) return;
    setError(null);
    setPin('');
    try {
      if (step === 'create' || step === 'new') {
        if (isWeakPin(next)) return setError(t('security.weak'));
        setFirst(next);
        setStep(step === 'create' ? 'confirm' : 'newConfirm');
      } else if (step === 'confirm' || step === 'newConfirm') {
        if (next !== first) {
          start(step === 'confirm' ? 'create' : 'new');
          return setError(t('security.mismatch'));
        }
        if (step === 'confirm') await enableLock(next, length);
        else await changePin(next, length);
        cancel();
      } else {
        const result = await verifyPin(next);
        if (!result.ok) {
          return setError(result.waitSeconds > 0 ? t('lock.wait', { seconds: result.waitSeconds }) : t('lock.wrong'));
        }
        if (step === 'turnOff') {
          await disableLock();
          cancel();
        } else {
          start('new');
        }
      }
    } catch {
      setError(t('security.saveFailed'));
      cancel();
    }
  }

  async function toggleBiometric(on: boolean) {
    if (!on) return setBiometric(false);
    // Prove it works before relying on it.
    if (await promptBiometric()) setBiometric(true);
  }

  const row = { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 } as const;
  const creating = step === 'create' || step === 'new';

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('security.title')}</AppText>

      {step ? (
        <Card style={{ alignItems: 'center', gap: 20 }}>
          <AppText variant="section">{t(PROMPT[step])}</AppText>
          {creating ? (
            <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel={t('security.pinLength')}>
              {PIN_LENGTHS.map((n) => (
                <Chip key={n} label={t(`security.pin${n}`)} selected={length === n} onPress={() => { setLength(n); setPin(''); }} />
              ))}
            </View>
          ) : null}
          <PinPad value={pin} length={length} onChange={onChange} />
          <AppText variant="small" tone="negative" accessibilityLiveRegion="polite" style={{ minHeight: 20 }}>
            {error ?? ' '}
          </AppText>
          <Pressable accessibilityRole="button" onPress={cancel} hitSlop={12}>
            <AppText variant="bodyStrong" tone="accent">
              {t('security.cancel')}
            </AppText>
          </Pressable>
        </Card>
      ) : (
        <>
          <Card style={{ paddingVertical: 4 }}>
            <View style={row}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{t('security.on')}</AppText>
                <AppText variant="small" tone="muted">{t('security.onHint')}</AppText>
              </View>
              <Toggle
                accessibilityLabel={t('security.on')}
                value={lock.enabled}
                onValueChange={(on) => start(on ? 'create' : 'turnOff')}
              />
            </View>
            {lock.enabled && Platform.OS !== 'web' ? (
              <View style={[row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{t('security.biometric')}</AppText>
                  <AppText variant="small" tone="muted">
                    {canBiometric ? t('security.biometricHint') : t('security.biometricUnavailable')}
                  </AppText>
                </View>
                <Toggle
                  accessibilityLabel={t('security.biometric')}
                  value={lock.biometric}
                  disabled={!canBiometric}
                  onValueChange={toggleBiometric}
                />
              </View>
            ) : null}
          </Card>

          {lock.enabled ? (
            <>
              <View style={{ gap: 8 }}>
                <AppText variant="section">{t('security.timeout')}</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {TIMEOUTS.map((s) => (
                    <Chip key={s} label={t(`security.timeout.${s}`)} selected={lock.timeout === s} onPress={() => setLockTimeout(s)} />
                  ))}
                </View>
              </View>
              <Card style={{ paddingVertical: 4 }}>
                <Pressable accessibilityRole="button" onPress={() => start('current')} style={row}>
                  <AppText variant="bodyStrong" tone="accent" style={{ flex: 1 }}>
                    {t('security.changePin')}
                  </AppText>
                </Pressable>
              </Card>
            </>
          ) : null}

          <AppText variant="small" tone="muted">
            {Platform.OS === 'web' ? t('security.webNote') : t('security.note')}
          </AppText>
        </>
      )}
    </Screen>
  );
}
