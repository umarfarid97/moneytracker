/**
 * App lock: the app asks for a PIN (or fingerprint / Face ID) on a cold start and after it has been in the
 * background for the chosen time. Settings are per phone and are not part of backups or Drive sync, and the
 * PIN is only ever stored as a salted hash (see lockStorage).
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { t } from '@/i18n/t';
import { loadAttemptRecord, saveAttemptRecord, clearPinRecord, loadLockSettings, loadPinRecord, saveLockSettings, savePinRecord } from './lockStorage';
import { checkPin, isValidPin, lockoutSeconds, makePinRecord, type PinLength } from './pin';

/** Seconds in the background before the app locks; 0 locks as soon as it is left. */
export const TIMEOUTS = [0, 30, 60, 300] as const;
export type LockTimeout = (typeof TIMEOUTS)[number];

type Settings = { enabled: boolean; biometric: boolean; timeout: LockTimeout; pinLength: PinLength };
export type LockState = Settings & { locked: boolean };

const DEFAULTS: Settings = { enabled: false, biometric: false, timeout: 60, pinLength: 6 };

function readSettings(): Settings {
  try {
    const raw = JSON.parse(loadLockSettings() ?? 'null') as Partial<Settings> | null;
    if (!raw) return DEFAULTS;
    return {
      enabled: raw.enabled === true,
      biometric: raw.biometric === true,
      timeout: TIMEOUTS.includes(raw.timeout as LockTimeout) ? (raw.timeout as LockTimeout) : DEFAULTS.timeout,
      pinLength: raw.pinLength === 4 ? 4 : 6,
    };
  } catch {
    return DEFAULTS;
  }
}

let state: LockState | undefined;
let lifecycle = 0;
const listeners = new Set<() => void>();

/** A cold start begins locked whenever the lock is on. */
export function getLockState(): LockState {
  if (!state) {
    const settings = readSettings();
    state = { ...settings, locked: settings.enabled };
  }
  return state;
}

function update(patch: Partial<LockState>, persist = true): void {
  const next = { ...getLockState(), ...patch };
  state = next;
  if (persist) {
    const { enabled, biometric, timeout, pinLength } = next;
    saveLockSettings(JSON.stringify({ enabled, biometric, timeout, pinLength }));
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppLock(): LockState {
  return useSyncExternalStore(subscribe, getLockState, getLockState);
}

/** Whether this phone can check a fingerprint or face (never on the web). */
export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Asks for a fingerprint / face. The device passcode is not offered; the app's own PIN is the fallback. */
export async function promptBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('lock.biometricPrompt'),
      cancelLabel: t('lock.usePin'),
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}

/** Switches the lock on with a new PIN. Rejects when the PIN cannot be stored, leaving the lock off. */
export async function enableLock(pin: string, length: PinLength): Promise<void> {
  if (!isValidPin(pin, length)) throw new Error('invalid pin');
  await savePinRecord(JSON.stringify({ ...JSON.parse(await makePinRecord(pin)), attemptVersion: 1 }));
  await saveAttemptRecord(JSON.stringify({ failures: 0, blockedUntil: 0 }));
  update({ enabled: true, pinLength: length, locked: false });
}

/** Replaces the PIN (the caller has already checked the old one). */
export async function changePin(pin: string, length: PinLength): Promise<void> {
  if (!isValidPin(pin, length)) throw new Error('invalid pin');
  const record = JSON.stringify({ ...JSON.parse(await makePinRecord(pin)), attemptVersion: 1 });
  // Complete fallible throttle persistence before replacing the still-working PIN.
  await saveAttemptRecord(JSON.stringify({ failures: 0, blockedUntil: 0 }));
  await savePinRecord(record);
  update({ pinLength: length });
}

/** Switches the lock off and forgets the PIN. */
export async function disableLock(): Promise<void> {
  await clearPinRecord();
  update({ enabled: false, biometric: false, locked: false });
}

export const setBiometric = (biometric: boolean) => { if (!getLockState().locked) update({ biometric }); };
export const setLockTimeout = (timeout: LockTimeout) => update({ timeout });

let verificationQueue: Promise<unknown> = Promise.resolve();
export type PinResult = { ok: true } | { ok: false; waitSeconds: number; storageError?: boolean };

/** Each admission reads durable state; no PIN is checked if storage cannot enforce the budget. */
export function verifyPin(pin: string, now: number = Date.now()): Promise<PinResult> {
  const run = verificationQueue.then(async (): Promise<PinResult> => {
    try {
      let raw = await loadAttemptRecord();
      const pinRecord = await loadPinRecord();
      const storedPin = JSON.parse(pinRecord ?? 'null');
      if (!storedPin || typeof storedPin.salt !== 'string' || !/^[a-f0-9]{64}$/i.test(storedPin.hash)) throw new Error('invalid pin record');
      // Legacy PINs predate throttle storage. Stamp the protected PIN after initializing it once.
      if (storedPin.attemptVersion === undefined) {
        if (raw === null) {
          raw = JSON.stringify({ failures: 0, blockedUntil: 0 });
          await saveAttemptRecord(raw);
        }
        await savePinRecord(JSON.stringify({ ...storedPin, attemptVersion: 1 }));
      } else if (storedPin.attemptVersion !== 1) throw new Error('invalid attempt version');
      if (raw === null) throw new Error('missing attempt record');
      const record = JSON.parse(raw);
      if (!Number.isSafeInteger(record.failures) || record.failures < 0 || !Number.isSafeInteger(record.blockedUntil) || record.blockedUntil < 0) throw new Error('invalid attempts');
      if (now < record.blockedUntil) return { ok: false, waitSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
      const ok = await checkPin(pinRecord, pin);
      const failures = ok ? 0 : Math.min(record.failures + 1, 1000);
      const wait = ok ? 0 : lockoutSeconds(failures);
      await saveAttemptRecord(JSON.stringify({ failures, blockedUntil: wait > 0 ? now + wait * 1000 : 0 }));
      return ok ? { ok: true } : { ok: false, waitSeconds: wait };
    } catch {
      return { ok: false, waitSeconds: 0, storageError: true };
    }
  });
  verificationQueue = run.catch(() => undefined);
  return run;
}

/** Unlocks after a correct PIN or biometric check. */
export const unlock = () => { lifecycle++; update({ locked: false }, false); };

/** PIN checks used for unlocking are bound to the foreground lifecycle that requested them. */
export async function authenticateWithPin(pin: string): Promise<PinResult> {
  const epoch = lifecycle;
  const result = await verifyPin(pin);
  if (!result.ok) return result;
  if (epoch !== lifecycle || leftAt !== null || !getLockState().locked) return { ok: false, waitSeconds: 0 };
  unlock();
  return result;
}

/** A configured biometric may repair the throttle, only for the current foreground lock. */
export async function authenticateToUnlock(): Promise<boolean> {
  const epoch = lifecycle;
  if (!getLockState().biometric || !getLockState().locked || leftAt !== null) return false;
  if (!(await promptBiometric()) || epoch !== lifecycle || leftAt !== null || !getLockState().locked) return false;
  const repair = verificationQueue.then(async () => {
    if (epoch !== lifecycle) return false;
    await saveAttemptRecord(JSON.stringify({ failures: 0, blockedUntil: 0 }));
    if (epoch !== lifecycle || leftAt !== null) return false;
    unlock();
    return true;
  });
  verificationQueue = repair.catch(() => undefined);
  try { return await repair; } catch { return false; }
}

export const lockNow = () => {
  lifecycle++;
  if (getLockState().enabled) update({ locked: true }, false);
};

let leftAt: number | null = null;

/** Call when the app goes to the background. */
export function noteBackground(now: number = Date.now()): void {
  lifecycle++;
  leftAt ??= now;
}

/** Call when the app comes back; locks if it was away for at least the chosen time. Returns whether it locked. */
export function noteForeground(now: number = Date.now()): boolean {
  const away = leftAt === null ? 0 : (now - leftAt) / 1000;
  const wasAway = leftAt !== null;
  leftAt = null;
  const { enabled, timeout, locked } = getLockState();
  if (enabled && !locked && wasAway && away >= timeout) {
    update({ locked: true }, false);
    return true;
  }
  return false;
}

/** For tests: forget everything held in memory. */
export function resetLockForTests(): void {
  state = undefined;
  verificationQueue = Promise.resolve();
  lifecycle++;
  leftAt = null;
}
