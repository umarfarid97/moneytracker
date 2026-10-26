// Phones: lock settings live in expo-sqlite's key-value store; the PIN (as a salted hash) lives in the OS keystore.
// Neither is part of the database, so neither is ever backed up or synced. The web build uses lockStorage.web.ts.
import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';

const SETTINGS_KEY = 'appLock';
const PIN_KEY = 'duit.pin';

export function loadLockSettings(): string | null {
  try {
    return Storage.getItemSync(SETTINGS_KEY);
  } catch {
    return null;
  }
}

export function saveLockSettings(value: string): void {
  try {
    Storage.setItemSync(SETTINGS_KEY, value);
  } catch {
    // Ignore: the setting lasts until the app restarts.
  }
}

export async function loadPinRecord(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PIN_KEY);
  } catch {
    return null;
  }
}

/** Throws when the keystore refuses: the lock must not switch on without a stored PIN. */
export async function savePinRecord(value: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, value);
}

export async function clearPinRecord(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_KEY);
  } catch {
    // Nothing stored.
  }
}
