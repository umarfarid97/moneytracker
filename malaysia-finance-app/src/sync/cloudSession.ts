// Phones: the sign-in token and the data key live in the OS keystore, so they are never in the database,
// a backup file, or a sync. The web build uses cloudSession.web.ts.
import * as SecureStore from 'expo-secure-store';
import type { CloudSession } from './cloudSessionType';

export type { CloudSession };
const KEY = 'duit.cloud';

export async function loadCloudSession(): Promise<CloudSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as CloudSession) : null;
  } catch {
    return null;
  }
}

export async function saveCloudSession(session: CloudSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearCloudSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing stored.
  }
}
