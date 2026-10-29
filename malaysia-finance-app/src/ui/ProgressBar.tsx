import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from './useTheme';
import { motionTiming } from './motion';
import { useMotion } from './useMotion';

type Props = { fraction: number; color?: string };

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Thin bar that animates to its fraction (0 to 1); the fill is the brand gradient unless a colour is given. */
export function ProgressBar({ fraction, color }: Props) {
  const { c } = useTheme();
  const reduced = useMotion();
  const value = clamp(fraction);
  const width = useSharedValue(value);
  useEffect(() => {
    width.value = withTiming(value, motionTiming('progress', reduced));
  }, [value, width, reduced]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: width.value }] }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden' }}
    >
      <Animated.View style={[{ width: '100%', height: 8, transformOrigin: 'left center', borderRadius: 4, overflow: 'hidden', backgroundColor: color ?? c.accent }, fill]}>
        {color ? null : <LinearGradient colors={c.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />}
      </Animated.View>
    </View>
  );
}
