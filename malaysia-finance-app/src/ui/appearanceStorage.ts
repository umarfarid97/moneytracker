// Phones keep the appearance choice in expo-sqlite's key-value store; the web build uses appearanceStorage.web.ts.
import Storage from 'expo-sqlite/kv-store';

export function loadAppearance(): string | null {
  try {
    return Storage.getItemSync('appearance');
  } catch {
    return null;
  }
}

export function saveAppearance(value: string): void {
  try {
    Storage.setItemSync('appearance', value);
  } catch {
    // Ignore: the choice simply lasts until the app restarts.
  }
}

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

export function loadThemeName(): string | null {
  try {
    return Storage.getItemSync('theme');
  } catch {
    return null;
  }
}

export function saveThemeName(value: string): void {
  try {
    Storage.setItemSync('theme', value);
  } catch {
    // Ignore: the choice simply lasts until the app restarts.
  }
}
