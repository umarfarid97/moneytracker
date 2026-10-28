import { useColorScheme } from 'react-native';
import { useAppearance, useThemeName } from './appearance';
import type { Palette, Scheme, ThemeName } from './theme';
import { THEMES } from './themeDefs';

export function useTheme(): { scheme: Scheme; c: Palette; theme: ThemeName } {
  const appearance = useAppearance();
  const theme = useThemeName();
  const device = useColorScheme();
  const scheme: Scheme = appearance === 'system' ? (device === 'dark' ? 'dark' : 'light') : appearance;
  return { scheme, c: THEMES[theme].palette[scheme], theme };
}
