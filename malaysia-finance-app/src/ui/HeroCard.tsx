import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { cardChrome, radius, type Hero } from './theme';
import { useTheme } from './useTheme';

/** `hero` is kept so each tab can still name its card; every hero now looks the same. */
type Props = { children: ReactNode; hero?: Hero; style?: StyleProp<ViewStyle> };

/** Summary card at the top of a tab: a large white card with a soft shadow and a big blue figure. */
export function HeroCard({ children, style }: Props) {
  const { c, scheme } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: radius.card, padding: 22 },
        cardChrome(c, scheme),
        style,
      ]}
    >
      {children}
    </View>
  );
}
