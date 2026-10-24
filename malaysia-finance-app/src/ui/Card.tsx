import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, radius } from './theme';
import { useTheme } from './useTheme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, scheme } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: radius.card, padding: 18 },
        scheme === 'dark' ? { borderWidth: 1, borderColor: c.border } : elevation(scheme),
        style,
      ]}
    >
      {children}
    </View>
  );
}
