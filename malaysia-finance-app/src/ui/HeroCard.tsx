import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OnHeroContext } from './AppText';
import { cardChrome, radius, type Hero } from './theme';
import { useTheme } from './useTheme';

/** `hero` is kept so each tab can still name its card; every hero now looks the same. */
type Props = { children: ReactNode; hero?: Hero; style?: StyleProp<ViewStyle> };

/**
 * Summary card at the top of a tab: a large white card with a soft shadow and a big blue figure (Classic), or a
 * sage-green gradient with dark ink (Dark green).
 */
export function HeroCard({ children, style }: Props) {
  const { c, scheme } = useTheme();
  if (c.heroGradient) {
    return (
      <View style={[{ borderRadius: radius.card, overflow: 'hidden', padding: 22 }, style]}>
        <LinearGradient colors={c.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <OnHeroContext.Provider value>{children}</OnHeroContext.Provider>
      </View>
    );
  }
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
