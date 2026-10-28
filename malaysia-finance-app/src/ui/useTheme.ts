import { useColorScheme } from 'react-native';
import { useAppearance, useThemeName } from './appearance';
import type { Palette, Scheme, ThemeName } from './theme';
import { THEMES } from './themeDefs';

export function useTheme(): { scheme: Scheme; c: Palette; theme: ThemeName } {
  const appearance = useAppearance();
  const theme = useThemeName();
  const device = useColorScheme();
  // Dark green and Pastel dark are dark only; Classic follows the Light / Dark / Match device choice.
  const scheme: Scheme = THEMES[theme].darkOnly ? 'dark' : appearance === 'system' ? (device === 'dark' ? 'dark' : 'light') : appearance;
  return { scheme, c: THEMES[theme].palette[scheme], theme };
}
