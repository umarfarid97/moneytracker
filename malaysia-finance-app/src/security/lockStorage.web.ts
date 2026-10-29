// Web build: settings and the salted PIN hash live in localStorage. That only keeps a casual visitor out of the
// page; anyone with access to the browser profile can still read the data, which the PIN screen says.
export function loadLockSettings(): string | null {
  try {
    return localStorage.getItem('duit.appLock');
  } catch {
    return null;
  }
}

export function saveLockSettings(value: string): void {
  try {
    localStorage.setItem('duit.appLock', value);
  } catch {
    // Ignore: storage blocked, the setting lasts for this visit only.
  }
}

export async function loadPinRecord(): Promise<string | null> {
  try {
    return localStorage.getItem('duit.pin');
  } catch {
    return null;
  }
}

export async function savePinRecord(value: string): Promise<void> {
  localStorage.setItem('duit.pin', value);
}

export async function clearPinRecord(): Promise<void> {
  try {
    localStorage.removeItem('duit.pin');
  } catch {
    // Nothing stored.
  }
}

export async function loadAttemptRecord(): Promise<string | null> { return localStorage.getItem('duit.pinAttempts'); }
export async function saveAttemptRecord(value: string): Promise<void> { localStorage.setItem('duit.pinAttempts', value); }
