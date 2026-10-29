import { useEffect } from 'react';
import type { ViewProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motionTiming } from './motion';
import { useMotion } from './useMotion';

/** Brief entry for newly opened content; children keep their identity through preference changes. */
export function Reveal({ style, ...props }: ViewProps) {
  const reduced = useMotion();
  const shown = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { shown.value = withTiming(1, motionTiming('change', reduced)); }, [shown, reduced]);
  const animated = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : shown.value,
    transform: [{ translateY: reduced ? 0 : (1 - shown.value) * 4 }],
  }));
  return <Animated.View {...props} style={[style, animated]} />;
}
