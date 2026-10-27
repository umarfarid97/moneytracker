// Web build: the token and data key live in localStorage. Anyone with access to this browser profile (or a
// script running on this page) could read them, which is why the page loads no third-party scripts.
import type { CloudSession } from './cloudSessionType';

export type { CloudSession };
const KEY = 'duit.cloud';

export async function loadCloudSession(): Promise<CloudSession | null> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CloudSession) : null;
  } catch {
    return null;
  }
}

export async function saveCloudSession(session: CloudSession): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearCloudSession(): Promise<void> {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
