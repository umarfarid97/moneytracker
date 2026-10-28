import type { Palette, Scheme } from './theme';
import { PALETTE } from './themeDefs';

/** The app has one look (dark green), so this is constant; screens still read colours from `c`. */
export function useTheme(): { scheme: Scheme; c: Palette } {
  return { scheme: 'dark', c: PALETTE };
}
