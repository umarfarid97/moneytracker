import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from './useTheme';

type Props = { fraction: number; color?: string };

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Thin bar that animates to its fraction (0 to 1). */
export function ProgressBar({ fraction, color }: Props) {
  const { c } = useTheme();
  const value = clamp(fraction);
  const width = useSharedValue(value);
  useEffect(() => {
    width.value = withTiming(value, { duration: 400 });
  }, [value, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: color ?? c.accent }, fill]} />
    </View>
  );
}
