// Web build only: the language and balance choices live in localStorage next to the sql.js database.
export function loadLanguage(): string | null {
  try {
    return localStorage.getItem('duit.language');
  } catch {
    return null;
  }
}

export function saveLanguage(value: string): void {
  try {
    localStorage.setItem('duit.language', value);
  } catch {
    // Ignore: storage blocked, the choice lasts for this visit only.
  }
}

export function loadHideBalance(): boolean {
  try {
    return localStorage.getItem('duit.hideBalance') !== 'false';
  } catch {
    return true;
  }
}

export function saveHideBalance(hidden: boolean): void {
  try {
    localStorage.setItem('duit.hideBalance', hidden ? 'true' : 'false');
  } catch {
    // Ignore: storage blocked, the choice lasts for this visit only.
  }
}
