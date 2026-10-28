import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { cardChrome, radius } from './theme';
import { useTheme } from './useTheme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, scheme } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: radius.card, padding: 18 },
        cardChrome(c, scheme),
        style,
      ]}
    >
      {children}
    </View>
  );
}
