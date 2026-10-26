// Phones keep the quick-add switch in expo-sqlite's key-value store. It is per device (a notification only
// exists on the phone that shows it), so it is not part of backups or sync. The web build uses storage.web.ts.
import Storage from 'expo-sqlite/kv-store';

export function loadQuickAdd(): string | null {
  try {
    return Storage.getItemSync('quickAdd');
  } catch {
    return null;
  }
}

export function saveQuickAdd(value: string): void {
  try {
    Storage.setItemSync('quickAdd', value);
  } catch {
    // Ignore: the choice lasts until the app restarts.
  }
}
