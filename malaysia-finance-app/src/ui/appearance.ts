/**
 * Which colour scheme the app uses. It opens in the light design by default, whatever the device
 * is set to; "system" follows the device and "dark" forces dark. Changed from More > Appearance.
 */
import { useSyncExternalStore } from 'react';
import { loadAppearance, loadThemeName, saveAppearance, saveThemeName } from './appearanceStorage';
import { applyTheme } from './theme';
import { THEME_NAMES, type ThemeName } from './themeDefs';
import { loadThemeFonts } from './themeFonts';

export type Appearance = 'system' | 'light' | 'dark';
export const APPEARANCES: readonly Appearance[] = ['light', 'dark', 'system'];

const isAppearance = (v: unknown): v is Appearance => v === 'system' || v === 'light' || v === 'dark';

let current: Appearance | undefined;
const listeners = new Set<() => void>();

export function getAppearance(): Appearance {
  if (current === undefined) {
    const saved = loadAppearance();
    current = isAppearance(saved) ? saved : 'light';
  }
  return current;
}

export function setAppearance(next: Appearance): void {
  current = next;
  saveAppearance(next);
  listeners.forEach((l) => l());
  notifyPrefsChanged();
}

/**
 * The theme and light/dark choice are also kept in the database so they sync with the account. The data layer
 * registers a listener here to save each change; changes that arrive from sync use applyThemePrefs, which
 * doesn't call it back.
 */
let prefsListener: (() => void) | null = null;
export function onThemePrefsChanged(listener: (() => void) | null): void {
  prefsListener = listener;
}
function notifyPrefsChanged() {
  prefsListener?.();
}

/** Applies a theme and light/dark choice that came from the database (a sync or restore), without saving it again. */
export function applyThemePrefs(prefs: { theme?: unknown; appearance?: unknown }): void {
  if (isAppearance(prefs.appearance) && prefs.appearance !== getAppearance()) {
    current = prefs.appearance;
    saveAppearance(prefs.appearance);
    listeners.forEach((l) => l());
  }
  if (isThemeName(prefs.theme) && prefs.theme !== getThemeName()) {
    const next = prefs.theme;
    void loadThemeFonts(next);
    currentTheme = next;
    applyTheme(next);
    saveThemeName(next);
    themeListeners.forEach((l) => l());
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, getAppearance, getAppearance);
}

/**
 * Which design theme the app wears (More > Appearance > Theme). It sits beside the light/dark choice: every
 * theme has its own light and dark palette. Kept on the device for a quick start, and mirrored into the synced settings (see onThemePrefsChanged).
 */
let currentTheme: ThemeName | undefined;
const themeListeners = new Set<() => void>();

const isThemeName = (v: unknown): v is ThemeName => THEME_NAMES.includes(v as ThemeName);

export function getThemeName(): ThemeName {
  if (currentTheme === undefined) {
    const saved = loadThemeName();
    currentTheme = isThemeName(saved) ? saved : 'classic';
    applyTheme(currentTheme);
  }
  return currentTheme;
}

/**
 * Switches theme straight away and fetches its fonts in the background. Waiting for the font download first made the
 * tap look dead on a slow connection (Safari); text shows in the system font for a moment, then the browser swaps
 * the theme font in on its own once it arrives.
 */
export function setThemeName(next: ThemeName): Promise<void> {
  const fonts = loadThemeFonts(next);
  currentTheme = next;
  applyTheme(next);
  saveThemeName(next);
  themeListeners.forEach((l) => l());
  notifyPrefsChanged();
  return fonts;
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

export function useThemeName(): ThemeName {
  return useSyncExternalStore(subscribeTheme, getThemeName, getThemeName);
}
