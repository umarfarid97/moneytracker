import { useColorScheme } from 'react-native';
import { palette, type Palette, type Scheme } from './theme';

export function useTheme(): { scheme: Scheme; c: Palette } {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, c: palette[scheme] };
}
