// Phones keep the language and balance choices in expo-sqlite's key-value store; the web build uses appearanceStorage.web.ts.
import Storage from 'expo-sqlite/kv-store';

export function loadLanguage(): string | null {
  try {
    return Storage.getItemSync('language');
  } catch {
    return null;
  }
}

export function saveLanguage(value: string): void {
  try {
    Storage.setItemSync('language', value);
  } catch {
    // Ignore: the choice simply lasts until the app restarts.
  }
}

export function loadHideBalance(): boolean {
  try {
    return Storage.getItemSync('hideBalance') !== 'false';
  } catch {
    return true;
  }
}

export function saveHideBalance(hidden: boolean): void {
  try {
    Storage.setItemSync('hideBalance', hidden ? 'true' : 'false');
  } catch {
    // Ignore: the choice simply lasts until the app restarts.
  }
}
