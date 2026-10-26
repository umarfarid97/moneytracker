import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, radius, type Hero } from './theme';
import { useTheme } from './useTheme';

/** Text colours for content on a hero card: the headline figure and links in blue, supporting text in grey. */
export const onHero = { ink: '#0d5bd3', soft: '#62677a', chip: '#e8f0fc' } as const;

/** `hero` is kept so each tab can still name its card; every hero now looks the same. */
type Props = { children: ReactNode; hero?: Hero; style?: StyleProp<ViewStyle> };

/** Summary card at the top of a tab: a large white card with a soft shadow and a big blue figure. */
export function HeroCard({ children, style }: Props) {
  const { c, scheme } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: radius.card, padding: 22 },
        scheme === 'dark' ? { borderWidth: 1, borderColor: c.border } : elevation(scheme),
        style,
      ]}
    >
      {children}
    </View>
  );
}
