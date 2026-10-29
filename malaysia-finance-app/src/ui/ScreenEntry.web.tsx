import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useFocusEffect, useSegments } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motionTiming } from './motion';
import { useMotion } from './useMotion';

/** The web native-stack does not implement its native animation option. */
export function ScreenEntry({ children }: { children: ReactNode }) {
  const reduced = useMotion();
  const segments = useSegments();
  const tabs = segments[0] === '(tabs)';
  const preference = useRef(reduced);
  const shown = useSharedValue(reduced || tabs ? 1 : 0);
  useEffect(() => {
    preference.current = reduced;
    if (reduced) shown.value = 1;
  }, [reduced, shown]);
  useFocusEffect(useCallback(() => {
    if (preference.current || tabs) { shown.value = 1; return; }
    shown.value = 0;
    shown.value = withTiming(1, motionTiming('screen', false));
  }, [tabs, shown]));
  const style = useAnimatedStyle(() => ({ opacity: reduced || tabs ? 1 : shown.value }));
  return <Animated.View testID="screen-entry" style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}
