// Web build: there are no notifications to pin, but the setting still has somewhere to live.
export function loadQuickAdd(): string | null {
  try {
    return localStorage.getItem('duit.quickAdd');
  } catch {
    return null;
  }
}

export function saveQuickAdd(value: string): void {
  try {
    localStorage.setItem('duit.quickAdd', value);
  } catch {
    // Ignore: storage blocked, the choice lasts for this visit only.
  }
}
