import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { glow, heroGradient, radius, type Hero } from './theme';
import { useTheme } from './useTheme';

/** Text colours for content on a hero card. */
export const onHero = { ink: '#ffffff', soft: 'rgba(255,255,255,0.86)', chip: 'rgba(255,255,255,0.2)' } as const;

type Props = { children: ReactNode; hero?: Hero; style?: StyleProp<ViewStyle> };

// The light circles need the card to clip its rounded corners, which Android does slowly; it shows the plain gradient.
const DECOR = Platform.OS !== 'android';

/** Gradient summary card at the top of a tab, with two soft light circles for depth. */
export function HeroCard({ children, hero = 'brand', style }: Props) {
  const { scheme } = useTheme();
  const colors = heroGradient(hero, scheme);
  const circle = { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' } as const;
  return (
    <View style={[{ borderRadius: radius.card + 2 }, glow(colors[1], scheme)]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius: radius.card + 2, padding: 20 }, DECOR ? { overflow: 'hidden' } : null, style]}
      >
        {DECOR ? (
          <>
            <View pointerEvents="none" style={[circle, { width: 180, height: 180, top: -70, right: -50 }]} />
            <View pointerEvents="none" style={[circle, { width: 110, height: 110, bottom: -50, right: 70, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          </>
        ) : null}
        {children}
      </LinearGradient>
    </View>
  );
}
