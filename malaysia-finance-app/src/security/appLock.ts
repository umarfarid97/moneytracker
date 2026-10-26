/**
 * App lock: the app asks for a PIN (or fingerprint / Face ID) on a cold start and after it has been in the
 * background for the chosen time. Settings are per phone and are not part of backups or Drive sync, and the
 * PIN is only ever stored as a salted hash (see lockStorage).
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { t } from '@/i18n/t';
import { clearPinRecord, loadLockSettings, loadPinRecord, saveLockSettings, savePinRecord } from './lockStorage';
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
  await savePinRecord(await makePinRecord(pin));
  failures = 0;
  update({ enabled: true, pinLength: length, locked: false });
}

/** Replaces the PIN (the caller has already checked the old one). */
export async function changePin(pin: string, length: PinLength): Promise<void> {
  if (!isValidPin(pin, length)) throw new Error('invalid pin');
  await savePinRecord(await makePinRecord(pin));
  update({ pinLength: length });
}

/** Switches the lock off and forgets the PIN. */
export async function disableLock(): Promise<void> {
  await clearPinRecord();
  failures = 0;
  update({ enabled: false, biometric: false, locked: false });
}

export const setBiometric = (biometric: boolean) => update({ biometric });
export const setLockTimeout = (timeout: LockTimeout) => update({ timeout });

let failures = 0;
let blockedUntil = 0;

export type PinResult = { ok: true } | { ok: false; waitSeconds: number };

/** Checks a PIN. Too many wrong ones in a row make the keypad wait, longer each time. */
export async function verifyPin(pin: string, now: number = Date.now()): Promise<PinResult> {
  if (now < blockedUntil) return { ok: false, waitSeconds: Math.ceil((blockedUntil - now) / 1000) };
  if (await checkPin(await loadPinRecord(), pin)) {
    failures = 0;
    return { ok: true };
  }
  failures += 1;
  const wait = lockoutSeconds(failures);
  blockedUntil = wait > 0 ? now + wait * 1000 : 0;
  return { ok: false, waitSeconds: wait };
}

/** Unlocks after a correct PIN or biometric check. */
export const unlock = () => update({ locked: false }, false);

export const lockNow = () => {
  if (getLockState().enabled) update({ locked: true }, false);
};

let leftAt: number | null = null;

/** Call when the app goes to the background. */
export function noteBackground(now: number = Date.now()): void {
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
  failures = 0;
  blockedUntil = 0;
  leftAt = null;
}
