import { useColorScheme } from 'react-native';
import { useAppearance } from './appearance';
import { palette, type Palette, type Scheme } from './theme';

export function useTheme(): { scheme: Scheme; c: Palette } {
  const appearance = useAppearance();
  const device = useColorScheme();
  const scheme: Scheme = appearance === 'system' ? (device === 'dark' ? 'dark' : 'light') : appearance;
  return { scheme, c: palette[scheme] };
}
